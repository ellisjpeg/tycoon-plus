// ── Launch events: several devices launch together on one planned day ──
// An event is a name and a day. In the Launch Day panel a device can be put
// on an upcoming event, which gives it the event's day. The game's early
// presentation offer (at the copies screen, before the launch day is chosen) is
// held for every device and made on its launch day instead: a device launching
// on its own sits on a one-device "solo" event, hidden from the event lists.
// On the event day the player is offered ONE presentation for all of them:
// the game's own slide show runs for each device in turn (its variants first,
// as the game already does), then one result screen with the totals, and all
// of them go on sale that day. The game charges nothing for a presentation
// (its offer only needs $5M in the bank), so neither does the event.
// State per company in ArraySaves row 153: {v, company, events:[{name, day, keys, names, solo}]}.
var _DT_EV_ROW = 153;
var _DT_EV_GATE = 5e6; // 261 BATCH: the offer needs Budget >= 5,000,000
// 261 BATCH: the offer also needs this research level >= 2 for the type.
var _DT_EV_RESEARCH = {
  ArraySmartphones: 211, ArrayTablets: 212, ArrayLaptops: 213, ArrayWatches: 214, ArrayHeadphones: 215, ArrayTV: 541,
  ArrayScooters: 542, ArrayKeyboards: 543, ArrayConsoles: 544, ArrayVRConsoles: 625,
};
var _DT_EV_LAYOUT = {
  ArraySmartphones: "PRESENTATION SMARTPHONE V2", ArrayTablets: "PRESENTATION TABLET V2", ArrayLaptops: "PRESENTATION LAPTOP V2",
  ArrayWatches: "PRESENTATION WATCHES V2", ArrayHeadphones: "PRESENTATION HEADPHONES V2", ArrayTV: "PRESENTATION TV V2",
  ArrayScooters: "PRESENTATION SCOOTER V2", ArrayKeyboards: "PRESENTATION KEYBOARD V2", ArrayConsoles: "PRESENTATION CONSOLE V2",
  ArrayVRConsoles: "PRESENTATION VR V2",
};
// The slide builders' option objects (their arrayX picks the device line).
var _DT_EV_OPTS = {
  ArraySmartphones: () => _OPTS, ArrayTablets: () => _OPTS2, ArrayLaptops: () => _OPTS3, ArrayWatches: () => _OPTS4,
  ArrayHeadphones: () => _OPTS5, ArrayTV: () => _OPTS6, ArrayScooters: () => _OPTS7, ArrayKeyboards: () => _OPTS8,
  ArrayConsoles: () => _OPTS9, ArrayVRConsoles: () => _OPTS10,
};
var _DT_EV_TEXT = {
  create: { en: "Create launch event", ru: "Создать презентацию запуска" },
  defName: { en: "Launch event", ru: "Презентация запуска" },
  nameLabel: { en: "Event name", ru: "Название" },
  dateLabel: { en: "Event day", ru: "День события" },
  createBtn: { en: "Create event", ru: "Создать" },
  at: { en: "Launch at {e}, {d}", ru: "Запуск на {e}, {d}" },
  withEvent: { en: "Launches with {e} on {d}.", ru: "Запуск вместе с {e}: {d}." },
  joined: { en: "{n} launches at {e} on {d}.", ru: "{n}: запуск на {e}, {d}." },
  hint: { en: "Devices at an event get one presentation together on the day.", ru: "Устройства события получают одну общую презентацию в этот день." },
  devJoin: { en: "{n} (in development) launches here", ru: "{n} (в разработке) запускается здесь" },
  noDevices: { en: "No devices yet.", ru: "Пока нет устройств." },
  today: { en: "{e} is today", ru: "{e} сегодня" },
  ask: { en: "Hold one presentation for all of them? They go on sale today either way.", ru: "Провести одну презентацию для всех? В продажу они поступят сегодня в любом случае." },
  soloToday: { en: "{n} launches today", ru: "{n}: запуск сегодня" },
  soloAsk: { en: "Hold a presentation for it? It goes on sale today either way.", ru: "Провести презентацию? В продажу устройство поступит сегодня в любом случае." },
  cost: { en: "Cost: free, as in the game (it needs {m} in the bank).", ru: "Стоимость: бесплатно, как в игре (нужно {m} на счету)." },
  skip: { en: "Skip, launch now", ru: "Пропустить" },
  hold: { en: "Hold presentation", ru: "Провести презентацию" },
  noShow: { en: "{n} has no presentation yet (research) and launches without one.", ru: "{n}: презентация ещё не изучена, запуск без неё." },
  launchedAll: { en: "{e}: {c} devices are on sale from today!", ru: "{e}: {c} устройств в продаже с сегодняшнего дня!" },
  launchedOne: { en: "{e}: 1 device is on sale from today!", ru: "{e}: 1 устройство в продаже с сегодняшнего дня!" },
  launchedFew: { en: "{e}: {c} devices are on sale from today!", ru: "{e}: {c} устройства в продаже с сегодняшнего дня!" },
};
var _dtEv = { events: [] };
var _dtEvSlot = -1;
var _dtEvCompany = "";
var _dtEvRun = null; // live combined presentation
var _dtEvStarting = false; // Hold pressed, the show starts after the panel's fade
var _dtEvWired = false;

