// Behaviour test for difficulty.js against a small mock of the game runtime.
// The mocks mirror the originals difficulty.js wraps (_potentialUnits,
// _compute4, setRatingsConfig) and the ArraySaves row it persists to.
// Usage: node test_difficulty_runtime.js <difficulty.js>
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

class Saves {
  constructor(width = 3, height = 200) {
    this.width = width;
    this.height = height;
    this.cells = new Map();
  }
  getAt(x, y, z) {
    const k = x + "," + y + "," + z;
    return this.cells.has(k) ? this.cells.get(k) : 0;
  }
  setAt(v, x, y, z) {
    this.cells.set(x + "," + y + "," + z, v);
  }
  getSize() {
    return [this.width, this.height, 1];
  }
}

const DEFAULTS = { buy: 1, cost: 1, research: 1, rivals: 1, build: 1 };

function world(opts) {
  opts = opts || {};
  const gv = Object.assign({ SaveSlot: 0, CompanyName: "Acme", ResearchCoins: 100, DayTotal: 500 }, opts.gv || {});
  const layout = { name: opts.layout || "GAME OFFICE 1" };
  const saves = opts.saves || new Saves();
  const ratingsCalls = [];
  const ratings = { NPC_MARKET_BASE_EARN_B: 100, NPC_MARKET_BASE_FANS_M: 10, OTHER: 7 };
  const potentialCalls = [];
  const computeCalls = [];
  const npcCalls = [];
  const computeResult = { supported: true, total: 201 };
  const rivalRows = opts.rivalRows || [61, 113, 10];
  const names = opts.names || { 61: "Nokya", 113: "Motolora", 10: "Samsong" };
  const ratingsArray = { getAt: (x, y) => (y === 0 ? rivalRows[x] : 0) };

  function _potentialUnits() {
    const args = [...arguments];
    potentialCalls.push(args);
    return Math.floor(((Number(args[4]) || 1) * 100) / (Number(args[1]) || 1));
  }
  function _compute4() {
    computeCalls.push([...arguments]);
    return Object.assign({}, computeResult);
  }
  function setRatingsConfig(cfg) {
    if (cfg && typeof cfg === "object") Object.assign(ratings, cfg);
    ratingsCalls.push(cfg ? Object.assign({}, cfg) : null);
    return Object.assign({}, ratings);
  }
  function _tickNpcRow(arr, row, ctx, p) {
    npcCalls.push({ row, p });
    return p;
  }

  const rt = {
    globalVars: gv,
    layout,
    objects: {
      ArraySaves: { getFirstInstance: () => saves },
      ArrayRatingsCompanies: { getFirstInstance: () => ratingsArray },
    },
  };
  return {
    gv, layout, saves, rt, ratings, ratingsCalls, potentialCalls, computeCalls, npcCalls, computeResult,
    rivalRows, names,
    orig: { _potentialUnits, _compute4, setRatingsConfig, _tickNpcRow },
  };
}

function context(w) {
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setInterval() { return 0; },
    clearInterval() {},
    Math, Number, String, Object, Array, JSON, Error, Infinity, NaN,
    runtime: w.rt,
    _potentialUnits: w.orig._potentialUnits,
    _compute4: w.orig._compute4,
    setRatingsConfig: w.orig.setRatingsConfig,
    _tickNpcRow: w.orig._tickNpcRow,
    _companyName(id) {
      return w.names[id] || "#" + id;
    },
    _dtUi: {
      num(n, d) {
        const v = Number(w.gv[n]);
        return Number.isFinite(v) ? v : d;
      },
      gv(n, d) {
        const v = w.gv[n];
        return v === undefined || v === null ? d : v;
      },
      layoutName() {
        return String(w.layout.name || "");
      },
      onOffice() { return true; },
      t(e) { return e && e.en || e; },
      chip() {}, removeChip() {}, modal() {}, el() {}, button() {},
    },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(process.argv[2], "utf8"), ctx, { filename: process.argv[2] });
  return ctx;
}

