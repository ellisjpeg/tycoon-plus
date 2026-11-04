// ── Rivals engine (DEVICES_TYCOON_RIVALS) ──
// Runs the pure core (_dtRivCore, rivals-core.js) inside the game:
// - Once per game day, at the start of tickDeviceSales, every rival launch
//   planned for (last processed day, DayTotal] is picked from the part lists as
//   the runtime arrays hold them on the active preset (real.js has moved the
//   phone dates on non-Original presets), in day order, so day jumps process
//   every missed day.
// - A live launch that beats what rivals sold when a player device of that type
//   came out adds a small extra POP loss to that device for 56 days (core hit /
//   decay caps: 0.6 a day, 20 in total per device), applied once per DayTotal
//   after the game's own tick. Stopped and ended devices (POP 0) are untouched.
// - Original (all difficulty sliders 1) is off: no launches, no effect, and the
//   saved data stays as it was. Switching to another preset starts rivals that
//   day; the launches missed meanwhile are filled in silently.
// State per company in ArraySaves row 157 ({v, company, seed, last, fx, log,
// hits, used}); launch days come from the seed, rows of the last 36 months are
// frozen in the log, older launches are replayed from the tables on load.
// Read API for the UI: globalThis._dtRivApi.
var _DT_RIV_ROW = 157;
var _DT_RIV_LOG_DAYS = 1095; // 36 game months kept in the save
var _DT_RIV_STALE_DAYS = 31; // first tick after a load: a longer gap is filled in silently
var _DT_RIV_COL = { CREATED: 0, POP: 2, RATING: 5, RELEASE: 7, NAME: 8, ID: 10 };
// Core type -> the player's device array and how many editions (rows) it uses (as Sell).
var _DT_RIV_ARRS = {
  phone: ["ArraySmartphones", 3], laptop: ["ArrayLaptops", 2], tablet: ["ArrayTablets", 2],
  headphones: ["ArrayHeadphones", 1], watch: ["ArrayWatches", 2], tv: ["ArrayTV", 1],
  scooter: ["ArrayScooters", 1], keyboard: ["ArrayKeyboards", 1], console: ["ArrayConsoles", 1], vr: ["ArrayVRConsoles", 1],
};
// Core type -> the device column holding the player's part row for each headline
// spec (TYPES[type].specs order; 278 LOADING EDITOR SetXYZ). null = not mapped:
// that spec is compared with the rival market only.
var _DT_RIV_OWN = {
  phone: [14, 20, 58, 60, 68], tablet: [12, 14, 58, 60], laptop: [27, 39, 44, 14], watch: [14, 40, 35, 26],
  headphones: [34, 35, 32], tv: [116, 12, 117], scooter: [83, 88, 37], keyboard: [23, 25, 30],
  console: [null, 45, 48, 34], vr: [79, 81, 44],
};

var _dtRiv = {
  slot: -1, company: "", raw: null, s: null, // parsed row (null = none yet)
  hist: null, histSig: "", prev: {}, tabs: null, tabSig: "", plans: new Map(), act: null,
  wasOn: null, subs: [], wrapped: false,
};

function _dtRivRt() {
  return globalThis.runtime || null;
}
function _dtRivArr(name) {
  try {
    const o = _dtRivRt().objects[name];
    return o ? o.getFirstInstance() : null;
  } catch (e) {
    return null;
  }
}
function _dtRivGv(name, d) {
  try {
    const v = _dtRivRt().globalVars[name];
    return v === undefined || v === null ? d : v;
  } catch (e) {
    return d;
  }
}
function _dtRivToday() {
  const n = Number(_dtRivGv("DayTotal", 0));
  return Number.isFinite(n) ? Math.floor(n) : 0;
}
function _dtRivSlot() {
  return Math.max(0, Math.min(2, Math.round(Number(_dtRivGv("SaveSlot", 0))) || 0));
}
function _dtRivCompany() {
  return String(_dtRivGv("CompanyName", "") || "");
}

