// Pure-core tests for rivals-core.js: node test_rivals_core.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const C = new Function(fs.readFileSync(path.join(__dirname, "rivals-core.js"), "utf8") + "\nreturn globalThis._dtRivCore;")();
const R = C.RIV;

// Fixture phone lists (days like Realistic refresh rate; others plain).
const D = (y) => C.day(y, 1, 1);
const hz = { days: [-10, -10, 4136, 4136, 4440, 4532, 5338], labels: [30, 60, 75, 90, 120, 144, 165] };
const lin = (n, from, every, labels) => ({ days: Array.from({ length: n }, (_, i) => (i < 2 ? -10 : from + i * every)), labels });
const tables = {
  ArrayScreenRefreshRate_Smartphone: hz,
  ArrayCameraMPX_Database: lin(20, 300, 300, [1, 2, 3, 5, 8, 12, 13, 16, 20, 24, 40, 48, 50, 64, 108, 160, 200, 250, 300, 400]),
  ArrayRAM_Smartphones: lin(12, 300, 500, ["64 MB", "128 MB", "256 MB", "512 MB", "1 GB", "2 GB", "4 GB", "6 GB", "8 GB", "12 GB", "16 GB", "24 GB"]),
  ArrayROM_Smartphones: lin(10, 300, 600, ["256 MB", "8 GB", "16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB", "2 TB"]),
  ArrayNetwork_Smartphone: lin(8, 300, 800, ["2G", "2.5G", "3G", "3.5G", "4G", "4.5G", "5G", "5G+"]),
};
const line = (o) => Object.assign({ id: "t", co: "T", type: "phone", arch: "leader", tier: "flag", stem: "T", n0: 1, from: 2008, to: 9999, m: 3 }, o);

