// ── Device thickness follows the calendar ──
// "Device Thickness" research (ArrayMyResearch[3], max level 10, cheap) is
// the only cap on the page-1 depth slider of phones, tablets, laptops,
// watches and headphones, so a phone could be 5-6 mm thin a few years in.
// Outside the Original preset:
// - the slider's top end is the thinner of the research level and this
//   year's limit (one compiled expression reads ArrayMyResearch[3] for all
//   five editors; prepare.py routes it through _dtThinCap);
// - the next research level shows NOT AVAILABLE until its year, like the
//   game's own date-gated research. Levels already bought are kept;
// - a design opened in the editor (Start from, queue) is clamped to this
//   year's limit when its page 1 starts. Released devices are not touched;
// - a short hint under the depth "+" says when thinner bodies arrive.
// The game shows depth only as a level number. Level -> mm follows the
// game's own drawn side width (26 - 1.7 x level), scaled so level 10 is
// 5.6 mm (the thinnest phones, 2025): level 1 is 15.1 mm.
var _DT_THIN = {
  // Thinnest phone allowed from each year (mm); between years the last value holds.
  YEAR_MM: { 2008: 11.0, 2009: 10.0, 2010: 9.0, 2011: 8.5, 2012: 7.6, 2013: 7.0, 2014: 6.5, 2016: 6.0, 2025: 5.6 },
  // What each Device Thickness level means, level 1..10 (mm).
  LEVEL_MM: [15.1, 14.1, 13.0, 11.9, 10.9, 9.8, 8.8, 7.7, 6.7, 5.6],
  RESEARCH_ID: 3,
};
// Page-1 layout -> depth variable and the UID of its "+" button.
var _DT_THIN_PAGES = {
  "SMARTPHONE PAGE 1": { v: "SmartphoneDepth", plus: 526, max: 10 },
  "TABLET PAGE 1": { v: "TabletDepth", plus: 1626, max: 10 },
  "LAPTOP PAGE 1": { v: "LaptopDepth", plus: 2513, max: 10 },
  "WATCHES PAGE 1": { v: "WatchesDepth", plus: 3329, max: 8 },
  "HEADPHONES PAGE 1": { v: "CaseDepth", plus: 3883, max: 10 },
};
var _DT_THIN_TEXT = { hint: { en: "Thinner bodies from {y}", ru: "Тоньше с {y} года" } };
var _DT_THIN_NOT_AVAILABLE = 11956; // ArrayLanguage column of the game's "NOT AVAILABLE"
var _dtThinWired = false;
var _dtThinHint = null;

