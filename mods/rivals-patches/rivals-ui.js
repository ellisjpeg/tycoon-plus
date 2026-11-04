// ── Rivals UI (DEVICES_TYCOON_RIVALS) ──
// Everything the player sees of rival launches: news toasts and the Sales
// board's "Rivals" tab. Reads only globalThis._dtRivApi (rivals.js), _dtUi and
// the Board's tab registry (globalThis._dtBoardTabs); writes no game value.
// - Toasts (_dtUi.toast, never the game's own news cards): flagship/mid launches
//   of leader and follower lines in types the player has unlocked, a company
//   coming back or leaving, at most 2 a game month and 1 a game week; the rest
//   only show in the tab. "Your X looks dated" at most once a game month. A day
//   jump (skip/delivery) collapses to the newest 2.
// - Tab: launches of the last 24 game months, newest first, type chips (unlocked
//   types), "Only my types", a ▲ per spec that beats your newest device of that
//   type. Off on Original (the untouched game).
var _DT_RV = {
  MONTH_START: [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334],
  MONTHS: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  WINDOW: 730, // days shown in the tab: 24 game months
  PER_MONTH: 2, // news toasts per game month ...
  WEEK: 7, // ... and at least this many game days apart
  DATED_MIN: 0.2, // a "looks dated" toast needs a hit of at least this POP a day
  BURST: 2, // toasts kept from one day jump
  MAX_CHARS: 120, // 3 lines in the 400-wide toast
  // Game type order (the Board's) with the day the player can make each type.
  TYPES: [["phone", 1], ["laptop", 1], ["tablet", 724], ["headphones", 2550], ["watch", 2549], ["tv", 1],
    ["scooter", 2551], ["keyboard", 2184], ["console", 1], ["vr", 2914]],
  // Board device arrays per type (newest device of a type, "Only my types").
  ARR: { phone: "ArraySmartphones", laptop: "ArrayLaptops", tablet: "ArrayTablets", headphones: "ArrayHeadphones",
    watch: "ArrayWatches", tv: "ArrayTV", scooter: "ArrayScooters", keyboard: "ArrayKeyboards", console: "ArrayConsoles",
    vr: "ArrayVRConsoles" },
  // Spec column heads per type, in the order of rivals-core TYPES specs.
  HEADS: {
    phone: ["Screen", "Camera", "RAM", "Storage", "Network"], tablet: ["Display", "Screen", "RAM", "Storage"],
    laptop: ["CPU", "RAM", "SSD", "Screen"], watch: ["Display", "Battery", "Storage", "Chip"],
    headphones: ["Battery", "Bluetooth", "Latency"], tv: ["Resolution", "Screen", "Panel"],
    scooter: ["Battery", "Brakes", "Controller"], keyboard: ["Scan rate", "Latency", "Battery"],
    console: ["GPU", "RAM", "SSD", "CPU"], vr: ["Resolution", "Screen", "RAM"],
  },
};
var _DT_RV_TEXT = {
  tab: "Rivals",
  all: "All",
  mine: "Only my types",
  date: "Date",
  device: "Device",
  price: "Price",
  specs: "Specs",
  newer: "Newer than yours",
  note: "▲ = better than your newest device of that type. {n} launches in the last 24 game months.",
  note1: "▲ = better than your newest device of that type. 1 launch in the last 24 game months.",
  empty: "No rival launches yet.",
  emptyHelp: "Rivals launch a few devices a month; they show up here.",
  emptyMine: "No rival launches in your types in the last 24 game months.",
  mineHelp: "Turn off “Only my types” to see every type.",
  emptyType: "No rival {type} launches in the last 24 game months.",
  off: "Rival companies are off on Original, the untouched game.",
  offHelp: "Pick Realistic or Brutal in Difficulty to see them launch devices.",
  tier: { flag: "Flagship", mid: "Mid", budget: "Budget" },
  type: { phone: "Phone", laptop: "Laptop", tablet: "Tablet", headphones: "Headphones", watch: "Watch", tv: "TV",
    scooter: "Scooter", keyboard: "Keyboard", console: "Console", vr: "VR headset" },
  types: { phone: "Phones", laptop: "Laptops", tablet: "Tablets", headphones: "Headphones", watch: "Watches", tv: "TVs",
    scooter: "Scooters", keyboard: "Keyboards", console: "Consoles", vr: "VR" },
  // Lower case inside sentences.
  noun: { phone: "phone", laptop: "laptop", tablet: "tablet", headphones: "headphones", watch: "watch", tv: "TV",
    scooter: "scooter", keyboard: "keyboard", console: "console", vr: "VR" },
  unveils: "{co} unveils the {model} at {price}: {specs}.",
  launches: "{co} launches the {model}: {specs}. {price}.",
  plain: "{co} launches the {model} at {price}.",
  back: "{co} is back with the {model} at {price}.",
  enters: "{co} enters the {noun} business with the {model} at {price}.",
  last: "{co} launches its last {noun}, the {model}.",
  leaves: "{co} leaves the {noun} business.",
  dated: "Your {dev} looks dated next to the {model}. Sales may dip for a few weeks.",
};

