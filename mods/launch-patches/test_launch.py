import importlib.util
import os
import re
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('launch_patch', HERE / 'prepare.py')
patch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patch)
DATA = ROOT / 'game-files/data.json'
C3MAIN = ROOT / 'game-files/scripts/c3main.js'
UI = HERE.parent / 'mods-ui/ui.js'
HOOK = re.compile(r'_dtLaunchRelease\("([^"]+)",e,"([^"]+)",([01])\)\|\|')
CPU_GPU = (
    'ArrayMyCPU_SmartphonesEarnings', 'ArrayMyCPU_LaptopsEarnings', 'ArrayMyCPU_ConsolesEarnings',
    'ArrayMyCPU_VREarnings', 'ArrayMyGPU_LaptopsEarnings',
)


class LaunchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text()
        cls.matches = list(patch.ACTION.finditer(cls.source))
        cls.body = (HERE / 'launch.js').read_text()
        cls.ui = UI.read_text()
        cls.events = (HERE / 'event.js').read_text()
        cls.reviews = (HERE / 'reviews.js').read_text()
        # Existing checks run with launch events off: that output must stay as before.
        os.environ['DEVICES_TYCOON_EVENT'] = 'off'
        cls.candidate = patch.transform(cls.source)
        os.environ['DEVICES_TYCOON_EVENT'] = 'on'
        cls.candidate_on = patch.transform(cls.source)
        os.environ.pop('DEVICES_TYCOON_EVENT')
        cls.hooks = HOOK.findall(cls.candidate)

    def test_transform_wraps_every_release_action_exactly(self):
        self.assertEqual(len(self.matches), 32, 'the release actions moved in the game script')
        self.assertEqual(len(self.hooks), 32)

        seen = {}
        parts = []
        previous = 0
        for match in self.matches:
            arr, cat = match.group(3), match.group(4)
            last = 1 if arr not in seen else 0
            seen[arr] = seen.get(arr, 0) + 1
            parts.append(self.source[previous:match.start()])
            parts.append('%s_dtLaunchRelease("%s",e,"%s",%d)||(%s)}' % (
                match.group(1), arr, cat, last, match.group(2)))
            previous = match.end()
        parts.append(self.source[previous:])
        expected_core = patch.patch_helpers(''.join(parts))
        tail = '\n;\n' + self.ui + '\n;\n' + self.body
        self.assertTrue(self.candidate.endswith(tail))
        self.assertEqual(self.candidate[:-len(tail)], expected_core)

    def test_device_arrays_last_flag_on_first_action(self):
        self.assertEqual(len(patch.DEVICE_ARRAYS), 11)
        by_array = {}
        for arr, cat, last in self.hooks:
            by_array.setdefault(arr, []).append(last)
        for arr in patch.DEVICE_ARRAYS:
            with self.subTest(arr=arr):
                self.assertEqual(by_array[arr], ['1', '0'])
        for arr in CPU_GPU:
            with self.subTest(arr=arr):
                self.assertEqual(by_array[arr], ['1', '0'])
        self.assertEqual(set(arr for arr in by_array if arr in patch.DEVICE_ARRAYS),
                         set(patch.DEVICE_ARRAYS))

    def test_refuses_double_application_and_drifted_anchors(self):
        with self.assertRaises(ValueError) as raised:
            patch.transform(self.candidate)
        self.assertIn('already applied', str(raised.exception))
        for required in patch.REQUIRED:
            with self.subTest(required=required):
                with self.assertRaises(ValueError):
                    patch.transform(self.source.replace(required, 'DRIFTED'))
        action = ('registerDeviceSalesForArray("ArraySmartphones",e),'
                  'socialQueueDeviceReleased(e,"SMARTPHONES")')
        self.assertEqual(self.source.count(action), 2)
        with self.assertRaises(ValueError):
            patch.transform(self.source.replace(action, 'registerDeviceSalesForArray("ArraySmartphones",e)', 1))

    def test_events_flag_appends_only_event_js(self):
        self.assertEqual(self.candidate_on, self.candidate + '\n;\n' + self.events + '\n;\n' + self.reviews)
        self.assertEqual(patch.transform(self.source), self.candidate_on, 'events default on')
        for anchor in patch.EVENT_REQUIRED:
            with self.subTest(anchor=anchor[:30]):
                self.assertEqual(self.source.count(anchor), 1)
        os.environ['DEVICES_TYCOON_EVENT'] = 'on'
        try:
            with self.assertRaises(ValueError):
                patch.transform(self.source.replace('function _findDevSlotX2(e){', 'function _findSlot(e){'))
        finally:
            os.environ.pop('DEVICES_TYCOON_EVENT')

    def test_event_runtime_behaviour(self):
        subprocess.run(['node', str(HERE / 'test_event_runtime.js'), str(HERE / 'launch.js'), str(HERE / 'event.js')], check=True)

    def test_reviews_anchors_present_once(self):
        for anchor in patch.REVIEWS_REQUIRED:
            self.assertEqual(self.source.count(anchor), 1, anchor)

    def test_reviews_runtime_behaviour(self):
        subprocess.run(['node', str(HERE / 'test_reviews_runtime.js'), str(HERE / 'launch.js'), str(HERE / 'event.js'), str(HERE / 'reviews.js')], check=True)

    def test_ui_is_appended_only_when_missing(self):
        prepended = 'var _dtUi = {};\n' + self.source
        out = patch.transform(prepended)
        self.assertTrue(out.endswith('\n;\n' + self.body + '\n;\n' + self.events + '\n;\n' + self.reviews))
        self.assertEqual(out.count('var _dtUi ='), 1)
        self.assertNotIn(self.ui.strip(), out)

    def test_patched_script_parses_after_other_patches(self):
        def load(name, path):
            s = importlib.util.spec_from_file_location(name, path)
            m = importlib.util.module_from_spec(s)
            s.loader.exec_module(m)
            return m
        template = load('template', ROOT / 'mods/template-patches/prepare.py')
        speed = load('speed', ROOT / 'mods/speed-patches/prepare.py')
        difficulty = load('difficulty', ROOT / 'mods/difficulty-patches/prepare.py')
        source = self.source
        source = template.transform(source, template.build_map(DATA, C3MAIN))
        source = speed.transform(source)
        source = patch.transform(source)
        source = difficulty.transform(source)
        # .mjs: the game loads c3main.js as a module, which refuses duplicate names.
        with tempfile.NamedTemporaryFile('w', suffix='.mjs') as f:
            f.write(source)
            f.flush()
            subprocess.run(['node', '--check', f.name], check=True)

    def test_reviews_names_unique_across_patches(self):
        decl = re.compile(r'^(?:async\s+)?(?:function\s*\*?|var|let|const)\s+([A-Za-z_$][\w$]*)', re.M)
        mine = set(decl.findall(self.reviews))
        self.assertIn('_dtRwStart', mine)
        for js in sorted((ROOT / 'native').glob('*/*.js')):
            if js.name.startswith('test_') or js == HERE / 'reviews.js':
                continue
            clash = mine & set(decl.findall(js.read_text()))
            self.assertFalse(clash, f'{js.parent.name}/{js.name}: {sorted(clash)}')

    @staticmethod
    def _func(source, name):
        start = source.index('function ' + name + '(')
        brace = source.index('{', start)
        depth = 0
        for i in range(brace, len(source)):
            if source[i] == '{':
                depth += 1
            elif source[i] == '}':
                depth -= 1
                if depth == 0:
                    return source[start:i + 1]
        raise AssertionError('unterminated ' + name)

    def test_release_helpers_ignore_future_release(self):
        # The real game helpers used by achievements, hints and the stats page
        # must not count a device whose planned RELEASE is still ahead.
        funcs = '\n'.join(self._func(self.candidate, n) for n in (
            '_forEachReleased', 'getReleasedDeviceStats', 'hasAnyReleasedDevice', 'countReleasedDevices'))
        script = r"""
const runtime = { globalVars: { DayTotal: 1000 }, objects: {} };
function arrayOf(rows) {
  const cells = new Map();
  const a = {
    width: 1, height: rows.length, depth: 8,
    getAt(x, y, z) { return cells.has(x + "," + y + "," + z) ? cells.get(x + "," + y + "," + z) : 0; },
    setAt(v, x, y, z) { cells.set(x + "," + y + "," + z, v); },
  };
  rows.forEach((r, y) => { for (const z in r) a.setAt(r[z], 0, y, Number(z)); });
  return a;
}
const pastAndFuture = arrayOf([
  { 0: 1, 1: 5, 5: 10, 7: 999, 8: "Old" },
  { 0: 1, 7: 9999, 5: 10, 8: "Planned" },
]);
const futureOnly = arrayOf([{ 0: 1, 7: 9999, 5: 10, 8: "Planned" }]);
const arrays = { Phones: pastAndFuture };
const Z13 = { CREATED: 0, SOLDED: 1, RATING: 5, RELEASE: 7 }, Z19 = { CREATED: 0, SOLDED: 1, RATING: 5, RELEASE: 7 }, NO_DEVICE3 = -1, STATS_TTL_DAYS = 0;
const DEVICE_ARRAYS = [{ name: "Phones" }];
let _statsCache = null, _anyReleasedCache = false;
function _runtimeFrom4() { return runtime; }
function _resolveDay() { return runtime.globalVars.DayTotal; }
function _rt42() { return runtime; }
function _getArray20(n) { return arrays[n]; }
function _dims4(a) { return [a.width, a.height, a.depth]; }
function _num25(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function _at42(a, x, y, z) { return a.getAt(x, y, z); }
function _resolveInst(rt, n) { return arrays[n]; }
function _resolveLicInst() { return null; }
function _licBlocked() { return false; }
""" + funcs + r"""
let seen = [];
const count = _forEachReleased("Phones", (created, sold, rating) => seen.push([created, rating]));
if (count !== 1) throw new Error("_forEachReleased counted " + count);
if (seen.length !== 1 || seen[0][1] !== 10) throw new Error("wrong row counted: " + JSON.stringify(seen));
const stats = getReleasedDeviceStats(runtime);
if (stats.released !== 1 || stats.lastReleaseDay !== 999 || stats.bestRating !== 10)
  throw new Error("stats counted the planned row: " + JSON.stringify(stats));
arrays.Phones = futureOnly;
_anyReleasedCache = false;
if (hasAnyReleasedDevice(runtime)) throw new Error("hint saw a future release");
if (countReleasedDevices(runtime, 0) !== 0) throw new Error("hint count saw a future release");
"""
        subprocess.run(['node', '-e', script], check=True)

    def test_social_uses_launch_row(self):
        # A waiting device that was pushed to a newer array line must be
        # announced with its own name, not line 0's newest device.
        func = self._func(self.candidate, 'socialQueueDeviceReleased')
        script = r"""
const dev = {
  width: 2, height: 3, depth: 9,
  getAt(x, y, z) { return (x === 0 && y === 0 && z === 8) ? "Ember 8" : (x === 1 && y === 0 && z === 8) ? "Ember 6" : 0; },
  setAt() {},
};
const social = {
  width: 1, height: 8, depth: 1, text: "",
  getAt(x, y) { return this.text; },
  setAt(v) { this.text = v; },
  setSize() {},
};
const runtime = { globalVars: { DayTotal: 1000, ReviewDeviceNowID: 0 }, objects: {
  ArraySmartphones: { getFirstInstance: () => dev },
  ArraySocialMedia: { getFirstInstance: () => social },
} };
const _DEVICE_NAME_SOURCES = { 0: { arr: "ArraySmartphones", kind: "device" } };
let _relSeenDay = null;
const _relSeen = new Set();
const _state2 = false;
function _deviceTypeIndex(t) { return t === "SMARTPHONES" ? 0 : -1; }
function socialDeviceReleased() {}
""" + func + r"""
socialQueueDeviceReleased(runtime, "SMARTPHONES", 0, 1);
if (social.text !== "r0:Ember 6,") throw new Error("social named " + JSON.stringify(social.text));
"""
        subprocess.run(['node', '-e', script], check=True)

    def test_runtime_behaviour(self):
        subprocess.run(['node', str(HERE / 'test_launch_runtime.js'), str(HERE / 'launch.js')], check=True)


if __name__ == '__main__':
    unittest.main()
