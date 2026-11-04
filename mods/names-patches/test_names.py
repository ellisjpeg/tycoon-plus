import importlib.util
import json
import os
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
GAME = ROOT / 'game-files'
# Optional: a save file of your own, to check the load hook leaves saved arrays alone.
SAVE = Path(os.environ.get('DT_TEST_SAVE', GAME / 'Save.dt'))
spec = importlib.util.spec_from_file_location('names_prepare', HERE / 'prepare.py')
patch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patch)
MAP = patch.MAP

# Node harness: runs the payload, then feeds named arrays through the load hook.
RUNNER = r'''
const fs = require("fs");
const [payload, input] = [fs.readFileSync(process.argv[1], "utf8"), JSON.parse(fs.readFileSync(process.argv[2], "utf8"))];
const errors = []; console.error = (m) => errors.push(String(m));
(0, eval)(payload);
const out = { arrays: {}, done: {}, real: input.real.map(globalThis._dtRealName), errors };
for (const [name, arr] of Object.entries(input.arrays)) {
  const inst = { _arr: arr, _objectClass: { GetName: () => name } };
  out.done[name] = globalThis._dtNamesLoaded(inst);
  out.arrays[name] = inst._arr;
}
process.stdout.write(JSON.stringify(out));
'''

# Settings.dt round trip: boot load of the table, the player renames Apple, the game saves
# (snapshot -> file), then the next boot restores it cell by cell into the table.
SETTINGS_RUNNER = r'''
const fs = require("fs");
const [payload, table] = [fs.readFileSync(process.argv[1], "utf8"), JSON.parse(fs.readFileSync(process.argv[2], "utf8"))];
console.error = () => {};
(0, eval)(payload);
const inst = { _arr: table, _objectClass: { GetName: () => "ArrayCompanyNames" } };
globalThis._dtNamesLoaded(inst);
const app = table.findIndex((r) => r[0][0] === "Apple");
table[app][1][0] = "My Apple";
const snap = { cells: JSON.parse(JSON.stringify(table)) };
const other = { cells: [[["Nokia"], ["Nokia"]]] };
if (globalThis._dtNamesSaving) { globalThis._dtNamesSaving("ArrayCompanyNames", snap); globalThis._dtNamesSaving("ArraySettings", other); }
const saved = JSON.parse(JSON.stringify(snap.cells));
const live = JSON.parse(JSON.stringify(snap.cells));
globalThis.runtime = { objects: { ArrayCompanyNames: { getFirstInstance: () => ({
  getAt: (x, y, z) => (live[x] && live[x][y] ? live[x][y][z || 0] : 0),
  setAt: (v, x, y, z) => { live[x][y][z || 0] = v; } }) } } };
if (globalThis._dtNamesRestored) globalThis._dtNamesRestored("ArrayCompanyNames");
process.stdout.write(JSON.stringify({ saved, live, other: other.cells }));
'''

DECODE = r'''
const fs = require("fs"), zlib = require("zlib");
(async () => {
const PW = "dt7Qf2m_Kx9vR4pZs6Lw0Ej3Ub8Ay1Nc5Hg-TzP";
const [magic, mode, salt, iv, ct] = fs.readFileSync(process.argv[1], "utf8").trim().split("|");
const b = s => Buffer.from(s, "base64"), C = crypto.subtle;
const base = await C.importKey("raw", new TextEncoder().encode(PW), "PBKDF2", false, ["deriveKey"]);
const key = await C.deriveKey({name: "PBKDF2", salt: b(salt), iterations: 1e5, hash: "SHA-256"}, base, {name: "AES-GCM", length: 256}, false, ["decrypt"]);
const pt = Buffer.from(await C.decrypt({name: "AES-GCM", iv: b(iv)}, key, b(ct)));
process.stdout.write((mode === "gz" ? zlib.gunzipSync(pt) : pt).toString("utf8"));
})();
'''


