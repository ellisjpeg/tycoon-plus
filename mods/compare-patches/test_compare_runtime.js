// Runtime test for compare.js with a fake Construct runtime: node test_compare_runtime.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");

// ── Fake game: two phone lines (Ember 6 + Pro, Ember 5), one tablet line. ──
// Rows are [x][y][z]; z7 RELEASE, z8 NAME, z9 date text, z10 ID.
function devArray(lines) {
  return {
    get width() { return lines.length; }, height: 3, depth: 12,
    getAt: (x, y, z) => { const v = lines[x] && lines[x][y]; return v ? v[z] : z === 7 ? -1 : 0; },
  };
}
const row = (name, rel, date, id) => { const r = []; r[7] = rel; r[8] = name; r[9] = date; r[10] = id; return r; };
const phones = devArray([
  [row("Ember 6", 2700, "06.07.2013", 6), row("Ember 6 Pro", 2700, "06.07.2013", 7)],
  [row("Ember 5", 2300, "03.08.2012", 5)],
]);
const tablets = devArray([[row("Slate 1", -1, "", 9)]]);
const empty = devArray([]);
const temp = {
  rows: [], get width() { return this.rows.length; }, get height() { return 2; }, depth: 1,
  getAt(x, y) { return this.rows[x][y]; },
  setAt(v, x, y) { this.rows[x][y] = v; },
  setSize(w) { this.rows.length = w; for (let i = 0; i < w; i++) this.rows[i] = this.rows[i] || ["", ""]; },
};
const design = { cells: [1, 2, 3], width: 1, height: 3, depth: 1, getAt(x, y) { return this.cells[y]; }, setAt(v, x, y) { this.cells[y] = v; }, setSize() {} };
// The game's pages for each device: My<Type>Show fills the temp array for $MiniPage.
const PAGES = {
  "SMARTPHONE:0:0": [[["Copies Created", "10"], ["Copies Sold", "56 043 771 "], ["Cost Price", "$277"], ["Sell Price", "$349"], ["Release Date", "06.07.2013"]],
    [["CPU", "Quartz Q4"], ["RAM", "3 GB[opacity=65]•[/opacity]LPDDR3"], ["Battery", "2600 mAh"], ["", ""], ["Additional Features", ""], ["", "Dust and Water Protection[opacity=65]IP68[/opacity]"], ["", "Wireless Charging"]]],
  "SMARTPHONE:1:0": [[["Copies Created", "20"], ["Copies Sold", "87 589 585 "], ["Cost Price", "$333"], ["Sell Price", "$449"], ["Release Date", "03.08.2012"]],
    [["CPU", "Quartz Q3"], ["RAM", "2 GB[opacity=65]•[/opacity]LPDDR2"], ["Battery", "1800 mAh"], ["", ""], ["Additional Features", ""], ["", "Dust and Water Protection[opacity=65]IP57[/opacity]"]]],
  "TABLET:0:0": [[["Copies Created", "0"], ["Copies Sold", "0 "]], [["Display Resolution", "QHD (2560×1440)"]], [["CPU", "Quartz Q4"], ["RAM", "4 GB"], ["Battery", "7000 mAh"]]],
};
const calls = [];
const g = { SubPage: 1, MiniPage: 1, DeviceShowFlagmanID: 0, ProcessorID: 4, class: "MY SMARTPHONES", LanguageChoose: 0 };
const objects = {
  ArraySmartphones: { getFirstInstance: () => phones }, ArrayTablets: { getFirstInstance: () => tablets },
  ArrayLaptops: { getFirstInstance: () => empty }, ArrayMyDevices_Temp: { getFirstInstance: () => temp },
  ArrayEditorDesign_Smartphone: { getFirstInstance: () => design },
};
const rt = {
  globalVars: g, objects, layout: { name: "MY SMARTPHONES" },
  callFunction(name) {
    calls.push(name);
    const type = { MySmartphonesShow: "SMARTPHONE", MyTabletsShow: "TABLET" }[name];
    if (!type) return;
    if (g.SubPage === 9) throw new Error("broken tab");
    // Like the real Show: clobbers editor globals and the design array.
    g.ProcessorID = 99;
    design.cells[0] = 42;
    const pages = PAGES[type + ":" + (g.SubPage - 1) + ":" + g.DeviceShowFlagmanID] || [];
    const p = pages[g.MiniPage - 1];
    if (p) temp.rows = p.map((r) => r.slice());
  },
};
globalThis.runtime = rt;
const sandbox = `var _dtUi={isOpen:()=>false};var document=undefined;var console={warn:()=>0};`;
const body = fs.readFileSync(path.join(__dirname, "compare.js"), "utf8");
const api = new Function(sandbox + body + "\nreturn { L: _dtCmpLogic, list: _dtCmpList, pages: _dtCmpPages, types: _DT_CMP_TYPES };")();
const L = api.L;

