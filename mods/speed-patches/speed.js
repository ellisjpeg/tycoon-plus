// ── Build speed: bigger, better staffed offices finish devices faster ──
// The game sizes each office stage (design, programming, engineering) so it
// takes 12-70 seconds whatever the company looks like, and the work grows
// with the era. This scales that target time by how strong the office is
// compared with a three-person start-up: its staff throughput and its
// purchased office level. A start-up keeps the original time; a full level 8
// office of top staff needs about a seventh of it (the 0.15 floor).
var _DT_SPEED = {
  BASE_PPS: 2.65, // 3 workers, stats 25, mood 50: the game's own fallback office
  FREE_RATIO: 4, // up to 4x a start-up's throughput keeps the original time
  EXP: 0.55, // how quickly time falls once past that
  OFFICE_STEP: 0.08, // each purchased office level above 1 counts as +8% throughput
  MIN_SCALE: 0.15,
  MIN_SEC: 3, // floor per stage (the game's own floor is 12)
};
var _dtSpeedLast = null;

function _dtSpeedScale(pps, level) {
  const office = 1 + _DT_SPEED.OFFICE_STEP * Math.max(0, (Number(level) || 1) - 1);
  const ratio = (Math.max(0, Number(pps) || 0) / _DT_SPEED.BASE_PPS) * office;
  if (!(ratio > _DT_SPEED.FREE_RATIO)) return 1;
  return Math.max(_DT_SPEED.MIN_SCALE, Math.pow(ratio / _DT_SPEED.FREE_RATIO, -_DT_SPEED.EXP));
}

// Called by computeBubblesPlan with the work units it settled on (h), the
// office's points per second, the staff summary, the stage and its weight.
function _dtSpeedPlan(h, pps, staff, stage, weight) {
  try {
    if (!(h > 0) || !(pps > 0)) return h;
    const scale = _dtSpeedScale(pps, staff && staff.level);
    const floor = _DT_SPEED.MIN_SEC * (Number(weight) || 1) * pps;
    const out = scale < 1 ? Math.max(Math.min(h, floor), h * scale) : h;
    _dtSpeedLast = { stage: stage, scale: scale, before: h / pps, after: out / pps };
    return out;
  } catch (e) {
    return h;
  }
}
globalThis._dtSpeedInfo = () => _dtSpeedLast;
globalThis._dtSpeedScale = _dtSpeedScale;
