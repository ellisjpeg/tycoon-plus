#!/usr/bin/env python3
"""Install or remove the gameplay mods in your own copy of Devices Tycoon.

    python3 install.py status     [--game-dir DIR]
    python3 install.py install    [--game-dir DIR] [--without MOD[,MOD...]] [--with names]
    python3 install.py uninstall  [--game-dir DIR]
    python3 install.py extract    [--game-dir DIR]   (copy the game's code into game-files/ for build.py and the tests)

Close the game first. The game folder is found through Steam, or pass --game-dir
(the folder that holds "Devices Tycoon.exe" and www/assets.dat).

Every mod is installed except `names` (real company and brand names instead of
the game's made-up ones), which is off unless you ask for it with --with names.

install changes only www/assets.dat: it adds the patched game code at the end
of the file and points the game at it, after saving the part of the file that
changes. uninstall puts that part back and removes what was added, then checks
that the file is exactly the original again. Nothing is downloaded and no game
files leave your computer.
"""
from __future__ import annotations

import argparse
import contextlib
import hashlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import build  # noqa: E402
from patcher import c3ab, steam, versions  # noqa: E402

MOD_VERSION = "1.0.0"
C3MAIN = "scripts/c3main.js"
DATA = "data.json"
EXTRA = ("ArrayCompanyNames.json",)  # only for the tests, never patched
STATE = "assets.dat.mods.json"
HEAD = "assets.dat.mods-head"
# Mods that refuse to build without another one. (pipeline also needs queue and
# rooms, but leaves itself out without them.)
NEEDS = {"queue": {"difficulty"}}


class InstallError(Exception):
    pass


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def game_paths(game_dir: Path | None) -> tuple[Path, Path, Path]:
    game = game_dir or steam.find_game()
    if game is None:
        raise InstallError("Could not find Devices Tycoon in your Steam libraries. Pass --game-dir.")
    bundle = Path(game) / "www/assets.dat"
    if not bundle.is_file():
        raise InstallError(f"{bundle} not found. --game-dir must be the folder with the game's www folder.")
    return bundle, bundle.with_name(STATE), bundle.with_name(HEAD)


def identify(bundle: c3ab.Bundle) -> tuple[str, bytes, bytes]:
    """Name the game version, or refuse a version the mods were not made for."""
    c3main, data = bundle.read(C3MAIN), bundle.read(DATA)
    label = versions.KNOWN.get((sha256(c3main), sha256(data)))
    if label is None:
        raise InstallError(
            "This game version is not one the mods were tested with, so nothing was changed.\n"
            "If the game was just updated, wait for a mod update. Known versions:\n  "
            + "\n  ".join(versions.KNOWN.values()))
    return label, c3main, data


def read_state(state_path: Path, bundle_path: Path) -> dict | None:
    """The install record, if the mods are in the current file. A record left behind by a
    Steam update or file check (the file no longer matches what install wrote) is removed."""
    if not state_path.is_file():
        return None
    state = json.loads(state_path.read_text(encoding="utf-8"))
    b = c3ab.open_bundle(bundle_path)
    if b.file_size == state["patched_size"] and sha256(b.read_head()) == state["patched_head_sha256"]:
        return state
    state_path.unlink()
    state_path.with_name(HEAD).unlink(missing_ok=True)
    print("Steam has replaced the game files since the mods were installed; removed the old install record.")
    return None


def write_game_files(c3main: bytes, data: bytes, extra: dict[str, bytes]) -> None:
    """The original code goes to game-files/, where build.py and the mods read it."""
    (build.GAME_FILES / "scripts").mkdir(parents=True, exist_ok=True)
    (build.GAME_FILES / C3MAIN).write_bytes(c3main)
    (build.GAME_FILES / DATA).write_bytes(data)
    for name, body in extra.items():
        (build.GAME_FILES / name).write_bytes(body)


