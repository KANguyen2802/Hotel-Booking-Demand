# Báo cáo lựa chọn phiên bản mô hình dự đoán hủy phòng

> **Mục tiêu:** Chọn phiên bản **tốt nhất theo từng mục tiêu kinh doanh**, không chỉ theo một chỉ số duy nhất.  
> **Phạm vi so sánh:** RF **v1.1**, RF **v1.2**, LightGBM **v2**, LightGBM **v2.1**, LightGBM **v2.2**.  
> **Dữ liệu chung:** `hotel_bookings_v5.csv` · 82.811 booking · tỷ lệ hủy **28,12%** · test ~16.563 booking (split 80/20, `random_state=42` với các bản LightGBM).  
> **Cập nhật:** 19/07/2026 — thêm **v2.2** (FE + calibration + ngưỡng tối ưu).

---

## 1. Tóm tắt quyết định

| Mục tiêu kinh doanh | Phiên bản khuyến nghị | Lý do ngắn |
|---------------------|----------------------|------------|
| **Xếp hạng rủi ro / scoring cân bằng** (AUC + Precision) | **LightGBM v2.2** @ 0,25 | AUC **0,896** · Precision **0,577** · FP thấp hơn v2 và v2.1@0,51 |
| **Không bỏ sót hủy** (inventory protection / overbooking) | **LightGBM v2.1** @ 0,28 | Recall **0,952** · FN thấp nhất chuỗi (~225) |
| **Giảm false alarm (FP), Recall ≥ 0,85** | **LightGBM v2.2** @ 0,25 | FP **2.939** (−11% vs v2.1@0,51; −51% vs @0,28) · Recall **0,861** |
| **Baseline RF dễ diễn giải (Gini)** | RF v1.2 | AUC 0,840 · Recall 0,94 @ 0,35 · SHAP đầy đủ |
| **Không khuyến nghị làm production chính** | RF v1.1 · v2.1@0,51 (đã bị v2.2 vượt trên chế độ giảm FP) | — |

**Nguyên tắc:** không có một “bản tốt nhất tuyệt đối”. Chọn theo **chi phí FP vs FN** của nghiệp vụ.  
**Ngoại lệ mới:** khi cần vừa **Recall ≥ 0,85** vừa **ít FP**, ưu tiên **v2.2** thay cho policy ngưỡng-only v2.1@0,51.

---

## 2. Bảng so sánh tổng hợp

Metrics tại **ngưỡng mặc định** của từng phiên bản (cấu hình production / báo cáo chính thức).

| Phiên bản | Thuật toán | Ngưỡng | ROC-AUC | Recall Hủy | Precision Hủy | F1 Hủy | Accuracy | FN | FP |
|-----------|------------|-------:|--------:|-----------:|--------------:|-------:|---------:|---:|---:|
| RF v1.1 | RandomForest | 0,35 | 0,831 | 0,94 | 0,41 | ~0,57 | ~0,60 | thấp | cao |
| RF v1.2 | RandomForest | 0,35 | 0,840 | **0,94** | 0,42 | 0,58 | 0,62 | **289** | 6.013 |
| LightGBM v2 | LightGBM | 0,35 | 0,871 | 0,90 | 0,49 | 0,64 | 0,71 | 469 | 4.329 |
| LightGBM v2.1 | LightGBM | **0,28** | 0,872 | **0,95** | 0,43 | 0,59 | 0,63 | **~225** | ~5.980 |
| v2.1 (giảm FP) | LightGBM | 0,51 | 0,872 | 0,853 | 0,545 | 0,665 | 0,759 | 684 | 3.312 |
| **LightGBM v2.2** | LightGBM + cal. | **0,25** | **0,896** | 0,861 | **0,577** | **~0,69** | **~0,78** | 649 | **2.939** |

### Đọc nhanh theo trục

| Trục | Thắng | Ghi chú |
|------|-------|---------|
| **ROC-AUC** | **v2.2 (0,896)** | Vượt v2/v2.1 (~0,87) rõ |
| **Recall Hủy** | **v2.1 @ 0,28** | Ưu tiên inventory |
| **Precision Hủy / FP thấp (Rec ≥ 0,85)** | **v2.2** | Thay thế v2.1@0,51 |
| **F1 / Accuracy @ chế độ giảm FP** | **v2.2** | Cân bằng tốt hơn policy cũ |
| **FN thấp nhất** | **v2.1 @ 0,28** | ~225 vs v2.2 649 vs v2 469 |

