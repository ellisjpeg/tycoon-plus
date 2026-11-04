// ── My Devices page look (Compare, Sales board) ──
// Turns a _dtUi.modal into a full page of the My <Type> screen it opens from:
// the game's own background stays (its other layers are hidden while the page
// is up), the game's tab strip across the top, its table cells (the
// .mydev-table rules, copied as values), and key hints along the bottom like
// "ESC  Back". 1920x1080 design units, like ui.js.
var _dtMdp = (function () {
  const CSS = `
.dt-mdp-icons { position: absolute; left: calc(var(--dt) * 52px); top: calc(var(--dt) * 138px); width: calc(var(--dt) * 85px);
  display: flex; flex-direction: column; align-items: center; gap: calc(var(--dt) * 13px); padding: calc(var(--dt) * 7px) 0;
  border-radius: calc(var(--dt) * 6px); background: rgba(0, 0, 0, 0.55); pointer-events: auto; }
.dt-mdp-ico { width: calc(var(--dt) * 70px); height: calc(var(--dt) * 70px); display: flex; align-items: center; justify-content: center;
  border-radius: calc(var(--dt) * 8px); color: rgb(145, 147, 151); cursor: pointer; transition: color 0.14s ease; }
.dt-mdp-ico svg { width: calc(var(--dt) * 46px); height: calc(var(--dt) * 46px); fill: currentColor; }
.dt-mdp-ico:hover { color: rgb(205, 207, 211); }
/* Up to 8 icons at the game's size; more (Rivals, every type unlocked) step closer so the column ends above the key hints. */
.dt-mdp-icons.dt-many { gap: calc(var(--dt) * 7px); }
.dt-mdp-icons.dt-many .dt-mdp-ico { height: calc(var(--dt) * 62px); }
.dt-mdp-icons.dt-many .dt-mdp-ico svg { width: calc(var(--dt) * 40px); height: calc(var(--dt) * 40px); }
.dt-mdp-ico.dt-on { color: #fff; cursor: default; background: linear-gradient(180deg, rgb(250, 205, 13), rgb(247, 153, 28)); }
/* The game's own My Devices table (DOM) stays out of sight while a page is up. */
body.dt-mdp-on .mydev-wrap, body.dt-mdp-on .mydev-table { visibility: hidden !important; }
.dt-layer .dt-dim.dt-mdp-dim { background: rgba(8, 12, 20, 0.34); animation: dt-fade 0.2s ease-out backwards; }
.dt-layer .dt-dim.dt-mdp-dim.dt-closing { animation: dt-fade-out 0.12s ease-in forwards; }
.dt-layer .dt-card.dt-mdp { position: absolute; left: 0; top: 0; width: 100%; height: 100%; min-height: 0; max-width: none; max-height: none;
  padding: 0; border: 0; border-radius: 0; background: none; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none;
  overflow: visible; animation: none; }
/* No pop-up glass, motion or head/foot on a page (ui.js paints its card with ::before). */
.dt-layer .dt-card.dt-mdp::before, .dt-layer .dt-card.dt-mdp::after { display: none; }
.dt-layer .dt-card.dt-mdp > *, .dt-closing .dt-card.dt-mdp > *, .dt-closing .dt-card.dt-mdp { animation: none; }
.dt-layer .dt-card.dt-mdp > .dt-head, .dt-layer .dt-card.dt-mdp > .dt-foot { display: none; }
.dt-layer .dt-card.dt-mdp > .dt-body { position: absolute; left: 0; top: 0; width: 100%; height: 100%; max-height: none; margin: 0; padding: 0; overflow: visible;
  text-align: left; font-family: "SofiaSansExtraCondensed-Light", "Oswald", sans-serif; font-size: calc(var(--dt) * 26.65px); line-height: 1.2; color: #fff; }
.dt-mdp-strip { position: absolute; left: calc(var(--dt) * 52px); top: calc(var(--dt) * 28px); width: calc(var(--dt) * 1816px);
  height: calc(var(--dt) * 82px); display: flex; border-radius: calc(var(--dt) * 8px); background: rgba(0, 0, 0, 0.36); pointer-events: auto; }
.dt-mdp-tab { flex: 1 1 0; display: flex; align-items: center; justify-content: center; cursor: pointer; white-space: nowrap;
  font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif; font-size: calc(var(--dt) * 34.7px);
  color: rgba(255, 255, 255, 0.5); transition: color 0.14s ease; }
.dt-mdp-tab:hover { color: rgba(255, 255, 255, 0.78); }
.dt-mdp-tab.dt-on { color: #fff; cursor: default; }
.dt-mdp-keys { position: absolute; left: calc(var(--dt) * 62px); top: calc(var(--dt) * 970px); height: calc(var(--dt) * 60px);
  display: flex; align-items: center; gap: calc(var(--dt) * 46px); }
.dt-mdp-key { display: flex; align-items: center; gap: calc(var(--dt) * 27px); height: 100%; pointer-events: auto; cursor: pointer;
  font-family: "SofiaSansExtraCondensed-Light", "Oswald", sans-serif; font-size: calc(var(--dt) * 42.7px); color: #fff; white-space: nowrap;
  transition: transform 0.16s ease, filter 0.16s ease; }
.dt-mdp-key:hover { filter: brightness(1.15); transform: translateY(calc(var(--dt) * -2px)); }
.dt-mdp-cap { display: flex; align-items: center; justify-content: center; min-width: calc(var(--dt) * 50px); height: calc(var(--dt) * 50px);
  padding: 0 calc(var(--dt) * 8px); border: calc(var(--dt) * 3px) solid #fff; border-radius: calc(var(--dt) * 9px);
  font-family: "SofiaSansExtraCondensed-Bold", "Oswald", sans-serif; font-size: calc(var(--dt) * 28px); line-height: 1; letter-spacing: calc(var(--dt) * 1px); }
/* The game's own ESC keycap (device pages, toolbar pages): heavy wide letters, thin rim, thick bottom lip. */
.dt-mdp-cap.dt-esc { min-width: calc(var(--dt) * 78px); height: calc(var(--dt) * 52px); padding: calc(var(--dt) * 3px) 0 0 calc(var(--dt) * 4px);
  border-width: calc(var(--dt) * 2.5px) calc(var(--dt) * 2.5px) calc(var(--dt) * 6px); border-radius: calc(var(--dt) * 10px);
  font-family: "Khand-Bold", "SofiaSansExtraCondensed-Black", "Oswald", sans-serif; font-size: calc(var(--dt) * 38px); letter-spacing: calc(var(--dt) * 4px); }
.dt-mdp-key.dt-on .dt-mdp-cap { background: #fff; color: rgb(24, 28, 38); }
.dt-mdp-note { position: absolute; font-family: "SofiaSansExtraCondensed-Light", "Oswald", sans-serif; font-size: calc(var(--dt) * 22px);
  color: rgba(255, 255, 255, 0.62); }
.dt-mdp-table { width: 100%; border-collapse: separate; border-spacing: 0.14em 0.2em; table-layout: fixed; }
.dt-mdp-table td { padding: 0.3em; color: #fff; background-color: rgba(0, 0, 0, 0.15); border-radius: 0.2em; text-align: center; vertical-align: middle; }
.dt-mdp-table td.dt-mdp-lab { background-color: rgba(255, 255, 255, 0.1); }
.dt-mdp-anim td { animation: dt-mdp-row-in 0.42s cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: var(--d, 0s); }
@keyframes dt-mdp-row-in { 0% { opacity: 0; transform: translateY(0.55em); filter: blur(4px); } 100% { opacity: 1; transform: none; filter: none; } }
.dt-mdp-scroll { overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; pointer-events: auto;
  scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.25) transparent; }
.dt-mdp-scroll::-webkit-scrollbar { width: calc(var(--dt) * 7px); }
.dt-mdp-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.25); border-radius: 3px; }
`;
  // Layers of the game screen kept while a page is up: its background only.
  const KEEP = /\[Blur\]|^BG|BACKGROUND/i;
  let hide = null; // { rt, layout, saved: Map(layer -> visible), fn }

  function css() {
    if (typeof document === "undefined" || document.getElementById("dt-mdp-css")) return;
    const st = document.createElement("style");
    st.id = "dt-mdp-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  function rt() {
    return globalThis.runtime || null;
  }
  // Hide the screen's own layers every frame the page is up, so the
  // game redrawing its table underneath (Compare reads pages that way) never shows.
  function hideOn() {
    const r = rt();
    if (hide || !r || !r.layout || typeof r.addEventListener !== "function") return;
    const h = { rt: r, layout: r.layout, saved: new Map(), fn: null };
    h.fn = () => {
      if (r.layout !== h.layout) return;
      for (const l of h.layout.getAllLayers()) {
        if (KEEP.test(l.name) || !l.isVisible) continue;
        if (!h.saved.has(l)) h.saved.set(l, true);
        l.isVisible = false;
      }
    };
    for (const l of h.layout.getAllLayers()) h.saved.set(l, !!l.isVisible);
    hide = h;
    try { document.body.classList.add("dt-mdp-on"); } catch (e) {}
    // "beforedraw" on the layout where the runtime has it; "tick" covers the rest.
    try { h.layout.addEventListener("beforedraw", h.fn); } catch (e) {}
    r.addEventListener("tick", h.fn);
    h.fn();
  }
  function hideOff() {
    const h = hide;
    if (!h) return;
    hide = null;
    try { document.body.classList.remove("dt-mdp-on"); } catch (e) {}
    try { h.layout.removeEventListener("beforedraw", h.fn); } catch (e) {}
    try { h.rt.removeEventListener("tick", h.fn); } catch (e) {}
    for (const [l, v] of h.saved) {
      try { if (!KEEP.test(l.name)) l.isVisible = v; } catch (e) {}
    }
  }
  // m: what _dtUi.modal returned. The page closes like the modal (Escape,
  // ESC Back); its layers come back before the caller's own onClose runs.
  function page(m) {
    css();
    if (!m || !m.dim) return null;
    m.dim.classList.add("dt-mdp-dim");
    const card = m.dim.querySelector(".dt-card");
    card.classList.add("dt-mdp");
    const prev = m.onClose;
    m.onClose = () => {
      hideOff();
      prev && prev();
    };
    hideOn();
    const keys = _dtUi.el("div", "dt-mdp-keys", m.body);
    return { body: m.body, keys: keys };
  }
  function tap(name) {
    try { globalThis[name] && globalThis[name](); } catch (e) {}
  }
  // The game's tab strip. tabs: [{id, label}]; pick(id) runs on a press of another tab.
  function strip(parent, tabs, cur, pick) {
    const el = _dtUi.el("div", "dt-mdp-strip", parent);
    const set = (id) => {
      for (const t of el.children) t.classList.toggle("dt-on", t.dataset.id === id);
    };
    for (const t of tabs) {
      const b = _dtUi.el("div", "dt-mdp-tab", el, t.label);
      b.dataset.id = t.id;
      b.addEventListener("pointerover", () => { if (!b.classList.contains("dt-on")) tap("tapHover"); });
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (b.classList.contains("dt-on")) return;
        tap("tapMain");
        set(t.id);
        pick(t.id);
      });
    }
    set(cur);
    return { el: el, set: set };
  }
  // Filled icons in the game's own style (the My Devices icon column), per device type.
  const ICON = {
    all: "M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z",
    phone: "M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z",
    laptop: "M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z",
    tablet: "M18 0H6C4.34 0 3 1.34 3 3v18c0 1.66 1.34 3 3 3h12c1.66 0 3-1.34 3-3V3c0-1.66-1.34-3-3-3zm-4 22h-4v-1h4v1zm5.25-3H4.75V3h14.5v16z",
    headphones: "M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z",
    watch: "M20 12c0-2.54-1.19-4.81-3.04-6.27L16 0H8l-.95 5.73C5.19 7.19 4 9.45 4 12s1.19 4.81 3.05 6.27L8 24h8l.96-5.73C18.81 16.81 20 14.54 20 12zM6 12c0-3.31 2.69-6 6-6s6 2.69 6 6-2.69 6-6 6-6-2.69-6-6z",
    tv: "M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z",
    scooter: "M19 13c-.34 0-.66.05-.97.13L15.4 5.2A1.75 1.75 0 0 0 13.74 4H11v2h2.74l2.4 7.2A4 4 0 0 0 15.1 16H8.9A4 4 0 1 0 9 17h6a4 4 0 1 0 4-4zM5 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm14 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4z",
    keyboard: "M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z",
    console: "M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z",
    vr: "M20.74 6H3.21C2.55 6 2 6.57 2 7.28v10.44c0 .7.55 1.28 1.23 1.28h4.79c.52 0 .96-.33 1.14-.79l1.4-3.48c.23-.59.79-1.01 1.44-1.01s1.21.42 1.45 1.01l1.39 3.48c.19.46.63.79 1.11.79h4.79c.71 0 1.26-.57 1.26-1.28V7.28c0-.7-.55-1.28-1.26-1.28zM7.5 14.62c-1.17 0-2.13-.95-2.13-2.12 0-1.17.96-2.13 2.13-2.13s2.12.96 2.12 2.13-.95 2.12-2.12 2.12zm9 0c-1.17 0-2.13-.95-2.13-2.12 0-1.17.96-2.13 2.13-2.13s2.13.96 2.13 2.13-.96 2.12-2.13 2.12z",
  };
  // The game's icon column down the left: items [{id, label}] (id = a device type or "all").
  function icons(parent, items, cur, pick) {
    const el = _dtUi.el("div", "dt-mdp-icons" + (items.length > 8 ? " dt-many" : ""), parent);
    for (const it of items) {
      const b = _dtUi.el("div", "dt-mdp-ico" + (it.id === cur ? " dt-on" : ""), el);
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (ICON[it.id] || ICON.all) + '"/></svg>';
      b.title = it.label;
      b.addEventListener("pointerover", () => { if (!b.classList.contains("dt-on")) tap("tapHover"); });
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (b.classList.contains("dt-on")) return;
        tap("tapMain");
        pick(it.id);
      });
    }
    return el;
  }
  // A key hint like the game's "ESC  Back": keycap, then the word.
  function key(parent, cap, label, onClick) {
    const k = _dtUi.el("div", "dt-mdp-key", parent);
    _dtUi.el("div", "dt-mdp-cap", k, cap);
    const l = _dtUi.el("span", "", k, label);
    k.addEventListener("pointerover", () => tap("tapHover"));
    k.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onClick();
    });
    k.label = l;
    return k;
  }
  // "ESC  Back": closes the page like the game's own Back.
  function back(parent) {
    const k = key(parent, "ESC", _dtUi.ru() ? "Назад" : "Back", () => {
      tap("tapBack");
      _dtUi.close();
    });
    k.firstChild.classList.add("dt-esc");
    return k;
  }
  return { css: css, page: page, strip: strip, icons: icons, key: key, back: back, hiding: () => !!hide };
})();
