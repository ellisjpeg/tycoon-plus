// ── Research from development: points per bubble, paced by staff ──
// In the game every worker in the busy room drops one research bubble on its
// own timer (worth 1 coin, 2 with the lucky perk), so a device earns roughly
// staff x stage seconds of research. Faster builds (speed.js, the Build
// speed slider) cut the work per stage and so the research per device, and
// three rooms busy at once (the pipeline) would triple it per year.
// Outside the Original preset each bubble is worth:
//   research slider x (1 / work cut, at most COMP_MAX)
// while the company's research allowance lasts. The allowance refills each
// game day with what the three teams would make building non-stop at the
// game's own pace (staff research rate x one room x ALLOW_SHARE), and holds
// at most ALLOW_DAYS of it. Once it is used up, bubbles pay TAIL of their
// value. So a few devices a year earn what they did in the original game, and
// making many more (faster offices, three rooms) does not multiply research
// per year: that depends on the staff, their research skill and the labs.
// With three rooms busy each device still gets full value until the
// allowance runs out; the allowance, not a divisor, keeps the year in check.
var _DT_RESEARCH = {
  COMP_MAX: 4, // a bubble is worth at most 4x when the work was cut to a quarter or less
  ALLOW_SHARE: 1, // allowance per day = one room of the average team working all day
  ALLOW_DAYS: 365, // the allowance never stores more than a year
  START_DAYS: 120, // a loaded or new company starts with four months stored
  TAIL: 0.1, // value of a bubble once the allowance is used up
  DAY_SEC: 1.2, // real seconds per game day (GameSpeedTime)
};
var _dtRes = { pool: null, day: -1, rate: 0, rateDay: -1, added: 0, carry: 0, cut: {}, cutDay: -1, raw: 0 };

