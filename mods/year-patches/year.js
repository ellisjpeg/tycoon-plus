// ── Year in review (DEVICES_TYCOON_YEAR) ──
// On 1 January (from 2009) a card sums up the year that just ended: revenue,
// profit and devices sold (the game's own monthly history in ArrayCompanyStats,
// filled by tickCompanyStatsDay), fans gained (Fans at the end of each year),
// best and worst device by profit, company rank among rivals and market share
// (the year's revenue against each rival's yearly revenue from the game's own
// _scanCompanies; the stats Market tab ranks by the last 180 days instead, which
// puts a company last on 1 January when its devices sold out in the spring) and
// each device type's share of the year's device revenue. Every figure has the
// change from the year before.
// The game keeps no per-device yearly figures, so this records its own: once a
// game day, just before the game's stats day runs (sales, fans and ratings are
// already done for that day), each device edition's SOLDED change is added to
// the year with that day's price and unit cost (profit as _slotProfit counts
// it). Saved per company in ArraySaves row 158; an old save starts recording
// from the day it is loaded, and that first card says "partial year".
// The card waits until the office screen is free (no game pop-up or news, no
// mod panel, no launch-day choice or launch event, nothing left over from the
// awards) and holds the calendar while it is open, like the game's own cards.
// Past years: a "Years" tab on the game's Company statistics page.
var _DT_YEAR_ROW = 158;
var _DT_YEAR_FIRST = 2009;
var _DT_YEAR_COL = { CREATED: 0, SOLDED: 1, COST: 3, SELL: 4, RELEASE: 7, NAME: 8 };
// Consumer device arrays (CPU/GPU earnings rows and bundled gamepads are not devices on sale).
var _DT_YEAR_TYPES = [
  { arr: "ArraySmartphones", k: "phone" },
  { arr: "ArrayTablets", k: "tablet" },
  { arr: "ArrayLaptops", k: "laptop" },
  { arr: "ArrayWatches", k: "watch" },
  { arr: "ArrayHeadphones", k: "headphones" },
  { arr: "ArrayTV", k: "tv" },
  { arr: "ArrayScooters", k: "scooter" },
  { arr: "ArrayKeyboards", k: "keyboard" },
  { arr: "ArrayConsoles", k: "console" },
  { arr: "ArrayVRConsoles", k: "vr" },
];
var _DT_YEAR_TEXT = {
  title: { en: "{y} in review", ru: "Итоги {y} года" },
  full: { en: "{c} · 1 January to 31 December {y}", ru: "{c} · с 1 января по 31 декабря {y}" },
  partial: { en: "{c} · Partial year: recording started {d}", ru: "{c} · Неполный год: учёт с {d}" },
  partialMonths: { en: "{c} · Partial year: the game has records for {n} of 12 months", ru: "{c} · Неполный год: у игры есть данные за {n} из 12 мес." },
  partialNote: { en: "Devices, rank and share count from {d}. Revenue, profit, devices sold and fans are the game's own figures for the whole year.",
    ru: "Устройства, место и доля считаются с {d}. Выручка, прибыль, продажи и фанаты — данные игры за весь год." },
  partialNoteFans: { en: "Devices, rank, share and fans count from {d}. Revenue, profit and devices sold are the game's own figures for the whole year.",
    ru: "Устройства, место, доля и фанаты считаются с {d}. Выручка, прибыль и продажи — данные игры за весь год." },
  partialNoteY: { en: "Devices count from {d}. Revenue, profit, devices sold, rank and share are the game's own figures for the whole year.",
    ru: "Устройства считаются с {d}. Выручка, прибыль, продажи, место и доля — данные игры за весь год." },
  partialNoteYFans: { en: "Devices and fans count from {d}. Revenue, profit, devices sold, rank and share are the game's own figures for the whole year.",
    ru: "Устройства и фанаты считаются с {d}. Выручка, прибыль, продажи, место и доля — данные игры за весь год." },
  revenue: { en: "Revenue", ru: "Выручка" },
  profit: { en: "Profit", ru: "Прибыль" },
  units: { en: "Devices sold", ru: "Продано устройств" },
  fans: { en: "Fans gained", ru: "Новых фанатов" },
  rank: { en: "Rank among rivals", ru: "Место среди конкурентов" },
  share: { en: "Market share", ru: "Доля рынка" },
  best: { en: "Best device", ru: "Лучшее устройство" },
  worst: { en: "Weakest device", ru: "Слабейшее устройство" },
  types: { en: "Device revenue by type", ru: "Выручка по типам устройств" },
  vs: { en: "vs {y}", ru: "к {y}" },
  since: { en: "since {d}", ru: "с {d}" },
  noPrev: { en: "No {y} figures", ru: "Нет данных за {y}" },
  noSales: { en: "No sales in {y}", ru: "Продаж в {y} не было" },
  was: { en: "was {v}", ru: "было {v}" },
  same: { en: "Same as {y}", ru: "Как в {y}" },
  of: { en: "of {n}", ru: "из {n}" },
  pts: { en: "{s}{n} pts", ru: "{s}{n} п." },
  sold: { en: "{u} sold · {p} profit", ru: "Продано {u} · прибыль {p}" },
  none: { en: "No device sold this year", ru: "За год продаж не было" },
  oneDev: { en: "Only one device on sale", ru: "Продавалось одно устройство" },
  noTypes: { en: "No device sales recorded", ru: "Продаж устройств нет" },
  back: { en: "All years", ru: "Все годы" },
  tab: { en: "Years", ru: "Годы" },
  tabHead: { en: "Year in review", ru: "Итоги года" },
  tabSub: { en: "Tap a year to see its review", ru: "Нажмите на год, чтобы открыть итоги" },
  tabEmpty: { en: "A review of each year appears here on 1 January.", ru: "Итоги каждого года появятся здесь 1 января." },
  tabPart: { en: "partial", ru: "неполный" },
  phone: { en: "Phones", ru: "Телефоны" },
  tablet: { en: "Tablets", ru: "Планшеты" },
  laptop: { en: "Laptops", ru: "Ноутбуки" },
  watch: { en: "Watches", ru: "Часы" },
  headphones: { en: "Headphones", ru: "Наушники" },
  tv: { en: "TVs", ru: "Телевизоры" },
  scooter: { en: "Scooters", ru: "Самокаты" },
  keyboard: { en: "Keyboards", ru: "Клавиатуры" },
  console: { en: "Consoles", ru: "Консоли" },
  vr: { en: "VR headsets", ru: "VR-шлемы" },
};
// One device's type, as the Sales board tags it.
var _DT_YEAR_ONE = {
  phone: { en: "Phone", ru: "Телефон" }, tablet: { en: "Tablet", ru: "Планшет" }, laptop: { en: "Laptop", ru: "Ноутбук" },
  watch: { en: "Watch", ru: "Часы" }, headphones: { en: "Headphones", ru: "Наушники" }, tv: { en: "TV", ru: "ТВ" },
  scooter: { en: "Scooter", ru: "Самокат" }, keyboard: { en: "Keyboard", ru: "Клавиатура" }, console: { en: "Console", ru: "Консоль" },
  vr: { en: "VR headset", ru: "VR-шлем" },
};
var _DT_YEAR_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Pure rules (no game access; unit tested) ──
var _dtYearLogic = (function () {
  function blank(company, today, y, extra) {
    return { v: 1, company: company, last: -1, cur: null, years: [], pending: [], start: today, y0: y, extra: extra || null };
  }
  function parse(raw, company) {
    let s = null;
    try {
      s = raw && String(raw).charAt(0) === "{" ? JSON.parse(String(raw)) : null;
    } catch (e) {
      s = null;
    }
    if (!s || s.v !== 1 || s.company !== company || !Array.isArray(s.years)) return null;
    if (!Array.isArray(s.pending)) s.pending = [];
    return s;
  }
  function openYear(y, today, dateText, startOfYear, ctx) {
    return { y: y, from: today, fromD: dateText, full: !!startOfYear, seen: {}, dev: {}, ks: 2,
      rank0: ctx.rank, of0: ctx.of, share0: ctx.share, fans0: ctx.fans };
  }
  // Sums of the game's monthly history (ym = 12*year + month-1) for one year.
  function months(m, y) {
    const out = { rev: 0, prof: 0, un: 0, n: 0, fanEnd: null };
    if (!m || !Array.isArray(m.ym)) return out;
    for (let i = 0; i < m.ym.length; i++) {
      const ym = Number(m.ym[i]);
      if (Math.floor(ym / 12) !== y) continue;
      out.rev += Number(m.rev[i]) || 0;
      out.prof += Number(m.prof[i]) || 0;
      out.un += Number(m.un[i]) || 0;
      out.n++;
      out.fanEnd = Number(m.fan[i]) || 0; // pushed in date order: the last one is 31 December
    }
    return out;
  }
  // One game day: devices = [{key, name, k, sold, sell, cost}] read after the day's sales.
  // Returns the closed year's record when this day starts a new year.
  function day(s, today, date, devices, ctx, m) {
    let closed = null;
    if (s.last >= 0 && today < s.last) {
      // An older save of the same company: forget the years after it and start again.
      s.years = s.years.filter((r) => r.y < date.y);
      s.pending = s.pending.filter((y) => y < date.y);
      s.cur = null;
    }
    if (s.last === today) return null;
    if (s.cur && s.cur.ks !== 2) rekey(s.cur, devices);
    // The game's first stats day of a new campaign is 2 January (the date moves on before it), and
    // 1 January has no sales: a record opened by then has the whole year.
    const startOfYear = date.m === 1 && date.d <= 2;
    if (!s.cur) {
      s.cur = openYear(date.y, today, dateText(date), startOfYear, ctx);
    } else if (s.cur.y !== date.y) {
      closed = close(s, m, ctx);
      const seen = s.cur.seen;
      s.cur = openYear(date.y, today, dateText(date), date.y === closed.y + 1, ctx);
      s.cur.seen = seen;
      s.cur.seeded = true;
    }
    const c = s.cur;
    for (const d of devices) {
      const sold = Number(d.sold) || 0;
      const before = c.seen[d.key];
      c.seen[d.key] = sold;
      // First sighting of an edition: on the day recording begins it may have sold
      // for years, so it starts from its count; later it is new and had sold nothing.
      const base = before === undefined ? (!c.seeded && c.from === today ? sold : 0) : before;
      const u = sold - base;
      if (!(u > 0)) continue;
      const e = c.dev[d.key] || (c.dev[d.key] = [d.name, d.k, 0, 0, 0]);
      e[0] = d.name;
      e[2] += u;
      e[3] += u * (Number(d.sell) || 0);
      const margin = (Number(d.sell) || 0) - (Number(d.cost) || 0);
      e[4] += Math.round(u * (margin > 0 ? margin : 0));
    }
    s.last = today;
    return closed;
  }
  // Saves before keys were stable used the device's column, which moves when the game
  // adds a device at the front. Carry each device's year so far over by type and name,
  // and restart the counts from today (at most one day of sales is not counted).
  function rekey(c, devices) {
    const byName = {}, dev = {}, seen = {};
    for (const d of devices) {
      byName[d.k + "|" + d.name] = d.key;
      seen[d.key] = Number(d.sold) || 0;
    }
    for (const old in c.dev) {
      const e = c.dev[old], key = byName[e[1] + "|" + e[0]] || "old:" + old, t = dev[key];
      if (!t) dev[key] = e.slice();
      else for (let i = 2; i < 5; i++) t[i] += e[i];
    }
    c.dev = dev;
    c.seen = seen;
    c.ks = 2;
  }
  function dateText(date) {
    return date.d + " " + _DT_YEAR_MONTHS[(date.m - 1 + 12) % 12] + " " + date.y;
  }
  // The year's rank and market share: its revenue against each rival's yearly revenue (riv, $).
  function yearRank(rev, riv) {
    const r = Math.max(0, Number(rev) || 0);
    let rank = 1, tot = r;
    for (const v of riv) {
      if (v > r) rank++;
      if (v > 0) tot += v;
    }
    return { rank: rank, of: riv.length + 1, share: tot > 0 ? r / tot * 100 : 0 };
  }
  // Freeze the current year into a record (with the year before for the changes).
  function close(s, m, ctx) {
    const c = s.cur, y = c.y;
    const now = months(m, y), before = months(m, y - 1), before2 = months(m, y - 2);
    const prevRec = s.years.find((r) => r.y === y - 1) || null, prevFull = prevRec && !prevRec.partial ? prevRec : null;
    // The year before: the game's own months when it has all twelve, else our full record.
    const pv = (k) => (before.n >= 12 ? Math.round(before[k]) : prevFull ? prevFull[k] : null);
    // Rank and share by the year's revenue (rm 2); compared only with a year counted the same way.
    const yr = Array.isArray(ctx.riv) ? yearRank(now.rev, ctx.riv) : null, prevYr = prevRec && prevRec.rm === 2 ? prevRec : null;
    // Fans at 31 December of the year before, from the game's months; else the first recording day.
    const fansStart = before.fanEnd !== null ? before.fanEnd : c.fans0;
    const fansEnd = now.fanEnd !== null ? now.fanEnd : ctx.fans;
    const devs = Object.keys(c.dev).map((k) => c.dev[k]).filter((e) => e[2] > 0);
    devs.sort((a, b) => b[4] - a[4] || b[2] - a[2]);
    const pick = (e) => (e ? { n: e[0], k: e[1], u: Math.round(e[2]), p: Math.round(e[4]) } : null);
    const types = {};
    let typeTot = 0;
    for (const e of devs) {
      types[e[1]] = (types[e[1]] || 0) + e[3];
      typeTot += e[3];
    }
    for (const k of Object.keys(types)) types[k] = Math.round(types[k]);
    const rec = {
      y: y, partial: !c.full || now.n < 12, full: !!c.full, fromD: c.fromD, months: now.n, fansPart: before.fanEnd === null && !c.full,
      rev: Math.round(now.rev), prof: Math.round(now.prof), un: Math.round(now.un), fans: Math.round(fansEnd - fansStart),
      rank: yr ? yr.rank : ctx.rank, of: yr ? yr.of : ctx.of, rank0: yr ? (prevYr && prevYr.rev > 0 ? prevYr.rank : 0) : c.rank0,
      share: round(yr ? yr.share : ctx.share, 4), share0: yr ? (prevYr && prevYr.rev > 0 ? prevYr.share : null) : round(c.share0, 2), rm: yr ? 2 : 1,
      best: pick(devs[0]), worst: devs.length > 1 ? pick(devs[devs.length - 1]) : null,
      types: types, typeTot: Math.round(typeTot),
      pv: {
        rev: pv("rev"), prof: pv("prof"), un: pv("un"),
        fans: before.n >= 12 && before2.n > 0 ? Math.round(before.fanEnd - before2.fanEnd) : prevFull ? prevFull.fans : null,
        types: prevRec ? prevRec.types : null, typeTot: prevRec ? prevRec.typeTot : null,
      },
    };
    s.years = s.years.filter((r) => r.y !== y).concat([rec]).sort((a, b) => a.y - b.y);
    if (y + 1 >= _DT_YEAR_FIRST && s.pending.indexOf(y) < 0) s.pending.push(y);
    return rec;
  }
  function round(v, d) {
    const p = Math.pow(10, d || 0);
    return Math.round((Number(v) || 0) * p) / p;
  }
  // Percentage change; null when the year before has nothing to compare with.
  function pct(now, prev) {
    if (prev === null || prev === undefined || !isFinite(prev) || prev <= 0) return null;
    return ((Number(now) || 0) - prev) / prev * 100;
  }
  // A market share as text; a tiny but real share reads "<0.01%", not "0.00%".
  function shareText(v, rev) {
    const n = Number(v) || 0;
    return n >= 0.005 ? n.toFixed(2) + "%" : n > 0 || rev > 0 ? "<0.01%" : "0.00%";
  }
  function pctText(p) {
    if (p === null) return "";
    const a = Math.abs(p), s = p > 0 ? "+" : p < 0 ? "-" : "";
    return s + (a >= 100 ? Math.round(a).toLocaleString("en-US") : a.toFixed(a < 10 ? 1 : 0)) + "%";
  }
  // The stats page's own number and money formats (_fmtNum8 / _fmtMoney9).
  function num(v, d) {
    const n = Number(v) || 0, a = Math.abs(n), f = d === undefined ? 1 : d;
    return a >= 1e12 ? (n / 1e12).toFixed(f) + "T" : a >= 1e9 ? (n / 1e9).toFixed(f) + "B" : a >= 1e6 ? (n / 1e6).toFixed(f) + "M" :
      a >= 1e3 ? (n / 1e3).toFixed(f) + "K" : String(Math.round(n));
  }
  function money(v) {
    const n = Number(v) || 0;
    return (n < 0 ? "-$" : "$") + num(Math.abs(n));
  }
  function signed(v, fmt) {
    const n = Number(v) || 0;
    return (n > 0 ? "+" : "") + (fmt ? fmt(n) : num(n));
  }
  // Each type's share of the year's device revenue (%), biggest first.
  function typeShares(rec) {
    const tot = rec.typeTot || 0, pt = rec.pv && rec.pv.types, ptot = rec.pv && rec.pv.typeTot;
    if (!(tot > 0)) return [];
    return Object.keys(rec.types).map((k) => {
      const share = rec.types[k] / tot * 100;
      const prev = pt && ptot > 0 ? (pt[k] || 0) / ptot * 100 : null;
      return { k: k, share: share, diff: prev === null ? null : share - prev };
    }).sort((a, b) => b.share - a.share);
  }
  return { blank, parse, months, day, close, pct, pctText, shareText, num, money, signed, typeShares, dateText, round };
})();