function _dtEvSaves() {
  try {
    return globalThis.runtime.objects.ArraySaves.getFirstInstance();
  } catch (e) {
    return null;
  }
}
function _dtEvSlotNow() {
  return Math.max(0, Math.min(2, Math.round(_dtUi.num("SaveSlot", 0)) || 0));
}
function _dtEvCompanyNow() {
  return String(_dtUi.gv("CompanyName", "") || "");
}
// Pure: parse a row value into state for this company (anything else = empty).
function _dtEvParse(raw, company) {
  const out = { events: [] };
  if (typeof raw !== "string" || raw.charAt(0) !== "{") return out;
  try {
    const j = JSON.parse(raw);
    if (!j || j.v !== 1 || j.company !== company || !Array.isArray(j.events)) return out;
    for (const e of j.events) {
      if (!e || !Number.isFinite(Number(e.day))) continue;
      out.events.push({
        name: String(e.name || "").slice(0, 40), day: Math.round(Number(e.day)),
        keys: Array.isArray(e.keys) ? e.keys.map(String) : [], names: e.names && typeof e.names === "object" ? e.names : {},
      });
      if (e.solo === true) out.events[out.events.length - 1].solo = true;
    }
  } catch (e) {}
  return out;
}
function _dtEvLoad() {
  const slot = _dtEvSlotNow();
  const company = _dtEvCompanyNow();
  if (slot === _dtEvSlot && company === _dtEvCompany) return;
  _dtEvSlot = slot;
  _dtEvCompany = company;
  const a = _dtEvSaves();
  let raw = "";
  try {
    if (a && a.height > _DT_EV_ROW && a.width > slot) raw = a.getAt(slot, _DT_EV_ROW, 0);
  } catch (e) {}
  _dtEv = _dtEvParse(raw, company);
}
// Nothing is written until the first event exists, so untouched saves stay as they were.
function _dtEvSave() {
  const a = _dtEvSaves();
  const slot = _dtEvSlotNow();
  if (!a || a.height <= _DT_EV_ROW || a.width <= slot) return console.warn("[Event] no ArraySaves row", _DT_EV_ROW);
  a.setAt(JSON.stringify({ v: 1, company: _dtEvCompanyNow(), events: _dtEv.events }), slot, _DT_EV_ROW, 0);
}

// A device is known by its array and the game's ID column (10), or its name.
function _dtEvKey(arrName, a, x, y) {
  const id = Number(a.getAt(x, y, 10));
  return arrName + (id > 0 ? "#" + id : "|" + String(a.getAt(x, y, _DT_LAUNCH_COL.NAME) || ""));
}
// Line x of the device with this key, or -1.
function _dtEvFind(key) {
  const arrName = key.split(/[#|]/)[0];
  const a = _dtLaunchArr(arrName);
  if (!a) return null;
  const w = a.width | 0;
  const h = Math.min(3, a.height | 0);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (a.getAt(x, y, _DT_LAUNCH_COL.CREATED) === -1) continue;
      if (_dtEvKey(arrName, a, x, y) === key) return { arr: arrName, a: a, x: x };
    }
  }
  return null;
}
// Pure: the next event still ahead (by day), or null.
function _dtEvUpcoming(events, today) {
  let best = null;
  for (const e of events) if (e.day > today && (!best || e.day < best.day)) best = e;
  return best;
}
function _dtEvOf(key) {
  return _dtEv.events.find((e) => e.keys.indexOf(key) >= 0) || null;
}
// Events the player made (solo events are a single device's own launch day).
function _dtEvNamed() {
  return _dtEv.events.filter((e) => !e.solo);
}
function _dtEvNamedOf(key) {
  const e = _dtEvOf(key);
  return e && !e.solo ? e : null;
}
// The device launches on its own on this day, with the presentation offer then.
function _dtEvSolo(arrName, key, name, day) {
  _dtEvLeave(key);
  _dtEv.events = _dtEv.events.filter((e) => !e.solo || e.keys.length);
  if (_DT_EV_LAYOUT[arrName]) {
    _dtEv.events.push({ name: "", day: day, keys: [key], names: { [key]: name }, solo: true });
    _dtEv.events.sort((p, q) => p.day - q.day);
  }
  _dtEvSave();
}
function _dtEvLeave(key) {
  for (const e of _dtEv.events) {
    const i = e.keys.indexOf(key);
    if (i >= 0) e.keys.splice(i, 1);
    delete e.names[key];
  }
}
function _dtEvJoin(ev, key, name) {
  _dtEvLeave(key);
  ev.keys.push(key);
  ev.names[key] = name;
  _dtEvSave();
}
function _dtEvName(ev) {
  return ev.name || _dtUi.t(_DT_EV_TEXT.defName);
}
// Key of the device in development (newest unreleased line of its type).
function _dtEvDevKey() {
  const cat = String(_dtUi.gv("DeviceTypeCreatingNow", "") || "");
  const arrName = Object.keys(_DT_LAUNCH_CATS).find((k) => _DT_LAUNCH_CATS[k] === cat);
  const a = arrName && _dtLaunchArr(arrName);
  if (!a) return null;
  const h = Math.min(3, a.height | 0);
  for (let y = 0; y < h; y++) {
    if (a.getAt(0, y, _DT_LAUNCH_COL.CREATED) !== -1 && Number(a.getAt(0, y, _DT_LAUNCH_COL.RELEASE)) < 0) {
      return { key: _dtEvKey(arrName, a, 0, y), name: String(a.getAt(0, y, _DT_LAUNCH_COL.NAME) || cat) };
    }
  }
  return null;
}

