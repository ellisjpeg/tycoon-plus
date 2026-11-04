// ── Launch days: hold a reviewed device on a "Ready to launch" shelf ──
// The game releases a device on the last review click by writing today's
// DayTotal into the row's RELEASE cell and registering it for sales. Its
// sales code already skips rows whose RELEASE is in the future, so a planned
// launch is just a later RELEASE day: the row stays on the shelf (hype from
// marketing still lands on it, popularity does not decay) and starts selling
// on that day. The date lives in the device row itself, so it is saved with
// the game. Closing the game before choosing leaves the normal release.
var _DT_LAUNCH_ARRAYS = {
  ArraySmartphones: 1, ArrayTablets: 1, ArrayLaptops: 1, ArrayWatches: 1, ArrayHeadphones: 1, ArrayTV: 1,
  ArrayScooters: 1, ArrayKeyboards: 1, ArrayConsoles: 1, ArrayGamepads: 1, ArrayVRConsoles: 1,
};
var _DT_LAUNCH_COL = { CREATED: 0, POP: 2, HYPE: 6, RELEASE: 7, NAME: 8, RELEASE_TEXT: 9 };
var _DT_LAUNCH_CATS = {
  ArraySmartphones: "SMARTPHONES", ArrayTablets: "TABLETS", ArrayLaptops: "LAPTOPS", ArrayWatches: "WATCHES",
  ArrayHeadphones: "HEADPHONES", ArrayTV: "TV", ArrayScooters: "SCOOTER", ArrayKeyboards: "KEYBOARD",
  ArrayConsoles: "CONSOLE", ArrayGamepads: "GAMEPAD", ArrayVRConsoles: "VR CONSOLE",
};
var _DT_LAUNCH_TEXT = {
  title: { en: "Launch day", ru: "День запуска" },
  ask: { en: "{n} is finished. When should it go on sale? Reviews come out on that day, and hype keeps building until then.", ru: "{n} готов. Когда начать продажи? Обзоры выйдут в этот день, а ажиотаж будет расти до него." },
  today: { en: "Launch today", ru: "Запустить сегодня" },
  plan: { en: "Plan launch", ru: "Запланировать" },
  week: { en: "+1 week", ru: "+1 неделя" },
  weekBack: { en: "-1 week", ru: "-1 неделя" },
  day: { en: "+1 day", ru: "+1 день" },
  dayBack: { en: "-1 day", ru: "-1 день" },
  in: { en: "in {d} days", ru: "через {d} дней" },
  inOne: { en: "in {d} day", ru: "через {d} день" },
  inFew: { en: "in {d} days", ru: "через {d} дня" },
  onDay: { en: "today", ru: "сегодня" },
  presets: { en: "Quick picks", ru: "Быстрый выбор" },
  p2w: { en: "2 weeks", ru: "2 недели" },
  p1m: { en: "1 month", ru: "1 месяц" },
  p2m: { en: "2 months", ru: "2 месяца" },
  hint: { en: "Until then it waits on the shelf. Marketing campaigns still add hype, and hype does not fade while it waits.", ru: "До запуска он ждёт на полке. Маркетинг всё так же добавляет ажиотаж, и он не угасает, пока устройство ждёт." },
  shelf: { en: "Ready to launch", ru: "Готовы к запуску" },
  empty: { en: "Nothing is waiting to launch.", ru: "Нет устройств, ожидающих запуска." },
  launchNow: { en: "Launch now", ru: "Запустить" },
  change: { en: "Change date", ru: "Изменить дату" },
  close: { en: "Close", ru: "Закрыть" },
  done: { en: "Done", ru: "Готово" },
  hype: { en: "Hype {h}%", ru: "Ажиотаж {h}%" },
  launched: { en: "{n} is on sale from today!", ru: "{n} в продаже с сегодняшнего дня!" },
  planned: { en: "{n} launches on {d}.", ru: "{n}: запуск {d}." },
  more: { en: "{n} and {c} more", ru: "{n} и ещё {c}" },
};
var _dtLaunchHeld = []; // [{arr, cat}] reviewed this session, waiting for the final review
var _dtLaunchLastDay = -1;
var _dtLaunchTimer = 0;
// Devices still waiting for their launch-day reviews (reviews.js) are skipped by the daily launch.
var _dtLaunchWaits = function () {
  return false;
};

