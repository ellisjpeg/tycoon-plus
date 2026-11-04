// ── Pipeline: up to three items in development, one per work room ──
// The game keeps one item in development in its globals (DeviceTypeCreatingNow,
// OfficeType, Bubbles*, ...). Here exactly one item is "live" in those globals
// and the game's own code runs it unchanged; the others are parked in slots
// with their own copy of those globals. Switching rooms with the room button
// (rooms.js) parks the live item and loads the room's own item, so the room on
// screen is always the game's own screen for its item.
//
// Rooms that are not on screen keep working: their Bubbles go down at the
// planner's own points per second for that office while the day clock runs,
// and they earn the research points measured for that room on screen. A room
// whose work is done waits for the player, like the game's own next stage: no
// item moves on by itself (Jayden: moving one item on must never move another).
//
// When the design room frees up, the live item is parked, the globals are made
// idle and the queue's own pump replays the next entry through LOADING EDITOR.
// Several devices of one kind can be in development: BATCH, REVIEWS, press and
// launch read the newest row (x = 0) of the device table, so the live item's
// own row is moved there whenever it goes live (_dtpFront). Parts (CPU, GPU,
// OS) still wait for their own kind to finish.
//
// State per company in ArraySaves row 152: {v, company, start, focus, items}.
var _DTP_ROW = 152;
var _DTP_V = 1;
var _DTP_ROOMS = ["DESIGNER", "PROGRAMMER", "ENGINEER"];
var _DTP_STAGE = { DESIGNER: "design", PROGRAMMER: "programmer", ENGINEER: "engineer" };
var _DTP_WORK = { DESIGNER: ["BubblesDesign"], PROGRAMMER: ["BubblesTechnology", "BubblesBugs"], ENGINEER: ["BubblesEngineers"] };
// Globals that belong to the item in development (276 GAMEPLAY, 260-282, OS and chip editors).
var _DTP_VARS = ["DeviceTypeCreatingNow", "DeviceType", "DevicesCount", "DeviceCountCreatingNow", "DeviceName",
  "DeviceCostPrice", "DevicePrice", "DeviceColor", "PressConferenceCompleted", "PressConferenceRandom",
  "BubblesDesign", "BubblesTechnology", "BubblesBugs", "BubblesEngineers",
  "SeriesID", "SeriesCreatedNew", "SeriesName",
  "MyOSDevice", "MyOsCreatingType", "MyOS_Name", "MyOS_VersionName", "MyOSRating", "MyOSRating_Update", "MyOSUpdatePrice"];
// DeviceTypeCreatingNow of a queue entry.
var _DTP_DEV = { SMARTPHONE: "SMARTPHONES", TABLET: "TABLETS", LAPTOP: "LAPTOPS", WATCHES: "WATCHES", HEADPHONES: "HEADPHONES",
  TV: "TV", SCOOTER: "SCOOTER", KEYBOARD: "KEYBOARD", CONSOLE: "CONSOLE", VR: "VR CONSOLE" };
var _DTP_CPU = { SMARTPHONE: "CPU SMARTPHONES", LAPTOP: "CPU LAPTOPS", CONSOLE: "CPU CONSOLES", VR: "CPU VR" };
var _DTP_TEXT = {
  ready: { en: "Ready", ru: "Готово" },
  starting: { en: "Starting next…", ru: "Запуск следующего…" },
  busy: { en: "{room} is still working on {name}", ru: "{room}: ещё идёт работа над {name}" },
  waits: { en: "{room}: {name} is ready and waiting for you. Finish it there first.", ru: "{room}: {name} готово и ждёт вас. Сначала завершите его там." },
  wait_kind: { en: "{name} is still in development. One device of each kind at a time.", ru: "{name} ещё в разработке. Одновременно одно устройство каждого вида." },
  wait_release: { en: "{name} is being released first", ru: "Сначала выходит {name}" },
  will: { en: "{name} will move to {room} when it's free", ru: "{name} перейдёт в «{room}», когда там освободится" },
  waiting: { en: "Waiting for {room}", ru: "Ждёт: {room}" },
  marked: { en: "Waiting for {room}: {name}", ru: "Ждёт «{room}»: {name}" },
};

var _dtp = { focus: null, items: [], seq: 0 };
var _dtpKey = "";
var _dtpStarting = null;   // {at, prev}: the queue is replaying the next entry
var _dtpGoTo = "";         // room to show once the screen is calm (after a release)
var _dtpCooldown = 0;
var _dtpLast = 0;
var _dtpPps = { at: 0 };
var _dtpRp = {};           // room -> {gain, secs}: research measured on screen
var _dtpRpFrac = {};       // room -> raw research points not yet paid
var _dtpPrevRp = null;
var _dtpLeftAt = 0;
var _dtpRefocus = false;  // a release left no live item; the next one goes live when calm
var _dtpRestart = "";      // room whose screen starts again when calm, though it is already on show
var _dtpRestartAt = 0;     // when that start was asked for (a slow machine takes a while to start it)
var _dtpStartedAs = { layout: "", ot: "" }; // the last screen to start and OfficeType at its start
var _dtpWired = false;

