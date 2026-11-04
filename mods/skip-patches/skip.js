// ── Skip slow screens + price card forecast ──
// Skip: a "SPACE Skip" key button (and Space / Enter) on the batch delivery
// bar and the review cards. Delivery is the game's own 6 s tween (263 BATCH
// DELIVERY): the skip runs the game clock fast until the layout ends, so every
// event and tween of the screen still runs, in order, just sooner. The review
// cards are the game's HTML overlay: the skip stops its timers and puts the
// screen in the state its last timer leaves it in (all cards, summary shown and
// folded into the corner, Next enabled). Scores, money and the device rows are
// written by the game's own sheets before (engine at layout start) and after
// (Next), so a skip cannot change them. The device presentation (also each
// device of a launch event's show) auto-plays its spec lines before a click on
// the stage goes on; "SPACE Show all" shows its last slide, the tiles grid, at
// once (the game's own "ESC Skip" button there still leaves the show). Its
// results are worked out on the FINISH screen and do not depend on the show.
// Nothing that asks the player anything is skipped. Once the review screen
// waits for the player, the button says "SPACE Continue": the game itself moves
// on with a tap or Esc (282 REVIEWS UI [Engine]), so Space / Enter / a click
// send it that Esc, once, and not in the first half second (a quick second
// press of Skip stays on the score).
// Forecast: on the price page, one line under the slider, "Price score in reviews:
// 7-8/10 (24% over cost)", from the review engines' own price bands (read out of the
// event sheets at build time) and the phrase scores in ArrayReviews_DB. With
// fair price reviews on (fairprice.js) the bands judge the markup minus the
// same allowance for the device's specs the reviews use: "(44% over cost, strong
// specs +12%)".
var _DT_SKIP_TABLE = __DT_SKIP_TABLE__;
var _DT_SKIP_FAST = 40; // game clock multiplier while a delivery is skipped
var _DT_SKIP_TEXT = {
  skip: { en: "Skip", ru: "Пропустить" },
  cont: { en: "Continue", ru: "Продолжить" },
  // The presentation already has the game's own "ESC Skip" (to the next device); ours shows the last slide.
  showAll: { en: "Show all", ru: "Показать всё" },
  card: { en: "Price score in reviews:", ru: "Оценка цены в обзорах:" },
  outOf: { en: "{s}/10", ru: "{s}/10" },
  markup: { en: "({m}% over cost)", ru: "(на {m}% выше себестоимости)" },
  markupFair: { en: "({m}% over cost, {why})", ru: "(на {m}% выше себестоимости, {why})" },
  strong: { en: "strong specs allow {p}% more", ru: "за сильные характеристики можно на {p}% больше" },
  weak: { en: "weak specs allow {p}% less", ru: "за слабые характеристики нужно на {p}% меньше" },
  // Below 35% the price phrase is one of ~45 shuffled aspects and only the first 4 are shown.
  maybe: { en: "reviewers rarely mention price", ru: "цену в обзорах упоминают редко" },
};
var _DT_SKIP_CONT_WAIT = 500; // ms before Continue answers, so a double press of Skip stays on the score
var _dtSkip = { btn: null, line: null, what: "", since: 0, sent: false, fastFrom: null, wired: false, timer: null, revWait: 0 };
var _DT_SKIP_WAIT_FRAMES = 180;

