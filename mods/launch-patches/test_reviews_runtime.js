// Behaviour test for reviews.js: the launch question comes before the reviews,
// a planned launch gets the game's review screens on its day with the scores
// from the day the device was finished. Mocks the bits of the game it uses.
// Usage: node test_reviews_runtime.js <launch.js> <event.js> [reviews.js]
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const SRC = process.argv.slice(2).map((p) => fs.readFileSync(p, "utf8")).join("\n;\n");
// The real build queue (test 8): reads.js + queue.js, next to this mod.
const QUEUE_SRC = ["reads.js", "queue.js"].map((f) => fs.readFileSync(require("node:path").join(__dirname, "..", "queue-patches", f), "utf8")).join("\n;\n");

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
// A finished, not yet reviewed device on line x: n variants, RELEASE -1.
function device(a, x, n, id, name, release) {
  for (let y = 0; y < 3; y++) {
    a.setAt(y < n ? 1 : -1, x, y, 0);
    a.setAt(0, x, y, 2);
    a.setAt(release === undefined ? -1 : release, x, y, 7);
    a.setAt(y < n ? name + (y ? " " + y : "") : "-1", x, y, 8);
    a.setAt(id * 10 + y, x, y, 10);
  }
}

function world(saves) {
  const gv = { Day: 28, Month: 2, Year: 2015, DayTotal: 1000, LanguageChoose: 0, SaveSlot: 0, CompanyName: "Ember",
    Budget: 1e6, Assistant: "OFF", AssistantTheme: "", class: "GAMEPLAY", DeviceTypeCreatingNow: "", OfficeType: "BOSS",
    GameplayPause: 0, Tech: 5, DeviceName: "", ReviewDeviceNowID: 0, ReviewRating_1: 0, ReviewRating_2: 0, ReviewRating_3: 0, ReviewRating_4: 0 };
  const arrays = {
    ArraySaves: saves || newArray(3, 200, 1), ArraySmartphones: newArray(3, 3, 12), ArrayLaptops: newArray(3, 3, 12),
    ArrayGamepads: newArray(1, 3, 12), ArrayGameAssistant: newArray(0, 2, 1), ArrayMyResearch: newArray(700, 1, 1),
    ArrayReviews_Text: newArray(4, 2, 1), ArrayReviews_Temp: newArray(4, 4, 1), ArrayEditorDesign_Smartphone: newArray(5, 2, 1),
  };
  arrays.ArrayGamepads.setAt(-1, 0, 0, 0);
  const objects = {};
  for (const n of Object.keys(arrays)) objects[n] = { getFirstInstance: () => arrays[n] };
  const calls = { register: [], toasts: [], sales: [], modals: [], cards: 0, reviewScreens: 0, rolls: 0 };
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
  const layout = (name) => { runtime.layout.name = name; for (const [t, f] of listeners) if (t === "afteranylayoutstart") f(); };
  const ARR = { SMARTPHONES: "ArraySmartphones", LAPTOPS: "ArrayLaptops" };
  // The game's review engine: every call rolls, and the score follows research (Tech).
  const engine = () => {
    calls.rolls++;
    const a = arrays[ARR[gv.DeviceTypeCreatingNow]];
    gv.DeviceName = String(a.getAt(0, gv.ReviewDeviceNowID, 8));
    arrays.ArrayReviews_Temp.setAt(calls.rolls, 0, 0, 0);
    arrays.ArrayEditorDesign_Smartphone.setAt(calls.rolls, 1, 1, 0);
  };
  const results = () => {
    const base = gv.Tech + gv.ReviewDeviceNowID + (calls.rolls % 3) / 10;
    for (let i = 0; i < 4; i++) {
      gv["ReviewRating_" + (i + 1)] = base + i;
      arrays.ArrayReviews_Text.setAt("review " + base + "/" + i, i, 0, 0);
      arrays.ArrayReviews_Text.setAt("tip " + i, i, 1, 0);
    }
  };
  const runtime = {
    globalVars: gv, objects, layout: { name: "BOSS OFFICE" },
    addEventListener(t, f) { listeners.push([t, f]); },
    goToLayout(name) { layout(name); },
    callFunction(name) {
      if (name.indexOf("ReviewsEngine_") === 0) return engine();
      if (name === "ReviewsEngineResults") return results();
      if (name === "Assistant_ON") {
        const g = arrays.ArrayGameAssistant;
        if (g.width > 0) {
          gv.AssistantTheme = g.getAt(0, 0, 0);
          ctx.showOfficeNews("text", "", 1, "", "", "title");
        }
      }
      if (name === "Assistant_OFF" && gv.AssistantTheme === "REVIEWS") layout("REVIEWS");
    },
  };
  let intervals = [];
  let ids = 10;
  const ctx = {
    console: { warn() {}, log() {} }, Math, Number, String, Map, Set, JSON, Object, Array, Error, Infinity,
    setTimeout(fn) { ctx._timeouts.push(fn); return 1; }, _timeouts: [],
    setInterval(fn) { const id = ++ids; intervals.push([id, fn]); return id; },
    clearInterval(id) { intervals = intervals.filter((p) => p[0] !== id); }, clearTimeout() {},
    runtime, _dirty: false,
    registerDeviceSalesForArray(arr) { calls.register.push(arr); },
    socialQueueDeviceReleased() {},
    _OPTS: { arrayX: 0 }, _OPTS2: { arrayX: 0 }, _OPTS3: { arrayX: 0 }, _OPTS4: { arrayX: 0 }, _OPTS5: { arrayX: 0 },
    _OPTS6: { arrayX: 0 }, _OPTS7: { arrayX: 0 }, _OPTS8: { arrayX: 0 }, _OPTS9: { arrayX: 0 }, _OPTS10: { arrayX: 0 },
    _findDevSlotX2() { return -1; },
    getLastPresentationResults() { return null; }, clearPendingPresentationPopularity() {}, presentationApplyOnRelease() { return 0; },
    showOfficeNews() { calls.cards++; return true; },
    _renderCurrentDevice() { return true; },
    _hasUnreleasedGamepad() { return false; },
  };
  vm.createContext(ctx);
  ctx._dtUi = {
    num(k, d) { const v = Number(gv[k]); return Number.isFinite(v) ? v : d; },
    gv(k, d) { return k in gv ? gv[k] : d; },
    t(e, vars) { let s = e.en; for (const k in vars || {}) s = s.split("{" + k + "}").join(String(vars[k])); return s; },
    el,
    button(parent, label, cls, onClick) { const b = el("button", cls, parent, label); b.onClick = onClick; return b; },
    onOffice() { return / OFFICE$/.test(runtime.layout.name); },
    layoutName() { return runtime.layout.name; },
    modal(o) { calls.modals.push(o); ctx._open = o; const body = el("div"); o.build && o.build(body, () => {}); o._body = body; return o; },
    close() { ctx._open = null; }, isOpen() { return !!ctx._open; },
    toast(t, k, o) { calls.toasts.push(t); if (o && o.sales) calls.sales.push(t); }, chip() {}, removeChip() {},
  };
  vm.runInContext(SRC, ctx);
  const tick = (n) => { for (let i = 0; i < (n || 1); i++) for (const [, f] of intervals.slice()) f(); };
  const press = (label) => {
    const o = ctx._open;
    assert.ok(o, "a question is open for " + label);
    const b = o.buttons.find((x) => x.label === label);
    assert.ok(b, "button " + label);
    ctx._open = null;
    b.onClick();
  };
  const text = (n) => [n.textContent].concat((n.children || []).map(text)).join(" ").replace(/\s+/g, " ");
  // The game's reviews card arrives for the device that just finished.
  const finish = (type) => {
    gv.DeviceTypeCreatingNow = type;
    const g = arrays.ArrayGameAssistant;
    g.setSize(g.width + 1, 2, 1);
    g.setAt("REVIEWS", g.width - 1, 0, 0);
    gv.Assistant = "ON";
    runtime.callFunction("Assistant_ON");
  };
  // Clicking the game's card, then its review screens for every variant on line 0.
  const clickCard = () => {
    const g = arrays.ArrayGameAssistant;
    for (let x = 0; x < g.width - 1; x++) for (let y = 0; y < 2; y++) g.setAt(g.getAt(x + 1, y, 0), x, y, 0);
    g.setSize(g.width - 1, 2, 1);
    gv.Assistant = "OFF";
    runtime.callFunction("Assistant_OFF");
  };
  const reviewScreens = () => {
    assert.equal(runtime.layout.name, "REVIEWS", "the game's review screens are open");
    calls.reviewScreens++;
    const type = gv.DeviceTypeCreatingNow;
    const arr = ARR[type];
    const a = arrays[arr];
    let n = 0;
    while (n < 3 && a.getAt(0, n, 0) !== -1) n++;
    const shown = [];
    for (let y = 0; y < n; y++) {
      gv.ReviewDeviceNowID = y;
      runtime.callFunction("ReviewsEngine_X");
      runtime.callFunction("ReviewsEngineResults");
      ctx._renderCurrentDevice();
      const r = [1, 2, 3, 4].map((i) => gv["ReviewRating_" + i]);
      shown.push({ r, text: arrays.ArrayReviews_Text.getAt(0, 0, 0), name: gv.DeviceName });
      a.setAt(100, 0, y, 2);
      a.setAt(r.reduce((s, v) => s + v, 0) / 4, 0, y, 5);
      a.setAt(gv.DayTotal, 0, y, 7);
      if (!ctx._dtLaunchRelease(arr, runtime, type, y === n - 1 ? 1 : 0)) calls.register.push(arr);
    }
    gv.DeviceTypeCreatingNow = "";
    gv.OfficeType = "BOSS";
    layout("BOSS OFFICE");
    return shown;
  };
  return { ctx, gv, arrays, calls, tick, press, text, finish, clickCard, reviewScreens, layout };
}
const row = (w) => w.arrays.ArraySaves.getAt(0, 160, 0);
const S = (v) => JSON.parse(JSON.stringify(v));