---

## 3. So sánh cặp quan trọng

### 3.1 LightGBM v2 vs v2.1 (cùng họ thuật toán)

| Chỉ số | v2 @ 0,35 | v2.1 @ 0,28 | Δ |
|--------|----------:|------------:|---|
| ROC-AUC | 0,871 | 0,872 | +0,001 |
| Recall Hủy | 0,899 | **0,952** | +0,053 |
| Precision Hủy | **0,492** | 0,426 | −0,066 |
| F1 Hủy | **0,636** | 0,588 | −0,048 |
| Accuracy | **0,710** | 0,626 | −0,084 |
| FN | 469 | **~225** | −52% |
| FP | **4.329** | ~5.980 | +38% |

**Cùng ngưỡng 0,35 (công bằng hơn):**

| Metric | v2 | v2.1 |
|--------|---:|-----:|
| Recall | 0,899 | **0,927** |
| F1 | **0,636** | 0,612 |

→ `scale_pos_weight` đã đẩy Recall lên ~2,8 điểm; phần còn lại đến từ hạ ngưỡng 0,28.

**Khác biệt thiết kế v2.1:** `scale_pos_weight` × 1,5 · ngưỡng 0,28 · thêm `arrival_season` · lưu `best_params` (draft/promote).

### 3.2 LightGBM v2.1 @ 0,51 vs **v2.2** (cùng ràng buộc Recall ≥ 0,85)

| Chỉ số | v2.1 @ 0,51 | **v2.2 @ 0,25** | Δ |
|--------|------------:|----------------:|---|
| ROC-AUC | 0,872 | **0,896** | **+0,024** |
| Recall Hủy | 0,853 | **0,861** | +0,008 |
| Precision Hủy | 0,545 | **0,577** | +0,032 |
| FP | 3.312 | **2.939** | **−373 (−11%)** |
| FN | 684 | **649** | −35 |
| CV ROC-AUC (train) | 0,866 | **0,890** | +0,024 |

**Thống kê (test):** McNemar p ≈ 7,8×10⁻²⁵ · bootstrap ΔAUC 95% CI [0,021 · 0,026] — ủng hộ v2.2.  
**Thiết kế v2.2:** FE booking-time bổ sung (`meal`, `reserved_room_type`, `booking_changes`, `required_car_parking_spaces`, …) · isotonic calibration · ngưỡng chọn trên 15% train-val · warm-start params v2.1.

### 3.3 LightGBM v2 vs RF v1.2

| Chỉ số @ 0,35 | RF v1.2 | LightGBM v2 |
|---------------|--------:|------------:|
| ROC-AUC | 0,840 | **0,871** |
| Precision Hủy | 0,42 | **0,49** |
| Recall Hủy | **0,94** | 0,90 |
| FP | 6.013 | **4.329** |
| FN | **289** | 469 |

v2 **calibrated tốt hơn** (ít FP), đổi lại bỏ sót nhiều hủy hơn RF. Đây là lý do sinh ra v2.1; v2.2 tiếp tục nhánh giảm FP có kiểm chứng.

### 3.4 RF v1.2 vs v1.1

v1.2 thắng v1.1 trên AUC (+0,009) với cùng ngưỡng 0,35 và Recall ~0,94, nhờ feature engineering 4 nhóm + SHAP. **v1.2 là bản RF tốt nhất** trong chuỗi.

---

## 4. Ma trận lựa chọn theo kịch bản

### Kịch bản A — Pilot scoring / cảnh báo RM cân bằng

- **Chọn: LightGBM v2.2 @ 0,25** (hoặc v2 @ 0,35 nếu cần giữ pipeline cũ)
- Ưu tiên: AUC + Precision + FP thấp, vẫn Recall ≥ 0,85
- Tránh: v2.1 @ 0,28 (quá nhiều FP)

### Kịch bản B — Bảo vệ inventory / giảm overbooking do hủy muộn

- **Chọn: LightGBM v2.1 @ 0,28**
- Ưu tiên: Recall tối đa, FN thấp nhất
- Chấp nhận: ~6.000 FP trên test (~36% booking không hủy bị flag)
- Artifact: `artifacts/best_params_v2_1.json` · `RUN_TUNING=False` khi inference

### Kịch bản C — Giải thích nghiệp vụ bằng RF / Gini quen thuộc

