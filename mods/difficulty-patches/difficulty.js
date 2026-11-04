// ── Difficulty: per-company sliders, changeable any time ──
// Edited in the game's own Settings page (settings.js), saved with its Apply.
// Five multipliers on the game's own formulas. 1 everywhere is the original
// game. Stored as JSON in a free ArraySaves row of the company's save slot,
// so they are saved with the company and a new company starts at defaults.
//   buy      people's demand for your devices (the game's potential units)
//   cost     part and production cost per unit; buyers still judge the price
//            against the original cost, so higher costs squeeze margins
//   research research coins from every source (investments, research office)
//   rivals   competitors grow faster, take a share of your buyers (demand is
//            divided by the square root); their growth scales with the square
//            root, while the whole rival market follows only the buy slider
//            so the world shrinks consistently with the player's market
//   build    office build speed (work per stage is divided by it)
var _DT_DIFF_ROW = 150;
var _DT_DIFF_KEYS = ["buy", "cost", "research", "rivals", "build"];
var _DT_DIFF_RANGE = {
  buy: [0.25, 2],
  cost: [0.5, 2],
  research: [0.25, 2],
  rivals: [0.5, 3],
  build: [0.25, 2],
};
// Preset numbers live here. "original" is the
// shipped game and must stay all 1; "realistic" is the recommended preset.
// Tuned by simulation: build stays at 1.0 (more staff/offices
// must remain the main way to grow); research 0.3 is the fastest pace that
// still keeps Apple scale out to year 28 and phone parts behind new tech
// until ~year 31. Brutal keeps build 1.0 but shrinks the market, raises costs,
// slows research and strengthens rivals: it stays below 400M sold at year 40
// while still growing.
var _DT_PRESET_NUMBERS = {
  original: { buy: 1, cost: 1, research: 1, rivals: 1, build: 1 },
  realistic: { buy: 1, cost: 1, research: 0.3, rivals: 1.1, build: 1 },
  brutal: { buy: 0.85, cost: 1.1, research: 0.25, rivals: 1.5, build: 1 },
};
var _DT_DIFF_PRESETS = _DT_PRESET_NUMBERS;
var _DT_DIFF_RECOMMENDED = "realistic";
// Saves from before the rename may carry "harder"; it had these same numbers.
var _DT_DIFF_LEGACY_PRESETS = { harder: "realistic" };
// Round-1 rows stored only the five numbers, so their old built-in tuples are
// recognised exactly and migrated to the retuned preset of the same name.
var _DT_DIFF_LEGACY_ROWS = {
  "0.8,1.1,0.8,1.25,1": "realistic", // old Harder
  "0.6,1.25,0.7,1.5,1": "brutal",    // old Brutal
};
// Rivals: the buy slider shrinks the whole market target, competitor strength
// scales each rival's daily growth by sqrt(rivals), and a name-seeded 0.9-1.12
// factor gives stable variety so a few leaders can pull ahead realistically.
// Over 30 years the raw product compounds share too far, so only 70% of the
// excess over 1 is applied: growth = 1 + (sqrt(rivals)*variety - 1)*DAMP.
var _DT_RIVAL_VARIETY_MIN = 0.9;
var _DT_RIVAL_VARIETY_MAX = 1.12;
var _DT_RIVAL_GROWTH_EXP = 0.5;
var _DT_RIVAL_GROWTH_DAMP = 0.7;
var _DT_DIFF_TEXT = {
  title: { en: "Difficulty", ru: "Сложность" },
  original: { en: "Original", ru: "Как в игре" },
  realistic: { en: "Realistic", ru: "Реалистично" },
  brutal: { en: "Brutal", ru: "Жёстко" },
  buy: { en: "How much people buy", ru: "Сколько покупают" },
  buySub: { en: "Lower means fewer buyers for every device", ru: "Меньше значит меньше покупателей" },
  cost: { en: "Part and production costs", ru: "Цена деталей и производства" },
  costSub: { en: "Higher costs, but buyers still expect the old prices", ru: "Дороже детали, а покупатели ждут прежних цен" },
  research: { en: "Research speed", ru: "Скорость исследований" },
  researchSub: { en: "Research from the lab and from building devices", ru: "Очки исследований от лаборатории и разработки" },
  rivals: { en: "Competitor strength", ru: "Сила конкурентов" },
  rivalsSub: { en: "Rivals grow faster and take some of your buyers", ru: "Конкуренты растут быстрее и уводят покупателей" },
  build: { en: "Build speed", ru: "Скорость разработки" },
  buildSub: { en: "How fast the offices finish each stage", ru: "Как быстро офисы проходят этапы" },
};
var _dtDiff = Object.assign({}, _DT_DIFF_PRESETS.original);
var _dtDiffSlot = -1;
var _dtDiffCompany = "";
// Campaign check beyond slot + name: the highest DayTotal seen for the loaded company, and the
// day of a row skipped as another campaign's (a new company reusing the name in that slot).
var _dtDiffDay = 0;
var _dtDiffOtherRun = 0;
var _dtDiffRivalBase = null;
var _dtDiffRivalApplied = null;
var _dtDiffRivalSeeds = Object.create(null);
var _dtDiffCoins = null;
var _dtDiffCoinsLayout = "";
var _dtDiffCoinsDay = -1;
var _dtDiffCoinsCarry = 0;
var _DT_DIFF_COST_KEEP = 400;
var _dtDiffCostBases = new Map(); // scaled total -> design-time base, least recently used first
var _dtDiffCostDirty = false;
var _dtDiffRealFrom = null; // real.js: day the real calendar first applied to this company

