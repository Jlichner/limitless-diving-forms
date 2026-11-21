// Tests for survey-edits.js. Run: node tools/survey/test-edits.js
const assert = require("assert");
const E = require("../../survey-edits.js"), G = require("../../survey-geometry.js");
const base = require("../../bonnie-castle-data.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
const geo0 = G.compute(base);
assert.deepStrictEqual(geo0.warnings, []);

t("apply leaves the original alone", () => {
  const before = JSON.stringify(base);
  E.apply(base, [{ op: "remove_run", run: "JJJ" }]);
  assert.strictEqual(JSON.stringify(base), before);
});

t("add a line from a stake", () => {
  const run = "UmbrellaToRockIsland", idx = base.runs[run].findIndex(e => e.type === "Stake");
  const r = E.apply(base, [
    { op: "name_point", run, index: idx, landmark: "P_TEST", name: "Test stake" },
    { op: "add_run", run: "RUN_TEST", name: "Test line", start: "P_TEST", landmarks: { LM_NEW: "New wreck" },
      entries: [{ type: "SurveyedLine", length_ft: 50, angle: 90 }, { type: "Stake" }, { type: "SurveyedLine", length_ft: 20, length_in: 6, angle: 180 },
                { type: "SaveLandmark", landmark: "LM_NEW", depth: 40 }] },
  ]);
  assert.strictEqual(r.error, null);
  const g = G.compute(r.data);
  assert.deepStrictEqual(g.warnings, []);
  const stake = geo0.stakes.find(s => s.run === run && s.index === idx);
  const segs = g.segments.filter(s => s.run === "RUN_TEST");
  assert.strictEqual(segs.length, 2);
  assert.ok(Math.abs(segs[0].x0 - stake.x) < 1e-9 && Math.abs(segs[0].y0 - stake.y) < 1e-9, "starts at the stake");
  assert.ok(Math.abs(segs[0].x1 - (stake.x + 50)) < 1e-9, "heads east");
  assert.ok(Math.abs(g.at.LM_NEW[1] - (stake.y - 20.5)) < 1e-9, "then south 20.5 ft");
  // Everything already on the map stays put.
  const old = geo0.segments.length;
  assert.strictEqual(g.segments.length, old + 2);
  geo0.segments.forEach((s, i) => { const m = g.segments.find(x => x.run === s.run && Math.abs(x.x0 - s.x0) < 1e-9 && Math.abs(x.y1 - s.y1) < 1e-9); assert.ok(m, "old line " + i + " still there"); });
});

t("a line can end at an existing landmark and is fitted to it", () => {
  const r = E.apply(base, [{ op: "add_run", run: "RUN_FIT", name: "Fit", start: "UMBRELLA", end: "CAR",
    entries: [{ type: "SurveyedLine", length_ft: 30, angle: 100 }, { type: "SurveyedLine", length_ft: 30, angle: 140 }] }]);
  const g = G.compute(r.data), segs = g.segments.filter(s => s.run === "RUN_FIT");
  assert.ok(Math.hypot(segs[1].x1 - g.at.CAR[0], segs[1].y1 - g.at.CAR[1]) < 1e-6);
});

t("bad input is refused with a plain message", () => {
  const r = E.apply(base, [{ op: "add_run", run: "RUN_BAD", name: "x", start: "UMBRELLA", entries: [{ type: "SurveyedLine", length_ft: 10, angle: 400 }] }]);
  assert.match(r.error, /Headings/); assert.strictEqual(r.failedAt, 0);
  assert.match(E.apply(base, [{ op: "add_run", run: "RUN_BAD", name: "x", start: "NOWHERE", entries: [{ type: "SurveyedLine", length_ft: 10, angle: 4 }] }]).error, /starts/);
  assert.match(E.apply(base, [{ op: "remove_run", run: "Nope" }]).error, /no line/);
});

t("dependents of a removed run are found, and follow on", () => {
  const deps = E.dependents(base, "UmbrellaToRockIsland", 0);
  assert.ok(deps.includes("RockIslandBottleClockwise") && deps.includes("RockIslandBottleCounterClockwise"), deps.join());
  // Removing only the run's last few entries loses fewer landmarks.
  const r = base.runs.UmbrellaToRockIsland, last = r.length - 1;
  assert.ok(E.dependents(base, "UmbrellaToRockIsland", last).length <= deps.length);
  // Removing the run and its dependents leaves a map with no missing starts.
  const changes = ["UmbrellaToRockIsland", ...deps].map(run => ({ op: "remove_run", run }));
  const res = E.apply(base, changes); assert.strictEqual(res.error, null);
  assert.deepStrictEqual(G.compute(res.data).warnings, []);
  // Removing only the run leaves warnings, which is why the editor asks.
  assert.ok(G.compute(E.apply(base, [{ op: "remove_run", run: "UmbrellaToRockIsland" }]).data).warnings.length > 0);
});

t("removing one run of a loop keeps the other, drawn as surveyed", () => {
  const res = E.apply(base, [{ op: "remove_run", run: "JJJ" }]);
  const step = res.data.plan.find(s => s.run === "FourWayToBypassEndSixtyFoot");
  assert.deepStrictEqual(step, { mode: "draw", start: "FOUR_WAY", run: "FourWayToBypassEndSixtyFoot" });
});

t("cut, mark removed and drop a segment", () => {
  const run = "CarToLisasGift", r = base.runs[run];
  const cut = E.apply(base, [{ op: "cut_run", run, from: 5 }]).data;
  assert.strictEqual(cut.runs[run].length, 5);
  const marked = E.apply(base, [{ op: "mark_removed", run, from: 0, to: 3 }]).data;
  assert.ok(marked.runs[run].slice(0, 3).every(e => !/^(SurveyedLine|UnsurveyedLine|Stake)$/.test(e.type)));
  assert.strictEqual(marked.runs[run][3], r[3], "untouched entries are shared");
  const li = r.findIndex(e => e.type === "SurveyedLine");
  const dropped = E.apply(base, [{ op: "drop_segment", run, index: li }]).data;
  const g0 = G.compute(base), g1 = G.compute(dropped);
  assert.strictEqual(g1.segments.length, g0.segments.length - 1);
  assert.deepStrictEqual(g1.at.LISAS_GIFT, g0.at.LISAS_GIFT, "later points stay where they were");
});

t("descriptions read plainly", () => {
  const d = E.describeAll(base, [{ op: "remove_run", run: "JJJ" }, { op: "cut_run", run: "CarToLisasGift", from: 5 }]);
  assert.strictEqual(d[0], "Delete JJJ");
  assert.match(d[1], /^Delete Car to Lisas Gift from line \d+ to the end$|^Delete Car to Lisa's Gift from line \d+ to the end$/);
});

t("a site with no survey yet starts from its own starting point", () => {
  const hydra = require("../../lake-hydra-data.js");
  const g = G.compute(hydra);
  assert.deepStrictEqual(g.warnings, []);
  assert.strictEqual(g.landmarks.length, 1);
  assert.strictEqual(g.landmarks[0].landmark, "ENTRY");
  const r = E.apply(hydra, [{ op: "add_run", run: "R1", name: "First line", start: "ENTRY",
    entries: [{ type: "SurveyedLine", length_ft: 50, angle: 90 }, { type: "SaveLandmark", landmark: "BUS", depth: 30 }], landmarks: { BUS: "Bus" } }]);
  assert.strictEqual(r.error, null);
  const g2 = G.compute(r.data);
  assert.strictEqual(g2.segments.length, 1);
  assert.ok(Math.abs(g2.at.BUS[0] - 50) < 1e-9 && Math.abs(g2.at.BUS[1]) < 1e-9);
  assert.ok(E.apply(base, [{ op: "add_run", run: "R2", name: "x", start: "ENTRY", entries: [{ type: "SurveyedLine", length_ft: 5, angle: 0 }] }]).error);
});

console.log(`${n} tests passed`);
