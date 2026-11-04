// Behaviour test for queue.js against a small mock of the game runtime.
// The mock mirrors what the queue touches: global vars, layout changes and
// the layout-start events, ArraySaves row 151, the device and editor arrays.
// Usage: node test_queue_runtime.js <reads.js + queue.js>
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

class Arr {
  constructor(w, h, d, fill = 0) {
    this.setSize(w, h, d);
    this.cells.fill(fill);
  }
  setSize(w, h, d) {
    const old = this.cells, ow = this.width, oh = this.height, od = this.depth;
    this.width = w; this.height = h; this.depth = d;
    this.cells = new Array(w * h * d).fill(0);
    if (old) for (let x = 0; x < Math.min(w, ow); x++) for (let y = 0; y < Math.min(h, oh); y++) for (let z = 0; z < Math.min(d, od); z++) this.cells[(x * h + y) * d + z] = old[(x * oh + y) * od + z];
  }
  getAt(x, y, z) { return x < this.width && y < this.height && z < this.depth ? this.cells[(x * this.height + y) * this.depth + z] : 0; }
  setAt(v, x, y, z) { if (x < this.width && y < this.height && z < this.depth) this.cells[(x * this.height + y) * this.depth + z] = v; }
  getSize() { return [this.width, this.height, this.depth]; }
}

const DEVICES = {
  SMARTPHONE: { en: "Smartphone", ru: "Смартфон", pageClass: "SMARTPHONE PAGE 1", nameClass: "SMARTPHONE NAME" },
  LAPTOP: { en: "Laptop", ru: "Ноутбук", pageClass: "LAPTOP PAGE 1", nameClass: "LAPTOP NAME" },
  TABLET: { en: "Tablet", ru: "Планшет", pageClass: "TABLET PAGE 1", nameClass: "TABLET NAME" },
  WATCHES: { en: "Smartwatch", ru: "Смарт-часы", pageClass: "WATCHES PAGE 1", nameClass: "WATCHES NAME" },
  HEADPHONES: { en: "Headphones", ru: "Наушники", pageClass: "HEADPHONES PAGE 1", nameClass: "HEADPHONES NAME" },
  TV: { en: "TV", ru: "Телевизор", pageClass: "TV PAGE 1", nameClass: "TV NAME" },
  SCOOTER: { en: "Scooter", ru: "Самокат", pageClass: "SCOOTER PAGE 1", nameClass: "SCOOTER NAME" },
  KEYBOARD: { en: "Keyboard", ru: "Клавиатура", pageClass: "KEYBOARD PAGE 1", nameClass: "KEYBOARD NAME" },
  CONSOLE: { en: "Console", ru: "Консоль", pageClass: "CONSOLE PAGE 1", nameClass: "CONSOLE NAME" },
  VR: { en: "VR", ru: "VR", pageClass: "VR PAGE 1", nameClass: "VR NAME" },
};
const SOURCE = fs.readFileSync(process.argv[2], "utf8");

// Device A (a laptop) is in development in the designer office.
function busyGv(extra) {
  return Object.assign({
    SaveSlot: 0, CompanyName: "Acme", Budget: 5e6, DayTotal: 3000, Year: 2016,
    DeviceType: "LAPTOP", DeviceName: "Book 4", DevicesCount: 1, DeviceCountCreatingNow: 1,
    DevicePrice: 1200, DeviceCostPrice: 800, ScreenResolutionID: 2, BatteryID: 3,
    DeviceTypeCreatingNow: "LAPTOPS", OfficeType: "DESIGNER", class: "GAMEPLAY", LastClass: "LOADING EDITOR",
    Assistant: "OFF", CreateDevicesUI: "OFF", GameplayPause: 0, BubblesDesign: 37, LoadingType: "",
  }, extra || {});
}

function world(opts) {
  opts = opts || {};
  const gv = opts.gv || busyGv();
  const layout = { name: opts.layout || "DESIGNER OFFICE" };
  const saves = opts.saves || new Arr(3, 200, 1);
  const arrays = {
    ArrayMyResearch: { getAt: (x) => (opts.research && opts.research[x] !== undefined ? opts.research[x] : 10) },
    ArraySmartphones: new Arr(2, 3, 120),
    ArrayLaptops: new Arr(3, 3, 120),
    ArrayEditorDesign_Smartphone: new Arr(2, 1, 1, "a-design"),
  };
  const calls = { layouts: [], toasts: [], marks: 0, chips: [], functions: [] };
  const handlers = {};
  const timers = [];
  const rt = {
    globalVars: gv,
    layout,
    objects: { ArraySaves: { getFirstInstance: () => saves } },
    goToLayout(name) { calls.layouts.push(name); layout.name = name; },
    addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
    callFunction(name) { calls.functions.push(name); },
  };
  // The centre create button (Sprite12 UID 7345) at 900..1020 x 940..1060.
  rt.objects.Sprite12 = { getAllInstances: () => [{ uid: 7345, isVisible: true,
    layer: { isVisible: true, cssPxToLayer: (x, y) => [x, y] },
    containsPoint: (x, y) => x >= 900 && x <= 1020 && y >= 940 && y <= 1060 }] };
  return { gv, layout, saves, arrays, calls, rt, handlers, timers, batchWidth: null };
}

function context(w) {
  const ui = {
    num(n, d) { const v = Number(w.gv[n]); return Number.isFinite(v) ? v : d; },
    gv(n, d) { const v = w.gv[n]; return v === undefined || v === null ? d : v; },
    layoutName() { return String(w.layout.name || ""); },
    onOffice() { return / OFFICE( \d+)?$/.test(w.layout.name) || w.layout.name === "GAMEPLAY"; },
    ru() { return false; },
    t(e, vars) { let s = e.en; for (const k in vars || {}) s = s.split("{" + k + "}").join(String(vars[k])); return s; },
    toast(s) { w.calls.toasts.push(String(s)); },
    chip(id, order, label, badge) { w.calls.chips.push(badge); },
    modal() {}, el() {}, button() {}, removeChip() {}, close() {}, isOpen() { return false; },
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setInterval() { return 0; },
    setTimeout(fn) { w.timers.push(fn); return w.timers.length; },
    clearTimeout() {},
    Date, Math, Number, String, Object, Array, JSON, Error, Infinity, NaN,
    runtime: w.rt,
    _dtUi: ui,
    _DEVICES: DEVICES,
    _getArray24(name) { return w.arrays[name] || null; },
    _arrSize3(a) { return a.getSize(); },
    _markBatchStart() { w.calls.marks++; w.batchWidth = w.arrays.ArraySmartphones.width; },
    _batchPushed() { return w.batchWidth !== null && w.arrays.ArraySmartphones.width > w.batchWidth; },
  };
  ctx.getCampaignStart = () => ({ year: 2008, day: 1, known: true });
  vm.createContext(ctx);
  vm.runInContext(SOURCE, ctx, { filename: process.argv[2] });
  return ctx;
}
const api = (c) => c._dtQueueApi;
function flush(w) {
  while (w.timers.length) w.timers.shift()();
}
function enter(w, c, name, onStart) {
  // The game's GoToLayout: before-start listeners, then OnLayoutStart, then after-start.
  w.layout.name = name;
  for (const fn of w.handlers.beforeanylayoutstart || []) fn({ layout: { name } });
  if (onStart) onStart();
  for (const fn of w.handlers.afteranylayoutstart || []) fn({ layout: { name } });
}
function ticks(c, n) {
  for (let i = 0; i < n; i++) api(c).tick();
}
// The player creates a 2-variant smartphone "Nova 1" / "Nova 2" while busy.
function createWhileBusy(w, c, opts) {
  opts = opts || {};
  ticks(c, 1); // office snapshot while busy
  w.gv.CreateDevicesUI = "OFF"; // tile click: CreateDevices_OFF, type, then NAME
  w.gv.DeviceType = "SMARTPHONE";
  w.gv.LastClass = "GAMEPLAY";
  w.gv.class = "SMARTPHONE NAME";
  enter(w, c, "SMARTPHONE NAME");
  assert.equal(api(c).capturing(), true, "busy create is captured");
  const count = opts.count || 2;
  for (let k = 1; k <= count; k++) {
    if (k > 1) {
      w.gv.DeviceCountCreatingNow = k; // NAME bootstrap after LOADING EDITOR
      enter(w, c, "SMARTPHONE NAME");
    }
    Object.assign(w.gv, { DevicesCount: count, DeviceCountCreatingNow: k, DeviceName: "Nova " + k,
      DevicePrice: 900 + k, DeviceCostPrice: 500 + k, ScreenResolutionID: 10 + k, BatteryID: 20 + k });
    w.arrays.ArrayEditorDesign_Smartphone.setSize(3, 1, 1);
    w.arrays.ArrayEditorDesign_Smartphone.setAt("b-design-" + k, 0, 0, 0);
    if (opts.abandon) return;
    w.gv.LastClass = "EDITOR PRICE PAGE";
    w.gv.class = "LOADING EDITOR";
    enter(w, c, "LOADING EDITOR");
    assert.equal(w.gv.DeviceType, "", "no AddToArray branch matches during a capture");
    flush(w);
  }
}

// 1. Empty defaults and row number.
{
  const w = world(), c = context(w);
  assert.equal(api(c).row, 151);
  assert.deepEqual(api(c).state(), { v: 3, company: "Acme", start: "2008:1", paused: false, items: [] });
}

// 2. Create while busy: stored, nothing created, A untouched, back in the office.
{
  const w = world(), c = context(w);
  const before = JSON.stringify(w.gv);
  createWhileBusy(w, c);
  assert.equal(api(c).capturing(), false);
  assert.deepEqual(w.calls.layouts, ["SMARTPHONE NAME", "DESIGNER OFFICE"], "variant loop, then the office");
  assert.equal(w.arrays.ArraySmartphones.width, 2, "no device row was pushed");
  assert.equal(w.gv.Budget, 5e6, "nothing charged");
  const after = JSON.parse(JSON.stringify(w.gv));
  const exp = JSON.parse(before);
  exp.class = "GAMEPLAY";
  exp.LastClass = "LOADING EDITOR";
  assert.deepEqual(after, exp, "every global back as device A left it");
  assert.equal(w.arrays.ArrayEditorDesign_Smartphone.width, 2);
  assert.equal(w.arrays.ArrayEditorDesign_Smartphone.getAt(0, 0, 0), "a-design", "editor array restored");
  flush(w);
  assert.deepEqual(w.calls.toasts, ["Added to build queue (1)"]);
  const st = api(c).state();
  assert.equal(st.items.length, 1);
  const it = st.items[0];
  assert.equal(it.type, "SMARTPHONE");
  assert.equal(it.count, 2);
  assert.deepEqual(it.names, ["Nova 1", "Nova 2"]);
  assert.equal(it.variants[1].vars.ScreenResolutionID, 12);
  assert.equal(it.variants[0].vars.DevicePrice, 901);
  assert.equal(it.variants[0].arrays.ArrayEditorDesign_Smartphone.cells[0], "b-design-1");
  const saved = JSON.parse(w.saves.getAt(0, 151, 0));
  assert.equal(saved.v, 3);
  assert.equal(saved.items.length, 1);
  assert.equal(w.saves.getAt(0, 150, 0), 0, "difficulty's row is untouched");
  // A second one shows n = 2.
  createWhileBusy(w, c, { count: 1 });
  flush(w);
  assert.equal(w.calls.toasts[1], "Added to build queue (2)");
}

