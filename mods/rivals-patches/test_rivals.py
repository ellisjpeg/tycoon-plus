import importlib.util
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
C3MAIN = ROOT / 'game-files/scripts/c3main.js'
DATA = ROOT / 'game-files/data.json'


def load(name, path):
    s = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


patch = load('rivals_patch', HERE / 'prepare.py')


class RivalsCoreTests(unittest.TestCase):
    def test_core_runtime(self):
        r = subprocess.run(['node', str(HERE / 'test_rivals_core.js')], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_core_has_no_game_hooks(self):
        src = (HERE / 'rivals-core.js').read_text()
        for word in ('runtime', 'setInterval', 'tickDeviceSales', 'globalVars', 'document'):
            self.assertNotIn(word, _code(src), word)
        subprocess.run(['node', '--check', str(HERE / 'rivals-core.js')], check=True)


class RivalsPatchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text()
        cls.data = DATA.read_text()

    def test_appends_once_after_everything(self):
        out = patch.transform(self.source, self.data)
        self.assertTrue(out.startswith(self.source))
        self.assertTrue(out.endswith(patch.block()))
        self.assertEqual(out.count('var _DT_RIV_ROW = 157;'), 1)
        self.assertLess(out.index('globalThis._dtRivCore ='), out.index('var _DT_RIV_ROW'))
        self.assertIn('var _dtUi =', out)
        with self.assertRaises(ValueError):
            patch.transform(out, self.data)

    def test_reuses_existing_ui_and_optional_ui_file(self):
        base = self.source + '\n;\nvar _dtUi = 1;\n'
        out = patch.transform(base, self.data)
        self.assertEqual(out, base + patch.block())
        core = '\n;\n' + (HERE / 'rivals-core.js').read_text() + '\n;\n' + (HERE / 'rivals.js').read_text()
        ui = HERE / 'rivals-ui.js'
        self.assertEqual(patch.block(), core + ('\n;\n' + ui.read_text() if ui.exists() else ''))

    def test_game_and_module_names_checked(self):
        for old in ('function tickDeviceSales(e,t){', 'EventGameplay_Event448_Act1(e,t){tickDeviceSales(',
                    'if(T<=0){T<0&&g.setAt(0,b,x,Z13.POP)', 'function _readCompanies(){', 'function _companyName(e){'):
            with self.assertRaises(ValueError, msg=old):
                patch.transform(self.source.replace(old, old[:-2] + '#!'), self.data)
        diff = self.source + '\n;\nvar _DT_DIFF_KEYS = [];\nfunction _dtResShipped() {}\n'
        patch.transform(diff, self.data)
        with self.assertRaises(ValueError):
            patch.transform(diff.replace('_dtResShipped', '_dtResOriginal'), self.data)
        names = patch.table_names((HERE / 'rivals-core.js').read_text())
        self.assertIn('ArrayScreenRefreshRate_Smartphone', names)
        for name in (names[0], 'ArrayVRConsoles', 'ArrayRatingsCompanies'):
            with self.assertRaises(ValueError, msg=name):
                patch.transform(self.source, self.data.replace('"%s"' % name, '"%s2"' % name))

    def test_row_157_is_ours_alone(self):
        for decl in ('var _DT_FAIR_ROW = 157;', 'const ROW = 157', '{ row: 157 }'):
            with self.assertRaises(ValueError, msg=decl):
                patch.transform(self.source + '\n;\n' + decl + '\n', self.data)
        patch.transform(self.source + '\n;\nvar _DT_YEAR_ROW = 158;\nvar _DT_FAIR_ROW = 155;\n', self.data)
        # every other module in this tree uses another row
        mods = {}
        for js in ROOT.glob('mods/*-patches/*.js'):
            if not js.name.startswith('test_'):
                for r in patch.row_owners(js.read_text()):
                    mods.setdefault(r, []).append(js.parent.name)
        self.assertEqual(mods.get(157), ['rivals-patches'])

    def test_flag_off_is_byte_identical(self):
        with tempfile.TemporaryDirectory() as d:
            env = dict(os.environ)
            subprocess.run(['python3', str(ROOT / 'build.py'), d + '/on'], check=True, capture_output=True, env=env)
            env['DEVICES_TYCOON_RIVALS'] = 'off'
            subprocess.run(['python3', str(ROOT / 'build.py'), d + '/off'], check=True, capture_output=True, env=env)
            on = Path(d, 'on/scripts/c3main.js').read_text()
            off = Path(d, 'off/scripts/c3main.js').read_text()
            for word in ('_DT_RIV_ROW', '_DT_RIV =', '_dtRivApi', '_dtRivCore'):
                self.assertFalse(word in off, word)
            self.assertTrue(on.endswith(patch.block()))
            self.assertTrue(on[: -len(patch.block())] == off, 'off build differs')
            for f in ('scripts/main.js', 'data.json'):
                if Path(d, 'on', f).exists():
                    self.assertEqual(Path(d, 'on', f).read_bytes(), Path(d, 'off', f).read_bytes())

    def test_syntax_and_runtime(self):
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
            f.write(patch.transform(self.source, self.data))
        try:
            subprocess.run(['node', '--check', f.name], check=True)
        finally:
            os.unlink(f.name)
        r = subprocess.run(['node', str(HERE / 'test_rivals_runtime.js')], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)


def _code(src):
    return '\n'.join(l.split('//')[0] for l in src.splitlines())


if __name__ == '__main__':
    unittest.main()
