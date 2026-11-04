// Runtime test for rivals-ui.js: toast caps, wording, the Board "Rivals" tab
// (rows, the icon column, the "M  Only my types" key, empty and Original states) on a fake
// runtime, a fake rivals API (design section 8A) and a tiny fake DOM.
// Usage: node test_rivals_ui_runtime.js [rivals-ui.js]
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const UI = process.argv[2] || path.join(__dirname, "rivals-ui.js");

// ── Tiny DOM: enough for el/button/innerHTML/classList/style ──
class Node {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.className = ""; this.children = []; this.parent = null;
    this.textContent = ""; this._html = ""; this.style = { display: "" }; this.scrollTop = 0; this.scrollLeft = 0;
    this.id = ""; this.title = ""; this.handlers = {};
    const self = this;
    this.classList = {
      add: (c) => { if (!self.classList.contains(c)) self.className = (self.className + " " + c).trim(); },
      contains: (c) => self.className.split(/\s+/).includes(c),
      toggle: (c, on) => { if (on === undefined) on = !self.classList.contains(c); if (on) self.classList.add(c); else self.className = self.className.split(/\s+/).filter((x) => x !== c).join(" "); },
    };
  }
  get isConnected() { let n = this; while (n.parent) n = n.parent; return n === doc.root; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  insertBefore(c, ref) { c.parent = this; const i = this.children.indexOf(ref); this.children.splice(i < 0 ? this.children.length : i, 0, c); return c; }
  set innerHTML(h) { this._html = h; for (const c of this.children) c.parent = null; this.children = []; this.textContent = ""; }
  get innerHTML() { return this._html; }
  addEventListener(n, fn) { (this.handlers[n] = this.handlers[n] || []).push(fn); }
  click() { for (const fn of this.handlers.click || []) fn({ stopPropagation() {}, target: this }); }
  // Text of the whole subtree (textContent + innerHTML with tags stripped).
  text() { return [this.textContent, this._html.replace(/<[^>]+>/g, " ")].concat(this.children.map((c) => c.text())).join(" ").replace(/\s+/g, " ").trim(); }
  all(cls) { const out = []; const walk = (n) => { if (n.classList.contains(cls)) out.push(n); n.children.forEach(walk); }; walk(this); return out; }
}
const doc = { root: new Node("html"), head: null, body: null,
  createElement: (t) => new Node(t), getElementById: (id) => doc.byId(doc.root, id), addEventListener() {},
  byId(n, id) { if (n.id === id) return n; for (const c of n.children) { const f = doc.byId(c, id); if (f) return f; } return null; } };
doc.head = doc.root.appendChild(new Node("head"));
doc.body = doc.root.appendChild(new Node("body"));

// ── Fake game, API and _dtUi ──
class Arr {
  constructor(w, h, d) { this.width = w; this.height = h; this.depth = d; this.c = new Map(); }
  getAt(x, y, z) { const k = x + "," + y + "," + z; return this.c.has(k) ? this.c.get(k) : 0; }
  setAt(v, x, y, z) { this.c.set(x + "," + y + "," + z, v); }
}
const D = (y, m, d) => (y - 2008) * 365 + [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][m - 1] + d;