// ── Preset: on unless Original; strength from the Competitor slider ──
function _dtRivMode() {
  if (typeof _dtResShipped !== "function" || typeof _dtDiff === "undefined") return { on: false, reason: "no-difficulty", mul: 0 };
  try {
    if (typeof _dtDiffLoad === "function") _dtDiffLoad();
  } catch (e) {}
  if (!_dtRivCompany() || _dtRivToday() < 1) return { on: false, reason: "no-game", mul: 0 };
  const mul = _dtRivCore.mul(_dtResShipped(), _dtDiff.rivals);
  return mul > 0 ? { on: true, reason: "ok", mul } : { on: false, reason: "original", mul: 0 };
}

// ── Part lists as the game has them now: {name: {days, labels}} ──
function _dtRivTables() {
  try {
    if (typeof _dtRealApply === "function") _dtRealApply();
  } catch (e) {}
  const out = {};
  const sig = [];
  for (const t of Object.values(_dtRivCore.RIV.TYPES)) {
    for (const spec of t.specs) {
      if (out[spec.t]) continue;
      const a = _dtRivArr(spec.t);
      if (!a || !(a.width > 0)) return null; // lists not loaded yet
      const days = [];
      const labels = [];
      for (let r = 0; r < a.width; r++) {
        days.push(Number(a.getAt(r, spec.c, 0)));
        labels.push(a.getAt(r, 0, 0));
      }
      out[spec.t] = { days, labels };
      sig.push(days.join(","));
    }
  }
  const s = sig.join("|");
  if (s !== _dtRiv.tabSig) {
    _dtRiv.tabSig = s;
    _dtRiv.tabs = out;
  }
  return _dtRiv.tabs;
}

// ── Company activity: launches never contradict the Ratings screen ──
// name -> [[start, finish]] from the game's own reader; unknown names (or no
// Ratings yet) pass, the roster check at build time covers them.
function _dtRivActive(co, year) {
  if (!_dtRiv.act) {
    const m = new Map();
    try {
      if (typeof _readCompanies === "function" && typeof _companyName === "function") {
        for (const c of _readCompanies()) {
          if (c.isPlayer) continue;
          const n = _companyName(c.id);
          if (!m.has(n)) m.set(n, []);
          m.get(n).push([c.start, c.finish]);
        }
      }
    } catch (e) {}
    _dtRiv.act = m;
  }
  // The Ratings table has real names when the names mod is on; lines keep the parody one.
  const real = typeof globalThis._dtRealName === "function" ? globalThis._dtRealName(co) : co;
  const spans = _dtRiv.act.get(co) || _dtRiv.act.get(real);
  return !spans || spans.some(([a, b]) => a <= year && year <= b);
}

// ── Save row 157 ──
function _dtRivParse(raw, company) {
  if (typeof raw !== "string" || raw.charAt(0) !== "{") return null;
  try {
    const j = JSON.parse(raw);
    if (!j || j.v !== 1 || j.company !== company || !Number.isFinite(j.last) || !Number.isFinite(j.seed)) return null;
    return {
      v: 1, company, seed: j.seed >>> 0, last: Math.floor(j.last), fx: Number.isFinite(j.fx) ? Math.floor(j.fx) : Math.floor(j.last),
      log: Array.isArray(j.log) ? j.log.filter((L) => L && typeof L.id === "string" && Number.isFinite(L.day) && Array.isArray(L.rows)) : [],
      hits: Array.isArray(j.hits) ? j.hits.filter((h) => h && typeof h.key === "string" && Number.isFinite(h.day) && Number.isFinite(h.x)) : [],
      used: j.used && typeof j.used === "object" ? Object.assign({}, j.used) : {},
    };
  } catch (e) {
    return null;
  }
}
// Reads the row; a changed row (a loaded save, another slot or company) is the truth.
function _dtRivSync() {
  const slot = _dtRivSlot();
  const company = _dtRivCompany();
  const a = _dtRivArr("ArraySaves");
  let raw = "";
  try {
    if (a && a.height > _DT_RIV_ROW && a.width > slot) raw = a.getAt(slot, _DT_RIV_ROW, 0);
  } catch (e) {}
  if (slot === _dtRiv.slot && company === _dtRiv.company && raw === _dtRiv.raw) return;
  _dtRiv.slot = slot;
  _dtRiv.company = company;
  _dtRiv.raw = raw;
  _dtRiv.s = _dtRivParse(raw, company);
  _dtRiv.hist = null;
  _dtRiv.act = null;
  _dtRiv.wasOn = null; // a fresh load continues live from its own last day
}
function _dtRivWrite() {
  const a = _dtRivArr("ArraySaves");
  const slot = _dtRivSlot();
  if (!a || a.height <= _DT_RIV_ROW || a.width <= slot) return console.warn("[Rivals] no ArraySaves row", _DT_RIV_ROW);
  const s = _dtRiv.s;
  s.log = s.log.filter((L) => L.day > s.last - _DT_RIV_LOG_DAYS);
  s.hits = s.hits.filter((h) => h.day + _dtRivCore.RIV.FX_DAYS > s.fx);
  const raw = JSON.stringify(s);
  a.setAt(raw, slot, _DT_RIV_ROW, 0);
  _dtRiv.raw = raw;
}

