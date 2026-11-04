// ── Sales board (DEVICES_TYCOON_BOARD) ──
// One read-only panel listing every device edition on sale right now, opened
// from a "B  Board" keycap next to "C  Compare" on the My <Type> screens (or
// key B). Every number is read from the same device arrays tickDeviceSales
// works on (Z13 columns): price = SELL, stock = CREATED - SOLDED, popularity =
// POP, profit so far = the game's own _slotProfit (SOLDED x (SELL - COST), the
// office sales figure), except that units sold before a Sell price change keep
// the profit made at the older price (Sell's bank in row 154). Sold per day is
// measured, not guessed: whenever DayTotal moves on, the SOLDED change of each
// edition is recorded, and the board shows the average of the last 7 game days
// (fewer just after loading).
// "Restocking" uses the same rule as _handleBatchSoldOut (self or contract
// restock, POP >= RESTOCK_MIN_POP, price above the restock unit cost). Devices
// stopped with Sell (ArraySaves row 154) are listed greyed as "Not on sale".
// A row tap opens that device's Sales page, as the game's own arrows do.
// Nothing here writes a game value except the page variables of that jump.
var _DT_BOARD_COL = { CREATED: 0, SOLDED: 1, POP: 2, COST: 3, SELL: 4, RATING: 5, RELEASE: 7, NAME: 8, DATE: 9, ID: 10 };
var _DT_BOARD_DAYS = 7;
// Consumer device screens that sell (gamepads are bundled with consoles).
var _DT_BOARD_TYPES = [
  { cls: "MY SMARTPHONES", arr: "ArraySmartphones", ui: "MySmartphonesUI", k: "phone" },
  { cls: "MY LAPTOPS", arr: "ArrayLaptops", ui: "MyLaptopsUI", k: "laptop" },
  { cls: "MY TABLETS", arr: "ArrayTablets", ui: "MyTabletsUI", k: "tablet" },
  { cls: "MY HEADPHONES", arr: "ArrayHeadphones", ui: "MyHeadphonesUI", k: "headphones" },
  { cls: "MY WATCHES", arr: "ArrayWatches", ui: "MyWatchesUI", k: "watch" },
  { cls: "MY TV", arr: "ArrayTV", ui: "MyTVUI", k: "tv" },
  { cls: "MY SCOOTERS", arr: "ArrayScooters", ui: "MyScootersUI", k: "scooter" },
  { cls: "MY KEYBOARDS", arr: "ArrayKeyboards", ui: "MyKeyboardsUI", k: "keyboard" },
  { cls: "MY CONSOLES", arr: "ArrayConsoles", ui: "MyConsolesUI", k: "console" },
  { cls: "MY VR", arr: "ArrayVRConsoles", ui: "MyVRUI", k: "vr" },
];
// The keycap shows on every My <Type> screen Compare uses.
var _DT_BOARD_SCREENS = _DT_BOARD_TYPES.map((t) => t.cls).concat(["MY GAMEPADS"]);
var _DT_BOARD_TEXT = {
  btn: { en: "Board", ru: "Сводка" },
  tip: { en: "Everything you are selling, on one board (B)", ru: "Все продажи на одной доске (B)" },
  title: { en: "Sales board", ru: "Сводка продаж" },
  done: { en: "Done", ru: "Готово" },
  device: { en: "Device", ru: "Устройство" },
  price: { en: "Price", ru: "Цена" },
  perDay: { en: "Sold a day", ru: "В день" },
  stock: { en: "In stock", ru: "На складе" },
  runs: { en: "Stock lasts", ru: "Запас" },
  pop: { en: "Popularity", ru: "Популярность" },
  profit: { en: "Profit so far", ru: "Прибыль" },
  days: { en: "Sold out in {n} days", ru: "Кончится через {n} дн." },
  day1: { en: "Sold out tomorrow", ru: "Кончится завтра" },
  restock: { en: "Restocking", ru: "Пополняется" },
  out: { en: "Sold out", ru: "Распродано" },
  idle: { en: "No sales", ru: "Нет продаж" },
  counting: { en: "Counting", ru: "Считаем" },
  off: { en: "Not on sale", ru: "Не продаётся" },
  all: { en: "All devices", ru: "Все устройства" },
  empty: { en: "Nothing is on sale right now.", ru: "Сейчас ничего не продаётся." },
  sum: { en: "{n} on sale · {u} sold a day · {p} profit so far", ru: "{n} в продаже · {u} в день · прибыль {p}" },
  note: { en: "Sold a day: average of the last {d} game days, counted since the game was loaded. Tap a row to open its page.",
    ru: "В день: среднее за последние {d} игровых дней с момента загрузки. Нажмите строку, чтобы открыть страницу." },
  phone: { en: "Phone", ru: "Телефон" },
  laptop: { en: "Laptop", ru: "Ноутбук" },
  tablet: { en: "Tablet", ru: "Планшет" },
  headphones: { en: "Headphones", ru: "Наушники" },
  watch: { en: "Watch", ru: "Часы" },
  tv: { en: "TV", ru: "ТВ" },
  scooter: { en: "Scooter", ru: "Самокат" },
  keyboard: { en: "Keyboard", ru: "Клавиатура" },
  console: { en: "Console", ru: "Консоль" },
  vr: { en: "VR headset", ru: "VR-шлем" },
};

