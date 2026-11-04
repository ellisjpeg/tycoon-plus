// ── Difficulty in the game's own Settings page ──
// A "Tycoon+" group with a Difficulty page in the game's Settings list, built
// from the page's own parts (_row14, _card, _slider, .gs-seg, .gs-empty), so it
// looks and acts like General / Sound / Video. Values are kept in the game's
// settings draft, so its "unsaved changes" line and Apply button work as for
// any other row; Apply writes them to the company's ArraySaves row 150 (the
// same row and format as before). Difficulty is saved per company, so the page
// only edits it while a company is loaded; from the main menu it says so.
var _DT_DIFF_PAGE = "dt-difficulty";
var _DT_DIFF_DRAFT = { buy: "dtBuy", cost: "dtCost", research: "dtResearch", rivals: "dtRivals", build: "dtBuild" };
var _DT_DIFF_SET_TEXT = {
  group: { en: "Tycoon+", ru: "Tycoon+" },
  sub: { en: "Saved with {company} · takes effect the next game day after you press Apply", ru: "Сохраняется для {company} · действует со следующего игрового дня после «Применить»" },
  subMenu: { en: "Saved with each company", ru: "Сохраняется для каждой компании" },
  noCompany: { en: "Load a company to change its difficulty", ru: "Загрузите компанию, чтобы изменить её сложность" },
  preset: { en: "Preset", ru: "Набор" },
  presetSub: { en: "Moving a slider switches to Custom", ru: "Движение ползунка включает «Свой»" },
  custom: { en: "Custom", ru: "Свой" },
  note: { en: "The small mark on each slider is the normal game value. Outside Original, phone parts follow real-life dates and prices.", ru: "Метка на ползунке — обычное значение игры. Кроме набора «Как в игре», детали телефонов следуют реальным датам и ценам." },
};
// Material "tune" (sliders) glyph, drawn as a mask like the game's own nav icons.
var _DT_DIFF_ICON = "M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z";
var _DT_DIFF_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8l2.75 5.9 6.45.72-4.8 4.38 1.33 6.36L12 16.9l-5.73 3.26 1.33-6.36-4.8-4.38 6.45-.72z"/></svg>';
var _dtDiffCustom = false;
var _DT_DIFF_GS_CSS = `
.dt-gs-trk { position: relative; flex: 1 1 auto; min-width: 0; display: flex; align-items: center; }
.dt-gs-trk .gs-range { width: 100%; }
.dt-gs-mark { position: absolute; top: 50%; width: 2px; height: calc(var(--gs, 1) * 22px); margin: calc(var(--gs, 1) * -11px) 0 0 -1px;
  border-radius: 2px; background: rgba(255, 255, 255, 0.5); pointer-events: none; transition: opacity 0.15s; }
.dt-gs-mark.dt-gs-at { opacity: 0; }
.gs-slider-val.dt-gs-ch { color: rgb(var(--acc)); }
.gs-seg-btn .dt-gs-star { width: calc(var(--gs, 1) * 15px); height: calc(var(--gs, 1) * 15px); margin-right: calc(var(--gs, 1) * 7px); color: rgb(var(--acc)); }
.gs-seg-btn.gs-seg-on .dt-gs-star { color: rgb(var(--ink)); }
.gs-seg-btn .dt-gs-star svg { display: block; width: 100%; height: 100%; }
.dt-gs-note { padding: calc(var(--gs, 1) * 16px) calc(var(--gs, 1) * 22px) 0; max-width: calc(var(--gs, 1) * 1180px);
  font-size: calc(var(--gs, 1) * 16px); color: rgba(255, 255, 255, 0.46); letter-spacing: calc(var(--gs, 1) * 0.4px); }
.dt-gs-empty-ic { width: calc(var(--gs, 1) * 42px); height: calc(var(--gs, 1) * 42px); background-color: #fff; opacity: 0.5; }
`;

