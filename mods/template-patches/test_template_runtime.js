// Behaviour test for template.js against a small mock of the game runtime.
// The mocks mirror the name screen helpers template.js calls (same typing and
// snapshot rules), and the list functions mirror the game's: they read a
// 1-based selector, look the ID up in a *_Temp window and write the ID.
// Usage: node test_template_runtime.js <template.js>
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const eq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);

class Arr {
  constructor(rows) {
    this.load(rows);
  }
  load(rows) {
    this.rows = rows.map((r) => r.slice());
  }
  getSize() {
    return [this.rows.length, this.rows.reduce((m, r) => Math.max(m, r.length), 0), 1];
  }
  getAt(x, y) {
    const r = this.rows[x];
    return r && y < r.length ? r[y] : 0;
  }
}
class Arr3 {
  constructor(w, h, d) {
    this.w = w;
    this.h = h;
    this.d = d;
    this.cells = new Map();
  }
  getSize() {
    return [this.w, this.h, this.d];
  }
  getAt(x, y, z) {
    return this.cells.has(x + "," + y + "," + z) ? this.cells.get(x + "," + y + "," + z) : 0;
  }
  setAt(v, x, y, z) {
    this.cells.set(x + "," + y + "," + z, v);
  }
}

const MAP = {
  SMARTPHONE: {
    arr: "ArraySmartphones",
    groups: [
      {
        fn: "Page6",
        ui: [["MiniPage", 3]],
        maps: [
          { id: "RAM_ID", temp: "ArrayRAM_Temp", col: 1, sel: "RAM", when: [], drive: true },
          { id: "RAMTypeID", temp: "ArrayRAMType_Temp", col: 1, sel: "RAMType", when: [], drive: true },
        ],
        free: [],
        writes: ["RAM_ID", "RAMTypeID", "RAM_Text"],
      },
      {
        fn: "Page7",
        ui: [["MiniPage", 1]],
        maps: [
          {
            id: "OperationSystemID",
            temp: "ArrayOperationSystemVersion_Temp",
            col: 1,
            sel: "OperationSystemVersion",
            when: [{ or: false, c: [["OperationSystem", 1, 0]], opaque: false }],
            drive: true,
          },
        ],
        free: [{ sel: "OperationSystem", temp: "ArrayOperationSystem_Temp", own: "ArrayMyOS_Smartphones" }],
        writes: ["OperationSystem_Text", "OperationSystemVersion_Text", "OperationSystemID"],
      },
    ],
    linear: [{ id: "Graphic2D_ID", sel: "Graphic2D", k: -1 }],
    touch: ["RAM", "RAM_ID", "RAMType", "RAMTypeID", "RAM_Text", "OperationSystem", "OperationSystemVersion",
      "OperationSystemID", "OperationSystem_Text", "OperationSystemVersion_Text"],
  },
};
const OS_VERSIONS = { 1: [100, 101], 2: [200, 201, 202] };

