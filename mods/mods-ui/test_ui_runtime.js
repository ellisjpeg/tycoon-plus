// Behaviour test for the shared panel layer (ui.js) against a tiny fake DOM.
// It loads the real module, opens a pause:true panel, and checks that game
// window key listeners never see keys, that the panel's own inputs still do,
// and that close/chip/toast (EN + RU) behave. No browser or npm needed.
// Usage: node test_ui_runtime.js [ui.js]  (defaults to the ui.js beside this test)
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

class FakeEvent {
  constructor(type, opts) {
    Object.assign(this, opts || {});
    this.type = type;
    this.target = null;
    this.currentTarget = null;
    this.cancelBubble = false;
    this.defaultPrevented = false;
    this._immediate = false;
  }
  stopPropagation() { this.cancelBubble = true; }
  stopImmediatePropagation() { this.cancelBubble = true; this._immediate = true; }
  preventDefault() { this.defaultPrevented = true; }
}

class FakeNode {
  constructor(doc, tag) {
    this.ownerDocument = doc;
    this.tagName = String(tag || "").toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.style = { setProperty(name, value) { this[name] = value; } };
    this.dataset = {};
    this.className = "";
    this._id = "";
    this._text = "";
    this._html = "";
    this._listeners = new Map();
    const self = this;
    this.classList = {
      add(...names) {
        const set = new Set(self.className.split(/\s+/).filter(Boolean));
        for (const n of names) set.add(n);
        self.className = [...set].join(" ");
      },
      remove(...names) {
        const drop = new Set(names);
        self.className = self.className.split(/\s+/).filter((n) => n && !drop.has(n)).join(" ");
      },
      contains(name) { return self.className.split(/\s+/).includes(name); },
      toggle(name, on) {
        if (on === undefined) on = !this.contains(name);
        if (on) this.add(name);
        else this.remove(name);
        return on;
      },
    };
  }
  set id(value) {
    this._id = String(value);
    if (this._id && this.ownerDocument && this.ownerDocument._ids) this.ownerDocument._ids.set(this._id, this);
  }
  get id() { return this._id; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text; }
  set innerHTML(value) { this._html = String(value); }
  get innerHTML() { return this._html; }
  get isConnected() {
    for (let n = this; n; n = n.parentNode) if (n === this.ownerDocument) return true;
    return false;
  }
  appendChild(node) {
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    this.children.push(node);
    return node;
  }
  insertBefore(node, ref) {
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    const at = ref ? this.children.indexOf(ref) : -1;
    if (at < 0) this.children.push(node);
    else this.children.splice(at, 0, node);
    return node;
  }
  removeChild(node) {
    const at = this.children.indexOf(node);
    if (at >= 0) this.children.splice(at, 1);
    node.parentNode = null;
    return node;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  addEventListener(type, fn, capture) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push({ fn, capture: !!capture });
  }
  removeEventListener(type, fn, capture) {
    const list = this._listeners.get(type) || [];
    this._listeners.set(type, list.filter((l) => l.fn !== fn || l.capture !== !!capture));
  }
  matches(sel) {
    if (sel.startsWith(".")) return this.classList.contains(sel.slice(1));
    if (sel.startsWith("#")) return this.id === sel.slice(1);
    const attr = /^\[data-([\w-]+)="([^"]*)"\]$/.exec(sel);
    if (attr) return String(this.dataset[attr[1]] || "") === attr[2];
    return false;
  }
  closest(sel) {
    for (let n = this; n; n = n.parentNode) if (n.matches && n.matches(sel)) return n;
    return null;
  }
  _find(sel, out) {
    if (this.matches(sel)) out.push(this);
    for (const c of this.children) c._find(sel, out);
    return out;
  }
  querySelector(sel) { return this._find(sel, [])[0] || null; }
  querySelectorAll(sel) { return this._find(sel, []); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1920, height: 1080 }; }
}

function makeDocument() {
  const doc = new FakeNode(null, "#document");
  doc.ownerDocument = doc;
  doc._ids = new Map();
  doc.head = new FakeNode(doc, "head");
  doc.body = new FakeNode(doc, "body");
  doc.appendChild(doc.head);
  doc.appendChild(doc.body);
  doc.createElement = (tag) => new FakeNode(doc, tag);
  doc.getElementById = (id) => doc._ids.get(id) || null;
  return doc;
}

function fire(node, ev, capture) {
  const list = node._listeners.get(ev.type) || [];
  ev.currentTarget = node;
  for (const l of list.slice()) {
    if (l.capture !== capture) continue;
    l.fn.call(node, ev);
    if (ev._immediate) break;
  }
}

