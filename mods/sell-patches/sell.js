// ── Sell (DEVICES_TYCOON_SELL) ──
// "Change price" and "Stop selling" under the sales table of a My <Type>
// screen, for a device that is on sale. The price is the game's own SELL cell
// (column 4) of the edition being viewed: tickDeviceSales reads it every day
// for _priceFactor (demand) and revenue, so a new price works from the next
// day. The review score is not touched. Stop selling sets POP (column 2) to 0,
// the game's own "not selling" state: _rebuildActive and the daily tick skip
// the device, so it sells nothing, never restocks (restock needs POP > 0) and
// no longer counts in _cannibalDiv. Stopped devices are kept per company in
// ArraySaves row 154 ({v, company, keys}) and their POP is held at 0 before
// every daily tick, so a later marketing campaign cannot bring them back, and
// they are left out of the Marketing device list. The same row keeps, per
// edition, the units sold and profit made at its last price change (bank), so
// the Sales board's profit so far stays what was made at the older prices.
var _DT_SELL_ROW = 154;
var _DT_SELL_COL = { CREATED: 0, SOLDED: 1, POP: 2, COST: 3, SELL: 4, RATING: 5, RELEASE: 7, NAME: 8, ID: 10 };
// Consumer device screens that sell (gamepads are bundled with consoles).
var _DT_SELL_TYPES = [
  { cls: "MY SMARTPHONES", arr: "ArraySmartphones", show: "MySmartphonesShow", draw: "MyDevices_SmartphoneDraw", v: 3 },
  { cls: "MY LAPTOPS", arr: "ArrayLaptops", show: "MyLaptopsShow", draw: "MyDevices_LaptopDraw", v: 2 },
  { cls: "MY TABLETS", arr: "ArrayTablets", show: "MyTabletsShow", draw: "MyDevices_TabletDraw", v: 2 },
  { cls: "MY HEADPHONES", arr: "ArrayHeadphones", show: "MyHeadphonesShow", draw: "MyDevices_HeadphonesDraw", v: 1 },
  { cls: "MY WATCHES", arr: "ArrayWatches", show: "MyWatchesShow", draw: "MyDevices_WatchesDraw", v: 2 },
  { cls: "MY TV", arr: "ArrayTV", show: "MyTVShow", draw: "MyDevices_TVDraw", v: 1 },
  { cls: "MY SCOOTERS", arr: "ArrayScooters", show: "MyScootersShow", draw: "", v: 1 },
  { cls: "MY KEYBOARDS", arr: "ArrayKeyboards", show: "MyKeyboardShow", draw: "", v: 1 },
  { cls: "MY CONSOLES", arr: "ArrayConsoles", show: "MyConsolesShow", draw: "", v: 1 },
  { cls: "MY VR", arr: "ArrayVRConsoles", show: "MyVRShow", draw: "", v: 1 },
];
var _DT_SELL_TEXT = {
  sellPrice: { en: "Sell Price", ru: "Цена продажи" },
  restock: { en: "Restock", ru: "Пополнение" },
  onSale: { en: "On sale", ru: "В продаже" },
  yes: { en: "Yes", ru: "Да" },
  no: { en: "No", ru: "Нет" },
  offSub: { en: "Taken off sale for good: it will not restock or sell again.", ru: "Снято с продажи навсегда: больше не продаётся и не пополняется." },
  priceTitle: { en: "Change price", ru: "Изменить цену" },
  costMarkup: { en: "Cost {c} · markup {p}%", ru: "Себестоимость {c} · наценка {p}%" },
  noRestock: { en: "No restock at this price", ru: "При этой цене без пополнения" },
  note: { en: "The new price applies from tomorrow. Review scores stay as they were.", ru: "Новая цена действует с завтрашнего дня. Оценки обзоров не меняются." },
  limits: { en: "Allowed: {lo} to {hi}", ru: "Можно: от {lo} до {hi}" },
  cancel: { en: "Cancel", ru: "Отмена" },
  confirm: { en: "Confirm", ru: "Подтвердить" },
  stop: { en: "Stop selling", ru: "Снять с продажи" },
  stopAsk: { en: "Stop selling {n} for good? There will be no more sales or restocking, and the {s} in stock stay unsold.",
    ru: "Снять {n} с продажи навсегда? Продаж и пополнений больше не будет, {s} шт. на складе останутся непроданными." },
  keep: { en: "Keep selling", ru: "Продолжить продажи" },
  cut: { en: "Price cut to {p} for {n}", ru: "Цена {n} снижена до {p}" },
  raised: { en: "Price raised to {p} for {n}", ru: "Цена {n} повышена до {p}" },
  stopped: { en: "{n} is no longer on sale", ru: "{n} снят с продажи" },
};