def patched_files(without: set[str], quiet: bool = True) -> dict[str, bytes]:
    flags = {f for f, *_ in build.PATCH_STEPS}
    unknown = without - {build.mod_name(f) for f in flags}
    if unknown:
        raise InstallError("Unknown mod name: " + ", ".join(sorted(unknown)))
    for mod, needs in NEEDS.items():
        if mod not in without and needs & without:
            raise InstallError(f"The {mod} mod needs {', '.join(sorted(needs))}: leave out both or neither.")
    env = {f: os.environ.get(f) for f in flags}
    for f in flags:
        os.environ[f] = "off" if build.mod_name(f) in without else "on"
    try:
        with contextlib.redirect_stdout(io.StringIO()) if quiet else contextlib.nullcontext():
            sources = build.apply_steps(build.read_inputs())
    except Exception as e:  # a mod's checks failed: the game was not touched
        raise InstallError(f"A mod could not be applied, so nothing was changed: {e}") from e
    finally:
        for f, v in env.items():
            if v is None:
                os.environ.pop(f, None)
            else:
                os.environ[f] = v
    c3main = sources["c3main.js"].encode("utf-8")
    with tempfile.TemporaryDirectory() as d:
        script = Path(d, "c3main.js")
        script.write_bytes(c3main)
        build.node_check(script)
    return {C3MAIN: c3main, DATA: sources["data.json"].encode("utf-8")}


def selection(without_arg: str | None, with_arg: str | None) -> set[str]:
    """The mods to leave out: those named in --without, plus the off-by-default ones
    (real brand names) unless --with names them."""
    def names(arg):
        return {m.strip().lower() for m in (arg or "").split(",") if m.strip()}
    wanted = names(with_arg)
    unknown = wanted - build.OFF_BY_DEFAULT
    if unknown:
        raise InstallError("--with is only for mods that are off by default ("
                           + ", ".join(sorted(build.OFF_BY_DEFAULT)) + "), not: " + ", ".join(sorted(unknown)))
    if wanted & names(without_arg):
        raise InstallError("A mod can't be in both --with and --without: " + ", ".join(sorted(wanted & names(without_arg))))
    return names(without_arg) | (build.OFF_BY_DEFAULT - wanted)


def cmd_status(args) -> None:
    bundle_path, state_path, _ = game_paths(args.game_dir)
    print(f"Game: {bundle_path.parent.parent}")
    state = read_state(state_path, bundle_path)
    if state:
        print(f"Mods {state['mod_version']} installed {state['installed']} on: {state['game_version']}")
        if state["without"]:
            print("Left out: " + ", ".join(state["without"]))
        return
    label, *_ = identify(c3ab.open_bundle(bundle_path))
    print(f"Mods not installed. Game version: {label}")


def cmd_extract(args) -> None:
    bundle_path, state_path, _ = game_paths(args.game_dir)
    if read_state(state_path, bundle_path):
        raise InstallError("The mods are installed; extract needs the original game. Run uninstall first.")
    bundle = c3ab.open_bundle(bundle_path)
    label, c3main, data = identify(bundle)
    write_game_files(c3main, data, {n: bundle.read(n) for n in EXTRA if n in bundle.entries})
    print(f"Copied the game's code ({label}) to {build.GAME_FILES}")


