"""Pipeline patch: up to three items in development, one per work room.

Appends pipeline.js after the rooms patch. It needs the queue (starts entries
through its replay, `_dtPipeHold` hook in `_dtqReadyNow`, save-row helpers),
rooms.js (room switching, save wrapper) and the game's bubble planner
(`computeBubblesPlan`, used for off-screen work). Fails loudly when any of
them is missing or changed. State: ArraySaves row 152 (150/151 are taken).
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent
REQUIRED = (
    'function computeBubblesPlan(e,t)',
    'pps:f,',
    'setInterval)(_dtqTick, 250);',
    'globalThis._dtPipeHold && globalThis._dtPipeHold()',
    'function _dtqCreateButton(',
    'function _dtqSaves(',
    'function _dtqStartKey(',
    'setInterval)(_dtrTick, 250);',
    'globalThis._dtPipeBeforeRoom',
    'function _dtrDevLabel(',
)


def transform(source):
    if '_dtpTick' in source:
        raise ValueError('Pipeline patch already applied')
    # The pipeline runs on the queue and the room button: with either off it is skipped
    # (their timer lines, which go through the shared mod timer: ui.js every).
    if 'setInterval)(_dtqTick, 250);' not in source or 'setInterval)(_dtrTick, 250);' not in source:
        return source
    missing = [r for r in REQUIRED if r not in source]
    if missing:
        raise ValueError('Pipeline needs the queue and rooms patches; missing: ' + ', '.join(missing))
    if 'ROW=152' in source or '_DTQ_ROW = 152' in source:
        raise ValueError('ArraySaves row 152 is now used elsewhere')
    return source + '\n;\n' + (HERE / 'pipeline.js').read_text()
