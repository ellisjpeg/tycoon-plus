"""Build speed patch: scales each office stage's work by the office's strength.

Hooks the game's own bubble planner (computeBubblesPlan) right after it has
clamped the stage time, so every caller (development, batches, chips, OS,
software) gets the same rule. A game update that reshapes the planner fails
loudly here instead of silently building at the old speed.
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent
ANCHOR = 'const w=Math.max(1,Math.round(h)),v={stage:e'
HOOK = 'h=_dtSpeedPlan(h,f,_,e,i);'
# The planner's locals the hook relies on: h work, f points/sec, _ staff, e stage, i weight.
REQUIRED = (
    'const f=Math.max(.01,g.pps),b=h/f',
    '_=_officeStaff(o,a),g=_throughput(',
    'function computeBubblesPlan(e,t){const n=t||{},o=_runtime26(n.runtime),a=STAGES[e]',
    'i=_clamp11(Number.isFinite(n.weight)?Number(n.weight):1,.01,3)',
    'MIN_SEC:12,MAX_SEC:40',
)


def transform(source):
    if '_dtSpeedPlan' in source:
        raise ValueError('Speed patch already applied')
    if source.count(ANCHOR) != 1:
        raise ValueError('Expected exactly one bubble plan result line')
    missing = [r for r in REQUIRED if source.count(r) != 1]
    if missing:
        raise ValueError('Bubble planner changed: ' + ', '.join(missing))
    body = (HERE / 'speed.js').read_text()
    return source.replace(ANCHOR, HOOK + ANCHOR) + '\n;\n' + body
