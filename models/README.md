# Models — Dự đoán hủy phòng

**Problem:** ~28% booking hủy; cần P(hủy) lúc đặt để phân luồng (an toàn → xác nhận → buffer Direct) — không tự chặn OTA.  
**Thesis:** FE booking-time + LightGBM + **isotonic calibration** + ngưỡng chọn trên train-val (Recall hủy ≥ 0,85, rồi min FP) cho scoring vận hành tốt hơn chỉ hạ/nâng ngưỡng trên v2.1.  
**Ship:** LightGBM **v2.2** @ t = 0,25 (`SHIP_CANDIDATE`). Mode inventory (ít bỏ sót hủy) vẫn là **v2.1 @ 0,28**.

Nguồn: `data/hotel_bookings_v5.csv`. Báo cáo: `reports/06`–`09*`, `11`/`11b`, `13`, `14`. Tracker: `refine-logs/EXPERIMENT_TRACKER.md`.  
Chuỗi giá / RevPAR: [`../notebooks/`](../notebooks/README.md).

---

## Claim map

| Claim | Vì sao quan trọng | Evidence tối thiểu | Block |
|-------|-------------------|-------------------|-------|
| **C1 (chính).** FE booking-time + calibrate + t\* trên val **giảm FP** so v2.1, **giữ Recall ≥ 0,85**, và **nâng AUC** (không chỉ đổi ngưỡng). | Scoring RM cần ít cảnh báo giả; ranking phải tốt hơn policy t = 0,51. | Test: Rec ≥ 0,85 · FP < v2.1@0,51 · ΔAUC CI 95% > 0 · McNemar p < 0,05 | B1, B2, B4 |
| **C2 (phụ).** Bốn nhóm FE nghiệp vụ + SHAP **đọc được** (lead, Online TA, parking, request) — đủ rule vận hành, không cần black box. | Front office / RM chỉ ship model giải thích được. | SHAP/gain khớp EDA H1–H3; top feature booking-time | B5 |
| **Anti-claim (loại).** Gain chỉ do hạ ngưỡng / chỉ do calibrate / dual-score phức tạp hơn global. | Tránh ship complexity không có evidence. | Ablation A thua AUC; B ≈ full AUC; luật B/C không thắng A | B3 |

Không claim: v2.2 thay **mọi** use-case. FN v2.2 (649) > v2.1@0,28 (225) — inventory protection vẫn dùng v2.1.

**Main phải chứng:** C1 trên cùng split (80/20, seed 42, n_test = 16.563).  
**Appendix:** RF v1.x, Optuna draft, W&B.  
**Cắt:** dual-score / ngưỡng segment (đã thua global t = 0,51); Optuna 100 trên FE v2.2 nếu không thắng val.

---

## Experiment blocks

Ràng buộc metric (mọi block từ v2.1): trong các t thỏa **Recall hủy ≥ 0,85**, chọn **min FP → max Precision → max Recall**.  
Leakage cấm: `reservation_status`, `reservation_status_date`, `revenue`, `Occupancy_Rate`, `RevPAR`, `assigned_room_type`. Split **trước** One-Hot.

### B1 — Anchor: có tách được hủy trên v5 không?

- **Claim:** tín hiệu deposit / segment / kênh / hotel đủ cho baseline.  
- **Hệ so sánh:** RF v1 (6 cat, t = 0,50) → v1.1 (+3 số, t = 0,35) → v1.2 (FE 4 nhóm + SHAP) → LGBM v2 (cùng FE, t = 0,35).  
- **Metric:** ROC-AUC (chính, ngưỡng-độc lập); Rec/Prec/FP tại t\*.  
- **Success:** AUC LGBM > RF trên cùng split.  
- **Failure:** AUC không tăng → dừng ở RF, không đổi thuật toán.  
- **Priority:** MUST (đã xong).

### B2 — Method: v2.2 vs baseline giảm-FP

