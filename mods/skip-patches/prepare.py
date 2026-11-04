"""Skip patch: skip the batch delivery bar, the review card animations and the
device presentation's spec lines, and show the review price card forecast on
the price page.

Appends skip.js to c3main.js after the compare patch. The price bands are read
out of the shipped review engines (bands.py) and written into skip.js, so the
forecast follows the game's own numbers. skip.js also calls the review
overlay's own helpers by name; this checks they are still there and fails the
build loudly if a game update changes any of it.
"""
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
PORT = HERE.parent.parent
UI = HERE.parent / 'mods-ui/ui.js'
DATA = PORT / 'game-files/data.json'
_spec = importlib.util.spec_from_file_location('dt_skip_bands', HERE / 'bands.py')
bands = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bands)

# The review overlay (initReviewsPage / playReviewsAnimation) as skip.js uses
# it: its timer lists, the enter class, the count-up targets and the order of
# its summary timers ending with Next enabled.
REQUIRED_JS = (
    'function _clearTimers(){for(const e of _animTimers2)clearTimeout(e);_animTimers2=[];for(const e of _rafIds)cancelAnimationFrame(e);_rafIds=[]}',
    'e.querySelectorAll(".review-card").forEach(e=>e.classList.add("rc-enter")),_startCountAnimations(e),_scheduleCardStarSounds(e)}),e.softMode&&_runSoftTransition(),_scheduleSummarySequence()}',
    'n.forEach(e=>{_animateCount(e,parseInt(e.dataset.target,10)||0,1200)})',
    'function _formatCount(e){',
    'e&&e.classList.add("rc-blur-in")',
    'e&&(e.classList.add("rc-summary-show"),_scheduleSummaryStarSounds(e))',
    'e&&e.classList.add("rc-summary-hide");const t=_container7&&_container7.querySelector("#reviews-blur-overlay");t&&(t.classList.remove("rc-blur-in"),t.classList.add("rc-blur-out"))',
    'e&&e.classList.add("rc-corner-show")',
    'e&&e.classList.remove("rc-no-hover"),_armGamepadStepIfNeeded(),_setReviewNextActive(1)},a);_animTimers2.push(s,r,i,l,c)}',
    't.classList.remove("rc-soft-fade-in-new"),t.classList.add("rc-soft-move-up")',
    't.classList.add("rc-no-hover"),t.classList.add("soft-exit")',
    'function _setReviewNextActive(e){',
    'function _armGamepadStepIfNeeded(){',
    # The presentation player (presentationShowAll) as skip.js ends it.
    '_TABS_CAT=999',
    'function _clearTimers2(){for(const e of _timers2)clearTimeout(e);_timers2=[]}',
    'function _unlock(){_busy=!1,',
    'function _readSteps(){',
    'function _showStep(e){if(_checkContainerSize(),_setMinipage(e.cat),e.cat===_TABS_CAT)return void(_activeCat!==_TABS_CAT&&_showTabsAll());',
    'function presentationShowAll(e){if(!_root4)return;const t=_readSteps();if(0===t.length)return;_clearTimers2(),_unlock(),_stepIdx=-1,_autoPlaying=!0',
    'if(o>=t.length)return void(()=>{if(_autoPlaying=!1,"function"==typeof e)',
)
# 263 BATCH DELIVERY: the 6 s bar tween, then the hand-off to REVIEWS.
REQUIRED_DATA = ('"BATCH DELIVERY"', '"REVIEWS"', '"EDITOR PRICE PAGE"', '"SliderBarPrice"', '"ArrayReviews_DB"',
                 '"ReviewNextActive"', '"DevicePrice"', '"DeviceCostPrice"', '"DeviceTypeCreatingNow"')


def table(data_text, source):
    t = bands.extract(data_text, source)
    return {'bands': t['bands'], 'types': t['types'], 'editor': t['editor']}


def transform(source, data_text=None):
    if '_dtSkipNow' in source:
        raise ValueError('Skip patch already applied')
    missing = [r for r in REQUIRED_JS if source.count(r) != 1]
    if missing:
        raise ValueError('Skip: game JS changed; missing ' + ' | '.join(m[:50] for m in missing))
    data_text = data_text if data_text is not None else DATA.read_text()
    lost = [r for r in REQUIRED_DATA if r not in data_text]
    if lost:
        raise ValueError('Skip: game data lost ' + ', '.join(lost))
    body = (HERE / 'skip.js').read_text()
    if body.count('__DT_SKIP_TABLE__') != 1:
        raise ValueError('skip.js table placeholder missing')
    body = body.replace('__DT_SKIP_TABLE__', json.dumps(table(data_text, source), separators=(',', ':')))
    ui = '' if 'var _dtUi =' in source else UI.read_text() + '\n;\n'
    return source + '\n;\n' + ui + body
