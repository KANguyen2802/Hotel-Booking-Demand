# Báo cáo mô hình dự đoán hủy phòng — LightGBM v2.1

> **Nguồn dữ liệu:** `hotel_bookings_v5.csv`  
> **Phạm vi:** 82.811 booking | Tỷ lệ hủy tổng thể: **28,12%** (~23.284 booking bị hủy)  
> **Notebook tham chiếu:** `models/Cancellation Predict Model v2/09_cancellation_model_v2_1.ipynb`  
> **Artifact production:** `models/Cancellation Predict Model v2/artifacts/best_params_v2_1.json`  
> **Thuật toán:** `LGBMClassifier` (LightGBM) + tinh chỉnh **GridSearchCV** & **Optuna** + giải thích **SHAP**  
> **Ngưỡng phân loại:** **0,28** (`P(hủy) >= 0,28` → dự đoán Hủy)

---

## 1. Mục tiêu & khác biệt so với LightGBM v2

v2.1 kế thừa pipeline LightGBM + feature engineering v1.2/v2, tập trung **tăng Recall class Hủy** theo khuyến nghị báo cáo v2 (hạ ngưỡng + tăng `scale_pos_weight`), đồng thời bổ sung tín hiệu mùa và lưu artifact an toàn.

| Tiêu chí | LightGBM v2 | **LightGBM v2.1** |
|----------|-------------|-------------------|
| Thuật toán | `LGBMClassifier` | **Giữ nguyên** |
| Số feature | 16 (6 cat + 10 num) | **17** (+ `arrival_season`) |
| Cân bằng lớp | `class_weight='balanced'` | **`scale_pos_weight` ≈ 3,835** (×1,5 so `n_neg/n_pos`) |
| Ngưỡng | 0,35 | **0,28** |
| Tuning | GridSearch + Optuna | **Giữ nguyên + draft/promote artifact** |
| ROC-AUC (test) | 0,871 | **0,872** |
| Recall — Hủy | 0,899 @ 0,35 | **0,952 @ 0,28** |
| Precision — Hủy | **0,492** @ 0,35 | 0,426 @ 0,28 |
| Accuracy | **0,710** @ 0,35 | 0,626 @ 0,28 |

**Cải thiện chính:** Recall Hủy tăng **+5,3 điểm phần trăm** so v2 @ ngưỡng mặc định; FN giảm khoảng một nửa (~225 vs 469). AUC gần như giữ nguyên. Trade-off: Precision và Accuracy giảm do nhiều False Positive hơn.

---

## 2. Thiết kế mô hình

### 2.1 Feature engineering

Giữ 4 nhóm engineered từ v1.2/v2, **bổ sung `arrival_season`**:

| Biến | Công thức / quy ước |
|------|---------------------|
| `arrival_month_mapped` | Tháng → số 1–12 (Jan→1 … Dec→12) |
| `arrival_season` | Winter (12–2), Spring (3–5), Summer (6–8), Autumn (9–11) |

Các biến còn lại giữ nguyên: `total_guests`, `price_per_person`, `is_family`, `total_nights`, `lead_time_per_night`, `history_cancel_rate`, `is_weekend_only` + 6 biến phân loại v1 + `lead_time`, `total_of_special_requests`.

### 2.2 Feature đưa vào mô hình (17 biến)

| Biến | Kiểu | Xử lý |
|------|------|--------|
| `deposit_type`, `market_segment`, `country`, `distribution_channel`, `customer_type`, `hotel`, **`arrival_season`** | Phân loại | One-Hot Encoding |
| `lead_time`, `total_of_special_requests` + 8 biến engineered số | Số | Passthrough |

Sau One-Hot (`min_frequency=5`): **143 cột** đầu vào LightGBM.

### 2.3 Cân bằng lớp & ngưỡng

```text
scale_pos_weight = (n_neg / n_pos)_train × 1.5 ≈ 3.8348
y_pred = 1  nếu  P(hủy) >= 0.28
```

`scale_pos_weight` chỉ tính từ `y_train` (không leakage). Ngưỡng 0,28 ưu tiên **không bỏ sót hủy** (inventory protection).

