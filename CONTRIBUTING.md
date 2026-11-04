# Contributing to Tycoon+

Thanks for helping. Bug reports and ideas are just as welcome as code: [open an issue](../../issues/new/choose).

A few rules keep the project legal and the mods safe to install.

## Never commit game files

No `c3main.js`, `data.json`, `assets.dat`, array files, images, sounds, saves (`*.dt`) or
screenshots that are mostly the game (README screenshots in `docs/images/` that show Tycoon+'s own screens are fine). `game-files/` is ignored by git for that reason. Patches
search for short pieces of the game's code; keep those as short as they can be while still
matching exactly one place.

## Using AI tools

Fine by me, it's how most of Tycoon+ was made. You're still responsible for what you submit: read it, test it in the real game, and never paste in the game's code or decompiled output.

## How a mod is built

Each mod is a folder `mods/<name>-patches/` with:

- `prepare.py`: a `transform(source)` that takes the game's `c3main.js` text (or
  `transform_data(data)` for `data.json`) and returns it patched. It checks every spot it relies
  on and raises an error if one is missing or appears more than once, so a game update stops
  the build instead of breaking a save.
- the `.js` it adds to the game, and `test_*.py` / `test_*_runtime.js` tests.

Shared panels, chips and toasts are in `mods/mods-ui/ui.js`. A new mod gets a
`DEVICES_TYCOON_<NAME>` flag and a line in `PATCH_STEPS` in `build.py`; later mods may hook
code from earlier ones, so order matters. Mods that keep state use their own row of the game's
`ArraySaves` (150 to 157 are taken).

## Before you open a pull request

1. `python3 install.py extract` (once), then `./run-tests.sh`. Every test must pass.
2. With your flag off, the build must be byte-identical to the build without your mod
   (most mods have a `test_flag_off_is_byte_identical` test for this).
3. Every text a player sees needs English and Russian.
4. Say which game version you tested on, and how (in the real game or only in tests).

## Changing an existing mod's comments

The mods' `.js` files are copied into the game as they are, comments included. Any edit, even
to a comment, changes the installed file, so mention it in your pull request.