// ── Difference text and rounding per unit ──
const c = (label, a, b) => L.compare(label, a, b);
assert.deepStrictEqual(c("RAM", "3 GB[opacity=65]•[/opacity]LPDDR3", "2 GB[opacity=65]•[/opacity]LPDDR2"), { side: "l", tone: "better", text: "+1 GB" });
assert.deepStrictEqual(c("Battery", "1800 mAh", "2600 mAh"), { side: "r", tone: "better", text: "+800 mAh" });
assert.strictEqual(c("RAM", "512 MB", "2 GB").text, "+1.5 GB");
assert.strictEqual(c("RAM", "2 GB", "768 MB").text, "+1.25 GB"); // mixed units convert
assert.strictEqual(c("Storage", "1 GB", "512 MB").text, "+512 MB");
assert.strictEqual(c("CPU Core Clock", "1000 MHz", "1.5 GHz").text, "+500 MHz");
assert.strictEqual(c("Popularity", "88%", "76%").text, "+12%");
assert.strictEqual(c("Copies Sold", "56 043 771 ", "87 589 585 ").text, "+31 545 814"); // game's space grouping
assert.strictEqual(c("GPU Compute Power", "17 GFLOPS", "26.5 GFLOPS").text, "+9.5 GFLOPS");
assert.strictEqual(c("Thickness", "7.9 mm", "8.2 mm").text, "0.3 mm thinner"); // float noise rounded away
assert.strictEqual(c("Camera Zoom", "x24", "x30").text, "+6");
assert.strictEqual(c("Warranty", "36 MONTH", "24 MONTH").text, "+12 months");
assert.strictEqual(c("Rating", 10, 9).text, "+1");
assert.strictEqual(c("Camera Slow Motion Resolution", "540p[opacity=65]•[/opacity]qHD", "480p[opacity=65]•[/opacity]SD").text, "+60p");
assert.strictEqual(c("Display Pixel Density", "326 ppi", "342 ppi").text, "+16 ppi");
assert.strictEqual(c("Display Resolution", "HD (720×1280)", "Full HD (1080×1920)").text, "+125% pixels");
assert.strictEqual(c("Camera Video Resolution", "1280×720 (HD)", "1920×1080 (Full HD)").side, "r");

// ── Better-side rule ──
assert.deepStrictEqual(c("Cost Price", "$277", "$333"), { side: "l", tone: "better", text: "$56 cheaper" });
assert.deepStrictEqual(c("CPU Process Technology", "40-nm", "28-nm"), { side: "r", tone: "better", text: "12 nm smaller" });
assert.deepStrictEqual(c("Sell Price", "$349", "$449"), { side: "r", tone: "neutral", text: "+$100" }); // neutral
assert.deepStrictEqual(c("Copies Created", "10", "20"), { side: "r", tone: "neutral", text: "+10" });
assert.deepStrictEqual(c("Release Date", "06.07.2013", "03.08.2012"), { side: "l", tone: "neutral", text: "Newer" });
assert.deepStrictEqual(c("Network", "3.75G (HSPA+)", "4G (LTE)"), { side: "r", tone: "better", text: "Newer" });
assert.deepStrictEqual(c("Bluetooth", "4.0", "4.2"), { side: "r", tone: "better", text: "Newer" });
assert.deepStrictEqual(c("Charger in Package", "[icon=CheckIcon]", "[icon=RejectIcon]"), { side: "l", tone: "better", text: "Has it" });
assert.deepStrictEqual(c("OS", "eOS 1.3", "eOS 2.0"), { side: "", tone: "differ", text: "" }); // text: highlight only
assert.deepStrictEqual(c("Display Protection", "Gorilla Glass 2", "Gorilla Glass 2"), { side: "", tone: "", text: "" });
assert.deepStrictEqual(c("Speakers Chip", "Sirrus Logic CS51 x8", "Sirrus Logic CS52 x8").tone, "differ");
assert.deepStrictEqual(c("RAM", "2 GB[opacity=65]•[/opacity]LPDDR2", "2 GB[opacity=65]•[/opacity]LPDDR3").tone, "differ"); // equal size, other type
assert.deepStrictEqual(c("Battery", "2600 mAh", "2600 mAh"), { side: "", tone: "", text: "" }); // equal: no badge
assert.deepStrictEqual(c("Display HDR", "---", "HDR10").tone, "differ");
// Review cases: equal amounts in other units, port counts, ranges, named percentages, degrees, decimals.
assert.deepStrictEqual(c("RAM", "1024 MB", "1 GB"), { side: "", tone: "", text: "" });
assert.deepStrictEqual(c("CPU Core Clock", "1000 MHz", "1 GHz"), { side: "", tone: "", text: "" });
assert.strictEqual(c("USB", "x2", "x1").text, "+1");
assert.deepStrictEqual(c("Frequency Range", "15-22000 Hz", "20-20000 Hz"), { side: "l", tone: "better", text: "Wider" });
assert.strictEqual(c("Frequency Range", "15-20000 Hz", "20-22000 Hz").tone, "differ");
assert.deepStrictEqual(c("Display Color Gamut", "NTSC 45%", "NTSC 72%"), { side: "r", tone: "better", text: "+27%" });
assert.strictEqual(c("Display Color Gamut", "NTSC 45%", "sRGB 99%").tone, "differ");
assert.strictEqual(c("Viewing Angle", "178°", "170°").text, "+8°");
assert.strictEqual(c("GPU Compute Power", "1.001 GFLOPS", "1.002 GFLOPS").text, "+0.001 GFLOPS");
assert.strictEqual(c("CPU Power Efficiency", "+25%", "+15%").text, "+10%");
// A row whose value is blank is a row, not a header, unless feature lines follow it.
const blank = L.merge([[["Copies Created", "10"], ["Release Date", ""]]], [[["Copies Created", "20"], ["Release Date", "06.07.2013"]]]);
assert.deepStrictEqual(blank[0].rows.map((r) => [r.kind, r.label]), [["row", "Copies Created"], ["row", "Release Date"]]);
assert.strictEqual(L.parse("2D Graphics").kind, "text");
// Tab names for the first rows the real Show functions return (all 11 types checked in game).
assert.deepStrictEqual(["Copies Created", "Adjustable Suspension", "Brake System", "Keyboard Switches", "Supported Drive", "Data Encryption", "HDMI Cable in Package", "Case Battery"].map((l) => L.catName(l, 1)),
  ["Sales", "Suspension", "Brakes", "Switches", "Storage", "Security", "In the box", "Battery"]);