// ── Price card forecast ──
// The review engines compare (SELL * 100 / COST) - 100 with the band edges.
function _dtSkipMarkup(price, cost) {
  price = Number(price);
  cost = Number(cost);
  if (!(cost > 0) || !Number.isFinite(price)) return null;
  return (price * 100) / cost - 100;
}
function _dtSkipBand(markup, table) {
  table = table || _DT_SKIP_TABLE;
  if (markup === null || !Number.isFinite(markup)) return null;
  for (const b of table.bands) {
    if ((b.min === null || markup >= b.min) && (b.max === null || markup < b.max)) return b;
  }
  return null;
}
// Score range of a band: phrase id round(random(lo, hi)) then score
// round(random(DB min, DB max)) (282 REVIEWS ReviewsEngineResults).
function _dtSkipScores(band, db) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let id = band.lo; id <= band.hi; id++) {
    const a = Number(db(0, id));
    const b = Number(db(1, id));
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    lo = Math.min(lo, Math.round(Math.min(a, b)));
    hi = Math.max(hi, Math.round(Math.max(a, b)));
  }
  return lo === Infinity ? null : { lo: lo, hi: hi };
}
function _dtSkipForecast(g, db, table) {
  table = table || _DT_SKIP_TABLE;
  // The price page comes before LOADING EDITOR sets DeviceTypeCreatingNow, so
  // the editor's DeviceType names the review engine (via the game's own map).
  const type = table.editor[String(g.DeviceType || "")];
  if (!type || !table.types[type]) return null; // gamepads, CPUs and GPUs get no price card
  const m = _dtSkipMarkup(g.DevicePrice, g.DeviceCostPrice);
  // Fair price reviews: the one function the review engines' price checks call.
  const fair = m !== null && typeof _dtFairForecast === "function" ? _dtFairForecast(g.DeviceType, g.DeviceCostPrice) : null;
  const allow = fair ? fair.allowance : 0;
  const band = _dtSkipBand(m === null ? null : m - allow, table);
  if (!band) return null;
  const s = _dtSkipScores(band, db);
  if (!s) return null;
  return { markup: m, shown: Math.floor(m + 1e-9), lo: s.lo, hi: s.hi, front: !!band.front, allow: allow };
}
function _dtSkipForecastText(f) {
  const s = f.lo === f.hi ? String(f.lo) : f.lo + "-" + f.hi;
  const why = f.allow ? _dtUi.t(f.allow > 0 ? _DT_SKIP_TEXT.strong : _DT_SKIP_TEXT.weak, { p: Math.abs(f.allow) }) : "";
  const sub = why ? _dtUi.t(_DT_SKIP_TEXT.markupFair, { m: f.shown, why: why }) : _dtUi.t(_DT_SKIP_TEXT.markup, { m: f.shown });
  return { label: _dtUi.t(_DT_SKIP_TEXT.card), score: _dtUi.t(_DT_SKIP_TEXT.outOf, { s: s }), sub: sub, maybe: f.front ? "" : _dtUi.t(_DT_SKIP_TEXT.maybe) };
}
function _dtSkipDb() {
  try {
    const a = globalThis.runtime.objects.ArrayReviews_DB.getFirstInstance();
    if (a && a.height > 0) return (x, y) => a.getAt(x, y, 0);
  } catch (e) {}
  return null;
}
function _dtSkipSliderRect() {
  try {
    const i = globalThis.runtime.objects.SliderBarPrice.getFirstInstance();
    const el = i && i.getElement ? i.getElement() : null;
    // Follow the slider as it moves, after the game's own handler has set $DevicePrice.
    if (el && !el._dtSkipLive) {
      el._dtSkipLive = true;
      el.addEventListener("input", () => requestAnimationFrame(_dtSkipPriceTick));
    }
    const r = el && el.getBoundingClientRect();
    if (r && r.width > 0) return r;
  } catch (e) {}
  return null;
}
function _dtSkipPriceTick() {
  // Only while the page is live: Create and Back change $class before the fade out.
  const onPage = _dtUi.layoutName() === "EDITOR PRICE PAGE" && String(globalThis.runtime.globalVars.class) === "EDITOR PRICE PAGE";
  const db = onPage ? _dtSkipDb() : null;
  const f = db ? _dtSkipForecast(globalThis.runtime.globalVars, db) : null;
  const r = f ? _dtSkipSliderRect() : null;
  if (!f || !r) {
    if (_dtSkip.line) {
      _dtSkip.line.remove();
      _dtSkip.line = null;
    }
    return;
  }
  const layer = _dtUi.ensure();
  _dtUi.fit();
  let n = _dtSkip.line;
  if (!n || !n.isConnected) {
    n = _dtSkip.line = _dtUi.el("div", "dt-skip-card", layer);
    _dtUi.el("span", "dt-skip-label", n);
    _dtUi.el("span", "dt-skip-score", n);
    _dtUi.el("span", "dt-skip-sub", n);
    _dtUi.el("span", "dt-skip-maybe", n);
  }
  const t = _dtSkipForecastText(f);
  const parts = [t.label, t.score, t.sub, t.maybe];
  for (let i = 0; i < 4; i++) if (n.children[i].textContent !== parts[i]) n.children[i].textContent = parts[i];
  n.children[3].style.display = t.maybe ? "" : "none";
  // Score colour steps with the band, like the slider's green-to-red track.
  const tone = f.lo >= 9 ? "great" : f.lo >= 7 ? "good" : f.lo >= 5 ? "fair" : f.lo >= 3 ? "poor" : "bad";
  if (n.dataset.tone !== tone) n.dataset.tone = tone;
  const lr = layer.getBoundingClientRect();
  const left = Math.round(r.left + r.width / 2 - lr.left) + "px";
  const top = Math.round(r.top + r.height - lr.top) + "px";
  if (n.style.left !== left) n.style.left = left;
  if (n.style.top !== top) n.style.top = top;
}