// Thinnest level allowed in a year (1..10).
function _dtThinYearLevel(year) {
  const years = Object.keys(_DT_THIN.YEAR_MM).map(Number).sort((a, b) => a - b);
  let mm = _DT_THIN.YEAR_MM[years[0]];
  for (const y of years) if (y <= year) mm = _DT_THIN.YEAR_MM[y];
  let level = 1;
  _DT_THIN.LEVEL_MM.forEach((m, i) => {
    if (m >= mm - 1e-6) level = i + 1;
  });
  return level;
}
// First year that allows a level above `level`, or 0 if none.
function _dtThinNextYear(level) {
  const years = Object.keys(_DT_THIN.YEAR_MM).map(Number).sort((a, b) => a - b);
  for (const y of years) if (_dtThinYearLevel(y) > level) return y;
  return 0;
}
function _dtThinYear() {
  const y = _dtUi.num("Year", 0);
  return y >= 2008 ? y : 2008 + Math.floor(Math.max(0, _dtUi.num("DayTotal", 1) - 1) / 365);
}
function _dtThinOn() {
  try {
    if (typeof _dtDiffLoad === "function" && _dtDiffCompanyNow()) _dtDiffLoad();
  } catch (e) {}
  return !_dtResShipped();
}
// The page-1 sliders' research cap (compiled expression, see prepare.py).
function _dtThinCap(v) {
  if (!_dtThinOn()) return v;
  return Math.min(v, _dtThinYearLevel(_dtThinYear()));
}
function _dtThinResearchLevel() {
  try {
    return Number(globalThis.runtime.objects.ArrayMyResearch.getFirstInstance().getAt(_DT_THIN.RESEARCH_ID, 0)) || 0;
  } catch (e) {
    return 0;
  }
}
// Research page: the next level waits for its year.
_readRows = (function (orig) {
  return function () {
    try {
      if (_dtThinOn()) {
        const rt = globalThis.runtime;
        const t = rt.objects.ArrayResearchPage_Temp.getFirstInstance();
        const max = Number(rt.objects.ArrayResearch.getFirstInstance().getAt(_DT_THIN.RESEARCH_ID, 0)) || 0;
        for (let x = 0; x < (t.width | 0); x++) {
          if (Number(t.getAt(x, 0)) !== _DT_THIN.RESEARCH_ID || !String(t.getAt(x, 1) ?? "")) continue;
          const level = Number(t.getAt(x, 2)) || 0;
          const status = t.getAt(x, 4); // blank is 0 or ""
          if ((status !== 0 && String(status ?? "") !== "") || level >= max) continue;
          if (level >= _dtThinYearLevel(_dtThinYear())) {
            const lang = rt.objects.ArrayLanguage.getFirstInstance();
            const text = lang.getAt(_dtUi.num("LanguageChoose", 0), _DT_THIN_NOT_AVAILABLE) || lang.getAt(0, _DT_THIN_NOT_AVAILABLE);
            t.setAt(String(text || "NOT AVAILABLE"), x, 4);
          }
        }
      }
    } catch (e) {
      console.warn("[Thin] research:", e);
    }
    return orig.apply(this, arguments);
  };
})(_readRows);
// Editor page 1 start: a copied or queued design may be thinner than this year allows.
function _dtThinOnLayoutStart(ev) {
  try {
    const page = _DT_THIN_PAGES[String((ev && ev.layout && ev.layout.name) || _dtUi.layoutName())];
    if (!page || !_dtThinOn()) return;
    const gv = globalThis.runtime.globalVars;
    const cap = _dtThinYearLevel(_dtThinYear());
    if (Number(gv[page.v]) > cap) gv[page.v] = cap;
  } catch (e) {
    console.warn("[Thin] clamp:", e);
  }
}
function _dtThinHintText() {
  const page = _DT_THIN_PAGES[_dtUi.layoutName()];
  if (!page || !_dtThinOn() || _dtUi.num("MiniPage", 0) !== 1) return "";
  const cap = _dtThinYearLevel(_dtThinYear());
  const max = page.v === "WatchesDepth" && String(_dtUi.gv("BulgingScrollButton", "")) === "ON" ? 5 : page.max;
  if (cap >= max || _dtThinResearchLevel() <= cap || _dtUi.num(page.v, 1) < cap) return "";
  const y = _dtThinNextYear(cap);
  return y ? _dtUi.t(_DT_THIN_TEXT.hint, { y }) : "";
}
function _dtThinTick() {
  try {
    const rt = globalThis.runtime;
    if (!rt || typeof rt.addEventListener !== "function") return;
    if (!_dtThinWired) {
      rt.addEventListener("beforeanylayoutstart", _dtThinOnLayoutStart);
      _dtThinWired = true;
    }
    const text = _dtThinHintText();
    if (!text) {
      if (_dtThinHint) _dtThinHint.style.display = "none";
      return;
    }
    const inst = rt.getInstanceByUid(_DT_THIN_PAGES[_dtUi.layoutName()].plus);
    if (!inst || !inst.layer) return;
    const layer = _dtUi.ensure();
    if (!_dtThinHint || !_dtThinHint.isConnected) {
      _dtThinHint = _dtUi.el("div", "dt-thin-hint", layer);
      Object.assign(_dtThinHint.style, {
        position: "absolute", transform: "translate(-100%, 0)", whiteSpace: "nowrap",
        fontFamily: '"SofiaSansExtraCondensed-Medium", "Oswald", sans-serif',
        fontSize: "calc(var(--dt) * 22px)", lineHeight: "1", color: "rgb(255, 236, 170)",
        textShadow: "0 calc(var(--dt) * 1px) calc(var(--dt) * 3px) rgba(0, 0, 0, 0.45)",
      });
    }
    // Under the row, right-aligned with the "+" button.
    const [cx, cy] = inst.layer.layerToCssPx(inst.x + inst.width / 2, inst.y + inst.height / 2);
    const c = document.querySelector("canvas").getBoundingClientRect();
    const l = layer.getBoundingClientRect();
    _dtThinHint.style.left = Math.round(c.left + cx - l.left) + "px";
    _dtThinHint.style.top = Math.round(c.top + cy - l.top) + "px"; // nearer its own row than "Device corners"
    _dtThinHint.textContent = text;
    _dtThinHint.style.display = "";
  } catch (e) {
    console.warn("[Thin] tick:", e);
  }
}
globalThis._dtThin = { yearLevel: _dtThinYearLevel, nextYear: _dtThinNextYear, cap: _dtThinCap, hint: _dtThinHintText };
// The shared mod timer (ui.js every) when ui.js is in; a timer of our own without it.
(typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(_dtThinTick, 250);
