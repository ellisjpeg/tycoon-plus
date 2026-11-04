"""Launch days patch: lets a reviewed device wait on a shelf until a chosen day.

Wraps the game's per-type "release" script actions on the reviews screen
(register sales + social post) so the device rows can be given a later
RELEASE day instead. The game's sales code already ignores rows whose
RELEASE day is still ahead, but its stats/hint helpers only check that
RELEASE is not -1; they are bounded to today here so a planned launch is not
counted before its day. The social helper also learns which array line the
device came from, so a waiting device is announced with its own name. A game
update that renames or reshapes those actions fails loudly here.
"""
import os
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
UI = HERE.parent / 'mods-ui/ui.js'
ACTION = re.compile(
    r'(EventReviews_Event\d+_Act5\(e,t\)\{)'
    r'(registerDeviceSalesForArray\("(\w+)",e\),socialQueueDeviceReleased\(e,"([^"]+)"\))\}'
)
DEVICE_ARRAYS = ('ArraySmartphones', 'ArrayTablets', 'ArrayLaptops', 'ArrayWatches', 'ArrayHeadphones', 'ArrayTV',
                 'ArrayScooters', 'ArrayKeyboards', 'ArrayConsoles', 'ArrayGamepads', 'ArrayVRConsoles')
# Game code launch.js calls or relies on.
REQUIRED = (
    'function registerDeviceSalesForArray(e,t)', 'function socialQueueDeviceReleased(e,t,n)',
    'CREATED:0,SOLDED:1,POP:2,COST:3,SELL:4,RATING:5,HYPE:6,RELEASE:7,NAME:8,RELEASE_TEXT:9',
    'if(o<0||o>c)continue',  # sales registration skips rows released in the future
)
# Launch events (event.js, DEVICES_TYCOON_EVENT, default on) also reach into
# the presentation code: its device pick, slide options and results.
EVENT_REQUIRED = (
    'function _findDevSlotX2(e){', 'function getLastPresentationResults(){', 'function clearPendingPresentationPopularity(){',
    'function presentationApplyOnRelease(e,t){', 'var _OPTS={deviceArray:"ArraySmartphones"', 'var _OPTS2={deviceArray:"ArrayTablets"',
    'var _OPTS3={deviceArray:"ArrayLaptops"', 'var _OPTS4={deviceArray:"ArrayWatches"', 'var _OPTS5={deviceArray:"ArrayHeadphones"',
    'var _OPTS6={deviceArray:"ArrayTV"', 'var _OPTS7={deviceArray:"ArrayScooters"', 'var _OPTS8={deviceArray:"ArrayKeyboards"',
    'var _OPTS9={deviceArray:"ArrayConsoles"', 'var _OPTS10={deviceArray:"ArrayVRConsoles"',
)
# Launch-day reviews (reviews.js, needs event.js): the launch question replaces
# the game's reviews card, and a planned device gets the game's review screens
# on its day with the results kept from the day it was finished.
REVIEWS_REQUIRED = (
    'function showOfficeNews(e,t,n,o,a,s){', 'function _renderCurrentDevice(e){', 'function _hasUnreleasedGamepad(',
    '_activeGroupByName=new Map,_dirty=!0,',
)
# Released-device helpers used by achievements, hints and the stats page. The
# game only checks RELEASE >= 0, which would count a planned launch early.
HELPER_PATCHES = (
    ('if(o<=0||a<=0||s<=Z19.RELEASE)return 0;let r=0;',
     'if(o<=0||a<=0||s<=Z19.RELEASE)return 0;const _dtDay=_resolveDay(void 0,_runtimeFrom4());let r=0;'),
    ('-1!==a&&(_num25(_at42(n,e,o,Z19.RELEASE),-1)<0||(r++,',
     '-1!==a&&(_num25(_at42(n,e,o,Z19.RELEASE),-1)<0||_num25(_at42(n,e,o,Z19.RELEASE),-1)>_dtDay||(r++,'),
    ('function getReleasedDeviceStats(e){const t=_runtimeFrom4(e);if(!t)return null;const n=_resolveDay(void 0,t);',
     'function getReleasedDeviceStats(e){const t=_runtimeFrom4(e);if(!t)return null;const n=_resolveDay(void 0,t);const _dtDay=n;'),
    ('const a=d.getAt(e,t,Z13.RELEASE);if(!(a>=0))continue;',
     'const a=d.getAt(e,t,Z13.RELEASE);if(!(a>=0)||a>_dtDay)continue;'),
    ('function hasAnyReleasedDevice(e){if(_anyReleasedCache)return!0;const t=_runtimeFrom4(e);if(!t)return!1;',
     'function hasAnyReleasedDevice(e){if(_anyReleasedCache)return!0;const t=_runtimeFrom4(e);if(!t)return!1;const _dtDay=_resolveDay(void 0,t);'),
    ('n.getAt(e,t,Z13.RELEASE)>=0)return _anyReleasedCache=!0,!0',
     'n.getAt(e,t,Z13.RELEASE)>=0&&n.getAt(e,t,Z13.RELEASE)<=_dtDay)return _anyReleasedCache=!0,!0'),
    ('function countReleasedDevices(e,t){const n=_runtimeFrom4(e);if(!n)return 0;',
     'function countReleasedDevices(e,t){const n=_runtimeFrom4(e);if(!n)return 0;const _dtDay=_resolveDay(void 0,n);'),
    ('s.getAt(e,t,Z13.RELEASE)>=0){if(++a>=o)return a;break}',
     's.getAt(e,t,Z13.RELEASE)>=0&&s.getAt(e,t,Z13.RELEASE)<=_dtDay){if(++a>=o)return a;break}'),
    ('function _scanDevices2(e){const t={',
     'function _scanDevices2(e){const _dtDay=_resolveDay(void 0,_runtimeFrom4());const t={'),
    ('_.made+=i,!(p>=0))continue;t.models++',
     '_.made+=i,!(p>=0)||p>_dtDay)continue;t.models++'),
    # socialQueueDeviceReleased(rt, cat, rowY, rowX): the game passes the row
    # index as its third argument and always reads x=0; launch.js adds x so a
    # device that was pushed to its own line is announced by its own name.
    ('function socialQueueDeviceReleased(e,t,n){try{const o=_deviceTypeIndex(t);',
     'function socialQueueDeviceReleased(e,t,n,x){try{const o=_deviceTypeIndex(t);'),
    (':t.getAt(0,s,8))??"")',
     ':t.getAt(Math.max(0,Math.round(+x))||0,s,8))??"")'),
)


