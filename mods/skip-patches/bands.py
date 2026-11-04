"""Read the review price card bands out of the shipped game.

Every ReviewsEngine_<type> function in the 282 REVIEWS event sheet compares the
markup of the reviewed device, (SELL * 100 / COST) - 100, against constants and
pushes a price phrase id with round(random(lo, hi)). This walks data.json's
event tree and resolves the expression indices against c3main.js's
C3_ExpressionFuncs, so the forecast uses the game's own numbers. Any change in
the shape raises ValueError and the build stops.
"""
import json
import re

# C3 System.Cnds.Compare operators: 0 =, 1 !=, 2 <, 3 <=, 4 >, 5 >=.
_OPS = {2: '<', 3: '<=', 4: '>', 5: '>='}
_MARKUP = re.compile(r'return\(\)=>BB\(FB\(LB\(t\.ExpObject\(0,n\.GetValue\(\),4\),100\),o\.ExpObject\(0,a\.GetValue\(\),3\)\),100\)\}$')
_PUSH = re.compile(r'return\(\)=>Math\.round\(t\((\d+),(\d+)\)\)\}$')
_CONST = re.compile(r'^\(\)=>(-?\d+(?:\.\d+)?)$')


def split_exprs(src):
    """The C3_ExpressionFuncs entries as source strings, in index order."""
    key = 'C3_ExpressionFuncs=['
    at = src.find(key)
    if at < 0:
        raise ValueError('C3_ExpressionFuncs not found')
    out, depth, quote, last = [], 0, None, at + len(key)
    i = last
    while i < len(src):
        c = src[i]
        if quote:
            if c == '\\':
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in '"\'`':
            quote = c
        elif c in '([{':
            depth += 1
        elif c in ')]}':
            if depth == 0:
                out.append(src[last:i])
                return out
            depth -= 1
        elif c == ',' and depth == 0:
            out.append(src[last:i])
            last = i + 1
        i += 1
    raise ValueError('C3_ExpressionFuncs not closed')


def _functions(node, found):
    """Every event-sheet function block: [4, [name, ...], ..., children]."""
    if isinstance(node, list):
        if len(node) >= 9 and node[0] == 4 and isinstance(node[1], list) and node[1] and isinstance(node[1][0], str):
            found[node[1][0]] = node
        for c in node:
            _functions(c, found)
    return found


def _events(node):
    """Plain events under a block, depth first: [0, 0, false, null, sid, n, conds, acts, children?]."""
    if not isinstance(node, list):
        return
    if len(node) >= 8 and node[0] == 0 and isinstance(node[6], list) and isinstance(node[7], list):
        yield node
    for c in node:
        if isinstance(c, list):
            yield from _events(c)


def _expr(exprs, param):
    if isinstance(param, list) and len(param) == 2 and param[0] == 7 and isinstance(param[1], list) and param[1]:
        return exprs[param[1][0]]
    return None


def engine_bands(fn, exprs):
    """[(conditions, (lo, hi), after_shuffle, array)] for one engine; conditions are [(op, value)]."""
    rows, shuffled = [], False
    for ev in _events(fn[8]):
        acts = ev[7]
        if rows and any(isinstance(a, list) and len(a) > 6 and a[0] == rows[0][3] and a[6] == [[3, 0]] for a in acts):
            shuffled = True  # ArrayReviews_Temp.Shuffle([3,0]) on the array the price phrases go to
        conds = ev[6]
        if not conds or not all(isinstance(c, list) and len(c) > 9 and c[0] == -1 and c[1] == 95 for c in conds):
            continue
        tests = []
        for c in conds:
            left, op, right = c[9][0], c[9][1], c[9][2]
            if not _MARKUP.search(_expr(exprs, left) or ''):
                tests = None
                break
            m = _CONST.match(_expr(exprs, right) or '')
            if not m or op[1] not in _OPS:
                raise ValueError('price check changed: %r %r' % (op, _expr(exprs, right)))
            tests.append((_OPS[op[1]], float(m.group(1))))
        if not tests:
            continue
        if len(acts) != 1:
            raise ValueError('price push changed (%d actions)' % len(acts))
        m = _PUSH.search(_expr(exprs, acts[0][6][1]) or '')
        if not m:
            raise ValueError('price push expression changed')
        rows.append((tests, (int(m.group(1)), int(m.group(2))), shuffled, acts[0][0]))
    return rows


def dispatch(project, exprs):
    """{DeviceTypeCreatingNow value: engine} from the REVIEWS layout start (282 REVIEWS:26-73)."""
    out = {}
    for ev in _events(project[6]):
        conds, acts = ev[6], ev[7]
        if len(conds) != 1 or len(acts) != 1:
            continue
        a = acts[0]
        if not (isinstance(a, list) and len(a) > 1 and a[0] == -2 and str(a[1]).startswith('ReviewsEngine_')):
            continue
        c = conds[0]
        if not (isinstance(c, list) and len(c) > 9 and c[0] == -1 and c[9][1] == [8, 0]):
            continue
        m = re.match(r'^\(\)=>"([A-Z ]+)"$', _expr(exprs, c[9][2]) or '')
        if m:
            out.setdefault(m.group(1), a[1])
    return out


