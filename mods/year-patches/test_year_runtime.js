// Runtime test for year.js on top of the game's REAL company stats code: the
// stats block (var _container100 ... _container101, with tickCompanyStatsDay,
// _pushMonthly, _readRatings and the stats page tabs) is cut out of c3main.js
// and run in a vm with a small fake Construct runtime and calendar, then
// year.js is loaded. Days are played by hand: sales are written to SOLDED and
// Fans/Budget move, then the game's stats day runs, as the day loop does.
// Usage: node test_year_runtime.js [c3main.js] [year.js]
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const HERE = __dirname;
const C3MAIN = process.argv[2] || path.join(HERE, "../../game-files/scripts/c3main.js");
const YEAR = process.argv[3] || path.join(HERE, "year.js");
const game = fs.readFileSync(C3MAIN, "utf8");
const a0 = game.indexOf("var _container100=null"), a1 = game.indexOf("var _container101=null");
assert.ok(a0 > 0 && a1 > a0, "stats block not found in c3main.js");
const STATS = game.slice(a0, a1);
const YEARJS = fs.readFileSync(YEAR, "utf8");

class Arr {
  constructor(w, h, d) { this.width = w; this.height = h; this.depth = d; this.c = new Map(); }
  getAt(x, y, z) { const k = x + "," + (y || 0) + "," + (z || 0); return this.c.has(k) ? this.c.get(k) : 0; }
  setAt(v, x, y, z) { this.c.set(x + "," + (y || 0) + "," + (z || 0), v); }
  setSize(w, h, d) { this.width = w; this.height = h; this.depth = d; }
}
// Device row: CREATED, SOLDED, POP, COST, SELL, RATING, HYPE, RELEASE, NAME.
function put(a, x, y, r) {
  [r.created, r.sold || 0, r.pop || 50, r.cost, r.sell, r.rating || 7, 0, r.release, r.name].forEach((v, z) => a.setAt(v, x, y, z));
}
const NONE = { created: -1, cost: 0, sell: 0, release: -1, name: "" };
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function world(opts) {
  opts = opts || {};
  const phones = new Arr(3, 3, 12), laptops = new Arr(1, 3, 12), tvs = new Arr(1, 3, 12);
  put(phones, 0, 0, { created: 1e7, sold: 50000, cost: 200, sell: 300, release: 10, name: "Ember 1" });
  put(phones, 0, 1, { created: 1e7, sold: 1000, cost: 250, sell: 400, release: 10, name: "Ember 1 Pro" });
  put(phones, 0, 2, NONE);
  put(phones, 1, 0, { created: 0, cost: 220, sell: 330, release: -1, name: "Ember 2" }); // in development
  for (const y of [1, 2]) put(phones, 1, y, NONE);
  for (const y of [0, 1, 2]) put(phones, 2, y, NONE);
  put(laptops, 0, 0, { created: 1e6, sold: 0, cost: 600, sell: 700, release: 12, name: "Folio" });
  for (const y of [1, 2]) put(laptops, 0, y, NONE);
  put(tvs, 0, 0, { created: 1e6, sold: 0, cost: 500, sell: 450, release: 12, name: "Vista" }); // sells at a loss
  for (const y of [1, 2]) put(tvs, 0, y, NONE);
  const saves = opts.saves || new Arr(3, 200, 1);
  const stats = new Arr(1, 1, 1);
  if (opts.statsJson) stats.setAt(opts.statsJson, 0, 0, 0);
  // Rivals: earn in B$; the player row is id -1.
  const ratings = new Arr(4, 11, 1);
  const rival = (x, id, earn) => { ratings.setAt(id, x, 0); ratings.setAt(2000, x, 1); ratings.setAt(9999, x, 2); ratings.setAt(earn, x, 4); };
  rival(0, 1, 5); rival(1, 2, 3); rival(2, 3, 1); rival(3, -1, 0.5);
  const assistant = new Arr(0, 1, 1);
  const arrays = { ArraySmartphones: phones, ArrayLaptops: laptops, ArrayTV: tvs, ArraySaves: saves, ArrayCompanyStats: stats,
    ArrayRatingsCompanies: ratings, ArrayGameAssistant: assistant, ArrayCompanyNames: new Arr(10, 2, 1) };
  for (const n of ["ArrayTablets", "ArrayWatches", "ArrayHeadphones", "ArrayScooters", "ArrayKeyboards", "ArrayConsoles", "ArrayVRConsoles"])
    arrays[n] = new Arr(0, 3, 12);
  const objects = {};
  for (const n in arrays) objects[n] = { getFirstInstance: () => arrays[n] };
  const d0 = opts.date || { y: 2012, m: 6, d: 15 };
  const gv = { DayTotal: opts.dayTotal || 1626, Year: d0.y, Month: d0.m, Day: d0.d, Fans: 100000, Budget: 1e9, SaveSlot: 0,
    CompanyName: opts.company || "Ember", LanguageChoose: 0, class: "GAMEPLAY", Assistant: "OFF", CreateDevicesUI: "OFF", GameplayPause: 0 };
  const opened = [];
  // The 1 January review opens the game's Company statistics page (Years tab) the way its toolbar button does.
  const runtime = { objects, globalVars: gv, layout: { name: "GAMEPLAY" }, callFunction() {},
    goToLayout(n) { opened.push({ layout: n, cls: gv.class, last: gv.LastClass }); } };
  const ui = {
    open: null,
    t(e, vars) { let s = e.en; for (const k in vars || {}) s = s.split("{" + k + "}").join(String(vars[k])); return s; },
    gv: (n, d) => (n in gv ? gv[n] : d), num: (n, d) => { const v = Number(gv[n]); return isFinite(v) ? v : d; },
    onOffice: () => runtime.layout.name === "GAMEPLAY", isOpen: () => !!ui.open,
    modal(o) {
      const body = { innerHTML: "" };
      o.build(body, () => ui.close(), {});
      ui.open = { o, body, paused: gv.GameplayPause };
      if (o.pause) gv.GameplayPause = 1;
      opened.push({ title: o.title, html: body.innerHTML, pause: o.pause });
      return { dim: { querySelector: () => ({ classList: { add() {} } }) }, foot: { querySelector: () => null } }; // no DOM here
    },
    close() { const m = ui.open; if (!m) return; ui.open = null; gv.GameplayPause = m.paused; m.o.onClose && m.o.onClose(); },
  };
  const ctx = { console, Math, JSON, Date, Number, String, Object, Array, Map, Set, isFinite, Float64Array, setTimeout, clearTimeout, setInterval,
    globalThis: null, _dtUi: ui };
  ctx.globalThis = ctx;
  ctx.runtime = runtime;
  vm.createContext(ctx);
  vm.runInContext(STATS + "\n;\n" + YEARJS + "\n;globalThis.__t={tick:()=>tickCompanyStatsDay(runtime),st:()=>_loadState(),tabs:_TAB_LIST,card:_dtYearCardHtml,chg:_dtYearChange};", ctx);
  const w = { ctx, gv, arrays, phones, laptops, tvs, saves, ratings, runtime, ui, opened, api: ctx._dtYearApi, t: ctx.__t };
  // One game day: sales, fans and money move first (tickDeviceSales/tickFans), then the stats day.
  w.next = (sales, fans, money) => {
    gv.Day++;
    if (gv.Day > MDAYS[gv.Month - 1]) { gv.Day = 1; gv.Month++; if (gv.Month > 12) { gv.Month = 1; gv.Year++; } }
    gv.DayTotal++;
    for (const [arr, x, y, n] of sales || []) { const a = arrays[arr]; a.setAt(a.getAt(x, y, 1) + n, x, y, 1); }
    gv.Fans += fans || 0;
    gv.Budget += money || 0;
    w.t.tick();
  };
  w.until = (y, m, d, fn) => { while (!(gv.Year === y && gv.Month === m && gv.Day === d)) fn(); };
  return w;
}
function gameYear(w, y) { // independent sum of the game's own monthly history
  const m = w.t.st().m, o = { rev: 0, prof: 0, un: 0, n: 0 };
  m.ym.forEach((ym, i) => { if (Math.floor(ym / 12) === y) { o.rev += m.rev[i]; o.prof += m.prof[i]; o.un += m.un[i]; o.n++; } });
  return o;
}
const P = "ArraySmartphones", L = "ArrayLaptops", T = "ArrayTV";
const near = (a, b, msg) => assert.ok(Math.abs(a - b) <= Math.max(1, Math.abs(b) * 1e-9), msg + ": " + a + " vs " + b);

