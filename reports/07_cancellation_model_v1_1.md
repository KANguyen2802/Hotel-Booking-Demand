# Báo cáo mô hình dự đoán hủy phòng — Random Forest v1.1

> **Nguồn dữ liệu:** `hotel_bookings_v5.csv`  
> **Phạm vi:** 82.811 booking | Tỷ lệ hủy tổng thể: **28,12%** (~23.284 booking bị hủy)  
> **Notebook tham chiếu:** `07_cancellation_model_v1_1.ipynb`  
> **Thuật toán:** `RandomForestClassifier` (scikit-learn)  
> **Ngưỡng phân loại:** **0,35** (`P(hủy) >= 0,35` → dự đoán Hủy)

---

## 1. Mục tiêu & khác biệt so với v1

v1.1 mở rộng baseline v1 bằng:

1. **3 biến số:** `lead_time`, `total_of_special_requests`, `previous_cancellations`
2. **Ngưỡng 0,35** thay vì 0,50 — hạ ngưỡng để tăng độ nhạy bắt booking có nguy cơ hủy

| Tiêu chí | v1 | **v1.1** |
|----------|-----|----------|
| Số feature | 6 (phân loại) | **9** (6 phân loại + 3 số) |
| Ngưỡng | 0,50 | **0,35** |
| ROC-AUC (test) | 0,734 | **0,831** |
| Recall — Hủy @ ngưỡng chính | 0,85 @ 0,50 | **0,94 @ 0,35** |

---

## 2. Thiết kế mô hình

### 2.1 Feature (9 biến)

| Biến | Kiểu | Xử lý |
|------|------|--------|
| `deposit_type`, `market_segment`, `country`, `distribution_channel`, `customer_type`, `hotel` | Phân loại | One-Hot Encoding |
| `lead_time` | Số nguyên | Passthrough |
| `total_of_special_requests` | Số nguyên | Passthrough |
| `previous_cancellations` | Số nguyên | Passthrough |

`ColumnTransformer`: nhánh `cat` (One-Hot, `min_frequency=5`) + nhánh `num` (passthrough). Random Forest không cần chuẩn hóa scale.

### 2.2 Chống data leakage

Giữ nguyên nguyên tắc v1: không nạp `reservation_status`, `revenue`, `Occupancy_Rate`, `RevPAR`; split trước fit encoder; category hiếm học từ train.

**Lưu ý diễn giải:** `previous_cancellations` là **lịch sử khách** (có tại thời điểm đặt), không phải leakage của booking hiện tại. `lead_time` và `total_of_special_requests` đều biết khi đặt phòng.

### 2.3 Ngưỡng 0,35

```text
y_pred = 1  nếu  P(hủy) >= 0.35
```

**Ý nghĩa kinh doanh:** Chấp nhận gắn nhãn “có nguy cơ hủy” sớm hơn → **tăng Recall**, giảm FN (bỏ sót booking sẽ hủy), đổi lại **tăng FP** so với ngưỡng cao hơn.

---

## 3. Kết quả đánh giá (tập test — 16.563 booking)

### 3.1 Chỉ số tổng hợp @ ngưỡng 0,35

| Chỉ số | Giá trị | Diễn giải |
|--------|--------:|-----------|
| **ROC-AUC (test)** | **0,831** | **Tốt** — cải thiện ~+0,10 so với v1 |
| **CV ROC-AUC (5-fold)** | **0,829 ± 0,004** | Ổn định, generalize tốt |
| **Accuracy** | 0,60 | Vẫn thấp do class lệch; không dùng làm metric chính |
| **Precision — Hủy** | 0,41 | ~41% dự đoán hủy là đúng |
| **Recall — Hủy** | **0,94** | Bắt ~94% booking thực sự hủy |
| **F1 — Hủy** | 0,57 | @ 0,35 |
| **Precision — Không hủy** | 0,95 | Rất cao khi dự đoán không hủy |
| **Recall — Không hủy** | 0,47 | ~53% booking không hủy bị gán nhầm “hủy” |