def _var_sid(node, name):
    """sid of a global variable from its declaration [1, name, type, init, ..., sid, ...]."""
    if isinstance(node, list):
        if len(node) >= 7 and node[0] == 1 and node[1] == name and isinstance(node[6], int):
            return node[6]
        for c in node:
            r = _var_sid(c, name)
            if r is not None:
                return r
    return None


def _const_str(exprs, param):
    m = re.match(r'^\(\)=>"([A-Z ]+)"$', _expr(exprs, param) or '')
    return m.group(1) if m else None


def editor_types(project, exprs):
    """{DeviceType: DeviceTypeCreatingNow}: 278 LOADING EDITOR calls <T>AddToArray for the
    editor's DeviceType, and <T>AddToArray(_Finish) sets DeviceTypeCreatingNow. The price
    page runs before that, so it only has DeviceType."""
    sid_type = _var_sid(project[6], 'DeviceType')
    sid_now = _var_sid(project[6], 'DeviceTypeCreatingNow')
    if sid_type is None or sid_now is None:
        raise ValueError('DeviceType / DeviceTypeCreatingNow not declared')
    fns = _functions(project[6], {})
    out = {}
    for ev in _events(project[6]):
        conds, acts = ev[6], ev[7]
        if len(conds) != 1 or len(acts) != 1:
            continue
        a, c = acts[0], conds[0]
        if not (isinstance(a, list) and len(a) > 1 and a[0] == -2 and str(a[1]).endswith('AddToArray')):
            continue
        if not (isinstance(c, list) and len(c) > 9 and c[0] == -1 and c[9][0] == [11, sid_type] and c[9][1] == [8, 0]):
            continue
        typ = _const_str(exprs, c[9][2])
        sets = set()
        for name in (a[1], a[1] + '_Finish'):
            for e in _events(fns.get(name, [])):
                for act in e[7]:
                    if isinstance(act, list) and len(act) > 6 and act[0] == -1 and isinstance(act[6], list) \
                            and len(act[6]) == 2 and act[6][0] == [11, sid_now]:
                        v = _const_str(exprs, act[6][1])
                        if v:
                            sets.add(v)
        if typ and len(sets) == 1:
            out[typ] = sets.pop()
    return out


def _band(tests):
    lo, hi = None, None
    for op, v in tests:
        if op == '>=':
            lo = v
        elif op == '<':
            hi = v
        else:
            raise ValueError('unexpected price comparison ' + op)
    return lo, hi


def extract(data_text, c3main):
    """{'bands': [{min, max, lo, hi, front}], 'engines': [...], 'none': [...]}.

    min/max: markup range [min, max) with None for open ends; lo/hi: price
    phrase ids; front: pushed after the shuffle, so always the first card.
    """
    exprs = split_exprs(c3main)
    project = json.loads(data_text)['project']
    fns = _functions(project[6], {})
    engines = sorted(n for n in fns if n.startswith('ReviewsEngine_') and n != 'ReviewsEngineResults')
    if len(engines) < 16:
        raise ValueError('review engines missing: %d' % len(engines))
    table, with_price, without = None, [], []
    for name in engines:
        rows = engine_bands(fns[name], exprs)
        if not rows:
            without.append(name)
            continue
        bands = sorted(
            ({'min': _band(t)[0], 'max': _band(t)[1], 'lo': lo, 'hi': hi, 'front': after} for t, (lo, hi), after, _ in rows),
            key=lambda b: -1 if b['min'] is None else b['min'])
        if table is None:
            table = bands
        elif bands != table:
            raise ValueError('price bands differ in ' + name)
        with_price.append(name)
    if not table or len(table) != 5:
        raise ValueError('price bands changed: %r' % table)
    for a, b in zip(table, table[1:]):
        if a['max'] != b['min']:
            raise ValueError('price bands have a gap: %r' % table)
    if table[0]['min'] is not None or table[-1]['max'] is not None:
        raise ValueError('price bands are not open-ended')
    types = {v: e for v, e in dispatch(project, exprs).items() if e in with_price}
    if sorted(set(types.values())) != with_price:
        raise ValueError('review dispatch changed: %r' % types)
    editor = {t: v for t, v in editor_types(project, exprs).items() if v in types}
    if len(editor) != len(types):
        raise ValueError('editor device types changed: %r' % editor)
    return {'bands': table, 'types': dict(sorted(types.items())), 'editor': dict(sorted(editor.items())), 'none': without}


if __name__ == '__main__':
    from pathlib import Path
    port = Path(__file__).resolve().parents[2]
    out = extract((port / 'game-files/data.json').read_text(),
                  (port / 'game-files/scripts/c3main.js').read_text())
    print(json.dumps(out, indent=1))
