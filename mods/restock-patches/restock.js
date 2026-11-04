// ── Restock (DEVICES_TYCOON_RESTOCK) ──
// A restock rule per device: Auto (the game's own _handleBatchSoldOut, as
// before), Careful (smaller orders that never take cash below a safety line)
// or Off (no restock: the device sells out and stays sold out). The rule is
// picked in a "Restock" row of the game's own table on a device's Sales tab and
// shown on its Sales board row. Every restock the game makes on its own (self restock, which it
// never announces) is shown in one toast per game day: "Restocked 40k Ember 7
// ($9.2M)". Contract restocks already have the game's own message.
// Rules are kept per company in ArraySaves row 156 ({v, company, modes}); only
// Careful/Off devices are written, so old saves load as Auto everywhere.
// Hooks (checked by prepare.py): _handleBatchSoldOut and tickDeviceSales are
// rebound here; Sell's _dtSellTick and Board's _dtBoardRows/_dtBoardRender are
// wrapped when those mods are in the build.
var _DT_RESTOCK_ROW = 156;
var _DT_RESTOCK_COL = { CREATED: 0, POP: 2, COST: 3, SELL: 4, RELEASE: 7, NAME: 8, ID: 10 };
// Careful, against the game's Auto (_cfg7): every order half the size (6% of
// the first batch instead of 12%, 12.5% instead of 25% under contract, at least
// 1.5 days of sales instead of 3, 2.5 days instead of 5 once demand is used up);
// at most 15% of cash a day on restocks instead of 35%; never into debt (Auto
// restocks on credit when cash is below zero); and never below a cash line of
// two months of wages (the only regular bill; offices have no rent), at least
// $1M, so a sales slump can still pay the staff.
var _DT_RESTOCK_CAREFUL = { SELF_PCT: 0.06, MAX_PCT: 0.125, COVER_DAYS: 1.5, TAIL_COVER: 2.5, DAY_PCT: 0.15, LINE_MONTHS: 2, LINE_MIN: 1e6 };
var _DT_RESTOCK_MODES = ["auto", "careful", "off"];
var _DT_RESTOCK_TEXT = {
  title: { en: "Restock", ru: "Пополнение" },
  auto: { en: "Auto", ru: "Авто" },
  careful: { en: "Careful", ru: "Осторожно" },
  off: { en: "Off", ru: "Выкл." },
  autoSub: { en: "Restock Auto: when it sells out, the game buys more with up to 35% of your cash.", ru: "Пополнение «Авто»: при распродаже игра докупает партию, до 35% ваших денег." },
  carefulSub: { en: "Restock Careful: half-size orders, at most 15% of your cash a day, never below {line} in the bank.", ru: "Пополнение «Осторожно»: партии вдвое меньше, до 15% денег в день, на счёте не меньше {line}." },
  offSub: { en: "Restock Off: no more stock. It sells out and stays sold out.", ru: "Пополнение выключено: распродаётся и больше не продаётся." },
  lossSub: { en: "No restock at this price: the game only buys more stock when the price is above cost.",
    ru: "При этой цене пополнения нет: игра докупает партию, только когда цена выше себестоимости." },
  boardauto: { en: "Auto restock", ru: "Автопополнение" },
  boardcareful: { en: "Careful restock", ru: "Осторожное пополнение" },
  boardoff: { en: "No restock", ru: "Без пополнения" },
  one: { en: "Restocked {u} {n} ({c})", ru: "Пополнено: {n}, {u} шт. ({c})" },
  many: { en: "Restocked {k} devices for {c}: {list}", ru: "Пополнено устройств: {k} на {c}: {list}" },
  item: { en: "{u}\u00A0{n}", ru: "{n}\u00A0{u}" },
  more: { en: "{list} and {m} more", ru: "{list} и ещё {m}" },
};