### 3.2 So sánh ngưỡng 0,35 vs 0,50 (cùng mô hình v1.1)

| Metric (class Hủy) | @ 0,50 | @ **0,35** |
|--------------------|-------:|-----------:|
| F1 | **0,600** | 0,570 |
| Recall (từ CM) | 0,82 | **0,94** |
| FN (bỏ sót hủy) | ~822 | **~273** |

**Kết luận ngưỡng:** 0,35 **không tối ưu F1** nhưng **giảm mạnh FN** (273 vs 822) — phù hợp chiến lược **ưu tiên không bỏ sót hủy** (overbooking / inventory protection). Nếu cần cân bằng P/R, cân nhắc 0,45–0,50.

### 3.3 Ma trận nhầm lẫn @ 0,35

|  | Dự đoán: Không hủy | Dự đoán: Hủy |
|--|--:|--:|
| **Thực tế: Không hủy** | TN = 5.552 | FP = 6.354 |
| **Thực tế: Hủy** | FN = 273 | TP = 4.384 |

---

## 4. Feature importance analysis

### 4.1 Top 20 feature (sau tiền xử lý)

| Hạng | Feature | Importance | Biến gốc |
|:---:|---------|----------:|----------|
| 1 | `lead_time` | 0,211 | `lead_time` |
| 2 | `market_segment_Online TA` | 0,132 | `market_segment` |
| 3 | `country_PRT` | 0,110 | `country` |
| 4 | `total_of_special_requests` | 0,100 | `total_of_special_requests` |
| 5 | `market_segment_Offline TA/TO` | 0,073 | `market_segment` |
| 6 | `customer_type_Transient` | 0,046 | `customer_type` |
| 7 | `distribution_channel_TA/TO` | 0,045 | `distribution_channel` |
| 8 | `customer_type_Transient-Party` | 0,032 | `customer_type` |
| 9 | `previous_cancellations` | 0,030 | `previous_cancellations` |
| 10 | `deposit_type_No Deposit` | 0,028 | `deposit_type` |

**Nhận xét:** `lead_time` vươn lên **#1** sau khi bổ sung biến số — khớp hypothesis (Mann-Whitney, r ≈ 0,30). `total_of_special_requests` top 4 (nhiều yêu cầu → ít hủy). `previous_cancellations` có vai trò nhỏ hơn nhưng vẫn vào top 10.

### 4.2 Gom nhóm theo biến gốc (tổng Gini importance)

| Hạng | Biến gốc | Tổng importance | % trong tổng | Đánh giá |
|:---:|----------|----------------:|-------------:|----------|
| 1 | **`market_segment`** | 0,248 | 24,8% | Vẫn quan trọng nhất trong nhóm phân loại |
| 2 | **`lead_time`** | 0,211 | 21,1% | **Lever hành vi mạnh nhất** — đặt trước xa → rủi ro cao |
| 3 | **`country`** | 0,175 | 17,5% | Thị trường nguồn (PRT nổi bật) |
| 4 | **`total_of_special_requests`** | 0,100 | 10,0% | Cam kết / nhu cầu cụ thể → giảm rủi ro |
| 5 | **`customer_type`** | 0,088 | 8,8% | Transient rủi ro hơn Contract/Group |
| 6 | **`distribution_channel`** | 0,076 | 7,6% | OTA (TA/TO) vs Direct |
| 7 | **`deposit_type`** | 0,055 | 5,5% | Non Refund cực kỳ đặc thù (xem segment) |
| 8 | **`previous_cancellations`** | 0,030 | 3,0% | Lịch sử hủy — tín hiệu phụ |
| 9 | **`hotel`** | 0,018 | 1,8% | City Hotel hủy cao hơn Resort |

**So với v1:** `lead_time` chiếm ~21% importance (trước đó không có); `market_segment` giảm tỷ trọng tương đối nhưng vẫn #1; `country` vẫn top 3.

---

## 5. Segment cancellation rate

Tỷ lệ hủy **thực tế** (`is_canceled`) theo từng nhóm — đối chiếu với feature importance và hỗ trợ hành động revenue management.