function _dtLaunchArr(name) {
  try {
    const o = globalThis.runtime.objects[name];
    return o ? o.getFirstInstance() : null;
  } catch (e) {
    return null;
  }
}
// The game's calendar: 365 days, February 28, April/June/September/November 30.
function _dtLaunchMonthDays(m) {
  return m === 2 ? 28 : m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
}
// Days since 1 January of year 1, so a corrupt far-future RELEASE still
// formats in constant time instead of stepping one day at a time.
function _dtLaunchAbsDate(y, m, d) {
  let t = (y - 1) * 365 + (d - 1);
  for (let i = 1; i < m; i++) t += _dtLaunchMonthDays(i);
  return t;
}
function _dtLaunchDate(dayTotal) {
  const target = Math.round(dayTotal);
  if (!Number.isFinite(target)) return "---";
  const start = _dtLaunchAbsDate(_dtUi.num("Year", 2008), _dtUi.num("Month", 1), _dtUi.num("Day", 1));
  const total = start + target - _dtUi.num("DayTotal", 0);
  const y = Math.floor(total / 365) + 1;
  let rem = total - (y - 1) * 365;
  let m = 1;
  while (rem >= _dtLaunchMonthDays(m)) {
    rem -= _dtLaunchMonthDays(m);
    m++;
  }
  const p = (v) => (v < 10 ? "0" : "") + v;
  return p(rem + 1) + "." + p(m) + "." + y;
}
// "in 1 day" / "in 2 days"; Russian needs day / дня / дней.
function _dtLaunchIn(d) {
  const T = _DT_LAUNCH_TEXT;
  const n = Math.abs(d);
  // English only has a singular form at 1; Russian also uses it at 21, 31...
  if (_dtUi.num("LanguageChoose", 0) === 1) {
    if (n % 10 === 1 && n % 100 !== 11) return _dtUi.t(T.inOne, { d: d });
    if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) return _dtUi.t(T.inFew, { d: d });
    return _dtUi.t(T.in, { d: d });
  }
  return n === 1 ? _dtUi.t(T.inOne, { d: d }) : _dtUi.t(T.in, { d: d });
}
// Rows of the device just reviewed: line 0 (newest), variants whose RELEASE is today.
function _dtLaunchJustReleased(arrName) {
  const a = _dtLaunchArr(arrName);
  const today = _dtUi.num("DayTotal", 0);
  const out = [];
  if (!a) return out;
  const h = Math.min(3, a.height | 0);
  for (let y = 0; y < h; y++) {
    if (a.getAt(0, y, _DT_LAUNCH_COL.CREATED) === -1) continue;
    if (Number(a.getAt(0, y, _DT_LAUNCH_COL.RELEASE)) === today) out.push(y);
  }
  return out;
}
function _dtLaunchName(arrName, ys) {
  const a = _dtLaunchArr(arrName);
  const n = a ? String(a.getAt(0, ys[0] || 0, _DT_LAUNCH_COL.NAME) || "") : "";
  return n || _DT_LAUNCH_CATS[arrName];
}
function _dtLaunchGo(arrName, cat, x, y) {
  const rt = globalThis.runtime;
  try {
    registerDeviceSalesForArray(arrName, rt);
  } catch (e) {
    console.warn("[Launch] register:", e);
  }
  try {
    socialQueueDeviceReleased(rt, cat, y, x);
  } catch (e) {}
}
function _dtLaunchSetDay(arrName, x, ys, day) {
  const a = _dtLaunchArr(arrName);
  if (!a) return;
  for (const y of ys) {
    a.setAt(day, x, y, _DT_LAUNCH_COL.RELEASE);
    a.setAt(_dtLaunchDate(day), x, y, _DT_LAUNCH_COL.RELEASE_TEXT);
  }
}

// Called from each review "release" script action instead of the game's own
// registration. Returns false to let the game release as before.
function _dtLaunchRelease(arrName, rt, cat, last) {
  if (!_DT_LAUNCH_ARRAYS[arrName]) return false;
  try {
    if (!_dtLaunchHeld.some((h) => h.arr === arrName)) _dtLaunchHeld.push({ arr: arrName, cat: cat });
    if (!last) return true;
    const held = _dtLaunchHeld.filter((h) => h.arr === arrName);
    _dtLaunchHeld = _dtLaunchHeld.filter((h) => h.arr !== arrName);
    const ys = _dtLaunchJustReleased(arrName);
    if (!ys.length) {
      _dtLaunchGo(arrName, cat);
      return true;
    }
    // Wait for the review screen to hand back to the office before asking.
    setTimeout(() => _dtLaunchAsk(arrName, held[0].cat, ys), 700);
    return true;
  } catch (e) {
    console.warn("[Launch] release hook:", e);
    return false;
  }
}

