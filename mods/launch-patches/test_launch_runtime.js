// Behaviour test for launch.js against a small mock of the game runtime.
// The 3-D array mock mirrors the game's array API: getAt(x, y, z) and
// setAt(value, x, y, z). _dtUi is stubbed after launch.js loads, so the test
// exercises the patch logic without needing a DOM.
// Usage: node test_launch_runtime.js <launch.js>
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const SRC = fs.readFileSync(process.argv[2], "utf8");
const eq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);

function newArray(width, height) {
  const cells = new Map();
  return {
    width,
    height,
    getAt(x, y, z) {
      const key = x + "," + y + "," + z;
      return cells.has(key) ? cells.get(key) : 0;
    },
    setAt(value, x, y, z) {
      cells.set(x + "," + y + "," + z, value);
    },
  };
}
const put = (a, x, y, z, v) => a.setAt(v, x, y, z);
const get = (a, x, y, z) => a.getAt(x, y, z);

function world(options) {
  const opts = options || {};
  const gv = Object.assign({
    Day: 28, Month: 2, Year: 2015, DayTotal: 1000, LanguageChoose: 0,
  }, opts.gv || {});
  const arrays = opts.arrays || {};
  const objects = {};
  for (const name of Object.keys(arrays)) objects[name] = { getFirstInstance: () => arrays[name] };
  const calls = { register: [], social: [], toasts: [], sales: [], chips: [], removed: [] };
  const timers = { interval: null, timeouts: [] };
  function nodeEl(tag, cls, parent, text) {
    const n = { tag, cls: cls || "", textContent: text === undefined ? "" : String(text), style: {}, children: [] };
    n.appendChild = (c) => { n.children.push(c); c.parentNode = n; return c; };
    n.listeners = {};
    n.addEventListener = (t, f) => (n.listeners[t] = f);
    Object.defineProperty(n, "innerHTML", { set() { n.children = []; }, get() { return ""; } });
    n.classList = { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c, on) { if (on === undefined ? !this._s.has(c) : on) this._s.add(c); else this._s.delete(c); } };
    n.remove = () => { const p = n.parentNode; if (p) p.children = p.children.filter((c) => c !== n); n.parentNode = null; };
    if (parent) parent.appendChild(n);
    return n;
  }
  const ctx = {
    console: { warn() {}, log() {} },
    Math, Number, String, Map, Set, JSON, Object, Array, Error, Infinity,
    setTimeout(fn, ms) {
      timers.timeouts.push({ fn, ms });
      return timers.timeouts.length;
    },
    setInterval(fn, ms) {
      timers.interval = { fn, ms };
      return 1;
    },
    clearTimeout() {},
    clearInterval() {},
    runtime: { globalVars: gv, objects, layout: { name: opts.layout || "GAMEPAGE" } },
    registerDeviceSalesForArray(arr) {
      calls.register.push(arr);
      const a = arrays[arr];
      if (!a) return;
      const today = Number(gv.DayTotal);
      for (let x = 0; x < (a.width | 0); x++) {
        for (let y = 0; y < Math.min(3, a.height | 0); y++) {
          if (a.getAt(x, y, 0) === -1) continue;
          if (Number(a.getAt(x, y, 7)) !== today) continue;
          a.setAt((Number(a.getAt(x, y, 2)) || 0) + 5, x, y, 2);
        }
      }
    },
    socialQueueDeviceReleased(rt, cat, y, x) {
      calls.social.push({ cat, y, x });
    },
  };
  // The toolbar page shell (ui.js "toolbar pages"): controls and the open page.
  ctx._dtTb = {
    pages: [], opened: [],
    add(sp) { this.pages.push(sp); },
    open(id) { this.opened.push(id); return true; },
    page() { return ""; },
    refresh() {},
    control(parent, cls, html, onClick) { const b = nodeEl("div", cls, parent); b.onClick = onClick; b.firstChild = nodeEl("span", "", b); return b; },
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  ctx._dtUi = {
    num(name, dflt) {
      const v = Number(gv[name]);
      return Number.isFinite(v) ? v : dflt;
    },
    t(entry, vars) {
      let s = Number(gv.LanguageChoose) === 1 && entry.ru ? entry.ru : entry.en;
      for (const k in vars || {}) s = s.split("{" + k + "}").join(String(vars[k]));
      return s;
    },
    el: nodeEl,
    button(parent, label, cls, onClick) {
      const b = nodeEl("button", cls, parent, label);
      b.onClick = onClick;
      return b;
    },
    onOffice() { return true; },
    layoutName() { return ctx.runtime.layout.name; },
    modal(opts) { calls.modal = opts; },
    toast(text, key, opts) { calls.toasts.push(text); if (opts && opts.sales) calls.sales.push(text); },
    chip() { calls.chips.push([...arguments]); },
    removeChip(id) { calls.removed.push(id); },
  };
  return { ctx, gv, arrays, calls, timers };
}
function flatText(n) {
  let s = String(n.textContent || "");
  for (const c of n.children || []) s += " " + flatText(c);
  return s.replace(/\s+/g, " ").trim();
}
function fakeBody() {
  return { textContent: "", style: {}, children: [], appendChild(c) { this.children.push(c); return c; } };
}