// ── History: every launch from 2008 to `last` ──
function _dtRivPlan(year) {
  const k = _dtRiv.s.seed + "|" + year;
  if (!_dtRiv.plans.has(k)) {
    if (_dtRiv.plans.size > 80) _dtRiv.plans.clear();
    _dtRiv.plans.set(k, _dtRivCore.yearPlan(year, _dtRiv.s.seed));
  }
  return _dtRiv.plans.get(k);
}
// Adds the plan launches with from < day <= to, in day order; frozen log rows win.
function _dtRivRun(from, to, tables, frozen, each) {
  const prev = _dtRiv.prev;
  for (let y = Math.max(2008, _dtRivCore.year(Math.max(1, from + 1))); y <= _dtRivCore.year(to); y++) {
    for (const p of _dtRivPlan(y)) {
      if (p.day <= from || p.day > to) continue;
      const old = frozen && frozen.get(p.id);
      if (!old && !_dtRivActive(p.line.co, y)) continue;
      const rows = old ? old.rows.slice() : _dtRivCore.pick(p.line, p.day, prev[p.line.id] || null, tables);
      const h = { id: p.id, line: p.line, type: p.line.type, year: y, day: p.day, n: p.n, rows };
      prev[p.line.id] = rows;
      _dtRiv.hist.push(h);
      if (each) each(h);
    }
  }
}
function _dtRivBuild(tables) {
  const s = _dtRiv.s;
  const sig = _dtRiv.tabSig + "#" + _dtRiv.raw;
  if (_dtRiv.hist && _dtRiv.histSig === sig) return;
  const frozen = new Map(s.log.map((L) => [L.id, L]));
  _dtRiv.hist = [];
  _dtRiv.prev = {};
  _dtRivRun(0, s.last, tables, frozen, null);
  _dtRiv.histSig = sig;
}

