# Power BI Setup Guide — tái tạo dashboard HTML bằng star-schema + DAX

Tài liệu này hướng dẫn dựng lại `dashboard-html/` (Overview · RevPAR · Cancellation · Pricing Simulator) trong Power BI, đúng công thức đang chạy trong `dashboard-html/js/data.js`, `app.js` và `_export_data.py`. Mục tiêu: cùng một con số, cùng một logic — chỉ khác công cụ hiển thị.

---

## 1. Nguồn dữ liệu & vai trò từng bảng

| File | Grain | Vai trò |
|---|---|---|
| `data/star schema/revpar_monthly.csv` | 1 dòng / hotel × year_month | Fact đã tổng hợp sẵn ADR, Occupancy, RevPAR — dùng cho **Overview KPI** và toàn bộ trang **RevPAR** |
| `data/star schema/hotel_bookings_normalized.csv` | 1 dòng / booking (~82.8k dòng) | Fact chi tiết — dùng cho **Cancellation**, segment/channel/country/customer-type, lead-time, room-type. Boxplot ADR **không** vẽ thẳng 82k dòng: lấy mẫu qua `Fact_Adr_Boxplot` / `Fact_Adr_LeadTime_Boxplot` (mục 5.4) |
| `data/star schema/dim_hotel.csv` | 2 dòng | Dimension Hotel |
| `data/star schema/dim_status.csv`, `dim_deposit.csv`, `dim_country.csv` | nhỏ | Dimension mô tả — 1 cột giá trị + key. Xem bảng quan hệ đầy đủ ở mục 3.1 (⚠️ `dim_country.csv` có tên cột lệch với fact, phải relate tay) |
| `data/star schema/dim_meal.csv` | nhỏ | **Không dùng** — không có measure/visual nào trong guide này tham chiếu `meal`. Có thể bỏ qua import hoàn toàn |
| `data/star schema/dim_market.csv`, `dim_room.csv`, `dim_customer.csv` | tổ hợp | **Junk/combo dimension** (segment×channel, reserved×assigned room, customer_type×repeat_guest). Fact **không** có surrogate key của các bảng này → xem mục 3.2 |

⚠️ Lưu ý quan trọng: `hotel_bookings_normalized.csv` có 3 cột `occupancy_rate`, `group_adr`, `revpar` — đây là giá trị **của cả ngày (hotel × arrival_date)**, được lặp lại trên mọi booking đến ngày đó, **không phải** giá trị riêng của từng booking. Nếu bạn `AVERAGE()` trực tiếp 3 cột này theo tháng, kết quả sẽ lệch so với `revpar_monthly.csv` (vì bị trọng số theo số lượng booking/ngày thay vì theo phòng-đêm thực bán). → **Luôn dùng bảng đã tổng hợp ở cấp hotel×tháng làm nguồn ADR/Occupancy/RevPAR chính thức** — giống hệt cách `data.js` làm (`overviewKpis()`, `monthlyTrends()` đều đọc từ `revpar_monthly`, không đọc từ booking-level). Bảng đó có thể là `revpar_monthly.csv` import sẵn (mặc định), **hoặc** một Calculated Table dựng bằng DAX ngay từ `Fact_Booking` để tự tính lại mỗi lần refresh, không cần chạy lại Python — xem mục 3.6.

---

## 2. Import & Power Query

1. **Get Data → Text/CSV**, trỏ tới từng file trong `data/star schema/`. Đặt tên bảng:
   - `Fact_RevPAR_Monthly` ← `revpar_monthly.csv`
   - `Fact_Booking` ← `hotel_bookings_normalized.csv`
   - `Dim_Hotel` ← `dim_hotel.csv`
   - `Dim_Status` ← `dim_status.csv`
   - `Dim_Deposit` ← `dim_deposit.csv`
   - `Dim_Country` ← `dim_country.csv`
2. Trong Power Query cho `Fact_Booking`:
   - Cột `arrival_date` đang ở định dạng **D/M/YYYY** (dayfirst, ví dụ `1/7/2015` = 1 tháng 7). Đừng dùng "Detect Data Type" tự động (mặc định hay hiểu theo M/D/Y kiểu Mỹ) — dùng **Transform → Data Type → Date**, rồi nếu sai, dùng **"Using Locale..." → English (United Kingdom)** để ép parse dd/mm/yyyy.
   - Đổi kiểu: `is_canceled` → Whole Number, `adr`/`revenue`/`occupancy_rate`/`revpar` → Decimal Number, `lead_time`/`total_nights` → Whole Number.
   - Thêm cột tính toán (Add Column → Custom Column):
     - `Cancel Label` = `if [is_canceled] = 1 then "Canceled" else "Not canceled"`
     - `Lead Time Bin` = xem DAX tương đương ở mục 6 (làm cột tính toán trong Power Query hoặc DAX calculated column đều được).
3. Với `Fact_RevPAR_Monthly`: kiểu dữ liệu `adr`, `occupancy_rate`, `revpar`, `total_revenue` → Decimal Number; `year`, `month_number`, `total_bookings`, `successful_bookings`, `canceled_bookings` → Whole Number.

---

## 3. Thiết kế star schema (bảng & quan hệ)

### 3.1 Sơ đồ tổng thể

```
Dim_Date (calendar, ngày) ──1───*── Fact_Booking (booking-level)
      │  (qua MonthStartDate)                │
      1                                       *──── Dim_Segment (market_segment)
      │                                       *──── Dim_Channel (distribution_channel)
      *                                       *──── Dim_Deposit (deposit_type)
Fact_RevPAR_Monthly (hotel × year_month)      *──── Dim_Status (reservation_status)
      │                                       *──── Dim_Country (country_code ↔ country)
      1                                       *──── Dim_CustomerType (customer_type)
      │                                       *──── Dim_RoomType (role-playing: reserved / assigned)
Dim_Hotel ──1───*── (cả 2 fact table qua cột "hotel")
```

Đây là schema **snowflake nhẹ**: 2 fact table dùng chung `Dim_Hotel` và `Dim_Date`, các dimension mô tả (segment, channel, deposit, status, country, customer type, room type) chỉ relate vào `Fact_Booking` vì `Fact_RevPAR_Monthly` đã tổng hợp sẵn, không còn các chiều đó.

### 3.1.1 Bảng quan hệ đầy đủ — dùng để rà soát/setup trong Model view

Đối chiếu trực tiếp với cột thật trong từng CSV (không chỉ theo sơ đồ). Tạo lần lượt theo đúng thứ tự này trong **Model view → Manage relationships → New**; mọi quan hệ đều **Single direction** (dimension lọc xuống fact), trừ cột "Active?" ghi rõ khác.

| # | Từ (cột "1") | Đến (cột "\*") | Cardinality | Active? | Ghi chú |
|---|---|---|---|---|---|
| 1 | `Dim_Hotel[hotel_name]` | `Fact_Booking[hotel]` | 1:* | Active | Tên cột khác nhau (`hotel_name` vs `hotel`) — Power BI autodetect **không** tự bắt được, phải **New relationship** thủ công |
| 2 | `Dim_Hotel[hotel_name]` | `Fact_RevPAR_Monthly[hotel]` | 1:* | Active | Tương tự #1 |
| 3 | `Dim_Date[Date]` | `Fact_Booking[arrival_date]` | 1:* | Active | Sau khi tạo, vào **Table tools → Mark as Date Table** chọn cột `Date` |
| 4 | `Dim_Date[Date]` | `Fact_RevPAR_Monthly[MonthStartDate]` | 1:* | Active | Cột `MonthStartDate` phải có sẵn trước — tạo bằng calculated column (mục 3.4) **hoặc** đã có sẵn nếu build bảng bằng DAX (mục 3.6) |
| 5 | `Dim_RoomType[room_type]` | `Fact_Booking[reserved_room_type]` | 1:* | **Active** | Role-playing #1 — xem mục 3.3 |
| 6 | `Dim_RoomType[room_type]` | `Fact_Booking[assigned_room_type]` | 1:* | **Inactive** (Power BI tự set) | Role-playing #2 — bật bằng `USERELATIONSHIP()` ở mục 4.6 |
| 7 | `Dim_Segment[market_segment]` | `Fact_Booking[market_segment]` | 1:* | Active | `Dim_Segment` tự tạo bằng Power Query (Reference `Fact_Booking` → giữ 1 cột → Remove Duplicates), **không** dùng `dim_market.csv` — xem mục 3.2 |
| 8 | `Dim_Channel[distribution_channel]` | `Fact_Booking[distribution_channel]` | 1:* | Active | Tự tạo tương tự #7 |
| 9 | `Dim_CustomerType[customer_type]` | `Fact_Booking[customer_type]` | 1:* | Active | Tự tạo tương tự #7, **không** dùng `dim_customer.csv` |
| 10 | `Dim_Status[reservation_status]` | `Fact_Booking[reservation_status]` | 1:* | Active | Dùng thẳng `dim_status.csv` — tên cột khớp sẵn, autodetect thường bắt đúng |
| 11 | `Dim_Deposit[deposit_type]` | `Fact_Booking[deposit_type]` | 1:* | Active | Dùng thẳng `dim_deposit.csv` — tên cột khớp sẵn |
| 12 | `Dim_Country[country_code]` | `Fact_Booking[country]` | 1:* | Active | ⚠️ Dùng thẳng `dim_country.csv` nhưng **tên cột lệch** (`country_code` vs `country`) — Power BI autodetect **không** tự bắt, phải **New relationship** thủ công và tự chọn đúng 2 cột (hoặc đổi tên 1 trong 2 cột cho khớp trước khi tạo) |
| 13 | `Dim_Hotel[hotel_name]` | `Fact_Adr_Boxplot[hotel]` | 1:* | Active | Bảng mẫu boxplot Canceled vs Not canceled (mục 5.4) — tạo tay, tên cột lệch giống #1 |
| 14 | `Dim_Date[Date]` | `Fact_Adr_Boxplot[arrival_date]` | 1:* | Active | Slicer ngày/hotel trên trang Cancellation lọc được boxplot |
| 15 | `Dim_Hotel[hotel_name]` | `Fact_Adr_LeadTime_Boxplot[hotel]` | 1:* | Active | Bảng mẫu boxplot ADR theo lead-time bin (mục 5.4.2) |
| 16 | `Dim_Date[Date]` | `Fact_Adr_LeadTime_Boxplot[arrival_date]` | 1:* | Active | Tương tự #14 |

Không tạo quan hệ nào cho `dim_market.csv`, `dim_room.csv`, `dim_customer.csv` (junk dimension gốc, xem mục 3.2) và `dim_meal.csv` (không dùng trong dashboard này — bỏ qua, không import).

**Bẫy thường gặp khi setup:** vì `Fact_Booking` và `Fact_RevPAR_Monthly` là 2 fact riêng, **không** relate trực tiếp với nhau — mọi liên kết giữa 2 trang (Overview/RevPAR đọc `Fact_RevPAR_Monthly`, Cancellation đọc `Fact_Booking`) chỉ đi qua `Dim_Hotel` và `Dim_Date` dùng chung. Vì `Fact_RevPAR_Monthly` **không có** cột segment/channel/deposit, slicer Segment/Channel/Deposit (đồng bộ qua 4 trang ở mục 7) sẽ **không lọc được** biểu đồ ở trang RevPAR — đây là hành vi **đúng theo bản HTML** (bản gốc cũng không lọc RevPAR theo segment/channel/deposit), không phải lỗi thiếu quan hệ cần bổ sung.

### 3.2 Vì sao không dùng thẳng `dim_market.csv` / `dim_room.csv` / `dim_customer.csv`?

3 file này là **junk dimension** (tổ hợp nhiều cột thành 1 khóa), nhưng fact export ra lại giữ nguyên cột mô tả dạng text (`market_segment`, `distribution_channel`, `reserved_room_type`, `assigned_room_type`, `customer_type`, `is_repeated_guest`) chứ **không** có cột khóa (`market_key`, `room_key`, `customer_key`) để relate. Vì vậy cách gọn nhất:

- Bỏ qua `dim_market.csv`, `dim_customer.csv` — tạo **Dim_Segment** và **Dim_Channel** riêng (mỗi bảng 1 cột) bằng Power Query: **Reference** `Fact_Booking` → Remove Columns (giữ 1 cột) → Remove Duplicates. Tương tự cho **Dim_CustomerType** (từ `customer_type`).
- `dim_room.csv` xử lý bằng kỹ thuật **role-playing dimension** (mục 3.3) thay vì tổ hợp.
- `Dim_Status`, `Dim_Deposit`, `Dim_Country` thì dùng thẳng file có sẵn (bỏ cột `*_key` nếu muốn). **Riêng `Dim_Country` tên cột giá trị là `country_code`, không phải `country`** như bên `Fact_Booking` — quan hệ này phải tạo tay, autodetect sẽ không bắt được. Xem đầy đủ cột/cardinality của cả 6 dimension mô tả này ở bảng mục 3.1.1.

