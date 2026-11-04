"""Installer and bundle tests on small made-up bundles: no game files needed."""
import contextlib
import hashlib
import io
import json
import os
import struct
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import build  # noqa: E402
import install  # noqa: E402
from patcher import c3ab  # noqa: E402

C3MAIN = b'"use strict";var game=1;\n'
DATA = '{"project":["Пример",1]}'.encode("utf-8")


def make_bundle(files):
    """A bundle laid out like the game's: header, directory, then the blob."""
    entries, blob = b"", b""
    for name, body in files.items():
        n = name.encode("utf-8")
        entries += struct.pack(">QQQQIB", 0, len(blob), len(body), len(body), 0, len(n)) + n
        blob += body
    header = b"c3ab" + bytes(4) + struct.pack(">I", 16) + bytes(4)
    header += b"fdir" + bytes(4) + struct.pack(">II", len(entries) + 4, len(files))
    return header + entries + b"blob" + struct.pack(">Q", len(blob)) + blob


def fake_steps(sources):
    sources["c3main.js"] += ";var mod=1;\n"
    sources["data.json"] = sources["data.json"].replace("Пример", "Example")
    return sources


class BundleTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.path = Path(self.dir.name, "assets.dat")
        self.files = {"scripts/main.js": b"main", "scripts/c3main.js": C3MAIN, "data.json": DATA, "a.png": b"\x89PNG" * 50}
        self.path.write_bytes(make_bundle(self.files))

    def tearDown(self):
        self.dir.cleanup()

    def test_read(self):
        b = c3ab.open_bundle(self.path)
        for name, body in self.files.items():
            self.assertEqual(b.read(name), body)

    def test_patch_then_restore_is_exact(self):
        original = self.path.read_bytes()
        b = c3ab.open_bundle(self.path)
        head = b.read_head()
        c3ab.write_patch(b, {"scripts/c3main.js": b"new code", "data.json": b"{}"})
        p = c3ab.open_bundle(self.path)
        self.assertEqual(p.read("scripts/c3main.js"), b"new code")
        self.assertEqual(p.read("data.json"), b"{}")
        self.assertEqual(p.read("a.png"), self.files["a.png"])
        # Only the head changed before the old end of the file.
        now = self.path.read_bytes()
        self.assertEqual(now[len(head):len(original)], original[len(head):])
        c3ab.restore(self.path, head, len(original))
        self.assertEqual(self.path.read_bytes(), original)

    def test_not_a_bundle(self):
        self.path.write_bytes(b"PK\x03\x04" + bytes(64))
        with self.assertRaises(c3ab.BundleError):
            c3ab.open_bundle(self.path)

    def test_cut_short(self):
        self.path.write_bytes(make_bundle(self.files)[:-3])
        with self.assertRaises(c3ab.BundleError):
            c3ab.open_bundle(self.path)


class InstallTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.game = Path(self.dir.name, "Devices Tycoon")
        (self.game / "www").mkdir(parents=True)
        self.bundle = self.game / "www/assets.dat"
        self.bundle.write_bytes(make_bundle({"scripts/c3main.js": C3MAIN, "data.json": DATA, "x.txt": b"x" * 99}))
        self.original = self.bundle.read_bytes()
        known = {(hashlib.sha256(C3MAIN).hexdigest(), hashlib.sha256(DATA).hexdigest()): "test version"}
        files = Path(self.dir.name, "game-files")
        for p in (mock.patch.object(install.versions, "KNOWN", known),
                  mock.patch.object(build, "apply_steps", fake_steps),
                  mock.patch.object(build, "node_check", lambda path: None),
                  mock.patch.object(build, "GAME_FILES", files),
                  mock.patch.object(build, "INPUT_C3MAIN", files / "scripts/c3main.js"),
                  mock.patch.object(build, "INPUT_DATA", files / "data.json")):
            p.start()
            self.addCleanup(p.stop)

    def tearDown(self):
        self.dir.cleanup()

    def run_cli(self, *args):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = install.main([*args, "--game-dir", str(self.game)])
        return code, out.getvalue() + err.getvalue()

    def test_install_uninstall_round_trip(self):
        self.assertEqual(self.run_cli("install")[0], 0)
        b = c3ab.open_bundle(self.bundle)
        self.assertEqual(b.read("scripts/c3main.js"), C3MAIN + b";var mod=1;\n")
        self.assertEqual(b.read("data.json"), b'{"project":["Example",1]}')
        self.assertEqual(b.read("x.txt"), b"x" * 99)
        code, out = self.run_cli("status")
        self.assertIn("installed", out)
        self.assertEqual(self.run_cli("uninstall")[0], 0)
        self.assertEqual(self.bundle.read_bytes(), self.original)
        self.assertEqual(sorted(p.name for p in self.bundle.parent.iterdir()), ["assets.dat"])

    def test_refuses_unknown_version(self):
        self.bundle.write_bytes(make_bundle({"scripts/c3main.js": b"other", "data.json": DATA}))
        before = self.bundle.read_bytes()
        code, out = self.run_cli("install")
        self.assertEqual(code, 1)
        self.assertIn("not one the mods were tested with", out)
        self.assertEqual(self.bundle.read_bytes(), before)

    def test_refuses_second_install(self):
        self.run_cli("install")
        patched = self.bundle.read_bytes()
        code, out = self.run_cli("install")
        self.assertEqual(code, 1)
        self.assertIn("already installed", out)
        self.assertEqual(self.bundle.read_bytes(), patched)

    def test_steam_replaced_the_file(self):
        self.run_cli("install")
        self.bundle.write_bytes(self.original)  # what a Steam update or file check does
        code, out = self.run_cli("uninstall")
        self.assertEqual(code, 0)
        self.assertIn("not installed", out)
        self.assertEqual(self.bundle.read_bytes(), self.original)
        self.assertFalse(self.bundle.with_name(install.STATE).exists())

    def test_failed_mod_changes_nothing(self):
        def broken(sources):
            raise ValueError("Expected exactly one original handler")
        with mock.patch.object(build, "apply_steps", broken):
            code, out = self.run_cli("install")
        self.assertEqual(code, 1)
        self.assertIn("nothing was changed", out)
        self.assertEqual(self.bundle.read_bytes(), self.original)
        self.assertFalse(self.bundle.with_name(install.STATE).exists())

    def test_damaged_backup_is_not_used(self):
        self.run_cli("install")
        patched = self.bundle.read_bytes()
        self.bundle.with_name(install.HEAD).write_bytes(b"junk")
        code, out = self.run_cli("uninstall")
        self.assertEqual(code, 1)
        self.assertIn("damaged", out)
        self.assertEqual(self.bundle.read_bytes(), patched)

    def test_unknown_mod_name(self):
        code, out = self.run_cli("install", "--without", "nope")
        self.assertEqual(code, 1)
        self.assertIn("Unknown mod name: nope", out)
        self.assertEqual(self.bundle.read_bytes(), self.original)

    def test_needed_mod_left_out(self):
        code, out = self.run_cli("install", "--without", "difficulty")
        self.assertEqual(code, 1)
        self.assertIn("queue mod needs difficulty", out)
        self.assertEqual(self.run_cli("install", "--without", "difficulty,queue")[0], 0)

    def test_state_record(self):
        self.run_cli("install", "--without", "names,rivals")
        state = json.loads(self.bundle.with_name(install.STATE).read_text(encoding="utf-8"))
        self.assertEqual(state["without"], ["names", "rivals"])
        self.assertEqual(state["original_sha256"], hashlib.sha256(self.original).hexdigest())

    def test_names_off_by_default(self):
        self.run_cli("install")
        state = json.loads(self.bundle.with_name(install.STATE).read_text(encoding="utf-8"))
        self.assertEqual(state["without"], ["names"])

    def test_with_names_opt_in(self):
        self.assertEqual(self.run_cli("install", "--with", "names")[0], 0)
        state = json.loads(self.bundle.with_name(install.STATE).read_text(encoding="utf-8"))
        self.assertEqual(state["without"], [])

    def test_with_is_only_for_opt_in_mods(self):
        code, out = self.run_cli("install", "--with", "rivals")
        self.assertEqual(code, 1)
        self.assertIn("only for mods that are off by default", out)
        code, out = self.run_cli("install", "--with", "names", "--without", "names")
        self.assertEqual(code, 1)
        self.assertEqual(self.bundle.read_bytes(), self.original)

    def test_build_leaves_names_out_unless_asked(self):
        with mock.patch.dict(os.environ):
            os.environ.pop("DEVICES_TYCOON_NAMES", None)
            self.assertFalse(build.flag_on("DEVICES_TYCOON_NAMES"))
            self.assertTrue(build.flag_on("DEVICES_TYCOON_RIVALS"))
            os.environ["DEVICES_TYCOON_NAMES"] = "on"
            self.assertTrue(build.flag_on("DEVICES_TYCOON_NAMES"))

class ChainTests(unittest.TestCase):
    def test_every_step_exists(self):
        for flag, rel, target, entry, _ in build.PATCH_STEPS:
            self.assertTrue((ROOT / rel).is_file(), rel)
            self.assertIn(target, ("c3main.js", "data.json"))
            self.assertIn(f"def {entry}(", (ROOT / rel).read_text(encoding="utf-8"), rel)

    def test_mod_names(self):
        self.assertEqual(build.mod_name("DEVICES_TYCOON_EDITORPERF"), "editorperf")


if __name__ == "__main__":
    unittest.main()
