// Tab registry test for board.js (globalThis._dtBoardTabs) on the page look (mdpage.js):
// with no registered tab the game's tab strip names the board's one tab and its parts
// stay as they are; a registered tab adds "My devices" | its own tab, hides the board's
// parts, renders into its own pane, and its key hints leave with it.
// Usage: node test_board_tabs.js [board.js]
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const BOARD = process.argv[2] || path.join(__dirname, "board.js");

class Node {
  constructor(tag) {
    this.tagName = tag; this.className = ""; this.children = []; this.textContent = ""; this.innerHTML = "";
    this.style = { display: "" }; this.id = ""; this.handlers = {}; this.dataset = {}; this.parent = null; this.title = "";
    const self = this;
    this.classList = {
      add: (c) => self.classList.toggle(c, true),
      contains: (c) => self.className.split(/\s+/).includes(c),
      toggle: (c, on) => {
        if (on === undefined) on = !self.classList.contains(c);
        const l = self.className.split(/\s+/).filter((x) => x && x !== c);
        if (on) l.push(c);
        self.className = l.join(" ");
      },
    };
  }
  get firstChild() { return this.children[0] || null; }
  get lastChild() { return this.children[this.children.length - 1] || null; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  insertBefore(c, ref) { c.parent = this; this.children.splice(Math.max(0, this.children.indexOf(ref)), 0, c); return c; }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  addEventListener(n, fn) { (this.handlers[n] = this.handlers[n] || []).push(fn); }
  click() { for (const fn of this.handlers.click || []) fn({ stopPropagation() {} }); }
}
function load(tabs) {
  const head = new Node("head");
  const document = { head, createElement: (t) => new Node(t), addEventListener() {},
    getElementById: (id) => head.children.find((n) => n.id === id) || null };
  const ui = {
    el(tag, cls, parent, text) { const n = new Node(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; if (parent) parent.appendChild(n); return n; },
    t: (e) => e.en, num: () => 0, gv: () => "", ru: () => false,
  };
  const ctx = { console, Math, Number, String, Map, Set, Array, Object, JSON, isFinite, document, setInterval: () => 1, _dtUi: ui };
  ctx.globalThis = ctx;
  if (tabs) ctx._dtBoardTabs = tabs;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../mods-ui/mdpage.js"), "utf8"), ctx, { filename: "mdpage.js" });
  vm.runInContext(fs.readFileSync(BOARD, "utf8"), ctx, { filename: "board.js" });
  return { ctx, ui, head };
}
// The board's own parts, as _dtBoardOpen builds them, and its key row with "ESC  Back".
function page(ui) {
  const body = new Node("div");
  const own = ["dt-board-sum", "", "dt-board-head", "dt-board-scroll", "dt-board-note"].map((c) => ui.el("div", c, body));
  const keys = ui.el("div", "dt-mdp-keys", body);
  ui.el("div", "dt-mdp-key", keys, "ESC Back");
  return { body, own, keys };
}
const strip = (body) => body.children.find((n) => n.className === "dt-mdp-strip");
const paneOf = (body) => body.children.find((n) => n.className === "dt-board-pane");

// Nothing registered: the strip names the board's one tab; its parts stay, the pane stays hidden.
const a = load();
assert.ok(Array.isArray(a.ctx._dtBoardTabs) && a.ctx._dtBoardTabs.length === 0);
const pa = page(a.ui);
a.ctx._dtBoardTabsInit(pa.body, pa.own, pa.keys);
assert.deepEqual(strip(pa.body).children.map((n) => n.textContent), ["My devices"]);
assert.ok(strip(pa.body).children[0].classList.contains("dt-on"));
assert.ok(pa.own.every((n) => n.style.display === ""));
assert.equal(paneOf(pa.body).style.display, "none");
// A broken entry (no render) is ignored the same way.
a.ctx._dtBoardTabs.push({ id: "x", label: "X" });
const pa2 = page(a.ui);
a.ctx._dtBoardTabsInit(pa2.body, pa2.own, pa2.keys);
assert.equal(strip(pa2.body).children.length, 1);
console.log("ok - no tab registered: one tab, the board's parts as before");

// One tab registered before board.js loads (rivals-ui could come first).
const calls = [];
const b = load([{ id: "rivals", label: "Rivals", render: (pane, o) => {
  calls.push([pane, o]);
  pane.textContent = "rivals here";
  b.ui.el("div", "dt-mdp-key", o.keys, "M Only my types");
} }]);
const pb = page(b.ui);
b.ctx._dtBoardTabsInit(pb.body, pb.own, pb.keys);
const bar = strip(pb.body);
assert.deepEqual(bar.children.map((n) => n.textContent), ["My devices", "Rivals"]);
assert.ok(bar.children[0].classList.contains("dt-on") && !bar.children[1].classList.contains("dt-on"));
const pane = paneOf(pb.body);
assert.equal(pane.style.display, "none");
assert.equal(calls.length, 0);
bar.children[1].click();
assert.equal(calls.length, 1);
assert.equal(calls[0][0], pane);
assert.equal(calls[0][1].keys, pb.keys);
assert.ok(bar.children[1].classList.contains("dt-on") && !bar.children[0].classList.contains("dt-on"));
assert.deepEqual(pb.own.map((n) => n.style.display), ["none", "none", "none", "none", "none"]);
assert.equal(pane.style.display, "");
assert.deepEqual(pb.keys.children.map((n) => n.textContent), ["ESC Back", "M Only my types"]);
bar.children[0].click();
assert.deepEqual(pb.own.map((n) => n.style.display), ["", "", "", "", ""]);
assert.equal(pane.style.display, "none");
assert.equal(pane.innerHTML, "");
assert.deepEqual(pb.keys.children.map((n) => n.textContent), ["ESC Back"], "the tab's key leaves with it");
console.log("ok - a registered tab: My devices | Rivals, switching hides/shows the board's parts and the tab's keys");

// The last picked tab is kept for the next opening (this session).
bar.children[1].click();
const pc = page(b.ui);
b.ctx._dtBoardTabsInit(pc.body, pc.own, pc.keys);
assert.ok(strip(pc.body).children[1].classList.contains("dt-on"));
assert.equal(calls.length, 3);
console.log("ok - the picked tab is remembered for the next opening");