function _dtLaunchAsk(arrName, cat, ys) {
  const T = _DT_LAUNCH_TEXT;
  const today = _dtUi.num("DayTotal", 0);
  const name = _dtLaunchName(arrName, ys);
  let chosen = today + 14;
  _dtUi.modal({
    title: _dtUi.t(T.title),
    dismiss: false,
    pause: true,
    build: (body) => _dtLaunchPicker(body, { text: _dtUi.t(T.ask, { n: "\u0000" }), name: name }, () => chosen, (d) => (chosen = d)),
    buttons: [
      { label: _dtUi.t(T.today), kind: "outline", onClick: () => _dtLaunchNow(arrName, cat, 0, ys, name) },
      {
        label: _dtUi.t(T.plan),
        kind: "yes",
        main: true,
        onClick: () => {
          const now = _dtUi.num("DayTotal", 0);
          if (chosen <= now) return _dtLaunchNow(arrName, cat, 0, ys, name);
          _dtLaunchSetDay(arrName, 0, ys, chosen);
          _dtUi.toast(_dtUi.t(T.planned, { n: name, d: _dtLaunchDate(chosen) }), name);
          _dtLaunchRefresh();
        },
      },
    ],
  });
}

function _dtLaunchNow(arrName, cat, x, ys, name) {
  _dtLaunchSetDay(arrName, x, ys, _dtUi.num("DayTotal", 0));
  _dtLaunchGo(arrName, cat, x, ys[0]);
  _dtUi.toast(_dtUi.t(_DT_LAUNCH_TEXT.launched, { n: name }), name, { sales: true });
  _dtLaunchRefresh();
}

