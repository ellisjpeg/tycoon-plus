// ── Real-life phone calendar and part prices ──
// Outside the Original preset the phone part lists unlock on their real
// "widespread in flagships" dates (real-data.js) and each kind of part gets cheaper at its own
// real yearly rate. Original is the untouched game.
// - Part lists: the game gates each list row by a date column and offers
//   the first N rows that are out; a saved design stores its slider position
//   in that list, so a row that disappears would silently swap the part.
//   So a row this company could already use when the new calendar first
//   applied to it (realFrom, saved in the difficulty row 150) keeps its old
//   date; everything else follows the new calendar. A fresh company (realFrom
//   within the first month) gets the whole new calendar.
// - Features with a fixed day on the research page (rear fingerprint, eSIM,
//   slow motion, second camera) show the game's own NOT AVAILABLE until the
//   new day; anything already researched stays researched.
// - DictionaryTimeline (news) follows the moved dates.
var _DT_REAL = {
  FRESH_DAYS: 31, // realFrom up to this day = a new company
  DECAY: { storage: 0.75, memory: 0.82, oled: 0.9, lcd: 0.94, chip: 0.9 },
  OLED: /OLED|LTPO|PeLED|MICRO LED|Laser/i,
  NOT_AVAILABLE: 11956, // ArrayLanguage column of the game's "NOT AVAILABLE"
};
var _dtReal = { state: "" };

// The day a part row unlocks for this company.
function _dtRealDay(name, row, on, from) {
  const t = _DT_REAL_ROWS[name];
  const old = t.orig[row];
  const now = t.rows[row];
  if (!on) return old;
  if (now > old && from > _DT_REAL.FRESH_DAYS && old <= from) return old; // already out for this company
  return now;
}
function _dtRealFrom() {
  return typeof _dtDiffRealFrom === "number" ? _dtDiffRealFrom : null;
}
// Rewrites the date column of every listed part table; returns true if it changed anything.
function _dtRealApply(force) {
  const rt = globalThis.runtime;
  const on = !_dtResShipped();
  const from = _dtRealFrom() ?? 0;
  const state = [on ? "on" : "off", from, _dtDiffSlot, _dtDiffCompany].join("|");
  if (state === _dtReal.state && !force) return false;
  let ready = true;
  for (const name in _DT_REAL_ROWS) {
    const o = rt.objects[name];
    const a = o && o.getFirstInstance();
    const t = _DT_REAL_ROWS[name];
    if (!a || !(a.width > 0)) {
      ready = false;
      continue;
    }
    for (const r in t.rows) {
      const row = Number(r);
      if (row >= a.width) continue;
      const v = _dtRealDay(name, row, on, from);
      if (Number(a.getAt(row, t.col)) !== v) a.setAt(v, row, t.col);
    }
  }
  _dtRealTimeline(on);
  if (ready) _dtReal.state = state;
  return true;
}
// News calendar: each moved list waits for its next row, moved features for
// their new day, and the next check day is recomputed the game's way.
function _dtRealTimeline(on) {
  const rt = globalThis.runtime;
  const d = rt.objects.DictionaryTimeline && rt.objects.DictionaryTimeline.getFirstInstance();
  const map = d && typeof d.getDataMap === "function" ? d.getDataMap() : null;
  if (!map) return;
  const day = _dtUi.num("DayTotal", 0);
  for (const name in _DT_REAL_ROWS) {
    if (!map.has(name) || String(map.get(name)) === "") continue;
    const a = rt.objects[name] && rt.objects[name].getFirstInstance();
    if (!a) continue;
    let next = 999999;
    const col = _DT_REAL_ROWS[name].col;
    for (let x = 0; x < a.width; x++) {
      const v = Number(a.getAt(x, col));
      if (v > day && v < next) next = v;
    }
    map.set(name, next);
  }
  for (const id in _DT_REAL_FEATURES) {
    const f = _DT_REAL_FEATURES[id];
    if (!f.key || !map.has(f.key)) continue;
    const v = Number(map.get(f.key));
    if (on && v === f.old && f.day > day) map.set(f.key, f.day);
    else if (!on && v === f.day) map.set(f.key, f.old > day ? f.old : -10);
  }
  let next = -1;
  let min = 9999999;
  for (const v of map.values()) {
    const n = Number(v);
    if (String(v) !== "" && n > day && n - day < min) (min = n - day), (next = n);
  }
  rt.globalVars.TimelineNextDay = next;
}
// Research page: a feature waits for its real day.
_readRows = (function (orig) {
  return function () {
    try {
      if (!_dtResShipped()) {
        const rt = globalThis.runtime;
        const t = rt.objects.ArrayResearchPage_Temp.getFirstInstance();
        const day = _dtUi.num("DayTotal", 0);
        for (let x = 0; x < (t.width | 0); x++) {
          const f = _DT_REAL_FEATURES[Number(t.getAt(x, 0))];
          if (!f || day >= f.day || !String(t.getAt(x, 1) ?? "")) continue;
          const status = t.getAt(x, 4); // blank is 0 or ""
          if ((status !== 0 && String(status ?? "") !== "") || Number(t.getAt(x, 2)) >= Number(t.getAt(x, 3))) continue;
          const lang = rt.objects.ArrayLanguage.getFirstInstance();
          const text = lang.getAt(_dtUi.num("LanguageChoose", 0), _DT_REAL.NOT_AVAILABLE) || lang.getAt(0, _DT_REAL.NOT_AVAILABLE);
          t.setAt(String(text || "NOT AVAILABLE"), x, 4);
        }
      }
    } catch (e) {
      console.warn("[Real] research:", e);
    }
    return orig.apply(this, arguments);
  };
})(_readRows);