### 5.1 `lead_time` (ngày đặt trước đến)

| Nhóm | Số booking | Tỷ lệ hủy |
|------|----------:|----------:|
| 0–30 ngày | 33.039 | **16,8%** |
| 31–60 | 12.776 | 32,2% |
| 61–90 | 8.967 | 33,2% |
| 91–180 | 17.355 | 36,0% |
| > 180 | 10.674 | **41,7%** |

**Đánh giá:** Gradient rõ — lead time dài gấp ~2,5 lần rủi ro so với đặt trong 30 ngày. Khớp importance #2 của mô hình.

### 5.2 `market_segment`

| Segment | n | Tỷ lệ hủy |
|---------|--:|----------:|
| Online TA | 50.391 | **35,5%** |
| Groups | 3.690 | 31,2% |
| Offline TA/TO | 12.860 | 15,1% |
| Direct | 11.351 | 14,9% |
| Corporate | 3.678 | **12,8%** |
| Complementary | 619 | 13,1% |

**Đánh giá:** Online TA là **nguồn rủi ro chính** (~36% trên mức TB 28%). Corporate/Direct ổn định hơn — phù hợp chính sách cọc/confirmation khác nhau theo segment.

### 5.3 `distribution_channel`

| Kênh | n | Tỷ lệ hủy |
|------|--:|----------:|
| TA/TO | 65.956 | **31,5%** |
| GDS | 172 | 19,8% |
| Direct | 12.291 | 15,1% |
| Corporate | 4.387 | **13,6%** |

### 5.4 `customer_type`

| Loại khách | n | Tỷ lệ hủy |
|------------|--:|----------:|
| Transient | 69.939 | **30,4%** |
| Transient-Party | 9.294 | 15,8% |
| Contract | 3.068 | 16,5% |
| Group | 510 | **10,6%** |

### 5.5 `hotel`

| Khách sạn | n | Tỷ lệ hủy |
|-----------|--:|----------:|
| City Hotel | 50.686 | **30,7%** |
| Resort Hotel | 32.125 | 24,1% |

### 5.6 `deposit_type`

| Loại cọc | n | Tỷ lệ hủy |
|----------|--:|----------:|
| No Deposit | 81.767 | 27,3% |
| Non Refund | 963 | **95,0%** |
| Refundable | 81 | 28,4% |

**Cảnh báo:** Non Refund ~95% hủy — có thể phản ánh **chính sách đặc biệt / gán nhãn** hơn là hành vi khách điển hình; cần thận trọng khi diễn giải nhân quả.

### 5.7 `total_of_special_requests`

| Số yêu cầu đặc biệt | n | Tỷ lệ hủy |
|---------------------|--:|----------:|
| 0 | 40.983 | **34,3%** |
| 1 | 27.860 | 22,9% |
| 2 | 11.384 | 21,4% |
| 3+ | 2.584 | **16,4%** |

**Đánh giá:** Càng nhiều special request → càng cam kết → hủy giảm. Hỗ trợ khuyến khích upsell / personalization có thể giảm rủi ro.

### 5.8 `previous_cancellations`

| Lịch sử hủy trước | n | Tỷ lệ hủy |
|-------------------|--:|----------:|
| 0 | 81.255 | 27,4% |
| 1 | 1.303 | **76,4%** |
| 2+ | 253 | 22,9% |

**Đánh giá:** Khách từng hủy đúng 1 lần có tỷ lệ hủy rất cao; nhóm 2+ sample nhỏ (253) — không ổn định thống kê.

### 5.9 `country` (top 10 theo volume)

| Quốc gia | n | Tỷ lệ hủy |
|----------|--:|----------:|
| PRT | 25.299 | **36,8%** |
| BRA | 1.936 | 36,8% |
| ITA | 2.900 | 36,1% |
| ESP | 6.973 | 26,2% |
| GBR | 9.921 | 19,6% |
| FRA | 8.464 | 20,1% |

**Đánh giá:** PRT (Bồ Đào Nha) — thị trường nội địa lớn nhất — hủy cao hơn TB; GBR/FRA tương đối ổn định.

---