var _dtYear = { tick: 0, free: 0, held: 0, view: null, timer: 0, tabWired: false, idleRaw: null, idleCo: null, detail: null, go: null, prevTab: null, fails: {} };

function _dtYearT(k, vars) {
  return _dtUi.t(_DT_YEAR_TEXT[k], vars);
}
function _dtYearRt() {
  return globalThis.runtime || null;
}
function _dtYearArr(name) {
  try {
    const o = _dtYearRt().objects[name];
    return o ? o.getFirstInstance() : null;
  } catch (e) {
    return null;
  }
}
function _dtYearCompany() {
  return String(_dtUi.gv("CompanyName", "") || "");
}
function _dtYearSlot() {
  return Math.max(0, Math.round(_dtUi.num("SaveSlot", 0)));
}
// The saved year row as stored, or null while there is no row to read.
function _dtYearRaw() {
  const a = _dtYearArr("ArraySaves"), slot = _dtYearSlot();
  if (!a || a.height <= _DT_YEAR_ROW || a.width <= slot) return null;
  let raw = "";
  try { raw = a.getAt(slot, _DT_YEAR_ROW, 0); } catch (e) {}
  return raw;
}
function _dtYearLoad() {
  const raw = _dtYearRaw();
  return raw === null ? null : _dtYearLogic.parse(raw, _dtYearCompany());
}
function _dtYearSave(s) {
  const a = _dtYearArr("ArraySaves"), slot = _dtYearSlot();
  if (!a || a.height <= _DT_YEAR_ROW || a.width <= slot) return false;
  try {
    a.setAt(JSON.stringify(s), slot, _DT_YEAR_ROW, 0);
    return true;
  } catch (e) {
    return false;
  }
}
// Every released edition with its SOLDED, price and unit cost right now.
function _dtYearDevices() {
  const C = _DT_YEAR_COL, out = [];
  for (const t of _DT_YEAR_TYPES) {
    const a = _dtYearArr(t.arr);
    if (!a || (a.depth | 0) <= C.NAME) continue;
    const w = a.width | 0, h = Math.min(3, a.height | 0);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        if (a.getAt(x, y, C.CREATED) === -1) continue;
        if (!(Number(a.getAt(x, y, C.RELEASE)) >= 0)) continue;
        // The key must not use x: the game adds new devices at the front, moving the rest.
        const name = String(a.getAt(x, y, C.NAME) || "");
        out.push({ key: t.arr + ":" + y + ":" + a.getAt(x, y, C.RELEASE) + ":" + name, name: name, k: t.k,
          sold: Number(a.getAt(x, y, C.SOLDED)) || 0, sell: Number(a.getAt(x, y, C.SELL)) || 0, cost: Number(a.getAt(x, y, C.COST)) || 0 });
      }
    }
  }
  return out;
}
// Rank, rival count and market share as the stats Market tab reads them, and each rival's
// yearly revenue in $ (riv) for the year's own rank.
function _dtYearCtx() {
  let r = { rank: 0, companies: 0, share: 0 }, riv = null;
  try { r = _readRatings(); } catch (e) {}
  try { riv = _scanCompanies().rows.filter((c) => !c.isPlayer).map((c) => (Number(c.earn) || 0) * 1e9); } catch (e) {}
  return { rank: r.rank || 0, of: r.companies || 0, share: Number(r.share) || 0, fans: _dtUi.num("Fans", 0), riv: riv };
}
function _dtYearMonthly() {
  try { return _loadState().m; } catch (e) { return null; }
}
// Runs once per game day from the wrapped tickCompanyStatsDay, before the game's
// own stats day (which may autosave): the row is current in every save.
function _dtYearDay() {
  const today = _dtUi.num("DayTotal", 0);
  const date = { y: _dtUi.num("Year", 2008), m: _dtUi.num("Month", 1), d: _dtUi.num("Day", 1) };
  const s = _dtYearLoad() || _dtYearLogic.blank(_dtYearCompany(), today, date.y);
  if (s.last === today) return null;
  const closed = _dtYearLogic.day(s, today, date, _dtYearDevices(), _dtYearCtx(), _dtYearMonthly());
  _dtYearSave(s);
  return closed;
}
var _dtYearWasTick = tickCompanyStatsDay;
tickCompanyStatsDay = (function (orig) {
  return function (e) {
    try {
      if (e && !globalThis.runtime) globalThis.runtime = e;
      _dtYearDay();
    } catch (err) {
      console.warn("[Year] day:", err);
    }
    return orig.apply(this, arguments);
  };
})(tickCompanyStatsDay);
if (globalThis.tickCompanyStatsDay === _dtYearWasTick) globalThis.tickCompanyStatsDay = tickCompanyStatsDay;

