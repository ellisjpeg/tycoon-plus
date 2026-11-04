// Runtime test for sell.js on top of the game's REAL daily sales engine: the
// DeviceSales block (Z13 ... tickDeviceSalesFor) is cut out of c3main.js and
// run in a vm with a small fake Construct runtime, then sell.js is loaded.
// Usage: node test_sell_runtime.js [c3main.js] [sell.js]
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const HERE = __dirname;
const C3MAIN = process.argv[2] || path.join(HERE, "../../game-files/scripts/c3main.js");
const SELL = process.argv[3] || path.join(HERE, "sell.js");
const game = fs.readFileSync(C3MAIN, "utf8");
const a0 = game.indexOf("var Z13={CREATED:0"), a1 = game.indexOf("function _collectActive");
assert.ok(a0 > 0 && a1 > a0, "DeviceSales block not found in c3main.js");
const ENGINE = game.slice(a0, a1);

// Construct-like 3D array (x, y, z), 0 by default.
class Arr {
  constructor(w, h, d) { this.width = w; this.height = h; this.depth = d; this.c = new Map(); }
  getAt(x, y, z) { const k = x + "," + (y || 0) + "," + (z || 0); return this.c.has(k) ? this.c.get(k) : 0; }
  setAt(v, x, y, z) { this.c.set(x + "," + (y || 0) + "," + (z || 0), v); }
  setSize(w, h, d) { this.width = w; this.height = h; this.depth = d; }
}
// Device row: CREATED, SOLDED, POP, COST, SELL, RATING, HYPE, RELEASE, NAME, date, ID.
function put(a, x, y, r) {
  const v = [r.created, r.sold || 0, r.pop, r.cost, r.sell, r.rating, 0, r.release, r.name, "", r.id];
  v.forEach((val, z) => a.setAt(val, x, y, z));
}
function emptyRows(a, from) {
  for (let x = from; x < a.width; x++) for (let y = 0; y < 3; y++) { a.setAt(-1, x, y, 0); a.setAt(-1, x, y, 7); }
}

