# RevPAR — Page Overrides

> Overrides `MASTER.md` for **View: RevPAR** (`#view-revpar`)

---

## Audience & job

Revenue manager: **"Is our growth coming from price or from volume?"** — RevPAR = ADR × Occupancy, theo dõi theo tháng/hotel, tách được đòn bẩy giá vs lấp phòng, tìm dải giá tối ưu.

## Layout

1. KPI strip — 4 square spark cards (`kpi-grid cols-4`). Same stack as Overview: label (+ rating on RevPAR / ADR / Occupancy) → **filtered total** → **vs PY** (Revenue = absolute Δ, no arrow; others = %) → **YoY** (last month vs same calendar month prior year) → **PY | CY** pair → sparkline (CY line + PY area) + PY/CY legend. Cards: RevPAR (+rating) · ADR (+rating) · Occupancy (+rating) · Revenue
2. `grid-2 wide-left` (1.5fr/1fr): **RevPAR by month** (range-brushed multi-line, per hotel) next to **RevPAR decomposition** (waterfall, prev→ΔADR→ΔOcc→curr)
3. `grid-2 equal`: **ADR × Occupancy (daily)** scatter, heat-colored by RevPAR + drag-box-to-summarize, next to **RevPAR by room type** (grouped vertical bar, Reserved vs Assigned)
4. Stacked full-width: **ADR × Occupancy (monthly trend)** dual-axis line → **Seasonality heatmap** (hotel × month) → **Latest month RevPAR by hotel** (horizontal bar)
5. **Monthly panel** — sortable data table (Hotel·Month, Bookings, ADR, Occ, RevPAR, Revenue)

## Color overrides

- No hue overrides — RevPAR/ADR series → `--color-primary` (teal), Occupancy/second hotel series → `--color-accent` (cognac)
- Waterfall: total bars alternate primary (start) / accent (end); delta bars use `--color-positive` for gains, `--color-destructive` for losses; the Occupancy delta step uses `--color-accent-soft`
- Scatter heat: continuous gradient interpolated primary → accent by RevPAR value (not a 3rd hue)
- Seasonality heatmap: same primary→accent gradient by cell value, text always `--color-on-primary` for contrast

## Typography overrides

- No overrides — Master default (Fraunces title, Source Sans 3 body, tabular-nums)

## Charts

| Block | Chart | Notes |
|-------|-------|-------|
| RevPAR by month | Multi-line, range-brushed, one line per hotel | Click point to brush `year_month` |
| RevPAR decomposition | Floating-bar waterfall (MoM) | Caption auto-states whether ADR or Occupancy led the change |
| ADR × Occupancy (daily) | Scatter, color = RevPAR heat | Toggle "Chọn vùng tóm tắt" → drag box → summary card (revenue, ADR/Occ avg, cancel rate, top segments, year/month breakdown) |
| RevPAR by room type | Grouped vertical bar (Reserved vs Assigned) | Gap = free upgrades given away |
| ADR × Occupancy (monthly) | Dual-axis line | Click point to brush `year_month` |
| Seasonality heatmap | Table-based heatmap, hotel rows × month cols | Click a cell to brush `hotel` + `month_number` together |
| Latest month by hotel | Horizontal bar (cognac) | Click bar to brush `hotel` |
| Monthly panel | Data table | Read-only, mirrors current filter/brush state |

## UX notes

- Always keep RevPAR = ADR × Occupancy implicit in caption copy near the KPI/decomposition, not as a separate formula strip element (that pattern from the original spec was dropped — actual UI relies on chart captions instead).
- KPI cards do **not** show MoM; month-on-month movement lives in the waterfall, not the strip.
- Tooltip on scatter: `Day · ADR €x · Occ y% · RevPAR €z`.
- Table has no CSV export button on this page (CSV export exists only on the Pricing Simulator's scenario table).
