# Year in review (`DEVICES_TYCOON_YEAR`, default on)

On 1 January (from 2009) a card sums up the year that just ended. `year.js` is appended to `c3main.js` after the
board patch (see `PATCH_STEPS` in `build.py`). Flag off = byte-identical to the build without it.

## What the card shows (and where each number comes from)
| Figure | Source |
|---|---|
| Revenue, profit, devices sold | Sum of the game's own monthly history for that year: `_loadState().m` (`rev`, `prof`, `un`), written once a day by `_pushMonthly` from `tickCompanyStatsDay` (c3main.js, `function tickCompanyStatsDay` / `function _pushMonthly`). Same figures as the stats page "Monthly dynamics". |
| Fans gained | `m.fan` of the last month of the year minus the year before (31 Dec values); a partial first year counts from the recording day's `Fans`. |
| Rank among rivals, market share | The year's revenue (the game's months) against each rival's yearly revenue (`_scanCompanies()` over `ArrayRatingsCompanies`, column 4 in B$), read on 1 January after `tickRatingsDay`. The stats Market tab ranks the player by the last 180 days instead, so a company whose devices sold out in the spring came out last on 1 January. The movement is against the year before when that year was counted the same way (`rm: 2`); years saved before this change keep their old rank and are not compared with. |
| Best / weakest device | Own record: each game day, every released edition's `SOLDED` change (Z13 col 1) x that day's `SELL - COST` (col 4 - col 3), floored at 0 like `_slotProfit`. Sorted by that year's profit. |
| Revenue by device type | Own record: the same daily `SOLDED` change x `SELL`, grouped by device array; change in points vs the year before. |

Changes vs the year before: `+12%` for money, units and fans (none when the year before is missing or partial, or
not above 0; then a signed difference), "Up/Down n" for rank, points for shares.

## Recording
- `tickCompanyStatsDay` is wrapped: once per game day, before the game's stats day (which can autosave), the patch
  reads the day's sales and writes its row, so every save holds a current row.
- Saved per company in `ArraySaves` row 158 (`{v, company, last, cur, years, pending}`; rows 150-154 belong to other
  mods). Another company's row is ignored; loading an older save of the same company drops the years after it.
- An old save starts recording from the day it is loaded; that year's card says "Partial year: recording started
  <date>" (revenue/profit/units are still the game's whole-year figures).

## When the card appears
After 1 January it waits until the office screen has been free for 1 s: office layout, `class` GAMEPLAY, no game
news/awards card (`Assistant`, `ArrayGameAssistant`), `CreateDevicesUI` off, calendar not paused, no mod panel, no
launch-day choice (`_dtLaunchPending`), no launch event due or running (`_dtEventApi`), stats page closed. While open
it pauses the calendar like the game's own cards (`_dtUi.modal({pause:true})`). Continue, Space, Enter or Escape
closes it; the key never reaches the game.

## Past years
A "Years" tab on the game's Company statistics page (added to `_TAB_LIST`, rendered by a wrapped `_renderBody2`):
one row per year (revenue, profit, sold, fans, rank); a tap opens that year's card.

## Tests
`python3 mods/year-patches/test_year.py` (from the repo folder): build checks, flag-off byte-identical, `node --check` of
the whole chain, and `test_year_runtime.js`, which runs year.js on the game's REAL stats code (the
`_container100 ... _container101` block) across several New Years.
