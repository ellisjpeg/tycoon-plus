// Behaviour test for event.js (launch events) on top of launch.js, against a
// small mock of the game runtime and the presentation code it reaches into.
// Usage: node test_event_runtime.js <launch.js> <event.js>
const assert = require("node:assert/strict");
const J = (v) => JSON.parse(JSON.stringify(v));
const fs = require("node:fs");
const vm = require("node:vm");

const SRC = fs.readFileSync(process.argv[2], "utf8") + "\n;\n" + fs.readFileSync(process.argv[3], "utf8");

function newArray(width, height, depth) {
  const cells = new Map();
  return {
    width, height, depth: depth || 1,
    getAt(x, y, z) {
      const k = x + "," + y + "," + (z || 0);
      return cells.has(k) ? cells.get(k) : 0;
    },
    setAt(v, x, y, z) {
      cells.set(x + "," + y + "," + (z || 0), v);
    },
    setSize(w, h, d) {
      this.width = w;
      this.height = h;
      this.depth = d;
    },
  };
}
// A device line x with n variants, ID id, name, release day.
function device(a, x, n, id, name, release) {
  for (let y = 0; y < 3; y++) {
    a.setAt(y < n ? 1 : -1, x, y, 0);
    a.setAt(release, x, y, 7);
    a.setAt(y < n ? name + (y ? " " + y : "") : "-1", x, y, 8);
    a.setAt(id * 10 + y, x, y, 10);
  }
}