// ── Pure rules (no game access; unit tested) ──
var _dtRestockLogic = (function () {
  const C = _DT_RESTOCK_CAREFUL;
  // Same edition key as Sell and Board: array, game ID (column 10), release day.
  function key(arrName, id, release, name) {
    const n = Number(id);
    return arrName + (n > 0 ? "#" + n : "|" + String(name || "")) + "@" + Math.round(Number(release) || 0);
  }
  // Row 156 text -> {key: "careful" | "off"} for this company (anything else: all Auto).
  function parse(raw, company) {
    const out = {};
    if (typeof raw !== "string" || raw.charAt(0) !== "{") return out;
    try {
      const j = JSON.parse(raw);
      if (!j || j.v !== 1 || j.company !== company || !j.modes || typeof j.modes !== "object") return out;
      for (const k of Object.keys(j.modes)) {
        const m = j.modes[k];
        if (k.length > 0 && k.length < 200 && (m === "careful" || m === "off")) out[k] = m;
      }
    } catch (e) {}
    return out;
  }
  function serialize(modes, company) {
    const keep = {};
    let n = 0;
    for (const k of Object.keys(modes)) if (modes[k] === "careful" || modes[k] === "off") { keep[k] = modes[k]; n++; }
    return n ? JSON.stringify({ v: 1, company: String(company || ""), modes: keep }) : "";
  }
  // The cash Careful never spends below: two months of wages, at least $1M.
  function cashLine(monthlyWages) {
    const w = Number(monthlyWages);
    return Math.max(C.LINE_MIN, Math.round((w > 0 ? w : 0) * C.LINE_MONTHS));
  }
  // The game's restock settings for one Careful order, or null for no order.
  // budget = cash at the start of the day, d = the day's tick state (earned so
  // far, restockCost, contractFee). The game spends at most
  // budget * RESTOCK_BUDGET_PCT - restockCost, so that share is set to give
  // the smaller of: 15% of cash a day, and the cash above the line.
  function carefulCfg(cfg, budget, d, line) {
    const l = Number(budget);
    if (!cfg || !(l > 0)) return null;
    const spent = Number(d && d.restockCost) || 0, fees = Number(d && d.contractFee) || 0, earned = Number(d && d.earned) || 0;
    const cap = Math.min(l * C.DAY_PCT - spent, l + earned - spent - fees - line);
    if (!(cap > 0)) return null;
    return Object.assign({}, cfg, {
      RESTOCK_SELF_PCT: C.SELF_PCT, RESTOCK_MAX_PCT: C.MAX_PCT, RESTOCK_COVER_DAYS: C.COVER_DAYS, RESTOCK_TAIL_COVER: C.TAIL_COVER,
      RESTOCK_BUDGET_PCT: (cap + spent) / l, RESTOCK_NEG_DEBT: false, RESTOCK_NEG_REINVEST: 0,
    });
  }
  // 40k, 4.5k, 1.2M: units in a toast.
  function short(n) {
    const v = Math.round(Number(n) || 0);
    const one = (x) => { const r = Math.round(x * 10) / 10; return r % 1 === 0 ? String(r) : r.toFixed(1); };
    if (v < 1000) return String(v);
    // A value that rounds up to 1000 moves to the next unit: 999.6k is "1M", not "1000k".
    if (v < 1e6 && Math.round(v / 1e3) < 1000) return v < 1e4 ? one(v / 1e3) + "k" : Math.round(v / 1e3) + "k";
    if (v < 1e9 && Math.round(v / 1e5) < 1e4) return one(v / 1e6) + "M";
    return one(v / 1e9) + "B";
  }
  function money(n) {
    return "$" + short(Math.abs(Number(n) || 0));
  }
  // One toast for a day's restocks: [{name, units, cost}] -> text (or "").
  function toastText(list, t) {
    if (!list || !list.length) return "";
    if (list.length === 1) return t("one", { u: short(list[0].units), n: list[0].name, c: money(list[0].cost) });
    let total = 0;
    for (const r of list) total += r.cost;
    const top = list.slice().sort((a, b) => b.cost - a.cost);
    const shown = top.slice(0, 3).map((r) => t("item", { u: short(r.units), n: r.name })).join(", ");
    const items = top.length > 3 ? t("more", { list: shown, m: top.length - 3 }) : shown;
    return t("many", { k: list.length, c: money(total), list: items });
  }
  return { key, parse, serialize, cashLine, carefulCfg, short, money, toastText };
})();

