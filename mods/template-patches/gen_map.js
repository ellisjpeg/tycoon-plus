#!/usr/bin/env node
// Build-time generator for the "Use previous device" template system.
//
// Reads the exported Construct project (data.json) and the matching runtime
// (c3main.js) and finds, for every device category, which editor list each
// saved part ID comes from:
//
//   SetVar(<idVar>, <Temp>.At(<selVar> - 1, <col>))   inside <Prefix>PageN_* functions
//
// The device arrays store <idVar> (a stable database row), never <selVar>
// (a 1-based position in the current, time-dependent list). The runtime module
// uses this table to turn a stored ID back into a position, or into the next
// available part when the original one is no longer offered.
//
// Usage: node gen_map.js <data.json> <c3main.js> [--summary]
'use strict';
const fs = require('fs');

const UI_VARS = new Set(['MiniPage', 'CameraSelected']);
const PREFIX = {
  SMARTPHONE: 'SmartphonePage', TABLET: 'TabletPage', LAPTOP: 'LaptopPage',
  WATCHES: 'WatchesPage', HEADPHONES: 'HeadphonesPage', TV: 'TVPage',
  SCOOTER: 'ScooterPage', KEYBOARD: 'KeyboardPage', CONSOLE: 'ConsolePage', VR: 'VRPage',
};
// IDs that index a growing/shifting array or another device, never a list row.
const NEVER_RESTORE = new Set(['PackageHeadphonesID', 'GamepadSelected_ID']);

function load(dataPath, mainPath) {
  const project = JSON.parse(fs.readFileSync(dataPath, 'utf8')).project;
  const src = fs.readFileSync(mainPath, 'utf8');
  const refKey = 'C3_GetObjectRefTable=function(){return[';
  const ra = src.indexOf(refKey);
  if (ra < 0) throw new Error('C3_GetObjectRefTable not found');
  const refs = src.slice(ra + refKey.length, src.indexOf(']', ra + refKey.length))
    .split(',').map(s => s.replace(/^C3\d*\./, ''));
  const ea = src.indexOf('C3_ExpressionFuncs=[');
  if (ea < 0) throw new Error('C3_ExpressionFuncs not found');
  let i = ea + 'C3_ExpressionFuncs='.length, depth = 0, q = null;
  const start = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '[' || c === '(' || c === '{') depth++;
    else if (c === ']' || c === ')' || c === '}') { depth--; if (depth === 0) break; }
  }
  // Only the function sources are needed; they are never executed here.
  const exprs = splitTopLevel(src.slice(start + 1, i));
  // The name screen's own variables start its module (numbered names change between builds).
  const heads = [...src.matchAll(/var _container\d+=null,_cssInjected\d+=!1,_resizeObs\d+=null,_step\d+="count",_busy\d+=!1/g)];
  if (heads.length !== 1) throw new Error('device name screen maps not found');
  const ma = heads[0].index;
  const mb = src.indexOf(';function _langArrayCovers', ma);
  if (mb < 0 || /\bfunction\b/.test(src.slice(ma, mb))) throw new Error('device name screen maps changed');
  const maps = (new Function(src.slice(ma, mb) + ';return {_DEVICES,_DEVICE_ARRAY,_RESTORE_MAP,_DESIGN_MAP}'))();
  return { project, refs, exprs, maps };
}

function splitTopLevel(body) {
  const out = []; let depth = 0, q = null, last = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '[' || c === '(' || c === '{') depth++;
    else if (c === ']' || c === ')' || c === '}') depth--;
    else if (c === ',' && depth === 0) { out.push(body.slice(last, i)); last = i + 1; }
  }
  if (body.slice(last).trim()) out.push(body.slice(last));
  return out;
}

// e=>{const t=e._GetNode(0),n=e._GetNode(1).GetVar();return()=>t.ExpObject(n.GetValue()-1,COL)}
const RE_LIST = /^\s*(\w+)=>\{const (\w+)=\1\._GetNode\(0\),(\w+)=\1\._GetNode\(1\)\.GetVar\(\);return\(\)=>\2\.ExpObject\(\3\.GetValue\(\)-1,(\d+)\)\}\s*$/;
// e=>{const t=e._GetNode(0).GetVar();return()=>t.GetValue()-1}
const RE_LINEAR = /^\s*(\w+)=>\{const (\w+)=\1\._GetNode\(0\)\.GetVar\(\);return\(\)=>\2\.GetValue\(\)([+-]\d+)\}\s*$/;
const RE_CONST = /^\s*\(\)=>(-?\d+(?:\.\d+)?|"(?:[^"\\]|\\.)*")\s*$/;

