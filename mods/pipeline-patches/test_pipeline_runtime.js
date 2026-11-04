// Slot logic of pipeline.js with fake game, rooms and queue: node test_pipeline_runtime.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const env = {
  layout: "PROGRAMMER OFFICE 4", view: null, here: "PROGRAMMER", queue: [], why: "", replaying: "", capturing: false,
  saves: { cells: {}, width: 3, height: 200, setAt(v, x, y) { this.cells[x + "," + y] = v; }, getAt(x, y) { return this.cells[x + "," + y]; } },
  goes: [], toasts: [],
};
const gv = { OfficeType: "PROGRAMMER", class: "GAMEPLAY", GameplayPause: 0, Assistant: "OFF", CreateDevicesUI: "OFF",
  DeviceTypeCreatingNow: "LAPTOPS", DeviceName: "Folio", DevicesCount: 1, BubblesDesign: 0, BubblesTechnology: 50, BubblesBugs: 30,
  BubblesEngineers: 0, PressConferenceRandom: 0, ResearchCoins: 100, CompanyName: "Ember", SaveSlot: 1 };
globalThis.runtime = { globalVars: gv };
globalThis._dtRooms = {
  real: () => (env.view ? env.view.real : gv.OfficeType), here: () => env.here, view: () => env.view,
  canMove: () => true, go: (r) => { env.goes.push(r); env.here = r; return true; }, drop: () => { env.view = null; },
};
globalThis._dtQueueApi = {
  state: () => ({ paused: false, items: env.queue }), why: () => env.why,
  replaying: () => env.replaying, capturing: () => env.capturing,
};
// Research balance stand-in: counts raw bubble points and pays 10 coins per point.
env.raw = 0; env.paid = [];
globalThis._dtResearchRaw = () => env.raw;
// Like research.js, paying a bubble also adds it to the raw counter.
globalThis._dtResearchBubble = (n, stage) => (env.paid.push([n, stage]), (env.raw += n), n * 10);
const prelude = `
var _dtUi = { layoutName: () => env.layout, onOffice: () => / OFFICE/.test(env.layout), isOpen: () => false,
  t: (e, v) => { let s = e.en; for (const k in v || {}) s = s.split("{" + k + "}").join(v[k]); return s; }, toast: (s) => env.toasts.push(s) };
var _DTR_TEXT = { free: { en: "Free" }, DESIGNER: { en: "Design" }, PROGRAMMER: { en: "Programming" }, ENGINEER: { en: "Engineering" } };
// Like rooms.js: an OS or app is named by the game's own name variables (a device's table is not faked here).
function _dtrDevLabel(gv) {
  const t = String(gv.DeviceTypeCreatingNow || "");
  const n = t.indexOf("OS ") === 0 ? [gv.MyOS_Name, gv.MyOS_VersionName].filter(Boolean).join(" ") : t === "SOFTWARE" ? gv.CreateSoftwareChoose_Name : "";
  return n ? n + " · " + t : t;
}
function computeBubblesPlan(stage) { return { pps: { design: 10, programmer: 5, engineer: 4 }[stage] }; }
function _dtqSaves() { return env.saves; }
function _dtqSlotNow() { return 1; }
function _dtqCompanyNow() { return "Ember"; }
function _dtqStartKey() { return "2008:0"; }
function _dtqCreateButton() { return null; }
var setInterval = () => 0; var addEventListener = () => 0;`;
const src = fs.readFileSync(path.join(__dirname, "pipeline.js"), "utf8");
new Function("env", prelude + src)(env);
const P = globalThis._dtPipeApi;
const st = () => P.state();
const room = (r) => st().items.find((i) => i.room === r);

