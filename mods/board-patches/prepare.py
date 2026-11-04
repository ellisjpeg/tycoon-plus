"""Board patch: one read-only sales board for every device on sale.

Appends board.js to c3main.js after the skip patch. board.js reads the device
arrays the daily sales engine writes (SOLDED, CREATED, POP, SELL, COST), the
game's own profit figure (_slotProfit) and restock gate (_handleBatchSoldOut),
and pages to a device the way the game's arrows do (SubPage, edition, the
screen's My<Type>UI function). A game update that changes any of that fails
the build loudly.
"""
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
PORT = HERE.parent.parent
UI = HERE.parent / 'mods-ui/ui.js'
# The My Devices page look Compare and the Sales board share (whichever is built first brings it).
PAGE = HERE.parent / 'mods-ui/mdpage.js'
DATA = PORT / 'game-files/data.json'
REQUIRED_JS = (
    # Device columns; the day loop moves DayTotal on and calls the tick by name.
    'var Z13={CREATED:0,SOLDED:1,POP:2,COST:3,SELL:4,RATING:5,HYPE:6,RELEASE:7,NAME:8}',
    'EventGameplay_Event448_Act1(e,t){tickDeviceSales(e.globalVars.DayTotal,e)',
    'function tickDeviceSales(e,t){',
    # Units sold are added to SOLDED; only released, POP > 0 rows sell.
    'g.setAt(A+l,b,x,Z13.SOLDED)',
    'const C=g.getAt(b,x,Z13.RELEASE);if(C<0||C>o)continue;let T=g.getAt(b,x,Z13.POP);if(T<=0)',
    # Profit as the office shows it.
    'function _slotProfit(e){const t=e.sell-e.cost;return Math.round(e.solded*(t>0?t:0))}',
    # Restock gate: contract or self restock, minimum POP, price above unit cost + fee.
    'const n=t?Number(t.getAt(1,0,0)):NaN;d.contractEnd=isFinite(n)?n:-999}const b=a<=d.contractEnd,y=!b&&c.RESTOCK_SELF',
    'if((b||y)&&r>=c.RESTOCK_MIN_POP){const a=t.getAt(n,o,Z13.COST),u=y?c.RESTOCK_FEE_SELF:c.RESTOCK_FEE,m=a>0?a*(1+u):0;if(m>0&&l>m)',
    '_handleBatchSoldOut(n,g,b,x,o,N,T,O,M,a,m,k,U,W,B)',
    'RESTOCK_SELF:!0',
    'RESTOCK_MIN_POP:3',
)


def type_names(js):
    """(class, array, ui) names from the _DT_BOARD_TYPES table in board.js."""
    rows = re.findall(r'cls: "([A-Z ]+)", arr: "(\w+)", ui: "(\w+)"', js)
    if len(rows) != 10:
        raise ValueError('board.js type table changed: %d rows' % len(rows))
    return rows


def check_data(data_text, js):
    names = set(re.findall(r'"([A-Za-z_][A-Za-z0-9_ ]*)"', data_text))
    need = {'ArraySaves', 'ArrayBatchCompany', 'SubPage', 'MiniPage', 'DeviceShowFlagmanID', 'ColorChoose',
            'SaveSlot', 'CompanyName', 'DayTotal', 'class', 'LastClass', 'MY GAMEPADS'}
    for cls, arr, ui in type_names(js):
        need.update((cls, arr, ui))
    missing = sorted(need - names)
    if missing:
        raise ValueError('Board: game data lost ' + ', '.join(missing))


def check_paging(dump_dir=None):
    """The game's own arrows page by SubPage, reset the edition and call My<Type>UI."""
    d = Path(dump_dir) if dump_dir else PORT / 'game-files/dump'
    f = d / '084 MY SMARTPHONES.txt'
    if not f.is_file():
        return  # dump not shipped with every checkout; data.json check above still runs
    t = f.read_text()
    for need in ('System.Acts.AddVar($SubPage, E29{1})', 'System.Acts.SetVar($DeviceShowFlagmanID, E0{0})',
                 'CALL MySmartphonesUI(', 'System.Acts.SetVar($SubPage, E29{1})'):
        if need not in t:
            raise ValueError('Board: smartphone screen paging changed: ' + need)


def transform(source, data_text=None):
    if 'var _DT_BOARD_COL' in source:
        raise ValueError('Board patch already applied')
    missing = [r for r in REQUIRED_JS if r not in source]
    if missing:
        raise ValueError('Board: game JS changed; missing ' + ' | '.join(m[:48] for m in missing))
    body = (HERE / 'board.js').read_text()
    check_data(data_text if data_text is not None else DATA.read_text(), body)
    check_paging()
    ui = '' if 'var _dtUi =' in source else UI.read_text() + '\n;\n'
    if 'var _dtMdp =' not in source:
        ui += PAGE.read_text() + '\n;\n'
    return source + '\n;\n' + ui + body
