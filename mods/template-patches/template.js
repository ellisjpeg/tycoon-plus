// ── Device templates: "Start from" a previous device on the name screen ──
// Saved device rows hold database IDs. List selectors are 1-based positions
// in *_Temp windows that move as research advances, so a selector is never
// copied. Instead the game's own list functions are run and their *_Temp
// output is searched for each saved ID. An ID that has left its list falls
// back to the next one up (else the closest one below) and is reported.
// The device arrays and the save are never written; any failure restores
// the editor state captured just before the copy.
// Since game update 1.6 the name screen also has the game's own "Copy the design
// of a past model" (looks only). This copy leaves the looks alone (_dtTplLooks), so
// the two work together in either order: specs and parts from one model, looks
// from another.
// Devices waiting in the build queue (queue patch, _dtQueueApi.templates) are listed
// too, as "Queued: <name>". Their stored values are what AddToArray would
// write, so they are read through the same cells as a saved row.
var _DT_TPL_MAP = __DT_TPL_MAP__;
var _dtTplSlots = {};
var _dtTplGen = 0;
var _dtTplTimer = 0;
// Not copied: the new name and price, and choices that point at other
// devices by position (bundled headphones, the console's gamepad).
var _DT_TPL_SKIP = new Set([
  "DeviceName",
  "DeviceCostPrice",
  "DevicePrice",
  "PackageHeadphonesID",
  "UseMyHeadphones",
  "GamepadSelected_ID",
  "GamepadCreatedNew",
  "class",
  "LastClass",
]);
// Editor UI state the solver changes temporarily.
var _DT_TPL_UI_KEEP = ["MiniPage", "CameraSelected", "SubPage", "SubPageMax"];
// First of the five design cells that hold the custom palette, packed as
// red + green*256 + blue*65536 (the page-1 events write them from Red1..5,
// Green1..5 and Blue1..5). Laptop and headphones number their cells earlier.
var _DT_TPL_PALETTE = { SMARTPHONE: 123, TABLET: 123, LAPTOP: 6, WATCHES: 42, HEADPHONES: 14, TV: 32 };
// The colour page (ChooseColor) rebuilds each palette colour from its picker
// position whenever it opens, so the positions must match the copied colour.
// Hue = round(360 * unlerp(hue bar left, right, ColorLineN_X)); saturation and
// brightness are rounded to 1% from the square's right->left (ColorCanvasN_X)
// and bottom->top (ColorCanvasN_Y minus a per-page offset). The picker bounds
// are the same on every PAGE 2 layout.
var _DT_TPL_PICK = { hue: [117, 523], sx: [523, 117], vy: [505, 175], off: { LAPTOP: 80, WATCHES: 100, HEADPHONES: 100 } };
var _DT_TPL_NUM_MARK = -987654.25;
var _DT_TPL_STR_MARK = "\u0001dt-tpl";
var _DT_TPL_TEXT = {
  label: { en: "Start from a past model's specs", ru: "Взять характеристики прошлой модели" },
  fresh: { en: "Don't copy", ru: "Не копировать" },
  copied: { en: "Specs and parts copied from {n}.", ru: "Характеристики и детали скопированы с {n}." },
  swapOne: { en: "1 part is no longer sold, so the closest available one was used: {l}.", ru: "1 деталь больше не продаётся, выбрана ближайшая доступная: {l}." },
  swapMany: { en: "{c} parts are no longer sold, so the closest available ones were used: {l}.", ru: "Деталей больше не продаётся: {c}. Выбраны ближайшие доступные: {l}." },
  adjusted: { en: "Adjusted to fit: {l}.", ru: "Подогнано: {l}." },
  missing: { en: "Not available: {l}.", ru: "Недоступно: {l}." },
  headphones: { en: "Bundled headphones were not copied.", ru: "Наушники в комплекте не скопированы." },
  gamepad: { en: "Check the gamepad choice.", ru: "Проверьте выбор геймпада." },
  more: { en: "{l} and {c} more", ru: "{l} и ещё {c}" },
  reset: { en: "Specs and parts are back to how they were.", ru: "Характеристики и детали возвращены как были." },
  failed: { en: "Could not copy {n}. Nothing was changed.", ru: "Не удалось скопировать {n}. Ничего не изменено." },
  version: { en: "{n} ({t})", ru: "{n} ({t})" },
  inQueue: { en: "In the build queue", ru: "В очереди на производство" },
  released: { en: "Your devices", ru: "Ваши устройства" },
};
// Russian names for the part fields, using the game's own terms where it has
// them. Unknown fields keep the English label rather than an internal ID.
var _DT_TPL_RU = {
  "Acoustic Chanel": "Акустический канал",
  Anticheat: "Античит",
  Battery: "Батарея",
  Bluetooth: "Bluetooth",
  "Camera Angles View Height": "Высота угла обзора камеры",
  "Camera Angles View Width": "Ширина угла обзора камеры",
  "Camera Count": "Количество камер",
  "Camera Diafragm": "Диафрагма камеры",
  "Camera FPS": "FPS камеры",
  "Camera MPX": "Мегапиксели камеры",
  "Camera Photo Resolution": "Разрешение фото камеры",
  "Camera Slow Motion FPS": "FPS замедленной съёмки",
  "Camera Slow Motion Resolution": "Разрешение замедленной съёмки",
  "Camera Video FPS": "FPS видео камеры",
  "Camera Video Resolution": "Разрешение видео камеры",
  "Camera Zoom": "Зум камеры",
  "Case Lighting": "Подсветка корпуса",
  "Charger Connector": "Разъём зарядки",
  Cooling: "Охлаждение",
  Crypting: "Шифрование",
  "Drive Supported": "Поддерживаемый накопитель",
  Dynamics: "Динамики",
  "Dynamics Series": "Серия динамиков",
  "Ethernet Version": "Версия Ethernet",
  "Frontal Camera Resolution": "Разрешение фронтальной камеры",
  "GPS Version": "Версия GPS",
  "Graphic Processor": "Графический процессор",
  "Graphic Processor Model": "Модель графического процессора",
  "Graphic Processor Pixel Fillrate": "Скорость заполнения пикселей",
  "Graphic Processor Processing Power": "Вычислительная мощность",
  "Graphic Processor Refresh Rate": "Частота обновления",
  "Graphic Processor Series": "Серия графического процессора",
  "Graphic Processor Texture Fill Rate": "Скорость заполнения текстур",
  "Graphic Processor Texture Units": "Блоки текстур",
  "Graphic Processor VRAM": "Видеопамять",
  Graphic2D: "Графика 2D",
  Graphic3D: "Графика 3D",
  "Headphones Bass Algoritm": "Алгоритм басов",
  "Headphones Battery": "Батарея наушников",
  "Headphones Driver Configuration": "Конфигурация драйверов",
  "Headphones Ear Fitting": "Посадка в ухе",
  "Headphones Equalizer": "Эквалайзер",
  "Headphones Microphone Profile": "Профиль микрофона",
  "Headphones Noice Reduction Type": "Тип шумоподавления",
  "Headphones Spatial Audio": "Пространственный звук",
  "Headphones Transparency Mode": "Режим прозрачности",
  "Memory Bus Width": "Ширина шины памяти",
  "Micro SD Size Max": "Макс. объём microSD",
  "Microphone Chip": "Микрофонный чип",
  Network: "Сеть",
  "Operating Temperature": "Рабочая температура",
  "Operation System": "Операционная система",
  "Physical Engine": "Физический движок",
  Processor: "Процессор",
  "Processor AI Compute Power": "Мощность ИИ",
  "Processor Cashe Memory": "Кэш-память",
  "Processor Cores": "Ядра процессора",
  "Processor Dsp Performance": "Производительность DSP",
  "Processor Flash Memory": "Флеш-память",
  "Processor Frame Processing Latency": "Задержка обработки кадра",
  "Processor Frequency Range": "Диапазон частот",
  "Processor Input Lag": "Задержка ввода",
  "Processor Input Latency": "Задержка ввода",
  "Processor Key Scan Rate": "Частота опроса клавиш",
  "Processor Key Throughput": "Пропускная способность клавиш",
  "Processor Latency Level": "Уровень задержки",
  "Processor Max Bittrate Support": "Макс. битрейт",
  "Processor Microphone Level": "Уровень микрофона",
  "Processor Model": "Модель процессора",
  "Processor Motor Control Frequency": "Частота управления мотором",
  "Processor Motor Control Resolution": "Разрешение управления мотором",
  "Processor Refresh Rate": "Частота обновления",
  "Processor SRAM": "SRAM процессора",
  "Processor Sensor Bandwidth": "Пропускная способность сенсоров",
  "Processor Sensor Latency": "Задержка сенсоров",
  "Processor Series": "Серия процессора",
  "Processor Techprocess": "Техпроцесс",
  RAM: "Оперативная память",
  "RAM Type": "Тип оперативной памяти",
  ROM: "ПЗУ",
  "ROM Type": "Тип ПЗУ",
  "Scooter Breaks Level": "Уровень тормозов",
  "Screen Angle View Height": "Высота угла обзора экрана",
  "Screen Angle View Width": "Ширина угла обзора экрана",
  "Screen Backlight Scanning": "Сканирование подсветки",
  "Screen Brightness": "Яркость экрана",
  "Screen Color Depth": "Глубина цвета",
  "Screen Color Gamut": "Цветовой охват",
  "Screen Contast": "Контрастность экрана",
  "Screen Density": "Плотность пикселей",
  "Screen Dimming Technology": "Технология затемнения",
  "Screen HDR": "HDR экрана",
  "Screen Motion Index": "Индекс движения",
  "Screen Protection": "Защита экрана",
  "Screen Refresh Rate": "Частота обновления экрана",
  "Screen Resolution": "Разрешение экрана",
  "Screen Technology": "Технология экрана",
  "Screen Viewing Angle": "Угол обзора экрана",
  "Sound Chip": "Звуковой чип",
  "Sound Technology": "Звуковая технология",
  "Type A Version": "Версия Type-A",
  "Type B Version": "Версия Type-B",
  "Type C Version": "Версия Type-C",
  "Type D Version": "Версия Type-D",
  "Video Port": "Видеопорт",
  "WIFI Version": "Версия Wi-Fi",
  "Watches Connector Type": "Тип крепления часов",
  "Waterproof Level": "Уровень водозащиты",
};