function world(opts) {
  opts = opts || {};
  const gv = Object.assign({ Day: 28, Month: 2, Year: 2015, DayTotal: 1000, LanguageChoose: 0, SaveSlot: 0, CompanyName: "Ember",
    Budget: 9e6, Assistant: "OFF", class: "GAMEPLAY", DeviceTypeCreatingNow: "" }, opts.gv || {});
  const arrays = Object.assign({
    ArraySaves: newArray(3, 200, 1), ArraySmartphones: newArray(3, 3, 12), ArrayLaptops: newArray(3, 3, 12),
    ArrayMyResearch: newArray(700, 1, 1), ArrayGameAssistant: newArray(0, 1, 2),
  }, opts.arrays || {});
  arrays.ArrayMyResearch.setAt(2, 211, 0, 0);
  arrays.ArrayMyResearch.setAt(2, 213, 0, 0);
  const objects = {};
  for (const n of Object.keys(arrays)) objects[n] = { getFirstInstance: () => arrays[n] };
  const calls = { register: [], social: [], toasts: [], sales: [], modals: [], layouts: [], applied: [], news: [], functions: [] };
  const listeners = [];
  const el = (tag, cls, parent, text) => {
    const n = { tag, cls: cls || "", textContent: text === undefined ? "" : String(text), style: {}, children: [], listeners: {} };
    n.appendChild = (c) => (n.children.push(c), (c.parentNode = n), c);
    n.addEventListener = (t, f) => (n.listeners[t] = f);
    n.classList = { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c, on) { if (on === undefined ? !this._s.has(c) : on) this._s.add(c); else this._s.delete(c); } };
    n.remove = () => { const p = n.parentNode; if (p) p.children = p.children.filter((c) => c !== n); n.parentNode = null; };
    Object.defineProperty(n, "innerHTML", { set() { n.children = []; }, get() { return ""; } });
    if (parent) parent.appendChild(n);
    return n;
  };
  const runtime = {
    globalVars: gv, objects, layout: { name: "BOSS OFFICE" },
    addEventListener(t, f) { listeners.push([t, f]); },
    goToLayout(name) { calls.layouts.push(name); },
    callFunction(name) { calls.functions.push(name); },
  };
  let last = null;
  const ctx = {
    console: { warn() {}, log() {} }, Math, Number, String, Map, Set, JSON, Object, Array, Error, Infinity,
    setTimeout(fn) { ctx._timeouts.push(fn); return 1; }, _timeouts: [],
    setInterval(fn) { ctx._interval = fn; return 2; }, clearInterval() {}, clearTimeout() {},
    runtime,
    registerDeviceSalesForArray(arr) { calls.register.push(arr); },
    socialQueueDeviceReleased(rt, cat, y, x) { calls.social.push({ cat, x }); },
    _OPTS: { arrayX: 0 }, _OPTS2: { arrayX: 0 }, _OPTS3: { arrayX: 0 }, _OPTS4: { arrayX: 0 }, _OPTS5: { arrayX: 0 },
    _OPTS6: { arrayX: 0 }, _OPTS7: { arrayX: 0 }, _OPTS8: { arrayX: 0 }, _OPTS9: { arrayX: 0 }, _OPTS10: { arrayX: 0 },
    _findDevSlotX2() { return -1; },
    getLastPresentationResults() { return last; },
    clearPendingPresentationPopularity() { last = null; },
    presentationApplyOnRelease(arr) { calls.applied.push(arr); return 0; },
    showOfficeNews() { calls.news.push([].slice.call(arguments)); return true; },
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  const layer = el("div", "dt-layer");
  ctx._dtUi = {
    num(k, d) { const v = Number(gv[k]); return Number.isFinite(v) ? v : d; },
    gv(k, d) { return k in gv ? gv[k] : d; },
    t(e, vars) { let s = e.en; for (const k in vars || {}) s = s.split("{" + k + "}").join(String(vars[k])); return s; },
    el,
    button(parent, label, cls, onClick) { const b = el("button", cls, parent, label); b.onClick = onClick; return b; },
    onOffice() { return runtime.layout.name === "BOSS OFFICE"; },
    layoutName() { return runtime.layout.name; },
    modal(o) { calls.modals.push(o); ctx._open = o; const body = el("div"); o.build && o.build(body, () => {}); o._body = body; return o; },
    close() { ctx._open = null; }, isOpen() { return !!ctx._open; },
    toast(t, k, o) { calls.toasts.push(t); if (o && o.sales) calls.sales.push(t); }, chip() {}, removeChip() {},
    ensure() { return layer; },
  };
  const press = (label) => {
    const o = ctx._open;
    const b = o.buttons.find((x) => x.label === label);
    assert.ok(b, "button " + label);
    ctx._open = null;
    if (b.onClick) b.onClick();
  };
  const find = (n, text) => {
    if (String(n.textContent).indexOf(text) >= 0 && (n.listeners.click || n.onClick)) return n;
    for (const c of n.children || []) { const r = find(c, text); if (r) return r; }
    const lab = (n.children || []).find((c) => String(c.textContent).indexOf(text) >= 0);
    return lab && n.listeners.click ? n : null;
  };
  const setLast = (r) => (last = r);
  const layout = (name) => { runtime.layout.name = name; for (const [t, f] of listeners) if (t === "afteranylayoutstart") f(); };
  return { ctx, gv, arrays, calls, press, find, setLast, layout };
}
const api = (w) => w.ctx._dtEventApi;
const bodyText = (n) => [n.textContent].concat((n.children || []).map(bodyText)).join(" ").replace(/\s+/g, " ");
const row = (w) => w.arrays.ArraySaves.getAt(0, 153, 0);

// 1. Save/load: nothing written until an event exists; old saves (empty row,
// other company, other version, junk) load as no events; a round trip keeps it.
{
  const w = world();
  w.ctx._interval();
  assert.equal(row(w), 0, "untouched save keeps row 153 as it was");
  assert.deepEqual(JSON.parse(JSON.stringify(api(w).parse(0, "Ember"))), { events: [] });
  assert.equal(api(w).parse('{"v":1,"company":"Other","events":[{"day":5}]}', "Ember").events.length, 0);
  assert.equal(api(w).parse('{"v":2,"company":"Ember","events":[{"day":5}]}', "Ember").events.length, 0);
  assert.equal(api(w).parse("{nope", "Ember").events.length, 0);
  api(w).create(0);
  w.press("Create");
  const saved = JSON.parse(row(w));
  assert.equal(saved.company, "Ember");
  assert.equal(saved.events[0].day, 1030, "default day a month ahead");
  assert.equal(saved.events[0].name, "", "name optional, shown as Launch event");
  const again = api(w).parse(row(w), "Ember");
  assert.equal(again.events[0].day, 1030);
}

