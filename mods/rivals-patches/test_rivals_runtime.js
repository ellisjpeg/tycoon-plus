// Runtime test for rivals.js on a small fake Construct runtime: rivals-core.js
// and rivals.js run in a vm with synthetic part lists, a fake difficulty
// module and a fake tickDeviceSales (the game's own decay is not needed here).
// Usage: node test_rivals_runtime.js [rivals-core.js] [rivals.js]
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const HERE = __dirname;
const CORE = fs.readFileSync(process.argv[2] || path.join(HERE, "rivals-core.js"), "utf8");
const RIV = fs.readFileSync(process.argv[3] || path.join(HERE, "rivals.js"), "utf8");
const C = new Function(CORE + "\nreturn globalThis._dtRivCore;")();

class Arr {
  constructor(w, h, d) { this.width = w; this.height = h; this.depth = d; this.c = new Map(); }
  getAt(x, y, z) { const k = x + "," + (y || 0) + "," + (z || 0); return this.c.has(k) ? this.c.get(k) : 0; }
  setAt(v, x, y, z) { this.c.set(x + "," + (y || 0) + "," + (z || 0), v); }
}
// Synthetic part list: 2 starting rows, then one new row every 330 days to ~2043.
function list(name, col, gb) {
  const n = 40;
  const a = new Arr(n, Math.max(col + 1, 3), 1);
  for (let r = 0; r < n; r++) {
    const text = /Network|Technology|Breaks|Bluetooth/.test(name);
    const v = Math.round(10 * Math.pow(1.18, r));
    a.setAt(text ? "Gen " + r : gb ? v + " GB" : v, r, 0, 0);
    a.setAt(r < 2 ? -10 : 200 + r * 330, r, col, 0);
  }
  return a;
}
// Device row: CREATED, SOLDED, POP, COST, SELL, RATING, HYPE, RELEASE, NAME, date, ID.
function put(a, x, y, r) {
  [r.created ?? 1e6, 0, r.pop, 100, 200, r.rating ?? 6, 0, r.release, r.name, "", r.id].forEach((v, z) => a.setAt(v, x, y, z));
}
function world(opts) {
  opts = opts || {};
  const arrays = { ArraySaves: opts.saves || new Arr(3, 200, 1) };
  for (const t of Object.values(C.RIV.TYPES)) for (const s of t.specs) arrays[s.t] = arrays[s.t] || list(s.t, s.c, s.gb);
  const phones = new Arr(3, 3, 12);
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) { phones.setAt(-1, x, y, 0); phones.setAt(-1, x, y, 7); }
  put(phones, 0, 0, { pop: 100, release: opts.release ?? 2000, name: "Ember 6", id: 6 });
  put(phones, 1, 0, { pop: 0, release: 1900, name: "Ember 5", id: 5 }); // stopped / ended
  arrays.ArraySmartphones = phones;
  for (const n of ["ArrayTablets", "ArrayLaptops", "ArrayWatches", "ArrayHeadphones", "ArrayTV", "ArrayScooters", "ArrayKeyboards",
    "ArrayConsoles", "ArrayVRConsoles"]) arrays[n] = new Arr(0, 3, 12);
  const objects = {};
  for (const n in arrays) objects[n] = { getFirstInstance: () => arrays[n] };
  const gv = Object.assign({ DayTotal: 1, SaveSlot: 0, CompanyName: "Ember" }, opts.gv || {});
  const runtime = { objects, globalVars: gv };
  const ctx = { console: { warn() {}, log: console.log }, Math, Number, String, Map, Set, Array, Object, JSON, isFinite, isNaN, Error, runtime };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const preset = opts.preset || "realistic";
  vm.runInContext(`var _DT_DIFF_KEYS = ["buy", "cost", "research", "rivals", "build"];
    var _dtDiff = ${JSON.stringify(PRESETS[preset])};
    function _dtResShipped() { return _DT_DIFF_KEYS.every((k) => _dtDiff[k] === 1); }
    var ticks = [];
    function tickDeviceSales(day, rt) { ticks.push(day); }`, ctx);
  if (opts.ratings) vm.runInContext(`function _readCompanies() { return ${JSON.stringify(opts.ratings)}; }
    function _companyName(id) { return ${JSON.stringify(opts.ratings)}.find((c) => c.id === id).name; }`, ctx);
  if (opts.realNames) ctx._dtRealName = (n) => opts.realNames[n] || n;
  vm.runInContext(CORE, ctx, { filename: "rivals-core.js" });
  vm.runInContext(RIV, ctx, { filename: "rivals.js" });
  const fired = [];
  ctx._dtRivApi.onLaunch((L, info) => fired.push({ L, info }));
  // vm arrays are another realm: hand out plain copies (raw keeps the real objects).
  const raw = ctx._dtRivApi;
  const plain = (x) => JSON.parse(JSON.stringify(x));
  const api = { raw, list: () => plain(raw.list()), launchesSince: (d) => plain(raw.launchesSince(d)), state: () => plain(raw.state()),
    market: (t, d) => plain(raw.market(t, d)), onLaunch: (fn) => raw.onLaunch(fn) };
  return { ctx, arrays, phones, gv, api, fired, saves: arrays.ArraySaves };
}
const PRESETS = {
  original: { buy: 1, cost: 1, research: 1, rivals: 1, build: 1 },
  realistic: { buy: 1, cost: 1, research: 0.3, rivals: 1.1, build: 1 },
  brutal: { buy: 0.85, cost: 1.1, research: 0.25, rivals: 1.5, build: 1 },
};
function day(w, d) {
  w.gv.DayTotal = d;
  w.ctx.tickDeviceSales(d, w.ctx.runtime);
}
function run(w, from, to) {
  for (let d = from; d <= to; d++) day(w, d);
}
const row = (w) => w.saves.getAt(0, 157, 0);
const strip = (L) => ({ id: L.id, day: L.day, rows: Array.from(L.rows), name: L.name, price: L.price });