### 3.3 Dim_RoomType — role-playing dimension (1 bảng, 2 quan hệ)

Tạo `Dim_RoomType` = danh sách phân biệt các mã phòng (A, B, C, ... — lấy union của `reserved_room_type` và `assigned_room_type`). Tạo **2 quan hệ**:

- `Dim_RoomType[room_type]` → `Fact_Booking[reserved_room_type]` — **Active**
- `Dim_RoomType[room_type]` → `Fact_Booking[assigned_room_type]` — **Inactive** (Power BI tự set inactive vì đã có 1 quan hệ active tới cùng bảng)

Dùng `USERELATIONSHIP()` trong DAX để bật quan hệ inactive khi cần (xem đo lường RevPAR by room type ở mục 6).

### 3.4 Quan hệ Hotel & Date

- `Dim_Hotel[hotel_name]` **1 → \*** `Fact_Booking[hotel]`
- `Dim_Hotel[hotel_name]` **1 → \*** `Fact_RevPAR_Monthly[hotel]`
- `Dim_Date[Date]` **1 → \*** `Fact_Booking[arrival_date]`, **Mark as Date Table** (dùng cột `Date`)
- Thêm cột tính toán trong `Fact_RevPAR_Monthly`:
  `MonthStartDate = DATE(Fact_RevPAR_Monthly[year], Fact_RevPAR_Monthly[month_number], 1)`
  rồi relate `Dim_Date[Date]` **1 → \*** `Fact_RevPAR_Monthly[MonthStartDate]`.

  → Nhiều dòng của `Fact_RevPAR_Monthly` (2 hotel/tháng) trỏ về đúng 1 ngày (mùng 1) trong `Dim_Date` — quan hệ 1-nhiều hợp lệ, và các hàm time-intelligence (`DATEADD`, `SAMEPERIODLASTYEAR`, `DATESYTD`) vẫn hoạt động đúng vì chúng lọc theo khoảng ngày trên `Dim_Date`, quan hệ sẽ tự truyền lọc xuống đúng các dòng tháng tương ứng.

### 3.5 Cách tạo `Dim_Date`

DAX (Modeling → New Table):

```DAX
Dim_Date =
VAR MinDate = DATE(2015, 7, 1)
VAR MaxDate = DATE(2017, 9, 30)
RETURN
ADDCOLUMNS(
    CALENDAR(MinDate, MaxDate),
    "Year", YEAR([Date]),
    "MonthNumber", MONTH([Date]),
    "MonthName", FORMAT([Date], "mmm"),
    "YearMonth", FORMAT([Date], "YYYY-MM"),
    "Quarter", "Q" & QUARTER([Date]),
    "Season",
        SWITCH(
            TRUE(),
            MONTH([Date]) IN {7, 8}, "Peak",
            MONTH([Date]) IN {4, 5, 6, 9, 10}, "Shoulder",
            "Low"
        )
)
```

`Season` tái hiện đúng quy ước dự án: **Peak = 7–8, Shoulder = 4–6 & 9–10, Low = 11–3** (README mục "Phạm vi & nguyên tắc"). Sau khi tạo xong, vào **Table tools → Mark as Date Table**, chọn cột `Date`.

### 3.6 (Tuỳ chọn, khuyến nghị) — Tự tính `Fact_RevPAR_Monthly` bằng DAX Calculated Table, không phụ thuộc CSV export

Mặc định mục 1–2 import `revpar_monthly.csv` (đã tổng hợp sẵn bằng Python). Nếu bạn muốn **mỗi khi Refresh, chỉ số ADR/Occupancy/RevPAR tự tính lại từ `Fact_Booking` mà không cần chạy lại script**, hãy thay bằng **Calculated Table** (Modeling → New table). Công thức gốc lấy từ `sql/SQLQuery2.sql` (đã đối chiếu khớp từng dòng với `revpar_monthly.csv`):

- `occupancy_rate = successful_bookings / total_bookings` — proxy, vì dataset gốc không có sức chứa phòng thật (`AVG(1 - is_canceled)` ≡ tỷ lệ booking không hủy)
- `adr = AVERAGE(adr)` trên các booking **không hủy và `adr > 0`**
- `revpar = adr × occupancy_rate`
- `revenue = SUM(adr × total_nights)` trên booking không hủy

```DAX
Fact_RevPAR_Monthly =
VAR Base =
    SUMMARIZECOLUMNS(
        Fact_Booking[hotel],
        Fact_Booking[year_month],
        "year", MAX(Fact_Booking[arrival_date_year]),
        "month_number", MAX(Fact_Booking[arrival_month_number]),
        "total_bookings", COUNTROWS(Fact_Booking),
        "successful_bookings",
            CALCULATE(COUNTROWS(Fact_Booking), Fact_Booking[is_canceled] = 0),
        "canceled_bookings",
            CALCULATE(COUNTROWS(Fact_Booking), Fact_Booking[is_canceled] = 1),
        "adr",
            CALCULATE(
                AVERAGEX(Fact_Booking, Fact_Booking[adr]),
                Fact_Booking[is_canceled] = 0,
                Fact_Booking[adr] > 0
            ),
        "total_revenue",
            CALCULATE(
                SUMX(Fact_Booking, Fact_Booking[adr] * Fact_Booking[total_nights]),
                Fact_Booking[is_canceled] = 0
            ),
        "avg_lead_time", AVERAGE(Fact_Booking[lead_time]),
        "avg_total_nights",
            CALCULATE(AVERAGE(Fact_Booking[total_nights]), Fact_Booking[is_canceled] = 0)
    )
RETURN
    ADDCOLUMNS(
        Base,
        "occupancy_rate", DIVIDE([successful_bookings], [total_bookings]),
        "revpar", ROUND(DIVIDE([successful_bookings], [total_bookings]) * [adr], 2),
        "MonthStartDate", DATE([year], [month_number], 1)
    )
```

**Vì sao "tự động" đúng nghĩa:** Calculated table được engine DAX/VertiPaq tính lại **mỗi lần Refresh model** (F5 ở Desktop, hoặc scheduled refresh trên Service) — cứ thêm booking mới vào `Fact_Booking` (import CSV mới/đã cập nhật, hoặc đổi nguồn sang database), Refresh xong là `Fact_RevPAR_Monthly` và toàn bộ measure ở mục 4 tự cập nhật theo, không cần đụng tới Python.

**Cách áp dụng mà không sửa gì ở mục 4–8:** Đặt tên table và cột **giống hệt** bảng CSV cũ (`hotel`, `year_month`, `year`, `month_number`, `total_bookings`, `successful_bookings`, `canceled_bookings`, `occupancy_rate`, `adr`, `revpar`, `total_revenue`, `avg_lead_time`, `avg_total_nights`) — toàn bộ measure ở mục 4.1–4.7 (đọc từ `Fact_RevPAR_Monthly[...]`) chạy nguyên vẹn, không phải sửa DAX measure nào. Cột `MonthStartDate` đã được tính sẵn trong bảng này luôn — bỏ bước tạo calculated column riêng ở mục 3.4.

### 3.6.1 Có công thức DAX rồi thì còn cần giữ bảng `Fact_RevPAR_Monthly` không?

**Vẫn cần — chỉ là không cần *file CSV*/script Python nữa.** Công thức ở mục 3.6 không "xoá bảng đi", nó **là cách tạo ra chính bảng đó** (Calculated Table thay cho Imported Table) — tên bảng, tên cột, số dòng (~98 = 2 hotel × ~49 tháng) giữ nguyên. Không nên bỏ hẳn bảng để thay bằng virtual table nhúng trong từng measure, vì:

