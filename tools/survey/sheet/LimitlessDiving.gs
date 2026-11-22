// Limitless Diving: built by tools/survey/sheet/build.js from survey-sheet.js and menu.gs. Paste all of it into
// Extensions → Apps Script (replacing what's there), save, and reload the sheet.

/* Limitless Diving — survey map geometry (survey-map.html).
   Turns the survey runs (survey-data.js) into map features: line segments, stakes, tie-offs, arrows and
   landmarks, in feet, with x to the east and y to the north. It is a straight port of base.py from the
   underwatersurvey project (Stephanie Yang, 2020–2022), so the web map matches the printed one.

   Each step of the plan starts a run from a landmark that's already on the map:
     draw     follow the run as surveyed
     loop     two runs from the same landmark that meet again: both are stretched and turned a little
              so they close (base.py draw_circuit)
     fit      a run between two landmarks already on the map: stretched and turned to end at the second
              (base.py draw_between_landmarks)

   Works in the browser (window.SurveyGeometry) and in Node (module.exports), for checking. */
(function (root) {
  "use strict";

  const PI = Math.PI;
  // Compass heading in degrees (0 = north, clockwise) to a math angle in radians, as base.py __radians.
  const radians = deg => PI / 2 - Number(deg) / 360 * 2 * PI;
  // base.py __degrees. Only ever used for differences between two angles, where it gives the right turn.
  const degrees = rad => (rad + PI / 2) / 2 / PI * 360;

  const LINE_TYPES = { SurveyedLine: "surveyed", UnsurveyedLine: "unsurveyed", RemovedLine: "removed", MarinaLine: "marina" };
  const STAKE_TYPES = { Stake: "stake", SavedStake: "stake", RemovedStake: "removed-stake" };
  const feet = e => (Number(e.length_ft) || 0) + (Number(e.length_in) || 0) / 12;

  function compute(data, options) {
    // aliases: treat landmarks that share an id in data.py as one, as the original program did (see survey-data.js).
    const opt = Object.assign({ aliases: false, declination: 0 }, options || {});
    const key = lm => (opt.aliases && data.aliases && data.aliases[lm]) || lm;
    // Every site is measured from one starting point at (0, 0): Bonnie Castle's is the Bar.
    const origin = data.origin || "BAR";
    const at = { [key(origin)]: [0, 0] };
    const out = { segments: [], stakes: [], tieoffs: [], arrows: [], landmarks: [], depths: [], warnings: [], totalSurveyedFt: 0 };
    let box = [[0, 0], [0, 0]];

    // Where a run ends, relative to its start, ignoring stretch and turn: [distance, angle].
    function runVector(entries) {
      let x = 0, y = 0;
      for (const e of entries) {
        if (LINE_TYPES[e.type] || e.type === "Jump") {
          const L = feet(e);
          x += L * Math.cos(radians(e.angle)); y += L * Math.sin(radians(e.angle));
        }
      }
      return polar(x, y);
    }
    function polar(x, y) {
      const a = x >= 0 ? Math.atan(y / x) : Math.atan(y / x) + PI;
      return [Math.sqrt(x * x + y * y), degrees(a)];
    }

    function draw(start, runName, stretch, rotation) {
      const entries = data.runs[runName];
      if (!entries) { out.warnings.push(`No run called ${runName}`); return; }
      const s = at[key(start)];
      if (!s) { out.warnings.push(`${runName} starts at ${start}, which isn't on the map yet`); return; }
      let [x, y] = s;
      entries.forEach((e, i) => {
        const ref = { run: runName, index: i };
        const lineType = LINE_TYPES[e.type];
        if (lineType || e.type === "Jump") {
          const L = feet(e) * stretch;
          const a = radians(Number(e.angle) + rotation - opt.declination);
          const x1 = x + L * Math.cos(a), y1 = y + L * Math.sin(a);
          if (lineType) {
            out.segments.push(Object.assign({ kind: lineType, x0: x, y0: y, x1, y1, lengthFt: L, heading: Number(e.angle) }, ref,
              e.alt_text ? { text: e.alt_text, flipText: !!e.flip_text_side } : null));
            out.totalSurveyedFt += L;
          }
          x = x1; y = y1;
        } else if (e.type === "Arrow") {
          const a = radians(Number(e.angle) + rotation - opt.declination), d = e.distance == null ? 10 : Number(e.distance);
          out.arrows.push(Object.assign({ x: x + d * Math.cos(a), y: y + d * Math.sin(a), heading: Number(e.angle) + rotation }, ref));
        } else if (e.type === "SaveLandmark") {
          at[key(e.landmark)] = [x, y];
          out.landmarks.push(Object.assign({ landmark: e.landmark, x, y, icon: e.icon_path || null,
            transparent: !!e.transparent_icon, depth: e.depth == null ? null : Number(e.depth) }, ref));
          if (e.depth != null) {
            const da = e.depth_angle == null ? 90 : Number(e.depth_angle), dz = e.depth_distance_zoom == null ? 1 : Number(e.depth_distance_zoom);
            out.depths.push(Object.assign({ landmark: e.landmark, depth: Number(e.depth), x, y, angle: da, zoom: dz }, ref));
          }
        } else if (STAKE_TYPES[e.type]) {
          if (e.type === "SavedStake" && e.landmark) at[key(e.landmark)] = [x, y];
          out.stakes.push(Object.assign({ kind: STAKE_TYPES[e.type], x, y, text: e.text || null }, ref));
        } else if (e.type === "TieOff") {
          out.tieoffs.push(Object.assign({ x, y }, ref));
        } else {
          out.warnings.push(`${runName} #${i + 1}: unknown entry type ${e.type}`);
        }
        box = [[Math.min(box[0][0], x), Math.min(box[0][1], y)], [Math.max(box[1][0], x), Math.max(box[1][1], y)]];
      });
    }

    for (const step of data.plan) {
      if (step.mode === "draw") {
        draw(step.start, step.run, 1, 0);
      } else if (step.mode === "loop") {
        const [d1, a1] = runVector(data.runs[step.run] || []), [d2, a2] = runVector(data.runs[step.run2] || []);
        draw(step.start, step.run, 2 * d2 / (d1 + d2), (a1 - a2) / 2);
        draw(step.start, step.run2, 2 * d1 / (d1 + d2), (a2 - a1) / 2);
      } else if (step.mode === "fit") {
        const p0 = at[key(step.start)], p1 = at[key(step.end)];
        if (!p0 || !p1) { out.warnings.push(`${step.run}: ${p0 ? step.end : step.start} isn't on the map yet`); continue; }
        const [d1, a1] = polar(p1[0] - p0[0], p1[1] - p0[1]), [d2, a2] = runVector(data.runs[step.run] || []);
        draw(step.start, step.run, d1 / d2, a2 - a1);
      } else {
        out.warnings.push(`Unknown plan step ${JSON.stringify(step)}`);
      }
    }
    // A site that names its starting point shows it, even before any line from it has a landmark there.
    if (data.origin && !out.landmarks.some(l => l.landmark === origin)) {
      const o = data.originPoint || {};
      out.landmarks.unshift({ landmark: origin, x: 0, y: 0, icon: o.icon_path || null, transparent: false,
        depth: o.depth == null ? null : Number(o.depth), run: null, index: null, origin: true });
      if (o.depth != null) out.depths.unshift({ landmark: origin, depth: Number(o.depth), x: 0, y: 0, angle: 90, zoom: 1, run: null, index: null });
    }
    out.at = at;
    out.bounds = box;
    return out;
  }

  // Shapes drawn around landmarks, from base.py draw_platforms, draw_islander_platforms and draw_boat_ramp.
  function extras(at) {
    const step = (p, L, deg) => [p[0] + L * Math.cos(radians(deg)), p[1] + L * Math.sin(radians(deg))];
    const shapes = [];
    if (at.SKELETON) {
      const L1 = 15 + 9 / 12, W1 = 11 + 2 / 12, gap = 8 + 4 / 12, L2 = 11 + 3 / 12, W2 = 15 + 11 / 12, a = 330;
      let p = [at.SKELETON[0] - 5, at.SKELETON[1] - 4];
      const c1 = [p]; p = step(p, L1, a); c1.push(p); p = step(p, W1, a - 90); c1.push(p); p = step(p, L1, a - 180); c1.push(p);
      p = step(step(at.SKELETON, L1, a), gap, a); p = [p[0] - 4, p[1] - 4];
      const c2 = [p]; p = step(p, L2, a); c2.push(p); p = step(p, W2, a - 90); c2.push(p); p = step(p, L2, a - 180); c2.push(p);
      shapes.push({ kind: "platform", label: "Platform, 30'", points: c1 }, { kind: "platform", label: "Platform, 30'", points: c2 });
    }
    if (at.ISLANDER_PLATFORM) {
      let p = [at.ISLANDER_PLATFORM[0] - 5, at.ISLANDER_PLATFORM[1] - 4];
      const c = [p]; p = step(p, 11, 180); c.push(p); p = step(p, 16, 270); c.push(p); p = step(p, 11, 360); c.push(p);
      shapes.push({ kind: "platform", label: "Islander platform, 27'", points: c });
    }
    if (at.BOAT_RAMP_1 && at.BOAT_RAMP_2) {
      const [a, b] = [at.BOAT_RAMP_1, at.BOAT_RAMP_2];
      const third = [(2 * a[0] + b[0]) / 3, (2 * a[1] + b[1]) / 3], two = [(a[0] + 2 * b[0]) / 3, (a[1] + 2 * b[1]) / 3];
      const p3 = step(two, 60, 325 - 180), p4 = step(p3, (35 + 10 / 12) / 3, 325 - 90);
      shapes.push({ kind: "ramp", label: "Boat ramp", points: [third, two, p3, p4] });
    }
    return shapes;
  }

  // Placing a map on the earth (data.georef). The survey is in feet with headings from a compass (magnetic).
  // georef = { landmark, lat, lon, declination }: that landmark is at lat/lon, and magnetic north is
  // <declination> degrees east of true north (west is negative). With a second known point (landmark2, lat2,
  // lon2) the turn and scale are worked out from the two points instead, which also takes up any small error.
  // at is the landmark positions from compute(). Returns null until the landmark and coordinates are set.
  function georef(gr, at) {
    if (!gr || gr.lat === "" || gr.lon === "" || !isFinite(Number(gr.lat)) || !isFinite(Number(gr.lon))) return null;
    const p = at && at[gr.landmark];
    if (!p) return null;
    const R = 6378137, FT = 0.3048, rad = PI / 180, lat0 = Number(gr.lat), lon0 = Number(gr.lon), cos0 = Math.cos(lat0 * rad);
    const enu = (lat, lon) => [(lon - lon0) * rad * R * cos0, (lat - lat0) * rad * R];
    // ENU metres = k × (feet from the landmark), with k a complex number (turn and scale).
    let kr = null, ki = null, twoPoint = false;
    const p2 = gr.landmark2 && at[gr.landmark2];
    if (p2 && gr.lat2 !== "" && gr.lon2 !== "" && isFinite(Number(gr.lat2)) && isFinite(Number(gr.lon2))) {
      const vx = p2[0] - p[0], vy = p2[1] - p[1], [wx, wy] = enu(Number(gr.lat2), Number(gr.lon2)), d = vx * vx + vy * vy;
      if (d > 100) { kr = (wx * vx + wy * vy) / d; ki = (wy * vx - wx * vy) / d; twoPoint = true; }
    }
    if (kr === null) { const t = -(Number(gr.declination) || 0) * rad; kr = FT * Math.cos(t); ki = FT * Math.sin(t); }
    const k2 = kr * kr + ki * ki;
    return {
      twoPoint,
      scale: Math.sqrt(k2) / FT,                          // 1 = drawn as measured
      turn: -Math.atan2(ki, kr) / rad,                    // degrees the survey is turned clockwise
      toLatLng(x, y) {
        const vx = x - p[0], vy = y - p[1], e = kr * vx - ki * vy, n = ki * vx + kr * vy;
        return [lat0 + n / R / rad, lon0 + e / (R * cos0) / rad];
      },
      toXY(lat, lon) {
        const [e, n] = enu(lat, lon);
        return [p[0] + (e * kr + n * ki) / k2, p[1] + (n * kr - e * ki) / k2];
      },
    };
  }

  // A latitude or longitude typed the way people copy it: decimal degrees (44.3421, -75.9165), with a letter
  // (44.3421 N, W 75.9165), degrees and decimal minutes (44° 20.526' N), or degrees, minutes and seconds
  // (44°20'31.6"N). axis is "lat" or "lon". Returns the decimal degrees, or NaN when it can't be read.
  function parseCoord(text, axis) {
    let t = String(text == null ? "" : text).trim().toUpperCase().replace(/[\u2212\u2013]/g, "-").replace(/,(?=\d)/g, ".");
    if (!t) return NaN;
    const hem = t.match(/[NSEW]/g) || [];
    if (hem.length > 1 || /[A-DF-MO-RT-VX-Z]/.test(t)) return NaN;
    if (hem.length && (axis === "lat" ? !/[NS]/.test(hem[0]) : !/[EW]/.test(hem[0]))) return NaN;
    const neg = /^\s*-/.test(t.replace(/^[NSEW]\s*/, ""));
    const nums = t.match(/\d+(?:\.\d+)?|\.\d+/g) || [];
    if (!nums.length || nums.length > 3) return NaN;
    const [d, m = 0, sec = 0] = nums.map(Number);
    if (m >= 60 || sec >= 60 || (nums.length > 1 && /\./.test(nums[0]))) return NaN;
    let v = d + m / 60 + sec / 3600;
    if (neg || (hem.length && /[SW]/.test(hem[0]))) v = -v;
    return Math.abs(v) <= (axis === "lat" ? 90 : 180) ? Math.round(v * 1e7) / 1e7 : NaN;
  }
  // A latitude and longitude together, e.g. pasted from Google Maps: "44.3421, -75.9165",
  // "44.3421 -75.9165" or "44°20'31.6"N 75°54'59.4"W". Returns [lat, lon] or null.
  function parseLatLon(text) {
    const t = String(text == null ? "" : text).trim().replace(/[\u2212\u2013]/g, "-");
    const tries = [];
    const hem = t.match(/^(.*?[NS])\s*[,;]?\s*(.*[EW].*)$/i);
    if (hem) tries.push([hem[1], hem[2]]);
    const pre = t.match(/^([NS].*?)\s*[,;]?\s*([EW].*)$/i);   // letter first: N44.34465 W75.91859
    if (pre) tries.push([pre[1], pre[2]]);
    const parts = t.split(/\s*[,;]\s*/);
    if (parts.length === 2) tries.push(parts);
    const sp = t.match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/);
    if (sp && /\./.test(sp[1]) && /\./.test(sp[2])) tries.push([sp[1], sp[2]]);
    for (const [a, b] of tries) {
      const la = parseCoord(a, "lat"), lo = parseCoord(b, "lon");
      if (!isNaN(la) && !isNaN(lo)) return [la, lo];
    }
    return null;
  }

  const api = { compute, extras, radians, georef, parseCoord, parseLatLon };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SurveyGeometry = api;
})(typeof window !== "undefined" ? window : globalThis);

