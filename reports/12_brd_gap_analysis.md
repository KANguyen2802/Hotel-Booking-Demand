# BRD Gap Analysis — 4 hạng mục ưu tiên

> **Nguồn dữ liệu:** `hotel_bookings_v5.csv` (82.811 booking)  
> **Notebook phân tích:** `notebooks/12_brd_gap_analysis.ipynb`  
> **BRD cập nhật:** `reports/12_brd_v1_2.md`  
> **Cập nhật:** 09/07/2026

---

## Tóm tắt điều hành

Báo cáo bổ sung 4 hạng mục phân tích còn thiếu trong BRD v1.1 (mục 3.4). Kết quả chính:

| Hạng mục | Phát hiện then chốt |
|----------|---------------------|
| Interaction 3 chiều | Online TA + lead > 90 + Jul–Aug: **46,64%** hủy, chiếm **22,63%** tổng doanh thu mất |
| Revenue Loss | Tổng mất **11,25M €** (**33,74%** doanh thu tiềm năng); Jul–Aug đỉnh **4,64M €** |
| Room Mis-match | **17,95%** booking không khớp phòng; **74,9%** mis-match là free upgrade (B/A) |
| Deposit Simulation | Cọc Online TA (lead > 30): **+1,52M €** net revenue (+17,7%), hoặc **+3,48M €** nếu giữ cọc |

---

## 1. Interaction 3 chiều (Lead time × Segment × Mùa vụ)

### 1.1 Mục tiêu

Xác định tổ hợp **market segment × lead time × mùa cao điểm** có tỷ lệ hủy và doanh thu mất vượt trội so với toàn hệ thống — phục vụ BR-REV-01 và BR-REV-02.

### 1.2 Phương pháp

- **Mùa cao điểm:** tháng đến July, August (`is_peak`)
- **Tổ hợp chính:** `market_segment = Online TA` AND `lead_time > 90` AND `is_peak`
- **Tổ hợp BR-REV-02:** `Online TA` × `distribution_channel = TA/TO` × `lead_time > 60` × `is_peak`
- **Doanh thu mất:** `booking_revenue = adr × total_nights` trên booking bị hủy

### 1.3 Kết quả

| Tổ hợp | Booking | Tỷ lệ hủy | Doanh thu mất | % tổng mất |
|--------|--------:|----------:|--------------:|-----------:|
| Online TA + lead>90 + Jul–Aug | 7.168 | **46,64%** | 2.545.221 € | **22,63%** |
| Online TA×TA/TO + lead>60 + Jul–Aug | 8.574 | **45,77%** | 2.950.749 € | **26,24%** |
| Online TA (tổng) | 32.491 | 43,23% | — | — |
| Toàn hệ thống | 82.811 | 28,12% | 11.245.770 € | 100% |

![So sánh tỷ lệ hủy theo tổ hợp rủi ro BRD](./figures/12/chart_02_cancel_rate_hotspots.png)

### 1.4 Diễn giải

- Tổ hợp 3 chiều có tỷ lệ hủy **gấp ~1,66 lần** mức toàn hệ thống (46,64% vs 28,12%).
- Chỉ **8,7%** booking thuộc tổ hợp này nhưng gánh **22,6%** doanh thu mất — đúng định nghĩa “hotspot” trong BRD.
- BR-REV-02 (mở rộng kênh TA/TO, lead > 60) bao phủ thêm booking nhưng vẫn giữ tỷ lệ hủy ~46%.

---

## 2. Revenue Loss

### 2.1 Mục tiêu

Định lượng **doanh thu tiềm năng mất** do hủy phòng theo tháng, khách sạn và mùa — nền tảng cho ưu tiên can thiệp revenue management.

### 2.2 Phương pháp

- Chỉ tính booking hủy có `booking_revenue > 0`
- **Tổng mất** = Σ `booking_revenue` (canceled)
- **% tiềm năng** = tổng mất / Σ `booking_revenue` (toàn bộ booking)

### 2.3 Kết quả tổng hợp

| Chỉ số | Giá trị |
|--------|--------:|
| Doanh thu thực hiện (không hủy) | 22.089.704 € |
| Doanh thu tiềm năng | 33.335.473 € |
| **Tổng doanh thu mất** | **11.245.770 €** |
| Tỷ lệ mất / tiềm năng | **33,74%** |
| Mean mất / booking hủy | 486,58 € |
| Mean mất / đêm (toàn năm) | 120,45 € |
| **Mean mất / đêm Jul–Aug** | **155,21 €** |

### 2.4 Phân bố theo tháng đến

| Tháng | Doanh thu mất (€) | Số booking hủy | Triệu € |
|-------|------------------:|---------------:|--------:|
| January | 364.952 | 992 | 0,36 |
| February | 440.857 | 1.355 | 0,44 |
| March | 615.808 | 1.772 | 0,62 |
| April | 958.009 | 2.317 | 0,96 |
| May | 1.035.783 | 2.341 | 1,04 |
| June | 1.176.864 | 2.294 | 1,18 |
| **July** | **2.036.026** | **3.115** | **2,04** |
| **August** | **2.600.748** | **3.543** | **2,60** |
| September | 690.325 | 1.527 | 0,69 |
| October | 535.608 | 1.533 | 0,54 |
| November | 316.257 | 1.004 | 0,32 |
| December | 474.532 | 1.319 | 0,47 |

![Doanh thu tiềm năng mất theo tháng đến](./figures/12/chart_01_revenue_loss_by_month.png)

### 2.5 Diễn giải

