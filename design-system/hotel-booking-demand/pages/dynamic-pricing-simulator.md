# Dynamic Pricing Simulator — Page Overrides

> Overrides `MASTER.md` for **View: Pricing Simulator** (`#view-simulator`)

---

## Audience & job

Revenue analyst, what-if: **"What happens if we change the price — before we actually change it?"** — chỉnh ADR% / Occupancy pp / Cancel rate pp (± optional elasticity) → xem RevPAR & Revenue đổi thế nào so với baseline thực tế đã lọc.

## Layout (tool-first)

1. **Scenario levers** panel (`.sim-levers`, full-width, above KPIs) — 3-column slider grid: ADR change (%), Occupancy change (pp), Cancel rate change (pp) + checkbox "Apply soft ADR→Occ elasticity (−0.25)" + "Reset levers" button in the panel header
2. KPI strip — 4 **compact delta cards** (`kpi-grid cols-4`), not spark/CY–PY cards: RevPAR baseline · RevPAR scenario (+Δ% vs baseline) · Revenue scenario (+Δ% vs baseline) · ADR→Occ (baseline → scenario, both values inline). Scenario cards stay simple so the lever delta is the only comparison on this page.
3. `grid-2 wide-left`: **Baseline vs scenario RevPAR** (range-brushed dual-line) next to **Δ RevPAR by month (%)** (signed bar, teal=positive/cognac=negative)
4. Full-width: **Sensitivity (average month)** — 4-bar comparison: Baseline / ADR only / Occ only / Combined
5. Full-width: **Scenario table** with "Download CSV" (primary button, only page with a CSV export)

## Color overrides

- No hue overrides. Baseline series → `--color-primary` (teal, solid); Scenario series → `--color-accent` (cognac, dashed `[5,4]`) — consistent with every other baseline-vs-alt comparison in the app (RevPAR by hotel, decomposition waterfall)
- Δ RevPAR signed bars: positive → `--color-primary`, negative → `--color-accent` (not green/red — stays in the two-hue system)
- Sensitivity bars: `[muted-fg, primary, primary-soft, accent]` for `[Baseline, ADR only, Occ only, Combined]`

## Typography overrides

- No overrides — Master default. Slider value readouts (`#valAdr` etc.) use `tabular-nums` + `font-weight: 600` in `--color-accent` for quick scanning while dragging

## Charts

| Block | Chart | Notes |
|-------|-------|-------|
| Baseline vs scenario RevPAR | Range-brushed dual-line (solid vs dashed) | Same `HBDRange` component used across all views |
| Δ RevPAR by month (%) | Signed vertical bar | Sign flips color (teal ↑ / cognac ↓), not just direction |
| Sensitivity (average month) | 4-category vertical bar | Isolates ADR-only vs Occupancy-only contribution vs combined effect |
| Scenario table | Data table, one row per hotel·month | Columns: ADR/ADR sim, Occ/Occ sim, RevPAR/RevPAR sim, Revenue/Revenue sim |

## Motion

- Slider `input` event re-renders immediately (no artificial debounce in current code — keep renders cheap, not the UI, if performance ever requires one)
- No full-page morph/glass transition when switching into this view — same instant `.view.active` swap as every other tab

## Components

- 3× range slider + live numeric readout, 1× checkbox (elasticity toggle) — all inside `.sim-levers-grid` (3-col, collapses to 1-col ≤1200px)
- Primary CTA in this view is **"Download CSV"** (`.btn-primary`, cognac) — the only primary-colored button in the whole app, reserved for data export
- "Reset levers" uses `.btn-secondary` (tinted primary), matching the sidebar's "Reset filters"
- Levers persist across filter changes but reset to defaults (ADR +5%, Occ −2pp, Cancel 0pp, elasticity off) via "Reset levers"
