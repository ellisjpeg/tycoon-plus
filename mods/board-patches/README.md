# Board patch (`DEVICES_TYCOON_BOARD`, default on)

A "B  Board" keycap (same style as "C  Compare", right of it) on every My <Type> screen, or key B, opens a
read-only **Sales board**: one row per device edition on sale right now, every type (phones, laptops, tablets,
headphones, watches, TV, scooters, keyboards, consoles, VR; not gamepads, which only sell bundled). Done,
Escape (never reaching the game's Back) or leaving the screen closes it.

Columns, all read from the arrays `tickDeviceSales` works on (Z13 columns):

- Device: name + "Phone · 2013" (type, release year from the release text).
- Price: SELL. In stock: CREATED − SOLDED. Popularity: POP, rounded (the game page shows the raw value, e.g. 65.88928%).
- Profit so far: the game's own `_slotProfit` (SOLDED × (SELL − COST), never below 0), the office sales figure.
- Sold a day: measured. Whenever `DayTotal` moves on, the SOLDED change of each edition is recorded (several days
  in one jump are divided); the board shows the average of the last 7 game days since the game was loaded
  ("…" until the first day). A new save slot/company, a day going backwards or a jump over 60 days starts again.
- Stock lasts: "Restocking" when the game's restock gate (`_handleBatchSoldOut`: contract or self restock,
  POP ≥ RESTOCK_MIN_POP, price above unit cost + fee) covers it, else "Sold out in N days" (stock ÷ sold a day),
  "Sold out" or "No sales".

Sorted by profit so far, biggest first; tap a header to sort by it (tap again to flip). Devices stopped with Sell
(`ArraySaves` row 154, via `_dtSellApi.keys()`) are listed last, greyed, "Not on sale"; devices whose popularity
ran out on their own are not listed. The list scrolls when it is longer than the panel.

Row tap opens the device's Sales page the way the game's arrows do: `MiniPage=1`, `SubPage=x+1`,
`ColorChoose=1`, `DeviceShowFlagmanID=edition`, then the screen's `My<Type>UI`. For another type it first opens
that screen like the My Devices hub (`class`, `LastClass`, `goToLayout`) and pages once it has drawn (0.9 s).
The device is found again by its key (array, game ID, release day), so a new release shifting rows is fine.
Nothing else is written: no game number changes and nothing is saved.

- `prepare.py` fails the build if the tick stops writing SOLDED or skipping unreleased/POP-0 rows, if
  `_slotProfit` or the restock gate change, if the day loop stops calling `tickDeviceSales`, if the game data
  loses a used name (arrays, `My<Type>UI`, page variables) or the phone screen's arrows stop paging by
  `SubPage`/`DeviceShowFlagmanID`/`MySmartphonesUI`. Flag off: c3main.js is byte-identical.
- Tests: `python3 board-patches/test_board.py` (append once, reuse ui, fails loudly, flag-off identity,
  `node --check`) and `test_board_runtime.js` on the game's REAL sales engine: per-day average equals the SOLDED
  change over real days, multi-day jumps, reset on load/company, stopped rows, restock gate, sorting, row tap
  on the same and another screen, row shift after a release, and that the board never writes a device cell.

**Extra tabs.** Another patch can add a tab with
`globalThis._dtBoardTabs.push({id, label, render})` (label a string or `{en, ru}`). With nothing registered the board
is exactly as before (no tab bar). Otherwise "My devices" + each tab sit as pills under the title; picking a tab hides
the board's own parts and calls `render(pane)` on an empty pane; Done, Escape and leaving the screen still close the
board. The last picked tab is kept for the session. Used by rivals-patches/rivals-ui.js ("Rivals").
Test: `test_board_tabs.js` (run by `test_board.py`).
