# Hotel Booking Demand — Power BI Executive Dashboard

Bản **dashboard điều hành Power BI** cho stakeholder (GM / RM / Finance). Cùng công thức KPI với [`dashboard-html/`](../dashboard-html/) (ADR / Occupancy / RevPAR / cancel) — khác công cụ hiển thị.

> **Trạng thái:** hoàn thành. Project Power BI Desktop (PBIP + TMDL) nằm trong `Power BI/`. Occupancy và RevPAR vẫn là **proxy** (dataset không có inventory phòng).

Hướng dẫn dựng lại từ đầu (star-schema + DAX, khớp `dashboard-html/`): [POWERBI_SETUP_GUIDE.md](POWERBI_SETUP_GUIDE.md)

## Quick start

1. Cài [Power BI Desktop](https://www.microsoft.com/power-bi/download) (bản hỗ trợ **PBIP / TMDL**).
2. Cài visual AppSource **Box and Whisker Chart (MAQ Software)** — dùng trên trang Cancellation.
3. Mở file project:

```text
dashboard-powerbi/Power BI/Hotel Booking Demand v2.pbip
```

4. **Data source settings** → sửa đường dẫn CSV cho khớp máy bạn. Query hiện trỏ tới:

```text
…/Python/data/star schema/hotel_bookings_normalized.csv
…/Python/data/star schema/revpar_monthly.csv
…/Python/data/star schema/dim_*.csv
```

5. **Home → Refresh**. Kiểm tra vài tháng mẫu so với [dashboard HTML](https://hotel-booking-demand-dashboard.vercel.app) trước khi chia sẻ.

Rebuild CSV nếu cần:

```bash
python scripts/build_star_schema_v5.py
```

## Trang báo cáo

Canvas **2560px** rộng, chiều cao cuộn (~3280–3600px). Điều hướng bằng **page navigator** + slicer đồng bộ (Hotel, Year, Segment, Channel, Deposit).

| Trang | Việc stakeholder làm | Visual chính |
|-------|----------------------|--------------|
| **Overview** | 30 giây nắm booking, revenue, ADR, Occ, RevPAR, cancel (thẻ spark vs PY / YoY) | KPI cards, Revenue & bookings, channel share, segment mix, top countries, customer-type small multiples |
| **RevPAR** | So City vs Resort theo tháng; tách ΔADR vs ΔOcc | Dual-axis ADR × Occ, scatter ngày, waterfall, heatmap mùa, RevPAR by room type (reserved vs assigned) |
| **Cancellation** | Driver hủy + funnel overbooking | Cancel by lead / deposit / channel / segment, boxplot ADR, funnel, lost-revenue proxy |
| **Pricing Simulator** | What-if ADR / Occ / cancel trong band — **không** xuất một “giá tối ưu” duy nhất | Parameter slicer, Δ RevPAR / Δ revenue, baseline vs scenario, sensitivity |

Slicer Segment / Channel / Deposit **không** lọc biểu đồ trên trang RevPAR: `Fact_Revpar_Monthly` đã tổng hợp sẵn, không còn các chiều đó — đúng hành vi bản HTML.

## Kiến trúc model

Hai fact dùng chung `Dim_Hotel` và `Dim_Date`. Dimension mô tả chỉ relate vào `Fact_Booking`.

```text
Dim_Date ──1───*── Fact_Booking
    │                  ├── Dim_Segment / Dim_Channel / Dim_CustomerType
    │                  ├── Dim_Deposit / Dim_Status / Dim_Country / Dim_Agent
    │                  └── Dim_RoomType (active: reserved · inactive: assigned)
    └──1───*── Fact_Revpar_Monthly
Dim_Hotel ──1───*── cả hai fact (+ Fact_Daily_AdrOcc, boxplot samples)
```

Mọi measure nằm trong bảng **`_Measures`** (~128 measure), chia folder:

| Folder | Dùng cho |
|--------|----------|
| `01 Overview & RevPAR` | Weighted ADR / Occupancy / RevPAR, volume, revenue |
| `02 Time Intelligence` | MoM / YoY — dùng cho chart, **không** gắn lên KPI card |
| `03 Decomposition` | Waterfall ΔADR vs ΔOcc |
| `04 Room Type` | Reserved vs assigned (`USERELATIONSHIP`) |
| `05 Cancellation` | Cancel rate, lost revenue, funnel |
| `06 Simulator` | What-if + elasticity toggle |
| `07 KPI Cards` | CY / PY / vs PY / YoY / spark / rating |

Tên measure khác cột nguồn vì Power BI không cho trùng: `[ADR (wtd)]`, `[Occupancy Rate (wtd)]`, `[RevPAR (wtd)]`.

### Bảng trong semantic model

| Nhóm | Bảng | Nguồn |
|------|------|--------|
| Fact import | `Fact_Booking`, `Fact_Revpar_Monthly` | CSV star-schema |
| Dim import | `Dim_Hotel`, `Dim_Country`, `Dim_Deposit`, `Dim_Status`, `Dim_Agent`, `Dim_Segment`, `Dim_Channel` | CSV / distinct từ fact |
| Dim / fact DAX | `Dim_Date`, `Dim_RoomType`, `Dim_CustomerType`, `Fact_Daily_AdrOcc`, `Fact_Adr_Boxplot`, `Fact_Adr_LeadTime_Boxplot` | Calculated table |
| What-if | `ADR Change %`, `Occupancy Change (pp)`, `Cancel Rate Change (pp)`, `Elasticity Toggle`, `Sensitivity Scenario`, `Funnel Stage`, … | Parameter / calculated |

**Không import** `dim_meal.csv`, `dim_market.csv`, `dim_room.csv`, `dim_customer.csv` (junk dimension không có khóa trên fact).

## Cấu trúc thư mục

```text
dashboard-powerbi/
├── README.md
├── POWERBI_SETUP_GUIDE.md          # dựng lại từ đầu, field từng visual
└── Power BI/
    ├── Hotel Booking Demand v2.pbip
    ├── Hotel Booking Demand v2.Report/          # 4 trang + bookmark + theme
    └── Hotel Booking Demand v2.SemanticModel/   # TMDL: bảng, quan hệ, DAX
```

Không có file `.pbix` trên repo — mở `.pbip` trong Power BI Desktop. Cache local (`.pbi/localSettings.json`, `cache.abf`) đã gitignore.

## Gotchas

- **`Fact_Booking[occupancy_rate]` / `[revpar]`** là giá trị *cả ngày*, lặp trên mọi booking của ngày đó. KPI ADR / Occ / RevPAR **luôn** lấy từ `Fact_Revpar_Monthly` (weighted), không `AVERAGE()` trên booking-level.
- Cột `arrival_date` parse **dd/mm/yyyy** (locale UK). Detect Data Type mặc định (M/D/Y) sẽ đảo ngày.
- `Dim_Hotel[hotel_name]` ↔ `hotel` và `Dim_Country[country_code]` ↔ `country` — tên cột lệch, quan hệ phải tạo tay.
- Boxplot Cancellation: Axis = `SampleIndex`, category = nhãn nhóm, Value = Average of `adr`. Không kéo `Fact_Booking[booking_key]`.
- Occupancy = `successful_bookings / total_bookings`; RevPAR = ADR × Occupancy. Không suy diễn P&L kế toán.

## Bản dashboard khác trong repo

| Bản | Thư mục | Trạng thái |
|-----|---------|------------|
| HTML local web | [`../dashboard-html/`](../dashboard-html/) | Live — [Vercel](https://hotel-booking-demand-dashboard.vercel.app) |
| Power BI | `./` | Hoàn thành — mở `Power BI/Hotel Booking Demand v2.pbip` |
