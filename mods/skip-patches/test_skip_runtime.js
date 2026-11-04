// Runtime test for skip.js with a fake Construct runtime and DOM: node test_skip_runtime.js TABLE_JSON
// (test_skip.py passes the band table prepare.py reads out of the game.)
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const TABLE = JSON.parse(process.argv[2] || fs.readFileSync(0, "utf8"));

// ── Tiny DOM: classList, querySelector by id/class, events ──
class ClassList {
  constructor() { this.s = new Set(); }
  add(...c) { c.forEach((x) => this.s.add(x)); }
  remove(...c) { c.forEach((x) => this.s.delete(x)); }
  contains(c) { return this.s.has(c); }
  toggle(c, on) { if (on === undefined ? !this.s.has(c) : on) this.s.add(c); else this.s.delete(c); }
}
class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parent = null; this.classList = new ClassList();
    this.style = { setProperty() {}, getPropertyValue() { return ""; } }; this.dataset = {}; this.textContent = ""; this.id = "";
    this.listeners = {}; this.anims = [];
  }
  set className(v) { this.classList = new ClassList(); String(v).split(/\s+/).filter(Boolean).forEach((c) => this.classList.add(c)); }
  get className() { return [...this.classList.s].join(" "); }
  get isConnected() { let n = this; while (n.parent) n = n.parent; return n === document.body || n === document.head; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  all() { return this.children.flatMap((c) => [c, ...c.all()]); }
  match(sel) { return sel[0] === "#" ? this.id === sel.slice(1) : sel[0] === "." ? this.classList.contains(sel.slice(1)) : this.tagName === sel.toUpperCase(); }
  querySelector(sel) { return this.all().find((e) => e.match(sel)) || null; }
  querySelectorAll(sel) { return this.all().filter((e) => e.match(sel)); }
  getBoundingClientRect() { return this.rect || { left: 0, top: 0, width: 1280, height: 720 }; }
  getAnimations() { return this.all().flatMap((e) => e.anims); }
  click() { (this.listeners.click || []).forEach((f) => f({ stopPropagation() {} })); }
}
const docListeners = {};
const document = {
  body: new El("body"), head: new El("head"),
  createElement: (t) => new El(t),
  getElementById: (id) => document.head.querySelector("#" + id) || document.body.querySelector("#" + id),
  querySelector: (s) => document.body.querySelector(s),
  addEventListener: (t, f, cap) => { (docListeners[t] = docListeners[t] || []).push(f); },
};
const timers = [];
let rafs = [];
const ctx = {
  document, console,
  setInterval: (f) => { timers.push(f); return timers.length; }, clearInterval() {},
  setTimeout: (f) => 0, clearTimeout() {},
  requestAnimationFrame: (f) => { rafs.push(f); return rafs.length; }, cancelAnimationFrame() {},
  innerWidth: 1280, innerHeight: 720, addEventListener() {},
  KeyboardEvent: class { constructor(type, init) { Object.assign(this, init, { type }); } },
  dispatchEvent: (e) => { sent.push(e.type + ":" + e.key); return true; },
};
const sent = []; // keys sent to the game (window)
ctx.globalThis = ctx;

// ── Fake game ──
const g = { LanguageChoose: 0, ReviewNextActive: 0, DevicePrice: 0, DeviceCostPrice: 0, DeviceType: "SMARTPHONE", DeviceTypeCreatingNow: "LAPTOPS" };
// ArrayReviews_DB phrase scores (x0 min, x1 max) as shipped for the price phrases.
const DBROWS = { 0: [1, 2], 1: [1, 2], 2: [1, 2], 3: [3, 4], 4: [3, 4], 5: [3, 4], 6: [5, 6], 7: [5, 6], 8: [5, 6], 9: [7, 8], 10: [7, 8], 11: [7, 8], 12: [9, 10], 13: [9, 10], 14: [9, 10] };
const reviewsDb = { height: 2719, getAt: (x, y) => (DBROWS[y] ? DBROWS[y][x] : 0) };
const slider = new El("input");
slider.rect = { left: 400, top: 380, width: 480, height: 20 };
const layoutListeners = {};
const rt = {
  globalVars: g, layout: { name: "BOSS OFFICE" }, timeScale: 1,
  objects: {
    ArrayReviews_DB: { getFirstInstance: () => reviewsDb },
    SliderBarPrice: { getFirstInstance: () => ({ getElement: () => slider }) },
  },
  addEventListener: (t, f) => { (layoutListeners[t] = layoutListeners[t] || []).push(f); },
};
ctx.runtime = rt;
document.body.appendChild(new El("canvas"));
document.body.appendChild(slider);