// ── Skip ──
function _dtSkipReviewsRoot() {
  try {
    return _container7 ? _container7.querySelector("#reviews-root") : null;
  } catch (e) {
    return null;
  }
}
// The device presentation (PRESENTATION <TYPE> V2, also each device of a launch
// event's show) auto-plays its spec lines; the game's own click only moves on
// once the last slide, the tiles grid (category _TABS_CAT), is up ($MiniPage).
function _dtSkipPresentationOn() {
  try {
    if (!_root4 || !_root4.isConnected || _activeCat === _TABS_CAT) return false;
    if (Number(globalThis.runtime.globalVars.MiniPage) === _TABS_CAT) return false;
    return _readSteps().some((st) => st.cat === _TABS_CAT);
  } catch (e) {
    return false;
  }
}
// What presentationShowAll reaches at its last step: the tiles grid, shown by
// the player's own _showStep (which fades the current lines out first).
function _dtSkipPresentation() {
  if (!_dtSkipPresentationOn()) return false;
  const steps = _readSteps();
  const first = steps.findIndex((st) => st.cat === _TABS_CAT);
  let last = first;
  while (last + 1 < steps.length && steps[last + 1].cat === _TABS_CAT) last++;
  _clearTimers2();
  _unlock();
  _stepIdx = last;
  _showStep(steps[first]);
  _autoPlaying = false;
  return true;
}
// What the skip would end right now: "delivery", "reviews", "presentation" or "".
function _dtSkipWhat() {
  const rt = globalThis.runtime;
  if (!rt || !rt.globalVars || _dtUi.isOpen()) return "";
  const lay = _dtUi.layoutName();
  if (lay === "BATCH DELIVERY") return _dtSkip.fastFrom === null ? "delivery" : "";
  if (lay === "REVIEWS") {
    const root = _dtSkipReviewsRoot();
    if (!root || !root.isConnected || root.classList.contains("soft-exit")) return "";
    if (Number(rt.globalVars.ReviewNextActive) !== 0) return _dtSkip.sent ? "" : "continue";
    return "reviews";
  }
  if (/^PRESENTATION .+ V2$/.test(lay)) return _dtSkipPresentationOn() ? "presentation" : "";
  return "";
}
function _dtSkipRestoreClock() {
  if (_dtSkip.fastFrom === null) return;
  try {
    globalThis.runtime.timeScale = _dtSkip.fastFrom;
  } catch (e) {}
  _dtSkip.fastFrom = null;
}
function _dtSkipDelivery() {
  const rt = globalThis.runtime;
  if (_dtSkip.fastFrom !== null) return false;
  _dtSkip.fastFrom = rt.timeScale;
  rt.timeScale = _dtSkip.fastFrom * _DT_SKIP_FAST;
  return true;
}
// The state _scheduleSummarySequence's last timer leaves the review screen in.
// frame: called from the wait below (not a key press).
function _dtSkipReviews(frame) {
  const root = _dtSkipReviewsRoot();
  if (!root || root.classList.contains("soft-exit")) {
    _dtSkip.revWait = 0;
    return false;
  }
  // The cards get their enter class on the frame after the screen is built: one wait
  // at a time (more presses join it), given up after about 3 s of frames.
  const cards = Array.from(root.querySelectorAll(".review-card"));
  if (!cards.length || cards.some((c) => !c.classList.contains("rc-enter"))) {
    if (frame !== true) {
      if (_dtSkip.revWait > 0) return true;
      _dtSkip.revWait = _DT_SKIP_WAIT_FRAMES;
    }
    if (--_dtSkip.revWait <= 0) {
      _dtSkip.revWait = 0;
      return false;
    }
    requestAnimationFrame(() => _dtSkipReviews(true));
    return true;
  }
  _dtSkip.revWait = 0;
  _clearTimers();
  root.querySelectorAll(".rc-metric-val").forEach((e) => {
    e.textContent = _formatCount(parseInt(e.dataset.target, 10) || 0);
  });
  const title = root.querySelector("#reviews-title");
  if (title && root.classList.contains("soft-mode")) {
    title.classList.remove("rc-soft-fade-in-new");
    title.classList.add("rc-soft-move-up");
  }
  const blur = root.querySelector("#reviews-blur-overlay");
  if (blur) {
    blur.classList.remove("rc-blur-in");
    blur.classList.add("rc-blur-out");
  }
  const sum = root.querySelector("#reviews-summary");
  if (sum) sum.classList.add("rc-summary-show", "rc-summary-hide");
  const corner = root.querySelector("#reviews-summary-corner");
  if (corner) corner.classList.add("rc-corner-show");
  root.classList.remove("rc-no-hover");
  for (const a of root.getAnimations({ subtree: true })) {
    try {
      if (a.effect && a.effect.getComputedTiming().endTime !== Infinity) a.finish();
    } catch (e) {}
  }
  _armGamepadStepIfNeeded();
  _setReviewNextActive(1);
  return true;
}
// The game's own way off the review screen: Esc, as the player would press it.
function _dtSkipContinue() {
  if (_dtSkip.what !== "continue" || Date.now() - _dtSkip.since < _DT_SKIP_CONT_WAIT) return false;
  _dtSkip.sent = true;
  const k = { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true };
  try {
    globalThis.dispatchEvent(new KeyboardEvent("keydown", k));
    setTimeout(() => {
      try { globalThis.dispatchEvent(new KeyboardEvent("keyup", k)); } catch (e) {}
    }, 60);
  } catch (e) {}
  return true;
}
function _dtSkipNow() {
  const what = _dtSkipWhat();
  if (!what) return false;
  const done = what === "delivery" ? _dtSkipDelivery() : what === "reviews" ? _dtSkipReviews() :
    what === "continue" ? _dtSkipContinue() : _dtSkipPresentation();
  _dtSkipSync();
  return done;
}
function _dtSkipSync() {
  const what = _dtSkipWhat();
  const lay = _dtUi.layoutName();
  if (lay !== "BATCH DELIVERY") _dtSkipRestoreClock();
  // The next device's reviews (a launch event) start with Next off again.
  const g = globalThis.runtime && globalThis.runtime.globalVars;
  if (lay !== "REVIEWS" || !g || Number(g.ReviewNextActive) === 0) _dtSkip.sent = false;
  if (what !== _dtSkip.what) {
    _dtSkip.since = Date.now();
    // Skip turns into Continue: a fresh button, so it fades in like the first.
    if (what === "continue" && _dtSkip.btn) {
      _dtSkip.btn.remove();
      _dtSkip.btn = null;
    }
  }
  _dtSkip.what = what;
  if (!what) {
    if (_dtSkip.btn) {
      _dtSkip.btn.remove();
      _dtSkip.btn = null;
    }
    return;
  }
  const label = _dtUi.t(what === "presentation" ? _DT_SKIP_TEXT.showAll : what === "continue" ? _DT_SKIP_TEXT.cont : _DT_SKIP_TEXT.skip);
  if (_dtSkip.btn && _dtSkip.btn.isConnected) {
    if (_dtSkip.btn.children[1].textContent !== label) _dtSkip.btn.children[1].textContent = label;
    return;
  }
  const layer = _dtUi.ensure();
  _dtUi.fit();
  // Continue sits bottom right: the game's score box takes the top right corner by then.
  const b = (_dtSkip.btn = _dtUi.el("div", what === "continue" ? "dt-skip-btn dt-skip-cont" : "dt-skip-btn", layer));
  _dtUi.el("div", "dt-skip-key", b, "SPACE");
  _dtUi.el("span", "", b, label);
  b.addEventListener("pointerover", () => {
    try { globalThis.tapHover && globalThis.tapHover(); } catch (e) {}
  });
  b.addEventListener("click", (ev) => {
    ev.stopPropagation();
    try { globalThis.tapMain && globalThis.tapMain(); } catch (e) {}
    _dtSkipNow();
  });
}
function _dtSkipKey(ev) {
  if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (ev.key !== " " && ev.key !== "Enter") return;
  const tag = ev.target && ev.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (!_dtSkipWhat()) return;
  ev.preventDefault();
  ev.stopPropagation();
  _dtSkipNow();
}
var _DT_SKIP_CSS = `
.dt-skip-btn { position: absolute; right: calc(var(--dt) * 64px); top: calc(var(--dt) * 52px); height: calc(var(--dt) * 50px);
  display: flex; align-items: center; gap: calc(var(--dt) * 18px); pointer-events: auto; cursor: pointer;
  font-family: "SofiaSansExtraCondensed-Light", "Oswald", sans-serif; font-size: calc(var(--dt) * 42px); color: #fff;
  text-shadow: 0 calc(var(--dt) * 1px) calc(var(--dt) * 4px) rgba(0, 0, 0, 0.35);
  animation: dt-fade 0.22s ease-out backwards; transition: transform 0.16s ease, filter 0.16s ease; }
.dt-skip-btn.dt-skip-cont { top: auto; bottom: calc(var(--dt) * 52px); }
.dt-skip-btn:hover { filter: brightness(1.15); transform: translateY(calc(var(--dt) * -2px)); }
.dt-skip-key { display: flex; align-items: center; justify-content: center; height: calc(var(--dt) * 50px);
  padding: 0 calc(var(--dt) * 14px); box-sizing: border-box;
  border: calc(var(--dt) * 3px) solid #fff; border-radius: calc(var(--dt) * 9px);
  font-family: "SofiaSansExtraCondensed-Bold", "Oswald", sans-serif; font-size: calc(var(--dt) * 24px); line-height: 1; letter-spacing: 0.06em; }
.dt-skip-card { position: absolute; transform: translate(-50%, calc(var(--dt) * 20px)); white-space: nowrap; pointer-events: none;
  display: flex; align-items: baseline; gap: calc(var(--dt) * 10px);
  font-family: "SofiaSansExtraCondensed-Light", "Oswald", sans-serif; font-size: calc(var(--dt) * 32px); color: rgba(255, 255, 255, 0.72);
  animation: dt-fade 0.22s ease-out 0.45s backwards; /* delay waits for the game's own result tween */ }
.dt-skip-label { color: rgba(255, 255, 255, 0.9); }
.dt-skip-score { font-family: "SofiaSansExtraCondensed-Bold", "Oswald", sans-serif; color: #fff; transition: color 0.16s ease; }
.dt-skip-card[data-tone="great"] .dt-skip-score { color: #5BE36B; }
.dt-skip-card[data-tone="good"] .dt-skip-score { color: #B7E83A; }
.dt-skip-card[data-tone="fair"] .dt-skip-score { color: #FFD600; }
.dt-skip-card[data-tone="poor"] .dt-skip-score { color: #FF9E14; }
.dt-skip-card[data-tone="bad"] .dt-skip-score { color: #FF5A4E; }
.dt-skip-maybe::before { content: "·"; margin-right: calc(var(--dt) * 10px); }
`;
(function () {
  if (_dtSkip.wired || typeof document === "undefined") return;
  _dtSkip.wired = true;
  if (!document.getElementById("dt-skip-css")) {
    const st = document.createElement("style");
    st.id = "dt-skip-css";
    st.textContent = _DT_SKIP_CSS;
    document.head.appendChild(st);
  }
  // Capture phase: Space / Enter skip and never reach the game underneath.
  document.addEventListener("keydown", _dtSkipKey, true);
  // The fast clock must stop the moment the delivery screen ends, before the
  // office's first tick: the calendar runs there.
  const hook = () => {
    try {
      const rt = globalThis.runtime;
      if (!rt || !rt.addEventListener || _dtSkip.hooked) return;
      _dtSkip.hooked = true;
      rt.addEventListener("beforeanylayoutend", _dtSkipRestoreClock);
      rt.addEventListener("afteranylayoutstart", () => {
        if (_dtUi.layoutName() !== "BATCH DELIVERY") _dtSkipRestoreClock();
        // A new screen gets its key at once rather than at the next check.
        try { _dtSkipSync(); } catch (e) {}
      });
    } catch (e) {}
  };
  // The shared mod timer (ui.js every) when ui.js is in; a timer of our own without it.
  _dtSkip.timer = (typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(() => {
    hook();
    try {
      _dtSkipSync();
      _dtSkipPriceTick();
    } catch (e) {}
    // 4 a second like the other mods: the slider's own input event moves the
    // forecast while dragging, and a new screen syncs on its start (above).
  }, 250);
  globalThis._dtSkipApi = {
    what: _dtSkipWhat, skip: _dtSkipNow, forecast: _dtSkipForecast, text: _dtSkipForecastText, band: _dtSkipBand, markup: _dtSkipMarkup,
    table: () => _DT_SKIP_TABLE, state: () => _dtSkip,
  };
})();