assert.strictEqual(L.parse("Quartz Q3").kind, "text");

// ── Picker order: same type first (newest first, editions in order), then hub order ──
const list = api.list("TABLET");
assert.deepStrictEqual(list.map((e) => e.name), ["Slate 1", "Ember 6", "Ember 6 Pro", "Ember 5"]);
const plist = api.list("SMARTPHONE");
assert.deepStrictEqual(plist.map((e) => e.name), ["Ember 6", "Ember 6 Pro", "Ember 5", "Slate 1"]);
assert.strictEqual(plist[3].released, false);
// Partner on open: same edition one model older, else next of that type, else previous.
assert.strictEqual(L.partner(plist, plist[0]).name, "Ember 5");
assert.strictEqual(L.partner(plist, plist[1]).name, "Ember 5"); // Pro has no older Pro: older line, base edition
assert.strictEqual(L.partner(plist, plist[2]).name, "Ember 6 Pro");
assert.strictEqual(L.partner(list, list[0]).name, "Ember 6"); // only tablet: falls through to the next device

// ── Pages come from the game's Show function, and everything it touched is put back ──
temp.rows = [["Copies Created", "123"]]; // what the player's screen shows
const pages = api.pages(plist[0]);
assert.deepStrictEqual(temp.rows, [["Copies Created", "123"]]); // the table's own array is back too
assert.strictEqual(pages.length, 2);
assert.deepStrictEqual(pages[1][1], ["RAM", "3 GB[opacity=65]•[/opacity]LPDDR3"]);
assert.deepStrictEqual([g.SubPage, g.MiniPage, g.DeviceShowFlagmanID, g.ProcessorID, design.cells[0]], [1, 1, 0, 4, 1]);
const tp = api.pages(list[0]);
assert.strictEqual(tp.length, 3);
assert.ok(calls.includes("MyTabletsShow")); // another type's rows, read from the phone screen
// A Show that throws is not cached: the next read tries again.
const broken = { type: "SMARTPHONE", x: 8, y: 0, id: 99, name: "Broken" };
const n0 = calls.length;
assert.deepStrictEqual(api.pages(broken), []);
api.pages(broken);
assert.strictEqual(calls.length - n0, 2);
assert.strictEqual(g.SubPage, 1);

