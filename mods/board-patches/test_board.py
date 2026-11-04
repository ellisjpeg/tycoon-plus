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


patch = load('board_patch', HERE / 'prepare.py')


class BoardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text()
        cls.data = DATA.read_text()

    def test_appends_once_with_ui(self):
        out = patch.transform(self.source, self.data)
        self.assertTrue(out.startswith(self.source))
        self.assertEqual(out.count('function _dtBoardOpen('), 1)
        self.assertIn('var _dtUi =', out)
        with self.assertRaises(ValueError):
            patch.transform(out, self.data)

    def test_reuses_existing_ui(self):
        # The shared ui.js and the My Devices page look (mdpage.js) come once, whichever mod brings them.
        page = (HERE.parent / 'mods-ui/mdpage.js').read_text()
        base = self.source + '\n;\nvar _dtUi = 1;\n'
        out = patch.transform(base, self.data)
        self.assertEqual(out, base + '\n;\n' + page + '\n;\n' + (HERE / 'board.js').read_text())
        base = self.source + '\n;\nvar _dtUi = 1;\nvar _dtMdp = 1;\n'
        out = patch.transform(base, self.data)
        self.assertEqual(out, base + '\n;\n' + (HERE / 'board.js').read_text())

    def test_game_names_checked(self):
        names = patch.type_names((HERE / 'board.js').read_text())
        self.assertIn(('MY SMARTPHONES', 'ArraySmartphones', 'MySmartphonesUI'), names)
        self.assertNotIn('ArrayGamepads', [n[1] for n in names])  # bundled, never sold alone
        for old in ('"MyLaptopsUI"', '"ArrayBatchCompany"', '"DeviceShowFlagmanID"'):
            with self.assertRaises(ValueError, msg=old):
                patch.transform(self.source, self.data.replace(old, old[:-1] + '2"'))
        # SOLDED written by the tick, the profit figure, the restock gate and the day call.
        for old in ('m.setAt(A+l,b,x,Z13.SOLDED)', 'function _slotProfit(e){', 'if((b||y)&&r>=c.RESTOCK_MIN_POP)',
                    'y=!b&&c.RESTOCK_SELF', 'EventGameplay_Event449_Act1(e,t){tickDeviceSales('):
            with self.assertRaises(ValueError, msg=old):
                patch.transform(self.source.replace(old, old[:-2] + '#!'), self.data)

    def test_paging_checked(self):
        dump = ROOT / 'game-files/dump'
        if not (dump / '084 MY SMARTPHONES.txt').is_file():
            self.skipTest('event sheet dump not in this checkout')
        patch.check_paging(dump)
        with tempfile.TemporaryDirectory() as d:
            text = (dump / '084 MY SMARTPHONES.txt').read_text().replace('CALL MySmartphonesUI(', 'CALL MySmartphonesUX(')
            Path(d, '084 MY SMARTPHONES.txt').write_text(text)
            with self.assertRaises(ValueError):
                patch.check_paging(d)

    def test_flag_off_is_byte_identical(self):
        # build.py with BOARD=off must equal the on-build minus the appended block.
        with tempfile.TemporaryDirectory() as d:
            env = dict(os.environ)
            subprocess.run(['python3', str(ROOT / 'build.py'), d + '/on'], check=True, capture_output=True, env=env)
            env['DEVICES_TYCOON_BOARD'] = 'off'
            subprocess.run(['python3', str(ROOT / 'build.py'), d + '/off'], check=True, capture_output=True, env=env)
            on = Path(d, 'on/scripts/c3main.js').read_text()
            off = Path(d, 'off/scripts/c3main.js').read_text()
            self.assertNotIn('_dtBoardOpen', off)
            # Later patches may follow this block, so cut it out wherever it sits.
            block = '\n;\n' + (HERE / 'board.js').read_text()
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
        subprocess.run(['node', str(HERE / 'test_board_runtime.js')], check=True)

    def test_tab_registry(self):
        # globalThis._dtBoardTabs: no tab registered = the board exactly as before.
        js = (HERE / 'board.js').read_text()
        self.assertEqual(js.count('_dtBoardTabsInit(body, ['), 1)
        subprocess.run(['node', str(HERE / 'test_board_tabs.js')], check=True)


if __name__ == '__main__':
    unittest.main()
