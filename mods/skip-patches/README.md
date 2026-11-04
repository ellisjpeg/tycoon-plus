# Skip patch (`DEVICES_TYCOON_SKIP`, default on)

Two time savers around a launch.

## Skip slow screens

A "SPACE Skip" key button (top right, the keycap look of the game's "ESC Back") and the Space / Enter keys
end a screen that is only a show:

- **Batch delivery** (263 BATCH DELIVERY, a 6 s bar): the game clock runs 40x until the screen ends, so all of
  its own events and tweens still run in order (REVIEWS queued, back to the boss office), just sooner. The clock
  is put back on `beforeanylayoutend`, before the office's first tick. The calendar does not run on this screen.
- **Review cards** (282 REVIEWS, the HTML overlay, about 11 s per variant): the overlay's timers are stopped and the
  screen is put in the state its last timer leaves it in: cards in, counters at their totals, summary shown and
  folded into the corner, Next enabled (`ReviewNextActive = 1`, gamepad step armed like the game). The scores are
  rolled by the engine at layout start and written on Next, so a skip cannot change them. Not offered during the
  0.6 s change between variants or while a mod panel is open.
- **Device presentation** (PRESENTATION <TYPE> V2, also each device in a launch event's show): the spec lines
  auto-play and a click on the stage only goes on from the last slide (`$MiniPage = 999`). The game's own
  "ESC Skip" (bottom left, mouse only) still leaves the device's show at once; ours is labelled "SPACE Show all"
  and shows that last slide (the tiles grid) through the player's own `_showStep`, then the click goes on as
  usual. The results are worked out on PRESENTATION FINISH and do not depend on the show.

Nothing that asks for a choice is skipped: Space / Enter do nothing once the screen is waiting for the player
(the Launch Day panel, the presentation's last slide). The one exception is the end of the reviews, where the
game only waits for a tap or Esc and showed no hint: the button turns into "SPACE Continue" and Space / Enter /
a click send the game that Esc, once, and not in the first 0.5 s (so a quick double press of Skip stays on the
score).

## Price card forecast

On the price page (277 EDITOR PRICE PAGE), under the slider: "Price score in reviews: 7-8/10 (24% over cost)", live as the slider
moves. Markup is the review engines' own `(SELL * 100 / COST) - 100` with `$DevicePrice` / `$DeviceCostPrice`
(the values Create writes to columns 4 / 3). The bands and phrase ids are read out of the shipped engines at build
time (`bands.py`, all 10 device engines must agree), and the score range is the min-max of those phrases in
`ArrayReviews_DB` at run time. From 35% the price card is always the first review card; below 35% it is one card
in a shuffled pool of about 45 aspects of which 4 are shown (about 1 review in 11 has it), so the line adds
"reviewers rarely mention price". Gamepads (no price check), CPUs and GPUs show no line. With fair price reviews
built in and on for the company (`fairprice-patches`, not Original), the band is picked from the markup minus the
allowance `_dtFairForecast` gives, the same function the review engines call: "(44% over cost, strong specs allow 12% more)" or
"(25% over cost, weak specs allow 10% less)".

## Files and checks

- `prepare.py`: appends `skip.js` after the compare patch, fills in the band table, and fails the build if the
  review overlay, the presentation player or the bands change shape. Flag off: c3main.js is byte-identical to the
  build without this step.
- Tests: `python3 mods/skip-patches/test_skip.py` (bands from the game, edge cases, fail loudly, flag-off identity,
  `node --check`) + `test_skip_runtime.js` (band edges, forecast line, delivery clock, review end state, keys,
  presentation skip).