// 3. Backing out of a busy create restores everything and queues nothing.
{
  const w = world(), c = context(w);
  const before = JSON.stringify(w.gv);
  createWhileBusy(w, c, { abandon: true });
  w.gv.class = "GAMEPLAY";
  enter(w, c, "DESIGNER OFFICE");
  assert.equal(api(c).capturing(), false);
  assert.deepEqual(JSON.parse(JSON.stringify(w.gv)), JSON.parse(before));
  assert.equal(api(c).state().items.length, 0);
}

// 4. A normal create (nothing in development) is not touched.
{
  const w = world({ gv: busyGv({ DeviceTypeCreatingNow: "", OfficeType: "BOSS" }), layout: "BOSS OFFICE" }), c = context(w);
  ticks(c, 1);
  w.gv.DeviceType = "SMARTPHONE";
  w.gv.LastClass = "GAMEPLAY";
  enter(w, c, "SMARTPHONE NAME");
  assert.equal(api(c).capturing(), false);
  w.gv.LastClass = "EDITOR PRICE PAGE";
  enter(w, c, "LOADING EDITOR");
  assert.equal(w.gv.DeviceType, "SMARTPHONE", "the game's own AddToArray runs");
}

// 5. Replay when A is finished: the game's LOADING EDITOR with the stored values.
{
  const w = world(), c = context(w);
  createWhileBusy(w, c);
  flush(w);
  // A finishes: reviews done, back in the boss office.
  Object.assign(w.gv, { DeviceTypeCreatingNow: "", OfficeType: "BOSS", class: "GAMEPLAY" });
  w.layout.name = "BOSS OFFICE";
  w.calls.layouts.length = 0;
  ticks(c, 5);
  assert.deepEqual(w.calls.layouts, ["LOADING EDITOR"], "started with no click");
  assert.equal(w.calls.marks, 1);
  assert.equal(w.gv.DeviceType, "SMARTPHONE");
  assert.equal(w.gv.DeviceName, "Nova 1");
  assert.equal(w.gv.DevicesCount, 2);
  assert.equal(w.gv.DeviceCountCreatingNow, 1);
  assert.equal(w.gv.ScreenResolutionID, 11);
  assert.equal(w.gv.DevicePrice, 901);
  assert.equal(w.gv.class, "LOADING EDITOR");
  assert.equal(w.gv.LastClass, "EDITOR PRICE PAGE");
  assert.equal(w.arrays.ArrayEditorDesign_Smartphone.getAt(0, 0, 0), "b-design-1");
  enter(w, c, "LOADING EDITOR");
  assert.equal(w.gv.DeviceType, "SMARTPHONE", "replay is not captured");
  // The game: AddToArray pushes, _Finish, then loops to NAME (bootstrap +1).
  w.arrays.ArraySmartphones.setSize(3, 3, 120);
  w.gv.DeviceTypeCreatingNow = "SMARTPHONES";
  w.gv.LastClass = "LOADING EDITOR";
  w.gv.DeviceCountCreatingNow = 2;
  enter(w, c, "SMARTPHONE NAME");
  flush(w);
  assert.equal(w.calls.layouts.at(-1), "LOADING EDITOR");
  assert.equal(w.gv.DeviceName, "Nova 2");
  assert.equal(w.gv.DeviceCountCreatingNow, 2);
  assert.equal(w.gv.ScreenResolutionID, 12);
  assert.equal(w.arrays.ArrayEditorDesign_Smartphone.getAt(0, 0, 0), "b-design-2");
  enter(w, c, "LOADING EDITOR");
  // Last variant: _Finish sends the studio to the designers.
  w.gv.OfficeType = "DESIGNER";
  w.gv.class = "GAMEPLAY";
  enter(w, c, "DESIGNER OFFICE");
  assert.equal(api(c).state().items.length, 0, "entry dropped once the device exists");
  assert.equal(w.calls.toasts.at(-1), "Nova 1 started from the build queue.");
  assert.equal(api(c).replaying(), "");
}

// 6. Replay that creates nothing keeps the entry.
{
  const w = world(), c = context(w);
  createWhileBusy(w, c, { count: 1 });
  flush(w);
  Object.assign(w.gv, { DeviceTypeCreatingNow: "", OfficeType: "BOSS", class: "GAMEPLAY" });
  w.layout.name = "BOSS OFFICE";
  ticks(c, 5);
  enter(w, c, "LOADING EDITOR");
  w.gv.class = "GAMEPLAY";
  enter(w, c, "BOSS OFFICE");
  assert.equal(api(c).state().items.length, 1, "kept");
}

// 7. Locked type: skip toast once, entry stays; pause blocks; remove/move.
{
  const w = world(), c = context(w);
  createWhileBusy(w, c, { count: 1 });
  flush(w);
  w.gv.DeviceType = "VR";
  w.gv.LastClass = "GAMEPLAY";
  enter(w, c, "VR NAME");
  w.gv.DevicesCount = 1;
  w.gv.DeviceName = "Visor 1";
  enter(w, c, "LOADING EDITOR");
  flush(w);
  let st = api(c).state();
  assert.equal(st.items.length, 2);
  const [phone, vr] = st.items;
  assert.equal(api(c).move(vr.id, -1), true);
  assert.equal(api(c).state().items[0].id, vr.id, "moved up");
  Object.assign(w.gv, { DeviceTypeCreatingNow: "", OfficeType: "BOSS", class: "GAMEPLAY", DayTotal: 1000 });
  w.layout.name = "BOSS OFFICE";
  w.calls.layouts.length = 0;
  w.calls.toasts.length = 0;
  ticks(c, 8);
  assert.deepEqual(w.calls.layouts, [], "locked head does not start");
  assert.equal(w.calls.toasts.length, 1, "one skip toast");
  assert.match(w.calls.toasts[0], /Visor 1 cannot start, not unlocked yet/);
  assert.equal(api(c).state().items.length, 2, "locked entry stays");
  assert.equal(api(c).why(vr.id), "type");
  api(c).pause(true);
  assert.equal(api(c).state().paused, true);
  assert.equal(api(c).move(phone.id, -1), true);
  api(c).arm();
  ticks(c, 8);
  assert.deepEqual(w.calls.layouts, [], "paused: nothing starts");
  api(c).pause(false);
  ticks(c, 8);
  assert.deepEqual(w.calls.layouts, ["LOADING EDITOR"], "resume starts the unlocked head");
  assert.equal(api(c).remove(vr.id), true);
}

// 8. Save rules: reload, other company, round 2 entries dropped cleanly, NEW GAME.
{
  const w = world(), c = context(w);
  createWhileBusy(w, c, { count: 1 });
  flush(w);
  const c2 = context(w);
  assert.equal(api(c2).state().items.length, 1, "reload keeps the entry");
  w.gv.CompanyName = "Other";
  assert.equal(api(c2).state().items.length, 0, "another company does not inherit it");
  w.gv.CompanyName = "Acme";

  const old = world();
  old.saves.setAt(JSON.stringify({ v: 1, company: "Acme", start: "2008:1", paused: true,
    items: [{ id: "x", type: "SMARTPHONE", count: 1, name: "Ember 9", template: "Ember 8" }] }), 0, 151, 0);
  const c3 = context(old);
  const st = api(c3).state();
  assert.equal(st.items.length, 0, "form-made entries are dropped");
  assert.equal(st.paused, true);
  assert.equal(JSON.parse(old.saves.getAt(0, 151, 0)).v, 3, "row rewritten in the new format");
  assert.equal(old.calls.toasts.length, 1);

  const bad = world();
  bad.saves.setAt("{not json", 0, 151, 0);
  assert.equal(api(context(bad)).state().items.length, 0, "unreadable row is an empty queue");

  const tiny = world({ saves: new Arr(3, 100, 1) });
  const c4 = context(tiny);
  createWhileBusy(tiny, c4, { count: 1 });
  assert.equal(tiny.saves.getAt(0, 151, 0), 0, "no row: nothing written");

  w.layout.name = "LOADING GAME";
  w.gv.LoadingType = "NEW GAME";
  api(c2).tick();
  assert.equal(w.saves.getAt(0, 151, 0), "", "NEW GAME clears the row");
}

// 9. The centre button opens the game's picker in the boss office while a stage runs.
{
  const w = world(), c = context(w);
  ticks(c, 1);
  const press = (x, y) => { for (const fn of w.handlers.pointerdown || []) fn({ clientX: x, clientY: y }); flush(w); };
  press(100, 100);
  assert.deepEqual(w.calls.functions, [], "outside the button");
  w.gv.BubblesDesign = 0;
  press(960, 1000);
  assert.deepEqual(w.calls.functions, [], "stage done: the button is the game's next-stage button");
  w.gv.BubblesDesign = 10;
  press(960, 1000);
  assert.deepEqual(w.calls.layouts, ["BOSS OFFICE"], "to the boss office, where the type tiles live");
  enter(w, c, "BOSS OFFICE");
  flush(w);
  assert.deepEqual(w.calls.functions, ["Tap_Main", "CreateDevices_ON"], "picker opens");
  assert.equal(w.gv.OfficeType, "DESIGNER", "work office state untouched");
  w.gv.CreateDevicesUI = "ON";
  ticks(c, 2);
  press(960, 1000);
  assert.deepEqual(w.calls.functions.slice(2), ["Tap_Main", "CreateDevices_OFF"], "second press closes it");
  assert.equal(w.calls.layouts.at(-1), "DESIGNER OFFICE", "and goes back");
  // Open again and pick a type: the capture returns to the work office.
  w.layout.name = "DESIGNER OFFICE";
  Object.assign(w.gv, { CreateDevicesUI: "OFF", class: "GAMEPLAY" });
  ticks(c, 1);
  press(960, 1000);
  enter(w, c, "BOSS OFFICE");
  flush(w);
  w.gv.CreateDevicesUI = "OFF";
  w.gv.DeviceType = "SMARTPHONE";
  w.gv.class = "SMARTPHONE NAME";
  enter(w, c, "SMARTPHONE NAME");
  assert.equal(api(c).capturing(), true);
  Object.assign(w.gv, { DevicesCount: 1, DeviceName: "Pick 1", LastClass: "EDITOR PRICE PAGE" });
  enter(w, c, "LOADING EDITOR");
  flush(w);
  assert.equal(w.calls.layouts.at(-1), "DESIGNER OFFICE");
  assert.equal(w.gv.OfficeType, "DESIGNER");
  assert.equal(api(c).state().items.length, 1);
  // Boss office / nothing in development: no hook.
  w.calls.functions.length = 0;
  w.calls.layouts.length = 0;
  Object.assign(w.gv, { OfficeType: "BOSS" });
  press(960, 1000);
  Object.assign(w.gv, { OfficeType: "DESIGNER", DeviceTypeCreatingNow: "" });
  press(960, 1000);
  assert.deepEqual(w.calls.layouts, []);
}

