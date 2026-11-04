// Runtime test for settings.js (Difficulty in the game's Settings page) with a fake page:
//   node test_settings_runtime.js difficulty.js settings.js
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

class El {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.parentNode = null;
    this.className = "";
    this.textContent = "";
    this.dataset = {};
    this.listeners = {};
    this.scrollTop = 0;
    this.offsetWidth = 1;
    this.id = "";
    const self = this;
    this.style = { setProperty(k, v) { this[k] = v; } };
    this.classList = {
      contains: (c) => self.className.split(/\s+/).includes(c),
      add: (c) => { if (!self.classList.contains(c)) self.className = (self.className + " " + c).trim(); },
      remove: (c) => { self.className = self.className.split(/\s+/).filter((x) => x && x !== c).join(" "); },
      toggle: (c, on) => { if (on === undefined) on = !self.classList.contains(c); on ? self.classList.add(c) : self.classList.remove(c); return on; },
    };
  }
  set innerHTML(v) { this.children = []; this._html = v; }
  get innerHTML() { return this._html || ""; }
  get nextSibling() { const c = this.parentNode.children; return c[c.indexOf(this) + 1] || null; }
  appendChild(n) { if (n.parentNode) n.parentNode.children.splice(n.parentNode.children.indexOf(n), 1); n.parentNode = this; this.children.push(n); return n; }
  insertBefore(n, ref) {
    if (n.parentNode) n.parentNode.children.splice(n.parentNode.children.indexOf(n), 1);
    n.parentNode = this;
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(n); else this.children.splice(i, 0, n);
    return n;
  }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  fire(t) { for (const f of this.listeners[t] || []) f({ stopPropagation() {} }); }
  matches(sel) {
    if (sel.startsWith("#")) return this.id === sel.slice(1);
    if (sel.startsWith(".")) return this.classList.contains(sel.slice(1));
    const m = /^\[data-([\w-]+)="([^"]*)"\]$/.exec(sel);
    return !!m && this.dataset[m[1]] === m[2];
  }
  all(sel, out = []) { for (const c of this.children) { if (c.matches(sel)) out.push(c); c.all(sel, out); } return out; }
  querySelector(sel) { return this.all(sel)[0] || null; }
  querySelectorAll(sel) { return this.all(sel); }
  text() { return this.textContent + this.children.map((c) => c.text()).join(""); }
}

// The game's Settings page parts, reduced to what settings.js relies on.
const GAME = `
var _container15 = null, _draft = null, _saved = null, _page = "general", footerSyncs = 0, applied = 0;
var rowCells = {};
function _el2(e, t, n) { const o = document.createElement(e); return t && (o.className = t), n && n.appendChild(o), o; }
function _t8(e) { return e === "defaults" ? "Defaults" : e; }
function _maskIcon(e, t, n) { const o = _el2("div", t, e); o.mask = n; return o; }
function _navItem(e, t, n, o, a) {
  const s = _el2("div", "gs-nav-item" + (_page === t ? " gs-nav-on" : ""), e);
  s.dataset.page = t; _maskIcon(s, "gs-nav-ic", o); _el2("div", "gs-nav-text", s).textContent = n;
  s.addEventListener("click", () => { _page !== t && ((_page = t), _renderNav(), _renderMain()); });
  return s;
}
function _renderNav() {
  const e = _container15.querySelector("#gs-nav"); e.children = [];
  _el2("div", "gs-nav-group", e).textContent = "Game";
  for (const p of ["general", "sound", "video"]) _navItem(e, p, p, {}, null);
  _el2("div", "gs-nav-group", e).textContent = "Assistant notifications";
  _navItem(e, "all", "All", {}, { on: 1, total: 2 });
}
function _renderMain(e) { const b = _container15.querySelector("#gs-main-body"); b.children = []; _el2("div", "game-page", b).textContent = _page; }
function _row14(e, t, n) { const o = _el2("div", "gs-row", e), a = _el2("div", "gs-row-label", o); _el2("div", "gs-row-name", a).textContent = t; n && (_el2("div", "gs-row-hint", a).textContent = n); return _el2("div", "gs-row-ctl", o); }
function _card(e) { return _el2("div", "gs-card", e); }
function _slider(e, t, n, o, a, s, r) {
  const i = _el2("div", "gs-slider", e), l = document.createElement("input");
  l.type = "range"; l.min = String(t); l.max = String(n); l.step = String(o); l.value = String(a); l.className = "gs-range"; i.appendChild(l);
  const c = _el2("div", "gs-slider-val", i), d = () => { c.textContent = String(Number(l.value)) + (s || ""); };
  d(); l.addEventListener("input", () => { d(); r(Number(l.value)); }); return l;
}
function _readAll() { _draft = { lang: 0, scroll: 10 }; _saved = Object.assign({}, _draft); }
function _isDirty() { return Object.keys(_draft).some((k) => _draft[k] !== _saved[k]); }
function _syncFooter() { footerSyncs++; }
function applyGameSettings() { applied++; _saved = Object.assign({}, _draft); return true; }
function _openSettings() {
  _container15 = document.createElement("div");
  for (const id of ["gs-nav", "gs-main-head", "gs-main-body"]) { const n = _el2("div", "", _container15); n.id = id; }
  _readAll(); _page = "general"; _renderNav(); _renderMain();
}
`;

