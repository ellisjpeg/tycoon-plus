"""Restock patch: Auto / Careful / Off restock rule per device, and a toast per restock day.

Appends restock.js to c3main.js after the board patch. restock.js rebinds the
game's _handleBatchSoldOut (called by name from tickDeviceSales) and
tickDeviceSales, and passes the game its own restock settings (_cfg7
RESTOCK_*) with smaller values for Careful, or a POP under RESTOCK_MIN_POP for
Off. This checks that the restock still reads those settings and arguments the
way restock.js expects. When Sell and Board are in the build, their
_dtSellTick / _dtSellRowSpecs / _dtSellNoteText / _dtBoardRows / _dtBoardRender
are wrapped (Restock row in the device table, rule on the board row), so those must exist too. A game or mod update
that changes any of that fails the build loudly.
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent
UI = HERE.parent / 'mods-ui/ui.js'
REQUIRED_JS = (
    'var Z13={CREATED:0,SOLDED:1,POP:2,COST:3,SELL:4,RATING:5,HYPE:6,RELEASE:7,NAME:8}',
    'EventGameplay_Event449_Act1(e,t){tickDeviceSales(e.globalVars.DayTotal,e)',
    'function tickDeviceSales(e,t){',
    # The call by name and its argument order: (runtime, array, x, y, day, made, POP, rating, price, cfg, state, slot key, ...).
    '!w&&Y>0&&V-H<=H&&(g.earned=d,g.slotSold=H,_handleBatchSoldOut(n,m,b,x,o,N,T,O,M,a,g,k,U,W,B))',
    'function _handleBatchSoldOut(e,t,n,o,a,s,r,i,l,c,d,p,u,_,g){',
    'const g={contractEnd:void 0,earned:0,restockCost:0,contractFee:0,soldedNotified:!1}',
    # Restock fees are the game's own restockCost, which tickDeviceSales books as Production in the
    # game's finance ledger (game update 1.6), so the game's money stats include them.
    'globalThis.financeRecord?.("production",-Math.round(g.restockCost)-Math.round(g.contractFee))',
    'C=r?_slotKey(r.name,e,n,l):null',
    'return e+":id"+a}}catch(e){}return e+":"+n+":"+o}',
    # Off: POP under the minimum skips the order but keeps the sold-out message.
    'if((b||y)&&r>=c.RESTOCK_MIN_POP){',
    'return G(),!1}}}return G(),!1}',
    # Careful: the order size and money cap come only from these settings.
    'n=y?c.RESTOCK_SELF_PCT:c.RESTOCK_MAX_PCT;a=Math.floor(m*n*e*t);const o=Math.ceil((_||0)*c.RESTOCK_COVER_DAYS)',
    'a=Math.ceil(e*c.RESTOCK_TAIL_COVER)',
    'S=l*c.RESTOCK_BUDGET_PCT-d.restockCost;let w=Math.min(b,S),v=!1;if(c.RESTOCK_NEG_DEBT){',
    'else if(l<0&&c.RESTOCK_NEG_REINVEST>0){',
    't.setAt(s+a,n,o,Z13.CREATED)',
    'd.restockCost+=E',
    'RESTOCK_SELF_PCT:.12,RESTOCK_COVER_DAYS:3,RESTOCK_BUDGET_PCT:.35,RESTOCK_NEG_DEBT:!0',
    'RESTOCK_MAX_PCT:.25',
    'RESTOCK_MIN_POP:3',
    # Wages for the Careful cash line.
    'function estimateSalaryNow(e){const t=_scanPayroll(_rt10(e));return{total:t.total,',
)
# Mod hooks, needed only when that mod is in the build.
SELL_HOOKS = ('var _dtSell = {', 'function _dtSellTick() {', 'function _dtSellView() {', 'function _dtSellRowSpecs(v, state) {',
              'function _dtSellNoteText(v, state) {', 'function _dtSellRows() {',
              'return { t: t, a: a, x: x, mini:')
BOARD_HOOKS = ('var _dtBoard = {', 'function _dtBoardRows() {', 'function _dtBoardRender() {', 'v.rows = rows;',
               'data-i="', 'class="dt-board-type"', 'key: k, t: t, x: x, y: y, off: off,')


def transform(source):
    if 'var _DT_RESTOCK_ROW' in source:
        raise ValueError('Restock patch already applied')
    missing = [r for r in REQUIRED_JS if r not in source]
    if 'var _DT_SELL_ROW' in source:
        missing += [h for h in SELL_HOOKS if h not in source]
    if 'var _DT_BOARD_COL' in source:
        missing += [h for h in BOARD_HOOKS if h not in source]
    if missing:
        raise ValueError('Restock: game or mod JS changed; missing ' + ' | '.join(m[:48] for m in missing))
    if 'ROW = 156' in source or 'ROW=156' in source:
        raise ValueError('ArraySaves row 156 is now used elsewhere')
    ui = '' if 'var _dtUi =' in source else UI.read_text() + '\n;\n'
    return source + '\n;\n' + ui + (HERE / 'restock.js').read_text()
