// Tests for survey-edits.js. Run: node tools/survey/test-edits.js
const assert = require("assert");
const E = require("../../survey-edits.js"), G = require("../../survey-geometry.js");
const base = require("./local-data.js")("bonnie-castle");
const PI_ = Math.PI;
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
  // Two legs that measure 3% long and 1° off the straight line from Umbrella to Car: close enough to join up.
  const [ux, uy] = geo0.at.UMBRELLA, [cx, cy] = geo0.at.CAR, L = Math.hypot(cx - ux, cy - uy), hd = 90 - Math.atan2(cy - uy, cx - ux) * 180 / Math.PI;
  const legs = k => [{ type: "SurveyedLine", length_ft: Math.round(L * k / 2 * 100) / 100, angle: ((hd + 1) % 360 + 360) % 360 }, { type: "SurveyedLine", length_ft: Math.round(L * k / 2 * 100) / 100, angle: ((hd + 1) % 360 + 360) % 360 }];
  const r = E.apply(base, [{ op: "add_run", run: "RUN_FIT", name: "Fit", start: "UMBRELLA", end: "CAR", entries: legs(1.03) }]);
  const g = G.compute(r.data), segs = g.segments.filter(s => s.run === "RUN_FIT");
  assert.ok(Math.hypot(segs[1].x1 - g.at.CAR[0], segs[1].y1 - g.at.CAR[1]) < 1e-6);
  assert.ok(!g.gaps.some(x => x.run === "RUN_FIT"));
  // 20% long: never stretched that far (Jamie 2026-11-25). Drawn as measured, ending past Car, and the gap is listed.
  const r2 = E.apply(base, [{ op: "add_run", run: "RUN_FIT", name: "Fit", start: "UMBRELLA", end: "CAR", entries: legs(1.2) }]);
  const g2 = G.compute(r2.data), s2 = g2.segments.filter(s => s.run === "RUN_FIT"), gap = g2.gaps.find(x => x.run === "RUN_FIT");
  assert.ok(gap && Math.abs(gap.ft - L * Math.hypot(1.2 - Math.cos(PI_ / 180), Math.sin(PI_ / 180))) < 0.1, "the gap is listed");
  assert.ok(Math.abs(s2[0].lengthFt - legs(1.2)[0].length_ft) < 1e-9, "drawn as measured");
  assert.ok(Math.hypot(g2.at.CAR[0] - cx, g2.at.CAR[1] - cy) < 1e-9, "Car stays where it was");
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

t("move a stake along its line: the lines stay put, the stake moves", () => {
  // A small made-up run: 30 ft east, stake, 30 ft east (straight through), then 40 ft north.
  const d = { origin: "O", landmarks: {}, runNames: { R: "Test" }, plan: [{ mode: "draw", start: "O", run: "R" }],
    runs: { R: [{ type: "SurveyedLine", length_ft: 30, angle: 90 }, { type: "Stake" }, { type: "SurveyedLine", length_ft: 30, angle: 90 },
      { type: "SurveyedLine", length_ft: 40, angle: 0 }, { type: "TieOff" }] } };
  const shape = g => g.segments.reduce((acc, s) => acc.concat([[s.x0, s.y0], [s.x1, s.y1]]), []);
  const ends = g => { const p = shape(g); return [p[0], p[p.length - 1]].map(q => q.map(v => v.toFixed(6)).join()); };
  const g0 = G.compute(d);
  // Slide the stake a quarter of the way up the 40 ft line.
  const r = E.apply(d, [{ op: "move_point", run: "R", index: 1, seg: 3, frac: 0.25 }]);
  assert.strictEqual(r.error, null);
  assert.deepStrictEqual(r.data.runs.R.map(e => e.type + (e.length_ft || "")), ["SurveyedLine60", "SurveyedLine10", "Stake", "SurveyedLine30", "TieOff"]);
  const g1 = G.compute(r.data);
  assert.deepStrictEqual(ends(g1), ends(g0), "the run starts and ends where it did");
  assert.ok(Math.abs(g1.stakes[0].x - 60) < 1e-6 && Math.abs(g1.stakes[0].y - 10) < 1e-6, "the stake is 10 ft up the north line");
  assert.ok(Math.abs(g1.totalSurveyedFt - g0.totalSurveyedFt) < 0.01, "same feet of line");
  // The tie-off at the end moves back to the middle of the first line.
  const r2 = E.apply(r.data, [{ op: "move_point", run: "R", index: 4, seg: 0, frac: 0.5 }]);
  assert.strictEqual(r2.error, null);
  const g2 = G.compute(r2.data);
  assert.ok(Math.abs(g2.tieoffs[0].x - 30) < 1e-6 && Math.abs(g2.tieoffs[0].y) < 1e-6);
  assert.deepStrictEqual(ends(g2), ends(g0));
  assert.ok(E.apply(d, [{ op: "move_point", run: "R", index: 0, seg: 2, frac: 0.5 }]).error, "a line isn't a stake");
  assert.ok(E.apply(d, [{ op: "move_point", run: "R", index: 1, seg: 1, frac: 0.5 }]).error, "a stake isn't a line");
  assert.ok(/Move the stake on Test/.test(E.describe({ op: "move_point", run: "R", index: 1, seg: 3, frac: 0.25 }, d)));
});