// 1. The patch calendar is 365 days: Feb 28, Apr/Jun/Sep/Nov 30, others 31,
// and it moves one day per DayTotal step in both directions.
{
  const w = world();
  const at = (day, month, year, total, target) => {
    Object.assign(w.gv, { Day: day, Month: month, Year: year, DayTotal: total });
    return w.ctx._dtLaunchDate(target);
  };
  assert.equal(at(28, 2, 2015, 1000, 1001), "01.03.2015");
  assert.equal(at(28, 2, 2015, 1000, 1000 + 365), "28.02.2016");
  // The brief's "1000-59 -> 30.12.2014" is off by one: 59 days before
  // 2015-02-28 is 2014-12-31 on this calendar; 30.12.2014 is 60 days before.
  assert.equal(at(28, 2, 2015, 1000, 1000 - 59), "31.12.2014");
  assert.equal(at(28, 2, 2015, 1000, 1000 - 60), "30.12.2014");
  assert.equal(at(30, 4, 2015, 1000, 1001), "01.05.2015");
  assert.equal(at(30, 6, 2015, 1000, 1001), "01.07.2015");
  assert.equal(at(30, 9, 2015, 1000, 1001), "01.10.2015");
  assert.equal(at(30, 11, 2015, 1000, 1001), "01.12.2015");
  assert.equal(at(31, 3, 2015, 1000, 1001), "01.04.2015");
  assert.equal(at(31, 12, 2015, 1000, 1001), "01.01.2016");
  assert.equal(at(1, 3, 2015, 1000, 999), "28.02.2015");
}

// 2. The shelf is every live row with a release day still ahead, grouped per
// array line (x), sorted by the nearest day. Rows with CREATED -1, released
// today or released in the past are not listed.
{
  const phones = newArray(2, 4);
  put(phones, 0, 0, 0, 10); put(phones, 0, 0, 7, 1005); put(phones, 0, 0, 8, "Phone A"); put(phones, 0, 0, 6, 42);
  put(phones, 0, 1, 0, 5); put(phones, 0, 1, 7, 1005); put(phones, 0, 1, 6, 50);
  put(phones, 0, 2, 0, -1); put(phones, 0, 2, 7, 1010); put(phones, 0, 2, 8, "Ghost");
  put(phones, 1, 0, 0, 8); put(phones, 1, 0, 7, 1000); put(phones, 1, 0, 8, "Today");
  put(phones, 1, 1, 0, 8); put(phones, 1, 1, 7, 1001); put(phones, 1, 1, 8, "Later");
  put(phones, 1, 2, 0, -1); put(phones, 1, 2, 7, 1001); put(phones, 1, 2, 8, "Deleted");
  const tablets = newArray(1, 3);
  put(tablets, 0, 0, 0, 4); put(tablets, 0, 0, 7, 1002); put(tablets, 0, 0, 8, "Tab");
  put(tablets, 0, 1, 0, 4); put(tablets, 0, 1, 7, 999); put(tablets, 0, 1, 8, "Past");
  const w = world({ arrays: { ArraySmartphones: phones, ArrayTablets: tablets }, gv: { DayTotal: 1000 } });
  eq(w.ctx._dtLaunchShelf(), [
    { arr: "ArraySmartphones", cat: "SMARTPHONES", x: 1, ys: [1], day: 1001, hype: 0, name: "Later" },
    { arr: "ArrayTablets", cat: "TABLETS", x: 0, ys: [0], day: 1002, hype: 0, name: "Tab" },
    { arr: "ArraySmartphones", cat: "SMARTPHONES", x: 0, ys: [0, 1], day: 1005, hype: 50, name: "Phone A" },
  ]);
}