// 10. Backing out after the picker in the boss office returns to the work office.
{
  const w = world(), c = context(w);
  ticks(c, 1);
  const press = (x, y) => { for (const fn of w.handlers.pointerdown || []) fn({ clientX: x, clientY: y }); flush(w); };
  press(960, 1000);
  enter(w, c, "BOSS OFFICE");
  flush(w);
  w.gv.DeviceType = "SMARTPHONE";
  enter(w, c, "SMARTPHONE NAME");
  w.gv.DeviceName = "Gone";
  enter(w, c, "BOSS OFFICE");
  flush(w);
  assert.equal(api(c).capturing(), false);
  assert.equal(w.calls.layouts.at(-1), "DESIGNER OFFICE");
  assert.equal(w.gv.DeviceName, "Book 4");
  assert.equal(api(c).state().items.length, 0);
}

// 10b. The same centre spot is the game's next-stage button once a stage is
// used up. The game's own click (276:2862) may run before the queue's
// pointerdown and already show the next stage with fresh work: the picker
// must not open then (it left the device stuck between offices).
{
  const w = world(), c = context(w);
  Object.assign(w.gv, { BubblesDesign: 0, BubblesTechnology: 30, BubblesBugs: 30 });
  ticks(c, 1);
  w.calls.functions.length = 0;
  w.calls.layouts.length = 0;
  w.gv.OfficeType = "PROGRAMMER"; // the game handled the click first
  for (const fn of w.handlers.pointerdown || []) fn({ clientX: 960, clientY: 1000 });
  flush(w);
  assert.deepEqual(w.calls.layouts, [], "next-stage click: no picker");
  assert.ok(!w.calls.functions.includes("Tap_Main"));
  // Next tick in the new stage: the button is the create button again.
  ticks(c, 1);
  for (const fn of w.handlers.pointerdown || []) fn({ clientX: 960, clientY: 1000 });
  flush(w);
  assert.deepEqual(w.calls.layouts, ["BOSS OFFICE"], "create button works in the new stage");
}

// 11. The software tile in the busy picker is still turned back (it would start a second development).
{
  const w = world(), c = context(w);
  ticks(c, 1);
  for (const fn of w.handlers.pointerdown || []) fn({ clientX: 960, clientY: 1000 });
  flush(w);
  enter(w, c, "BOSS OFFICE");
  flush(w);
  Object.assign(w.gv, { CreateDevicesUI: "OFF", class: "MY SOFT MENU", LastClass: "GAMEPLAY" });
  enter(w, c, "MY SOFT MENU");
  w.gv.DeviceTypeCreatingNow = "SOFT SMARTPHONES"; // what the part flow would do
  flush(w);
  assert.equal(w.calls.layouts.at(-1), "DESIGNER OFFICE");
  assert.equal(w.gv.DeviceTypeCreatingNow, "LAPTOPS", "device A still in development");
  assert.equal(w.gv.class, "GAMEPLAY");
  assert.equal(w.calls.toasts.at(-1), "Software can't be added to the build queue yet.");
  assert.equal(api(c).capturing(), false);
}


// ── Round 4: own CPUs in the build queue ──
function cpuWorld() {
  const w = world();
  w.arrays.ArrayMyCPU_Smartphones = new Arr(1, 58, 1);
  w.arrays.ArrayMyCPU_SmartphonesSeries = new Arr(1, 4, 1);
  w.arrays.ArrayMyCPU_SmartphonesEarnings = new Arr(1, 11, 1);
  const a = w.arrays.ArrayMyCPU_Smartphones, sa = w.arrays.ArrayMyCPU_SmartphonesSeries;
  sa.setAt(0, 0, 0, 0); sa.setAt("Old series", 0, 1, 0);
  a.setAt(0, 0, 0, 0); a.setAt(0, 0, 1, 0); a.setAt("Old 1", 0, 2, 0); a.setAt(1, 0, 3, 0); a.setAt(3, 0, 23, 0);
  const c = context(w);
  // The game's own CPU list and stat copy (buildMyCpuList / applyMyCpuSpecs), reduced.
  c.buildMyCpuList = (rt, t) => {
    const gv = rt.globalVars, p = sa.getAt(gv.Processor - 1, 0, 0), rows = [];
    for (let x = 0; x < a.width; x++) if (a.getAt(x, 1, 0) === p) rows.push(x);
    gv.ProcessorID = p;
    gv.ProcessorSeriesID = a.getAt(rows[gv.ProcessorSeries - 1], 0, 0);
    w.calls.functions.push("buildMyCpuList:" + t);
  };
  c.applyMyCpuSpecs = (rt, t) => {
    const gv = rt.globalVars;
    let x = 0;
    while (x < a.width && a.getAt(x, 0, 0) !== gv.ProcessorSeriesID) x++;
    if (gv.UseMyProcessor === "ON") gv.ProcessorRefreshRateID = a.getAt(x, 23, 0);
    w.calls.functions.push("applyMyCpuSpecs:" + t);
  };
  return { w, c, a, sa };
}
// The game inserts new own-part records at X 0; the ID (col0) is the old count.
function pushFront(a, h) {
  a.setSize(a.width + 1, h, 1);
  for (let x = a.width - 1; x > 0; x--) for (let y = 0; y < h; y++) a.setAt(a.getAt(x - 1, y, 0), x, y, 0);
  for (let y = 0; y < h; y++) a.setAt(0, 0, y, 0);
  return a.width - 1;
}
// MyCPU_SmartphonesAddToArray on CPU LOADING start (103:65-156), reduced to the columns used here.
function gameCpuAdd(w) {
  const gv = w.gv, a = w.arrays.ArrayMyCPU_Smartphones, sa = w.arrays.ArrayMyCPU_SmartphonesSeries;
  const ea = w.arrays.ArrayMyCPU_SmartphonesEarnings;
  if (gv.DeviceType !== "SMARTPHONE") return;
  ea.setSize(ea.width + 1, ea.height, 1);
  let series = gv.SeriesID - 1;
  if (gv.SeriesCreatedNew) {
    series = pushFront(sa, 4);
    sa.setAt(series, 0, 0, 0);
    sa.setAt(gv.SeriesName, 0, 1, 0);
  }
  const id = pushFront(a, 58);
  a.setAt(id, 0, 0, 0); a.setAt(series, 0, 1, 0); a.setAt(gv.DeviceName, 0, 2, 0);
  a.setAt(gv.MyCPU_Style, 0, 3, 0); a.setAt(gv.ProcessorRefreshRateID, 0, 23, 0);
  gv.DeviceTypeCreatingNow = "CPU SMARTPHONES";
}
function openPicker(w, c) {
  ticks(c, 1);
  for (const fn of w.handlers.pointerdown || []) fn({ clientX: 960, clientY: 1000 });
  flush(w);
  enter(w, c, "BOSS OFFICE");
  flush(w);
  w.gv.CreateDevicesUI = "OFF";
}
function queueCpu(w, c, open) {
  (open || openPicker)(w, c);
  w.gv.class = "CPU EDITOR MENU";
  enter(w, c, "CPU EDITOR MENU");
  assert.equal(api(c).capturing(), true, "CPU editor while busy is captured");
  Object.assign(w.gv, { DeviceType: "SMARTPHONE", DeviceName: "Qcpu 1", SeriesCreatedNew: true, SeriesName: "Qseries",
    SeriesID: 0, MyCPU_Style: 4, ProcessorRefreshRateID: 7, DevicePrice: 50, DeviceCostPrice: 20 });
  w.gv.class = "CPU LOADING";
  enter(w, c, "CPU LOADING", () => gameCpuAdd(w));
  flush(w);
}
function queuePhoneWithCpu(w, c, a, sa) {
  openPicker(w, c);
  Object.assign(w.gv, { DeviceType: "SMARTPHONE", LastClass: "GAMEPLAY", class: "SMARTPHONE NAME" });
  enter(w, c, "SMARTPHONE NAME");
  assert.equal(api(c).capturing(), true);
  assert.equal(a.width, 2, "queued CPU listed in the editor");
  assert.equal(a.getAt(1, 2, 0), "Queued: Qcpu 1");
  assert.equal(sa.getAt(1, 1, 0), "Queued: Qseries");
  assert.equal(a.getAt(1, 23, 0), 7, "with the queued design's stats");
  // The player picks it on PAGE 6: own CPU (type 2), series 1, chip col0 1; the game copied its stats.
  Object.assign(w.gv, { ProcessorType: 2, ProcessorID: 1, ProcessorSeriesID: 1, ProcessorRefreshRateID: 7,
    Processor: 2, ProcessorSeries: 1, DevicesCount: 1, DeviceCountCreatingNow: 1, DeviceName: "Qphone",
    LastClass: "EDITOR PRICE PAGE", class: "LOADING EDITOR" });
  enter(w, c, "LOADING EDITOR");
  flush(w);
}

// 12. A CPU designed while busy: queued at CPU LOADING, the game's record copied and undone.
{
  const { w, c, a, sa } = cpuWorld();
  queueCpu(w, c);
  assert.equal(api(c).capturing(), false);
  assert.equal(w.calls.layouts.at(-1), "DESIGNER OFFICE", "back in the work office");
  assert.equal(a.width, 1, "no CPU record is left");
  assert.equal(sa.width, 1, "no series is left");
  assert.equal(w.arrays.ArrayMyCPU_SmartphonesEarnings.width, 1, "no earnings row is left");
  assert.equal(w.gv.DeviceTypeCreatingNow, "LAPTOPS", "device A keeps the development slot");
  assert.equal(w.gv.DeviceName, "Book 4");
  assert.equal(w.gv.class, "GAMEPLAY");
  assert.deepEqual(w.calls.toasts, ["Added to build queue (1)"]);
  const it = api(c).state().items[0];
  assert.equal(it.kind, "part");
  assert.equal(it.part, "CPU");
  assert.equal(it.platform, "SMARTPHONE");
  assert.equal(it.name, "Qcpu 1");
  assert.equal(it.vars.ProcessorRefreshRateID, 7);
  assert.equal(it.vars.SeriesCreatedNew, true);
  assert.equal(it.record.chip[2], "Qcpu 1");
  assert.equal(it.record.series[1], "Qseries");
  assert.equal(api(c).rowSub(it.id), "CPU");
  assert.equal(JSON.parse(w.saves.getAt(0, 151, 0)).items[0].kind, "part", "saved");
}

