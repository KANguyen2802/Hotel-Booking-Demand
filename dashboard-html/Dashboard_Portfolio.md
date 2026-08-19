# Hotel Booking Demand — HTML Dashboard Portfolio

**Project:** Hotel Booking Demand — Dynamic Pricing & Booking Optimization
**Artifact:** Static HTML/JS Executive Dashboard (local web + Vercel)
**Role:** Analytics Team Lead
**Stack:** HTML / CSS / vanilla JavaScript, Chart.js 4, Python (pandas) export pipeline
**Live:** [hotel-booking-demand-dashboard.vercel.app](https://hotel-booking-demand-dashboard.vercel.app)
**Repo:** [github.com/KANguyen2802/Hotel-Booking-Demand](https://github.com/KANguyen2802/Hotel-Booking-Demand)
**Date:** August 2026

---

## 1. Executive Summary

This portfolio piece documents the static HTML dashboard channel of the Hotel Booking Demand project: a zero-backend, single-page executive dashboard that turns 82,811 City and Resort bookings into RevPAR, cancellation, and pricing what-if intelligence. It deploys anywhere a static file can be served.

This build runs entirely in the browser. A pandas export script collapses the source data into ~15 pre-aggregated JSON files; all filtering, cross-filtering, and simulation happen client-side with no server round-trip.

Three headline value points:

- **Opens instantly:** just a link — no Python install, no license.
- **Multi-dimensional filtering + cross-filter:** hotel / year / month-range / segment / channel / deposit, plus a dashboard-wide brush (click a segment bar → every chart refilters).
- **Tells the project's asymmetric pricing story** (City vs Resort) through a recommend-only Pricing Simulator — full figures in section 10.

| Delivery channel | Location | Status |
|------------------|----------|--------|
| **HTML/JS static web (this document)** | `dashboard-html/` | **Delivered + deployed (Vercel)** |
| Power BI executive pack | `dashboard-powerbi/` | In progress |

---

## 2. Limitations & Assumptions

Consolidated in one place — read this before trusting any number further down.

**Out of scope**

- Live OTA price push or RMS (Revenue Management System) automation — the simulator is what-if only and never writes prices anywhere.
- Row-level drill-through — the dashboard ships aggregates only, by design, for privacy and payload-size reasons.
- User authentication — none by default; enable Vercel Deployment Protection before widening access if the data stops being public.

**Data & modeling limitations**

- The data window ends **2017-08** — treat all benchmark bands (STR: international hotel-industry standard; Lisbon: local reference market) and elasticities as historical calibration, to be recalibrated before use in current pricing decisions.
- Daily occupancy (`daily_adr_occ`) is a monthly-context mean projected onto days — an approximation, since bookings carry no true nightly inventory.
- ADR boxplots use capped samples (≤1,500 bookings per hotel × year × cancel-flag group) for payload size; exact means/quartiles ship alongside in `stats` for auditability.
- The Pricing Simulator is a linear what-if model with a fixed soft elasticity (−0.25), not a demand model re-estimated in real time.

**Limitations of the headline figures in section 10**

- The 100% back-test win-rate for City Peak is computed on **n = 4 Peak months** (2015–2016 window) — a small sample, not strong statistical evidence. Treat it as an early signal to confirm through a pilot, not a final conclusion.
- The €10k / €59k / €70–85k uplift figures are **counterfactual, in-sample proxies** from an ADR × Occupancy simulation, not results from an actual A/B test (RCT). They should be re-measured in shadow mode before being used for budgeting.

---

## 3. Project Scope & Objectives

### Scope

- Rebuild the four executive decision views (Overview, RevPAR, Cancellation, Pricing Simulator) as a static single-page app covering two properties (City Hotel, Resort Hotel), arrivals **Jul 2015 – Aug 2017**.
- Pre-aggregate all facts server-side (Python) so no raw booking rows ever ship to the browser — only grouped JSON.
- Rich interactivity: month-range slider, per-chart range windows, brush/cross-filter, box-select summaries, light/dark theme.
- Deploy safely to public static hosting (Vercel) with security headers and SEO lockdown.

### Objectives

1. **Zero-dependency sharing:** any stakeholder with a browser can open the dashboard — no Python, no server, no license.
2. **Decision parity:** the same KPI definitions and asymmetric-pricing framing as the analytics reports.
3. **Client-side interactivity:** filtering, brushing, and what-if simulation computed in JS on aggregates, staying responsive on 82.8k-booking-derived data.
4. **Safe publishing:** static hosting must not expose source CSVs, credentials, or crawlable data.

*Out-of-scope items and other technical limitations are consolidated in section 2 — Limitations & Assumptions.*

---

## 4. Business Question

| # | Business question | Where the HTML dashboard answers it |
|---|-------------------|-------------------------------------|
| Q1 | Where is growth coming from, and how dependent is revenue on one channel/market? | **Overview** — KPI strip, Revenue & bookings dual-axis trend, Revenue share by channel donut, Top countries |
| Q2 | How do City and Resort differ on RevPAR, ADR, occupancy over time? | **RevPAR** — trend with range window, MoM decomposition waterfall (ΔADR vs ΔOccupancy), seasonality heatmap, latest-month comparison |
| Q3 | Is there headroom to raise price without losing occupancy? | **RevPAR** — daily ADR × Occupancy scatter (bright points = high RevPAR) with box-select summary of the chosen day cluster |
| Q4 | Where does cancellation risk concentrate (lead time, deposit, channel, segment)? | **Cancellation** — driver bars with brush/cross-filter, ADR boxplot canceled vs not, booking funnel sizing the overbooking buffer |
| Q5 | What happens to RevPAR/revenue if we move ADR, occupancy, or cancel rate in a controlled band? | **Pricing Simulator** — three levers (±30% ADR, ±20 pp Occ, ±15 pp Cancel) + optional soft elasticity, baseline vs scenario overlay, sensitivity bars, CSV export |
| Q6 | Which customer types carry the revenue base month to month? | **Overview** — small-multiples for Transient / Transient-Party / Contract with a Revenue ↔ Room-nights metric toggle |

Each chart carries a Vietnamese decision caption answering "so what": e.g. the funnel caption instructs using the drop between the first two bars to size the overbooking buffer instead of guessing.

---

## 5. Design Thinking Approach

The upstream problem-framing work — Design Thinking (Empathize → Test), Double Diamond, CRISP-DM, and mapping each stakeholder's "job to be done" — was already locked in the analytics workstream before this channel was built. This section names only the two frameworks that directly shape the UI, plus a short summary of the primary users below.

### Primary users and their jobs

- **GM** (General Manager) / C-level: portfolio pulse in 30 seconds.
- **RM** (Revenue Management): stress-test **BAR** (Best Available Rate) moves.
- **FO/Ops** (Front Office / Operations): locate cancellation risk.
- **Finance:** audit metric formulas.

### Two frameworks that directly shape the four-view structure

| Framework | Role in this artifact |
|-----------|----------------------|
| **Decision-centric IA** (information architecture: Overview → Diagnose → Act) | View order: Overview → RevPAR + Cancellation (diagnose) → Pricing Simulator (act, recommend-only) |
| **Shneiderman's mantra** (Overview first, zoom & filter, details-on-demand) | Global filters + per-chart range windows (zoom) + box-select / brush summaries (details-on-demand) |

### Design decisions specific to this channel

1. **Aggregates over rows.** The browser only ever sees grouped JSON (`booking_cube`, monthly panels, capped ADR samples) — never the 82.8k raw rows, which keeps the payload light and avoids leaking individual booking data.
2. **Cross-filter as the primary "zoom".** Clicking a segment, channel, hotel, or month brushes the whole dashboard via a shared brush state — replicating BI-tool cross-filtering in vanilla JS.
3. **Two-hue discipline.** Design system (`design-system/hotel-booking-demand/`) enforces teal `#0F766E` for primary series and cognac `#9A4E1C` for secondary/CTA; light/dark themes both derive from these tokens.
4. **Captions carry the decision, not the description.** Every panel caption states what action the pattern implies (e.g. "No Deposit vs deposit gap = expected effectiveness of tightening deposits").
5. **Trade-off, not "optimal price".** The simulator shows baseline-vs-scenario bands and sensitivity, never a single optimum — consistent with the floor–recommend–ceil ensemble policy from the analytics workstream.

---

## 6. Dataset Overview

| Attribute | Detail |
|-----------|--------|
| Source of truth | `hotel_bookings_v5.csv` (cleaned panel) → star-schema CSVs under `data/star schema/` |
| Direct inputs to this build | `revpar_monthly.csv` (hotel × month) + `hotel_bookings_normalized.csv` (1 row = 1 booking) |
| Volume | **82,811** bookings, 2 properties (City Hotel, Resort Hotel) |
| Time window | Arrival months **2015-07 → 2017-08** |
| Overall cancel rate | **28.12%** |
| Shipped to browser | ~15 pre-aggregated JSON files (no booking-level rows; ADR boxplot samples capped at 1,500 per hotel × year × cancel-flag group, seeded RNG) |

Browser-facing aggregates (in `dashboard-html/data/`): `revpar_monthly`, `status_mix`, `segment_mix`, `countries`, `cancel_monthly`, `cancel_lead`, `cancel_deposit`, `cancel_channel`, `cancel_segment`, `booking_cube`, `customer_type_monthly`, `daily_adr_occ`, `room_type_revpar`, `adr_cancel_box`, `meta`.

---

## 7. Data Model Design

The star schema is collapsed into a client-side aggregate model with three grains:

| Grain | Files | Serves |
|-------|-------|--------|
| **Hotel × month** | `revpar_monthly`, `cancel_monthly`, `customer_type_monthly` | KPI strip, trend lines, seasonality heatmap, simulator baseline |
| **Hotel × day** | `daily_adr_occ` (with per-day segment map) | ADR × Occupancy scatter + box-select summary |
| **Hotel × year × dimension** | `status_mix`, `segment_mix`, `countries`, `cancel_lead/deposit/channel/segment`, `room_type_revpar`, `adr_cancel_box` | Mix charts, cancel drivers, room-type comparison |

Plus one mini-cube: `booking_cube.json` — grain *hotel × year × month × lead-bin × deposit × channel × segment × status × country* with additive measures (`bookings`, `canceled`, `noshow`, `revenue`). This is what makes client-side cross-filtering possible: any combination of sidebar filters and chart brushes re-aggregates the cube in JS without a server round-trip.

**Design rules**

- Only additive measures (counts, sums) go in the cube; ratios (cancel rate, ADR) are always recomputed after filtering, never averaged from pre-computed ratios.
- `lead_time` is binned upstream (`0-7d / 8-30d / 31-90d / 91-180d / 180d+`) to bound cube cardinality.
- Customer types are truncated to the top 3 by volume (Transient, Transient-Party, Contract) + Other, matching the small-multiples layout.
- `meta.json` declares hotels, years, and month bounds so the UI builds filters from data, not hard-coded lists.

---

## 8. Dashboard Architecture

```text
hotel_bookings_v5.csv
        │  scripts/build_star_schema_v5.py
        ▼
data/star schema/*.csv  (revpar_monthly + hotel_bookings_normalized)
        │  dashboard-html/_export_data.py   (pandas → JSON aggregates)
        ▼
dashboard-html/data/*.json   (~15 aggregate files, no raw rows)
        │  fetch() at page load
        ▼
┌─ index.html (SPA shell) ──────────────────────────────────────┐
│ sidebar: nav + filters        main: topbar + brush bar + views │
│                                                                │
│  js/data.js    — store, filters, cube aggregation, simulate() │
│  js/charts.js  — Chart.js wrappers (line/bar/donut/scatter/   │
│                  waterfall/boxplot/violin/heatmap)            │
│  js/rangeBrush.js — per-chart time-range windows              │
│  js/app.js     — state, view routing, KPI + render pipeline   │
│  js/theme.js   — light/dark token switch                      │
└────────────────────────────────────────────────────────────────┘
        │ deploy (static only, .vercelignore blocks _export_data.py)
        ▼
Vercel — CSP/HSTS headers · /data/* no-store · robots noindex
```

### Views — audience, purpose, chart structure, decision flow

The four views follow the decision-centric IA (Overview → Diagnose → Act): each page targets a specific stakeholder job and ends in a concrete decision, not just a picture.

#### View 1 — Overview (portfolio pulse)

| | |
|---|---|
| **Audience** | GM / C-level; secondarily heads of sales & distribution |
| **Purpose** | Answer in 30 seconds: where is growth coming from, and how dependent is revenue on one channel/market — so the exec knows where to drill today |
| **Decision output** | Pick today's focus area; approve/adjust Direct-channel budget; flag fragile growth (big segment that also tops the cancel table) |

![Overview — KPI strip, Revenue & bookings trend, channel donut](./screenshots/01-overview.png)
*(insert Overview screenshot here)*

**Chart structure (top → bottom):**

1. **KPI strip (6 spark cards):** Bookings · Revenue · ADR · Occupancy · RevPAR · Cancel rate. Each card: filtered total → **vs PY** (CY vs PY, same months; Bookings/Revenue = absolute Δ) → **YoY** (last month vs same calendar month prior year) → **PY | CY** pair → sparkline (CY line + PY area). ADR / Occupancy / RevPAR carry a STR/Lisbon rating pill; Cancel rate color is inverted (↑ is destructive). MoM is not shown on cards.
2. **Row 2 (2 columns):** *Revenue & bookings* — dual-axis trend with mini range window (divergence between the two lines is the signal: revenue up while bookings flat = price is carrying growth; bookings up while revenue flat = selling cheap) | *Revenue share by channel* — donut with HTML legend (any channel > 50% = dependency risk)
3. **Row 3 (full width):** *Customer type small multiples* — 3 synced line charts (Transient / Transient-Party / Contract) with a Revenue ↔ Room-nights metric toggle
4. **Row 4 (2 columns):** *Market segment mix* — bar, click-to-cross-filter the whole dashboard | *Top countries* — bar (geographic concentration = demand-source risk)

**How it drives a decision:**

1. Read the KPI strip for the overall pulse.
2. Check the revenue/bookings divergence to name the growth driver (price vs volume).
3. Check channel share to size dependency.
4. Click the biggest segment and jump to Cancellation to test whether growth rests on uncertain demand.

#### View 2 — RevPAR (diagnose: price × occupancy)

| | |
|---|---|
| **Audience** | Revenue Management / pricing analyst |
| **Purpose** | Decompose RevPAR movement into price (ADR) vs fill (Occupancy), locate pricing headroom and seasonality, and audit the numbers before acting |
| **Decision output** | Which lever to pull (price vs demand programs), which months to lock rates early, which room types leak revenue via free upgrades |

![RevPAR — MoM waterfall decomposition (ΔADR / ΔOccupancy)](./screenshots/02-revpar-waterfall.png)
*(insert RevPAR waterfall screenshot here)*

**Chart structure (top → bottom):**

1. **KPI strip (4 spark cards):** RevPAR · ADR · Occupancy · Revenue — same vs PY / YoY / PY|CY / sparkline stack as Overview; RevPAR / ADR / Occupancy carry rating pills. MoM lives in the waterfall, not on the cards.
2. **Row 2 (wide-left):** *RevPAR by month* — per-hotel lines + range window | *RevPAR decomposition* — MoM waterfall (prev month → ΔADR → ΔOccupancy → current month) that names the driver explicitly
3. **Row 3 (2 columns):** *ADR × Occupancy (daily)* — scatter where brightness = RevPAR, with drag box-select summarizing the chosen day cluster | *RevPAR by room type* — grouped bars, reserved vs assigned side by side
4. **Stack:** *ADR × Occupancy (monthly trend)* — dual line (both rising = real demand, safe to raise price; ADR up while Occ down = past the price ceiling) · *Seasonality heatmap* — hotel × month grid · *Latest month RevPAR by hotel* — comparison bars
5. **Monthly panel** — audit table (ADR / Occ / RevPAR / Revenue per hotel-month) to verify numbers before deciding

**How it drives a decision:**

1. The waterfall says whether last month's change was price-led or occupancy-led → choose the matching lever.
2. A bright scatter cluster at high ADR with healthy occupancy means there's room to raise price there.
3. Dark heatmap cells repeated across years mean lock rates early; pale cells call for demand programs, not reactive discounts.
4. Assigned bars sitting below reserved mean the room-assignment rules need fixing.

#### View 3 — Cancellation (diagnose: revenue leakage)

| | |
|---|---|
| **Audience** | Front Office / Ops and Revenue Management; deposit-policy owners |
| **Purpose** | Locate where cancel & no-show risk concentrates and quantify the leakage, so policy changes target the right bookings |
| **Decision output** | Deposit/guarantee tightening scope, overbooking buffer size, which channel to renegotiate, which segments get stricter guarantees vs more inventory |

![Cancellation — cancel drivers, ADR boxplot, booking funnel](./screenshots/03-cancellation.png)
*(insert Cancellation screenshot here)*

**Chart structure (top → bottom):**

1. **KPI strip (4 spark cards):** Cancel rate · No-Show rate · Canceled bookings · Lost revenue (est.) — same vs PY / YoY / PY|CY / sparkline stack; color inverted (↑ is destructive). Notes on the card: canceled/no-show counts, "% of bookings", and *proxy · not accounting*.
2. **Row 2 (wide-right):** *Status mix* — donut (baseline loss share; > 25% → tighten deposits before opening new channels) | *Cancel & no-show trend* — lines + range window (3 consecutive rising months = structural, one month = seasonal; no-show is separated because the fix is reconfirmation, not price)
3. **Row 3 (2 columns):** *ADR — Canceled vs Not canceled* — boxplot (if the canceled group's median ADR is higher, money leaks in the premium band) | *Booking funnel* — bars (the drop between the first two bars is the overbooking-buffer number)
4. **Row 4 (2 columns):** *Cancel rate by lead time* — with Bar % / Boxplot / Violin mode toggle | *Cancel rate by deposit* — bar (gap between No Deposit and deposit tiers = expected effectiveness of tightening)
5. **Row 5 (2 columns):** *By distribution channel* — bar | *By market segment* — bar

**How it drives a decision:**

1. All driver charts share one brush: click a lead-time bin, deposit type, channel, or segment and every other chart refilters, isolating the exact booking population a policy would hit.
2. Read the worst channel together with Overview's revenue share before cutting it.
3. Take the funnel gap as the buffer size instead of a gut estimate.

#### View 4 — Pricing Simulator (act, recommend-only)

| | |
|---|---|
| **Audience** | Revenue Management + Finance (pricing committee) |
| **Purpose** | Stress-test controlled ADR / occupancy / cancel moves on the filtered baseline before any pilot, and produce shareable scenario evidence |
| **Decision output** | Go / no-go for a pilot price move within the ±15% band; scenario CSV as the committee artifact |

![Pricing Simulator — scenario levers and sensitivity bars](./screenshots/04-pricing-simulator.png)
*(insert Pricing Simulator screenshot here)*

**Chart structure (top → bottom):**

1. **Scenario levers:** three sliders — ADR change (±30%) · Occupancy change (±20 pp) · Cancel rate change (±15 pp) — plus an optional soft elasticity toggle (ADR→Occ −0.25) and a Reset levers button
2. **KPI strip (4 compact cards, no spark/CY–PY):** RevPAR baseline · RevPAR scenario (Δ% vs baseline) · Revenue scenario (Δ% vs baseline) · ADR → Occ transition (before → after)
3. **Row 3 (wide-left):** *Baseline vs scenario RevPAR* — two lines (scenario dashed) + range window | *Δ RevPAR by month (%)* — bar showing which months benefit or suffer
4. **Sensitivity (average month)** — bars isolating the ADR-only effect vs the Occ-only effect, so the committee sees which lever the outcome actually depends on
5. **Scenario table + Download CSV** — per-month baseline vs scenario values as the takeaway artifact

**How it drives a decision:**

1. The elasticity toggle lets stakeholders reproduce the City vs Resort asymmetry covered in section 10 on demand.
2. A scenario is pilot-eligible only if it stays inside the ±15% band with ΔRevPAR ≥ 0 under the soft-elasticity assumption.
3. The simulator never writes prices — the exported CSV is the evidence handed to the pricing committee.

### Shared UX patterns

- Global filters: Hotel chips (multi), Year chips (multi), year-month dual-handle range slider, Segment / Channel / Deposit selects; Reset filters and Reset visuals actions.
- Per-chart range windows (mini-chart + draggable window) on every time series.
- Spark KPI cards (Overview / RevPAR / Cancellation) share one anatomy: vs PY (aligned months) + YoY (last month) + PY|CY pair + CY-line/PY-area sparkline. Simulator KPIs stay compact (Δ vs baseline only).
- One shared brush state rendered as removable chips in the brush bar.
- Light/dark theme toggle; all colors from design-system CSS variables.
- SVG icons only (no emoji icons), visible focus states, `aria-live` stat blocks for screen readers — per the design-system checklist.

---

## 9. Technical

| Layer | Choice | Why |
|-------|--------|-----|
| Markup / structure | Single `index.html`, view sections toggled by nav state | No router needed for 4 views; trivially hostable |
| Styling | Hand-written CSS with design tokens (`css/styles.css`), teal + cognac two-hue system, Fraunces + Source Sans 3 | Matches `design-system/hotel-booking-demand/MASTER.md` |
| Charts | Chart.js 4.4.7 (CDN) + `@sgratzl/chartjs-chart-boxplot` 4.4.4 for boxplot/violin | Lightweight, canvas-based, custom plugins feasible (waterfall, external legends) |
| State & logic | Vanilla JS module pattern (`data.js` store + pure functions; `app.js` orchestration) | No framework/build step; entire app is view-source-able |
| Data pipeline | Python 3 / pandas / numpy (`_export_data.py`) | Reuses the project's star-schema build; deterministic (seeded sampling) |
| Hosting | Vercel static (or any `http.server`) | `fetch()` requires HTTP — `file://` is blocked by browsers |
| Security | `vercel.json` headers: CSP (self + jsdelivr + Google Fonts only), HSTS preload, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, Permissions-Policy lockdown; `/data/*` → `Cache-Control: private, no-store`; `robots.txt` + `noindex` meta | Public static hosting without leaking or caching aggregates; no secrets anywhere in the payload |
| Deploy hygiene | `.vercelignore` excludes `_export_data.py`; only static assets + JSON ship | Source CSVs and export logic never reach the CDN |

---

## 10. Key Findings & Strategic Recommendations

### Key findings (from the analytics workstream; this dashboard makes them inspectable)

*Terminology note: **RAISE** / **HOLD** / **CUT** are the playbook's three standard pricing action states — raise price within an approved band / hold price / cut price — used consistently across the underlying analytics reports; capitalization is kept to distinguish them from ordinary text.*

1. **City Peak** tolerates controlled ADR increase: +10% ADR → **+2.3% RevPAR**. This is a back-test result on **n = 4 Peak months** (2015–2016), winning 4/4 (100% win-rate) — a small sample, so treat it as an early signal to confirm through a pilot rather than strong statistical evidence.
2. **Resort Peak** does not: the same +10% ADR → **−2.1% RevPAR**. This figure comes from an elasticity-based what-if simulation, not a rule actually run historically (Resort Peak policy was always **HOLD**) — read it as a modeled estimate, a different evidence tier than the City Peak figure above. The simulator's elasticity toggle lets stakeholders reproduce this asymmetry themselves.
3. Pure analytic optima (~+21% City **RAISE**) are too aggressive to put into live use; operable ±15% floor–recommend–ceil bands plus dual-objective softening cut BAR by ~7–8% vs the pure-revenue optimum.
4. Cancellation concentrates by deposit type, channel, segment, and long lead times — the Cancellation view's driver bars and funnel size the overbooking buffer from observed drop, not gut feel.
5. Canceled bookings skew to higher ADR (boxplot view): revenue leaks in the premium band → deposit/cancel-fee policy for high-ADR bookings beats blanket discounting.

### Strategic recommendations (playbook, recommend-only)

| Priority | Action |
|----------|--------|
| R1 | Asymmetric playbook: proactively raise City Peak ADR within the approved band; **HOLD** Resort Peak; Resort Low **CUT** ~−5% |
| R2 | Never publish the extreme +21% as live BAR; keep ensemble band + risk controls |
| R3 | Route bookings by cancel tier (Low frictionless / Med CRM / High buffer → Direct @ BAR) |
| R4 | Reduce single-channel dependency: monitor the channel-revenue donut; push Direct refill before OTA dump |
| R5 | 16-week staged pilot with kill switches (walk > 5%/week; cancel > +1 pp); use this dashboard's KPI language (ΔRevPAR, Δcancel, walk, Direct mix) for monitoring |

**Modeled impact (proxy) — and how the numbers are derived**

The portfolio revenue base used as denominator is ~€2.84M/year (City ~€1.77M + Resort ~€1.07M, annualized ×12/26 from the 26-month dataset). Three scenarios:

| Scenario | Basis | Estimated uplift |
|----------|-------|-------------------|
| Conservative | Only the back-tested rule applied: City Peak **RAISE** +10%, Resort Low **CUT** −5% | ~€10k/year |
| Full in-band | Full elasticity simulation across the entire ±15% band (softening the +21% extreme) | ~€59k/year |
| Upside | Full in-band plus a Direct-refill assumption: ~15% OTA commission saved on ~2–3% of room-nights shifted from OTA to Direct (RM estimate, unverified) | ~€70–85k/year |

All three figures are counterfactual, in-sample proxies from an ADR × Occupancy simulation — not results measured from an actual A/B test, and not committed P&L. They should be re-measured in shadow mode before being used for budgeting.

---

## 11. Technical Implementation Notes

| Topic | Implementation |
|-------|----------------|
| Data refresh | `python dashboard-html/_export_data.py` — reads star-schema CSVs, writes JSON to `dashboard-html/data/`; fails fast with a clear message if the star schema hasn't been built |
| Local serve | `cd dashboard-html && python -m http.server 8765` → `http://localhost:8765` (browsers block `fetch` on `file://`) |
| Deploy | `npx vercel` (preview) / `npx vercel --prod` from `dashboard-html/` only — never deploy the whole repo |
| Cross-filter engine | One shared brush object (`hotel`, `year_month`, `month_number`, `segment`, `channel`, …); every render function filters the booking cube + monthly panels through it; brush chips render in a dismissible brush bar |
| Range windows | `rangeBrush.js` pairs each detail chart with a mini overview canvas + draggable dual-handle window; per-chart "Reset window" buttons |
| Box-select on scatter | Custom overlay layer captures a drag rectangle in pixel space, inverse-maps to ADR/Occ ranges, then summarizes matched days (count, share, canceled, room-nights, segment and year breakdown) |
| Waterfall & external legends | Custom Chart.js dataset shaping (floating bars for the RevPAR decomposition) + HTML legends (`<ul>` synced to datasets) for layout control |
| Theming | `theme.js` flips `data-theme` on `<html>`; chart colors re-read CSS variables on toggle; dark palette from the design system (`#0F1716` bg, teal `#2DD4BF`, cognac `#D97757`) |
| Accessibility | SVG icon set, `role="slider"` + keyboard-focusable range handles, `aria-live` regions for chart stats, visible focus states, ≥4.5:1 contrast per design-system checklist |
| Determinism | ADR boxplot sampling uses `np.random.default_rng(42)` so repeated exports produce identical JSON (clean git diffs) |
| Cache busting | Static assets versioned via query string (`?v=YYYYMMDD…`) |

*Full limitations and assumptions (data window, auth, the simulator's linear nature): see section 2 — Limitations & Assumptions.*

---

## 12. Metrics Calculation Notes

All metrics follow the project-wide definitions (notebook 01 / star-schema build); the JS layer recomputes ratios after filtering — never averages of pre-computed ratios.

| Metric | Formula / rule |
|--------|----------------|
| **Occupancy rate** (hotel-month) | `mean(1 − is_canceled)` from the monthly fact |
| **ADR** (hotel-month) | `mean(adr)` where `is_canceled = 0` |
| **RevPAR** (hotel-month) | `ADR × Occupancy_Rate` |
| **Revenue** | `sum(revenue)` (ADR × nights × stay outcome from the cleaned panel), additive across filters |
| **Cancel rate** (filtered) | `Σ canceled_bookings / Σ total_bookings` on the filtered rows |
| **Portfolio ADR** (KPI strip) | `weightedMean(adr, weight = successful_bookings)` across filtered months |
| **Portfolio Occupancy / RevPAR** (KPI strip) | `weightedMean(·, weight = total_bookings)` — booking-weighted, not a naïve mean of monthly rows |
| **Daily RevPAR** (scatter) | `mean(adr per day) × mean(occupancy_rate per day)`; point brightness encodes RevPAR |
| **Room-type RevPAR** | `revenue / room_nights` per hotel × year × room type (fallback to mean RevPAR when nights = 0), computed for both reserved and assigned room sides |
| **KPI vs PY** | CY = **selected year** (max if several years are checked) vs PY (CY−1) on the **same month-of-year set** from the slider/brush. Rates/ADR/RevPAR = %; Bookings/Revenue = absolute Δ (no arrow) |
| **KPI YoY** | Last month in the filtered series vs the same calendar month prior year (`pctDelta`). Distinct from vs PY. MoM is not rendered on cards |
| **KPI sparkline** | CY monthly line over PY monthly area, aligned by month-of-year; legend PY (area) / CY (line). Stroke color follows vs-PY tone (inverted on leak metrics) |
| **KPI rating bands** | ADR: Excellent ≥ €120 · Good ≥ €105 · Fair ≥ €90 · Weak ≥ €75 (PT/Europe/Lisbon); Occupancy: Excellent ≥ 80% · Good ≥ 72% · Fair ≥ 65% · Weak ≥ 55% (STR); RevPAR: Excellent ≥ €90 · Good ≥ €75 · Fair ≥ €60 · Weak ≥ €45 (PT/Lisbon). Pill = icon + label, never color alone |

### Simulator math (recommend-only what-if)

Per filtered hotel-month row:

```text
ADR_sim    = ADR × (1 + ΔADR%)
Occ_shift  = ΔOcc_pp  [ + ΔADR% × (−0.25) if elasticity toggle on ]
Occ_sim    = clamp(Occ + Occ_shift − ΔCancel_pp × 0.5, 5%, 99%)
Cancel_sim = clamp(Cancel_base + ΔCancel_pp, 0%, 95%)
RevPAR_sim = ADR_sim × Occ_sim
Revenue_sim = Revenue_base × (RevPAR_sim / RevPAR_base)
```

- Elasticity −0.25 is a deliberately soft prior (a +10% ADR move costs −2.5 pp occupancy), reflecting the project's guardrail that pure-revenue optima must be softened.
- Cancel increases bleed into occupancy at a 0.5 factor (half of extra cancellations are not resold).
- Scenario KPIs aggregate with the same booking-weighted means as the baseline, so baseline and scenario are always comparable.

### Integrity controls

- City and Resort are never blended into one elasticity — hotel filters keep property context explicit on every view.
- The cube ships only additive measures; all rates derive at render time from the active filter + brush.
- The simulator does not write prices anywhere; the CSV download is labeled scenario output.
- Uplift figures cited in section 10 are counterfactual proxies from the analytics reports, not dashboard-computed P&L — see section 2 for full limitations.

---

*Portfolio document for the HTML dashboard channel of Hotel Booking Demand · August 2026*
