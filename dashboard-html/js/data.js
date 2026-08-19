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
    customerTypeMonthly: [],
    dailyAdrOcc: [],
    roomTypeRevpar: [],
    adrCancelBox: { rows: [], stats: [] },
    ready: false,
  };

  // Bust browser cache when daily_adr_occ (segments, etc.) is regenerated.
  const DATA_VERSION = "20260801s";

  async function loadJson(path) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${path}${sep}v=${DATA_VERSION}`);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  }

  function normalizeSegments(raw) {
    let segs = raw;
    if (typeof segs === "string") {
      try {
        segs = JSON.parse(segs);
      } catch (_) {
        return null;
      }
    }
    if (!segs || typeof segs !== "object" || Array.isArray(segs)) return null;
    return segs;
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
      customerTypeMonthly,
      dailyAdrOcc,
      roomTypeRevpar,
      adrCancelBox,
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
      loadJson("data/customer_type_monthly.json"),
      loadJson("data/daily_adr_occ.json"),
      loadJson("data/room_type_revpar.json"),
      loadJson("data/adr_cancel_box.json"),
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
    STORE.customerTypeMonthly = customerTypeMonthly;
    STORE.dailyAdrOcc = dailyAdrOcc;
    STORE.roomTypeRevpar = roomTypeRevpar;
    STORE.adrCancelBox = adrCancelBox || { rows: [], stats: [] };
    STORE.ready = true;
    return STORE;
  }

  /** Inclusive "YYYY-MM" range check; null bound = unbounded on that side. */
  function inMonthRange(ym, monthFrom, monthTo) {
    if (monthFrom && ym < monthFrom) return false;
    if (monthTo && ym > monthTo) return false;
    return true;
  }

  /** All "YYYY-MM" strings from `min` to `max`, inclusive. Used to build the sidebar slicer domain. */
  function monthRange(min, max) {
    if (!min || !max) return [];
    const out = [];
    let [y, m] = min.split("-").map(Number);
    const [yMax, mMax] = max.split("-").map(Number);
    while (y < yMax || (y === yMax && m <= mMax)) {
      out.push(`${y}-${String(m).padStart(2, "0")}`);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return out;
  }

  function filterRevpar({ hotels, years, monthFrom, monthTo }) {
    const yearSet = new Set((years || []).map(Number));
    return STORE.revpar.filter(
      (r) =>
        hotels.includes(r.hotel) &&
        (!yearSet.size || yearSet.has(Number(r.year))) &&
        inMonthRange(r.year_month, monthFrom, monthTo)
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

  function cubeDistinct(key) {
    return [...new Set((STORE.bookingCube || []).map((r) => r[key]).filter((v) => v != null && v !== ""))]
      .map(String)
      .sort((a, b) => a.localeCompare(b));
  }

  /** Filter booking cube by sidebar + brush selections. */
  function filterCube({ hotels, years, monthFrom, monthTo, segment, channel, deposit_type }, brush = {}) {
    const yearSet = new Set((years || []).map(Number));
    const hotelList = brush.hotel ? [brush.hotel] : hotels;
    const seg = brush.segment || segment || null;
    const ch = brush.channel || channel || null;
    const dep = brush.deposit_type || deposit_type || null;
    return STORE.bookingCube.filter((r) => {
      if (!hotelList.includes(r.hotel)) return false;
      if (yearSet.size && !yearSet.has(Number(r.year))) return false;
      if (!inMonthRange(r.year_month, monthFrom, monthTo)) return false;
      if (seg && r.segment !== seg) return false;
      if (ch && r.channel !== ch) return false;
      if (dep && r.deposit_type !== dep) return false;
      if (brush.lead_bin && r.lead_bin !== brush.lead_bin) return false;
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
  function filterRevparBrushed({ hotels, years, monthFrom, monthTo }, brush = {}) {
    const hotelList = brush.hotel ? [brush.hotel] : hotels;
    let rows = filterRevpar({ hotels: hotelList, years, monthFrom, monthTo });
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
        map.set(r.year_month, {
          year_month: r.year_month,
          bookings: 0,
          canceled: 0,
          noshow: 0,
          revenue: 0,
        });
      }
      const g = map.get(r.year_month);
      g.bookings += r.bookings;
      g.canceled += r.canceled;
      g.noshow += r.noshow;
      g.revenue += r.revenue || 0;
    });
    return [...map.values()]
      .map((g) => {
        const cancel_rate = g.canceled / Math.max(g.bookings, 1);
        return {
          year_month: g.year_month,
          bookings: g.bookings,
          canceled: g.canceled,
          noshow: g.noshow,
          revenue: g.revenue,
          cancel_rate,
          noshow_rate: g.noshow / Math.max(g.bookings, 1),
          lost_est: g.revenue * (cancel_rate / Math.max(1 - cancel_rate, 0.01)) * 0.35,
        };
      })
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

  /**
   * Cancel-rate samples (%) per lead_bin for boxplot / violin.
   * One sample = cancel rate of (hotel × year_month) cell with enough bookings.
   */
  function cubeChannelRevenue(rows) {
    const map = new Map();
    (rows || []).forEach((r) => {
      const ch = r.channel || "Unknown";
      if (!map.has(ch)) map.set(ch, { channel: ch, revenue: 0, bookings: 0 });
      const g = map.get(ch);
      g.revenue += r.revenue || 0;
      g.bookings += r.bookings || 0;
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }

  function filterCustomerType({ hotels, years, monthFrom, monthTo }, brush = {}) {
    const yearSet = new Set((years || []).map(Number));
    const hotelList = brush.hotel ? [brush.hotel] : hotels;
    return STORE.customerTypeMonthly.filter((r) => {
      if (!hotelList.includes(r.hotel)) return false;
      if (yearSet.size && !yearSet.has(Number(r.year))) return false;
      if (!inMonthRange(r.year_month, monthFrom, monthTo)) return false;
      if (brush.year_month && r.year_month !== brush.year_month) return false;
      return true;
    });
  }

  function customerTypeSeries(rows, metric = "revenue") {
    const types = (STORE.meta && STORE.meta.customer_types) || [
      "Transient",
      "Transient-Party",
      "Contract",
    ];
    const months = [...new Set(rows.map((r) => r.year_month))].sort();
    return types.map((ct) => {
      const data = months.map((m) => {
        const hits = rows.filter((r) => r.customer_type === ct && r.year_month === m);
        if (!hits.length) return 0;
        if (metric === "room_nights") return hits.reduce((s, r) => s + (r.room_nights || 0), 0);
        return hits.reduce((s, r) => s + (r.revenue || 0), 0);
      });
      return { customer_type: ct, labels: months, data };
    });
  }

  function filterDailyAdrOcc({ hotels, years, monthFrom, monthTo }, brush = {}) {
    const yearSet = new Set((years || []).map(Number));
    const hotelList = brush.hotel ? [brush.hotel] : hotels;
    return STORE.dailyAdrOcc.filter((r) => {
      if (!hotelList.includes(r.hotel)) return false;
      if (yearSet.size && !yearSet.has(Number(r.year))) return false;
      if (!inMonthRange(r.year_month, monthFrom, monthTo)) return false;
      if (brush.year_month && r.year_month !== brush.year_month) return false;
      return true;
    });
  }

  function dailyScatterPoints(rows) {
    // Aggregate across hotels for same day when multiple hotels selected.
    // Scatter axes: weighted ADR / Occupancy (như lúc thêm biểu đồ).
    // RevPAR màu điểm = ADR × Occupancy.
    const map = new Map();
    (rows || []).forEach((r) => {
      const k = r.arrival_date;
      if (!map.has(k)) {
        map.set(k, {
          date: k,
          year: Number(r.year) || Number(String(k).slice(0, 4)) || null,
          year_month: r.year_month || String(k).slice(0, 7),
          w: 0,
          adr: 0,
          occ: 0,
          revenue: 0,
          bookings: 0,
          canceled: 0,
          room_nights: 0,
          available_room_nights: 0,
          segments: {},
        });
      }
      const g = map.get(k);
      const w = Number(r.bookings) || 1;
      g.w += w;
      g.adr += (Number(r.adr) || 0) * w;
      g.occ += (Number(r.occupancy_rate) || 0) * w;
      g.revenue += Number(r.revenue) || 0;
      g.bookings += Number(r.bookings) || 0;
      g.canceled += Number(r.canceled) || 0;
      g.room_nights += Number(r.room_nights) || 0;
      g.available_room_nights += Number(r.available_room_nights) || 0;
      const segs = normalizeSegments(r.segments);
      if (segs) {
        Object.keys(segs).forEach((name) => {
          g.segments[name] = (g.segments[name] || 0) + (Number(segs[name]) || 0);
        });
      }
    });
    return [...map.values()]
      .filter((g) => g.w > 0)
      .map((g) => {
        const adr = g.adr / g.w;
        const occ = g.occ / g.w;
        const revpar = adr * occ;
        const cancelRate = g.bookings > 0 ? g.canceled / g.bookings : 0;
        return {
          x: adr,
          y: occ * 100,
          z: revpar,
          label: g.date,
          year: g.year,
          year_month: g.year_month,
          revenue: g.revenue,
          bookings: g.bookings,
          canceled: g.canceled,
          cancel_rate: cancelRate,
          room_nights: g.room_nights,
          available_room_nights: g.available_room_nights,
          segments: { ...g.segments },
        };
      });
  }

  function filterRoomType({ hotels, years }) {
    const yearSet = new Set((years || []).map(Number));
    return STORE.roomTypeRevpar.filter(
      (r) => hotels.includes(r.hotel) && (!yearSet.size || yearSet.has(Number(r.year)))
    );
  }

  function roomTypeGrouped(rows, { limit = 8 } = {}) {
    const map = new Map();
    (rows || []).forEach((r) => {
      const rt = r.room_type || "?";
      if (!map.has(rt)) {
        map.set(rt, {
          room_type: rt,
          reserved_revpar_w: 0,
          reserved_w: 0,
          assigned_revpar_w: 0,
          assigned_w: 0,
          bookings: 0,
        });
      }
      const g = map.get(rt);
      const w = r.bookings || 0;
      g.bookings += w;
      if (r.side === "reserved") {
        g.reserved_revpar_w += (r.revpar || 0) * w;
        g.reserved_w += w;
      } else {
        g.assigned_revpar_w += (r.revpar || 0) * w;
        g.assigned_w += w;
      }
    });
    return [...map.values()]
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, limit)
      .map((g) => ({
        room_type: g.room_type,
        reserved: g.reserved_w ? g.reserved_revpar_w / g.reserved_w : 0,
        assigned: g.assigned_w ? g.assigned_revpar_w / g.assigned_w : 0,
      }));
  }

  /** RevPAR MoM bridge: prev → ΔADR → ΔOcc → curr */
  function revparDecomposition(monthlyTrendsRows) {
    const rows = monthlyTrendsRows || [];
    if (rows.length < 2) return null;
    const prev = rows[rows.length - 2];
    const curr = rows[rows.length - 1];
    const adr0 = prev.adr || 0;
    const adr1 = curr.adr || 0;
    const occ0 = prev.occupancy_rate || 0;
    const occ1 = curr.occupancy_rate || 0;
    const rp0 = prev.revpar != null ? prev.revpar : adr0 * occ0;
    const rp1 = curr.revpar != null ? curr.revpar : adr1 * occ1;
    const dAdr = occ0 * (adr1 - adr0);
    const dOcc = adr1 * (occ1 - occ0);
    return {
      prev_month: prev.year_month,
      curr_month: curr.year_month,
      prev_revpar: rp0,
      curr_revpar: rp1,
      delta_adr: dAdr,
      delta_occ: dOcc,
      residual: rp1 - (rp0 + dAdr + dOcc),
    };
  }

  function filterAdrCancelBox({ hotels, years }) {
    const yearSet = new Set((years || []).map(Number));
    const rows = (STORE.adrCancelBox.rows || []).filter(
      (r) => hotels.includes(r.hotel) && (!yearSet.size || yearSet.has(Number(r.year)))
    );
    const stats = (STORE.adrCancelBox.stats || []).filter(
      (r) => hotels.includes(r.hotel) && (!yearSet.size || yearSet.has(Number(r.year)))
    );
    const order = ["Not canceled", "Canceled"];
    const samples = order.map((label) => {
      const parts = rows.filter((r) => r.label === label).flatMap((r) => r.samples || []);
      return parts;
    });
    const summary = order.map((label) => {
      const parts = stats.filter((r) => r.label === label);
      const n = parts.reduce((s, r) => s + (r.n || 0), 0);
      const mean =
        n > 0 ? parts.reduce((s, r) => s + (r.mean || 0) * (r.n || 0), 0) / n : null;
      return { label, n, mean };
    });
    return { labels: order, samples, summary };
  }

  function statusFunnel(rows) {
    const map = new Map();
    (rows || []).forEach((r) => {
      const st = r.status || "Unknown";
      map.set(st, (map.get(st) || 0) + (r.bookings || 0));
    });
    const total = [...map.values()].reduce((s, v) => s + v, 0);
    const canceled = map.get("Canceled") || 0;
    const noshow = map.get("No-Show") || 0;
    const checkout = map.get("Check-Out") || 0;
    return {
      labels: ["Bookings", "After cancel leak", "Check-Out"],
      values: [total, total - canceled, checkout],
      detail: {
        total,
        canceled,
        noshow,
        checkout,
        cancel_pct: total ? canceled / total : 0,
        checkout_pct: total ? checkout / total : 0,
      },
    };
  }

  function cubeLeadCancelRateSamples(rows, { minBookings = 15 } = {}) {
    const cell = new Map();
    (rows || []).forEach((r) => {
      if (!r.lead_bin || !r.year_month || !r.hotel) return;
      const k = `${r.lead_bin}|${r.year_month}|${r.hotel}`;
      if (!cell.has(k)) {
        cell.set(k, {
          lead_bin: r.lead_bin,
          bookings: 0,
          canceled: 0,
        });
      }
      const g = cell.get(k);
      g.bookings += r.bookings || 0;
      g.canceled += r.canceled || 0;
    });

    const byLead = new Map();
    cell.forEach((g) => {
      if (g.bookings < minBookings) return;
      const rate = (g.canceled / g.bookings) * 100;
      if (!byLead.has(g.lead_bin)) byLead.set(g.lead_bin, []);
      byLead.get(g.lead_bin).push(rate);
    });

    const labels = [
      ...Object.keys(LEAD_ORDER).sort((a, b) => LEAD_ORDER[a] - LEAD_ORDER[b]),
      ...[...byLead.keys()].filter((k) => LEAD_ORDER[k] == null).sort(),
    ].filter((lab) => byLead.has(lab));

    const samples = labels.map((lab) => byLead.get(lab) || []);
    const stats = labels.map((lab, i) => {
      const vals = [...samples[i]].sort((a, b) => a - b);
      const n = vals.length;
      const q = (p) => {
        if (!n) return null;
        const idx = (n - 1) * p;
        const lo = Math.floor(idx);
        const hi = Math.ceil(idx);
        if (lo === hi) return vals[lo];
        return vals[lo] * (hi - idx) + vals[hi] * (idx - lo);
      };
      const sum = vals.reduce((s, v) => s + v, 0);
      return {
        lead_bin: lab,
        n,
        min: n ? vals[0] : null,
        q1: q(0.25),
        median: q(0.5),
        q3: q(0.75),
        max: n ? vals[n - 1] : null,
        mean: n ? sum / n : null,
      };
    });

    return { labels, samples, stats };
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
    inMonthRange,
    monthRange,
    filterCube,
    cubeDistinct,
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
    cubeLeadCancelRateSamples,
    cubeChannelRevenue,
    filterCustomerType,
    customerTypeSeries,
    filterDailyAdrOcc,
    dailyScatterPoints,
    filterRoomType,
    roomTypeGrouped,
    revparDecomposition,
    filterAdrCancelBox,
    statusFunnel,
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
