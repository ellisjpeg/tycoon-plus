// Runtime test for next.js with a fake Construct runtime: node test_next_runtime.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const arr = (rows) => ({ width: rows.length, height: 3, getAt: (x, y) => rows[x][y] });
// Refresh rate as on Realistic: 60, 60, 75 out early; 90 Hz on day 4136 (May 2019).
const refresh = arr([[30, -10], [60, -10], [75, 2680], [90, 4136], [120, 4440], [144, 4532]]);
const temp = { rows: [], get width() { return this.rows.length; }, getAt(x, y) { return this.rows[x][y]; } };
const research = { getAt: (x) => (x === 20 ? 10 : 0) };
const objects = {
  ArrayScreenRefreshRate_Smartphone: { getFirstInstance: () => refresh },
  ArrayScreenRefreshRate_Temp: { getFirstInstance: () => temp },
  ArrayMyResearch: { getFirstInstance: () => research },
  Text: { instances: () => [inst[704], inst[900]] },
  SVG: { instances: () => [inst[702], inst[703]] },
};
// layerToCssPx gives page px, so it includes the canvas offset (box: letterbox margin).
const box = { left: 10, top: 0 };
const layer = { isVisible: true, opacity: 1, layerToCssPx: (x, y) => [box.left + x / 2, box.top + y / 2 - scroll] };
let scroll = 0;
const mk = (l, t, r, b) => ({ isVisible: true, opacity: 1, layer, getBoundingBox: () => ({ left: l, top: t, right: r, bottom: b }) });
const inst = { 702: mk(800, 400, 840, 440), 703: mk(1080, 400, 1120, 440), 704: mk(860, 400, 1060, 440), 900: mk(0, 0, 10, 10) };
const listeners = {};
const rt = {
  globalVars: { DayTotal: 3300, ScreenRefreshRate: 3, ScreenRefreshRateID: 2, EditorNotification: "OFF" },
  objects,
  getInstanceByUid: (u) => inst[u] || null,
  addEventListener(n, f) { listeners[n] = f; },
};
globalThis.runtime = rt;
const made = [];
const sandbox = `var _dtUi={ru:()=>!!globalThis.__ru,gv:(n,d)=>runtime.globalVars[n]===undefined?d:runtime.globalVars[n],num:(n,d)=>{const v=Number(runtime.globalVars[n]);return Number.isFinite(v)?v:d},
 isOpen:()=>false, fit(){}, ensure:()=>({getBoundingClientRect:()=>({left:box.left,top:box.top})}),
 el(tag,cls,parent){const n={className:cls,style:{},isConnected:true,textContent:"",offsetWidth:60,offsetHeight:11,remove(){this.isConnected=false}};made.push(n);return n;}};
var document={querySelector:()=>({getBoundingClientRect:()=>({left:box.left,top:box.top,width:960,height:540,right:box.left+960,bottom:box.top+540})})};
var addEventListener=()=>0; var setInterval=()=>0;`;
const body = fs.readFileSync(path.join(__dirname, "next.js"), "utf8").replace("__DT_NEXT_MAP__", JSON.stringify({
  SMARTPHONE: [{ sel: "ScreenRefreshRate", id: "ScreenRefreshRateID", temp: "ArrayScreenRefreshRate_Temp", src: "ArrayScreenRefreshRate_Smartphone",
    date: 1, name: 0, pre: "", suf: " Hz", text: 704, right: 703, left: 702, res: 20 }],
}));
const api = new Function("made", "box", sandbox + body + "\nreturn globalThis._dtNextApi;")(made, box);

// Day number -> month text (day 1 = 1 Jan 2008, 365-day years).
assert.strictEqual(api.month(1), "Jan 2008");
assert.strictEqual(api.month(31), "Jan 2008");
assert.strictEqual(api.month(32), "Feb 2008");
assert.strictEqual(api.month(59), "Feb 2008");
assert.strictEqual(api.month(60), "Mar 2008");
assert.strictEqual(api.month(365), "Dec 2008");
assert.strictEqual(api.month(366), "Jan 2009");
assert.strictEqual(api.month(2680), "May 2015");
assert.strictEqual(api.month(4136), "May 2019");
assert.strictEqual(api.month(-10), "Jan 2008");
assert.strictEqual(api.str(5.62), "5.62");
assert.strictEqual(api.str(0.1 + 0.2), "0.3");