// Russian, same shape. noun is the genitive plural (as in "market of phones"), which every sentence uses.
var _DT_RV_TEXT_RU = {
  tab: "Конкуренты",
  months: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
  all: "Все",
  mine: "Только мои типы",
  date: "Дата",
  device: "Устройство",
  price: "Цена",
  specs: "Характеристики",
  newer: "Новее вашего",
  note: "▲ = лучше вашего новейшего устройства этого типа. Запусков за последние 24 игровых месяца: {n}.",
  note1: "▲ = лучше вашего новейшего устройства этого типа. 1 запуск за последние 24 игровых месяца.",
  empty: "Конкуренты пока ничего не выпустили.",
  emptyHelp: "Конкуренты выпускают по несколько устройств в месяц, и они появятся здесь.",
  emptyMine: "За последние 24 игровых месяца конкуренты не выпускали устройств ваших типов.",
  mineHelp: "Выключите «Только мои типы», чтобы увидеть все типы.",
  emptyType: "За последние 24 игровых месяца конкуренты не выпускали {type}.",
  off: "На сложности «Как в игре» конкурентов нет.",
  offHelp: "Выберите «Реалистично» или «Жёстко» в Сложности, и они начнут выпускать устройства.",
  camera: "камера",
  ru: true,
  tier: { flag: "Флагман", mid: "Средний", budget: "Бюджетный" },
  type: { phone: "Телефон", laptop: "Ноутбук", tablet: "Планшет", headphones: "Наушники", watch: "Часы", tv: "Телевизор",
    scooter: "Самокат", keyboard: "Клавиатура", console: "Консоль", vr: "VR-шлем" },
  types: { phone: "Телефоны", laptop: "Ноутбуки", tablet: "Планшеты", headphones: "Наушники", watch: "Часы", tv: "Телевизоры",
    scooter: "Самокаты", keyboard: "Клавиатуры", console: "Консоли", vr: "VR" },
  noun: { phone: "телефонов", laptop: "ноутбуков", tablet: "планшетов", headphones: "наушников", watch: "часов", tv: "телевизоров",
    scooter: "самокатов", keyboard: "клавиатур", console: "консолей", vr: "VR-шлемов" },
  unveils: "{co} представляет {model} за {price}: {specs}.",
  launches: "{co} выпускает {model}: {specs}. {price}.",
  plain: "{co} выпускает {model} за {price}.",
  back: "{co} возвращается с {model} за {price}.",
  enters: "{co} выходит на рынок {noun}: {model} за {price}.",
  last: "{co} выпускает {model}, последнюю модель в линейке {noun}.",
  leaves: "{co} уходит с рынка {noun}.",
  dated: "{dev} проигрывает новинке {model}. Продажи могут просесть на несколько недель.",
  heads: {
    phone: ["Экран", "Камера", "ОЗУ", "Память", "Сеть"], tablet: ["Дисплей", "Экран", "ОЗУ", "Память"],
    laptop: ["Процессор", "ОЗУ", "SSD", "Экран"], watch: ["Дисплей", "Батарея", "Память", "Чип"],
    headphones: ["Батарея", "Bluetooth", "Задержка"], tv: ["Разрешение", "Экран", "Матрица"],
    scooter: ["Батарея", "Тормоза", "Контроллер"], keyboard: ["Опрос", "Задержка", "Батарея"],
    console: ["Видеокарта", "ОЗУ", "SSD", "Процессор"], vr: ["Разрешение", "Экран", "ОЗУ"],
  },
};
function _dtRvT() {
  return typeof _dtUi.ru === "function" && _dtUi.ru() ? _DT_RV_TEXT_RU : _DT_RV_TEXT;
}

