import importlib.util
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('research_filter_patch', HERE / 'prepare.py')
patch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patch)
C3MAIN = ROOT / 'game-files/scripts/c3main.js'


class ResearchFilterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text(encoding='utf-8')

    def test_each_spot_changes_once_and_reverses(self):
        out = patch.transform(self.source)
        back = out
        for old, new, _ in patch.SPOTS:
            self.assertEqual(out.count(new), 1)
            self.assertEqual(out.count(old), new.count(old))
            back = back.replace(new, old)
        self.assertEqual(back, self.source)

    def test_refuses_double_application(self):
        with self.assertRaises(ValueError):
            patch.transform(patch.transform(self.source))

    def test_missing_or_drifted_spots_raise(self):
        for old, _, _ in patch.SPOTS:
            with self.assertRaises(ValueError):
                patch.transform(self.source.replace(old, 'drifted'))
            with self.assertRaises(ValueError):
                patch.transform(self.source + old)

    def test_full_build_parses(self):
        build = importlib.util.spec_from_file_location('build', ROOT / 'build.py')
        mod = importlib.util.module_from_spec(build)
        build.loader.exec_module(mod)
        with tempfile.TemporaryDirectory() as d:
            subprocess.run(['python3', str(ROOT / 'build.py'), d], check=True, capture_output=True)
            text = (Path(d) / 'scripts/c3main.js').read_text(encoding='utf-8')
            self.assertEqual(text.count('_dtResCat'), 4)

    def test_pick_carries_across_tabs(self):
        # Run the three patched lines as written, with a stand-in page: the game's tab change
        # and reopen clear _activeCategory, then draw; the pick must come back.
        out = patch.transform(self.source)
        tap = patch.TAP_NEW.split(',_renderContent()')[0]
        js = f'''
        var _activeCategory="",_dtResCat="",log=[];
        function draw(s){{{patch.DRAW_NEW};log.push(_activeCategory)}}
        function tap(e){{{tap}}}
        draw(["Smartphone","Laptop"]); tap("Laptop"); draw(["Smartphone","Laptop"]);
        _activeCategory=""; draw(["Laptop","Watch"]);          // tab change: game clears, pick returns
        _activeCategory=""; draw(["Smartphone"]);              // tab without laptops: show all
        _activeCategory=""; draw(["Laptop"]);                  // next tab with laptops: back again
        tap("Laptop"); draw(["Laptop"]);                       // tap lit icon: cleared everywhere
        _activeCategory=""; draw(["Laptop","Smartphone"]);
        console.log(JSON.stringify(log));
        '''
        self.assertIn(patch.DRAW_NEW, out)
        r = subprocess.run(['node', '-e', js], check=True, capture_output=True, text=True)
        self.assertEqual(r.stdout.strip(), '["","Laptop","Laptop","","Laptop","",""]')


if __name__ == '__main__':
    unittest.main()
