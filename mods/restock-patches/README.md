# Restock patch (`DEVICES_TYCOON_RESTOCK`, default on)

The game restocks a device by itself when a batch sells out (`_handleBatchSoldOut`, the `RESTOCK_*`
settings in `_cfg7`), and says nothing when it does (self restock; contract restocks already show a
message). This patch gives each device a restock rule and shows the restocks:

- **Auto** (default): the game's own restock, unchanged. Up to 35% of cash a day; below zero cash it
  restocks on credit.
- **Careful**: every order half the size of Auto's (6% of the first batch instead of 12%, 12.5% under
  contract instead of 25%, at least 1.5 days of sales instead of 3, 2.5 days instead of 5 once demand is
  used up); at most 15% of cash a day; never on credit; and never below a cash line of two months of
  wages (`estimateSalaryNow`; wages are the only regular bill, offices have no rent), at least $1M.
  Done by passing the game a copy of its own settings with those values (the money cap through
  `RESTOCK_BUDGET_PCT`), so the game's own formula still works out the order.
- **Off**: no restock. The game is told the device's popularity is under `RESTOCK_MIN_POP`, so it skips
  the order but still sends its own "batch sold out" message. The device sells out and stays sold out;
  it stays in the shop (unlike Stop selling).

The rule is picked in a "Restock ◀ Auto ▶" row that Sell adds to the game's own sales table on a
device's Sales tab (the arrows step Auto / Careful / Off; a grey line under the table says what the rule
does) and applies to every edition of the model. The Sales board shows it
under each device name ("Auto restock" / "Careful restock" / "No restock"), and an Off device never
reads "Restocking". All self restocks of one game day show as one toast: "Restocked 40k Ember 7
($9.2M)", or "Restocked 3 devices for $15.1M: 283k Ember 6, 197k Ember 6 Pro, 137k Ember 7" (biggest
first, three named). The toast is ui.js's: on the office screens it is a card in the game's own news stack.

Rules are kept per company in `ArraySaves` row 156 as
`{"v":1,"company":"Ember","modes":{"ArraySmartphones#8@2740":"off"}}` (same edition key as Sell and
Board). Only Careful/Off are written, and nothing until the first pick, so old saves load as Auto.
A New Game (layout LOADING GAME, `LoadingType` "NEW GAME") clears the slot's row and the rules in memory,
like Launch and Queue; Continue/Load keep it. The check rides Sell's 250 ms tick (`_dtSellTick` wrap).

Hooks (rebinds, checked by `prepare.py`): `_handleBatchSoldOut` and `tickDeviceSales` (called by name);
when Sell / Board are in the build, `_dtSellTick`, `_dtSellRowSpecs` / `_dtSellNoteText` (the Restock row) and
`_dtBoardRows` / `_dtBoardRender`. Sell and Board files are not changed, so a RESTOCK=off build is
byte-identical to one without this patch. Without Sell there is no Restock row (everything stays Auto); the
toast still works.

- `prepare.py` fails the build if the restock call, its arguments, the POP gate, the settings Careful
  changes, the wage estimate, or the Sell/Board functions it wraps change; or if row 156 gets used.
- Tests: `python3 restock-patches/test_restock.py` (append once, reuse ui, anchors, flag-off identity,
  `node --check` of the Sell+Board+Restock build) and `test_restock_runtime.js`, which runs the game's
  REAL sales engine with Sell, Board and this patch: Auto = same stock and cash as no patch; Careful
  orders about half, 15% day cap, cash line, no credit; Off sells out and stays out with the game's
  message; one grouped toast a day, none for contract restocks; save row round trip, other company, old
  saves; board rows.