// ── Pure rules (no game access; unit tested) ──
var _dtRvLogic = (function () {
  const NB = " ";
  function fmt(s, vars) {
    for (const k in vars || {}) s = s.split("{" + k + "}").join(String(vars[k]));
    return s;
  }
  // Day 1 = 1 Jan 2008, 365-day years (the game's calendar).
  function ymd(day) {
    const d = Math.max(0, Math.floor(Number(day) || 1) - 1);
    const y = 2008 + Math.floor(d / 365), doy = d % 365;
    let m = 11;
    while (m > 0 && _DT_RV.MONTH_START[m] > doy) m--;
    return { y: y, m: m };
  }
  function monthKey(day) {
    const t = ymd(day);
    return t.y * 12 + t.m;
  }
  function dateLabel(day, months) {
    const t = ymd(day);
    return (months || _DT_RV.MONTHS)[t.m] + " " + t.y;
  }
  // Whole numbers grouped with spaces like the Board ("1 029"); decimals one place.
  function num(n, sep) {
    const v = Number(n);
    if (!isFinite(v)) return String(n);
    const sp = sep || " ";
    if (Math.abs(v - Math.round(v)) > 1e-9) {
      const s = Math.abs(v) < 1 ? String(Number(v.toPrecision(2))) : String(Math.round(v * 10) / 10);
      const [i, f] = s.split(".");
      return i.replace(/\B(?=(\d{3})+(?!\d))/g, sp) + (f ? "." + f : "");
    }
    return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, sp);
  }
  function money(n, sep) {
    return "$" + num(Math.round(Number(n) || 0), sep);
  }
  // Shorter units for the 5 narrow spec cells.
  const SHORT = [[/ battery$/, ""], [/ latency$/, ""], [/ per eye$/, ""], [/ scan$/, ""], [/^core controller$/, "cores"]];
  // A spec label as a cell: {n: number part, u: unit} or {n: "", u: "", t: text}.
  function cell(label) {
    if (label === null || label === undefined || label === "") return null;
    let s = String(label).replace(/\s*\([^)]*\)\s*/g, " ").trim(); // "4K UHD (3840×2160)" -> "4K UHD"
    let m = /^Bluetooth\s+(\d[\d.]*)$/.exec(s);
    if (m) return { n: num(m[1]), u: "BT" };
    m = /^(\d[\d.,]*)(?:\s+|-)(.+)$/.exec(s);
    if (m) {
      let u = m[2];
      for (const [re, to] of SHORT) u = u.replace(re, to);
      return { n: num(m[1].replace(/,/g, "")), u: u };
    }
    if (/^\d[\d.,]*$/.test(s)) return { n: num(s.replace(/,/g, "")), u: "" };
    return { t: s };
  }
  // Russian counting word: 1 ядро, 2-4 ядра, 5+ ядер (11-14 too).
  function plural(n, one, few, many) {
    const k = Math.abs(Math.round(Number(n))) % 100, d = k % 10;
    return k > 10 && k < 20 ? many : d === 1 ? one : d >= 2 && d <= 4 ? few : many;
  }
  // A cell's unit in Russian (the game keeps Hz, MP, GB, ms and the like in Latin).
  function ruUnit(n, u) {
    if (u === "cores") return plural(String(n).replace(/\s/g, ""), "ядро", "ядра", "ядер");
    if (u === "h") return "ч";
    if (u === "Ah") return "А·ч";
    if (u === "px") return "пикс.";
    return u;
  }
  // A whole spec in Russian, for toast sentences.
  function ruSpec(s) {
    let m = /^(\d+)(?: cores|-core controller)$/.exec(s);
    if (m) return m[1] + " " + plural(m[1], "ядро", "ядра", "ядер");
    m = /^(\d[\d.,]*) h battery$/.exec(s);
    if (m) return m[1] + " ч работы";
    m = /^(\d[\d.,]*) Ah battery$/.exec(s);
    if (m) return "батарея " + m[1] + " А·ч";
    m = /^(\d[\d.,]*) ms latency$/.exec(s);
    if (m) return "задержка " + m[1] + " ms";
    m = /^(\d[\d.,]*) px per eye$/.exec(s);
    if (m) return m[1] + " пикс. на глаз";
    return s.replace(/ scan$/, "");
  }
  // A spec inside a toast sentence: no brackets, the unit glued to its number.
  function phrase(label, T) {
    let s = String(label).replace(/\s*\([^)]*\)\s*/g, " ").trim();
    if (/^\d[\d.,]* MP$/.test(s)) s += " " + (T && T.camera || "camera");
    else if (T && T.ru) s = ruSpec(s);
    return s.replace(/(\d)\s+(?=\S)/, "$1" + NB);
  }
  // Toast text for one event, or "" (event never toasts). ev: normalised.
  function toastText(ev, T) {
    const price = money(ev.price, NB);
    if (ev.kind === "exit") return { text: fmt(T.leaves, { co: ev.co, noun: T.noun[ev.type] || ev.type }), key: ev.co };
    if (ev.kind === "dated") return { text: fmt(T.dated, { dev: ev.dev, model: ev.model }), key: ev.dev };
    if (ev.back) return { text: fmt(T.back, { co: ev.co, model: ev.model, price: price }), key: ev.model };
    if (ev.entry) return { text: fmt(T.enters, { co: ev.co, noun: T.noun[ev.type] || ev.type, model: ev.model, price: price }), key: ev.model };
    if (ev.last) return { text: fmt(T.last, { co: ev.co, noun: T.noun[ev.type] || ev.type, model: ev.model }), key: ev.model };
    const specs = (ev.specs || []).filter((s) => s !== null && s !== undefined && s !== "").map((x) => phrase(x, T));
    for (let k = Math.min(3, specs.length); k >= 0; k--) {
      const list = specs.slice(0, k).join(", ");
      const text = !k ? fmt(T.plain, { co: ev.co, model: ev.model, price: price })
        : fmt(ev.arch === "leader" ? T.unveils : T.launches, { co: ev.co, model: ev.model, price: price, specs: list });
      if (text.length <= _DT_RV.MAX_CHARS || !k) return { text: text, key: ev.model };
    }
    return null;
  }
  function unlocked(type, today) {
    const t = _DT_RV.TYPES.find((x) => x[0] === type);
    return !!t && today >= t[1];
  }
  // Is this event news at all (before the caps)?
  function newsworthy(ev, today) {
    if (ev.kind === "dated") return Number(ev.x) >= _DT_RV.DATED_MIN;
    if (!unlocked(ev.type, Math.max(today, ev.day))) return false;
    if (ev.kind === "exit" || ev.entry || ev.back || ev.last) return true;
    return (ev.tier === "flag" || ev.tier === "mid") && (ev.arch === "leader" || ev.arch === "follower");
  }
  // Caps. st = {shown: [days], dated: [month keys]}; events in day order.
  // Returns the events to show (newest BURST of those that pass) and records them.
  function gate(st, events, today) {
    const pass = [];
    for (const ev of events.slice().sort((a, b) => a.day - b.day)) {
      if (!newsworthy(ev, today)) continue;
      const mk = monthKey(ev.day);
      if (ev.kind === "dated") {
        if (st.dated.indexOf(mk) >= 0) continue;
        st.dated.push(mk);
        pass.push(ev);
        continue;
      }
      if (st.shown.some((d) => Math.abs(ev.day - d) < _DT_RV.WEEK)) continue;
      if (st.shown.filter((d) => monthKey(d) === mk).length >= _DT_RV.PER_MONTH) continue;
      st.shown.push(ev.day);
      pass.push(ev);
    }
    // Old entries no longer matter for any cap.
    st.shown = st.shown.filter((d) => d > today - 62);
    st.dated = st.dated.filter((k) => k >= monthKey(today) - 1);
    return pass.slice(-_DT_RV.BURST);
  }
  // One launch from rivals.js (_dtRivApi) in one shape.
  // first/last = the line's first/final launch; a first launch is news only
  // for a company coming back (another line of its type ended before) or one
  // that starts after the type existed (lines = rivals-core LINES).
  function norm(L, lines) {
    if (!L || typeof L !== "object") return null;
    const line = L.line && typeof L.line === "object" ? L.line : {};
    const kind = L.kind || "launch";
    const n = L.n !== undefined ? L.n : "";
    const specs = (L.specs || L.labels || []).map((s) => (s && typeof s === "object" ? s.label : s));
    const co = String(L.co || L.company || line.co || ""), type = String(L.type || line.type || "");
    const year = L.year || ymd(L.day).y;
    let back = !!L.back, entry = !!L.entry;
    if (L.first && !back && !entry) {
      const unlockYear = ymd((_DT_RV.TYPES.find((t) => t[0] === type) || [0, 1])[1]).y;
      back = (lines || []).some((o) => o.co === co && o.type === type && o.id !== L.line && o.to < year);
      entry = !back && year > Math.max(2008, unlockYear);
    }
    return {
      kind: kind, id: String(L.id || ""), day: Number(L.day) || 0,
      co: _dtRvReal(co), type: type,
      tier: String(L.tier || line.tier || ""), arch: String(L.arch || line.arch || ""),
      model: _dtRvReal(String(L.model || L.name || (line.stem ? line.stem + (/\s[A-Z]$/.test(line.stem) ? "" : " ") + n : "")).replace(/\s+/g, " ").trim()),
      price: Number(L.price) || 0, specs: specs.map((s) => (s === -1 || s === undefined ? null : s)),
      rows: Array.isArray(L.rows) ? L.rows : null,
      // newer: rivals.js's "beats your newest device" per spec (null: no device of that type).
      beat: Array.isArray(L.newer) ? L.newer : "newer" in L ? [] : Array.isArray(L.beat) ? L.beat : null,
      entry: entry, back: back, last: !!L.last && !L.first, dev: String(L.dev || L.device || ""), x: Number(L.x) || 0,
      hits: Array.isArray(L.hits) ? L.hits : null,
    };
  }
  // Best rival row per spec of `type` on sale on `day` (rivals-core market).
  function market(log, type, day, n) {
    const best = [];
    for (let i = 0; i < n; i++) best.push(-1);
    for (const L of log) {
      if (L.type !== type || L.day > day || !L.rows) continue;
      L.rows.forEach((r, i) => { if (r > best[i]) best[i] = r; });
    }
    return best;
  }
  // Per spec: does this launch beat the rival market when your newest device
  // of its type came out? mine = {release} or null.
  function beats(L, log, mine) {
    if (L.beat) return L.specs.map((s, i) => !!L.beat[i]);
    if (!mine || !L.rows || !(L.day > mine.release)) return L.specs.map(() => false);
    const best = market(log, L.type, mine.release, L.rows.length);
    return L.rows.map((r, i) => r >= 0 && r > best[i]);
  }
  // Tab rows: last 24 game months, filters, newest first.
  function rows(list, today, filter, mineTypes) {
    return list.filter((L) => L.kind === "launch" && L.day <= today && L.day > today - _DT_RV.WINDOW)
      .filter((L) => !filter.type || filter.type === "all" || L.type === filter.type)
      .filter((L) => !filter.mine || mineTypes.has(L.type))
      .sort((a, b) => b.day - a.day || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  return { fmt, ymd, monthKey, dateLabel, num, money, cell, plural, ruUnit, ruSpec, phrase, toastText, unlocked, newsworthy, gate, norm, market, beats, rows };
})();

