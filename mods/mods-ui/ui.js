// ── Shared look for the gameplay patches (launch days, difficulty, queue) ──
// Copies the game's own settings page language: dark glass panel, gold
// gradient accents, Sofia Sans Extra Condensed, 1920x1080 design units
// scaled to the canvas. Panels are plain DOM over the canvas, so they take
// mouse clicks and touches alike.
var _dtUi = (function () {
  const DESIGN_W = 1920;
  const DESIGN_H = 1080;
  const CSS = `
@font-face { font-family: "SofiaSansExtraCondensed-Light"; src: url("/fonts/SofiaSansExtraCondensed-Light.ttf") format("truetype"); font-weight: normal; font-style: normal; font-display: block; }
@font-face { font-family: "SofiaSansExtraCondensed-Regular"; src: url("/fonts/SofiaSansExtraCondensed-Regular.ttf") format("truetype"); font-weight: normal; font-style: normal; font-display: block; }
@font-face { font-family: "SofiaSansExtraCondensed-Medium"; src: url("/fonts/SofiaSansExtraCondensed-Medium.ttf") format("truetype"); font-weight: normal; font-style: normal; font-display: block; }
@font-face { font-family: "SofiaSansExtraCondensed-SemiBold"; src: url("/fonts/SofiaSansExtraCondensed-SemiBold.ttf") format("truetype"); font-weight: normal; font-style: normal; font-display: block; }
@font-face { font-family: "SofiaSansExtraCondensed-Bold"; src: url("/fonts/SofiaSansExtraCondensed-Bold.ttf") format("truetype"); font-weight: normal; font-style: normal; font-display: block; }
.dt-layer { position: fixed; z-index: 10000; pointer-events: none; --dt: 1;
  font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif; color: #fff;
  user-select: none; -webkit-user-select: none; }
.dt-layer, .dt-layer * { box-sizing: border-box; }
.dt-layer input, .dt-layer select, .dt-layer textarea, .dt-layer button { font-family: inherit; }
/* ── Pop-ups: the game's own news box (#office-news-overlay: "hold a presentation?"),
   agreed 2 Nov 2026 (s-nv-*). Values measured from the running game: frosted
   card 780 x 400, white title over a fading hairline, centred white text, the
   game's red NO and green YES buttons; a white outline for a second choice.
   Like the game, the glass only fades and the contents rise. Design px. ── */
@keyframes dt-fade { from { opacity: 0; } }
@keyframes dt-in { from { opacity: 0; transform: translateY(calc(var(--dt) * 30px)) scale(0.975); } }
@keyframes dt-out { to { opacity: 0; transform: translateY(calc(var(--dt) * 12px)) scale(0.95); } }
@keyframes dt-fade-out { to { opacity: 0; } }
@keyframes dt-dim-in { from { background-color: rgba(4, 10, 20, 0); } }
@keyframes dt-dim-out { to { background-color: rgba(4, 10, 20, 0); } }
@keyframes dt-rise { from { opacity: 0; transform: translateY(calc(var(--dt) * 26px)) scale(0.94); } }
.dt-dim { position: absolute; inset: 0; pointer-events: auto; background: rgba(4, 10, 20, 0.46);
  display: flex; align-items: center; justify-content: center;
  animation: dt-dim-in 0.24s ease-out backwards; }
.dt-closing { pointer-events: none; animation: dt-dim-out 0.22s ease-in forwards; }
.dt-card { width: calc(var(--dt) * 780px); min-height: calc(var(--dt) * 400px); max-height: calc(var(--dt) * 1000px); }
.dt-card.dt-wide { width: calc(var(--dt) * 900px); }
.dt-layer .dt-card { position: relative; isolation: isolate; display: flex; flex-direction: column; overflow: visible;
  border: 0; border-radius: calc(var(--dt) * 16px); background: none; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none;
  font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif; color: #fff; animation: none; }
.dt-layer .dt-card::before { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  border-radius: inherit; background: rgba(12, 15, 22, 0.52); border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(calc(var(--dt) * 16px)) saturate(1.25); -webkit-backdrop-filter: blur(calc(var(--dt) * 16px)) saturate(1.25);
  box-shadow: 0 calc(var(--dt) * 30px) calc(var(--dt) * 80px) calc(var(--dt) * -20px) rgba(0, 0, 0, 0.65),
    inset 0 0 calc(var(--dt) * 24px) calc(var(--dt) * -8px) rgba(255, 255, 255, 0.18);
  animation: dt-fade 0.22s ease-out backwards; }
.dt-closing .dt-card::before { animation: dt-fade-out 0.22s ease-in forwards; }
.dt-layer .dt-card > * { animation: dt-rise 0.34s cubic-bezier(0.3, 1.35, 0.45, 1) backwards; }
.dt-closing .dt-card > * { animation: dt-out 0.22s ease-in forwards; }
.dt-layer .dt-head { flex: 0 0 auto; display: block; height: auto; padding: calc(var(--dt) * 26px) calc(var(--dt) * 48px) 0; }
.dt-layer .dt-head::after { content: ""; display: block; position: static; height: 1px; margin: calc(var(--dt) * 16px) 0 calc(var(--dt) * 10px);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.28) 18%, rgba(255, 255, 255, 0.28) 82%, transparent 100%); }
.dt-head .dt-bar { display: none; }
.dt-layer .dt-title { font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif; font-size: calc(var(--dt) * 34px);
  line-height: 1.2; text-transform: uppercase; letter-spacing: 0; text-align: center; color: #fff;
  text-shadow: 0 calc(var(--dt) * 2px) calc(var(--dt) * 8px) rgba(0, 0, 0, 0.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dt-layer .dt-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; justify-content: flex-start;
  padding: 0 calc(var(--dt) * 48px); font-size: calc(var(--dt) * 26px); line-height: 1.5; color: #fff;
  text-shadow: 0 calc(var(--dt) * 2px) calc(var(--dt) * 6px) rgba(0, 0, 0, 0.45); }
/* Zero specificity: a mod's own scroll area (Sales board) still grows to fill the card. */
:where(.dt-layer .dt-body > *) { flex-shrink: 0; }
/* A plain message, as in the game's box: centred lines, in the middle of the card. */
.dt-layer .dt-msg { text-align: center; }
.dt-layer .dt-body:has(> .dt-msg) { justify-content: safe center; }
.dt-hl, .dt-layer .dt-body em { font-style: normal; color: #FFD600; }
.dt-gold { color: rgb(255, 236, 170); }
.dt-layer .dt-card .dt-note { font-size: calc(var(--dt) * 22px); line-height: 1.4; color: rgba(255, 255, 255, 0.62); margin-top: calc(var(--dt) * 12px); }
.dt-layer .dt-foot { flex: 0 0 auto; display: flex; flex-wrap: nowrap; align-items: center; justify-content: center;
  gap: calc(var(--dt) * 56px); padding: calc(var(--dt) * 18px) calc(var(--dt) * 48px) calc(var(--dt) * 30px); }
/* Buttons: the game's .office-news-btn. White outline = second choice; .dt-no red, .dt-yes / .dt-main green. */
.dt-layer .dt-card .dt-btn { min-width: calc(var(--dt) * 224px); height: calc(var(--dt) * 48px); padding: 0 calc(var(--dt) * 28px);
  border-radius: calc(var(--dt) * 8px); font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif;
  font-size: calc(var(--dt) * 24px); letter-spacing: 0; text-transform: uppercase; white-space: nowrap; color: #fff;
  text-shadow: 0 calc(var(--dt) * 1px) calc(var(--dt) * 3px) rgba(0, 0, 0, 0.35);
  background: transparent; box-shadow: inset 0 0 0 calc(var(--dt) * 2px) rgba(255, 255, 255, 0.55); filter: none; transform: none;
  transition: transform 0.16s ease, filter 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease; }
.dt-layer .dt-card .dt-btn:hover { transform: translateY(calc(var(--dt) * -2px)); filter: brightness(1.12); }
.dt-layer .dt-card .dt-btn:active { transform: translateY(0) scale(0.96); filter: brightness(0.95); }
.dt-layer .dt-card .dt-btn.dt-yes, .dt-layer .dt-card .dt-btn.dt-main { color: #fff;
  background: linear-gradient(180deg, rgb(168, 212, 24) 0%, rgb(99, 179, 3) 100%);
  box-shadow: 0 calc(var(--dt) * 6px) calc(var(--dt) * 18px) calc(var(--dt) * -6px) rgba(120, 190, 20, 0.55); }
.dt-layer .dt-card .dt-btn.dt-yes:hover, .dt-layer .dt-card .dt-btn.dt-main:hover {
  box-shadow: 0 calc(var(--dt) * 10px) calc(var(--dt) * 24px) calc(var(--dt) * -6px) rgba(120, 190, 20, 0.75); }
.dt-layer .dt-card .dt-btn.dt-no { color: #fff; background: linear-gradient(180deg, rgb(255, 95, 107) 0%, rgb(243, 64, 91) 100%);
  box-shadow: 0 calc(var(--dt) * 6px) calc(var(--dt) * 18px) calc(var(--dt) * -6px) rgba(244, 63, 91, 0.55); }
.dt-layer .dt-card .dt-btn.dt-no:hover { box-shadow: 0 calc(var(--dt) * 10px) calc(var(--dt) * 24px) calc(var(--dt) * -6px) rgba(244, 63, 91, 0.75); }
/* Small choices (quick picks, tabs): thin outline; the picked one fills white. */
.dt-layer .dt-card .dt-btn.dt-small { min-width: 0; height: calc(var(--dt) * 38px); padding: 0 calc(var(--dt) * 18px);
  font-size: calc(var(--dt) * 21px); text-transform: none; color: rgba(255, 255, 255, 0.8);
  box-shadow: inset 0 0 0 calc(var(--dt) * 1.5px) rgba(255, 255, 255, 0.3); }
.dt-layer .dt-card .dt-btn.dt-small:hover { filter: none; color: #fff; background-color: rgba(255, 255, 255, 0.08); }
.dt-layer .dt-card .dt-btn.dt-small.dt-main { color: #fff; box-shadow: none; }
.dt-layer .dt-card .dt-btn.dt-on { color: #fff; background: rgba(255, 255, 255, 0.18);
  box-shadow: inset 0 0 0 calc(var(--dt) * 1.5px) rgba(255, 255, 255, 0.7); }
.dt-layer .dt-card .dt-btn.dt-on .dt-badge { color: rgba(255, 255, 255, 0.72); }
.dt-layer .dt-card .dt-btn.dt-glyph { min-width: calc(var(--dt) * 44px); width: calc(var(--dt) * 44px); height: calc(var(--dt) * 44px);
  padding: 0; font-size: calc(var(--dt) * 26px); color: #fff; background: transparent;
  box-shadow: inset 0 0 0 calc(var(--dt) * 1.5px) rgba(255, 255, 255, 0.35); }
.dt-layer .dt-card .dt-btn[disabled] { opacity: 0.3; pointer-events: none; }
/* Rows: plain lines split by a hairline, like the game's tables. */
.dt-layer .dt-card .dt-row { display: flex; align-items: center; gap: calc(var(--dt) * 16px); min-height: 0; margin: 0;
  padding: calc(var(--dt) * 14px) 0; border: 0; border-radius: 0; background: none; box-shadow: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12); }
.dt-layer .dt-card .dt-row:last-child { border-bottom: 0; }
.dt-layer .dt-card .dt-label { font-size: calc(var(--dt) * 26px); line-height: 1.2; color: #fff; }
.dt-layer .dt-card .dt-sub { font-size: calc(var(--dt) * 21px); line-height: 1.3; color: rgba(255, 255, 255, 0.6); }
.dt-layer .dt-card .dt-value { font-size: calc(var(--dt) * 21px); color: rgba(255, 255, 255, 0.72); }
.dt-layer .dt-card .dtq-input, .dt-layer .dt-card .dtq-select { height: calc(var(--dt) * 52px); border-radius: calc(var(--dt) * 8px);
  padding: 0 calc(var(--dt) * 16px); font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif;
  font-size: calc(var(--dt) * 25px); letter-spacing: 0; text-shadow: none; background: rgba(0, 0, 0, 0.25);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2); }
.dt-layer .dt-card .dtq-input:focus, .dt-layer .dt-card .dtq-select:focus { box-shadow: inset 0 0 0 calc(var(--dt) * 1.5px) rgba(255, 255, 255, 0.6); }
.dt-bar { flex: 0 0 auto; width: calc(var(--dt) * 6px); height: calc(var(--dt) * 38px); border-radius: 999px;
  background: linear-gradient(180deg, rgb(255, 214, 0), rgb(255, 158, 20));
  box-shadow: 0 0 calc(var(--dt) * 14px) rgba(255, 214, 0, 0.55); }
.dt-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: calc(var(--dt) * 60px);
  padding: calc(var(--dt) * 16px) calc(var(--dt) * 48px) calc(var(--dt) * 30px); }
.dt-btn { pointer-events: auto; display: inline-flex; align-items: center; justify-content: center;
  box-sizing: border-box; min-width: calc(var(--dt) * 224px); height: calc(var(--dt) * 46px);
  padding: 0 calc(var(--dt) * 28px);
  border-radius: calc(var(--dt) * 14px); cursor: pointer;
  font-family: "SofiaSansExtraCondensed-Bold", "Oswald", sans-serif; font-size: calc(var(--dt) * 22px);
  line-height: 1; text-transform: uppercase; letter-spacing: calc(var(--dt) * 0.4px); color: #fff;
  text-shadow: 0 calc(var(--dt) * 1px) calc(var(--dt) * 3px) rgba(0, 0, 0, 0.35);
  background-color: rgba(255, 255, 255, 0.07); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
  transition: background-color 0.16s ease, color 0.16s ease, transform 0.16s ease, filter 0.16s ease, box-shadow 0.16s ease; }
.dt-btn:hover { color: #fff; background-color: rgba(255, 255, 255, 0.12); transform: translateY(calc(var(--dt) * -2px)); filter: brightness(1.12); }
.dt-btn:active { transform: translateY(0) scale(0.96); filter: brightness(0.95); }
.dt-btn.dt-main { color: rgb(38, 26, 0); text-shadow: none;
  background-image: linear-gradient(170deg, rgb(255, 232, 120), rgb(255, 214, 0) 45%, rgb(255, 158, 20));
  box-shadow: inset 0 calc(var(--dt) * 1px) 0 rgba(255, 255, 255, 0.60),
    0 calc(var(--dt) * 3px) calc(var(--dt) * 10px) rgba(255, 158, 20, 0.32); }
.dt-btn.dt-main:hover { filter: brightness(1.06); }
.dt-btn.dt-yes { color: #fff; background-image: linear-gradient(180deg, rgb(168, 212, 24), rgb(99, 179, 3));
  box-shadow: 0 calc(var(--dt) * 6px) calc(var(--dt) * 18px) calc(var(--dt) * -6px) rgba(120, 190, 20, 0.55); }
.dt-btn.dt-no { color: #fff; background-image: linear-gradient(180deg, rgb(255, 95, 107), rgb(243, 64, 91));
  box-shadow: 0 calc(var(--dt) * 6px) calc(var(--dt) * 18px) calc(var(--dt) * -6px) rgba(244, 63, 91, 0.55); }
.dt-btn.dt-small { min-width: 0; height: calc(var(--dt) * 44px); padding: 0 calc(var(--dt) * 16px); font-size: calc(var(--dt) * 20px); }
.dt-btn.dt-glyph { min-width: calc(var(--dt) * 32px); width: calc(var(--dt) * 32px); height: calc(var(--dt) * 32px);
  padding: 0; border-radius: calc(var(--dt) * 6px); font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif;
  font-size: calc(var(--dt) * 22px); letter-spacing: 0; color: rgba(255, 255, 255, 0.76);
  background: transparent; box-shadow: none; }
.dt-btn.dt-glyph:hover { color: #fff; background: rgba(255, 255, 255, 0.10); transform: none; filter: none; }
.dt-btn[disabled] { opacity: 0.26; pointer-events: none; }
.dt-btn.dt-on { color: #fff; background-image: linear-gradient(180deg, rgba(255, 214, 0, 0.30), rgba(255, 158, 20, 0.16));
  box-shadow: inset 0 0 0 1px rgba(255, 214, 0, 0.55); }
.dt-row { display: flex; align-items: center; gap: calc(var(--dt) * 12px); padding: calc(var(--dt) * 8px) 0;
  min-height: calc(var(--dt) * 46px); border-bottom: 1px solid rgba(255, 255, 255, 0.07); }
.dt-row:last-child { border-bottom: 0; }
.dt-grow { flex: 1 1 auto; min-width: 0; }
.dt-label { font-size: calc(var(--dt) * 23px); line-height: 1.15; color: #fff; }
.dt-sub { font-size: calc(var(--dt) * 17px); line-height: 1.25; color: rgba(255, 255, 255, 0.52); }
.dt-value { min-width: calc(var(--dt) * 72px); text-align: right; font-size: calc(var(--dt) * 20px); color: rgba(255, 255, 255, 0.72); }
.dt-date { min-width: calc(var(--dt) * 250px); text-align: center; font-size: calc(var(--dt) * 34px); color: rgb(255, 236, 170); }
.dt-chips { display: flex; flex-wrap: wrap; align-items: center; gap: calc(var(--dt) * 10px); margin-top: calc(var(--dt) * 14px); }
.dt-range { pointer-events: auto; -webkit-appearance: none; appearance: none; width: calc(var(--dt) * 280px);
  height: calc(var(--dt) * 22px); border-radius: 999px; background: transparent; outline: none; }
.dt-range::-webkit-slider-runnable-track { height: calc(var(--dt) * 16px); border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.92) 0 var(--dt-p, 50%), rgba(255, 255, 255, 0.22) var(--dt-p, 50%) 100%);
  box-shadow: inset 0 calc(var(--dt) * 1px) calc(var(--dt) * 2px) rgba(0, 0, 0, 0.22), inset 0 calc(var(--dt) * -1px) 0 rgba(255, 255, 255, 0.25); }
.dt-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: calc(var(--dt) * 22px); height: calc(var(--dt) * 22px);
  margin-top: calc(var(--dt) * -3px); border: calc(var(--dt) * 2px) solid rgba(255, 255, 255, 0.9); border-radius: 50%;
  background: radial-gradient(circle at 50% 35%, #fff, #eef1f5); cursor: pointer;
  box-shadow: 0 calc(var(--dt) * 2px) calc(var(--dt) * 6px) rgba(0, 0, 0, 0.35), 0 0 0 calc(var(--dt) * 1px) rgba(0, 0, 0, 0.06); }
.dt-range::-moz-range-track { height: calc(var(--dt) * 16px); border-radius: 999px; background: rgba(255, 255, 255, 0.22); }
.dt-range::-moz-range-progress { height: calc(var(--dt) * 16px); border-radius: 999px; background: rgba(255, 255, 255, 0.92); }
.dt-range::-moz-range-thumb { width: calc(var(--dt) * 22px); height: calc(var(--dt) * 22px);
  border: calc(var(--dt) * 2px) solid rgba(255, 255, 255, 0.9); border-radius: 50%;
  background: radial-gradient(circle at 50% 35%, #fff, #eef1f5); box-shadow: 0 calc(var(--dt) * 2px) calc(var(--dt) * 6px) rgba(0, 0, 0, 0.35); }
.dt-dock { position: absolute; left: calc(var(--dt) * 38px); top: calc(var(--dt) * 109px); display: flex; flex-direction: column;
  align-items: flex-start; gap: calc(var(--dt) * 28px); }
.dt-chip { pointer-events: auto; position: relative; display: flex; align-items: center; justify-content: center;
  width: calc(var(--dt) * 370px); height: calc(var(--dt) * 77px);
  padding: 0 calc(var(--dt) * 24px);
  border-radius: 999px; cursor: pointer;
  font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif; font-size: calc(var(--dt) * 32px);
  line-height: 1; text-transform: none; letter-spacing: 0;
  color: rgba(255, 255, 255, 0.80);
  background: rgba(6, 30, 48, 0.52);
  backdrop-filter: blur(10px) saturate(1.15); -webkit-backdrop-filter: blur(10px) saturate(1.15);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12), inset 0 calc(var(--dt) * 1px) 0 rgba(255, 255, 255, 0.06);
  text-shadow: 0 calc(var(--dt) * 1px) calc(var(--dt) * 2px) rgba(0, 0, 0, 0.25);
  animation: dt-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards; transition: background-color 0.14s ease, transform 0.1s ease; }
.dt-chip:hover { background-color: rgba(8, 36, 56, 0.62); }
.dt-chip:active { transform: scale(0.98); }
.dt-chip .dt-bar { display: none; }
.dt-chip-icon { position: absolute; left: calc(var(--dt) * 18px); top: 50%; width: calc(var(--dt) * 42px); height: calc(var(--dt) * 42px);
  margin-top: calc(var(--dt) * -21px); color: rgba(210, 224, 236, 0.55); }
.dt-chip-icon svg { display: block; width: 100%; height: 100%; }
.dt-chip-text { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dt-chip .dt-badge { flex: 0 0 auto; margin-left: calc(var(--dt) * 8px);
  font-size: inherit; letter-spacing: 0; color: rgba(255, 255, 255, 0.62); }
.dt-badge { padding: 0; height: auto; display: flex; align-items: center; border-radius: 0;
  font-size: calc(var(--dt) * 18px); letter-spacing: calc(var(--dt) * 0.5px); color: rgba(255, 255, 255, 0.58);
  background: none; }
/* A badge inside a gold (selected) button reads dark, like the button text. */
.dt-btn.dt-on .dt-badge, .dt-btn.dt-main .dt-badge { color: rgba(38, 26, 0, 0.72); text-shadow: none; }
.dt-layer .dtq-input, .dt-layer .dtq-select { height: calc(var(--dt) * 44px); border-radius: calc(var(--dt) * 8px);
  padding: 0 calc(var(--dt) * 14px); font-family: "SofiaSansExtraCondensed-Light", "Oswald", sans-serif;
  font-size: calc(var(--dt) * 22px); letter-spacing: calc(var(--dt) * 0.4px); color: #fff;
  background: rgba(255, 255, 255, 0.06); color-scheme: dark; outline: none;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18); }
.dt-layer .dtq-input::placeholder { color: rgba(255, 255, 255, 0.35); }
.dt-layer .dtq-select option { color: #fff; background: #121722; }
.dt-layer .dtq-select:focus, .dt-layer .dtq-input:focus {
  box-shadow: inset 0 0 0 calc(var(--dt) * 1.5px) rgba(255, 255, 255, 0.55), 0 0 0 calc(var(--dt) * 3px) rgba(255, 255, 255, 0.06); }
.dt-layer .dtq-form { margin-top: calc(var(--dt) * 8px); padding-top: calc(var(--dt) * 10px); border-top: 1px solid rgba(255, 255, 255, 0.10); }
.dt-layer .dtq-form > .dt-label { text-transform: uppercase; letter-spacing: calc(var(--dt) * 1.2px);
  font-family: "SofiaSansExtraCondensed-Bold", "Oswald", sans-serif; font-size: calc(var(--dt) * 21px); color: #fff; }
.dt-layer .dtq-field { display: flex; flex-direction: column; gap: calc(var(--dt) * 5px); flex: 1 1 0; min-width: 0; }
.dt-layer .dtq-field > .dt-sub { text-transform: uppercase; letter-spacing: calc(var(--dt) * 1.2px);
  font-size: calc(var(--dt) * 15px); color: rgba(255, 255, 255, 0.50); }
.dt-layer .dtq-warn { margin-top: calc(var(--dt) * 8px); font-size: calc(var(--dt) * 18px); color: rgba(255, 255, 255, 0.45); }
/* ── Closer to the game's own panels ── */
/* Buttons: the game's gold recipe, 12px radius, hover lift, quick press. */
.dt-btn { height: calc(var(--dt) * 48px); border-radius: calc(var(--dt) * 12px);
  transition: background 0.16s ease, color 0.16s ease, filter 0.16s ease, box-shadow 0.16s ease,
    transform 0.16s cubic-bezier(0.22, 1, 0.36, 1); }
.dt-btn:hover { transform: translateY(calc(var(--dt) * -2px)); }
.dt-btn:active { transform: scale(0.97); transition-duration: 0.09s; }
.dt-btn.dt-main, .dt-btn.dt-on { color: rgb(38, 26, 0);
  background-image: linear-gradient(170deg, #FFE878, #FFD600 45%, #FF9E14);
  box-shadow: inset 0 calc(var(--dt) * 1px) 0 rgba(255, 255, 255, 0.60),
    0 calc(var(--dt) * 3px) calc(var(--dt) * 10px) rgba(255, 158, 20, 0.32); }
.dt-btn.dt-main:hover, .dt-btn.dt-on:hover { filter: brightness(1.1);
  box-shadow: inset 0 calc(var(--dt) * 1px) 0 rgba(255, 255, 255, 0.60),
    0 calc(var(--dt) * 6px) calc(var(--dt) * 18px) rgba(255, 158, 20, 0.42); }
.dt-btn.dt-small { height: calc(var(--dt) * 40px); border-radius: 999px; padding: 0 calc(var(--dt) * 20px); }
.dt-btn.dt-glyph { border-radius: calc(var(--dt) * 10px); }
/* Sliders: thicker track and a thumb you can actually see and grab. */
.dt-range { height: calc(var(--dt) * 30px); }
.dt-range::-webkit-slider-runnable-track { height: calc(var(--dt) * 6px);
  background: linear-gradient(90deg, #FF9E14, #FFD600 var(--dt-p, 50%), rgba(255, 255, 255, 0.14) var(--dt-p, 50%));
  box-shadow: inset 0 calc(var(--dt) * 1px) calc(var(--dt) * 2px) rgba(0, 0, 0, 0.35); }
.dt-range::-webkit-slider-thumb { width: calc(var(--dt) * 22px); height: calc(var(--dt) * 22px); margin-top: calc(var(--dt) * -8px);
  background: radial-gradient(circle at 50% 35%, #fff, #E8ECF3);
  box-shadow: 0 calc(var(--dt) * 2px) calc(var(--dt) * 6px) rgba(0, 0, 0, 0.45), 0 0 0 calc(var(--dt) * 3px) rgba(255, 214, 0, 0.35);
  transition: transform 0.14s ease; }
.dt-range:hover::-webkit-slider-thumb { transform: scale(1.1); }
/* Dock chips: same shape as the top bar pills. */
.dt-chip { height: calc(var(--dt) * 46px); border-radius: calc(var(--dt) * 14px); padding: 0 calc(var(--dt) * 20px);
  font-size: calc(var(--dt) * 21px); background: rgba(9, 14, 28, 0.55);
  transition: background 0.16s ease, transform 0.16s cubic-bezier(0.22, 1, 0.36, 1);
  animation: dt-in 0.22s cubic-bezier(0.22, 1, 0.36, 1) backwards; }
.dt-chip:hover { transform: translateY(calc(var(--dt) * -2px)); }
/* Toast off the office screens: a copy of the game's own news card (.office-notif,
   sized as news-patches shows it) in the same corner, sliding in and out the same way.
   On the office screens toast() puts the card in the game's own stack instead. */
.dt-toast { position: absolute; right: calc(var(--dt) * 24px); bottom: calc(var(--dt) * 180px); left: auto; top: auto;
  width: max-content; min-width: calc(var(--dt) * 320px); max-width: calc(var(--dt) * 560px); box-sizing: border-box;
  padding: calc(var(--dt) * 14px) calc(var(--dt) * 18px); border-radius: calc(var(--dt) * 14px);
  font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif; font-size: calc(var(--dt) * 19.5px);
  line-height: 1.4; letter-spacing: 0.3px; text-align: left; white-space: normal; overflow-wrap: break-word;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;
  color: rgba(255, 255, 255, 0.95); background: rgba(0, 0, 0, 0.65); border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(16px) saturate(1.5); -webkit-backdrop-filter: blur(16px) saturate(1.5);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out;
  animation: dt-toast-in 0.45s cubic-bezier(0.4, 0, 0.2, 1) backwards; }
.dt-toast .dt-hl { color: #FFD600; }
@keyframes dt-toast-in { from { opacity: 0; transform: translateX(calc(var(--dt) * 32px)); } }
.dt-toast.dt-toast-out { animation: dt-toast-out 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
@keyframes dt-toast-out { to { opacity: 0; transform: translateX(calc(var(--dt) * 32px)); } }
/* Side buttons sized like the top bar pills; presets get room above the first row. */
.dt-chip { height: calc(var(--dt) * 60px); border-radius: calc(var(--dt) * 18px); padding: 0 calc(var(--dt) * 24px);
  font-family: "SofiaSansExtraCondensed-Bold", "Oswald", sans-serif; font-size: calc(var(--dt) * 25px);
  background: rgba(40, 44, 62, 0.58);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.10), inset 0 calc(var(--dt) * 1px) 0 rgba(255, 255, 255, 0.14),
    0 calc(var(--dt) * 6px) calc(var(--dt) * 18px) rgba(0, 0, 0, 0.25); }
.dt-chip:hover { background: rgba(56, 60, 82, 0.72); }
.dt-dock { gap: calc(var(--dt) * 10px); }
.dt-chips { margin-bottom: calc(var(--dt) * 12px); }
/* Settings rows as soft glass strips, like the game's ratings rows. */
.dt-row { border: 0; border-radius: calc(var(--dt) * 12px); padding: calc(var(--dt) * 10px) calc(var(--dt) * 16px);
  margin-top: calc(var(--dt) * 7px);
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.03));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08); }
/* No panel text under 21 design px (14 px in a 1280x720 window). */
.dt-body, .dt-value, .dt-badge, .dt-note, .dt-sub,
.dt-layer .dtq-field > .dt-sub, .dt-layer .dtq-warn { font-size: calc(var(--dt) * 21px); }
.dt-btn.dt-small { font-size: calc(var(--dt) * 21px); }
`;
  let layer = null;
  let dock = null;
  let open = null;
  let closingPanel = null;
  let visTimer = null;
  // One shared 250 ms timer for every mod's background check, instead of one
  // timer each. Checks run in the order they were added, each at its own rate
  // (a multiple of 250 ms) and in its own try/catch, so one failing check
  // never stops the others (its error still reaches the console). every(fn, ms) takes setInterval's arguments.
  const jobs = [];
  let jobTimer = null, jobRound = 0;
  function runJobs() {
    jobRound++;
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i];
      if (j.off || jobRound % j.n) continue;
      try { j.fn(); } catch (e) { if (typeof console !== "undefined") console.error("[Tycoon+] check:", e); }
    }
  }
  function every(fn, ms) {
    const job = { fn: fn, n: Math.max(1, Math.round((Number(ms) || 250) / 250)), off: false };
    jobs.push(job);
    if (!jobTimer && typeof setInterval === "function") jobTimer = setInterval(runJobs, 250);
    return job;
  }
  // Stops a check from every() (or a plain timer id).
  function stopEvery(job) {
    if (job && typeof job === "object") job.off = true;
    else if (job && typeof clearInterval === "function") clearInterval(job);
  }

  function rt() {
    return globalThis.runtime || null;
  }
  function gv(name, dflt) {
    try {
      const v = rt().globalVars[name];
      return v === undefined || v === null ? dflt : v;
    } catch (e) {
      return dflt;
    }
  }
  function num(name, dflt) {
    const v = Number(gv(name, dflt));
    return Number.isFinite(v) ? v : dflt;
  }
  function ru() {
    return num("LanguageChoose", 0) === 1;
  }
  function t(entry, vars) {
    let s = ru() ? entry.ru : entry.en;
    for (const k in vars || {}) s = s.split("{" + k + "}").join(String(vars[k]));
    return s;
  }
  function el(tag, cls, parent, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  let lastLayout = "";
  function layoutName() {
    try {
      return (lastLayout = String(rt().layout.name || ""));
    } catch (e) {
      return "";
    }
  }
  // Between two layouts Construct runs none ("" above) while the next one loads
  // its images. Leaving an office, the chips stay as they are until it starts,
  // or each room change hid them and popped them back in.
  function leavingOffice() {
    if (!rt() || layoutName() !== "") return false;
    return isOffice(lastLayout);
  }
  function isOffice(n) {
    return n === "GAMEPLAY" || (/ OFFICE( \d+)?$/.test(n) && !/UPGRADE/.test(n));
  }
  // The office screens, where the day runs and the dock is shown.
  function onOffice() {
    return isOffice(layoutName());
  }
  // The chip rows are HUD, so they only exist on the live office screen: never
  // while one of our panels is up, during the close fade, or behind a game
  // pop-up / pause / other layout.
  function chipsVisible() {
    if (open || closingPanel) return false;
    if (leavingOffice()) return !!dock && dock.style.display !== "none";
    if (!onOffice()) return false;
    const cls = String(gv("class", "") || "");
    if (cls && cls !== "GAMEPLAY") return false;
    const assistant = String(gv("Assistant", "OFF")).toUpperCase();
    if (assistant && assistant !== "OFF" && assistant !== "FALSE" && assistant !== "0") return false;
    // The game's create-device picker covers the office: no HUD over it (as the other mods treat it).
    if (String(gv("CreateDevicesUI", "OFF") || "OFF").toUpperCase() !== "OFF") return false;
    // The game's own news pop-up dims the office from the DOM: the HUD goes with it.
    const news = document.getElementById("office-news-overlay");
    if (news && news.classList.contains("on-visible")) return false;
    return true;
  }
  let layoutHooked = false;
  // Placement reads layout (rects), so it only runs when something it depends on changed: a chip
  // added, renamed or removed, the HUD shown again, a new layout, a window or canvas resize, or the
  // game's device card changing size. Changes are coalesced to one pass per frame. The 250 ms check
  // and the layout hook only compare cheap state (globals, element identity).
  let hudShown = false;
  let measureDirty = true;
  let framePending = false;
  let watcher = null;
  let watchedCanvas = null;
  let watchedPanel = null;
  let credit = null;
  function markDirty() {
    measureDirty = true;
    if (framePending) return;
    if (typeof requestAnimationFrame !== "function") return syncDock();
    framePending = true;
    requestAnimationFrame(() => {
      framePending = false;
      syncDock();
    });
  }
  // Size watch on the canvas and the device card: no polling of their rects.
  function watch() {
    if (typeof ResizeObserver !== "function") {
      measureDirty = true; // no observer: measure on every check, as before
      return;
    }
    if (!watcher) watcher = new ResizeObserver(markDirty);
    if (!watchedCanvas || !watchedCanvas.isConnected) {
      const c = document.querySelector("canvas");
      if (c && c !== watchedCanvas) {
        watchedCanvas = c;
        watcher.observe(c);
        measureDirty = true;
      }
    }
    const p = document.getElementById("office-panel");
    if (p !== watchedPanel) {
      if (watchedPanel) watcher.unobserve(watchedPanel);
      watchedPanel = p;
      if (p) watcher.observe(p);
      measureDirty = true;
    }
  }
  // Tycoon+ credit (agreed style H): left middle, between the game's device card and its sales
  // messages. Text only, no box, not clickable. A tight dark halo keeps it readable on the light
  // rooms (Engineer's white brick, Design's lavender and beige floors; the small "by" line gets a firmer one)
  // and vanishes on dark ones. Behind it sits the
  // room title's very faint dark glow with no edges (same strength, sized to the credit); it moves with it.
  const CREDIT_CSS = `
.dt-credit { position: absolute; left: calc(var(--dt) * 58px); top: calc(var(--dt) * 516px); pointer-events: none;
  display: inline-flex; flex-direction: column; align-items: stretch; font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif;
  isolation: isolate; animation: dt-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards; }
.dt-credit::before { content: ""; position: absolute; z-index: -1; pointer-events: none;
  inset: calc(var(--dt) * -26px) calc(var(--dt) * -76px) calc(var(--dt) * -28px);
  background: radial-gradient(closest-side, rgba(0, 0, 0, 0.28), rgba(0, 0, 0, 0.22) 35%, rgba(0, 0, 0, 0.11) 65%, rgba(0, 0, 0, 0.03) 88%, transparent); }
.dt-credit-name { font-size: calc(var(--dt) * 36px); letter-spacing: calc(var(--dt) * 4px); line-height: 0.74; text-transform: uppercase;
  background: linear-gradient(#FFE878, #FFD600 50%, #FF9E14); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 0 calc(var(--dt) * 1px) rgba(0, 0, 0, 0.8)) drop-shadow(0 calc(var(--dt) * 1px) calc(var(--dt) * 6px) rgba(0, 0, 0, 0.6)); }
.dt-credit-rule { height: 1px; margin: calc(var(--dt) * 10px) 0 calc(var(--dt) * 9px);
  background: linear-gradient(90deg, rgba(255, 214, 0, 0.75), rgba(255, 255, 255, 0.2) 75%, transparent);
  box-shadow: 0 0 calc(var(--dt) * 10px) calc(var(--dt) * -2px) rgba(255, 214, 0, 0.6); }
.dt-credit-by { font-size: calc(var(--dt) * 18px); line-height: 0.62; letter-spacing: calc(var(--dt) * 0.5px); color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 0 calc(var(--dt) * 1px) rgba(0, 0, 0, 0.95), 0 0 calc(var(--dt) * 2.5px) rgba(0, 0, 0, 0.8), 0 calc(var(--dt) * 1px) calc(var(--dt) * 5px) rgba(0, 0, 0, 0.6);
  padding-bottom: calc(var(--dt) * 2px); }
.dt-layer.dt-hud-off .dt-hud { display: none; }
`;
  const CREDIT_TOP = 516; // design px with no card or a short one (mockup s-st-1)
  const CREDIT_BELOW_CARD = 65; // card bottom to the name's top
  const NOTIF_BELOW_CREDIT = 35; // credit bottom to the first sales message
  const CREDIT_MAX_TOP = 860; // lower would reach the bottom toolbar: the credit steps aside instead
  function ensureCredit() {
    if (credit && credit.isConnected) return credit;
    if (!document.getElementById("dt-credit-css")) {
      const st = el("style", "", document.head);
      st.id = "dt-credit-css";
      st.textContent = CREDIT_CSS;
    }
    credit = el("div", "dt-credit dt-hud", layer);
    el("div", "dt-credit-name", credit, "Tycoon+");
    el("div", "dt-credit-rule", credit);
    el("div", "dt-credit-by", credit, "by ellisjpeg_");
    measureDirty = true;
    return credit;
  }
  function syncDock() {
    if (!dock) return;
    // A screen that is not an office hides the dock in its first frame, not up to a tick later.
    const r = rt();
    if (!layoutHooked && r && typeof r.addEventListener === "function") {
      try {
        r.addEventListener("afteranylayoutstart", () => {
          measureDirty = true;
          syncDock();
        });
        layoutHooked = true;
      } catch (e) {}
    }
    ensureCredit();
    const visible = chipsVisible();
    const show = visible ? "" : "none";
    if (dock.style.display !== show) dock.style.display = show;
    if (layer.classList.contains("dt-hud-off") === visible) layer.classList.toggle("dt-hud-off", !visible);
    if (visible && !hudShown) measureDirty = true; // hidden things measure 0: place them again once shown
    hudShown = visible;
    watch();
    if (!measureDirty) return;
    measureDirty = false;
    // The game resizes its canvas after the window's resize event, so a fit
    // there alone reads the old size: the canvas watch (or this check) catches it.
    fit();
    // The game's own device card (#office-panel, top left after a launch)
    // uses the dock's spot: sit just below it while it is shown.
    let top = "", card = null, lr = null;
    const dt = parseFloat(layer.style.getPropertyValue && layer.style.getPropertyValue("--dt")) || 1;
    try {
      const p = watchedPanel || document.getElementById("office-panel");
      const b = p && p.getBoundingClientRect();
      if (b && b.width > 0 && b.height > 0) {
        card = b;
        lr = layer.getBoundingClientRect();
        top = Math.round(b.top + b.height - lr.top + 12 * dt) + "px";
      }
    } catch (e) {}
    if (dock.style.top !== top) dock.style.top = top;
    // The credit sits below the card (and below any chips under it), never above its own spot.
    // The game's sales toasts also hang under that card: news-patches starts them below the
    // credit instead (screen px past the card's bottom).
    let shift = 0;
    try {
      if (card && visible) {
        let low = card.top + card.height - lr.top + (CREDIT_BELOW_CARD - 12) * dt;
        const d = dock.children.length ? dock.getBoundingClientRect() : null;
        if (d && d.height > 0) low = Math.max(low, d.top + d.height - lr.top);
        const want = Math.max(CREDIT_TOP, Math.round((low + 12 * dt) / dt));
        const room = want <= CREDIT_MAX_TOP;
        const v = "calc(var(--dt) * " + Math.min(want, CREDIT_MAX_TOP) + "px)";
        if (credit.style.top !== v) credit.style.top = v;
        if (credit.style.visibility !== (room ? "" : "hidden")) credit.style.visibility = room ? "" : "hidden";
        const c = room ? credit.getBoundingClientRect() : null;
        if (c && c.height > 0) shift = Math.max(0, Math.round(c.top + c.height + NOTIF_BELOW_CREDIT * dt - card.top - card.height - 12 * dt));
      } else {
        if (credit.style.top) credit.style.top = "";
        if (credit.style.visibility) credit.style.visibility = "";
      }
    } catch (e) {}
    globalThis._dtSalesNotifShift = shift;
  }
  function canvasRect() {
    const c = document.querySelector("canvas");
    const r = c ? c.getBoundingClientRect() : null;
    if (!r || !r.width) return { left: 0, top: 0, width: innerWidth, height: innerHeight };
    // Letterboxed canvas: fit the 16:9 design area inside the element.
    const s = Math.min(r.width / DESIGN_W, r.height / DESIGN_H);
    const w = DESIGN_W * s;
    const h = DESIGN_H * s;
    return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
  }
  let fitKey = "";
  function fit() {
    if (!layer) return;
    const r = canvasRect();
    const key = [r.left, r.top, r.width, r.height].join(",");
    if (key === fitKey) return;
    fitKey = key;
    Object.assign(layer.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    layer.style.setProperty("--dt", String(r.width / DESIGN_W || 1));
  }
  function ensure() {
    if (layer && layer.isConnected) return layer;
    if (!document.getElementById("dt-mods-css")) {
      const st = el("style", "", document.head);
      st.id = "dt-mods-css";
      st.textContent = CSS;
    }
    layer = el("div", "dt-layer", document.body);
    fitKey = "";
    // Keep presses on a panel away from the game's own window listeners, so
    // nothing under a panel is clicked as well. Touches reach Construct through
    // the window as well, so this covers them too.
    for (const type of ["pointerdown", "pointerup", "pointermove", "mousedown", "mouseup", "click", "dblclick", "wheel", "touchstart", "touchmove", "touchend"])
      layer.addEventListener(type, (ev) => ev.stopPropagation());
    // Keys bubble to the game's window listener, not through this layer, so
    // stop them at the document while a panel is up. This sits after the
    // panel's own inputs (bubble phase), so typing and Escape in a field work.
    const stopGameKeys = (ev) => {
      if (!open) return;
      ev.stopPropagation();
      if (ev.type !== "keydown" || ev.repeat) return;
      // Escape is the game's Back: the panel's cancel / back choice. Enter presses the
      // main choice only on panels that ask for it (opts.enter): the game's own news box
      // ignores Enter (and Escape). In a field Enter ends the typing instead.
      const t = ev.target, field = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || "");
      const act = ev.key === "Escape" ? open.back : ev.key === "Enter" && !field ? open.main : null;
      if (!act) return;
      ev.preventDefault();
      act();
    };
    document.addEventListener("keydown", stopGameKeys);
    document.addEventListener("keyup", stopGameKeys);
    layer.addEventListener("input", (ev) => {
      const r = ev.target && ev.target.closest ? ev.target.closest(".dt-range") : null;
      if (r) fillRange(r);
    });
    dock = el("div", "dt-dock", layer);
    addEventListener("resize", () => {
      fit();
      markDirty();
    });
    if (!visTimer && typeof setInterval === "function") visTimer = every(syncDock, 250);
    fit();
    return layer;
  }
  function sound(name) {
    try {
      globalThis[name] && globalThis[name]();
    } catch (e) {}
  }
  function button(parent, label, cls, onClick) {
    const glyph = /^[↑↓←→×✕✖]$/.test(String(label)) ? " dt-glyph" : "";
    const b = el("div", "dt-btn" + glyph + (cls ? " " + cls : ""), parent, label);
    b.addEventListener("pointerover", () => sound("tapHover"));
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      sound("tapMain");
      onClick && onClick(ev);
    });
    return b;
  }
  function fillRange(r) {
    const min = Number(r.min || 0), max = Number(r.max || 100), v = Number(r.value);
    const p = max > min ? Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100)) : 0;
    r.style.setProperty("--dt-p", p.toFixed(2) + "%");
  }
  function syncRanges(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll(".dt-range").forEach(fillRange);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  // The game toast highlights the subject (device name) in gold. Only the
  // name the caller passes is highlighted; a toast without one stays plain.
  function toastMarkup(text, keyword) {
    const s = String(text == null ? "" : text);
    const k = keyword == null ? "" : String(keyword);
    const at = k ? s.indexOf(k) : -1;
    if (at < 0) return esc(s);
    return esc(s.slice(0, at)) + '<span class="dt-hl">' + esc(k) + "</span>" + esc(s.slice(at + k.length));
  }
  // A pop-up message: centred lines like the game's box, the device name
  // (keyword) in the game's yellow.
  function msg(parent, text, keyword) {
    const n = el("div", "dt-msg", parent);
    n.innerHTML = toastMarkup(text, keyword);
    return n;
  }
  // Words of a button that backs out of a panel (Escape presses it).
  const BACK_WORDS = /^(cancel|close|back|not now|отмена|закрыть|назад)$/i;
  // Opens one panel at a time. build(body, close) fills it; buttons are
  // [{label, main, kind, cancel, onClick}] where onClick returning false keeps it open.
  // Like the game's pop-up, the main button is green and the others red (NO);
  // kind "outline" gives a second choice the white outline, "yes"/"no" force a colour.
  function modal(opts) {
    close(true);
    ensure();
    fit();
    const dim = el("div", "dt-dim", layer);
    const card = el("div", "dt-card" + (opts.wide ? " dt-wide" : ""), dim);
    const head = el("div", "dt-head", card);
    el("div", "dt-bar", head);
    el("div", "dt-title", head, opts.title);
    const body = el("div", "dt-body", card);
    const foot = el("div", "dt-foot", card);
    const self = { dim: dim, body: body, foot: foot, onClose: opts.onClose, paused: null, back: null, main: null };
    // Hold the calendar while a decision is on screen, like the game's own pop-ups.
    if (opts.pause) {
      try {
        const g = rt().globalVars;
        self.paused = g.GameplayPause;
        g.GameplayPause = 1;
      } catch (e) {}
    }
    open = self;
    // Other mods (news) hide their on-screen pop-ups while a panel is up.
    try { document.body.classList.add("dt-panel-open"); } catch (e) {}
    syncDock();
    const done = () => close();
    const list = opts.buttons || [];
    const press = list.map((b) => () => {
      if (b.onClick && b.onClick() === false) return;
      done();
    });
    list.forEach((b, i) => {
      const kind = b.kind === "outline" ? "" : b.kind === "yes" || b.kind === "no" ? "dt-" + b.kind : b.main ? "dt-yes" : "dt-no";
      button(foot, b.label, (b.main ? "dt-main " : "") + kind, press[i]);
    });
    // Keys and a click beside the card act like one of its buttons, once for every panel:
    // Back = the button marked cancel, else a Cancel / Close / Back button, else a lone
    // button (Done), else just close; a dismiss:false panel only backs out through a
    // button marked cancel. With opts.enter, Enter = the main button.
    const pick = (f) => { for (let i = 0; i < list.length; i++) if (f(list[i])) return press[i]; return null; };
    const backFn = pick((b) => b.cancel === true) ||
      (opts.dismiss === false ? null : pick((b) => !b.main && BACK_WORDS.test(String(b.label || "").trim())) ||
        (list.length === 1 ? press[0] : done));
    const mainFn = pick((b) => !!b.main);
    self.back = backFn ? () => { sound("tapBack"); backFn(); } : null;
    self.main = mainFn && opts.enter === true ? () => { sound("tapMain"); mainFn(); } : null;
    if (opts.dismiss !== false) {
      dim.addEventListener("click", (ev) => {
        if (ev.target === dim && self.back) self.back();
      });
    }
    opts.build && opts.build(body, done, self);
    syncRanges(body);
    body.addEventListener("click", () => setTimeout(() => syncRanges(body), 0), true); // capture: buttons stop propagation
    return self;
  }
  function close(instant) {
    const m = open;
    if (!m) return;
    open = null;
    try { document.body.classList.remove("dt-panel-open"); } catch (e) {}
    try {
      if (m.paused !== null) rt().globalVars.GameplayPause = m.paused;
      m.onClose && m.onClose();
    } catch (e) {}
    if (instant) {
      m.dim.remove();
      syncDock();
      return m;
    }
    closingPanel = m;
    m.dim.classList.add("dt-closing");
    setTimeout(() => {
      m.dim.remove();
      if (closingPanel === m) closingPanel = null;
      syncDock();
    }, 230); // after the 0.22 s close, like the game's box
  }
  function isOpen() {
    return !!open;
  }
  // Line icons in the game's own SVG style, so the chip rows read as HUD stats.
  function chipIcon(id) {
    const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
    if (id === "queue") return svg + '<path d="M4 6h16M4 12h16M4 18h9"/><circle cx="18.5" cy="18" r="1.7" fill="currentColor" stroke="none"/></svg>';
    if (id === "launch") return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6L19 12z"/></svg>';
    if (id === "difficulty") return svg + '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.4"/><circle cx="15" cy="17" r="2.4"/></svg>';
    return svg + '<circle cx="12" cy="12" r="7"/></svg>';
  }
  // Chips sit in a small dock under the money pill on the office screens, in a fixed order.
  function chip(id, order, label, badge, onClick) {
    ensure();
    let c = dock.querySelector('[data-dt="' + id + '"]');
    if (!c) {
      c = el("div", "dt-chip", null);
      c.dataset.dt = id;
      c.dataset.order = String(order);
      el("span", "dt-chip-icon", c).innerHTML = chipIcon(id);
      // Kept by reference: a mod may insert its own nodes (the room pill's sub line).
      c._dtText = el("div", "dt-chip-text", c);
      c._dtBadge = el("div", "dt-badge", c);
      c.addEventListener("pointerover", () => sound("tapHover"));
      c.addEventListener("click", (ev) => {
        ev.stopPropagation();
        sound("tapMain");
        c._dtClick && c._dtClick();
      });
      const after = [...dock.children].find((n) => Number(n.dataset.order) > order);
      dock.insertBefore(c, after || null);
      markDirty();
    }
    c._dtClick = onClick;
    // Mods re-send their chips every 250 ms: only write what changed, or each
    // write makes the browser lay the page out again. Chips have a fixed height,
    // so only adding or removing one moves what sits below the dock.
    const text = String(label), b = badge ? String(badge) : "", show = badge ? "" : "none";
    const tn = c._dtText, bn = c._dtBadge;
    if (tn.textContent !== text) tn.textContent = text;
    if (bn.textContent !== b) bn.textContent = b;
    if (bn.style.display !== show) bn.style.display = show;
    return c;
  }
  function removeChip(id) {
    if (leavingOffice()) return; // its mod asks again once the next layout runs
    const c = dock && dock.querySelector('[data-dt="' + id + '"]');
    if (!c) return;
    c.remove();
    markDirty();
  }
  function toast(text, keyword, opts) {
    // On the office screens the card goes into the game's own news stack
    // (showOfficeNotification): the same card, corner, slide, 3 s life and
    // stacking as the game's news. [color] is the game's own highlight markup.
    // opts.sales: a sales message (a launch, a restock) joins the game's own
    // sales messages under the sales card instead, the name in their blue
    // (opts.color: another of their colours, e.g. their red for money).
    if (onOffice() && typeof showOfficeNotification === "function") {
      try {
        const sales = !!(opts && opts.sales) && typeof showOfficeSalesNotification === "function";
        const col = sales ? opts.color || "#87E9FF" : "#FFD600";
        const s = String(text == null ? "" : text), k = keyword == null ? "" : String(keyword), at = k ? s.indexOf(k) : -1;
        (sales ? showOfficeSalesNotification : showOfficeNotification)(at < 0 ? esc(s) : esc(s.slice(0, at)) + "[color=" + col + "]" + esc(k) + "[/color]" + esc(s.slice(at + k.length)));
        return;
      } catch (e) {}
    }
    ensure();
    fit();
    const n = el("div", "dt-toast", layer);
    n.innerHTML = toastMarkup(text, keyword);
    toastClear(n);
    // A game news toast can arrive after ours: keep stepping clear of it
    // (one shared 200 ms watcher for all live toasts, oldest first).
    liveToasts.push(n);
    if (!toastWatch) toastWatch = setInterval(watchToasts, 200);
    // The game's card life: 3 s, then a 0.4 s slide out.
    setTimeout(() => n.classList.add("dt-toast-out"), 3000);
    setTimeout(() => {
      const i = liveToasts.indexOf(n);
      if (i >= 0) liveToasts.splice(i, 1);
      if (!liveToasts.length && toastWatch) { clearInterval(toastWatch); toastWatch = null; }
      n.remove();
    }, 3450);
  }
  const liveToasts = [];
  let toastWatch = null;
  function watchToasts() {
    for (const n of liveToasts.slice()) toastClear(n);
  }
  // The game's own office notifications (#office-notifications) use the same
  // corner: step the toast up above them and above earlier toasts.
  function toastClear(n) {
    try {
      const box = (e) => {
        const b = e.getBoundingClientRect();
        return { l: b.left, t: b.top, r: b.left + b.width, b: b.top + b.height };
      };
      // Game cards slide 0.45 s to their --notif-y spot (_layoutNotifs): aim at
      // that spot as well as where the card is now, or the toast chases it.
      const card = (c, hr) => {
        const now = box(c);
        const y = parseFloat(c.style.getPropertyValue && c.style.getPropertyValue("--notif-y"));
        if (!isFinite(y) || !c.offsetHeight) return now;
        const t = hr.b + y - c.offsetHeight;
        return { l: Math.min(now.l, hr.l), t: Math.min(now.t, t), r: Math.max(now.r, hr.r), b: Math.max(now.b, hr.b + y) };
      };
      const host = document.getElementById("office-notifications");
      const hr = host && box(host);
      const others = (host ? Array.from(host.children).map((c) => card(c, hr)) : [])
        .concat(Array.from(layer.querySelectorAll(".dt-toast")).filter((e) => e !== n).map(box))
        .filter((o) => o.b > o.t);
      const lr = box(layer);
      const ds = parseFloat(layer.style.getPropertyValue && layer.style.getPropertyValue("--dt")) || 1;
      const gap = 8 * ds;
      // The work rooms' PROGRAMMING / BUGS circles sit in the right column
      // above design y 570 (the news cards' cap, news.js): never step up into
      // them; move left of what is in the way instead, at the same height.
      const roof = lr.t + 570 * ds, col = lr.r - 330 * ds;
      for (let i = 0; i < 8; i++) {
        const me = box(n);
        const hit = others.filter((o) => o.t < me.b && o.b > me.t && o.l < me.r && o.r > me.l);
        if (!hit.length) return;
        const up = lr.b - Math.min(...hit.map((o) => o.t)) + gap;
        if (me.r > col && lr.b - up - (me.b - me.t) < roof) {
          n.style.right = Math.round(lr.r - Math.min(...hit.map((o) => o.l)) + gap) + "px";
        } else n.style.bottom = Math.round(up) + "px";
      }
    } catch (e) {}
  }
  // The office HUD (credit, room title) needs the layer even when no mod has a chip or panel up.
  if (typeof setInterval === "function") {
    const boot = setInterval(() => {
      if (layer) return clearInterval(boot);
      if (rt() && onOffice()) ensure();
    }, 500);
  }
  return { el, t, ru, gv, num, rt, layoutName, onOffice, ensure, fit, button, modal, msg, close, isOpen, chip, removeChip, toast, every, stopEvery };
})();
// For test drivers (the game's scripts run as a module, so _dtUi is not global).
globalThis._dtUiApi = _dtUi;