function world() {
  const gv = {
    DeviceName: "Draft", MiniPage: 7, CameraSelected: 2, SubPage: 0, SubPageMax: 0, class: "SMARTPHONE NAME",
    LastClass: "SMARTPHONE PAGE 9", RAM: 3, RAM_ID: 4, RAM_Text: "", RAMType: 1, RAMTypeID: 10, Thickness: 9,
    OperationSystem: 1, OperationSystemVersion: 1, OperationSystemID: 100, OperationSystem_Text: "",
    OperationSystemVersion_Text: "", Graphic2D: 1, Graphic2D_ID: 0, Money: 5000, DevicePrice: 0,
    SmartphoneWidth: 1, RoundedEdges: "OFF",
  };
  for (let i = 1; i <= 5; i++) {
    gv["Red" + i] = 255;
    gv["Green" + i] = 255;
    gv["Blue" + i] = 255;
  }
  const dev = new Arr3(4, 3, 16);
  const arrays = {
    ArraySmartphones: dev,
    ArrayRAM_Temp: new Arr([["2GB", 2], ["3GB", 3], ["4GB", 4]]),
    ArrayRAMType_Temp: new Arr([["LP4", 10], ["LP5", 11]]),
    ArrayOperationSystem_Temp: new Arr([["Droid", 1], ["Fruit", 2]]),
    ArrayOperationSystemVersion_Temp: new Arr([]),
    ArrayMyOS_Smartphones: new Arr([[0]]),
    ArrayDesign_Choosen: new Arr([[1, 2]]),
  };
  const calls = [];
  const fns = {
    Page6() {
      const r = arrays.ArrayRAM_Temp, t = arrays.ArrayRAMType_Temp;
      gv.RAM = Math.min(Math.max(gv.RAM, 1), r.rows.length);
      gv.RAM_ID = r.getAt(gv.RAM - 1, 1);
      gv.RAM_Text = r.getAt(gv.RAM - 1, 0);
      gv.RAMType = Math.min(Math.max(gv.RAMType, 1), t.rows.length);
      gv.RAMTypeID = t.getAt(gv.RAMType - 1, 1);
    },
    Page7() {
      if (gv.OperationSystem === 0) {
        gv.OperationSystem_Text = "";
        gv.OperationSystemID = 900;
        return;
      }
      const vs = OS_VERSIONS[gv.OperationSystem] || [];
      arrays.ArrayOperationSystemVersion_Temp.load(vs.map((v) => ["v" + v, v]));
      gv.OperationSystemVersion = Math.min(Math.max(gv.OperationSystemVersion, 1), vs.length);
      gv.OperationSystem_Text = arrays.ArrayOperationSystem_Temp.getAt(gv.OperationSystem - 1, 0);
      gv.OperationSystemID = vs[gv.OperationSystemVersion - 1];
    },
  };
  const rt = {
    globalVars: gv,
    objects: Object.fromEntries(Object.entries(arrays).map(([k, a]) => [k, { getFirstInstance: () => a }])),
    callFunction(name) {
      calls.push(name);
      return fns[name]();
    },
  };
  return { gv, dev, arrays, fns, rt, calls };
}

function context(w) {
  const ctx = {
    console, setTimeout, clearTimeout, Set, Map, JSON, Math, Number, String, Object, Array, Error, Infinity,
    _busy2: false,
    _pushed: false,
    _TIERS: [{ key: "bronze", textKey: "tierBudget" }, { key: "silver", textKey: "tierStandard" }, { key: "gold", textKey: "tierFlagship" }],
    _RESTORE_MAP: {
      SMARTPHONE: {
        arr: "ArraySmartphones",
        gv: { 8: "DeviceName", 9: "RAM_ID", 10: "RAMTypeID", 11: "OperationSystemID", 12: "Thickness", 13: "DevicePrice", 15: "Graphic2D_ID" },
        json: { 14: "ArrayDesign_Choosen" },
      },
    },
    _DESIGN_MAP: {
      SMARTPHONE: {
        arr: "ArrayDesign_Choosen",
        gv: { 0: "SmartphoneWidth" },
        on: { 1: ["RoundedEdges", { 0: "OFF", 1: "ON" }] },
      },
    },
    _SNAP_DENY: new Set(["Money"]),
    _rt63: () => w.rt,
    _getArray24(n) {
      const o = w.rt.objects[n];
      const a = o && o.getFirstInstance();
      return a && "function" == typeof a.getAt ? a : null;
    },
    _arrSize3: (a) => a.getSize(),
    _setGvTyped(n, v) {
      if ("number" == typeof w.gv[n]) {
        const o = Number(v);
        w.gv[n] = Number.isFinite(o) ? o : 0;
      } else w.gv[n] = null == v ? "" : String(v);
      return true;
    },
    _loadArrayFromJson(n, j) {
      const o = "string" == typeof j ? JSON.parse(j) : j;
      if (!o || !Array.isArray(o.data)) return false;
      w.arrays[n].load(o.data.map((r) => r.map((c) => (Array.isArray(c) ? c[0] : c))));
      return true;
    },
    _designCells(j) {
      const o = "string" == typeof j ? JSON.parse(j) : j;
      if (!o || !Array.isArray(o.data) || !o.data[0]) return null;
      return o.data[0].map((c) => (Array.isArray(c) ? c[0] : c));
    },
    _snapshotEditorState() {
      const g = {};
      for (const [k, v] of Object.entries(w.gv)) ctx._SNAP_DENY.has(k) || (g[k] = v);
      return { gv: g, arrays: { ArrayDesign_Choosen: JSON.stringify({ data: w.arrays.ArrayDesign_Choosen.rows.map((r) => r.map((c) => [c])) }) } };
    },
    _applyEditorState(s) {
      for (const [k, v] of Object.entries(s.gv)) ctx._setGvTyped(k, v);
      for (const [k, v] of Object.entries(s.arrays || {})) ctx._loadArrayFromJson(k, v);
      return { ok: true };
    },
    _t24: (k) => ({ tierBudget: "Budget", tierStandard: "Standard", tierFlagship: "Flagship" })[k] || k,
    _isRu2: () => false,
    _deviceKey2: () => "SMARTPHONE",
    _creatingNow: () => 1,
    _batchPushed: () => ctx._pushed,
  };
  vm.createContext(ctx);
  const src = fs.readFileSync(process.argv[2], "utf8").replace("__DT_TPL_MAP__", JSON.stringify(MAP));
  vm.runInContext(src, ctx);
  return ctx;
}

