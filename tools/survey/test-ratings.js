// Tests for survey-ratings.js. Run: node tools/survey/test-ratings.js
const assert = require("assert");
const E = require("../../survey-edits.js"), G = require("../../survey-geometry.js"), R = require("../../survey-ratings.js");
const base = require("./local-data.js")("bonnie-castle");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
const EMPTY = () => ({ runs: {}, plan: [], landmarks: {}, runNames: {} });
const fresh = () => ({ green: E.copy(base), blue: EMPTY(), black: EMPTY(), "double-black": EMPTY(), squirrel: EMPTY() });
const all = src => G.compute(R.merge(R.ORDER.map(k => src[k])));
const pos = (geo) => JSON.stringify(geo.segments.map(s => [s.x0, s.y0, s.x1, s.y1].map(v => v.toFixed(6))).sort());
const before = all(fresh());
const opts = { runName: r => base.runNames[r] || r, origin: "BAR" };
const lineIdx = (run, nth) => { let k = 0; return base.runs[run].findIndex(e => /Line$/.test(e.type) && ++k === nth); };

t("rating a whole run moves it and the runs that start from it", () => {
  const src = fresh();
  const { moving } = R.rate(src, [{ run: "LisasGiftToBensT", index: 0, whole: true }], "black", opts);
  assert.ok(moving.has("LisasGiftToBensT") && moving.has("BensTToJoshsWreck") && moving.has("BensTNorthwest"));
  assert.ok(!src.green.runs.LisasGiftToBensT && src.black.runs.BensTToJoshsWreck);
  const after = all(src);
  assert.deepStrictEqual(after.warnings, []);
  assert.strictEqual(pos(after), pos(before), "every line stays where it was");
});

t("Kibbetts to Wreck 2 is fitted to Wreck 2, so it moves too", () => {
  const src = fresh();
  const { moving } = R.rate(src, [{ run: "LisasGiftToBensT", index: 0, whole: true }], "blue", opts);
  assert.ok(moving.has("KibbettsToWreck2"), "fit step ends at a landmark in a moved run");
  assert.strictEqual(pos(all(src)), pos(before));
});

t("rating from a line partway along splits the run", () => {
  const src = fresh();
  const i = lineIdx("BensTToJoshsWreck", 4);
  const { moving } = R.rate(src, [{ run: "BensTToJoshsWreck", index: i, whole: false }], "double-black", opts);
  assert.strictEqual(moving.size, 1);
  const nr = [...moving][0];
  assert.ok(src["double-black"].runs[nr] && src.green.runs.BensTToJoshsWreck);
  assert.strictEqual(src.green.runs.BensTToJoshsWreck.filter(e => /Line$/.test(e.type)).length, 3);
  const after = all(src);
  assert.deepStrictEqual(after.warnings, []);
  assert.strictEqual(pos(after), pos(before));
});

t("rating back to green puts a line back on the main survey; lines rated higher keep their rating", () => {
  const src = fresh();
  R.rate(src, [{ run: "LisasGiftToBensT", index: 0, whole: true }], "black", opts);
  R.rate(src, [{ run: "LisasGiftToBensT", index: 0, whole: true }], "green", opts);
  assert.ok(src.green.runs.LisasGiftToBensT && !src.black.runs.LisasGiftToBensT);
  assert.ok(src.black.runs.BensTNorthwest);
  assert.deepStrictEqual(all(src).warnings, []);
  assert.strictEqual(pos(all(src)), pos(before));
});

t("lines can't be rated green while they start from a black line", () => {
  const src = fresh();
  R.rate(src, [{ run: "LisasGiftToBensT", index: 0, whole: true }], "black", opts);
  assert.throws(() => R.rate(src, [{ run: "BensTNorthwest", index: 0, whole: true }], "green", opts), /nothing to start from/);
});

t("a run stretched to join up can only be rated whole", () => {
  const src = fresh();
  assert.throws(() => R.rate(src, [{ run: "KibbettsToWreck2", index: lineIdx("KibbettsToWreck2", 2), whole: false }], "blue", opts), /whole run/);
});

t("a higher-rated run that starts from a moved one stays where it is", () => {
  const src = fresh();
  R.rate(src, [{ run: "BensTToJoshsWreck", index: 0, whole: true }], "double-black", opts);
  const { moving } = R.rate(src, [{ run: "LisasGiftToBensT", index: 0, whole: true }], "blue", opts);
  assert.ok(!moving.has("BensTToJoshsWreck"));
  assert.ok(src["double-black"].runs.BensTToJoshsWreck);
  assert.strictEqual(pos(all(src)), pos(before));
});

t("Secret Squirrel rates like the other levels", () => {
  const src = fresh();
  const { moving } = R.rate(src, [{ run: "LisasGiftToBensT", index: 0, whole: true }], "squirrel", opts);
  assert.ok(moving.has("LisasGiftToBensT") && src.squirrel.runs.BensTToJoshsWreck && !src.green.runs.LisasGiftToBensT);
  assert.strictEqual(pos(all(src)), pos(before));
});

console.log(`${n} tests passed`);
