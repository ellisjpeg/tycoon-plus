// Runtime test for board.js on top of the game's REAL daily sales engine: the
// DeviceSales block (Z13 ... _slotProfit) is cut out of c3main.js and run in a
// vm with a small fake Construct runtime, then sell.js (for stopped devices)
// and board.js are loaded.
// Usage: node test_board_runtime.js [c3main.js] [board.js] [sell.js]
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const HERE = __dirname;
const C3MAIN = process.argv[2] || path.join(HERE, "../../game-files/scripts/c3main.js");
const BOARD = process.argv[3] || path.join(HERE, "board.js");
const SELL = process.argv[4] || path.join(HERE, "../sell-patches/sell.js");
const game = fs.readFileSync(C3MAIN, "utf8");
const a0 = game.indexOf("var Z13={CREATED:0"), a1 = game.indexOf("function _officeShownCount");
assert.ok(a0 > 0 && a1 > a0, "DeviceSales block not found in c3main.js");
const ENGINE = game.slice(a0, a1);

class Arr {
  constructor(w, h, d) { this.width = w; this.height = h; this.depth = d; this.c = new Map(); }
  getAt(x, y, z) { const k = x + "," + (y || 0) + "," + (z || 0); return this.c.has(k) ? this.c.get(k) : 0; }
  setAt(v, x, y, z) { this.c.set(x + "," + (y || 0) + "," + (z || 0), v); }
  setSize(w, h, d) { this.width = w; this.height = h; this.depth = d; }
}
// Device row: CREATED, SOLDED, POP, COST, SELL, RATING, HYPE, RELEASE, NAME, date, ID.
function put(a, x, y, r) {
  const v = [r.created, r.sold || 0, r.pop, r.cost, r.sell, r.rating, 0, r.release, r.name, r.date || "", r.id];
  v.forEach((val, z) => a.setAt(val, x, y, z));
}
const NONE = { created: -1, pop: 0, cost: 0, sell: 0, rating: 0, release: -1, name: "", id: 0 };

