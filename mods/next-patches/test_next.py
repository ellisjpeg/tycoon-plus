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


patch = load('next_patch', HERE / 'prepare.py')


class NextTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text()
        cls.map_json = patch.build_map()
        cls.map = json.loads(cls.map_json)

    def phone(self, sel):
        return next(r for r in self.map['SMARTPHONE'] if r['sel'] == sel)

    def test_map_from_event_sheets(self):
        r = self.phone('ScreenRefreshRate')
        self.assertEqual((r['src'], r['temp'], r['date'], r['name'], r['suf']),
                         ('ArrayScreenRefreshRate_Smartphone', 'ArrayScreenRefreshRate_Temp', 1, 0, ' Hz'))
        self.assertEqual((r['text'], r['left'], r['right'], r['res']), (704, 702, 703, 20))
        # Date columns the real-dates work checked by hand: waterproof 2, ROM type 4.
        self.assertEqual(self.phone('WaterproofLevel')['date'], 2)
        self.assertEqual(self.phone('ROM_Type')['date'], 4)
        # Tile pickers (no arrows) and CPU/GPU year windows are not arrow lists.
        sels = {r['sel'] for r in self.map['SMARTPHONE']}
        self.assertNotIn('ScreenResolution', sels)
        self.assertNotIn('Processor', sels)
        uids = [r['text'] for rows in self.map.values() for r in rows]
        self.assertEqual(len(uids), len(set(uids)))

    def row(self, cat, sel):
        return next(r for r in self.map[cat] if r['sel'] == sel)

    def test_one_column_types(self):
        # TV, scooter, keyboard, console, VR keep the source row in Temp column 0 and set the
        # label straight on the text (picked in the same or a parent event).
        cases = {
            ('TV', 'ScreenRefreshRate'): ('ArrayScreenRefreshRate_TV', 1, ' Hz', False, 4465, 4464, 249),
            ('TV', 'Cooling'): ('ArrayCooling_TV', 1, '', True, 24347, 24342, 733),
            ('TV', 'ScreenColorGamut'): ('ArrayScreenColorGamut_TV', 2, '', False, 24160, 24159, 251),
            ('SCOOTER', 'WaterproofLevel'): ('ArrayWaterproof_Smartphone', 2, '', False, 8039, 8038, 76),
            ('SCOOTER', 'GPS_Version'): ('ArrayGPS', 1, '', False, 8114, 8100, 318),
            ('KEYBOARD', 'Battery'): ('ArrayBattery_Keyboard', 2, ' mAh', False, 9190, 9189, 364),
            # Upgraded chip part: "<series value> -> <your value> ms".
            ('SCOOTER', 'ProcessorSensorLatency'): ('ArrayCPUSensorLatency_Scooter', 1, ' ms', False, 24414, self.row('SCOOTER', 'ProcessorSensorLatency')['right'], 739),
            ('CONSOLE', 'ProcessorCores'): ('ArrayCPUCores_Console', 1, '', False, 12102, 12101, 394),
            ('CONSOLE', 'TypeA_Version'): ('ArrayTypeAPort', 2, '', False, 12345, 12344, 419),
            ('VR', 'CameraFPS'): ('ArrayCameraFPS_VR', 2, ' Hz', False, 15674, 15673, 499),
            # Gamepad pages (not in the template map): selectors from ID = Temp.At(sel - 1, 0).
            ('GAMEPAD', 'Bluetooth_Gamepad'): ('ArrayBluetooth', 1, '', False, 13333, 13340, 74),
            ('GAMEPAD', 'ProcessorInputLatency'): ('ArrayCPUInputLatency_Gamepad', 1, ' ms', False, 25269, 25268, 749),
            ('HEADPHONES', 'HeadphonesEqualizer'): ('ArrayEqualizer_Headphones', 1, '', True, 23708, 23707, 682),
        }
        for (cat, sel), want in cases.items():
            r = self.row(cat, sel)
            self.assertEqual(r['col'], 0, sel)
            self.assertEqual((r['src'], r['date'], r['suf'], r['lang'], r['text'], r['right'], r['res']), want, cat + ' ' + sel)
        # Phone-style pages keep column 1 and their own labels.
        self.assertEqual((self.phone('RAM')['col'], self.phone('RAM')['lang']), (1, False))
        # Counts found today (a page the generator cannot read exactly drops out, never guesses).
        self.assertEqual({c: len(self.map[c]) for c in ('TV', 'SCOOTER', 'KEYBOARD', 'CONSOLE', 'VR', 'GAMEPAD')},
                         {'TV': 22, 'SCOOTER': 11, 'KEYBOARD': 5, 'CONSOLE': 12, 'VR': 13, 'GAMEPAD': 6})
        # A pop-up tile that reads the same list (VR sound chip) is not the selector's label.
        self.assertNotIn('SoundChip', {r['sel'] for r in self.map['VR']})
        # The description line under a selector is never taken for its value.
        self.assertNotIn(8040, [r['text'] for r in self.map['SCOOTER']])

    def test_appends_once_with_ui(self):
        out = patch.transform(self.source, self.map_json)
        self.assertTrue(out.startswith(self.source))
        self.assertEqual(out.count('var _DT_NEXT_MAP = '), 1)
        self.assertIn('var _dtUi =', out)
        with self.assertRaises(ValueError):
            patch.transform(out, self.map_json)

    def test_reuses_existing_ui(self):
        base = self.source + '\n;\nvar _dtUi = 1;\n'
        out = patch.transform(base, self.map_json)
        body = (HERE / 'next.js').read_text().replace(patch.PLACEHOLDER, self.map_json.strip())
        self.assertEqual(out, base + '\n;\n' + body)

    def test_fails_loudly_on_lost_selectors(self):
        m = dict(self.map)
        m['SMARTPHONE'] = [r for r in m['SMARTPHONE'] if r['sel'] != 'ScreenRefreshRate']
        with self.assertRaises(ValueError):
            patch.transform(self.source, json.dumps(m))
        bad = dict(self.map)
        bad['SMARTPHONE'] = [dict(r, text=None) for r in bad['SMARTPHONE']]
        with self.assertRaises(ValueError):
            patch.validate_map(bad)

    def test_syntax_and_runtime(self):
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
            f.write(patch.transform(self.source, self.map_json))
        subprocess.run(['node', '--check', f.name], check=True)
        subprocess.run(['node', str(HERE / 'test_next_runtime.js')], check=True)


if __name__ == '__main__':
    unittest.main()