// The "next row" pick.
const src = (rows) => ({ width: rows.length, at: (x, y) => rows[x][y] });
const P = (rows, o) => api.pick(src(rows), Object.assign({ cap: null, date: 1, name: 0 }, o));
const R = [[30, -10], [60, -10], [75, 2680], [90, 4136], [120, 4440]];
// At the end of the list, dates rising: the next row and its day.
assert.deepStrictEqual(P(R, { today: 3300, sel: 3, ids: [0, 1, 2], id: 2 }), { row: 3, day: 4136 });
// Not at the end, no research gate: the arrow works, nothing to say.
assert.strictEqual(P(R, { today: 3300, sel: 2, ids: [0, 1, 2], id: 1 }), null);
// End of the list: everything is out.
assert.strictEqual(P(R, { today: 9000, sel: 5, ids: [0, 1, 2, 3, 4], id: 4 }), null);
// Rows whose name is 0 never show; the next named one appears on its turn.
assert.deepStrictEqual(P([[30, -10], [60, -10], [0, 4000], [90, 4136]], { today: 3300, sel: 2, ids: [0, 1], id: 1 }), { row: 3, day: 4136 });
// Dates out of order: the game counts rows that are out, so row `count` appears on the earliest future day.
assert.deepStrictEqual(P([[30, -10], [60, -10], [90, 5000], [120, 4500]], { today: 3300, sel: 2, ids: [0, 1], id: 1 }), { row: 2, day: 4500 });
// Research: next is out (in Temp) but ID >= cap stops the arrow.
assert.deepStrictEqual(P(R, { today: 4200, sel: 3, ids: [0, 1, 2, 3], id: 2, cap: 2 }), { row: 3, research: true });
assert.strictEqual(P(R, { today: 4200, sel: 3, ids: [0, 1, 2, 3], id: 2, cap: 3 }), null);
// Both gates: the date is what holds it back, so say the date.
assert.deepStrictEqual(P(R, { today: 3300, sel: 3, ids: [0, 1, 2], id: 2, cap: 2 }), { row: 3, day: 4136 });
// Other date / name columns (waterproof keeps its date in column 2).
assert.deepStrictEqual(api.pick(src([["IP67", 0, -10], ["IP68", 0, 2952]]), { today: 2500, sel: 1, ids: [0], id: 0, cap: null, date: 2, name: 0 }), { row: 1, day: 2952 });
// Label: the game's own prefix/suffix formula.
const e = { pre: "", suf: " Hz", name: 0 };
assert.strictEqual(api.text(e, src(R), { row: 3, day: 4136 }), "Next: 90 Hz, May 2019");
assert.strictEqual(api.text(e, src(R), { row: 3, research: true }), "Next: 90 Hz, needs research");
// A Russian game reads the line in Russian (month too).
globalThis.__ru = true;
assert.strictEqual(api.text(e, src(R), { row: 3, day: 4136 }), "Далее: 90 Hz, май 2019");
assert.strictEqual(api.text(e, src(R), { row: 3, research: true }), "Далее: 90 Hz, нужно исследование");
globalThis.__ru = false;
assert.strictEqual(api.text({ pre: "f/", suf: "", name: 0 }, src([[1.8]]), { row: 0, day: 1 }), "Next: f/1.8, Jan 2008");
assert.strictEqual(api.text(e, src(R), null), "");
// Language-table names (TV cooling, headphone modes): the cell is a key into ArrayLanguage.
const L = { choose: 0, at: (x, y) => (y === 5000 ? "Liquid cooling" : 0) };
assert.strictEqual(api.text({ pre: "", suf: "", name: 0, lang: true }, src([[5000, 3000]]), { row: 0, day: 3000 }, L), "Next: Liquid cooling, Mar 2016");
assert.strictEqual(api.text({ pre: "", suf: "", name: 0, lang: true }, src([[5001, 3000]]), { row: 0, day: 3000 }, L), "");
assert.strictEqual(api.text({ pre: "", suf: "", name: 0, lang: true }, src([[5000, 3000]]), { row: 0, day: 3000 }, null), "");