function world(opts) {
  opts = opts || {};
  const gv = { DayTotal: opts.day || D(2020, 7, 1), SaveSlot: 0, CompanyName: "Ember", LanguageChoose: 0 };
  const phones = new Arr(2, 3, 12);
  for (let x = 0; x < 2; x++) for (let y = 0; y < 3; y++) phones.setAt(-1, x, y, 0);
  // Ember 6 released Jan 2020 (the player's newest phone).
  if (opts.phone !== false) {
    const v = [1e6, 1e5, 80, 300, 449, 8, 0, D(2020, 1, 10), "Ember 6", "10.01.2020", 6];
    v.forEach((val, z) => phones.setAt(val, 0, 0, z));
  }
  const objects = { ArraySmartphones: { getFirstInstance: () => phones } };
  const toasts = [];
  const ui = {
    el(tag, cls, parent, text) { const n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; if (parent) parent.appendChild(n); return n; },
    button(parent, label, cls, onClick) { const b = ui.el("div", "dt-btn" + (cls ? " " + cls : ""), parent, label); b.addEventListener("click", () => onClick && onClick()); return b; },
    gv: (n, d) => (gv[n] === undefined ? d : gv[n]), num: (n, d) => { const v = Number(gv[n]); return Number.isFinite(v) ? v : d; },
    t: (e) => e.en, toast: (text, key) => toasts.push({ text, key }), onOffice: () => !gv.__away,
  };
  const subs = [];
  const api = { launches: opts.launches || [], on: opts.on !== false,
    list() { return this.launches; }, launchesSince(d) { return this.launches.filter((l) => l.day > d); },
    onLaunch(fn) { subs.push(fn); }, state() { return { on: this.on, reason: this.on ? "ok" : "original" }; } };
  const ctx = { console, Math, Number, String, Map, Set, Array, Object, JSON, isFinite, isNaN, Error, RegExp,
    document: doc, setInterval: () => 1, runtime: { objects, globalVars: gv }, _dtUi: ui, _dtRivApi: api,
    _dtRivCore: { RIV: { LINES: [{ id: "nokya-phone", co: "Nokya", type: "phone", from: 2008, to: 2015 },
      { id: "nokya-hmd", co: "Nokya", type: "phone", from: 2017, to: 2023 }] } } };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  // The page look the Board brings (icon column, key hints).
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../mods-ui/mdpage.js"), "utf8"), ctx, { filename: "mdpage.js" });
  vm.runInContext(fs.readFileSync(UI, "utf8"), ctx, { filename: "rivals-ui.js" });
  const R = ctx._dtRivUiApi;
  R.tick(); // subscribes, sets the owner
  const emit = (ev) => { for (const fn of subs) fn(ev); };
  return { ctx, gv, api, R, toasts, emit, subs, phones };
}
// A launch as rivals.js reports it (flat fields; labels as the game's lists name them).
function launch(id, day, o) {
  o = o || {};
  const L = Object.assign({ id: id + "@" + day, line: id, day: day, co: "Samsong", model: "Stellar S" + (day % 50), type: "phone",
    tier: "flag", arch: "leader", price: 1029, specs: ["90 Hz", "24 MP", "10 GB RAM", "256 GB", "5G"], rows: [3, 10, 8, 6, 12] }, o);
  // rivals.js shape (round9/RIVALS-API.md): name, specs as {label, row, table} or null.
  L.name = L.model;
  delete L.model;
  L.specs = L.specs.map((s, i) => (s === null ? null : { label: s, row: L.rows[i], table: "T" + i }));
  return L;
}
// Play: each event on its own day, a tick between (normal speed).
function play(w, evs) {
  for (const ev of evs) {
    w.gv.DayTotal = ev.day;
    w.emit(ev);
    w.R.tick();
  }
}
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log("ok -", name); };

test("formatting: dates, money, spec cells", () => {
  const W = world(), L = W.R.logic;
  assert.equal(L.dateLabel(1), "Jan 2008");
  assert.equal(L.dateLabel(D(2020, 6, 15)), "Jun 2020");
  assert.equal(L.dateLabel(D(2019, 12, 31)), "Dec 2019");
  assert.equal(L.dateLabel(D(2014, 10, 2), W.R.ru.months), "Окт 2014");
  assert.equal(L.ruUnit("4", "cores"), "ядра");
  assert.equal(L.ruUnit("12", "cores"), "ядер");
  assert.equal(L.ruUnit("1", "cores"), "ядро");
  assert.equal(L.ruUnit("60", "Hz"), "Hz");
  assert.equal(L.phrase("6 cores", W.R.ru), "6\u00a0ядер");
  assert.equal(L.phrase("2-core controller", W.R.ru), "2\u00a0ядра");
  assert.equal(L.phrase("10 h battery", W.R.ru), "10\u00a0ч работы");
  assert.equal(L.phrase("12 MP", W.R.ru), "12\u00a0MP камера");
  assert.equal(L.phrase("6 cores", {}), "6\u00a0cores");
  assert.equal(L.money(1029), "$1 029");
  assert.equal(L.money(1029, " "), "$1 029");
  const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
  same(L.cell("8 GB RAM"), { n: "8", u: "GB RAM" });
  same(L.cell("90 Hz"), { n: "90", u: "Hz" });
  same(L.cell("17900 GFLOPS"), { n: "17 900", u: "GFLOPS" });
  same(L.cell("4K UHD (3840×2160)"), { t: "4K UHD" });
  same(L.cell("4G LTE"), { t: "4G LTE" });
  same(L.cell("Bluetooth 5.2"), { n: "5.2", u: "BT" });
  same(L.cell("4-core controller"), { n: "4", u: "cores" });
  same(L.cell("12.8 Ah battery"), { n: "12.8", u: "Ah" });
  same(L.cell("0.96 ms"), { n: "0.96", u: "ms" });
  same(L.cell("1832 px per eye"), { n: "1 832", u: "px" });
  assert.equal(L.cell(null), null);
});

