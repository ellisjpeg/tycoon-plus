"""Sell patch: change price and stop selling on the My Devices screens.

Appends sell.js to c3main.js after the compare patch. sell.js writes the
game's own SELL and POP cells and wraps tickDeviceSales, so this checks that
the daily sales engine still re-reads the price every day, still skips POP 0
devices (no sales, no restock, not counted for cannibalisation) and is still
called by name from the day loop. A game update that changes any of that
fails the build loudly.
"""
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
PORT = HERE.parent.parent
UI = HERE.parent / 'mods-ui/ui.js'
DATA = PORT / 'game-files/data.json'
REQUIRED_JS = (
    # Device columns and the day loop calling the tick by name.
    'var Z13={CREATED:0,SOLDED:1,POP:2,COST:3,SELL:4,RATING:5,HYPE:6,RELEASE:7,NAME:8}',
    'EventGameplay_Event449_Act1(e,t){tickDeviceSales(e.globalVars.DayTotal,e)',
    'function tickDeviceSales(e,t){',
    'function _collectActive',
    # Price: read every day, into the demand price factor and revenue.
    'M=m.getAt(b,x,Z13.SELL)',
    '*_priceFactor(t,n,e,l)/(i>1?i:1)',
    'function _priceFactor(e,t,n,o){',
    'PRICE_FAIR_BASE:1.2',
    'd+=l*M',
    # POP 0: skipped by the tick and the live count; restock only while POP > 0.
    'm.getAt(n,a,Z13.POP)<=0||(E.set(n,(E.get(n)||0)+1),I++)',
    'if(T<=0){T<0&&m.setAt(0,b,x,Z13.POP),_slotInitial.delete(k),_slotOffered.delete(k);continue}',
    '!w&&Y>0&&V-H<=H&&(g.earned=d,g.slotSold=H,_handleBatchSoldOut(',
    'function markDeviceSalesDirty(){_dirty=!0}',
    'function syncSellingDevicesNow(e)',
    # Marketing device list: filled by name from the Marketing menu, one column per device.
    'EventMarketingMenu_Event118_Act1(e,t){fillMarketingDevicesTemp(e)}',
    'function fillMarketingDevicesTemp(e,t){',
    'r.push(e.marketingType,l,c,t.getAt(n,s,Z14.NAME),t.getAt(n,s,Z14.RATING),i)',
    'DEVICE_ARRAYS2=[{name:"ArraySmartphones",marketingType:"SMARTPHONES"}',
    # Auto-marketing (game update 1.4+) picks its devices from this list, by name, once a day.
    'function listMarketingCandidates(e,t){',
    'for(const e of listMarketingCandidates(n)){',
    'type:e.marketingType,id:l,arrayName:e.name,x:n,y:s,name:String(t.getAt(n,s,Z14.NAME))',
    'release:i,age:o-i,',
    'TEMP_ARRAY_NAME="ArrayMarketingDevices_Temp"',
)


def type_names(js):
    """(array, show, draw) names from the _DT_SELL_TYPES table in sell.js."""
    rows = re.findall(r'arr: "(\w+)", show: "(\w+)", draw: "(\w*)"', js)
    if len(rows) != 10:
        raise ValueError('sell.js type table changed: %d rows' % len(rows))
    return rows


def check_data(data_text, js):
    names = set(re.findall(r'"([A-Za-z_][A-Za-z0-9_]*)"', data_text))
    need = {'ArraySaves', 'SubPage', 'MiniPage', 'DeviceShowFlagmanID', 'SaveSlot', 'CompanyName', 'DayTotal'}
    for arr, show, draw in type_names(js):
        need.update(n for n in (arr, show, draw) if n)
    missing = sorted(need - names)
    if missing:
        raise ValueError('Sell: game data lost ' + ', '.join(missing))


def transform(source, data_text=None):
    if 'var _DT_SELL_ROW' in source:
        raise ValueError('Sell patch already applied')
    missing = [r for r in REQUIRED_JS if r not in source]
    if missing:
        raise ValueError('Sell: game JS changed; missing ' + ' | '.join(m[:48] for m in missing))
    body = (HERE / 'sell.js').read_text()
    check_data(data_text if data_text is not None else DATA.read_text(), body)
    ui = '' if 'var _dtUi =' in source else UI.read_text() + '\n;\n'
    return source + '\n;\n' + ui + body