function saveDevice(w, x, y, name, fields) {
  w.dev.setAt(name, x, y, 8);
  const z = { RAM_ID: 9, RAMTypeID: 10, OperationSystemID: 11, Thickness: 12, DevicePrice: 13, design: 14, Graphic2D_ID: 15 };
  for (const [k, v] of Object.entries(fields)) w.dev.setAt(v, x, y, z[k]);
}
const design = JSON.stringify({ data: [[[7], [8], [9]]] });

// 1. Exact IDs, a part that fell off the list, a vendor found by search.
{
  const w = world(), c = context(w);
  saveDevice(w, 0, 0, "Phone A", { RAM_ID: 1, RAMTypeID: 11, OperationSystemID: 201, Thickness: 6, DevicePrice: 999, design, Graphic2D_ID: 3 });
  const r = c._dtTplApply("SMARTPHONE", 0, 0);
  assert.equal(r.ok, true);
  assert.equal(w.gv.RAM, 1, "1GB fell off, so the next one up (2GB) is selected");
  assert.equal(w.gv.RAM_ID, 2);
  assert.equal(w.gv.RAM_Text, "2GB", "derived text follows the selector");
  assert.equal(w.gv.RAMType, 2);
  assert.equal(w.gv.RAMTypeID, 11);
  assert.equal(w.gv.OperationSystem, 2, "vendor found from the saved OS version");
  assert.equal(w.gv.OperationSystemVersion, 2);
  assert.equal(w.gv.OperationSystemID, 201);
  assert.equal(w.gv.Thickness, 6, "plain saved fields copied");
  assert.equal(w.gv.Graphic2D, 4, "linear selector = id - k");
  assert.equal(w.gv.DeviceName, "Draft", "name never copied");
  assert.equal(w.gv.DevicePrice, 0, "price never copied");
  assert.equal(w.gv.MiniPage, 7, "editor page restored after solving");
  assert.equal(w.gv.CameraSelected, 2);
  assert.deepEqual(w.arrays.ArrayDesign_Choosen.rows, [[7, 8, 9]], "saved design array loaded");
  eq(r.swapped, ["RAM_ID"]);
  eq(r.adjusted, []);
  eq(r.missing, []);
  const msg = c._dtTplMessage("Phone A", r);
  assert.equal(msg, "Copied from Phone A. 1 part is no longer sold, so the closest available one was used: RAM.");
  assert.ok(!/—/.test(msg), "no em dashes in copy");
}

// 2. Saved ID above every available one falls back to the closest below.
{
  const w = world(), c = context(w);
  saveDevice(w, 0, 0, "Phone B", { RAM_ID: 9, RAMTypeID: 10, OperationSystemID: 100 });
  const r = c._dtTplApply("SMARTPHONE", 0, 0);
  assert.equal(r.ok, true);
  assert.equal(w.gv.RAM_ID, 4);
  assert.equal(w.gv.OperationSystem, 1);
  assert.equal(w.gv.OperationSystemID, 100);
  eq(r.swapped, ["RAM_ID"]);
  assert.equal(c._dtTplMessage("Phone B", r),
    "Copied from Phone B. 1 part is no longer sold, so the closest available one was used: RAM.");
}