- **Claim:** C1.  
- **Hệ:** v2@0,35 · v2.1@0,28 · v2.1@0,51 · **v2.2 cal @0,25**.  
- **Setup:** `CalibratedClassifierCV` isotonic cv=3; t\* trên 15% val tách từ train; refit full train; test một lần. Warm-start params v2.1.  
- **Success:** Rec ≥ 0,85 · FP < v2.1@0,51 · ΔAUC bootstrap CI > 0.  
- **Failure:** Rec vỡ hoặc FP không giảm → `DO_NOT_SHIP` / giữ policy 0,51.  
- **Priority:** MUST (R002).

### B3 — Novelty isolation (ablation A/B)

- **Claim:** FE (không phải chỉ calibrate) mang AUC; calibrate mang P đọc được (đổi t\*).  
- **Hệ:** A = FE v2.1 + cal + t\* · B = FE v2.2 **không** cal + t\* · C = full v2.2.  
- **Success:** A thua AUC vs C; B ≈ C về AUC.  
- **Failure:** A ≈ C → FE mới vô ích; B thua xa C về AUC → calibrate mới là nguồn ranking (mâu thuẫn thesis).  
- **Priority:** MUST (R003). Chi tiết bảng dưới.

### B4 — Simplicity: luật quyết định

- **Claim:** global threshold đủ; dual-score / segment không cần.  
- **Hệ:** luật A global · B dual AND · C ngưỡng Online TA vs còn lại (không retrain).  
- **Success:** winner = global (min FP trong Rec ≥ 0,85).  
- **Failure:** B hoặc C giảm FP rõ trên cùng Rec → ship dual-score.  
- **Priority:** MUST (đã xong: winner **global t = 0,51** trên v2.1).

### B5 — Chẩn đoán: SHAP + stats ship-gate

- **Claim:** C2 + C1 có ý nghĩa thống kê.  
- **Hệ:** McNemar v2.1@0,51 vs v2.2; bootstrap ΔAUC n = 500; two-proportion FPR. SHAP TreeExplainer, mẫu 2.000 test.  
- **Success:** McNemar p < 0,05 và n01 > n10; ΔAUC CI > 0; FPR giảm.  
- **Failure:** p không đạt ngưỡng hoặc CI chứa 0 → `EXTEND_OR_HOLD`.  
- **Priority:** MUST (R004).

---

## Run order

| Milestone | Goal | Runs | Decision gate | Cost | Status |
|-----------|------|------|---------------|------|--------|
| **M0** | Sanity: tái lập baseline | R001: v2@0,35 / v2.1@0,28 / @0,51 | Số khớp `threshold_policy` / `fp_reduction_policy` | CPU, phút | DONE |
| **M1** | Main method | R002: FE v2.2 + isotonic + t\* val | Rec ≥ 0,85 và FP < @0,28 | ~5–20 phút | DONE |
| **M2** | Ablation | R003: A / B / full | FE giải thích được ΔAUC | cùng job | DONE |
| **M3** | Stats + SHAP | R004: McNemar, ΔAUC CI, FPR, SHAP | `SHIP_CANDIDATE` vs không | SHAP thêm vài phút | DONE |
| **M4** | Nice-to-have | Optuna lại trên FE v2.2 (notebook nháp) | Chỉ promote nếu val > full hiện tại | Optuna lâu hơn | NHÁP — chưa promote |

Không GPU. Seed 42. `RUN_SHAP=0` tắt SHAP; `USE_WANDB=1` bật W&B (mặc định tắt).

---

## Kết quả (test, n = 16.563)

Nguồn: `artifacts/v2_2_comparison.csv`, `v2_2_ablation.csv`, `v2_2_stats.json`, `threshold_policy_v2_2.json`, `fp_reduction_comparison.csv`.

### Bảng so sánh chính

| System | t\* | ROC-AUC | Recall | Precision | FP | FN | ΔFP vs v2.1@0,51 |
|--------|----:|--------:|-------:|----------:|---:|---:|-----------------:|
| v2 | 0,35 | 0,871 | 0,899 | 0,492 | 4.330 | 469 | — |
| v2.1 inventory | 0,28 | 0,872 | **0,952** | 0,426 | 5.976 | **225** | — |
| v2.1 giảm-FP | 0,51 | 0,872 | 0,853 | 0,545 | 3.312 | 684 | baseline |
| **v2.2 calibrated** | **0,25** | **0,896** | **0,861** | **0,577** | **2.939** | 649 | **−373 (−11,3%)** |