// 1. An old save starts recording mid-year; 1 January closes a PARTIAL year whose
//    totals are the game's own months and whose device figures start that day.
{
  const w = world();
  w.t.tick(); // the load day: first recording day, no deltas
  let s = w.api.load();
  assert.equal(s.cur.y, 2012);
  assert.equal(s.cur.full, false);
  assert.equal(s.cur.fromD, "15 Jun 2012");
  assert.equal(s.cur.seen["ArraySmartphones:0:10:Ember 1"], 50000, "devices already selling start from their count");
  assert.equal(s.cur.dev["ArraySmartphones:0:10:Ember 1"], undefined);
  let fansAt = 0;
  w.until(2012, 12, 31, () => w.next([[P, 0, 0, 100], [P, 0, 1, 10], [L, 0, 0, 20], [T, 0, 0, 5]], 50, 30000));
  fansAt = w.gv.Fans;
  assert.equal(w.api.load().years.length, 0, "nothing closed before 1 January");
  w.next([[P, 0, 0, 1000]], 7, 0); // 1 January 2013: these sales belong to 2013
  s = w.api.load();
  assert.equal(s.years.length, 1);
  const r = s.years[0];
  assert.equal(r.y, 2012);
  assert.equal(r.partial, true);
  const g = gameYear(w, 2012);
  assert.equal(r.rev, Math.round(g.rev), "revenue = the game's months");
  assert.equal(r.prof, Math.round(g.prof), "profit = the game's months");
  assert.equal(r.un, Math.round(g.un), "units = the game's months");
  const days = 199; // 16 Jun .. 31 Dec
  assert.equal(r.un, days * 135, "units sold per day x days");
  assert.equal(r.fans, fansAt - 100000, "fans gained since recording began (the load day)");
  assert.equal(r.best.n, "Ember 1");
  assert.equal(r.best.u, days * 100);
  assert.equal(r.best.p, days * 100 * 100, "profit = units x (price - unit cost)");
  assert.equal(r.worst.n, "Vista", "a device sold below cost makes no profit (as _slotProfit)");
  assert.equal(r.worst.p, 0);
  // Phones 100*300+10*400, laptop 20*700, TV 5*450 per day.
  near(r.types.phone / r.typeTot * 100, 34000 / 50250 * 100, "phone share");
  assert.equal(r.typeTot, days * 50250);
  // Rank and share by the year's revenue against the rivals' yearly revenue (5, 3 and 1 B$).
  assert.equal(r.rm, 2);
  assert.equal(r.rank, 4); assert.equal(r.of, 4); assert.equal(r.rank0, 0, "no year before counted the same way");
  assert.equal(r.share, Math.round(r.rev / (9e9 + r.rev) * 1e6) / 1e4, "share of all companies' yearly revenue");
  assert.ok(w.t.card(r).includes("No 2011 figures"), "no rank change shown");
  assert.deepEqual(s.pending, [2012], "the card waits to be shown");
  assert.equal(s.cur.y, 2013);
  assert.equal(s.cur.dev["ArraySmartphones:0:10:Ember 1"][2], 1000, "1 January sales count for the new year");
  assert.equal(r.pv.rev, null, "no full 2011 to compare with");
}