// ── Pure rules (no game access; unit tested) ──
var _dtSellLogic = (function () {
  const MAX_COST_MULT = 5;
  // Price limits for one edition: at least $1, at most 5x its cost price
  // (and never below the current price, so an old price can always be kept).
  function limits(cost, sell) {
    const c = Number(cost) > 0 ? Number(cost) : 1;
    const s = Number(sell) > 0 ? Math.round(Number(sell)) : 1;
    return { lo: 1, hi: Math.max(10, Math.round(c * MAX_COST_MULT), s) };
  }
  // A typed or stepped value as a whole price inside the limits, or null.
  function clamp(v, cost, sell) {
    // A blank (or "$") field is no number either, not $0.
    if (typeof v === "string" && !/\d/.test(v)) return null;
    const n = typeof v === "string" ? Number(v.replace(/[$\s,]/g, "")) : Number(v);
    if (!Number.isFinite(n)) return null;
    const l = limits(cost, sell);
    return Math.min(l.hi, Math.max(l.lo, Math.round(n)));
  }
  // One +/- step: about 1% of the cost price, in round dollars.
  function step(cost) {
    const c = Number(cost) || 0;
    if (c < 100) return 1;
    if (c < 1000) return 5;
    if (c < 10000) return 50;
    return 500;
  }
  function markup(sell, cost) {
    const c = Number(cost);
    if (!(c > 0)) return 0;
    // Rounded down like the price page's price card (skip.js), so one device shows one markup.
    return Math.floor((Number(sell) * 100) / c - 100 + 1e-9);
  }
  // Ratio of daily demand at the new price to now, from the game's own price
  // factor (pf = _priceFactor(cost, sell, rating, cfg)).
  function demandRatio(pf, cost, oldSell, newSell, rating, cfg) {
    try {
      const a = pf(cost, oldSell, rating, cfg), b = pf(cost, newSell, rating, cfg);
      return a > 0 && b > 0 ? b / a : 1;
    } catch (e) {
      return 1;
    }
  }
  // "+80%" / "−40%" (blank when it rounds to no change).
  function ratioText(r) {
    if (!Number.isFinite(r)) return "";
    const p = Math.round((r - 1) * 100);
    return p === 0 ? "" : (p > 0 ? "+" : "−") + Math.abs(p) + "%";
  }
  function money(n) {
    const v = Math.round(Number(n) || 0);
    const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (v < 0 ? "-$" : "$") + s;
  }
  // A device edition is known by its array, the game's ID (column 10) and its
  // release day, so a reused slot or a new campaign never matches it.
  function key(arrName, id, release, name) {
    const n = Number(id);
    return arrName + (n > 0 ? "#" + n : "|" + String(name || "")) + "@" + Math.round(Number(release) || 0);
  }
  // Row 154 text -> stopped keys for this company (anything else: none).
  function parse(raw, company) {
    if (typeof raw !== "string" || raw.charAt(0) !== "{") return [];
    try {
      const j = JSON.parse(raw);
      if (!j || j.v !== 1 || j.company !== company || !Array.isArray(j.keys)) return [];
      return j.keys.filter((k) => typeof k === "string" && k.length > 0 && k.length < 200);
    } catch (e) {
      return [];
    }
  }
  // Row 154 text -> {key: [units sold, profit made]} at each edition's last price change.
  function parseBank(raw, company) {
    const out = {};
    if (typeof raw !== "string" || raw.charAt(0) !== "{") return out;
    try {
      const j = JSON.parse(raw);
      if (!j || j.v !== 1 || j.company !== company || !j.bank || typeof j.bank !== "object") return out;
      for (const k of Object.keys(j.bank)) {
        const b = j.bank[k];
        if (k.length > 0 && k.length < 200 && Array.isArray(b) && Number.isFinite(b[0]) && Number.isFinite(b[1])) out[k] = [b[0], b[1]];
      }
    } catch (e) {}
    return out;
  }
  function serialize(keys, company, bank) {
    const has = !!bank && Object.keys(bank).length > 0;
    if (!keys.length && !has) return "";
    const j = { v: 1, company: String(company || ""), keys: keys.slice() };
    if (has) j.bank = bank;
    return JSON.stringify(j);
  }
  // Profit so far as the game counts it (SOLDED x (SELL - COST), never below 0 a unit),
  // but units sold before the last price change keep the profit banked then.
  function profit(bank, solded, sell, cost) {
    const m = (Number(sell) || 0) - (Number(cost) || 0), s = Number(solded) || 0;
    const b = Array.isArray(bank) ? bank : [0, 0];
    return Math.round(b[1] + Math.max(0, s - b[0]) * (m > 0 ? m : 0));
  }
  return { limits, clamp, step, markup, demandRatio, ratioText, money, key, parse, parseBank, serialize, profit };
})();

var _dtSell = { keys: new Set(), bank: {}, slot: -1, company: "", raw: null, wrapped: false, timer: 0, modal: null, obs: null, hov: null, clickWired: false };

function _dtSellT(k, vars) {
  return _dtUi.t(_DT_SELL_TEXT[k], vars);
}
function _dtSellRt() {
  return globalThis.runtime || null;
}
function _dtSellArr(name) {
  try {
    const o = _dtSellRt().objects[name];
    return o ? o.getFirstInstance() : null;
  } catch (e) {
    return null;
  }
}

