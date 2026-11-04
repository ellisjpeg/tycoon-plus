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


patch = load('compare_patch', HERE / 'prepare.py')


class CompareTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text()
        cls.data = DATA.read_text()

    def test_appends_once_with_ui(self):
        out = patch.transform(self.source, self.data)
        self.assertTrue(out.startswith(self.source))
        self.assertEqual(out.count('function _dtCmpOpen('), 1)
        self.assertIn('var _dtUi =', out)
        with self.assertRaises(ValueError):
            patch.transform(out, self.data)

    def test_reuses_existing_ui(self):
        # The shared ui.js and the My Devices page look (mdpage.js) come once, whichever mod brings them.
        page = (HERE.parent / 'mods-ui/mdpage.js').read_text()
        base = self.source + '\n;\nvar _dtUi = 1;\n'
        out = patch.transform(base, self.data)
        self.assertEqual(out, base + '\n;\n' + page + '\n;\n' + (HERE / 'compare.js').read_text())
        base = self.source + '\n;\nvar _dtUi = 1;\nvar _dtMdp = 1;\n'
        out = patch.transform(base, self.data)
        self.assertEqual(out, base + '\n;\n' + (HERE / 'compare.js').read_text())

    def test_game_functions_checked(self):
        names = patch.type_names((HERE / 'compare.js').read_text())
        self.assertIn(('ArraySmartphones', 'MySmartphonesShow', 'MyDevices_SmartphoneDraw'), names)
        self.assertIn(('ArrayVRConsoles', 'MyVRShow', ''), names)
        with self.assertRaises(ValueError):
            patch.transform(self.source, self.data.replace('"MyTabletsShow"', '"MyTabletsShow2"'))
        with self.assertRaises(ValueError):
            patch.transform(self.source.replace('a=2===n&&o>2,s=a?o:n', 'a=!1,s=n'), self.data)

    def test_flag_off_is_byte_identical(self):
        # build.py with COMPARE=off must equal the on-build minus the appended block.
        with tempfile.TemporaryDirectory() as d:
            env = dict(os.environ)
            subprocess.run(['python3', str(ROOT / 'build.py'), d + '/on'], check=True, capture_output=True, env=env)
            env['DEVICES_TYCOON_COMPARE'] = 'off'
            subprocess.run(['python3', str(ROOT / 'build.py'), d + '/off'], check=True, capture_output=True, env=env)
            on = Path(d, 'on/scripts/c3main.js').read_text()
            off = Path(d, 'off/scripts/c3main.js').read_text()
            self.assertNotIn('_dtCmpOpen', off)
            # Later patches may follow this block, so cut it out wherever it sits.
            block = '\n;\n' + (HERE / 'compare.js').read_text()
            self.assertEqual(on.count(block), 1)
            # Compare brings the page look (mdpage.js) the Sales board then reuses; with Compare
            # off the board brings it itself, so it sits elsewhere: compare without it.
            page = '\n;\n' + (HERE.parent / 'mods-ui/mdpage.js').read_text()
            self.assertEqual(on.replace(block, '', 1).replace(page, '', 1), off.replace(page, '', 1))
            for f in ('scripts/main.js', 'data.json'):
                if Path(d, 'on', f).exists():
                    self.assertEqual(Path(d, 'on', f).read_bytes(), Path(d, 'off', f).read_bytes())

    def test_syntax_and_runtime(self):
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
            f.write(patch.transform(self.source, self.data))
        subprocess.run(['node', '--check', f.name], check=True)
        os.unlink(f.name)
        subprocess.run(['node', str(HERE / 'test_compare_runtime.js')], check=True)


if __name__ == '__main__':
    unittest.main()