ΔFP vs v2.1@0,28: **−3.037 (−50,8%)**. CV ROC-AUC train: 0,866 → 0,890. Bootstrap ΔAUC v2.2 − v2.1: **+0,024** (CI 95% **0,021–0,026**, n = 500). McNemar vs @0,51: n01 = 995, n10 = 587, p ≈ 10⁻²⁴. FPR (trên 11.906 nhãn âm): 0,278 → 0,247 (z = −5,49, p ≈ 4×10⁻⁸).

### Ablation đã chạy (R003)

| System | t\* | ROC-AUC | Recall | FP | FN |
|--------|----:|--------:|-------:|---:|---:|
| A — FE v2.1 + cal + t\* | 0,20 | 0,871 | 0,881 | 3.943 | 553 |
| B — FE v2.2, **không** cal | 0,52 | **0,896** | 0,865 | 2.963 | 631 |
| **C — full v2.2** | **0,25** | **0,896** | 0,861 | **2.939** | 649 |

### Luật quyết định (không retrain, v2.1)

| Luật | Best | FP | Recall |
|------|------|---:|-------:|
| A global | **t = 0,51** | **3.312** | 0,853 |
| B dual AND | t21 = 0,50 ∧ t2 = 0,38 | 3.338 | 0,852 |
| C segment | Online 0,52 / other 0,48 | 3.326 | 0,852 |

### Findings