function world(opts) {
  opts = opts || {};
  const phones = new Arr(3, 3, 12), laptops = new Arr(1, 3, 12);
  // Ember 6 (x0): Budget + Pro; Ember 5 (x1): one edition, ran out of popularity; Ember 7 (x2): not released.
  put(phones, 0, 0, { created: 3e6, sold: 1e5, pop: 100, cost: 277, sell: 349, rating: 8, release: 2700, name: "Ember 6", date: "06.07.2013", id: 6 });
  put(phones, 0, 1, { created: 1e6, sold: 2e4, pop: 100, cost: 335, sell: 449, rating: 7, release: 2700, name: "Ember 6 Pro", date: "06.07.2013", id: 7 });
  put(phones, 0, 2, NONE);
  put(phones, 1, 0, { created: 3e6, sold: 29e5, pop: 0, cost: 260, sell: 329, rating: 8, release: 2400, name: "Ember 5", date: "01.01.2012", id: 5 });
  for (const y of [1, 2]) put(phones, 1, y, NONE);
  put(phones, 2, 0, { created: 0, pop: 0, cost: 300, sell: 399, rating: "---", release: -1, name: "Ember 7", id: 8 });
  for (const y of [1, 2]) put(phones, 2, y, NONE);
  // Folio (laptop): sells at a loss, so no restock (price below the unit cost).
  put(laptops, 0, 0, { created: 5000, sold: 1000, pop: 60, cost: 900, sell: 850, rating: 6, release: 2600, name: "Folio", date: "02.03.2013", id: 3 });
  for (const y of [1, 2]) put(laptops, 0, y, NONE);
  const saves = new Arr(3, 200, 1);
  const objects = {};
  const arrays = { ArraySmartphones: phones, ArrayLaptops: laptops, ArraySaves: saves, ArraySellingDevices: new Arr(15, 1, 1),
    ArrayMarketingDevices_Temp: new Arr(0, 6, 1), ArrayBatchCompany: new Arr(2, 1, 1) };
  arrays.ArrayBatchCompany.setAt(opts.contractEnd === undefined ? -999 : opts.contractEnd, 1, 0, 0);
  for (const n of ["ArrayTablets", "ArrayWatches", "ArrayHeadphones", "ArrayTV", "ArrayScooters", "ArrayKeyboards",
    "ArrayConsoles", "ArrayGamepads", "ArrayVRConsoles"]) arrays[n] = new Arr(0, 3, 12);
  for (const n in arrays) objects[n] = { getFirstInstance: () => arrays[n] };
  const gv = { DayTotal: 2744, Year: 2015, Month: 7, Fans: 2e6, Budget: 1e10, SaveSlot: 0, CompanyName: "Ember",
    LanguageChoose: 0, class: "MY SMARTPHONES", SubPage: 1, MiniPage: 2, DeviceShowFlagmanID: 0, ColorChoose: 3 };
  const runtime = { objects, globalVars: gv, layout: { name: "MY SMARTPHONES" }, calls: [], gone: [],
    callFunction(n) { this.calls.push([n, gv.SubPage, gv.DeviceShowFlagmanID, gv.MiniPage, gv.ColorChoose]); },
    goToLayout(n) { this.gone.push(n); } };
  const M = Object.create(Math);
  let seed = 1;
  M.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // real jitter, repeatable
  let now = 1e6;
  const FakeDate = { now: () => now };
  const ui = {
    t: (e, v) => { let s = e.en; for (const k in v || {}) s = s.split("{" + k + "}").join(String(v[k])); return s; },
    gv: (n, d) => (gv[n] === undefined ? d : gv[n]), num: (n, d) => { const v = Number(gv[n]); return Number.isFinite(v) ? v : d; },
    ru: () => false, isOpen: () => false, toast() {}, close() {},
  };
  const ctx = { console, Math: M, Number, String, Map, Set, Array, Object, JSON, isFinite, isNaN, Int32Array, Error, Date: FakeDate,
    runtime, _dtUi: ui, perkMul: () => 1, perkAdd: () => 0, taxAccrueSales() {}, taxAccrueOther() {}, syncGamepadBundle() {} };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(ENGINE, ctx, { filename: "c3main-DeviceSales" });
  vm.runInContext(fs.readFileSync(SELL, "utf8"), ctx, { filename: "sell.js" });
  vm.runInContext(fs.readFileSync(BOARD, "utf8"), ctx, { filename: "board.js" });
  return { ctx, phones, laptops, saves, gv, runtime, api: ctx._dtBoardApi, sell: ctx._dtSellApi, tick: (ms) => { now += ms; } };
}
// One game day: DayTotal moves on, then the event calls tickDeviceSales by name;
// the board samples on its 250 ms timer, after the frame.
function day(w) {
  w.gv.DayTotal++;
  vm.runInContext("tickDeviceSales(runtime.globalVars.DayTotal, runtime)", w.ctx);
  w.api.sample();
}
const row = (w, name) => w.api.rows().find((r) => r.name === name);
const cells = (w) => JSON.stringify([w.phones, w.laptops].map((a) => Array.from(a.c.entries())));
const same = (a, b, m) => assert.equal(JSON.stringify(a), JSON.stringify(b), m);
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log("ok -", name); };

