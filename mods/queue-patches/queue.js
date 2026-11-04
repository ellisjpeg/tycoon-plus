// ── Build queue: create while busy, start it by itself later ──
// While a device is in development the player can still go through the
// game's own create screens (type, count, name, editor, price). At the final
// create step the game would run <Type>AddToArray on the LOADING EDITOR
// layout. If another device is in development, the queue stores exactly what
// that function reads (_DTQ_READS: its globals and arrays, per batch variant),
// blocks the call, puts every touched global back and returns to the office.
// Nothing is created and nothing is charged.
//
// When the current device is finished, the head entry is replayed: its stored
// values are written back and the game's own LOADING EDITOR layout runs
// AddToArray, _Finish and its loop over the batch variants, as after a click
// on "Create". The written rows are therefore the same as a hand-made device.
//
// Own CPUs and graphics cards are queued the same way at their commit layout
// (CPU LOADING / GPU LOADING): the game's own MyCPU_*/MyGPU_AddToArray runs,
// the new record is copied, and every touched array and global is put back.
// While a later device is designed, each queued part is shown in that
// editor's own list as a "Queued: <name>" record; the capture puts the arrays
// back afterwards, so the row only exists while the editor is open. A device
// that picks it is replayed only after the part is made, with the real IDs.
//
// The template patch's "Start from" list also offers queued devices
// (_dtqTemplates): copies of a variant's stored values, read-only.
//
// Queue state is per company in ArraySaves row 151 (difficulty uses 150):
//   {v:3, company, start, paused, items:[device | part]}
//   device: {id,type,count,names,variants[{vars,arrays,part?}]}
//   part:   {id,kind:"part",part:"CPU"|"GPU",platform,name,vars,record}
// A part's ID is its record's col0 (the game inserts new records at the
// front of ArrayMyCPU_* / ArrayMyGPU_*), so records are found by ID, never
// by column.
// v2 has only device entries and loads unchanged. It is written only when
// ArraySaves really has the row and slot.
var _DTQ_ROW = 151;
var _DTQ_V = 3;
var _DTQ_TYPES = ["SMARTPHONE", "LAPTOP", "TABLET", "WATCHES", "HEADPHONES", "TV", "SCOOTER", "KEYBOARD", "CONSOLE", "VR"];
// GoToLayout targets of LOADING EDITOR's own loop (console's layout is plural).
var _DTQ_NAME_LAYOUT = {
  SMARTPHONE: "SMARTPHONE NAME", TABLET: "TABLET NAME", LAPTOP: "LAPTOP NAME", WATCHES: "WATCHES NAME",
  HEADPHONES: "HEADPHONES NAME", TV: "TV NAME", SCOOTER: "SCOOTER NAME", KEYBOARD: "KEYBOARD NAME",
  CONSOLE: "CONSOLES NAME", VR: "VR NAME",
};
var _DTQ_LOADING = "LOADING EDITOR";
// The create picker also has the own-parts tiles (276 GAMEPLAY 2443-2837).
// CPU, GPU and own OS are queued; the software flow writes inline and is
// still turned back while busy.
var _DTQ_PART_MENUS = ["MY SOFT MENU"];
var _DTQ_PART_MENU = { "CPU EDITOR MENU": "CPU", "GPU EDITOR MENU": "GPU" };
var _DTQ_PART_LOADING = { CPU: "CPU LOADING", GPU: "GPU LOADING" };
// Own-part arrays by part and the platform (DeviceType) it was made for.
var _DTQ_PART_ARR = {
  CPU: { SMARTPHONE: "ArrayMyCPU_Smartphones", LAPTOP: "ArrayMyCPU_Laptops", CONSOLE: "ArrayMyCPU_Consoles", VR: "ArrayMyCPU_VR" },
  GPU: { LAPTOP: "ArrayMyGPU_Laptops" },
};
// Which own-part list each device editor shows (PAGE 6 / CONSOLES and VR PAGE 3).
var _DTQ_USES = {
  SMARTPHONE: { CPU: "SMARTPHONE" }, TABLET: { CPU: "SMARTPHONE" }, LAPTOP: { CPU: "LAPTOP", GPU: "LAPTOP" },
  CONSOLE: { CPU: "CONSOLE" }, VR: { CPU: "VR" },
};
// Device globals for an own part: type value, series (record col1), record id (col0).
var _DTQ_PICK = {
  CPU: { typeVar: "ProcessorType", own: 2, series: "ProcessorID", ids: ["ProcessorSeriesID", "ProcessorModelID"] },
  GPU: { typeVar: "GraphicProcessorType", own: 3, series: "GraphicProcessorID", ids: ["GraphicProcessorSeriesID", "GraphicProcessorModelID"] },
};
// Same gates as the create-device tiles in 276 GAMEPLAY (DayTotal >= day and
// ArrayMyResearch[index] >= 2). Scooter's tile checks 2550 in the shipped UI.
var _DTQ_UNLOCK = {
  TABLET: { day: 724, research: 619 },
  KEYBOARD: { day: 2184, research: 623 },
  WATCHES: { day: 2549, research: 620 },
  HEADPHONES: { day: 2550, research: 621 },
  SCOOTER: { day: 2550, research: 622 },
  VR: { day: 2914, research: 624 },
};
// Globals the create flow itself sets besides what AddToArray reads.
var _DTQ_FLOW_VARS = ["DeviceType", "DevicesCount", "DeviceCountCreatingNow", "DeviceName", "DevicePrice",
  "DeviceCostPrice", "CreateDevicesUI", "class", "LastClass"];
// The calendar and the economy keep their live values when a capture ends.
var _DTQ_LIVE = /^(Day|DayTotal|Month|Year|Week|Hour|Minute|Second|Time|Timer|Budget|Money|Fans|GameplayPause|Speed|SaveSlot|CompanyName|LanguageChoose)$/;
var _DTQ_TEXT = {
  title: { en: "Build queue", ru: "Очередь разработки" },
  lead: { en: "Devices, CPUs, graphics cards and operating systems you create while something is in development wait here. The next one starts by itself when the current one is finished. A device never starts before a part it uses.", ru: "Устройства, процессоры, видеокарты и операционные системы, созданные во время другой разработки, ждут здесь. Следующее начнётся само, когда текущее будет готово. Устройство не начнётся раньше компонента, который оно использует." },
  empty: { en: "The queue is empty.", ru: "Очередь пуста." },
  pause: { en: "Pause", ru: "Пауза" },
  resume: { en: "Resume", ru: "Продолжить" },
  paused: { en: "Queue paused", ru: "Очередь на паузе" },
  running: { en: "Queue running", ru: "Очередь работает" },
  up: { en: "Up", ru: "Выше" },
  down: { en: "Down", ru: "Ниже" },
  remove: { en: "Remove", ru: "Удалить" },
  close: { en: "Done", ru: "Готово" },
  count1: { en: "Budget", ru: "Бюджетная" },
  count2: { en: "Budget + Standard", ru: "Бюджетная + Стандарт" },
  count3: { en: "Budget + Standard + Flagman", ru: "Бюджетная + Стандарт + Флагман" },
  added: { en: "Added to build queue ({n})", ru: "Добавлено в очередь разработки ({n})" },
  added_wait: { en: "Added to build queue ({n}). It waits: {why}", ru: "Добавлено в очередь разработки ({n}). Ожидание: {why}" },
  started: { en: "{n} started from the build queue.", ru: "{n}: разработка началась из очереди." },
  skip: { en: "Build queue: {n} cannot start, {why}. It stays in the queue.", ru: "Очередь: {n} нельзя начать, {why}. Запись осталась в очереди." },
  why_research: { en: "research is not ready", ru: "исследования не готовы" },
  why_type: { en: "not unlocked yet", ru: "ещё не открыто" },
  why_none: { en: "the device type is unavailable", ru: "тип устройства недоступен" },
  why_money: { en: "there is not enough money for the upgrade", ru: "не хватает денег на обновление" },
  why_failed: { en: "the game could not start it (it will try again)", ru: "игра не смогла начать (попробует снова)" },
  parts: { en: "Software can't be added to the build queue yet.", ru: "Программы пока нельзя добавить в очередь разработки." },
  queued: { en: "Queued: {n}", ru: "В очереди: {n}" },
  part_CPU: { en: "CPU", ru: "Процессор" },
  part_GPU: { en: "Graphics card", ru: "Видеокарта" },
  part_OS: { en: "Operating system", ru: "Операционная система" },
  uses: { en: "uses {n}", ru: "использует {n}" },
  gone: { en: "needs {n}, removed from the queue", ru: "нужен {n}, удалён из очереди" },
  why_partwait: { en: "{p} is not made yet", ru: "{p} ещё не создан" },
  why_partgone: { en: "its part {p} was removed from the queue (remove this device or design it again)", ru: "его компонент {p} удалён из очереди (удалите устройство или создайте его заново)" },
  why_partdiff: { en: "its part {p} came out different from the queued design", ru: "его компонент {p} получился не таким, как в очереди" },
  order: { en: "{n} uses {p}, so it stays below it in the queue.", ru: "{n} использует {p}, поэтому остаётся ниже в очереди." },
  removed_part: { en: "{p} removed. {n} needed it and will not start; remove it too or design it again.", ru: "{p} удалён. {n} использует его и не начнётся; удалите и его или создайте заново." },
  dropped: { en: "Old build queue entries were cleared (new queue format).", ru: "Старые записи очереди удалены (новый формат очереди)." },
};
var _dtqState = { v: _DTQ_V, company: "", paused: false, items: [] };
var _dtqSlot = -1;
var _dtqCompany = "";
var _dtqStart = "";
var _dtqIds = 0;
var _dtqPrevType = null;
var _dtqArmed = false;
var _dtqFailed = null;   // the last start that failed: {id, at}
var _DTQ_RETRY_FAILED = 15000;
var _dtqRetryAt = 0;
var _dtqLastSkip = "";
var _dtqStableKey = "";
var _dtqStableTicks = 0;
var _dtqLaunchPendingUntil = 0;
var _dtqBase = null;     // last office snapshot while busy: {vars, layout, view}
var _dtqCap = null;      // capture in progress: {base, arrays, type, count, variants, done}
var _dtqReplay = null;   // replay in progress: {id, k, at}
var _dtqWired = false;

