// Runtime test for picker.js (the game's create picker over a work room) with a fake Construct runtime
// and DOM: node test_picker_runtime.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function FakeEl(tag) {
  this.tagName = tag; this.children = []; this.className = ""; this.parentNode = null;
  const styles = {};
  this.style = new Proxy(styles, { get: (o, k) => (k === "setProperty" ? (n, v) => (o[n] = v) : k === "getPropertyValue" ? (n) => o[n] || "" : o[k]), set: (o, k, v) => ((o[k] = v), true) });
  const self = this;
  this.classList = { add: (c) => { self.className = (self.className + " " + c).trim(); }, contains: (c) => self.className.split(" ").includes(c), remove: (c) => { self.className = self.className.split(" ").filter((x) => x !== c).join(" "); } };
}
FakeEl.prototype.appendChild = function (n) { this.children.push(n); n.parentNode = this; return n; };
FakeEl.prototype.insertBefore = function (n) { return this.appendChild(n); };
FakeEl.prototype.remove = function () { if (this.parentNode) { const c = this.parentNode.children; c.splice(c.indexOf(this), 1); this.parentNode = null; } };
FakeEl.prototype.closest = function (sel) {
  for (let n = this; n; n = n.parentNode) for (const s of sel.split(",")) if (n.className && n.className.split(" ").includes(s.trim().replace(/^\./, ""))) return n;
  return null;
};
const body = new FakeEl("body"), head = new FakeEl("head"), canvas = new FakeEl("CANVAS"), wrap = new FakeEl("div"), modLayer = new FakeEl("div");
wrap.className = "c3htmlwrap"; modLayer.className = "dt-layer";
const wrapDiv = wrap.appendChild(new FakeEl("DIV"));
body.appendChild(canvas); body.appendChild(wrap); body.appendChild(modLayer);
const html = new FakeEl("html");
const document = { documentElement: html, body, head, createElement: (t) => new FakeEl(t), getElementById: () => null, querySelector: (s) => (s === "canvas" ? canvas : s === ".dt-pick" ? body.children.find((c) => c.className === "dt-pick") || null : null) };

const listeners = {}, winListeners = {}, calls = [], layouts = [];
const inst = (props) => Object.assign({ width: 0, height: 0, angleDegrees: 0, opacity: 1, setSize(w, h) { this.width = w; this.height = h; }, destroy() { this.dead = true; } }, props);
const layer = { isVisible: true, cssPxToLayer: (x, y) => [x, y], name: "GAMEPLAY GLOBAL UI (Back)" };
const insts = {
  7345: inst({ width: 118, height: 118, layer, containsPoint: (x, y) => Math.hypot(x - 960, y - 1000) < 59 }),
  7335: inst({ width: 140, height: 140 }), 20228: inst({ width: 96, height: 96 }), 20223: inst({ width: 56, height: 56 }),
  7336: inst({ width: 200, height: 200, colorRgb: [0, 0, 0] }), 347: inst({ opacity: 0 }),
};
const research = { 619: 2, 620: 0, 167: 2 };
const created = [];
const rt = {
  globalVars: { class: "GAMEPLAY", CreateDevicesUI: "OFF", Assistant: "OFF", DayTotal: 1000, OfficeType: "BOSS", DeviceType: "", LastClass: "", GameplayPause: 0 },
  layout: { name: "DESIGNER OFFICE 5" },
  objects: {
    ArrayMyResearch: { getFirstInstance: () => ({ getAt: (x) => research[x] || 0 }) },
    Sprite432: { createInstance: (l, x, y) => { const i = inst({ layer: l, x, y }); created.push(i); return i; } },
  },
  addEventListener(n, f) { (listeners[n] = listeners[n] || []).push(f); },
  getInstanceByUid: (u) => insts[u] || null,
  callFunction: (n) => calls.push(n),
  goToLayout(n) { layouts.push(n); for (const f of listeners.beforeanylayoutstart || []) f({ layout: { name: n } }); this.layout.name = n; },
};
globalThis.runtime = rt;
const queuePicks = [];
globalThis._dtQueueApi = { pick: (l) => queuePicks.push(l) };
const _dtUi = { layoutName: () => rt.layout.name, isOpen: () => uiOpen, ensure: () => ({ style: { left: "0px", top: "0px", width: "1920px", height: "1080px", getPropertyValue: () => "1" } }), fit() {}, onOffice: () => true, every: (f) => ((tickFn = f), 0) };
let tickFn = null;
let uiOpen = false;
const addEventListener = (n, f) => (winListeners[n] = winListeners[n] || []).push(f);
const requestAnimationFrame = (f) => f(1e15); // every tween lands at once
const performance = { now: () => 0 };
const ART = { inst: {}, frames: {} };
const src = fs.readFileSync(path.join(__dirname, "picker.js"), "utf8");
const tiles = new Function("return " + src.match(/var _DTK_TILES = (\[[\s\S]*?\n\]);/)[1])();
for (const t of tiles) {
  ART.inst[t[0]] = [100 + tiles.indexOf(t) * 120, 700, 88, 88, "Sprite20", ""];
  ART.inst[t[1]] = [0, 0, 120, 120, "SVG", "SVG FILES/Circle.svg"];
  ART.inst[t[2]] = [0, 0, 138, 138, "Sprite16", ""];
  ART.inst[t[3]] = [0, 0, 40, 40, "Sprite478", ""];
}
const run = new Function("document", "_dtUi", "addEventListener", "requestAnimationFrame", "performance", "ART",
  src.replace("var _DTK_ART = null;", "var _DTK_ART = ART;") +
  '\n_dtkArt = { icons: new Proxy({}, { get: () => "data:icon" }), shadow: "data:sh", circle: "c.svg", tint: "rgb(0,0,255)", hover: "rgb(255,160,0)" };\nreturn globalThis._dtPicker;');