// ── Effect on player devices ──
function _dtRivKey(arrName, a, x, y) {
  const C = _DT_RIV_COL;
  let id = 0;
  try {
    if ((a.depth | 0) > C.ID) id = Number(a.getAt(x, y, C.ID));
  } catch (e) {}
  const rel = Math.round(Number(a.getAt(x, y, C.RELEASE)) || 0);
  return arrName + (id > 0 ? "#" + id : "|" + String(a.getAt(x, y, C.NAME) || "")) + "@" + rel;
}
// Calls fn(device) for every made device of a type: {key, name, a, x, y, pop, rating, release}.
function _dtRivDevices(type, fn) {
  const [arrName, v] = _DT_RIV_ARRS[type];
  const a = _dtRivArr(arrName);
  if (!a) return;
  const C = _DT_RIV_COL;
  const h = Math.min(v, a.height | 0);
  for (let x = 0; x < (a.width | 0); x++) {
    for (let y = 0; y < h; y++) {
      if (a.getAt(x, y, C.CREATED) === -1) continue;
      const release = Number(a.getAt(x, y, C.RELEASE));
      if (!(release >= 0)) continue;
      fn({ key: _dtRivKey(arrName, a, x, y), name: String(a.getAt(x, y, C.NAME) || ""), a, x, y,
        pop: Number(a.getAt(x, y, C.POP)) || 0, rating: Number(a.getAt(x, y, C.RATING)) || 0, release });
    }
  }
}
// Hits of one live launch on devices on sale that came out before it.
function _dtRivHits(h, mul) {
  const out = [];
  _dtRivDevices(h.type, (d) => {
    if (d.pop <= 0 || !(d.release < h.day)) return;
    const market = _dtRivCore.market(_dtRiv.hist, h.type, d.release);
    // Only specs where the launch beats the device's own part count.
    const own = (_DT_RIV_OWN[h.type] || []).map((c) => {
      const v = c == null ? NaN : Number(d.a.getAt(d.x, d.y, c));
      return Number.isFinite(v) && v >= 0 ? v : null;
    });
    const x = _dtRivCore.hit(h, h.rows, d.release, market, d.rating, mul, own);
    if (x > 0) out.push({ key: d.key, id: h.id, day: h.day, x: Math.round(x * 1e4) / 1e4, name: d.name });
  });
  return out;
}
// Once per DayTotal after the game's tick: POP -= capped extra, never below 0.
function _dtRivFx(today) {
  const s = _dtRiv.s;
  if (!s || s.fx >= today) return false;
  s.fx = today;
  const byKey = new Map();
  for (const h of s.hits) {
    if (!byKey.has(h.key)) byKey.set(h.key, []);
    byKey.get(h.key).push(h);
  }
  if (!byKey.size) return true;
  for (const type of Object.keys(_DT_RIV_ARRS)) {
    _dtRivDevices(type, (d) => {
      const hs = byKey.get(d.key);
      if (!hs || d.pop <= 0) return;
      const extra = _dtRivCore.decay(hs, today, s.used[d.key] || 0);
      if (!(extra > 0)) return;
      const pop = Math.max(0, d.pop - extra);
      d.a.setAt(pop, d.x, d.y, _DT_RIV_COL.POP);
      s.used[d.key] = Math.round(((s.used[d.key] || 0) + (d.pop - pop)) * 1e4) / 1e4;
    });
  }
  return true;
}

