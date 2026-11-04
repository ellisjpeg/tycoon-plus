import re
import subprocess
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
UI = HERE / 'rivals-ui.js'


class RivalsUiTests(unittest.TestCase):
    def test_ui_runtime(self):
        # Toast caps and wording, Board tab rows/chips/empty/Original states (fake runtime and DOM).
        r = subprocess.run(['node', str(HERE / 'test_rivals_ui_runtime.js')], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_syntax_reads_only_the_api(self):
        subprocess.run(['node', '--check', str(UI)], check=True)
        src = UI.read_text()
        code = '\n'.join(l.split('//')[0] for l in src.splitlines())
        # Never writes a game value or the save; never touches the game's own news cards.
        for bad in ('setAt(', 'globalVars.', 'ArraySaves', 'office-notif', 'callFunction', 'goToLayout'):
            self.assertNotIn(bad, code, bad)
        self.assertIn('globalThis._dtBoardTabs.push(', code)

    def test_russian_text_is_kept_apart(self):
        # Russian lives only in _DT_RV_TEXT_RU; the English table stays plain.
        src = UI.read_text()
        en = src[src.index('var _DT_RV_TEXT = {'):src.index('var _DT_RV_TEXT_RU = {')]
        self.assertIsNone(re.search('[Ѐ-ӿ]', en))
        self.assertIn('function _dtRvT()', src)


if __name__ == '__main__':
    unittest.main()