// ── Pop-up parts in the game's own pop-up look (agreed mockups s-nv-3 / s-nv-4,
// mock/gennative.py). The card, title and buttons come from ui.js modal(). ──
var _DT_LAUNCH_SVG = {
  left: '<path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>',
  right: '<path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>',
  check: '<path d="M9 16.17 5.53 12.7a.996.996 0 1 0-1.41 1.41l4.18 4.18c.39.39 1.02.39 1.41 0L20.29 7.71a.996.996 0 1 0-1.41-1.41L9 16.17z"/>',
  rocket: '<path d="M9.19 6.35c-2.04 2.29-3.44 5.58-3.57 5.89L2 10.69l4.05-4.05c.47-.47 1.15-.68 1.81-.55l1.33.26zM11.17 17s3.74-1.55 5.89-3.7c5.4-5.4 4.5-9.62 4.21-10.57-.95-.3-5.17-1.19-10.57 4.21C8.55 9.09 7 12.83 7 12.83L11.17 17zm6.48-2.19c-2.29 2.04-5.58 3.44-5.89 3.57L13.31 22l4.05-4.05c.47-.47.68-1.15.55-1.81l-.26-1.33zM9 18c0 .83-.34 1.58-.88 2.12C6.94 21.3 2 22 2 22s.7-4.94 1.88-6.12C4.42 15.34 5.17 15 6 15c1.66 0 3 1.34 3 3zm4-9c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"/>',
  star: '<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>',
  plus: '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>',
};
var _DT_LAUNCH_UI = {
  week: { en: "WEEK", ru: "НЕДЕЛЯ" },
  day: { en: "DAY", ru: "ДЕНЬ" },
  tb: { en: "LAUNCHES", ru: "ЗАПУСКИ" },
  pgTitle: { en: "LAUNCHES", ru: "ЗАПУСКИ" },
  pgSub: { en: "READY, PLANNED AND EVENTS", ru: "ГОТОВЫЕ, ЗАПЛАНИРОВАННЫЕ И СОБЫТИЯ" },
  secPlanned: { en: "Planned", ru: "Запланированы" },
  secEvents: { en: "Launch events", ru: "Презентации запуска" },
  solo: { en: "Solo launch", ru: "Отдельный запуск" },
  atEvent: { en: "At {e}", ru: "На событии {e}" },
  hype: { en: "hype {h}%", ru: "ажиотаж {h}%" },
  change: { en: "Change", ru: "Изменить" },
  edit: { en: "Edit", ru: "Изменить" },
  newEvent: { en: "New launch event", ru: "Новая презентация запуска" },
  emptyT: { en: "Nothing is planned", ru: "Ничего не запланировано" },
  emptyS: { en: "When a device is finished you choose its launch day. Planned launches and launch events show up here.", ru: "Когда устройство готово, вы выбираете день запуска. Запланированные запуски и презентации появятся здесь." },
  changeTitle: { en: "Change date", ru: "Изменить дату" },
  changeAsk: { en: "{n} launches on {d}. Pick a new day, or launch it today.", ru: "{n}: запуск {d}. Выберите другой день или запустите сегодня." },
  cancel: { en: "Cancel", ru: "Отмена" },
  save: { en: "Save", ru: "Сохранить" },
};
function _dtLaunchU(k, v) {
  return _dtUi.t(_DT_LAUNCH_UI[k], v);
}
function _dtLaunchSvg(n) {
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + _DT_LAUNCH_SVG[n] + "</svg>";
}
function _dtLaunchCss() {
  if (typeof document === "undefined" || document.getElementById("dt-launch-css")) return;
  const s = document.createElement("style");
  s.id = "dt-launch-css";
  const D = (n) => "calc(var(--dt) * " + n + "px)";
  s.textContent = `
.dtl-tx { font-size: ${D(27)}; line-height: 1.4; }
.dtl-tx em, .dt-msg em { font-style: normal; color: #FFD600; }
.dtl-sm { font-size: ${D(22)}; line-height: 1.4; color: rgba(255,255,255,.62); margin-top: ${D(12)}; }
.dtl-dr { display: flex; align-items: center; justify-content: center; gap: ${D(26)}; margin-top: ${D(30)}; }
.dtl-a { font-size: ${D(22)}; color: rgba(255,255,255,.75); display: flex; align-items: center; gap: ${D(6)}; cursor: pointer;
  padding: ${D(8)} ${D(4)}; margin: ${D(-8)} ${D(-4)}; transition: color .14s linear; }
.dtl-a:hover { color: #fff; }
.dtl-a:active { transform: scale(.96); }
.dtl-a .dtl-ic { display: flex; }
.dtl-a svg { width: ${D(30)}; height: ${D(30)}; fill: currentColor; }
.dtl-a.dt-off { opacity: .3; pointer-events: none; }
.dtl-d { text-align: center; min-width: ${D(230)}; }
.dtl-d b { display: block; font-family: "SofiaSansExtraCondensed-Medium"; font-weight: normal; font-size: ${D(44)}; line-height: 1; }
.dtl-d span { font-size: ${D(21)}; color: rgba(255,255,255,.62); }
.dtl-qp { display: flex; justify-content: center; gap: ${D(12)}; margin-top: ${D(22)}; }
.dtl-qp span { height: ${D(38)}; padding: 0 ${D(18)}; border-radius: ${D(8)}; display: flex; align-items: center; font-size: ${D(21)};
  color: rgba(255,255,255,.8); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.3); cursor: pointer; transition: background .14s linear, box-shadow .14s linear; }
.dtl-qp span:hover { background: rgba(255,255,255,.08); }
.dtl-qp span.dt-on { color: #fff; background: rgba(255,255,255,.18); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.7); }
.dtl-lnk { display: flex; justify-content: center; gap: ${D(10)}; margin-top: ${D(22)}; font-size: ${D(22)}; color: rgba(255,255,255,.75); }
/* The mockup's 40 px from the last control to the buttons (the foot adds 18). */
.dt-body > .dtl-qp:last-child, .dt-body > .dtl-dr:last-child { margin-bottom: ${D(22)}; }
.dt-card.dtl-3 .dt-foot { gap: ${D(22)}; }
.dt-card.dtl-3 .dt-foot .dt-btn { width: ${D(196)}; min-width: 0; }
.dtl-lnk.dtl-under { margin: ${D(-8)} 0 ${D(26)}; }
.dtl-lnk span { text-decoration: underline; text-underline-offset: ${D(5)}; cursor: pointer; }
.dtl-lnk span:hover { color: #fff; }
.dtl-ck { display: flex; align-items: center; gap: ${D(16)}; padding: ${D(12)} 0; font-size: ${D(25)}; line-height: 1.2; border-bottom: 1px solid rgba(255,255,255,.12); cursor: pointer; }
.dtl-ck i { flex: 0 0 auto; width: ${D(28)}; height: ${D(28)}; border-radius: ${D(6)}; box-shadow: inset 0 0 0 2px rgba(255,255,255,.6);
  display: flex; align-items: center; justify-content: center; font-style: normal; }
.dtl-ck i svg { width: ${D(22)}; height: ${D(22)}; fill: #fff; display: none; }
.dtl-ck.dt-on i { background: #63b303; box-shadow: none; }
.dtl-ck.dt-on i svg { display: block; }
.dtl-ck b { font-weight: normal; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dtl-ck small { margin-left: auto; flex: 0 0 auto; font-size: ${D(20)}; color: rgba(255,255,255,.6); }
.dtl-list { max-height: ${D(300)}; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.25) transparent; }
.dtl-inp { display: block; width: 100%; margin-top: ${D(26)}; height: ${D(52)}; border: 0; outline: 0; border-radius: ${D(8)}; padding: 0 ${D(16)};
  font-family: "SofiaSansExtraCondensed-Medium"; font-size: ${D(25)}; color: #fff; background: rgba(0,0,0,.25); box-shadow: inset 0 0 0 1px rgba(255,255,255,.2);
  user-select: text; -webkit-user-select: text; }
.dtl-inp::placeholder { color: rgba(255,255,255,.45); }
.dtl-inp:focus { box-shadow: inset 0 0 0 1px rgba(255,255,255,.45); }
.dt-pg-list.dtl-pg { position: absolute; left: ${D(720)}; top: ${D(150)}; width: ${D(1140)}; max-height: ${D(780)}; }
.dt-pg-hdr.dtl-pg-hdr { top: ${D(34)}; }
`;
  document.head.appendChild(s);
}
// The lead text with the device name in the game's yellow ({ text with \u0000 where the name goes, name }).
function _dtLaunchLead(body, lead) {
  if (!lead) return null;
  const p = _dtUi.el("div", "dtl-tx", body);
  if (typeof lead === "string") {
    p.textContent = lead;
    return p;
  }
  const at = String(lead.text).split("\u0000");
  at.forEach((part, i) => {
    if (i) _dtUi.el("em", "", p, lead.name);
    _dtUi.el("span", "", p, part);
  });
  return p;
}
function _dtLaunchTap(parent, cls, html, onClick, snd) {
  const b = _dtUi.el("span", cls, parent);
  b.innerHTML = html;
  b.addEventListener("pointerenter", (ev) => { if (ev.pointerType !== "touch") { try { globalThis.tapHover && globalThis.tapHover(); } catch (e) {} } });
  b.addEventListener("click", (ev) => {
    ev.stopPropagation();
    try { globalThis[snd || "tapTurn"] && globalThis[snd || "tapTurn"](); } catch (e) {}
    onClick(ev);
  });
  return b;
}
// "‹ WEEK" / "DAY ›": the game's small white arrow either side of a label.
function _dtLaunchArrow(row, label, dir, onClick) {
  const a = _dtLaunchTap(row, "dtl-a", "", onClick);
  const ic = () => (_dtUi.el("span", "dtl-ic", a).innerHTML = _dtLaunchSvg(dir < 0 ? "left" : "right"));
  if (dir < 0) ic();
  _dtUi.el("span", "", a, label);
  if (dir > 0) ic();
  return a;
}
// "‹ WEEK  ‹ DAY   25.01.2012 / in 14 days   DAY ›  WEEK ›", never before today
// (opts.min: first allowed day). opts.quick adds 2 weeks / 1 month / 2 months.
function _dtLaunchDateRow(body, get, set, opts) {
  opts = opts || {};
  const T = _DT_LAUNCH_TEXT;
  const row = _dtUi.el("div", "dtl-dr", body);
  const min = () => (opts.min !== undefined ? opts.min() : _dtUi.num("DayTotal", 0));
  const arrows = [];
  const step = (n) => () => {
    set(Math.max(min(), get() + n));
    show();
  };
  arrows.push(_dtLaunchArrow(row, _dtLaunchU("week"), -1, step(-7)));
  arrows.push(_dtLaunchArrow(row, _dtLaunchU("day"), -1, step(-1)));
  const mid = _dtUi.el("div", "dtl-d", row);
  const date = _dtUi.el("b", "", mid);
  const sub = _dtUi.el("span", "", mid);
  _dtLaunchArrow(row, _dtLaunchU("day"), 1, step(1));
  _dtLaunchArrow(row, _dtLaunchU("week"), 1, step(7));
  const picks = [];
  if (opts.quick) {
    const qp = _dtUi.el("div", "dtl-qp", body);
    for (const [k, n] of [["p2w", 14], ["p1m", 30], ["p2m", 61]]) {
      const b = _dtLaunchTap(qp, "", "", () => {
        set(_dtUi.num("DayTotal", 0) + n);
        show();
      });
      b.textContent = _dtUi.t(T[k]);
      picks.push([b, n]);
    }
  }
  function show() {
    const now = _dtUi.num("DayTotal", 0);
    if (get() < min()) set(min());
    date.textContent = _dtLaunchDate(get());
    const d = get() - now;
    sub.textContent = d > 0 ? _dtLaunchIn(d) : _dtUi.t(T.onDay);
    arrows[0].classList.toggle("dt-off", get() - 7 < min());
    arrows[1].classList.toggle("dt-off", get() - 1 < min());
    for (const [b, n] of picks) b.classList.toggle("dt-on", get() === now + n);
    opts.onChange && opts.onChange();
  }
  show();
  return { row: row, show: show, date: date, sub: sub };
}
// Kept for callers: lead text plus the date row with quick picks.
function _dtLaunchPicker(body, lead, get, set) {
  _dtLaunchCss();
  _dtLaunchLead(body, lead);
  return _dtLaunchDateRow(body, get, set, { quick: true });
}