t("move a real stake: every line of the survey stays where it was", () => {
  const pos = g => JSON.stringify(g.segments.map(s => [s.x0, s.y0, s.x1, s.y1].map(v => v.toFixed(4))).sort());
  for (const [run, es] of Object.entries(base.runs)) {
    const idx = es.findIndex(e => e.type === "Stake"), seg = es.findIndex((e, i) => i > idx + 1 && E.LINE.test(e.type));
    if (idx < 0 || seg < 0) continue;
    const r = E.apply(base, [{ op: "move_point", run, index: idx, seg, frac: 0.5 }]);
    assert.strictEqual(r.error, null);
    const g = G.compute(r.data);
    assert.deepStrictEqual(g.warnings, []);
    // Every old corner is still a corner, give or take rounding to a hundredth of a foot (lines may be split
    // or joined, but the drawing is the same). Only the old stake point can go, if two straight lines joined there.
    const pts = g2 => g2.segments.flatMap(s => [[s.x0, s.y0], [s.x1, s.y1]]);
    const now = pts(g), far = pts(geo0).filter(([x, y]) => !now.some(([u, v]) => Math.hypot(x - u, y - v) < 0.05));
    const st = geo0.stakes.find(s => s.run === run && s.index === idx);
    assert.ok(far.every(([x, y]) => Math.hypot(x - st.x, y - st.y) < 0.05), far.length + " corners moved");
    assert.ok(Math.abs(g.totalSurveyedFt - geo0.totalSurveyedFt) < 0.05);
    return;
  }
  assert.fail("no run with a stake to test");
});

t("move a stake anywhere: the lines either side bend, the rest stays put", () => {
  const d = { origin: "O", landmarks: { END: "End" }, runNames: { R: "Test" }, plan: [{ mode: "draw", start: "O", run: "R" }],
    runs: { R: [{ type: "SurveyedLine", length_ft: 30, angle: 90 }, { type: "Stake" }, { type: "SurveyedLine", length_ft: 30, angle: 90 },
      { type: "SurveyedLine", length_ft: 40, angle: 0 }, { type: "SaveLandmark", landmark: "END" }] } };
  const g0 = G.compute(d);
  const st = g0.stakes[0];
  // Lines either side, worked out the way the editor does: from the stake's new spot to the ends of those lines.
  const a = g0.segments.find(s => s.index === 0), b = g0.segments.find(s => s.index === 2), compass = (dx, dy) => 90 - Math.atan2(dy, dx) * 180 / Math.PI, turn = compass(a.x1 - a.x0, a.y1 - a.y0) - 90;
  const P = [st.x + 5, st.y + 10];
  const leg = (x0, y0, x1, y1) => ({ length_ft: Math.hypot(x1 - x0, y1 - y0), angle: ((compass(x1 - x0, y1 - y0) - turn) % 360 + 360) % 360 });
  const c = { op: "bend_point", run: "R", index: 1, before: Object.assign({ i: 0 }, leg(a.x0, a.y0, P[0], P[1])), after: Object.assign({ i: 2 }, leg(P[0], P[1], b.x1, b.y1)) };
  const r = E.apply(d, [c]);
  assert.strictEqual(r.error, null);
  const g1 = G.compute(r.data);
  assert.ok(Math.hypot(g1.stakes[0].x - P[0], g1.stakes[0].y - P[1]) < 0.02, "the stake is where it was put");
  assert.ok(Math.hypot(g1.at.END[0] - g0.at.END[0], g1.at.END[1] - g0.at.END[1]) < 0.02, "the end of the run stays put");
  assert.ok(/line before it now/.test(E.describe(c, d)));
  // A named point between the two lines can't move this way.
  const d2 = JSON.parse(JSON.stringify(d)); d2.runs.R.splice(2, 0, { type: "SaveLandmark", landmark: "MID" });
  assert.ok(E.apply(d2, [Object.assign({}, c, { after: Object.assign({}, c.after, { i: 3 }) })]).error);
});