// The review overlay's own helpers, as skip.js calls them (game names).
let gameTimersCleared = 0;
let armed = 0;
const reviewsGame = `
var _container7 = null;
function _clearTimers() { __hooks.cleared(); }
function _formatCount(e) { return e >= 1e3 ? (e / 1e3) + "K" : String(e); }
function _armGamepadStepIfNeeded() { __hooks.armed(); }
function _setReviewNextActive(e) { globalThis.runtime.globalVars.ReviewNextActive = e; }
var _TABS_CAT = 999, _root4 = null, _activeCat = -1, _stepIdx = -1, _autoPlaying = false;
function _readSteps() { return __hooks.steps; }
function _clearTimers2() { __hooks.pres.cleared++; }
function _unlock() { __hooks.pres.unlocked++; }
function _showStep(e) { __hooks.pres.shown.push(e); globalThis.runtime.globalVars.MiniPage = e.cat; if (e.cat === _TABS_CAT) _activeCat = _TABS_CAT; }
`;
ctx.__hooks = { cleared: () => gameTimersCleared++, armed: () => armed++, steps: [], pres: { cleared: 0, unlocked: 0, shown: [] } };
const vm = require("vm");
vm.createContext(ctx);
const ui = fs.readFileSync(path.join(__dirname, "../mods-ui/ui.js"), "utf8");
const body = fs.readFileSync(path.join(__dirname, "skip.js"), "utf8").replace("__DT_SKIP_TABLE__", JSON.stringify(TABLE));
vm.runInContext(reviewsGame + ui + "\n;\n" + body + "\n;globalThis._dtUi = _dtUi; globalThis._getC7 = () => _container7; globalThis._setC7 = (e) => { _container7 = e; };" +
  "globalThis._pres = { set: (r, a) => { _root4 = r; _activeCat = a; _autoPlaying = true; _stepIdx = 2; }, get: () => ({ activeCat: _activeCat, stepIdx: _stepIdx, autoPlaying: _autoPlaying }) };", ctx);
const api = ctx._dtSkipApi;
const tick = () => timers.forEach((f) => f());
const layout = (name) => { rt.layout.name = name; };
const fire = (type) => (layoutListeners[type] || []).forEach((f) => f());
const key = (k, extra) => {
  const ev = Object.assign({ key: k, repeat: false, target: document.body, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } }, extra || {});
  (docListeners.keydown || []).forEach((f) => f(ev));
  return ev;
};
const btn = () => document.body.querySelector(".dt-skip-btn");
let n = 0;
const test = (name, f) => { f(); n++; console.log("ok", name); };

