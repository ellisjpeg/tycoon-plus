// ── Rival launches: pure core ──
// No game access here: the engine (rivals.js) hands in the part tables as the
// game has them on the active preset, and calls these functions. Same code
// runs in node (sim.js, test_rivals_core.js) and in the game.
// - Schedule: each rival "line" (one company, one device type, one tier)
//   launches on fixed real-life months, with a seeded 3..25 day jitter.
// - Specs: per headline part list, the best row the game has unlocked
//   `lag` months before the launch day, never ahead of what the game offers
//   that day, at most `step` rows up per launch, never more than 12 months
//   behind its own lag (no company stuck), never a downgrade.
// - Effect: a launch that beats every rival on sale when a player's device of
//   that type came out makes that device lose popularity (POP) a little faster
//   for 56 days, bounded per day and per device; off on Original.
// Game names only. Day 1 = 1 Jan 2008, 365-day years (the game's _yearFrac).
var _DT_RIV = {
  MONTH_START: [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334],
  MONTH_DAYS: 30.4,
  CATCH_UP: 12, // months: a line is never further behind than lag + this
  POST_EXP: 0.5, // after 2026, specs with no research rate grow by (game list growth)^this
  // lag: months behind the frontier; step: rows up per launch; w: weight of the
  // sales effect; price: share of the type's tier price.
  ARCH: {
    leader: { lag: 0, step: 2, w: 1, price: 1.15 },
    follower: { lag: 4, step: 2, w: 0.8, price: 1 },
    budget: { lag: 6, step: 2, w: 0.6, price: 0.65 },
    newcomer: { lag: 9, step: 2, w: 0.5, price: 0.9 },
    fading: { lag: 10, step: 1, w: 0.4, price: 0.95 },
  },
  FADE_PER_YEAR: 3, // fading lines fall 3 more months behind each year ...
  FADE_MAX: 36, // ... up to this many months
  TIER_LAG: { flag: 0, mid: 15, budget: 24 }, // research/rivals/market.md: flagship -> mid 16-25, -> budget 23-40 months
  TIER_W: { flag: 1, mid: 0.6, budget: 0.3 },
  // Sales effect (non-Original only): extra POP loss per day for FX_DAYS.
  FX_BASE: 0.6,
  FX_DAYS: 56,
  FX_CAP_DAY: 0.6, // all launches together, per device per day
  FX_CAP_DEVICE: 20, // per device in total (one number saved per device)
  PRICE_DRIFT: 0.025, // tier prices are 2020 USD; +2.5% a year (a type's `drift` overrides)
  // Headline part lists per device type: t table, c date column, f label format,
  // lag months added for every company (real flagships ship a "typical" row,
  // not the maxed-out one), unlock = day the game lets the player make the type.
  TYPES: {
    phone: { unlock: 1, price: [899, 449, 199], specs: [
      { t: "ArrayScreenRefreshRate_Smartphone", c: 1, f: "{} Hz", post: 0.03, cap: [[2008, 60], [2018, 60], [2019, 90], [2020, 120], [2026, 144]] },
      { t: "ArrayCameraMPX_Database", c: 1, f: "{} MP", lag: 6, post: 0.03, cap: [[2008, 5], [2010, 8], [2012, 13], [2014, 16], [2017, 16], [2018, 40], [2019, 108], [2022, 200], [2026, 200]] },
      { t: "ArrayRAM_Smartphones", c: 1, f: "{} RAM", lag: 12, gb: 1, post: 0.1, cap: [[2008, 0.128], [2010, 0.512], [2011, 1], [2013, 2], [2014, 3], [2016, 4], [2018, 6], [2019, 8], [2020, 12], [2026, 12]] },
      { t: "ArrayROM_Smartphones", c: 1, f: "{}", lag: 12, gb: 1, post: 0.15, cap: [[2008, 8], [2010, 16], [2015, 32], [2017, 64], [2019, 128], [2023, 256], [2026, 256]] },
      { t: "ArrayNetwork_Smartphone", c: 1, f: "{}" } ] },
    tablet: { unlock: 724, price: [799, 449, 199], specs: [
      { t: "ArrayScreenResolution_Tablet", c: 1, f: "{}", lag: 6, post: 0.03, cap: [[2010, 0.8e6], [2012, 3.2e6], [2015, 5.6e6], [2026, 5.7e6]] },
      { t: "ArrayScreenRefreshRate_Smartphone", c: 1, f: "{} Hz", lag: 6, post: 0.03, cap: [[2010, 60], [2016, 60], [2017, 120], [2026, 120]] },
      { t: "ArrayRAM_Smartphones", c: 1, f: "{} RAM", lag: 12, gb: 1, post: 0.1, cap: [[2010, 0.256], [2012, 1], [2015, 4], [2020, 6], [2021, 8], [2026, 12]] },
      { t: "ArrayROM_Smartphones", c: 1, f: "{}", lag: 12, gb: 1, post: 0.15, cap: [[2010, 16], [2014, 32], [2017, 64], [2020, 128], [2024, 256], [2026, 256]] } ] },
    laptop: { unlock: 1, price: [1499, 899, 499], drift: 0, specs: [ // VERIFY-NOTES: MacBook Pro was $1,999 in 2008 too
      { t: "ArrayCPUCores_Laptop", c: 1, f: "{} cores", lag: 6, post: 0.08, cap: [[2008, 2], [2011, 4], [2017, 6], [2019, 8], [2021, 10], [2023, 12], [2026, 16]] },
      { t: "ArrayRAM_Laptop", c: 1, f: "{} RAM", lag: 18, gb: 1, post: 0.1, cap: [[2008, 2], [2010, 4], [2012, 8], [2017, 16], [2026, 24]] },
      { t: "ArrayROM_LaptopSSD", c: 2, f: "{} SSD", lag: 12, gb: 1, post: 0.15, cap: [[2008, 128], [2012, 256], [2018, 512], [2023, 512], [2026, 1024]] },
      { t: "ArrayScreenRefreshRate_Laptop", c: 1, f: "{} Hz", lag: 24, post: 0.03, cap: [[2008, 60], [2020, 60], [2021, 120], [2024, 120], [2026, 165]] } ] },
    watch: { unlock: 2549, price: [399, 249, 99], specs: [
      { t: "ArrayScreenTechnology_Watches", c: 1, f: "{}", lag: 6 },
      { t: "ArrayBattery_Watches", c: 1, f: "{} mAh", lag: 6, post: 0.06, cap: [[2015, 250], [2018, 300], [2022, 500], [2026, 600]] },
      { t: "ArrayROM_Watches", c: 1, f: "{}", lag: 6, gb: 1, post: 0.15, cap: [[2015, 8], [2018, 16], [2020, 32], [2026, 64]] },
      { t: "ArrayCPUTechprocess_Watches", c: 1, f: "{} nm", lag: 6, lower: 1, post: -0.07, cap: [[2015, 28], [2016, 16], [2019, 7], [2021, 5], [2024, 3], [2026, 3]] } ] },
    headphones: { unlock: 2550, price: [349, 149, 49], specs: [
      { t: "ArrayBattery_Headphones", c: 2, f: "{} h battery", lag: 6, post: 0.06, cap: [[2016, 30], [2021, 30], [2022, 40], [2026, 60]] },
      { t: "ArrayBluetooth", c: 1, f: "Bluetooth {}", lag: 6, post: 0.02, cap: [[2016, 4.2], [2017, 5], [2020, 5.2], [2023, 5.3], [2025, 5.4], [2026, 6]] },
      { t: "ArrayCPULatencyLevel_Headphones", c: 1, f: "{} ms latency", lag: 6, lower: 1, post: -0.05, cap: [[2016, 200], [2020, 100], [2026, 40]] } ] },
    tv: { unlock: 1, price: [1499, 699, 349], drift: -0.02, specs: [ // TV prices fall
      { t: "ArrayScreenResolution_TV", c: 1, f: "{}", lag: 12, post: 0.03, cap: [[2008, 2.1e6], [2013, 8.9e6], [2026, 8.9e6]] },
      { t: "ArrayScreenRefreshRate_TV", c: 1, f: "{} Hz", lag: 12, post: 0.03, cap: [[2008, 60], [2010, 120], [2023, 144], [2024, 165], [2026, 165]] },
      { t: "ArrayScreenTechnology_TV", c: 1, f: "{}", lag: 6 } ] },
    scooter: { unlock: 2551, price: [799, 499, 299], specs: [
      { t: "ArrayBattery_Scooter", c: 1, f: "{} Ah battery", lag: 6, post: 0.06, cap: [[2016, 7.8], [2020, 12.8], [2026, 15]] },
      { t: "ArrayBreaks_Scooter", c: 1, f: "{}", lag: 6 },
      { t: "ArrayCPUCores_Scooter", c: 1, f: "{}-core controller", lag: 6 } ] },
    keyboard: { unlock: 2184, price: [199, 99, 49], specs: [
      { t: "ArrayCPUKeyScanRate_Keyboard", c: 1, f: "{} Hz scan", lag: 6 },
      { t: "ArrayCPUInputLatency_Keyboard", c: 1, f: "{} ms", lag: 6 },
      { t: "ArrayBattery_Keyboard", c: 2, f: "{} mAh", lag: 6 } ] },
    console: { unlock: 1, price: [499, 399, 299], specs: [
      { t: "ArrayGPUTFLOPS_Console", c: 1, f: "{} GFLOPS", lag: 0 },
      { t: "ArrayRAM_Console", c: 1, f: "{} RAM", lag: 0 },
      { t: "ArrayROM_ConsoleSSD", c: 1, f: "{} SSD", lag: 0 },
      { t: "ArrayCPUCores_Console", c: 1, f: "{} cores", lag: 0 } ] },
    vr: { unlock: 2914, price: [999, 499, 299], specs: [
      { t: "ArrayScreenResolution_VR", c: 4, f: "{} px per eye", lag: 6, post: 0.08, cap: [[2016, 1080], [2019, 1440], [2020, 1832], [2022, 2160], [2024, 3660], [2026, 3840]] },
      { t: "ArrayScreenRefreshRate_VR", c: 1, f: "{} Hz", lag: 6, post: 0.03, cap: [[2016, 90], [2019, 144], [2026, 144]] },
      { t: "ArrayRAM_VR", c: 2, f: "{} RAM", lag: 6, gb: 1, post: 0.1, cap: [[2016, 0.5], [2019, 4], [2020, 6], [2022, 12], [2024, 16], [2026, 16]] } ] },
  },
  // Lines: co company (ArrayCompanyNames game name), type, arch, tier, stem (model
  // name), n0 first number, from/to launch years (to inclusive, 9999 open),
  // m month or [[fromYear, month], ...], every years between launches (default
  // 1), years explicit launch years up to 2026 (then `every` from the last one),
  // fade year a line starts fading, bias {specIndex: extra lag months}, cap {specIndex:
  // ceiling list replacing the type's for this line}.
  LINES: [
    // Phones
    { id: "appel-phone", co: "Appel", type: "phone", arch: "leader", tier: "flag", stem: "Orchard", n0: 2, from: 2008, to: 9999, m: [[2008, 7], [2009, 6], [2011, 10], [2012, 9]],
      // Apple-style: 60 Hz until 2021, 12 MP 2015-2021 then 48 MP (never 108/200), less RAM (research/rivals/ph-apple.md)
      cap: { 0: [[2008, 60], [2020, 60], [2021, 120], [2026, 120]], 1: [[2008, 2], [2009, 3.2], [2010, 5], [2011, 8], [2015, 12], [2021, 12], [2022, 48], [2026, 48]], 2: [[2008, 0.128], [2010, 0.512], [2012, 1], [2015, 2], [2016, 3], [2019, 4], [2020, 6], [2023, 8], [2025, 12], [2026, 12]] } },
    { id: "samsong-s", co: "Samsong", type: "phone", arch: "leader", tier: "flag", stem: "Stellar S", n0: 1, from: 2010, to: 9999, m: [[2010, 6], [2011, 4], [2012, 5], [2013, 4], [2016, 3], [2017, 4], [2018, 3], [2021, 2]] }, // VERIFY-NOTES market/ph-samsung: S II Apr 2011, S III May 2012, S8 Apr 2017
    { id: "samsong-fold", co: "Samsong", type: "phone", arch: "leader", tier: "flag", stem: "Stellar Note", n0: 1, from: 2011, to: 9999, m: [[2011, 10], [2012, 9], [2014, 10], [2015, 8]] }, // VERIFY-NOTES: Note 4 Oct 2014
    { id: "gooqle-phone", co: "Gooqle", type: "phone", arch: "follower", tier: "flag", stem: "Pixon", n0: 1, from: 2010, to: 9999, m: [[2010, 1], [2011, 11], [2016, 10], [2024, 8]] },
    { id: "huavei-phone", co: "Huavei", type: "phone", arch: "follower", tier: "flag", stem: "Summit P", n0: 1, from: 2012, to: 9999, m: [[2012, 1], [2013, 6], [2014, 5], [2015, 4], [2017, 2], [2018, 3], [2021, 7], [2022, 9], [2023, 3], [2024, 4]] },
    { id: "xiaome-phone", co: "Xiaome", type: "phone", arch: "budget", tier: "flag", stem: "Mo", n0: 1, from: 2011, to: 9999, m: [[2011, 8], [2014, 7], [2016, 2], [2017, 4], [2018, 5], [2019, 2], [2021, 3], [2022, 7], [2023, 4], [2024, 2]] },
    { id: "redme-phone", co: "Redme", type: "phone", arch: "budget", tier: "budget", stem: "Redme Note", n0: 7, from: 2019, to: 9999, m: [[2019, 1], [2020, 3], [2023, 10], [2024, 9]] },
    { id: "realmee-phone", co: "Realmee", type: "phone", arch: "newcomer", tier: "mid", stem: "Realmee GT", n0: 1, from: 2018, to: 9999, m: 5 },
    { id: "nokya-phone", co: "Nokya", type: "phone", arch: "fading", fade: 2010, tier: "flag", stem: "Lumen", n0: 900, from: 2008, to: 2015, m: [[2008, 8], [2009, 6], [2010, 10], [2011, 11], [2014, 7], [2015, 11]] }, // VERIFY-NOTES: Lumia 930 Jul 2014
    { id: "nokya-hmd", co: "Nokya", type: "phone", arch: "budget", tier: "mid", stem: "Nokya G", n0: 10, from: 2017, to: 2023, years: [2017, 2019, 2021, 2023], m: [[2017, 8], [2019, 2], [2021, 7], [2023, 6]] },
    { id: "blackberie-phone", co: "BlackBerie", type: "phone", arch: "fading", fade: 2010, tier: "flag", stem: "Bolt", n0: 9000, from: 2008, to: 2018, m: [[2008, 8], [2013, 1], [2014, 9], [2015, 11], [2017, 4], [2018, 6]] },
    { id: "onepluss-phone", co: "OnePluss", type: "phone", arch: "newcomer", tier: "flag", stem: "OnePluss", n0: 1, from: 2014, to: 9999, m: [[2014, 4], [2015, 7], [2016, 6], [2018, 5], [2020, 4], [2021, 3], [2022, 1], [2024, 10]], bias: { 0: -9 } },
    { id: "oppro-phone", co: "OPPRO", type: "phone", arch: "follower", tier: "flag", stem: "Find", n0: 1, from: 2013, to: 9999, m: [[2013, 9], [2015, 5], [2016, 3], [2017, 6], [2019, 4], [2020, 3], [2024, 1]] },
    { id: "viwo-phone", co: "Viwo", type: "phone", arch: "follower", tier: "flag", stem: "Viwo X", n0: 6, from: 2016, to: 9999, m: [[2016, 11], [2017, 9], [2018, 6], [2019, 9], [2020, 6], [2021, 9], [2022, 4], [2023, 11], [2024, 10]] },
    { id: "hts-phone", co: "HTS", type: "phone", arch: "follower", fade: 2015, tier: "flag", stem: "Uno", n0: 1, from: 2008, to: 2018, m: [[2008, 10], [2009, 7], [2010, 4], [2011, 5], [2012, 4], [2013, 3], [2016, 5], [2017, 6]] },
    { id: "elg-phone", co: "ELG", type: "phone", arch: "follower", fade: 2017, tier: "flag", stem: "Optima G", n0: 1, from: 2008, to: 2020, m: [[2008, 3], [2012, 11], [2013, 9], [2014, 5], [2015, 4], [2016, 2], [2018, 5]] }, // VERIFY-NOTES: V50 May 2019
    { id: "somy-phone", co: "Somy", type: "phone", arch: "follower", tier: "flag", stem: "Xperio", n0: 1, from: 2008, to: 9999, m: [[2008, 10], [2010, 3], [2011, 4], [2012, 3], [2013, 2], [2014, 9], [2015, 11], [2016, 9], [2017, 6], [2018, 4], [2019, 5], [2021, 6]] },
    { id: "motolora-phone", co: "Motolora", type: "phone", arch: "budget", tier: "mid", stem: "Moto Gee", n0: 1, from: 2013, to: 9999, m: [[2013, 11], [2014, 2]] },
    // Tablets
    { id: "appel-pad", co: "Appel", type: "tablet", arch: "leader", tier: "flag", stem: "Orchard Pad", n0: 1, from: 2010, to: 9999, m: [[2010, 4], [2011, 3], [2013, 10], [2015, 11], [2016, 3], [2017, 6], [2018, 10], [2020, 3], [2021, 5], [2022, 10], [2024, 5]] },
    { id: "samsong-tab", co: "Samsong", type: "tablet", arch: "follower", tier: "flag", stem: "Stellar Tab S", n0: 1, from: 2014, to: 9999, m: [[2014, 8], [2019, 7], [2020, 8]] }, // VERIFY-NOTES: Tab S6 Jul 2019
    { id: "micronoft-tab", co: "Micronoft", type: "tablet", arch: "follower", tier: "flag", stem: "Surfboard Pro", n0: 1, from: 2013, to: 9999, m: 10, every: 1 },
    { id: "amazone-tab", co: "Amazone", type: "tablet", arch: "budget", tier: "budget", stem: "Blaze HD", n0: 1, from: 2011, to: 9999, m: [[2011, 11], [2012, 9]] },
    { id: "lemovo-tab", co: "Lemovo", type: "tablet", arch: "budget", tier: "budget", stem: "Lemovo Tab M", n0: 7, from: 2013, to: 9999, m: 5 },
    // Laptops
    { id: "appel-book", co: "Appel", type: "laptop", arch: "leader", tier: "flag", stem: "OrchardBook Pro", n0: 1, from: 2008, to: 9999, m: [[2008, 10], [2012, 6], [2016, 10], [2020, 11]] },
    { id: "rell-xpz", co: "Rell", type: "laptop", arch: "follower", tier: "flag", stem: "XPZ", n0: 13, from: 2012, to: 9999, m: [[2012, 5], [2013, 1], [2021, 7], [2022, 1]] }, // VERIFY-NOTES: no CES XPS in 2021 (mid-2021)
    { id: "hpp-laptop", co: "HPP", type: "laptop", arch: "follower", tier: "flag", stem: "Spektra", n0: 1, from: 2008, to: 9999, m: 3 }, // rivrev: HP is a top-2 PC maker with a current premium line, not fading
    { id: "lemovo-laptop", co: "Lemovo", type: "laptop", arch: "follower", tier: "flag", stem: "ThinkBook X", n0: 1, from: 2012, to: 9999, m: [[2012, 8], [2013, 1]] },
    { id: "asuz-laptop", co: "Asuz", type: "laptop", arch: "follower", tier: "mid", stem: "Zenpad", n0: 1, from: 2011, to: 9999, m: 9 }, // VERIFY-NOTES: Asus matched Apple's price, no steady undercut
    // Watches
    { id: "appel-watch", co: "Appel", type: "watch", arch: "leader", tier: "flag", stem: "Orchard Watch", n0: 1, from: 2015, to: 9999, m: [[2015, 4], [2016, 9]] },
    { id: "samsong-watch", co: "Samsong", type: "watch", arch: "follower", tier: "flag", stem: "Stellar Watch", n0: 1, from: 2015, to: 9999, m: [[2015, 10], [2016, 11], [2018, 8]] },
    { id: "fitbyte-watch", co: "Fitbyte", type: "watch", arch: "follower", tier: "mid", stem: "Fitbyte Verso", n0: 1, from: 2016, to: 9999, every: 2, years: [2016, 2017, 2018, 2019, 2020, 2022], m: [[2016, 1], [2017, 9], [2018, 4], [2019, 9], [2020, 8]] },
    { id: "pebbel-watch", co: "Pebbel", type: "watch", arch: "newcomer", tier: "mid", stem: "Pebbel Time", n0: 1, from: 2015, to: 2016, m: [[2015, 2], [2016, 9]] },
    { id: "huavei-watch", co: "Huavei", type: "watch", arch: "budget", tier: "mid", stem: "Summit Watch GT", n0: 1, from: 2018, to: 9999, m: 10 },
    { id: "xiaome-band", co: "Xiaome", type: "watch", arch: "budget", tier: "budget", stem: "Mo Band", n0: 1, from: 2015, to: 9999, m: 6 },
    // Headphones
    { id: "appel-pods", co: "Appel", type: "headphones", arch: "leader", tier: "flag", stem: "OrchardPods Pro", n0: 1, from: 2019, to: 9999, every: 3, years: [2019, 2022, 2025], m: 9 },
    { id: "somy-wh", co: "Somy", type: "headphones", arch: "leader", tier: "flag", stem: "WX-1000M", n0: 1, from: 2016, to: 9999, every: 2, years: [2016, 2017, 2018, 2020, 2022, 2025], m: [[2016, 10], [2017, 9], [2018, 8], [2022, 5]] }, // VERIFY-NOTES: MDR-1000X Oct 2016; n0 1 so 2020 = 4 (XM4)
    { id: "samsong-buds", co: "Samsong", type: "headphones", arch: "follower", tier: "mid", stem: "Stellar Buds", n0: 1, from: 2019, to: 9999, m: [[2019, 3], [2020, 8]] },
    { id: "tehnics-hp", co: "Tehnics", type: "headphones", arch: "newcomer", tier: "flag", stem: "Tehnics AZ", n0: 60, from: 2020, to: 9999, every: 2, m: 10 },
    // TVs
    { id: "samsong-tv", co: "Samsong", type: "tv", arch: "leader", tier: "flag", stem: "Q-Vision", n0: 8, from: 2008, to: 9999, m: 3 },
    { id: "elg-tv", co: "ELG", type: "tv", arch: "leader", tier: "flag", stem: "ELG OLEDO", n0: 1, from: 2013, to: 9999, m: 4 },
    { id: "somy-tv", co: "Somy", type: "tv", arch: "follower", tier: "flag", stem: "Bravura", n0: 1, from: 2008, to: 9999, m: [[2008, 4], [2026, 6]] }, // VERIFY-NOTES: Bravia 9 II Jun 2026
    { id: "tsl-tv", co: "TSL", type: "tv", arch: "budget", tier: "budget", stem: "TSL Q", n0: 6, from: 2018, to: 9999, m: [[2018, 4], [2020, 8], [2023, 5]] },
    { id: "hisence-tv", co: "Hisence", type: "tv", arch: "budget", tier: "flag", stem: "Hisence U8", n0: 7, from: 2021, to: 9999, m: 5 }, // VERIFY-NOTES: U8 $1,099-1,399, its top line
    { id: "panasoomic-tv", co: "Panasoomic", type: "tv", arch: "fading", fade: 2012, tier: "flag", stem: "Vierro", n0: 1, from: 2008, to: 2016, m: 4 },
    // Scooters
    { id: "xiaome-scooter", co: "Xiaome", type: "scooter", arch: "leader", tier: "mid", stem: "Mo Scooter", n0: 1, from: 2016, to: 9999, every: 3, years: [2016, 2019, 2022, 2025], m: [[2016, 12], [2019, 4], [2022, 7], [2025, 3]] }, // VERIFY-NOTES: 5 Max Mar 2025
    { id: "segwey-scooter", co: "Segwey", type: "scooter", arch: "follower", tier: "flag", stem: "Segwey Max G", n0: 30, from: 2019, to: 9999, every: 2, years: [2019, 2022, 2023, 2025], m: [[2019, 8], [2022, 1], [2023, 5]] },
    { id: "gotraks-scooter", co: "Gotraks", type: "scooter", arch: "budget", tier: "budget", stem: "Gotraks XR", n0: 1, from: 2017, to: 9999, m: 5 },
    { id: "kugu-scooter", co: "Kugu", type: "scooter", arch: "newcomer", tier: "mid", stem: "Kugu G", n0: 1, from: 2016, to: 9999, every: 2, m: 7 },
    // Keyboards
    { id: "aliemware-kb", co: "Aliemware", type: "keyboard", arch: "follower", tier: "flag", stem: "Aliemware Pro", n0: 1, from: 2014, to: 9999, every: 2, m: 9 }, // VERIFY-NOTES: flagship keyboards every 2-5 years
    { id: "acco-kb", co: "Acco", type: "keyboard", arch: "budget", tier: "mid", stem: "Acco 5075", n0: 1, from: 2016, to: 9999, m: 6 },
    { id: "logitek-kb", co: "Logitek", type: "keyboard", arch: "leader", tier: "flag", stem: "Logitek G9", n0: 10, from: 2014, to: 9999, every: 2, years: [2014, 2017, 2019, 2024, 2025, 2026], m: [[2014, 9], [2017, 8], [2024, 12], [2025, 9], [2026, 4]] }, // VERIFY-NOTES: Pro X TKL Rapid shipped Dec 2024
    // Consoles: generations + mid-generation models
    { id: "somy-console", co: "Somy", type: "console", arch: "leader", tier: "flag", stem: "PlayStage", n0: 4, from: 2013, to: 9999, years: [2013, 2020], every: 7, m: 11 },
    { id: "somy-console-pro", co: "Somy", type: "console", arch: "leader", tier: "mid", stem: "PlayStage Pro", n0: 4, from: 2016, to: 9999, years: [2016, 2024], every: 7, m: 11 },
    { id: "micronoft-console", co: "Micronoft", type: "console", arch: "follower", tier: "flag", stem: "XBoxx", n0: 2, from: 2013, to: 9999, years: [2013, 2017, 2020], every: 7, m: 11 },
    { id: "nintendu-console", co: "Nintendu", type: "console", arch: "budget", tier: "mid", stem: "Swap", n0: 1, from: 2012, to: 9999, years: [2012, 2017, 2021, 2025], every: 4, m: [[2012, 11], [2017, 3], [2021, 10], [2025, 6]], bias: { 0: 48 } }, // VERIFY-NOTES: GPU 4-9 years behind
    // VR
    { id: "okulus-vr", co: "Okulus", type: "vr", arch: "leader", tier: "flag", stem: "Okulus Rise", n0: 1, from: 2016, to: 2020, years: [2016, 2018, 2019, 2020], m: [[2016, 3], [2018, 5], [2019, 5], [2020, 10]] },
    { id: "somy-vr", co: "Somy", type: "vr", arch: "follower", tier: "mid", stem: "PlayStage VR", n0: 1, from: 2016, to: 9999, years: [2016, 2023], every: 6, m: [[2016, 10], [2023, 2]] },
    { id: "hts-vr", co: "HTS", type: "vr", arch: "follower", fade: 2020, tier: "flag", stem: "Vyve", n0: 1, from: 2016, to: 2024, every: 2, m: [[2016, 4], [2024, 9]] }, // VERIFY-NOTES: Focus Vision Sep 2024
    { id: "appel-vr", co: "Appel", type: "vr", arch: "leader", tier: "flag", stem: "Orchard Vision", n0: 1, from: 2024, to: 9999, every: 2, years: [2024, 2025], m: [[2024, 2], [2025, 10]] },
    { id: "samsong-vr", co: "Samsong", type: "vr", arch: "follower", tier: "mid", stem: "Stellar XR", n0: 1, from: 2025, to: 9999, every: 2, m: 10 },
  ],
};

