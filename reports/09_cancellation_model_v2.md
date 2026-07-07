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
| ROC-AUC (test) | 0,840 | **0,871** (tuned) |
| Recall — Hủy @ 0,35 | 0,94 | **0,90** |
| Precision — Hủy @ 0,35 | 0,42 | **0,49** |
| Accuracy @ 0,35 | 0,62 | **0,71** |

**Cải thiện chính:** ROC-AUC tăng **+0,031** (~+3,7%) so RF v1.2; Precision Hủy tăng ~7 điểm phần trăm. Recall Hủy giảm nhẹ (0,90 vs 0,94) do trade-off khi mô hình calibrated tốt hơn — có thể bù bằng hạ ngưỡng nếu ưu tiên inventory protection.

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
| `n_estimators` | 250 |
| `max_depth` | 15 |
| `num_leaves` | 61 |
| `min_child_samples` | 35 |
| `learning_rate` | 0,063 |
| `subsample` | 0,796 |
| `colsample_bytree` | 0,633 |
| `reg_alpha` | 0,008 |
| `reg_lambda` | 3,265 |
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
| **ROC-AUC (test)** | 0,867 | **0,871** | 0,840 |
| **CV ROC-AUC (5-fold)** | — | **0,867 ± 0,004** | 0,838 ± 0,004 |
| **Accuracy** | 0,698 | **0,710** | 0,62 |
| **Precision — Hủy** | 0,480 | **0,492** | 0,42 |
| **Recall — Hủy** | 0,905 | **0,899** | 0,94 |
| **F1 — Hủy** | 0,627 | **0,636** | 0,58 |
| **Precision — Không hủy** | 0,94 | **0,94** | 0,95 |
| **Recall — Không hủy** | 0,64 | **0,64** | 0,49 |

**Nhận xét:** Tuned cải thiện AUC (+0,005), Accuracy, Precision và F1; Recall giảm nhẹ (−0,6 điểm phần trăm) so baseline LGBM. So RF v1.2: AUC cao hơn rõ, Precision tốt hơn, Recall thấp hơn ~4 điểm phần trăm.

### 3.2 So sánh ngưỡng 0,35 vs 0,50 (mô hình Tuned)

| Metric (class Hủy) | @ 0,50 | @ **0,35** |
|--------------------|-------:|-----------:|
| F1 | **0,676** | 0,636 |
| Recall | ~0,79 | **0,90** |
| FN (bỏ sót hủy) | ~980 | **469** |

**Kết luận ngưỡng:** 0,35 giảm FN so với 0,50 — phù hợp inventory protection; 0,50 tốt hơn nếu ưu tiên F1 / Precision.

### 3.3 Ma trận nhầm lẫn @ 0,35 (Tuned)

|  | Dự đoán: Không hủy | Dự đoán: Hủy |
|--|--:|--:|
| **Thực tế: Không hủy** | TN = 7.577 | FP = 4.329 |
| **Thực tế: Hủy** | FN = 469 | TP = 4.188 |

So RF v1.2: FP giảm từ 6.013 → **4.329** (−28%); FN tăng từ 289 → **469** (+62%) — trade-off rõ khi tăng Precision.

### 3.4 Phân phối xác suất dự đoán (test — Tuned)

| Nhãn thực tế | n | Mean P(hủy) | Median P(hủy) | Std |
|--------------|--:|------------:|--------------:|----:|
| Không hủy | 11.906 | 0,289 | 0,231 | 0,250 |
| Hủy | 4.657 | **0,691** | **0,745** | 0,227 |

Hai phân phối tách lớp rõ hơn RF v1.2 (median Không hủy: 0,35 → **0,23**; median Hủy: 0,63 → **0,75**). Mô hình LightGBM calibrated tốt hơn, giảm overlap vùng 0,25–0,55.

---

## 4. Feature importance (gain)

### 4.1 Top 20 feature (sau tiền xử lý)