// 1. Never ahead of the game, never a downgrade, at most `step` rows up, ceiling respected.
{
  for (const arch of Object.keys(R.ARCH)) {
    let prev = null;
    for (let y = 2009; y <= 2040; y++) {
      const L = line({ arch, fade: arch === "fading" ? 2012 : undefined });
      const day = C.day(y, 3, 10);
      const rows = C.pick(L, day, prev, tables);
      R.TYPES.phone.specs.forEach((s, i) => {
        assert.ok(rows[i] <= C.allowed(tables[s.t].days, day), `${arch} ${y} ${s.t} ahead`);
        if (prev && prev[i] >= 0) {
          assert.ok(rows[i] >= Math.min(prev[i], C.allowed(tables[s.t].days, day)), `${arch} ${y} downgrade`);
          const floor = C.allowed(tables[s.t].days, day - (C.lag(L, s, i, y) + R.CATCH_UP) * R.MONTH_DAYS);
          assert.ok(rows[i] - prev[i] <= R.ARCH[arch].step || rows[i] <= floor, `${arch} ${y} too fast`);
        }
      });
      prev = rows;
    }
  }
}
// 1b. a fading line's lag grows at New Year, so a Dec launch then a Feb launch moves
// day - lag backwards; the spec must hold, not step down. A preset switch that makes the game stop offering
// the row is the only way down.
{
  const fad = line({ arch: "fading", fade: 2019, from: 2020, m: [[2020, 12], [2021, 2]] });
  const t = { ArrayScreenRefreshRate_Smartphone: { days: [-10, 4228, 4400], labels: [30, 60, 90] } };
  const a = C.pick(fad, 4724, null, t);
  assert.strictEqual(a[0], 1);
  assert.strictEqual(C.pick(fad, 4786, a, t)[0], 1, "no downgrade across a lag jump");
  const moved = { ArrayScreenRefreshRate_Smartphone: { days: [-10, 9000, 9100], labels: [30, 60, 90] } };
  assert.strictEqual(C.pick(fad, 4786, a, moved)[0], 0, "preset switch: never ahead of the game wins");
}
// 2. The 2017 problem: 144 Hz is out in the game's list (day 4532 here moved earlier), but the real-life ceiling holds 60 Hz.
{
  const early = { days: [-10, -10, 2000, 2100, 2200, 2300, 2400], labels: hz.labels };
  const rows = C.pick(line({}), C.day(2017, 6, 1), null, Object.assign({}, tables, { ArrayScreenRefreshRate_Smartphone: early }));
  assert.strictEqual(early.labels[rows[0]], 60);
  const rows20 = C.pick(line({}), C.day(2020, 6, 1), null, Object.assign({}, tables, { ArrayScreenRefreshRate_Smartphone: early }));
  assert.strictEqual(early.labels[rows20[0]], 120);
  assert.strictEqual(C.num("512 MB", 1), 0.5);
  assert.strictEqual(C.num("1 TB", 1), 1024);
  assert.strictEqual(C.num("FHD+ (2160×1080)"), 2160 * 1080);
}
// 2b. A line's own ceiling (Orchard: 12 MP until 2021, 48 MP from 2022) beats the type's (108 MP in 2019).
{
  const appel = R.LINES.find((l) => l.id === "appel-phone");
  const mp = tables.ArrayCameraMPX_Database;
  const at = (y) => mp.labels[C.pick(appel, C.day(y, 9, 15), null, tables)[1]];
  assert.ok(at(2019) <= 12 && at(2021) <= 12, "Orchard stays at 12 MP to 2021");
  assert.ok(at(2023) <= 48 && at(2023) > 12, "Orchard 48 MP class from 2022");
  const xiaome = R.LINES.find((l) => l.id === "xiaome-phone");
  assert.ok(mp.labels[C.pick(xiaome, C.day(2021, 9, 15), null, tables)[1]] > 12, "others follow the type ceiling");
}
// 2c. After 2026 a ceiling grows by the slower of the game's list and the research rate.
{
  const spec = R.TYPES.phone.specs[2]; // RAM, +10%/yr
  const fast = { days: [-10, 6000, 6800, 7000, 7300, 7700], labels: ["4 GB", "8 GB", "12 GB", "48 GB", "96 GB", "192 GB"] };
  const flat = { days: [-10, 6000, 6500, 99999], labels: ["4 GB", "8 GB", "12 GB", "48 GB"] }; // nothing new after mid-2026
  const c2030 = C.cap(spec, 2030, fast);
  assert.ok(Math.abs(c2030 - 12 * Math.pow(1.1, 4)) < 1e-9, "research rate limits a fast game list");
  assert.strictEqual(C.cap(spec, 2030, flat), 12, "a list that stops growing holds the ceiling");
  const nm = R.TYPES.watch.specs[3]; // lower is better, -7%/yr
  const chips = { days: [-10, 6000, 6800, 7000], labels: [28, 5, 3, 1] };
  assert.ok(Math.abs(C.cap(nm, 2028, chips) - 3 * Math.pow(0.93, 2)) < 1e-9, "lower-is-better shrinks no faster than research");
}
// 3. Schedule: deterministic, unlock-gated, max one launch per line per year, exits honoured.
{
  const a = JSON.stringify(C.yearPlan(2021, "seed").map((L) => [L.id, L.day, L.n]));
  assert.strictEqual(a, JSON.stringify(C.yearPlan(2021, "seed").map((L) => [L.id, L.day, L.n])));
  assert.notStrictEqual(a, JSON.stringify(C.yearPlan(2021, "other").map((L) => [L.id, L.day, L.n])));
  for (let y = 2008; y <= 2045; y++) {
    const plan = C.yearPlan(y, "seed");
    const ids = plan.map((L) => L.line.id);
    assert.strictEqual(new Set(ids).size, ids.length, `${y} twice`);
    for (const L of plan) {
      assert.ok(L.day >= R.TYPES[L.line.type].unlock, `${L.id} before its type unlocks`);
      assert.ok(C.year(L.day) === y && y >= L.line.from && y <= L.line.to, `${L.id} outside its years`);
    }
  }
  assert.ok(!C.yearPlan(2021, "seed").some((L) => L.line.id === "elg-phone"), "ELG left phones after 2020");
  const consoles = [];
  for (let y = 2013; y <= 2034; y++) if (C.launches(R.LINES.find((l) => l.id === "somy-console"), y)) consoles.push(y);
  assert.deepStrictEqual(consoles, [2013, 2020, 2027, 2034]);
  // A year list ending before 2026 carries on every `every` years from its last year (no silent gap).
  const fit = [];
  for (let y = 2016; y <= 2030; y++) if (C.launches(R.LINES.find((l) => l.id === "fitbyte-watch"), y)) fit.push(y);
  assert.deepStrictEqual(fit, [2016, 2017, 2018, 2019, 2020, 2022, 2024, 2026, 2028, 2030]);
  // No open line is silent for longer than its cycle (+1 year) after its first launch.
  for (const l of R.LINES) {
    let lastY = null;
    for (let y = l.from; y <= Math.min(l.to, 2045); y++) {
      if (!C.launches(l, y)) continue;
      if (lastY !== null) {
        const gaps = l.years ? l.years.slice(1).map((v, k) => v - l.years[k]) : [];
        assert.ok(y - lastY <= Math.max(l.every || 1, ...gaps), `${l.id} silent ${lastY}-${y}`);
      }
      lastY = y;
    }
  }
}
// 4. Effect: off on Original, bounded by the per-day and per-year caps, shielded by rating.
{
  assert.strictEqual(C.mul(true, 1), 0);
  assert.strictEqual(C.mul(false, 1.1), 1);
  const L = { line: line({}), day: D(2020) + 60 };
  const rows = [5, 15, 10, 8, 6];
  const market = [4, 12, 9, 8, 6];
  assert.strictEqual(C.hit(L, rows, D(2020), market, 8, 0), 0, "Original: no effect");
  assert.strictEqual(C.hit(L, rows, L.day + 1, market, 8, 1), 0, "released after the launch: no effect");
  assert.strictEqual(C.hit(L, [4, 12, 9, 8, 6], D(2020), market, 8, 1), 0, "beats nothing: no effect");
  const x6 = C.hit(L, rows, D(2020), market, 6, 1);
  const x10 = C.hit(L, rows, D(2020), market, 10, 1);
  assert.ok(Math.abs(x6 - 0.6 * (3 / 5) * 0.88) < 1e-9, "x = base * k/n * weights * shield");
  assert.ok(x10 < x6 && Math.abs(x10 / (0.6 * (3 / 5)) - 0.4) < 1e-9);
  const hits = [{ day: 100, x: 0.5 }, { day: 110, x: 0.5 }];
  assert.strictEqual(C.decay(hits, 120, 0), R.FX_CAP_DAY);
  assert.strictEqual(C.decay(hits, 100 + R.FX_DAYS, 0), 0.5, "first hit over after FX_DAYS");
  assert.strictEqual(C.decay(hits, 120, R.FX_CAP_DEVICE), 0, "per-device cap");
  assert.ok(Math.abs(C.decay(hits, 120, R.FX_CAP_DEVICE - 0.1) - 0.1) < 1e-9, "only what is left of the cap");
  assert.strictEqual(C.decay(hits, 99, 0), 0, "not before the launch");
}
// 5. Prices follow tier and archetype, rounded to ..9.
{
  assert.strictEqual(C.price(line({}), 2020), 1029);
  assert.strictEqual(C.price(line({ arch: "budget", tier: "budget" }), 2020), 129);
  assert.ok(C.price(line({}), 2040) > C.price(line({}), 2020));
}
// 6. Round-9 review (rivrev) fixes.
{
  // 6a. Lag never looks back before the type unlock: a 2008 launch (fading, 10+ months lag) still gets
  // the rows the game offers on day 1, and a VR set right after its unlock gets at least the unlock rows.
  const r08 = C.pick(line({ arch: "fading", fade: 2008 }), C.day(2008, 3, 10), null, tables);
  assert.ok(r08.every((r) => r >= 0), "2008 launch has every spec: " + r08);
  const nokya = C.pick(R.LINES.find((l) => l.id === "nokya-phone"), C.day(2008, 8, 10), null, tables);
  assert.ok(nokya.every((r) => r >= 0), "Lumen 900 (Aug 2008) has every spec");
  const vrTab = { days: [-10, 2000, 2914, 3300], labels: [480, 715, 1080, 1440] };
  const vr = { ArrayScreenResolution_VR: vrTab, ArrayScreenRefreshRate_VR: { days: [-10, 2914], labels: [50, 90] }, ArrayRAM_VR: { days: [-10, 2914], labels: ["512 MB", "2 GB"] } };
  const rise = C.pick(R.LINES.find((l) => l.id === "somy-vr"), C.day(2016, 10, 10), null, vr);
  assert.deepStrictEqual(rise, [2, 1, 0], "first VR rows = rows offered at the VR unlock, not 2 years before it (RAM held by the 2016 ceiling)");
  // 6b. Model names: PlayStage 4 (2013) -> Pro 4 (2016) -> 5 (2020); WX-1000M 4 in 2020; no name twice.
  const n = (id, y) => C.yearPlan(y, "s").find((L) => L.line.id === id).n;
  assert.deepStrictEqual([n("somy-console", 2013), n("somy-console-pro", 2016), n("somy-console", 2020), n("somy-console-pro", 2024)], [4, 4, 5, 5]);
  assert.strictEqual(n("somy-wh", 2020), 4);
  const names = new Set();
  for (let y = 2008; y <= 2070; y++) for (const L of C.yearPlan(y, "s")) {
    const name = L.line.co + " " + L.line.stem + " " + L.n;
    assert.ok(!names.has(name), "model name twice: " + name);
    names.add(name);
  }
  // 6c. Prices: laptops flat (a 2008 OrchardBook Pro is not $700 cheaper than 2020), TVs get cheaper, Hisence U8 near $1,000.
  const book = R.LINES.find((l) => l.id === "appel-book");
  assert.strictEqual(C.price(book, 2008), C.price(book, 2020));
  const qv = R.LINES.find((l) => l.id === "samsong-tv");
  assert.ok(C.price(qv, 2008) > C.price(qv, 2020) && C.price(qv, 2040) < C.price(qv, 2020));
  const u8 = C.price(R.LINES.find((l) => l.id === "hisence-tv"), 2021);
  assert.ok(u8 >= 900 && u8 <= 1400, "Hisence U8 2021 $" + u8);
  // 6d. A device whose own parts match the launch is not "dated"; partly better parts lower k.
  const L = { line: line({}), day: D(2020) + 60 };
  const market = [4, 12, 9, 8, 6];
  assert.strictEqual(C.hit(L, [5, 15, 10, 8, 6], D(2020), market, 6, 1, [5, 15, 10, 8, 6]), 0);
  const part = C.hit(L, [5, 15, 10, 8, 6], D(2020), market, 6, 1, [5, -1, -1, -1, -1]);
  assert.ok(Math.abs(part - 0.6 * (2 / 5) * 0.88) < 1e-9, "only the specs that beat both count");
  // 6g. Round 9: Somy (Xperia) flagships keep that year's parts like real Sony (no fade): <= 1 year behind leaders.
  const somy = R.LINES.find((l) => l.id === "somy-phone");
  assert.ok(!somy.fade);
  for (const y of [2016, 2020, 2026]) assert.ok(C.lag(somy, R.TYPES.phone.specs[0], 0, y) <= 12, "Somy lag " + y);
  // 6e. VERIFY-NOTES dates: Stellar S8 in April 2017, Note 4 in October 2014; Swap GPU 4+ years behind.
  const month = (id, y) => C.yearPlan(y, "s").find((L) => L.line.id === id).day;
  assert.ok(month("samsong-s", 2017) > C.day(2017, 4, 1) && month("samsong-s", 2017) < C.day(2017, 5, 1));
  assert.ok(month("samsong-fold", 2014) > C.day(2014, 10, 1) && month("samsong-fold", 2014) < C.day(2014, 11, 1));
  const swap = R.LINES.find((l) => l.id === "nintendu-console");
  assert.ok(C.lag(swap, R.TYPES.console.specs[0], 0, 2017) >= 48, "Nintendu GPU lag");
  // 6f. Past 2040: every launch to 2070 has a sane price and no spec ahead of the game.
  const prev = {};
  for (let y = 2041; y <= 2070; y++) for (const L of C.yearPlan(y, "s")) {
    if (L.line.type !== "phone") continue;
    const rows = C.pick(L.line, L.day, prev[L.line.id] || null, tables);
    R.TYPES.phone.specs.forEach((s, i) => assert.ok(rows[i] <= C.allowed(tables[s.t].days, L.day), L.id + " ahead"));
    const pr = C.price(L.line, y);
    assert.ok(pr > 0 && pr < 5000 && pr % 10 === 9, L.id + " price " + pr);
    prev[L.line.id] = rows;
  }
}
console.log("rivals core: all tests passed");
