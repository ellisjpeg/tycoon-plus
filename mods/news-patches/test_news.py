import importlib.util
import json
import os
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
C3MAIN = ROOT / 'game-files/scripts/c3main.js'
UI = HERE.parent / 'mods-ui/ui.js'


def load(name, path):
    s = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


patch = load('news_patch', HERE / 'prepare.py')
NEWS_JS = (HERE / 'news.js').read_text()


def news_value(key):
    return float(re.search(r'\b' + key + r': ([\d.]+)', NEWS_JS).group(1))


# Runs _dtNewsTrim in node with fake cards. Each case: window height, design scale, --office-notif-bottom px,
# card heights (oldest first), gap. Prints the indexes of the cards it sent away.
TRIM_RUNNER = r'''
const window = { innerHeight: 0 };
%s
const cases = JSON.parse(process.argv[1]);
const out = cases.map(([h, ds, bottom, heights, gap]) => {
  window.innerHeight = h;
  const host = { style: { getPropertyValue: () => bottom } };
  const cards = heights.map((x, i) => (Array.isArray(x) ? { offsetHeight: x[0], textContent: x[1], i } : { offsetHeight: x, i }));
  const gone = [];
  _dtNewsTrim(host, cards, gap, (c) => gone.push(c.i), ds);
  return gone;
});
console.log(JSON.stringify(out));
'''


class NewsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text()

    def test_appends_once_and_hooks_layout(self):
        out = patch.transform(self.source)
        self.assertTrue(out.endswith('\n;\n' + NEWS_JS))
        self.assertEqual(out.count(patch.HOOK_NEW), 1)
        self.assertNotIn(patch.HOOK_OLD, out)
        # Nothing else in the game code changes.
        self.assertEqual(out.count(patch.SALES_NEW), 1)
        self.assertEqual(out.count(patch.FLOOR_NEW), 1)
        self.assertEqual(out[:-len('\n;\n' + NEWS_JS)].replace(patch.HOOK_NEW, patch.HOOK_OLD)
                         .replace(patch.SALES_NEW, patch.SALES_OLD).replace(patch.FLOOR_NEW, patch.FLOOR_OLD), self.source)
        with self.assertRaises(ValueError):
            patch.transform(out)

    def test_game_changes_fail_loudly(self):
        for old in patch.REQUIRED_JS + (patch.HOOK_OLD, patch.SALES_OLD, patch.FLOOR_OLD):
            with self.assertRaises(ValueError, msg=old):
                patch.transform(self.source.replace(old, old[:-2] + '#!'))

    def test_sizes(self):
        # 1280x720 window: design scale 2/3. Text about 13 px, never above the mod toasts' 21 design px.
        font = news_value('font')
        self.assertAlmostEqual(font * 1280 / 1920, 13, delta=0.5)
        # Mod toasts copy these cards (ui.js): never smaller than the news text.
        toast = [float(x) for x in re.findall(r'\.dt-toast[^{]*\{[^}]*font-size: calc\(var\(--dt\) \* ([\d.]+)px\)', UI.read_text())]
        self.assertTrue(toast)
        self.assertLessEqual(font, toast[-1])
        self.assertEqual(news_value('lines'), 3)
        self.assertGreaterEqual(news_value('maxW'), news_value('minW'))
        # Game's own card was 320 wide; ours starts there and grows.
        self.assertEqual(news_value('minW'), 320)
        css = NEWS_JS
        for need in ('#office-notifications > .office-notif', '-webkit-line-clamp', 'var(--office-notif-scale, 1)'):
            self.assertIn(need, css)
        # The sales messages under the sales card: the same text size and padding as the news cards (so every
        # notice card matches), nothing else; their place, width, order and colours stay the game's.
        rules = re.findall(r'"([^"]*office-sales-notifications[^{]*)\{([^}]*)\}', css)
        self.assertEqual([r[0].strip() for r in rules], ['#office-sales-notifications > .office-notif'])
        props = sorted(p.split(':')[0].strip() for p in rules[0][1].split(';') if p.strip())
        self.assertEqual(props, ['font-size', 'padding'])
        for k in ('font', 'padY', 'padX'):
            self.assertIn('" + n.%s + "px * " + s + ")' % k, rules[0][1])

    def test_trim_keeps_stack_below_circles(self):
        js = NEWS_JS.split('(function () {')[0] + 'function _dtNewsTrim' + NEWS_JS.split('function _dtNewsTrim', 1)[1]
        ds = 720 / 1080
        # 1280x720: stack bottom 600 px (bottom var 120), top limit 570 * 2/3 = 380 -> 220 px of room.
        cases = [
            [720, ds, '120.0px', [40, 40, 40], 8 * ds],          # 136 px: all stay
            [720, ds, '120.0px', [75, 75, 75, 40], 8 * ds],      # 40+75+75 fits, the oldest 75 goes
            [720, ds, '120.0px', [40, 40, 40, 40, 40, 40, 40], 8 * ds],  # seven 1-line cards: 3 oldest go
            [720, ds, '120.0px', [400], 8 * ds],                 # the newest card always stays
            [640, 1024 / 1920, '128.0px', [61, 31, 31, 31], 8 * 1024 / 1920],  # 1024x640 letterbox: room 176
            [720, ds, '', [40, 40], 5],                          # no bottom yet: leave it to the game
            [720, ds, '120.0px', [[40, 'Saved'], [40, 'News'], [40, 'Saved']], 8 * ds],  # a repeat replaces the old card
            [720, ds, '120.0px', [[75, 'Saved'], [75, 'A'], [75, 'B'], [75, 'Saved']], 8 * ds],  # then the room rule
        ]
        r = subprocess.run(['node', '-e', TRIM_RUNNER % js, json.dumps(cases)], capture_output=True, text=True, check=True)
        self.assertEqual(json.loads(r.stdout), [[], [0], [2, 1, 0], [], [], [], [0], [0, 1]])

    def test_stack_hides_on_menus(self):
        # Offices show the stack; full-screen menus such as the copies screen (BATCH) hide it, also on a screen change.
        js = 'function _dtNewsTrim' + NEWS_JS.split('function _dtNewsTrim', 1)[1]
        runner = r'''
const document = { getElementById: () => host };
const cls = new Set(); const host = { classList: { toggle: (c, on) => on ? cls.add(c) : cls.delete(c) } };
let onStart = null;
globalThis.runtime = { layout: { name: "" }, addEventListener: (k, f) => { if (k === "beforeanylayoutstart") onStart = f; } };
%s
const out = [];
for (const n of JSON.parse(process.argv[1])) { runtime.layout.name = n; _dtNewsSync(host); out.push(cls.has("dt-news-away")); }
runtime.layout.name = "DESIGNER OFFICE 1"; _dtNewsSync(host);
onStart({ layout: { name: "BATCH" } }); out.push(cls.has("dt-news-away"));
console.log(JSON.stringify(out));
'''
        names = ['PROGRAMMER OFFICE 1', 'BOSS OFFICE', 'GAMEPLAY', 'BATCH', 'UPGRADE OFFICE', 'STATS', 'SMARTPHONE PAGE 3']
        r = subprocess.run(['node', '-e', runner % js, json.dumps(names)], capture_output=True, text=True, check=True)
        self.assertEqual(json.loads(r.stdout), [False, False, False, True, True, True, True, True])
        self.assertIn('#office-notifications.dt-news-away, html body.dt-panel-open #office-notifications { opacity: 0; }', NEWS_JS)

    def test_flag_off_is_byte_identical(self):
        # Modules added after NEWS are switched off in both builds so NEWS is the last step: the off build is
        # the chain without it, the on build is exactly transform(off).
        order = re.findall(r'"(DEVICES_TYCOON_[A-Z]+)"', (ROOT / 'build.py').read_text())
        with tempfile.TemporaryDirectory() as d:
            env = dict(os.environ)
            for flag in order[order.index('DEVICES_TYCOON_NEWS') + 1:]:
                env[flag] = 'off'
            subprocess.run(['python3', str(ROOT / 'build.py'), d + '/on'], check=True, capture_output=True, env=env)
            env['DEVICES_TYCOON_NEWS'] = 'off'
            subprocess.run(['python3', str(ROOT / 'build.py'), d + '/off'], check=True, capture_output=True, env=env)
            on = Path(d, 'on/scripts/c3main.js').read_text()
            off = Path(d, 'off/scripts/c3main.js').read_text()
            self.assertNotIn('_DT_NEWS', off)
            self.assertIn(patch.HOOK_OLD, off)
            self.assertEqual(patch.transform(off), on)
            for f in ('data.json',):
                self.assertEqual(Path(d, 'on', f).read_bytes(), Path(d, 'off', f).read_bytes(), f)


if __name__ == '__main__':
    unittest.main()