// ── Pure rules (no game access; unit tested) ──
var _dtBoardLogic = (function () {
  // Same edition key as Sell: array, game ID (column 10), release day.
  function key(arrName, id, release, name) {
    const n = Number(id);
    return arrName + (n > 0 ? "#" + n : "|" + String(name || "")) + "@" + Math.round(Number(release) || 0);
  }
  // Fold a new reading of every edition ({key: {s: SOLDED, c: CREATED}}) into
  // the history. A new owner (save slot / company), a day going backwards or a
  // jump of more than 60 days is a different game: start again.
  function track(st, day, owner, snap) {
    const prev = st.snap;
    st.snap = { day: day, owner: owner, map: snap };
    if (!prev || prev.owner !== owner || day < prev.day || day - prev.day > 60) {
      st.hist = new Map();
      return false;
    }
    const n = day - prev.day;
    if (n <= 0) return false;
    const hist = st.hist;
    for (const k of Object.keys(snap)) {
      const was = prev.map[k];
      if (!was) continue;
      const u = snap[k].s - was.s;
      if (!(u >= 0)) {
        hist.delete(k);
        continue;
      }
      const list = hist.get(k) || [];
      list.push({ d: n, u: u, r: snap[k].c > was.c });
      let days = 0;
      for (const e of list) days += e.d;
      while (list.length > 1 && days - list[0].d >= _DT_BOARD_DAYS) days -= list.shift().d;
      hist.set(k, list);
    }
    for (const k of Array.from(hist.keys())) if (!snap[k]) hist.delete(k);
    return true;
  }
  // Average units a day over the recorded days, or null before the first day.
  function perDay(list) {
    if (!list || !list.length) return null;
    let d = 0, u = 0;
    for (const e of list) {
      d += e.d;
      u += e.u;
    }
    return d > 0 ? u / d : null;
  }
  // The "Stock lasts" cell: {k: restock|out|wait|idle|days, n}.
  function runsOut(stock, rate, restocks) {
    if (restocks) return { k: "restock" };
    if (!(stock > 0)) return { k: "out" };
    if (rate === null || rate === undefined) return { k: "wait" };
    if (!(rate > 0)) return { k: "idle" };
    return { k: "days", n: Math.max(1, Math.ceil(stock / rate)) };
  }
  // The game's own restock gate (_handleBatchSoldOut): contract or self
  // restock, POP at least RESTOCK_MIN_POP, sell price above the unit cost
  // with its fee. Budget is checked by the game on the day itself.
  function restocks(cfg, underContract, pop, cost, sell) {
    if (!cfg) return false;
    const self = !underContract && !!cfg.RESTOCK_SELF;
    if (!underContract && !self) return false;
    if (!(Number(pop) >= Number(cfg.RESTOCK_MIN_POP))) return false;
    const fee = Number(self ? cfg.RESTOCK_FEE_SELF : cfg.RESTOCK_FEE) || 0;
    const m = Number(cost) > 0 ? Number(cost) * (1 + fee) : 0;
    return m > 0 && Number(sell) > m;
  }
  // Sort: on-sale rows first, then by the column (numbers biggest first), then name.
  const SORT_FIELD = { device: "name", price: "price", perDay: "rate", stock: "stock", runs: "lasts", pop: "pop", profit: "profit" };
  function sortRows(rows, col, dir) {
    const f = SORT_FIELD[col] || "profit";
    const sgn = dir === "asc" ? 1 : -1;
    const val = (r) => {
      // Restocking lasts longest, then days of stock; not counted yet sorts last.
      if (f === "lasts") {
        if (r.restock) return 1e12;
        if (!(r.stock > 0)) return 0;
        if (r.rate === null || r.rate === undefined) return -1;
        return r.rate > 0 ? r.stock / r.rate : 1e11;
      }
      const v = r[f];
      return v === null || v === undefined ? -1 : v;
    };
    return rows.slice().sort((a, b) => {
      if (a.off !== b.off) return a.off ? 1 : -1;
      let c = 0;
      if (f === "name") c = String(a.name).localeCompare(String(b.name)) * (dir === "desc" ? -1 : 1);
      else c = (val(a) - val(b)) * sgn;
      return c || String(a.name).localeCompare(String(b.name));
    });
  }
  // Whole numbers grouped with spaces, like the game's own tables ("56 129 041").
  function num(n) {
    const v = Math.round(Number(n) || 0);
    return (v < 0 ? "-" : "") + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }
  function money(n) {
    const v = Math.round(Number(n) || 0);
    return (v < 0 ? "-$" : "$") + num(Math.abs(v));
  }
  // A rate under 10 a day keeps one decimal ("2.5"), else whole units.
  function rate(r) {
    if (r === null || r === undefined) return "";
    return r > 0 && r < 10 ? String(Math.round(r * 10) / 10) : num(r);
  }
  // Year from the release text ("06.07.2013").
  function year(text) {
    const m = /(\d{4})\s*$/.exec(String(text || ""));
    return m ? m[1] : "";
  }
  return { key, track, perDay, runsOut, restocks, sortRows, num, money, rate, year };
})();