| Hạng | Feature | Gain | Biến gốc / nhóm |
|:---:|---------|-----:|------------------|
| 1 | `lead_time` | 57.672 | `lead_time` |
| 2 | `country_PRT` | 38.574 | `country` |
| 3 | `market_segment_Online TA` | 36.623 | `market_segment` |
| 4 | `total_of_special_requests` | 26.969 | `total_of_special_requests` |
| 5 | **`price_per_person`** | **23.828** | **Financial Commitment** |
| 6 | **`lead_time_per_night`** | **16.923** | **Trip Structure** |
| 7 | **`arrival_month_mapped`** | **12.350** | **Calendar & Seasonality** |
| 8 | **`history_cancel_rate`** | **11.634** | **Trust & History** |
| 9 | `customer_type_Transient` | 10.870 | `customer_type` |
| 10 | **`total_nights`** | **10.556** | **Trip Structure** |
| 11 | `deposit_type_Non Refund` | 7.327 | `deposit_type` |
| 12 | **`total_guests`** | **5.584** | **Financial Commitment** |
| 13 | `distribution_channel_TA/TO` | 5.440 | `distribution_channel` |
| 14 | `market_segment_Offline TA/TO` | 4.911 | `market_segment` |
| 15 | `market_segment_Direct` | 4.671 | `market_segment` |
| 16 | `customer_type_Transient-Party` | 4.604 | `customer_type` |
| 17 | `hotel_City Hotel` | 3.145 | `hotel` |
| 18 | `deposit_type_No Deposit` | 2.671 | `deposit_type` |
| 19 | `country_GBR` | 2.536 | `country` |
| 20 | `country_DEU` | 2.341 | `country` |

**Nhận xét:** 5 biến engineered trong top 20; `price_per_person` vượt `lead_time_per_night` so với RF v1.2.

### 4.2 Gom nhóm theo biến gốc (tổng gain)

| Hạng | Biến / nhóm | Tổng gain | Đánh giá |
|:---:|-------------|----------:|----------|
| 1 | `country` | 58.645 | Thị trường nguồn (PRT) |
| 2 | `lead_time` | 57.672 | Đặt trước xa → rủi ro cao |
| 3 | `market_segment` | 48.270 | OTA / Direct |
| 4 | `total_of_special_requests` | 26.969 | Cam kết / nhu cầu cụ thể |
| 5 | **`price_per_person`** | **23.828** | Cam kết tài chính |
| 6 | `customer_type` | 17.171 | Transient rủi ro hơn |
| 7 | **`lead_time_per_night`** | **16.923** | **Biến engineered mạnh** |
| 8 | **`arrival_month_mapped`** | **12.350** | Mùa vụ |
| 9 | **`history_cancel_rate`** | **11.634** | Lịch sử hủy |
| 10 | **`total_nights`** | **10.556** | Cấu trúc chuyến đi |
| 11 | `deposit_type` | 9.998 | Chính sách cọc |
| 12 | `distribution_channel` | 8.335 | TA/TO vs Direct |
| 13 | **`total_guests`** | **5.584** | Quy mô nhóm |
| 14 | `hotel` | 5.058 | City vs Resort |
| 15 | **`is_family`** | **1.432** | Gia đình — yếu |
| 16 | **`is_weekend_only`** | **0.185** | Cuối tuần — yếu nhất |

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
| 1 | **`price_per_person`** | **0,244** | −0,012 | Financial Commitment | Đóng góp lớn nhất trong nhóm engineered |
| 2 | **`lead_time_per_night`** | **0,139** | +0,004 | Trip Structure | Chuẩn hóa lead time theo độ dài chuyến |
| 3 | **`arrival_month_mapped`** | **0,130** | −0,005 | Calendar | Mùa vụ — SHAP mạnh hơn gain gợi ý |
| 4 | **`history_cancel_rate`** | **0,121** | +0,012 | Trust & History | Lịch sử hủy cao → đẩy P(hủy) lên |
| 5 | **`total_nights`** | **0,117** | +0,010 | Trip Structure | Số đêm và cấu trúc chuyến |
| 6 | **`total_guests`** | **0,095** | +0,003 | Financial Commitment | Quy mô nhóm khách |
| 7 | **`is_family`** | **0,026** | −0,001 | Financial Commitment | Tác động nhỏ |
| 8 | **`is_weekend_only`** | **0,002** | −0,000 | Calendar | Yếu nhất |