def patch_helpers(source):
    """Bound released-device helpers to today and let social name a row line."""
    for old, new in HELPER_PATCHES:
        if source.count(old) != 1:
            raise ValueError('Release helper changed: ' + old[:60])
        source = source.replace(old, new)
    return source


def transform(source):
    if '_dtLaunchRelease' in source:
        raise ValueError('Launch patch already applied')
    missing = [r for r in REQUIRED if r not in source]
    if missing:
        raise ValueError('Release code changed: ' + ', '.join(missing))
    seen = {}

    def hook(m):
        arr = m.group(3)
        # The final-review action (last variant) comes first in the script table.
        last = 1 if arr not in seen else 0
        seen[arr] = seen.get(arr, 0) + 1
        return '%s_dtLaunchRelease("%s",e,"%s",%d)||(%s)}' % (m.group(1), arr, m.group(4), last, m.group(2))

    out, n = ACTION.subn(hook, source)
    for arr in DEVICE_ARRAYS:
        if seen.get(arr) != 2:
            raise ValueError('Expected two release actions for ' + arr)
    if n != sum(seen.values()):
        raise ValueError('Release action count mismatch')
    out = patch_helpers(out)
    body = (HERE / 'launch.js').read_text()
    if os.environ.get('DEVICES_TYCOON_EVENT', 'on') == 'on':
        missing = [r for r in EVENT_REQUIRED if r not in source]
        if missing:
            raise ValueError('Presentation code changed: ' + ', '.join(missing))
        body += '\n;\n' + (HERE / 'event.js').read_text()
        missing = [r for r in REVIEWS_REQUIRED if r not in source]
        if missing:
            raise ValueError('Reviews code changed: ' + ', '.join(missing))
        body += '\n;\n' + (HERE / 'reviews.js').read_text()
    ui = '' if 'var _dtUi =' in out else UI.read_text() + '\n;\n'
    return out + '\n;\n' + ui + body
