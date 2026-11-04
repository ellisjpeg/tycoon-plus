// Runs bulk.js with stand-ins for the game: the sheet's first charge, the game's one search
// (_dtFindOne) and the found-candidates array. Checks totals, surcharge, refunds and ×1.
const fs = require("fs");
const assert = require("assert");
const src = fs.readFileSync(__dirname + "/bulk.js", "utf8");

function world(budget, pool) {
  const temp = { width: 0, height: 1, depth: 1, cells: [], setSize(w) { this.width = w; this.cells = []; }, setAt(v, i) { this.cells[i] = v; } };
  const g = { Budget: budget, FindEmployeesCountRandom: 0, FindEmployeesCharacters: 0, EmployeesProfession: "DESIGNERS", class: "FIND EMPLOYEES", EditorNotification: "OFF" };
  const runtime = { layout: { name: "FIND EMPLOYEES" }, globalVars: g, getInstanceByUid: () => null };
  let left = pool, next = 1, calls = 0;
  const env = {
    globalThis: { runtime },
    _dtUi: { ensure: () => ({}), el: () => ({}), every: () => 0 },
    CFG: { TEMP_ARRAY: "temp" },
    _rt10: () => runtime,
    _inst13: () => temp,
    _lastReport: null,
    _dtFindOne: () => {
      calls++;
      const want = Math.max(0, Math.round(g.FindEmployeesCountRandom));
      const take = Math.min(want, left), found = [];
      for (let i = 0; i < take; i++) found.push({ id: next++ });
      const rep = { ok: true, requested: want, poolSize: left, found };
      left -= take;
      temp.setSize(found.length);
      found.forEach((f, i) => temp.setAt(f.id, i));
      g.FindEmployeesCountRandom = found.length;
      return rep;
    },
  };
  const fn = new Function(...Object.keys(env), src + "\nreturn { bulk: _dtBulk, findEmployees };");
  const out = fn(...Object.values(env));
  return { g, temp, runtime, calls: () => calls, ...out };
}
// The sheet's click: checks and takes one normal price, rolls one search, calls findEmployees.
function click(w, tier) {
  const T = [[2e5, 2, 20], [45e4, 2, 50], [65e4, 1, 77]][tier];
  if (w.g.Budget < T[0]) return null;
  w.g.Budget -= T[0];
  w.g.FindEmployeesCountRandom = T[1];
  w.g.FindEmployeesCharacters = T[2];
  return w.findEmployees(null);
}

// ×1 is the game's own search: one call, one normal price.
let w = world(1e9, 500);
click(w, 1);
assert.strictEqual(w.calls(), 1);
assert.strictEqual(w.g.Budget, 1e9 - 45e4);
assert.strictEqual(w.g.FindEmployeesCountRandom, 2);

// ×10 at Workify: ten searches, 10 × 675K in total, every candidate in the found list.
w = world(1e9, 500);
w.bulk.sel[1] = 10;
const rep = click(w, 1);
assert.strictEqual(w.calls(), 10);
assert.strictEqual(w.g.Budget, 1e9 - 6.75e6);
assert.strictEqual(rep.found.length, w.g.FindEmployeesCountRandom);
assert.strictEqual(w.temp.width, rep.found.length);
assert.ok(rep.found.length >= 10 && rep.found.length <= 20, "Workify finds 1-2 per search");
assert.deepStrictEqual(w.temp.cells, rep.found.map((f) => f.id));
assert.strictEqual(new Set(w.temp.cells).size, w.temp.cells.length, "no candidate twice");

// Every later search rolls the same agency's skill range.
w = world(1e9, 500);
w.bulk.sel[2] = 5;
click(w, 2);
assert.strictEqual(w.calls(), 5);
assert.strictEqual(w.g.Budget, 1e9 - 5 * 975e3);
assert.strictEqual(w.g.FindEmployeesCountRandom, 5);

// Pool runs out after 7 people: searches not run are paid back.
w = world(1e9, 7);
w.bulk.sel[0] = 20;
const r2 = click(w, 0);
assert.strictEqual(r2.found.length, 7);
assert.strictEqual(w.g.Budget, 1e9 - w.calls() * 3e5, "only the searches run are paid for");
assert.ok(w.calls() < 20);

// Short of money: the count drops to the biggest step that fits (5 × 300K = 1.5M of 1.6M).
w = world(1.6e6, 500);
w.bulk.sel[0] = 20;
click(w, 0);
assert.strictEqual(w.calls(), 5);
assert.strictEqual(w.g.Budget, 1.6e6 - 1.5e6);
assert.strictEqual(w.bulk.maxStep(0), 1);

// Away from the Find Employees screen findEmployees is the game's own.
w = world(1e9, 500);
w.bulk.sel[1] = 10;
w.runtime.layout.name = "GAMEPLAY";
w.g.FindEmployeesCountRandom = 2; w.g.FindEmployeesCharacters = 50;
w.findEmployees(null);
assert.strictEqual(w.calls(), 1);
assert.strictEqual(w.g.Budget, 1e9);

// Prices shown: ×1 normal, bulk at +50%.
assert.strictEqual(w.bulk.cost(0, 1), 2e5);
assert.strictEqual(w.bulk.cost(1, 10), 6.75e6);
assert.strictEqual(w.bulk.cost(2, 20), 19.5e6);

// The picker amount belongs to the job type: changing the searched profession starts every card at x1.
w = world(1e9, 500);
w.bulk.job();
w.bulk.sel[0] = 5;
w.bulk.sel[1] = 10;
w.g.EmployeesProfession = "PROGRAMMERS";
assert.strictEqual(w.bulk.job(), true, "a new job type resets the picker");
assert.deepStrictEqual(w.bulk.sel, [1, 1, 1], "every card is back at x1 after switching designers -> programmers");
w.bulk.sel[0] = 5;
assert.strictEqual(w.bulk.job(), false, "the same job type keeps the chosen amounts");
assert.deepStrictEqual(w.bulk.sel, [5, 1, 1], "x5 survives a frame that does not change the job");

console.log("bulk runtime: ok");
