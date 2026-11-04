// Behaviour test for real.js (real-life phone calendar and per-part price
// drop) loaded after difficulty.js and research.js, against small mocks.
// Usage: node test_real_runtime.js <difficulty.js> <research.js> <real-data.js> <real.js>
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function grid(rows) {
  return {
    get width() { return rows.length; },
    getAt(x, y) { return rows[x] ? rows[x][y] : undefined; },
    setAt(v, x, y) { rows[x][y] = v; },
  };
}
const REFRESH = [[30, -10], [60, -10], [75, 2680], [90, 3043], [120, 3539], [144, 3909], [165, 4283], [180, 4544], [200, 4806], [240, 5185], [300, 7116]];
const ROM = [["256 MB", -10], ["512 MB", 667], ["1 GB", 737], ["2 GB", 1374], ["4 GB", 1637], ["8 GB", 2108], ["16 GB", 2321], ["32 GB", 2726]];
function context(opts) {
  opts = opts || {};
  const gv = Object.assign({ SaveSlot: 0, CompanyName: "Acme", DayTotal: 3300, LanguageChoose: 0, ScreenTechnologyID: 0, TimelineNextDay: 0 }, opts.gv || {});
  const arrays = {
    ArrayScreenRefreshRate_Smartphone: grid(REFRESH.map((r) => r.slice())),
    ArrayROM_Smartphones: grid(ROM.map((r) => r.slice())),
    ArrayScreenTechnology_Smartphone: grid([["TFT", -10], ["LCD", -10], ["TFT-LCD", -10], ["IPS", 303], ["AMOLED", 651]]),
  };
  const saves = grid([[], [], []].map(() => []));
  const rowsOf = (x) => ({ getAt: (y) => saves.getAt(x, y) });
  saves.getAt = (x, y) => (saves._c || {})[x + "," + y];
  saves.setAt = (v, x, y) => { saves._c = saves._c || {}; saves._c[x + "," + y] = v; };
  Object.defineProperty(saves, "width", { get: () => 3 });
  saves.height = 200;
  if (opts.row) saves.setAt(JSON.stringify(opts.row), 0, 150);
  const dict = new Map([["ArrayScreenRefreshRate_Smartphone", 3539], ["Fingerprint Back (Smartphone)", opts.fp === undefined ? 1190 : opts.fp], ["Other", 99999]]);
  const page = grid([[526, "Fingerprint Back", 0, 1, ""], [27, "Camera Count", 1, 1, 0], [18, "Display Resolution", 2, 5, ""]]);
  const lang = grid([]);
  lang.getAt = (x, y) => (y === 11956 ? "NOT AVAILABLE" : "");
  const one = (g) => ({ getFirstInstance: () => g });
  const objects = { ArraySaves: one(saves), DictionaryTimeline: one({ getDataMap: () => dict }), ArrayResearchPage_Temp: one(page), ArrayLanguage: one(lang) };
  for (const k in arrays) objects[k] = one(arrays[k]);
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setInterval() { return 0; },
    clearInterval() {},
    Math, Number, String, Object, Array, JSON, Error, Infinity, NaN, Map, Set, RegExp,
    runtime: { globalVars: gv, layout: { name: "OFFICE" }, objects, addEventListener() {} },
    _readRows() { return page.getAt(0, 4); },
    _potentialUnits() { return 0; },
    _compute4() { return { supported: false }; },
    _ageFactor(a) { return a > 0 ? Math.max(0.06, Math.pow(0.82, a)) : 1; },
    _cfg12: { COMPONENT_DECAY: 0.82, COMPONENT_FLOOR: 0.06 },
    setRatingsConfig() { return {}; },
    _tickNpcRow(a, r, c, p) { return p; },
    _companyName(id) { return "#" + id; },
    STAGES: {},
    _dtUi: {
      num(n, d) { const v = Number(gv[n]); return Number.isFinite(v) ? v : d; },
      gv(n, d) { const v = gv[n]; return v === undefined || v === null ? d : v; },
      layoutName() { return "OFFICE"; },
      onOffice() { return false; },
      t(e) { return e.en; },
      chip() {}, removeChip() {}, modal() {}, el() {}, button() {},
    },
  };
  vm.createContext(ctx);
  for (const f of process.argv.slice(2, 6)) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
  ctx._dtDiffSaves = () => saves;
  ctx._dtDiffLoad();
  if (opts.preset !== "original" && !opts.row) for (const k of ctx._DT_DIFF_KEYS) ctx._dtDiffSet(k, ctx._DT_PRESET_NUMBERS[opts.preset || "realistic"][k]);
  Object.assign(ctx, { gv, arrays, dict, page, saves });
  return ctx;
}
const hz = (c) => c.arrays.ArrayScreenRefreshRate_Smartphone;

