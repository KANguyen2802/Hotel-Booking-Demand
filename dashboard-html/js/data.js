(function () {
  const STORE = {
    meta: null,
    revpar: [],
    status: [],
    segment: [],
    countries: [],
    cancelMonthly: [],
    cancelLead: [],
    cancelDeposit: [],
    cancelChannel: [],
    cancelSegment: [],
    bookingCube: [],
    ready: false,
  };

  async function loadJson(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  }

  async function loadAll() {
    const [
      meta,
      revpar,
      status,
      segment,
      countries,
      cancelMonthly,
      cancelLead,
      cancelDeposit,
      cancelChannel,
      cancelSegment,
      bookingCube,
    ] = await Promise.all([
      loadJson("data/meta.json"),
      loadJson("data/revpar_monthly.json"),
      loadJson("data/status_mix.json"),
      loadJson("data/segment_mix.json"),
      loadJson("data/countries.json"),
      loadJson("data/cancel_monthly.json"),
      loadJson("data/cancel_lead.json"),
      loadJson("data/cancel_deposit.json"),
      loadJson("data/cancel_channel.json"),
      loadJson("data/cancel_segment.json"),
      loadJson("data/booking_cube.json"),
    ]);
    STORE.meta = meta;
    STORE.revpar = revpar;
    STORE.status = status;
    STORE.segment = segment;
    STORE.countries = countries;
    STORE.cancelMonthly = cancelMonthly;
    STORE.cancelLead = cancelLead;
    STORE.cancelDeposit = cancelDeposit;
    STORE.cancelChannel = cancelChannel;
    STORE.cancelSegment = cancelSegment;
    STORE.bookingCube = bookingCube;
    STORE.ready = true;
    return STORE;
  }

  function filterRevpar({ hotels, years }) {
    const yearSet = new Set((years || []).map(Number));
    return STORE.revpar.filter(
      (r) => hotels.includes(r.hotel) && (!yearSet.size || yearSet.has(Number(r.year)))
    );
  }

  function filterAgg(rows, { hotels, years }, yearKey = "year") {
    const yearSet = new Set((years || []).map(Number));
    return rows.filter(
      (r) => hotels.includes(r.hotel) && (!yearSet.size || yearSet.has(Number(r[yearKey])))
    );
  }

  function filterByMonthRange(rows, { hotels, years }, monthKey = "year_month") {
    const yearSet = new Set((years || []).map(Number));
    return rows.filter((r) => {
      if (!hotels.includes(r.hotel)) return false;
      if (!yearSet.size) return true;
      const y = Number(r.year ?? String(r[monthKey]).slice(0, 4));
      return yearSet.has(y);
    });
  }

  function weightedMean(rows, valueKey, weightKey) {
    let num = 0;
    let den = 0;
    rows.forEach((r) => {
      const w = Math.max(Number(r[weightKey]) || 0, 0);
      const v = Number(r[valueKey]);
      if (!Number.isFinite(v) || w <= 0) return;
      num += v * w;
      den += w;
    });
    return den ? num / den : 0;
  }

  function overviewKpis(rows) {
    if (!rows.length) {
      return { bookings: 0, revenue: 0, adr: 0, occupancy: 0, revpar: 0, cancel_rate: 0 };
    }
    const bookings = rows.reduce((s, r) => s + r.total_bookings, 0);
    const canceled = rows.reduce((s, r) => s + r.canceled_bookings, 0);
    const revenue = rows.reduce((s, r) => s + r.total_revenue, 0);
    return {
      bookings,
      revenue,
      adr: weightedMean(rows, "adr", "successful_bookings"),
      occupancy: weightedMean(rows, "occupancy_rate", "total_bookings"),
      revpar: weightedMean(rows, "revpar", "total_bookings"),
      cancel_rate: canceled / Math.max(bookings, 1),
    };
  }

  function monthlyTrends(rows) {
    const map = new Map();
    rows.forEach((r) => {
      const k = r.year_month;
      if (!map.has(k)) {
        map.set(k, {
          year_month: k,
          total_bookings: 0,
          successful_bookings: 0,
          canceled_bookings: 0,
          total_revenue: 0,
          adr_w: 0,
          adr_den: 0,
          occ_w: 0,
          rev_w: 0,
        });
      }
      const g = map.get(k);
      g.total_bookings += r.total_bookings;
      g.successful_bookings += r.successful_bookings;
      g.canceled_bookings += r.canceled_bookings;
      g.total_revenue += r.total_revenue;
      const sw = Math.max(r.successful_bookings, 1);
      g.adr_w += (r.adr || 0) * sw;
      g.adr_den += sw;
      g.occ_w += (r.occupancy_rate || 0) * r.total_bookings;
      g.rev_w += (r.revpar || 0) * r.total_bookings;
    });
    return [...map.values()]
      .map((g) => ({
        year_month: g.year_month,
        total_bookings: g.total_bookings,
        successful_bookings: g.successful_bookings,
        canceled_bookings: g.canceled_bookings,
        total_revenue: g.total_revenue,
        adr: g.adr_den ? g.adr_w / g.adr_den : 0,
        occupancy_rate: g.total_bookings ? g.occ_w / g.total_bookings : 0,
        revpar: g.total_bookings ? g.rev_w / g.total_bookings : 0,
        cancel_rate: g.canceled_bookings / Math.max(g.total_bookings, 1),
      }))
      .sort((a, b) => a.year_month.localeCompare(b.year_month));
  }

  function statusMix(rows) {
    const map = new Map();
    rows.forEach((r) => {
      map.set(r.status, (map.get(r.status) || 0) + r.bookings);
    });
    return [...map.entries()]
      .map(([status, bookings]) => ({ status, bookings }))
      .sort((a, b) => b.bookings - a.bookings);
  }

  function segmentMix(rows, limit = 8) {
    const map = new Map();
    rows.forEach((r) => {
      if (!map.has(r.market_segment)) {
        map.set(r.market_segment, { market_segment: r.market_segment, bookings: 0 });
      }
      map.get(r.market_segment).bookings += r.bookings;
    });
    return [...map.values()].sort((a, b) => b.bookings - a.bookings).slice(0, limit);
  }

  function topCountries(rows, limit = 10) {
    const map = new Map();
    rows.forEach((r) => {
      if (!map.has(r.country)) {
        map.set(r.country, { country: r.country, bookings: 0 });
      }
      map.get(r.country).bookings += r.bookings;
    });
    return [...map.values()].sort((a, b) => b.bookings - a.bookings).slice(0, limit);
  }

  /** Aggregate weighted cancel_rate by a categorical key. */
  function cancelByKey(rows, key, { minBookings = 0, limit = Infinity } = {}) {
    const map = new Map();
    rows.forEach((r) => {
      const k = r[key];
      if (!map.has(k)) map.set(k, { [key]: k, bookings: 0, canceled_w: 0 });
      const g = map.get(k);
      g.bookings += r.bookings;
      g.canceled_w += (r.cancel_rate || 0) * r.bookings;
    });
    return [...map.values()]
      .map((g) => ({
        [key]: g[key],
        bookings: g.bookings,
        cancel_rate: g.bookings ? g.canceled_w / g.bookings : 0,
      }))
      .filter((g) => g.bookings >= minBookings)
      .sort((a, b) => b.cancel_rate - a.cancel_rate)
      .slice(0, limit);
  }

  const LEAD_ORDER = { "0-7d": 0, "8-30d": 1, "31-90d": 2, "91-180d": 3, "180d+": 4 };

  function cancelLeadBins(rows) {
    const map = new Map();
    rows.forEach((r) => {
      if (!map.has(r.lead_bin)) map.set(r.lead_bin, { lead_bin: r.lead_bin, bookings: 0, canceled_w: 0 });
      const g = map.get(r.lead_bin);
      g.bookings += r.bookings;
      g.canceled_w += (r.cancel_rate || 0) * r.bookings;
    });
    return [...map.values()]
      .map((g) => ({
        lead_bin: g.lead_bin,
        bookings: g.bookings,
        cancel_rate: g.bookings ? g.canceled_w / g.bookings : 0,
      }))
      .sort((a, b) => (LEAD_ORDER[a.lead_bin] ?? 99) - (LEAD_ORDER[b.lead_bin] ?? 99));
  }

  function cancelMonthlyTrend(rows) {
    const map = new Map();
    rows.forEach((r) => {
      if (!map.has(r.year_month)) {
        map.set(r.year_month, {
          year_month: r.year_month,
          bookings: 0,
          cancel_w: 0,
          noshow_w: 0,
        });
      }
      const g = map.get(r.year_month);
      g.bookings += r.bookings;
      g.cancel_w += (r.cancel_rate || 0) * r.bookings;
      g.noshow_w += (r.noshow_rate || 0) * r.bookings;
    });
    return [...map.values()]
      .map((g) => ({
        year_month: g.year_month,
        bookings: g.bookings,
        cancel_rate: g.bookings ? g.cancel_w / g.bookings : 0,
        noshow_rate: g.bookings ? g.noshow_w / g.bookings : 0,
      }))
      .sort((a, b) => a.year_month.localeCompare(b.year_month));
  }

  /** Filter booking cube by sidebar + brush selections. */
  function filterCube({ hotels, years }, brush = {}) {
    const yearSet = new Set((years || []).map(Number));
    const hotelList = brush.hotel ? [brush.hotel] : hotels;
    return STORE.bookingCube.filter((r) => {
      if (!hotelList.includes(r.hotel)) return false;
      if (yearSet.size && !yearSet.has(Number(r.year))) return false;
      if (brush.lead_bin && r.lead_bin !== brush.lead_bin) return false;
      if (brush.deposit_type && r.deposit_type !== brush.deposit_type) return false;
      if (brush.channel && r.channel !== brush.channel) return false;
      if (brush.segment && r.segment !== brush.segment) return false;
      if (brush.status && r.status !== brush.status) return false;
      if (brush.country && r.country !== brush.country) return false;
      if (brush.year_month && r.year_month !== brush.year_month) return false;
      if (brush.month_number != null && Number(String(r.year_month).slice(5, 7)) !== Number(brush.month_number)) {
        return false;
      }
      return true;
    });
  }

  /** RevPAR panel filter — supports hotel / year_month / month_number brush. */
  function filterRevparBrushed({ hotels, years }, brush = {}) {
    const hotelList = brush.hotel ? [brush.hotel] : hotels;
    let rows = filterRevpar({ hotels: hotelList, years });
    if (brush.year_month) {
      rows = rows.filter((r) => r.year_month === brush.year_month);
    }
    if (brush.month_number != null) {
      rows = rows.filter((r) => Number(r.month_number) === Number(brush.month_number));
    }
    return rows;
  }

  function cubeCountries(rows, limit = 10) {
    const map = new Map();
    rows.forEach((r) => {
      if (!map.has(r.country)) map.set(r.country, { country: r.country, bookings: 0 });
      map.get(r.country).bookings += r.bookings;
    });
    return [...map.values()].sort((a, b) => b.bookings - a.bookings).slice(0, limit);
  }

  function cubeSegments(rows, limit = 8) {
    const map = new Map();
    rows.forEach((r) => {
      if (!map.has(r.segment)) map.set(r.segment, { market_segment: r.segment, bookings: 0 });
      map.get(r.segment).bookings += r.bookings;
    });
    return [...map.values()].sort((a, b) => b.bookings - a.bookings).slice(0, limit);
  }

  function cubeMonthlyRevenue(rows) {
    const map = new Map();
    rows.forEach((r) => {
      if (!map.has(r.year_month)) {
        map.set(r.year_month, {
          year_month: r.year_month,
          total_bookings: 0,
          total_revenue: 0,
          canceled: 0,
        });
      }
      const g = map.get(r.year_month);
      g.total_bookings += r.bookings;
      g.total_revenue += r.revenue || 0;
      g.canceled += r.canceled || 0;
    });
    return [...map.values()]
      .map((g) => ({
        ...g,
        cancel_rate: g.canceled / Math.max(g.total_bookings, 1),
      }))
      .sort((a, b) => a.year_month.localeCompare(b.year_month));
  }

  function cubeKpis(rows) {
    const bookings = rows.reduce((s, r) => s + r.bookings, 0);
    const canceled = rows.reduce((s, r) => s + r.canceled, 0);
    const noshow = rows.reduce((s, r) => s + r.noshow, 0);
    const revenue = rows.reduce((s, r) => s + (r.revenue || 0), 0);
    const cancel_rate = canceled / Math.max(bookings, 1);
    const lost_est = revenue * (cancel_rate / Math.max(1 - cancel_rate, 0.01)) * 0.35;
    return {
      bookings,
      canceled,
      noshow,
      revenue,
      cancel_rate,
      noshow_rate: noshow / Math.max(bookings, 1),
      lost_est,
    };
  }

  function cubeStatusMix(rows) {
    const map = new Map();
    rows.forEach((r) => {
      map.set(r.status, (map.get(r.status) || 0) + r.bookings);
    });
    return [...map.entries()]
      .map(([status, bookings]) => ({ status, bookings }))
      .sort((a, b) => b.bookings - a.bookings);
  }

  function cubeMonthlyTrend(rows) {
    const map = new Map();
    rows.forEach((r) => {
      if (!map.has(r.year_month)) {
        map.set(r.year_month, { year_month: r.year_month, bookings: 0, canceled: 0, noshow: 0 });
      }
      const g = map.get(r.year_month);
      g.bookings += r.bookings;
      g.canceled += r.canceled;
      g.noshow += r.noshow;
    });
    return [...map.values()]
      .map((g) => ({
        year_month: g.year_month,
        bookings: g.bookings,
        cancel_rate: g.canceled / Math.max(g.bookings, 1),
        noshow_rate: g.noshow / Math.max(g.bookings, 1),
      }))
      .sort((a, b) => a.year_month.localeCompare(b.year_month));
  }

  function cubeByKey(rows, key, { minBookings = 0, limit = Infinity, rateKey = "canceled" } = {}) {
    const map = new Map();
    rows.forEach((r) => {
      const k = r[key];
      if (!map.has(k)) map.set(k, { [key]: k, bookings: 0, canceled: 0 });
      const g = map.get(k);
      g.bookings += r.bookings;
      g.canceled += r[rateKey] ?? r.canceled;
    });
    return [...map.values()]
      .map((g) => ({
        [key]: g[key],
        bookings: g.bookings,
        cancel_rate: g.canceled / Math.max(g.bookings, 1),
      }))
      .filter((g) => g.bookings >= minBookings)
      .sort((a, b) => b.cancel_rate - a.cancel_rate)
      .slice(0, limit);
  }

  function cubeLeadBins(rows) {
    return cubeByKey(rows, "lead_bin").sort(
      (a, b) => (LEAD_ORDER[a.lead_bin] ?? 99) - (LEAD_ORDER[b.lead_bin] ?? 99)
    );
  }

  function seasonalityHeatmap(rows) {
    const hotels = [...new Set(rows.map((r) => r.hotel))].sort();
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const cell = new Map(); // hotel|month -> {sum, w}
    rows.forEach((r) => {
      const m = Number(r.month_number);
      const k = `${r.hotel}|${m}`;
      if (!cell.has(k)) cell.set(k, { sum: 0, w: 0 });
      const g = cell.get(k);
      g.sum += (r.revpar || 0) * (r.total_bookings || 1);
      g.w += r.total_bookings || 1;
    });
    const values = [];
    hotels.forEach((hotel) => {
      months.forEach((m) => {
        const g = cell.get(`${hotel}|${m}`);
        if (g && g.w) values.push(g.sum / g.w);
      });
    });
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    return {
      hotels,
      months,
      min,
      max,
      get(hotel, month) {
        const g = cell.get(`${hotel}|${month}`);
        return g && g.w ? g.sum / g.w : null;
      },
    };
  }

  function latestMonthByHotel(rows) {
    const latestYm = rows.reduce((m, r) => (r.year_month > m ? r.year_month : m), "");
    if (!latestYm) return { year_month: "", rows: [] };
    const byHotel = new Map();
    rows
      .filter((r) => r.year_month === latestYm)
      .forEach((r) => {
        byHotel.set(r.hotel, r);
      });
    return {
      year_month: latestYm,
      rows: [...byHotel.values()].sort((a, b) => a.revpar - b.revpar),
    };
  }

  function simulate(baseRows, { adrDelta, occDelta, cancelDelta, elasticity }) {
    let occPp = occDelta / 100;
    if (elasticity) occPp += (adrDelta / 100) * -0.25;
    const adrMult = 1 + adrDelta / 100;
    const cancelPp = cancelDelta / 100;

    return baseRows.map((r) => {
      const adr_sim = r.adr * adrMult;
      let occ_sim = Math.min(0.99, Math.max(0.05, r.occupancy_rate + occPp));
      const cancel_base = r.canceled_bookings / Math.max(r.total_bookings, 1);
      const cancel_sim = Math.min(0.95, Math.max(0, cancel_base + cancelPp));
      occ_sim = Math.min(0.99, Math.max(0.05, occ_sim - cancelPp * 0.5));
      const revpar_base = r.adr * r.occupancy_rate;
      const revpar_sim = adr_sim * occ_sim;
      const ratio = revpar_base ? revpar_sim / revpar_base : 1;
      return {
        ...r,
        adr_sim,
        occ_sim,
        cancel_sim,
        revpar_base,
        revpar_sim,
        revenue_sim: r.total_revenue * ratio,
      };
    });
  }

  function fmtMoney(x) {
    const n = Number(x) || 0;
    if (Math.abs(n) >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000) return `€${(n / 1_000).toFixed(1)}K`;
    return `€${Math.round(n).toLocaleString("en-US")}`;
  }

  function fmtPct(x, digits = 1) {
    return `${((Number(x) || 0) * 100).toFixed(digits)}%`;
  }

  function fmtNum(x, digits = 1) {
    return (Number(x) || 0).toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function monthInputValue(ym) {
    // ym: YYYY-MM
    return ym;
  }

  window.HBDData = {
    STORE,
    loadAll,
    filterRevpar,
    filterAgg,
    filterByMonthRange,
    filterCube,
    filterRevparBrushed,
    overviewKpis,
    monthlyTrends,
    statusMix,
    segmentMix,
    topCountries,
    cancelByKey,
    cancelLeadBins,
    cancelMonthlyTrend,
    cubeKpis,
    cubeStatusMix,
    cubeMonthlyTrend,
    cubeByKey,
    cubeLeadBins,
    cubeCountries,
    cubeSegments,
    cubeMonthlyRevenue,
    seasonalityHeatmap,
    latestMonthByHotel,
    simulate,
    weightedMean,
    fmtMoney,
    fmtPct,
    fmtNum,
    monthInputValue,
  };
})();
