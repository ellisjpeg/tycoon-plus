# News patch (`DEVICES_TYCOON_NEWS`, default on)

Makes the game's own office news cards (bottom right, `#office-notifications`: "Manufacturers raised the motor
control rate to 12 kHz", assistant tips, budget warnings) readable. Last step of the build, after BOARD.

- Text 19.5 design px instead of 15: 13 px in a 1280x720 window, 19.5 px at 1920x1080 (mod toasts are 21, so the
  game's cards never read larger than ours). Scales with the window through the game's `--office-notif-scale`.
- Card 320 design px wide at least, grows with its text up to 560, at most 3 lines (every English news text fits
  in 3; `-webkit-line-clamp` is only a guard). Same colours, font, gold/red highlights, glass, slide-in and timing.
- Stack: same bottom-right anchor (180 design px above the layout bottom, clear of the bottom menu and the
  delivery text/bar). The top is capped at 570 design px so it stays below the work rooms' PROGRAMMING / BUGS
  circles: when the next card would not fit, the oldest slides out early with the game's own leave animation
  (`_dtNewsTrim`, called from the game's `_layoutNotifs`). Our toasts still step above the cards (mods-ui).
- Shown only on the office screens (work rooms, boss office: the same screens as the mods dock). The game posts
  news on every screen, so on full-screen menus the stack covered their bottom-right button (the copies screen's
  price button); there it fades out (`dt-news-away`, set on every card change and on `beforeanylayoutstart`).
- Untouched: the sales stack under the office panel (`#office-sales-notifications`), the game's 3 s / 7 s timing.

Code: `prepare.py` (checks the game's notification CSS/JS, one hook in `_layoutNotifs`, appends `news.js`),
`news.js` (style override + `_dtNewsTrim`), `test_news.py` (hook, game-change failures, sizes, trim cases in node,
flag-off byte identity).