// 13-15. A phone that picks "Queued: Qcpu 1"; order rule; replay: CPU first, then the phone with the real CPU.
{
  const { w, c, a, sa } = cpuWorld();
  queueCpu(w, c);
  queuePhoneWithCpu(w, c, a, sa);
  assert.equal(a.width, 1, "placeholder removed with the capture");
  assert.equal(sa.width, 1);
  let [cpu, phone] = api(c).state().items;
  assert.equal(phone.variants[0].part.id, cpu.id, "the device records the queued part");
  assert.equal(api(c).rowSub(phone.id), "Smartphone: Budget, uses Qcpu 1");
  // A laptop editor does not list a smartphone CPU.
  openPicker(w, c);
  Object.assign(w.gv, { DeviceType: "LAPTOP", LastClass: "GAMEPLAY", class: "LAPTOP NAME" });
  enter(w, c, "LAPTOP NAME");
  assert.equal(a.width, 1, "not injected for a laptop");
  w.gv.class = "GAMEPLAY";
  enter(w, c, "DESIGNER OFFICE");
  flush(w);
  // 14. The phone cannot move above its CPU.
  w.calls.toasts.length = 0;
  assert.equal(api(c).canMove(phone.id, -1), false);
  assert.equal(api(c).move(phone.id, -1), false);
  assert.equal(api(c).move(cpu.id, 1), false);
  assert.equal(w.calls.toasts[0], "Qphone uses Qcpu 1, so it stays below it in the queue.");
  assert.equal(api(c).state().items[0].id, cpu.id);
  // 15. A finishes. Meanwhile a hand-made CPU took ID 1, so the real one will be ID 2.
  a.setSize(2, 58, 1);
  a.setAt(1, 1, 0, 0); a.setAt(0, 1, 1, 0); a.setAt("Hand 1", 1, 2, 0);
  Object.assign(w.gv, { DeviceTypeCreatingNow: "", OfficeType: "BOSS", class: "GAMEPLAY", ProcessorRefreshRateID: 0, DeviceName: "Book 4" });
  w.layout.name = "BOSS OFFICE";
  w.calls.layouts.length = 0;
  ticks(c, 5);
  assert.deepEqual(w.calls.layouts, ["CPU LOADING"], "the CPU starts first, with no click");
  assert.equal(w.gv.DeviceType, "SMARTPHONE");
  assert.equal(w.gv.DeviceName, "Qcpu 1");
  assert.equal(w.gv.ProcessorRefreshRateID, 7);
  enter(w, c, "CPU LOADING", () => gameCpuAdd(w));
  assert.equal(a.width, 3, "the game made the real CPU");
  Object.assign(w.gv, { class: "GAMEPLAY", OfficeType: "DESIGNER" });
  enter(w, c, "DESIGNER OFFICE");
  assert.equal(w.calls.toasts.at(-1), "Qcpu 1 started from the build queue.");
  let st = api(c).state();
  assert.equal(st.items.length, 1);
  assert.deepEqual(st.items[0].variants[0].part.real, { row: 2, series: 1 });
  assert.equal(api(c).rowSub(phone.id), "Smartphone: Budget, uses Qcpu 1");
  ticks(c, 1);
  // A record that differs from the queued design is never used.
  assert.equal(a.getAt(0, 0, 0), 2, "the game put the real CPU (ID 2) at X 0");
  a.setAt(99, 0, 3, 0);
  assert.equal(api(c).why(phone.id), "partdiff");
  a.setAt(4, 0, 3, 0);
  assert.equal(api(c).why(phone.id), "");
  // The CPU is finished: the phone starts with the real CPU and the game's own stat copy.
  Object.assign(w.gv, { DeviceTypeCreatingNow: "", OfficeType: "BOSS", class: "GAMEPLAY", Processor: 5, ProcessorSeries: 6, ProcessorRefreshRateID: 0 });
  w.layout.name = "BOSS OFFICE";
  w.calls.layouts.length = 0;
  w.calls.functions.length = 0;
  ticks(c, 5);
  assert.deepEqual(w.calls.layouts, ["LOADING EDITOR"]);
  assert.deepEqual(w.calls.functions, ["buildMyCpuList:SMARTPHONE", "applyMyCpuSpecs:SMARTPHONE"]);
  assert.equal(w.gv.DeviceName, "Qphone");
  assert.equal(w.gv.ProcessorType, 2);
  assert.equal(w.gv.ProcessorSeriesID, 2, "real record id, not the placeholder's 1");
  assert.equal(w.gv.ProcessorID, 1, "real series");
  assert.equal(w.gv.ProcessorRefreshRateID, 7, "stats copied from the real record");
  assert.equal(w.gv.Processor, 5, "editor selection globals put back");
  assert.equal(w.gv.ProcessorSeries, 6);
}

// 16. The CPU is removed before it is made: plain message, the phone never gets another CPU.
{
  const { w, c, a, sa } = cpuWorld();
  queueCpu(w, c);
  queuePhoneWithCpu(w, c, a, sa);
  const [cpu, phone] = api(c).state().items;
  w.calls.toasts.length = 0;
  assert.equal(api(c).remove(cpu.id), true);
  assert.equal(w.calls.toasts[0], "Qcpu 1 removed. Qphone needed it and will not start; remove it too or design it again.");
  assert.equal(api(c).rowSub(phone.id), "Smartphone: Budget, needs Qcpu 1, removed from the queue");
  Object.assign(w.gv, { DeviceTypeCreatingNow: "", OfficeType: "BOSS", class: "GAMEPLAY" });
  w.layout.name = "BOSS OFFICE";
  w.calls.layouts.length = 0;
  ticks(c, 8);
  assert.deepEqual(w.calls.layouts, [], "nothing starts");
  assert.equal(w.calls.toasts[1], "Build queue: Qphone cannot start, its part Qcpu 1 was removed from the queue (remove this device or design it again). It stays in the queue.");
  assert.equal(api(c).why(phone.id), "partgone");
  assert.equal(api(c).state().items.length, 1);
}

// 17. Backing out of the CPU editor queues nothing and returns to the work office.
{
  const { w, c, a } = cpuWorld();
  openPicker(w, c);
  enter(w, c, "CPU EDITOR MENU");
  w.gv.DeviceName = "Gone";
  w.gv.class = "GAMEPLAY";
  enter(w, c, "BOSS OFFICE");
  flush(w);
  assert.equal(api(c).capturing(), false);
  assert.equal(w.calls.layouts.at(-1), "DESIGNER OFFICE");
  assert.equal(w.gv.DeviceName, "Book 4");
  assert.equal(a.width, 1);
  assert.equal(api(c).state().items.length, 0);
}

// 18. v2 saves load unchanged and are written back as v3.
{
  const w = world(), c = context(w);
  createWhileBusy(w, c, { count: 2 });
  flush(w);
  const v3 = JSON.parse(w.saves.getAt(0, 151, 0));
  const v2 = Object.assign({}, v3, { v: 2 });
  const old = world();
  old.saves.setAt(JSON.stringify(v2), 0, 151, 0);
  const c2 = context(old);
  const st = api(c2).state();
  assert.deepEqual(st.items, v3.items, "v2 entries unchanged");
  assert.equal(old.calls.toasts.length, 0, "nothing dropped");
  api(c2).pause(false);
  assert.equal(JSON.parse(old.saves.getAt(0, 151, 0)).v, 3);
}