// 3. Own OS is only chosen when the company actually has one.
{
  const w = world(), c = context(w);
  w.arrays.ArrayMyOS_Smartphones.load([[3]]);
  saveDevice(w, 0, 0, "Phone C", { RAM_ID: 3, RAMTypeID: 10, OperationSystemID: 900 });
  assert.equal(c._dtTplApply("SMARTPHONE", 0, 0).ok, true);
  assert.equal(w.gv.OperationSystem, 0, "own OS selected");
  assert.equal(w.gv.OperationSystemID, 900);
  const w2 = world(), c2 = context(w2);
  saveDevice(w2, 0, 0, "Phone C", { RAM_ID: 3, RAMTypeID: 10, OperationSystemID: 900 });
  const r2 = c2._dtTplApply("SMARTPHONE", 0, 0);
  assert.equal(r2.ok, true);
  assert.ok(w2.gv.OperationSystem >= 1, "no own OS, so a real vendor stays selected");
  assert.ok([100, 101, 200, 201, 202].includes(w2.gv.OperationSystemID));
  assert.ok(r2.swapped.includes("OperationSystemID"), "reported, not silently changed");
  assert.equal(w2.gv.OperationSystem, 1, "vendor left as the editor had it");
  assert.equal(w2.gv.OperationSystemID, 101, "newest version of that vendor");
}

// 4. Any failure puts the editor back exactly as it was.
for (const fail of ["throw", "async"]) {
  const w = world(), c = context(w);
  saveDevice(w, 0, 0, "Phone D", { RAM_ID: 3, RAMTypeID: 11, OperationSystemID: 201, Thickness: 1 });
  const before = JSON.stringify(w.gv), arr = JSON.stringify(w.arrays.ArrayDesign_Choosen.rows);
  w.fns.Page7 = fail === "throw" ? () => { throw new Error("boom"); } : () => Promise.resolve();
  const warn = console.warn;
  console.warn = () => {};
  const r = c._dtTplApply("SMARTPHONE", 0, 0);
  console.warn = warn;
  assert.equal(r.ok, false, fail);
  assert.equal(JSON.stringify(w.gv), before, fail + ": globals restored");
  assert.equal(JSON.stringify(w.arrays.ArrayDesign_Choosen.rows), arr, fail + ": arrays restored");
}

// 5. Choosing, switching and going back to "New design" only reverts what a
// copy can touch; unrelated progress made meanwhile is kept.
{
  const w = world(), c = context(w);
  saveDevice(w, 0, 0, "Phone E", { RAM_ID: 2, RAMTypeID: 11, OperationSystemID: 101, Thickness: 4 });
  saveDevice(w, 1, 0, "Phone F", { RAM_ID: 4, RAMTypeID: 10, OperationSystemID: 202, Thickness: 5 });
  const start = { ...w.gv };
  const sel = { value: "0:0" }, note = {};
  c._dtTplChoose(sel, note, "SMARTPHONE");
  assert.equal(w.gv.Thickness, 4);
  assert.equal(note.textContent, "Copied from Phone E.");
  w.gv.Money = 1234;
  sel.value = "1:0";
  c._dtTplChoose(sel, note, "SMARTPHONE");
  assert.equal(w.gv.RAM_ID, 4);
  assert.equal(w.gv.OperationSystemID, 202);
  sel.value = "";
  c._dtTplChoose(sel, note, "SMARTPHONE");
  assert.equal(note.textContent, "Back to a new design.");
  for (const k of ["RAM", "RAM_ID", "RAMType", "RAMTypeID", "Thickness", "OperationSystem", "OperationSystemVersion", "OperationSystemID", "MiniPage", "Graphic2D"])
    assert.equal(w.gv[k], start[k], k + " back to the new-design value");
  assert.equal(w.gv.Money, 1234, "unrelated state not rolled back");
  // Busy screen ignores input and keeps the shown choice.
  c._busy2 = true;
  sel.value = "0:0";
  c._dtTplChoose(sel, note, "SMARTPHONE");
  assert.equal(sel.value, "");
  assert.equal(w.gv.Thickness, start.Thickness);
  c._busy2 = false;
  // A failed copy reports it and leaves the select on New design.
  w.fns.Page6 = () => { throw new Error("boom"); };
  const warn = console.warn;
  console.warn = () => {};
  sel.value = "1:0";
  c._dtTplChoose(sel, note, "SMARTPHONE");
  console.warn = warn;
  assert.equal(sel.value, "");
  assert.equal(note.textContent, "Could not copy Phone F. Nothing was changed.");
  assert.equal(w.gv.Thickness, start.Thickness);
}

