#!/usr/bin/env python3
"""Make the player installer's patch file from your own game files, or check one.

    python3 tools/make_patch.py player/mods.dtpatch            make it (and player/mods.dtpatch.sha256)
    python3 tools/make_patch.py --check FILE                   is FILE exactly what this source makes?
    python3 tools/make_patch.py --show FILE DIR                write everything FILE adds to DIR, to read
    python3 tools/make_patch.py --stub player/mods.dtpatch     (empty patch, for CI)

Making and --check need your own game-files/ (python3 install.py extract).

Builds the mods twice from game-files/ (the default selection, which leaves out
`names`, and the default plus `names`) and stores, for each build, how to turn
the original c3main.js and data.json into the modded ones: "copy this range of
the original" or "add these bytes". The player's installer replays that on the
player's own copy of the game, so no game files are in the patch: any run of the
original longer than 47 bytes is always a copy, never added bytes (32-byte blocks
indexed every 16 bytes). The file is b"DTPATCH1\\n", one line of JSON (the
header), then the operations. It is not compressed, so anyone who owns the game
gets the same bytes (and the same SHA-256) from the same source.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import build  # noqa: E402
import install  # noqa: E402
from patcher import versions  # noqa: E402

MAGIC = b"DTPATCH1\n"
BLOCK, STRIDE = 32, 16
SETS = {"default": {"names"}, "names": set()}


def uvarint(n: int) -> bytes:
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        if n:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def read_uvarint(buf: bytes, i: int) -> tuple[int, int]:
    n = shift = 0
    while True:
        b = buf[i]
        i += 1
        n |= (b & 0x7F) << shift
        if not b & 0x80:
            return n, i
        shift += 7


def delta(a: bytes, b: bytes) -> list[tuple]:
    """Operations that turn a into b: ("C", offset, length) copies from a, ("A", bytes) adds."""
    index: dict[bytes, int] = {}
    for j in range(0, len(a) - BLOCK + 1, STRIDE):
        index.setdefault(a[j:j + BLOCK], j)
    ops: list[tuple] = []
    i = lit = 0
    n = len(b)
    while i <= n - BLOCK:
        j = index.get(b[i:i + BLOCK])
        if j is None:
            i += 1
            continue
        back = 0
        while back < i - lit and back < j and a[j - back - 1] == b[i - back - 1]:
            back += 1
        length = BLOCK
        step = 1 << 16
        while step:
            while i + length + step <= n and j + length + step <= len(a) and \
                    a[j + length:j + length + step] == b[i + length:i + length + step]:
                length += step
            step >>= 1
        start = i - back
        if start > lit:
            ops.append(("A", b[lit:start]))
        ops.append(("C", j - back, length + back))
        i = lit = start + length + back
    if lit < n:
        ops.append(("A", b[lit:]))
    return ops


def encode(ops: list[tuple]) -> bytes:
    out = bytearray()
    for op in ops:
        if op[0] == "C":
            out += b"C" + uvarint(op[1]) + uvarint(op[2])
        else:
            out += b"A" + uvarint(len(op[1])) + op[1]
    return bytes(out)


def apply(a: bytes, body: bytes) -> bytes:
    out = bytearray()
    i = 0
    while i < len(body):
        kind = body[i:i + 1]
        if kind == b"C":
            off, i = read_uvarint(body, i + 1)
            ln, i = read_uvarint(body, i)
            out += a[off:off + ln]
        elif kind == b"A":
            ln, i = read_uvarint(body, i + 1)
            out += body[i:i + ln]
            i += ln
        else:
            raise ValueError("bad patch operation")
    return bytes(out)


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def make(originals: dict[str, bytes]) -> bytes:
    """The patch for the game version in originals, from this source."""
    key = (sha(originals[install.C3MAIN]), sha(originals[install.DATA]))
    header = {"mod_version": install.MOD_VERSION, "game_version": versions.KNOWN[key],
              "c3main_sha256": key[0], "data_sha256": key[1], "sets": {}}
    body = bytearray()
    largest_add = 0
    for name, without in SETS.items():
        files = install.patched_files(without)
        entry = {}
        for f, target in files.items():
            ops = delta(originals[f], target)
            enc = encode(ops)
            assert apply(originals[f], enc) == target, f
            largest_add = max([largest_add] + [len(o[1]) for o in ops if o[0] == "A"])
            entry[f] = {"sha256": sha(target), "size": len(target), "at": len(body), "len": len(enc)}
            body += enc
            print(f"{name} {f}: {len(target)} bytes, {sum(1 for o in ops if o[0] == 'C')} copies, "
                  f"{sum(len(o[1]) for o in ops if o[0] == 'A')} added bytes")
        header["sets"][name] = {"without": sorted(without), "files": entry}
    print(f"largest added run {largest_add} bytes")
    return MAGIC + json.dumps(header, separators=(",", ":")).encode() + b"\n" + bytes(body)


def unpack(raw: bytes) -> tuple[dict, bytes]:
    if raw[:2] == b"\x1f\x8b":  # patches before 1.0.0 were gzipped
        raw = gzip.decompress(raw)
    if not raw.startswith(MAGIC):
        raise SystemExit("not a mods patch")
    head, _, body = raw[len(MAGIC):].partition(b"\n")
    return json.loads(head), body


def originals() -> dict[str, bytes]:
    paths = [build.GAME_FILES / install.C3MAIN, build.GAME_FILES / install.DATA]
    if not all(p.is_file() for p in paths):
        raise SystemExit("game-files/ is empty: run python3 install.py extract first")
    got = {install.C3MAIN: paths[0].read_bytes(), install.DATA: paths[1].read_bytes()}
    if (sha(got[install.C3MAIN]), sha(got[install.DATA])) not in versions.KNOWN:
        raise SystemExit("game-files/ is not a known game version (python3 install.py extract)")
    return got


def show(path: Path, out: Path) -> None:
    """Write what the patch adds as text, with each copy from the original marked in [[ ]]."""
    raw = path.read_bytes()
    header, body = unpack(raw)
    have = (build.GAME_FILES / install.C3MAIN).is_file()
    orig = originals() if have else None
    out.mkdir(parents=True, exist_ok=True)
    print(f"{path}: SHA-256 {sha(raw)}\nmods {header['mod_version']} for: {header['game_version']}")
    for name, ps in header["sets"].items():
        print(f"set {name!r} leaves out: {', '.join(ps['without']) or 'nothing'}")
        for f, e in ps["files"].items():
            ops, i, added, copied = body[e["at"]:e["at"] + e["len"]], 0, 0, 0
            text = bytearray()
            while i < len(ops):
                if ops[i:i + 1] == b"C":
                    off, i = read_uvarint(ops, i + 1)
                    ln, i = read_uvarint(ops, i)
                    copied += ln
                    text += f"\n[[copy {ln} bytes of your game's {f} from byte {off}]]\n".encode()
                elif ops[i:i + 1] == b"A":
                    ln, i = read_uvarint(ops, i + 1)
                    text += ops[i:i + ln]
                    added += ln
                    i += ln
                else:
                    raise SystemExit("bad patch operation")
            target = out / f"{name}-{f.replace('/', '-')}.txt"
            target.write_bytes(bytes(text))
            check = ""
            if orig is not None:
                check = (", rebuilds the expected file" if sha(apply(orig[f], ops)) == e["sha256"]
                         else ", DOES NOT rebuild the expected file")
            print(f"  {f}: {added} bytes added, {copied} copied from your game{check} -> {target}")


def main() -> int:
    args = sys.argv[1:]
    if len(args) == 2 and args[0] == "--stub":
        # An empty patch, so the installer compiles and its tests run without game files (CI).
        header = {"mod_version": install.MOD_VERSION, "game_version": "none", "c3main_sha256": "",
                  "data_sha256": "", "sets": {}}
        Path(args[1]).write_bytes(MAGIC + json.dumps(header).encode() + b"\n")
        return 0
    if len(args) == 3 and args[0] == "--show":
        show(Path(args[1]), Path(args[2]))
        return 0
    if len(args) == 2 and args[0] == "--check":
        given = Path(args[1]).read_bytes()
        made = make(originals())
        same = given == made
        print(f"{args[1]}: {sha(given)}\nthis source makes: {sha(made)}")
        print("SAME: it is exactly what this source makes from your game." if same else
              "DIFFERENT: it is not what this source makes from your game.")
        return 0 if same else 1
    if len(args) != 1 or args[0].startswith("-"):
        print(__doc__.split("\n\n")[1].rstrip(), file=sys.stderr)
        return 2
    raw = make(originals())
    out = Path(args[0])
    out.write_bytes(raw)
    Path(f"{out}.sha256").write_text(f"{sha(raw)}  {out.name}\n", encoding="utf-8")
    print(f"wrote {out} ({len(raw)} bytes, SHA-256 {sha(raw)}) and {out.name}.sha256")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