// Every device row with a launch day still ahead, across all device arrays.
function _dtLaunchShelf() {
  const today = _dtUi.num("DayTotal", 0);
  const groups = new Map();
  for (const arrName in _DT_LAUNCH_ARRAYS) {
    const a = _dtLaunchArr(arrName);
    if (!a) continue;
    const w = a.width | 0;
    const h = Math.min(3, a.height | 0);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        if (a.getAt(x, y, _DT_LAUNCH_COL.CREATED) === -1) continue;
        const day = Number(a.getAt(x, y, _DT_LAUNCH_COL.RELEASE));
        if (!(day > today)) continue;
        const key = arrName + "|" + x;
        if (!groups.has(key)) groups.set(key, { arr: arrName, cat: _DT_LAUNCH_CATS[arrName], x: x, ys: [], day: day, hype: 0 });
        const g = groups.get(key);
        g.ys.push(y);
        g.day = Math.min(g.day, day);
        g.hype = Math.max(g.hype, Number(a.getAt(x, y, _DT_LAUNCH_COL.HYPE)) || 0);
        g.name = g.name || String(a.getAt(x, y, _DT_LAUNCH_COL.NAME) || "");
      }
    }
  }
  return [...groups.values()].sort((p, q) => p.day - q.day);
}

// ── Launches page: the game's Ratings layout (rainbow waves, the man on the
// left), our list on the right (agreed mockup shots/mock/s-pp-2.jpg). ──
var _DT_LAUNCH_DEV_ICON = {
  ArraySmartphones: "smartphone", ArrayTablets: "tablet", ArrayLaptops: "laptop", ArrayWatches: "watches", ArrayHeadphones: "headphones",
  ArrayTV: "tv", ArrayScooters: "scooter", ArrayKeyboards: "keyboard", ArrayConsoles: "console", ArrayGamepads: "gamepad", ArrayVRConsoles: "vr",
};
var _DT_LAUNCH_TIERS = [["dt-b", { en: "Budget", ru: "Бюджет" }], ["dt-s", { en: "Standard", ru: "Стандарт" }], ["dt-f", { en: "Flagman", ru: "Флагман" }]];
// "hype 12%", or nothing while there is none (no "hype 0").
function _dtLaunchHype(h) {
  return Math.round(h) > 0 ? _dtLaunchU("hype", { h: Math.round(h) }) : "";
}
// One device row: icon, name and version tags, a sub line, the date cell and a button.
function _dtLaunchRow(list, g, sub, dot, btnLabel, onBtn) {
  const el = _dtUi.el;
  const row = el("div", "dt-pg-row", list);
  const img = el("img", "dt-pg-dev", row);
  img.src = "StartPageAnimFIles/Icons/" + (_DT_LAUNCH_DEV_ICON[g.arr] || "smartphone") + "_icon.png";
  img.alt = "";
  img.style.marginLeft = "calc(var(--dt) * 8px)";
  const tx = el("div", "dt-pg-tx", row);
  const nm = el("div", "dt-pg-nm", tx);
  el("span", "", nm, g.name || g.cat);
  for (const y of g.ys.slice().sort()) if (_DT_LAUNCH_TIERS[y]) el("span", "dt-pg-vt " + _DT_LAUNCH_TIERS[y][0], nm, _dtUi.t(_DT_LAUNCH_TIERS[y][1]));
  el("div", "dt-pg-sub", tx, sub);
  _dtLaunchDateCell(row, g.day, dot);
  _dtTb.control(row, "dt-pg-btn", "<span></span>", onBtn).firstChild.textContent = btnLabel;
  return row;
}
function _dtLaunchDateCell(row, day, dot) {
  const cell = _dtUi.el("div", "dt-pg-cell", row);
  const d = _dtUi.el("div", "dt-pg-date", cell);
  if (dot) d.style.setProperty("--c", dot);
  _dtUi.el("i", "", d);
  _dtUi.el("span", "", d, _dtLaunchDate(day));
  _dtUi.el("div", "dt-pg-sub", cell, _dtLaunchIn(day - _dtUi.num("DayTotal", 0)));
  return cell;
}
function _dtLaunchPageFrame(root) {
  _dtLaunchCss();
  const hdr = _dtUi.el("div", "dt-pg-hdr dtl-pg-hdr", root);
  const b = _dtUi.el("b", "", hdr);
  b.innerHTML = _dtLaunchSvg("rocket");
  _dtUi.el("span", "", b, _dtLaunchU("pgTitle"));
  _dtUi.el("i", "", hdr);
  _dtUi.el("span", "", hdr, _dtLaunchU("pgSub"));
  return _dtUi.el("div", "dt-pg-list dtl-pg", root);
}
function _dtLaunchEmpty(list) {
  const row = _dtUi.el("div", "dt-pg-row", list);
  const tx = _dtUi.el("div", "dt-pg-tx", row);
  _dtUi.el("span", "", _dtUi.el("div", "dt-pg-nm", tx), _dtLaunchU("emptyT"));
  _dtUi.el("div", "dt-pg-sub", tx, _dtLaunchU("emptyS"));
}
// Without launch events (DEVICES_TYCOON_EVENT off): the planned devices only.
function _dtLaunchPageBuild(root) {
  const list = _dtLaunchPageFrame(root);
  const paint = () => {
    list.innerHTML = "";
    const items = _dtLaunchShelf();
    if (!items.length) return _dtLaunchEmpty(list);
    _dtUi.el("div", "dt-pg-sec", list, _dtLaunchU("secPlanned"));
    for (const g of items) {
      _dtLaunchRow(list, g, [_dtLaunchU("solo"), _dtLaunchHype(g.hype)].filter(Boolean).join(" · "), "", _dtLaunchU("change"), () => _dtLaunchChange(g));
    }
  };
  paint();
  return { refresh: paint };
}
function _dtLaunchOpenShelf() {
  return typeof _dtTb !== "undefined" && _dtTb ? _dtTb.open("launch") : false;
}

