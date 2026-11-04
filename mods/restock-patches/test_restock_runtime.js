// Runtime test for restock.js on top of the game's REAL daily sales engine: the
// DeviceSales block (Z13 ... tickDeviceSalesFor) is cut out of c3main.js and
// run in a vm with a small fake Construct runtime, then sell.js, board.js and
// restock.js are loaded in build order.
// Usage: node test_restock_runtime.js [c3main.js]
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const HERE = __dirname;
const C3MAIN = process.argv[2] || path.join(HERE, "../../game-files/scripts/c3main.js");
const game = fs.readFileSync(C3MAIN, "utf8");
const a0 = game.indexOf("var Z13={CREATED:0"), a1 = game.indexOf("function _collectActive");
assert.ok(a0 > 0 && a1 > a0, "DeviceSales block not found in c3main.js");
const ENGINE = game.slice(a0, a1);
const SRC = {
  sell: fs.readFileSync(path.join(HERE, "../sell-patches/sell.js"), "utf8"),
  board: fs.readFileSync(path.join(HERE, "../board-patches/board.js"), "utf8"),
  restock: fs.readFileSync(path.join(HERE, "restock.js"), "utf8"),
};

// Construct-like 3D array (x, y, z), 0 by default.
class Arr {
  constructor(w, h, d) { this.width = w; this.height = h; this.depth = d; this.c = new Map(); }
  getAt(x, y, z) { const k = x + "," + (y || 0) + "," + (z || 0); return this.c.has(k) ? this.c.get(k) : 0; }
  setAt(v, x, y, z) { this.c.set(x + "," + (y || 0) + "," + (z || 0), v); }
  setSize(w, h, d) { this.width = w; this.height = h; this.depth = d; }
}
// Device row: CREATED, SOLDED, POP, COST, SELL, RATING, HYPE, RELEASE, NAME, date, ID.
function put(a, x, y, r) {
  const v = [r.created, r.sold || 0, r.pop, r.cost, r.sell, r.rating, 0, r.release, r.name, "06.07.2013", r.id];
  v.forEach((val, z) => a.setAt(val, x, y, z));
}
const NONE = { created: -1, pop: 0, cost: 0, sell: 0, rating: 0, release: -1, name: "", id: 0 };