// 2. Date pick: ticking "Launch at <event>" gives the device the event day and
// membership; unticking plans a normal date and leaves the event.
{
  const w = world();
  w.ctx._interval();
  api(w).create(0);
  w.press("Create");
  device(w.arrays.ArraySmartphones, 0, 2, 7, "Ember 7", 1000);
  w.ctx._dtLaunchAsk("ArraySmartphones", "SMARTPHONES", [0, 1]);
  const link = w.find(w.ctx._open._body, "Add to a launch event instead");
  assert.ok(link, "the launch day offers a launch event");
  link.listeners.click({ stopPropagation() {} });
  assert.match(bodyText(w.ctx._open._body), /30\.03\.2015.*Launch event · in 30 days/, "event mode shows its day and name");
  w.press("Plan launch");
  assert.equal(w.arrays.ArraySmartphones.getAt(0, 0, 7), 1030);
  assert.equal(w.arrays.ArraySmartphones.getAt(0, 1, 7), 1030);
  assert.deepEqual(JSON.parse(row(w)).events[0].keys, ["ArraySmartphones#70"]);
  assert.equal(w.calls.register.length, 0, "not launched yet");
  // Change it from the page: pick a day instead and save: leaves the event.
  const g = w.ctx._dtLaunchShelf()[0];
  w.ctx._dtLaunchChange(g);
  assert.match(bodyText(w.ctx._open._body), /Launch event · in 30 days/, "opens on its event");
  w.find(w.ctx._open._body, "Pick a day instead").listeners.click({ stopPropagation() {} });
  w.press("Save");
  assert.deepEqual(JSON.parse(row(w)).events[0].keys, []);
  assert.equal(w.arrays.ArraySmartphones.getAt(0, 0, 7), 1030, "kept the chosen day, no longer on the event");
}

// 3. Grouping: shelf items on an event (and its day) go under it; the rest stay apart.
{
  const w = world();
  const ev = { name: "Fall", day: 1050, keys: ["A#1", "B#2"], names: {} };
  const items = [{ k: "A#1", day: 1050 }, { k: "B#2", day: 1060 }, { k: "C#3", day: 1050 }];
  const r = api(w).group(items, [ev], (i) => i.k);
  assert.deepEqual(J(r.groups[0].items.map((i) => i.k)), ["A#1"]);
  assert.deepEqual(J(r.rest.map((i) => i.k)), ["B#2", "C#3"], "a moved date or non-member is not grouped");
}

// 4. Cost rule matches the game: the presentation itself takes no money for
// 1, 2 or 3 devices; the offer only needs $5M in the bank.
{
  const w = world();
  assert.equal(api(w).cost([1]), 0);
  assert.equal(api(w).cost([1, 2]), 0);
  assert.equal(api(w).cost([1, 2, 3]), 0);
}

// 5. Event day: member devices are not auto-launched by the launch tick; one
// offer appears; Skip launches them all that day and the event is gone.
function dayWorld() {
  const w = world();
  w.ctx._interval();
  api(w).create(0);
  w.press("Create");
  device(w.arrays.ArraySmartphones, 0, 2, 7, "Ember 7", 1030);
  device(w.arrays.ArrayLaptops, 1, 1, 3, "Book 3", 1030);
  device(w.arrays.ArrayLaptops, 0, 1, 4, "Book 4", 1030);
  const st = api(w).state();
  st.events[0].keys = ["ArraySmartphones#70", "ArrayLaptops#30"];
  w.gv.DayTotal = 1029;
  w.ctx._interval();
  w.gv.DayTotal = 1030;
  w.ctx._interval();
  return w;
}
{
  const w = dayWorld();
  assert.deepEqual(w.calls.register, ["ArrayLaptops"], "only the non-member (Book 4) launched by the tick");
  assert.ok(w.ctx._open.offer, "the launch-day offer");
  assert.equal(w.ctx._open.title, "Launch event");
  w.press("No");
  assert.deepEqual(w.calls.register.slice(1).sort(), ["ArrayLaptops", "ArraySmartphones"]);
  assert.equal(JSON.parse(row(w)).events.length, 0);
}

