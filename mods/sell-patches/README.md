# Sell patch (`DEVICES_TYCOON_SELL`, default on)

On the Sales tab of a My <Type> screen (phones, laptops, tablets, headphones, watches, TV, scooters,
keyboards, consoles, VR; not gamepads, which only sell bundled), a device that is on sale gets its
controls inside the game's own sales table (`table.mydev-table`, drawn as HTML by `showMyDevicesTable`;
the rows are added again in the same frame each time the game redraws it, MutationObserver + 250 ms tick):

- **Sell Price** gets the game's small white arrows. An arrow opens **Change price** one step that way;
  a click on the price opens it as is. The pop-up (the game's news-box look, ui.js) has one row per
  edition on sale (the viewed edition first): name, "Cost $277 · markup 26%" (red under cost), chevron
  buttons either side of the price (which can also be typed), and "The new price applies from tomorrow.
  Review scores stay as they were." Confirm writes the edition's SELL cell (column 4) and shows "Price
  cut to $299 for Ember 6" (or "raised"). `tickDeviceSales` reads SELL every day for demand and revenue,
  so it works from the next day. The review score is not touched. Limits: $1 to 5x the cost price (or
  the current price if that is higher); text that is not a number is ignored.
- **On sale ◀ Yes ▶** (a new row): either arrow opens **Stop selling**: "Stop selling Ember 6 for good?
  There will be no more sales or restocking, and the 60 075 in stock stay unsold." with a red "Stop
  selling" and a green "Keep selling". Stop sets POP (column 2) to 0 for every edition of the model, the
  game's own "not selling" state: the daily tick and `_rebuildActive` skip it, so no sales, no
  auto-restock (it needs POP > 0) and it no longer counts in `_cannibalDiv`. A stopped device shows
  "On sale: No" (no arrows) and a grey line "Taken off sale for good".
- Restock (restock-patches) adds its "Restock ◀ Auto ▶" row through `_dtSellRowSpecs` /
  `_dtSellNoteText`.

Stopped devices are saved per company in `ArraySaves` row 154 as
`{"v":1,"company":"Ember","keys":["ArraySmartphones#6@2012",...]}` (array, game ID column 10, release
day). Nothing is written until the first stop, so old saves load as before. Before every daily tick a
wrapper puts any stopped device back to POP 0, so a marketing campaign (which adds POP) cannot revive it.
Both pop-ups pause the calendar; Escape or Cancel closes them without changes.

- `prepare.py` fails the build if the day loop stops calling `tickDeviceSales` by name, or the tick stops
  re-reading SELL, skipping POP 0, or restocking only above POP 0. Flag off: c3main.js is byte-identical.
- Tests: `python3 sell-patches/test_sell.py` (append once, reuse ui, fails loudly, flag-off identity,
  `node --check`) and `test_sell_runtime.js`, which runs the game's REAL sales engine (cut out of
  c3main.js) with this patch: price cut/raise change daily sales, per-edition write, guards, stop = no
  sales/no restock money/less cannibalisation, marketing boost held at 0, save row round trip, other
  company, old saves.