// 3. Setting a launch day writes RELEASE (z7) and RELEASE_TEXT (z9) for the
// chosen array line and variants only.
{
  const phones = newArray(2, 3);
  put(phones, 0, 0, 0, 1); put(phones, 0, 1, 0, 1); put(phones, 1, 2, 0, 1);
  const w = world({ arrays: { ArraySmartphones: phones }, gv: { Day: 28, Month: 2, Year: 2015, DayTotal: 1000 } });
  w.ctx._dtLaunchSetDay("ArraySmartphones", 0, [0, 1], 1030);
  assert.equal(get(phones, 0, 0, 7), 1030);
  assert.equal(get(phones, 0, 1, 7), 1030);
  assert.equal(get(phones, 0, 0, 9), "30.03.2015");
  assert.equal(get(phones, 0, 1, 9), "30.03.2015");
  assert.equal(get(phones, 0, 2, 7), 0, "untouched variant");
  w.ctx._dtLaunchSetDay("ArraySmartphones", 1, [2], 1031);
  assert.equal(get(phones, 1, 2, 7), 1031);
  assert.equal(get(phones, 1, 2, 9), "31.03.2015");
  assert.equal(get(phones, 0, 2, 7), 0, "other line untouched");
}

// 4. A non-final review variant is held on the shelf: the hook returns true
// and the game's sales registration is not called yet.
{
  const w = world({ arrays: { ArraySmartphones: newArray(1, 3) } });
  assert.equal(w.ctx._dtLaunchRelease("ArraySmartphones", w.ctx.runtime, "SMARTPHONES", 0), true);
  assert.deepEqual(w.calls.register, []);
  assert.deepEqual(w.calls.social, []);
  assert.equal(w.timers.timeouts.length, 0, "no picker before the final variant");
}

// 5. CPU/GPU earnings arrays are wrapped by prepare.py but are not launch
// shelves, so the hook declines and the game releases them normally.
{
  const w = world();
  for (const arr of ["ArrayMyCPU_SmartphonesEarnings", "ArrayMyCPU_LaptopsEarnings",
    "ArrayMyCPU_ConsolesEarnings", "ArrayMyCPU_VREarnings", "ArrayMyGPU_LaptopsEarnings"]) {
    assert.equal(w.ctx._dtLaunchRelease(arr, w.ctx.runtime, "CPU", 1), false, arr + " final");
    assert.equal(w.ctx._dtLaunchRelease(arr, w.ctx.runtime, "CPU", 0), false, arr + " non-final");
  }
  assert.deepEqual(w.calls.register, []);
  assert.deepEqual(w.calls.social, []);
}

// 6. A launch due on the day a save finishes loading still runs once, on the
// first office tick, instead of being lost between LOADING GAME and the day loop.
{
  const phones = newArray(1, 3);
  put(phones, 0, 0, 0, 8); put(phones, 0, 0, 7, 1010); put(phones, 0, 0, 8, "Load Due"); put(phones, 0, 0, 2, 10);
  const w = world({ arrays: { ArraySmartphones: phones }, gv: { DayTotal: 1010 }, layout: "LOADING GAME" });
  w.ctx._dtLaunchTick();
  assert.deepEqual(w.calls.register, [], "nothing launches while loading");
  assert.deepEqual(w.calls.social, []);
  w.ctx.runtime.layout.name = "GAMEPAGE";
  w.ctx._dtLaunchTick();
  eq(w.calls.register, ["ArraySmartphones"]);
  eq(w.calls.social, [{ cat: "SMARTPHONES", y: 0, x: 0 }]);
  assert.equal(w.calls.toasts.length, 1);
  assert.match(w.calls.toasts[0], /Load Due/);
  assert.equal(get(phones, 0, 0, 2), 15, "launch pop applied");
  w.ctx._dtLaunchTick();
  assert.equal(w.calls.register.length, 1, "a due launch runs only once");
}