// 1. Calendar mapping on a fresh company: moved-later and moved-earlier rows, Original untouched.
{
  const c = context({ gv: { DayTotal: 5 } });
  c._dtRealTick();
  assert.equal(c._dtDiffRealFrom, 5, "first Realistic day is remembered");
  assert.equal(hz(c).getAt(3, 1), 4136, "90 Hz May 2019");
  assert.equal(hz(c).getAt(2, 1), 4136, "75 Hz with 90 Hz");
  assert.equal(hz(c).getAt(1, 1), -10, "first tiers stay at the start");
  assert.equal(c.arrays.ArrayROM_Smartphones.getAt(4, 1), -10, "4 GB from the start");
  assert.equal(c.arrays.ArrayROM_Smartphones.getAt(5, 1), 366, "8 GB Jan 2009");
  for (let x = 1; x < REFRESH.length; x++) assert.ok(hz(c).getAt(x, 1) >= hz(c).getAt(x - 1, 1), "rows stay in order");
  const o = context({ preset: "original", gv: { DayTotal: 5 } });
  o._dtRealTick();
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((x) => hz(o).getAt(x, 1)), REFRESH.map((r) => r[1]), "Original: shipped dates");
  assert.equal(o._dtDiffRealFrom, null);
  // Switching back to Original restores the shipped dates.
  for (const k of c._DT_DIFF_KEYS) c._dtDiffSet(k, 1);
  c._dtRealTick();
  assert.equal(hz(c).getAt(3, 1), 3043);
  assert.equal(c.arrays.ArrayROM_Smartphones.getAt(5, 1), 2108);
}

// 2. Old save: rows this company already had keep their date; later rows follow the new calendar.
{
  const c = context({ row: { v: 1, company: "Acme", buy: 1, cost: 1, research: 0.3, rivals: 1.1, build: 1 }, gv: { DayTotal: 3300 } });
  c._dtRealTick();
  assert.equal(c._dtDiffRealFrom, 3300);
  assert.equal(hz(c).getAt(3, 1), 3043, "90 Hz was out in this save: stays");
  assert.equal(hz(c).getAt(4, 1), 4440, "120 Hz was not: Mar 2020");
  c._dtDiffSave();
  assert.equal(JSON.parse(c.saves.getAt(0, 150)).real, 3300, "realFrom saved in row 150");
  // Reloading the same save later keeps the same cut-off day.
  const again = context({ row: JSON.parse(c.saves.getAt(0, 150)), gv: { DayTotal: 4000 } });
  again._dtRealTick();
  assert.equal(again._dtDiffRealFrom, 3300);
  assert.equal(hz(again).getAt(4, 1), 4440);
}

// 3. News calendar and research gate follow the new days.
{
  const c = context({ gv: { DayTotal: 1200 } });
  c._dtDiffRealFrom = 10;
  c._dtRealTick();
  assert.equal(c.dict.get("Fingerprint Back (Smartphone)"), 2829, "rear fingerprint news moves to Oct 2015");
  assert.equal(c.dict.get("ArrayScreenRefreshRate_Smartphone"), 4136, "next refresh rate row");
  assert.equal(c.gv.TimelineNextDay, 2829);
  assert.equal(c._readRows(), "NOT AVAILABLE", "rear fingerprint research waits");
  assert.equal(c.page.getAt(1, 4), 0, "researched item untouched");
  // Already unlocked in this save (-10): stays unlocked.
  const u = context({ fp: -10, gv: { DayTotal: 1200 } });
  u._dtRealTick();
  assert.equal(u.dict.get("Fingerprint Back (Smartphone)"), -10);
  const o = context({ preset: "original", gv: { DayTotal: 1200 } });
  o._dtRealTick();
  assert.equal(o._readRows(), "", "Original research page untouched");
  assert.equal(o.dict.get("Fingerprint Back (Smartphone)"), 1190);
}

// 4. Per-part price drop: storage 0.75, RAM 0.82, OLED 0.90, LCD 0.94, chips 0.90, others unchanged; floors kept.
{
  const c = context({ gv: { DayTotal: 3000 } });
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + " vs " + b);
  near(c._dtRealAge(2, "ArrayROM_Smartphones", 3), 0.75 ** 2);
  near(c._dtRealAge(2, "ArrayROMType_Smartphones", 3), 0.75 ** 2);
  near(c._dtRealAge(2, "ArrayRAM_Smartphones", 3), 0.82 ** 2);
  near(c._dtRealAge(2, "ArrayScreenTechnology_Smartphone", 4), 0.9 ** 2);
  near(c._dtRealAge(2, "ArrayScreenTechnology_Smartphone", 3), 0.94 ** 2);
  c.gv.ScreenTechnologyID = 4;
  near(c._dtRealAge(2, "ArrayScreenResolution_Smartphone", 9), 0.9 ** 2, "panel parts follow the chosen screen type");
  c.gv.ScreenTechnologyID = 1;
  near(c._dtRealAge(2, "ArrayScreenResolution_Smartphone", 9), 0.94 ** 2);
  near(c._dtRealAge(2, "ArrayScreenProtection_Smartphone", 2), 0.82 ** 2, "glass unchanged");
  near(c._dtRealAge(2, "ArrayCPUTechprocess_Smartphone", 2), 0.9 ** 2);
  near(c._dtRealAge(2, "ArrayGPUTFLOPS_Smartphone", 2), 0.9 ** 2);
  near(c._dtRealAge(2, "ArrayBattery_Smartphone", 2), 0.82 ** 2, "battery unchanged");
  near(c._dtRealAge(30, "ArrayROM_Smartphones", 2), 0.06, "floor kept");
  near(c._dtRealAge(0, "ArrayROM_Smartphones", 2), 1);
  const o = context({ preset: "original" });
  near(o._dtRealAge(2, "ArrayROM_Smartphones", 3), 0.82 ** 2, "Original: shipped drop");
}
console.log("real runtime: 4 scenarios passed");