function world(opts) {
  opts = opts || {};
  const phones = new Arr(2, 3, 12);
  // Ember 6 (x0): Budget + Pro editions; Ember 5 (x1): one edition.
  put(phones, 0, 0, { created: 3e6, pop: 100, cost: 277, sell: 349, rating: 8, release: 2700, name: "Ember 6", id: 6 });
  put(phones, 0, 1, { created: 1e6, pop: 100, cost: 335, sell: 449, rating: 7, release: 2700, name: "Ember 6 Pro", id: 7 });
  put(phones, 0, 2, { created: -1, pop: 0, cost: 0, sell: 0, rating: 0, release: -1, name: "", id: 0 });
  put(phones, 1, 0, { created: 3e6, pop: 100, cost: 260, sell: 329, rating: 8, release: 2400, name: "Ember 5", id: 5 });
  for (const y of [1, 2]) put(phones, 1, y, { created: -1, pop: 0, cost: 0, sell: 0, rating: 0, release: -1, name: "", id: 0 });
  const saves = opts.saves || new Arr(3, 200, 1);
  const objects = {};
  const arrays = { ArraySmartphones: phones, ArraySaves: saves, ArraySellingDevices: new Arr(15, 1, 1), ArrayMarketingDevices_Temp: new Arr(0, 6, 1) };
  for (const n of ["ArrayTablets", "ArrayLaptops", "ArrayWatches", "ArrayHeadphones", "ArrayTV", "ArrayScooters", "ArrayKeyboards",
    "ArrayConsoles", "ArrayGamepads", "ArrayVRConsoles"]) arrays[n] = new Arr(0, 3, 12);
  for (const n in arrays) objects[n] = { getFirstInstance: () => arrays[n] };
  const gv = Object.assign({ DayTotal: 2744, Year: 2015, Month: 7, Fans: 2e6, Budget: 1e10, SaveSlot: 0, CompanyName: "Ember",
    LanguageChoose: 0, class: "MY SMARTPHONES", SubPage: 1, MiniPage: 1, DeviceShowFlagmanID: 0 }, opts.gv || {});
  const runtime = { objects, globalVars: gv, layout: { name: "MY SMARTPHONES" }, calls: [], callFunction(n) { this.calls.push(n); } };
  // Fixed jitter so day-to-day changes come from the price/stop only.
  const M = Object.create(Math);
  M.random = () => 0.5;
  const ui = {
    t: (e, v) => { let s = e.en; for (const k in v || {}) s = s.split("{" + k + "}").join(String(v[k])); return s; },
    gv: (n, d) => (gv[n] === undefined ? d : gv[n]), num: (n, d) => { const v = Number(gv[n]); return Number.isFinite(v) ? v : d; },
    ru: () => false, isOpen: () => false, toasts: [], toast(t, k) { this.toasts.push([t, k]); },
  };
  const ctx = { console, Math: M, Number, String, Map, Set, Array, Object, JSON, isFinite, isNaN, Int32Array, Error, Date,
    runtime, _dtUi: ui, perkMul: () => 1, perkAdd: () => 0, taxAccrueSales() {}, taxAccrueOther() {}, syncGamepadBundle() {} };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(ENGINE, ctx, { filename: "c3main-DeviceSales" });
  // The Marketing list filler (same column layout as the game's fillMarketingDevicesTemp).
  vm.runInContext(`var DEVICE_ARRAYS3 = [{ name: "ArraySmartphones", marketingType: "SMARTPHONES" }, { name: "ArrayGamepads", marketingType: null }];
    function fillMarketingDevicesTemp(rt) {
      const a = rt.objects.ArraySmartphones.getFirstInstance(), t = rt.objects.ArrayMarketingDevices_Temp.getFirstInstance(), r = [];
      for (let x = 0; x < a.width; x++) for (let y = 0; y < 3; y++) {
        if (a.getAt(x, y, 0) === -1 || a.getAt(x, y, 7) < 0) continue;
        r.push(["SMARTPHONES", a.getAt(x, y, 10), a.getAt(x, y, 2), a.getAt(x, y, 8), a.getAt(x, y, 5), a.getAt(x, y, 7)]);
      }
      t.setSize(r.length, 6, 1);
      r.forEach((row, x) => row.forEach((v, y) => t.setAt(v, x, y, 0)));
      return r.length;
    }`, ctx, { filename: "marketing-fake" });
  vm.runInContext(fs.readFileSync(SELL, "utf8"), ctx, { filename: "sell.js" });
  return { ctx, phones, saves, gv, runtime, ui, api: ctx._dtSellApi };
}
// One game day: the event calls tickDeviceSales(DayTotal, runtime) by name.
function day(w) {
  w.gv.DayTotal++;
  return vm.runInContext("tickDeviceSales(runtime.globalVars.DayTotal, runtime)", w.ctx);
}
function soldOver(w, x, y, n) {
  const s0 = w.phones.getAt(x, y, 1);
  for (let i = 0; i < n; i++) day(w);
  return w.phones.getAt(x, y, 1) - s0;
}
const T = w => w.api.types[0];
// vm objects come from another realm: compare as JSON.
const same = (a, b, m) => assert.equal(JSON.stringify(a), JSON.stringify(b), m);
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log("ok -", name); };

// ── Pure rules ──
test("limits, clamp and steps", () => {
  const L = world().api.logic;
  same(L.limits(277, 349), { lo: 1, hi: 1385 });
  assert.equal(L.limits(1, 1).hi, 10);
  assert.equal(L.limits(100, 900).hi, 900); // an old price above 5x cost can always be kept
  assert.equal(L.clamp(0, 277, 349), 1);
  assert.equal(L.clamp(-50, 277, 349), 1);
  assert.equal(L.clamp(1e12, 277, 349), 1385);
  assert.equal(L.clamp("$1,234", 277, 349), 1234);
  assert.equal(L.clamp("599.4", 277, 349), 599);
  // An emptied field is not a price of $1.
  assert.equal(L.clamp("", 277, 349), null);
  assert.equal(L.clamp("  $ ", 277, 349), null);
  assert.equal(L.clamp("abc", 277, 349), null);
  assert.equal(L.clamp(NaN, 277, 349), null);
  assert.equal(L.clamp(Infinity, 277, 349), null);
  same([L.step(50), L.step(277), L.step(1500), L.step(20000)], [1, 5, 50, 500]);
  // Rounded down like the price card: 25.99% shows 25, a tablet at $136 on $94 (44.7%) shows 44 on both screens.
  assert.equal(L.markup(349, 277), 25);
  assert.equal(L.markup(136, 94), 44);
  assert.equal(L.markup(135, 100), 35);
  assert.equal(L.markup(210, 160), 31);
  assert.equal(L.markup(250, 277), -10);
  assert.equal(L.money(1234567), "$1,234,567");
  assert.equal(L.ratioText(1.8), "+80%");
  assert.equal(L.ratioText(0.6), "−40%");
  assert.equal(L.ratioText(1.001), "");
});
test("demand preview uses the game's own price factor", () => {
  const w = world();
  const r = w.api.logic.demandRatio(w.ctx._priceFactor, 277, 349, 299, 8, w.ctx._cfg7);
  const pf = (s) => Math.min(3, Math.max(0.25, Math.pow((1.2 + 0.045 * 8) / (s / 277), 3))); // game clamps .25..3
  assert.ok(Math.abs(r - pf(299) / pf(349)) < 1e-9);
  assert.ok(r > 1.2);
});
test("save row keys: parse, company check, old saves", () => {
  const L = world().api.logic;
  const k = L.key("ArraySmartphones", 6, 2700, "Ember 6");
  assert.equal(k, "ArraySmartphones#6@2700");
  assert.equal(L.key("ArrayTV", 0, 900, "Glow"), "ArrayTV|Glow@900");
  const raw = L.serialize([k], "Ember");
  same(L.parse(raw, "Ember"), [k]);
  same(L.parse(raw, "Other Co"), []);
  for (const old of [0, "", "0", "{bad json", '{"v":2,"company":"Ember","keys":["x"]}', null, undefined]) same(L.parse(old, "Ember"), []);
  assert.equal(L.serialize([], "Ember"), "");
});

