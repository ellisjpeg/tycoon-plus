import contextlib
import importlib.util
import io
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


patch = load('fairprice_patch', HERE / 'prepare.py')
skip = load('fairprice_skip', HERE.parent / 'skip-patches/prepare.py')


class FairPriceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text()
        cls.data = DATA.read_text()
        cls.editor = patch.editor_map(cls.data, cls.source)

    def test_markup_expression_is_only_the_review_price_checks(self):
        # E20619 in the event dump: 10 engines x 8 tests in 282 REVIEWS, nowhere else.
        idx = patch.check_uses(self.data, self.source)
        self.assertEqual(idx, 20619)
        self.assertEqual(self.editor['SMARTPHONE'], 'SMARTPHONES')
        self.assertEqual(self.editor['VR'], 'VR CONSOLE')
        self.assertEqual(len(self.editor), 10)
        self.assertNotIn('GAMEPAD', self.editor)
        one_less = self.data.replace('[7,[%d,' % idx, '[7,[1,', 1)
        with self.assertRaises(ValueError):
            patch.check_uses(one_less, self.source)
        with self.assertRaises(ValueError):
            patch.transform(self.source.replace(patch.OLD, patch.OLD.replace('),100)}', '),101)}')), self.data)

    def test_patch_wraps_the_expression_and_appends_once(self):
        out = patch.transform(self.source, self.data)
        self.assertEqual(out.count('_dtFairReview(BB(FB(LB(t.ExpObject(0,n.GetValue(),4),100),o.ExpObject(0,a.GetValue(),3)),100),'), 1)
        self.assertNotIn(patch.OLD, out)
        self.assertEqual(out.count('function _dtFairReview('), 1)
        self.assertNotIn('__DT_FAIR_EDITOR__', out)
        body = (HERE / 'fairprice.js').read_text().replace('__DT_FAIR_EDITOR__', json.dumps(self.editor, sort_keys=True, separators=(',', ':')))
        self.assertTrue(out == self.source.replace(patch.OLD, patch.NEW, 1) + '\n;\n' + body, 'transform output changed shape')
        with self.assertRaises(ValueError):
            patch.transform(out, self.data)

    def test_game_changes_fail_loudly(self):
        for anchor in ('function _anchorAt(e,t){', '_cfg12={K:1.55,', 'function _today(e){'):
            with self.assertRaises(ValueError, msg=anchor):
                patch.transform(self.source.replace(anchor, anchor.replace('(', '( ', 1).replace('{', '{ ', 1)), self.data)
        with self.assertRaises(ValueError):
            patch.transform(self.source, self.data.replace('"DeviceCostPrice"', '"DeviceCostPrice2"'))
        with self.assertRaises(ValueError):
            patch.transform(self.source + '\nvar _DT_X_ROW = 155;', self.data)

    def test_flag_off_is_byte_identical(self):
        # Last step of the chain: FAIRPRICE=off output + the expression wrap + the block = the on build.
        # Both builds run build.py's own step chain (apply_steps) in memory: no 2 x 64 MB written to /tmp.
        dev = load('fairprice_devbuild', ROOT / 'build.py')

        # Modules added after FAIRPRICE are switched off in both builds so FAIRPRICE is the last step.
        order = [s[0] for s in dev.PATCH_STEPS]
        later = list(dict.fromkeys(order[max(i for i, f in enumerate(order) if f == 'DEVICES_TYCOON_FAIRPRICE') + 1:]))

        def build(flag):
            names = ['DEVICES_TYCOON_FAIRPRICE'] + later
            keep = {n: os.environ.get(n) for n in names}
            os.environ['DEVICES_TYCOON_FAIRPRICE'] = flag
            for n in later:
                os.environ[n] = 'off'
            try:
                with contextlib.redirect_stdout(io.StringIO()):
                    return dev.apply_steps({'c3main.js': dev.INPUT_C3MAIN.read_text(),
                                            'data.json': dev.INPUT_DATA.read_bytes().decode('utf-8')})
            finally:
                for n, v in keep.items():
                    if v is None:
                        os.environ.pop(n, None)
                    else:
                        os.environ[n] = v
        on, off = build('on'), build('off')
        # skip.js asks `typeof _dtFairForecast` (absent here), so look for this module's own code.
        self.assertFalse('var _DT_FAIR =' in off['c3main.js'] or '_dtFairReview(' in off['c3main.js'], 'fair price code in the off build')
        self.assertEqual(off['c3main.js'].count(patch.OLD), 1)
        body = (HERE / 'fairprice.js').read_text().replace('__DT_FAIR_EDITOR__', json.dumps(self.editor, sort_keys=True, separators=(',', ':')))
        self.assertTrue(on['c3main.js'] == off['c3main.js'].replace(patch.OLD, patch.NEW, 1) + '\n;\n' + body, 'on build != off build + wrap + block')
        self.assertTrue(on['data.json'] == off['data.json'], 'data.json differs')

    def test_syntax_and_runtime(self):
        out = patch.transform(self.source, self.data)
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
            f.write(out)
        try:
            subprocess.run(['node', '--check', f.name], check=True)
        finally:
            os.unlink(f.name)
        patched = patch.MARKUP.replace(patch.OLD, patch.NEW)
        table = skip.table(self.data, self.source)
        subprocess.run(['node', str(HERE / 'test_fairprice_runtime.js'), json.dumps(self.editor), patched, json.dumps(table)], check=True)


if __name__ == '__main__':
    unittest.main()