// ── 1. Band mapping, including the edges ──
test("band edges", () => {
  const b = (m) => { const x = api.band(m, TABLE); return x && x.lo + "-" + x.hi; };
  assert.strictEqual(b(-50), "12-14");
  assert.strictEqual(b(0), "12-14");
  assert.strictEqual(b(19.999), "12-14");
  assert.strictEqual(b(20), "9-11");
  assert.strictEqual(b(29.99), "9-11");
  assert.strictEqual(b(30), "6-8");
  assert.strictEqual(b(34.999), "6-8");
  assert.strictEqual(b(35), "3-5");
  assert.strictEqual(b(39.999), "3-5");
  assert.strictEqual(b(40), "0-2");
  assert.strictEqual(b(1000), "0-2");
  assert.strictEqual(api.band(NaN, TABLE), null);
  assert.strictEqual(api.band(null, TABLE), null);
});
test("markup is the engines' expression", () => {
  assert.strictEqual(api.markup(124, 100), 24);
  assert.strictEqual(api.markup(140, 100), 40);
  assert.strictEqual(api.markup(100, 0), null);
  // (SELL*100/COST)-100 in floating point, exactly as the event sheet computes it
  assert.strictEqual(api.markup(1001, 715), (1001 * 100) / 715 - 100);
});
test("forecast reads scores from ArrayReviews_DB and the type table", () => {
  const db = (x, y) => reviewsDb.getAt(x, y);
  const f = (price, cost, type) => api.forecast({ DevicePrice: price, DeviceCostPrice: cost, DeviceType: type || "SMARTPHONE", DeviceTypeCreatingNow: "" }, db, TABLE);
  assert.deepStrictEqual([f(124, 100).lo, f(124, 100).hi, f(124, 100).shown, f(124, 100).front], [7, 8, 24, false]);
  assert.deepStrictEqual([f(119, 100).lo, f(119, 100).hi], [9, 10]);
  assert.deepStrictEqual([f(130, 100).lo, f(130, 100).hi], [5, 6]);
  assert.deepStrictEqual([f(135, 100).lo, f(135, 100).hi, f(135, 100).front], [3, 4, true]);
  assert.deepStrictEqual([f(160, 100).lo, f(160, 100).hi, f(160, 100).front], [1, 2, true]);
  // 34.9% shows as 34%, never rounded up into the next band
  assert.strictEqual(f(1349, 1000).shown, 34);
  assert.strictEqual(f(1349, 1000).lo, 5);
  // a DB with mixed phrase scores gives the full range
  const wide = (x, y) => ({ 9: [6, 8], 10: [7, 8], 11: [7, 9] }[y] || [0, 0])[x];
  assert.deepStrictEqual((({ lo, hi }) => [lo, hi])(api.forecast({ DevicePrice: 125, DeviceCostPrice: 100, DeviceType: "TV" }, wide, TABLE)), [6, 9]);
  assert.strictEqual(f(124, 100, "GAMEPAD"), null);
  assert.strictEqual(f(124, 100, "CPU SMARTPHONES"), null);
  assert.strictEqual(f(124, 100, "VR").lo, 7, "VR editor -> VR CONSOLE engine");
  assert.strictEqual(f(124, 100, "LAPTOP").lo, 7);
  assert.strictEqual(f(124, 0), null);
});
test("forecast judges markup minus the fair price allowance when fairprice.js is on", () => {
  const db = (x, y) => reviewsDb.getAt(x, y);
  const f = (price, cost, type) => api.forecast({ DevicePrice: price, DeviceCostPrice: cost, DeviceType: type || "SMARTPHONE" }, db, TABLE);
  const calls = [];
  let allow = 12;
  ctx._dtFairForecast = (type, cost) => (calls.push([type, cost]), type === "GAMEPAD" ? null : { now: "X", allowance: allow });
  try {
    // 45% on a strong device is judged as 33%: 5-6, in the shuffled pool.
    assert.deepStrictEqual([f(145, 100).lo, f(145, 100).shown, f(145, 100).front, f(145, 100).allow], [5, 45, false, 12]);
    assert.deepStrictEqual(calls[0], ["SMARTPHONE", 100], "asked with the editor's DeviceType and cost");
    assert.strictEqual(api.text(f(145, 100)).sub, "(45% over cost, strong specs allow 12% more)");
    assert.strictEqual(f(146, 100).lo, 5);
    assert.strictEqual(f(147, 100).lo, 3, "judged 35: forced 3-4");
    allow = -10; // weak device: 25% is judged as 35%
    assert.deepStrictEqual([f(125, 100).lo, f(125, 100).front], [3, true]);
    assert.strictEqual(api.text(f(125, 100)).sub, "(25% over cost, weak specs allow 10% less)");
    allow = 0; // a mainstream device reads exactly as before
    assert.strictEqual(api.text(f(124, 100)).sub, "(24% over cost)");
    assert.strictEqual(f(124, 100).lo, 7);
    assert.strictEqual(f(124, 0), null);
    assert.strictEqual(calls.filter((c) => c[1] === 0).length, 0, "no price, no question");
  } finally {
    delete ctx._dtFairForecast;
  }
  assert.strictEqual(f(145, 100).lo, 1, "without fairprice.js: the game's bands");
});
test("forecast line follows the slider live and leaves other screens", () => {
  layout("EDITOR PRICE PAGE");
  g.class = "EDITOR PRICE PAGE";
  Object.assign(g, { DevicePrice: 124, DeviceCostPrice: 100, DeviceType: "SMARTPHONE", DeviceTypeCreatingNow: "LAPTOPS" });
  tick();
  const line = () => document.body.querySelector(".dt-skip-card");
  assert.ok(line());
  const txt = () => line().children.slice(0, 3).map((c) => c.textContent).join(" ");
  assert.strictEqual(txt(), "Price score in reviews: 7-8/10 (24% over cost)");
  assert.strictEqual(line().dataset.tone, "good");
  assert.strictEqual(line().children[3].style.display, "", "below 35% the price card is not always picked");
  g.DevicePrice = 145;
  tick();
  assert.strictEqual(txt(), "Price score in reviews: 1-2/10 (45% over cost)");
  assert.strictEqual(line().dataset.tone, "bad");
  assert.strictEqual(line().children[3].style.display, "none");
  g.class = "LOADING EDITOR"; // Create pressed: the page fades out
  tick();
  assert.strictEqual(line(), null);
  g.class = "EDITOR PRICE PAGE";
  tick();
  g.DeviceType = "GAMEPAD";
  tick();
  assert.strictEqual(line(), null);
  g.DeviceType = "SMARTPHONE";
  tick();
  assert.ok(line());
  layout("LOADING EDITOR");
  tick();
  assert.strictEqual(line(), null);
});

