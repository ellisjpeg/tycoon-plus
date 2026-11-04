// ── Compare (DEVICES_TYCOON_COMPARE) ──
// "Compare" on every My <Type> screen opens two devices side by side. Each
// side's rows are the game's own My Devices rows: we call the screen's own
// My<Type>Show function for that device and page, read ArrayMyDevices_Temp
// (exactly what showMyDevicesTable draws), then put every global and design
// array it touched back. Device pictures are the game's own preview renders,
// copied as the renderer hands them to its DrawingCanvas.
var _DT_CMP_TYPES = [
  { k: "SMARTPHONE", cls: "MY SMARTPHONES", arr: "ArraySmartphones", show: "MySmartphonesShow", draw: "MyDevices_SmartphoneDraw", redraw: "redrawSmartphone", v: 3, name: "Phone" },
  { k: "LAPTOP", cls: "MY LAPTOPS", arr: "ArrayLaptops", show: "MyLaptopsShow", draw: "MyDevices_LaptopDraw", redraw: "redrawLaptop", v: 2, name: "Laptop" },
  { k: "TABLET", cls: "MY TABLETS", arr: "ArrayTablets", show: "MyTabletsShow", draw: "MyDevices_TabletDraw", redraw: "redrawTablet", v: 2, name: "Tablet" },
  { k: "HEADPHONES", cls: "MY HEADPHONES", arr: "ArrayHeadphones", show: "MyHeadphonesShow", draw: "MyDevices_HeadphonesDraw", redraw: "redrawHeadphones", v: 1, name: "Headphones" },
  { k: "WATCH", cls: "MY WATCHES", arr: "ArrayWatches", show: "MyWatchesShow", draw: "MyDevices_WatchesDraw", redraw: "redrawWatches", v: 2, name: "Watch" },
  { k: "TV", cls: "MY TV", arr: "ArrayTV", show: "MyTVShow", draw: "MyDevices_TVDraw", redraw: "redrawTV", v: 1, name: "TV" },
  { k: "SCOOTER", cls: "MY SCOOTERS", arr: "ArrayScooters", show: "MyScootersShow", draw: "", v: 1, name: "Scooter" },
  { k: "KEYBOARD", cls: "MY KEYBOARDS", arr: "ArrayKeyboards", show: "MyKeyboardShow", draw: "", v: 1, name: "Keyboard" },
  { k: "CONSOLE", cls: "MY CONSOLES", arr: "ArrayConsoles", show: "MyConsolesShow", draw: "", v: 1, name: "Console" },
  { k: "GAMEPAD", cls: "MY GAMEPADS", arr: "ArrayGamepads", show: "MyGamepadsShow", draw: "", v: 1, name: "Gamepad" },
  { k: "VR", cls: "MY VR", arr: "ArrayVRConsoles", show: "MyVRShow", draw: "", v: 1, name: "VR headset" },
];