// 6. Rows: newest first, junk names skipped, tiers labelled, current batch skipped.
{
  const w = world(), c = context(w);
  saveDevice(w, 0, 0, "Batch", {});
  saveDevice(w, 1, 0, "Pro", {});
  saveDevice(w, 1, 2, "Pro Max", {});
  saveDevice(w, 2, 0, "---", {});
  saveDevice(w, 3, 1, "Device Name", {});
  eq(c._dtTplRows("SMARTPHONE").map((r) => r.key + "=" + r.label), ["0:0=Batch", "1:0=Pro (Budget)", "1:2=Pro Max (Flagship)"]);
  c._pushed = true;
  eq(c._dtTplRows("SMARTPHONE").map((r) => r.key + "@" + r.x), ["0:0@1", "0:2@1"]);
}

// 7. Labels shown in notices.
{
  const c = context(world());
  assert.equal(c._dtTplLabel("CameraMPX_3_ID"), "Camera MPX");
  assert.equal(c._dtTplLabel("OperationSystemID"), "Operation System");
  assert.equal(c._dtTplList(["A_ID", "B_ID", "C_ID", "D_ID", "E_ID", "F_ID"]), "A, B, C, D and 2 more");
}

// 8. Design cells are copied, including the five custom palette colours.
{
  const w = world(), c = context(w);
  const cells = new Array(128).fill(0);
  cells[0] = 55;
  cells[1] = 1;
  const palette = [[12, 34, 56], [1, 2, 3], [200, 201, 202], [7, 8, 9], [250, 251, 252]];
  for (let i = 0; i < 5; i++) cells[123 + i] = palette[i][0] + palette[i][1] * 256 + palette[i][2] * 65536;
  saveDevice(w, 0, 0, "Phone G", { RAM_ID: 3, RAMTypeID: 10, OperationSystemID: 100,
    design: JSON.stringify({ data: [cells.map((v) => [v])] }) });
  const r = c._dtTplApply("SMARTPHONE", 0, 0);
  assert.equal(r.ok, true);
  assert.equal(w.gv.SmartphoneWidth, 55, "design cell copied");
  assert.equal(w.gv.RoundedEdges, "ON", "design on-cell mapped");
  assert.deepEqual(w.arrays.ArrayDesign_Choosen.rows[0], cells, "design array loaded");
  const touch = c._dtTplTouch("SMARTPHONE");
  for (let i = 1; i <= 5; i++)
    for (const ch of ["Red", "Green", "Blue"]) assert.ok(touch.has(ch + i), ch + i + " is restored on New design");
  for (let i = 0; i < 5; i++) {
    assert.equal(w.gv["Red" + (i + 1)], palette[i][0], "palette red " + (i + 1));
    assert.equal(w.gv["Green" + (i + 1)], palette[i][1], "palette green " + (i + 1));
    assert.equal(w.gv["Blue" + (i + 1)], palette[i][2], "palette blue " + (i + 1));
  }
}

// 9. Russian notices use Russian part names, not internal English fields.
{
  const w = world(), c = context(w);
  c._isRu2 = () => true;
  saveDevice(w, 0, 0, "Телефон", { RAM_ID: 9, RAMTypeID: 10, OperationSystemID: 100 });
  const r = c._dtTplApply("SMARTPHONE", 0, 0);
  assert.equal(r.ok, true);
  assert.equal(c._dtTplMessage("Телефон", r),
    "Скопировано с Телефон. 1 деталь больше не продаётся, выбрана ближайшая доступная: Оперативная память.");
  assert.equal(c._dtTplMessage("Телефон", { swapped: [], adjusted: ["OperationSystemID"],
    missing: ["ProcessorID"], headphones: false, gamepad: false }),
    "Скопировано с Телефон. Подогнано: Операционная система. Недоступно: Процессор.");
}