test("toast wording: leader unveils, others launch, units never wrap alone, <= 120 chars", () => {
  const w = world({ day: D(2020, 6, 1) });
  play(w, [launch("s", D(2020, 6, 5), { arch: "follower", model: "Stellar S5" })]);
  play(w, [launch("o", D(2020, 7, 20), { co: "Appel", model: "Orchard 17", price: 1109, specs: ["120 Hz", "48 MP", "8 GB RAM"] })]);
  assert.equal(w.toasts.length, 2);
  assert.equal(w.toasts[0].text, "Samsong launches the Stellar S5: 90 Hz, 24 MP camera, 10 GB RAM. $1 029.");
  assert.equal(w.toasts[0].key, "Stellar S5");
  assert.equal(w.toasts[1].text, "Appel unveils the Orchard 17 at $1 109: 120 Hz, 48 MP camera, 8 GB RAM.");
  const L = w.R.logic;
  const long = L.toastText(L.norm(launch("x", 9000, { model: "Very Long Model Name Ultra Max Pro Plus Edition", specs: ["4K UHD Ultra Premium (3840×2160)", "Regenerative Smart Brake System", "LTPO OLED 2.0 Pro Display", "x"] })), w.R.text);
  assert.ok(long.text.length <= 120, long.text);
  assert.match(long.text, /Very Long Model Name/);
});

test("off the office screens toasts wait for the office; stale ones drop", () => {
  const w = world({ day: D(2020, 6, 1) });
  w.gv.__away = true;
  play(w, [launch("s", D(2020, 6, 5), { arch: "follower", model: "Stellar S5" })]);
  assert.equal(w.toasts.length, 0);
  w.gv.__away = false; w.R.tick();
  assert.deepEqual(w.toasts.map((t) => t.key), ["Stellar S5"]);
  w.gv.__away = true;
  play(w, [launch("o", D(2020, 7, 20), { co: "Appel", model: "Orchard 17" })]);
  w.gv.DayTotal = D(2020, 8, 20); w.R.tick(); w.gv.__away = false; w.R.tick();
  assert.equal(w.toasts.length, 1, "a month-old launch is not news");
});
test("on the office with the creator, a card, pause or another class open, toasts wait (queue kept)", () => {
  for (const [k, v, off] of [["CreateDevicesUI", "ON", "OFF"], ["Assistant", "ON", "OFF"], ["GameplayPause", 1, 0], ["class", "CREATE", "GAMEPLAY"]]) {
    const w = world({ day: D(2020, 6, 1) });
    w.gv[k] = v;
    play(w, [launch("s", D(2020, 6, 5), { arch: "follower", model: "Stellar S5" })]);
    assert.equal(w.toasts.length, 0, k);
    w.gv[k] = off; w.R.tick();
    assert.deepEqual(w.toasts.map((t) => t.key), ["Stellar S5"], k);
  }
});
test("caps: 1 a game week, 2 a game month; next month toasts again", () => {
  const w = world({ day: D(2020, 3, 1) });
  play(w, [launch("a", D(2020, 3, 2)), launch("b", D(2020, 3, 5)), launch("c", D(2020, 3, 11)), launch("d", D(2020, 3, 25)),
    launch("e", D(2020, 4, 2))]);
  assert.deepEqual(w.toasts.map((t) => t.key), ["Stellar S" + (D(2020, 3, 2) % 50), "Stellar S" + (D(2020, 3, 11) % 50), "Stellar S" + (D(2020, 4, 2) % 50)]);
  // A whole year of launches every 3 days: never more than 2 in any month, never 2 within 7 days.
  const w2 = world({ day: D(2021, 1, 1) });
  const evs = [];
  for (let d = D(2021, 1, 2); d < D(2022, 1, 1); d += 3) evs.push(launch("y", d, { model: "Y" + d }));
  play(w2, evs);
  const days = w2.toasts.map((t) => Number(t.key.slice(1)));
  const byMonth = {};
  for (const d of days) byMonth[w2.R.logic.monthKey(d)] = (byMonth[w2.R.logic.monthKey(d)] || 0) + 1;
  assert.ok(Object.values(byMonth).every((n) => n <= 2), JSON.stringify(byMonth));
  for (let i = 1; i < days.length; i++) assert.ok(days[i] - days[i - 1] >= 7);
  assert.ok(w2.toasts.length >= 20 && w2.toasts.length <= 24, String(w2.toasts.length));
});

