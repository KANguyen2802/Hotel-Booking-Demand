# Mô hình dự đoán `is_canceled` — LightGBM v2.2

> **Mục tiêu:** giảm False Positive so với v2.1, **giữ Recall Hủy ≥ 0,85**, đồng thời nâng ROC-AUC.  
> **Thesis:** FE booking-time bổ sung + LightGBM (warm-start params v2.1) + **isotonic calibration** + ngưỡng tối ưu trên train-val.  
> **Dữ liệu:** `hotel_bookings_v5.csv` · 82.811 booking · tỷ lệ hủy 28,12% · test ~16.563 (split 80/20, `random_state=42`).  
> **Ngưỡng production:** `P(hủy) ≥ 0,25` → dự đoán **Hủy** (`threshold_policy_v2_2.json`).  
> **Hình:** `./figures/09_v2_2/chart_01.png` … `chart_10.png`  
> **Cập nhật:** 19/07/2026

---

## 1. So sánh chính (test)

| System | t | ROC-AUC | Recall | Precision | FP | FN |
|--------|--:|--------:|-------:|----------:|---:|---:|
| v2 @ 0,35 | 0,35 | 0,871 | 0,899 | 0,492 | 4.330 | 469 |
| v2.1 @ 0,28 | 0,28 | 0,872 | **0,952** | 0,426 | 5.976 | **225** |
| v2.1 @ 0,51 | 0,51 | 0,872 | 0,853 | 0,545 | 3.312 | 684 |
| **v2.2 calibrated** | **0,25** | **0,896** | **0,861** | **0,577** | **2.939** | 649 |

ΔFP vs v2.1@0,28: **−3.037 (−50,8%)**  
ΔFP vs v2.1@0,51: **−373 (−11,3%)**  
ΔAUC vs v2.1: **+0,024** (CV train: 0,866 → 0,890)

![So sánh FP / Recall / Precision](./figures/09_v2_2/chart_06.png)

**Nhận xét:** Ba cột metric cho thấy trade-off rõ giữa các mode. v2.1@0,28 thắng Recall nhưng FP cao nhất; v2.1@0,51 đã giảm FP nhưng vẫn thua **v2.2** trên cả FP, Precision và AUC. Đường đỏ Recall = 0,85 xác nhận v2.2 vẫn nằm trên ràng buộc nghiệp vụ đã chốt ở báo cáo FP reduction.

---

## 2. Confusion Matrix & ROC

AUC v2.2 = **0,896**. Ma trận @ ngưỡng 0,25: TP = **4.008** · FP = **2.939** · FN = **649** · TN = **8.967**.

![Confusion Matrix & ROC Curve — LightGBM v2.2](./figures/09_v2_2/chart_01.png)

**Nhận xét:**
- **Confusion:** TN chiếm khối lớn nhất — mô hình không “flag hết” như v2.1@0,28. FN = 649 cao hơn mode inventory (225) nhưng thấp hơn v2.1@0,51 (684).
- **ROC:** đường v2.2 (AUC ≈ 0,90) tách rõ khỏi v2 / v2.1 (≈ 0,87) trên gần như toàn bộ FPR — cải thiện **ranking** chứ không chỉ đổi ngưỡng.

![Confusion matrix v2.1@0.51 vs v2.2](./figures/09_v2_2/chart_07.png)

**Nhận xét:** So cạnh nhau với baseline giảm-FP cũ (v2.1@0,51), v2.2 giảm đồng thời FP (−373) và FN (−35). Đây là win–win hiếm trên cùng ràng buộc Recall ≥ 0,85 — khác với dual-score / segment threshold (đã thử ở notebook FP reduction và không thắng).

---

## 3. Phân phối P(hủy) trên test

| Nhãn thực tế | n | Mean P(hủy) | Median P(hủy) | Std |
|--------------|--:|------------:|--------------:|----:|
| Không hủy | 11.906 | 0,161 | **0,084** | 0,198 |
| Hủy | 4.657 | **0,581** | **0,614** | 0,259 |

![Phân phối xác suất dự đoán P(hủy)](./figures/09_v2_2/chart_02.png)

**Nhận xét:** Sau **isotonic calibration**, phân phối class Không hủy dồn về xác suất thấp (median 0,084) — khác v2.1 raw (median ~0,28) vốn bị `scale_pos_weight` đẩy lên. Ngưỡng 0,25 nằm giữa hai đỉnh → cắt được nhiều FP mà vẫn giữ Recall ≥ 0,85. Khoảng trống giữa hai mật độ rộng hơn v2.1 → phù hợp scoring vận hành.

