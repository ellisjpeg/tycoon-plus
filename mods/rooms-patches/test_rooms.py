import importlib.util
import json
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


patch = load('rooms_patch', HERE / 'prepare.py')


class RoomsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text()

    def test_appends_once_with_ui(self):
        out = patch.transform(self.source)
        self.assertTrue(out.startswith(self.source))
        self.assertEqual(out.count('setInterval)(_dtrTick, 250);'), 1)
        self.assertIn('var _dtUi =', out)
        with self.assertRaises(ValueError):
            patch.transform(out)

    def test_reuses_existing_ui(self):
        base = self.source + '\n;\nvar _dtUi = 1;\n'
        out = patch.transform(base)
        self.assertEqual(out, base + '\n;\n' + (HERE / 'rooms.js').read_text() + '\n;\n' + patch.picker_js())

    def test_fails_loudly_on_changed_hooks(self):
        with self.assertRaises(ValueError):
            patch.transform(self.source.replace('function saveArraysToFile(e,t,n)', 'function saveArrays(e,t,n)'))
        with self.assertRaises(ValueError):
            patch.check_layouts('{"BOSS OFFICE": 1}')

    def test_picker_art_from_game_data(self):
        art = patch.pick_art(json.loads(patch.DATA.read_text()))
        self.assertEqual(len(art['inst']), len(patch.PICK_UIDS))
        # Tile hit areas, circles (the game's SVG), shadows and icons, placed as on the boss office.
        self.assertEqual(art['inst']['382'][:5], [600, 750, 88, 88, 'Sprite20'])
        self.assertEqual(art['inst']['351'][4:], ['SVG', 'SVG FILES/Circle.svg'])
        self.assertEqual(art['inst']['20232'][4], 'Sprite478')
        for name in ('Sprite12', 'Sprite16', 'Sprite20', 'Sprite478', 'Sprite292', 'Sprite316'):
            f = art['frames'][name]
            self.assertTrue(f[0].startswith('images/') and f[3] > 0 and f[4] > 0, name)
        self.assertTrue(art['frames']['Sprite479'][5], 'laptop frame is stored turned')
        js = patch.picker_js()
        self.assertNotIn('var _DTK_ART = null;', js)
        self.assertIn('"Sprite478"', js)
        bad = json.loads(patch.DATA.read_text())
        boss = next(l for l in bad['project'][5] if l[0] == 'BOSS OFFICE')
        for layer in boss[11]:
            layer[14] = [i for i in layer[14] if i[2] != 382]
            for s in layer[21]:
                s[14] = [i for i in s[14] if i[2] != 382]
        with self.assertRaises(ValueError):
            patch.pick_art(bad)
        # A changed game never stops Rooms installing: the in-room picker stays off (boss office picker).
        js = patch.picker_js(json.dumps(bad))
        self.assertIn('var _DTK_ART = null;', js)
        self.assertIn('var _DTK_ART = null;', patch.picker_js('{"project": []}'))

    def test_syntax_and_runtime(self):
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
            f.write(patch.transform(self.source))
        subprocess.run(['node', '--check', f.name], check=True)
        subprocess.run(['node', str(HERE / 'test_rooms_runtime.js')], check=True)
        subprocess.run(['node', str(HERE / 'test_picker_runtime.js')], check=True)


if __name__ == '__main__':
    unittest.main()