// ── Pop-ups (the game's own pop-up look, agreed mockups s-nv-3 / s-nv-4) ──
var _DT_EV_UI = {
  toEvent: { en: "Add to a launch event instead", ru: "Добавить в презентацию запуска" },
  toDay: { en: "Pick a day instead", ru: "Выбрать день" },
  newEvent: { en: "New launch event", ru: "Новая презентация запуска" },
  editEvent: { en: "Edit launch event", ru: "Изменить презентацию" },
  event: { en: "EVENT", ru: "СОБЫТИЕ" },
  evIn: { en: "{e} · {in}", ru: "{e} · {in}" },
  ready: { en: "Ready to launch", ru: "Готов к запуску" },
  plannedFor: { en: "Planned for {d}", ru: "Запуск {d}" },
  atEvent: { en: "At {e}", ru: "На событии {e}" },
  inDev: { en: "In development", ru: "В разработке" },
  createBtn: { en: "Create", ru: "Создать" },
  save: { en: "Save", ru: "Сохранить" },
  cancel: { en: "Cancel", ru: "Отмена" },
  del: { en: "Delete event", ru: "Удалить событие" },
  devs1: { en: "1 device: {l}", ru: "1 устройство: {l}" },
  devsN: { en: "{c} devices: {l}", ru: "Устройств: {c}: {l}" },
  noDevs: { en: "No devices yet", ru: "Пока нет устройств" },
  oneShow: { en: "one presentation for all", ru: "одна презентация для всех" },
  offerTitle: { en: "Launch day", ru: "День запуска" },
  offerSolo: { en: "{n} goes on sale today. Do you want to hold a presentation of it first? A presentation attracts new fans and adds hype.", ru: "{n} сегодня поступает в продажу. Провести перед этим презентацию? Презентация привлекает новых фанатов и добавляет ажиотаж." },
  offerEvent: { en: "{n} go on sale today. Do you want to hold one presentation for all of them first? A presentation attracts new fans and adds hype.", ru: "{n} сегодня поступают в продажу. Провести перед этим одну общую презентацию? Презентация привлекает новых фанатов и добавляет ажиотаж." },
  no: { en: "No", ru: "Нет" },
  yes: { en: "Yes", ru: "Да" },
  and: { en: " & ", ru: " и " },
};
function _dtEvU(k, v) {
  return _dtUi.t(_DT_EV_UI[k], v);
}
// Upcoming player-made events, soonest first.
function _dtEvAhead() {
  const today = _dtUi.num("DayTotal", 0);
  return _dtEvNamed().filter((e) => e.day > today).sort((p, q) => p.day - q.day);
}
// The game-style checkbox row: green box with a tick, label, grey status on the right.
function _dtEvCheck(parent, label, on, onChange, status) {
  const row = _dtUi.el("div", "dtl-ck" + (on ? " dt-on" : ""), parent);
  _dtUi.el("i", "", row).innerHTML = _dtLaunchSvg("check");
  _dtUi.el("b", "", row, label);
  if (status) _dtUi.el("small", "", row, status);
  row.addEventListener("click", (ev) => {
    ev.stopPropagation();
    try { globalThis.tapTurn && globalThis.tapTurn(); } catch (e) {}
    on = !on;
    row.classList.toggle("dt-on", on);
    onChange(on);
  });
  return row;
}
// Lead text, then either the date row (day mode) or the chosen launch event
// (event mode), then the links. st: {mode, chosen, ev}; render() redraws.
function _dtEvPicker(body, st, lead, render, onNew) {
  body.innerHTML = "";
  _dtLaunchCss();
  _dtLaunchLead(body, lead);
  const events = _dtEvAhead();
  if (st.mode === "event" && st.ev && events.indexOf(st.ev) < 0) st.ev = events[0] || null;
  if (st.mode === "event" && st.ev) {
    const row = _dtUi.el("div", "dtl-dr", body);
    const cycle = (n) => () => {
      const i = events.indexOf(st.ev);
      st.ev = events[(i + n + events.length) % events.length];
      render();
    };
    const a = _dtLaunchArrow(row, _dtEvU("event"), -1, cycle(-1));
    const mid = _dtUi.el("div", "dtl-d", row);
    _dtUi.el("b", "", mid, _dtLaunchDate(st.ev.day));
    _dtUi.el("span", "", mid, _dtEvU("evIn", { e: _dtEvName(st.ev), in: _dtLaunchIn(st.ev.day - _dtUi.num("DayTotal", 0)) }));
    const b = _dtLaunchArrow(row, _dtEvU("event"), 1, cycle(1));
    if (events.length < 2) a.style.visibility = b.style.visibility = "hidden";
  } else {
    st.mode = "day";
    _dtLaunchDateRow(body, () => st.chosen, (d) => (st.chosen = d), { quick: true });
  }
  // The links sit under the buttons, as in the mockup.
  if (st.links) st.links.remove();
  const links = st.links = _dtUi.el("div", "dtl-lnk dtl-under", body);
  const card = body.parentNode;
  if (card && card.appendChild) card.appendChild(links);
  const link = (text, fn) => _dtUi.el("span", "", _dtLaunchTap(links, "", "", fn, "tapMain"), text);
  if (st.mode === "event") {
    link(_dtEvU("toDay"), () => { st.mode = "day"; render(); });
    _dtUi.el("i", "", links, "·").style.fontStyle = "normal";
    link(_dtEvU("newEvent"), onNew);
  } else {
    link(_dtEvU("toEvent"), () => {
      if (!events.length) return onNew();
      st.mode = "event";
      st.ev = st.ev || events[0];
      render();
    });
  }
}