test("only flagship/mid launches of leaders and followers in unlocked types; returns always", () => {
  const w = world({ day: D(2014, 1, 1) });
  play(w, [
    launch("budgetArch", D(2014, 1, 3), { arch: "budget" }),
    launch("budgetTier", D(2014, 1, 12), { tier: "budget", arch: "follower" }),
    launch("newcomer", D(2014, 1, 21), { arch: "newcomer" }),
    launch("watch", D(2014, 2, 3), { type: "watch" }), // watches unlock on day 2549 (2014-12)
  ]);
  assert.equal(w.toasts.length, 0);
  play(w, [launch("mid", D(2014, 3, 3), { tier: "mid", arch: "follower", model: "Mid 1" }),
    launch("back", D(2014, 4, 3), { co: "Nokya", model: "Nokya G10", price: 269, arch: "budget", tier: "mid", first: true, line: "nokya-hmd", year: 2017 })]);
  assert.deepEqual(w.toasts.map((t) => t.text), ["Samsong launches the Mid 1: 90 Hz, 24 MP camera, 10 GB RAM. $1 029.",
    "Nokya is back with the Nokya G10 at $269."]);
  play(w, [launch("last", D(2014, 5, 3), { co: "ELG", model: "Optima G9", arch: "follower", tier: "flag", last: true }),
    launch("new", D(2014, 6, 3), { co: "OnePluss", model: "OnePluss 1", arch: "newcomer", price: 299, first: true, line: "onepluss-phone" }),
    launch("old", D(2014, 7, 3), { co: "Appel", model: "Orchard 2", year: 2008, first: true, line: "appel-phone" })]);
  assert.deepEqual(w.toasts.slice(2).map((t) => t.text), ["ELG launches its last phone, the Optima G9.",
    "OnePluss enters the phone business with the OnePluss 1 at $299.",
    "Appel unveils the Orchard 2 at $1\u00A0029: 90\u00A0Hz, 24\u00A0MP camera, 10\u00A0GB RAM."]); // there since 2008: a plain launch
  // A line that was there from the start (2008) is no "entry" news.
  const L = w.R.logic;
  assert.equal(L.newsworthy(L.norm({ day: 300, co: "Nokya", type: "phone", tier: "flag", arch: "fading", first: true, line: "nokya-phone" }, []), 300), false);
  play(w, [{ kind: "exit", day: D(2014, 8, 3), co: "ELG", type: "phone" }]);
  assert.equal(w.toasts[5].text, "ELG leaves the phone business.");
});

test("'looks dated': only a hit >= 0.2 POP a day, at most 1 a game month, keyword = your device", () => {
  const w = world({ day: D(2020, 3, 1) });
  play(w, [launch("a", D(2020, 3, 2), { hits: [{ name: "Ember 6", x: 0.1 }] })]);
  assert.equal(w.toasts.length, 1);
  play(w, [launch("b", D(2020, 4, 2), { hits: [{ name: "Ember 5", x: 0.25 }, { name: "Ember 6", x: 0.4 }] })]);
  assert.equal(w.toasts.length, 3);
  assert.equal(w.toasts[2].text, "Your Ember 6 looks dated next to the Stellar S" + (D(2020, 4, 2) % 50) + ". Sales may dip for a few weeks.");
  assert.equal(w.toasts[2].key, "Ember 6");
  play(w, [{ kind: "dated", day: D(2020, 4, 20), dev: "Ember 6", model: "Pixon 4", x: 0.5 }]);
  assert.equal(w.toasts.length, 3);
  play(w, [{ kind: "dated", day: D(2020, 5, 2), dev: "Ember 6", model: "Pixon 4", x: 0.5 }]);
  assert.equal(w.toasts.length, 4);
});