var _dtRestock = { modes: {}, slot: -1, company: "", raw: null, today: [], line: null, lineDay: -1, wrapped: false, timer: 0 };

function _dtRestockT(k, vars) {
  return _dtUi.t(_DT_RESTOCK_TEXT[k], vars);
}
function _dtRestockRt() {
  return globalThis.runtime || null;
}
function _dtRestockArr(name) {
  try {
    const o = _dtRestockRt().objects[name];
    return o ? o.getFirstInstance() : null;
  } catch (e) {
    return null;
  }
}

// ── Save row 156 ──
function _dtRestockSlotNow() {
  return Math.max(0, Math.min(2, Math.round(_dtUi.num("SaveSlot", 0)) || 0));
}
function _dtRestockCompanyNow() {
  return String(_dtUi.gv("CompanyName", "") || "");
}
// The row is the truth (a loaded save replaces it): parse again whenever it changes.
function _dtRestockLoad(force) {
  const slot = _dtRestockSlotNow(), company = _dtRestockCompanyNow();
  let raw = "";
  const a = _dtRestockArr("ArraySaves");
  try {
    if (a && a.height > _DT_RESTOCK_ROW && a.width > slot) raw = a.getAt(slot, _DT_RESTOCK_ROW, 0);
  } catch (e) {}
  if (!force && slot === _dtRestock.slot && company === _dtRestock.company && raw === _dtRestock.raw) return;
  _dtRestock.slot = slot;
  _dtRestock.company = company;
  _dtRestock.raw = raw;
  _dtRestock.modes = _dtRestockLogic.parse(raw, company);
}
// Nothing is written until the first device leaves Auto, so other saves stay as they were.
function _dtRestockSave() {
  const a = _dtRestockArr("ArraySaves"), slot = _dtRestockSlotNow();
  if (!a || a.height <= _DT_RESTOCK_ROW || a.width <= slot) return console.warn("[Restock] no ArraySaves row", _DT_RESTOCK_ROW);
  const raw = _dtRestockLogic.serialize(_dtRestock.modes, _dtRestockCompanyNow());
  if (raw === "" && !a.getAt(slot, _DT_RESTOCK_ROW, 0)) return void (_dtRestock.raw = a.getAt(slot, _DT_RESTOCK_ROW, 0));
  a.setAt(raw, slot, _DT_RESTOCK_ROW, 0);
  _dtRestock.raw = raw;
}
// A New Game in a used slot must not keep the old company's rules: ArraySaves
// is not reset by the game, so clear the row during LOADING GAME (as Launch and Queue do).
function _dtRestockNewGame() {
  const rt = _dtRestockRt();
  if (!rt || !rt.globalVars || String(rt.layout && rt.layout.name) !== "LOADING GAME") return;
  if (String(rt.globalVars.LoadingType || "").toUpperCase() !== "NEW GAME") return;
  const a = _dtRestockArr("ArraySaves"), slot = _dtRestockSlotNow();
  try {
    const v = a && a.height > _DT_RESTOCK_ROW && a.width > slot ? a.getAt(slot, _DT_RESTOCK_ROW, 0) : "";
    if (v !== "" && v !== 0) a.setAt("", slot, _DT_RESTOCK_ROW, 0);
  } catch (e) {}
  _dtRestock.modes = {};
  _dtRestock.slot = -1;
  _dtRestock.raw = null;
}

