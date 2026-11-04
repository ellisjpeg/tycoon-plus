// Editor perf (DEVICES_TYCOON_EDITORPERF): redraw the phone picture in Construct's
// "tick2" (after the event sheets, before the frame is drawn) instead of the next
// requestAnimationFrame. A tap then shows its value and its picture in one frame
// instead of two, so fast taps no longer trail. Taps in one frame still share one
// redraw that reads the latest value. requestAnimationFrame stays as the fallback.
var _dtEdPending$S=[],_dtEdRuntime$S=null;
function _dtEdFlush$S(){const q=_dtEdPending$S;_dtEdPending$S=[];for(const f of q)f()}
function _dtEdSchedule$S(t){let done=!1;const run=()=>{done||(done=!0,t())},rt=globalThis.runtime;
if(rt&&"function"==typeof rt.addEventListener&&_dtEdRuntime$S!==rt)try{rt.addEventListener("tick2",_dtEdFlush$S),_dtEdRuntime$S=rt}catch(e){}
_dtEdRuntime$S&&_dtEdRuntime$S===rt&&_dtEdPending$S.push(run);
"function"==typeof requestAnimationFrame?requestAnimationFrame(run):Promise.resolve().then(run)}
// Same answer as _ensureSize$S without the await, so the draw finishes before the frame is drawn.
function _dtEdSizeNow$S(e){const s=_surfaceSize$S(e.inst);return s?(e.w=s.w,e.h=s.h,!0):!!(e.w&&e.h)}
