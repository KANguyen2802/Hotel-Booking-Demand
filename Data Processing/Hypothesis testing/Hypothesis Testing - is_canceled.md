# Kiểm định giả thuyết: Ảnh hưởng đến `is_canceled`

> **Nguồn dữ liệu:** `hotel_bookings_v5.csv` (tái tạo từ v4 + `day_of_week`)  
> **Phạm vi:** 82.811 booking | Tỷ lệ hủy tổng thể: **28,12%** (~23.284 booking bị hủy)  
> **Notebook tham chiếu:** `hypothesis.ipynb`  
> **Mức ý nghĩa:** α = 0,05

---

## Mục tiêu

Kiểm định thống kê xem ba biến **`lead_time`**, **`deposit_type`** và **`market_segment`** có ảnh hưởng đến xác suất hủy phòng (`is_canceled`) hay không, bằng các test phù hợp với kiểu dữ liệu từng biến. Bổ sung mô hình **logistic regression** đa biến để đánh giá đồng thời khi đã kiểm soát các yếu tố còn lại.

---

## Tóm tắt phương pháp

| Biến | Kiểu dữ liệu | Test chính | Effect size | Mục đích |
|------|--------------|------------|-------------|----------|
| `lead_time` | Số (liên tục, lệch phải) | Mann-Whitney U | Rank-biserial *r* + bootstrap CI | So sánh phân bố lead_time giữa booking hủy / không hủy |
| `lead_time` (bin) | Phân loại (5 nhóm) | Chi-squared | Cramér's V | Kiểm tra tỷ lệ hủy khác nhau theo nhóm lead_time |
| `deposit_type` | Phân loại (3 mức) | Chi-squared | Cramér's V | Kiểm tra độc lập giữa loại cọc và trạng thái hủy |
| `market_segment` | Phân loại (8 mức) | Chi-squared | Cramér's V | Kiểm tra độc lập giữa phân khúc và trạng thái hủy |
| 3 biến đồng thời | Hỗn hợp | Logistic regression | Odds ratio, Pseudo R² | Mô hình đa biến + LR test |