// The Launch Day question (asked when the reviews are ready): a day, or a launch event.
function _dtEvAsk(arrName, cat, ys, preset, keep) {
  const T = _DT_LAUNCH_TEXT;
  _dtEvLoad();
  const today = _dtUi.num("DayTotal", 0);
  const name = _dtLaunchName(arrName, ys);
  const a = _dtLaunchArr(arrName);
  const key = a ? _dtEvKey(arrName, a, 0, ys[0]) : "";
  const mine = _dtEvNamedOf(key);
  const st = { mode: "day", chosen: today + 14, ev: null };
  if (mine && mine.day > today) Object.assign(st, { mode: "event", ev: mine });
  if (preset && typeof preset === "object") Object.assign(st, { mode: "event", ev: preset });
  else if (preset === true) Object.assign(st, { mode: "event", ev: _dtEvAhead()[0] || null });
  // Back from a cancelled "New launch event": the day or event the player had picked.
  if (keep && !(preset && typeof preset === "object")) Object.assign(st, { mode: keep.mode, chosen: Math.max(keep.chosen, today), ev: keep.ev });
  let body = null;
  const lead = { text: _dtUi.t(T.ask, { n: "\u0000" }), name: name };
  const render = () => _dtEvPicker(body, st, lead, render, () => {
    _dtUi.close(true);
    _dtEvCreate({
      asked: { key: key, name: name },
      onDone: (ev, ticked) => setTimeout(() => _dtEvAsk(arrName, cat, ys, ticked ? ev : undefined), 170),
      onCancel: () => setTimeout(() => _dtEvAsk(arrName, cat, ys, undefined, { mode: st.mode, chosen: st.chosen, ev: st.ev }), 170),
    });
  });
  _dtUi.modal({
    title: _dtUi.t(T.title),
    dismiss: false,
    pause: true,
    build: (b) => { body = b; render(); },
    buttons: [
      {
        label: _dtUi.t(T.today), kind: "outline", onClick: () => {
          _dtEvSolo(arrName, key, name, _dtUi.num("DayTotal", 0));
          _dtLaunchNow(arrName, cat, 0, ys, name);
        },
      },
      {
        label: _dtUi.t(T.plan),
        kind: "yes",
        main: true,
        onClick: () => {
          const now = _dtUi.num("DayTotal", 0);
          const ev = st.mode === "event" ? st.ev : null;
          if (ev && ev.day > now) {
            _dtEvJoin(ev, key, name);
            _dtLaunchSetDay(arrName, 0, ys, ev.day);
            _dtUi.toast(_dtUi.t(_DT_EV_TEXT.joined, { n: name, e: _dtEvName(ev), d: _dtLaunchDate(ev.day) }), name);
            return _dtLaunchRefresh();
          }
          const chosen = st.chosen;
          _dtEvSolo(arrName, key, name, Math.max(chosen, now));
          if (chosen <= now) return _dtLaunchNow(arrName, cat, 0, ys, name);
          _dtLaunchSetDay(arrName, 0, ys, chosen);
          _dtUi.toast(_dtUi.t(T.planned, { n: name, d: _dtLaunchDate(chosen) }), name);
          _dtLaunchRefresh();
        },
      },
    ],
  });
}

// Devices an event can hold: the one being asked about, every planned device,
// and the one in development. [{key, name, status, g?}]
function _dtEvCandidates(asked, ev) {
  const out = [];
  if (asked && asked.key) out.push({ key: asked.key, name: asked.name, status: _dtEvU("ready"), asked: true });
  for (const g of _dtLaunchShelf()) {
    const key = _dtEvItemKey(g);
    if (!key || out.some((o) => o.key === key)) continue;
    const on = _dtEvNamedOf(key);
    const status = on && on !== ev ? _dtEvU("atEvent", { e: _dtEvName(on) }) : _dtEvU("plannedFor", { d: _dtLaunchDate(g.day) });
    out.push({ key: key, name: g.name || g.cat, status: status, g: g });
  }
  const dev = _dtEvDevKey();
  if (dev && !out.some((o) => o.key === dev.key)) out.push({ key: dev.key, name: dev.name, status: _dtEvU("inDev"), dev: true });
  return out;
}
// "New launch event" / "Edit launch event": name, devices, day.
// opts: {asked: {key, name}, edit: event, onDone(ev, askedTicked), onCancel()}
function _dtEvCreate(start, onDone, onCancel) {
  // Old call shape (start day, callbacks) still works.
  const opts = start && typeof start === "object" ? start : { start: start, onDone: onDone, onCancel: onCancel };
  const E = _DT_EV_TEXT;
  _dtEvLoad();
  const today = _dtUi.num("DayTotal", 0);
  const ev = opts.edit || null;
  let chosen = ev ? ev.day : Math.max(opts.start || 0, today + 30);
  let input = null;
  const cands = _dtEvCandidates(opts.asked, ev);
  const ticked = new Map(cands.map((c) => [c.key, ev ? ev.keys.indexOf(c.key) >= 0 : !!c.asked]));
  _dtUi.modal({
    title: _dtEvU(ev ? "editEvent" : "newEvent"),
    pause: true,
    dismiss: false,
    build: (body) => {
      _dtLaunchCss();
      input = _dtUi.el("input", "dtl-inp", body);
      input.placeholder = _dtUi.t(E.defName);
      input.maxLength = 40;
      input.value = ev ? ev.name : "";
      input.style.marginTop = "calc(var(--dt) * 12px)";
      for (const t of ["pointerdown", "keydown", "keyup", "keypress"]) input.addEventListener(t, (e) => e.stopPropagation());
      const list = _dtUi.el("div", "dtl-list", body);
      for (const c of cands) _dtEvCheck(list, c.name, ticked.get(c.key), (on) => ticked.set(c.key, on), c.status);
      _dtLaunchDateRow(body, () => chosen, (d) => (chosen = d), { min: () => _dtUi.num("DayTotal", 0) + 1 });
      if (ev) {
        const links = _dtUi.el("div", "dtl-lnk dtl-under", body);
        if (body.parentNode && body.parentNode.appendChild) body.parentNode.appendChild(links);
        _dtLaunchTap(links, "", "", () => {
          _dtEvDelete(ev);
          _dtUi.close();
          opts.onCancel && opts.onCancel();
        }, "tapMain").textContent = _dtEvU("del");
      }
    },
    buttons: [
      { label: _dtEvU("cancel"), kind: "no", cancel: true, onClick: () => opts.onCancel && opts.onCancel() }, // Esc = Cancel
      {
        label: _dtEvU(ev ? "save" : "createBtn"),
        kind: "yes",
        main: true,
        onClick: () => {
          _dtEvLoad();
          const nm = input ? String(input.value || "").trim().slice(0, 40) : "";
          const day = Math.max(chosen, _dtUi.num("DayTotal", 0) + 1);
          const e = ev || { name: "", day: day, keys: [], names: {} };
          const oldDay = e.day;
          e.name = nm;
          e.day = day;
          if (!ev) _dtEv.events.push(e);
          for (const c of cands) {
            if (c.asked) continue;
            const on = ticked.get(c.key), member = e.keys.indexOf(c.key) >= 0;
            if (on) {
              if (!member) _dtEvJoin(e, c.key, c.name);
              if (c.g && (!member || day !== oldDay || c.g.day !== day)) _dtLaunchSetDay(c.g.arr, c.g.x, c.g.ys, day);
            } else if (member) {
              if (c.g) _dtEvSolo(c.g.arr, c.key, c.name, c.g.day);
              else _dtEvLeave(c.key);
            }
          }
          _dtEv.events.sort((p, q) => p.day - q.day);
          _dtEvSave();
          _dtLaunchRefresh();
          opts.onDone && opts.onDone(e, !!(opts.asked && ticked.get(opts.asked.key)));
        },
      },
    ],
  });
}
// An event is deleted: its devices keep their day as launches of their own.
function _dtEvDelete(ev) {
  _dtEvLoad();
  for (const key of ev.keys.slice()) {
    const f = _dtEvFind(key);
    const g = f && _dtLaunchShelf().find((s) => s.arr === f.arr && s.x === f.x);
    if (g) _dtEvSolo(g.arr, key, ev.names[key] || g.name || g.cat, g.day);
    else _dtEvLeave(key);
  }
  _dtEv.events = _dtEv.events.filter((e) => e !== ev);
  _dtEvSave();
  _dtLaunchRefresh();
}