const diff = (c) => Object.assign({}, c._dtDiff);

// 1. Defaults leave the wrapped originals alone.
{
  const w = world(), c = context(w);
  assert.deepEqual(diff(c), DEFAULTS);
  const u = c._potentialUnits(5, 100, 10, 0, 101, 0, {}, 1, {});
  assert.equal(u, 101, "default demand is the original 101");
  assert.equal(w.potentialCalls.length, 1);
  assert.deepEqual(w.potentialCalls[0].slice(0, 6), [5, 100, 10, 0, 101, 0]);
  const cost = c._compute4("SMARTPHONE", {}, 500);
  assert.deepEqual(cost, { supported: true, total: 201 }, "default cost is untouched");
  assert.equal(w.computeCalls.length, 1);
  assert.deepEqual(w.computeCalls[0], ["SMARTPHONE", {}, 500]);
  assert.equal(c._dtDiffBuild(100), 100, "default build work is untouched");
  c._dtDiffLoad();
  assert.equal(w.ratingsCalls.length, 0, "Original does not touch the ratings config");
  assert.equal(c._tickNpcRow({}, 0, {}, 1), 1, "Original leaves rival growth untouched");
}

// 2. Buy 0.5 halves demand with the game's floor.
{
  const w = world(), c = context(w);
  c._dtDiffSet("buy", 0.5);
  assert.equal(c._potentialUnits(5, 100, 10, 0, 101, 0, {}, 1, {}), 50);
}

// 3. Cost 1.25 scales total cost; a design it scales is later judged at its
//    unscaled base cost, while an existing row is never re-costed.
{
  const w = world(), c = context(w);
  c._dtDiffSet("cost", 1.25);
  assert.equal(c._potentialUnits(5, 100, 10, 0, 101, 0, {}, 1, {}), 101,
    "an existing row is not divided by the current cost slider");
  assert.equal(w.potentialCalls[0][1], 100, "the stored row cost reaches _potentialUnits unchanged");
  const cost = c._compute4("SMARTPHONE", {}, 500);
  assert.equal(cost.supported, true);
  assert.equal(cost.total, Math.round(201 * 1.25), "total is rounded after scaling");
  assert.equal(c._potentialUnits(5, cost.total, 10, 0, 101, 0, {}, 1, {}), 50);
  assert.equal(w.potentialCalls[1][1], 201, "a new design is judged at its design-time base cost");
}

// 4. Rivals 4 halves demand by sqrt, leaves the market target alone, and
//    scales each rival's growth by sqrt(rivals) times 0.9..1.12 variety.
{
  const w = world(), c = context(w);
  // The saved/UI range tops out at 3; set 4 directly to exercise sqrt(4).
  c._dtDiff.rivals = 4;
  c._dtDiffApplyRivals();
  assert.equal(c._potentialUnits(5, 100, 10, 0, 101, 0, {}, 1, {}), 50);
  assert.equal(w.ratingsCalls.filter((x) => x !== null).length, 0,
    "competitor strength does not scale the market bases");
  const p = c._tickNpcRow({}, 0, {}, 1);
  const gLo = 1 + (Math.sqrt(4) * 0.9 - 1) * 0.7;
  const gHi = 1 + (Math.sqrt(4) * 1.12 - 1) * 0.7;
  assert.ok(p >= gLo - 1e-9 && p <= gHi + 1e-9,
    "growth is sqrt(rivals) x 0.9..1.12, damped 0.7 toward 1");
  c._dtDiff.rivals = 2;
  c._dtDiffApplyRivals();
  assert.equal(w.ratingsCalls.filter((x) => x !== null).length, 0,
    "changing rivals never writes the market bases");
}

// 5. Build 2 halves the work.
{
  const w = world(), c = context(w);
  c._dtDiffSet("build", 2);
  assert.equal(c._dtDiffBuild(100), 50);
}