function dispatch(windowNode, target, ev) {
  ev.target = target;
  const path = [];
  for (let n = target; n; n = n.parentNode) path.push(n);
  path.push(windowNode);
  for (let i = path.length - 1; i > 0; i--) {
    if (ev.cancelBubble) return ev;
    fire(path[i], ev, true);
  }
  fire(target, ev, true);
  if (!ev.cancelBubble) fire(target, ev, false);
  if (!ev.cancelBubble) {
    for (let i = 1; i < path.length; i++) {
      if (ev.cancelBubble) break;
      fire(path[i], ev, false);
    }
  }
  return ev;
}

function all(node, out) {
  out = out || [];
  out.push(node);
  for (const c of node.children) all(c, out);
  return out;
}

const UI_PATH = process.argv[2] || path.join(__dirname, "ui.js");
const SRC = fs.readFileSync(UI_PATH, "utf8");
const doc = makeDocument();
const windowNode = new FakeNode(doc, "#window");
const timers = [];
const intervals = [];
const gv = { LanguageChoose: 0, GameplayPause: 0, class: "GAMEPLAY", Assistant: "OFF" };
const ctx = {
  document: doc,
  runtime: { globalVars: gv, layout: { name: "GAMEPLAY" } },
  innerWidth: 1920,
  innerHeight: 1080,
  addEventListener: (type, fn, capture) => windowNode.addEventListener(type, fn, capture),
  removeEventListener: (type, fn, capture) => windowNode.removeEventListener(type, fn, capture),
  setTimeout: (fn, ms) => { timers.push(fn); return timers.length; },
  clearTimeout: () => {},
  setInterval: (fn, ms) => { intervals.push(fn); return intervals.length; },
  clearInterval: () => {},
};
vm.createContext(ctx);
vm.runInContext(SRC, ctx, { filename: UI_PATH });
const ui = ctx._dtUi;
const J = (v) => JSON.parse(JSON.stringify(v));
const latestToast = () => all(doc.body).filter((n) => n.classList.contains("dt-toast")).pop();

// 1. A pause:true panel holds the calendar and hides window key listeners.
{
  let gameKeys = 0;
  windowNode.addEventListener("keydown", () => { gameKeys++; gv.GameplayPause = 0; });
  windowNode.addEventListener("keyup", () => { gameKeys++; gv.GameplayPause = 0; });
  const panel = ui.modal({ title: "Paused", pause: true });
  assert.equal(ui.isOpen(), true, "modal is open");
  assert.equal(gv.GameplayPause, 1, "pause:true holds the calendar");
  for (const type of ["keydown", "keyup"]) {
    for (const key of ["Escape", " "]) {
      if (type === "keydown" && key === "Escape") continue; // closes the panel: checked below
      dispatch(windowNode, doc.body, new FakeEvent(type, { key }));
      assert.equal(gameKeys, 0, type + " " + key + " never reaches the game window");
      assert.equal(gv.GameplayPause, 1, type + " " + key + " leaves the panel paused");
    }
  }
  const input = doc.createElement("input");
  panel.body.appendChild(input);
  let typed = 0;
  input.addEventListener("keydown", () => typed++);
  dispatch(windowNode, input, new FakeEvent("keydown", { key: "a" }));
  assert.equal(typed, 1, "the panel's own input still gets its keys");
  assert.equal(gameKeys, 0, "typing in a panel never reaches the game window");
  ui.close();
  assert.equal(ui.isOpen(), false, "close closes the panel");
  assert.equal(gv.GameplayPause, 0, "close restores the previous pause");
  timers.splice(0).forEach((fn) => fn());
  // Escape is the game's Back and Enter the main choice, for every panel, never reaching the game.
  const key = (k, target) => { dispatch(windowNode, target || doc.body, new FakeEvent("keydown", { key: k })); timers.splice(0).forEach((fn) => fn()); };
  const log = [];
  const two = (extra, b0, b1) => ui.modal(Object.assign({ title: "T", pause: true }, extra, {
    buttons: [Object.assign({ label: "Cancel", onClick: () => log.push("cancel") }, b0), Object.assign({ label: "Confirm", main: true, onClick: () => log.push("main") }, b1)] }));
  two();
  key("Escape");
  assert.deepEqual(log.splice(0), ["cancel"], "Escape presses Cancel (its own onClick runs)");
  assert.equal(ui.isOpen(), false, "and closes the panel");
  assert.equal(gv.GameplayPause, 0, "Escape restores the previous pause");
  two();
  key("Enter");
  assert.deepEqual(log.splice(0), [], "Enter does nothing by default, like the game's own news box");
  assert.equal(ui.isOpen(), true);
  ui.close(); timers.splice(0).forEach((fn) => fn());
  two({ enter: true });
  key("Enter");
  assert.deepEqual(log.splice(0), ["main"], "with enter: true, Enter presses the main button");
  assert.equal(ui.isOpen(), false);
  const p2 = two({ enter: true });
  const field = doc.createElement("input");
  p2.body.appendChild(field);
  key("Enter", field);
  assert.deepEqual(log.splice(0), [], "Enter in a field is for the field, not the panel");
  assert.equal(ui.isOpen(), true);
  ui.close(); timers.splice(0).forEach((fn) => fn());
  // A risky left button: Escape takes the safe one marked cancel.
  two({}, { label: "Stop selling", kind: "no", onClick: () => log.push("stop") }, { label: "Keep selling", cancel: true, onClick: () => log.push("keep") });
  key("Escape");
  assert.deepEqual(log.splice(0), ["keep"], "Escape presses the button marked cancel");
  // No back word, nothing marked: Escape just closes, presses nothing.
  two({}, { label: "Stop selling", onClick: () => log.push("stop") });
  key("Escape");
  assert.deepEqual(log.splice(0), [], "Escape never presses a button that is not a way back");
  assert.equal(ui.isOpen(), false);
  // A lone Done button is the way back.
  ui.modal({ title: "D", buttons: [{ label: "Done", main: true, onClick: () => log.push("done") }] });
  key("Escape");
  assert.deepEqual(log.splice(0), ["done"], "Escape presses a lone Done");
  // A question that must be answered: Escape does nothing, Enter still answers.
  two({ dismiss: false, enter: true }, { label: "No", onClick: () => log.push("no") }, { label: "Yes" });
  key("Escape");
  assert.equal(ui.isOpen(), true, "Escape leaves a dismiss:false panel open");
  assert.deepEqual(log.splice(0), []);
  key("Enter");
  assert.deepEqual(log.splice(0), ["main"], "Enter answers it with the main button");
  assert.equal(gameKeys, 0, "no panel key ever reaches the game window");
}