function _dtTplT(key, vars) {
  const e = _DT_TPL_TEXT[key];
  let s = e ? (_isRu2() ? e.ru : e.en) : key;
  for (const k in vars || {}) s = s.split("{" + k + "}").join(String(vars[k]));
  return s;
}
function _dtTplReset() {
  _dtTplSlots = {};
  _dtTplGen++;
  clearTimeout(_dtTplTimer);
}
function _dtTplCat() {
  const k = _deviceKey2();
  return _DT_TPL_MAP && _DT_TPL_MAP[k] && _RESTORE_MAP[k] ? k : null;
}
function _dtTplSlot(cat) {
  const k = _dtTplGen + "|" + cat + "|" + _creatingNow();
  return _dtTplSlots[k] || (_dtTplSlots[k] = { choice: "", name: "", note: "", base: null });
}
function _dtTplSame(a, b) {
  if (typeof a === "number" || typeof b === "number") {
    const x = Number(a), y = Number(b);
    if (Number.isFinite(x) && Number.isFinite(y)) return x === y;
  }
  return String(a) === String(b);
}
function _dtTplValidName(v) {
  if ("string" != typeof v) return !1;
  const s = v.trim();
  return !!s && "---" !== s && "-1" !== s && "0" !== s && "Device Name" !== s && "Name" !== s;
}
// Queued devices of this category (newest first), as rows whose cells come
// from the stored values: R.gv cells are the globals AddToArray writes there,
// R.json cells the arrays it saves, in the game's own array JSON.
function _dtTplQueued(cat) {
  let list = [];
  try {
    const q = globalThis._dtQueueApi;
    list = q && "function" == typeof q.templates ? q.templates(cat) : [];
  } catch (e) {
    console.warn("[DeviceTemplate] queued devices unavailable:", e);
  }
  const R = _RESTORE_MAP[cat];
  return list.map((q) => {
    const json = {};
    for (const [n, d] of Object.entries(q.arrays)) {
      const data = [];
      for (let x = 0, i = 0; x < d.w; x++) {
        const col = [];
        for (let y = 0; y < d.h; y++) {
          const z = [];
          for (let k = 0; k < d.d; k++) z.push(d.cells[i++]);
          col.push(z);
        }
        data.push(col);
      }
      json[n] = JSON.stringify({ c2array: !0, size: [d.w, d.h, d.d], data });
    }
    const cell = (z) => (z in R.gv ? q.vars[R.gv[z]] : R.json && z in R.json ? json[R.json[z]] : void 0);
    const tier = _TIERS[q.k] || _TIERS[0];
    return {
      key: q.key,
      name: q.name,
      // Listed under "In the build queue", so the name alone (the queue's own label says "Queued: ...").
      label: q.count > 1 ? _dtTplT("version", { n: q.name, t: _t29(tier.textKey) }) : q.name,
      queued: true,
      src: { cell, lost: q.lost || [] },
    };
  });
}
// Past devices of this category, newest first, after the queued ones. During
// versions 2 and 3 the current batch sits at x=0, so it is skipped and
// positions stay stable.
function _dtTplRows(cat) {
  const R = _RESTORE_MAP[cat], a = _getArray24(R.arr), out = _dtTplQueued(cat);
  if (!a) return out;
  const s = _arrSize3(a), w = 0 | s[0], h = Math.min(3, 0 | s[1]), d = 0 | s[2];
  let maxZ = 0;
  for (const z of Object.keys(R.gv).concat(Object.keys(R.json || {}))) maxZ = Math.max(maxZ, Number(z));
  if (d <= maxZ) return out;
  const off = _batchPushed() ? 1 : 0;
  for (let x = off, n0 = out.length; x < w && out.length - n0 < 120; x++) {
    const found = [];
    for (let y = 0; y < h; y++) {
      let nm;
      try {
        nm = a.getAt(x, y, 8);
      } catch (e) {
        continue;
      }
      _dtTplValidName(nm) && found.push({ y, name: nm.trim() });
    }
    for (const f of found) {
      const tier = _TIERS[f.y] || _TIERS[0];
      out.push({
        key: x - off + ":" + f.y,
        x,
        y: f.y,
        name: f.name,
        label: found.length > 1 ? _dtTplT("version", { n: f.name, t: _t29(tier.textKey) }) : f.name,
      });
    }
  }
  return out;
}
function _dtTplCmp(a, op, b) {
  switch (op) {
    case 0: return a == b;
    case 1: return a != b;
    case 2: return a < b;
    case 3: return a <= b;
    case 4: return a > b;
    case 5: return a >= b;
  }
  return !0;
}
// Conditions on the path to a list SetVar. Opaque levels (Else, computed
// comparisons) are treated as possibly true.
function _dtTplHolds(when, gv) {
  for (const l of when || []) {
    if (!l.c.length) continue;
    const r = l.c.map((c) => _dtTplCmp(gv[c[0]], c[1], c[2]));
    if (l.or) {
      if (!l.opaque && !r.some(Boolean)) return !1;
    } else if (!r.every(Boolean)) return !1;
  }
  return !0;
}
function _dtTplColumn(name, col) {
  const t = _getArray24(name);
  if (!t) return null;
  const s = _arrSize3(t), w = 0 | s[0], h = 0 | s[1];
  if (col >= h) return [];
  const v = [];
  for (let i = 0; i < w; i++) v.push(t.getAt(i, col, 0));
  return v;
}
// 1-based position of the saved ID, else the next one up, else the closest below.
function _dtTplPick(col, target) {
  for (let i = 0; i < col.length; i++) if (_dtTplSame(col[i], target)) return { pos: i + 1, exact: !0 };
  const t = Number(target);
  if (!Number.isFinite(t)) return { pos: 0, exact: !1 };
  let up = -1, upV = Infinity, dn = -1, dnV = -Infinity;
  for (let i = 0; i < col.length; i++) {
    const n = Number(col[i]);
    if (!Number.isFinite(n)) continue;
    n > t && n < upV && ((up = i), (upV = n));
    n < t && n > dnV && ((dn = i), (dnV = n));
  }
  return { pos: up >= 0 ? up + 1 : dn >= 0 ? dn + 1 : 0, exact: !1 };
}
function _dtTplSetNum(gv, name, v) {
  "number" == typeof gv[name] && Number.isFinite(Number(v)) && (gv[name] = Number(v));
}
function _dtTplCall(rt, fn) {
  const r = rt.callFunction(fn);
  if (r && "function" == typeof r.then) throw new Error("async list function " + fn);
}
// Runs one list function until its selectors stop moving. Map IDs are reset
// to their saved values before each call, so any ID that differs afterwards
// was written by the function from the current selector.
function _dtTplGroup(rt, gv, g, T, info) {
  let moved = !1;
  for (let it = 0; it < 4; it++) {
    for (const [k, v] of g.ui) _dtTplSetNum(gv, k, v);
    for (const mp of g.maps) mp.id in T && _setGvTyped(mp.id, T[mp.id]);
    _dtTplCall(rt, g.fn);
    let changed = !1;
    const done = new Set();
    for (const mp of g.maps) {
      if (done.has(mp.id) || !(mp.id in T)) continue;
      if (_dtTplSame(gv[mp.id], T[mp.id])) {
        done.add(mp.id);
        continue;
      }
      const cands = g.maps.filter((m) => m.id === mp.id && _dtTplHolds(m.when, gv));
      info[mp.id] = "adjusted";
      if (!cands.length) continue;
      done.add(mp.id);
      const live =
        cands.find((m) => {
          const col = _dtTplColumn(m.temp, m.col), s = Number(gv[m.sel]);
          return col && s >= 1 && s <= col.length && _dtTplSame(col[s - 1], gv[m.id]);
        }) || cands[0];
      if (!live.drive) continue;
      const col = _dtTplColumn(live.temp, live.col);
      if (!col || !col.length) continue;
      const p = _dtTplPick(col, T[mp.id]);
      info[mp.id] = p.exact ? "exact" : p.pos ? "swap" : "missing";
      p.pos > 0 && Number(gv[live.sel]) !== p.pos && (_dtTplSetNum(gv, live.sel, p.pos), (changed = !0));
    }
    if (!changed) break;
    moved = !0;
  }
  return moved;
}
// Parent selectors whose own ID is never saved (OS vendor): try each option
// and keep the one that reproduces the most saved values.
function _dtTplFree(rt, gv, g, T) {
  for (const f of g.free) {
    if ("number" != typeof gv[f.sel]) continue;
    const start = gv[f.sel];
    _dtTplSetNum(gv, f.sel, 1);
    for (const [k, v] of g.ui) _dtTplSetNum(gv, k, v);
    _dtTplCall(rt, g.fn);
    const n = (_dtTplColumn(f.temp, 0) || []).length, cands = [];
    let ownOk = !1;
    if (f.own) {
      const o = _getArray24(f.own);
      try {
        ownOk = !!o && Number(o.getAt(0, 0)) > 0;
      } catch (e) {}
    }
    ownOk && cands.push(0);
    for (let i = 1; i <= Math.min(n, 60); i++) cands.push(i);
    let best = start, bestScore = -1;
    for (const c of cands) {
      _dtTplSetNum(gv, f.sel, c);
      _dtTplGroup(rt, gv, g, T, {});
      const marked = g.writes.filter((w) => w in T && ("number" == typeof gv[w] || "string" == typeof gv[w]));
      for (const w of marked) gv[w] = "number" == typeof gv[w] ? _DT_TPL_NUM_MARK : _DT_TPL_STR_MARK;
      _dtTplCall(rt, g.fn);
      let score = 0;
      for (const w of marked) _dtTplSame(gv[w], T[w]) && score++;
      for (const w of marked) _setGvTyped(w, T[w]);
      (score > bestScore || (score === bestScore && c === start)) && ((best = c), (bestScore = score));
    }
    _dtTplSetNum(gv, f.sel, cands.indexOf(best) >= 0 ? best : start);
  }
}
function _dtTplPaletteNames() {
  const out = [];
  for (let i = 1; i <= 5; i++)
    out.push("Red" + i, "Green" + i, "Blue" + i, "ColorCanvas" + i + "_X", "ColorCanvas" + i + "_Y", "ColorLine" + i + "_X");
  return out;
}
// The colour ChooseColor builds from whole hue degrees and 1% saturation and
// brightness steps, as 0-255 channels.
function _dtTplHsv(h, s, v) {
  const k = Math.floor(h / 60), f = h / 60 - k, S = s / 100, V = v / 100;
  const p = V * (1 - S), q = V * (1 - S * f), t = V * (1 - (1 - f) * S);
  const c = [[V, t, p], [q, V, p], [p, V, t], [p, q, V], [t, p, V], [V, p, q]][k] || [V, t, p];
  return c.map((x) => Math.round(255 * x));
}
// Picker steps that rebuild the colour exactly (else as closely as the picker
// allows). Ties keep the current hue, so a grey does not move the hue bar.
// Hue 360 is never used: ChooseColor has no case for it and keeps a stale colour.
function _dtTplHsvFor(rgb, h0) {
  const mx = Math.max(...rgb), mn = Math.min(...rgb);
  const v0 = Math.round((100 * mx) / 255), s0 = mx ? Math.round(100 * (1 - mn / mx)) : 0;
  let best = [h0, s0, v0], err = Infinity;
  for (let v = Math.max(0, v0 - 2); v <= Math.min(100, v0 + 2); v++)
    for (let s = Math.max(0, s0 - 2); s <= Math.min(100, s0 + 2); s++)
      for (let i = 0; i < 360 && err; i++) {
        const h = (h0 + i) % 360, c = _dtTplHsv(h, s, v);
        const e = Math.abs(c[0] - rgb[0]) + Math.abs(c[1] - rgb[1]) + Math.abs(c[2] - rgb[2]);
        e < err && ((err = e), (best = [h, s, v]));
      }
  return best;
}
// Picker position for palette colour i (1-5) that the colour page turns back
// into Red/Green/Blue i. `val` reads the copied value of a global.
function _dtTplPickerFor(val, cat, i) {
  const P = _DT_TPL_PICK, rgb = ["Red", "Green", "Blue"].map((c) => Number(val(c + i)));
  const lx = Number(val("ColorLine" + i + "_X"));
  if (!rgb.every(Number.isFinite)) return null;
  const lerp = (r, u) => r[0] + (r[1] - r[0]) * u;
  const h0 = Number.isFinite(lx) ? Math.min(359, Math.max(0, Math.round((360 * (lx - P.hue[0])) / (P.hue[1] - P.hue[0])))) : 0;
  const [h, s, v] = _dtTplHsvFor(rgb.map((c) => Math.min(255, Math.max(0, Math.round(c)))), h0);
  return {
    ["ColorLine" + i + "_X"]: lerp(P.hue, h / 360),
    ["ColorCanvas" + i + "_X"]: lerp(P.sx, s / 100),
    ["ColorCanvas" + i + "_Y"]: lerp(P.vy, v / 100) + (P.off[cat] || 0),
  };
}
// Everything a copy can change: saved fields, design, selectors, UI state and
// every global the list functions write (precomputed by gen_map.js).
function _dtTplTouch(cat) {
  const M = _DT_TPL_MAP[cat], R = _RESTORE_MAP[cat], D = _DESIGN_MAP[cat], s = new Set(M.touch || []);
  for (const n of Object.values(R.gv)) s.add(n);
  if (D) {
    for (const n of Object.values(D.gv)) s.add(n);
    for (const v of Object.values(D.on || {})) s.add(v[0]);
  }
  if (_DT_TPL_PALETTE[cat]) for (const n of _dtTplPaletteNames()) s.add(n);
  for (const l of M.linear) s.add(l.sel);
  for (const n of _DT_TPL_UI_KEEP) s.add(n);
  s.delete("class");
  s.delete("LastClass");
  return s;
}
// Reverts a copy without rolling back unrelated game state that may have
// moved on since the snapshot was taken.
function _dtTplRestore(cat, snap) {
  if (!snap || !snap.gv) return;
  for (const n of _dtTplTouch(cat)) n in snap.gv && _setGvTyped(n, snap.gv[n]);
  for (const [n, j] of Object.entries(snap.arrays || {})) _loadArrayFromJson(n, j);
}
function _dtTplLabel(id) {
  const en = id
    .replace(/_?ID$/, "")
    .replace(/_\d+(?=_|$)/g, "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return _isRu2() ? _DT_TPL_RU[en] || en : en;
}
function _dtTplList(ids) {
  const l = [...new Set(ids.map(_dtTplLabel))];
  return l.length > 4 ? _dtTplT("more", { l: l.slice(0, 4).join(", "), c: l.length - 4 }) : l.join(", ");
}
// Copies saved row (x, y), or a queued device when `src` is given.
function _dtTplApply(cat, x, y, src) {
  const rt = globalThis.runtime || null, M = _DT_TPL_MAP[cat], R = _RESTORE_MAP[cat], D = _DESIGN_MAP[cat];
  const a = _getArray24(R.arr);
  if (!rt || !rt.globalVars || !(a || src) || !M) return { ok: !1 };
  const cell = src ? src.cell : (z) => a.getAt(x, y, z);
  const gv = rt.globalVars, pre = _snapshotEditorState();
  if (!pre) return { ok: !1 };
  const keep = {};
  for (const k of _DT_TPL_UI_KEEP) ("number" != typeof gv[k] && "string" != typeof gv[k]) || (keep[k] = gv[k]);
  try {
    const T = {};
    const put = (name, v) => {
      if (_DT_TPL_SKIP.has(name) || _SNAP_DENY.has(name) || void 0 === v) return;
      const cur = gv[name];
      if ("number" == typeof cur) {
        const n = Number(v);
        if (null == v || "" === v || !Number.isFinite(n)) return;
        T[name] = n;
      } else "string" == typeof cur && (T[name] = null == v ? "" : String(v));
    };
    for (const [z, name] of Object.entries(R.gv)) put(name, cell(Number(z)));
    // Design cells override like the game's own version restore does.
    if (D) {
      let dz = null;
      for (const [z, n] of Object.entries(R.json || {})) n === D.arr && (dz = Number(z));
      const cells = null !== dz ? _designCells(cell(dz)) : null;
      if (cells) {
        for (const [i, n] of Object.entries(D.gv)) void 0 !== cells[Number(i)] && put(n, cells[Number(i)]);
        for (const [i, n] of Object.entries(D.on || {})) {
          const c = cells[Number(i)];
          if (void 0 === c) continue;
          const v = n[1][String(c)];
          void 0 !== v && put(n[0], v);
        }
        // Side buttons are a kind (cell 34) plus an on switch per kind (35
        // mechanical, 37 sensor). The map above lets 37 overwrite the kind, and a
        // kind switched off must copy as "none", or the editor turns it back on.
        const side = (D.on || {})[34];
        if (side && "CentralButton_AdditionallyButtonsType" === side[0] && void 0 !== cells[34]) {
          const k = Number(cells[34]);
          put(side[0], 1 === k && 1 === Number(cells[35]) ? 1 : 2 === k && 1 === Number(cells[37]) ? 2 : 0);
        }
        const pc = _DT_TPL_PALETTE[cat];
        if (pc) for (let i = 0; i < 5; i++) {
          const c = Number(cells[pc + i]);
          if (!Number.isFinite(c)) continue;
          put("Red" + (i + 1), c & 255);
          put("Green" + (i + 1), (c >> 8) & 255);
          put("Blue" + (i + 1), (c >> 16) & 255);
        }
        // Move each picker to its copied colour, or opening the colour page
        // would rebuild the colour from where the picker was left.
        if (pc) for (let i = 1; i <= 5; i++) {
          if (!("Red" + i in T)) continue;
          const pos = _dtTplPickerFor((n) => (n in T ? T[n] : gv[n]), cat, i);
          if (pos) for (const [n, v] of Object.entries(pos)) put(n, v);
        }
      }
    }
    const arrays = {};
    for (const [z, n] of Object.entries(R.json || {})) {
      const j = cell(Number(z));
      try {
        const o = "string" == typeof j ? JSON.parse(j) : j;
        o && Array.isArray(o.data) && (arrays[n] = j);
      } catch (e) {}
    }
    for (const [k, v] of Object.entries(T)) _setGvTyped(k, v);
    for (const [n, j] of Object.entries(arrays)) _loadArrayFromJson(n, j);
    for (const l of M.linear) l.id in T && _dtTplSetNum(gv, l.sel, T[l.id] - l.k);
    const info = {};
    for (const g of M.groups) g.free.length && _dtTplFree(rt, gv, g, T);
    for (let pass = 0; pass < 4; pass++) {
      let moved = !1;
      for (const g of M.groups) _dtTplGroup(rt, gv, g, T, info) && (moved = !0);
      if (!moved) break;
    }
    // Final pass leaves every function's derived values consistent.
    for (const g of M.groups) {
      for (const [k, v] of g.ui) _dtTplSetNum(gv, k, v);
      for (const mp of g.maps) mp.id in T && _setGvTyped(mp.id, T[mp.id]);
      _dtTplCall(rt, g.fn);
    }
    // List functions may resize the *_Choosen arrays; put the saved ones back.
    for (const [n, j] of Object.entries(arrays)) _loadArrayFromJson(n, j);
    const ids = new Set();
    for (const g of M.groups) for (const mp of g.maps) mp.id in T && ids.add(mp.id);
    // A queued part that is listed nowhere any more was not copied.
    const swapped = [], adjusted = [], missing = src ? src.lost.slice() : [];
    for (const id of ids) {
      if (_dtTplSame(gv[id], T[id])) continue;
      "missing" === info[id] ? missing.push(id) : "swap" === info[id] ? swapped.push(id) : adjusted.push(id);
    }
    const headphones = "ON" === String(cell(Number(Object.keys(R.gv).find((z) => "UseMyHeadphones" === R.gv[z]) ?? -1)));
    return { ok: !0, swapped, adjusted, missing, headphones, gamepad: "CONSOLE" === cat };
  } catch (e) {
    try {
      console.warn("[DeviceTemplate] copy failed, editor restored:", e);
    } catch (t) {}
    try {
      _applyEditorState(pre);
    } catch (t) {}
    return { ok: !1 };
  } finally {
    for (const [k, v] of Object.entries(keep)) _setGvTyped(k, v);
  }
}
function _dtTplMessage(name, r) {
  const parts = [_dtTplT("copied", { n: name })];
  r.swapped.length &&
    parts.push(
      1 === new Set(r.swapped.map(_dtTplLabel)).size
        ? _dtTplT("swapOne", { l: _dtTplList(r.swapped) })
        : _dtTplT("swapMany", { c: new Set(r.swapped.map(_dtTplLabel)).size, l: _dtTplList(r.swapped) }),
    );
  r.adjusted.length && parts.push(_dtTplT("adjusted", { l: _dtTplList(r.adjusted) }));
  r.missing.length && parts.push(_dtTplT("missing", { l: _dtTplList(r.missing) }));
  r.headphones && parts.push(_dtTplT("headphones"));
  r.gamepad && parts.push(_dtTplT("gamepad"));
  return parts.join(" ");
}
// Looks (as the game's own look copy defines them) before a change here, and a
// function that puts them back afterwards. null where the game has no look copy.
function _dtTplLooks() {
  let L = null;
  try {
    L = _lookSpec();
  } catch (e) {}
  if (!L) return null;
  const cap = _captureLook(L), rows = [];
  const d = "design" === L.mode ? _getArray24(L.design) : null;
  // The design array also holds non-look cells (camera, specs): keep only the look rows.
  if (d) {
    const h = 0 | _arrSize3(d)[1];
    for (const n of L.rows) n < h && rows.push([n, d.getAt(0, n)]);
  }
  "design" === L.mode && delete cap.arrays[L.design];
  return () => {
    for (const [k, v] of Object.entries(cap.gv)) _setGvTyped(k, v);
    for (const [n, j] of Object.entries(cap.arrays)) _loadArrayFromJson(n, j);
    const a = d && _getArray24(L.design);
    if (a) {
      const h = 0 | _arrSize3(a)[1];
      for (const [n, v] of rows) n < h && a.setAt(v, 0, n);
      // The game's Undo puts back the whole design array it saved; give it this
      // copy's non-look cells so undoing the looks keeps the copied specs.
      const b = _lookBackup && _lookBackup.arrays;
      if (b && b[L.design]) {
        try {
          const o = JSON.parse(b[L.design]);
          for (let n = 0; n < h; n++) L.rows.has(n) || !o.data[0] || !o.data[0][n] || (o.data[0][n][0] = a.getAt(0, n));
          b[L.design] = JSON.stringify(o);
        } catch (e) {}
      }
    }
    try {
      _recalcPrice(L);
    } catch (e) {}
  };
}
function _dtTplChoose(sel, note, cat) {
  if (_busy2) return void (sel.value = _dtTplSlot(cat).choice);
  if (sel.value === _dtTplSlot(cat).choice) return;
  const looks = _dtTplLooks();
  try {
    _dtTplChoose2(sel, note, cat);
  } finally {
    looks && looks();
  }
}
function _dtTplChoose2(sel, note, cat) {
  const slot = _dtTplSlot(cat), v = sel.value;
  const show = (s) => {
    slot.note = s;
    note.textContent = s;
    note.title = s;
  };
  if (!v) {
    _dtTplRestore(cat, slot.base);
    slot.choice = "";
    slot.name = "";
    return void show(_dtTplT("reset"));
  }
  const row = _dtTplRows(cat).find((r) => r.key === v);
  if (!row) return void (sel.value = slot.choice);
  if (!slot.base && !(slot.base = _snapshotEditorState())) return void (sel.value = slot.choice);
  // Each copy starts from the editor state this version began with.
  slot.choice && _dtTplRestore(cat, slot.base);
  const r = _dtTplApply(cat, row.x, row.y, row.src);
  if (r.ok) {
    slot.choice = v;
    slot.name = row.name;
    show(_dtTplMessage(row.label, r));
  } else {
    slot.choice && _dtTplRestore(cat, slot.base);
    slot.choice = "";
    slot.name = "";
    sel.value = "";
    show(_dtTplT("failed", { n: row.label }));
  }
}
// Game update 1.6 put its own look row on this panel, so this block stays compact to keep the
// panel inside the screen: one line of note (the full text is its tooltip), none while empty.
function _dtTplCss() {
  if (document.getElementById("dt-template-css")) return;
  const s = document.createElement("style");
  s.id = "dt-template-css";
  s.textContent = `
.dn-tpl { width: 100%; display: flex; flex-direction: column; gap: 0; flex: 0 0 auto;
  animation: dn-field-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.14s backwards; }
.dn-tpl-row { display: flex; align-items: center; gap: calc(var(--dn) * 14px); width: 100%; }
.dn-tpl-label { flex: 0 0 auto; font-family: "SofiaSansExtraCondensed-Bold", "Oswald", sans-serif;
  font-size: calc(var(--dn) * 19px); letter-spacing: calc(var(--dn) * 1px); color: rgba(255, 255, 255, 0.72); }
.dn-tpl-wrap { position: relative; flex: 1 1 auto; min-width: 0; }
#dn-root .dn-tpl-select { -webkit-appearance: none; appearance: none; display: block; width: 100%; margin: 0;
  height: calc(var(--dn) * 34px); padding: 0 calc(var(--dn) * 46px) 0 calc(var(--dn) * 18px);
  border: 0; border-radius: calc(var(--dn) * 12px); outline: 0; cursor: pointer;
  font-family: "SofiaSansExtraCondensed-Light", "Oswald", sans-serif; font-size: calc(var(--dn) * 20px);
  letter-spacing: calc(var(--dn) * 0.6px); color: #ffffff; text-overflow: ellipsis; white-space: nowrap;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.26) 100%);
  box-shadow: inset 0 calc(var(--dn) * 2px) calc(var(--dn) * 6px) rgba(0, 0, 0, 0.55), inset 0 0 0 calc(var(--dn) * 1px) rgba(255, 255, 255, 0.12);
  touch-action: manipulation; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
#dn-root .dn-tpl-select:hover { box-shadow: inset 0 calc(var(--dn) * 2px) calc(var(--dn) * 6px) rgba(0, 0, 0, 0.55), inset 0 0 0 calc(var(--dn) * 1px) var(--line); }
#dn-root .dn-tpl-select:focus-visible { box-shadow: inset 0 0 0 calc(var(--dn) * 2px) var(--line), 0 0 calc(var(--dn) * 14px) var(--aura); }
#dn-root .dn-tpl-select option { color: #ffffff; background: #141a26; }
#dn-root .dn-tpl-select optgroup { color: rgba(255, 255, 255, 0.55); background: #141a26; font-style: normal; }
.dn-tpl-caret { position: absolute; top: 50%; right: calc(var(--dn) * 18px); width: calc(var(--dn) * 11px); height: calc(var(--dn) * 11px);
  margin-top: calc(var(--dn) * -8px); border-right: calc(var(--dn) * 2px) solid var(--m1); border-bottom: calc(var(--dn) * 2px) solid var(--m1);
  transform: rotate(45deg); pointer-events: none; }
.dn-tpl-note { overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  padding: 0 calc(var(--dn) * 24px); box-sizing: border-box;
  font-size: calc(var(--dn) * 19px); line-height: calc(var(--dn) * 20px); color: rgba(255, 255, 255, 0.78); text-align: center; }
.dn-tpl-note:empty { display: none; }
`;
  document.head.appendChild(s);
}
// The picked template is gone or renamed since (queue replayed, device deleted): the
// editor goes back to the design this version began with, as picking "New design" does.
function _dtTplForget(cat, rows) {
  const slot = _dtTplSlot(cat);
  if (!slot.choice) return false;
  const cur = rows.find((r) => r.key === slot.choice);
  if (cur && cur.name === slot.name) return false;
  if (slot.base) {
    const looks = _dtTplLooks();
    _dtTplRestore(cat, slot.base);
    looks && looks();
  }
  slot.choice = "";
  slot.name = "";
  slot.note = slot.base ? _dtTplT("reset") : "";
  return true;
}
// Called from the name screen after the hint line (multi-version devices only).
function _dtTplMount(face, hint) {
  const cat = _dtTplCat();
  if (!cat || !face || !hint) return;
  const rows = _dtTplRows(cat);
  if (!rows.length) return;
  _dtTplCss();
  const slot = _dtTplSlot(cat);
  const box = _el8("div", "dn-tpl", face),
    line = _el8("div", "dn-tpl-row", box),
    lab = _el8("label", "dn-tpl-label", line),
    wrap = _el8("div", "dn-tpl-wrap", line),
    sel = _el8("select", "dn-tpl-select", wrap);
  sel.id = "dn-tpl-select";
  lab.htmlFor = "dn-tpl-select";
  lab.textContent = _dtTplT("label");
  const add = (value, text) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = text;
    sel.appendChild(o);
  };
  add("", _dtTplT("fresh"));
  // Queued devices and released ones in their own groups.
  let group = null, inQ = null;
  for (const r of rows) {
    if (group === null || inQ !== !!r.queued) {
      inQ = !!r.queued;
      group = document.createElement("optgroup");
      group.label = _dtTplT(inQ ? "inQueue" : "released");
      sel.appendChild(group);
    }
    const o = document.createElement("option");
    o.value = r.key;
    o.textContent = r.label;
    group.appendChild(o);
  }
  _el8("div", "dn-tpl-caret", wrap);
  const note = _el8("div", "dn-tpl-note", box);
  note.setAttribute("role", "status");
  note.setAttribute("aria-live", "polite");
  // Positions can shift if the device list changed; never show a stale pick.
  _dtTplForget(cat, rows);
  sel.value = slot.choice;
  note.textContent = slot.note;
  note.title = slot.note;
  sel.addEventListener("change", () => {
    clearTimeout(_dtTplTimer);
    const g = _dtTplGen;
    _dtTplTimer = setTimeout(() => {
      g === _dtTplGen && sel.isConnected && _dtTplChoose(sel, note, cat);
    }, 150);
  });
  sel.addEventListener("pointerdown", () => {
    try {
      globalThis.tapMain?.();
    } catch (e) {}
  });
  sel.addEventListener("keydown", (e) => e.stopPropagation());
}
