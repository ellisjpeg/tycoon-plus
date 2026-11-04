"""Bulk search patch: run several searches at one Find Employees agency in one go.

Each agency card gets a "‹ ×1 ›" picker next to its price button. ×1 is the
game's own search; ×2 to ×20 runs that many searches back to back at 50% more
per search, with the total on the button. The game's findEmployees is renamed
_dtFindOne and the new findEmployees (bulk.js) calls it once per search, so the
candidates, skills and salaries come from the game's own code.
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent
OLD = 'function findEmployees(e){const t=_rt10(e),n=t.globalVars||{};normalizeEmployeeArrays(t);'
NEW = 'function _dtFindOne(e){const t=_rt10(e),n=t.globalVars||{};normalizeEmployeeArrays(t);'
# What bulk.js uses from the game's employee module, and the report it reads.
REQUIRED = (
    'globalThis.findEmployees=findEmployees,',
    't.globalVars&&(t.globalVars.FindEmployeesCountRandom=h.length),_lastReport={ok:!0,profession:c,requested:d,poolSize:_.length,excluded:u.size,found:h}}',
    'i=_inst13(t,CFG.TEMP_ARRAY)',
    'function _rt10(',
    'function _inst13(',
)


def transform(source):
    if '_dtFindOne' in source or '_dtBulk' in source:
        raise ValueError('bulk search: already applied')
    if source.count(OLD) != 1:
        raise ValueError(f'bulk search: findEmployees found {source.count(OLD)} times, expected 1')
    missing = [r for r in REQUIRED if source.count(r) != 1]
    if missing:
        raise ValueError('bulk search: employee module changed: ' + ', '.join(missing))
    if '_dtUiApi' not in source:
        raise ValueError('bulk search: needs the shared mods-ui (another mod adds it)')
    return source.replace(OLD, NEW) + '\n;\n' + (HERE / 'bulk.js').read_text()