// Pure: split shelf items into event groups (by event day) and the rest.
function _dtEvGroup(items, events, keyOf) {
  const groups = events.map((e) => ({ ev: e, items: [] }));
  const rest = [];
  for (const it of items) {
    const k = keyOf(it);
    const g = groups.find((g) => g.ev.keys.indexOf(k) >= 0 && g.ev.day === it.day);
    if (g) g.items.push(it);
    else rest.push(it);
  }
  return { groups: groups, rest: rest };
}
function _dtEvItemKey(g) {
  const a = _dtLaunchArr(g.arr);
  return a ? _dtEvKey(g.arr, a, g.x, g.ys[0]) : "";
}

// Launches page with events: Planned (devices launching on their own), then
// Launch events, then "New launch event".
function _dtEvPage(root) {
  const list = _dtLaunchPageFrame(root);
  const U = _dtLaunchU;
  const paint = () => {
    _dtEvLoad();
    const keep = list.scrollTop;
    list.innerHTML = "";
    const today = _dtUi.num("DayTotal", 0);
    const upcoming = _dtEvAhead();
    const split = _dtEvGroup(_dtLaunchShelf(), upcoming, _dtEvItemKey);
    if (!split.rest.length && !upcoming.length) _dtLaunchEmpty(list);
    if (split.rest.length) {
      _dtUi.el("div", "dt-pg-sec", list, U("secPlanned"));
      for (const g of split.rest) _dtLaunchRow(list, g, [U("solo"), _dtLaunchHype(g.hype)].filter(Boolean).join(" · "), "", U("change"), () => _dtEvChange(g));
    }
    if (upcoming.length) {
      _dtUi.el("div", "dt-pg-sec", list, U("secEvents"));
      const dev = _dtEvDevKey();
      for (const grp of split.groups) {
        const ev = grp.ev;
        const names = grp.items.map((g) => g.name || g.cat);
        if (dev && ev.keys.indexOf(dev.key) >= 0) names.push(dev.name);
        const row = _dtUi.el("div", "dt-pg-row", list);
        _dtUi.el("div", "dt-pg-num", row).innerHTML = _dtLaunchSvg("star");
        const tx = _dtUi.el("div", "dt-pg-tx", row);
        _dtUi.el("span", "", _dtUi.el("div", "dt-pg-nm", tx), _dtEvName(ev));
        let sub = names.length ? _dtEvU(names.length === 1 ? "devs1" : "devsN", { c: names.length, l: names.join(", ") }) : _dtEvU("noDevs");
        if (names.length > 1) sub += " · " + _dtEvU("oneShow");
        _dtUi.el("div", "dt-pg-sub", tx, sub);
        _dtLaunchDateCell(row, ev.day, "#b06cff");
        _dtTb.control(row, "dt-pg-btn", "<span></span>", () => _dtEvEdit(ev)).firstChild.textContent = U("edit");
      }
    }
    const link = _dtTb.control(list, "dt-pg-link", _dtLaunchSvg("plus") + "<span></span>", () => _dtEvCreate({}));
    link.lastChild.textContent = U("newEvent");
    list.scrollTop = keep;
    void today;
  };
  paint();
  return { refresh: paint };
}
function _dtEvEdit(ev) {
  _dtEvCreate({ edit: ev });
}
function _dtEvOpenShelf() {
  return typeof _dtTb !== "undefined" && _dtTb ? _dtTb.open("launch") : false;
}

// "Change date" from the page: a new day, a launch event, or launch it today.
function _dtEvChange(g) {
  const T = _DT_LAUNCH_TEXT;
  const key = _dtEvItemKey(g);
  const name = g.name || g.cat;
  const today = _dtUi.num("DayTotal", 0);
  const mine = _dtEvNamedOf(key);
  const st = mine && mine.day > today ? { mode: "event", chosen: g.day, ev: mine } : { mode: "day", chosen: g.day, ev: null };
  let body = null;
  const lead = { text: _dtLaunchU("changeAsk", { n: "\u0000", d: _dtLaunchDate(g.day) }), name: name };
  const render = () => _dtEvPicker(body, st, lead, render, () => {
    _dtUi.close(true);
    _dtEvCreate({ asked: { key: key, name: name }, onDone: (ev, ticked) => {
      if (ticked) {
        _dtEvJoin(ev, key, name);
        _dtLaunchSetDay(g.arr, g.x, g.ys, ev.day);
        _dtLaunchRefresh();
      }
    } });
  });
  _dtUi.modal({
    title: _dtLaunchU("changeTitle"),
    pause: true,
    build: (b) => { body = b; if (b.parentNode && b.parentNode.classList) b.parentNode.classList.add("dtl-3"); render(); },
    buttons: [
      { label: _dtEvU("cancel"), kind: "no" },
      {
        label: _dtUi.t(T.today), kind: "outline", onClick: () => {
          _dtEvSolo(g.arr, key, name, _dtUi.num("DayTotal", 0));
          _dtLaunchNow(g.arr, g.cat, g.x, g.ys, name);
        },
      },
      {
        label: _dtEvU("save"),
        kind: "yes",
        main: true,
        onClick: () => {
          const now = _dtUi.num("DayTotal", 0);
          if (st.mode === "event" && st.ev && st.ev.day > now) {
            _dtEvJoin(st.ev, key, name);
            _dtLaunchSetDay(g.arr, g.x, g.ys, st.ev.day);
          } else {
            _dtEvSolo(g.arr, key, name, Math.max(st.chosen, now));
            if (st.chosen <= now) _dtLaunchNow(g.arr, g.cat, g.x, g.ys, name);
            else _dtLaunchSetDay(g.arr, g.x, g.ys, st.chosen);
          }
          _dtLaunchRefresh();
        },
      },
    ],
  });
}