**1. v2.2 thắng chế độ giảm-FP trên cả ranking và FP, không đánh đổi Recall dưới 0,85.**  
- *Observation:* AUC 0,896 vs 0,872; FP 2.939 vs 3.312; Rec 0,861 vs 0,853; ΔAUC CI không chứa 0.  
- *Interpretation:* FE mới cải thiện thứ tự P(hủy); calibrate dồn class âm về median P ≈ 0,084 nên t\* = 0,25 vẫn Rec đủ.  
- *Implication:* C1 được hỗ trợ — thay policy v2.1@0,51 bằng v2.2@0,25 cho scoring / cảnh báo RM.  
- *Next:* theo dõi drift `required_car_parking_spaces` theo tháng/hotel (gain/SHAP #1).

**2. FE v2.2 — không calibrate — đã mang gần hết ΔAUC; calibrate chủ yếu đổi thang xác suất.**  
- *Observation:* B AUC = 0,896 = full; A kẹt 0,871 (như v2.1). t\* B = 0,52 vs full 0,25; FP gần nhau (2.963 vs 2.939).  
- *Interpretation:* Anti-claim “chỉ nhờ calibrate / chỉ nhờ ngưỡng” bị loại. Calibrate để P đọc được và t\* ổn định train-val → test.  
- *Implication:* Không được giản lược v2.2 thành “v2.1 + isotonic”. Không được bỏ FE mới.  
- *Next:* (nice) Optuna trên FE v2.2 chỉ promote nếu val AUC > 0,890.

**3. Dual-score / ngưỡng segment không thắng global — complexity không earn được chỗ.**  
- *Observation:* B và C hơn global vài chục FP, Rec không hơn.  
- *Interpretation:* Hai model (v2, v2.1) correlate mạnh; AND cắt thêm TP hơn là FP.  
- *Implication:* B4 simplicity đứng; không ship dual-score.  
- *Next:* không lặp luật B/C trừ khi có model thứ hai **độc lập** (ví dụ tách City/Resort).

**4. v2.1@0,28 vẫn thắng FN — không có một “bản tốt nhất tuyệt đối”.**  
- *Observation:* FN 225 vs 649 (v2.2); Rec 0,952 vs 0,861.  
- *Interpretation:* `scale_pos_weight` ×1,5 + t thấp tối ưu inventory, không tối ưu false alarm.  
- *Implication:* Hai mode song song theo chi phí FP vs FN (báo cáo `13`).  
- *Next:* cost-sensitive threshold nếu RM chốt €/FP và €/FN.

**5. SHAP khớp EDA: parking, PRT, Online TA, lead, request — rule vận hành có chỗ bám.**  
- *Observation:* mean \|SHAP\|: parking 0,92 · `country_PRT` 0,69 · Online TA 0,43 · `lead_time` 0,35.  
- *Interpretation:* C2: tín hiệu “sẽ đến” (parking, request) + hotspot OTA/PRT + H1 lead time.  
- *Implication:* Flag ưu tiên xác nhận: không parking + Online TA + lead dài + request thấp. SHAP ≠ nhân quả.  
- *Next:* A/B follow-up trước khi đổi chính sách cọc.

**Finding 1–2 câu:** LightGBM v2.2 @ 0,25 là ship candidate cho scoring giảm-FP (Rec ≥ 0,85, AUC +0,024, FP −11% vs v2.1@0,51); FE mới giải thích ΔAUC, calibrate giải thích t\*; giữ v2.1@0,28 cho inventory.

---

## Ablation plan (reviewer)

Đã chạy A/B/C trong R003 và luật A/B/C trong FP reduction. Bảng dưới = **câu hỏi reviewer** + expected + kết quả (nếu có) hoặc việc **cố ý không chạy**.

### Component (ưu tiên cao)

| # | Name | What it tests | Expected if matters | Priority | Kết quả |
|---|------|---------------|---------------------|----------|---------|
| 1 | **A — gỡ FE v2.2**, giữ cal + t\* | ΔAUC có phải từ FE mới? | AUC tụt về ~0,87, FP tăng | 1 | **Đúng:** AUC 0,871, FP 3.943 |
| 2 | **B — gỡ isotonic**, giữ FE v2.2 | Calibrate có phải nguồn ranking? | AUC tụt nếu cal mang AUC; t\* lệch nếu chỉ đổi thang | 1 | **Thang đổi, AUC không:** 0,896, t\* 0,52 |
| 3 | **C — full** (FE + cal + t\* val) | Method đầy đủ | Rec ≥ 0,85, FP ≤ A và ≤ v2.1@0,51 | 1 | **Đúng:** Rec 0,861, FP 2.939 |
| 4 | Gỡ `required_car_parking_spaces` | Lever SHAP #1 có fragile không? | Rec/AUC giảm, nhất là segment có chỗ đậu | 2 | Chưa chạy — nice nếu lo drift |
| 5 | Gỡ `assigned_room_type` (đã cấm) | Leakage check | AUC ảo tăng nếu nhầm đưa vào | 1 | Không đưa vào X — no-op, không ablation |

### Design choice

| # | Name | What it tests | Priority | Kết quả |
|---|------|---------------|----------|---------|
| 6 | Global vs dual-score vs segment t\* | Có cần hai model / hai ngưỡng? | 1 | Global thắng |
| 7 | LGBM vs RF (cùng FE v1.2) | Đổi thuật toán có earn không? | 2 | LGBM AUC 0,87 vs RF ~0,84 — giữ LGBM |
| 8 | t\* trên val vs quét test | Có peek test không? | 1 | Protocol: **chỉ val**; test một lần |

### Hyperparameter (thấp hơn gỡ module)

| # | Parameter | Values | What it tests | Priority |
|---|-----------|--------|---------------|----------|
| 9 | Optuna lại trên FE v2.2 | 100 trial vs warm-start v2.1 | Dư địa tune sau FE mới | 3 — nháp, **chưa promote** |
| 10 | `scale_pos_weight` | 1,0 vs ×1,5 | Có cần nhân Recall không khi đã cal? | 4 |
| 11 | Ngưỡng Rec min | 0,80 / 0,85 / 0,90 | Sensitivity ràng buộc nghiệp vụ | 4 |

### Coverage — reviewer hỏi gì?

- “Chỉ tune ngưỡng?” → A + so v2.1@0,51 (cùng Rec floor, AUC không đổi nếu chỉ t\*).  
- “Calibrate có phải cheating ranking?” → B.  
- “Dual-score có phải smarter?” → luật B/C.  
- “Có leakage?” → cột cấm + `assigned_room_type` không trong X.  
- “Một model cho mọi mục tiêu?” → không; xem finding 4.

### Unnecessary (không chạy)

- Sweep sâu RF sau khi LGBM đã thắng AUC — không đổi ship.  
- Ensemble stacking v2+v2.1 sau khi dual AND đã thua.  
- Ablation từng one-hot `country_*` — SHAP đủ cho C2.  
- Nhiều seed (DEFAULT_SEEDS = 3): split stratified cố định seed 42; bootstrap ΔAUC đã bắt variance test. GPU-hours = 0.

### Thứ tự thông tin (đã theo)

M0 baseline → M1 full → M2 A rồi B (A rẻ hơn, trả lời “chỉ cal?”) → M3 stats. Gỡ parking (#4) chỉ khi monitor live thấy drift.

---

## Feature (4 nhóm) — phục vụ C2

| Nhóm | Ý | Ví dụ |
|------|---|--------|
| 1. Cam kết tài chính | Ai “dính” tiền/giá thì hủy khác | `deposit_type`, `price_per_person`, `is_no_deposit` |
| 2. Cấu trúc chuyến | Lead dài, đông người | `total_nights`, `lead_time_per_night`, `is_family` |
| 3. Uy tín | Lịch sử hủy / quay lại | `history_cancel_rate`, `is_repeated_guest` |
| 4. Lịch & kênh | Mùa, OTA | `arrival_season`, `is_online_ta`, `is_weekend_only` |

v2.2 thêm (booking-time): `meal`, `reserved_room_type`, `booking_changes`, `log_lead_time`, `special_requests_per_night`, `required_car_parking_spaces`, `has_agent`, …

```
history_cancel_rate = previous_cancellations
                    / (previous_cancellations + previous_bookings_not_canceled)
                    (0 nếu chưa có lịch sử)
```

Pipeline: `ColumnTransformer` One-Hot (`infrequent_if_exist`, `min_frequency=5`) + passthrough số → `LGBMClassifier`.

---

## Catalog

### v1 — `Cancellation Predict Model v1/`

| File | Block |
|------|--------|
| `06_cancellation_model_v1.ipynb` | B1 RF, 6 cat, t = 0,50 |
| `07_cancellation_model_v1_1.ipynb` | B1 + 3 số, t = 0,35 |
| `08_cancellation_model_v1_2.ipynb` | B1 FE 4 nhóm + SHAP |

### v2 — `Cancellation Predict Model v2/`

| File | Block |
|------|--------|
| `09_cancellation_model_v2.ipynb` | B1 LGBM = FE v1.2 |
| `09_cancellation_model_v2_1.ipynb` | Recall-first, Optuna |
| `09_fp_reduction_threshold_dual_score.ipynb` · `_run_10_fp_reduction.py` | B4 |
| `_run_v2_2.py` | R001–R004 |
| `09_cancellation_model_v2_2.ipynb` | Đọc artifact, quyết định ship |
| `09_draft_v2_1_params_on_v2_2.ipynb` | M4 nháp Optuna |
| `_run_11_probability_reports.py` | `reports/11*` |

### Artifact (`v2/artifacts/`)

| File | Dùng cho |
|------|----------|
| `best_params_v2_1.json` / `best_params_v2_2.json` | Inference |
| `fp_reduction_policy_v2_1.json` | t = 0,51 |
| `threshold_policy_v2_2.json` | Policy ship |
| `v2_2_comparison.csv` / `v2_2_ablation.csv` | Bảng trên |
| `v2_2_stats.json` | McNemar / ΔAUC / FPR |
| `v2_2_feature_importance_top20.csv` · `v2_2_shap_top20.json` | C2 |
| `fp_reduction_comparison.csv` | Luật A/B/C |

Hình: `reports/figures/09*`.

---
