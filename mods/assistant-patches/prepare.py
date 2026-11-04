"""Let NO close the "hold a presentation of your new device?" offer.

The assistant's NO button (office-news-btn-1, `Event ASSISTANT`) closes each
two-button dialog through a sub-event per AssistantTheme. PRESENTATION has a
YES sub-event (go to PRESENTATION MENU) but no NO sub-event, so NO only plays
the tap sound and the offer stays open until YES is pressed. This adds a NO
sub-event for PRESENTATION by copying the game's own PRESS CONFERENCE one
(drop the queued message, Assistant OFF, Assistant_OFF), the matching offer
whose NO already closes it.

transform() returns the source unchanged once the game handles it upstream.
"""
import json

ASSISTANT_THEME = 353417754891878
NO_EVENT = 622627875710839                    # On clicked office-news-btn-1, Assistant = ON
NO_PRESS_CONFERENCE = 615869728866750         # its PRESS CONFERENCE sub-event (the copy's source)
YES_PRESS_CONFERENCE = 747082410946363        # YES sub-events, used to identify each theme
YES_PRESENTATION = 226096937225841
NEW_SIDS = (913540275119001, 913540275119002, 913540275119003, 913540275119004, 913540275119005)


def block(source, sid, start=0, end=None):
    """(start, end) of the one event with this SID inside source[start:end]."""
    end = len(source) if end is None else end
    key = '[0,0,false,null,%d,' % sid
    at = source.find(key, start, end)
    if at < 0 or source.find(key, at + 1, end) >= 0:
        raise ValueError(f'Expected exactly one event {sid}')
    depth, quoted, escaped = 0, False, False
    for i in range(at, end):
        c = source[i]
        if quoted:
            if escaped:
                escaped = False
            elif c == '\\':
                escaped = True
            elif c == '"':
                quoted = False
        elif c == '"':
            quoted = True
        elif c == '[':
            depth += 1
        elif c == ']':
            depth -= 1
            if not depth:
                return at, i + 1
    raise ValueError(f'Event {sid} is not closed')


def theme_test(theme):
    return '[[11,%d],[8,0],[7,[%d]]]' % (ASSISTANT_THEME, theme)


def theme_of(text):
    """The expression index a theme sub-event compares AssistantTheme to."""
    head = '[[11,%d],[8,0],[7,[' % ASSISTANT_THEME
    at = text.find(head)
    if at < 0 or text.find(head, at + 1) >= 0:
        raise ValueError('Expected one AssistantTheme test')
    at += len(head)
    return int(text[at:text.index(']', at)])


def transform(source):
    yes_conf = source[slice(*block(source, YES_PRESS_CONFERENCE))]
    yes_pres = source[slice(*block(source, YES_PRESENTATION))]
    if '[[6,"PRESS CONFERENCE"]]' not in yes_conf or '[[6,"PRESENTATION MENU"]]' not in yes_pres:
        raise ValueError('YES sub-events no longer open PRESS CONFERENCE / PRESENTATION MENU')
    conference, presentation = theme_of(yes_conf), theme_of(yes_pres)
    no_start, no_end = block(source, NO_EVENT)
    if theme_test(presentation) in source[no_start:no_end]:
        return source
    copy_start, copy_end = block(source, NO_PRESS_CONFERENCE, no_start, no_end)
    text = source[copy_start:copy_end]
    event = json.loads(text)
    if json.dumps(event, separators=(',', ':')) != text:
        raise ValueError('PRESS CONFERENCE NO sub-event does not round-trip')
    conditions, actions = event[6], event[7]
    if (theme_of(text) != conference or len(conditions) != 1 or len(actions) != 3
            or actions[2][:2] != [-2, 'Assistant_OFF'] or len(event) != 8):
        raise ValueError('PRESS CONFERENCE NO sub-event has changed shape')
    for sid in NEW_SIDS:
        if str(sid) in source:
            raise ValueError(f'SID {sid} already present')
    # Same event with fresh SIDs (event, condition, each action) and the PRESENTATION theme.
    event[4], conditions[0][7] = NEW_SIDS[:2]
    for action, sid in zip(actions, NEW_SIDS[2:]):
        action[3] = sid
    conditions[0][9][2] = [7, [presentation]]
    copy = json.dumps(event, separators=(',', ':'))
    if theme_of(copy) != presentation:
        raise ValueError('Copied sub-event does not test PRESENTATION')
    return source[:copy_end] + ',' + copy + source[copy_end:]