// 1. Launches appear on their plan day (not before), in order, once; row 157 only.
{
  const w = world();
  run(w, 1, 900);
  const seed = w.api.state().seed;
  const plan = [2008, 2009, 2010].flatMap((y) => C.yearPlan(y, seed)).filter((p) => p.day <= 900);
  assert.ok(plan.length >= 8, "a few launches by day 900");
  assert.deepEqual(w.fired.map((f) => f.L.id), plan.map((p) => p.id), "every plan launch fired once, in day order");
  for (const f of w.fired) assert.equal(f.info.today, f.L.day, "fired on its own plan day while time runs");
  const first = plan[0];
  const w2 = world();
  run(w2, 1, first.day - 1);
  assert.equal(w2.api.list().length, 0, "nothing before the first plan day");
  day(w2, first.day);
  assert.deepEqual(w2.api.list().map((L) => L.id), [first.id]);
  const L = w2.api.raw.list()[0];
  assert.ok(Object.isFrozen(L) && L.specs.length === C.RIV.TYPES[L.type].specs.length);
  assert.ok(L.specs.every((s) => s === null || typeof s.label === "string"), "spec labels");
  assert.ok(L.price > 0 && L.month >= 1 && L.month <= 12 && L.year === 2008 && /\d$/.test(L.name));
  const j = JSON.parse(row(w));
  assert.equal(j.v, 1);
  assert.equal(j.company, "Ember");
  assert.equal(j.last, 900);
  for (let r = 0; r < 200; r++) if (r !== 157) assert.equal(w.saves.getAt(0, r, 0), 0, "other save rows untouched");
  // never ahead of the game, no downgrades per line
  const prev = {};
  for (const L of w.api.launchesSince(0)) {
    C.RIV.TYPES[L.type].specs.forEach((s, i) => {
      assert.ok(L.rows[i] <= C.allowed(w.ctx.runtime.objects[s.t] ? listDays(w, s) : [], L.day), "never ahead");
      if (prev[L.line]) assert.ok(L.rows[i] >= prev[L.line][i], "no downgrade");
    });
    prev[L.line] = L.rows;
  }
}
function listDays(w, s) {
  const a = w.arrays[s.t];
  return Array.from({ length: a.width }, (_, r) => a.getAt(r, s.c, 0));
}

