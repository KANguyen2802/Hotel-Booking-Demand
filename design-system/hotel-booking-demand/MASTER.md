# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Hotel Booking Demand
**Generated:** 2026-07-24 10:54:43
**Category:** Hotel/Hospitality
**Design Dials:** Motion 4/10 (Standard) | Density 8/10 (Dense / Dashboard)

---

## Global Rules

### Color Palette (user override: teal blue + cognac, limited palette)

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary (Teal) | `#0F766E` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Primary soft | `#14B8A6` | `--color-primary-soft` |
| Accent (Cognac) | `#9A4E1C` | `--color-accent` |
| Accent soft | `#C47A46` | `--color-accent-soft` |
| Background | `#F4F7F6` | `--color-background` |
| Foreground | `#14201E` | `--color-foreground` |
| Muted | `#E2E8E6` | `--color-muted` |
| Muted fg | `#5B6B68` | `--color-muted-fg` |
| Border | `#C9D4D1` | `--color-border` |
| Card | `#FFFFFF` | `--color-card` |
| Positive | `#0F766E` | `--color-positive` |
| Destructive | `#B45309` | `--color-destructive` |
| Ring | `#0F766E` | `--color-ring` |

**Dark mode:** bg `#0F1716`, card `#162220`, fg `#E8EFED`, border `#2A3A37`, primary `#2DD4BF`, accent `#D97757`

**Color Notes:** Two-hue system only — teal for primary series / KPIs, cognac for secondary series / CTAs. Avoid extra chromatic colors on charts.

### Typography

- **Heading Font:** Fraunces
- **Body Font:** Source Sans 3
- **Mood:** hospitality analytics, refined, dense dashboard
- **Google Fonts:** [Fraunces + Source Sans 3](https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap');
```

### Spacing Variables

*Density: 8/10 — Dense / Dashboard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `2px` / `0.125rem` | Tight gaps |
| `--space-sm` | `4px` / `0.25rem` | Icon gaps, inline spacing |
| `--space-md` | `8px` / `0.5rem` | Standard padding |
| `--space-lg` | `12px` / `0.75rem` | Section padding |
| `--space-xl` | `16px` / `1rem` | Large gaps |
| `--space-2xl` | `24px` / `1.5rem` | Section margins |
| `--space-3xl` | `32px` / `2rem` | `.main` outer padding (no hero section in this app) |

### Shadow Depths

Only two shadow tokens exist — this dashboard has no modals/dropdowns that need deeper elevation.

| Level | Light | Dark | Usage |
|-------|-------|------|-------|
| `--shadow-sm` | `0 1px 2px rgba(20,32,30,0.05)` | `0 1px 2px rgba(0,0,0,0.25)` | Panels, KPI cards |
| `--shadow-md` | `0 4px 12px rgba(20,32,30,0.07)` | `0 6px 18px rgba(0,0,0,0.35)` | Box-select popover only |

Also: `--radius: 12px` (panels/cards), `--sidebar-w: 280px`, `--transition: 180ms ease` — see full token list in `dashboard-html/css/styles.css`.

---

## Component Specs

> Rewritten to match the actual implementation in `dashboard-html/css/styles.css`.

### Buttons

```css
.btn {
  border-radius: 9px;
  padding: 0.55rem 0.85rem;
  font-weight: 600;
  transition: opacity 180ms ease, transform 180ms ease, background 180ms ease, border-color 180ms ease;
}
.btn:hover { opacity: 0.92; transform: translateY(-1px); }

/* Primary — accent (cognac), for the one "commit" action per page (e.g. Download CSV) */
.btn-primary { background: var(--color-accent); color: #fff; }

/* Secondary — tinted primary, for the default/expected action (e.g. Reset filters, Run scenario) */
.btn-secondary {
  background: var(--color-fill);
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border));
}

/* Ghost — low-emphasis utility action (e.g. Reset window, Clear brush) */
.btn-ghost { background: transparent; color: var(--color-muted-fg); border-color: var(--color-border); }

/* Toggle — pressed state uses the tinted-primary look */
.btn-toggle[aria-pressed="true"] {
  background: var(--color-fill);
  color: var(--color-primary);
  border-color: var(--color-primary);
}

/* Icon-only, fixed square (e.g. theme switch) */
.btn-icon { width: 40px; height: 40px; padding: 0; border-radius: 10px; background: var(--color-card); border: 1px solid var(--color-border); }

/* Segmented control (chart mode / metric switches) */
.seg-btn[aria-pressed="true"] { background: var(--color-card); color: var(--color-primary); box-shadow: var(--shadow-sm); }
```

### Cards

```css
/* Generic panel — chart/table containers */
.panel {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius); /* 12px */
  padding: var(--space-xl);
  box-shadow: var(--shadow-sm);
}