1. **~15 measure ở mục 4 và 6 đang tham chiếu thẳng `Fact_RevPAR_Monthly[cột]`** (ADR, Occupancy Rate, RevPAR, MoM/YoY, decomposition, cả 3 measure Pricing Simulator). Bỏ bảng = phải viết lại toàn bộ, mỗi measure tự nhúng lại đoạn `SUMMARIZECOLUMNS` giống nhau → lặp code, dễ lệch logic giữa các measure về sau.
2. **Time-intelligence cần quan hệ thật với `Dim_Date`.** `DATEADD` / `SAMEPERIODLASTYEAR` (MoM/YoY ở mục 4.2) chạy dựa trên quan hệ vật lý `Dim_Date[Date] → Fact_RevPAR_Monthly[MonthStartDate]` (mục 3.1.1, dòng #4) — không có cách nào làm gọn tương đương chỉ bằng virtual table trong measure.
3. **Hiệu năng.** Calculated table chỉ tính **một lần lúc Refresh** ra ~98 dòng; measure sau đó chỉ `SUMX`/`DIVIDE` trên 98 dòng đó. Bỏ bảng thì mỗi lần visual render lại phải tự group-by lại từ 82.8k dòng `Fact_Booking` — nặng nhất là Pricing Simulator (mục 6.2, `SUMX` lặp dòng theo scenario cho 3 measure), sẽ nhân chi phí group-by đó lên mỗi lần kéo slider.

Tóm lại: **bỏ được** `revpar_monthly.csv` + bước chạy lại `_export_data.py`. **Giữ lại** bảng `Fact_RevPAR_Monthly` trong model — chỉ đổi cách nó sinh ra.

**Đánh đổi cần biết:**
- Chỉ hoạt động ở **Import mode** (không phải DirectQuery) — đúng với setup CSV import ở mục 2.
- `Fact_Booking` phải **luôn sạch/đã chuẩn hoá** trước khi vào Power BI (đúng định dạng ngày, `is_canceled` là 0/1, `adr`/`total_nights` là số) — nếu bạn nạp CSV thô (`hotel_bookings.csv` gốc, chưa qua `01_data_cleaning.ipynb`), phải xử lý lại các bước làm sạch tương đương trong Power Query trước khi calculated table này chạy đúng.
- Bảng CSV `revpar_monthly.csv` gốc vẫn nên giữ lại 1 bản (đổi tên `Fact_RevPAR_Monthly_CSV`, không relate vào model) để **đối chiếu** vài tháng mẫu giữa 2 cách tính trước khi xoá hẳn — tránh sai lệch âm thầm nếu logic Python và DAX lệch nhau ở edge case nào đó.
- `avg_lead_time` / `avg_total_nights` không được dùng ở bất kỳ measure nào trong mục 4 hiện tại — giữ lại cho đầy đủ schema, không ảnh hưởng nếu cách gộp (all bookings vs chỉ successful) chưa khớp 100% với bản Python gốc.

---

## 4. Đo lường DAX — Overview & RevPAR (nguồn: `Fact_RevPAR_Monthly`)

### 4.1 Đo lường nền — BẮT BUỘC weighted average

```DAX
Total Bookings = SUM(Fact_RevPAR_Monthly[total_bookings])
Successful Bookings = SUM(Fact_RevPAR_Monthly[successful_bookings])
Canceled Bookings (Monthly) = SUM(Fact_RevPAR_Monthly[canceled_bookings])
Total Revenue = SUM(Fact_RevPAR_Monthly[total_revenue])

Cancel Rate (Monthly) = DIVIDE([Canceled Bookings (Monthly)], [Total Bookings])

ADR =
DIVIDE(
    SUMX(Fact_RevPAR_Monthly, Fact_RevPAR_Monthly[adr] * Fact_RevPAR_Monthly[successful_bookings]),
    SUM(Fact_RevPAR_Monthly[successful_bookings])
)

Occupancy Rate =
DIVIDE(
    SUMX(Fact_RevPAR_Monthly, Fact_RevPAR_Monthly[occupancy_rate] * Fact_RevPAR_Monthly[total_bookings]),
    SUM(Fact_RevPAR_Monthly[total_bookings])
)

RevPAR =
DIVIDE(
    SUMX(Fact_RevPAR_Monthly, Fact_RevPAR_Monthly[revpar] * Fact_RevPAR_Monthly[total_bookings]),
    SUM(Fact_RevPAR_Monthly[total_bookings])
)
```

> ⚠️ **Không** dùng `AVERAGE(Fact_RevPAR_Monthly[adr])` / `AVERAGE(occupancy_rate)` / `AVERAGE(revpar)` trực tiếp — mỗi dòng đã là một tỷ lệ/giá trung bình ở cấp hotel×tháng, cộng gộp phải theo trọng số (`successful_bookings` cho ADR, `total_bookings` cho Occupancy & RevPAR) y hệt hàm `weightedMean()` trong `data.js`.

### 4.2 MoM / YoY (waterfall & chart — không gắn lên KPI card)

Thẻ Overview / RevPAR / Cancellation **không** hiện MoM. Dải vs PY / YoY tháng cuối / PY|CY / spark nằm ở mục **4.8**. Block dưới đây phục vụ waterfall RevPAR (mục 4.3) và callout trên **biểu đồ**, không phải thẻ KPI.

```DAX
RevPAR PM  = CALCULATE([RevPAR], DATEADD(Dim_Date[Date], -1, MONTH))
RevPAR PY  = CALCULATE([RevPAR], SAMEPERIODLASTYEAR(Dim_Date[Date]))
RevPAR MoM %= DIVIDE([RevPAR] - [RevPAR PM], [RevPAR PM])
RevPAR YoY %= DIVIDE([RevPAR] - [RevPAR PY], [RevPAR PY])

Total Revenue PM  = CALCULATE([Total Revenue], DATEADD(Dim_Date[Date], -1, MONTH))
Total Revenue MoM %= DIVIDE([Total Revenue] - [Total Revenue PM], [Total Revenue PM])

Cancel Rate PM = CALCULATE([Cancel Rate (Monthly)], DATEADD(Dim_Date[Date], -1, MONTH))
Cancel Rate Δ pp (MoM) = ([Cancel Rate (Monthly)] - [Cancel Rate PM]) * 100
```

### 4.3 RevPAR decomposition (bridge/waterfall ADR vs Occupancy)

Công thức gốc (`revparDecomposition()` trong `data.js`): `ΔADR = Occ(t-1) × (ADR(t) − ADR(t-1))`, `ΔOcc = ADR(t) × (Occ(t) − Occ(t-1))`.

```DAX
ADR PM = CALCULATE([ADR], DATEADD(Dim_Date[Date], -1, MONTH))
Occupancy PM = CALCULATE([Occupancy Rate], DATEADD(Dim_Date[Date], -1, MONTH))

Δ RevPAR from ADR (MoM) = [Occupancy PM] * ([ADR] - [ADR PM])
Δ RevPAR from Occupancy (MoM) = [ADR] * ([Occupancy Rate] - [Occupancy PM])
Residual (MoM) = [RevPAR] - ([RevPAR PM] + [Δ RevPAR from ADR (MoM)] + [Δ RevPAR from Occupancy (MoM)])
```

Visual: dùng **Waterfall chart** gốc của Power BI, hoặc dựng bảng disconnected `Bridge Step` (Prev RevPAR / Δ ADR / Δ Occupancy / Curr RevPAR) + 1 measure `SWITCH(SELECTEDVALUE(...))` để tự vẽ 4 cột.

### 4.4 RevPAR mới nhất theo hotel (Latest month)

```DAX
Latest Month (YearMonth) = CALCULATE(MAX(Fact_RevPAR_Monthly[year_month]), ALLSELECTED(Fact_RevPAR_Monthly))
RevPAR (Latest Month) = CALCULATE([RevPAR], Fact_RevPAR_Monthly[year_month] = [Latest Month (YearMonth)])
```

### 4.5 Seasonality heatmap

Dùng **Matrix visual**: Rows = `Dim_Hotel[hotel_name]`, Columns = `Dim_Date[MonthNumber]`/`MonthName`, Values = `[RevPAR]` → bật **Conditional formatting → Background color** (color scale) trên ô giá trị để ra hiệu ứng heatmap giống bản HTML.

### 4.6 RevPAR by room type (reserved vs assigned) — dùng role-playing dimension

```DAX
Room Nights Sold = CALCULATE(SUM(Fact_Booking[total_nights]), Fact_Booking[is_canceled] = 0)
Revenue (Booking) = SUM(Fact_Booking[revenue])

RevPAR (Reserved Room) = DIVIDE([Revenue (Booking)], [Room Nights Sold])

RevPAR (Assigned Room) =
CALCULATE(
    DIVIDE([Revenue (Booking)], [Room Nights Sold]),
    USERELATIONSHIP(Dim_RoomType[room_type], Fact_Booking[assigned_room_type])
)
```

Visual: **Clustered bar chart**, Axis = `Dim_RoomType[room_type]`, Values = `[RevPAR (Reserved Room)]` và `[RevPAR (Assigned Room)]`.

### 4.7 ADR × Occupancy theo ngày (scatter) — cần bảng phụ

Đây là biểu đồ duy nhất cần một fact mới ở **grain ngày** (`hotel × arrival_date`), vì `Fact_Booking` là grain booking. Tạo bằng Power Query:

1. Reference `Fact_Booking` → thêm cột `Room Nights Sold (row)` = `if [is_canceled] = 0 then [total_nights] else 0`.
2. **Group By** `hotel`, `arrival_date` với các phép tổng hợp: `Bookings = Count Rows`, `Canceled = Sum(is_canceled)`, `ADR (day) = Average(adr)`, `Occupancy Rate (day) = Average(occupancy_rate)`, `Revenue = Sum(revenue)`, `Room Nights Sold = Sum(Room Nights Sold (row))`.
3. Add Column: `RevPAR (day) = [ADR (day)] * [Occupancy Rate (day)]`.
4. Đặt tên bảng `Fact_Daily_AdrOcc`, relate `Dim_Hotel` và `Dim_Date` (qua `arrival_date`).

Visual: **Scatter chart** — X = `ADR (day)`, Y = `Occupancy Rate (day)`, dùng trường màu (Color saturation) = `RevPAR (day)` để mô phỏng "điểm sáng = RevPAR cao" như bản HTML.

### 4.8 KPI cards — anatomy HTML (vs PY / YoY / PY|CY / spark / rating)

Mục 4.1–4.2 chỉ có **giá trị nền** và **MoM/YoY time-intelligence**. Thẻ HTML (`kpiHtml` trong `app.js`) còn 4 tầng nữa: **vs PY**, **YoY tháng cuối**, cặp **PY | CY**, **sparkline** (đường CY + vùng PY). ADR / Occupancy / RevPAR thêm **pill xếp hạng**. Cancel / No-Show / Lost revenue **đảo màu** (↑ là xấu). **MoM không hiện trên thẻ** — MoM chỉ ở waterfall RevPAR (mục 4.3 / 8.2).

Folder model: `_Measures` → **`07 KPI Cards`**. Tên dưới đây là tên thật trong file `.pbix` (không còn `[ADR]` trần — xem bảng mục 8).

#### 4.8.1 Một thẻ = một cụm visual

Power BI Card cũ không chứa spark + 4 reference label. Mỗi KPI là **1 Card (new)** chồng **1 Line chart nhỏ** (spark).

| Tầng HTML | Measure | Visual |
|---|---|---|
| Giá trị lớn (đã filter) | Nền folder `01` / `05` / `06` | Card (new) → Data |
| vs PY | `[…] vs PY` (số) hoặc `[…] vs PY %` | Reference label, title `vs PY` |
| YoY | `[…] YoY %` | Reference label, title `YoY` |
| Cặp PY \| CY | `[…] (PY)` và `[…] (CY)` | 2 reference label, title `PY` / `CY` |
| Sparkline | `[…] (CY by month)` + `[…] (PY by month)` | Line chart, X = `MonthName` |
| Rating pill | `[ADR Rating]` / `[Occupancy Rating]` / `[RevPAR Rating]` | Reference label, title `Rating` |
| Note (Cancellation) | `[Cancel Rate Note]` … | Reference label hoặc subtitle |

#### 4.8.2 Định nghĩa CY / PY

Khác HTML: `cyYearFromData()` luôn lấy max year của **cả dataset**. Power BI lấy **năm đang chọn** trên slicer `Dim_Date[Year]`.

| Khái niệm | Ý nghĩa | DAX |
|---|---|---|
| CY | Một năm trên slicer → năm đó. Nhiều năm / không slicer → **MAX** năm trong lựa chọn | `[KPI CY Year]` = `MAXX ( ALLSELECTED ( Dim_Date[Year] ), Dim_Date[Year] )` |
| PY | CY − 1 | `[KPI PY Year]` |
| Tháng PY | PY chỉ giữ **tháng-trong-năm có mặt ở CY** (CY = 2017 → Jan–Aug 2017 vs Jan–Aug 2016) | `INTERSECT` slicer months × `VALUES(Fact_Revpar_Monthly[month_number])` năm CY |
| Giá trị lớn trên thẻ | Theo slicer hiện tại | `[Total Bookings]`, `[ADR (wtd)]`, … — **khi slicer đúng 1 năm, khớp `[…] (CY)`** |
| vs PY / PY\|CY / spark | CY theo slicer năm; bỏ filter ngày rồi gắn lại Year = CY hoặc PY + tháng-trong-năm | `REMOVEFILTERS(Dim_Date)` rồi `Dim_Date[Year] = CyYear` / `PyYear` |

`ALLSELECTED` để sparkline (trục `MonthName`) không làm `[KPI CY Year]` đổi theo từng tháng.

⚠️ Quan hệ `Dim_Date` → fact là **single direction**: lọc `Fact_Revpar_Monthly[year] = 2017` **không** lọc ngược `Dim_Date`. **Không** viết `VALUES(Dim_Date[MonthNumber])` sau filter fact-year — sẽ ra 12 tháng. Phải lấy tháng từ fact: `VALUES(Fact_Revpar_Monthly[month_number])`.

#### 4.8.3 Helper (ẩn)

```DAX
KPI CY Year =
MAXX ( ALLSELECTED ( Dim_Date[Year] ), Dim_Date[Year] )

KPI PY Year = [KPI CY Year] - 1
```

`[Latest Fact Month Start]` (folder `02`, ẩn) dùng cho YoY: `MAX(Fact_Revpar_Monthly[MonthStartDate])`.

#### 4.8.4 Template CY / PY / vs PY / YoY

Thay `[ADR (wtd)]` bằng measure nền. Copy 1 lần cho mỗi KPI.

```DAX
ADR (CY) =
VAR CyYear = [KPI CY Year]
VAR SlicerMonths =
    CALCULATETABLE ( VALUES ( Dim_Date[MonthNumber] ), ALLSELECTED ( Dim_Date ) )
VAR MonthsInCY =
    CALCULATETABLE (
        VALUES ( Fact_Revpar_Monthly[month_number] ),
        REMOVEFILTERS ( Dim_Date ),
        Fact_Revpar_Monthly[year] = CyYear
    )
VAR Months = INTERSECT ( SlicerMonths, MonthsInCY )
RETURN
CALCULATE (
    [ADR (wtd)],
    REMOVEFILTERS ( Dim_Date ),
    Dim_Date[Year] = CyYear,
    TREATAS ( Months, Dim_Date[MonthNumber] )
)

ADR (PY) =
VAR CyYear = [KPI CY Year]
VAR PyYear = [KPI PY Year]
VAR SlicerMonths =
    CALCULATETABLE ( VALUES ( Dim_Date[MonthNumber] ), ALLSELECTED ( Dim_Date ) )
VAR MonthsInCY =
    CALCULATETABLE (
        VALUES ( Fact_Revpar_Monthly[month_number] ),
        REMOVEFILTERS ( Dim_Date ),
        Fact_Revpar_Monthly[year] = CyYear
    )
VAR Months = INTERSECT ( SlicerMonths, MonthsInCY )
RETURN
CALCULATE (
    [ADR (wtd)],
    REMOVEFILTERS ( Dim_Date ),
    Dim_Date[Year] = PyYear,
    TREATAS ( Months, Dim_Date[MonthNumber] )
)

ADR vs PY % = DIVIDE ( [ADR (CY)] - [ADR (PY)], [ADR (PY)] )

ADR YoY % =
VAR LastMonth = [Latest Fact Month Start]
VAR Curr =
    CALCULATE (
        [ADR (wtd)],
        DATESBETWEEN ( Dim_Date[Date], LastMonth, EOMONTH ( LastMonth, 0 ) )
    )
VAR PyMonth = EDATE ( LastMonth, -12 )
VAR Prev =
    CALCULATE (
        [ADR (wtd)],
        DATESBETWEEN ( Dim_Date[Date], PyMonth, EOMONTH ( PyMonth, 0 ) )
    )
RETURN
DIVIDE ( Curr - Prev, Prev )
```

Format: vs PY % và YoY % = `+0.0%;-0.0%;0.0%`. Volume vs PY (Bookings / Revenue) = **hiệu tuyệt đối**, format `+#,##0;-#,##0` — HTML `vsPyAbs`, **không** mũi tên.

Sparkline (trục X = `Dim_Date[MonthName]`, sort by `MonthNumber`):

```DAX
ADR (CY by month) =
VAR CyYear = [KPI CY Year]
VAR Mo = SELECTEDVALUE ( Dim_Date[MonthNumber] )
RETURN
IF (
    NOT ISBLANK ( Mo ),
    CALCULATE (
        [ADR (wtd)],
        REMOVEFILTERS ( Dim_Date ),
        Dim_Date[Year] = CyYear,
        Dim_Date[MonthNumber] = Mo
    )
)

ADR (PY by month) =
VAR PyYear = [KPI PY Year]
VAR Mo = SELECTEDVALUE ( Dim_Date[MonthNumber] )
RETURN
IF (
    NOT ISBLANK ( Mo ),
    CALCULATE (
        [ADR (wtd)],
        REMOVEFILTERS ( Dim_Date ),
        Dim_Date[Year] = PyYear,
        Dim_Date[MonthNumber] = Mo
    )
)
```

#### 4.8.5 Map measure nền → họ KPI

| Thẻ | Nền (giá trị lớn) | vs PY | Ghi chú |
|---|---|---|---|
| Overview Bookings | `[Total Bookings]` | `[Total Bookings vs PY]` **abs** | spark `Total Bookings (CY/PY by month)` |
| Overview / RevPAR Revenue | `[Total Revenue]` | `[Total Revenue vs PY]` **abs** | |
| ADR | `[ADR (wtd)]` | `[ADR vs PY %]` | + `[ADR Rating]` |
| Occupancy | `[Occupancy Rate (wtd)]` | `[Occupancy vs PY %]` | + `[Occupancy Rating]` |
| RevPAR | `[RevPAR (wtd)]` | `[RevPAR vs PY %]` | + `[RevPAR Rating]`; YoY thẻ = `[RevPAR KPI YoY %]` (khác `[RevPAR YoY %]` folder `02` chỉ khác format) |
| Overview Cancel rate | `[Cancel Rate (Monthly)]` | `[Cancel Rate M vs PY %]` | invert màu; họ `Cancel Rate M (…)` |
| Cancellation Cancel rate | `[Cancel Rate]` | `[Cancel Rate vs PY %]` | nguồn `Fact_Booking`; note `[Cancel Rate Note]` |
| No-Show rate | `[No-Show Rate]` | `[No-Show Rate vs PY %]` | invert; note `[No-Show Rate Note]` |
| Canceled bookings | `[Canceled Bookings]` | `[Canceled Bookings vs PY %]` (**%**, không abs) | invert; note `[Canceled Bookings Note]` |
| Lost revenue (est.) | `[Lost Revenue (est.)]` | `[Lost Revenue vs PY %]` | invert; note `[Lost Revenue Note]` = `proxy · not accounting` |

#### 4.8.6 Rating pill (STR / Lisbon)

Giống `KPI_RATING_BANDS` trong `app.js`. Gắn vào **giá trị lớn đã filter**, không gắn vào CY.

```DAX
ADR Rating =
VAR V = [ADR (wtd)]
RETURN
SWITCH (
    TRUE (),
    ISBLANK ( V ), BLANK (),
    V >= 120, "Excellent",
    V >= 105, "Good",
    V >= 90, "Fair",
    V >= 75, "Weak",
    "Poor"
)

Occupancy Rating =
VAR V = [Occupancy Rate (wtd)]
RETURN
SWITCH (
    TRUE (),
    ISBLANK ( V ), BLANK (),
    V >= 0.8, "Excellent",
    V >= 0.72, "Good",
    V >= 0.65, "Fair",
    V >= 0.55, "Weak",
    "Poor"
)

RevPAR Rating =
VAR V = [RevPAR (wtd)]
RETURN
SWITCH (
    TRUE (),
    ISBLANK ( V ), BLANK (),
    V >= 90, "Excellent",
    V >= 75, "Good",
    V >= 60, "Fair",
    V >= 45, "Weak",
    "Poor"
)
```

Tooltip visual (copy vào Description): ADR `Excellent ≥€120 · Good ≥€105 · Fair ≥€90 · Weak ≥€75 (PT/Europe/Lisbon)`; Occupancy `≥80 / 72 / 65 / 55% (STR)`; RevPAR `≥€90 / 75 / 60 / 45 (PT/Lisbon)`.

#### 4.8.7 Simulator — 4 thẻ compact (không spark / không CY–PY)

HTML `renderSimulator()`: chỉ Δ so với baseline.

| Thẻ | Data | Callout / reference |
|---|---|---|
| RevPAR baseline | `[RevPAR (Baseline)]` | — |
| RevPAR scenario | `[RevPAR (Scenario)]` | `[Delta RevPAR % (Scenario)]` |
| Revenue scenario | `[Revenue (Scenario)]` | `[Delta Revenue % (Scenario)]` |
| ADR → Occ | `[ADR Occ Transition]` (text `€ADR → €ADR sim`) | `[Occ Transition Note]` (`occ → occ sim`) |

Occupancy scenario phải **SUMX từng dòng** rồi mới weighted — cùng clamp với `[RevPAR (Scenario)]`:

```DAX
Occupancy (Scenario) =
VAR OccPp = [Occ Delta pp] + [Elasticity Adj]
VAR CxPp = [Cancel Delta pp]
RETURN
DIVIDE (
    SUMX (
        Fact_Revpar_Monthly,
        VAR OccStep1 =
            MIN ( 0.99, MAX ( 0.05, Fact_Revpar_Monthly[occupancy_rate] + OccPp ) )
        VAR OccSim =
            MIN ( 0.99, MAX ( 0.05, OccStep1 - CxPp * 0.5 ) )
        RETURN OccSim * Fact_Revpar_Monthly[total_bookings]
    ),
    SUM ( Fact_Revpar_Monthly[total_bookings] )
)

ADR Occ Transition =
FORMAT ( [ADR (wtd)], "€#,##0.00" ) & " → " & FORMAT ( [ADR (Scenario)], "€#,##0.00" )

Occ Transition Note =
FORMAT ( [Occupancy Rate (wtd)], "0.0%" ) & " → " & FORMAT ( [Occupancy (Scenario)], "0.0%" )
```

`[ADR (Scenario)]` = `[ADR (wtd)] * [ADR Delta Mult]` (folder `06`).

#### 4.8.8 Cách dựng 1 thẻ trên canvas

Lấy thẻ **ADR** (Overview) làm mẫu; 5 thẻ còn lại copy + đổi measure.

1. Insert → **Card (new)** (không phải Card 3-cột cũ).
2. Data = `_Measures` → `01 Overview & RevPAR` → `[ADR (wtd)]`. Format callout: `€#,##0.00`.
3. Thêm reference labels (ô Data kéo thêm, hoặc Format → Reference labels → +):

   | Measure | Folder | Label trên thẻ |
   |---|---|---|
   | `[ADR vs PY %]` | `07 KPI Cards` | `vs PY` |
   | `[ADR YoY %]` | `07 KPI Cards` | `YoY` |
   | `[ADR (PY)]` | `07 KPI Cards` | `PY` |
   | `[ADR (CY)]` | `07 KPI Cards` | `CY` |
   | `[ADR Rating]` | `07 KPI Cards` | `Rating` |

4. Conditional formatting màu chữ vs PY / YoY: ≥ 0 teal `#0F766E`, < 0 cognac `#9A4E1C`. **Cancel / No-Show / Canceled / Lost revenue đảo lại** (≥ 0 cognac, < 0 teal). Bookings/Revenue vs PY: HTML **không** vẽ mũi tên — tắt icon nếu Card (new) tự thêm.
5. Sparkline: Insert **Line chart**, cao ~70 px, đặt sát dưới card.

   | Ô Fields | Chọn | Bảng |
   |---|---|---|
   | X-axis | `MonthName` (Sort by `MonthNumber`) | `Dim_Date` |
   | Y-axis | `[ADR (CY by month)]` **và** `[ADR (PY by month)]` | `_Measures` → `07 KPI Cards` |

   Format: tắt title, legend nhỏ (PY / CY); series PY = **Area** (Format → Series → `[ADR (PY by month)]` → type Area, transparency ~70%); series CY = Line, stroke teal. Tắt “Show items with no data” — tháng 9–12 blank sẽ ẩn (CY 2017 chỉ tới tháng 8).
6. Group (Ctrl+G) card + spark thành 1 cụm. Copy cụm cho các KPI còn lại, chỉ đổi measure theo bảng 4.8.5.
7. **Không** gắn `[Total Revenue MoM %]` / `[RevPAR MoM %]` / `[Cancel Rate Delta pp (MoM)]` vào thẻ.

Đối chiếu:

| Slicer năm | CY / PY | Giá trị lớn Bookings | `[Total Bookings (CY)]` | vs PY Bookings |
|---|---|---|---|---|
| (không / nhiều năm) | 2017 / 2016 | 82.811 (cả cửa sổ) | 30.383 | +3.906 (Jan–Aug) |
| **2017** | 2017 / 2016 | **30.383** (= CY) | 30.383 | +3.906 |
| **2016** | 2016 / 2015 | **40.243** (= CY) | 40.243 | 2016 vs 2015 (tháng có mặt ở 2016) |

Không slicer: ADR ≈ €103.32 (**Fair**), Occupancy ≈ 71.9% (**Fair**), RevPAR ≈ €74.27 (**Fair**). Slicer 2017: ADR (CY) ≈ €115.05.

---

## 5. Đo lường DAX — Cancellation (nguồn: `Fact_Booking`)

```DAX
Bookings = COUNTROWS(Fact_Booking)
Canceled Bookings = CALCULATE(COUNTROWS(Fact_Booking), Fact_Booking[is_canceled] = 1)
No-Show Bookings = CALCULATE(COUNTROWS(Fact_Booking), Fact_Booking[reservation_status] = "No-Show")
Check-Out Bookings = CALCULATE(COUNTROWS(Fact_Booking), Fact_Booking[reservation_status] = "Check-Out")

Cancel Rate = DIVIDE([Canceled Bookings], [Bookings])
No-Show Rate = DIVIDE([No-Show Bookings], [Bookings])

Lost Revenue (est.) =
VAR CxRate = [Cancel Rate]
VAR Denom = MAX(1 - CxRate, 0.01)
RETURN [Revenue (Booking)] * DIVIDE(CxRate, Denom) * 0.35
```

`Lost Revenue (est.)` sao chép đúng công thức proxy trong `cubeKpis()` (`app.js` tự chú thích "proxy · not accounting" — không phải số kế toán chuẩn, chỉ để ước lượng độ lớn rủi ro).

### 5.1 Cancel rate theo lead-time bin

Tạo **calculated column** trên `Fact_Booking` (hoặc làm trong Power Query, cách nào cũng được):

```DAX
Lead Time Bin =
SWITCH(
    TRUE(),
    Fact_Booking[lead_time] <= 7, "0-7d",
    Fact_Booking[lead_time] <= 30, "8-30d",
    Fact_Booking[lead_time] <= 90, "31-90d",
    Fact_Booking[lead_time] <= 180, "91-180d",
    "180d+"
)

Lead Time Bin Order =
SWITCH(
    Fact_Booking[Lead Time Bin],
    "0-7d", 0, "8-30d", 1, "31-90d", 2, "91-180d", 3, "180d+", 4
)
```

Vào **Column tools → Sort by column** → chọn `Lead Time Bin Order` cho cột `Lead Time Bin` để thứ tự trục đúng như `LEAD_ORDER` trong `data.js`.

### 5.2 Cancel rate theo deposit / channel / segment / country

Không cần đo lường riêng — chỉ cần bar chart với Axis = `Dim_Deposit[deposit_type]` / `Dim_Channel[distribution_channel]` / `Dim_Segment[market_segment]` / `Dim_Country[country_code]` (⚠️ không phải `[country]` — xem tên cột đúng ở bảng quan hệ mục 3.1.1) và Values = `[Cancel Rate]`. Muốn lọc nhóm quá nhỏ (giống `minBookings: 50` cho segment trong `data.js`):

```DAX
Segment Cancel Rate (min 50) = IF([Bookings] >= 50, [Cancel Rate])
```
Dùng measure này thay `[Cancel Rate]` trên visual, các nhóm dưới ngưỡng sẽ trả về BLANK và tự ẩn khỏi biểu đồ (bật "Remove blank" ở Filter).

### 5.3 Booking funnel

Tạo 1 bảng disconnected `Funnel Stage` (nhập tay 3 dòng: `Bookings` | `After cancel leak` | `Check-Out`, kèm cột `Order` = 1,2,3):

```DAX
Funnel Value =
SWITCH(
    SELECTEDVALUE('Funnel Stage'[Stage]),
    "Bookings", [Bookings],
    "After cancel leak", [Bookings] - [Canceled Bookings],
    "Check-Out", [Check-Out Bookings]
)
```
Visual: **Funnel chart** chuẩn của Power BI, Category = `Funnel Stage[Stage]` (sort theo `Order`), Value = `[Funnel Value]`.

### 5.4 Box and Whisker (MAQ) — cách chọn trục (2 boxplot Cancellation)

Cài AppSource: **Box and Whisker Chart (MAQ Software)**. Visual này **không có Don't summarize**. Ô Value luôn gộp (Sum/Average/…) nên phải có một cột **grain** (nhiều dòng trong mỗi nhóm) thì mới ra phân phối, không phải 1 box từ 2 số trung bình.

**Không** kéo `Fact_Booking[adr]` / `[ADR (wtd)]` / `booking_key` thẳng vào visual:

| Nếu làm vậy | Hiện tượng |
|---|---|
| Value = Average/Sum of `adr`, không có grain | 1 box (gộp hết, hoặc chỉ còn 2 điểm = 2 trung bình nhóm) |
| Grain = `booking_key` (~82.8k) | Cảnh báo **Too many values. Not showing all data** — visual cắt ~1.000 giá trị trục |
| `SampleIndex` để nhầm ô **Axis category I** | Trục X thành hàng trăm số index, không ra nhãn nhóm |

Cách đúng (giống HTML `adr_cancel_box.json`: mẫu có trần, không ship 82k dòng): tạo **calculated table mẫu ~800 dòng/nhóm**, cột `SampleIndex` = 1…N **lặp lại giữa các nhóm** (unique trên trục grain < 1.000).

Ô field của visual MAQ **không** giống tên: **Axis = grain**, **Axis category I = nhãn box trên trục X**.

| Ô Fields (MAQ) | Vai trò | Điền |
|---|---|---|
| **Axis** | Grain từng điểm (không hiện làm nhãn trục X) | `SampleIndex` |
| **Axis category I** | Nhóm vẽ box — **đây mới là nhãn trục X** | `Cancel Label` hoặc `Lead Time Bin` |
| **Axis category II** | Để trống | — |
| **Value** | ADR từng điểm mẫu | `adr` → **Average** (không Sum, không `[ADR (wtd)]`) |
| **Dots size** | Để trống | — |

Nếu chọn ngược (`Axis` = nhãn nhóm, `Axis category I` = `SampleIndex`) thì trục X ra nhiều index. Đổi lại đúng bảng trên.

#### 5.4.1 `Fact_Adr_Boxplot` — ADR Canceled vs Not canceled

Modeling → New table:

```DAX
Fact_Adr_Boxplot =
VAR SampleN = 800
VAR CanceledRaw =
    TOPN(
        SampleN,
        FILTER(Fact_Booking, Fact_Booking[Cancel Label] = "Canceled"),
        MOD(Fact_Booking[booking_key] * 2654435761 + 12345, 2147483647),
        ASC
    )
VAR NotCanceledRaw =
    TOPN(
        SampleN,
        FILTER(Fact_Booking, Fact_Booking[Cancel Label] = "Not canceled"),
        MOD(Fact_Booking[booking_key] * 2654435761 + 12345, 2147483647),
        ASC
    )
VAR Canceled =
    SELECTCOLUMNS(
        ADDCOLUMNS(
            CanceledRaw,
            "SampleIndex", RANKX(CanceledRaw, Fact_Booking[booking_key],, ASC, DENSE)
        ),
        "Cancel Label", Fact_Booking[Cancel Label],
        "SampleIndex", [SampleIndex],
        "booking_key", Fact_Booking[booking_key],
        "adr", Fact_Booking[adr],
        "hotel", Fact_Booking[hotel],
        "arrival_date", Fact_Booking[arrival_date]
    )
VAR NotCanceled =
    SELECTCOLUMNS(
        ADDCOLUMNS(
            NotCanceledRaw,
            "SampleIndex", RANKX(NotCanceledRaw, Fact_Booking[booking_key],, ASC, DENSE)
        ),
        "Cancel Label", Fact_Booking[Cancel Label],
        "SampleIndex", [SampleIndex],
        "booking_key", Fact_Booking[booking_key],
        "adr", Fact_Booking[adr],
        "hotel", Fact_Booking[hotel],
        "arrival_date", Fact_Booking[arrival_date]
    )
RETURN
UNION(Canceled, NotCanceled)
```

Column tools: `SampleIndex` / `Cancel Label` → Summarization **Don't summarize**; `adr` → **Average**; ẩn `booking_key`. Quan hệ #13–#14 (mục 3.1.1). Visual: mục 8.3 chart **3**.

#### 5.4.2 `Fact_Adr_LeadTime_Boxplot` — ADR theo lead-time bin

Cần cột `Fact_Booking[Lead Time Bin]` (mục 5.1) trước. Modeling → New table:

```DAX
Fact_Adr_LeadTime_Boxplot =
VAR SampleN = 800
VAR Bins =
    DISTINCT(
        SELECTCOLUMNS(Fact_Booking, "BinName", Fact_Booking[Lead Time Bin])
    )
VAR Sampled =
    GENERATE(
        Bins,
        VAR BinName = [BinName]
        VAR Raw =
            TOPN(
                SampleN,
                FILTER(Fact_Booking, Fact_Booking[Lead Time Bin] = BinName),
                MOD(Fact_Booking[booking_key] * 2654435761 + 12345, 2147483647),
                ASC
            )
        RETURN
        SELECTCOLUMNS(
            ADDCOLUMNS(
                Raw,
                "SampleIndex", RANKX(Raw, Fact_Booking[booking_key],, ASC, DENSE)
            ),
            "SampleIndex", [SampleIndex],
            "booking_key", Fact_Booking[booking_key],
            "adr", Fact_Booking[adr],
            "hotel", Fact_Booking[hotel],
            "arrival_date", Fact_Booking[arrival_date]
        )
    )
RETURN
SELECTCOLUMNS(
    Sampled,
    "Lead Time Bin", [BinName],
    "Lead Time Bin Order",
        SWITCH(
            [BinName],
            "0-7d", 0,
            "8-30d", 1,
            "31-90d", 2,
            "91-180d", 3,
            "180d+", 4
        ),
    "SampleIndex", [SampleIndex],
    "booking_key", [booking_key],
    "adr", [adr],
    "hotel", [hotel],
    "arrival_date", [arrival_date]
)
```

Thêm `Lead Time Bin Order` **trong DAX bảng** (không dùng calculated column riêng — dễ circular dependency với Sort by). Column tools: `Lead Time Bin` → **Sort by column** = `Lead Time Bin Order`; `SampleIndex` / `Lead Time Bin` → Summarization **Don't summarize**; `adr` → **Average**; ẩn `booking_key` và `Lead Time Bin Order`. Quan hệ #15–#16. Visual: mục 8.3 chart **5b**.

---

## 6. Đo lường DAX — Pricing Simulator (What-if parameters)

### 6.1 Tạo 3 tham số What-if

**Modeling → New parameter → Numeric range**, mỗi tham số tạo ra 1 bảng disconnected + 1 measure tự động:

| Tham số | Min | Max | Step | Default |
|---|---|---|---|---|
| `ADR Change %` | -30 | 30 | 1 | 5 |
| `Occupancy Change (pp)` | -20 | 20 | 1 | -2 |
| `Cancel Rate Change (pp)` | -15 | 15 | 1 | 0 |

Thêm 1 bảng disconnected thủ công `Elasticity Toggle` (cột `Toggle`: "Off", "On") cho checkbox "Apply soft ADR→Occ elasticity (−0.25)". Đưa 3 tham số + toggle này ra slicer (dùng dạng slider) trên trang Simulator để mô phỏng đúng 4 "lever" của bản HTML.

### 6.2 Đo lường mô phỏng — tính đúng theo từng dòng rồi mới cộng gộp

Đây là điểm quan trọng nhất: `simulate()` trong `data.js` áp dụng công thức cho **từng dòng hotel×tháng** rồi mới gộp có trọng số — nếu bạn gộp trước (`[Occupancy Rate]` đã weighted-average) rồi mới clamp/scenario sau, kết quả sẽ lệch (vì `MIN`/`MAX` phi tuyến). Vì vậy đo lường phải dùng `SUMX` lặp theo dòng, y hệt logic gốc:

```DAX
ADR Δ Mult   = 1 + SELECTEDVALUE('ADR Change %'[ADR Change % Value], 5) / 100
Occ Δ pp     = SELECTEDVALUE('Occupancy Change (pp)'[Occupancy Change (pp) Value], -2) / 100
Cancel Δ pp  = SELECTEDVALUE('Cancel Rate Change (pp)'[Cancel Rate Change (pp) Value], 0) / 100
Elasticity On = SELECTEDVALUE('Elasticity Toggle'[Toggle], "Off") = "On"
Elasticity Adj = IF([Elasticity On], (([ADR Δ Mult] - 1)) * -0.25, 0)

RevPAR (Baseline) =
DIVIDE(
    SUMX(Fact_RevPAR_Monthly, Fact_RevPAR_Monthly[adr] * Fact_RevPAR_Monthly[occupancy_rate] * Fact_RevPAR_Monthly[total_bookings]),
    SUM(Fact_RevPAR_Monthly[total_bookings])
)

RevPAR (Scenario) =
VAR AdrMult = [ADR Δ Mult]
VAR OccPp   = [Occ Δ pp] + [Elasticity Adj]
VAR CxPp    = [Cancel Δ pp]
RETURN
DIVIDE(
    SUMX(
        Fact_RevPAR_Monthly,
        VAR AdrSim    = Fact_RevPAR_Monthly[adr] * AdrMult
        VAR OccStep1  = MIN(0.99, MAX(0.05, Fact_RevPAR_Monthly[occupancy_rate] + OccPp))
        VAR OccSim    = MIN(0.99, MAX(0.05, OccStep1 - CxPp * 0.5))
        RETURN AdrSim * OccSim * Fact_RevPAR_Monthly[total_bookings]
    ),
    SUM(Fact_RevPAR_Monthly[total_bookings])
)

Revenue (Scenario) =
VAR AdrMult = [ADR Δ Mult]
VAR OccPp   = [Occ Δ pp] + [Elasticity Adj]
VAR CxPp    = [Cancel Δ pp]
RETURN
SUMX(
    Fact_RevPAR_Monthly,
    VAR RevparBase = Fact_RevPAR_Monthly[adr] * Fact_RevPAR_Monthly[occupancy_rate]
    VAR AdrSim     = Fact_RevPAR_Monthly[adr] * AdrMult
    VAR OccStep1   = MIN(0.99, MAX(0.05, Fact_RevPAR_Monthly[occupancy_rate] + OccPp))
    VAR OccSim     = MIN(0.99, MAX(0.05, OccStep1 - CxPp * 0.5))
    VAR RevparSim  = AdrSim * OccSim
    VAR Ratio      = DIVIDE(RevparSim, RevparBase, 1)
    RETURN Fact_RevPAR_Monthly[total_revenue] * Ratio
)

Δ RevPAR % (Scenario)  = DIVIDE([RevPAR (Scenario)] - [RevPAR (Baseline)], [RevPAR (Baseline)])
Δ Revenue % (Scenario) = DIVIDE([Revenue (Scenario)] - [Total Revenue], [Total Revenue])
```

Thẻ ADR → Occ và `[Occupancy (Scenario)]`: công thức ở mục **4.8.7** (SUMX + clamp giống `[RevPAR (Scenario)]`).

> Nếu muốn đơn giản hoá cho người mới (chấp nhận sai số nhỏ khi filter nhiều tháng), có thể thay `SUMX` bằng công thức tính trên measure đã gộp (`[ADR]`, `[Occupancy Rate]`) — nhưng đây **không** phải cách bản HTML tính, chỉ dùng khi bạn ưu tiên dễ đọc DAX hơn độ chính xác tuyệt đối.

Visual trang Simulator — chi tiết field thẻ ở mục **4.8.7** và **8.4**:
- 4 thẻ compact (không spark / không CY–PY): `[RevPAR (Baseline)]`, `[RevPAR (Scenario)]` + `[Delta RevPAR % (Scenario)]`, `[Revenue (Scenario)]` + `[Delta Revenue % (Scenario)]`, `[ADR Occ Transition]` + `[Occ Transition Note]`.
- Line chart Baseline vs Scenario theo tháng (2 measure trên cùng trục thời gian `Dim_Date`).
- Bar chart Δ RevPAR % theo tháng.
- Bảng chi tiết (Table visual) liệt kê từng hotel×tháng với baseline/scenario để "Download" (Power BI: Export data từ visual).

---

## 7. Bố cục trang & điều hướng (giống sidebar HTML)

Bản HTML có 4 "view" (Overview / RevPAR / Cancellation / Pricing Simulator) chuyển bằng nút bên trái, không load lại trang. Trong Power BI, tái hiện bằng:

1. Tạo 4 **trang riêng** (page) trùng tên.
2. Dùng **Buttons** (Insert → Buttons → Blank) + **Page navigation action** trỏ tới từng trang, xếp dọc bên trái giống sidebar (đặt cùng vị trí/kích thước trên cả 4 trang, hoặc dùng 1 trang "Theme"/Master visual nếu bạn dùng template).
3. Bộ lọc chung (Hotel, Year, Segment, Channel, Deposit) đặt trong 1 **Slicer panel** bên trái, đồng bộ qua nhiều trang bằng **Sync slicers** (View → Sync Slicers) để lọc toàn bộ 4 trang cùng lúc — tương đương sidebar filter của HTML tác động mọi view.
4. Toggle Light/Dark: Power BI không hỗ trợ đổi theme runtime dễ như CSS; có thể bỏ qua hoặc làm 2 bản báo cáo theme khác nhau nếu thực sự cần.

---

## 8. Cách tạo biểu đồ theo từng trang (field cho từng trục)

Mọi **measure** nằm trong bảng **`_Measures`** (folder `01`…`07`). Mọi **cột** (trục, legend, slicer) kéo từ bảng dimension/fact — **không** kéo measure nhầm folder.

Cách đọc bảng field bên dưới:

| Cột | Ý nghĩa |
|---|---|
| Ô Fields | Ô trên pane Visualizations (X-axis, Values, …) |
| Chọn | Đúng tên object trong model |
| Bảng | Mở bảng này trên pane Data |
| Folder | Chỉ có với measure: `_Measures` → folder này. Cột dimension/fact để `—` |

**Hai họ measure — đừng lẫn khi kéo Values**

| Họ | Folder `_Measures` | Nguồn dữ liệu | Lọc được theo | Visual dùng họ này |
|---|---|---|---|---|
| **Tháng / KPI** | `01 Overview & RevPAR` · `02 Time Intelligence` · `03 Decomposition` · `06 Simulator` · `07 KPI Cards` | `Fact_Revpar_Monthly` | Hotel, Date | KPI Overview/RevPAR, dual-axis Revenue & bookings, heatmap, waterfall, simulator |
| **Booking** | `04 Room Type` · `05 Cancellation` · `[Room Nights]` (nằm folder `01` nhưng nguồn `Fact_Booking`) | `Fact_Booking` | Segment, Channel, Country, Customer type, Status, Deposit, Date, Hotel | Donut channel, bar segment/country, small multiples, cancel, funnel |

`Fact_Revpar_Monthly` **không có** segment/channel/country → `[Total Bookings]` / `[Total Revenue]` trên những visual đó sẽ ra **cùng một số cho mọi thanh**.

**Quy ước tên measure (khác mục 4 vì Power BI không cho trùng tên cột):**

| Trong mục 4 (guide gốc) | Tên measure thật trong model | Folder |
|---|---|---|
| `[ADR]` | `[ADR (wtd)]` | `01 Overview & RevPAR` |
| `[Occupancy Rate]` | `[Occupancy Rate (wtd)]` | `01 Overview & RevPAR` |
| `[RevPAR]` | `[RevPAR (wtd)]` | `01 Overview & RevPAR` |
| `Δ …` | `Delta …` | `02` / `03` / `06` |

**Trục thời gian tháng:** `Dim_Date` → cột `YearMonth` (hoặc `Date` rồi Format → tháng). Slicer năm/tháng: `Dim_Date[Year]` / `MonthName` (sort by `MonthNumber`).

**Slicer dùng chung 4 trang (View → Sync slicers)**

| Slicer | Bảng | Cột |
|---|---|---|
| Hotel | `Dim_Hotel` | `hotel_name` |
| Năm | `Dim_Date` | `Year` |
| Segment | `Dim_Segment` | `market_segment` |
| Channel | `Dim_Channel` | `distribution_channel` |
| Deposit | `Dim_Deposit` | `deposit_type` |

**Mục lục measure** (pane Data → `_Measures` → folder)

| Folder | Measure | Nguồn |
|---|---|---|
| `01 Overview & RevPAR` | `[Total Bookings]`, `[Total Revenue]`, `[ADR (wtd)]`, `[Occupancy Rate (wtd)]`, `[RevPAR (wtd)]`, `[Cancel Rate (Monthly)]`, `[Successful Bookings]`, `[Canceled Bookings (Monthly)]`, `[Latest Month (YearMonth)]`, `[RevPAR (Latest Month)]` | `Fact_Revpar_Monthly` |
| `01 Overview & RevPAR` | `[Room Nights]` | `Fact_Booking` (cả hủy; small multiples Occupancy) |
| `02 Time Intelligence` | `[Total Revenue MoM %]`, `[RevPAR MoM %]`, `[RevPAR YoY %]`, `[Cancel Rate Delta pp (MoM)]`, `[Revenue MoM Label]`, `[Revenue MoM Sign]`, `[RevPAR PM]`, `[RevPAR PY]`, `[Total Revenue PM]`, `[Cancel Rate PM]` — **MoM không gắn lên KPI card** (mục 4.8) | `Fact_Revpar_Monthly` |
| `03 Decomposition` | `[ADR PM]`, `[Occupancy PM]`, `[Delta RevPAR from ADR (MoM)]`, `[Delta RevPAR from Occupancy (MoM)]`, `[Residual (MoM)]`, `[Bridge Value]` (nếu đã tạo) | `Fact_Revpar_Monthly` |
| `04 Room Type` | `[Revenue (Booking)]`, `[Room Nights Sold]`, `[RevPAR (Reserved Room)]`, `[RevPAR (Assigned Room)]` | `Fact_Booking` |
| `05 Cancellation` | `[Bookings]`, `[Canceled Bookings]`, `[Cancel Rate]`, `[No-Show Rate]`, `[No-Show Bookings]`, `[Check-Out Bookings]`, `[Lost Revenue (est.)]`, `[Segment Cancel Rate (min 50)]`, `[Funnel Value]` | `Fact_Booking` |
| `06 Simulator` | `[RevPAR (Baseline)]`, `[RevPAR (Scenario)]`, `[Revenue (Scenario)]`, `[ADR (Scenario)]`, `[Occupancy (Scenario)]`, `[ADR Occ Transition]`, `[Occ Transition Note]`, `[Delta RevPAR % (Scenario)]`, `[Delta Revenue % (Scenario)]` | `Fact_Revpar_Monthly` |
| `07 KPI Cards` | Họ `(CY)` / `(PY)` / `vs PY` / `YoY %` / `(CY by month)` / `(PY by month)` / `Rating` / `Note` — mục **4.8** | `Fact_Revpar_Monthly` + `Fact_Booking` |

### 8.0 Ánh xạ nhanh HTML → Visual

| Biểu đồ HTML | Visual Power BI |
|---|---|
| KPI cards (spark HTML) | **Card (new)** + Line chart spark (mục 4.8.8) — không dùng Card cũ / Multi-row card |
| Revenue & bookings (dual-axis) | Line and clustered column chart |
| Revenue share by channel | Donut chart |
| Customer type small multiples | Line chart + Small multiples + bookmark (Room Nights / Revenue) |
| Market segment / Top countries | Clustered bar chart |
| RevPAR by month | Line chart |
| RevPAR decomposition | Waterfall (cần bảng `Bridge Step`, mục 8.2) |
| ADR × Occupancy (daily) | Scatter chart |
| RevPAR by room type | Clustered column chart |
| ADR × Occupancy (monthly) | Line chart (dual Y-axis) |
| Seasonality heatmap | Matrix + conditional formatting |
| Latest month / monthly table | Bar chart / Table |
| Status mix | Donut chart |
| Cancel & no-show trend | Line chart |
| ADR canceled vs not | Box and Whisker **MAQ**: Axis = `SampleIndex`, Axis category I = `Cancel Label` (`Fact_Adr_Boxplot`, mục 5.4) |
| Booking funnel | Funnel chart |
| Cancel rate by … | Clustered bar chart |
| Baseline vs scenario | Line chart |
| Δ RevPAR by month | Clustered column chart |
| Scenario table | Table + Export data |

---

### 8.1 Trang Overview

**KPI strip (6 thẻ spark)** — anatomy mục **4.8**. Mỗi thẻ = **Card (new)** + Line chart spark bên dưới. **Không** gắn MoM.

Dựng 1 thẻ ADR theo bước 4.8.8, Group, rồi copy 5 lần. Folder reference labels = `07 KPI Cards`.

| Thẻ | Data (folder `01`) | vs PY | YoY | PY \| CY | Spark Y-axis | Rating |
|---|---|---|---|---|---|---|
| Bookings | `[Total Bookings]` | `[Total Bookings vs PY]` (abs, **không** mũi tên) | `[Total Bookings YoY %]` | `[Total Bookings (PY)]` · `[Total Bookings (CY)]` | `[Total Bookings (CY by month)]` + `[Total Bookings (PY by month)]` | — |
| Revenue | `[Total Revenue]` | `[Total Revenue vs PY]` (abs) | `[Total Revenue YoY %]` | `[Total Revenue (PY)]` · `[Total Revenue (CY)]` | `[Total Revenue (CY by month)]` + `[Total Revenue (PY by month)]` | — |
| ADR | `[ADR (wtd)]` | `[ADR vs PY %]` | `[ADR YoY %]` | `[ADR (PY)]` · `[ADR (CY)]` | `[ADR (CY by month)]` + `[ADR (PY by month)]` | `[ADR Rating]` |
| Occupancy | `[Occupancy Rate (wtd)]` | `[Occupancy vs PY %]` | `[Occupancy YoY %]` | `[Occupancy (PY)]` · `[Occupancy (CY)]` | `[Occupancy (CY by month)]` + `[Occupancy (PY by month)]` | `[Occupancy Rating]` |
| RevPAR | `[RevPAR (wtd)]` | `[RevPAR vs PY %]` | `[RevPAR KPI YoY %]` | `[RevPAR (PY)]` · `[RevPAR (CY)]` | `[RevPAR (CY by month)]` + `[RevPAR (PY by month)]` | `[RevPAR Rating]` |
| Cancel rate | `[Cancel Rate (Monthly)]` | `[Cancel Rate M vs PY %]` | `[Cancel Rate M YoY %]` | `[Cancel Rate M (PY)]` · `[Cancel Rate M (CY)]` | `[Cancel Rate M (CY by month)]` + `[Cancel Rate M (PY by month)]` | — invert màu |

Spark X-axis luôn `Dim_Date[MonthName]` (Sort by `MonthNumber`). Cancel rate: Format màu đảo — tăng = cognac `#9A4E1C`, giảm = teal `#0F766E`.

**Không** dùng `[Total Revenue MoM %]` / `[RevPAR MoM %]` / `[Cancel Rate Delta pp (MoM)]` làm callout thẻ.

#### 8.1.1 Dựng 6 thẻ trên canvas — copy thẻ mẫu (Bookings)

MCP modeling **không** đặt visual lên trang. Làm tay trên trang **Overview** (View → Page view → **Fit to page**). Canvas 16:9; chừa ~220 px trái cho sidebar slicer.

**A. Thẻ mẫu Bookings (làm 1 lần, ~3 phút)**

1. Insert → **Card (new)** (icon 1 số lớn; không phải Card 3-cột). Kéo góc: rộng ≈ 1/6 phần nội dung, cao ≈ 140 px. Đặt sát mép trên, ngay phải sidebar.
2. Pane Data → `_Measures` → `01 Overview & RevPAR` → kéo **`[Total Bookings]`** vào **Data**.
3. Cùng visual, kéo tiếp 4 measure folder `07 KPI Cards` vào Data (chúng thành reference label):
   - `[Total Bookings vs PY]`
   - `[Total Bookings YoY %]`
   - `[Total Bookings (PY)]`
   - `[Total Bookings (CY)]`
4. Format visual → **Reference labels**: đổi title lần lượt `vs PY` · `YoY` · `PY` · `CY`. Tắt mũi tên/icon trên `[Total Bookings vs PY]` (HTML `hideArrow`).
5. Format → Callout: Display units **None**, font đậm. Label trên cùng: gõ **Bookings** (hoặc Category label từ tên measure — đổi Display name visual).
6. Insert **Line chart**, đặt sát **dưới** card, cùng chiều rộng, cao ≈ 70 px.
   - X-axis = `Dim_Date` → `MonthName` (Column tools: Sort by `MonthNumber` nếu chưa)
   - Y-axis = `07 KPI Cards` → `[Total Bookings (CY by month)]` **và** `[Total Bookings (PY by month)]`
7. Format line chart: tắt Title, Gridlines, X/Y axis titles; Legend = On, vị trí Bottom, chữ `CY` / `PY`. Series `[Total Bookings (PY by month)]`: **Area**, color `#0F766E`, transparency ~70%. Series CY: **Line**, color `#0F766E`, stroke 2 px. Tắt Show items with no data.
8. Chọn cả card + spark (Shift-click) → **Ctrl+G** (Group). Đặt tên group `KPI Bookings` (Selection pane).

**B. Nhân 5 thẻ còn lại**

1. Selection pane → group `KPI Bookings` → **Ctrl+C** → **Ctrl+V** năm lần.
2. Xếp 6 group một hàng: Bookings · Revenue · ADR · Occupancy · RevPAR · Cancel rate (trái → phải). Align → Distribute horizontally.
3. Từng group: click Card, **xóa 5 measure cũ**, kéo 5 measure mới theo bảng dưới. Spark: xóa 2 measure Y-axis, kéo cặp `(CY by month)` / `(PY by month)` tương ứng. Đổi label card (Bookings → Revenue, …).

| Group | Data | 4–5 reference labels (`07`) | Spark Y-axis (`07`) |
|---|---|---|---|
| Bookings | `[Total Bookings]` | vs PY (abs) · YoY % · (PY) · (CY) | Bookings CY/PY by month |
| Revenue | `[Total Revenue]` | vs PY (abs) · YoY % · (PY) · (CY) | Revenue CY/PY by month |
| ADR | `[ADR (wtd)]` | vs PY % · YoY % · (PY) · (CY) · **`[ADR Rating]`** | ADR CY/PY by month |
| Occupancy | `[Occupancy Rate (wtd)]` | vs PY % · YoY % · (PY) · (CY) · **`[Occupancy Rating]`** | Occupancy CY/PY by month |
| RevPAR | `[RevPAR (wtd)]` | vs PY % · **`[RevPAR KPI YoY %]`** · (PY) · (CY) · **`[RevPAR Rating]`** | RevPAR CY/PY by month |
| Cancel rate | `[Cancel Rate (Monthly)]` | `[Cancel Rate M vs PY %]` · `[Cancel Rate M YoY %]` · `M (PY)` · `M (CY)` | `[Cancel Rate M (CY/PY by month)]` |

4. Màu reference vs PY / YoY: Format → Conditional formatting → Font color → Rules: `> 0` `#0F766E`, `< 0` `#9A4E1C`. **Riêng Cancel rate đảo**: `> 0` `#9A4E1C`, `< 0` `#0F766E`.
5. ADR / Occupancy / RevPAR: Format callout `€#,##0.00` / `0.0%` / `€#,##0.00`.
6. Kiểm tra: không slicer năm → Bookings **82,811**, vs PY vẫn so 2017 vs 2016 (**+3,906**), spark ~8 tháng. Slicer **Year = 2016** → Bookings **40,243** và `[Total Bookings (CY)]` **trùng** giá trị lớn, PY = 2015. Slicer **2017** → Bookings **30,383** = CY.

**1) Revenue & bookings (dual-axis)**

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Line and clustered column chart** | — | — |
| X-axis | `YearMonth` | `Dim_Date` | — |
| Column y-axis | `[Total Revenue]` | `_Measures` | `01 Overview & RevPAR` |
| Line y-axis | `[Total Bookings]` | `_Measures` | `01 Overview & RevPAR` |
| Data labels (tuỳ chọn) | `[Revenue MoM Label]` | `_Measures` | `02 Time Intelligence` |
| Legend | (trống) | — | — |

