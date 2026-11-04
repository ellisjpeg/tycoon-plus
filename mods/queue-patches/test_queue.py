import importlib.util
import json
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('queue_patch', HERE / 'prepare.py')
patch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patch)
DATA = ROOT / 'game-files/data.json'
C3MAIN = ROOT / 'game-files/scripts/c3main.js'
DAILY = ROOT / 'game-files/dump'


def load(name, path):
    s = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


class QueueTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text()
        cls.template = load('template', ROOT / 'mods/template-patches/prepare.py')
        cls.speed = load('speed', ROOT / 'mods/speed-patches/prepare.py')
        cls.launch = load('launch', ROOT / 'mods/launch-patches/prepare.py')
        cls.difficulty = load('difficulty', ROOT / 'mods/difficulty-patches/prepare.py')
        cls.map_json = cls.template.build_map(str(DATA), str(C3MAIN))
        chain = cls.source
        chain = cls.template.transform(chain, cls.map_json)
        chain = cls.speed.transform(chain)
        chain = cls.launch.transform(chain)
        cls.chain = cls.difficulty.transform(chain)

    def test_source_match_and_reversibility(self):
        candidate = patch.transform(self.chain)
        body = (HERE / 'reads.js').read_text() + (HERE / 'queue.js').read_text()
        app = '\n;\n' + body  # ui.js is already in the chain
        self.assertEqual(candidate, self.chain + app)
        self.assertEqual(candidate.count('setInterval)(_dtqTick, 250);'), 1)
        self.assertTrue(candidate.endswith(app))
        self.assertEqual(candidate.removesuffix(app), self.chain)

    def test_refuses_double_application(self):
        candidate = patch.transform(self.chain)
        with self.assertRaises(ValueError):
            patch.transform(candidate)
        with self.assertRaises(ValueError):
            patch.transform(self.chain + '\n// _dtqTick')

    def test_required_anchors_drift(self):
        cases = {
            'missing batch mark': ('function _markBatchStart(', 'function _markBatchStart2('),
            'missing batch pushed': ('function _batchPushed(', 'function _batchPushed2('),
            'missing devices': ('_DEVICES={SMARTPHONE:', '_DEVICES2={SMARTPHONE:'),
            'missing array lookup': ('function _getArray24(', 'function _getArray25('),
            'missing array size': ('function _arrSize3(', 'function _arrSize4('),
            'missing shared ui': ('var _dtUi =', 'var _dtUi2 ='),
            'missing difficulty row': ('_DT_DIFF_ROW = 150', '_DT_DIFF_ROW = 149'),
            'missing tax row': ('_SAVE_ROW=98', '_SAVE_ROW=99'),
            'missing marketing row': ('MKT_HIST_ROW=102', 'MKT_HIST_ROW=103'),
            'row already used': None,
        }
        for why, change in cases.items():
            with self.subTest(why=why):
                if change is None:
                    invalid = self.chain + '\n// ROW=151'
                else:
                    old, new = change
                    self.assertIn(old, self.chain)
                    invalid = self.chain.replace(old, new)
                with self.assertRaises(ValueError):
                    patch.transform(invalid)
        with self.assertRaises(ValueError):
            patch.transform(self.chain + '\n// ROW = 151')

    def test_row_151_is_free_in_game_code_and_data(self):
        # Game JS: no save-row constant or ArraySaves access near 151.
        self.assertNotIn('ROW=151', self.source)
        self.assertNotIn('ROW = 151', self.source)
        for m in re.finditer(r'ArraySaves', self.source):
            window = self.source[m.start():m.start() + 300]
            self.assertIsNone(re.search(r'\b151\b', window), 'ArraySaves row 151 appeared in c3main.js')
        # Event sheets: no ArraySaves action mentions row 151.
        for path in DAILY.glob('*.txt'):
            for i, line in enumerate(path.read_text(errors='replace').splitlines(), 1):
                if 'ArraySaves' in line and re.search(r'\b151\b', line):
                    self.fail(f'{path.name}:{i} uses ArraySaves row 151: {line.strip()[:120]}')
        # data.json ships ArraySaves as an empty shell (no row data).
        data_text = DATA.read_text()
        self.assertIn('["ArraySaves",0,false,[],', data_text)

    def test_patched_script_parses_after_other_patches(self):
        source = patch.transform(self.chain)
        with tempfile.NamedTemporaryFile('w', suffix='.js') as f:
            f.write(source)
            f.flush()
            subprocess.run(['node', '--check', f.name], check=True)

    def test_flag_off_is_byte_identical(self):
        devbuild = load('devbuild', ROOT / 'build.py')
        base_sources = {
            'c3main.js': devbuild.INPUT_C3MAIN.read_text(),
            'data.json': devbuild.INPUT_DATA.read_bytes().decode(),
        }
        old_steps = devbuild.PATCH_STEPS
        try:
            devbuild.PATCH_STEPS = [s for s in old_steps if s[0] != 'DEVICES_TYCOON_QUEUE']
            without = devbuild.apply_steps(dict(base_sources))
        finally:
            devbuild.PATCH_STEPS = old_steps
        old_flag = __import__('os').environ.get('DEVICES_TYCOON_QUEUE')
        __import__('os').environ['DEVICES_TYCOON_QUEUE'] = 'off'
        try:
            with_off = devbuild.apply_steps(dict(base_sources))
        finally:
            if old_flag is None:
                __import__('os').environ.pop('DEVICES_TYCOON_QUEUE', None)
            else:
                __import__('os').environ['DEVICES_TYCOON_QUEUE'] = old_flag
        for name in without:
            self.assertEqual(with_off[name], without[name], name + ' changed with the queue flag off')

    def test_builds_with_difficulty_off(self):
        # Every mod flag can be off: the queue (and the pipeline on it) must not need Difficulty.
        import os
        devbuild = load('devbuild', ROOT / 'build.py')
        base_sources = {
            'c3main.js': devbuild.INPUT_C3MAIN.read_text(),
            'data.json': devbuild.INPUT_DATA.read_bytes().decode(),
        }
        old_flag = os.environ.get('DEVICES_TYCOON_DIFFICULTY')
        os.environ['DEVICES_TYCOON_DIFFICULTY'] = 'off'
        try:
            out = devbuild.apply_steps(dict(base_sources))
        finally:
            if old_flag is None:
                os.environ.pop('DEVICES_TYCOON_DIFFICULTY', None)
            else:
                os.environ['DEVICES_TYCOON_DIFFICULTY'] = old_flag
        self.assertNotIn('_DT_DIFF_ROW', out['c3main.js'])
        self.assertIn('setInterval)(_dtqTick, 250);', out['c3main.js'])
        self.assertIn('_dtpTick', out['c3main.js'])

    def test_reads_match_event_sheet(self):
        # reads.js must be what gen_reads.py derives from the shipped LOADING EDITOR sheet.
        if not (DAILY / '278 LOADING EDITOR.txt').is_file():
            self.skipTest('event sheet dump not in this checkout')
        gen = load('gen_reads', HERE / 'gen_reads.py')
        before = (HERE / 'reads.js').read_text()
        gen.main(str(DAILY / '278 LOADING EDITOR.txt'))
        self.assertEqual((HERE / 'reads.js').read_text(), before)
        sheet = (DAILY / '278 LOADING EDITOR.txt').read_text()
        for fn in ('SmartphoneAddToArray', 'VRAddToArray', 'SmartphoneAddToArray_Finish'):
            self.assertIn('FUNC ["' + fn + '"', sheet)
        # The AddToArray calls are chosen by DeviceType on layout start; the
        # capture relies on a non-matching DeviceType creating nothing.
        self.assertEqual(sheet.count('CompareVar($DeviceType, [8,0], E8436{"SMARTPHONE"})\n    → CALL SmartphoneAddToArray'), 1)

    def test_page_info_hit_covers_game_info_button(self):
        # The Build queue page runs on the game's INVESTING MENU; its (i) is Sprite422 UID 77,
        # centre 1870,50, 40x40 (measured in the running game). Our click area must sit on it,
        # or the click falls through to the game's own Investing help.
        src = (HERE / 'queue.js').read_text()
        m = re.search(r'dt-pg-hit", root\);\s*Object\.assign\(info\.style, \{ left: "calc\(var\(--dt\) \* (\d+)px\)", '
                      r'top: "calc\(var\(--dt\) \* (\d+)px\)", width: "calc\(var\(--dt\) \* (\d+)px\)", '
                      r'height: "calc\(var\(--dt\) \* (\d+)px\)"', src)
        self.assertIsNotNone(m)
        x, y, w, h = map(int, m.groups())
        self.assertLessEqual(x, 1850)
        self.assertGreaterEqual(x + w, 1890)
        self.assertLessEqual(y, 30)
        self.assertGreaterEqual(y + h, 70)

    def test_runtime_behaviour(self):
        tmp = HERE / 'test_build.js'
        tmp.write_text((HERE / 'reads.js').read_text() + (HERE / 'queue.js').read_text())
        try:
            subprocess.run(['node', str(HERE / 'test_queue_runtime.js'), str(tmp)], check=True)
        finally:
            tmp.unlink(missing_ok=True)


if __name__ == '__main__':
    unittest.main()
