(function () {
  const state = new Map();

  function tokens() {
    return window.HBDCharts.tokens();
  }

  function ensure(key, n) {
    let s = state.get(key);
    if (!s || s.n !== n) {
      s = { start: 0, end: Math.max(0, n - 1), n, onChange: null, labels: [] };
      state.set(key, s);
    } else {
      s.start = Math.max(0, Math.min(s.start, n - 1));
      s.end = Math.max(s.start, Math.min(s.end, n - 1));
      s.n = n;
    }
    return s;
  }

  function syncWindow(key) {
    const s = state.get(key);
    const win = document.getElementById(`rangeWindow-${key}`);
    if (!s || !win || s.n <= 1) {
      if (win) {
        win.style.left = "0%";
        win.style.width = "100%";
      }
      return;
    }
    const left = (s.start / (s.n - 1)) * 100;
    const right = (s.end / (s.n - 1)) * 100;
    win.style.left = `${left}%`;
    win.style.width = `${Math.max(right - left, 1.5)}%`;
  }

  function updateLabel(key) {
    const s = state.get(key);
    const labelEl = document.getElementById(`rangeLabel-${key}`);
    if (!labelEl || !s || !s.labels.length) return;
    labelEl.textContent = `${s.labels[s.start]} → ${s.labels[s.end]}`;
  }

  function bindWindow(key) {
    const track = document.getElementById(`rangeTrack-${key}`);
    const win = document.getElementById(`rangeWindow-${key}`);
    if (!track || !win || win.dataset.bound === "1") return;
    win.dataset.bound = "1";

    let mode = null;
    let originX = 0;
    let originStart = 0;
    let originEnd = 0;

    function onDown(e, m) {
      const s = state.get(key);
      if (!s) return;
      mode = m;
      originX = e.clientX;
      originStart = s.start;
      originEnd = s.end;
      win.classList.add("is-dragging");
      try {
        win.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
      e.preventDefault();
      e.stopPropagation();
    }

    win.querySelector(".range-handle-l")?.addEventListener("pointerdown", (e) => onDown(e, "left"));
    win.querySelector(".range-handle-r")?.addEventListener("pointerdown", (e) => onDown(e, "right"));
    win.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".range-handle")) return;
      onDown(e, "move");
    });

    const onMove = (e) => {
      if (!mode) return;
      const s = state.get(key);
      if (!s || s.n <= 1) return;
      const rect = track.getBoundingClientRect();
      const dx = e.clientX - originX;
      const dIdx = Math.round((dx / Math.max(rect.width, 1)) * (s.n - 1));
      const minSpan = Math.min(2, Math.max(1, s.n - 1));

      if (mode === "move") {
        const span = originEnd - originStart;
        let ns = originStart + dIdx;
        let ne = ns + span;
        if (ns < 0) {
          ne -= ns;
          ns = 0;
        }
        if (ne > s.n - 1) {
          ns -= ne - (s.n - 1);
          ne = s.n - 1;
        }
        s.start = Math.max(0, ns);
        s.end = Math.min(s.n - 1, Math.max(s.start, ne));
      } else if (mode === "left") {
        s.start = Math.max(0, Math.min(originStart + dIdx, originEnd - minSpan));
      } else if (mode === "right") {
        s.end = Math.min(s.n - 1, Math.max(originEnd + dIdx, originStart + minSpan));
      }
      syncWindow(key);
      updateLabel(key);
      if (typeof s.onChange === "function") s.onChange();
    };

    const onUp = () => {
      if (!mode) return;
      mode = null;
      win.classList.remove("is-dragging");
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function miniOpts() {
    const t = tokens();
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          ticks: { display: false },
          grid: { display: false },
          border: { display: false },
        },
        y: {
          ticks: { display: false },
          grid: { color: t.grid, lineWidth: 0.5 },
          border: { display: false },
        },
      },
    };
  }

  function render(cfg) {
    const C = window.HBDCharts;
    const { key, detailId, miniId, mode, labels } = cfg;
    const n = labels.length || 0;
    const s = ensure(key, n);
    s.labels = labels;
    const t = tokens();

    const redrawDetail = () => {
      const cur = state.get(key);
      const lo = cur.start;
      const hi = cur.end;
      if (!n) return;
      if (mode === "dual") {
        C.dualAxisTrend(
          key,
          detailId,
          labels.slice(lo, hi + 1),
          { ...cfg.seriesA, data: cfg.seriesA.data.slice(lo, hi + 1) },
          { ...cfg.seriesB, data: cfg.seriesB.data.slice(lo, hi + 1) },
          cfg.detailExtra || {}
        );
      } else {
        C.multiLine(
          key,
          detailId,
          labels.slice(lo, hi + 1),
          cfg.datasets.map((d) => ({ ...d, data: d.data.slice(lo, hi + 1) })),
          cfg.detailExtra || {}
        );
      }
      updateLabel(key);
    };

    s.onChange = redrawDetail;

    // Mini overview — full series
    C.destroy(`${key}Mini`);
    if (n && document.getElementById(miniId)) {
      const opts = miniOpts();
      if (mode === "dual") {
        opts.scales.y2 = {
          position: "right",
          ticks: { display: false },
          grid: { drawOnChartArea: false },
          border: { display: false },
        };
        C.upsert(`${key}Mini`, miniId, {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                data: cfg.seriesA.data,
                borderColor: cfg.seriesA.color || t.primary,
                backgroundColor: t.fill,
                fill: true,
                yAxisID: "y",
                pointRadius: 0,
                borderWidth: 1.5,
                tension: 0.25,
              },
              {
                data: cfg.seriesB.data,
                borderColor: cfg.seriesB.color || t.accent,
                backgroundColor: "transparent",
                fill: false,
                yAxisID: "y2",
                pointRadius: 0,
                borderWidth: 1.5,
                borderDash: [4, 3],
                tension: 0.25,
              },
            ],
          },
          options: opts,
        });
      } else {
        C.upsert(`${key}Mini`, miniId, {
          type: "line",
          data: {
            labels,
            datasets: cfg.datasets.map((d, i) => ({
              data: d.data,
              borderColor: d.color || [t.primary, t.accent, t.noshow][i % 3],
              backgroundColor: "transparent",
              fill: false,
              pointRadius: 0,
              borderWidth: 1.5,
              borderDash: d.borderDash || [],
              tension: 0.25,
            })),
          },
          options: opts,
        });
      }
    }

    bindWindow(key);
    syncWindow(key);
    redrawDetail();
  }

  function reset(key) {
    const s = state.get(key);
    if (!s) return;
    s.start = 0;
    s.end = Math.max(0, s.n - 1);
    syncWindow(key);
    updateLabel(key);
    if (typeof s.onChange === "function") s.onChange();
  }

  function resetAll() {
    [...state.keys()].forEach(reset);
  }

  window.HBDRange = { render, reset, resetAll, state, syncWindow };
})();
