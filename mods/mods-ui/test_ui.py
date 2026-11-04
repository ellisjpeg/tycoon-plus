import subprocess
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
UI = HERE / 'ui.js'


class UiTests(unittest.TestCase):
    def test_script_parses(self):
        subprocess.run(['node', '--check', str(UI)], check=True)

    def test_runtime_behaviour(self):
        subprocess.run(['node', str(HERE / 'test_ui_runtime.js'), str(UI)], check=True)


if __name__ == '__main__':
    unittest.main()
