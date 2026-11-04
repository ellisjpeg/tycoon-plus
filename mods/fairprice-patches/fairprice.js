// ── Fair price reviews: reviewers judge the price against what the device offers ──
// The game's review engines (282 REVIEWS) pick the price card from fixed
// markup bands, (SELL * 100 / COST) - 100: under 20 -> 9-10, 20-30 -> 7-8,
// 30-35 -> 5-6 (those three are one phrase in the shuffled aspect pool, so
// rarely shown), 35-40 -> 3-4 and from 40 -> 1-2 (always the first card).
// So a top-spec device at a fair premium got 1-2 and junk at cost +19% got 9-10.
// Outside the Original preset the engines now compare the markup minus an
// allowance for what the device offers in its year:
//   spec level = unit cost / (K x era anchor)   the cost model's own unit for
//                the device type and year (_compute4: TABLES[type].K, anchor)
//   allowance  = round(clamp(PER_DOUBLING x log2(level / REF), MIN, MAX))
// A device at REF is judged exactly as before; each doubling of spec level
// allows PER_DOUBLING more markup points, each halving the same fewer. The
// bands, phrases, scores and which card is forced stay the game's own. The
// price page forecast (skip.js) asks the same function, and the allowance it
// showed is kept per device (ArraySaves row 155) so the review uses that
// number even if the year turns during development or the game is reloaded.
var _DT_FAIR = {
  REF: 0.7, // spec level judged by the game's own bands (a mainstream phone)
  PER_DOUBLING: 12, // markup points allowed per doubling of spec level
  MIN: -12, // weakest devices: at most 12 points stricter (forced card from 23%, never at cost +19%)
  MAX: 20, // strongest devices: at most 20 points more lenient
  ROW: 155, // ArraySaves row: {v, company, d: {"TYPE|name|cost": allowance}}
  KEEP: 40, // most recent price page judgements kept
};
// {editor DeviceType: DeviceTypeCreatingNow} for the 10 types with a price
// card, from the game's own review dispatch (built in by prepare.py).
var _DT_FAIR_EDITOR = __DT_FAIR_EDITOR__;

var _dtFairLogic = (function () {
  // Spec level of a device: its cost in the cost model's unit for that type and year.
  function level(cost, K, anchor) {
    cost = Number(cost);
    return cost > 0 && K > 0 && anchor > 0 ? cost / (K * anchor) : null;
  }
  function allowance(lvl) {
    if (!(lvl > 0) || !Number.isFinite(lvl)) return 0;
    const p = _DT_FAIR.PER_DOUBLING * Math.log2(lvl / _DT_FAIR.REF);
    return Math.round(Math.min(_DT_FAIR.MAX, Math.max(_DT_FAIR.MIN, p))) || 0;
  }
  function key(now, name, cost) {
    return String(now || "") + "|" + String(name === undefined || name === null ? "" : name) + "|" + Math.round(Number(cost) || 0);
  }
  // Row 155 text -> Map(key -> allowance) for this company (anything else: empty).
  function parse(raw, company) {
    const m = new Map();
    if (typeof raw !== "string" || raw.charAt(0) !== "{") return m;
    try {
      const j = JSON.parse(raw);
      if (!j || j.v !== 1 || j.company !== company || !j.d || typeof j.d !== "object") return m;
      for (const k in j.d) {
        const v = j.d[k];
        if (k.length < 200 && Number.isInteger(v) && v >= _DT_FAIR.MIN && v <= _DT_FAIR.MAX) m.set(k, v);
      }
    } catch (e) {}
    return m;
  }
  function serialize(map, company) {
    if (!map.size) return "";
    const d = {};
    for (const [k, v] of map) d[k] = v;
    return JSON.stringify({ v: 1, company: String(company || ""), d: d });
  }
  return { level, allowance, key, parse, serialize };
})();

var _dtFair = { slot: -1, company: "", raw: null, map: new Map(), now: {} };
for (const t in _DT_FAIR_EDITOR) _dtFair.now[_DT_FAIR_EDITOR[t]] = t;

// Original (all five difficulty sliders at 1) is the untouched game, as for
// real.js and research.js. Without the difficulty patch there is no preset.
function _dtFairActive() {
  return typeof _dtResShipped === "function" ? !_dtResShipped() : true;
}
function _dtFairRt() {
  return globalThis.runtime || null;
}
function _dtFairGv(n, d) {
  try {
    const v = _dtFairRt().globalVars[n];
    return v === undefined ? d : v;
  } catch (e) {
    return d;
  }
}
// The year the cost model prices parts in (_compute4 -> _yearOfDay3(_today)).
function _dtFairYear() {
  return _yearOfDay3(_today(_dtFairRt()));
}
// Allowance for a device of DeviceTypeCreatingNow `now` costing `cost` in `year`.
// Under a higher "Part and production costs" slider the difficulty patch's
// remembered design-time cost is used, as buyers do (_potentialUnits).
function _dtFairAllowanceFor(now, cost, year) {
  const t = TABLES[_dtFair.now[now]];
  if (!t) return 0;
  const K = Number.isFinite(t.K) ? t.K : _cfg12.K;
  const anchor = _anchorAt(t.anchor || ANCHOR, year);
  const base = typeof _dtDiffDemandCost === "function" ? Number(_dtDiffDemandCost(cost)) : Number(cost);
  return _dtFairLogic.allowance(_dtFairLogic.level(base, K, anchor));
}