// 2. Chips are still built in the dock and click through to their handler.
{
  let clicked = 0;
  ui.chip("queue", 1, "Queue", 2, () => clicked++);
  const chip = doc.body.querySelector('[data-dt="queue"]');
  assert.ok(chip, "chip is in the dock");
  assert.equal(chip.children[1].textContent, "Queue", "chip label");
  assert.equal(chip.children[2].textContent, "2", "chip badge");
  dispatch(windowNode, chip, new FakeEvent("click"));
  assert.equal(clicked, 1, "chip click runs its handler");
  ui.removeChip("queue");
  assert.equal(doc.body.querySelector('[data-dt="queue"]'), null, "removeChip removes it");
}

// 3. Toasts highlight only the device name the caller passes (Cyrillic included);
//    a toast without a name gets no highlight at all.
{
  gv.LanguageChoose = 1;
  ui.toast("Ember 8: запуск 30.03.2015.", "Ember 8");
  assert.equal(latestToast().innerHTML, '<span class="dt-hl">Ember 8</span>: запуск 30.03.2015.', "RU planned");
  ui.toast("Очередь: Ember 6 пропущено — исследований нет. Запись осталась в очереди.", "Ember 6");
  assert.equal(latestToast().innerHTML,
    'Очередь: <span class="dt-hl">Ember 6</span> пропущено — исследований нет. Запись осталась в очереди.', "RU skipped");
  gv.LanguageChoose = 0;
  ui.toast("Ember 8 launches on 30.03.2015.", "Ember 8");
  assert.equal(latestToast().innerHTML, '<span class="dt-hl">Ember 8</span> launches on 30.03.2015.', "EN planned");
  ui.toast("Build queue: Ember 5 cannot start, not enough money. It stays in the queue.", "Ember 5");
  assert.equal(latestToast().innerHTML,
    'Build queue: <span class="dt-hl">Ember 5</span> cannot start, not enough money. It stays in the queue.', "EN skipped");
  ui.toast("A&B <x> started from the build queue.", "A&B <x>");
  assert.equal(latestToast().innerHTML, '<span class="dt-hl">A&amp;B &lt;x&gt;</span> started from the build queue.', "name is escaped");
  ui.toast("Added to build queue (2)");
  assert.equal(latestToast().innerHTML, "Added to build queue (2)", "no name: no highlight");
  ui.toast("Software can't be added to the build queue yet.");
  assert.equal(latestToast().innerHTML, "Software can&#39;t be added to the build queue yet.", "no name: no highlight");
  ui.toast("Design is still working on ", "");
  assert.equal(latestToast().innerHTML, "Design is still working on ", "empty name: no highlight");
  ui.toast("Ember 9 is on sale from today!", "Folio");
  assert.equal(latestToast().innerHTML, "Ember 9 is on sale from today!", "name not in the text: no highlight");
}

