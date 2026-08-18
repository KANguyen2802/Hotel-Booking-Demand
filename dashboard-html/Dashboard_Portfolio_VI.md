# Hotel Booking Demand — Portfolio Dashboard HTML

**Dự án:** Hotel Booking Demand — Dynamic Pricing & Tối ưu Booking
**Sản phẩm:** Dashboard điều hành HTML/JS tĩnh (local web + Vercel)
**Vai trò:** Data Analyst
**Stack:** HTML / CSS / vanilla JavaScript, Chart.js 4, pipeline export Python (pandas)
**Live:** [hotel-booking-demand-dashboard.vercel.app](https://hotel-booking-demand-dashboard.vercel.app)
**Repo:** [github.com/KANguyen2802/Hotel-Booking-Demand](https://github.com/KANguyen2802/Hotel-Booking-Demand)
**Thời gian:** Tháng 8/2026

---

## 1. Executive Summary (Tóm tắt điều hành)

Tài liệu này mô tả kênh dashboard HTML tĩnh của dự án Hotel Booking Demand: một dashboard điều hành single-page, không cần backend, biến 82.811 booking của City Hotel và Resort Hotel thành thông tin ra quyết định về RevPAR, hủy phòng và mô phỏng giá what-if. Dashboard chạy được ở bất cứ đâu có thể phục vụ file tĩnh.

Bản này chạy hoàn toàn trên trình duyệt. Một script pandas nén dữ liệu gốc thành ~15 file JSON tổng hợp sẵn; toàn bộ filter, cross-filter và mô phỏng còn lại xử lý ở phía client, không cần round-trip server.

Ba điểm giá trị chính:

- **Mở tức thì:** chỉ cần một link — không cài Python, không cần license.
- **Filter đa chiều + cross-filter:** hotel / năm / khoảng tháng / segment / kênh / deposit, cộng brush toàn dashboard (click một cột segment → mọi chart lọc lại theo).
- **Kể được câu chuyện định giá bất đối xứng City vs Resort** của dự án qua Pricing Simulator chỉ mang tính khuyến nghị — số liệu chi tiết ở mục 10.

| Kênh phân phối | Vị trí | Trạng thái |
|----------------|--------|------------|
| **HTML/JS static web (tài liệu này)** | `dashboard-html/` | **Đã bàn giao + deploy (Vercel)** |
| Power BI executive pack | `dashboard-powerbi/` | Đang thực hiện |

---

## 2. Limitations & Assumptions (Giới hạn & Giả định)

Gom một chỗ thay vì rải rác — đọc mục này trước khi tin vào bất kỳ con số nào ở các mục sau.

**Ngoài phạm vi**

- Đẩy giá trực tiếp lên OTA hoặc tự động hóa RMS (Revenue Management System) — simulator chỉ mô phỏng what-if, không ghi giá đi đâu cả.
- Drill-through mức dòng booking — dashboard chỉ ship dữ liệu đã tổng hợp (aggregate), có chủ đích, vì lý do quyền riêng tư và kích thước payload.
- Xác thực người dùng — mặc định không có auth; nếu dữ liệu không còn công khai, cần bật Vercel Deployment Protection trước khi mở rộng chia sẻ.

**Giới hạn dữ liệu & mô hình**

- Cửa sổ dữ liệu kết thúc **2017-08** — mọi dải benchmark (STR: chuẩn ngành khách sạn quốc tế; Lisbon: thị trường tham chiếu địa phương) và elasticity nên được coi là hiệu chuẩn lịch sử, cần recalibrate trước khi dùng cho quyết định giá hiện tại.
- Occupancy hiển thị theo ngày (`daily_adr_occ`) là mean ngữ cảnh tháng chiếu xuống ngày — chỉ là xấp xỉ, vì booking không có tồn kho theo đêm thực.
- Boxplot ADR dùng mẫu giới hạn (≤1.500 booking mỗi nhóm hotel × năm × cờ hủy) vì kích thước payload; mean/tứ phân vị chính xác vẫn được ship kèm trong `stats` để audit lại.
- Pricing Simulator là mô hình what-if tuyến tính với elasticity mềm cố định (−0,25), không phải mô hình cầu ước lượng lại theo thời gian thực.

**Giới hạn của các con số nổi bật ở mục 10**

- Win-rate back-test 100% ở City Peak được tính trên **n = 4 tháng Peak** (cửa sổ 2015–2016) — mẫu nhỏ, không phải bằng chứng thống kê mạnh. Nên coi là tín hiệu ban đầu cần xác nhận thêm qua pilot, không phải kết luận cuối cùng.
- Các con số uplift €10k / €59k / €70–85k là **ước tính proxy phản thực tế** (counterfactual, in-sample) từ mô phỏng ADR × Occupancy, không phải kết quả từ một thử nghiệm A/B thật (RCT). Cần đo lại bằng shadow mode trước khi dùng để lập ngân sách.

---

## 3. Project Scope & Objectives (Phạm vi & Mục tiêu)

### Phạm vi

- Xây lại 4 view quyết định điều hành (Overview, RevPAR, Cancellation, Pricing Simulator) dưới dạng single-page app tĩnh cho hai property (City Hotel, Resort Hotel), arrival **07/2015 – 08/2017**.
- Tổng hợp toàn bộ dữ liệu phía server (Python) để không booking-row thô nào đến trình duyệt — chỉ có JSON đã group.
- Tương tác đầy đủ: slider khoảng tháng, range window cho từng chart, brush/cross-filter, tóm tắt box-select, theme sáng/tối.
- Deploy an toàn lên hosting tĩnh công khai (Vercel) với security header và khóa SEO.

### Mục tiêu

1. **Chia sẻ không phụ thuộc:** bất kỳ stakeholder nào có trình duyệt đều mở được dashboard — không cần Python, không server, không license.
2. **Tương đương về quyết định:** cùng định nghĩa KPI và khung định giá bất đối xứng như các báo cáo phân tích.
3. **Tương tác phía client:** filter, brush và mô phỏng what-if tính bằng JS trên aggregate, vẫn mượt trên dữ liệu dẫn xuất từ 82,8 nghìn booking.
4. **Xuất bản an toàn:** hosting tĩnh không được lộ CSV nguồn, credential hay data có thể crawl.

*Phạm vi loại trừ và các giới hạn kỹ thuật khác đã gom về mục 2 — Giới hạn & Giả định.*

---

## 4. Business Question (Câu hỏi kinh doanh)

| # | Câu hỏi kinh doanh | Dashboard HTML trả lời ở đâu |
|---|--------------------|------------------------------|
| Q1 | Tăng trưởng đến từ đâu, và doanh thu đang phụ thuộc bao nhiêu vào một kênh/thị trường? | **Overview** — dải KPI, trend Revenue & bookings hai trục, donut Revenue share by channel, Top countries |
| Q2 | City và Resort khác nhau thế nào về RevPAR, ADR, occupancy theo thời gian? | **RevPAR** — trend có range window, waterfall phân rã MoM (ΔADR vs ΔOccupancy), heatmap mùa vụ, so sánh tháng gần nhất |
| Q3 | Còn dư địa tăng giá mà không mất occupancy không? | **RevPAR** — scatter ADR × Occupancy theo ngày (điểm sáng = RevPAR cao) với tóm tắt box-select cho cụm ngày được chọn |
| Q4 | Rủi ro hủy phòng tập trung ở đâu (lead time, deposit, kênh, segment)? | **Cancellation** — các bar driver có brush/cross-filter, boxplot ADR canceled vs not, booking funnel để định mức overbooking buffer |
| Q5 | RevPAR/doanh thu thay đổi thế nào nếu điều chỉnh ADR, occupancy hoặc cancel rate trong dải kiểm soát? | **Pricing Simulator** — 3 cần gạt (±30% ADR, ±20 pp Occ, ±15 pp Cancel) + elasticity mềm tùy chọn, overlay baseline vs scenario, bar sensitivity, export CSV |
| Q6 | Customer type nào gánh nền doanh thu qua từng tháng? | **Overview** — small multiples cho Transient / Transient-Party / Contract với toggle Revenue ↔ Room-nights |

Mỗi chart mang một caption quyết định bằng tiếng Việt trả lời "so what": ví dụ caption của funnel hướng dẫn dùng chính khoảng hụt giữa hai cột đầu để định mức overbooking buffer thay vì ước lượng cảm tính.

---

## 5. Design Thinking Approach (Cách tiếp cận bằng Design Thinking)

Phần khung vấn đề — Design Thinking (Empathize → Test), Double Diamond, CRISP-DM, và việc xác định "công việc" của từng stakeholder — đã được chốt ở workstream phân tích upstream, trước khi build kênh này. Ở đây chỉ nêu hai framework quyết định trực tiếp đến cấu trúc UI, cộng phần tóm tắt người dùng chính bên dưới.

### Người dùng chính và việc cần làm

- **GM** (Tổng giám đốc) / C-level: nắm nhịp portfolio trong 30 giây.
- **RM** (Revenue Management — bộ phận quản trị doanh thu): stress-test các nước đi **BAR** (Best Available Rate — mức giá bán công bố).
- **FO/Ops** (Front Office / bộ phận vận hành): định vị rủi ro hủy phòng.
- **Finance:** audit lại công thức tính từng chỉ số.

### Hai framework định hình trực tiếp cấu trúc 4 view

| Framework | Vai trò trong sản phẩm này |
|-----------|----------------------------|
| **Decision-centric IA** (kiến trúc thông tin theo hướng quyết định: Tổng quan → Chẩn đoán → Hành động) | Thứ tự view: Overview → RevPAR + Cancellation (chẩn đoán) → Pricing Simulator (hành động, chỉ mang tính khuyến nghị) |
| **Shneiderman's mantra** (Overview first, zoom & filter, details-on-demand) | Filter toàn cục + range window từng chart (zoom) + tóm tắt box-select / brush (chi tiết theo yêu cầu) |

### Quyết định thiết kế riêng cho kênh này

1. **Aggregate thay vì row.** Trình duyệt chỉ thấy JSON đã group (`booking_cube`, panel tháng, mẫu ADR có giới hạn) — không bao giờ thấy 82,8 nghìn row thô, vừa nhẹ tải vừa tránh rò rỉ dữ liệu cá nhân.
2. **Cross-filter là cơ chế "zoom" chính.** Click một segment, kênh, hotel hay tháng sẽ brush toàn dashboard qua một brush state dùng chung — tái hiện cross-filter của công cụ BI bằng vanilla JS.
3. **Kỷ luật hai màu.** Design system (`design-system/hotel-booking-demand/`) ép teal `#0F766E` cho series chính và cognac `#9A4E1C` cho series phụ/CTA; cả theme sáng và tối đều dẫn xuất từ hai token này.
4. **Caption mang quyết định, không mô tả.** Mỗi caption nêu rõ pattern này ngụ ý hành động gì — ví dụ "khoảng cách No Deposit vs có cọc = hiệu lực kỳ vọng của việc siết cọc".
5. **Trade-off, không phải "giá tối ưu".** Simulator luôn hiển thị dải baseline-vs-scenario và sensitivity, không bao giờ đưa ra một con số tối ưu duy nhất — nhất quán với chính sách sàn–khuyến nghị–trần (floor–recommend–ceil) của workstream phân tích.

---

## 6. Dataset Overview (Tổng quan dữ liệu)

| Thuộc tính | Chi tiết |
|------------|----------|
| Nguồn gốc | `hotel_bookings_v5.csv` (panel đã làm sạch) → star-schema CSV trong `data/star schema/` |
| Input trực tiếp của bản build này | `revpar_monthly.csv` (hotel × tháng) + `hotel_bookings_normalized.csv` (1 row = 1 booking) |
| Khối lượng | **82.811** booking, 2 property (City Hotel, Resort Hotel) |
| Cửa sổ thời gian | Tháng arrival **2015-07 → 2017-08** |
| Cancel rate tổng | **28,12%** |
| Ship lên trình duyệt | ~15 file JSON đã tổng hợp (không có row mức booking; mẫu boxplot ADR giới hạn 1.500 mỗi nhóm hotel × năm × cờ hủy, RNG có seed) |

Các aggregate phía trình duyệt (trong `dashboard-html/data/`): `revpar_monthly`, `status_mix`, `segment_mix`, `countries`, `cancel_monthly`, `cancel_lead`, `cancel_deposit`, `cancel_channel`, `cancel_segment`, `booking_cube`, `customer_type_monthly`, `daily_adr_occ`, `room_type_revpar`, `adr_cancel_box`, `meta`.

---

## 7. Data Model Design (Thiết kế mô hình dữ liệu)

Star schema được nén thành mô hình aggregate phía client với ba grain:

| Grain | File | Phục vụ |
|-------|------|---------|
| **Hotel × tháng** | `revpar_monthly`, `cancel_monthly`, `customer_type_monthly` | Dải KPI, đường trend, heatmap mùa vụ, baseline của simulator |
| **Hotel × ngày** | `daily_adr_occ` (kèm map segment theo ngày) | Scatter ADR × Occupancy + tóm tắt box-select |
| **Hotel × năm × dimension** | `status_mix`, `segment_mix`, `countries`, `cancel_lead/deposit/channel/segment`, `room_type_revpar`, `adr_cancel_box` | Chart cơ cấu, driver hủy, so sánh hạng phòng |

Cộng thêm một mini-cube: `booking_cube.json` — grain *hotel × năm × tháng × lead-bin × deposit × kênh × segment × status × quốc gia* với các measure cộng được (`bookings`, `canceled`, `noshow`, `revenue`). Đây là thứ giúp cross-filter phía client khả thi: mọi tổ hợp filter sidebar và brush trên chart đều tái tổng hợp cube trong JS mà không cần round-trip server.

**Quy tắc thiết kế**

- Chỉ measure cộng được (count, sum) đi vào cube; các tỷ lệ (cancel rate, ADR) luôn được tính lại sau khi filter, không bao giờ lấy trung bình từ tỷ lệ đã tính sẵn.
- `lead_time` được bin ở thượng nguồn (`0-7d / 8-30d / 31-90d / 91-180d / 180d+`) để giới hạn cardinality của cube.
- Customer type rút gọn về top 3 theo volume (Transient, Transient-Party, Contract) + Other, khớp với layout small multiples.
- `meta.json` khai báo danh sách hotel, năm và biên tháng để UI dựng filter từ data, không hard-code.

---

## 8. Dashboard Architecture (Kiến trúc Dashboard)

```text
hotel_bookings_v5.csv
        │  scripts/build_star_schema_v5.py
        ▼
data/star schema/*.csv  (revpar_monthly + hotel_bookings_normalized)
        │  dashboard-html/_export_data.py   (pandas → JSON aggregate)
        ▼
dashboard-html/data/*.json   (~15 file aggregate, không row thô)
        │  fetch() khi tải trang
        ▼
┌─ index.html (khung SPA) ──────────────────────────────────────┐
│ sidebar: nav + filter        main: topbar + brush bar + views  │
│                                                                │
│  js/data.js    — store, filter, tổng hợp cube, simulate()     │
│  js/charts.js  — wrapper Chart.js (line/bar/donut/scatter/    │
│                  waterfall/boxplot/violin/heatmap)            │
│  js/rangeBrush.js — range window thời gian theo từng chart    │
│  js/app.js     — state, điều hướng view, pipeline KPI + render│
│  js/theme.js   — chuyển token sáng/tối                        │
└────────────────────────────────────────────────────────────────┘
        │ deploy (chỉ static, .vercelignore chặn _export_data.py)
        ▼
Vercel — header CSP/HSTS · /data/* no-store · robots noindex
```

### Các view — đối tượng, mục đích, cấu trúc biểu đồ, luồng ra quyết định

Bốn view đi theo kiến trúc thông tin hướng quyết định (Tổng quan → Chẩn đoán → Hành động): mỗi trang nhắm vào một "job" của stakeholder cụ thể và kết thúc bằng một quyết định cụ thể, không chỉ là một bức tranh.

#### View 1 — Overview (nhịp portfolio)

| | |
|---|---|
| **Đối tượng** | GM / C-level; thứ cấp là trưởng bộ phận sales & distribution |
| **Mục đích** | Trả lời trong 30 giây: tăng trưởng đến từ đâu, doanh thu đang phụ thuộc bao nhiêu vào một kênh/thị trường — để lãnh đạo biết hôm nay cần đào sâu ở đâu |
| **Đầu ra quyết định** | Chọn vùng cần tập trung hôm nay; duyệt/điều chỉnh ngân sách kênh Direct; cảnh báo tăng trưởng mong manh (segment lớn nhất đồng thời đứng đầu bảng cancel) |

![Overview — dải KPI, trend Revenue & bookings, donut kênh](./screenshots/01-overview.png)
*(chèn ảnh chụp màn hình view Overview ở đây)*

**Cấu trúc biểu đồ (trên → dưới):**

1. **Dải KPI (6 thẻ spark):** Bookings · Revenue · ADR · Occupancy · RevPAR · Cancel rate. Mỗi thẻ: tổng đã filter → **vs PY** (CY vs PY, cùng các tháng; Bookings/Revenue = Δ tuyệt đối) → **YoY** (tháng cuối vs cùng tháng năm trước) → cặp **PY | CY** → sparkline (đường CY + vùng PY). ADR / Occupancy / RevPAR có pill xếp hạng STR/Lisbon; Cancel rate đảo màu (↑ là destructive). MoM không hiện trên thẻ.
2. **Hàng 2 (2 cột):** *Revenue & bookings* — trend hai trục với mini range window (độ lệch giữa hai đường mới là tín hiệu: revenue tăng khi bookings đi ngang = giá đang gánh tăng trưởng; bookings tăng mà revenue phẳng = đang bán rẻ) | *Revenue share by channel* — donut với legend HTML (kênh nào > 50% = rủi ro phụ thuộc)
3. **Hàng 3 (toàn chiều rộng):** *Customer type small multiples* — 3 line chart đồng bộ (Transient / Transient-Party / Contract) với toggle chỉ số Revenue ↔ Room-nights
4. **Hàng 4 (2 cột):** *Market segment mix* — bar, click để cross-filter toàn dashboard | *Top countries* — bar (tập trung địa lý = rủi ro nguồn cầu)

**Cách trang này dẫn tới quyết định:**

1. Đọc dải KPI để nắm nhịp chung.
2. Soi độ lệch revenue/bookings để gọi tên động lực tăng trưởng (giá hay volume).
3. Xem tỷ trọng kênh để đo mức phụ thuộc.
4. Click segment lớn nhất rồi nhảy sang trang Cancellation để kiểm tra tăng trưởng có đang dựa trên nhu cầu không chắc chắn hay không.

#### View 2 — RevPAR (chẩn đoán: giá × lấp phòng)

| | |
|---|---|
| **Đối tượng** | Revenue Management / chuyên viên pricing |
| **Mục đích** | Phân rã biến động RevPAR thành giá (ADR) vs lấp phòng (Occupancy), định vị dư địa tăng giá và mùa vụ, và kiểm chứng con số trước khi hành động |
| **Đầu ra quyết định** | Kéo cần gạt nào (giá hay chương trình cầu), tháng nào cần khóa giá sớm, hạng phòng nào đang rò rỉ doanh thu qua upgrade miễn phí |

![RevPAR — waterfall phân rã MoM ΔADR/ΔOccupancy](./screenshots/02-revpar-waterfall.png)
*(chèn ảnh chụp màn hình waterfall RevPAR ở đây)*

**Cấu trúc biểu đồ (trên → dưới):**

1. **Dải KPI (4 thẻ spark):** RevPAR · ADR · Occupancy · Revenue — cùng stack vs PY / YoY / PY|CY / sparkline như Overview; RevPAR / ADR / Occupancy có pill xếp hạng. MoM nằm ở waterfall, không nằm trên thẻ.
2. **Hàng 2 (rộng-trái):** *RevPAR by month* — line theo từng hotel + range window | *RevPAR decomposition* — waterfall MoM (tháng trước → ΔADR → ΔOccupancy → tháng này) gọi tên động lực một cách tường minh
3. **Hàng 3 (2 cột):** *ADR × Occupancy (daily)* — scatter với độ sáng = RevPAR, kèm box-select kéo khung để tóm tắt cụm ngày đã chọn | *RevPAR by room type* — bar nhóm, reserved vs assigned đặt cạnh nhau
4. **Khối dọc:** *ADR × Occupancy (monthly trend)* — hai đường (cùng tăng = cầu thực, được phép tăng giá; ADR lên trong khi Occ xuống = đã vượt trần chịu giá) · *Seasonality heatmap* — lưới hotel × tháng · *Latest month RevPAR by hotel* — bar so sánh
5. **Monthly panel** — bảng audit (ADR / Occ / RevPAR / Revenue theo hotel-tháng) để kiểm chứng con số trước khi quyết định

**Cách trang này dẫn tới quyết định:**

1. Waterfall cho biết thay đổi tháng vừa rồi do giá hay do lấp phòng → chọn đúng lever tương ứng.
2. Cụm điểm sáng trên scatter ở ADR cao mà occupancy vẫn tốt = còn dư địa tăng giá ở đó.
3. Ô heatmap đậm lặp lại qua các năm = khóa giá sớm; ô nhạt = cần chương trình kích cầu bổ sung, không phải giảm giá phản ứng.
4. Cột assigned thấp hơn reserved = cần sửa quy tắc phân phòng.

#### View 3 — Cancellation (chẩn đoán: thất thoát doanh thu)

| | |
|---|---|
| **Đối tượng** | Front Office / Ops và Revenue Management; người phụ trách chính sách cọc |
| **Mục đích** | Định vị rủi ro cancel & no-show tập trung ở đâu và lượng hóa mức thất thoát, để thay đổi chính sách nhắm đúng nhóm booking |
| **Đầu ra quyết định** | Phạm vi siết cọc/guarantee, kích thước overbooking buffer, kênh nào cần đàm phán lại, segment nào áp guarantee chặt hơn vs segment nào tăng phân bổ tồn phòng |

![Cancellation — driver hủy, boxplot ADR, booking funnel](./screenshots/03-cancellation.png)
*(chèn ảnh chụp màn hình view Cancellation ở đây)*

**Cấu trúc biểu đồ (trên → dưới):**

1. **Dải KPI (4 thẻ spark):** Cancel rate · No-Show rate · Canceled bookings · Lost revenue (est.) — cùng stack vs PY / YoY / PY|CY / sparkline; màu đảo (↑ là destructive). Ghi chú trên thẻ: số booking hủy/no-show, "% of bookings", và *proxy · not accounting*.
2. **Hàng 2 (rộng-phải):** *Status mix* — donut (tỷ trọng thất thoát nền; > 25% → siết cọc trước khi mở thêm kênh bán) | *Cancel & no-show trend* — line + range window (tăng 3 tháng liên tục = rủi ro cấu trúc, tăng một tháng = mùa vụ; no-show tách riêng vì fix bằng reconfirm, không bằng giá)
3. **Hàng 3 (2 cột):** *ADR — Canceled vs Not canceled* — boxplot (nếu median ADR nhóm hủy cao hơn, tiền đang rơi ở dải giá premium) | *Booking funnel* — bar (khoảng hụt giữa hai cột đầu chính là con số overbooking buffer)
4. **Hàng 4 (2 cột):** *Cancel rate by lead time* — với toggle chế độ Bar % / Boxplot / Violin | *Cancel rate by deposit* — bar (khoảng cách giữa No Deposit và các mức có cọc = hiệu lực kỳ vọng của việc siết cọc)
5. **Hàng 5 (2 cột):** *By distribution channel* — bar | *By market segment* — bar

**Cách trang này dẫn tới quyết định:**

1. Mọi chart driver dùng chung một brush: click một bin lead-time, loại deposit, kênh hay segment thì mọi chart khác lọc lại theo, cô lập đúng nhóm booking mà một chính sách sẽ chạm tới.
2. Đọc kênh tệ nhất cùng với tỷ trọng doanh thu ở Overview trước khi quyết định cắt kênh.
3. Lấy khoảng hụt của funnel làm kích thước buffer thay vì ước lượng cảm tính.

#### View 4 — Pricing Simulator (hành động, chỉ mang tính khuyến nghị)

| | |
|---|---|
| **Đối tượng** | Revenue Management + Finance (hội đồng giá) |
| **Mục đích** | Stress-test các nước đi ADR / occupancy / cancel có kiểm soát trên baseline đã filter trước khi pilot, và tạo bằng chứng kịch bản chia sẻ được |
| **Đầu ra quyết định** | Go / no-go cho một nước đi giá pilot trong dải ±15%; file CSV kịch bản là artifact trình hội đồng |

![Pricing Simulator — cần gạt kịch bản và bảng sensitivity](./screenshots/04-pricing-simulator.png)
*(chèn ảnh chụp màn hình Pricing Simulator ở đây)*

**Cấu trúc biểu đồ (trên → dưới):**

1. **Cần gạt kịch bản:** ba slider — ADR change (±30%) · Occupancy change (±20 pp) · Cancel rate change (±15 pp) — cùng toggle elasticity mềm tùy chọn (ADR→Occ −0,25) và nút Reset levers
2. **Dải KPI (4 thẻ compact, không spark/CY–PY):** RevPAR baseline · RevPAR scenario (Δ% so với baseline) · Revenue scenario (Δ% so với baseline) · ADR → Occ (trước → sau)
3. **Hàng 3 (rộng-trái):** *Baseline vs scenario RevPAR* — hai đường (scenario nét đứt) + range window | *Δ RevPAR by month (%)* — bar cho thấy tháng nào hưởng lợi hay chịu thiệt
4. **Sensitivity (average month)** — bar tách riêng hiệu ứng chỉ-ADR vs chỉ-Occ, để hội đồng thấy kết quả thực sự phụ thuộc vào cần gạt nào
5. **Bảng kịch bản + Download CSV** — giá trị baseline vs scenario theo từng tháng, là artifact mang đi

**Cách trang này dẫn tới quyết định:**

1. Toggle elasticity cho phép tái hiện ngay sự bất đối xứng City vs Resort đã trình bày ở mục 10.
2. Một kịch bản chỉ đủ điều kiện pilot nếu nằm trong dải ±15% với ΔRevPAR ≥ 0 dưới giả định elasticity mềm.
3. Simulator không bao giờ ghi giá — file CSV xuất ra là bằng chứng đưa tới hội đồng giá.

### Pattern UX dùng chung

- Filter toàn cục: chip Hotel (multi), chip Năm (multi), slider hai đầu kéo cho khoảng năm-tháng, select Segment / Channel / Deposit; hai nút Reset filters và Reset visuals.
- Range window theo từng chart (mini-chart + cửa sổ kéo được) trên mọi time series.
- Thẻ KPI spark (Overview / RevPAR / Cancellation) dùng chung một anatomy: vs PY (cùng tháng) + YoY (tháng cuối) + cặp PY|CY + sparkline đường CY / vùng PY. KPI Simulator giữ dạng compact (chỉ Δ so với baseline).
- Một brush state dùng chung, hiển thị dưới dạng chip có thể gỡ trong brush bar.
- Toggle theme sáng/tối; toàn bộ màu lấy từ CSS variable của design system.
- Chỉ dùng icon SVG (không emoji icon), focus state hiển thị rõ, block thống kê `aria-live` cho screen reader — theo checklist của design system.

---

## 9. Technical (Kỹ thuật)

| Lớp | Lựa chọn | Lý do |
|-----|----------|-------|
| Markup / cấu trúc | Một file `index.html` duy nhất, các section view bật/tắt theo state của nav | 4 view không cần router; host được ở bất cứ đâu |
| Styling | CSS viết tay với design token (`css/styles.css`), hệ hai màu teal + cognac, Fraunces + Source Sans 3 | Khớp `design-system/hotel-booking-demand/MASTER.md` |
| Chart | Chart.js 4.4.7 (CDN) + `@sgratzl/chartjs-chart-boxplot` 4.4.4 cho boxplot/violin | Nhẹ, canvas-based, viết được plugin tùy biến (waterfall, legend ngoài) |
| State & logic | Module pattern vanilla JS (`data.js` store + pure function; `app.js` điều phối) | Không framework/build step; toàn bộ app xem được bằng view-source |
| Pipeline dữ liệu | Python 3 / pandas / numpy (`_export_data.py`) | Tái dùng star-schema build của dự án; deterministic (sampling có seed) |
| Hosting | Vercel static (hoặc bất kỳ `http.server` nào) | `fetch()` yêu cầu HTTP — trình duyệt chặn `file://` |
| Bảo mật | Header trong `vercel.json`: CSP (chỉ self + jsdelivr + Google Fonts), HSTS preload, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, khóa Permissions-Policy; `/data/*` → `Cache-Control: private, no-store`; `robots.txt` + meta `noindex` | Hosting tĩnh công khai mà không rò rỉ hay cache aggregate; không có secret trong payload |
| Vệ sinh deploy | `.vercelignore` loại `_export_data.py`; chỉ static asset + JSON được ship | CSV nguồn và logic export không bao giờ lên CDN |

---

## 10. Key Findings & Strategic Recommendations (Phát hiện chính & Khuyến nghị chiến lược)

### Phát hiện chính (từ workstream phân tích; dashboard này giúp kiểm chứng trực quan)

*Ghi chú thuật ngữ: **RAISE** / **HOLD** / **CUT** là ba trạng thái hành động chuẩn của playbook định giá — tăng giá trong dải đã duyệt / giữ nguyên giá / giảm giá — dùng xuyên suốt các báo cáo phân tích gốc, giữ nguyên viết hoa để phân biệt với văn bản thường.*

1. **City Peak** chịu được tăng ADR có kiểm soát: +10% ADR → **+2,3% RevPAR**. Đây là kết quả back-test trên **n = 4 tháng Peak** (2015–2016), thắng cả 4/4 (win-rate 100%) — mẫu nhỏ, nên coi là tín hiệu ban đầu cần xác nhận thêm qua pilot chứ chưa phải bằng chứng thống kê mạnh.
2. **Resort Peak** thì ngược lại: cùng mức +10% ADR → **−2,1% RevPAR**. Con số này đến từ mô phỏng what-if theo elasticity, không phải một rule đã chạy thật trong lịch sử (vì chính sách Resort Peak luôn là **HOLD**) — nên đọc như ước tính mô hình, khác cấp độ bằng chứng so với City Peak ở trên. Toggle elasticity của simulator cho phép stakeholder tự tái hiện sự bất đối xứng này.
3. Điểm tối ưu phân tích thuần (~+21% City **RAISE**) quá mạnh để đưa vào áp dụng chính thức; dải vận hành ±15% (sàn–khuyến nghị–trần) cùng dual-objective làm mềm BAR khoảng ~7–8% so với mức tối ưu doanh thu thuần.
4. Hủy phòng tập trung theo deposit type, kênh, segment và lead time dài — các bar driver và funnel của view Cancellation định mức overbooking buffer từ mức hụt quan sát được, không từ cảm tính.
5. Booking bị hủy lệch về ADR cao hơn (view boxplot): doanh thu rơi ở dải giá premium → chính sách cọc/phí hủy cho booking ADR cao hợp lý hơn giảm giá toàn dải.

### Khuyến nghị chiến lược (playbook, chỉ mang tính khuyến nghị)

| Ưu tiên | Hành động |
|---------|-----------|
| R1 | Playbook bất đối xứng: chủ động tăng ADR City Peak trong dải đã duyệt; **HOLD** Resort Peak; Resort Low **CUT** ~−5% |
| R2 | Không đưa mức cực trị +21% vào làm BAR chính thức; giữ dải ensemble + kiểm soát rủi ro |
| R3 | Điều phối booking theo tier hủy (Low frictionless / Med CRM / High buffer → Direct @ BAR) |
| R4 | Giảm phụ thuộc một kênh: theo dõi donut doanh thu theo kênh; ưu tiên refill Direct trước khi dump OTA |
| R5 | Pilot theo giai đoạn 16 tuần với kill switch (walk > 5%/tuần; cancel > +1 pp); dùng ngôn ngữ KPI của dashboard này (ΔRevPAR, Δcancel, walk, Direct mix) để giám sát |

**Tác động mô hình hóa (proxy) — và cách tính ra con số**

Doanh thu portfolio nền dùng làm mẫu số là ~€2,84M/năm (City ~€1,77M + Resort ~€1,07M, năm hóa ×12/26 từ dữ liệu 26 tháng). Ba kịch bản:

| Kịch bản | Cơ sở tính | Uplift ước tính |
|----------|-----------|------------------|
| Bảo thủ | Chỉ áp dụng đúng rule đã back-test: City Peak **RAISE** +10%, Resort Low **CUT** −5% | ~€10k/năm |
| Full in-band | Mô phỏng elasticity đầy đủ trên toàn dải ±15% (làm mềm điểm cực trị +21%) | ~€59k/năm |
| Upside | Full in-band + giả định refill Direct: tiết kiệm ~15% hoa hồng OTA trên ~2–3% room-nights chuyển từ OTA sang Direct (ước tính của RM, chưa kiểm chứng) | ~€70–85k/năm |

Cả ba con số đều là ước tính proxy phản thực tế (counterfactual, in-sample) từ mô phỏng ADR × Occupancy — không phải kết quả đo được từ một thử nghiệm A/B thật, và không phải cam kết P&L. Nên đo lại bằng shadow mode trước khi dùng các con số này để lập ngân sách.

---

## 11. Technical Implementation Notes (Ghi chú triển khai kỹ thuật)

| Chủ đề | Triển khai |
|--------|------------|
| Refresh dữ liệu | `python dashboard-html/_export_data.py` — đọc star-schema CSV, ghi JSON vào `dashboard-html/data/`; fail sớm với thông báo rõ ràng nếu star schema chưa được build |
| Chạy local | `cd dashboard-html && python -m http.server 8765` → `http://localhost:8765` (trình duyệt chặn `fetch` trên `file://`) |
| Deploy | `npx vercel` (preview) / `npx vercel --prod` chỉ từ thư mục `dashboard-html/` — không bao giờ deploy toàn repo |
| Engine cross-filter | Một object brush dùng chung (`hotel`, `year_month`, `month_number`, `segment`, `channel`, …); mọi hàm render đều lọc booking cube + panel tháng qua nó; chip brush hiển thị trong brush bar có thể gỡ bỏ |
| Range window | `rangeBrush.js` ghép mỗi chart chi tiết với một canvas mini overview + cửa sổ hai đầu kéo được; nút "Reset window" theo từng chart |
| Box-select trên scatter | Lớp overlay tùy biến bắt hình chữ nhật kéo trong không gian pixel, ánh xạ ngược ra khoảng ADR/Occ, rồi tóm tắt các ngày khớp (số lượng, tỷ trọng, hủy, room-nights, phân bố segment và năm) |
| Waterfall & legend ngoài | Định hình dataset Chart.js tùy biến (floating bar cho waterfall phân rã RevPAR) + legend HTML (`<ul>` đồng bộ với dataset) để kiểm soát layout |
| Theming | `theme.js` chuyển `data-theme` trên `<html>`; màu chart đọc lại CSS variable khi toggle; palette tối theo design system (bg `#0F1716`, teal `#2DD4BF`, cognac `#D97757`) |
| Accessibility | Bộ icon SVG, `role="slider"` + handle range focus được bằng bàn phím, vùng `aria-live` cho thống kê chart, focus state hiển thị rõ, contrast ≥ 4,5:1 theo checklist design system |
| Tính deterministic | Sampling boxplot ADR dùng `np.random.default_rng(42)` nên export lặp lại cho JSON giống hệt (git diff sạch) |
| Cache busting | Static asset đánh version bằng query string (`?v=YYYYMMDD…`) |

*Giới hạn và giả định đầy đủ (data window, auth, tính chất linear của simulator): xem mục 2 — Giới hạn & Giả định.*

---

## 12. Metrics Calculation Notes (Ghi chú tính toán chỉ số)

Mọi chỉ số tuân theo định nghĩa chung toàn dự án (notebook 01 / build star-schema); tầng JS tính lại các tỷ lệ sau khi filter — không bao giờ lấy trung bình của tỷ lệ đã tính sẵn.

| Chỉ số | Công thức / quy tắc |
|--------|---------------------|
| **Occupancy rate** (hotel-tháng) | `mean(1 − is_canceled)` từ fact tháng |
| **ADR** (hotel-tháng) | `mean(adr)` với `is_canceled = 0` |
| **RevPAR** (hotel-tháng) | `ADR × Occupancy_Rate` |
| **Revenue** | `sum(revenue)` (ADR × số đêm × kết quả lưu trú từ panel đã làm sạch), cộng được qua mọi filter |
| **Cancel rate** (đã filter) | `Σ canceled_bookings / Σ total_bookings` trên các row đã filter |
| **Portfolio ADR** (dải KPI) | `weightedMean(adr, trọng số = successful_bookings)` qua các tháng đã filter |
| **Portfolio Occupancy / RevPAR** (dải KPI) | `weightedMean(·, trọng số = total_bookings)` — trọng số theo booking, không phải mean thô của các row tháng |
| **RevPAR ngày** (scatter) | `mean(adr theo ngày) × mean(occupancy_rate theo ngày)`; độ sáng điểm mã hóa RevPAR |
| **RevPAR theo hạng phòng** | `revenue / room_nights` theo hotel × năm × hạng phòng (fallback về mean RevPAR khi nights = 0), tính cho cả hai phía reserved và assigned |
| **KPI vs PY** | CY (năm lớn nhất trong data) vs PY (CY−1) trên **cùng tập tháng-trong-năm** từ slider/brush. Tỷ lệ/ADR/RevPAR = %; Bookings/Revenue = Δ tuyệt đối (không mũi tên) |
| **KPI YoY** | Tháng cuối trong series đã filter vs cùng tháng lịch năm trước (`pctDelta`). Khác vs PY. MoM không vẽ trên thẻ |
| **KPI sparkline** | Đường tháng CY phủ lên vùng tháng PY, căn theo tháng-trong-năm; legend PY (vùng) / CY (đường). Màu nét theo tone vs PY (đảo trên metric thất thoát) |
| **Dải xếp hạng KPI** | ADR: Excellent ≥ €120 · Good ≥ €105 · Fair ≥ €90 · Weak ≥ €75 (PT/Europe/Lisbon); Occupancy: Excellent ≥ 80% · Good ≥ 72% · Fair ≥ 65% · Weak ≥ 55% (STR); RevPAR: Excellent ≥ €90 · Good ≥ €75 · Fair ≥ €60 · Weak ≥ €45 (PT/Lisbon). Pill = icon + nhãn, không dùng màu đơn độc |

### Công thức simulator (what-if, chỉ mang tính khuyến nghị)

Cho mỗi row hotel-tháng đã filter:

```text
ADR_sim    = ADR × (1 + ΔADR%)
Occ_shift  = ΔOcc_pp  [ + ΔADR% × (−0,25) nếu bật toggle elasticity ]
Occ_sim    = clamp(Occ + Occ_shift − ΔCancel_pp × 0,5, 5%, 99%)
Cancel_sim = clamp(Cancel_base + ΔCancel_pp, 0%, 95%)
RevPAR_sim = ADR_sim × Occ_sim
Revenue_sim = Revenue_base × (RevPAR_sim / RevPAR_base)
```

- Elasticity −0,25 là một prior mềm có chủ đích (tăng ADR +10% tốn −2,5 pp occupancy), phản ánh guardrail của dự án rằng điểm tối ưu doanh-thu-thuần phải được làm mềm.
- Cancel tăng thấm vào occupancy với hệ số 0,5 (một nửa số hủy tăng thêm không bán lại được).
- KPI kịch bản tổng hợp bằng cùng phép mean trọng số booking như baseline, nên baseline và scenario luôn so sánh được.

### Kiểm soát tính toàn vẹn

- City và Resort không bao giờ bị trộn thành một elasticity chung — filter hotel giữ ngữ cảnh property tường minh trên mọi view.
- Cube chỉ ship measure cộng được; mọi tỷ lệ được dẫn xuất tại thời điểm render từ filter + brush đang hoạt động.
- Simulator không ghi giá đi đâu cả; file CSV tải về được dán nhãn là output kịch bản.
- Các con số uplift trích ở mục 10 là proxy phản thực tế từ báo cáo phân tích, không phải P&L do dashboard tính — chi tiết giới hạn ở mục 2.

---

*Tài liệu portfolio cho kênh dashboard HTML của dự án Hotel Booking Demand · Tháng 8/2026*
