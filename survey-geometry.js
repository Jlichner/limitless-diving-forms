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

  const LINE_TYPES = { SurveyedLine: "surveyed", UnsurveyedLine: "unsurveyed", RemovedLine: "removed", MarinaLine: "marina", PlatformLine: "platform" };
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
            if (lineType !== "platform") out.totalSurveyedFt += L;
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
    // at[...] is where the survey puts the landmark; gr.at / gr.at2 are where it was when the map was placed, kept
    // for members who can't see the layer that landmark is in.
    const known = v => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) ? v : null;
    const p = (at && at[gr.landmark]) || known(gr.at);
    if (!p) return null;
    const R = 6378137, FT = 0.3048, rad = PI / 180, lat0 = Number(gr.lat), lon0 = Number(gr.lon), cos0 = Math.cos(lat0 * rad);
    const enu = (lat, lon) => [(lon - lon0) * rad * R * cos0, (lat - lat0) * rad * R];
    // ENU metres = k × (feet from the landmark), with k a complex number (turn and scale).
    let kr = null, ki = null, twoPoint = false;
    const p2 = gr.landmark2 && ((at && at[gr.landmark2]) || known(gr.at2));
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

  // Note where the placing landmarks are (from data with every layer in it) on data.georef, so the map can still be
  // placed for members who can't see the layer a landmark is in. Changes data; returns it.
  function stampGeoref(data, full) {
    const gr = data && data.georef;
    if (!gr) return data;
    const at = compute(full || data).at, r = v => [Math.round(v[0] * 1000) / 1000, Math.round(v[1] * 1000) / 1000];
    const g2 = Object.assign({}, gr);
    if (at[gr.landmark]) g2.at = r(at[gr.landmark]);
    if (gr.landmark2 && at[gr.landmark2]) g2.at2 = r(at[gr.landmark2]); else delete g2.at2;
    data.georef = g2;
    return data;
  }
  const api = { compute, extras, radians, georef, stampGeoref, parseCoord, parseLatLon };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SurveyGeometry = api;
})(typeof window !== "undefined" ? window : globalThis);