Nguồn cả hai measure: **`Fact_Revpar_Monthly`**. Format: bật **Secondary y-axis** cho line Bookings. Không có range-brush như HTML → dùng slicer `Dim_Date`.

**2) Revenue share by channel (donut)**

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Donut chart** | — | — |
| Legend | `distribution_channel` | `Dim_Channel` | — |
| Values | `[Revenue (Booking)]` | `_Measures` | `04 Room Type` |

Nguồn Values: **`Fact_Booking`**. ⚠️ Không dùng `[Total Revenue]` (`01 Overview & RevPAR` / `Fact_Revpar_Monthly`) — fact tháng không có channel, donut sẽ sai.

**3) Customer type — small multiples (Occupancy / room-nights)**

Khớp HTML: 3 panel **Transient · Transient-Party · Contract**. Chuyển Revenue ↔ Occupancy bằng **bookmark** (2 visual chồng nhau).

| Ô Fields | Visual Occupancy / room-nights | Visual Revenue (bookmark) |
|---|---|---|
| Visual | **Line chart** | **Line chart** (copy) |
| X-axis | `Dim_Date` → `YearMonth` | `Dim_Date` → `YearMonth` |
| Y-axis | `_Measures` → `01 Overview & RevPAR` → **`[Room Nights]`** (nguồn `Fact_Booking`, **không** dùng `[Room Nights Sold]`) | `_Measures` → `04 Room Type` → **`[Revenue (Booking)]`** (nguồn `Fact_Booking`) |
| Small multiples | `CT Small Multiples` → `customer_type` | `CT Small Multiples` → `customer_type` |
| Legend | (trống) | (trống) |