// Ember 7 (x0, one edition) and Ember 6 (x1, Budget + Pro): each a few days of stock from selling out.
function world(opts) {
  opts = opts || {};
  const phones = new Arr(2, 3, 12);
  put(phones, 0, 0, { created: 3e6, sold: 2.9e6, pop: 100, cost: 230, sell: 399, rating: 9, release: 2740, name: "Ember 7", id: 8 });
  put(phones, 0, 1, NONE);
  put(phones, 0, 2, NONE);
  put(phones, 1, 0, { created: 3e6, sold: 2.95e6, pop: 100, cost: 277, sell: 349, rating: 8, release: 2700, name: "Ember 6", id: 6 });
  put(phones, 1, 1, { created: 1e6, sold: 0.98e6, pop: 100, cost: 335, sell: 449, rating: 7, release: 2700, name: "Ember 6 Pro", id: 7 });
  put(phones, 1, 2, NONE);
  const saves = opts.saves || new Arr(3, 200, 1);
  const arrays = { ArraySmartphones: phones, ArraySaves: saves, ArraySellingDevices: new Arr(15, 1, 1), ArrayNotifications: new Arr(0, 1, 1) };
  if (opts.contractEnd) {
    const b = new Arr(4, 1, 1);
    b.setAt(5e6, 0, 0, 0);
    b.setAt(opts.contractEnd, 1, 0, 0);
    arrays.ArrayBatchCompany = b;
  }
  for (const n of ["ArrayTablets", "ArrayLaptops", "ArrayWatches", "ArrayHeadphones", "ArrayTV", "ArrayScooters", "ArrayKeyboards",
    "ArrayConsoles", "ArrayGamepads", "ArrayVRConsoles"]) arrays[n] = new Arr(0, 3, 12);
  const objects = {};
  for (const n in arrays) objects[n] = { getFirstInstance: () => arrays[n] };
  const gv = Object.assign({ DayTotal: 2744, Year: 2015, Month: 7, Fans: 2e6, Budget: 2e9, SaveSlot: 0, CompanyName: "Ember",
    LanguageChoose: 0, class: "MY SMARTPHONES", SubPage: 1, MiniPage: 1, DeviceShowFlagmanID: 0 }, opts.gv || {});
  const runtime = { objects, globalVars: gv, layout: { name: "MY SMARTPHONES" }, callFunction() {} };
  const M = Object.create(Math);
  M.random = () => 0.5; // fixed jitter: runs differ only by the rule
  const ui = {
    t: (e, v) => { let s = e.en; for (const k in v || {}) s = s.split("{" + k + "}").join(String(v[k])); return s; },
    gv: (n, d) => (gv[n] === undefined ? d : gv[n]), num: (n, d) => { const v = Number(gv[n]); return Number.isFinite(v) ? v : d; },
    ru: () => false, isOpen: () => false, toasts: [], toast(t, k) { this.toasts.push([t, k]); },
  };
  const ctx = { console, Math: M, Number, String, Map, Set, Array, Object, JSON, isFinite, isNaN, Int32Array, Error, Date,
    runtime, _dtUi: ui, perkMul: () => 1, perkAdd: () => 0, taxAccrueSales() {}, taxAccrueOther() {}, syncGamepadBundle() {},
    estimateSalaryNow: () => ({ total: opts.wages === undefined ? 1.5e6 : opts.wages, count: 12, factor: 1 }) };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(ENGINE, ctx, { filename: "c3main-DeviceSales" });
  // The game's sold-out card goes to its notification queue: count them.
  ctx.notes = [];
  vm.runInContext("_pushFrontQueue = function (rt, arr, v) { notes.push(v); };", ctx);
  if (opts.plain) return { ctx, phones, saves, gv, ui };
  ctx.timers = [];
  if (opts.noSell) ctx.setInterval = (f) => ctx.timers.push(f);
  else {
    vm.runInContext(SRC.sell, ctx, { filename: "sell.js" });
    vm.runInContext(SRC.board, ctx, { filename: "board.js" });
  }
  vm.runInContext(SRC.restock, ctx, { filename: "restock.js" });
  return { ctx, phones, saves, gv, ui, api: ctx._dtRestockApi };
}
function day(w) {
  w.gv.DayTotal++;
  return vm.runInContext("tickDeviceSales(runtime.globalVars.DayTotal, runtime)", w.ctx);
}
// Run n days; returns {made: units restocked, spent: Budget lost to restocks (from CREATED growth x cost)}.
function run(w, n, x, y) {
  const c0 = w.phones.getAt(x, y, 0);
  for (let i = 0; i < n; i++) day(w);
  return w.phones.getAt(x, y, 0) - c0;
}
const same = (a, b, m) => assert.equal(JSON.stringify(a), JSON.stringify(b), m);
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log("ok -", name); };

