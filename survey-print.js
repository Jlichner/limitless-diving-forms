/* Limitless Diving — Print map: an official-looking PDF of a site map (on each site map page, e.g. bonnie-castle-map.html).
   Admins and Dive site admins only. Opens a setup page over the map: which levels to show, the background picture
   layer (the USGS topo by default), paper size, title block text, and the "map bottom": two points tapped along the
   shore, so the map is turned with the shoreline along the bottom of the sheet (the north arrow shows true north).
   The sheet is drawn as SVG; "Download PDF" turns it into a PDF with jsPDF + svg2pdf.js. Settings are saved with the
   map (data.print). Uses SurveyMap (survey-map.js), SurveyGeometry, SURVEY_ICONS and LDCloud. */
(window.SurveyMap ? window.SurveyMap.ready : Promise.resolve()).then(function () {
  "use strict";
  const S = window.SurveyMap, G = window.SurveyGeometry, C = window.LDCloud, ICONS = window.SURVEY_ICONS || {};
  if (!S || !S.map || !G) return;
  const esc = S.esc, site = S.site;
  const btn = document.getElementById("sm-print-btn");
  if (!btn) return;
  const allowed = () => S.isSiteAdmin();
  btn.hidden = !allowed();

  const RANK = { green: 1, blue: 2, black: 3, "double-black": 4 };
  const LEVEL_SETS = [
    { id: "green", label: "Green circle only" },
    { id: "blue", label: "Green and blue square" },
    { id: "black", label: "Up to black diamond" },
    { id: "double-black", label: "All levels" },
  ];
  const LEVEL_TEXT = { green: "Green circle", blue: "Green circle and blue square", black: "Green circle, blue square and black diamond", "double-black": "All levels" };
  const PAPER = {
    letter: { label: "Letter, 11 × 8.5 in", w: 792, h: 612 },
    tabloid: { label: "Tabloid, 17 × 11 in", w: 1224, h: 792 },
    archd: { label: "Poster, 36 × 24 in", w: 2592, h: 1728 },
  };
  const SERIF = "Times, 'Times New Roman', serif", SANS = "Helvetica, Arial, sans-serif";
  const RATING_COLOR = { blue: "#1c7ed6", black: "#111111", "double-black": "#111111" };
  const MOORING = "icons/mooringblock.png";

  const st = { open: false, picking: null, busy: false, msg: null, set: null };
  const say = (t, kind) => { st.msg = t ? { t, kind: kind || "" } : null; };

  function defaults() {
    const p = (S.data && S.data.print) || {};
    const pics = imageLayers();
    const usgs = pics.find(l => /usgs|topo/i.test(l.name)) || pics[0];
    const meta = (window.SITE_MAPS || {})[site] || {};
    return {
      levels: p.levels || "double-black",
      background: p.background != null ? p.background : (usgs ? usgs.id : ""),
      bgOpacity: p.bgOpacity != null ? p.bgOpacity : 0.6,
      paper: PAPER[p.paper] ? p.paper : "tabloid",
      title: p.title || S.data.title || "",
      place: p.place != null ? p.place : (S.data.place || ""),
      notes: p.notes != null ? p.notes : "Lengths and headings are as the divers measured them; routes that meet again are stretched slightly to join. Dive within your training.",
      credit: p.credit != null ? p.credit : (meta.creditText || ((S.data.surveyors || []).length ? `Surveyed by ${S.data.surveyors.join(", ")}.` : "")),
      bottom: Array.isArray(p.bottom) && p.bottom.length === 2 ? p.bottom : null,
      names: p.names !== false, depths: p.depths !== false, points: p.points !== false, moorings: p.moorings !== false,
    };
  }
  function imageLayers() { return (S.layers || []).filter(l => l.kind === "image" && l.imageUrl && l.bounds); }

  // The survey with the rated layers up to the chosen level added on, and which layer each run came from.
  function surveyFor(levels) {
    const max = RANK[levels] || 4, d0 = S.data;
    const out = Object.assign({}, d0, { runs: Object.assign({}, d0.runs), plan: (d0.plan || []).slice(), landmarks: Object.assign({}, d0.landmarks), runNames: Object.assign({}, d0.runNames) });
    const ratingOf = {};
    for (const l of (S.layers || []).filter(x => x.kind === "survey" && x.survey && x.survey.runs)) {
      if (l.rating ? RANK[l.rating] > max : levels !== "double-black") continue;
      for (const [k, v] of Object.entries(l.survey.runs)) { if (out.runs[k]) continue; out.runs[k] = v; if (l.rating) ratingOf[k] = l.rating; }
      Object.assign(out.landmarks, l.survey.landmarks || {}); Object.assign(out.runNames, l.survey.runNames || {});
      for (const s of l.survey.plan || []) if (l.survey.runs[s.run] && out.runs[s.run] === l.survey.runs[s.run]) out.plan.push(s);
    }
    return { data: out, ratingOf };
  }

  // Which way is true north in survey coordinates (feet, y up): from the map's GPS placement, else straight up.
  function northVector() {
    const gr = S.data.georef;
    if (S.geoRef() && gr && isFinite(Number(gr.lat)) && isFinite(Number(gr.lon))) {
      const a = S.toXY(Number(gr.lat), Number(gr.lon)), b = S.toXY(Number(gr.lat) + 0.001, Number(gr.lon));
      const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy);
      if (n > 0) return { v: [dx / n, dy / n], true: true };
    }
    return { v: [0, 1], true: false };
  }

  // ----- drawing the sheet -----
  // Returns { svg, frame } where frame maps between survey feet and sheet points (for tapping the shore).
  function sheet(set) {
    const paper = PAPER[set.paper], W = paper.w, H = paper.h, f = Math.min(W / 1224, H / 792);
    const u = v => +(v * f).toFixed(2);
    const M = u(30), gap = u(12);
    // The map fills the top; the title block, legend and notes sit side by side in a strip along the bottom.
    const stripH = u(150), inner = W - 2 * M - u(16);
    const map = { x: M + u(8), y: M + u(8), w: inner, h: H - 2 * M - u(16) - stripH - gap };
    const strip = { x: map.x, y: map.y + map.h + gap, w: inner, h: stripH };
    const { data, ratingOf } = surveyFor(set.levels);
    const geo = G.compute(data);
    // The turn: the tapped shore line runs left to right along the bottom.
    const nv = northVector();
    let r = Math.atan2(nv.v[0], nv.v[1]);   // not set: true north straight up
    if (set.bottom) {
      const [[ax, ay], [bx, by]] = set.bottom;
      r = -Math.atan2(by - ay, bx - ax);
    }
    const pts = geo.segments.flatMap(s => [[s.x0, s.y0], [s.x1, s.y1]]).concat(geo.landmarks.map(l => [l.x, l.y]));
    if (!pts.length) pts.push([0, 0]);
    const cr = Math.cos(r), sr = Math.sin(r);
    const turn = (x, y) => [x * cr - y * sr, x * sr + y * cr];
    if (set.bottom) {   // keep the shore below the survey: if it ends up above, turn half a circle more
      const shoreY = turn(...set.bottom[0])[1], midY = pts.map(p => turn(p[0], p[1])[1]).reduce((a, b) => a + b, 0) / pts.length;
      if (shoreY > midY) { r += Math.PI; }
    }
    const c2 = Math.cos(r), s2 = Math.sin(r), T = (x, y) => [x * c2 - y * s2, x * s2 + y * c2];
    const tp = pts.map(p => T(p[0], p[1])), xs = tp.map(p => p[0]), ys = tp.map(p => p[1]);
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (set.bottom) for (const p of set.bottom) { const q = T(p[0], p[1]); y0 = Math.min(y0, q[1]); }
    const pad = u(46);
    const k = Math.min((map.w - 2 * pad) / Math.max(x1 - x0, 1), (map.h - 2 * pad) / Math.max(y1 - y0, 1));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const P = (x, y) => { const [a, b] = T(x, y); return [map.x + map.w / 2 + (a - cx) * k, map.y + map.h / 2 - (b - cy) * k]; };
    const unP = (px, py) => { const a = (px - map.x - map.w / 2) / k + cx, b = -(py - map.y - map.h / 2) / k + cy; return [a * c2 + b * s2, -a * s2 + b * c2]; };
    const n = (v, d = 1) => (+v).toFixed(d);
    const o = [];
    const el = (t, a, inner) => `<${t} ${Object.entries(a).filter(([, v]) => v != null).map(([k2, v]) => `${k2}="${typeof v === "string" ? esc(v) : v}"`).join(" ")}${inner == null ? "/>" : `>${inner}</${t}>`}`;
    const text = (x, y, s, size, extra) => el("text", Object.assign({ x: n(x), y: n(y), "font-size": n(size), "font-family": SANS, fill: "#1b1b1b" }, extra || {}), esc(s));
    const ink = "#1b1b1b";

    o.push(el("rect", { x: 0, y: 0, width: W, height: H, fill: "#ffffff" }));
    o.push(el("rect", { x: M, y: M, width: n(W - 2 * M), height: n(H - 2 * M), fill: "none", stroke: ink, "stroke-width": n(u(2.2)) }));
    o.push(el("rect", { x: n(M + u(4)), y: n(M + u(4)), width: n(W - 2 * M - u(8)), height: n(H - 2 * M - u(8)), fill: "none", stroke: ink, "stroke-width": n(u(0.7)) }));
    o.push(`<defs><clipPath id="pm-clip"><rect x="${n(map.x)}" y="${n(map.y)}" width="${n(map.w)}" height="${n(map.h)}"/></clipPath></defs>`);
    o.push(el("rect", { x: n(map.x), y: n(map.y), width: n(map.w), height: n(map.h), fill: "#fbfaf6" }));
    // Background picture layer, drawn between its three corners.
    const bg = imageLayers().find(l => l.id === set.background);
    if (bg) {
      const cs = S.imageCorners(bg.bounds);
      if (cs) {
        const [tl, tr, bl] = cs.map(c => P(...S.toXY(c.lat, c.lng)));
        o.push(`<g clip-path="url(#pm-clip)"><image href="${esc(bg.printHref || bg.imageUrl)}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" opacity="${n(set.bgOpacity, 2)}" transform="matrix(${n(tr[0] - tl[0], 3)} ${n(tr[1] - tl[1], 3)} ${n(bl[0] - tl[0], 3)} ${n(bl[1] - tl[1], 3)} ${n(tl[0], 3)} ${n(tl[1], 3)})"/></g>`);
      }
    }
    // Lines.
    const LK = { surveyed: { w: 1.5 }, unsurveyed: { w: 1.2, dash: [6, 4] }, removed: { w: 1, dash: [2, 3], c: "#9aa0a3" }, marina: { w: 1.8, dash: [8, 3, 2, 3], c: "#c92a2a" } };
    const lines = [];
    for (const sg of geo.segments) {
      const lk = LK[sg.kind]; if (!lk) continue;
      const [a, b] = P(sg.x0, sg.y0), [c3, d3] = P(sg.x1, sg.y1);
      const col = lk.c || (ratingOf[sg.run] && sg.kind !== "removed" ? RATING_COLOR[ratingOf[sg.run]] : ink);
      lines.push(el("line", { x1: n(a), y1: n(b), x2: n(c3), y2: n(d3), stroke: col, "stroke-width": n(u(lk.w)), "stroke-linecap": "round", "stroke-dasharray": lk.dash ? lk.dash.map(u).join(" ") : null }));
    }
    o.push(`<g clip-path="url(#pm-clip)">${lines.join("")}</g>`);
    // Difficulty symbol on the middle line of each rated run.
    const byRun = {};
    geo.segments.forEach(sg => { if (ratingOf[sg.run] && sg.kind !== "removed") (byRun[sg.run] = byRun[sg.run] || []).push(sg); });
    const sym = (rid, x, y, z) => {
      if (rid === "blue") return el("rect", { x: n(x - z / 2), y: n(y - z / 2), width: n(z), height: n(z), fill: "#1c7ed6", stroke: "#fff", "stroke-width": n(u(0.8)) });
      const dia = cx2 => `M${n(cx2)} ${n(y - z * 0.6)} L${n(cx2 + z * 0.6)} ${n(y)} L${n(cx2)} ${n(y + z * 0.6)} L${n(cx2 - z * 0.6)} ${n(y)} Z`;
      if (rid === "black") return el("path", { d: dia(x), fill: "#111", stroke: "#fff", "stroke-width": n(u(0.8)) });
      if (rid === "double-black") return el("path", { d: dia(x - z * 0.6) + " " + dia(x + z * 0.6), fill: "#111", stroke: "#fff", "stroke-width": n(u(0.8)) });
      return el("circle", { cx: n(x), cy: n(y), r: n(z / 2), fill: "#2b8a3e", stroke: "#fff", "stroke-width": n(u(0.8)) });
    };
    for (const [run, segs] of Object.entries(byRun)) {
      const sg = segs[Math.floor(segs.length / 2)], [a, b] = P((sg.x0 + sg.x1) / 2, (sg.y0 + sg.y1) / 2);
      o.push(sym(ratingOf[run], a, b, u(9)));
    }
    if (set.points) {
      for (const p of geo.stakes.filter(p => p.kind === "stake")) { const [a, b] = P(p.x, p.y); o.push(el("rect", { x: n(a - u(1.8)), y: n(b - u(1.8)), width: n(u(3.6)), height: n(u(3.6)), fill: "#8b3a1f" })); }
      for (const p of geo.tieoffs) { const [a, b] = P(p.x, p.y); o.push(el("circle", { cx: n(a), cy: n(b), r: n(u(1.8)), fill: "#c2255c" })); }
    }
    if (set.depths) for (const dp of geo.depths || []) {
      const [a, b] = P(dp.x, dp.y);
      o.push(text(a + u(5), b - u(4), `${dp.depth}'`, u(7.5), { "font-family": SANS, fill: "#0b4f6c" }));
    }
    // Landmarks: icon in a white box, name beside it.
    for (const l of geo.landmarks) {
      if (l.origin && !l.icon) continue;
      const [a, b] = P(l.x, l.y), name = S.name(l.landmark);
      if (l.icon === MOORING) {
        if (!set.moorings) continue;
        o.push(el("rect", { x: n(a - u(4)), y: n(b - u(3)), width: n(u(8)), height: n(u(6)), fill: "#b9c3c7", stroke: "#5f6d73", "stroke-width": n(u(0.6)) }));
        continue;
      }
      const ic = l.icon && ICONS[l.icon], z = u(14);
      if (ic) {
        o.push(el("rect", { x: n(a - z / 2), y: n(b - z / 2), width: n(z), height: n(z), rx: n(u(2)), fill: "#ffffff", stroke: ink, "stroke-width": n(u(0.6)) }));
        if (ic.png) o.push(el("image", { href: ic.png, x: n(a - z * 0.42), y: n(b - z * 0.42), width: n(z * 0.84), height: n(z * 0.84) }));
        else o.push(`<g transform="translate(${n(a - z * 0.42)},${n(b - z * 0.42)}) scale(${n(z * 0.84 / 24, 4)})" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ic.svg.replace(/<svg[^>]*>|<\/svg>/g, "").replace(/currentColor/g, ink)}</g>`);
      } else o.push(el("circle", { cx: n(a), cy: n(b), r: n(u(3)), fill: "#ffffff", stroke: "#0f7c8c", "stroke-width": n(u(1.2)) }));
      if (set.names && name) {
        const tx = a + (ic ? z / 2 + u(3) : u(5)), ty = b + u(3);
        o.push(text(tx, ty, name, u(8.5), { stroke: "#ffffff", "stroke-width": n(u(2.2)), "stroke-linejoin": "round" }));
        o.push(text(tx, ty, name, u(8.5)));
      }
    }
    // The tapped shore line while setting it up (not printed once Download is pressed).
    if (!st.forPrint && (st.picking || st.showBottom)) {
      const ptsB = st.picking ? st.picking : (set.bottom || []);
      ptsB.forEach(p => { const [a, b] = P(p[0], p[1]); o.push(el("circle", { cx: n(a), cy: n(b), r: n(u(5)), fill: "#e8590c", stroke: "#fff", "stroke-width": n(u(1.2)), "data-preview": "1" })); });
      if (ptsB.length === 2) { const [a, b] = P(...ptsB[0]), [c3, d3] = P(...ptsB[1]); o.push(el("line", { x1: n(a), y1: n(b), x2: n(c3), y2: n(d3), stroke: "#e8590c", "stroke-width": n(u(2)), "stroke-dasharray": `${u(6)} ${u(4)}`, "data-preview": "1" })); }
    }
    o.push(el("rect", { x: n(map.x), y: n(map.y), width: n(map.w), height: n(map.h), fill: "none", stroke: ink, "stroke-width": n(u(1)) }));
    // North arrow, turned with the map.
    const [nx, ny] = T(nv.v[0], nv.v[1]), ang = Math.atan2(nx, ny) * 180 / Math.PI;
    const na = { x: map.x + map.w - u(44), y: map.y + u(50) }, R = u(24);
    o.push(el("circle", { cx: n(na.x), cy: n(na.y), r: n(R), fill: "#ffffff", stroke: ink, "stroke-width": n(u(0.9)) }));
    o.push(`<g transform="translate(${n(na.x)},${n(na.y)}) rotate(${n(ang)})">${el("path", { d: `M0 ${n(-R * 0.86)} L${n(R * 0.26)} ${n(R * 0.2)} L0 0 Z`, fill: ink })}${el("path", { d: `M0 ${n(-R * 0.86)} L${n(-R * 0.26)} ${n(R * 0.2)} L0 0 Z`, fill: "#ffffff", stroke: ink, "stroke-width": n(u(0.7)) })}${el("path", { d: `M0 ${n(R * 0.86)} L${n(R * 0.18)} ${n(R * 0.2)} L${n(-R * 0.18)} ${n(R * 0.2)} Z`, fill: "#ffffff", stroke: ink, "stroke-width": n(u(0.6)) })}${text(0, -R - u(4), "N", u(11), { "text-anchor": "middle", "font-family": SERIF, "font-weight": "bold" })}</g>`);
    const turned = Math.round(((-ang % 360) + 540) % 360 - 180);
    o.push(text(na.x, na.y + R + u(14), nv.true ? "True north" : "North (magnetic)", u(8), { "text-anchor": "middle" }));
    if (turned) o.push(text(na.x, na.y + R + u(24), `Map turned ${Math.abs(turned)}°`, u(8), { "text-anchor": "middle" }));
    // Scale bar in feet.
    const want = (map.w * 0.22) / k, steps = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
    const total = steps.filter(v => v <= want).pop() || steps[0], seg = total / 4, px = seg * k;
    const sb = { x: map.x + map.w - u(44) - 4 * px, y: map.y + map.h - u(26) };
    o.push(el("rect", { x: n(sb.x - u(8)), y: n(sb.y - u(16)), width: n(4 * px + u(44)), height: n(u(28)), fill: "#ffffff", "fill-opacity": 0.85 }));
    for (let i = 0; i < 4; i++) o.push(el("rect", { x: n(sb.x + i * px), y: n(sb.y), width: n(px), height: n(u(5)), fill: i % 2 ? "#ffffff" : ink, stroke: ink, "stroke-width": n(u(0.7)) }));
    for (let i = 0; i <= 4; i++) o.push(text(sb.x + i * px, sb.y - u(3), String(+(i * seg).toFixed(1)), u(7.5), { "text-anchor": "middle" }));
    o.push(text(sb.x + 4 * px + u(5), sb.y + u(5), "feet", u(7.5)));
    if (bg) o.push(text(map.x + u(8), map.y + map.h - u(8), `Background: ${bg.name}`, u(7), { fill: "#555555" }));

    // Bottom strip: notes and credits | legend | title block (bottom right, as on a chart).
    const colW = (strip.w - 2 * gap) / 3, sy = strip.y, sh = strip.h;
    const cols = [0, 1, 2].map(i => strip.x + i * (colW + gap));
    const frame2 = x => o.push(el("rect", { x: n(x), y: n(sy), width: n(colW), height: n(sh), fill: "none", stroke: ink, "stroke-width": n(u(0.9)) }));
    const wrapLines = (s, size, width) => {
      const out = []; let ln = "";
      for (const w of String(s || "").split(/\s+/).filter(Boolean)) { const t = ln ? ln + " " + w : w; if (t.length * size * 0.5 > width && ln) { out.push(ln); ln = w; } else ln = t; }
      if (ln) out.push(ln); return out;
    };
    const pad2 = u(10), tw = colW - 2 * pad2;
    // Notes and credits (left).
    let cx0 = cols[0]; frame2(cx0);
    let ny2 = sy + u(17);
    o.push(text(cx0 + pad2, ny2, "NOT FOR NAVIGATION", u(9.5), { "font-weight": "bold" }));
    const body = wrapLines(set.notes, u(7.5), tw), cred = wrapLines(set.credit, u(7.5), tw);
    const room = sy + sh - u(20);
    body.forEach(t => { ny2 += u(10); if (ny2 < room) o.push(text(cx0 + pad2, ny2, t, u(7.5))); });
    if (cred.length) ny2 += u(5);
    cred.forEach(t => { ny2 += u(10); if (ny2 < room) o.push(text(cx0 + pad2, ny2, t, u(7.5))); });
    o.push(text(cx0 + pad2, sy + sh - u(8), /©/.test(set.credit || "") ? "limitless-diving.com" : "© " + new Date().getFullYear() + " Jamie M Lichner · limitless-diving.com", u(7.5)));
    // Legend (middle): only what is on this sheet, in as many columns as it needs.
    const kinds = new Set(geo.segments.map(s => s.kind)), ratings = new Set(Object.values(ratingOf));
    const rows = [];
    const lineRow = (lk, label) => rows.push([(x, yy) => el("line", { x1: n(x), y1: n(yy), x2: n(x + u(22)), y2: n(yy), stroke: lk.c || ink, "stroke-width": n(u(lk.w)), "stroke-dasharray": lk.dash ? lk.dash.map(u).join(" ") : null }), label]);
    if (kinds.has("surveyed")) lineRow(LK.surveyed, "Surveyed line");
    if (kinds.has("unsurveyed")) lineRow(LK.unsurveyed, "Unsurveyed line");
    if (kinds.has("removed")) lineRow(LK.removed, "Removed line");
    if (kinds.has("marina")) lineRow(LK.marina, "Boat traffic overhead");
    if (set.points && geo.stakes.some(p => p.kind === "stake")) rows.push([(x, yy) => el("rect", { x: n(x + u(9)), y: n(yy - u(2)), width: n(u(4)), height: n(u(4)), fill: "#8b3a1f" }), "Stake"]);
    if (set.points && geo.tieoffs.length) rows.push([(x, yy) => el("circle", { cx: n(x + u(11)), cy: n(yy), r: n(u(2)), fill: "#c2255c" }), "Tie-off"]);
    if (set.moorings && geo.landmarks.some(l => l.icon === MOORING)) rows.push([(x, yy) => el("rect", { x: n(x + u(7)), y: n(yy - u(3)), width: n(u(8)), height: n(u(6)), fill: "#b9c3c7", stroke: "#5f6d73", "stroke-width": n(u(0.6)) }), "Mooring block"]);
    rows.push([(x, yy) => sym("green", x + u(11), yy, u(9)), "Green circle · open water"]);
    if (ratings.has("blue")) rows.push([(x, yy) => sym("blue", x + u(11), yy, u(9)), "Blue square · advanced"]);
    if (ratings.has("black")) rows.push([(x, yy) => sym("black", x + u(11), yy, u(9)), "Black diamond · tech"]);
    if (ratings.has("double-black")) rows.push([(x, yy) => sym("double-black", x + u(11), yy, u(8)), "Double black · tech on scooters"]);
    if (set.depths) rows.push([(x, yy) => text(x + u(3), yy + u(3), "66'", u(8), { fill: "#0b4f6c" }), "Depth in feet"]);
    if (bg) rows.push([(x, yy) => el("rect", { x: n(x + u(2)), y: n(yy - u(5)), width: n(u(18)), height: n(u(10)), fill: "#e8e0c8", stroke: ink, "stroke-width": n(u(0.4)) }), `Background: ${bg.name}`]);
    cx0 = cols[1]; frame2(cx0);
    o.push(text(cx0 + pad2, sy + u(18), "Legend", u(12), { "font-family": SERIF, "font-weight": "bold" }));
    const rowH = u(13.5), perCol = Math.max(1, Math.floor((sh - u(32)) / rowH)), lcols = Math.ceil(rows.length / perCol), lw = (colW - 2 * pad2) / lcols;
    rows.forEach(([draw, label], i) => {
      const x = cx0 + pad2 + Math.floor(i / perCol) * lw, yy = sy + u(33) + (i % perCol) * rowH;
      o.push(draw(x, yy)); o.push(text(x + u(28), yy + u(3), label, u(lcols > 1 ? 7.5 : 8.5)));
    });
    // Title block (right).
    cx0 = cols[2]; frame2(cx0);
    o.push(text(cx0 + pad2, sy + u(16), "LIMITLESS DIVING · SITE SURVEY", u(7.5), { "letter-spacing": n(u(1.2)), fill: "#444444" }));
    const titleLines = wrapLines(set.title, u(20), tw).slice(0, 2), placeLines = wrapLines(set.place, u(10.5), tw).slice(0, 2);
    let ty = sy + u(22);
    titleLines.forEach(t => { ty += u(21); o.push(text(cx0 + pad2, ty, t, u(20), { "font-family": SERIF, "font-weight": "bold" })); });
    placeLines.forEach(t => { ty += u(13); o.push(text(cx0 + pad2, ty, t, u(10.5), { "font-family": SERIF })); });
    const ly = sy + sh - u(36);
    o.push(el("line", { x1: n(cx0 + pad2), y1: n(ly), x2: n(cx0 + colW - pad2), y2: n(ly), stroke: ink, "stroke-width": n(u(0.5)) }));
    const when = new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    o.push(text(cx0 + pad2, ly + u(13), `Version ${S.version || 0} · Printed ${when}`, u(8)));
    o.push(text(cx0 + pad2, ly + u(25), `Lines shown: ${LEVEL_TEXT[set.levels]}`, u(8)));

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${o.join("")}</svg>`;
    return { svg, W, H, map, unP };
  }

  // ----- the setup page -----
  const box = document.createElement("div");
  box.className = "pm-overlay"; box.hidden = true;
  document.body.appendChild(box);
  let frame = null;

  function render() {
    if (!st.open) { box.hidden = true; document.body.classList.remove("pm-open"); return; }
    box.hidden = false; document.body.classList.add("pm-open");
    const set = st.set, pics = imageLayers();
    const sh = sheet(set); frame = sh;
    box.innerHTML = `<div class="pm-page" role="dialog" aria-modal="true" aria-labelledby="pm-h">
      <aside class="pm-side">
        <div class="se-head"><h2 class="sec" id="pm-h">Print map</h2><button type="button" class="btn" data-pm="close">Close</button></div>
        ${st.msg ? `<p class="${st.msg.kind === "bad" ? "se-err" : "se-ok"}">${esc(st.msg.t)}</p>` : ""}
        <label class="pm-f">Lines to show <select data-k="levels">${LEVEL_SETS.map(l => `<option value="${l.id}"${l.id === set.levels ? " selected" : ""}>${esc(l.label)}</option>`).join("")}</select></label>
        <label class="pm-f">Background <select data-k="background"><option value="">Plain paper</option>${pics.map(l => `<option value="${esc(l.id)}"${l.id === set.background ? " selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label>
        ${set.background ? `<label class="pm-f">Background strength <input type="range" min="15" max="100" step="5" data-k="bgOpacity" value="${Math.round(set.bgOpacity * 100)}"> <output>${Math.round(set.bgOpacity * 100)}%</output></label>` : ""}
        ${!pics.length ? `<p class="hint">Add your USGS map as a picture layer (Map setup → Layers) to print it as the background.</p>` : ""}
        <label class="pm-f">Paper <select data-k="paper">${Object.entries(PAPER).map(([id, p]) => `<option value="${id}"${id === set.paper ? " selected" : ""}>${esc(p.label)}</option>`).join("")}</select></label>
        <fieldset class="pm-fs"><legend>Map bottom (the shoreline)</legend>
          ${st.picking ? `<p class="se-pick">Tap ${st.picking.length ? "a second point" : "a point"} along the shore on the sheet.</p><button type="button" class="btn" data-pm="pick-cancel">Cancel</button>`
            : `<p class="hint">${set.bottom ? "Set: the map is turned so the line between your two points runs along the bottom." : "Not set: north is up. Tap two points along the shore to turn the map so the shoreline runs along the bottom."}</p>
              <button type="button" class="btn" data-pm="pick">${set.bottom ? "Tap the shore again" : "Tap two points along the shore"}</button>
              ${set.bottom ? `<button type="button" class="btn" data-pm="pick-clear">North up instead</button>` : ""}`}
        </fieldset>
        <fieldset class="pm-fs"><legend>Show</legend>
          ${[["names", "Landmark names"], ["depths", "Depths"], ["points", "Stakes and tie-offs"], ["moorings", "Mooring blocks"]].map(([k2, l]) => `<label class="sm-check"><input type="checkbox" data-k="${k2}"${set[k2] ? " checked" : ""}> ${l}</label>`).join("")}
        </fieldset>
        <label class="pm-f">Title <input data-k="title" maxlength="80" value="${esc(set.title)}"></label>
        <label class="pm-f">Place <input data-k="place" maxlength="120" value="${esc(set.place)}" placeholder="e.g. Alexandria Bay, St. Lawrence River, NY"></label>
        <label class="pm-f">Notes <textarea data-k="notes" rows="3" maxlength="600">${esc(set.notes)}</textarea></label>
        <label class="pm-f">Credits <textarea data-k="credit" rows="4" maxlength="1200">${esc(set.credit)}</textarea></label>
        <div class="se-acts">
          <button type="button" class="btn primary" data-pm="pdf"${st.busy ? " disabled" : ""}>Download PDF</button>
          <button type="button" class="btn" data-pm="save"${st.busy ? " disabled" : ""}>Save these settings</button></div>
        <p class="hint">Saved settings are used next time anyone with Map setup prints this map.</p>
      </aside>
      <div class="pm-preview"><div class="pm-sheet${st.picking ? " picking" : ""}" style="aspect-ratio:${sh.W} / ${sh.H}">${sh.svg}</div></div></div>`;
  }

  function sheetPoint(e) {
    const svg = box.querySelector(".pm-sheet svg"); if (!svg) return null;
    const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * frame.W, y = (e.clientY - r.top) / r.height * frame.H;
    const m = frame.map; if (x < m.x || y < m.y || x > m.x + m.w || y > m.y + m.h) return null;
    return frame.unP(x, y);
  }

  async function dataUrl(url) {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("The background picture couldn't be loaded.");
    const blob = await res.blob();
    return await new Promise((ok, bad) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = bad; fr.readAsDataURL(blob); });
  }

  async function downloadPdf() {
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) { say("The PDF maker didn't load. Check your connection and reopen Print map.", "bad"); return render(); }
    st.busy = true; say("Making the PDF…"); render();
    try {
      const set = Object.assign({}, st.set), pics = imageLayers();
      const bg = pics.find(l => l.id === set.background);
      if (bg && !bg.printHref) bg.printHref = await dataUrl(bg.imageUrl);
      st.forPrint = true;
      let sh; try { sh = sheet(set); } finally { st.forPrint = false; }
      const holder = document.createElement("div"); holder.style.cssText = "position:fixed;left:-99999px;top:0;width:10px;height:10px;overflow:hidden";
      holder.innerHTML = sh.svg; document.body.appendChild(holder);
      const doc = new jsPDF({ orientation: sh.W > sh.H ? "landscape" : "portrait", unit: "pt", format: [sh.W, sh.H] });
      await doc.svg(holder.firstChild, { x: 0, y: 0, width: sh.W, height: sh.H });
      holder.remove();
      const name = `${(set.title || site).replace(/[^\w-]+/g, "-")}-map-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(name);
      say("Downloaded " + name + ".", "ok");
    } catch (err) { console.error(err); say("The PDF couldn't be made: " + (err && err.message || err), "bad"); }
    st.busy = false; render();
  }

  async function saveSettings() {
    st.busy = true; render();
    try {
      const s = st.set, print = { levels: s.levels, background: s.background, bgOpacity: s.bgOpacity, paper: s.paper, title: s.title, place: s.place, notes: s.notes, credit: s.credit,
        bottom: s.bottom, names: s.names, depths: s.depths, points: s.points, moorings: s.moorings };
      const data = Object.assign({}, S.data, { print });
      const { data: ver, error } = await C.client.rpc("publish_site_map", { site, new_data: data, expected_version: S.version, summary: "Saved the print map settings", edit_id: null });
      if (error) throw error;
      S.setPublished(data, ver, new Date().toISOString());
      say(`Saved (version ${ver}).`, "ok");
    } catch (err) { say(C.explain ? C.explain(err) : String(err), "bad"); }
    st.busy = false; render();
  }

  btn.addEventListener("click", () => { st.open = true; st.set = defaults(); st.picking = null; st.showBottom = true; say(null); render(); });
  box.addEventListener("click", e => {
    const b = e.target.closest("[data-pm]");
    if (b) {
      const act = b.dataset.pm;
      if (act === "close") { st.open = false; st.picking = null; return render(); }
      if (act === "pick") { st.picking = []; say(null); return render(); }
      if (act === "pick-cancel") { st.picking = null; return render(); }
      if (act === "pick-clear") { st.set.bottom = null; return render(); }
      if (act === "pdf") return downloadPdf();
      if (act === "save") return saveSettings();
      return;
    }
    if (st.picking && e.target.closest(".pm-sheet")) {
      const p = sheetPoint(e); if (!p) return;
      st.picking.push(p);
      if (st.picking.length === 2) {
        if (Math.hypot(st.picking[1][0] - st.picking[0][0], st.picking[1][1] - st.picking[0][1]) < 1) { st.picking = [st.picking[0]]; say("Pick a second point further along the shore.", "bad"); return render(); }
        st.set.bottom = st.picking.map(q => [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]); st.picking = null; say("Map bottom set. Save the settings to keep it.", "ok");
      }
      render();
    }
  });
  const onField = e => {
    const k = e.target.dataset && e.target.dataset.k; if (!k || !st.set) return;
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    if (k === "bgOpacity") st.set.bgOpacity = Number(v) / 100; else st.set[k] = v;
    // Text boxes update the sheet without redrawing the form, so typing isn't interrupted.
    if (e.type === "input" && (e.target.tagName === "TEXTAREA" || e.target.type === "text" || e.target.tagName === "INPUT" && !e.target.type)) {
      const sh = sheet(st.set); frame = sh; const host = box.querySelector(".pm-sheet"); if (host) host.innerHTML = sh.svg; return;
    }
    if (e.type === "input" && k === "bgOpacity") { const out = e.target.parentElement.querySelector("output"); if (out) out.textContent = v + "%"; const sh = sheet(st.set); frame = sh; const host = box.querySelector(".pm-sheet"); if (host) host.innerHTML = sh.svg; return; }
    // Selects and ticks redraw the whole page; text boxes already updated the sheet as they were typed in
    // (redrawing on their change event would swallow a click on a button, which fires it).
    if (e.type === "change" && (e.target.tagName === "SELECT" || e.target.type === "checkbox")) render();
  };
  box.addEventListener("input", onField);
  box.addEventListener("change", onField);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && st.open) { if (st.picking) st.picking = null; else st.open = false; render(); } });
  // Access can change on log in or out.
  if (C && C.onChange) C.onChange(() => { btn.hidden = !allowed(); });
});