Format cả 2 visual: Small multiples → Layout **1 hàng × 3 cột**; Filters on this visual: `CT Small Multiples[customer_type]` **is not blank**; đặt 2 chart cùng vị trí/size.

Bookmark: View → Bookmarks. `BM_CT_RoomNights` = hiện chart Room Nights, ẩn chart Revenue. `BM_CT_Revenue` = ngược lại. Gắn vào 2 nút (Buttons → Bookmark).

**4) Market segment mix (horizontal bar)**

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Clustered bar chart** | — | — |
| Y-axis (category) | `market_segment` | `Dim_Segment` | — |
| X-axis (values) | `[Bookings]` | `_Measures` | `05 Cancellation` |

Nguồn Values: **`Fact_Booking`** (`[Bookings]` = `COUNTROWS(Fact_Booking)`). Có thể thay `[Revenue (Booking)]` (`04 Room Type`).

⚠️ **Không** dùng `[Total Bookings]` / `[Total Revenue]` (`01 Overview & RevPAR`) — mọi thanh sẽ ra 82.811. Sort by `[Bookings]` descending. Online TA ≈ 50.391, Offline TA/TO ≈ 12.860, Direct ≈ 11.351.

**5) Top countries (horizontal bar)**

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Clustered bar chart** | — | — |
| Y-axis | `country_code` | `Dim_Country` | — |
| X-axis | `[Revenue (Booking)]` | `_Measures` | `04 Room Type` |
| Filters on this visual | Top N = 10 theo `[Revenue (Booking)]` | `_Measures` | `04 Room Type` |

