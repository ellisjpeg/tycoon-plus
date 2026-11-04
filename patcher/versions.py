"""Game versions the mods were made and tested for.

The mods hook the game's own code, so they are only installed on a version whose
files match exactly. Add a version here only after every mod's tests pass on it.
"""

KNOWN = {
    # sha256 of the original scripts/c3main.js and data.json inside www/assets.dat.
    # Steam updates the game on its own, so only the current build is listed.
    ("a28de1fa0c3f81707d8c721581ee7c02433e3e3db5b6240d6caefdc13ba6298e",
     "7ccc360d8f61ad92c8cd3ab57594de1b22e1f549aae744223a8524510893a3bb"):
        "Steam build of 20 October 2026, game update 1.6 (Windows depot 2085661, manifest 631461069047824261)",
}
