"""Tests for the editor perf patch (python3 mods/editor-perf-patches/test_editor_perf.py)."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import prepare  # noqa: E402

C3MAIN = HERE.parents[1] / 'game-files/scripts/c3main.js'


class EditorPerfTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = C3MAIN.read_text()
        cls.out = prepare.transform(cls.source)

    def test_patches_both_editors(self):
        for s in ('', '2'):
            self.assertIn(f'_dtEdSchedule{s}(t)}}function ', self.out)
            self.assertIn(f'if((_dtEdSizeNow{s}(e)||await _ensureSize{s}(e))&&e.w&&e.h)', self.out)
        self.assertEqual(self.out.count('requestAnimationFrame(t):Promise.resolve().then(t)}'), 0)
        # The other editors (laptop, watch, ...) use their own retry scheduler and stay as they are.
        self.assertIn('function _scheduleRedraw4(e){', self.out)

    def test_front_only_steppers(self):
        for s in ('', '2'):
            self.assertIn(f'c(),_scheduleRedraw{s}(_TOP_ONLY_PARAMS{s}.has(e.id)?"top":void 0)}};return a.addEventListener', self.out)
            # Steppers that rebuild the page keep redrawing both views, as before.
            self.assertRegex(self.out, rf'return _render\d+\(\),void _scheduleRedraw{s}\(\);c\(\),_scheduleRedraw{s}\(_TOP')

    def test_scratch_canvas_per_size(self):
        import re
        for s in ('', '2', '3'):
            self.assertIn(f'var _dtEdCv{s}={{}},_scratchCv{s}=null,', self.out)
            self.assertNotIn(f'_scratchCv{s}.width=e', self.out)
            # Nothing else reads the old shared canvas.
            self.assertEqual(len(re.findall(rf'\b_scratchCv{s}\b', self.source)), 8)
        self.assertIn('_scratchCv4.width=e', self.out)  # TV has one view; left alone

    def test_scratch_runtime(self):
        o = self.out
        a = o.index('function _scratchCtx(e,t){')
        b = o.index('c.reset(),c}', a) + len('c.reset(),c}')
        js = ('''let made = 0, resets = 0;
const document = { createElement: () => { made++; const cv = { getContext: (k, o) => (o.willReadFrequently ? cv.ctx : null) };
  cv.ctx = { canvas: cv, reset: () => resets++ }; return cv; } };
var _dtEdCv = {}, _scratchCv = null, _scratchCtx2d = null, _scratchCanReset = true;
''' + o[a:b] + '''
const t1 = _scratchCtx(660, 690), s1 = _scratchCtx(440, 690), t2 = _scratchCtx(660, 690), s2 = _scratchCtx(440, 690);
if (t1 !== t2 || s1 !== s2 || t1 === s1 || made !== 2 || resets !== 4) throw new Error('reuse ' + made + ' ' + resets);
if (t1.canvas.width !== 660 || s1.canvas.height !== 690 || _scratchCv !== s1.canvas) throw new Error('size');
_scratchCtx(100, 100);
if (Object.keys(_dtEdCv).length !== 2) throw new Error('kept ' + Object.keys(_dtEdCv));
console.log('ok scratch');
''')
        r = subprocess.run(['node', '-e', js], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
        self.assertIn('ok scratch', r.stdout)

    def test_sol_modifier_lookup(self):
        import subprocess
        src = prepare.SOL_NEW.replace('HasSolModifier(e)', 'function has(e)').replace('this.', 'self.')
        js = ("const self={_solModifiers:[]};" + src + ";const a={},b={},c={};"
              "const out=[has(a)];self._solModifiers.push(a);out.push(has(a),has(b));"
              "self._solModifiers=[b,c];out.push(has(a),has(b),has(c));console.log(JSON.stringify(out))")
        r = subprocess.run(['node', '-e', js], capture_output=True, text=True, check=True)
        self.assertEqual(r.stdout.strip(), '[false,true,false,false,true,true]')

    def test_fails_loudly_on_reshaped_game(self):
        broken = self.source.replace('if(await _ensureSize2(e)&&e.w&&e.h)', 'if(await _ensureSize2(e))')
        with self.assertRaises(RuntimeError):
            prepare.transform(broken)
        broken = self.source.replace('c(),_scheduleRedraw2()};return a.addEventListener', 'c(),_scheduleRedraw2(1)};return a.addEventListener')
        with self.assertRaises(RuntimeError):
            prepare.transform(broken)

    def test_runtime(self):
        o = self.out
        start = o.index('var _dtEdPending=')
        end = o.index('}function ', o.index('function _scheduleRedraw(e){')) + 1
        a = o.index('function _surfaceSize(e){')
        b = o.index('var _IS_LE', a)
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
            f.write(o[start:end] + '\n' + o[a:b])
        r = subprocess.run(['node', str(HERE / 'test_editor_perf_runtime.js'), f.name], capture_output=True, text=True)
        Path(f.name).unlink()
        self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
        self.assertIn('ok editor perf runtime', r.stdout)


if __name__ == '__main__':
    unittest.main()
