# SQL — Hotel Booking Demand

Thư mục truy vấn cho hai property (City / Resort). Đọc **câu hỏi → insight** trước; schema và công thức ở dưới.

---

## Business question → insight

| # | Câu hỏi | Quyết định cần ra | Insight kỳ vọng | Flat | Star |
|---|---------|-------------------|-----------------|------|------|
| **Q1** | Tăng trưởng đến từ đâu? Doanh thu phụ thuộc kênh / thị trường nào? | Nếu một kênh hoặc một quốc gia chiếm quá nửa revenue → đa dạng hóa, tăng Direct | Mix lệch về TA/TO và một thị trường lớn là rủi ro tập trung, không phải “kênh đang chạy tốt” | `SQLQuery1` 1.1–1.6 | `03` BQ1 |
| **Q2** | City và Resort khác nhau thế nào về RevPAR / ADR / occupancy? | Không dùng một playbook giá cho cả hai | City Peak: harden BAR. Resort Peak: HOLD. Resort Low: CUT nhẹ | `SQLQuery2` 2.1–2.6 | `03` BQ2 |
| **Q3** | Còn dư địa tăng giá mà không mất occupancy? | Ngày ADR thấp + Occ cao = headroom; ADR cao + Occ thấp = quá giá / hủy | Quadrant và RevPAR theo loại phòng (đặt vs gán) chỉ chỗ còn nâng BAR | `SQLQuery2` 3.1–3.5 | `03` BQ3 |
| **Q4** | Hủy tập trung ở đâu (lead time, deposit, kênh, segment)? | High-risk → buffer + refill Direct; đừng siết deposit hàng loạt | Lead time dài hủy cao hơn. Non Refund cancel cao → audit, không kết luận đặt cọc đang chặn hủy. Khoảng hụt funnel = gợi ý overbooking | `SQLQuery1` 4.1–4.10 | `03` BQ4 |
| **Q5** | ADR / occupancy / cancel đổi thì RevPAR đổi thế nào? | Stress-test lever trong band, không shock Resort Peak | Mô phỏng từng dòng hotel×tháng rồi mới gộp. Mặc định +5% ADR, −2pp Occ | `SQLQuery2` BQ5 | `03` BQ5 |
| **Q6** | Customer type nào gánh nền doanh thu theo tháng? | Giữ Transient; Contract nhỏ nhưng ổn; Transient-Party nhạy mùa | Transient là xương sống. Repeat thường hủy thấp hơn New | `SQLQuery1` 6.1–6.3 | `03` BQ6 |

Insight bổ sung (flat `SQLQuery1` I1–I4 / star `03` I1–I4): special requests, lịch sử hủy, Direct vs OTA, weekend vs weekday.

---

## Technical

### Khi nào dùng flat vs star

| | Flat | Star |
|---|------|------|
| Nguồn | `dbo.hotel_booking_db` (1 dòng = 1 booking) | `Fact_*` + `Dim_*` (sau `01` + `02`) |
| File | `SQLQuery1.sql` · `SQLQuery2.sql` | `03_business_questions.sql` |
| Hợp khi | Câu hỏi một bảng, prototype nhanh, không cần slicer nhiều chiều | Cùng logic dashboard (Overview / RevPAR / Cancel / Simulator), join dim, weighted KPI tháng |
| Không dùng khi | Gộp ADR/Occ/RevPAR nhiều tháng bằng `AVG` cột tỷ lệ | Đọc `occupancy_rate` / `revpar` trên `Fact_Booking` như số từng booking — đó là ngữ cảnh tháng bị lặp |

Hai lớp **cùng công thức KPI**. Star tách grain: tháng (`Fact_RevPAR_Monthly`), ngày (`Fact_Daily_AdrOcc`), booking (`Fact_Booking`).

### Công thức KPI

```
revenue          = adr × (weekend_nights + week_nights)     khi is_canceled = 0
occupancy_rate   = AVG(1 − is_canceled)                     proxy — dataset không có inventory phòng
adr              = AVG(adr) WHERE is_canceled = 0 AND adr > 0
revpar           = adr × occupancy_rate
cancel_rate      = AVG(is_canceled)
lost_revenue_est = revenue × (cx / max(1 − cx, 0.01)) × 0.35   proxy, không phải số kế toán
```

Gộp nhiều tháng / hotel (star): **không** `AVG(adr)` / `AVG(occupancy_rate)` / `AVG(revpar)`.

```
ADR    = Σ(adr × successful_bookings) / Σ(successful_bookings)
Occ    = Σ(occupancy_rate × total_bookings) / Σ(total_bookings)
RevPAR = Σ(revpar × total_bookings) / Σ(total_bookings)
```

Mùa: **Peak** = 7–8 · **Shoulder** = 4–6 và 9–10 · **Low** = 11–3.

### Sơ đồ star schema

Hai fact dùng chung `Dim_Hotel` và `Dim_Date`. Chiều mô tả chỉ gắn `Fact_Booking`. `Dim_RoomType` role-playing: reserved = quan hệ chính, assigned = join khi cần.

```
                         Dim_Date
                        /        \
                       1          1
                      /            \
     Fact_RevPAR_Monthly          Fact_Booking
     (hotel × tháng)              (1 dòng / booking)
            |                            |
            1                            *── Dim_Hotel
            |                            *── Dim_Segment
     Dim_Hotel                           *── Dim_Channel
                                         *── Dim_Deposit
     Fact_Daily_AdrOcc                   *── Dim_Status
     (hotel × ngày)                      *── Dim_Country
            *── Dim_Hotel                *── Dim_CustomerType
            *── Dim_Date                 *── Dim_RoomType
```


### Chạy ngắn

1. Import nguồn (v5) thành `dbo.hotel_booking_db`.
2. Flat: `SQLQuery1.sql` / `SQLQuery2.sql`.
3. Star: `01_create_star_schema.sql` → `02_populate_star_schema.sql` → `03_business_questions.sql`.