// 10. Several replacements use plural, direction-neutral wording.
{
  const w = world(), c = context(w);
  saveDevice(w, 0, 0, "Phone H", { RAM_ID: 9, RAMTypeID: 10, OperationSystemID: 999 });
  const r = c._dtTplApply("SMARTPHONE", 0, 0);
  assert.equal(r.ok, true);
  eq(r.swapped, ["RAM_ID", "OperationSystemID"]);
  const msg = c._dtTplMessage("Phone H", r);
  assert.equal(msg,
    "Copied from Phone H. 2 parts are no longer sold, so the closest available ones were used: RAM, Operation System.");
  assert.ok(!/next one up/.test(msg), "no wrong direction");
}
// 10b. A picked template that disappears (or is renamed) before the name screen is shown
// again: the dropdown and the editor both go back to the design this version began with.
{
  const w = world(), c = context(w);
  saveDevice(w, 0, 0, "Gone", { RAM_ID: 3, RAMTypeID: 11, OperationSystemID: 201 });
  const start = JSON.parse(JSON.stringify(w.gv));
  const n = {};
  c._dtTplChoose({ value: "0:0" }, n, "SMARTPHONE");
  assert.notDeepStrictEqual(JSON.parse(JSON.stringify(w.gv)), start, "the copy changed the editor");
  assert.equal(c._dtTplForget("SMARTPHONE", c._dtTplRows("SMARTPHONE")), false, "still there: kept");
  saveDevice(w, 0, 0, "Renamed", { RAM_ID: 3, RAMTypeID: 11, OperationSystemID: 201 });
  assert.equal(c._dtTplForget("SMARTPHONE", c._dtTplRows("SMARTPHONE")), true);
  eq(JSON.parse(JSON.stringify(w.gv)), start, "editor back to the design it began with");
  const slot = c._dtTplSlot("SMARTPHONE");
  assert.equal(slot.choice, "");
  assert.equal(slot.note, "Back to a new design.");
}
// 11. Queued devices (queue patch hook): listed first by name (in the "In the build queue" group), and
// copying one gives the same editor as copying the device it would make.
{
  const vars = { DeviceName: "Phone Q", DevicePrice: 999, DeviceCostPrice: 500, RAM_ID: 3, RAMTypeID: 11,
    OperationSystemID: 201, Thickness: 6, Graphic2D_ID: 3, SmartphoneWidth: 1, RoundedEdges: "OFF", Extra: 5 };
  const dump = { w: 1, h: 3, d: 1, cells: [55, 1, 9] };
  const q = (over) => Object.assign({ key: "q:e1:0", k: 0, count: 1, name: "Phone Q", label: "Queued: Phone Q",
    vars: JSON.parse(JSON.stringify(vars)), arrays: { ArrayDesign_Choosen: JSON.parse(JSON.stringify(dump)) }, lost: [] }, over);
  // The device as AddToArray would write it.
  const w1 = world(), c1 = context(w1);
  saveDevice(w1, 0, 0, "Phone Q", { RAM_ID: 3, RAMTypeID: 11, OperationSystemID: 201, Thickness: 6, DevicePrice: 999,
    Graphic2D_ID: 3, design: JSON.stringify({ data: [[[55], [1], [9]]] }) });
  const n1 = {};
  c1._dtTplChoose({ value: "0:0" }, n1, "SMARTPHONE");
  // The same device still in the queue, next to an older saved phone.
  const w2 = world(), c2 = context(w2);
  saveDevice(w2, 0, 0, "Old", { RAM_ID: 2, RAMTypeID: 10, OperationSystemID: 100 });
  const start = { ...w2.gv };
  c2._dtQueueApi = {};
  c2._dtQueueApi.templates = (cat) => (cat === "SMARTPHONE" ? [q()] : []);
  eq(c2._dtTplRows("SMARTPHONE").map((r) => r.key + "=" + r.label), ["q:e1:0=Phone Q", "0:0=Old"]);
  eq(c2._dtTplRows("SMARTPHONE").map((r) => !!r.queued), [true, false]);
  const sel = { value: "q:e1:0" }, n2 = {};
  c2._dtTplChoose(sel, n2, "SMARTPHONE");
  assert.equal(n2.textContent, "Copied from Phone Q.");
  eq(w2.gv, JSON.parse(JSON.stringify(w1.gv)), "same editor values as the made device");
  eq(w2.arrays.ArrayDesign_Choosen.rows, [[55, 1, 9]]);
  assert.equal(w2.gv.SmartphoneWidth, 55, "design cells from the stored design array");
  assert.equal(w2.gv.RoundedEdges, "ON");
  assert.equal(w2.gv.DeviceName, "Draft", "name never copied");
  assert.equal(w2.gv.DevicePrice, 0, "price never copied");
  assert.ok(!("Extra" in w2.gv), "only the device's own fields");
  // The entry is removed (or replayed) later: the editor keeps its values and
  // New design still goes back.
  c2._dtQueueApi.templates = () => [];
  const kept = JSON.stringify(w2.gv);
  eq(c2._dtTplRows("SMARTPHONE").map((r) => r.key), ["0:0"]);
  assert.equal(JSON.stringify(w2.gv), kept);
  sel.value = "";
  c2._dtTplChoose(sel, n2, "SMARTPHONE");
  for (const k of ["RAM_ID", "RAMTypeID", "Thickness", "OperationSystemID", "SmartphoneWidth", "RoundedEdges"])
    assert.equal(w2.gv[k], start[k], k + " back to the new-design value");
  // A broken hook never hides the saved devices.
  c2._dtQueueApi.templates = () => { throw new Error("boom"); };
  const warn = console.warn;
  console.warn = () => {};
  eq(c2._dtTplRows("SMARTPHONE").map((r) => r.key), ["0:0"]);
  console.warn = warn;
}

