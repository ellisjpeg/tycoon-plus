import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('bulk_patch', HERE / 'prepare.py')
patch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patch)
C3MAIN = ROOT / 'game-files/scripts/c3main.js'
UI_MARK = '\nvar _dtUi = 0; globalThis._dtUiApi = _dtUi;\n'


class BulkTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text(encoding='utf-8') + UI_MARK

    def test_renames_once_and_appends(self):
        out = patch.transform(self.source)
        body = '\n;\n' + (HERE / 'bulk.js').read_text()
        self.assertTrue(out.endswith(body))
        core = out.removesuffix(body)
        self.assertEqual(core.count(patch.NEW), 1)
        self.assertEqual(core.replace(patch.NEW, patch.OLD), self.source)

    def test_refuses_double_application(self):
        with self.assertRaises(ValueError):
            patch.transform(patch.transform(self.source))

    def test_missing_or_drifted_spots_raise(self):
        with self.assertRaises(ValueError):
            patch.transform(self.source.replace(patch.OLD, 'drifted'))
        for required in patch.REQUIRED:
            with self.assertRaises(ValueError):
                patch.transform(self.source.replace(required, 'drifted'))
        with self.assertRaises(ValueError):
            patch.transform(self.source.replace(UI_MARK, ''))

    def test_full_build_parses_and_has_one_find(self):
        with tempfile.TemporaryDirectory() as d:
            subprocess.run(['python3', str(ROOT / 'build.py'), d], check=True, capture_output=True)
            text = (Path(d) / 'scripts/c3main.js').read_text(encoding='utf-8')
            self.assertEqual(text.count('function findEmployees('), 1)
            self.assertEqual(text.count('function _dtFindOne('), 1)

    def test_runtime(self):
        subprocess.run(['node', str(HERE / 'test_bulk_runtime.js')], check=True)


if __name__ == '__main__':
    unittest.main()