function _dtpGv() {
  const rt = globalThis.runtime;
  return rt && rt.globalVars ? rt.globalVars : null;
}
function _dtpFind(id) {
  return _dtp.items.find((it) => it.id === id) || null;
}
function _dtpAt(room) {
  return _dtp.items.find((it) => it.room === room) || null;
}
function _dtpFocused() {
  return _dtp.focus ? _dtpFind(_dtp.focus) : null;
}
function _dtpReal(gv) {
  return globalThis._dtRooms ? globalThis._dtRooms.real() : String(gv.OfficeType || "BOSS");
}
function _dtpHere() {
  return globalThis._dtRooms ? globalThis._dtRooms.here() : "";
}
function _dtpViewing() {
  return !!(globalThis._dtRooms && globalThis._dtRooms.view());
}
function _dtpCopy(gv) {
  const o = {};
  for (const k of _DTP_VARS) if (k in gv) o[k] = gv[k];
  return o;
}
function _dtpWrite(gv, vars) {
  for (const k of _DTP_VARS) if (k in vars && k in gv) gv[k] = vars[k];
}
function _dtpIsOsSoft(dtcn) {
  const t = String(dtcn || "");
  return t === "SOFTWARE" || t.indexOf("OS ") === 0;
}
// The game clears DeviceTypeCreatingNow only in 282 REVIEWS, so after your own OS or app it keeps
// that type. Once the pipeline has let the item go (no live item, none of that kind, no room, no
// release card waiting) the type is left over: nothing is in development.
function _dtpSpent(gv) {
  const t = String(gv.DeviceTypeCreatingNow || "");
  if (!_dtpIsOsSoft(t) || _dtp.focus || _dtpStarting || _DTP_ROOMS.indexOf(_dtpReal(gv)) >= 0) return false;
  if (_dtp.items.some((it) => String(it.vars.DeviceTypeCreatingNow || "") === t)) return false;
  return !(typeof _dtqReleasing === "function" && _dtqReleasing());
}
// Table family of a queue entry, "" when unknown (it then waits for an empty pipeline).
function _dtpEntryType(entry) {
  if (!entry) return "";
  if (entry.kind === "part") {
    if (entry.part === "CPU") return _DTP_CPU[entry.platform] || "";
    if (entry.part === "GPU") return "GPU";
    if (entry.part === "OS") return "OS " + String(entry.platform || "");
    return "";
  }
  return _DTP_DEV[entry.type] || "";
}
function _dtpWork(vars, room) {
  let w = 0;
  for (const k of _DTP_WORK[room] || []) w += Math.max(0, Number(vars[k]) || 0);
  return w;
}
// Live work of an item: the globals for the live one, its slot otherwise.
function _dtpVarsOf(it, gv) {
  return it.id === _dtp.focus ? gv : it.vars;
}
function _dtpDone(it, gv) {
  return _dtpWork(_dtpVarsOf(it, gv), it.room) <= 0;
}
function _dtpNextRoom(it, gv) {
  if (it.room === "DESIGNER") return "PROGRAMMER";
  if (it.room === "PROGRAMMER") return _dtpIsOsSoft(_dtpVarsOf(it, gv).DeviceTypeCreatingNow) ? "" : "ENGINEER";
  return "";
}
function _dtpNewItem(gv, room) {
  const it = { id: "p" + Date.now().toString(36) + (++_dtp.seq), room: room, vars: _dtpCopy(gv) };
  _dtp.items.push(it);
  return it;
}
// Launch-day reviews (reviews.js) park the live item and put a waiting device's
// line at x = 0 with its type in the globals; the rooms are left alone till they end.
// So does a launch-day presentation, which shows another device's slides.
function _dtpReviewing() {
  const r = globalThis._dtReviewsApi;
  const e = globalThis._dtEventApi;
  return !!((r && r.state().run) || (e && e.run()));
}
function _dtpPark(gv) {
  const f = _dtpFocused();
  if (f) f.vars = _dtpCopy(gv);
  _dtp.focus = null;
  return f;
}
function _dtpSameDevice(vars, gv) {
  return String(vars.DeviceTypeCreatingNow || "") === String(gv.DeviceTypeCreatingNow || "") &&
    String(vars.DeviceName || "") === String(gv.DeviceName || "");
}
// Another item took this item's room: it steps back to the nearest free earlier room (its
// finished work is kept, so it moves on again by itself). An item in engineering has made its
// batch on the copies screen, so it never steps back: it waits, holding its claim, and goes
// back in once engineering is free. So does an item with no free earlier room.
function _dtpBump(it) {
  // Engineering comes after the copies screen: stepping back from it would replay that screen.
  if (it.room !== "ENGINEER") {
    for (let i = _DTP_ROOMS.indexOf(it.room) - 1; i >= 0; i--) {
      if (_dtpAt(_DTP_ROOMS[i]) || _dtpWaiter(_DTP_ROOMS[i])) continue;
      it.room = _DTP_ROOMS[i];
      return true;
    }
  }
  console.warn("[Pipeline] two items in " + it.room + ": " + it.id + " waits for the room");
  it.wait = it.room;
  it.room = "";
  return false;
}
// The parked item waiting to get back into this room, if any.
function _dtpWaiter(room) {
  return _dtp.items.find((it) => it.wait === room && !it.room) || null;
}
// A waiting item goes back into its room as soon as nothing else holds it.
function _dtpUnwait() {
  for (const it of _dtp.items) {
    if (!it.wait || it.room || it.id === _dtp.focus || _dtpAt(it.wait)) continue;
    it.room = it.wait;
    delete it.wait;
  }
}
// A press on a finished item's next stage while that room is busy is the player's "go when free"
// (Jayden: "that should've put it in queue"). The item keeps showing in its own room, marked for the
// next one, and goes in by itself the moment that room is free (_dtpGoOn), first pressed first.
// Nothing moves on without such a press.
function _dtpMark(f, room) {
  if (f.go !== room) {
    f.go = room;
    f.goAt = Date.now();
  }
  try {
    const nm = _dtpLabelOf(f);
    _dtUi.toast(_dtUi.t(_DTP_TEXT.will, { name: nm, room: _dtUi.t(_DTR_TEXT[room]) }), nm);
  } catch (e) {}
}
// The live item moved into a room (the game's own next-stage move). A parked item already there
// keeps the room; the room's own item goes live on its screen, which starts again so its staff and
// stage controls are its own. The newcomer is marked to go when free and keeps showing in the room
// it came from, holding its work (from programming its copies are made: the copies screen comes with
// the press, as in the game). Pushing the old item back a room instead hid it, and it later came back
// "finished" in the room it had already done. Returns false while the game is still on its way there.
function _dtpArrive(gv, f, room) {
  const other = _dtpAt(room);
  if (!other || other.id === f.id) {
    f.room = room;
    delete f.wait;
    delete f.go;
    delete f.goAt;
    return true;
  }
  if (_dtpHere() !== room || String(gv.class || "") !== "GAMEPLAY") return false;
  console.warn("[Pipeline] " + f.id + " reached " + room + " held by " + other.id + ": it goes in when free");
  f.vars = _dtpCopy(gv);
  if (f.room) _dtpMark(f, room);
  else f.wait = room;
  _dtp.focus = null;
  _dtpLoadItem(gv, other);
  _dtpGoTo = room;
  _dtpRestart = room;
  return true;
}
// Marked items go into their next room once it is free, first pressed first. A parked one just takes
// the room (its work there was set when it was pressed); the live one, on its own screen, makes the
// game's own move (OfficeType, then that room's screen).
function _dtpGoOn(gv) {
  for (const room of ["PROGRAMMER", "ENGINEER"]) {
    if (_dtpAt(room) || _dtpWaiter(room)) continue;
    const it = _dtp.items.filter((i) => i.go === room && i.room && i.room !== room).sort((a, b) => (a.goAt || 0) - (b.goAt || 0))[0];
    if (!it) continue;
    if (it.id !== _dtp.focus) {
      it.room = room;
      delete it.go;
      delete it.goAt;
      continue;
    }
    const r = globalThis._dtRooms;
    if (_dtpStarting || _dtpViewing() || _dtpHere() !== it.room || !_dtpCalm(gv) || !r || !r.canMove()) continue;
    const from = it.room;
    it.room = room;
    gv.OfficeType = room;
    if (r.go(room)) {
      delete it.go;
      delete it.goAt;
    } else {
      it.room = from;
      gv.OfficeType = from;
    }
  }
}
// Device table name of a DeviceTypeCreatingNow ("" for parts).
function _dtpArrName(type) {
  return typeof _DTR_ARRAY === "object" ? _DTR_ARRAY[String(type || "")] || "" : "";
}
// The item's own device table (devices only; parts have none here).
function _dtpTable(it, gv) {
  const name = _dtpArrName(_dtpVarsOf(it, gv).DeviceTypeCreatingNow);
  try {
    return name ? globalThis.runtime.objects[name].getFirstInstance() : null;
  } catch (e) {
    return null;
  }
}
// A row's variant names (y = 0-2, column 8): the item's key to its own row.
function _dtpRowKey(a, x) {
  const n = [];
  for (let y = 0; y < Math.min(3, a.height); y++) n.push(String(a.getAt(x, y, 8)));
  return n.join("|");
}
// The game's own ID of a row (column 10, set when the editor adds it; 0 if none yet): it tells
// apart two rows with exactly the same variant names, which share a key.
function _dtpRowId(a, x) {
  const v = Number(a.depth > 10 ? a.getAt(x, 0, 10) : 0);
  return Number.isFinite(v) && v > 0 ? v : 0;
}
// Records the row as the item's own: its key, and its ID once the game has given one.
function _dtpTake(a, x, it) {
  it.key = _dtpRowKey(a, x);
  const id = _dtpRowId(a, x);
  if (id) it.rid = id;
  else delete it.rid;
  return x;
}
// The item's unreleased row (column 7 is -1 until release); older saves have no
// key, so their row is found by the item's name, or else as the only unreleased
// row no other item holds (the live item holds x = 0), and the key is kept from then on.
function _dtpRowOf(a, it, gv) {
  const nm = String(_dtpVarsOf(it, gv).DeviceName || "");
  // The live item holds x = 0 only of its own kind's table.
  const f = _dtp.focus && _dtp.focus !== it.id ? _dtpFocused() : null;
  const liveHere = !!f && _dtpArrName(_dtpVarsOf(f, gv).DeviceTypeCreatingNow) === _dtpArrName(_dtpVarsOf(it, gv).DeviceTypeCreatingNow);
  const free = [];
  for (let x = 0; x < a.width; x++) {
    if (String(a.getAt(x, 0, 7)) !== "-1") continue;
    const key = _dtpRowKey(a, x), id = _dtpRowId(a, x);
    // Another item holds this row: same key and, when both are known, same ID.
    const held = (x === 0 && liveHere) || _dtp.items.some((o) => o !== it && o.key === key && (!o.rid || !id || o.rid === id));
    // Two rows can share a key (same variant names): the item's ID picks its own.
    const mine = it.key ? key === it.key && (it.rid ? it.rid === id : !_dtp.items.some((o) => o !== it && o.rid && o.rid === id)) :
      nm && key.split("|").indexOf(nm) >= 0 && !_dtp.items.some((o) => o !== it && o.rid && o.rid === id);
    if (mine) return _dtpTake(a, x, it);
    if (!it.key && !held) free.push(x);
  }
  if (free.length !== 1) return -1;
  return _dtpTake(a, free[0], it);
}
// Moves the item's row to x = 0; the rows in front of it shift back by one.
function _dtpFront(it, gv) {
  const a = _dtpTable(it, gv);
  if (!a) return;
  const x = _dtpRowOf(a, it, gv);
  if (x <= 0) return;
  const h = a.height, d = a.depth, row = [];
  for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) row.push(a.getAt(x, y, z));
  for (let i = x; i > 0; i--)
    for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) a.setAt(a.getAt(i - 1, y, z), i, y, z);
  let k = 0;
  for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) a.setAt(row[k++], 0, y, z);
}
// The press conference asks about the newest rated device of each kind
// (260 PRESS CONFERENCE: x = 0 of a table, x = 1 of the live item's own). With
// other items in the works, or a launch still waiting for its day, those rows
// have no rating yet ("---"), so the questions about the last model were lost.
// For its start the rated rows move up, the one released last first; right after, every row goes back.
var _dtpPressMoved = [];
function _dtpRated(a, x) {
  const v = a.getAt(x, 0, 5);
  return String(v).trim() !== "" && Number.isFinite(Number(v));
}
function _dtpOrderRows(a, order) {
  const h = a.height, d = a.depth, rows = order.map((x) => {
    const r = [];
    for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) r.push(a.getAt(x, y, z));
    return r;
  });
  rows.forEach((r, i) => {
    let k = 0;
    for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) a.setAt(r[k++], i, y, z);
  });
}
function _dtpPressSort(ev) {
  if (!ev || !ev.layout || String(ev.layout.name || "") !== "PRESS CONFERENCE") return;
  const gv = _dtpGv();
  if (!gv || _dtpPressMoved.length || typeof _DTR_ARRAY !== "object") return;
  const live = _dtpArrName(gv.DeviceTypeCreatingNow);
  for (const name of Object.values(_DTR_ARRAY)) {
    let a = null;
    try { a = globalThis.runtime.objects[name].getFirstInstance(); } catch (e) {}
    if (!a || a.width < 2) continue;
    const keep = name === live ? 1 : 0, xs = [];
    for (let x = keep; x < a.width; x++) xs.push(x);
    // Rated rows by release day, newest first: with planned launch days a later model can come out first.
    const rel = (x) => Number(a.getAt(x, 0, 7)) || 0;
    const order = xs.filter((x) => _dtpRated(a, x)).sort((p, q) => rel(q) - rel(p)).concat(xs.filter((x) => !_dtpRated(a, x)));
    if (order.every((x, i) => x === xs[i])) continue;
    if (keep) order.unshift(0);
    _dtpOrderRows(a, order);
    _dtpPressMoved.push({ a, order });
  }
}
function _dtpPressUnsort() {
  for (const m of _dtpPressMoved.splice(0).reverse()) {
    const back = [];
    m.order.forEach((x, i) => { back[x] = i; });
    if (m.a.width === m.order.length) _dtpOrderRows(m.a, back);
  }
}
function _dtpLoadItem(gv, it) {
  _dtpWrite(gv, it.vars);
  gv.OfficeType = it.room;
  _dtp.focus = it.id;
  _dtpFront(it, gv);
}
// Room button: the room's own item becomes the live one (returns its room).
function _dtpBeforeRoom(room, real) {
  const gv = _dtpGv();
  if (!gv || _dtpStarting) return undefined;
  // Launch-day reviews or a show hold another device in the globals (the live item is parked): no move till they end.
  if (_dtpReviewing()) return false;
  const f = _dtpFocused();
  if (f && real === "BOSS") return undefined; // the live item is in batch delivery / reviews
  const it = _dtpAt(room);
  if (!it) return undefined;
  if (f && f.id === it.id) return room;
  _dtpRefocus = false;
  _dtpPark(gv);
  _dtpLoadItem(gv, it);
  return room;
}
// Same moments the day clock runs (276 GAMEPLAY 1854-1859) on an office screen.
function _dtpClockRuns(gv) {
  if (!_dtUi.onOffice()) return false;
  if (String(gv.class || "") !== "GAMEPLAY" || Number(gv.GameplayPause || 0) !== 0) return false;
  if (String(gv.Assistant || "OFF") !== "OFF" || String(gv.CreateDevicesUI || "OFF") !== "OFF") return false;
  return !(_dtUi.isOpen && _dtUi.isOpen());
}
function _dtpCalm(gv) {
  if (!_dtpClockRuns(gv)) return false;
  const q = globalThis._dtQueueApi;
  if (q && (q.capturing() || q.replaying())) return false;
  return !(globalThis._dtLaunchPending === true);
}
function _dtpPpsOf(room) {
  const now = Date.now();
  if (now - _dtpPps.at > 5000) {
    _dtpPps = { at: now };
    for (const r of _DTP_ROOMS) {
      try {
        const p = computeBubblesPlan(_DTP_STAGE[r], { runtime: globalThis.runtime });
        _dtpPps[r] = p && p.pps > 0 ? p.pps : 0;
      } catch (e) {
        _dtpPps[r] = 0;
      }
    }
  }
  return _dtpPps[room] || 0;
}
// Off screen a room earns the game's own rate for its staff. The on-screen
// measure is only a fallback: it reads 0 until a room is watched, and the
// first bubbles take a while to land, so a short visit learned 0 too.
// Decision: with Difficulty off, background rooms pay the game's normal research cost. research.js
// (part of Difficulty) gives the rate; without it the same staff-timer rate is read from the game's
// own data here, with no difficulty scaling: each worker's bubble interval
// (1.4 - (research stat - 10)/90 * .7 - mood/100 * .3) / (1 + .1 * perk 7,1), x (1 + 5% perk 7,0).
function _dtpGameRoomRate(stage) {
  try {
    const rt = globalThis.runtime;
    const chars = _inst45(rt, "ArrayEmployees_Characters"), perks = _inst45(rt, "ArrayMyPerks"), mine = _inst45(rt, "ArrayMyEmployees");
    const perk = 1 + 0.1 * (Number(perks && _at41(perks, 7, 1, 0)) || 0);
    const lucky = Math.min(1, 0.05 * (Number(perks && _at41(perks, 7, 0, 0)) || 0));
    let sum = 0;
    for (const w of _officeStaff(rt, STAGES[stage]).workers) {
      const stat = Math.min(100, Math.max(10, Number(_at41(chars, w.id, 2, 0)) || 0));
      const mood = Math.min(100, Math.max(0, Number(mine && _at41(mine, w.id, 1, 0)) || 0));
      sum += 1 / Math.max(0.15, (1.4 - ((stat - 10) / 90) * 0.7 - (mood / 100) * 0.3) / perk);
    }
    return sum * (1 + lucky);
  } catch (e) {
    return 0;
  }
}
function _dtpRoomRateFn() {
  if (typeof globalThis._dtResearchRoomRate === "function") return globalThis._dtResearchRoomRate;
  const game = typeof _officeStaff === "function" && typeof _inst45 === "function" && typeof _at41 === "function" && typeof STAGES === "object";
  return game ? _dtpGameRoomRate : null;
}
function _dtpRpRate(room) {
  const f = _dtpRoomRateFn();
  if (typeof f === "function") return (Number(f(_DTP_STAGE[room])) || 0) * _dtpRpLanded(f);
  const m = _dtpRp[room];
  return m && m.secs >= 5 ? m.gain / m.secs : 0;
}
// Share of the staff timers' rate that rooms really landed on screen (bubbles
// in flight, frame rate), so off screen pays no more than watching would.
function _dtpRpLanded(f) {
  let got = 0, max = 0;
  for (const r in _dtpRp) {
    const m = _dtpRp[r];
    if (m.secs >= 5) { got += m.gain; max += (Number(f(_DTP_STAGE[r])) || 0) * m.secs; }
  }
  return max > 0 ? Math.min(1, got / max) : 1;
}
// Off-screen work for dt seconds: every item whose room is not the live screen.
function _dtpSimulate(gv, dt) {
  const here = _dtpHere(), viewing = _dtpViewing();
  const rp = {};
  for (const it of _dtp.items) {
    if (!it.room) continue;
    const live = it.id === _dtp.focus;
    if (live && here === it.room && !viewing) continue;
    const vars = live ? gv : it.vars;
    if (_dtpWork(vars, it.room) <= 0) continue;
    // Whole points only, like the game's bubbles; the remainder carries over.
    const step = _dtpPpsOf(it.room) * dt;
    const frac = it.frac || (it.frac = {});
    for (const k of _DTP_WORK[it.room]) {
      const v = Math.round(Number(vars[k]) || 0);
      if (v <= 0) continue;
      const acc = (frac[k] || 0) + step;
      const whole = Math.floor(acc);
      frac[k] = acc - whole;
      vars[k] = Math.max(0, v - whole);
    }
    rp[it.room] = (rp[it.room] || 0) + _dtpRpRate(it.room) * dt;
  }
  // Off-screen points must not count as the live room's own research rate.
  const before = _dtpRpCount(gv);
  for (const room in rp) {
    const acc = (_dtpRpFrac[room] || 0) + rp[room];
    const n = Math.floor(acc);
    _dtpRpFrac[room] = acc - n;
    if (n < 1) continue;
    // Pay raw points like the game's own bubbles: the research balance applies
    // the difficulty and the yearly allowance, and difficulty.js skips them.
    const pay = typeof globalThis._dtResearchBubble === "function" ? globalThis._dtResearchBubble(n, _DTP_STAGE[room]) : n;
    if (pay > 0) gv.ResearchCoins = (Number(gv.ResearchCoins) || 0) + pay;
  }
  if (_dtpPrevRp !== null) _dtpPrevRp += _dtpRpCount(gv) - before;
}
// Research counter the rate is measured in: raw bubble points when the
// research balance is on, otherwise the coins themselves.
function _dtpRpCount(gv) {
  return typeof globalThis._dtResearchRaw === "function" ? globalThis._dtResearchRaw() : Number(gv.ResearchCoins) || 0;
}
// Research bubbles pay +1 (+2 with the perk): measure that rate per room on screen.
function _dtpMeasureRp(gv, dt) {
  const rc = _dtpRpCount(gv);
  const prev = _dtpPrevRp;
  _dtpPrevRp = rc;
  const f = _dtpFocused(), here = _dtpHere();
  if (prev === null || !f || f.room !== here || _dtpViewing() || _dtpWork(gv, here) <= 0) return;
  const m = _dtpRp[here] || (_dtpRp[here] = { gain: 0, secs: 0 });
  const d = rc - prev;
  if (d > 0 && d <= 4) m.gain += d;
  m.secs += dt;
  if (m.secs > 120) {
    m.gain *= 0.5;
    m.secs *= 0.5;
  }
}
// Staff who can work in a room: hired for its profession and not on vacation (276:3549-3560).
var _DTP_PROF = { DESIGNER: "DESIGNERS", PROGRAMMER: "PROGRAMMERS", ENGINEER: "ENGINEERS" };
function _dtpStaffIn(room) {
  try {
    const o = globalThis.runtime.objects, me = o.ArrayMyEmployees.getFirstInstance(), all = o.ArrayEmployees.getFirstInstance();
    let n = 0;
    for (let i = 0; i < me.width; i++)
      if (String(me.getAt(i, 3)) !== "Vacation" && String(all.getAt(me.getAt(i, 0), 4)) === _DTP_PROF[room]) n++;
    return n;
  } catch (e) {
    return 0;
  }
}
// The game starts each worker's bubble timer only when an office layout starts
// (276 GAMEPLAY:3535-3580 EmployeesVisible). A live room whose staff never got
// their timers sits idle with work left, until a reload. When the clock runs,
// the room has its own staff and its work has not moved for 12 s, the room's
// layout is started again, as a reload would.
var _dtpStallAt = { key: "", sig: "", work: 0, secs: 0, last: 0 };
function _dtpStall(gv, dt) {
  const f = _dtpFocused(), here = _dtpHere(), s = _dtpStallAt;
  const work = f ? _dtpWork(gv, here) : 0;
  if (!f || _dtpStarting || _dtpViewing() || f.room !== here || String(gv.OfficeType) !== here || work <= 0 || !_dtpStaffIn(here)) {
    s.key = "";
    return;
  }
  // Any change counts as progress (programming trades technology for bugs).
  const key = f.id + "|" + _dtUi.layoutName(), sig = _DTP_WORK[here].map((k) => Number(gv[k]) || 0).join(",");
  if (key !== s.key || sig !== s.sig) {
    Object.assign(s, { key: key, sig: sig, work: work, secs: 0 });
    return;
  }
  s.secs += dt;
  if (s.secs < 12 || Date.now() - s.last < 60000) return;
  Object.assign(s, { key: "", last: Date.now() });
  console.warn("[Pipeline] staff idle in " + here + " with work left: restarting the room");
  globalThis.runtime.goToLayout(_dtUi.layoutName());
}
// Next-stage click on the live room while the next room holds another item.
// Programming's press while engineering is busy goes ahead: the game's copies screen comes first and
// the item is marked when it reaches engineering (_dtpArrive). Once marked, every press is caught.
function _dtpBlocked(gv) {
  const f = _dtpFocused();
  if (!f || _dtpViewing() || _dtpHere() !== f.room || !_dtpDone(f, gv) || !_dtpSettled(f)) return "";
  const next = _dtpNextRoom(f, gv);
  if (f.go && f.go === next) return next;
  const other = next ? _dtpAt(next) || _dtpWaiter(next) : null;
  if (next === "ENGINEER") return "";
  return other && other.id !== f.id ? next : "";
}
// The game puts up a room's next-stage button only once its counter is 0 and the last work and research
// bubbles have landed (276 GAMEPLAY, DEVELOPMENT [Engine]: e.g. BubblesEngineers <= 0 and
// BubblesEngineers.Count + BubbleResearch.Count <= 0); a press before that does nothing in the game. "Ready"
// showed from the counter alone, so the first press in that gap (seconds on a slow machine) seemed ignored.
var _DTP_BUBBLES = { DESIGNER: ["BubblesDesign"], PROGRAMMER: ["BubblesTechnology", "BubblesBugs"], ENGINEER: ["BubblesEngineers"] };
function _dtpSettled(it) {
  if (!it || it.id !== _dtp.focus || _dtpViewing() || _dtpHere() !== it.room || !_DTP_BUBBLES[it.room]) return true;
  try {
    const o = globalThis.runtime.objects;
    for (const n of _DTP_BUBBLES[it.room].concat("BubbleResearch")) if (o[n] && o[n].getAllInstances().length) return false;
  } catch (e) {}
  return true;
}
function _dtpLabelOf(it) {
  const gv = _dtpGv();
  let s = "";
  try {
    const vars = _dtpVarsOf(it, gv);
    const save = {};
    const keys = ["DeviceTypeCreatingNow", "DeviceName", "MyOS_Name", "MyOS_VersionName", "CreateSoftwareChoose_Name"];
    for (const k of keys) save[k] = gv[k];
    if (it.id !== _dtp.focus) {
      // A parked item always shows its own name variables: one saved before MyOS_VersionName existed
      // shows its name alone, never the live item's version.
      const own = {};
      for (const k of keys) own[k] = vars[k] !== undefined ? vars[k] : "";
      _dtpWrite(gv, own);
    }
    s = _dtrDevLabel(gv);
    // _dtrDevLabel names row x = 0, which is the live item's: a parked item uses its own name, with its kind.
    if (it.id !== _dtp.focus && _dtpArrName(vars.DeviceTypeCreatingNow)) {
      const a = _dtpTable(it, gv);
      if (a && !it.key) _dtpRowOf(a, it, gv);
      const nm = it.key ? it.key.split("|")[0] : String(vars.DeviceName || "");
      if (nm) s = nm + " · " + s.split(" · ").pop();
    }
    _dtpWrite(gv, save);
  } catch (e) {}
  return s;
}
function _dtpRoomLabel(room) {
  const gv = _dtpGv();
  if (!gv) return undefined;
  if (_dtpStarting && room === "DESIGNER") return _dtUi.t(_DTP_TEXT.starting);
  const it = _dtpAt(room);
  if (!it) return room === "BOSS" ? "" : _dtUi.t(_DTR_TEXT.free);
  if (it.go) return _dtpLabelOf(it) + " · " + _dtUi.t(_DTP_TEXT.waiting, { room: _dtUi.t(_DTR_TEXT[it.go]) });
  return _dtpLabelOf(it) + (_dtpDone(it, gv) && _dtpSettled(it) ? " · " + _dtUi.t(_DTP_TEXT.ready) : "");
}
// The Build queue page lists the marked items: "Waiting for Programming: Chip A".
function _dtpMarked() {
  return _dtp.items.filter((i) => i.go && i.room).sort((a, b) => (a.goAt || 0) - (b.goAt || 0))
    .map((i) => _dtUi.t(_DTP_TEXT.marked, { room: _dtUi.t(_DTR_TEXT[i.go]), name: _dtpLabelOf(i) }));
}
function _dtpOnPress(ev) {
  try {
    const gv = _dtpGv();
    if (!gv || ev.button > 0) return;
    // A press meant for something over the office (a mod panel, the game's news card, settings or pause menu).
    // Paused with Space nothing covers the office, and the game's next-stage click still works then
    // (276 GAMEPLAY: no pause check), so a paused press is blocked like any other.
    if ((_dtUi.isOpen && _dtUi.isOpen()) || String(gv.class || "GAMEPLAY") !== "GAMEPLAY") return;
    if (typeof _dtrPressElsewhere === "function" && _dtrPressElsewhere(ev, gv)) return;
    const b = _dtqCreateButton();
    if (!b || !b.layer) return;
    const t = ev.touches && ev.touches[0] ? ev.touches[0] : ev.changedTouches && ev.changedTouches[0] ? ev.changedTouches[0] : ev;
    const p = b.layer.cssPxToLayer(t.clientX, t.clientY);
    if (!b.containsPoint(p[0], p[1])) return;
    _dtpOneStage(gv);
    const next = _dtpBlocked(gv);
    if (!next) return;
    ev.stopImmediatePropagation();
    ev.preventDefault();
    const f = _dtpFocused();
    if (f && (ev.type === "pointerdown" || ev.type === "touchstart")) _dtpMark(f, next);
  } catch (e) {
    console.warn("[Pipeline] press:", e);
  }
}
// One press, one stage. Design's and Programming's next-stage buttons sit on the same spot and one click
// runs both (276 GAMEPLAY: Gradient_4 sets OfficeType PROGRAMMER at once, then Gradient_34 checks it), so an
// item finished in design whose programming work is already 0 went straight on: an OS or app was released
// ("has been published"), a device jumped to its copies screen, with no programming at all. The game always
// gives programming work; an item that came back to design with none left (pushed back by an older build,
// or an older save) gets one point, so it moves into programming and stops there.
function _dtpOneStage(gv) {
  const n = (k) => Number(gv[k]) || 0;
  if (String(gv.OfficeType || "") !== "DESIGNER" || String(gv.Assistant || "OFF") !== "OFF") return;
  if (n("BubblesDesign") > 0 || n("BubblesDesign") + n("BubbleResearch") > 0) return;
  if (n("BubblesTechnology") > 0 || n("BubblesBugs") > 0) return;
  console.warn("[Pipeline] design done with no programming work left: one point of programming kept");
  gv.BubblesTechnology = 1;
}
// Devices with a table can share their kind (_dtpFront keeps the live row at x = 0);
// parts have no table here, so they still go one at a time.
function _dtpSameKind(type, gv) {
  if (_dtpArrName(type)) return null;
  return _dtp.items.find((it) => String(_dtpVarsOf(it, gv).DeviceTypeCreatingNow || "") === type) || null;
}
// An item holding a room: still at work there, or finished and waiting for the player.
function _dtpBusyText(room, it, name) {
  const gv = _dtpGv();
  const waits = !!it && !!gv && _dtpDone(it, gv);
  return _dtUi.t(waits ? _DTP_TEXT.waits : _DTP_TEXT.busy, { room: _dtUi.t(_DTR_TEXT[room]), name: name });
}
// Why the pipeline does not hand room 1 to a queue entry yet ("" = nothing in its way).
function _dtpWhy(entry) {
  const gv = _dtpGv();
  if (!gv || !entry) return "";
  const type = _dtpEntryType(entry);
  const same = type ? _dtpSameKind(type, gv) : null;
  if (same) return _dtUi.t(_DTP_TEXT.wait_kind, { name: _dtpLabelOf(same) });
  const f = _dtpFocused();
  if (f && _dtpReal(gv) === "BOSS") return _dtUi.t(_DTP_TEXT.wait_release, { name: _dtpLabelOf(f) });
  const d = _dtpAt("DESIGNER");
  if (d) return _dtpBusyText("DESIGNER", d, _dtpLabelOf(d));
  return "";
}
// The queue may start its head only while the pipeline is handing it room 1.
function _dtpHold() {
  return _dtp.items.length > 0 && !_dtpStarting;
}
function _dtpCanStart(gv) {
  const q = globalThis._dtQueueApi;
  if (!q || _dtpStarting || Date.now() < _dtpCooldown || !_dtp.items.length) return false;
  // The game's reviews card fades ~0.15 s on the office before REVIEWS: the launching device is in the globals then.
  if (_dtpReviewing()) return false;
  if (_dtpAt("DESIGNER") || !_dtpCalm(gv)) return false;
  const f = _dtpFocused();
  if (f && _dtpReal(gv) === "BOSS") return false;
  const st = q.state();
  if (st.paused) return false;
  // Parts waiting only for one of their own kind are passed over: the first one
  // nothing else stands in front of takes the free room.
  for (const e of st.items) {
    const type = _dtpEntryType(e);
    if (!type) return false;
    if (_dtpSameKind(type, gv)) continue;
    return q.why(e.id) === "" ? e : false;
  }
  return false;
}
function _dtpStart(gv, entry) {
  const q = globalThis._dtQueueApi;
  const i = entry && q.move ? q.state().items.findIndex((e) => e.id === entry.id) : 0;
  for (let k = 0; k < i; k++) {
    if (!q.canMove(entry.id, -1) || !q.move(entry.id, -1)) {
      _dtpCooldown = Date.now() + 30000;
      return;
    }
  }
  const prev = _dtpPark(gv);
  if (globalThis._dtRooms) globalThis._dtRooms.drop();
  gv.DeviceTypeCreatingNow = "";
  gv.OfficeType = "BOSS";
  for (const k of ["BubblesDesign", "BubblesTechnology", "BubblesBugs", "BubblesEngineers"]) gv[k] = 0;
  // The new device rolls its own press conference (the parked item keeps its own copy).
  gv.PressConferenceCompleted = false;
  gv.PressConferenceRandom = 0;
  _dtpStarting = { at: Date.now(), prev: prev ? prev.id : null, began: false };
}
function _dtpStartAbort(gv) {
  const prev = _dtpStarting && _dtpStarting.prev ? _dtpFind(_dtpStarting.prev) : null;
  _dtpStarting = null;
  _dtpCooldown = Date.now() + 30000;
  if (prev) {
    _dtpLoadItem(gv, prev);
    _dtpGoTo = prev.room;
  }
}
// One step of the state machine; dt in seconds.
function _dtpStep(gv, dt) {
  let real = _dtpReal(gv);
  let type = String(gv.DeviceTypeCreatingNow || "");
  const q = globalThis._dtQueueApi;
  if (_dtpStarting) {
    if (q && (q.replaying() || q.capturing())) _dtpStarting.began = true;
    const landed = type && _DTP_ROOMS.indexOf(real) >= 0 && !(q && (q.replaying() || q.capturing()));
    if (landed) {
      const it = _dtpNewItem(gv, real);
      _dtp.focus = it.id;
      const a = _dtpTable(it, gv);
      if (a && a.width > 0) _dtpTake(a, 0, it); // LOADING EDITOR pushed its row to the front
      _dtpStarting = null;
      _dtpRefocus = false;
    } else if (!_dtpStarting.began && Date.now() - _dtpStarting.at > 10000) {
      _dtpStartAbort(gv);
    } else if (Date.now() - _dtpStarting.at > 90000) {
      _dtpStartAbort(gv);
    }
  }
  // An undone start has just put the previous item back: read the office again, or the item looked
  // released (stand-in BOSS, no type) and was dropped, to come back under a new name next time.
  real = _dtpReal(gv);
  type = String(gv.DeviceTypeCreatingNow || "");
  let f = _dtpFocused();
  // While the queue records another device the globals are not the live item's.
  const rec = !!(q && q.capturing());
  if (!_dtpStarting && !rec && !_dtpReviewing()) {
    if (f) {
      if (_DTP_ROOMS.indexOf(real) >= 0) {
        if (f.room !== real && _dtpArrive(gv, f, real)) f = _dtpFocused();
        _dtpLeftAt = 0;
      } else if (real === "BOSS") {
        // Left the rooms (batch delivery / OS release): room free, item still live until its reviews end.
        f.room = "";
        _dtpLeftAt = _dtpLeftAt || Date.now();
        const osDone = _dtpIsOsSoft(type) && _dtUi.layoutName() === "BOSS OFFICE" && _dtpCalm(gv) && Date.now() - _dtpLeftAt > 3000;
        if (!type || osDone) {
          _dtp.items = _dtp.items.filter((it) => it.id !== f.id);
          _dtp.focus = null;
          f = null;
          _dtpLeftAt = 0;
          _dtpRefocus = true;
        }
      }
    } else if (_dtpRefocus && _dtp.items.length && (!type || _dtpSpent(gv))) {
      // After a release: once the reviews (and a launch-day choice) are over, the most advanced item goes live.
      // Not under a pop-up: a launch-event offer holds its device's line number, which _dtpFront would move.
      // Nor while its show starts (Yes closes the offer ~0.2 s before the show) or runs: the show reads that line.
      if (_dtUi.onOffice() && String(gv.class || "") === "GAMEPLAY" && globalThis._dtLaunchPending !== true &&
          String(gv.Assistant || "OFF") === "OFF" && !(_dtUi.isOpen && _dtUi.isOpen()) &&
          !(typeof _dtEvStarting !== "undefined" && _dtEvStarting) && !(typeof _dtEvRun !== "undefined" && _dtEvRun)) {
        const best = _DTP_ROOMS.slice().reverse().map(_dtpAt).find((x) => x);
        _dtpRefocus = false;
        if (best) {
          _dtpLoadItem(gv, best);
          _dtpGoTo = best.room;
        }
      }
    } else if (type && _DTP_ROOMS.indexOf(real) >= 0) {
      // A device the pipeline does not hold yet (made directly, or the game's own columns after a load).
      const taken = _dtpAt(real);
      _dtpRefocus = false;
      if (taken && _dtpSameDevice(taken.vars, gv)) {
        _dtpLoadItem(gv, Object.assign(taken, { vars: Object.assign(taken.vars, _dtpCopy(gv)) }));
      } else {
        if (taken) _dtpBump(taken);
        const it = _dtpNewItem(gv, real);
        _dtp.focus = it.id;
        _dtpFront(it, gv);
      }
    }
  }
  if (_dtpClockRuns(gv) && dt > 0 && dt <= 15) { // game seconds: skip runs up to 10 a tick
    _dtpMeasureRp(gv, dt);
    _dtpSimulate(gv, dt);
    _dtpStall(gv, dt);
  } else {
    _dtpPrevRp = _dtpRpCount(gv);
  }
  // A parked design that finished used to move on to programming by itself the moment programming
  // freed up, so moving the item there on looked like it moved this one too (Jayden's bug 7). It now
  // waits in design, "Ready", for the player's own press; the game rolls its press-conference chance
  // then (276 GAMEPLAY, design done on screen), as for any design.
  if (!rec) {
    _dtpUnwait();
    _dtpGoOn(gv);
  }
  // The game sets a room's staff to work (their bubble timers) only as its screen starts, for the
  // OfficeType of that moment (276 GAMEPLAY: EmployeesVisible on start of layout). A room that went
  // live on a screen started for something else (only viewed, a start that was undone, the item that
  // goes live after a release) had nobody at work: no bubbles until the stall check. It starts again.
  const live = _dtpFocused();
  if (_dtpRestart && (!live || live.room !== _dtpRestart)) _dtpRestart = "";
  if (live && live.room && live.room === real && !_dtpStarting && !_dtpViewing() && _dtpHere() === real &&
      _dtpStartedAs.layout === _dtUi.layoutName() && _dtpStartedAs.ot !== real && Date.now() - _dtpRestartAt > 3000) _dtpRestart = real;
  if (_dtpRestart && !_dtpGoTo) _dtpGoTo = _dtpRestart;
  if (_dtpGoTo && !_dtpReviewing() && _dtpCalm(gv) && globalThis._dtRooms && globalThis._dtRooms.canMove()) {
    const room = _dtpGoTo, again = _dtpRestart === room;
    _dtpGoTo = "";
    if (again) {
      _dtpRestart = "";
      _dtpRestartAt = Date.now();
    }
    if ((_dtpHere() !== room || again) && !globalThis._dtRooms.go(room) && again) _dtpRestart = room;
  }
  const next = _dtpCanStart(gv);
  if (next) _dtpStart(gv, next);
}
// ── Save row 152 ──
function _dtpSaveRow() {
  const a = _dtqSaves(), slot = _dtqSlotNow(), gv = _dtpGv();
  if (!a || !gv || a.height <= _DTP_ROW || a.width <= slot) return false;
  const items = _dtp.items.map((it) => ({ id: it.id, room: it.room, key: it.key, rid: it.rid, wait: it.wait, go: it.go, goAt: it.goAt, vars: it.id === _dtp.focus ? _dtpCopy(gv) : it.vars }));
  const live = _dtpFocused();
  const st = { v: _DTP_V, company: _dtqCompanyNow(), start: _dtqStartKey(), focus: _dtp.focus,
    focusType: live ? String(gv.DeviceTypeCreatingNow || "") : "", items: items };
  try {
    a.setAt(items.length ? JSON.stringify(st) : "", slot, _DTP_ROW, 0);
    return true;
  } catch (e) {
    console.warn("[Pipeline] save:", e);
    return false;
  }
}
// The game does not save DeviceName (006 SMARTPHONE NAME: default "Device Name"), so after a
// load the live item's name comes from its saved globals, or else from its row in the device table.
var _DTP_NONAME = "Device Name";
function _dtpNameBack(gv) {
  const type = String(gv.DeviceTypeCreatingNow || "");
  if (!type || (String(gv.DeviceName || "") && String(gv.DeviceName) !== _DTP_NONAME)) return;
  const f = _dtpFocused();
  const saved = f && String(f.vars.DeviceName || "");
  if (saved && saved !== _DTP_NONAME) return void (gv.DeviceName = saved);
  const arr = _dtpArrName(type);
  try {
    const a = arr && globalThis.runtime.objects[arr].getFirstInstance();
    if (!a || a.width < 1 || String(a.getAt(0, 0, 7)) !== "-1") return;
    const y = Math.max(0, Math.min(2, (Number(gv.DeviceCountCreatingNow) | 0) - 1));
    const n = [y, 0].map((r) => String(a.getAt(0, r, 8))).find((v) => v && v !== "-1" && v !== "0");
    if (n) gv.DeviceName = n;
  } catch (e) {}
}
// A device item's row is still unreleased (parts have no device table: always true).
function _dtpUnreleased(it, gv) {
  if (!_dtpArrName(_dtpVarsOf(it, gv).DeviceTypeCreatingNow)) return true;
  const a = _dtpTable(it, gv);
  return !!a && _dtpRowOf(a, it, gv) >= 0;
}
function _dtpLoadRow() {
  const a = _dtqSaves(), slot = _dtqSlotNow(), gv = _dtpGv();
  _dtp = { focus: null, items: [], seq: _dtp.seq };
  _dtpStarting = null;
  _dtpGoTo = "";
  _dtpRestart = "";
  _dtpRefocus = false;
  if (!a || !gv || a.height <= _DTP_ROW || a.width <= slot) return;
  let st = null;
  try {
    const raw = a.getAt(slot, _DTP_ROW, 0);
    st = raw && typeof raw === "string" ? JSON.parse(raw) : null;
  } catch (e) {
    st = null;
  }
  if (!st || st.v !== _DTP_V || st.company !== _dtqCompanyNow() || !Array.isArray(st.items)) return _dtpNameBack(gv);
  const sk = _dtqStartKey();
  if (st.start && sk && st.start !== sk) {
    const y1 = parseInt(st.start), y2 = parseInt(sk);
    if (!(Math.abs(y1 - y2) <= 1)) return _dtpNameBack(gv);
  }
  const type = String(gv.DeviceTypeCreatingNow || "");
  for (const it of st.items) {
    if (!it || !it.id || !it.vars) continue;
    if (it.id === st.focus) {
      // The game's own columns disagree: adopt them. An item still in a room whose device is
      // not out yet is kept, parked, with its saved work; one being released or already out goes.
      if (!type || type !== st.focusType) {
        if (!it.room || !_dtpUnreleased(it, gv)) continue;
      } else _dtp.focus = it.id;
    }
    const one = { id: String(it.id), room: String(it.room || ""), vars: it.vars };
    if (typeof it.key === "string") one.key = it.key;
    if (Number(it.rid) > 0) one.rid = Number(it.rid);
    if (typeof it.wait === "string" && _DTP_ROOMS.indexOf(it.wait) >= 0) one.wait = it.wait;
    if (typeof it.go === "string" && _DTP_ROOMS.indexOf(it.go) >= 0) {
      one.go = it.go;
      one.goAt = Number(it.goAt) || 0;
    }
    // Parked out of the rooms with nothing to wait for (older builds could park an OS just
    // released or a device on its way to its reviews): nothing would ever move it again. Its
    // part is gone unless the game still has it in development, its device once its row is out.
    if (one.id !== _dtp.focus && !one.room && !one.wait) {
      const kind = String(one.vars.DeviceTypeCreatingNow || "");
      if (_dtpArrName(kind) ? !_dtpUnreleased(one, gv) : kind !== type) continue;
    }
    _dtp.items.push(one);
  }
  // Two items in one room (older saves): the later one steps back instead of being lost.
  for (const it of _dtp.items.slice().reverse()) {
    if (it.room && _dtp.items.some((o) => o !== it && o.room === it.room) && it.id !== _dtp.focus) _dtpBump(it);
  }
  // Saved after your own OS or app with others parked: the most advanced one goes live again.
  if (_dtp.items.length && _dtpSpent(gv)) _dtpRefocus = true;
  _dtpNameBack(gv);
}
function _dtpWire() {
  if (_dtpWired) return;
  for (const t of ["pointerdown", "mousedown", "touchstart", "pointerup", "mouseup", "touchend", "click"])
    addEventListener(t, _dtpOnPress, true);
  const rt = globalThis.runtime;
  if (rt && typeof rt.addEventListener === "function") {
    rt.addEventListener("beforeanylayoutstart", _dtpPressSort);
    rt.addEventListener("afteranylayoutstart", _dtpPressUnsort);
    rt.addEventListener("afteranylayoutstart", _dtpLayoutStarted);
  }
  _dtpWired = true;
}
// What the game's start-of-layout events saw: the staff of the room on screen work only if OfficeType was its own.
function _dtpLayoutStarted(ev) {
  const gv = _dtpGv();
  const name = ev && ev.layout ? String(ev.layout.name || "") : _dtUi.layoutName();
  _dtpStartedAs = { layout: name, ot: gv ? String(gv.OfficeType || "") : "" };
  if (_dtpRestart && _dtpStartedAs.ot === _dtpRestart && name.indexOf(_dtpRestart + " OFFICE ") === 0) _dtpRestart = "";
}
function _dtpTick() {
  try {
    const gv = _dtpGv();
    if (!gv) return;
    _dtpWire();
    const lay = _dtUi.layoutName();
    // Game seconds, like the staff timers: wall time overpays off-screen rooms
    // when frames lag and underpays them while skip speeds the game up.
    const rt = globalThis.runtime, gt = rt && Number(rt.gameTime);
    const now = Number.isFinite(gt) ? gt : Date.now() / 1000;
    // A loaded save can move the game clock: no step for a jump (skip runs 40x, 10 s a tick).
    const dt = _dtpLast && now >= _dtpLast && now - _dtpLast <= 15 ? now - _dtpLast : 0;
    _dtpLast = now;
    if (lay === "LOADING GAME" && String(gv.LoadingType || "").toUpperCase() === "NEW GAME") {
      _dtp = { focus: null, items: [], seq: _dtp.seq };
      _dtpStarting = null;
      _dtpGoTo = "";
      _dtpRestart = "";
      _dtpRestartAt = 0;
      _dtpRefocus = false;
      _dtpLeftAt = 0;
      _dtpKey = "new";
      const a = _dtqSaves(), slot = _dtqSlotNow();
      try { if (a && a.height > _DTP_ROW && a.width > slot) a.setAt("", slot, _DTP_ROW, 0); } catch (e) {}
    }
    const outside = lay === "MENU" || lay === "START PAGE" || lay === "LOADING GAME" || 0 === lay.indexOf("COMPANY ") || !_dtqCompanyNow();
    if (outside) {
      if (_dtpKey !== "new") _dtpKey = "";
      return;
    }
    const key = _dtqSlotNow() + "|" + _dtqCompanyNow();
    if (key !== _dtpKey) {
      if (_dtpKey !== "new") _dtpLoadRow();
      _dtpKey = key;
    }
    _dtpStep(gv, dt);
  } catch (e) {
    console.warn("[Pipeline] tick:", e);
  }
}
// The shared mod timer (ui.js every) when ui.js is in; a timer of our own without it.
(typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(_dtpTick, 250);
globalThis._dtPipeHold = _dtpHold;
globalThis._dtPipeBeforeRoom = _dtpBeforeRoom;
globalThis._dtPipeRoomLabel = _dtpRoomLabel;
globalThis._dtPipeBeforeSave = _dtpSaveRow;
globalThis._dtPipeWhy = _dtpWhy;
globalThis._dtPipeMarked = _dtpMarked;
globalThis._dtPipeApi = {
  state: () => JSON.parse(JSON.stringify({ focus: _dtp.focus, items: _dtp.items, starting: _dtpStarting, goTo: _dtpGoTo })),
  pps: () => Object.assign({}, _dtpPps),
  rp: () => JSON.parse(JSON.stringify(_dtpRp)),
  stall: () => Object.assign({ staff: _dtpStaffIn(_dtpHere()) }, _dtpStallAt),
  restart: () => _dtpRestart,
  layoutStarted: _dtpLayoutStarted,
  blocked: () => _dtpBlocked(_dtpGv()),
  why: _dtpWhy,
  entryType: _dtpEntryType,
  step: (dt) => _dtpStep(_dtpGv(), dt),
  tick: _dtpTick,
  save: _dtpSaveRow,
  load: _dtpLoadRow,
  pressStart: _dtpPressSort,
  pressEnd: _dtpPressUnsort,
};
