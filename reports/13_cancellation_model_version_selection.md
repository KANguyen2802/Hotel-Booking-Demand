# Báo cáo lựa chọn phiên bản mô hình dự đoán hủy phòng

> **Mục tiêu:** Chọn phiên bản **tốt nhất theo từng mục tiêu kinh doanh**, không chỉ theo một chỉ số duy nhất.  
> **Phạm vi so sánh:** các mốc chính đã có báo cáo — RF **v1.1**, RF **v1.2**, LightGBM **v2**, LightGBM **v2.1**.  
> **Dữ liệu chung:** `hotel_bookings_v5.csv` · 82.811 booking · tỷ lệ hủy **28,12%** · test ~16.563 booking (split 80/20, `random_state=42` với các bản LightGBM).

---

## 1. Tóm tắt quyết định

| Mục tiêu kinh doanh | Phiên bản khuyến nghị | Lý do ngắn |
|---------------------|----------------------|------------|
| **Xếp hạng rủi ro / scoring cân bằng** (AUC + Precision) | **LightGBM v2** | AUC 0,871 · Precision Hủy 0,49 · FP thấp hơn RF |
| **Không bỏ sót hủy** (inventory protection / overbooking) | **LightGBM v2.1** | Recall 0,952 @ 0,28 · FN thấp nhất chuỗi |
| **Giảm false alarm (FP), Recall ≥ 0,85** | **LightGBM v2.1 @ 0,51** | FP 3.312 (−45% so @ 0,28) · xem kịch bản E / báo cáo 09 FP reduction |
| **Baseline RF dễ diễn giải (Gini)** | RF v1.2 | AUC 0,840 · Recall 0,94 @ 0,35 · SHAP đầy đủ |
| **Không khuyến nghị làm production chính** | RF v1.1 | Bị v1.2 và LightGBM vượt về AUC |

**Nguyên tắc:** không có một “bản tốt nhất tuyệt đối”. Chọn theo **chi phí FP vs FN** của nghiệp vụ.

---

## 2. Bảng so sánh tổng hợp

Metrics tại **ngưỡng mặc định** của từng phiên bản (cấu hình production / báo cáo chính thức).

| Phiên bản | Thuật toán | Ngưỡng | ROC-AUC | Recall Hủy | Precision Hủy | F1 Hủy | Accuracy | FN (ước lượng) |
|-----------|------------|-------:|--------:|-----------:|--------------:|-------:|---------:|---------------:|
| RF v1.1 | RandomForest | 0,35 | 0,831 | 0,94 | 0,41 | ~0,57 | ~0,60 | thấp |
| RF v1.2 | RandomForest | 0,35 | 0,840 | **0,94** | 0,42 | 0,58 | 0,62 | **289** |
| **LightGBM v2** | LightGBM | 0,35 | **0,871** | 0,90 | **0,49** | **0,64** | **0,71** | 469 |
| **LightGBM v2.1** | LightGBM | **0,28** | **0,872** | **0,95** | 0,43 | 0,59 | 0,63 | **~225** |

### Đọc nhanh theo trục

| Trục | Thắng | Ghi chú |
|------|-------|---------|
| **ROC-AUC** | v2 ≈ v2.1 (0,871–0,872) | Vượt rõ RF (0,83–0,84) |
| **Recall Hủy** | **v2.1** | Vượt cả RF v1.2 |
| **Precision Hủy** | **v2** | Ít cảnh báo giả nhất |
| **F1 / Accuracy @ ngưỡng chính** | **v2** | Cân bằng tốt nhất ở 0,35 |
| **FN thấp nhất** | **v2.1** | ~225 vs v2 469 vs RF 289 |

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

### 3.2 LightGBM v2 vs RF v1.2

| Chỉ số @ 0,35 | RF v1.2 | LightGBM v2 |
|---------------|--------:|------------:|
| ROC-AUC | 0,840 | **0,871** |
| Precision Hủy | 0,42 | **0,49** |
| Recall Hủy | **0,94** | 0,90 |
| FP | 6.013 | **4.329** |
| FN | **289** | 469 |

v2 **calibrated tốt hơn** (ít FP), đổi lại bỏ sót nhiều hủy hơn RF. Đây là lý do sinh ra v2.1.

### 3.3 RF v1.2 vs v1.1

v1.2 thắng v1.1 trên AUC (+0,009) với cùng ngưỡng 0,35 và Recall ~0,94, nhờ feature engineering 4 nhóm + SHAP. **v1.2 là bản RF tốt nhất** trong chuỗi.

---

## 4. Ma trận lựa chọn theo kịch bản

### Kịch bản A — Pilot scoring / cảnh báo RM cân bằng

