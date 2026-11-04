// Rival launch sim, 2008-2040, Original and real-life calendars:
//   node sim.js <game site dir> [out.json]
// Reads the game's part tables, applies the round-6 real dates (real-data.js)
// for non-Original presets, runs every line and prints the acceptance numbers.
const fs = require("fs");
const path = require("path");
const load = (f) => new Function(fs.readFileSync(path.join(__dirname, f), "utf8") + "\nreturn globalThis._dtRivCore;")();
const C = load("rivals-core.js");
const R = C.RIV;
const site = process.argv[2];
const realSrc = fs.readFileSync(path.join(__dirname, "../difficulty-patches/real-data.js"), "utf8");
const REAL = new Function(realSrc + "\nreturn _DT_REAL_ROWS;")();

const index = {};
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith(".json")) index[f.name.slice(0, -5)] = p;
  }
})(site);
function table(name, col) {
  const j = JSON.parse(fs.readFileSync(index[name], "utf8"));
  const rows = j.data.map((x) => ({ label: x[0][0], day: Number(x[col][0]) }));
  return rows;
}
const specs = new Map();
for (const t of Object.values(R.TYPES)) for (const s of t.specs) specs.set(s.t, s.c);
function calendar(real) {
  const days = {};
  const labels = {};
  for (const [name, col] of specs) {
    if (!index[name]) throw new Error("missing table " + name);
    const rows = table(name, col);
    const r = REAL[name];
    if (real && r && r.col === col) for (const k in r.rows) rows[Number(k)].day = r.rows[k];
    days[name] = { days: rows.map((x) => x.day), labels: rows.map((x) => x.label) };
    labels[name] = days[name].labels;
  }
  return { days, labels };
}
const SEED = "sim";
const Y0 = 2008;
const Y1 = Number(process.env.RIV_SIM_Y1) || 2040; // RIV_SIM_Y1=2070: run past 2040
const PRESETS = { original: { real: false, mul: C.mul(true, 1) }, realistic: { real: true, mul: C.mul(false, 1.1) }, brutal: { real: true, mul: C.mul(false, 1.5) },
  // custom sliders at the ends of the Competitor strength range (difficulty.js 0.5-3)
  customMin: { real: true, mul: C.mul(false, 0.5) }, customMax: { real: true, mul: C.mul(false, 3) } };

