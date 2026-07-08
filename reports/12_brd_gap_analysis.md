# BRD Gap Analysis — 4 hạng mục ưu tiên

> **Loại:** Phân tích bổ sung BRD v1.1 → đầu vào BRD v1.2
> **Notebook:** `notebooks/12_brd_gap_analysis.ipynb`
> **Dữ liệu:** `hotel_bookings_v5.csv` — **82.811** booking
> **Tạo lúc:** 08/07/2026 18:56

---

## 1. Interaction 3 chiều (Lead time × Segment × Mùa vụ)

**Filter:** `market_segment = Online TA` AND `lead_time > 90` AND tháng đến Jul–Aug.

| Chỉ số | Giá trị |
|--------|--------:|
| Số booking | 7.168 |
| Booking hủy | 3.343 |
| **Tỷ lệ hủy** | **46,64%** |
| Doanh thu mất (ADR × đêm) | 2.545.221 € |
| **% trong tổng doanh thu mất** | **22,63%** |
| Mean ADR booking hủy (nhóm này) | 148,20 € |

**Bổ sung BR-REV-02** (Online TA × TA/TO × lead_time > 60 × Jul–Aug):

| Chỉ số | Giá trị |
|--------|--------:|
| Số booking | 8.574 |
| Tỷ lệ hủy | 45,77% |
| Doanh thu mất | 2.950.749 € |
| % tổng doanh thu mất | 26,24% |

![Tỷ lệ hủy tổ hợp rủi ro](figures/12/chart_02_cancel_rate_hotspots.png)

---

## 2. Revenue Loss (Doanh thu tiềm năng mất do hủy)

**Định nghĩa:** `booking_revenue = ADR × total_nights` với booking `is_canceled = 1` và ADR > 0.

| Chỉ số | Giá trị |
|--------|--------:|
| Tổng doanh thu mất | **11.245.770 €** |
| Doanh thu thực hiện (không hủy) | 22.089.704 € |
| Doanh thu tiềm năng (toàn bộ) | 33.335.473 € |
| **Tỷ lệ mất / tiềm năng** | **33,74%** |
| Số booking hủy có ADR > 0 | 23.112 |
| Mean mất / booking hủy | 486,58 € |
| Mean mất / đêm (toàn năm) | 120,45 € |
| Mean mất / đêm (Jul–Aug) | **155,21 €** |

### Theo khách sạn

| Hotel | Doanh thu mất | Booking hủy |
|-------|-------------:|------------:|
| City Hotel | 6.467.692 € | 15.451 |
| Resort Hotel | 4.778.077 € | 7.661 |

![Doanh thu mất theo tháng](figures/12/chart_01_revenue_loss_by_month.png)

---

## 3. Room Mis-match — Upgrade vs Downgrade

**Phạm vi:** Booking lưu trú thành công (`is_canceled = 0`, ADR > 0).

| Chỉ số | Giá trị |
|--------|--------:|
| Tỷ lệ không khớp phòng | 17,95% |
| ADR trung bình — khớp phòng | 109,20 € |
| ADR trung bình — không khớp | 90,96 € |
| Chênh lệch (khớp − không khớp) | 18,24 € |

### Phân loại chuyển phòng (reserved → assigned)

| Loại | Booking | Mean ADR | Mean rank Δ |
|------|--------:|---------:|------------:|
| downgrade | 518 | 120,88 € | -2.28 |
| lateral | 4 | 203,00 € | 0.00 |
| upgrade | 9.902 | 89,35 € | 2.83 |

| Chỉ số bổ sung | Giá trị |
|----------------|--------:|
| Upgrade (rank tăng) | 9.902 (94,99% mis-match) |
| Downgrade (rank giảm) | 518 |
| Lateral (cùng hạng, khác mã) | 4 |
| **Free Upgrade proxy** (đặt A/B → nhận cao hơn) | **8.393** (80,52% mis-match) |

**Kết luận:** Phần lớn mis-match là **upgrade** — đặc biệt nhóm đặt phòng Standard (A/B) được chuyển lên hạng cao hơn mà ADR vẫn giữ giá đặt ban đầu → **free upgrade vận hành** chiếm ưu thế, không phải lỗi hệ thống thuần túy.

![Room mis-match](figures/12/chart_03_room_mismatch.png)

---

## 4. Deposit Simulation

**Kịch bản BRD:** Cọc bắt buộc 1 đêm cho `Online TA` + `lead_time > 30 ngày`.
**Giả định:** Tỷ lệ hủy giảm **30%**; volume booking giảm **10%** (khách ngại cọc).

| Chỉ số | Hiện tại | Sau chính sách |
|--------|--------:|---------------:|
| Số booking | 32.491 | 29.242 |
| Tỷ lệ hủy | 43,23% | 30,26% |
| Net Revenue (chỉ lưu trú) | 8.586.544 € | 10.110.239 € |
| **Δ Net Revenue** | — | **1.523.695 €** (17,7%) |

**Kịch bản mở rộng:** Giữ 80% cọc 1 đêm từ booking check-in thành công → Net Revenue tổng **12.069.093 €** (**3.482.549 €**, 40,6% so với hiện tại).

![Deposit simulation](figures/12/chart_04_deposit_simulation.png)

---

## 5. Liên kết BRD

- Cập nhật mục **3.4** BRD v1.1 — đánh dấu 3 câu hỏi DA đã có số liệu.
- Bổ sung baseline **Revenue Loss** cho **OB-01**.
- Củng cố **BR-REV-01**, **BR-REV-02**, **BR-OPS-01** bằng số liệu định lượng.
- Chi tiết BRD v1.2: [`12_brd_v1_2.md`](12_brd_v1_2.md)