/* Limitless Diving — survey data in a spreadsheet, the way the divers record it (station to station), and back.
   Used by the Google Sheet's "Limitless Diving" menu (tools/survey/sheet/) and the tests; works in the browser
   (window.SurveySheet), in Node (module.exports) and in Google Apps Script (a global SurveySheet).

   The Survey tab, one row per leg of line, in blocks: a blank row starts a new line.
     A From (A)   B To (B)   C Depth @ B   D Backcourse (heading B->A)   E Heading (A->B)   F Distance (ft)   G Distance (m)
     H Kind: blank for a surveyed line, or Unsurveyed, Jump (no line), Boat traffic, Arrow
     I Note    J Drawing (rarely used: icon, label text and side, always draw..., as "name = value; name = value")
   - A title row starts a block: the line's name in A and nothing in C to F (e.g. "MAIN LINE"). Optional: without one
     the line is called "Line 1", "Line 2"... In B a title row can say "loop with <other line's name>" when two lines
     leave the same station and meet again: both are stretched and turned a little so they join up.
   - Before the first line, a row with only To and Depth is the starting point that every line is measured from.
   - To says what's at the end of the leg: "Rock" is a tie-off, "Stake" is a stake, anything else is a named station
     (a landmark on the map, e.g. "Pennant / T"). A From cell with a name names the point the leg starts from, so a
     plain tie-off can be named where a later line starts from it ("Rock / **").
   - A row with To but no heading or distance is something at the same spot as the row before (a landmark at a
     tie-off, say), or, as a block's first row, something at the station it starts from.
   - A patch of lines not joined to the rest yet (no line to it): on its first line's title row put "GPS" and the
     start station's coordinates in column B (e.g. "GPS N44.34465 W75.91859"). It's placed from the GPS, through the
     map's own GPS placement, until a line (or a Jump, for a phantom connection) joins it up.
   - Each block after the first starts From a named station already on the map. A block that ends at a named station
     already on the map is stretched and turned a little to meet it (as divers' compass and tape never quite close).
   - Heading and distance are as the divers measured them (magnetic). Backcourse, when given, is checked against the
     heading (they should differ by 180°). Only columns A to J are read: the rest of the sheet is free for notes.
   The Landmarks tab (optional, filled by "Get from website") keeps each named station's code on the website, so
   photos and layers stay attached when a station is renamed: Code, Name. */