// 2. A full year after a partial one; rank moves, a new device appears mid-year,
//    a price change mid-year counts each day at that day's price.
{
  const w = world();
  w.t.tick();
  w.until(2013, 1, 1, () => w.next([[P, 0, 0, 100]], 10, 1000));
  w.ratings.setAt(0.001, 1, 4); w.ratings.setAt(0.002, 2, 4); // two rivals shrink to $1-2M a year: the player passes them
  w.ratings.setAt(0, 3, 4); // the game's 180-day figure for the player is 0 (sold out in spring): not used
  const P1 = w.phones;
  w.until(2013, 7, 1, () => w.next([[P, 0, 0, 200]], 20, 5000));
  P1.setAt(400, 0, 0, 4); // price raised from $300 to $400
  put(P1, 1, 0, { created: 1e6, sold: 0, cost: 220, sell: 330, release: w.gv.DayTotal + 1, name: "Ember 2" });
  w.until(2014, 1, 1, () => w.next([[P, 0, 0, 200], [P, 1, 0, 300]], 20, 5000));
  const s = w.api.load();
  const r = s.years.find((x) => x.y === 2013);
  assert.equal(r.partial, false, "a year that began with recording is full");
  const g = gameYear(w, 2013);
  assert.equal(g.n, 12);
  assert.equal(r.rev, Math.round(g.rev)); assert.equal(r.un, Math.round(g.un)); assert.equal(r.prof, Math.round(g.prof));
  assert.equal(r.fans, 10 + 20 * 364, "fans gained: 31 Dec 2013 - 31 Dec 2012");
  // 1 Jan: 100 sold at $300; 2 Jan..1 Jul (181 days): 200 a day at $300; 2 Jul..31 Dec (183 days) at $400.
  const after = 183;
  const e1 = 100 * 100 + 200 * 181 * 100 + 200 * after * 200;
  assert.equal(r.best.n, "Ember 1"); assert.equal(r.best.p, e1, "each day at that day's price");
  assert.equal(r.worst.n, "Ember 2"); assert.equal(r.worst.u, 300 * after, "a new device counts from its first sale");
  assert.equal(r.rank, 2); assert.equal(r.rank0, 4, "rank in 2012");
  assert.equal(r.share0, s.years[0].share, "share compared with 2012");
  assert.equal(r.pv.rev, null, "2012 was partial: no change shown");
  assert.deepEqual(r.pv.types, { phone: s.years[0].types.phone }, "type shares compare with the year before");
  assert.ok(w.t.card(r).includes("▲2</b>vs 2012"), "rank up 2 shown");
  assert.deepEqual(s.pending, [2012, 2013]);
  // Recorded from 1 January but the game's months are missing some: say so, compare rank with the year before.
  const gap = w.t.card(Object.assign({}, r, { partial: true, months: 2 }));
  assert.ok(gap.includes("Partial year: the game has records for 2 of 12 months"));
  assert.ok(gap.includes("▲2</b>vs 2012") && !gap.includes("Devices, rank"), "no recording-start wording");
  // A year saved by the version before (the game's 180-day rank, no rm) is not compared with.
  const s3 = w.api.load();
  delete s3.years.find((x) => x.y === 2013).rm;
  w.api.save(s3);
  w.until(2015, 1, 1, () => w.next([[P, 0, 0, 200]], 20, 5000));
  const r14 = w.api.load().years.find((x) => x.y === 2014);
  assert.equal(r14.rm, 2); assert.equal(r14.rank, 2); assert.equal(r14.rank0, 0); assert.equal(r14.share0, null);
  assert.ok(w.t.card(r14).includes("No 2013 figures"), "no rank change against an old-style year");
}