// ── Pure rules (no game access; unit tested) ──
var _dtCmpLogic = (function () {
  // Category names for the My Devices icon tabs, keyed by the tab's first row.
  const CATS = {
    "copies created": "Sales", "license": "Sales",
    "display resolution": "Display", "display": "Display", "displays": "Display", "screen": "Display",
    "photo resolution": "Camera", "frontal camera": "Camera", "cameras": "Cameras",
    "cpu": "Performance", "os": "System", "sound chip": "Sound", "sound": "Sound",
    "speakers chip": "Sound", "speakers": "Sound", "driver configuration": "Sound",
    "charger in package": "In the box", "charger": "In the box", "hdmi cable": "In the box",
    "carrying case": "In the box", "gamepad package": "In the box", "helmet": "In the box",
    "warranty": "Warranty", "case battery": "Battery", "battery": "Battery",
    "driving modes": "Driving", "suspension": "Suspension", "brakes": "Brakes", "switches": "Switches",
    "connection": "Connectivity", "connection port": "Connectivity", "additional features": "Features",
    "drive": "Storage", "2d graphics": "Graphics", "encryption": "Security", "microphone": "Microphone",
    "vibration": "Vibration", "controllers": "Controllers",
    "adjustable suspension": "Suspension", "brake system": "Brakes", "keyboard switches": "Switches",
    "supported drive": "Storage", "supported screen resolution": "Display", "supported 2d graphics": "Graphics",
    "data encryption": "Security", "gamepad": "In the box", "displays resolution": "Display",
    "hdmi cable in package": "In the box",
  };
  const BYTES = { kb: 1 / 1024, mb: 1, gb: 1024, tb: 1024 * 1024 };
  const HERTZ = { hz: 1, khz: 1e3, mhz: 1e6, ghz: 1e9 };

  function plain(v) {
    return String(v == null ? "" : v)
      .replace(/\[icon=CheckIcon\]/gi, "Yes").replace(/\[icon=RejectIcon\]/gi, "No")
      .replace(/\[icon=[^\]]*\]/gi, "").replace(/\[opacity=[0-9.]+\]/gi, " ").replace(/\[\/opacity\]/gi, " ")
      .replace(/\s+/g, " ").trim();
  }
  function catName(firstLabel, page) {
    const k = plain(firstLabel).toLowerCase();
    return CATS[k] || plain(firstLabel) || "Page " + page;
  }
  // Which way is better for a row: "up" (more is better), "down" (less is
  // better) or "neutral" (a difference, but not better or worse).
  function direction(label, unit) {
    const l = plain(label).toLowerCase();
    const u = String(unit || "").toLowerCase();
    if (/sell price|copies created|release|size|diagonal|weight of package/.test(l)) return "neutral";
    if (/cost price|weight|thickness|latency|response time|noise|process technology|charging time/.test(l)) return "down";
    if (u === "nm" || u === "ms" || u === "µs" || u === "mm" || u === "g" || u === "kg") return "down";
    return "up";
  }
  function versionLike(label, unit) {
    return /bluetooth|network|wi-?fi|version|generation/.test(plain(label).toLowerCase()) || unit === "G";
  }
  // Value kinds: none, bool, date, res (pixels), range ("20-20000 Hz"),
  // num (n + unit + family, an optional name in front: "NTSC 45%"), text.
  function parse(raw) {
    const s0 = String(raw == null ? "" : raw);
    if (/\[icon=CheckIcon\]/i.test(s0)) return { kind: "bool", v: true };
    if (/\[icon=RejectIcon\]/i.test(s0)) return { kind: "bool", v: false };
    const s = plain(s0);
    if (s === "" || /^-+$/.test(s)) return { kind: "none" };
    let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
    if (m) return { kind: "date", t: Number(m[3]) * 372 + Number(m[2]) * 31 + Number(m[1]) };
    m = /(\d{2,5})\s*[×xX]\s*(\d{2,5})/.exec(s);
    if (m) return { kind: "res", n: Number(m[1]) * Number(m[2]) };
    m = /^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*([A-Za-zµ°%]*)$/.exec(s);
    if (m) return { kind: "range", lo: Number(m[1]), hi: Number(m[2]), unit: m[3] };
    let pre = "";
    const named = /^([A-Za-z][A-Za-z0-9.]*)\s+(\d.*[%°])$/.exec(s);
    const body = named ? named[2] : s;
    if (named) pre = named[1];
    m = /^\+?(\$)?\s*([xX×])?\s*(\d{1,3}(?:[  ]\d{3})+|\d+)(?:[.,](\d+))?\s*-?\s*([A-Za-zµ°%]+(?:\/s)?|°)?/.exec(body);
    if (!m) return { kind: "text", s: s };
    // "Quartz Q3"-style names start with letters and stay text; a number that
    // runs straight into more words ("2D Graphics") stays text as well.
    const rest = body.slice(m[0].length).trim();
    let unit = m[1] ? "$" : m[2] ? "x" : m[5] || "";
    if (unit && !m[1] && !m[2] && /^[A-Za-z]/.test(rest) && !/^[(•]/.test(rest) && !/^[A-Z]{2,}/.test(unit)) {
      if (!/^(gb|mb|kb|tb|hz|khz|mhz|ghz|mah|nit|ppi|nm|fps|mpx|ms|µs|mm|g|kg|w|p|month|months|bit|gflops|tflops)$/i.test(unit)) return { kind: "text", s: s };
    }
    const dec = m[4] || "";
    const n = Number(m[3].replace(/[  ]/g, "") + (dec ? "." + dec : ""));
    const low = unit.toLowerCase();
    const fam = BYTES[low] ? "bytes" : HERTZ[low] ? "hertz" : "";
    return { kind: "num", n: n, unit: unit, pre: pre, rest: rest, dec: dec.length, fam: fam, base: fam === "bytes" ? n * BYTES[low] : fam === "hertz" ? n * HERTZ[low] : n };
  }
  function group(n) {
    const s = String(n);
    return /^\d{5,}$/.test(s) ? s.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : s;
  }
  function fmt(n, dec) {
    const d = Math.min(4, Math.max(0, dec));
    let s = n.toFixed(d);
    if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    const parts = s.split(".");
    return group(parts[0]) + (parts[1] ? "." + parts[1] : "");
  }
  // Amount text for a difference d (>0) in the row's own unit.
  function amount(d, a, b) {
    const unit = a.unit;
    const dec = Math.max(a.dec || 0, b.dec || 0);
    if (a.fam === "bytes" && a.unit !== b.unit) {
      const mb = d;
      if (mb >= 1024 * 1024) return fmt(mb / 1048576, 1) + " TB";
      if (mb >= 1024) return fmt(mb / 1024, 2) + " GB";
      if (mb >= 1) return fmt(mb, 1) + " MB";
      return fmt(mb * 1024, 0) + " KB";
    }
    if (a.fam === "hertz" && a.unit !== b.unit) {
      if (d >= 1e9) return fmt(d / 1e9, 2) + " GHz";
      if (d >= 1e6) return fmt(d / 1e6, 1) + " MHz";
      if (d >= 1e3) return fmt(d / 1e3, 1) + " kHz";
      return fmt(d, 0) + " Hz";
    }
    const v = a.fam ? d / (a.fam === "bytes" ? BYTES[unit.toLowerCase()] : HERTZ[unit.toLowerCase()]) : d;
    const n = fmt(v, dec);
    if (unit === "$") return "$" + n;
    if (unit === "x" || unit === "") return n;
    if (unit === "%") return n + "%";
    if (/^months?$/i.test(unit)) return n + (n === "1" ? " month" : " months");
    if (unit === "p" || unit === "G" || unit === "°") return n + unit; // "540p", "4G", "178°" as the game writes them
    return n + " " + unit;
  }
  const DOWN_WORD = [[/cost/, "cheaper"], [/weight/, "lighter"], [/thickness/, "thinner"], [/latency|response/, "faster"], [/process technology/, "smaller"], [/charging time/, "faster"]];
  // Compare one row. Returns { side: "l"|"r"|"", tone: "better"|"neutral"|"differ"|"",
  // text } where side is the side that gets the badge (the better side).
  function compare(label, rawL, rawR) {
    const a = parse(rawL), b = parse(rawR);
    const none = { side: "", tone: "", text: "" };
    if (a.kind === "none" && b.kind === "none") return none;
    if (a.kind === "none" || b.kind === "none") return plain(rawL) === plain(rawR) ? none : { side: "", tone: "differ", text: "" };
    if (a.kind === "bool" && b.kind === "bool") {
      if (a.v === b.v) return none;
      return { side: a.v ? "l" : "r", tone: "better", text: "Has it" };
    }
    if (a.kind === "date" && b.kind === "date") {
      if (a.t === b.t) return none;
      return { side: a.t > b.t ? "l" : "r", tone: "neutral", text: "Newer" };
    }
    if (a.kind === "res" && b.kind === "res") {
      if (a.n === b.n) return none;
      const hi = Math.max(a.n, b.n), lo = Math.min(a.n, b.n);
      const pct = Math.round((hi / lo - 1) * 100);
      return { side: a.n > b.n ? "l" : "r", tone: "better", text: "+" + group(pct) + "% pixels" };
    }
    if (a.kind === "range" && b.kind === "range" && a.unit === b.unit) {
      // A range that reaches further at both ends is better ("15-22000 Hz" over "20-20000 Hz").
      if (a.lo === b.lo && a.hi === b.hi) return none;
      if (a.lo <= b.lo && a.hi >= b.hi) return { side: "l", tone: "better", text: "Wider" };
      if (b.lo <= a.lo && b.hi >= a.hi) return { side: "r", tone: "better", text: "Wider" };
      return { side: "", tone: "differ", text: "" };
    }
    const sameUnit = a.kind === "num" && b.kind === "num" && a.pre === b.pre && (a.unit === b.unit || (a.fam && a.fam === b.fam));
    if (sameUnit) {
      // Same amount ("1024 MB" = "1 GB"): only the words after it can differ ("LPDDR2" vs "LPDDR3").
      if (a.base === b.base) return a.rest === b.rest ? none : { side: "", tone: "differ", text: "" };
      const dir = direction(label, a.unit);
      const d = Math.abs(a.base - b.base);
      if (dir === "neutral") return { side: a.base > b.base ? "l" : "r", tone: "neutral", text: "+" + amount(d, a, b) };
      if (versionLike(label, a.unit)) {
        const l = a.base > b.base;
        return { side: l ? "l" : "r", tone: "better", text: "Newer" };
      }
      if (dir === "down") {
        const word = (DOWN_WORD.find((w) => w[0].test(plain(label).toLowerCase())) || [0, "lower"])[1];
        return { side: a.base < b.base ? "l" : "r", tone: "better", text: amount(d, a, b) + " " + word };
      }
      return { side: a.base > b.base ? "l" : "r", tone: "better", text: "+" + amount(d, a, b) };
    }
    return plain(rawL) === plain(rawR) ? none : { side: "", tone: "differ", text: "" };
  }
  // Pages from the game ([[label, value], ...] per tab) to sections of rows.
  // Feature lists (rows with an empty label under a header) are keyed by the
  // feature's name so "IP57" vs "IP68" lines up and a missing one shows "—".
  function sections(pages) {
    const out = [];
    pages.forEach((rows, i) => {
      if (!rows.length) return;
      const sec = { name: catName(rows[0].length > 2 ? rows[0][2] : rows[0][0], i + 1), rows: [] };
      let head = "";
      rows.forEach(([l0, v0, el0, ev0], at) => {
        const l = String(l0 == null ? "" : l0), v = String(v0 == null ? "" : v0);
        // English twin (Russian game): keys and comparisons use it, the screen shows l and v.
        const el = el0 == null ? l : String(el0), ev = ev0 == null ? v : String(ev0);
        if (!plain(l) && !plain(v)) { sec.rows.push({ kind: "gap" }); head = ""; return; }
        // A header ("Additional Features") is a label with no value and feature lines under it.
        const next = rows[at + 1] || ["", ""];
        if (plain(l) && !plain(v) && !/\[icon=/.test(v) && !plain(next[0]) && plain(next[1])) {
          head = plain(el);
          sec.rows.push({ kind: "sub", label: l, key: "sub:" + head.toLowerCase() });
          return;
        }
        if (!plain(l)) {
          // "Dust and Water Protection[opacity=65]IP57[/opacity]": the name is the
          // label, the dimmed part (or a tick) is the value.
          const split = (x) => {
            const cut = x.search(/\[opacity=/i), rest = cut >= 0 ? x.slice(cut) : "";
            return [plain(cut >= 0 ? x.slice(0, cut) : x), plain(rest) ? rest : "[icon=CheckIcon]"];
          };
          const [name, val] = split(v), [en, enVal] = split(ev);
          sec.rows.push({ kind: "item", label: name, value: val, en, ev: enVal, key: "item:" + head.toLowerCase() + ":" + en.toLowerCase() });
          return;
        }
        sec.rows.push({ kind: "row", label: l, value: v, en: el, ev, key: "row:" + plain(el).toLowerCase() });
      });
      while (sec.rows.length && sec.rows[sec.rows.length - 1].kind === "gap") sec.rows.pop();
      out.push(sec);
    });
    return out;
  }
  // Line two devices' sections up: left order first, then rows only the right
  // side has (placed after the last row they follow on the right).
  function merge(pagesL, pagesR) {
    const L = sections(pagesL), R = sections(pagesR);
    const used = new Set();
    const findR = (key) => {
      for (let s = 0; s < R.length; s++) for (let r = 0; r < R[s].rows.length; r++) {
        const row = R[s].rows[r];
        if (row.key === key && !used.has(s + ":" + r)) return [s, r];
      }
      return null;
    };
    const out = [];
    for (const sec of L) {
      const o = { name: sec.name, rows: [] };
      for (const row of sec.rows) {
        if (row.kind === "gap") { o.rows.push({ kind: "gap" }); continue; }
        const hit = findR(row.key);
        if (hit) used.add(hit[0] + ":" + hit[1]);
        const rr = hit ? R[hit[0]].rows[hit[1]] : null;
        o.rows.push(fill({ kind: row.kind, label: row.label, en: row.en, l: row.value, r: rr ? rr.value : null, el: row.ev, er: rr ? rr.ev : null }));
      }
      out.push(o);
    }
    R.forEach((sec, s) => {
      let target = out.find((o) => o.name === sec.name);
      sec.rows.forEach((row, r) => {
        if (row.kind === "gap" || used.has(s + ":" + r)) return;
        if (!target) { target = { name: sec.name, rows: [] }; out.push(target); }
        target.rows.push(fill({ kind: row.kind, label: row.label, en: row.en, l: null, r: row.value, el: null, er: row.ev }));
      });
    });
    for (const o of out) {
      // A sub-header both sides lack items under is dropped; gaps never lead or trail.
      o.rows = o.rows.filter((row, i, a) => !(row.kind === "gap" && (i === 0 || i === a.length - 1 || a[i - 1].kind === "gap")));
      for (const row of o.rows) if (row.kind === "row" || row.kind === "item") row.cmp = cmpRow(row);
    }
    return out.filter((o) => o.rows.length);
  }
  // A feature one side lacks shows the game's cross on that side.
  function fill(row) {
    if (row.kind !== "item") return row;
    if (row.l == null) { row.l = "[icon=RejectIcon]"; row.miss = "l"; }
    if (row.r == null) { row.r = "[icon=RejectIcon]"; row.miss = "r"; }
    return row;
  }
  function cmpRow(row) {
    if (row.miss) return { side: row.miss === "l" ? "r" : "l", tone: "better", text: "Has it" };
    if (row.l == null || row.r == null) return { side: "", tone: "", text: "" };
    const en = row.en == null ? row.label : row.en;
    return compare(en, row.el == null ? row.l : row.el, row.er == null ? row.r : row.er);
  }
  // Picker order: the anchor device's type first (newest first, editions in
  // order), then the other types in the My Devices hub order.
  function order(list, anchorType) {
    const rank = (t) => (t === anchorType ? -1 : _DT_CMP_TYPES.findIndex((x) => x.k === t));
    return list.slice().sort((a, b) => rank(a.type) - rank(b.type) || a.x - b.x || a.y - b.y);
  }
  // The other side when the screen opens: the same edition one model older,
  // else the next device of that type in the list, else the one before it.
  function partner(list, cur) {
    const i = list.findIndex((e) => e.type === cur.type && e.x === cur.x && e.y === cur.y);
    const older = list.find((e) => e.type === cur.type && e.x === cur.x + 1 && e.y === cur.y)
      || list.find((e) => e.type === cur.type && e.x === cur.x + 1);
    if (older) return older;
    if (i >= 0 && list[i + 1] && list[i + 1].type === cur.type) return list[i + 1];
    if (i > 0 && list[i - 1].type === cur.type) return list[i - 1];
    return list[i + 1] || list[i - 1] || cur;
  }
  return { plain, parse, compare, sections, merge, order, partner, direction, catName };
})();

// ── Game access ──
var _dtCmp = { btn: null, view: null, timer: 0, cache: new Map(), imgs: new Map(), noimg: new Set(), teed: new WeakSet(), last: new WeakMap(), busy: Promise.resolve(), wired: false };

function _dtCmpRt() {
  return globalThis.runtime || null;
}
function _dtCmpArr(name) {
  try {
    const o = _dtCmpRt().objects[name];
    return o ? o.getFirstInstance() : null;
  } catch (e) {
    return null;
  }
}
function _dtCmpTypeOf(key) {
  return _DT_CMP_TYPES.find((t) => t.k === key) || null;
}
// The My <Type> screen we are on (by layout, or by $class during its fade).
function _dtCmpScreen() {
  const rt = _dtCmpRt();
  if (!rt) return null;
  let lay = "";
  try { lay = String(rt.layout.name || ""); } catch (e) {}
  return _DT_CMP_TYPES.find((t) => t.cls === lay) || null;
}
function _dtCmpVariants(t, a, x) {
  if (t.v === 3) return a.getAt(x, 1, 7) !== -1 ? (a.getAt(x, 2, 7) !== -1 ? 3 : 2) : 1;
  if (t.v === 2) return a.getAt(x, 1, 7) !== -1 ? 2 : 1;
  return 1;
}
function _dtCmpYear(e) {
  const m = /(\d{4})\s*$/.exec(String(e.date || ""));
  return m ? m[1] : "";
}
// Every device the player owns, as the My Devices screens list them.
function _dtCmpList(anchorType) {
  const list = [];
  for (const t of _DT_CMP_TYPES) {
    const a = _dtCmpArr(t.arr);
    if (!a || !(a.width > 0)) continue;
    for (let x = 0; x < a.width; x++) {
      const n = _dtCmpVariants(t, a, x);
      for (let y = 0; y < n; y++) {
        const name = String(a.getAt(x, y, 8) == null ? "" : a.getAt(x, y, 8));
        if (!name) continue;
        const rel = Number(a.getAt(x, y, 7));
        list.push({ type: t.k, x: x, y: y, name: name, id: a.getAt(x, y, 10), released: rel >= 0, date: rel >= 0 ? String(a.getAt(x, y, 9) || "") : "" });
      }
    }
  }
  return _dtCmpLogic.order(list, anchorType);
}
function _dtCmpKey(e) {
  return e.type + ":" + e.x + ":" + e.y + ":" + e.id;
}
// Snapshot of what My<Type>Show / Draw write: every global variable, the
// editor design arrays they JSON-load into and the table's own array.
function _dtCmpSnap() {
  const rt = _dtCmpRt(), g = rt.globalVars, vars = {};
  for (const k of Object.keys(g)) {
    const v = g[k];
    if (typeof v === "number" || typeof v === "string") vars[k] = v;
  }
  const arrs = [];
  for (const name of Object.keys(rt.objects)) {
    if (!/^ArrayEditorDesign_/.test(name) && name !== "ArrayMyDevices_Temp") continue;
    const a = _dtCmpArr(name);
    if (!a) continue;
    const w = a.width, h = a.height, d = a.depth, cells = [];
    if (w * h * d > 200000) continue;
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) cells.push(a.getAt(x, y, z));
    arrs.push({ a, w, h, d, cells });
  }
  return { vars, arrs };
}
function _dtCmpRestore(s) {
  const g = _dtCmpRt().globalVars;
  for (const k in s.vars) if (g[k] !== s.vars[k]) g[k] = s.vars[k];
  for (const r of s.arrs) {
    if (r.a.width !== r.w || r.a.height !== r.h || r.a.depth !== r.d) r.a.setSize(r.w, r.h, r.d);
    let i = 0;
    for (let x = 0; x < r.w; x++) for (let y = 0; y < r.h; y++) for (let z = 0; z < r.d; z++) {
      const v = r.cells[i++];
      if (r.a.getAt(x, y, z) !== v) r.a.setAt(v, x, y, z);
    }
  }
}
function _dtCmpReadTemp() {
  const t = _dtCmpArr("ArrayMyDevices_Temp");
  const rows = [];
  if (!t) return rows;
  // Same reading as the game's _readRows2: [label, value] per x (or per y when transposed).
  const tr = t.width === 2 && t.height > 2;
  const n = tr ? t.height : t.width;
  for (let i = 0; i < n; i++) {
    const l = tr ? t.getAt(0, i) : t.getAt(i, 0), v = tr ? t.getAt(1, i) : t.getAt(i, 1);
    rows.push([l == null ? "" : String(l), v == null ? "" : String(v)]);
  }
  while (rows.length && rows[rows.length - 1][0] === "" && rows[rows.length - 1][1] === "") rows.pop();
  return rows;
}
// All My Devices pages of one device, straight from the game's own function.
function _dtCmpPages(e) {
  const key = _dtCmpKey(e) + ":" + _dtCmpRt().globalVars.LanguageChoose;
  if (_dtCmp.cache.has(key)) return _dtCmp.cache.get(key);
  const t = _dtCmpTypeOf(e.type), rt = _dtCmpRt(), g = rt.globalVars;
  const snap = _dtCmpSnap();
  const temp = _dtCmpArr("ArrayMyDevices_Temp");
  const pages = [];
  let ok = false;
  const read = () => {
    const out = [];
    g.SubPage = e.x + 1;
    g.DeviceShowFlagmanID = e.y;
    for (let p = 1; p <= 12; p++) {
      temp.setSize(0, 2, 1);
      g.MiniPage = p;
      rt.callFunction(t.show);
      const rows = _dtCmpReadTemp();
      if (!rows.length) break;
      out.push(rows);
    }
    return out;
  };
  try {
    pages.push(...read());
    // Russian labels can't be matched to the English rules (which side is
    // better, section names), so read the English rows too and keep them as
    // [label, value, enLabel, enValue]; the player still sees the Russian ones.
    if (Number(g.LanguageChoose) === 1) {
      g.LanguageChoose = 0;
      const en = read();
      pages.forEach((rows, i) => {
        if (!en[i] || en[i].length !== rows.length) return;
        rows.forEach((row, j) => { row.push(en[i][j][0], en[i][j][1]); });
      });
    }
    ok = true;
  } catch (err) {
    console.warn("[Compare] could not read " + e.name, err);
  } finally {
    _dtCmpRestore(snap);
  }
  if (ok) _dtCmp.cache.set(key, pages);
  return pages;
}
// Put the My Devices screen back exactly as the player left it.
function _dtCmpRedrawScreen() {
  const t = _dtCmpScreen();
  if (!t) return;
  try {
    _dtCmpRt().callFunction(t.show);
    if (t.draw) _dtCmpRt().callFunction(t.draw);
  } catch (e) {}
}

// ── Device pictures ──
function _dtCmpTee() {
  const rt = _dtCmpRt(), out = [];
  for (const name of Object.keys(rt.objects)) {
    if (!/^DrawingCanvas_/.test(name)) continue;
    let ins = [];
    try { ins = rt.objects[name].getAllInstances(); } catch (e) {}
    for (const i of ins) {
      out.push(i);
      if (_dtCmp.teed.has(i) || typeof i.loadImagePixelData !== "function") continue;
      _dtCmp.teed.add(i);
      const orig = i.loadImagePixelData;
      i.loadImagePixelData = function (img) {
        try { _dtCmp.last.set(i, { img: img, at: performance.now() }); } catch (e) {}
        return orig.apply(this, arguments);
      };
    }
  }
  return out;
}
// ImageData from the renderers is premultiplied: undo that, trim the empty
// margin and keep a PNG data URL.
function _dtCmpPng(img) {
  const w = img.width, h = img.height, src = img.data;
  const data = new Uint8ClampedArray(src.length);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, a = src[i + 3];
    if (a) {
      data[i] = Math.min(255, (src[i] * 255) / a); data[i + 1] = Math.min(255, (src[i + 1] * 255) / a); data[i + 2] = Math.min(255, (src[i + 2] * 255) / a); data[i + 3] = a;
      if (a > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) return "";
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").putImageData(new ImageData(data, w, h), 0, 0);
  const pad = 4, cw = Math.min(w, x1 - x0 + 1 + 2 * pad), ch = Math.min(h, y1 - y0 + 1 + 2 * pad);
  // Shown at most 190 design px (380 px on a 4K screen): keep it small.
  const k = Math.min(1, 400 / Math.max(cw, ch));
  const o = document.createElement("canvas");
  o.width = Math.round(cw * k); o.height = Math.round(ch * k);
  const ctx = o.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(c, Math.max(0, x0 - pad), Math.max(0, y0 - pad), cw, ch, 0, 0, o.width, o.height);
  return o.toDataURL("image/png");
}
// The game's own preview of a device of the screen's type: run its Draw for
// that device, take the biggest canvas the renderer writes, put things back.
function _dtCmpImage(e) {
  const key = e.type + ":" + e.id + ":" + e.y;
  if (_dtCmp.imgs.has(key)) return Promise.resolve(_dtCmp.imgs.get(key));
  const scr = _dtCmpScreen(), t = _dtCmpTypeOf(e.type);
  // Only the screen's own type has its preview canvas on this layout. A device
  // that gave no picture this time is not tried again until the next open.
  if (!scr || !t || scr.k !== t.k || !t.draw || _dtCmp.noimg.has(key)) return Promise.resolve("");
  const view = _dtCmp.view;
  const job = _dtCmp.busy.then(() => new Promise((resolve) => {
    // Queued behind another picture: skip it if Compare closed meanwhile, so
    // nothing draws over the game's screen after it was put back.
    if (!view || _dtCmp.view !== view || _dtCmpScreen() !== scr) return resolve("");
    const fail = () => {
      _dtCmp.noimg.add(key);
      resolve("");
    };
    let snap = null;
    const rt = _dtCmpRt(), g = rt.globalVars;
    let canv = [];
    const t0 = performance.now();
    try {
      canv = _dtCmpTee();
      snap = _dtCmpSnap();
      g.SubPage = e.x + 1;
      g.DeviceShowFlagmanID = e.y;
      g.ColorChoose = 1;
      rt.callFunction(t.draw);
      // The renderers skip a redraw when the design did not change (the device
      // already on screen): force one so its pixels come through as well.
      if (t.redraw && typeof globalThis[t.redraw] === "function") globalThis[t.redraw]();
    } catch (err) {
      try { snap && _dtCmpRestore(snap); } catch (e2) {}
      return fail();
    }
    try { _dtCmpRestore(snap); } catch (err) {}
    const started = performance.now();
    // Closed while the renderer was busy: put the game's own preview back.
    const settle = (url) => {
      if (_dtCmp.view !== view) _dtCmpRedrawScreen();
      resolve(url);
    };
    const poll = () => {
      let best = null;
      for (const i of canv) {
        const l = _dtCmp.last.get(i);
        if (l && l.at >= t0 && (!best || l.img.width * l.img.height > best.width * best.height)) best = l.img;
      }
      // Front and side canvases render in the same pass: give the second a moment.
      if (best && performance.now() - started > 120) {
        let url = "";
        try { url = _dtCmpPng(best); } catch (err) {}
        if (url) _dtCmp.imgs.set(key, url);
        else _dtCmp.noimg.add(key);
        return settle(url);
      }
      if (performance.now() - started > 2500) {
        _dtCmp.noimg.add(key);
        return settle("");
      }
      setTimeout(poll, 40);
    };
    setTimeout(poll, 40);
  }));
  _dtCmp.busy = job.then(() => 0, () => 0);
  return job.catch(() => "");
}

// ── View ──
var _DT_CMP_CSS = `
.dt-cmp-btn { position: absolute; left: calc(var(--dt) * 262px); top: calc(var(--dt) * 974px); height: calc(var(--dt) * 50px);
  display: flex; align-items: center; gap: calc(var(--dt) * 22px); pointer-events: auto; cursor: pointer;
  font-family: "SofiaSansExtraCondensed-Light", "Oswald", sans-serif; font-size: calc(var(--dt) * 42px); color: #fff;
  animation: dt-fade 0.22s ease-out backwards; transition: transform 0.16s ease, filter 0.16s ease; }
.dt-cmp-btn:hover { filter: brightness(1.15); transform: translateY(calc(var(--dt) * -2px)); }
.dt-cmp-key { display: flex; align-items: center; justify-content: center; width: calc(var(--dt) * 50px); height: calc(var(--dt) * 50px);
  border: calc(var(--dt) * 3px) solid #fff; border-radius: calc(var(--dt) * 9px);
  font-family: "SofiaSansExtraCondensed-Bold", "Oswald", sans-serif; font-size: calc(var(--dt) * 28px); line-height: 1; }
.dt-cmp-btn svg { width: calc(var(--dt) * 30px); height: calc(var(--dt) * 30px); }
/* Full page of the My <Type> screen (mods-ui/mdpage.js): the game's background, tab strip, table cells and key hints. */
.dt-cmp-top { position: absolute; left: calc(var(--dt) * 52px); top: calc(var(--dt) * 128px); width: calc(var(--dt) * 1816px);
  height: calc(var(--dt) * 262px); display: grid; grid-template-columns: 1fr calc(var(--dt) * 330px) 1fr; align-items: center; }
.dt-cmp-dev { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 0; }
.dt-cmp-pic { flex: 0 0 auto; width: calc(var(--dt) * 260px); height: calc(var(--dt) * 168px); display: flex; align-items: center; justify-content: center; }
.dt-cmp-pic img { max-width: 100%; max-height: 100%; object-fit: contain; filter: drop-shadow(0 calc(var(--dt) * 8px) calc(var(--dt) * 14px) rgba(0,0,0,0.45)); }
.dt-cmp-pic svg { width: 62%; height: 62%; color: rgba(255,255,255,0.55); }
.dt-cmp-row { display: flex; align-items: center; justify-content: center; gap: calc(var(--dt) * 18px); margin-top: calc(var(--dt) * 12px); min-width: 0; }
.dt-cmp-who { display: flex; flex-direction: column; align-items: center; min-width: 0; width: calc(var(--dt) * 320px); }
.dt-cmp-name { pointer-events: auto; cursor: pointer; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif; font-size: calc(var(--dt) * 38px); line-height: 1.15;
  border-radius: calc(var(--dt) * 6px); padding: 0 calc(var(--dt) * 12px); transition: background-color 0.16s ease; }
.dt-cmp-name:hover { background: rgba(255,255,255,0.1); }
.dt-cmp-name::after { content: ""; display: inline-block; margin-left: calc(var(--dt) * 10px); vertical-align: middle;
  border: calc(var(--dt) * 7px) solid transparent; border-top-color: rgba(255,255,255,0.6); border-bottom: 0; }
.dt-cmp-sub { font-family: "SofiaSansExtraCondensed-Light", "Oswald", sans-serif; font-size: calc(var(--dt) * 26.65px); color: rgba(255,255,255,0.62); }
.dt-cmp-arrow { pointer-events: auto; cursor: pointer; flex: 0 0 auto; width: calc(var(--dt) * 46px); height: calc(var(--dt) * 46px);
  display: flex; align-items: center; justify-content: center; transition: transform 0.12s ease, opacity 0.16s ease; }
.dt-cmp-arrow svg { width: calc(var(--dt) * 30px); height: calc(var(--dt) * 30px); fill: #fff; }
.dt-cmp-arrow:hover { transform: scale(1.12); }
.dt-cmp-arrow.dt-off { opacity: 0.22; pointer-events: none; }
.dt-cmp-vs { align-self: end; padding-bottom: calc(var(--dt) * 40px); text-align: center; font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif; font-size: calc(var(--dt) * 34.7px);
  color: rgba(255,255,255,0.5); }
.dt-cmp-scroll { position: absolute; left: calc(var(--dt) * 46px); top: calc(var(--dt) * 400px); width: calc(var(--dt) * 1836px);
  height: calc(var(--dt) * 540px); padding-right: calc(var(--dt) * 4px); }
.dt-cmp-table td.dt-cmp-lab { width: calc(var(--dt) * 330px); }
.dt-cmp-table tr.dt-cmp-sec td { background: rgba(255,255,255,0.1); font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif; }
.dt-cmp-table tr.dt-cmp-gap td { background: transparent; padding: 0.35em 0; }
.dt-cmp-table tr.dt-cmp-subh td { background: rgba(0,0,0,0.15); color: rgba(255,255,255,0.7); }
.dt-cmp-table td.dt-cmp-v { position: relative; }
.dt-cmp-table td.dt-better { background: rgba(110, 180, 30, 0.24); }
.dt-cmp-table td.dt-differ { box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2); }
.dt-cmp-table td.dt-missing { color: rgba(255,255,255,0.35); }
.dt-cmp-val { display: inline-flex; align-items: center; justify-content: center; gap: 0.28em; }
.dt-cmp-val img { height: 1.1em; display: block; }
.dt-cmp-op { display: inline-flex; align-items: center; gap: 0.28em; }
.dt-cmp-badge { display: inline-block; margin-left: 0.6em; white-space: nowrap; vertical-align: middle; font-size: 0.86em;
  font-family: "SofiaSansExtraCondensed-Regular", "Oswald", sans-serif; color: rgb(168, 212, 24); }
.dt-cmp-badge.dt-neutral { color: rgba(255,255,255,0.55); }
.dt-cmp-empty { text-align: center; padding: calc(var(--dt) * 120px) 0; color: rgba(255,255,255,0.62); font-size: calc(var(--dt) * 30px); }
.dt-cmp-list { position: absolute; z-index: 5; width: calc(var(--dt) * 520px); max-height: calc(var(--dt) * 640px);
  overflow-y: auto; pointer-events: auto; padding: calc(var(--dt) * 8px); border-radius: calc(var(--dt) * 8px);
  background: rgba(14, 18, 27, 0.96); box-shadow: 0 calc(var(--dt) * 20px) calc(var(--dt) * 50px) rgba(0,0,0,0.55);
  animation: dt-fade 0.16s ease-out backwards; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.25) transparent; }
.dt-cmp-list-h { padding: calc(var(--dt) * 10px) calc(var(--dt) * 14px) calc(var(--dt) * 4px); font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif;
  font-size: calc(var(--dt) * 24px); color: rgba(255,255,255,0.5); }
.dt-cmp-list-i { display: flex; justify-content: space-between; gap: calc(var(--dt) * 12px); cursor: pointer;
  padding: calc(var(--dt) * 7px) calc(var(--dt) * 14px); border-radius: calc(var(--dt) * 5px); font-family: "SofiaSansExtraCondensed-Light", "Oswald", sans-serif;
  font-size: calc(var(--dt) * 28px); }
.dt-cmp-list-i:hover { background: rgba(255,255,255,0.1); }
.dt-cmp-list-i.dt-on { background: rgba(255,255,255,0.16); }
.dt-cmp-list-i span:last-child { color: rgba(255,255,255,0.5); }
`;

function _dtCmpIcon(type) {
  const s = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">';
  const p = {
    SMARTPHONE: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10.5 18.5h3"/>',
    TABLET: '<rect x="4.5" y="2.5" width="15" height="19" rx="2"/><path d="M11 18.5h2"/>',
    LAPTOP: '<rect x="5" y="5" width="14" height="10" rx="1"/><path d="M3 18.5h18"/>',
    HEADPHONES: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
    WATCH: '<rect x="7" y="6" width="10" height="12" rx="3"/><path d="M9 6l1-3.5h4L15 6M9 18l1 3.5h4L15 18"/>',
    TV: '<rect x="2.5" y="4" width="19" height="13" rx="1.5"/><path d="M8 21h8M12 17v4"/>',
    SCOOTER: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 18h7M16 4h2l-2 14"/>',
    KEYBOARD: '<rect x="2.5" y="7" width="19" height="10" rx="1.5"/><path d="M6 10h1M9 10h1M12 10h1M15 10h1M18 10h0M7 14h10"/>',
    CONSOLE: '<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 18v2M16 18v2"/>',
    GAMEPAD: '<path d="M7 8h10a4 4 0 0 1 4 4.5l-.6 3.5a2.5 2.5 0 0 1-4.3 1.2L14 15h-4l-2.1 2.2a2.5 2.5 0 0 1-4.3-1.2L3 12.5A4 4 0 0 1 7 8z"/><path d="M7.5 11v3M6 12.5h3"/>',
    VR: '<rect x="2.5" y="7" width="19" height="10" rx="3"/><path d="M10 17l2-2.5 2 2.5"/>',
  };
  return s + (p[type] || p.SMARTPHONE) + "</svg>";
}
var _DT_CMP_ARROW_L = '<svg viewBox="0 0 24 24"><path d="M16 3.5v17L5 12z"/></svg>';
var _DT_CMP_ARROW_R = '<svg viewBox="0 0 24 24"><path d="M8 3.5v17L19 12z"/></svg>';
var _DT_CMP_BTN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/></svg>';

function _dtCmpEsc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
// The game's cell markup ([icon=..], [opacity=N]..[/opacity]) as the My Devices table draws it.
// Russian for the panel's own words (game values and labels arrive in the game's language).
var _DT_CMP_RU = {
  "Compare": "Сравнить", "Done": "Готово", "Swap sides": "Поменять местами", "Differences only": "Только различия", "All specs": "Все характеристики",
  "Previous device": "Предыдущее устройство", "Next device": "Следующее устройство", "Pick a device": "Выбрать устройство",
  "Not released": "Не выпущено", "Compare two devices side by side (C)": "Сравнить два устройства рядом (C)",
  "Both sides show the same device.": "С обеих сторон одно и то же устройство.",
  "No differences: these two are the same on every row.": "Различий нет: устройства совпадают во всех строках.",
  "Nothing to compare.": "Нечего сравнивать.",
  "Has it": "Есть", "Newer": "Новее", "Wider": "Шире",
  "Sales": "Продажи", "Display": "Дисплей", "Camera": "Камера", "Cameras": "Камеры", "Performance": "Производительность",
  "System": "Система", "Sound": "Звук", "In the box": "В комплекте", "Warranty": "Гарантия", "Battery": "Батарея",
  "Driving": "Езда", "Suspension": "Подвеска", "Brakes": "Тормоза", "Switches": "Переключатели", "Connectivity": "Связь",
  "Features": "Функции", "Storage": "Память", "Graphics": "Графика", "Security": "Безопасность", "Microphone": "Микрофон",
  "Vibration": "Вибрация", "Controllers": "Контроллеры",
  "Phone": "Телефон", "Laptop": "Ноутбук", "Tablet": "Планшет", "Headphones": "Наушники", "Watch": "Часы",
  "TV": "Телевизор", "Scooter": "Самокат", "Keyboard": "Клавиатура", "Console": "Консоль", "Gamepad": "Геймпад",
  "VR headset": "VR-шлем",
};
var _DT_CMP_RU_WORD = { cheaper: "дешевле", lighter: "легче", thinner: "тоньше", faster: "быстрее", smaller: "меньше", lower: "ниже" };
// Russian month count: 1 месяц, 2-4 месяца, 5+ месяцев (21 месяц, 1.5 месяца).
function _dtCmpRuMonths(n) {
  if (/\D/.test(n)) return "месяца";
  const k = Number(n) % 100, d = k % 10;
  return k >= 11 && k <= 14 ? "месяцев" : d === 1 ? "месяц" : d >= 2 && d <= 4 ? "месяца" : "месяцев";
}
function _dtCmpT(s) {
  if (!(typeof _dtUi.ru === "function" && _dtUi.ru())) return s;
  s = String(s).replace(/^(\+?)([\d.,]+) months?(?= |$)/, (all, sign, n) => sign + n + " " + _dtCmpRuMonths(n));
  const m = /^\+(.+)% pixels$/.exec(s), pg = /^Page (\d+)$/.exec(s);
  const w = /^(.+) (cheaper|lighter|thinner|faster|smaller|lower)$/.exec(s);
  if (w) return w[1] + " " + _DT_CMP_RU_WORD[w[2]];
  return _DT_CMP_RU[s] || (m ? "+" + m[1] + "% пикселей" : pg ? "Страница " + pg[1] : s);
}

function _dtCmpCell(v) {
  const s = String(v == null ? "" : v);
  const re = /\[icon=([^\]\s]+)\]|\[opacity=([0-9]+(?:\.[0-9]+)?)\]|\[\/opacity\]/gi;
  let out = "", last = 0, open = 0, m;
  while ((m = re.exec(s)) !== null) {
    const txt = s.slice(last, m.index).trim();
    if (txt) out += "<span>" + _dtCmpEsc(txt) + "</span>";
    if (m[1] !== undefined) {
      let f = m[1].trim();
      if (!/\.(png|jpe?g|webp|gif|svg)$/i.test(f)) f += ".png";
      out += '<img src="ImagesFiles/' + _dtCmpEsc(f) + '" alt="" draggable="false">';
    } else if (m[2] !== undefined) {
      out += '<span class="dt-cmp-op" style="opacity:' + Math.max(0, Math.min(100, parseFloat(m[2]))) / 100 + '">';
      open++;
    } else if (open > 0) {
      out += "</span>";
      open--;
    }
    last = re.lastIndex;
  }
  const tail = s.slice(last).trim();
  if (tail) out += "<span>" + _dtCmpEsc(tail) + "</span>";
  while (open-- > 0) out += "</span>";
  return '<span class="dt-cmp-val">' + out + "</span>";
}

function _dtCmpOpen() {
  const scr = _dtCmpScreen();
  if (!scr || _dtUi.isOpen()) return;
  const g = _dtCmpRt().globalVars;
  // Rows are re-read on every open (sales move daily); pictures are kept, so a
  // laptop seen once on the laptop screen also shows on the phone screen.
  _dtCmp.cache.clear();
  _dtCmp.noimg.clear();
  const list = _dtCmpList(scr.k);
  if (!list.length) return;
  const x = Math.max(0, Number(g.SubPage) - 1), y = Math.max(0, Number(g.DeviceShowFlagmanID) || 0);
  const left = list.find((e) => e.type === scr.k && e.x === x && e.y === y) || list.find((e) => e.type === scr.k && e.x === x) || list[0];
  const st = { list: list, sides: [left, _dtCmpLogic.partner(list, left)], diffOnly: false, menu: null };
  const m = _dtUi.modal({
    title: _dtCmpT("Compare"),
    dismiss: false,
    onClose: () => {
      _dtCmp.view = null;
      _dtCmpRedrawScreen();
    },
    build: (body, done, self) => {
      st.done = done;
    },
  });
  // A page of the My <Type> screen: the game's tab strip picks all rows or
  // only the differences, key hints along the bottom like "ESC  Back".
  const pg = _dtMdp.page(m);
  if (!document.getElementById("dt-cmp-css")) {
    const css = document.createElement("style");
    css.id = "dt-cmp-css";
    css.textContent = _DT_CMP_CSS;
    document.head.appendChild(css);
  }
  st.body = pg.body;
  _dtMdp.strip(pg.body, [{ id: "all", label: _dtCmpT("All specs") }, { id: "diff", label: _dtCmpT("Differences only") }], "all", (id) => {
    st.diffOnly = id === "diff";
    _dtCmpRender(st, true);
  });
  st.top = _dtUi.el("div", "dt-cmp-top", pg.body);
  st.scroll = _dtUi.el("div", "dt-cmp-scroll dt-mdp-scroll", pg.body);
  _dtMdp.back(pg.keys);
  _dtMdp.key(pg.keys, "S", _dtCmpT("Swap sides"), () => _dtCmpSwap(st));
  _dtCmp.view = st;
  _dtCmpRender(st);
}

function _dtCmpSwap(st) {
  try { globalThis.tapMain && globalThis.tapMain(); } catch (e) {}
  st.sides.reverse();
  _dtCmpRender(st, true);
}

function _dtCmpSide(st, i) {
  const e = st.sides[i];
  const t = _dtCmpTypeOf(e.type);
  const box = _dtUi.el("div", "dt-cmp-dev");
  const idx = st.list.indexOf(e);
  const arrow = (dir) => {
    const a = _dtUi.el("div", "dt-cmp-arrow" + ((dir < 0 ? idx <= 0 : idx >= st.list.length - 1) ? " dt-off" : ""), null);
    a.innerHTML = dir < 0 ? _DT_CMP_ARROW_L : _DT_CMP_ARROW_R;
    a.title = _dtCmpT(dir < 0 ? "Previous device" : "Next device");
    a.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const n = st.list[idx + dir];
      if (!n) return;
      try { globalThis.tapMain && globalThis.tapMain(); } catch (err) {}
      st.sides[i] = n;
      _dtCmpRender(st);
    });
    return a;
  };
  const pic = _dtUi.el("div", "dt-cmp-pic");
  pic.innerHTML = _dtCmpIcon(e.type);
  const who = _dtUi.el("div", "dt-cmp-who");
  const name = _dtUi.el("div", "dt-cmp-name", who, e.name);
  name.title = _dtCmpT("Pick a device");
  name.addEventListener("click", (ev) => {
    ev.stopPropagation();
    _dtCmpMenu(st, i, name);
  });
  const year = _dtCmpYear(e);
  _dtUi.el("div", "dt-cmp-sub", who, _dtCmpT(t.name) + " · " + (e.released ? year || e.date : _dtCmpT("Not released")));
  // Each side reads arrow, picture, name, arrow: its own picker sits round its own device.
  box.appendChild(pic);
  const row = _dtUi.el("div", "dt-cmp-row", box);
  row.appendChild(arrow(-1));
  row.appendChild(who);
  row.appendChild(arrow(1));
  _dtCmpImage(e).then((url) => {
    if (url && pic.isConnected) pic.innerHTML = '<img alt="" draggable="false" src="' + url + '">';
  });
  return box;
}