// 1. Plan launch: asked before any review, no reviews now, nothing on sale,
// and scoring off-screen leaves the game's review state as it was.
const w = world();
w.tick();
device(w.arrays.ArraySmartphones, 0, 2, 7, "Ember 7");
w.gv.DeviceName = "before";
w.arrays.ArrayEditorDesign_Smartphone.setAt("design", 1, 1, 0);
w.finish("SMARTPHONES");
assert.equal(w.calls.cards, 0, "the reviews card is replaced by the launch question");
assert.ok(w.ctx._open, "launch question shown before the reviews");
const ask = w.text(w.ctx._open._body);
assert.ok(ask.indexOf("Ember 7 is finished") >= 0, ask);
assert.ok(ask.indexOf("is reviewed") < 0 && ask.indexOf("—") < 0);
w.press("Plan launch");
assert.equal(w.calls.reviewScreens, 0);
assert.equal(w.layout && w.ctx.runtime.layout.name, "BOSS OFFICE", "no review screens now");
assert.deepEqual(w.calls.register, [], "not on sale yet");
assert.equal(w.arrays.ArraySmartphones.getAt(0, 0, 7), 1014);
assert.equal(w.arrays.ArraySmartphones.getAt(0, 1, 7), 1014);
assert.equal(w.arrays.ArraySmartphones.getAt(0, 0, 2), 0, "not reviewed yet");
assert.equal(w.arrays.ArrayGameAssistant.width, 0, "card taken off the queue");
assert.equal(w.gv.Assistant, "OFF");
assert.equal(w.gv.DeviceTypeCreatingNow, "");
assert.equal(w.gv.DeviceName, "before", "globals put back");
assert.equal(w.gv.ReviewRating_1, 0);
assert.equal(w.arrays.ArrayEditorDesign_Smartphone.getAt(1, 1, 0), "design", "editor arrays put back");
assert.equal(w.arrays.ArrayReviews_Temp.getAt(0, 0, 0), 0);
const saved = JSON.parse(row(w));
assert.equal(saved.list.length, 1);
const kept = saved.list[0].snaps.map((s) => s.r);