// ── Save row 154 ──
function _dtSellSlotNow() {
  return Math.max(0, Math.min(2, Math.round(_dtUi.num("SaveSlot", 0)) || 0));
}
function _dtSellCompanyNow() {
  return String(_dtUi.gv("CompanyName", "") || "");
}
// The row is the truth (a loaded save replaces it): parse again whenever it changes.
function _dtSellLoad(force) {
  const slot = _dtSellSlotNow(), company = _dtSellCompanyNow();
  let raw = "";
  const a = _dtSellArr("ArraySaves");
  try {
    if (a && a.height > _DT_SELL_ROW && a.width > slot) raw = a.getAt(slot, _DT_SELL_ROW, 0);
  } catch (e) {}
  if (!force && slot === _dtSell.slot && company === _dtSell.company && raw === _dtSell.raw) return;
  _dtSell.slot = slot;
  _dtSell.company = company;
  _dtSell.raw = raw;
  _dtSell.keys = new Set(_dtSellLogic.parse(raw, company));
  _dtSell.bank = _dtSellLogic.parseBank(raw, company);
}
// Nothing is written until the first device is stopped or repriced, so other saves stay as they were.
function _dtSellSave() {
  const a = _dtSellArr("ArraySaves"), slot = _dtSellSlotNow();
  if (!a || a.height <= _DT_SELL_ROW || a.width <= slot) return console.warn("[Sell] no ArraySaves row", _DT_SELL_ROW);
  const raw = _dtSellLogic.serialize(Array.from(_dtSell.keys), _dtSellCompanyNow(), _dtSell.bank);
  a.setAt(raw, slot, _DT_SELL_ROW, 0);
  _dtSell.raw = raw;
}

// ── Device reads ──
function _dtSellKeyAt(arrName, a, x, y) {
  const C = _DT_SELL_COL;
  let id = 0;
  try {
    if ((a.depth | 0) > C.ID) id = a.getAt(x, y, C.ID);
  } catch (e) {}
  return _dtSellLogic.key(arrName, id, a.getAt(x, y, C.RELEASE), a.getAt(x, y, C.NAME));
}
function _dtSellEditions(t, a, x) {
  const out = [];
  const h = Math.min(t.v, Math.min(3, a.height | 0));
  for (let y = 0; y < h; y++) {
    if (a.getAt(x, y, _DT_SELL_COL.CREATED) === -1) continue;
    if (y > 0 && a.getAt(x, y, _DT_SELL_COL.RELEASE) === -1 && a.getAt(x, y, _DT_SELL_COL.NAME) === "") continue;
    out.push(y);
  }
  return out;
}
function _dtSellToday() {
  return _dtUi.num("DayTotal", 0);
}
// "selling" | "stopped" | "ended" (released, POP ran out) | "" (not released yet)
function _dtSellState(t, a, x, y) {
  const C = _DT_SELL_COL;
  _dtSellLoad();
  const rel = Number(a.getAt(x, y, C.RELEASE));
  if (!(rel >= 0) || rel > _dtSellToday()) return "";
  if (_dtSell.keys.has(_dtSellKeyAt(t.arr, a, x, y))) return "stopped";
  return Number(a.getAt(x, y, C.POP)) > 0 ? "selling" : "ended";
}
function _dtSellModelState(t, a, x) {
  const st = _dtSellEditions(t, a, x).map((y) => _dtSellState(t, a, x, y));
  if (st.indexOf("selling") >= 0) return "selling";
  if (st.indexOf("stopped") >= 0) return "stopped";
  return st.indexOf("ended") >= 0 ? "ended" : "";
}
// The My <Type> screen and the device on it, or null.
function _dtSellView() {
  const rt = _dtSellRt();
  if (!rt) return null;
  let lay = "";
  try { lay = String(rt.layout.name || ""); } catch (e) {}
  const t = _DT_SELL_TYPES.find((e) => e.cls === lay);
  if (!t) return null;
  const g = rt.globalVars;
  if (String(g.class || "") !== t.cls) return null;
  const a = _dtSellArr(t.arr);
  const x = Math.round(Number(g.SubPage) || 1) - 1;
  if (!a || x < 0 || x >= (a.width | 0)) return null;
  if (a.getAt(x, 0, _DT_SELL_COL.CREATED) === -1) return null;
  return { t: t, a: a, x: x, mini: Math.round(Number(g.MiniPage) || 1), flag: Math.round(Number(g.DeviceShowFlagmanID) || 0) };
}
function _dtSellRedraw(t) {
  try {
    _dtSellRt().callFunction(t.show);
    if (t.draw) _dtSellRt().callFunction(t.draw);
  } catch (e) {}
}

