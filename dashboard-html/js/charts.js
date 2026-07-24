(function () {
  const charts = {};

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

  function hbar(key, canvasId, labels, values, color, extra = {}) {
    const t = tokens();
    const opts = baseOptions();
    opts.indexAxis = "y";
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
    barsSigned,
    sensitivity,
  };
})();
