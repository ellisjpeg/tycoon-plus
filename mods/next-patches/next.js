// ── "Coming next" hint under the design page selectors ──
// Under a list selector whose right arrow is stopped because the next part is
// not out yet, one small line says what comes next and when:
// "Next: 90 Hz, May 2019", or "Next: 90 Hz, needs research" when the part is
// out but the selector's research tier stops the arrow. Everything is read
// from the game's live arrays, so it follows the preset's dates (real.js).
// The map (gen_next.js, built from the event sheets) gives each selector its
// source list, date column, label formula, text and arrow UIDs and research
// slot; a selector the generator could not read exactly has no hint.
var _DT_NEXT_MAP = __DT_NEXT_MAP__;
var _DT_NEXT = {
  MONTHS: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  MONTHS_RU: ["янв.", "февр.", "март", "апр.", "май", "июнь", "июль", "авг.", "сент.", "окт.", "нояб.", "дек."],
  TEXT: {
    next: { en: "Next: {l}, {w}", ru: "Далее: {l}, {w}" },
    research: { en: "needs research", ru: "нужно исследование" },
  },
  DAYS: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
  GAP: 1, // layout px between the selector panel and the line (its own leading adds a few more)
  SIDE: 16, // layout px between the right arrow and the line when it sits beside it
  PICK_MS: 250, // how often the lists are re-read; positions follow every frame
  // Instances the line must not touch (the page's own labels, values and arrows).
  SOLID: ["Text", "SVG"],
};
var _dtNext = { notes: new Map(), wired: false, last: 0, list: null, layers: new WeakSet(), canvas: "" };

