"""Version-matched "Start from a previous device" patch for the name screen.

The list map is generated from the game's own data.json and c3main.js by
gen_map.js, so a game update that moves list functions or IDs is picked up
on the next build, and one that changes their shape fails loudly here.
"""
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
MOUNT_OLD = 'u.textContent=_t24("nameHint");'
MOUNT_NEW = 'u.textContent=_t24("nameHint");try{n||_dtTplMount(i,u)}catch(_dtTplErr){}'
RESET_OLD = '_markBatchStart(),_runEditorReset();else{'
RESET_NEW = '_markBatchStart(),_runEditorReset(),_dtTplReset();else{'
PLACEHOLDER = '__DT_TPL_MAP__'
# Helpers in the game's name screen that template.js relies on.
REQUIRED = (
    'function _rt63(', 'function _getArray24(', 'function _setGvTyped(', 'function _loadArrayFromJson(',
    'function _designCells(', 'function _arrSize3(', 'function _snapshotEditorState(', 'function _applyEditorState(',
    'function _t24(', 'function _isRu2(', 'function _el8(', 'function _deviceKey2(', 'function _creatingNow(',
    'function _batchPushed(', '_TIERS=', '_RESTORE_MAP=', '_DESIGN_MAP=', '_SNAP_DENY=', '_busy2=',
)


def build_map(data_path, c3main_path):
    out = subprocess.run(
        ['node', str(HERE / 'gen_map.js'), str(data_path), str(c3main_path)],
        check=True, capture_output=True, text=True,
    ).stdout
    validate_map(json.loads(out))
    return out


def validate_map(m):
    if not isinstance(m, dict) or not m:
        raise ValueError('Template map is empty')
    for cat, c in m.items():
        groups = c.get('groups')
        if not groups or not any(g.get('maps') for g in groups):
            raise ValueError('Template map has no list selectors for ' + cat)
        for g in groups:
            if not isinstance(g.get('fn'), str) or not g['fn']:
                raise ValueError('Template map has a group without a function in ' + cat)
            for mp in g['maps']:
                if not all(isinstance(mp.get(k), str) and mp[k] for k in ('id', 'temp', 'sel')):
                    raise ValueError('Template map has an incomplete list in ' + cat)


def transform(source, map_json):
    if '_dtTpl' in source:
        raise ValueError('Template patch already applied')
    if source.count(MOUNT_OLD) != 1:
        raise ValueError('Expected exactly one name hint line')
    if source.count(RESET_OLD) != 1:
        raise ValueError('Expected exactly one batch start reset')
    missing = [r for r in REQUIRED if r not in source]
    if missing:
        raise ValueError('Name screen helpers changed: ' + ', '.join(missing))
    validate_map(json.loads(map_json))
    body = (HERE / 'template.js').read_text()
    if body.count(PLACEHOLDER) != 1:
        raise ValueError('template.js must contain the map placeholder once')
    body = body.replace(PLACEHOLDER, map_json.strip())
    return source.replace(MOUNT_OLD, MOUNT_NEW).replace(RESET_OLD, RESET_NEW) + '\n;\n' + body
