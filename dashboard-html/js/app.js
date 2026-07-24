(function () {
  const D = () => window.HBDData;
  const C = () => window.HBDCharts;

  const state = {
    view: "overview",
    hotels: [],
    years: [],
    brush: {},
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
    return ["lead_bin", "deposit_type", "channel", "segment", "status", "country"].some(
      (k) => state.brush[k] != null
    );
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
      subtitle:
        "CEO snapshot — bookings, revenue, RevPAR và sức khỏe hủy phòng từ star schema đã chuẩn hóa.",
    },
    revpar: {
      title: "RevPAR",
      subtitle: "Revenue per available room — phân rã ADR × Occupancy theo tháng và khách sạn.",
    },
    cancellation: {
      title: "Cancellation Analysis",
      subtitle: "Ai hủy, khi nào, lead time & kênh — từ booking normalized (Canceled / Check-Out / No-Show).",
    },
    simulator: {
      title: "Dynamic Pricing Simulator",
      subtitle: "What-if trên dữ liệu tháng đã chuẩn hóa — baseline vs scenario (RevPAR = ADR × Occ).",
    },
  };

  function qs(sel) {
    return document.querySelector(sel);
  }

  function qsa(sel) {
    return [...document.querySelectorAll(sel)];
  }

  function getFilters() {
    const hotels = qsa('#hotelChips input:checked').map((el) => el.value);
    const years = qsa('#yearChips input:checked').map((el) => Number(el.value));
    return {
      hotels: hotels.length ? hotels : [...state.hotels],
      years: years.length ? years : [...state.years],
    };
  }

  function kpiHtml(cards) {
    return cards
      .map(
        ([label, value, delta, kind]) => `
      <div class="kpi-card">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value">${value}</div>
        ${delta ? `<div class="kpi-delta ${kind || "flat"}">${delta}</div>` : ""}
      </div>`
      )
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
      cubeStatusMix,
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
    const trends = useCubeTrend ? cubeMonthlyRevenue(cubeRows) : monthlyTrends(revRows);
    const kpisRev = overviewKpis(revRows);
    const kpisCube = cubeKpis(cubeRows);

    let deltaRev = null;
    let dRevKind = "flat";
    let deltaCancel = null;
    let dCancelKind = "flat";
    if (trends.length >= 2) {
      const prev = trends[trends.length - 2];
      const curr = trends[trends.length - 1];
      if (prev.total_revenue) {
        const d = (curr.total_revenue - prev.total_revenue) / prev.total_revenue;
        deltaRev = `${d >= 0 ? "▲" : "▼"} ${Math.abs(d * 100).toFixed(1)}% MoM revenue`;
        dRevKind = d >= 0 ? "up" : "down";
      }
      const d2 = curr.cancel_rate - prev.cancel_rate;
      deltaCancel = `${d2 >= 0 ? "▲" : "▼"} ${Math.abs(d2 * 100).toFixed(1)} pp cancel`;
      dCancelKind = d2 >= 0 ? "down" : "up";
    }

    const bookings = useCubeTrend ? kpisCube.bookings : kpisRev.bookings;
    const revenue = useCubeTrend ? kpisCube.revenue : kpisRev.revenue;
    const cancelRate = useCubeTrend ? kpisCube.cancel_rate : kpisRev.cancel_rate;

    qs("#overviewKpis").innerHTML = kpiHtml([
      ["Bookings", bookings.toLocaleString("en-US"), null, "flat"],
      ["Revenue", fmtMoney(revenue), deltaRev, dRevKind],
      ["ADR", `€${fmtNum(kpisRev.adr)}`, null, "flat"],
      ["Occupancy", fmtPct(kpisRev.occupancy), null, "flat"],
      ["RevPAR", `€${fmtNum(kpisRev.revpar)}`, null, "flat"],
      ["Cancel rate", fmtPct(cancelRate), deltaCancel, dCancelKind],
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
        activeLabel: brush.year_month || null,
        onSelect: (lab) => toggleBrush("year_month", lab),
      },
    });

    const status = cubeStatusMix(filterCube(f, { ...brush, status: undefined }));
    C().doughnut(
      "status",
      "chartStatus",
      status.map((r) => r.status),
      status.map((r) => r.bookings),
      {
        activeLabel: brush.status || null,
        onSelect: (lab) => toggleBrush("status", lab),
      }
    );

    const segs = cubeSegments(filterCube(f, { ...brush, segment: undefined })).reverse();
    C().hbar(
      "segment",
      "chartSegment",
      segs.map((r) => r.market_segment),
      segs.map((r) => r.bookings),
      C().tokens().primary,
      {
        activeLabel: brush.segment || null,
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

  function renderRevpar() {
    const {
      fmtNum,
      fmtPct,
      filterRevparBrushed,
      overviewKpis,
      monthlyTrends,
      seasonalityHeatmap,
      latestMonthByHotel,
    } = D();
    const f = getFilters();
    const brush = state.brush;
    renderBrushBar();

    const rows = filterRevparBrushed(f, brush).sort(
      (a, b) => a.year_month.localeCompare(b.year_month) || a.hotel.localeCompare(b.hotel)
    );
    const kpis = overviewKpis(rows);
    const trends = monthlyTrends(rows);

    let delta = null;
    let kind = "flat";
    if (trends.length >= 2) {
      const prev = trends[trends.length - 2];
      const curr = trends[trends.length - 1];
      if (prev.revpar) {
        const d = (curr.revpar - prev.revpar) / prev.revpar;
        delta = `${d >= 0 ? "▲" : "▼"} ${Math.abs(d * 100).toFixed(1)}% MoM`;
        kind = d >= 0 ? "up" : "down";
      }
    }

    qs("#revparKpis").innerHTML = kpiHtml([
      ["RevPAR", `€${fmtNum(kpis.revpar)}`, delta, kind],
      ["ADR", `€${fmtNum(kpis.adr)}`, null, "flat"],
      ["Occupancy", fmtPct(kpis.occupancy), null, "flat"],
      ["Revenue", `€${Math.round(kpis.revenue).toLocaleString("en-US")}`, null, "flat"],
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
        activeLabel: brush.year_month || null,
        onSelect: (lab) => toggleBrush("year_month", lab),
      },
    });

    C().dualAxisTrend(
      "adrOcc",
      "chartAdrOcc",
      trends.map((r) => r.year_month),
      { label: "ADR (€)", data: trends.map((r) => r.adr), color: t.primary },
      { label: "Occupancy", data: trends.map((r) => r.occupancy_rate * 100), color: t.accent },
      {
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

  function renderCancellation() {
    const { fmtPct, filterCube, cubeKpis, cubeStatusMix, cubeMonthlyTrend, cubeByKey, cubeLeadBins } =
      D();
    const f = getFilters();
    const rows = filterCube(f, state.brush);
    const kpis = cubeKpis(rows);

    renderBrushBar();

    qs("#cancelKpis").innerHTML = kpiHtml([
      [
        "Cancel rate",
        fmtPct(kpis.cancel_rate),
        `${kpis.canceled.toLocaleString("en-US")} canceled`,
        "down",
      ],
      [
        "No-Show rate",
        fmtPct(kpis.noshow_rate),
        `${kpis.noshow.toLocaleString("en-US")} no-shows`,
        "flat",
      ],
      ["Canceled bookings", kpis.canceled.toLocaleString("en-US"), null, "flat"],
      [
        "Lost revenue (est.)",
        `€${Math.round(kpis.lost_est).toLocaleString("en-US")}`,
        "proxy · not accounting",
        "flat",
      ],
    ]);

    const status = cubeStatusMix(filterCube(f, { ...state.brush, status: undefined }));
    C().doughnut(
      "cancelStatus",
      "chartCancelStatus",
      status.map((r) => r.status),
      status.map((r) => r.bookings),
      {
        activeLabel: state.brush.status || null,
        onSelect: (lab) => toggleBrush("status", lab),
      }
    );

    const monthly = cubeMonthlyTrend(rows);
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
        activeLabel: state.brush.year_month || null,
        onSelect: (lab) => toggleBrush("year_month", lab),
      },
    });

    // Dimension charts: exclude own brush dim so bars stay visible for reselection
    const leadRows = filterCube(f, { ...state.brush, lead_bin: undefined });
    const lead = cubeLeadBins(leadRows);
    C().vbar(
      "cancelLead",
      "chartCancelLead",
      lead.map((r) => r.lead_bin),
      lead.map((r) => r.cancel_rate * 100),
      C().tokens().primary,
      {
        activeLabel: state.brush.lead_bin || null,
        onSelect: (lab) => toggleBrush("lead_bin", lab),
      }
    );

    const deposit = cubeByKey(filterCube(f, { ...state.brush, deposit_type: undefined }), "deposit_type").sort(
      (a, b) => a.cancel_rate - b.cancel_rate
    );
    C().hbar(
      "cancelDeposit",
      "chartCancelDeposit",
      deposit.map((r) => r.deposit_type),
      deposit.map((r) => r.cancel_rate * 100),
      C().tokens().accent,
      {
        activeLabel: state.brush.deposit_type || null,
        onSelect: (lab) => toggleBrush("deposit_type", lab),
      }
    );

    const channel = cubeByKey(filterCube(f, { ...state.brush, channel: undefined }), "channel").sort(
      (a, b) => a.cancel_rate - b.cancel_rate
    );
    C().hbar(
      "cancelChannel",
      "chartCancelChannel",
      channel.map((r) => r.channel),
      channel.map((r) => r.cancel_rate * 100),
      C().tokens().accentSoft,
      {
        activeLabel: state.brush.channel || null,
        onSelect: (lab) => toggleBrush("channel", lab),
      }
    );

    const seg = cubeByKey(filterCube(f, { ...state.brush, segment: undefined }), "segment", {
      minBookings: 50,
      limit: 10,
    }).sort((a, b) => a.cancel_rate - b.cancel_rate);
    C().hbar(
      "cancelSegment",
      "chartCancelSegment",
      seg.map((r) => r.segment),
      seg.map((r) => r.cancel_rate * 100),
      C().tokens().primarySoft,
      {
        activeLabel: state.brush.segment || null,
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
      el.addEventListener("change", renderActive);
    });
  }

  function resetFilters() {
    qsa("#hotelChips input, #yearChips input").forEach((el) => {
      el.checked = true;
    });
    state.brush = {};
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
    buildHotelChips(meta.hotels);
    buildYearChips(meta.years);

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

    window.addEventListener("themechange", () => {
      // recreate charts so token colors refresh
      renderActive();
    });

    setView("overview");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