// 12. Queued batches are labelled per version; a queued part listed nowhere is reported.
{
  const w = world(), c = context(w);
  c._dtQueueApi = {};
  const base = { arrays: {}, count: 2, vars: { RAM_ID: 3, RAMTypeID: 10, OperationSystemID: 100, Thickness: 2 } };
  c._dtQueueApi.templates = () => [
    Object.assign({ key: "q:d:0", k: 0, name: "Duo 1", label: "Queued: Duo 1", lost: [] }, base),
    Object.assign({ key: "q:d:1", k: 1, name: "Duo 2", label: "Queued: Duo 2", lost: ["ProcessorID"] }, base),
  ];
  eq(c._dtTplRows("SMARTPHONE").map((r) => r.label), ["Duo 1 (Budget)", "Duo 2 (Standard)"]);
  const note = {};
  c._dtTplChoose({ value: "q:d:1" }, note, "SMARTPHONE");
  assert.equal(w.gv.Thickness, 2);
  assert.equal(note.textContent, "Copied from Duo 2 (Standard). Not available: Processor.");
}

// 13. Extra side buttons: several design cells feed one type global. No
// buttons, or a kind switched off, must not turn into mechanical ones.
{
  const ON = { 34: ["CentralButton_AdditionallyButtonsType", { 0: "0", 1: "1", 2: "2" }],
    35: ["CentralButton_AdditionallyButtonsType", { 0: "2", 1: "1" }],
    37: ["CentralButton_AdditionallyButtonsType", { 0: "1", 1: "2" }] };
  const GV = { 36: "CentralButton_AdditionallyButtonsStyle", 38: "CentralButton_AdditionallyButtonsStyle_Left",
    39: "CentralButton_AdditionallyButtonsStyle_Right" };
  // Cells as the game saves each type (unwritten cells keep 1), then as the
  // editor saves a kind with its buttons switched off (draws nothing).
  const cases = [
    [{ 34: 0, 35: 0, 37: 0 }, 0, 1, 1, 1],
    [{ 34: 1, 35: 0, 37: 0 }, 0, 1, 1, 1],
    [{ 34: 2, 35: 0, 37: 0 }, 0, 1, 1, 1],
    [{ 34: 1, 35: 0, 37: 1 }, 0, 1, 1, 1],
    [{ 34: 1, 35: 1, 36: 3, 37: 0 }, 1, 3, 1, 1],
    [{ 34: 2, 35: 0, 37: 1, 38: 2, 39: 4 }, 2, 1, 2, 4],
  ];
  for (const [set, type, st, l, r] of cases) {
    const w = world(), c = context(w);
    Object.assign(w.gv, { CentralButton_AdditionallyButtonsType: 2, CentralButton_AdditionallyButtonsStyle: 5,
      CentralButton_AdditionallyButtonsStyle_Left: 5, CentralButton_AdditionallyButtonsStyle_Right: 5 });
    c._DESIGN_MAP.SMARTPHONE.gv = Object.assign({ 0: "SmartphoneWidth" }, GV);
    Object.assign(c._DESIGN_MAP.SMARTPHONE.on, ON);
    const cells = Array.from({ length: 40 }, (_, i) => (i in set ? set[i] : 1));
    const d = JSON.stringify({ data: [cells.map((v) => [v])] });
    saveDevice(w, 0, 0, "Buttons " + type, { RAM_ID: 3, RAMTypeID: 10, OperationSystemID: 100, Thickness: 6, design: d });
    assert.equal(c._dtTplApply("SMARTPHONE", 0, 0).ok, true);
    assert.equal(w.gv.CentralButton_AdditionallyButtonsType, type, "button type " + type + " copied as is");
    assert.equal(w.gv.CentralButton_AdditionallyButtonsStyle, st);
    assert.equal(w.gv.CentralButton_AdditionallyButtonsStyle_Left, l);
    assert.equal(w.gv.CentralButton_AdditionallyButtonsStyle_Right, r);
  }
}