// ── Daily step (start of tickDeviceSales) ──
// Returns the new live launches for onLaunch, in day order.
function _dtRivStep() {
  _dtRivSync();
  const mode = _dtRivMode();
  const wasOn = _dtRiv.wasOn;
  _dtRiv.wasOn = mode.on;
  if (!mode.on) return [];
  const tables = _dtRivTables();
  if (!tables) return [];
  const today = _dtRivToday();
  // A row from a later day (a new game in a used slot under the same name) starts over.
  if (_dtRiv.s && _dtRiv.s.last > today) _dtRiv.s = null;
  // Just switched from Original, or a loaded row over a month behind its save day
  // (saved while on Original): fill in silently.
  const quiet = wasOn === false || (wasOn === null && _dtRiv.s && today - _dtRiv.s.last > _DT_RIV_STALE_DAYS);
  if (!_dtRiv.s) {
    const company = _dtRivCompany();
    _dtRiv.s = { v: 1, company, seed: _dtRivCore.hash(company + "|" + today), last: today, fx: today, log: [], hits: [], used: {} };
    _dtRiv.hist = null;
    _dtRiv.raw = null;
    _dtRivBuild(tables);
    _dtRiv.s.log = _dtRiv.hist.filter((h) => h.day > today - _DT_RIV_LOG_DAYS).map((h) => ({ id: h.id, day: h.day, rows: h.rows }));
    _dtRivWrite();
    _dtRiv.histSig = _dtRiv.tabSig + "#" + _dtRiv.raw;
    return [];
  }
  const s = _dtRiv.s;
  _dtRivBuild(tables);
  if (s.last === today) return [];
  const fresh = [];
  _dtRivRun(s.last, today, tables, null, (h) => {
    s.log.push({ id: h.id, day: h.day, rows: h.rows });
    if (quiet) return;
    h.hits = _dtRivHits(h, mode.mul);
    for (const x of h.hits) s.hits.push(x);
    fresh.push(h);
  });
  s.last = today;
  if (quiet) s.fx = Math.max(s.fx, today - 1);
  _dtRivWrite();
  _dtRiv.histSig = _dtRiv.tabSig + "#" + _dtRiv.raw;
  return fresh;
}
function _dtRivAfter() {
  if (!_dtRiv.wasOn || !_dtRiv.s) return;
  if (_dtRivFx(_dtRivToday())) {
    _dtRivWrite();
    _dtRiv.histSig = _dtRiv.tabSig + "#" + _dtRiv.raw;
  }
}
function _dtRivFire(fresh) {
  if (!fresh.length) return;
  const today = _dtRivToday();
  const newest = _dtRivNewest();
  fresh.forEach((h, i) => {
    const L = _dtRivOut(h, newest);
    for (const fn of _dtRiv.subs.slice()) {
      try {
        fn(L, { index: i, count: fresh.length, today });
      } catch (e) {
        console.warn("[Rivals] onLaunch:", e);
      }
    }
  });
}
function _dtRivWrapTick() {
  if (_dtRiv.wrapped || typeof tickDeviceSales !== "function") return;
  _dtRiv.wrapped = true;
  const orig = tickDeviceSales;
  tickDeviceSales = function () {
    let fresh = [];
    try {
      fresh = _dtRivStep();
    } catch (e) {
      console.warn("[Rivals] day:", e);
    }
    _dtRivFire(fresh);
    const out = orig.apply(this, arguments);
    try {
      _dtRivAfter();
    } catch (e) {
      console.warn("[Rivals] effect:", e);
    }
    return out;
  };
  globalThis.tickDeviceSales = tickDeviceSales;
}

