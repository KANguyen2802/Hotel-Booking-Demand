# Cancellation Analysis — Page Overrides

> Overrides `MASTER.md` for **View: Cancellation Analysis** (`#view-cancellation`)

---

## Audience & job

Ops + revenue: **"Where is revenue leaking before it even arrives?"** — ai hủy, khi nào, lead time, kênh, deposit — để giảm cancel/no-show mà không cắt demand tốt.

## Layout

1. KPI strip — 4 square spark cards (`kpi-grid cols-4`). Same stack as Overview: label → **filtered total** → **vs PY** → **YoY** → **PY | CY** pair → note → sparkline (CY line + PY area) + PY/CY legend. Cards: Cancel rate · No-Show rate · Canceled bookings · Lost revenue (est.). Color inverted for leak metrics (rate/count/lost ↑ is destructive). Visible `.kpi-note` (also mirrored on the card `title`): canceled/no-show counts, "% of bookings", and "proxy · not accounting"
2. `grid-2 wide-right` (0.72fr/1.55fr): **Status mix** (donut Check-Out/Canceled/No-Show) next to **Cancel & no-show trend** (range-brushed multi-line)
3. `grid-2 equal`: **ADR — Canceled vs Not canceled** (boxplot) next to **Booking funnel** (horizontal bar, stage values descending)
4. `grid-2 equal`: **Cancel rate by lead time** (Bar % / Boxplot / Violin — segmented toggle) next to **Cancel rate by deposit** (horizontal bar %)
5. `grid-2 equal`: **By distribution channel** (horizontal bar %) next to **By market segment** (horizontal bar %, min 50 bookings, top 10)

## Color overrides (status-first)

| Status | Token | Note |
|--------|-------|------|
| Check-Out | `--color-primary` (teal) | Healthy |
| Canceled | `--color-accent` (cognac) | Primary risk |
| No-Show | `--color-noshow` (`#8B9594` light / `#8A9694` dark) | Distinct grey, not a 3rd chromatic hue |
| Neutral / dimmed | `--color-grid` | Dimmed bars when a brush filter is active elsewhere |

- Two-hue system holds even here: no red/green traffic-light coding — status is separated by **hue + label**, not alarm color, per Master's "avoid extra chromatic colors" rule.
- Deposit bar uses `--color-accent`, Channel bar uses `--color-accent-soft`, Segment bar uses `--color-primary-soft` — three distinct-but-related tints so the three "by X" bar charts stay visually distinguishable at a glance without leaving the two-hue family.

## Charts

| Block | Chart | Notes |
|-------|-------|-------|
| Status mix | Donut + external legend | Click slice to brush `status` |
| Cancel & no-show trend | Range-brushed multi-line (Cancel % solid, No-Show % dashed) | Click point to brush `year_month` |
| ADR — Canceled vs Not canceled | Boxplot (n/min/Q1/median/Q3/max/mean tooltip) | Caption states which group has higher ADR and the pricing implication |
| Booking funnel | Horizontal bar, stage values | Gap between first two bars = rooms lost to cancellation |
| Cancel rate by lead time | Toggle: Bar % ↔ Boxplot ↔ Violin | Bar = simple rate; Boxplot/Violin = distribution across hotel-months. Click bar to brush `lead_bin` |
| Cancel rate by deposit | Horizontal bar %, sorted ascending | Click to brush `deposit_type` |
| By distribution channel | Horizontal bar %, sorted ascending | Click to brush `channel` |
| By market segment | Horizontal bar %, sorted ascending, filtered to ≥50 bookings | Click to brush `segment` |

## UX notes

- Filter/brush dims available here: hotel, year, month range, segment, channel, deposit — same shared sidebar as all views (see `dashboard.md`).
- Leak-metric KPI color is **inverted** on both vs PY and YoY (rate/count/lost ↑ = destructive). Notes stay on the card face (`.kpi-note`), not only in `title`.
- Each dimension chart **excludes its own brush key** when querying (`{ ...brush, lead_bin: undefined }` etc.) so the just-brushed bar/segment stays visible for re-selection or comparison instead of disappearing.
- Empty states: table/chart falls back to a centered "Không có dữ liệu" message (`.empty`) when a filter combination returns zero rows.
- No explicit "Open simulator" CTA link exists in the current UI — cross-page navigation is via the sidebar nav only.
