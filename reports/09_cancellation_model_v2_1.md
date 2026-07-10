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

### 3.4 Confusion Matrix & ROC Curve


![Confusion Matrix & ROC Curve — LightGBM v2.1](./figures/09_1/chart_01.png)

AUC = 0,872. Ma trận phản ánh trade-off Recall cao / Precision trung bình ở ngưỡng 0,28.

### 3.5 Phân phối P(hủy) trên test (Tuned)

| Nhãn thực tế | n | Mean P(hủy) | Median P(hủy) | Std |
|--------------|--:|------------:|--------------:|----:|
| Không hủy | 11.906 | 0,329 | 0,282 | 0,277 |
| Hủy | 4.657 | **0,746** | **0,811** | 0,216 |


![Phân phối xác suất dự đoán P(hủy)](./figures/09_1/chart_02.png)

So v2: median Không hủy tăng 0,23 → **0,28**; median Hủy tăng 0,75 → **0,81** — `scale_pos_weight` đẩy xác suất lên, ngưỡng 0,28 nằm gần median class Không hủy → FP cao hơn, FN thấp hơn.

### 3.6 So sánh công bằng với v2 @ cùng ngưỡng 0,35

| Metric class Hủy | v2 @ 0,35 | v2.1 @ 0,35 |
|------------------|----------:|------------:|
| Recall | 0,899 | **0,927** |
| F1 | **0,636** | 0,612 |
| ROC-AUC | 0,871 | **0,872** |

Ngay cả khi giữ ngưỡng 0,35, v2.1 vẫn Recall cao hơn nhờ `scale_pos_weight`.

---

## 4. Feature importance (gain)

> **Cách đọc:** Gain = chất lượng split LightGBM; **Giá trị ảnh hưởng** = mức cụ thể đẩy P(hủy) ↑/↓ (đối chiếu tỷ lệ hủy / SHAP mục 5). TB hủy toàn cục ~28,1%. Sau One-Hot: **143 cột**.

### 4.1 Top 20 feature (sau tiền xử lý)


![Feature Importance (gain) — Top 20](./figures/09_1/chart_03.png)

