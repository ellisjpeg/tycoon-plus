"""Game versions the mods were made and tested for.

The mods hook the game's own code, so they are only installed on a version whose
files match exactly. Add a version here only after every mod's tests pass on it.
"""

KNOWN = {
    # sha256 of the original scripts/c3main.js and data.json inside www/assets.dat
    ("feef387c8c0495a494ddeaf266abb03b437c3afd671a14fdaa3ba7a34ed244da",
     "e4cbf8c1a07f196a41e26f51f15455f5c23128a2290f08467a399d18b44d2c8c"):
        "Steam build of 16 October 2026 (Windows depot 2085661, manifest 6821940691056097977)",
}