// ── Pure rules ──
test("numbers, keys, save text", () => {
  const L = world().api.logic;
  same(["950", "4.5k", "40k", "1.2M", "9.2M", "2B"].map(String), [950, 4500, 40000, 1.2e6, 9.2e6, 2e9].map(L.short));
  assert.equal(L.money(9.2e6), "$9.2M");
  // Rounding up to 1000 moves to the next unit.
  same(["999k", "1M", "1M", "999.9M", "1B"], [999499, 999500, 999999, 999949999, 999950000].map(L.short));
  assert.equal(L.key("ArraySmartphones", 8, 2740, "Ember 7"), "ArraySmartphones#8@2740");
  const raw = L.serialize({ "ArraySmartphones#8@2740": "off", "ArraySmartphones#6@2700": "careful", x: "auto" }, "Ember");
  same(JSON.parse(raw), { v: 1, company: "Ember", modes: { "ArraySmartphones#8@2740": "off", "ArraySmartphones#6@2700": "careful" } });
  same(L.parse(raw, "Ember"), { "ArraySmartphones#8@2740": "off", "ArraySmartphones#6@2700": "careful" });
  same(L.parse(raw, "Nova"), {});
  for (const old of [0, "", "{bad", '{"v":2,"company":"Ember","modes":{"a":"off"}}', '{"v":1,"company":"Ember","modes":{"a":"wild"}}', null])
    same(L.parse(old, "Ember"), {});
  assert.equal(L.serialize({ a: "auto" }, "Ember"), "");
});
test("cash line and the Careful money cap", () => {
  const L = world().api.logic;
  assert.equal(L.cashLine(0), 1e6);
  assert.equal(L.cashLine(300000), 1e6);
  assert.equal(L.cashLine(1.5e6), 3e6);
  const cfg = { RESTOCK_SELF_PCT: 0.12, RESTOCK_BUDGET_PCT: 0.35, RESTOCK_NEG_DEBT: true, KEEP: 1 };
  // Plenty of cash: 15% of it a day.
  const c = L.carefulCfg(cfg, 1e8, { earned: 0, restockCost: 0, contractFee: 0 }, 3e6);
  assert.ok(Math.abs(c.RESTOCK_BUDGET_PCT * 1e8 - 1.5e7) < 1e-3);
  same([c.RESTOCK_SELF_PCT, c.RESTOCK_MAX_PCT, c.RESTOCK_COVER_DAYS, c.RESTOCK_TAIL_COVER, c.RESTOCK_NEG_DEBT, c.RESTOCK_NEG_REINVEST, c.KEEP],
    [0.06, 0.125, 1.5, 2.5, false, 0, 1]);
  assert.equal(cfg.RESTOCK_SELF_PCT, 0.12, "the game's own settings object is never changed");
  // Close to the line: only the cash above it (spent earlier today counts).
  const d = { earned: 1e6, restockCost: 2e6, contractFee: 0 };
  const n = L.carefulCfg(cfg, 1e8, d, 9.8e7);
  assert.ok(Math.abs(n.RESTOCK_BUDGET_PCT * 1e8 - d.restockCost - 1e6) < 1e-3, "1e8 + 1e6 - 2e6 - 9.8e7 = $1M left to spend");
  assert.equal(L.carefulCfg(cfg, 1e7, d, 1e6), null, "$2M already spent of a $1.5M day cap");
  assert.equal(L.carefulCfg(cfg, 3e6, { earned: 0, restockCost: 0, contractFee: 0 }, 3e6), null, "at the line: nothing");
  assert.equal(L.carefulCfg(cfg, -5e6, { earned: 9e9, restockCost: 0, contractFee: 0 }, 1e6), null, "in debt: nothing");
});

