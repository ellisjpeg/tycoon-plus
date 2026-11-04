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


patch = load('sell_patch', HERE / 'prepare.py')


class SellTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text()
        cls.data = DATA.read_text()

    def test_appends_once_with_ui(self):
        out = patch.transform(self.source, self.data)
        self.assertTrue(out.startswith(self.source))
        self.assertEqual(out.count('function _dtSellPriceOpen('), 1)
        self.assertIn('var _dtUi =', out)
        with self.assertRaises(ValueError):
            patch.transform(out, self.data)

    def test_reuses_existing_ui(self):
        base = self.source + '\n;\nvar _dtUi = 1;\n'
        out = patch.transform(base, self.data)
        self.assertEqual(out, base + '\n;\n' + (HERE / 'sell.js').read_text())

    def test_game_functions_checked(self):
        names = patch.type_names((HERE / 'sell.js').read_text())
        self.assertIn(('ArraySmartphones', 'MySmartphonesShow', 'MyDevices_SmartphoneDraw'), names)
        self.assertNotIn('ArrayGamepads', [n[0] for n in names])  # bundled, never sold alone
        with self.assertRaises(ValueError):
            patch.transform(self.source, self.data.replace('"MyTabletsShow"', '"MyTabletsShow2"'))
        # The price is re-read daily, POP 0 is skipped and the tick is called by name.
        for old in ('M=g.getAt(b,x,Z13.SELL)', '*_priceFactor(t,n,e,l)/(i>1?i:1)',
                    'if(T<=0){T<0&&g.setAt(0,b,x,Z13.POP)', '!w&&Y>0&&V-H<=H',
                    'EventGameplay_Event448_Act1(e,t){tickDeviceSales('):
            with self.assertRaises(ValueError, msg=old):
                patch.transform(self.source.replace(old, old[:-2] + '#!'), self.data)

    def test_flag_off_is_byte_identical(self):
        # build.py with SELL=off must equal the on-build minus the appended block.
        with tempfile.TemporaryDirectory() as d:
            env = dict(os.environ)
            subprocess.run(['python3', str(ROOT / 'build.py'), d + '/on'], check=True, capture_output=True, env=env)
            env['DEVICES_TYCOON_SELL'] = 'off'
            subprocess.run(['python3', str(ROOT / 'build.py'), d + '/off'], check=True, capture_output=True, env=env)
            on = Path(d, 'on/scripts/c3main.js').read_text()
            off = Path(d, 'off/scripts/c3main.js').read_text()
            self.assertNotIn('_dtSellPriceOpen', off)
            # Later patches may follow this block, so cut it out wherever it sits.
            block = '\n;\n' + (HERE / 'sell.js').read_text()
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
        subprocess.run(['node', str(HERE / 'test_sell_runtime.js')], check=True)


if __name__ == '__main__':
    unittest.main()