function _dtDiffClamp(k, v) {
  const r = _DT_DIFF_RANGE[k];
  if (v === null || v === undefined || (typeof v === "string" && !v.trim())) return 1;
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(r[1], Math.max(r[0], Math.round(n * 100) / 100));
}
function _dtDiffSaves() {
  try {
    return globalThis.runtime.objects.ArraySaves.getFirstInstance();
  } catch (e) {
    return null;
  }
}
function _dtDiffSlotNow() {
  return Math.max(0, Math.min(2, Math.round(_dtUi.num("SaveSlot", 0)) || 0));
}
function _dtDiffCompanyNow() {
  return String(_dtUi.gv("CompanyName", "") || "");
}
function _dtDiffResetResearch() {
  _dtDiffCoins = null;
  _dtDiffCoinsDay = -1;
  _dtDiffCoinsCarry = 0;
  if (typeof _dtResReset === "function") _dtResReset();
}
function _dtDiffResetCosts() {
  _dtDiffCostBases = new Map();
  _dtDiffCostDirty = false;
}
function _dtDiffClearRow() {
  const a = _dtDiffSaves();
  const slot = _dtDiffSlotNow();
  try {
    if (a && a.height > _DT_DIFF_ROW && a.width > slot) a.setAt("", slot, _DT_DIFF_ROW, 0);
  } catch (e) {
    console.warn("[Difficulty] clear failed:", e);
  }
}
function _dtDiffNewCampaign() {
  _dtDiffClearRow();
  _dtDiffResetResearch();
  _dtDiffResetCosts();
  _dtDiffSlot = -1;
  _dtDiffCompany = "";
  _dtDiffDay = 0;
  _dtDiffOtherRun = 0;
  _dtDiff = Object.assign({}, _DT_DIFF_PRESETS.original);
  _dtDiffApplyRivals();
}
function _dtDiffLegacyRow(j) {
  if (!_DT_DIFF_KEYS.every((k) => j[k] !== null && j[k] !== "" && Number.isFinite(Number(j[k])))) return null;
  const sig = _DT_DIFF_KEYS.map((k) => Number(j[k])).join(",");
  return _DT_DIFF_LEGACY_ROWS[sig] || null;
}
// The scaled total returned by _compute4 is remembered against the base total
// it came from, so demand can keep judging an existing design at the cost it
// was priced with even after the slider moves. Editor previews add entries
// too, so only the most recently used are kept; demand touches every device
// on sale daily, which keeps those at the recent end.
function _dtDiffRememberCost(scaled, base) {
  if (_dtDiffCostBases.has(scaled)) return;
  _dtDiffCostBases.set(scaled, base);
  if (_dtDiffCostBases.size > _DT_DIFF_COST_KEEP) _dtDiffCostBases.delete(_dtDiffCostBases.keys().next().value);
  _dtDiffCostDirty = true;
}
// The scaled total is the only thing demand sees, so two designs must not share
// one: a total already remembered for a different base moves to the nearest
// free number (a dollar or two off), or to the one this base already has.
function _dtDiffCostKey(total, base) {
  const near = (i) => (i === 0 ? total : i % 2 ? total + (i + 1) / 2 : total - i / 2);
  for (let i = 0; i < 64; i++) {
    const k = near(i);
    if (k >= 1 && _dtDiffCostBases.get(k) === base) return k;
  }
  for (let i = 0; i < 64; i++) {
    const k = near(i);
    if (k >= 1 && k !== base && !_dtDiffCostBases.has(k)) return k;
  }
  return total;
}
function _dtDiffDemandCost(cost) {
  const n = Number(cost);
  if (!Number.isFinite(n) || n <= 0) return cost;
  const key = Math.round(n);
  const base = _dtDiffCostBases.get(key);
  if (base === undefined) return cost;
  _dtDiffCostBases.delete(key);
  _dtDiffCostBases.set(key, base);
  return base;
}
// Reads the slot's row once per company; a different company name in the
// row (a new game in a used slot) means defaults.
function _dtDiffLoad() {
  const slot = _dtDiffSlotNow();
  const company = _dtDiffCompanyNow();
  const day = _dtUi.num("DayTotal", 0);
  // The calendar going back means another campaign (or an older save): read the row again. A row
  // skipped as newer than today is read again once the day catches up (globals loaded late).
  const back = day + 1 < _dtDiffDay;
  // Only a jump (globals arriving late), not a new campaign reaching that day by playing.
  const caught = _dtDiffOtherRun > 0 && day + 1 >= _dtDiffOtherRun && day - _dtDiffDay > 30;
  if (slot === _dtDiffSlot && company === _dtDiffCompany && !back && !caught) {
    if (day > _dtDiffDay) _dtDiffDay = day;
    return;
  }
  _dtDiffDay = day;
  _dtDiffOtherRun = 0;
  _dtDiffSlot = slot;
  _dtDiffCompany = company;
  _dtDiffResetResearch();
  _dtDiffResetCosts();
  _dtDiffRealFrom = null;
  let next = Object.assign({}, _DT_DIFF_PRESETS.original);
  const a = _dtDiffSaves();
  try {
    if (a && a.height > _DT_DIFF_ROW && a.width > slot) {
      const raw = String(a.getAt(slot, _DT_DIFF_ROW, 0) ?? "");
      if (raw && raw !== "0") {
        const j = JSON.parse(raw);
        // Rows store the day they were written: one from a later day than today belongs to an
        // earlier campaign of the same name in this slot (a new game starts at day 1). Later in a
        // campaign it is this company's own newer row (ArraySaves stays in memory when an older
        // save of it is loaded): keep the player's setting.
        const rowDay = j && j.day !== undefined && j.day !== null ? Number(j.day) : NaN;
        if (Number.isFinite(rowDay) && day + 1 < rowDay && day < 30) _dtDiffOtherRun = rowDay;
        else if (j && j.v === 1 && j.company === company) {
          const legacy = j.preset && _DT_DIFF_LEGACY_PRESETS[j.preset];
          const migrated = _dtDiffLegacyRow(j);
          const preset = _DT_DIFF_PRESETS[migrated || legacy || j.preset];
          for (const k of _DT_DIFF_KEYS) {
            const v = migrated ? preset[k] : j[k] !== undefined ? j[k] : preset && preset[k];
            if (v !== undefined) next[k] = _dtDiffClamp(k, v);
          }
          if (Number.isFinite(j.real)) _dtDiffRealFrom = j.real;
          if (j.res && typeof _dtResRestore === "function") _dtResRestore(j.res);
          if (Array.isArray(j.costs)) {
            for (const p of j.costs.slice(-_DT_DIFF_COST_KEEP)) {
              const scaled = Number(p && p[0]);
              const base = Number(p && p[1]);
              if (Number.isFinite(scaled) && Number.isFinite(base) && base > 0) _dtDiffCostBases.set(scaled, base);
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("[Difficulty] row", _DT_DIFF_ROW, "unreadable, using defaults:", e);
  }
  _dtDiff = next;
  _dtDiffApplyRivals();
}
function _dtDiffSave() {
  const a = _dtDiffSaves();
  const slot = _dtDiffSlotNow();
  if (!a || a.height <= _DT_DIFF_ROW || a.width <= slot) return console.warn("[Difficulty] no ArraySaves row", _DT_DIFF_ROW);
  const j = { v: 1, company: _dtDiffCompanyNow(), day: _dtUi.num("DayTotal", 0) };
  _dtDiffOtherRun = 0;
  for (const k of _DT_DIFF_KEYS) j[k] = _dtDiff[k];
  if (_dtDiffRealFrom !== null) j.real = _dtDiffRealFrom;
  if (_dtDiffCostBases.size) j.costs = Array.from(_dtDiffCostBases);
  const res = typeof _dtResSaved === "function" ? _dtResSaved() : null;
  if (res) j.res = res;
  a.setAt(JSON.stringify(j), slot, _DT_DIFF_ROW, 0);
  _dtDiffCostDirty = false;
}
// A game save writes the row first, so it holds the research allowance left.
var _dtDiffSaveWrapped = false;
function _dtDiffWrapSave() {
  if (_dtDiffSaveWrapped || typeof saveArraysToFile !== "function") return;
  _dtDiffSaveWrapped = true;
  const orig = saveArraysToFile;
  saveArraysToFile = function () {
    try {
      if (_dtDiffSlot >= 0 && _dtDiffSlot === _dtDiffSlotNow() && _dtDiffCompany === _dtDiffCompanyNow()) _dtDiffSave();
    } catch (e) {
      console.warn("[Difficulty] save:", e);
    }
    return orig.apply(this, arguments);
  };
}
function _dtDiffSet(k, v) {
  _dtDiff[k] = _dtDiffClamp(k, v);
  _dtDiffSave();
  if (k === "rivals" || k === "buy") _dtDiffApplyRivals();
}
// The game's rival numbers are annual revenue (COL 4, billions), company
// value (COL 6) and fans (COL 7, millions). They all grow from the same
// _cfg17 market bases, so scaling those bases scales sales/money/fans on the
// same basis. buy shrinks the player's market, so the whole rival world
// shrinks with it at the same rate. Competitor strength does not enlarge the
// market target; it only feeds each rival's growth below.
function _dtDiffApplyRivals() {
  try {
    const factor = _dtDiff.buy;
    if (_dtDiffRivalApplied === null && factor === 1) return;
    if (_dtDiffRivalApplied === factor) return;
    if (!_dtDiffRivalBase) {
      const c = setRatingsConfig();
      _dtDiffRivalBase = { e: c.NPC_MARKET_BASE_EARN_B, f: c.NPC_MARKET_BASE_FANS_M };
    }
    setRatingsConfig({
      NPC_MARKET_BASE_EARN_B: _dtDiffRivalBase.e * factor,
      NPC_MARKET_BASE_FANS_M: _dtDiffRivalBase.f * factor,
    });
    _dtDiffRivalApplied = factor;
  } catch (e) {
    console.warn("[Difficulty] rivals:", e);
  }
}
function _dtDiffRivalName(row) {
  try {
    const a = globalThis.runtime.objects.ArrayRatingsCompanies.getFirstInstance();
    const id = Number(a.getAt(row, 0));
    if (Number.isFinite(id) && typeof _companyName === "function") return String(_companyName(id));
  } catch (e) {}
  return "row:" + row;
}
function _dtDiffRivalVariety(name) {
  let h = _dtDiffRivalSeeds[name];
  if (h === undefined) {
    h = 2166136261;
    for (let i = 0; i < name.length; i++) {
      h ^= name.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h = (h >>> 0) / 4294967296;
    _dtDiffRivalSeeds[name] = h;
  }
  return _DT_RIVAL_VARIETY_MIN + h * (_DT_RIVAL_VARIETY_MAX - _DT_RIVAL_VARIETY_MIN);
}
function _dtDiffRivalGrowth(row) {
  if (_dtDiff.rivals === 1) return 1;
  const raw = Math.pow(_dtDiff.rivals, _DT_RIVAL_GROWTH_EXP) * _dtDiffRivalVariety(_dtDiffRivalName(row));
  return 1 + (raw - 1) * _DT_RIVAL_GROWTH_DAMP;
}
// Growth is the 4th argument of _tickNpcRow (the perk multiplier). Scaling it
// changes each rival's daily earn/price/fans growth in the game's own tick;
// the stored and displayed numbers stay the ones the game writes. The market
// target is pulled every 90 days, so this only reshapes the race for share.
_tickNpcRow = (function (orig) {
  return function (arr, row, ctx, p) {
    if (_dtDiff.rivals === 1) return orig.apply(this, arguments);
    let mul;
    try {
      const base = typeof p === "number" && isFinite(p) ? p : 1;
      mul = base * _dtDiffRivalGrowth(row);
    } catch (e) {
      return orig.apply(this, arguments);
    }
    return orig.call(this, arr, row, ctx, mul);
  };
})(_tickNpcRow);

// Demand: rating, cost, sell, hype, ... (see _potentialUnits). A cost that
// _compute4 scaled is judged at its design-time base, so moving the slider
// never changes demand for devices that already exist.
_potentialUnits = (function (orig) {
  return function (rating, cost, sell, hype, base, mkt, ctx, cannibal, cfg) {
    const c = _dtDiffDemandCost(cost);
    const u = orig.call(this, rating, c, sell, hype, base, mkt, ctx, cannibal, cfg);
    const m = _dtDiff.buy / Math.sqrt(_dtDiff.rivals);
    return m === 1 ? u : Math.max(1, Math.floor(u * m));
  };
})(_potentialUnits);

// Part cost: the price page's computed unit cost.
_compute4 = (function (orig) {
  return function () {
    const o = orig.apply(this, arguments);
    if (o && o.supported && Number.isFinite(o.total) && _dtDiff.cost !== 1) {
      const base = o.total;
      const total = _dtDiffCostKey(Math.max(1, Math.round(base * _dtDiff.cost)), base);
      if (total !== base) {
        o.total = total;
        _dtDiffRememberCost(total, base);
      }
    }
    return o;
  };
})(_compute4);

// Build: called by computeBubblesPlan with the stage's work units.
function _dtDiffBuild(h) {
  return _dtDiff.build > 0 && _dtDiff.build !== 1 ? h / _dtDiff.build : h;
}

// Research: scale every increase of ResearchCoins seen within one screen
// and day step. A new screen, a load or a jump in days resets the baseline.
// Office research bubbles are scaled by research.js already and skipped here.
function _dtDiffResearch() {
  const bubbles = typeof _dtResTakeAdded === "function" ? _dtResTakeAdded() : 0;
  const coins = _dtUi.num("ResearchCoins", NaN);
  const lay = _dtUi.layoutName();
  const day = _dtUi.num("DayTotal", 0);
  const fresh = _dtDiffCoins === null || lay !== _dtDiffCoinsLayout || day < _dtDiffCoinsDay || day - _dtDiffCoinsDay > 2;
  _dtDiffCoinsLayout = lay;
  _dtDiffCoinsDay = day;
  if (!Number.isFinite(coins)) return (_dtDiffCoins = null);
  if (fresh || coins - bubbles <= _dtDiffCoins || _dtDiff.research === 1) return (_dtDiffCoins = coins);
  _dtDiffCoinsCarry += (coins - bubbles - _dtDiffCoins) * (_dtDiff.research - 1);
  const add = _dtDiffCoinsCarry < 0 ? Math.ceil(_dtDiffCoinsCarry) : Math.floor(_dtDiffCoinsCarry);
  _dtDiffCoinsCarry -= add;
  const next = Math.max(0, coins + add);
  if (add) globalThis.runtime.globalVars.ResearchCoins = next;
  _dtDiffCoins = next;
}

function _dtDiffTick() {
  try {
    const rt = globalThis.runtime;
    if (!rt || !rt.globalVars) return;
    _dtDiffWrapSave();
    const lay = _dtUi.layoutName();
    // ArraySaves survives resetGameSession, so a new campaign in a used slot
    // must clear its row here, as the queue does for row 151.
    if (lay === "LOADING GAME" && String(rt.globalVars.LoadingType || "").toUpperCase() === "NEW GAME") _dtDiffNewCampaign();
    const outside = lay === "MENU" || lay === "START PAGE" || lay === "LOADING GAME" || !_dtDiffCompanyNow();
    if (outside) {
      _dtDiffSlot = -1;
      _dtDiffResetResearch();
    } else {
      _dtDiffLoad();
    }
    if (_dtDiffSlot >= 0) {
      if (_dtDiffCostDirty) _dtDiffSave();
      if (typeof _dtResTick === "function") _dtResTick();
      _dtDiffResearch();
    }
  } catch (e) {
    console.warn("[Difficulty] tick:", e);
  }
}
globalThis._dtDifficulty = () => Object.assign({}, _dtDiff);
// The shared mod timer (ui.js every) when ui.js is in; a timer of our own without it.
(typeof _dtUi !== "undefined" && _dtUi.every || setInterval)(_dtDiffTick, 250);
