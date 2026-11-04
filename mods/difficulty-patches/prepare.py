"""Difficulty patch: five per-company multipliers on the game's own formulas.

Wraps the demand and part-cost functions, scales the competitor market
targets and per-rival growth, scales research coin gains, adds a hook to
the office work planner and one to the office research bubble (research.js), and caps
the device depth sliders and their research by the calendar (thin.js), and
moves phone part dates and per-part price drops to real life (real.js).
Settings live in ArraySaves row 150 of the company's slot, next to the game's own JS rows (98, 102-114). A game update that renames or reshapes
these functions fails loudly here. Difficulty is edited in the game's own Settings page (settings.js:
a "Tycoon+" group built from its rows, saved with its Apply).
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent
UI = HERE.parent / 'mods-ui/ui.js'
ANCHOR = 'const w=Math.max(1,Math.round(h)),v={stage:e'
HOOK = 'h=_dtDiffBuild(h);'
# The office research bubble's coin value (276 GAMEPLAY, E19356): 1, or 2 with the lucky perk.
BUBBLE = 'return()=>1+(t(0,1)<LB(n.ExpObject(7,0),.05)?1:0)'
BUBBLE_HOOK = 'return()=>_dtResBubble(1+(t(0,1)<LB(n.ExpObject(7,0),.05)?1:0))'
# ArrayMyResearch[3] (Device Thickness), read only by the five page-1 depth "+" buttons (thin.js).
THIN = 'e=>{const t=e._GetNode(0);return()=>t.ExpObject(3)}'
THIN_HOOK = 'e=>{const t=e._GetNode(0);return()=>_dtThinCap(t.ExpObject(3))}'
# A spec part's age factor in the cost model (_compute4); real.js picks the yearly drop by part kind.
AGE = 'o=n*l(_yearOfDay3(u))*_ageFactor(a)}else if("perf"===t.k)'
AGE_HOOK = 'o=n*l(_yearOfDay3(u))*_dtRealAge(a,r,c,e)}else if("perf"===t.k)'
REQUIRED = (
    'function _potentialUnits(e,t,n,o,a,s,r,i,l)',
    '*_priceFactor(t,n,e,l)/(i>1?i:1)',  # cost is the second argument, judged against sell
    'function _compute4(e,t,n)',
    'if(_last16=o,!o.supported)return 0',  # computeDeviceCost writes o.total
    'function setRatingsConfig(e)',
    'NPC_MARKET_BASE_EARN_B:', 'NPC_MARKET_BASE_FANS_M:',
    'function _tickNpcRow(e,t,n,o)',  # rival growth hook
    'function _companyName(e)',  # stable per-rival seed
    'const f=Math.max(.01,m.pps),b=h/f',
    'function _officeStaff(e,t)', 'function _throughput(e,t)',  # research.js reads staff
    'function _inst45(e,t)', 'function _at41(e,t,n,o)', 'STAGES={design:{',
    'function _readRows(){',  # research page rows (thin.js, real.js)
    'function _ageFactor(e)', '_cfg12.COMPONENT_FLOOR', 'getDataMap',  # real.js
    'function saveArraysToFile(e,t,n)',  # difficulty.js saves row 150 (research allowance) first
    # settings.js: the game's Settings page parts it builds the Difficulty page from, and its draft / Apply.
    'function _renderNav(){', 'function _navItem(e,t,n,o,a){', 'function _renderMain(e){',
    'function _row14(e,t,n){', 'function _card(e){', 'function _slider(e,t,n,o,a,s,r){', 'function _el2(e,t,n){',
    'function _maskIcon(e,t,n){', 'function _readAll(){', 'function applyGameSettings(){', 'function _syncFooter(){',
    'function _t8(e){', '_page="general"', '_container15=null', '_draft=null,_saved=null',
    'gs-nav-item"+(_page===t?" gs-nav-on":"")',
    'if(s.dataset.page=t,',  # nav items carry their page id (the Video item is the anchor)
)
# ArraySaves rows the game's own JS already uses; row 150 must stay clear of them.
TAKEN_ROWS = ('_SAVE_ROW=98', 'MKT_HIST_ROW=102', 'HINT_SAVE_ROW=103', 'OFFICE_SAVE_ROW=114')


def transform(source):
    if '_dtDiffBuild' in source:
        raise ValueError('Difficulty patch already applied')
    if source.count(ANCHOR) != 1:
        raise ValueError('Expected exactly one bubble plan result line')
    if source.count(BUBBLE) != 1:
        raise ValueError('Expected exactly one research bubble value')
    if source.count(THIN) != 1:
        raise ValueError('Expected exactly one Device Thickness research expression')
    if source.count(AGE) != 1:
        raise ValueError('Expected exactly one spec part age factor')
    missing = [r for r in REQUIRED + TAKEN_ROWS if r not in source]
    if missing:
        raise ValueError('Difficulty hooks changed: ' + ', '.join(missing))
    if 'ROW=150' in source:
        raise ValueError('ArraySaves row 150 is now used by the game')
    body = '\n;\n'.join((HERE / f).read_text() for f in ('difficulty.js', 'settings.js', 'research.js', 'thin.js', 'real-data.js', 'real.js'))
    ui = '' if 'var _dtUi =' in source else UI.read_text() + '\n;\n'
    core = source.replace(ANCHOR, HOOK + ANCHOR).replace(BUBBLE, BUBBLE_HOOK).replace(THIN, THIN_HOOK).replace(AGE, AGE_HOOK)
    return core + '\n;\n' + ui + body