// 6. Hold presentation: each device's own slide show in turn (its line picked
// for the results and slides), then one result screen with the totals; each
// device launches as its show ends; everything is put back afterwards.
{
  const w = dayWorld();
  w.gv.DeviceTypeCreatingNow = "TV";
  w.press("Yes");
  assert.equal(w.ctx._dtEvStarting, true, "Yes marks the show as starting at once (the pipeline waits on it)");
  w.ctx._interval(); // a launch tick in the gap before the show starts
  assert.equal(w.calls.modals.filter((m) => m.offer).length, 1, "panel not reopened while the show starts");
  w.ctx._timeouts.pop()();
  assert.ok(w.ctx._dtEvRun && !w.ctx._dtEvStarting, "then the show runs");
  assert.deepEqual(w.calls.layouts, ["PRESENTATION SMARTPHONE V2"]);
  assert.equal(w.gv.PresentationDeviceCountMax, 2, "both variants of the phone");
  assert.equal(w.ctx._findDevSlotX2(w.arrays.ArraySmartphones), 0);
  w.layout("PRESENTATION SMARTPHONE V2");
  w.setLast({ visitors: 100, online: 10, newFans: 5, popularity: 20 });
  w.layout("PRESENTATION FINISH");
  assert.deepEqual(w.calls.layouts, ["PRESENTATION SMARTPHONE V2", "PRESENTATION LAPTOP V2"]);
  assert.equal(w.ctx._OPTS3.arrayX, 1, "laptop slides read line 1 (Book 3)");
  assert.equal(w.ctx._findDevSlotX2(w.arrays.ArrayLaptops), 1);
  assert.equal(w.gv.PresentationDeviceCountMax, 1);
  w.layout("PRESENTATION LAPTOP V2");
  w.setLast({ visitors: 50, online: 5, newFans: 3, popularity: 10 });
  w.layout("PRESENTATION FINISH");
  assert.equal(w.gv.Presentation_TotalVisitors, 150);
  assert.equal(w.gv.Presentation_NewFans, 8);
  assert.equal(w.gv.Presentation_Popularity, 15);
  assert.deepEqual(w.calls.register.slice(1), ["ArraySmartphones", "ArrayLaptops"]);
  assert.equal(w.gv.DeviceTypeCreatingNow, "TV", "device in development restored");
  assert.equal(w.ctx._OPTS3.arrayX, 0);
  assert.equal(w.ctx._findDevSlotX2(w.arrays.ArrayLaptops), -1, "game's own pick restored");
  assert.equal(JSON.parse(row(w)).events.length, 0);
}

// 6b. Hand-over between devices: a black cover goes up as the in-between
// FINISH starts (inside its layout-start event, so before it is drawn) and
// fades out as the next device's slides start; the final result screen is
// not covered; totals and launches are the same as in 6. Leaving the show
// mid hand-over takes the cover down too.
{
  const w = dayWorld();
  w.ctx.document = {};
  w.gv.DeviceTypeCreatingNow = "TV";
  w.press("Yes");
  w.ctx._timeouts.pop()();
  w.layout("PRESENTATION SMARTPHONE V2");
  assert.equal(w.ctx._dtEvCover, null, "no cover over the first slides");
  w.setLast({ visitors: 100, online: 10, newFans: 5, popularity: 20 });
  w.layout("PRESENTATION FINISH");
  const c = w.ctx._dtEvCover;
  assert.ok(c, "cover made at the in-between FINISH");
  assert.equal(c.style.opacity, "1");
  assert.equal(c.style.display, "block");
  assert.equal(c.style.position, "fixed");
  assert.equal(c.style.pointerEvents, "none", "clicks reach the slides");
  assert.equal(c.style.transition, "none", "up at once, no FINISH frame shows through");
  assert.ok(w.ctx._dtUi.ensure().children.indexOf(c) >= 0, "inside the mods layer, above the canvas");
  w.layout("PRESENTATION LAPTOP V2");
  assert.equal(c.style.opacity, "0", "fades out over the next slides");
  assert.match(c.style.transition, /opacity/);
  w.ctx._timeouts.pop()();
  assert.equal(c.style.display, "none");
  w.setLast({ visitors: 50, online: 5, newFans: 3, popularity: 10 });
  w.layout("PRESENTATION FINISH");
  assert.equal(c.style.display, "none", "final result screen not covered");
  assert.equal(w.gv.Presentation_TotalVisitors, 150);
  assert.equal(w.gv.Presentation_OnlineViewers, 15);
  assert.equal(w.gv.Presentation_NewFans, 8);
  assert.equal(w.gv.Presentation_Popularity, 15);
  assert.deepEqual(w.calls.register.slice(1), ["ArraySmartphones", "ArrayLaptops"]);
  assert.deepEqual(w.calls.layouts, ["PRESENTATION SMARTPHONE V2", "PRESENTATION LAPTOP V2"]);
  assert.equal(JSON.parse(row(w)).events.length, 0);
}
{
  const w = dayWorld();
  w.ctx.document = {};
  w.press("Yes");
  w.ctx._timeouts.pop()();
  w.layout("PRESENTATION SMARTPHONE V2");
  w.layout("PRESENTATION FINISH");
  assert.equal(w.ctx._dtEvCover.style.opacity, "1");
  w.layout("BOSS OFFICE");
  assert.equal(w.ctx._dtEvCover.style.opacity, "0", "cover goes when the show is left mid hand-over");
  assert.equal(api(w).run(), null);
}