/* KPI card — no hover-lift (dense dashboard, not a marketing card) */
.kpi-card {
  --kpi-stack-gap: 0.55rem;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 0.9rem 1rem;
  box-shadow: var(--shadow-sm);
  min-height: 96px;
  display: flex;
  flex-direction: column;
}
.kpi-card.has-rating { min-height: 118px; }
.kpi-card--spark {
  --kpi-pad-x: 0.95rem;
  min-height: 0;
  height: 100%;
  padding: 1rem var(--kpi-pad-x) 0;
}
```

**Spark card stack** (Overview / RevPAR / Cancellation): label (+ optional `.kpi-rating` pill) → `.kpi-value` → `.kpi-year` (vs PY) → `.kpi-var` (YoY) → `.kpi-yp` (PY | CY) → optional `.kpi-note` → `.kpi-spark` (CY line + PY area, flush to card edges) + PY/CY legend. Simulator cards stay compact (value + Δ% only).

**Rule:** Cards in this dashboard do **not** lift/scale on hover (that pattern is reserved for clickable chips, chart bars/segments, and heatmap cells — see Anti-Patterns).

### Inputs

```css
/* Select (filters) */
.filter-field select {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.5rem 2rem 0.5rem 0.65rem;
  transition: border-color 180ms ease, box-shadow 180ms ease;
}
.filter-field select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 22%, transparent);
}
.filter-field select.has-value { border-color: var(--color-primary); color: var(--color-primary); font-weight: 600; }

/* Chip (multi-select hotel/year, brush pills) */
.chip {
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-card);
  padding: 0.35rem 0.65rem;
}
.chip:has(input:checked) { background: var(--color-fill); border-color: var(--color-primary); color: var(--color-primary); }

/* Range slider (scenario levers) */
input[type="range"] { accent-color: var(--color-accent); }
```

### Popovers (no modal in this app)

The dashboard is single-page/single-viewport by design — **no modal dialogs**. The closest analog is the box-select summary card (drag-select on a scatter chart):

```css
.box-select-card {
  position: absolute;
  background: color-mix(in srgb, var(--color-card) 96%, transparent);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(2px);
}
```

---

## Style Guidelines

**Style:** Quiet Analytics (data-dense sidebar app, not a marketing surface)

**Keywords:** Sticky sidebar navigation, glassy card surfaces (subtle `backdrop-filter` on sidebar only), two-hue accent system, tabular numerals, no decorative motion

**Best For:** Executive/ops dashboards, revenue analytics, internal BI tools — anywhere the chart *is* the content and chrome must stay out of the way

**Key Effects:** Soft dual radial-gradient wash behind the whole app (`--color-fill` / `--color-fill-accent`, ellipse at top corners), `backdrop-filter: blur(10px)` on the sticky sidebar only, `color-mix()` for all tint/hover states instead of hardcoded alpha colors

### Page Pattern

**Pattern Name:** Sidebar Analytics Shell (4 views, one persistent frame)

- **Structure:** Fixed-width sidebar (`--sidebar-w: 280px`) + fluid main content, `grid-template-columns: var(--sidebar-w) 1fr`. Collapses to single column ≤900px.
- **Sidebar:** Brand mark → view nav (icon + label, active = tinted-primary) → filters (hotel/year chips, year-month range slider, segment/channel/deposit selects) → sticky bottom actions (Reset filters / Reset visuals).
- **Main:** Topbar (page title + subtitle + theme toggle) → optional brush bar (active cross-filter chips) → KPI grid → chart panels in `.grid-2` layouts → tables.
- **Navigation model:** Client-side view switch (`.view.active`), not page navigation — all 4 views share one DOM/CSS shell and swap content instantly.
- **No hero, no CTA-to-convert, no marketing copy.** Every element answers a decision question (see each page's `chart-caption` copy).

---

## Motion

No route transitions, no GSAP — this is a data tool, not a marketing site. All motion is plain CSS, driven by one token: `--transition: 180ms ease`.

```css
/* View switch is instant (display swap), never animated — dashboards should feel snappy */
.view { display: none; }
.view.active { display: flex; }

/* Everything interactive gets the same short, consistent transition */
.nav-btn, .btn, .chip, .seg-btn, .filter-field select {
  transition: background var(--transition), border-color var(--transition), color var(--transition);
}
.btn:hover { transform: translateY(-1px); }
.heatmap td:hover { transform: scale(1.04); }
```

- ✅ Debounce recompute on slider drag (Pricing Simulator levers) so charts don't re-render every pixel of movement
- ✅ Respect `prefers-reduced-motion: reduce` globally — disable all transitions/transforms (already wired at the bottom of `styles.css`)
- ❌ No hover-lift on KPI cards or chart panels (dense grid — lift would cause visual noise across 4–6 cards at once)
- ❌ No count-up/number-tween animations — values must be scannable/comparable instantly across a KPI row

---

## Anti-Patterns (Do NOT Use)

- ❌ Marketing chrome (hero image, testimonial, pricing table, "Book now" CTA) — this is an internal analytics tool, not a booking site
- ❌ Rainbow / qualitative color palettes on charts — stick to the two-hue teal/cognac system + neutral grid/muted-fg
- ❌ Decorative photos of rooms/hotels — every visual is a chart, table, or KPI card

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