function run(cal) {
  const prev = {};
  const out = [];
  for (let y = Y0; y <= Y1; y++) {
    for (const L of C.yearPlan(y, SEED)) {
      const rows = C.pick(L.line, L.day, prev[L.line.id] || null, cal.days);
      const p = prev[L.line.id];
      const spec = R.TYPES[L.line.type].specs;
      const gaps = spec.map((s, i) => {
        // gap to the believable frontier: the best row a lag-0 leader could ship
        // that day (game list, real-life ceiling); months since a better row came out
        const tab = cal.days[s.t];
        const best = C.underCap(s, C.allowed(tab.days, L.day), y, tab, L.line.cap && L.line.cap[i]);
        if (rows[i] < 0 || rows[i] >= best) return 0;
        return Math.max(0, (L.day - tab.days[rows[i] + 1]) / R.MONTH_DAYS);
      });
      const ahead = spec.some((s, i) => rows[i] > C.allowed(cal.days[s.t].days, L.day));
      const up = p ? rows.reduce((a, r, i) => a + Math.max(0, r - p[i]), 0) : 0;
      const down = p ? rows.some((r, i) => r < p[i]) : false;
      out.push({ ...L, rows, gaps, ahead, up, down, price: C.price(L.line, y) });
      prev[L.line.id] = rows;
    }
  }
  return out;
}
// Stylised player device: rating 8, no hype/marketing, M fixed; game tick math
// (atlas sales-demand 5.4/5.5). Returns lifetime units over 365 days.
function playerUnits(release, hits) {
  const M = 1e6;
  let pop = 100;
  let sold = 0;
  let used = 0;
  for (let t = 0; t < 365 && pop > 0; t++) {
    const O = Math.max(0, M - sold);
    sold += O > 0 ? Math.min(O, (0.01 * M + 0.026 * O) * pop / 100) : 0.01 * M * pop / 100;
    const extra = C.decay(hits, release + t, used);
    used += extra;
    pop -= 1.2 * (1 + t / 240) * (1 - 0.58 * 0.6) + extra;
  }
  return sold;
}
function effect(launches, cal, mul) {
  const res = {};
  for (const type of Object.keys(R.TYPES)) {
    const ch = [];
    for (let y = 2010; y <= Y1; y++) {
      for (let m = 1; m <= 12; m++) {
        const rel = C.day(y, m, 15);
        if (rel < R.TYPES[type].unlock) continue;
        const market = C.market(launches.map((L) => ({ type: L.line.type, day: L.day, rows: L.rows })), type, rel);
        for (const rating of [6, 8]) {
          const hits = [];
          for (const L of launches) {
            if (L.line.type !== type || L.day <= rel || L.day > rel + 365) continue;
            const x = C.hit(L, L.rows, rel, market, rating, mul);
            if (x > 0) hits.push({ day: L.day, x });
          }
          const base = playerUnits(rel, []);
          ch.push((playerUnits(rel, hits) / base - 1) * 100);
        }
      }
    }
    if (!ch.length) continue;
    ch.sort((a, b) => a - b);
    const mean = ch.reduce((a, b) => a + b, 0) / ch.length;
    res[type] = { mean: +mean.toFixed(1), p10: +ch[Math.floor(ch.length * 0.1)].toFixed(1), worst: +ch[0].toFixed(1), best: +ch[ch.length - 1].toFixed(1) };
  }
  return res;
}
const report = {};
for (const [name, p] of Object.entries(PRESETS)) {
  const cal = calendar(p.real);
  const launches = run(cal);
  const perLineYear = {};
  const stuck = [];
  const lines = {};
  for (const L of launches) {
    const id = L.line.id;
    (lines[id] = lines[id] || []).push(L);
    perLineYear[id + L.year] = (perLineYear[id + L.year] || 0) + 1;
  }
  for (const [id, ls] of Object.entries(lines)) {
    for (let i = 2; i < ls.length; i++) {
      const fr = (s, d) => C.underCap(s, C.allowed(cal.days[s.t].days, d), C.year(d), cal.days[s.t]);
      const moved = R.TYPES[ls[i].line.type].specs.some((s) => fr(s, ls[i].day) > fr(s, ls[i - 2].day));
      const over = ls[i].gaps.some((g, k) => g - C.lag(ls[i].line, R.TYPES[ls[i].line.type].specs[k], k, ls[i].year) > R.CATCH_UP + 1);
      if (moved && ls[i].up + ls[i - 1].up === 0 && over) stuck.push(id + "@" + ls[i].year);
    }
  }
  const byArch = {};
  for (const L of launches) {
    if (L.year > 2040) continue;
    const a = (byArch[L.line.arch + "/" + L.line.tier] = byArch[L.line.arch + "/" + L.line.tier] || { n: 0, gap: 0, max: 0, up: 0 });
    a.n++;
    const g = L.gaps.reduce((x, y) => x + y, 0) / L.gaps.length;
    a.gap += g;
    a.max = Math.max(a.max, ...L.gaps);
    a.up += L.up;
  }
  for (const a of Object.values(byArch)) {
    a.gap = +(a.gap / a.n).toFixed(1);
    a.max = +a.max.toFixed(1);
    a.up = +(a.up / a.n).toFixed(2);
  }
  const perYear = {};
  for (let y = Y0; y <= Y1; y++) perYear[y] = launches.filter((L) => L.year === y).length;
  const maxLineYear = Math.max(...Object.values(perLineYear));
  const samples = {};
  for (const id of ["appel-phone", "samsong-s", "xiaome-phone", "redme-phone", "nokya-phone", "appel-book", "samsong-tv", "somy-console", "appel-watch", "somy-wh", "somy-vr", "xiaome-scooter", "aliemware-kb", "appel-pad"]) {
    samples[id] = (lines[id] || []).filter((L) => [2008, 2010, 2013, 2016, 2017, 2020, 2023, 2026, 2030, 2035, 2040].includes(L.year)).map((L) => {
      const sp = R.TYPES[L.line.type].specs;
      return L.year + " " + L.line.stem + " " + L.n + " $" + L.price + ": " + sp.map((s, i) => (L.rows[i] < 0 ? "-" : C.label(s, cal.labels[s.t][L.rows[i]]))).join(", ");
    });
  }
  // Realism spot checks (design section 7), counted on non-Original calendars.
  const val = (L, i) => C.num(cal.labels[R.TYPES[L.line.type].specs[i].t][L.rows[i]], R.TYPES[L.line.type].specs[i].gb);
  const realism = !p.real ? null : {
    phone2017over60Hz: launches.filter((L) => L.line.type === "phone" && L.year === 2017 && val(L, 0) > 60).length,
    phone2017over16MP: launches.filter((L) => L.line.type === "phone" && L.year === 2017 && val(L, 1) > 16).length,
    phone120HzBefore2020: launches.filter((L) => L.line.type === "phone" && L.year < 2020 && val(L, 0) >= 120).length,
    orchardOver60HzTo2020: launches.filter((L) => L.line.id === "appel-phone" && L.year <= 2020 && val(L, 0) > 60).length,
    orchardOver50MPTo2030: launches.filter((L) => L.line.id === "appel-phone" && L.year <= 2030 && val(L, 1) > 50).length,
    tvOver4KTo2026: launches.filter((L) => L.line.type === "tv" && L.year <= 2026 && val(L, 0) > 8.9e6).length,
    phoneRamOver12GBTo2030: launches.filter((L) => L.line.type === "phone" && L.year <= 2030 && val(L, 2) > 12).length,
    laptopOver60HzTo2020: launches.filter((L) => L.line.type === "laptop" && L.year <= 2020 && val(L, 3) > 60).length,
  };
  // RIV_SIM_SHOW=id,id: print every launch of those lines (Realistic) for spot checks
  if (name === "realistic" && process.env.RIV_SIM_SHOW) for (const id of process.env.RIV_SIM_SHOW.split(",")) for (const L of lines[id] || []) {
    const sp = R.TYPES[L.line.type].specs;
    console.log("show " + L.year + "-" + String(C.year(L.day) === L.year ? Math.floor(((L.day - 1) % 365) / 30.4) + 1 : "?").padStart(2, "0") + " " + L.line.stem + " " + L.n + " $" + L.price + ": " + sp.map((s, i) => (L.rows[i] < 0 ? "-" : C.label(s, cal.labels[s.t][L.rows[i]]))).join(", "));
  }
  report[name] = {
    realism,
    launches: launches.length, perYear, maxLineYear, ahead: launches.filter((L) => L.ahead).length,
    down: launches.filter((L) => L.down).length, stuck, byArch, effect: effect(launches, cal, p.mul), samples,
  };
}
const txt = JSON.stringify(report, null, 1);
if (process.argv[3]) fs.writeFileSync(process.argv[3], txt);
for (const [n, r] of Object.entries(report)) {
  console.log(`== ${n}: launches ${r.launches}, ahead ${r.ahead}, downgrades ${r.down}, stuck ${r.stuck.length} ${r.stuck.slice(0, 5)}, max per line-year ${r.maxLineYear}`);
  console.log(" per year:", Object.entries(r.perYear).map(([y, v]) => y.slice(2) + ":" + v).join(" "));
  console.log(" by arch/tier (avg gap months, max gap, rows up per launch):", JSON.stringify(r.byArch));
  console.log(" effect % on a device's first-year units:", JSON.stringify(r.effect));
  if (r.realism) console.log(" realism violations (all must be 0):", JSON.stringify(r.realism));
  if (n === "original" || n === "realistic") for (const [id, s] of Object.entries(r.samples)) console.log("  " + s.join("\n  "));
}