// 6. Save/load round trip in row 150 of the SaveSlot column.
{
  const w = world({ gv: { SaveSlot: 1, CompanyName: "Acme" } });
  const c = context(w);
  c._dtDiffLoad();
  const wanted = { buy: 0.5, cost: 1.25, research: 0.75, rivals: 1.5, build: 1.8 };
  for (const k of Object.keys(wanted)) c._dtDiffSet(k, wanted[k]);
  const raw = w.saves.getAt(1, 150, 0);
  assert.equal(typeof raw, "string", "row 150 column 1 holds the JSON");
  assert.equal(w.saves.getAt(0, 150, 0), 0, "other slots are untouched");
  const saved = JSON.parse(raw);
  assert.equal(saved.v, 1);
  assert.equal(saved.company, "Acme");
  for (const k of Object.keys(wanted)) assert.equal(saved[k], wanted[k], k + " saved");
  const c2 = context(w);
  c2._dtDiffLoad();
  assert.deepEqual(diff(c2), wanted, "same company reloads saved values");
  w.gv.CompanyName = "Other";
  const c3 = context(w);
  c3._dtDiffLoad();
  assert.deepEqual(diff(c3), DEFAULTS, "a different company in the row starts at defaults");
}

// 7. Out-of-range values clamp, both on save and on load.
{
  const w = world(), c = context(w);
  c._dtDiffSet("buy", 99);
  c._dtDiffSet("cost", 0.01);
  c._dtDiffSet("research", -1);
  c._dtDiffSet("rivals", 10);
  c._dtDiffSet("build", 0);
  assert.deepEqual(diff(c), { buy: 2, cost: 0.5, research: 0.25, rivals: 3, build: 0.25 });
  const w2 = world({ gv: { SaveSlot: 2, CompanyName: "Acme" } });
  w2.saves.setAt(JSON.stringify({
    v: 1, company: "Acme", buy: 99, cost: 0.01, research: 9, rivals: 0.01, build: 99,
  }), 2, 150, 0);
  const c2 = context(w2);
  c2._dtDiffLoad();
  assert.deepEqual(diff(c2), { buy: 2, cost: 0.5, research: 2, rivals: 0.5, build: 2 }, "loaded values clamp");
}

// 8. Research 0.5 turns a +10 gain into +5 within one layout/day step.
{
  const w = world({ gv: { ResearchCoins: 100, DayTotal: 500 } });
  const c = context(w);
  c._dtDiffSet("research", 0.5);
  c._dtDiffResearch();
  assert.equal(c._dtDiffCoins, 100, "first tick records the baseline");
  w.gv.ResearchCoins = 110;
  c._dtDiffResearch();
  assert.equal(w.gv.ResearchCoins, 105, "+10 becomes +5");
  assert.equal(c._dtDiffCoins, 105);
}

// 9. Research carry keeps fractional losses until the next whole coin.
{
  const w = world({ gv: { ResearchCoins: 100, DayTotal: 500 } });
  const c = context(w);
  c._dtDiffSet("research", 0.5);
  c._dtDiffResearch();
  w.gv.ResearchCoins = 105;
  c._dtDiffResearch();
  assert.equal(w.gv.ResearchCoins, 103, "+5 writes +3 and keeps -0.5 in carry");
  w.gv.ResearchCoins = 108;
  c._dtDiffResearch();
  assert.equal(w.gv.ResearchCoins, 105, "the carried half pays the next +2");
}

// 10. A layout change resets the research baseline without scaling.
{
  const w = world({ gv: { ResearchCoins: 100, DayTotal: 500 }, layout: "GAME OFFICE 1" });
  const c = context(w);
  c._dtDiffSet("research", 0.5);
  c._dtDiffResearch();
  w.layout.name = "GAME OFFICE 2";
  w.gv.ResearchCoins = 110;
  c._dtDiffResearch();
  assert.equal(w.gv.ResearchCoins, 110, "new layout baseline is not scaled");
  assert.equal(c._dtDiffCoins, 110);
  w.gv.ResearchCoins = 120;
  c._dtDiffResearch();
  assert.equal(w.gv.ResearchCoins, 115, "the next gain scales from the new baseline");
}