function constValue(exprs, param) {
  if (!Array.isArray(param) || param[0] !== 7 || !Array.isArray(param[1]) || param[1].length !== 1) return undefined;
  const m = RE_CONST.exec(exprs[param[1][0]] || '');
  return m ? JSON.parse(m[1]) : undefined;
}

function generate(dataPath, mainPath) {
  const { project, refs, exprs, maps } = load(dataPath, mainPath);
  const objName = k => (project[3][k] ? project[3][k][0] : null);
  const SETVAR = refs.indexOf('Plugins.System.Acts.SetVar');
  const CMPVAR = refs.indexOf('Plugins.System.Cnds.CompareVar');
  if (SETVAR < 0 || CMPVAR < 0) throw new Error('System SetVar/CompareVar refs not found');

  const vars = {}; // sid -> {name, global}
  (function scanVars() {
    const w = (e, depth) => {
      if (!Array.isArray(e)) return;
      if (e[0] === 1 && typeof e[1] === 'string' && typeof e[6] === 'number') { vars[e[6]] = { name: e[1], global: depth === 0 }; return; }
      if (e[0] === 0 || e[0] === 3 || e[0] === 4) { for (const s of e[8] || []) w(s, depth + 1); return; }
      if (e[0] === 2) e.forEach(x => w(x, depth));
    };
    project[6].forEach(s => s[1].forEach(e => w(e, 0)));
  })();
  const varName = sid => (vars[sid] && vars[sid].global ? vars[sid].name : null);

  const out = {};
  for (const cat of Object.keys(PREFIX)) {
    const rm = maps._RESTORE_MAP[cat];
    if (!rm) throw new Error('no restore map for ' + cat);
    out[cat] = { arr: rm.arr, groups: [], linear: [] };
  }

  // Own-OS option: selector 0 is only offered while ArrayMyOS_<x>(0,0) > 0.
  // Record which ArrayMyOS_* guards a "SetVar(sel, 0)" in each sheet.
  const CMPXY = refs.indexOf('Plugins.Arr.Cnds.CompareXY');
  const fnSheet = {}, ownBySheet = [];
  project[6].forEach((sheet, si) => {
    ownBySheet[si] = {};
    const w = (e, own) => {
      if (!Array.isArray(e)) return;
      if (e[0] === 0 || e[0] === 3 || e[0] === 4) {
        if (e[0] === 4) fnSheet[e[1][0]] = si;
        let mine = own;
        for (const cnd of e[6] || []) {
          const n = cnd[0] >= 0 ? objName(cnd[0]) : null;
          if (n && /^ArrayMyOS_/.test(n) && cnd[1] === CMPXY) mine = mine.concat([n]);
        }
        if (mine.length) for (const a of e[7] || []) {
          if (a[0] !== -1 || a[1] !== SETVAR) continue;
          const id = varName(a[6][0][1]);
          if (id && constValue(exprs, a[6][1]) === 0) (ownBySheet[si][id] = ownBySheet[si][id] || new Set()).add(mine[mine.length - 1]);
        }
        for (const s of e[8] || []) w(s, mine);
      } else e.forEach(x => w(x, own));
    };
    sheet[1].forEach(e => w(e, []));
  });

  // Global vars each function writes, directly or through functions it calls.
  const WRITE_ACTS = new Set(['SetVar', 'AddVar', 'SubtractVar', 'SetBoolVar', 'ToggleBoolVar']
    .map(a => refs.indexOf('Plugins.System.Acts.' + a)).filter(i => i >= 0));
  const fnDirect = {};
  (function scanFns() {
    const w = (e, fn) => {
      if (!Array.isArray(e)) return;
      if (e[0] === 0 || e[0] === 3 || e[0] === 4) {
        if (e[0] === 4) { fn = e[1][0]; fnDirect[fn] = fnDirect[fn] || { writes: new Set(), calls: new Set() }; }
        if (fn) for (const a of e[7] || []) {
          if (a[0] === -1 && WRITE_ACTS.has(a[1])) { const id = varName(a[6] && a[6][0] && a[6][0][1]); if (id) fnDirect[fn].writes.add(id); }
          else if (a[0] === -2 && typeof a[1] === 'string') fnDirect[fn].calls.add(a[1]);
        }
        for (const s of e[8] || []) w(s, fn);
      } else e.forEach(x => w(x, fn));
    };
    project[6].forEach(sheet => sheet[1].forEach(e => w(e, null)));
  })();
  const fnWrites = fn => {
    const seen = new Set(), out = new Set(), todo = [fn];
    while (todo.length) {
      const f = todo.pop();
      if (seen.has(f) || !fnDirect[f]) continue;
      seen.add(f);
      fnDirect[f].writes.forEach(v => out.add(v));
      fnDirect[f].calls.forEach(c => todo.push(c));
    }
    return out;
  };

  // Collect every global SetVar inside the category page functions together
  // with the System conditions on its path (one level per event).
  const sets = [];
  const walk = (e, ctx) => {
    if (!Array.isArray(e)) return;
    if (e[0] === 0 || e[0] === 3 || e[0] === 4) {
      const c = { fn: ctx.fn, cat: ctx.cat, levels: ctx.levels };
      if (e[0] === 4) {
        c.fn = e[1][0]; c.cat = null; c.levels = [];
        for (const [cat, prefix] of Object.entries(PREFIX)) {
          // Only enabled, synchronous, parameterless functions are safe to call from the name screen.
          if (new RegExp('^' + prefix + '\\d+_').test(c.fn) && (e[1][2] || []).length === 0 && e[1][3] === true && e[1][4] !== true) c.cat = cat;
        }
      }
      const level = { or: e[2] === true, c: [], opaque: false };
      for (const cnd of e[6] || []) {
        if (cnd[0] !== -1) continue; // object conditions only filter instances
        if (cnd[1] === CMPVAR) {
          const p = cnd[9];
          const name = varName(p[0][1]);
          const val = constValue(exprs, p[2]);
          if (name && val !== undefined && p[1][0] === 8) level.c.push([name, p[1][1], val]);
          else level.opaque = true;
        } else if (refs[cnd[1]] === 'Plugins.System.Cnds.Else') level.opaque = true;
      }
      if (level.c.length || level.opaque) c.levels = c.levels.concat([level]);
      if (c.cat) {
        for (const a of e[7] || []) {
          if (a[0] !== -1 || a[1] !== SETVAR) continue;
          const [vp, ep] = a[6];
          const id = varName(vp[1]);
          if (!id || !Array.isArray(ep) || ep[0] !== 7) continue;
          sets.push({ cat: c.cat, fn: c.fn, levels: c.levels, id, src: exprs[ep[1][0]] || '', nodes: ep[1].slice(1) });
        }
      }
      for (const s of e[8] || []) walk(s, c);
    } else e.forEach(x => walk(x, ctx));
  };
  project[6].forEach(s => s[1].forEach(e => walk(e, { fn: null, cat: null, levels: [] })));

  // A level that only tests UI vars with "=" (and is not an OR block) selects a UI combo.
  const uiOf = levels => {
    const ui = [], when = [];
    for (const l of levels) {
      const allUi = !l.or && !l.opaque && l.c.length && l.c.every(k => UI_VARS.has(k[0]) && k[1] === 0);
      if (allUi) ui.push(...l.c.map(k => [k[0], k[2]]));
      else {
        const rest = { or: l.or, c: l.c.filter(k => !UI_VARS.has(k[0])), opaque: l.opaque || l.c.some(k => UI_VARS.has(k[0])) };
        if (rest.c.length || rest.opaque) when.push(rest);
      }
    }
    return { ui, when };
  };

  for (const cat of Object.keys(PREFIX)) {
    const stored = new Set(Object.values(maps._RESTORE_MAP[cat].gv));
    const o = out[cat];
    const groups = new Map();
    const group = (fn, ui) => {
      const key = fn + JSON.stringify(ui);
      if (!groups.has(key)) groups.set(key, { fn, ui, maps: [], free: [], writes: new Set() });
      return groups.get(key);
    };
    const mine = sets.filter(s => s.cat === cat);
    for (const s of mine) {
      const { ui, when } = uiOf(s.levels);
      let m;
      if ((m = RE_LIST.exec(s.src)) && s.nodes.length === 2 && s.nodes[0][0] === 1 && s.nodes[1][0] === 3) {
        const temp = objName(s.nodes[0][1]);
        const sel = varName(s.nodes[1][1]);
        if (!temp || !sel || !/_Temp$/.test(temp) || UI_VARS.has(sel)) continue;
        const g = group(s.fn, ui);
        if (stored.has(s.id) && !NEVER_RESTORE.has(s.id)) g.maps.push({ id: s.id, temp, col: Number(m[4]), sel, when });
        else if (!stored.has(sel) && !g.free.some(f => f.sel === sel)) g.free.push({ sel, temp });
      } else if ((m = RE_LINEAR.exec(s.src)) && s.nodes.length === 1 && s.nodes[0][0] === 3) {
        const sel = varName(s.nodes[0][1]);
        if (sel && !UI_VARS.has(sel) && stored.has(s.id) && !NEVER_RESTORE.has(s.id)) o.linear.push({ id: s.id, sel, k: Number(m[3]) });
      }
    }
    // Only keep groups that own at least one list mapping; attach stored writes.
    for (const g of groups.values()) {
      if (!g.maps.length) continue;
      for (const s of mine) {
        if (s.fn !== g.fn || !stored.has(s.id) || NEVER_RESTORE.has(s.id)) continue;
        const { ui } = uiOf(s.levels);
        if (ui.every(([k, v]) => g.ui.some(([gk, gv]) => gk === k && gv === v))) g.writes.add(s.id);
      }
      // A selector drives its list only when it identifies a single saved ID;
      // otherwise (one selector feeding several IDs) the mapping only verifies.
      for (const mp of g.maps) {
        const ids = new Set(o.groups.concat([g]).flatMap(x => x.maps).filter(x => x.sel === mp.sel).map(x => x.id));
        mp.drive = ids.size === 1 || mp.id === mp.sel + 'ID' || mp.id === mp.sel + '_ID';
      }
      g.writes = [...g.writes];
      o.groups.push(g);
    }
    // Recompute drive flags across all groups of the category.
    const bySel = new Map();
    for (const g of o.groups) for (const mp of g.maps) { if (!bySel.has(mp.sel)) bySel.set(mp.sel, new Set()); bySel.get(mp.sel).add(mp.id); }
    for (const g of o.groups) for (const mp of g.maps) mp.drive = bySel.get(mp.sel).size === 1 || mp.id === mp.sel + 'ID' || mp.id === mp.sel + '_ID';
    // Free selectors pick a parent list (e.g. OS vendor) whose own ID is never saved.
    // Selectors the function derives itself (e.g. CameraMPX_Main = CameraMPX_k) are not free.
    for (const g of o.groups) {
      const derived = new Set(mine.filter(s => s.fn === g.fn).map(s => s.id));
      g.free = g.free.filter(f => !bySel.has(f.sel) && !derived.has(f.sel));
      for (const f of g.free) {
        const own = (ownBySheet[fnSheet[g.fn]] || {})[f.sel];
        f.own = own && own.size === 1 ? [...own][0] : null;
      }
    }
    // Everything a template copy can change, so "New design" reverts only that.
    const touch = new Set();
    for (const g of o.groups) {
      fnWrites(g.fn).forEach(v => touch.add(v));
      g.maps.forEach(m => touch.add(m.sel));
      g.free.forEach(f => touch.add(f.sel));
    }
    o.linear.forEach(l => touch.add(l.sel));
    o.touch = [...touch].sort();
    const lin = new Map();
    for (const l of o.linear) { if (!lin.has(l.id)) lin.set(l.id, new Map()); lin.get(l.id).set(l.sel + ':' + l.k, l); }
    o.linear = [...lin.values()].filter(v => v.size === 1).map(v => [...v.values()][0]);
  }
  const stats = {};
  return { out, stats, maps };
}

if (require.main === module) {
  const [dataPath, mainPath, flag] = process.argv.slice(2);
  if (!dataPath || !mainPath) { console.error('usage: gen_map.js <data.json> <c3main.js> [--summary]'); process.exit(2); }
  const { out, stats } = generate(dataPath, mainPath);
  if (flag === '--summary') {
    for (const [cat, o] of Object.entries(out)) {
      const maps = o.groups.flatMap(g => g.maps);
      console.log(cat, 'groups', o.groups.length, 'maps', maps.length, 'ids', new Set(maps.map(m => m.id)).size,
        'verify', maps.filter(m => !m.drive).length, 'free', o.groups.flatMap(g => g.free.map(f => g.fn.replace(/_ButtonsOpacity$/, '') + ':' + f.sel)).join(' '),
        'linear', o.linear.map(m => m.id + '=' + m.sel + m.k).join(' '));
    }
  } else process.stdout.write(JSON.stringify(out));
}
module.exports = { generate, load, PREFIX, UI_VARS, NEVER_RESTORE };