// ── Merge: sections by tab, rows matched by label, features by name ──
const secs = L.merge(api.pages(plist[0]), api.pages(plist[2]));
assert.deepStrictEqual(secs.map((s) => s.name), ["Sales", "Performance"]);
const perf = secs[1].rows;
const feat = perf.filter((r) => r.kind === "item");
assert.deepStrictEqual(feat.map((r) => [r.label, r.l, r.r]), [
  ["Dust and Water Protection", "[opacity=65]IP68[/opacity]", "[opacity=65]IP57[/opacity]"],
  ["Wireless Charging", "[icon=CheckIcon]", "[icon=RejectIcon]"],
]);
assert.deepStrictEqual(feat[1].cmp, { side: "l", tone: "better", text: "Has it" });
assert.strictEqual(feat[0].cmp.tone, "differ");
assert.strictEqual(perf.find((r) => r.label === "Battery").cmp.text, "+800 mAh");
// Phone vs tablet: shared rows line up, the rest show on one side only.
const pt = L.merge(api.pages(plist[0]), tp);
assert.deepStrictEqual(pt.map((s) => s.name), ["Sales", "Performance", "Display"]);
const ram = pt[1].rows.find((r) => r.label === "RAM");
assert.deepStrictEqual([ram.l.slice(0, 4), ram.r, ram.cmp.text, ram.cmp.side], ["3 GB", "4 GB", "+1 GB", "r"]);
assert.strictEqual(pt[0].rows.find((r) => r.label === "Cost Price").r, null);
// A device with itself: nothing differs.
const self = L.merge(api.pages(plist[0]), api.pages(plist[0]));
assert.ok(self.every((s) => s.rows.every((r) => !r.cmp || !r.cmp.tone)));

// Russian game: rows carry their English twin; sides, keys and section names
// follow the English, the screen keeps the Russian words.
const ruA = [[["Создано копий", "10", "Copies Created", "10"], ["Себестоимость", "$98", "Cost Price", "$98"], ["", "Защита[opacity=65]IP57[/opacity]", "", "Protection[opacity=65]IP57[/opacity]"]]];
const ruB = [[["Создано копий", "20", "Copies Created", "20"], ["Себестоимость", "$121", "Cost Price", "$121"]]];
const ru = L.merge(ruA, ruB);
assert.equal(ru[0].name, "Sales");
const cost = ru[0].rows.find((r) => r.label === "Себестоимость");
assert.equal(cost.cmp.side, "l");
assert.equal(cost.cmp.tone, "better");
const prot = ru[0].rows.find((r) => r.kind === "item");
assert.equal(prot.label, "Защита");
assert.equal(prot.cmp.text, "Has it");

// Russian page: month differences read in Russian too.
{
  let ruOn = true;
  const fake = () => ({ children: [], innerHTML: "", title: "", isConnected: false, addEventListener() {}, appendChild(c) { this.children.push(c); return c; }, remove() {} });
  const ui = `var _dtUi={isOpen:()=>false,ru:()=>globalThis.__cmpRu,el:(t,c,parent,text)=>{const e=globalThis.__cmpFake();if(parent)parent.appendChild(e);return e;}};var document=undefined;var console={warn:()=>0};`;
  globalThis.__cmpFake = fake;
  globalThis.__cmpRu = ruOn;
  const R = new Function(ui + body + "\nreturn { T: _dtCmpT, render: _dtCmpRender, list: _dtCmpList };")();
  assert.strictEqual(R.T("+12 months"), "+12 месяцев");
  assert.strictEqual(R.T("+1 month"), "+1 месяц");
  assert.strictEqual(R.T("+3 months"), "+3 месяца");
  assert.strictEqual(R.T("6 months cheaper"), "6 месяцев дешевле");
  assert.strictEqual(R.T("+22 months"), "+22 месяца");
  assert.strictEqual(R.T("+11 months"), "+11 месяцев");
  globalThis.__cmpRu = false;
  assert.strictEqual(R.T("+12 months"), "+12 months");
  // One device only: both sides are that device, and the page says so instead of a table with no differences.
  const lst = R.list();
  const st = { sides: [lst[0], lst[0]], list: lst, top: fake(), scroll: { innerHTML: "", scrollTop: 0 }, diffOnly: false, menu: null };
  R.render(st);
  assert.ok(st.scroll.innerHTML.includes("Both sides show the same device."), "same-device notice shown");
  assert.ok(!st.scroll.innerHTML.includes("dt-cmp-table"), "no all-equal table");
  st.sides = [lst[0], lst[1]];
  R.render(st);
  assert.ok(st.scroll.innerHTML.includes("dt-cmp-table") && !st.scroll.innerHTML.includes("Both sides"), "two devices: the table");
}

// A load or New Game forgets the pictures: device ids restart in every save.
{
  const C = new Function(sandbox + body + "\nreturn { st: _dtCmp, tick: _dtCmpTick };")();
  C.st.imgs.set("SMARTPHONE:1:0", "data:old-save");
  C.st.noimg.add("SMARTPHONE:2:0");
  const was = rt.layout.name;
  rt.layout.name = "BOSS OFFICE";
  C.tick();
  assert.ok(C.st.imgs.has("SMARTPHONE:1:0"), "kept on other screens");
  rt.layout.name = "LOADING GAME";
  C.tick();
  rt.layout.name = was;
  assert.strictEqual(C.st.imgs.size, 0, "pictures cleared on LOADING GAME");
  assert.strictEqual(C.st.noimg.size, 0, "no-picture marks cleared on LOADING GAME");
}

console.log("compare runtime ok");