// 11. The whole rival world follows buy only; competitor strength scales each
//     rival's growth by sqrt(rivals) with stable 0.9..1.12 name variety.
{
  const w = world(), c = context(w);
  const lastWrite = () => w.ratingsCalls.filter((x) => x !== null).pop();
  c._dtDiffSet("buy", 0.8);
  assert.deepEqual(lastWrite(), { NPC_MARKET_BASE_EARN_B: 80, NPC_MARKET_BASE_FANS_M: 8 }, "buy scales rival sales/fans");
  c._dtDiffSet("buy", 1);
  assert.deepEqual(lastWrite(), { NPC_MARKET_BASE_EARN_B: 100, NPC_MARKET_BASE_FANS_M: 10 }, "buy=1 restores the base");
  c._dtDiffSet("rivals", 1.25);
  assert.deepEqual(lastWrite(), { NPC_MARKET_BASE_EARN_B: 100, NPC_MARKET_BASE_FANS_M: 10 },
    "rivals do not enlarge the market target");
  c._dtDiffSet("buy", 0.8);
  assert.deepEqual(lastWrite(), { NPC_MARKET_BASE_EARN_B: 80, NPC_MARKET_BASE_FANS_M: 8 },
    "buy still scales with rivals non-1 (no buy*rivals)");
  const p = [0, 1, 2].map((row) => c._tickNpcRow({}, row, {}, 1));
  const gLo = 1 + (Math.sqrt(1.25) * 0.9 - 1) * 0.7;
  const gHi = 1 + (Math.sqrt(1.25) * 1.12 - 1) * 0.7;
  for (const v of p) {
    assert.ok(v >= gLo - 1e-9 && v <= gHi + 1e-9,
      "growth stays in sqrt(rivals) x 0.9..1.12 damped toward 1");
  }
  assert.notEqual(p[0], p[1], "different names get different growth");
  const c2 = context(world());
  c2._dtDiffSet("rivals", 1.25);
  const q = [0, 1, 2].map((row) => c2._tickNpcRow({}, row, {}, 1));
  assert.deepEqual(p, q, "the name seed is stable across loads");
}

// 12. Old saves that named the preset "harder" still load as realistic.
{
  const w = world();
  w.saves.setAt(JSON.stringify({ v: 1, company: "Acme", preset: "harder" }), 0, 150, 0);
  const c = context(w);
  c._dtDiffLoad();
  assert.deepEqual(diff(c), { buy: 1, cost: 1, research: 0.3, rivals: 1.1, build: 1 }, "legacy harder preset loads realistic numbers");
  const w2 = world();
  w2.saves.setAt(JSON.stringify({
    v: 1, company: "Acme", preset: "harder", buy: 0.5, cost: 1.2, research: 1, rivals: 2, build: 0.75,
  }), 0, 150, 0);
  const c2 = context(w2);
  c2._dtDiffLoad();
  assert.deepEqual(diff(c2), { buy: 0.5, cost: 1.2, research: 1, rivals: 2, build: 0.75 },
    "explicit slider values win over the legacy preset name");
}

// 13. Preset keys and recommended marker.
{
  const c = context(world());
  assert.deepEqual(Object.keys(c._DT_DIFF_PRESETS), ["original", "realistic", "brutal"]);
  assert.equal(c._DT_DIFF_RECOMMENDED, "realistic");
  assert.deepEqual(diff(c), { buy: 1, cost: 1, research: 1, rivals: 1, build: 1 });
}