⚠️ Y-axis dùng `Dim_Country[country_code]`, **không** dùng `Fact_Booking[country]`. Nguồn Values: `Fact_Booking`.

---

### 8.2 Trang RevPAR

**KPI strip (4 thẻ spark)** — cùng anatomy Overview (mục 4.8), nguồn `Fact_Revpar_Monthly`. MoM **không** lên thẻ (nằm ở waterfall mục 8.2-2).

| Thẻ | Data (`01`) | vs PY · YoY · PY\|CY · Spark · Rating (folder `07`) |
|---|---|---|
| RevPAR | `[RevPAR (wtd)]` | `[RevPAR vs PY %]` · `[RevPAR KPI YoY %]` · `(PY)`/`(CY)` · `(CY/PY by month)` · `[RevPAR Rating]` |
| ADR | `[ADR (wtd)]` | `[ADR vs PY %]` · `[ADR YoY %]` · `(PY)`/`(CY)` · by month · `[ADR Rating]` |
| Occupancy | `[Occupancy Rate (wtd)]` | `[Occupancy vs PY %]` · `[Occupancy YoY %]` · `(PY)`/`(CY)` · by month · `[Occupancy Rating]` |
| Revenue | `[Total Revenue]` | `[Total Revenue vs PY]` (abs) · `[Total Revenue YoY %]` · `(PY)`/`(CY)` · by month · không rating |