// 7. An event with no devices just passes; a device on an event skips the
// game's early presentation offer.
{
  const w = world();
  w.ctx._interval();
  api(w).create(0);
  w.press("Create");
  device(w.arrays.ArraySmartphones, 0, 1, 9, "Ember 9", -1);
  w.gv.DeviceTypeCreatingNow = "SMARTPHONES";
  api(w).state().events[0].keys = ["ArraySmartphones#90"];
  const q = w.arrays.ArrayGameAssistant;
  q.setSize(2, 1, 2);
  q.setAt("BATCH COMPANY", 0, 0, 0);
  q.setAt("PRESENTATION", 1, 0, 0);
  w.ctx._interval();
  assert.equal(q.width, 1);
  assert.equal(q.getAt(0, 0, 0), "BATCH COMPANY");
  api(w).state().events[0].keys = [];
  w.gv.DayTotal = 1030;
  w.ctx._interval();
  assert.equal(JSON.parse(row(w)).events.length, 0);
  assert.equal(w.calls.modals.filter((m) => m.offer).length, 0);
}
// 8. A missed event day (game closed over it, or a save loaded after it)
// still offers the presentation on the first office tick and launches all.
{
  const w = world({ gv: { DayTotal: 1045 } });
  w.arrays.ArraySaves.setAt(JSON.stringify({ v: 1, company: "Ember", events: [{ name: "Fall", day: 1030, keys: ["ArraySmartphones#70", "ArrayLaptops#30"], names: {} }] }), 0, 153, 0);
  device(w.arrays.ArraySmartphones, 0, 2, 7, "Ember 7", 1030);
  device(w.arrays.ArrayLaptops, 0, 1, 3, "Book 3", 1030);
  w.runtime = w.ctx.runtime;
  w.ctx.runtime.layout.name = "MENU";
  w.ctx._interval();
  w.ctx.runtime.layout.name = "BOSS OFFICE";
  w.ctx._interval();
  assert.equal(w.ctx._open && w.ctx._open.title, "Fall", "late event still offered");
  assert.ok(w.ctx._open.offer);
  w.press("No");
  assert.deepEqual(w.calls.register.sort(), ["ArrayLaptops", "ArraySmartphones"]);
  assert.equal(JSON.parse(row(w)).events.length, 0, "event cleared, nothing stuck");
}

// 9. A member whose date was moved off the event day by another route is not
// held: it launches on its own day.
{
  const w = world();
  w.arrays.ArraySaves.setAt(JSON.stringify({ v: 1, company: "Ember", events: [{ name: "", day: 1030, keys: ["ArraySmartphones#70"], names: {} }] }), 0, 153, 0);
  device(w.arrays.ArraySmartphones, 0, 1, 7, "Ember 7", 1010);
  w.gv.DayTotal = 1009;
  w.ctx._interval();
  w.gv.DayTotal = 1010;
  w.ctx._interval();
  assert.deepEqual(w.calls.register, ["ArraySmartphones"]);
}

