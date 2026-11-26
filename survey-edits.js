/* Limitless Diving — changes to a site map's survey data (the Site maps editor).
   A suggestion is a list of changes, applied in order to the published survey data:

     name_point    { run, index, landmark, name }        give the point after entry <index> of <run> a name,
                                                         so a new line can start or end there
     add_run       { run, name, start, entries, end?, landmarks? }
                                                         a new run of line from landmark <start>; with <end> it
                                                         is stretched and turned to finish at that landmark
     remove_run    { run }                               delete a whole run
     cut_run       { run, from }                         delete entries <from>.. to the end of the run
     mark_removed  { run, from, to? }                    the line from <from> (to <to>, or the end) was pulled:
                                                         drawn as grey "removed line", landmarks stay
     drop_segment  { run, index }                        take out one line but keep everything after it in
                                                         place (the line becomes an undrawn jump)
     move_point    { run, index, seg, frac }             slide the stake or tie-off at entry <index> along its
                                                         run to <frac> (0–1) of the way along line entry <seg>.
                                                         The line is split there, so nothing else moves; the two
                                                         lines it sat between join up again when they're straight
     bend_point    { run, index, before: { i, length_ft, angle }, after?: { i, length_ft, angle } }
                                                         move the stake or tie-off at entry <index> anywhere: the
                                                         line entries <before.i> and <after.i> on either side of
                                                         it get the new length and heading, so the line bends there

   Indexes refer to the data as it is when that change is applied (after the changes before it).
   Works in the browser (window.SurveyEdits) and in Node (module.exports), for testing. */