// 4. A toast never covers the game's own office notification or an earlier toast.
{
  for (const n of all(doc.body)) if (n.classList.contains("dt-toast")) n.remove();
  const proto = FakeNode.prototype, rect = proto.getBoundingClientRect;
  // 1920 x 1080 layer; a toast is 60 px high at its CSS bottom (180 px by default).
  proto.getBoundingClientRect = function () {
    if (this.classList.contains("dt-toast")) {
      const b = parseFloat(this.style.bottom) || 180;
      return { left: 1576, top: 1080 - b - 60, width: 320, height: 60 };
    }
    if (this._gameNote) return { left: 1576, top: 830, width: 320, height: 70 };
    return rect.call(this);
  };
  const box = (n) => n.getBoundingClientRect();
  const hits = (a, b) => a.top < b.top + b.height && a.top + a.height > b.top;
  try {
    const host = doc.createElement("div");
    host.id = "office-notifications";
    doc.body.appendChild(host);
    const note = doc.createElement("div");
    note._gameNote = true;
    host.appendChild(note);
    ui.toast("Ember 7 added to the queue.");
    const first = latestToast();
    assert.ok(!hits(box(first), box(note)), "toast sits above the game's notification");
    ui.toast("Ember 8 started from the build queue.");
    const second = latestToast();
    assert.ok(!hits(box(second), box(note)) && !hits(box(second), box(first)), "second toast stacks above the first");
    // A game notification that arrives after our toast: the toast's watch steps it clear.
    for (const n of all(doc.body)) if (n.classList.contains("dt-toast")) n.remove();
    note.remove();
    ui.toast("Ember 9 started from the build queue.", "Ember 9");
    const late = latestToast();
    host.appendChild(note);
    assert.ok(hits(box(late), box(note)), "late game notification overlaps at first");
    intervals.forEach((fn) => fn());
    assert.ok(!hits(box(late), box(note)), "toast steps above a late game notification");
    // A game card mid-slide: it still shows at 830..900 but its --notif-y spot is
    // 70 px higher (760..830). The toast aims at the spot, not the moving box.
    for (const n of all(doc.body)) if (n.classList.contains("dt-toast")) n.remove();
    const hostRect = host.getBoundingClientRect;
    host.getBoundingClientRect = () => ({ left: 1576, top: 900, width: 320, height: 0 });
    note.offsetHeight = 70;
    note.style.getPropertyValue = (k) => (k === "--notif-y" ? "-70px" : "");
    ui.toast("Ember 10 started from the build queue.");
    const slid = latestToast();
    assert.ok(!hits(box(slid), { top: 760, height: 70 }), "toast clears the card's settled spot");
    assert.ok(!hits(box(slid), box(note)), "and the card where it is now");
    delete note.offsetHeight;
    delete note.style.getPropertyValue;
    host.getBoundingClientRect = hostRect;
    host.remove();
  } finally {
    proto.getBoundingClientRect = rect;
  }
}

// 4b. A tall stack of game cards: the toast never steps up into the room circles
//     (right column, above design y 570); it moves left of the cards instead.
{
  for (const n of all(doc.body)) if (n.classList.contains("dt-toast")) n.remove();
  const proto = FakeNode.prototype, rect = proto.getBoundingClientRect;
  proto.getBoundingClientRect = function () {
    if (this.classList.contains("dt-toast")) {
      const b = parseFloat(this.style.bottom) || 180, r = parseFloat(this.style.right) || 24;
      return { left: 1920 - r - 400, top: 1080 - b - 60, width: 400, height: 60 };
    }
    if (this._card) return { left: 1360, top: this._card, width: 536, height: 90 };
    return rect.call(this);
  };
  const box = (n) => { const b = n.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.left + b.width, b: b.top + b.height }; };
  const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  const host = doc.createElement("div");
  host.id = "office-notifications";
  doc.body.appendChild(host);
  try {
    const cards = [810, 710, 610].map((y) => { const c = doc.createElement("div"); c._card = y; host.appendChild(c); return c; });
    ui.toast("Samsung unveils the Galaxy Note 5 at $909.", "Galaxy Note 5");
    const t = box(latestToast());
    for (const c of cards) assert.ok(!hit(t, box(c)), "toast clear of every game card");
    assert.ok(!(t.r > 1920 - 330 && t.t < 570), "toast stays out of the room circles");
    assert.ok(t.r <= 1360, "toast sits left of the card column");
    // A short stack still steps up in the right column as before.
    for (const n of all(doc.body)) if (n.classList.contains("dt-toast")) n.remove();
    cards[1].remove(); cards[2].remove();
    ui.toast("Ember 7 added to the queue.");
    const u = latestToast();
    assert.ok(!hit(box(u), box(cards[0])) && !u.style.right, "short stack: toast steps up, same column");
  } finally {
    host.remove();
    proto.getBoundingClientRect = rect;
  }
}