function _dtDiffGsT(key, vars) {
  return _dtUi.t(_DT_DIFF_SET_TEXT[key] || _DT_DIFF_TEXT[key], vars);
}
// A company is loaded: the in-game Settings (over the office), not the main menu's.
function _dtDiffCanEdit() {
  const lay = _dtUi.layoutName();
  if (!lay || lay === "SETTINGS" || lay === "MENU" || lay === "START PAGE" || lay === "LOADING GAME") return false;
  return !!_dtDiffCompanyNow();
}
function _dtDiffRound(v) {
  return Math.round(Number(v) * 100) / 100;
}
function _dtDiffDraftVals() {
  const o = {};
  for (const k of _DT_DIFF_KEYS) o[k] = _draft[_DT_DIFF_DRAFT[k]];
  return o;
}
function _dtDiffPresetOf(vals) {
  if (_dtDiffCustom) return "custom";
  for (const p in _DT_DIFF_PRESETS) if (_DT_DIFF_KEYS.every((k) => _DT_DIFF_PRESETS[p][k] === vals[k])) return p;
  return "custom";
}
// The draft gets the company's values whenever the page reads its settings.
function _dtDiffDraftIn() {
  _dtDiffCustom = false;
  if (!_draft || !_saved) return;
  const can = _dtDiffCanEdit();
  if (can) _dtDiffLoad();
  for (const k of _DT_DIFF_KEYS) {
    const key = _DT_DIFF_DRAFT[k];
    if (can) _draft[key] = _saved[key] = _dtDiff[k];
    else {
      delete _draft[key];
      delete _saved[key];
    }
  }
}
// Apply: the game's own button. The values go to the company's row first.
function _dtDiffApplyDraft() {
  if (!_draft || _draft.dtBuy === undefined || !_dtDiffCanEdit()) return;
  _dtDiffLoad();
  let changed = false;
  for (const k of _DT_DIFF_KEYS) {
    const v = _dtDiffClamp(k, _draft[_DT_DIFF_DRAFT[k]]);
    if (v !== _dtDiff[k]) {
      _dtDiff[k] = v;
      changed = true;
    }
  }
  if (!changed) return;
  _dtDiffSave();
  _dtDiffApplyRivals();
}
function _dtDiffNav() {
  const nav = _container15 && _container15.querySelector("#gs-nav");
  const video = nav && nav.querySelector('[data-page="video"]');
  if (!video) return;
  const y = nav.scrollTop;
  const group = _el2("div", "gs-nav-group", nav);
  group.textContent = _dtDiffGsT("group");
  const item = _navItem(nav, _DT_DIFF_PAGE, _dtDiffGsT("title"), { svg: _DT_DIFF_ICON }, null);
  nav.insertBefore(group, video.nextSibling);
  nav.insertBefore(item, group.nextSibling);
  nav.scrollTop = y;
}
function _dtDiffGsCss() {
  if (document.getElementById("dt-diff-gs-css")) return;
  const st = document.createElement("style");
  st.id = "dt-diff-gs-css";
  st.textContent = _DT_DIFF_GS_CSS;
  document.head.appendChild(st);
}
// The page itself, in the same head/body the game's _renderMain fills.
function _dtDiffPage(opts) {
  const head = _container15.querySelector("#gs-main-head"), body = _container15.querySelector("#gs-main-body");
  if (!head || !body) return;
  _dtDiffGsCss();
  const keep = !!(opts && opts.noAnim), y = keep ? body.scrollTop : 0;
  head.innerHTML = "";
  body.innerHTML = "";
  const row = _el2("div", "gs-h-row", head), titles = _el2("div", "gs-h-titles", row);
  _el2("div", "gs-h1", titles).textContent = _dtDiffGsT("title");
  const can = _dtDiffCanEdit() && _draft && _draft.dtBuy !== undefined;
  _el2("div", "gs-h-sub", titles).textContent = can ? _dtDiffGsT("sub", { company: _dtDiffCompanyNow() }) : _dtDiffGsT("subMenu");
  if (!can) {
    const empty = _el2("div", "gs-empty", body);
    _maskIcon(empty, "dt-gs-empty-ic", { svg: _DT_DIFF_ICON });
    _el2("div", "", empty).textContent = _dtDiffGsT("noCompany");
  } else {
    const defaults = _el2("div", "gs-btn gs-btn-ghost", row);
    defaults.textContent = _t8("defaults");
    defaults.addEventListener("click", () => {
      globalThis.tapMain?.();
      setPreset("original");
    });
    const card = _card(body);
    const seg = _el2("div", "gs-seg", _row14(card, _dtDiffGsT("preset"), _dtDiffGsT("presetSub")));
    const segs = {};
    for (const p of Object.keys(_DT_DIFF_PRESETS).concat("custom")) {
      const b = _el2("div", "gs-seg-btn", seg);
      if (p === _DT_DIFF_RECOMMENDED) _el2("span", "dt-gs-star", b).innerHTML = _DT_DIFF_STAR;
      _el2("span", "", b).textContent = _dtDiffGsT(p);
      b.addEventListener("click", () => {
        if (b.classList.contains("gs-seg-on")) return;
        globalThis.tapMain?.();
        setPreset(p);
      });
      segs[p] = b;
    }
    const sliders = {};
    for (const k of _DT_DIFF_KEYS) {
      const [min, max] = _DT_DIFF_RANGE[k];
      const input = _slider(_row14(card, _dtDiffGsT(k), _dtDiffGsT(k + "Sub")), min, max, 0.05, _draft[_DT_DIFF_DRAFT[k]], "", (v) => {
        _draft[_DT_DIFF_DRAFT[k]] = _dtDiffClamp(k, _dtDiffRound(v));
        _dtDiffCustom = true;
        sync();
        _syncFooter();
      });
      // The normal game value (1) as a small mark on the track, under the thumb's centre line.
      const trk = _el2("div", "dt-gs-trk", null);
      input.parentNode.insertBefore(trk, input);
      trk.appendChild(input);
      const mark = _el2("div", "dt-gs-mark", trk);
      const f = (1 - min) / (max - min);
      mark.style.left = "calc(var(--gs, 1) * 10px + (100% - var(--gs, 1) * 20px) * " + f.toFixed(4) + ")";
      sliders[k] = { input, mark, val: trk.parentNode.querySelector(".gs-slider-val"), min, max };
    }
    _el2("div", "dt-gs-note", body).textContent = _dtDiffGsT("note");
    function sync() {
      const vals = _dtDiffDraftVals();
      const on = _dtDiffPresetOf(vals);
      for (const p in segs) segs[p].classList.toggle("gs-seg-on", p === on);
      for (const k of _DT_DIFF_KEYS) {
        const s = sliders[k], v = vals[k];
        if (Number(s.input.value) !== v) s.input.value = String(v);
        s.input.style.setProperty("--fill", (((v - s.min) / (s.max - s.min)) * 100).toFixed(2) + "%");
        s.val.textContent = "×" + v.toFixed(2);
        s.val.classList.toggle("dt-gs-ch", v !== 1);
        s.mark.classList.toggle("dt-gs-at", v === 1);
      }
    }
    function setPreset(p) {
      _dtDiffCustom = p === "custom";
      const pr = _DT_DIFF_PRESETS[p];
      if (pr) for (const k of _DT_DIFF_KEYS) _draft[_DT_DIFF_DRAFT[k]] = pr[k];
      sync();
      _syncFooter();
    }
    sync();
  }
  body.classList.remove("gs-anim");
  if (!keep) {
    void body.offsetWidth;
    body.classList.add("gs-anim");
  }
  body.scrollTop = y;
}

_readAll = (function (orig) {
  return function () {
    const r = orig.apply(this, arguments);
    try {
      _dtDiffDraftIn();
    } catch (e) {
      console.warn("[Difficulty] settings read:", e);
    }
    return r;
  };
})(_readAll);
applyGameSettings = (function (orig) {
  return function () {
    try {
      _dtDiffApplyDraft();
    } catch (e) {
      console.warn("[Difficulty] settings apply:", e);
    }
    return orig.apply(this, arguments);
  };
})(applyGameSettings);
_renderNav = (function (orig) {
  return function () {
    const r = orig.apply(this, arguments);
    try {
      _dtDiffNav();
    } catch (e) {
      console.warn("[Difficulty] settings nav:", e);
    }
    return r;
  };
})(_renderNav);
_renderMain = (function (orig) {
  return function (opts) {
    if (_page !== _DT_DIFF_PAGE) return orig.apply(this, arguments);
    try {
      _dtDiffPage(opts);
    } catch (e) {
      console.warn("[Difficulty] settings page:", e);
    }
  };
})(_renderMain);
