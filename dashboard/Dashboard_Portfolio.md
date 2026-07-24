# Hotel Booking Demand — Executive Dashboard Portfolio

**Project:** Hotel Booking Demand — Dynamic Pricing & Booking Optimization  
**Artifact:** Executive / Revenue Management Dashboards  
**Role:** Analytics Team Lead  
**Stack (dashboard):** Python, pandas, Streamlit, Plotly, HTML/JS, Power BI (in progress)  
**Repo:** [github.com/KANguyen2802/Hotel-Booking-Demand](https://github.com/KANguyen2802/Hotel-Booking-Demand)  
**Date:** July 2026

---

## 1. Executive Summary

This portfolio piece documents the **executive dashboard layer** of the Hotel Booking Demand project: decision-support views that translate 82,811 City and Resort bookings into RevPAR, cancellation, and pricing what-if intelligence for GM / Revenue / Finance stakeholders.

The dashboards sit on a **star-schema CSV** layer and are delivered in three channels:

| Channel | Location | Status |
|---------|----------|--------|
| Streamlit local web | `dashboard/` | Delivered |
| HTML/JS local web (static) | `dashboard-html/` | Delivered |
| Power BI executive pack | `dashboard-powerbi/` | In progress |

Analytics behind the screens produced an **asymmetric pricing playbook** (City Peak can harden ADR; Resort Peak must not take pure +ADR shock), a **cancellation-tier booking workflow**, and modeled annualized uplift scenarios of roughly **€10k / €59k / €70–85k** on a **~€2.84M** portfolio proxy—reported as floor / base / upside, not live P&L.

---

## 2. Project Scope & Objectives

### Scope

- Build interactive executive dashboards for **two properties** (City Hotel, Resort Hotel) over Jul 2015–Aug 2017.
- Expose portfolio KPIs (bookings, revenue, ADR, occupancy, RevPAR, cancel rate) with hotel/year filters.
- Support deeper exploration: seasonality, segment/country mix, cancellation drivers, and pricing what-if simulation.
- Align visual narrative with the recommend-only pricing playbook and pilot governance (shadow → pilot → scale).

### Objectives

1. **Decision clarity:** Make City vs Resort demand asymmetry visible in one executive surface.
2. **Operational readiness:** Give RM / FO / Finance a shared KPI language for the 16-week pilot.
3. **Metric integrity:** Compute RevPAR / ADR / occupancy with an explicit, auditable formula.
4. **Multi-channel delivery:** Local web for analysts + static HTML for lightweight sharing + Power BI for stakeholder publish (in progress).

### Out of scope

- Live OTA price push / RMS automation.
- Causal A/B in production (dashboards support shadow/pilot monitoring design only).

---

## 3. Business Questions Addressed

| # | Business question | Dashboard response |
|---|-------------------|--------------------|
| Q1 | How do City and Resort differ on RevPAR, ADR, and occupancy over time? | Overview + RevPAR pages with hotel/year filters and seasonality views |
| Q2 | Where does cancellation risk concentrate (segment, channel, deposit, lead time)? | Cancellation Analysis drivers + mix charts |
| Q3 | What happens to RevPAR if we move ADR in a controlled band? | Pricing Simulator (monthly what-if panel) |
| Q4 | Which markets/segments drive revenue vs cancel pressure? | Segment and country mix on Overview |
| Q5 | Are we ready to pilot asymmetric BAR rules without blowing cancel/walk? | KPI pack design aligned to ΔRevPAR, Δcancel, walk, Direct mix (monitoring plan) |

---

## 4. Design Thinking Approach

The dashboard workstream combined **classic Design Thinking** with analytics and BI frameworks that match how this project actually ships decisions: property-asymmetric pricing, cancel-tier booking, and recommend-only pilots.

### Framework stack (why each one)

| Framework | Role in this project |
|-----------|----------------------|
| **Design Thinking** (Empathize → Test) | Outer loop for stakeholder pain → problem framing → dashboard prototypes |
| **Double Diamond** (Discover → Deliver) | Separates *problem space* (City ≠ Resort elasticity) from *solution space* (playbook + multi-channel dashboards) |
| **CRISP-DM** | Structures the analytics pipeline that feeds the UI (Business Understanding → Modeling → Evaluation → Deployment-as-recommend-only) |
| **Jobs-to-be-Done (JTBD)** | Defines what GM / RM / FO / Finance hire the dashboard to do |
| **Decision-centric IA** (Overview → Diagnose → Act) | Page architecture: Overview & RevPAR → Cancellation → Pricing Simulator |
| **Shneiderman’s Visual Information-Seeking Mantra** | *Overview first, zoom & filter, then details-on-demand* — hotel/year filters + drill pages |

### A. Jobs-to-be-Done (stakeholder jobs)

| Stakeholder | Job the dashboard must help them do |
|-------------|-------------------------------------|
| GM | See portfolio health and City vs Resort trade-offs in one view |
| Revenue Management | Inspect RevPAR / ADR / seasonality and stress-test BAR moves in band |
| Front Office / Ops | Understand where cancel risk concentrates before buffer / walk decisions |
| Finance | Trace KPI definitions and treat uplift as proxy scenarios, not committed P&L |

### B. Double Diamond × Design Thinking (mapped to deliverables)

```text
DISCOVER                    DEFINE
(Empathize)                 (Define)
82.8k bookings · ε prior    Problem = asymmetric demand
cancel 28% · OTA High       NOT “one price for both hotels”
        \                      /
         \____ Develop ____/
              (Ideate + Prototype)
   Playbook rules · star schema · Streamlit / HTML / Power BI pages
                      |
                   DELIVER
              (Test / refine)
   Filters · design tokens · recommend-only · pilot KPI pack
```

1. **Discover / Empathize** — Interview the decision pain: raise RevPAR without uncontrolled cancel, walk, or OTA conflict when City and Resort do not share the same demand curve.
2. **Define** — Lock the problem statement to *property-asymmetric demand + cancel-tier inventory*, rejecting a single portfolio elasticity and rejecting live push of analytic extremes (~+21% City RAISE).
3. **Develop / Ideate + Prototype** — Translate CRISP-DM outputs (scores, ε, ensemble bands) into four decision pages and three delivery channels on the same star-schema facts.
4. **Deliver / Test** — Validate usability (hotel/year filters, weighted KPIs) and policy framing (what-if only; no auto-publish outside ±15% band).

### C. CRISP-DM → dashboard handoff

| CRISP-DM phase | Project artifact | What the dashboard exposes |
|----------------|------------------|----------------------------|
| Business Understanding | Exec question on RevPAR vs risk | Overview narrative KPIs |
| Data Understanding / Preparation | `hotel_bookings_v5` → star-schema CSV | Stable facts for filters |
| Modeling | LightGBM cancel scores, ε, BAR ensemble | Cancellation + Pricing Simulator inputs |
| Evaluation | Back-test go/no-go, dual-objective | Guardrails in what-if framing |
| Deployment | Recommend-only playbook + 16-week pilot | Monitoring-oriented KPI language (ΔRevPAR, Δcancel, walk, Direct) |

### D. Decision-centric information architecture

| Layer | Pages | Intent |
|-------|-------|--------|
| **Overview** | Home | Portfolio pulse — bookings, revenue, ADR, Occ, RevPAR, cancel |
| **Diagnose** | RevPAR · Cancellation | Seasonality, mix, and cancel drivers (deposit, channel, segment, lead time) |
| **Act (recommend-only)** | Pricing Simulator | Controlled ADR what-if inside operable bands — not RMS write-back |

**North-star design principle:** show the **trade-off** (ADR vs volume vs cancel risk), not a single “optimal price” number—consistent with ensemble floor–recommend–ceil and dual-objective softening of pure-revenue optima.

---

## 5. Dataset Overview

| Attribute | Detail |
|-----------|--------|
| Source file | `hotel_bookings_v5.csv` (cleaned panel) |
| Grain | 1 row = 1 booking |
| Volume | **82,811** bookings |
| Properties | City Hotel, Resort Hotel |
| Time window | Arrival months **2015-07 → 2017-08** |
| Overall cancel rate | **28.12%** |
| High-risk cancel tier | P ≥ 0.55 → realized cancel **~64%** (n = 28,560) in scoring pipeline |

Dashboard facts are rebuilt into star-schema CSVs under `data/star schema/` for BI consumption.

---

## 6. Data Model Design

### Schema Choice

**Star schema (CSV exports)** chosen over a single denormalized flat file for dashboards:

| Layer | Tables / files | Grain |
|-------|----------------|-------|
| Fact (monthly) | `revpar_monthly.csv` | Hotel × calendar month |
| Fact (booking) | `hotel_bookings_normalized.csv` | 1 booking |
| Dimensions | `dim_hotel`, `dim_date`, `dim_country`, `dim_market`, `dim_customer`, `dim_room`, `dim_meal`, `dim_deposit`, `dim_status`, `dim_agent` | Lookups for Power BI / joins |

**Why star schema**

- Clear separation of **monthly RevPAR KPIs** vs **booking-level cancel/segment** analysis.
- Stable grain for Power BI relationships and Streamlit/HTML aggregates.
- Rebuildable from source via `scripts/build_star_schema_v5.py` (pandas).

---

## 7. Dashboard Architecture

```text
hotel_bookings_v5.csv
        │
        ▼
scripts/build_star_schema_v5.py  →  data/star schema/*.csv
        │
        ├──────────────────┬────────────────────┐
        ▼                  ▼                    ▼
 Streamlit app        HTML export           Power BI
 (dashboard/)         (dashboard-html/)     (dashboard-powerbi/)
 pandas + Plotly      JSON aggregates       Import CSV (in progress)
 multipage UI         static local web
```

### Streamlit pages

| Page | Purpose |
|------|---------|
| Overview (`Home.py`) | CEO KPIs, revenue/bookings trend, status, segment, country |
| RevPAR | ADR × occupancy, seasonality heatmap, monthly panel |
| Cancellation Analysis | Deposit / channel / segment / lead-time drivers, no-show |
| Dynamic Pricing Simulator | Monthly what-if ADR moves within controlled framing |

### Shared UX patterns

- Sidebar filters: **Hotel** (multi), **Year** (multi).
- Weighted portfolio KPIs on filtered subsets.
- Design tokens from `design-system/hotel-booking-demand/`.

---

## 8. Key Findings & Strategic Recommendations

### Key findings (surfaced by analysis; dashboards make them inspectable)

1. **City Peak** tolerates controlled ADR increase: **+10% ADR → +2.3% RevPAR**; Peak back-test win-rate **100%** in the evaluated window.
2. **Resort Peak** does not: same **+10% ADR → −2.1% RevPAR** — pure ADR shock is policy-forbidden.
3. Pure analytic optima (~**+21%** City RAISE) are too aggressive; operable **±15%** floor–recommend–ceil bands plus dual-objective softens BAR by **~7–8%**.
4. Cancellation is manageable by tier: High-risk bookings feed a **buffer → Direct @ BAR** path instead of OTA dump.
5. Narrow rules back-tested **2015–2016** with **go=True** (ΔRevPAR ≥ 0; Δcancel ≤ +1 pp) for both properties.

### Strategic recommendations (playbook)

| Priority | Action |
|----------|--------|
| R1 | Asymmetric playbook: harden City Peak in band; HOLD Resort Peak; Resort Low CUT ~−5% |
| R2 | Never publish extreme +21% as live BAR; keep ensemble band + risk controls |
| R3 | Route bookings by cancel tier (Low frictionless / Med CRM / High buffer→Direct) |
| R4 | Prefer Direct refill at recommend BAR before OTA dump |
| R5 | 16-week staged pilot with kill switches (e.g., walk >5%/week; cancel >+1 pp) |

**Modeled impact (proxy):** Conservative ~€10k · Full in-band ~€59k · Direct/buffer upside ~€70–85k on ~€2.84M base.

---

## 9. Technical Implementation Notes

| Topic | Implementation |
|-------|----------------|
| Runtime data access | `dashboard/lib/db.py` — pandas reads star-schema CSVs (cached) |
| Charts | Plotly (Streamlit); Chart.js / custom JS (HTML) |
| HTML data refresh | `dashboard-html/_export_data.py` → JSON under `dashboard-html/data/` |
| Local HTML serve | `python -m http.server` (browsers block `fetch` on `file://`) |
| Power BI | Folder `dashboard-powerbi/` — model/publish checklist; PBIX in progress |
| Dependencies | `streamlit`, `plotly`, `pandas` (see `requirements.txt`) |
| Rebuild facts | `python scripts/build_star_schema_v5.py` |

---

## 10. Metric Calculation Integrity Notes

All dashboard revenue metrics follow the project’s explicit definitions (notebook 01 / star-schema build):

| Metric | Formula / rule |
|--------|----------------|
| **Occupancy rate** (hotel-month) | `mean(1 − is_canceled)` |
| **ADR** (hotel-month) | `mean(adr)` where `is_canceled = 0` |
| **RevPAR** (hotel-month) | `ADR × Occupancy_Rate` |
| **Revenue** (booking) | Derived from ADR × nights × stay outcome in cleaned panel; aggregated as `sum(revenue)` |
| **Cancel rate** (portfolio filter) | `canceled_bookings / total_bookings` on the filtered monthly fact |
| **Overview ADR / Occ / RevPAR** | Booking-weighted across months in the active hotel/year filter (not a naïve unweighted mean of monthly rows) |

### Integrity controls

- Monthly RevPAR is **recomputed from booking facts**, not taken as an opaque external field.
- City and Resort are **never blended into one elasticity** on decision pages—filters keep property context explicit.
- Pricing Simulator is **what-if / recommend-only**; it does not write prices to channels.
- ROI figures shown in reports are **counterfactual proxies**; dashboards are for inspection and pilot monitoring design, not committed P&L.

### Known limitations

- Panel ends **2017-08** — recalibrate before live scale.
- No production RCT yet — shadow ≥ 2 weeks required before price pilot.
- Power BI executive pack is **in progress**; Streamlit and HTML local webs are the current interactive deliverables.

---

*Portfolio document for the dashboard workstream of Hotel Booking Demand · July 2026*
