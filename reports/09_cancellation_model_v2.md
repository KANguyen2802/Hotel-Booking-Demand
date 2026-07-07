# Báo cáo mô hình dự đoán hủy phòng — LightGBM v2

> **Nguồn dữ liệu:** `hotel_bookings_v5.csv`  
> **Phạm vi:** 82.811 booking | Tỷ lệ hủy tổng thể: **28,12%** (~23.284 booking bị hủy)  
> **Notebook tham chiếu:** `models/Canncellation Predict Model v2/09_cancellation_model_v2.ipynb`  
> **Thuật toán:** `LGBMClassifier` (LightGBM) + tinh chỉnh **GridSearchCV** & **Optuna** + giải thích **SHAP** (`TreeExplainer`)  
> **Ngưỡng phân loại:** **0,35** (`P(hủy) >= 0,35` → dự đoán Hủy)

---

## 1. Mục tiêu & khác biệt so với RF v1.2

v2 kế thừa **toàn bộ feature engineering** từ v1.2 (16 biến, 4 nhóm engineered), thay thuật toán Random Forest bằng **LightGBM** và bổ sung **tinh chỉnh hyperparameter** tự động.

| Tiêu chí | RF v1.2 | **LightGBM v2** |
|----------|---------|-----------------|
| Thuật toán | `RandomForestClassifier` | **`LGBMClassifier`** |
| Số feature | 16 (6 phân loại + 10 số) | **Giữ nguyên v1.2** |
| Feature engineering | 9 biến engineered (4 nhóm) | **Giữ nguyên** |
| Tinh chỉnh HP | Không (cố định) | **GridSearchCV + Optuna (mục 3b)** |
| Importance | Gini | **Gain** (chuẩn GBDT) |
| Ngưỡng | 0,35 | **0,35** (so sánh công bằng) |
| ROC-AUC (test) | 0,840 | **0,872** (tuned) |
| Recall — Hủy @ 0,35 | 0,94 | **0,88** |
| Precision — Hủy @ 0,35 | 0,42 | **0,51** |
| Accuracy @ 0,35 | 0,62 | **0,72** |

**Cải thiện chính:** ROC-AUC tăng **+0,032** (~+3,8%) so RF v1.2; Precision Hủy tăng ~9 điểm phần trăm. Recall Hủy giảm nhẹ (0,88 vs 0,94) do trade-off khi mô hình calibrated tốt hơn — có thể bù bằng hạ ngưỡng nếu ưu tiên inventory protection.

---

## 2. Thiết kế mô hình

### 2.1 Feature engineering (4 nhóm — giữ nguyên v1.2)

#### Nhóm 1 — Mức độ cam kết tài chính (Financial Commitment)

| Biến | Công thức | Ghi chú |
|------|----------|---------|
| `total_guests` | `adults + children + babies` | Clip tối thiểu = 1 |
| `price_per_person` | `adr / total_guests` | Giá trên mỗi khách |
| `is_family` | 1 nếu `children > 0` hoặc `babies > 0` | Nhóm gia đình |

#### Nhóm 2 — Cấu trúc chuyến đi (Trip Structure)

| Biến | Công thức | Ghi chú |
|------|----------|---------|
| `total_nights` | `stays_in_weekend_nights + stays_in_week_nights` | Tổng đêm lưu trú |
| `lead_time_per_night` | `lead_time / total_nights` | Clip mẫu số ≥ 1 |

#### Nhóm 3 — Lịch sử và uy tín (Trust & History)

| Biến | Công thức | Ghi chú |
|------|----------|---------|
| `history_cancel_rate` | `previous_cancellations / (previous_cancellations + previous_bookings_not_canceled)` | = 0 nếu chưa có lịch sử |

#### Nhóm 4 — Lịch & mùa (Calendar & Seasonality)

| Biến | Công thức | Ghi chú |
|------|----------|---------|
| `is_weekend_only` | 1 nếu `weekend_nights > 0` và `week_nights == 0` | Chỉ ở cuối tuần |
| `arrival_month_mapped` | Tháng đến → số 1–12 (Jan→1 … Dec→12) | Mùa vụ |

