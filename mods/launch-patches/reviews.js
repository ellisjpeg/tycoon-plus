// ── Planned launches get their reviews on launch day ──
// The launch question now comes when the game's "reviews are ready" card
// would show, before any review. "Launch today" lets the game run its review
// screens and release as before. "Plan launch" scores the device right away
// (the game's own review engine, run off-screen with every value it touches
// put back), keeps those results, and gives the rows the planned RELEASE day.
// On that day the device's line is moved to the front, the game's reviews
// card is queued again, and the review screens show the kept results, so the
// scores are the finish-day ones. The game's own last review click then puts
// it on sale. Waiting devices are kept per save slot in ArraySaves row 160.
var _DT_RW_ROW = 160;
var _DT_RW_TYPES = {
  SMARTPHONES: ["ArraySmartphones", "Smartphones"], TABLETS: ["ArrayTablets", "Tablets"], LAPTOPS: ["ArrayLaptops", "Laptops"],
  WATCHES: ["ArrayWatches", "Watches"], HEADPHONES: ["ArrayHeadphones", "Headphones"], TV: ["ArrayTV", "TV"],
  SCOOTER: ["ArrayScooters", "Scooter"], KEYBOARD: ["ArrayKeyboards", "Keyboards"], CONSOLE: ["ArrayConsoles", "Consoles"],
  "VR CONSOLE": ["ArrayVRConsoles", "VR"],
};
var _dtRw = { list: [], slot: -1, company: "", ask: null, mode: "", run: null, seenReviews: false, hold: null };

function _dtRwGv() {
  return globalThis.runtime.globalVars;
}
function _dtRwLoad() {
  const slot = _dtEvSlotNow();
  const company = _dtEvCompanyNow();
  if (slot === _dtRw.slot && company === _dtRw.company) return;
  _dtRw.slot = slot;
  _dtRw.company = company;
  _dtRw.list = [];
  const a = _dtEvSaves();
  let raw = "";
  try {
    if (a && a.height > _DT_RW_ROW && a.width > slot) raw = a.getAt(slot, _DT_RW_ROW, 0);
  } catch (e) {}
  if (typeof raw !== "string" || raw.charAt(0) !== "{") return;
  try {
    const j = JSON.parse(raw);
    if (j && j.v === 1 && j.company === company && Array.isArray(j.list)) _dtRw.list = j.list.filter((e) => e && e.key && _DT_RW_TYPES[e.type]);
  } catch (e) {}
}
// Only writes over an empty cell or our own state, so other data is never lost.
function _dtRwSave() {
  const a = _dtEvSaves();
  const slot = _dtEvSlotNow();
  if (!a || a.height <= _DT_RW_ROW || a.width <= slot) return console.warn("[Reviews] no ArraySaves row", _DT_RW_ROW);
  const cur = a.getAt(slot, _DT_RW_ROW, 0);
  if (!(cur === 0 || cur === "" || (typeof cur === "string" && cur.indexOf('{"v":1,"company"') === 0 && cur.indexOf('"list"') > 0))) {
    return console.warn("[Reviews] row", _DT_RW_ROW, "is in use");
  }
  if (!_dtRw.list.length && (cur === 0 || cur === "")) return;
  a.setAt(JSON.stringify({ v: 1, company: _dtEvCompanyNow(), list: _dtRw.list }), slot, _DT_RW_ROW, 0);
}
function _dtRwEntry(key) {
  _dtRwLoad();
  return _dtRw.list.find((e) => e.key === key) || null;
}
function _dtRwDrop(entry) {
  _dtRw.list = _dtRw.list.filter((e) => e !== entry);
  _dtRwSave();
}