| Hạng | Feature | Gain | Biến gốc / nhóm | Giá trị / mức ảnh hưởng | Hướng | Đánh giá |
|:---:|---------|-----:|------------------|-------------------------|-------|----------|
| 1 | `lead_time` | 109.461 | `lead_time` | **> 180 ngày** (~41,7%) vs **0–30** (~16,8%) | Cao ↑ · Thấp ↓ | Lever số gốc mạnh nhất |
| 2 | `market_segment_Online TA` | 62.329 | `market_segment` | = **Online TA** | ↑ (~35,5%) | Nguồn rủi ro OTA chính |
| 3 | **`price_per_person`** | **60.217** | **Financial Commitment** | Giá/người **cao** vs **thấp** | Cao ↓ · Thấp ↑ (SHAP #1 eng.) | Engineered mạnh nhất ở LGBM |
| 4 | **`lead_time_per_night`** | **59.124** | **Trip Structure** | Thấp vs cao (lead/đêm) | Thấp ↑ · Cao ↓ (SHAP) | Chuẩn hóa lead time theo đêm |
| 5 | `total_of_special_requests` | 50.397 | `total_of_special_requests` | **0** (~34%) vs **3+** (~16%) | Nhiều ↓ · 0 ↑ | Cam kết giảm rủi ro |
| 6 | `country_PRT` | 48.086 | `country` | = **PRT** | ↑ (~36,8%) | Thị trường nội địa lớn |
| 7 | **`total_nights`** | **24.457** | **Trip Structure** | Số đêm dài / ngắn | Tác động phi tuyến (SHAP) | Cấu trúc chuyến đi |
| 8 | **`arrival_month_mapped`** | **22.735** | **Calendar & Seasonality** | Tháng cao điểm / thấp điểm | Phụ thuộc mùa (SHAP) | Mùa vụ — bổ sung bởi `arrival_season` |
| 9 | `market_segment_Offline TA/TO` | 22.037 | `market_segment` | = **Offline TA/TO** | ↓ (~15,1%) | Đối trọng Online TA |
| 10 | **`history_cancel_rate`** | **21.400** | **Trust & History** | **> 0** (≈1) vs **= 0** | Cao ↑↑ · 0 gần TB | Lịch sử hủy → đẩy P(hủy) rõ |
| 11 | `customer_type_Transient` | 16.800 | `customer_type` | = **Transient** | ↑ (~30,4%) | Khách lẻ rủi ro hơn |
| 12 | `customer_type_Transient-Party` | 14.870 | `customer_type` | = **Transient-Party** | ↓ (~15,8%) | An toàn hơn Transient đơn |
| 13 | `distribution_channel_TA/TO` | 14.093 | `distribution_channel` | = **TA/TO** | ↑ (~31,5%) | Kênh đại lý / OTA |
| 14 | `deposit_type_Non Refund` | 13.558 | `deposit_type` | = **Non Refund** | ↑↑ (~95%) | Đặc thù chính sách |
| 15 | `market_segment_Direct` | 11.905 | `market_segment` | = **Direct** | ↓ (~14,9%) | Segment ổn định |
| 16 | `country_GBR` | 11.707 | `country` | = **GBR** | ↓ (~19,6%) | Thị trường ổn định hơn PRT |
| 17 | **`total_guests`** | **11.514** | **Financial Commitment** | Nhiều / ít khách | Tác động nhỏ–trung bình | Quy mô nhóm |
| 18 | `country_DEU` | 8.036 | `country` | = **DEU** | Thường ↓ so PRT | Thị trường ổn định hơn |
| 19 | `hotel_City Hotel` | 7.652 | `hotel` | = **City Hotel** | ↑ nhẹ (~30,7% vs Resort ~24%) | City rủi ro hơn Resort |
| 20 | `country_FRA` | 7.509 | `country` | = **FRA** | Thường ↓ so PRT | Thị trường ổn định hơn |

**Nhận xét:** 5 biến engineered trong top 20 (giống v2). So v2: `price_per_person` và `lead_time_per_night` leo lên hạng 3–4 (gain tuyệt đối cao hơn sau `scale_pos_weight`). **Giá trị đẩy rủi ro ↑:** lead time dài, Online TA, PRT, `history_cancel_rate` > 0, Non Refund, Transient. **Giá trị kéo ↓:** Offline/Direct, nhiều special requests, `price_per_person` cao, Transient-Party, GBR/DEU/FRA.

### 4.2 Gom nhóm theo biến gốc (tổng gain)

| Hạng | Biến / nhóm | Tổng gain | Giá trị ảnh hưởng chính | Hướng tác động | Đánh giá |
|:---:|-------------|----------:|-------------------------|----------------|----------|
| 1 | `lead_time` | 109.461 | > 90–180 ↑; ≤ 30 ↓ | Dài ngày → rủi ro cao | Đặt trước xa → rủi ro cao |
| 2 | `country` | 103.456 | PRT ↑; GBR / DEU / FRA ↓ | Thị trường nguồn | PRT chi phối tổng gain |
| 3 | `market_segment` | 101.195 | Online TA ↑; Offline / Direct ↓ | OTA vs Direct | Phân cực kênh rõ |
| 4 | **`price_per_person`** | **60.217** | Cao ↓ · Thấp ↑ (SHAP) | Cam kết tài chính | Engineered #1 ở LGBM |
| 5 | **`lead_time_per_night`** | **59.124** | Thấp ↑ · Cao ↓ | Chuẩn hóa lead/đêm | **Biến engineered mạnh** |
| 6 | `total_of_special_requests` | 50.397 | 0 ↑; 3+ ↓ | Nhiều yêu cầu → ít hủy | Cam kết / nhu cầu cụ thể |
| 7 | `customer_type` | 36.610 | Transient ↑; Transient-Party / Group ↓ | Loại khách | Transient rủi ro hơn |
| 8 | **`total_nights`** | **24.457** | Dài / ngắn — phi tuyến | Cấu trúc chuyến | Bổ sung lead_time |
| 9 | **`arrival_month_mapped`** | **22.735** | Tháng cao / thấp điểm | Mùa vụ (SHAP) | Mạnh hơn ở SHAP so gợi ý gain thuần |
| 10 | `distribution_channel` | 22.493 | TA/TO ↑; Direct ↓ | Kênh đặt | TA/TO vs Direct |
| 11 | **`history_cancel_rate`** | **21.400** | > 0 ↑↑; = 0 gần TB | Lịch sử hủy | Hướng rõ — flag khi > 0 |
| 12 | `deposit_type` | 17.167 | Non Refund ↑↑; No Deposit ~TB | Chính sách cọc | Non Refund đặc thù |
| 13 | **`arrival_season`** | **14.921** | Summer / Winter / Autumn / Spring | Mùa rời rạc (One-Hot) | Bổ sung tháng — không thay thế `arrival_month_mapped` |
| 14 | `hotel` | 12.878 | City ↑ nhẹ vs Resort | Loại KS | City vs Resort |
| 15 | **`total_guests`** | **11.514** | Tác động nhỏ–TB | Quy mô nhóm | Tín hiệu phụ |
| 16 | **`is_family`** | **3.164** | Có trẻ — yếu | Gia đình | Yếu |
| 17 | **`is_weekend_only`** | **0.831** | Chỉ cuối tuần — yếu nhất | Calendar | Yếu nhất |

---

## 5. Giải thích SHAP — Biến engineered

### 5.1 Phương pháp

| Thành phần | Cài đặt |
|------------|---------|
| Thư viện | `shap` — `TreeExplainer` |
| Mô hình giải thích | `LGBMClassifier` (tuned v2.1) sau `ColumnTransformer` |
| Dữ liệu | Mẫu **2.000** booking ngẫu nhiên từ tập test (`random_state=42`) |
| Class giải thích | **Hủy** (class 1) |

### 5.2 Mean |SHAP| — Xếp hạng biến engineered


![SHAP — mean \|SHAP\| engineered & theo nhóm](./figures/09_1/chart_04.png)

| Hạng | Biến | Mean \|SHAP\| | Mean SHAP | Nhóm | Giá trị ảnh hưởng | Hướng | Diễn giải |
|:---:|------|------------:|----------:|------|-------------------|-------|-----------|
| 1 | **`price_per_person`** | **0,275** | −0,016 | Financial Commitment | Giá/người cao vs thấp | Cao ↓ · Thấp ↑ | Đóng góp engineered lớn nhất |
| 2 | **`lead_time_per_night`** | **0,184** | +0,002 | Trip Structure | Thấp vs cao (lead/đêm) | Thấp ↑ · Cao ↓ | Chuẩn hóa lead time theo độ dài chuyến |
| 3 | **`history_cancel_rate`** | **0,130** | +0,014 | Trust & History | > 0 (≈1) vs = 0 | Cao ↑↑ | Lịch sử hủy cao → đẩy P(hủy) lên |
| 4 | **`total_nights`** | **0,116** | +0,010 | Trip Structure | Số đêm dài / ngắn | Phi tuyến | Cấu trúc chuyến đi |
| 5 | **`total_guests`** | **0,112** | +0,012 | Financial Commitment | Nhiều / ít khách | Nhỏ–TB | Quy mô nhóm khách |
| 6 | **`arrival_month_mapped`** | **0,095** | −0,003 | Calendar & Seasonality | Tháng cao / thấp điểm | Phụ thuộc mùa | SHAP mạnh hơn gain gợi ý; bổ sung bởi season |
| 7 | **`is_family`** | **0,036** | −0,001 | Financial Commitment | Có trẻ (=1) vs không | Yếu | Tác động nhỏ |
| 8 | **`is_weekend_only`** | **0,006** | −0,001 | Calendar & Seasonality | Chỉ cuối tuần (=1) | Yếu nhất | Calendar — yếu nhất |

**So v2:** Thứ tự engineered giữ nguyên hướng (`price_per_person` #1). Mean \|SHAP\| tăng nhẹ (0,244 → 0,275) — phù hợp phân phối P(hủy) bị đẩy lên bởi `scale_pos_weight`. `arrival_month_mapped` tụt xuống #6 so v2 (#3) khi có thêm tín hiệu mùa rời rạc.

### 5.3 Tổng hợp theo nhóm feature engineering

| Nhóm | Tổng mean \|SHAP\| | Mean SHAP | Đánh giá |
|------|------------------:|----------:|----------|
| **Financial Commitment** | **0,423** | −0,005 | Nhóm engineered quan trọng nhất — `price_per_person` chi phối |
| **Trip Structure** | **0,300** | +0,012 | `lead_time_per_night` + `total_nights` |
| **Trust & History** | **0,130** | +0,014 | `history_cancel_rate` — tín hiệu có hướng |
| **Calendar & Seasonality** | **0,101** | −0,004 | `arrival_month_mapped` mạnh hơn `is_weekend_only`; season xem mục 5.5 |

### 5.4 SHAP Beeswarm — Phân tán đóng góp theo từng booking


![SHAP Beeswarm — Biến engineered](./figures/09_1/chart_05.png)

Mỗi chấm là một booking trong mẫu 2.000; trục ngang là giá trị SHAP (đóng góp vào P(hủy)), màu thể hiện giá trị feature (cao → đỏ, thấp → xanh). Beeswarm bổ sung cho bảng 5.2–5.3 bằng cách cho thấy **phân bố** và **hướng** tác động trên từng quan sát — ví dụ `history_cancel_rate` cao tập trung SHAP dương mạnh; `price_per_person` cao thường kéo SHAP âm.

### 5.5 SHAP — `arrival_season` (One-Hot)


![SHAP arrival_season](./figures/09_1/chart_06.png)

| Hạng | Feature | Mean \|SHAP\| | Mean SHAP | Giá trị ảnh hưởng | Hướng | Diễn giải |
|:---:|---------|------------:|----------:|-------------------|-------|-----------|
| 1 | `arrival_season_Summer` | 0,046 | −0,005 | = **Summer** | ↓ nhẹ (trung bình) | Tín hiệu mùa mạnh nhất trong 4 mùa |
| 2 | `arrival_season_Winter` | 0,026 | −0,002 | = **Winter** | ↓ nhẹ | Yếu hơn Summer |
| 3 | `arrival_season_Autumn` | 0,021 | ~0 | = **Autumn** | Gần trung tính | Đóng góp nhỏ |
| 4 | `arrival_season_Spring` | 0,018 | ~0 | = **Spring** | Gần trung tính | Yếu nhất trong 4 mùa |

Summer là tín hiệu mùa mạnh nhất; tổng mean \|SHAP\| bốn mùa (~0,112) vẫn yếu hơn Financial / Trip — phù hợp vai trò **bổ sung**, không thay thế `arrival_month_mapped`.

### 5.6 Dependence plots (4 biến engineered mạnh)


![SHAP Dependence plots](./figures/09_1/chart_07.png)

Cho thấy quan hệ **giá trị feature → SHAP** (phi tuyến): ví dụ `price_per_person` thấp đẩy P(hủy) lên; `history_cancel_rate` > 0 tạo cụm SHAP dương rõ.

### 5.7 Beeswarm toàn cục (top 15)


![SHAP Beeswarm — Top 15 toàn cục](./figures/09_1/chart_08.png)

Bổ sung góc nhìn ngoài biến engineered: `lead_time`, `country`, `market_segment` vẫn nằm trong nhóm tín hiệu mạnh nhất.

### 5.8 Waterfall — 2 ví dụ booking


![SHAP Waterfall — P(hủy) cao / thấp](./figures/09_1/chart_09.png)

Giải thích **local**: booking P(hủy) cao bị đẩy bởi tổ hợp lead time / segment / lịch sử hủy; booking P(hủy) thấp được kéo xuống bởi tín hiệu “an toàn” (giá/người, special requests, kênh Direct, …).

### 5.9 Mean |SHAP| top 15 toàn cục


![SHAP bar — Top 15 toàn cục](./figures/09_1/chart_10.png)

Đối chiếu với gain importance (mục 4): ranking có thể khác vì gain đo chất lượng split, SHAP đo đóng góp trung bình có dấu trên mẫu.

---

## 6. Kết luận

### Điểm mạnh v2.1

1. **Recall Hủy 0,952** — vượt v2 (0,899) và RF v1.2 (0,94); phù hợp inventory protection.
2. **ROC-AUC 0,872** — ngang / nhỉnh hơn v2 (0,871).
3. Artifact **draft → promote** giúp thử params mới mà không mất bản tốt.
4. `arrival_season` + `scale_pos_weight` + ngưỡng 0,28 tạo thành bộ đòn bẩy Recall rõ ràng.
5. Bộ SHAP mở rộng (dependence, waterfall, season, toàn cục) hỗ trợ giải thích nghiệp vụ tốt hơn v2.

### Hạn chế

1. **Precision thấp hơn v2** (0,43 vs 0,49) → nhiều cảnh báo giả.
2. **Accuracy 0,63** thấp hơn v2 (0,71) — không dùng Accuracy làm tiêu chí chính khi class lệch.
3. Tune theo `roc_auc` không tối ưu trực tiếp Recall/Precision tại ngưỡng cố định.
4. SHAP / gain **không phải nhân quả** — cần A/B trước khi đổi chính sách.

### Khuyến nghị

| Ưu tiên | Hành động |
|--------|-----------|
| 1 | Dùng v2.1 khi mục tiêu là **không bỏ sót hủy** (overbooking / hold inventory) |
| 2 | Giữ `RUN_TUNING=False` khi inference; chỉ bật khi muốn thử draft mới |
| 3 | Nếu cần cân bằng Precision: dùng **v2 @ 0,35** hoặc v2.1 @ ngưỡng 0,35–0,50 |
| 4 | Rule: `history_cancel_rate` > 0 + Online TA → xác nhận chặt (SHAP) |

---

## 7. Tài liệu liên quan

| Tài liệu | Nội dung |
|----------|----------|
| `models/.../09_cancellation_model_v2_1.ipynb` | Notebook đầy đủ (SHAP mục 8–8b) |
| `artifacts/best_params_v2_1.json` | Best params production |
| `reports/figures/09_1/` | Hình báo cáo (chart_01 … chart_10) |
| [09_cancellation_model_v2.md](09_cancellation_model_v2.md) | LightGBM v2 |
| [13_cancellation_model_version_selection.md](13_cancellation_model_version_selection.md) | Lựa chọn giữa các phiên bản |
| [08_cancellation_model_v1_2.md](08_cancellation_model_v1_2.md) | RF v1.2 |