// ── Row 155: the allowance the price page showed, per device ──
function _dtFairSaves() {
  try {
    return _dtFairRt().objects.ArraySaves.getFirstInstance();
  } catch (e) {
    return null;
  }
}
function _dtFairSlot() {
  return Math.max(0, Math.min(2, Math.round(Number(_dtFairGv("SaveSlot", 0))) || 0));
}
// The row is the truth (a loaded save replaces it): parse again whenever it changes.
function _dtFairLoad() {
  const slot = _dtFairSlot(), company = String(_dtFairGv("CompanyName", "") || "");
  const a = _dtFairSaves();
  let raw = "";
  try {
    if (a && a.height > _DT_FAIR.ROW && a.width > slot) raw = a.getAt(slot, _DT_FAIR.ROW, 0);
  } catch (e) {}
  if (slot === _dtFair.slot && company === _dtFair.company && raw === _dtFair.raw) return a;
  _dtFair.slot = slot;
  _dtFair.company = company;
  _dtFair.raw = raw;
  _dtFair.map = _dtFairLogic.parse(raw, company);
  return a;
}
function _dtFairRemember(key, allowance) {
  const a = _dtFairLoad();
  if (_dtFair.map.get(key) === allowance) return;
  if (!a || a.height <= _DT_FAIR.ROW || a.width <= _dtFair.slot) return;
  _dtFair.map.delete(key);
  _dtFair.map.set(key, allowance);
  while (_dtFair.map.size > _DT_FAIR.KEEP) _dtFair.map.delete(_dtFair.map.keys().next().value);
  const raw = _dtFairLogic.serialize(_dtFair.map, _dtFair.company);
  a.setAt(raw, _dtFair.slot, _DT_FAIR.ROW, 0);
  _dtFair.raw = raw;
}
function _dtFairRecall(key) {
  _dtFairLoad();
  return _dtFair.map.has(key) ? _dtFair.map.get(key) : null;
}

// ── Shared by the price page forecast (skip.js) and the reviews ──
// {now, allowance} for the editor's DeviceType at today's market, or null when
// the rule is off (Original) or the type has no price card.
function _dtFairForecast(deviceType, cost) {
  if (!_dtFairActive()) return null;
  const now = _DT_FAIR_EDITOR[String(deviceType || "")];
  if (!now) return null;
  return { now: now, allowance: _dtFairAllowanceFor(now, cost, _dtFairYear()) };
}
// 282 REVIEWS price checks (patched expression): the game's markup in, the
// markup the bands judge out. Same number back when the rule is off.
function _dtFairReview(markup, cost, name) {
  try {
    if (!_dtFairActive()) return markup;
    const now = String(_dtFairGv("DeviceTypeCreatingNow", ""));
    if (!_dtFair.now[now]) return markup;
    let p = _dtFairRecall(_dtFairLogic.key(now, name, cost));
    if (p === null) p = _dtFairAllowanceFor(now, cost, _dtFairYear());
    return markup - p;
  } catch (e) {
    return markup;
  }
}
// While the price page is up, keep what it shows for this device. Create
// changes $class before the page fades, so the last kept value is the one shown.
function _dtFairTick() {
  try {
    const rt = _dtFairRt();
    // A New Game in a used slot must not keep the old company's records (a new
    // "Ember 1" at the same cost would match): clear row 155, as Launch and Queue do.
    if (rt && rt.layout.name === "LOADING GAME" && String(rt.globalVars.LoadingType || "").toUpperCase() === "NEW GAME") {
      const a = _dtFairSaves(), slot = _dtFairSlot();
      try {
        const v = a && a.height > _DT_FAIR.ROW && a.width > slot ? a.getAt(slot, _DT_FAIR.ROW, 0) : "";
        if (v !== "" && v !== 0) a.setAt("", slot, _DT_FAIR.ROW, 0);
      } catch (e) {}
      Object.assign(_dtFair, { slot: -1, company: "", raw: null, map: new Map() });
      return;
    }
    if (!rt || String(rt.globalVars.class) !== "EDITOR PRICE PAGE" || rt.layout.name !== "EDITOR PRICE PAGE") return;
    const g = rt.globalVars;
    const f = _dtFairForecast(g.DeviceType, g.DeviceCostPrice);
    if (f) _dtFairRemember(_dtFairLogic.key(f.now, g.DeviceName, g.DeviceCostPrice), f.allowance);
  } catch (e) {}
}
// The shared mod timer (ui.js every) when ui.js is in; a timer of our own without it.
(typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(_dtFairTick, 250);
globalThis._dtFairApi = {
  logic: _dtFairLogic, cfg: _DT_FAIR, editor: _DT_FAIR_EDITOR, active: _dtFairActive, year: _dtFairYear,
  allowanceFor: _dtFairAllowanceFor, forecast: _dtFairForecast, review: _dtFairReview, recall: _dtFairRecall, tick: _dtFairTick,
};
