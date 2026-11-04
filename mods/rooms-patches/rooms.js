// ── Rooms: step through the three work offices ──
// The game shows one work office at a time: the one whose stage is running
// (OfficeType DESIGNER / PROGRAMMER / ENGINEER), or the boss office when
// nothing is in development. This adds a floating room title at the top centre
// (white arrows either side of the room name, a status line, and a quiet line
// naming the other room at work, only while one is) that steps through the three rooms (and the boss office when idle) at any time.
//
// Viewing a room that is not the active stage sets OfficeType to "BOSS" for as
// long as that room is on screen. Every stage event in 276 GAMEPLAY (bubble
// spawns, the stage-done check, the next-stage button, the status icon) is
// gated on OfficeType, so the room's staff sit idle and nothing there touches
// the active item. The real value comes back before any other layout starts,
// so menus return to the real office, and saves always store the real value.
// The active room is the game's own screen, unchanged; the game's own move
// to the next room when a stage ends is untouched.
//
// _dtRooms is the hook the pipeline patch uses to show its other items.
var _DTR_ROOMS = ["DESIGNER", "PROGRAMMER", "ENGINEER"];
var _DTR_LEVEL = { DESIGNER: "DesignersOfficeLevel", PROGRAMMER: "ProgrammersOfficeLevel", ENGINEER: "EngineersOfficeLevel" };
var _DTR_BOSS = "BOSS";
var _DTR_BOSS_LAYOUT = "BOSS OFFICE";
// Centre button (create / next stage) and its icon, ring and stage glow.
var _DTR_CENTRE_UIDS = [7345, 7335, 7336, 20228, 20223, 17899, 17900, 17909, 17910];
var _DTR_TEXT = {
  BOSS: { en: "Boss office", ru: "Кабинет" },
  DESIGNER: { en: "Design", ru: "Дизайн" },
  PROGRAMMER: { en: "Programming", ru: "Программирование" },
  ENGINEER: { en: "Engineering", ru: "Инженеры" },
  free: { en: "Free", ru: "Свободно" },
  working: { en: "{room} is working on {name}", ru: "{room}: в работе {name}" },
  other: { en: "{room}: {label}", ru: "{room}: {label}" },
  others: { en: "{n} other rooms working", ru: "Ещё {n} комнаты в работе" },
  prev: { en: "Previous room", ru: "Предыдущая комната" },
  next: { en: "Next room", ru: "Следующая комната" },
};
var _DTR_TYPE = {
  SMARTPHONES: { en: "Phone", ru: "Смартфон" }, LAPTOPS: { en: "Laptop", ru: "Ноутбук" },
  TABLETS: { en: "Tablet", ru: "Планшет" }, WATCHES: { en: "Watch", ru: "Часы" },
  HEADPHONES: { en: "Headphones", ru: "Наушники" }, TV: { en: "TV", ru: "Телевизор" },
  SCOOTER: { en: "Scooter", ru: "Самокат" }, KEYBOARD: { en: "Keyboard", ru: "Клавиатура" },
  CONSOLE: { en: "Console", ru: "Консоль" }, "VR CONSOLE": { en: "VR headset", ru: "VR-шлем" },
  CPU: { en: "Processor", ru: "Процессор" }, GPU: { en: "Graphics card", ru: "Видеокарта" },
  SOFTWARE: { en: "Software", ru: "Приложение" }, OS: { en: "Operating system", ru: "ОС" },
};
// Device table of each DeviceTypeCreatingNow value; the item in development is
// the newest series, x = 0 (282 REVIEWS, 261 BATCH), name in column 8.
var _DTR_ARRAY = {
  SMARTPHONES: "ArraySmartphones", TABLETS: "ArrayTablets", LAPTOPS: "ArrayLaptops", WATCHES: "ArrayWatches",
  HEADPHONES: "ArrayHeadphones", TV: "ArrayTV", SCOOTER: "ArrayScooters", KEYBOARD: "ArrayKeyboards",
  CONSOLE: "ArrayConsoles", "VR CONSOLE": "ArrayVRConsoles",
};
var _dtrView = null; // {room, real, layout}: a room on screen that is not the real office
var _dtrWired = false;
var _dtrTitle = null;
var _dtrNavAt = 0;