### 2.4 Hyperparameter (production — đã promote)

| Phương pháp | CV ROC-AUC |
|-------------|----------:|
| Baseline | 0,861 |
| GridSearchCV | 0,863 |
| **Optuna TPE (50 trials)** | **0,866** |

**Chọn:** Optuna — tốt hơn bản production trước (0,8660 > 0,8653) → promote vào `best_params_v2_1.json`.

| Tham số | Giá trị |
|---------|--------:|
| `n_estimators` | 350 |
| `max_depth` | 16 |
| `num_leaves` | 74 |
| `min_child_samples` | 50 |
| `learning_rate` | 0,0558 |
| `subsample` | 0,725 |
| `colsample_bytree` | 0,601 |
| `reg_alpha` | 0,0013 |
| `reg_lambda` | 0,0061 |
| `scale_pos_weight` | 3,835 |

### 2.5 Artifact an toàn (draft / promote)

1. Mỗi lần `RUN_TUNING=True`: ghi ứng viên vào `best_params_v2_1_draft.json`.
2. Chỉ ghi đè `best_params_v2_1.json` nếu **CV ROC-AUC cao hơn** production hiện có.
3. `RUN_TUNING=False`: nạp production, không tune lại.

### 2.6 Chống data leakage

1. Không nạp `reservation_status`, `revenue`, `Occupancy_Rate`, `RevPAR`, ...
2. Feature engineering chỉ dùng thông tin có tại thời điểm đặt phòng.
3. `train_test_split` trước encoder / tune.
4. `scale_pos_weight` và One-Hot chỉ học từ train.

---

## 3. Kết quả đánh giá (tập test — 16.563 booking)

### 3.1 Baseline vs Tuned @ ngưỡng 0,28

| Chỉ số | Baseline LGBM | **Tuned (Optuna promoted)** |
|--------|--------------:|----------------------------:|
| **ROC-AUC (test)** | 0,866 | **0,872** |
| **CV ROC-AUC (5-fold)** | — | **0,868 ± 0,004** |
| **Accuracy** | 0,592 | **0,626** |
| **Precision — Hủy** | 0,405 | **0,426** |
| **Recall — Hủy** | 0,962 | **0,952** |
| **F1 — Hủy** | 0,570 | **0,588** |

**Nhận xét:** Tuned cải thiện AUC, Precision, F1 và Accuracy so baseline; Recall giảm nhẹ so baseline (vẫn rất cao ~0,95).

### 3.2 So sánh ngưỡng (mô hình Tuned)

| Metric (class Hủy) | @ 0,50 | @ 0,35 | @ **0,28** |
|--------------------|-------:|-------:|-----------:|
| Recall | 0,858 | 0,927 | **0,952** |
| F1 | **0,661** | 0,612 | 0,588 |

**Kết luận ngưỡng:** 0,28 tối ưu Recall; 0,50 tối ưu F1; 0,35 là điểm giữa (so sánh công bằng với v2).

### 3.3 Classification report @ 0,28 (Tuned)

| Class | Precision | Recall | F1 | Support |
|-------|----------:|-------:|---:|--------:|
| Không hủy | 0,96 | 0,50 | 0,66 | 11.906 |
| Hủy | 0,43 | 0,95 | 0,59 | 4.657 |

Ước lượng ma trận: **FN ≈ 225**, **FP ≈ 5.980** (so v2 @ 0,35: FN 469, FP 4.329).

### 3.4 Phân phối P(hủy) trên test (Tuned)

| Nhãn thực tế | n | Mean P(hủy) | Median P(hủy) | Std |
|--------------|--:|------------:|--------------:|----:|
| Không hủy | 11.906 | 0,329 | 0,282 | 0,277 |
| Hủy | 4.657 | **0,746** | **0,811** | 0,216 |

So v2: median Không hủy tăng 0,23 → **0,28**; median Hủy tăng 0,75 → **0,81** — `scale_pos_weight` đẩy xác suất lên, ngưỡng 0,28 nằm gần median class Không hủy → FP cao hơn, FN thấp hơn.