// 2. Waiting days: no reviews, no launch, research moves on.
w.gv.Tech = 9;
for (let d = 1001; d < 1014; d++) {
  w.gv.DayTotal = d;
  w.tick();
}
assert.equal(w.calls.cards, 0);
assert.deepEqual(w.calls.register, []);

// 3. The planned day arrives while another question is open: it waits.
w.gv.DayTotal = 1014;
w.ctx._open = { buttons: [], _body: { children: [] } };
w.tick(3);
assert.equal(w.calls.cards, 0, "waits for the open question");
assert.deepEqual(w.calls.register, [], "the daily launch skips a device waiting for reviews");
w.ctx._open = null;
// ...and while the game's create picker is open (class stays GAMEPLAY): the card would come up over it.
w.gv.CreateDevicesUI = "ON";
w.tick(3);
assert.equal(w.calls.cards, 0, "waits for the create picker");
w.gv.CreateDevicesUI = "OFF";

// 4. Then the game's own reviews card and screens, with finish-day scores, then on sale.
w.tick();
assert.equal(w.calls.cards, 1, "game's reviews card shown on launch day");
w.clickCard();
const shown = w.reviewScreens();
assert.deepEqual(S(shown.map((s) => s.r)), S(kept), "scores equal the finish-day ones, no reroll");
assert.equal(shown[0].name, "Ember 7");
assert.deepEqual(w.calls.register, [], "held for its launch day (and its presentation offer)");
w.tick();
assert.deepEqual(w.calls.register, ["ArraySmartphones"], "on sale: no presentation possible here ($1M, no research)");
assert.equal(w.arrays.ArraySmartphones.getAt(0, 0, 7), 1014);
assert.equal(JSON.parse(row(w)).list.length, 0, "no longer waiting");
w.gv.DayTotal = 1015;
w.tick(2);
assert.equal(w.calls.cards, 1, "not replayed again");

