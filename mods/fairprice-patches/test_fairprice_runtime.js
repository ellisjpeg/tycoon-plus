// Runtime test for fairprice.js on the game's REAL cost model numbers (per-type
// K and era anchors cut from c3main.js) with a fake Construct runtime. Also runs
// the patched review expression and checks the price page forecast (skip.js's
// own forecast functions) against the review hook at every slider price.
// Usage: node test_fairprice_runtime.js EDITOR_JSON PATCHED_EXPR SKIP_TABLE_JSON [c3main.js]
// (test_fairprice.py passes the values prepare.py builds from the game.)
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const HERE = __dirname;
const EDITOR = JSON.parse(process.argv[2]);
const PATCHED = process.argv[3];
const TABLE = JSON.parse(process.argv[4]);
const game = fs.readFileSync(process.argv[5] || path.join(HERE, "../../game-files/scripts/c3main.js"), "utf8");

function between(src, a, b) {
  const i = src.indexOf(a), j = src.indexOf(b, i + 1);
  assert.ok(i >= 0 && j > i, "not found in c3main.js: " + a.slice(0, 40));
  return src.slice(i, j);
}
function literal(name) {
  const at = game.search(new RegExp("[^A-Za-z0-9_]" + name + "=[\\[{]"));
  assert.ok(at >= 0, "literal " + name);
  let i = game.indexOf("=", at) + 1, depth = 0, j = i;
  for (; j < game.length; j++) {
    const c = game[j];
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") { depth--; if (depth === 0) break; }
  }
  return Function('"use strict";return (' + game.slice(i, j + 1) + ")")();
}
// TABLES as _compute4 reads it: K and the era anchor of each device type.
const tables = {};
for (const m of between(game, "TABLES={", ";function").matchAll(/([A-Z_]+):\{items:[A-Z_]+_ITEMS,(.*?)(?=\},[A-Z_]+:\{items:|\}\}?$)/g)) {
  const body = m[2].replace(/stockChip:\{[^}]*\}/g, "");
  const a = /(?:^|,)anchor:([A-Z_]+)/.exec(body), k = /(?:^|,)K:([\d.]+)/.exec(body);
  tables[m[1]] = { anchor: a ? literal(a[1]) : undefined, K: k ? Number(k[1]) : undefined };
}
const costJs = [
  "var ANCHOR_FIRST_YEAR=2008, ANCHOR=" + JSON.stringify(literal("ANCHOR")) + ";",
  "var _cfg12=" + JSON.stringify(literal("_cfg12")) + ";",
  between(game, "function _anchorAt(e,t){", "function _anchorTable("),
  between(game, "function _today(e){", "function "),
  "var _yearOfDay3=" + between(game, "_yearOfDay3=e=>", ";function").slice("_yearOfDay3=".length) + ";",
  "var TABLES=" + JSON.stringify(tables) + ";",
  "function _num13(e,t,n){const o=Number(e.globalVars[t]);return Number.isFinite(o)?o:n}",
  // C3 arithmetic helpers used by the compiled markup expression (c3main.js, before C3_ExpressionFuncs).
  "var RB=(e,t)=>typeof e==='number'&&typeof t==='number',BB=function(e,t){return RB(e,t)?e-t:e},LB=function(e,t){return RB(e,t)?e*t:e},FB=function(e,t){return RB(e,t)?e/t:e};",
].join("\n");

class Arr {
  constructor(w, h, d) { this.width = w; this.height = h; this.depth = d; this.c = new Map(); }
  getAt(x, y, z) { const k = x + "," + (y || 0) + "," + (z || 0); return this.c.has(k) ? this.c.get(k) : 0; }
  setAt(v, x, y, z) { this.c.set(x + "," + (y || 0) + "," + (z || 0), v); }
}
const saves = new Arr(3, 200, 1);
const gv = { DayTotal: 2745, SaveSlot: 0, CompanyName: "Ember", class: "BOSS OFFICE", DeviceType: "SMARTPHONE", DeviceName: "",
  DeviceCostPrice: 0, DevicePrice: 0, DeviceTypeCreatingNow: "", ReviewDeviceNowID: 0 };
