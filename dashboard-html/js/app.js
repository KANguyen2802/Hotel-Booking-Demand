(function () {
  const D = () => window.HBDData;
  const C = () => window.HBDCharts;

  const state = {
    view: "overview",
    hotels: [],
    years: [],
    allMonths: [],
    months: [],
    monthRange: { start: 0, end: 0 },
    adrOccPoints: [],
    adrOccBoxSelectEnabled: false,
    adrOccExpandedYears: new Set(),
    brush: {},
    leadChartMode: "bar",
    customerTypeMetric: "revenue",
    levers: { adrDelta: 5, occDelta: -2, cancelDelta: 0, elasticity: false },
    lastSimRows: [],
  };

  const BRUSH_LABELS = {
    hotel: "Hotel",
    lead_bin: "Lead",
    deposit_type: "Deposit",
    channel: "Channel",
    segment: "Segment",
    status: "Status",
    country: "Country",
    year_month: "Month",
    month_number: "Season month",
  };

  function hasCubeOnlyBrush() {
    const f = getFilters();
    return (
      !!f.segment ||
      !!f.channel ||
      !!f.deposit_type ||
      ["lead_bin", "deposit_type", "channel", "segment", "status", "country"].some((k) => state.brush[k] != null)
    );
  }

  function syncSelectValue(id, value) {
    const el = qs(id);
    if (!el) return;
    el.value = value || "";
    el.classList.toggle("has-value", !!el.value);
  }

  function brushActive() {
    return Object.keys(state.brush).length > 0;
  }

  function toggleBrush(dim, value) {
    if (value == null || value === "") {
      delete state.brush[dim];
    } else if (String(state.brush[dim]) === String(value)) {
      delete state.brush[dim];
    } else {
      state.brush[dim] = value;
    }
    if (dim === "segment") syncSelectValue("#filterSegment", state.brush.segment || "");
    if (dim === "channel") syncSelectValue("#filterChannel", state.brush.channel || "");
    if (dim === "deposit_type") syncSelectValue("#filterDeposit", state.brush.deposit_type || "");
    renderActive();
  }

  function clearBrush() {
    state.brush = {};
    renderActive();
  }

  function renderBrushBar() {
    const bar = qs("#brushBar");
    const chips = qs("#brushChips");
    if (!bar || !chips) return;
    if (!brushActive()) {
      bar.hidden = true;
      chips.innerHTML = "";
      return;
    }
    bar.hidden = false;
    chips.innerHTML = Object.entries(state.brush)
      .map(([k, v]) => {
        const label = k === "month_number" ? `M${String(v).padStart(2, "0")}` : v;
        return `<button type="button" class="chip" data-brush-dim="${k}">${BRUSH_LABELS[k] || k}: ${label} ×</button>`;
      })
      .join("");
    chips.querySelectorAll("[data-brush-dim]").forEach((btn) => {
      btn.addEventListener("click", () => toggleBrush(btn.dataset.brushDim, null));
    });
  }


  const COPY = {
    overview: {
      title: "Overview",
      subtitle: "Are we winning this month?",
    },
    revpar: {
      title: "RevPAR",
      subtitle: "Is our growth coming from price or from volume?",
    },
    cancellation: {
      title: "Cancellation Analysis",
      subtitle: "Where is revenue leaking before it even arrives?",
    },
    simulator: {
      title: "Dynamic Pricing Simulator",
      subtitle: "What happens if we change the price — before we actually change it?",
    },
  };

  function qs(sel) {
    return document.querySelector(sel);
  }

  function qsa(sel) {
    return [...document.querySelectorAll(sel)];
  }

  function getFilters() {
    const hotels = qsa("#hotelChips input:checked").map((el) => el.value);
    const years = qsa("#yearChips input:checked").map((el) => Number(el.value));
    const segment = qs("#filterSegment")?.value || "";
    const channel = qs("#filterChannel")?.value || "";
    const deposit_type = qs("#filterDeposit")?.value || "";
    const months = state.months;
    const mr = state.monthRange;
    const isFullRange = !months.length || (mr.start === 0 && mr.end === months.length - 1);
    return {
      hotels: hotels.length ? hotels : [...state.hotels],
      years: years.length ? years : [...state.years],
      segment: segment || null,
      channel: channel || null,
      deposit_type: deposit_type || null,
      monthFrom: isFullRange ? null : months[mr.start] || null,
      monthTo: isFullRange ? null : months[mr.end] || null,
    };
  }

  /**
   * 5-band rating vs Portugal/Europe STR-era benchmarks (2015–17) + operating rules of thumb.
   * Occupancy input: 0–1 fraction. ADR / RevPAR: €.
   */
  const KPI_RATING_BANDS = {
    adr: [
      { level: "excellent", min: 120, label: "Excellent" },
      { level: "good", min: 105, label: "Good" },
      { level: "fair", min: 90, label: "Fair" },
      { level: "weak", min: 75, label: "Weak" },
      { level: "poor", min: -Infinity, label: "Poor" },
    ],
    occupancy: [
      { level: "excellent", min: 0.8, label: "Excellent" },
      { level: "good", min: 0.72, label: "Good" },
      { level: "fair", min: 0.65, label: "Fair" },
      { level: "weak", min: 0.55, label: "Weak" },
      { level: "poor", min: -Infinity, label: "Poor" },
    ],
    revpar: [
      { level: "excellent", min: 90, label: "Excellent" },
      { level: "good", min: 75, label: "Good" },
      { level: "fair", min: 60, label: "Fair" },
      { level: "weak", min: 45, label: "Weak" },
      { level: "poor", min: -Infinity, label: "Poor" },
    ],
  };

  const KPI_RATING_HINT = {
    adr: "Excellent ≥€120 · Good ≥€105 · Fair ≥€90 · Weak ≥€75 · Poor <€75 (vs PT/Europe/Lisbon ADR)",
    occupancy:
      "Excellent ≥80% · Good ≥72% · Fair ≥65% · Weak ≥55% · Poor <55% (vs STR occupancy bands)",
    revpar:
      "Excellent ≥€90 · Good ≥€75 · Fair ≥€60 · Weak ≥€45 · Poor <€45 (vs PT/Lisbon RevPAR)",
  };

  function rateKpi(metric, value) {
    const bands = KPI_RATING_BANDS[metric];
    if (!bands || value == null || !Number.isFinite(Number(value))) return null;
    const v = Number(value);
    const hit = bands.find((b) => v >= b.min) || bands[bands.length - 1];
    return { level: hit.level, label: hit.label, hint: KPI_RATING_HINT[metric] || "" };
  }

  /** Compact SVG status icons — shape + label (not color alone) for WCAG. */
  function kpiRatingIcon(level) {
    const common = 'viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" focusable="false"';
    if (level === "excellent") {
      return `<svg ${common}><path fill="currentColor" d="M10 1.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L10 13.8 5.2 16.4l.9-5.4L2.2 7.2l5.4-.8L10 1.5z"/></svg>`;
    }
    if (level === "good") {
      return `<svg ${common}><path fill="currentColor" d="M10 2a8 8 0 100 16 8 8 0 000-16zm3.4 6.3l-4 4a1 1 0 01-1.4 0l-2-2a1 1 0 111.4-1.4L9 10.2l3.3-3.3a1 1 0 011.4 1.4z"/></svg>`;
    }
    if (level === "fair") {
      return `<svg ${common}><path fill="currentColor" d="M10 2a8 8 0 100 16 8 8 0 000-16zm4 8a1 1 0 01-1 1H7a1 1 0 110-2h6a1 1 0 011 1z"/></svg>`;
    }
    if (level === "weak") {
      return `<svg ${common}><path fill="currentColor" d="M10.9 3.2l6.4 11.1A1 1 0 0116.4 16H3.6a1 1 0 01-.9-1.7L9.1 3.2a1 1 0 011.8 0zM10 7a1 1 0 00-1 1v3a1 1 0 002 0V8a1 1 0 00-1-1zm0 7a1.2 1.2 0 100-2.4A1.2 1.2 0 0010 14z"/></svg>`;
    }
    return `<svg ${common}><path fill="currentColor" d="M10 2a8 8 0 100 16 8 8 0 000-16zm2.8 5.2a1 1 0 00-1.4-1.4L10 8.6 8.6 7.2A1 1 0 107.2 8.6L8.6 10l-1.4 1.4a1 1 0 101.4 1.4L10 11.4l1.4 1.4a1 1 0 001.4-1.4L11.4 10l1.4-1.4z"/></svg>`;
  }

  function kpiRatingHtml(rating) {
    if (!rating) return "";
    const hint = rating.hint ? ` title="${rating.hint.replace(/"/g, "&quot;")}"` : "";
    return `<div class="kpi-rating kpi-rating--${rating.level}" role="status" aria-label="Benchmark rating: ${rating.label}"${hint}>
      <span class="kpi-rating-icon">${kpiRatingIcon(rating.level)}</span>
      <span class="kpi-rating-label">${rating.label}</span>
    </div>`;
  }

  function shiftYearMonth(ym, years = -1) {
    if (!ym || typeof ym !== "string" || ym.length < 7) return null;
    const y = Number(ym.slice(0, 4));
    const m = ym.slice(5, 7);
    if (!Number.isFinite(y) || !m) return null;
    return `${y + years}-${m}`;
  }

  /** Relative % change helper → { text, signed, suffix, kind } or null. */
  function pctDelta(curr, prev, suffix) {
    const c = Number(curr);
    const p = Number(prev);
    if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
    const d = (c - p) / p;
    const signed = `${d >= 0 ? "+" : "−"}${Math.abs(d * 100).toFixed(1)}%`;
    return {
      signed,
      suffix: suffix || "YoY",
      text: `${d >= 0 ? "▲" : "▼"} ${Math.abs(d * 100).toFixed(1)}% ${suffix}`,
      kind: d >= 0 ? "up" : "down",
    };
  }

  function invertKind(kind) {
    if (kind === "up") return "down";
    if (kind === "down") return "up";
    return kind || "flat";
  }

  /** MoM = last vs previous month in series; YoY = last vs same month prior year. */
  function momYoyDeltas(trends, valueKey) {
    if (!trends || trends.length < 2) return { mom: null, yoy: null };
    const curr = trends[trends.length - 1];
    const prev = trends[trends.length - 2];
    const mom = pctDelta(curr[valueKey], prev[valueKey], "MoM");
    const yoyYm = shiftYearMonth(curr.year_month, -1);
    const yoyRow = yoyYm ? trends.find((r) => r.year_month === yoyYm) : null;
    const yoy = yoyRow ? pctDelta(curr[valueKey], yoyRow[valueKey], "YoY") : null;
    return { mom, yoy };
  }

  /** Last N months + same months prior year, aligned on the current x-axis. */
  function yoySparkSeries(trends, valueKey, months = 12) {
    if (!trends || !trends.length) return { current: [], prior: [] };
    const last = trends.slice(-months);
    const byYm = new Map(trends.map((r) => [r.year_month, r]));
    return {
      current: last.map((r) => {
        const v = Number(r[valueKey]);
        return Number.isFinite(v) ? v : null;
      }),
      prior: last.map((r) => {
        const ym = shiftYearMonth(r.year_month, -1);
        const row = ym ? byYm.get(ym) : null;
        if (!row) return null;
        const v = Number(row[valueKey]);
        return Number.isFinite(v) ? v : null;
      }),
    };
  }

  function sparkTone(spark, invert) {
    const curr = (spark?.current || []).filter((v) => v != null);
    if (curr.length < 2) return "flat";
    const a = curr[0];
    const b = curr[curr.length - 1];
    if (b === a) return "flat";
    const kind = b > a ? "up" : "down";
    return invert ? invertKind(kind) : kind;
  }

  function kpiTrendSpec(trends, valueKey, { invert = false, months = 12 } = {}) {
    const spark = yoySparkSeries(trends, valueKey, months);
    const { yoy } = momYoyDeltas(trends, valueKey);
    const yoyOut = yoy
      ? { ...yoy, tone: invert ? invertKind(yoy.kind) : yoy.kind }
      : null;
    const kind = yoyOut?.tone || sparkTone(spark, invert) || "flat";
    return { yoy: yoyOut, spark, kind };
  }

  function coordsFromValues(values, w, h, min, max, pad) {
    const span = max - min || 1;
    const n = values.length;
    return values.map((v, i) => {
      if (v == null || !Number.isFinite(v)) return null;
      return {
        x: pad + (i / Math.max(n - 1, 1)) * (w - pad * 2),
        y: h - pad - ((v - min) / span) * (h - pad * 2),
      };
    });
  }

  function polylinePath(coords) {
    let d = "";
    let started = false;
    coords.forEach((p) => {
      if (!p) {
        started = false;
        return;
      }
      d += `${started ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)} `;
      started = true;
    });
    return d.trim();
  }

  function areaPath(coords, baseline) {
    const segs = [];
    let cur = [];
    coords.forEach((p) => {
      if (p) cur.push(p);
      else if (cur.length) {
        segs.push(cur);
        cur = [];
      }
    });
    if (cur.length) segs.push(cur);
    return segs
      .filter((seg) => seg.length >= 2)
      .map((seg) => {
        const line = seg
          .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(" ");
        const last = seg[seg.length - 1];
        const first = seg[0];
        return `${line} L${last.x.toFixed(1)},${baseline} L${first.x.toFixed(1)},${baseline} Z`;
      })
      .join(" ");
  }

  /** Current period line + prior-year area (YoY comparison). */
  function sparklineYoySvg(spark) {
    const current = spark?.current || [];
    const prior = spark?.prior || [];
    if (current.filter((v) => v != null).length < 2) return "";
    const w = 240;
    const h = 56;
    const pad = 3;
    const vals = [...current, ...prior].filter((v) => v != null && Number.isFinite(v));
    if (!vals.length) return "";
    const rawMin = Math.min(...vals);
    const rawMax = Math.max(...vals);
    const padVal = (rawMax - rawMin) * 0.12 || Math.abs(rawMax) * 0.06 || 1;
    const min = rawMin - padVal;
    const max = rawMax + padVal;
    const currPts = coordsFromValues(current, w, h, min, max, pad);
    const priorPts = coordsFromValues(prior, w, h, min, max, pad);
    const line = polylinePath(currPts);
    const area = areaPath(priorPts, h - pad);
    if (!line) return "";
    return `<svg class="kpi-spark-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      ${area ? `<path class="kpi-spark-prior" d="${area}" />` : ""}
      <path class="kpi-spark-curr" d="${line}" />
    </svg>`;
  }

  function kpiArrowSvg(kind) {
    const common =
      'class="kpi-var-icon" viewBox="0 0 10 10" width="9" height="9" aria-hidden="true" focusable="false"';
    if (kind === "down") {
      return `<svg ${common}><polygon fill="currentColor" points="5,9 1,2 9,2"/></svg>`;
    }
    if (kind === "up") {
      return `<svg ${common}><polygon fill="currentColor" points="5,1 9,8 1,8"/></svg>`;
    }
    return `<svg ${common}><rect fill="currentColor" x="1.5" y="4.2" width="7" height="1.6" rx="0.6"/></svg>`;
  }

  function kpiYoyHtml(yoy, kind) {
    if (!yoy) return "";
    const tone = yoy.tone || yoy.kind || kind || "flat";
    const dirKind = yoy.kind || "flat";
    const signed = yoy.signed || yoy.text || "";
    const period = yoy.suffix || "YoY";
    const dir = dirKind === "up" ? "up" : dirKind === "down" ? "down" : "unchanged";
    return `<div class="kpi-var kpi-var--${tone}" aria-label="${dir} ${signed} ${period}">
      <span class="kpi-var-arrow">${kpiArrowSvg(dirKind)}</span>
      <span class="kpi-var-pct">${signed}</span>
      <span class="kpi-var-period">${period}</span>
    </div>`;
  }

  /** Unique years currently on the year chips / slider, ascending. */
  function slicerYears(f) {
    return [...new Set((f?.years || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  }

  function rowYear(r) {
    return Number(r.year ?? String(r.year_month || "").slice(0, 4));
  }

  function rowMonthNum(r) {
    return String(r.year_month || "").slice(5, 7);
  }

  /** Month-of-year constraint from the slider / brush, ignoring calendar year. */
  function cyPyMonthNums(f, brush) {
    if (brush?.year_month) return [String(brush.year_month).slice(5, 7)];
    if (brush?.month_number != null) return [String(brush.month_number).padStart(2, "0")];
    if (!f?.monthFrom || !f?.monthTo) return null;
    const months = (state.months || []).filter((m) => m >= f.monthFrom && m <= f.monthTo);
    const nums = [...new Set(months.map((m) => m.slice(5, 7)))];
    return nums.length >= 12 ? null : nums;
  }

  /**
   * CY/PY rows stay inside the slicer years (never pull an unselected CY−1).
   * Calendar monthFrom/monthTo is dropped so two selected years compare the same month-of-year set.
   */
  function rowsForCyPy(filterFn, f, brush) {
    const years = slicerYears(f);
    const rows = filterFn(
      { ...f, years, monthFrom: null, monthTo: null },
      { ...brush, year_month: undefined, month_number: undefined }
    );
    const nums = cyPyMonthNums(f, brush);
    if (!nums) return rows;
    const set = new Set(nums);
    return rows.filter((r) => set.has(rowMonthNum(r)));
  }

  /**
   * PY exists only when the slicer has ≥ 2 years.
   * CY = max selected year; PY = next-largest selected year (handles 2015+2017 gaps).
   * PY months are aligned to month-of-year present in CY.
   */
  function splitCyPy(rows, f) {
    const years = slicerYears(f);
    if (!years.length) return { cyYear: null, pyYear: null, cyRows: [], pyRows: [] };
    const cyYear = years[years.length - 1];
    const cyRows = rows.filter((r) => rowYear(r) === cyYear);
    if (years.length < 2) {
      return { cyYear, pyYear: null, cyRows, pyRows: [] };
    }
    const pyYear = years[years.length - 2];
    const months = new Set(cyRows.map(rowMonthNum));
    const pyRows = rows.filter((r) => rowYear(r) === pyYear && months.has(rowMonthNum(r)));
    return { cyYear, pyYear, cyRows, pyRows };
  }

  function yearPack(rows, kpisFn, f) {
    const split = splitCyPy(rows, f);
    return {
      ...split,
      cyKpis: kpisFn(split.cyRows),
      pyKpis: kpisFn(split.pyRows),
    };
  }

  function fmtCount(n) {
    const v = Number(n) || 0;
    const x = Math.abs(v);
    if (x >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (x >= 10_000) return `${(v / 1_000).toFixed(1)}K`;
    return Math.round(v).toLocaleString("en-US");
  }

  function absDelta(curr, prev, format) {
    const c = Number(curr);
    const p = Number(prev);
    if (!Number.isFinite(c) || !Number.isFinite(p)) return null;
    const d = c - p;
    return {
      signed: `${d >= 0 ? "+" : "−"}${format(Math.abs(d))}`,
      suffix: "vs PY",
      kind: d > 0 ? "up" : d < 0 ? "down" : "flat",
      hideArrow: true,
    };
  }

  function cyPySparkSeries(cyRows, pyRows, sparkKey, toMonthly) {
    if (!toMonthly || !sparkKey) return null;
    const cyM = toMonthly(cyRows || []);
    const pyM = toMonthly(pyRows || []);
    if (!cyM.length) return { current: [], prior: [] };
    const pyByMo = new Map();
    pyM.forEach((r) => {
      const v = Number(r[sparkKey]);
      if (Number.isFinite(v)) pyByMo.set(rowMonthNum(r), v);
    });
    return {
      current: cyM.map((r) => {
        const v = Number(r[sparkKey]);
        return Number.isFinite(v) ? v : null;
      }),
      prior: cyM.map((r) => {
        const v = pyByMo.get(rowMonthNum(r));
        return Number.isFinite(v) ? v : null;
      }),
    };
  }

  function attachCyPy(spec, pack, key, format, { invert = false, vsPyAbs = false, sparkKey, toMonthly } = {}) {
    const cyVal = pack.cyKpis?.[key];
    const pyVal = pack.pyKpis?.[key];
    const cyOk = pack.cyRows.length > 0 && Number.isFinite(Number(cyVal));
    const pyOk = pack.pyRows.length > 0 && Number.isFinite(Number(pyVal));
    const vsPyRaw =
      cyOk && pyOk
        ? vsPyAbs
          ? absDelta(cyVal, pyVal, format)
          : pctDelta(cyVal, pyVal, "vs PY")
        : null;
    const vsPy = vsPyRaw
      ? { ...vsPyRaw, tone: invert ? invertKind(vsPyRaw.kind) : vsPyRaw.kind }
      : null;
    const spark =
      sparkKey && toMonthly
        ? cyPySparkSeries(pack.cyRows, pack.pyRows, sparkKey, toMonthly)
        : spec.spark;
    return {
      ...spec,
      spark,
      kind: vsPy?.tone || spec.kind,
      pair: {
        cy: cyOk ? format(cyVal) : "—",
        py: pyOk ? format(pyVal) : "none",
        hasPy: pyOk,
        cyYear: pack.cyYear,
        pyYear: pyOk ? pack.pyYear : null,
        vsPy,
      },
    };
  }

  function kpiVsPyHtml(vsPy) {
    if (!vsPy) return "";
    const tone = vsPy.tone || vsPy.kind || "flat";
    const dirKind = vsPy.kind || "flat";
    const signed = vsPy.signed || "";
    const dir = dirKind === "up" ? "up" : dirKind === "down" ? "down" : "unchanged";
    return `<div class="kpi-year kpi-year--${tone}" aria-label="${dir} ${signed} versus previous year">
      ${vsPy.hideArrow ? "" : `<span class="kpi-var-arrow">${kpiArrowSvg(dirKind)}</span>`}
      <span class="kpi-year-pct">${signed}</span>
      <span class="kpi-year-period">vs PY</span>
    </div>`;
  }

  function kpiCyPyHtml(pair) {
    if (!pair) return "";
    const cyY = pair.cyYear != null ? ` ${pair.cyYear}` : "";
    const pyY = pair.hasPy && pair.pyYear != null ? ` ${pair.pyYear}` : "";
    const title = pair.hasPy
      ? `PY${pyY} vs CY${cyY} · same months`
      : `CY${cyY} · PY none (select 2 years to compare)`;
    return `<div class="kpi-yp" title="${title}">
      <span class="kpi-yp-item"><span class="kpi-yp-lab">PY</span><span class="kpi-yp-val">${pair.py}</span></span>
      <span class="kpi-yp-item"><span class="kpi-yp-lab">CY</span><span class="kpi-yp-val">${pair.cy}</span></span>
    </div>`;
  }

  function kpiDeltaHtml(delta, kind) {
    if (!delta) return "";
    // Stacked lines: [{ text, kind }, ...]
    if (Array.isArray(delta)) {
      return delta
        .filter(Boolean)
        .map((d) => `<div class="kpi-delta ${d.kind || "flat"}">${d.text}</div>`)
        .join("");
    }
    // Inline: { inline: true, parts: [{ text, kind }, ...] }
    if (typeof delta === "object" && delta.inline && Array.isArray(delta.parts)) {
      const parts = delta.parts.filter(Boolean);
      if (!parts.length) return "";
      return `<div class="kpi-delta-row">${parts
        .map(
          (d, i) =>
            `${i > 0 ? '<span class="kpi-delta-sep" aria-hidden="true">|</span>' : ""}<span class="kpi-delta ${d.kind || "flat"}">${d.text}</span>`
        )
        .join("")}</div>`;
    }
    if (typeof delta === "object") return "";
    return `<div class="kpi-delta ${kind || "flat"}">${delta}</div>`;
  }

  function normalizeKpiCard(card) {
    if (Array.isArray(card)) {
      return {
        label: card[0],
        value: card[1],
        delta: card[2],
        kind: card[3] || "flat",
        rating: card[4] || null,
      };
    }
    return {
      label: card.label,
      value: card.value,
      delta: card.delta,
      kind: card.kind || "flat",
      rating: card.rating || null,
      yoy: card.yoy || null,
      spark: card.spark || null,
      note: card.note || "",
      pair: card.pair || null,
    };
  }

  /** cards: array tuples (legacy) or { label, value, yoy, spark, rating, note } */
  function kpiHtml(cards) {
    return cards
      .map((raw) => {
        const card = normalizeKpiCard(raw);
        const sparkSvg = sparklineYoySvg(card.spark);
        const hasSpark = Boolean(sparkSvg);
        const kind = card.kind || card.yoy?.tone || card.yoy?.kind || "flat";
        const yoyBlock = kpiYoyHtml(card.yoy, kind);
        const pairBlock = kpiCyPyHtml(card.pair);
        const yearBlock = kpiVsPyHtml(card.pair?.vsPy);
        const deltaBlock = yoyBlock ? "" : kpiDeltaHtml(card.delta, kind);
        const noteBlock = hasSpark
          ? `<div class="kpi-note">${card.note || ""}</div>`
          : card.note
            ? `<div class="kpi-note">${card.note}</div>`
            : "";
        const title = card.note ? ` title="${String(card.note).replace(/"/g, "&quot;")}"` : "";
        const classes = [
          "kpi-card",
          card.rating ? "has-rating" : "",
          hasSpark ? "kpi-card--spark" : "",
          hasSpark || yoyBlock ? `kpi-card--${kind}` : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `
      <div class="${classes}"${title}>
        <div class="kpi-card-head">
          <div class="kpi-label">${card.label}</div>
          ${kpiRatingHtml(card.rating)}
        </div>
        <div class="kpi-value">${card.value}</div>
        ${yearBlock}${yoyBlock}${deltaBlock}${pairBlock}${noteBlock}
        ${hasSpark ? `<div class="kpi-spark-foot">
        <div class="kpi-spark" role="img" aria-label="${card.pair?.hasPy ? "Current year monthly trend versus previous year" : "Current year monthly trend"}">${sparkSvg}</div>
        <div class="kpi-spark-legend" aria-hidden="true">
          ${card.pair?.hasPy ? `<span class="kpi-spark-leg kpi-spark-leg--py"><i></i>PY</span>` : ""}
          <span class="kpi-spark-leg kpi-spark-leg--cy"><i></i>CY</span>
        </div>
        </div>` : ""}
      </div>`;
      })
      .join("");
  }

  function renderOverview() {
    const {
      fmtMoney,
      fmtNum,
      fmtPct,
      filterRevparBrushed,
      filterCube,
      overviewKpis,
      monthlyTrends,
      cubeSegments,
      cubeCountries,
      cubeMonthlyRevenue,
      cubeKpis,
    } = D();
    const f = getFilters();
    const brush = state.brush;
    renderBrushBar();

    const revRows = filterRevparBrushed(f, brush);
    const cubeRows = filterCube(f, brush);
    const useCubeTrend = hasCubeOnlyBrush();
    const revTrends = monthlyTrends(revRows);
    const trends = useCubeTrend ? cubeMonthlyRevenue(cubeRows) : revTrends;
    const kpisRev = overviewKpis(revRows);
    const kpisCube = cubeKpis(cubeRows);
    const revPack = yearPack(rowsForCyPy(filterRevparBrushed, f, brush), overviewKpis, f);
    const cubePack = yearPack(rowsForCyPy(filterCube, f, brush), cubeKpis, f);
    const volPack = useCubeTrend ? cubePack : revPack;

    const bookings = useCubeTrend ? kpisCube.bookings : kpisRev.bookings;
    const revenue = useCubeTrend ? kpisCube.revenue : kpisRev.revenue;
    const cancelRate = useCubeTrend ? kpisCube.cancel_rate : kpisRev.cancel_rate;
    const volMonthly = useCubeTrend ? cubeMonthlyRevenue : monthlyTrends;
    const bookSpec = attachCyPy(
      kpiTrendSpec(trends, "total_bookings"),
      volPack,
      "bookings",
      fmtCount,
      { vsPyAbs: true, sparkKey: "total_bookings", toMonthly: volMonthly }
    );
    const revSpec = attachCyPy(
      kpiTrendSpec(trends, "total_revenue"),
      volPack,
      "revenue",
      fmtMoney,
      { vsPyAbs: true, sparkKey: "total_revenue", toMonthly: volMonthly }
    );
    const adrSpec = attachCyPy(kpiTrendSpec(revTrends, "adr"), revPack, "adr", (v) => `€${fmtNum(v)}`, {
      sparkKey: "adr",
      toMonthly: monthlyTrends,
    });
    const occSpec = attachCyPy(
      kpiTrendSpec(revTrends, "occupancy_rate"),
      revPack,
      "occupancy",
      fmtPct,
      { sparkKey: "occupancy_rate", toMonthly: monthlyTrends }
    );
    const rpSpec = attachCyPy(kpiTrendSpec(revTrends, "revpar"), revPack, "revpar", (v) => `€${fmtNum(v)}`, {
      sparkKey: "revpar",
      toMonthly: monthlyTrends,
    });
    const cancelSpec = attachCyPy(
      kpiTrendSpec(trends, "cancel_rate", { invert: true }),
      volPack,
      "cancel_rate",
      fmtPct,
      { invert: true, sparkKey: "cancel_rate", toMonthly: volMonthly }
    );

    qs("#overviewKpis").innerHTML = kpiHtml([
      { label: "Bookings", value: bookings.toLocaleString("en-US"), ...bookSpec },
      { label: "Revenue", value: fmtMoney(revenue), ...revSpec },
      { label: "ADR", value: `€${fmtNum(kpisRev.adr)}`, rating: rateKpi("adr", kpisRev.adr), ...adrSpec },
      { label: "Occupancy", value: fmtPct(kpisRev.occupancy), rating: rateKpi("occupancy", kpisRev.occupancy), ...occSpec },
      { label: "RevPAR", value: `€${fmtNum(kpisRev.revpar)}`, rating: rateKpi("revpar", kpisRev.revpar), ...rpSpec },
      { label: "Cancel rate", value: fmtPct(cancelRate), ...cancelSpec },
    ]);

    window.HBDRange.render({
      key: "overviewTrend",
      detailId: "chartOverviewTrend",
      miniId: "chartOverviewTrendMini",
      mode: "dual",
      labels: trends.map((r) => r.year_month),
      seriesA: { label: "Revenue (€)", data: trends.map((r) => r.total_revenue), color: C().tokens().primary },
      seriesB: { label: "Bookings", data: trends.map((r) => r.total_bookings), color: C().tokens().accent },
      detailExtra: {
        externalLegendId: "overviewTrendLegend",
        activeLabel: brush.year_month || null,
        onSelect: (lab) => toggleBrush("year_month", lab),
      },
    });

    const { cubeChannelRevenue, filterCustomerType, customerTypeSeries } = D();
    const channelRev = cubeChannelRevenue(
      filterCube({ ...f, channel: null }, { ...brush, channel: undefined })
    );
    C().doughnut(
      "channelRevenue",
      "chartChannelRevenue",
      channelRev.map((r) => r.channel),
      channelRev.map((r) => r.revenue),
      {
        palette: true,
        valuePrefix: "€",
        compact: true,
        externalLegendId: "channelRevenueLegend",
        activeLabel: brush.channel || f.channel || null,
        onSelect: (lab) => toggleBrush("channel", lab),
      }
    );

    syncCustomerTypeMetricButtons();
    const ctRows = filterCustomerType(f, brush);
    const ctSeries = customerTypeSeries(ctRows, state.customerTypeMetric);
    const ctCaption = qs("#customerTypeCaption");
    if (ctCaption) {
      ctCaption.textContent =
        state.customerTypeMetric === "room_nights"
          ? "So hình dạng ba đường: nhóm nào giữ được room-nights ở mùa thấp là nguồn cầu nền đáng ký hợp đồng dài hạn; nhóm dao động mạnh chỉ nên nhận khi còn phòng trống."
          : "Nhóm đóng góp doanh thu lớn nhất quyết định ưu tiên sales. Nếu Contract phẳng trong khi Transient tăng, doanh thu đang phụ thuộc khách lẻ — rủi ro cao hơn khi cầu đảo chiều.";
    }
    const ctColors = [C().tokens().primary, C().tokens().accent, C().tokens().primarySoft];
    ctSeries.forEach((s, i) => {
      const titleEl = document.querySelectorAll(".small-multi-title")[i];
      if (titleEl) titleEl.textContent = s.customer_type;
      C().multiLine(
        `customerType${i}`,
        `chartCustomerType${i}`,
        s.labels,
        [
          {
            label: state.customerTypeMetric === "room_nights" ? "Room-nights" : "Revenue (€)",
            data: s.data,
            color: ctColors[i % ctColors.length],
            borderDash: [],
          },
        ],
        {
          hideLegend: true,
          activeLabel: brush.year_month || null,
          onSelect: (lab) => toggleBrush("year_month", lab),
        }
      );
    });

    const segs = cubeSegments(filterCube({ ...f, segment: null }, { ...brush, segment: undefined })).reverse();
    C().hbar(
      "segment",
      "chartSegment",
      segs.map((r) => r.market_segment),
      segs.map((r) => r.bookings),
      C().tokens().primary,
      {
        activeLabel: brush.segment || f.segment || null,
        onSelect: (lab) => toggleBrush("segment", lab),
      }
    );

    const countries = cubeCountries(filterCube(f, { ...brush, country: undefined })).reverse();
    C().hbar(
      "countries",
      "chartCountries",
      countries.map((r) => r.country),
      countries.map((r) => r.bookings),
      C().tokens().accent,
      {
        activeLabel: brush.country || null,
        onSelect: (lab) => toggleBrush("country", lab),
      }
    );
  }

  function syncCustomerTypeMetricButtons() {
    qsa("#customerTypeMetric [data-ct-metric]").forEach((btn) => {
      const on = btn.dataset.ctMetric === state.customerTypeMetric;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function renderRevpar() {
    const {
      fmtNum,
      fmtPct,
      fmtMoney,
      filterRevparBrushed,
      overviewKpis,
      monthlyTrends,
      seasonalityHeatmap,
      latestMonthByHotel,
      revparDecomposition,
      filterDailyAdrOcc,
      dailyScatterPoints,
      filterRoomType,
      roomTypeGrouped,
    } = D();
    const f = getFilters();
    const brush = state.brush;
    renderBrushBar();

    const rows = filterRevparBrushed(f, brush).sort(
      (a, b) => a.year_month.localeCompare(b.year_month) || a.hotel.localeCompare(b.hotel)
    );
    const kpis = overviewKpis(rows);
    const trends = monthlyTrends(rows);
    const pack = yearPack(rowsForCyPy(filterRevparBrushed, f, brush), overviewKpis, f);
    const rpSpec = attachCyPy(kpiTrendSpec(trends, "revpar"), pack, "revpar", (v) => `€${fmtNum(v)}`, {
      sparkKey: "revpar",
      toMonthly: monthlyTrends,
    });
    const adrSpec = attachCyPy(kpiTrendSpec(trends, "adr"), pack, "adr", (v) => `€${fmtNum(v)}`, {
      sparkKey: "adr",
      toMonthly: monthlyTrends,
    });
    const occSpec = attachCyPy(kpiTrendSpec(trends, "occupancy_rate"), pack, "occupancy", fmtPct, {
      sparkKey: "occupancy_rate",
      toMonthly: monthlyTrends,
    });
    const revSpec = attachCyPy(
      kpiTrendSpec(trends, "total_revenue"),
      pack,
      "revenue",
      fmtMoney,
      { vsPyAbs: true, sparkKey: "total_revenue", toMonthly: monthlyTrends }
    );

    qs("#revparKpis").innerHTML = kpiHtml([
      { label: "RevPAR", value: `€${fmtNum(kpis.revpar)}`, rating: rateKpi("revpar", kpis.revpar), ...rpSpec },
      { label: "ADR", value: `€${fmtNum(kpis.adr)}`, rating: rateKpi("adr", kpis.adr), ...adrSpec },
      { label: "Occupancy", value: fmtPct(kpis.occupancy), rating: rateKpi("occupancy", kpis.occupancy), ...occSpec },
      { label: "Revenue", value: `€${Math.round(kpis.revenue).toLocaleString("en-US")}`, ...revSpec },
    ]);

    const months = [...new Set(rows.map((r) => r.year_month))].sort();
    const hotels = [...new Set(rows.map((r) => r.hotel))].sort();
    const t = C().tokens();
    const datasets = hotels.map((hotel, i) => ({
      label: hotel,
      data: months.map((m) => {
        const hit = rows.find((r) => r.hotel === hotel && r.year_month === m);
        return hit ? hit.revpar : null;
      }),
      color: i === 0 ? t.primary : t.accent,
    }));
    window.HBDRange.render({
      key: "revparTrend",
      detailId: "chartRevparTrend",
      miniId: "chartRevparTrendMini",
      mode: "multi",
      labels: months,
      datasets,
      detailExtra: {
        externalLegendId: "revparTrendLegend",
        activeLabel: brush.year_month || null,
        onSelect: (lab) => toggleBrush("year_month", lab),
      },
    });

    const bridge = revparDecomposition(trends);
    const bridgeCap = qs("#revparBridgeCaption");
    const bridgeStats = qs("#revparBridgeStats");
    if (bridge) {
      if (bridgeCap) {
        const adrLed = Math.abs(bridge.delta_adr) >= Math.abs(bridge.delta_occ);
        const driver = adrLed ? "giá (ADR)" : "lấp phòng (Occupancy)";
        const action = adrLed
          ? "đòn bẩy đang nằm ở pricing — kiểm tra trước khi nới chiết khấu"
          : "đòn bẩy đang nằm ở sales/demand — ưu tiên lấp phòng thay vì đổi giá";
        bridgeCap.textContent = `${bridge.prev_month} → ${bridge.curr_month}: phần lớn thay đổi RevPAR đến từ ${driver}, ${action}. Cột xanh là phần cộng thêm, cột đỏ là phần bị mất.`;
      }
      if (bridgeStats) {
        bridgeStats.textContent = `Prev €${bridge.prev_revpar.toFixed(2)}; ΔADR €${bridge.delta_adr.toFixed(2)}; ΔOcc €${bridge.delta_occ.toFixed(2)}; Curr €${bridge.curr_revpar.toFixed(2)}`;
      }
      C().waterfall(
        "revparBridge",
        "chartRevparBridge",
        [
          { label: bridge.prev_month, value: bridge.prev_revpar, type: "total", color: t.primary },
          {
            label: "ΔADR",
            value: bridge.delta_adr,
            type: "delta",
            color: bridge.delta_adr >= 0 ? t.positive : t.destructive,
          },
          {
            label: "ΔOccupancy",
            value: bridge.delta_occ,
            type: "delta",
            color: bridge.delta_occ >= 0 ? t.accentSoft : t.destructive,
          },
          { label: bridge.curr_month, value: bridge.curr_revpar, type: "total", color: t.accent },
        ],
        { axisTitle: "RevPAR (€)" }
      );
    } else {
      if (bridgeCap) bridgeCap.textContent = "Cần ≥ 2 tháng trong filter để vẽ decomposition.";
      if (bridgeStats) bridgeStats.textContent = "";
      C().waterfall("revparBridge", "chartRevparBridge", [], { axisTitle: "RevPAR (€)" });
    }

    const dailyPts = dailyScatterPoints(filterDailyAdrOcc(f, brush));
    C().scatterHeat("adrOccScatter", "chartAdrOccScatter", dailyPts, {
      xTitle: "ADR (€)",
      yTitle: "Occupancy %",
    });
    state.adrOccPoints = dailyPts;
    clearAdrOccSelection();

    const roomGrouped = roomTypeGrouped(filterRoomType(f), { limit: 8 });
    C().groupedVbar(
      "roomTypeRevpar",
      "chartRoomTypeRevpar",
      roomGrouped.map((r) => r.room_type),
      [
        { label: "Reserved", data: roomGrouped.map((r) => r.reserved), color: t.primary },
        { label: "Assigned", data: roomGrouped.map((r) => r.assigned), color: t.accent },
      ],
      { axisTitle: "RevPAR (€)", externalLegendId: "roomTypeRevparLegend" }
    );

    C().dualAxisTrend(
      "adrOcc",
      "chartAdrOcc",
      trends.map((r) => r.year_month),
      { label: "ADR (€)", data: trends.map((r) => r.adr), color: t.primary },
      { label: "Occupancy", data: trends.map((r) => r.occupancy_rate * 100), color: t.accent },
      {
        externalLegendId: "adrOccLegend",
        activeLabel: brush.year_month || null,
        onSelect: (lab) => toggleBrush("year_month", lab),
      }
    );

    renderSeasonalityHeatmap(seasonalityHeatmap(rows));

    const latest = latestMonthByHotel(rows);
    C().hbar(
      "revparLatest",
      "chartRevparLatest",
      latest.rows.map((r) => r.hotel),
      latest.rows.map((r) => r.revpar),
      t.accent,
      {
        activeLabel: brush.hotel || null,
        onSelect: (lab) => toggleBrush("hotel", lab),
      }
    );

    const tableRows = rows
      .map(
        (r) => `<tr>
        <td>${r.hotel} · ${r.year_month}</td>
        <td>${r.total_bookings.toLocaleString("en-US")}</td>
        <td>${fmtNum(r.adr)}</td>
        <td>${fmtPct(r.occupancy_rate)}</td>
        <td>${fmtNum(r.revpar)}</td>
        <td>${Math.round(r.total_revenue).toLocaleString("en-US")}</td>
      </tr>`
      )
      .join("");

    qs("#revparTable").innerHTML = `
      <table class="data">
        <thead>
          <tr>
            <th>Hotel · Month</th><th>Bookings</th><th>ADR</th><th>Occ</th><th>RevPAR</th><th>Revenue</th>
          </tr>
        </thead>
        <tbody>${tableRows || `<tr><td colspan="6" class="empty">Không có dữ liệu</td></tr>`}</tbody>
      </table>`;
  }

  function heatColor(ratio) {
    const t = C().tokens();
    const a = Math.max(0, Math.min(1, ratio));
    const hex = (h) => {
      const n = h.replace("#", "");
      return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
    };
    const [r1, g1, b1] = hex(t.primary);
    const [r2, g2, b2] = hex(t.accent);
    const r = Math.round(r1 + (r2 - r1) * a);
    const g = Math.round(g1 + (g2 - g1) * a);
    const b = Math.round(b1 + (b2 - b1) * a);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function renderSeasonalityHeatmap(heat) {
    const box = qs("#revparHeatmap");
    if (!heat.hotels.length) {
      box.innerHTML = `<div class="empty">Không có dữ liệu</div>`;
      return;
    }
    const span = Math.max(heat.max - heat.min, 1e-6);
    const activeM = state.brush.month_number != null ? Number(state.brush.month_number) : null;
    const activeHotel = state.brush.hotel || null;
    const monthHeaders = heat.months.map((m) => `<th>M${String(m).padStart(2, "0")}</th>`).join("");
    const body = heat.hotels
      .map((hotel) => {
        const cells = heat.months
          .map((m) => {
            const v = heat.get(hotel, m);
            if (v == null) return `<td class="is-empty">—</td>`;
            const ratio = (v - heat.min) / span;
            const active =
              (activeM === m && (!activeHotel || activeHotel === hotel)) ||
              (activeHotel === hotel && activeM == null);
            return `<td class="${active ? "is-active" : ""}" data-hotel="${hotel}" data-month="${m}" style="background:${heatColor(ratio)}" title="${hotel} · M${m}: €${v.toFixed(1)}">${v.toFixed(0)}</td>`;
          })
          .join("");
        return `<tr><th class="row-label">${hotel}</th>${cells}</tr>`;
      })
      .join("");
    box.innerHTML = `<table><thead><tr><th></th>${monthHeaders}</tr></thead><tbody>${body}</tbody></table>`;
    box.querySelectorAll("td[data-month]").forEach((td) => {
      td.addEventListener("click", () => {
        const m = Number(td.dataset.month);
        const hotel = td.dataset.hotel;
        const same =
          Number(state.brush.month_number) === m && state.brush.hotel === hotel;
        if (same) {
          delete state.brush.month_number;
          delete state.brush.hotel;
          renderActive();
          return;
        }
        state.brush.month_number = m;
        state.brush.hotel = hotel;
        renderActive();
      });
    });
  }

  function syncLeadChartModeButtons() {
    qsa("#leadChartMode [data-lead-mode]").forEach((btn) => {
      const on = btn.dataset.leadMode === state.leadChartMode;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function renderLeadChartStats(stats) {
    const el = qs("#leadChartStats");
    if (!el) return;
    if (!stats || !stats.length) {
      el.textContent = "";
      return;
    }
    el.textContent = stats
      .map((s) => {
        if (!s.n) return `${s.lead_bin}: no samples`;
        return `${s.lead_bin}: n=${s.n}, min=${s.min.toFixed(1)}%, Q1=${s.q1.toFixed(1)}%, median=${s.median.toFixed(1)}%, Q3=${s.q3.toFixed(1)}%, max=${s.max.toFixed(1)}%, mean=${s.mean.toFixed(1)}%`;
      })
      .join(" · ");
  }

  function renderLeadChart(leadRows) {
    const { cubeLeadBins, cubeLeadCancelRateSamples } = D();
    const caption = qs("#leadChartCaption");
    const mode = state.leadChartMode || "bar";
    syncLeadChartModeButtons();

    if (mode === "bar") {
      const lead = cubeLeadBins(leadRows);
      if (caption)
        caption.textContent =
          "Cột càng cao thì booking đặt càng sớm càng dễ mất. Đây là căn cứ đặt mốc thời gian bắt đầu thu cọc và mức overbooking cho từng nhóm lead-time.";
      renderLeadChartStats([]);
      C().vbar(
        "cancelLead",
        "chartCancelLead",
        lead.map((r) => r.lead_bin),
        lead.map((r) => r.cancel_rate * 100),
        C().tokens().primary,
        {
          asPercent: true,
          counts: lead.map((r) => r.bookings),
          activeLabel: state.brush.lead_bin || null,
          onSelect: (lab) => toggleBrush("lead_bin", lab),
        }
      );
      return;
    }

    const dist = cubeLeadCancelRateSamples(leadRows);
    if (caption) {
      caption.textContent =
        mode === "violin"
          ? "Phần phình rộng cho biết mức cancel % xảy ra thường xuyên nhất ở mỗi lead bin. Nhiều đỉnh nghĩa là các hotel/tháng hành xử khác nhau — chính sách nên áp riêng, không áp chung."
          : "Đọc median trước, rồi độ rộng hộp: median cao là rủi ro hệ thống, hộp rộng là rủi ro không ổn định giữa các tháng nên cần buffer thay vì một mức cọc cố định.";
    }
    renderLeadChartStats(dist.stats);
    const fn = mode === "violin" ? C().violin : C().boxplot;
    fn(
      "cancelLead",
      "chartCancelLead",
      dist.labels,
      dist.samples,
      C().tokens().primary,
      {
        asPercent: true,
        stats: dist.stats,
        activeLabel: state.brush.lead_bin || null,
        onSelect: (lab) => toggleBrush("lead_bin", lab),
      }
    );
  }

  function renderCancellation() {
    const {
      fmtPct,
      fmtNum,
      fmtMoney,
      filterCube,
      cubeKpis,
      cubeStatusMix,
      cubeMonthlyTrend,
      cubeByKey,
      filterAdrCancelBox,
      statusFunnel,
    } = D();
    const f = getFilters();
    const rows = filterCube(f, state.brush);
    const kpis = cubeKpis(rows);
    const monthly = cubeMonthlyTrend(rows);
    const pack = yearPack(rowsForCyPy(filterCube, f, state.brush), cubeKpis, f);
    const cancelSpec = attachCyPy(
      kpiTrendSpec(monthly, "cancel_rate", { invert: true }),
      pack,
      "cancel_rate",
      fmtPct,
      { invert: true, sparkKey: "cancel_rate", toMonthly: cubeMonthlyTrend }
    );
    const noshowSpec = attachCyPy(
      kpiTrendSpec(monthly, "noshow_rate", { invert: true }),
      pack,
      "noshow_rate",
      fmtPct,
      { invert: true, sparkKey: "noshow_rate", toMonthly: cubeMonthlyTrend }
    );
    const canceledSpec = attachCyPy(
      kpiTrendSpec(monthly, "canceled", { invert: true }),
      pack,
      "canceled",
      fmtCount,
      { invert: true, sparkKey: "canceled", toMonthly: cubeMonthlyTrend }
    );
    const lostSpec = attachCyPy(
      kpiTrendSpec(monthly, "lost_est", { invert: true }),
      pack,
      "lost_est",
      fmtMoney,
      { invert: true, sparkKey: "lost_est", toMonthly: cubeMonthlyTrend }
    );

    renderBrushBar();

    qs("#cancelKpis").innerHTML = kpiHtml([
      {
        label: "Cancel rate",
        value: fmtPct(kpis.cancel_rate),
        note: `${kpis.canceled.toLocaleString("en-US")} canceled`,
        ...cancelSpec,
      },
      {
        label: "No-Show rate",
        value: fmtPct(kpis.noshow_rate),
        note: `${kpis.noshow.toLocaleString("en-US")} no-shows`,
        ...noshowSpec,
      },
      { label: "Canceled bookings", value: kpis.canceled.toLocaleString("en-US"), note: `${fmtPct(kpis.cancel_rate)} of bookings`, ...canceledSpec },
      {
        label: "Lost revenue (est.)",
        value: `€${Math.round(kpis.lost_est).toLocaleString("en-US")}`,
        note: "proxy · not accounting",
        ...lostSpec,
      },
    ]);

    const adrBox = filterAdrCancelBox(f);
    const adrCap = qs("#adrCancelCaption");
    const adrStats = qs("#adrCancelStats");
    const meanCancel = adrBox.summary.find((s) => s.label === "Canceled")?.mean;
    const meanKeep = adrBox.summary.find((s) => s.label === "Not canceled")?.mean;
    if (adrCap && meanCancel != null && meanKeep != null) {
      const gap = meanCancel - meanKeep;
      adrCap.textContent =
        gap > 0
          ? `ADR trung bình nhóm hủy €${fmtNum(meanCancel)} cao hơn nhóm giữ €${fmtNum(meanKeep)} (chênh €${fmtNum(gap)}): doanh thu mất tập trung ở phân khúc giá cao — nên áp cọc/phí hủy cho booking ADR cao thay vì giảm giá toàn dải.`
          : `ADR trung bình nhóm hủy €${fmtNum(meanCancel)} không cao hơn nhóm giữ €${fmtNum(meanKeep)}: hủy không gắn với mức giá, nên tìm nguyên nhân ở kênh bán và lead-time trước khi động đến chính sách giá.`;
    }
    if (adrStats) {
      adrStats.textContent = adrBox.summary
        .map((s) => `${s.label}: n=${s.n}, mean=€${s.mean != null ? s.mean.toFixed(1) : "—"}`)
        .join(" · ");
    }
    C().boxplot(
      "adrCancelBox",
      "chartAdrCancelBox",
      adrBox.labels,
      adrBox.samples,
      C().tokens().accent,
      {
        asPercent: false,
        axisTitle: "ADR (€)",
        datasetLabel: "ADR",
        beginAtZero: false,
      }
    );

    const funnel = statusFunnel(cubeStatusMix(filterCube(f, { ...state.brush, status: undefined })));
    C().funnel("statusFunnel", "chartStatusFunnel", funnel.labels, funnel.values, {
      axisTitle: "Bookings",
    });

    const status = cubeStatusMix(filterCube(f, { ...state.brush, status: undefined }));
    C().doughnut(
      "cancelStatus",
      "chartCancelStatus",
      status.map((r) => r.status),
      status.map((r) => r.bookings),
      {
        externalLegendId: "cancelStatusLegend",
        activeLabel: state.brush.status || null,
        onSelect: (lab) => toggleBrush("status", lab),
      }
    );

    const t = C().tokens();
    window.HBDRange.render({
      key: "cancelTrend",
      detailId: "chartCancelTrend",
      miniId: "chartCancelTrendMini",
      mode: "multi",
      labels: monthly.map((r) => r.year_month),
      datasets: [
        {
          label: "Cancel %",
          data: monthly.map((r) => r.cancel_rate * 100),
          color: t.accent,
          borderDash: [],
        },
        {
          label: "No-Show %",
          data: monthly.map((r) => r.noshow_rate * 100),
          color: t.noshow,
          borderDash: [5, 4],
        },
      ],
      detailExtra: {
        externalLegendId: "cancelTrendLegend",
        activeLabel: state.brush.year_month || null,
        onSelect: (lab) => toggleBrush("year_month", lab),
      },
    });

    // Dimension charts: exclude own brush dim so bars stay visible for reselection
    const leadRows = filterCube(f, { ...state.brush, lead_bin: undefined });
    renderLeadChart(leadRows);

    const deposit = cubeByKey(
      filterCube({ ...f, deposit_type: null }, { ...state.brush, deposit_type: undefined }),
      "deposit_type"
    ).sort((a, b) => a.cancel_rate - b.cancel_rate);
    C().hbar(
      "cancelDeposit",
      "chartCancelDeposit",
      deposit.map((r) => r.deposit_type),
      deposit.map((r) => r.cancel_rate * 100),
      C().tokens().accent,
      {
        asPercent: true,
        counts: deposit.map((r) => r.bookings),
        activeLabel: state.brush.deposit_type || f.deposit_type || null,
        onSelect: (lab) => toggleBrush("deposit_type", lab),
      }
    );

    const channel = cubeByKey(
      filterCube({ ...f, channel: null }, { ...state.brush, channel: undefined }),
      "channel"
    ).sort((a, b) => a.cancel_rate - b.cancel_rate);
    C().hbar(
      "cancelChannel",
      "chartCancelChannel",
      channel.map((r) => r.channel),
      channel.map((r) => r.cancel_rate * 100),
      C().tokens().accentSoft,
      {
        asPercent: true,
        counts: channel.map((r) => r.bookings),
        activeLabel: state.brush.channel || f.channel || null,
        onSelect: (lab) => toggleBrush("channel", lab),
      }
    );

    const seg = cubeByKey(
      filterCube({ ...f, segment: null }, { ...state.brush, segment: undefined }),
      "segment",
      {
        minBookings: 50,
        limit: 10,
      }
    ).sort((a, b) => a.cancel_rate - b.cancel_rate);
    C().hbar(
      "cancelSegment",
      "chartCancelSegment",
      seg.map((r) => r.segment),
      seg.map((r) => r.cancel_rate * 100),
      C().tokens().primarySoft,
      {
        asPercent: true,
        counts: seg.map((r) => r.bookings),
        activeLabel: state.brush.segment || f.segment || null,
        onSelect: (lab) => toggleBrush("segment", lab),
      }
    );
  }

  function readLevers() {
    state.levers = {
      adrDelta: Number(qs("#levAdr").value),
      occDelta: Number(qs("#levOcc").value),
      cancelDelta: Number(qs("#levCancel").value),
      elasticity: qs("#levElasticity").checked,
    };
    const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
    qs("#valAdr").textContent = `${sign(state.levers.adrDelta)}%`;
    qs("#valOcc").textContent = `${sign(state.levers.occDelta)} pp`;
    qs("#valCancel").textContent = `${sign(state.levers.cancelDelta)} pp`;
  }

  function renderSimulator() {
    const { fmtMoney, fmtNum, fmtPct, filterRevparBrushed, simulate, weightedMean } = D();
    readLevers();
    const f = getFilters();
    renderBrushBar();
    const hotels = f.hotels;
    const base = filterRevparBrushed({ ...f, hotels }, state.brush).sort((a, b) =>
      a.year_month.localeCompare(b.year_month)
    );
    if (!base.length) {
      qs("#simKpis").innerHTML = `<div class="empty">Không có dữ liệu cho bộ lọc hiện tại.</div>`;
      return;
    }

    const sim = simulate(base, state.levers);
    state.lastSimRows = sim;

    const revpar_base = weightedMean(sim, "revpar_base", "total_bookings");
    const revpar_sim = weightedMean(sim, "revpar_sim", "total_bookings");
    const rev_base = sim.reduce((s, r) => s + r.total_revenue, 0);
    const rev_sim = sim.reduce((s, r) => s + r.revenue_sim, 0);
    const adr_base = weightedMean(sim, "adr", "successful_bookings");
    const adr_sim = weightedMean(sim, "adr_sim", "successful_bookings");
    const occ_base = weightedMean(sim, "occupancy_rate", "total_bookings");
    const occ_sim = weightedMean(sim, "occ_sim", "total_bookings");
    const dRevpar = revpar_base ? (revpar_sim / revpar_base - 1) * 100 : 0;
    const dRev = rev_base ? (rev_sim / rev_base - 1) * 100 : 0;

    qs("#simKpis").innerHTML = kpiHtml([
      ["RevPAR baseline", `€${fmtNum(revpar_base)}`, null, "flat"],
      ["RevPAR scenario", `€${fmtNum(revpar_sim)}`, `${dRevpar >= 0 ? "+" : ""}${dRevpar.toFixed(1)}%`, dRevpar >= 0 ? "up" : "down"],
      ["Revenue scenario", fmtMoney(rev_sim), `${dRev >= 0 ? "+" : ""}${dRev.toFixed(1)}%`, dRev >= 0 ? "up" : "down"],
      ["ADR → Occ", `€${fmtNum(adr_base)} → €${fmtNum(adr_sim)}`, `${fmtPct(occ_base)} → ${fmtPct(occ_sim)}`, "flat"],
    ]);

    // Aggregate by month for charts when multiple hotels
    const byMonth = new Map();
    sim.forEach((r) => {
      if (!byMonth.has(r.year_month)) {
        byMonth.set(r.year_month, { year_month: r.year_month, w: 0, base: 0, scen: 0 });
      }
      const g = byMonth.get(r.year_month);
      g.w += r.total_bookings;
      g.base += r.revpar_base * r.total_bookings;
      g.scen += r.revpar_sim * r.total_bookings;
    });
    const monthly = [...byMonth.values()]
      .map((g) => ({
        year_month: g.year_month,
        revpar_base: g.w ? g.base / g.w : 0,
        revpar_sim: g.w ? g.scen / g.w : 0,
      }))
      .sort((a, b) => a.year_month.localeCompare(b.year_month));

    const t = C().tokens();
    const monthLabels = monthly.map((r) => r.year_month);
    window.HBDRange.render({
      key: "simTrend",
      detailId: "chartSimTrend",
      miniId: "chartSimTrendMini",
      mode: "multi",
      labels: monthLabels,
      datasets: [
        { label: "Baseline", data: monthly.map((r) => r.revpar_base), color: t.primary, borderDash: [] },
        { label: "Scenario", data: monthly.map((r) => r.revpar_sim), color: t.accent, borderDash: [5, 4] },
      ],
      detailExtra: {
        externalLegendId: "simTrendLegend",
        activeLabel: state.brush.year_month || null,
        onSelect: (lab) => toggleBrush("year_month", lab),
      },
    });

    const deltas = monthly.map((r) =>
      r.revpar_base ? ((r.revpar_sim / r.revpar_base - 1) * 100) : 0
    );
    C().barsSigned("simDelta", "chartSimDelta", monthLabels, deltas, {
      activeLabel: state.brush.year_month || null,
      onSelect: (lab) => toggleBrush("year_month", lab),
    });

    const adrOnly = weightedMean(
      sim.map((r) => ({ ...r, v: r.adr_sim * r.occupancy_rate })),
      "v",
      "total_bookings"
    );
    const occOnly = weightedMean(
      sim.map((r) => ({ ...r, v: r.adr * r.occ_sim })),
      "v",
      "total_bookings"
    );
    C().sensitivity("simSens", "chartSimSens", ["Baseline", "ADR only", "Occ only", "Combined"], [
      revpar_base,
      adrOnly,
      occOnly,
      revpar_sim,
    ]);

    const tableRows = sim
      .map(
        (r) => `<tr>
        <td>${r.hotel} · ${r.year_month}</td>
        <td>${fmtNum(r.adr)}</td>
        <td>${fmtNum(r.adr_sim)}</td>
        <td>${fmtPct(r.occupancy_rate)}</td>
        <td>${fmtPct(r.occ_sim)}</td>
        <td>${fmtNum(r.revpar_base)}</td>
        <td>${fmtNum(r.revpar_sim)}</td>
        <td>${Math.round(r.total_revenue).toLocaleString("en-US")}</td>
        <td>${Math.round(r.revenue_sim).toLocaleString("en-US")}</td>
      </tr>`
      )
      .join("");

    qs("#simTable").innerHTML = `
      <table class="data">
        <thead>
          <tr>
            <th>Hotel · Month</th><th>ADR</th><th>ADR sim</th><th>Occ</th><th>Occ sim</th>
            <th>RevPAR</th><th>RevPAR sim</th><th>Revenue</th><th>Revenue sim</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>`;
  }

  function renderActive() {
    if (state.view === "overview") renderOverview();
    else if (state.view === "revpar") renderRevpar();
    else if (state.view === "cancellation") renderCancellation();
    else renderSimulator();
  }

  function setView(view) {
    state.view = view;
    qsa(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    qsa(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
    const copy = COPY[view];
    qs("#pageTitle").textContent = copy.title;
    qs("#pageSubtitle").textContent = copy.subtitle;
    renderActive();
  }

  function buildHotelChips(hotels) {
    const box = qs("#hotelChips");
    box.innerHTML = hotels
      .map(
        (h) => `
      <label class="chip">
        <input type="checkbox" value="${h}" checked />
        ${h}
      </label>`
      )
      .join("");
    qsa("#hotelChips input").forEach((el) => {
      el.addEventListener("change", renderActive);
    });
  }

  function buildYearChips(years) {
    const box = qs("#yearChips");
    box.innerHTML = years
      .map(
        (y) => `
      <label class="chip">
        <input type="checkbox" value="${y}" checked />
        ${y}
      </label>`
      )
      .join("");
    qsa("#yearChips input").forEach((el) => {
      el.addEventListener("change", () => {
        syncMonthRangeFromYearChips();
        renderActive();
      });
    });
  }

  function yearOfMonth(ym) {
    return Number(String(ym).slice(0, 4));
  }

  /** Slider → chips: check exactly the years the current [monthFrom, monthTo] selection touches. */
  function syncYearChipsFromMonthRange() {
    const months = state.months;
    if (!months.length) return;
    const fromYear = yearOfMonth(months[state.monthRange.start]);
    const toYear = yearOfMonth(months[state.monthRange.end]);
    qsa("#yearChips input").forEach((el) => {
      el.checked = Number(el.value) >= fromYear && Number(el.value) <= toYear;
    });
  }

  /** Chips → slider: move the slider's outer bounds to span the checked years (no year checked = full range). */
  function syncMonthRangeFromYearChips() {
    const months = state.months;
    if (!months.length) return;
    const checked = qsa("#yearChips input:checked").map((el) => Number(el.value));
    if (!checked.length) {
      state.monthRange = { start: 0, end: months.length - 1 };
      syncMonthRangeUI();
      return;
    }
    const minYear = Math.min(...checked);
    const maxYear = Math.max(...checked);
    let startIdx = months.findIndex((m) => yearOfMonth(m) >= minYear);
    if (startIdx === -1) startIdx = 0;
    let endIdx = -1;
    for (let i = months.length - 1; i >= 0; i -= 1) {
      if (yearOfMonth(months[i]) <= maxYear) {
        endIdx = i;
        break;
      }
    }
    if (endIdx === -1) endIdx = months.length - 1;
    if (endIdx < startIdx) endIdx = startIdx;
    state.monthRange = { start: startIdx, end: endIdx };
    syncMonthRangeUI();
  }

  function syncMonthRangeUI() {
    const months = state.months;
    const win = qs("#monthRangeWindow");
    const label = qs("#monthRangeLabel");
    if (!win || !months.length) return;
    const n = months.length;
    const { start, end } = state.monthRange;
    const step = n > 1 ? 100 / (n - 1) : 100;
    const left = start * step;
    const right = end * step;
    win.style.left = `${left}%`;
    win.style.width = `${Math.max(right - left, n > 1 ? step : 100)}%`;
    if (label) label.textContent = `${months[start]} → ${months[end]}`;

    const handleL = qs("#monthRangeHandleL");
    const handleR = qs("#monthRangeHandleR");
    if (handleL) {
      handleL.setAttribute("aria-valuemin", "0");
      handleL.setAttribute("aria-valuemax", String(end));
      handleL.setAttribute("aria-valuenow", String(start));
      handleL.setAttribute("aria-valuetext", months[start]);
    }
    if (handleR) {
      handleR.setAttribute("aria-valuemin", String(start));
      handleR.setAttribute("aria-valuemax", String(n - 1));
      handleR.setAttribute("aria-valuenow", String(end));
      handleR.setAttribute("aria-valuetext", months[end]);
    }
  }

  function setMonthRange(start, end) {
    const n = state.months.length;
    if (!n) return;
    const s = Math.max(0, Math.min(Math.round(start), n - 1));
    const e = Math.max(s, Math.min(Math.round(end), n - 1));
    if (s === state.monthRange.start && e === state.monthRange.end) return;
    state.monthRange = { start: s, end: e };
    syncMonthRangeUI();
    syncYearChipsFromMonthRange();
    renderActive();
  }

  function resetMonthRange() {
    if (!state.months.length) return;
    state.monthRange = { start: 0, end: state.months.length - 1 };
    syncMonthRangeUI();
    syncYearChipsFromMonthRange();
  }

  /** Sidebar year-month range slicer: drag the window/handles, or use arrow keys on a focused handle. */
  function initMonthRangeSlicer() {
    const track = qs("#monthRangeTrack");
    const win = qs("#monthRangeWindow");
    const handleL = qs("#monthRangeHandleL");
    const handleR = qs("#monthRangeHandleR");
    if (!track || !win || !handleL || !handleR) return;

    if (win.dataset.bound !== "1") {
      win.dataset.bound = "1";
      let mode = null;
      let originX = 0;
      let originStart = 0;
      let originEnd = 0;

      const onDown = (e, m) => {
        mode = m;
        originX = e.clientX;
        originStart = state.monthRange.start;
        originEnd = state.monthRange.end;
        win.classList.add("is-dragging");
        try {
          win.setPointerCapture(e.pointerId);
        } catch (_) {
          /* ignore */
        }
        e.preventDefault();
        e.stopPropagation();
      };

      handleL.addEventListener("pointerdown", (e) => onDown(e, "left"));
      handleR.addEventListener("pointerdown", (e) => onDown(e, "right"));
      win.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".month-range-handle")) return;
        onDown(e, "move");
      });

      window.addEventListener("pointermove", (e) => {
        if (!mode) return;
        const n = state.months.length;
        if (n <= 1) return;
        const rect = track.getBoundingClientRect();
        const dx = e.clientX - originX;
        const dIdx = Math.round((dx / Math.max(rect.width, 1)) * (n - 1));
        if (mode === "move") {
          const span = originEnd - originStart;
          let ns = originStart + dIdx;
          let ne = ns + span;
          if (ns < 0) {
            ne -= ns;
            ns = 0;
          }
          if (ne > n - 1) {
            ns -= ne - (n - 1);
            ne = n - 1;
          }
          setMonthRange(Math.max(0, ns), Math.min(n - 1, ne));
        } else if (mode === "left") {
          setMonthRange(originStart + dIdx, originEnd);
        } else if (mode === "right") {
          setMonthRange(originStart, originEnd + dIdx);
        }
      });

      const onUp = () => {
        if (!mode) return;
        mode = null;
        win.classList.remove("is-dragging");
      };
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);

      const onKey = (which) => (e) => {
        const step = e.shiftKey ? 3 : 1;
        const { start, end } = state.monthRange;
        const n = state.months.length;
        if (which === "left") {
          if (e.key === "ArrowLeft") setMonthRange(start - step, end);
          else if (e.key === "ArrowRight") setMonthRange(start + step, end);
          else if (e.key === "Home") setMonthRange(0, end);
          else if (e.key === "End") setMonthRange(end, end);
          else return;
        } else {
          if (e.key === "ArrowLeft") setMonthRange(start, end - step);
          else if (e.key === "ArrowRight") setMonthRange(start, end + step);
          else if (e.key === "Home") setMonthRange(start, start);
          else if (e.key === "End") setMonthRange(start, n - 1);
          else return;
        }
        e.preventDefault();
      };
      handleL.addEventListener("keydown", onKey("left"));
      handleR.addEventListener("keydown", onKey("right"));
    }

    syncMonthRangeUI();
  }

  function clearAdrOccSelection() {
    const rect = qs("#adrOccBoxRect");
    const card = qs("#adrOccBoxCard");
    if (rect) rect.hidden = true;
    if (card) card.hidden = true;
    state.adrOccExpandedYears.clear();
    C().setScatterHighlight("adrOccScatter", null);
  }

  function yearMonthNestBreakdown(points) {
    const total = (points || []).length || 1;
    const yearMap = new Map();
    (points || []).forEach((p) => {
      const year =
        p.year != null ? String(p.year) : String(p.label || "").slice(0, 4);
      const ym = p.year_month || String(p.label || "").slice(0, 7);
      if (!year || !ym) return;
      if (!yearMap.has(year)) yearMap.set(year, new Map());
      const months = yearMap.get(year);
      months.set(ym, (months.get(ym) || 0) + 1);
    });
    return [...yearMap.entries()]
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([year, months]) => {
        const count = [...months.values()].reduce((s, c) => s + c, 0);
        return {
          year,
          count,
          pct: (count / total) * 100,
          months: [...months.entries()]
            .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
            .map(([ym, monthCount]) => ({
              key: ym,
              count: monthCount,
              pct: count > 0 ? (monthCount / count) * 100 : 0,
            })),
        };
      });
  }

  function formatMonthInYear(ym) {
    const parts = String(ym || "").split("-");
    if (parts.length < 2) return String(ym || "");
    const month = Number(parts[1]);
    return Number.isFinite(month) ? `Thg ${month}` : String(ym);
  }

  function renderYearDropdownBreakdown(el, selected) {
    if (!el) return;
    const years = yearMonthNestBreakdown(selected);
    if (!years.length) {
      el.innerHTML = "";
      return;
    }
    const chevron = `<svg class="box-select-year-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    el.innerHTML = `
      <div class="box-select-breakdown-title">Theo năm</div>
      <div class="box-select-year-list">
        ${years
          .map((y) => {
            const open = state.adrOccExpandedYears.has(y.year);
            const panelId = `adrOccYearMonths-${y.year}`;
            return `<div class="box-select-year-item${open ? " is-open" : ""}" data-year="${y.year}">
              <button
                type="button"
                class="box-select-year-toggle"
                aria-expanded="${open ? "true" : "false"}"
                aria-controls="${panelId}"
              >
                <span class="box-select-year-left">${chevron}<span>${y.year}</span></span>
                <span>${y.pct.toFixed(1)}% <span class="box-select-card-count">(${y.count})</span></span>
              </button>
              <div class="box-select-year-months" id="${panelId}" ${open ? "" : "hidden"}>
                ${y.months
                  .map(
                    (m) => `<div class="box-select-card-row">
                      <span>${formatMonthInYear(m.key)}</span>
                      <span>${m.pct.toFixed(1)}% <span class="box-select-card-count">(${m.count})</span></span>
                    </div>`
                  )
                  .join("")}
              </div>
            </div>`;
          })
          .join("")}
      </div>`;

    el.querySelectorAll(".box-select-year-toggle").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const item = btn.closest(".box-select-year-item");
        const year = item?.dataset?.year;
        const panel = item?.querySelector(".box-select-year-months");
        if (!year || !panel) return;
        const willOpen = btn.getAttribute("aria-expanded") !== "true";
        btn.setAttribute("aria-expanded", String(willOpen));
        panel.hidden = !willOpen;
        item.classList.toggle("is-open", willOpen);
        if (willOpen) state.adrOccExpandedYears.add(year);
        else state.adrOccExpandedYears.delete(year);
      });
    });
  }

  function stdev(values) {
    const arr = (values || []).filter((v) => Number.isFinite(v));
    const n = arr.length;
    if (n < 2) return 0;
    const mean = arr.reduce((s, v) => s + v, 0) / n;
    const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
    return Math.sqrt(variance);
  }

  function formatDeltaPct(pct, { signed = true } = {}) {
    if (!Number.isFinite(pct)) return "—";
    const sign = signed && pct > 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)} pp`;
  }

  function formatDeltaRelPct(pct) {
    if (!Number.isFinite(pct)) return "—";
    const sign = pct > 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}%`;
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function topSegmentsFromPoints(points, limit = 2) {
    const totals = {};
    let all = 0;
    (points || []).forEach((p) => {
      let segs = p.segments;
      if (typeof segs === "string") {
        try {
          segs = JSON.parse(segs);
        } catch (_) {
          segs = null;
        }
      }
      if (!segs || typeof segs !== "object" || Array.isArray(segs)) return;
      Object.keys(segs).forEach((name) => {
        const n = Number(segs[name]) || 0;
        if (!n) return;
        totals[name] = (totals[name] || 0) + n;
        all += n;
      });
    });
    return Object.keys(totals)
      .map((name) => ({
        name,
        bookings: totals[name],
        pct: all > 0 ? (totals[name] / all) * 100 : 0,
      }))
      .sort((a, b) => b.bookings - a.bookings || a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  function renderMetricGroup(title, rows) {
    return `<div class="box-select-group">
      <div class="box-select-group-title">${title}</div>
      <div class="box-select-card-rows box-select-card-rows--flush">
        ${rows
          .map(
            ([label, value, hint]) => `<div class="box-select-card-row">
              <span>${label}${hint ? `<small class="box-select-card-hint">${hint}</small>` : ""}</span>
              <span>${value}</span>
            </div>`
          )
          .join("")}
      </div>
    </div>`;
  }

  function renderAdrOccCard(selected) {
    const card = qs("#adrOccBoxCard");
    const countEl = qs("#adrOccBoxCount");
    const shareEl = qs("#adrOccBoxShare");
    const statsEl = qs("#adrOccBoxStats");
    const yearsEl = qs("#adrOccBoxYears");
    if (!card || !countEl || !shareEl || !statsEl) return;
    const { fmtMoney } = D();
    const baseline = state.adrOccPoints || [];
    const totalDays = baseline.length || 1;
    const n = selected.length;
    if (!n) {
      card.hidden = true;
      return;
    }

    const sumKey = (pts, key) => pts.reduce((s, p) => s + (Number(p[key]) || 0), 0);
    const avgKey = (pts, key) => (pts.length ? sumKey(pts, key) / pts.length : 0);

    const selRevenue = sumKey(selected, "revenue");
    const selBookings = sumKey(selected, "bookings");
    const selCanceled = sumKey(selected, "canceled");
    const baseRevenue = sumKey(baseline, "revenue");
    const baseBookings = sumKey(baseline, "bookings");
    const baseCanceled = sumKey(baseline, "canceled");

    const dayShare = (n / totalDays) * 100;
    const avgAdr = avgKey(selected, "x");
    const avgOcc = avgKey(selected, "y");
    // RevPAR = ADR × Occupancy (cách tính ban đầu).
    const revpar = avgAdr * (avgOcc / 100);
    const baseRevpar = avgKey(baseline, "x") * (avgKey(baseline, "y") / 100);
    const cancelRate = selBookings > 0 ? (selCanceled / selBookings) * 100 : 0;
    const baseCancelRate = baseBookings > 0 ? (baseCanceled / baseBookings) * 100 : 0;
    const cancelDeltaPp = cancelRate - baseCancelRate;
    const revparDeltaPct =
      baseRevpar > 0 ? ((revpar - baseRevpar) / baseRevpar) * 100 : NaN;
    const revenueSharePct = baseRevenue > 0 ? (selRevenue / baseRevenue) * 100 : 0;

    const occValues = selected.map((p) => Number(p.y)).filter((v) => Number.isFinite(v));
    const occMin = occValues.length ? Math.min(...occValues) : 0;
    const occMax = occValues.length ? Math.max(...occValues) : 0;
    const occSd = stdev(occValues);
    const topSegs = topSegmentsFromPoints(selected, 2);
    const topSegRows = topSegs.length
      ? topSegs.map((s, i) => [
          i === 0 ? "Top segment" : `Top segment #${i + 1}`,
          escapeHtml(s.name),
          `${s.pct.toFixed(0)}% (${s.bookings})`,
        ])
      : [["Top segment", "—"]];

    countEl.textContent = `${n} ngày`;
    shareEl.textContent = `${dayShare.toFixed(1)}% số ngày đang hiển thị`;

    statsEl.innerHTML = [
      renderMetricGroup("Hiệu suất giá & lấp đầy", [
        ["Tổng doanh thu", fmtMoney(selRevenue)],
        ["ADR trung bình", `€${avgAdr.toFixed(1)}`],
        ["Occupancy trung bình", `${avgOcc.toFixed(1)}%`],
        ["RevPAR trung bình", `€${revpar.toFixed(1)}`],
      ]),
      renderMetricGroup("Benchmark & cấu trúc", [
        [
          "Cancellation rate",
          `${cancelRate.toFixed(1)}%`,
          `${formatDeltaPct(cancelDeltaPp)} vs kỳ`,
        ],
        ["Δ RevPAR vs kỳ", formatDeltaRelPct(revparDeltaPct)],
        [
          "% doanh thu vùng",
          `${revenueSharePct.toFixed(1)}%`,
          `ngày ${dayShare.toFixed(1)}%`,
        ],
        ...topSegRows,
        [
          "Occupancy range",
          `${occMin.toFixed(0)}–${occMax.toFixed(0)}%`,
          `σ ${occSd.toFixed(1)} pp`,
        ],
      ]),
    ].join("");

    renderYearDropdownBreakdown(yearsEl, selected);

    card.hidden = false;
  }

  /** Drag-a-box-to-summarize on the "ADR × Occupancy (daily)" scatter — toggled via #btnAdrOccBoxSelect. */
  function initAdrOccBoxSelect() {
    const toggle = qs("#btnAdrOccBoxSelect");
    const hit = qs("#adrOccBoxHit");
    const rect = qs("#adrOccBoxRect");
    const clearBtn = qs("#adrOccBoxClear");
    if (!toggle || !hit || !rect) return;

    toggle.addEventListener("click", () => {
      state.adrOccBoxSelectEnabled = !state.adrOccBoxSelectEnabled;
      toggle.setAttribute("aria-pressed", String(state.adrOccBoxSelectEnabled));
      hit.classList.toggle("is-active", state.adrOccBoxSelectEnabled);
      if (!state.adrOccBoxSelectEnabled) clearAdrOccSelection();
    });

    clearBtn?.addEventListener("click", () => clearAdrOccSelection());

    let dragging = false;
    let originX = 0;
    let originY = 0;

    const setRect = (x0, y0, x1, y1) => {
      rect.hidden = false;
      rect.style.left = `${Math.min(x0, x1)}px`;
      rect.style.top = `${Math.min(y0, y1)}px`;
      rect.style.width = `${Math.abs(x1 - x0)}px`;
      rect.style.height = `${Math.abs(y1 - y0)}px`;
    };

    hit.addEventListener("pointerdown", (e) => {
      if (!state.adrOccBoxSelectEnabled) return;
      const box = hit.getBoundingClientRect();
      originX = e.clientX - box.left;
      originY = e.clientY - box.top;
      dragging = true;
      setRect(originX, originY, originX, originY);
      try {
        hit.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
      e.preventDefault();
    });

    hit.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const box = hit.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - box.left, box.width));
      const y = Math.max(0, Math.min(e.clientY - box.top, box.height));
      setRect(originX, originY, x, y);
    });

    const finishDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      const box = hit.getBoundingClientRect();
      const endX = Math.max(0, Math.min(e.clientX - box.left, box.width));
      const endY = Math.max(0, Math.min(e.clientY - box.top, box.height));

      if (Math.abs(endX - originX) < 6 && Math.abs(endY - originY) < 6) {
        rect.hidden = true;
        clearAdrOccSelection();
        return;
      }

      const chart = C().charts.adrOccScatter;
      if (!chart) return;
      const xMin = chart.scales.x.getValueForPixel(Math.min(originX, endX));
      const xMax = chart.scales.x.getValueForPixel(Math.max(originX, endX));
      // Screen Y grows downward, data Y grows upward, so the smaller pixel maps to the larger value.
      const yValueMax = chart.scales.y.getValueForPixel(Math.min(originY, endY));
      const yValueMin = chart.scales.y.getValueForPixel(Math.max(originY, endY));

      const points = state.adrOccPoints;
      const selectedIdx = new Set();
      const selected = [];
      points.forEach((p, i) => {
        if (p.x >= xMin && p.x <= xMax && p.y >= yValueMin && p.y <= yValueMax) {
          selectedIdx.add(i);
          selected.push(p);
        }
      });
      C().setScatterHighlight("adrOccScatter", selectedIdx);
      renderAdrOccCard(selected);
    };

    hit.addEventListener("pointerup", finishDrag);
    hit.addEventListener("pointercancel", () => {
      dragging = false;
    });
  }

  function fillSelect(id, values, allLabel) {
    const el = qs(id);
    if (!el) return;
    const current = el.value;
    const list = Array.isArray(values) ? values : [];
    el.replaceChildren();
    const all = document.createElement("option");
    all.value = "";
    all.textContent = allLabel;
    el.appendChild(all);
    list.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = String(v);
      opt.textContent = String(v);
      el.appendChild(opt);
    });
    if (current && list.map(String).includes(String(current))) el.value = current;
    else el.value = "";
    el.classList.toggle("has-value", !!el.value);
  }

  function distinctValues(rows, key) {
    return [
      ...new Set(
        (rows || [])
          .map((r) => r[key])
          .filter((v) => v != null && String(v).trim() !== "")
          .map(String)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }

  function buildDimDropdowns() {
    const S = D().STORE;
    const segments =
      distinctValues(S.bookingCube, "segment").length > 0
        ? distinctValues(S.bookingCube, "segment")
        : distinctValues(S.cancelSegment, "market_segment");
    const channels =
      distinctValues(S.bookingCube, "channel").length > 0
        ? distinctValues(S.bookingCube, "channel")
        : distinctValues(S.cancelChannel, "distribution_channel");
    const deposits =
      distinctValues(S.bookingCube, "deposit_type").length > 0
        ? distinctValues(S.bookingCube, "deposit_type")
        : distinctValues(S.cancelDeposit, "deposit_type");

    fillSelect("#filterSegment", segments, "All segments");
    fillSelect("#filterChannel", channels, "All channels");
    fillSelect("#filterDeposit", deposits, "All deposits");

    ["#filterSegment", "#filterChannel", "#filterDeposit"].forEach((sel) => {
      const el = qs(sel);
      if (!el || el.dataset.bound === "1") return;
      el.dataset.bound = "1";
      el.addEventListener("change", () => {
        el.classList.toggle("has-value", !!el.value);
        if (sel === "#filterSegment") {
          if (el.value) state.brush.segment = el.value;
          else delete state.brush.segment;
        }
        if (sel === "#filterChannel") {
          if (el.value) state.brush.channel = el.value;
          else delete state.brush.channel;
        }
        if (sel === "#filterDeposit") {
          if (el.value) state.brush.deposit_type = el.value;
          else delete state.brush.deposit_type;
        }
        renderActive();
      });
    });
  }

  function resetFilters() {
    qsa("#hotelChips input, #yearChips input").forEach((el) => {
      el.checked = true;
    });
    syncSelectValue("#filterSegment", "");
    syncSelectValue("#filterChannel", "");
    syncSelectValue("#filterDeposit", "");
    state.brush = {};
    resetMonthRange();
    renderActive();
  }

  function resetVisuals() {
    state.brush = {};
    if (window.HBDRange) window.HBDRange.resetAll();
    C().resetAll();
    renderActive();
  }

  function resetLevers() {
    qs("#levAdr").value = 5;
    qs("#levOcc").value = -2;
    qs("#levCancel").value = 0;
    qs("#levElasticity").checked = false;
    readLevers();
    if (state.view === "simulator") renderSimulator();
  }

  function downloadCsv() {
    const rows = state.lastSimRows;
    if (!rows.length) return;
    const cols = [
      "hotel",
      "year_month",
      "adr",
      "adr_sim",
      "occupancy_rate",
      "occ_sim",
      "revpar_base",
      "revpar_sim",
      "total_revenue",
      "revenue_sim",
    ];
    const lines = [cols.join(",")];
    rows.forEach((r) => {
      lines.push(cols.map((c) => r[c]).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scenario_revpar_monthly.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function init() {
    try {
      await D().loadAll();
    } catch (err) {
      document.querySelector(".main").innerHTML = `
        <div class="empty">
          <p>Không tải được dữ liệu JSON.</p>
          <p>Chạy local server từ thư mục <code>dashboard-html</code> (fetch không hoạt động với file://).</p>
          <pre>${String(err)}</pre>
        </div>`;
      return;
    }

    const meta = D().STORE.meta;
    state.hotels = [...meta.hotels];
    state.years = [...meta.years];
    state.allMonths = D().monthRange(meta.min_month, meta.max_month);
    state.months = state.allMonths;
    state.monthRange = { start: 0, end: Math.max(0, state.months.length - 1) };
    buildHotelChips(meta.hotels);
    buildYearChips(meta.years);
    initMonthRangeSlicer();
    initAdrOccBoxSelect();
    buildDimDropdowns();

    qsa(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => setView(btn.dataset.view));
    });

    qs("#btnResetFilters").addEventListener("click", resetFilters);
    qs("#btnResetVisuals").addEventListener("click", resetVisuals);
    qs("#btnClearBrush").addEventListener("click", clearBrush);
    qs("#btnResetLevers").addEventListener("click", resetLevers);
    qs("#btnDownloadCsv").addEventListener("click", downloadCsv);

    ["#levAdr", "#levOcc", "#levCancel", "#levElasticity"].forEach((sel) => {
      qs(sel).addEventListener("input", () => {
        if (state.view === "simulator") renderSimulator();
        else readLevers();
      });
    });

    qsa("[data-reset-chart]").forEach((btn) => {
      btn.addEventListener("click", () => C().resetZoom(btn.dataset.resetChart));
    });

    qsa("[data-reset-range]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (window.HBDRange) window.HBDRange.reset(btn.dataset.resetRange);
      });
    });

    const leadMode = qs("#leadChartMode");
    if (leadMode) {
      leadMode.addEventListener("click", (evt) => {
        const btn = evt.target.closest("[data-lead-mode]");
        if (!btn) return;
        const mode = btn.dataset.leadMode;
        if (!mode || mode === state.leadChartMode) return;
        state.leadChartMode = mode;
        syncLeadChartModeButtons();
        if (state.view === "cancellation") renderCancellation();
      });
      syncLeadChartModeButtons();
    }

    const ctMetric = qs("#customerTypeMetric");
    if (ctMetric) {
      ctMetric.addEventListener("click", (evt) => {
        const btn = evt.target.closest("[data-ct-metric]");
        if (!btn) return;
        const metric = btn.dataset.ctMetric;
        if (!metric || metric === state.customerTypeMetric) return;
        state.customerTypeMetric = metric;
        syncCustomerTypeMetricButtons();
        if (state.view === "overview") renderOverview();
      });
      syncCustomerTypeMetricButtons();
    }

    window.addEventListener("themechange", () => {
      // recreate charts so token colors refresh
      renderActive();
    });

    setView("overview");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