// 3. With a full year before it (the game's own history), every change is shown:
//    +12% style for money/units/fans, points for shares.
{
  const ym = [], rev = [], prof = [], un = [], fan = [];
  for (let m = 0; m < 12; m++) { ym.push(12 * 2011 + m); rev.push(1e6); prof.push(2e5); un.push(1000); fan.push(50000 + m * 1000); }
  const stats = { v: 1, last: 1460, d: { day: [], o: [], h: [], l: [], c: [], rev: [], exp: [], prof: [], un: [], fan: [], val: [] },
    m: { ym, rev, exp: rev.map(() => 0), prof, un, fan, val: rev.map(() => 0), px: rev.map(() => 0.1) },
    prev: { sold: 51000, rev: 0, cost: 0, made: 0, budget: 1e9, fans: 61000, awards: 0 } };
  stats.m.ym.unshift(12 * 2010 + 11); for (const k of ["rev", "exp", "prof", "un", "val", "px"]) stats.m[k].unshift(0); stats.m.fan.unshift(40000);
  const w = world({ statsJson: JSON.stringify(stats), date: { y: 2011, m: 12, d: 31 }, dayTotal: 1460 });
  w.gv.Fans = 61000;
  w.t.tick();
  w.until(2013, 1, 1, () => w.next([[P, 0, 0, 10]], 30, 1000));
  const r = w.api.load().years.find((x) => x.y === 2012);
  assert.equal(r.partial, false);
  assert.equal(r.pv.rev, 12e6); assert.equal(r.pv.prof, 24e5); assert.equal(r.pv.un, 12000);
  assert.equal(r.pv.fans, 61000 - 40000, "2011 fans gained from the game's own months");
  assert.equal(r.fans, 30 * 366 - 30, "1 Jan 2012 .. 31 Dec 2012");
  const html = w.t.card(r);
  const L = w.api.logic;
  assert.ok(html.includes(L.pctText(L.pct(r.un, 12000)).replace(/^-/, "\u2212") + "</b>vs 2011"), "units change vs 2011");
  assert.ok(html.includes("vs 2011"));
  assert.ok(!html.includes("Partial year"));
  assert.ok(html.includes("No device sold") === false);
}

// 3a. A loss after a profit shows the money difference, not a meaningless "-371%".
{
  const w = world({});
  const L = w.api.logic;
  const loss = w.t.chg(-7.5e6, 2.8e6, 2012, L.money);
  assert.ok(!/%/.test(loss), "no percent for a loss year: " + loss);
  assert.ok(loss.includes("st-down") && loss.includes("vs 2011"), loss);
  assert.ok(w.t.chg(3e6, -1e6, 2012, L.money).includes("st-up"), "back into profit is shown green");
  assert.ok(w.t.chg(2.2e6, 2e6, 2012, L.money).includes("+10%"), "profit to profit still uses percent");
  assert.ok(w.t.chg(0, 0, 2012, L.money).includes("Same as 2011"), "no change reads as plain words, not \"$0 vs 2011\"");
}

