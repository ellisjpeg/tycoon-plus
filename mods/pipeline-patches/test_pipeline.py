import importlib.util
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent


def load(name, path):
    s = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


patch = load('pipeline_patch', HERE / 'prepare.py')


class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        devbuild = load('devbuild', ROOT / 'build.py')
        cls.devbuild = devbuild
        cls.base = {
            'c3main.js': devbuild.INPUT_C3MAIN.read_text(),
            'data.json': devbuild.INPUT_DATA.read_bytes().decode(),
        }
        old = devbuild.PATCH_STEPS
        devbuild.PATCH_STEPS = [s for s in old if s[0] != 'DEVICES_TYCOON_PIPELINE']
        try:
            cls.chain = devbuild.apply_steps(dict(cls.base))['c3main.js']
        finally:
            devbuild.PATCH_STEPS = old

    def test_appends_once(self):
        out = patch.transform(self.chain)
        self.assertEqual(out, self.chain + '\n;\n' + (HERE / 'pipeline.js').read_text())
        with self.assertRaises(ValueError):
            patch.transform(out)

    def test_needs_queue_and_rooms(self):
        no_rooms = self.chain.replace('setInterval)(_dtrTick, 250);', '')
        self.assertEqual(patch.transform(no_rooms), no_rooms, 'skipped without the room button')
        with self.assertRaises(ValueError):
            patch.transform(self.chain.replace('globalThis._dtPipeHold && globalThis._dtPipeHold()', ''))

    def test_flag_off_is_byte_identical(self):
        os.environ['DEVICES_TYCOON_PIPELINE'] = 'off'
        try:
            off = self.devbuild.apply_steps(dict(self.base))
        finally:
            os.environ.pop('DEVICES_TYCOON_PIPELINE', None)
        self.assertEqual(off['c3main.js'], self.chain)

    def test_syntax_and_slot_logic(self):
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
            f.write(patch.transform(self.chain))
        subprocess.run(['node', '--check', f.name], check=True)
        subprocess.run(['node', str(HERE / 'test_pipeline_runtime.js')], check=True)


if __name__ == '__main__':
    unittest.main()