(function (root) {
  "use strict";

  const PLAIN = { rock: "TieOff", "tie-off": "TieOff", tieoff: "TieOff", "tie off": "TieOff", stake: "Stake" };
  const KINDS = { "": "SurveyedLine", surveyed: "SurveyedLine", unsurveyed: "UnsurveyedLine", jump: "Jump", "boat traffic": "MarinaLine", arrow: "Arrow" };
  const KIND_NAME = { SurveyedLine: "", UnsurveyedLine: "Unsurveyed", Jump: "Jump", MarinaLine: "Boat traffic", Arrow: "Arrow" };
  const HEADER = ["From (A)", "To (B)", "Depth @ B", "Backcourse (Hdg B->A)", "Heading (A->B)", "Distance (ft)", "Distance (M)", "Kind", "Note", "Drawing"];
  // Drawing details: the name in the sheet, the field on the website, and whether it's a yes/no or a number.
  const DRAW = [["icon", "icon_path"], ["see-through icon", "transparent_icon", "yes"], ["depth label angle", "depth_angle", "num"],
    ["depth label distance", "depth_distance_zoom", "num"], ["always draw", "force_draw", "yes"], ["label", "alt_text"],
    ["label side", "flip_text_side", "side"], ["color", "color"], ["line note", "note"]];
  const LINE_DRAW = ["alt_text", "flip_text_side", "color"], POINT_DRAW = ["icon_path", "transparent_icon", "depth_angle", "depth_distance_zoom", "force_draw"];
  const str = v => (v == null ? "" : String(v)).trim();
  const num = v => { const s = str(v).replace(",", "."); if (s === "") return null; const n = Number(s); return isFinite(n) ? n : NaN; };
  const has = v => v != null && !isNaN(v);
  const plainOf = name => PLAIN[str(name).toLowerCase()] || null;
  const codeOf = name => str(name).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "POINT";
  const isHeader = row => /^from/i.test(str(row[0])) && /^to\b/i.test(str(row[1]));
  const geometry = () => root.SurveyGeometry || (typeof require === "function" ? require("./survey-geometry.js") : null);
  const GPS_TITLE = /^gps\b[\s:]*(.*)$/i;
  const round = (n, d) => Math.round(n * Math.pow(10, d)) / Math.pow(10, d);

  function parseDrawing(text, rowNo, errors) {
    const out = {};
    str(text).split(";").map(s => s.trim()).filter(Boolean).forEach(part => {
      const m = part.match(/^([^=]+?)\s*=\s*(.*)$/), d = m && DRAW.find(x => x[0] === m[1].toLowerCase());
      if (!d) { errors.push(`Row ${rowNo}: in Drawing, "${part}" isn't one of: ${DRAW.map(x => x[0]).join(", ")} (as "name = value").`); return; }
      let v = m[2].trim();
      if (d[2] === "yes") v = /^(yes|y|true|1)$/i.test(v);
      else if (d[2] === "num") { v = num(v); if (!has(v)) { errors.push(`Row ${rowNo}: in Drawing, ${d[0]} needs a number.`); return; } }
      else if (d[2] === "side") v = /^(left|flip|yes|true)$/i.test(v);
      out[d[1]] = v;
    });
    return out;
  }
  function writeDrawing(fields) {
    return DRAW.filter(d => fields[d[1]] !== undefined && fields[d[1]] !== "").map(d => {
      const v = fields[d[1]];
      return `${d[0]} = ${d[2] === "yes" ? (v ? "yes" : "no") : d[2] === "side" ? (v ? "left" : "right") : v}`;
    }).join("; ");
  }
  const pick = (obj, keys) => { const o = {}; keys.forEach(k => { if (obj[k] !== undefined) o[k] = obj[k]; }); return o; };

  // rows: the Survey tab as a 2D array (header rows are skipped). landmarkRows: the Landmarks tab [Code, Name], optional.
  // site: { id, title, ... } copied into the result. Returns { data, warnings, errors }: data is in the website's
  // format (runs, plan, landmarks, runNames, origin).
  function toSurvey(rows, landmarkRows, site) {
    const errors = [], warnings = [];
    const data = Object.assign({ id: "", title: "", place: "", subtitle: "", credit: "", version: "", surveyors: [] }, site || {},
      { origin: null, landmarks: {}, aliases: {}, runNames: {}, plan: [], runs: {} });
    const known = {};      // station name (lower case) -> code
    const codeFor = {};    // from the Landmarks tab: name (lower case) -> code on the website
    (landmarkRows || []).forEach(r => { const c = str(r[0]), n = str(r[1]); if (c && n && !/^code$/i.test(c)) codeFor[n.toLowerCase()] = c; });
    const nameStation = (name, rowNo) => {
      let code = codeFor[name.toLowerCase()] || codeOf(name);
      if (data.landmarks[code] && data.landmarks[code] !== name) {
        if (codeFor[name.toLowerCase()]) { errors.push(`Row ${rowNo}: "${name}" and "${data.landmarks[code]}" have the same code (${code}) in Landmarks.`); }
        else { let n = 2; while (data.landmarks[code + "_" + n]) n++; code = code + "_" + n; }
      }
      data.landmarks[code] = name; known[name.toLowerCase()] = code;
      return code;
    };

    // Split into blocks at blank rows.
    const blocks = []; let cur = null, originRow = null;
    rows.forEach((row, i) => {
      const r = Array.from({ length: 10 }, (_, k) => row[k]), rowNo = i + 1;
      if (isHeader(r)) { cur = null; return; }
      // Blank (a leftover 0 in Distance (m) from a formula counts as blank).
      if (r.slice(0, 6).every(v => str(v) === "") && (str(r[6]) === "" || num(r[6]) === 0) && r.slice(7).every(v => str(v) === "")) { cur = null; return; }
      if (!blocks.some(b => b.legs.length) && !originRow && !str(r[0]) && str(r[1]) && str(r[4]) === "" && str(r[5]) === "") { originRow = { r, rowNo }; return; }
      if (!cur) { cur = { title: "", loopWith: "", legs: [], firstRow: rowNo }; blocks.push(cur); }
      const isTitle = str(r[0]) && [2, 3, 4, 5, 7].every(k => str(r[k]) === "") && (!str(r[1]) || /^loop with /i.test(str(r[1])) || GPS_TITLE.test(str(r[1])));
      if (isTitle && !cur.legs.length && !cur.title) {
        cur.title = str(r[0]);
        const g = str(r[1]).match(GPS_TITLE);
        if (g) {
          const ll = geometry() && geometry().parseLatLon(g[1]);
          if (ll) cur.gps = { lat: ll[0], lon: ll[1] }; else errors.push(`Row ${rowNo}: "${str(r[1])}" isn't a GPS position I can read (try GPS N44.34465 W75.91859).`);
        } else cur.loopWith = str(r[1]).replace(/^loop with /i, "").trim();
        return;
      }
      cur.legs.push({ row: r, rowNo });
    });
    if (originRow) {
      data.origin = nameStation(str(originRow.r[1]), originRow.rowNo);
      const d = num(originRow.r[2]); if (has(d)) data.originPoint = { depth: d };
    }

    const usedIds = {};
    blocks.forEach((b, bi) => {
      const legs = b.legs;
      if (!legs.length) return;
      const name = b.title || `Line ${Object.keys(data.runs).length + 1}`;
      let id = name.replace(/['’]/g, "").replace(/[^A-Za-z0-9]+/g, " ").trim().split(" ").filter(Boolean).map(w => w[0].toUpperCase() + (/^[A-Z]{4,}$/.test(w) ? w.slice(1).toLowerCase() : w.slice(1))).join("") || "Line";
      if (/^[0-9]/.test(id)) id = "Line" + id;
      if (usedIds[id]) { let n = 2; while (usedIds[id + n]) n++; id = id + n; }
      usedIds[id] = true;
      const startName = str(legs[0].row[0]);
      if (!startName) { errors.push(`Row ${legs[0].rowNo}: say which station "${name}" starts From.`); return; }
      let start = known[startName.toLowerCase()];
      if (!start && !data.origin && bi === 0) { start = nameStation(startName, legs[0].rowNo); data.origin = start; }
      if (b.gps && start) warnings.push(`Row ${b.firstRow}: "${startName}" is already joined to the map, so the GPS on "${name}" isn't used. Take it off the title row.`);
      if (b.gps && !start && data.origin) {
        // Placed from the GPS: a hidden jump from the starting point, worked out when publishing (placeGps).
        start = nameStation(startName, legs[0].rowNo);
        const gid = "Gps" + id;
        data.runs[gid] = [{ type: "Jump", gps_lat: b.gps.lat, gps_lon: b.gps.lon }, { type: "SaveLandmark", landmark: start }];
        data.runNames[gid] = `${startName} (placed by GPS)`;
        data.plan.push({ mode: "draw", start: data.origin, run: gid });
      }
      if (!start) { errors.push(`Row ${legs[0].rowNo}: "${name}" starts From "${startName}", which isn't a named station earlier in the sheet.`); return; }
      const entries = [], knownAtStart = new Set(Object.values(known));
      legs.forEach(({ row: r, rowNo }, li) => {
        const from = str(r[0]), to = str(r[1]), kindName = str(r[7]).toLowerCase(), note = str(r[8]);
        const drawing = parseDrawing(r[9], rowNo, errors);
        // A named From on a later row names the point the previous row ended at.
        if (li > 0 && from && !plainOf(from)) {
          const last = entries[entries.length - 1];
          const already = last && last.landmark && data.landmarks[last.landmark] === from;
          if (!already) {
            if (known[from.toLowerCase()]) errors.push(`Row ${rowNo}: From "${from}" is a station somewhere else already, but the row above doesn't end there. Give this one a different name, or check the rows.`);
            else {
              const code = nameStation(from, rowNo), prevDepth = num(legs[li - 1].row[2]);
              if (last && last.type === "Stake" && !last.landmark) entries[entries.length - 1] = Object.assign({ type: "SavedStake", landmark: code }, pick(last, ["depth", "note"]));
              else entries.push(Object.assign({ type: "SaveLandmark", landmark: code }, has(prevDepth) ? { depth: prevDepth } : {}));
            }
          }
        }
        const type = KINDS[kindName];
        if (!type) { errors.push(`Row ${rowNo}: Kind "${str(r[7])}" isn't one of Unsurveyed, Jump, Boat traffic, Arrow (or blank for a surveyed line).`); return; }
        let hdg = num(r[4]); const bc = num(r[3]);
        let ft = num(r[5]); const m = num(r[6]);
        if (ft == null && has(m) && m !== 0) ft = round(m / 0.3048, 3);
        if (hdg == null && has(bc)) hdg = (bc + 180) % 360;
        const pointOnly = type === "SurveyedLine" && hdg == null && !ft;
        let lineNote = drawing.note; delete drawing.note;
        if (!pointOnly) {
          if (hdg == null || !has(hdg) || hdg < 0 || hdg > 360) { errors.push(`Row ${rowNo}: the heading "${str(r[4])}" isn't a compass heading (0 to 360).`); return; }
          if (type !== "Arrow" && (ft == null || !has(ft) || ft < 0)) { errors.push(`Row ${rowNo}: the distance "${str(r[5])}" isn't a number of feet.`); return; }
          if (has(bc)) {
            const off = Math.abs(((bc + 180 - hdg) % 360 + 540) % 360 - 180);
            if (off > 5) warnings.push(`Row ${rowNo}: heading ${hdg}° and backcourse ${bc}° are ${Math.round(off)}° off from opposite. Check them.`);
          }
          const line = { type };
          if (type === "Arrow") { line.angle = hdg; if (ft != null) line.distance = ft; }
          else {
            const whole = Math.floor(ft + 1e-9), inches = round((ft - whole) * 12, 2);
            if (whole || !inches) line.length_ft = whole;
            line.angle = hdg; if (inches) line.length_in = inches;
          }
          Object.assign(line, pick(drawing, LINE_DRAW));
          if (!to && note) lineNote = note;
          if (lineNote) line.note = lineNote;
          entries.push(line);
        }
        if (!to) return;
        // What's at the end of the leg (or at the same spot, for a row with no heading or distance).
        const depth = num(r[2]), plain = plainOf(to);
        const point = plain ? { type: plain } : { type: "SaveLandmark", landmark: known[to.toLowerCase()] || nameStation(to, rowNo) };
        if (has(depth)) point.depth = depth;
        Object.assign(point, pick(drawing, POINT_DRAW));
        if (note) point.note = note;
        entries.push(point);
      });
      data.runs[id] = entries; data.runNames[id] = name;
      // Two lines that leave the same station and meet again are drawn as a loop.
      if (b.loopWith) {
        const other = data.plan.find(p => data.runNames[p.run] && data.runNames[p.run].toLowerCase() === b.loopWith.toLowerCase());
        if (!other) errors.push(`Row ${b.firstRow}: "${name}" is a loop with "${b.loopWith}", which isn't a line above it.`);
        else if (other.start !== start) errors.push(`Row ${b.firstRow}: "${name}" and "${b.loopWith}" must start From the same station to make a loop.`);
        else { other.mode = "loop"; other.run2 = id; delete other.end; return; }
      }
      // A line that ends at a station already on the map before it started is stretched to meet it.
      const last = entries[entries.length - 1];
      if (last && last.type === "SaveLandmark" && last.landmark !== start && knownAtStart.has(last.landmark)) {
        if (Object.keys(last).length === 2) entries.pop();
        data.plan.push({ mode: "fit", start, run: id, end: last.landmark });
      } else data.plan.push({ mode: "draw", start, run: id });
    });
    // Stations listed in the Landmarks tab but not on any line (kept for the website's other layers).
    (landmarkRows || []).forEach(r => { const c = str(r[0]), n = str(r[1]); if (c && n && !/^code$/i.test(c) && !data.landmarks[c] && !known[n.toLowerCase()]) data.landmarks[c] = n; });
    if (!data.origin) errors.push("The sheet has no starting point: put it in To on the first row, with its depth.");
    return { data, warnings, errors };
  }

  // The other way: the website's survey as Survey tab rows (with a header) and Landmarks tab rows [Code, Name].
  function fromSurvey(data) {
    const rows = [HEADER.slice()], lm = data.landmarks || {}, name = code => lm[code] || code;
    const blank = () => ["", "", "", "", "", "", "", "", "", ""];
    const origin = data.origin || "BAR";
    const o = blank(); o[1] = name(origin); if (data.originPoint && data.originPoint.depth != null) o[2] = data.originPoint.depth; rows.push(o);
    const steps = [];
    const gpsAt = {};
    for (const p of data.plan || []) {
      const e = ((data.runs || {})[p.run]) || [];
      if (e.length === 2 && e[0].gps_lat != null && e[1].landmark) { gpsAt[e[1].landmark] = e[0]; continue; }
      steps.push({ run: p.run, start: p.start, end: p.mode === "fit" ? p.end : null }); if (p.run2) steps.push({ run: p.run2, start: p.start, loopWith: p.run });
    }
    for (const s of steps) {
      const entries = (data.runs || {})[s.run] || [];
      rows.push(blank());
      const t = blank(); t[0] = (data.runNames || {})[s.run] || s.run; if (s.loopWith) t[1] = "loop with " + ((data.runNames || {})[s.loopWith] || s.loopWith);
      const g = gpsAt[s.start]; if (g && !s.loopWith) { t[1] = `GPS ${g.gps_lat}, ${g.gps_lon}`; delete gpsAt[s.start]; }
      rows.push(t);
      let from = name(s.start), pending = null;
      const flush = () => {
        if (!pending) return;
        if (pending.lineNote) pending[8] = pending.lineNote;   // a line with nothing at its end: Note is the line's
        rows.push(pending); from = ""; pending = null;
      };
      for (const e of entries) {
        if (e.type in KIND_NAME) {
          flush();
          // A landmark at the tie-off just before: written the divers' way, as the From of this row instead.
          const prev = rows[rows.length - 1];
          if (prev && prev.soft && from === prev[1]) rows.pop();
          const row = blank(); row[0] = from;
          if (e.type === "Arrow") { row[4] = e.angle; row[5] = e.distance ?? ""; }
          else {
            const ft = (Number(e.length_ft) || 0) + (Number(e.length_in) || 0) / 12;
            row[3] = (Number(e.angle) + 180) % 360; row[4] = e.angle;
            row[5] = e.length_ft == null && !e.length_in ? "" : round(ft, 3); row[6] = row[5] === "" ? "" : round(ft * 0.3048, 3);
          }
          row[7] = KIND_NAME[e.type];
          row[9] = writeDrawing(pick(e, LINE_DRAW));
          if (e.note) row.lineNote = e.note;
          pending = row; from = "";
          if (e.type === "Arrow") flush();
          continue;
        }
        const word = e.type === "TieOff" ? "Rock" : e.type === "Stake" ? "Stake" : name(e.landmark);
        const extra = pick(e, POINT_DRAW);
        let row = pending && !pending[1] ? pending : null;
        if (!row) { flush(); row = blank(); row[0] = from; }
        pending = null;
        row[1] = e.type === "SavedStake" ? "Stake" : word;
        if (e.depth != null) row[2] = e.depth;
        if (e.note) row[8] = e.note;
        // Note is the point's, so the line's own note goes in Drawing as "line note".
        if (row.lineNote) extra.note = row.lineNote;
        const ex = writeDrawing(extra); if (ex) row[9] = row[9] ? row[9] + "; " + ex : ex;
        const before = rows[rows.length - 1];
        row.soft = e.type === "SaveLandmark" && row[4] === "" && row[0] && plainOf(row[0]) && !row[8] && !row[9] && before && before[1] === row[0] && String(before[2]) === String(row[2]);
        rows.push(row);
        from = e.type === "SavedStake" ? name(e.landmark) : row[1];
      }
      // A line drawn to fit a station already on the map ends there.
      if (s.end) {
        if (pending && !pending[1]) pending[1] = name(s.end);
        else { flush(); const row = blank(); row[0] = from; row[1] = name(s.end); rows.push(row); }
      }
      flush();
    }
    const lmRows = [["Code", "Name"]].concat(Object.keys(lm).map(k => [k, lm[k]]));
    return { rows, landmarkRows: lmRows };
  }

  // The map to publish: what the sheet says, on top of the website's current map. Things the sheet doesn't hold
  // (title, credits, GPS placement, lines set aside as not drawn) are kept from the website.
  function mergeInto(current, fromSheet) {
    const cur = current ? JSON.parse(JSON.stringify(current)) : {}, s = fromSheet, notes = [];
    const out = Object.assign(cur, { runs: Object.assign({}, s.runs), runNames: Object.assign({}, s.runNames), plan: s.plan, landmarks: Object.assign({}, s.landmarks), origin: s.origin });
    if (s.originPoint) out.originPoint = s.originPoint; else delete out.originPoint;
    out.unusedRuns = ((current && current.unusedRuns) || []).filter(id => current.runs && current.runs[id] && !(id in s.runs));
    out.unusedRuns.forEach(id => { out.runs[id] = current.runs[id]; if (current.runNames && current.runNames[id]) out.runNames[id] = current.runNames[id]; });
    if (!out.aliases) out.aliases = {};
    ["id", "title", "place", "subtitle", "credit", "version", "surveyors"].forEach(k => { if (out[k] === undefined && s[k] !== undefined) out[k] = s[k]; });
    const gpsProblems = placeGps(out);
    const gr = out.georef;
    if (gr && gr.landmark && !out.landmarks[gr.landmark]) notes.push(`The map is placed on the satellite from "${gr.landmark}", which isn't in the sheet any more. Place it again on the website (Map setup).`);
    if (gr && gr.landmark2 && !out.landmarks[gr.landmark2]) notes.push(`The map's second GPS point "${gr.landmark2}" isn't in the sheet any more.`);
    return { data: out, notes, errors: gpsProblems };
  }

  // Works out the hidden jumps of patches placed by GPS, from the map's own GPS placement (georef). Changes data;
  // returns problems as text.
  function placeGps(data) {
    const G = geometry(), problems = [];
    const ids = Object.keys(data.runs || {}).filter(k => data.runs[k][0] && data.runs[k][0].gps_lat != null);
    if (!ids.length) return problems;
    if (!data.georef || !G) { problems.push("Lines placed by GPS need the map placed on the satellite first (on the website: Map setup → Place on the earth)."); return problems; }
    // Positions without the GPS patches (they're drawn after the rest, so this doesn't change).
    const at = G.compute(data).at, gr = G.georef(data.georef, at), o = at[data.origin || "BAR"];
    if (!gr || !o) { problems.push("The map's GPS placement isn't complete, so lines placed by GPS can't be drawn."); return problems; }
    ids.forEach(id => {
      const j = data.runs[id][0], [x, y] = gr.toXY(j.gps_lat, j.gps_lon), dx = x - o[0], dy = y - o[1];
      const L = Math.hypot(dx, dy), ang = ((90 - Math.atan2(dy, dx) * 180 / Math.PI) % 360 + 360) % 360;
      j.length_ft = Math.floor(L); j.length_in = round((L - Math.floor(L)) * 12, 2); j.angle = round(ang, 4);
    });
    return problems;
  }

  // What changed, in a line, for the map's history.
  function describeChange(before, after) {
    const ft = d => { let t = 0; Object.keys((d && d.runs) || {}).forEach(k => (((d.unusedRuns || []).includes(k)) ? [] : d.runs[k]).forEach(e => { if (/Line$/.test(e.type)) t += (Number(e.length_ft) || 0) + (Number(e.length_in) || 0) / 12; })); return Math.round(t); };
    const names = d => new Set(((d && d.plan) || []).flatMap(p => [p.run, p.run2]).filter(r => r && !(((d.runs || {})[r] || [])[0] || {}).gps_lat));
    const b = names(before), a = names(after), added = [...a].filter(x => !b.has(x)), gone = [...b].filter(x => !a.has(x));
    const parts = [`${ft(after)} ft of line (was ${ft(before)})`];
    if (added.length) parts.push("new: " + added.map(x => after.runNames[x] || x).join(", "));
    if (gone.length) parts.push("removed: " + gone.map(x => (before.runNames || {})[x] || x).join(", "));
    return parts.join("; ");
  }

  const api = { toSurvey, fromSurvey, mergeInto, placeGps, describeChange, HEADER, codeOf };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SurveySheet = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);

/* Limitless Diving menu for a site map's Google Sheet: Get from website, Check the rows, Publish to website.
   The sheet is where big changes are made; the website's editor is for one or two quick fixes.
   How the rows are laid out: see survey-sheet.js (copied in above this part), or the sheet's "How to fill it in" tab.
   The website side is sheet_get_site_map / sheet_publish_site_map in supabase/schema.sql, opened with a private
   sheet key (Limitless Diving → Set up). */
const LD = {
  url: "https://tohabfygfsvcntarmfck.supabase.co",
  key: "sb_publishable_hLYAAHHOgtSbTIjOjr9GaQ_DxkefCDZ",   // the website's public key; the sheet key is the private one
  site: "https://limitless-diving.com/",
};
const SURVEY_TAB = "Survey", LANDMARKS_TAB = "Landmarks";

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Limitless Diving")
    .addItem("Get from website", "getFromWebsite")
    .addItem("Check the rows", "checkRows")
    .addItem("Publish to website", "publishToWebsite")
    .addSeparator()
    .addItem("Set up", "setUp")
    .addToUi();
}

function props_() { return PropertiesService.getDocumentProperties(); }
function settings_() {
  const p = props_(), site = p.getProperty("site"), key = p.getProperty("sheetKey");
  if (!site || !key) throw new Error("This sheet isn't linked to a site map yet. Use Limitless Diving → Set up first.");
  return { site, key };
}

function rpc_(name, args) {
  const res = UrlFetchApp.fetch(LD.url + "/rest/v1/rpc/" + name, {
    method: "post", contentType: "application/json", headers: { apikey: LD.key },
    payload: JSON.stringify(args), muteHttpExceptions: true,
  });
  const text = res.getContentText();
  let body; try { body = JSON.parse(text); } catch (e) { body = text; }
  if (res.getResponseCode() >= 300) throw new Error((body && body.message) || text || ("The website answered " + res.getResponseCode()));
  return body;
}

function setUp() {
  const ui = SpreadsheetApp.getUi(), p = props_();
  const a = ui.prompt("Link this sheet to a site map (1 of 2)",
    "Which site map? Type its short name, as in its web address: bonnie-castle for bonnie-castle-map.html, middle-earth, lake-hydra..." +
    (p.getProperty("site") ? "\n\nNow: " + p.getProperty("site") : ""), ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return;
  const site = a.getResponseText().trim().toLowerCase().replace(/-map\.html$/, "");
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(site)) { ui.alert("Use only small letters, numbers and dashes, like bonnie-castle."); return; }
  const b = ui.prompt("Link this sheet to a site map (2 of 2)",
    "Paste the sheet key (it starts with ldsheet_). Make one in Supabase → SQL editor with:\n\nselect public.make_site_map_sheet_key('Survey sheet');" +
    (p.getProperty("sheetKey") ? "\n\nLeave it empty to keep the key you set before." : ""), ui.ButtonSet.OK_CANCEL);
  if (b.getSelectedButton() !== ui.Button.OK) return;
  const key = b.getResponseText().trim() || p.getProperty("sheetKey") || "";
  try {
    const cur = rpc_("sheet_get_site_map", { sheet_key: key, site });
    p.setProperties({ site, sheetKey: key });
    p.deleteProperty("version");
    ui.alert(cur.data
      ? `Linked to ${site} (version ${cur.version} on the website). Use Get from website to fill the Survey tab from the map.`
      : `Linked to ${site}. There's no map for it on the website yet: fill in the Survey tab and use Publish to website.`);
  } catch (e) { ui.alert("That didn't work: " + e.message); }
}

function surveyTab_(make) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SURVEY_TAB);
  if (!sh && make) sh = ss.insertSheet(SURVEY_TAB, 0);
  return sh;
}
function readRows_() {
  const sh = surveyTab_(false);
  if (!sh) throw new Error(`There's no "${SURVEY_TAB}" tab. Rename your survey tab to ${SURVEY_TAB}, or use Get from website.`);
  const n = sh.getLastRow();
  const rows = n ? sh.getRange(1, 1, n, 10).getValues() : [];
  const lm = SpreadsheetApp.getActive().getSheetByName(LANDMARKS_TAB);
  const lmRows = lm && lm.getLastRow() ? lm.getRange(1, 1, lm.getLastRow(), 2).getValues() : [];
  return { rows, lmRows };
}