(function (root) {
  "use strict";

  const LINE = /^(SurveyedLine|UnsurveyedLine|MarinaLine|PlatformLine|RemovedLine)$/;
  const SAVES = e => (e.type === "SaveLandmark" || e.type === "SavedStake") && e.landmark ? e.landmark : null;
  const KEY = /^[A-Z][A-Z0-9_]{0,59}$/;
  // Stakes and tie-offs that can slide along their line. A named stake (SavedStake) isn't one: other lines start there.
  const MOVABLE = /^(Stake|TieOff|RemovedStake)$/;
  const lenFt = e => (Number(e.length_ft) || 0) + (Number(e.length_in) || 0) / 12;
  const withLen = (e, ft) => { const o = Object.assign({}, e, { length_ft: ft }); delete o.length_in; return o; };

  // A copy that can be changed without touching the original. Entries are shared until a change replaces
  // them, so the editor can tell which entries are new, changed or gone.
  function copy(d) {
    const runs = {};
    for (const [k, v] of Object.entries(d.runs || {})) runs[k] = v.slice();
    return Object.assign({}, d, { runs, plan: (d.plan || []).map(s => Object.assign({}, s)),
      landmarks: Object.assign({}, d.landmarks), runNames: Object.assign({}, d.runNames) });
  }

  function dropRunFromPlan(d, run) {
    d.plan = d.plan.flatMap(s => {
      if (s.mode === "loop" && (s.run === run || s.run2 === run)) {
        const other = s.run === run ? s.run2 : s.run;
        return [{ mode: "draw", start: s.start, run: other }];
      }
      return s.run === run ? [] : [s];
    });
  }

  function check(cond, msg) { if (!cond) throw new Error(msg); }
  function runOf(d, run) { check(Array.isArray(d.runs[run]), `There's no line called ${run}.`); return d.runs[run]; }
  function cleanEntry(e) {
    check(e && typeof e === "object" && typeof e.type === "string", "A new entry is missing its type.");
    const ok = ["SurveyedLine", "UnsurveyedLine", "PlatformLine", "Jump", "Stake", "TieOff", "SaveLandmark", "Arrow"];
    check(ok.includes(e.type), `Entries of type ${e.type} can't be added here.`);
    const out = { type: e.type };
    if (LINE.test(e.type) || e.type === "Jump") {
      const ft = Number(e.length_ft) || 0, inch = Number(e.length_in) || 0, ang = Number(e.angle);
      check(ft >= 0 && ft <= 2000 && inch >= 0 && inch < 12, "Lengths must be 0–2000 ft and 0–11 in.");
      check(ft + inch > 0, "A line needs a length.");
      check(isFinite(ang) && ang >= 0 && ang <= 360, "Headings must be 0–360°.");
      out.length_ft = ft; if (inch) out.length_in = inch; out.angle = ang;
    }
    if (e.type === "SaveLandmark") {
      check(KEY.test(e.landmark || ""), "A new landmark needs an id.");
      out.landmark = e.landmark;
      if (e.depth != null && e.depth !== "") { const dep = Number(e.depth); check(isFinite(dep) && dep >= 0 && dep <= 400, "Depths must be 0–400 ft."); out.depth = dep; out.depth_angle = 90; }
      if (e.icon_path) out.icon_path = String(e.icon_path).slice(0, 200);
      if (e.show_label) out.show_label = true;
    }
    if ((e.type === "Stake" || e.type === "TieOff") && e.depth != null && e.depth !== "") {
      const dep = Number(e.depth); check(isFinite(dep) && dep >= 0 && dep <= 400, "Depths must be 0–400 ft."); out.depth = dep;
    }
    if (e.type === "Arrow") { out.angle = Number(e.angle) || 0; out.distance = Number(e.distance) || 10; }
    if (e.note) out.note = String(e.note).slice(0, 300);
    return out;
  }

  function applyOne(d, c, landmarkOnMap) {
    switch (c.op) {
      case "name_point": {
        const r = runOf(d, c.run);
        check(Number.isInteger(c.index) && c.index >= 0 && c.index < r.length, "That point isn't on this line any more.");
        check(KEY.test(c.landmark || "") && !landmarkOnMap(c.landmark), "That point needs a new id.");
        r.splice(c.index + 1, 0, { type: "SaveLandmark", landmark: c.landmark });
        d.landmarks[c.landmark] = String(c.name || "Point").slice(0, 120);
        return;
      }
      case "add_run": {
        check(KEY.test(c.run || "") && !d.runs[c.run], "The new line needs a new id.");
        check(landmarkOnMap(c.start), "Pick where the new line starts.");
        check(!c.end || landmarkOnMap(c.end), "The point the line ends at isn't on the map.");
        check(Array.isArray(c.entries) && c.entries.length > 0 && c.entries.length <= 300, "Add at least one line.");
        const entries = c.entries.map(cleanEntry);
        check(entries.some(e => LINE.test(e.type) || e.type === "Jump"), "Add at least one line.");
        for (const [k, v] of Object.entries(c.landmarks || {})) { check(KEY.test(k) && !landmarkOnMap(k), "A new landmark needs a new id."); d.landmarks[k] = String(v || "Landmark").slice(0, 120); }
        d.runs[c.run] = entries;
        d.runNames[c.run] = String(c.name || "New line").slice(0, 120);
        d.plan.push(c.end ? { mode: "fit", start: c.start, run: c.run, end: c.end } : { mode: "draw", start: c.start, run: c.run });
        return;
      }
      case "remove_run":
        runOf(d, c.run);
        delete d.runs[c.run];
        dropRunFromPlan(d, c.run);
        return;
      case "cut_run": {
        const r = runOf(d, c.run);
        check(Number.isInteger(c.from) && c.from >= 0 && c.from < r.length, "That point isn't on this line any more.");
        if (c.from === 0 || !r.slice(0, c.from).some(e => LINE.test(e.type) || e.type === "Jump")) { delete d.runs[c.run]; dropRunFromPlan(d, c.run); }
        else d.runs[c.run] = r.slice(0, c.from);
        return;
      }
      case "mark_removed": {
        const r = runOf(d, c.run), to = c.to == null ? r.length : c.to;
        check(Number.isInteger(c.from) && c.from >= 0 && to <= r.length && c.from < to, "That part isn't on this line any more.");
        for (let i = c.from; i < to; i++) {
          const e = r[i];
          if (/^(SurveyedLine|UnsurveyedLine|MarinaLine|PlatformLine)$/.test(e.type)) r[i] = Object.assign({}, e, { type: "RemovedLine" });
          else if (e.type === "Stake") r[i] = Object.assign({}, e, { type: "RemovedStake" });
        }
        return;
      }
      case "move_point": {
        const r = runOf(d, c.run), p0 = r[c.index], seg = r[c.seg], p = p0 && Object.assign({}, p0);   // a copy, so the map shows it as changed
        check(p0 && MOVABLE.test(p0.type), "That stake or tie-off isn't there any more.");
        check(seg && LINE.test(seg.type), "Tap the line it should go on.");
        const f = Number(c.frac);
        check(isFinite(f) && f >= 0 && f <= 1, "Tap the line it should go on.");
        const total = lenFt(seg), a = Math.round(total * f * 100) / 100;
        const prev = r[c.index - 1], next = r[c.index + 1], out = [];
        r.forEach((e, i) => {
          if (i === c.index) return;
          if (i !== c.seg) { out.push(e); return; }
          if (a < 0.1) out.push(p, e);
          else if (total - a < 0.1) out.push(e, p);
          else out.push(withLen(e, a), p, withLen({ type: e.type, angle: e.angle }, Math.round((total - a) * 100) / 100));
        });
        // Where it was: two lines that are now side by side, the same kind and heading, join back into one.
        const i = prev ? out.indexOf(prev) : -1;
        if (i >= 0 && next && out[i + 1] === next && LINE.test(prev.type) && prev.type === next.type && Number(prev.angle) === Number(next.angle)
            && Object.keys(next).every(k => /^(type|angle|length_ft|length_in)$/.test(k))) {
          out.splice(i, 2, withLen(prev, Math.round((lenFt(prev) + lenFt(next)) * 100) / 100));
        }
        d.runs[c.run] = out;
        return;
      }
      case "bend_point": {
        const r = runOf(d, c.run), p = r[c.index];
        check(p && MOVABLE.test(p.type), "That stake or tie-off isn't there any more.");
        const legs = [c.before, c.after].filter(Boolean);
        check(c.before && c.before.i < c.index && (!c.after || c.after.i > c.index), "Those aren't the lines either side of it.");
        for (const g of legs) {
          check(Number.isInteger(g.i) && r[g.i] && LINE.test(r[g.i].type), "Those aren't the lines either side of it.");
          const ft = Number(g.length_ft), ang = Number(g.angle);
          check(isFinite(ft) && ft > 0 && ft <= 2000 && isFinite(ang) && ang >= 0 && ang <= 360, "Lengths must be 0–2000 ft and headings 0–360°.");
        }
        // Only stakes, tie-offs and arrows between the two lines: a named point there would take other lines with it.
        const lo = c.before.i, hi = c.after ? c.after.i : r.length;
        check(r.slice(lo + 1, hi).every(e => /^(Stake|TieOff|RemovedStake|Arrow)$/.test(e.type)), "Other lines start from this point, so it can only slide along its line.");
        for (const g of legs) r[g.i] = withLen(r[g.i], Math.round(Number(g.length_ft) * 100) / 100), r[g.i].angle = Math.round(Number(g.angle) * 100) / 100;
        r[c.index] = Object.assign({}, p);   // a copy, so the map shows it as changed
        return;
      }
      case "drop_segment": {
        const r = runOf(d, c.run);
        check(Number.isInteger(c.index) && r[c.index] && LINE.test(r[c.index].type), "That line isn't there any more.");
        const e = r[c.index];
        r[c.index] = { type: "Jump", length_ft: e.length_ft || 0, length_in: e.length_in || 0, angle: e.angle };
        return;
      }
      default:
        throw new Error(`Unknown change ${c && c.op}`);
    }
  }

  // Apply changes to data. Returns { data, error, failedAt }: on an error, data has the changes before it.
  function apply(data, changes) {
    let d = copy(data);
    const onMap = k => k === (d.origin || "BAR") || Object.values(d.runs).some(r => r.some(e => SAVES(e) === k));
    for (let i = 0; i < (changes || []).length; i++) {
      const before = copy(d);
      try { applyOne(d, changes[i], onMap); }
      catch (err) { return { data: before, error: err.message, failedAt: i }; }
    }
    return { data: d, error: null, failedAt: -1 };
  }

  // Lines (plan steps) that start from, or are fitted to, a landmark saved in run entries [from..].
  // Follows them on: a line that depends on one of those is listed too. Returns run ids, not including <run>.
  function dependents(data, run, from) {
    const lost = new Set(), out = [], seen = new Set([run]);
    const savedIn = (r, f) => (data.runs[r] || []).slice(f).map(SAVES).filter(Boolean);
    const savedElsewhere = (k, skipRuns) => Object.entries(data.runs).some(([r, es]) => !skipRuns.has(r) && es.some(e => SAVES(e) === k));
    savedIn(run, from || 0).forEach(k => lost.add(k));
    let grew = true;
    while (grew) {
      grew = false;
      for (const s of data.plan) {
        for (const r of [s.run, s.run2].filter(Boolean)) {
          if (seen.has(r)) continue;
          const needs = [s.start, s.end].filter(Boolean);
          if (needs.some(k => lost.has(k) && !savedElsewhere(k, seen))) {
            seen.add(r); out.push(r); savedIn(r, 0).forEach(k => lost.add(k)); grew = true;
          }
        }
      }
    }
    return out;
  }

  const feet = e => { const ft = Number(e.length_ft) || 0, inch = Number(e.length_in) || 0; return inch ? `${ft} ft ${inch} in` : `${ft} ft`; };

  // One line of plain English for a change, using names from data (the data before the change).
  function describe(c, data) {
    const runName = r => (data.runNames && data.runNames[r]) || r;
    const lm = k => (data.landmarks && data.landmarks[k]) || k;
    const nth = (r, i) => (data.runs[r] || []).slice(0, i + 1).filter(e => LINE.test(e.type)).length;
    switch (c.op) {
      case "name_point": return `Name a point on ${runName(c.run)}: ${c.name}`;
      case "add_run": {
        const lines = (c.entries || []).filter(e => LINE.test(e.type));
        const placed = !lines.length && (c.entries || []).find(e => e.type === "SaveLandmark");
        if (placed) return `Add the point ${(c.landmarks && c.landmarks[placed.landmark]) || lm(placed.landmark)}${placed.show_label ? " (name shown on the map)" : ""}`;
        const total = lines.reduce((t, e) => t + (Number(e.length_ft) || 0) + (Number(e.length_in) || 0) / 12, 0);
        const startName = (c.landmarks && c.landmarks[c.start]) || lm(c.start), endName = c.end && ((c.landmarks && c.landmarks[c.end]) || lm(c.end));
        return `Add ${c.name}: ${lines.length} ${lines.length === 1 ? "line" : "lines"}, ${Math.round(total)} ft, from ${startName}${endName ? " to " + endName : ""}`;
      }
      case "remove_run": return `Delete ${runName(c.run)}`;
      case "cut_run": return `Delete ${runName(c.run)} from line ${nth(c.run, c.from - 1) + 1} to the end`;
      case "mark_removed": return `Mark ${runName(c.run)} as removed line from line ${nth(c.run, c.from - 1) + 1}${c.to == null ? " to the end" : ""}`;
      case "move_point": { const e = (data.runs[c.run] || [])[c.index] || {}; return `Move the ${e.type === "TieOff" ? "tie-off" : "stake"} on ${runName(c.run)} along the line`; }
      case "bend_point": {
        const e = (data.runs[c.run] || [])[c.index] || {}, leg = g => `${Math.round(g.length_ft * 10) / 10} ft at ${Math.round(g.angle)}°`;
        return `Move the ${e.type === "TieOff" ? "tie-off" : "stake"} on ${runName(c.run)}: line before it now ${leg(c.before)}${c.after ? `, line after it ${leg(c.after)}` : ""}`;
      }
      case "drop_segment": { const e = (data.runs[c.run] || [])[c.index] || {}; return `Take out line ${nth(c.run, c.index)} of ${runName(c.run)} (${feet(e)} at ${e.angle}°)`; }
      default: return "Unknown change";
    }
  }

  // Describe each change of a list against the data it applies to.
  function describeAll(data, changes) {
    let d = data;
    return (changes || []).map(c => { const text = describe(c, d); const r = apply(d, [c]); if (!r.error) d = r.data; return text; });
  }

  // A new id for a run or landmark that isn't used yet.
  function newId(data, prefix) {
    const used = k => (data.runs && data.runs[k]) || (data.landmarks && data.landmarks[k]);
    for (let i = 0; ; i++) {
      const k = `${prefix}_${Date.now().toString(36).toUpperCase()}${i ? "_" + i : ""}`;
      if (!used(k)) return k;
    }
  }

  const api = { apply, dependents, describe, describeAll, newId, copy, LINE, MOVABLE };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SurveyEdits = api;
})(typeof window !== "undefined" ? window : globalThis);