// Assistant queue (width = cards, y0 theme, y1 param).
function _dtRwCardShift() {
  const a = _dtLaunchArr("ArrayGameAssistant");
  if (!a || (a.width | 0) < 1) return;
  const w = a.width | 0;
  for (let x = 0; x < w - 1; x++) for (let y = 0; y < (a.height | 0); y++) a.setAt(a.getAt(x + 1, y, 0), x, y, 0);
  a.setSize(w - 1, a.height, a.depth);
}
function _dtRwCardFront(theme) {
  const a = _dtLaunchArr("ArrayGameAssistant");
  if (!a) return;
  const w = a.width | 0;
  a.setSize(w + 1, Math.max(2, a.height | 0), Math.max(1, a.depth | 0));
  for (let x = w; x > 0; x--) for (let y = 0; y < (a.height | 0); y++) a.setAt(a.getAt(x - 1, y, 0), x, y, 0);
  a.setAt(theme, 0, 0, 0);
  a.setAt(0, 0, 1, 0);
}
// What the game does when its reviews card is clicked.
function _dtRwCardClick() {
  _dtRwCardShift();
  _dtRwGv().Assistant = "OFF";
  globalThis.runtime.callFunction("Assistant_OFF");
}

// Rows of the finished, not yet reviewed device on line 0.
function _dtRwWaitingRows(arrName) {
  const a = _dtLaunchArr(arrName);
  const out = [];
  if (!a || (a.width | 0) < 1) return out;
  for (let y = 0; y < Math.min(3, a.height | 0); y++) {
    if (a.getAt(0, y, _DT_LAUNCH_COL.CREATED) === -1) continue;
    if (Number(a.getAt(0, y, _DT_LAUNCH_COL.RELEASE)) < 0) out.push(y);
  }
  return out;
}

// Everything the review engine writes, so scoring off-screen leaves no trace.
function _dtRwArrays() {
  const objs = globalThis.runtime.objects;
  return Object.keys(objs).filter((n) => n === "ArrayReviews_Temp" || n === "ArrayReviews_Text" || n.indexOf("ArrayEditorDesign") === 0);
}
function _dtRwKeep() {
  const g = _dtRwGv();
  const vars = {};
  for (const k in g) {
    const v = g[k];
    if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") vars[k] = v;
  }
  const arrs = [];
  for (const n of _dtRwArrays()) {
    const a = _dtLaunchArr(n);
    if (!a) continue;
    const w = a.width | 0, h = a.height | 0, d = a.depth | 0;
    const cells = [];
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) cells.push(a.getAt(x, y, z));
    arrs.push({ a, w, h, d, cells });
  }
  return { vars, arrs };
}
function _dtRwPutBack(k) {
  const g = _dtRwGv();
  for (const n in k.vars) if (g[n] !== k.vars[n]) g[n] = k.vars[n];
  for (const s of k.arrs) {
    if ((s.a.width | 0) !== s.w || (s.a.height | 0) !== s.h || (s.a.depth | 0) !== s.d) s.a.setSize(s.w, s.h, s.d);
    let i = 0;
    for (let x = 0; x < s.w; x++) for (let y = 0; y < s.h; y++) for (let z = 0; z < s.d; z++) s.a.setAt(s.cells[i++], x, y, z);
  }
}
// One variant's reviews from the game's engine: 4 texts, tooltips and scores.
function _dtRwScore(type, fn, y) {
  const g = _dtRwGv();
  const rt = globalThis.runtime;
  g.DeviceTypeCreatingNow = type;
  g.ReviewDeviceNowID = y;
  rt.callFunction("ReviewsEngine_" + fn);
  rt.callFunction("ReviewsEngineResults");
  const t = _dtLaunchArr("ArrayReviews_Text");
  const text = [];
  for (let i = 0; i < 4; i++) text.push(t ? [t.getAt(i, 0, 0), t.getAt(i, 1, 0)] : ["", ""]);
  return { y, text, r: [g.ReviewRating_1, g.ReviewRating_2, g.ReviewRating_3, g.ReviewRating_4], name: g.DeviceName };
}
function _dtRwSnap(ask) {
  const keep = _dtRwKeep();
  const out = { snaps: [], pad: null };
  try {
    for (const y of ask.ys) out.snaps.push(_dtRwScore(ask.type, ask.fn, y));
    if (ask.type === "CONSOLE" && _hasUnreleasedGamepad()) out.pad = _dtRwScore("GAMEPAD", "Gamepad", 0);
  } finally {
    _dtRwPutBack(keep);
  }
  return out;
}