function checkRows() {
  const ui = SpreadsheetApp.getUi();
  try {
    const { rows, lmRows } = readRows_(), r = SurveySheet.toSurvey(rows, lmRows, {});
    const lines = r.data.plan.flatMap(p => [p.run, p.run2]).filter(Boolean).map(id => {
      const ft = r.data.runs[id].reduce((t, e) => t + (e.type === "SurveyedLine" ? (Number(e.length_ft) || 0) + (Number(e.length_in) || 0) / 12 : 0), 0);
      return `${r.data.runNames[id]}: ${Math.round(ft * 10) / 10} ft`;
    });
    ui.alert(r.errors.length ? "Fix these before publishing" : "The rows look right",
      list_(r.errors, "Problems") + list_(r.warnings, "Worth a look") + (lines.length ? "Surveyed line:\n" + lines.join("\n") : "No lines yet."), ui.ButtonSet.OK);
  } catch (e) { ui.alert(e.message); }
}
function list_(items, title) {
  if (!items.length) return "";
  return title + ":\n" + items.slice(0, 15).join("\n") + (items.length > 15 ? `\n...and ${items.length - 15} more` : "") + "\n\n";
}

function getFromWebsite() {
  const ui = SpreadsheetApp.getUi();
  try {
    const s = settings_(), cur = rpc_("sheet_get_site_map", { sheet_key: s.key, site: s.site });
    if (!cur.data) { ui.alert(`There's no map for ${s.site} on the website yet. Fill in the Survey tab and use Publish to website.`); return; }
    const sh = surveyTab_(true);
    if (sh.getLastRow() > 1 && ui.alert("Get from website",
      `This replaces columns A to J of the ${SURVEY_TAB} tab with the website's map (version ${cur.version}${cur.updated_by ? ", published by " + cur.updated_by : ""}). ` +
      "Anything there you haven't published will be lost. Your columns from L on stay as they are. Go ahead?", ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    const out = SurveySheet.fromSurvey(cur.data);
    const old = sh.getLastRow();
    if (old) sh.getRange(1, 1, old, 10).clearContent().setBackground(null).setFontWeight(null).setFontColor(null);
    sh.getRange(1, 1, out.rows.length, 10).setValues(out.rows);
    sh.getRange(1, 1, 1, 10).setBackground("#0B4F6C").setFontColor("#FFFFFF").setFontWeight("bold").setWrap(true);
    out.rows.forEach((r, i) => {
      if (i === 0) return;
      const title = r[0] && r.slice(2, 8).every(v => v === "") && (!r[1] || /^loop with /i.test(r[1]));
      if (title) sh.getRange(i + 1, 1, 1, 10).setBackground("#DCEEF5").setFontWeight("bold").setFontColor("#0B4F6C");
      else if (typeof r[5] === "number" && r[7] !== "Arrow") sh.getRange(i + 1, 7).setFormula(`=F${i + 1}*0.3048`).setNumberFormat("0.00");
    });
    sh.setFrozenRows(1);
    const kinds = SpreadsheetApp.newDataValidation().requireValueInList(["Unsurveyed", "Jump", "Boat traffic", "Arrow"], true).setAllowInvalid(false).build();
    sh.getRange(2, 8, Math.max(out.rows.length + 500, 1000), 1).setDataValidation(kinds);
    let lm = SpreadsheetApp.getActive().getSheetByName(LANDMARKS_TAB) || SpreadsheetApp.getActive().insertSheet(LANDMARKS_TAB);
    lm.getRange(1, 1, Math.max(lm.getLastRow(), 1), 2).clearContent();
    lm.getRange(1, 1, out.landmarkRows.length, 2).setValues(out.landmarkRows);
    lm.getRange(1, 1, 1, 2).setBackground("#0B4F6C").setFontColor("#FFFFFF").setFontWeight("bold");
    props_().setProperty("version", String(cur.version));
    ui.alert(`Got version ${cur.version} of ${s.site}: ${out.rows.length - 1} rows.`);
  } catch (e) { ui.alert(e.message); }
}

function publishToWebsite() {
  const ui = SpreadsheetApp.getUi();
  try {
    const s = settings_(), { rows, lmRows } = readRows_();
    const r = SurveySheet.toSurvey(rows, lmRows, { id: s.site });
    if (r.errors.length) { ui.alert("Not published: fix these first", list_(r.errors, "Problems"), ui.ButtonSet.OK); return; }
    if (r.warnings.length && ui.alert("Worth a look before publishing", list_(r.warnings, "Warnings") + "Publish anyway?", ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    const cur = rpc_("sheet_get_site_map", { sheet_key: s.key, site: s.site });
    const mine = props_().getProperty("version");
    if (cur.version && String(cur.version) !== mine && ui.alert("The map changed on the website",
      `The website has version ${cur.version}${cur.updated_by ? " (published by " + cur.updated_by + ")" : ""}` +
      (mine ? `, and this sheet was last in step with version ${mine}.` : ", and this sheet hasn't got it yet.") +
      " Publishing replaces the website's lines with this sheet's, so changes made on the website since then would be lost." +
      " To keep them, choose No, make a copy of this tab, use Get from website, and copy your new rows in.\n\nPublish anyway?", ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    const m = SurveySheet.mergeInto(cur.data, r.data);
    if (m.errors.length) { ui.alert("Not published", m.errors.join("\n"), ui.ButtonSet.OK); return; }
    const said = ui.prompt("Publish to website", "What changed? (shown in the map's history)\n\n" + (m.notes.length ? m.notes.join("\n") + "\n\n" : ""), ui.ButtonSet.OK_CANCEL);
    if (said.getSelectedButton() !== ui.Button.OK) return;
    const summary = (said.getResponseText().trim() ? said.getResponseText().trim() + " — " : "") + "from the Google Sheet: " + SurveySheet.describeChange(cur.data || {}, m.data);
    const v = rpc_("sheet_publish_site_map", { sheet_key: s.key, site: s.site, new_data: m.data, expected_version: cur.version || 0, summary });
    props_().setProperty("version", String(v));
    ui.alert(`Published version ${v}. See it at ${LD.site}${s.site}-map.html`);
  } catch (e) { ui.alert("Not published: " + e.message); }
}