// Game day (1 = 1 Jan 2008, 365-day years) -> "May 2019".
function _dtNextMonth(day) {
  const d = Math.max(0, Math.floor(Number(day)) - 1);
  let doy = d % 365;
  let m = 0;
  while (m < 11 && doy >= _DT_NEXT.DAYS[m]) doy -= _DT_NEXT.DAYS[m++];
  return (_dtNextRu() ? _DT_NEXT.MONTHS_RU : _DT_NEXT.MONTHS)[m] + " " + (2008 + Math.floor(d / 365));
}
// The game in Russian (LanguageChoose 1), as the other mods read it.
function _dtNextRu() {
  try { return typeof _dtUi.ru === "function" && !!_dtUi.ru(); } catch (e) { return false; }
}
// The game's string + number join (HB): numbers rounded to 10 decimals.
function _dtNextStr(v) {
  return typeof v === "number" ? (Math.round(1e10 * v) / 1e10).toString() : String(v);
}
// What the right arrow would show next, the game's way:
// - the arrow needs sel < Temp size and (with a research slot) ID < cap;
// - Temp holds the first `count` source rows, count = rows whose date <= today,
//   skipping rows whose name is 0, so the row that appears next is the first
//   named row at index >= count, on the day count reaches past it.
// src: {width, at(x, y)}; o: {today, sel, ids (source row per Temp slot), id,
// cap (null = no research gate), date, name}.
// Returns {row, day} | {row, research: true} | null.
function _dtNextPick(src, o) {
  const atEnd = o.sel >= o.ids.length;
  const blocked = o.cap !== null && o.cap !== undefined && o.id >= o.cap;
  if (!atEnd) return blocked ? { row: o.ids[o.sel], research: true } : null;
  let count = 0;
  const future = [];
  for (let x = 0; x < src.width; x++) {
    const v = Number(src.at(x, o.date));
    if (v <= o.today) count++;
    else future.push(v);
  }
  future.sort((a, b) => a - b);
  for (let k = count; k < src.width && k - count < future.length; k++) {
    const n = src.at(k, o.name);
    if (n === 0 || n === "0" || n === "") continue;
    return { row: k, day: future[k - count] };
  }
  return null;
}
// lang: the option's name cell is a key into ArrayLanguage (column = LanguageChoose).
function _dtNextText(e, src, pick, lang) {
  if (!pick) return "";
  let v = src.at(pick.row, e.name);
  if (e.lang) {
    if (!lang) return "";
    v = lang.at(lang.choose, Number(v));
    if (v === undefined || v === null || v === "" || v === 0) return "";
  }
  const label = e.pre + _dtNextStr(v) + e.suf;
  const T = _DT_NEXT.TEXT, ru = _dtNextRu();
  const when = pick.research ? (ru ? T.research.ru : T.research.en) : _dtNextMonth(pick.day);
  return (ru ? T.next.ru : T.next.en).replace("{l}", label).replace("{w}", when);
}
function _dtNextArr(name) {
  const o = globalThis.runtime.objects[name];
  const a = o && o.getFirstInstance();
  return a ? { width: a.width, at: (x, y) => a.getAt(x, y) } : null;
}
function _dtNextShown(inst) {
  if (!inst || !inst.isVisible || !(inst.opacity > 0) || !inst.layer || !inst.layer.isVisible) return false;
  try {
    return inst.layer.opacity > 0;
  } catch (err) {
    return true;
  }
}
// The selectors on the current page whose next option is not offered yet.
function _dtNextFind() {
  const rt = globalThis.runtime;
  const out = [];
  const note = String(_dtUi.gv("EditorNotification", "OFF"));
  if (note !== "OFF" || _dtUi.isOpen()) return out;
  // A screen without any of the selectors (UIDs exist only on their own layout)
  // is not searched again until the next layout.
  const lay = typeof _dtUi.layoutName === "function" ? _dtUi.layoutName() : "";
  if (lay && _dtNext.none === lay) return out;
  let any = false;
  const today = _dtUi.num("DayTotal", 0);
  const res = _dtNextArr("ArrayMyResearch");
  const lang = _dtNextArr("ArrayLanguage");
  if (lang) lang.choose = _dtUi.num("LanguageChoose", 0);
  for (const cat in _DT_NEXT_MAP) {
    for (const e of _DT_NEXT_MAP[cat]) {
      const text = rt.getInstanceByUid(e.text);
      if (text) any = true;
      const right = rt.getInstanceByUid(e.right);
      if (!_dtNextShown(text) || !_dtNextShown(right)) continue;
      const src = _dtNextArr(e.src);
      const temp = _dtNextArr(e.temp);
      if (!src || !temp || !(temp.width > 0)) continue;
      const sel = _dtUi.num(e.sel, 0);
      const id = _dtUi.num(e.id, -1);
      const ids = [];
      const col = e.col === undefined ? 1 : e.col; // Temp column holding the source row
      for (let x = 0; x < temp.width; x++) ids.push(Number(temp.at(x, col)));
      if (sel < 1 || ids[sel - 1] !== id) continue; // the page has not settled
      const cap = e.res === null || !res ? null : Number(res.at(e.res, 0)) - 1;
      const pick = _dtNextPick(src, { today, sel, ids, id, cap, date: e.date, name: e.name });
      const s = _dtNextText(e, src, pick, lang);
      if (s) out.push({ e, s, text, right, left: e.left === null ? null : rt.getInstanceByUid(e.left) });
    }
  }
  if (!any && lay) _dtNext.none = lay;
  return out;
}
function _dtNextBox(i) {
  const b = i.getBoundingBox();
  return { l: b.left, t: b.top, r: b.right, b: b.bottom };
}
// A Text's visible line: its words are drawn from the top of its box, which is
// often much taller than the text (headings: box 76, text 41 layout px).
function _dtNextLine(i) {
  const b = _dtNextBox(i);
  const h = Number(i.textHeight);
  if (h > 0 && h < b.b - b.t) b.b = b.t + h;
  return b;
}
function _dtNextHits(a, b) {
  return a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
}
// The selector's panel (the rounded box behind its arrows and value): the smallest
// shown non-Text/SVG instance on the value's layer whose box holds the value's centre
// x at the right arrow's centre y (the value's own box can reach below the panel)
// and is no more than twice the selector's size. null when there is none.
function _dtNextPanel(f, boxes) {
  const rt = globalThis.runtime;
  const x = (boxes[0].l + boxes[0].r) / 2;
  const y = (boxes[1].t + boxes[1].b) / 2;
  const l = Math.min(...boxes.map((b) => b.l));
  const r = Math.max(...boxes.map((b) => b.r));
  const h = Math.max(...boxes.map((b) => b.b - b.t));
  let best = null;
  for (const name in rt.objects) {
    if (_DT_NEXT.SOLID.includes(name)) continue;
    const o = rt.objects[name];
    if (!o || typeof o.instances !== "function") continue;
    for (const i of o.instances()) {
      if (i.layer !== f.text.layer || typeof i.getBoundingBox !== "function" || !_dtNextShown(i)) continue;
      const b = _dtNextBox(i);
      if (!(b.l <= x && x <= b.r && b.t <= y && y <= b.b)) continue;
      if (b.r - b.l > 2 * (r - l) || b.b - b.t > 2 * h) continue;
      const a = (b.r - b.l) * (b.b - b.t);
      if (!best || a < best.a) best = { i, b, a, name };
    }
  }
  return best;
}
// Centred under the selector (between its arrows), in layout units; null when
// something of the page's own is in the way or it would leave the screen.
// The line starts under the panel, not under the value Text's box: that box is
// taller than its text and reaches past the panel.
function _dtNextPlace(f, el, taken) {
  const rt = globalThis.runtime;
  const parts = [f.text, f.right].concat(f.left && _dtNextShown(f.left) ? [f.left] : []);
  const boxes = parts.map(_dtNextBox);
  const sides = f.left && _dtNextShown(f.left) ? [_dtNextBox(f.left), boxes[1]] : [boxes[0], boxes[0]];
  const cx = (sides[0].l + sides[0].r + sides[1].l + sides[1].r) / 4;
  const panel = _dtNextPanel(f, boxes);
  const top = (panel ? panel.b.b : Math.max(_dtNextLine(f.text).b, ...boxes.slice(1).map((b) => b.b))) + _DT_NEXT.GAP;
  if (panel) parts.push(panel.i);
  const ly = f.text.layer;
  const [x0, y0] = ly.layerToCssPx(0, 0);
  const [x1, y1] = ly.layerToCssPx(100, 100);
  const sx = (x1 - x0) / 100;
  const sy = (y1 - y0) / 100;
  if (!(sx > 0) || !(sy > 0)) return null;
  const w = el.offsetWidth / sx;
  const h = el.offsetHeight / sy;
  const free = (box) => {
    for (const t of taken) if (_dtNextHits(box, t)) return false;
    // The page's labels, values, arrows and headings, plus the other selectors' panels.
    for (const name of panel ? _DT_NEXT.SOLID.concat([panel.name]) : _DT_NEXT.SOLID) {
      const o = rt.objects[name];
      if (!o) continue;
      for (const i of o.instances()) {
        if (parts.includes(i) || !_dtNextShown(i)) continue;
        const b = name === "Text" ? _dtNextLine(i) : _dtNextBox(i);
        // Another panel, not a page-sized background of the same type.
        if (name === (panel && panel.name) && (b.r - b.l > 2 * (panel.b.r - panel.b.l) || b.b - b.t > 2 * (panel.b.b - panel.b.t))) continue;
        if (_dtNextHits(box, b)) return false;
      }
    }
    return true;
  };
  const box = { l: cx - w / 2, t: top, r: cx + w / 2, b: top + h };
  if (free(box)) return { cx, top, box };
  // One-column pages (TV, scooter, keyboard, console, VR, gamepad) put the next heading right under
  // each selector: there the line goes beside the right arrow, level with the value, if that is free.
  if (f.e.col !== 0) return null;
  const r = boxes[1];
  const sl = r.r + _DT_NEXT.SIDE;
  const st = (boxes[0].t + boxes[0].b) / 2 - h / 2;
  const side = { l: sl, t: st, r: sl + w, b: st + h };
  return free(side) ? { cx: sl + w / 2, top: st, box: side } : null;
}
function _dtNextStyle(el) {
  Object.assign(el.style, {
    position: "absolute", transform: "translate(-50%, 0)", whiteSpace: "nowrap",
    fontFamily: '"SofiaSansExtraCondensed-Regular", "Oswald", sans-serif',
    fontSize: "calc(var(--dt) * 22px)", lineHeight: "1", color: "rgba(255, 255, 255, 0.6)",
    pointerEvents: "none", left: "0px", top: "0px", visibility: "hidden",
  });
}
function _dtNextHideAll() {
  _dtNext.none = null;
  for (const n of _dtNext.notes.values()) n.el.remove();
  _dtNext.notes.clear();
  _dtNext.list = null;
}
// Re-read the lists every PICK_MS (and right after a resize) and place the notes.
function _dtNextTick() {
  try {
    const now = Date.now();
    if (!_dtNext.list || now - _dtNext.last >= _DT_NEXT.PICK_MS) {
      _dtNext.last = now;
      const found = _dtNextFind();
      _dtNext.list = found;
      const keep = new Set(found.map((f) => f.e.text));
      for (const [k, n] of _dtNext.notes) if (!keep.has(k)) { n.el.remove(); _dtNext.notes.delete(k); }
      if (!found.length) return;
      const layer = _dtUi.ensure();
      const taken = [];
      for (const f of found) {
        let n = _dtNext.notes.get(f.e.text);
        if (!n || !n.el.isConnected) {
          n = { el: _dtUi.el("div", "dt-next-hint", layer) };
          _dtNextStyle(n.el);
          _dtNext.notes.set(f.e.text, n);
        }
        if (n.el.textContent !== f.s) n.el.textContent = f.s;
        n.f = f;
        n.at = _dtNextPlace(f, n.el, taken);
        if (n.at) taken.push(n.at.box);
        // Follow again right after the selector's layer is drawn, so the line
        // moves in the same frame as a scroll instead of one frame behind.
        const ly = f.text.layer;
        if (!_dtNext.layers.has(ly) && typeof ly.addEventListener === "function") {
          _dtNext.layers.add(ly);
          ly.addEventListener("afterdraw", _dtNextFollow);
        }
      }
    }
  } catch (err) {
    console.warn("[Next] tick:", err);
  }
  _dtNextFollow();
}
// Keep each note on its selector (scroll, resize); hidden when off the canvas.
// Runs every frame (and after the selector's layer draws): the canvas and layer
// rects are read once a frame, a note's height once per size, and a note's
// style is only written when its place or visibility changed.
function _dtNextFollow() {
  try {
    if (!_dtNext.notes.size) return;
    const rt = globalThis.runtime;
    const tick = rt ? rt.tickCount : undefined;
    if (!_dtNext.rect || typeof tick !== "number" || _dtNext.rectTick !== tick) {
      const c = document.querySelector("canvas").getBoundingClientRect();
      const key = [c.left, c.top, c.width, c.height].join(",");
      if (key !== _dtNext.canvas) {
        // The mods layer and the font size follow the canvas; re-place on the new size.
        _dtNext.canvas = key;
        _dtUi.fit();
        _dtNext.list = null;
        _dtNext.layerRect = _dtUi.ensure().getBoundingClientRect();
        for (const n of _dtNext.notes.values()) n.h = undefined;
      }
      _dtNext.rect = c;
      _dtNext.rectTick = tick;
    }
    const c = _dtNext.rect;
    const l = _dtNext.layerRect || (_dtNext.layerRect = _dtUi.ensure().getBoundingClientRect());
    for (const n of _dtNext.notes.values()) {
      const ok = n.at && _dtNextShown(n.f.text);
      let left = n.left, top = n.top, vis = "hidden";
      if (ok) {
        // layerToCssPx is already page (client) px, letterbox margin included: adding the
        // canvas offset again pushed the line down on non-16:9 windows (16:10 screens, for example).
        const [px, py] = n.f.text.layer.layerToCssPx(n.at.cx, n.at.top);
        if (n.h === undefined || n.hText !== n.el.textContent) {
          n.h = n.el.offsetHeight;
          n.hText = n.el.textContent;
        }
        const inside = px >= c.left && px <= c.right && py >= c.top && py + n.h <= c.bottom;
        left = Math.round(px - l.left) + "px";
        top = Math.round(py - l.top) + "px";
        vis = inside ? "visible" : "hidden";
      }
      if (left !== n.left) n.el.style.left = n.left = left;
      if (top !== n.top) n.el.style.top = n.top = top;
      if (vis !== n.vis) n.el.style.visibility = n.vis = vis;
    }
  } catch (err) {
    console.warn("[Next] follow:", err);
  }
}
function _dtNextWire() {
  const rt = globalThis.runtime;
  if (_dtNext.wired || !rt || typeof rt.addEventListener !== "function") return;
  _dtNext.wired = true;
  rt.addEventListener("tick", _dtNextTick);
  rt.addEventListener("beforeanylayoutend", _dtNextHideAll);
}
globalThis._dtNextApi = { month: _dtNextMonth, pick: _dtNextPick, text: _dtNextText, str: _dtNextStr, find: _dtNextFind, tick: _dtNextTick, hide: _dtNextHideAll, notes: _dtNext.notes, map: _DT_NEXT_MAP };
// The shared mod timer (ui.js every) when ui.js is in; a timer of our own without it.
(typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(_dtNextWire, 250);
