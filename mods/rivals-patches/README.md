# rivals-patches (`DEVICES_TYCOON_RIVALS`, default on, last in the build tuple)

Rival companies launch believable devices on believable dates.

- `rivals-core.js`: roster (`_DT_RIV.LINES`), headline specs per type (`TYPES`), schedule (`yearPlan`), spec
  picker (`pick`), prices, and the bounded POP effect (`market`, `hit`, `decay`, `mul`). Pure, no game access.
  Exposed as `globalThis._dtRivCore`.
- `rivals.js` (engine): once per game day at the start of `tickDeviceSales`, picks every planned launch in
  (last processed day, DayTotal] from the runtime part lists (real.js calendar on non-Original presets), fires
  `onLaunch` for live ones, records hits on older player devices, and after the game's tick takes the capped
  extra POP (0.6 a day, 20 per device). Original = off (no launches, no effect, row untouched). Save: ArraySaves
  row 157 `{v, company, seed, last, fx, log (36 months, frozen rows), hits, used}`; older launches are replayed.
  Old saves without the row: past rebuilt silently, live from the load day. API `globalThis._dtRivApi`.
- `rivals-ui.js` (the Rivals tab, optional): appended after rivals.js when present.
- `prepare.py`: appends core + engine (+ UI); fails if the game's tick, Ratings reader or difficulty's
  `_dtResShipped` are renamed, a part list is missing from data.json, or any other module declares row 157.
- `sim.js`: 2008-2040 balance run on the real part tables (`node mods/rivals-patches/sim.js <folder with the game's array files>`, for maintainers).
- Tests: `test_rivals.py` (core, prepare checks, row 157, flag-off byte-identical, runtime), `test_rivals_core.js`,
  `test_rivals_runtime.js` (fake runtime: plan days, save/reload, old save, presets, day jumps, POP caps).