// 10. Leaving the combined show some other way launches the devices that had
// no turn yet and clears the event, so nothing is left waiting.
{
  const w = dayWorld();
  w.press("Yes");
  w.ctx._timeouts.pop()();
  w.layout("PRESENTATION SMARTPHONE V2");
  w.layout("BOSS OFFICE");
  assert.deepEqual(w.calls.register.slice(1).sort(), ["ArrayLaptops", "ArraySmartphones"]);
  assert.equal(JSON.parse(row(w)).events.length, 0);
  assert.equal(api(w).run(), null);
  assert.equal(w.ctx._findDevSlotX2(w.arrays.ArrayLaptops), -1, "game's own pick restored");
  w.ctx._interval();
  assert.equal(w.calls.modals.filter((m) => m.offer).length, 1, "not offered again");
}
// The event tick (which replaces the launch tick) installs the bankruptcy guard.
{
  const w = world();
  w.ctx.tickBankruptcyDay = () => true;
  w.ctx._interval();
  assert.equal(w.ctx.tickBankruptcyDay._dtLaunch, true, "bankruptcy guard installed by the event tick");
}
// 11. The game's early offer is held for every device and made on its launch day,
// through a hidden one-device event: "Launch today" and a planned day alike.
{
  const w = world();
  w.ctx._interval();
  device(w.arrays.ArraySmartphones, 0, 1, 9, "Ember 9", -1);
  w.gv.DeviceTypeCreatingNow = "SMARTPHONES";
  const q = w.arrays.ArrayGameAssistant;
  q.setSize(1, 1, 2);
  q.setAt("PRESENTATION", 0, 0, 0);
  w.ctx._interval();
  assert.equal(q.width, 0, "early offer held for a device on no event");
  // The game shows the card as the office opens, before the tick: held there too.
  q.setSize(2, 1, 2);
  q.setAt("PRESENTATION", 0, 0, 0);
  q.setAt("BATCH COMPANY", 1, 0, 0);
  Object.assign(w.gv, { Assistant: "ON", AssistantTheme: "PRESENTATION" });
  const shown = w.calls.news.length;
  w.ctx.showOfficeNews("text", "", 2, "Yes", "No", "Presentation");
  assert.equal(w.calls.news.length, shown, "the game's offer card is not shown");
  assert.equal(q.width, 1);
  assert.equal(q.getAt(0, 0, 0), "BATCH COMPANY", "the next card stays queued");
  w.ctx._timeouts.splice(0).forEach((f) => f());
  assert.equal(w.gv.Assistant, "OFF");
  assert.deepEqual(w.calls.functions.slice(-1), ["Assistant_OFF"]);
  w.gv.AssistantTheme = "BATCH COMPANY";
  w.ctx.showOfficeNews("text");
  assert.equal(w.calls.news.length, shown + 1, "other cards show as normal");
  w.gv.DeviceTypeCreatingNow = "";
  w.arrays.ArraySmartphones.setAt(1000, 0, 0, 7);
  api(w).ask("ArraySmartphones", "Smartphones", [0]);
  w.press("Launch today");
  assert.deepEqual(w.calls.register, [], "goes on sale through its launch day");
  assert.equal(api(w).state().events[0].solo, true);
  w.ctx._interval();
  assert.equal(w.ctx._open && w.ctx._open.title, "Launch day");
  assert.ok(w.ctx._open.offer && /Ember 9/.test(bodyText(w.ctx._open._body)), "the offer names the device");
  w.press("No");
  assert.deepEqual(w.calls.register, ["ArraySmartphones"]);
  assert.ok(w.calls.toasts.some((t) => /Ember 9/.test(t) && !/devices are on sale/.test(t)), "the single-device toast");
  assert.ok(w.calls.sales.some((t) => /Ember 9 is on sale from today/.test(t)), "the launch goes under the sales card");
  assert.equal(JSON.parse(row(w)).events.length, 0);
}
{
  const w = world();
  w.ctx._interval();
  device(w.arrays.ArraySmartphones, 0, 1, 9, "Ember 9", 1000);
  api(w).ask("ArraySmartphones", "Smartphones", [0]);
  w.press("Plan launch");
  assert.equal(w.arrays.ArraySmartphones.getAt(0, 0, 7), 1014);
  const evs = api(w).state().events;
  assert.equal(evs.length, 1);
  assert.equal(evs[0].solo, true);
  assert.equal(evs[0].day, 1014);
  assert.equal(api(w).parse(row(w), "Ember").events[0].solo, true, "kept in the save");
  // Another device's Launch Day panel does not offer the hidden event.
  device(w.arrays.ArrayLaptops, 0, 1, 3, "Book 3", 1000);
  api(w).ask("ArrayLaptops", "Laptops", [0]);
  assert.equal(w.find(w.ctx._open._body, "Pick a day instead"), null, "a solo day is not offered as an event");
  assert.doesNotMatch(bodyText(w.ctx._open._body), /Launch event/);
  assert.ok(w.find(w.ctx._open._body, "Add to a launch event instead"));
  w.ctx._open = null;
  w.gv.DayTotal = 1013;
  w.ctx._interval();
  assert.deepEqual(w.calls.register, []);
  w.gv.DayTotal = 1014;
  w.ctx._interval();
  assert.deepEqual(w.calls.register, [], "the daily launch leaves it to its day's offer");
  assert.equal(w.ctx._open && w.ctx._open.title, "Launch day");
  assert.ok(w.ctx._open.offer && /Ember 9/.test(bodyText(w.ctx._open._body)), "the offer names the device");
  w.press("Yes");
  w.ctx._timeouts.pop()();
  assert.equal(w.calls.layouts[w.calls.layouts.length - 1], "PRESENTATION SMARTPHONE V2");
  w.layout("PRESENTATION SMARTPHONE V2");
  w.layout("PRESENTATION FINISH");
  assert.deepEqual(w.calls.register, ["ArraySmartphones"]);
  assert.equal(JSON.parse(row(w)).events.length, 0);
}