### 2.2 Feature đưa vào mô hình (16 biến)

| Biến | Kiểu | Xử lý |
|------|------|--------|
| `deposit_type`, `market_segment`, `country`, `distribution_channel`, `customer_type`, `hotel` | Phân loại | One-Hot Encoding |
| `lead_time`, `total_of_special_requests` | Số (v1.1) | Passthrough |
| 8 biến engineered ở trên | Số | Passthrough |

`ColumnTransformer`: nhánh `cat` (One-Hot, `min_frequency=5`) + nhánh `num` (passthrough). Sau encoding: **139 cột** đầu vào LightGBM.

### 2.3 Hyperparameter

#### Baseline (trước tune)

| Tham số | Giá trị |
|---------|--------:|
| `n_estimators` | 300 |
| `max_depth` | 12 |
| `min_child_samples` | 20 |
| `learning_rate` | 0,05 |
| `subsample` | 0,8 |
| `colsample_bytree` | 0,8 |
| `class_weight` | `balanced` |

#### Tinh chỉnh (mục 3b notebook)

| Phương pháp | Mục tiêu | CV ROC-AUC |
|-------------|----------|----------:|
| Baseline | — | 0,862 |
| **GridSearchCV** (64 tổ hợp, 3-fold) | `roc_auc` | 0,863 |
| **Optuna TPE** (35 trials, 3-fold) | `roc_auc` | **0,865** |

**Chọn:** Optuna (CV ROC-AUC cao hơn GridSearch).

#### Best params (Optuna — mô hình production trong notebook)

| Tham số | Giá trị |
|---------|--------:|
| `n_estimators` | 500 |
| `max_depth` | 15 |
| `num_leaves` | 68 |
| `min_child_samples` | 40 |
| `learning_rate` | 0,051 |
| `subsample` | 0,761 |
| `colsample_bytree` | 0,657 |
| `reg_alpha` | 0,002 |
| `reg_lambda` | 0,053 |
| `class_weight` | `balanced` |

### 2.4 Chống data leakage

1. Không nạp `reservation_status`, `revenue`, `Occupancy_Rate`, `RevPAR`, ...
2. Feature engineering chỉ dùng thông tin **có tại thời điểm đặt phòng**.
3. `train_test_split` **trước** mọi bước fit encoder và tune.
4. `OneHotEncoder` + GridSearch/Optuna chỉ `fit` trên tập train (qua `Pipeline`).

### 2.5 Ngưỡng 0,35

```text
y_pred = 1  nếu  P(hủy) >= 0.35
```

Giữ ngưỡng v1.2 để so sánh công bằng: ưu tiên **Recall**, chấp nhận tăng False Positive.

---

## 3. Kết quả đánh giá (tập test — 16.563 booking)

### 3.1 So sánh Baseline vs Tuned @ ngưỡng 0,35

| Chỉ số | Baseline LGBM | **Tuned (Optuna)** | RF v1.2 (tham chiếu) |
|--------|--------------:|-------------------:|---------------------:|
| **ROC-AUC (test)** | 0,867 | **0,872** | 0,840 |
| **CV ROC-AUC (5-fold)** | — | **0,867 ± 0,004** | 0,838 ± 0,004 |
| **Accuracy** | 0,698 | **0,724** | 0,62 |
| **Precision — Hủy** | 0,480 | **0,505** | 0,42 |
| **Recall — Hủy** | 0,905 | **0,884** | 0,94 |
| **F1 — Hủy** | 0,627 | **0,643** | 0,58 |
| **Precision — Không hủy** | 0,94 | **0,94** | 0,95 |
| **Recall — Không hủy** | 0,62 | **0,66** | 0,49 |

**Nhận xét:** Tuned cải thiện AUC, Accuracy, Precision và F1; Recall giảm nhẹ (−2,1 điểm phần trăm) so baseline LGBM. So RF v1.2: AUC cao hơn rõ, Precision tốt hơn, Recall thấp hơn ~6 điểm phần trăm.