// 19. A graphics card designed while busy, a laptop that picks it, replay with the real GPU.
{
  const w = world(), c = context(w);
  w.arrays.ArrayMyGPU_Laptops = new Arr(1, 40, 1);
  w.arrays.ArrayMyGPU_LaptopsSeries = new Arr(1, 4, 1);
  w.arrays.ArrayMyGPU_LaptopsEarnings = new Arr(1, 11, 1);
  const g = w.arrays.ArrayMyGPU_Laptops, gs = w.arrays.ArrayMyGPU_LaptopsSeries;
  gs.setAt(0, 0, 0, 0); gs.setAt("Old gpus", 0, 1, 0);
  g.setAt(0, 0, 0, 0); g.setAt(0, 0, 1, 0); g.setAt("Old G", 0, 2, 0); g.setAt(2, 0, 3, 0);
  // MyGPU_AddToArray on GPU LOADING (138:48-121), reduced. The GPU flow leaves DeviceType alone.
  const gameGpuAdd = () => {
    const gv = w.gv;
    w.arrays.ArrayMyGPU_LaptopsEarnings.setSize(w.arrays.ArrayMyGPU_LaptopsEarnings.width + 1, 11, 1);
    let series = gv.SeriesID - 1;
    if (gv.SeriesCreatedNew) {
      gs.setSize(gs.width + 1, 4, 1);
      series = gs.width - 1;
      gs.setAt(series, series, 0, 0);
      gs.setAt(gv.SeriesName, series, 1, 0);
    }
    g.setSize(g.width + 1, 40, 1);
    const x = g.width - 1;
    g.setAt(x, x, 0, 0); g.setAt(series, x, 1, 0); g.setAt(gv.DeviceName, x, 2, 0); g.setAt(gv.GraphicProcessorRefreshRateID, x, 3, 0);
    gv.DeviceTypeCreatingNow = "GPU";
  };
  openPicker(w, c);
  w.gv.class = "GPU EDITOR MENU";
  enter(w, c, "GPU EDITOR MENU");
  assert.equal(api(c).capturing(), true, "GPU editor while busy is captured");
  Object.assign(w.gv, { DeviceName: "Qgpu 1", SeriesCreatedNew: true, SeriesName: "Qg", SeriesID: 0, GraphicProcessorRefreshRateID: 6 });
  w.gv.class = "GPU LOADING";
  enter(w, c, "GPU LOADING", gameGpuAdd);
  flush(w);
  assert.equal(g.width, 1, "no GPU record is left");
  assert.equal(gs.width, 1);
  assert.equal(w.gv.DeviceTypeCreatingNow, "LAPTOPS");
  assert.equal(w.calls.layouts.at(-1), "DESIGNER OFFICE");
  const gpu = api(c).state().items[0];
  assert.equal(gpu.part, "GPU");
  assert.equal(gpu.platform, "LAPTOP");
  assert.equal(api(c).rowSub(gpu.id), "Graphics card");
  // A laptop editor lists it; a phone editor does not.
  openPicker(w, c);
  Object.assign(w.gv, { DeviceType: "SMARTPHONE", LastClass: "GAMEPLAY", class: "SMARTPHONE NAME" });
  enter(w, c, "SMARTPHONE NAME");
  assert.equal(g.width, 1, "not injected for a phone");
  w.gv.class = "GAMEPLAY";
  enter(w, c, "DESIGNER OFFICE");
  flush(w);
  openPicker(w, c);
  Object.assign(w.gv, { DeviceType: "LAPTOP", LastClass: "GAMEPLAY", class: "LAPTOP NAME" });
  enter(w, c, "LAPTOP NAME");
  assert.equal(g.getAt(1, 2, 0), "Queued: Qgpu 1");
  assert.equal(gs.getAt(1, 1, 0), "Queued: Qg");
  Object.assign(w.gv, { GraphicProcessorType: 3, GraphicProcessorID: 1, GraphicProcessorSeriesID: 1, GraphicProcessorRefreshRateID: 6,
    DevicesCount: 1, DeviceCountCreatingNow: 1, DeviceName: "Qlap", LastClass: "EDITOR PRICE PAGE", class: "LOADING EDITOR" });
  enter(w, c, "LOADING EDITOR");
  flush(w);
  assert.equal(g.width, 1, "placeholder removed with the capture");
  const lap = api(c).state().items[1];
  assert.equal(lap.variants[0].part.id, gpu.id);
  assert.equal(api(c).rowSub(lap.id), "Laptop: Budget, uses Qgpu 1");
  assert.equal(api(c).canMove(lap.id, -1), false);
  // A finishes; the GPU is made first (as row 1), then the laptop gets the real IDs.
  Object.assign(w.gv, { DeviceTypeCreatingNow: "", OfficeType: "BOSS", class: "GAMEPLAY", DeviceName: "Book 4" });
  w.layout.name = "BOSS OFFICE";
  w.calls.layouts.length = 0;
  ticks(c, 5);
  assert.deepEqual(w.calls.layouts, ["GPU LOADING"]);
  assert.equal(w.gv.DeviceName, "Qgpu 1");
  enter(w, c, "GPU LOADING", gameGpuAdd);
  Object.assign(w.gv, { class: "GAMEPLAY", OfficeType: "DESIGNER" });
  enter(w, c, "DESIGNER OFFICE");
  assert.equal(w.calls.toasts.at(-1), "Qgpu 1 started from the build queue.");
  assert.deepEqual(api(c).state().items[0].variants[0].part.real, { row: 1, series: 1 });
  ticks(c, 1);
  Object.assign(w.gv, { DeviceTypeCreatingNow: "", OfficeType: "BOSS", class: "GAMEPLAY", GraphicProcessorSeriesID: 0, GraphicProcessorID: 0 });
  w.layout.name = "BOSS OFFICE";
  w.calls.layouts.length = 0;
  ticks(c, 5);
  assert.deepEqual(w.calls.layouts, ["LOADING EDITOR"]);
  assert.equal(w.gv.DeviceName, "Qlap");
  assert.equal(w.gv.GraphicProcessorType, 3);
  assert.equal(w.gv.GraphicProcessorSeriesID, 1, "real GPU record id");
  assert.equal(w.gv.GraphicProcessorID, 1, "real GPU series");
  assert.equal(w.gv.GraphicProcessorRefreshRateID, 6);
}

// 20. Next-stage click that the game handled first (office already moved on): no picker.
{
  const w = world(), c = context(w);
  w.gv.BubblesDesign = 0;
  ticks(c, 1); // the office before the click: design stage done
  Object.assign(w.gv, { OfficeType: "PROGRAMMER", BubblesTechnology: 200, BubblesBugs: 100 });
  for (const fn of w.handlers.pointerdown || []) fn({ clientX: 960, clientY: 1000 });
  flush(w);
  assert.deepEqual(w.calls.layouts, [], "the queue leaves the game's next-stage click alone");
  assert.equal(w.calls.functions.length, 0);
}

// 21. Continue a save with a queue and nothing in development: the head starts by itself.
{
  const w = world(), c = context(w);
  createWhileBusy(w, c, { count: 1 });
  flush(w);
  Object.assign(w.gv, { DeviceTypeCreatingNow: "", OfficeType: "BOSS", class: "GAMEPLAY", LastClass: "GAMEPLAY" });
  w.layout.name = "BOSS OFFICE";
  const c2 = context(w); // page reload + Continue
  w.calls.layouts.length = 0;
  ticks(c2, 5);
  assert.deepEqual(w.calls.layouts, ["LOADING EDITOR"], "idle reload starts the queue");
}

// ── Round 4: own OS in the build queue ──
function osWorld(owned) {
  const w = world();
  w.arrays.ArrayMyOS_Smartphones = new Arr(35, 1, 1);
  w.arrays.ArrayMyOS_SmartphonesEarnings = new Arr(owned ? 1 : 0, 11, 1);
  if (owned) {
    w.arrays.ArrayMyOS_Smartphones.setAt(2, 0, 0, 0);
    w.arrays.ArrayMyOS_SmartphonesEarnings.setAt("Mine", 0, 0, 0);
    w.arrays.ArrayMyOS_SmartphonesEarnings.setAt("1", 0, 1, 0);
  }
  w.arrays.ArrayMyOsChoose = new Arr(35, 1, 1);
  const label = { uid: 1157, text: "0 0" };
  w.rt.getInstanceByUid = (uid) => (uid === 1157 ? label : uid === 1156 ? {} : null);
  Object.assign(w.gv, { OperationSystem: 1, OperationSystemID: 4, OperationSystem_Text: "Stock", OperationSystemVersion_Text: "9", OSLicenseOpened: false });
  const c = context(w);
  return { w, c, label, ta: w.arrays.ArrayMyOS_Smartphones, ea: w.arrays.ArrayMyOS_SmartphonesEarnings };
}
// The game's NAME OFF (119:368-384) and FINISH click + MyOSFinish_OFF (123:226-233, 305-404), reduced.
function gameOsPush(ea, name, ver) {
  pushFront(ea, 11);
  ea.setAt(name, 0, 0, 0); ea.setAt(ver, 0, 1, 0); ea.setAt(-999, 0, 8, 0);
}
function queueOs(w, c, name, open) {
  (open || openPicker)(w, c);
  Object.assign(w.gv, { class: "MY OS MENU", LastClass: "GAMEPLAY" });
  enter(w, c, "MY OS MENU");
  assert.equal(api(c).capturing(), true, "OS screens while busy are captured");
  const ta = w.arrays.ArrayMyOS_Smartphones, ea = w.arrays.ArrayMyOS_SmartphonesEarnings;
  Object.assign(w.gv, { MyOSDevice: "SMARTPHONES", MyOS_Name: name, MyOS_VersionName: "1.0", DeviceTypeCreatingNow: "OS SMARTPHONES", class: "MY OS NAME" });
  enter(w, c, "MY OS NAME");
  gameOsPush(ea, name, "1.0");
  Object.assign(w.gv, { class: "MY OS FINISH", MyOSUpdatePrice: 20000, MyOSRating: 3 });
  enter(w, c, "MY OS FINISH");
  // FINISH click: SubVar Budget, LastClass, class, then MyOSFinish_OFF.
  w.gv.Budget -= w.gv.MyOSUpdatePrice;
  Object.assign(w.gv, { LastClass: "MY OS FINISH", class: "GAMEPLAY", BubblesDesign: 100, BubblesTechnology: 100, OfficeType: "DESIGNER" });
  gameOsPush(ea, name, "1.0");
  ta.setAt(Math.max(Number(ta.getAt(0, 0, 0)), 1), 0, 0, 0);
  ta.setAt(Math.max(Number(ta.getAt(3, 0, 0)), 1), 3, 0, 0);
  enter(w, c, "DESIGNER OFFICE");
  flush(w);
}
// The game finishes an OS (it never clears DeviceTypeCreatingNow): the last
// stage click (276:2896-2907) pushes "OS RELEASED" and goes to the boss
// office; the assistant's OK (279:92-105) stamps release day x=0 col 8.
// Nothing may start before that OK, or the stamp (which checks
// DeviceTypeCreatingNow) would miss the OS.
function gameOsRelease(w, c, ea) {
  const dev = w.gv.DeviceTypeCreatingNow;
  Object.assign(w.gv, { OfficeType: "BOSS", class: "GAMEPLAY", Assistant: "OFF", BubblesTechnology: 0, BubblesBugs: 0 });
  w.layout.name = "BOSS OFFICE";
  ticks(c, 5);
  assert.equal(w.gv.DeviceTypeCreatingNow, dev, "nothing starts before the OS RELEASED card is answered");
  w.gv.Assistant = "ON";
  ticks(c, 5);
  assert.equal(w.gv.DeviceTypeCreatingNow, dev);
  ea.setAt(w.gv.DayTotal, 0, 8, 0);
  w.gv.Assistant = "OFF";
  ticks(c, 5);
}
// A plain phone queued while the OS is in development.
function queuePhonePlain(w, c) {
  queuePhoneWithOs(w, c, null, false);
}
function queuePhoneWithOs(w, c, label, pick) {
  openPicker(w, c);
  Object.assign(w.gv, { DeviceType: "SMARTPHONE", LastClass: "GAMEPLAY", class: "SMARTPHONE NAME" });
  enter(w, c, "SMARTPHONE NAME");
  assert.equal(api(c).capturing(), true);
  enter(w, c, "SMARTPHONE PAGE 7");
  flush(w);
  if (pick) w.gv.OperationSystem = 0; // click on 979: the game toggles to the own OS
  enter(w, c, "SMARTPHONE PAGE 8");
  Object.assign(w.gv, { DevicesCount: 1, DeviceCountCreatingNow: 1, DeviceName: "Ophone", LastClass: "EDITOR PRICE PAGE", class: "LOADING EDITOR" });
  enter(w, c, "LOADING EDITOR");
  flush(w);
}

