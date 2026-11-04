"""Research filter patch: the device filter stays picked across research tabs.

On the research screen the row of device icons (phone, laptop, watch ...) filters the cards.
The game forgets the pick whenever you open another tab (Buttons -> Display Design), when the
tab has no card for that device, and when the screen is reopened, so you choose it again every
time. This keeps one remembered pick for the whole research screen: a tab that has the device
shows only its cards, a tab without it shows everything (the pick comes back on the next tab
that has it), and tapping the lit icon again clears it everywhere. Remembered until the game
is closed.
"""

# The research page's state list: add the remembered pick next to the game's own.
DECL_OLD = '_hideUnavailable=!1,_activeCategory="",_rows=[]'
DECL_NEW = '_hideUnavailable=!1,_activeCategory="",_dtResCat="",_rows=[]'
# Each draw, first thing: use the remembered pick when this tab has that device, else show
# everything. (The game clears the pick on every tab change and reopen; those clears now only
# touch the per-draw value, which this line sets again.) Set before the game's "Research all"
# button works out what it covers (game update 1.6: the cards on show), so the button, the
# cards and what it researches always agree. Sandbox mode's free "Research all" covers every
# tab whatever the filter, as in the game.
DRAW_OLD = 't.classList.toggle("rc-hide-on",_hideUnavailable);'
DRAW_NEW = ('_activeCategory=_dtResCat&&(_hideUnavailable?_rows.filter(e=>e.active):_rows)'
            '.some(e=>e.icons.includes(_dtResCat))?_dtResCat:"",t.classList.toggle("rc-hide-on",_hideUnavailable);')
# A tap on an icon picks it (or clears it) for every tab.
TAP_OLD = '_activeCategory=_activeCategory===e?"":e,_renderContent(),_resetScroll()'
TAP_NEW = '_dtResCat=_activeCategory=_activeCategory===e?"":e,_renderContent(),_resetScroll()'

SPOTS = ((DECL_OLD, DECL_NEW, 'state list'), (DRAW_OLD, DRAW_NEW, 'draw check'), (TAP_OLD, TAP_NEW, 'icon tap'))


def transform(source):
    if '_dtResCat' in source:
        raise ValueError('research filter: already applied')
    for old, new, what in SPOTS:
        n = source.count(old)
        if n != 1:
            raise ValueError(f'research filter: {what} found {n} times, expected 1')
        source = source.replace(old, new)
    return source
