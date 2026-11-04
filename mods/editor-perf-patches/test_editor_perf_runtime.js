// Runs the patched smartphone editor scheduler (cut from the real c3main.js) with stub views.
// Usage: node test_editor_perf_runtime.js snippet.js
const fs = require('fs');
const assert = require('assert');
const snippet = fs.readFileSync(process.argv[2], 'utf8');
function setup(withRuntime, sized) {
  const log = [], rafs = [], handlers = {};
  const inst = (w) => ({ surfaceDeviceWidth: sized ? w : 0, surfaceDeviceHeight: sized ? 690 : 0, width: w, height: 690 });
  const env = {
    log, rafs, handlers,
    requestAnimationFrame: (f) => rafs.push(f),
    runtime: withRuntime ? { addEventListener: (k, f) => { (handlers[k] = handlers[k] || []).push(f); } } : undefined,
  };
  const make = new Function('env', `
    const requestAnimationFrame = env.requestAnimationFrame;
    globalThis.runtime = env.runtime;
    let state = 1;
    var _views = { top: { inst: env.top, draw: (w, h) => { env.log.push('top' + state + ':' + w); return {}; } },
                   side: { inst: env.side, draw: (w, h) => { env.log.push('side' + state + ':' + w); return {}; } } };
    var _dirtyViews = new Set(), _redrawScheduled = !1;
    function _positionTilesNow() {} function _syncStateToArray() {} function _writePixels() { env.log.push('write'); }
    function _positionTiles() {} function _hideVideoInst() {} function _videoScreenActive() { return !1; }
    function _logoRGBActive() { return !1; } function _startVideoLoop() {} function _startLogoRGBLoop() {}
    ${snippet}
    return { tap: (v) => { state = v; _scheduleRedraw(); } };`);
  env.top = inst(660); env.side = inst(440);
  return { env, ed: make(env) };
}
const flushMicro = () => new Promise((r) => setTimeout(r, 0));
(async () => {
  // Two taps in one frame: one redraw of both views with the last value, done inside tick2 (no await).
  let { env, ed } = setup(true, true);
  ed.tap(2); ed.tap(3);
  assert.deepStrictEqual(env.log, []);
  env.handlers.tick2.forEach((f) => f());
  assert.deepStrictEqual(env.log, ['top3:660', 'write', 'side3:440', 'write']);
  env.rafs.splice(0).forEach((f) => f()); await flushMicro();
  assert.strictEqual(env.log.length, 4, 'rAF fallback must not redraw again');
  ed.tap(4); env.handlers.tick2.forEach((f) => f());
  assert.deepStrictEqual(env.log.slice(4), ['top4:660', 'write', 'side4:440', 'write']);
  assert.strictEqual(env.handlers.tick2.length, 1, 'one tick2 listener');
  // No Construct runtime: the old requestAnimationFrame path still draws.
  ({ env, ed } = setup(false, true));
  ed.tap(5); env.rafs.splice(0).forEach((f) => f()); await flushMicro();
  assert.deepStrictEqual(env.log, ['top5:660', 'write', 'side5:440', 'write']);
  // Size not known yet: falls back to the game's async size lookup and still draws.
  ({ env, ed } = setup(true, false));
  ed.tap(6); env.handlers.tick2.forEach((f) => f()); await flushMicro();
  assert.strictEqual(env.log.filter((x) => x === 'write').length, 2);
  assert.ok(env.log[0].startsWith('top6:'));
  console.log('ok editor perf runtime');
})().catch((e) => { console.error(e); process.exit(1); });
