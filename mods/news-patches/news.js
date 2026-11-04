/* News patch (DEVICES_TYCOON_NEWS): the game's own office news cards (#office-notifications), readable.
 * Text 19.5 design px (13 px in a 1280x720 window; mod toasts are 21), the card grows to fit up to 560 design px
 * wide and at most 3 lines. Colours, font, gold highlights, slide-in and timing stay the game's. The stack keeps
 * below the work rooms' PROGRAMMING / BUGS circles: the oldest card slides out early when the next would not fit,
 * the way the game's own max-count rule removes it. The sales messages under the sales card get the same text
 * size and padding (their place, width and order stay the game's), so every notice card matches. */
var _DT_NEWS = { font: 19.5, padY: 14, padX: 18, minW: 320, maxW: 560, lines: 3, top: 570 };
(function () {
  var n = _DT_NEWS, s = "var(--office-notif-scale, 1)";
  var css = "html body #office-notifications { width: calc(" + n.maxW + "px * " + s + "); }\n" +
    "#office-notifications > .office-notif { width: max-content; max-width: 100%; min-width: calc(" + n.minW + "px * " + s + ");" +
    " font-size: calc(" + n.font + "px * " + s + "); padding: calc(" + n.padY + "px * " + s + ") calc(" + n.padX + "px * " + s + ");" +
    " display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: " + n.lines + "; overflow: hidden; }\n" +
    "#office-sales-notifications > .office-notif { font-size: calc(" + n.font + "px * " + s + "); padding: calc(" + n.padY + "px * " + s + ") calc(" + n.padX + "px * " + s + "); }\n" +
    // Full-screen menus (the copies screen, editors, stats) keep their buttons where the stack sits: hide it there.
    "html body #office-notifications { transition: opacity 0.2s ease; }\n" +
    "html body #office-notifications.dt-news-away, html body.dt-panel-open #office-notifications { opacity: 0; }\n";
  function add() {
    if (document.getElementById("dt-news-css")) return;
    var st = document.createElement("style");
    st.id = "dt-news-css";
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }
  if (typeof document !== "undefined") add();
})();
/* Called from the game's _layoutNotifs for the main stack, after it set each card's --notif-y.
 * cards: live cards oldest first; gap: css px between cards; leave: the game's _markNotifLeaving; ds: design scale. */
function _dtNewsTrim(host, cards, gap, leave, ds) {
  try {
    _dtNewsSync(host);
    var bottom = parseFloat(host.style.getPropertyValue("--office-notif-bottom"));
    if (!isFinite(bottom) || !(ds > 0)) return 0;
    var top = Math.max(0, (window.innerHeight - 1080 * ds) / 2) + _DT_NEWS.top * ds;
    var room = window.innerHeight - bottom - top, used = 0, gone = 0;
    // The same text twice (the game saves twice at a year end): the new card replaces the old one.
    var last = cards[cards.length - 1], text = last && last.textContent;
    if (text) {
      for (var j = cards.length - 2; j >= 0; j--) {
        if (cards[j].textContent === text) { leave(cards[j]); cards = cards.slice(0, j).concat(cards.slice(j + 1)); gone++; }
      }
    }
    for (var i = cards.length - 1; i >= 0; i--) {
      used += cards[i].offsetHeight + (i < cards.length - 1 ? gap : 0);
      if (i < cards.length - 1 && used > room) { leave(cards[i]); gone++; }
    }
    return gone;
  } catch (e) { return 0; }
}
/* The stack shows only on the office screens (the work rooms and the boss office, where the day runs and the
 * bottom menu leaves room for it), the same screens as the mods dock. Checked when a card comes or goes and
 * when the screen changes. */
var _dtNewsHooked = false;
function _dtNewsOffice(n) {
  return n === "GAMEPLAY" || (/ OFFICE( \d+)?$/.test(n) && !/UPGRADE/.test(n));
}
function _dtNewsSync(host, name) {
  try {
    var rt = globalThis.runtime;
    if (!rt) return;
    if (!_dtNewsHooked && typeof rt.addEventListener === "function") {
      _dtNewsHooked = true;
      rt.addEventListener("beforeanylayoutstart", function (ev) { _dtNewsSync(null, ev && ev.layout && ev.layout.name); });
    }
    host = host || document.getElementById("office-notifications");
    if (!host || !host.classList) return;
    if (name === undefined || name === null) name = rt.layout && rt.layout.name;
    host.classList.toggle("dt-news-away", !_dtNewsOffice(String(name || "")));
  } catch (e) {}
}