// 14. The colour page rebuilds each palette colour from its picker position
// when it opens (the game's ChooseColor, mirrored below), so a copy must move
// the pickers too. A white phone used to come back 247,249,250 when the last
// design left the picker just off white.
{
  const unlerp = (a, b, x) => (x - a) / (b - a);
  // ChooseColor for slot i: hue bar 117..523, square 523..117 (S) and 505..175
  // (V, after the page offset), 1% and 1 degree steps, sectors 0-5 only.
  const chooseColor = (gv, off, i, stale) => {
    const h = Math.round(360 * unlerp(117, 523, gv["ColorLine" + i + "_X"])), k = Math.floor(h / 60), f = h / 60 - k;
    const S = Math.round(100 * unlerp(523, 117, gv["ColorCanvas" + i + "_X"])) / 100;
    const V = Math.round(100 * unlerp(505, 175, gv["ColorCanvas" + i + "_Y"] - off)) / 100;
    const p = V * (1 - S), q = V * (1 - S * f), t = V * (1 - (1 - f) * S);
    const c = [[V, t, p], [q, V, p], [p, V, t], [p, q, V], [t, p, V], [V, p, q]][k] || stale;
    return c.map((x) => Math.round(255 * x));
  };
  const palette = [[255, 255, 255], [255, 0, 0], [51, 194, 255], [255, 0, 98], [128, 128, 128]];
  const w = world(), c = context(w);
  for (let i = 1; i <= 5; i++) Object.assign(w.gv, { ["ColorCanvas" + i + "_X"]: 519, ["ColorCanvas" + i + "_Y"]: 181, ["ColorLine" + i + "_X"]: 340 });
  const before = JSON.stringify(w.gv);
  const cells = new Array(128).fill(0);
  for (let i = 0; i < 5; i++) cells[123 + i] = palette[i][0] + palette[i][1] * 256 + palette[i][2] * 65536;
  saveDevice(w, 0, 0, "White Phone", { RAM_ID: 3, RAMTypeID: 10, OperationSystemID: 100,
    design: JSON.stringify({ data: [cells.map((v) => [v])] }) });
  const sel = { value: "0:0" }, note = {};
  c._dtTplChoose(sel, note, "SMARTPHONE");
  assert.equal(note.textContent, "Copied from White Phone.");
  for (let i = 1; i <= 5; i++) {
    eq([w.gv["Red" + i], w.gv["Green" + i], w.gv["Blue" + i]], palette[i - 1], "palette " + i + " copied");
    eq(chooseColor(w.gv, 0, i, [0, 0, 0]), palette[i - 1], "colour page keeps palette " + i);
  }
  assert.ok(w.gv.ColorLine2_X < 523, "pure red uses hue 0, not 360 (no ChooseColor case)");
  assert.equal(w.gv.ColorLine1_X, 340.3, "a grey keeps the current hue bar position");
  // Laptop, watch and headphones pages read brightness 80/100 px lower.
  for (const [cat, off] of [["LAPTOP", 80], ["WATCHES", 100], ["HEADPHONES", 100], ["TV", 0]])
    for (const rgb of palette) {
      const g = { Red1: rgb[0], Green1: rgb[1], Blue1: rgb[2], ColorLine1_X: 200 };
      Object.assign(g, c._dtTplPickerFor((n) => g[n], cat, 1));
      eq(chooseColor(g, off, 1, [0, 0, 0]), rgb, cat + " colour page keeps " + rgb);
    }
  // "New design" puts the pickers back with the colours.
  const touch = c._dtTplTouch("SMARTPHONE");
  for (let i = 1; i <= 5; i++)
    for (const n of ["ColorCanvas" + i + "_X", "ColorCanvas" + i + "_Y", "ColorLine" + i + "_X"]) assert.ok(touch.has(n), n + " is restored on New design");
  sel.value = "";
  c._dtTplChoose(sel, note, "SMARTPHONE");
  const back = JSON.parse(before);
  for (const n of c._dtTplPaletteNames()) assert.equal(w.gv[n], back[n], n + " back to the draft's value");
}

console.log("template runtime: 14 scenarios passed");