---

## 4. Calibration & đường FP–Recall

![Calibration curve](./figures/09_v2_2/chart_08.png)

**Nhận xét:** Đường v2.2 (calibrated) bám gần đường chéo hơn v2.1 raw — P(hủy) có thể đọc gần như tần suất thực tế. Đây là lý do ngưỡng tối ưu trên train-val chuyển được sang test mà không “vỡ” ràng buộc Recall.

![FP–Recall theo ngưỡng v2.2](./figures/09_v2_2/chart_09.png)

**Nhận xét:**
- Trái: FP giảm khi tăng t; điểm đỏ `t* = 0,25` là winner trên train-val (min FP ‖ Rec ≥ 0,85), nằm dưới đường FP của v2.1@0,51.
- Phải: đường FP–Recall cho thấy vùng khả thi bên phải đường Recall = 0,85; điểm chọn nằm gần “góc” tốt (FP thấp, Rec đủ).

---

## 5. Feature importance (gain)

> **Cách đọc:** Gain = chất lượng split LightGBM. Sau One-Hot + FE v2.2 số cột tăng so v2.1. TB hủy toàn cục ~28,1%.

![Feature Importance (gain) — Top 20](./figures/09_v2_2/chart_03.png)

| Hạng | Feature | Gain (xấp xỉ) | Biến gốc / nhóm | Hướng điển hình | Đánh giá |
|:---:|---------|-------------:|-----------------|-----------------|----------|
| 1 | `required_car_parking_spaces` | ~87.9k | Cam kết chỗ đậu (mới v2.2) | Có parking → thường ↓ hủy | Lever mới mạnh nhất |
| 2 | `lead_time` | ~87.5k | Thời gian | Dài ↑ | Driver ổn định từ v1.1 |
| 3 | `market_segment_Online TA` | ~53.1k | Segment | = Online TA ↑ | Hotspot OTA |
| 4 | `price_per_person` | ~51.3k | Financial Commitment | Thấp ↑ · Cao ↓ (SHAP) | Engineered trụ cột |
| 5 | `special_requests_per_night` | ~45.9k | Cam kết / request (mới) | Nhiều request ↓ | Chuẩn hóa theo đêm |
| 6 | `lead_time_per_night` | ~45.8k | Trip Structure | Thấp ↑ · Cao ↓ | Giữ từ v1.2 |
| 7 | `country_PRT` | ~35.8k | Quốc gia | = PRT ↑ | Thị trường nội địa |
| 8 | `log_lead_time` | ~30.8k | Thời gian (mới) | Cao ↑ | Biến đổi lead_time |
| 9 | `market_segment_Offline TA/TO` | ~25.1k | Segment | Offline ↓ | Đối trọng Online |
| 10 | `is_online_ta` | ~24.0k | Segment flag (mới) | = 1 ↑ | Echo Online TA |

**Nhận xét:** Top gain vẫn giữ các driver EDA/hypothesis (`lead_time`, Online TA, PRT, `price_per_person`) nhưng **v2.2 đẩy `required_car_parking_spaces` và `special_requests_per_night` lên hạng cao** — đây là phần lớn gain so ablation chỉ calibrate v2.1 (xem mục 8).

---

## 6. SHAP

### 6.1 Phương pháp

| Thành phần | Cài đặt |
|------------|---------|
| Thư viện | `shap` — `TreeExplainer` |
| Mô hình giải thích | `LGBMClassifier` (uncalibrated, cùng FE/params) sau `ColumnTransformer` |
| Dữ liệu | Mẫu **2.000** booking từ test (`random_state=42`) |
| Class giải thích | **Hủy** (class 1) |

### 6.2 Mean |SHAP| — Top 15 toàn cục

![SHAP — mean |SHAP| Top 15](./figures/09_v2_2/chart_04.png)