function _dtCmpMenuClose(st) {
  if (!st.menu) return;
  st.menu.el.remove();
  st.menu.off();
  st.menu = null;
}
function _dtCmpMenu(st, i, anchor) {
  if (st.menu) {
    const same = st.menu.side === i;
    _dtCmpMenuClose(st);
    if (same) return;
  }
  const card = st.body.closest(".dt-card");
  const el = _dtUi.el("div", "dt-cmp-list", card);
  const cr = card.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
  const w = el.getBoundingClientRect().width || 300;
  el.style.left = Math.max(8, Math.min(cr.width - w - 8, ar.left - cr.left + ar.width / 2 - w / 2)) + "px";
  el.style.top = ar.bottom - cr.top + 8 + "px";
  let type = "";
  let on = null;
  for (const e of st.list) {
    if (e.type !== type) {
      type = e.type;
      _dtUi.el("div", "dt-cmp-list-h", el, _dtCmpT(_dtCmpTypeOf(type).name));
    }
    const it = _dtUi.el("div", "dt-cmp-list-i" + (e === st.sides[i] ? " dt-on" : ""), el);
    _dtUi.el("span", "", it, e.name);
    _dtUi.el("span", "", it, e.released ? _dtCmpYear(e) || e.date : _dtCmpT("Not released"));
    if (e === st.sides[i]) on = it;
    it.addEventListener("click", (ev) => {
      ev.stopPropagation();
      try { globalThis.tapMain && globalThis.tapMain(); } catch (err) {}
      st.sides[i] = e;
      _dtCmpMenuClose(st);
      _dtCmpRender(st);
    });
  }
  // A press anywhere else on the screen closes the list (the name toggles it itself).
  const dim = card.parentNode;
  const away = (ev) => {
    if (el.contains(ev.target) || anchor.contains(ev.target)) return;
    if (st.menu && st.menu.el === el) _dtCmpMenuClose(st);
  };
  dim.addEventListener("pointerdown", away, true);
  st.menu = { el: el, side: i, off: () => dim.removeEventListener("pointerdown", away, true) };
  if (on) el.scrollTop = Math.max(0, on.offsetTop - 80);
}