**Lưu ý phương pháp:** Với *n* ≈ 82.811, p-value rất dễ nhỏ hơn α ngay cả khi chênh lệch nhỏ — cần đọc kết quả kèm **effect size** (rank-biserial *r*, Cramér's V, OR).

---

## Kết quả tổng hợp

| Giả thuyết | Biến | Test | p-value | Effect size | Kết luận (α = 0,05) |
|---|---|---|---|---:|---|
| H1 | `lead_time` | Mann-Whitney U | ≈ 0 | \|r\| = 0,299 | **Bác bỏ H₀** |
| H1b | `lead_time_bin` | Chi-squared | ≈ 0 | V = 0,213 | **Bác bỏ H₀** |
| H2 | `deposit_type` | Chi-squared | ≈ 0 | V = 0,161 | **Bác bỏ H₀** |
| H3 | `market_segment` | Chi-squared | ≈ 0 | V = 0,219 | **Bác bỏ H₀** |
| H4 | 3 biến đồng thời | Logistic (LR test) | ≈ 0 | Pseudo R² = 0,094 | **Bác bỏ H₀** |

---

## H1 — `lead_time` (Mann-Whitney U)

**H₀:** Phân bố `lead_time` giống nhau giữa booking hủy và không hủy.  
**H₁:** Hai phân bố khác nhau.

| Thống kê | Giá trị |
|---|---:|
| U statistic | 900.561.203 |
| p-value | ≈ 0 |
| Rank-biserial *r* | 0,299 |
| Median — không hủy | 37 ngày |
| Median — đã hủy | 79 ngày |
| Mean — không hủy | 68,2 ngày |
| Mean — đã hủy | 104,9 ngày |

**Diễn giải:**

- Booking **đã hủy** có `lead_time` cao hơn rõ rệt: median gấp **~2.1 lần** (79 vs 37 ngày).
- Effect size \|r\| = 0,299 → mức ảnh hưởng **trung bình** (theo quy ước \|r\| ≈ 0,1 / 0,3 / 0,5 cho nhỏ / TB / lớn).
- Bootstrap 95% CI cho chênh median (hủy − không hủy) dương và không chứa 0 → xác nhận chênh lệch có ý nghĩa thực tế.

**Kết luận:** Bác bỏ H₀ — `lead_time` có association với `is_canceled`; đặt trước càng xa ngày đến, rủi ro hủy càng cao.

---

## H1b — `lead_time_bin` (Chi-squared)

**H₀:** Nhóm lead_time bin và `is_canceled` độc lập.  
**H₁:** Tỷ lệ hủy khác nhau giữa các bin.

| Thống kê | Giá trị |
|---|---:|
| χ² | 3764,0 |
| df | 4 |
| p-value | ≈ 0 |
| Cramér's V | 0,213 |
| Min expected count | 2521,3 |

**Tỷ lệ hủy theo bin:**

| Lead time bin | Booking | Tỷ lệ hủy |
|---|---:|---:|
| 0–30 ngày | 33.039 | **16,8%** |
| 31–60 ngày | 12.776 | **32,2%** |
| 61–90 ngày | 8.967 | **33,2%** |
| 91–180 ngày | 17.355 | **35,6%** |
| >180 ngày | 10.674 | **41,7%** |

**Diễn giải:**

- Bước nhảy lớn nhất: từ bin **0–30** (17%) lên **31–60** (32%) — gần **gấp đôi**.
- Tỷ lệ hủy tăng dần theo bin; Cramér's V = 0,213 → association **trung bình–khá** (mạnh nhất trong các test chi-squared trên lead_time).

**Kết luận:** Bác bỏ H₀ — nhóm lead_time có ảnh hưởng đến tỷ lệ hủy.

---

## H2 — `deposit_type` (Chi-squared)

**H₀:** `deposit_type` và `is_canceled` độc lập.  
**H₁:** Có association giữa loại cọc và tỷ lệ hủy.

| Thống kê | Giá trị |
|---|---:|
| χ² | 2157,5 |
| df | 2 |
| p-value | ≈ 0 |
| Cramér's V | 0,161 |
| Min expected count | 22,8 |

**Tỷ lệ hủy theo loại cọc:**

| Loại cọc | Booking | Tỷ lệ hủy |
|---|---:|---:|
| Non Refund | 963 | **95,0%** |
| Refundable | 81 | 28,4% |
| No Deposit | 81.767 | **27,3%** |

**Diễn giải:**

- **98,7%** booking là *No Deposit* → rủi ro hủy mang tính hệ thống ở nhóm không cọc.
- *Non Refund* có tỷ lệ hủy 95,0% cần diễn giải thận trọng: có thể **reverse causality** (booking rủi ro cao mới bị gán non-refundable) hoặc do cách ghi nhận dữ liệu — không nên coi là tác động nhân quả đơn thuần.
- Ô *Refundable* (n = 81) có expected count thấp → kết quả chi-squared tổng thể vẫn hợp lệ nhưng post-hoc cho nhóm này cần thận trọng.

**Kết luận:** Bác bỏ H₀ — `deposit_type` liên quan đến `is_canceled` (V = 0,161, mức trung bình).

---

## H3 — `market_segment` (Chi-squared)

**H₀:** `market_segment` và `is_canceled` độc lập.  
**H₁:** Có association giữa phân khúc thị trường và tỷ lệ hủy.

| Thống kê | Giá trị |
|---|---:|
| χ² | 3960,4 |
| df | 7 |
| p-value | ≈ 0 |
| Cramér's V | 0,219 |
| Min expected count | 0,56 |

**Tỷ lệ hủy theo segment (sắp giảm dần):**

| Segment | Booking | Tỷ lệ hủy |
|---|---:|---:|
| Undefined | 2 | 100,0% |
| Online TA | 50.391 | **35,5%** |
| Groups | 3.690 | **31,2%** |
| Aviation | 220 | 19,1% |
| Offline TA/TO | 12.860 | 15,1% |
| Direct | 11.351 | 14,9% |
| Complementary | 619 | 13,1% |
| Corporate | 3.678 | **12,8%** |

**Diễn giải:**

- Cramér's V = 0,219 → association **mạnh nhất** trong ba biến phân loại.
- **Online TA** chiếm ~61% booking và có tỷ lệ hủy cao nhất trong các segment lớn (35,5%).
- **Corporate** có tỷ lệ hủy thấp nhất (12,8%) trong nhóm có sample đủ lớn.
- Segment *Undefined* (n = 2) có expected count rất thấp → standardized residual không đáng tin cậy cho nhóm này.

**Kết luận:** Bác bỏ H₀ — `market_segment` ảnh hưởng đến tỷ lệ hủy.

---

## H4 — Logistic Regression đa biến

**Mô hình:** `is_canceled ~ lead_time + deposit_type + market_segment`  
**Baseline:** `deposit_type = No Deposit`, `market_segment = Direct`

| Thống kê mô hình | Giá trị |
|---|---:|
| n | 82.811 |
| Pseudo R² (McFadden) | 0,094 |
| LR χ² (vs null) | 9228,9 |
| df | 10 |
| p-value (LR test) | ≈ 0 |

**Hệ số đáng chú ý (p < 0,05):**

| Biến | OR (95% CI gần đúng) | Diễn giải |
|---|---|---|
| `lead_time` (+1 ngày) | 1,005 | Mỗi thêm 1 ngày đặt trước → odds hủy tăng ~0,5% |
| `lead_time` (+30 ngày) | **1,158** | Mỗi thêm 30 ngày → odds hủy tăng ~15,8% |
| `deposit_type_Non Refund` | Rất cao | Mạnh liên quan hủy (cần diễn giải thận trọng) |
| `market_segment_Online TA` | > 1 | Xác suất hủy cao hơn baseline Direct |
| `market_segment_Offline TA/TO` | < 1 | Xác suất hủy thấp hơn Direct |
| `market_segment_Corporate` | < 1 | Xác suất hủy thấp hơn Direct |
| `market_segment_Groups` | < 1 | Xác suất hủy thấp hơn Direct |

**Biến không có ý nghĩa (p ≥ 0,05):** `deposit_type_Refundable`, `market_segment_Complementary`, `market_segment_Direct` (đã là baseline ẩn), `market_segment_Undefined`.

**Diễn giải:**

- Mô hình giải thích **~9,4%** biến thiên log-likelihood (Pseudo R²) — hợp lý với bài toán hành vi khách hàng phức tạp; còn nhiều yếu tố chưa đưa vào mô hình.
- Sau khi kiểm soát `deposit_type` và `market_segment`, **`lead_time` vẫn có ý nghĩa** → không phải confounding đơn giản từ hai biến còn lại.
- LR test bác bỏ mô hình null → ít nhất một predictor trong mô hình có giá trị.

**Kết luận:** Bác bỏ H₀ tổng thể — cả ba nhóm biến đều đóng góp vào dự đoán hủy trong mô hình đa biến.

---

## So sánh effect size

| Test | Biến | Metric | Giá trị | Xếp hạng tương đối |
|---|---|---:|---:|---|
| Mann-Whitney U | `lead_time` | \|rank-biserial r\| | 0,299 | Cao |
| Chi-squared | `lead_time_bin` | Cramér's V | 0,213 | Cao |
| Chi-squared | `market_segment` | Cramér's V | 0,219 | **Cao nhất (phân loại)** |
| Chi-squared | `deposit_type` | Cramér's V | 0,161 | Trung bình |
| Logistic | 3 biến | Pseudo R² | 0,094 | Mô hình tổng hợp |

---

## Kết luận chung

1. **`lead_time`** — Booking hủy có thời gian đặt trước dài hơn đáng kể; rủi ro tăng mạnh sau **30 ngày** và tiếp tục tăng theo bin.
2. **`deposit_type`** — Liên quan thống kê rõ đến hủy; *Non Refund* gắn với tỷ lệ hủy cực cao nhưng cần phân tích nhân quả thêm.
3. **`market_segment`** — Ảnh hưởng mạnh nhất trong các biến phân loại; **Online TA** là nguồn rủi ro hủy chính, **Corporate** tương đối ổn định.
4. **Mô hình đa biến** xác nhận cả ba biến vẫn có ý nghĩa (hoặc đóng góp) khi kiểm soát lẫn nhau.

---

## Khuyến nghị hành động

| Ưu tiên | Hành động | Cơ sở từ kiểm định |
|---|---|---|
| Cao | Theo dõi sát booking **lead_time > 30 ngày**, đặc biệt **> 180 ngày** | H1, H1b |
| Cao | Rà soát chính sách / forecast riêng cho **Online TA** | H3, H4 |
| Trung bình | Phân tích sâu nhóm **Non Refund** (nhân quả vs gán nhãn) | H2 |
| Trung bình | Ưu tiên giữ chỗ / giảm overbooking risk cho **Corporate, Direct** | H3 |
| Thấp | Bổ sung biến (`distribution_channel`, `customer_type`, …) vào mô hình v2 | Pseudo R² còn thấp |

---

## Hạn chế

- **Kích thước mẫu lớn** → p-value gần 0 không đồng nghĩa chênh lệch lớn về mặt kinh doanh; luôn kèm effect size.
- **Non Refund** và **Undefined** segment có thể bị confounding / sample nhỏ.
- Kiểm định mô tả **association**, không khẳng định nhân quả thuần túy.
- Logistic regression giả định quan hệ log-linear trên `lead_time`; quan hệ thực tế có thể phi tuyến (đã phản ánh một phần qua bin ở H1b).

---

## Tài liệu liên quan

- `eda_cancellation.ipynb` — EDA trực quan cancellation  
- `Correlation_matrix_is_canceled.ipynb` — Tương quan tổng hợp  
- `EDA Stage 1 - Cancellation Analysis.md` — Báo cáo EDA Stage 1  
- `Correlation Analysis - is_canceled.md` — Báo cáo correlation

---

*Tài liệu được tạo từ kết quả kiểm định trên `hotel_bookings_v5.csv`. Cập nhật lần cuối: 3/7/2026 — Hypothesis Testing (key dedup mới, 82.811 booking).*