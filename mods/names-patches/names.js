/* Real names patch (DEVICES_TYCOON_NAMES): real company and brand names instead of the game's parody names.
 * The game shows every company, OS, CPU/GPU and chip maker name through one static table, ArrayCompanyNames
 * (loaded from ArrayCompanyNames.json at boot). When that table loads, each cell that is exactly a
 * parody name becomes the real one ("Nokya" -> "Nokia"), so rankings, pickers, investing, awards and new news
 * read real names. The game's company names screen saves the table to Settings.dt and loads it back at boot:
 * the file keeps the game's own names (so the plain game is unchanged after uninstall) and the swap is put
 * back after the load. Three English help texts get the same swap. Saved text (old news lines, the OS label stored
 * in old devices, the player's own company/OS/device names) is never changed.
 * globalThis._dtRealName(name) gives the real name for the rivals mod: an exact parody name, or a rival model
 * name with parody parts ("Orchard 15 Pro" -> "iPhone 15 Pro"); anything else comes back unchanged. */
(function () {
  var N = _DT_NAMES, all = Object.create(null), k;
  for (k in N.companies) all[k] = N.companies[k];
  for (k in N.lines) all[k] = N.lines[k];
  var keys = Object.keys(all).sort(function (a, b) { return b.length - a.length; });
  // A stem ending in a 1-2 character code ("Stellar S", "Blaze HD") takes its number with no space
  // ("Stellar S6", "Blaze HD1"), the same rule as the rivals mod's _dtRivName.
  var re = new RegExp("(^|[^A-Za-z0-9])(" + keys.map(function (s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (/\s[A-Z0-9]{1,2}$/.test(s) ? "(?![A-Za-z])" : "(?![A-Za-z0-9])");
  }).join("|") + ")", "g");

  function realName(name) {
    if (typeof name !== "string" || !name) return name;
    if (all[name] !== undefined) return all[name];
    return name.replace(re, function (m, pre, word) { return pre + all[word]; });
  }

  function objectName(inst) {
    try {
      var oc = inst._objectClass || (inst.GetObjectClass && inst.GetObjectClass());
      return oc && oc.GetName ? oc.GetName() : "";
    } catch (e) { return ""; }
  }

  // The game's own name of each company row (x), from its table.
  var own = [];

  // ArrayCompanyNames: x = company id, y 0/1 = name (both the same in the game's table).
  function fixCompanies(arr) {
    var done = 0, seen = Object.create(null);
    for (var x = 0; x < arr.length; x++) {
      for (var y = 0; y < 2 && y < arr[x].length; y++) {
        var v = arr[x][y][0];
        if (typeof v === "string" && N.companies[v] !== undefined) {
          if (y === 0 || own[x] === undefined) own[x] = v;
          arr[x][y][0] = N.companies[v]; seen[v] = 1; done++;
        }
      }
    }
    var missing = Object.keys(N.companies).filter(function (n) { return !seen[n]; });
    if (missing.length) console.error("[names] ArrayCompanyNames changed; not found: " + missing.slice(0, 12).join(", "));
    return done;
  }

  // ArrayLanguage: x 0 = English. Only the listed rows, only when they still hold the parody name.
  function fixLanguage(arr) {
    var done = 0;
    N.language.forEach(function (t) {
      var cell = arr[0] && arr[0][t.row];
      var v = cell && cell[0];
      if (typeof v === "string" && v.indexOf(t.from) >= 0) {
        cell[0] = v.split(t.from).join(t.to); done++;
      } else if (!(typeof v === "string" && v.indexOf(t.to) >= 0)) {
        console.error("[names] ArrayLanguage row " + t.row + " no longer names " + t.from);
      }
    });
    return done;
  }

  globalThis._dtNamesLoaded = function (inst) {
    var arr = inst && inst._arr;
    if (!Array.isArray(arr)) return 0;
    var name = objectName(inst);
    if (name === "ArrayCompanyNames") return fixCompanies(arr);
    if (name === "ArrayLanguage") return fixLanguage(arr);
    return 0;
  };
  globalThis._dtRealName = realName;

  // Settings.dt (the game's file save/load): a saved copy of the table holds the game's own name where a
  // cell still shows our swap (the player's own edits stay), and a loaded copy gets the swap back.
  globalThis._dtNamesSaving = function (name, snap) {
    if (name !== "ArrayCompanyNames" || !snap || !Array.isArray(snap.cells)) return;
    snap.cells.forEach(function (col, x) {
      var p = own[x], r = p && N.companies[p];
      for (var y = 0; r && Array.isArray(col) && y < 2 && y < col.length; y++) if (col[y] && col[y][0] === r) col[y][0] = p;
    });
  };
  globalThis._dtNamesRestored = function (name) {
    if (name !== "ArrayCompanyNames") return;
    var a = null;
    try { a = globalThis.runtime.objects.ArrayCompanyNames.getFirstInstance(); } catch (e) {}
    if (!a) return;
    own.forEach(function (p, x) {
      for (var y = 0; y < 2; y++) if (a.getAt(x, y, 0) === p) a.setAt(N.companies[p], x, y, 0);
    });
  };
})();
