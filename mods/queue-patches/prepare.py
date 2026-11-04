"""Build queue patch: create while busy, start by itself when free.

Queue state lives per company in ArraySaves row 151, next to difficulty's row
150 and the game's own JS rows (98, 102-114). A device created while another
is in development is stored at the final create step (what AddToArray reads,
see reads.js) and later replayed through the game's own LOADING EDITOR.
A game update that renames the device tables or array helpers fails loudly
here; regenerate reads.js with gen_reads.py after an event-sheet change.
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent
UI = HERE.parent / 'mods-ui/ui.js'
# Functions, tables and save rows the queue calls or relies on.
REQUIRED = (
    'function _markBatchStart(',
    'function _batchPushed(',
    '_DEVICES={SMARTPHONE:',
    'function _getArray24(',
    'function _arrSize3(',
    'var _dtUi =',
    '_SAVE_ROW=98', 'MKT_HIST_ROW=102', 'HINT_SAVE_ROW=103', 'OFFICE_SAVE_ROW=114',
)


def transform(source):
    if '_dtq' in source:
        raise ValueError('Queue patch already applied')
    missing = [r for r in REQUIRED if r not in source]
    # Difficulty may be off; when it is on, its row must still be 150 (the queue uses 151).
    if '_DT_DIFF_ROW' in source and '_DT_DIFF_ROW = 150' not in source:
        missing.append('_DT_DIFF_ROW = 150')
    if missing:
        raise ValueError('Queue hooks changed: ' + ', '.join(missing))
    if 'ROW=151' in source or 'ROW = 151' in source:
        raise ValueError('ArraySaves row 151 is now used by the game')
    body = (HERE / 'reads.js').read_text() + (HERE / 'queue.js').read_text()
    ui = '' if 'var _dtUi =' in source else UI.read_text() + '\n;\n'
    return source + '\n;\n' + ui + body
