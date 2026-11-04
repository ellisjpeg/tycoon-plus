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
            self.assertEqual(text.count('_dtResCat'), 5)

    def test_pick_carries_across_tabs(self):
        # Run the three patched lines as written, with a stand-in page: the game's tab change
        # and reopen clear _activeCategory, then draw; the pick must come back.
        out = patch.transform(self.source)
        tap = patch.TAP_NEW.split(',_renderContent()')[0]
        # draw(tab): the patched first line, then the game's own icon check and the rows its
        # "Research all" button covers (_visibleActiveRows), as _renderContent runs them.
        js = f'''
        var _activeCategory="",_dtResCat="",_hideUnavailable=!1,_rows=[],log=[];
        const t={{classList:{{toggle(){{}}}}}};
        const row=(id,icon,active=!0)=>({{id,icons:[icon],active}});
        function draw(rows){{_rows=rows;{patch.DRAW_NEW}
          const i=[];for(const e of (_hideUnavailable?_rows.filter(e=>e.active):_rows))for(const c of e.icons)i.includes(c)||i.push(c);
          i.includes(_activeCategory)||(_activeCategory="");
          const all=_rows.filter(e=>e.active&&!(_activeCategory&&e.icons.length&&!e.icons.includes(_activeCategory)));
          log.push(_activeCategory+":"+all.length)}}
        function tap(e){{{tap}}}
        const A=[row(1,"Smartphone"),row(2,"Laptop")];
        draw(A); tap("Laptop"); draw(A);
        _activeCategory=""; draw([row(3,"Laptop"),row(4,"Watch"),row(5,"Laptop")]);  // tab change: pick returns
        _activeCategory=""; draw([row(6,"Smartphone")]);       // tab without laptops: show all
        _activeCategory=""; draw([row(7,"Laptop")]);           // next tab with laptops: back again
        _hideUnavailable=!0; _activeCategory=""; draw([row(8,"Laptop",!1),row(9,"Watch")]);  // laptops hidden: show all
        _hideUnavailable=!1; _activeCategory=""; draw([row(7,"Laptop")]);  // shown again: pick back
        tap("Laptop"); draw([row(7,"Laptop")]);                // tap lit icon: cleared everywhere
        _activeCategory=""; draw(A);
        console.log(JSON.stringify(log));
        '''
        self.assertIn(patch.DRAW_NEW, out)
        r = subprocess.run(['node', '-e', js], check=True, capture_output=True, text=True)
        # Research all covers exactly the cards on show.
        self.assertEqual(r.stdout.strip(), '[":2","Laptop:1","Laptop:2",":1","Laptop:1",":1","Laptop:1",":1",":2"]')


if __name__ == '__main__':
    unittest.main()