def run_js(arrays, real=()):
    with tempfile.TemporaryDirectory() as d:
        Path(d, 'p.js').write_text(patch.js_payload(), encoding='utf-8')
        Path(d, 'i.json').write_text(json.dumps({'arrays': arrays, 'real': list(real)}), encoding='utf-8')
        r = subprocess.run(['node', '-e', RUNNER, Path(d, 'p.js'), Path(d, 'i.json')],
                           capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def company_table():
    f = GAME / 'ArrayCompanyNames.json'
    if f.is_file():
        return json.loads(f.read_text(encoding='utf-8-sig'))['data']
    names = list(MAP['companies']) + MAP['same']
    return [[[n], [n], [i], ['']] for i, n in enumerate(names)] + [[[''], [''], [0], ['']]]


class NamesTest(unittest.TestCase):
    def test_map(self):
        co = MAP['companies']
        self.assertEqual(len(co), 469)
        self.assertEqual(len(co) + len(MAP['same']), 477)
        self.assertFalse([k for k, v in co.items() if k == v])
        for k in ('Nokya', 'Motolora', 'Appel', 'Samsong', 'Gooqle', 'Xiaome', 'BlackBerie', 'Androyd', 'Infel', 'nVideo'):
            self.assertIn(k, co)
        self.assertEqual((co['Nokya'], co['Motolora'], co['Androyd'], co['Qualconn']), ('Nokia', 'Motorola', 'Android', 'Qualcomm'))
        self.assertEqual((MAP['lines']['Orchard'], MAP['lines']['Stellar S']), ('iPhone', 'Galaxy S'))
        unclear = {u['name'] for u in MAP['unclear']}
        self.assertFalse(unclear & set(MAP['lines']), 'unclear names are not mapped')

    def test_hook_and_text(self):
        src = 'x;' + patch.HOOK_OLD + '{};"' + '";"'.join(o for o, _, _ in patch.JS_TEXT) + '";' + ';'.join(o for o, _, _ in patch.FILE_HOOKS)
        out = patch.transform(src)
        self.assertEqual(out.count('globalThis._dtNamesLoaded&&globalThis._dtNamesLoaded(this)'), 1)
        self.assertEqual(out.count('globalThis._dtNamesSaving(e,t)'), 1)
        self.assertEqual(out.count('globalThis._dtNamesRestored(t)'), 1)
        self.assertIn('MediaTek M700+', out)
        self.assertIn('Sony 3 MAX', out)
        self.assertTrue(out.endswith(patch.js_payload()))
        with self.assertRaises(ValueError):
            patch.transform(out)
        with self.assertRaises(ValueError):
            patch.transform(src.replace(patch.HOOK_OLD, 'const n=t.size;'))
        with self.assertRaises(ValueError):
            patch.transform(src.replace('MediaRek M700+', 'X'))
        with self.assertRaises(ValueError):
            patch.transform(src.replace(patch.FILE_HOOKS[0][0], 'X'))

    def test_data_text(self):
        data = ''.join(o * n for o, _, n in patch.DATA_TEXT)
        out = patch.transform_data(data)
        self.assertNotIn('Infel', out)
        self.assertNotIn('Somy', out)
        self.assertIn('Intel UHD[/font]"', out)
        with self.assertRaises(ValueError):
            patch.transform_data(out)
        with self.assertRaises(ValueError):
            patch.transform_data(data.replace('AMG', 'X', 1))

    def test_runtime_table(self):
        table = company_table()
        lang = [[[''] for _ in range(13000)]]
        lang[0][567][0] = 'For example, buying a JDL company (speakers) will allow you'
        lang[0][12061][0] = 'MediaRek M700+'
        lang[0][12066][0] = 'Somy 3 MAX'
        player = [[['Appel'], ['Nokya Phone'], ['Ember'], [3]]]
        r = run_js({'ArrayCompanyNames': table, 'ArrayLanguage': lang, 'ArrayMyOS': player},
                   ['Appel', 'Orchard 15', 'Stellar Tab S 9', 'Nintendu Swap 2', 'Acco 5075', 'Ember', 'Appelx', 'Q-Vision 4', 7, 'Stellar S6', 'Stellar Tab S9', 'Optima G2', 'Stellar Sx',
                    'Q-Vision 17', 'Summit P1', 'Summit P7', 'Summit P30', 'Summit Watch GT 3', 'Stellar S2', 'Mo5', 'Orchard 15x', 'Blaze HD1', 'Summit Watch GT23', 'Stellar XR8', 'Blaze HDX'])
        self.assertEqual(r['errors'], [])
        self.assertEqual(r['done']['ArrayCompanyNames'], 469 * 2)
        names = {row[0][0] for row in r['arrays']['ArrayCompanyNames']}
        self.assertTrue({'Nokia', 'Motorola', 'Apple', 'Samsung', 'Android', 'Windows', 'Intel'} <= names)
        self.assertFalse(set(MAP['companies']) & names)
        ids = [row[2][0] for row in r['arrays']['ArrayCompanyNames']]
        self.assertEqual(ids, [row[2][0] for row in table], 'ids untouched')
        self.assertEqual([c[0] for c in r['arrays']['ArrayLanguage'][0] if c[0]],
                         ['For example, buying a JBL company (speakers) will allow you', 'MediaTek M700+', 'Sony 3 MAX'])
        self.assertEqual(r['arrays']['ArrayMyOS'], player, 'player arrays untouched')
        self.assertEqual(r['real'], ['Apple', 'iPhone 15', 'Galaxy Tab S 9', 'Nintendo Switch 2', 'Akko 5075', 'Ember',
                                     'Appelx', 'QLED 4', 7, 'Galaxy S6', 'Galaxy Tab S9', 'Optimus G2', 'Stellar Sx',
                                     'QLED 17', 'P1', 'P7', 'P30', 'Watch GT 3', 'Galaxy S2', 'Mo5', 'iPhone 15x', 'Fire HD1', 'Watch GT23', 'Galaxy XR8', 'Blaze HDX'])

    def test_settings_file_keeps_game_names(self):
        # The game's company names screen saves the whole table to Settings.dt (both columns) and
        # loads it back cell by cell at boot: the file holds the game's own names, the player's
        # own edits stay, and the real names come back after the load.
        table = company_table()
        with tempfile.TemporaryDirectory() as d:
            Path(d, 'p.js').write_text(patch.js_payload(), encoding='utf-8')
            Path(d, 'i.json').write_text(json.dumps(table), encoding='utf-8')
            r = subprocess.run(['node', '-e', SETTINGS_RUNNER, Path(d, 'p.js'), Path(d, 'i.json')],
                               capture_output=True, text=True, check=True)
        out = json.loads(r.stdout)
        x = {row[0][0]: i for i, row in enumerate(table)}
        saved, live = out['saved'], out['live']
        self.assertEqual([c[0][0] for c in saved], [row[0][0] for row in table], 'default column: game names')
        nok, app = x['Nokya'], x['Appel']
        self.assertEqual(saved[nok][1][0], 'Nokya')
        self.assertEqual(saved[app][1][0], 'My Apple', 'player edit kept')
        self.assertFalse(set(MAP['companies'].values()) & {c[0][0] for c in saved})
        self.assertEqual((live[nok][0][0], live[nok][1][0]), ('Nokia', 'Nokia'), 'real names after the load')
        self.assertEqual((live[app][0][0], live[app][1][0]), ('Apple', 'My Apple'))
        self.assertEqual(out['other'], [[['Nokia'], ['Nokia']]], 'other files untouched')

    def test_runtime_reports_game_change(self):
        r = run_js({'ArrayCompanyNames': [[['Nokya'], ['Nokya'], [0], ['']]], 'ArrayLanguage': [[['']] * 13000]})
        self.assertEqual(r['arrays']['ArrayCompanyNames'][0][0][0], 'Nokia')
        self.assertTrue(any('not found' in e for e in r['errors']))
        self.assertTrue(any('row 567' in e for e in r['errors']))

    @unittest.skipUnless(SAVE.is_file(), 'set DT_TEST_SAVE to a save file')
    def test_save_round_trip(self):
        # Every saved array goes through the load hook unchanged (saves hold the player's names and old text),
        # and the renamed table itself is never saved.
        save = json.loads(subprocess.run(['node', '-e', DECODE, str(SAVE)], capture_output=True, text=True,
                                         check=True).stdout)
        self.assertNotIn('ArrayCompanyNames', save['arrays'])
        arrays = {}
        for slot_row in save['arrays']['ArraySaves']['cells']:
            for row in slot_row:
                v = row[0]
                if isinstance(v, str) and v.startswith('{"c2array"'):
                    arrays['Saved%d' % len(arrays)] = json.loads(v)['data']
        for name, a in save['arrays'].items():
            if 'cells' in a:
                arrays[name] = a['cells']
        self.assertGreater(len(arrays), 50)
        r = run_js(arrays)
        self.assertEqual(r['arrays'], arrays)
        self.assertEqual(set(r['done'].values()), {0})

    def test_flag_off_is_byte_identical(self):
        # NAMES is the last step: the off build is the chain without it, the on build is exactly transform(off).
        # Modules added after NAMES are switched off in both builds so NAMES stays the last step.
        order = re.findall(r'"(DEVICES_TYCOON_[A-Z]+)"', (ROOT / 'build.py').read_text())
        with tempfile.TemporaryDirectory() as d:
            env = dict(os.environ)
            for flag in order[len(order) - order[::-1].index('DEVICES_TYCOON_NAMES'):]:
                env[flag] = 'off'
            env['DEVICES_TYCOON_NAMES'] = 'on'  # off unless asked for
            subprocess.run(['python3', str(ROOT / 'build.py'), d + '/on'], check=True, capture_output=True, env=env)
            env['DEVICES_TYCOON_NAMES'] = 'off'
            subprocess.run(['python3', str(ROOT / 'build.py'), d + '/off'], check=True, capture_output=True, env=env)
            on, off = Path(d, 'on'), Path(d, 'off')
            self.assertNotIn('_DT_NAMES', Path(off, 'scripts/c3main.js').read_text())
            self.assertEqual(patch.transform(Path(off, 'scripts/c3main.js').read_text()), Path(on, 'scripts/c3main.js').read_text())
            self.assertEqual(patch.transform_data(Path(off, 'data.json').read_bytes().decode('utf-8')),
                             Path(on, 'data.json').read_bytes().decode('utf-8'))


if __name__ == '__main__':
    unittest.main()
