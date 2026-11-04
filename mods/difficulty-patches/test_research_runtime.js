// Behaviour test for research.js (office research bubbles) loaded after
// difficulty.js, against a small mock of the game's staff helpers.
// Usage: node test_research_runtime.js <difficulty.js> <research.js>
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function context(opts) {
  opts = opts || {};
  const gv = Object.assign({ SaveSlot: 0, CompanyName: "Acme", ResearchCoins: 100, DayTotal: 500, OfficeType: "DESIGNER" }, opts.gv || {});
  const layout = { name: "GAME OFFICE 1" };
  const staff = opts.staff || { design: 15, programmer: 12, engineer: 9 };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setInterval() { return 0; },
    clearInterval() {},
    Math, Number, String, Object, Array, JSON, Error, Infinity, NaN, Map,
    runtime: { globalVars: gv, layout, objects: {} },
    _potentialUnits() { return 0; },
    _compute4() { return { supported: false }; },
    setRatingsConfig() { return {}; },
    _tickNpcRow(a, r, c, p) { return p; },
    _companyName(id) { return "#" + id; },
    STAGES: { design: { profession: "DESIGNERS" }, programmer: { profession: "PROGRAMMERS" }, engineer: { profession: "ENGINEERS" } },
    _officeStaff(rt, a) {
      if (opts.throwStaff) throw new Error("no staff");
      const key = Object.keys(ctx.STAGES).find((k) => ctx.STAGES[k] === a);
      const n = staff[key];
      return { level: 5, workers: Array.from({ length: n }, (_, i) => ({ id: i, mood: 80 })) };
    },
    _throughput(s) { return { pps: s.workers.length, count: s.workers.length }; },
    _inst45(rt, name) { return { name }; },
    // research stat 50 for everyone, no perks
    _at41(arr, x, y) { return arr.name === "ArrayEmployees_Characters" && y === 2 ? 50 : 0; },
    _dtSpeedScale() { return opts.scale === undefined ? 0.5 : opts.scale; },
    _dtUi: {
      num(n, d) { const v = Number(gv[n]); return Number.isFinite(v) ? v : d; },
      gv(n, d) { const v = gv[n]; return v === undefined || v === null ? d : v; },
      layoutName() { return layout.name; },
      onOffice() { return true; },
      t(e) { return (e && e.en) || e; },
      chip() {}, removeChip() {}, modal() {}, el() {}, button() {},
    },
  };
  vm.createContext(ctx);
  for (const f of [process.argv[2], process.argv[3]]) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
  ctx.gv = gv;
  return ctx;
}
const preset = (c, name) => { for (const k of c._DT_DIFF_KEYS) c._dtDiffSet(k, c._DT_PRESET_NUMBERS[name][k]); };
const bubbles = (c, n, raw) => { let s = 0; for (let i = 0; i < n; i++) s += c._dtResBubble(raw || 1); return s; };
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, msg + ": " + a + " vs " + b);
// research rate of one worker: stat 50, mood 80 -> 1 / (1.4 - 40/90*.7 - .24)
const PER_WORKER = 1 / (1.4 - (40 / 90) * 0.7 - 0.24);

// 1. Original preset: the game's raw 1 or 2 per bubble, no allowance used.
{
  const c = context();
  assert.equal(c._dtResShipped(), true);
  assert.equal(bubbles(c, 10), 10);
  assert.equal(c._dtResBubble(2), 2, "lucky perk bubble stays 2");
assert.ok(c._dtResearchRaw() >= 2, "raw bubble points are counted for the pipeline");
  assert.equal(c._dtRes.pool, null, "allowance untouched");
}

// 2. Realistic, work cut to half: each bubble is 0.3 / 0.5 = 0.6 coin.
{
  const c = context({ scale: 0.5 });
  preset(c, "realistic");
  assert.equal(bubbles(c, 10), 6);
  const daily = 0.3 * (36 / 3) * PER_WORKER * 1.2;
  near(c._dtResDaily(), daily, "daily allowance = research x average room rate x 1.2 s");
  near(c._dtRes.pool, daily * 120 - 6, "starts with 120 days, 6 drawn");
}

// 3. Original stores no allowance, so switching preset starts fresh.
{
  const c = context({ scale: 0.5 });
  c._dtResTick();
  assert.equal(c._dtRes.pool, null);
  preset(c, "realistic");
  c._dtResTick();
  near(c._dtRes.pool, c._dtResDaily() * 120, "fresh 120 days");
}

// 4. Allowance used up: bubbles pay a tenth of their value.
{
  const c = context({ scale: 0.5 });
  preset(c, "realistic");
  c._dtResTick();
  c._dtRes.pool = 0;
  assert.equal(bubbles(c, 50), 3, "50 x 0.6 x 0.1 = 3");
}

// 5. Daily refill, capped at a year; a day jump re-bases without paying.
{
  const c = context({ scale: 0.5 });
  preset(c, "realistic");
  c._dtResTick();
  const d = c._dtResDaily();
  near(c._dtRes.pool, d * 120, "start");
  c.gv.DayTotal = 502;
  c._dtResTick();
  near(c._dtRes.pool, d * 122, "two days refilled");
  c.gv.DayTotal = 900;
  c._dtResTick();
  near(c._dtRes.pool, d * 122, "load or jump does not pay");
  for (let i = 0; i < 300; i++) { c.gv.DayTotal += 2; c._dtResTick(); }
  near(c._dtRes.pool, d * 365, "never more than a year stored");
}

