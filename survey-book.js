/* Limitless Diving — Survey book: the site map's survey data, entered on the website the way the divers record it
   (station to station), instead of in the Google Sheet. On each site map page (e.g. bonnie-castle-map.html), for
   Admins and Dive site admins. Same rows and columns as the sheet (survey-sheet.js reads and writes them):
     A From  B To  C Depth @ B  D Back (B->A)  E Heading (A->B)  F Distance ft  (G m, unused here)  H Kind  I Note
     J Drawing  K Level.  A blank row starts a new line; a line's first row is its title (name, Level).
   One table per line on a computer, one card per leg on a phone (CSS). Mistakes show as you type and the map above
   shows the result (new lines orange, removed ones red). Publish sends the main map and the blue/black/double black
   layers together (publish_site_map_book). Unpublished work is kept in this browser. Prints survey slates: blank,
   or filled in with a line, in the same row order. Spreadsheet (CSV) download and load, for backups and moving over
   from the Google Sheet. Uses SurveyMap, SurveySheet, SurveyRatings, LDCloud. */
(window.SurveyMap ? window.SurveyMap.ready : Promise.resolve()).then(function () {
  "use strict";
  const S = window.SurveyMap, SS = window.SurveySheet, C = window.LDCloud;
  if (!S || !S.map || !SS || !C || !C.client) return;
  const esc = S.esc, site = S.site;
  const btn = document.getElementById("sm-book-btn");
  if (!btn) return;
  btn.hidden = !S.isSiteAdmin();
  const KEY = "ld-survey-book-" + site, SIGNAL = "ld-survey-book-published-" + site;
  // The book opens in its own tab: the same site map page with ?book, showing just the map and the book.
  const PAGE = new URLSearchParams(location.search).has("book");
  const bookUrl = () => location.pathname + "?book";
  const LEVELS = ["Green circle", "Blue square", "Black diamond", "Double black diamond", "Secret Squirrel"];
  const LEVEL_DOT = { "green circle": "#2e7d32", "blue square": "#1565c0", "black diamond": "#111", "double black diamond": "#111", "secret squirrel": "#111" };
  const KINDS = ["Surveyed", "Unsurveyed", "Platform", "Jump"];
  const str = v => (v == null ? "" : String(v)).trim();
  const blankRow = () => ["", "", "", "", "", "", "", "", "", "", ""];
  const isBlank = r => r.slice(0, 6).every(v => str(v) === "") && r.slice(7, 10).every(v => str(v) === "");
  // A new leg not filled in yet is a blank row that belongs to its line: marked in a 12th cell the sheet never reads.
  const held = r => r[11] === 1 && isBlank(r);
  const isTitle = r => str(r[0]) && [2, 3, 4, 5, 7].every(k => str(r[k]) === "") && (!str(r[1]) || /^(loop with |gps\b)/i.test(str(r[1])));
  const st = { open: false, rows: null, lm: [], base: 0, savedAt: null, check: null, msg: null, busy: false, summary: "", confirm: false, drawing: false, timer: null, warnOpen: false };
  // How much room the map above the book takes: each person's choice, kept in this browser.
  let mapSize = "small";
  try { mapSize = localStorage.getItem("sb-map-size") || "small"; } catch (e) { /* private window */ }
  if (!/^(large|small|off)$/.test(mapSize)) mapSize = "small";
  function applyMapSize() {
    host.classList.toggle("sb-map-small", mapSize === "small");
    host.classList.toggle("sb-map-off", mapSize === "off");
    setTimeout(() => S.map.invalidateSize(), 50);
  }

  // ----- the panel, under the map in the same box (so the map stays in view while you scroll the book) -----
  const work = document.getElementById("sm-work"), host = work.parentNode;
  const box = document.createElement("section");
  box.className = "sm-book"; box.id = "sm-book"; box.hidden = true; box.setAttribute("aria-label", "Survey book");
  host.appendChild(box);
  const printBox = document.createElement("div"); printBox.id = "sb-print"; document.body.appendChild(printBox);

  // ----- data in and out -----
  function ratedLayers() {
    const out = {};
    S.layers.filter(l => l.kind === "survey" && l.rating && l.survey).forEach(l => { out[l.rating] = l.survey; });
    return out;
  }
  function fromWebsite() {
    const j = SS.joinLevels(S.data, ratedLayers()), out = SS.fromSurvey(j.data, j.runLevel);
    return { rows: out.rows.map(r => r.slice(0, 11).map(v => v == null ? "" : v)), lm: out.landmarkRows };
  }
  const plain = rows => JSON.stringify(rows.filter(r => !held(r)).map(r => r.slice(0, 11).map(str)));
  function sameAsWebsite() { return plain(st.rows) === plain(fromWebsite().rows); }
  function current() { return SS.joinLevels(S.data, ratedLayers()).data; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ rows: st.rows, lm: st.lm, base: st.base, at: new Date().toISOString() })); } catch (e) { /* private window */ }
  }
  function loadDraft() {
    try { const d = JSON.parse(localStorage.getItem(KEY) || "null"); return d && Array.isArray(d.rows) ? d : null; } catch (e) { return null; }
  }
  function dropDraft() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

  // ----- checking, and the map preview -----
  function check() {
    // Legs not filled in yet are left out (a blank row would end the line); row numbers are mapped back.
    const keep = [], idx = [];
    st.rows.forEach((row, i) => { if (!held(row)) { keep.push(row.slice(0, 11)); idx.push(i); } });
    const r = SS.toSurvey(keep, st.lm, { id: site });
    const out = { errors: r.errors.slice(), warnings: r.warnings.slice(), data: null, sp: null, notes: [] };
    if (!out.errors.length) {
      const m = SS.mergeInto(S.data, r.data);
      out.errors.push(...m.errors); out.notes = m.notes;
      if (!m.errors.length) {
        const sp = SS.splitLevels(m.data, r.levels, r.stated);
        out.errors.push(...sp.errors); out.warnings.push(...sp.warnings);
        out.data = m.data; out.sp = sp;
        // Lines that would need stretching or turning more than 5% to join up are drawn as measured (Jamie 2026-11-25).
        const GG = window.SurveyGeometry;
        if (GG) for (const g of GG.compute(m.data).gaps) {
          const nm = r2 => m.data.runNames[r2] || r2;
          out.warnings.push(`${g.other ? `"${nm(g.other)}" and "${nm(g.run)}" don't` : `"${nm(g.run)}" doesn't`} join up: ${Math.round(g.ft * 10) / 10} ft off, more than the 5% the map will stretch a line. Drawn as measured. Check the tape and headings.`);
        }
      }
    }
    // Messages that name a row go under that row.
    out.byRow = {};
    out.other = { errors: [], warnings: [] };
    for (const kind of ["errors", "warnings"]) out[kind].forEach(t => {
      const m = /^Row (\d+)/.exec(t), at = m ? idx[+m[1] - 1] : null;
      if (at != null) (out.byRow[at] = out.byRow[at] || []).push({ kind, text: t.replace(/^Row \d+:\s*/, "") });
      else out.other[kind].push(t);
    });
    st.rows.forEach((r, i) => { const t = inchError(r); if (t) { (out.byRow[i] = out.byRow[i] || []).push({ kind: "errors", text: t }); out.errors.push(`Row ${i + 1}: ${t}`); } });
    st.check = out;
    preview();
  }
  function preview() {
    const c = st.check;
    if (!st.open || !c || !c.data) return;
    const runLayer = {};
    ["blue", "black", "double-black", "squirrel"].forEach(k => {
      const l = S.layers.find(x => x.kind === "survey" && x.rating === k), src = c.sp && c.sp.src[k];
      if (l && src) Object.keys(src.runs).forEach(r => { runLayer[r] = l.id; });
    });
    // The map marks entries it can't find in the published map as new (by object), so legs that didn't change
    // reuse the published ones: matched by line name, then leg by leg.
    const base = current(), byName = {};
    Object.keys(base.runs).forEach(k => { byName[(base.runNames || {})[k] || k] = base.runs[k]; });
    const shown = Object.assign({}, c.data, { runs: {} });
    Object.keys(c.data.runs).forEach(k => {
      const old = base.runs[k] || byName[(c.data.runNames || {})[k] || k] || [];
      shown.runs[k] = c.data.runs[k].map((e, i) => old[i] && JSON.stringify(old[i]) === JSON.stringify(e) ? old[i] : e);
    });
    try { S.show(shown, { runLayer, base }); } catch (e) { console.error(e); }
  }
  function later() { clearTimeout(st.timer); st.timer = setTimeout(() => { check(); drawChecks(); }, 450); }

  // ----- feet and inches (the sheet keeps decimal feet in F) -----
  const ftIn = v => {
    const f = Number(str(v)); if (str(v) === "" || !isFinite(f)) return [str(v), ""];
    const whole = Math.floor(f + 1e-9), inch = Math.round((f - whole) * 12 * 100) / 100;
    return inch >= 12 ? [String(whole + 1), ""] : [String(whole), inch ? String(inch) : ""];
  };
  function inchError(r) { return r.inch != null && r.inch !== "" && !(Number(r.inch) >= 0 && Number(r.inch) < 12) ? "Inches must be 0 to 11." : null; }

  // ----- drawing the book -----
  function blocks() {
    // [{ title: index or null, legs: [indexes] }], and the starting-point row.
    const out = []; let cur = null, origin = null;
    st.rows.forEach((r, i) => {
      if (i === 0 && /^from/i.test(str(r[0]))) return;
      if (isBlank(r) && !held(r)) { cur = null; return; }
      if (!out.length && origin == null && !str(r[0]) && str(r[1]) && str(r[4]) === "" && str(r[5]) === "") { origin = i; return; }
      if (!cur) { cur = { title: null, legs: [] }; out.push(cur); }
      if (cur.title == null && !cur.legs.length && isTitle(r)) { cur.title = i; return; }
      cur.legs.push(i);
    });
    return { list: out, origin };
  }
  const sel = (i, c, opts, extra) => `<select data-r="${i}" data-c="${c}" aria-label="${extra}">${opts.map(([v, l]) => `<option value="${esc(v)}"${str(st.rows[i][c]).toLowerCase() === v.toLowerCase() ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  function kindOpts(v) {
    const o = KINDS.map(k => [k, k]); if (v && !KINDS.some(k => k.toLowerCase() === v.toLowerCase())) o.push([v, v]);
    return o;
  }
  function legRow(i, n) {
    const r = st.rows[i], [ft, inch] = r.inch != null ? [r.ftPart, r.inch] : ftIn(r[5]);
    const inp = (c, label, cls, val) => `<label class="sb-c sb-${cls}"><span>${label}</span><input data-r="${i}" data-c="${c}" value="${esc(val != null ? val : str(r[c]))}"${/^(2|3|4)$/.test(String(c)) || c === "ft" || c === "in" ? ' inputmode="decimal"' : ""} autocomplete="off"></label>`;
    return `<div class="sb-row" data-row="${i}"><span class="sb-n">${n}</span>
      ${inp(0, "From", "from")}<span class="sb-arrow" aria-hidden="true">→</span>${inp(1, "To", "to")}
      ${inp(2, "Depth ft", "depth")}${inp(4, "Heading °", "hdg")}${inp(3, "Back °", "back")}
      ${inp("ft", "Feet", "ft", ft)}${inp("in", "In", "in", inch)}
      <label class="sb-c sb-kind"><span>Kind</span>${sel(i, 7, kindOpts(str(r[7])).concat(str(r[7]) ? [] : []), "Kind")}</label>
      <label class="sb-c sb-level"><span>Level from here</span>${sel(i, 10, [["", "—"]].concat(LEVELS.map(l => [l, l])), "Level from here")}</label>
      ${inp(8, "Note", "note")}${st.drawing ? inp(9, "Drawing", "draw") : ""}
      <span class="sb-acts"><button type="button" class="sb-x" data-sb="row-ins" data-i="${i}" title="Add a leg after this one" aria-label="Add a leg after leg ${n}">+</button><button type="button" class="sb-x" data-sb="row-del" data-i="${i}" title="Remove this leg" aria-label="Remove leg ${n}">✕</button></span>
      <div class="sb-msgs" data-msgs="${i}"></div></div>`;
  }
  function blockHtml(b, k) {
    const t = b.title != null ? st.rows[b.title] : null, lv = t ? str(t[10]) : "";
    const legs = b.legs.length, feet = b.legs.reduce((s, i) => s + (Number(str(st.rows[i][5])) || 0), 0);
    return `<div class="sb-line${st.drawing ? " drawing" : ""}" data-block="${k}">
      <div class="sb-lh">${t ? `<input class="sb-name" data-r="${b.title}" data-c="0" value="${esc(str(t[0]))}" aria-label="Line name">` : `<b class="sb-name">Line ${k + 1}</b>`}
        ${t ? `<label class="sb-lv"><span class="sb-dot" style="background:${LEVEL_DOT[lv.toLowerCase()] || LEVEL_DOT["green circle"]}"></span>${sel(b.title, 10, [["", "Green circle"]].concat(LEVELS.slice(1).map(l => [l, l])), "Line level")}</label>
          <label class="sb-join"><span>Loop with / GPS</span><input data-r="${b.title}" data-c="1" value="${esc(str(t[1]))}" placeholder="optional" autocomplete="off"></label>
          <label class="sb-check" title="Show this line's name along it on the map"><input type="checkbox" data-sb="runlabel" data-t="${b.title}"${/show name\s*=\s*(yes|y|true|1)/i.test(str(t[9])) ? " checked" : ""}> Label on map</label>` : ""}
        <span class="sb-sum">${legs} leg${legs === 1 ? "" : "s"} · ${Math.round(feet)} ft</span>
        <span class="sb-lacts"><button type="button" class="btn small" data-sb="show" data-k="${k}">Show on map</button>
          <button type="button" class="btn small" data-sb="print" data-k="${k}">Print slate</button>
          <button type="button" class="btn small" data-sb="line-del" data-k="${k}">Delete line</button></span></div>
      ${t ? `<div class="sb-msgs" data-msgs="${b.title}"></div>` : ""}
      <div class="sb-head" aria-hidden="true"><span>#</span><span>From</span><span></span><span>To</span><span>Depth ft</span><span>Heading °</span><span>Back °</span><span>Feet</span><span>In</span><span>Kind</span><span>Level from here</span><span>Note</span>${st.drawing ? "<span>Drawing</span>" : ""}<span></span></div>
      ${b.legs.map((i, n) => legRow(i, n + 1)).join("")}
      <button type="button" class="btn small sb-add" data-sb="leg-add" data-k="${k}">+ Add a leg</button></div>`;
  }
  function render() {
    if (!st.open) { box.hidden = true; box.innerHTML = ""; return; }
    const bl = blocks(), o = bl.origin != null ? st.rows[bl.origin] : null;
    const changed = !sameAsWebsite();
    const stale = st.base !== S.version;
    box.hidden = false;
    box.innerHTML = `<div class="sb-top"><h2 class="sec">Survey book</h2>
        <span class="sb-ver">Version ${esc(S.versionName ? S.versionName() : String(S.version))} on the map${changed ? " · <b>changes not published yet</b>" : ""}</span>
        <button type="button" class="btn" data-sb="close">${PAGE ? "Close this tab" : "Close"}</button></div>
      <p class="hint">Enter the survey the way it's written on the slate: one row per leg, from station to station. <b>To</b> is Rock for a tie-off,
        Stake for a stake, or the station's name. Mistakes show in red as you type, and the map above shows the result (new lines in orange, removed ones in red).
        Your work is kept in this browser until you publish.</p>
      ${stale ? `<p class="se-err">The map was published again (version ${esc(S.versionName ? S.versionName() : String(S.version))}) since this book was started from version ${esc(String(st.base))}. Publishing will replace those changes. To see them, use <b>Start from the website</b> (this drops your unpublished work).</p>` : ""}
      <div class="sb-bar"><button type="button" class="btn primary" data-sb="line-add">+ New line</button>
        <button type="button" class="btn" data-sb="print-blank">Print blank slate</button>
        <button type="button" class="btn" data-sb="csv">Download spreadsheet</button>
        <label class="btn sb-file">Load spreadsheet (CSV)<input type="file" accept=".csv,text/csv" data-sb="csv-in" hidden></label>
        <button type="button" class="btn" data-sb="reload">Start from the website</button>
        <label class="sb-check"><input type="checkbox" data-sb="drawing"${st.drawing ? " checked" : ""}> Drawing column</label>
        <label class="sb-check">Map <select data-sb="mapsize">${[["large", "Large"], ["small", "Small"], ["off", "Hidden"]].map(([v, t]) => `<option value="${v}"${mapSize === v ? " selected" : ""}>${t}</option>`).join("")}</select></label></div>
      <div class="sb-origin"><b>Starting point</b> (every line is measured from here):
        ${o ? `<label><span>Station</span><input data-r="${bl.origin}" data-c="1" value="${esc(str(o[1]))}"></label><label><span>Depth ft</span><input data-r="${bl.origin}" data-c="2" inputmode="decimal" value="${esc(str(o[2]))}"></label>` : "<i>none yet</i>"}</div>
      <div class="sb-lines">${bl.list.map(blockHtml).join("")}</div>
      <div class="sb-pub" id="sb-pub"></div>`;
    drawChecks();
  }
  function drawChecks() {
    if (!st.open) return;
    const c = st.check || { byRow: {}, other: { errors: [], warnings: [] }, errors: [], warnings: [], notes: [] };
    box.querySelectorAll("[data-msgs]").forEach(el => {
      const i = +el.dataset.msgs, list = c.byRow[i] || [];
      el.innerHTML = list.map(m => `<p class="${m.kind === "errors" ? "sb-err" : "sb-warn"}">${esc(m.text)}</p>`).join("");
      const row = el.closest(".sb-row"); if (row) row.classList.toggle("bad", list.some(m => m.kind === "errors"));
    });
    const pub = box.querySelector("#sb-pub"); if (!pub) return;
    const nErr = c.errors.length, nWarn = c.warnings.length;
    pub.innerHTML = `${c.other.errors.length ? `<div class="sb-err"><b>Fix these to publish:</b><ul>${c.other.errors.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
      ${c.other.warnings.length || c.notes.length ? `<details class="sb-warn" data-sb="warn"${st.warnOpen ? " open" : ""}><summary><b>Worth a look (${c.other.warnings.length + c.notes.length})</b></summary><ul>${c.other.warnings.concat(c.notes).map(t => `<li>${esc(t)}</li>`).join("")}</ul></details>` : ""}
      ${st.msg ? `<p class="se-msg ${st.msg.kind}" role="status">${esc(st.msg.text)}</p>` : ""}
      <div class="sb-pubrow"><label class="sb-what"><span>What changed? (for the map's history)</span><input id="sb-summary" maxlength="300" value="${esc(st.summary)}" placeholder="e.g. Added the Saddle spur from Sunday's dive"></label>
        <button type="button" class="btn primary" data-sb="publish"${st.busy || nErr ? " disabled" : ""}>${st.busy ? "Publishing…" : nErr ? `Fix ${nErr} problem${nErr === 1 ? "" : "s"} to publish` : st.confirm ? "Publish anyway" : "Publish to the map"}</button></div>
      ${nWarn && !nErr ? `<p class="hint">${nWarn} thing${nWarn === 1 ? "" : "s"} worth a look (in orange); you can still publish.</p>` : ""}`;
  }

  // ----- editing -----
  box.addEventListener("input", e => {
    const el = e.target;
    if (el.id === "sb-summary") { st.summary = el.value; return; }
    if (!el.dataset || el.dataset.r == null) return;
    const i = +el.dataset.r, c = el.dataset.c, r = st.rows[i];
    if (c === "ft" || c === "in") {
      const row = el.closest(".sb-row"), ft = row.querySelector('[data-c="ft"]').value.trim(), inch = row.querySelector('[data-c="in"]').value.trim();
      r.ftPart = ft; r.inch = inch;
      const f = Number(ft || 0) + (Number(inch) >= 0 && Number(inch) < 12 ? Number(inch || 0) / 12 : 0);
      r[5] = ft === "" && inch === "" ? "" : (isFinite(f) ? Math.round(f * 10000) / 10000 : ft); r[6] = "";
    } else r[+c] = el.value;
    st.confirm = false; st.msg = null;
    save(); later();
  });
  box.addEventListener("toggle", e => { if (e.target.dataset && e.target.dataset.sb === "warn") st.warnOpen = e.target.open; }, true);
  box.addEventListener("change", async e => {
    const el = e.target;
    if (el.dataset.sb === "drawing") { st.drawing = el.checked; return render(); }
    if (el.dataset.sb === "runlabel") {
      const r = st.rows[+el.dataset.t], rest = str(r[9]).split(";").map(x => x.trim()).filter(x => x && !/^show name\s*=/i.test(x));
      r[9] = (el.checked ? ["show name = yes"] : []).concat(rest).join("; ");
      st.confirm = false; st.msg = null; save(); check(); return drawChecks();
    }
    if (el.dataset.sb === "mapsize") { mapSize = el.value; try { localStorage.setItem("sb-map-size", mapSize); } catch (x) { /* ignore */ } return applyMapSize(); }
    if (el.dataset.sb === "csv-in" && el.files[0]) {
      const text = await el.files[0].text(), rows = parseCsv(text).map(r => Array.from({ length: 11 }, (_, k) => r[k] == null ? "" : r[k]));
      if (!rows.length) { st.msg = { kind: "bad", text: "That file has no rows." }; return render(); }
      st.rows = rows; st.confirm = false; save(); check();
      st.msg = { kind: "ok", text: `Loaded ${rows.length} rows from ${el.files[0].name}. Check the lines and the map, then publish.` };
      return render();
    }
    if (el.tagName === "SELECT" && el.dataset.r != null) { st.rows[+el.dataset.r][+el.dataset.c] = el.value; save(); check(); render(); }
  });
  box.addEventListener("click", async e => {
    const b = e.target.closest("[data-sb]"); if (!b || b.tagName === "INPUT" || b.tagName === "SELECT" || b.tagName === "DETAILS") return;
    const act = b.dataset.sb, bl = blocks();
    const blk = b.dataset.k != null ? bl.list[+b.dataset.k] : null;
    const lastOf = x => Math.max(x.title != null ? x.title : -1, ...x.legs);
    if (act === "close") return close();
    if (act === "row-del") { st.rows.splice(+b.dataset.i, 1); }
    if (act === "row-ins") { const row = blankRow(); row[11] = 1; st.rows.splice(+b.dataset.i + 1, 0, row); }
    if (act === "leg-add" && blk) {
      const at = lastOf(blk) + 1, row = blankRow(); row[11] = 1;
      if (!blk.legs.length && blk.title == null) row[0] = "";
      st.rows.splice(at, 0, row);
    }
    if (act === "line-add") {
      let end = st.rows.length; while (end > 1 && isBlank(st.rows[end - 1])) end--;
      st.rows.splice(end, st.rows.length - end);
      const t = blankRow(); t[0] = "New line " + (bl.list.length + 1);
      const leg = blankRow(); leg[11] = 1;
      st.rows.push(blankRow(), t, leg);
    }
    if (act === "line-del" && blk) {
      if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Sure? Delete it"; return; }
      const idx = [blk.title, ...blk.legs].filter(x => x != null).sort((a, z) => z - a);
      idx.forEach(i => st.rows.splice(i, 1));
    }
    if (act === "show" && blk) return showLine(blk);
    if (act === "print" && blk) return printSlate(blk);
    if (act === "print-blank") return printSlate(null);
    if (act === "csv") return download();
    if (act === "reload") {
      if (!b.dataset.sure && !sameAsWebsite()) { b.dataset.sure = "1"; b.textContent = "Sure? This drops your unpublished work"; return; }
      return start(true);
    }
    if (act === "publish") return publish();
    if (["row-del", "row-ins", "leg-add", "line-add", "line-del"].includes(act)) {
      // keep blank lines between lines; drop runs of extra blank rows
      st.rows = st.rows.filter((r, i, a) => !(isBlank(r) && !held(r) && i > 0 && isBlank(a[i - 1]) && !held(a[i - 1])));
      st.confirm = false; save(); check(); render();
      if (act === "line-add") { const n = box.querySelectorAll(".sb-name"); const last = n[n.length - 1]; if (last && last.select) { last.focus(); last.select(); } }
    }
  });
  // "Show on map": zoom to the line and light it up (jumps too, dashed), until the map is tapped or another line is shown.
  let glow = null;
  function clearGlow() { if (glow) { glow.remove(); glow = null; } }
  function showLine(blk) {
    const name = blk.title != null ? str(st.rows[blk.title][0]) : null, d = st.check && st.check.data;
    clearGlow();
    if (!d || !S.geo) return;
    const ids = Object.keys(d.runNames || {}).filter(k => d.runNames[k] === name);
    const mine = s => ids.includes(s.run);
    const segs = S.geo.segments.filter(mine), jumps = (S.geo.jumps || []).filter(mine);
    const pts = segs.concat(jumps).flatMap(s => [S.ll(s.x0, s.y0), S.ll(s.x1, s.y1)]);
    if (!pts.length) { st.msg = { kind: "bad", text: `"${name || "This line"}" isn't on the map yet. Check its From station.` }; return drawChecks(); }
    if (!S.map.getPane("sb-glow")) { S.map.createPane("sb-glow").style.zIndex = 645; }
    const renderer = L.svg({ pane: "sb-glow" }), opt = { pane: "sb-glow", renderer, interactive: false, lineCap: "round" };
    const line = (s, o) => L.polyline([S.ll(s.x0, s.y0), S.ll(s.x1, s.y1)], Object.assign({}, opt, o));
    const all = segs.concat(jumps), first = all[0], last = all[all.length - 1];
    glow = L.layerGroup([
      ...all.map(s => line(s, { color: "#fff", weight: 12, opacity: 0.9 })),
      ...all.map(s => line(s, { color: "#ff00d4", weight: 6, opacity: 1, className: "sb-glow-line", dashArray: jumps.includes(s) ? "8 8" : null })),
      L.circleMarker(S.ll(first.x0, first.y0), Object.assign({}, opt, { radius: 8, color: "#fff", weight: 3, fillColor: "#ff00d4", fillOpacity: 1 })),
      L.circleMarker(S.ll(last.x1, last.y1), Object.assign({}, opt, { radius: 6, color: "#ff00d4", weight: 3, fillColor: "#fff", fillOpacity: 1 })),
    ]).addTo(S.map);
    S.map.once("click", clearGlow);
    S.map.getContainer().scrollIntoView({ behavior: "smooth", block: "start" });
    S.map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: S.geoRef() ? 20 : 3 });
  }

  // ----- publish -----
  async function publish() {
    check();
    const c = st.check;
    if (c.errors.length) return drawChecks();
    if ((c.warnings.length || st.base !== S.version) && !st.confirm) { st.confirm = true; return drawChecks(); }
    st.busy = true; st.msg = null; drawChecks();
    try {
      const before = current();
      const summary = (st.summary.trim() ? st.summary.trim() + " — " : "") + "from the Survey book: " + SS.describeChange(before, c.data);
      const { data: v, error } = await C.client.rpc("publish_site_map_book", { site, new_data: c.sp.src.green, expected_version: S.version, summary: summary.slice(0, 2000),
        layers: { blue: c.sp.src.blue, black: c.sp.src.black, "double-black": c.sp.src["double-black"], squirrel: c.sp.src.squirrel } });
      if (error) throw error;
      S.setPublished(c.sp.src.green, v, new Date().toISOString());
      try { localStorage.setItem(SIGNAL, JSON.stringify({ at: Date.now(), name: S.versionName ? S.versionName() : String(v) })); } catch (e) { /* the map tab just won't hear */ }
      if (S.reloadLayers) await S.reloadLayers();
      dropDraft(); st.summary = ""; st.confirm = false;
      const w = fromWebsite(); st.rows = w.rows; st.lm = w.lm; st.base = S.version;
      st.msg = { kind: "ok", text: `Published as version ${S.versionName ? S.versionName() : v}.` };
      check();
    } catch (err) {
      const m = (err && err.message) || "";
      st.msg = { kind: "bad", text: /publish_site_map_book|schema cache|does not exist/i.test(m) ? "Run the latest supabase/schema.sql in Supabase first, then try again. Your work is kept." : (C.explain ? C.explain(err) : m) };
    }
    st.busy = false; render();
  }

  // ----- spreadsheet out and in -----
  function download() {
    const q = v => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = st.rows.filter(r => !held(r)).map(r => r.slice(0, 11));
    rows[0] = SS.HEADER.slice();
    const csv = rows.map(r => r.map(q).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    a.download = `${site}-survey-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function parseCsv(text) {
    const rows = []; let row = [], cell = "", q = false;
    text = text.replace(/^﻿/, "");
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // ----- survey slates to print -----
  function printSlate(blk) {
    const t = blk && blk.title != null ? st.rows[blk.title] : null;
    const legs = blk ? blk.legs.map(i => st.rows[i]) : [];
    // Big rows, 10 to a page, so they're easy to write in underwater (Jamie 2026-11-25). A filled slate gets a few
    // spare rows and as many pages as it needs.
    const PER = 10, pages = Math.max(1, Math.ceil((legs.length + (legs.length ? 3 : 0)) / PER)), n = pages * PER;
    const cell = v => esc(str(v));
    const rows = Array.from({ length: n }, (_, k) => {
      const r = legs[k];
      const [ft, inch] = r ? ftIn(r[5]) : ["", ""];
      const kind = r ? str(r[7]).toLowerCase() : "";
      const box = (on, label) => `<span class="sl-chk">${on ? "✓" : ""}</span>${label}`;
      return `<tr><td class="sl-n">${k + 1}</td><td>${r ? cell(r[0]) : ""}</td><td>${r ? cell(r[1]) : ""}</td><td>${r ? cell(r[2]) : ""}</td><td>${r ? cell(r[4]) : ""}</td><td>${r ? cell(r[3]) : ""}</td>
        <td>${r ? esc(ft) : ""}</td><td>${r ? esc(inch) : ""}</td><td class="sl-kind">${box(r && (kind === "" || kind === "surveyed"), "Surv")} ${box(kind === "unsurveyed", "Unsurv")} ${box(kind === "platform", "Plat")}</td><td>${r ? cell(r[8]) : ""}</td></tr>`;
    }).join("");
    const startAt = legs.length ? str(legs[0][0]) : "";
    const rowList = rows.split("</tr>").filter(x => x.trim()).map(x => x + "</tr>");
    printBox.innerHTML = Array.from({ length: pages }, (_, p) => `<div class="slate">
      <div class="sl-head"><h1>LIMITLESS DIVING · SURVEY SLATE</h1><span>${esc(S.data.title || site)} · page ${pages > 1 ? `${p + 1} of ${pages}` : "___ of ___"}</span></div>
      <div class="sl-top"><div><span>Date</span></div><div><span>Divers</span></div><div><span>Line name</span><b>${t ? cell(t[0]) : ""}</b></div><div><span>Starts at station</span><b>${esc(startAt)}</b></div></div>
      <table><thead><tr><th>#</th><th>From</th><th>To<br><small>Rock / Stake / name</small></th><th>Depth<br>ft</th><th>Heading<br>°</th><th>Back<br>°</th><th>Feet</th><th>In</th><th>Kind</th><th>Note</th></tr></thead>
      <tbody>${rowList.slice(p * PER, (p + 1) * PER).join("")}</tbody></table>
      <p class="sl-hint"><b>To:</b> Rock for a tie-off, Stake for a stake, or the station's name. <b>Heading:</b> compass, from → to. <b>Back:</b> to → from.
        ${t ? `Printed from the map, version ${esc(S.versionName ? S.versionName() : String(S.version))}, ${esc(new Date().toLocaleDateString())}.` : "Same rows as the Survey book on the website, so typing it in is straight across."}</p></div>`).join("");
    document.body.classList.add("sb-printing");
    const done = () => { document.body.classList.remove("sb-printing"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => { window.print(); setTimeout(done, 1500); }, 50);
  }

  // ----- open and close -----
  function start(fresh) {
    const w = fromWebsite(), d = fresh ? null : loadDraft();
    if (d) { st.rows = d.rows; st.lm = d.lm && d.lm.length ? d.lm : w.lm; st.base = d.base; st.savedAt = d.at; st.msg = { kind: "ok", text: `Picked up your unpublished work from ${new Date(d.at).toLocaleString()}.` }; }
    else { st.rows = w.rows; st.lm = w.lm; st.base = S.version; st.msg = null; dropDraft(); }
    st.confirm = false;
    check(); render();
  }
  function open() {
    if (S.editing) { const w = document.getElementById("sm-warn"); if (w) { w.hidden = false; w.textContent = "Close Edit map (Done) before opening the Survey book."; } return; }
    st.open = true; S.editing = true;
    host.classList.add("sb-open"); btn.classList.add("on"); btn.setAttribute("aria-pressed", "true");
    applyMapSize();
    start(false);
    if (!PAGE) box.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function close() {
    clearGlow();
    st.open = false; S.editing = false;
    host.classList.remove("sb-open", "sb-map-small", "sb-map-off"); btn.classList.remove("on"); btn.setAttribute("aria-pressed", "false");
    render();
    setTimeout(() => S.map.invalidateSize(), 50);
    try { S.reset(); } catch (e) { console.error(e); }
  }
  S.onPublished(() => { if (st.open) render(); });
  if (!PAGE) {
    // On the map: the button opens the book in a new tab. When the book there publishes, offer a refresh here.
    btn.addEventListener("click", () => { const w = window.open(bookUrl(), "_blank"); if (!w) location.href = bookUrl(); });
    window.addEventListener("storage", e => {
      if (e.key !== SIGNAL || !e.newValue) return;
      let name = ""; try { name = JSON.parse(e.newValue).name || ""; } catch (x) { /* ignore */ }
      const w = document.getElementById("sm-warn"); if (!w) return;
      w.hidden = false;
      w.innerHTML = `The Survey book published ${name ? "version " + esc(name) : "a new version"}. <a href="${esc(location.pathname)}">Refresh to see it</a>.`;
    });
    return;
  }
  // The book's own tab.
  document.body.classList.add("sb-page");
  document.title = "Survey book · " + (S.data.title || "Site map");
  const h1 = document.querySelector("#surveymap h1"); if (h1) h1.textContent = "Survey book · " + (S.data.title || "");
  const back = document.querySelector("#surveymap .back"); if (back) { back.href = location.pathname; back.textContent = "← " + (S.data.title || "Site map") + " map"; }
  btn.hidden = true;
  close = function () {
    window.close();   // works when the map opened this tab
    setTimeout(() => { location.href = location.pathname; }, 200);
  };
  if (!S.isSiteAdmin()) {
    box.hidden = false;
    box.innerHTML = `<p class="acct-note bad">The Survey book is for Admins and Dive site admins. <a href="${esc(location.pathname)}">Back to the map</a></p>`;
    return;
  }
  // Wait for the rated layers (blue, black, double black, Secret Squirrel): the book holds every level's lines.
  box.hidden = false;
  box.innerHTML = `<p class="hint">Loading every level's lines…</p>`;
  (S.layersLoaded || Promise.resolve()).then(() => {
    if (S.layersError) {
      box.innerHTML = `<p class="acct-note bad">The rated lines (blue, black, double black) couldn't be loaded, so the Survey book can't open safely: ${esc(S.layersError)}. <a href="${esc(location.href)}">Try again</a></p>`;
      return;
    }
    open();
  });
});
