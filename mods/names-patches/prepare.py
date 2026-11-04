"""Real names patch: real company and brand names instead of the game's parody names ("Nokya" -> "Nokia").

transform(c3main): one hook at the end of the Array plugin's JSONLoad calls _dtNamesLoaded(this), which swaps
the parody names in ArrayCompanyNames (the game's one name table) and three English help texts as they load.
Two hooks in the game's file save/load keep the game's own names in Settings.dt (FILE_HOOKS).
Also the two sample lines the presentation screens show, and appends names.js with map.json inlined
(exports globalThis._dtRealName for the rivals mod). Last c3main step, after NEWS.
transform_data(data.json): the editor's placeholder name labels ("Infel UHD", "Somy", ...), which the game shows
before it fills them from the table. Saved text and anything the player typed are never touched.
A game update that moves any of these fails the build.
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
MAP = json.loads((HERE / 'map.json').read_text(encoding='utf-8'))
MARK = 'var _DT_NAMES ='
HOOK_OLD = 'const n=t.size;this._cx=n[0],this._cy=n[1],this._cz=n[2],this._arr=t.data},JSONDownload(e)'
HOOK_NEW = ('const n=t.size;this._cx=n[0],this._cy=n[1],this._cz=n[2],this._arr=t.data,'
            'globalThis._dtNamesLoaded&&globalThis._dtNamesLoaded(this)},JSONDownload(e)')
# (old, new, expected count): text the game has baked into its code rather than reading from the table.
JS_TEXT = (
    ('[icon=CPU]  MediaRek M700+', '[icon=CPU]  MediaTek M700+', 1),
    ('[icon=Dynamics]  Somy 3 MAX', '[icon=Dynamics]  Sony 3 MAX', 1),
)
# The game's file save/load (_doSave, rewritten in game update 1.6; Settings.dt holds ArrayCompanyNames once the
# player edits a name): the saved copy keeps the game's own names, the loaded copy gets the real names back (names.js).
FILE_HOOKS = (
    ('const t=_snapshotArray(e);t&&(s.arrays[e]=t)',
     'const t=_snapshotArray(e);globalThis._dtNamesSaving&&globalThis._dtNamesSaving(e,t);t&&(s.arrays[e]=t)', 1),
    ('_restoreArray(t,n)&&o.push(t)',
     '_restoreArray(t,n)&&(globalThis._dtNamesRestored&&globalThis._dtNamesRestored(t),o.push(t))', 1),
)
DATA_TEXT = (
    ('["Somy",true,"SofiaSansExtraCondensed-Light"', '["Sony",true,"SofiaSansExtraCondensed-Light"', 5),
    ('["MediaRek",true,"SofiaSansExtraCondensed-Light"', '["MediaTek",true,"SofiaSansExtraCondensed-Light"', 12),
    ('["AMG",true,"SofiaSansExtraCondensed-Light"', '["AMD",true,"SofiaSansExtraCondensed-Light"', 3),
    ('Infel UHD[/font]"', 'Intel UHD[/font]"', 4),
    ('[1,"Dynamics_Text",1,"Somy",', '[1,"Dynamics_Text",1,"Sony",', 1),
)


def _swap(source, pairs, what):
    for old, new, n in pairs:
        if source.count(old) != n:
            raise ValueError('Names: %s changed; %r found %d times, expected %d' % (what, old, source.count(old), n))
        source = source.replace(old, new)
    return source


def js_payload():
    data = {k: MAP[k] for k in ('companies', 'lines', 'language')}
    return MARK + ' ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n' + \
        (HERE / 'names.js').read_text(encoding='utf-8')


def transform(source):
    if MARK in source:
        raise ValueError('Names patch already applied')
    if source.count(HOOK_OLD) != 1:
        raise ValueError('Names: Array JSONLoad changed (hook point found %d times)' % source.count(HOOK_OLD))
    source = _swap(source.replace(HOOK_OLD, HOOK_NEW, 1), JS_TEXT, 'game JS')
    source = _swap(source, FILE_HOOKS, 'file save/load')
    return source + '\n;\n' + js_payload()


def transform_data(data):
    if 'Intel UHD[/font]"' in data:
        raise ValueError('Names data patch already applied')
    return _swap(data, DATA_TEXT, 'data.json')