// 10. New / Edit launch event: planned devices can be ticked in; moving the
// event moves them; unticking or deleting keeps their own day, solo.
{
  const w = world();
  w.ctx._interval();
  device(w.arrays.ArraySmartphones, 0, 1, 9, "Ember 9", 1010);
  device(w.arrays.ArrayLaptops, 0, 1, 3, "Book 3", 1020);
  api(w).create({});
  const tick = (label) => {
    const r = w.find(w.ctx._open._body, label);
    assert.ok(r, "device row " + label);
    r.listeners.click({ stopPropagation() {} });
  };
  assert.match(bodyText(w.ctx._open._body), /Ember 9 Planned for 10\.03\.2015/);
  tick("Ember 9");
  tick("Book 3");
  w.press("Create");
  const ev = api(w).state().events.find((e) => !e.solo);
  assert.equal(ev.day, 1030);
  assert.deepEqual(J(ev.keys).sort(), ["ArrayLaptops#30", "ArraySmartphones#90"]);
  assert.equal(w.arrays.ArraySmartphones.getAt(0, 0, 7), 1030, "ticked devices take the event day");
  assert.equal(w.arrays.ArrayLaptops.getAt(0, 0, 7), 1030);
  // Edit: a week later, Book 3 leaves.
  w.ctx._dtEvEdit(ev);
  w.find(w.ctx._open._body, "WEEK").listeners.click({ stopPropagation() {} }); // "‹ WEEK": a week earlier
  tick("Book 3");
  w.press("Save");
  const ev2 = api(w).state().events.find((e) => !e.solo);
  assert.equal(ev2.day, 1023);
  assert.deepEqual(J(ev2.keys), ["ArraySmartphones#90"]);
  assert.equal(w.arrays.ArraySmartphones.getAt(0, 0, 7), 1023, "members move with the event");
  assert.equal(w.arrays.ArrayLaptops.getAt(0, 0, 7), 1030, "a device taken off keeps its day");
  assert.ok(api(w).state().events.some((e) => e.solo && e.keys[0] === "ArrayLaptops#30"), "and launches on its own");
  // Delete: Ember 9 keeps 1023 as its own launch day.
  w.ctx._dtEvEdit(ev2);
  w.find(w.ctx._open._body, "Delete event").listeners.click({ stopPropagation() {} });
  assert.equal(api(w).state().events.filter((e) => !e.solo).length, 0);
  assert.equal(w.arrays.ArraySmartphones.getAt(0, 0, 7), 1023);
  assert.ok(api(w).state().events.some((e) => e.solo && e.day === 1023 && e.keys[0] === "ArraySmartphones#90"));
}

