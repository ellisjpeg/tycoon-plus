# Next patch (`DEVICES_TYCOON_NEXT`, default on)

Under a design page list selector whose right arrow is stopped, one small line says what comes next:
`Next: 90 Hz, May 2019` (next part not out yet) or `Next: 90 Hz, needs research` (out, but the
selector's research tier stops the arrow). Nothing at the end of a list or while the arrow works.

- `gen_next.js` (build time) starts from the template map (`template-patches/gen_map.js`, which now also
  exports `load`) and reads from the event sheets, per category: the label formula
  (`SetVar(<X>_Text, [pre +] <src>.At(<id>, col) [+ suf])`), the Text UID showing it, the count loop that
  fills `<Temp>` (`CompareXY(i, date, <=, DayTotal)`), the arrow UIDs and the right arrow's research slot.
  A selector missing any of these gets no hint. Tile pickers (screen resolution/technology, camera MPX)
  and CPU/GPU year windows have no arrows and are not covered.
- `next.js` (run time) reads the live arrays (so the real-life dates on non-Original presets are used), works
  out the next row the game's way (row `count` appears on the earliest future date), and draws the line
  in the mods layer, centred between the arrows, just under the selector's panel (the panel, found
  as the smallest non-Text/SVG box behind the arrows, not the value Text's taller box; Texts count by their
  visible line, top + textHeight, so headings whose box reaches down do not block it). It follows scroll and resize every frame, hides off
  screen, during game pop-ups and our panels, is removed on a layout change, and is skipped when it
  would touch another Text/SVG of the page.
- Covered: phone 19 selectors, tablet 18, laptop 10, watch 14, headphones 11, TV 22, scooter 11, keyboard 5,
  console 12, VR 13, gamepad 6. TV/scooter/keyboard/console/VR/gamepad lists keep the source row in
  Temp column 0 (`col`) and set the label straight on the Text (same or parent event's PickByUID), including
  "series -> yours" chip labels and names looked up in ArrayLanguage (`lang`). A label must sit within one arrow
  height of its right arrow (drops pop-up tiles that read the same list). Gamepad selectors come from its own
  `ID = Temp.At(sel - 1, 0)` lines. Not covered: CPU/GPU editors (each list is filled from one of four device
  tables in CPU/GPU EDITOR MENU, and the labels read only the phone table, so no exact mapping), OS editors
  (no date-locked lists), Wi-Fi and other labels with markup or computed units.
- Tests: `python3 mods/next-patches/test_next.py` (map facts, append/reuse/fail-loudly, syntax,
  `test_next_runtime.js`: month text, next-row pick, label, live placement/scroll/no-room/page change).