function _dtCmpRender(st, keepScroll) {
  _dtCmpMenuClose(st);
  const pos = keepScroll ? st.scroll.scrollTop : 0;
  st.top.innerHTML = "";
  st.top.appendChild(_dtCmpSide(st, 0));
  _dtUi.el("div", "dt-cmp-vs", st.top, "VS");
  st.top.appendChild(_dtCmpSide(st, 1));
  const [a, b] = st.sides;
  const secs = _dtCmpLogic.merge(_dtCmpPages(a), _dtCmpPages(b));
  // Reading the pages runs the game's own table code: put its screen back.
  _dtCmpRedrawScreen();
  const same = a === b;
  let html = '<table class="dt-cmp-table dt-mdp-table' + (st.anim === false ? "" : " dt-mdp-anim") + '"><tbody>';
  let shown = 0;
  for (const sec of secs) {
    let rows = "";
    for (const r of sec.rows) {
      if (r.kind === "gap") { rows += '<tr class="dt-cmp-gap"><td colspan="3"></td></tr>'; continue; }
      if (r.kind === "sub") { rows += '<tr class="dt-cmp-subh"><td colspan="3">' + _dtCmpCell(r.label) + "</td></tr>"; continue; }
      const c = r.cmp || { side: "", tone: "", text: "" };
      if (st.diffOnly && !c.tone) continue;
      const cell = (v, side) => {
        if (v == null) return '<td class="dt-cmp-v dt-missing">—</td>';
        let cls = "dt-cmp-v";
        let badge = "";
        if (c.tone === "differ") cls += " dt-differ";
        if (c.side === side) {
          if (c.tone === "better") cls += " dt-better";
          if (c.text) badge = '<span class="dt-cmp-badge' + (c.tone === "neutral" ? " dt-neutral" : "") + '">' + _dtCmpEsc(_dtCmpT(c.text)) + "</span>";
        }
        return '<td class="' + cls + '">' + _dtCmpCell(v) + badge + "</td>";
      };
      rows += '<tr style="--d:' + Math.min(shown, 14) * 0.03 + 's">' + cell(r.l, "l") + '<td class="dt-cmp-lab dt-mdp-lab">' + _dtCmpCell(r.label) + "</td>" + cell(r.r, "r") + "</tr>";
      shown++;
    }
    if (st.diffOnly) rows = rows.replace(/^(<tr class="dt-cmp-gap">.*?<\/tr>)+/, "");
    if (!/<td class="dt-cmp-v/.test(rows) && !/dt-cmp-subh/.test(rows)) continue;
    if (st.diffOnly && !/<td class="dt-cmp-v/.test(rows)) continue;
    html += '<tr class="dt-cmp-sec"><td colspan="3">' + _dtCmpEsc(_dtCmpT(sec.name)) + "</td></tr>" + rows;
  }
  html += "</tbody></table>";
  if (!shown || same) html = '<div class="dt-cmp-empty">' + _dtCmpT(same ? "Both sides show the same device." : st.diffOnly ? "No differences: these two are the same on every row." : "Nothing to compare.") + "</div>";
  st.scroll.innerHTML = html;
  st.scroll.scrollTop = pos;
}

// ── Entry button on the My <Type> screens ──
function _dtCmpTick() {
  // A load or New Game (both pass LOADING GAME, as Launch and Queue reset there):
  // device ids restart in every save, so forget the last save's pictures.
  let lay = "";
  try { lay = String(_dtCmpRt().layout.name || ""); } catch (e) {}
  if (lay === "LOADING GAME") {
    _dtCmp.imgs.clear();
    _dtCmp.noimg.clear();
  }
  const scr = _dtCmpScreen();
  let show = false;
  if (scr && !_dtUi.isOpen()) {
    const a = _dtCmpArr(scr.arr);
    const g = _dtCmpRt().globalVars;
    show = !!(a && a.width > 0) && String(g.class || "") === scr.cls;
  }
  if (_dtCmp.view && !scr) _dtUi.close(true);
  // The game resizes its canvas after the window's resize event: follow it here.
  if (_dtCmp.view || _dtCmp.btn) _dtUi.fit();
  if (!show) {
    if (_dtCmp.btn) {
      _dtCmp.btn.remove();
      _dtCmp.btn = null;
    }
    return;
  }
  if (_dtCmp.btn && _dtCmp.btn.isConnected) return;
  const layer = _dtUi.ensure();
  _dtUi.fit();
  if (!document.getElementById("dt-cmp-css")) {
    const st = document.createElement("style");
    st.id = "dt-cmp-css";
    st.textContent = _DT_CMP_CSS;
    document.head.appendChild(st);
  }
  const b = _dtUi.el("div", "dt-cmp-btn", layer);
  _dtUi.el("div", "dt-cmp-key", b, "C");
  _dtUi.el("span", "", b, _dtCmpT("Compare"));
  b.title = _dtCmpT("Compare two devices side by side (C)");
  b.addEventListener("pointerover", () => { try { globalThis.tapHover && globalThis.tapHover(); } catch (e) {} });
  b.addEventListener("click", (ev) => {
    ev.stopPropagation();
    try { globalThis.tapMain && globalThis.tapMain(); } catch (e) {}
    _dtCmpOpen();
  });
  _dtCmp.btn = b;
}
function _dtCmpKey_(ev) {
  if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (_dtCmp.view) {
    if ((ev.key === "s" || ev.key === "S") && !_dtCmp.view.menu) {
      ev.preventDefault();
      _dtCmpSwap(_dtCmp.view);
      return;
    }
    if (ev.key === "Escape") {
      ev.preventDefault();
      if (_dtCmp.view.menu) {
        _dtCmpMenuClose(_dtCmp.view);
      } else {
        try { globalThis.tapBack && globalThis.tapBack(); } catch (e) {}
        _dtUi.close();
      }
    }
    return;
  }
  if ((ev.key === "c" || ev.key === "C") && _dtCmp.btn && _dtCmp.btn.isConnected && !_dtUi.isOpen()) {
    const tag = ev.target && ev.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    ev.stopPropagation();
    _dtCmpOpen();
  }
}
(function () {
  if (_dtCmp.wired || typeof document === "undefined") return;
  _dtCmp.wired = true;
  // Capture phase, so Escape closes the compare screen and never reaches the
  // game's own Back on the screen underneath.
  document.addEventListener("keydown", (ev) => {
    const open = !!_dtCmp.view;
    _dtCmpKey_(ev);
    if (open) ev.stopPropagation();
  }, true);
  // The shared mod timer (ui.js every) when ui.js is in; a timer of our own without it.
  _dtCmp.timer = (typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(() => {
    try { _dtCmpTick(); } catch (e) {}
  }, 250);
  globalThis._dtCompareApi = { open: _dtCmpOpen, list: _dtCmpList, pages: _dtCmpPages, image: _dtCmpImage, logic: _dtCmpLogic, state: () => _dtCmp.view };
})();
