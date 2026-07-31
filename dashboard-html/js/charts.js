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
    opts.onClick = (_evt, elements) => {
      if (!elements.length) {
        onSelect(null);
        return;
      }
      onSelect(labels[elements[0].index], elements[0].index);
    };
    opts.onHover = (evt, elements) => {
      evt.native.target.style.cursor = elements.length ? "pointer" : "default";
    };
    return opts;
  }

  function barColors(labels, baseColor, activeLabel, dimColor) {
    if (!activeLabel) return labels.map(() => baseColor);
    return labels.map((lab) => (lab === activeLabel ? baseColor : dimColor));
  }

  function dualAxisTrend(key, canvasId, labels, seriesA, seriesB, extra = {}) {
    const t = tokens();
    const opts = baseOptions();
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
    return upsert(key, canvasId, {
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
  }

  function multiLine(key, canvasId, labels, datasets, extra = {}) {
    const t = tokens();
    const palette = [t.primary, t.accent, t.noshow, t.primarySoft];
    const styles = ["solid", [5, 4], [2, 3], "solid"];
    const opts = baseOptions();
    attachClick(opts, labels, extra.onSelect);
    return upsert(key, canvasId, {
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
  }

  function doughnut(key, canvasId, labels, values, extra = {}) {
    const t = tokens();
    const bg = labels.map((lab) => {
      const c = statusColor(lab, t);
      if (extra.activeLabel && lab !== extra.activeLabel) return t.grid;
      return c;
    });
    const opts = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "58%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: t.mutedFg, usePointStyle: true, boxWidth: 10 },
        },
      },
    };
    attachClick(opts, labels, extra.onSelect);
    return upsert(key, canvasId, {
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
  }

  /** Format value axis ticks + tooltips as percent (data already on 0–100 scale). */
  function applyPercentAxis(opts, valueAxis, axisTitle) {
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
    opts.plugins.tooltip = opts.plugins.tooltip || {};
    opts.plugins.tooltip.callbacks = {
      ...(opts.plugins.tooltip.callbacks || {}),
      label(ctx) {
        const raw = valueAxis === "x" ? ctx.parsed.x : ctx.parsed.y;
        const n = Number(raw);
        const prefix = ctx.dataset.label ? `${ctx.dataset.label}: ` : "Cancel rate: ";
        return `${prefix}${Number.isFinite(n) ? n.toFixed(1) : raw}%`;
      },
    };
  }

  function hbar(key, canvasId, labels, values, color, extra = {}) {
    const t = tokens();
    const opts = baseOptions();
    opts.indexAxis = "y";
    opts.plugins.legend.display = false;
    opts.interaction = { mode: "nearest", intersect: true };
    if (extra.asPercent) applyPercentAxis(opts, "x", extra.axisTitle);
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
    if (extra.asPercent) applyPercentAxis(opts, "y", extra.axisTitle);
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
    applyPercentAxis(opts, "y", extra.axisTitle || "Cancel %");
    opts.scales.y.beginAtZero = true;
    opts.scales.y.suggestedMax = 100;
    attachClick(opts, labels, extra.onSelect);

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
            label: "Cancel %",
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
    barsSigned,
    sensitivity,
  };
})();