function _dtrGv() {
  const rt = globalThis.runtime;
  return rt && rt.globalVars ? rt.globalVars : null;
}
function _dtrLevel(gv, room) {
  const n = Math.round(Number(gv[_DTR_LEVEL[room]]) || 1);
  return Math.max(1, Math.min(8, n));
}
function _dtrLayoutOf(gv, room) {
  return room === _DTR_BOSS ? _DTR_BOSS_LAYOUT : room + " OFFICE " + _dtrLevel(gv, room);
}
function _dtrRoomOfLayout(name) {
  const n = String(name || "");
  if (n === _DTR_BOSS_LAYOUT) return _DTR_BOSS;
  for (const r of _DTR_ROOMS) if (n.indexOf(r + " OFFICE ") === 0) return r;
  return "";
}
// The office the game itself is in, whatever room is on screen.
function _dtrReal(gv) {
  if (_dtrView) return _dtrView.real;
  return String((gv || _dtrGv() || {}).OfficeType || _DTR_BOSS);
}
// The room on screen ("" off the office screens).
function _dtrHere() {
  return _dtrRoomOfLayout(_dtUi.layoutName());
}
// Stops in the cycle: the three rooms, plus the boss office when idle.
function _dtrStops(gv) {
  return _dtrReal(gv) === _DTR_BOSS ? [_DTR_BOSS].concat(_DTR_ROOMS) : _DTR_ROOMS.slice();
}
function _dtrStep(gv, delta) {
  const stops = _dtrStops(gv);
  let i = stops.indexOf(_dtrHere());
  if (i < 0) i = stops.indexOf(_dtrReal(gv));
  if (i < 0) i = 0;
  return stops[(i + delta + stops.length) % stops.length];
}
// Same moments a player may leave an office in the original: on an office
// screen, no create picker, no pop-up, no panel, not mid-transition.
function _dtrCanMove(gv) {
  if (!gv || !_dtrHere()) return false;
  if (String(gv.class || "") !== "GAMEPLAY") return false;
  if (String(gv.CreateDevicesUI || "OFF") !== "OFF") return false;
  if (String(gv.Assistant || "OFF") !== "OFF") return false;
  if (_dtUi.isOpen && _dtUi.isOpen()) return false;
  if (globalThis._dtQueueApi && globalThis._dtQueueApi.capturing()) return false;
  if (globalThis._dtQueueApi && globalThis._dtQueueApi.replaying()) return false;
  return Date.now() - _dtrNavAt > 450;
}
function _dtrGo(room) {
  const gv = _dtrGv(), rt = globalThis.runtime;
  if (!_dtrCanMove(gv)) return false;
  let real = _dtrReal(gv);
  const layout = _dtrLayoutOf(gv, room);
  // Pipeline patch: may make the room's own item the live one (returns its room).
  if (globalThis._dtPipeBeforeRoom) {
    const r = globalThis._dtPipeBeforeRoom(room, real);
    if (r === false) return false;
    if (typeof r === "string") {
      real = r;
      if (_dtrView) _dtrView = null;
    }
  }
  if (room === real) {
    _dtrView = null;
    gv.OfficeType = real;
  } else {
    // from: the screen on show at the press, whose own start can still come (see _dtrOnLayoutStart).
    _dtrView = { room: room, real: real, layout: layout, from: _dtUi.layoutName() };
    gv.OfficeType = _DTR_BOSS;
  }
  _dtrNavAt = Date.now();
  _dtrHoldCard(layout);
  try {
    rt.goToLayout(layout);
  } catch (e) {
    console.warn("[Rooms] goToLayout", layout, e);
    _dtrDropCard();
    _dtrRestore(gv);
    return false;
  }
  // The title names the new room now (arrows dimmed until it can move again):
  // the layout takes a moment to load its images.
  try {
    if (_dtrTitle) _dtrSyncTitle(gv, room);
  } catch (e) {}
  return true;
}
// The game's own sales card (#office-root, top left) lives in the office layout's HTML element, so it went
// away while the next room loaded and came back once the game built it there. A still copy (no events, no
// clicks) stands in on the same spot until the game's card is back, the room shows none, or 4 s pass.
var _dtrCardCopy = null;
function _dtrHoldCard(layout) {
  _dtrDropCard();
  try {
    const root = document.getElementById("office-root");
    const old = root && root.querySelector("#office-panel");
    if (!old || getComputedStyle(root).position !== "fixed") return;
    const c = root.cloneNode(true);
    c.style.pointerEvents = "none";
    c.setAttribute("aria-hidden", "true");
    const wrap = document.querySelector(".c3htmlwrap");
    if (wrap && wrap.parentNode) wrap.parentNode.insertBefore(c, wrap.nextSibling);
    else document.body.appendChild(c);
    const at = Date.now();
    let ranAt = 0;
    _dtrCardCopy = c;
    const step = () => {
      if (_dtrCardCopy !== c) return;
      const p = document.getElementById("office-panel");
      const lay = _dtUi.layoutName();
      if (lay === layout && !ranAt) ranAt = Date.now();
      if ((p && p !== old && !c.contains(p)) || (lay && !_dtrRoomOfLayout(lay)) || (ranAt && Date.now() - ranAt > 600) || Date.now() - at > 4000) _dtrDropCard();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  } catch (e) {
    _dtrDropCard();
  }
}
function _dtrDropCard() {
  if (_dtrCardCopy) _dtrCardCopy.remove();
  _dtrCardCopy = null;
}
function _dtrRestore(gv) {
  if (!_dtrView) return;
  if (gv) gv.OfficeType = _dtrView.real;
  _dtrView = null;
}
// The asked-for room has not started 2 s after the move. While a layout is still loading ("")
// nothing changes. Otherwise OfficeType follows the room really on screen: its own office is
// the game's again; another room stays only viewed (its stage events off).
function _dtrSettle(gv) {
  const lay = _dtUi.layoutName();
  if (!lay || lay === _dtrView.layout) return;
  const here = _dtrRoomOfLayout(lay);
  if (here && here !== _dtrView.real) _dtrView = { room: here, real: _dtrView.real, layout: lay };
  else _dtrRestore(gv);
}
// Any other layout gives the game its real office back first (menus return there). A work
// room starting late, after a slower move was overtaken, stays only viewed while the game
// still holds the stand-in, so OfficeType always matches the room on screen.
function _dtrOnLayoutStart(ev) {
  const name = ev && ev.layout ? String(ev.layout.name || "") : _dtUi.layoutName();
  if (!_dtrView || name === _dtrView.layout) return;
  // The game names its next layout a few frames before that layout starts: an arrow pressed in that gap
  // (just back from a menu) sees the start of the room it is leaving after the press. The asked-for room
  // still follows; restoring here left it on screen with the real office's OfficeType and no view.
  if (name === _dtrView.from && _dtrRoomOfLayout(name) && Date.now() - _dtrNavAt < 2000) return;
  const gv = _dtrGv(), here = _dtrRoomOfLayout(name);
  if (here && here !== _DTR_BOSS && here !== _dtrView.real && gv && String(gv.OfficeType) === _DTR_BOSS) {
    _dtrView = { room: here, real: _dtrView.real, layout: name };
    return;
  }
  _dtrRestore(gv);
}
function _dtrAfterLayoutStart(ev) {
  if (_dtrView) _dtrHideIdle();
  else _dtrUnhide();
  // Undim the arrows as soon as the room can move again, not up to 250 ms later on the next tick.
  setTimeout(_dtrTick, Math.max(0, 460 - (Date.now() - _dtrNavAt)));
  const name = ev && ev.layout ? String(ev.layout.name || "") : _dtUi.layoutName();
  if (_dtrPickAt && name === _DTR_BOSS_LAYOUT && Date.now() - _dtrPickAt < 5000) {
    setTimeout(() => {
      const gv = _dtrGv();
      if (!gv || _dtUi.layoutName() !== _DTR_BOSS_LAYOUT || String(gv.CreateDevicesUI || "OFF") !== "OFF") return;
      gv.CreateDevicesUI = "WAIT";
      globalThis.runtime.callFunction("CreateDevices_ON");
    }, 150);
  }
}
// The centre button while another room is only viewed is the game's + (OfficeType BOSS). The game would open
// its type picker on a layout without type tiles (the + vanished and the calendar stopped for good), so the
// press is taken here: the game's picker opens over this room (picker.js). Only if it cannot (its art not
// loaded) is the player taken to the boss office and the game's picker opened there. While busy the queue
// stores what is made (the real office stays busy); backing out returns to the room.
var _dtrPickAt = 0;
// The room the + was pressed in: closing the picker without a pick goes back
// there (picking a type moves on to the naming screen as in the original).
var _dtrPickFrom = null;
// A picked tile turns the picker off, fades the game's cover in (TiledBackground3), then sets the next
// screen's class and moves on (276 GAMEPLAY, CREATED DEVICES): however slow the machine, that is a pick.
var _DTR_COVER_UID = 347;
function _dtrPicking(gv) {
  if (String(gv.class || "GAMEPLAY") !== "GAMEPLAY") return true;
  const rt = globalThis.runtime;
  const c = rt && rt.getInstanceByUid ? rt.getInstanceByUid(_DTR_COVER_UID) : null;
  return !!(c && c.opacity > 0);
}
function _dtrPickBack(gv) {
  const p = _dtrPickFrom;
  if (!p) return;
  const lay = _dtUi.layoutName();
  if (lay !== _DTR_BOSS_LAYOUT) {
    // "" is the picked screen still loading: the queue reads pickFrom as it starts.
    if (lay && Date.now() - _dtrNavAt > 2000) _dtrPickFrom = null;
    return;
  }
  if (String(gv.CreateDevicesUI || "OFF") !== "OFF") {
    p.seen = true;
    p.offAt = 0;
    return;
  }
  if (!p.seen) {
    if (Date.now() - _dtrPickAt > 6000) _dtrPickFrom = null;
    return;
  }
  // Picker off: back on its own close press (the + again; Esc is the game's pause), or if it went off
  // some other way and nothing moved on for 3 s. Never while a pick moves on, however slow.
  if (_dtrPicking(gv)) {
    p.offAt = Date.now();
    return;
  }
  if (!p.offAt) p.offAt = Date.now();
  if ((p.closed || Date.now() - p.offAt > 3000) && _dtrCanMove(gv)) {
    _dtrPickFrom = null;
    _dtrGo(p.room);
  }
}
function _dtrCentreHit(ev) {
  const rt = globalThis.runtime;
  const b = rt && rt.getInstanceByUid ? rt.getInstanceByUid(_DTR_CENTRE_UIDS[0]) : null;
  if (!b || !b.layer || !b.layer.isVisible) return false;
  const t = ev.touches && ev.touches[0] ? ev.touches[0] : ev.changedTouches && ev.changedTouches[0] ? ev.changedTouches[0] : ev;
  const p = b.layer.cssPxToLayer(t.clientX, t.clientY);
  return !!b.containsPoint(p[0], p[1]);
}
// A work room on screen while the game is in its boss state is only viewed, even without a record: the
// pipeline's queue start drops the record and sets OfficeType BOSS while the player may still be there.
// Its centre press is dropped (real ""), else each press toggled the game's hidden picker.
function _dtrViewed(gv) {
  if (_dtrView) return _dtrView;
  const here = _dtrHere();
  if (gv && here && here !== _DTR_BOSS && String(gv.OfficeType || "") === _DTR_BOSS) return { room: here, real: "", layout: "" };
  return null;
}
// A press meant for something drawn over the office (a mod panel or the HUD, the game's news
// card or settings, a pause) is never the centre button's.
function _dtrPressElsewhere(ev, gv) {
  if (_dtUi.isOpen && _dtUi.isOpen()) return true;
  if (gv && String(gv.class || "GAMEPLAY") !== "GAMEPLAY") return true;
  const t = ev.target;
  return !!(t && t.closest && t.closest(".dt-layer, #office-news-overlay.on-visible, #gs-root"));
}
function _dtrOnPress(ev) {
  try {
    if (ev.button > 0) return;
    // The picker drawn over this room (picker.js) takes its own presses.
    if (globalThis._dtPicker && globalThis._dtPicker.isOpen()) return;
    if (_dtrPressElsewhere(ev, _dtrGv())) return;
    const twin = Date.now() - _dtrPickAt < 700;
    const gv = _dtrGv();
    const view = _dtrViewed(gv);
    // The boss office + after a viewed room's + is the game's: it closes the picker (or opens it again).
    if (!twin && _dtrPickFrom && gv && (ev.type === "pointerdown" || ev.type === "touchstart") &&
        _dtUi.layoutName() === _DTR_BOSS_LAYOUT && _dtrCentreHit(ev)) _dtrPickFrom.closed = String(gv.CreateDevicesUI || "OFF") !== "OFF";
    if (!twin && (!view || view.room === _DTR_BOSS)) return;
    if (!gv || (!twin && String(gv.CreateDevicesUI || "OFF") !== "OFF") || !_dtrCentreHit(ev)) return;
    ev.stopImmediatePropagation();
    ev.preventDefault();
    // No real office (the pipeline is starting the next entry): the press is dropped.
    if (twin || !view.real || (ev.type !== "pointerdown" && ev.type !== "touchstart")) return;
    // The game's picker opens over this room (picker.js); the boss office only if it cannot.
    if (globalThis._dtPicker && globalThis._dtPicker.open()) return;
    _dtrPickAt = Date.now();
    globalThis.runtime.callFunction("Tap_Main");
    if (!_dtrGo(_DTR_BOSS)) _dtrPickAt = 0;
    else _dtrPickFrom = { room: view.room, seen: false, offAt: 0, closed: false };
  } catch (e) {
    console.warn("[Rooms] centre press:", e);
  }
}
// A viewed room without its item: no progress dial (its layer shows the last
// stage's number). The centre stays the create button (_dtrOnPress): hiding it
// while busy left an empty gap in the toolbar that looked like a lost +.
// What was hidden is kept so _dtrUnhide can put it back: a layout keeps its
// layers' visibility for the whole session (the game never shows them again),
// and the room can become live without a layout change (pipeline refocus).
var _dtrHidden = { layers: new Set() };
function _dtrHideIdle() {
  const rt = globalThis.runtime;
  try {
    for (const l of rt.layout.getAllLayers()) {
      if (!/^(DESIGNER|PROGRAMMER|ENGINEER) UI\b/.test(l.name) || !l.isVisible) continue;
      l.isVisible = false;
      _dtrHidden.layers.add(l);
    }
  } catch (e) {}
}
// Back as they were once no room is only viewed.
function _dtrUnhide() {
  for (const l of _dtrHidden.layers) l.isVisible = true;
  _dtrHidden.layers.clear();
}
// A save while a room is viewed stores the real office, never the stand-in.
function _dtrWrapSave() {
  if (typeof saveArraysToFile !== "function" || saveArraysToFile._dtrWrapped) return;
  const orig = saveArraysToFile;
  saveArraysToFile = function (file, names, opts) {
    try {
      if (_dtrView) {
        const rt = globalThis.runtime, a = rt.objects.ArraySaves.getFirstInstance();
        const slot = Math.max(0, Math.round(Number(rt.globalVars.SaveSlot) || 0));
        if (a && a.width > slot && a.height > 13) a.setAt(_dtrView.real, slot, 13, 0);
      }
      if (globalThis._dtPipeBeforeSave) globalThis._dtPipeBeforeSave();
    } catch (e) {
      console.warn("[Rooms] save fix:", e);
    }
    return orig.apply(this, arguments);
  };
  saveArraysToFile._dtrWrapped = true;
}
function _dtrWire() {
  if (_dtrWired) return;
  const rt = globalThis.runtime;
  if (!rt || "function" != typeof rt.addEventListener) return;
  try {
    rt.addEventListener("beforeanylayoutstart", _dtrOnLayoutStart);
    rt.addEventListener("afteranylayoutstart", _dtrAfterLayoutStart);
    for (const t of ["pointerdown", "mousedown", "touchstart", "pointerup", "mouseup", "touchend", "click"])
      addEventListener(t, _dtrOnPress, true);
    _dtrWrapSave();
    _dtrWired = true;
  } catch (e) {
    console.warn("[Rooms] wire:", e);
  }
}
function _dtrT(key) {
  return _dtUi.t(_DTR_TEXT[key]);
}
// False for a pipeline label whose item is done ("… · Ready") or waits ("… · Waiting for Programming").
// Without the pipeline patch every busy room is at work.
function _dtrAtWork(label) {
  if (typeof _DTP_TEXT === "undefined" || !_DTP_TEXT || !label) return true;
  const ready = _dtUi.t(_DTP_TEXT.ready);
  const wait = _dtUi.t(_DTP_TEXT.waiting, { room: "\u0001" }).split("\u0001")[0].trim();
  return !(label === ready || label.endsWith(" · " + ready) || (wait && label.includes(wait)));
}
// What a room is working on: "Ember 7 · Phone", or "Free".
function _dtrItemLabel(gv, room) {
  if (globalThis._dtPipeRoomLabel) {
    const s = globalThis._dtPipeRoomLabel(room);
    if (s !== undefined && s !== null) return s;
  }
  const real = _dtrReal(gv);
  if (room === _DTR_BOSS || room !== real) return room === _DTR_BOSS ? "" : _dtrT("free");
  return _dtrDevLabel(gv);
}
function _dtrDevLabel(gv) {
  const t = String(gv.DeviceTypeCreatingNow || "").toUpperCase().trim();
  if (!t) return _dtrT("free");
  const key = t.indexOf("OS ") === 0 ? "OS" : t.indexOf("CPU") >= 0 ? "CPU" : t.indexOf("GPU") >= 0 ? "GPU" : t;
  const type = _DTR_TYPE[key] ? _dtUi.t(_DTR_TYPE[key]) : t.charAt(0) + t.slice(1).toLowerCase();
  let name = "";
  try {
    const a = _DTR_ARRAY[t] && globalThis.runtime.objects[_DTR_ARRAY[t]].getFirstInstance();
    if (a && a.width > 0) name = String(a.getAt(0, 0, 8) || "").trim();
  } catch (e) {}
  // An OS or app has no device table: its name is the game's own. An OS is MyOS_Name + " " + MyOS_VersionName,
  // as the game shows it (125 MY OS UI; 119 MY OS NAME prefills an update version as "<version> (2)"); an app keeps its name.
  if (key === "OS") name = (String(gv.MyOS_Name || "") + " " + String(gv.MyOS_VersionName || "")).trim();
  else if (key === "SOFTWARE") name = String(gv.CreateSoftwareChoose_Name || "").trim();
  return name ? name + " · " + type : type;
}
// Agreed look (mockups s-r2-4 / s-r2-6, b-dots-4): no box; white capitals with a soft shadow, white
// triangles like the arrows on the game's device pages, a status line, then one quiet line only while
// another room is at work ("Design: Arc 6 · Phone", or "2 other rooms working"). It sits just below
// the game's "+fans" pop-up (top 96, about 34 high, both centred). Arrows take presses on a larger
// invisible area. A second, tighter shadow keeps the small status line readable on the brightest rooms,
// and a very faint dark glow with no edges sits behind the words to lift them off light floors and walls.
// The name box is as wide as the longest English room name, so the arrows stay put between rooms.
function _dtrCss() {
  if (document.getElementById("dt-rooms-css")) return;
  const st = document.createElement("style");
  st.id = "dt-rooms-css";
  st.textContent = `
.dt-rtitle { position: absolute; left: 0; right: 0; top: calc(var(--dt) * 134px); display: flex; flex-direction: column;
  align-items: center; gap: calc(var(--dt) * 8px); color: #fff; pointer-events: none; isolation: isolate; }
.dt-rtitle::before { content: ""; position: absolute; z-index: -1; left: 50%; top: calc(var(--dt) * -14px); bottom: calc(var(--dt) * -16px);
  width: calc(var(--dt) * 640px); margin-left: calc(var(--dt) * -320px); pointer-events: none;
  background: radial-gradient(closest-side, rgba(0, 0, 0, 0.28), rgba(0, 0, 0, 0.22) 35%, rgba(0, 0, 0, 0.11) 65%, rgba(0, 0, 0, 0.03) 88%, transparent); }
.dt-rtitle-row { display: flex; align-items: center; gap: calc(var(--dt) * 26px); line-height: 1.1; white-space: nowrap;
  font-family: "SofiaSansExtraCondensed-Bold", "Oswald", sans-serif; font-size: calc(var(--dt) * 36px);
  letter-spacing: calc(var(--dt) * 1.5px); text-transform: uppercase;
  text-shadow: 0 calc(var(--dt) * 1px) calc(var(--dt) * 3px) rgba(0, 0, 0, 0.4), 0 calc(var(--dt) * 2px) calc(var(--dt) * 10px) rgba(0, 0, 0, 0.65); }
.dt-rtitle-name { min-width: calc(var(--dt) * 240px); text-align: center; }
.dt-rtitle-arrow { pointer-events: auto; cursor: pointer; display: flex; align-items: center; justify-content: center;
  padding: calc(var(--dt) * 18px) calc(var(--dt) * 22px); margin: calc(var(--dt) * -18px) calc(var(--dt) * -22px); }
.dt-rtitle-arrow i { display: block; width: 0; height: 0; border-top: calc(var(--dt) * 13px) solid transparent;
  border-bottom: calc(var(--dt) * 13px) solid transparent; filter: drop-shadow(0 calc(var(--dt) * 2px) calc(var(--dt) * 4px) rgba(0, 0, 0, 0.5));
  transition: transform 0.12s ease, opacity 0.15s ease; }
.dt-rtitle-arrow.dt-l i { border-right: calc(var(--dt) * 18px) solid #fff; }
.dt-rtitle-arrow.dt-r i { border-left: calc(var(--dt) * 18px) solid #fff; }
.dt-rtitle-arrow:hover i { transform: scale(1.15); }
.dt-rtitle-arrow:active i { transform: scale(0.88); }
.dt-rtitle.dt-off .dt-rtitle-arrow { cursor: default; }
.dt-rtitle.dt-off .dt-rtitle-arrow i { opacity: 0.45; transform: none; }
.dt-rtitle-sub { font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif; font-size: calc(var(--dt) * 22px); line-height: 1.1;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 calc(var(--dt) * 1px) calc(var(--dt) * 2px) rgba(0, 0, 0, 0.6), 0 calc(var(--dt) * 2px) calc(var(--dt) * 8px) rgba(0, 0, 0, 0.7);
  max-width: calc(var(--dt) * 520px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dt-rtitle-also { display: flex; align-items: center; gap: calc(var(--dt) * 9px); font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif;
  font-size: calc(var(--dt) * 19px); line-height: 1.1; min-height: calc(var(--dt) * 21px); color: rgba(255, 255, 255, 0.78);
  text-shadow: 0 calc(var(--dt) * 1px) calc(var(--dt) * 2px) rgba(0, 0, 0, 0.6), 0 calc(var(--dt) * 2px) calc(var(--dt) * 8px) rgba(0, 0, 0, 0.7); }
.dt-rtitle-also i { flex: none; width: calc(var(--dt) * 9px); height: calc(var(--dt) * 9px); border-radius: 999px; background: #fb923c;
  box-shadow: 0 calc(var(--dt) * 1px) calc(var(--dt) * 3px) rgba(0, 0, 0, 0.5); }
.dt-rtitle-also span { max-width: calc(var(--dt) * 500px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;
  document.head.appendChild(st);
}
function _dtrBuildTitle(layer) {
  _dtrCss();
  const t = _dtUi.el("div", "dt-rtitle dt-hud", layer);
  const row = _dtUi.el("div", "dt-rtitle-row", t);
  const arrow = (side) => {
    const a = _dtUi.el("div", "dt-rtitle-arrow dt-" + side, row);
    _dtUi.el("i", "", a);
    if (a.setAttribute) a.setAttribute("aria-label", _dtrT(side === "l" ? "prev" : "next"));
    a.addEventListener("pointerover", () => {
      if (!t.classList.contains("dt-off")) globalThis.tapHover?.();
    });
    a.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (_dtrGo(_dtrStep(_dtrGv(), side === "l" ? -1 : 1))) globalThis.tapMain?.();
    });
    return a;
  };
  t._dtL = arrow("l");
  t._dtName = _dtUi.el("div", "dt-rtitle-name", row);
  t._dtR = arrow("r");
  // Arrows on either side of the name, as on the game's device pages.
  row.appendChild(t._dtR);
  t._dtSub = _dtUi.el("div", "dt-rtitle-sub", t);
  // Kept in the layout while empty (hidden), so nothing moves when it comes and goes.
  t._dtAlso = _dtUi.el("div", "dt-rtitle-also", t);
  _dtUi.el("i", "", t._dtAlso);
  t._dtAlsoText = _dtUi.el("span", "", t._dtAlso);
  t._dtAlso.style.visibility = "hidden";
  return t;
}
// A stop's status line and whether work is going on there.
function _dtrStatus(gv, room) {
  if (room === _DTR_BOSS) return { label: "", busy: false };
  const label = String(_dtrItemLabel(gv, room) || "");
  return { label: label, busy: !!label && label !== _dtrT("free") };
}
function _dtrSyncTitle(gv, going) {
  const here = going || _dtrHere();
  if (!here) {
    // No layout runs while the next room loads its images: the title stays up (it already names that room).
    if (!_dtUi.layoutName() && _dtrTitle && _dtrTitle.style.display !== "none") return;
    if (_dtrTitle && _dtrTitle.style.display !== "none") _dtrTitle.style.display = "none";
    return;
  }
  const layer = _dtUi.ensure();
  if (!_dtrTitle || !_dtrTitle.isConnected) _dtrTitle = _dtrBuildTitle(layer);
  const t = _dtrTitle;
  if (t.style.display) t.style.display = "";
  const name = _dtrT(here);
  if (t._dtName.textContent !== name) t._dtName.textContent = name;
  const stops = _dtrStops(gv);
  const st = {};
  for (const r of stops) st[r] = _dtrStatus(gv, r);
  let label = (st[here] || _dtrStatus(gv, here)).label;
  // The other rooms at work; one the status line already names is left out.
  const others = _DTR_ROOMS.filter((r) => r !== here && st[r] && st[r].busy);
  // The boss office tells which room is busy, as the mockup ("Design is working on Arc 6"); a room
  // whose item is done or waits on another room is named with its full label ("Design: Arc 6 · Ready").
  if (here === _DTR_BOSS) {
    const busy = others.shift();
    label = !busy ? ""
      : _dtrAtWork(st[busy].label) ? _dtUi.t(_DTR_TEXT.working, { room: _dtrT(busy), name: st[busy].label.split(" · ")[0] })
      : _dtUi.t(_DTR_TEXT.other, { room: _dtrT(busy), label: st[busy].label });
  }
  const also = others.length > 1 ? _dtUi.t(_DTR_TEXT.others, { n: others.length })
    : others.length ? _dtUi.t(_DTR_TEXT.other, { room: _dtrT(others[0]), label: st[others[0]].label }) : "";
  // Sent every tick: only write changes, so the page is not laid out again. An empty line keeps
  // its height, so nothing under or around it jumps.
  if (t._dtSub.textContent !== label) t._dtSub.textContent = label;
  const vis = label ? "" : "hidden";
  if (t._dtSub.style.visibility !== vis) t._dtSub.style.visibility = vis;
  if (t._dtAlsoText.textContent !== also) t._dtAlsoText.textContent = also;
  const alsoVis = also ? "" : "hidden";
  if (t._dtAlso.style.visibility !== alsoVis) t._dtAlso.style.visibility = alsoVis;
  const off = !_dtrCanMove(gv);
  if (t.classList.contains("dt-off") !== off) t.classList.toggle("dt-off", off);
}
// The game's era banner (#epoch-overlay, "The ... Era", its band at top 132) came up under the room title.
// While the title is shown the band's top moves down to just below the title's lowest line in use (the
// title's own measures: row, status line, other-room line), so its top rule sits 18 below it; with no
// title it is the game's 132 again. Only #ep-top's top changes, through a rule over the game's own CSS.
var _DTR_ERA_TOP = 132;
function _dtrEraTop(t) {
  if (!t || !t.isConnected || t.style.display === "none") return 0;
  let bottom = 134 + 36 * 1.1; // top, then the name row
  if (t._dtSub.style.visibility !== "hidden" || t._dtAlso.style.visibility !== "hidden") bottom += 8 + 22 * 1.1;
  if (t._dtAlso.style.visibility !== "hidden") bottom += 8 + 21;
  return Math.max(_DTR_ERA_TOP, Math.round(bottom + 18 - 30)); // the band's top padding is 30
}
function _dtrEraClear() {
  const root = document.documentElement;
  if (!root) return;
  if (!document.getElementById("dt-rooms-era-css")) {
    const st = document.createElement("style");
    st.id = "dt-rooms-era-css";
    st.textContent = "html.dt-era-clear #epoch-overlay #ep-top { top: calc(var(--dt-era-top) * var(--ep-s, 1)) !important; }";
    document.head.appendChild(st);
  }
  const top = _dtrEraTop(_dtrTitle);
  const v = top ? top + "px" : "";
  if (root.style.getPropertyValue("--dt-era-top") === v) return;
  if (v) root.style.setProperty("--dt-era-top", v);
  else root.style.removeProperty("--dt-era-top");
  root.classList.toggle("dt-era-clear", !!v);
}
function _dtrTick() {
  try {
    const gv = _dtrGv();
    if (!gv) return;
    _dtrWire();
    if (_dtrView && Date.now() - _dtrNavAt > 2000) _dtrSettle(gv);
    // Game code that sets OfficeType itself has taken over: keep its value.
    if (_dtrView && String(gv.OfficeType) !== _DTR_BOSS) _dtrView = null;
    if (_dtrView) _dtrHideIdle();
    else if (_dtrHidden.layers.size) _dtrUnhide();
    _dtrPickBack(gv);
    _dtrSyncTitle(gv);
    _dtrEraClear();
  } catch (e) {
    console.warn("[Rooms] tick:", e);
  }
}
// The shared mod timer (ui.js every) when ui.js is in; a timer of our own without it.
(typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(_dtrTick, 250);
globalThis._dtRooms = {
  go: (room) => _dtrGo(room),
  step: (d) => _dtrGo(_dtrStep(_dtrGv(), d)),
  view: () => (_dtrView ? Object.assign({}, _dtrView) : null),
  pickFrom: () => (_dtrPickFrom ? _dtrPickFrom.room : null),
  real: () => _dtrReal(_dtrGv()),
  here: _dtrHere,
  stops: () => _dtrStops(_dtrGv()),
  canMove: () => _dtrCanMove(_dtrGv()),
  label: (room) => _dtrItemLabel(_dtrGv(), room),
  // Forget the viewed room without writing OfficeType (the caller has set it).
  drop: () => { _dtrView = null; },
  // Queue patch: a create flow left from a viewed room comes back to that view.
  resume: (v) => {
    _dtrView = { room: v.room, real: v.real, layout: v.layout };
    _dtrNavAt = Date.now();
    const gv = _dtrGv();
    if (gv) gv.OfficeType = _DTR_BOSS;
  },
  layoutStart: _dtrOnLayoutStart,
  tick: _dtrTick,
  eraTop: () => _dtrEraTop(_dtrTitle),
};