const gv = { CompanyName: "Ember", SaveSlot: 1, LanguageChoose: 0 };
const layout = { name: "PROGRAMMER OFFICE 4" };
const saves = {
  width: 3, height: 200, cells: {},
  getAt(x, y) { return this.cells[x + "," + y] ?? 0; },
  setAt(v, x, y) { this.cells[x + "," + y] = v; },
};
const document = {
  createElement: (t) => new El(t),
  getElementById: () => null,
  head: new El("head"),
};
const ctx = {
  console: { log() {}, warn: (...a) => { throw new Error("warned: " + a.join(" ")); }, error() {} },
  setInterval() { return 0; }, clearInterval() {},
  document,
  runtime: {
    globalVars: gv, layout,
    objects: { ArraySaves: { getFirstInstance: () => saves }, ArrayRatingsCompanies: { getFirstInstance: () => null } },
  },
  _potentialUnits() { return 1; }, _compute4() { return {}; }, _tickNpcRow() { return 1; },
  setRatingsConfig(e) { return { NPC_MARKET_BASE_EARN_B: 10, NPC_MARKET_BASE_FANS_M: 10 }; },
  _companyName: (id) => "#" + id,
  _dtUi: {
    num(n, d) { const v = Number(gv[n]); return Number.isFinite(v) ? v : d; },
    gv(n, d) { const v = gv[n]; return v === undefined || v === null ? d : v; },
    layoutName: () => layout.name,
    onOffice: () => true,
    t(e, vars) { let s = e.en; for (const k in vars || {}) s = s.split("{" + k + "}").join(vars[k]); return s; },
  },
};
vm.createContext(ctx);
const src = GAME + "\n;\n" + process.argv.slice(2).map((f) => fs.readFileSync(f, "utf8")).join("\n;\n");
vm.runInContext(src, ctx, { filename: "settings-bundle.js" });
const run = (code) => vm.runInContext(code, ctx);
const page = () => run("_container15");
const body = () => page().querySelector("#gs-main-body");
const head = () => page().querySelector("#gs-main-head");
const segOn = () => body().querySelectorAll(".gs-seg-btn").filter((b) => b.classList.contains("gs-seg-on")).map((b) => b.text());
const sliders = () => body().querySelectorAll(".gs-range");
const vals = () => body().querySelectorAll(".gs-slider-val").map((v) => v.textContent + (v.classList.contains("dt-gs-ch") ? "*" : ""));
const row = () => saves.cells["1,150"];

// 1. In a loaded company: a "Tycoon+" group with Difficulty right after Video, before the notifications.
run("_openSettings()");
let nav = page().querySelector("#gs-nav").children.map((n) => n.text());
assert.deepEqual(nav, ["Game", "general", "sound", "video", "Tycoon+", "Difficulty", "Assistant notifications", "All"]);
const item = page().querySelector('[data-page="dt-difficulty"]');
assert.ok(item.classList.contains("gs-nav-item"), "the game's own nav item");
assert.deepEqual(run("[_draft.dtBuy, _draft.dtResearch, _saved.dtRivals]"), [1, 1, 1], "the draft holds the company's values");
assert.equal(run("_isDirty()"), false);