// 2. Save / reload: same list, same later launches as an uninterrupted run.
{
  const a = world();
  run(a, 1, 3000);
  const saved = row(a);
  const b = world({ gv: { DayTotal: 3000 } });
  b.saves.setAt(saved, 0, 157, 0);
  assert.deepEqual(b.api.list().map(strip), a.api.list().map(strip), "reloaded list unchanged");
  assert.equal(b.api.state().last, 3000);
  run(a, 3001, 3800);
  run(b, 3001, 3800);
  assert.deepEqual(b.fired.map((f) => strip(f.L)), a.fired.filter((f) => f.L.day > 3000).map((f) => strip(f.L)), "same launches after reload");
  assert.equal(row(b), row(a), "same row after reload");
  // reloading an older save in the same session rolls back to it
  a.saves.setAt(saved, 0, 157, 0);
  a.gv.DayTotal = 3000;
  assert.equal(a.api.state().last, 3000);
  assert.ok(a.api.list().every((L) => L.day <= 3000));
}

// 3. Old save without the row: no news for the past, past rebuilt, live from today.
{
  const w = world({ gv: { DayTotal: 4000 } });
  day(w, 4000);
  assert.equal(w.fired.length, 0, "no news for the past");
  const st = w.api.state();
  assert.equal(st.on, true);
  assert.equal(st.last, 4000);
  assert.ok(st.launches > 100 && w.api.list().length > 50, "history and 36-month list rebuilt");
  assert.ok(w.api.list().every((L) => L.day > 4000 - 1095 && L.day <= 4000), "list = last 36 months");
  assert.equal(st.hits.length, 0, "no hits from the past");
  run(w, 4001, 4400);
  assert.ok(w.fired.length > 5 && w.fired.every((f) => f.L.day > 4000), "live after the load day");
  // a loaded save of an unrelated company, or a row from a later day, starts over
  const x = world({ gv: { DayTotal: 4000, CompanyName: "Other" } });
  x.saves.setAt(row(w), 0, 157, 0);
  day(x, 4000);
  assert.equal(x.fired.length, 0);
  assert.equal(JSON.parse(row(x)).company, "Other");
  const y = world({ gv: { DayTotal: 10 } });
  y.saves.setAt(row(w), 0, 157, 0); // same name, new game in a used slot
  day(y, 10);
  assert.equal(y.api.state().last, 10);
  assert.equal(y.api.list().length, 0);
}

// 4. Original: nothing at all, row and POP untouched; switching on fills in silently.
{
  const w = world({ preset: "original" });
  run(w, 1, 2500);
  assert.equal(w.fired.length, 0);
  assert.equal(row(w), 0, "no row written on Original");
  assert.deepEqual(w.api.list(), []);
  assert.deepEqual(w.api.launchesSince(0), []);
  const st = w.api.state();
  assert.equal(st.on, false);
  assert.equal(st.reason, "original");
  assert.equal(w.phones.getAt(0, 0, 2), 100, "POP untouched");
  // Original -> Realistic on day 2501: starts that day, no back news
  vm.runInContext(`_dtDiff = ${JSON.stringify(PRESETS.realistic)}`, w.ctx);
  day(w, 2501);
  assert.equal(w.fired.length, 0);
  assert.ok(w.api.list().length > 10);
  run(w, 2502, 2900);
  assert.ok(w.fired.length > 0 && w.fired.every((f) => f.L.day > 2501));
  // Realistic -> Original -> Realistic later: the gap is silent, the saved data is kept meanwhile
  vm.runInContext(`_dtDiff = ${JSON.stringify(PRESETS.original)}`, w.ctx);
  const kept = row(w);
  run(w, 2901, 3300);
  assert.equal(row(w), kept, "saved data kept while Original");
  assert.deepEqual(w.api.list(), []);
  const n = w.fired.length;
  vm.runInContext(`_dtDiff = ${JSON.stringify(PRESETS.brutal)}`, w.ctx);
  day(w, 3301);
  assert.equal(w.fired.length, n, "no back news after switching on again");
  assert.ok(w.api.state().mul > 1.2 && w.api.state().mul < 1.3, "Brutal strength 1.26");
  // no game loaded: off
  const m = world({ gv: { CompanyName: "", DayTotal: 0 } });
  assert.equal(m.api.state().reason, "no-game");
  assert.deepEqual(m.api.list(), []);
}