// A: the game's "reviews are ready" card becomes the launch question.
var _dtRwNewsOrig = showOfficeNews;
showOfficeNews = function () {
  try {
    const g = _dtRwGv();
    if (g.AssistantTheme === "REVIEWS" && !_dtRw.run) {
      if (_dtRw.ask) return true;
      const type = String(g.DeviceTypeCreatingNow || "").trim();
      const m = _DT_RW_TYPES[type];
      const ys = m ? _dtRwWaitingRows(m[0]) : [];
      if (ys.length) {
        _dtRw.ask = { arr: m[0], cat: _DT_LAUNCH_CATS[m[0]], type, fn: m[1], ys };
        _dtLaunchAsk(m[0], _dtRw.ask.cat, ys);
        _dtRwGuard();
        return true;
      }
    }
  } catch (e) {
    console.warn("[Reviews] card:", e);
    _dtRw.ask = null;
  }
  return _dtRwNewsOrig.apply(this, arguments);
};
// If the question closes without an answer (the event form reopens it after a
// moment), fall back to launching today so the card is never lost.
function _dtRwGuard() {
  let shut = 0;
  const id = setInterval(() => {
    if (!_dtRw.ask) return clearInterval(id);
    if (_dtUi.isOpen()) return (shut = 0);
    if (++shut < 8) return;
    clearInterval(id);
    _dtRwToday();
  }, 150);
}
function _dtRwAsked(arrName, x) {
  return !!_dtRw.ask && _dtRw.ask.arr === arrName && x === 0;
}
// The device's launch event (or its own launch day) is today: after its reviews
// that event puts it on sale, with the presentation offer.
function _dtRwHeldBy(ask) {
  if (typeof _dtEvOf !== "function") return null;
  const a = _dtLaunchArr(ask.arr);
  if (!a) return null;
  _dtEvLoad();
  const ev = _dtEvOf(_dtEvKey(ask.arr, a, 0, ask.ys[0]));
  return ev && ev.day === _dtUi.num("DayTotal", 0) ? { arr: ask.arr, ys: ask.ys, day: ev.day } : null;
}
function _dtRwToday() {
  _dtRw.ask = null;
  _dtRw.mode = "today";
  _dtRw.seenReviews = false;
  _dtRwCardClick();
}

// B: Launch today = the game's own reviews now, then on sale (as before).
var _dtRwNowOrig = _dtLaunchNow;
_dtLaunchNow = function (arrName, cat, x, ys, name) {
  if (_dtRwAsked(arrName, x)) {
    _dtRw.hold = _dtRwHeldBy(_dtRw.ask);
    return _dtRwToday();
  }
  const a = _dtLaunchArr(arrName);
  const entry = a && ys.length ? _dtRwEntry(_dtEvKey(arrName, a, x, ys[0])) : null;
  if (!entry) return _dtRwNowOrig(arrName, cat, x, ys, name);
  // Shelf "Launch now" on a device still waiting for reviews: due today.
  _dtLaunchSetDay(arrName, x, ys, _dtUi.num("DayTotal", 0));
  _dtLaunchRefresh();
};