// ── Price change on the real engine ──
test("price cut raises daily sales, raise lowers them; rating kept", () => {
  const base = world(), cut = world(), up = world();
  for (const w of [base, cut, up]) for (let i = 0; i < 3; i++) day(w);
  const t = T(cut);
  assert.equal(cut.api.setPrice(t, cut.phones, 0, 0, 299), "Price cut to $299 for Ember 6");
  assert.equal(up.api.setPrice(t, up.phones, 0, 0, 449), "Price raised to $449 for Ember 6");
  assert.equal(cut.phones.getAt(0, 0, 4), 299);
  assert.equal(cut.phones.getAt(0, 1, 4), 449, "other edition untouched");
  assert.equal(cut.phones.getAt(0, 0, 5), 8, "review score stays");
  const b = soldOver(base, 0, 0, 5), c = soldOver(cut, 0, 0, 5), u = soldOver(up, 0, 0, 5);
  console.log("   Ember 6 units over 5 days: $349 " + b + ", $299 " + c + ", $449 " + u);
  assert.ok(c > b * 1.3, "cut sells more");
  assert.ok(u < b * 0.7, "raise sells less");
  // Revenue uses the new price: day budget = units * new price for that edition.
});
test("per-edition price and guards", () => {
  const w = world(), t = T(w);
  assert.equal(w.api.setPrice(t, w.phones, 0, 1, 399), "Price cut to $399 for Ember 6 Pro");
  assert.equal(w.phones.getAt(0, 1, 4), 399);
  assert.equal(w.phones.getAt(0, 0, 4), 349);
  assert.equal(w.api.setPrice(t, w.phones, 0, 0, 0), "Price cut to $1 for Ember 6");
  assert.equal(w.phones.getAt(0, 0, 4), 1);
  assert.equal(w.api.setPrice(t, w.phones, 0, 0, 1e9), "Price raised to $1,385 for Ember 6");
  assert.equal(w.api.setPrice(t, w.phones, 0, 0, "x"), "");
  assert.equal(w.api.setPrice(t, w.phones, 0, 0, 1385), "", "same price: no change");
  w.phones.setAt(-1, 0, 2, 7);
  assert.equal(w.api.setPrice(t, w.phones, 0, 2, 500), "", "missing edition");
  w.phones.setAt(0, 1, 0, 2);
  assert.equal(w.api.setPrice(t, w.phones, 1, 0, 300), "", "POP 0: not on sale");
  w.phones.setAt(9999, 1, 0, 7);
  w.phones.setAt(100, 1, 0, 2);
  assert.equal(w.api.setPrice(t, w.phones, 1, 0, 300), "", "not released yet");
});

