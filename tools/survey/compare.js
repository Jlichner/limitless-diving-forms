// Compare the web geometry with what the original Python program drew (python_reference.py output).
// Usage: node compare.js survey-data.js survey-geometry.js python-ref.json
const [dataPath, geoPath, refPath] = process.argv.slice(2).map(p => require("path").resolve(p));
const data = require(dataPath), G = require(geoPath), ref = require(refPath);
const out = G.compute(data, { aliases: false });
if (out.warnings.length) console.log("WARNINGS", out.warnings);
const near = (a, b) => Math.abs(a - b) < 1e-6;
// Segments in drawing order.
const py = ref.segments, js = out.segments;
let worst = 0, mismatch = 0;
const n = Math.max(py.length, js.length);
for (let i = 0; i < Math.min(py.length, js.length); i++) {
  const d = Math.max(Math.abs(py[i].x[0] - js[i].x0), Math.abs(py[i].y[0] - js[i].y0), Math.abs(py[i].x[1] - js[i].x1), Math.abs(py[i].y[1] - js[i].y1));
  worst = Math.max(worst, d); if (d > 1e-6) { if (mismatch < 5) console.log("segment", i, js[i].run, d); mismatch++; }
}
console.log(`segments: python ${py.length}, web ${js.length}, mismatched ${mismatch}, worst difference ${worst.toExponential(2)} ft`);
// Markers: python records tie-offs, stakes, arrows and landmark squares as single-point plots.
const pyPts = ref.markers.map(m => [m.x, m.y]);
const jsPts = [...out.tieoffs, ...out.stakes, ...out.arrows].map(p => [p.x, p.y]);
const missing = jsPts.filter(p => !pyPts.some(q => near(p[0], q[0]) && near(p[1], q[1])));
console.log(`stakes+tie-offs+arrows: web ${jsPts.length}, python markers ${pyPts.length}, web points with no python match: ${missing.length}`);
// Landmarks.
let lmBad = 0;
for (const [k, xy] of Object.entries(ref.landmarks)) {
  const w = out.at[k];
  if (!w || !near(w[0], xy[0]) || !near(w[1], xy[1])) { lmBad++; console.log("landmark differs", k, xy, w); }
}
console.log(`landmarks: python ${Object.keys(ref.landmarks).length}, web ${Object.keys(out.at).length}, differing ${lmBad}`);
console.log(`total surveyed: python ${ref.total_surveyed.toFixed(3)} ft, web ${out.totalSurveyedFt.toFixed(3)} ft`);
