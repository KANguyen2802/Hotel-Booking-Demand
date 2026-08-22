# App Shell — Shared Layout Overrides

> **PROJECT:** Hotel Booking Demand
> **Scope:** Chrome shared by **all 4 views** (Overview, RevPAR, Cancellation, Pricing Simulator) — i.e. `index.html` outside of `<section class="view">`.
> Page-specific chart/content rules live in `overview.md`, `revpar.md`, `cancellation-analysis.md`, `dynamic-pricing-simulator.md`.

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`). Only deviations are documented here.

---

## Layout

- **Frame:** CSS grid `var(--sidebar-w) 1fr` (`--sidebar-w: 280px`), single persistent shell — views swap via `.view.active`, not page navigation.
- **Breakpoints:** ≤1200px → KPI grid drops to 2–3 cols, `.grid-2` variants collapse to 1 col. ≤900px → sidebar becomes a non-sticky top block, single column.
- **No max-width cap on `.main`** — it fills the remaining viewport (`padding: var(--space-2xl) var(--space-3xl) var(--space-3xl)`), unlike a marketing page's centered 1200px container.

### Sidebar (`.sidebar`)

1. Brand (`h1` only — no tagline/logo image)
2. View nav — 4 icon+label buttons (`data-view`), active state = `--color-fill` bg + `--color-primary` text/icon
3. Filters — Hotel chips, Year chips, Year-month range slider (custom drag component, not `<input type="range">`), Market segment / Distribution channel / Deposit selects
4. Sticky-bottom actions — "Reset filters" (secondary), "Reset visuals" (ghost)

### Topbar (`.topbar`, inside `.main`)

- Left: page title (`h2.page-title`, with a 2px teal→cognac gradient underline) + one-line subtitle framed as a **question** (e.g. "Are we winning this month?")
- Right: theme toggle icon button only — no other global actions here

### Brush bar (`.brush-bar`, conditional)

- Appears only when a cross-filter ("brush") is active from clicking a chart element (segment, channel, status, month, lead bin, deposit, country, hotel)
- Shows removable chips per active brush dimension + "Clear brush" button
- Background: `--color-fill` tint with a `--color-primary`-tinted border — visually distinct from the sidebar filter chips

## Color Overrides

- No page-specific hue overrides — shell uses Master palette as-is (teal `--color-primary` / cognac `--color-accent`).
- Full dark-mode support via `[data-theme="dark"]` token swap (see `MASTER.md` dark mode block); toggled by `#btnTheme`, persisted, re-renders all charts (`themechange` event) so Chart.js colors stay in sync.

## Typography Overrides

- No overrides — Fraunces for `page-title`/`panel-title`, Source Sans 3 for body, `tabular-nums` on every KPI/table value (Master already specifies this).

## Component Overrides

- **KPI card grid** (`.kpi-grid`): 6 cols on Overview, 4 cols (`.kpi-grid.cols-4`) on RevPAR / Cancellation / Simulator.
- **Spark KPI card** (Overview, RevPAR, Cancellation — `.kpi-card--spark`): head (label + optional rating pill) → **filtered total** → **vs PY** (`.kpi-year`, CY vs PY on the aligned month set; volume cards use absolute Δ with no arrow) → **YoY** (`.kpi-var`, last month vs same calendar month prior year) → **PY | CY** pair (`.kpi-yp`) → optional `.kpi-note` → sparkline (CY line + PY area, edge-to-edge) + PY/CY legend. MoM is not shown on cards.
- **Rating pill** (`.kpi-rating--excellent|good|fair|weak|poor`): 5-band color+icon+label (never color alone) on ADR / Occupancy / RevPAR against fixed hospitality benchmarks.
- **Simulator KPI cards** stay compact (value + Δ% vs baseline only) — no spark, no CY/PY pair.
- **Panel** (`.panel`): every chart/table lives in one; header row = title + optional segmented control or ghost "Reset window" button; one `chart-caption` sentence right under the header that states the **decision**, not just the metric (see each page file for exact copy pattern).
- **Range brush** (`.range-chart` + mini overview canvas + draggable window): used on every time-series panel across all 4 views (Overview trend, RevPAR trend, Cancel trend, Sim trend) — a shared component, not page-specific.
- **External chart legend** (`.chart-legend-item`, HTML not Chart.js-native): clickable to isolate a series/slice; used identically on donuts, dual-line, and multi-line charts app-wide.

## Recommendations

- Any new shared chrome (new filter, new global action) belongs here, not duplicated across the 4 page files.
- Keep KPI copy as plain metric + vs PY / YoY (or scenario Δ% on Simulator) — no marketing framing ("Congrats!", "You're crushing it").