// ── Stop selling on the real engine ──
test("stop: no sales, no restock spend, cannibalisation drops", () => {
  const ctl = world(), w = world();
  for (const v of [ctl, w]) {
    // Ember 6 nearly sold out, so the game restocks it while it sells.
    for (const y of [0, 1]) v.phones.setAt(v.phones.getAt(0, y, 1) + 2000, 0, y, 0);
    day(v);
  }
  const e5Before = soldOver(w, 1, 0, 3);
  soldOver(ctl, 1, 0, 3);
  assert.equal(w.api.stop(T(w), w.phones, 0), 2);
  assert.equal(w.phones.getAt(0, 0, 2), 0);
  assert.equal(w.phones.getAt(0, 1, 2), 0);
  assert.equal(w.api.state(T(w), w.phones, 0, 0), "stopped");
  const created = [w.phones.getAt(0, 0, 0), w.phones.getAt(0, 1, 0)], sold = [w.phones.getAt(0, 0, 1), w.phones.getAt(0, 1, 1)];
  const cCreated = ctl.phones.getAt(0, 0, 0);
  let spend = 0, cSpend = 0;
  for (let i = 0; i < 10; i++) {
    spend += (day(w) || {}).restockCost || 0;
    cSpend += (day(ctl) || {}).restockCost || 0;
  }
  same([w.phones.getAt(0, 0, 0), w.phones.getAt(0, 1, 0)], created, "no restock");
  same([w.phones.getAt(0, 0, 1), w.phones.getAt(0, 1, 1)], sold, "no sales");
  assert.equal(spend, 0, "no restock money");
  assert.ok(ctl.phones.getAt(0, 0, 0) > cCreated && cSpend > 0, "control: the game restocks a selling device");
  console.log("   restock spend over 10 days: selling $" + cSpend + ", stopped $" + spend);
  // Ember 5 no longer shares the shelf with two Ember 6 editions.
  const e5After = soldOver(w, 1, 0, 3), e5Ctl = soldOver(ctl, 1, 0, 3);
  console.log("   Ember 5 units over 3 days: before " + e5Before + ", after stop " + e5After + ", still shared " + e5Ctl);
  assert.ok(e5After > e5Ctl * 1.2, "cannibalisation count drops");
});
test("stopped device stays at POP 0 after a marketing boost", () => {
  const w = world();
  w.api.stop(T(w), w.phones, 0);
  w.phones.setAt(45, 0, 0, 2); // applyMarketingCampaignBoost adds POP
  const s0 = w.phones.getAt(0, 0, 1);
  day(w);
  assert.equal(w.phones.getAt(0, 0, 2), 0);
  assert.equal(w.phones.getAt(0, 0, 1), s0);
  assert.equal(w.api.setPrice(T(w), w.phones, 0, 0, 300), "", "no price change once stopped");
});
test("save round trip and old saves", () => {
  const w = world();
  w.api.stop(T(w), w.phones, 0);
  const raw = w.saves.getAt(0, 154, 0);
  same(JSON.parse(raw), { v: 1, company: "Ember", keys: ["ArraySmartphones#6@2700", "ArraySmartphones#7@2700"] });
  // Reload: a fresh game with the saved row (POP is saved in the device array too, but even at 100 it is held at 0).
  const saves = new Arr(3, 200, 1);
  saves.setAt(raw, 0, 154, 0);
  const r = world({ saves });
  same(r.api.keys(), ["ArraySmartphones#6@2700", "ArraySmartphones#7@2700"]);
  assert.equal(r.api.state(T(r), r.phones, 0, 0), "stopped");
  const s0 = r.phones.getAt(0, 0, 1);
  day(r);
  assert.equal(r.phones.getAt(0, 0, 2), 0);
  assert.equal(r.phones.getAt(0, 0, 1), s0);
  // Another company in the slot ignores it; an old save (row unset) sells as before.
  const o = world({ saves, gv: { CompanyName: "Nova" } });
  same(o.api.keys(), []);
  assert.equal(o.api.state(T(o), o.phones, 0, 0), "selling");
  const old = world();
  assert.equal(old.saves.getAt(0, 154, 0), 0);
  assert.ok(soldOver(old, 0, 0, 2) > 0);
  assert.equal(old.saves.getAt(0, 154, 0), 0, "nothing written until a device is stopped");
  // A loaded save that replaces the row is picked up again.
  w.saves.setAt("", 0, 154, 0);
  w.phones.setAt(100, 0, 0, 2);
  day(w);
  assert.ok(w.phones.getAt(0, 0, 2) > 0, "row cleared by a load: device sells again");
});

