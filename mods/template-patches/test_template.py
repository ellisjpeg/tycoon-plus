import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('template_patch', HERE / 'prepare.py')
patch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patch)
DATA = ROOT / 'game-files/data.json'
C3MAIN = ROOT / 'game-files/scripts/c3main.js'


class TemplateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text()
        cls.map_json = patch.build_map(DATA, C3MAIN)
        cls.map = json.loads(cls.map_json)

    def test_source_match_and_reversibility(self):
        candidate = patch.transform(self.source, self.map_json)
        body = (HERE / 'template.js').read_text().replace(patch.PLACEHOLDER, self.map_json.strip())
        self.assertTrue(candidate.endswith('\n;\n' + body))
        core = candidate.removesuffix('\n;\n' + body)
        self.assertEqual(core.replace(patch.MOUNT_NEW, patch.MOUNT_OLD).replace(patch.RESET_NEW, patch.RESET_OLD), self.source)
        for invalid in [candidate, self.source + patch.MOUNT_OLD, self.source.replace(patch.RESET_OLD, 'drift'),
                        self.source.replace('function _designCells(', 'function _cells(')]:
            with self.assertRaises(ValueError):
                patch.transform(invalid, self.map_json)
        for bad_map in ['{}', '{"SMARTPHONE":{"groups":[]}}']:
            with self.assertRaises(ValueError):
                patch.transform(self.source, bad_map)

    def test_patched_script_parses_after_other_patches(self):
        def load(name, path):
            s = importlib.util.spec_from_file_location(name, path)
            m = importlib.util.module_from_spec(s)
            s.loader.exec_module(m)
            return m
        source = self.source
        source = patch.transform(source, self.map_json)
        with tempfile.NamedTemporaryFile('w', suffix='.js') as f:
            f.write(source)
            f.flush()
            subprocess.run(['node', '--check', f.name], check=True)

    def test_real_game_map(self):
        m = self.map
        self.assertEqual(set(m), {'SMARTPHONE', 'TABLET', 'LAPTOP', 'WATCHES', 'HEADPHONES', 'TV', 'SCOOTER',
                                  'KEYBOARD', 'CONSOLE', 'VR'})
        maps = {mp['id']: mp for g in m['SMARTPHONE']['groups'] for mp in g['maps']}
        self.assertEqual(maps['ScreenResolutionID'],
                         {'id': 'ScreenResolutionID', 'temp': 'ArrayScreenResolution_Temp', 'col': 1,
                          'sel': 'ScreenResolution', 'when': [], 'drive': True})
        self.assertEqual(maps['RAM_ID']['temp'], 'ArrayRAM_Temp')
        os_group = next(g for g in m['SMARTPHONE']['groups'] if g['free'])
        self.assertEqual(os_group['free'], [{'sel': 'OperationSystem', 'temp': 'ArrayOperationSystem_Temp',
                                             'own': 'ArrayMyOS_Smartphones'}])
        self.assertEqual([[l['id'], l['sel'], l['k']] for l in m['CONSOLE']['linear']],
                         [['Graphic2D_ID', 'Graphic2D', -1], ['Graphic3D_ID', 'Graphic3D', -1]])
        project = json.loads(DATA.read_text())['project']
        functions = {}
        def walk(events):
            for e in events or []:
                if isinstance(e, list) and e and e[0] == 4 and isinstance(e[1], list):
                    functions[e[1][0]] = e[1]
                if isinstance(e, list) and len(e) > 8 and isinstance(e[8], list):
                    walk(e[8])
        for sheet in project[6]:
            walk(sheet[1])
        for cat, c in m.items():
            for g in c['groups']:
                fn = functions.get(g['fn'])
                self.assertIsNotNone(fn, g['fn'])
                self.assertTrue(fn[3] is True and fn[4] is not True, g['fn'] + ' must be enabled and synchronous')
            self.assertNotIn('class', c['touch'])
            self.assertNotIn('LastClass', c['touch'])

    def test_runtime_behaviour(self):
        subprocess.run(['node', str(HERE / 'test_template_runtime.js'), str(HERE / 'template.js')], check=True)

    def test_copy_has_no_em_dashes(self):
        self.assertNotIn('—', (HERE / 'template.js').read_text())


if __name__ == '__main__':
    unittest.main()