// 3b. An old save with the game's own history: a partial year still counts fans for the whole year
//     (31 Dec before -> 31 Dec), and says so; devices count from the load day.
{
  const ym = [], z = [], fan = [];
  for (let m = 0; m < 17; m++) { ym.push(12 * 2011 + m); z.push(0); fan.push(10000 + m * 100); } // Jan 2011 .. May 2012
  const stats = { v: 1, last: 1626, d: { day: [], o: [], h: [], l: [], c: [], rev: [], exp: [], prof: [], un: [], fan: [], val: [] },
    m: { ym, rev: z.slice(), exp: z.slice(), prof: z.slice(), un: z.slice(), fan, val: z.slice(), px: z.slice() },
    prev: { sold: 51000, rev: 0, cost: 0, made: 0, budget: 1e9, fans: 100000, awards: 0 } };
  const w = world({ statsJson: JSON.stringify(stats) });
  w.t.tick();
  w.until(2013, 1, 1, () => w.next([[P, 0, 0, 10]], 40, 1000));
  const r = w.api.load().years.find((x) => x.y === 2012);
  assert.equal(r.partial, true);
  assert.equal(r.fansPart, false);
  assert.equal(r.fans, w.gv.Fans - 40 - 11100, "fans: 31 Dec 2012 - 31 Dec 2011 from the game's months");
  assert.equal(r.best.u, 10 * 199, "devices still count from the load day");
  const html = w.t.card(r);
  assert.ok(html.includes("Devices count from 15 Jun 2012. Revenue, profit, devices sold, rank and share"), "note says fans, rank and share are whole-year");
  const oldNote = w.t.card(Object.assign({}, r, { rm: undefined }));
  assert.ok(oldNote.includes("Devices, rank and share count from 15 Jun 2012"), "a record from before keeps its note");
  assert.ok(html.includes("<small>Phone</small>"), "one device's type tag is singular");
}

// 4. Saved in ArraySaves row 158 with the game: a reload continues; another company
//    in the row is ignored; an older save of the same company drops the later years.
{
  const w = world();
  w.t.tick();
  w.until(2013, 1, 3, () => w.next([[P, 0, 0, 100]], 5, 100));
  const raw = w.saves.getAt(0, 158, 0);
  assert.equal(typeof raw, "string");
  assert.equal(w.saves.getAt(1, 158, 0), 0, "other slots untouched");
  // Reload: the arrays come back as saved, and the stats JSON too.
  const saves = new Arr(3, 200, 1); saves.setAt(raw, 0, 158, 0);
  const w2 = world({ saves, statsJson: w.arrays.ArrayCompanyStats.getAt(0, 0, 0), date: { y: 2013, m: 1, d: 3 }, dayTotal: w.gv.DayTotal });
  w2.phones.setAt(w.phones.getAt(0, 0, 1), 0, 0, 1);
  w2.gv.Fans = w.gv.Fans;
  w2.next([[P, 0, 0, 100]], 5, 100);
  const s2 = w2.api.load();
  assert.equal(s2.years[0].y, 2012, "closed year kept");
  assert.equal(s2.cur.dev["ArraySmartphones:0:10:Ember 1"][2], 400, "no double count across the reload (1..4 Jan)");
  // Another company in the same slot.
  const w3 = world({ saves, company: "Acme" });
  w3.t.tick();
  assert.equal(w3.api.load().company, "Acme");
  assert.equal(w3.api.load().years.length, 0, "Acme does not inherit Ember's years");
  // An older Ember save (mid-2012) loaded over a row that already has 2012 closed.
  const saves4 = new Arr(3, 200, 1); saves4.setAt(raw, 0, 158, 0);
  const w4 = world({ saves: saves4 });
  w4.t.tick();
  const s4 = w4.api.load();
  assert.equal(s4.years.length, 0, "years after the loaded date are dropped");
  assert.deepEqual(s4.pending, []);
  assert.equal(s4.cur.fromD, "15 Jun 2012");
}