// "Change date" for a planned device: a new day, or launch it today.
function _dtLaunchChange(g) {
  const T = _DT_LAUNCH_TEXT;
  const name = g.name || g.cat;
  let chosen = g.day;
  _dtUi.modal({
    title: _dtLaunchU("changeTitle"),
    pause: true,
    build: (body) => (body.parentNode && body.parentNode.classList && body.parentNode.classList.add("dtl-3"), 0) || _dtLaunchPicker(body, { text: _dtLaunchU("changeAsk", { n: "\u0000", d: _dtLaunchDate(g.day) }), name: name }, () => chosen, (d) => (chosen = d)),
    buttons: [
      { label: _dtLaunchU("cancel"), kind: "no" },
      { label: _dtUi.t(T.today), kind: "outline", onClick: () => _dtLaunchNow(g.arr, g.cat, g.x, g.ys, name) },
      {
        label: _dtLaunchU("save"),
        kind: "yes",
        main: true,
        onClick: () => {
          if (chosen <= _dtUi.num("DayTotal", 0)) _dtLaunchNow(g.arr, g.cat, g.x, g.ys, name);
          else _dtLaunchSetDay(g.arr, g.x, g.ys, chosen);
          _dtLaunchRefresh();
        },
      },
    ],
  });
}

// The page re-reads the shelf after any change; nothing is scanned while it is closed.
function _dtLaunchRefresh() {
  if (typeof _dtTb !== "undefined" && _dtTb && _dtTb.page() === "launch") _dtTb.refresh();
}
// Toolbar button just right of "+", opening the page on the game's Ratings layout.
if (typeof _dtTb !== "undefined" && _dtTb) {
  _dtTb.add({
    id: "launch", x: 1067.5, ref: 20216, label: _DT_LAUNCH_UI.tb, tint: [246, 204, 255], gradient: "Gradient_26", icon: _DT_LAUNCH_SVG.rocket,
    layout: "RATINGS", cls: "RATINGS",
    // Its title Text and the HTML ratings table (also hidden by CSS while the page is up).
    hide: [[10219, "hide"], [1535, "hide"]],
    build: (root) => _dtLaunchPageBuild(root),
  });
}
// The game skips its bankruptcy countdown while a device is still being made.
// A finished device waiting on the shelf for its launch day has not had its
// chance to sell yet either, so the countdown waits for it the same way, and
// for its first week on sale (sales are only counted from the day after).
// Only a launch due within 30 days counts, so moving the date can't hold it off forever.
var _DT_LAUNCH_GRACE = 7;
var _DT_LAUNCH_HOLD_AHEAD = 30;
function _dtLaunchSelling() {
  const today = _dtUi.num("DayTotal", 0);
  for (const arrName in _DT_LAUNCH_ARRAYS) {
    const a = _dtLaunchArr(arrName);
    if (!a) continue;
    const w = a.width | 0;
    const h = Math.min(3, a.height | 0);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        if (a.getAt(x, y, _DT_LAUNCH_COL.CREATED) === -1) continue;
        const day = Number(a.getAt(x, y, _DT_LAUNCH_COL.RELEASE));
        if (day >= 0 && day > today - _DT_LAUNCH_GRACE && day <= today + _DT_LAUNCH_HOLD_AHEAD) return true;
        if (day >= 0 && _dtLaunchWaits(arrName, a, x)) return true;
      }
    }
  }
  return false;
}
function _dtLaunchGuardBankruptcy() {
  const f = globalThis.tickBankruptcyDay;
  if (typeof f !== "function" || f._dtLaunch) return;
  const w = function () {
    try {
      if (_dtLaunchSelling()) return false;
    } catch (e) {}
    return f.apply(this, arguments);
  };
  w._dtLaunch = true;
  globalThis.tickBankruptcyDay = w;
}
function _dtLaunchTick() {
  try {
    const rt = globalThis.runtime;
    if (!rt || !rt.globalVars) return;
    _dtLaunchGuardBankruptcy();
    const lay = _dtUi.layoutName();
    const blocked = lay === "MENU" || lay === "START PAGE" || lay === "LOADING GAME";
    if (blocked) _dtLaunchLastDay = -1;
    const today = _dtUi.num("DayTotal", 0);
    if (!blocked && today !== _dtLaunchLastDay) {
      // A launch due on the day a save finishes loading has no previous tick
      // to bridge from, so the first office tick treats today as the boundary.
      const prev = _dtLaunchLastDay < 0 ? today - 1 : _dtLaunchLastDay;
      _dtLaunchLastDay = today;
      if (prev >= 0 && today > prev && today - prev < 40) {
        for (const arrName in _DT_LAUNCH_ARRAYS) {
          const a = _dtLaunchArr(arrName);
          if (!a) continue;
          const w = a.width | 0;
          const h = Math.min(3, a.height | 0);
          for (let x = 0; x < w; x++) {
            let hit = -1;
            for (let y = 0; y < h; y++) {
              const day = Number(a.getAt(x, y, _DT_LAUNCH_COL.RELEASE));
              if (a.getAt(x, y, _DT_LAUNCH_COL.CREATED) !== -1 && day > prev && day <= today && hit < 0) hit = y; // first (base) variant names the launch
            }
            if (hit < 0 || _dtLaunchWaits(arrName, a, x)) continue;
            _dtLaunchGo(arrName, _DT_LAUNCH_CATS[arrName], x, hit);
            const nm = String(a.getAt(x, hit, _DT_LAUNCH_COL.NAME) || "");
            _dtUi.toast(_dtUi.t(_DT_LAUNCH_TEXT.launched, { n: nm }), nm, { sales: true });
          }
        }
      }
    }
  } catch (e) {
    console.warn("[Launch] tick:", e);
  }
}
// The shared mod timer (ui.js every) when ui.js is in; a timer of our own without it.
_dtLaunchTimer = (typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(_dtLaunchTick, 250);
// Console and test access (the game script is a module, so nothing here is global).
globalThis._dtLaunchApi = { release: _dtLaunchRelease, shelf: _dtLaunchShelf, date: _dtLaunchDate, open: _dtLaunchOpenShelf };