// ── When the screen is free ──
function _dtYearAssistantQueued() {
  const a = _dtYearArr("ArrayGameAssistant");
  try { return !!a && (a.width | 0) > 0; } catch (e) { return false; }
}
function _dtYearEventBusy() {
  try {
    const api = globalThis._dtEventApi;
    if (!api) return false;
    if (api.run && api.run()) return true;
    const st = api.state && api.state();
    const today = _dtUi.num("DayTotal", 0);
    return !!(st && Array.isArray(st.events) && st.events.some((ev) => ev.day <= today));
  } catch (e) {
    return false;
  }
}
function _dtYearFreeNow() {
  const rt = _dtYearRt();
  if (!rt || !_dtUi.onOffice() || _dtUi.isOpen()) return false;
  try {
    if (_container100 && _container100.isConnected && _container100.querySelector("#stats-root")) return false;
  } catch (e) {}
  const gv = rt.globalVars;
  if (String(gv.class || "") !== "GAMEPLAY") return false;
  if (String(gv.Assistant || "OFF") !== "OFF" || _dtYearAssistantQueued()) return false;
  if (String(gv.CreateDevicesUI || "OFF") !== "OFF") return false;
  if (Number(gv.GameplayPause || 0) !== 0) return false;
  if (globalThis._dtLaunchPending === true || _dtYearEventBusy()) return false;
  return true;
}