// ── 2. Skip: delivery runs the game clock fast until the layout ends ──
test("delivery skip: button, fast clock, restored when the layout ends", () => {
  layout("BATCH DELIVERY");
  rt.timeScale = 1;
  tick();
  assert.ok(btn(), "button on delivery");
  assert.strictEqual(btn().children[1].textContent, "Skip");
  assert.strictEqual(api.what(), "delivery");
  btn().click();
  assert.strictEqual(rt.timeScale, 40);
  assert.strictEqual(api.what(), "", "a second skip does nothing");
  tick();
  assert.strictEqual(btn(), null, "button gone once skipping");
  assert.strictEqual(key(" ").prevented, false, "Space passes through while nothing to skip");
  fire("beforeanylayoutend");
  assert.strictEqual(rt.timeScale, 1, "clock back before the next layout");
  layout("BOSS OFFICE");
  fire("afteranylayoutstart");
  tick();
  assert.strictEqual(rt.timeScale, 1);
  assert.strictEqual(btn(), null);
});
test("delivery skip keeps a game time scale other than 1", () => {
  layout("BATCH DELIVERY");
  rt.timeScale = 2;
  const ev = key("Enter");
  assert.ok(ev.prevented && ev.stopped);
  assert.strictEqual(rt.timeScale, 80);
  layout("REVIEWS");
  tick(); // even without the layout events, the tick restores it off the delivery screen
  assert.strictEqual(rt.timeScale, 2);
  rt.timeScale = 1;
});