// 1. The game's item in development is adopted in its room.
P.step(0.25);
assert.strictEqual(st().items.length, 1);
assert.strictEqual(room("PROGRAMMER").vars.DeviceTypeCreatingNow, "LAPTOPS");
const A = st().focus;
// On screen the game's bubbles do the work: no simulated loss.
P.step(1);
assert.strictEqual(gv.BubblesTechnology, 50);
// Research on screen is measured in raw bubble points, not in paid coins.
for (let i = 0; i < 6; i++) { env.raw += 2; gv.ResearchCoins += 7; P.step(1); }
const rate = P.rp().PROGRAMMER.gain / P.rp().PROGRAMMER.secs;
assert.ok(rate > 1.5 && rate <= 2, "raw rate " + rate);
const coins0 = gv.ResearchCoins;
// 2. Viewing another room: the live item keeps working off screen at the planner's rate.
env.view = { room: "DESIGNER", real: "PROGRAMMER" }; env.here = "DESIGNER"; gv.OfficeType = "BOSS";
assert.strictEqual(globalThis._dtPipeBeforeRoom("DESIGNER", "PROGRAMMER"), undefined, "empty room is only viewed");
P.step(1);
assert.strictEqual(gv.BubblesTechnology, 45);
assert.strictEqual(gv.BubblesBugs, 25);
// Off screen the raw points go through the research balance with the room's stage.
assert.deepStrictEqual(env.paid, [[1, "programmer"]]);
assert.strictEqual(gv.ResearchCoins, coins0 + 10);
// 3. Design is free and the queue head is a phone: the pipeline hands room 1 to the queue.
env.queue = [{ id: "q1", type: "SMARTPHONE", names: ["Ember 9"] }];
P.step(0.25);
assert.ok(st().starting, "starting");
assert.strictEqual(gv.DeviceTypeCreatingNow, "");
assert.strictEqual(gv.OfficeType, "BOSS");
assert.strictEqual(globalThis._dtPipeHold(), false, "queue pump allowed while starting");
assert.strictEqual(room("PROGRAMMER").vars.BubblesTechnology, 44, "parked with its progress (+ the step before parking)");
// The queue replays the entry: LOADING EDITOR sets the new item's globals and the design room.
env.replaying = "q1"; P.step(0.25);
Object.assign(gv, { DeviceTypeCreatingNow: "SMARTPHONES", OfficeType: "DESIGNER", BubblesDesign: 80, BubblesTechnology: 60, BubblesBugs: 33, DeviceName: "Ember 9" });
env.replaying = ""; env.view = null; env.here = "DESIGNER"; env.layout = "DESIGNER OFFICE 5"; env.queue = [];
P.step(0.25);
assert.ok(!st().starting);
assert.strictEqual(room("DESIGNER").vars.DeviceTypeCreatingNow, "SMARTPHONES");
const B = st().focus;
assert.notStrictEqual(A, B);
assert.strictEqual(globalThis._dtPipeHold(), true, "queue pump held while items are in flight");
// 4. Parked laptop keeps working; the phone on screen is left to the game.
const t0 = room("PROGRAMMER").vars.BubblesTechnology;
P.step(1);
assert.strictEqual(room("PROGRAMMER").vars.BubblesTechnology, t0 - 5);
assert.strictEqual(gv.BubblesDesign, 80);
// 5. Same table rule: a second phone may not start while one is in flight.
env.queue = [{ id: "q2", type: "SMARTPHONE" }];
assert.strictEqual(globalThis._dtPipeHold(), true);
// 6. Switching rooms swaps the live item.
const r = globalThis._dtPipeBeforeRoom("PROGRAMMER", "DESIGNER");
assert.strictEqual(r, "PROGRAMMER");
assert.strictEqual(gv.DeviceTypeCreatingNow, "LAPTOPS");
assert.strictEqual(gv.OfficeType, "PROGRAMMER");
assert.strictEqual(gv.BubblesTechnology, t0 - 5);
assert.strictEqual(room("DESIGNER").vars.BubblesDesign, 80);
env.here = "PROGRAMMER"; env.layout = "PROGRAMMER OFFICE 4";
// 7. Parked design finishes off screen and then waits in design for the player.
P.step(1); // phone design 80 -> 70 off screen
room("DESIGNER"); 
for (let i = 0; i < 8; i++) P.step(1);
assert.strictEqual(room("DESIGNER").vars.BubblesDesign, 0);
assert.ok(room("DESIGNER"), "waits: programming is taken");
// The live design room's research rate ignores the parked laptop's off-screen points.
assert.ok(env.paid.some(([, s]) => s === "programmer"), "laptop paid off screen");
assert.strictEqual(P.rp().DESIGNER.gain, 0, "off-screen points not measured as design research");
// The live laptop finishes programming; its next-stage press is not blocked (engineering is free).
gv.BubblesTechnology = 0; gv.BubblesBugs = 0;
assert.strictEqual(P.blocked(), "");
// The game moves the laptop: BATCH sets ENGINEER (stand-in for the click + batch screen).
gv.OfficeType = "ENGINEER"; gv.BubblesEngineers = 40; env.here = "ENGINEER"; env.layout = "ENGINEER OFFICE 3";
P.step(0.25);
assert.strictEqual(room("ENGINEER").id, A);
// Jayden's bug 7: moving the laptop on must not move the finished phone too (it did, by itself).
assert.strictEqual(room("DESIGNER").id, B, "the finished design stays put");
assert.strictEqual(room("PROGRAMMER"), undefined);
// The player moves it on: its room, then the game's own next stage (OfficeType first, then the screen).
assert.strictEqual(globalThis._dtPipeBeforeRoom("DESIGNER", "ENGINEER"), "DESIGNER");
env.here = "DESIGNER"; env.layout = "DESIGNER OFFICE 5";
assert.deepStrictEqual([st().focus, gv.OfficeType, gv.BubblesDesign], [B, "DESIGNER", 0]);
gv.OfficeType = "PROGRAMMER"; env.here = "PROGRAMMER"; env.layout = "PROGRAMMER OFFICE 4";
P.step(0.25);
assert.strictEqual(room("PROGRAMMER").id, B);
assert.strictEqual(room("PROGRAMMER").vars.DeviceTypeCreatingNow, "SMARTPHONES");
// Back to engineering: the laptop is live again.
assert.strictEqual(globalThis._dtPipeBeforeRoom("ENGINEER", "PROGRAMMER"), "ENGINEER");
env.here = "ENGINEER"; env.layout = "ENGINEER OFFICE 3";
// 8. Save and load keep every item.
assert.strictEqual(globalThis._dtPipeBeforeSave(), true);
const saved = JSON.parse(env.saves.cells["1,152"]);
assert.strictEqual(saved.items.length, 2);
assert.strictEqual(saved.focusType, "LAPTOPS");
P.load();
assert.strictEqual(st().items.length, 2);
assert.strictEqual(st().focus, A);
gv.DeviceTypeCreatingNow = "TV"; P.load();
assert.strictEqual(st().focus, null, "a focus that disagrees with the game's own columns is not live");
// Kept, parked in its room with its work (this world has no device tables: treated as not out yet).
assert.strictEqual(st().items.length, 2);
assert.strictEqual(st().items.find((i) => i.id === A).room, "ENGINEER");
gv.DeviceTypeCreatingNow = "LAPTOPS"; P.load();
// 9. Release: delivery sets BOSS, reviews clear the type; the phone goes live when calm.
gv.BubblesEngineers = 0; gv.OfficeType = "BOSS"; env.layout = "REVIEWS"; env.here = "";
P.step(0.25);
assert.strictEqual(room("ENGINEER"), undefined, "engineering is free during reviews");
gv.DeviceTypeCreatingNow = ""; P.step(0.25);
assert.strictEqual(st().items.length, 1);
assert.strictEqual(st().focus, null);
env.layout = "BOSS OFFICE"; env.here = "BOSS"; P.step(0.25);
assert.strictEqual(st().focus, B);
assert.strictEqual(gv.DeviceTypeCreatingNow, "SMARTPHONES");
assert.strictEqual(gv.OfficeType, "PROGRAMMER");
assert.deepStrictEqual(env.goes.slice(-1), ["PROGRAMMER"]);
// 10. Entry types.
assert.strictEqual(P.entryType({ kind: "part", part: "CPU", platform: "SMARTPHONE" }), "CPU SMARTPHONES");
assert.strictEqual(P.entryType({ type: "VR" }), "VR CONSOLE");
assert.strictEqual(P.entryType({ kind: "part", part: "OS", platform: "LAPTOPS" }), "OS LAPTOPS");
// 11. Staff hired while the live room is on screen never got bubble timers: the room is restarted once.
const staff = [], prof = { 7: "PROGRAMMERS", 8: "DESIGNERS", 9: "PROGRAMMERS" };
const arr = (w, get) => ({ getFirstInstance: () => ({ get width() { return w(); }, getAt: get }) });
runtime.objects = {
  ArrayMyEmployees: arr(() => staff.length, (i, y) => (y === 0 ? staff[i].id : y === 3 ? staff[i].state : 0)),
  ArrayEmployees: arr(() => 600, (id, y) => (y === 4 ? prof[id] : 0)),
};
const restarts = [];
runtime.goToLayout = (n) => restarts.push(n);
Object.assign(gv, { OfficeType: "PROGRAMMER", BubblesTechnology: 40, BubblesBugs: 20 });
env.layout = "PROGRAMMER OFFICE 4"; env.here = "PROGRAMMER";
const secs = (n) => { for (let i = 0; i < n; i++) P.step(1); };
secs(20);
assert.deepStrictEqual(restarts, [], "no programmers: nothing to restart");
staff.push({ id: 8, state: "" }, { id: 9, state: "Vacation" });
secs(20);
assert.deepStrictEqual(restarts, [], "a designer or a programmer on vacation cannot work here");
staff.push({ id: 7, state: "" });
secs(11); gv.BubblesBugs -= 1; secs(11);
assert.deepStrictEqual(restarts, [], "work moving: no restart");
gv.GameplayPause = 1; secs(20); gv.GameplayPause = 0;
assert.deepStrictEqual(restarts, [], "paused: the clock does not run");
secs(13);
assert.deepStrictEqual(restarts, ["PROGRAMMER OFFICE 4"], "stuck with staff: the room starts again");
assert.strictEqual(gv.BubblesTechnology, 40, "no work lost");
assert.strictEqual(st().focus, B);
secs(30);
assert.strictEqual(restarts.length, 1, "at most once a minute");
// 12. A fresh pipeline for the waiting and lost-device cases.
const fresh = () => {
  Object.assign(env, { layout: "PROGRAMMER OFFICE 4", view: null, here: "PROGRAMMER", queue: [], why: "", replaying: "", capturing: false, toasts: [] });
  env.saves.cells = {};
  Object.assign(gv, { OfficeType: "PROGRAMMER", GameplayPause: 0, DeviceTypeCreatingNow: "SMARTPHONES", DeviceName: "Ember 9",
    BubblesDesign: 0, BubblesTechnology: 30, BubblesBugs: 10, BubblesEngineers: 0 });
  new Function("env", prelude + src)(env);
  return globalThis._dtPipeApi;
};
let Q = fresh();
const st2 = () => Q.state();
const at = (r) => st2().items.find((i) => i.room === r);
globalThis._dtQueueApi.move = (id, d) => {
  const i = env.queue.findIndex((e) => e.id === id);
  env.queue.splice(i + d, 0, env.queue.splice(i, 1)[0]);
  return true;
};
globalThis._dtQueueApi.canMove = (id, d) => env.queue.findIndex((e) => e.id === id) + d >= 0;
Q.step(0.25);
const phone = st2().focus;
// A second phone waits for the first, and says so; the laptop behind it takes the free design room.
env.queue = [{ id: "p2", type: "SMARTPHONE" }, { id: "l1", type: "LAPTOP" }];
assert.strictEqual(globalThis._dtPipeWhy(env.queue[0]), "SMARTPHONES is still in development. One device of each kind at a time.");
assert.strictEqual(globalThis._dtPipeWhy(env.queue[1]), "");
Q.step(0.25);
assert.ok(st2().starting, "the laptop starts past the waiting phone");
assert.deepStrictEqual(env.queue.map((e) => e.id), ["l1", "p2"], "moved to the front so the queue starts it");
Object.assign(gv, { DeviceTypeCreatingNow: "LAPTOPS", DeviceName: "Folio", OfficeType: "DESIGNER", BubblesDesign: 50 });
env.layout = "DESIGNER OFFICE 5"; env.here = "DESIGNER"; env.queue = [{ id: "p2", type: "SMARTPHONE" }, { id: "t1", type: "TV" }];
Q.step(0.25);
assert.strictEqual(at("DESIGNER").vars.DeviceTypeCreatingNow, "LAPTOPS");
assert.strictEqual(at("PROGRAMMER").id, phone);
assert.strictEqual(globalThis._dtPipeWhy(env.queue[1]), "Design is still working on LAPTOPS");
// The queue records a new entry: its screens change the globals, nothing in the pipeline moves.
const before = JSON.stringify(st2().items.map((i) => [i.id, i.room]));
env.capturing = true;
Object.assign(gv, { DeviceTypeCreatingNow: "", OfficeType: "BOSS", BubblesDesign: 0 });
for (let i = 0; i < 3; i++) Q.step(0.25);
assert.strictEqual(JSON.stringify(st2().items.map((i) => [i.id, i.room])), before, "capture leaves the items alone");
env.capturing = false;
Object.assign(gv, { DeviceTypeCreatingNow: "LAPTOPS", OfficeType: "DESIGNER", BubblesDesign: 50 });
Q.step(0.25);
assert.strictEqual(st2().items.length, 2);
// The game moves the live laptop into programming (its own next button, e.g. pressed while paused) while
// the phone is parked there. The phone keeps the room and goes live on its screen, which starts again for
// it; the laptop waits for programming with its work. (It used to push the phone back to design, where it
// sat "finished", and the phone came back to finish programming at once: Jayden's playtest bugs 2 and 4.)
const lap = st2().focus, phoneTech = st2().items.find((i) => i.id === phone).vars.BubblesTechnology;
env.goes = []; env.toasts = []; env.queue = [];
gv.BubblesDesign = 0; gv.OfficeType = "PROGRAMMER"; env.here = "PROGRAMMER"; env.layout = "PROGRAMMER OFFICE 4";
Q.step(0.25);
assert.strictEqual(st2().focus, phone, "the phone is live in its own room");
assert.strictEqual(at("PROGRAMMER").id, phone);
assert.strictEqual(gv.DeviceTypeCreatingNow, "SMARTPHONES");
assert.strictEqual(gv.OfficeType, "PROGRAMMER");
assert.strictEqual(gv.BubblesTechnology, phoneTech, "with its own work left");
const lapIt = () => st2().items.find((i) => i.id === lap);
assert.strictEqual(lapIt().room, "DESIGNER", "the laptop stays in design, marked to go");
assert.strictEqual(lapIt().go, "PROGRAMMER");
assert.strictEqual(lapIt().vars.DeviceTypeCreatingNow, "LAPTOPS");
assert.strictEqual(lapIt().vars.BubblesDesign, 0);
assert.strictEqual(globalThis._dtPipeRoomLabel("DESIGNER"), "LAPTOPS · Waiting for Programming");
assert.deepStrictEqual(env.goes, ["PROGRAMMER"], "the programming screen starts again for the phone");
assert.ok(env.toasts.some((s) => /^LAPTOPS will move to Programming when it's free/.test(s)), "says so: " + env.toasts);
// The phone leaves programming (its own next-stage move): the laptop goes in by itself, parked.
gv.BubblesTechnology = 0; gv.BubblesBugs = 0; gv.OfficeType = "ENGINEER"; gv.BubblesEngineers = 40;
env.here = "ENGINEER"; env.layout = "ENGINEER OFFICE 3";
Q.step(0.25);
assert.strictEqual(at("ENGINEER").id, phone);
assert.strictEqual(lapIt().room, "PROGRAMMER", "the laptop went into programming");
assert.strictEqual(lapIt().go, undefined);
// A save with two items in one room (older build) keeps both.
Q.save();
const raw = JSON.parse(env.saves.cells["1,152"]);
raw.items.find((i) => i.id === phone).room = "PROGRAMMER";
env.saves.cells["1,152"] = JSON.stringify(raw);
gv.OfficeType = "PROGRAMMER"; gv.BubblesEngineers = 0; env.here = "PROGRAMMER"; env.layout = "PROGRAMMER OFFICE 4";
Q.load();
assert.strictEqual(st2().items.length, 2, "nothing dropped on load");
assert.strictEqual(at("DESIGNER").id, lap);
// A device the pipeline does not hold appears in a room a parked item holds: both are kept.
Q = fresh();
Q.step(0.25);
const ph = st2().focus;
// After a load the game's own columns hold another device than the saved live one.
Q.save();
const r2 = JSON.parse(env.saves.cells["1,152"]);
r2.focus = null; r2.focusType = "";
env.saves.cells["1,152"] = JSON.stringify(r2);
Object.assign(gv, { DeviceTypeCreatingNow: "TV", DeviceName: "Big", OfficeType: "PROGRAMMER", BubblesTechnology: 20 });
Q.load();
assert.strictEqual(st2().focus, null);
Q.step(0.25);
assert.strictEqual(st2().items.length, 2, "parked phone not overwritten");
assert.strictEqual(at("PROGRAMMER").vars.DeviceTypeCreatingNow, "TV");
assert.strictEqual(at("DESIGNER").id, ph);
assert.strictEqual(at("DESIGNER").vars.DeviceTypeCreatingNow, "SMARTPHONES");
// 13. Two phones at once (devices with a table): the second starts design while the first is in engineering,
// and the live phone's own row is always x = 0, where BATCH, REVIEWS, press and launch read it.
const mkRow = (name, rel, cost) => [0, 1, 2].map((y) => Array.from({ length: 12 }, (_, z) =>
  z === 8 || z === 7 ? (y ? -1 : z === 8 ? name : rel) : z === 3 ? cost + y : z === 11 ? name + "#" + y : 0));
const phones = { rows: [mkRow("Arc 2", -1, 300), mkRow("Arc", 121, 200)], height: 3, depth: 12,
  get width() { return this.rows.length; }, getAt(x, y, z) { return this.rows[x][y][z]; }, setAt(v, x, y, z) { this.rows[x][y][z] = v; } };
runtime.objects.ArraySmartphones = { getFirstInstance: () => phones };
const names = () => phones.rows.map((r) => r[0][8]);
const fresh2 = () => {
  Object.assign(env, { layout: "ENGINEER OFFICE 3", view: null, here: "ENGINEER", queue: [], why: "", replaying: "", capturing: false, toasts: [] });
  env.saves.cells = {};
  Object.assign(gv, { OfficeType: "ENGINEER", GameplayPause: 0, DeviceTypeCreatingNow: "SMARTPHONES", DeviceName: "Arc 2",
    BubblesDesign: 0, BubblesTechnology: 0, BubblesBugs: 0, BubblesEngineers: 83 });
  new Function("env", prelude + 'var _DTR_ARRAY = { SMARTPHONES: "ArraySmartphones" };' + src)(env);
  return globalThis._dtPipeApi;
};
Q = fresh2();
Q.step(0.25);
const arc2 = st2().focus;
assert.strictEqual(at("ENGINEER").id, arc2);
env.queue = [{ id: "q9", type: "SMARTPHONE", names: ["Arc 2 Pro"] }];
assert.strictEqual(globalThis._dtPipeWhy(env.queue[0]), "", "a phone no longer waits for the phone in engineering");
Q.step(0.25);
assert.ok(st2().starting, "Arc 2 Pro starts");
// LOADING EDITOR pushes the new row to the front and sets the globals.
env.replaying = "q9"; Q.step(0.25);
phones.rows.unshift(mkRow("Arc 2 Pro", -1, 400));
Object.assign(gv, { DeviceTypeCreatingNow: "SMARTPHONES", DeviceName: "Arc 2 Pro", OfficeType: "DESIGNER", BubblesDesign: 90, BubblesEngineers: 0 });
env.replaying = ""; env.here = "DESIGNER"; env.layout = "DESIGNER OFFICE 5"; env.queue = [];
Q.step(0.25);
assert.strictEqual(st2().items.length, 2);
const pro = at("DESIGNER").id;
assert.strictEqual(st2().focus, pro);
assert.strictEqual(at("DESIGNER").key, "Arc 2 Pro|-1|-1");
assert.ok(at("ENGINEER").vars.BubblesEngineers > 70, "Arc 2 keeps its engineering work");
assert.strictEqual(globalThis._dtPipeRoomLabel("ENGINEER"), "Arc 2 · SMARTPHONES", "a parked phone shows its own name and kind");
// Arc 2 keeps working off screen while Arc 2 Pro is designed.
Q.step(1);
assert.ok(at("ENGINEER").vars.BubblesEngineers < 83);
// Back to engineering: Arc 2 goes live and its row moves to the front, every cell with it.
assert.strictEqual(globalThis._dtPipeBeforeRoom("ENGINEER", "DESIGNER"), "ENGINEER");
assert.strictEqual(gv.DeviceName, "Arc 2");
assert.deepStrictEqual(names(), ["Arc 2", "Arc 2 Pro", "Arc"]);
assert.deepStrictEqual([phones.getAt(0, 2, 3), phones.getAt(0, 1, 11), phones.getAt(1, 0, 3), phones.getAt(2, 0, 7)], [302, "Arc 2#1", 400, 121]);
assert.strictEqual(at("ENGINEER").key, "Arc 2|-1|-1", "older items get their key from their name");
// Save and load keep the keys; a v1 save without keys still finds the rows by name.
Q.save();
const r3 = JSON.parse(env.saves.cells["1,152"]);
assert.strictEqual(r3.v, 1);
assert.deepStrictEqual(r3.items.map((i) => i.key), ["Arc 2|-1|-1", "Arc 2 Pro|-1|-1"]);
for (const i of r3.items) delete i.key;
env.saves.cells["1,152"] = JSON.stringify(r3);
Q.load();
assert.strictEqual(st2().items.length, 2);
assert.strictEqual(globalThis._dtPipeBeforeRoom("DESIGNER", "ENGINEER"), "DESIGNER");
assert.deepStrictEqual(names(), ["Arc 2 Pro", "Arc 2", "Arc"], "found by name after a v1 load");
assert.strictEqual(globalThis._dtPipeBeforeRoom("ENGINEER", "DESIGNER"), "ENGINEER");
assert.deepStrictEqual(names(), ["Arc 2", "Arc 2 Pro", "Arc"]);
// A real v1 save: Arc 2 Pro live in design, Arc 2 parked with the placeholder name and no key.
// Arc 2 still finds its row as the only unreleased one Arc 2 Pro does not hold.
assert.strictEqual(globalThis._dtPipeBeforeRoom("DESIGNER", "ENGINEER"), "DESIGNER");
Q.save();
const r4 = JSON.parse(env.saves.cells["1,152"]);
for (const i of r4.items) { delete i.key; if (i.id !== r4.focus) i.vars.DeviceName = "Device Name"; }
env.saves.cells["1,152"] = JSON.stringify(r4);
Q.load();
assert.strictEqual(globalThis._dtPipeBeforeRoom("DESIGNER", "ENGINEER"), "DESIGNER");
assert.strictEqual(globalThis._dtPipeRoomLabel("ENGINEER"), "Arc 2 · SMARTPHONES", "placeholder name: label comes from the row");
assert.strictEqual(globalThis._dtPipeBeforeRoom("ENGINEER", "DESIGNER"), "ENGINEER");
assert.deepStrictEqual(names(), ["Arc 2", "Arc 2 Pro", "Arc"], "placeholder name: Arc 2's row moves to the front");
assert.strictEqual(at("ENGINEER").key, "Arc 2|-1|-1");
// Arc 2 is released (BATCH fills its release column at x = 0) and leaves the rooms;
// after the reviews Arc 2 Pro goes live with its row back at the front.
phones.setAt(130, 0, 0, 7);
Object.assign(gv, { DeviceTypeCreatingNow: "", OfficeType: "BOSS" }); env.layout = "BOSS OFFICE"; env.here = "BOSS";
Q.step(0.25);
assert.deepStrictEqual(st2().items.map((i) => i.id), [pro]);
Q.step(0.25);
assert.strictEqual(st2().focus, pro);
assert.strictEqual(gv.DeviceName, "Arc 2 Pro");
assert.deepStrictEqual(names(), ["Arc 2 Pro", "Arc 2", "Arc"]);
assert.deepStrictEqual(env.goes.slice(-1), ["DESIGNER"]);
// 14. After a load no room has been measured on screen: an item off screen
// still earns its staff's research (the game's rate), not nothing.
Q = fresh();
Q.step(0.25);
globalThis._dtResearchRoomRate = (stage) => (stage === "programmer" ? 3 : 0);
env.view = { room: "DESIGNER", real: "PROGRAMMER" }; env.here = "DESIGNER"; gv.OfficeType = "BOSS";
const raw13 = env.raw;
Q.step(1); Q.step(1);
assert.strictEqual(env.raw - raw13, 6, "unmeasured room off screen earns 3 points a second");
// 16. Rooms watched on screen landed half the staff rate: off screen pays half too.
env.view = null; env.here = "PROGRAMMER"; gv.OfficeType = "PROGRAMMER";
for (let i = 0; i < 6; i++) { env.raw += 1.5; Q.step(1); }
env.view = { room: "DESIGNER", real: "PROGRAMMER" }; env.here = "DESIGNER"; gv.OfficeType = "BOSS";
const raw16 = env.raw;
Q.step(1); Q.step(1);
assert.ok(Math.abs(env.raw - raw16 - 3) < 0.01, "off screen pays the share landed on screen: " + (env.raw - raw16));
// 15. The timer steps by game seconds, like the staff timers: a lagging frame
// rate or the faster skip clock changes wall time, not what a room earns.
Q = fresh();
Q.step(0.25);
globalThis.runtime.gameTime = 100; Q.tick(); // first tick loads the saved row
globalThis._dtResearchRoomRate = (stage) => (stage === "programmer" ? 3 : 0);
env.view = { room: "DESIGNER", real: "PROGRAMMER" }; env.here = "DESIGNER"; gv.OfficeType = "BOSS";
globalThis.runtime.gameTime = 101; Q.tick();
const raw15 = env.raw;
globalThis.runtime.gameTime = 103; Q.tick();
assert.strictEqual(env.raw - raw15, 6, "2 game seconds pay 2 seconds of research");
globalThis.runtime.gameTime = 500; Q.tick();
assert.strictEqual(env.raw - raw15, 6, "a clock jump from a load pays nothing");
delete globalThis.runtime.gameTime;
delete globalThis._dtResearchRoomRate;
// 17. Press conference: it reads the last model's rating at x = 1 of the live
// item's table and x = 0 of the others. Rows still in the works or waiting for
// their launch day have none ("---"): for its start the rated rows come first.
const rated = (r, v) => (r[0][5] = v, r);
phones.rows = [rated(mkRow("Arc 2 Pro", -1, 400), "---"), rated(mkRow("Arc 2", 488, 300), "---"), rated(mkRow("Arc", 121, 200), 6)];
const laps = { rows: [rated(mkRow("Folio 2", -1, 500), "---"), rated(mkRow("Folio", 90, 450), 3)], height: 3, depth: 12,
  get width() { return this.rows.length; }, getAt(x, y, z) { return this.rows[x][y][z]; }, setAt(v, x, y, z) { this.rows[x][y][z] = v; } };
runtime.objects.ArrayLaptops = { getFirstInstance: () => laps };
new Function("env", prelude + 'var _DTR_ARRAY = { SMARTPHONES: "ArraySmartphones", LAPTOPS: "ArrayLaptops" };' + src)(env);
Q = globalThis._dtPipeApi;
gv.DeviceTypeCreatingNow = "SMARTPHONES";
const lapNames = () => laps.rows.map((r) => r[0][8]);
Q.pressStart({ layout: { name: "BOSS OFFICE" } });
assert.deepStrictEqual(names(), ["Arc 2 Pro", "Arc 2", "Arc"], "other layouts leave the rows alone");
Q.pressStart({ layout: { name: "PRESS CONFERENCE" } });
assert.deepStrictEqual(names(), ["Arc 2 Pro", "Arc", "Arc 2"], "live phone stays at x = 0, the last rated phone is x = 1");
assert.strictEqual(phones.getAt(1, 0, 5), 6);
assert.deepStrictEqual(lapNames(), ["Folio", "Folio 2"], "other kind: the rated laptop is x = 0");
assert.deepStrictEqual([phones.getAt(1, 2, 3), phones.getAt(2, 1, 11)], [202, "Arc 2#1"], "whole rows move");
Q.pressEnd();
assert.deepStrictEqual(names(), ["Arc 2 Pro", "Arc 2", "Arc"], "rows go back after the start");
assert.deepStrictEqual(lapNames(), ["Folio 2", "Folio"]);
assert.deepStrictEqual([phones.getAt(2, 2, 3), phones.getAt(1, 1, 11)], [202, "Arc 2#1"]);
Q.pressEnd();
assert.deepStrictEqual(names(), ["Arc 2 Pro", "Arc 2", "Arc"], "a second end changes nothing");
// 17b. A save whose live laptop the game no longer shows: kept parked while its row is
// unreleased, dropped once that laptop is out (no ghost of a released device).
const lapKey = [0, 1, 2].map((y) => String(laps.getAt(0, y, 8))).join("|");
const row17 = (rel) => {
  laps.rows[0].forEach((r) => (r[7] = rel));
  env.saves.cells["1,152"] = JSON.stringify({ v: 1, company: saved.company, focus: "L1", focusType: "LAPTOPS",
    items: [{ id: "L1", room: "ENGINEER", key: lapKey, vars: { DeviceTypeCreatingNow: "LAPTOPS", DeviceName: "Folio 2", BubblesEngineers: 30 } }] });
};
const gvType17 = gv.DeviceTypeCreatingNow;
gv.DeviceTypeCreatingNow = "TV";
row17(-1); Q.load();
assert.deepStrictEqual(Q.state().items.map((i) => [i.id, i.room]), [["L1", "ENGINEER"]], "unreleased: kept");
assert.strictEqual(Q.state().focus, null);
row17(77); Q.load();
assert.strictEqual(Q.state().items.length, 0, "released: dropped");
laps.rows[0].forEach((r) => (r[7] = -1));
gv.DeviceTypeCreatingNow = gvType17;
delete runtime.objects.ArrayLaptops;
// 18. A planned launch day while another phone is live: the reviews park it and put
// the waiting phone's line at x = 0. The pipeline must not take the live phone back
// (its row would go to the front and the game would release the wrong phone).
phones.rows = [mkRow("Arc 2 Pro", -1, 400), mkRow("Arc 2", 638, 300), mkRow("Arc", 121, 200)];
Object.assign(env, { layout: "PROGRAMMER OFFICE 4", view: null, here: "PROGRAMMER", queue: [], replaying: "", capturing: false });
env.saves.cells = {};
Object.assign(gv, { OfficeType: "PROGRAMMER", Assistant: "OFF", DeviceTypeCreatingNow: "SMARTPHONES", DeviceName: "Arc 2 Pro",
  BubblesDesign: 0, BubblesTechnology: 40, BubblesBugs: 20, BubblesEngineers: 0 });
new Function("env", prelude + 'var _DTR_ARRAY = { SMARTPHONES: "ArraySmartphones" };' + src +
  ";globalThis._tRw = { park: () => _dtpPark(_dtpGv()), refocus: () => (_dtpRefocus = true) };")(env);
Q = globalThis._dtPipeApi;
Q.step(0.25);
const pro18 = Q.state().focus;
assert.ok(pro18, "Arc 2 Pro is live");
const rw = { run: null };
globalThis._dtReviewsApi = { state: () => rw };
globalThis._tRw.park();
phones.rows = [phones.rows[1], phones.rows[0], phones.rows[2]];
phones.setAt(-1, 0, 0, 7);
rw.run = { x: 1 }; gv.Assistant = "ON";
Q.step(0.25); Q.step(0.25);
assert.deepStrictEqual(names(), ["Arc 2", "Arc 2 Pro", "Arc"], "the waiting phone stays at x = 0 for its reviews");
assert.strictEqual(Q.state().focus, null, "nothing goes live during the reviews");
// The last review click releases x = 0; the reviews put the lines back and end.
phones.setAt(640, 0, 0, 7);
phones.rows = [phones.rows[1], phones.rows[0], phones.rows[2]];
rw.run = null; gv.Assistant = "OFF"; gv.DeviceTypeCreatingNow = "";
globalThis._tRw.refocus();
Q.step(0.25);
assert.strictEqual(Q.state().focus, pro18, "Arc 2 Pro goes live again");
assert.strictEqual(gv.DeviceName, "Arc 2 Pro");
assert.deepStrictEqual(names(), ["Arc 2 Pro", "Arc 2", "Arc"]);
assert.deepStrictEqual([phones.getAt(0, 0, 7), phones.getAt(1, 0, 7)], [-1, 640], "Arc 2 is the phone on sale");
delete globalThis._dtReviewsApi; delete globalThis._tRw;
// 9. Jayden's playtest bug 2: a live item enters engineering (its copies screen) while a parked one
// is still producing there. The one already there keeps engineering and goes live on that screen; the
// newcomer waits with its batch made and its work kept (stepping it back would show the copies screen
// again), and goes in by itself once engineering is free. Nothing vanishes.
env.saves.cells = {}; env.view = null; env.queue = []; env.layout = "ENGINEER OFFICE 1"; env.here = "ENGINEER";
Object.assign(gv, { OfficeType: "ENGINEER", Assistant: "OFF", DeviceTypeCreatingNow: "CPU SMARTPHONES", DeviceName: "H3 Pro",
  BubblesDesign: 0, BubblesTechnology: 0, BubblesBugs: 0, BubblesEngineers: 169 });
new Function("env", prelude + src + ";globalThis._tW = { park: () => _dtpPark(_dtpGv()) };")(env);
const W = globalThis._dtPipeApi;
const wroom = (r) => W.state().items.find((i) => i.room === r);
W.step(0.25);
const cpu = W.state().focus;
assert.ok(cpu && wroom("ENGINEER").id === cpu, "the processor is live in engineering");
globalThis._tW.park();
Object.assign(gv, { OfficeType: "PROGRAMMER", DeviceTypeCreatingNow: "SMARTPHONES", DeviceName: "Arc 4", BubblesEngineers: 0 });
env.layout = "PROGRAMMER OFFICE 1"; env.here = "PROGRAMMER";
W.step(0.25);
const arc4 = W.state().focus;
assert.ok(arc4 && arc4 !== cpu && wroom("PROGRAMMER").id === arc4, "the phone is live in programming");
// The phone's copies screen: the game sets ENGINEER while the screen is still the copies screen.
const cpuEng = W.state().items.find((i) => i.id === cpu).vars.BubblesEngineers;
Object.assign(gv, { OfficeType: "ENGINEER", BubblesEngineers: 30 });
env.layout = "BATCH"; env.here = "";
env.goes = []; env.toasts = [];
W.step(0.25);
assert.strictEqual(wroom("ENGINEER").id, cpu, "on the copies screen nothing moves yet");
assert.strictEqual(W.state().focus, arc4);
// Engineering's screen starts with the phone in the globals.
env.layout = "ENGINEER OFFICE 1"; env.here = "ENGINEER";
W.step(0.25);
const phoneIt = () => W.state().items.find((i) => i.id === arc4);
assert.strictEqual(wroom("ENGINEER").id, cpu, "the processor keeps engineering");
assert.strictEqual(W.state().focus, cpu, "and is live on its screen");
assert.strictEqual(gv.DeviceTypeCreatingNow, "CPU SMARTPHONES");
assert.strictEqual(gv.BubblesEngineers, cpuEng, "with its own work left");
assert.deepStrictEqual(env.goes, ["ENGINEER"], "engineering starts again for the processor");
assert.deepStrictEqual(env.toasts, ["SMARTPHONES will move to Engineering when it's free"], "says so");
assert.strictEqual(phoneIt().room, "PROGRAMMER", "the phone keeps showing in programming");
assert.strictEqual(phoneIt().go, "ENGINEER");
assert.strictEqual(phoneIt().vars.BubblesEngineers, 30, "with its batch's work");
assert.strictEqual(globalThis._dtPipeRoomLabel("PROGRAMMER"), "SMARTPHONES · Waiting for Engineering");
assert.deepStrictEqual(globalThis._dtPipeMarked(), ["Waiting for Engineering: SMARTPHONES"], "for the Build queue page");
// Saved and loaded, the mark is kept (pipeline row 152).
W.save(); W.load();
assert.strictEqual(phoneIt().go, "ENGINEER", "mark survives a save");
// Back in programming the phone's press is caught: its copies are made, no second copies screen.
assert.strictEqual(globalThis._dtPipeBeforeRoom("PROGRAMMER", "ENGINEER"), "PROGRAMMER");
env.layout = "PROGRAMMER OFFICE 1"; env.here = "PROGRAMMER";
assert.strictEqual(W.blocked(), "ENGINEER", "a marked item's press is caught");
assert.strictEqual(globalThis._dtPipeBeforeRoom("ENGINEER", "PROGRAMMER"), "ENGINEER");
env.layout = "ENGINEER OFFICE 1"; env.here = "ENGINEER";
// The processor leaves engineering (batch delivery): the phone goes in by itself with its work.
Object.assign(gv, { OfficeType: "BOSS", DeviceTypeCreatingNow: "", BubblesEngineers: 0 });
env.layout = "BATCH DELIVERY"; env.here = "";
W.step(0.25);
assert.strictEqual(phoneIt().room, "ENGINEER", "in engineering");
assert.strictEqual(phoneIt().go, undefined);
assert.ok(phoneIt().vars.BubblesEngineers === 30 && phoneIt().vars.DeviceTypeCreatingNow === "SMARTPHONES", "its engineering work is kept");
delete globalThis._tW;
// 10. The game does not save DeviceName: after a load the live item's name comes back
// (from its saved globals) instead of the game's "Device Name" default.
env.saves.cells = {}; env.view = null; env.queue = []; env.layout = "ENGINEER OFFICE 1"; env.here = "ENGINEER";
Object.assign(gv, { OfficeType: "ENGINEER", Assistant: "OFF", DeviceTypeCreatingNow: "SMARTPHONES", DeviceName: "Arc 5",
  BubblesDesign: 0, BubblesTechnology: 0, BubblesBugs: 0, BubblesEngineers: 120 });
new Function("env", prelude + src)(env);
const W10 = globalThis._dtPipeApi;
W10.step(0.25);
const live10 = W10.state().focus;
assert.ok(live10, "an item is live");
W10.save();
const realName = String(gv.DeviceName);
assert.ok(realName && realName !== "Device Name");
gv.DeviceName = "Device Name";
W10.load();
assert.strictEqual(gv.DeviceName, realName, "name back after a load");
W10.step(0.25);
assert.strictEqual(W10.state().focus, live10, "still the same live item");
assert.strictEqual(W10.state().items.filter((i) => i.id === live10).length, 1);
// 11. Saved with a live item the game's columns then disagree with (nothing in development):
// the item is kept, parked in its room with its work, instead of being lost.
W10.save();
gv.DeviceTypeCreatingNow = "";
W10.load();
const kept11 = W10.state().items.find((i) => i.id === live10);
assert.ok(kept11, "the item is not dropped");
assert.strictEqual(kept11.room, "ENGINEER");
assert.strictEqual(W10.state().focus, null, "parked, not live");
assert.ok(Number(kept11.vars.BubblesEngineers) > 0, "its work is kept");
// 19. A parked design that is finished never moves on (or rolls its press-conference chance) by itself,
// even with programming free and across a save: it waits for the player's press, where the game rolls it.
{
  env.saves.cells = {}; env.view = null; env.queue = []; env.layout = "BOSS OFFICE 1"; env.here = "BOSS";
  Object.assign(gv, { OfficeType: "BOSS", Assistant: "OFF", DeviceTypeCreatingNow: "", DeviceName: "" });
  new Function("env", prelude + src + ";globalThis._t19 = { dtp: () => _dtp };")(env);
  const T = globalThis._t19;
  const a = { id: "a", room: "DESIGNER", vars: { DeviceTypeCreatingNow: "TV", BubblesDesign: 0, BubblesTechnology: 9, PressConferenceRandom: 0 } };
  T.dtp().items.push(a);
  for (let i = 0; i < 5; i++) globalThis._dtPipeApi.step(0.25);
  globalThis._dtPipeApi.save(); globalThis._dtPipeApi.load();
  for (let i = 0; i < 5; i++) globalThis._dtPipeApi.step(0.25);
  const a2 = T.dtp().items.find((i) => i.id === "a");
  assert.deepStrictEqual([a2.room, a2.vars.PressConferenceRandom, a2.vars.BubblesTechnology], ["DESIGNER", 0, 9]);
  assert.strictEqual(globalThis._dtPipeRoomLabel("DESIGNER"), "TV · Ready");
  delete globalThis._t19;
}
// 20. New Game drops every pending move of the old campaign (a room to show, a start in flight).
{
  env.saves.cells = {}; env.view = null; env.queue = []; env.layout = "BOSS OFFICE 1"; env.here = "BOSS";
  Object.assign(gv, { OfficeType: "BOSS", DeviceTypeCreatingNow: "" });
  new Function("env", prelude + src + ";globalThis._t20 = { set: () => { _dtpGoTo = \"ENGINEER\"; _dtpStarting = { at: Date.now(), prev: null }; _dtpRefocus = true; } };")(env);
  globalThis._t20.set();
  env.layout = "LOADING GAME"; gv.LoadingType = "NEW GAME";
  globalThis._dtPipeApi.tick();
  assert.deepStrictEqual([globalThis._dtPipeApi.state().goTo, globalThis._dtPipeApi.state().starting], ["", null], "new game: nothing pending");
  delete gv.LoadingType; delete globalThis._t20;
}
// 21. Old keyless save: a laptop is live and a parked phone has the placeholder name. The phone's
// row is the only unreleased one at x = 0 of the phone table; the laptop holds no phone row.
{
  const row = (name, rel) => [0, 1, 2].map((y) => Array.from({ length: 12 }, (_, z) => (z === 8 ? (y ? -1 : name) : z === 7 ? (y ? -1 : rel) : 0)));
  const tab = (rows) => ({ rows, height: 3, depth: 12, get width() { return this.rows.length; },
    getAt(x, y, z) { return this.rows[x][y][z]; }, setAt(v, x, y, z) { this.rows[x][y][z] = v; } });
  const ph = tab([row("Arc 3", -1), row("Arc", 121)]);
  runtime.objects.ArraySmartphones = { getFirstInstance: () => ph };
  env.saves.cells = {}; env.view = null; env.queue = []; env.layout = "DESIGNER OFFICE 5"; env.here = "DESIGNER";
  Object.assign(gv, { OfficeType: "DESIGNER", DeviceTypeCreatingNow: "LAPTOPS", DeviceName: "Folio" });
  new Function("env", prelude + 'var _DTR_ARRAY = { SMARTPHONES: "ArraySmartphones", LAPTOPS: "ArrayLaptops" };' + src +
    ";globalThis._t21 = { dtp: () => _dtp, rowOf: (a, it) => _dtpRowOf(a, it, _dtpGv()) };")(env);
  const T = globalThis._t21;
  T.dtp().items.push({ id: "L", room: "DESIGNER", vars: { DeviceTypeCreatingNow: "LAPTOPS" } },
    { id: "P", room: "ENGINEER", vars: { DeviceTypeCreatingNow: "SMARTPHONES", DeviceName: "Device Name" } });
  T.dtp().focus = "L";
  const P = T.dtp().items[1];
  assert.strictEqual(T.rowOf(ph, P), 0, "the parked phone finds its own row at x = 0");
  assert.strictEqual(P.key, "Arc 3|-1|-1");
  // A live phone does hold x = 0 of the phone table.
  T.dtp().items[0].vars.DeviceTypeCreatingNow = "SMARTPHONES"; gv.DeviceTypeCreatingNow = "SMARTPHONES"; delete P.key;
  assert.strictEqual(T.rowOf(ph, P), -1, "a live phone holds x = 0");
  delete globalThis._t21;
}
// 22. An older build could park an OS right after its release (room "", nothing to wait for):
// such a ghost is dropped on load, so it no longer blocks the next OS of its kind or the queue.
{
  env.saves.cells = {}; env.view = null; env.queue = []; env.layout = "DESIGNER OFFICE 5"; env.here = "DESIGNER";
  Object.assign(gv, { OfficeType: "DESIGNER", DeviceTypeCreatingNow: "LAPTOPS", DeviceName: "Folio", BubblesDesign: 40 });
  new Function("env", prelude + 'var _DTR_ARRAY = { SMARTPHONES: "ArraySmartphones", LAPTOPS: "ArrayLaptops" };' + src)(env);
  const P = globalThis._dtPipeApi;
  env.saves.cells["1,152"] = JSON.stringify({ v: 1, company: "Ember", start: "2008:0", focus: "L", focusType: "LAPTOPS", items: [
    { id: "L", room: "DESIGNER", vars: { DeviceTypeCreatingNow: "LAPTOPS", BubblesDesign: 40 } },
    { id: "G", room: "", vars: { DeviceTypeCreatingNow: "OS SMARTPHONES" } },
    { id: "W", room: "", wait: "ENGINEER", vars: { DeviceTypeCreatingNow: "CPU LAPTOPS", BubblesEngineers: 9 } }] });
  P.load();
  assert.deepStrictEqual(P.state().items.map((i) => i.id), ["L", "W"], "the released OS ghost is gone; a waiting item stays");
  assert.strictEqual(globalThis._dtPipeWhy({ kind: "part", part: "OS", platform: "SMARTPHONES" }), "Design is still working on LAPTOPS",
    "a new phone OS no longer waits for the ghost");
}
// 23. The centre-button catcher for a blocked next stage leaves presses meant for something on top
// (a mod panel, the game's pause menu: rooms.js _dtrPressElsewhere) alone: no "still working" toast behind.
// Paused with Space nothing covers the office and the game's own next-stage click still works (Jayden's
// playtest bug 2: a phone went into engineering over a processor), so that press is caught like any other.
{
  env.toasts = []; env.open = false;
  Object.assign(gv, { class: "GAMEPLAY", GameplayPause: 0 });
  const pre = prelude.replace("isOpen: () => false", "isOpen: () => env.open")
    .replace("function _dtqCreateButton() { return null; }",
      "function _dtqCreateButton() { return { layer: { cssPxToLayer: (x, y) => [x, y] }, containsPoint: () => true }; }" +
      "function _dtrPressElsewhere(ev) { return !!(ev.target && ev.target.menu); }");
  new Function("env", pre + src + ";_dtpBlocked = () => 'ENGINEER'; globalThis._t23 = _dtpOnPress;" +
    "_dtp.items.push({ id: 'F', room: 'PROGRAMMER', vars: { DeviceTypeCreatingNow: 'TV' } }); _dtp.focus = 'F';")(env);
  const press = (target) => {
    const ev = { type: "pointerdown", button: 0, clientX: 5, clientY: 5, target: target || null, stopped: false,
      stopImmediatePropagation() { this.stopped = true; }, preventDefault() {} };
    globalThis._t23(ev);
    return ev.stopped;
  };
  assert.strictEqual(press(), true, "a press on the blocked centre button is caught");
  env.open = true;
  assert.strictEqual(press(), false, "not while a mod panel is open");
  env.open = false; gv.GameplayPause = 1;
  assert.strictEqual(press({ menu: true }), false, "not on the game's pause menu");
  assert.strictEqual(press(), true, "paused with nothing on top: still caught");
  gv.GameplayPause = 0;
  assert.strictEqual(env.toasts.length, 2, "a toast for each real press only");
  delete globalThis._t23;
}
// 24. Difficulty flag off (no research.js): an unmeasured room off screen still pays the game's
// normal research, from its staff's own bubble timers (stat 10, mood 0: 1/1.4 a second each).
{
  const keep = { raw: globalThis._dtResearchRaw, bubble: globalThis._dtResearchBubble, rate: globalThis._dtResearchRoomRate };
  delete globalThis._dtResearchRaw; delete globalThis._dtResearchBubble; delete globalThis._dtResearchRoomRate;
  env.saves.cells = {}; env.view = null; env.queue = []; env.layout = "PROGRAMMER OFFICE 4"; env.here = "PROGRAMMER";
  Object.assign(gv, { OfficeType: "PROGRAMMER", DeviceTypeCreatingNow: "LAPTOPS", DeviceName: "Folio", BubblesDesign: 0,
    BubblesTechnology: 500, BubblesBugs: 300, ResearchCoins: 100, class: "GAMEPLAY", GameplayPause: 0 });
  const game = `
var STAGES = { design: {}, programmer: {}, engineer: {} };
function _inst45(rt, n) { return { getAt: () => 0 }; }
function _at41(a, x, y, z) { return a ? a.getAt(x, y, z) : undefined; }
function _officeStaff(rt, st) { return { workers: [{ id: 0 }, { id: 1 }] }; }`;
  new Function("env", prelude + game + src)(env);
  const P = globalThis._dtPipeApi;
  P.step(0.25);
  env.view = { room: "DESIGNER", real: "PROGRAMMER" }; env.here = "DESIGNER"; gv.OfficeType = "BOSS";
  const c0 = gv.ResearchCoins;
  for (let i = 0; i < 7; i++) P.step(1);
  assert.strictEqual(gv.ResearchCoins - c0, 10, "2 workers x 1/1.4 a second x 7 s, whole coins");
  globalThis._dtResearchRaw = keep.raw; globalThis._dtResearchBubble = keep.bubble;
  if (keep.rate) globalThis._dtResearchRoomRate = keep.rate;
}
// 25. Two phones in development with exactly the same variant names share a key: the
// game's own row ID (column 10) keeps each on its own row, also after save and load.
{
  const idRow = (name, id) => { const r = mkRow(name, -1, 100 * id); r[0][10] = id; return r; };
  phones.rows = [idRow("Arc 3", 31), mkRow("Arc", 121, 200)];
  runtime.objects.ArraySmartphones = { getFirstInstance: () => phones };
  Q = fresh2();
  Object.assign(gv, { DeviceName: "Arc 3" });
  Q.step(0.25);
  const first = st2().focus;
  env.queue = [{ id: "q25", type: "SMARTPHONE", names: ["Arc 3"] }];
  Q.step(0.25);
  assert.ok(st2().starting, "the second Arc 3 starts");
  env.replaying = "q25"; Q.step(0.25);
  phones.rows.unshift(idRow("Arc 3", 32));
  Object.assign(gv, { DeviceTypeCreatingNow: "SMARTPHONES", DeviceName: "Arc 3", OfficeType: "DESIGNER", BubblesDesign: 90, BubblesEngineers: 0 });
  env.replaying = ""; env.here = "DESIGNER"; env.layout = "DESIGNER OFFICE 5"; env.queue = [];
  Q.step(0.25);
  const second = st2().focus;
  assert.notStrictEqual(second, first);
  assert.deepStrictEqual([at("DESIGNER").key, at("ENGINEER").key], ["Arc 3|-1|-1", "Arc 3|-1|-1"], "one key for both");
  const ids = () => phones.rows.map((r) => r[0][10]);
  assert.strictEqual(globalThis._dtPipeBeforeRoom("ENGINEER", "DESIGNER"), "ENGINEER");
  assert.deepStrictEqual(ids(), [31, 32, 0], "the first Arc 3's own row goes to the front");
  assert.strictEqual(phones.getAt(0, 0, 3), 3100, "with every cell");
  assert.strictEqual(globalThis._dtPipeBeforeRoom("DESIGNER", "ENGINEER"), "DESIGNER");
  assert.deepStrictEqual(ids(), [32, 31, 0], "and the second's when it goes live");
  Q.save();
  const r25 = JSON.parse(env.saves.cells["1,152"]);
  assert.deepStrictEqual(r25.items.map((i) => i.rid).sort(), [31, 32]);
  Q.load();
  assert.strictEqual(globalThis._dtPipeBeforeRoom("ENGINEER", "DESIGNER"), "ENGINEER");
  assert.deepStrictEqual(ids(), [31, 32, 0], "after a load too");
}
// 26. With planned launch days a phone made later can come out first: the press conference's
// "last model" is the one released last, not the newest rated row.
{
  const row = (name, rel, rating) => { const r = mkRow(name, rel, 100); r[0][5] = rating; return r; };
  const t26 = { rows: [row("Arc 5", -1, "---"), row("Arc 4 Pro", 500, 8), row("Arc 4", 520, 3), row("Arc 3", 300, 9)], height: 3, depth: 12,
    get width() { return this.rows.length; }, getAt(x, y, z) { return this.rows[x][y][z]; }, setAt(v, x, y, z) { this.rows[x][y][z] = v; } };
  runtime.objects.ArraySmartphones = { getFirstInstance: () => t26 };
  new Function("env", prelude + 'var _DTR_ARRAY = { SMARTPHONES: "ArraySmartphones" };' + src)(env);
  const R = globalThis._dtPipeApi;
  gv.DeviceTypeCreatingNow = "SMARTPHONES";
  const n26 = () => t26.rows.map((r) => r[0][8]);
  R.pressStart({ layout: { name: "PRESS CONFERENCE" } });
  assert.deepStrictEqual(n26(), ["Arc 5", "Arc 4", "Arc 4 Pro", "Arc 3"], "x = 1 is the phone released last");
  assert.strictEqual(t26.getAt(1, 0, 5), 3, "its own rating");
  R.pressEnd();
  assert.deepStrictEqual(n26(), ["Arc 5", "Arc 4 Pro", "Arc 4", "Arc 3"], "rows go back");
  gv.DeviceTypeCreatingNow = "LAPTOPS";
  R.pressStart({ layout: { name: "PRESS CONFERENCE" } });
  assert.deepStrictEqual(n26(), ["Arc 4", "Arc 4 Pro", "Arc 3", "Arc 5"], "other kind: x = 0 is the phone released last");
  R.pressEnd();
  assert.deepStrictEqual(n26(), ["Arc 5", "Arc 4 Pro", "Arc 4", "Arc 3"]);
}
// 27. Your own OS released while a tablet waits parked in Design: the game keeps the OS type
// (only 282 REVIEWS clears it), yet the tablet goes live and you are taken to it; a save made
// in that state loads the same way.
{
  env.saves.cells = {}; env.view = null; env.queue = []; env.layout = "BOSS OFFICE"; env.here = "BOSS"; env.goes = [];
  Object.assign(gv, { OfficeType: "BOSS", DeviceTypeCreatingNow: "OS SMARTPHONES", DeviceName: "Orbit OS", BubblesDesign: 0,
    BubblesTechnology: 0, BubblesBugs: 0, Assistant: "OFF", class: "GAMEPLAY", GameplayPause: 0, CreateDevicesUI: "OFF" });
  new Function("env", prelude + src)(env);
  const P = globalThis._dtPipeApi;
  const row27 = (focus) => JSON.stringify({ v: 1, company: "Ember", start: "2008:0", focus: focus, focusType: focus ? "OS SMARTPHONES" : "", items: [
    ...(focus ? [{ id: "O", room: "", vars: { DeviceTypeCreatingNow: "OS SMARTPHONES", DeviceName: "Orbit OS" } }] : []),
    { id: "T", room: "DESIGNER", vars: { DeviceTypeCreatingNow: "TABLETS", DeviceName: "Slate", BubblesDesign: 30 } }] });
  env.saves.cells["1,152"] = row27("O");
  // The queue's own rule (queue.js), reading the game's assistant list: the release card waits there until OK.
  const qsrc = fs.readFileSync(path.join(__dirname, "..", "queue-patches", "queue.js"), "utf8");
  const cut = (a, b) => { const i = qsrc.indexOf(a); assert.ok(i >= 0, a); return qsrc.slice(i, qsrc.indexOf(b, i)); };
  const assist = { cells: ["OS RELEASED"], get width() { return this.cells.length; }, getAt(x) { return this.cells[x]; } };
  globalThis._getArray24 = (n) => { if (n !== "ArrayGameAssistant") throw new Error(n); return assist; };
  globalThis._dtqReleasing = new Function(cut("var _DTQ_RELEASES", "\nfunction _dtqBusy") +
    cut("function _dtqReleasing", "\nfunction _dtqNameLayoutType") + cut("function _dtqArr(", "\nfunction _dtqArrDump") +
    "return _dtqReleasing;")();
  assert.strictEqual(globalThis._dtqReleasing(), true, "the real rule sees the waiting card");
  P.load();
  assert.strictEqual(P.state().focus, "O", "the OS is live on its release card");
  P.step(0.25);
  const now0 = Date.now, t0 = now0();
  Date.now = () => t0 + 4000;
  try {
    P.step(0.25);
    assert.deepStrictEqual(P.state().items.map((i) => i.id), ["T"], "the OS is let go after its release");
    // review3-2: the game's "OS RELEASED" card is still waiting (its OK stamps the release day from
    // DeviceTypeCreatingNow): the real queue rule says so, and nothing goes live until it is answered.
    P.step(0.25); P.step(0.25);
    assert.strictEqual(P.state().focus, null, "the tablet waits for the OS released card");
    assert.strictEqual(gv.DeviceTypeCreatingNow, "OS SMARTPHONES", "the OS type is kept for the card");
    assist.cells = []; // OK: the card is gone (the game stamped the release day)
    P.step(0.25);
  } finally { Date.now = now0; }
  assert.strictEqual(P.state().focus, "T", "the tablet goes live");
  assert.strictEqual(gv.DeviceTypeCreatingNow, "TABLETS");
  assert.strictEqual(gv.OfficeType, "DESIGNER");
  assert.deepStrictEqual(env.goes, ["DESIGNER"], "taken to Design");
  // Saved with the OS type left over and nothing live.
  Object.assign(gv, { OfficeType: "BOSS", DeviceTypeCreatingNow: "OS SMARTPHONES" }); env.goes = []; env.here = "BOSS";
  env.saves.cells["1,152"] = row27(null);
  P.load();
  P.step(0.25);
  assert.strictEqual(P.state().focus, "T", "after a load too");
  assert.deepStrictEqual(env.goes, ["DESIGNER"]);
  delete globalThis._dtqReleasing; delete globalThis._getArray24;
}
// 28. A device started from the queue rolls its own press conference: the live item's
// "conference done" is not handed on to it.
{
  env.saves.cells = {}; env.view = null; env.queue = []; env.layout = "PROGRAMMER OFFICE 4"; env.here = "PROGRAMMER"; env.replaying = "";
  Object.assign(gv, { OfficeType: "PROGRAMMER", DeviceTypeCreatingNow: "LAPTOPS", DeviceName: "Folio", BubblesDesign: 0,
    BubblesTechnology: 50, BubblesBugs: 30, PressConferenceCompleted: true, PressConferenceRandom: 1 });
  new Function("env", prelude + src)(env);
  const P = globalThis._dtPipeApi;
  P.step(0.25);
  const A = P.state().focus;
  env.queue = [{ id: "q28", type: "SMARTPHONE", names: ["Ember 9"] }];
  P.step(0.25);
  assert.ok(P.state().starting, "the queue head starts");
  assert.strictEqual(gv.PressConferenceCompleted, false, "the new device has had no conference");
  assert.strictEqual(gv.PressConferenceRandom, 0);
  assert.strictEqual(P.state().items.find((i) => i.id === A).vars.PressConferenceCompleted, true, "the parked laptop keeps its own");
  env.queue = [];
}
// 29. A launch-event offer can open as a release ends. It holds its phone's line number,
// so the next item does not go live (its line would move to the front) until the pop-up is answered.
{
  env.saves.cells = {}; env.view = null; env.queue = []; env.layout = "BOSS OFFICE"; env.here = "BOSS"; env.goes = []; env.open = false;
  Object.assign(gv, { OfficeType: "BOSS", DeviceTypeCreatingNow: "SMARTPHONES", DeviceName: "Arc 7", Assistant: "OFF", class: "GAMEPLAY",
    GameplayPause: 0, CreateDevicesUI: "OFF" });
  new Function("env", prelude.replace("isOpen: () => false", "isOpen: () => env.open") + src)(env);
  const P = globalThis._dtPipeApi;
  env.saves.cells["1,152"] = JSON.stringify({ v: 1, company: "Ember", start: "2008:0", focus: "F", focusType: "SMARTPHONES", items: [
    { id: "F", room: "", vars: { DeviceTypeCreatingNow: "SMARTPHONES", DeviceName: "Arc 7" } },
    { id: "B", room: "PROGRAMMER", vars: { DeviceTypeCreatingNow: "TABLETS", DeviceName: "Slate", BubblesTechnology: 30 } }] });
  P.load();
  P.step(0.25);
  assert.strictEqual(P.state().focus, "F", "on its way to its reviews");
  gv.DeviceTypeCreatingNow = ""; // 282 REVIEWS is over
  P.step(0.25);
  assert.strictEqual(P.state().focus, null, "released");
  env.open = true; // the launch-event offer
  P.step(0.25);
  assert.strictEqual(P.state().focus, null, "nothing goes live under the offer");
  // review3-1: Yes closes the offer at once and starts the show ~0.2 s later; the stored line must not move.
  env.open = false; globalThis._dtEvStarting = true;
  P.step(0.25);
  assert.strictEqual(P.state().focus, null, "nothing goes live while the show starts");
  globalThis._dtEvStarting = false; globalThis._dtEvRun = { list: [] };
  P.step(0.25);
  assert.strictEqual(P.state().focus, null, "nor during the show");
  globalThis._dtEvRun = null;
  P.step(0.25);
  assert.strictEqual(P.state().focus, "B", "then the next item goes live");
  delete globalThis._dtEvStarting; delete globalThis._dtEvRun;
}
// 30. op-1: on a planned launch day reviews.js parks the live phone and puts the launching laptop in the
// globals. The game's card click then fades ~0.15 s on the office (Assistant OFF, class GAMEPLAY) before
// REVIEWS. Neither the queue nor a room press may swap the globals then: REVIEWS would name the phone.
{
  env.saves.cells = {}; env.view = null; env.layout = "DESIGNER OFFICE 5"; env.here = "DESIGNER"; env.goes = [];
  env.replaying = ""; env.capturing = false; env.why = "";
  Object.assign(gv, { OfficeType: "DESIGNER", DeviceTypeCreatingNow: "LAPTOPS", DeviceName: "Folio", Assistant: "OFF", class: "GAMEPLAY",
    GameplayPause: 0, CreateDevicesUI: "OFF" });
  new Function("env", prelude + src)(env);
  const P = globalThis._dtPipeApi;
  env.saves.cells["1,152"] = JSON.stringify({ v: 1, company: "Ember", start: "2008:0", focus: null, items: [
    { id: "X", room: "PROGRAMMER", vars: { DeviceTypeCreatingNow: "SMARTPHONES", DeviceName: "Pulse X", BubblesTechnology: 30 } }] });
  P.load();
  env.queue = [{ id: "q30", type: "TABLET", names: ["Pulse Tab"] }];
  let run = { entry: { type: "LAPTOPS" } };
  globalThis._dtReviewsApi = { state: () => ({ run }) };
  P.step(0.25);
  assert.ok(!P.state().starting, "the queue waits for the launch-day reviews");
  assert.strictEqual(globalThis._dtPipeBeforeRoom("PROGRAMMER", "DESIGNER"), false, "no room move during them");
  assert.strictEqual(gv.DeviceTypeCreatingNow, "LAPTOPS", "the launching device stays in the globals");
  assert.strictEqual(gv.DeviceName, "Folio");
  assert.strictEqual(P.state().items.find((i) => i.id === "X").room, "PROGRAMMER", "Pulse X keeps its room");
  run = null; // 282 REVIEWS is over: the type is cleared, back in the boss office
  Object.assign(gv, { DeviceTypeCreatingNow: "", OfficeType: "BOSS" }); env.layout = "BOSS OFFICE"; env.here = "BOSS";
  P.step(0.25);
  assert.ok(P.state().starting, "after the reviews the queue goes on");
  env.queue = []; delete globalThis._dtReviewsApi;
}
// 31. op-2: the next room holds a finished item that waits for the player (Programming does not move
// on by itself): the blocked press says so, instead of "still working".
{
  const pre = prelude.replace("function _dtqCreateButton() { return null; }",
    "function _dtqCreateButton() { return { layer: { cssPxToLayer: (x, y) => [x, y] }, containsPoint: () => true }; }");
  const pressWith = (tech) => {
    env.saves.cells = {}; env.view = null; env.queue = []; env.layout = "DESIGNER OFFICE 5"; env.here = "DESIGNER"; env.toasts = [];
    env.replaying = ""; env.capturing = false;
    Object.assign(gv, { OfficeType: "DESIGNER", DeviceTypeCreatingNow: "LAPTOPS", DeviceName: "Folio", BubblesDesign: 0,
      BubblesTechnology: 0, BubblesBugs: 0, Assistant: "OFF", class: "GAMEPLAY", GameplayPause: 0, CreateDevicesUI: "OFF" });
    new Function("env", pre + src + ";globalThis._t31 = _dtpOnPress;")(env);
    env.saves.cells["1,152"] = JSON.stringify({ v: 1, company: "Ember", start: "2008:0", focus: "M", focusType: "LAPTOPS", items: [
      { id: "M", room: "DESIGNER", vars: { DeviceTypeCreatingNow: "LAPTOPS", DeviceName: "Folio" } },
      { id: "X", room: "PROGRAMMER", vars: { DeviceTypeCreatingNow: "OS SMARTPHONES", DeviceName: "eOS", BubblesTechnology: tech, BubblesBugs: 0 } }] });
    globalThis._dtPipeApi.load();
    globalThis._t31({ type: "pointerdown", button: 0, clientX: 5, clientY: 5, target: null, stopImmediatePropagation() {}, preventDefault() {} });
    delete globalThis._t31;
    return env.toasts;
  };
  // Since the "go when free" rule the press marks the design and says when it moves, whatever programming holds.
  assert.deepStrictEqual(pressWith(0), ["LAPTOPS will move to Programming when it's free"]);
  assert.deepStrictEqual(pressWith(5), ["LAPTOPS will move to Programming when it's free"]);
  assert.strictEqual(globalThis._dtPipeApi.state().items.find((i) => i.id === "M").go, "PROGRAMMER");
}
// 32. Jayden's playtest bug 4: processor A finishes design and moves on while processor B is parked in
// programming with part of its work done. B keeps programming (it used to be pushed back into design,
// where it showed as finished with no work, and on its way back finished programming at once); A waits
// with all of its programming work and goes in once B has left.
{
  env.saves.cells = {}; env.view = null; env.queue = []; env.toasts = []; env.goes = []; env.replaying = ""; env.capturing = false;
  env.layout = "DESIGNER OFFICE 5"; env.here = "DESIGNER";
  Object.assign(gv, { OfficeType: "DESIGNER", class: "GAMEPLAY", GameplayPause: 0, Assistant: "OFF", CreateDevicesUI: "OFF",
    DeviceTypeCreatingNow: "CPU SMARTPHONES", DeviceName: "Chip A", BubblesDesign: 0, BubblesTechnology: 60, BubblesBugs: 30, BubblesEngineers: 0 });
  new Function("env", prelude + src)(env);
  const P = globalThis._dtPipeApi;
  env.saves.cells["1,152"] = JSON.stringify({ v: 1, company: "Ember", start: "2008:0", focus: "A", focusType: "CPU SMARTPHONES", items: [
    { id: "A", room: "DESIGNER", vars: { DeviceTypeCreatingNow: "CPU SMARTPHONES", DeviceName: "Chip A", BubblesTechnology: 60, BubblesBugs: 30 } },
    { id: "B", room: "PROGRAMMER", vars: { DeviceTypeCreatingNow: "CPU LAPTOPS", DeviceName: "Chip B", BubblesDesign: 0, BubblesTechnology: 20, BubblesBugs: 5 } }] });
  P.load();
  const it = (id) => P.state().items.find((i) => i.id === id);
  // The game's own next-stage move (e.g. pressed while paused): OfficeType first, then Programming's screen.
  gv.OfficeType = "PROGRAMMER";
  P.step(0.25);
  assert.strictEqual(it("A").room, "DESIGNER", "nothing moves while the old screen fades");
  env.layout = "PROGRAMMER OFFICE 4"; env.here = "PROGRAMMER";
  const bw = [it("B").vars.BubblesTechnology, it("B").vars.BubblesBugs];
  assert.ok(bw[0] > 0 && bw[0] < 20, "B kept working off screen: " + bw);
  P.step(0.25);
  assert.strictEqual(it("B").room, "PROGRAMMER", "B keeps programming");
  assert.strictEqual(P.state().focus, "B");
  assert.deepStrictEqual([gv.DeviceTypeCreatingNow, gv.BubblesTechnology, gv.BubblesBugs], ["CPU LAPTOPS"].concat(bw), "B's own work on screen");
  // A stays in design, marked to go when free, with all of its programming work (not "finished" B).
  assert.deepStrictEqual([it("A").room, it("A").go, it("A").vars.BubblesTechnology, it("A").vars.BubblesBugs], ["DESIGNER", "PROGRAMMER", 60, 30]);
  // B finishes programming and goes on to engineering: A goes into programming with all of its work.
  Object.assign(gv, { BubblesTechnology: 0, BubblesBugs: 0, OfficeType: "ENGINEER", BubblesEngineers: 50 });
  env.layout = "ENGINEER OFFICE 3"; env.here = "ENGINEER";
  P.step(0.25);
  assert.strictEqual(it("B").room, "ENGINEER");
  assert.deepStrictEqual([it("A").room, it("A").go, it("A").vars.BubblesTechnology], ["PROGRAMMER", undefined, 60], "A is not finished at once");
}
// 33. Jayden's playtest bug 3: a room goes live on a screen that started while it was not (only viewed,
// OfficeType BOSS). The game sets the staff to work only as a screen starts, so nobody made bubbles
// until the stall check, 12 s or more later. Here: the next queue entry's start is undone (the queue
// never took it) while Programming's screen had started for the stand-in; the screen starts again.
{
  env.saves.cells = {}; env.view = null; env.toasts = []; env.goes = []; env.replaying = ""; env.capturing = false;
  env.layout = "DESIGNER OFFICE 5"; env.here = "DESIGNER";
  Object.assign(gv, { OfficeType: "DESIGNER", class: "GAMEPLAY", GameplayPause: 0, Assistant: "OFF", CreateDevicesUI: "OFF",
    DeviceTypeCreatingNow: "OS SMARTPHONES", DeviceName: "", BubblesDesign: 0, BubblesTechnology: 40, BubblesBugs: 20, BubblesEngineers: 0 });
  new Function("env", prelude + src)(env);
  const P = globalThis._dtPipeApi;
  P.step(0.25);
  const os = P.state().focus;
  env.queue = [{ id: "t1", type: "TV" }];
  // The OS moves to programming; design is free and the pipeline hands it to the queue at once.
  gv.OfficeType = "PROGRAMMER";
  P.step(0.25);
  assert.ok(P.state().starting, "the TV is starting");
  assert.strictEqual(gv.OfficeType, "BOSS");
  // The game's own move goes on: Programming's screen starts with the stand-in OfficeType.
  env.layout = "PROGRAMMER OFFICE 4"; env.here = "PROGRAMMER";
  P.layoutStarted({ layout: { name: "PROGRAMMER OFFICE 4" } });
  // The queue never takes the TV: after 10 s the start is undone and the OS is live again, on this screen.
  env.queue = [];
  const now = Date.now;
  Date.now = () => now() + 11000;
  try { P.step(0.25); } finally { Date.now = now; }
  assert.strictEqual(P.state().focus, os);
  assert.strictEqual(gv.OfficeType, "PROGRAMMER");
  assert.ok(gv.BubblesTechnology >= 38 && gv.BubblesTechnology <= 40, "its work kept: " + gv.BubblesTechnology);
  assert.strictEqual(P.state().items.length, 1, "the OS is kept, not dropped as if released");
  assert.deepStrictEqual(env.goes, ["PROGRAMMER"], "Programming starts again so its staff work");
  // Started for the OS: nothing more.
  P.layoutStarted({ layout: { name: "PROGRAMMER OFFICE 4" } });
  assert.strictEqual(P.restart(), "");
  for (let i = 0; i < 3; i++) P.step(0.25);
  assert.deepStrictEqual(env.goes, ["PROGRAMMER"], "once");
  // A screen that started for its own room is never restarted.
  env.goes = [];
  P.layoutStarted({ layout: { name: "PROGRAMMER OFFICE 4" } });
  P.step(0.25);
  assert.deepStrictEqual(env.goes, []);
}
// 34. Jayden's playtest bug 6: an OS finished in design with no programming work left (pushed back from
// programming by an older build) and another OS in programming. One press on the next-stage button
// published it: Design's and Programming's buttons share the spot and one click runs both. Now the press
// is blocked while programming is busy (also when paused), and with programming free the item keeps one
// point of programming, so it moves into programming and stops there. Same for an app and a device
// (which jumped straight to its copies screen).
{
  const pre = prelude.replace("function _dtqCreateButton() { return null; }",
    "function _dtqCreateButton() { return { layer: { cssPxToLayer: (x, y) => [x, y] }, containsPoint: () => true }; }");
  const press = (type, tech, busy, paused) => {
    env.saves.cells = {}; env.view = null; env.queue = []; env.layout = "DESIGNER OFFICE 5"; env.here = "DESIGNER"; env.toasts = [];
    env.replaying = ""; env.capturing = false;
    Object.assign(gv, { OfficeType: "DESIGNER", DeviceTypeCreatingNow: type, DeviceName: "", BubblesDesign: 0, BubblesTechnology: tech,
      BubblesBugs: 0, BubbleResearch: 0, Assistant: "OFF", class: "GAMEPLAY", GameplayPause: paused ? 1 : 0, CreateDevicesUI: "OFF" });
    new Function("env", pre + src + ";globalThis._t34 = _dtpOnPress;")(env);
    const items = [{ id: "A", room: "DESIGNER", vars: { DeviceTypeCreatingNow: type, BubblesTechnology: tech } }];
    if (busy) items.push({ id: "B", room: "PROGRAMMER", vars: { DeviceTypeCreatingNow: "OS LAPTOPS", BubblesTechnology: 30, BubblesBugs: 30 } });
    env.saves.cells["1,152"] = JSON.stringify({ v: 1, company: "Ember", start: "2008:0", focus: "A", focusType: type, items: items });
    globalThis._dtPipeApi.load();
    const ev = { type: "pointerdown", button: 0, clientX: 5, clientY: 5, target: null, stopped: false,
      stopImmediatePropagation() { this.stopped = true; }, preventDefault() {} };
    globalThis._t34(ev);
    delete globalThis._t34;
    return { stopped: ev.stopped, tech: gv.BubblesTechnology, toasts: env.toasts.slice() };
  };
  let r = press("OS SMARTPHONES", 0, true, true);
  assert.ok(r.stopped, "programming busy, paused: the game does not move it (no publish)");
  assert.deepStrictEqual(r.toasts, ["OS SMARTPHONES will move to Programming when it's free"], "marked to go when free");
  for (const type of ["OS SMARTPHONES", "SOFTWARE", "SMARTPHONES"]) {
    r = press(type, 0, false, false);
    assert.strictEqual(r.stopped, false, type + ": programming free, the game's own move goes ahead");
    assert.strictEqual(r.tech, 1, type + ": one point of programming, so the same click cannot finish programming too");
  }
  r = press("OS SMARTPHONES", 10, false, false);
  assert.deepStrictEqual([r.stopped, r.tech], [false, 10], "an item with programming work is left alone");
  gv.BubbleResearch = 0;
}
// 35. Jayden's playtest bug 7 and the full sweep: two items in two rooms, the live one's next-stage button
// pressed once (paused and not). Only the live item may move, by exactly one stage; the other stays put.
// With the next room held the press means "go when free": the item stays, marked, and goes in by itself
// once that room frees, exactly once and one stage. An item nobody pressed never moves.
// The game's click is modelled from 276 GAMEPLAY in sheet order, so one click runs every next-stage button
// on the spot: Design's sets OfficeType PROGRAMMER at once, Programming's then sends a device or processor
// to its copies screen (BATCH sets ENGINEER) and releases an OS or app, Engineering's goes to delivery.
{
  const pre = prelude.replace("function _dtqCreateButton() { return null; }",
    "function _dtqCreateButton() { return { layer: { cssPxToLayer: (x, y) => [x, y] }, containsPoint: () => true }; }");
  const KINDS = { device: "SMARTPHONES", processor: "CPU SMARTPHONES", os: "OS SMARTPHONES", app: "SOFTWARE" };
  const OTHER = { device: "TABLETS", processor: "CPU LAPTOPS", os: "OS LAPTOPS", app: "SOFTWARE" };
  const softish = (t) => t === "SOFTWARE" || t.indexOf("OS ") === 0;
  const roomsOf = (t) => (softish(t) ? ["DESIGNER", "PROGRAMMER"] : ["DESIGNER", "PROGRAMMER", "ENGINEER"]);
  const WORK = { DESIGNER: ["BubblesDesign"], PROGRAMMER: ["BubblesTechnology", "BubblesBugs"], ENGINEER: ["BubblesEngineers"] };
  const LAYOUT = { DESIGNER: "DESIGNER OFFICE 5", PROGRAMMER: "PROGRAMMER OFFICE 4", ENGINEER: "ENGINEER OFFICE 3" };
  const vars = (type, room, done, later) => {
    const v = { DeviceTypeCreatingNow: type, DeviceName: type, BubblesDesign: 40, BubblesTechnology: 40, BubblesBugs: 40, BubblesEngineers: 40 };
    for (const r of ["DESIGNER", "PROGRAMMER", "ENGINEER"]) {
      if (r === room) { for (const k of WORK[r]) v[k] = done ? 0 : 30; break; }
      for (const k of WORK[r]) v[k] = 0;
    }
    if (later === 0 && room === "DESIGNER") v.BubblesTechnology = v.BubblesBugs = 0; // pushed back by an older build
    return v;
  };
  const gameClick = () => {
    const n = (k) => Number(gv[k]) || 0, out = [];
    if (gv.Assistant !== "OFF") return out;
    if (gv.OfficeType === "DESIGNER" && n("BubblesDesign") <= 0) { gv.OfficeType = "PROGRAMMER"; out.push("design"); }
    if (gv.OfficeType === "PROGRAMMER" && n("BubblesTechnology") <= 0 && n("BubblesBugs") <= 0)
      out.push(softish(String(gv.DeviceTypeCreatingNow)) ? "release" : "batch");
    if (gv.OfficeType === "ENGINEER" && n("BubblesEngineers") <= 0) out.push("delivery");
    return out;
  };
  const screen = (layout, here) => { env.layout = layout; env.here = here; };
  let cases = 0;
  for (const ka in KINDS) for (const kb in OTHER) for (const x of roomsOf(KINDS[ka])) for (const y of roomsOf(OTHER[kb]))
    for (const bDone of [false, true]) for (const paused of [false, true]) for (const later of [40, 0]) {
      if (x === y || (later === 0 && x !== "DESIGNER")) continue;
      const ta = KINDS[ka], tb = OTHER[kb], tag = [ka, x, kb, y, bDone ? "b done" : "b working", paused ? "paused" : "running", "later " + later].join(" ");
      cases++;
      env.saves.cells = {}; env.view = null; env.queue = []; env.toasts = []; env.goes = []; env.replaying = ""; env.capturing = false;
      screen(LAYOUT[x], x);
      const va = vars(ta, x, true, later), vb = vars(tb, y, bDone, 40);
      Object.assign(gv, va, { OfficeType: x, class: "GAMEPLAY", Assistant: "OFF", CreateDevicesUI: "OFF", GameplayPause: paused ? 1 : 0, BubbleResearch: 0 });
      new Function("env", pre + src + ";globalThis._t35 = _dtpOnPress; globalThis._t35d = () => _dtp;")(env);
      const P = globalThis._dtPipeApi;
      env.saves.cells["1,152"] = JSON.stringify({ v: 1, company: "Ember", start: "2008:0", focus: "A", focusType: ta,
        items: [{ id: "A", room: x, vars: va }, { id: "B", room: y, vars: vb }] });
      P.load();
      P.step(0.25);
      const it = (id) => P.state().items.find((i) => i.id === id);
      const b0 = JSON.stringify([it("B").room, it("B").wait]);
      const ev = { type: "pointerdown", button: 0, clientX: 5, clientY: 5, target: null, stopped: false,
        stopImmediatePropagation() { this.stopped = true; }, preventDefault() {} };
      globalThis._t35(ev);
      const next = x === "DESIGNER" ? "PROGRAMMER" : x === "PROGRAMMER" && !softish(ta) ? "ENGINEER" : "";
      const busy = !!next && y === next;
      // Design -> busy programming: caught and marked. Programming -> busy engineering: the copies screen
      // comes first (the game's own), the item is marked as it reaches engineering.
      assert.strictEqual(ev.stopped, busy && next === "PROGRAMMER", tag + ": caught only on design's press with programming held");
      const toEngineering = () => {
        screen("BATCH", ""); P.step(0.25);
        Object.assign(gv, { OfficeType: "ENGINEER", BubblesEngineers: 100 }); P.step(0.25);
        screen(LAYOUT.ENGINEER, "ENGINEER");
      };
      if (!ev.stopped) {
        const out = gameClick();
        assert.strictEqual(out.length, 1, tag + ": one press, one stage: " + out);
        P.step(0.25); // OfficeType first, the old screen still fading
        if (out[0] === "design") screen(LAYOUT.PROGRAMMER, "PROGRAMMER");
        if (out[0] === "batch") toEngineering();
        if (out[0] === "release" || out[0] === "delivery") { gv.OfficeType = "BOSS"; screen(out[0] === "release" ? "BOSS OFFICE" : "BATCH DELIVERY", out[0] === "release" ? "BOSS" : ""); }
        for (let i = 0; i < 3; i++) P.step(0.25);
        if (out[0] === "release") assert.strictEqual(x, "PROGRAMMER", tag + ": released only from programming");
        if (!busy) {
          const want = { design: "PROGRAMMER", batch: "ENGINEER", release: "", delivery: "" }[out[0]];
          assert.strictEqual(it("A").room, want, tag + ": the live item moved one stage");
        }
      } else {
        P.step(0.25);
      }
      assert.strictEqual(JSON.stringify([it("B").room, it("B").wait]), b0, tag + ": the other item stays put");
      if (!busy) {
        assert.strictEqual(it("A").go, undefined, tag + ": nothing marked");
      } else {
        assert.deepStrictEqual([it("A").room, it("A").go], [x, next], tag + ": stays in its room, marked for the next");
        assert.strictEqual(env.toasts.filter((m) => / will move to /.test(m)).length, 1, tag + ": says when it moves: " + env.toasts);
        // The other item leaves the next room (the game's delivery for a live one; a parked one is taken
        // away by hand here). The marked item goes in by itself, once, one stage: while paused, on unpause.
        if (P.state().focus === "B") { Object.assign(gv, { OfficeType: "BOSS", DeviceTypeCreatingNow: "" }); screen("BATCH DELIVERY", ""); }
        else globalThis._t35d().items.find((i) => i.id === "B").room = "";
        P.step(0.25);
        if (P.state().focus === "A" && paused) {
          assert.strictEqual(it("A").room, x, tag + ": the live item waits for the clock");
          gv.GameplayPause = 0; P.step(0.25);
        }
        assert.deepStrictEqual([it("A").room, it("A").go], [next, undefined], tag + ": went in by itself");
        for (let i = 0; i < 3; i++) P.step(0.25);
        assert.strictEqual(it("A").room, next, tag + ": exactly one stage");
      }
      delete globalThis._t35;
    }
  assert.ok(cases > 150, "cases " + cases);
  console.log("sweep: " + cases + " presses");
  gv.GameplayPause = 0; gv.BubbleResearch = 0;
}
// 36. Two marks in a row: A (design) pressed for programming, B (programming, copies made) for engineering,
// C live in engineering. Saved and loaded with the marks. C leaves: B goes into engineering, then A into
// programming, each by itself and once; nothing else moves.
{
  env.saves.cells = {}; env.view = null; env.queue = []; env.toasts = []; env.goes = []; env.replaying = ""; env.capturing = false;
  env.layout = "ENGINEER OFFICE 3"; env.here = "ENGINEER";
  Object.assign(gv, { OfficeType: "ENGINEER", class: "GAMEPLAY", GameplayPause: 0, Assistant: "OFF", CreateDevicesUI: "OFF",
    DeviceTypeCreatingNow: "TV", DeviceName: "", BubblesDesign: 0, BubblesTechnology: 0, BubblesBugs: 0, BubblesEngineers: 0 });
  new Function("env", prelude + src)(env);
  const P = globalThis._dtPipeApi;
  env.saves.cells["1,152"] = JSON.stringify({ v: 1, company: "Ember", start: "2008:0", focus: "C", focusType: "TV", items: [
    { id: "A", room: "DESIGNER", go: "PROGRAMMER", goAt: 2, vars: { DeviceTypeCreatingNow: "CPU LAPTOPS", BubblesDesign: 0, BubblesTechnology: 20, BubblesBugs: 9 } },
    { id: "B", room: "PROGRAMMER", go: "ENGINEER", goAt: 1, vars: { DeviceTypeCreatingNow: "SMARTPHONES", BubblesTechnology: 0, BubblesBugs: 0, BubblesEngineers: 77 } },
    { id: "C", room: "ENGINEER", vars: { DeviceTypeCreatingNow: "TV", BubblesEngineers: 0 } }] });
  P.load();
  P.save(); P.load();
  const it = (id) => P.state().items.find((i) => i.id === id);
  assert.deepStrictEqual([it("A").go, it("B").go], ["PROGRAMMER", "ENGINEER"], "marks kept across a save");
  assert.deepStrictEqual(globalThis._dtPipeMarked(), ["Waiting for Engineering: SMARTPHONES", "Waiting for Programming: CPU LAPTOPS"], "first pressed first");
  P.step(0.25);
  assert.deepStrictEqual([it("A").room, it("B").room], ["DESIGNER", "PROGRAMMER"], "nothing moves while engineering is held");
  // C goes to delivery.
  Object.assign(gv, { OfficeType: "BOSS", DeviceTypeCreatingNow: "" }); env.layout = "BATCH DELIVERY"; env.here = "";
  P.step(0.25); P.step(0.25);
  assert.deepStrictEqual([it("A").room, it("A").go, it("B").room, it("B").go], ["PROGRAMMER", undefined, "ENGINEER", undefined]);
  assert.deepStrictEqual([it("A").vars.BubblesTechnology, it("B").vars.BubblesEngineers], [20, 77], "each with its own work");
  for (let i = 0; i < 4; i++) P.step(0.25);
  assert.deepStrictEqual([it("A").room, it("B").room], ["PROGRAMMER", "ENGINEER"], "once");
}
// 37. Night items 9-10. (9) "Ready" and the press wait for the game's own next-stage button, which comes only
// once the last work and research bubbles have landed (counter 0 is not enough): a press before that does
// nothing in the game, so it is not caught or marked either. (10) OS and apps are named by their own names
// in the title, the message and the Build queue rows; a parked device's row keeps its kind.
{
  env.saves.cells = {}; env.view = null; env.queue = []; env.toasts = []; env.goes = []; env.replaying = ""; env.capturing = false;
  env.layout = "DESIGNER OFFICE 5"; env.here = "DESIGNER";
  const flying = { BubblesDesign: 0, BubbleResearch: 0 };
  const objs = runtime.objects;
  runtime.objects = Object.assign({}, objs, {
    BubblesDesign: { getAllInstances: () => new Array(flying.BubblesDesign).fill({}) },
    BubbleResearch: { getAllInstances: () => new Array(flying.BubbleResearch).fill({}) },
  });
  Object.assign(gv, { OfficeType: "DESIGNER", class: "GAMEPLAY", GameplayPause: 0, Assistant: "OFF", CreateDevicesUI: "OFF",
    DeviceTypeCreatingNow: "OS LAPTOPS", DeviceName: "", MyOS_Name: "Atlas 9", MyOS_VersionName: "2.1", BubblesDesign: 0, BubblesTechnology: 30, BubblesBugs: 5, BubblesEngineers: 0 });
  new Function("env", prelude.replace("function _dtqCreateButton() { return null; }",
    "function _dtqCreateButton() { return { layer: { cssPxToLayer: (x, y) => [x, y] }, containsPoint: () => true }; }") + src + ";globalThis._t37 = _dtpOnPress;")(env);
  const P = globalThis._dtPipeApi;
  env.saves.cells["1,152"] = JSON.stringify({ v: 1, company: "Ember", start: "2008:0", focus: "D", focusType: "OS LAPTOPS", items: [
    { id: "D", room: "DESIGNER", vars: { DeviceTypeCreatingNow: "OS LAPTOPS", MyOS_Name: "Atlas 9", MyOS_VersionName: "2.1", BubblesDesign: 0, BubblesTechnology: 30, BubblesBugs: 5 } },
    { id: "E", room: "PROGRAMMER", vars: { DeviceTypeCreatingNow: "OS SMARTPHONES", MyOS_Name: "eOS 4", MyOS_VersionName: "3 (2)", BubblesTechnology: 50, BubblesBugs: 9 } },
    { id: "F", room: "ENGINEER", vars: { DeviceTypeCreatingNow: "OS TV", MyOS_Name: "NeoTV", BubblesEngineers: 5 } }] });
  P.load();
  const press = () => {
    const ev = { type: "pointerdown", button: 0, clientX: 5, clientY: 5, target: null, stopped: false,
      stopImmediatePropagation() { this.stopped = true; }, preventDefault() {} };
    env.toasts = [];
    globalThis._t37(ev);
    return ev.stopped;
  };
  const D = () => P.state().items.find((i) => i.id === "D");
  flying.BubblesDesign = 1; flying.BubbleResearch = 2;
  assert.strictEqual(globalThis._dtPipeRoomLabel("DESIGNER"), "Atlas 9 2.1 · OS LAPTOPS", "counter 0, bubbles still flying: not Ready yet");
  assert.strictEqual(press(), false, "a press in that gap is left to the game (which does nothing yet)");
  assert.strictEqual(D().go, undefined, "and not marked");
  flying.BubblesDesign = 0;
  assert.strictEqual(globalThis._dtPipeRoomLabel("DESIGNER"), "Atlas 9 2.1 · OS LAPTOPS", "research bubbles count too");
  flying.BubbleResearch = 0;
  assert.strictEqual(globalThis._dtPipeRoomLabel("DESIGNER"), "Atlas 9 2.1 · OS LAPTOPS · Ready", "Ready with the game's button");
  assert.strictEqual(globalThis._dtPipeRoomLabel("PROGRAMMER"), "eOS 4 3 (2) · OS SMARTPHONES", "a parked OS shows its own name and version");
  // One parked before MyOS_VersionName was saved keeps its name alone (no live item's version mixed in).
  assert.strictEqual(globalThis._dtPipeRoomLabel("ENGINEER"), "NeoTV · OS TV", "an older parked OS shows its own name only");
  // Viewed from another room the counter alone decides (its bubbles are not drawn there).
  env.layout = "PROGRAMMER OFFICE 4"; env.here = "PROGRAMMER"; flying.BubblesDesign = 3;
  assert.strictEqual(globalThis._dtPipeRoomLabel("DESIGNER"), "Atlas 9 2.1 · OS LAPTOPS · Ready");
  env.layout = "DESIGNER OFFICE 5"; env.here = "DESIGNER"; flying.BubblesDesign = 0;
  assert.strictEqual(press(), true, "the first press once Ready is the game's: caught, eOS 4 holds programming");
  assert.strictEqual(D().go, "PROGRAMMER");
  assert.deepStrictEqual(env.toasts, ["Atlas 9 2.1 · OS LAPTOPS will move to Programming when it's free"], "message names the OS");
  assert.strictEqual(globalThis._dtPipeRoomLabel("DESIGNER"), "Atlas 9 2.1 · OS LAPTOPS · Waiting for Programming");
  assert.deepStrictEqual(globalThis._dtPipeMarked(), ["Waiting for Programming: Atlas 9 2.1 · OS LAPTOPS"], "queue row names the OS");
  delete globalThis._t37;
  runtime.objects = objs;
}
console.log("pipeline runtime ok");
