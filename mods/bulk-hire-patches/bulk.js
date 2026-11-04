// ── Bulk search: run several searches at one agency in one go ──
// Find Employees shows three agencies; a click on a card pays for one search
// (1-3, 1-2 or 1 candidates). Each card gets a "‹ x1 ›" picker left of its
// price button: ×2 to ×20 runs that many searches back to back for 50% more
// per search, and the card's price, quantity and button show the total. ×1 is
// the game's own search, untouched. The game's sheet still decides which card
// was clicked and takes the first search's price; the extra searches, the
// surcharge and the combined "employees found" count happen in findEmployees.
var _dtBulk = (function () {
  const STEPS = [1, 2, 5, 10, 20];
  const MARKUP = 1.5;
  // The game's three agencies (269 FIND EMPLOYEES): price, candidates per search, skill range,
  // and the UIDs of the card's price button, its glow, its label, its value column and the
  // orange overlay the card fades in while it is selected (hovered).
  const TIERS = [
    { price: 2e5, counts: [1, 1, 1, 2, 2, 2, 3], lo: 10, hi: 35, btn: 19896, glow: 19897, label: 19902, vals: 19865, over: 19853 },
    { price: 45e4, counts: [1, 1, 1, 1, 2, 2], lo: 40, hi: 60, btn: 19898, glow: 19899, label: 19903, vals: 19889, over: 19854 },
    { price: 65e4, counts: [1], lo: 70, hi: 85, btn: 19900, glow: 19901, label: 19904, vals: 19892, over: 19855 },
  ];
  const PILL_W = 124, GAP = 12; // design px; the button keeps its 352 px row
  const GOLD = "#FFD800", WHITE = "#FFFFFF"; // the game's tag colour, and its text colour on the orange card
  const sel = [1, 1, 1];
  let root = null, pills = [], seen = null, seenProf = null, raf = 0, shownKey = "";

  const rt = () => globalThis.runtime || null;
  const gv = (k, d) => { try { const v = rt().globalVars[k]; return v === undefined || v === null ? d : v; } catch (e) { return d; } };
  const byUid = (u) => { try { return rt().getInstanceByUid(u) || null; } catch (e) { return null; } };
  const onScreen = () => { try { return String(rt().layout.name) === "FIND EMPLOYEES"; } catch (e) { return false; } };
  const unit = (k) => TIERS[k].price * MARKUP;
  const cost = (k, n) => (n > 1 ? n * unit(k) : TIERS[k].price);
  const money = (v) => "$" + Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const short = (v) => "$" + (v >= 1e6 ? +(v / 1e6).toFixed(2) + "M" : Math.round(v / 1e3) + "K");
  // The biggest step the player can pay for right now (×1 always shows; the game itself refuses it if short).
  function maxStep(k) {
    const b = Number(gv("Budget", 0)) || 0;
    let m = 1;
    for (const n of STEPS) if (n > 1 && cost(k, n) <= b) m = n;
    return m;
  }
  function count(k) { return Math.min(sel[k], maxStep(k)); }
  function tierOf(target) { return target <= 37 ? 0 : target <= 62 ? 1 : 2; }

  // ── the search itself ──
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function run(e) {
    const g = (rt() || {}).globalVars;
    if (!g || !onScreen()) return _dtFindOne(e);
    const k = tierOf(Math.round(Number(g.FindEmployeesCharacters) || 0));
    // The sheet has just taken one normal price; the bulk total is n searches at the surcharge.
    let n = sel[k];
    while (n > 1 && cost(k, n) > (Number(g.Budget) || 0) + TIERS[k].price) n = STEPS[STEPS.indexOf(n) - 1];
    if (n <= 1) return _dtFindOne(e);
    g.Budget -= cost(k, n) - TIERS[k].price;
    const found = [];
    let rep = null, done = 0;
    for (; done < n; ) {
      if (done) {
        g.FindEmployeesCountRandom = pick(TIERS[k].counts);
        g.FindEmployeesCharacters = Math.round(TIERS[k].lo + Math.random() * (TIERS[k].hi - TIERS[k].lo));
      }
      rep = _dtFindOne(e);
      done++;
      if (rep && rep.found) for (const f of rep.found) found.push(f);
      // Everyone of this profession is found or hired: stop and pay back the searches not run.
      if (!rep || rep.poolSize - (rep.found ? rep.found.length : 0) <= 0) break;
    }
    if (done < n) g.Budget += (n - done) * unit(k);
    const t = _rt10(e), temp = _inst13(t, CFG.TEMP_ARRAY);
    if (temp && typeof temp.setSize === "function") {
      temp.setSize(found.length, Math.max(1, 0 | temp.height), Math.max(1, 0 | temp.depth));
      for (let i = 0; i < found.length; i++) temp.setAt(found[i].id, i, 0, 0);
    }
    g.FindEmployeesCountRandom = found.length;
    return (_lastReport = Object.assign({}, rep, { requested: n, searches: done, found: found }));
  }

  // ── the picker ──
  const CSS = `
.dtb-pill { position: absolute; box-sizing: border-box; display: flex; align-items: stretch; pointer-events: auto;
  width: calc(var(--dt) * ${PILL_W}px); height: calc(var(--dt) * 64px); border-radius: calc(var(--dt) * 10px);
  background: rgba(255, 255, 255, 0.12); box-shadow: inset 0 0 0 calc(var(--dt) * 2px) rgba(255, 255, 255, 0.2);
  font-family: "SofiaSansExtraCondensed-Bold", "Oswald", sans-serif; color: #fff; user-select: none; -webkit-user-select: none;
  text-shadow: 0 calc(var(--dt) * 1px) calc(var(--dt) * 3px) rgba(0, 0, 0, 0.35); }
.dtb-pill .dtb-n { flex: 1 1 auto; display: flex; align-items: center; justify-content: center;
  font-size: calc(var(--dt) * 30px); letter-spacing: calc(var(--dt) * 0.4px); transform: translateY(calc(var(--dt) * 1px)); }
.dtb-pill .dtb-a { flex: 0 0 calc(var(--dt) * 36px); position: relative; cursor: pointer; border-radius: calc(var(--dt) * 10px);
  transition: background 0.14s ease; }
.dtb-pill .dtb-a::after { content: ""; position: absolute; left: 50%; top: 50%; width: calc(var(--dt) * 10px); height: calc(var(--dt) * 10px);
  border: solid rgba(255, 255, 255, 0.85); border-width: 0 0 calc(var(--dt) * 3px) calc(var(--dt) * 3px); }
.dtb-pill .dtb-l::after { transform: translate(-30%, -50%) rotate(45deg); }
.dtb-pill .dtb-r::after { transform: translate(-70%, -50%) rotate(-135deg); }
.dtb-pill .dtb-a:hover { background: rgba(255, 255, 255, 0.1); }
.dtb-pill .dtb-a:active { background: rgba(255, 255, 255, 0.18); }
.dtb-pill .dtb-a.dtb-off { opacity: 0.3; cursor: default; background: none; }
`;
  function build() {
    if (root && root.isConnected) return;
    const layer = _dtUi.ensure();
    if (!document.getElementById("dtb-css")) {
      const st = document.createElement("style");
      st.id = "dtb-css";
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    root = _dtUi.el("div", "dtb-root", layer);
    pills = TIERS.map((_, k) => {
      const p = _dtUi.el("div", "dtb-pill", root);
      const l = _dtUi.el("div", "dtb-a dtb-l", p), n = _dtUi.el("div", "dtb-n", p), r = _dtUi.el("div", "dtb-a dtb-r", p);
      const step = (d) => {
        const i = STEPS.indexOf(count(k)) + d;
        if (i < 0 || i >= STEPS.length || STEPS[i] > maxStep(k)) return;
        sel[k] = STEPS[i];
        try { globalThis.tapTurn && globalThis.tapTurn(); } catch (e) {}
        sync(true);
      };
      l.addEventListener("click", () => step(-1));
      r.addEventListener("click", () => step(1));
      return { p, l, n, r };
    });
  }
  // Each layout start makes new instances: narrow the button once per instance, keep the text it was given.
  function prepare() {
    const btn0 = byUid(TIERS[0].btn);
    if (!btn0 || btn0 === seen) return !!btn0;
    for (const T of TIERS) {
      const b = byUid(T.btn), gl = byUid(T.glow), lb = byUid(T.label), v = byUid(T.vals);
      if (!b || !lb || !v || b.objectType.name !== "9patch3") return false;
      T.cx = b.x;
      const w = b.width - PILL_W - GAP, x = b.x + (PILL_W + GAP) / 2;
      b.width = w; b.x = x;
      if (gl) { gl.width = w + (gl.width - 352); gl.x = x; }
      lb.width = w; lb.x = x;
      T.mod = false;
    }
    seen = btn0;
    for (let k = 0; k < 3; k++) sel[k] = 1;
    shownKey = "";
    return true;
  }
  function selected(k) {
    const o = byUid(TIERS[k].over); // the orange overlay the card shows while it is selected
    return !!o && o.opacity > 0.5;
  }
  // The job type (the tab being searched) is a global; every change starts its cards at x1.
  function job() {
    const p = String(gv("EmployeesProfession", ""));
    if (p === seenProf) return false;
    seenProf = p;
    for (let k = 0; k < 3; k++) sel[k] = 1;
    shownKey = "";
    return true;
  }
  function texts(k) {
    const T = TIERS[k], n = count(k), lb = byUid(T.label), v = byUid(T.vals);
    if (!lb || !v) return;
    // Until we change them, the card's own texts are the game's (it sets them as the screen opens).
    if (!T.mod) { T.labelText = lb.text; T.valsText = v.text; }
    if (n <= 1) { if (T.mod) { lb.text = T.labelText; v.text = T.valsText; T.mod = false; } return; }
    T.mod = true;
    lb.text = T.labelText.replace(/\$[\d\s]+$/, money(cost(k, n)));
    const lines = T.valsText.split("\n"), lo = Math.min(...T.counts) * n, hi = Math.max(...T.counts) * n;
    // Yellow on the normal card; white (the game's text on the orange card) so it stays readable there.
    lines[0] = "[color=" + (selected(k) ? WHITE : GOLD) + "]+50%[/color] -" + short(unit(k));
    lines[2] = lines[2].replace(/\d+(-\d+)?/, lo === hi ? String(lo) : lo + "-" + hi);
    v.text = lines.join("\n");
  }
  function sync(force) {
    const key = TIERS.map((_, k) => count(k) + "/" + maxStep(k) + (selected(k) ? "+" : "-")).join(",");
    if (!force && key === shownKey) return;
    shownKey = key;
    TIERS.forEach((T, k) => {
      const n = count(k), q = pills[k];
      q.n.textContent = "x" + n; // the game writes counts as "x85"
      q.l.classList.toggle("dtb-off", n <= 1);
      q.r.classList.toggle("dtb-off", n >= maxStep(k));
      texts(k);
    });
  }
  function frame() {
    raf = 0;
    if (!onScreen()) return hide();
    if (!prepare()) { raf = requestAnimationFrame(frame); return; }
    job();
    build();
    const free = gv("class", "") === "FIND EMPLOYEES" && gv("EditorNotification", "OFF") === "OFF";
    TIERS.forEach((T, k) => {
      const b = byUid(T.btn), s = pills[k].p.style;
      const op = b ? Math.max(0, Math.min(1, b.opacity)) : 0;
      s.left = `calc(var(--dt) * ${T.cx - 176}px)`;
      s.top = `calc(var(--dt) * ${(b ? b.y : 590) - 32}px)`;
      s.opacity = free ? String(op) : "0";
      s.pointerEvents = free && op > 0.5 ? "auto" : "none";
    });
    sync(false);
    raf = requestAnimationFrame(frame);
  }
  function hide() {
    if (root) root.remove();
    root = null; pills = []; seen = null;
  }
  _dtUi.every(() => { if (!raf && onScreen() && typeof requestAnimationFrame === "function") raf = requestAnimationFrame(frame); }, 250);
  return { run, sel, cost, maxStep, job };
})();
function findEmployees(e) {
  return _dtBulk.run(e);
}