### 3.2 So sánh ngưỡng 0,35 vs 0,50 (mô hình Tuned)

| Metric (class Hủy) | @ 0,50 | @ **0,35** |
|--------------------|-------:|-----------:|
| F1 | **0,683** | 0,643 |
| Recall | 0,79 | **0,88** |
| FN (bỏ sót hủy) | ~960 | **~540** |

**Kết luận ngưỡng:** 0,35 giảm FN từ ~960 xuống **540** (−44%) — phù hợp inventory protection; 0,50 tốt hơn nếu ưu tiên F1 / Precision.

### 3.3 Ma trận nhầm lẫn @ 0,35 (Tuned)

|  | Dự đoán: Không hủy | Dự đoán: Hủy |
|--|--:|--:|
| **Thực tế: Không hủy** | TN = 7.873 | FP = 4.033 |
| **Thực tế: Hủy** | FN = 540 | TP = 4.117 |

So RF v1.2: FP giảm từ 6.013 → **4.033** (−33%); FN tăng từ 289 → **540** (+87%) — trade-off rõ khi tăng Precision.

### 3.4 Phân phối xác suất dự đoán (test — Tuned)

| Nhãn thực tế | n | Mean P(hủy) | Median P(hủy) | Std |
|--------------|--:|------------:|--------------:|----:|
| Không hủy | 11.906 | 0,274 | 0,208 | 0,253 |
| Hủy | 4.657 | **0,690** | **0,748** | 0,237 |

Hai phân phối tách lớp rõ hơn RF v1.2 (median Không hủy: 0,35 → **0,21**; median Hủy: 0,63 → **0,75**). Mô hình LightGBM calibrated tốt hơn, giảm overlap vùng 0,25–0,55.

---

## 4. Feature importance (gain)

### 4.1 Top 20 feature (sau tiền xử lý)

| Hạng | Feature | Gain | Biến gốc / nhóm |
|:---:|---------|-----:|------------------|
| 1 | `lead_time` | 58.491 | `lead_time` |
| 2 | `country_PRT` | 47.967 | `country` |
| 3 | `market_segment_Online TA` | 44.428 | `market_segment` |
| 4 | `total_of_special_requests` | 41.526 | `total_of_special_requests` |
| 5 | **`lead_time_per_night`** | **23.181** | **Trip Structure** |
| 6 | **`price_per_person`** | **22.110** | **Financial Commitment** |
| 7 | **`history_cancel_rate`** | **14.082** | **Trust & History** |
| 8 | **`total_nights`** | **11.482** | **Trip Structure** |
| 9 | `deposit_type_Non Refund` | 11.074 | `deposit_type` |
| 10 | `customer_type_Transient` | 10.878 | `customer_type` |
| 11 | **`arrival_month_mapped`** | **9.430** | **Calendar & Seasonality** |
| 12 | `market_segment_Offline TA/TO` | 8.472 | `market_segment` |
| 13 | `distribution_channel_TA/TO` | 7.346 | `distribution_channel` |
| 14 | `customer_type_Transient-Party` | 6.808 | `customer_type` |
| 15 | `market_segment_Direct` | 6.072 | `market_segment` |
| 16 | **`total_guests`** | **4.601** | **Financial Commitment** |
| 17 | `hotel_City Hotel` | 4.034 | `hotel` |
| 18 | `country_GBR` | 3.185 | `country` |
| 19 | `country_DEU` | 2.560 | `country` |
| 20 | `country_FRA` | 2.058 | `country` |

**Nhận xét:** 5 biến engineered trong top 20; thứ hạng tương tự RF v1.2 nhưng LightGBM đẩy `price_per_person` và `history_cancel_rate` lên cao hơn.

### 4.2 Gom nhóm theo biến gốc (tổng gain)

