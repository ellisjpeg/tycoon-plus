"""Rivals patch: rival companies launch devices.

Appends rivals-core.js (pure schedule and spec picker), rivals.js (daily
processor, ArraySaves row 157, tickDeviceSales wrapper, _dtRivApi) and, when
the Rivals tab file is there, rivals-ui.js, after every other c3main.js patch.
rivals.js wraps tickDeviceSales and reads the difficulty preset through
_dtResShipped, the part lists the core names and the Ratings reader, so a game
update or a module that renames any of those, a missing part list in
data.json, or another module declaring save row 157 fails the build loudly.
"""
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
PORT = HERE.parent.parent
UI = HERE.parent / 'mods-ui/ui.js'
DATA = PORT / 'game-files/data.json'
ROW = 157
FILES = ('rivals-core.js', 'rivals.js', 'rivals-ui.js')  # rivals-ui.js (the Rivals tab) is optional
REQUIRED_JS = (
    # Device columns and the day loop calling the tick by name.
    'var Z13={CREATED:0,SOLDED:1,POP:2,COST:3,SELL:4,RATING:5,HYPE:6,RELEASE:7,NAME:8}',
    'EventGameplay_Event449_Act1(e,t){tickDeviceSales(e.globalVars.DayTotal,e)',
    'function tickDeviceSales(e,t){',
    # POP 0 is "not selling": the tick skips it (the effect never goes below 0).
    'if(T<=0){T<0&&m.setAt(0,b,x,Z13.POP)',
    # Ratings reader: launches only while the company is active that year.
    'function _readCompanies(){',
    'function _companyName(e){',
)
# A save row declared by a module: `_ROW = 157`, `ROW: 157`, `row: 157`.
ROW_DECL = re.compile(r'(?:\b\w*_ROW\b|\bROW\b|\brow\b)\s*[:=]\s*(\d+)\b')


def table_names(core):
    names = sorted(set(re.findall(r'\{ t: "(\w+)", c: \d', core)))
    if len(names) < 30:
        raise ValueError('rivals-core.js type table changed: %d lists' % len(names))
    return names


def check_data(data_text, core):
    names = set(re.findall(r'"([A-Za-z_][A-Za-z0-9_]*)"', data_text))
    need = {'ArraySaves', 'ArrayRatingsCompanies', 'ArrayCompanyNames', 'SaveSlot', 'CompanyName', 'DayTotal',
            'ArraySmartphones', 'ArrayLaptops', 'ArrayTablets', 'ArrayHeadphones', 'ArrayWatches', 'ArrayTV',
            'ArrayScooters', 'ArrayKeyboards', 'ArrayConsoles', 'ArrayVRConsoles'}
    need.update(table_names(core))
    missing = sorted(need - names)
    if missing:
        raise ValueError('Rivals: game data lost ' + ', '.join(missing))


def row_owners(text):
    """Save rows declared in JS text."""
    return {int(n) for n in ROW_DECL.findall(text)}


def check_row(source):
    """Row 157 must be ours alone: not in the patched source, not in any other patch folder."""
    if ROW in row_owners(source):
        raise ValueError('Rivals: ArraySaves row %d is already declared by another module' % ROW)
    for js in sorted(HERE.parent.glob('*-patches/*.js')):
        if js.parent == HERE or js.name.startswith('test_'):
            continue
        if ROW in row_owners(js.read_text()):
            raise ValueError('Rivals: ArraySaves row %d is declared by %s' % (ROW, js.relative_to(HERE.parent)))
    own = (HERE / 'rivals.js').read_text()
    if own.count('var _DT_RIV_ROW = %d;' % ROW) != 1:
        raise ValueError('Rivals: rivals.js must declare row %d once' % ROW)


def block():
    """The bytes this patch appends (after the shared UI, when that is added)."""
    out = ''
    for name in FILES:
        p = HERE / name
        if p.exists():
            out += '\n;\n' + p.read_text()
    return out


def transform(source, data_text=None):
    if 'var _DT_RIV_ROW' in source:
        raise ValueError('Rivals patch already applied')
    missing = [r for r in REQUIRED_JS if r not in source]
    if missing:
        raise ValueError('Rivals: game JS changed; missing ' + ' | '.join(m[:48] for m in missing))
    # The preset is read through difficulty: if that module is in, its reader must be too.
    if 'var _DT_DIFF_KEYS' in source and 'function _dtResShipped(' not in source:
        raise ValueError('Rivals: difficulty renamed _dtResShipped')
    core = (HERE / 'rivals-core.js').read_text()
    check_data(data_text if data_text is not None else DATA.read_text(), core)
    check_row(source)
    ui = '' if 'var _dtUi =' in source else '\n;\n' + UI.read_text()
    return source + ui + block()