// ── Modes ──
function _dtRestockKeyAt(arrName, a, x, y) {
  const C = _DT_RESTOCK_COL;
  let id = 0;
  try {
    if ((a.depth | 0) > C.ID) id = a.getAt(x, y, C.ID);
  } catch (e) {}
  return _dtRestockLogic.key(arrName, id, a.getAt(x, y, C.RELEASE), a.getAt(x, y, C.NAME));
}
function _dtRestockMode(key) {
  _dtRestockLoad();
  return _dtRestock.modes[key] || "auto";
}
// Editions of model x (rows 0-2 that exist).
function _dtRestockEditions(a, x) {
  const out = [];
  const h = Math.min(3, a.height | 0);
  for (let y = 0; y < h; y++) {
    if (a.getAt(x, y, _DT_RESTOCK_COL.CREATED) === -1) continue;
    if (y > 0 && a.getAt(x, y, _DT_RESTOCK_COL.RELEASE) === -1 && a.getAt(x, y, _DT_RESTOCK_COL.NAME) === "") continue;
    out.push(y);
  }
  return out;
}
// One rule for every edition of a model, like Stop selling.
function _dtRestockSetModel(arrName, a, x, mode) {
  if (_DT_RESTOCK_MODES.indexOf(mode) < 0) return 0;
  _dtRestockLoad();
  let n = 0;
  for (const y of _dtRestockEditions(a, x)) {
    const k = _dtRestockKeyAt(arrName, a, x, y);
    if (mode === "auto") delete _dtRestock.modes[k];
    else _dtRestock.modes[k] = mode;
    n++;
  }
  if (n) _dtRestockSave();
  return n;
}
function _dtRestockModelMode(arrName, a, x, prefer) {
  const ys = _dtRestockEditions(a, x);
  const y = ys.indexOf(prefer) >= 0 ? prefer : ys[0];
  return y === undefined ? "auto" : _dtRestockMode(_dtRestockKeyAt(arrName, a, x, y));
}

// ── The game's restock, per rule ──
// The array's name: the tick's slot key starts with it ("ArraySmartphones:id6").
function _dtRestockArrName(a, slot) {
  const s = typeof slot === "string" ? slot.split(":")[0] : "";
  if (s && _dtRestockArr(s) === a) return s;
  const names = typeof DEVICE_ARRAYS !== "undefined" ? DEVICE_ARRAYS.map((e) => e.name) : [];
  for (const n of names) if (_dtRestockArr(n) === a) return n;
  return s;
}
// Worked out once per game day (wages change on hiring, not by the minute).
function _dtRestockCashLine(rt) {
  const day = _dtUi.num("DayTotal", 0);
  if (_dtRestock.line === null || _dtRestock.lineDay !== day) {
    _dtRestock.lineDay = day;
    let wages = 0;
    try {
      if (typeof estimateSalaryNow === "function") wages = Number(estimateSalaryNow(rt).total) || 0;
    } catch (e) {}
    _dtRestock.line = _dtRestockLogic.cashLine(wages);
  }
  return _dtRestock.line;
}
function _dtRestockWrap() {
  if (_dtRestock.wrapped || typeof _handleBatchSoldOut !== "function" || typeof tickDeviceSales !== "function") return;
  _dtRestock.wrapped = true;
  const orig = _handleBatchSoldOut;
  // (runtime, array, x, edition, day, stock made, POP, rating, price, settings, day state, slot key, ...)
  _handleBatchSoldOut = function (rt, a, x, y, day, made, pop, rating, sell, cfg, d, slot) {
    const args = Array.prototype.slice.call(arguments);
    let mode = "auto", name = "";
    try {
      name = _dtRestockArrName(a, slot);
      if (name) mode = _dtRestockMode(_dtRestockKeyAt(name, a, x, y));
      if (mode === "careful") {
        let budget = 0;
        try { budget = Number(rt.globalVars.Budget) || 0; } catch (e) {}
        const c = _dtRestockLogic.carefulCfg(cfg, budget, d, _dtRestockCashLine(rt));
        if (c) args[9] = c;
        else args[6] = 0; // nothing to spend today: as if POP were too low to restock
      } else if (mode === "off") {
        args[6] = 0; // below RESTOCK_MIN_POP: no order, the game's own sold-out message still comes
      }
    } catch (e) {
      console.warn("[Restock] rule:", e);
    }
    const spent = d ? Number(d.restockCost) || 0 : 0;
    const out = orig.apply(this, args);
    try {
      const units = Number(a.getAt(x, y, _DT_RESTOCK_COL.CREATED)) - Number(made);
      const cost = (d ? Number(d.restockCost) || 0 : 0) - spent;
      // Self restocks only: a contract restock already shows the game's own message.
      if (units > 0 && cost > 0 && !(day <= d.contractEnd))
        _dtRestock.today.push({ name: String(a.getAt(x, y, _DT_RESTOCK_COL.NAME) || ""), units: units, cost: cost });
    } catch (e) {}
    return out;
  };
  globalThis._handleBatchSoldOut = _handleBatchSoldOut;
  const tick = tickDeviceSales;
  tickDeviceSales = function () {
    _dtRestock.today = [];
    const out = tick.apply(this, arguments);
    try {
      _dtRestockAnnounce();
    } catch (e) {
      console.warn("[Restock] toast:", e);
    }
    return out;
  };
  globalThis.tickDeviceSales = tickDeviceSales;
}
// One toast for all of the day's restocks (ui.js keeps it clear of the game's cards).
function _dtRestockAnnounce() {
  const list = _dtRestock.today;
  _dtRestock.today = [];
  if (!list.length) return "";
  const text = _dtRestockLogic.toastText(list, _dtRestockT);
  let total = 0;
  for (const r of list) total += r.cost;
  if (text) _dtUi.toast(text, list.length === 1 ? list[0].name : _dtRestockLogic.money(total));
  return text;
}

