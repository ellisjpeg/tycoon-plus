import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('speed_patch', HERE / 'prepare.py')
patch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patch)
C3MAIN = ROOT / 'game-files/scripts/c3main.js'


def load(name, path):
    s = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


class SpeedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text()

    def test_hook_insertion_and_reversibility(self):
        candidate = patch.transform(self.source)
        body = (HERE / 'speed.js').read_text()
        self.assertTrue(candidate.endswith('\n;\n' + body))
        core = candidate.removesuffix('\n;\n' + body)
        self.assertEqual(core, self.source.replace(patch.ANCHOR, patch.HOOK + patch.ANCHOR))
        self.assertEqual(core.count(patch.HOOK), 1)
        self.assertIn(patch.HOOK + patch.ANCHOR, core)
        self.assertEqual(core.replace(patch.HOOK + patch.ANCHOR, patch.ANCHOR), self.source)

    def test_refuses_double_application(self):
        candidate = patch.transform(self.source)
        with self.assertRaises(ValueError):
            patch.transform(candidate)
        with self.assertRaises(ValueError):
            patch.transform(self.source + patch.HOOK)
        with self.assertRaises(ValueError):
            patch.transform(self.source + '\n;var _dtSpeedPlan=0;')

    def test_missing_or_drifted_anchors_raise(self):
        with self.assertRaises(ValueError):
            patch.transform(self.source.replace(patch.ANCHOR, 'drifted'))
        with self.assertRaises(ValueError):
            patch.transform(self.source + patch.ANCHOR)
        for required in patch.REQUIRED:
            with self.assertRaises(ValueError):
                patch.transform(self.source.replace(required, 'drifted'))
        with self.assertRaises(ValueError):
            patch.transform('')

    def test_patched_script_parses_after_other_patches(self):
        template = load('template', ROOT / 'mods/template-patches/prepare.py')
        launch = load('launch', ROOT / 'mods/launch-patches/prepare.py')
        difficulty = load('difficulty', ROOT / 'mods/difficulty-patches/prepare.py')
        map_json = template.build_map(ROOT / 'game-files/data.json', C3MAIN)
        source = self.source
        source = template.transform(source, map_json)
        source = patch.transform(source)
        source = launch.transform(source)
        source = difficulty.transform(source)
        with tempfile.NamedTemporaryFile('w', suffix='.js') as f:
            f.write(source)
            f.flush()
            subprocess.run(['node', '--check', f.name], check=True)

    def test_inserted_hook_runs_with_planner_locals(self):
        candidate = patch.transform(self.source)
        body = '\n;\n' + (HERE / 'speed.js').read_text()
        self.assertTrue(candidate.endswith(body))
        core = candidate.removesuffix(body)
        anchor_at = self.source.index(patch.ANCHOR)
        prefix, suffix = self.source[:anchor_at], self.source[anchor_at:]
        self.assertTrue(core.startswith(prefix))
        inserted = core[len(prefix):]
        self.assertTrue(inserted.endswith(suffix))
        hook = inserted[:-len(suffix)]
        self.assertIn('_dtSpeedPlan', hook)
        subprocess.run(['node', str(HERE / 'test_speed_runtime.js'),
                        str(HERE / 'speed.js'), hook], check=True)

    def test_runtime_behaviour(self):
        subprocess.run(['node', str(HERE / 'test_speed_runtime.js'), str(HERE / 'speed.js')], check=True)


if __name__ == '__main__':
    unittest.main()