// ── 3. Skip: review cards end in the state of the overlay's last timer ──
function buildReviews(soft) {
  const c = new El("div");
  document.body.appendChild(c);
  const root = c.appendChild(new El("div")); root.id = "reviews-root"; root.classList.add("rc-no-hover");
  if (soft) root.classList.add("soft-mode");
  const title = root.appendChild(new El("div")); title.id = "reviews-title";
  const blur = root.appendChild(new El("div")); blur.id = "reviews-blur-overlay";
  const grid = root.appendChild(new El("div")); grid.className = "reviews-grid";
  for (let i = 0; i < 4; i++) {
    const card = grid.appendChild(new El("div")); card.className = "review-card";
    const m = card.appendChild(new El("div")); m.className = "rc-metric-val"; m.dataset.target = String(1500 + i); m.textContent = "0";
    card.anims.push({ finished: false, effect: { getComputedTiming: () => ({ endTime: 3000 }) }, finish() { this.finished = true; } });
  }
  root.anims.push({ finished: false, effect: { getComputedTiming: () => ({ endTime: Infinity }) }, finish() { throw new Error("infinite"); } });
  const sum = root.appendChild(new El("div")); sum.id = "reviews-summary";
  const corner = root.appendChild(new El("div")); corner.id = "reviews-summary-corner";
  ctx._setC7(c);
  return { c, root, title, blur, sum, corner, grid };
}
test("reviews skip: cards that never enter end the wait after about 3 s of frames", () => {
  layout("REVIEWS");
  g.ReviewNextActive = 0;
  buildReviews(false);
  tick();
  rafs = [];
  key(" ");
  let frames = 0;
  while (rafs.length && frames < 1000) { rafs.shift()(); frames++; }
  assert.strictEqual(rafs.length, 0, "the wait stops");
  assert.ok(frames > 100 && frames < 200, "after about 180 frames, got " + frames);
  assert.strictEqual(g.ReviewNextActive, 0);
  rafs = [];
  key(" ");
  assert.strictEqual(rafs.length, 1, "a later press starts a fresh wait");
  rafs = [];
  api.state().revWait = 0;
});