// 11. A finished device can join any upcoming event, including a later one
// created from its own launch question (it reopens on the new event).
{
  const w = world();
  w.ctx._interval();
  api(w).create(0);
  w.press("Create"); // "Launch event" on 1030
  device(w.arrays.ArraySmartphones, 0, 1, 7, "Ember 7", 1000);
  w.ctx._dtLaunchAsk("ArraySmartphones", "SMARTPHONES", [0]);
  w.find(w.ctx._open._body, "Add to a launch event instead").listeners.click({ stopPropagation() {} });
  w.find(w.ctx._open._body, "New launch event").listeners.click({ stopPropagation() {} });
  assert.equal(w.ctx._open.title, "New launch event");
  const taps = [];
  const all = (n) => { if (n.listeners && n.listeners.click && /WEEK/.test(bodyText(n))) taps.push(n); (n.children || []).forEach(all); };
  all(w.ctx._open._body);
  taps[taps.length - 1].listeners.click({ stopPropagation() {} }); // "WEEK ›": 1037
  w.press("Create");
  w.ctx._timeouts.pop()();
  assert.match(bodyText(w.ctx._open._body), /06\.04\.2015 Launch event · in 37 days/, "reopens on the new, later event");
  w.press("Plan launch");
  assert.equal(w.arrays.ArraySmartphones.getAt(0, 0, 7), 1037);
  const evs = api(w).state().events.filter((e) => !e.solo);
  assert.equal(evs.length, 2);
  assert.deepEqual(J(evs.find((e) => e.day === 1037).keys), ["ArraySmartphones#70"]);
  assert.deepEqual(J(evs.find((e) => e.day === 1030).keys), []);
  // And the arrows reach the other event too.
  device(w.arrays.ArrayLaptops, 0, 1, 3, "Book 3", 1000);
  w.ctx._dtLaunchAsk("ArrayLaptops", "LAPTOPS", [0]);
  w.find(w.ctx._open._body, "Add to a launch event instead").listeners.click({ stopPropagation() {} });
  assert.match(bodyText(w.ctx._open._body), /30\.03\.2015/);
  w.find(w.ctx._open._body, "EVENT").listeners.click({ stopPropagation() {} });
  assert.match(bodyText(w.ctx._open._body), /06\.04\.2015/);
}
// 12. Cancelling "New launch event" from the launch question goes back to the day the player
// had picked (not a fresh "in 14 days"); a one-device event says "1 device is on sale".
{
  const w = world();
  w.ctx._interval();
  device(w.arrays.ArraySmartphones, 0, 1, 7, "Ember 7", 1000);
  w.ctx._dtLaunchAsk("ArraySmartphones", "SMARTPHONES", [0]);
  w.find(w.ctx._open._body, "1 month").listeners.click({ stopPropagation() {} });
  const picked = bodyText(w.ctx._open._body).match(/\d\d\.\d\d\.\d{4}/)[0];
  assert.notEqual(picked, "14.03.2015");
  w.find(w.ctx._open._body, "Add to a launch event instead").listeners.click({ stopPropagation() {} });
  assert.equal(w.ctx._open.title, "New launch event");
  w.press("Cancel");
  w.ctx._timeouts.pop()();
  assert.ok(bodyText(w.ctx._open._body).indexOf(picked) >= 0, "the picked day is kept");
  w.ctx._dtUi.close(true);
  w.calls.toasts.length = 0;
  w.ctx._dtEvFinish({ solo: false, name: "Spring", keys: [] }, [{ name: "Ember 7" }]);
  assert.ok(w.calls.toasts.some((s) => /Spring: 1 device is on sale from today!/.test(s)), w.calls.toasts.join(" | "));
  assert.ok(w.calls.sales.some((s) => /Spring: 1 device is on sale from today!/.test(s)), "under the sales card");
  // Russian: the names in the one-presentation offer are joined with "и", not "&".
  assert.equal(w.ctx._DT_EV_UI.and.ru, " и ");
  assert.equal(w.ctx._dtEvU("and"), " & ");
}
console.log("event runtime: ok");