// 14. Loading a save that restores more coins on the same day is not a gain.
{
  const w = world({ gv: { ResearchCoins: 500, DayTotal: 500 } });
  const c = context(w);
  c._dtDiffSet("research", 0.5);
  c._dtDiffResearch();
  w.gv.ResearchCoins = 1000;
  w.layout.name = "LOADING GAME";
  c._dtDiffTick();
  w.layout.name = "GAME OFFICE 1";
  c._dtDiffTick();
  assert.equal(w.gv.ResearchCoins, 1000, "restored coins are not scaled");
  assert.equal(c._dtDiffCoins, 1000);
  w.gv.ResearchCoins = 1010;
  c._dtDiffResearch();
  assert.equal(w.gv.ResearchCoins, 1005, "the next real gain still scales from the restored baseline");
}

// 15. Round-1 rows only carry the five numbers; their old preset tuple is
//     migrated to the retuned preset of the same name.
{
  const oldHarder = { buy: 0.8, cost: 1.1, research: 0.8, rivals: 1.25, build: 1 };
  const w = world();
  w.saves.setAt(JSON.stringify(Object.assign({ v: 1, company: "Acme" }, oldHarder)), 0, 150, 0);
  const c = context(w);
  c._dtDiffLoad();
  assert.deepEqual(diff(c), { buy: 1, cost: 1, research: 0.3, rivals: 1.1, build: 1 },
    "old Harder values load as the retuned Realistic preset");
  const oldBrutal = { buy: 0.6, cost: 1.25, research: 0.7, rivals: 1.5, build: 1 };
  const w2 = world();
  w2.saves.setAt(JSON.stringify(Object.assign({ v: 1, company: "Acme" }, oldBrutal)), 0, 150, 0);
  const c2 = context(w2);
  c2._dtDiffLoad();
  assert.deepEqual(diff(c2), { buy: 0.85, cost: 1.1, research: 0.25, rivals: 1.5, build: 1 },
    "old Brutal values load as the retuned Brutal preset");
}

// 16. NEW GAME in a used slot clears the row even when the company name is reused.
{
  const w = world({ gv: { SaveSlot: 0, CompanyName: "Ember" } });
  const c = context(w);
  c._dtDiffSet("buy", 0.5);
  c._dtDiffSet("rivals", 1.5);
  assert.equal(JSON.parse(w.saves.getAt(0, 150, 0)).rivals, 1.5);
  w.layout.name = "LOADING GAME";
  w.gv.LoadingType = "NEW GAME";
  c._dtDiffTick();
  assert.equal(String(w.saves.getAt(0, 150, 0) ?? ""), "", "NEW GAME clears row 150");
  w.layout.name = "GAME OFFICE 1";
  c._dtDiffTick();
  assert.deepEqual(diff(c), DEFAULTS, "the new campaign starts at defaults");
}

// 17. Moving the cost slider never changes demand for an existing row; a new
//     design follows the slider's cost and is judged at its design-time base.
{
  const w = world(), c = context(w);
  c._dtDiffSet("cost", 0.5);
  assert.equal(c._potentialUnits(5, 100, 10, 0, 101, 0, {}, 1, {}), 101);
  c._dtDiffSet("cost", 2);
  assert.equal(c._potentialUnits(5, 100, 10, 0, 101, 0, {}, 1, {}), 101,
    "the existing row keeps the same demand after the slider moves");
  assert.equal(w.potentialCalls[1][1], 100, "its stored cost is still passed unchanged");
  const cost = c._compute4("SMARTPHONE", {}, 500);
  assert.equal(cost.total, 402, "the new design follows the new cost slider");
  const fresh = c._potentialUnits(5, cost.total, 10, 0, 101, 0, {}, 1, {});
  assert.equal(fresh, 50);
  c._dtDiffSet("cost", 0.5);
  assert.equal(c._potentialUnits(5, cost.total, 10, 0, 101, 0, {}, 1, {}), fresh,
    "the new design is also stable when the slider moves again");
  assert.equal(w.potentialCalls.length, 4);
  const c2 = context(w);
  c2._dtDiffLoad();
  c2._potentialUnits(5, cost.total, 10, 0, 101, 0, {}, 1, {});
  assert.equal(w.potentialCalls[4][1], 201);
  assert.equal(c2._dtDiffCostBases.get(cost.total), 201, "design-time cost bases persist in row 150");
}