var _dtRv = { filter: { type: "all", mine: false }, caps: { shown: [], dated: [] }, queue: [], owner: null, last: 0,
  sub: null, view: null, timer: 0, sig: "", data: null };

function _dtRvApi() {
  const a = globalThis._dtRivApi;
  return a && typeof a === "object" ? a : null;
}
function _dtRvLines() {
  try { return globalThis._dtRivCore.RIV.LINES || []; } catch (e) { return []; }
}
function _dtRvToday() {
  return _dtUi.num("DayTotal", 0);
}
// Off on Original: rivals.js says so, else the game's own "shipped" sliders.
function _dtRvOff() {
  try {
    const st = _dtRvApi() && typeof _dtRvApi().state === "function" ? _dtRvApi().state() : null;
    if (st && typeof st.on === "boolean") return !st.on && (st.reason === undefined || st.reason === "original");
    if (st && typeof st.off === "boolean") return st.off;
    if (st && "original" in st) return !!st.original;
  } catch (e) {}
  try { return typeof _dtResShipped === "function" && !!_dtResShipped(); } catch (e) { return false; }
}
function _dtRvLaunches() {
  try {
    const a = _dtRvApi();
    const list = a && typeof a.list === "function" ? a.list() : [];
    return (list || []).map((L) => _dtRvLogic.norm(L, _dtRvLines())).filter((L) => L && L.kind === "launch" && L.day > 0);
  } catch (e) {
    return [];
  }
}
// Launches, cached until rivals.js has something new (version) or your devices
// change (they decide the ▲ marks). Without version() every call reads afresh.
function _dtRvData() {
  const a = _dtRvApi();
  const ver = a && typeof a.version === "function" ? a.version() : null;
  const mine = _dtRvMine();
  const mineSig = Object.keys(mine).map((k) => k + mine[k].release).join(",");
  const key = ver === null ? null : ver + "#" + mineSig;
  if (key !== null && _dtRv.data && _dtRv.data.key === key) return _dtRv.data;
  _dtRv.data = { key: key, all: _dtRvLaunches(), mine: mine, mineSig: mineSig };
  return _dtRv.data;
}
// What the tab shows: off, the launches, your devices, and how many are inside
// the 24-month window (one leaving it redraws the tab, a new day alone does not).
function _dtRvSig(d, today) {
  let n = 0;
  for (const L of d.all) if (L.day <= today && L.day > today - _DT_RV.WINDOW) n++;
  return (d.key === null ? today + "|" + d.all.length : d.key) + "|" + n + "|" + d.mineSig;
}
function _dtRvArr(name) {
  try {
    const o = globalThis.runtime.objects[name];
    return o ? o.getFirstInstance() : null;
  } catch (e) {
    return null;
  }
}
// The player's newest released device per type: {type: {release, name}}.
function _dtRvMine() {
  const out = {}, today = _dtRvToday();
  for (const type in _DT_RV.ARR) {
    const a = _dtRvArr(_DT_RV.ARR[type]);
    if (!a || (a.depth | 0) <= 8) continue;
    const w = a.width | 0, h = Math.min(3, a.height | 0);
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
      if (a.getAt(x, y, 0) === -1) continue;
      const rel = Number(a.getAt(x, y, 7));
      if (!(rel >= 0) || rel > today) continue;
      if (!out[type] || rel > out[type].release) out[type] = { release: rel, name: String(a.getAt(x, y, 8) || "") };
    }
  }
  return out;
}