- **Chọn: RF v1.2 @ 0,35**
- Ưu tiên: pipeline RF ổn định, SHAP đã có, Recall cao
- Nhược: AUC và Precision kém LightGBM

### Kịch bản D — Quét ngưỡng linh hoạt trên cùng model mạnh

- Train **v2.1** (AUC cao + nghiêng class Hủy), rồi:
  - ngưỡng **0,28** → max Recall
  - ngưỡng **0,35** → gần v2 về Recall nhưng vẫn cao hơn (0,927)
  - ngưỡng **0,50** → F1 tốt hơn (0,661)
- Hoặc dùng **v2.2** đã calibrate và quét lại ngưỡng trên train-val nếu đổi chi phí FP/FN

### Kịch bản E — Giảm false alarm (FP), giữ Recall ≥ 0,85

- **Chọn: LightGBM v2.2 @ 0,25** (thay cho v2.1 @ 0,51)
- Ưu tiên: FP **2.939** (thấp nhất trong các chế độ Rec ≥ 0,85) · Precision **0,577** · AUC **0,896**
- Artifact: `artifacts/best_params_v2_2.json` · `artifacts/threshold_policy_v2_2.json`
- Báo cáo: [`09_cancellation_model_v2_2.md`](09_cancellation_model_v2_2.md)
- Policy cũ v2.1@0,51 vẫn dùng được nếu chưa deploy FE v2.2 — nhưng **không còn là winner** trên test
- **Không** thay kịch bản B: khi cần inventory protection vẫn dùng v2.1 @ **0,28**

---

## 5. Khuyến nghị triển khai

| Ưu tiên | Hành động | Phiên bản |
|--------|-----------|-----------|
| 1 | Production scoring / giảm FP (Recall ≥ 0,85) | **v2.2 @ 0,25** |
| 2 | Mode “bảo vệ phòng trống” / hold chặt | **v2.1 @ 0,28** |
| 3 | Fallback pipeline cũ (không FE v2.2) | **v2 @ 0,35** hoặc **v2.1 @ 0,51** |
| 4 | Báo cáo / giải thích cho stakeholder quen RF | **v1.2** (tham chiếu) |
| 5 | Không dùng v1 / v1.1 làm production chính | — |

**Quy tắc vận hành đề xuất:**

1. Lưu song song: **v2.2 (giảm FP / scoring)** · **v2.1 @ 0,28 (Recall max)** · (tuỳ chọn) **v2 @ 0,35**.
2. Đo chi phí thực tế của FP (giảm trải nghiệm khách / yêu cầu cọc thừa) vs FN (phòng trống / mất doanh thu).
3. Chỉ promote params mới khi CV ROC-AUC (hoặc metric nghiệp vụ đã chốt) **tốt hơn** artifact hiện tại — cơ chế draft đã có ở v2.1; v2.2 đã vượt CV 0,866 → 0,890.
4. Ngưỡng v2.2 chọn trên **train-val**, không quét lại trên test khi deploy.

---

## 6. Tài liệu nguồn

| Phiên bản | Báo cáo | Notebook / artifact |
|-----------|---------|---------------------|
| v1 | [06_cancellation_model_v1.md](06_cancellation_model_v1.md) | `06_cancellation_model_v1.ipynb` |
| v1.1 | [07_cancellation_model_v1_1.md](07_cancellation_model_v1_1.md) | `07_cancellation_model_v1_1.ipynb` |
| v1.2 | [08_cancellation_model_v1_2.md](08_cancellation_model_v1_2.md) | `08_cancellation_model_v1_2.ipynb` |
| v2 | [09_cancellation_model_v2.md](09_cancellation_model_v2.md) | `09_cancellation_model_v2.ipynb` |
| v2.1 | [09_cancellation_model_v2_1.md](09_cancellation_model_v2_1.md) | `09_cancellation_model_v2_1.ipynb` + `best_params_v2_1.json` |
| FP reduction (E cũ) | [09_fp_reduction_v2_1.md](09_fp_reduction_v2_1.md) | `09_fp_reduction_threshold_dual_score.ipynb` + `fp_reduction_policy_v2_1.json` |
| **v2.2** | [09_cancellation_model_v2_2.md](09_cancellation_model_v2_2.md) | `09_cancellation_model_v2_2.ipynb` + `best_params_v2_2.json` + `threshold_policy_v2_2.json` |