// Live page: Temp holds rows 0..2 (75 Hz selected, right arrow greyed).
temp.rows = [[30, 0], [60, 1], [75, 2]];
let found = api.find();
assert.strictEqual(found.length, 1);
assert.strictEqual(found[0].s, "Next: 90 Hz, May 2019");
// Placed centred between the arrows, under the selector, following scroll.
api.tick();
const note = made[0];
assert.strictEqual(note.textContent, "Next: 90 Hz, May 2019");
assert.strictEqual(note.style.visibility, "visible");
assert.strictEqual(note.style.left, Math.round(10 + 960 / 2 - 10) + "px");
assert.strictEqual(note.style.top, Math.round((440 + 1) / 2) + "px");
scroll = 30;
api.tick();
assert.strictEqual(note.style.top, Math.round((440 + 1) / 2 - 30) + "px");
// Letterboxed (iPad / 16:10 window): canvas and mods layer 64 px down -> same spot on the panel.
box.top = 64;
api.tick();
assert.strictEqual(note.style.top, Math.round((440 + 1) / 2 - 30) + "px");
assert.strictEqual(note.style.visibility, "visible");
box.top = 0;
api.tick();
scroll = 300; // scrolled off the top: hidden, not drawn over the header
api.tick();
assert.strictEqual(note.style.visibility, "hidden");
scroll = 0;
// No room: another label sits right under the selector -> no note.
inst[900] = mk(900, 446, 1000, 470);
api.hide();
api.tick();
assert.strictEqual(made[1].style.visibility, "hidden");
// One-column pages (col 0): the next heading sits right under the selector, so the line goes
// beside the right arrow, level with the value; still hidden when that spot is taken too.
api.map.SMARTPHONE[0].col = 0;
temp.rows = [[0], [1], [2]];
api.hide();
api.tick();
let side = [...api.notes.values()][0].el;
assert.strictEqual(side.style.visibility, "visible");
assert.strictEqual(side.style.left, Math.round(10 + (1120 + 16 + 60) / 2 - 10) + "px");
assert.strictEqual(side.style.top, Math.round((420 - 11) / 2) + "px");
inst[901] = mk(1130, 400, 1300, 440);
objects.Text.instances = () => [inst[704], inst[900], inst[901]];
api.hide();
api.tick();
assert.strictEqual([...api.notes.values()][0].el.style.visibility, "hidden");
objects.Text.instances = () => [inst[704], inst[900]];
delete api.map.SMARTPHONE[0].col;
temp.rows = [[30, 0], [60, 1], [75, 2]];
inst[900] = mk(0, 0, 10, 10);
// The line goes under the selector's panel, not under the value Text's box, which is taller
// than its text and reaches past the panel (phone refresh rate: box 435-500, panel 425-495).
inst[704] = mk(860, 400, 1060, 500);
objects["9patch3"] = { instances: () => [inst[950], inst[951]] };
inst[950] = mk(790, 395, 1130, 436); // this selector's panel
inst[951] = mk(0, 0, 2000, 1000); // a page-sized background is never the panel
api.hide();
api.tick();
let under = [...api.notes.values()][0].el;
assert.strictEqual(under.style.visibility, "visible");
assert.strictEqual(under.style.top, Math.round((436 + 1) / 2) + "px");
assert.strictEqual(under.style.left, Math.round(10 + 960 / 2 - 10) + "px");
// The next heading (a Text) right under the panel: no room -> hidden, never drawn over it.
inst[900] = mk(800, 455, 1100, 480);
api.hide();
api.tick();
assert.strictEqual([...api.notes.values()][0].el.style.visibility, "hidden");
// A Text counts by its visible line (top of its box + textHeight), not its taller box:
// a heading box reaching down past the panel whose words end above the line leaves room.
inst[900] = mk(800, 380, 1100, 470);
api.hide();
api.tick();
assert.strictEqual([...api.notes.values()][0].el.style.visibility, "hidden");
inst[900].textHeight = 30;
api.hide();
api.tick();
assert.strictEqual([...api.notes.values()][0].el.style.visibility, "visible");
inst[900] = mk(0, 0, 10, 10);
// The next selector's panel right under: hidden too.
inst[952] = mk(790, 450, 1130, 490);
objects["9patch3"].instances = () => [inst[950], inst[951], inst[952]];
api.hide();
api.tick();
assert.strictEqual([...api.notes.values()][0].el.style.visibility, "hidden");
delete objects["9patch3"];
inst[704] = mk(860, 400, 1060, 440);
// The arrow is not stopped (not at the end) -> nothing.
rt.globalVars.ScreenRefreshRate = 2; rt.globalVars.ScreenRefreshRateID = 1;
assert.strictEqual(api.find().length, 0);
// Research case on the live page: 90 Hz out by date but cap = 10 - 1 > ID? set research low.
rt.globalVars.DayTotal = 4200; temp.rows = [[30, 0], [60, 1], [75, 2], [90, 3]];
rt.globalVars.ScreenRefreshRate = 3; rt.globalVars.ScreenRefreshRateID = 2;
research.getAt = (x) => (x === 20 ? 3 : 0); // cap 2: ID 2 is stopped
assert.strictEqual(api.find()[0].s, "Next: 90 Hz, needs research");
// A game pop-up, a page whose selector is gone, or a page not settled: nothing.
rt.globalVars.EditorNotification = "ON";
assert.strictEqual(api.find().length, 0);
rt.globalVars.EditorNotification = "OFF";
rt.globalVars.ScreenRefreshRateID = 1;
assert.strictEqual(api.find().length, 0);
rt.globalVars.ScreenRefreshRateID = 2;
inst[703].isVisible = false;
assert.strictEqual(api.find().length, 0);
inst[703].isVisible = true;
// One-column Temp (TV, scooter, keyboard, console, VR): the source row is in column 0.
api.map.SMARTPHONE[0].col = 0;
temp.rows = [[0], [1], [2], [3]];
assert.strictEqual(api.find()[0].s, "Next: 90 Hz, needs research");
temp.rows = [[0, 9], [1, 9], [2, 9], [3, 9]]; // column 1 is not read
assert.strictEqual(api.find()[0].s, "Next: 90 Hz, needs research");
rt.globalVars.ScreenRefreshRateID = 9;
assert.strictEqual(api.find().length, 0);
rt.globalVars.ScreenRefreshRateID = 2;
delete api.map.SMARTPHONE[0].col;
temp.rows = [[30, 0], [60, 1], [75, 2], [90, 3]];
// Page change removes the notes.
api.tick();
assert.ok(api.notes.size > 0);
api.hide();
assert.strictEqual(api.notes.size, 0);
console.log("next runtime ok");