// 5. Day jumps: one tick over 200 days = the same launches, in order, one batch.
{
  const a = world();
  run(a, 1, 3000);
  const b = world({ gv: { DayTotal: 3000 } });
  b.saves.setAt(row(a), 0, 157, 0);
  run(a, 3001, 3200);
  day(b, 3001);
  day(b, 3200);
  assert.deepEqual(b.fired.map((f) => strip(f.L)), a.fired.filter((f) => f.L.day > 3000).map((f) => strip(f.L)));
  const jump = b.fired.filter((f) => f.info.today === 3200);
  assert.ok(jump.length > 3);
  jump.forEach((f, i) => {
    assert.equal(f.info.index, i);
    assert.equal(f.info.count, jump.length);
  });
  assert.equal(row(b), row(a), "jump = day by day");
  // a row saved on Original (far behind its save day): silent fill-in on the first tick after loading
  const c = world({ gv: { DayTotal: 3400 } });
  c.saves.setAt(row(a), 0, 157, 0);
  day(c, 3400);
  assert.equal(c.fired.length, 0);
  assert.equal(c.api.state().last, 3400);
}

// 6. POP effect: only after a launch beats the market at release; caps 0.6/day, 20 total; POP 0 untouched.
{
  const w = world({ release: 2000 });
  run(w, 1, 2000);
  let pop = 100;
  let worst = 0;
  for (let d = 2001; d <= 2400; d++) {
    day(w, d);
    const now = w.phones.getAt(0, 0, 2);
    worst = Math.max(worst, pop - now);
    assert.ok(now >= 0);
    pop = now;
  }
  const st = w.api.state();
  assert.ok(st.hits.length + Object.keys(st.used).length > 0, "a leader launch after the release hits the device");
  const key = "ArraySmartphones#6@2000";
  assert.ok(st.used[key] > 0 && st.used[key] <= 20, "used within the device cap");
  assert.ok(Math.abs(100 - pop - st.used[key]) < 1e-3, "POP lost = used (fake tick does not decay)");
  assert.ok(worst <= 0.6 + 1e-9, "per-day cap");
  assert.equal(w.phones.getAt(1, 0, 2), 0, "stopped device untouched");
  assert.ok(!Object.keys(st.used).some((k) => k.includes("#5@")));
  const hitL = w.fired.find((f) => f.L.hits.length);
  assert.ok(hitL && hitL.L.hits[0].key === key && hitL.L.hits[0].name === "Ember 6" && hitL.L.hits[0].x > 0);
  // Brutal hits harder than Realistic on the same world
  const b = world({ release: 2000, preset: "brutal" });
  run(b, 1, 2400);
  const hx = (v) => v.fired.filter((f) => f.L.hits.length).map((f) => f.L.hits[0].x);
  assert.equal(hx(b).length, hx(w).length);
  hx(b).forEach((x, i) => assert.ok(Math.abs(x / hx(w)[i] - Math.pow(1.5 / 1.1, 0.75)) < 0.01, "Brutal = Realistic x 1.26"));
  assert.ok(b.api.state().used[key] <= 20 + 1e-9, "Brutal also stops at 20");
  // Round 9: only specs the launch beats on the device's OWN parts count. Top parts: never dated.
  const top = world({ release: 2000 });
  for (const z of [14, 20, 58, 60, 68]) top.phones.setAt(999, 0, 0, z);
  run(top, 1, 2400);
  assert.equal(top.fired.filter((f) => f.L.hits.length).length, 0, "nothing beaten: no hit, no toast");
  assert.equal(top.phones.getAt(0, 0, 2), 100, "top device keeps its POP");
  // Top screen only: same launches hit, but less (that spec counts zero).
  const part = world({ release: 2000 });
  part.phones.setAt(999, 0, 0, 14);
  run(part, 1, 2400);
  assert.equal(hx(part).length, hx(w).length);
  hx(part).forEach((x, i) => assert.ok(x <= hx(w)[i] + 1e-9, "never more"));
  assert.ok(hx(part).some((x, i) => x < hx(w)[i] - 1e-9), "a spec not beaten counts zero");
  // Total cap: big saved hits stop at 20 in total
  const c = world({ gv: { DayTotal: 2000 } });
  day(c, 2000);
  const j = JSON.parse(row(c));
  j.hits = [{ key, id: "x@2013", day: 2001, x: 5, name: "Ember 6" }, { key, id: "y@2013", day: 2001, x: 5, name: "Ember 6" }];
  j.used = { [key]: 19.8 };
  c.saves.setAt(JSON.stringify(j), 0, 157, 0);
  day(c, 2001);
  assert.ok(Math.abs(c.phones.getAt(0, 0, 2) - 99.8) < 1e-9, "only 0.2 left under the 20 cap");
  day(c, 2002);
  assert.ok(Math.abs(c.phones.getAt(0, 0, 2) - 99.8) < 1e-9, "cap reached: no more loss");
  // Original never applies saved hits
  const o = world({ gv: { DayTotal: 2000 }, preset: "original" });
  j.used = {};
  o.saves.setAt(JSON.stringify(j), 0, 157, 0);
  run(o, 2001, 2010);
  assert.equal(o.phones.getAt(0, 0, 2), 100, "Original: no effect");
  // once per DayTotal: a second tick on the same day adds nothing
  const p = world({ gv: { DayTotal: 2000 } });
  day(p, 2000);
  p.saves.setAt(JSON.stringify(Object.assign(JSON.parse(row(p)), { hits: [{ key, id: "x@2013", day: 2000, x: 0.5, name: "" }] })), 0, 157, 0);
  day(p, 2001);
  day(p, 2001);
  assert.ok(Math.abs(p.phones.getAt(0, 0, 2) - 99.5) < 1e-9, "once per day");
}