// 5. The review waits until the screen is free, then opens the game's Company statistics
//    page (as its toolbar button: LastClass GAMEPLAY, class STATS) on the Years tab with
//    that year; the calendar stops there like on any game page, ESC is the game's own Back.
{
  const w = world();
  w.t.tick();
  w.until(2013, 1, 1, () => w.next([[P, 0, 0, 100]], 5, 100));
  const pump = (n) => { for (let i = 0; i < n; i++) w.api.pump(); };
  // The stats page is built a moment after the layout change: until then nothing is shown.
  const shown = [];
  let page = false;
  const show = w.ctx._dtYearShow;
  w.ctx._dtYearShow = (y) => { if (!page) return false; shown.push(y); return true; };
  w.gv.Assistant = "ON"; pump(10); assert.equal(w.opened.length, 0, "game news/awards card up");
  w.gv.Assistant = "OFF"; w.arrays.ArrayGameAssistant.width = 1; pump(10); assert.equal(w.opened.length, 0, "game card queued");
  w.arrays.ArrayGameAssistant.width = 0;
  w.runtime.layout.name = "MY SMARTPHONES"; pump(10); assert.equal(w.opened.length, 0, "not on the office");
  w.runtime.layout.name = "GAMEPLAY";
  w.ctx._dtLaunchPending = true; pump(10); assert.equal(w.opened.length, 0, "launch-day choice open");
  w.ctx._dtLaunchPending = false;
  w.ctx._dtEventApi = { run: () => false, state: () => ({ events: [{ day: w.gv.DayTotal }] }) }; pump(10);
  assert.equal(w.opened.length, 0, "a launch event is due today");
  w.ctx._dtEventApi = { run: () => false, state: () => ({ events: [{ day: w.gv.DayTotal + 30 }] }) };
  w.gv.GameplayPause = 1; pump(10); assert.equal(w.opened.length, 0, "game paused by another card");
  w.gv.GameplayPause = 0;
  // A game news pop-up still on screen: the review waits for it to leave.
  const pops = [{ getBoundingClientRect: () => ({ width: 373 }) }];
  w.ctx.document = { getElementById: (id) => (id === "office-notifications" ? { children: pops } : id === "dt-year-css" ? {} : null) };
  pump(8); assert.equal(w.opened.length, 0, "news pop-up on screen");
  pops.length = 0; w.gv.GameplayPause = 1; pump(1); w.gv.GameplayPause = 0;
  pump(3); assert.equal(w.opened.length, 0, "waits a second of free screen");
  pump(1); assert.equal(w.opened.length, 1);
  assert.deepEqual(w.opened[0], { layout: "STATS", cls: "STATS", last: "GAMEPLAY" }, "opened like the toolbar's stats button");
  assert.deepEqual(w.api.load().pending, [2012], "kept waiting until the card is on screen");
  const rec = w.api.load().years.find((r) => r.y === 2012);
  const html = w.t.card(rec);
  assert.ok(html.includes("Partial year: recording started 15 Jun 2012"));
  assert.ok(html.includes("2012 in review") && html.includes('class="st-kpi"') && html.includes("dty-back"), "the page's own tiles, a way back to the list");
  w.runtime.layout.name = "STATS"; w.gv.class = "STATS";
  pump(2); assert.deepEqual(shown, [], "page not built yet");
  page = true; pump(1); assert.deepEqual(shown, [2012], "the page shows 2012 once it is up");
  assert.deepEqual(w.api.load().pending, [], "shown once");
  pump(5); assert.deepEqual(shown, [2012], "only once");
  w.runtime.layout.name = "GAMEPLAY"; w.gv.class = "GAMEPLAY";
  pump(20); assert.equal(w.opened.length, 1, "not shown again");
  // On the stats page a year opens in place.
  assert.equal(w.api.open(2012), true, "open from the Years tab");
  assert.deepEqual(shown, [2012, 2012]);
  assert.equal(w.opened.length, 1, "no second page change");
  assert.equal(w.api.open(2099), false, "no such year");
  // A page that never comes up: given up after 8 s, the office is free again.
  page = false;
  const s7 = w.api.load(); s7.pending = [2012]; w.api.save(s7);
  pump(5); assert.equal(w.opened.length, 2);
  w.ctx.Date = { now: () => Date.now() + 9000 };
  pump(1); assert.notEqual(w.api.state().view, null, "still on its way to the page (slow load, hidden tab): waits");
  w.gv.class = "GAMEPLAY"; // the office resets its class before the stats layout starts
  pump(1); assert.notEqual(w.api.state().view, null, "still waits: the layout has not changed yet");
  w.gv.class = "STATS"; w.ctx.Date = { now: () => Date.now() + 61000 };
  pump(1); assert.equal(w.api.state().view, null, "stopped waiting for the page");
  assert.deepEqual(w.api.load().pending, [2012], "a card never shown is not lost");
  w.ctx.Date = Date;
  w.gv.class = "GAMEPLAY"; // back on the office
  // A page that is slow to build (or a tab left in the background): still shown once it is up.
  const s8 = w.api.load(); s8.pending = [2012]; w.api.save(s8);
  const n8 = w.opened.length, shown8 = shown.length;
  pump(5); assert.equal(w.opened.length, n8 + 1);
  w.runtime.layout.name = "STATS"; w.gv.class = "STATS";
  w.ctx.Date = { now: () => Date.now() + 9000 };
  pump(2);
  page = true; pump(1);
  w.ctx.Date = Date;
  assert.equal(shown.length, shown8 + 1, "shown after a slow page");
  page = false;
  w.runtime.layout.name = "GAMEPLAY"; w.gv.class = "GAMEPLAY";
  // A pop-up that never leaves (news almost daily while a batch is built): the review opens anyway after 2 s.
  const s5 = w.api.load(); s5.pending = [2012]; w.api.save(s5);
  pops.push({ getBoundingClientRect: () => ({ width: 373 }) });
  const n5 = w.opened.length;
  pump(8); assert.equal(w.opened.length, n5, "still waiting at 2 s");
  pump(4); assert.equal(w.opened.length, n5 + 1, "gives up waiting after about 2 s");
  page = true; pump(1); w.gv.class = "GAMEPLAY"; delete w.ctx.document;
  // The idle office does not re-parse an unchanged row 4 times a second, but any
  // new text (a year waiting) or another company is read again.
  {
    const L = w.ctx._dtYearLogic, parse = L.parse;
    let n = 0;
    L.parse = function () { n++; return parse.apply(this, arguments); };
    pump(20);
    assert.ok(n <= 1, "unchanged row parsed at most once, got " + n);
    const n6 = w.opened.length;
    const s6 = w.api.load(); s6.pending = [2012]; w.api.save(s6);
    page = false;
    pump(1); assert.equal(w.opened.length, n6 + 1, "a changed row opens the review at once");
    page = true; pump(1); w.gv.class = "GAMEPLAY";
    n = 0; pump(10); const quiet = n;
    w.gv.CompanyName = "Other Co"; pump(1);
    assert.equal(quiet <= 1 && n === quiet + 1, true, "another company is read again");
    L.parse = parse;
  }
  w.ctx._dtYearShow = show;
}