// C: Plan launch = keep the finish-day reviews, close the card, wait.
var _dtRwSetDayOrig = _dtLaunchSetDay;
_dtLaunchSetDay = function (arrName, x, ys, day) {
  if (!_dtRwAsked(arrName, x)) return _dtRwSetDayOrig(arrName, x, ys, day);
  const ask = _dtRw.ask;
  _dtRw.ask = null;
  const s = _dtRwSnap(ask);
  _dtRwSetDayOrig(arrName, 0, ask.ys, day);
  const a = _dtLaunchArr(arrName);
  _dtRwLoad();
  _dtRw.list.push({ key: _dtEvKey(arrName, a, 0, ask.ys[0]), arr: arrName, type: ask.type, ys: ask.ys, snaps: s.snaps, pad: s.pad });
  _dtRwSave();
  const g = _dtRwGv();
  _dtRwCardShift();
  g.Assistant = "OFF";
  g.AssistantTheme = "";
  globalThis.runtime.callFunction("Assistant_OFF");
  g.OfficeType = "BOSS";
  g.DeviceTypeCreatingNow = "";
  g.class = "GAMEPLAY";
  if (_dtUi.layoutName() !== "BOSS OFFICE") globalThis.runtime.goToLayout("BOSS OFFICE");
};

// D: waiting devices are not put on sale by the daily launch check.
_dtLaunchWaits = function (arrName, a, x) {
  _dtRwLoad();
  if (!_dtRw.list.length) return false;
  for (let y = 0; y < Math.min(3, a.height | 0); y++) {
    if (a.getAt(x, y, _DT_LAUNCH_COL.CREATED) !== -1 && _dtRwEntry(_dtEvKey(arrName, a, x, y))) return true;
  }
  return false;
};
// An event day waits until its devices have had their reviews.
if (typeof _dtEvDay === "function") {
  var _dtRwEvDayOrig = _dtEvDay;
  _dtEvDay = function (ev) {
    if (_dtRw.ask || _dtRw.mode || _dtRw.run) return; // reviews first
    _dtRwLoad();
    if (ev.keys.some((k) => _dtRw.list.some((e) => e.key === k))) return;
    return _dtRwEvDayOrig(ev);
  };
}