| Hạng | Biến / nhóm | Tổng gain | Đánh giá |
|:---:|-------------|----------:|----------|
| 1 | `country` | 70.111 | Thị trường nguồn (PRT) |
| 2 | `market_segment` | 61.244 | OTA / Direct |
| 3 | `lead_time` | 58.491 | Đặt trước xa → rủi ro cao |
| 4 | `total_of_special_requests` | 41.526 | Cam kết / nhu cầu cụ thể |
| 5 | **`lead_time_per_night`** | **23.181** | **Biến engineered mạnh nhất** |
| 6 | **`price_per_person`** | **22.110** | Cam kết tài chính |
| 7 | `customer_type` | 19.707 | Transient rủi ro hơn |
| 8 | **`history_cancel_rate`** | **14.082** | Lịch sử hủy |
| 9 | `deposit_type` | 12.034 | Chính sách cọc |
| 10 | **`total_nights`** | **11.482** | Cấu trúc chuyến đi |
| 11 | **`arrival_month_mapped`** | **9.430** | Mùa vụ |
| 12 | `distribution_channel` | 9.338 | TA/TO vs Direct |
| 13 | **`total_guests`** | **4.601** | Quy mô nhóm |
| 14 | `hotel` | 4.489 | City vs Resort |
| 15 | **`is_family`** | **0.992** | Gia đình — yếu |
| 16 | **`is_weekend_only`** | **0.287** | Cuối tuần — yếu nhất |

---

## 5. Giải thích SHAP — Biến engineered

### 5.1 Phương pháp

| Thành phần | Cài đặt |
|------------|---------|
| Thư viện | `shap` — `TreeExplainer` |
| Mô hình giải thích | `LGBMClassifier` (tuned) sau `ColumnTransformer` |
| Dữ liệu | Mẫu **2.000** booking ngẫu nhiên từ tập test (`random_state=42`) |
| Class giải thích | **Hủy** (class 1) |

### 5.2 Mean |SHAP| — Xếp hạng biến engineered

| Hạng | Biến | Mean \|SHAP\| | Mean SHAP | Nhóm | Diễn giải |
|:---:|------|------------:|----------:|------|-----------|
| 1 | **`price_per_person`** | **0,198** | −0,031 | Financial Commitment | Đóng góp lớn nhất trong nhóm engineered |
| 2 | **`lead_time_per_night`** | **0,132** | −0,001 | Trip Structure | Chuẩn hóa lead time theo độ dài chuyến |
| 3 | **`history_cancel_rate`** | **0,115** | +0,010 | Trust & History | Lịch sử hủy cao → đẩy P(hủy) lên |
| 4 | **`arrival_month_mapped`** | **0,108** | −0,001 | Calendar | Mùa vụ — SHAP mạnh hơn Gini gợi ý |
| 5 | **`total_nights`** | **0,092** | +0,009 | Trip Structure | Số đêm và cấu trúc chuyến |
| 6 | **`total_guests`** | **0,087** | +0,009 | Financial Commitment | Quy mô nhóm khách |
| 7 | **`is_family`** | **0,022** | −0,001 | Financial Commitment | Tác động nhỏ |
| 8 | **`is_weekend_only`** | **0,002** | −0,000 | Calendar | Yếu nhất |

