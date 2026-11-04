// ── Rooms: the game's create picker on the work-room screens ──
// The game's device-type picker (276 GAMEPLAY, Function CreateDevices) only exists on the BOSS OFFICE
// layout: its tiles are placed there and every event picks them by UID. The centre + in a work room
// (the live one while busy, or one only viewed) opened it by taking the player to the boss office.
// This draws the same picker over the room on screen instead: the game's own tile art (cut at runtime
// from the player's sprite sheets; positions, sizes and frames are read from the player's data.json at
// install, _DTK_ART), the same order, timings, eases, locked tiles and hover, the game's own centre
// button turned into its orange close cross, and the game's pause mark on the date. A pick does what the
// tile's click event does (Tap_Main, DeviceType, the black cover, LastClass/class, GoToLayout), so the
// create screens, the queue (busy) and the pipeline carry on exactly as from the boss office.
// CreateDevicesUI is WAIT/ON while it is up, as with the game's: the day stops and the HUD steps back. The
// room's work stops with the day (GameplayPause, _dtkHold).
var _DTK_ART = null; // replaced at install (prepare.py)
// Tiles in the game's open order: [hit Sprite20, circle SVG, shadow Sprite16, icon, kind, rule, delay s].
// rule [day, research column(, day for the hit)]: open from that DayTotal once ArrayMyResearch(col, 0) >= 2;
// before that the tile is shown faded and takes no press (CreateDevices_ON).
var _DTK_TILES = [
  [382, 351, 361, 20232, "SMARTPHONE", null, 0],
  [383, 352, 362, 20229, "LAPTOP", null, 0.05],
  [384, 353, 363, 20230, "TABLET", [724, 619], 0.075],
  [385, 354, 364, 20233, "WATCHES", [2549, 620], 0.1],
  [386, 355, 7347, 20234, "HEADPHONES", [2550, 621], 0.125],
  [387, 356, 366, 20235, "TV", null, 0.15],
  [7340, 7338, 7337, 20236, "SCOOTER", [2551, 622, 2550], 0.175],
  [7344, 7343, 7342, 20237, "KEYBOARD", [2184, 623], 0.2],
  [13431, 13429, 13428, 13469, "CONSOLE", null, 0.225],
  [13472, 13470, 13430, 13471, "VR", [2914, 624], 0.25],
  [388, 357, 367, 20240, "CPU", [0, 167], 0.275],
  [390, 359, 369, 20241, "GPU", [0, 217], 0.3],
  [391, 360, 370, 20242, "OS", [0, 173], 0.325],
  [389, 358, 368, 20243, "SOFT", null, 0.35],
];
// What each tile's click sets and where it goes (BOSS OFFICE UI [Engine]): [DeviceType, class, layout].
var _DTK_GO = {
  SMARTPHONE: ["SMARTPHONE", "SMARTPHONE NAME", "SMARTPHONE NAME"], LAPTOP: ["LAPTOP", "LAPTOP NAME", "LAPTOP NAME"],
  TABLET: ["TABLET", "TABLET NAME", "TABLET NAME"], WATCHES: ["WATCHES", "WATCHES NAME", "WATCHES NAME"],
  HEADPHONES: ["HEADPHONES", "HEADPHONES NAME", "HEADPHONES NAME"], TV: ["TV", "TV NAME", "TV NAME"],
  SCOOTER: ["SCOOTER", "SCOOTER NAME", "SCOOTER NAME"], KEYBOARD: ["KEYBOARD", "KEYBOARD NAME", "KEYBOARD NAME"],
  CONSOLE: ["CONSOLE", "CONSOLE NAME", "CONSOLES NAME"], VR: ["VR", "VR NAME", "VR NAME"],
  CPU: [null, "CPU EDITOR MENU", "CPU EDITOR MENU"], GPU: [null, "MY GPU MENU", "GPU EDITOR MENU"],
  OS: [null, "MY OS MENU", "MY OS MENU"], SOFT: [null, "MY SOFT MENU", "MY SOFT MENU"],
};
// The centre button's parts (UIDs on every office layout) and the cross they become (CreateDevices_ON).
var _DTK_CENTRE = { circle: 7335, ring: 20228, icon: 20223, glow: 7336, hit: 7345 };
var _DTK_ORANGE = [1, 0xb5 / 255, 1 / 255]; // the game's 112127
// Eases of the game's tweens: [18,1] linear, [18,9] out-back, [18,30] out-expo.
var _DTK_EASE = {
  linear: (k) => k,
  back: (k) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
  expo: (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
};
var _dtk = null; // the open picker
var _dtkArt = null; // art cut from the sheets, once
var _dtkArtLoading = null;
var _dtkWired = false;

function _dtkGv() {
  const rt = globalThis.runtime;
  return rt && rt.globalVars ? rt.globalVars : null;
}
// One frame of a sprite as a canvas: [sheet url, x, y, w, h, turned]. Sheets store some frames turned a
// quarter clockwise; they are turned back.
function _dtkCut(img, f) {
  const c = document.createElement("canvas");
  c.width = f[3];
  c.height = f[4];
  const g = c.getContext("2d");
  if (f[5]) {
    g.translate(0, f[4]);
    g.rotate(-Math.PI / 2);
    g.drawImage(img, f[1], f[2], f[4], f[3], 0, 0, f[4], f[3]);
  } else g.drawImage(img, f[1], f[2], f[3], f[4], 0, 0, f[3], f[4]);
  return c;
}
async function _dtkFileUrl(u) {
  try {
    const a = globalThis.runtime.assets;
    if (a && a.getProjectFileUrl) return await a.getProjectFileUrl(u);
  } catch (e) {}
  return u;
}
function _dtkLoadImg(url) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("image " + url));
    i.src = url;
  });
}
function _dtkPixel(c) {
  const d = c.getContext("2d").getImageData(c.width >> 1, c.height >> 1, 1, 1).data;
  return "rgb(" + d[0] + "," + d[1] + "," + d[2] + ")";
}
// Loads the tile art once (a few small sheets the game already ships); the picker uses the boss office
// until it is in.
function _dtkLoadArt() {
  if (_dtkArt || _dtkArtLoading || !_DTK_ART || typeof document === "undefined") return _dtkArtLoading;
  _dtkArtLoading = (async () => {
    const sheets = {}, frame = async (name) => {
      const f = _DTK_ART.frames[name];
      if (!f) throw new Error("no frame " + name);
      if (!sheets[f[0]]) sheets[f[0]] = _dtkLoadImg(await _dtkFileUrl(f[0]));
      return _dtkCut(await sheets[f[0]], f);
    };
    const art = { icons: {} };
    art.shadow = (await frame("Sprite16")).toDataURL();
    // The icon tint (Sprite20 over each icon) and the hover tint (Sprite12 over the circle): one colour each.
    art.tint = _dtkPixel(await frame("Sprite20"));
    art.hover = _dtkPixel(await frame("Sprite12"));
    for (const t of _DTK_TILES) {
      const ic = _DTK_ART.inst[t[3]];
      art.icons[t[3]] = (await frame(ic[4])).toDataURL();
    }
    art.circle = await _dtkFileUrl(_DTK_ART.inst[_DTK_TILES[0][1]][5] || "SVG FILES/Circle.svg");
    _dtkArt = art;
    return art;
  })().catch((e) => {
    console.warn("[Rooms] picker art:", e);
    _dtkArtLoading = null;
    _DTK_ART = null; // stay on the boss office picker
  });
  return _dtkArtLoading;
}
// The tile state the game gives it when opening (CreateDevices_ON).
function _dtkOpenTile(t, gv) {
  const r = t[5];
  if (!r) return { on: true, hit: true };
  const rt = globalThis.runtime;
  let res = 0;
  try {
    res = Number(rt.objects.ArrayMyResearch.getFirstInstance().getAt(r[1], 0, 0)) || 0;
  } catch (e) {}
  const day = Number(gv.DayTotal) || 0;
  return { on: day >= r[0] && res >= 2, hit: day >= (r[2] !== undefined ? r[2] : r[0]) && res >= 2 };
}
function _dtkCss() {
  if (document.getElementById("dt-pick-css")) return;
  const st = document.createElement("style");
  st.id = "dt-pick-css";
  // Everything in 1920x1080 game units times --dt, like the mod layer. Masks recolour the game's
  // white art the way its tinted sprites do.
  st.textContent = `
.dt-pick { position: fixed; pointer-events: none; overflow: hidden; --dt: 1; }
.dt-pick-cover { position: absolute; inset: 0; background: #000; opacity: 0; }
.dt-pick-blur { position: absolute; opacity: 0; }
.dt-pick-tile { position: absolute; width: 0; height: 0; }
.dt-pick-tile > * { position: absolute; left: 0; top: 0; }
html.dt-pick-hold #gameplay-pause-ind { display: none !important; }
.dt-pick-m { -webkit-mask-size: 100% 100%; mask-size: 100% 100%; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; }
`;
  document.head.appendChild(st);
}
function _dtkEl(cls, parent) {
  const n = document.createElement("div");
  n.className = cls;
  if (parent) parent.appendChild(n);
  return n;
}
function _dtkMask(n, url) {
  n.classList.add("dt-pick-m");
  n.style.webkitMaskImage = n.style.maskImage = 'url("' + url + '")';
}
// Size and place a part around its centre in game units.
function _dtkBox(n, w, h) {
  n.style.width = "calc(var(--dt) * " + w + "px)";
  n.style.height = "calc(var(--dt) * " + h + "px)";
  n.style.marginLeft = "calc(var(--dt) * " + -w / 2 + "px)";
  n.style.marginTop = "calc(var(--dt) * " + -h / 2 + "px)";
}
// Tween like the game's Tween behaviour, frame by frame: fn(k) gets the eased 0..1.
function _dtkTween(sec, ease, fn, done, delay) {
  const start = performance.now() + (delay || 0) * 1000;
  const ms = Math.max(1, sec * 1000);
  const tw = { stop: false };
  const step = (now) => {
    if (tw.stop) return;
    if (now < start) return requestAnimationFrame(step);
    const k = Math.min(1, (now - start) / ms);
    try {
      fn(_DTK_EASE[ease](k));
    } catch (e) {}
    if (k < 1) requestAnimationFrame(step);
    else if (done) done();
  };
  requestAnimationFrame(step);
  return tw;
}
function _dtkPlace(root) {
  try {
    const L = _dtUi.ensure();
    if (_dtUi.fit) _dtUi.fit();
    for (const k of ["left", "top", "width", "height"]) root.style[k] = L.style[k];
    root.style.setProperty("--dt", L.style.getPropertyValue("--dt") || "1");
  } catch (e) {}
}
function _dtkBuild(gv) {
  _dtkCss();
  const A = _DTK_ART, art = _dtkArt;
  const root = document.createElement("div");
  root.className = "dt-pick";
  // Over the game's canvas, under the game's own HTML (sales card, notices) and every mod layer, as the
  // game's picker sits in the canvas.
  const cv = document.querySelector("canvas");
  if (cv && cv.parentNode) cv.parentNode.insertBefore(root, cv.nextSibling);
  else document.body.appendChild(root);
  _dtkPlace(root);
  // The boss office's soft patch behind the tiles (Sprite39, BOSS UI (Blur)) is a blurred copy of that
  // room's floor: here the room's own floor is blurred the same way. It stops above the toolbar row.
  const blur = _dtkEl("dt-pick-blur", root);
  Object.assign(blur.style, {
    left: "calc(var(--dt) * 460px)", top: "calc(var(--dt) * 545px)", width: "calc(var(--dt) * 1000px)", height: "calc(var(--dt) * 540px)",
    backdropFilter: "blur(calc(var(--dt) * 20px))", webkitBackdropFilter: "blur(calc(var(--dt) * 20px))",
  });
  const m = "radial-gradient(ellipse 50% 50% at 50% 50%, #000 45%, transparent 100%), linear-gradient(#000 64%, transparent 72%)";
  blur.style.webkitMaskImage = blur.style.maskImage = m;
  blur.style.webkitMaskComposite = "source-in";
  blur.style.maskComposite = "intersect";
  // The black cover at 20% (TiledBackground3 7334); the centre button stays clear of it, as the game
  // lifts it above the cover. The clear spot fades out across its orange glow, so it has no edge.
  const cover = _dtkEl("dt-pick-cover", root);
  const hole = "radial-gradient(circle at calc(var(--dt) * 960px) calc(var(--dt) * 1000px), transparent calc(var(--dt) * 82px), #000 calc(var(--dt) * 150px))";
  cover.style.webkitMaskImage = cover.style.maskImage = hole;
  const tiles = [];
  for (const t of _DTK_TILES) {
    const hit = A.inst[t[0]], ci = A.inst[t[1]], sh = A.inst[t[2]], ic = A.inst[t[3]];
    const st = _dtkOpenTile(t, gv);
    const n = _dtkEl("dt-pick-tile", root);
    n.style.left = "calc(var(--dt) * " + hit[0] + "px)";
    n.style.top = "calc(var(--dt) * " + hit[1] + "px)";
    const shadow = _dtkEl("", n);
    _dtkMask(shadow, art.shadow);
    _dtkBox(shadow, sh[2], sh[3]);
    shadow.style.background = "#000";
    shadow.style.opacity = "0";
    const circle = _dtkEl("", n);
    _dtkMask(circle, art.circle);
    _dtkBox(circle, ci[2], ci[3]);
    circle.style.background = "#fff";
    circle.style.opacity = "0";
    // The icon's own colours (shown while hovered, and on faded tiles), with the tinted copy over it.
    const icon = _dtkEl("", n);
    _dtkBox(icon, ic[2] / 0.8, ic[3] / 0.8);
    icon.style.opacity = "0";
    icon.style.transform = "scale(0.8)";
    const own = _dtkEl("", icon);
    Object.assign(own.style, { position: "absolute", inset: "0", backgroundImage: 'url("' + art.icons[t[3]] + '")', backgroundSize: "100% 100%" });
    const tint = _dtkEl("", icon);
    _dtkMask(tint, art.icons[t[3]]);
    Object.assign(tint.style, { position: "absolute", inset: "0", background: art.tint });
    tint.style.display = st.hit ? "" : "none";
    tiles.push({ t, st, x: hit[0], y: hit[1], w: hit[2], h: hit[3], el: n, shadow, circle, icon, tint, tw: [], size: ci[2], shSize: sh[2] });
  }
  return { root, blur, cover, tiles };
}
// Game coordinates of a page point (the layer the centre button is on).
function _dtkToGame(ev) {
  const rt = globalThis.runtime;
  const b = rt.getInstanceByUid(_DTK_CENTRE.hit);
  const t = ev.touches && ev.touches[0] ? ev.touches[0] : ev.changedTouches && ev.changedTouches[0] ? ev.changedTouches[0] : ev;
  if (b && b.layer) return b.layer.cssPxToLayer(t.clientX, t.clientY);
  return [t.clientX, t.clientY];
}
function _dtkTileAt(p) {
  if (!_dtk) return null;
  for (const it of _dtk.tiles) if (it.st.hit && Math.abs(p[0] - it.x) <= it.w / 2 && Math.abs(p[1] - it.y) <= it.h / 2) return it;
  return null;
}
function _dtkCentreAt(ev) {
  const rt = globalThis.runtime;
  const b = rt.getInstanceByUid(_DTK_CENTRE.hit);
  if (!b || !b.layer || !b.layer.isVisible) return false;
  const p = _dtkToGame(ev);
  return !!b.containsPoint(p[0], p[1]);
}
function _dtkStop(it) {
  for (const w of it.tw) w.stop = true;
  it.tw = [];
}
// Hover in and out (GAMEPLAY CREATED DEVICES [Animations]): circle 146 and orange, icon in its own
// colours at 0.98, shadow orange at 180; back over 0.15 s.
function _dtkHover(it, on) {
  if (it.hover === on) return;
  it.hover = on;
  if (on) globalThis.runtime.callFunction("Tap_Hover");
  it.tint.style.display = on ? "none" : "";
  it.circle.style.background = on ? _dtkArt.hover : "#fff";
  const sec = on ? 0.25 : 0.15;
  const c0 = it.cSize || it.size, s0 = it.sSize || it.shSize, i0 = it.iScale || 0.8, col0 = it.col || [0, 0, 0];
  const c1 = on ? 146 : 120, s1 = on ? 180 : 138, i1 = on ? 0.98 : 0.8, col1 = on ? _DTK_ORANGE : [0, 0, 0];
  _dtkStop(it);
  it.tw.push(_dtkTween(sec, "expo", (k) => {
    it.cSize = c0 + (c1 - c0) * k;
    it.sSize = s0 + (s1 - s0) * k;
    it.iScale = i0 + (i1 - i0) * k;
    it.col = col0.map((v, i) => v + (col1[i] - v) * k);
    it.circle.style.transform = "scale(" + it.cSize / it.size + ")";
    it.shadow.style.transform = "scale(" + it.sSize / it.shSize + ")";
    it.icon.style.transform = "scale(" + it.iScale + ")";
    it.shadow.style.background = "rgb(" + it.col.map((v) => Math.round(v * 255)).join(",") + ")";
  }));
  _dtkCursor(on);
}
function _dtkCursor(on) {
  const cv = document.querySelector("canvas");
  if (cv) cv.style.cursor = on ? "pointer" : "";
}
// The centre button's parts, and the values they go back to.
function _dtkCentre() {
  const rt = globalThis.runtime, out = {};
  for (const k in _DTK_CENTRE) {
    const i = rt.getInstanceByUid(_DTK_CENTRE[k]);
    if (i) out[k] = { i, w: i.width, h: i.height, a: i.angleDegrees, c: i.colorRgb ? Array.from(i.colorRgb) : null, f: i.animationFrame || 0 };
  }
  return out;
}
function _dtkSize(p, w) {
  if (p && p.i) try { p.i.setSize(w, w); } catch (e) {}
}
// The room's own icon on the centre button: mid-stage a live room shows a turning gear or the stage's
// next step there (frames 1-3, 276 GAMEPLAY start of layout), the boss office its + (frame 0). While
// the picker is up the + stands in, so it turns into the same cross; the icon and its turn come back
// once the cross is a + again.
function _dtkIcon(ic, back) {
  if (!ic || !ic.i || !ic.f) return;
  try {
    const tw = ic.i.behaviors && ic.i.behaviors.Tween;
    if (tw) tw.isEnabled = !!back;
    ic.i.animationFrame = back ? ic.f : 0;
    ic.i.angleDegrees = back ? ic.a : 0;
  } catch (e) {}
}
// + to orange cross (0.25 s out-expo), and back.
function _dtkMorph(cen, on) {
  if (on) _dtkIcon(cen.icon, false);
  const from = {}, k0 = (p) => (p && p.i ? { w: p.i.width, a: p.i.angleDegrees, c: p.i.colorRgb ? Array.from(p.i.colorRgb) : null } : null);
  for (const k of ["circle", "ring", "icon", "glow"]) from[k] = k0(cen[k]);
  const to = on
    ? { circle: 160, ring: 108, icon: 74, glow: 270, a: 315, c: _DTK_ORANGE }
    : { circle: cen.circle && cen.circle.w, ring: cen.ring && cen.ring.w, icon: cen.icon && cen.icon.w, glow: cen.glow && cen.glow.w, a: cen.icon && !cen.icon.f ? cen.icon.a || 0 : 0, c: cen.glow && cen.glow.c };
  if (!on && cen.icon && cen.icon.i) try { cen.icon.i.angleDegrees = 315; } catch (e) {}
  if (!on && from.icon) from.icon.a = 315;
  return _dtkTween(0.25, "expo", (k) => {
    for (const n of ["circle", "ring", "icon", "glow"]) if (from[n] && to[n]) _dtkSize(cen[n], from[n].w + (to[n] - from[n].w) * k);
    if (from.icon && cen.icon.i) cen.icon.i.angleDegrees = from.icon.a + (to.a - from.icon.a) * k;
    if (from.glow && from.glow.c && to.c && cen.glow.i) cen.glow.i.colorRgb = from.glow.c.map((v, i) => v + (to.c[i] - v) * k);
  }, on ? null : () => _dtkIcon(cen.icon, true));
}
function _dtkFade(n, a, b, sec, delay, done) {
  n.style.opacity = String(a);
  return _dtkTween(sec, "linear", (k) => { n.style.opacity = String(a + (b - a) * k); }, done, delay);
}
// While the picker holds the day (CreateDevicesUI not OFF) the room's work holds too: the game's work
// timers, bubbles and screens stop on GameplayPause (276 GAMEPLAY 3730-3780, 3963-3985) but not on
// CreateDevicesUI, as its picker is only ever up in the boss office, where nobody works. The game's
// pause badge and edge shade (#gameplay-pause-ind, shown while GameplayPause is 1) stay away for a hold
// of the picker's own, as the game shows neither with its picker; a pause of the player's keeps them.
var _dtkHeld = null; // GameplayPause from before the hold
var _dtkUnhide = 0;
// The game's keyboard gets a key before the page does, so its Space/Esc pause toggle (276 GAMEPLAY
// 2431-2442) can still fire while the picker owns the keys, or late (a slow game) for a Space pressed
// just before it opened. The hold is kept at 1 every tick; a toggle that a Space/Esc pressed into the
// picker accounts for is dropped, any other is the player's own and flips the value put back on close.
var _dtkLeaks = 0;
function _dtkHold(gv) {
  if (!gv || _dtkHeld !== null) return;
  _dtkHeld = Number(gv.GameplayPause || 0);
  if (_dtkHeld === 0) {
    clearTimeout(_dtkUnhide);
    try { document.documentElement.classList.add("dt-pick-hold"); } catch (e) {}
  }
  gv.GameplayPause = 1;
}
function _dtkKeepHold(gv) {
  if (!gv || _dtkHeld === null || Number(gv.GameplayPause) === 1) return;
  if (_dtkLeaks > 0) _dtkLeaks--;
  else _dtkHeld = _dtkHeld === 1 ? 0 : 1;
  gv.GameplayPause = 1;
}
function _dtkRelease(gv) {
  if (_dtkHeld === null) return;
  const was = _dtkHeld;
  _dtkHeld = null;
  _dtkLeaks = 0;
  if (gv) gv.GameplayPause = was;
  // The badge's own 120 ms poll takes it off first, so it does not flash on the way out.
  clearTimeout(_dtkUnhide);
  _dtkUnhide = setTimeout(() => {
    try { if (_dtkHeld === null) document.documentElement.classList.remove("dt-pick-hold"); } catch (e) {}
  }, 400);
}
function _dtkCanOpen(gv) {
  if (!_DTK_ART || !_dtkArt || _dtk || !gv) return false;
  if (String(gv.class || "") !== "GAMEPLAY" || String(gv.CreateDevicesUI || "OFF") !== "OFF") return false;
  if (String(gv.Assistant || "OFF") !== "OFF") return false;
  if (_dtUi.isOpen && _dtUi.isOpen()) return false;
  return /^(DESIGNER|PROGRAMMER|ENGINEER) OFFICE \d+$/.test(_dtUi.layoutName());
}
// Opens the picker over the room on screen; false when it cannot (the caller falls back).
function _dtkOpen() {
  const gv = _dtkGv(), rt = globalThis.runtime;
  _dtkWire();
  if (!_dtkCanOpen(gv)) return false;
  let ui;
  try {
    ui = _dtkBuild(gv);
  } catch (e) {
    console.warn("[Rooms] picker:", e);
    // A half-built picker must not stay in the page as an empty layer.
    try { for (const n of document.querySelectorAll(".dt-pick")) n.remove(); } catch (e2) {}
    return false;
  }
  rt.callFunction("Tap_Main");
  gv.CreateDevicesUI = "WAIT";
  _dtkHold(gv);
  _dtk = Object.assign(ui, { layout: _dtUi.layoutName(), at: Date.now(), cen: _dtkCentre(), tw: [], pause: null, state: "wait" });
  const p = _dtk;
  // After the game's 0.05 s wait (Tap_Main, then CreateDevices_ON).
  setTimeout(() => {
    if (_dtk !== p || p.state !== "wait") return;
    p.tw.push(_dtkFade(p.cover, 0, 0.2, 0.15), _dtkFade(p.blur, 0, 1, 0.15), _dtkMorph(p.cen, true));
    try {
      p.pause = rt.objects.Sprite432.createInstance("GAMEPLAY GLOBAL UI (Top)", 1460, 60);
    } catch (e) {}
    for (const it of p.tiles) {
      const d = it.t[6];
      if (it.st.on) it.tw.push(_dtkFade(it.shadow, 0, 1, 0.15, d));
      it.circle.style.transform = "scale(0.75)";
      it.tw.push(_dtkTween(0.25, "back", (k) => { it.circle.style.transform = "scale(" + (0.75 + 0.25 * k) + ")"; }, null, d));
      it.tw.push(_dtkFade(it.circle, 0, it.st.on ? 1 : 0.35, 0.15, d));
      it.tw.push(_dtkFade(it.icon, 0, it.st.on ? 1 : 0.5, 0.15, d));
    }
    setTimeout(() => {
      if (_dtk !== p || p.state !== "wait") return;
      p.state = "on";
      gv.CreateDevicesUI = "ON";
      if (p.escWanted) _dtkClose(); // Esc while it was opening
    }, 375);
  }, 50);
  return true;
}
// The game's CreateDevices_OFF: everything fades out over 0.15 s, the cross turns back into the room's
// button, and CreateDevicesUI is OFF 0.2 s later.
function _dtkFadeOut(p, done) {
  const gv = _dtkGv();
  for (const w of p.tw) w.stop = true;
  for (const it of p.tiles) {
    _dtkStop(it);
    for (const n of [it.shadow, it.circle, it.icon]) it.tw.push(_dtkFade(n, Number(n.style.opacity) || 0, 0, 0.15));
  }
  _dtkCursor(false);
  _dtkFade(p.cover, Number(p.cover.style.opacity) || 0, 0, 0.15);
  _dtkFade(p.blur, Number(p.blur.style.opacity) || 0, 0, 0.15);
  _dtkMorph(p.cen, false);
  const pause = p.pause;
  if (pause) _dtkTween(0.15, "linear", (k) => { pause.opacity = 0.65 * (1 - k); }, () => { try { pause.destroy(); } catch (e) {} });
  setTimeout(() => {
    p.root.remove();
    if (p.state === "dead") return; // the layout changed meanwhile: its own screen owns CreateDevicesUI
    if (done) done();
    else if (gv && String(gv.CreateDevicesUI) === "WAIT") gv.CreateDevicesUI = "OFF";
    _dtkRelease(gv);
    if (_dtk === p) _dtk = null;
  }, 200);
}
// The centre press (or Esc) while it is up: the game's close.
function _dtkClose() {
  const p = _dtk, gv = _dtkGv();
  if (!p || p.state !== "on" || !gv) return false;
  p.state = "closing";
  globalThis.runtime.callFunction("Tap_Main");
  setTimeout(() => {
    if (_dtk !== p || p.state !== "closing") return; // taken down by a layout change
    gv.CreateDevicesUI = "WAIT";
    _dtkFadeOut(p);
  }, 50);
  return true;
}
// A tile press: the tile's click event (press bounce, then after 0.05 s DeviceType, CreateDevicesUI OFF,
// CreateDevices_OFF and the black cover 347 over 0.15 s; when it is in, LastClass/class and the layout).
function _dtkPick(it) {
  const p = _dtk, gv = _dtkGv(), rt = globalThis.runtime;
  if (!p || p.state !== "on" || !gv || String(gv.Assistant || "OFF") !== "OFF") return false;
  p.state = "picked";
  rt.callFunction("Tap_Main");
  _dtkStop(it);
  it.tw.push(_dtkTween(0.075, "linear", (k) => {
    it.circle.style.transform = "scale(" + (146 - 26 * k) / it.size + ")";
    it.icon.style.transform = "scale(" + ((it.iScale || 0.8) + (0.8 - (it.iScale || 0.8)) * k) + ")";
  }));
  const go = _DTK_GO[it.t[4]];
  p.pick = it.t[4];
  setTimeout(() => {
    if (_dtk !== p) return;
    if (go[0]) gv.DeviceType = go[0];
    gv.CreateDevicesUI = "OFF";
    _dtkRelease(gv);
    // The queue (busy) keeps this room as the place its create flow comes back to.
    try {
      if (globalThis._dtQueueApi && globalThis._dtQueueApi.pick) globalThis._dtQueueApi.pick(p.layout);
    } catch (e) {}
    _dtkFadeOut(p, () => {});
    const cov = rt.getInstanceByUid(347);
    const leave = () => {
      if (_dtUi.layoutName() !== p.layout) return;
      gv.LastClass = "GAMEPLAY";
      gv.class = go[1];
      rt.goToLayout(go[2]);
    };
    if (cov) _dtkTween(0.15, "linear", (k) => { cov.opacity = k; }, leave);
    else setTimeout(leave, 150);
  }, 50);
  return true;
}
// While it is up, presses on the game's screen are the picker's: a tile picks, the centre closes, the
// rest does nothing (the game's own buttons wait for CreateDevicesUI OFF). The game's HTML cards (sales,
// notices, news, settings) and the mod layer keep theirs. The office's full-screen HTML layer over the
// canvas counts as the screen.
var _DTK_OWN_HTML = ".dt-layer, #office-news-overlay.on-visible, #gs-root, #office-panel, #office-notifications";
function _dtkOnScreen(tgt) {
  if (!tgt || !tgt.closest) return false;
  if (tgt.tagName === "CANVAS") return true;
  return !!tgt.closest(".c3htmlwrap") && !tgt.closest(_DTK_OWN_HTML);
}
function _dtkOnPress(ev) {
  const p = _dtk;
  if (!p || (ev.button > 0 && ev.type !== "touchstart" && ev.type !== "touchend")) return;
  if (!_dtkOnScreen(ev.target)) return;
  ev.stopImmediatePropagation();
  ev.preventDefault();
  if (ev.type !== "pointerdown" && ev.type !== "touchstart") return;
  // A touch sends pointerdown and then touchstart for the same press.
  if (ev.type === "touchstart" && Date.now() - (p.lastPress || 0) < 500) return;
  if (ev.type === "pointerdown") p.lastPress = Date.now();
  try {
    const it = _dtkTileAt(_dtkToGame(ev));
    if (it) _dtkPick(it);
    else if (_dtkCentreAt(ev)) _dtkClose();
  } catch (e) {
    console.warn("[Rooms] picker press:", e);
  }
}
function _dtkOnMove(ev) {
  const p = _dtk;
  if (!p || p.state !== "on") return;
  try {
    const it = _dtkOnScreen(ev.target) ? _dtkTileAt(_dtkToGame(ev)) : null;
    for (const x of p.tiles) if (x !== it && x.hover) _dtkHover(x, false);
    if (it) _dtkHover(it, true);
  } catch (e) {}
}
// Esc closes it like the centre press. Keys never reach the game while it is up.
function _dtkOnKey(ev) {
  if (!_dtk) return;
  ev.stopImmediatePropagation();
  if (ev.type !== "keydown") return;
  if (!ev.repeat && (ev.key === " " || ev.key === "Escape" || ev.keyCode === 32 || ev.keyCode === 27)) _dtkLeaks++;
  setTimeout(() => _dtkKeepHold(_dtkGv()), 150); // after the game's 0.1 s toggle, if the key reached it
  if (ev.repeat || (ev.key !== "Escape" && ev.keyCode !== 27)) return;
  // While it opens (before ON) the press waits and closes it once it is open.
  if (_dtk.state === "wait") _dtk.escWanted = true;
  else _dtkClose();
}
// Any layout change takes it down at once (the game resets CreateDevicesUI on an office's start).
function _dtkOnLayoutStart() {
  const p = _dtk;
  if (!p) return;
  _dtk = null;
  const was = p.state;
  p.state = "dead"; // pending timers and fades stop
  for (const w of p.tw) w.stop = true;
  for (const it of p.tiles) _dtkStop(it);
  _dtkCursor(false);
  try { p.root.remove(); } catch (e) {}
  try { if (p.pause) p.pause.destroy(); } catch (e) {}
  const gv = _dtkGv();
  if (gv && was !== "picked" && String(gv.CreateDevicesUI) !== "OFF") gv.CreateDevicesUI = "OFF";
  _dtkRelease(gv);
}
function _dtkWire() {
  if (_dtkWired || typeof addEventListener !== "function") return;
  const rt = globalThis.runtime;
  if (!rt || typeof rt.addEventListener !== "function") return;
  rt.addEventListener("beforeanylayoutstart", _dtkOnLayoutStart);
  for (const t of ["pointerdown", "mousedown", "touchstart", "pointerup", "mouseup", "touchend", "click"]) addEventListener(t, _dtkOnPress, true);
  addEventListener("pointermove", _dtkOnMove, true);
  for (const t of ["keydown", "keyup"]) addEventListener(t, _dtkOnKey, true);
  _dtkWired = true;
}
function _dtkTick() {
  try {
    if (!_dtkGv()) return;
    _dtkWire();
    if (_DTK_ART && !_dtkArt && _dtUi.onOffice && _dtUi.onOffice()) _dtkLoadArt();
    if (_dtk) _dtkPlace(_dtk.root);
    _dtkKeepHold(_dtkGv());
  } catch (e) {
    console.warn("[Rooms] picker tick:", e);
  }
}
(typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(_dtkTick, 250);
globalThis._dtPicker = {
  ready: () => !!(_DTK_ART && _dtkArt),
  open: _dtkOpen,
  close: _dtkClose,
  isOpen: () => !!_dtk,
  state: () => (_dtk ? _dtk.state : ""),
  holding: () => _dtkHeld !== null,
  // How dark its black cover is now (0 to 0.2): the mod's toolbar buttons take the same shade (ui.js).
  dim: () => (_dtk && _dtk.cover ? Number(_dtk.cover.style.opacity) || 0 : 0),
  pick: (kind) => { const it = _dtk && _dtk.tiles.find((x) => x.t[4] === kind); return it ? _dtkPick(it) : false; },
  tiles: () => (_dtk ? _dtk.tiles.map((x) => ({ kind: x.t[4], on: x.st.on, hit: x.st.hit })) : []),
  load: _dtkLoadArt,
};