// 6. Bubble coins are not scaled twice; a lab collect on the same tick is.
{
  const c = context({ scale: 0.5 });
  preset(c, "realistic");
  c._dtDiffResearch();
  const got = bubbles(c, 10); // the game's AddVar
  c.gv.ResearchCoins += got + 10; // plus a +10 collect
  c._dtDiffResearch();
  assert.equal(c.gv.ResearchCoins, 100 + 6 + 3, "bubbles 6 kept, collect +10 -> +3");
}

// 7. The comp never goes past COMP_MAX (work cut below a quarter).
{
  const c = context({ scale: 0.1 });
  preset(c, "realistic");
  assert.equal(bubbles(c, 10), 12, "0.3 x 4 = 1.2 per bubble");
}

// 8. Staff read failure: falls back to the plain research slider.
{
  const c = context({ throwStaff: true });
  preset(c, "realistic");
  assert.equal(bubbles(c, 10), 3);
  assert.ok(Number.isNaN(c._dtResDaily()));
  assert.equal(bubbles(c, 10), 3, "no allowance limit either");
}

// 9. Leaving the company resets the allowance and carry.
{
  const c = context({ scale: 0.5 });
  preset(c, "brutal");
  bubbles(c, 3);
  c._dtDiffResetResearch();
  assert.equal(c._dtRes.pool, null);
  assert.equal(c._dtRes.carry, 0);
  assert.equal(c._dtRes.added, 0);
}

// 10. Programmer room uses its own stage's cut.
{
  const c = context({ scale: 0.25, gv: { OfficeType: "PROGRAMMER" } });
  preset(c, "realistic");
  assert.equal(bubbles(c, 10), 12, "0.3 / 0.25");
  assert.ok("programmer" in c._dtRes.cut);
}

// 11. The allowance is saved in row 150: a reload cannot refill it; old rows start at START_DAYS.
{
  const c = context({ scale: 0.5 });
  const cells = {};
  const saves = { width: 3, height: 200, getAt: (x, y) => cells[x + "," + y] ?? 0, setAt: (v, x, y) => { cells[x + "," + y] = v; } };
  c._dtDiffSaves = () => saves;
  let fileWrites = 0;
  c.saveArraysToFile = function () { fileWrites++; return JSON.parse(cells["0,150"]).res; };
  c._dtDiffLoad();
  preset(c, "realistic");
  c._dtResTick();
  c._dtRes.pool = 5; // spent nearly all of it
  c._dtDiffWrapSave();
  c._dtDiffWrapSave(); // wraps once
  const res = c.saveArraysToFile("Save.dt", "ArraySaves");
  assert.equal(fileWrites, 1);
  assert.deepEqual(Array.from(res), [5, 500], "game save writes the allowance left first");
  // Reload: leaving resets, loading the row brings back what was left, not 120 days.
  c._dtDiffSlot = -1;
  c._dtDiffResetResearch();
  c._dtDiffLoad();
  c._dtResTick();
  near(c._dtRes.pool, 5, "reload keeps the spent allowance");
  c.gv.DayTotal = 501;
  c._dtResTick();
  near(c._dtRes.pool, 5 + c._dtResDaily(), "refills from the saved day");
  // A row from before this field: 120 days, and bad values are ignored.
  for (const old of [undefined, "x", [-1, 500], [null, 500]]) {
    const j = JSON.parse(cells["0,150"]);
    if (old === undefined) delete j.res; else j.res = old;
    cells["0,150"] = JSON.stringify(j);
    c._dtDiffSlot = -1;
    c._dtDiffResetResearch();
    c._dtDiffLoad();
    assert.equal(c._dtDiff.research, 0.3, "settings still load");
    c._dtResTick();
    near(c._dtRes.pool, c._dtResDaily() * 120, "old row starts with 120 days");
  }
  // Original keeps no allowance and saves none.
  preset(c, "original");
  c._dtResTick();
  c._dtDiffSave();
  assert.equal(JSON.parse(cells["0,150"]).res, undefined);
}

// 12. One room's rate, paid by the pipeline off screen: its own staff, not the average.
// Like the game's timer it reads mood at row = character id (60 here), not the staff row (80).
{
  const c = context();
  const at = c._at41;
  c._at41 = (arr, x, y) => (arr.name === "ArrayMyEmployees" && y === 1 ? 60 : at(arr, x, y));
  const GAME_WORKER = 1 / (1.4 - (40 / 90) * 0.7 - 0.18);
  near(c._dtResearchRoomRate("programmer"), 12 * GAME_WORKER, "programming room rate");
  near(c._dtResearchRoomRate("engineer"), 9 * GAME_WORKER, "engineering room rate");
  near(c._dtResRate(), (36 / 3) * PER_WORKER, "average room rate unchanged");
}

console.log("research runtime: 12 scenarios passed");