function _dtEvRefresh() {
  if (typeof _dtTb !== "undefined" && _dtTb && _dtTb.page() === "launch") _dtTb.refresh();
}

// The game's early offer is made on launch day instead: drop the queued PRESENTATION news.
function _dtEvSkipOffer() {
  if (!_dtEvDevKey()) return;
  let q = null;
  try {
    q = globalThis.runtime.objects.ArrayGameAssistant.getFirstInstance();
  } catch (e) {}
  if (!q) return;
  const w = q.width | 0;
  for (let x = 0; x < w; x++) {
    if (q.getAt(x, 0, 0) !== "PRESENTATION") continue;
    if (x === 0 && _dtUi.gv("Assistant", "OFF") === "ON") return; // on screen: the card hook below
    return _dtEvDropCard(q, x);
  }
}
function _dtEvDropCard(q, x) {
  const w = q.width | 0, h = q.height | 0, d = q.depth | 0;
  for (let i = x; i < w - 1; i++) for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) q.setAt(q.getAt(i + 1, y, z), i, y, z);
  q.setSize(Math.max(0, w - 1), h, d);
}
// The game shows queued cards as soon as an office opens (276 GAMEPLAY), often before the
// tick above runs: the PRESENTATION card is also held at the moment it would show.
var _dtEvNewsOrig = showOfficeNews;
showOfficeNews = function () {
  try {
    const rt = globalThis.runtime;
    const g = rt.globalVars;
    const q = rt.objects.ArrayGameAssistant.getFirstInstance();
    if (g.AssistantTheme === "PRESENTATION" && !_dtEvRun && q && q.getAt(0, 0, 0) === "PRESENTATION" && _dtEvDevKey()) {
      _dtEvDropCard(q, 0);
      setTimeout(() => {
        if (g.Assistant !== "ON" || g.AssistantTheme !== "PRESENTATION") return;
        g.Assistant = "OFF";
        g.AssistantTheme = "";
        rt.callFunction("Assistant_OFF");
      }, 0);
      return true;
    }
  } catch (e) {
    console.warn("[Event] offer:", e);
  }
  return _dtEvNewsOrig.apply(this, arguments);
};

// ── The event day ──
// Pure: the cost of an event presentation, the game's rule per device summed.
// The game's offer costs nothing (261 BATCH, 279 ASSISTANT, 197-209 take no money).
function _dtEvCost(devices) {
  return devices.reduce((s) => s + 0, 0);
}
function _dtEvCanPresent(arrName) {
  try {
    const r = globalThis.runtime.objects.ArrayMyResearch.getFirstInstance();
    return !!_DT_EV_LAYOUT[arrName] && Number(r.getAt(_DT_EV_RESEARCH[arrName], 0, 0)) >= 2;
  } catch (e) {
    return false;
  }
}
// Devices of an event that are due, with their line and variant rows.
function _dtEvDevices(ev) {
  const out = [];
  for (const key of ev.keys) {
    const f = _dtEvFind(key);
    if (!f) continue;
    const h = Math.min(3, f.a.height | 0);
    const ys = [];
    for (let y = 0; y < h; y++) {
      if (f.a.getAt(f.x, y, _DT_LAUNCH_COL.CREATED) !== -1 && Number(f.a.getAt(f.x, y, _DT_LAUNCH_COL.RELEASE)) === ev.day) ys.push(y);
    }
    if (ys.length) out.push({ key: key, arr: f.arr, cat: _DT_LAUNCH_CATS[f.arr], x: f.x, ys: ys, name: String(f.a.getAt(f.x, ys[0], _DT_LAUNCH_COL.NAME) || f.arr) });
  }
  return out;
}
function _dtEvLaunch(dev) {
  _dtLaunchGo(dev.arr, dev.cat, dev.x, dev.ys[0]);
  try {
    presentationApplyOnRelease(dev.arr, globalThis.runtime); // no-op unless its presentation is pending
  } catch (e) {}
}
function _dtEvFinish(ev, devs) {
  _dtEv.events = _dtEv.events.filter((e) => e !== ev);
  _dtEvSave();
  if (ev.solo) devs.forEach((d) => _dtUi.toast(_dtUi.t(_DT_LAUNCH_TEXT.launched, { n: d.name }), d.name, { sales: true }));
  else if (devs.length) {
    const n = devs.length, few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
    const T = n === 1 ? _DT_EV_TEXT.launchedOne : few ? _DT_EV_TEXT.launchedFew : _DT_EV_TEXT.launchedAll;
    _dtUi.toast(_dtUi.t(T, { e: _dtEvName(ev), c: n }), _dtEvName(ev), { sales: true });
  }
  _dtEvRefresh();
}
// "Launch today" on a device on today's event: the event (and its offer) puts it on sale.
var _dtEvNowOrig = _dtLaunchNow;
function _dtEvNow(arrName, cat, x, ys, name) {
  const a = _dtLaunchArr(arrName);
  const ev = a && ys.length ? _dtEvOf(_dtEvKey(arrName, a, x, ys[0])) : null;
  const today = _dtUi.num("DayTotal", 0);
  if (!ev || ev.day !== today) return _dtEvNowOrig(arrName, cat, x, ys, name);
  _dtLaunchSetDay(arrName, x, ys, today);
  _dtLaunchRefresh();
}
// The launch-day offer (agreed mockup s-nv-2): one presentation for the
// device, or for every device of the event, or straight on sale.
function _dtEvDay(ev) {
  const devs = _dtEvDevices(ev);
  if (!devs.length) return _dtEvFinish(ev, devs); // an event with no devices just passes
  const shown = devs.filter((d) => _dtEvCanPresent(d.arr));
  const budget = _dtUi.num("Budget", 0);
  if (!shown.length || budget < _DT_EV_GATE) {
    devs.forEach(_dtEvLaunch);
    return _dtEvFinish(ev, devs);
  }
  _dtUi.modal({
    title: ev.solo ? _dtEvU("offerTitle") : _dtEvName(ev),
    offer: true,
    dismiss: false,
    pause: true,
    build: (body) => {
      _dtLaunchCss();
      // One device: the game's centred message line (ui.js msg), name in yellow.
      if (devs.length === 1 && _dtUi.msg) _dtUi.msg(body, _dtEvU("offerSolo", { n: devs[0].name }), devs[0].name);
      else {
        const p = _dtUi.el("div", "dt-msg", body);
        const parts = _dtEvU(devs.length < 2 ? "offerSolo" : "offerEvent", { n: "\u0000" }).split("\u0000");
        _dtUi.el("span", "", p, parts[0]);
        devs.forEach((d, i) => {
          if (i) _dtUi.el("span", "", p, i === devs.length - 1 ? _dtEvU("and") : ", ");
          _dtUi.el("em", "", p, d.name);
        });
        _dtUi.el("span", "", p, parts[1] || "");
      }
      for (const d of devs) if (shown.indexOf(d) < 0) _dtUi.el("div", "dtl-sm", body, _dtUi.t(_DT_EV_TEXT.noShow, { n: d.name }));
    },
    buttons: [
      { label: _dtEvU("no"), kind: "no", onClick: () => {
        devs.forEach(_dtEvLaunch);
        _dtEvFinish(ev, devs);
      } },
      { label: _dtEvU("yes"), kind: "yes", main: true, onClick: () => {
        _dtEvStarting = true;
        setTimeout(() => _dtEvStart(ev, devs, shown), 180);
      } },
    ],
  });
}