// Yearly price drop of one part row (the cost model's spec items, prepare.py).
function _dtRealRate(name, row, rt) {
  if (/^Array(ROM|MicroSD|SSD|HDD|Storage)/i.test(name)) return _DT_REAL.DECAY.storage;
  if (/^ArrayRAM/i.test(name)) return _DT_REAL.DECAY.memory;
  if (/^Array(CPU|GPU|Processor)/i.test(name)) return _DT_REAL.DECAY.chip;
  if (!/^ArrayScreen/i.test(name) || /Protection/i.test(name)) return 0;
  let tech = name;
  let techRow = row;
  if (!/^ArrayScreenTechnology/i.test(name)) {
    tech = "ArrayScreenTechnology" + name.slice(name.indexOf("_"));
    techRow = Math.round(Number(rt.globalVars.ScreenTechnologyID) || 0);
  }
  const a = rt.objects[tech] && rt.objects[tech].getFirstInstance();
  const label = a ? String(a.getAt(techRow, 0) ?? "") : "";
  return _DT_REAL.OLED.test(label) ? _DT_REAL.DECAY.oled : _DT_REAL.DECAY.lcd;
}
function _dtRealAge(age, name, row, rt) {
  const base = _ageFactor(age);
  try {
    if (!(age > 0) || _dtResShipped()) return base;
    const rate = _dtRealRate(String(name || ""), row, globalThis.runtime || rt);
    if (!rate) return base;
    const f = Math.pow(rate, age);
    return f < _cfg12.COMPONENT_FLOOR ? _cfg12.COMPONENT_FLOOR : f;
  } catch (e) {
    return base;
  }
}

function _dtRealTick() {
  try {
    const rt = globalThis.runtime;
    if (!rt || !rt.objects || _dtDiffSlot < 0) return;
    if (!_dtResShipped() && _dtRealFrom() === null) {
      _dtDiffRealFrom = _dtUi.num("DayTotal", 0);
      _dtDiffCostDirty = true; // saved with the difficulty row on the next tick
    }
    _dtRealApply(false);
  } catch (e) {
    console.warn("[Real] tick:", e);
  }
}
globalThis._dtRealInfo = () => ({ state: _dtReal.state, from: _dtRealFrom() });
// The shared mod timer (ui.js every) when ui.js is in; a timer of our own without it.
(typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(_dtRealTick, 250);