var _dtBoard = { hist: new Map(), snap: null, btn: null, view: null, timer: 0, pending: null, sort: "profit", dir: "desc", type: "all" };

function _dtBoardT(k, vars) {
  return _dtUi.t(_DT_BOARD_TEXT[k], vars);
}
function _dtBoardRt() {
  return globalThis.runtime || null;
}
function _dtBoardArr(name) {
  try {
    const o = _dtBoardRt().objects[name];
    return o ? o.getFirstInstance() : null;
  } catch (e) {
    return null;
  }
}
function _dtBoardToday() {
  return _dtUi.num("DayTotal", 0);
}
function _dtBoardKeyAt(t, a, x, y) {
  const C = _DT_BOARD_COL;
  let id = 0;
  try {
    if ((a.depth | 0) > C.ID) id = a.getAt(x, y, C.ID);
  } catch (e) {}
  return _dtBoardLogic.key(t.arr, id, a.getAt(x, y, C.RELEASE), a.getAt(x, y, C.NAME));
}
// Every released edition: calls fn(t, a, x, y, key).
function _dtBoardEach(fn) {
  const C = _DT_BOARD_COL, today = _dtBoardToday();
  for (const t of _DT_BOARD_TYPES) {
    const a = _dtBoardArr(t.arr);
    if (!a || (a.depth | 0) <= C.NAME) continue;
    const w = a.width | 0, h = Math.min(3, a.height | 0);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        if (a.getAt(x, y, C.CREATED) === -1) continue;
        const rel = Number(a.getAt(x, y, C.RELEASE));
        if (!(rel >= 0) || rel > today) continue;
        fn(t, a, x, y, _dtBoardKeyAt(t, a, x, y));
      }
    }
  }
}

// ── Sold per day: read SOLDED whenever the day moves on ──
function _dtBoardOwner() {
  return Math.round(_dtUi.num("SaveSlot", 0)) + "|" + String(_dtUi.gv("CompanyName", "") || "");
}
function _dtBoardSample() {
  const day = _dtBoardToday();
  const owner = _dtBoardOwner();
  if (_dtBoard.snap && _dtBoard.snap.day === day && _dtBoard.snap.owner === owner) return false;
  const snap = {};
  _dtBoardEach((t, a, x, y, k) => {
    snap[k] = { s: Number(a.getAt(x, y, _DT_BOARD_COL.SOLDED)) || 0, c: Number(a.getAt(x, y, _DT_BOARD_COL.CREATED)) || 0 };
  });
  return _dtBoardLogic.track(_dtBoard, day, owner, snap);
}