**1) RevPAR by month (multi-line theo hotel)**

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Line chart** | — | — |
| X-axis | `YearMonth` | `Dim_Date` | — |
| Y-axis | `[RevPAR (wtd)]` | `_Measures` | `01 Overview & RevPAR` |
| Legend | `hotel_name` | `Dim_Hotel` | — |

**2) RevPAR decomposition (waterfall MoM)**

Cần bảng disconnected (Modeling → New table):

```DAX
Bridge Step =
DATATABLE(
    "Step", STRING,
    "Order", INTEGER,
    {
        {"Prev RevPAR", 1},
        {"Δ ADR", 2},
        {"Δ Occupancy", 3},
        {"Curr RevPAR", 4}
    }
)
```

Measure (đặt vào `_Measures` → `03 Decomposition`):

```DAX
Bridge Value =
SWITCH(
    SELECTEDVALUE('Bridge Step'[Step]),
    "Prev RevPAR", [RevPAR PM],
    "Δ ADR", [Delta RevPAR from ADR (MoM)],
    "Δ Occupancy", [Delta RevPAR from Occupancy (MoM)],
    "Curr RevPAR", [RevPAR (wtd)]
)
```

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Waterfall chart** | — | — |
| Category | `Step` (Sort by `Order`) | `Bridge Step` | — |
| Y-axis | `[Bridge Value]` | `_Measures` | `03 Decomposition` |

`[RevPAR PM]` / `[Delta RevPAR from ADR (MoM)]` / `[Delta RevPAR from Occupancy (MoM)]` cũng ở folder `02` / `03`. Sentiment: `Prev RevPAR` / `Curr RevPAR` = **Total**; hai bước Δ = Increase/Decrease theo dấu.

**3) ADR × Occupancy (daily) — scatter**

Dùng **cột** trên `Fact_Daily_AdrOcc`, không dùng measure tháng `[ADR (wtd)]`.

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Scatter chart** | — | — |
| X-axis | `ADR (day)` | `Fact_Daily_AdrOcc` | — |
| Y-axis | `Occupancy Rate (day)` | `Fact_Daily_AdrOcc` | — |
| Values (size — tuỳ chọn) | `Bookings (day)` | `Fact_Daily_AdrOcc` | — |
| Color saturation | `RevPAR (day)` | `Fact_Daily_AdrOcc` | — |
| Details (tooltip grain) | `arrival_date` và/hoặc `hotel` | `Fact_Daily_AdrOcc` | — |

**4) RevPAR by room type (Reserved vs Assigned)**

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Clustered column chart** | — | — |
| X-axis | `room_type` | `Dim_RoomType` | — |
| Y-axis | `[RevPAR (Reserved Room)]` **và** `[RevPAR (Assigned Room)]` | `_Measures` | `04 Room Type` |
| Legend | (tự tạo từ 2 measure) | — | — |

Nguồn: `Fact_Booking` (qua `USERELATIONSHIP` cho assigned).

**5) ADR × Occupancy (monthly dual-axis)**

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Line chart** | — | — |
| X-axis | `YearMonth` | `Dim_Date` | — |
| Y-axis | `[ADR (wtd)]` | `_Measures` | `01 Overview & RevPAR` |
| Secondary Y-axis | `[Occupancy Rate (wtd)]` | `_Measures` | `01 Overview & RevPAR` |

Nguồn: `Fact_Revpar_Monthly`. Kéo measure thứ 2 → Format bật Secondary y-axis.

**6) Seasonality heatmap**

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Matrix** | — | — |
| Rows | `hotel_name` | `Dim_Hotel` | — |
| Columns | `MonthName` (Sort by `MonthNumber`) | `Dim_Date` | — |
| Values | `[RevPAR (wtd)]` | `_Measures` | `01 Overview & RevPAR` |

Format → Cell elements → Background color → Gradient.

**7) Latest month RevPAR by hotel**

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Clustered bar chart** | — | — |
| Y-axis | `hotel_name` | `Dim_Hotel` | — |
| X-axis | `[RevPAR (Latest Month)]` | `_Measures` | `01 Overview & RevPAR` |

**8) Monthly panel (table)**

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Table** | — | — |
| Cột 1 | `hotel_name` | `Dim_Hotel` | — |
| Cột 2 | `YearMonth` | `Dim_Date` | — |
| Cột 3 | `[Total Bookings]` | `_Measures` | `01 Overview & RevPAR` |
| Cột 4 | `[ADR (wtd)]` | `_Measures` | `01 Overview & RevPAR` |
| Cột 5 | `[Occupancy Rate (wtd)]` | `_Measures` | `01 Overview & RevPAR` |
| Cột 6 | `[RevPAR (wtd)]` | `_Measures` | `01 Overview & RevPAR` |
| Cột 7 | `[Total Revenue]` | `_Measures` | `01 Overview & RevPAR` |

---

### 8.3 Trang Cancellation Analysis

Mọi Values trên trang này là họ **Booking** (`Fact_Booking`), folder `05 Cancellation` — **không** dùng `[Cancel Rate (Monthly)]` / `[Total Bookings]` (folder `01`).

**KPI strip (4 thẻ spark)** — nguồn `Fact_Booking` (`05`) cho giá trị lớn; vs PY / YoY / spark / note ở `07`. **Invert màu** cả 4 thẻ. **Không** dùng `[Cancel Rate (Monthly)]` / `[Total Bookings]` (folder `01`).

| Thẻ | Data (`05`) | vs PY · YoY · PY\|CY · Spark (`07`) | Note (`07`) |
|---|---|---|---|
| Cancel rate | `[Cancel Rate]` | `[Cancel Rate vs PY %]` · `[Cancel Rate YoY %]` · `(PY)`/`(CY)` · `(CY/PY by month)` | `[Cancel Rate Note]` (`12,345 canceled`) |
| No-Show rate | `[No-Show Rate]` | `[No-Show Rate vs PY %]` · `[No-Show Rate YoY %]` · `(PY)`/`(CY)` · by month | `[No-Show Rate Note]` |
| Canceled bookings | `[Canceled Bookings]` | `[Canceled Bookings vs PY %]` (**%**, không abs) · `[Canceled Bookings YoY %]` · `(PY)`/`(CY)` · by month | `[Canceled Bookings Note]` (`% of bookings`) |
| Lost revenue (est.) | `[Lost Revenue (est.)]` | `[Lost Revenue vs PY %]` · `[Lost Revenue YoY %]` · `(PY)`/`(CY)` · by month | `[Lost Revenue Note]` = `proxy · not accounting` |

