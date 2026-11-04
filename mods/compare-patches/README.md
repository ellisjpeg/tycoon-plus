# Compare patch (`DEVICES_TYCOON_COMPARE`, default on)

A "C  Compare" button (keycap style, next to the game's "ESC  Back") on every My <Type> screen opens two
devices side by side: the device being viewed on the left, the same edition one model older on the right
(else the next/previous one). Each side has its own arrows and a name list (same type first, then the
other types in the My Devices hub order). Done / Escape close it; C opens it.

- Rows are the game's own: `compare.js` sets `$SubPage`, `$DeviceShowFlagmanID` and `$MiniPage`, calls the
  screen's event function (`MySmartphonesShow` ... `MyVRShow`) and reads `ArrayMyDevices_Temp` exactly as
  `showMyDevicesTable` does, page by page. Every global, every `ArrayEditorDesign_*` array and the temp array are
  snapshotted before and written back after, and the screen underneath is redrawn on close. Other types work from any
  screen (a laptop's rows on the phone screen).
- Sections are the My Devices tabs, named from each tab's first row (Sales, Display, Camera, Performance,
  System, Sound, In the box ...). Rows line up by label; "Additional Features" lines by feature name, with
  the game's tick/cross.
- Better side: green cell + badge ("+1 GB", "+800 mAh", "$56 cheaper", "+25% pixels", "Newer", "Wider" for ranges, "Has it").
  Lower is better for cost price, process size (nm), weight, thickness, latency. Neutral (grey badge, no
  green): sell price, copies created, release date, sizes. Text (OS, CPU name, panel type): both cells
  tinted when they differ. Equal: nothing. "Differences only" hides equal rows.
- Pictures: the game's own preview render. On a screen with a preview canvas the type's
  `MyDevices_<Type>Draw` + `redraw<Type>` run for that device and the pixels are copied as the renderer
  hands them to `loadImagePixelData`. Pictures are kept for the session, so a laptop seen on the laptop
  screen also shows on the phone screen; a type not seen yet shows a line icon.
- `prepare.py` fails the build if the Show/Draw functions, arrays, the table reader or the renderers'
  pixel hand-off change. Flag off: c3main.js is byte-identical to the build without this step.
- Tests: `python3 mods/compare-patches/test_compare.py` (append once, reuse ui, fail loudly, flag-off
  identity, `node --check`) + `test_compare_runtime.js` (difference text/rounding per unit, better side,
  picker order and partner, pages from a fake Show with restore, merge incl. phone vs tablet and itself).