// 5b. A slow stats page (or a hidden tab) past 8 s still gets its card while the page is up,
//     and a later visit to the page opens on the player's own tab, not on that year's card.
{
  const w = world();
  w.t.tick();
  w.until(2013, 1, 1, () => w.next([[P, 0, 0, 100]], 5, 100));
  const pump = (n) => { for (let i = 0; i < n; i++) w.api.pump(); };
  const shown = [];
  let page = false;
  w.ctx._dtYearShow = (y) => { if (!page) return false; shown.push(y); w.ctx._dtYear.detail = y; w.ctx._tab = "years"; return true; };
  w.ctx._tab = "devices"; // the tab the player last used
  pump(4); assert.equal(w.opened.length, 1, "1 January jump");
  w.runtime.layout.name = "STATS"; w.gv.class = "STATS";
  w.ctx.Date = { now: () => Date.now() + 20000 };
  pump(2); assert.deepEqual(w.api.load().pending, [2012], "still waiting for the page after 8 s");
  page = true; pump(1); w.ctx.Date = Date;
  assert.deepEqual(shown, [2012], "the card shows once the page is built");
  assert.deepEqual(w.api.load().pending, [], "then it is done");
  // Back to the office; later the player opens Company statistics from the toolbar.
  w.runtime.layout.name = "GAMEPLAY"; w.gv.class = "GAMEPLAY";
  w.ctx.initStatsPage(null);
  assert.equal(w.ctx._dtYear.detail, null, "no leftover year card");
  assert.equal(w.ctx._tab, "devices", "the player's own tab again");
  // A page that never comes up twice: the year is dropped, no endless jumping.
  page = false;
  const s = w.api.load(); s.pending = [2012]; w.api.save(s);
  for (let k = 0; k < 2; k++) {
    w.gv.class = "GAMEPLAY";
    pump(4);
    w.ctx.Date = { now: () => Date.now() + 61000 }; pump(1); w.ctx.Date = Date;
  }
  assert.equal(w.opened.length, 3);
  assert.deepEqual(w.api.load().pending, [], "given up after two tries");
  w.gv.class = "GAMEPLAY"; pump(20); assert.equal(w.opened.length, 3, "not tried again");
}

// 6. Pure rules: change texts and formats match the stats page.
{
  const L = world().api.logic;
  assert.equal(L.pctText(L.pct(112, 100)), "+12%");
  assert.equal(L.pctText(L.pct(105.5, 100)), "+5.5%");
  assert.equal(L.pctText(L.pct(50, 100)), "-50%");
  assert.equal(L.pct(5, 0), null); assert.equal(L.pct(5, -3), null); assert.equal(L.pct(5, null), null);
  assert.equal(L.money(1234567), "$1.2M"); assert.equal(L.money(-2500), "-$2.5K"); assert.equal(L.num(950), "950");
  assert.equal(L.signed(1500), "+1.5K");
  assert.equal(L.shareText(0.0021, 14e6), "<0.01%"); assert.equal(L.shareText(0, 0), "0.00%"); assert.equal(L.shareText(0, 5), "<0.01%");
  assert.equal(L.shareText(1.234, 5), "1.23%");
  const sh = L.typeShares({ types: { phone: 75, tv: 25 }, typeTot: 100, pv: { types: { phone: 50, laptop: 50 }, typeTot: 100 } });
  assert.deepEqual(sh.map((t) => [t.k, t.share, t.diff]), [["phone", 75, 25], ["tv", 25, 25]]);
  assert.equal(L.parse("junk", "Ember"), null);
}

