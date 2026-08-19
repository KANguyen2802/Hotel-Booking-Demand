(function () {
  const charts = {};

  function registerBoxplotPlugin() {
    const P = window.ChartBoxPlot;
    if (!P || !window.Chart || registerBoxplotPlugin.done) return;
    const regs = [
      P.BoxPlotController,
      P.BoxAndWiskers,
      P.ViolinController,
      P.Violin,
    ].filter(Boolean);
    if (regs.length) {
      window.Chart.register(...regs);
      registerBoxplotPlugin.done = true;
    }
  }
  registerBoxplotPlugin();

  function tokens() {
    const s = getComputedStyle(document.documentElement);
    const g = (name) => s.getPropertyValue(name).trim();
    return {
      primary: g("--color-primary"),
      primarySoft: g("--color-primary-soft"),
      accent: g("--color-accent"),
      accentSoft: g("--color-accent-soft"),
      fg: g("--color-foreground"),
      mutedFg: g("--color-muted-fg"),
      grid: g("--color-grid"),
      fill: g("--color-fill"),
      fillAccent: g("--color-fill-accent"),
      card: g("--color-card"),
      destructive: g("--color-destructive"),
      positive: g("--color-positive"),
      noshow: g("--color-noshow"),
    };
  }

  function toRgb(css) {
    const s = String(css || "").trim();
    if (s.startsWith("#")) {
      const hex =
        s.length === 4 ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}` : s;
      return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ];
    }
    const m = s.match(/-?\d+(\.\d+)?/g);
    return m && m.length >= 3 ? m.slice(0, 3).map(Number) : [0, 0, 0];
  }

  function luminance(rgb) {
    const [r, g, b] = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrastRatio(a, b) {
    const la = luminance(toRgb(a));
    const lb = luminance(toRgb(b));
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /**
   * Keep a hue recognizable as text while meeting WCAG AA (4.5:1) on `bg`.
   * Blends toward `fg` in small steps — soft tints (#14B8A6, #C47A46) only reach
   * ~2.8-3.4:1 on a white card, so using the raw slice color would fail.
   */
  function readableOn(color, bg, fg, min = 4.5) {
    if (contrastRatio(color, bg) >= min) return color;
    const c = toRgb(color);
    const f = toRgb(fg);
    for (let step = 0.1; step <= 1.0001; step += 0.1) {
      const mixed = c.map((v, i) => Math.round(v + (f[i] - v) * step));
      const css = `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
      if (contrastRatio(css, bg) >= min) return css;
    }
    return fg;
  }

  function statusColor(status, t) {
    if (status === "Check-Out") return t.primary;
    if (status === "Canceled") return t.accent;
    if (status === "No-Show") return t.noshow;
    return t.mutedFg;
  }

  function baseOptions() {
    const t = tokens();
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: { color: t.mutedFg, boxWidth: 12, usePointStyle: true },
        },
        tooltip: {
          backgroundColor: t.card,
          titleColor: t.fg,
          bodyColor: t.fg,
          borderColor: t.grid,
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          ticks: { color: t.mutedFg, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
          grid: { color: t.grid },
          border: { color: t.grid },
        },
        y: {
          ticks: { color: t.mutedFg },
          grid: { color: t.grid },
          border: { color: t.grid },
        },
      },
    };
  }

  function destroy(key) {
    if (charts[key]) {
      charts[key].destroy();
      delete charts[key];
    }
  }

  function upsert(key, canvasId, config) {
    destroy(key);
    const el = document.getElementById(canvasId);
    if (!el) return null;
    charts[key] = new Chart(el, config);
    return charts[key];
  }

  function resetZoom(key) {
    const c = charts[key];
    if (!c) return;
    if (typeof c.resetZoom === "function") {
      c.resetZoom();
      return;
    }
    Object.values(c.scales || {}).forEach((scale) => {
      scale.options.min = undefined;
      scale.options.max = undefined;
    });
    c.update("none");
  }

  function resetAll() {
    Object.keys(charts).forEach(resetZoom);
  }

  function attachClick(opts, labels, onSelect) {
    if (!onSelect) return opts;
    opts.onClick = (evt, elements, chart) => {
      // Legend shares the canvas: empty hit must not clear brush / re-render,
      // or it cancels Chart.js legend toggle and breaks legend select.
      if (isLegendHit(evt, chart) || !elements.length) return;
      onSelect(labels[elements[0].index], elements[0].index);
    };
    opts.onHover = (evt, elements, chart) => {
      const target = evt.native && evt.native.target;
      if (!target) return;
      target.style.cursor =
        elements.length || isLegendHit(evt, chart) ? "pointer" : "default";
    };
    return opts;
  }

  /** True when the pointer is over a Chart.js legend hitbox. */
  function isLegendHit(evt, chart) {
    const legend = chart && chart.legend;
    if (!legend || !legend.legendHitBoxes || !legend.legendHitBoxes.length) return false;
    const pos = typeof evt === "object" && typeof evt.x === "number"
      ? { x: evt.x, y: evt.y }
      : null;
    if (!pos) return false;
    return legend.legendHitBoxes.some(
      (box) =>
        pos.x >= box.left &&
        pos.x <= box.left + box.width &&
        pos.y >= box.top &&
        pos.y <= box.top + box.height
    );
  }

  /**
   * Legend click = brush/select (same as channel donut), not Chart.js hide/show.
   * `resolveLabel(legendItem, chart)` returns the value passed to onSelect.
   */
  function attachLegendSelect(opts, onSelect, resolveLabel) {
    if (!onSelect || typeof resolveLabel !== "function") return opts;
    opts.plugins = opts.plugins || {};
    opts.plugins.legend = {
      ...(opts.plugins.legend || {}),
      onClick(evt, legendItem, legend) {
        const chart = (legend && legend.chart) || (this && this.chart);
        if (!chart) return;
        const lab = resolveLabel(legendItem, chart);
        if (lab == null || lab === "") return;
        onSelect(lab);
      },
    };
    return opts;
  }

  /**
   * Legend click isolates one series: show only that dataset; click again to show all.
   * (Better than default toggle when comparing 2+ series.)
   */
  function attachLegendIsolate(opts) {
    opts.plugins = opts.plugins || {};
    opts.plugins.legend = {
      ...(opts.plugins.legend || {}),
      onClick(_evt, legendItem, legend) {
        const chart = (legend && legend.chart) || (this && this.chart);
        if (!chart) return;
        const idx =
          legendItem.datasetIndex != null ? legendItem.datasetIndex : legendItem.index;
        if (idx == null || idx < 0) return;
        isolateDataset(chart, idx);
      },
    };
    return opts;
  }

  function isolateDataset(chart, index) {
    const n = chart.data.datasets.length;
    if (!n) return;
    let visibleCount = 0;
    let onlyIndex = -1;
    for (let i = 0; i < n; i++) {
      const visible = chart.getDatasetMeta(i).hidden !== true;
      if (visible) {
        visibleCount += 1;
        onlyIndex = i;
      }
    }
    const alreadySolo = visibleCount === 1 && onlyIndex === index;
    for (let i = 0; i < n; i++) {
      chart.setDatasetVisibility(i, alreadySolo ? true : i === index);
    }
    chart.update();
  }

  function barColors(labels, baseColor, activeLabel, dimColor) {
    if (!activeLabel) return labels.map(() => baseColor);
    return labels.map((lab) => (lab === activeLabel ? baseColor : dimColor));
  }

  function dualAxisTrend(key, canvasId, labels, seriesA, seriesB, extra = {}) {
    const t = tokens();
    const opts = baseOptions();
    opts.plugins.legend.display = false;
    opts.scales.y.title = { display: true, text: seriesA.label, color: t.mutedFg };
    opts.scales.y2 = {
      position: "right",
      ticks: { color: t.mutedFg },
      grid: { drawOnChartArea: false },
      border: { color: t.grid },
      title: { display: true, text: seriesB.label, color: t.mutedFg },
    };
    attachClick(opts, labels, extra.onSelect);
    const pointR = labels.map((lab) => (extra.activeLabel && lab === extra.activeLabel ? 5 : 2));
    const chart = upsert(key, canvasId, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: seriesA.label,
            data: seriesA.data,
            borderColor: seriesA.color || t.primary,
            backgroundColor: t.fill,
            fill: true,
            tension: 0.25,
            pointRadius: pointR,
            borderWidth: 2.2,
            yAxisID: "y",
          },
          {
            label: seriesB.label,
            data: seriesB.data,
            borderColor: seriesB.color || t.accent,
            backgroundColor: "transparent",
            fill: false,
            tension: 0.25,
            pointRadius: pointR,
            borderWidth: 2,
            borderDash: [5, 4],
            yAxisID: "y2",
          },
        ],
      },
      options: opts,
    });
    if (extra.externalLegendId) bindExternalSeriesLegend(chart, extra.externalLegendId);
    return chart;
  }

  function multiLine(key, canvasId, labels, datasets, extra = {}) {
    const t = tokens();
    const palette = [t.primary, t.accent, t.noshow, t.primarySoft];
    const styles = ["solid", [5, 4], [2, 3], "solid"];
    const opts = baseOptions();
    opts.plugins.legend.display = false;
    attachClick(opts, labels, extra.onSelect);
    const chart = upsert(key, canvasId, {
      type: "line",
      data: {
        labels,
        datasets: datasets.map((d, i) => {
          const color = d.color || palette[i % palette.length];
          const dash =
            d.borderDash != null
              ? d.borderDash
              : styles[i % styles.length] === "solid"
                ? []
                : styles[i % styles.length];
          return {
            label: d.label,
            data: d.data,
            borderColor: color,
            backgroundColor: "transparent",
            borderWidth: 2.2,
            tension: 0.25,
            pointRadius: labels.map((lab) =>
              extra.activeLabel && lab === extra.activeLabel ? 5 : 3
            ),
            pointBackgroundColor: color,
            borderDash: dash,
          };
        }),
      },
      options: opts,
    });
    if (!extra.hideLegend && extra.externalLegendId) {
      bindExternalSeriesLegend(chart, extra.externalLegendId);
    } else if (extra.externalLegendId) {
      const el = document.getElementById(extra.externalLegendId);
      if (el) el.innerHTML = "";
    }
    return chart;
  }

  /** Categorical palette for non-status slices; distinct hues, WCAG-safe on card bg. */
  function categoryPalette(t) {
    // Hue then lightness alternation keeps adjacent slices separable in mono/CVD view.
    return [t.primary, t.accent, t.noshow, t.primarySoft, t.accentSoft, t.mutedFg];
  }

  function doughnut(key, canvasId, labels, values, extra = {}) {
    const t = tokens();
    const palette = extra.palette ? categoryPalette(t) : null;
    const sliceColors = labels.map((lab, i) =>
      palette ? palette[i % palette.length] : statusColor(lab, t)
    );
    const dimmed = (lab) => extra.activeLabel && lab !== extra.activeLabel;
    const bg = labels.map((lab, i) => (dimmed(lab) ? t.grid : sliceColors[i]));
    const legendTextColor = labels.map((lab, i) =>
      dimmed(lab) ? t.mutedFg : readableOn(sliceColors[i], t.card, t.fg)
    );
    const total = values.reduce((s, v) => s + (Number(v) || 0), 0);
    const share = (v) => (total ? ((Number(v) || 0) / total) * 100 : 0);
    const externalLegendId = extra.externalLegendId || null;
    const legendPos = extra.legendPosition || "bottom";
    const legendLeft = legendPos === "left" || legendPos === "right";
    const opts = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "58%",
      layout: legendLeft && !externalLegendId
        ? { padding: { left: 4, right: 8, top: 4, bottom: 4 } }
        : { padding: 0 },
      plugins: {
        legend: externalLegendId
          ? { display: false }
          : {
              position: legendPos,
              align: legendLeft ? "start" : "center",
              rtl: false,
              labels: {
                color: t.mutedFg,
                usePointStyle: true,
                boxWidth: 10,
                padding: legendLeft ? 14 : 10,
                ...(legendLeft ? { textAlign: "left" } : {}),
                generateLabels(chart) {
                  const ds = chart.data.datasets[0] || {};
                  return chart.data.labels.map((lab, i) => ({
                    text: `${lab} · ${share(ds.data[i]).toFixed(1)}%`,
                    fillStyle: (ds.backgroundColor || [])[i],
                    strokeStyle: (ds.backgroundColor || [])[i],
                    fontColor: legendTextColor[i],
                    pointStyle: "circle",
                    hidden: !chart.getDataVisibility(i),
                    index: i,
                  }));
                },
              },
            },
        tooltip: {
          backgroundColor: t.card,
          titleColor: t.fg,
          bodyColor: t.fg,
          borderColor: t.grid,
          borderWidth: 1,
          callbacks: {
            label(ctx) {
              const v = Number(ctx.parsed) || 0;
              const money = extra.valuePrefix || "";
              const formatted = extra.compact
                ? `${money}${Math.round(v).toLocaleString("en-US")}`
                : `${money}${v.toLocaleString("en-US")}`;
              return `${ctx.label}: ${formatted} (${share(v).toFixed(1)}%)`;
            },
          },
        },
      },
    };
    attachClick(opts, labels, extra.onSelect);
    if (!externalLegendId && extra.onSelect) {
      attachLegendSelect(opts, extra.onSelect, (item) => labels[item.index]);
    }
    const chart = upsert(key, canvasId, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: bg,
            borderColor: t.card,
            borderWidth: 2,
          },
        ],
      },
      options: opts,
    });

    if (externalLegendId) {
      renderExternalLegend(externalLegendId, {
        labels,
        colors: sliceColors,
        dimmedColors: bg,
        textColors: legendTextColor,
        shares: values.map((v) => share(v)),
        activeLabel: extra.activeLabel || null,
        onSelect: extra.onSelect,
      });
    }
    return chart;
  }

  /**
   * Vertical HTML legend under a chart (left-aligned) — shared style for donut + series.
   * Pass `shares` for "Label · n%" (donut); omit for plain series labels.
   */
  function renderExternalLegend(containerId, cfg) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const {
      labels = [],
      colors = [],
      dimmedColors = [],
      textColors = [],
      shares = null,
      activeLabel = null,
      onSelect,
    } = cfg;
    const showShares = Array.isArray(shares);
    el.innerHTML = labels
      .map((lab, i) => {
        const dimmed = activeLabel && lab !== activeLabel;
        const swatch = dimmed ? dimmedColors[i] || colors[i] : colors[i];
        const textColor = textColors[i] || "inherit";
        const text = showShares && Number.isFinite(shares[i])
          ? `${lab} · ${shares[i].toFixed(1)}%`
          : String(lab);
        return `<li>
          <button type="button" class="chart-legend-item${dimmed ? " is-dimmed" : ""}${activeLabel === lab ? " is-active" : ""}" data-label="${String(lab).replace(/"/g, "&quot;")}" aria-pressed="${activeLabel === lab ? "true" : "false"}">
            <span class="chart-legend-swatch" style="background:${swatch}" aria-hidden="true"></span>
            <span class="chart-legend-text" style="color:${textColor}">${text}</span>
          </button>
        </li>`;
      })
      .join("");
    el._onSelect = onSelect;
    if (el.dataset.bound !== "1") {
      el.dataset.bound = "1";
      el.addEventListener("click", (evt) => {
        const btn = evt.target.closest("[data-label]");
        if (!btn || typeof el._onSelect !== "function") return;
        el._onSelect(btn.dataset.label);
      });
    }
  }

  /** HTML series legend (donut style) + isolate-on-click. */
  function bindExternalSeriesLegend(chart, containerId) {
    if (!chart || !containerId) return;
    const t = tokens();
    const labels = chart.data.datasets.map((d) => d.label);
    const colors = chart.data.datasets.map((d) => {
      const c = d.borderColor || d.backgroundColor || t.primary;
      return Array.isArray(c) ? c[0] : c;
    });

    function soloLabel() {
      let visibleCount = 0;
      let onlyIndex = -1;
      for (let i = 0; i < labels.length; i++) {
        if (chart.getDatasetMeta(i).hidden !== true) {
          visibleCount += 1;
          onlyIndex = i;
        }
      }
      return visibleCount === 1 ? labels[onlyIndex] : null;
    }

    function paint() {
      const active = soloLabel();
      renderExternalLegend(containerId, {
        labels,
        colors,
        dimmedColors: colors.map(() => t.grid),
        textColors: labels.map((lab, i) =>
          active && lab !== active ? t.mutedFg : readableOn(colors[i], t.card, t.fg)
        ),
        activeLabel: active,
        onSelect: (lab) => {
          const idx = labels.indexOf(lab);
          if (idx < 0) return;
          isolateDataset(chart, idx);
          paint();
        },
      });
    }
    paint();
  }

  /** Format value axis ticks + tooltips as percent (data already on 0–100 scale). */
  /** `extra.counts`, when provided, adds a "Bookings: N" line aligned by data index. */
  function applyPercentAxis(opts, valueAxis, axisTitle, extra = {}) {
    const t = tokens();
    const axis = opts.scales[valueAxis];
    axis.ticks = {
      ...axis.ticks,
      callback: (v) => `${v}%`,
    };
    axis.title = {
      display: true,
      text: axisTitle || "Cancel %",
      color: t.mutedFg,
    };
    const counts = extra.counts;
    opts.plugins.tooltip = opts.plugins.tooltip || {};
    opts.plugins.tooltip.callbacks = {
      ...(opts.plugins.tooltip.callbacks || {}),
      label(ctx) {
        const raw = valueAxis === "x" ? ctx.parsed.x : ctx.parsed.y;
        const n = Number(raw);
        const prefix = ctx.dataset.label ? `${ctx.dataset.label}: ` : "Cancel rate: ";
        const line = `${prefix}${Number.isFinite(n) ? n.toFixed(1) : raw}%`;
        const count = counts && counts[ctx.dataIndex];
        return count != null
          ? [line, `Bookings: ${Number(count).toLocaleString("en-US")}`]
          : line;
      },
    };
  }

  function hbar(key, canvasId, labels, values, color, extra = {}) {
    const t = tokens();
    const opts = baseOptions();
    opts.indexAxis = "y";
    opts.plugins.legend.display = false;
    opts.interaction = { mode: "nearest", intersect: true };
    if (extra.asPercent) applyPercentAxis(opts, "x", extra.axisTitle, extra);
    attachClick(opts, labels, extra.onSelect);
    return upsert(key, canvasId, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: barColors(labels, color || t.primary, extra.activeLabel, t.grid),
            borderRadius: 6,
            maxBarThickness: 22,
          },
        ],
      },
      options: opts,
    });
  }

  function vbar(key, canvasId, labels, values, color, extra = {}) {
    const t = tokens();
    const opts = baseOptions();
    opts.plugins.legend.display = false;
    opts.interaction = { mode: "nearest", intersect: true };
    if (extra.asPercent) applyPercentAxis(opts, "y", extra.axisTitle, extra);
    attachClick(opts, labels, extra.onSelect);
    return upsert(key, canvasId, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: barColors(labels, color || t.primary, extra.activeLabel, t.grid),
            borderRadius: 6,
            maxBarThickness: 36,
          },
        ],
      },
      options: opts,
    });
  }

  function withAlpha(hexOrCss, alpha) {
    const s = String(hexOrCss || "").trim();
    if (s.startsWith("#") && (s.length === 7 || s.length === 4)) {
      const hex =
        s.length === 4
          ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`
          : s;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return s;
  }

  /** Boxplot or violin; `samples` is array-of-arrays of percent values. */
  function distribution(key, canvasId, type, labels, samples, color, extra = {}) {
    registerBoxplotPlugin();
    const t = tokens();
    const chartType = type === "violin" ? "violin" : "boxplot";
    const hasType =
      window.Chart &&
      window.Chart.registry &&
      typeof window.Chart.registry.getController === "function" &&
      window.Chart.registry.getController(chartType);
    if (!hasType) {
      console.warn(`Chart type "${chartType}" unavailable; falling back to empty chart.`);
      return upsert(key, canvasId, {
        type: "bar",
        data: { labels, datasets: [{ data: labels.map(() => 0) }] },
        options: baseOptions(),
      });
    }
    const opts = baseOptions();
    opts.plugins.legend.display = false;
    opts.interaction = { mode: "nearest", intersect: true };
    if (extra.asPercent) {
      applyPercentAxis(opts, "y", extra.axisTitle || "Cancel %");
      opts.scales.y.suggestedMax = extra.ySuggestedMax != null ? extra.ySuggestedMax : 100;
    } else {
      opts.scales.y.title = {
        display: true,
        text: extra.axisTitle || "Value",
        color: t.mutedFg,
      };
      if (extra.ySuggestedMax != null) opts.scales.y.suggestedMax = extra.ySuggestedMax;
    }
    opts.scales.y.beginAtZero = extra.beginAtZero !== false;
    attachClick(opts, labels, extra.onSelect);

    if (extra.stats) {
      const unit = extra.asPercent ? "%" : "";
      const fmt = (v) => (v == null ? "–" : `${v.toFixed(1)}${unit}`);
      opts.plugins.tooltip = opts.plugins.tooltip || {};
      opts.plugins.tooltip.callbacks = {
        ...(opts.plugins.tooltip.callbacks || {}),
        title: (items) => items[0]?.label ?? "",
        label(ctx) {
          const s = extra.stats[ctx.dataIndex];
          if (!s) return "";
          return [
            `n = ${s.n}`,
            `Min: ${fmt(s.min)}`,
            `Q1: ${fmt(s.q1)}`,
            `Median: ${fmt(s.median)}`,
            `Q3: ${fmt(s.q3)}`,
            `Max: ${fmt(s.max)}`,
            `Mean: ${fmt(s.mean)}`,
          ];
        },
      };
    }

    const active = color || t.primary;
    const dim = t.grid;
    const bg = labels.map((lab) =>
      withAlpha(extra.activeLabel && lab !== extra.activeLabel ? dim : active, 0.28)
    );
    const borders = labels.map((lab) =>
      extra.activeLabel && lab !== extra.activeLabel ? dim : active
    );

    return upsert(key, canvasId, {
      type: chartType,
      data: {
        labels,
        datasets: [
          {
            label: extra.datasetLabel || "Cancel %",
            data: samples,
            backgroundColor: bg,
            borderColor: borders,
            borderWidth: 1.5,
            outlierBackgroundColor: t.accent,
            outlierBorderColor: t.accent,
            medianColor: t.accent,
            itemRadius: 0,
          },
        ],
      },
      options: opts,
    });
  }

  function boxplot(key, canvasId, labels, samples, color, extra = {}) {
    return distribution(key, canvasId, "boxplot", labels, samples, color, extra);
  }

  function violin(key, canvasId, labels, samples, color, extra = {}) {
    return distribution(key, canvasId, "violin", labels, samples, color, extra);
  }

  /** Floating-bar waterfall. steps: [{label, value, type:'total'|'delta'}] */
  function waterfall(key, canvasId, steps, extra = {}) {
    const t = tokens();
    if (!steps || !steps.length) {
      return upsert(key, canvasId, {
        type: "bar",
        data: { labels: [], datasets: [] },
        options: baseOptions(),
      });
    }
    const labels = steps.map((s) => s.label);
    const base = [];
    const delta = [];
    const colors = [];
    let running = 0;
    steps.forEach((s) => {
      const v = Number(s.value) || 0;
      if (s.type === "total") {
        base.push(0);
        delta.push(v);
        running = v;
        colors.push(s.color || t.primary);
      } else {
        const start = running;
        const end = running + v;
        base.push(Math.min(start, end));
        delta.push(Math.abs(v));
        running = end;
        colors.push(s.color || (v >= 0 ? t.positive : t.destructive));
      }
    });
    const opts = baseOptions();
    opts.plugins.legend.display = false;
    opts.scales.y.beginAtZero = true;
    opts.scales.y.title = {
      display: true,
      text: extra.axisTitle || "RevPAR (€)",
      color: t.mutedFg,
    };
    opts.plugins.tooltip.callbacks = {
      label(ctx) {
        if (ctx.datasetIndex !== 1) return null;
        const step = steps[ctx.dataIndex];
        const v = Number(step?.value) || 0;
        const sign = step?.type === "delta" && v >= 0 ? "+" : "";
        return `${step?.label}: ${sign}${v.toFixed(2)}`;
      },
    };
    return upsert(key, canvasId, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            data: base,
            backgroundColor: "transparent",
            borderWidth: 0,
            stack: "wf",
            barPercentage: 0.65,
          },
          {
            data: delta,
            backgroundColor: colors,
            borderRadius: 5,
            stack: "wf",
            barPercentage: 0.65,
          },
        ],
      },
      options: opts,
    });
  }

  /** Scatter with heat color by z (RevPAR). points: [{x,y,z,label?}] */
  function scatterHeat(key, canvasId, points, extra = {}) {
    const t = tokens();
    const zs = points.map((p) => p.z).filter((z) => Number.isFinite(z));
    const zMin = zs.length ? Math.min(...zs) : 0;
    const zMax = zs.length ? Math.max(...zs) : 1;
    const span = Math.max(zMax - zMin, 1e-6);
    const hex = (h) => {
      const n = String(h).replace("#", "");
      return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
    };
    const [r1, g1, b1] = hex(t.primary);
    const [r2, g2, b2] = hex(t.accent);
    const colorAt = (z) => {
      const a = (z - zMin) / span;
      const r = Math.round(r1 + (r2 - r1) * a);
      const g = Math.round(g1 + (g2 - g1) * a);
      const b = Math.round(b1 + (b2 - b1) * a);
      return `rgba(${r}, ${g}, ${b}, 0.72)`;
    };
    const opts = baseOptions();
    opts.plugins.legend.display = false;
    opts.scales.x.title = { display: true, text: extra.xTitle || "ADR (€)", color: t.mutedFg };
    opts.scales.y.title = {
      display: true,
      text: extra.yTitle || "Occupancy %",
      color: t.mutedFg,
    };
    opts.scales.x.beginAtZero = false;
    opts.scales.y.beginAtZero = true;
    opts.plugins.tooltip.callbacks = {
      label(ctx) {
        const p = points[ctx.dataIndex];
        if (!p) return "";
        return `${p.label || "Day"} · ADR €${p.x.toFixed(1)} · Occ ${p.y.toFixed(1)}% · RevPAR €${p.z.toFixed(1)}`;
      },
    };
    const baseColors = points.map((p) => colorAt(p.z));
    const chart = upsert(key, canvasId, {
      type: "scatter",
      data: {
        datasets: [
          {
            data: points.map((p) => ({ x: p.x, y: p.y })),
            backgroundColor: [...baseColors],
            borderColor: [...baseColors],
            pointRadius: 3.5,
            pointHoverRadius: 5,
          },
        ],
      },
      options: opts,
    });
    if (chart) {
      chart._scatterPoints = points;
      chart._scatterBaseColors = baseColors;
    }
    return chart;
  }

  /** Dim every scatter point outside `selectedIndexSet`; pass a falsy/empty set to restore all colors. */
  function setScatterHighlight(key, selectedIndexSet) {
    const chart = charts[key];
    if (!chart || !chart._scatterBaseColors) return;
    const t = tokens();
    const base = chart._scatterBaseColors;
    const ds = chart.data.datasets[0];
    if (!ds) return;
    if (!selectedIndexSet || !selectedIndexSet.size) {
      ds.backgroundColor = [...base];
      ds.borderColor = [...base];
    } else {
      const dimmed = base.map((c, i) => (selectedIndexSet.has(i) ? c : t.grid));
      ds.backgroundColor = dimmed;
      ds.borderColor = dimmed;
    }
    chart.update("none");
  }

  /** Funnel as horizontal bars (stage values descending). */
  function funnel(key, canvasId, labels, values, extra = {}) {
    const t = tokens();
    const opts = baseOptions();
    opts.indexAxis = "y";
    opts.plugins.legend.display = false;
    opts.scales.x.beginAtZero = true;
    opts.scales.x.title = {
      display: true,
      text: extra.axisTitle || "Bookings",
      color: t.mutedFg,
    };
    const max = Math.max(...values.map(Number), 1);
    opts.plugins.tooltip.callbacks = {
      label(ctx) {
        const v = Number(ctx.parsed.x) || 0;
        const pct = ((v / max) * 100).toFixed(1);
        return `${ctx.label}: ${v.toLocaleString("en-US")} (${pct}% of bookings)`;
      },
    };
    const palette = [t.primary, t.accent, t.primarySoft, t.noshow];
    return upsert(key, canvasId, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: labels.map((_, i) => palette[i % palette.length]),
            borderRadius: 6,
            maxBarThickness: 36,
          },
        ],
      },
      options: opts,
    });
  }

  /** Grouped vertical bars — datasets: [{label, data, color}] */
  function groupedVbar(key, canvasId, labels, datasets, extra = {}) {
    const t = tokens();
    const opts = baseOptions();
    opts.plugins.legend.display = false;
    opts.scales.y.beginAtZero = true;
    opts.scales.y.title = {
      display: true,
      text: extra.axisTitle || "RevPAR (€)",
      color: t.mutedFg,
    };
    const chart = upsert(key, canvasId, {
      type: "bar",
      data: {
        labels,
        datasets: datasets.map((d) => ({
          label: d.label,
          data: d.data,
          backgroundColor: d.color || t.primary,
          borderRadius: 5,
          maxBarThickness: 28,
        })),
      },
      options: opts,
    });
    if (extra.externalLegendId) bindExternalSeriesLegend(chart, extra.externalLegendId);
    return chart;
  }

  function barsSigned(key, canvasId, labels, values, extra = {}) {
    const t = tokens();
    const opts = baseOptions();
    opts.plugins.legend.display = false;
    opts.interaction = { mode: "nearest", intersect: true };
    attachClick(opts, labels, extra.onSelect);
    return upsert(key, canvasId, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: values.map((v, i) => {
              const base = v >= 0 ? t.primary : t.accent;
              if (extra.activeLabel && labels[i] !== extra.activeLabel) return t.grid;
              return base;
            }),
            borderRadius: 4,
            maxBarThickness: 18,
          },
        ],
      },
      options: opts,
    });
  }

  function sensitivity(key, canvasId, labels, values, extra = {}) {
    const t = tokens();
    const opts = baseOptions();
    opts.plugins.legend.display = false;
    opts.interaction = { mode: "nearest", intersect: true };
    attachClick(opts, labels, extra.onSelect);
    const colors = [t.mutedFg, t.primary, t.primarySoft, t.accent];
    return upsert(key, canvasId, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: labels.map((lab, i) => {
              const c = colors[i % colors.length];
              if (extra.activeLabel && lab !== extra.activeLabel) return t.grid;
              return c;
            }),
            borderRadius: 6,
            maxBarThickness: 48,
          },
        ],
      },
      options: opts,
    });
  }

  window.HBDCharts = {
    charts,
    tokens,
    statusColor,
    destroy,
    upsert,
    resetZoom,
    resetAll,
    dualAxisTrend,
    multiLine,
    doughnut,
    hbar,
    vbar,
    boxplot,
    violin,
    waterfall,
    scatterHeat,
    setScatterHighlight,
    funnel,
    groupedVbar,
    barsSigned,
    sensitivity,
  };
})();