// E: on the planned day, replay the game's reviews with the kept results.
function _dtRwDue(entry, today) {
  const f = _dtEvFind(entry.key);
  if (!f) return { f: null, day: 0 };
  let day = Infinity;
  for (const y of entry.ys) day = Math.min(day, Number(f.a.getAt(f.x, y, _DT_LAUNCH_COL.RELEASE)));
  return { f, day: day <= today ? day : 0 };
}
function _dtRwSwap(a, x) {
  if (!x) return;
  const h = a.height | 0, d = a.depth | 0;
  for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) {
    const v = a.getAt(0, y, z);
    a.setAt(a.getAt(x, y, z), 0, y, z);
    a.setAt(v, x, y, z);
  }
}
function _dtRwStart() {
  const g = _dtRwGv();
  if (_dtRw.run || _dtRw.ask || _dtRw.mode || !_dtUi.onOffice() || _dtUi.isOpen()) return;
  if (g.Assistant === "ON" || g.class !== "GAMEPLAY" || _dtUi.num("GameplayPause", 0) !== 0) return;
  if (String(g.CreateDevicesUI || "OFF") !== "OFF") return; // the create picker is open (it keeps class GAMEPLAY)
  if ((typeof _dtEvRun !== "undefined" && _dtEvRun) || (typeof _dtEvStarting !== "undefined" && _dtEvStarting)) return;
  if (globalThis._dtLaunchPending === true) return;
  const q = globalThis._dtQueueApi;
  if (q && (q.capturing() || q.replaying())) return;
  _dtRwLoad();
  const today = _dtUi.num("DayTotal", 0);
  for (const entry of _dtRw.list) {
    const due = _dtRwDue(entry, today);
    if (!due.f) {
      _dtRwDrop(entry);
      return;
    }
    if (!due.day) continue;
    // After your own OS or app the game keeps its type, though nothing is in development.
    if (String(g.DeviceTypeCreatingNow || "") && !(typeof _dtpSpent === "function" && _dtpSpent(g))) {
      // Another device is being made: the pipeline parks it and brings it back after.
      // Not while it is out of the rooms (an OS just released, a device on its way to its own
      // reviews): parked there it would have no room to come back to.
      const live = typeof _dtpFocused === "function" ? _dtpFocused() : null;
      if (!live || !live.room) return;
      _dtpPark(g);
    }
    let held = false;
    if (typeof _dtEvOf === "function") {
      _dtEvLoad();
      const ev = _dtEvOf(entry.key);
      held = !!ev && ev.day === due.day;
    }
    const x = due.f.x;
    _dtRwSwap(due.f.a, x);
    for (const y of entry.ys) due.f.a.setAt(-1, 0, y, _DT_LAUNCH_COL.RELEASE);
    _dtRw.run = { entry, x, day: due.day, held, a: due.f.a, seen: false };
    g.DeviceTypeCreatingNow = entry.type;
    _dtRwCardFront("REVIEWS");
    g.Assistant = "ON";
    globalThis.runtime.callFunction("Assistant_ON");
    return;
  }
}
// The review screen shows the kept results instead of fresh ones.
var _dtRwRenderOrig = _renderCurrentDevice;
_renderCurrentDevice = function (e) {
  try {
    const run = _dtRw.run;
    const g = _dtRwGv();
    if (run) {
      const type = String(g.DeviceTypeCreatingNow || "").trim();
      const id = Number(g.ReviewDeviceNowID) | 0;
      const s = type === "GAMEPAD" ? run.entry.pad : type === run.entry.type ? run.entry.snaps.find((p) => p.y === id) || run.entry.snaps[0] : null;
      const t = _dtLaunchArr("ArrayReviews_Text");
      if (s && t) {
        for (let i = 0; i < 4; i++) {
          t.setAt(s.text[i][0], i, 0, 0);
          t.setAt(s.text[i][1], i, 1, 0);
          g["ReviewRating_" + (i + 1)] = s.r[i];
        }
        if (s.name !== undefined) g.DeviceName = s.name;
      }
    }
  } catch (err) {
    console.warn("[Reviews] render:", err);
  }
  return _dtRwRenderOrig.apply(this, arguments);
};
// The release click: a planned device goes on sale through the game itself,
// unless it is on a launch event, which then puts it on sale instead.
var _dtRwReleaseOrig = _dtLaunchRelease;
_dtLaunchRelease = function (arrName, rt, cat, last) {
  const run = _dtRw.run;
  if (run) return run.held && arrName === run.entry.arr;
  if (_dtRw.mode === "today") {
    if (_dtRw.hold) return arrName === _dtRw.hold.arr;
    if (last) {
      const ys = _dtLaunchJustReleased(arrName);
      if (ys.length && arrName !== "ArrayGamepads") {
        const nm = _dtLaunchName(arrName, ys);
        setTimeout(() => _dtUi.toast(_dtUi.t(_DT_LAUNCH_TEXT.launched, { n: nm }), nm, { sales: true }), 700);
      }
    }
    return false;
  }
  if (last) {
    const a = _dtLaunchArr(arrName);
    const ys = _dtLaunchJustReleased(arrName);
    const entry = a && ys.length ? _dtRwEntry(_dtEvKey(arrName, a, 0, ys[0])) : null;
    if (entry) _dtRwDrop(entry);
  }
  return _dtRwReleaseOrig(arrName, rt, cat, last);
};
// Ends the launch flow for the queue too: its own 60 s wait, not only the shared flag.
function _dtRwLaunchDone() {
  globalThis._dtLaunchPending = false;
  const q = globalThis._dtQueueApi;
  if (q && q.launchDone) q.launchDone();
  else if (q) q.arm();
}
function _dtRwOnLayout() {
  const lay = _dtUi.layoutName();
  if (lay === "REVIEWS") {
    _dtRw.seenReviews = true;
    if (_dtRw.run) _dtRw.run.seen = true;
    return;
  }
  if (_dtRw.mode && _dtRw.seenReviews) {
    _dtRw.mode = "";
    _dtRw.seenReviews = false;
    const hold = _dtRw.hold;
    _dtRw.hold = null;
    if (hold) {
      _dtRwSetDayOrig(hold.arr, 0, hold.ys, hold.day);
      // The held release marked the launch flow pending (queue.js); its day's offer takes over now.
      _dtRwLaunchDone();
    }
  }
  const run = _dtRw.run;
  if (!run || !run.seen) return;
  _dtRw.run = null;
  _dtRw.seenReviews = false;
  const ys = run.entry.ys;
  if (run.held) _dtRwSetDayOrig(run.entry.arr, 0, ys, run.day);
  _dtRwSwap(run.a, run.x);
  if (run.x) {
    // The game's sales list remembers lines; let it rebuild after the move back.
    try {
      _dirty = !0;
      if (!run.held) registerDeviceSalesForArray(run.entry.arr, globalThis.runtime);
    } catch (e) {}
  }
  if (typeof _dtpRefocus !== "undefined") _dtpRefocus = true;
  _dtRwDrop(run.entry);
  _dtRwLaunchDone();
  _dtLaunchRefresh();
}
// A save closed during the review screens: the rows still say "not reviewed"
// (RELEASE -1) at line 0; give them back their day so the replay runs again.
function _dtRwRepair() {
  const today = _dtUi.num("DayTotal", 0);
  for (const entry of _dtRw.list) {
    const f = _dtEvFind(entry.key);
    if (!f) continue;
    if (entry.ys.every((y) => Number(f.a.getAt(f.x, y, _DT_LAUNCH_COL.RELEASE)) < 0) && !_dtRw.run && !_dtRw.ask) {
      _dtRwSetDayOrig(entry.arr, f.x, entry.ys, today);
    }
  }
}
var _dtRwWired = false;
var _dtRwLoaded = "";
function _dtRwTick() {
  try {
    const rt = globalThis.runtime;
    if (!rt || !rt.globalVars) return;
    if (!_dtRwWired) {
      _dtRwWired = true;
      rt.addEventListener("afteranylayoutstart", () => {
        try {
          _dtRwOnLayout();
        } catch (e) {
          console.warn("[Reviews] layout:", e);
        }
      });
    }
    const lay = _dtUi.layoutName();
    if (lay === "MENU" || lay === "START PAGE" || lay === "LOADING GAME") {
      // A load (even of the same slot and company) replaces row 160 and the device rows:
      // forget the waiting list and any review in flight, and read the row again after it.
      Object.assign(_dtRw, { list: [], slot: -1, company: "", ask: null, mode: "", run: null, seenReviews: false, hold: null });
      if (lay === "LOADING GAME" && String(rt.globalVars.LoadingType || "").toUpperCase() === "NEW GAME") {
        const a = _dtEvSaves(), slot = _dtEvSlotNow();
        try {
          if (a && a.height > _DT_RW_ROW && a.width > slot && a.getAt(slot, _DT_RW_ROW, 0) !== 0) a.setAt("", slot, _DT_RW_ROW, 0);
        } catch (e) {}
      }
      _dtRwLoaded = "";
      return;
    }
    _dtRwLoad();
    const sig = _dtRw.slot + "|" + _dtRw.company;
    if (sig !== _dtRwLoaded) {
      _dtRwLoaded = sig;
      _dtRwRepair();
    }
    _dtRwStart();
  } catch (e) {
    console.warn("[Reviews] tick:", e);
  }
}
// The shared mod timer (ui.js every) when ui.js is in; a timer of our own without it.
(typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(_dtRwTick, 250);
globalThis._dtReviewsApi = { state: () => _dtRw, tick: _dtRwTick, snap: _dtRwSnap };