const api = run(document, _dtUi, addEventListener, requestAnimationFrame, performance, ART);
const tileAt = (kind) => ART.inst[tiles.find((t) => t[4] === kind)[0]];
const press = (x, y, target = canvas, type = "pointerdown") => {
  const ev = { type, button: 0, clientX: x, clientY: y, target, stopped: false, stopImmediatePropagation() { this.stopped = true; }, preventDefault() {} };
  for (const f of winListeners[type] || []) f(ev);
  return ev.stopped;
};
const key = (k) => { const ev = { type: "keydown", key: k, stopped: false, stopImmediatePropagation() { this.stopped = true; } }; for (const f of winListeners.keydown || []) f(ev); return ev.stopped; };

(async () => {
  // Not on a work room, a pop-up or panel up, or the game's picker already open: no picker.
  rt.layout.name = "BOSS OFFICE";
  assert.strictEqual(api.open(), false, "the boss office keeps the game's own picker");
  rt.layout.name = "DESIGNER OFFICE 5";
  rt.globalVars.Assistant = "ON";
  assert.strictEqual(api.open(), false);
  rt.globalVars.Assistant = "OFF";
  uiOpen = true;
  assert.strictEqual(api.open(), false);
  uiOpen = false;

  // Opens over the room on screen: Tap_Main, WAIT then ON after the game's 0.05 + 0.375 s, no layout change.
  assert.strictEqual(api.open(), true);
  assert.deepStrictEqual(layouts, []);
  assert.strictEqual(rt.globalVars.CreateDevicesUI, "WAIT");
  // The room's work holds with the day (the game's GameplayPause), without the game's pause badge.
  assert.strictEqual(rt.globalVars.GameplayPause, 1);
  assert.strictEqual(api.holding(), true);
  assert.ok(html.classList.contains("dt-pick-hold"));
  assert.ok(calls.includes("Tap_Main"));
  assert.ok(document.querySelector(".dt-pick"), "drawn over the canvas");
  await sleep(550);
  assert.strictEqual(rt.globalVars.CreateDevicesUI, "ON");
  assert.strictEqual(api.state(), "on");
  // The centre turns into the cross and the game's pause mark is on the date.
  assert.strictEqual(insts[20223].angleDegrees, 315);
  assert.strictEqual(insts[7335].width, 160);
  assert.strictEqual(created.length, 1);
  // Locked tiles as the game opens them: day and research both needed.
  const st = Object.fromEntries(api.tiles().map((t) => [t.kind, t.on]));
  assert.strictEqual(st.SMARTPHONE, true);
  assert.strictEqual(st.TABLET, true, "day 724 and research 619 >= 2");
  assert.strictEqual(st.WATCHES, false, "day below 2549");
  assert.strictEqual(st.CPU, true, "research 167 only");
  assert.strictEqual(st.GPU, false);
  // No room change while it is up.
  assert.strictEqual(rt.globalVars.CreateDevicesUI, "ON");

  // A press on a locked tile or elsewhere on the screen is swallowed and does nothing; mod HTML keeps its own.
  const w = tileAt("WATCHES");
  assert.strictEqual(press(w[0], w[1]), true);
  assert.strictEqual(press(100, 100, wrapDiv), true, "the office HTML layer over the canvas is the screen");
  assert.strictEqual(press(100, 100, modLayer), false);
  assert.strictEqual(api.state(), "on");

  // The centre press closes it: WAIT, then OFF; the centre is the room's button again.
  assert.strictEqual(press(960, 1000), true);
  await sleep(400);
  assert.strictEqual(api.isOpen(), false);
  assert.strictEqual(rt.globalVars.CreateDevicesUI, "OFF");
  assert.strictEqual(insts[20223].angleDegrees, 0);
  assert.strictEqual(insts[20223].width, 56, "back to the room's own size");
  assert.strictEqual(rt.globalVars.GameplayPause, 0, "work goes on with the day");
  assert.strictEqual(api.holding(), false);
  assert.strictEqual(insts[7335].width, 140);
  assert.ok(created[0].dead, "pause mark removed");
  assert.strictEqual(document.querySelector(".dt-pick"), null);
  assert.deepStrictEqual(layouts, []);

  await sleep(400);
  assert.ok(!html.classList.contains("dt-pick-hold"), "the game's badge is its own again");

  // Mid-stage the live room's button is a turning gear (frame 1): the + stands in for the cross, and the
  // gear, its angle and its turn come back on close.
  const ic = insts[20223], gear = { isEnabled: true };
  Object.assign(ic, { animationFrame: 1, angleDegrees: 97, behaviors: { Tween: gear } });
  api.open();
  assert.strictEqual(ic.animationFrame, 1, "turns with the cross, after the game's 0.05 s");
  await sleep(550);
  assert.strictEqual(ic.animationFrame, 0);
  assert.strictEqual(gear.isEnabled, false, "the gear's turn holds");
  assert.strictEqual(ic.angleDegrees, 315);
  assert.strictEqual(ic.width, 74);
  press(960, 1000);
  await sleep(400);
  assert.strictEqual(ic.animationFrame, 1);
  assert.strictEqual(ic.angleDegrees, 97);
  assert.strictEqual(gear.isEnabled, true);
  assert.strictEqual(ic.width, 56);
  Object.assign(ic, { animationFrame: 0, angleDegrees: 0 });
  await sleep(400);

  // Paused by the player first: it stays paused, with the game's badge.
  rt.globalVars.GameplayPause = 1;
  api.open();
  assert.ok(!html.classList.contains("dt-pick-hold"));
  await sleep(550);
  press(960, 1000);
  await sleep(400);
  assert.strictEqual(rt.globalVars.GameplayPause, 1);
  rt.globalVars.GameplayPause = 0;

  // Esc while it is still opening closes it as soon as it is open; a key the game's own keyboard got
  // anyway (its pause toggle) is undone: held while open, the earlier value back after.
  api.open();
  await sleep(100);
  assert.strictEqual(api.state(), "wait");
  assert.strictEqual(key("Escape"), true);
  rt.globalVars.GameplayPause = 0; // the game's Esc toggle
  await sleep(250);
  assert.strictEqual(rt.globalVars.GameplayPause, 1, "the hold comes back");
  await sleep(700);
  assert.strictEqual(api.isOpen(), false, "one Esc during opening closes it");
  assert.strictEqual(rt.globalVars.CreateDevicesUI, "OFF");
  assert.strictEqual(rt.globalVars.GameplayPause, 0);
  rt.globalVars.GameplayPause = 1;
  api.open();
  await sleep(550);
  rt.globalVars.GameplayPause = 0; // a leaked toggle while the player had paused
  press(960, 1000);
  await sleep(400);
  assert.strictEqual(rt.globalVars.GameplayPause, 1, "the player's pause stays");
  rt.globalVars.GameplayPause = 0;
  // A Space pressed before it opened, handled late by a slow game while it is open: work stays held, and
  // the player's pause applies on close.
  api.open();
  await sleep(550);
  rt.globalVars.GameplayPause = 0; // the game's late toggle, no key into the picker
  tickFn();
  assert.strictEqual(rt.globalVars.GameplayPause, 1, "held each tick");
  press(960, 1000);
  await sleep(400);
  assert.strictEqual(rt.globalVars.GameplayPause, 1, "the player's own pause, now");
  await sleep(500);
  assert.ok(!html.classList.contains("dt-pick-hold"), "and its badge");
  rt.globalVars.GameplayPause = 0;
  // The toolbar buttons take the cover's shade (ui.js).
  api.open();
  await sleep(550);
  assert.strictEqual(api.dim(), 0.2);
  press(960, 1000);
  await sleep(400);
  assert.strictEqual(api.dim(), 0);
  await sleep(300);

  // Esc closes it too, and never reaches the game.
  api.open();
  await sleep(550);
  assert.strictEqual(key("Escape"), true);
  await sleep(400);
  assert.strictEqual(api.isOpen(), false);
  assert.strictEqual(rt.globalVars.CreateDevicesUI, "OFF");
  assert.strictEqual(key("Escape"), false, "closed: keys are the game's again");

  // A pick does the tile's click: DeviceType, cover, LastClass/class, the name screen; the queue gets the room.
  calls.length = 0;
  api.open();
  await sleep(550);
  const tv = tileAt("TV");
  press(tv[0], tv[1]);
  await sleep(300);
  assert.strictEqual(rt.globalVars.DeviceType, "TV");
  assert.strictEqual(rt.globalVars.class, "TV NAME");
  assert.strictEqual(rt.globalVars.LastClass, "GAMEPLAY");
  assert.strictEqual(rt.globalVars.CreateDevicesUI, "OFF");
  assert.strictEqual(insts[347].opacity, 1, "the game's black cover is in");
  assert.strictEqual(rt.globalVars.GameplayPause, 0, "the create screens run as from the boss office");
  assert.deepStrictEqual(layouts, ["TV NAME"]);
  assert.deepStrictEqual(queuePicks, ["DESIGNER OFFICE 5"]);
  assert.strictEqual(api.isOpen(), false);
  assert.ok(calls.filter((c) => c === "Tap_Main").length >= 2);

  // Component tiles go to their menus without a DeviceType; the console's layout name differs from its class.
  rt.layout.name = "ENGINEER OFFICE 3";
  rt.globalVars.class = "GAMEPLAY";
  rt.globalVars.DeviceType = "";
  api.open();
  await sleep(550);
  const cpu = tileAt("CPU");
  press(cpu[0], cpu[1]);
  await sleep(300);
  assert.strictEqual(rt.globalVars.DeviceType, "");
  assert.strictEqual(rt.globalVars.class, "CPU EDITOR MENU");
  assert.strictEqual(layouts[layouts.length - 1], "CPU EDITOR MENU");
  rt.layout.name = "ENGINEER OFFICE 3";
  rt.globalVars.class = "GAMEPLAY";
  api.open();
  await sleep(550);
  assert.strictEqual(api.pick("CONSOLE"), true);
  await sleep(300);
  assert.strictEqual(rt.globalVars.class, "CONSOLE NAME");
  assert.strictEqual(layouts[layouts.length - 1], "CONSOLES NAME");

  // Any layout change (a room switch, a game move) takes it down at once and frees the game.
  rt.layout.name = "PROGRAMMER OFFICE 4";
  rt.globalVars.class = "GAMEPLAY";
  api.open();
  await sleep(550);
  assert.strictEqual(rt.globalVars.GameplayPause, 1);
  rt.goToLayout("DESIGNER OFFICE 5");
  assert.strictEqual(api.isOpen(), false);
  assert.strictEqual(rt.globalVars.CreateDevicesUI, "OFF");
  assert.strictEqual(rt.globalVars.GameplayPause, 0);
  assert.strictEqual(document.querySelector(".dt-pick"), null);
  console.log("picker runtime: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