// ── Rows ──
function _dtBoardStopped() {
  try {
    const api = globalThis._dtSellApi;
    return new Set(api && typeof api.keys === "function" ? api.keys() : []);
  } catch (e) {
    return new Set();
  }
}
function _dtBoardUnderContract() {
  const b = _dtBoardArr("ArrayBatchCompany");
  const end = b ? Number(b.getAt(1, 0, 0)) : NaN;
  return isFinite(end) && _dtBoardToday() <= end;
}
function _dtBoardProfit(solded, sell, cost, key) {
  try {
    const api = globalThis._dtSellApi;
    if (api && typeof api.profit === "function") return api.profit(key, solded, sell, cost);
  } catch (e) {}
  const e = { solded: solded, sell: sell, cost: cost };
  if (typeof _slotProfit === "function") return _slotProfit(e);
  const m = sell - cost;
  return Math.round(solded * (m > 0 ? m : 0));
}
function _dtBoardRows() {
  const C = _DT_BOARD_COL, L = _dtBoardLogic;
  const stopped = _dtBoardStopped();
  const cfg = typeof _cfg7 === "object" ? _cfg7 : null;
  const contract = _dtBoardUnderContract();
  const rows = [];
  _dtBoardEach((t, a, x, y, k) => {
    const pop = Number(a.getAt(x, y, C.POP)) || 0;
    const off = !(pop > 0);
    if (off && !stopped.has(k)) return; // ran out of popularity on its own: not on sale
    const solded = Number(a.getAt(x, y, C.SOLDED)) || 0, created = Number(a.getAt(x, y, C.CREATED)) || 0;
    const sell = Number(a.getAt(x, y, C.SELL)) || 0, cost = Number(a.getAt(x, y, C.COST)) || 0;
    const rate = off ? null : L.perDay(_dtBoard.hist.get(k));
    const restock = !off && L.restocks(cfg, contract, pop, cost, sell);
    rows.push({
      key: k, t: t, x: x, y: y, off: off,
      name: String(a.getAt(x, y, C.NAME) || ""), year: L.year(a.getAt(x, y, C.DATE)),
      price: sell, cost: cost, stock: Math.max(0, created - solded), solded: solded,
      pop: Math.round(pop), rate: rate, restock: restock, profit: _dtBoardProfit(solded, sell, cost, k),
    });
  });
  return rows;
}

// ── Jump to a device's Sales page (as the game's arrows: SubPage, edition, UI) ──
function _dtBoardFind(t, key) {
  const a = _dtBoardArr(t.arr);
  if (!a) return null;
  const w = a.width | 0, h = Math.min(3, a.height | 0);
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
    if (a.getAt(x, y, _DT_BOARD_COL.CREATED) === -1) continue;
    if (_dtBoardKeyAt(t, a, x, y) === key) return { x: x, y: y };
  }
  return null;
}
function _dtBoardShowPage(t, key) {
  const rt = _dtBoardRt(), at = _dtBoardFind(t, key);
  if (!rt || !at) return false;
  const g = rt.globalVars;
  g.MiniPage = 1;
  g.SubPage = at.x + 1;
  g.ColorChoose = 1;
  g.DeviceShowFlagmanID = at.y;
  rt.callFunction(t.ui);
  return true;
}
function _dtBoardJump(row) {
  const rt = _dtBoardRt();
  if (!rt) return;
  const g = rt.globalVars;
  let lay = "";
  try { lay = String(rt.layout.name || ""); } catch (e) {}
  if (lay === row.t.cls && String(g.class || "") === row.t.cls) {
    _dtBoardShowPage(row.t, row.key);
    return;
  }
  // Another type: open its screen the way the My Devices hub does (class, then
  // the layout), and page to the device once the screen has drawn itself.
  g.LastClass = lay;
  g.class = row.t.cls;
  _dtBoard.pending = { t: row.t, key: row.key, at: Date.now(), seen: 0 };
  rt.goToLayout(row.t.cls);
}
function _dtBoardPending() {
  const p = _dtBoard.pending;
  if (!p) return;
  const now = Date.now();
  if (now - p.at > 8000) {
    _dtBoard.pending = null;
    return;
  }
  let lay = "";
  try { lay = String(_dtBoardRt().layout.name || ""); } catch (e) {}
  if (lay !== p.t.cls) return;
  if (!p.seen) p.seen = now;
  // The screen's own start (My<Type>_ON) waits up to 0.35 s, then draws page 1.
  if (now - p.seen < 900) return;
  _dtBoard.pending = null;
  try { _dtBoardShowPage(p.t, p.key); } catch (e) { console.warn("[Board] page:", e); }
}

