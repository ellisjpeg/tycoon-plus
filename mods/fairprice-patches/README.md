# Fair price reviews (`DEVICES_TYCOON_FAIRPRICE`, default on)

Reviewers judge the price against what the device offers in its year, not only the margin. 

## Rule (outside the Original preset)

The 10 device review engines (282 REVIEWS) pick the price card from the markup `(SELL * 100 / COST) - 100`:
under 20 -> 9-10, 20-30 -> 7-8, 30-35 -> 5-6 (one phrase in the shuffled aspect pool, so rarely shown),
35-40 -> 3-4 and from 40 -> 1-2 (always the first card). They now compare `markup - allowance`:

- spec level = unit cost / (K x era anchor), the cost model's own unit for the device type and year (`_compute4`:
  `TABLES[type].K`, its anchor table, `_yearOfDay3(DayTotal)`); under a higher "Part and production costs" slider the
  difficulty patch's remembered design-time cost is used, as buyers do;
- allowance = `round(clamp(12 x log2(level / 0.7), -12, +20))` markup points (`_DT_FAIR` at the top of `fairprice.js`).

A mainstream device (level 0.7, e.g. a 2015 mid-range phone at 0.75) is judged exactly as before. A device with twice the
spec level may charge 12 points more for the same card; half, 12 fewer. Bands, phrases, scores and which card is forced
stay the game's own. Gamepads, CPUs and GPUs have no price card and are untouched. Original (all five difficulty sliders
at 1) keeps the game's rule, like real dates and research pacing; without the difficulty patch the rule is on.

## Hooks

- `prepare.py` wraps the one compiled markup expression (E20619, used by all 80 price checks of the 10 engines and
  nowhere else; checked against data.json) in `_dtFairReview(markup, cost, name)`, which returns the game's number when
  the rule is off, and appends `fairprice.js` after the board patch. The editor -> review type map comes from the shipped
  engines (`skip-patches/bands.py`). A changed expression, use count, cost model or save row fails the build.
- The price page forecast (`skip-patches/skip.js`, `_dtSkipForecast`) asks `_dtFairForecast(DeviceType, cost)`, the same
  function, and shows "Price score in reviews: 5-6/10 (44% over cost, strong specs allow 12% more)".
- While the price page is up, the allowance it shows is kept per device in `ArraySaves` row 155
  (`{v, company, d: {"TYPE|name|cost": allowance}}`, last 40). The review uses that number, so a year turning during
  development, a reload or a slider change cannot make the review differ from the forecast. Nothing is written on Original.
  A New Game (layout LOADING GAME, `LoadingType` "NEW GAME") clears the slot's row and the copy in memory
  (`_dtFairTick`), so a new "Ember 1" at the same cost starts fresh; Continue/Load keep it.

## Tests

`python3 mods/fairprice-patches/test_fairprice.py`: expression uses, wrap + append, loud failures, FAIRPRICE=off
byte-identical (it is the last step: off output + wrap + block = on output; both built in memory with
`build.py`'s own `apply_steps`, nothing written to disk), `node --check`, and
`test_fairprice_runtime.js` (real K/anchors from c3main.js: allowance curve, per-type levels, Original, the patched
expression, row 155 round trip and limits, base cost, and forecast = review card at every slider price for 7 devices).