// ── Toasts ──
function _dtRvOwner() {
  return Math.round(_dtUi.num("SaveSlot", 0)) + "|" + String(_dtUi.gv("CompanyName", "") || "");
}
// rivals.js calls this for every new launch (and exit/entry/dated events).
function _dtRvOnEvent(raw) {
  const ev = _dtRvLogic.norm(raw, _dtRvLines());
  if (!ev || !ev.day) return;
  _dtRv.queue.push(ev);
  // A launch may carry the player's devices it hits: one "looks dated" event.
  let top = null;
  for (const h of ev.hits || []) if (h && Number(h.x) > (top ? Number(top.x) : 0)) top = h;
  if (top && ev.kind === "launch") {
    _dtRv.queue.push(_dtRvLogic.norm({ kind: "dated", day: ev.day, model: ev.model, dev: top.name || top.dev || top.device, x: top.x, type: ev.type }));
  }
}
function _dtRvSubscribe() {
  const a = _dtRvApi();
  if (_dtRv.sub === a || !a || typeof a.onLaunch !== "function") return;
  _dtRv.sub = a;
  a.onLaunch(_dtRvOnEvent);
}
function _dtRvToasts() {
  const today = _dtRvToday(), owner = _dtRvOwner();
  // Another save or company, or the day going back: caps start again, nothing old is shown.
  if (_dtRv.owner !== null && (owner !== _dtRv.owner || today < _dtRv.last)) {
    _dtRv.caps = { shown: [], dated: [] };
    _dtRv.queue = [];
  }
  _dtRv.owner = owner;
  _dtRv.last = today;
  if (!_dtRv.queue.length) return;
  // Toasts belong to the office screens, like the game's own news: on the factory,
  // awards or editor screens launches wait for the office (a fortnight at most).
  // The office layout also hosts the device creator, cards and pause: wait there too (as year.js does).
  const gv = globalThis.runtime && globalThis.runtime.globalVars;
  const busy = !!gv && (String(gv.class || "GAMEPLAY") !== "GAMEPLAY" || String(gv.Assistant || "OFF") !== "OFF" ||
    String(gv.CreateDevicesUI || "OFF") !== "OFF" || Number(gv.GameplayPause || 0) !== 0);
  if ((typeof _dtUi.onOffice === "function" && !_dtUi.onOffice()) || busy) {
    _dtRv.queue = _dtRv.queue.filter((e) => e.day >= today - 14);
    return;
  }
  const events = _dtRv.queue.filter((e) => e.day <= today + 1);
  _dtRv.queue = [];
  if (_dtRvOff()) return;
  for (const ev of _dtRvLogic.gate(_dtRv.caps, events, today)) {
    const t = _dtRvLogic.toastText(ev, _dtRvT());
    if (t && t.text) _dtUi.toast(t.text, t.key);
  }
}