test("day jump: many launches at once collapse to the newest 2", () => {
  const w = world({ day: D(2020, 1, 1) });
  const evs = [launch("a", D(2020, 1, 5)), launch("b", D(2020, 1, 20)), launch("c", D(2020, 2, 5)), launch("d", D(2020, 2, 20)), launch("e", D(2020, 3, 5))];
  w.gv.DayTotal = D(2020, 3, 6);
  for (const e of evs) w.emit(e);
  w.R.tick();
  assert.deepEqual(w.toasts.map((t) => t.key), ["Stellar S" + (D(2020, 2, 20) % 50), "Stellar S" + (D(2020, 3, 5) % 50)]);
});

test("Original: no toasts; a new save or company starts the caps again", () => {
  const w = world({ on: false, day: D(2020, 7, 1) });
  play(w, [launch("a", D(2020, 7, 2))]);
  assert.equal(w.toasts.length, 0);
  const w2 = world({ day: D(2020, 3, 1) });
  play(w2, [launch("a", D(2020, 3, 2)), launch("b", D(2020, 3, 11))]);
  assert.equal(w2.toasts.length, 2);
  w2.gv.CompanyName = "Other";
  w2.R.tick();
  play(w2, [launch("c", D(2020, 3, 14))]);
  assert.equal(w2.toasts.length, 3);
});

function pane() {
  return doc.body.appendChild(new Node("div"));
}
// The Board's key-hint row ("ESC  Back" ...), where the tab adds "M  Only my types".
function keys() {
  return doc.body.appendChild(new Node("div"));
}
const icons = (p) => p.all("dt-mdp-icons")[0].children;
const LOG = [
  // Market before Ember 6 (Jan 2020): best phone rows [3, 10, 8, 6, 12].
  launch("old", D(2019, 9, 10), { co: "Appel", model: "Orchard 11", rows: [3, 10, 8, 6, 12] }),
  launch("s11", D(2020, 6, 5), { model: "Stellar S11", rows: [4, 10, 9, 6, 12] }), // beats on Hz and RAM
  launch("o17", D(2020, 5, 10), { co: "Appel", model: "Orchard 17", rows: [3, 9, 8, 6, 12] }), // beats nothing
  launch("tab", D(2020, 4, 3), { co: "Appel", model: "Orchard Pad Air 5", type: "tablet", tier: "mid", specs: ["QXGA (2048×1536)", "60 Hz", "6 GB RAM", "128 GB"], rows: [5, 1, 6, 6] }),
  launch("lap", D(2020, 2, 3), { co: "Lemovo", model: "ThinkBook 14", type: "laptop", tier: "mid", price: 1299, specs: ["8 cores", "16 GB RAM", "512 GB SSD", "60 Hz"], rows: [4, 5, 3, 0] }),
  launch("ancient", D(2018, 5, 3), { model: "Stellar S9" }), // older than 24 game months
];