// 20. An own OS designed while busy: captured at the FINISH commit, undone, nothing charged.
{
  const { w, c, ta, ea } = osWorld(false);
  queueOs(w, c, "Qos");
  assert.equal(api(c).capturing(), false);
  assert.equal(w.gv.Budget, 5e6, "price refunded");
  assert.equal(ta.getAt(0, 0, 0), 0, "no own OS made");
  assert.equal(ta.getAt(3, 0, 0), 0);
  assert.equal(ea.width, 0, "no earnings rows left");
  assert.equal(w.gv.DeviceTypeCreatingNow, "LAPTOPS", "device A keeps the development slot");
  assert.equal(w.gv.BubblesDesign, 37);
  assert.equal(w.gv.class, "GAMEPLAY");
  assert.deepEqual(w.calls.toasts, ["Added to build queue (1)"]);
  const it = api(c).state().items[0];
  assert.equal(it.part, "OS");
  assert.equal(it.platform, "SMARTPHONES");
  assert.equal(it.name, "Qos");
  assert.equal(it.price, 20000);
  assert.equal(it.earn.rows.length, 2, "both rows the screens pushed");
  assert.equal(api(c).rowSub(it.id), "Operating system");
}

// 21-23. The phone's "My OS" slot shows "Queued: Qos" only on its page; replay: OS first, then the phone.
{
  const { w, c, label, ta, ea } = osWorld(false);
  queueOs(w, c, "Qos");
  queuePhoneWithOs(w, c, label, true);
  assert.equal(label.text, "Queued: Qos", "the slot label");
  assert.equal(ta.getAt(0, 0, 0), 0, "slot gate put back after the page");
  assert.equal(w.gv.OperationSystem_Text, "Stock", "text globals never faked");
  assert.equal(w.gv.OperationSystemVersion_Text, "9");
  const [os, phone] = api(c).state().items;
  assert.equal(phone.variants[0].os.id, os.id);
  assert.equal(phone.variants[0].vars.OperationSystem_Text, "Stock", "no fake text in the saved entry");
  assert.ok(!w.saves.getAt(0, 151, 0).includes("Queued:"), "no fake value in the save");
  assert.equal(api(c).rowSub(phone.id), "Smartphone: Budget, uses Qos");
  assert.equal(api(c).canMove(phone.id, -1), false);
  // A finishes: the OS starts by itself, charged now.
  Object.assign(w.gv, { DeviceTypeCreatingNow: "", OfficeType: "BOSS", class: "GAMEPLAY" });
  w.layout.name = "BOSS OFFICE";
  w.calls.layouts.length = 0;
  ticks(c, 5);
  assert.deepEqual(w.calls.layouts, ["DESIGNER OFFICE"]);
  assert.equal(w.gv.DeviceTypeCreatingNow, "OS SMARTPHONES");
  assert.equal(w.gv.OfficeType, "DESIGNER");
  assert.equal(w.gv.Budget, 5e6 - 20000);
  assert.equal(ta.getAt(0, 0, 0), 1);
  assert.equal(ea.width, 2);
  assert.equal(ea.getAt(0, 0, 0), "Qos");
  assert.equal(w.calls.toasts.at(-1), "Qos started from the build queue.");
  let st = api(c).state();
  assert.equal(st.items.length, 1);
  assert.deepEqual(st.items[0].variants[0].os.real, { os: true });
  assert.equal(api(c).why(phone.id), "");
  // The OS is finished the game's way; then the phone starts with OperationSystem 0 and the made OS's texts.
  enter(w, c, "DESIGNER OFFICE");
  ticks(c, 1);
  w.calls.layouts.length = 0;
  gameOsRelease(w, c, ea);
  assert.deepEqual(w.calls.layouts, ["LOADING EDITOR"]);
  assert.equal(w.gv.DeviceName, "Ophone");
  assert.equal(w.gv.OperationSystem, 0);
  assert.equal(w.gv.OperationSystem_Text, "Qos");
  assert.equal(w.gv.OperationSystemVersion_Text, "1.0");
  assert.equal(w.gv.OSLicenseOpened, true);
  assert.equal(w.gv.OperationSystemID, 4, "ID as the editor left it, like a hand-made device");
}

// 20b. A new OS commits at NAME (free); nothing charged at replay either.
{
  const { w, c, ta, ea } = osWorld(false);
  openPicker(w, c);
  Object.assign(w.gv, { class: "MY OS MENU", LastClass: "GAMEPLAY" });
  enter(w, c, "MY OS MENU");
  Object.assign(w.gv, { class: "MY OS NAME", MyOsCreatingType: "CREATE OS" });
  enter(w, c, "MY OS NAME");
  // MyOSName_OFF with class GAMEPLAY (119:155-158, 368-384).
  Object.assign(w.gv, { MyOSDevice: "SMARTPHONES", MyOS_Name: "Nos", MyOS_VersionName: "1", LastClass: "MY OS NAME", class: "GAMEPLAY",
    DeviceTypeCreatingNow: "OS SMARTPHONES", BubblesDesign: 10, OfficeType: "DESIGNER", MyOSUpdatePrice: 777 });
  for (let x = 0; x < 35; x++) ta.setAt(1, x, 0, 0);
  gameOsPush(ea, "Nos", "1");
  enter(w, c, "DESIGNER OFFICE");
  flush(w);
  assert.equal(w.gv.Budget, 5e6, "create is free");
  assert.equal(ta.getAt(0, 0, 0), 0);
  assert.equal(ea.width, 0);
  assert.equal(w.gv.DeviceTypeCreatingNow, "LAPTOPS");
  const it = api(c).state().items[0];
  assert.equal(it.price, 0);
  assert.equal(it.name, "Nos");
  Object.assign(w.gv, { DeviceTypeCreatingNow: "", OfficeType: "BOSS", class: "GAMEPLAY" });
  w.layout.name = "BOSS OFFICE";
  ticks(c, 5);
  assert.equal(w.gv.DeviceTypeCreatingNow, "OS SMARTPHONES");
  assert.equal(w.gv.Budget, 5e6);
  assert.equal(ta.getAt(0, 0, 0), 1);
  assert.equal(ea.getAt(0, 0, 0), "Nos");
  // After its stages and the OS RELEASED card the next entry starts by itself.
  const day = w.gv.DayTotal;
  queuePhonePlain(w, c);
  w.calls.layouts.length = 0;
  gameOsRelease(w, c, ea);
  assert.equal(ea.getAt(0, 8, 0), day, "release day is the game's own stamp");
  assert.deepEqual(w.calls.layouts, ["LOADING EDITOR"], "the next entry starts after the new OS is released");
  assert.equal(api(c).state().items.length, 1);
}

// 20c. An upgrade (commits at FINISH, paid) also finishes and lets the queue go on;
// a hand-made device after a released OS is made normally, not queued.
{
  const { w, c, ta, ea } = osWorld(true);
  queueOs(w, c, "Mine 2");
  queuePhonePlain(w, c);
  Object.assign(w.gv, { DeviceTypeCreatingNow: "", OfficeType: "BOSS", class: "GAMEPLAY" });
  w.layout.name = "BOSS OFFICE";
  ticks(c, 5);
  assert.equal(w.gv.DeviceTypeCreatingNow, "OS SMARTPHONES");
  assert.equal(w.gv.Budget, 5e6 - 20000, "the upgrade is charged when it starts");
  assert.equal(ea.getAt(0, 0, 0), "Mine 2");
  enter(w, c, "DESIGNER OFFICE");
  ticks(c, 1);
  w.calls.layouts.length = 0;
  gameOsRelease(w, c, ea);
  assert.deepEqual(w.calls.layouts, ["LOADING EDITOR"], "the phone starts after the upgrade is released");
  assert.equal(w.gv.Budget, 5e6 - 20000, "nothing extra charged");
  assert.equal(ea.getAt(ea.width - 1, 8, 0), 0, "the old OS row untouched");
}
{
  // Busy test: an OS in development is busy; once its release is stamped it is not.
  const { w, c, ea } = osWorld(true);
  ea.setAt(-999, 0, 8, 0);
  Object.assign(w.gv, { DeviceTypeCreatingNow: "OS SMARTPHONES", OfficeType: "BOSS", class: "GAMEPLAY", LastClass: "GAMEPLAY" });
  w.layout.name = "BOSS OFFICE";
  ticks(c, 2);
  ea.setAt(12, 0, 8, 0);
  ticks(c, 2);
  // The player now creates a phone by hand from the boss office: not captured.
  Object.assign(w.gv, { DeviceType: "SMARTPHONE", class: "SMARTPHONE NAME" });
  enter(w, c, "SMARTPHONE NAME");
  assert.equal(api(c).capturing(), false, "a hand-made device after a released OS is not queued");
}

// 20d. A queued OS upgrade waits for money like the game's FINISH button
// (price <= Budget): no start and no charge while short, then it starts.
{
  const { w, c, ea } = osWorld(true);
  queueOs(w, c, "Mine 2");
  const real = Date.now;
  let skew = 0;
  c.Date = { now: () => real() + skew };
  Object.assign(w.gv, { DeviceTypeCreatingNow: "", OfficeType: "BOSS", class: "GAMEPLAY", Budget: 15000 });
  w.layout.name = "BOSS OFFICE";
  w.calls.toasts.length = 0;
  ticks(c, 8);
  const it = api(c).state().items[0];
  assert.equal(w.gv.DeviceTypeCreatingNow, "", "not started while the upgrade cannot be paid");
  assert.equal(w.gv.Budget, 15000, "nothing charged");
  assert.equal(api(c).why(it.id), "money");
  assert.equal(api(c).status(it.id), "Waiting for money");
  assert.equal(w.calls.toasts.filter((t) => /not enough money/.test(t)).length, 1, "one plain message");
  w.gv.Budget = 20000;
  skew = 6000;
  ticks(c, 8);
  assert.equal(w.gv.DeviceTypeCreatingNow, "OS SMARTPHONES", "starts once it can be paid");
  assert.equal(w.gv.Budget, 0);
  assert.equal(ea.getAt(0, 0, 0), "Mine 2");
}
// 20e. A start that fails leaves the entry blocked on the page and is tried
// again after a while, instead of the queue going silent.
{
  const w = world(), c = context(w);
  createWhileBusy(w, c, { count: 1 });
  flush(w);
  const real = Date.now;
  let skew = 0;
  c.Date = { now: () => real() + skew };
  let fail = true;
  const go = w.rt.goToLayout;
  w.rt.goToLayout = function (name) {
    if (fail && name === "LOADING EDITOR") { fail = false; throw new Error("the game refused"); }
    return go.apply(this, arguments);
  };
  Object.assign(w.gv, { DeviceTypeCreatingNow: "", OfficeType: "BOSS", class: "GAMEPLAY" });
  w.layout.name = "BOSS OFFICE";
  w.calls.layouts.length = 0;
  w.calls.toasts.length = 0;
  ticks(c, 8);
  const id = api(c).state().items[0].id;
  assert.deepEqual(w.calls.layouts, [], "the failed start went nowhere");
  assert.equal(api(c).failed(), id);
  assert.equal(api(c).status(id), "Couldn't start");
  assert.equal(w.calls.toasts.filter((t) => /could not start it/.test(t)).length, 1);
  assert.ok(api(c).retryAt() > Date.now(), "a retry is set");
  ticks(c, 8);
  assert.deepEqual(w.calls.layouts, [], "waits before trying again");
  skew = 20000;
  ticks(c, 8);
  assert.deepEqual(w.calls.layouts, ["LOADING EDITOR"], "tried again after a while");
  assert.equal(api(c).failed(), "");
}