// ── Actions ──
// Write a new sell price for one edition. Returns the toast text or "".
function _dtSellSetPrice(t, a, x, y, price) {
  const C = _DT_SELL_COL;
  if (_dtSellState(t, a, x, y) !== "selling") return "";
  const cost = Number(a.getAt(x, y, C.COST)), old = Number(a.getAt(x, y, C.SELL));
  const p = _dtSellLogic.clamp(price, cost, old);
  if (p === null || p === Math.round(old)) return "";
  // Units sold so far were sold at the old price: bank their profit before SELL changes.
  const k = _dtSellKeyAt(t.arr, a, x, y), sold = Number(a.getAt(x, y, C.SOLDED)) || 0;
  _dtSell.bank[k] = [sold, _dtSellLogic.profit(_dtSell.bank[k], sold, old, cost)];
  _dtSellSave();
  a.setAt(p, x, y, C.SELL);
  const n = String(a.getAt(x, y, C.NAME) || "");
  return _dtSellT(p < old ? "cut" : "raised", { p: _dtSellLogic.money(p), n: n });
}
// Take every edition of model x off sale for good.
function _dtSellStop(t, a, x) {
  _dtSellLoad();
  let n = 0;
  for (const y of _dtSellEditions(t, a, x)) {
    const s = _dtSellState(t, a, x, y);
    if (s !== "selling" && s !== "ended") continue;
    _dtSell.keys.add(_dtSellKeyAt(t.arr, a, x, y));
    a.setAt(0, x, y, _DT_SELL_COL.POP);
    n++;
  }
  if (!n) return 0;
  _dtSellSave();
  _dtSellRefreshSales();
  return n;
}
function _dtSellRefreshSales() {
  try {
    if (typeof markDeviceSalesDirty === "function") markDeviceSalesDirty();
    if (typeof syncSellingDevicesNow === "function") syncSellingDevicesNow(_dtSellRt());
  } catch (e) {
    console.warn("[Sell] refresh:", e);
  }
}
// Hold every stopped device at POP 0 (a marketing campaign adds POP).
function _dtSellEnforce() {
  _dtSellLoad();
  if (!_dtSell.keys.size) return 0;
  let n = 0;
  for (const t of _DT_SELL_TYPES) {
    const a = _dtSellArr(t.arr);
    if (!a || (a.depth | 0) <= _DT_SELL_COL.RELEASE) continue;
    const w = a.width | 0, h = Math.min(3, a.height | 0);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        if (a.getAt(x, y, _DT_SELL_COL.CREATED) === -1) continue;
        if (!(Number(a.getAt(x, y, _DT_SELL_COL.POP)) > 0)) continue;
        if (!_dtSell.keys.has(_dtSellKeyAt(t.arr, a, x, y))) continue;
        a.setAt(0, x, y, _DT_SELL_COL.POP);
        n++;
      }
    }
  }
  if (n) _dtSellRefreshSales();
  return n;
}
function _dtSellWrapTick() {
  if (_dtSell.wrapped || typeof tickDeviceSales !== "function") return;
  _dtSell.wrapped = true;
  const orig = tickDeviceSales;
  tickDeviceSales = function () {
    try {
      _dtSellEnforce();
    } catch (e) {
      console.warn("[Sell] enforce:", e);
    }
    return orig.apply(this, arguments);
  };
  globalThis.tickDeviceSales = tickDeviceSales;
}

// Stopped devices leave the Marketing device list (fillMarketingDevicesTemp
// fills ArrayMarketingDevices_Temp, one column per device: type, ID, POP,
// name, rating, release), so no campaign money goes to them.
function _dtSellFilterMarketing(n) {
  _dtSellLoad();
  if (!_dtSell.keys.size || !(n > 0) || typeof DEVICE_ARRAYS3 === "undefined") return n;
  const t = _dtSellArr("ArrayMarketingDevices_Temp");
  if (!t || typeof t.setSize !== "function") return n;
  const arrOf = {};
  for (const e of DEVICE_ARRAYS3) if (e && e.marketingType) arrOf[e.marketingType] = e.name;
  const w = t.width | 0, keep = [];
  for (let x = 0; x < w; x++) {
    const row = [0, 1, 2, 3, 4, 5].map((y) => t.getAt(x, y, 0));
    const arr = arrOf[String(row[0])];
    if (arr && _dtSell.keys.has(_dtSellLogic.key(arr, row[1], row[5], row[3]))) continue;
    keep.push(row);
  }
  if (keep.length === w) return n;
  t.setSize(keep.length, 6, 1);
  keep.forEach((row, x) => row.forEach((v, y) => t.setAt(v, x, y, 0)));
  return keep.length;
}
function _dtSellWrapMarketing() {
  if (_dtSell.mktWrapped || typeof fillMarketingDevicesTemp !== "function") return;
  _dtSell.mktWrapped = true;
  const orig = fillMarketingDevicesTemp;
  fillMarketingDevicesTemp = function () {
    const n = orig.apply(this, arguments);
    try {
      return _dtSellFilterMarketing(n);
    } catch (e) {
      console.warn("[Sell] marketing list:", e);
      return n;
    }
  };
  globalThis.fillMarketingDevicesTemp = fillMarketingDevicesTemp;
}