- **Jul–Aug** chiếm **41,2%** tổng doanh thu mất (4,64M € / 11,25M €) dù chỉ ~8 tháng trong năm lịch.
- Mean mất/đêm mùa cao điểm (**155 €**) cao hơn trung bình năm (**120 €**) — hủy mùa hè “đắt” hơn về doanh thu.

---

## 3. Room Mis-match (Upgrade vs Downgrade)

### 3.1 Mục tiêu

Đo lường tỷ lệ booking **không được xếp đúng loại phòng đặt**, phân loại upgrade/downgrade theo **median ADR** (không dùng thứ tự chữ cái A→B→C).

### 3.2 Phương pháp

- Phạm vi: booking **không hủy**, `adr > 0`
- **Xếp hạng phòng:** median ADR theo `reserved_room_type` (fallback `assigned_room_type`)
- **Upgrade:** median ADR phòng được xếp > median ADR phòng đặt
- **Downgrade:** ngược lại
- **Free upgrade proxy:** upgrade từ 2 mã phòng rẻ nhất (theo median ADR reserved): **B, A**

### 3.3 Bảng xếp hạng phòng (median ADR)

| Mã | Rank | Median ADR | Booking reserved |
|----|-----:|-----------:|-----------------:|
| I | 1 | 79,21 € | 0 |
| B | 2 | 87,00 € | 623 |
| A | 3 | 89,00 € | 37.566 |
| K | 4 | 99,00 € | 0 |
| E | 5 | 111,59 € | 4.204 |
| D | 6 | 117,50 € | 11.614 |
| L | 7 | 150,00 € | 3 |
| C | 8 | 160,00 € | 591 |
| F | 9 | 171,45 € | 1.888 |
| H | 10 | 175,00 € | 347 |
| G | 11 | 177,90 € | 1.230 |

> Thứ tự alphabet `ABCDEFGHIKL` **không** khớp thứ tự giá (`IBAKEDLCFHG`).

### 3.4 Kết quả mis-match

| Chỉ số | Giá trị |
|--------|--------:|
| Tỷ lệ mis-match | **17,95%** |
| Upgrade | 8.677 (83,2%) |
| Downgrade | 1.747 (16,8%) |
| Mean ADR (khớp phòng) | 109,20 € |
| Mean ADR (mis-match) | 90,96 € |
| ADR gap (khớp − mis-match) | **18,24 €** |
| Free upgrade (B/A) | **7.812** (**74,9%** mis-match) |

![Phân bố mis-match và ADR theo loại chuyển phòng](./figures/12/chart_03_room_mismatch.png)

### 3.5 Diễn giải

- Phần lớn mis-match là **upgrade** — khách thường được xếp phòng có median ADR cao hơn loại đặt.
- **74,9%** mis-match là free upgrade từ hạng rẻ B/A → chi phí cơ hội inventory chưa được thu qua giá.
- Downgrade (1.747 booking) cần theo dõi riêng vì ảnh hưởng trải nghiệm và khiếu nại.

---

## 4. Deposit Simulation

### 4.1 Mục tiêu

Mô phỏng tác động tài chính nếu áp dụng **chính sách cọc** cho Online TA có lead time > 30 ngày.

### 4.2 Giả định kịch bản

| Tham số | Giá trị |
|---------|--------:|
| Phạm vi | Online TA, `lead_time > 30` |
| Giảm tỷ lệ hủy | **30%** so hiện tại |
| Giảm volume booking | **10%** (khách bỏ qua vì rào cọc) |
| Cọc giữ lại khi hủy | 80% ADR trung bình (kịch bản mở rộng) |

### 4.3 Kết quả

| Kịch bản | Booking | Tỷ lệ hủy | Net Revenue |
|----------|--------:|----------:|------------:|
| Hiện tại | 32.491 | 43,23% | 8.586.544 € |
| Sau cọc (chỉ net lưu trú) | 29.241 | 30,26% | 10.110.239 € |
| Sau cọc (+ cọc giữ lại) | 29.241 | 30,26% | 12.069.093 € |

| Chỉ số | Giá trị |
|--------|--------:|
| Δ Net Revenue (chỉ lưu trú) | **+1.523.695 €** (**+17,7%**) |
| Δ Net Revenue (+ cọc giữ lại) | **+3.482.549 €** (**+40,6%**) |

![Mô phỏng Deposit Policy — Online TA](./figures/12/chart_04_deposit_simulation.png)

### 4.4 Diễn giải

- Ngay cả khi mất 10% volume do rào cọc, net revenue vẫn tăng **~18%** nhờ giảm hủy.
- Nếu giữ một phần cọc khi hủy, upside tài chính lên **~40%** — cần đối chiếu với luật tiêu dùng và chính sách OTA.

---

## 5. Khuyến nghị liên kết BRD

| BRD rule | Hành động đề xuất |
|----------|-------------------|
| BR-REV-01 | Ưu tiên can thiệp pricing/overbooking cho Online TA + lead > 90 + Jul–Aug |
| BR-REV-02 | Mở rộng rule sang kênh TA/TO với lead > 60 trong mùa cao điểm |
| BR-INV-01 | Theo dõi free upgrade B/A — cân nhắc dynamic upsell thay vì upgrade miễn phí |
| BR-FIN-01 | Pilot deposit policy Online TA lead > 30; A/B test mức cọc 20–30% ADR |

---

## Phụ lục

- **Notebook:** `notebooks/12_brd_gap_analysis.ipynb` — chạy Run All để tái tạo bảng số và biểu đồ inline.
- **Biểu đồ tĩnh:** `reports/figures/12/chart_01` – `chart_04` (dùng cho báo cáo này trên GitHub).
