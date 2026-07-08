# Báo cáo cancellation probability scores — theo booking

> **Tạo lúc:** 08/07/2026 12:13  
> **Mô hình:** LightGBM v2 (Optuna tuned) — `09_cancellation_model_v2.ipynb`  
> **Dữ liệu:** `hotel_bookings_v5.csv` — **82,811** booking  
> **Ngưỡng phân loại:** **0.35**  
> **File đầy đủ:** `data/11_cancellation_probability_scores.csv`

---

## 1. Mục tiêu

Xuất **xác suất hủy dự đoán** `P(hủy)` cho **toàn bộ booking** trong dataset, phục vụ scoring / ưu tiên can thiệp.

**Lưu ý:** Dataset không có cột `booking_id` — dùng **`booking_index`** (chỉ số dòng 0-based trong file CSV gốc) làm khóa tham chiếu.

## 2. Cột trong file CSV

| Cột | Mô tả |
|-----|--------|
| `booking_index` | Chỉ số dòng trong `hotel_bookings_v5.csv` |
| `cancellation_probability` | P(hủy) từ mô hình (0–1) |
| `predicted_cancel` | 1 nếu P(hủy) ≥ 0,35 |
| `actual_cancel` | Nhãn thực tế `is_canceled` |
| `risk_bucket` | Phân nhóm rủi ro (xem mục 3) |

## 3. Thống kê tổng quan P(hủy)

| Chỉ số | Giá trị |
|--------|--------:|
| Mean P(hủy) | 0.4037 |
| Median P(hủy) | 0.3640 |
| Std | 0.3049 |
| Min / Max | 0.0011 / 0.9999 |
| P25 / P75 | 0.1189 / 0.6740 |
| Booking dự đoán Hủy @ 0,35 | 42,517 (51.3%) |
| Tỷ lệ hủy thực tế | 28.12% |

### Phân nhóm rủi ro

| Nhóm | Số booking | Mean P(hủy) | Tỷ lệ hủy thực tế |
|------|----------:|------------:|------------------:|
| Cao (0.35–0.55) | 13,957 | 0.4462 | 24.1% |
| Rất cao (≥0.55) | 28,560 | 0.7660 | 64.0% |
| Thấp (<0.20) | 28,203 | 0.0716 | 1.7% |
| Trung bình (0.20–0.35) | 12,091 | 0.2737 | 9.5% |

## 4. Mẫu 15 booking rủi ro cao nhất

| booking_index | P(hủy) | Dự đoán | Thực tế |
|:-------------:|-------:|:-------:|:-------:|
| 50116 | 0.9999 | 1 | 1 |
| 53347 | 0.9999 | 1 | 1 |
| 50627 | 0.9999 | 1 | 1 |
| 50327 | 0.9999 | 1 | 1 |
| 50329 | 0.9999 | 1 | 1 |
| 50229 | 0.9999 | 1 | 1 |
| 50536 | 0.9999 | 1 | 1 |
| 50115 | 0.9999 | 1 | 1 |
| 50579 | 0.9999 | 1 | 1 |
| 50338 | 0.9999 | 1 | 1 |
| 50331 | 0.9999 | 1 | 1 |
| 53511 | 0.9999 | 1 | 1 |
| 50149 | 0.9999 | 1 | 1 |
| 52253 | 0.9999 | 1 | 1 |
| 11248 | 0.9999 | 1 | 1 |

## 5. Cách sử dụng

1. Join `booking_index` với bản ghi gốc để lấy thông tin chi tiết booking.
2. Sắp xếp giảm dần `cancellation_probability` để ưu tiên can thiệp.
3. Kết hợp với báo cáo `11_cancellation_probability_by_variable.md` để hiểu driver theo segment.

---

*Sinh tự động bởi `_run_11_probability_reports.py`.*