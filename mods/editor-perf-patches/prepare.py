"""Editor perf patch: fast taps on the phone/tablet editor no longer trail.

Each tap on a stepper such as DEVICE WIDTH "< 1 >" asks the editor to redraw
the phone picture. The game queues that redraw for the next
requestAnimationFrame, which runs after Construct has already drawn the frame
with the new value, so every tap costs two full frames (value, then picture)
and quick taps queue up behind them. This moves the redraw into Construct's
"tick2" event (after the event sheets, before drawing), keeping one redraw per
frame and the same pixels once settled. Only the smartphone and tablet editors
share this scheduler; a game update that reshapes it fails loudly here.

Each tap also did work the picture never needed. Steppers for front-only
settings (wallpaper, button, camera, design and fingerprint styles) redrew the
side view too; they now redraw the front only, by the same _TOP_ONLY_PARAMS
rule the game already uses when it loads a design. And the front and side
views (headphones too) shared one scratch canvas of a different size, so every
tap reallocated and cleared it twice; each size now keeps its own canvas.
Pixels stay identical.

Construct's Wait action also searched a list linearly for every object type
(SOL_NEW below): same answers from a Set.
"""
from pathlib import Path

HELPER = (Path(__file__).resolve().parent / 'editor_perf.js').read_text()
EDITORS = ('', '2')  # smartphone, tablet
SCRATCH = ('', '2', '3')  # smartphone, tablet, headphones: two views of different sizes


def _sub(source, old, new, what):
    if source.count(old) != 1:
        raise RuntimeError(f'editor perf: {what} not found exactly once ({source.count(old)})')
    return source.replace(old, new)


def _taps(source):
    for s in EDITORS:
        # A front-only stepper leaves the side picture as it is.
        source = _sub(source, f'c(),_scheduleRedraw{s}()}};return a.addEventListener("click",',
                      f'c(),_scheduleRedraw{s}(_TOP_ONLY_PARAMS{s}.has(e.id)?"top":void 0)}};return a.addEventListener("click",',
                      f'stepper redraw {s!r}')
    return source


def _scratch(source):
    for s in SCRATCH:
        cv, cx = f'_scratchCv{s}', f'_scratchCtx2d{s}'
        source = _sub(source, f'var {cv}=null,', f'var _dtEdCv{s}={{}},{cv}=null,', f'{cv} declaration')
        # reset() already gives the blank canvas the resize used to; keep at most two sizes.
        source = _sub(source,
                      f'return {cv}||({cv}=document.createElement("canvas"),{cx}={cv}.getContext("2d",{{willReadFrequently:!0}})),'
                      f'{cv}.width===e&&{cv}.height===t||({cv}.width=e,{cv}.height=t),{cx}.reset(),{cx}}}',
                      f'let c=_dtEdCv{s}[e+"x"+t];if(!c){{const k=Object.keys(_dtEdCv{s});k.length>=2&&delete _dtEdCv{s}[k[0]];'
                      f'const v=document.createElement("canvas");v.width=e,v.height=t,'
                      f'c=_dtEdCv{s}[e+"x"+t]=v.getContext("2d",{{willReadFrequently:!0}})}}'
                      f'return {cv}=c.canvas,{cx}=c,c.reset(),c}}',
                      f'_scratchCtx{s} canvas reuse')
    return source


# Construct's "Wait": every wait copies the picked-object state, asking for each of the game's
# object types whether the event uses it (HasSolModifier). That was a linear search of the
# event's list, which for many events is every object type, so one wait cost thousands times
# thousands of comparisons (about 130 ms per tap on the packaging page, whose shine waits 8
# times). Same answer from a Set, rebuilt whenever the list is replaced or grows.
SOL_OLD = 'HasSolModifier(e){return this._solModifiers.includes(e)}'
SOL_NEW = ('HasSolModifier(e){const t=this._solModifiers;return t===this._dtSmList&&t.length===this._dtSmLen||'
           '(this._dtSmList=t,this._dtSmLen=t.length,this._dtSmSet=new Set(t)),this._dtSmSet.has(e)}')


def transform(source):
    source = _sub(source, SOL_OLD, SOL_NEW, 'HasSolModifier')
    source = _scratch(_taps(source))
    for s in EDITORS:
        head = f'function _scheduleRedraw{s}(e){{'
        start = source.find(head)
        end = source.find('}function ', start)
        if start < 0 or end < 0:
            raise RuntimeError(f'editor perf: _scheduleRedraw{s} not found')
        body = source[start:end + 1]
        for need in (f'_redrawScheduled{s}=!1;const e=Array.from(_dirtyViews{s});', f'function _surfaceSize{s}(e){{'):
            if need not in source:
                raise RuntimeError(f'editor perf: {need!r} missing')
        new = _sub(body, f'if(await _ensureSize{s}(e)&&e.w&&e.h)',
                   f'if((_dtEdSizeNow{s}(e)||await _ensureSize{s}(e))&&e.w&&e.h)', f'_ensureSize{s} call')
        new = _sub(new, '"function"==typeof requestAnimationFrame?requestAnimationFrame(t):Promise.resolve().then(t)}',
                   f'_dtEdSchedule{s}(t)}}', f'_scheduleRedraw{s} frame request')
        source = source[:start] + HELPER.replace('$S', s) + new + source[end + 1:]
    return source
