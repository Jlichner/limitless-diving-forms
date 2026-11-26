/* Limitless Diving — the Site maps editor (on each site map page, e.g. bonnie-castle-map.html).
   The survey team (Site maps access "Survey team" and up) taps a stake, tie-off, landmark or line to add a new run of line from it, or to delete
   or mark as removed a run or part of one. The map previews the changes as they go (new in orange, deleted
   in red). The survey team sends its changes to the admins as a suggestion; Admins preview suggestions, approve
   (publish) or decline them, publish their own changes straight away, and can put back any earlier version.
   Uses SurveyMap (survey-map.js), SurveyEdits (survey-edits.js) and LDCloud (cloud.js). Database tables:
   site_maps, site_map_edits, site_map_history (supabase/schema.sql). */
// Starts once survey-map.js has checked the member's access and drawn the map (SurveyMap.ready).
(window.SurveyMap ? window.SurveyMap.ready : Promise.resolve()).then(function () {
  "use strict";

  const S = window.SurveyMap, E = window.SurveyEdits, C = window.LDCloud;
  if (!S || !S.map || !E) return;
  const esc = S.esc, site = S.site, fileData = (window.SITE_MAPS || {})[site];
  const panel = document.getElementById("sm-edit"), btn = document.getElementById("sm-edit-btn"), work = document.getElementById("sm-work");
  const STORE = "ld-sitemap-draft-" + site;
  const st = { open: false, draft: [], groups: [], baseVersion: 0, sel: null, mode: "idle", add: null, confirm: null, review: null,
    msg: null, busy: false, summary: "", pending: [], mine: [], history: null, declining: null };

  const isAdmin = () => S.isSiteAdmin();   // Admins and Dive site admins
  const hasFile = !!(fileData && fileData.plan && fileData.plan.length);   // a survey in the page's data file (not for private sites)
  const say = (text, kind) => { st.msg = text ? { text, kind: kind || "" } : null; };
  const lineFeet = e => (Number(e.length_ft) || 0) + (Number(e.length_in) || 0) / 12;
  const ftIn = e => { const ft = Number(e.length_ft) || 0, inch = Number(e.length_in) || 0; return inch ? `${ft} ft ${inch} in` : `${ft} ft`; };
  const when = t => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  // ----- the draft: changes not sent yet, kept in this browser so a reload doesn't lose them -----
  // draft is the list of changes; groups is how many of them each step made, so Undo takes back a whole step.
  function saveDraft() { try { localStorage.setItem(STORE, JSON.stringify({ draft: st.draft, groups: st.groups, baseVersion: st.baseVersion, summary: st.summary })); } catch (e) { /* private mode */ } }
  function loadDraft() {
    try { const v = JSON.parse(localStorage.getItem(STORE) || "null"); if (v && Array.isArray(v.draft)) { st.draft = v.draft; st.groups = Array.isArray(v.groups) && v.groups.reduce((a, b) => a + b, 0) === v.draft.length ? v.groups : v.draft.map(() => 1); st.baseVersion = v.baseVersion || 0; st.summary = v.summary || ""; } } catch (e) { /* ignore */ }
  }
  // What edits apply to. Admins and Dive site admins edit the main survey and the rated layers together (runLayer
  // says which layer each run is in); the survey team's suggestions are for the main survey only.
  const base = () => isAdmin() ? S.combine(S.data) : { data: S.data, runLayer: null };
  const current = () => E.apply(base().data, st.draft);   // the map with the draft applied

  // ----- previewing on the map -----
  function preview() {
    if (!st.open) return;
    if (st.review) { S.show(st.review.data, { base: S.data }); S.select(null); if (st.review.focus) { st.review.focus = false; S.focusChanges(); } return; }
    const changes = st.draft.concat(st.mode === "add" && !st.add.pickingEnd ? addChanges(false) : st.mode === "point" ? pointChanges() : st.mode === "move" ? moveChanges() : []);
    const b = base(), r = E.apply(b.data, changes);
    // Admins edit with the layers in the data; for the survey team the map adds the rated lines on top as usual.
    S.show(r.data, b.runLayer ? { base: b.data, runLayer: b.runLayer } : { base: b.data });
    const err = panel.querySelector("#se-preview-err");
    if (err) { err.hidden = !r.error; err.textContent = r.error ? "The preview stops here: " + r.error : ""; }
    S.select(st.mode === "idle" ? st.sel : null);
  }

  // ----- what a tapped feature is, in words -----
  function describeFeature(f) {
    const d = current().data;
    if (f.kind === "landmark") return `${S.name(f.landmark)}${f.depth != null ? `, ${f.depth} ft deep` : ""}`;
    if (f.kind === "stake") return `Stake on ${S.runName(f.run)}`;
    if (f.kind === "tieoff") return `Tie-off on ${S.runName(f.run)}`;
    const e = d.runs[f.run][f.index], n = d.runs[f.run].slice(0, f.index + 1).filter(x => E.LINE.test(x.type)).length;
    return `Line ${n} of ${S.runName(f.run)}: ${ftIn(e)} at ${e.angle}°`;
  }

  // Where a new line from feature f starts: an existing landmark, or a point to name first.
  function anchor(f, d) {
    const at = f.kind === "segment" ? [f.x1, f.y1] : [f.x, f.y];   // where it is on the map, in feet
    if (f.kind === "landmark") return { key: f.landmark, label: S.name(f.landmark), pre: null, at };
    const r = d.runs[f.run], next = r[f.index + 1];
    if (next && (next.type === "SaveLandmark" || next.type === "SavedStake") && next.landmark) return { key: next.landmark, label: S.name(next.landmark), pre: null, at };
    const label = f.kind === "segment" ? `End of line on ${S.runName(f.run)}` : describeFeature(f);
    const key = E.newId(d, "P");
    return { key, label, pre: { op: "name_point", run: f.run, index: f.index, landmark: key, name: label }, at };
  }
  // A line straight from where the new run starts to the point it ends at, when no lines have been typed in:
  // fills the first row with that length and heading. Returns true when it filled it.
  function fillStraight() {
    const a = st.add, p = a && a.start.at, q = a && a.end && a.end.at;
    if (!p || !q || ![...p, ...q].every(Number.isFinite) || !a.rows.every(r => rowState(r).empty)) return false;
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
    if (len < 0.1) return false;
    let ft = Math.floor(len), inch = Math.round((len - ft) * 12);
    if (inch === 12) { ft += 1; inch = 0; }
    const ang = Math.round(((90 - Math.atan2(dy, dx) * 180 / Math.PI) % 360 + 360) % 360 * 10) / 10;
    Object.assign(a.rows[0], { ft: String(ft), inch: inch ? String(inch) : "", angle: String(ang === 360 ? 0 : ang) });
    a.filled = true;
    return true;
  }

  // ----- adding a run of line -----
  function newRow() { return { type: "SurveyedLine", ft: "", inch: "", angle: "", end: "none", lmName: "", depth: "", key: null }; }
  function startAdd(f) {
    const d = current().data, a = anchor(f, d);
    st.mode = "add"; st.sel = null;
    st.add = { start: a, end: null, name: `From ${a.label}`.slice(0, 120), run: E.newId(d, "RUN"), rows: [newRow()], pickingEnd: false };
    say(null);
  }
  function rowState(r) {
    const empty = r.ft === "" && r.inch === "" && r.angle === "";
    const ft = Number(r.ft || 0), inch = Number(r.inch || 0), ang = Number(r.angle);
    if (empty) return { empty: true };
    if (!(ft >= 0 && ft <= 2000) || !(inch >= 0 && inch < 12) || ft + inch <= 0) return { error: "Enter a length (feet, and inches under 12)." };
    if (r.angle === "" || !(ang >= 0 && ang <= 360)) return { error: "Enter a compass heading from 0 to 360°." };
    if (r.end === "landmark" && !r.lmName.trim()) return { error: "Name the landmark." };
    if (r.depth !== "" && !(Number(r.depth) >= 0 && Number(r.depth) <= 400)) return { error: "Depth is in feet, 0 to 400." };
    if (r.depth !== "" && r.end === "none") return { error: "The depth is taken at the end of the line: choose a stake, tie-off or landmark under At the end." };
    return { ok: true };
  }
  // The changes the add form makes. strict: every filled row must be right (for saving).
  function addChanges(strict) {
    const a = st.add, d = current().data, entries = [], landmarks = {};
    for (const r of a.rows) {
      const s = rowState(r);
      if (s.empty) continue;
      if (!s.ok) { if (strict) return null; break; }
      entries.push({ type: r.type, length_ft: Number(r.ft || 0), length_in: Number(r.inch || 0), angle: Number(r.angle) });
      const dep = r.depth === "" ? {} : { depth: Number(r.depth) };
      if (r.end === "stake") entries.push(Object.assign({ type: "Stake" }, dep));
      if (r.end === "tieoff") entries.push(Object.assign({ type: "TieOff" }, dep));
      if (r.end === "landmark") {
        r.key = r.key || E.newId(d, "LM");
        landmarks[r.key] = r.lmName.trim();
        entries.push({ type: "SaveLandmark", landmark: r.key, depth: r.depth === "" ? null : Number(r.depth) });
      }
    }
    if (!entries.length) return [];
    const out = [];
    if (a.start.pre) out.push(a.start.pre);
    let end = null;
    if (a.end) {
      end = a.end.key;
      if (a.end.pre) {
        const p = Object.assign({}, a.end.pre);
        if (a.start.pre && p.run === a.start.pre.run && p.index > a.start.pre.index) p.index += 1; // the start's new name moved it along
        out.push(p);
      }
    }
    out.push({ op: "add_run", run: a.run, name: a.name.trim() || "New line", start: a.start.key, end, entries, landmarks });
    return out;
  }
  function saveAdd() {
    let ch = addChanges(true);
    if (ch && !ch.length && fillStraight()) ch = addChanges(true);   // only the end point picked: go straight there
    if (!ch) { say("Fix the rows marked below first.", "bad"); return render(); }
    if (!ch.length) { say(st.add.end ? "Add at least one line: its length and heading." : "Add at least one line: its length and heading, or pick the point it ends at to draw it straight there.", "bad"); return render(); }
    const r = E.apply(base().data, st.draft.concat(ch));
    if (r.error) { say(r.error, "bad"); return render(); }
    pushDraft(ch);
    st.mode = "idle"; st.add = null;
    say("Added to your changes. Keep going, or send them below.", "ok");
    render();
  }

  // ----- a point placed by tapping the map (e.g. on a picture layer), with its name shown on the map -----
  // Saved as a hidden Jump from the starting point straight to the spot, then the landmark, so it rides with the
  // survey (and the picture layers lined up on it) and goes through the Survey book and the sheet like any line.
  function startPoint() {
    st.mode = "point"; st.sel = null;
    st.pt = { at: null, name: "", depth: "", label: true, run: E.newId(current().data, "PT"), key: null };
    say(null); setPlacing(true);
  }
  function setPlacing(on) { const m = document.getElementById("sm-map"); if (m) m.classList.toggle("placing", !!on); }
  function pointChanges() {
    const p = st.pt; if (!p || !p.at) return [];
    const d = current().data, origin = d.origin || "BAR";
    const [x, y] = p.at, L = Math.hypot(x, y);
    if (L < 1 / 12) return [];
    const ang = Math.round(((90 - Math.atan2(y, x) * 180 / Math.PI) % 360 + 360) % 360 * 1e4) / 1e4;
    const ft = Math.floor(L), inch = Math.min(11.99, Math.round((L - ft) * 12 * 100) / 100);
    p.key = p.key || E.newId(d, "LM");
    const name = p.name.trim() || "New point";
    const lm = { type: "SaveLandmark", landmark: p.key };
    if (p.depth !== "" && Number(p.depth) >= 0 && Number(p.depth) <= 400) lm.depth = Number(p.depth);
    if (p.label) lm.show_label = true;
    if (p.icon) lm.icon_path = p.icon;
    return [{ op: "add_run", run: p.run, name: `${name} (placed on the map)`, start: origin, end: null,
      entries: [{ type: "Jump", length_ft: ft, length_in: inch, angle: ang }, lm], landmarks: { [p.key]: name } }];
  }
  function placeAt(latlng) {
    if (st.mode !== "point" || !st.open) return;
    st.pt.at = S.toXY(latlng.lat, latlng.lng);
    say(null); render();
    const n = panel.querySelector("#se-pt-name"); if (n && !st.pt.name) n.focus();
  }
  function savePoint() {
    const p = st.pt;
    if (!p.at) { say("Tap the map where the point goes.", "bad"); return render(); }
    if (!p.name.trim()) { say("Give the point a name.", "bad"); return render(); }
    if (p.depth !== "" && !(Number(p.depth) >= 0 && Number(p.depth) <= 400)) { say("Depth is in feet, 0 to 400.", "bad"); return render(); }
    const ch = pointChanges();
    if (!ch.length) { say("That's right on the starting point. Tap a little way off it.", "bad"); return render(); }
    const r = E.apply(base().data, st.draft.concat(ch));
    if (r.error) { say(r.error, "bad"); return render(); }
    pushDraft(ch);
    st.mode = "idle"; st.pt = null; setPlacing(false);
    say(`Added "${p.name.trim()}" to your changes. Add another point, or send them below.`, "ok");
    render();
  }
  function symbolSelect(cur, attrs) {
    return `<select ${attrs}>${E.SYMBOLS.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  }
  function pointForm() {
    const p = st.pt;
    return `<section class="se-sec"><h3>Add a point on the map</h3>
      <p class="hint">${p.at ? "Tap the map again to move it." : "Tap the map where the point is. You can tap on a picture layer (photo map): turn it on in Layers and line it up first."}</p>
      <label class="se-wide">Name (shown on the map) <input id="se-pt-name" data-p="name" maxlength="120" value="${esc(p.name)}" placeholder="e.g. Old dock"></label>
      <label>Depth ft <input data-p="depth" inputmode="decimal" size="4" value="${esc(p.depth)}"></label>
      <label>Symbol ${symbolSelect(p.icon || "", 'data-p="icon"')}</label>
      <label class="se-check"><input type="checkbox" data-p="label"${p.label ? " checked" : ""}> Show the name on the map</label>
      <div class="se-acts"><button type="button" class="btn primary" data-act="pt-save"${p.at ? "" : " disabled"}>Add to my changes</button>
        <button type="button" class="btn" data-act="pt-cancel">Cancel</button></div></section>`;
  }
  S.map.on("click", e => { placeAt(e.latlng); moveAt(e.latlng); });

  // ----- sliding a stake or tie-off along its line (Jamie 2026-11-25) -----
  // The stake stays on its own run: tapping the line splits that line where it goes, so no line moves.
  function startMove(f) {
    st.mode = "move"; st.mv = { run: f.run, index: f.index, kind: f.kind, seg: null, frac: null, free: bendable(f) ? true : false, bend: null };
    say(null); setPlacing(true);
  }
  function moveChanges() {
    const m = st.mv; if (!m) return [];
    if (m.free) return m.bend ? [Object.assign({ op: "bend_point", run: m.run, index: m.index }, m.bend)] : [];
    return m.seg == null ? [] : [{ op: "move_point", run: m.run, index: m.index, seg: m.seg, frac: m.frac }];
  }
  // Moving it anywhere bends the line there: the lines either side of it (the one coming in and the one going on)
  // get a new length and heading. Only when nothing else is pinned to that point, and the run ends up where it did.
  function legsAround(d, run, index) {
    const r = d.runs[run] || [], free = e => /^(Stake|TieOff|RemovedStake|Arrow)$/.test(e.type);
    let b = index - 1; while (b >= 0 && free(r[b])) b--;
    let a = index + 1; while (a < r.length && free(r[a])) a++;
    const before = b >= 0 && E.LINE.test(r[b].type) ? b : null;
    const after = a < r.length ? (E.LINE.test(r[a].type) ? a : -1) : null;   // -1: something else is there
    return { before, after };
  }
  function bendable(f) {
    const d = current().data, L = legsAround(d, f.run, f.index);
    if (L.before == null || L.after === -1) return false;
    // The last point of a run that's stretched to meet another point can't move on its own.
    if (L.after == null) { const step = d.plan.find(p => p.run === f.run || p.run2 === f.run); return !!step && step.mode === "draw"; }
    return true;
  }
  function bendTo(latlng) {
    const m = st.mv, d = current().data, G = window.SurveyGeometry, g = G.compute(d), L = legsAround(d, m.run, m.index);
    const segA = g.segments.find(x => x.run === m.run && x.index === L.before);
    const segB = L.after != null ? g.segments.find(x => x.run === m.run && x.index === L.after) : null;
    if (!segA || (L.after != null && !segB)) return null;
    const eA = d.runs[m.run][L.before], ftA = lineFeet(eA);
    const dxA = segA.x1 - segA.x0, dyA = segA.y1 - segA.y0, drawnA = Math.hypot(dxA, dyA);
    if (!(ftA > 0) || !(drawnA > 0)) return null;
    // How this run is stretched and turned on the map, from the line before it: the same for the whole run.
    // Headings are compass degrees (0 = north, clockwise), so 90 minus the math angle.
    const compass = (dx, dy) => 90 - Math.atan2(dy, dx) * 180 / Math.PI;
    const stretch = drawnA / ftA, turn = compass(dxA, dyA) - Number(eA.angle);
    const [px, py] = S.toXY(latlng.lat, latlng.lng);
    const leg = (x0, y0, x1, y1) => {
      const len = Math.hypot(x1 - x0, y1 - y0) / stretch;
      const ang = (((compass(x1 - x0, y1 - y0) - turn) % 360) + 360) % 360;
      return { length_ft: Math.round(len * 100) / 100, angle: Math.round(ang * 100) / 100 };
    };
    const before = Object.assign({ i: L.before }, leg(segA.x0, segA.y0, px, py));
    const after = segB ? Object.assign({ i: L.after }, leg(px, py, segB.x1, segB.y1)) : null;
    if (before.length_ft < 0.1 || (after && after.length_ft < 0.1)) return null;
    return after ? { before, after } : { before };
  }
  // The nearest spot on the stake's own run to where the map was tapped, within a finger's width.
  function moveAt(latlng) {
    if (st.mode !== "move" || !st.open || !latlng) return;
    const m = st.mv, d = current().data, map = S.map, G = window.SurveyGeometry;
    if (m.free) {
      const b = bendTo(latlng);
      if (!b) { say("That's right on the next point. Tap a little way off it.", "bad"); return render(); }
      m.bend = b; say(null); return render();
    }
    const px = map.latLngToContainerPoint(latlng);
    let best = null;
    for (const sg of G.compute(d).segments.filter(x => x.run === m.run)) {
      if (!E.LINE.test((d.runs[m.run][sg.index] || {}).type)) continue;
      const a = map.latLngToContainerPoint(S.ll(sg.x0, sg.y0)), b = map.latLngToContainerPoint(S.ll(sg.x1, sg.y1));
      const vx = b.x - a.x, vy = b.y - a.y, len2 = vx * vx + vy * vy;
      const t = len2 ? Math.max(0, Math.min(1, ((px.x - a.x) * vx + (px.y - a.y) * vy) / len2)) : 0;
      const dist = Math.hypot(a.x + t * vx - px.x, a.y + t * vy - px.y);
      if (!best || dist < best.dist) best = { dist, seg: sg.index, frac: Math.round(t * 1000) / 1000 };
    }
    if (!best || best.dist > 40) { say(`Tap on ${S.runName(m.run)}: the ${m.kind === "tieoff" ? "tie-off" : "stake"} stays on its own line.`, "bad"); return render(); }
    m.seg = best.seg; m.frac = best.frac; say(null); render();
  }
  function saveMove() {
    const ch = moveChanges();
    if (!ch.length) { say(st.mv.free ? "Tap the map where it should go." : "Tap the line where it should go.", "bad"); return render(); }
    const r = E.apply(base().data, st.draft.concat(ch));
    if (r.error) { say(r.error, "bad"); return render(); }
    pushDraft(ch);
    const what = st.mv.kind === "tieoff" ? "tie-off" : "stake";
    st.mode = "idle"; st.mv = null; st.sel = null; setPlacing(false);
    say(`Moved the ${what}. It's in your changes.`, "ok");
    render();
  }
  function moveForm() {
    const m = st.mv, what = m.kind === "tieoff" ? "tie-off" : "stake", can = bendable({ run: m.run, index: m.index });
    const placed = m.free ? !!m.bend : m.seg != null, leg = g => `${Math.round(g.length_ft * 10) / 10} ft at ${Math.round(g.angle)}°`;
    return `<section class="se-sec"><h3>Move the ${what}</h3>
      <fieldset class="se-choice"><legend class="sr-only">How it moves</legend>
        <label class="se-check"><input type="radio" name="se-mv" value="free"${m.free ? " checked" : ""}${can ? "" : " disabled"}> Anywhere: the line bends to follow it</label>
        <label class="se-check"><input type="radio" name="se-mv" value="slide"${m.free ? "" : " checked"}> Along its line: the line stays put</label></fieldset>
      ${can ? "" : `<p class="hint">Other lines start from this ${what}, or its line is fitted to end at another point, so it can only slide along its line.</p>`}
      <p class="hint">${!placed ? (m.free ? `Tap the map where the ${what} should be.` : `Tap ${esc(S.runName(m.run))} where the ${what} should be.`) : `The new spot is in orange. Tap again to change it.`}</p>
      ${m.free && m.bend ? `<p class="hint">New numbers: line before it <b>${leg(m.bend.before)}</b>${m.bend.after ? `, line after it <b>${leg(m.bend.after)}</b>` : ""}.</p>` : ""}
      <div class="se-acts"><button type="button" class="btn primary" data-act="mv-save"${placed ? "" : " disabled"}>Add to my changes</button>
        <button type="button" class="btn" data-act="mv-cancel">Cancel</button></div></section>`;
  }

  // ----- deleting and marking removed -----
  function startRemove(f, how) {
    const d = current().data;
    let ops, from, run = f.run;
    if (how === "run") { ops = [{ op: "remove_run", run }]; from = 0; }
    else if (how === "drop") { ops = [{ op: "drop_segment", run, index: f.index }]; from = null; }
    else {
      from = f.kind === "segment" ? f.index : f.index + 1;
      ops = [how === "mark" ? { op: "mark_removed", run, from } : { op: "cut_run", run, from }];
    }
    const deps = how === "run" || how === "cut" ? E.dependents(d, run, from) : [];
    if (deps.length) { st.mode = "confirm"; st.confirm = { ops, deps, f }; say(null); return render(); }
    commit(ops);
  }
  function commit(ops) {
    const r = E.apply(base().data, st.draft.concat(ops));
    if (r.error) { say(r.error, "bad"); return render(); }
    pushDraft(ops);
    st.mode = "idle"; st.confirm = null; st.sel = null;
    say("Added to your changes.", "ok");
    render();
  }
  function pushDraft(ops) {
    if (!st.draft.length) st.baseVersion = S.version;
    st.draft = st.draft.concat(ops); st.groups = st.groups.concat(ops.length);
    saveDraft();
  }

  // ----- sending, publishing and reviewing -----
  // Split edited data (main survey and layers together) back into the main survey and each layer. A run keeps the
  // layer it was in; a new run goes with the run it starts from (so a line added off a black diamond line is black
  // diamond too). Landmarks go with the run that marks them, or stay where they were.
  const SAVES = e => (e.type === "SaveLandmark" || e.type === "SavedStake") && e.landmark ? e.landmark : null;
  function splitBack(b, d) {
    const saver = {};
    for (const [run, r] of Object.entries(d.runs)) for (const e of r) { const k = SAVES(e); if (k && !saver[k]) saver[k] = run; }
    const memo = {};
    const owner = (run, seen) => {
      if (run in memo) return memo[run];
      if (b.runLayer[run]) return (memo[run] = b.runLayer[run]);
      if (b.data.runs[run]) return (memo[run] = "");   // was on the main survey already
      seen = seen || new Set([run]);
      const step = d.plan.find(p => p.run === run || p.run2 === run), from = step && saver[step.start];
      if (!from || seen.has(from)) return (memo[run] = "");
      seen.add(from);
      return (memo[run] = owner(from, seen));
    };
    const ids = [""].concat(S.layers.filter(l => l.kind === "survey" && l.survey).map(l => l.id));
    const parts = Object.fromEntries(ids.map(id => [id, { runs: {}, plan: [], landmarks: {}, runNames: {} }]));
    const part = id => parts[id] || parts[""];
    for (const [run, r] of Object.entries(d.runs)) { const p = part(owner(run)); p.runs[run] = r; if (d.runNames[run] != null) p.runNames[run] = d.runNames[run]; }
    for (const step of d.plan) part(owner(step.run)).plan.push(step);
    const hadIn = k => { const l = S.layers.find(x => x.kind === "survey" && x.survey && x.survey.landmarks && k in x.survey.landmarks); return l ? l.id : ""; };
    for (const [k, v] of Object.entries(d.landmarks)) part(saver[k] ? owner(saver[k]) : hadIn(k)).landmarks[k] = v;
    const green = Object.assign({}, S.data, parts[""]), layers = [];
    if (window.SurveyGeometry && window.SurveyGeometry.stampGeoref) window.SurveyGeometry.stampGeoref(green, Object.assign({}, d, { georef: green.georef }));
    for (const l of S.layers.filter(x => x.kind === "survey" && x.survey)) {
      const survey = Object.assign({}, l.survey, parts[l.id]);
      const was = JSON.stringify({ runs: l.survey.runs || {}, plan: l.survey.plan || [], landmarks: l.survey.landmarks || {}, runNames: l.survey.runNames || {} });
      if (JSON.stringify({ runs: survey.runs, plan: survey.plan, landmarks: survey.landmarks, runNames: survey.runNames }) !== was) layers.push({ layer: l, survey });
    }
    return { green, layers };
  }

  async function send() {
    if (!st.draft.length) return;
    const r = current();
    if (r.error) { say("Your changes no longer fit the map: " + r.error + " Undo the last change or start over.", "bad"); return render(); }
    if (!st.summary.trim()) { say("Say what you changed, who surveyed it and when.", "bad"); return render(); }
    if (isAdmin() && S.layersError) { say("The other levels' lines didn't load, so publishing now could mix them up. Refresh the page, then publish.", "bad"); return render(); }
    st.busy = true; render();
    try {
      if (isAdmin()) {
        const sp = splitBack(base(), r.data);
        // Save the layers first, so lines are never lost, then publish the main survey; put the layers back if that fails.
        const saved = [];
        try {
          for (const x of sp.layers) {
            const u = await C.client.from("site_map_layers").update({ survey: x.survey }).eq("id", x.layer.id);
            if (u.error) throw u.error;
            saved.push(x.layer);
          }
          const { data, error } = await C.client.rpc("publish_site_map", { site, new_data: sp.green, expected_version: S.version, summary: st.summary.trim(), edit_id: null });
          if (error) throw error;
          S.setPublished(sp.green, data, new Date().toISOString());
          say(`Published as version ${S.versionName()}.`, "ok");
          st.history = null;
        } catch (err) {
          // A timeout can come back after the publish went through anyway: then the layers saved above belong with
          // it and must stay. Only put them back when the main survey really wasn't published.
          let landed = false;
          try { const q = await C.client.from("site_maps").select("version").eq("id", site).maybeSingle(); landed = !q.error && q.data && q.data.version > S.version; } catch (e) { /* treat as not published */ }
          if (landed) { say("Supabase was slow, but it was published. Refreshing the page shows it.", "ok"); st.draft = []; st.groups = []; saveDraft(); st.busy = false; return render(); }
          for (const l of saved) await C.client.from("site_map_layers").update({ survey: l.survey }).eq("id", l.id);
          throw err;
        }
        if (sp.layers.length && S.reloadLayers) await S.reloadLayers();
      } else {
        const id = crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
        const { error } = await C.client.from("site_map_edits").insert({ id, site_id: site, summary: st.summary.trim(), changes: st.draft, base_version: st.baseVersion });
        if (error) throw error;
        // Tell Jamie on Telegram (supabase/functions/notify-signup). Best effort.
        if (C.client.functions) Promise.resolve(C.client.functions.invoke("notify-signup", { body: { mapEdit: id } })).catch(() => {});
        say("Sent. An Admin will look at your changes and put them on the map.", "ok");
      }
      st.draft = []; st.groups = []; st.summary = ""; saveDraft();
      await loadLists();
    } catch (err) { say(C.explain(err), "bad"); }
    st.busy = false; render();
  }

  async function loadLists() {
    if (!C || !C.user) return;
    const q = C.client.from("site_map_edits").select("id, author, author_name, summary, changes, base_version, status, review_note, created_at, reviewed_at").eq("site_id", site);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(100);
    if (error) { say(C.explain(error), "bad"); return; }
    st.mine = data.filter(x => x.author === C.user.id).slice(0, 20);
    st.pending = isAdmin() ? data.filter(x => x.status === "pending").reverse() : [];
    if (isAdmin() && !st.history) {
      const hq = cols => C.client.from("site_map_history").select(cols).eq("site_id", site).order("version", { ascending: false }).limit(30);
      let h = await hq("version, label, summary, published_at, published_by_name");
      if (h.error && /label/.test(h.error.message || "")) h = await hq("version, summary, published_at, published_by_name");
      st.history = h.error ? [] : h.data;
    }
  }

  // "2.0.3", or "old version 4" from before the names started.
  function vname(v) { const h = (st.history || []).find(x => x.version === v); return h && h.label ? `version ${h.label}` : `old version ${v}`; }
  function reviewEdit(ed) {
    const r = E.apply(S.data, ed.changes);
    st.review = { kind: "edit", focus: true, edit: ed, data: r.data, error: r.error, failedAt: r.failedAt, warnings: r.error ? [] : window.SurveyGeometry.compute(r.data).warnings };
    say(null);
  }
  async function reviewVersion(v) {
    if (v === 0) { st.review = { kind: "version", focus: true, version: 0, data: fileData, error: null, warnings: [] }; return; }
    const { data, error } = await C.client.from("site_map_history").select("data").eq("site_id", site).eq("version", v).single();
    if (error) { say(C.explain(error), "bad"); return; }
    st.review = { kind: "version", focus: true, version: v, data: data.data, error: null, warnings: [] };
  }
  async function approve() {
    const rv = st.review;
    if (!rv || rv.error) return;
    st.busy = true; render();
    try {
      const summary = rv.kind === "edit" ? `${rv.edit.author_name || "A member"}: ${rv.edit.summary}` : (rv.version ? `Put back ${vname(rv.version)}` : "Put back the original survey map");
      if (rv.kind === "version" && !rv.data.georef && S.data.georef) rv.data = Object.assign({}, rv.data, { georef: S.data.georef });
      const { data, error } = await C.client.rpc("publish_site_map", { site, new_data: rv.data, expected_version: S.version, summary, edit_id: rv.kind === "edit" ? rv.edit.id : null });
      if (error) throw error;
      S.setPublished(rv.data, data, new Date().toISOString());
      say(`Published as version ${S.versionName()}.`, "ok");
      st.review = null; st.history = null;
      await loadLists();
    } catch (err) { say(C.explain(err), "bad"); }
    st.busy = false; render();
  }
  async function decline(id, note) {
    st.busy = true; render();
    const { error } = await C.client.rpc("decline_site_map_edit", { edit_id: id, note: note || "" });
    if (error) say(C.explain(error), "bad"); else { say("Declined. The member will see your note.", "ok"); st.review = null; st.declining = null; await loadLists(); }
    st.busy = false; render();
  }
  async function withdraw(id) {
    const { error } = await C.client.rpc("withdraw_site_map_edit", { edit_id: id });
    if (error) say(C.explain(error), "bad"); else { say("Taken back.", "ok"); await loadLists(); }
    render();
  }

  // ----- drawing the panel -----
  // The symbol a landmark has now, in the map being edited (with the changes so far).
  function curIcon(f) {
    for (const r of Object.values(current().data.runs)) for (const e of r) if (e.type === "SaveLandmark" && e.landmark === f.landmark) return e.icon_path || "";
    return "";
  }
  function selCard() {
    const f = st.sel;
    if (!f) return `<p class="hint">Tap a stake, tie-off, landmark or line on the map. Then add a new line from it, or delete or mark as removed the line it's on.</p>
      <div class="se-acts"><button type="button" class="btn" data-act="pt-start">Add a point on the map</button></div>`;
    const d = current().data, r = f.run && d.runs[f.run];
    const after = r ? (f.kind === "segment" ? f.index : f.index + 1) : 0;
    const hasAfter = r && r.slice(after).some(e => E.LINE.test(e.type) || e.type === "Jump");
    const onRun = !!r;
    return `<div class="se-card"><span class="eyebrow">Selected</span><b>${esc(describeFeature(f))}</b>
      <div class="se-acts">
        <button type="button" class="btn primary" data-act="add">${f.kind === "segment" ? "Add a line from the end of this line" : "Add a line from here"}</button>
        ${onRun && hasAfter ? `<button type="button" class="btn" data-act="cut">${f.kind === "segment" ? "Delete this line and the rest of the run" : "Delete the rest of this run from here"}</button>
          <button type="button" class="btn" data-act="mark">${f.kind === "segment" ? "Mark as removed line from here" : "Mark the rest as removed line"}</button>` : ""}
        ${f.kind === "segment" ? `<button type="button" class="btn" data-act="drop">Take out just this line</button>` : ""}
        ${(f.kind === "stake" || f.kind === "tieoff") && r && r[f.index] && E.MOVABLE.test(r[f.index].type) ? `<button type="button" class="btn" data-act="move">Move it</button>
          <button type="button" class="btn" data-act="del-point">Delete just this ${f.kind === "tieoff" ? "tie-off" : "stake"}</button>` : ""}
        ${f.kind === "landmark" && !f.origin ? `<label class="se-sym">Symbol ${symbolSelect(curIcon(f), 'id="se-sym"')}</label>
          <button type="button" class="btn" data-act="set-icon">Change the symbol</button>` : ""}
        ${onRun ? `<button type="button" class="btn danger" data-act="run">Delete the whole run: ${esc(S.runName(f.run))}</button>` : ""}
        <button type="button" class="btn" data-act="unselect">Cancel</button></div>
      ${f.kind === "segment" ? `<p class="hint">"Take out just this line" keeps everything after it where it is. "Mark as removed line" keeps it on the map in grey, for line that was pulled.</p>` : ""}</div>`;
  }

  function addForm() {
    const a = st.add;
    const rows = a.rows.map((r, i) => {
      const s = rowState(r);
      return `<fieldset class="se-row" data-row="${i}"><legend>Line ${i + 1}</legend>
        <label>Type <select data-f="type"><option value="SurveyedLine"${r.type === "SurveyedLine" ? " selected" : ""}>Surveyed</option>
          <option value="UnsurveyedLine"${r.type === "UnsurveyedLine" ? " selected" : ""}>Unsurveyed</option>
          <option value="PlatformLine"${r.type === "PlatformLine" ? " selected" : ""}>Platform</option>
          <option value="Jump"${r.type === "Jump" ? " selected" : ""}>Jump (not drawn)</option></select></label>
        <label>Feet <input data-f="ft" inputmode="decimal" value="${esc(r.ft)}" size="5"></label>
        <label>Inches <input data-f="inch" inputmode="decimal" value="${esc(r.inch)}" size="3"></label>
        <label>Heading ° <input data-f="angle" inputmode="decimal" value="${esc(r.angle)}" size="4"></label>
        <label>At the end <select data-f="end">${[["none", "Nothing"], ["stake", "Stake"], ["tieoff", "Tie-off"], ["landmark", "A landmark"]]
          .map(([v, l]) => `<option value="${v}"${r.end === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        ${r.end === "landmark" ? `<label>Landmark name <input data-f="lmName" value="${esc(r.lmName)}" maxlength="120"></label>` : ""}
        <label>Depth ft <input data-f="depth" inputmode="decimal" value="${esc(r.depth)}" size="4"></label>
        ${a.rows.length > 1 ? `<button type="button" class="btn se-x" data-act="row-del" data-i="${i}" aria-label="Remove line ${i + 1}">✕</button>` : ""}
        <p class="se-err" data-err="${i}"${s.error ? "" : " hidden"}>${esc(s.error || "")}</p></fieldset>`;
    }).join("");
    return `<div class="se-card"><span class="eyebrow">New line</span>
      <p>Starts at <b>${esc(a.start.label)}</b>. Enter it the way it's written in your notebook: each length, its compass heading, and what's at the end.</p>
      <label class="se-wide">Name of this run <input data-f="name" value="${esc(a.name)}" maxlength="120"></label>
      ${rows}
      <button type="button" class="btn" data-act="row-add">+ Another line</button>
      <div class="se-end"><b>Does it finish at a point already on the map?</b>
        ${a.end ? `<p>Ends at <b>${esc(a.end.label)}</b>. The new line will be stretched and turned a little to meet it, like the loops on the map.</p>
          <button type="button" class="btn" data-act="end-clear">It doesn't end there</button>`
          : a.pickingEnd ? `<p class="se-pick">Tap the stake, tie-off, landmark or line end it finishes at.</p><button type="button" class="btn" data-act="end-cancel">Cancel</button>`
          : `<button type="button" class="btn" data-act="end-pick">Pick the point it ends at</button>`}</div>
      <p class="se-err" id="se-preview-err" hidden></p>
      <div class="se-acts"><button type="button" class="btn primary" data-act="add-save">Add to my changes</button>
        <button type="button" class="btn" data-act="add-cancel">Cancel</button></div></div>`;
  }

  function confirmCard() {
    const c = st.confirm;
    return `<div class="se-card warn"><span class="eyebrow">Lines that start from it</span>
      <p>These runs start from the part you're deleting, so they'd have nothing to hang from:</p>
      <ul>${c.deps.map(r => `<li>${esc(S.runName(r))}</li>`).join("")}</ul>
      <div class="se-acts"><button type="button" class="btn danger" data-act="confirm-all">Delete them too</button>
        <button type="button" class="btn" data-act="confirm-mark">Mark as removed line instead</button>
        <button type="button" class="btn" data-act="confirm-cancel">Cancel</button></div></div>`;
  }

  function reviewCard() {
    const rv = st.review;
    const title = rv.kind === "edit" ? `Suggestion from ${esc(rv.edit.author_name || "a member")}` : rv.version ? esc(vname(rv.version).replace(/^./, c => c.toUpperCase())) : "The original survey map";
    const old = rv.kind === "edit" && rv.edit.base_version !== S.version;
    return `<div class="se-card review"><span class="eyebrow">Preview</span><b>${title}</b>
      ${rv.kind === "edit" ? `<p>${esc(rv.edit.summary)}</p><ol>${E.describeAll(S.data, rv.edit.changes).map((t, i) => `<li${i === rv.failedAt ? ' class="bad"' : ""}>${esc(t)}</li>`).join("")}</ol>` : ""}
      <p class="hint">On the map: new in orange, deleted in red.</p>
      ${old ? `<p class="se-err">Made on an older version of the map; it has been published again since. Check the preview carefully.</p>` : ""}
      ${rv.error ? `<p class="se-err">It doesn't fit the map any more: ${esc(rv.error)} Decline it and ask them to make it again.</p>` : ""}
      ${rv.warnings.length ? `<p class="se-err">${rv.warnings.map(esc).join("<br>")}</p>` : ""}
      <div class="se-acts">
        ${!rv.error ? `<button type="button" class="btn primary" data-act="approve"${st.busy ? " disabled" : ""}>${rv.kind === "edit" ? "Approve and publish" : "Put this version back"}</button>` : ""}
        ${rv.kind === "edit" ? (st.declining === rv.edit.id
          ? `<label class="se-wide">Note to the member (optional) <input id="se-decline-note" maxlength="500"></label>
             <button type="button" class="btn danger" data-act="decline-go">Decline</button>`
          : `<button type="button" class="btn" data-act="decline">Decline…</button>`) : ""}
        <button type="button" class="btn" data-act="review-close">Back</button></div></div>`;
  }

  function render() {
    if (!st.open) { panel.hidden = true; work.classList.remove("editing"); return; }
    panel.hidden = false; work.classList.add("editing");
    if (!C || !C.available) { panel.innerHTML = `<p>Editing needs the online service, which couldn't be loaded. Refresh the page to try again.</p>`; return; }
    if (!C.user) {
      panel.innerHTML = `<div class="se-head"><h2>Edit the map</h2><button type="button" class="btn" data-act="close">Close</button></div>
        <p>Survey crew: log in with your Limitless Diving account to suggest changes. An Admin checks each one before it goes on the map.</p>
        <a class="btn primary" href="account.html#then=map-${esc(site)}">Log in</a>`;
      return;
    }
    const descs = E.describeAll(base().data, st.draft), cur = current();
    const body = st.review ? reviewCard() : st.mode === "add" ? addForm() : st.mode === "point" ? pointForm() : st.mode === "move" ? moveForm() : st.mode === "confirm" ? confirmCard() : selCard();
    panel.innerHTML = `<div class="se-head"><h2>Edit the map</h2><button type="button" class="btn" data-act="close">Done</button></div>
      ${st.msg ? `<p class="se-msg ${st.msg.kind}" role="status">${esc(st.msg.text)}</p>` : ""}
      ${body}
      ${st.review ? "" : `<section class="se-sec"><h3>Your changes${st.groups.length ? ` (${st.groups.length})` : ""}</h3>
        ${st.draft.length ? `<ol class="se-list">${descs.map((t, i) => `<li${i === cur.failedAt ? ' class="bad"' : ""}>${esc(t)}</li>`).join("")}</ol>
          ${cur.error ? `<p class="se-err">The map has changed since you made these: ${esc(cur.error)}</p>` : ""}
          <div class="se-acts"><button type="button" class="btn" data-act="undo">Undo last change</button><button type="button" class="btn" data-act="clear">Start over</button></div>
          <label class="se-wide">${isAdmin() ? "What's changing (kept in the map's history)" : "For the Admins: what you changed, who surveyed it and when"}
            <textarea id="se-summary" rows="3" maxlength="1500">${esc(st.summary)}</textarea></label>
          <button type="button" class="btn primary" data-act="send"${st.busy || cur.error ? " disabled" : ""}>${isAdmin() ? "Publish to the map" : "Send for approval"}</button>`
          : `<p class="hint">Nothing yet. Changes show on the map in orange (new) and red (deleted) until they're ${isAdmin() ? "published" : "approved"}.</p>`}</section>`}
      ${isAdmin() && !st.review ? `<section class="se-sec"><h3>Suggestions to review${st.pending.length ? ` (${st.pending.length})` : ""}</h3>
        ${st.pending.length ? `<ul class="se-list plain">${st.pending.map(x => `<li><b>${esc(x.author_name || "A member")}</b> · ${esc(when(x.created_at))}<br>${esc(x.summary)}
          <br><button type="button" class="btn" data-act="review" data-id="${esc(x.id)}">Preview and review</button></li>`).join("")}</ul>` : `<p class="hint">None waiting.</p>`}</section>
        <section class="se-sec"><h3>History</h3>${st.history && st.history.length ? `<ul class="se-list plain">${st.history.map(h => `<li><b>${h.label ? `Version ${esc(h.label)}` : `Old version ${h.version}`}</b>${h.version === S.version ? " (on the map now)" : ""} · ${esc(when(h.published_at))}${h.published_by_name ? " · " + esc(h.published_by_name) : ""}<br>${esc(h.summary)}
          ${h.version !== S.version ? `<br><button type="button" class="btn" data-act="version" data-v="${h.version}">Preview</button>` : ""}</li>`).join("")}
          ${hasFile ? `<li><b>Original survey map</b> (${esc(fileData.version || "")})<br><button type="button" class="btn" data-act="version" data-v="0">Preview</button></li>` : ""}</ul>`
          : `<p class="hint">Not published yet.${hasFile ? ` The map shows the original survey (${esc(fileData.version || "")}).` : ""}</p>`}</section>` : ""}
      ${!isAdmin() && st.mine.length && !st.review ? `<section class="se-sec"><h3>Your suggestions</h3><ul class="se-list plain">${st.mine.map(x => `<li>${esc(when(x.created_at))} · <b class="se-status ${esc(x.status)}">${esc({ pending: "Waiting for an Admin", approved: "On the map", declined: "Declined", withdrawn: "Taken back" }[x.status] || x.status)}</b>
          <br>${esc(x.summary)}${x.review_note ? `<br><i>Admin's note: ${esc(x.review_note)}</i>` : ""}
          ${x.status === "pending" ? `<br><button type="button" class="btn" data-act="withdraw" data-id="${esc(x.id)}">Take back</button>` : ""}</li>`).join("")}</ul></section>` : ""}`;
    preview();
  }

  // ----- events -----
  function pick(f, latlng) {
    if (st.review) return;
    if (st.mode === "point") { if (latlng) placeAt(latlng); return; }
    if (st.mode === "move") { if (latlng) moveAt(latlng); return; }
    if (st.mode === "add") {
      if (!st.add.pickingEnd) return;
      if (f.layer && !isAdmin()) { say("Pick a point on the main survey.", "bad"); return render(); }
      const d = current().data, a = anchor(f, d);
      if (a.key === st.add.start.key) { say("That's where the line starts. Pick the point it ends at.", "bad"); return render(); }
      st.add.end = a; st.add.pickingEnd = false; say(null);
      if (fillStraight()) say("Filled in a straight line between the two points. Change the length and heading if you measured them.", "ok");
      return render();
    }
    if (st.mode === "confirm" || st.mode === "point") return;
    if (f.layer && !isAdmin()) { st.sel = null; say("That line is in a rated layer. An Admin or Dive site admin changes it.", "bad"); return render(); }
    st.sel = f; say(null); render();
  }

  panel.addEventListener("click", async e => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "close") return close();
    try { await onAct(act, b); }
    catch (err) { console.error(err); say("Something went wrong: " + (err && err.message || err), "bad"); try { render(); } catch (e2) { console.error(e2); } }
  });
  async function onAct(act, b) {
    const f = st.sel;
    if (act === "unselect") { st.sel = null; return render(); }
    if (act === "add") { startAdd(f); return render(); }
    if (act === "cut" || act === "mark" || act === "run" || act === "drop") return startRemove(f, act);
    if (act === "row-add") { st.add.rows.push(newRow()); return render(); }
    if (act === "row-del") { st.add.rows.splice(Number(b.dataset.i), 1); return render(); }
    if (act === "end-pick") { st.add.pickingEnd = true; return render(); }
    if (act === "end-cancel") { st.add.pickingEnd = false; return render(); }
    if (act === "end-clear") { st.add.end = null; return render(); }
    if (act === "add-save") return saveAdd();
    if (act === "pt-start") { startPoint(); return render(); }
    if (act === "pt-save") return savePoint();
    if (act === "move") { startMove(f); return render(); }
    if (act === "del-point") return commit([{ op: "delete_point", run: f.run, index: f.index }]);
    if (act === "set-icon") {
      const icon = (panel.querySelector("#se-sym") || {}).value || "";
      if (icon === curIcon(f)) { say("That's the symbol it has already. Pick another one first.", "bad"); return render(); }
      return commit([{ op: "set_icon", landmark: f.landmark, icon }]);
    }
    if (act === "mv-save") return saveMove();
    if (act === "mv-cancel") { st.mode = "idle"; st.mv = null; setPlacing(false); say(null); return render(); }
    if (act === "pt-cancel") { st.mode = "idle"; st.pt = null; setPlacing(false); say(null); return render(); }
    if (act === "add-cancel") { st.mode = "idle"; st.add = null; say(null); return render(); }
    if (act === "confirm-all") return commit(st.confirm.ops.concat(st.confirm.deps.map(run => ({ op: "remove_run", run }))));
    if (act === "confirm-mark") { const o = st.confirm.ops[0]; return commit([{ op: "mark_removed", run: o.run, from: o.op === "remove_run" ? 0 : o.from }]); }
    if (act === "confirm-cancel") { st.mode = "idle"; st.confirm = null; return render(); }
    if (act === "undo") { const n = st.groups.pop() || 1; st.draft = st.draft.slice(0, -n); saveDraft(); say(null); return render(); }
    if (act === "clear") { st.draft = []; st.groups = []; saveDraft(); say(null); st.sel = null; return render(); }
    if (act === "send") return send();
    if (act === "review") { const ed = st.pending.find(x => x.id === b.dataset.id); if (ed) reviewEdit(ed); return render(); }
    if (act === "version") { await reviewVersion(Number(b.dataset.v)); return render(); }
    if (act === "review-close") { st.review = null; st.declining = null; return render(); }
    if (act === "approve") return approve();
    if (act === "decline") { st.declining = st.review.edit.id; return render(); }
    if (act === "decline-go") return decline(st.review.edit.id, (panel.querySelector("#se-decline-note") || {}).value);
    if (act === "withdraw") return withdraw(b.dataset.id);
  }

  // Typing in the add form updates the preview without redrawing the form, so the cursor stays put.
  function onField(e) {
    const el = e.target;
    if (el.id === "se-summary") { st.summary = el.value; saveDraft(); return; }
    if (el.name === "se-mv" && st.mv) { st.mv.free = el.value === "free"; st.mv.bend = null; st.mv.seg = null; say(null); return render(); }
    if (el.dataset.p && st.pt) {
      const p = el.dataset.p;
      st.pt[p] = p === "label" ? el.checked : el.value;
      preview();
      return;
    }
    const k = el.dataset.f;
    if (!k || !st.add) return;
    if (k === "name") { st.add.name = el.value; return; }
    const i = Number(el.closest("[data-row]").dataset.row), r = st.add.rows[i];
    r[k] = el.value;
    if (k === "end" && e.type === "change") return render();
    const s = rowState(r), err = panel.querySelector(`[data-err="${i}"]`);
    if (err) { err.hidden = !s.error || e.type === "input"; err.textContent = s.error || ""; }
    preview();
  }
  panel.addEventListener("input", onField);
  panel.addEventListener("change", onField);

  async function open() {
    st.open = true; S.editing = true;
    S.setPicker(pick);
    say(null); render();
    if (C && C.user) { await loadLists(); render(); }
  }
  // Done always closes the panel first, so a problem redrawing the map can't leave it stuck open
  // (Jamie 2026-11-24: "the done button does not do anything"). A redraw problem is shown under the map.
  function close() {
    st.open = false; S.editing = false; st.sel = null; st.review = null; st.mode = "idle"; st.add = null; st.confirm = null; st.pt = null; st.mv = null; setPlacing(false);
    render();
    try { S.setPicker(null); S.reset(); }
    catch (err) {
      console.error(err);
      const warn = document.getElementById("sm-warn");
      if (warn) { warn.hidden = false; warn.textContent = "The map couldn't be redrawn after editing (" + (err && err.message || err) + "). Refresh the page to see it."; }
    }
  }

  btn.addEventListener("click", () => (st.open ? close() : open()));
  S.onPublished(() => { if (st.open) render(); else S.show(S.data); });
  loadDraft();
  if (C && C.available && S.canEdit()) {
    btn.hidden = false;
    C.onChange(() => { if (st.open) { st.history = null; loadLists().then(render); } });
    S.adminListeners.push(() => { if (st.open) { st.history = null; loadLists().then(render); } });
  }
});