// 7. Launching from line x=1 passes that line to the game's social helper, so
// the waiting device is announced instead of line 0's newer model.
{
  const phones = newArray(2, 3);
  put(phones, 0, 0, 0, 1); put(phones, 0, 0, 7, 1000); put(phones, 0, 0, 8, "Ember 8");
  put(phones, 1, 0, 0, 1); put(phones, 1, 0, 7, 1001); put(phones, 1, 0, 8, "Ember 6"); put(phones, 1, 0, 2, 20);
  const w = world({ arrays: { ArraySmartphones: phones }, gv: { DayTotal: 1000 } });
  w.ctx._dtLaunchNow("ArraySmartphones", "SMARTPHONES", 1, [0], "Ember 6");
  eq(w.calls.social, [{ cat: "SMARTPHONES", y: 0, x: 1 }]);
  assert.equal(get(phones, 1, 0, 7), 1000);
}

// 8. The scheduled path runs on its own: crossing a day boundary reaches the
// due row through _dtLaunchTick, registering sales, social and the launch pop.
{
  const phones = newArray(1, 3);
  put(phones, 0, 0, 0, 8); put(phones, 0, 0, 7, 1001); put(phones, 0, 0, 8, "Tomorrow"); put(phones, 0, 0, 2, 10);
  const w = world({ arrays: { ArraySmartphones: phones }, gv: { DayTotal: 1000 } });
  w.ctx._dtLaunchTick();
  assert.deepEqual(w.calls.register, [], "not before its day");
  w.gv.DayTotal = 1001;
  w.ctx._dtLaunchTick();
  eq(w.calls.register, ["ArraySmartphones"]);
  eq(w.calls.social, [{ cat: "SMARTPHONES", y: 0, x: 0 }]);
  assert.equal(w.calls.toasts.length, 1);
  assert.match(w.calls.toasts[0], /Tomorrow/);
  assert.equal(get(phones, 0, 0, 2), 15, "launch pop applied on the due day");
}

// 8b. A multi-variant device due on the same day is named (and announced) by its base variant.
{
  const phones = newArray(1, 3);
  for (const [y, n] of [[0, "Ember 7"], [1, "Ember 7 Pro"]]) { put(phones, 0, y, 0, 8); put(phones, 0, y, 7, 1001); put(phones, 0, y, 8, n); }
  put(phones, 0, 2, 0, -1);
  const w = world({ arrays: { ArraySmartphones: phones }, gv: { DayTotal: 1000 } });
  w.ctx._dtLaunchTick();
  w.gv.DayTotal = 1001;
  w.ctx._dtLaunchTick();
  eq(w.calls.social, [{ cat: "SMARTPHONES", y: 0, x: 0 }]);
  assert.equal(w.calls.toasts.length, 1);
  assert.match(w.calls.toasts[0], /Ember 7(?! Pro)/);
}