// 17b. Editor previews cannot grow row 150 without bound: only the most
//      recently used bases are kept, and a device that demand keeps touching
//      survives a flood of previews.
{
  const w = world(), c = context(w);
  c._dtDiffSet("cost", 2);
  const kept = c._compute4("SMARTPHONE", {}, 500).total;
  for (let i = 0; i < 1000; i++) {
    c._dtDiffRememberCost(100000 + 2 * i, 50000 + i);
    if (i % 100 === 0) c._potentialUnits(5, kept, 10, 0, 101, 0, {}, 1, {});
  }
  assert.equal(c._dtDiffCostBases.size, c._DT_DIFF_COST_KEEP, "the base list is capped");
  assert.equal(c._dtDiffCostBases.get(kept), 201, "a device still on sale keeps its base");
  c._dtDiffSave();
  const saved = JSON.parse(w.saves.getAt(0, 150, 0));
  assert.equal(saved.costs.length, c._DT_DIFF_COST_KEEP, "the saved row stays bounded");
}

// 17c. Two designs whose scaled totals round to the same number keep their own
//      bases (OP-4): the later one moves to a free total next to it.
{
  const w = world(), c = context(w);
  c._dtDiffSet("cost", 2);
  w.computeResult.total = 151;
  const a = c._compute4("SMARTPHONE", {}, 500).total;
  c._dtDiffSet("cost", 1.5);
  w.computeResult.total = 201;
  const b = c._compute4("SMARTPHONE", {}, 500).total;
  assert.equal(a, 302);
  assert.notEqual(b, a, "the second design gets its own total");
  assert.ok(Math.abs(b - 302) <= 1, "and it is only a dollar off");
  assert.equal(c._compute4("SMARTPHONE", {}, 500).total, b, "re-pricing the same design gives the same total");
  w.potentialCalls.length = 0;
  c._potentialUnits(5, a, 10, 0, 101, 0, {}, 1, {});
  c._potentialUnits(5, b, 10, 0, 101, 0, {}, 1, {});
  assert.equal(w.potentialCalls[0][1], 151, "device A is judged at its own base");
  assert.equal(w.potentialCalls[1][1], 201, "device B is judged at its own base, not A's");
}

// 18. A rival named after an Object.prototype key still gets a real seed.
{
  const w = world({ rivalRows: [7, 61], names: { 7: "constructor", 61: "Nokya" } });
  const c = context(w);
  c._dtDiffSet("rivals", 1.25);
  assert.ok(Number.isFinite(c._dtDiffRivalVariety("constructor")));
  assert.equal(typeof c._dtDiffRivalSeeds.constructor, "number");
  const p = [0, 1].map((row) => c._tickNpcRow({}, row, {}, 1));
  assert.ok(p.every((v) => Number.isFinite(v) && v > 1), "both rivals receive a finite multiplier");
  assert.notEqual(p[0], p[1], "the prototype-key name is not silently dropped");
}

// 19. null/empty slider values in a corrupt row fall back to 1, not the minimum.
{
  const w = world();
  w.saves.setAt(JSON.stringify({
    v: 1, company: "Acme", buy: null, cost: "", research: "0.5", rivals: 0, build: "  ",
  }), 0, 150, 0);
  const c = context(w);
  c._dtDiffLoad();
  assert.deepEqual(diff(c), { buy: 1, cost: 1, research: 0.5, rivals: 0.5, build: 1 });
}