// 7. A company outside its Ratings years launches nothing; the line's numbering is kept.
{
  const all = world();
  run(all, 1, 1200);
  const appel = all.fired.filter((f) => f.L.co === "Appel");
  assert.ok(appel.length >= 2);
  const w = world({ ratings: [{ id: 1, name: "Appel", start: 2008, finish: 2008, isPlayer: false }] });
  run(w, 1, 1200);
  const got = w.fired.filter((f) => f.L.co === "Appel");
  assert.ok(got.length >= 1 && got.every((f) => f.L.year === 2008), "Appel stops after its FINISH year");
  assert.equal(w.fired.length, all.fired.length - appel.filter((f) => f.L.year > 2008).length);
}
// 7b. With real names on, the Ratings table says "Apple" while the line says "Appel": same years apply.
{
  const w = world({ ratings: [{ id: 1, name: "Apple", start: 2008, finish: 2008, isPlayer: false }], realNames: { Appel: "Apple" } });
  run(w, 1, 1200);
  const got = w.fired.filter((f) => f.L.co === "Appel");
  assert.ok(got.length >= 1 && got.every((f) => f.L.year === 2008), "real-named Apple stops after its FINISH year");
}

// 8. API odds and ends: names, unsubscribe, newer markers, launchesSince order.
{
  const w = world({ release: 2000 });
  let n = 0;
  const off = w.api.onLaunch(() => n++);
  run(w, 1, 1500);
  const seen = n;
  off();
  run(w, 1501, 2600);
  assert.equal(n, seen);
  assert.ok(seen > 0);
  const since = w.api.launchesSince(1500);
  assert.ok(since.length > 0 && since.every((L, i) => L.day > 1500 && (i === 0 || since[i - 1].day <= L.day)));
  const list = w.api.list();
  assert.ok(list.every((L, i) => i === 0 || list[i - 1].day >= L.day), "list newest first");
  const ph = list.filter((L) => L.type === "phone");
  assert.ok(ph.every((L) => Array.isArray(L.newer) && L.newer.length === L.rows.length), "newer markers for phones");
  assert.ok(list.filter((L) => L.type === "tv").every((L) => L.newer === null), "no TV made: no markers");
  assert.ok(ph.some((L) => L.newer.some(Boolean)));
  const names = Object.fromEntries(list.map((L) => [L.stem, L.name]));
  if (names["Stellar S"]) assert.match(names["Stellar S"], /^Stellar S\d+$/);
  if (names.Orchard) assert.match(names.Orchard, /^Orchard \d+$/);
  const m = w.api.market("phone", 2600);
  assert.equal(m.length, C.RIV.TYPES.phone.specs.length);
}

console.log("test_rivals_runtime: ok");
