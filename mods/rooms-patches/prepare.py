"""Rooms patch: a floating room title that steps through the three work offices.

Appends rooms.js to c3main.js after the queue patch. It reads the office
layout names and globals of 276 GAMEPLAY, hides the centre button by UID while
a non-active room is viewed, and wraps the game's saveArraysToFile so a save
always stores the real OfficeType. A game update that renames those fails the
build loudly here.
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
UI = HERE.parent / 'mods-ui/ui.js'
DATA = HERE.parent.parent / 'game-files/data.json'
REQUIRED = (
    'function saveArraysToFile(e,t,n)',
    'STAGES={design:{gv:"BubblesDesign",officeType:"DESIGNER"',
    'layoutPrefix:"PROGRAMMER OFFICE"',
    'layoutPrefix:"ENGINEER OFFICE"',
)
# The create picker's parts on BOSS OFFICE (picker.js draws them over the work rooms): tile hit areas,
# circles, shadows and icons by UID, plus the frames of the sprites it cuts from the sheets.
PICK_UIDS = (382, 383, 384, 385, 386, 387, 7340, 7344, 13431, 13472, 388, 390, 391, 389,
             351, 352, 353, 354, 355, 356, 7338, 7343, 13429, 13470, 357, 359, 360, 358,
             361, 362, 363, 364, 7347, 366, 7337, 7342, 13428, 13430, 367, 369, 370, 368,
             20232, 20229, 20230, 20233, 20234, 20235, 20236, 20237, 13469, 13471, 20240, 20241, 20242, 20243)
PICK_FRAMES = ('Sprite12', 'Sprite16', 'Sprite20')
LAYOUTS = ['BOSS OFFICE'] + ['%s OFFICE %d' % (r, n) for r in ('DESIGNER', 'PROGRAMMER', 'ENGINEER') for n in range(1, 9)]


def check_layouts(data_text=None):
    text = data_text if data_text is not None else DATA.read_text()
    missing = [n for n in LAYOUTS if json.dumps(n) not in text]
    if missing:
        raise ValueError('Office layouts changed: ' + ', '.join(missing))


def pick_art(data):
    """Positions, sizes and art of the boss office picker, from the player's data.json."""
    proj = data['project']
    types, layouts = proj[3], proj[5]
    boss = next(l for l in layouts if l[0] == 'BOSS OFFICE')
    inst = {}

    def walk(layer):
        for i in layer[14]:
            if i[2] in PICK_UIDS:
                w, name = i[0], types[i[1]][0]
                svg = i[5][0] if name == 'SVG' and isinstance(i[5], list) and i[5] and isinstance(i[5][0], str) else ''
                inst[i[2]] = [w[0], w[1], round(w[3], 3), round(w[4], 3), name, svg]
        for s in layer[21]:
            walk(s)
    for layer in boss[11]:
        walk(layer)
    missing = [u for u in PICK_UIDS if u not in inst]
    if missing:
        raise ValueError('Boss office picker changed: ' + ', '.join(map(str, missing)))
    frames = {}
    for name in set(PICK_FRAMES) | {inst[u][4] for u in inst if inst[u][4] != 'SVG'}:
        t = next((t for t in types if t[0] == name), None)
        if not t or not t[7]:
            raise ValueError('Picker sprite changed: ' + name)
        f = t[7][0][7][0]
        frames[name] = [f[0], f[2], f[3], f[4], f[5], bool(f[6])]
    return {'inst': {str(k): v for k, v in sorted(inst.items())}, 'frames': dict(sorted(frames.items()))}


def picker_js(data_text=None):
    """picker.js with the art table filled in; without the game data it stays off (boss office picker)."""
    js = (HERE / 'picker.js').read_text()
    if data_text is None and not DATA.exists():
        return js
    try:
        art = pick_art(json.loads(data_text if data_text is not None else DATA.read_text()))
    except Exception as e:  # a changed game: Rooms still installs, the + uses the boss office picker
        print('Rooms: in-room picker off (' + type(e).__name__ + ': ' + str(e) + ')')
        return js
    return js.replace('var _DTK_ART = null; // replaced at install (prepare.py)', 'var _DTK_ART = ' + json.dumps(art, separators=(',', ':')) + ';', 1)


def transform(source):
    if '_dtrTick' in source:
        raise ValueError('Rooms patch already applied')
    missing = [r for r in REQUIRED if r not in source]
    if missing:
        raise ValueError('Rooms hooks changed: ' + ', '.join(missing))
    if DATA.exists():
        check_layouts()
    ui = '' if 'var _dtUi =' in source else UI.read_text() + '\n;\n'
    return source + '\n;\n' + ui + (HERE / 'rooms.js').read_text() + '\n;\n' + picker_js()