// 2. The page: the game's head, Defaults, a preset switch and five game sliders with the normal-value mark.
item.fire("click");
assert.equal(run("_page"), "dt-difficulty");
assert.match(head().text(), /^DifficultySaved with Ember · takes effect the next game day after you press ApplyDefaults$/);
assert.equal(body().querySelectorAll(".gs-card").length, 1);
assert.equal(body().querySelectorAll(".gs-row").length, 6);
assert.deepEqual(body().querySelectorAll(".gs-seg-btn").map((b) => b.text()), ["Original", "Realistic", "Brutal", "Custom"]);
assert.equal(body().querySelectorAll(".dt-gs-star").length, 1, "Realistic has the star");
assert.ok(body().querySelectorAll(".gs-seg-btn")[1].querySelector(".dt-gs-star"));
assert.deepEqual(segOn(), ["Original"]);
assert.deepEqual(vals(), ["×1.00", "×1.00", "×1.00", "×1.00", "×1.00"]);
assert.equal(body().querySelectorAll(".dt-gs-mark").length, 5);
assert.ok(body().querySelectorAll(".dt-gs-mark").every((m) => m.classList.contains("dt-gs-at")), "mark hidden under the thumb at the normal value");
assert.match(body().querySelectorAll(".dt-gs-mark")[0].style.left, /\* 0\.4286\)$/, "buy: 1 on a 0.25-2 track");
assert.match(body().text(), /The small mark on each slider is the normal game value/);

// 3. Presets fill the draft; nothing is saved before Apply; differing values turn gold.
body().querySelectorAll(".gs-seg-btn")[1].fire("click");
assert.deepEqual(segOn(), ["Realistic"]);
assert.deepEqual(vals(), ["×1.00", "×1.00", "×0.30*", "×1.10*", "×1.00"]);
assert.equal(sliders()[2].value, "0.3");
assert.equal(body().querySelectorAll(".dt-gs-mark")[2].classList.contains("dt-gs-at"), false, "mark shows once the value moves away");
assert.equal(run("_isDirty()"), true, "the game's unsaved-changes line and Apply light up");
assert.equal(row(), undefined, "not saved before Apply");

// 4. Moving a slider switches to Custom.
sliders()[0].value = "0.9";
sliders()[0].fire("input");
assert.deepEqual(segOn(), ["Custom"]);
assert.equal(run("_draft.dtBuy"), 0.9);
assert.deepEqual(vals()[0], "×0.90*");

// 5. The game's Apply saves it into the company's row 150 (same format as before) and applies it.
run("applyGameSettings()");
assert.equal(run("applied"), 1);
let saved = JSON.parse(row());
assert.deepEqual([saved.v, saved.company, saved.buy, saved.cost, saved.research, saved.rivals, saved.build], [1, "Ember", 0.9, 1, 0.3, 1.1, 1]);
assert.deepEqual(run("_dtDifficulty()"), { buy: 0.9, cost: 1, research: 0.3, rivals: 1.1, build: 1 });
assert.equal(run("_isDirty()"), false);

// 6. Opening again reads the saved values; a custom mix shows Custom. Defaults go back to Original.
run("_openSettings()");
page().querySelector('[data-page="dt-difficulty"]').fire("click");
assert.deepEqual(segOn(), ["Custom"]);
assert.deepEqual(vals(), ["×0.90*", "×1.00", "×0.30*", "×1.10*", "×1.00"]);
head().querySelector(".gs-btn-ghost").fire("click");
assert.deepEqual(segOn(), ["Original"]);
assert.equal(run("_isDirty()"), true);
run("_openSettings()"); // Back without Apply drops the change
assert.equal(JSON.parse(row()).buy, 0.9);

// 7. Other pages are the game's own.
page().querySelector('[data-page="sound"]').fire("click");
assert.equal(body().text(), "sound");

// 8. Main menu (no company loaded): the page says so, and Apply leaves every company alone.
layout.name = "SETTINGS";
const before = row();
run("_openSettings()");
assert.equal(run("_draft.dtBuy"), undefined, "no difficulty in the draft");
page().querySelector('[data-page="dt-difficulty"]').fire("click");
assert.match(head().text(), /^DifficultySaved with each company$/, "no Defaults button");
assert.equal(body().querySelector(".gs-empty").text(), "Load a company to change its difficulty");
assert.equal(body().querySelectorAll(".gs-range").length, 0);
run("applyGameSettings()");
assert.equal(row(), before);

// 9. A row written before this page (preset name only, old format) still loads.
layout.name = "BOSS OFFICE";
gv.SaveSlot = 2;
saves.cells["2,150"] = JSON.stringify({ v: 1, company: "Ember", preset: "brutal" });
run("_openSettings()");
page().querySelector('[data-page="dt-difficulty"]').fire("click");
assert.deepEqual(segOn(), ["Brutal"]);
assert.deepEqual(vals(), ["×0.85*", "×1.10*", "×0.25*", "×1.50*", "×1.00"]);

// 10. Every new line has Russian text too.
for (const [k, v] of Object.entries(run("_DT_DIFF_SET_TEXT"))) assert.ok(v.en && v.ru, k + " has EN and RU text");

console.log("settings runtime: 10 scenarios passed");
