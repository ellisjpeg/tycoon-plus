import importlib.util
import json
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


patch = load('skip_patch', HERE / 'prepare.py')


class SkipTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text()
        cls.data = DATA.read_text()
        cls.table = patch.table(cls.data, cls.source)

    def test_bands_from_the_game(self):
        # 282 REVIEWS: <20 -> phrases 12-14, 20..30 -> 9-11, 30..35 -> 6-8 (in the shuffled pool),
        # 35..40 -> 3-5 and >=40 -> 0-2 (pushed to the front after the shuffle).
        rows = [(b['min'], b['max'], b['lo'], b['hi'], b['front']) for b in self.table['bands']]
        self.assertEqual(rows, [(None, 20, 12, 14, False), (20, 30, 9, 11, False), (30, 35, 6, 8, False),
                                (35, 40, 3, 5, True), (40, None, 0, 2, True)])
        self.assertEqual(sorted(self.table['types']), ['CONSOLE', 'HEADPHONES', 'KEYBOARD', 'LAPTOPS', 'SCOOTER',
                                                       'SMARTPHONES', 'TABLETS', 'TV', 'VR CONSOLE', 'WATCHES'])
        self.assertNotIn('GAMEPAD', self.table['types'])
        self.assertEqual(self.table['editor']['SMARTPHONE'], 'SMARTPHONES')
        self.assertEqual(self.table['editor']['VR'], 'VR CONSOLE')
        self.assertEqual(sorted(self.table['editor'].values()), sorted(self.table['types']))

    def test_band_change_fails_loudly(self):
        # A changed edge in one engine only: the engines no longer agree.
        exprs = patch.bands.split_exprs(self.source)
        i = next(k for k, e in enumerate(exprs) if e == '()=>35')
        j = next(k for k, e in enumerate(exprs) if e == '()=>36') if '()=>36' in exprs else None
        self.assertIsNotNone(j)
        d = json.loads(self.data)
        fn = patch.bands._functions(d['project'][6], {})['ReviewsEngine_TV']
        hit = 0
        for ev in patch.bands._events(fn[8]):
            for c in ev[6]:
                if isinstance(c, list) and len(c) > 9 and c[1] == 95 and c[9][2] == [7, [i]]:
                    c[9][2] = [7, [j]]
                    hit += 1
        self.assertGreater(hit, 0)
        with self.assertRaises(ValueError):
            patch.table(json.dumps(d), self.source)
        # A game update that moves a phrase range in every engine: the forecast follows it, no stale copy.
        moved = patch.table(self.data, self.source.replace('return()=>Math.round(t(9,11))}', 'return()=>Math.round(t(9,12))}'))
        self.assertEqual([(b['lo'], b['hi']) for b in moved['bands']][1], (9, 12))
        # Only one engine's range moved: the engines no longer agree.
        first = self.source.index('return()=>Math.round(t(9,11))}')
        one = self.source[:first] + 'return()=>Math.round(t(9,12))}' + self.source[first + len('return()=>Math.round(t(9,11))}'):]
        if one.count('return()=>Math.round(t(9,11))}'):
            with self.assertRaises(ValueError):
                patch.table(self.data, one)

    def test_appends_once_with_ui(self):
        out = patch.transform(self.source, self.data)
        self.assertTrue(out.startswith(self.source))
        self.assertEqual(out.count('function _dtSkipNow('), 1)
        self.assertNotIn('__DT_SKIP_TABLE__', out)
        self.assertIn('var _dtUi =', out)
        with self.assertRaises(ValueError):
            patch.transform(out, self.data)

    def test_reuses_existing_ui(self):
        base = self.source + '\n;\nvar _dtUi = 1;\n'
        out = patch.transform(base, self.data)
        body = (HERE / 'skip.js').read_text().replace('__DT_SKIP_TABLE__', json.dumps(self.table, separators=(',', ':')))
        self.assertEqual(out, base + '\n;\n' + body)

    def test_review_overlay_checked(self):
        for anchor in ('function _clearTimers(){', '_armGamepadStepIfNeeded(),_setReviewNextActive(1)},a)', 'e&&e.classList.add("rc-corner-show")'):
            with self.assertRaises(ValueError, msg=anchor):
                patch.transform(self.source.replace(anchor, anchor.replace('(', '( ', 1)), self.data)
        with self.assertRaises(ValueError):
            patch.transform(self.source, self.data.replace('"BATCH DELIVERY"', '"BATCH DELIVERY 2"'))

    def test_flag_off_is_byte_identical(self):
        # build.py with SKIP=off must equal the on-build minus the appended block.
        with tempfile.TemporaryDirectory() as d:
            env = dict(os.environ)
            subprocess.run(['python3', str(ROOT / 'build.py'), d + '/on'], check=True, capture_output=True, env=env)
            env['DEVICES_TYCOON_SKIP'] = 'off'
            subprocess.run(['python3', str(ROOT / 'build.py'), d + '/off'], check=True, capture_output=True, env=env)
            on = Path(d, 'on/scripts/c3main.js').read_text()
            off = Path(d, 'off/scripts/c3main.js').read_text()
            self.assertNotIn('_dtSkipNow', off)
            # Other patches may follow this block, so cut it out wherever it sits.
            body = (HERE / 'skip.js').read_text().replace('__DT_SKIP_TABLE__', json.dumps(self.table, separators=(',', ':')))
            block = '\n;\n' + body
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
        subprocess.run(['node', str(HERE / 'test_skip_runtime.js'), json.dumps(self.table)], check=True)


if __name__ == '__main__':
    unittest.main()