// ── toolbar pages ──
// (pages worker: this block is appended to ui.js; nothing above it changes.)
// Build queue and Launches are two more buttons in the game's own bottom
// toolbar. The game's 14 icons spread out evenly (17 slots of 107.5 design px)
// to make room either side of "+". Our icons are DOM, but the hover uses the
// game's own ring (Sprite476 UID 411), a coloured Gradient sprite under it
// (the same source-atop trick the game uses for each button) and the game's
// own label Text (UID 13299), with the game's Tween behaviour and timings
// (276 GAMEPLAY: tint 0.25 s, ring 76->90 px, label 970->950, press 0.8->0.65).
// A click opens a full page like the game's toolbar pages: the game's own
// layout (Investing / Ratings) runs with its content moved away, its "ESC
// Back" and Esc key take the player back, and our list is drawn over it.
var _dtTb = (function () {
  const OLD = [100, 220, 340, 460, 580, 700, 820, 1100, 1220, 1340, 1460, 1580, 1700, 1820];
  const NEW = OLD.map((x, k) => 100 + 107.5 * (k < 7 ? k : k + 3));
  const RING = 411, LABEL = 13299, BLACK = 347, COVER = 7334;
  const BACK = "GAMEPLAY GLOBAL UI (Back)";
  const specs = [];
  const moved = new Map(); // uid -> {to, from}
  let wired = false, tbRoot = null, pgRoot = null, cssDone = false;
  let hover = null, pending = null, page = null, scanAt = 0, fitKey = "", lastLay = "";

  const rt = () => globalThis.runtime || null;
  const gv = (k, d) => { try { const v = rt().globalVars[k]; return v === undefined || v === null ? d : v; } catch (e) { return d; } };
  const byUid = (uid) => { try { return rt().getInstanceByUid(uid) || null; } catch (e) { return null; } };
  const isOffice = (n) => n === "GAMEPLAY" || (/ OFFICE( \d+)?$/.test(n) && !/UPGRADE/.test(n));
  const sound = (n) => { try { globalThis[n] && globalThis[n](); } catch (e) {} };
  const tween = (inst) => { try { return inst && inst.behaviors && inst.behaviors.Tween || null; } catch (e) { return null; } };
  function stopTweens(inst) {
    const b = tween(inst);
    try { if (b) for (const t of b.allTweens()) t.stop(); } catch (e) {}
  }
  function startTween(inst, prop, to, time, ease, opts) {
    const b = tween(inst);
    if (!b) return null;
    try { return b.startTween(prop, to, time, ease || "linear", opts || {}); } catch (e) { return null; }
  }
  function css() {
    if (cssDone) return;
    cssDone = true;
    const s = document.createElement("style");
    s.id = "dt-tb-css";
    s.textContent = `
.dt-tb { position: fixed; left: 0; top: 0; pointer-events: none; --dt: 1; }
.dt-tb-b { position: absolute; width: calc(var(--dt) * 96px); height: calc(var(--dt) * 96px);
  margin: calc(var(--dt) * -48px) 0 0 calc(var(--dt) * -48px); pointer-events: none; }
.dt-tb-b svg { position: absolute; left: 50%; top: 50%; width: calc(var(--dt) * 70px); height: calc(var(--dt) * 70px);
  margin: calc(var(--dt) * -35px) 0 0 calc(var(--dt) * -35px); display: block; fill: currentColor; color: #fff; opacity: .9;
  transform: scale(.7); transition: transform .25s cubic-bezier(.19, 1, .22, 1), color .25s linear, opacity .15s linear; }
.dt-tb-b.dt-hov svg { transform: scale(.8); opacity: 1; color: var(--tint); }
.dt-tb-b.dt-press svg { transform: scale(.65); transition-duration: .075s; }
.dt-tbp { position: fixed; z-index: 9990; pointer-events: none; --dt: 1; color: #fff; opacity: 0;
  font-family: "SofiaSansExtraCondensed-Medium", "Oswald", sans-serif; user-select: none; -webkit-user-select: none; }
.dt-tbp, .dt-tbp * { box-sizing: border-box; }
.dt-tbp .dt-tbp-hit { pointer-events: auto; }
body.dt-tbp-on #ratings-root { visibility: hidden !important; }
/* Page parts, in the measurements of the agreed mockups (mock/genpages.py). */
.dt-pg-hdr { position: absolute; left: calc(var(--dt) * 52px); top: calc(var(--dt) * 28px); height: calc(var(--dt) * 44px);
  display: flex; align-items: center; gap: calc(var(--dt) * 18px); font-size: calc(var(--dt) * 34px); letter-spacing: calc(var(--dt) * .5px); white-space: nowrap; }
.dt-pg-hdr b { font-family: "SofiaSansExtraCondensed-Bold"; font-weight: normal; display: flex; align-items: center; gap: calc(var(--dt) * 14px); }
.dt-pg-hdr b svg { width: calc(var(--dt) * 30px); height: calc(var(--dt) * 30px); fill: #fff; }
.dt-pg-hdr i { width: 2px; height: calc(var(--dt) * 40px); background: rgba(255,255,255,.55); }
.dt-pg-hdr > span { font-family: "SofiaSansExtraCondensed-Medium"; color: rgba(255,255,255,.75); font-size: calc(var(--dt) * 32px); }
.dt-pg-list { position: absolute; left: calc(var(--dt) * 58px); top: calc(var(--dt) * 160px); width: calc(var(--dt) * 1060px);
  max-height: calc(var(--dt) * 760px); overflow-x: hidden; overflow-y: auto; display: flex; flex-direction: column; gap: calc(var(--dt) * 12px);
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.25) transparent; }
.dt-pg-sec { font-family: "SofiaSansExtraCondensed-Bold"; font-size: calc(var(--dt) * 19px); letter-spacing: calc(var(--dt) * 2px);
  color: rgba(255,255,255,.6); margin: calc(var(--dt) * 10px) calc(var(--dt) * 4px) 0; text-transform: uppercase; }
.dt-pg-row { position: relative; flex: 0 0 auto; display: flex; align-items: center; gap: calc(var(--dt) * 18px); min-height: calc(var(--dt) * 86px);
  padding: 0 calc(var(--dt) * 20px) 0 calc(var(--dt) * 14px); border-radius: calc(var(--dt) * 12px); background: rgba(30,26,80,.42);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  pointer-events: auto; transition: background .15s linear, box-shadow .15s linear; }
.dt-pg-row.dt-hov { background: rgba(120,120,210,.45); box-shadow: inset 0 0 0 1px rgba(255,255,255,.25); }
.dt-pg-num { flex: 0 0 auto; width: calc(var(--dt) * 54px); height: calc(var(--dt) * 54px); border-radius: calc(var(--dt) * 10px);
  display: flex; align-items: center; justify-content: center; font-family: "SofiaSansExtraCondensed-Bold"; font-size: calc(var(--dt) * 26px); background: rgba(255,255,255,.12); }
.dt-pg-num svg { width: calc(var(--dt) * 22px); height: calc(var(--dt) * 22px); fill: #FFD600; }
.dt-pg-dev { flex: 0 0 auto; width: calc(var(--dt) * 40px); height: calc(var(--dt) * 40px); object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0,0,0,.5)); }
.dt-pg-tx { flex: 1; min-width: 0; }
.dt-pg-nm { display: flex; align-items: center; gap: calc(var(--dt) * 12px); font-size: calc(var(--dt) * 30px); line-height: 1.05; white-space: nowrap; }
.dt-pg-nm > span:first-child { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.dt-pg-sub { font-size: calc(var(--dt) * 20px); color: rgba(255,255,255,.6); margin-top: calc(var(--dt) * 4px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dt-pg-vt { flex: 0 0 auto; display: inline-flex; align-items: center; height: calc(var(--dt) * 24px); padding: 0 calc(var(--dt) * 10px);
  border-radius: calc(var(--dt) * 7px); font-size: calc(var(--dt) * 15px); text-transform: uppercase; font-family: "SofiaSansExtraCondensed-Bold"; letter-spacing: calc(var(--dt) * .5px); }
.dt-pg-vt.dt-b { background: rgba(205,127,50,.22); color: #ffb778; box-shadow: inset 0 0 0 1px rgba(205,127,50,.3); }
.dt-pg-vt.dt-s { background: rgba(200,200,220,.18); color: #e2e6f0; box-shadow: inset 0 0 0 1px rgba(200,200,220,.28); }
.dt-pg-vt.dt-f { background: rgba(255,215,0,.22); color: #ffe27a; box-shadow: inset 0 0 0 1px rgba(255,215,0,.3); }
.dt-pg-st { flex: 0 0 auto; font-family: "SofiaSansExtraCondensed-Bold"; font-size: calc(var(--dt) * 20px); letter-spacing: calc(var(--dt) * 1px);
  color: rgba(255,255,255,.55); text-transform: uppercase; }
.dt-pg-st.dt-g { color: #FFD600; }
.dt-pg-ctl { flex: 0 0 auto; display: flex; gap: calc(var(--dt) * 6px); margin-left: calc(var(--dt) * 14px); }
.dt-pg-ic { width: calc(var(--dt) * 42px); height: calc(var(--dt) * 42px); border-radius: calc(var(--dt) * 10px); display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.1); cursor: pointer; transition: background .14s linear, transform .09s ease-out; }
.dt-pg-ic svg { width: calc(var(--dt) * 30px); height: calc(var(--dt) * 30px); fill: #fff; }
.dt-pg-ic:hover { background: rgba(255,255,255,.2); }
.dt-pg-ic:active { transform: scale(.94); }
.dt-pg-ic.dt-off { opacity: .3; pointer-events: none; }
.dt-pg-btn { flex: 0 0 auto; height: calc(var(--dt) * 50px); padding: 0 calc(var(--dt) * 26px); border-radius: calc(var(--dt) * 11px);
  font-family: "SofiaSansExtraCondensed-Bold"; font-size: calc(var(--dt) * 22px); letter-spacing: calc(var(--dt) * .6px); text-transform: uppercase;
  display: inline-flex; align-items: center; gap: calc(var(--dt) * 10px); color: #fff; background: rgba(255,255,255,.1);
  box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.3); cursor: pointer; white-space: nowrap; pointer-events: auto;
  transition: background .14s linear, filter .14s linear, transform .09s ease-out; }
.dt-pg-btn svg { width: calc(var(--dt) * 24px); height: calc(var(--dt) * 24px); fill: currentColor; }
.dt-pg-btn:hover { background: rgba(255,255,255,.18); }
.dt-pg-btn:active { transform: scale(.97); }
.dt-pg-btn.dt-gold { color: #2a1d00; background: linear-gradient(170deg, #FFE878, #FFD600 45%, #FF9E14); box-shadow: inset 0 1px 0 rgba(255,255,255,.6); }
.dt-pg-btn.dt-gold:hover { filter: brightness(1.08); }
.dt-pg-bar { flex: 0 0 auto; display: flex; align-items: center; gap: calc(var(--dt) * 16px); padding: calc(var(--dt) * 14px) calc(var(--dt) * 20px);
  border-radius: calc(var(--dt) * 12px); background: rgba(255,214,0,.1); box-shadow: inset 0 0 0 1px rgba(255,214,0,.4); pointer-events: auto; }
.dt-pg-bar > svg { flex: 0 0 auto; width: calc(var(--dt) * 30px); height: calc(var(--dt) * 30px); fill: #FFD600; }
.dt-pg-bar .dt-pg-t { flex: 1; min-width: 0; font-size: calc(var(--dt) * 26px); }
.dt-pg-bar.dt-pg-mk { background: rgba(30,26,80,.42); box-shadow: inset 0 0 0 1px rgba(255,255,255,.1);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.dt-pg-bar.dt-pg-mk > svg { fill: rgba(255,255,255,.85); }
.dt-pg-bar .dt-pg-t small { display: block; font-size: calc(var(--dt) * 19px); color: rgba(255,255,255,.6); }
.dt-pg-cell { flex: 0 0 auto; width: calc(var(--dt) * 170px); }
.dt-pg-date { display: flex; align-items: center; gap: calc(var(--dt) * 8px); font-size: calc(var(--dt) * 18px); color: rgba(255,255,255,.75); }
.dt-pg-date i { width: calc(var(--dt) * 10px); height: calc(var(--dt) * 10px); border-radius: 50%; background: var(--c, #FFD600); }
.dt-pg-link { align-self: flex-start; font-size: calc(var(--dt) * 24px); color: #FFD600; margin: calc(var(--dt) * 6px) calc(var(--dt) * 6px) 0;
  display: flex; align-items: center; gap: calc(var(--dt) * 8px); cursor: pointer; pointer-events: auto; }
.dt-pg-link svg { width: calc(var(--dt) * 24px); height: calc(var(--dt) * 24px); fill: currentColor; }
.dt-pg-link:hover { filter: brightness(1.15); }
.dt-pg-empty { color: rgba(255,255,255,.75); }
.dt-pg-hit { position: absolute; pointer-events: auto; cursor: pointer; }
`;
    document.head.appendChild(s);
  }
  // The canvas area in screen px (the game letterboxes its 16:9 design area).
  function area() {
    const c = document.querySelector("canvas");
    const r = c ? c.getBoundingClientRect() : null;
    if (!r || !r.width) return { left: 0, top: 0, width: innerWidth, height: innerHeight, s: innerWidth / 1920 };
    const s = Math.min(r.width / 1920, r.height / 1080);
    return { left: r.left + (r.width - 1920 * s) / 2, top: r.top + (r.height - 1080 * s) / 2, width: 1920 * s, height: 1080 * s, s: s };
  }
  function fit() {
    const a = area();
    const key = a.left + "," + a.top + "," + a.width;
    if (key === fitKey) return a;
    fitKey = key;
    for (const n of [tbRoot, pgRoot]) {
      if (!n) continue;
      Object.assign(n.style, { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px" });
      n.style.setProperty("--dt", String(a.s));
    }
    return a;
  }
  // Under the game's own HTML layer (pause menu, news), like the canvas icons.
  function ensureBar() {
    if (tbRoot && tbRoot.isConnected) return tbRoot;
    css();
    tbRoot = document.createElement("div");
    tbRoot.className = "dt-tb";
    const wrap = document.querySelector(".c3htmlwrap");
    if (wrap && wrap.parentNode) wrap.parentNode.insertBefore(tbRoot, wrap);
    else document.body.appendChild(tbRoot);
    fitKey = "";
    for (const sp of specs) mountButton(sp);
    return tbRoot;
  }
  function mountButton(sp) {
    const b = document.createElement("div");
    b.className = "dt-tb-b";
    b.style.setProperty("--tint", "rgb(" + sp.tint.join(",") + ")");
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + sp.icon + "</svg>";
    sp.el = b;
    tbRoot.appendChild(b);
  }
  // The game's HTML layer (.c3htmlwrap) lies over the canvas and takes the
  // pointer, so the buttons sit under it like the canvas icons and are hit
  // here by position.
  function hit(ev) {
    if (!tbRoot || tbRoot.style.display === "none") return null;
    for (const sp of specs) {
      if (!sp.el || sp.el.classList.contains("dt-off")) continue;
      const r = sp.el.getBoundingClientRect();
      if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) continue;
      const top = document.elementFromPoint(ev.clientX, ev.clientY);
      // Mod UI on top (a toast, a panel) wins; the game's own overlays are
      // ruled out by canUse() (pause, news and create menus set its globals).
      if (top && top.tagName !== "CANVAS" && !(top.closest && top.closest(".c3htmlwrap"))) return null;
      return sp;
    }
    return null;
  }
  let downOn = null;
  function onMove(ev) {
    const sp = hit(ev);
    if (sp && ev.pointerType !== "touch") enter(sp);
    else if (hover && hover !== sp) leave(hover);
    const c = sp ? "pointer" : "";
    const w = document.querySelector(".c3htmlwrap");
    if (w && w.style.cursor !== c && (sp || w.style.cursor === "pointer")) w.style.cursor = c;
  }
  function onDown(ev) {
    downOn = hit(ev);
    if (downOn) ev.stopPropagation();
  }
  function onUp(ev) {
    const sp = hit(ev);
    if (!downOn) return;
    ev.stopPropagation();
    const was = downOn;
    downOn = null;
    if (sp === was) click(sp);
  }
  function canUse() {
    return gv("class", "") === "GAMEPLAY" && gv("Assistant", "OFF") === "OFF" && gv("CreateDevicesUI", "OFF") === "OFF" &&
      !(globalThis._dtUi && _dtUi.isOpen()) && !pending;
  }
  // The coloured sprite the ring takes its colour from (one per button, like the game's).
  function gradient(sp) {
    let g = sp.grad ? byUid(sp.grad) : null;
    if (g) return g;
    try {
      const T = rt().objects[sp.gradient];
      if (!T) return null;
      g = T.createInstance(BACK, sp.x, 1000);
      g.width = 96;
      g.height = 96;
      g.blendMode = "source-atop";
      g.isVisible = true;
      g.opacity = 1;
      g.moveToTop();
      sp.grad = g.uid;
    } catch (e) {
      return null;
    }
    return g;
  }
  function enter(sp) {
    if (!canUse() || hover === sp) return;
    if (hover) leave(hover);
    hover = sp;
    sp.el.classList.add("dt-hov");
    const y = sp.y || 1000;
    const g = gradient(sp);
    if (g) { g.x = sp.x; g.y = y; }
    const ring = byUid(RING);
    if (ring) {
      stopTweens(ring);
      ring.x = sp.x;
      ring.y = y;
      ring.width = ring.height = 76;
      ring.opacity = 0;
      startTween(ring, "opacity", 1, 0.15, "linear");
      startTween(ring, "size", [90, 90], 0.25, "out-exponential");
    }
    const tx = byUid(LABEL);
    if (tx) {
      stopTweens(tx);
      tx.text = _dtUi.t(sp.label);
      tx.isVisible = true;
      tx.opacity = 0;
      tx.x = sp.x;
      tx.y = y - 30;
      startTween(tx, "opacity", 1, 0.15, "linear");
      startTween(tx, "y", y - 50, 0.25, "out-exponential");
    }
  }
  function leave(sp) {
    if (hover !== sp) return;
    hover = null;
    sp.el.classList.remove("dt-hov");
    const ring = byUid(RING);
    if (ring && Math.abs(ring.x - sp.x) < 1) {
      stopTweens(ring);
      startTween(ring, "opacity", 0, 0.15, "linear");
    }
    const tx = byUid(LABEL);
    if (tx && Math.abs(tx.x - sp.x) < 1) {
      stopTweens(tx);
      tx.isVisible = false;
      tx.opacity = 0;
    }
  }
  function click(sp) {
    if (!canUse()) return;
    enter(sp);
    sound("tapMain");
    sp.el.classList.add("dt-press");
    setTimeout(() => sp.el.classList.remove("dt-press"), 75);
    const ring = byUid(RING);
    if (ring) {
      ring.width = ring.height = 90;
      startTween(ring, "size", [72, 72], 0.075, "linear", { pingPong: true });
    }
    open(sp.id);
  }
  // Opens a page: the game's own fade to black, then its layout.
  function open(id) {
    const sp = specs.find((s) => s.id === id);
    const r = rt();
    if (!sp || !r) return false;
    pending = sp;
    try {
      r.globalVars.LastClass = "GAMEPLAY";
      r.globalVars.class = sp.cls;
    } catch (e) {}
    const go = () => {
      if (pending !== sp) return;
      try { r.goToLayout(sp.layout); } catch (e) { pending = null; }
    };
    const black = byUid(BLACK);
    const t = black ? startTween(black, "opacity", 1, 0.15, "linear") : null;
    if (t && t.finished) t.finished.then(go, go);
    else setTimeout(go, 150);
    return true;
  }
  // ── The spread ──
  function scan() {
    const r = rt();
    if (!r) return;
    for (const name of Object.keys(r.objects)) {
      let list;
      try { list = r.objects[name].getAllInstances(); } catch (e) { continue; }
      for (const i of list) {
        if (!i || moved.has(i.uid) || i.uid === RING || i.uid === LABEL || typeof i.x !== "number") continue;
        if (i.y < 880 || i.y > 1075 || !i.layer || i.layer.name.indexOf("GAMEPLAY GLOBAL UI") !== 0) continue;
        if (specs.some((s) => s.grad === i.uid)) continue;
        const k = OLD.findIndex((x) => Math.abs(i.x - x) < 45);
        if (k < 0) continue;
        moved.set(i.uid, { from: i.x, to: i.x + NEW[k] - OLD[k] });
        i.x = i.x + NEW[k] - OLD[k];
      }
    }
  }
  function keep() {
    for (const [uid, m] of moved) {
      const i = byUid(uid);
      if (!i) { moved.delete(uid); continue; }
      if (Math.abs(i.x - m.from) < 0.5) i.x = m.to;
    }
  }
  // ── Pages ──
  function mountPage(sp) {
    css();
    _dtUi.ensure();
    pgRoot = document.createElement("div");
    pgRoot.className = "dt-tbp";
    pgRoot.dataset.page = sp.id;
    const layer = document.querySelector(".dt-layer");
    document.body.insertBefore(pgRoot, layer || null);
    for (const t of ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "wheel", "touchstart", "touchend"])
      pgRoot.addEventListener(t, (ev) => { if (ev.target !== pgRoot) ev.stopPropagation(); });
    document.body.classList.add("dt-tbp-on");
    fitKey = "";
    fit();
    page = { sp: sp, root: pgRoot, at: performance.now(), view: null };
    hideGame(sp);
    try { page.view = sp.build(pgRoot) || null; } catch (e) { console.warn("[Toolbar] page:", e); }
  }
  function unmountPage() {
    if (!page) return;
    // A pop-up opened from the page (Change, Edit, Remove) goes with it.
    try { if (_dtUi.isOpen()) _dtUi.close(true); } catch (e) {}
    try { page.view && page.view.destroy && page.view.destroy(); } catch (e) {}
    page.root.remove();
    page = null;
    pgRoot = null;
    document.body.classList.remove("dt-tbp-on");
  }
  // Moved out of reach (the game still hit-tests invisible objects), or just hidden.
  function hideGame(sp) {
    for (const [uid, how] of sp.hide || []) {
      const i = byUid(uid);
      if (!i) continue;
      if (how === "away") { if (i.x < 10000) i.x += 20000; i.isVisible = false; }
      else i.isVisible = false;
    }
  }
  function pageTick() {
    if (!page) return;
    fit();
    hideGame(page.sp);
    const black = byUid(BLACK);
    let o = black && black.isVisible ? 1 - black.opacity : 1;
    // The game's own info box (EditorNotification) is drawn on the canvas.
    if (gv("EditorNotification", "OFF") === "ON") o = 0;
    o *= Math.min(1, (performance.now() - page.at) / 250);
    const s = String(Math.round(o * 100) / 100);
    if (page.root.style.opacity !== s) page.root.style.opacity = s;
    page.root.style.visibility = o > 0 ? "" : "hidden";
  }
  // ── Every frame ──
  function onTick() {
    const r = rt();
    if (!r || !r.layout) return;
    const lay = String(r.layout.name || "");
    if (page) pageTick();
    const office = isOffice(lay);
    if (!office) {
      if (tbRoot && tbRoot.style.display !== "none") tbRoot.style.display = "none";
      if (hover) leave(hover);
      return;
    }
    ensureBar();
    const now = performance.now();
    if (now > scanAt) {
      scanAt = now + 2000;
      scan();
    } else keep();
    const a = fit();
    const black = byUid(BLACK);
    const fade = black && black.isVisible && black.layer && black.layer.isVisible ? 1 - black.opacity : 1;
    const use = canUse();
    let shown = false;
    for (const sp of specs) {
      const ref = byUid(sp.ref);
      const vis = ref && ref.isVisible && ref.layer && ref.layer.isVisible ? Math.min(1, ref.opacity / 0.9) * fade : 0;
      sp.y = ref ? ref.y : 1000;
      const st = sp.el.style;
      const L = (sp.x * a.s).toFixed(1) + "px", T = (sp.y * a.s).toFixed(1) + "px", O = vis.toFixed(2);
      if (st.left !== L) st.left = L;
      if (st.top !== T) st.top = T;
      if (st.opacity !== O) st.opacity = O;
      const off = !use || vis < 0.5;
      if (sp.el.classList.contains("dt-off") !== off) sp.el.classList.toggle("dt-off", off);
      if (off && hover === sp) leave(sp);
      shown = shown || vis > 0;
    }
    // A create picker's black cover (the game's 7334, 0 to 20% over 0.15 s, or the in-room picker's) dims
    // the canvas icons under it; the buttons, above the canvas, take the same shade with it.
    const cover = byUid(COVER);
    let dim = cover && cover.isVisible && cover.layer && cover.layer.isVisible ? cover.opacity : 0;
    try { if (globalThis._dtPicker && _dtPicker.dim) dim = Math.max(dim, _dtPicker.dim()); } catch (e) {}
    const F = dim > 0.001 ? "brightness(" + (1 - dim).toFixed(3) + ")" : "";
    if (tbRoot.style.filter !== F) tbRoot.style.filter = F;
    const d = shown ? "" : "none";
    if (tbRoot.style.display !== d) tbRoot.style.display = d;
  }
  function wire() {
    const r = rt();
    if (wired || !r || typeof r.addEventListener !== "function") return false;
    wired = true;
    r.addEventListener("tick", onTick);
    addEventListener("pointermove", onMove, true);
    addEventListener("pointerdown", onDown, true);
    addEventListener("pointerup", onUp, true);
    addEventListener("mousedown", (ev) => { if (downOn) ev.stopPropagation(); }, true);
    addEventListener("mouseup", (ev) => { if (hit(ev)) ev.stopPropagation(); }, true);
    r.addEventListener("afteranylayoutstart", () => {
      const lay = String(r.layout.name || "");
      if (page && page.sp.layout !== lay) unmountPage();
      if (pending) {
        const sp = pending;
        pending = null;
        if (sp.layout === lay) mountPage(sp);
      }
      if (isOffice(lay) && lay !== lastLay) scanAt = 0;
      lastLay = lay;
    });
    r.addEventListener("beforeanylayoutend", () => {
      if (hover) leave(hover);
      unmountPage();
    });
    return true;
  }
  const wireTimer = setInterval(() => { if (wire()) clearInterval(wireTimer); }, 250);
  // sp: {id, x, ref (neighbour icon UID), label, tint [r,g,b], gradient (type name), icon (svg paths),
  //      layout, cls (the game's class value on that page), hide [[uid, "away"|"hide"]], build(root) -> {refresh, destroy}}
  function add(sp) {
    if (specs.some((s) => s.id === sp.id)) return;
    specs.push(sp);
    if (tbRoot) mountButton(sp);
  }
  const svg = (paths) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths + "</svg>";
  // A page control: the game's hover tick and click sound, like its HTML pages.
  function control(parent, cls, html, onClick) {
    const b = _dtUi.el("div", cls, parent);
    b.innerHTML = html;
    b.addEventListener("pointerenter", (ev) => { if (ev.pointerType !== "touch") sound("tapHover"); });
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      sound("tapMain");
      onClick && onClick(ev);
    });
    return b;
  }
  return {
    add: add,
    open: open,
    svg: svg,
    control: control,
    page: () => (page ? page.sp.id : ""),
    refresh: () => { try { page && page.view && page.view.refresh && page.view.refresh(); } catch (e) { console.warn("[Toolbar] refresh:", e); } },
    slots: () => ({ old: OLD.slice(), now: NEW.slice() }),
  };
})();