test("tab: rows newest first, last 24 game months, ▲ only where it beats your newest device's market", () => {
  const w = world({ launches: LOG });
  const p = pane();
  w.R.render(p);
  const rows = p.all("dt-board-scroll")[0].innerHTML.split('<div class="dt-board-row').slice(1);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map((r) => /dt-board-name">([^<]+)</.exec(r)[1]), ["Stellar S11", "Orchard 17", "Orchard Pad Air 5", "ThinkBook 14", "Orchard 11"]);
  assert.match(rows[0], /Jun 2020/);
  assert.match(rows[0], /Newer than yours/);
  assert.equal((rows[0].match(/dt-rv-beat/g) || []).length, 2);
  assert.match(rows[0], /dt-rv-spec dt-rv-beat" title="90 Hz">90<small>Hz<\/small>/);
  assert.match(rows[0], /Samsong · Phone · Flagship/);
  assert.match(rows[0], /\$1 029/);
  assert.doesNotMatch(rows[1], /Newer than yours|dt-rv-beat/);
  assert.doesNotMatch(rows[4], /dt-rv-beat/); // came out before your device
  assert.doesNotMatch(rows[2], /dt-rv-beat/); // no tablet of yours
  assert.match(rows[2], /title="QXGA \(2048×1536\)">QXGA</);
  assert.equal((rows[3].match(/class="dt-rv-spec"><\/div>/g) || []).length, 1); // 4 specs: one empty cell, no dash
  assert.match(p.text(), /5 launches in the last 24 game months/);
  assert.match(p.all("dt-rv-head")[0].text(), /Date Device Price Specs/);
  assert.ok(p.all("dt-rv-head")[0].children[0].classList.contains("dt-on"));
});

test("icon column: only unlocked types in game order, All first; one type names its spec columns", () => {
  const w = world({ launches: LOG, day: D(2013, 1, 1) });
  const p = pane();
  w.R.render(p);
  assert.deepEqual(icons(p).map((c) => c.title), ["All", "Phones", "Laptops", "Tablets", "TVs", "Consoles"]);
  w.gv.DayTotal = D(2020, 7, 1);
  w.R.render(p);
  const chips = icons(p);
  assert.deepEqual(chips.map((c) => c.title), ["All", "Phones", "Laptops", "Tablets", "Headphones", "Watches", "TVs", "Scooters", "Keyboards", "Consoles", "VR"]);
  assert.ok(chips[0].classList.contains("dt-on"));
  chips[3].click(); // Tablets
  const rows = p.all("dt-board-scroll")[0].innerHTML.split('<div class="dt-board-row').slice(1);
  assert.equal(rows.length, 1);
  assert.equal(p.all("dt-rv-head")[0].all("dt-rv-specs")[0].children.map((c) => c.textContent).join("|"), "Display|Screen|RAM|Storage|");
  assert.ok(icons(p)[3].classList.contains("dt-on"));
  icons(p)[5].click(); // Watches: none yet
  assert.match(p.text(), /No rival watch launches in the last 24 game months\. Rivals launch a few devices a month/);
  assert.equal(p.all("dt-mdp-icons").length, 1); // column still shown
  icons(p)[0].click();
});

test("'Only my types' keeps your types; empty and Original states", () => {
  const w = world({ launches: LOG });
  const p = pane(), k = keys();
  w.R.render(p, { keys: k });
  const mine = () => k.all("dt-rv-minekey");
  assert.equal(mine().length, 1);
  assert.match(mine()[0].text(), /^M Only my types$/);
  mine()[0].click();
  assert.equal(mine().length, 1); // the same key, not a second one
  assert.ok(mine()[0].classList.contains("dt-on"));
  const rows = p.all("dt-board-scroll")[0].innerHTML.split('<div class="dt-board-row').slice(1);
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => /· Phone ·/.test(r)));
  icons(p)[2].click(); // Laptops, only yours: hidden by the filter, and the text says so
  assert.match(p.text(), /No rival launches in your types in the last 24 game months\. Turn off “Only my types” to see every type\./);
  mine()[0].click();
  assert.ok(!mine()[0].classList.contains("dt-on"));
  assert.equal(p.all("dt-board-scroll")[0].innerHTML.split('<div class="dt-board-row').length - 1, 1);
  icons(p)[0].click();
  const none = world({ launches: [] });
  const p2 = pane();
  none.R.render(p2);
  assert.equal(p2.all("dt-mdp-icons").length, 1);
  assert.match(p2.text(), /^No rival launches yet\. Rivals launch a few devices a month; they show up here\.$/);
  const off = world({ launches: LOG, on: false });
  const p3 = pane();
  off.R.render(p3);
  assert.equal(p3.text(), "Rival companies are off on Original, the untouched game. Pick Realistic or Brutal in Difficulty to see them launch devices.");
  assert.equal(p3.all("dt-mdp-icons").length, 0);
  assert.equal(p3.all("dt-rv-head").length, 0);
});