function _dtqT(key, vars) {
  const e = _DTQ_TEXT[key];
  let s = e ? (_dtUi.ru() ? e.ru : e.en) : key;
  for (const k in vars || {}) s = s.split("{" + k + "}").join(String(vars[k]));
  return s;
}
function _dtqGv() {
  try {
    return globalThis.runtime && globalThis.runtime.globalVars || null;
  } catch (e) {
    return null;
  }
}
function _dtqSaves() {
  try {
    const o = globalThis.runtime.objects.ArraySaves;
    return o ? o.getFirstInstance() : null;
  } catch (e) {
    return null;
  }
}
function _dtqSlotNow() {
  return Math.max(0, Math.min(2, Math.round(_dtUi.num("SaveSlot", 0)) || 0));
}
function _dtqCompanyNow() {
  return String(_dtUi.gv("CompanyName", "") || "");
}
// Stronger than the name: the game's own campaign start (year/day). Use it
// only when getCampaignStart says it is known; its fallback returns the
// current Year/DayTotal, which would change every day and lose the queue.
function _dtqStartNow() {
  try {
    if ("function" == typeof globalThis.getCampaignStart) {
      const s = globalThis.getCampaignStart();
      const y = Number(s && s.year);
      if (s && s.known === true && Number.isFinite(y) && y > 1900) {
        return { year: y, day: Number(s.day) || 0 };
      }
    }
  } catch (e) {}
  // Stable fallback from the save's own calendar: the game has exactly 365
  // days per year, so the start year is Year minus complete elapsed years.
  const y = _dtUi.num("Year", 0), d = _dtUi.num("DayTotal", 0);
  if (Number.isFinite(y) && y > 1900 && Number.isFinite(d) && d >= 0) {
    const year = y - Math.floor((Math.max(1, d) - 1) / 365);
    if (year > 1900) return { year: year, day: 365 * (year - 2008) + 1 };
  }
  return null;
}
// getCampaignStart reads the game's stats arrays; the tick asks 4 times a
// second. Its answer can only change with the day, the save or the screen
// (a load goes through LOADING GAME), so it is asked again only then.
var _dtqStartMemo = { k: null, v: "" };
function _dtqStartKey() {
  const k = _dtUi.layoutName() + "|" + _dtUi.num("DayTotal", 0) + "|" + _dtUi.num("Year", 0) + "|" + _dtqSlotNow() + "|" + _dtqCompanyNow();
  if (k === _dtqStartMemo.k) return _dtqStartMemo.v;
  const s = _dtqStartNow();
  _dtqStartMemo = { k: k, v: s ? s.year + ":" + s.day : "" };
  return _dtqStartMemo.v;
}
function _dtqClearRow() {
  const a = _dtqSaves(), slot = _dtqSlotNow();
  try {
    if (a && a.height > _DTQ_ROW && a.width > slot) a.setAt("", slot, _DTQ_ROW, 0);
  } catch (e) {
    console.warn("[Queue] clear failed:", e);
  }
}
function _dtqTypeLabel(type) {
  const d = _DEVICES[type];
  if (!d) return type;
  return _dtUi.ru() ? (d.ru || d.en || type) : (d.en || d.ru || type);
}
function _dtqTypeOkay(type) {
  return _DTQ_TYPES.indexOf(String(type || "").toUpperCase()) >= 0 && !!_DEVICES[type] && !!_DTQ_READS[type];
}
function _dtqResearch(idx) {
  try {
    const a = _getArray24("ArrayMyResearch");
    // ArrayMyResearch is 1000 x 1 x 1: the research index is X, like the game.
    return a ? Number(a.getAt(idx, 0, 0)) : NaN;
  } catch (e) {
    return NaN;
  }
}
function _dtqNewId() {
  _dtqIds++;
  return Date.now().toString(36) + "-" + _dtqIds;
}
// ── Arrays: plain copies, so a stored variant survives save/reload ──
function _dtqArr(name) {
  try {
    return _getArray24(name);
  } catch (e) {
    return null;
  }
}
function _dtqArrDump(name) {
  const a = _dtqArr(name);
  if (!a) return null;
  const s = _arrSize3(a), w = s[0] | 0, h = s[1] | 0, d = s[2] | 0, cells = [];
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) cells.push(a.getAt(x, y, z));
  return { w: w, h: h, d: d, cells: cells };
}
function _dtqArrLoad(name, dump) {
  const a = _dtqArr(name);
  if (!a || !dump || "function" != typeof a.setSize) return false;
  a.setSize(dump.w, dump.h, dump.d);
  let i = 0;
  for (let x = 0; x < dump.w; x++) for (let y = 0; y < dump.h; y++) for (let z = 0; z < dump.d; z++) a.setAt(dump.cells[i++], x, y, z);
  return true;
}
function _dtqAllReadArrays() {
  const out = [];
  for (const t in _DTQ_READS) for (const n of _DTQ_READS[t].arrays) if (out.indexOf(n) < 0) out.push(n);
  return out;
}
// The tick re-takes the office snapshot 4 times a second while busy, and a fresh
// copy of every global each time was the mods' biggest source of garbage. Nothing
// writes into a snapshot's vars, and the calendar and economy (_DTQ_LIVE) are never
// put back from one, so when only those moved the last copy is kept and they are
// refreshed in place. Any other change, or a var added or gone, makes a new copy.
var _dtqVarsLast = null, _dtqVarsN = 0, _dtqVarsKeys = null, _dtqVarsLive = null, _dtqVarsSrc = null;
// The game's globals are a fixed set (about 1,500): their names are listed
// once (again if the count changes), and the live ones are known by name.
function _dtqVarsNames(gv) {
  if (_dtqVarsSrc !== gv || !_dtqVarsKeys || Object.keys(gv).length !== _dtqVarsKeys.length) {
    _dtqVarsSrc = gv;
    _dtqVarsKeys = [];
    for (const k in gv) _dtqVarsKeys.push(k);
    _dtqVarsLive = new Set(_dtqVarsKeys.filter((k) => _DTQ_LIVE.test(k)));
  }
  return _dtqVarsKeys;
}
function _dtqVarsCopy(gv, prev) {
  const keys = _dtqVarsNames(gv);
  if (prev && prev === _dtqVarsLast) {
    let n = 0;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i], v = gv[k];
      if (!("number" == typeof v || "string" == typeof v || "boolean" == typeof v)) continue;
      n++;
      if (v === prev[k]) continue;
      if (!_dtqVarsLive.has(k)) { n = -1; break; }
      prev[k] = v;
    }
    if (n === _dtqVarsN) return prev;
  }
  const o = {};
  let n = 0;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i], v = gv[k];
    if ("number" == typeof v || "string" == typeof v || "boolean" == typeof v) { o[k] = v; n++; }
  }
  _dtqVarsLast = o;
  _dtqVarsN = n;
  return o;
}
// ── Entries ──
function _dtqNormalizePart(o) {
  if (String(o.part || "") === "OS") return _dtqNormalizeOs(o);
  const part = String(o.part || "");
  const platform = String(o.platform || "");
  if (!_DTQ_PART_ARR[part] || !_DTQ_PART_ARR[part][platform]) return null;
  if (!o.vars || "object" != typeof o.vars || !o.record || !Array.isArray(o.record.chip)) return null;
  return { id: String(o.id || _dtqNewId()), kind: "part", part: part, platform: platform,
    name: String(o.name || o.vars.DeviceName || "").slice(0, 40), vars: o.vars, record: o.record };
}
function _dtqNormalizeItem(o) {
  if (!o || "object" != typeof o) return null;
  if (o.kind === "part") return _dtqNormalizePart(o);
  const type = String(o.type || "").toUpperCase();
  if (!_dtqTypeOkay(type)) return null;
  const count = Math.round(Number(o.count) || 0);
  const variants = Array.isArray(o.variants) ? o.variants : [];
  // Older entries (made from the form) carry no editor data: they cannot be created.
  if (count < 1 || count > 3 || variants.length !== count) return null;
  for (const v of variants) if (!v || "object" != typeof v.vars || !v.vars) return null;
  const names = variants.map((v) => String(v.vars.DeviceName || "").slice(0, 40));
  return { id: String(o.id || _dtqNewId()), type: type, count: count, names: names, variants: variants };
}
function _dtqLoad(force) {
  const slot = _dtqSlotNow(), company = _dtqCompanyNow(), start = _dtqStartKey();
  if (!force && slot === _dtqSlot && company === _dtqCompany && start === _dtqStart) return;
  _dtqSlot = slot;
  _dtqCompany = company;
  _dtqStart = start;
  let next = { v: _DTQ_V, company: company, start: start, paused: false, items: [] };
  let dropped = 0;
  const a = _dtqSaves();
  try {
    if (a && a.height > _DTQ_ROW && a.width > slot) {
      const raw = String(a.getAt(slot, _DTQ_ROW, 0) ?? "");
      if (raw && raw !== "0") {
        const j = JSON.parse(raw);
        const jStart = String(j && j.start || "");
        // Same company name and start year (within a year: getCampaignStart
        // switches from its Year/DayTotal estimate to the known start once the
        // stats exist). A different campaign is ignored, never cleared here;
        // NEW GAME clears the row and the first save overwrites it.
        const sy = parseInt(start, 10), jy = parseInt(jStart, 10);
        const sameStart = !!jStart && (!start || Number.isFinite(sy) && Number.isFinite(jy) && Math.abs(sy - jy) <= 1);
        // v1 (form-made) entries are dropped below; v2 is v3 without parts.
        if (j && (j.v === 1 || j.v === 2 || j.v === _DTQ_V) && j.company === company && sameStart) {
          next.paused = !!j.paused;
          const raw = Array.isArray(j.items) ? j.items : [];
          next.items = raw.map(_dtqNormalizeItem).filter(Boolean);
          dropped = raw.length - next.items.length;
        }
      }
    }
  } catch (e) {
    console.warn("[Queue] row", _DTQ_ROW, "unreadable, using an empty queue:", e);
  }
  _dtqState = next;
  _dtqArmed = false;
  _dtqRetryAt = 0;
  _dtqLastSkip = "";
  if (dropped > 0) {
    console.warn("[Queue] dropped", dropped, "entries without editor data");
    _dtqSave();
    _dtUi.toast(_dtqT("dropped"));
  }
}
function _dtqSave() {
  const a = _dtqSaves(), slot = _dtqSlotNow();
  if (!a || a.height <= _DTQ_ROW || a.width <= slot) {
    console.warn("[Queue] no ArraySaves row", _DTQ_ROW);
    return false;
  }
  _dtqState.v = _DTQ_V;
  _dtqState.company = _dtqCompanyNow();
  _dtqState.start = _dtqStartKey();
  try {
    a.setAt(JSON.stringify(_dtqState), slot, _DTQ_ROW, 0);
    return true;
  } catch (e) {
    console.warn("[Queue] save failed:", e);
    return false;
  }
}
function _dtqFind(id) {
  return _dtqState.items.find((it) => it.id === id) || null;
}
function _dtqIndex(id) {
  return _dtqState.items.findIndex((it) => it.id === id);
}
function _dtqIsPart(it) {
  return !!it && it.kind === "part";
}
function _dtqLabel(it) {
  if (_dtqIsPart(it)) return it.name || _dtqT("part_" + it.part);
  return it.names[0] || _dtqTypeLabel(it.type);
}
// The queued parts a device entry picked in its editor (one per part kind).
function _dtqUsed(it) {
  const out = [];
  if (_dtqIsPart(it)) return out;
  for (const v of it.variants) if (v.part && !out.some((u) => u.id === v.part.id)) out.push(v.part);
  for (const v of it.variants) if (v.os && !out.some((u) => u.id === v.os.id)) out.push(v.os);
  return out;
}
// A device may never stand above a queued part it uses.
function _dtqOrderOk(items) {
  for (let d = 0; d < items.length; d++) {
    for (const u of _dtqUsed(items[d])) {
      const q = items.findIndex((it) => it.id === u.id);
      if (q > d) return u;
    }
  }
  return null;
}
function _dtqRemove(id) {
  const i = _dtqIndex(id);
  if (i < 0) return false;
  const it = _dtqState.items.splice(i, 1)[0];
  _dtqSave();
  _dtqLastSkip = "";
  if (_dtqIsPart(it)) {
    const users = _dtqState.items.filter((d) => _dtqUsed(d).some((u) => u.id === it.id && !u.real));
    if (users.length) _dtUi.toast(_dtqT("removed_part", { p: _dtqLabel(it), n: users.map(_dtqLabel).join(", ") }), _dtqLabel(it));
  }
  return true;
}
function _dtqCanMove(id, delta) {
  const i = _dtqIndex(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= _dtqState.items.length) return false;
  const next = _dtqState.items.slice();
  next.splice(j, 0, next.splice(i, 1)[0]);
  return !_dtqOrderOk(next);
}
function _dtqMove(id, delta) {
  const i = _dtqIndex(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= _dtqState.items.length) return false;
  if (!_dtqCanMove(id, delta)) {
    const a = _dtqState.items[i], b = _dtqState.items[j];
    const dev = _dtqIsPart(a) ? b : a, part = _dtqIsPart(a) ? a : b;
    _dtUi.toast(_dtqT("order", { n: _dtqLabel(dev), p: _dtqLabel(part) }), _dtqLabel(dev));
    return false;
  }
  const it = _dtqState.items.splice(i, 1)[0];
  _dtqState.items.splice(j, 0, it);
  _dtqSave();
  _dtqLastSkip = "";
  return true;
}
function _dtqPause(on) {
  _dtqState.paused = !!on;
  _dtqSave();
  if (!_dtqState.paused) _dtqRetryAt = Date.now();
  _dtqLastSkip = "";
}
// The column of a made part's real record (u.real.row is its ID), if it
// still matches the queued design (columns 0-2 are id, series and name; the
// rest come from the same globals).
function _dtqPartRow(u) {
  const a = _dtqArr(_DTQ_PART_ARR[u.part][u.platform]);
  if (!a || !u.real) return null;
  const x = _dtqColOf(a, u.real.row);
  if (x < 0) return null;
  for (let y = 3; y < u.chip.length; y++) if (String(a.getAt(x, y, 0)) !== String(u.chip[y])) return null;
  return x;
}
function _dtqReason(entry) {
  // An OS upgrade costs MyOSUpdatePrice; the game's FINISH button only works
  // while that price <= Budget (125 MY OS UI), and the capture refunded it.
  if (_dtqIsPart(entry) && entry.part === "OS" && entry.price > 0 && _dtUi.num("Budget", 0) < entry.price) return "money";
  if (_dtqIsPart(entry)) return "";
  if (!_dtqTypeOkay(entry.type)) return "none";
  const u = _DTQ_UNLOCK[entry.type];
  if (u) {
    if (_dtUi.num("DayTotal", 0) < u.day) return "type";
    const r = _dtqResearch(u.research);
    if (!(r >= 2)) return "research";
  }
  // The game's create path has no Budget check: designing is free and the
  // batch is paid later on the BATCH screen, so there is no money gate.
  for (const u of _dtqUsed(entry)) {
    if (!u.real) return _dtqFind(u.id) ? "partwait" : "partgone";
    if (u.part === "OS") {
      if (!_dtqOsOwned(u.platform)) return "partwait";
    } else if (_dtqPartRow(u) === null) return "partdiff";
  }
  return "";
}
function _dtqSkip(entry, why) {
  const key = entry.id + "|" + why;
  if (key !== _dtqLastSkip) {
    _dtqLastSkip = key;
    const u = _dtqUsed(entry).find((x) => !x.real || (x.part === "OS" ? !_dtqOsOwned(x.platform) : _dtqPartRow(x) === null));
    const p = u ? u.name || _dtqT("part_" + u.part) : "";
    _dtUi.toast(_dtqT("skip", { n: _dtqLabel(entry), why: _dtqT("why_" + why, { p: p }) }), _dtqLabel(entry));
  }
  _dtqArmed = false;
  _dtqRetryAt = Date.now() + 5000;
}
// ── Busy: a device (or OS/software) is in development ──
// DeviceTypeCreatingNow alone is not proof: it starts as "TV" in a new game and
// keeps the last item's type. The item is real while a work room holds it (the
// rooms patch knows the real one behind a viewed room), or while its release
// still waits in the assistant (the game is BOSS from delivery until REVIEWS).
var _DTQ_RELEASES = ["REVIEWS", "OS RELEASED", "SOFT RELEASED"];
function _dtqBusy(gv, real) {
  const t = String(gv.DeviceTypeCreatingNow || "");
  if (!t || _dtqOsReleased(t)) return false;
  if (real === undefined) real = globalThis._dtRooms ? globalThis._dtRooms.real() : gv.OfficeType;
  return String(real || "BOSS") !== "BOSS" || _dtqReleasing();
}
function _dtqReleasing() {
  const a = _dtqArr("ArrayGameAssistant");
  if (!a) return false;
  for (let x = 0; x < a.width; x++) if (_DTQ_RELEASES.indexOf(String(a.getAt(x, 0, 0))) >= 0) return true;
  return false;
}
function _dtqNameLayoutType(lay) {
  for (const t in _DTQ_NAME_LAYOUT) if (_DTQ_NAME_LAYOUT[t] === lay) return t;
  return "";
}
// ── Capture: the player's create flow while busy ──
function _dtqCapBegin(gv, type) {
  if (!_dtqBase) {
    console.warn("[Queue] busy create without an office snapshot; not queued");
    return;
  }
  const arrays = {};
  for (const n of _dtqAllReadArrays()) {
    const d = _dtqArrDump(n);
    if (d) arrays[n] = d;
  }
  _dtqCap = { base: _dtqBase, arrays: arrays, type: type, count: 0, variants: [], done: false, ph: [] };
  _dtqInject(_dtqCap, type);
  _dtqOsInject(_dtqCap, type);
}
// ── Queued parts in a device editor ──
function _dtqColumn(a, x) {
  const out = [];
  for (let y = 0; y < a.height; y++) out.push(a.getAt(x, y, 0));
  return out;
}
// The column the game just added: its col0 (ID) is not among the IDs before.
function _dtqNewCol(a, before) {
  const ids = {};
  for (let x = 0; x < before.w; x++) ids[String(before.cells[x * before.h * before.d])] = 1;
  for (let x = 0; x < a.width; x++) if (!ids[String(a.getAt(x, 0, 0))]) return x;
  return -1;
}
function _dtqColOf(a, id) {
  for (let x = 0; x < a.width; x++) if (Number(a.getAt(x, 0, 0)) === Number(id)) return x;
  return -1;
}
function _dtqAppend(a, cells) {
  const x = a.width;
  a.setSize(x + 1, Math.max(a.height, cells.length), Math.max(1, a.depth | 0));
  for (let y = 0; y < cells.length; y++) a.setAt(cells[y], x, y, 0);
  return x;
}
// Append each queued part this device type can use to the game's own part
// arrays as "Queued: <name>". The arrays were dumped first, so the capture's
// restore removes the rows again; nothing of it is ever saved.
function _dtqInject(cap, type) {
  const uses = _DTQ_USES[type];
  if (!uses) return;
  _dtqLoad();
  for (const it of _dtqState.items) {
    if (!_dtqIsPart(it) || uses[it.part] !== it.platform) continue;
    const name = _DTQ_PART_ARR[it.part][it.platform];
    const a = _dtqArr(name), sa = _dtqArr(name + "Series");
    if (!a || !sa) continue;
    for (const n of [name, name + "Series"]) if (!cap.arrays[n]) cap.arrays[n] = _dtqArrDump(n);
    let series = Number(it.record.chip[1]);
    if (it.record.series) {
      const cells = it.record.series.slice();
      cells[0] = sa.width;
      cells[1] = _dtqT("queued", { n: String(it.record.series[1] || "") });
      series = _dtqAppend(sa, cells);
      sa.setAt(series, series, 0, 0);
    }
    const label = _dtqT("queued", { n: it.name });
    const cells = it.record.chip.slice();
    cells[1] = series;
    cells[2] = label;
    const col0 = a.width;
    cells[0] = col0;
    _dtqAppend(a, cells);
    cap.ph.push({ id: it.id, part: it.part, platform: it.platform, name: it.name, col0: col0, series: series, chip: it.record.chip.slice() });
  }
}
// The placeholder this variant picked, if any (own-part type and both IDs).
function _dtqPicked(gv, cap) {
  const out = [];
  for (const ph of cap.ph || []) {
    const k = _DTQ_PICK[ph.part];
    if (Number(gv[k.typeVar]) !== k.own || Number(gv[k.series]) !== ph.series) continue;
    if (!k.ids.some((n) => n in gv && Number(gv[n]) === ph.col0)) continue;
    if (!out.some((u) => u.part === ph.part)) out.push(ph);
  }
  return out;
}
function _dtqCapVariant(gv) {
  const type = _dtqCap.type, R = _DTQ_READS[type];
  const k = Math.max(1, Math.min(3, Math.round(Number(gv.DeviceCountCreatingNow) || 1)));
  const vars = {};
  for (const n of R.vars.concat(_DTQ_FLOW_VARS)) if (n in gv) vars[n] = gv[n];
  const arrays = {};
  for (const n of R.arrays) {
    const d = _dtqArrDump(n);
    if (d) arrays[n] = d;
  }
  _dtqCap.count = Math.max(1, Math.min(3, Math.round(Number(gv.DevicesCount) || 1)));
  const v = { vars: vars, arrays: arrays };
  const picked = _dtqPicked(gv, _dtqCap);
  if (picked.length) v.part = Object.assign({}, picked[0]);
  if (picked.length > 1) v.part2 = Object.assign({}, picked[1]);
  if (_dtqCap.os && Number(gv.OperationSystem) === 0) {
    const os = _dtqCap.os;
    v.os = { id: os.id, part: "OS", platform: os.platform, name: os.name };
  }
  _dtqCap.variants[k - 1] = v;
  return k;
}
// ── "Start from" a queued device (template patch hook) ──
// Where a queued part picked by a variant is listed right now: its real
// record once made, else this capture's "Queued:" row, else nowhere.
function _dtqPartNow(u) {
  if (u.real && _dtqPartRow(u) !== null) return { col0: Math.round(Number(u.real.row)), series: Math.round(Number(u.real.series)) };
  const ph = _dtqCap && (_dtqCap.ph || []).find((p) => p.id === u.id);
  return ph ? { col0: ph.col0, series: ph.series } : null;
}
// Queued devices of a type, newest first, one source per batch variant, with
// copies of what <Type>AddToArray would read. Part IDs are moved to where the
// part is listed now; a part listed nowhere is left out and named in `lost`.
function _dtqTemplates(type) {
  _dtqLoad();
  const out = [];
  for (let j = _dtqState.items.length - 1; j >= 0; j--) {
    const it = _dtqState.items[j];
    if (_dtqIsPart(it) || it.type !== type) continue;
    it.variants.forEach((v, i) => {
      const vars = JSON.parse(JSON.stringify(v.vars)), lost = [];
      for (const u of [v.part, v.part2]) {
        if (!u || !_DTQ_PICK[u.part]) continue;
        const k = _DTQ_PICK[u.part], now = _dtqPartNow(u);
        if (now) {
          for (const n of k.ids) if (n in vars && Number(vars[n]) === u.col0) vars[n] = now.col0;
          vars[k.series] = now.series;
        } else {
          for (const n of k.ids.concat([k.series, k.typeVar])) delete vars[n];
          lost.push(k.series);
        }
      }
      const name = it.names[i] || _dtqTypeLabel(type);
      out.push({ key: "q:" + it.id + ":" + i, k: i, count: it.count, name: name, label: _dtqT("queued", { n: name }),
        vars: vars, arrays: JSON.parse(JSON.stringify(v.arrays || {})), lost: lost });
    });
  }
  return out;
}
// ── Part capture: the CPU / GPU editor while busy ──
function _dtqPartArrays() {
  const out = [];
  for (const part in _DTQ_PART_ARR) for (const pl in _DTQ_PART_ARR[part]) {
    const n = _DTQ_PART_ARR[part][pl];
    out.push(n, n + "Series", n + "Earnings");
  }
  return out;
}
function _dtqPartCapBegin(gv, part) {
  if (!_dtqBase) {
    console.warn("[Queue] busy part without an office snapshot; not queued");
    return false;
  }
  const arrays = {};
  for (const n of _dtqPartArrays()) {
    const d = _dtqArrDump(n);
    if (d) arrays[n] = d;
  }
  _dtqCap = { kind: "part", part: part, base: _dtqBase, arrays: arrays, vars: null, platform: "" };
  return true;
}
// Before CPU/GPU LOADING starts: what its AddToArray will read.
function _dtqPartCapVars(gv) {
  const cap = _dtqCap, vars = {};
  for (const n of _DTQ_PART_READS[cap.part].concat(["DeviceType", "DeviceName", "DevicePrice", "DeviceCostPrice"])) {
    if (n in gv && !_DTQ_LIVE.test(n)) vars[n] = gv[n];
  }
  cap.vars = vars;
  cap.platform = String(gv.DeviceType || (cap.part === "GPU" ? "LAPTOP" : ""));
}
// After CPU/GPU LOADING started: the game has pushed its record. Copy it, put
// every array and global back (device A keeps the development slot) and leave.
function _dtqPartCapFinish(gv) {
  const cap = _dtqCap;
  _dtqCap = null;
  const name = (_DTQ_PART_ARR[cap.part] || {})[cap.platform];
  const a = name && _dtqArr(name), sa = name && _dtqArr(name + "Series");
  const before = name && cap.arrays[name], sBefore = name && cap.arrays[name + "Series"];
  let entry = null;
  const x = a && before && a.width > before.w ? _dtqNewCol(a, before) : -1;
  if (x >= 0 && cap.vars) {
    const record = { chip: _dtqColumn(a, x), series: null };
    const sx = sa && sBefore && sa.width > sBefore.w ? _dtqNewCol(sa, sBefore) : -1;
    if (sx >= 0) record.series = _dtqColumn(sa, sx);
    entry = _dtqNormalizePart({ id: _dtqNewId(), kind: "part", part: cap.part, platform: cap.platform,
      name: cap.vars.DeviceName, vars: cap.vars, record: record });
  } else {
    console.warn("[Queue] part capture saw no new record; not queued", cap.part, cap.platform);
  }
  _dtqCapRestore(gv, cap);
  if (entry) {
    _dtqLoad();
    _dtqState.items.push(entry);
    _dtqSave();
  }
  setTimeout(() => {
    gv.LastClass = _DTQ_PART_LOADING[cap.part];
    gv.class = "GAMEPLAY";
    // Again at the move: on a slow frame rooms.js settles the view (2 s) while LOADING is still on screen.
    _dtqRoomView(gv, cap.base);
    globalThis.runtime.goToLayout(cap.base.layout);
    if (entry) {
      const n = _dtqState.items.length;
      setTimeout(() => _dtUi.toast(_dtqT("added", { n: n })), 700);
    }
  }, 300);
}
// Put back every global the create screens changed, except the calendar and
// the economy, and the arrays AddToArray reads. Device A's state is exactly as
// the player left it in the office.
function _dtqCapRestore(gv, cap) {
  const base = cap.base.vars;
  for (const k in base) {
    if (_DTQ_LIVE.test(k)) continue;
    if (gv[k] !== base[k]) gv[k] = base[k];
  }
  for (const n in cap.arrays) _dtqArrLoad(n, cap.arrays[n]);
  _dtqRoomView(gv, cap.base);
}
// A base taken while another room was only viewed holds the view's OfficeType BOSS, and the create
// screens dropped the view: restored as is, the game sat in its boss state with no view, and the
// pipeline took the live device for released (it lost its room). Put the view back.
// Called again right before the move back to that room: restored while the game enters another office
// (Esc to the boss office, OS finish), rooms.js drops the view at that layout start and the room came
// back as if live (the real office's controls, its next-stage button, in the viewed room).
function _dtqRoomView(gv, base) {
  const v = base && base.view, r = globalThis._dtRooms;
  if (!v) return;
  if (r && r.resume && base.layout === v.layout) r.resume(v);
  else gv.OfficeType = v.real;
}
function _dtqCapAbandon(gv) {
  const cap = _dtqCap;
  _dtqCap = null;
  if (cap) _dtqCapRestore(gv, cap);
}
// Runs a moment after LOADING EDITOR started with AddToArray blocked.
function _dtqCapContinue() {
  const gv = _dtqGv(), cap = _dtqCap;
  if (!gv || !cap || _dtUi.layoutName() !== _DTQ_LOADING) return;
  const k = cap.variants.length;
  if (k < cap.count) {
    // LOADING EDITOR's own loop to the next variant's NAME screen.
    gv.DeviceType = cap.type;
    gv.LastClass = _DTQ_LOADING;
    gv.class = _DEVICES[cap.type].nameClass;
    globalThis.runtime.goToLayout(_DTQ_NAME_LAYOUT[cap.type]);
    return;
  }
  const entry = _dtqNormalizeItem({ id: _dtqNewId(), type: cap.type, count: cap.count, variants: cap.variants });
  _dtqCap = null;
  _dtqCapRestore(gv, cap);
  if (entry) {
    _dtqLoad();
    _dtqState.items.push(entry);
    _dtqSave();
  } else {
    console.warn("[Queue] capture incomplete, not queued", cap.count, cap.variants.length);
  }
  gv.LastClass = _DTQ_LOADING;
  gv.class = "GAMEPLAY";
  globalThis.runtime.goToLayout(cap.base.layout);
  if (entry) {
    const n = _dtqState.items.length;
    setTimeout(() => _dtUi.toast(_dtqAddedText(entry, n)), 700);
  }
}
// ── Replay: the game's own LOADING EDITOR with the stored values ──
function _dtqApplyVariant(gv, entry, i) {
  const v = entry.variants[i];
  for (const n in v.vars) {
    if (n === "class" || n === "LastClass" || n === "CreateDevicesUI") continue;
    gv[n] = v.vars[n];
  }
  for (const n in v.arrays) _dtqArrLoad(n, v.arrays[n]);
  for (const u of [v.part, v.part2]) if (u) _dtqSwapPart(gv, entry, u);
  if (v.os) _dtqOsApply(gv, entry);
  gv.DeviceType = entry.type;
  gv.DevicesCount = entry.count;
  gv.DeviceCountCreatingNow = i + 1;
  gv.LastClass = "EDITOR PRICE PAGE";
  gv.class = _DTQ_LOADING;
}
// Placeholder IDs -> the made part's real record, then the game's own stat
// copy where it has one for this list (smartphone/tablet CPU). The other
// lists' stat globals were copied by the game from the queued record, which
// _dtqReason has checked equals the real one column by column.
function _dtqSwapPart(gv, entry, u) {
  const k = _DTQ_PICK[u.part], col = _dtqPartRow(u);
  if (col === null) throw new Error("queued part has no matching record");
  const row = Math.round(Number(u.real.row)), series = Math.round(Number(u.real.series));
  for (const n of k.ids) if (n in gv && Number(gv[n]) === u.col0) gv[n] = row;
  gv[k.series] = series;
  if (u.part !== "CPU" || u.platform !== "SMARTPHONE") return;
  const rt = globalThis.runtime;
  if ("function" != typeof globalThis.buildMyCpuList || "function" != typeof globalThis.applyMyCpuSpecs) return;
  const a = _dtqArr(_DTQ_PART_ARR.CPU.SMARTPHONE), sa = _dtqArr(_DTQ_PART_ARR.CPU.SMARTPHONE + "Series");
  let sPos = -1, cPos = 0;
  for (let x = 0; x < sa.width; x++) if (Number(sa.getAt(x, 0, 0)) === series) { sPos = x; break; }
  for (let x = 0; x < col; x++) if (Number(a.getAt(x, 1, 0)) === series) cPos++;
  const keep = {};
  for (const n of ["Processor", "ProcessorSeries", "UseMyProcessor"]) keep[n] = gv[n];
  gv.Processor = sPos + 1;
  gv.ProcessorSeries = cPos + 1;
  gv.UseMyProcessor = "ON";
  globalThis.buildMyCpuList(rt, "SMARTPHONE");
  globalThis.applyMyCpuSpecs(rt, "SMARTPHONE");
  for (const n in keep) if (keep[n] !== undefined) gv[n] = keep[n];
  if (Number(gv.ProcessorSeriesID) !== row || Number(gv.ProcessorID) !== series) {
    throw new Error("the game's CPU list did not pick the made CPU");
  }
}
// ── Replay of a part: the game's own CPU/GPU LOADING with the stored values ──
function _dtqBeginPart(entry) {
  const gv = _dtqGv();
  if (!gv) return false;
  _dtqArmed = false;
  _dtqRetryAt = 0;
  const name = _DTQ_PART_ARR[entry.part][entry.platform];
  _dtqReplay = { id: entry.id, part: true, before: _dtqArrDump(name), at: Date.now() };
  try {
    for (const n in entry.vars) if (!_DTQ_LIVE.test(n)) gv[n] = entry.vars[n];
    gv.DeviceType = entry.platform;
    gv.LastClass = "GAMEPLAY";
    gv.class = _DTQ_PART_LOADING[entry.part];
    globalThis.runtime.goToLayout(_DTQ_PART_LOADING[entry.part]);
    return true;
  } catch (e) {
    console.warn("[Queue] part start failed:", e);
    _dtqReplay = null;
    return false;
  }
}
// CPU/GPU LOADING has pushed the real record: hand its IDs to every device
// entry that picked this part.
function _dtqPartMade(entry) {
  const a = _dtqArr(_DTQ_PART_ARR[entry.part][entry.platform]);
  const r = _dtqReplay;
  if (!a || !r || !r.before || a.width <= r.before.w) return false;
  const x = _dtqNewCol(a, r.before);
  if (x < 0) return false;
  const real = { row: Number(a.getAt(x, 0, 0)), series: Number(a.getAt(x, 1, 0)) };
  r.made = true;
  for (const it of _dtqState.items) {
    for (const v of it.variants || []) for (const u of [v.part, v.part2]) if (u && u.id === entry.id) u.real = real;
  }
  _dtqSave();
  return true;
}
function _dtqBegin(entry) {
  const gv = _dtqGv();
  if (!gv || !_DEVICES[entry.type]) return false;
  _dtqArmed = false;
  _dtqRetryAt = 0;
  _dtqReplay = { id: entry.id, k: 1, at: Date.now() };
  try {
    _dtqApplyVariant(gv, entry, 0);
    try {
      _markBatchStart();
    } catch (e) {}
    globalThis.runtime.goToLayout(_DTQ_LOADING);
    return true;
  } catch (e) {
    console.warn("[Queue] start failed:", e);
    _dtqReplay = null;
    return false;
  }
}
// LOADING EDITOR looped to NAME for the next variant: the NAME bootstrap has
// already counted it (DeviceCountCreatingNow + 1). Go straight back with the
// stored values for that variant.
function _dtqReplayNext() {
  const gv = _dtqGv(), r = _dtqReplay;
  if (!gv || !r) return;
  const entry = _dtqFind(r.id);
  const k = Math.round(Number(gv.DeviceCountCreatingNow) || 0);
  if (!entry || k < 2 || k > entry.count) {
    console.warn("[Queue] replay lost its place", k);
    _dtqReplay = null;
    return;
  }
  r.k = k;
  _dtqApplyVariant(gv, entry, k - 1);
  globalThis.runtime.goToLayout(_DTQ_LOADING);
}
function _dtqReplayDone(gv) {
  const r = _dtqReplay;
  _dtqReplay = null;
  const entry = r && _dtqFind(r.id);
  if (!entry) return;
  if (r.part) {
    if (r.made && _dtqBusy(gv)) {
      _dtqRemove(entry.id);
      _dtUi.toast(_dtqT("started", { n: _dtqLabel(entry) }), _dtqLabel(entry));
    } else {
      console.warn("[Queue] part replay ended without a new record; entry kept");
    }
    return;
  }
  let pushed = false;
  try {
    pushed = "function" == typeof _batchPushed && _batchPushed();
  } catch (e) {}
  if (pushed && _dtqBusy(gv)) {
    _dtqRemove(entry.id);
    _dtUi.toast(_dtqT("started", { n: entry.names[0] || _dtqTypeLabel(entry.type) }), entry.names[0]);
  } else {
    console.warn("[Queue] replay ended without a new device; entry kept");
  }
}
// ── Own OS ──
// The MY OS screens (117-125) run as normal while busy. The commit is NAME
// for a new OS (119:155-158, MyOSName_OFF, free) and the FINISH click on 123
// for an upgrade (Budget -= MyOSUpdatePrice, MyOSFinish_OFF); both set
// DeviceTypeCreatingNow "OS <platform>" and then leave for the office. At that layout start the
// queue copies what the screens changed (globals and the platform's
// ArrayMyOS_<p> / ArrayMyOS_<p>Earnings), puts everything back, refunds the
// price and returns to the work office. Replay writes the same changes back
// and charges the price, as if the player had clicked FINISH then.
//   os: {id,kind:"part",part:"OS",platform,name,price,layout,vars,tech:{before,after},earn:{before,after,rows,dw}}
// In a later device editor, if no own OS exists for that platform, the
// locked "My OS" slot is opened only while its page is shown (tech cell
// (0,0) = 1) and its label reads "Queued: <name>". OperationSystem_Text and
// _Version_Text are never touched; replay sets them from the made OS.
var _DTQ_OS_MENU = "MY OS MENU";
var _DTQ_OS_FINISH = "MY OS FINISH";
// MyOSDevice -> the game's arrays for that platform.
var _DTQ_OS_ARR = { SMARTPHONES: "ArrayMyOS_Smartphones", LAPTOPS: "ArrayMyOS_Laptops", WATCHES: "ArrayMyOS_Watches", TV: "ArrayMyOS_TV" };
// Every array the OS screens write (117-125).
var _DTQ_OS_TOUCH = ["ArrayMyOsChoose", "ArrayMyOS_FinishText", "ArrayDesignOS_Mobile", "ArrayDesignOS_PC", "ArrayDesignOS_Watches",
  "ArrayDesignOS_TV", "ArrayDesignOS_Temp", "ArrayDesignOS_Temp_Mobile", "ArrayDesignOS_Temp_Watches", "ArrayDesignOS_Temp_TV"];