// ── Pop-ups (the game's own news box look, ui.js) ──
function _dtSellClosed() {
  _dtSell.modal = null;
}
// Money and counts as the game's tables write them: "$1 299", "60 075".
function _dtSellNum(n) {
  return String(Math.round(Math.abs(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function _dtSellCash(n) {
  return (Number(n) < 0 ? "-$" : "$") + _dtSellNum(n);
}
var _DT_SELL_CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>';
// A small square step button with a chevron (down = cheaper).
function _dtSellStepBtn(parent, up, onClick) {
  const b = _dtUi.button(parent, "", "dt-sell-step" + (up ? " dt-sell-up" : ""), onClick);
  b.innerHTML = _DT_SELL_CHEVRON;
  b.setAttribute("aria-label", up ? "+" : "-");
  return b;
}
// Change price: one row per edition on sale, "Cost $X · markup N%", arrows
// either side of the price (the price can also be typed). dir = -1 / +1 when
// opened from the table's arrows: the viewed edition starts one step that way.
function _dtSellPriceOpen(dir) {
  const v = _dtSellView();
  if (!v || _dtUi.isOpen()) return;
  const C = _DT_SELL_COL, L = _dtSellLogic;
  const ys = _dtSellEditions(v.t, v.a, v.x).filter((y) => _dtSellState(v.t, v.a, v.x, y) === "selling");
  if (!ys.length) return;
  // The edition being viewed first, then the others on sale.
  ys.sort((p, q) => (p === v.flag ? -1 : q === v.flag ? 1 : p - q));
  const rows = ys.map((y) => ({
    y: y, name: String(v.a.getAt(v.x, y, C.NAME) || ""), cost: Number(v.a.getAt(v.x, y, C.COST)),
    old: Math.round(Number(v.a.getAt(v.x, y, C.SELL))),
  }));
  for (const r of rows) r.price = r.old;
  // Only the edition on screen starts one step along (the tab it was opened from).
  const seen = _dtSellEditions(v.t, v.a, v.x).indexOf(v.flag) >= 0 ? v.flag : 0;
  if ((dir === -1 || dir === 1) && rows[0].y === seen) {
    const r = rows[0], c = L.clamp(r.old + dir * L.step(r.cost), r.cost, r.old);
    if (c !== null) r.price = c;
  }
  _dtSell.modal = _dtUi.modal({
    title: _dtSellT("priceTitle"),
    pause: true,
    onClose: _dtSellClosed,
    buttons: [
      { label: _dtSellT("cancel") },
      { label: _dtSellT("confirm"), main: true, onClick: () => {
        const msgs = [];
        for (const r of rows) {
          const m = _dtSellSetPrice(v.t, v.a, v.x, r.y, r.price);
          if (m) msgs.push([m, r.name]);
        }
        if (msgs.length) {
          _dtSellRedraw(v.t);
          for (const m of msgs) _dtUi.toast(m[0], m[1]);
        }
      } },
    ],
    build: (body) => {
      for (const r of rows) {
        const row = _dtUi.el("div", "dt-row dt-sell-ed", body);
        const info = _dtUi.el("div", "dt-grow", row);
        _dtUi.el("div", "dt-label", info, r.name);
        const sub = _dtUi.el("div", "dt-sub", info);
        const lim = L.limits(r.cost, r.old), st = L.step(r.cost);
        const minus = _dtSellStepBtn(row, false, () => set(r.price - st));
        const input = _dtUi.el("input", "dt-sell-input", row);
        input.type = "text";
        input.inputMode = "numeric";
        input.spellcheck = false;
        input.setAttribute("aria-label", r.name);
        input.title = _dtSellT("limits", { lo: _dtSellCash(lim.lo), hi: _dtSellCash(lim.hi) });
        const plus = _dtSellStepBtn(row, true, () => set(r.price + st));
        function paint() {
          if (document.activeElement !== input) input.value = _dtSellCash(r.price);
          minus.toggleAttribute("disabled", r.price <= lim.lo);
          plus.toggleAttribute("disabled", r.price >= lim.hi);
          // The game restocks only above the cost price (_handleBatchSoldOut).
          sub.textContent = _dtSellT("costMarkup", { c: _dtSellCash(r.cost), p: L.markup(r.price, r.cost) }) +
            (r.price <= r.cost ? " · " + _dtSellT("noRestock") : "");
          sub.classList.toggle("dt-sell-bad", r.price <= r.cost);
        }
        function set(p) {
          const c = L.clamp(p, r.cost, r.old);
          if (c !== null) r.price = c;
          paint();
        }
        input.addEventListener("input", () => {
          const c = L.clamp(input.value, r.cost, r.old);
          if (c !== null) {
            r.price = c;
            paint();
          }
        });
        input.addEventListener("focus", () => input.select());
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") input.blur();
          else if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
            ev.preventDefault();
            set(r.price + (ev.key === "ArrowUp" ? st : -st));
            input.value = _dtSellCash(r.price); // paint() leaves a focused field alone
            input.select();
          }
        });
        input.addEventListener("blur", () => paint());
        paint();
      }
      _dtUi.el("div", "dt-note", body, _dtSellT("note"));
    },
  });
}
// Stop selling: red "Stop selling", green "Keep selling", like the game's NO / YES.
function _dtSellStopOpen() {
  const v = _dtSellView();
  if (!v || _dtUi.isOpen()) return;
  if (_dtSellModelState(v.t, v.a, v.x) !== "selling") return;
  const C = _DT_SELL_COL;
  const name = String(v.a.getAt(v.x, 0, C.NAME) || "");
  let stock = 0;
  for (const y of _dtSellEditions(v.t, v.a, v.x)) stock += Math.max(0, Number(v.a.getAt(v.x, y, C.CREATED)) - Number(v.a.getAt(v.x, y, C.SOLDED)) || 0);
  _dtSell.modal = _dtUi.modal({
    title: _dtSellT("stop"),
    pause: true,
    onClose: _dtSellClosed,
    buttons: [
      { label: _dtSellT("stop"), kind: "no", onClick: () => {
        if (_dtSellStop(v.t, v.a, v.x)) {
          _dtSellRedraw(v.t);
          _dtUi.toast(_dtSellT("stopped", { n: name }), name);
        }
      } },
      { label: _dtSellT("keep"), main: true, cancel: true }, // Escape keeps it on sale
    ],
    build: (body) => _dtUi.msg(body, _dtSellT("stopAsk", { n: name, s: _dtSellNum(stock) }), name),
  });
}

// ── Rows in the game's own device table (Sales tab) ──
// The game draws the My <Type> table as HTML (showMyDevicesTable: table.mydev-table,
// rows of td.mydev-left / td.mydev-right). Sell Price gets the game's small white
// arrows; Restock (restock.js) and On sale are added as rows of the same table, and
// one grey line under it explains the restock choice. The game rebuilds the table
// whenever it redraws the page; the rows are added again in the same frame.
var _DT_SELL_CSS = `
.mydev-table tr.dt-sell-live td { font-family: SofiaSansExtraCondensed-Medium, "Oswald", sans-serif; color: #fff; }
.mydev-table td.dt-sell-ctl { cursor: pointer; transition: background-color 0.16s ease, box-shadow 0.16s ease; }
.mydev-table td.dt-sell-ctl:hover { background-color: rgba(34, 42, 58, 0.85); box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.35); }
.mydev-table td.dt-sell-ctl:active .dt-sell-val { transform: scale(0.96); }
.dt-sell-cell { display: flex; align-items: center; justify-content: center; gap: 0.25em; line-height: 1; }
.dt-sell-val { display: inline-block; min-width: 3.2em; text-align: center; transition: transform 0.09s ease; }
.dt-sell-arr { display: inline-flex; align-items: center; justify-content: center; padding: 0.15em 0.4em; opacity: 0.75;
  transition: opacity 0.14s ease, transform 0.14s ease; }
.dt-sell-arr:hover { opacity: 1; }
.dt-sell-arr:active { transform: scale(0.85); }
.dt-sell-arr i { width: 0; height: 0; border-top: 0.33em solid transparent; border-bottom: 0.33em solid transparent; }
.dt-sell-arr.l i { border-right: 0.44em solid #fff; }
.dt-sell-arr.r i { border-left: 0.44em solid #fff; }
.dt-sell-arr.dt-sell-none { visibility: hidden; }
.mydev-table tr.dt-sell-off td.mydev-right { color: rgba(255, 255, 255, 0.6); }
.mydev-table td.dt-sell-notecell { background: transparent; text-align: left; padding: 0.45em 0.1em 0;
  font-family: SofiaSansExtraCondensed-Medium, "Oswald", sans-serif; font-size: 0.78em; line-height: 1.35; color: rgba(255, 255, 255, 0.6); }
.mydev-wrap.dt-sell-grown { overflow: visible; }
/* Change price pop-up rows (s-nv-5). */
.dt-layer .dt-card .dt-sell-ed { gap: calc(var(--dt) * 16px); }
.dt-layer .dt-card .dt-btn.dt-sell-step { min-width: 0; width: calc(var(--dt) * 44px); height: calc(var(--dt) * 44px); padding: 0;
  color: #fff; background: transparent; box-shadow: inset 0 0 0 calc(var(--dt) * 1.5px) rgba(255, 255, 255, 0.35); }
.dt-layer .dt-card .dt-btn.dt-sell-step:hover { background-color: rgba(255, 255, 255, 0.08); }
.dt-sell-step svg { width: calc(var(--dt) * 26px); height: calc(var(--dt) * 26px); }
.dt-sell-step.dt-sell-up svg { transform: rotate(180deg); }
.dt-layer .dt-sell-input { pointer-events: auto; width: calc(var(--dt) * 120px); height: calc(var(--dt) * 44px); padding: 0; border: 0; outline: 0;
  border-radius: calc(var(--dt) * 6px); background: transparent; color: #fff; text-align: center; color-scheme: dark;
  font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif; font-size: calc(var(--dt) * 34px);
  text-shadow: 0 calc(var(--dt) * 2px) calc(var(--dt) * 6px) rgba(0, 0, 0, 0.45); transition: background-color 0.14s ease; }
.dt-layer .dt-sell-input:hover { background: rgba(255, 255, 255, 0.06); }
.dt-layer .dt-sell-input:focus { background: rgba(0, 0, 0, 0.25); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3); }
.dt-layer .dt-card .dt-sub.dt-sell-bad { color: rgb(255, 95, 107); }
`;
function _dtSellCss() {
  if (document.getElementById("dt-sell-css")) return;
  const st = document.createElement("style");
  st.id = "dt-sell-css";
  st.textContent = _DT_SELL_CSS;
  document.head.appendChild(st);
}
// Rows after Sell Price: [{id, label, value, prev, next, open, off}] (prev/next:
// click handlers for the arrows, null hides that arrow; open: a click on the
// value). Restock adds its row in front.
function _dtSellRowSpecs(v, state) {
  const sell = state === "selling";
  return [{ id: "sale", label: _dtSellT("onSale"), value: _dtSellT(sell ? "yes" : "no"), off: !sell,
    prev: sell ? _dtSellStopOpen : null, next: sell ? _dtSellStopOpen : null }];
}
// The state the viewed edition's tab shows: the model's, but an edition whose popularity ran
// out while another one still sells is not on sale ("ended": no price arrows, no restock rule).
function _dtSellViewState(v, model, y) {
  return model === "selling" && _dtSellState(v.t, v.a, v.x, y) !== "selling" ? "ended" : model;
}
// The grey line under the table.
function _dtSellNoteText(v, state) {
  return state === "stopped" ? _dtSellT("offSub") : "";
}
function _dtSellTableEl() {
  const t = document.querySelector("table.mydev-table");
  return t && t.isConnected && t.getClientRects().length ? t : null;
}
// The game's Sell Price row: the right cell shows this edition's price (the last
// match, as Sell Price comes after Cost Price).
function _dtSellPriceRow(tb, price) {
  let hit = null;
  for (const tr of tb.rows) {
    if (tr.classList.contains("dt-sell-add")) continue;
    const r = tr.querySelector("td.mydev-right");
    if (!r || !tr.querySelector("td.mydev-left")) continue;
    const n = Number(String(r._dtSellText !== undefined ? r._dtSellText : r.textContent).replace(/[^\d.]/g, ""));
    if (String(r.textContent).indexOf("$") >= 0 && Math.round(n) === Math.round(price)) hit = tr;
  }
  return hit;
}
function _dtSellArrows(cell, text, prev, next) {
  cell.textContent = "";
  const box = _dtUi.el("div", "dt-sell-cell", cell);
  const l = _dtUi.el("span", "dt-sell-arr l" + (prev ? "" : " dt-sell-none"), box);
  _dtUi.el("i", "", l);
  const val = _dtUi.el("span", "dt-sell-val", box, text);
  const r = _dtUi.el("span", "dt-sell-arr r" + (next ? "" : " dt-sell-none"), box);
  _dtUi.el("i", "", r);
  cell.classList.toggle("dt-sell-ctl", !!(prev || next));
  // The whole cell answers like one of the game's arrow pickers: the arrows step, the value opens.
  cell._dtSellClick = (ev) => {
    const t = ev.target;
    const h = l.contains(t) ? prev : r.contains(t) ? next : prev && next ? (prev === next ? prev : null) : null;
    return h;
  };
  return val;
}
function _dtSellCellClick(ev) {
  const cell = ev.target && ev.target.closest ? ev.target.closest("td.dt-sell-ctl") : null;
  if (!cell || !cell._dtSellClick || _dtUi.isOpen()) return;
  const h = cell._dtSellClick(ev) || cell._dtSellOpen;
  if (!h) return;
  ev.stopPropagation();
  ev.preventDefault();
  try { globalThis.tapMain && globalThis.tapMain(); } catch (e) {}
  h();
}
function _dtSellHover(ev) {
  const t = ev.target && ev.target.closest ? ev.target.closest(".dt-sell-arr, td.dt-sell-ctl") : null;
  if (!t || t === _dtSell.hov) return;
  _dtSell.hov = t;
  try { globalThis.tapHover && globalThis.tapHover(); } catch (e) {}
}
// Add or refresh the rows. Cheap when nothing changed (one signature check).
function _dtSellRows() {
  const v = _dtSellView();
  const tb = v && v.mini === 1 && !_dtUi.isOpen() ? _dtSellTableEl() : null;
  if (!tb) return;
  _dtSellLoad();
  const model = _dtSellModelState(v.t, v.a, v.x);
  if (model !== "selling" && model !== "stopped") return;
  const y = _dtSellEditions(v.t, v.a, v.x).indexOf(v.flag) >= 0 ? v.flag : 0;
  const state = _dtSellViewState(v, model, y);
  const price = Math.round(Number(v.a.getAt(v.x, y, _DT_SELL_COL.SELL)));
  const specs = _dtSellRowSpecs(v, state), note = _dtSellNoteText(v, state);
  const sig = [v.t.arr, v.x, y, state, price, note, _dtUi.ru() ? 1 : 0].concat(specs.map((s) => s.id + ":" + s.value)).join("|");
  if (tb._dtSellSig === sig) return;
  _dtSellCss();
  const fresh = tb._dtSellSig === undefined;
  tb._dtSellSig = sig;
  const body = tb.tBodies[0] || tb;
  for (const tr of Array.from(body.querySelectorAll("tr.dt-sell-add"))) tr.remove();
  // Sell Price: arrows either side, only while it is on sale.
  const pr = _dtSellPriceRow(tb, price);
  if (pr) {
    const cell = pr.querySelector("td.mydev-right");
    if (cell._dtSellText === undefined) cell._dtSellText = cell.textContent.trim();
    const on = state === "selling";
    pr.classList.toggle("dt-sell-live", on);
    _dtSellArrows(cell, cell._dtSellText, on ? () => _dtSellPriceOpen(-1) : null, on ? () => _dtSellPriceOpen(1) : null);
    cell._dtSellOpen = on ? () => _dtSellPriceOpen(0) : null;
  }
  // New rows continue the game's row-by-row entrance (0.055 s apart) on a fresh table.
  let i = body.rows.length;
  const add = (cls) => {
    const tr = document.createElement("tr");
    tr.className = "dt-sell-add " + cls;
    body.appendChild(tr);
    return tr;
  };
  const cellOf = (tr, cls) => {
    const td = _dtUi.el("td", cls, tr);
    if (fresh) td.style.setProperty("--d", (i * 0.055).toFixed(3) + "s");
    else td.style.animation = "none";
    return td;
  };
  for (const s of specs) {
    const tr = add((s.prev || s.next ? "dt-sell-live" : "") + (s.off ? " dt-sell-off" : ""));
    tr.dataset.dtSell = s.id;
    cellOf(tr, "mydev-left").textContent = s.label;
    const cell = cellOf(tr, "mydev-right");
    _dtSellArrows(cell, s.value, s.prev, s.next);
    cell._dtSellOpen = s.open || (s.prev === s.next ? s.prev : null);
    i++;
  }
  if (note) {
    const td = cellOf(add("dt-sell-note"), "dt-sell-notecell");
    td.colSpan = 2;
    td.textContent = note;
  }
  // The added rows may run past the game's box: let them show instead of a scroll bar.
  const wrap = tb.closest(".mydev-wrap");
  if (wrap) wrap.classList.add("dt-sell-grown");
  if (!_dtSell.clickWired) {
    _dtSell.clickWired = true;
    document.addEventListener("click", _dtSellCellClick, true);
    document.addEventListener("pointerover", _dtSellHover, true);
  }
}
// The game replaces the table in one innerHTML write: add the rows in that same frame.
function _dtSellWatch() {
  if (_dtSell.obs || typeof MutationObserver !== "function") return;
  let host = null;
  try {
    const o = _dtSellRt().objects.HTMLElement_MyDevices;
    const inst = o && o.getFirstInstance();
    host = inst && typeof inst.getElement === "function" ? inst.getElement() : null;
  } catch (e) {}
  if (!host) return;
  _dtSell.obs = new MutationObserver(() => {
    try { _dtSellRows(); } catch (e) {}
  });
  _dtSell.obs.observe(host, { childList: true });
}
// ArraySaves survives a New Game: a new campaign in a used slot starts with nothing stopped.
function _dtSellNewGame() {
  const rt = _dtSellRt();
  if (!rt || !rt.globalVars || String(rt.layout && rt.layout.name) !== "LOADING GAME") return;
  if (String(rt.globalVars.LoadingType || "").toUpperCase() !== "NEW GAME") return;
  const a = _dtSellArr("ArraySaves"), slot = _dtSellSlotNow();
  try {
    const v = a && a.height > _DT_SELL_ROW && a.width > slot ? a.getAt(slot, _DT_SELL_ROW, 0) : "";
    if (v !== "" && v !== 0) a.setAt("", slot, _DT_SELL_ROW, 0);
  } catch (e) {}
  _dtSell.slot = -1;
  _dtSell.keys = new Set();
  _dtSell.bank = {};
  _dtSell.raw = null;
}
function _dtSellTick() {
  _dtSellNewGame();
  if (!_dtSellView()) {
    if (_dtSell.obs) { _dtSell.obs.disconnect(); _dtSell.obs = null; }
    return;
  }
  _dtSellWatch();
  _dtSellRows();
}
(function () {
  _dtSellWrapTick();
  _dtSellWrapMarketing();
  globalThis._dtSellApi = {
    logic: _dtSellLogic, view: _dtSellView, price: _dtSellPriceOpen, stopAsk: _dtSellStopOpen,
    setPrice: _dtSellSetPrice, stop: _dtSellStop, enforce: _dtSellEnforce, state: _dtSellState,
    keys: () => (_dtSellLoad(), Array.from(_dtSell.keys)), reload: () => _dtSellLoad(true), types: _DT_SELL_TYPES,
    rows: _dtSellRows, viewState: _dtSellViewState,
    // Profit so far of one edition (board.js): the game's sum, with the profit banked at price changes.
    profit: (k, solded, sell, cost) => (_dtSellLoad(), _dtSellLogic.profit(_dtSell.bank[k], solded, sell, cost)),
  };
  if (_dtSell.timer || typeof document === "undefined") return;
  // The shared mod timer (ui.js every) when ui.js is in; a timer of our own without it.
  _dtSell.timer = (typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(() => {
    try { _dtSellTick(); } catch (e) {}
  }, 250);
})();