test("rivals.js 'newer' wins over the fallback; null = no device of that type", () => {
  const w = world({ launches: [launch("a", D(2020, 6, 5), { model: "Pixon 5", newer: [false, true, false, false, false] }),
    launch("b", D(2020, 6, 1), { model: "Pixon 4", rows: [9, 9, 9, 9, 9], newer: null })] });
  const p = pane();
  w.R.render(p);
  const rows = p.all("dt-board-scroll")[0].innerHTML.split('<div class="dt-board-row').slice(1);
  assert.deepEqual(rows.map((r) => (r.match(/dt-rv-beat" title="([^"]+)"/g) || []).length), [1, 0]);
  assert.match(rows[0], /dt-rv-beat" title="24 MP"/);
});

test("open tab redraws on a new launch, keeping its scroll; closed tab stops", () => {
  const w = world({ launches: LOG.slice() });
  const p = pane();
  w.R.render(p);
  p.all("dt-board-scroll")[0].scrollTop = 40;
  w.api.launches.push(launch("new", D(2020, 6, 30), { model: "Pixon 5", co: "Gooqle" }));
  w.R.tick();
  const sc = p.all("dt-board-scroll")[0];
  assert.match(sc.innerHTML, /Pixon 5/);
  assert.equal(sc.scrollTop, 40);
  p.parent.children.splice(p.parent.children.indexOf(p), 1);
  p.parent = null;
  w.R.tick();
  assert.equal(w.R.state().view, null);
});

test("with rivals.js's version(): a new day alone does not redraw the tab; a new launch does", () => {
  const w = world({ launches: LOG.slice() });
  let reads = 0;
  w.api.version = () => w.api.launches.length + "|v";
  const list = w.api.list;
  w.api.list = function () { reads++; return list.call(this); };
  const p = pane();
  w.R.render(p);
  const sc = p.all("dt-board-scroll")[0];
  const before = reads;
  w.gv.DayTotal += 1;
  w.R.tick();
  w.gv.DayTotal += 1;
  w.R.tick();
  assert.equal(p.all("dt-board-scroll")[0], sc, "same pane contents, not rebuilt");
  assert.equal(reads, before, "launches read once, then cached");
  w.api.launches.push(launch("new2", w.gv.DayTotal, { model: "Pixon 6", co: "Gooqle" }));
  w.R.tick();
  assert.notEqual(p.all("dt-board-scroll")[0], sc);
  assert.match(p.all("dt-board-scroll")[0].innerHTML, /Pixon 6/);
});

test("Board registry: one 'Rivals' tab; EN and RU text; model names from core lines", () => {
  const w = world();
  const tabs = w.ctx._dtBoardTabs.filter((t) => t.id === "rivals");
  assert.equal(tabs.length, 1);
  assert.deepEqual([tabs[0].label.en, tabs[0].label.ru], ["Rivals", "Конкуренты"]);
  const all = JSON.stringify(w.R.text);
  assert.doesNotMatch(all, /[Ѐ-ӿ]/);
  // Every English line has a Russian one, with the same {slots}.
  const slots = (v) => (String(v).match(/\{\w+\}/g) || []).sort().join();
  for (const k of Object.keys(w.R.text)) {
    assert.ok(k in w.R.ru, "ru has " + k);
    const e = w.R.text[k], r = w.R.ru[k];
    if (typeof e === "string") assert.equal(slots(r), slots(e), k);
    else for (const j of Object.keys(e)) assert.ok(r[j], "ru " + k + "." + j);
  }
  for (const t of Object.keys(w.ctx._DT_RV.HEADS)) assert.equal(w.R.ru.heads[t].length, w.ctx._DT_RV.HEADS[t].length, "ru heads " + t);
  const ruToast = w.R.logic.toastText(w.R.logic.norm(launch("r", 9000, { co: "Samsong", model: "Stellar S5", arch: "follower", specs: ["24 MP"] })), w.R.ru);
  assert.match(ruToast.text, /^Samsong выпускает /);
  assert.match(ruToast.text, /камера/);
  const L = w.R.logic;
  assert.equal(L.norm({ id: "x@2020", day: 5, n: 11, line: { co: "Samsong", type: "phone", tier: "flag", arch: "leader", stem: "Stellar S" } }).model, "Stellar S11");
  assert.equal(L.norm({ id: "x@2020", day: 5, n: 17, line: { stem: "Orchard" } }).model, "Orchard 17");
  assert.deepEqual(L.norm({ day: 5, specs: ["90 Hz", -1, null] }).specs, ["90 Hz", null, null]);
});

console.log(pass + " rivals-ui tests passed");