const runtime = { globalVars: gv, layout: { name: "BOSS OFFICE" }, objects: { ArraySaves: { getFirstInstance: () => saves } } };
const timers = [];
const ctx = { console, Math, Number, String, Map, Set, Array, Object, JSON, isFinite, isNaN, Error, runtime,
  setInterval: (f) => (timers.push(f), timers.length), clearInterval() {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(costJs, ctx, { filename: "c3main-cost" });
vm.runInContext(fs.readFileSync(path.join(HERE, "fairprice.js"), "utf8").replace("__DT_FAIR_EDITOR__", JSON.stringify(EDITOR)), ctx, { filename: "fairprice.js" });
// skip.js's own forecast functions (markup, band, scores, forecast), as the price page runs them.
const skip = fs.readFileSync(path.join(HERE, "../skip-patches/skip.js"), "utf8");
vm.runInContext("var _DT_SKIP_TABLE = " + JSON.stringify(TABLE) + ";\n" + between(skip, "function _dtSkipMarkup(", "function _dtSkipForecastText("), ctx, { filename: "skip-forecast" });
const api = ctx._dtFairApi, L = api.logic;
const tick = () => timers.forEach((f) => f());
const dayIn = (year, d) => (year - 2008) * 365 + (d || 100);
let n = 0;
const test = (name, fn) => { try { fn(); } finally { delete ctx._dtResShipped; delete ctx._dtDiffDemandCost; } n++; console.log("ok -", name); };

test("allowance: 0 at REF, +-12 per doubling, clamped, never -0", () => {
  assert.equal(api.cfg.REF, 0.7);
  const a = (lvl) => L.allowance(lvl);
  assert.equal(a(0.7), 0);
  assert.equal(a(1.4), 12);
  assert.equal(a(0.35), -12);
  assert.equal(a(0.175), -12, "floor -12");
  assert.equal(a(2.8), 20, "cap +20");
  assert.equal(a(50), 20);
  assert.equal(a(0.7 * Math.pow(2, 1 / 3)), 4);
  for (const bad of [0, -1, NaN, Infinity, null, undefined]) assert.equal(a(bad), 0);
  assert.ok(Object.is(a(0.69), 0), "no -0");
  assert.equal(L.level(277, 1.55, 238).toFixed(4), (277 / (1.55 * 238)).toFixed(4));
  assert.equal(L.level(0, 1.55, 238), null);
});
test("spec level uses the device type's own K and era anchor", () => {
  const f = (now, cost, year) => api.allowanceFor(now, cost, year);
  // QA save phones, 2015 (anchor 238, K 1.55): Ember 6, Ember 6 Pro, Skipper.
  assert.equal(f("SMARTPHONES", 277, 2015), 1);
  assert.equal(f("SMARTPHONES", 335, 2015), 5);
  assert.equal(f("SMARTPHONES", 101, 2015), -12);
  assert.equal(f("SMARTPHONES", 277, 2016), 0, "a year later the same cost is a smaller share of the market");
  // A TV at twice REF in 2030: K 1.1 and the TV anchor, not the phone's.
  const tv = tables.TV, tvCost = Math.round(1.4 * tv.K * tv.anchor[2030 - 2008]);
  assert.equal(f("TV", tvCost, 2030), 12);
  assert.notEqual(f("SMARTPHONES", tvCost, 2030), 12);
  assert.equal(f("VR CONSOLE", Math.round(0.7 * 0.9 * tables.VR.anchor[2020 - 2008]), 2020), 0, "VR editor type VR, K 0.9");
  assert.equal(f("SMARTPHONECPU", 300, 2015), 0, "no cost table, no allowance");
  assert.equal(f("SMARTPHONES", 0, 2015), 0);
});
test("Original preset keeps the game's markup; no difficulty patch = on", () => {
  gv.DeviceTypeCreatingNow = "SMARTPHONES";
  gv.DayTotal = dayIn(2015);
  ctx._dtResShipped = () => true;
  assert.equal(api.active(), false);
  assert.equal(api.review(37.5, 335, "Ember 6 Pro"), 37.5);
  assert.equal(api.forecast("SMARTPHONE", 335), null);
  ctx._dtResShipped = () => false;
  assert.equal(api.review(37.5, 335, "Ember 6 Pro"), 32.5);
  delete ctx._dtResShipped;
  assert.equal(api.active(), true);
  assert.deepEqual(JSON.parse(JSON.stringify(api.forecast("SMARTPHONE", 335))), { now: "SMARTPHONES", allowance: 5 });
  assert.equal(api.forecast("GAMEPAD", 335), null);
});
test("review hook: markup minus allowance, unchanged where there is no rule", () => {
  gv.DayTotal = dayIn(2015);
  gv.DeviceTypeCreatingNow = "SMARTPHONES";
  assert.equal(api.review(40, 335, "Never priced"), 35);
  assert.equal(api.review(40, 101, "Never priced"), 52);
  gv.DeviceTypeCreatingNow = "GAMEPAD";
  assert.equal(api.review(40, 335, "x"), 40);
  gv.DeviceTypeCreatingNow = "SMARTPHONES";
  assert.ok(Number.isNaN(api.review(NaN, 335, "x")));
  const keep = ctx.runtime;
  ctx.runtime = null;
  try { assert.equal(api.review(40, 335, "x"), 40, "no runtime: the game's number"); } finally { ctx.runtime = keep; }
});
test("the patched review expression gives the game's markup, then the judged one", () => {
  const row = { 3: 335, 4: 469, 8: "Ember 6 Pro" };
  const arr = { ExpObject: (x, y, z) => (x === 0 && y === 0 ? row[z] : 0) }, id = { GetVar: () => ({ GetValue: () => 0 }) };
  const nodes = [arr, id, arr, id];
  const fn = vm.runInContext("(" + PATCHED + ")", ctx)({ _GetNode: (i) => nodes[i] });
  const original = (469 * 100) / 335 - 100; // BB(FB(LB(sell,100),cost),100)
  gv.DeviceTypeCreatingNow = "SMARTPHONES";
  gv.DayTotal = dayIn(2015);
  ctx._dtResShipped = () => true;
  assert.equal(fn(), original);
  ctx._dtResShipped = () => false;
  assert.equal(fn(), original - 5);
});
test("the price page keeps its judgement; the review uses it after the year turns", () => {
  saves.c.clear();
  Object.assign(gv, { DayTotal: 2920, class: "EDITOR PRICE PAGE", DeviceType: "SMARTPHONE", DeviceName: "Ember 7", DeviceCostPrice: 335, DevicePrice: 469 });
  runtime.layout.name = "EDITOR PRICE PAGE";
  assert.equal(ctx._yearOfDay3(2920), 2015, "last day of 2015");
  tick();
  const raw = saves.getAt(0, 155, 0);
  assert.deepEqual(JSON.parse(raw), { v: 1, company: "Ember", d: { "SMARTPHONES|Ember 7|335": 5 } });
  tick();
  assert.equal(saves.getAt(0, 155, 0), raw, "unchanged values: no rewrite");
  // Development ends in 2016: the market moved (335 is now worth 4), the review keeps the 5 it showed.
  Object.assign(gv, { DayTotal: 2960, class: "REVIEWS", DeviceTypeCreatingNow: "SMARTPHONES" });
  runtime.layout.name = "REVIEWS";
  tick();
  assert.equal(api.allowanceFor("SMARTPHONES", 335, 2016), 4);
  assert.equal(api.review(40, 335, "Ember 7"), 35);
  assert.equal(api.review(40, 335, "Ember 8"), 36, "never priced here: today's market");
  assert.equal(api.review(40, 336, "Ember 7"), 36, "different cost: not the device that was priced");
  // Original at review time: the game's markup, whatever was kept.
  ctx._dtResShipped = () => true;
  assert.equal(api.review(40, 335, "Ember 7"), 40);
});
test("row 155: per company, follows a loaded save, keeps the last 40", () => {
  const key = "SMARTPHONES|Ember 7|335";
  saves.setAt(L.serialize(new Map([[key, 7]]), "Other Co"), 0, 155, 0);
  assert.equal(api.recall(key), null, "another company's row");
  saves.setAt(L.serialize(new Map([[key, 7]]), "Ember"), 0, 155, 0);
  assert.equal(api.recall(key), 7, "a loaded save replaces the row: read again");
  for (const bad of [0, "", "{bad", '{"v":2,"company":"Ember","d":{}}', '{"v":1,"company":"Ember","d":{"a":99,"b":1.5,"c":"x"}}'])
    assert.equal(L.parse(bad, "Ember").size, 0, String(bad));
  assert.equal(L.serialize(new Map(), "Ember"), "");
  gv.SaveSlot = 1;
  assert.equal(api.recall(key), null, "other save slot");
  gv.SaveSlot = 0;
  saves.c.clear();
  Object.assign(gv, { class: "EDITOR PRICE PAGE", DeviceType: "SMARTPHONE", DayTotal: dayIn(2015) });
  runtime.layout.name = "EDITOR PRICE PAGE";
  for (let i = 0; i < 45; i++) {
    Object.assign(gv, { DeviceName: "Phone " + i, DeviceCostPrice: 200 + i });
    tick();
  }
  const d = JSON.parse(saves.getAt(0, 155, 0)).d;
  assert.equal(Object.keys(d).length, 40);
  assert.ok(!("SMARTPHONES|Phone 0|200" in d) && "SMARTPHONES|Phone 44|244" in d);
  // Original: nothing is written.
  saves.c.clear();
  ctx._dtResShipped = () => true;
  tick();
  assert.equal(saves.getAt(0, 155, 0), 0);
  // No ArraySaves row 155 (too short): nothing written, nothing breaks.
  const keep = saves.height;
  saves.height = 150;
  delete ctx._dtResShipped;
  tick();
  assert.equal(saves.getAt(0, 155, 0), 0);
  saves.height = keep;
});
test("New Game clears the slot's records; Load Game keeps them", () => {
  const key = "SMARTPHONES|Ember 1|200";
  saves.c.clear();
  Object.assign(gv, { SaveSlot: 0, CompanyName: "Ember", class: "LOADING GAME" });
  const raw = L.serialize(new Map([[key, 9]]), "Ember");
  saves.setAt(raw, 0, 155, 0);
  saves.setAt("other slot", 1, 155, 0);
  assert.equal(api.recall(key), 9);
  runtime.layout.name = "LOADING GAME";
  gv.LoadingType = "LOAD GAME";
  tick();
  assert.equal(saves.getAt(0, 155, 0), raw, "Load Game keeps the row");
  assert.equal(api.recall(key), 9);
  gv.LoadingType = "NEW GAME";
  tick();
  assert.equal(saves.getAt(0, 155, 0), "", "New Game clears the row");
  assert.equal(saves.getAt(1, 155, 0), "other slot", "other slots untouched");
  // Same company, a new "Ember 1" at the same cost: today's market, not the old record.
  runtime.layout.name = "REVIEWS";
  assert.equal(api.recall(key), null);
  // An already empty row is left alone.
  saves.c.clear();
  runtime.layout.name = "LOADING GAME";
  tick();
  assert.equal(saves.getAt(0, 155, 0), 0, "empty row not written");
  delete gv.LoadingType;
  runtime.layout.name = "BOSS OFFICE";
});
test("higher part costs: the design-time cost is judged, as buyers do", () => {
  ctx._dtDiffDemandCost = (c) => (c === 369 ? 335 : c);
  assert.equal(api.allowanceFor("SMARTPHONES", 369, 2015), 5);
  delete ctx._dtDiffDemandCost;
  assert.equal(api.allowanceFor("SMARTPHONES", 369, 2015), 6);
});
test("forecast on the price page = the review's price card at every slider price", () => {
  const db = (x, y) => ({ 0: [1, 2], 1: [1, 2], 2: [1, 2], 3: [3, 4], 4: [3, 4], 5: [3, 4], 6: [5, 6], 7: [5, 6], 8: [5, 6], 9: [7, 8], 10: [7, 8], 11: [7, 8], 12: [9, 10], 13: [9, 10], 14: [9, 10] }[y] || [0, 0])[x];
  const engineBand = (judged) => TABLE.bands.find((b) => (b.min === null || judged >= b.min) && (b.max === null || judged < b.max));
  const devices = [["SMARTPHONE", "Strong", 760, 2015], ["SMARTPHONE", "Weak", 101, 2015], ["SMARTPHONE", "Main", 277, 2015],
    ["TV", "Glow", 950, 2030], ["VR", "Visor", 120, 2020], ["LAPTOP", "Folio", 900, 2024], ["HEADPHONES", "Buds", 23, 2012]];
  let checked = 0, moved = 0;
  for (const shipped of [false, true]) {
    for (const [type, name, cost, year] of devices) {
      saves.c.clear();
      ctx._dtResShipped = () => shipped;
      Object.assign(gv, { class: "EDITOR PRICE PAGE", DeviceType: type, DeviceName: name, DeviceCostPrice: cost, DayTotal: dayIn(year, 365) });
      runtime.layout.name = "EDITOR PRICE PAGE";
      const lo = cost + Math.round(0.05 * cost), hi = Math.round(1.6 * cost); // 277 EDITOR PRICE PAGE slider
      const shown = [];
      for (let price = lo; price <= hi; price++) {
        gv.DevicePrice = price;
        tick();
        const f = ctx._dtSkipForecast(gv, db, TABLE);
        shown.push([price, f.lo, f.front]);
      }
      // Create, development, the year turns, reviews: the engines' 8 checks see the patched expression.
      Object.assign(gv, { class: "REVIEWS", DeviceTypeCreatingNow: TABLE.editor[type], DayTotal: dayIn(year + 1, 40) });
      runtime.layout.name = "REVIEWS";
      for (const [price, lo2, front] of shown) {
        const markup = (price * 100) / cost - 100;
        const b = engineBand(api.review(markup, cost, name));
        const s = [db(0, b.lo), db(0, b.hi)];
        assert.deepEqual([s[0], b.front], [lo2, front], type + " " + name + " $" + price);
        if (engineBand(markup) !== b) moved++;
        checked++;
      }
    }
  }
  assert.ok(checked > 1500 && moved > 300, checked + " prices, " + moved + " judged differently from the bare markup");
});
console.log(n + " fair price runtime tests passed");