**So v1.2 (RF):** LightGBM SHAP nhấn mạnh `price_per_person` (#1 engineered) thay vì `lead_time_per_night` (#1 ở RF). `arrival_month_mapped` tăng đóng góp SHAP đáng kể so Gini importance thấp.

### 5.3 Tổng hợp theo nhóm feature engineering

| Nhóm | Tổng mean \|SHAP\| | Mean SHAP | Đánh giá |
|------|------------------:|----------:|----------|
| **Financial Commitment** | **0,308** | −0,023 | Nhóm engineered quan trọng nhất — `price_per_person` chi phối |
| **Trip Structure** | **0,224** | +0,008 | `lead_time_per_night` + `total_nights` |
| **Trust & History** | **0,115** | +0,010 | `history_cancel_rate` — tín hiệu có hướng |
| **Calendar & Seasonality** | **0,110** | −0,001 | `arrival_month_mapped` mạnh hơn `is_weekend_only` |

---

## 6. Trực quan hóa & đánh giá biểu đồ

### 6.1 Confusion Matrix (@ 0,35 — Tuned)

FN = 540, FP = 4.033. Cân bằng tốt hơn RF v1.2 về Precision (ít FP hơn), nhưng FN cao hơn — cần cân nhắc hạ ngưỡng xuống 0,30 nếu ưu tiên Recall tuyệt đối.

### 6.2 ROC Curve (AUC = 0,872)

Cải thiện rõ so RF v1.2 (0,840) và baseline LGBM (0,867). Mô hình xếp hạng rủi ro tốt; phù hợp scoring / prioritization.

### 6.3 Prediction Probability Distribution

Median P(hủy): Không hủy **0,21** · Hủy **0,75** — tách lớp tốt hơn v1.2. Ngưỡng 0,35 nằm dưới median class Không hủy → vẫn đảm bảo Recall cao.

### 6.4 Gain importance vs SHAP

| Góc nhìn | Gain (LightGBM) | SHAP |
|----------|-----------------|------|
| Phạm vi | Toàn cục, split quality | Local + trung bình có dấu |
| Biến engineered nổi bật | `lead_time_per_night`, `price_per_person`, `history_cancel_rate` | `price_per_person` #1 engineered |
| Khuyến nghị | Ranking feature, monitoring drift | Giải thích quyết định từng booking |

---

## 7. Kết luận tổng thể

### Điểm mạnh v2

1. **ROC-AUC 0,872** — tốt nhất trong các phiên bản (v1.1: 0,831 · v1.2: 0,840 · v2: **0,872**).
2. **Tinh chỉnh Optuna** cải thiện +0,005 AUC so baseline LGBM với cùng feature.
3. **Precision Hủy 0,51** @ 0,35 — cao hơn RF v1.2 (~42%), giảm cảnh báo sai.
4. **Feature engineering v1.2** vẫn có giá trị; 5/8 biến engineered trong top 20 gain.
5. **SHAP** xác nhận `price_per_person` và `history_cancel_rate` là trụ chính ngoài `lead_time` / segment.

### Hạn chế & rủi ro

1. **Recall Hủy 0,88** thấp hơn RF v1.2 (0,94) @ cùng ngưỡng 0,35 — FN = 540 vs 289.
2. Tune theo `roc_auc` không tối ưu trực tiếp Recall — cần quét ngưỡng hoặc `scale_pos_weight` nếu mục tiêu là không bỏ sót hủy.
3. GridSearch + Optuna **tốn thời gian** (~5–10 phút) — production nên lưu `best_params` cố định.
4. SHAP / gain **không phải nhân quả** — cần A/B trước khi đổi chính sách.

### Khuyến nghị hành động

| Ưu tiên | Hành động | Ghi chú |
|--------|-----------|---------|
| 1 | Triển khai pilot scoring với **LightGBM tuned** + ngưỡng 0,35 | AUC 0,872, Precision cao |
| 2 | Nếu cần Recall ≥ 0,94: thử ngưỡng **0,28–0,30** hoặc tăng `scale_pos_weight` | Trade-off Precision |
| 3 | Rule: **`history_cancel_rate` > 0** + **Online TA** → xác nhận chặt | SHAP + gain |
| 4 | Rule: **`price_per_person` thấp** + lead time dài → ưu tiên cọc | Financial Commitment |
| 5 | Lưu `best_params` Optuna vào artifact production; tắt `RUN_TUNING` khi inference | Notebook mục 3b |

---

## 8. Tài liệu liên quan

| Tài liệu | Nội dung |
|----------|----------|
| `09_cancellation_model_v2.ipynb` | Notebook đầy đủ (tune + SHAP) |
| [08_cancellation_model_v1_2.md](08_cancellation_model_v1_2.md) | RF v1.2 — cùng feature set |
| [07_cancellation_model_v1_1.md](07_cancellation_model_v1_1.md) | Phiên bản 9 feature |
| [06_cancellation_model_v1.md](06_cancellation_model_v1.md) | Baseline phân loại |
| [04_correlation_analysis_is_canceled.md](04_correlation_analysis_is_canceled.md) | Tier feature & leakage |