// ── Read API ──
function _dtRivName(stem, n) {
  const last = stem.split(" ").pop();
  return stem + (/^[A-Z0-9]{1,2}$/.test(last) ? "" : " ") + n;
}
// The rival market a type had on a day, per spec. Every row of a list asks for the
// same few (type, day) pairs, and each answer is a pass over the whole history:
// keep them until the history changes (a new array or a new launch).
var _dtRivMarketMemo = { hist: null, len: -1, map: new Map() };
function _dtRivMarketAt(type, day) {
  const hist = _dtRiv.hist || [], c = _dtRivMarketMemo;
  if (c.hist !== hist || c.len !== hist.length) {
    c.hist = hist;
    c.len = hist.length;
    c.map.clear();
  }
  const k = type + "|" + day;
  let m = c.map.get(k);
  if (!m) c.map.set(k, (m = _dtRivCore.market(hist, type, day)));
  return m;
}
function _dtRivOut(h, newest) {
  const line = h.line;
  const t = _dtRivCore.RIV.TYPES[line.type];
  const tabs = _dtRiv.tabs || {};
  let lastOne = line.to < 9999;
  for (let y = h.year + 1; lastOne && y <= line.to; y++) if (_dtRivCore.launches(line, y)) lastOne = false;
  const s = _dtRiv.s;
  const hits = (h.hits || (s ? s.hits.filter((x) => x.id === h.id) : [])).map((x) => Object.freeze({ key: x.key, name: x.name || "", x: x.x }));
  let newer = null;
  const rel = newest ? newest[line.type] : undefined;
  if (rel !== undefined) {
    const m = _dtRivMarketAt(line.type, rel);
    newer = h.rows.map((r, i) => r >= 0 && r > m[i]);
  }
  return Object.freeze({
    id: h.id, line: line.id, co: line.co, type: line.type, arch: line.arch, tier: line.tier, stem: line.stem, n: h.n,
    name: _dtRivName(line.stem, h.n), day: h.day, year: h.year, month: _dtRivMonthOf(h.day), price: _dtRivCore.price(line, h.year),
    rows: Object.freeze(h.rows.slice()),
    specs: Object.freeze(t.specs.map((spec, i) => {
      const r = h.rows[i];
      const tab = tabs[spec.t];
      if (!(r >= 0) || !tab) return null;
      return Object.freeze({ label: _dtRivCore.label(spec, tab.labels[r]), row: r, table: spec.t });
    })),
    first: h.n === line.n0, last: lastOne, hits: Object.freeze(hits), newer: newer && Object.freeze(newer),
  });
}
function _dtRivMonthOf(day) {
  const d = (day - 1) % 365;
  const ms = _dtRivCore.RIV.MONTH_START;
  let m = 0;
  while (m < 11 && ms[m + 1] <= d) m++;
  return m + 1;
}
// Release day of the player's newest released device per type (none: absent).
function _dtRivNewest() {
  const out = {};
  const today = _dtRivToday();
  for (const type of Object.keys(_DT_RIV_ARRS)) {
    _dtRivDevices(type, (d) => {
      if (d.release <= today && !(out[type] >= d.release)) out[type] = d.release;
    });
  }
  return out;
}
// Ready history for reads: [] when off or nothing processed yet.
function _dtRivReady() {
  _dtRivSync();
  if (!_dtRivMode().on || !_dtRiv.s) return null;
  const tables = _dtRivTables();
  if (!tables) return null;
  _dtRivBuild(tables);
  return _dtRiv.hist;
}
function _dtRivList() {
  const hist = _dtRivReady();
  if (!hist) return [];
  const newest = _dtRivNewest();
  const s = _dtRiv.s;
  return hist.filter((h) => h.day > s.last - _DT_RIV_LOG_DAYS).reverse().map((h) => _dtRivOut(h, newest));
}
function _dtRivSince(day) {
  const hist = _dtRivReady();
  if (!hist) return [];
  const newest = _dtRivNewest();
  const d = Number(day) || 0;
  return hist.filter((h) => h.day > d).map((h) => _dtRivOut(h, newest));
}
function _dtRivState() {
  _dtRivSync();
  const mode = _dtRivMode();
  const s = _dtRiv.s;
  const hist = mode.on ? _dtRivReady() : null;
  return {
    on: mode.on, reason: mode.reason, mul: mode.mul, company: _dtRivCompany(), slot: _dtRivSlot(), seed: s ? s.seed : null,
    today: _dtRivToday(), last: s ? s.last : null, launches: hist ? hist.length : 0, log: s ? s.log.length : 0,
    hits: s ? s.hits.map((h) => Object.assign({}, h)) : [], used: s ? Object.assign({}, s.used) : {}, row: _DT_RIV_ROW,
  };
}
(function () {
  _dtRivWrapTick();
  globalThis._dtRivApi = {
    list: _dtRivList,
    launchesSince: _dtRivSince,
    onLaunch(fn) {
      if (typeof fn !== "function") return () => {};
      _dtRiv.subs.push(fn);
      return () => {
        const i = _dtRiv.subs.indexOf(fn);
        if (i >= 0) _dtRiv.subs.splice(i, 1);
      };
    },
    state: _dtRivState,
    // Changes whenever list() could: another save row, history or processed day. "" when off.
    // Cheap on purpose (no history build): the Rivals tab asks twice a second.
    version: () => {
      _dtRivSync();
      if (!_dtRivMode().on || !_dtRiv.s) return "";
      return (_dtRiv.hist ? _dtRiv.hist.length : -1) + "|" + _dtRiv.s.last + "|" + String(_dtRiv.raw || "").length;
    },
    market: (type, day) => (_dtRivReady() && _dtRivCore.RIV.TYPES[type] ? _dtRivCore.market(_dtRiv.hist, type, Number(day) || 0) : []),
    core: _dtRivCore,
  };
})();