| Hạng | Feature | Mean \|SHAP\| | Giá trị ảnh hưởng | Hướng | Diễn giải |
|:---:|---------|-------------:|-------------------|-------|-----------|
| 1 | `required_car_parking_spaces` | **0,915** | > 0 vs = 0 | Có parking ↓↓ | Tín hiệu “sẽ đến” rất mạnh |
| 2 | `country_PRT` | 0,694 | = PRT | ↑ | Khớp EDA hủy PRT cao |
| 3 | `market_segment_Online TA` | 0,433 | = Online TA | ↑ | Hotspot volume |
| 4 | `lead_time` | 0,354 | Cao vs thấp | Cao ↑ | H1 / H1b |
| 5 | `price_per_person` | 0,332 | Cao vs thấp | Cao ↓ · Thấp ↑ | Financial Commitment |
| 6 | `special_requests_per_night` | 0,319 | Cao vs thấp | Cao ↓ | Cam kết chi tiết |
| 7 | `market_segment_Offline TA/TO` | 0,304 | = Offline | ↓ | An toàn hơn Online |
| 8 | `booking_changes` | 0,201 | > 0 | Thường ↓ / phức tạp | FE mới — cần theo dõi |
| 9 | `customer_type_Transient` | 0,197 | = Transient | ↑ | Khách lẻ rủi ro hơn |
| 10 | `is_online_ta` | 0,158 | = 1 | ↑ | Flag song song segment |

**Nhận xét:** Ranking SHAP gần với gain ở các tín hiệu mới (parking, special_requests_per_night). Gain đo split quality, SHAP đo đóng góp trung bình có hướng trên mẫu — cả hai đều đưa parking lên #1.

### 6.3 Beeswarm toàn cục

![SHAP Beeswarm — Top 20](./figures/09_v2_2/chart_05.png)

**Nhận xét:** Mỗi chấm = một booking trong mẫu 2.000. `required_car_parking_spaces` cao (đỏ) tập trung SHAP âm mạnh (kéo giảm P(hủy)); `country_PRT` / Online TA / `lead_time` cao đẩy SHAP dương. Beeswarm xác nhận hướng đọc bảng 6.2 và khớp hotspot BRD (Online TA + lead dài).

### 6.4 Waterfall — 2 ví dụ local

![SHAP Waterfall — P(hủy) cao / thấp](./figures/09_v2_2/chart_10.png)

**Nhận xét:**
- **P(hủy) cao:** tổ hợp PRT / Online TA / lead dài / giá/người thấp (hoặc thiếu tín hiệu an toàn) đẩy xác suất lên.
- **P(hủy) thấp:** parking, nhiều special requests, Offline/Direct, lead ngắn kéo xác suất xuống.  
Dùng waterfall khi RM cần giải thích **từng booking** trước khi hold / yêu cầu cọc.

---

## 7. CV (train) & chống overfit test

| Model | CV ROC-AUC (3-fold, train) |
|-------|---------------------------:|
| v2.1 | 0,866 |
| **v2.2** | **0,890** |

Gain AUC không chỉ xuất hiện trên test: CV train cũng tăng **+0,024**, giảm nghi ngờ “chỉ overfit test khi quét ngưỡng”.

---

## 8. Ablation (cô lập đóng góp)

| Variant | t | ROC-AUC | Recall | FP | FN | Ý nghĩa |
|---------|--:|--------:|-------:|---:|---:|---------|
| A — v2.1 + cal + thr | 0,20 | 0,871 | 0,881 | 3.943 | 553 | Chỉ calibrate/ngưỡng, **không** FE mới → FP vẫn cao |
| B — v2.2 FE, no cal | 0,52 | **0,896** | 0,865 | 2.963 | 631 | FE mới mang phần lớn AUC/FP |
| **C — full v2.2** | **0,25** | 0,896 | 0,861 | **2.939** | 649 | Calibration tinh chỉnh ngưỡng / FP thêm một nhịp |

**Kết luận ablation:** Novelty chính là **FE v2.2**; calibration không tạo AUC mới nhưng giúp chọn ngưỡng ổn định hơn trên thang xác suất đã chuẩn hóa.

---

## 9. Thống kê (v2.2 vs v2.1 @ 0,51)

| Kiểm định | Kết quả | Đọc |
|-----------|---------|-----|
| McNemar (nhãn dự đoán) | p ≈ 7,8×10⁻²⁵ · n01=995 · n10=587 | v2.2 sửa đúng nhiều case hơn baseline |
| Bootstrap ΔAUC (v2.2 − v2.1) | mean **+0,024** · 95% CI **[0,021 · 0,026]** | CI không chứa 0 → cải thiện ranking thực |
| Two-proportion FPR | p ≈ 3,9×10⁻⁸ | Tỷ lệ FP trên class Không hủy giảm có ý nghĩa |

**Quyết định (ab-test style):** **SHIP_CANDIDATE** — primary (FP ↓, Rec ≥ 0,85) đạt; guardrail CV AUC không giảm; kiểm định ủng hộ.

---

## 10. Kết luận