// 9. The final review opens the launch picker after the game's 700 ms hand-back,
// not at once; Plan writes a future RELEASE and does not release early.
{
  const phones = newArray(1, 3);
  put(phones, 0, 0, 0, 8); put(phones, 0, 0, 7, 1000); put(phones, 0, 0, 8, "Final");
  const w = world({ arrays: { ArraySmartphones: phones }, gv: { DayTotal: 1000 } });
  assert.equal(w.ctx._dtLaunchRelease("ArraySmartphones", w.ctx.runtime, "SMARTPHONES", 1), true);
  assert.equal(w.timers.timeouts.length, 1);
  assert.equal(w.timers.timeouts[0].ms, 700);
  assert.equal(w.calls.modal, undefined, "picker waits for the review screen");
  assert.deepEqual(w.calls.register, []);
  w.timers.timeouts[0].fn();
  assert.ok(w.calls.modal, "picker opened");
  assert.equal(w.calls.modal.title, "Launch day");
  const plan = w.calls.modal.buttons.find((b) => b.label === "Plan launch");
  assert.ok(plan, "Plan launch button");
  plan.onClick();
  assert.equal(get(phones, 0, 0, 7), 1014);
  assert.equal(get(phones, 0, 0, 9), "14.03.2015");
  assert.match(w.calls.toasts[0], /launches on 14\.03\.2015/);
  assert.deepEqual(w.calls.sales, [], "a plan confirmation stays in the news stack");
  assert.deepEqual(w.calls.register, [], "Plan does not release early");
}

// 10. The picker's other choice releases today through the normal launch path.
{
  const phones = newArray(1, 3);
  put(phones, 0, 0, 0, 8); put(phones, 0, 0, 7, 1000); put(phones, 0, 0, 8, "Final");
  const w = world({ arrays: { ArraySmartphones: phones }, gv: { DayTotal: 1000 } });
  w.ctx._dtLaunchRelease("ArraySmartphones", w.ctx.runtime, "SMARTPHONES", 1);
  w.timers.timeouts[0].fn();
  const today = w.calls.modal.buttons.find((b) => b.label === "Launch today");
  assert.ok(today, "Launch today button");
  today.onClick();
  assert.equal(get(phones, 0, 0, 7), 1000);
  eq(w.calls.register, ["ArraySmartphones"]);
  eq(w.calls.social, [{ cat: "SMARTPHONES", y: 0, x: 0 }]);
  assert.match(w.calls.toasts[0], /on sale from today/);
  assert.deepEqual(w.calls.sales, w.calls.toasts, "the launch goes under the sales card with the game's sales messages");
}

// 11. English says "in 1 day" for a launch tomorrow, in the picker and shelf.
{
  const phones = newArray(1, 3);
  put(phones, 0, 0, 0, 8); put(phones, 0, 0, 7, 1001); put(phones, 0, 0, 8, "Next"); put(phones, 0, 0, 6, 42);
  const w = world({ arrays: { ArraySmartphones: phones }, gv: { DayTotal: 1000 } });
  let chosen = 1001;
  const picker = fakeBody();
  w.ctx._dtLaunchPicker(picker, "", () => chosen, (d) => (chosen = d));
  const pickerText = flatText(picker);
  assert.match(pickerText, /in 1 day/);
  assert.doesNotMatch(pickerText, /in 1 days/);
  assert.equal(w.ctx._dtLaunchIn(21), "in 21 days");
  // The shelf is the Launches page now: the toolbar button opens it, and its
  // rows carry the date, the days left and the hype.
  assert.equal(w.ctx._dtTb.pages[0].id, "launch");
  assert.equal(w.ctx._dtTb.pages[0].layout, "RATINGS");
  w.ctx._dtLaunchOpenShelf();
  assert.deepEqual(w.ctx._dtTb.opened, ["launch"]);
  const shelf = fakeBody();
  w.ctx._dtTb.pages[0].build(shelf);
  const shelfText = flatText(shelf);
  assert.match(shelfText, /Next .*hype 42.*01\.03\.2015 .*in 1 day.*Change/);
  assert.doesNotMatch(shelfText, /in 1 days/);
}