// 7. The stats page gets a Years tab; other tabs still use the game's renderer.
{
  const w = world();
  assert.equal(JSON.stringify(w.t.tabs[w.t.tabs.length - 1]), '["years","tabYears"]');
  assert.equal(w.t.tabs.filter((t) => t[0] === "years").length, 1);
  assert.equal(w.ctx.globalThis.tickCompanyStatsDay, w.ctx.tickCompanyStatsDay, "exported copy is the wrapped one");
}
// 8. The game adds a new device at the front, moving the others one column right:
//    each device keeps its own count (no double counting of the moved ones).
function shiftRight(ph) {
  for (let x = ph.width - 1; x > 0; x--) for (let y = 0; y < 3; y++) for (let z = 0; z < 9; z++) ph.setAt(ph.getAt(x - 1, y, z), x, y, z);
  for (const y of [1, 2]) put(ph, 0, y, NONE);
}
{
  const w = world();
  w.t.tick();
  w.until(2012, 7, 1, () => w.next([[P, 0, 0, 100]], 0, 0)); // 16 Jun..1 Jul: 16 days
  shiftRight(w.phones);
  put(w.phones, 0, 0, { created: 1e6, sold: 0, cost: 100, sell: 200, release: w.gv.DayTotal + 1, name: "Ember 3" });
  w.until(2012, 7, 11, () => w.next([[P, 1, 0, 100], [P, 0, 0, 10]], 0, 0)); // 10 more days
  const dev = w.api.load().cur.dev, all = Object.values(dev);
  assert.equal(dev["ArraySmartphones:0:10:Ember 1"][2], 26 * 100, "Ember 1 counted across the move");
  assert.equal(all.find((e) => e[0] === "Ember 3")[2], 100, "the new device counts from its first sale");
  assert.equal(all.reduce((n, e) => n + e[2], 0), 2700, "nothing counted twice");
}

// 9. A save from before stable keys: the year so far is carried over by name, once.
{
  const w = world();
  w.t.tick();
  w.until(2012, 7, 1, () => w.next([[P, 0, 0, 100], [P, 0, 1, 10]], 0, 0)); // 16 days
  const s = w.api.load(), old = (k) => k.replace(/^(\w+):0:10:Ember 1( Pro)?$/, (m, a, pro) => a + ":0:" + (pro ? 1 : 0));
  const re = (o) => { const n = {}; for (const k in o) n[old(k)] = o[k]; return n; };
  s.cur.dev = re(s.cur.dev); s.cur.seen = re(s.cur.seen); delete s.cur.ks;
  assert.ok(s.cur.dev["ArraySmartphones:0:0"], "old-style keys set up");
  w.api.save(s);
  shiftRight(w.phones);
  put(w.phones, 0, 0, { created: 1e6, sold: 0, cost: 100, sell: 200, release: w.gv.DayTotal + 1, name: "Ember 3" });
  w.next([[P, 1, 0, 100]], 0, 0); // the first day on the new version: its sales are not counted
  w.until(2012, 7, 12, () => w.next([[P, 1, 0, 100], [P, 1, 1, 10], [P, 0, 0, 10]], 0, 0)); // 10 days
  const c = w.api.load().cur, all = Object.values(c.dev);
  assert.equal(c.ks, 2);
  assert.equal(c.dev["ArraySmartphones:0:10:Ember 1"][2], 26 * 100, "old year so far kept, new days added");
  assert.equal(c.dev["ArraySmartphones:1:10:Ember 1 Pro"][2], 26 * 10);
  assert.equal(all.find((e) => e[0] === "Ember 3")[2], 100);
  assert.equal(all.reduce((n, e) => n + e[2], 0), 2600 + 260 + 100, "nothing counted twice");
}
// 10. A new campaign starts on 1 January; the game's first stats day is 2 January: its first year is full.
{
  const w = world({ date: { y: 2008, m: 1, d: 1 }, dayTotal: 0 });
  w.until(2009, 1, 1, () => w.next([[P, 0, 0, 10]], 1, 100));
  const r = w.api.load().years.find((x) => x.y === 2008);
  assert.equal(r.full, true, "recording from 2 January covers the year");
  assert.equal(r.partial, false, "the first year of a new campaign is not partial");
  assert.ok(!w.t.card(r).includes("Partial year"));
}

// 11. New Game in a used slot, same company name: the old campaign's years are cleared on the
//     loading screen (a loaded save keeps them).
{
  const w = world();
  w.t.tick();
  w.until(2013, 1, 2, () => w.next([[P, 0, 0, 10]], 0, 0));
  assert.equal(w.api.load().years.length, 1);
  const raw = w.saves.getAt(0, w.api.row, 0);
  w.runtime.layout.name = "LOADING GAME";
  w.gv.LoadingType = "CONTINUE";
  w.api.pump();
  assert.equal(w.saves.getAt(0, w.api.row, 0), raw, "loading a save keeps its years");
  w.gv.LoadingType = "NEW GAME";
  w.api.pump();
  assert.equal(w.saves.getAt(0, w.api.row, 0), "", "New Game clears the old campaign's years");
  assert.equal(w.api.state().idleRaw, null);
}
console.log("year runtime: all tests passed");
