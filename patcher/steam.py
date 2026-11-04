"""Find the game's folder in a Steam library on Windows or Linux (Proton)."""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

APP_ID = "2085660"


def steam_roots() -> list[Path]:
    roots = []
    if sys.platform == "win32":
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam") as key:
                roots.append(Path(winreg.QueryValueEx(key, "SteamPath")[0]))
        except OSError:
            pass
        for env in ("ProgramFiles(x86)", "ProgramFiles"):
            if os.environ.get(env):
                roots.append(Path(os.environ[env]) / "Steam")
    else:
        home = Path.home()
        roots += [home / ".steam/steam", home / ".local/share/Steam",
                  home / ".var/app/com.valvesoftware.Steam/.local/share/Steam"]
    return [r for r in dict.fromkeys(roots) if r.is_dir()]


def libraries(root: Path) -> list[Path]:
    libs = [root]
    vdf = root / "steamapps/libraryfolders.vdf"
    if vdf.is_file():
        text = vdf.read_text(encoding="utf-8", errors="replace")
        libs += [Path(p.replace("\\\\", "\\")) for p in re.findall(r'"path"\s+"([^"]+)"', text)]
    return list(dict.fromkeys(libs))


def find_game() -> Path | None:
    for root in steam_roots():
        for lib in libraries(root):
            manifest = lib / "steamapps" / f"appmanifest_{APP_ID}.acf"
            if not manifest.is_file():
                continue
            m = re.search(r'"installdir"\s+"([^"]+)"', manifest.read_text(encoding="utf-8", errors="replace"))
            if m and (lib / "steamapps/common" / m.group(1) / "www/assets.dat").is_file():
                return lib / "steamapps/common" / m.group(1)
    return None