## 6. Trực quan hóa & đánh giá biểu đồ

### 6.1 Confusion Matrix (@ 0,35)

- **Đánh giá:** Cho thấy chiến lược ngưỡng thấp — FN chỉ 273 nhưng FP 6.354. Phù hợp mục tiêu “bắt hầu hết booking sẽ hủy”, không phù hợp nếu mỗi cảnh báo đều tốn chi phí can thiệp.

### 6.2 ROC Curve (AUC = 0,831)

- **Đánh giá:** Cải thiện rõ so với v1 (0,734). Mô hình **xếp hạng rủi ro tốt**; ngưỡng 0,35 là điểm cắt trên đường ROC, không làm thay đổi AUC.
- **Gợi ý:** Kết hợp ROC với **Precision-Recall curve** nếu cần tối ưu ngưỡng theo chi phí FP/FN.

### 6.3 Prediction Probability Distribution (Histogram + KDE)

- **Quy ước màu:** teal = Không hủy · orange = Hủy · đường đứt nét = **ngưỡng 0,35**.
- **Đánh giá:** Hai phân phối **tách lớp tốt hơn v1** (AUC cao hơn). Vẫn có overlap vùng 0,25–0,55 — bình thường với dữ liệu hành vi. Median `P(hủy)` nhóm thực sự hủy cao hơn nhóm không hủy (xem notebook).
- **Ngưỡng 0,35:** Nằm trong vùng overlap → tăng Recall nhưng kéo theo nhiều FP từ phân phối “Không hủy”.

### 6.4 Feature Importance (bar chart top 20 + bảng gom nhóm)

- **Đánh giá:** Xác nhận `lead_time` và `market_segment` là hai trục chính; hỗ trợ ưu tiên can thiệp (chính sách lead time, OTA segment, incentive special requests).

---

## 7. Kết luận tổng thể

### Điểm mạnh v1.1

1. **ROC-AUC 0,831** — mức **tốt**, sẵn sàng cho giai đoạn pilot / scoring nội bộ.
2. Bổ sung biến số giúp mô hình **giải thích được** và khớp EDA (lead time, special requests).
3. Ngưỡng **0,35** phù hợp bài toán **giảm bỏ sót hủy** (Recall 94%).
4. Segment analysis chỉ ra **Online TA, City Hotel, PRT, lead time > 180 ngày** là nhóm ưu tiên can thiệp.

### Hạn chế & rủi ro

1. **Precision thấp** (~41%) @ 0,35 — nhiều booking không hủy bị flag.
2. `deposit_type_Non Refund` và segment cực nhỏ (Undefined, 2+ cancellations) — dễ nhiễu.
3. Random Forest importance **không phải causal** — cần đối chiếu A/B hoặc chính sách trước khi triển khai.
4. Chưa tune hyperparameter / chưa calibration xác suất (Platt / isotonic).

### Khuyến nghị hành động

| Ưu tiên | Hành động | Segment / feature liên quan |
|--------|-----------|----------------------------|
| 1 | Chính sách cọc / xác nhận chặt hơn cho **Online TA** + **lead time > 90 ngày** | `market_segment`, `lead_time` |
| 2 | Theo dõi riêng khách **PRT** và **previous_cancellations = 1** | `country`, lịch sử |
| 3 | Khuyến khích **special requests** / bundle dịch vụ | `total_of_special_requests` |
| 4 | Pilot scoring: `P(hủy) >= 0,35` → alert RM; đo FP cost thực tế | Ngưỡng v1.1 |

---

## 8. Tài liệu liên quan

| Tài liệu | Nội dung |
|----------|----------|
| `07_cancellation_model_v1_1.ipynb` | Notebook đầy đủ |
| [06_cancellation_model_v1.md](06_cancellation_model_v1.md) | Baseline phân loại |
| [05_hypothesis_testing_is_canceled.md](05_hypothesis_testing_is_canceled.md) | Kiểm định lead_time, deposit, segment |
| [04_correlation_analysis_is_canceled.md](04_correlation_analysis_is_canceled.md) | Tier feature & leakage |