### Điểm mạnh v2.2

1. **ROC-AUC 0,896** — tốt nhất chuỗi LightGBM (v2/v2.1 ~0,87); CV train xác nhận (+0,024).
2. **FP 2.939 @ Recall 0,861** — thắng v2.1@0,51 (−11% FP) và vượt xa v2.1@0,28 về false alarm (−51% FP).
3. **Precision 0,577** — cao nhất trong các mode Rec ≥ 0,85 đã so.
4. **Calibration** làm P(hủy) dễ vận hành (ngưỡng/train-val chuyển được sang test).
5. **FE mới có giá trị** (ablation B ≈ full về AUC); SHAP/gain nổi `required_car_parking_spaces`, `special_requests_per_night`.
6. Bộ chart đầy đủ (CM/ROC, phân phối, calibration, FP–Recall, gain, SHAP) hỗ trợ stakeholder như v2.1.

### Hạn chế & rủi ro

1. **Không thay mode inventory:** FN = 649 > v2.1@0,28 (225) — khi cần không bỏ sót hủy vẫn dùng v2.1@0,28.
2. **`required_car_parking_spaces` rất mạnh** — hữu ích nhưng cần giám sát ổn định theo khách sạn / chính sách chỗ đậu (có thể drift).
3. Ngưỡng 0,25 chọn trên train-val; **không** quét lại trên test khi deploy.
4. SHAP / gain **không phải nhân quả** — cần A/B trước khi đổi chính sách cọc / follow-up.
5. Warm-start params v2.1 — chưa Optuna lại trên FE mới; còn dư địa tune nếu cần.

---

## 11. Khuyến nghị

| Ưu tiên | Hành động | Ghi chú |
|--------|-----------|---------|
| **1** | Triển khai **v2.2 @ 0,25** cho scoring / cảnh báo RM khi cần **giảm FP** (Rec ≥ 0,85) | Thay policy v2.1@0,51 |
| **2** | Giữ **v2.1 @ 0,28** song song cho inventory protection / overbooking | FN thấp nhất |
| **3** | Inference: nạp `best_params_v2_2.json` + `threshold_policy_v2_2.json`; tắt retrain/tuning mặc định | Artifact đã promote |
| **4** | Rule vận hành: **không có parking** + **Online TA** + **lead dài** + **special_requests thấp** → ưu tiên xác nhận / cọc | SHAP + gain |
| **5** | Rule: **`history_cancel_rate` > 0** + PRT/Online TA → flag rủi ro tái hủy | Giữ từ v2/v2.1 |
| **6** | Theo dõi drift feature parking / special_requests_per_night theo tháng | Gain #1 mới |
| **7** | (Tuỳ chọn) Optuna lại trên FE v2.2 nếu CV draft > 0,890 | Cơ chế draft/promote như v2.1 |

**Quy tắc chọn mode nhanh:**

```text
Cần Recall tối đa (hold phòng)     → v2.1 @ 0.28
Cần ít cảnh báo giả, Rec ≥ 0.85    → v2.2 @ 0.25
Fallback không có FE v2.2          → v2 @ 0.35  hoặc  v2.1 @ 0.51
```

---

## 12. Artifact & tài liệu liên quan

| Đường dẫn | Nội dung |
|-----------|----------|
| `models/.../09_cancellation_model_v2_2.ipynb` | Notebook chạy pipeline |
| `models/.../_run_v2_2.py` | Script thí nghiệm đầy đủ |
| `artifacts/best_params_v2_2.json` | Params + threshold |
| `artifacts/threshold_policy_v2_2.json` | Policy quyết định |
| `artifacts/v2_2_stats.json` | McNemar / bootstrap |
| `artifacts/v2_2_shap_top20.json` | Bảng SHAP top 20 |
| `reports/figures/09_v2_2/` | chart_01 … chart_10 |
| [09_cancellation_model_v2_1.md](09_cancellation_model_v2_1.md) | LightGBM v2.1 |
| [09_fp_reduction_v2_1.md](09_fp_reduction_v2_1.md) | Policy giảm FP cũ (@ 0,51) |
| [13_cancellation_model_version_selection.md](13_cancellation_model_version_selection.md) | Chọn phiên bản theo mục tiêu |
| [14_key_findings_after_prediction_models.md](14_key_findings_after_prediction_models.md) | Key findings tổng hợp |

---

*Báo cáo LightGBM v2.2 — FE + calibration + ngưỡng tối ưu. Cập nhật: 19/07/2026.*