test("reviews skip waits for the first frame, then lands on the end state", () => {
  layout("REVIEWS");
  g.ReviewNextActive = 0;
  const s = buildReviews(true);
  s.title.classList.add("rc-soft-fade-in-new");
  tick();
  assert.ok(btn(), "button while cards animate");
  rafs = [];
  const ev = key(" ");
  assert.ok(ev.prevented && ev.stopped, "Space is the skip key and does not reach the game");
  assert.strictEqual(g.ReviewNextActive, 0, "not before the cards have entered");
  assert.strictEqual(rafs.length, 1);
  key(" ");
  assert.strictEqual(rafs.length, 1, "a second press joins the wait, no second loop");
  s.grid.children.forEach((c) => c.classList.add("rc-enter")); // the game's own first frame
  rafs.shift()();
  assert.strictEqual(gameTimersCleared, 1);
  assert.strictEqual(g.ReviewNextActive, 1, "Next enabled, as after the last timer");
  assert.strictEqual(armed, 1, "gamepad step armed like the last timer does");
  assert.deepStrictEqual(s.grid.children.map((c) => c.children[0].textContent), ["1.5K", "1.501K", "1.502K", "1.503K"]);
  assert.ok(s.blur.classList.contains("rc-blur-out") && !s.blur.classList.contains("rc-blur-in"));
  assert.ok(s.sum.classList.contains("rc-summary-show") && s.sum.classList.contains("rc-summary-hide"));
  assert.ok(s.corner.classList.contains("rc-corner-show"));
  assert.ok(!s.root.classList.contains("rc-no-hover"));
  assert.ok(s.title.classList.contains("rc-soft-move-up") && !s.title.classList.contains("rc-soft-fade-in-new"));
  assert.ok(s.grid.children.every((c) => c.anims[0].finished), "finite animations finished");
  tick();
  assert.strictEqual(btn().children[1].textContent, "Continue", "once Next is enabled the button says how to go on");
  assert.ok(key(" ").prevented, "a quick second Space is still caught");
  assert.deepStrictEqual(sent, [], "but does not leave the score at once");
  api.state().since -= 600;
  assert.ok(key(" ").prevented);
  assert.deepStrictEqual(sent, ["keydown:Escape"], "Space then sends the game's own Esc (its tap / Esc event)");
  tick();
  assert.strictEqual(btn(), null, "gone once sent");
  assert.strictEqual(key("Enter").prevented, false, "and sent only once");
  assert.deepStrictEqual(sent, ["keydown:Escape"]);
  // A launch event's next device: Next goes off while its cards play, then on again.
  g.ReviewNextActive = 0;
  tick();
  assert.strictEqual(btn().children[1].textContent, "Skip");
  g.ReviewNextActive = 1;
  tick();
  assert.strictEqual(btn().children[1].textContent, "Continue");
  api.state().since -= 600;
  btn().click();
  assert.deepStrictEqual(sent, ["keydown:Escape", "keydown:Escape"], "a click on the button does the same");
  sent.length = 0;
  s.c.remove();
});
test("reviews: no skip during the variant change or with a panel open", () => {
  g.ReviewNextActive = 0;
  const s = buildReviews(false);
  s.root.classList.add("soft-exit");
  tick();
  assert.strictEqual(btn(), null);
  assert.strictEqual(key(" ").prevented, false);
  s.root.classList.remove("soft-exit");
  tick();
  assert.ok(btn());
  _dtUiModal();
  tick();
  assert.strictEqual(btn(), null, "hidden under a mod panel");
  assert.strictEqual(key("Enter").prevented, false);
  ctx._dtUi.close(true);
  s.c.remove();
});
function _dtUiModal() {
  ctx._dtUi.modal({ title: "Launch day", buttons: [] });
}
test("keys: ignored in text fields, with modifiers and on repeat", () => {
  g.ReviewNextActive = 0;
  const s = buildReviews(false);
  s.grid.children.forEach((c) => c.classList.add("rc-enter"));
  assert.strictEqual(key(" ", { target: { tagName: "INPUT" } }).prevented, false);
  assert.strictEqual(key(" ", { ctrlKey: true }).prevented, false);
  assert.strictEqual(key(" ", { repeat: true }).prevented, false);
  assert.strictEqual(key("a").prevented, false);
  assert.strictEqual(g.ReviewNextActive, 0);
  assert.ok(key("Enter").prevented);
  assert.strictEqual(g.ReviewNextActive, 1);
  s.c.remove();
});
// ── 4. Skip: the device presentation jumps to its last slide (also inside a launch event) ──
test("presentation skip shows the tiles grid the way the player's last step does", () => {
  const P = ctx.__hooks.pres;
  ctx.__hooks.steps = [{ cat: 0, x: 9 }, { cat: 1, x: 8 }, { cat: 4, x: 7 }, { cat: 999, x: 6 }, { cat: 999, x: 5 }];
  const root = document.body.appendChild(new El("div"));
  ctx._pres.set(root, 1);
  g.MiniPage = 1;
  layout("PRESENTATION SMARTPHONE V2");
  tick();
  assert.strictEqual(api.what(), "presentation");
  assert.ok(btn());
  assert.strictEqual(btn().children[1].textContent, "Show all", "the game's own ESC Skip is already there");
  btn().click();
  assert.strictEqual(P.cleared, 1, "the player's timers are stopped first");
  assert.strictEqual(P.unlocked, 1);
  assert.strictEqual(JSON.stringify(P.shown.map((x) => x.x)), "[6]", "first tiles step, shown once");
  assert.strictEqual(JSON.stringify(ctx._pres.get()), JSON.stringify({ activeCat: 999, stepIdx: 4, autoPlaying: false }));
  assert.strictEqual(g.MiniPage, 999, "the game's own click now moves on");
  tick();
  assert.strictEqual(btn(), null);
  assert.strictEqual(key(" ").prevented, false, "Space does not press on: that is the player's click");
  // A show already on its last slide, or a presentation without tiles: nothing to skip.
  ctx._pres.set(root, 1);
  g.MiniPage = 1;
  ctx.__hooks.steps = [{ cat: 0, x: 1 }];
  assert.strictEqual(api.what(), "");
  ctx.__hooks.steps = [{ cat: 0, x: 1 }, { cat: 999, x: 0 }];
  layout("PRESENTATION LAPTOP V2");
  assert.strictEqual(api.what(), "presentation", "every device type's V2 show");
  root.remove();
  assert.strictEqual(api.what(), "", "player gone (layout ending)");
  document.body.appendChild(root);
  layout("PRESENTATION FINISH");
  assert.strictEqual(api.what(), "", "result screen: the game's click is enough");
  root.remove();
});
test("nothing to skip on other screens", () => {
  for (const name of ["BOSS OFFICE", "BATCH", "EDITOR PRICE PAGE", "PRESENTATION FINISH"]) {
    layout(name);
    tick();
    assert.strictEqual(api.what(), "", name);
    assert.strictEqual(btn(), null, name);
    assert.strictEqual(key(" ").prevented, false, name);
  }
});
console.log(n + " skip runtime tests passed");
