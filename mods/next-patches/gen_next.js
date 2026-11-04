#!/usr/bin/env node
// Build-time generator for the "Next: 90 Hz, May 2019" hint on the design pages.
//
// Starts from the template map (gen_map.js: every list selector <sel>, its
// stored ID var <id> and its <Temp> list) and adds, from the same event sheets:
//   src/name/pre/suf  SetVar(<X>_Text, [pre +] <src>.At(<id>, name) [+ suf])
//   text              Text.PickByUID(uid) -> SetText(<X>_Text)
//                     (TV, scooter, keyboard, console, VR: Text.PickByUID(uid) ->
//                     SetText([pre +] <src>.At(<id>, name) [+ suf]) in one step)
//   date              Repeat(<src>) .. <src>.CompareXY(i, date, <=, DayTotal) .. <Temp>.Push
//   right/left        Mouse.OnObjectClicked + SVG.PickByUID(uid) -> AddVar/SubVar(<sel>, 1)
//   res               the right arrow's CompareVar(<id>, <, ArrayMyResearch.At(res) - 1)
// A selector is kept only when every one of these is found exactly, so a game
// update that reshapes a page drops that hint instead of showing a wrong one.
//
// Usage: node gen_next.js <data.json> <c3main.js>
'use strict';
const path = require('path');
const { generate, load } = require(path.join(__dirname, '../template-patches/gen_map.js'));

