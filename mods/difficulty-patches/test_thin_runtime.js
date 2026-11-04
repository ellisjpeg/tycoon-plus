// Behaviour test for thin.js (depth follows the calendar) loaded after
// difficulty.js and research.js, against small mocks of the game's arrays.
// Usage: node test_thin_runtime.js <difficulty.js> <research.js> <thin.js>
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function grid(cells, width) {
  return {
    width,
    getAt(x, y) { return cells[x + "," + y]; },
    setAt(v, x, y) { cells[x + "," + y] = v; },
  };
}
function context(opts) {
  opts = opts || {};
  const gv = Object.assign({ SaveSlot: 0, CompanyName: "Acme", Year: 2009, DayTotal: 400, MiniPage: 1, LanguageChoose: 0, SmartphoneDepth: 1 }, opts.gv || {});
  const layout = { name: opts.layout || "SMARTPHONE PAGE 1" };
  const my = grid({ "3,0": opts.research === undefined ? 4 : opts.research }, 800);
  const page = grid({ "0,0": 1, "0,1": "Device Width", "0,2": 2, "0,3": 10, "0,4": "", "1,0": 3, "1,1": "Device Thickness", "1,2": opts.research === undefined ? 4 : opts.research, "1,3": 10, "1,4": opts.status === undefined ? "" : opts.status }, 2);
  const research = grid({ "3,0": 10 }, 800);
  const lang = grid({ "0,11956": "NOT AVAILABLE", "1,11956": "НЕДОСТУПНО" }, 15);
  const one = (g) => ({ getFirstInstance: () => g });
  const listeners = {};
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setInterval() { return 0; },
    clearInterval() {},
    Math, Number, String, Object, Array, JSON, Error, Infinity, NaN, Map, Set,
    runtime: {
      globalVars: gv, layout,
      objects: { ArrayMyResearch: one(my), ArrayResearchPage_Temp: one(page), ArrayResearch: one(research), ArrayLanguage: one(lang) },
      addEventListener(n, f) { listeners[n] = f; },
    },
    _readRows() { return [0, 1].map((x) => ({ id: page.getAt(x, 0), status: page.getAt(x, 4), active: page.getAt(x, 4) === "" })); },
    _potentialUnits() { return 0; },
    _compute4() { return { supported: false }; },
    setRatingsConfig() { return {}; },
    _tickNpcRow(a, r, c, p) { return p; },
    _companyName(id) { return "#" + id; },
    STAGES: {},
    _dtUi: {
      num(n, d) { const v = Number(gv[n]); return Number.isFinite(v) ? v : d; },
      gv(n, d) { const v = gv[n]; return v === undefined || v === null ? d : v; },
      layoutName() { return layout.name; },
      onOffice() { return false; },
      t(e, vars) { let s = e.en; for (const k in vars || {}) s = s.split("{" + k + "}").join(String(vars[k])); return s; },
      chip() {}, removeChip() {}, modal() {}, el() {}, button() {},
    },
  };
  vm.createContext(ctx);
  for (const f of process.argv.slice(2, 5)) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
  ctx._dtDiffLoad();
  if (opts.preset !== "original") for (const k of ctx._DT_DIFF_KEYS) ctx._dtDiffSet(k, ctx._DT_PRESET_NUMBERS[opts.preset || "realistic"][k]);
  Object.assign(ctx, { gv, layout, my, page, listeners });
  return ctx;
}

// 1. The table: year -> thinnest level, held between table years.
{
  const c = context();
  const want = { 2007: 4, 2008: 4, 2009: 5, 2010: 6, 2011: 7, 2012: 8, 2013: 8, 2014: 9, 2015: 9, 2016: 9, 2024: 9, 2025: 10, 2040: 10 };
  for (const y in want) assert.equal(c._dtThinYearLevel(Number(y)), want[y], "year " + y);
  assert.equal(c._dtThinNextYear(4), 2009);
  assert.equal(c._dtThinNextYear(8), 2014);
  assert.equal(c._dtThinNextYear(9), 2025);
  assert.equal(c._dtThinNextYear(10), 0);
  // every table year really allows a body at least that thick
  for (const y in c._DT_THIN.YEAR_MM) assert.ok(c._DT_THIN.LEVEL_MM[c._dtThinYearLevel(Number(y)) - 1] >= c._DT_THIN.YEAR_MM[y] - 1e-6);
}