t("delete_point takes out just the stake", () => {
  const d = { origin: "A", landmarks: { A: "A", END: "End" }, plan: [{ mode: "draw", start: "A", run: "R" }], runNames: { R: "R" },
    runs: { R: [{ type: "SurveyedLine", length_ft: 30, angle: 90 }, { type: "Stake" }, { type: "SurveyedLine", length_ft: 40, angle: 0 }, { type: "SaveLandmark", landmark: "END" }] } };
  const c = { op: "delete_point", run: "R", index: 1 }, r = E.apply(d, [c]);
  assert.strictEqual(r.error, null);
  assert.strictEqual(r.data.runs.R.length, 3);
  const g0 = G.compute(d), g1 = G.compute(r.data);
  assert.strictEqual(g1.stakes.length, 0);
  assert.ok(Math.hypot(g1.at.END[0] - g0.at.END[0], g1.at.END[1] - g0.at.END[1]) < 1e-9, "nothing else moves");
  assert.ok(/Delete the stake on R/.test(E.describe(c, d)));
  assert.ok(E.apply(d, [{ op: "delete_point", run: "R", index: 0 }]).error, "a line can't be deleted this way");
  assert.ok(E.apply(d, [{ op: "delete_point", run: "R", index: 3 }]).error, "a named point can't be deleted this way");
});

t("set_icon gives a point a wreck symbol, and takes it off again", () => {
  const d = { origin: "A", landmarks: { A: "A", END: "Old barge" }, plan: [{ mode: "draw", start: "A", run: "R" }], runNames: { R: "R" },
    runs: { R: [{ type: "SurveyedLine", length_ft: 30, angle: 90 }, { type: "SaveLandmark", landmark: "END" }] } };
  const c = { op: "set_icon", landmark: "END", icon: "icons/shipwreck.png" }, r = E.apply(d, [c]);
  assert.strictEqual(r.error, null);
  assert.strictEqual(r.data.runs.R[1].icon_path, "icons/shipwreck.png");
  assert.strictEqual(G.compute(r.data).landmarks.find(l => l.landmark === "END").icon, "icons/shipwreck.png");
  assert.strictEqual(d.runs.R[1].icon_path, undefined, "the original isn't changed");
  assert.ok(/Show Old barge as a shipwreck/.test(E.describe(c, d)), E.describe(c, d));
  const back = E.apply(r.data, [{ op: "set_icon", landmark: "END", icon: "" }]);
  assert.strictEqual(back.data.runs.R[1].icon_path, undefined);
  assert.ok(E.apply(d, [{ op: "set_icon", landmark: "END", icon: "https://evil.example/x.png" }]).error, "only the map's own symbols");
  assert.ok(E.apply(d, [{ op: "set_icon", landmark: "NOPE", icon: "" }]).error, "a point that isn't there");
});

console.log(`${n} tests passed`);