// 24. The OS is removed before it is made: plain message, the phone never starts.
{
  const { w, c, label } = osWorld(false);
  queueOs(w, c, "Qos");
  queuePhoneWithOs(w, c, label, true);
  const [os, phone] = api(c).state().items;
  w.calls.toasts.length = 0;
  assert.equal(api(c).remove(os.id), true);
  assert.equal(w.calls.toasts[0], "Qos removed. Ophone needed it and will not start; remove it too or design it again.");
  assert.equal(api(c).rowSub(phone.id), "Smartphone: Budget, needs Qos, removed from the queue");
  assert.equal(api(c).why(phone.id), "partgone");
}

// 25. Already owning an OS: the editor is not changed; backing out of the OS screens queues nothing.
{
  const { w, c, label, ta } = osWorld(true);
  queueOs(w, c, "Qos 2");
  queuePhoneWithOs(w, c, label, false);
  assert.equal(label.text, "0 0", "label untouched");
  assert.equal(ta.getAt(0, 0, 0), 2);
  const phone = api(c).state().items[1];
  assert.equal(phone.variants[0].os, undefined);
  openPicker(w, c);
  Object.assign(w.gv, { class: "MY OS MENU", LastClass: "GAMEPLAY" });
  enter(w, c, "MY OS MENU");
  Object.assign(w.gv, { DeviceTypeCreatingNow: "OS SMARTPHONES", class: "GAMEPLAY", LastClass: "MY OS MENU" });
  enter(w, c, "BOSS OFFICE");
  flush(w);
  assert.equal(api(c).capturing(), false);
  assert.equal(w.gv.DeviceTypeCreatingNow, "LAPTOPS");
  assert.equal(w.calls.layouts.at(-1), "DESIGNER OFFICE");
  assert.equal(api(c).state().items.length, 2);
}

// 22. "Start from" a queued device: copies of its stored values, with the
// queued CPU moved to where it is listed now. Removing it later leaves a device
// started from it alone.
{
  const { w, c, a, sa } = cpuWorld();
  queueCpu(w, c);
  queuePhoneWithCpu(w, c, a, sa);
  const [cpu, phoneA] = api(c).state().items;
  const plain = (o) => JSON.parse(JSON.stringify(o));
  let t = plain(api(c).templates("SMARTPHONE"));
  assert.equal(t.length, 1);
  assert.equal(t[0].key, "q:" + phoneA.id + ":0");
  assert.equal(t[0].label, "Queued: Qphone");
  assert.equal(t[0].name, "Qphone");
  assert.deepEqual([t[0].k, t[0].count], [0, 1]);
  assert.deepEqual(t[0].lost, ["ProcessorID"], "outside an editor the queued CPU is listed nowhere");
  assert.ok(!("ProcessorSeriesID" in t[0].vars) && !("ProcessorType" in t[0].vars));
  assert.equal(api(c).templates("LAPTOP").length, 0, "other types not offered");
  // A hand-made CPU and series appear meanwhile: the queued CPU is now listed at ID 2, series 2.
  a.setSize(2, 58, 1); a.setAt(1, 1, 0, 0); a.setAt(0, 1, 1, 0); a.setAt("Hand 1", 1, 2, 0);
  sa.setSize(2, 4, 1); sa.setAt(1, 1, 0, 0); sa.setAt("Hand series", 1, 1, 0);
  openPicker(w, c);
  Object.assign(w.gv, { DeviceType: "SMARTPHONE", LastClass: "GAMEPLAY", class: "SMARTPHONE NAME" });
  enter(w, c, "SMARTPHONE NAME");
  assert.equal(a.getAt(2, 2, 0), "Queued: Qcpu 1");
  t = plain(api(c).templates("SMARTPHONE"));
  const v = t[0].vars;
  assert.deepEqual(t[0].lost, []);
  assert.deepEqual([v.ProcessorType, v.ProcessorSeriesID, v.ProcessorID], [2, 2, 2], "same queued CPU, today's row");
  assert.equal(v.ProcessorRefreshRateID, 7);
  assert.equal(v.DeviceName, "Qphone");
  assert.equal(t[0].arrays.ArrayEditorDesign_Smartphone.cells[0], "a-design");
  // Copies: changing them does not change the queue.
  v.ProcessorRefreshRateID = 99;
  t[0].arrays.ArrayEditorDesign_Smartphone.cells[0] = "x";
  const st = api(c).state().items[1].variants[0];
  assert.equal(st.vars.ProcessorRefreshRateID, 7);
  assert.equal(st.arrays.ArrayEditorDesign_Smartphone.cells[0], "a-design");
  assert.equal(st.vars.ProcessorSeriesID, 1, "stored placeholder ID untouched");
  // Phone B is made from it and queued; it records the same queued CPU.
  Object.assign(w.gv, api(c).templates("SMARTPHONE")[0].vars, { DeviceName: "Qphone B", DevicesCount: 1,
    DeviceCountCreatingNow: 1, LastClass: "EDITOR PRICE PAGE", class: "LOADING EDITOR" });
  enter(w, c, "LOADING EDITOR");
  flush(w);
  let items = api(c).state().items;
  assert.equal(items.length, 3);
  const b = items[2];
  assert.equal(b.names[0], "Qphone B");
  assert.equal(b.variants[0].part.id, cpu.id);
  assert.equal(b.variants[0].part.col0, 2);
  assert.equal(b.variants[0].vars.ProcessorRefreshRateID, 7);
  assert.equal(api(c).templates("SMARTPHONE")[0].name, "Qphone B", "newest first");
  // Removing A leaves B as it was.
  assert.equal(api(c).remove(phoneA.id), true);
  items = api(c).state().items;
  assert.deepEqual(items.map((i) => i.id), [cpu.id, b.id]);
  assert.deepEqual(items[1], b);
  assert.equal(api(c).why(b.id), "partwait");
}

// Tablet unlock uses the tile gates: DayTotal >= 724 and research 619 >= 2 (276 GAMEPLAY, uid 384).
{
  const research = { 619: 2 };
  const w = world({ research }), c = context(w);
  createWhileBusy(w, c, { count: 1 });
  flush(w);
  w.gv.DeviceType = "TABLET";
  w.gv.LastClass = "GAMEPLAY";
  enter(w, c, "TABLET NAME");
  w.gv.DevicesCount = 1;
  w.gv.DeviceName = "Slate";
  enter(w, c, "LOADING EDITOR");
  flush(w);
  const tab = api(c).state().items[1];
  assert.equal(tab.type, "TABLET");
  w.gv.DayTotal = 724;
  assert.equal(api(c).why(tab.id), "", "research 2 on day 724 is unlocked, like the tile");
  research[619] = 1;
  assert.equal(api(c).why(tab.id), "research");
  research[619] = 2;
  w.gv.DayTotal = 723;
  assert.equal(api(c).why(tab.id), "type");
}

// 25. New game: DeviceTypeCreatingNow still holds the game's start value "TV" with nothing in
// development (boss office, no release pending). A phone made now starts at once, not queued.
{
  const w = world({ gv: busyGv({ DeviceTypeCreatingNow: "TV", OfficeType: "BOSS", LastClass: "GAMEPLAY" }), layout: "BOSS OFFICE" }), c = context(w);
  ticks(c, 2);
  Object.assign(w.gv, { DeviceType: "SMARTPHONE", class: "SMARTPHONE NAME" });
  enter(w, c, "SMARTPHONE NAME");
  assert.equal(api(c).capturing(), false, "a stale TV type does not make a new game busy");
  Object.assign(w.gv, { DevicesCount: 1, DeviceCountCreatingNow: 1, DeviceName: "Arc", LastClass: "EDITOR PRICE PAGE", class: "LOADING EDITOR" });
  enter(w, c, "LOADING EDITOR");
  assert.equal(w.gv.DeviceType, "SMARTPHONE", "the game's own AddToArray runs");
  assert.equal(api(c).state().items.length, 0, "nothing queued");
}
{
  // A real TV still counts: in its work room, seen from the boss office (rooms stand-in),
  // and after delivery while its REVIEWS wait in the assistant.
  const tv = { DeviceTypeCreatingNow: "TV", DeviceType: "TV", DeviceName: "Vue" };
  for (const k of ["room", "viewed", "release"]) {
    const w = world({ gv: busyGv(Object.assign({}, tv, { OfficeType: k === "room" ? "DESIGNER" : "BOSS" })), layout: k === "room" ? "DESIGNER OFFICE" : "BOSS OFFICE" });
    const c = context(w);
    if (k === "viewed") c._dtRooms = { real: () => "DESIGNER", view: () => ({ room: "BOSS", real: "DESIGNER", layout: "BOSS OFFICE" }) };
    if (k === "release") {
      w.arrays.ArrayGameAssistant = new Arr(1, 1, 1);
      w.arrays.ArrayGameAssistant.setAt("REVIEWS", 0, 0, 0);
    }
    createWhileBusy(w, c, { count: 1 });
    flush(w);
    assert.equal(api(c).state().items.length, 1, "a phone made beside a real TV (" + k + ") is queued");
  }
}