// ── Panel ──
var _DT_BOARD_CSS = `
.dt-board-btn { position: absolute; left: calc(var(--dt) * 500px); top: calc(var(--dt) * 974px); height: calc(var(--dt) * 50px);
  display: flex; align-items: center; gap: calc(var(--dt) * 22px); pointer-events: auto; cursor: pointer;
  font-family: "SofiaSansExtraCondensed-Light", "Oswald", sans-serif; font-size: calc(var(--dt) * 42px); color: #fff;
  animation: dt-fade 0.22s ease-out backwards; transition: transform 0.16s ease, filter 0.16s ease; }
.dt-board-btn:hover { filter: brightness(1.15); transform: translateY(calc(var(--dt) * -2px)); }
.dt-board-key { display: flex; align-items: center; justify-content: center; width: calc(var(--dt) * 50px); height: calc(var(--dt) * 50px);
  border: calc(var(--dt) * 3px) solid #fff; border-radius: calc(var(--dt) * 9px);
  font-family: "SofiaSansExtraCondensed-Bold", "Oswald", sans-serif; font-size: calc(var(--dt) * 28px); line-height: 1; }
/* A page of the My <Type> screen (mods-ui/mdpage.js): the game's tab strip, icon column, table cells and key hints. */
.dt-board-sum { position: absolute; left: calc(var(--dt) * 160px); top: calc(var(--dt) * 124px); width: calc(var(--dt) * 1708px);
  text-align: center; font-size: calc(var(--dt) * 26.65px); color: rgba(255, 255, 255, 0.7); white-space: nowrap; }
.dt-board-grid { display: grid; align-items: stretch; column-gap: 0.14em;
  grid-template-columns: minmax(0, 1fr) calc(var(--dt) * 150px) calc(var(--dt) * 170px) calc(var(--dt) * 180px)
    calc(var(--dt) * 260px) calc(var(--dt) * 170px) calc(var(--dt) * 250px); }
.dt-board-grid > * { display: flex; align-items: center; justify-content: center; min-width: 0; min-height: calc(var(--dt) * 48px);
  padding: 0.3em 0.5em; border-radius: 0.2em; background-color: rgba(0, 0, 0, 0.15); transition: background-color 0.14s ease; }
.dt-board-head { position: absolute; left: calc(var(--dt) * 160px); top: calc(var(--dt) * 172px); width: calc(var(--dt) * 1700px); }
.dt-board-h { gap: calc(var(--dt) * 8px); cursor: pointer; pointer-events: auto; white-space: nowrap; background-color: rgba(255, 255, 255, 0.1) !important; }
.dt-board-h:hover { background-color: rgba(255, 255, 255, 0.16) !important; }
/* The device column is left-aligned (name, then type): its heading too. */
.dt-board-h[data-col="device"] { justify-content: flex-start; padding-left: 0.7em; }
.dt-board-h.dt-on { font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif; }
.dt-board-h svg { width: calc(var(--dt) * 14px); height: calc(var(--dt) * 14px); flex: 0 0 auto; fill: #fff; }
.dt-board-scroll { position: absolute; left: calc(var(--dt) * 160px); top: calc(var(--dt) * 225px); width: calc(var(--dt) * 1708px);
  height: calc(var(--dt) * 660px); padding-right: calc(var(--dt) * 8px); }
.dt-board-row { margin-bottom: 0.2em; cursor: pointer; }
.dt-board-row:hover > * { background-color: rgba(255, 255, 255, 0.08); }
.dt-board-row:active > * { background-color: rgba(255, 255, 255, 0.12); }
.dt-board-c { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.dt-board-dev { justify-content: flex-start !important; gap: calc(var(--dt) * 12px); padding-left: 0.7em !important; }
.dt-board-name { flex: 0 1 auto; font-family: "SofiaSansExtraCondensed-Regular", "Oswald", sans-serif; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dt-board-type { flex: 0 10 auto; color: rgba(255, 255, 255, 0.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dt-board-mute { color: rgba(255, 255, 255, 0.45); }
.dt-board-ok { color: rgb(168, 212, 24); }
.dt-board-warn { color: rgb(255, 158, 20); }
.dt-board-row.dt-board-offrow > * { color: rgba(255, 255, 255, 0.5); }
.dt-board-offtag { color: rgb(255, 120, 120); }
.dt-board-empty { padding: calc(var(--dt) * 160px) 0; text-align: center; font-size: calc(var(--dt) * 30px); color: rgba(255, 255, 255, 0.62); }
.dt-board-note { position: absolute; left: calc(var(--dt) * 160px); top: calc(var(--dt) * 900px); width: calc(var(--dt) * 1708px);
  text-align: center; font-size: calc(var(--dt) * 22px); color: rgba(255, 255, 255, 0.62); }
.dt-board-pane { position: absolute; inset: 0; }
`;
var _DT_BOARD_HEADS = ["device", "price", "perDay", "stock", "runs", "pop", "profit"];
function _dtBoardEsc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function _dtBoardCss() {
  if (document.getElementById("dt-board-css")) return;
  const st = document.createElement("style");
  st.id = "dt-board-css";
  st.textContent = _DT_BOARD_CSS;
  document.head.appendChild(st);
}
function _dtBoardLastsCell(r) {
  if (r.off) return '<span class="dt-board-offtag">' + _dtBoardEsc(_dtBoardT("off")) + "</span>";
  const o = _dtBoardLogic.runsOut(r.stock, r.rate, r.restock);
  if (o.k === "restock") return '<span class="dt-board-ok">' + _dtBoardEsc(_dtBoardT("restock")) + "</span>";
  if (o.k === "out") return '<span class="dt-board-warn">' + _dtBoardEsc(_dtBoardT("out")) + "</span>";
  if (o.k === "wait") return '<span class="dt-board-mute">' + _dtBoardEsc(_dtBoardT("counting")) + "</span>";
  if (o.k === "idle") return '<span class="dt-board-mute">' + _dtBoardEsc(_dtBoardT("idle")) + "</span>";
  const txt = o.n === 1 ? _dtBoardT("day1") : _dtBoardT("days", { n: _dtBoardLogic.num(o.n) });
  return '<span class="' + (o.n <= 7 ? "dt-board-warn" : "") + '">' + _dtBoardEsc(txt) + "</span>";
}
function _dtBoardRender() {
  const v = _dtBoard.view;
  if (!v || !v.scroll.isConnected) return;
  const L = _dtBoardLogic;
  const every = _dtBoardRows();
  // The icon column: All, then each type with something on the board.
  const kinds = _DT_BOARD_TYPES.filter((t) => every.some((r) => r.t === t)).map((t) => t.k);
  if (_dtBoard.type !== "all" && kinds.indexOf(_dtBoard.type) < 0) _dtBoard.type = "all";
  const sig = kinds.join(",") + "|" + _dtBoard.type;
  if (v.icons && v.iconSig !== sig) {
    v.iconSig = sig;
    v.icons.innerHTML = "";
    const items = [{ id: "all", label: _dtBoardT("all") }].concat(kinds.map((k) => ({ id: k, label: _dtBoardT(k) })));
    _dtMdp.icons(v.icons, items, _dtBoard.type, (id) => {
      _dtBoard.type = id;
      v.scroll.scrollTop = 0;
      _dtBoardRender();
    });
  }
  const rows = L.sortRows(_dtBoard.type === "all" ? every : every.filter((r) => r.t.k === _dtBoard.type), _dtBoard.sort, _dtBoard.dir);
  v.rows = rows;
  // Header: the sort column in the heavier weight with the game's small triangle.
  for (const h of v.heads) {
    const on = h.dataset.col === _dtBoard.sort;
    h.classList.toggle("dt-on", on);
    const arrow = on ? (_dtBoard.dir === "asc" ? "M5 16h14l-7-9z" : "M5 8h14l-7 9z") : "";
    h.innerHTML = "<span>" + _dtBoardEsc(_dtBoardT(h.dataset.col)) + "</span>" +
      (arrow ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + arrow + '"/></svg>' : "");
  }
  const live = rows.filter((r) => !r.off);
  // The day total is only a total once every row on sale has been measured; until then "…" like those rows.
  let units = 0, profit = 0, counted = live.length > 0;
  for (const r of live) {
    if (r.rate !== null) units += r.rate;
    else counted = false;
    profit += r.profit;
  }
  v.sum.textContent = live.length || rows.length
    ? _dtBoardT("sum", { n: L.num(live.length), u: counted ? L.rate(units) : "…", p: L.money(profit) })
    : "";
  if (!rows.length) {
    v.scroll.innerHTML = '<div class="dt-board-empty">' + _dtBoardEsc(_dtBoardT("empty")) + "</div>";
    return;
  }
  let html = "";
  rows.forEach((r, i) => {
    const type = _dtBoardT(r.t.k) + (r.year ? " · " + r.year : "");
    const rate = r.off ? "—" : r.rate === null ? '<span class="dt-board-mute">…</span>' : _dtBoardEsc(L.rate(r.rate));
    html += '<div class="dt-board-row dt-board-grid' + (r.off ? " dt-board-offrow" : "") + '" data-i="' + i + '">' +
      '<div class="dt-board-dev"><span class="dt-board-name">' + _dtBoardEsc(r.name) + '</span><span class="dt-board-type">' + _dtBoardEsc(type) + "</span></div>" +
      '<div class="dt-board-c">' + _dtBoardEsc(L.money(r.price)) + "</div>" +
      '<div class="dt-board-c">' + rate + "</div>" +
      '<div class="dt-board-c">' + _dtBoardEsc(L.num(r.stock)) + "</div>" +
      '<div class="dt-board-c">' + _dtBoardLastsCell(r) + "</div>" +
      '<div class="dt-board-c">' + _dtBoardEsc(r.pop + "%") + "</div>" +
      '<div class="dt-board-c">' + _dtBoardEsc(L.money(r.profit)) + "</div>" +
      "</div>";
  });
  const pos = v.scroll.scrollTop;
  v.scroll.innerHTML = html;
  v.scroll.scrollTop = pos;
}
function _dtBoardOpen() {
  if (_dtUi.isOpen() || !_dtBoardRt()) return;
  _dtBoardSample();
  _dtBoardCss();
  const m = _dtUi.modal({
    title: _dtBoardT("title"),
    dismiss: false,
    onClose: () => { _dtBoard.view = null; },
  });
  // A page of the My <Type> screen, like Compare: tab strip, icon column, table, "ESC  Back".
  const pg = _dtMdp.page(m);
  if (!pg) return;
  const body = pg.body;
  const sum = _dtUi.el("div", "dt-board-sum", body);
  const icons = _dtUi.el("div", "", body);
  const head = _dtUi.el("div", "dt-board-head dt-board-grid", body);
  const heads = _DT_BOARD_HEADS.map((col) => {
    const h = _dtUi.el("div", "dt-board-h", head);
    h.dataset.col = col;
    h.addEventListener("pointerover", () => { try { globalThis.tapHover && globalThis.tapHover(); } catch (e) {} });
    h.addEventListener("click", (ev) => {
      ev.stopPropagation();
      try { globalThis.tapMain && globalThis.tapMain(); } catch (e) {}
      if (_dtBoard.sort === col) _dtBoard.dir = _dtBoard.dir === "desc" ? "asc" : "desc";
      else {
        _dtBoard.sort = col;
        _dtBoard.dir = col === "device" ? "asc" : "desc";
      }
      _dtBoardRender();
    });
    return h;
  });
  const scroll = _dtUi.el("div", "dt-board-scroll dt-mdp-scroll", body);
  scroll.addEventListener("click", (ev) => {
    const el = ev.target && ev.target.closest ? ev.target.closest(".dt-board-row") : null;
    const v = _dtBoard.view;
    if (!el || !v || !v.rows) return;
    const r = v.rows[Number(el.dataset.i)];
    if (!r) return;
    ev.stopPropagation();
    try { globalThis.tapMain && globalThis.tapMain(); } catch (e) {}
    _dtUi.close(true);
    _dtBoardJump(r);
  });
  const note = _dtUi.el("div", "dt-board-note", body, _dtBoardT("note", { d: _DT_BOARD_DAYS }));
  _dtBoard.view = { sum: sum, heads: heads, scroll: scroll, rows: [], day: _dtBoardToday(), icons: icons, iconSig: "" };
  _dtMdp.back(pg.keys);
  _dtBoardTabsInit(body, [sum, icons, head, scroll, note], pg.keys);
  _dtBoardRender();
}