// ── Card ──
var _DT_YEAR_CSS = `
/* A year's review inside the game's Company statistics page: its own panels, tiles (.st-kpi) and bars (.st-item). */
.dty-top { display: flex; align-items: center; gap: calc(var(--st, 1) * 14px); margin-bottom: calc(var(--st, 1) * 12px); }
.dty-top .st-tab { flex: 0 0 auto; gap: calc(var(--st, 1) * 6px); }
.dty-top .st-tab svg { width: calc(var(--st, 1) * 18px); height: calc(var(--st, 1) * 18px); }
.dty-title { font-size: calc(var(--st, 1) * 30px); line-height: 1.1; }
.dty-sub { margin-top: calc(var(--st, 1) * 4px); font-size: calc(var(--st, 1) * 18px); color: rgba(255, 255, 255, 0.55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dty-sub.dty-part { color: var(--st-c4); }
.dty-kpis { margin-bottom: calc(var(--st, 1) * 12px); }
.dty-kpis .st-kpi-value, .dty-devs .st-kpi-value { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.dty-kpis .st-kpi-value small, .dty-devs .st-kpi-value small { font-size: 0.55em; color: rgba(255, 255, 255, 0.55); margin-left: calc(var(--st, 1) * 8px); text-shadow: none; }
.dty-kpis .st-kpi-sub b, .dty-devs .st-kpi-sub b { font-weight: normal; margin-right: calc(var(--st, 1) * 5px); }
.dty-types .st-item-cat { margin-left: auto; }
.dty-types .st-item-val { margin-left: 0; min-width: calc(var(--st, 1) * 70px); text-align: right; }
.dty-muted { color: rgba(255, 255, 255, 0.5); }
.dty-note { margin: calc(var(--st, 1) * 4px) 0 calc(var(--st, 1) * 12px); text-align: center; font-size: calc(var(--st, 1) * 17px); color: rgba(255, 255, 255, 0.5); }
/* Years tab on the game's Company statistics page (uses the page's own --st scale). */
.dty-yr { display: grid; grid-template-columns: calc(var(--st, 1) * 110px) repeat(5, minmax(0, 1fr)) calc(var(--st, 1) * 24px);
  align-items: center; column-gap: calc(var(--st, 1) * 12px); padding: calc(var(--st, 1) * 8px) calc(var(--st, 1) * 14px);
  margin-top: calc(var(--st, 1) * 6px); border-radius: calc(var(--st, 1) * 10px); cursor: pointer;
  background: rgba(255, 255, 255, 0.04); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
  font-size: calc(var(--st, 1) * 21px); color: rgba(255, 255, 255, 0.88); font-variant-numeric: tabular-nums;
  transition: background-color 0.14s ease, box-shadow 0.14s ease; }
.dty-yr:hover { background-color: rgba(255, 255, 255, 0.08); box-shadow: inset 0 0 0 1px rgba(0, 229, 255, 0.55); }
.dty-yr > span { text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dty-yr > span:first-child { text-align: left; font-size: calc(var(--st, 1) * 26px); color: #fff; }
.dty-yr small { display: block; font-size: calc(var(--st, 1) * 17px); color: var(--st-c4); line-height: 1; }
.dty-yr-head { cursor: default; background: none; box-shadow: none; font-size: calc(var(--st, 1) * 21px); letter-spacing: calc(var(--st, 1) * 0.8px);
  text-transform: uppercase; color: rgba(255, 255, 255, 0.55); padding-top: 0; padding-bottom: 0; }
.dty-yr-head:hover { background: none; box-shadow: none; }
.dty-yr-head > span:first-child { font-size: calc(var(--st, 1) * 21px); color: rgba(255, 255, 255, 0.55); }
.dty-yr svg { width: calc(var(--st, 1) * 20px); height: calc(var(--st, 1) * 20px); opacity: 0.6; }
`;
function _dtYearCss() {
  if (typeof document === "undefined" || document.getElementById("dt-year-css")) return;
  const st = document.createElement("style");
  st.id = "dt-year-css";
  st.textContent = _DT_YEAR_CSS;
  document.head.appendChild(st);
}
function _dtYearEsc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
// "+12% vs 2013" in green/red, or a plain note when there is nothing to compare.
// A year below zero (a loss after a profit) shows the difference itself: "-371%" says nothing.
function _dtYearChange(now, prev, y, fmt) {
  const L = _dtYearLogic, vs = _dtYearT("vs", { y: y - 1 });
  if (prev === null || prev === undefined) return '<span class="dty-muted">' + _dtYearEsc(_dtYearT("noPrev", { y: y - 1 })) + "</span>";
  if (now === prev) return '<span class="dty-muted">' + _dtYearEsc(_dtYearT("same", { y: y - 1 })) + "</span>";
  const p = now < 0 ? null : L.pct(now, prev);
  if (p === null) {
    const cls = now > prev ? "st-up" : now < prev ? "st-down" : "";
    return '<b class="' + cls + '">' + _dtYearEsc(_dtYearArrow(cls, L.signed(now - prev, fmt))) + "</b>" + _dtYearEsc(vs);
  }
  const cls = p > 0.05 ? "st-up" : p < -0.05 ? "st-down" : "";
  return '<b class="' + cls + '">' + _dtYearEsc(_dtYearArrow(cls, L.pctText(p))) + "</b>" + _dtYearEsc(vs);
}
// Up/down also shown by an arrow and a real minus sign, not by colour alone.
function _dtYearArrow(cls, text) {
  text = String(text).replace(/^-/, "\u2212");
  return cls === "st-up" ? "\u25B2 " + text : cls === "st-down" ? "\u25BC " + text : text;
}
// One tile in the page's own KPI look (coloured bar on the left, label, value, change).
function _dtYearTile(label, value, change, acc, i) {
  return '<div class="st-kpi" style="--acc:' + acc + ";--i:" + i + '">' +
    '<div class="st-kpi-label">' + _dtYearEsc(label) + '</div><div class="st-kpi-value">' + value + '</div><div class="st-kpi-sub">' + change + "</div></div>";
}
function _dtYearCardHtml(rec) {
  const L = _dtYearLogic, y = rec.y, pv = rec.pv || {};
  const company = _dtYearCompany();
  // Recorded from 1 January (rank, share and devices cover the whole year) or from a later day.
  const late = rec.full === undefined ? rec.partial : !rec.full;
  let html = '<div class="dty-top"><div class="st-tab dty-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>' +
    _dtYearEsc(_dtYearT("back")) + '</div><div><div class="dty-title">' + _dtYearEsc(_dtYearT("title", { y: y })) + '</div><div class="dty-sub' + (rec.partial ? " dty-part" : "") + '">' +
    _dtYearEsc(!rec.partial ? _dtYearT("full", { c: company, y: y }) : late ? _dtYearT("partial", { c: company, d: rec.fromD })
      : _dtYearT("partialMonths", { c: company, n: rec.months })) + "</div></div></div>";
  // Rank: a lower number is better. Counted by the year's revenue (rm 2) it compares with the year before.
  const rLate = late && rec.rm !== 2;
  // A year before with no sales has no rank or share worth comparing with.
  const noSales = pv.rev === 0, none = '<span class="dty-muted">' + _dtYearEsc(_dtYearT(noSales ? "noSales" : "noPrev", { y: y - 1 })) + "</span>";
  let rankChg = none;
  const r0 = rec.rank0 > 0 && !noSales ? rec.rank0 : null;
  if (rec.rank > 0 && r0) {
    const d = r0 - rec.rank, since = rLate ? _dtYearT("since", { d: rec.fromD }) : _dtYearT("vs", { y: y - 1 });
    rankChg = d === 0 ? '<span class="dty-muted">' + _dtYearEsc(_dtYearT("same", { y: rLate ? rec.fromD : y - 1 })) + "</span>"
      : '<b class="' + (d > 0 ? "st-up" : "st-down") + '">' + (d > 0 ? "▲" : "▼") + Math.abs(d) + "</b>" + _dtYearEsc(since);
  }
  let shareChg = none;
  if (rec.share0 !== null && rec.share0 !== undefined && r0) {
    const d = L.round(rec.share - rec.share0, 2);
    shareChg = d === 0 ? '<span class="dty-muted">' + _dtYearEsc(_dtYearT("same", { y: rLate ? rec.fromD : y - 1 })) + "</span>" : '<b class="' + (d > 0 ? "st-up" : d < 0 ? "st-down" : "") + '">' +
      _dtYearEsc(_dtYearT("pts", { s: d > 0 ? "+" : d < 0 ? "-" : "", n: Math.abs(d).toFixed(2) })) + "</b>" +
      _dtYearEsc(rLate ? _dtYearT("since", { d: rec.fromD }) : _dtYearT("vs", { y: y - 1 }));
  }
  html += '<div class="st-row st-row-3 dty-kpis">' +
    _dtYearTile(_dtYearT("revenue"), _dtYearEsc(L.money(rec.rev)), _dtYearChange(rec.rev, pv.rev, y, L.money), "#00E5FF", 0) +
    _dtYearTile(_dtYearT("profit"), _dtYearEsc(L.money(rec.prof)), _dtYearChange(rec.prof, pv.prof, y, L.money), rec.prof >= 0 ? "#7CFF4F" : "#FF5A6E", 1) +
    _dtYearTile(_dtYearT("units"), _dtYearEsc(L.num(rec.un)), _dtYearChange(rec.un, pv.un, y), "#A855F7", 2) +
    _dtYearTile(_dtYearT("fans"), _dtYearEsc(L.signed(rec.fans)), _dtYearChange(rec.fans, pv.fans, y), "#FF2FB9", 3) +
    _dtYearTile(_dtYearT("rank"), rec.rank > 0 ? "#" + rec.rank + "<small>" + _dtYearEsc(_dtYearT("of", { n: rec.of })) + "</small>" : "—", rankChg, "#FFB020", 4) +
    _dtYearTile(_dtYearT("share"), _dtYearEsc(L.shareText(rec.share, rec.rev)), shareChg, "#00E5FF", 5) +
    "</div>";
  const dev = (d, empty) => d
    ? _dtYearEsc(d.n) + "<small>" + _dtYearEsc(_dtUi.t(_DT_YEAR_ONE[d.k] || { en: "" })) + "</small>"
    : '<span class="dty-muted">' + _dtYearEsc(empty) + "</span>";
  const devSub = (d) => d ? _dtYearEsc(_dtYearT("sold", { u: L.num(d.u), p: L.money(d.p) })) : "&nbsp;";
  html += '<div class="st-row st-row-2 dty-devs">' +
    _dtYearTile(_dtYearT("best"), dev(rec.best, _dtYearT("none")), devSub(rec.best), "#7CFF4F", 6) +
    _dtYearTile(_dtYearT("worst"), dev(rec.worst, rec.best ? _dtYearT("oneDev") : _dtYearT("none")), devSub(rec.worst), "#FF2FB9", 7) +
    "</div>";
  const shares = L.typeShares(rec);
  // Revenue by type as the page's "Top devices" bars: name, change, share, bar.
  html += '<div class="st-panel dty-types" style="--i:8"><div class="st-panel-head"><span class="st-panel-title">' + _dtYearEsc(_dtYearT("types")) +
    '</span><span class="st-panel-sub">' + _dtYearEsc(_dtYearT("vs", { y: y - 1 })) + '</span></div><div class="st-list">';
  if (!shares.length) html += '<div class="st-panel-sub">' + _dtYearEsc(_dtYearT("noTypes")) + "</div>";
  shares.forEach((t, i) => {
    const d = t.diff === null ? "—"
      : '<span class="' + (t.diff > 0.05 ? "st-up" : t.diff < -0.05 ? "st-down" : "") + '">' +
        _dtYearEsc(_dtYearT("pts", { s: t.diff > 0.05 ? "+" : t.diff < -0.05 ? "-" : "", n: Math.abs(t.diff).toFixed(1) })) + "</span>";
    html += '<div class="st-item"><div class="st-item-top"><span class="st-item-name">' + _dtYearEsc(_dtYearT(t.k)) + '</span><span class="st-item-cat">' + d +
      '</span><span class="st-item-val">' + _dtYearEsc(t.share.toFixed(1) + "%") + '</span></div><div class="st-track"><div class="st-fill" style="--i:' + i +
      ";width:" + Math.max(1.5, t.share).toFixed(1) + '%"></div></div></div>';
  });
  html += "</div></div>";
  if (late) html += '<div class="dty-note">' + _dtYearEsc(_dtYearT((rec.rm === 2 ? "partialNoteY" : "partialNote") + (rec.fansPart ? "Fans" : ""), { d: rec.fromD })) + "</div>";
  return html;
}
// A year's review lives in the game's Company statistics page, Years tab. From the
// office (1 January) the page opens the way its toolbar button does (back with ESC);
// on the page it just shows the year.
function _dtYearOpen(y) {
  const s = _dtYearLoad();
  const rec = s && s.years.find((r) => r.y === y);
  if (!rec) return false;
  if (_dtYearShow(y)) {
    _dtYearSeen(y);
    return true;
  }
  const rt = _dtYearRt();
  if (!rt || _dtUi.isOpen()) return false;
  const g = rt.globalVars;
  // The page remembers its tab; the next visit goes back to the player's own.
  _dtYear.prevTab = _tab;
  g.LastClass = "GAMEPLAY";
  g.class = "STATS";
  let from = "";
  try { from = rt.layout.name; } catch (e) {}
  _dtYear.go = { y: y, at: Date.now(), from: from };
  _dtYear.view = { y: y };
  rt.goToLayout("STATS");
  return true;
}
// The stats page is up: Years tab with year y (null: the list).
function _dtYearShow(y) {
  let root = null;
  try { root = _container100 && _container100.isConnected ? _container100.querySelector("#stats-root") : null; } catch (e) {}
  if (!root || typeof _renderBody2 !== "function") return false;
  _dtYear.detail = y;
  _tab = "years";
  _renderBody2();
  return true;
}
// The year's card was shown: it is no longer waiting.
function _dtYearSeen(y) {
  const s = _dtYearLoad();
  if (!s || s.pending.indexOf(y) < 0) return;
  s.pending = s.pending.filter((v) => v !== y);
  _dtYearSave(s);
}
// Finish a 1 January jump once the page has built itself. A slow page (or a hidden
// tab) is waited for up to a minute while the jump is still on its way to the stats
// page; otherwise it is given up after 8 s and the year stays waiting (tried once
// more, then dropped).
function _dtYearGo() {
  const go = _dtYear.go;
  if (!go) return;
  if (_dtYearShow(go.y)) {
    _dtYearSeen(go.y);
  } else {
    let lay = "";
    try { lay = _dtYearRt().layout.name; } catch (e) {}
    const age = Date.now() - go.at;
    if (age <= 8000 || ((lay === "STATS" || lay === go.from) && age <= 60000)) return;
    if ((_dtYear.fails[go.y] = (_dtYear.fails[go.y] || 0) + 1) >= 2) _dtYearSeen(go.y);
  }
  _dtYear.go = null;
  _dtYear.view = null;
}
// A game news pop-up (#office-notifications) is on screen.
function _dtYearPopups() {
  try {
    const host = globalThis.document && globalThis.document.getElementById("office-notifications");
    return !!host && Array.prototype.some.call(host.children, (c) => c.getBoundingClientRect().width > 0);
  } catch (e) { return false; }
}
// ArraySaves survives a New Game: a new campaign in a used slot (even with the same company
// name) starts with no years of the old one.
function _dtYearNewGame() {
  const rt = _dtYearRt();
  if (!rt || !rt.globalVars || String(rt.layout && rt.layout.name) !== "LOADING GAME") return;
  if (String(rt.globalVars.LoadingType || "").toUpperCase() !== "NEW GAME") return;
  const a = _dtYearArr("ArraySaves"), slot = _dtYearSlot();
  try {
    const v = a && a.height > _DT_YEAR_ROW && a.width > slot ? a.getAt(slot, _DT_YEAR_ROW, 0) : "";
    if (v !== "" && v !== 0) a.setAt("", slot, _DT_YEAR_ROW, 0);
  } catch (e) {}
  _dtYear.idleRaw = null;
  _dtYear.idleCo = null;
}
// The 1 January card: the oldest unseen year, once the screen has been free for a second.
function _dtYearPump() {
  _dtYearNewGame();
  _dtYearGo();
  if (_dtYear.view) return;
  if (!_dtYearFreeNow()) {
    _dtYear.free = 0;
    return;
  }
  if (++_dtYear.free < 4) return;
  // The row grows every year played and was parsed 4 times a second on the office.
  // The same text for the same company parses the same way, so once it had no year
  // waiting it is not parsed again until it changes.
  const raw = _dtYearRaw(), co = _dtYearCompany();
  if (raw !== null && raw === _dtYear.idleRaw && co === _dtYear.idleCo) return;
  const s = raw === null ? null : _dtYearLogic.parse(raw, co);
  if (!s || !s.pending.length) {
    if (raw !== null) { _dtYear.idleRaw = raw; _dtYear.idleCo = co; }
    return;
  }
  // The game's small news pop-ups (bottom right) fade out while a panel is open, but they come almost daily
  // while engineers build a batch: give them 2 s at most, so the card still opens in early January.
  if (_dtYearPopups() && _dtYear.held++ < 8) return;
  _dtYear.held = 0;
  const y = s.pending.slice().sort((a, b) => a - b)[0];
  // Taken off the waiting list once its card is shown (_dtYearSeen), so a page that never came up is tried again.
  if (!s.years.some((r) => r.y === y) || !_dtYearOpen(y)) _dtYearSeen(y);
}
// ── "Years" tab on the Company statistics page ──
function _dtYearTabHtml() {
  const s = _dtYearLoad(), L = _dtYearLogic;
  const years = s ? s.years.slice().sort((a, b) => b.y - a.y) : [];
  let html = '<div class="st-panel" style="--i:0"><div class="st-panel-head"><span class="st-panel-title">' + _dtYearEsc(_dtYearT("tabHead")) +
    '</span><span class="st-panel-sub">' + _dtYearEsc(years.length ? _dtYearT("tabSub") : "") + "</span></div>";
  if (!years.length) return html + '<div class="st-empty">' + _dtYearEsc(_dtYearT("tabEmpty")) + "</div></div>";
  html += '<div class="dty-yr dty-yr-head"><span></span><span>' + ["revenue", "profit", "units", "fans", "rank"].map((k) => _dtYearEsc(_dtYearT(k))).join("</span><span>") + "</span><span></span></div>";
  for (const r of years) {
    html += '<div class="dty-yr" data-y="' + r.y + '"><span>' + r.y + (r.partial ? "<small>" + _dtYearEsc(_dtYearT("tabPart")) + "</small>" : "") + "</span>" +
      "<span>" + _dtYearEsc(L.money(r.rev)) + "</span><span>" + _dtYearEsc(L.money(r.prof)) + "</span><span>" + _dtYearEsc(L.num(r.un)) + "</span>" +
      "<span>" + _dtYearEsc(L.signed(r.fans)) + "</span><span>" + (r.rank > 0 ? "#" + r.rank : "—") + "</span>" +
      '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></span></div>';
  }
  return html + "</div>";
}
function _dtYearTabLabel() {
  try {
    const t = _container100 && _container100.querySelector('.st-tab[data-tab="years"]');
    if (t) t.textContent = _dtYearT("tab");
  } catch (e) {}
}
function _dtYearWireTab() {
  if (_dtYear.tabWired) return;
  _dtYear.tabWired = true;
  if (!_TAB_LIST.some((t) => t[0] === "years")) _TAB_LIST.push(["years", "tabYears"]);
  _renderBody2 = (function (orig) {
    return function (opts) {
      if (_tab !== "years") return orig.apply(this, arguments);
      const root = _container100 && _container100.querySelector("#stats-root"), body = root && root.querySelector("#st-body");
      if (!root || !body) return;
      _dtYearCss();
      root.classList.toggle("st-no-entry", !!(opts && opts.noEntry));
      _chartData = {};
      const top = body.scrollTop;
      const s = _dtYear.detail ? _dtYearLoad() : null;
      const rec = s && s.years.find((r) => r.y === _dtYear.detail);
      if (!rec) _dtYear.detail = null;
      body.innerHTML = rec ? _dtYearCardHtml(rec) : _dtYearTabHtml();
      body.scrollTop = opts && opts.noEntry ? top : 0;
      // Picking any tab (Years too) starts from the list again.
      if (!root._dtYearTabs) {
        root._dtYearTabs = true;
        root.addEventListener("click", (ev) => {
          if (ev.target && ev.target.closest && ev.target.closest(".st-tab[data-tab]")) _dtYear.detail = null;
        }, true);
      }
      for (const t of root.querySelectorAll(".st-tab")) t.classList.toggle("st-active", t.dataset.tab === _tab);
      if (!body._dtYearClick) {
        body._dtYearClick = true;
        body.addEventListener("click", (ev) => {
          if (_tab !== "years" || !ev.target || !ev.target.closest) return;
          const back = ev.target.closest(".dty-back");
          const row = back ? null : ev.target.closest(".dty-yr[data-y]");
          if (!back && !row) return;
          ev.stopPropagation();
          try { globalThis.tapMain && globalThis.tapMain(); } catch (e) {}
          _dtYearShow(back ? null : Number(row.dataset.y));
        });
      }
    };
  })(_renderBody2);
  const wasInit = initStatsPage, wasUpdate = updateStatsPage;
  initStatsPage = (function (orig) {
    return function () {
      // A later visit (not the 1 January jump) starts from the player's own tab, not the year's card.
      if (!_dtYear.go) {
        _dtYear.detail = null;
        if (_dtYear.prevTab) _tab = _dtYear.prevTab;
        _dtYear.prevTab = null;
      }
      const r = orig.apply(this, arguments);
      _dtYearTabLabel();
      return r;
    };
  })(initStatsPage);
  updateStatsPage = (function (orig) {
    return function () {
      const r = orig.apply(this, arguments);
      _dtYearTabLabel();
      return r;
    };
  })(updateStatsPage);
  // The game also exports both; keep those pointing at the same functions.
  if (globalThis.initStatsPage === wasInit) globalThis.initStatsPage = initStatsPage;
  if (globalThis.updateStatsPage === wasUpdate) globalThis.updateStatsPage = updateStatsPage;
}

(function () {
  globalThis._dtYearApi = {
    logic: _dtYearLogic, load: _dtYearLoad, save: _dtYearSave, devices: _dtYearDevices, ctx: _dtYearCtx, day: _dtYearDay,
    open: _dtYearOpen, free: _dtYearFreeNow, pump: _dtYearPump, row: _DT_YEAR_ROW, state: () => _dtYear,
  };
  try { _dtYearWireTab(); } catch (e) { console.warn("[Year] tab:", e); }
  if (_dtYear.timer || typeof document === "undefined") return;
  // The shared mod timer (ui.js every) when ui.js is in; a timer of our own without it.
  _dtYear.timer = (typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(() => {
    try { _dtYearPump(); } catch (e) {}
  }, 250);
})();