def cmd_install(args) -> None:
    bundle_path, state_path, head_path = game_paths(args.game_dir)
    if read_state(state_path, bundle_path):
        raise InstallError("The mods are already installed. Run uninstall first to change them.")
    bundle = c3ab.open_bundle(bundle_path)
    label, c3main, data = identify(bundle)
    print(f"Game version: {label}")
    without = selection(args.without, args.with_)
    write_game_files(c3main, data, {n: bundle.read(n) for n in EXTRA if n in bundle.entries})
    print("Applying the mods...")
    files = patched_files(without, quiet=not args.verbose)
    need = sum(len(b) for b in files.values()) + bundle.head_size
    if shutil.disk_usage(bundle_path.parent).free < need + (64 << 20):
        raise InstallError(f"Not enough free disk space next to the game (need about {need >> 20} MB).")
    print("Checking the original file...")
    original_sha = c3ab.sha256_file(bundle_path)
    head = bundle.read_head()
    new_head, _ = c3ab.patched_head(bundle, {n: len(b) for n, b in files.items()})
    patched_size = bundle.file_size + sum(len(b) for b in files.values())
    head_path.write_bytes(head)
    state = {
        "mod_version": MOD_VERSION,
        "installed": time.strftime("%Y-%m-%d %H:%M"),
        "game_version": label,
        "without": sorted(without),
        "original_size": bundle.file_size,
        "original_sha256": original_sha,
        "original_head_sha256": sha256(head),
        "patched_size": patched_size,
        "patched_head_sha256": sha256(new_head),
    }
    state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    try:
        c3ab.write_patch(bundle, files)
    except OSError as e:
        if bundle_path.stat().st_size != bundle.file_size or c3ab.open_bundle(bundle_path).read_head() != head:
            restore_or_explain(bundle_path, head, bundle.file_size, original_sha)
        state_path.unlink()
        head_path.unlink()
        raise InstallError(f"Could not write to the game file, so it was left as it was. "
                           f"Is the game still running? ({e})") from e
    patched = c3ab.open_bundle(bundle_path)
    if patched.read(C3MAIN) != files[C3MAIN] or patched.read(DATA) != files[DATA]:
        restore_or_explain(bundle_path, head, bundle.file_size, original_sha)
        state_path.unlink()
        head_path.unlink()
        raise InstallError("The patched file did not read back correctly; the original was restored.")
    if without:
        print("Left out: " + ", ".join(sorted(without)))
    if "names" in without:
        print("The game keeps its own made-up company names. Add --with names to use real ones.")
    print("Installed. Start the game from Steam as usual.")


def restore_or_explain(bundle_path: Path, head: bytes, size: int, original_sha: str) -> None:
    c3ab.restore(bundle_path, head, size)
    if c3ab.sha256_file(bundle_path) != original_sha:
        raise InstallError("Could not restore the game file. In Steam, right-click Devices Tycoon > "
                           "Properties > Installed Files > Verify integrity of game files.")


def cmd_uninstall(args) -> None:
    bundle_path, state_path, head_path = game_paths(args.game_dir)
    state = read_state(state_path, bundle_path)
    if state is None:
        print("The mods are not installed.")
        return
    head = head_path.read_bytes()
    if sha256(head) != state["original_head_sha256"]:
        raise InstallError(f"The backup {head_path} is damaged; nothing was changed. Use Steam's "
                           "'Verify integrity of game files' to get the original back.")
    print("Restoring the original file...")
    try:
        restore_or_explain(bundle_path, head, state["original_size"], state["original_sha256"])
    except PermissionError as e:
        raise InstallError(f"Could not write to the game file. Is the game still running? ({e})") from e
    state_path.unlink()
    head_path.unlink()
    print("Removed. The game file is exactly the original again.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("command", choices=("status", "install", "uninstall", "extract"))
    parser.add_argument("--game-dir", type=Path, help="the game folder (holds www/assets.dat)")
    parser.add_argument("--without", help="mods to leave out, comma separated, e.g. rivals,news")
    parser.add_argument("--with", dest="with_", metavar="names",
                        help="add a mod that is off by default: names (real company and brand names)")
    parser.add_argument("--verbose", action="store_true", help="show each mod as it is applied")
    args = parser.parse_args(argv)
    try:
        {"status": cmd_status, "install": cmd_install, "uninstall": cmd_uninstall,
         "extract": cmd_extract}[args.command](args)
    except (InstallError, c3ab.BundleError) as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    if not sys.flags.utf8_mode:  # the mods are UTF-8 text; never read them with a Windows code page
        raise SystemExit(subprocess.call([sys.executable, "-X", "utf8", *sys.argv]))
    raise SystemExit(main())