function _dtResShipped() {
  return _DT_DIFF_KEYS.every((k) => _dtDiff[k] === 1);
}
function _dtResStage() {
  const t = String(_dtUi.gv("OfficeType", "") || "").toUpperCase();
  return t === "DESIGNER" ? "design" : t === "PROGRAMMER" ? "programmer" : t === "ENGINEER" ? "engineer" : "";
}
// Work cut of a room this day: the speed patch scale and the Build slider.
function _dtResCut(stage) {
  const day = _dtUi.num("DayTotal", 0);
  if (day !== _dtRes.cutDay) _dtRes.cut = {}, (_dtRes.cutDay = day);
  if (stage in _dtRes.cut) return _dtRes.cut[stage];
  let cut = 1;
  try {
    const rt = globalThis.runtime;
    if (typeof _dtSpeedScale === "function" && STAGES[stage]) {
      const staff = _officeStaff(rt, STAGES[stage]);
      const kind = stage === "programmer" ? "tech" : stage === "engineer" ? "engineer" : "design";
      cut = _dtSpeedScale(_throughput(staff, kind).pps, staff.level);
    }
  } catch (e) {
    cut = 1;
  }
  if (_dtDiff.build > 0) cut /= _dtDiff.build;
  return (_dtRes.cut[stage] = Math.min(1, Math.max(1 / _DT_RESEARCH.COMP_MAX, cut || 1)));
}
// Research bubbles per second of one room's staff, from the game's interval
// (rand 1.35-1.45 - ((research stat - 10)/90*.7 + mood/100*.3)) / (1 + .1*perk 7,1).
function _dtResStageRate(rt, stage, gameMood) {
  const chars = _inst45(rt, "ArrayEmployees_Characters");
  const perks = _inst45(rt, "ArrayMyPerks");
  const perk = 1 + 0.1 * (Number(perks && _at41(perks, 7, 1, 0)) || 0);
  const mine = gameMood && _inst45(rt, "ArrayMyEmployees");
  let sum = 0;
  for (const w of _officeStaff(rt, STAGES[stage]).workers) {
    const stat = Math.min(100, Math.max(10, Number(_at41(chars, w.id, 2, 0)) || 0));
    // The game's own timer reads mood at row = character id, not the staff row.
    const mood = gameMood ? Number(mine && _at41(mine, w.id, 1, 0)) || 0 : w.mood;
    const t = (1.4 - ((stat - 10) / 90) * 0.7 - (Math.min(100, Math.max(0, mood)) / 100) * 0.3) / perk;
    sum += 1 / Math.max(0.15, t);
  }
  return sum;
}
// Bubbles per second of the average room.
function _dtResRate() {
  const day = _dtUi.num("DayTotal", 0);
  if (day === _dtRes.rateDay) return _dtRes.rate;
  let sum = 0;
  try {
    for (const stage of ["design", "programmer", "engineer"]) sum += _dtResStageRate(globalThis.runtime, stage);
  } catch (e) {
    sum = NaN; // staff unreadable: no allowance limit, plain research slider
  }
  _dtRes.rateDay = day;
  return (_dtRes.rate = sum / 3);
}
function _dtResDaily() {
  return _dtDiff.research * _dtResRate() * _DT_RESEARCH.DAY_SEC * _DT_RESEARCH.ALLOW_SHARE;
}
function _dtResReset() {
  _dtRes.pool = null;
  _dtRes.day = -1;
  _dtRes.rateDay = -1;
  _dtRes.cutDay = -1;
  _dtRes.added = 0;
  _dtRes.carry = 0;
}
// Called on the office screens with the day counter: refills the allowance.
function _dtResTick() {
  if (_dtResShipped()) return (_dtRes.pool = null); // Original: start fresh if the preset changes
  const day = _dtUi.num("DayTotal", 0);
  const daily = _dtResDaily();
  if (!Number.isFinite(daily)) return (_dtRes.pool = Infinity), (_dtRes.day = day);
  if (_dtRes.pool === null || _dtRes.day < 0 || day < _dtRes.day || day - _dtRes.day > 2) {
    if (_dtRes.pool === null) _dtRes.pool = daily * _DT_RESEARCH.START_DAYS;
  } else if (day > _dtRes.day) {
    _dtRes.pool += daily * (day - _dtRes.day);
  }
  _dtRes.pool = Math.min(_dtRes.pool, daily * _DT_RESEARCH.ALLOW_DAYS);
  _dtRes.day = day;
}
// The game's research bubble adds this instead of its raw 1 (or 2). The
// pipeline can call it as _dtResearchBubble(raw, stage) for a room off screen.
function _dtResBubble(raw, stage) {
  try {
    raw = Number(raw) || 0;
    if (raw > 0) _dtRes.raw += raw;
    if (raw <= 0 || _dtResShipped()) return raw;
    if (_dtRes.pool === null) _dtResTick();
    const full = (raw * _dtDiff.research) / _dtResCut(stage || _dtResStage());
    const paid = Math.min(full, Math.max(0, _dtRes.pool));
    _dtRes.pool -= paid;
    _dtRes.carry += paid + (full - paid) * _DT_RESEARCH.TAIL;
    const add = Math.floor(_dtRes.carry + 1e-9); // 0.6 x 10 must pay 6
    _dtRes.carry -= add;
    _dtRes.added += add;
    return add;
  } catch (e) {
    return raw;
  }
}
globalThis._dtResearchBubble = _dtResBubble;
// Raw bubble points seen so far: the pipeline measures each room's rate in these.
globalThis._dtResearchRaw = () => _dtRes.raw;
// Raw points per second one busy room earns (+1 per bubble, +1 more at
// perk 7 x 5%): the pipeline pays this for a room off screen.
globalThis._dtResearchRoomRate = (stage) => {
  try {
    const rt = globalThis.runtime;
    const perks = _inst45(rt, "ArrayMyPerks");
    const lucky = Math.min(1, 0.05 * (Number(perks && _at41(perks, 7, 0, 0)) || 0));
    return _dtResStageRate(rt, stage, true) * (1 + lucky);
  } catch (e) {
    return 0;
  }
};
globalThis._dtResearchInfo = () => ({
  pool: _dtRes.pool, daily: _dtResDaily(), rate: _dtRes.rate,
  cut: Object.assign({}, _dtRes.cut), shipped: _dtResShipped(),
});
// Allowance left and its day, saved in the difficulty row so a reload does
// not refill it to START_DAYS. Old saves have none and start with START_DAYS.
function _dtResSaved() {
  return Number.isFinite(_dtRes.pool) && _dtRes.day >= 0 ? [Math.round(_dtRes.pool * 100) / 100, _dtRes.day] : null;
}
function _dtResRestore(r) {
  if (!Array.isArray(r) || !Number.isFinite(r[0]) || r[0] < 0 || !Number.isFinite(r[1])) return;
  _dtRes.pool = r[0];
  _dtRes.day = r[1];
}
// Coins the bubbles already scaled; the generic research scaling skips them.
function _dtResTakeAdded() {
  const a = _dtRes.added;
  _dtRes.added = 0;
  return a;
}