// 21. A new company reusing the name in the same slot starts at Original, even if the NEW GAME
//     layout tick was missed; the old campaign's row is never read into it. Rows written before
//     this check (no day) still load.
{
  const w = world({ gv: { DayTotal: 3000 } });
  w.saves.setAt(JSON.stringify({ v: 1, company: "Acme", day: 3000, buy: 0.85, cost: 1.1, research: 0.25, rivals: 1.5, build: 1 }), 0, 150, 0);
  const c = context(w);
  c._dtDiffLoad();
  assert.equal(diff(c).rivals, 1.5, "same campaign loads its row");
  w.gv.DayTotal = 1; // new game, same name and slot
  c._dtDiffLoad();
  assert.deepEqual(diff(c), DEFAULTS, "new campaign: Original");
  w.gv.DayTotal = 40;
  c._dtDiffLoad();
  assert.deepEqual(diff(c), DEFAULTS, "still Original while playing on");
  c._dtDiffSave();
  assert.equal(JSON.parse(w.saves.getAt(0, 150, 0)).day, 40, "its own row now carries its day");
  // Globals arriving after the first read (today still behind the loaded row): read again once caught up.
  const w2 = world({ gv: { DayTotal: 12 } });
  w2.saves.setAt(JSON.stringify({ v: 1, company: "Acme", day: 2000, buy: 0.5, cost: 1, research: 1, rivals: 1, build: 1 }), 0, 150, 0);
  const c2 = context(w2);
  c2._dtDiffLoad();
  assert.equal(diff(c2).buy, 1, "row newer than today is not taken");
  w2.gv.DayTotal = 2000;
  c2._dtDiffLoad();
  assert.equal(diff(c2).buy, 0.5, "taken once the save's own day is in");
  // Old rows without a day.
  const w3 = world({ gv: { DayTotal: 9 } });
  w3.saves.setAt(JSON.stringify({ v: 1, company: "Acme", buy: 0.5, cost: 1, research: 1, rivals: 1, build: 1 }), 0, 150, 0);
  const c3 = context(w3);
  c3._dtDiffLoad();
  assert.equal(diff(c3).buy, 0.5, "row without a day still loads");
  // An older save of the same campaign, loaded later in the game: ArraySaves keeps the row the
  // player wrote after that save (day ahead). It is theirs, not another campaign's, and a game
  // save in the gap must not write Original over it.
  const w4 = world({ gv: { DayTotal: 2736 } });
  w4.saves.setAt(JSON.stringify({ v: 1, company: "Acme", day: 2749, buy: 1, cost: 1, research: 0.3, rivals: 1.1, build: 1 }), 0, 150, 0);
  const c4 = context(w4);
  c4._dtDiffLoad();
  assert.equal(diff(c4).rivals, 1.1, "older save of the same campaign keeps the player's setting");
  c4._dtDiffSave();
  assert.equal(JSON.parse(w4.saves.getAt(0, 150, 0)).research, 0.3, "and a save keeps it");
  // A new campaign played on day by day (no save yet) never takes the old campaign's row, not
  // even on the day before the row's day.
  const w5 = world({ gv: { DayTotal: 1 } });
  w5.saves.setAt(JSON.stringify({ v: 1, company: "Acme", day: 300, buy: 0.85, cost: 1.1, research: 0.25, rivals: 1.5, build: 1 }), 0, 150, 0);
  const c5 = context(w5);
  for (let d = 1; d <= 320; d++) {
    w5.gv.DayTotal = d;
    c5._dtDiffLoad();
  }
  assert.deepEqual(diff(c5), DEFAULTS, "still Original after reaching the old row's day");
}

// 20. Russian labels are real and stay in step with the English ones.
{
  const c = context(world());
  const T = c._DT_DIFF_TEXT;
  assert.equal(T.title.ru, "Сложность");
  assert.equal(T.realistic.ru, "Реалистично");
  assert.equal(T.brutal.ru, "Жёстко");
  assert.equal(T.original.ru, "Как в игре");
  for (const k of Object.keys(T)) assert.ok(T[k].en && T[k].ru, k + " has EN and RU text");
}

console.log("difficulty runtime: 22 scenarios passed");