// 5. The chip dock moves below the game's own device card (#office-panel) while it is shown, the Tycoon+
//    credit sits below both (never above its own spot, design y 516), and the game's sales toasts start
//    below the credit.
{
  ui.chip("queue", 1, "Queue", 1, () => {});
  const dock = doc.body.querySelector(".dt-dock");
  const credit = doc.body.querySelector(".dt-credit");
  assert.ok(credit, "credit is on the office HUD");
  assert.deepEqual(credit.children.map((n) => n.textContent), ["Tycoon+", "", "by ellisjpeg_"], "credit text");
  assert.ok(!credit._listeners.get("click"), "credit is not clickable");
  assert.ok(/\.dt-credit \{[^}]*isolation: isolate/.test(SRC) &&
    /\.dt-credit::before \{[^}]*z-index: -1;[^}]*radial-gradient\(closest-side, rgba\(0, 0, 0, 0\.28\)/.test(SRC),
    "credit has the room title's soft glow behind its text");
  const creditTop = () => Number((/\* (\d+)px/.exec(credit.style.top) || [0, 516])[1]);
  credit.getBoundingClientRect = () => ({ left: 58, top: creditTop(), width: 140, height: 60 });
  const panel = doc.createElement("div");
  panel.id = "office-panel";
  panel.getBoundingClientRect = () => ({ left: 33, top: 125, width: 373, height: 142 });
  doc.body.appendChild(panel);
  intervals.forEach((fn) => fn());
  assert.equal(dock.style.top, "279px", "dock sits below the device card");
  dock.getBoundingClientRect = () => ({ left: 33, top: 279, width: 400, height: 60 });
  intervals.forEach((fn) => fn());
  assert.equal(creditTop(), 516, "short card: credit keeps its own spot");
  assert.equal(ctx._dtSalesNotifShift, 516 + 60 + 35 - 267 - 12, "sales toasts start below the credit");
  // A taller card (3+ devices on sale) pushes the credit down, 65 design px below the card or 12 below the dock.
  panel.getBoundingClientRect = () => ({ left: 33, top: 125, width: 373, height: 520 });
  dock.getBoundingClientRect = () => ({ left: 33, top: 657, width: 400, height: 60 });
  intervals.forEach((fn) => fn());
  assert.equal(creditTop(), 729, "credit moves below the chips under a tall card");
  assert.equal(ctx._dtSalesNotifShift, 729 + 60 + 35 - 645 - 12, "sales toasts follow it");
  ui.removeChip("queue");
  delete dock.getBoundingClientRect;
  intervals.forEach((fn) => fn());
  assert.equal(creditTop(), 710, "no chips: 65 below the card");
  // The tallest card leaves no room above the bottom toolbar: the credit steps aside, the toasts keep their spot.
  panel.getBoundingClientRect = () => ({ left: 33, top: 124, width: 373, height: 744 });
  intervals.forEach((fn) => fn());
  assert.equal(credit.style.visibility, "hidden", "no room: credit hidden");
  assert.equal(ctx._dtSalesNotifShift, 0, "toasts right under the card");
  panel.getBoundingClientRect = () => ({ left: 33, top: 125, width: 373, height: 520 });
  intervals.forEach((fn) => fn());
  assert.equal(credit.style.visibility, "", "room again: credit back");
  panel.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
  intervals.forEach((fn) => fn());
  assert.equal(dock.style.top, "", "dock back in its own place when the card is hidden");
  assert.equal(credit.style.top, "", "credit back in its own place");
  assert.equal(credit.style.visibility, "", "and shown");
  assert.equal(ctx._dtSalesNotifShift, 0, "sales toasts back in their own place too");
  panel.remove();
  delete credit.getBoundingClientRect;
}

// 6. Long toasts wrap inside the fixed-width box (the game's notifications wrap too).
{
  const css = doc.getElementById("dt-mods-css").textContent;
  const rules = css.match(/\.dt-toast \{[^}]*\}/g);
  const last = rules[rules.length - 1];
  assert.match(last, /white-space: normal/, "the final toast rule lets text wrap");
  // Round 8: the last font-size each text class gets is at least 21 design px (14 px at 1280x720).
  for (const cls of [".dt-body", ".dt-value", ".dt-badge", ".dt-note", ".dt-sub", ".dtq-field > .dt-sub", ".dtq-warn", ".dt-btn.dt-small"]) {
    const sizes = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter((m) => m[1].split(",").some((s) => s.trim().replace(/^\.dt-layer /, "") === cls))
      .map((m) => (m[2].match(/font-size: calc\(var\(--dt\) \* ([\d.]+)px\)/) || [])[1]).filter(Boolean);
    assert.ok(sizes.length && Number(sizes[sizes.length - 1]) >= 21, cls + " text is at least 21 design px: " + sizes);
  }
  // A toast is a copy of the game's own news card (on the office screens it IS one): the same
  // 19.5 design px news-patches gives those cards (_DT_NEWS.font), not a size of its own.
  const news = fs.readFileSync(path.join(path.dirname(UI_PATH), "../news-patches/news.js"), "utf8");
  const card = Number((news.match(/font: ([\d.]+)/) || [])[1]);
  assert.match(last, new RegExp("font-size: calc\\(var\\(--dt\\) \\* " + String(card).replace(".", "\\.") + "px\\)"), "toast text = the game's news card size " + card);
}