// ── Restock row in the game's device table (Sales tab, Sell's rows) ──
var _DT_RESTOCK_CSS = `
.dt-board-rmode-careful { color: rgba(255, 255, 255, 0.52); }
.dt-board-rmode-off { color: rgb(255, 158, 20); }
`;
function _dtRestockCss() {
  if (document.getElementById("dt-restock-css")) return;
  const st = document.createElement("style");
  st.id = "dt-restock-css";
  st.textContent = _DT_RESTOCK_CSS;
  document.head.appendChild(st);
}
function _dtRestockSub(mode) {
  if (mode === "careful") return _dtRestockT("carefulSub", { line: _dtRestockLogic.money(_dtRestockCashLine(_dtRestockRt())) });
  return _dtRestockT(mode + "Sub");
}
// One step along Auto / Careful / Off for the device on screen (the arrows wrap round).
function _dtRestockStep(d) {
  const v = typeof _dtSellView === "function" ? _dtSellView() : null;
  if (!v) return;
  const M = _DT_RESTOCK_MODES, now = _dtRestockModelMode(v.t.arr, v.a, v.x, v.flag);
  _dtRestockSetModel(v.t.arr, v.a, v.x, M[(M.indexOf(now) + d + M.length) % M.length]);
  if (typeof _dtSellRows === "function") _dtSellRows();
}
function _dtRestockWrapSell() {
  if (_dtRestock.sellWrapped || typeof _dtSellTick !== "function") return;
  _dtRestock.sellWrapped = true;
  const orig = _dtSellTick;
  // Sell's 250 ms timer calls _dtSellTick by name and runs on every layout, so it carries the New Game clear.
  _dtSellTick = function () {
    try { _dtRestockNewGame(); } catch (e) {}
    return orig.apply(this, arguments);
  };
  // "Restock  < Auto >" in front of Sell's "On sale" row while the device is on sale,
  // and the grey line under the table says what the rule does.
  if (typeof _dtSellRowSpecs === "function") {
    const specs = _dtSellRowSpecs;
    _dtSellRowSpecs = function (v, state) {
      const out = specs.apply(this, arguments);
      try {
        if (state === "selling") {
          const mode = _dtRestockModelMode(v.t.arr, v.a, v.x, v.flag);
          const prev = () => _dtRestockStep(-1), next = () => _dtRestockStep(1);
          out.unshift({ id: "restock", label: _dtRestockT("title"), value: _dtRestockT(mode), prev: prev, next: next, open: next });
        }
      } catch (e) {}
      return out;
    };
  }
  if (typeof _dtSellNoteText === "function") {
    const note = _dtSellNoteText;
    _dtSellNoteText = function (v, state) {
      const out = note.apply(this, arguments);
      try {
        if (!out && state === "selling") {
          const mode = _dtRestockModelMode(v.t.arr, v.a, v.x, v.flag);
          // _handleBatchSoldOut buys more only while the price is above the cost price.
          const C = _DT_RESTOCK_COL, ys = _dtRestockEditions(v.a, v.x), y = ys.indexOf(v.flag) >= 0 ? v.flag : ys[0];
          const cost = y === undefined ? 0 : Number(v.a.getAt(v.x, y, C.COST));
          if (mode !== "off" && cost > 0 && Number(v.a.getAt(v.x, y, C.SELL)) <= cost) return _dtRestockT("lossSub");
          return _dtRestockSub(mode);
        }
      } catch (e) {}
      return out;
    };
  }
}