// ── Extra tabs: another patch adds one with globalThis._dtBoardTabs.push({id, label, render}) ──
// "My devices" plus each tab sit in the game's tab strip; picking a tab hides the
// board's own parts and calls render(pane, {keys}) on an empty pane (label is a
// string or {en, ru}; keys is the key-hint row). ESC Back, Escape and leaving
// the screen close the board as usual.
var _DT_BOARD_TAB_MINE = { en: "My devices", ru: "Мои устройства" };
var _dtBoardTab = { id: "" }; // the last picked tab, for this session
if (!Array.isArray(globalThis._dtBoardTabs)) globalThis._dtBoardTabs = [];
function _dtBoardTabsInit(body, own, keys) {
  const list = globalThis._dtBoardTabs.filter((t) => t && t.id && typeof t.render === "function");
  const pane = _dtUi.el("div", "dt-board-pane", body);
  const tabs = [{ id: "", label: _DT_BOARD_TAB_MINE }].concat(list);
  const label = (t) => (typeof t.label === "string" ? t.label : _dtUi.t(t.label));
  // A tab's key hints go after "ESC  Back" and leave with the tab.
  const back = keys.firstChild;
  const pick = (id) => {
    const tab = tabs.find((t) => t.id === id) || tabs[0];
    _dtBoardTab.id = tab.id;
    for (const n of own) n.style.display = tab.id ? "none" : "";
    while (keys.lastChild && keys.lastChild !== back) keys.lastChild.remove();
    pane.style.display = tab.id ? "" : "none";
    pane.innerHTML = "";
    if (!tab.id) return _dtBoardRender();
    try { tab.render(pane, { keys: keys }); } catch (e) { console.warn("[Board] tab " + tab.id + ":", e); }
  };
  const start = (tabs.find((t) => t.id === _dtBoardTab.id) || tabs[0]).id;
  _dtMdp.strip(body, tabs.map((t) => ({ id: t.id, label: label(t) })), start, pick);
  pick(start);
}

