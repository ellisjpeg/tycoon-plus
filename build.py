#!/usr/bin/env python3
"""Apply the mods to your own copy of the game's code and write the result to a folder.

Usage: python3 build.py OUTDIR

Reads game-files/scripts/c3main.js and game-files/data.json (put there by
`python3 install.py extract`), applies every mod in PATCH_STEPS order and writes
OUTDIR/scripts/c3main.js and OUTDIR/data.json, then runs `node --check` on the
script. This is what install.py puts into the game; use it to test changes
without touching the game. Set DEVICES_TYCOON_<FLAG>=off to leave a mod out.
Mods in OFF_BY_DEFAULT (real brand names) are only added with
DEVICES_TYCOON_<FLAG>=on, for example DEVICES_TYCOON_NAMES=on.
"""
from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GAME_FILES = ROOT / "game-files"
INPUT_C3MAIN = GAME_FILES / "scripts/c3main.js"
INPUT_DATA = GAME_FILES / "data.json"

# Ordered patch steps: (flag, module path relative to the repo, target file,
# entrypoint, options). Entrypoints are called as
#     fn(source)                         normally
#     fn(source, map_json)               with needs_template_map
# Later mods hook code that earlier ones add, so keep this order.
PATCH_STEPS = [
    ("DEVICES_TYCOON_TEMPLATE", "mods/template-patches/prepare.py", "c3main.js",
     "transform", {"needs_template_map": True}),
    ("DEVICES_TYCOON_SPEED", "mods/speed-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_LAUNCH", "mods/launch-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_DIFFICULTY", "mods/difficulty-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_QUEUE", "mods/queue-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_ROOMS", "mods/rooms-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_PIPELINE", "mods/pipeline-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_NEXT", "mods/next-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_COMPARE", "mods/compare-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_SELL", "mods/sell-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_SKIP", "mods/skip-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_BOARD", "mods/board-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_NEWS", "mods/news-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_RESTOCK", "mods/restock-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_FAIRPRICE", "mods/fairprice-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_YEAR", "mods/year-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_NAMES", "mods/names-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_NAMES", "mods/names-patches/prepare.py", "data.json", "transform_data", {}),
    ("DEVICES_TYCOON_BULKHIRE", "mods/bulk-hire-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_RIVALS", "mods/rivals-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_EDITORPERF", "mods/editor-perf-patches/prepare.py", "c3main.js", "transform", {}),
    ("DEVICES_TYCOON_RESEARCHFILTER", "mods/research-filter-patches/prepare.py", "c3main.js", "transform", {}),
]

# Mods players have to ask for. Real company and brand names stay off until Roastery Games
# agrees to them (the project's publishing rule). Short names, as in mod_name().
OFF_BY_DEFAULT = {"names"}


def mod_name(flag: str) -> str:
    """The short name players use for a flag: DEVICES_TYCOON_EDITORPERF -> editorperf."""
    return flag.removeprefix("DEVICES_TYCOON_").lower()


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def flag_on(flag: str) -> bool:
    return os.environ.get(flag, "off" if mod_name(flag) in OFF_BY_DEFAULT else "on") == "on"


def apply_steps(sources: dict[str, str]) -> dict[str, str]:
    for flag, rel_module, target, entry, options in PATCH_STEPS:
        if not flag_on(flag):
            print(f"skip {flag} ({target})")
            continue
        module = load_module(flag.lower(), ROOT / rel_module)
        fn = getattr(module, entry)
        before = sources[target]
        if options.get("needs_template_map"):
            sources[target] = fn(before, module.build_map(str(INPUT_DATA), str(INPUT_C3MAIN)))
        else:
            sources[target] = fn(before)
        print(f"applied {flag} -> {target}")
    return sources


def read_inputs() -> dict[str, str]:
    for path in (INPUT_C3MAIN, INPUT_DATA):
        if not path.is_file():
            raise SystemExit(f"missing {path}: run `python3 install.py extract` first")
    return {
        "c3main.js": INPUT_C3MAIN.read_text(encoding="utf-8"),
        "data.json": INPUT_DATA.read_bytes().decode("utf-8"),
    }


def node_check(path: Path) -> None:
    subprocess.run(["node", "--check", str(path)], check=True)


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 build.py OUTDIR", file=sys.stderr)
        return 2
    out = Path(sys.argv[1]).resolve()
    (out / "scripts").mkdir(parents=True, exist_ok=True)
    sources = apply_steps(read_inputs())
    # Bytes, not write_text: no newline or code page translation on Windows.
    (out / "scripts/c3main.js").write_bytes(sources["c3main.js"].encode("utf-8"))
    (out / "data.json").write_bytes(sources["data.json"].encode("utf-8"))
    node_check(out / "scripts/c3main.js")
    print(f"built into {out}")
    return 0


if __name__ == "__main__":
    if not sys.flags.utf8_mode:  # the mods are UTF-8 text; never read them with a Windows code page
        raise SystemExit(subprocess.call([sys.executable, "-X", "utf8", *sys.argv]))
    raise SystemExit(main())