// Device type -> OS page, the slot's gate platform, its label Text (or
// NinePatch; the Text instance is picked at runtime) and the own branch's
// text source (014:575-579, 028:536-537 reads the smartphone row, TV sets "").
var _DTQ_OS_PAGE = {
  SMARTPHONE: { page: "SMARTPHONE PAGE 7", platform: "SMARTPHONES", uids: [1157, 1156], text: "SMARTPHONES" },
  TABLET: { page: "TABLET PAGE 7", platform: "SMARTPHONES", uids: [2224, 2221], text: "SMARTPHONES" },
  LAPTOP: { page: "LAPTOP PAGE 7", platform: "LAPTOPS", uids: [3035, 3024], text: "LAPTOPS" },
  WATCHES: { page: "WATCHES PAGE 6", platform: "WATCHES", uids: [3621, 3619], text: "WATCHES" },
  TV: { page: "TV PAGE 6", platform: "TV", uids: [4559, 4551], text: "" },
};
var _DTQ_OS_SKIP = /^(class|LastClass|CreateDevicesUI)$/;
// What MyOSFinish_OFF sets, stored even when device A had the same value.
var _DTQ_OS_SET = /^(DeviceTypeCreatingNow|BubblesDesign|BubblesTechnology|BubblesBugs|OfficeType|MyOS[A-Za-z_]*)$/;
function _dtqNormalizeOs(o) {
  const platform = String(o.platform || "");
  if (!_DTQ_OS_ARR[platform] || !o.vars || "object" != typeof o.vars || !o.tech || !o.earn) return null;
  if (!o.tech.after || !o.earn.after || !Array.isArray(o.earn.rows)) return null;
  return { id: String(o.id || _dtqNewId()), kind: "part", part: "OS", platform: platform, name: String(o.name || "").slice(0, 40),
    price: Number(o.price) || 0, layout: String(o.layout || ""), vars: o.vars, tech: o.tech, earn: o.earn };
}
function _dtqOsOwned(platform) {
  const a = _dtqArr(_DTQ_OS_ARR[platform]);
  return !!a && a.width > 0 && Number(a.getAt(0, 0, 0)) > 0;
}
// The game never clears DeviceTypeCreatingNow after an OS. The last stage
// click (276:2896-2907) queues "OS RELEASED" and goes to the boss office; its
// OK (279:92-105) stamps the release day on earnings x=0 col 8 (-999 until
// then, 119:384 / 123:322). From that stamp on the slot is free; nothing may
// start before it, or the stamp (which reads DeviceTypeCreatingNow) is lost.
function _dtqOsReleased(type) {
  const m = /^OS (\w+)$/.exec(type), n = m && _DTQ_OS_ARR[m[1]];
  const e = n && _dtqArr(n + "Earnings");
  return !!e && e.width > 0 && Number(e.getAt(0, 8, 0)) !== -999;
}
function _dtqOsQueued(platform) {
  _dtqLoad();
  return _dtqState.items.find((it) => _dtqIsPart(it) && it.part === "OS" && it.platform === platform) || null;
}
function _dtqDumpEq(a, b) {
  return !!a && !!b && a.w === b.w && a.h === b.h && a.d === b.d && a.cells.every((v, i) => String(v) === String(b.cells[i]));
}
function _dtqDumpCol(d, x) {
  return d.cells.slice(x * d.h * d.d, (x + 1) * d.h * d.d);
}
// The rows the screens pushed at the front: after = rows ++ before (the end
// may be cut by the game's six-version limit).
function _dtqFrontRows(before, after) {
  for (let k = 0; k <= after.w; k++) {
    let ok = before.h === after.h && before.d === after.d;
    for (let x = k; ok && x < after.w; x++) ok = x - k < before.w && _dtqDumpCol(after, x).every((v, i) => String(v) === String(_dtqDumpCol(before, x - k)[i]));
    if (ok) {
      const rows = [];
      for (let x = 0; x < k; x++) rows.push(_dtqDumpCol(after, x));
      return rows;
    }
  }
  return null;
}
function _dtqOsCapBegin(gv) {
  if (!_dtqBase) {
    console.warn("[Queue] busy OS without an office snapshot; not queued");
    return false;
  }
  const arrays = {};
  for (const p in _DTQ_OS_ARR) for (const n of [_DTQ_OS_ARR[p], _DTQ_OS_ARR[p] + "Earnings"]) {
    const d = _dtqArrDump(n);
    if (d) arrays[n] = d;
  }
  for (const n of _DTQ_OS_TOUCH) {
    const d = _dtqArrDump(n);
    if (d) arrays[n] = d;
  }
  _dtqCap = { kind: "os", base: _dtqBase, arrays: arrays };
  return true;
}
// The game left NAME (create) or FINISH (upgrade): copy, undo, refund, go back.
function _dtqOsCapFinish(gv, lay) {
  const cap = _dtqCap;
  _dtqCap = null;
  const platform = String(gv.MyOSDevice || ""), name = _DTQ_OS_ARR[platform];
  const price = String(gv.LastClass || "") === _DTQ_OS_FINISH ? Number(gv.MyOSUpdatePrice) || 0 : 0;
  let entry = null;
  if (name && cap.arrays[name] && cap.arrays[name + "Earnings"]) {
    const vars = {}, base = cap.base.vars;
    for (const k in gv) {
      const v = gv[k];
      if (_DTQ_LIVE.test(k) || _DTQ_OS_SKIP.test(k) || !("number" == typeof v || "string" == typeof v || "boolean" == typeof v)) continue;
      if (v !== base[k] || _DTQ_OS_SET.test(k)) vars[k] = v;
    }
    const eb = cap.arrays[name + "Earnings"], ea = _dtqArrDump(name + "Earnings");
    const rows = _dtqFrontRows(eb, ea);
    if (rows && rows.length) {
      entry = _dtqNormalizeOs({ id: _dtqNewId(), platform: platform, name: String(gv.MyOS_Name || ""), price: price, layout: lay, vars: vars,
        tech: { before: cap.arrays[name], after: _dtqArrDump(name) },
        earn: { before: eb, after: ea, rows: rows, dw: ea.w - eb.w } });
    }
  }
  if (!entry) console.warn("[Queue] OS capture saw no new OS version; not queued", platform);
  _dtqCapRestore(gv, cap);
  // The FINISH click took the price off the live Budget; nothing is charged.
  gv.Budget = (Number(gv.Budget) || 0) + price;
  if (entry) {
    _dtqLoad();
    _dtqState.items.push(entry);
    _dtqSave();
  }
  setTimeout(() => {
    gv.LastClass = String(cap.base.vars.LastClass || "GAMEPLAY");
    gv.class = "GAMEPLAY";
    if (cap.base.layout && _dtUi.layoutName() !== cap.base.layout) {
      _dtqRoomView(gv, cap.base);
      globalThis.runtime.goToLayout(cap.base.layout);
    }
    if (entry) {
      const n = _dtqState.items.length;
      setTimeout(() => _dtUi.toast(_dtqT("added", { n: n })), 700);
    }
  }, 300);
}
// A busy pick: the queue's own (its + in the live room), or the picker opened from a viewed room's +
// (rooms.js pickFrom) while something is in development; that one returns to the viewed room (the
// base is frozen while it is open). Without it the OS, CPU/GPU and software tiles ran for real.
function _dtqBusyPick(gv) {
  if (_dtqPick) return _dtqPick;
  const r = globalThis._dtRooms;
  return r && r.pickFrom && r.pickFrom() && _dtqBase && _dtqBusy(gv) ? { layout: _dtqBase.layout } : null;
}
function _dtqOsBaseDev() {
  return String(_dtqCap && _dtqCap.base.vars.DeviceTypeCreatingNow || "");
}
// Before-start hook while the OS screens are captured. True when handled.
function _dtqOsLayoutStart(gv, lay) {
  if (lay === _DTQ_OS_MENU && !_dtqCap && _dtqBusy(gv) && _dtqBusyPick(gv)) {
    _dtqPick = null;
    _dtqOsCapBegin(gv);
    return true;
  }
  if (!_dtqCap || _dtqCap.kind !== "os") return false;
  if (lay === "GAMEPLAY" || / OFFICE( \d+)?$/.test(lay) || lay === "MENU" || lay === "LOADING GAME") {
    // Committed: CREATE OS starts at NAME (119:155-158, free), UPGRADE OS at
    // the FINISH click (pays); both set DeviceTypeCreatingNow "OS <platform>".
    if (/^OS /.test(String(gv.DeviceTypeCreatingNow || "")) && gv.DeviceTypeCreatingNow !== _dtqOsBaseDev() && lay !== "MENU" && lay !== "LOADING GAME") {
      _dtqOsCapFinish(gv, lay);
      return true;
    }
    const base = _dtqCap.base, back = base.layout;
    _dtqCapAbandon(gv);
    if (back && lay !== back) setTimeout(() => {
      _dtqRoomView(gv, base);
      gv.class = "GAMEPLAY";
      globalThis.runtime.goToLayout(back);
    }, 0);
  }
  return true;
}
// ── Own OS in a device editor ──
function _dtqOsInject(cap, type) {
  const pg = _DTQ_OS_PAGE[type];
  if (!pg || _dtqOsOwned(pg.platform)) return;
  const it = _dtqOsQueued(pg.platform);
  if (!it) return;
  const n = _DTQ_OS_ARR[pg.platform];
  if (!cap.arrays[n]) cap.arrays[n] = _dtqArrDump(n);
  cap.os = { id: it.id, part: "OS", platform: pg.platform, name: it.name, page: pg.page, on: false };
}
// The slot opens only while its page is shown; every other layout start
// (and the capture's restore) puts the tech cell back.
function _dtqOsPage(gv, lay) {
  const cap = _dtqCap, os = cap && cap.os;
  if (!os) return;
  const a = _dtqArr(_DTQ_OS_ARR[os.platform]), d = cap.arrays[_DTQ_OS_ARR[os.platform]];
  if (!a || !d) return;
  if (lay === os.page && !os.on) {
    if (a.width < 1) a.setSize(35, Math.max(1, a.height | 0), Math.max(1, a.depth | 0));
    a.setAt(1, 0, 0, 0);
    os.on = true;
  } else if (lay !== os.page && os.on) {
    _dtqArrLoad(_DTQ_OS_ARR[os.platform], d);
    os.on = false;
  }
}
// The page drew "<earnings name> <version>" for the opened slot; show the
// queued OS instead (the label only, never the game's text globals).
function _dtqOsLabel() {
  const os = _dtqCap && _dtqCap.os;
  if (!os || !os.on || _dtUi.layoutName() !== os.page) return;
  const pg = _DTQ_OS_PAGE[_dtqCap.type], rt = globalThis.runtime;
  if (!pg || !rt || "function" != typeof rt.getInstanceByUid) return;
  const label = _dtqT("queued", { n: os.name });
  for (const uid of pg.uids) {
    try {
      const t = rt.getInstanceByUid(uid);
      if (t && "string" == typeof t.text && t.text !== label) t.text = label;
    } catch (e) {}
  }
}
// Replay of a queued OS: the FINISH click's changes, written into today's arrays.
function _dtqBeginOs(entry) {
  const gv = _dtqGv();
  if (!gv) return false;
  _dtqArmed = false;
  _dtqRetryAt = 0;
  const name = _DTQ_OS_ARR[entry.platform];
  const ta = _dtqArr(name), ea = _dtqArr(name + "Earnings");
  if (!ta || !ea) return false;
  try {
    const tNow = _dtqArrDump(name);
    if (_dtqDumpEq(tNow, entry.tech.before)) _dtqArrLoad(name, entry.tech.after);
    else {
      const t = entry.tech.after, w = Math.max(t.w, tNow.w);
      ta.setSize(w, Math.max(t.h, tNow.h), Math.max(1, t.d));
      for (let x = 0; x < t.w; x++) {
        const v = Number(t.cells[x * t.h * t.d]), o = Number(ta.getAt(x, 0, 0));
        ta.setAt(Number.isFinite(o) && o > v ? o : v, x, 0, 0);
      }
    }
    const eNow = _dtqArrDump(name + "Earnings");
    if (_dtqDumpEq(eNow, entry.earn.before)) _dtqArrLoad(name + "Earnings", entry.earn.after);
    else {
      const rows = entry.earn.rows, k = rows.length, h = Math.max(eNow.h, rows[0].length);
      const w = Math.max(1, Math.min(eNow.w + k, eNow.w + entry.earn.dw));
      ea.setSize(w, h, 1);
      for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
        ea.setAt(x < k ? rows[x][y] ?? 0 : eNow.cells[(x - k) * eNow.h * eNow.d + y * eNow.d] ?? 0, x, y, 0);
      }
    }
    for (const n in entry.vars) gv[n] = entry.vars[n];
    if ("function" == typeof globalThis.setBubblesForDevelopment) globalThis.setBubblesForDevelopment(globalThis.runtime);
    gv.Budget = (Number(gv.Budget) || 0) - entry.price;
  } catch (e) {
    console.warn("[Queue] OS start failed:", e);
    return false;
  }
  for (const it of _dtqState.items) for (const v of it.variants || []) if (v.os && v.os.id === entry.id) v.os.real = { os: true };
  _dtqRemove(entry.id);
  gv.LastClass = entry.price ? _DTQ_OS_FINISH : "MY OS NAME";
  gv.class = "GAMEPLAY";
  if (entry.layout && entry.layout !== _dtUi.layoutName()) globalThis.runtime.goToLayout(entry.layout);
  _dtUi.toast(_dtqT("started", { n: _dtqLabel(entry) }), _dtqLabel(entry));
  return true;
}
// A device that used "Queued: <os>": the own branch of its OS page, read now.
function _dtqOsApply(gv, entry) {
  const pg = _DTQ_OS_PAGE[entry.type];
  if (!pg || !_dtqOsOwned(pg.platform)) throw new Error("queued OS is not made");
  gv.OperationSystem = 0;
  if (pg.text) {
    const e = _dtqArr(_DTQ_OS_ARR[pg.text] + "Earnings");
    gv.OperationSystem_Text = e.getAt(0, 0, 0);
    gv.OperationSystemVersion_Text = e.getAt(0, 1, 0);
  } else gv.OperationSystem_Text = "";
  gv.OSLicenseOpened = true;
}
// ── Layout hooks ──
function _dtqOnLayoutStart(ev) {
  try {
    const gv = _dtqGv();
    if (!gv) return;
    const lay = String(ev && ev.layout && ev.layout.name || _dtUi.layoutName());
    if (_dtqReplay) return;
    if (_dtqOsLayoutStart(gv, lay)) return;
    _dtqOsPage(gv, lay);
    if (_DTQ_PART_MENU[lay] && !_dtqCap && _dtqBusy(gv) && _dtqBusyPick(gv)) {
      _dtqPick = null;
      _dtqPartCapBegin(gv, _DTQ_PART_MENU[lay]);
      return;
    }
    if (_dtqCap && _dtqCap.kind === "part") {
      if (lay === _DTQ_PART_LOADING[_dtqCap.part]) {
        // Let the game's own AddToArray run; _dtqPartCapFinish undoes it.
        _dtqPartCapVars(gv);
        return;
      }
      if (lay === "GAMEPLAY" || / OFFICE( \d+)?$/.test(lay) || lay === "MENU" || lay === "LOADING GAME") {
        const base = _dtqCap.base, back = base.layout;
        _dtqCapAbandon(gv);
        if (back && lay !== back) setTimeout(() => {
          _dtqRoomView(gv, base);
          gv.class = "GAMEPLAY";
          globalThis.runtime.goToLayout(back);
        }, 0);
      }
      return;
    }
    const pick = _DTQ_PART_MENUS.indexOf(lay) >= 0 ? _dtqBusyPick(gv) : null;
    if (pick) {
      _dtqPick = null;
      setTimeout(() => {
        if (_dtqBase) for (const k in _dtqBase.vars) if (!_DTQ_LIVE.test(k) && gv[k] !== _dtqBase.vars[k]) gv[k] = _dtqBase.vars[k];
        if (_dtqBase && pick.layout === _dtqBase.layout) _dtqRoomView(gv, _dtqBase);
        gv.CreateDevicesUI = "OFF";
        gv.class = "GAMEPLAY";
        globalThis.runtime.goToLayout(pick.layout);
        setTimeout(() => _dtUi.toast(_dtqT("parts")), 700);
      }, 0);
      return;
    }
    const nameType = _dtqNameLayoutType(lay);
    if (nameType && !_dtqCap && String(gv.LastClass || "") === "GAMEPLAY" && _dtqBusy(gv) &&
        _dtqBase && _dtqBusy(_dtqBase.vars, _dtqBase.view ? _dtqBase.view.real : _dtqBase.vars.OfficeType)) {
      _dtqCapBegin(gv, nameType);
      _dtqPick = null;
      return;
    }
    if (_dtqCap && lay === _DTQ_LOADING) {
      _dtqCapVariant(gv);
      // No AddToArray branch matches: the game creates nothing here.
      gv.DeviceType = "";
      setTimeout(_dtqCapContinue, 900);
      return;
    }
    if (_dtqCap && (lay === "GAMEPLAY" || / OFFICE( \d+)?$/.test(lay) || lay === "MENU" || lay === "LOADING GAME")) {
      // The player backed out of the create screens: nothing to queue. Put
      // the work office back if the game returned to the boss office.
      const base = _dtqCap.base, back = base.layout;
      _dtqCapAbandon(gv);
      if (back && lay !== back) setTimeout(() => {
        _dtqRoomView(gv, base);
        gv.class = "GAMEPLAY";
        globalThis.runtime.goToLayout(back);
      }, 0);
    }
  } catch (e) {
    console.warn("[Queue] layout start:", e);
  }
}
function _dtqAfterLayoutStart(ev) {
  try {
    const gv = _dtqGv();
    const lay = String(ev && ev.layout && ev.layout.name || _dtUi.layoutName());
    if (gv && _dtqPick && lay === _DTQ_BOSS && !_dtqCap) {
      setTimeout(() => {
        if (!_dtqPick || _dtUi.layoutName() !== _DTQ_BOSS) return;
        gv.CreateDevicesUI = "WAIT";
        globalThis.runtime.callFunction("CreateDevices_ON");
      }, 150);
      return;
    }
    if (gv && _dtqCap && _dtqCap.os && lay === _dtqCap.os.page) setTimeout(_dtqOsLabel, 50);
    if (gv && _dtqCap && _dtqCap.kind === "part" && _dtqCap.vars && lay === _DTQ_PART_LOADING[_dtqCap.part]) {
      _dtqPartCapFinish(gv);
      return;
    }
    if (!gv || !_dtqReplay) return;
    if (_dtqReplay.part) {
      const entry = _dtqFind(_dtqReplay.id);
      if (entry && lay === _DTQ_PART_LOADING[entry.part]) _dtqPartMade(entry);
      else _dtqReplayDone(gv);
      return;
    }
    if (_dtqNameLayoutType(lay) && String(gv.LastClass || "") === _DTQ_LOADING) {
      setTimeout(_dtqReplayNext, 50);
    } else if (lay !== _DTQ_LOADING && !_dtqNameLayoutType(lay)) {
      _dtqReplayDone(gv);
    }
  } catch (e) {
    console.warn("[Queue] after layout start:", e);
  }
}
// ── The create button while busy ──
// Every office layout has the create button (Sprite12 UID 7345), but 276
// GAMEPLAY only reacts to it with OfficeType=BOSS, which is never the case
// while something is in development, and the type tiles (Sprite20) exist only
// on the BOSS OFFICE layout. So the same click opens the game's picker drawn
// over the work office (rooms picker.js); without it, it takes the player to
// the boss office and opens the game's own picker there (Tap_Main,
// CreateDevicesUI WAIT, CreateDevices_ON). Closing it with the same button
// goes back to the work office; picking a type starts the normal create screens.
var _DTQ_CREATE_UID = 7345;
var _DTQ_BOSS = "BOSS OFFICE";
var _dtqPick = null;     // picker opened while busy: {layout} of the work office
function _dtqCreateButton() {
  try {
    const o = globalThis.runtime.objects.Sprite12;
    return o ? o.getAllInstances().find((i) => i.uid === _DTQ_CREATE_UID) || null : null;
  } catch (e) {
    return null;
  }
}
// In the work offices the same centre button is the game's "next stage"
// button once the stage's bubbles are used up (276 GAMEPLAY, Gradient_4/34/44
// clicks); the queue leaves it alone then.
function _dtqStageDone(gv) {
  const n = (k) => Number(gv[k]) || 0, r = n("BubbleResearch");
  const t = String(gv.OfficeType || "");
  if (t === "DESIGNER") return n("BubblesDesign") <= 0 && n("BubblesDesign") + r <= 0;
  if (t === "PROGRAMMER") return n("BubblesTechnology") <= 0 && n("BubblesBugs") <= 0 && n("BubblesTechnology") + n("BubblesBugs") + r <= 0;
  if (t === "ENGINEER") return n("BubblesEngineers") <= 0 && n("BubblesEngineers") + r <= 0;
  return true;
}
function _dtqHitCreate(ev) {
  const b = _dtqCreateButton();
  if (!b || !b.isVisible || !b.layer || !b.layer.isVisible) return false;
  const p = b.layer.cssPxToLayer(ev.clientX, ev.clientY);
  return !!b.containsPoint(p[0], p[1]);
}
function _dtqOnPointer(ev) {
  try {
    const gv = _dtqGv(), rt = globalThis.runtime;
    if (!gv || !rt || _dtqCap || _dtqReplay) return;
    if (String(gv.Assistant || "OFF") !== "OFF" || (_dtUi.isOpen && _dtUi.isOpen())) return;
    const lay = _dtUi.layoutName();
    if (_dtqPick) {
      // Second press on the boss-office button: close the picker, go back.
      if (lay !== _DTQ_BOSS || String(gv.CreateDevicesUI || "") !== "ON" || !_dtqHitCreate(ev)) return;
      const back = _dtqPick.layout;
      rt.callFunction("Tap_Main");
      setTimeout(() => {
        gv.CreateDevicesUI = "WAIT";
        rt.callFunction("CreateDevices_OFF");
        setTimeout(() => {
          _dtqPick = null;
          gv.CreateDevicesUI = "OFF";
          gv.class = "GAMEPLAY";
          rt.goToLayout(back);
        }, 350);
      }, 50);
      return;
    }
    // The game may already have handled the same click as "next stage" and
    // moved on (OfficeType and bubbles of the next stage), so the office as
    // it was before the click counts too.
    if (!_dtUi.onOffice() || String(gv.OfficeType || "") === "BOSS" || !_dtqBusy(gv) || _dtqStageDone(gv)) return;
    if (_dtqBase && _dtqStageDone(_dtqBase.vars)) return;
    if (String(gv.class || "") !== "GAMEPLAY" || String(gv.CreateDevicesUI || "OFF") !== "OFF") return;
    if (!_dtqBase || !_dtqHitCreate(ev)) return;
    // The game may handle its next-stage click first: judge by the office as
    // it was before this press (the last tick's snapshot).
    if (String(_dtqBase.vars.OfficeType || "") !== String(gv.OfficeType || "") || _dtqStageDone(_dtqBase.vars)) return;
    // The game's picker opens over this room (rooms picker.js, which hands a pick back through pick());
    // the boss office only without it.
    _dtqBase.layout = lay;
    if (globalThis._dtPicker && globalThis._dtPicker.open()) return;
    _dtqPick = { layout: lay };
    rt.callFunction("Tap_Main");
    gv.LastClass = "GAMEPLAY";
    rt.goToLayout(_DTQ_BOSS);
  } catch (e) {
    console.warn("[Queue] create button:", e);
  }
}
function _dtqWire() {
  if (_dtqWired) return;
  const rt = globalThis.runtime;
  if (!rt || "function" != typeof rt.addEventListener) return;
  try {
    rt.addEventListener("beforeanylayoutstart", _dtqOnLayoutStart);
    rt.addEventListener("afteranylayoutstart", _dtqAfterLayoutStart);
    rt.addEventListener("pointerdown", _dtqOnPointer);
    _dtqWired = true;
  } catch (e) {
    console.warn("[Queue] wire:", e);
  }
}
// ── Pump ──
function _dtqReadyNow() {
  const gv = _dtqGv();
  if (!gv || !_dtUi.onOffice()) return false;
  // Pipeline patch: it decides when the next entry may take the free room.
  if (globalThis._dtPipeHold && globalThis._dtPipeHold()) return false;
  if (String(gv.OfficeType || "") !== "BOSS") return false;
  if (String(gv.class || "") !== "GAMEPLAY") return false;
  if (_dtqBusy(gv)) return false;
  if (String(gv.Assistant || "OFF") !== "OFF") return false;
  if (String(gv.CreateDevicesUI || "OFF") !== "OFF") return false;
  if (Number(gv.GameplayPause || 0) !== 0) return false;
  if (_dtqCap || _dtqReplay) return false;
  if (_dtqStableTicks < 3) return false;
  if (_dtqLaunchPendingUntil > Date.now() || globalThis._dtLaunchPending === true) return false;
  return true;
}
function _dtqOpenNext() {
  _dtqLoad();
  if (_dtqState.paused || !_dtqState.items.length || !_dtqReadyNow()) return false;
  const entry = _dtqState.items[0];
  const why = _dtqReason(entry);
  if (why) {
    _dtqSkip(entry, why);
    return false;
  }
  // The office as it is now, so a start that fails half-way can be undone.
  const gv = _dtqGv(), keep = {};
  for (const k of _dtqVarsNames(gv)) keep[k] = gv[k];
  const ok = _dtqIsPart(entry) && entry.part === "OS" ? _dtqBeginOs(entry) : _dtqIsPart(entry) ? _dtqBeginPart(entry) : _dtqBegin(entry);
  if (!ok) for (const k in keep) if (gv[k] !== keep[k] && !_DTQ_LIVE.test(k)) gv[k] = keep[k];
  if (ok) {
    _dtqFailed = null;
    return true;
  }
  // A start that threw or bailed out: the entry stays, shows as blocked, and
  // is tried again after a while instead of leaving the queue silent.
  _dtqFailed = { id: entry.id, at: Date.now() };
  _dtqSkip(entry, "failed");
  _dtqRetryAt = Date.now() + _DTQ_RETRY_FAILED;
  return false;
}
// ── Build queue page ──
// A toolbar button (ui.js "toolbar pages") just left of the game's "+" opens
// a full page on the game's own Investing layout (purple swirl, the woman on
// the right) with its menu and 3D pie chart moved away: the agreed mockup
// shots/mock/s-pp-1.jpg. The game's "ESC Back" and Esc key close it.
var _DTQ_ICON = {
  up: '<path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>',
  down: '<path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>',
  remove: '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>',
  pause: '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  hourglass: '<path d="M6 2v6h.01L6 8.01 10 12l-4 4 .01.01H6V22h12v-5.99h-.01L18 16l-4-4 4-3.99-.01-.01H18V2H6z"/>',
  // Toolbar: an outlined glass with the sand below, open inside like the game's own toolbar icons.
  hourglassTb: '<path d="M18 22l-.01-6L14 12l3.99-4.01L18 2H6v6l4 4-4 3.99V22h12zM8 7.5V4h8v3.5l-4 4-4-4z"/>',
};
var _DTQ_PAGE_TEXT = {
  tb: { en: "BUILD QUEUE", ru: "ОЧЕРЕДЬ" },
  title: { en: "BUILD QUEUE", ru: "ОЧЕРЕДЬ" },
  sub: { en: "DEVICES WAITING TO BE MADE", ru: "УСТРОЙСТВА, ЖДУЩИЕ РАЗРАБОТКИ" },
  paused: { en: "Queue paused", ru: "Очередь на паузе" },
  pausedSub: { en: "Nothing new starts until you resume. The next one starts by itself when the office is free.", ru: "Ничего нового не начнётся, пока вы не продолжите. Следующее начнётся само, когда офис освободится." },
  running: { en: "Queue running", ru: "Очередь работает" },
  runningSub: { en: "The next one starts by itself when the office is free.", ru: "Следующее начнётся само, когда офис освободится." },
  empty: { en: "Nothing is waiting", ru: "Ничего не ждёт" },
  emptySub: { en: "Create a device, CPU, graphics card or operating system while something is in development and it waits here.", ru: "Создайте устройство, процессор, видеокарту или ОС во время другой разработки, и они будут ждать здесь." },
  versions1: { en: "1 version", ru: "1 версия" },
  versionsN: { en: "{n} versions", ru: "{n} версии" },
  waitsFor: { en: "waits for {n}", ru: "ждёт {n}" },
  next: { en: "Next up", ru: "Следующее" },
  waiting: { en: "Waiting", ru: "Ждёт" },
  st_partwait: { en: "Waiting for a part", ru: "Ждёт компонент" },
  st_partgone: { en: "Part missing", ru: "Нет компонента" },
  st_partdiff: { en: "Part changed", ru: "Компонент изменён" },
  st_research: { en: "Needs research", ru: "Нужны исследования" },
  st_type: { en: "Not unlocked", ru: "Не открыто" },
  st_none: { en: "Unavailable", ru: "Недоступно" },
  st_money: { en: "Waiting for money", ru: "Ждёт денег" },
  st_failed: { en: "Couldn't start", ru: "Не удалось начать" },
  t1: { en: "Budget", ru: "Бюджет" },
  t2: { en: "Standard", ru: "Стандарт" },
  t3: { en: "Flagman", ru: "Флагман" },
  rmTitle: { en: "Remove from queue", ru: "Удалить из очереди" },
  rmText: { en: "Remove {n} from the build queue? It has not been made yet, so nothing is lost.", ru: "Удалить {n} из очереди разработки? Оно ещё не создано, поэтому ничего не потеряется." },
  rmYes: { en: "Remove", ru: "Удалить" },
  rmNo: { en: "Keep", ru: "Оставить" },
  info: { en: "Devices, CPUs, graphics cards and operating systems you create while something is in development wait here. The next one starts by itself when the current one is finished. A device never starts before a part it uses. Point at a row to move it up or down or remove it.", ru: "Устройства, процессоры, видеокарты и операционные системы, созданные во время другой разработки, ждут здесь. Следующее начнётся само, когда текущее будет готово. Устройство не начнётся раньше компонента, который оно использует. Наведите на строку, чтобы переместить или удалить её." },
};
var _DTQ_DEV_ICON = {
  SMARTPHONE: "smartphone", LAPTOP: "laptop", TABLET: "tablet", WATCHES: "watches", HEADPHONES: "headphones", TV: "tv",
  SCOOTER: "scooter", KEYBOARD: "keyboard", CONSOLE: "console", VR: "vr", CPU: "cpu", GPU: "gpu", OS: "os",
};
function _dtqP(key, vars) {
  return _dtUi.t(_DTQ_PAGE_TEXT[key], vars);
}
function _dtqEsc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function _dtqSvg(name) {
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + _DTQ_ICON[name] + "</svg>";
}
// The game's own device icons (its start page uses them), read from the player's copy.
function _dtqDevIcon(it) {
  const k = _dtqIsPart(it) ? it.part : it.type;
  return "StartPageAnimFIles/Icons/" + (_DTQ_DEV_ICON[k] || "smartphone") + "_icon.png";
}
// Why the pipeline keeps a device entry waiting ("" = nothing).
function _dtqPipeWhy(it) {
  return !_dtqIsPart(it) && typeof globalThis._dtPipeWhy === "function" ? globalThis._dtPipeWhy(it) || "" : "";
}
function _dtqAddedText(entry, n) {
  const why = _dtqFind(entry.id) ? _dtqPipeWhy(entry) : "";
  return why ? _dtqT("added_wait", { n: n, why: why }) : _dtqT("added", { n: n });
}
// "CPU" / "Smartphone: Budget, uses Qcpu 1" / "..., needs Qcpu 1, removed from the queue".
function _dtqRowSub(it) {
  if (_dtqIsPart(it)) return _dtqT("part_" + it.part);
  let s = _dtqTypeLabel(it.type) + ": " + _dtqT("count" + it.count);
  for (const u of _dtqUsed(it)) {
    const gone = !u.real && !_dtqFind(u.id);
    s += ", " + _dtqT(gone ? "gone" : "uses", { n: u.name || _dtqT("part_" + u.part) });
  }
  return s;
}
// The page's second line: "Smartphone · 2 versions" / "Tablet · waits for the A6 chip".
function _dtqPageSub(it) {
  if (_dtqIsPart(it)) {
    // A part waiting behind one of its kind says why ("… One device of each kind at a time.").
    let why = "";
    try { why = typeof globalThis._dtPipeWhy === "function" ? globalThis._dtPipeWhy(it) || "" : ""; } catch (e) {}
    return _dtqT("part_" + it.part) + (why ? " · " + why : "");
  }
  const parts = [_dtqTypeLabel(it.type)];
  const wait = [], gone = [];
  for (const u of _dtqUsed(it)) {
    const n = u.name || _dtqT("part_" + u.part);
    if (!u.real && !_dtqFind(u.id)) gone.push(_dtqT("gone", { n: n }));
    else if (!u.real) wait.push(_dtqP("waitsFor", { n: n }));
  }
  if (gone.length) parts.push(gone.join(", "));
  else if (wait.length) parts.push(wait.join(", "));
  else parts.push(it.count === 1 ? _dtqP("versions1") : _dtqP("versionsN", { n: it.count }));
  const why = _dtqPipeWhy(it);
  if (why) parts.push(why);
  return parts.join(" · ");
}
function _dtqStatus(it, i) {
  const why = _dtqReason(it) || (_dtqFailed && _dtqFailed.id === it.id ? "failed" : "");
  if (why) return { text: _dtqP("st_" + why), gold: false };
  return i === 0 ? { text: _dtqP("next"), gold: true } : { text: _dtqP("waiting"), gold: false };
}
// The game's own pop-up look (ui.js modal): red to remove, green to keep.
function _dtqConfirmRemove(it, done) {
  const name = _dtqIsPart(it) ? _dtqLabel(it) : it.names.filter(Boolean).join(" / ") || _dtqTypeLabel(it.type);
  _dtUi.modal({
    title: _dtqP("rmTitle"),
    // The game's centred message line, the name in its yellow (ui.js msg).
    build: (body) => _dtUi.msg(body, _dtqP("rmText", { n: name }), name),
    buttons: [
      { label: _dtqP("rmYes"), kind: "no", onClick: () => { if (_dtqRemove(it.id)) done(); } },
      { label: _dtqP("rmNo"), kind: "yes", main: true },
    ],
  });
}
function _dtqPage(root) {
  _dtqLoad();
  const el = _dtUi.el;
  const hdr = el("div", "dt-pg-hdr", root);
  hdr.innerHTML = "<b>" + _dtqSvg("hourglass") + _dtqEsc(_dtqP("title")) + "</b><i></i><span>" + _dtqEsc(_dtqP("sub")) + "</span>";
  // Over the game's own (i) button (Sprite422 UID 77, centre 1870,50, 40x40): the game's info box with our text.
  const info = el("div", "dt-pg-hit", root);
  Object.assign(info.style, { left: "calc(var(--dt) * 1842px)", top: "calc(var(--dt) * 22px)", width: "calc(var(--dt) * 56px)", height: "calc(var(--dt) * 56px)" });
  info.addEventListener("click", (ev) => {
    ev.stopPropagation();
    try {
      const g = globalThis.runtime.globalVars;
      if (g.EditorNotification === "ON") return;
      globalThis.tapMain && globalThis.tapMain();
      g.EditorNotification = "ON";
      g.EditorNotificationText = _dtqP("info");
      globalThis.runtime.callFunction("EditorNotification_ON");
    } catch (e) {}
  });
  const list = el("div", "dt-pg-list", root);
  let active = "";
  const paint = () => {
    _dtqLoad();
    const keepScroll = list.scrollTop;
    list.innerHTML = "";
    const on = _dtqState.paused;
    const bar = el("div", "dt-pg-bar", list);
    bar.innerHTML = _dtqSvg(on ? "pause" : "play") + '<div class="dt-pg-t">' + _dtqEsc(_dtqP(on ? "paused" : "running")) +
      "<small>" + _dtqEsc(_dtqP(on ? "pausedSub" : "runningSub")) + "</small></div>";
    const pb = _dtTb.control(bar, "dt-pg-btn" + (on ? " dt-gold" : ""), _dtqSvg(on ? "play" : "pause") + "<span>" + _dtqEsc(_dtqT(on ? "resume" : "pause")) + "</span>", () => {
      _dtqPause(!_dtqState.paused);
      paint();
    });
    pb.id = "dtq-pause";
    // Items sent on while their next room was busy (pipeline.js): "Waiting for Programming: Chip A".
    const marked = typeof globalThis._dtPipeMarked === "function" ? globalThis._dtPipeMarked() : [];
    // A card like the running bar above: icon, then the text in line with the bar's title.
    for (const m of marked) {
      const mk = el("div", "dt-pg-bar dt-pg-mk", list);
      mk.innerHTML = _dtqSvg("hourglass");
      el("div", "dt-pg-t", mk, m);
    }
    if (!_dtqState.items.length) {
      if (marked.length) return;
      const row = el("div", "dt-pg-row", list);
      row.innerHTML = '<div class="dt-pg-tx"><div class="dt-pg-nm"><span>' + _dtqEsc(_dtqP("empty")) + '</span></div><div class="dt-pg-sub">' + _dtqEsc(_dtqP("emptySub")) + "</div></div>";
      return;
    }
    const n = _dtqState.items.length;
    _dtqState.items.forEach((it, i) => {
      const row = el("div", "dt-pg-row", list);
      row.dataset.id = it.id;
      el("div", "dt-pg-num", row, String(i + 1));
      const img = el("img", "dt-pg-dev", row);
      img.src = _dtqDevIcon(it);
      img.alt = "";
      const tx = el("div", "dt-pg-tx", row);
      const nm = el("div", "dt-pg-nm", tx);
      el("span", "", nm, _dtqIsPart(it) ? _dtqLabel(it) : it.names.filter(Boolean).join(" / ") || _dtqTypeLabel(it.type));
      if (!_dtqIsPart(it)) for (let k = 1; k <= it.count; k++) el("span", "dt-pg-vt " + ["", "dt-b", "dt-s", "dt-f"][k], nm, _dtqP("t" + k));
      el("div", "dt-pg-sub", tx, _dtqPageSub(it));
      const st = _dtqStatus(it, i);
      el("div", "dt-pg-st" + (st.gold ? " dt-g" : ""), row, st.text);
      const ctl = el("div", "dt-pg-ctl", row);
      const up = _dtTb.control(ctl, "dt-pg-ic", _dtqSvg("up"), () => { if (_dtqMove(it.id, -1)) paint(); });
      up.title = _dtqT("up");
      if (i === 0 || !_dtqCanMove(it.id, -1)) up.classList.add("dt-off");
      const down = _dtTb.control(ctl, "dt-pg-ic", _dtqSvg("down"), () => { if (_dtqMove(it.id, 1)) { active = it.id; paint(); } });
      down.title = _dtqT("down");
      if (i === n - 1 || !_dtqCanMove(it.id, 1)) down.classList.add("dt-off");
      const rm = _dtTb.control(ctl, "dt-pg-ic", _dtqSvg("remove"), () => _dtqConfirmRemove(it, paint));
      rm.title = _dtqT("remove");
      // Controls show on the row the pointer is on (or the last one tapped).
      const show = (on) => {
        row.classList.toggle("dt-hov", on);
        ctl.style.display = on ? "" : "none";
      };
      show(active === it.id);
      row.addEventListener("pointerenter", (ev) => {
        if (ev.pointerType === "touch") return;
        for (const r of list.querySelectorAll(".dt-pg-row.dt-hov")) if (r !== row) r.dispatchEvent(new Event("dt-off"));
        active = it.id;
        show(true);
      });
      row.addEventListener("pointerleave", (ev) => {
        if (ev.pointerType === "touch") return;
        if (active === it.id) active = "";
        show(false);
      });
      row.addEventListener("dt-off", () => show(false));
      row.addEventListener("click", () => {
        for (const r of list.querySelectorAll(".dt-pg-row.dt-hov")) if (r !== row) r.dispatchEvent(new Event("dt-off"));
        active = it.id;
        show(true);
      });
    });
    list.scrollTop = keepScroll;
  };
  paint();
  return { refresh: paint };
}
// The game's Investing layout, its content moved away (see _dtTb.hideGame).
function _dtqRegisterPage() {
  if (typeof _dtTb === "undefined" || !_dtTb) return;
  _dtTb.add({
    id: "queue", x: 852.5, ref: 20215, label: _DTQ_PAGE_TEXT.tb, tint: [255, 203, 92], gradient: "Gradient_44", icon: _DTQ_ICON.hourglassTb,
    layout: "INVESTING MENU", cls: "INVESTING MENU",
    // Title, menu (boxes, highlights, icons, labels) and the 3D pie chart.
    hide: [[10864, "hide"], [91, "hide"], [129, "hide"], [5487, "hide"], [10861, "hide"],
      [10871, "away"], [10872, "away"], [10873, "away"], [10875, "away"], [10876, "away"], [10877, "away"],
      [10878, "away"], [10879, "away"], [10880, "away"], [10881, "away"], [10882, "away"], [10883, "away"]],
    build: _dtqPage,
  });
}
_dtqRegisterPage();
function _dtqOpenPanel() {
  return typeof _dtTb !== "undefined" && _dtTb ? _dtTb.open("queue") : false;
}
// Launch days schedule their modal 700 ms after the final review. Mark the
// release flow pending as soon as the launch hook accepts the final review,
// long before the 700 ms modal, and keep it until the launch modal closes.
function _dtqLaunchPending() {
  _dtqLaunchPendingUntil = Date.now() + 60000;
  globalThis._dtLaunchPending = true;
}
function _dtqLaunchDone() {
  _dtqLaunchPendingUntil = 0;
  globalThis._dtLaunchPending = false;
  _dtqRetryAt = 0;
  _dtqArmed = true;
}
if ("function" == typeof _dtLaunchRelease && !_dtLaunchRelease._dtqWrapped) {
  const _dtqLaunchReleaseOrig = _dtLaunchRelease;
  _dtLaunchRelease = function (arrName, rt, cat, last) {
    const r = _dtqLaunchReleaseOrig.apply(this, arguments);
    if (r && last) {
      let ys = [];
      try {
        ys = "function" == typeof _dtLaunchJustReleased ? _dtLaunchJustReleased(arrName) || [] : [];
      } catch (e) {}
      // No held rows means the game released immediately and no modal opens.
      if (ys.length) _dtqLaunchPending();
    }
    return r;
  };
  _dtLaunchRelease._dtqWrapped = true;
}
if ("function" == typeof _dtLaunchAsk && !_dtLaunchAsk._dtqWrapped) {
  const _dtqLaunchAskOrig = _dtLaunchAsk;
  _dtLaunchAsk = function () {
    _dtqLaunchPending();
    try {
      return _dtqLaunchAskOrig.apply(this, arguments);
    } finally {
      const poll = setInterval(() => {
        if (!_dtUi.isOpen()) {
          clearInterval(poll);
          _dtqLaunchDone();
        }
      }, 150);
      setTimeout(() => {
        clearInterval(poll);
        _dtqLaunchDone();
      }, 60000);
    }
  };
  _dtLaunchAsk._dtqWrapped = true;
}
function _dtqTick() {
  try {
    const rt = globalThis.runtime;
    if (!rt || !rt.globalVars) return;
    _dtqWire();
    const gv = rt.globalVars;
    const lay = _dtUi.layoutName();
    // A new campaign in a used slot must not inherit the previous company's
    // row: ArraySaves is deliberately not reset by resetGameSession.
    if (lay === "LOADING GAME" && String(gv.LoadingType || "").toUpperCase() === "NEW GAME") {
      _dtqClearRow();
      _dtqState = { v: _DTQ_V, company: _dtqCompanyNow(), start: _dtqStartKey(), paused: false, items: [] };
    }
    const outside = lay === "MENU" || lay === "START PAGE" || lay === "LOADING GAME" ||
      0 === lay.indexOf("COMPANY ") || !_dtqCompanyNow();
    if (outside) {
      _dtqSlot = -1;
      _dtqStart = "";
      _dtqPrevType = null;
      _dtqArmed = false;
      _dtqRetryAt = 0;
      _dtqStableKey = "";
      _dtqStableTicks = 0;
      _dtqBase = null;
      _dtqPick = null;
      _dtqCap = null;
      _dtqReplay = null;
    } else {
      _dtqLoad();
    }
    if (outside) return;

    // The office as the player left it, while something is in development:
    // the base a busy create flow is undone to.
    // The clock starts once the picker is left; a part menu that is still
    // loading its images (the layout name already changed) keeps the pick.
    if (_dtqPick && (lay === _DTQ_BOSS || _DTQ_PART_MENU[lay] || _DTQ_PART_MENUS.indexOf(lay) >= 0)) _dtqPick.at = 0;
    else if (_dtqPick && !_dtqNameLayoutType(lay) && Date.now() - (_dtqPick.at || (_dtqPick.at = Date.now())) > 3000) _dtqPick = null;
    // A cog pressed in a viewed room (rooms.js pickFrom) opens the picker in the boss office; keep that
    // room as the base so naming or backing out returns there, not to the boss office.
    const roomPick = globalThis._dtRooms && globalThis._dtRooms.pickFrom ? globalThis._dtRooms.pickFrom() : null;
    if (_dtUi.onOffice() && !_dtqCap && !_dtqReplay && !_dtqPick && !roomPick && String(gv.class || "") === "GAMEPLAY" &&
        String(gv.CreateDevicesUI || "OFF") === "OFF" && _dtqBusy(gv)) {
      _dtqBase = { vars: _dtqVarsCopy(gv, _dtqBase && _dtqBase.vars), layout: lay, view: globalThis._dtRooms ? globalThis._dtRooms.view() : null };
    }
    _dtqOsLabel();
    if (_dtqReplay && Date.now() - _dtqReplay.at > 60000) {
      console.warn("[Queue] replay timed out; entry kept");
      _dtqReplay = null;
    }

    // Any layout/transition/create-screen change resets the stable counter, so
    // the pump cannot fire during the 150 ms create-tile tween or a release.
    const sig = [lay, gv.class, gv.OfficeType, gv.DeviceType, gv.CreateDevicesUI, gv.LastClass,
      gv.DeviceTypeCreatingNow, gv.DeviceCountCreatingNow, gv.GameplayPause, gv.Assistant].join("|");
    if (sig !== _dtqStableKey) {
      _dtqStableKey = sig;
      _dtqStableTicks = 0;
    } else if (_dtqStableTicks < 999) _dtqStableTicks++;

    const type = _dtqBusy(gv) ? String(gv.DeviceTypeCreatingNow) : "";
    // First tick in a company: nothing in development (e.g. Continue after a
    // save made while idle) arms the queue too, or it would never start.
    if (_dtqPrevType === null) _dtqArmed = _dtqArmed || !type;
    else if (_dtqPrevType && !type) _dtqArmed = true;
    _dtqPrevType = type;

    if (!_dtqArmed && _dtqRetryAt && Date.now() >= _dtqRetryAt) {
      _dtqRetryAt = 0;
      _dtqArmed = true;
    }
    if (!_dtqArmed || _dtqState.paused || !_dtqState.items.length) return;
    if (_dtUi.isOpen && _dtUi.isOpen()) return;
    if (!_dtqReadyNow()) return;
    _dtqOpenNext();
  } catch (e) {
    console.warn("[Queue] tick:", e);
  }
}
// The shared mod timer (ui.js every) when ui.js is in; a timer of our own without it.
(typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(_dtqTick, 250);
// Console and test access (the game script is a module).
globalThis._dtQueueApi = {
  state: () => { _dtqLoad(); return JSON.parse(JSON.stringify(_dtqState)); },
  row: _DTQ_ROW,
  remove: (id) => { _dtqLoad(); return _dtqRemove(id); },
  move: (id, d) => { _dtqLoad(); return _dtqMove(id, d); },
  canMove: (id, d) => { _dtqLoad(); return _dtqCanMove(id, d); },
  rowSub: (id) => { const it = _dtqFind(id); return it ? _dtqRowSub(it) : ""; },
  pause: (on) => { _dtqLoad(); return _dtqPause(on); },
  open: _dtqOpenPanel,
  startNext: () => _dtqOpenNext(),
  arm: () => { _dtqArmed = true; },
  // The launch flow is over (reviews.js): the shared flag, the queue's own 60 s wait and its retry.
  launchDone: _dtqLaunchDone,
  launchWait: () => _dtqLaunchPendingUntil > Date.now() || globalThis._dtLaunchPending === true,
  capturing: () => !!_dtqCap,
  replaying: () => _dtqReplay ? _dtqReplay.id : "",
  stable: () => _dtqStableTicks,
  why: (id) => { const it = _dtqFind(id); return it ? _dtqReason(it) : "none"; },
  status: (id) => { const it = _dtqFind(id); return it ? _dtqStatus(it, _dtqIndex(id)).text : ""; },
  failed: () => (_dtqFailed ? _dtqFailed.id : ""),
  retryAt: () => _dtqRetryAt,
  armed: () => _dtqArmed,
  tick: _dtqTick,
  templates: _dtqTemplates,
  layoutStart: _dtqOnLayoutStart,
  afterLayoutStart: _dtqAfterLayoutStart,
  // A type picked in the picker drawn over a work room (rooms picker.js) while busy: the create flow
  // is the queue's, and comes back to that room, as from the boss office picker.
  pick: (layout) => {
    const gv = _dtqGv();
    if (!gv || _dtqCap || _dtqReplay || !_dtqBusy(gv)) return false;
    _dtqPick = { layout: layout };
    if (_dtqBase) _dtqBase.layout = layout;
    return true;
  },
};