// Design page sheets, named like the template map's categories ("Event SMARTPHONE PAGE 3").
const SHEET = /^Event (SMARTPHONE|TABLET|LAPTOP|WATCHES|HEADPHONES|TV|SCOOTER|KEYBOARD|CONSOLES|VR|GAMEPAD) PAGE \d+$/;
// Gamepad pages are not in the template map: their selectors come from SetVar(<id>, <Temp>.At(<sel> - 1, 0)).
const OWN = ['GAMEPAD'];
const RE_SELID = /^\s*\w+=>\{const t=\w+\._GetNode\(0\),n=\w+\._GetNode\(1\)\.GetVar\(\);return\(\)=>t\.ExpObject\(n\.GetValue\(\)-1,(\d+)\)\}\s*$/;
const LEVEL = 76; // layout px: a selector's label sits within one arrow height of its right arrow
const RE_CONST = /^\s*\(\)=>(-?\d+(?:\.\d+)?)\s*$/;
// e=>{const t=e._GetNode(0),n=e._GetNode(1).GetVar();return()=>HB("f/",t.ExpObject(n.GetValue(),0))}
const RE_TEXT = /^\s*\w+=>\{const t=\w+\._GetNode\(0\),n=\w+\._GetNode\(1\)\.GetVar\(\);return\(\)=>(?:HB\("((?:[^"\\]|\\.)*)",t\.ExpObject\(n\.GetValue\(\),(\d+)\)\)|HB\(t\.ExpObject\(n\.GetValue\(\),(\d+)\),"((?:[^"\\]|\\.)*)"\)|t\.ExpObject\(n\.GetValue\(\),(\d+)\))\}\s*$/;
// e=>{const t=e._GetNode(0),n=e._GetNode(1).GetVar(),o=e._GetNode(2),a=e._GetNode(3).GetVar();return()=>t.ExpObject(n.GetValue(),o.ExpObject(a.GetValue(),0))}
// ArrayLanguage.At(LanguageChoose, <src>.At(<id>, name)): the option's name is a language key.
const RE_LANG = /^\s*\w+=>\{const t=\w+\._GetNode\(0\),n=\w+\._GetNode\(1\)\.GetVar\(\),o=\w+\._GetNode\(2\),a=\w+\._GetNode\(3\)\.GetVar\(\);return\(\)=>t\.ExpObject\(n\.GetValue\(\),o\.ExpObject\(a\.GetValue\(\),(\d+)\)\)\}\s*$/;
// Upgraded chip parts (scooter, keyboard, TV CPU): "<series value><suf> -> <src>.At(<id>, name)<suf>"
// e=>{...;return()=>HB(HB(HB(t.ExpObject(n.GetValue()-1,2)," MHz [opacity=65][icon=Arrow][/opacity] "),o.ExpObject(a.GetValue(),0))," MHz")}
const RE_UPG = /^\s*\w+=>\{const t=\w+\._GetNode\(0\),n=\w+\._GetNode\(1\)\.GetVar\(\),o=\w+\._GetNode\(2\),a=\w+\._GetNode\(3\)\.GetVar\(\);return\(\)=>(?:HB\(HB\(HB\(t\.ExpObject\(n\.GetValue\(\)-1,\d+\),"((?:[^"\\]|\\.)*) \[opacity=65\]\[icon=Arrow\]\[\/opacity\] "\),o\.ExpObject\(a\.GetValue\(\),(\d+)\)\),"\1"\)|HB\(HB\(t\.ExpObject\(n\.GetValue\(\)-1,\d+\)," \[opacity=65\]\[icon=Arrow\]\[\/opacity\] "\),o\.ExpObject\(a\.GetValue\(\),(\d+)\)\))\}\s*$/;
const RE_VAR = /^\s*\w+=>\{const t=\w+\._GetNode\(0\)\.GetVar\(\);return\(\)=>t\.GetValue\(\)\}\s*$/;
const RE_RES = /^\s*\w+=>\{const t=\w+\._GetNode\(0\);return\(\)=>BB\(t\.ExpObject\((\d+)\),1\)\}\s*$/;

function scan(dataPath, mainPath) {
  const { project, refs, exprs } = load(dataPath, mainPath);
  const ref = n => refs.indexOf(n);
  const R = {
    setVar: ref('Plugins.System.Acts.SetVar'), addVar: ref('Plugins.System.Acts.AddVar'),
    subVar: ref('Plugins.System.Acts.SubVar'), cmpVar: ref('Plugins.System.Cnds.CompareVar'),
    cmpXY: ref('Plugins.Arr.Cnds.CompareXY'), push: ref('Plugins.Arr.Acts.Push'),
    textUid: ref('Plugins.Text.Cnds.PickByUID'), svgUid: ref('Plugins.SVGPicture.Cnds.PickByUID'),
    setText: ref('Plugins.Text.Acts.SetText'), clicked: ref('Plugins.Mouse.Cnds.OnObjectClicked'),
  };
  for (const k in R) if (R[k] < 0) throw new Error('ref not found: ' + k);
  const objName = k => (project[3][k] ? project[3][k][0] : null);
  const vars = {};
  const wv = (e, depth) => {
    if (!Array.isArray(e)) return;
    if (e[0] === 1 && typeof e[1] === 'string' && typeof e[6] === 'number') { vars[e[6]] = depth === 0 ? e[1] : null; return; }
    if (e[0] === 0 || e[0] === 3 || e[0] === 4) { for (const s of e[8] || []) wv(s, depth + 1); return; }
    if (e[0] === 2) e.forEach(x => wv(x, depth));
  };
  project[6].forEach(s => s[1].forEach(e => wv(e, 0)));
  const varOf = p => (Array.isArray(p) && p[0] === 11 ? vars[p[1]] || null : null);
  // An expression parameter: [0|7, [index, ...nodes]].
  const ex = p => (Array.isArray(p) && (p[0] === 0 || p[0] === 7) && Array.isArray(p[1]) ? { src: exprs[p[1][0]] || '', nodes: p[1].slice(1) } : null);
  const constOf = p => { const x = ex(p); const m = x && !x.nodes.length && RE_CONST.exec(x.src); return m ? Number(m[1]) : undefined; };
  const nodeVar = n => (n && n[0] === 3 ? vars[n[1]] || null : null);
  const nodeObj = n => (n && n[0] === 1 ? objName(n[1]) : null);

  const texts = [], textUid = {}, direct = [], fills = [], arrows = [], pages = {};
  const add = (o, k, v) => { (o[k] = o[k] || new Set()).add(v); };
  // up: the Text UID picked by a parent event (undefined when none, or when a condition in
  // between picks Text another way), for labels set in a sub-event of the pick.
  const walk = (e, cat, up) => {
    if (!Array.isArray(e)) return;
    if (!(e[0] === 0 || e[0] === 3 || e[0] === 4)) { e.forEach(x => walk(x, cat, up)); return; }
    const cnds = e[6] || [], acts = e[7] || [];
    for (const a of acts) {
      if (OWN.includes(cat) && a[0] === -1 && a[1] === R.setVar) {
        const v = varOf(a[6][0]), x = ex(a[6][1]), m = x && RE_SELID.exec(x.src);
        if (v && m && x.nodes.length === 2 && /_Temp/.test(nodeObj(x.nodes[0]) || '') && nodeVar(x.nodes[1]))
          (pages[cat] = pages[cat] || []).push({ sel: nodeVar(x.nodes[1]), id: v, temp: nodeObj(x.nodes[0]), col: Number(m[1]) });
      }
      if (a[0] === -1 && a[1] === R.setVar) {
        const v = varOf(a[6][0]), x = ex(a[6][1]), m = x && RE_TEXT.exec(x.src);
        if (v && m && x.nodes.length === 2 && nodeObj(x.nodes[0]) && nodeVar(x.nodes[1]))
          texts.push({ cat, textVar: v, src: nodeObj(x.nodes[0]), id: nodeVar(x.nodes[1]), name: Number(m[2] || m[3] || m[5]), pre: m[1] || '', suf: m[4] || '' });
      }
    }
    const tu = cnds.find(c => c[1] === R.textUid);
    const own = tu ? constOf(tu[9] && tu[9][0]) : undefined;
    const pick = tu ? own : cnds.some(c => objName(c[0]) === 'Text') ? undefined : up;
    if (tu) {
      const uid = own;
      for (const a of acts) {
        if (a[1] !== R.setText) continue;
        const x = ex(a[6] && a[6][0]);
        if (uid !== undefined && x && RE_VAR.test(x.src) && x.nodes.length === 1 && nodeVar(x.nodes[0])) add(textUid, cat + '|' + nodeVar(x.nodes[0]), uid);
      }
    }
    if (pick !== undefined) {
      for (const a of acts) {
        if (a[1] !== R.setText || objName(a[0]) !== 'Text') continue;
        const x = ex(a[6] && a[6][0]);
        const m = x && RE_TEXT.exec(x.src);
        if (m && x.nodes.length === 2 && nodeObj(x.nodes[0]) && nodeVar(x.nodes[1]))
          direct.push({ cat, uid: pick, src: nodeObj(x.nodes[0]), id: nodeVar(x.nodes[1]), name: Number(m[2] || m[3] || m[5]), pre: m[1] || '', suf: m[4] || '', lang: false });
        const u = x && RE_UPG.exec(x.src);
        if (u && x.nodes.length === 4 && /^ArrayProcessorsSeries_Temp(_Gamepad)?$/.test(nodeObj(x.nodes[0])) && nodeObj(x.nodes[2]) && nodeVar(x.nodes[3]))
          direct.push({ cat, uid: pick, src: nodeObj(x.nodes[2]), id: nodeVar(x.nodes[3]), name: Number(u[2] || u[3]), pre: '', suf: u[1] || '', lang: false });
        const l = x && RE_LANG.exec(x.src);
        if (l && x.nodes.length === 4 && nodeObj(x.nodes[0]) === 'ArrayLanguage' && nodeVar(x.nodes[1]) === 'LanguageChoose' && nodeObj(x.nodes[2]) && nodeVar(x.nodes[3]))
          direct.push({ cat, uid: pick, src: nodeObj(x.nodes[2]), id: nodeVar(x.nodes[3]), name: Number(l[1]), pre: '', suf: '', lang: true });
      }
    }
    // The game counts the rows that are out (CompareXY(i, date, <=, DayTotal) -> AddVar(n, 1))
    // and then pushes that many rows into <Temp>, in a sibling event of the same block.
    const counts = new Set(), pushes = new Set();
    const w = x => {
      for (const c of x[6] || []) {
        if (c[1] !== R.cmpXY) continue;
        const p = c[9] || [], col = constOf(p[1]), v = ex(p[3]);
        const counted = (x[7] || []).some(a => a[0] === -1 && a[1] === R.addVar && constOf(a[6][1]) === 1);
        if (counted && col !== undefined && p[2] && p[2][0] === 8 && p[2][1] === 3 && v && RE_VAR.test(v.src) && nodeVar(v.nodes[0]) === 'DayTotal')
          counts.add(objName(c[0]) + '|' + col);
      }
      for (const a of x[7] || []) if (a[1] === R.push && /_Temp$/.test(objName(a[0]) || '')) pushes.add(objName(a[0]));
      (x[8] || []).forEach(y => Array.isArray(y) && (y[0] === 0 || y[0] === 3 || y[0] === 4) && w(y));
    };
    w(e);
    if (counts.size === 1 && pushes.size === 1) {
      const [src, col] = [...counts][0].split('|');
      fills.push({ cat, src, temp: [...pushes][0], date: Number(col) });
    }
    if (cnds.some(c => c[1] === R.clicked)) {
      const su = cnds.find(c => c[1] === R.svgUid);
      const uid = su && constOf(su[9] && su[9][0]);
      if (uid !== undefined) {
        const cmp = cnds.filter(c => c[0] === -1 && c[1] === R.cmpVar).map(c => ({ v: varOf(c[9][0]), op: c[9][1], x: ex(c[9][2]) }));
        for (const a of acts) {
          if (a[0] !== -1 || (a[1] !== R.addVar && a[1] !== R.subVar) || constOf(a[6][1]) !== 1) continue;
          arrows.push({ cat, sel: varOf(a[6][0]), uid, dir: a[1] === R.addVar ? 1 : -1, cmp });
        }
      }
    }
    (e[8] || []).forEach(x => walk(x, cat, pick));
  };
  for (const sheet of project[6]) {
    const m = SHEET.exec(sheet[0]);
    if (m) sheet[1].forEach(e => walk(e, m[1] === 'CONSOLES' ? 'CONSOLE' : m[1]));
  }
  // Layout y of every instance by UID ([[x, y, ...], type, uid, ...] in the layouts).
  const posY = {};
  const wl = x => {
    if (!Array.isArray(x)) return;
    if (Array.isArray(x[0]) && x[0].length > 4 && typeof x[0][1] === 'number' && typeof x[2] === 'number') { posY[x[2]] = x[0][1]; return; }
    x.forEach(wl);
  };
  wl(project[5]);
  return { texts, textUid, direct, fills, arrows, pages, objName, posY };
}

function generateNext(dataPath, mainPath) {
  const { out: tpl } = generate(dataPath, mainPath);
  const s = scan(dataPath, mainPath);
  const one = list => (list.length && list.every(x => JSON.stringify(x) === JSON.stringify(list[0])) ? list[0] : null);
  const result = {};
  const cats = Object.assign({}, tpl);
  for (const cat in s.pages) cats[cat] = { groups: [{ maps: s.pages[cat] }] };
  for (const [cat, o] of Object.entries(cats)) {
    const seen = new Set(), rows = [];
    for (const g of o.groups) for (const mp of g.maps) {
      const key = mp.sel + '|' + mp.id;
      // The Temp column holding the source row: 1 on the phone-style pages (where column 0
      // is a CPU/GPU own-chip list), 0 on the one-column lists of TV, scooter, keyboard, console, VR.
      if (seen.has(key) || mp.col > 1) continue;
      seen.add(key);
      const via = mp.col === 1
        ? s.texts.filter(x => x.cat === cat && x.id === mp.id).map(({ textVar, src, name, pre, suf }) => ({ textVar, src, name, pre, suf }))
        : s.direct.filter(x => x.cat === cat && x.id === mp.id).map(({ uid, src, name, pre, suf, lang }) => ({ uid, src, name, pre, suf, lang }));
      const right = one(s.arrows.filter(a => a.cat === cat && a.sel === mp.sel && a.dir === 1).map(a => a.uid));
      // Several labels read the option (value + description line): the value is the one level
      // with the arrows in the layout; a tie keeps none.
      const near = list => {
        const d = x => Math.abs((s.posY[x.uid] ?? Infinity) - (s.posY[right] ?? NaN));
        const best = Math.min(...list.map(d));
        const at = list.filter(x => d(x) === best);
        return Number.isFinite(best) && at.length === 1 ? at : list;
      };
      const t = one(mp.col === 0 && right !== null && new Set(via.map(x => x.uid)).size > 1 ? near(via) : via);
      if (!t) continue;
      const uids = mp.col === 1 ? [...(s.textUid[cat + '|' + t.textVar] || [])] : [t.uid];
      const fill = one(s.fills.filter(f => f.cat === cat && f.src === t.src && f.temp === mp.temp).map(f => f.date));
      const left = one(s.arrows.filter(a => a.cat === cat && a.sel === mp.sel && a.dir === -1).map(a => a.uid));
      if (uids.length !== 1 || fill === null || right === null) continue;
      // A label set elsewhere (a pop-up tile reading the same list) is not this selector's.
      if (!(Math.abs(s.posY[uids[0]] - s.posY[right]) <= LEVEL)) continue;
      // Research cap on the right arrow: CompareVar(<id>, <, BB(ArrayMyResearch.At(n), 1)).
      const caps = s.arrows.filter(a => a.cat === cat && a.sel === mp.sel && a.dir === 1).flatMap(a => a.cmp)
        .filter(c => c.v === mp.id && c.op && c.op[0] === 8 && c.op[1] === 2 && c.x && c.x.nodes.length === 1 && s.objName(c.x.nodes[0][1]) === 'ArrayMyResearch')
        .map(c => { const m = RE_RES.exec(c.x.src); return m ? Number(m[1]) : null; });
      const res = caps.length === 1 && caps[0] !== null ? caps[0] : null;
      rows.push({ sel: mp.sel, id: mp.id, temp: mp.temp, col: mp.col, src: t.src, date: fill, name: t.name, lang: !!t.lang, pre: t.pre, suf: t.suf, text: uids[0], right, left, res });
    }
    if (rows.length) result[cat] = rows;
  }
  return result;
}

if (require.main === module) {
  const [dataPath, mainPath, flag] = process.argv.slice(2);
  if (!dataPath || !mainPath) { console.error('usage: gen_next.js <data.json> <c3main.js> [--summary]'); process.exit(2); }
  const out = generateNext(dataPath, mainPath);
  if (flag === '--summary') for (const [cat, rows] of Object.entries(out)) console.log(cat, rows.length, rows.map(r => r.sel + (r.res === null ? '' : '/r' + r.res)).join(' '));
  else process.stdout.write(JSON.stringify(out));
}
module.exports = { generateNext, scan };
