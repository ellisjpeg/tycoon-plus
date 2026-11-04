# Presentation offer NO fix, 2026-10-17

Symptom: after starting a batch, the NEWS dialog asks "Do you want to hold a
presentation of your new device?" Pressing NO does nothing (tap sound only);
the dialog stays until YES is pressed. Same with mouse or touch, in both the 2026-10-16 update and the version before it.

Cause (game logic): `Event ASSISTANT` handles NO
(`On clicked office-news-btn-1`, Assistant = ON) with one sub-event per
AssistantTheme. PRESENTATION has a YES sub-event (go to PRESENTATION MENU) but
no NO sub-event, and the generic close only applies to one-button dialogs.

Fix (`prepare.py`, applied to `data.json`;
`DEVICES_TYCOON_ASSISTANT=off` disables it): copy the game's own PRESS
CONFERENCE NO sub-event (drop the queued message, Assistant OFF,
Assistant_OFF) with new SIDs and the PRESENTATION theme. If a later game
version adds its own PRESENTATION NO, the source is returned unchanged.

Checks: `python3 mods/assistant-patches/test_assistant.py` (only that one
sub-event is added, in place, with the PRESENTATION expression; applies once;
rejects drift), then NO closing the live dialog in the running game.
