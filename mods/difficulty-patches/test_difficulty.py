import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('difficulty_patch', HERE / 'prepare.py')
patch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patch)
DATA = ROOT / 'game-files/data.json'
C3MAIN = ROOT / 'game-files/scripts/c3main.js'
UI = ROOT / 'mods/mods-ui/ui.js'


class DifficultyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text()

    def test_source_match_and_reversibility(self):
        candidate = patch.transform(self.source)
        body = '\n;\n'.join((HERE / f).read_text() for f in ('difficulty.js', 'settings.js', 'research.js', 'thin.js', 'real-data.js', 'real.js'))
        app = '\n;\n' + UI.read_text() + '\n;\n' + body
        core = (self.source.replace(patch.ANCHOR, patch.HOOK + patch.ANCHOR).replace(patch.BUBBLE, patch.BUBBLE_HOOK)
                .replace(patch.THIN, patch.THIN_HOOK).replace(patch.AGE, patch.AGE_HOOK))
        self.assertEqual(candidate, core + app)
        self.assertEqual(candidate.count(patch.HOOK), 1)
        self.assertEqual(candidate.count(patch.HOOK + patch.ANCHOR), 1)
        self.assertEqual(candidate.count(patch.BUBBLE_HOOK), 1)
        self.assertEqual(candidate.removesuffix(app), core)
        self.assertEqual(candidate.count(patch.THIN_HOOK), 1)
        self.assertEqual(candidate.count(patch.AGE_HOOK), 1)
        self.assertEqual(core.replace(patch.HOOK + patch.ANCHOR, patch.ANCHOR).replace(patch.BUBBLE_HOOK, patch.BUBBLE)
                         .replace(patch.THIN_HOOK, patch.THIN).replace(patch.AGE_HOOK, patch.AGE), self.source)

    def test_presets_renamed_and_recommended(self):
        body = (HERE / 'difficulty.js').read_text()
        self.assertIn('realistic: { buy: 1, cost: 1, research: 0.3, rivals: 1.1, build: 1 }', body)
        self.assertIn('brutal: { buy: 0.85, cost: 1.1, research: 0.25, rivals: 1.5, build: 1 }', body)
        self.assertIn('realistic: { en: "Realistic", ru: "Реалистично" }', body)
        self.assertIn('_DT_DIFF_RECOMMENDED = "realistic"', body)
        self.assertIn('_DT_DIFF_LEGACY_PRESETS = { harder: "realistic" }', body)
        self.assertNotIn('harder: { buy:', body)
        self.assertIn('build: [0.25, 2]', body)
        self.assertIn('until ~year 31', body)
        self.assertNotIn('until ~year 22', body)

    def test_rival_formula_buy_only_and_sqrt_growth(self):
        body = (HERE / 'difficulty.js').read_text()
        self.assertIn('const factor = _dtDiff.buy;', body)
        self.assertNotIn('const factor = _dtDiff.buy * _dtDiff.rivals;', body)
        self.assertIn('_DT_RIVAL_GROWTH_EXP = 0.5', body)
        self.assertIn('_DT_RIVAL_VARIETY_MIN = 0.9', body)
        self.assertIn('_DT_RIVAL_VARIETY_MAX = 1.12', body)
        self.assertIn('_DT_RIVAL_GROWTH_DAMP = 0.7', body)
        self.assertIn('return 1 + (raw - 1) * _DT_RIVAL_GROWTH_DAMP;', body)
        self.assertIn('Math.imul(h, 16777619)', body)

    def test_refuses_double_application(self):
        candidate = patch.transform(self.source)
        with self.assertRaises(ValueError):
            patch.transform(candidate)
        with self.assertRaises(ValueError):
            patch.transform(self.source + '\n' + patch.HOOK)

    def test_required_anchors_drift(self):
        cases = {
            'duplicate anchor': self.source + '\n' + patch.ANCHOR,
            'missing anchor': self.source.replace(patch.ANCHOR, 'drifted result line'),
            'missing potential units': self.source.replace(
                'function _potentialUnits(e,t,n,o,a,s,r,i,l)', 'function _potentialUnits2(e,t,n,o,a,s,r,i,l)'),
            'missing cost formula': self.source.replace(
                '*_priceFactor(t,n,e,l)/(i>1?i:1)', '*_priceFactor2(t,n,e,l)/(i>1?i:1)'),
            'missing compute4': self.source.replace('function _compute4(e,t,n)', 'function _cost4(e,t,n)'),
            'missing ratings config': self.source.replace(
                'function setRatingsConfig(e)', 'function setRatingsConfig2(e)'),
            'missing market base': self.source.replace(
                'NPC_MARKET_BASE_EARN_B:', 'NPC_MARKET_BASE_EARN_C:'),
            'missing npc tick': self.source.replace(
                'function _tickNpcRow(e,t,n,o)', 'function _tickNpcRow2(e,t,n,o)'),
            'missing company name': self.source.replace(
                'function _companyName(e)', 'function _companyName2(e)'),
            'missing planner': self.source.replace(
                'const f=Math.max(.01,m.pps),b=h/f', 'const f=Math.max(.01,m.pps),b=h/g'),
            'row already used': self.source + '\n// ROW=150',
            'missing research bubble': self.source.replace(patch.BUBBLE, 'return()=>1'),
            'missing office staff': self.source.replace('function _officeStaff(e,t)', 'function _staff2(e,t)'),
            'missing thickness research': self.source.replace(patch.THIN, 'e=>{const t=e._GetNode(0);return()=>t.ExpObject(4)}'),
            'duplicate thickness research': self.source + '\n' + patch.THIN,
            'missing research rows': self.source.replace('function _readRows(){', 'function _readRows2(){'),
            'missing spec age factor': self.source.replace(patch.AGE, patch.AGE.replace('_ageFactor(a)', '_ageFactor(a+0)')),
            'duplicate spec age factor': self.source + '\n' + patch.AGE,
            'missing age factor function': self.source.replace('function _ageFactor(e)', 'function _ageFactor2(e)'),
            'missing settings nav': self.source.replace('function _renderNav(){', 'function _renderNav2(){'),
            'missing settings slider': self.source.replace('function _slider(e,t,n,o,a,s,r){', 'function _slider(e,t,n,o,a,s){'),
            'missing settings apply': self.source.replace('function applyGameSettings(){', 'function applySettings(){'),
            'missing settings draft': self.source.replace('_draft=null,_saved=null', '_draft=null,_kept=null'),
        }
        for why, invalid in cases.items():
            with self.assertRaises(ValueError, msg=why):
                patch.transform(invalid)

    def test_patched_script_parses_after_other_patches(self):
        def load(name, path):
            s = importlib.util.spec_from_file_location(name, path)
            m = importlib.util.module_from_spec(s)
            s.loader.exec_module(m)
            return m
        template = load('template', ROOT / 'mods/template-patches/prepare.py')
        speed = load('speed', ROOT / 'mods/speed-patches/prepare.py')
        launch = load('launch', ROOT / 'mods/launch-patches/prepare.py')
        map_json = template.build_map(str(DATA), str(C3MAIN))
        source = self.source
        source = template.transform(source, map_json)
        source = speed.transform(source)
        source = launch.transform(source)
        source = patch.transform(source)
        self.assertEqual(source.count(patch.HOOK + patch.ANCHOR), 1)
        with tempfile.NamedTemporaryFile('w', suffix='.js') as f:
            f.write(source)
            f.flush()
            subprocess.run(['node', '--check', f.name], check=True)

    def test_settings_page_not_office_chip(self):
        body = (HERE / 'difficulty.js').read_text()
        self.assertNotIn('chip(', body)
        self.assertNotIn('modal(', body)
        page = (HERE / 'settings.js').read_text()
        self.assertIn('_DT_DIFF_PAGE = "dt-difficulty"', page)
        self.assertIn('Load a company to change its difficulty', page)

    def test_runtime_behaviour(self):
        subprocess.run(['node', str(HERE / 'test_difficulty_runtime.js'), str(HERE / 'difficulty.js')], check=True)
        subprocess.run(['node', str(HERE / 'test_settings_runtime.js'), str(HERE / 'difficulty.js'),
                        str(HERE / 'settings.js')], check=True)
        subprocess.run(['node', str(HERE / 'test_research_runtime.js'), str(HERE / 'difficulty.js'),
                        str(HERE / 'research.js')], check=True)
        subprocess.run(['node', str(HERE / 'test_thin_runtime.js'), str(HERE / 'difficulty.js'),
                        str(HERE / 'research.js'), str(HERE / 'thin.js')], check=True)
        subprocess.run(['node', str(HERE / 'test_real_runtime.js'), str(HERE / 'difficulty.js'),
                        str(HERE / 'research.js'), str(HERE / 'real-data.js'), str(HERE / 'real.js')], check=True)

    def test_real_data_matches_generator(self):
        # real-data.js is generated; the fixed approved points must be in it.
        body = (HERE / 'real-data.js').read_text()
        self.assertIn('"ArrayScreenRefreshRate_Smartphone":{"col":1,"rows":{"2":4136,"3":4136', body)
        self.assertIn('"ArrayWaterproof_Smartphone":{"col":2', body)
        self.assertIn('"ArrayROMType_Smartphones":{"col":4', body)
        self.assertIn('"526":{"old":1190,"day":2829,"key":"Fingerprint Back (Smartphone)"}', body)


if __name__ == '__main__':
    unittest.main()
