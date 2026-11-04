"""Year patch: a "year in review" card every 1 January, and a Years tab on the stats page.

Appends year.js to c3main.js after the board patch. year.js wraps the game's
stats day (tickCompanyStatsDay, called once a game day after the day's sales,
fans and ratings), reads the game's monthly history (_loadState().m, written by
_pushMonthly), rank and share (_readRatings) and the device arrays (Z13
columns), and adds a tab to the Company statistics page (_TAB_LIST,
_renderBody2, initStatsPage). A game update that changes any of that fails the
build loudly.
"""
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
PORT = HERE.parent.parent
UI = HERE.parent / 'mods-ui/ui.js'
DATA = PORT / 'game-files/data.json'
REQUIRED_JS = (
    # Device columns; the day runs sales, fans and ratings before the stats day.
    'var Z13={CREATED:0,SOLDED:1,POP:2,COST:3,SELL:4,RATING:5,HYPE:6,RELEASE:7,NAME:8}',
    'EventGameplay_Event449_Act1(e,t){tickDeviceSales(e.globalVars.DayTotal,e)',
    'EventGameplay_Event454_Act1(e,t){tickRatingsDay(',
    'EventGameplay_Event455_Act1(e,t){tickCompanyStatsDay(e)}',
    'function tickCompanyStatsDay(e){e&&!globalThis.runtime&&(globalThis.runtime=e),_loadState();',
    'globalThis.tickCompanyStatsDay=tickCompanyStatsDay',
    # Monthly history: ym = 12*year + month-1, summed per day, fan = last value.
    'm:{ym:[],rev:[],exp:[],prof:[],un:[],fan:[],val:[],px:[]}',
    'function _pushMonthly(e){const t=_S5.m,n=12*e.year+(e.month-1),o=t.ym.length-1;if(o>=0&&t.ym[o]===n)return t.rev[o]=_round(t.rev[o]+e.rev,0)',
    't.fan[o]=_round(e.fan,0)',
    # Since game update 1.6: revenue = device sales + software + OS income, profit = the day's change in
    # cash (what the game's finance ledger closes the day with), expenses = revenue - profit.
    'const h=u+Math.max(0,o.earn)+m,f=c?0:s-d.budget,b=Math.max(0,h-f)',
    '_pushMonthly({year:_gvNum49("Year",2008),month:_gvNum49("Month",1),rev:h,exp:b,prof:f,un:p,fan:r,',
    '_finCloseDay(c?null:s-d.budget)',
    'function _loadState(){if(_stateLoaded&&_S5)return _S5;',
    # Rank and share as the Market tab shows them.
    'function _readRatings(){const e={value:0,earn:0,rate:0,share:0,fans:0,rank:0,companies:0},t=_scanCompanies();e.companies=t.rows.length,e.rank=t.rank;',
    'e.share=t.total>0?n.earn/t.total*100:0',
    # Stats page: tab list, body renderer, entry point and the shared state.
    '_TAB_LIST=[["overview","tabOverview"],',
    'function _renderBody2(e){if(!_container102)return;',
    'function initStatsPage(e){if(!e)return!1;_container102=e,',
    'function updateStatsPage(){',
    'globalThis.initStatsPage=initStatsPage,globalThis.updateStatsPage=updateStatsPage',
    'EventStats_Event3_Act1(e,t){const n=e.objects.MyHTML_Stats.getFirstInstance();n&&initStatsPage(n.getElement())}',
    'var _container102=null,_cssInjected17=!1,_resizeObs23=null,_tab="overview",',
    'var _chartData={};',
    '_tab=t.dataset.tab,_renderBody2({})',
)


def type_arrays(js):
    rows = re.findall(r'\{ arr: "(\w+)", k: "(\w+)" \}', js)
    if len(rows) != 10:
        raise ValueError('year.js type table changed: %d rows' % len(rows))
    return [r[0] for r in rows]


def check_data(data_text, js):
    names = set(re.findall(r'"([A-Za-z_][A-Za-z0-9_ ]*)"', data_text))
    need = {'ArraySaves', 'ArrayGameAssistant', 'ArrayCompanyStats', 'ArrayRatingsCompanies', 'SaveSlot', 'CompanyName',
            'DayTotal', 'Day', 'Month', 'Year', 'Fans', 'class', 'Assistant', 'CreateDevicesUI', 'GameplayPause'}
    need.update(type_arrays(js))
    missing = sorted(need - names)
    if missing:
        raise ValueError('Year: game data lost ' + ', '.join(missing))


def transform(source, data_text=None):
    if 'var _DT_YEAR_ROW' in source:
        raise ValueError('Year patch already applied')
    missing = [r for r in REQUIRED_JS if r not in source]
    if missing:
        raise ValueError('Year: game JS changed; missing ' + ' | '.join(m[:48] for m in missing))
    body = (HERE / 'year.js').read_text()
    check_data(data_text if data_text is not None else DATA.read_text(), body)
    ui = '' if 'var _dtUi =' in source else UI.read_text() + '\n;\n'
    return source + '\n;\n' + ui + body