// 6b. On the office screens a toast goes into the game's own news stack (showOfficeNotification),
//     escaped, the name in [color] (the game's own markup); elsewhere it stays the mod's copy.
{
  const sent = [];
  ctx.showOfficeNotification = (t) => sent.push(t);
  const before = all(doc.body).filter((n) => n.classList.contains("dt-toast")).length;
  ui.toast("A&B <x> is on sale from today!", "A&B <x>");
  assert.deepEqual(sent, ["[color=#FFD600]A&amp;B &lt;x&gt;[/color] is on sale from today!"], "office: the game's card, name in yellow");
  assert.equal(all(doc.body).filter((n) => n.classList.contains("dt-toast")).length, before, "no mod copy on the office screens");
  const lay = ctx.runtime.layout;
  ctx.runtime.layout = { name: "MY SMARTPHONES" };
  ui.toast("Price cut to $299 for Ember 6", "Ember 6");
  assert.equal(sent.length, 1, "off the office screens the game's stack is hidden: the mod's copy shows");
  assert.equal(latestToast().innerHTML, 'Price cut to $299 for <span class="dt-hl">Ember 6</span>');
  ctx.runtime.layout = lay;
  // A sales message (opts.sales) joins the game's own sales messages under the sales card
  // (showOfficeSalesNotification), the name in their blue; opts.color picks another of theirs.
  const salesSent = [];
  ctx.showOfficeSalesNotification = (t) => salesSent.push(t);
  ui.toast("A&B <x> is on sale from today!", "A&B <x>", { sales: true });
  ui.toast("Restocked 3 devices for $1.2 M", "$1.2 M", { sales: true, color: "#FF6A77" });
  ui.toast("Added to build queue (2)");
  assert.deepEqual(salesSent, ["[color=#87E9FF]A&amp;B &lt;x&gt;[/color] is on sale from today!",
    "Restocked 3 devices for [color=#FF6A77]$1.2 M[/color]"], "office: the game's sales card, name in its blue");
  assert.deepEqual(sent.slice(1), ["Added to build queue (2)"], "other toasts stay in the news stack");
  // Without the game's sales stack (an older game) it falls back to the news stack in yellow.
  delete ctx.showOfficeSalesNotification;
  ui.toast("Ember 7 is on sale from today!", "Ember 7", { sales: true });
  assert.equal(sent[sent.length - 1], "[color=#FFD600]Ember 7[/color] is on sale from today!");
  delete ctx.showOfficeNotification;
}

// 7. The game resizes its canvas after the window's resize event: the layer
//    still follows the new size on its next dock check.
{
  const layer = doc.body.querySelector(".dt-layer");
  ctx.innerWidth = 1920; ctx.innerHeight = 1080;
  intervals.forEach((fn) => fn());
  assert.equal(layer.style["--dt"], "1", "full size layer");
  ctx.innerWidth = 1280; ctx.innerHeight = 720;
  intervals.forEach((fn) => fn());
  assert.equal(layer.style.width, "1280px", "layer follows the canvas without a resize event");
  assert.equal(Number(layer.style["--dt"]).toFixed(4), "0.6667", "scale follows the canvas");
  ctx.innerWidth = 1920; ctx.innerHeight = 1080;
  intervals.forEach((fn) => fn());
}

// 8. Re-sending an unchanged chip (mods do it every 250 ms) writes nothing to the DOM.
{
  ui.chip("rooms", 0, "Office", "", () => {});
  const chip = doc.body.querySelector('[data-dt="rooms"]');
  let writes = 0;
  for (const n of [chip.children[1], chip.children[2]]) {
    let t = n.textContent;
    Object.defineProperty(n, "textContent", { get: () => t, set: (v) => { writes++; t = String(v); }, configurable: true });
    let disp = n.style.display;
    Object.defineProperty(n.style, "display", { get: () => disp, set: (v) => { writes++; disp = v; }, configurable: true });
  }
  for (let i = 0; i < 5; i++) { ui.chip("rooms", 0, "Office", "", () => {}); intervals.forEach((fn) => fn()); }
  assert.equal(writes, 0, "unchanged chip is not rewritten");
  ui.chip("rooms", 0, "Lab", 3, () => {});
  assert.equal(chip.children[1].textContent, "Lab", "changed label is written");
  assert.equal(chip.children[2].textContent, "3", "changed badge is written");
  assert.equal(chip.children[2].style.display, "", "badge shown");
  ui.removeChip("rooms");
}

