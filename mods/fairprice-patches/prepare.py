"""Fair price reviews: the review price card judges the markup against what the
device offers in its year (fairprice.js), outside the Original preset.

The 10 device review engines (282 REVIEWS) share one compiled expression for
the markup, (SELL * 100 / COST) - 100, used by all 80 of their price checks and
nowhere else. Its body is wrapped in _dtFairReview(markup, cost, name), which
gives the same number back when the rule is off, and fairprice.js is appended
after the board patch. The band table and the editor -> review type map come
from the shipped engines (skip-patches/bands.py). A game update that changes
the expression, its uses or the cost model fails the build loudly.
"""
import importlib.util
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
PORT = HERE.parent.parent
DATA = PORT / 'game-files/data.json'
_spec = importlib.util.spec_from_file_location('dt_fair_bands', HERE.parent / 'skip-patches/bands.py')
bands = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bands)

# The markup expression of every review price check (282 REVIEWS, e.g. 1485-1494, 3511-3515).
MARKUP = ('e=>{const t=e._GetNode(0),n=e._GetNode(1).GetVar(),o=e._GetNode(2),a=e._GetNode(3).GetVar();'
          'return()=>BB(FB(LB(t.ExpObject(0,n.GetValue(),4),100),o.ExpObject(0,a.GetValue(),3)),100)}')
OLD = 'return()=>BB(FB(LB(t.ExpObject(0,n.GetValue(),4),100),o.ExpObject(0,a.GetValue(),3)),100)}'
NEW = ('return()=>_dtFairReview(BB(FB(LB(t.ExpObject(0,n.GetValue(),4),100),o.ExpObject(0,a.GetValue(),3)),100),'
       'o.ExpObject(0,a.GetValue(),3),t.ExpObject(0,n.GetValue(),8))}')
CHECKS = 80  # 10 engines x 8 tests: 5 in the 3 events before the shuffle, 3 in the 2 after it
# Cost model pieces fairprice.js reads (c3main.js, _compute4 and helpers).
REQUIRED_JS = (
    'ANCHOR_FIRST_YEAR=2008,ANCHOR=[175,',
    '_cfg12={K:1.55,',
    'function _anchorAt(e,t){',
    'var _yearOfDay3=e=>ANCHOR_FIRST_YEAR+Math.floor(Math.max(0,e-1)/365)',
    'function _today(e){',
    'TABLES={SMARTPHONE:{items:SMARTPHONE_ITEMS',
    'const o=String(t??_gv21(e,"DeviceType","SMARTPHONE")).toUpperCase(),a=TABLES[o],s=void 0===n?_today(e):n,r=_yearOfDay3(s),i=a&&a.anchor?a.anchor:ANCHOR,l=e=>_anchorAt(i,e),c=a&&Number.isFinite(a.K)?a.K:_cfg12.K,d=l(r)',
)
REQUIRED_DATA = ('"ArraySaves"', '"SaveSlot"', '"CompanyName"', '"DeviceTypeCreatingNow"', '"DeviceType"', '"DeviceName"',
                 '"DevicePrice"', '"DeviceCostPrice"', '"EDITOR PRICE PAGE"', '"DayTotal"')
ROW = 155


def editor_map(data_text, source):
    """{editor DeviceType: DeviceTypeCreatingNow} for the types whose engine has a price card."""
    t = bands.extract(data_text, source)
    editor = t['editor']
    if len(editor) != 10 or sorted(editor.values()) != sorted(t['types']):
        raise ValueError('Fair price: review types changed: %r' % editor)
    return editor


def check_uses(data_text, source):
    """The markup expression is one entry of C3_ExpressionFuncs, used only by the review price checks."""
    exprs = bands.split_exprs(source)
    idx = [i for i, e in enumerate(exprs) if e == MARKUP]
    if len(idx) != 1:
        raise ValueError('Fair price: markup expression found %d times' % len(idx))
    uses = re.findall(r'\[7,\[%d[,\]]' % idx[0], data_text)
    if len(uses) != CHECKS:
        raise ValueError('Fair price: markup expression used %d times, expected %d' % (len(uses), CHECKS))
    return idx[0]


def transform(source, data_text=None):
    if 'var _DT_FAIR =' in source or '_dtFairReview(' in source:
        raise ValueError('Fair price patch already applied')
    missing = [r for r in REQUIRED_JS if source.count(r) != 1]
    if missing:
        raise ValueError('Fair price: game JS changed; missing ' + ' | '.join(m[:48] for m in missing))
    data_text = data_text if data_text is not None else DATA.read_text()
    lost = [r for r in REQUIRED_DATA if r not in data_text]
    if lost:
        raise ValueError('Fair price: game data lost ' + ', '.join(lost))
    for taken in ('_ROW = %d' % ROW, 'ROW=%d' % ROW, '_ROW=%d' % ROW):
        if taken in source:
            raise ValueError('Fair price: ArraySaves row %d is taken' % ROW)
    editor = editor_map(data_text, source)
    check_uses(data_text, source)
    if source.count(OLD) != 1:
        raise ValueError('Fair price: markup expression body found %d times' % source.count(OLD))
    body = (HERE / 'fairprice.js').read_text()
    if body.count('__DT_FAIR_EDITOR__') != 1:
        raise ValueError('fairprice.js table placeholder missing')
    body = body.replace('__DT_FAIR_EDITOR__', json.dumps(editor, sort_keys=True, separators=(',', ':')))
    return source.replace(OLD, NEW, 1) + '\n;\n' + body
