// Checks survey-sheet.js: the divers' station-to-station sheet layout to the map data and back.
// Run: node tools/survey/test-sheet.js
const SS = require("../../survey-sheet.js"), G = require("../../survey-geometry.js");
let fails = 0;
const ok = (name, cond, extra) => { console.log((cond ? "ok   " : "FAIL ") + name + (cond || extra === undefined ? "" : " " + JSON.stringify(extra))); if (!cond) fails++; };
const rows = [
  ["From (A)", "To (B)", "Depth @ B", "Backcourse (Hdg B->A)", "Heading (A->B)", "Distance (ft)", "Distance (M)"],
  ["", "Log", 70], [],
  ["MAIN LINE"], ["Log", "Rock", 70, 90, 270, 48], ["Rock", "Pennant", 70, 90, 270, 42], ["Pennant", "Rock", 72, 40, 220, 45], ["Rock / **", "Stake", 75, 45, 225, 14.5],
  [], ["SADDLE"], ["Pennant", "Rock", 68, 205, 25, 38], ["Rock", "Rock", 65, 0, 0, 3, "", "Jump"],
  [], ["BACK"], ["Rock / **", "Log", 70, 10, 190, 60],
  [], ["LOOP A"], ["Pennant", "Rock", 70, "", 90, 10], ["Rock", "Rock", 70, "", 0, 10],
  [], ["LOOP B", "loop with LOOP A"], ["Pennant", "Rock", 70, "", 0, 10], ["Rock", "Rock", 70, "", 90, 10.5],
];
const r = SS.toSurvey(rows, [], { id: "t" });
ok("no errors", !r.errors.length, r.errors);
ok("origin", r.data.origin === "LOG" && r.data.originPoint.depth === 70);
ok("lines named", JSON.stringify(Object.values(r.data.runNames)) === JSON.stringify(["MAIN LINE", "SADDLE", "BACK", "LOOP A", "LOOP B"]));
ok("main line feet", r.data.runs.MainLine.filter(e => e.length_ft != null).reduce((a, e) => a + e.length_ft + (e.length_in || 0) / 12, 0) === 149.5);
ok("named tie-off from a later From", r.data.runs.MainLine.some(e => e.type === "SaveLandmark" && r.data.landmarks[e.landmark] === "Rock / **" && e.depth === 72));
ok("jump kind", r.data.runs.Saddle.some(e => e.type === "Jump"));
ok("fit to a known station", JSON.stringify(r.data.plan[2]) === JSON.stringify({ mode: "fit", start: "ROCK", run: "Back", end: "LOG" }), r.data.plan[2]);
ok("loop", r.data.plan[3].mode === "loop" && r.data.plan[3].run2 === "LoopB", r.data.plan[3]);
const bad = SS.toSurvey([["", "Log", 70], ["X"], ["Nowhere", "Rock", 70, 0, 180, 10], ["Rock", "Rock", 70, 10, 45, 10]], []);
ok("unknown start station is an error", bad.errors.some(e => /isn't a named station/.test(e)));
const warn = SS.toSurvey([["", "Log", 70], ["Log", "Rock", 70, 10, 45, 10]], []);
ok("backcourse warning", warn.warnings.length === 1);
const back = SS.fromSurvey(r.data), r2 = SS.toSurvey(back.rows, back.landmarkRows, { id: "t" });
ok("round trip runs", JSON.stringify(r2.data.runs) === JSON.stringify(r.data.runs));
ok("round trip plan", JSON.stringify(r2.data.plan) === JSON.stringify(r.data.plan));
const a = G.compute(r.data), b = G.compute(r2.data);
ok("round trip drawing", Object.keys(a.at).every(k => b.at[k] && Math.hypot(a.at[k][0] - b.at[k][0], a.at[k][1] - b.at[k][1]) < 1e-6));
// The real Bonnie Castle survey, when it's on this computer (it's private, so not in the repository).
let full = null; try { full = require("./local/bonnie-castle-data.js"); } catch (e) { }
if (full && full.runs && Object.keys(full.runs).length) {
  const o = SS.fromSurvey(full), f = SS.toSurvey(o.rows, o.landmarkRows, {});
  const A = G.compute(full), B = G.compute(f.data);
  ok("Bonnie Castle round trip", !f.errors.length && Object.keys(A.at).every(k => B.at[k] && Math.hypot(A.at[k][0] - B.at[k][0], A.at[k][1] - B.at[k][1]) < 1e-6) && Math.abs(A.totalSurveyedFt - B.totalSurveyedFt) < 1e-6, f.errors.slice(0, 3));
} else console.log("skip Bonnie Castle round trip (no local data)");
console.log(fails ? fails + " failed" : "all passed"); process.exit(fails ? 1 : 0);