// ── Keycap on the My <Type> screens ──
function _dtBoardScreen() {
  const rt = _dtBoardRt();
  if (!rt) return false;
  let lay = "";
  try { lay = String(rt.layout.name || ""); } catch (e) {}
  return _DT_BOARD_SCREENS.indexOf(lay) >= 0 && String(rt.globalVars.class || "") === lay;
}
function _dtBoardBtnRemove() {
  if (_dtBoard.btn) _dtBoard.btn.remove();
  _dtBoard.btn = null;
}
// Right of "C  Compare" with the same gap it keeps from "ESC  Back".
function _dtBoardPlace(layer) {
  const b = _dtBoard.btn;
  const cmp = layer.querySelector(".dt-cmp-btn");
  const lr = layer.getBoundingClientRect(), dt = lr.width / 1920 || 1;
  let left = 500 * dt;
  if (cmp) {
    const r = cmp.getBoundingClientRect();
    if (r.width > 0) left = r.right - lr.left + 40 * dt;
  }
  const px = Math.round(left) + "px";
  if (b.style.left !== px) b.style.left = px;
}
function _dtBoardTick() {
  _dtBoardSample();
  _dtBoardPending();
  const v = _dtBoard.view;
  if (v) {
    // Leaving the My <Type> screens (a row tap, the game moving on) closes the board.
    if (!v.scroll.isConnected) _dtBoard.view = null;
    else if (!_dtBoardScreen()) _dtUi.close(true);
    else if (v.day !== _dtBoardToday()) {
      v.day = _dtBoardToday();
      _dtBoardRender();
    }
  }
  if (!_dtBoardScreen() || _dtUi.isOpen() || _dtBoard.pending) return _dtBoardBtnRemove();
  const layer = _dtUi.ensure();
  if (!_dtBoard.btn || !_dtBoard.btn.isConnected) {
    _dtUi.fit();
    _dtBoardCss();
    const b = _dtUi.el("div", "dt-board-btn", layer);
    _dtUi.el("div", "dt-board-key", b, "B");
    _dtUi.el("span", "", b, _dtBoardT("btn"));
    b.title = _dtBoardT("tip");
    b.addEventListener("pointerover", () => { try { globalThis.tapHover && globalThis.tapHover(); } catch (e) {} });
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      try { globalThis.tapMain && globalThis.tapMain(); } catch (e) {}
      _dtBoardOpen();
    });
    _dtBoard.btn = b;
  }
  _dtBoardPlace(layer);
}
// Escape closes the board (never reaching the game's Back underneath); B opens it.
function _dtBoardKey(ev) {
  if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (_dtBoard.view) {
    // A tab's own key hints ("M  Only my types") answer their letter.
    if (/^[a-z]$/i.test(ev.key) && _dtUi.isOpen()) {
      const caps = _dtBoard.view.scroll.closest(".dt-body").querySelectorAll(".dt-mdp-key");
      for (const k of caps) {
        if (k.firstChild && k.firstChild.textContent === ev.key.toUpperCase()) {
          ev.preventDefault();
          ev.stopPropagation();
          k.click();
          return;
        }
      }
    }
    if (ev.key === "Escape" && _dtUi.isOpen()) {
      ev.preventDefault();
      ev.stopPropagation();
      try { globalThis.tapBack && globalThis.tapBack(); } catch (e) {}
      _dtUi.close();
    }
    return;
  }
  if ((ev.key === "b" || ev.key === "B") && _dtBoard.btn && _dtBoard.btn.isConnected && !_dtUi.isOpen()) {
    const tag = ev.target && ev.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    ev.stopPropagation();
    _dtBoardOpen();
  }
}
(function () {
  globalThis._dtBoardApi = {
    logic: _dtBoardLogic, rows: _dtBoardRows, sample: _dtBoardSample, open: _dtBoardOpen, jump: _dtBoardJump,
    state: () => _dtBoard, types: _DT_BOARD_TYPES,
  };
  if (_dtBoard.timer || typeof document === "undefined") return;
  document.addEventListener("keydown", _dtBoardKey, true);
  // The shared mod timer (ui.js every) when ui.js is in; a timer of our own without it.
  _dtBoard.timer = (typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(() => {
    try { _dtBoardTick(); } catch (e) {}
  }, 250);
})();