// Cog pressed in a room only viewed while the live device is in its boss-office stage (release): rooms.js
// takes the player to the boss office for the game's picker. The office snapshot must stay the viewed
// room's, so naming (queued) and backing out both end in that room, not the boss office.
for (const abandon of [false, true]) {
  const w = world({ gv: busyGv({ OfficeType: "BOSS", BubblesDesign: 0 }), layout: "ENGINEER OFFICE 3" }), c = context(w);
  const view = { room: "ENGINEER", real: "BOSS", layout: "ENGINEER OFFICE 3" };
  const rooms = { v: view, from: null, resumed: [] };
  c._dtRooms = { real: () => "BOSS", view: () => rooms.v, pickFrom: () => rooms.from, resume: (v) => { rooms.resumed.push(v.room); rooms.v = v; } };
  // Release stage: its REVIEWS wait in the assistant, which is what makes the boss office busy.
  w.arrays.ArrayGameAssistant = new Arr(1, 1, 1);
  w.arrays.ArrayGameAssistant.setAt("REVIEWS", 0, 0, 0);
  ticks(c, 1);
  // _dtrOnPress: remember the room, drop the view, go to the boss office; the picker opens a moment later.
  rooms.from = "ENGINEER";
  rooms.v = null;
  enter(w, c, "BOSS OFFICE");
  ticks(c, 2);
  w.gv.CreateDevicesUI = "ON";
  w.calls.layouts.length = 0;
  createWhileBusy(w, c, { count: 1, abandon });
  if (abandon) {
    w.gv.class = "GAMEPLAY";
    enter(w, c, "BOSS OFFICE"); // the game's own way back from the name screen
    flush(w);
    assert.equal(api(c).state().items.length, 0, "backed out: nothing queued");
  } else {
    assert.equal(api(c).state().items.length, 1, "named: queued");
  }
  assert.equal(w.calls.layouts[w.calls.layouts.length - 1], "ENGINEER OFFICE 3", "ends in the room the cog was pressed in");
  assert.ok(rooms.resumed.length >= 1 && rooms.resumed.every((r) => r === "ENGINEER"), "the room is viewed again");
  assert.equal(rooms.v && rooms.v.room, "ENGINEER");
  assert.equal(w.gv.DeviceTypeCreatingNow, "LAPTOPS", "the released device is untouched");
}

// The busy-office snapshot is re-taken every tick: while only the calendar and
// economy move it keeps the same copy (no garbage 4 times a second), and any other
// change gives a new copy, leaving the one a capture may hold untouched.
{
  const w = world(), c = context(w);
  ticks(c, 1);
  const first = c._dtqBase.vars;
  assert.equal(first.BubblesDesign, 37);
  Object.assign(w.gv, { DayTotal: 3001, Budget: 4.5e6, GameplayPause: 1 });
  ticks(c, 1);
  assert.equal(c._dtqBase.vars, first, "only live values moved: same copy");
  assert.equal(first.DayTotal, 3001, "live values refreshed in place");
  assert.equal(first.Budget, 4.5e6);
  w.gv.BubblesDesign = 38;
  ticks(c, 1);
  const second = c._dtqBase.vars;
  assert.notEqual(second, first, "a work value changed: new copy");
  assert.equal(second.BubblesDesign, 38);
  assert.equal(first.BubblesDesign, 37, "the earlier copy is not rewritten");
  w.gv.NewVar = "x";
  ticks(c, 1);
  assert.notEqual(c._dtqBase.vars, second, "a var added: new copy");
  assert.equal(c._dtqBase.vars.NewVar, "x");
  const third = c._dtqBase.vars;
  delete w.gv.NewVar;
  ticks(c, 1);
  assert.notEqual(c._dtqBase.vars, third, "a var gone: new copy");
  assert.equal("NewVar" in c._dtqBase.vars, false);
  w.gv.Hook = { a: 1 };
  ticks(c, 1);
  assert.equal("Hook" in c._dtqBase.vars, false, "objects are still left out");
  const kept = c._dtqBase.vars;
  ticks(c, 1);
  assert.equal(c._dtqBase.vars, kept, "an object var alone does not force a copy");
  assert.deepEqual(Object.assign({}, kept), Object.fromEntries(Object.entries(w.gv).filter(([, v]) => typeof v !== "object")),
    "the kept copy equals a fresh one");
}

// review-1: the + of a room only viewed (Programming, Design live) opens the picker from rooms.js
// (pickFrom), not the queue's own +. Its OS, CPU and software tiles must be handled as a busy pick
// too: queued (or software turned back) and back in the viewed room, the laptop untouched.
function roomPick(w, c) {
  Object.assign(w.gv, { OfficeType: "BOSS" });
  w.layout.name = "PROGRAMMER OFFICE 2";
  const rooms = { v: { room: "PROGRAMMER", real: "DESIGNER", layout: "PROGRAMMER OFFICE 2" }, from: null, resumed: [] };
  c._dtRooms = { real: () => (rooms.v ? rooms.v.real : String(w.gv.OfficeType)), view: () => rooms.v, pickFrom: () => rooms.from,
    resume: (v) => { rooms.resumed.push(v.room); rooms.v = v; w.gv.OfficeType = "BOSS"; } };
  // _dtrOnPress: remember the room, view the boss office (stand-in BOSS), open the game's picker there.
  rooms.open = (w2, c2) => {
    ticks(c2, 1);
    // rooms.js _dtrOnLayoutStart (wired after the queue): any other layout drops the view, real office back.
    if (!rooms.wired) w2.handlers.beforeanylayoutstart.push((e) => {
      if (rooms.v && e.layout.name !== rooms.v.layout) { w2.gv.OfficeType = rooms.v.real; rooms.v = null; }
    });
    rooms.wired = true;
    rooms.from = "PROGRAMMER";
    rooms.v = { room: "BOSS", real: "DESIGNER", layout: "BOSS OFFICE" };
    enter(w2, c2, "BOSS OFFICE");
    w2.gv.CreateDevicesUI = "ON";
    ticks(c2, 2);
    w2.gv.CreateDevicesUI = "OFF"; // tile click
    w2.calls.layouts.length = 0;
  };
  return rooms;
}
{
  const { w, c } = osWorld(false);
  const rooms = roomPick(w, c);
  queueOs(w, c, "RoomOS", rooms.open);
  assert.equal(api(c).state().items.length, 1, "viewed-room +: OS queued");
  assert.equal(w.gv.DeviceTypeCreatingNow, "LAPTOPS", "viewed-room +: laptop keeps the slot");
  assert.equal(w.calls.layouts.at(-1), "PROGRAMMER OFFICE 2", "viewed-room +: back in the viewed room");
  assert.deepEqual([rooms.v && rooms.v.room, w.gv.OfficeType], ["PROGRAMMER", "BOSS"], "viewed again, not live");
}
// Esc out of the OS screens: the game goes to the boss office (rooms.js drops the view there), the queue
// moves on to the viewed room, which must come back viewed (not with Design's controls live in it).
{
  const { w, c } = osWorld(false);
  const rooms = roomPick(w, c);
  rooms.open(w, c);
  Object.assign(w.gv, { class: "MY OS MENU", LastClass: "GAMEPLAY" });
  enter(w, c, "MY OS MENU");
  assert.equal(api(c).capturing(), true);
  w.gv.class = "GAMEPLAY";
  enter(w, c, "BOSS OFFICE");
  flush(w);
  assert.equal(api(c).capturing(), false);
  assert.equal(w.calls.layouts.at(-1), "PROGRAMMER OFFICE 2");
  assert.deepEqual([rooms.v && rooms.v.room, rooms.v && rooms.v.real, w.gv.OfficeType], ["PROGRAMMER", "DESIGNER", "BOSS"],
    "OS Esc: the room is viewed again");
  assert.equal(w.gv.DeviceTypeCreatingNow, "LAPTOPS");
}
{
  const { w, c, a } = cpuWorld();
  const rooms = roomPick(w, c);
  queueCpu(w, c, rooms.open);
  assert.equal(api(c).state().items.length, 1, "viewed-room +: CPU queued");
  assert.equal(a.width, 1, "viewed-room +: no CPU record is left");
  assert.equal(w.gv.DeviceTypeCreatingNow, "LAPTOPS");
  assert.equal(w.calls.layouts.at(-1), "PROGRAMMER OFFICE 2");
}
// ver3 r1: on a slow frame (1-2 fps, a window resize) rooms.js settles the view 2 s after the finish put it
// back, CPU LOADING still on screen: the real office came back and the viewed room then started as if live
// (the laptop moved into it). The move back puts the view back again.
{
  const { w, c } = cpuWorld();
  const rooms = roomPick(w, c);
  rooms.open(w, c);
  w.gv.class = "CPU EDITOR MENU";
  enter(w, c, "CPU EDITOR MENU");
  Object.assign(w.gv, { DeviceType: "SMARTPHONE", DeviceName: "Qcpu 1", SeriesCreatedNew: true, SeriesName: "Qseries",
    SeriesID: 0, MyCPU_Style: 4, ProcessorRefreshRateID: 7, DevicePrice: 50, DeviceCostPrice: 20 });
  w.gv.class = "CPU LOADING";
  enter(w, c, "CPU LOADING", () => gameCpuAdd(w));
  assert.deepEqual([rooms.v && rooms.v.room, w.gv.OfficeType], ["PROGRAMMER", "BOSS"], "finish: viewed again");
  // _dtrSettle before the 300 ms move: CPU LOADING is no room, so the real office is restored and the view dropped.
  w.gv.OfficeType = rooms.v.real;
  rooms.v = null;
  let at = null;
  const go = w.rt.goToLayout;
  w.rt.goToLayout = (n) => { at = [n, rooms.v && rooms.v.room, w.gv.OfficeType]; go.call(w.rt, n); };
  flush(w);
  assert.deepEqual(at, ["PROGRAMMER OFFICE 2", "PROGRAMMER", "BOSS"], "slow frame: the room is viewed again at the move");
  assert.equal(api(c).state().items.length, 1);
  assert.equal(w.gv.DeviceTypeCreatingNow, "LAPTOPS");
}
{
  const w = world(), c = context(w);
  const rooms = roomPick(w, c);
  rooms.open(w, c);
  Object.assign(w.gv, { class: "MY SOFT MENU", LastClass: "GAMEPLAY" });
  enter(w, c, "MY SOFT MENU");
  flush(w);
  assert.equal(w.calls.layouts.at(-1), "PROGRAMMER OFFICE 2", "viewed-room +: software turned back to the room");
  assert.equal(w.calls.toasts.at(-1), "Software can't be added to the build queue yet.");
  assert.deepEqual([rooms.v && rooms.v.room, w.gv.OfficeType], ["PROGRAMMER", "BOSS"]);
}
// Idle (nothing in development): a viewed-room pick is the game's own create, untouched.
{
  const w = world({ gv: busyGv({ DeviceTypeCreatingNow: "", OfficeType: "BOSS" }), layout: "PROGRAMMER OFFICE 2" }), c = context(w);
  c._dtRooms = { real: () => "BOSS", view: () => null, pickFrom: () => "PROGRAMMER", resume: () => {} };
  ticks(c, 1);
  Object.assign(w.gv, { class: "MY SOFT MENU", LastClass: "GAMEPLAY" });
  enter(w, c, "MY SOFT MENU");
  flush(w);
  assert.deepEqual(w.calls.layouts, [], "idle: software opens as in the game");
  assert.deepEqual(w.calls.toasts, []);
  Object.assign(w.gv, { class: "MY OS MENU" });
  enter(w, c, "MY OS MENU");
  assert.equal(api(c).capturing(), false, "idle: OS not captured");
}

console.log("queue runtime: all checks passed");