// One combined presentation: each device's own slide show in turn, results at the end.
var _dtEvFindSlotOrig = null;
function _dtEvStart(ev, devs, shown) {
  const rt = globalThis.runtime;
  _dtEvStarting = false;
  devs.filter((d) => shown.indexOf(d) < 0).forEach(_dtEvLaunch);
  _dtEvRun = { ev: ev, devs: devs, list: shown, i: -1, sum: { v: 0, o: 0, f: 0, p: 0, n: 0 }, cat: rt.globalVars.DeviceTypeCreatingNow };
  // The pipeline's live item is parked for the show (its rooms wait) and comes back after.
  if (typeof _dtpPark === "function" && _dtpFocused()) _dtEvRun.park = _dtpPark(rt.globalVars);
  _dtEvWire();
  _dtEvNext();
}
function _dtEvNext() {
  const run = _dtEvRun;
  const rt = globalThis.runtime;
  run.i++;
  const d = run.list[run.i];
  if (_dtEvFindSlotOrig === null) _dtEvFindSlotOrig = _findDevSlotX2;
  const orig = _dtEvFindSlotOrig;
  const target = d.arr;
  _findDevSlotX2 = function (A) {
    try {
      if (A === _dtLaunchArr(target)) return d.x;
    } catch (e) {}
    return orig(A);
  };
  for (const k in _DT_EV_OPTS) _DT_EV_OPTS[k]().arrayX = k === d.arr ? d.x : 0;
  try {
    clearPendingPresentationPopularity();
  } catch (e) {}
  const g = rt.globalVars;
  g.DeviceTypeCreatingNow = d.cat;
  g.PresentationDevice = d.cat;
  g.PresentationDeviceID = 0;
  g.PresentationDeviceCountMax = Math.max(1, Math.min(3, d.ys.length));
  g.LastClass = "GAMEPLAY";
  g.class = "PRESENTATION";
  rt.goToLayout(_DT_EV_LAYOUT[d.arr]);
}
// Between devices the game starts PRESENTATION FINISH (it works out that
// device's results there) and the show goes straight on to the next device,
// whose slides take ~0.5 s to load, so that FINISH would be seen. A black
// cover goes up inside the layout-start event, before FINISH is first drawn,
// and fades out as the next device's slides start. Clicks pass through.
var _dtEvCover = null;
var _dtEvCoverT = 0;
function _dtEvCoverOn() {
  if (typeof document === "undefined") return;
  try {
    const layer = _dtUi.ensure();
    if (!_dtEvCover || _dtEvCover.isConnected === false) {
      _dtEvCover = _dtUi.el("div", "dt-ev-cover", layer);
      Object.assign(_dtEvCover.style, { position: "fixed", left: "0", top: "0", right: "0", bottom: "0", background: "#000", pointerEvents: "none" });
    }
    clearTimeout(_dtEvCoverT);
    Object.assign(_dtEvCover.style, { transition: "none", opacity: "1", display: "block" });
    _dtEvCoverT = setTimeout(_dtEvCoverOff, 10000); // never left up
  } catch (e) {}
}
function _dtEvCoverOff() {
  const c = _dtEvCover;
  if (!c || c.style.display === "none" || c.style.opacity === "0") return;
  clearTimeout(_dtEvCoverT);
  Object.assign(c.style, { transition: "opacity 0.35s ease-out", opacity: "0" });
  _dtEvCoverT = setTimeout(() => (c.style.display = "none"), 400);
}
function _dtEvRestore() {
  const run = _dtEvRun;
  _dtEvRun = null;
  _dtEvCoverOff();
  for (const k in _DT_EV_OPTS) _DT_EV_OPTS[k]().arrayX = 0;
  if (_dtEvFindSlotOrig) _findDevSlotX2 = _dtEvFindSlotOrig;
  try {
    if (run) globalThis.runtime.globalVars.DeviceTypeCreatingNow = run.cat;
    if (run && run.park && _dtp.items.indexOf(run.park) >= 0 && !_dtp.focus) {
      _dtpWrite(globalThis.runtime.globalVars, run.park.vars);
      _dtp.focus = run.park.id;
    }
  } catch (e) {}
}
// FINISH of one device: the game has computed its results; launch it (which
// applies its popularity boost), then show the next device or the totals.
function _dtEvOnLayout() {
  const run = _dtEvRun;
  if (!run) return;
  const lay = _dtUi.layoutName();
  if (lay !== "PRESENTATION FINISH") {
    if (lay.indexOf("PRESENTATION") === 0) return _dtEvCoverOff();
    // Left the show some other way: launch whoever has not had a turn yet.
    run.list.slice(Math.max(0, run.i)).forEach(_dtEvLaunch);
    _dtEvRestore();
    return _dtEvFinish(run.ev, run.devs);
  }
  const d = run.list[run.i];
  const r = getLastPresentationResults();
  if (r) {
    run.sum.v += r.visitors || 0;
    run.sum.o += r.online || 0;
    run.sum.f += r.newFans || 0;
    run.sum.p += r.popularity || 0;
    run.sum.n++;
  }
  _dtEvLaunch(d);
  if (run.i + 1 < run.list.length) {
    _dtEvCoverOn();
    return _dtEvNext();
  }
  const g = globalThis.runtime.globalVars;
  g.Presentation_TotalVisitors = run.sum.v;
  g.Presentation_OnlineViewers = run.sum.o;
  g.Presentation_NewFans = run.sum.f;
  g.Presentation_Popularity = run.sum.n ? Math.round(run.sum.p / run.sum.n) : 0;
  const ev = run.ev;
  const devs = run.devs;
  _dtEvRestore();
  _dtEvFinish(ev, devs);
}
function _dtEvWire() {
  if (_dtEvWired) return;
  _dtEvWired = true;
  globalThis.runtime.addEventListener("afteranylayoutstart", () => {
    try {
      _dtEvOnLayout();
    } catch (e) {
      console.warn("[Event] layout:", e);
      _dtEvRestore();
    }
  });
}