- **Chọn: LightGBM v2 @ 0,35**
- Ưu tiên: Precision cao, FP thấp, AUC mạnh
- Tránh: v2.1 (quá nhiều FP), v1.1 (AUC thấp)

### Kịch bản B — Bảo vệ inventory / giảm overbooking do hủy muộn

- **Chọn: LightGBM v2.1 @ 0,28**
- Ưu tiên: Recall tối đa, FN thấp nhất
- Chấp nhận: ~6.000 FP trên test (~36% booking không hủy bị flag)
- Artifact: `artifacts/best_params_v2_1.json` · `RUN_TUNING=False` khi inference

### Kịch bản C — Giải thích nghiệp vụ bằng RF / Gini quen thuộc

- **Chọn: RF v1.2 @ 0,35**
- Ưu tiên: pipeline RF ổn định, SHAP đã có, Recall cao
- Nhược: AUC và Precision kém LightGBM v2

### Kịch bản D — Quét ngưỡng linh hoạt trên cùng model mạnh

- Train **v2.1** (AUC cao + nghiêng class Hủy), rồi:
  - ngưỡng **0,28** → max Recall
  - ngưỡng **0,35** → gần v2 về Recall nhưng vẫn cao hơn (0,927)
  - ngưỡng **0,50** → F1 tốt hơn (0,661)

### Kịch bản E — Giảm false alarm (FP), giữ Recall ≥ 0,85

- **Chọn: LightGBM v2.1 @ ngưỡng 0,51** (policy `global_t=0.51`)
- Ưu tiên: giảm FP (~5.976 → **3.312**, −45%) trong khi Recall Hủy vẫn ≥ 0,85 (đạt **0,853**)
- Precision Hủy tăng 0,426 → **0,545**; trade-off FN tăng (225 → 684)
- Đã so sánh dual-score (v2 ∧ v2.1) và ngưỡng theo segment (Online TA vs khác) — **không thắng** global @ 0,51 trên test
- Artifact: `artifacts/fp_reduction_policy_v2_1.json`
- Báo cáo: [`09_fp_reduction_v2_1.md`](09_fp_reduction_v2_1.md)
- **Không** thay kịch bản B: khi cần inventory protection vẫn dùng v2.1 @ **0,28**

---

## 5. Khuyến nghị triển khai

| Ưu tiên | Hành động | Phiên bản |
|--------|-----------|-----------|
| 1 | Production scoring mặc định (cân bằng) | **v2** |
| 2 | Mode “bảo vệ phòng trống” / hold chặt | **v2.1 @ 0,28** |
| 3 | Mode giảm cảnh báo giả (Recall ≥ 0,85) | **v2.1 @ 0,51** (policy FP reduction) |
| 4 | Báo cáo / giải thích cho stakeholder quen RF | **v1.2** (tham chiếu) |
| 5 | Không dùng v1 / v1.1 làm production chính | — |

**Quy tắc vận hành đề xuất:**

1. Lưu song song các mode: **v2 (Precision)**, **v2.1 @ 0,28 (Recall max)**, **v2.1 @ 0,51 (giảm FP)**.
2. Đo chi phí thực tế của FP (giảm trải nghiệm khách / yêu cầu cọc thừa) vs FN (phòng trống / mất doanh thu).
3. Chỉ promote params mới khi CV ROC-AUC (hoặc metric nghiệp vụ đã chốt) **tốt hơn** artifact hiện tại — cơ chế draft đã có ở v2.1.
4. Policy giảm FP chỉ đổi ngưỡng quyết định — không thay `best_params_v2_1.json`.

---

## 6. Tài liệu nguồn

| Phiên bản | Báo cáo | Notebook / artifact |
|-----------|---------|---------------------|
| v1 | [06_cancellation_model_v1.md](06_cancellation_model_v1.md) | `06_cancellation_model_v1.ipynb` |
| v1.1 | [07_cancellation_model_v1_1.md](07_cancellation_model_v1_1.md) | `07_cancellation_model_v1_1.ipynb` |
| v1.2 | [08_cancellation_model_v1_2.md](08_cancellation_model_v1_2.md) | `08_cancellation_model_v1_2.ipynb` |
| v2 | [09_cancellation_model_v2.md](09_cancellation_model_v2.md) | `09_cancellation_model_v2.ipynb` |
| **v2.1** | [09_cancellation_model_v2_1.md](09_cancellation_model_v2_1.md) | `09_cancellation_model_v2_1.ipynb` + `best_params_v2_1.json` |
| **FP reduction (E)** | [09_fp_reduction_v2_1.md](09_fp_reduction_v2_1.md) | `09_fp_reduction_threshold_dual_score.ipynb` + `fp_reduction_policy_v2_1.json` |
