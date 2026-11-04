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


patch = load('year_patch', HERE / 'prepare.py')


class YearTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text()
        cls.data = DATA.read_text()

    def test_appends_once_with_ui(self):
        out = patch.transform(self.source, self.data)
        self.assertTrue(out.startswith(self.source))
        self.assertEqual(out.count('function _dtYearOpen('), 1)
        self.assertIn('var _dtUi =', out)
        with self.assertRaises(ValueError):
            patch.transform(out, self.data)

    def test_reuses_existing_ui(self):
        base = self.source + '\n;\nvar _dtUi = 1;\n'
        out = patch.transform(base, self.data)
        self.assertEqual(out, base + '\n;\n' + (HERE / 'year.js').read_text())

    def test_game_names_checked(self):
        arrays = patch.type_arrays((HERE / 'year.js').read_text())
        self.assertIn('ArraySmartphones', arrays)
        self.assertNotIn('ArrayGamepads', arrays)  # bundled, never sold alone
        for old in ('"ArrayGameAssistant"', '"ArrayCompanyStats"', '"CreateDevicesUI"'):
            with self.assertRaises(ValueError, msg=old):
                patch.transform(self.source, self.data.replace(old, old[:-1] + '2"'))
        # Day order, monthly history, rank/share and the stats page hooks.
        for old in ('EventGameplay_Event454_Act1(e,t){tickCompanyStatsDay(e)}', 't.fan[o]=_round(e.fan,0)',
                    'e.share=t.total>0?n.earn/t.total*100:0', '_TAB_LIST=[["overview","tabOverview"],',
                    'function _renderBody2(e){if(!_container100)return;', 'EventGameplay_Event453_Act1(e,t){tickRatingsDay('):
            with self.assertRaises(ValueError, msg=old):
                patch.transform(self.source.replace(old, old[:-2] + '#!'), self.data)

    def test_flag_off_is_byte_identical(self):
        # build.py with YEAR=off must equal the on-build minus the appended block.
        with tempfile.TemporaryDirectory() as d:
            env = dict(os.environ)
            subprocess.run(['python3', str(ROOT / 'build.py'), d + '/on'], check=True, capture_output=True, env=env)
            env['DEVICES_TYCOON_YEAR'] = 'off'
            subprocess.run(['python3', str(ROOT / 'build.py'), d + '/off'], check=True, capture_output=True, env=env)
            on = Path(d, 'on/scripts/c3main.js').read_text()
            off = Path(d, 'off/scripts/c3main.js').read_text()
            self.assertNotIn('_dtYearOpen', off)
            # Later patches may follow this block, so cut it out wherever it sits.
            block = '\n;\n' + (HERE / 'year.js').read_text()
            self.assertEqual(on.count(block), 1)
            self.assertEqual(on.replace(block, '', 1), off)
            for f in ('scripts/main.js', 'data.json'):
                if Path(d, 'on', f).exists():
                    self.assertEqual(Path(d, 'on', f).read_bytes(), Path(d, 'off', f).read_bytes())

    def test_syntax_and_runtime(self):
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
            f.write(patch.transform(self.source, self.data))
        subprocess.run(['node', '--check', f.name], check=True)
        os.unlink(f.name)
        subprocess.run(['node', str(HERE / 'test_year_runtime.js')], check=True)


if __name__ == '__main__':
    unittest.main()