// 9. A mod's own line inserted into a chip (the room pill's "Phone · Name" sub line, put before the badge)
// is left alone: the label and badge are written to the chip's own nodes, not by child position.
{
  ui.chip("rooms", 0, "Office", "", () => {});
  const chip = doc.body.querySelector('[data-dt="rooms"]');
  const badge = chip.children[2];
  const sub = doc.createElement("div");
  sub.className = "dt-rooms-sub";
  sub.textContent = "Phone · Skipper";
  chip.insertBefore(sub, chip.children[2]);
  let writes = 0;
  let t = sub.textContent, disp = sub.style.display;
  Object.defineProperty(sub, "textContent", { get: () => t, set: (v) => { writes++; t = String(v); }, configurable: true });
  Object.defineProperty(sub.style, "display", { get: () => disp, set: (v) => { writes++; disp = v; }, configurable: true });
  for (let i = 0; i < 5; i++) { ui.chip("rooms", 0, "Office", "", () => {}); intervals.forEach((fn) => fn()); }
  assert.equal(writes, 0, "inserted sub line is not rewritten");
  assert.equal(sub.textContent, "Phone · Skipper", "sub line kept");
  ui.chip("rooms", 0, "Office", 2, () => {});
  assert.equal(badge.textContent, "2", "badge written to the badge node");
  assert.equal(sub.textContent, "Phone · Skipper", "sub line still kept");
  ui.removeChip("rooms");
}

// 10. Between two layouts (none runs while the next one loads its images) the chips stay as they are:
// the room pill no longer vanishes and pops back in on each room change. A screen that is not an
// office still hides the dock in its first frame.
{
  const r = ctx.runtime, hooks = {};
  // Several modules listen (the toolbar pages block too): keep every listener.
  r.addEventListener = (type, fn) => { (hooks[type] = hooks[type] || []).push(fn); };
  r.layout = { name: "PROGRAMMER OFFICE 4" };
  ui.chip("rooms", 0, "Programming", "", () => {});
  const dock = doc.body.querySelector(".dt-dock");
  const chip = doc.body.querySelector('[data-dt="rooms"]');
  intervals.forEach((fn) => fn());
  assert.equal(dock.style.display, "", "dock shown in an office");
  Object.defineProperty(r, "layout", { get: () => { throw new Error("no layout is running"); }, configurable: true });
  ui.removeChip("rooms");
  intervals.forEach((fn) => fn());
  assert.equal(doc.body.querySelector('[data-dt="rooms"]'), chip, "chip kept while the next room loads");
  assert.equal(dock.style.display, "", "dock still shown while the next room loads");
  Object.defineProperty(r, "layout", { value: { name: "SMARTPHONE PAGE 1" }, writable: true, configurable: true });
  hooks.afteranylayoutstart.forEach((f) => f());
  assert.equal(dock.style.display, "none", "a screen that is not an office hides the dock at its start");
  ui.removeChip("rooms");
  assert.equal(doc.body.querySelector('[data-dt="rooms"]'), null, "removed once that layout runs");
  r.layout = { name: "GAMEPLAY" };
  intervals.forEach((fn) => fn());
}

// 11. Overhead: with a size watch and frames, the 250 ms check reads no layout while nothing changes;
//     changes (a chip added, the card resized) are measured once, in the next frame.
{
  const frames = [], observed = [];
  let watchCb = null;
  ctx.requestAnimationFrame = (fn) => frames.push(fn);
  ctx.ResizeObserver = class { constructor(cb) { watchCb = cb; } observe(n) { observed.push(n); } unobserve() {} };
  const canvas = doc.createElement("canvas");
  doc.body.appendChild(canvas);
  doc.querySelector = (sel) => (sel === "canvas" ? canvas : null);
  const panel = doc.createElement("div");
  panel.id = "office-panel";
  panel.getBoundingClientRect = () => ({ left: 33, top: 125, width: 373, height: 142 });
  doc.body.appendChild(panel);
  doc._ids.set("office-panel", panel);
  const proto = FakeNode.prototype, rect = proto.getBoundingClientRect;
  let reads = 0;
  // Only the dock's reads (earlier toasts keep their own 200 ms check running in this fake).
  const dockRead = () => /at (syncDock|canvasRect|fit) /.test(new Error().stack);
  const panelRect = panel.getBoundingClientRect;
  panel.getBoundingClientRect = () => { if (dockRead()) reads++; return panelRect(); };
  proto.getBoundingClientRect = function () { if (dockRead()) reads++; return rect.call(this); };
  intervals.forEach((fn) => fn()); // starts watching the canvas and the card: one measure
  assert.ok(observed.includes(canvas) && observed.includes(panel), "canvas and card are watched");
  reads = 0;
  for (let i = 0; i < 40; i++) intervals.forEach((fn) => fn()); // 10 s of checks
  ui.chip("queue", 1, "Queue", "", () => {}); // unchanged afterwards: re-sent every tick
  for (let i = 0; i < 3; i++) ui.chip("queue", 1, "Queue", "", () => {});
  assert.equal(reads, 0, "no layout reads until a frame runs");
  assert.equal(frames.length, 1, "one frame asked for");
  watchCb(); watchCb(); // card resized twice in the same frame
  assert.equal(frames.length, 1, "still one frame");
  frames.splice(0).forEach((fn) => fn());
  const one = reads;
  assert.ok(one > 0 && one <= 6, "one measuring pass: " + one);
  for (let i = 0; i < 40; i++) intervals.forEach((fn) => fn());
  assert.equal(reads, one, "idle again");
  proto.getBoundingClientRect = rect;
  ui.removeChip("queue");
  frames.splice(0).forEach((fn) => fn());
  delete ctx.requestAnimationFrame;
  delete ctx.ResizeObserver;
  panel.remove();
  doc._ids.delete("office-panel");
}

