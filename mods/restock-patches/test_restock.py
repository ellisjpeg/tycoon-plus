import importlib.util
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
C3MAIN = ROOT / 'game-files/scripts/c3main.js'


def load(name, path):
    s = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


patch = load('restock_patch', HERE / 'prepare.py')
sell = load('restock_sell', HERE.parent / 'sell-patches/prepare.py')
board = load('restock_board', HERE.parent / 'board-patches/prepare.py')


class RestockTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text()

    def test_appends_once_with_ui(self):
        out = patch.transform(self.source)
        self.assertTrue(out.startswith(self.source))
        self.assertEqual(out.count('function _dtRestockWrap('), 1)
        self.assertIn('var _dtUi =', out)
        with self.assertRaises(ValueError):
            patch.transform(out)

    def test_reuses_existing_ui(self):
        base = self.source + '\n;\nvar _dtUi = 1;\n'
        self.assertEqual(patch.transform(base), base + '\n;\n' + (HERE / 'restock.js').read_text())

    def test_game_restock_checked(self):
        # The call by name, its arguments, the POP gate and the settings Careful changes.
        for old in ('_handleBatchSoldOut(n,m,b,x,o,N,T,O,M,a,g,k,U,W,B)', 'if((b||y)&&r>=c.RESTOCK_MIN_POP){',
                    'S=l*c.RESTOCK_BUDGET_PCT-d.restockCost', 'a=Math.ceil(e*c.RESTOCK_TAIL_COVER)',
                    'RESTOCK_SELF_PCT:.12', 'function estimateSalaryNow(e)',
                    'financeRecord?.("production",-Math.round(g.restockCost)'):
            with self.assertRaises(ValueError, msg=old):
                patch.transform(self.source.replace(old, old[:-2] + '#!'))

    def test_mod_hooks_checked(self):
        # With Sell and Board in the build, their wrapped functions must exist.
        both = board.transform(sell.transform(self.source))
        out = patch.transform(both)
        self.assertIn('_dtRestockWrapSell', out)
        for old in ('function _dtSellTick() {', 'function _dtBoardRender() {', 'class="dt-board-type"'):
            with self.assertRaises(ValueError, msg=old):
                patch.transform(both.replace(old, old.replace('_dt', '_dX').replace('type', 'tipe')))
        with self.assertRaises(ValueError):
            patch.transform(self.source + '\nvar _DT_OTHER_ROW = 156;\n')

    def test_flag_off_is_byte_identical(self):
        with tempfile.TemporaryDirectory() as d:
            env = dict(os.environ)
            subprocess.run(['python3', str(ROOT / 'build.py'), d + '/on'], check=True, capture_output=True, env=env)
            env['DEVICES_TYCOON_RESTOCK'] = 'off'
            subprocess.run(['python3', str(ROOT / 'build.py'), d + '/off'], check=True, capture_output=True, env=env)
            on = Path(d, 'on/scripts/c3main.js').read_text()
            off = Path(d, 'off/scripts/c3main.js').read_text()
            self.assertNotIn('_DT_RESTOCK_ROW', off)
            block = '\n;\n' + (HERE / 'restock.js').read_text()
            self.assertEqual(on.count(block), 1)
            self.assertEqual(on.replace(block, '', 1), off)
            for f in ('scripts/main.js', 'data.json'):
                if Path(d, 'on', f).exists():
                    self.assertEqual(Path(d, 'on', f).read_bytes(), Path(d, 'off', f).read_bytes())

    def test_syntax_and_runtime(self):
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
            f.write(patch.transform(board.transform(sell.transform(self.source))))
        subprocess.run(['node', '--check', f.name], check=True)
        os.unlink(f.name)
        subprocess.run(['node', str(HERE / 'test_restock_runtime.js')], check=True)


if __name__ == '__main__':
    unittest.main()
