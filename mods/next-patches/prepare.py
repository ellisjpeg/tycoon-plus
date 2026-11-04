"""Next patch: "Next: 90 Hz, May 2019" under a design page selector whose next part is not out yet.

Appends next.js to c3main.js after the pipeline patch. The selector map is
generated at build time by gen_next.js from the game's own data.json and
c3main.js (on top of the template map), so a game update that moves a page is
picked up on the next build; one that loses the phone selectors fails the
build loudly here.
"""
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
PORT = HERE.parent.parent
UI = HERE.parent / 'mods-ui/ui.js'
DATA = PORT / 'game-files/data.json'
C3MAIN = PORT / 'game-files/scripts/c3main.js'
PLACEHOLDER = '__DT_NEXT_MAP__'
KEYS = ('sel', 'id', 'temp', 'col', 'src', 'date', 'name', 'lang', 'pre', 'suf', 'text', 'right', 'left', 'res')
# Phone selectors that must be found (the brief's must-have pages).
MUST = ('ScreenRefreshRate', 'Battery', 'WaterproofLevel', 'RAM', 'ROM')


def build_map(data_path=DATA, c3main_path=C3MAIN):
    out = subprocess.run(
        ['node', str(HERE / 'gen_next.js'), str(data_path), str(c3main_path)],
        check=True, capture_output=True, text=True,
    ).stdout
    validate_map(json.loads(out))
    return out


def validate_map(m):
    phone = {r.get('sel') for r in (m.get('SMARTPHONE') or [])} if isinstance(m, dict) else set()
    missing = [s for s in MUST if s not in phone]
    if missing:
        raise ValueError('Next map lost phone selectors: ' + ', '.join(missing))
    for cat, rows in m.items():
        for r in rows:
            if set(r) != set(KEYS) or not all(isinstance(r[k], int) for k in ('date', 'name', 'text', 'right')):
                raise ValueError('Next map has an incomplete selector in ' + cat)


def transform(source, map_json=None):
    if '_dtNext' in source:
        raise ValueError('Next patch already applied')
    map_json = map_json if map_json is not None else build_map()
    validate_map(json.loads(map_json))
    body = (HERE / 'next.js').read_text()
    if body.count(PLACEHOLDER) != 1:
        raise ValueError('next.js must contain the map placeholder once')
    ui = '' if 'var _dtUi =' in source else UI.read_text() + '\n;\n'
    return source + '\n;\n' + ui + body.replace(PLACEHOLDER, map_json.strip())