// 5. Launch today stays as it was: the game's reviews now, then on sale.
device(w.arrays.ArrayLaptops, 0, 1, 3, "Book 3");
w.finish("LAPTOPS");
w.press("Launch today");
assert.equal(w.ctx.runtime.layout.name, "REVIEWS", "reviews straight away");
const now = w.reviewScreens();
assert.equal(now.length, 1);
w.tick();
assert.deepEqual(w.calls.register.slice(1), ["ArrayLaptops"]);
assert.equal(w.arrays.ArrayLaptops.getAt(0, 0, 7), 1015);
w.ctx._timeouts.forEach((f) => f());
assert.ok(w.calls.toasts.some((t) => /Book 3/.test(t)));
assert.ok(w.calls.sales.some((t) => /Book 3 is on sale from today/.test(t)), "the launch goes under the sales card");

// 6. Save and reload while two devices wait for the same day; old saves untouched.
{
  const a = world();
  a.tick(2);
  assert.equal(row(a), 0, "an old save keeps row 160 as it was");
  device(a.arrays.ArraySmartphones, 0, 1, 7, "Ember 7");
  a.finish("SMARTPHONES");
  a.press("Plan launch");
  device(a.arrays.ArrayLaptops, 0, 1, 3, "Book 3");
  a.finish("LAPTOPS");
  a.press("Plan launch");
  const b = world(a.arrays.ArraySaves);
  for (const n of ["ArraySmartphones", "ArrayLaptops"]) b.arrays[n] = a.arrays[n];
  for (const n of ["ArraySmartphones", "ArrayLaptops"]) b.ctx.runtime.objects[n] = { getFirstInstance: () => a.arrays[n] };
  // A newer phone line pushes the waiting phone to line 1.
  const p = b.arrays.ArraySmartphones;
  for (let y = 0; y < 3; y++) for (let z = 0; z < 12; z++) p.setAt(p.getAt(0, y, z), 1, y, z);
  device(p, 0, 1, 8, "Ember 8", 900);
  b.gv.DayTotal = 1014;
  b.tick();
  assert.equal(b.calls.cards, 1, "one at a time");
  assert.equal(p.getAt(0, 0, 8), "Ember 7", "its line comes to the front for the review screens");
  b.clickCard();
  b.reviewScreens();
  assert.equal(p.getAt(1, 0, 8), "Ember 7", "and goes back after");
  assert.equal(p.getAt(1, 0, 7), 1014);
  assert.equal(p.getAt(0, 0, 8), "Ember 8");
  assert.equal(b.ctx._dirty, true, "game's sales list rebuilt after the move");
  b.tick();
  assert.equal(b.calls.cards, 2, "second device the same day");
  b.clickCard();
  b.reviewScreens();
  assert.equal(b.arrays.ArrayLaptops.getAt(0, 0, 7), 1014);
  assert.equal(JSON.parse(row(b)).list.length, 0);
}