**So v1.2 (RF):** LightGBM SHAP nhấn mạnh `price_per_person` (#1 engineered) thay vì `lead_time_per_night` (#1 ở RF). `arrival_month_mapped` tăng đóng góp SHAP đáng kể so Gini importance thấp.

### 5.3 Tổng hợp theo nhóm feature engineering

| Nhóm | Tổng mean \|SHAP\| | Mean SHAP | Đánh giá |
|------|------------------:|----------:|----------|
| **Financial Commitment** | **0,365** | −0,009 | Nhóm engineered quan trọng nhất — `price_per_person` chi phối |
| **Trip Structure** | **0,255** | +0,014 | `lead_time_per_night` + `total_nights` |
| **Calendar & Seasonality** | **0,132** | −0,005 | `arrival_month_mapped` mạnh hơn `is_weekend_only` |
| **Trust & History** | **0,121** | +0,012 | `history_cancel_rate` — tín hiệu có hướng |

---

## 6. Trực quan hóa & đánh giá biểu đồ

### 6.1 Confusion Matrix (@ 0,35 — Tuned)

FN = 469, FP = 4.329. Cân bằng tốt hơn RF v1.2 về Precision (ít FP hơn), nhưng FN cao hơn — cần cân nhắc hạ ngưỡng xuống 0,30 nếu ưu tiên Recall tuyệt đối.

### 6.2 ROC Curve (AUC = 0,871)

Cải thiện rõ so RF v1.2 (0,840) và baseline LGBM (0,867). Mô hình xếp hạng rủi ro tốt; phù hợp scoring / prioritization.

### 6.3 Prediction Probability Distribution

Median P(hủy): Không hủy **0,23** · Hủy **0,75** — tách lớp tốt hơn v1.2. Ngưỡng 0,35 nằm trên median class Không hủy → vẫn đảm bảo Recall cao.

### 6.4 Gain importance vs SHAP

| Góc nhìn | Gain (LightGBM) | SHAP |
|----------|-----------------|------|
| Phạm vi | Toàn cục, split quality | Local + trung bình có dấu |
| Biến engineered nổi bật | `lead_time_per_night`, `price_per_person`, `history_cancel_rate` | `price_per_person` #1 engineered |
| Khuyến nghị | Ranking feature, monitoring drift | Giải thích quyết định từng booking |

---

## 7. Kết luận tổng thể

### Điểm mạnh v2

1. **ROC-AUC 0,871** — tốt nhất trong các phiên bản (v1.1: 0,831 · v1.2: 0,840 · v2: **0,871**).
2. **Tinh chỉnh Optuna** cải thiện +0,005 AUC so baseline LGBM với cùng feature.
3. **Precision Hủy 0,49** @ 0,35 — cao hơn RF v1.2 (~42%), giảm cảnh báo sai.
4. **Feature engineering v1.2** vẫn có giá trị; 5/8 biến engineered trong top 20 gain.
5. **SHAP** xác nhận `price_per_person` và `history_cancel_rate` là trụ chính ngoài `lead_time` / segment.

### Hạn chế & rủi ro

1. **Recall Hủy 0,90** thấp hơn RF v1.2 (0,94) @ cùng ngưỡng 0,35 — FN = 469 vs 289.
2. Tune theo `roc_auc` không tối ưu trực tiếp Recall — cần quét ngưỡng hoặc `scale_pos_weight` nếu mục tiêu là không bỏ sót hủy.
3. GridSearch + Optuna **tốn thời gian** (~5–10 phút) — production nên lưu `best_params` cố định.
4. SHAP / gain **không phải nhân quả** — cần A/B trước khi đổi chính sách.

### Khuyến nghị hành động

| Ưu tiên | Hành động | Ghi chú |
|--------|-----------|---------|
| 1 | Triển khai pilot scoring với **LightGBM tuned** + ngưỡng 0,35 | AUC 0,871, Precision cao |
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