// ── Rules on the real engine ──
test("Auto is the game's own restock, unchanged, now with a toast", () => {
  const plain = world({ plain: true }), w = world();
  for (let i = 0; i < 12; i++) { day(plain); day(w); }
  same([0, 1].map((x) => w.phones.getAt(x, 0, 0)), [0, 1].map((x) => plain.phones.getAt(x, 0, 0)), "same stock made");
  assert.equal(w.gv.Budget, plain.gv.Budget, "same cash");
  assert.ok(w.phones.getAt(0, 0, 0) > 3e6, "the game restocked Ember 7");
  assert.ok(w.ui.toasts.length > 0);
  assert.match(w.ui.toasts[0][0], /^Restocked [\d.]+[kM]? (Ember 7|Ember 6( Pro)?) \(\$[\d.]+[kMB]?\)$|^Restocked \d devices for \$[\d.]+[kMB]?: /);
  console.log("   first toast: " + w.ui.toasts[0][0]);
});
test("Careful: smaller orders, never below the cash line, never into debt", () => {
  const auto = world(), care = world();
  care.api.setModel("ArraySmartphones", care.phones, 0, "careful");
  const b0 = care.gv.Budget;
  // Orders, day by day, until each has restocked 3 times.
  const orders = (v) => { const o = []; for (let i = 0; i < 40 && o.length < 3; i++) { const m = run(v, 1, 0, 0); if (m > 0) o.push(m); } return o; };
  const oa = orders(auto), oc = orders(care);
  console.log("   Ember 7 orders: Auto " + oa.join(", ") + "; Careful " + oc.join(", "));
  assert.equal(oc.length, 3);
  for (let i = 0; i < 3; i++) assert.ok(oc[i] > 0 && oc[i] <= oa[i] * 0.6, "Careful order " + i + " about half of Auto's");
  // Each Careful order is at most 15% of the day's cash.
  const one = world();
  one.api.setModel("ArraySmartphones", one.phones, 0, "careful");
  for (let x = 1; x < 2; x++) for (const y of [0, 1]) one.phones.setAt(0, x, y, 2); // only Ember 7 sells
  one.phones.setAt(one.phones.getAt(0, 0, 1) + 10, 0, 0, 0); // 10 left: sells out today
  one.gv.Budget = 2e7;
  const c0 = one.phones.getAt(0, 0, 0);
  day(one);
  const spent = (one.phones.getAt(0, 0, 0) - c0) * 230;
  assert.ok(spent > 0 && spent <= 2e7 * 0.15 + 230, "spent " + spent + " of $20M");
  // Cash near the line ($3M = two months of $1.5M wages): only what is above it.
  const low = world();
  low.api.setModel("ArraySmartphones", low.phones, 0, "careful");
  for (const y of [0, 1]) low.phones.setAt(0, 1, y, 2);
  low.phones.setAt(low.phones.getAt(0, 0, 1) + 10, 0, 0, 0);
  low.gv.Budget = 3.2e6;
  const r = day(low);
  assert.ok(low.gv.Budget >= 3e6, "cash " + low.gv.Budget + " stays above the $3M line");
  assert.ok(low.phones.getAt(0, 0, 0) > low.phones.getAt(0, 0, 1) - 10 || r, "ran");
  // In debt: Auto restocks on credit, Careful does not.
  const debtA = world(), debtC = world();
  debtC.api.setModel("ArraySmartphones", debtC.phones, 0, "careful");
  for (const v of [debtA, debtC]) {
    for (const y of [0, 1]) v.phones.setAt(0, 1, y, 2);
    v.phones.setAt(v.phones.getAt(0, 0, 1) + 10, 0, 0, 0);
    v.gv.Budget = -5e6;
  }
  assert.ok(run(debtA, 1, 0, 0) > 0, "Auto restocks on credit");
  assert.equal(run(debtC, 3, 0, 0), 0, "Careful waits");
  assert.ok(b0 > 0);
});
test("restock fees land in the game's finance ledger (game update 1.6), so its money stats add up", () => {
  for (const mode of ["auto", "careful"]) {
    const w = world(), book = {};
    w.ctx.financeRecord = (k, v) => (book[k] = (book[k] || 0) + v);
    w.api.setModel("ArraySmartphones", w.phones, 0, mode);
    const b0 = w.gv.Budget, made = run(w, 20, 0, 0);
    assert.ok(made > 0, mode + ": restocked");
    assert.ok(book.production < 0, mode + ": restock spend booked as Production");
    assert.equal(Math.round(book.sales + book.production), Math.round(w.gv.Budget - b0), mode + ": nothing left for 'Other'");
  }
});
test("Off: sells out and stays sold out; the game's sold-out message still comes", () => {
  const w = world();
  w.api.setModel("ArraySmartphones", w.phones, 0, "off");
  const made = w.phones.getAt(0, 0, 0);
  for (let i = 0; i < 30; i++) day(w);
  assert.equal(w.phones.getAt(0, 0, 0), made, "no restock");
  assert.equal(w.phones.getAt(0, 0, 1), made, "every unit sold");
  assert.ok(w.phones.getAt(0, 0, 2) > 0, "still listed with popularity (not Stop selling)");
  assert.ok(w.ctx.notes.length >= 1, "BATCH SOLDED card");
  assert.ok(!w.ui.toasts.some((t) => /Ember 7/.test(t[0])), "no restock toast for Ember 7");
  assert.ok(w.phones.getAt(1, 0, 0) > 3e6, "Ember 6 (Auto) still restocks");
  // Back to Auto: the game restocks it again.
  w.api.setModel("ArraySmartphones", w.phones, 0, "auto");
  assert.ok(run(w, 2, 0, 0) > 0);
});
test("one toast for a day with several restocks; none for a contract restock", () => {
  const w = world();
  for (const [x, y] of [[0, 0], [1, 0], [1, 1]]) w.phones.setAt(w.phones.getAt(x, y, 1) + 5, x, y, 0);
  day(w);
  assert.equal(w.ui.toasts.length, 1);
  // Biggest spend first: Ember 6 ($277 a unit), Ember 6 Pro, Ember 7.
  assert.match(w.ui.toasts[0][0], /^Restocked 3 devices for \$[\d.]+[kMB]?: [\d.]+[kM]?\u00A0Ember 6, [\d.]+[kM]?\u00A0Ember 6 Pro, [\d.]+[kM]?\u00A0Ember 7$/);
  assert.match(w.ui.toasts[0][1], /^\$[\d.]+[kMB]?$/);
  console.log("   " + w.ui.toasts[0][0]);
  const c = world({ contractEnd: 99999 });
  c.phones.setAt(c.phones.getAt(0, 0, 1) + 5, 0, 0, 0);
  const m = run(c, 1, 0, 0);
  assert.ok(m > 0, "contract restock happened");
  assert.equal(c.ui.toasts.length, 0, "the game shows its own contract message");
  const l = world().api.logic, t = (k, v) => ({ one: "1 {u} {n} {c}", many: "{k}|{c}|{list}", item: "{u} {n}", more: "{list} +{m}" })[k].replace(/\{(\w)\w*\}/g, (_, a) => v[Object.keys(v).find((q) => q[0] === a)]);
  assert.equal(l.toastText([{ name: "A", units: 1, cost: 5 }, { name: "B", units: 2, cost: 9 }, { name: "C", units: 3, cost: 1 }, { name: "D", units: 4, cost: 7 }], t),
    "4|$22|2 B, 4 D, 1 A +1");
});
test("save, reload, other company, old saves", () => {
  const w = world();
  assert.equal(w.api.setModel("ArraySmartphones", w.phones, 1, "careful"), 2, "both Ember 6 editions");
  w.api.setModel("ArraySmartphones", w.phones, 0, "off");
  const raw = w.saves.getAt(0, 156, 0);
  same(JSON.parse(raw), { v: 1, company: "Ember", modes: { "ArraySmartphones#6@2700": "careful", "ArraySmartphones#7@2700": "careful", "ArraySmartphones#8@2740": "off" } });
  const saves = new Arr(3, 200, 1);
  saves.setAt(raw, 0, 156, 0);
  const r = world({ saves });
  assert.equal(r.api.mode("ArraySmartphones#8@2740"), "off");
  assert.equal(r.api.modelMode("ArraySmartphones", r.phones, 1, 1), "careful");
  const made = r.phones.getAt(0, 0, 0);
  for (let i = 0; i < 20; i++) day(r);
  assert.equal(r.phones.getAt(0, 0, 0), made, "Off kept after reload");
  same(world({ saves, gv: { CompanyName: "Nova" } }).api.modes(), {}, "another company: all Auto");
  const old = world();
  assert.equal(old.api.mode("ArraySmartphones#8@2740"), "auto", "old save: Auto");
  for (let i = 0; i < 3; i++) day(old);
  assert.equal(old.saves.getAt(0, 156, 0), 0, "nothing written until a rule is picked");
  // All back to Auto clears the row; a load that replaces the row is picked up.
  w.api.setModel("ArraySmartphones", w.phones, 0, "auto");
  w.api.setModel("ArraySmartphones", w.phones, 1, "auto");
  assert.equal(w.saves.getAt(0, 156, 0), "");
  w.saves.setAt(raw, 0, 156, 0);
  assert.equal(w.api.mode("ArraySmartphones#8@2740"), "off");
});
test("New Game clears the slot's rules; Load Game keeps them", () => {
  const w = world();
  w.api.setModel("ArraySmartphones", w.phones, 0, "off");
  const raw = w.saves.getAt(0, 156, 0);
  w.saves.setAt("other slot", 1, 156, 0);
  const sellTick = () => { try { vm.runInContext("_dtSellTick()", w.ctx); } catch (e) {} };
  w.ctx.runtime.layout.name = "LOADING GAME";
  w.gv.LoadingType = "LOAD GAME";
  sellTick();
  assert.equal(w.saves.getAt(0, 156, 0), raw, "Load Game keeps the row");
  assert.equal(w.api.mode("ArraySmartphones#8@2740"), "off");
  w.gv.LoadingType = "NEW GAME";
  sellTick();
  assert.equal(w.saves.getAt(0, 156, 0), "", "New Game clears the row");
  assert.equal(w.saves.getAt(1, 156, 0), "other slot", "other slots untouched");
  same(w.api.state().modes, {}, "nothing kept in memory");
  // Same company name in the new game: all Auto, and the old rules are never saved back.
  w.ctx.runtime.layout.name = "MY SMARTPHONES";
  assert.equal(w.api.mode("ArraySmartphones#8@2740"), "auto");
  w.api.setModel("ArraySmartphones", w.phones, 1, "careful");
  same(Object.keys(JSON.parse(w.saves.getAt(0, 156, 0)).modes), ["ArraySmartphones#6@2700", "ArraySmartphones#7@2700"]);
  // An already empty row is left alone.
  const fresh = world();
  fresh.ctx.runtime.layout.name = "LOADING GAME";
  fresh.gv.LoadingType = "NEW GAME";
  try { vm.runInContext("_dtSellTick()", fresh.ctx); } catch (e) {}
  assert.equal(fresh.saves.getAt(0, 156, 0), 0, "empty row not written");
});
test("without Sell, New Game still clears the slot's rules (restock's own timer)", () => {
  const w = world({ noSell: true });
  w.saves.setAt('{"v":1,"company":"Ember","modes":{"ArraySmartphones#8@2740":"off"}}', 0, 156, 0);
  w.ctx.runtime.layout.name = "LOADING GAME";
  w.gv.LoadingType = "NEW GAME";
  assert.equal(w.ctx.timers.length, 1, "one timer of its own");
  w.ctx.timers[0]();
  assert.equal(w.saves.getAt(0, 156, 0), "", "New Game clears the row");
});
test("board rows carry the rule; Off is never 'Restocking'", () => {
  const w = world();
  w.api.setModel("ArraySmartphones", w.phones, 0, "off");
  w.api.setModel("ArraySmartphones", w.phones, 1, "careful");
  const rows = vm.runInContext("_dtBoardRows()", w.ctx);
  const by = {};
  for (const r of rows) by[r.name] = [r.rmode, r.restock];
  same(by, { "Ember 7": ["off", false], "Ember 6": ["careful", true], "Ember 6 Pro": ["careful", true] });
  // Cash at or under Careful's line (two months of wages): it will not restock, so no "Restocking".
  w.gv.Budget = 2e6;
  const low = {};
  for (const r of vm.runInContext("_dtBoardRows()", w.ctx)) low[r.name] = [r.rmode, r.restock];
  same(low, { "Ember 7": ["off", false], "Ember 6": ["careful", false], "Ember 6 Pro": ["careful", false] });
});
test("board: Careful with cash at or below its line (two months of wages) does not say 'Restocking'", () => {
  const w = world({ wages: 1.5e6 }); // line $3M
  w.api.setModel("ArraySmartphones", w.phones, 1, "careful");
  const restock = () => vm.runInContext("_dtBoardRows()", w.ctx).filter((r) => r.rmode === "careful").map((r) => r.restock);
  same(restock(), [true, true], "plenty of cash");
  w.gv.Budget = 2.9e6; w.gv.DayTotal++; // the line is worked out once a day
  same(restock(), [false, false], "below the line: Careful will not restock");
});

test("at or below cost the note says there is no restock", () => {
  const w = world(), v = () => w.ctx._dtSellView();
  assert.match(w.ctx._dtSellNoteText(v(), "selling"), /^Restock Auto/);
  w.phones.setAt(230, 0, 0, 4); // Ember 7 at its cost price
  assert.match(w.ctx._dtSellNoteText(v(), "selling"), /^No restock at this price/);
  w.phones.setAt(200, 0, 0, 4);
  assert.match(w.ctx._dtSellNoteText(v(), "selling"), /^No restock at this price/);
  w.phones.setAt(231, 0, 0, 4);
  assert.match(w.ctx._dtSellNoteText(v(), "selling"), /^Restock Auto/);
});

console.log(pass + " restock runtime tests passed");