// 7. Shelf "Launch now" on a waiting device: its reviews run today.
{
  const a = world();
  a.tick();
  device(a.arrays.ArraySmartphones, 0, 1, 7, "Ember 7");
  a.finish("SMARTPHONES");
  a.press("Plan launch");
  const g = a.ctx._dtLaunchShelf()[0];
  a.ctx._dtLaunchNow(g.arr, g.cat, g.x, g.ys, g.name);
  assert.deepEqual(a.calls.register, [], "not on sale before its reviews");
  a.tick();
  assert.equal(a.calls.cards, 1);
  a.clickCard();
  a.reviewScreens();
  assert.equal(a.arrays.ArraySmartphones.getAt(0, 0, 7), 1000);
  assert.deepEqual(a.calls.register, ["ArraySmartphones"]);
}
// 8. With a presentation possible ($5M, research), it is offered on the launch day
// itself, after the reviews: for a planned day and for Launch today alike.
{
  const a = world();
  a.gv.Budget = 9e6;
  a.arrays.ArrayMyResearch.setAt(2, 211, 0, 0);
  a.arrays.ArrayMyResearch.setAt(2, 213, 0, 0);
  a.tick();
  device(a.arrays.ArraySmartphones, 0, 1, 7, "Ember 7");
  a.finish("SMARTPHONES");
  a.press("Plan launch");
  for (let d = 1001; d <= 1013; d++) {
    a.gv.DayTotal = d;
    a.tick();
  }
  assert.equal(a.calls.modals.filter((m) => m.offer).length, 0, "no offer before the day");
  a.gv.DayTotal = 1014;
  a.tick();
  a.clickCard();
  a.reviewScreens();
  a.tick();
  assert.ok(a.ctx._open && a.ctx._open.offer && /Ember 7/.test(a.text(a.ctx._open._body)), "offer on the launch day");
  assert.ok(a.text(a.ctx._open._body).indexOf("Do you want to hold a presentation of it first?") >= 0);
  a.press("Yes");
  a.ctx._timeouts.splice(0).forEach((f) => f());
  assert.equal(a.ctx.runtime.layout.name, "PRESENTATION SMARTPHONE V2", "the game's own slides");
  assert.deepEqual(a.calls.register, [], "not on sale before the show ends");
  a.layout("PRESENTATION FINISH");
  assert.deepEqual(a.calls.register, ["ArraySmartphones"], "on sale at the end of the show");
  assert.equal(a.arrays.ArraySmartphones.getAt(0, 0, 7), 1014);
  assert.equal(JSON.parse(a.arrays.ArraySaves.getAt(0, 153, 0)).events.length, 0, "nothing left waiting");

  device(a.arrays.ArrayLaptops, 0, 1, 3, "Book 3");
  a.gv.class = "GAMEPLAY"; // the game leaves the results screen
  a.layout("BOSS OFFICE");
  a.finish("LAPTOPS");
  // The real queue.js: its release hook marks the launch flow pending (shared flag and its own 60 s wait)
  // when the hook holds the final review.
  const rel = a.ctx._dtLaunchRelease;
  vm.runInContext(QUEUE_SRC, a.ctx);
  const q = a.ctx._dtQueueApi;
  a.press("Launch today");
  a.reviewScreens();
  a.ctx._dtLaunchRelease = rel;
  assert.deepEqual(a.calls.register.slice(1), [], "held for the offer");
  assert.equal(a.ctx._dtLaunchPending, false, "the launch flow is not left pending after the reviews");
  assert.equal(q.launchWait(), false, "the queue's own launch wait is over too: the next device can start now");
  assert.equal(q.armed(), true, "the queue is armed again");
  delete a.ctx._dtQueueApi;
  a.tick();
  assert.ok(a.ctx._open && a.ctx._open.offer && /Book 3/.test(a.text(a.ctx._open._body)));
  a.press("No");
  assert.deepEqual(a.calls.register.slice(1), ["ArrayLaptops"]);
  assert.equal(a.arrays.ArrayLaptops.getAt(0, 0, 7), 1014);
  a.tick(3);
  assert.equal(a.calls.modals.filter((m) => m.offer).length, 2, "each offered once");
}
// 9. Loading an earlier save of the same slot and company (device still in development there):
// the old waiting list is not used, so nothing is reviewed or launched early.
{
  const a = world();
  a.tick();
  device(a.arrays.ArraySmartphones, 0, 1, 7, "Ember 7");
  a.finish("SMARTPHONES");
  a.press("Plan launch");
  assert.equal(JSON.parse(row(a)).list.length, 1);
  a.layout("LOADING GAME");
  a.tick();
  a.arrays.ArraySaves.setAt(0, 0, 160, 0); // the earlier save had no planned launch
  a.arrays.ArraySmartphones.setAt(-1, 0, 0, 7);
  a.gv.DayTotal = 990;
  a.layout("BOSS OFFICE");
  a.tick(3);
  assert.equal(a.calls.cards, 0, "no reviews card for a device still in development");
  assert.equal(a.arrays.ArraySmartphones.getAt(0, 0, 7), -1, "its release day is left alone");
  assert.equal(a.ctx._dtReviewsApi.state().list.length, 0);
}
// 10. Save/load while a planned device's reviews card is queued: the loaded game has no card,
// and the planned reviews run again (they used to stop for the rest of the session).
{
  const a = world();
  a.tick();
  device(a.arrays.ArraySmartphones, 0, 1, 7, "Ember 7");
  a.finish("SMARTPHONES");
  a.press("Plan launch");
  a.gv.DayTotal = 1014;
  a.tick();
  assert.equal(a.calls.cards, 1, "card queued on the day");
  const keep = row(a);
  a.layout("LOADING GAME");
  a.tick();
  // The loaded save: no card, rows as they were saved (line 0 not reviewed yet), row 160 kept.
  a.arrays.ArrayGameAssistant.setSize(0, 2, 1);
  a.gv.Assistant = "OFF"; a.gv.DeviceTypeCreatingNow = "";
  a.arrays.ArraySaves.setAt(keep, 0, 160, 0);
  a.layout("BOSS OFFICE");
  a.tick(2);
  assert.equal(a.calls.cards, 2, "the planned reviews come again");
  a.clickCard();
  a.reviewScreens();
  a.tick();
  assert.equal(a.arrays.ArraySmartphones.getAt(0, 0, 7), 1014, "on sale");
  assert.equal(JSON.parse(row(a)).list.length, 0);
}
// 11. New Game in a used slot clears the planned launches of the old campaign.
{
  const a = world();
  a.tick();
  device(a.arrays.ArraySmartphones, 0, 1, 7, "Ember 7");
  a.finish("SMARTPHONES");
  a.press("Plan launch");
  a.gv.LoadingType = "NEW GAME";
  a.layout("LOADING GAME");
  a.tick();
  assert.equal(row(a), "", "row 160 cleared");
  assert.equal(a.ctx._dtReviewsApi.state().list.length, 0);
}
// 12. The planned day comes while the live item has just left the rooms (an OS on its release,
// room ""): it is not parked there (it would have no room to come back to); the reviews wait for it.
{
  const a = world();
  a.tick();
  device(a.arrays.ArraySmartphones, 0, 1, 7, "Ember 7");
  a.finish("SMARTPHONES");
  a.press("Plan launch");
  const live = { room: "" };
  let parked = 0;
  a.ctx._dtpFocused = () => live;
  a.ctx._dtpPark = () => { parked++; };
  a.gv.DeviceTypeCreatingNow = "OS SMARTPHONES";
  a.gv.DayTotal = 1014;
  a.tick(2);
  assert.equal(parked, 0, "not parked out of the rooms");
  assert.equal(a.calls.cards, 0, "reviews wait");
  live.room = "DESIGNER";
  a.tick();
  assert.equal(parked, 1, "parked from its room");
  assert.equal(a.calls.cards, 1, "then the reviews run");
}
// 13. After your own OS or app the game keeps its type (only 282 REVIEWS clears it). With
// nothing live and the type left over, the planned day runs with nothing to park.
{
  const a = world();
  a.tick();
  device(a.arrays.ArraySmartphones, 0, 1, 7, "Ember 7");
  a.finish("SMARTPHONES");
  a.press("Plan launch");
  let parked = 0, spent = false;
  a.ctx._dtpFocused = () => null;
  a.ctx._dtpPark = () => { parked++; };
  a.ctx._dtpSpent = () => spent;
  a.gv.DeviceTypeCreatingNow = "OS SMARTPHONES";
  a.gv.DayTotal = 1014;
  a.tick(2);
  assert.equal(a.calls.cards, 0, "an OS the pipeline still holds is not passed over");
  spent = true;
  a.tick();
  assert.equal(parked, 0, "nothing to park");
  assert.equal(a.calls.cards, 1, "the planned reviews come on their day");
  a.clickCard();
  a.layout("REVIEWS");
  a.reviewScreens();
  assert.equal(a.arrays.ArraySmartphones.getAt(0, 0, 7), 1014, "then on sale that day");
}
console.log("reviews runtime: ok");
