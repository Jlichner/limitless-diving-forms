/* Limitless Diving — ski-style ratings for site map lines (survey-layers.js uses it; tools/survey/test-ratings.js tests it).
   Green circle lines are on the main survey; blue square, black diamond and double black diamond lines each sit in
   a layer of their own. Rating lines moves them (and the runs that start from them, when those are rated lower)
   into the rating's layer, splitting a run where a pick starts partway along it.
   Works in the browser (window.SurveyRatings) and in Node (module.exports). */
(function (root) {
  "use strict";
  const E = root.SurveyEdits || (typeof require === "function" && require("./survey-edits.js"));
  const G = root.SurveyGeometry || (typeof require === "function" && require("./survey-geometry.js"));
  const ORDER = ["green", "blue", "black", "double-black", "squirrel"];
  const RANK = { green: 0, blue: 1, black: 2, "double-black": 3, squirrel: 4 };

  // Put plan steps in an order where each starts from a point already drawn.
  function orderPlan(plan, runs, known) {
    const k = new Set(known), out = [], left = plan.slice();
    const saves = run => (runs[run] || []).map(e => e.landmark).filter(Boolean);
    while (left.length) {
      const i = left.findIndex(p => k.has(p.start) && (!p.end || k.has(p.end)));
      const p = left.splice(i < 0 ? 0 : i, 1)[0];
      out.push(p); [p.run, p.run2].filter(Boolean).forEach(r => saves(r).forEach(x => k.add(x)));
    }
    return out;
  }
  function merge(parts) {
    const out = Object.assign({}, parts[0], { runs: {}, plan: [], landmarks: {}, runNames: {} });
    for (const d of parts) { Object.assign(out.runs, d.runs); out.plan = out.plan.concat(d.plan); Object.assign(out.landmarks, d.landmarks); Object.assign(out.runNames, d.runNames); }
    return out;
  }
  // Rate runs: src is { green, blue, black, "double-black", squirrel } survey data (green = the main survey), changed in
  // place. picks are { run, index, whole } (index = the entry of the line tapped). Throws with a plain message
  // when it can't be done. Returns { moving }: the ids of the runs now in the target rating.
  function rate(src, picks0, target, opts) {
    const order = ORDER, S = { runName: r => (opts.runName && opts.runName(r)) || r };
    const where = run => order.find(id => src[id].runs[run]);
    const others = opts.others || [];
    const warnCount = () => G.compute(merge(order.map(id => src[id]).concat(others))).warnings.length;
    const startWarn = warnCount();
    const moving = new Set();
    // Whole runs first, then the "from here on" picks, last line first so earlier picks keep their place.
    const picks = picks0.slice().sort((a, b) => (b.whole - a.whole) || (b.index - a.index));
    for (const sel of picks) {
      const from = where(sel.run);
      if (!from) throw new Error(`${S.runName(sel.run)} isn't on the map any more. Refresh the page.`);
      const d = src[from], r = d.runs[sel.run];
      const first = r.findIndex(e => E.LINE.test(e.type) || e.type === "Jump");
      if (sel.whole || moving.has(sel.run) || sel.index <= first) { moving.add(sel.run); continue; }
      const step = d.plan.find(p => p.run === sel.run || p.run2 === sel.run);
      if (step && step.mode !== "draw") throw new Error(`${S.runName(sel.run)} is stretched a little to join up with another line, so it can only be rated as a whole run. Tick "Whole run".`);
      let i = sel.index, key;
      const prev = r[i - 1];
      if (prev && (prev.type === "SaveLandmark" || prev.type === "SavedStake") && prev.landmark) key = prev.landmark;
      else {
        key = E.newId(merge(order.map(id => src[id])), "P");
        r.splice(i, 0, { type: "SaveLandmark", landmark: key });
        d.landmarks[key] = `Point on ${S.runName(sel.run)}`; i++;
      }
      const n = r.slice(0, i).filter(x => E.LINE.test(x.type)).length + 1;
      const tail = r.slice(i), nr = E.newId(merge(order.map(id => src[id])), "RUN");
      d.runs[sel.run] = r.slice(0, i);
      d.runs[nr] = tail; d.runNames[nr] = `${S.runName(sel.run)}, from line ${n}`.slice(0, 120);
      d.plan.splice(d.plan.indexOf(step) + 1, 0, { mode: "draw", start: key, run: nr });
      moving.add(nr);
    }
    // Runs that start from a moved line come along when they're rated lower; loops move both halves.
    let grew = true;
    while (grew) {
      grew = false;
      const all = merge(order.map(id => src[id]));
      for (const run of [...moving]) {
        for (const dep of E.dependents(all, run, 0)) if (!moving.has(dep) && RANK[where(dep)] < RANK[target]) { moving.add(dep); grew = true; }
        for (const p of all.plan) if (p.run2 && (moving.has(p.run) || moving.has(p.run2)) && !(moving.has(p.run) && moving.has(p.run2))) { moving.add(p.run); moving.add(p.run2); grew = true; }
      }
    }
    // Move them, keeping the drawing order.
    const steps = [];
    for (const id of order) {
      const d = src[id];
      for (const p of d.plan) if (moving.has(p.run) || moving.has(p.run2)) steps.push(p);
    }
    const dest = src[target];
    for (const id of order) {
      if (id === target) continue;
      const d = src[id];
      for (const run of moving) {
        if (!d.runs[run]) continue;
        dest.runs[run] = d.runs[run]; delete d.runs[run];
        if (d.runNames[run]) dest.runNames[run] = d.runNames[run];
        for (const e of dest.runs[run]) if (e.landmark && d.landmarks[e.landmark]) dest.landmarks[e.landmark] = d.landmarks[e.landmark];
      }
      d.plan = d.plan.filter(p => !(moving.has(p.run) || moving.has(p.run2)));
    }
    const keep = dest.plan.filter(p => !steps.includes(p));
    const known = Object.keys(G.compute(merge(order.slice(0, order.indexOf(target)).map(id => src[id]))).at);
    dest.plan = orderPlan(keep.concat(steps), dest.runs, target === "green" ? [opts.origin || "BAR"] : known);
    if (warnCount() > startWarn) {
      const w = G.compute(merge(order.map(id => src[id]).concat(others))).warnings;
      throw new Error(`That would leave lines with nothing to start from (${w[w.length - 1]}). Rate the line they start from first, or rate them together.`);
    }
    return { moving };
  }

  const api = { rate, merge, orderPlan, ORDER, RANK };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SurveyRatings = api;
})(typeof window !== "undefined" ? window : globalThis);