// ── Board "Rivals" tab ──
var _DT_RV_CSS = `
/* Rivals tab. Builds on mods-ui (.dt-*, mdpage.js .dt-mdp-*) and board.js (.dt-board-*): same page, same cells. */
.dt-layer { --dt-up: rgb(168, 212, 24); --dt-down: rgb(255, 120, 120); --dt-warn: rgb(255, 158, 20); --dt-mute: rgba(255, 255, 255, 0.5); }
.dt-board-grid.dt-rv-grid { grid-template-columns: calc(var(--dt) * 150px) minmax(0, 1fr) calc(var(--dt) * 140px) repeat(5, calc(var(--dt) * 150px)); }
.dt-rv-grid > .dt-rv-specs { display: contents; }
/* Each spec is its own cell, like the board's other columns. */
.dt-rv-grid > .dt-rv-specs > * { display: flex; align-items: center; justify-content: center; min-width: 0; min-height: calc(var(--dt) * 48px);
  padding: 0.3em 0.5em; border-radius: 0.2em; background-color: rgba(0, 0, 0, 0.15); }
.dt-rv-head > .dt-rv-specs > * { background-color: rgba(255, 255, 255, 0.1); white-space: nowrap; }
.dt-rv-head .dt-board-h { cursor: default; }
.dt-rv-head > .dt-board-h:nth-child(2) { justify-content: flex-start; padding-left: 0.7em; }
.dt-rv-head .dt-board-h:hover { background-color: rgba(255, 255, 255, 0.1) !important; }
.dt-rv-head .dt-rv-all { grid-column: span 5; }
.dt-rv-row { cursor: default; }
.dt-rv-row:hover > * { background-color: rgba(0, 0, 0, 0.15); }
.dt-rv-date { color: rgba(255, 255, 255, 0.75); }
.dt-rv-tag { flex: 0 0 auto; color: var(--dt-warn); }
.dt-rv-spec { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.dt-rv-spec small { font-size: 0.8em; color: var(--dt-mute); margin-left: calc(var(--dt) * 4px); }
.dt-rv-spec.dt-rv-beat { color: var(--dt-warn); }
.dt-rv-spec.dt-rv-beat::before { content: "\\25B2\\00A0"; font-size: 0.6em; vertical-align: 0.15em; }
.dt-rv-note-up { color: var(--dt-warn); }
.dt-rv-empty { position: absolute; left: calc(var(--dt) * 160px); top: calc(var(--dt) * 300px); width: calc(var(--dt) * 1708px);
  text-align: center; font-size: calc(var(--dt) * 30px); color: rgba(255, 255, 255, 0.62); }
.dt-rv-empty small { display: block; margin-top: calc(var(--dt) * 10px); font-size: calc(var(--dt) * 24px); color: rgba(255, 255, 255, 0.5); }
`;
function _dtRvEsc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function _dtRvCss() {
  if (document.getElementById("dt-rivals-css")) return;
  const st = document.createElement("style");
  st.id = "dt-rivals-css";
  st.textContent = _DT_RV_CSS;
  document.head.appendChild(st);
}
function _dtRvEmpty(pane, text, help) {
  _dtUi.el("div", "dt-rv-empty", pane).innerHTML = _dtRvEsc(text) + (help ? "<small>" + _dtRvEsc(help) + "</small>" : "");
}
function _dtRvSpecCell(label, beat) {
  const c = _dtRvLogic.cell(label);
  if (!c) return '<div class="dt-rv-spec"></div>';
  const cls = "dt-rv-spec" + (beat ? " dt-rv-beat" : "");
  const u = c.u && _dtRvT().ru ? _dtRvLogic.ruUnit(c.n, c.u) : c.u;
  const body = c.t !== undefined ? _dtRvEsc(c.t) : _dtRvEsc(c.n) + (u ? "<small>" + _dtRvEsc(u) + "</small>" : "");
  return '<div class="' + cls + '" title="' + _dtRvEsc(label) + '">' + body + "</div>";
}
// Fills the tab's pane (the Board calls this when the tab is picked); the
// pane's own refresh re-calls it when a launch arrives or the day moves on.
function _dtRvRender(pane, opts) {
  const L = _dtRvLogic, T = _dtRvT(), HEADS = T.heads || _DT_RV.HEADS;
  _dtRvCss();
  const old = _dtRv.view && _dtRv.view.pane === pane ? _dtRv.view : null;
  const keep = old ? { top: old.scroll ? old.scroll.scrollTop : 0 } : null;
  pane.innerHTML = "";
  const today = _dtRvToday();
  if (opts && opts.keys) _dtRv.keys = opts.keys;
  const view = { pane: pane, scroll: null, sig: "" };
  _dtRv.view = view;
  if (_dtRvOff()) {
    view.sig = "off";
    _dtRvEmpty(pane, T.off, T.offHelp);
    return;
  }
  const data = _dtRvData();
  const all = data.all;
  const mine = data.mine;
  const mineTypes = new Set(Object.keys(mine));
  const f = _dtRv.filter;
  const types = _DT_RV.TYPES.filter((t) => L.unlocked(t[0], today)).map((t) => t[0]);
  if (f.type !== "all" && types.indexOf(f.type) < 0) f.type = "all";
  view.sig = _dtRvSig(data, today);
  // Types in the game's icon column; "Only my types" a key hint by "ESC  Back" (filled while on).
  const pick = (patch) => {
    Object.assign(f, patch);
    _dtRvRender(pane);
  };
  _dtMdp.icons(pane, [{ id: "all", label: T.all }].concat(types.map((k) => ({ id: k, label: T.types[k] }))), f.type, (k) => pick({ type: k }));
  const keys = _dtRv.keys;
  if (keys && keys.isConnected) {
    let mk = Array.prototype.find.call(keys.children, (c) => c.classList.contains("dt-rv-minekey"));
    if (!mk) {
      mk = _dtMdp.key(keys, "M", T.mine, () => {
        try { globalThis.tapMain && globalThis.tapMain(); } catch (e) {}
        const v = _dtRv.view;
        if (v && v.pane.isConnected) pick({ mine: !f.mine });
      });
      mk.classList.add("dt-rv-minekey");
    }
    mk.classList.toggle("dt-on", !!f.mine);
  }
  const list = L.rows(all, today, f, mineTypes);
  if (!list.length) {
    // Say what hides them: "Only my types", the type chip, or nothing launched yet.
    if (f.mine && L.rows(all, today, { type: f.type, mine: false }, mineTypes).length) _dtRvEmpty(pane, T.emptyMine, T.mineHelp);
    else if (f.type !== "all" && L.rows(all, today, { type: "all", mine: false }, mineTypes).length) {
      _dtRvEmpty(pane, L.fmt(T.emptyType, { type: T.noun[f.type] }), T.emptyHelp);
    } else _dtRvEmpty(pane, T.empty, T.emptyHelp);
    return;
  }
  // Column heads: Date is the (fixed) sort; one type picked names each spec.
  const head = _dtUi.el("div", "dt-board-head dt-board-grid dt-rv-grid dt-rv-head", pane);
  _dtUi.el("div", "dt-board-h dt-on", head, T.date);
  _dtUi.el("div", "dt-board-h", head, T.device);
  _dtUi.el("div", "dt-board-h", head, T.price);
  if (f.type !== "all" && HEADS[f.type]) {
    const sh = _dtUi.el("div", "dt-rv-specs", head);
    for (let i = 0; i < 5; i++) _dtUi.el("div", "dt-board-h", sh, HEADS[f.type][i] || "");
  } else _dtUi.el("div", "dt-board-h dt-rv-all", head, T.specs);
  const scroll = _dtUi.el("div", "dt-board-scroll dt-mdp-scroll", pane);
  view.scroll = scroll;
  let html = "";
  for (const r of list) {
    const beat = L.beats(r, all, mine[r.type] || null);
    const tag = beat.some(Boolean) ? '<span class="dt-rv-tag">' + _dtRvEsc(T.newer) + "</span>" : "";
    const sub = [r.co, T.type[r.type] || r.type, T.tier[r.tier] || ""].filter(Boolean).join(" · ");
    let specs = "";
    for (let i = 0; i < 5; i++) specs += _dtRvSpecCell(r.specs[i], beat[i]);
    html += '<div class="dt-board-row dt-board-grid dt-rv-row dt-rv-grid">' +
      '<div class="dt-board-c dt-rv-date">' + _dtRvEsc(L.dateLabel(r.day, T.months)) + "</div>" +
      '<div class="dt-board-dev"><span class="dt-board-name">' + _dtRvEsc(r.model) + "</span>" + tag +
      '<span class="dt-board-type">' + _dtRvEsc(sub) + "</span></div>" +
      '<div class="dt-board-c">' + (r.price > 0 ? _dtRvEsc(L.money(r.price)) : "") + "</div>" +
      '<div class="dt-rv-specs">' + specs + "</div></div>";
  }
  scroll.innerHTML = html;
  const note = _dtUi.el("div", "dt-board-note", pane);
  const n = list.length;
  note.innerHTML = '<span class="dt-rv-note-up">▲</span>' + _dtRvEsc((n === 1 ? T.note1 : L.fmt(T.note, { n: L.num(n) })).slice(1));
  if (keep) scroll.scrollTop = keep.top;
}
function _dtRvTick() {
  _dtRvSubscribe();
  _dtRvToasts();
  const v = _dtRv.view;
  if (!v) return;
  if (!v.pane.isConnected || v.pane.style.display === "none") {
    if (!v.pane.isConnected) _dtRv.view = null;
    return;
  }
  // New launches, a new day or a new device of yours: draw again (scroll kept).
  const sig = _dtRvOff() ? "off" : _dtRvSig(_dtRvData(), _dtRvToday());
  if (sig !== v.sig) _dtRvRender(v.pane);
}
(function () {
  globalThis._dtRivUiApi = { logic: _dtRvLogic, render: _dtRvRender, onEvent: _dtRvOnEvent, toasts: _dtRvToasts,
    tick: _dtRvTick, state: () => _dtRv, text: _DT_RV_TEXT, ru: _DT_RV_TEXT_RU };
  if (!Array.isArray(globalThis._dtBoardTabs)) globalThis._dtBoardTabs = [];
  if (!globalThis._dtBoardTabs.some((t) => t && t.id === "rivals")) {
    globalThis._dtBoardTabs.push({ id: "rivals", label: { en: _DT_RV_TEXT.tab, ru: _DT_RV_TEXT_RU.tab }, render: _dtRvRender });
  }
  if (_dtRv.timer || typeof document === "undefined") return;
  // The shared mod timer (ui.js every) when ui.js is in; a timer of our own without it.
  _dtRv.timer = (typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(() => {
    try { _dtRvTick(); } catch (e) {}
  }, 500);
})();

// Real company and model names from the names patch when it is on (display only; saves keep the game's names).
function _dtRvReal(name) {
  try { return typeof globalThis._dtRealName === "function" ? String(globalThis._dtRealName(name) || name) : name; }
  catch (e) { return name; }
}
