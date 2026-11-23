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
const cur = { title: "T", credit: "C", georef: { landmark: "LOG", lat: 1, lon: 2 }, runs: { Old: [{ type: "Jump", length_ft: 1, angle: 0 }], MainLine: [] }, runNames: { Old: "Old" }, unusedRuns: ["Old"], plan: [], landmarks: {} };
const m = SS.mergeInto(cur, r.data);
ok("merge keeps website-only things", m.data.title === "T" && m.data.credit === "C" && m.data.georef.lat === 1 && m.data.runs.Old && m.data.unusedRuns[0] === "Old" && !m.notes.length, m.notes);
ok("merge takes the sheet's lines", JSON.stringify(m.data.runs.MainLine) === JSON.stringify(r.data.runs.MainLine) && m.data.plan === r.data.plan);
ok("merge warns when the GPS station is gone", SS.mergeInto({ georef: { landmark: "GONE" } }, r.data).notes.length === 1);
ok("change summary", /^\d+ ft of line \(was 0\); new: MAIN LINE/.test(SS.describeChange({}, r.data)), SS.describeChange({}, r.data));
// A patch placed by GPS (no line joining it to the rest yet).
const gpsRows = rows.concat([[], ["MIDDLE EARTH", "GPS N44.34465 W75.91859"], ["Far Log", "Rock", 70, 90, 270, 48], ["Rock", "Far Pennant", 70, 90, 270, 42]]);
const gr = SS.toSurvey(gpsRows, [], { id: "t" });
ok("GPS patch reads", !gr.errors.length && gr.data.landmarks.FAR_LOG === "Far Log", gr.errors);
const site = Object.assign({ georef: { landmark: "LOG", lat: 44.3421, lon: -75.9165, declination: -13 } }, {});
const gm = SS.mergeInto(site, gr.data);
ok("GPS patch placed", !gm.errors.length, gm.errors);
const ga = G.compute(gm.data), gg = G.georef(gm.data.georef, ga.at), [la, lo] = gg.toLatLng(...ga.at.FAR_LOG);
ok("GPS patch lands on its GPS", Math.abs(la - 44.34465) < 1e-7 && Math.abs(lo + 75.91859) < 1e-7, [la, lo]);
ok("GPS patch needs the map placed", SS.mergeInto({}, gr.data).errors.length === 1);
const gb = SS.fromSurvey(gm.data), gr2 = SS.toSurvey(gb.rows, gb.landmarkRows, { id: "t" });
ok("GPS patch round trip", gb.rows.some(r => r[0] === "MIDDLE EARTH" && /^GPS 44\.34465, -75\.91859$/.test(r[1])) && JSON.stringify(SS.mergeInto(site, gr2.data).data.runs) === JSON.stringify(gm.data.runs));
const joined = SS.toSurvey(rows.concat([[], ["LINK"], ["Pennant", "Far Log", "", "", 45, 300, "", "Jump"], [], ["MIDDLE EARTH", "GPS N44.34465 W75.91859"], ["Far Log", "Rock", 70, 90, 270, 48]]), []);
ok("phantom Jump joins it, GPS then unused", !joined.errors.length && joined.warnings.some(w => /isn't used/.test(w)) && !Object.keys(joined.data.runs).some(k => /^Gps/.test(k)), joined);
// Levels (column K): whole lines on the title row, or from a row on.
const R = require("../../survey-ratings.js");
const lvRows = [["", "Log", 70], [], ["MAIN"], ["Log", "Rock", 70, "", 270, 40], ["Rock", "Pennant", 70, "", 270, 40],
  [], ["DEEP", "", "", "", "", "", "", "", "", "", "Black diamond"], ["Pennant", "Rock", 90, "", 180, 30], ["Rock", "Rock", 95, "", 180, 30],
  [], ["MIXED"], ["Pennant", "Rock", 70, "", 0, 20], ["Rock", "Rock", 70, "", 0, 20, "", "", "", "", "blue"], ["Rock", "Rock", 70, "", 0, 20]];
const lv = SS.toSurvey(lvRows, [], {});
ok("level column reads", !lv.errors.length && lv.levels.length === 2 && lv.levels[0].level === "black" && lv.levels[1].level === "blue", lv);
const sp = SS.splitLevels(lv.data, lv.levels, lv.stated);
ok("levels split into layers", !sp.errors.length && sp.src.black.runs.Deep && !sp.src.green.runs.Deep && Object.keys(sp.src.blue.runs).length === 1 && sp.src.green.runs.Mixed, sp.errors);
const g0 = G.compute(lv.data), g1 = G.compute(R.merge(R.ORDER.map(k => sp.src[k])));
ok("lines stay where they were", g0.segments.length === g1.segments.length && !g1.warnings.length && Math.abs(g0.totalSurveyedFt - g1.totalSurveyedFt) < 1e-9, g1.warnings);
const jl = SS.joinLevels(sp.src.green, { blue: sp.src.blue, black: sp.src.black });
const back2 = SS.fromSurvey(jl.data, jl.runLevel);
ok("Get writes the level on the title row", back2.rows.some(r => r[0] === "DEEP" && r[10] === "Black diamond"));
const lv2 = SS.toSurvey(back2.rows, back2.landmarkRows, {}), sp2 = SS.splitLevels(lv2.data, lv2.levels, lv2.stated);
ok("levels round trip", !sp2.errors.length && ["green", "blue", "black"].every(k => Object.keys(sp2.src[k].runs).length === Object.keys(sp.src[k].runs).length), sp2.errors);
const under = lvRows.slice(0, 10).map(r => r.slice()); under[8] = ["Rock", "Deep end", 95, "", 180, 30];
const uRows = under.concat([[], ["UNDER", "", "", "", "", "", "", "", "", "", "Green circle"], ["Deep end", "Rock", 99, "", 90, 10]]);
const uv = SS.toSurvey(uRows, []), us = SS.splitLevels(uv.data, uv.levels, uv.stated);
ok("a line said to be green under a black line goes black, with a warning", !uv.errors.length && us.src.black.runs.Under && us.warnings.length === 1, [uv.errors, us.warnings]);
ok("bad level word", SS.toSurvey([["", "Log"], ["X"], ["Log", "Rock", 1, "", 0, 1, "", "", "", "", "purple"]], []).errors.length === 1);
// The real Bonnie Castle survey, when it's on this computer (it's private, so not in the repository).
let full = null; try { full = require("./local/bonnie-castle-data.js"); } catch (e) { }
if (full && full.runs && Object.keys(full.runs).length) {
  const o = SS.fromSurvey(full), f = SS.toSurvey(o.rows, o.landmarkRows, {});
  const A = G.compute(full), B = G.compute(f.data);
  ok("Bonnie Castle round trip", !f.errors.length && Object.keys(A.at).every(k => B.at[k] && Math.hypot(A.at[k][0] - B.at[k][0], A.at[k][1] - B.at[k][1]) < 1e-6) && Math.abs(A.totalSurveyedFt - B.totalSurveyedFt) < 1e-6, f.errors.slice(0, 3));
} else console.log("skip Bonnie Castle round trip (no local data)");
console.log(fails ? fails + " failed" : "all passed"); process.exit(fails ? 1 : 0);
