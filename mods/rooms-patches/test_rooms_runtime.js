// Runtime test for rooms.js with a fake Construct runtime: node test_rooms_runtime.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const listeners = {};
const layers = [{ name: "ENGINEER UI (Top)", isVisible: true }, { name: "GAMEPLAY GLOBAL UI (Top)", isVisible: true }];
const btnLayer = { isVisible: true, cssPxToLayer: (x, y) => [x, y] };
const inst = { 7345: { isVisible: true, layer: btnLayer, containsPoint: (x, y) => x < 10 && y < 10 } };
const calls = [];
const winListeners = {};
const saves = { cells: {}, width: 3, height: 200, setAt(v, x, y) { this.cells[x + "," + y] = v; } };
const rt = {
  globalVars: { OfficeType: "PROGRAMMER", class: "GAMEPLAY", CreateDevicesUI: "OFF", Assistant: "OFF", DeviceTypeCreatingNow: "LAPTOPS",
    DesignersOfficeLevel: 5, ProgrammersOfficeLevel: 4, EngineersOfficeLevel: 3, SaveSlot: 1, DeviceName: "x" },
  layout: { name: "PROGRAMMER OFFICE 4", getAllLayers: () => layers },
  objects: { ArraySaves: { getFirstInstance: () => saves } },
  addEventListener(n, f) { listeners[n] = f; },
  getInstanceByUid: (u) => inst[u] || null,
  callFunction: (n) => calls.push(n),
  goToLayout(n) { listeners.beforeanylayoutstart({ layout: { name: n } }); this.layout.name = n; listeners.afteranylayoutstart({}); },
};
globalThis.runtime = rt;
let saved = null;
const sandbox = `function FakeEl(tag){ this.tagName=tag; this.children=[]; this.style={}; this.className=""; this.textContent=""; this.isConnected=true; this.listeners={};
  const self=this; this.classList={contains:(c)=>self.className.split(" ").includes(c), toggle(c,v){ const l=self.className.split(" ").filter((x)=>x&&x!==c); if(v) l.push(c); self.className=l.join(" "); }}; }
FakeEl.prototype.appendChild=function(n){ const i=this.children.indexOf(n); if(i>=0) this.children.splice(i,1); this.children.push(n); n.parentNode=this; return n; };
FakeEl.prototype.remove=function(){ const c=this.parentNode.children; c.splice(c.indexOf(this),1); };
FakeEl.prototype.addEventListener=function(t,f){ this.listeners[t]=f; };
Object.defineProperty(FakeEl.prototype,"lastChild",{get(){ return this.children[this.children.length-1]; }});
var uiLayer=new FakeEl("div");
var _dtUi={layoutName:()=>runtime.layout.name,isOpen:()=>uiOpen,t:(e,v)=>{ let s=e.en; for(const k in v||{}) s=s.split("{"+k+"}").join(v[k]); return s; },
  ensure:()=>uiLayer,el(tag,cls,parent,text){ const n=new FakeEl(tag); n.className=cls||""; if(text!==undefined) n.textContent=text; if(parent) parent.appendChild(n); return n; }};
var uiOpen=false;
var docEl={style:{p:{},setProperty(k,v){this.p[k]=v;},getPropertyValue(k){return this.p[k]||"";},removeProperty(k){delete this.p[k];}},cls:{},classList:{toggle(c,v){docEl.cls[c]=!!v;}}};
var document={getElementById:(id)=>(id==="dt-rooms-era-css"?null:1),createElement:()=>({}),head:{appendChild(){}},documentElement:docEl};
function saveArraysToFile(f,n){ saved = runtime.objects.ArraySaves.getFirstInstance().cells["1,13"]; return "orig"; }
var setInterval=()=>0; function addEventListener(n,f){ (winListeners[n] = winListeners[n] || []).push(f); }`;
const src = fs.readFileSync(path.join(__dirname, "rooms.js"), "utf8");
// Night item 10: an OS or app is named like a device ("eOS 3 (2) · Operating system", "Notes Pro · Software"),
// from the game's own name variables (MyOS_Name + " " + MyOS_VersionName, as its OS screens show it).
// Checked on the label function alone so the timers above are not disturbed.
{
  const pick = (re) => { const m = src.match(re); assert.ok(m, "found " + re); return m[0]; };
  const fnSrc = pick(/var _DTR_TYPE = \{[\s\S]*?\n\};/) + "\n" + pick(/var _DTR_ARRAY = \{[\s\S]*?\n\};/) + "\n" +
    pick(/function _dtrDevLabel\(gv\) \{[\s\S]*?\n\}/);
  const ui = { t: (e) => e.en };
  const rows = { ArraySmartphones: { getFirstInstance: () => ({ width: 1, getAt: () => "Supernova Ultra Pro" }) } };
  const label = new Function("_dtUi", "_dtrT", "globalThis", fnSrc + "\nreturn _dtrDevLabel;")(ui, () => "Free", { runtime: { objects: rows } });
  assert.strictEqual(label({ DeviceTypeCreatingNow: "OS SMARTPHONES", MyOS_Name: "eOS", MyOS_VersionName: "3 (2)" }), "eOS 3 (2) · Operating system");
  assert.strictEqual(label({ DeviceTypeCreatingNow: "OS LAPTOPS", MyOS_Name: "Atlas 9", MyOS_VersionName: "1.0.0" }), "Atlas 9 1.0.0 · Operating system");
  assert.strictEqual(label({ DeviceTypeCreatingNow: "OS LAPTOPS", MyOS_Name: "Atlas 9" }), "Atlas 9 · Operating system", "no version: the name alone");
  assert.strictEqual(label({ DeviceTypeCreatingNow: "SOFTWARE", CreateSoftwareChoose_Name: "Notes Pro" }), "Notes Pro · Software");
  assert.strictEqual(label({ DeviceTypeCreatingNow: "OS TV", MyOS_Name: "" }), "Operating system", "no name: the kind alone");
  assert.strictEqual(label({ DeviceTypeCreatingNow: "SMARTPHONES" }), "Supernova Ultra Pro · Phone");
}
const run = new Function("winListeners", sandbox + src + "\nreturn {api: globalThis._dtRooms, getSaved: () => saved, save: (...a) => saveArraysToFile(...a), layer: uiLayer, setUi: (v) => (uiOpen = v), docEl};");
const { api, save, layer, setUi, docEl } = run(winListeners);
// The floating title: name, status line, and one quiet line while another room is at work (no dots).
const title = () => layer.children.find((n) => n.className.includes("dt-rtitle"));
const shownName = () => title()._dtName.textContent;
const pillOff = () => title().classList.contains("dt-off");
const also = () => (title()._dtAlso.style.visibility === "hidden" ? "" : title()._dtAlsoText.textContent);
// A press on the centre button (hidden or not) at page point (x, y).
const press = (type, x = 5, y = 5) => {
  const ev = { type, button: 0, clientX: x, clientY: y, stopped: false, stopImmediatePropagation() { this.stopped = true; }, preventDefault() {} };
  for (const f of winListeners[type] || []) f(ev);
  return ev.stopped;
};
const gv = rt.globalVars;
api.tick();
// The game's era banner ("The ... Era", band top 132) moves below the room title's lowest line in use while
// the title is shown, and is the game's own again without it.
{
  const t = title();
  const keep = [t._dtSub.style.visibility, t._dtAlso.style.visibility];
  const vis = (n, v) => (n.style.visibility = v ? "" : "hidden");
  vis(t._dtSub, true); vis(t._dtAlso, false);
  assert.strictEqual(api.eraTop(), 194, "under the status line");
  vis(t._dtAlso, true);
  assert.strictEqual(api.eraTop(), 223, "under the other-room line");
  vis(t._dtSub, false); vis(t._dtAlso, false);
  assert.strictEqual(api.eraTop(), 162, "under the name row");
  t._dtSub.style.visibility = keep[0]; t._dtAlso.style.visibility = keep[1];
  api.tick();
  assert.strictEqual(docEl.style.p["--dt-era-top"], api.eraTop() + "px");
  assert.strictEqual(docEl.cls["dt-era-clear"], true);
  const lay = rt.layout.name;
  rt.layout.name = "MARKETING MENU";
  api.tick();
  assert.strictEqual(api.eraTop(), 0);
  assert.strictEqual(docEl.style.p["--dt-era-top"], undefined, "no title: the game's own top");
  assert.strictEqual(docEl.cls["dt-era-clear"], false);
  rt.layout.name = lay;
  api.tick();
}
assert.strictEqual(shownName(), "Programming", "title names the room on screen");
assert.strictEqual(title()._dtSub.textContent, "Laptop", "status line: what the room makes (no name in this fake)");
assert.strictEqual(also(), "", "only the room on screen is busy: no extra line");
assert.strictEqual(title()._dtAlso.style.visibility, "hidden", "the empty line keeps its height (no jump)");
assert.strictEqual(title()._dtDots, undefined, "no room dots any more");
assert.strictEqual(title()._dtL.listeners.click !== undefined && title()._dtR.listeners.click !== undefined, true, "both arrows take presses");
assert.strictEqual(title()._dtName.listeners.click, undefined, "the name itself is not a button");
// Busy: three stops, start on the real room.
assert.deepStrictEqual(api.stops(), ["DESIGNER", "PROGRAMMER", "ENGINEER"]);
assert.strictEqual(api.step(1), true);
assert.strictEqual(rt.layout.name, "ENGINEER OFFICE 3");
assert.strictEqual(gv.OfficeType, "BOSS", "stand-in while another room is viewed");
assert.strictEqual(api.real(), "PROGRAMMER");
api.tick();
assert.strictEqual(shownName(), "Engineering");
assert.strictEqual(title()._dtSub.textContent, "Free");
assert.strictEqual(also(), "Programming: Laptop", "the other room at work, in words");
assert.strictEqual(layers[0].isVisible, false, "room dial hidden");
// J1: hiding the centre while busy left an empty gap in the toolbar (a lost + to the player). It stays.
for (let i = 0; i < 3; i++) api.tick();
assert.strictEqual(inst[7345].isVisible, true, "centre (+) stays shown in a viewed room while busy");
// The game (OfficeType BOSS) would open its picker on a layout without type tiles (no +, calendar
// stopped): it never sees the press.
assert.strictEqual(press("click"), true, "viewed room's centre press swallowed");
assert.strictEqual(press("pointerdown", 50, 50), false, "elsewhere untouched");
assert.strictEqual(rt.layout.name, "ENGINEER OFFICE 3");
assert.strictEqual(gv.CreateDevicesUI, "OFF");
// Save while viewing stores the real office.
save("Save.dt", "ArraySaves");
assert.strictEqual(saves.cells["1,13"], "PROGRAMMER");
// Wraps forward: engineer -> designer.
api.tick();
gv.class = "GAMEPLAY";
const t0 = Date.now(); while (Date.now() - t0 < 500) {}
api.step(1);
assert.strictEqual(rt.layout.name, "DESIGNER OFFICE 5");
assert.strictEqual(gv.OfficeType, "BOSS");
// A game layout change (menu) restores the real office first.
rt.goToLayout("RATINGS");
assert.strictEqual(gv.OfficeType, "PROGRAMMER");
assert.strictEqual(api.view(), null);
// Back to the real room is the game's own screen.
rt.layout.name = "DESIGNER OFFICE 5";
let t1 = Date.now(); while (Date.now() - t1 < 500) {}
api.step(1);
assert.strictEqual(rt.layout.name, "PROGRAMMER OFFICE 4");
assert.strictEqual(gv.OfficeType, "PROGRAMMER");
assert.strictEqual(api.view(), null);
// Back in the real room the room dial comes back (it stayed hidden for the session).
assert.strictEqual(layers[0].isVisible, true, "room dial shown again");
assert.strictEqual(inst[7345].isVisible, true, "centre still shown");
// play3-3: back from a menu the game names the office a few frames before that layout starts. An arrow
// pressed in that gap sees the office's own start after the press; the asked-for room still comes and
// stays only viewed (it was left on screen with the real OfficeType and no view).
{
  const go = rt.goToLayout, pending = [];
  rt.goToLayout = (n) => pending.push(n);
  let t3 = Date.now(); while (Date.now() - t3 < 500) {}
  assert.strictEqual(api.step(1), true);
  listeners.beforeanylayoutstart({ layout: { name: "PROGRAMMER OFFICE 4" } }); // the late start of the room being left
  listeners.afteranylayoutstart({});
  rt.goToLayout = go;
  go.call(rt, pending.shift());
  assert.strictEqual(rt.layout.name, "ENGINEER OFFICE 3");
  assert.strictEqual(gv.OfficeType, "BOSS", "the arrowed-to room is only viewed");
  assert.deepStrictEqual([api.view().room, api.view().real], ["ENGINEER", "PROGRAMMER"]);
  api.tick();
  assert.strictEqual(api.view().room, "ENGINEER", "still viewed after a tick");
  // A menu still gives the real office back.
  rt.goToLayout("RATINGS");
  assert.strictEqual(gv.OfficeType, "PROGRAMMER");
  rt.goToLayout("PROGRAMMER OFFICE 4");
}
// Blocked while a pop-up or the create picker is up.
gv.Assistant = "ON";
t1 = Date.now(); while (Date.now() - t1 < 500) {}
assert.strictEqual(api.step(1), false);
gv.Assistant = "OFF";
// Idle: the boss office is a stop and stays the real office.
gv.OfficeType = "BOSS"; gv.DeviceTypeCreatingNow = ""; rt.layout.name = "BOSS OFFICE";
assert.deepStrictEqual(api.stops(), ["BOSS", "DESIGNER", "PROGRAMMER", "ENGINEER"]);
api.tick();
assert.strictEqual(shownName(), "Boss office");
assert.strictEqual(also(), "", "idle: nothing at work, no extra line");
assert.strictEqual(title()._dtSub.style.visibility, "hidden", "nothing in work: empty line keeps its height");
api.step(-1);
assert.strictEqual(rt.layout.name, "ENGINEER OFFICE 3");
assert.strictEqual(gv.OfficeType, "BOSS");
assert.strictEqual(api.label("ENGINEER"), "Free");
// Idle, a free room viewed: + goes to the boss office and opens the game's picker there.
t1 = Date.now(); while (Date.now() - t1 < 500) {}
assert.strictEqual(press("pointerdown"), true);
assert.strictEqual(press("touchstart"), true, "the touch twin is swallowed too, once");
assert.strictEqual(rt.layout.name, "BOSS OFFICE");
assert.strictEqual(api.view(), null);
assert.strictEqual(gv.OfficeType, "BOSS");
assert.strictEqual(api.pickFrom(), "ENGINEER", "remembers the room the + came from");
// On the boss office itself the button is the game's own.
t1 = Date.now(); while (Date.now() - t1 < 750) {}
assert.strictEqual(press("pointerdown"), false, "boss office press is the game's");
setTimeout(() => {
  assert.strictEqual(gv.CreateDevicesUI, "WAIT");
  assert.deepStrictEqual(calls.filter((c) => c === "CreateDevices_ON").length, 1);
  // A work room on screen in the game's boss state with no view record (the pipeline's queue start drops
  // it): the hidden centre press is dropped, not the game's picker toggle (greyed pill, hidden picker).
  gv.CreateDevicesUI = "OFF";
  rt.layout.name = "ENGINEER OFFICE 3";
  assert.strictEqual(api.view(), null);
  const n = calls.length;
  assert.strictEqual(press("pointerdown"), true, "recordless viewed room: press dropped");
  assert.strictEqual(press("click"), true);
  assert.strictEqual(calls.length, n, "no Tap_Main / picker");
  assert.strictEqual(rt.layout.name, "ENGINEER OFFICE 3");
  assert.strictEqual(gv.CreateDevicesUI, "OFF");
  // The game's own office (OfficeType is the room) keeps its button.
  gv.OfficeType = "ENGINEER";
  assert.strictEqual(press("pointerdown"), false);
  // Picker closed without a pick: back to the room the + was pressed in.
  gv.OfficeType = "BOSS"; rt.layout.name = "BOSS OFFICE";
  api.tick();
  t1 = Date.now(); while (Date.now() - t1 < 500) {}
  api.step(-1);
  assert.strictEqual(rt.layout.name, "ENGINEER OFFICE 3");
  t1 = Date.now(); while (Date.now() - t1 < 500) {}
  assert.strictEqual(press("pointerdown"), true);
  assert.strictEqual(rt.layout.name, "BOSS OFFICE");
  // The picker opens a moment later (WAIT -> ON), then goes off: closed with its + (close), or a pick.
  const closePress = () => {
    const t = Date.now(); while (Date.now() - t < 350) {}
    assert.strictEqual(press("pointerdown"), false, "the boss office + (close) is the game's");
  };
  const open = (then, close) => setTimeout(() => {
    assert.strictEqual(gv.CreateDevicesUI, "WAIT");
    gv.CreateDevicesUI = "ON"; api.tick();
    if (close) closePress();
    gv.CreateDevicesUI = "OFF"; api.tick();
    then();
  }, 400);
  open(() => {
    setTimeout(() => {
      api.tick();
      assert.strictEqual(rt.layout.name, "ENGINEER OFFICE 3", "back where the + was pressed");
      assert.strictEqual(gv.OfficeType, "BOSS");
      assert.strictEqual(api.pickFrom(), null);
      // A pick turns the picker off and moves on to naming: no bounce back.
      t1 = Date.now(); while (Date.now() - t1 < 500) {}
      press("pointerdown");
      assert.strictEqual(api.pickFrom(), "ENGINEER");
      open(() => {
        rt.layout.name = "SMARTPHONE NAME";
        setTimeout(() => {
          api.tick();
          assert.strictEqual(rt.layout.name, "SMARTPHONE NAME", "picked: stays on the naming screen");
          // Pill naming at the click: from the live engineer office, no view.
          gv.OfficeType = "ENGINEER"; rt.layout.name = "ENGINEER OFFICE 3"; api.drop();
          t1 = Date.now(); while (Date.now() - t1 < 800) {}
          // The pill names the next room at its click, dimmed, while that room's layout still loads.
          // A must-answer panel (the Launch Day card) holds the room: no move and the pill marked off.
          // The player never sees it dead: the dock hides while any panel is up (ui.js chipsVisible).
          setUi(true);
          const before = rt.layout.name;
          assert.strictEqual(api.step(1), false, "no move while a panel is open");
          assert.strictEqual(rt.layout.name, before);
          api.tick();
          assert.strictEqual(pillOff(), true, "arrows off while a panel is open");
          setUi(false);
          api.tick();
          assert.strictEqual(pillOff(), false, "arrows back once the panel closes");
          const go = rt.goToLayout;
          let asked = "";
          rt.goToLayout = (n) => { asked = n; };
          assert.strictEqual(api.step(1), true);
          assert.strictEqual(asked, "DESIGNER OFFICE 5");
          const shown = shownName();
          assert.strictEqual(shown, "Design", "title names the next room at the click");
          assert.strictEqual(pillOff(), true, "arrows dimmed while the room loads");
          rt.goToLayout = go;
          rt.layout.name = asked;
          api.tick();
          assert.strictEqual(shownName(), shown, "same name once the room runs");
          // J2: no layout runs while the next one loads its images: the title stays up, no blink.
          rt.layout.name = "";
          api.tick();
          assert.strictEqual(title().style.display, "", "title stays up while the next layout loads");
          rt.layout.name = asked;
          // Off the office screens the title is hidden.
          rt.layout.name = "SMARTPHONE NAME";
          api.tick();
          assert.strictEqual(title().style.display, "none", "no title off the office");
          // Boss office with a room at work (pipeline): it names the busy room and its item.
          globalThis._dtPipeRoomLabel = (r) => (r === "DESIGNER" ? "Arc 6 · Phone · Ready" : r === "BOSS" ? "" : "Free");
          gv.OfficeType = "BOSS"; rt.layout.name = "BOSS OFFICE"; api.drop();
          api.tick();
          assert.strictEqual(title().style.display, "", "back on the office");
          assert.strictEqual(title()._dtSub.textContent, "Design is working on Arc 6", "no pipeline: every busy room is at work");
          assert.strictEqual(also(), "", "the busy room is named once, not again under it");
          // With the pipeline: a done or waiting item is not work, so its full label shows.
          globalThis._DTP_TEXT = { ready: { en: "Ready" }, waiting: { en: "Waiting for {room}" } };
          api.tick();
          assert.strictEqual(title()._dtSub.textContent, "Design: Arc 6 · Phone · Ready");
          globalThis._dtPipeRoomLabel = (r) => (r === "DESIGNER" ? "Software · Waiting for Programming" : r === "BOSS" ? "" : "Free");
          api.tick();
          assert.strictEqual(title()._dtSub.textContent, "Design: Software · Waiting for Programming");
          globalThis._dtPipeRoomLabel = (r) => (r === "DESIGNER" ? "Arc 6 · Phone" : r === "BOSS" ? "" : "Free");
          api.tick();
          assert.strictEqual(title()._dtSub.textContent, "Design is working on Arc 6", "real work keeps the working line");
          delete globalThis._DTP_TEXT;
          // Two rooms at work: the second one gets the quiet line.
          globalThis._dtPipeRoomLabel = (r) => (r === "DESIGNER" ? "Arc 6 · Phone" : r === "ENGINEER" ? "Arc 5 · Phone" : r === "BOSS" ? "" : "Free");
          api.tick();
          assert.strictEqual(title()._dtSub.textContent, "Design is working on Arc 6");
          assert.strictEqual(also(), "Engineering: Arc 5 · Phone");
          // Viewing a room with both others at work: a count, not two long names.
          globalThis._dtPipeRoomLabel = (r) => (r === "BOSS" ? "" : r === "DESIGNER" ? "Arc 6 · Phone" : r === "ENGINEER" ? "Arc 5 · Phone" : "Note · Phone");
          rt.layout.name = "PROGRAMMER OFFICE 4";
          api.tick();
          assert.strictEqual(title()._dtSub.textContent, "Note · Phone");
          assert.strictEqual(also(), "2 other rooms working");
          // Others free again: the line goes, its space stays.
          globalThis._dtPipeRoomLabel = (r) => (r === "BOSS" ? "" : r === "PROGRAMMER" ? "Note · Phone" : "Free");
          api.tick();
          assert.strictEqual(also(), "");
          assert.strictEqual(title()._dtAlso.style.visibility, "hidden");
          rt.layout.name = "BOSS OFFICE";
          delete globalThis._dtPipeRoomLabel;
          // A slow room load (layout "" for over 2 s) keeps the view: OfficeType stays the stand-in.
          gv.OfficeType = "ENGINEER"; rt.layout.name = "ENGINEER OFFICE 3"; api.drop(); api.tick();
          let t2 = Date.now(); while (Date.now() - t2 < 500) {}
          rt.goToLayout = (n) => { asked = n; rt.layout.name = ""; };
          assert.strictEqual(api.step(1), true);
          assert.strictEqual(asked, "DESIGNER OFFICE 5");
          t2 = Date.now(); while (Date.now() - t2 < 2100) {}
          api.tick();
          assert.deepStrictEqual([api.view() && api.view().layout, gv.OfficeType], ["DESIGNER OFFICE 5", "BOSS"], "still loading: view kept");
          // Overtaken by another work room starting first: OfficeType still matches the room on screen.
          listeners.beforeanylayoutstart({ layout: { name: "PROGRAMMER OFFICE 4" } }); rt.layout.name = "PROGRAMMER OFFICE 4";
          assert.deepStrictEqual([api.view().room, gv.OfficeType], ["PROGRAMMER", "BOSS"], "the room on screen is the viewed one");
          // A move that never started, left on another work room: that room becomes the viewed one.
          rt.goToLayout = (n) => { asked = n; };
          t2 = Date.now(); while (Date.now() - t2 < 500) {}
          assert.strictEqual(api.step(-1), true);
          t2 = Date.now(); while (Date.now() - t2 < 2100) {}
          api.tick();
          assert.deepStrictEqual([api.view().room, api.view().layout, gv.OfficeType], ["PROGRAMMER", "PROGRAMMER OFFICE 4", "BOSS"]);
          // The real room starting gives the game its office back.
          listeners.beforeanylayoutstart({ layout: { name: "ENGINEER OFFICE 3" } }); rt.layout.name = "ENGINEER OFFICE 3";
          assert.deepStrictEqual([api.view(), gv.OfficeType], [null, "ENGINEER"]);
          // A press over the hidden centre while viewing a room is the panel's, the HUD's or the game
          // overlay's when one of those is under it, never swallowed.
          rt.goToLayout = go;
          t2 = Date.now(); while (Date.now() - t2 < 500) {}
          api.step(1);
          assert.strictEqual(api.view().room, "DESIGNER");
          const pressOn = (closest) => {
            const ev = { type: "pointerdown", button: 0, clientX: 5, clientY: 5, stopped: false, target: { closest: (sel) => closest(sel) },
              stopImmediatePropagation() { this.stopped = true; }, preventDefault() {} };
            for (const f of winListeners.pointerdown || []) f(ev);
            return ev.stopped;
          };
          assert.strictEqual(pressOn(() => null), true, "plain centre press still dropped while viewing");
          assert.strictEqual(pressOn((sel) => (sel.includes(".dt-layer") ? {} : null)), false, "a mod panel / HUD press goes through");
          setUi(true);
          assert.strictEqual(pressOn(() => null), false, "any open mod panel: press goes through");
          setUi(false);
          gv.class = "PAUSE";
          assert.strictEqual(pressOn(() => null), false, "pause / settings over the office: press goes through");
          gv.class = "GAMEPLAY";
          // J1: busy (engineer works), design only viewed: its + opens the game's picker in the boss office,
          // the real office stays busy (the queue stores what is made) and backing out returns to design.
          calls.length = 0;
          t2 = Date.now(); while (Date.now() - t2 < 800) {}
          assert.deepStrictEqual([api.view().room, api.real(), inst[7345].isVisible], ["DESIGNER", "ENGINEER", true]);
          assert.strictEqual(press("pointerdown"), true);
          assert.strictEqual(rt.layout.name, "BOSS OFFICE");
          assert.deepStrictEqual([api.view().room, api.real(), gv.OfficeType, api.pickFrom()], ["BOSS", "ENGINEER", "BOSS", "DESIGNER"]);
          assert.strictEqual(inst[7345].isVisible, true, "the boss office + is shown (it closes the picker)");
          setTimeout(() => {
            assert.deepStrictEqual([gv.CreateDevicesUI, calls.filter((c) => c === "CreateDevices_ON").length], ["WAIT", 1]);
            gv.CreateDevicesUI = "ON"; api.tick();
            closePress();
            gv.CreateDevicesUI = "OFF"; api.tick();
            setTimeout(() => {
              api.tick();
              assert.deepStrictEqual([rt.layout.name, api.view().room, api.real(), gv.OfficeType], ["DESIGNER OFFICE 5", "DESIGNER", "ENGINEER", "BOSS"],
                "backed out: the viewed room again, engineer still the real office");
              // review-2: no fixed 0.7 s guess. Off without the close press and nothing picked: back after 3 s.
              let t3 = Date.now(); while (Date.now() - t3 < 800) {}
              assert.strictEqual(press("pointerdown"), true);
              setTimeout(() => {
                gv.CreateDevicesUI = "ON"; api.tick();
                gv.CreateDevicesUI = "OFF"; api.tick();
                setTimeout(() => {
                  api.tick();
                  assert.strictEqual(rt.layout.name, "BOSS OFFICE", "off without close press: no bounce at 0.7 s");
                  setTimeout(() => {
                    api.tick();
                    assert.strictEqual(rt.layout.name, "DESIGNER OFFICE 5", "nothing picked for 3 s: back in the room");
                    // A pick on a slow machine: the cover fades in, the next screen comes much later. Never sent back.
                    t3 = Date.now(); while (Date.now() - t3 < 800) {}
                    assert.strictEqual(press("pointerdown"), true);
                    setTimeout(() => {
                      gv.CreateDevicesUI = "ON"; api.tick();
                      gv.CreateDevicesUI = "OFF"; api.tick(); // same tick as the pick: cover not drawn yet
                      inst[347] = { opacity: 0.3 };
                      setTimeout(() => {
                        api.tick();
                        assert.deepStrictEqual([rt.layout.name, api.pickFrom()], ["BOSS OFFICE", "DESIGNER"], "slow pick: stays, pick kept");
                        rt.layout.name = ""; // the picked screen loading
                        api.tick();
                        assert.strictEqual(api.pickFrom(), "DESIGNER", "kept while the next screen loads (the queue reads it)");
                        delete inst[347];
                        gv.class = "MY OS MENU"; rt.layout.name = "MY OS MENU";
                        api.tick();
                        assert.strictEqual(api.pickFrom(), null, "dropped once the picked screen runs");
                        console.log("rooms runtime ok");
                      }, 3300);
                    }, 400);
                  }, 2400);
                }, 1000);
              }, 400);
            }, 800);
          }, 400);
        }, 800);
      });
    }, 800);
  }, true);
}, 400);
