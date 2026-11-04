import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('assistant_patch', Path(__file__).with_name('prepare.py'))
patch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patch)
SOURCE = (ROOT / 'game-files/data.json').read_text()
C3MAIN = (ROOT / 'game-files/scripts/c3main.js').read_text()


def event(node, sid):
    if isinstance(node, list):
        if len(node) > 7 and node[0] == 0 and node[3] is None and node[4] == sid:
            return node
        for child in node:
            found = event(child, sid)
            if found:
                return found
    return None


class AssistantTests(unittest.TestCase):
    def setUp(self):
        self.patched = patch.transform(SOURCE)

    def test_inserts_one_presentation_no_sub_event(self):
        start, end = patch.block(self.patched, patch.NO_PRESS_CONFERENCE)
        inserted_start, inserted_end = patch.block(self.patched, patch.NEW_SIDS[0])
        self.assertEqual(inserted_start, end + 1)
        # Everything else is byte-for-byte the original.
        self.assertEqual(self.patched[:end] + self.patched[inserted_end:], SOURCE)
        project = json.loads(self.patched)['project']
        no = event(project[6], patch.NO_EVENT)
        added = event(project[6], patch.NEW_SIDS[0])
        conference = event(project[6], patch.NO_PRESS_CONFERENCE)
        self.assertIn(added, no[8])
        self.assertEqual(no[8].index(added), no[8].index(conference) + 1)
        presentation = event(project[6], patch.YES_PRESENTATION)[6][0][9][2]
        self.assertEqual(added[6][0][9], [[11, patch.ASSISTANT_THEME], [8, 0], presentation])
        # Same actions as the PRESS CONFERENCE NO, apart from SIDs.
        strip = lambda acts: [a[:3] + a[4:] for a in acts]
        self.assertEqual(strip(added[7]), strip(conference[7]))
        for sid in patch.NEW_SIDS:
            self.assertEqual(self.patched.count(str(sid)), 1)

    def test_theme_is_the_presentation_string(self):
        presentation = patch.theme_of(self.patched[slice(*patch.block(self.patched, patch.NEW_SIDS[0]))])
        start = C3MAIN.index('self.C3_ExpressionFuncs=[') + len('self.C3_ExpressionFuncs=[')
        # Count top-level entries up to the index; simple string literals only need quote tracking.
        depth, quoted, escaped, index, i = 0, None, False, 0, start
        while index < presentation:
            c = C3MAIN[i]
            if quoted:
                if escaped:
                    escaped = False
                elif c == '\\':
                    escaped = True
                elif c == quoted:
                    quoted = None
            elif c in '"\'`':
                quoted = c
            elif c in '([{':
                depth += 1
            elif c in ')]}':
                depth -= 1
            elif c == ',' and depth == 0:
                index += 1
            i += 1
        self.assertTrue(C3MAIN.startswith('()=>"PRESENTATION",', i), C3MAIN[i:i + 40])

    def test_applies_once(self):
        self.assertIs(patch.transform(self.patched), self.patched)

    def test_rejects_drift(self):
        moved = SOURCE.replace('[[6,"PRESENTATION MENU"]]', '[[6,"PRESENTATION LOBBY"]]')
        with self.assertRaises(ValueError):
            patch.transform(moved)
        start, end = patch.block(SOURCE, patch.NO_PRESS_CONFERENCE)
        changed = SOURCE[:end - 2] + ',[-1,34,null,1,0,null,[]]' + SOURCE[end - 2:]
        with self.assertRaises(ValueError):
            patch.transform(changed)


if __name__ == '__main__':
    unittest.main()