// Launch tick with events: event devices wait for their event's flow.
function _dtEvTick() {
  try {
    const rt = globalThis.runtime;
    if (!rt || !rt.globalVars) return;
    _dtLaunchGuardBankruptcy();
    const lay = _dtUi.layoutName();
    const blocked = lay === "MENU" || lay === "START PAGE" || lay === "LOADING GAME";
    if (lay === "LOADING GAME" && String(rt.globalVars.LoadingType || "").toUpperCase() === "NEW GAME") {
      const a = _dtEvSaves();
      try {
        if (a && a.height > _DT_EV_ROW && a.width > _dtEvSlotNow() && a.getAt(_dtEvSlotNow(), _DT_EV_ROW, 0) !== 0) a.setAt("", _dtEvSlotNow(), _DT_EV_ROW, 0);
      } catch (e) {}
      _dtEvSlot = -1;
    }
    if (blocked) {
      _dtLaunchLastDay = -1;
      _dtEvSlot = -1;
      return;
    }
    if (!_dtEvRun) _dtEvLoad();
    const today = _dtUi.num("DayTotal", 0);
    // Only a device still dated on its event's day waits for it; one moved to
    // another day by any other route launches on that day as normal.
    const waiting = new Map();
    for (const e of _dtEv.events) for (const k of e.keys) waiting.set(k, e.day);
    if (today !== _dtLaunchLastDay) {
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
            let held = false;
            for (let y = 0; y < h; y++) {
              const day = Number(a.getAt(x, y, _DT_LAUNCH_COL.RELEASE));
              if (a.getAt(x, y, _DT_LAUNCH_COL.CREATED) !== -1 && day > prev && day <= today) {
                if (hit < 0) hit = y; // first (base) variant names the launch
                held = held || waiting.get(_dtEvKey(arrName, a, x, y)) === day;
              }
            }
            if (hit < 0 || held || _dtLaunchWaits(arrName, a, x)) continue;
            _dtLaunchGo(arrName, _DT_LAUNCH_CATS[arrName], x, hit);
            const nm = String(a.getAt(x, hit, _DT_LAUNCH_COL.NAME) || "");
            _dtUi.toast(_dtUi.t(_DT_LAUNCH_TEXT.launched, { n: nm }), nm, { sales: true });
          }
        }
      }
    }
    _dtEvSkipOffer();
    const due = _dtEv.events.find((e) => e.day <= today);
    const g = rt.globalVars;
    if (due && !_dtEvRun && !_dtEvStarting && _dtUi.onOffice() && !_dtUi.isOpen() && g.Assistant !== "ON" && g.class === "GAMEPLAY") _dtEvDay(due);
  } catch (e) {
    console.warn("[Event] tick:", e);
  }
}
_dtLaunchAsk = _dtEvAsk;
_dtLaunchNow = _dtEvNow;
_dtLaunchOpenShelf = _dtEvOpenShelf;
_dtLaunchPageBuild = _dtEvPage;
_dtLaunchRefresh = _dtEvRefresh;
_dtLaunchChange = _dtEvChange;
// The shared mod timer (ui.js every) when ui.js is in; a timer of our own without it.
(typeof _dtUi !== "undefined" && _dtUi.stopEvery || clearInterval)(_dtLaunchTimer);
_dtLaunchTimer = (typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(_dtEvTick, 250);
globalThis._dtEventApi = {
  state: () => _dtEv, parse: _dtEvParse, upcoming: _dtEvUpcoming, group: _dtEvGroup, cost: _dtEvCost, solo: _dtEvSolo,
  create: _dtEvCreate, ask: _dtEvAsk, shelf: _dtEvOpenShelf, day: _dtEvDay, devices: _dtEvDevices, run: () => _dtEvRun,
};