// FNV-1a 32 bit, the same hash family difficulty.js uses for rival variety.
function _dtRivHash(s) {
  let h = 0x811c9dc5;
  s = String(s);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
function _dtRivRand(seed, key) {
  return _dtRivHash(seed + "|" + key) / 4294967296;
}
function _dtRivDay(year, month, d) {
  return (year - 2008) * 365 + _DT_RIV.MONTH_START[month - 1] + d;
}
function _dtRivYear(day) {
  return 2008 + Math.floor((day - 1) / 365);
}
function _dtRivMonth(line, year) {
  if (typeof line.m === "number") return line.m;
  let m = line.m[0][1];
  for (const [y, v] of line.m) if (year >= y) m = v;
  return m;
}
// Does this line launch in `year`?
function _dtRivLaunches(line, year) {
  if (year < line.from || year > line.to) return false;
  const every = line.every || 1;
  if (line.years && line.years.length) {
    const last = line.years[line.years.length - 1];
    if (year <= last) return line.years.includes(year);
    return (year - last) % every === 0;
  }
  return (year - line.from) % every === 0;
}
// Launches of one calendar year, sorted by day: [{id, line, year, day, n}].
function _dtRivYearPlan(year, seed, lines) {
  const out = [];
  for (const line of lines || _DT_RIV.LINES) {
    if (!_dtRivLaunches(line, year)) continue;
    const t = _DT_RIV.TYPES[line.type];
    const day = _dtRivDay(year, _dtRivMonth(line, year), 3 + Math.floor(_dtRivRand(seed, line.id + year) * 23));
    if (day < t.unlock) continue; // the player cannot make this type yet
    let n = line.n0;
    for (let y = line.from; y < year; y++) if (_dtRivLaunches(line, y)) n++;
    out.push({ id: line.id + "@" + year, line, year, day, n });
  }
  return out.sort((a, b) => a.day - b.day || (a.id < b.id ? -1 : 1));
}

// Highest row the game offers on `day`: the game shows rows 0..count-1 where
// count = rows dated <= day; a row is also never used before its own date.
function _dtRivAllowed(days, day) {
  let count = 0;
  for (const d of days) if (d <= day) count++;
  for (let r = count - 1; r >= 0; r--) if (days[r] <= day) return r;
  return -1;
}
// Effective lag in months of a line for spec i in `year`.
function _dtRivLag(line, spec, i, year) {
  const a = _DT_RIV.ARCH[line.arch];
  let lag = a.lag + _DT_RIV.TIER_LAG[line.tier] + (spec.lag || 0) + ((line.bias && line.bias[i]) || 0);
  if (line.fade && year >= line.fade) lag += Math.min(_DT_RIV.FADE_MAX, (year - line.fade + 1) * _DT_RIV.FADE_PER_YEAR);
  return Math.max(0, lag);
}
// Number in a part label: "8 GB" 8, "512 MB" 0.5, "1 TB" 1024 (gb specs),
// "FHD+ (2160×1080)" 2333 x 1000 pixels, "120" 120. NaN if none.
function _dtRivNum(label, gb) {
  const s = String(label);
  const px = s.match(/(\d+)\s*[×x]\s*(\d+)/);
  if (px) return Number(px[1]) * Number(px[2]);
  const n = parseFloat(s.replace(/^[^0-9.]+/, ""));
  if (!gb) return n;
  return /TB/i.test(s) ? n * 1024 : /MB/i.test(s) ? n / 1024 : n;
}
// Real-life ceiling of a spec in `year` (flagship base model, research), by
// straight lines between the listed years. After the last year (2026) it grows
// by the slower of the game's own list growth since then and the spec's research
// rate `post` (per year), so rivals follow the game's unlock pace, slow down like
// real life and never run out or race ahead.
function _dtRivCap(spec, year, tab) {
  const c = spec.cap;
  if (!c) return null;
  if (year <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    if (year <= c[i][0]) return c[i - 1][1] + ((c[i][1] - c[i - 1][1]) * (year - c[i - 1][0])) / (c[i][0] - c[i - 1][0]);
  }
  const [y0, v0] = c[c.length - 1];
  const at = (y) => _dtRivNum(tab.labels[Math.max(0, _dtRivAllowed(tab.days, _dtRivDay(y, 7, 1)))], spec.gb);
  const a = at(y0);
  const b = at(year);
  const game = a > 0 && b > 0 ? b / a : 1;
  if (spec.post == null) return v0 * Math.pow(game, _DT_RIV.POST_EXP);
  // research rate per year (research/rivals/future.md section 2); the slower of the two
  const real = Math.pow(1 + spec.post, year - y0);
  return v0 * (spec.lower ? Math.max(game, real) : Math.min(game, real));
}
// Highest row at or below r whose value is within the ceiling (own = line's list).
function _dtRivUnderCap(spec, r, year, tab, own) {
  const cap = _dtRivCap(own ? Object.assign({}, spec, { cap: own }) : spec, year, tab);
  if (cap == null) return r;
  const ok = (v) => !(v === v) || (spec.lower ? v >= cap * 0.999 : v <= cap * 1.001);
  while (r > 0 && !ok(_dtRivNum(tab.labels[r], spec.gb))) r--;
  return r;
}
// Spec rows of one launch. tables[name] = {days, labels}: the list's date column
// and names as the game has them on the active preset. prev = rows of this
// line's previous launch (or null). Returns rows (-1 = list not out yet; the UI
// leaves that spec out).
function _dtRivPick(line, day, prev, tables) {
  const t = _DT_RIV.TYPES[line.type];
  const step = _DT_RIV.ARCH[line.arch].step;
  const year = _dtRivYear(day);
  return t.specs.map((spec, i) => {
    const tab = tables[spec.t];
    if (!tab || !tab.days || !tab.days.length) return -1;
    const days = tab.days;
    const lag = _dtRivLag(line, spec, i, year);
    // Never look back before the day the player could make the type (day 1 for
    // phones): lag must not leave a 2008 phone or a first VR set with no specs.
    const back = (m) => Math.max(t.unlock, day - m * _DT_RIV.MONTH_DAYS);
    const top = _dtRivUnderCap(spec, _dtRivAllowed(days, back(lag)), year, tab, line.cap && line.cap[i]);
    const floor = Math.min(top, _dtRivAllowed(days, back(lag + _DT_RIV.CATCH_UP)));
    const now = _dtRivAllowed(days, day);
    const p = prev ? prev[i] : -1;
    if (p == null || p < 0) return Math.min(top, now);
    let r = Math.min(p + step, top);
    if (r < floor) r = floor;
    if (r < p) r = p; // never a downgrade (a fading lag or a ceiling wobble cannot pull a spec back) ...
    return Math.min(r, now); // ... unless the game no longer offers that row today (preset switch)
  });
}
// Launch price in USD, rounded to ...9.
function _dtRivPrice(line, year) {
  const t = _DT_RIV.TYPES[line.type];
  const base = t.price[line.tier === "flag" ? 0 : line.tier === "mid" ? 1 : 2];
  const y = Math.max(2008, Math.min(2060, year));
  const drift = t.drift != null ? t.drift : _DT_RIV.PRICE_DRIFT;
  const v = base * _DT_RIV.ARCH[line.arch].price * Math.pow(1 + drift, y - 2020);
  return Math.max(19, Math.round(v / 10) * 10 - 1);
}
// Best rival row per spec of `type` among launches on or before `day`
// (log = [{type, day, rows}]): what the shops offered then.
function _dtRivMarket(log, type, day) {
  const best = _DT_RIV.TYPES[type].specs.map(() => -1);
  for (const L of log) {
    if (L.type !== type || L.day > day) continue;
    L.rows.forEach((r, i) => { if (r > best[i]) best[i] = r; });
  }
  return best;
}
// How many headline specs of the launch beat everything rivals sold when the
// player's device came out (the player's device now looks dated there).
function _dtRivLead(rows, market) {
  let k = 0;
  let n = 0;
  rows.forEach((r, i) => {
    if (r < 0) return;
    n++;
    if (r > market[i]) k++;
  });
  return { k, n };
}
// Extra POP loss per day this launch puts on one player device (0 = none).
// market = _dtRivMarket at the device's release; rating = its review score
// (1-10): high scores shield like the game's own POP decay (0.6 at 10).
// mul = preset strength (_dtRivMul); 0 on Original. own (optional) = the
// device's own rows on the same headline lists: a spec where the player's part
// is as good as the launch's does not count, so a top device is never "dated".
function _dtRivHit(launch, rows, playerRelease, market, rating, mul, own) {
  if (!(mul > 0) || !(playerRelease < launch.day)) return 0;
  const base = own ? market.map((m, i) => Math.max(m, own[i] == null ? -1 : own[i])) : market;
  const { k, n } = _dtRivLead(rows, base);
  if (!k || !n) return 0;
  const line = launch.line;
  const shield = 1 - 0.6 * Math.max(0, Math.min(1, ((Number(rating) || 5) - 5) / 5));
  return _DT_RIV.FX_BASE * (k / n) * _DT_RIV.TIER_W[line.tier] * _DT_RIV.ARCH[line.arch].w * shield * mul;
}
// Preset strength from the difficulty sliders: Original (all 1) = 0 (feature
// off); otherwise scales with the Competitor strength slider (Realistic 1.1 = 1).
function _dtRivMul(shipped, rivals) {
  if (shipped) return 0;
  const r = Math.max(0.5, Math.min(3, Number(rivals) || 1));
  return Math.pow(r / 1.1, 0.75);
}
// Today's extra POP loss for one device from its active hits [{day, x}],
// with the per-day cap; `used` = extra POP this device has already lost to rivals.
function _dtRivDecay(hits, today, used) {
  let x = 0;
  for (const h of hits) if (today >= h.day && today < h.day + _DT_RIV.FX_DAYS) x += h.x;
  x = Math.min(x, _DT_RIV.FX_CAP_DAY);
  return Math.max(0, Math.min(x, _DT_RIV.FX_CAP_DEVICE - (used || 0)));
}
function _dtRivLabel(spec, label) {
  return spec.f.replace("{}", String(label));
}

globalThis._dtRivCore = {
  RIV: _DT_RIV, hash: _dtRivHash, rand: _dtRivRand, day: _dtRivDay, year: _dtRivYear,
  launches: _dtRivLaunches, yearPlan: _dtRivYearPlan, allowed: _dtRivAllowed, lag: _dtRivLag,
  num: _dtRivNum, cap: _dtRivCap, underCap: _dtRivUnderCap, pick: _dtRivPick, price: _dtRivPrice,
  market: _dtRivMarket, lead: _dtRivLead, hit: _dtRivHit, mul: _dtRivMul,
  decay: _dtRivDecay, label: _dtRivLabel,
};
