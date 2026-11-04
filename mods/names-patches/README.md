# Real names patch (`DEVICES_TYCOON_NAMES`, default on)

Real company and brand names instead of the game's parody names ("Nokya" -> "Nokia", "Androyd" -> "Android",
"Qualconn" -> "Qualcomm"). Last step of the build, after NEWS.

- The game shows every company, OS, CPU/GPU and chip maker name through one static table, `ArrayCompanyNames`
  (`ArrayCompanyNames.json`, 477 named rows, loaded at boot; screens look names up by id). One hook at
  the end of the Array plugin's `JSONLoad` calls `_dtNamesLoaded(this)`, which swaps every cell that is exactly a
  parody name (469; 8 are already real). So rankings, pickers, investing, awards and new news read real names.
- Also: 3 English help texts (`ArrayLanguage` rows 567/12061/12066), the 2 presentation sample lines baked into the
  game JS, and the editors' placeholder labels in data.json ("Infel UHD", "Somy", "MediaRek", "AMG").
- `globalThis._dtRealName(name)` for the rivals mod: exact parody name, or a rival model name with parody parts
  ("Orchard 15 Pro" -> "iPhone 15 Pro"); anything else comes back unchanged.
- Never changed: anything in a save (old news lines, the OS label stored in old devices, stock-list names), logo and
  object names (`Qualconn_Logo`, `ArrayProcessors_Qualconn_*`), the player's own company/OS/device names.
- The game's company names screen saves this table (both columns) to `Settings.dt` and loads it back at boot. Two
  hooks in the game's file save/load keep the game's own names in that file (the player's own edits stay) and put the
  real names back after the load, so removing Tycoon+ leaves the plain game's names as they were.
- A game update that moves any hook or text fails the build; a changed name table logs `[names] ... not found`.

Code: `map.json` (built from the game table and a hand-checked list of real names, which lists the
real names in table order), `prepare.py` (`transform` for c3main.js, `transform_data` for data.json),
`names.js` (load hook + `_dtRealName`), `test_names.py` (map, hook, runtime on the real table, player arrays
untouched, save round-trip, flag-off byte identity).