**1) Status mix (donut)**

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Donut chart** | — | — |
| Legend | `reservation_status` | `Dim_Status` | — |
| Values | `[Bookings]` | `_Measures` | `05 Cancellation` |

**2) Cancel & no-show trend**

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Line chart** | — | — |
| X-axis | `YearMonth` | `Dim_Date` | — |
| Y-axis | `[Cancel Rate]` **và** `[No-Show Rate]` | `_Measures` | `05 Cancellation` |

**3) ADR — Canceled vs Not canceled (boxplot)**

Cài AppSource: **Box and Whisker Chart (MAQ Software)**. Dùng bảng mẫu `Fact_Adr_Boxplot` (mục 5.4.1), **không** dùng `Fact_Booking` hay `[ADR (wtd)]`. Ô MAQ: **Axis = grain**, **Axis category I = nhãn** — chọn ngược sẽ ra hàng trăm index trên trục X.

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Box and Whisker Chart (MAQ)** | — | — |
| Axis | `SampleIndex` | `Fact_Adr_Boxplot` | — |
| Axis category I | `Cancel Label` | `Fact_Adr_Boxplot` | — |
| Axis category II | *(trống)* | — | — |
| Value | `adr` → **Average** | `Fact_Adr_Boxplot` | — |
| Dots size | *(trống)* | — | — |

**4) Booking funnel**

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Funnel chart** | — | — |
| Category | `Stage` (Sort by `Order`) | `Funnel Stage` | — |
| Values | `[Funnel Value]` | `_Measures` | `05 Cancellation` |

**5) Cancel rate by lead time**

Giống HTML (toggle Bar % / Boxplot): dựng cả hai visual, hoặc chồng lớp + Bookmark.

**5a) Bar — Cancel rate % theo lead-time bin**

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Clustered bar** hoặc **column** | — | — |
| Axis (category) | `Lead Time Bin` (Sort by `Lead Time Bin Order`) | `Fact_Booking` | — |
| Values | `[Cancel Rate]` | `_Measures` | `05 Cancellation` |
| Tooltips (tuỳ chọn) | `[Bookings]`, `[Canceled Bookings]` | `_Measures` | `05 Cancellation` |

Sort axis theo bin (`0-7d → 8-30d → … → 180d+`), không sort theo %.

**5b) Boxplot — ADR theo lead-time bin**

Cùng visual MAQ và cùng quy tắc trục mục 5.4. Dùng `Fact_Adr_LeadTime_Boxplot` (mục 5.4.2), **không** kéo `Fact_Booking[Lead Time Bin]` + `booking_key`. `Lead Time Bin` phải Sort by `Lead Time Bin Order`.

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Box and Whisker Chart (MAQ)** | — | — |
| Axis | `SampleIndex` | `Fact_Adr_LeadTime_Boxplot` | — |
| Axis category I | `Lead Time Bin` | `Fact_Adr_LeadTime_Boxplot` | — |
| Axis category II | *(trống)* | — | — |
| Value | `adr` → **Average** | `Fact_Adr_LeadTime_Boxplot` | — |
| Dots size | *(trống)* | — | — |

Bản HTML còn Violin — Power BI không có sẵn; bỏ qua.

**6) Cancel rate by deposit / channel / segment**

| Visual | Axis — Bảng → Cột | Values — `_Measures` → `05 Cancellation` |
|---|---|---|
| Clustered bar | `Dim_Deposit` → `deposit_type` | `[Cancel Rate]` |
| Clustered bar | `Dim_Channel` → `distribution_channel` | `[Cancel Rate]` |
| Clustered bar | `Dim_Segment` → `market_segment` | `[Segment Cancel Rate (min 50)]` |

---

### 8.4 Trang Pricing Simulator

**Levers (slicer)** — kéo **cột** từ bảng what-if, không kéo measure `… Value` trừ khi cần Card hiện số.

Bản Power BI mới **không còn Style = Single value**. `SELECTEDVALUE` sẽ thất bại nếu slicer để **Between** (hai núm, chọn một dải) → measure fallback default (ADR +5, Occ −2, Cancel 0) và Scenario trông như “đứng im”.

Với mỗi slicer ADR / Occupancy / Cancel:

1. Field = **cột** what-if (không phải measure).
2. Format → Slicer settings → Options → **Style = Greater than or equal to** (một núm). Slider = On.
3. Không dùng Between.

`[ADR Change % Value]` / `[Occupancy Change (pp) Value]` / `[Cancel Rate Change (pp) Value]` đọc vị trí núm: ≥ → MIN, ≤ → MAX; khi không lọc thì default 5 / −2 / 0.

Cách khác: Style = **Dropdown** + Selection → **Single select** (vẫn dùng được `SELECTEDVALUE`).

| Slicer | Bảng | Cột | Kiểu | Default gợi ý |
|---|---|---|---|---|
| ADR | `ADR Change %` | `ADR Change %` | Greater than or equal to (slider) | 5 |
| Occupancy | `Occupancy Change (pp)` | `Occupancy Change (pp)` | tương tự | -2 |
| Cancel | `Cancel Rate Change (pp)` | `Cancel Rate Change (pp)` | tương tự | 0 |
| Elasticity | `Elasticity Toggle` | `Toggle` | Dropdown / Tile | Off |

**KPI strip (4 Card compact)** — **không** spark, **không** CY–PY. Folder `06 Simulator` trừ `[ADR (wtd)]` ở `01`. Chi tiết DAX mục 4.8.7.

| Thẻ | Data | Reference / callout |
|---|---|---|
| RevPAR baseline | `[RevPAR (Baseline)]` | — |
| RevPAR scenario | `[RevPAR (Scenario)]` | `[Delta RevPAR % (Scenario)]` — màu ≥0 teal, <0 cognac |
| Revenue scenario | `[Revenue (Scenario)]` | `[Delta Revenue % (Scenario)]` |
| ADR → Occ | `[ADR Occ Transition]` | `[Occ Transition Note]` |

Không cần Card riêng `[ADR (wtd)]` / `[ADR (Scenario)]` / `[Occupancy (Scenario)]` — hai measure text đã ghép trước → sau.

**1) Baseline vs scenario RevPAR**

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Line chart** | — | — |
| X-axis | `YearMonth` | `Dim_Date` | — |
| Y-axis | `[RevPAR (Baseline)]` **và** `[RevPAR (Scenario)]` | `_Measures` | `06 Simulator` |

**2) Δ RevPAR by month (%)**

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Clustered column chart** | — | — |
| X-axis | `YearMonth` | `Dim_Date` | — |
| Y-axis | `[Delta RevPAR % (Scenario)]` | `_Measures` | `06 Simulator` |

Format → Data colors → Rules: ≥ 0 teal, < 0 cognac.

**3) Sensitivity (average month)**

HTML: 4 cột Baseline / ADR only (`adr_sim × occ`) / Occ only (`adr × occ_sim`) / Combined. Bảng disconnected `Sensitivity Scenario` + measure `[Sensitivity RevPAR]` (folder `06 Simulator`).

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Clustered column chart** | — | — |
| X-axis | `Scenario` (Sort by `Order`) | `Sensitivity Scenario` | — |
| Y-axis | `[Sensitivity RevPAR]` | `_Measures` | `06 Simulator` |

Không relate bảng này với fact. Lever ADR/Occ/Cancel/Elasticity vẫn lọc Combined và 2 cột only. Combined phải khớp `[RevPAR (Scenario)]`.

**4) Scenario table**

| Ô Fields | Chọn | Bảng | Folder `_Measures` |
|---|---|---|---|
| Visual | **Table** | — | — |
| Cột | `hotel_name` | `Dim_Hotel` | — |
| Cột | `YearMonth` | `Dim_Date` | — |
| Cột | `[ADR (wtd)]` | `_Measures` | `01 Overview & RevPAR` |
| Cột | `[ADR (Scenario)]` | `_Measures` | `06 Simulator` |
| Cột | `[Occupancy Rate (wtd)]` | `_Measures` | `01 Overview & RevPAR` |
| Cột | `[RevPAR (Baseline)]` | `_Measures` | `06 Simulator` |
| Cột | `[RevPAR (Scenario)]` | `_Measures` | `06 Simulator` |
| Cột | `[Total Revenue]` | `_Measures` | `01 Overview & RevPAR` |
| Cột | `[Revenue (Scenario)]` | `_Measures` | `06 Simulator` |
| Cột | `[Delta RevPAR % (Scenario)]` | `_Measures` | `06 Simulator` |
| Cột | `[Delta Revenue % (Scenario)]` | `_Measures` | `06 Simulator` |

Export: visual → **… → Export data**.

---

### 8.5 Thứ tự dựng khuyến nghị

1. Sync slicers + 4 trang trống + nút Page navigation (mục 7).
2. Overview KPI strip (mục 4.8 + 8.1) — Card (new) + spark, đối chiếu số với HTML (cùng bộ lọc).
3. RevPAR: KPI 4 thẻ (8.2) rồi `Bridge Step` + chart (scatter cần `Fact_Daily_AdrOcc`, mục 4.7).
4. Cancellation: funnel + bar dimensions; boxplot dùng `Fact_Adr_Boxplot` / `Fact_Adr_LeadTime_Boxplot` (mục 5.4), không kéo `booking_key`.
5. Simulator: gắn 4 slicer lever trước, rồi KPI + line/bar/table.

---

## 9. Checklist triển khai

- [ ] Import 2 fact CSV + dimension CSV/Power Query, xử lý locale ngày `dd/mm/yyyy` — **bỏ qua** `dim_meal.csv`, `dim_market.csv`, `dim_room.csv`, `dim_customer.csv`
- [ ] Tạo `Dim_Date`, mark as date table, tạo `MonthStartDate` trên `Fact_RevPAR_Monthly`
- [ ] (Tuỳ chọn) Thay `Fact_RevPAR_Monthly` import CSV bằng Calculated Table DAX (mục 3.6) nếu muốn ADR/Occupancy/RevPAR tự tính lại khi có booking mới, không cần rerun Python
- [ ] Tạo `Dim_Segment`, `Dim_Channel`, `Dim_CustomerType` (distinct từ `Fact_Booking`)
- [ ] Tạo `Dim_RoomType` role-playing (active: reserved, inactive: assigned)
- [ ] Setup đủ **12 quan hệ fact chính** theo bảng mục 3.1.1 (#1–#12) — chú ý 2 quan hệ phải tạo tay vì tên cột lệch (`Dim_Hotel[hotel_name]`↔`hotel`, `Dim_Country[country_code]`↔`country`), autodetect sẽ không tự bắt
- [ ] Tạo `Fact_Adr_Boxplot` + `Fact_Adr_LeadTime_Boxplot` (mục 5.4) và 4 quan hệ #13–#16 nếu dựng boxplot Cancellation
- [ ] Viết đo lường nền (weighted ADR/Occupancy/RevPAR) — kiểm tra khớp số với `dashboard-html` ở cùng bộ lọc; gom measure vào bảng `_Measures` + display folder
- [ ] Đo lường MoM/YoY (folder `02`, dùng cho waterfall / chart — **không** gắn MoM lên KPI card), decomposition, cancellation, funnel, lost-revenue proxy
- [ ] KPI cards HTML (folder `07`): helper `[KPI CY Year]` / `[KPI PY Year]`, họ CY/PY/vs PY/YoY/spark/Rating/Note — dựng Card (new) + Line spark theo mục **4.8.8**
- [ ] What-if parameters cho Pricing Simulator + đo lường SUMX theo dòng + `[Occupancy (Scenario)]` / `[ADR Occ Transition]`
- [ ] Tạo `Fact_Daily_AdrOcc` (mục 4.7) + quan hệ `Dim_Hotel` / `Dim_Date`
- [ ] Dựng 4 trang theo mục **8** (field từng trục) + nút điều hướng + sync slicers
- [ ] Cài **Box and Whisker Chart (MAQ Software)**; boxplot: **Axis = `SampleIndex`**, **Axis category I = nhãn nhóm**, Value = Average of `adr` — không dùng `Fact_Booking[booking_key]` (mục 5.4)
- [ ] Đối chiếu số liệu Power BI vs `dashboard-html` (vài tháng mẫu) trước khi publish

## Bản dashboard khác trong repo

| Bản | Thư mục | Trạng thái |
|-----|---------|------------|
| HTML local web | `../dashboard-html/` | Có |
| Power BI | `./Power BI/Hotel Booking Demand v2.pbip` | Hoàn thành — file này dùng để dựng lại / đối chiếu DAX |
