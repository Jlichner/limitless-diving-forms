/* Limitless Diving — Survey book: publishing only your changes (Jamie 2026-11-26: "only publish changes and not the
   whole survey"). The book works line by line, like the slates: when someone else published while you were working,
   the lines you changed (added, edited or deleted) are put on top of their version, and every line you didn't touch
   stays as they left it. A line both of you changed differently is a clash: yours is kept and it's listed, so you can
   check it before publishing.
   Rows are the Survey book's (the sheet's) rows: A From, B To, C Depth, D Back, E Heading, F ft, G m, H Kind, I Note,
   J Drawing, K Level; a blank row between lines, a line's first row is its title. Used by survey-book.js; tested by
   tools/survey/test-merge.js. */
(function (root) {
  "use strict";
  const str = v => (v == null ? "" : String(v)).trim();
  const blankish = r => r.slice(0, 6).every(v => str(v) === "") && r.slice(7, 10).every(v => str(v) === "");
  const held = r => r[11] === 1 && blankish(r);   // a new leg not filled in yet (belongs to its line)
  const isTitle = r => str(r[0]) && [2, 3, 4, 5, 7].every(k => str(r[k]) === "") && (!str(r[1]) || /^(loop with |gps\b)/i.test(str(r[1])));

  // { header, head: rows before the first line (the starting point), lines: [{ key, name, rows }] }
  function split(rows) {
    const out = { header: null, head: [], lines: [] };
    let cur = null, first = true;   // first: still before the first blank row (where the starting point is)
    const count = {};
    (rows || []).forEach((r, i) => {
      if (i === 0 && /^from/i.test(str(r[0]))) { out.header = r; return; }
      if (blankish(r) && !held(r)) { first = false; if (cur) { out.lines.push(cur); cur = null; } return; }
      if (first && !cur && !str(r[0]) && str(r[1]) && str(r[4]) === "" && str(r[5]) === "") { out.head.push(r); return; }
      if (!cur) cur = { rows: [] };
      cur.rows.push(r);
    });
    if (cur) out.lines.push(cur);
    for (const l of out.lines) {
      const first = l.rows[0];
      const name = isTitle(first) ? str(first[0]) : `${str(first[0])} → ${str(first[1])}`;
      const base = (isTitle(first) ? "t:" : "r:") + name.toLowerCase();
      count[base] = (count[base] || 0) + 1;
      l.name = name; l.key = count[base] > 1 ? `${base}#${count[base]}` : base;
    }
    return out;
  }

  // The same line written two ways (a number typed as 23 or 23.0, a blank Kind or "Surveyed") counts as the same.
  function norm(r) {
    const cell = (v, k) => {
      let s = str(v).toLowerCase();
      if (k === 7 && (s === "" || s === "surveyedline")) s = "surveyed";
      if (s !== "" && /^-?\d+(\.\d+)?$/.test(s)) s = String(Math.round(Number(s) * 100) / 100);
      return s;
    };
    const hdg = str(r[4]);
    return [0, 1, 2, ...(hdg ? [] : [3]), 4, 5, 7, 8, 9, 10].map(k => cell(r[k], k)).join("|");
  }
  const sig = rows => rows.filter(r => !held(r)).map(norm).join("\n");

  function merge(base, mine, theirs) {
    const B = split(base.rows), M = split(mine.rows), T = split(theirs.rows);
    const byKey = s => Object.fromEntries(s.lines.map(l => [l.key, l]));
    const b = byKey(B), m = byKey(M), t = byKey(T);
    const changed = [], conflicts = [], theirsChanged = [];
    const lineSig = l => (l ? sig(l.rows) : null);
    // Their lines, in their order; then each of mine that changed goes in, replaces or comes out.
    let out = T.lines.slice();
    const keys = new Set([...Object.keys(b), ...Object.keys(m)]);
    for (const k of Object.keys(t)) if (lineSig(t[k]) !== lineSig(b[k])) theirsChanged.push(t[k].name);
    const mineOrder = M.lines.map(l => l.key);
    for (const k of keys) {
      const bs = lineSig(b[k]), ms = lineSig(m[k]), ts = lineSig(t[k]);
      if (ms === bs) continue;                       // you didn't change it: theirs stands
      const name = (m[k] || b[k]).name;
      changed.push(name);
      if (ts !== bs && ts !== ms) conflicts.push(name);
      if (!m[k]) { out = out.filter(l => l.key !== k); continue; }   // you deleted it
      const at = out.findIndex(l => l.key === k);
      if (at >= 0) { out[at] = m[k]; continue; }
      // New (or one they deleted that you changed): after the line before it in your book.
      let after = -1;
      for (let i = mineOrder.indexOf(k) - 1; i >= 0 && after < 0; i--) after = out.findIndex(l => l.key === mineOrder[i]);
      out.splice(after + 1, 0, m[k]);
    }
    // The starting point.
    let head = T.head;
    if (sig(M.head) !== sig(B.head)) { head = M.head; changed.push("Starting point"); if (sig(T.head) !== sig(B.head) && sig(T.head) !== sig(M.head)) conflicts.push("Starting point"); }
    const blank = () => ["", "", "", "", "", "", "", "", "", "", ""];
    const rows = [T.header || M.header || B.header || blank()].filter(Boolean).concat(head);
    for (const l of out) rows.push(blank(), ...l.rows);
    // Landmark codes and names: your changes on top of theirs.
    const lmMap = list => Object.fromEntries((list || []).filter(r => str(r[0])).map(r => [str(r[0]), str(r[1])]));
    const lb = lmMap(base.lm), lmM = lmMap(mine.lm), lt = lmMap(theirs.lm), lm = Object.assign({}, lt);
    for (const code of new Set([...Object.keys(lb), ...Object.keys(lmM)])) {
      if (lmM[code] === lb[code]) continue;
      if (lmM[code] == null) delete lm[code]; else lm[code] = lmM[code];
    }
    return { rows, lm: Object.entries(lm).map(([c, n]) => [c, n]), changed, conflicts, theirsChanged };
  }

  const api = { merge, split, sig };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SurveyMerge = api;
})(typeof window !== "undefined" ? window : this);