// 12. Russian runtime case: the game's own hype term and day/dnya/dney plurals.
{
  const phones = newArray(1, 3);
  put(phones, 0, 0, 0, 8); put(phones, 0, 0, 7, 1001); put(phones, 0, 0, 8, "Next"); put(phones, 0, 0, 6, 42);
  const w = world({ arrays: { ArraySmartphones: phones }, gv: { DayTotal: 1000, LanguageChoose: 1 } });
  assert.equal(w.ctx._dtLaunchIn(1), "через 1 день");
  assert.equal(w.ctx._dtLaunchIn(2), "через 2 дня");
  assert.equal(w.ctx._dtLaunchIn(4), "через 4 дня");
  assert.equal(w.ctx._dtLaunchIn(5), "через 5 дней");
  assert.equal(w.ctx._dtLaunchIn(11), "через 11 дней");
  assert.equal(w.ctx._dtLaunchIn(21), "через 21 день");
  let chosen = 1001;
  const picker = fakeBody();
  w.ctx._dtLaunchPicker(picker, "", () => chosen, (d) => (chosen = d));
  const pickerText = flatText(picker);
  assert.match(pickerText, /через 1 день/);
  // The launch question names hype with the game's own term.
  const ask = w.ctx._dtUi.t(w.ctx._DT_LAUNCH_TEXT.ask, { n: "Next" });
  assert.match(ask, /ажиотаж/);
  assert.doesNotMatch(ask, /интерес/);
  const shelf = fakeBody();
  w.ctx._dtTb.pages[0].build(shelf);
  const shelfText = flatText(shelf);
  assert.match(shelfText, /ажиотаж 42/);
  assert.match(shelfText, /через 1 день/);
  assert.doesNotMatch(shelfText, /Интерес/);
}

// 13. A corrupt far-future RELEASE formats in constant time instead of hanging.
{
  const w = world({ gv: { Day: 28, Month: 2, Year: 2015, DayTotal: 1000 } });
  assert.equal(w.ctx._dtLaunchDate(1000 + 365 * 1000000), "28.02.1002015");
  assert.equal(w.ctx._dtLaunchDate(Infinity), "---");
}

// 14. The game's bankruptcy countdown waits while a finished device is on the shelf.
{
  const phones = newArray(1, 3);
  put(phones, 0, 0, 0, 8); put(phones, 0, 0, 7, 1010); put(phones, 0, 0, 8, "Next");
  const w = world({ arrays: { ArraySmartphones: phones }, gv: { DayTotal: 1000 } });
  let counted = 0;
  w.ctx.tickBankruptcyDay = function () { counted++; return true; };
  w.ctx._dtLaunchTick();
  const guarded = w.ctx.tickBankruptcyDay;
  assert.equal(guarded._dtLaunch, true);
  assert.equal(guarded(), false);
  assert.equal(counted, 0);
  w.ctx._dtLaunchTick();
  assert.equal(w.ctx.tickBankruptcyDay, guarded, "wrapper is installed once");
  put(phones, 0, 0, 7, 1000); // launched today: no sales counted yet, still waits
  assert.equal(guarded(), false);
  put(phones, 0, 0, 7, 994); // six days on sale: still its first week
  assert.equal(guarded(), false);
  assert.equal(counted, 0);
  put(phones, 0, 0, 7, 993); // a full week on sale: the game counts again
  assert.equal(w.ctx.tickBankruptcyDay(), true);
  assert.equal(counted, 1);
  put(phones, 0, 0, 7, -1); // still being made: left to the game's own check
  assert.equal(guarded(), true);
}

// 15. Only a launch due within 30 days holds off the countdown.
{
  const phones = newArray(1, 3);
  put(phones, 0, 0, 0, 8); put(phones, 0, 0, 7, 1060); put(phones, 0, 0, 8, "Next");
  const w = world({ arrays: { ArraySmartphones: phones }, gv: { DayTotal: 1000 } });
  let counted = 0;
  w.ctx.tickBankruptcyDay = function () { counted++; return true; };
  w.ctx._dtLaunchTick();
  const guarded = w.ctx.tickBankruptcyDay;
  assert.equal(guarded(), true, "planned 60 days out: the game counts");
  assert.equal(counted, 1);
  put(phones, 0, 0, 7, 1031); // 31 days out: still too far
  assert.equal(guarded(), true);
  put(phones, 0, 0, 7, 1030); // 30 days out: waits
  assert.equal(guarded(), false);
  put(phones, 0, 0, 7, 1020); // 20 days out: waits
  assert.equal(guarded(), false);
  assert.equal(counted, 2);
}

console.log("launch runtime: 15 scenarios passed");
