# Overview — Page Overrides

> Overrides `MASTER.md` for **View: Overview** (`#view-overview`, default view on load)

---

## Audience & job

CEO / executive, 30 giây: **"Are we winning this month?"** — tăng trưởng đến từ đâu (giá hay volume), doanh thu phụ thuộc bao nhiêu vào một kênh, mix khách/thị trường có rủi ro tập trung không.

## Layout

1. KPI strip — 6 square spark cards (`kpi-grid`, no `cols-4`). Stack: label (+ rating pill on ADR / Occupancy / RevPAR) → **filtered total** → **vs PY** (CY vs PY, same months; Bookings / Revenue = absolute Δ, no arrow) → **YoY** (last month vs same calendar month prior year) → **PY | CY** pair → sparkline (CY line + PY area) + PY/CY legend. Cards: Bookings · Revenue · ADR (+rating) · Occupancy (+rating) · RevPAR (+rating) · Cancel rate (arrow follows the number; color inverted — cancel ↑ is destructive)
2. `grid-2` (1.55fr/1fr): **Revenue & bookings** (range-brushed dual-line, teal=Revenue solid / cognac dashed=Bookings) next to **Revenue share by channel** (donut + external legend)
3. Full-width panel: **Customer type — small multiples**, 3 mini line charts (Transient / Transient-Party / Contract) with a segmented toggle Revenue ↔ Occupancy/room-nights
4. `grid-2 equal`: **Market segment mix** (horizontal bar, click to brush) next to **Top countries** (horizontal bar, click to brush)

## Color overrides

- No hue overrides — Master palette as-is: Revenue/primary series → `--color-primary` (teal), Bookings/secondary series → `--color-accent` (cognac)
- Donut slices use the shared categorical palette: `[primary, accent, noshow(#8B9594), primary-soft, accent-soft, muted-fg]`
- Small-multiples lines: Transient → primary, Transient-Party → accent, Contract → primary-soft

## Typography overrides

- No overrides — Fraunces page title, Source Sans 3 body/labels, `tabular-nums` on KPI values (Master default)

## Charts

| Block | Chart | Notes |
|-------|-------|-------|
| Revenue & bookings | Dual-line, range-brushed (mini overview + draggable window) | `HBDCharts.dualAxisTrend` via `HBDRange`; click a point to brush `year_month` |
| Revenue share by channel | Donut + external HTML legend (`Label · n%`) | Click slice or legend item to brush `channel` |
| Customer type (×3) | Small multiple line charts | Metric toggle (segmented control) switches Revenue ↔ Room-nights for all 3 at once |
| Market segment mix | Horizontal bar (teal), sorted | Click bar to brush `segment` |
| Top countries | Horizontal bar (cognac), sorted, top 10 | Click bar to brush `country` |

## UX notes

- Every `chart-caption` states what the pattern *means for a decision* (e.g. "kênh nào chiếm quá nửa doanh thu là rủi ro phụ thuộc"), not just a metric description.
- Cancel rate KPI delta color is **inverted** on both **vs PY** and **YoY**: cancel rate ↑ shows as `down` (destructive), not `up` — a rising cancel rate is bad even though the number went up.
- MoM is **not** shown on KPI cards (computed internally only). The headline comparison is CY vs PY for the aligned month set; YoY is the last-month check.
- No "Book now" CTA, no photos — analytics only.

## Components

- Filter chips (hotel/year), year-month range slider, segment/channel/deposit selects — all shared with `dashboard.md` app-shell spec
- No page-specific unique components