test("formatting like the game's tables", () => {
  const L = world().api.logic;
  assert.equal(L.num(56129041), "56 129 041");
  assert.equal(L.num(999), "999");
  assert.equal(L.money(4036000000), "$4 036 000 000");
  assert.equal(L.money(-5), "-$5");
  assert.equal(L.rate(2.46), "2.5");
  assert.equal(L.rate(12345.6), "12 346");
  assert.equal(L.rate(null), "");
  assert.equal(L.year("06.07.2013"), "2013");
  assert.equal(L.year(""), "");
  assert.equal(L.key("ArraySmartphones", 6, 2700, "Ember 6"), "ArraySmartphones#6@2700"); // same key as Sell
});
test("stock lasts: restock, sold out, counting, days", () => {
  const L = world().api.logic;
  same(L.runsOut(100, 10, true), { k: "restock" });
  same(L.runsOut(0, 10, false), { k: "out" });
  same(L.runsOut(100, null, false), { k: "wait" });
  same(L.runsOut(100, 0, false), { k: "idle" });
  same(L.runsOut(100, 9, false), { k: "days", n: 12 });
  same(L.runsOut(5, 9, false), { k: "days", n: 1 });
});
test("restock gate is the game's (_handleBatchSoldOut)", () => {
  const w = world(), L = w.api.logic, cfg = w.ctx._cfg7;
  assert.equal(cfg.RESTOCK_SELF, true);
  assert.equal(L.restocks(cfg, false, 50, 277, 349), true);
  assert.equal(L.restocks(cfg, false, 2.9, 277, 349), false); // below RESTOCK_MIN_POP
  assert.equal(L.restocks(cfg, false, 50, 900, 850), false); // price under unit cost
  const noSelf = Object.assign({}, cfg, { RESTOCK_SELF: false });
  assert.equal(L.restocks(noSelf, false, 50, 277, 349), false);
  assert.equal(L.restocks(noSelf, true, 50, 277, 349), true); // contract restock
  assert.equal(L.restocks(Object.assign({}, noSelf, { RESTOCK_FEE: 0.5 }), true, 50, 277, 349), false); // 415.5 > 349
});
test("rows: one per edition on sale, numbers straight from the arrays", () => {
  const w = world();
  const rows = w.api.rows();
  same(rows.map((r) => r.name).sort(), ["Ember 6", "Ember 6 Pro", "Folio"]); // Ember 5 ran out, Ember 7 unreleased
  const e6 = row(w, "Ember 6");
  same([e6.price, e6.stock, e6.pop, e6.profit, e6.year, e6.t.k, e6.x, e6.y, e6.off], [349, 2900000, 100, 7200000, "2013", "phone", 0, 0, false]);
  assert.equal(e6.profit, w.ctx._slotProfit({ solded: 1e5, sell: 349, cost: 277 }));
  assert.equal(row(w, "Folio").profit, 0); // the game's figure never goes below 0
  assert.equal(e6.rate, null);
  assert.equal(e6.restock, true);
  assert.equal(row(w, "Folio").restock, false);
});
test("sold a day = average SOLDED change over the last 7 real engine days", () => {
  const w = world();
  w.api.sample();
  const daily = [];
  for (let i = 0; i < 10; i++) {
    const s0 = w.phones.getAt(0, 0, 1);
    day(w);
    daily.push(w.phones.getAt(0, 0, 1) - s0);
    const last = daily.slice(-7);
    const avg = last.reduce((p, q) => p + q, 0) / last.length;
    assert.ok(Math.abs(row(w, "Ember 6").rate - avg) < 1e-9, "day " + i);
  }
  assert.ok(daily.every((u) => u > 0));
  assert.ok(new Set(daily).size > 1, "jitter makes days differ");
  const e6 = row(w, "Ember 6");
  assert.equal(e6.stock, w.phones.getAt(0, 0, 0) - w.phones.getAt(0, 0, 1));
  assert.equal(e6.pop, Math.round(w.phones.getAt(0, 0, 2)));
});
test("several days in one jump are divided; a load starts counting again", () => {
  const w = world();
  w.api.sample();
  const s0 = w.phones.getAt(0, 0, 1);
  w.gv.DayTotal++;
  vm.runInContext("tickDeviceSales(runtime.globalVars.DayTotal, runtime)", w.ctx);
  w.gv.DayTotal++;
  vm.runInContext("tickDeviceSales(runtime.globalVars.DayTotal, runtime)", w.ctx);
  w.api.sample();
  assert.equal(row(w, "Ember 6").rate, (w.phones.getAt(0, 0, 1) - s0) / 2);
  w.gv.DayTotal -= 30; // an older save
  w.api.sample();
  assert.equal(row(w, "Ember 6").rate, null);
  day(w);
  assert.ok(row(w, "Ember 6").rate > 0);
  w.gv.CompanyName = "Other"; // another company, same day
  w.api.sample();
  assert.equal(row(w, "Ember 6").rate, null);
});
test("the sold-a-day total waits for every row on sale, like the rows' own \u2026", () => {
  const w = world();
  w.api.sample();
  day(w); day(w);
  const view = () => ({ scroll: { isConnected: true, innerHTML: "", scrollTop: 0 }, sum: { textContent: "" }, heads: [], icons: null, rows: [] });
  w.ctx._dtBoard.view = view();
  w.ctx._dtBoardRender();
  assert.match(w.ctx._dtBoard.view.sum.textContent, /\d sold a day/, "all measured: a number");
  // A device released today: its row is still counting.
  w.phones.setSize(4, 3, 12);
  put(w.phones, 3, 0, { created: 1e6, sold: 0, pop: 100, cost: 300, sell: 399, rating: 8, release: w.gv.DayTotal, name: "Ember 7", date: "x", id: 9 });
  for (const y of [1, 2]) put(w.phones, 3, y, NONE);
  w.api.sample();
  assert.equal(row(w, "Ember 7").rate, null);
  w.ctx._dtBoardRender();
  assert.match(w.ctx._dtBoard.view.sum.textContent, /\u2026 sold a day/, "a partial sum is not shown as the total");
  day(w); day(w);
  assert.ok(row(w, "Ember 7").rate !== null, "measured once it has a day of sales");
  w.ctx._dtBoardRender();
  assert.match(w.ctx._dtBoard.view.sum.textContent, /\d sold a day/);
});
test("stopped with Sell: greyed 'Not on sale' row at the bottom, no rate", () => {
  const w = world();
  w.api.sample();
  day(w);
  w.gv.SubPage = 1;
  w.gv.MiniPage = 1;
  assert.ok(w.sell.stop(w.sell.types[0], w.phones, 0) > 0);
  day(w);
  const rows = w.api.logic.sortRows(w.api.rows(), "profit", "desc");
  same(rows.map((r) => [r.name, r.off]), [["Folio", false], ["Ember 6", true], ["Ember 6 Pro", true]]);
  const e6 = row(w, "Ember 6");
  same([e6.off, e6.rate, e6.restock, e6.pop], [true, null, false, 0]);
});
test("sort: profit first by default, header taps re-sort, stopped rows stay last", () => {
  const w = world();
  const L = w.api.logic;
  const rows = [
    { name: "A", profit: 5, price: 9, stock: 10, rate: 1, pop: 50, off: false },
    { name: "B", profit: 9, price: 1, stock: 10, rate: null, pop: 70, off: false },
    { name: "C", profit: 99, price: 5, stock: 10, rate: 1, pop: 0, off: true },
    { name: "D", profit: 7, price: 3, stock: 0, rate: 2, pop: 10, off: false, restock: true },
  ];
  same(L.sortRows(rows, "profit", "desc").map((r) => r.name), ["B", "D", "A", "C"]);
  same(L.sortRows(rows, "profit", "asc").map((r) => r.name), ["A", "D", "B", "C"]);
  same(L.sortRows(rows, "price", "desc").map((r) => r.name), ["A", "D", "B", "C"]);
  same(L.sortRows(rows, "device", "asc").map((r) => r.name), ["A", "B", "D", "C"]);
  same(L.sortRows(rows, "runs", "desc").map((r) => r.name), ["D", "A", "B", "C"]);
});
test("row tap, same screen: pages like the game's arrows (SubPage, edition, UI)", () => {
  const w = world();
  w.api.jump(row(w, "Ember 6 Pro"));
  same(w.runtime.calls, [["MySmartphonesUI", 1, 1, 1, 1]]);
  same(w.runtime.gone, []);
});
test("row tap, other type: opens that screen like the hub, then pages", () => {
  const w = world();
  w.api.jump(row(w, "Folio"));
  same(w.runtime.gone, ["MY LAPTOPS"]);
  same([w.gv.class, w.gv.LastClass], ["MY LAPTOPS", "MY SMARTPHONES"]);
  const pend = () => vm.runInContext("_dtBoardPending()", w.ctx);
  pend();
  same(w.runtime.calls, []); // still on the old layout
  w.runtime.layout.name = "MY LAPTOPS";
  w.gv.SubPage = 1; // the screen's own start
  pend();
  w.tick(500);
  pend();
  same(w.runtime.calls, []); // waits for the screen to draw page 1
  w.tick(500);
  pend();
  same(w.runtime.calls, [["MyLaptopsUI", 1, 0, 1, 1]]);
  pend();
  assert.equal(w.runtime.calls.length, 1);
});
test("a new release shifting rows still pages to the right device", () => {
  const w = world();
  const r = row(w, "Ember 6 Pro");
  // The game pushes a new device line to the front: everything moves one x on.
  const p = w.phones, old = new Map(p.c);
  p.setSize(4, 3, 12);
  p.c = new Map();
  for (const [k, v] of old) { const [x, y, z] = k.split(",").map(Number); p.setAt(v, x + 1, y, z); }
  put(p, 0, 0, { created: 0, pop: 0, cost: 1, sell: 2, rating: "---", release: -1, name: "Ember 8", id: 9 });
  w.api.jump(r);
  same(w.runtime.calls, [["MySmartphonesUI", 2, 1, 1, 1]]);
});
test("read only: the board never writes a device cell", () => {
  const w = world();
  w.api.sample();
  day(w);
  const before = cells(w);
  for (let i = 0; i < 5; i++) { w.api.sample(); w.api.rows(); }
  w.api.logic.sortRows(w.api.rows(), "pop", "asc");
  assert.equal(cells(w), before);
});
test("profit so far keeps what was made before a Sell price change", () => {
  const w = world(), t = w.sell.types[0];
  assert.equal(row(w, "Ember 6").profit, 7200000);
  w.sell.setPrice(t, w.phones, 0, 0, 277); // to the cost price
  assert.equal(row(w, "Ember 6").profit, 7200000, "not wiped to $0");
  day(w);
  assert.equal(row(w, "Ember 6").profit, 7200000, "sales at cost add nothing");
  assert.equal(row(w, "Ember 6 Pro").profit, w.ctx._slotProfit({ solded: w.phones.getAt(0, 1, 1), sell: 449, cost: 335 }), "unchanged editions: the game's figure");
});

console.log(pass + " tests passed");
