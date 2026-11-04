// Behaviour test for speed.js: the office-strength scaling that computeBubblesPlan
// applies after it clamps each stage time. Usage: node test_speed_runtime.js <speed.js>
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const ctx = { Math, Number, Object, Error, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[2], "utf8"), ctx);

const S = ctx._DT_SPEED;
const scale = ctx._dtSpeedScale;
const plan = ctx._dtSpeedPlan;
const near = (a, b, eps, m) => assert.ok(Math.abs(a - b) <= eps, m + ": " + a + " vs " + b);

// 1. A three-person start-up keeps the game's original stage time.
assert.equal(scale(2.65, 1), 1);
assert.equal(scale(S.BASE_PPS, 1), 1);
assert.equal(scale(S.BASE_PPS, 0), 1, "level 0 is treated as the first office");
// Up to 4x a start-up's throughput is free; above it time starts to fall.
assert.equal(scale(S.BASE_PPS * S.FREE_RATIO, 1), 1);
assert.equal(scale(S.BASE_PPS * S.FREE_RATIO - 0.01, 1), 1);
assert.ok(scale(S.BASE_PPS * S.FREE_RATIO + 0.01, 1) < 1);
// Office level counts as throughput on top of staff.
assert.equal(scale(S.BASE_PPS * 2.7, 1), 1);
assert.ok(scale(S.BASE_PPS * 2.7, 8) < 1, "the same staff in a level 8 office is past the free ratio");
assert.ok(scale(S.BASE_PPS * 10, 8) < scale(S.BASE_PPS * 10, 1), "a better office never builds slower");

// 2. A maxed office of top staff needs about a fifth of the original time.
near(scale(265.6, 8), 0.15, 0.001, "pps 265.6 at office level 8 hits the 0.15 floor");
near(scale(47, 5), 0.378, 0.01, "QA save design office: 15 staff, level 5");

// 3. The scale is clamped at MIN_SCALE and never speeds work up.
for (const pps of [0, 0.5, 2.65, 10.6, 100, 265.6, 1e4, 1e9, 1e15]) {
  for (const level of [0, 1, 2, 4, 8, 20]) {
    const s = scale(pps, level);
    assert.ok(s <= 1, "scale never above 1: " + pps + "/" + level);
    assert.ok(s >= S.MIN_SCALE, "scale never below MIN_SCALE: " + pps + "/" + level);
  }
}
assert.equal(scale(1e15, 8), S.MIN_SCALE, "absurd throughput stops at the floor");
assert.ok(scale(1000, 8) <= scale(100, 8), "more throughput never means more time");

// 4. The plan never returns more work than it was given, and never less than
// the smaller of the planned work and the game's per-stage seconds floor.
for (const h of [0.001, 1, 12, 100, 600, 5000, 1e6]) {
  for (const pps of [0.5, 2.65, 10, 100, 265.6, 1000]) {
    for (const weight of [0.01, 1, 3]) {
      for (const level of [1, 4, 8]) {
        const out = plan(h, pps, { level }, "design", weight);
        assert.ok(out <= h, "never more than h: " + [h, pps, weight, level]);
        assert.ok(out >= Math.min(h, S.MIN_SEC * weight * pps) - 1e-9,
          "never below min(h, MIN_SEC*weight*pps): " + [h, pps, weight, level]);
      }
    }
  }
}

// 4b. The plan applies the staff strength factor itself, not just the floor.
assert.equal(plan(2000, 100, { level: 5 }, "design", 1), 2000 * scale(100, 5),
  "pins the strength factor");
assert.equal(plan(10000, 100, { level: 5 }, "design", 1), 10000 * scale(100, 5),
  "pins the strength factor above the three-second floor");

// 4c. The office level changes the plan, not only the scale helper.
assert.equal(plan(2000, 100, { level: 1 }, "design", 1), 2000 * scale(100, 1),
  "pins the level 1 plan");
assert.equal(plan(2000, 100, { level: 8 }, "design", 1), 2000 * scale(100, 8),
  "pins the level 8 plan");
assert.notEqual(plan(2000, 100, { level: 1 }, "design", 1),
  plan(2000, 100, { level: 8 }, "design", 1), "a better office plans less work");

// 5. The floor wins when scaling would go below three seconds for the stage.
assert.equal(plan(600, 100, { level: 1 }, "programming", 1), S.MIN_SEC * 100);
assert.equal(ctx._dtSpeedInfo().after, S.MIN_SEC, "reports the three-second floor");

// 6. A start-up plan (scale 1) leaves the planned work untouched.
assert.equal(plan(1000, 2.65, { level: 1 }, "design", 1), 1000);
assert.equal(plan(1, 2.65, { level: 1 }, "design", 1), 1);

// 7. The last plan is published for diagnostics.
ctx._dtSpeedInfo = ctx._dtSpeedInfo || (() => null);
plan(2000, 100, { level: 1 }, "engineering", 1);
const info = ctx._dtSpeedInfo();
assert.equal(info.stage, "engineering");
near(info.scale, scale(100, 1), 0, "reported scale");
near(info.before, 20, 1e-12, "reported seconds before");
near(info.after, 2000 * scale(100, 1) / 100, 1e-12, "reported seconds after");

// 8. Bad input is returned unchanged, and a missing staff summary does not throw.
for (const h of [0, -1, -100, NaN, undefined, null, "x"]) {
  assert.equal(plan(h, 100, { level: 8 }, "design", 1), h, "bad h: " + h);
}
for (const pps of [0, -1, -100, NaN, undefined, null, "x"]) {
  assert.equal(plan(1000, pps, { level: 8 }, "design", 1), 1000, "bad pps: " + pps);
}
assert.ok(plan(1000, 100, null, "design", 1) <= 1000);
assert.ok(plan(1000, 100, {}, "design", undefined) <= 1000);

// 9. The inserted planner hook runs with the planner's locals, so a swapped
// argument list cannot silently disable the speed-up.
if (process.argv[3]) {
  const runHook = vm.runInContext(
    "(function(h,f,_,e,i){" + process.argv[3] + ";return h;})", ctx);
  const h = 1000, pps = 100, staff = { level: 5 }, stage = "design", weight = 1;
  const out = runHook(h, pps, staff, stage, weight);
  assert.equal(out, plan(h, pps, staff, stage, weight), "hook matches the planner");
  assert.ok(out < h, "hook reduces the planned work");
}

console.log("speed runtime: " + (process.argv[3] ? 10 : 9) + " scenarios passed");
