"""Compare patch: two devices side by side from the My Devices screens.

Appends compare.js to c3main.js after the next patch. The rows come from the
game's own My<Type>Show event functions (read back from ArrayMyDevices_Temp the
way showMyDevicesTable reads it), so this checks that those functions, the
arrays and the table reader are still there and fails the build loudly if a
game update renames them.
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
PORT = HERE.parent.parent
UI = HERE.parent / 'mods-ui/ui.js'
# The My Devices page look Compare and the Sales board share (whichever is built first brings it).
PAGE = HERE.parent / 'mods-ui/mdpage.js'
DATA = PORT / 'game-files/data.json'
# What compare.js relies on in the game JS: the My Devices table reader
# (two columns, transposed when width is 2) and the editor renderers handing
# their pixels to a DrawingCanvas through loadImagePixelData.
REQUIRED_JS = (
    'var _EL_NAME2="HTMLElement_MyDevices",_ARR_NAME="ArrayMyDevices_Temp"',
    'a=2===n&&o>2,s=a?o:n',
    'globalThis.showMyDevicesTable=showMyDevicesTable',
    'const n=["loadImagePixelData","putImagePixelData","setImagePixelData"];for(const o of n)if("function"==typeof e[o])return e[o](t),!0;',
    'globalThis.redrawSmartphone=redrawSmartphone',
    'globalThis.redrawLaptop=redrawLaptop',
    'globalThis.redrawTablet=redrawTablet',
)


def type_names(js):
    """(array, show, draw) names from the _DT_CMP_TYPES table in compare.js."""
    rows = re.findall(r'arr: "(\w+)", show: "(\w+)", draw: "(\w*)"', js)
    if len(rows) != 11:
        raise ValueError('compare.js type table changed: %d rows' % len(rows))
    return rows


def check_data(data_text, js):
    names = set(re.findall(r'"([A-Za-z_][A-Za-z0-9_]*)"', data_text))
    need = {'ArrayMyDevices_Temp', 'SubPage', 'MiniPage', 'DeviceShowFlagmanID'}
    for arr, show, draw in type_names(js):
        need.update(n for n in (arr, show, draw) if n)
    missing = sorted(need - names)
    if missing:
        raise ValueError('Compare: game data lost ' + ', '.join(missing))


def transform(source, data_text=None):
    if '_dtCmpOpen' in source:
        raise ValueError('Compare patch already applied')
    missing = [r for r in REQUIRED_JS if r not in source]
    if missing:
        raise ValueError('Compare: game JS changed; missing ' + ' | '.join(m[:40] for m in missing))
    body = (HERE / 'compare.js').read_text()
    check_data(data_text if data_text is not None else DATA.read_text(), body)
    ui = '' if 'var _dtUi =' in source else UI.read_text() + '\n;\n'
    if 'var _dtMdp =' not in source:
        ui += PAGE.read_text() + '\n;\n'
    return source + '\n;\n' + ui + body