### 3.5 So sánh công bằng với v2 @ cùng ngưỡng 0,35

| Metric class Hủy | v2 @ 0,35 | v2.1 @ 0,35 |
|------------------|----------:|------------:|
| Recall | 0,899 | **0,927** |
| F1 | **0,636** | 0,612 |
| ROC-AUC | 0,871 | **0,872** |

Ngay cả khi giữ ngưỡng 0,35, v2.1 vẫn Recall cao hơn nhờ `scale_pos_weight`.

---

## 4. Feature importance (gain)

Sau One-Hot: **143 cột**. Tổng hợp theo biến gốc (top):

| Hạng | Biến gốc | Ghi chú |
|:---:|----------|---------|
| 1 | `lead_time` | Trụ chính |
| 2 | `country` | Thị trường nguồn |
| 3 | `market_segment` | Online TA vs Direct/Corporate |
| … | `arrival_month_mapped` | Tháng liên tục |
| … | **`arrival_season`** | Có tín hiệu (gain ~14.921) nhưng không phải trụ chính |

**Nhận xét:** `arrival_season` đóng góp hữu ích nhưng yếu hơn tháng / lead time / segment — phù hợp vai trò bổ sung, không thay thế `arrival_month_mapped`.

---

## 5. SHAP — biến engineered

| Feature | Mean \|SHAP\| | Nhóm |
|---------|-------------:|------|
| `price_per_person` | 0,275 | Financial Commitment |
| `lead_time_per_night` | 0,184 | Trip Structure |
| `history_cancel_rate` | 0,130 | Trust & History |
| `total_nights` | 0,116 | Trip Structure |
| `total_guests` | 0,112 | Financial Commitment |
| `arrival_month_mapped` | 0,095 | Calendar & Seasonality |
| `is_family` | 0,036 | Financial Commitment |
| `is_weekend_only` | thấp | Calendar & Seasonality |

**`arrival_season` (One-Hot):** Summer mạnh nhất (mean \|SHAP\| 0,046), tiếp Winter / Autumn / Spring.

**Theo nhóm:** Financial Commitment > Trip Structure > Trust & History — khớp hướng v2.

---

## 6. Kết luận

### Điểm mạnh v2.1

1. **Recall Hủy 0,952** — vượt v2 (0,899) và RF v1.2 (0,94); phù hợp inventory protection.
2. **ROC-AUC 0,872** — ngang / nhỉnh hơn v2 (0,871).
3. Artifact **draft → promote** giúp thử params mới mà không mất bản tốt.
4. `arrival_season` + `scale_pos_weight` + ngưỡng 0,28 tạo thành bộ đòn bẩy Recall rõ ràng.

### Hạn chế

1. **Precision thấp hơn v2** (0,43 vs 0,49) → nhiều cảnh báo giả.
2. **Accuracy 0,63** thấp hơn v2 (0,71) — không dùng Accuracy làm tiêu chí chính khi class lệch.
3. Tune theo `roc_auc` không tối ưu trực tiếp Recall/Precision tại ngưỡng cố định.

### Khuyến nghị

| Ưu tiên | Hành động |
|--------|-----------|
| 1 | Dùng v2.1 khi mục tiêu là **không bỏ sót hủy** (overbooking / hold inventory) |
| 2 | Giữ `RUN_TUNING=False` khi inference; chỉ bật khi muốn thử draft mới |
| 3 | Nếu cần cân bằng Precision: dùng **v2 @ 0,35** hoặc v2.1 @ ngưỡng 0,35–0,50 |

---

## 7. Tài liệu liên quan

| Tài liệu | Nội dung |
|----------|----------|
| `models/.../09_cancellation_model_v2_1.ipynb` | Notebook đầy đủ |
| `artifacts/best_params_v2_1.json` | Best params production |
| [09_cancellation_model_v2.md](09_cancellation_model_v2.md) | LightGBM v2 |
| [13_cancellation_model_version_selection.md](13_cancellation_model_version_selection.md) | Lựa chọn giữa các phiên bản |
| [08_cancellation_model_v1_2.md](08_cancellation_model_v1_2.md) | RF v1.2 |