// 12. The game's news pop-up (DOM, dims the office) hides the HUD while it is up.
{
  ui.chip("queue", 1, "Queue", "", () => {});
  const layer = doc.body.querySelector(".dt-layer"), dock = doc.body.querySelector(".dt-dock");
  const news = doc.createElement("div");
  news.id = "office-news-overlay";
  doc.body.appendChild(news);
  doc._ids.set("office-news-overlay", news);
  intervals.forEach((fn) => fn());
  assert.equal(dock.style.display, "", "shown while the pop-up is closed");
  news.classList.add("on-visible");
  intervals.forEach((fn) => fn());
  assert.equal(dock.style.display, "none", "dock hidden under the news pop-up");
  assert.ok(layer.classList.contains("dt-hud-off"), "credit and room title hidden too");
  news.classList.remove("on-visible");
  intervals.forEach((fn) => fn());
  assert.ok(!layer.classList.contains("dt-hud-off"), "back once it closes");
  // The game's create-device picker (class stays GAMEPLAY) hides it too.
  for (const v of ["WAIT", "ON"]) {
    gv.CreateDevicesUI = v;
    intervals.forEach((fn) => fn());
    assert.ok(layer.classList.contains("dt-hud-off") && dock.style.display === "none", "hidden while the picker is " + v);
  }
  gv.CreateDevicesUI = "OFF";
  intervals.forEach((fn) => fn());
  assert.ok(!layer.classList.contains("dt-hud-off"), "back after the picker");
  doc._ids.delete("office-news-overlay");
  news.remove();
  ui.removeChip("queue");
}

// 13. Toolbar pages (appended block): the game's 14 icons take 17 even slots of
// 107.5 px, leaving the two either side of "+" (960) for Build queue and Launches.
if (ctx._dtTb) {
  const sl = ctx._dtTb.slots();
  assert.deepEqual(J(sl.now), [100, 207.5, 315, 422.5, 530, 637.5, 745, 1175, 1282.5, 1390, 1497.5, 1605, 1712.5, 1820]);
  const free = [];
  for (let i = 0; i < 17; i++) { const x = 100 + 107.5 * i; if (x !== 960 && sl.now.indexOf(x) < 0) free.push(x); }
  assert.deepEqual(free, [852.5, 1067.5], "the two free slots sit either side of +");
  assert.equal(ctx._dtTb.page(), "", "no page open");
}

// 14. One shared timer for the mods' checks: one 250 ms interval for them all,
// checks in the order added, each at its own rate, a failing one never stops
// the next, a stopped one never runs again. Toasts share one watcher too.
{
  const before = intervals.length;
  const log = [];
  const a = ui.every(() => log.push("a"), 250);
  ui.every(() => log.push("b"), 500);
  ui.every(() => { log.push("x"); throw new Error("boom"); }, 250);
  ui.every(() => log.push("c"), 250);
  assert.equal(intervals.length, before, "the checks add no timers of their own");
  const run = intervals.find((fn) => fn.name === "runJobs");
  assert.ok(run, "the shared timer is the one interval");
  log.length = 0;
  for (let i = 0; i < 4; i++) run();
  const rounds = log.join("").match(/a(b?)xc/g);
  assert.equal(rounds && rounds.length, 4, "every round runs a, x, c in order: " + log.join(""));
  assert.equal(log.filter((s) => s === "b").length, 2, "a 500 ms check runs every second round");
  ui.stopEvery(a);
  log.length = 0;
  run();
  assert.ok(!log.includes("a") && log.includes("c"), "a stopped check never runs again");

  timers.splice(0).forEach((fn) => fn());
  const n0 = intervals.length;
  ui.toast("first");
  ui.toast("second");
  assert.equal(intervals.length, n0 + 1, "two toasts share one watcher");
  timers.splice(0).forEach((fn) => fn()); // both toasts end: the watcher stops
  assert.equal(all(doc.body).filter((n) => n.classList.contains("dt-toast")).length, 0, "both toasts gone");
  ui.toast("third");
  assert.equal(intervals.length, n0 + 2, "a new toast starts the watcher again");
  timers.splice(0).forEach((fn) => fn());
}

console.log("ui runtime: 14 scenarios passed");