// ── Sales board: the rule on each row; Off never says "Restocking", nor Careful at or below its cash line ──
function _dtRestockWrapBoard() {
  if (_dtRestock.boardWrapped || typeof _dtBoardRows !== "function" || typeof _dtBoardRender !== "function") return;
  _dtRestock.boardWrapped = true;
  const rows = _dtBoardRows;
  _dtBoardRows = function () {
    const out = rows.apply(this, arguments);
    let careful = null; // Careful's own gate at the start of a day (cash vs the line), once per call
    for (const r of out) {
      r.rmode = _dtRestockMode(r.key);
      if (r.rmode === "off") r.restock = false;
      else if (r.rmode === "careful" && r.restock) {
        if (careful === null) {
          const rt = _dtRestockRt();
          careful = !!rt && _dtRestockLogic.carefulCfg({}, _dtUi.num("Budget", 0), null, _dtRestockCashLine(rt)) !== null;
        }
        r.restock = careful;
      }
    }
    return out;
  };
  const render = _dtBoardRender;
  _dtBoardRender = function () {
    const out = render.apply(this, arguments);
    try {
      const v = _dtBoard.view;
      if (!v || !v.scroll || !v.rows) return out;
      _dtRestockCss();
      for (const el of v.scroll.querySelectorAll(".dt-board-row")) {
        const r = v.rows[Number(el.dataset.i)], type = el.querySelector(".dt-board-type");
        if (!r || r.off || !type || type.querySelector(".dt-board-rmode")) continue;
        type.appendChild(document.createTextNode(" · "));
        _dtUi.el("span", "dt-board-rmode dt-board-rmode-" + r.rmode, type, _dtRestockT("board" + r.rmode));
      }
    } catch (e) {}
    return out;
  };
}

(function () {
  _dtRestockWrap();
  _dtRestockWrapSell();
  // Without Sell its timer is missing: run the New Game clear on a timer of our own.
  // The shared mod timer (ui.js every) when ui.js is in; a timer of our own without it.
  if (!_dtRestock.sellWrapped && typeof setInterval === "function") (typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(() => { try { _dtRestockNewGame(); } catch (e) {} }, 250);
  _dtRestockWrapBoard();
  globalThis._dtRestockApi = {
    logic: _dtRestockLogic, mode: _dtRestockMode, setModel: _dtRestockSetModel, modelMode: _dtRestockModelMode,
    modes: () => (_dtRestockLoad(), Object.assign({}, _dtRestock.modes)), reload: () => _dtRestockLoad(true),
    cashLine: () => ((_dtRestock.line = null), _dtRestockCashLine(_dtRestockRt())), announce: _dtRestockAnnounce,
    step: _dtRestockStep, state: () => _dtRestock, newGame: _dtRestockNewGame,
  };
})();