// 2. Slider cap: the thinner of research and the year; Original = research only.
{
  const c = context({ gv: { Year: 2009 } });
  assert.equal(c._dtThinCap(10), 5, "research 10 in 2009 -> 5");
  assert.equal(c._dtThinCap(3), 3, "research below the year limit stays");
  c.gv.Year = 2025;
  assert.equal(c._dtThinCap(10), 10);
  const o = context({ preset: "original", gv: { Year: 2009 } });
  assert.equal(o._dtThinCap(10), 10, "Original preset is the shipped game");
}

// 3. Research card: next level NOT AVAILABLE until its year; never taken away.
{
  const c = context({ research: 5, gv: { Year: 2009 } });
  const rows = c._readRows();
  assert.equal(rows[1].status, "NOT AVAILABLE");
  assert.equal(rows[1].active, false);
  assert.equal(rows[0].status, "", "other research untouched");
  assert.equal(c.my.getAt(3, 0), 5, "bought level kept");
  const later = context({ research: 5, gv: { Year: 2010 } });
  assert.equal(later._readRows()[1].status, "", "2010 allows level 6");
  const old = context({ research: 9, gv: { Year: 2009 } });
  assert.equal(old._readRows()[1].status, "NOT AVAILABLE", "a save already past the year keeps level 9");
  assert.equal(old.my.getAt(3, 0), 9);
  const done = context({ research: 10, status: "RESEARCHED", gv: { Year: 2009 } });
  assert.equal(done._readRows()[1].status, "RESEARCHED", "game's own status wins");
  const zero = context({ research: 5, status: 0, gv: { Year: 2009 } });
  assert.equal(zero._readRows()[1].status, "NOT AVAILABLE", "the game's blank status is the number 0");
  const ru = context({ research: 5, gv: { Year: 2009, LanguageChoose: 1 } });
  assert.equal(ru._readRows()[1].status, "НЕДОСТУПНО", "game's own language text");
  const o = context({ preset: "original", research: 5, gv: { Year: 2009 } });
  assert.equal(o._readRows()[1].status, "", "Original: always available");
}

// 4. Editor open: a copied design thinner than the year allows is clamped.
{
  const c = context({ gv: { Year: 2009, SmartphoneDepth: 9, TabletDepth: 9 } });
  c._dtThinOnLayoutStart({ layout: { name: "SMARTPHONE PAGE 1" } });
  assert.equal(c.gv.SmartphoneDepth, 5);
  c._dtThinOnLayoutStart({ layout: { name: "TABLET PAGE 1" } });
  assert.equal(c.gv.TabletDepth, 5, "tablets use the same research");
  c.gv.SmartphoneDepth = 3;
  c._dtThinOnLayoutStart({ layout: { name: "SMARTPHONE PAGE 1" } });
  assert.equal(c.gv.SmartphoneDepth, 3, "thicker designs untouched");
  c.gv.SmartphoneDepth = 9;
  c._dtThinOnLayoutStart({ layout: { name: "SMARTPHONE PAGE 2" } });
  assert.equal(c.gv.SmartphoneDepth, 9, "only page 1 clamps");
  const o = context({ preset: "original", gv: { Year: 2009, SmartphoneDepth: 9 } });
  o._dtThinOnLayoutStart({ layout: { name: "SMARTPHONE PAGE 1" } });
  assert.equal(o.gv.SmartphoneDepth, 9, "Original never clamps");
}

// 5. Hint only when the year (not research) is what holds the slider back.
{
  const c = context({ research: 8, gv: { Year: 2009, SmartphoneDepth: 5 } });
  assert.equal(c._dtThinHintText(), "Thinner bodies from 2010");
  c.gv.SmartphoneDepth = 4;
  assert.equal(c._dtThinHintText(), "", "not at the top end yet");
  c.gv.SmartphoneDepth = 5;
  c.gv.MiniPage = 2;
  assert.equal(c._dtThinHintText(), "", "other page-1 tab");
  c.gv.MiniPage = 1;
  c.my.setAt(5, 3, 0);
  assert.equal(c._dtThinHintText(), "", "research is the limit, not the year");
  c.my.setAt(10, 3, 0);
  c.gv.Year = 2016;
  c.gv.SmartphoneDepth = 9;
  assert.equal(c._dtThinHintText(), "Thinner bodies from 2025");
  c.layout.name = "GAMEPLAY";
  assert.equal(c._dtThinHintText(), "");
  const o = context({ preset: "original", research: 8, gv: { Year: 2009, SmartphoneDepth: 5 } });
  assert.equal(o._dtThinHintText(), "");
}

console.log("thin runtime: 5 scenarios passed");
