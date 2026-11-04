"""News patch: the game's own office news cards (#office-notifications), readable.

Appends news.js to c3main.js (last patch, after BOARD) and adds one call to the game's _layoutNotifs: after it
places the main stack, _dtNewsTrim lets the oldest card leave early when the stack would reach the work rooms'
PROGRAMMING / BUGS circles. The sales messages under the sales card get the same size and stop above the bottom
menu. Sizes are a CSS override keyed on the game's own --office-notif-scale, so the cards
scale with the window exactly like the game's. A game update that changes the notification code fails the build.
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent
HOOK_OLD = 'a+=r+n}o&&_trimSalesNotifsToScreen(e,t,n)}'
HOOK_NEW = 'a+=r+n}o?_trimSalesNotifsToScreen(e,t,n):_dtNewsTrim(e,t,n,_markNotifLeaving,_getDS2())}'
# The sales toasts hang under the device card, where the mods' dock (room chip, Difficulty) also sits:
# start them below the dock instead (mods-ui sets _dtSalesNotifShift to the dock's height plus its gap).
SALES_OLD = 'e.style.top=(t.bottom+_SALES_NOTIF_GAP_DP*n).toFixed(1)+"px"'
SALES_NEW = 'e.style.top=(t.bottom+_SALES_NOTIF_GAP_DP*n+(+globalThis._dtSalesNotifShift||0)).toFixed(1)+"px"'
# The sales cards are as big as the news cards here and start lower (below the credit): they stop where the news
# stack does, 180 design px above the bottom (the bottom menu), not 24, and the oldest leaves early instead.
FLOOR_OLD = 's=Math.max(0,(window.innerHeight-a)/2)+a-_SALES_NOTIF_BOTTOM_DP*o-(parseFloat(e.style.top)||0)'
FLOOR_NEW = 's=Math.max(0,(window.innerHeight-a)/2)+a-_NOTIF_INSET_BOTTOM_DP*o-(parseFloat(e.style.top)||0)'
REQUIRED_JS = (
    # Card look the override builds on: 320 px wide, 15 px text, 12/16 padding, all times the design scale.
    '#office-notifications {\\n',
    'width:  calc(320px * var(--office-notif-scale, 1));',
    'font-size: calc(15px * var(--office-notif-scale, 1));',
    'padding: calc(12px * var(--office-notif-scale, 1)) calc(16px * var(--office-notif-scale, 1));',
    # Scale = min(window / 1920x1080); the stack sits 180 design px above the layout bottom.
    'function _getDS2(){return Math.min(window.innerWidth/_DESIGN_W9,window.innerHeight/_DESIGN_H7)}',
    '_DESIGN_W9=1920', '_DESIGN_H7=1080', '_NOTIF_INSET_BOTTOM_DP=180',
    'e.style.setProperty("--office-notif-bottom",s.toFixed(1)+"px")',
    # Stack layout (newest at the bottom) and the game's own leave animation.
    'function _layoutNotifs(e){const t=Array.from(e.children).filter(e=>!e.classList.contains("notif-leaving"));',
    'const n=8*_getDS2(),o=e.id===_SALES_NOTIF_ID;let a=0;for(let e=t.length-1;e>=0;e--){const s=t[e],r=s.offsetHeight;',
    'function _markNotifLeaving(e){',
)


def transform(source):
    if 'var _DT_NEWS =' in source:
        raise ValueError('News patch already applied')
    missing = [r for r in REQUIRED_JS if r not in source]
    if missing:
        raise ValueError('News: game JS changed; missing ' + ' | '.join(m[:48] for m in missing))
    if source.count(HOOK_OLD) != 1:
        raise ValueError('News: _layoutNotifs changed (hook point found %d times)' % source.count(HOOK_OLD))
    if source.count(SALES_OLD) != 1:
        raise ValueError('News: _placeSalesNotifs changed (found %d times)' % source.count(SALES_OLD))
    if source.count(FLOOR_OLD) != 1:
        raise ValueError('News: _trimSalesNotifsToScreen changed (found %d times)' % source.count(FLOOR_OLD))
    source = source.replace(SALES_OLD, SALES_NEW, 1).replace(FLOOR_OLD, FLOOR_NEW, 1)
    return source.replace(HOOK_OLD, HOOK_NEW, 1) + '\n;\n' + (HERE / 'news.js').read_text()