test("stopped devices leave the Marketing device list", () => {
  const w = world();
  const names = () => { const t = w.ctx.runtime.objects.ArrayMarketingDevices_Temp.getFirstInstance(); return Array.from({ length: t.width }, (_, x) => t.getAt(x, 3, 0)); };
  assert.equal(vm.runInContext("fillMarketingDevicesTemp(runtime)", w.ctx), 3);
  same(names(), ["Ember 6", "Ember 6 Pro", "Ember 5"]);
  w.api.stop(T(w), w.phones, 0);
  assert.equal(vm.runInContext("fillMarketingDevicesTemp(runtime)", w.ctx), 1);
  same(names(), ["Ember 5"]);
});

test("New Game in a used slot forgets the old campaign's stopped devices", () => {
  const w = world();
  w.api.stop(T(w), w.phones, 0);
  assert.notEqual(w.saves.getAt(0, 154, 0), 0);
  w.runtime.layout.name = "LOADING GAME";
  w.gv.LoadingType = "NEW GAME";
  w.ctx._dtSellTick();
  assert.equal(w.saves.getAt(0, 154, 0), "", "row cleared");
  w.runtime.layout.name = "MY SMARTPHONES";
  same(w.api.keys(), []);
  w.phones.setAt(100, 0, 0, 2); // the new campaign's own device with the same key
  assert.equal(w.api.state(T(w), w.phones, 0, 0), "selling", "a same-keyed device of the new campaign sells");
});

// ── Profit so far across price changes ──
test("a price change keeps the profit already made; new sales use the new margin", () => {
  const w = world(), t = T(w);
  for (let i = 0; i < 3; i++) day(w);
  const s1 = w.phones.getAt(0, 0, 1), k = w.ctx._dtSellKeyAt("ArraySmartphones", w.phones, 0, 0);
  assert.ok(s1 > 0);
  const p = () => w.api.profit(k, w.phones.getAt(0, 0, 1), w.phones.getAt(0, 0, 4), 277);
  assert.equal(p(), Math.round(s1 * (349 - 277)), "before any change: the game's own sum");
  w.api.setPrice(t, w.phones, 0, 0, 277); // at cost: no profit a unit from now on
  assert.equal(p(), Math.round(s1 * 72), "profit already made stays");
  for (let i = 0; i < 3; i++) day(w);
  const s2 = w.phones.getAt(0, 0, 1);
  assert.ok(s2 > s1);
  assert.equal(p(), Math.round(s1 * 72), "units sold at cost add nothing");
  w.api.setPrice(t, w.phones, 0, 0, 400);
  for (let i = 0; i < 2; i++) day(w);
  const s3 = w.phones.getAt(0, 0, 1);
  assert.equal(p(), Math.round(s1 * 72 + (s3 - s2) * 123), "a raise does not inflate past sales");
  const w2 = world({ saves: w.saves });
  assert.equal(w2.api.profit(k, s3, 400, 277), p(), "kept in the save (row 154)");
  same(w2.api.keys(), [], "no device stopped by a price change");
  w.runtime.layout.name = "LOADING GAME";
  w.gv.LoadingType = "NEW GAME";
  w.ctx._dtSellTick();
  assert.equal(w.saves.getAt(0, 154, 0), "", "New Game clears it");
  assert.equal(w.api.profit(k, s3, 400, 277), Math.round(s3 * 123));
});

// ── An edition that stopped selling while another still sells ──
test("the viewed edition's own state; its price arrows never change another edition", () => {
  const w = world({ gv: { DeviceShowFlagmanID: 1 } });
  w.phones.setAt(0, 0, 1, 2); // Ember 6 Pro: popularity ran out, Ember 6 still sells
  const v = w.ctx._dtSellView();
  assert.equal(w.api.viewState(v, "selling", 1), "ended", "Pro tab: not on sale");
  assert.equal(w.api.viewState(v, "selling", 0), "selling");
  assert.equal(w.api.viewState(v, "stopped", 1), "stopped");
  let opts = null;
  w.ui.modal = (o) => { opts = o; return {}; };
  w.api.price(-1);
  assert.ok(opts, "the pop-up opens for the editions on sale");
  opts.buttons[1].onClick();
  assert.equal(w.phones.getAt(0, 0, 4), 349, "Ember 6 is not cut from the Pro tab's arrow");
  w.gv.DeviceShowFlagmanID = 0;
  opts = null;
  w.api.price(-1);
  opts.buttons[1].onClick();
  assert.equal(w.phones.getAt(0, 0, 4), 344, "its own tab's arrow still steps it");
});

console.log(pass + " sell runtime tests passed");
