/* Limitless Diving — Line problems on a site map (on each site map page, e.g. bonnie-castle-map.html).
   Anyone who can see the map taps a line (or a stake or tie-off) and reports a problem: Broken, Broken – temporarily
   repaired, or Maintenance needed, with a note. The report is saved in site_map_issues and Jamie gets a Telegram message
   (notify-signup { mapIssue: id }). Open reports show as warning signs on the map and in a "Line problems" list;
   Admins and Dive site admins mark them fixed. Uses SurveyMap (survey-map.js) and LDCloud. */
(window.SurveyMap ? window.SurveyMap.ready : Promise.resolve()).then(function () {
  "use strict";
  const S = window.SurveyMap, C = window.LDCloud;
  if (!S || !S.map || !C || !C.client || !C.user) return;
  const esc = S.esc, site = S.site;
  const STATUS = {
    broken: { label: "Broken", color: "#d7263d", hint: "The line is cut or missing" },
    "temp-repaired": { label: "Broken – temporarily repaired", color: "#e8590c", hint: "Tied back together for now; needs a proper fix" },
    maintenance: { label: "Maintenance needed", color: "#e0a800", hint: "Loose, buried, tangled, worn or a tie-off needs work" },
  };
  const st = { list: [], err: null, marks: null };
  const admin = () => S.isSiteAdmin();
  const when = t => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  // ----- the list under the map -----
  const panel = document.createElement("section");
  panel.className = "panel sm-issues"; panel.id = "sm-issues-panel"; panel.setAttribute("aria-labelledby", "sm-issues-h");
  const keyPanel = document.getElementById("sm-key") && document.getElementById("sm-key").closest("section");
  const layersPanel = document.getElementById("sm-layers-panel");
  (keyPanel || layersPanel).parentNode.insertBefore(panel, keyPanel || layersPanel.nextSibling);

  function issueHtml(i, inPopup) {
    const s = STATUS[i.status] || STATUS.maintenance;
    return `<div class="sm-issue" data-issue="${esc(i.id)}"><span class="sm-issue-dot" style="background:${s.color}"></span>
      <div><b>${esc(s.label)}</b>${i.line_name ? ` · ${esc(i.line_name)}` : ""}
        <br><span class="dm-pop">${esc(when(i.created_at))}${i.reporter_name ? ` · ${esc(i.reporter_name)}` : ""}</span>
        ${i.note ? `<br><span class="sm-issue-note">${esc(i.note)}</span>` : ""}
        <div class="sm-issue-acts">${!inPopup && i.x != null ? `<button type="button" class="btn small" data-is="show" data-id="${esc(i.id)}">Show on map</button>` : ""}
          ${admin() ? `<button type="button" class="btn small" data-is="fixed" data-id="${esc(i.id)}">Mark fixed</button>` : ""}</div></div></div>`;
  }
  function drawPanel() {
    const open = st.list;
    panel.innerHTML = `<h2 id="sm-issues-h" class="sec">Line problems${open.length ? ` <span class="sm-issue-count">${open.length} open</span>` : ""}</h2>
      ${st.err ? `<p class="se-err">${esc(st.err)}</p>` : ""}
      ${open.length ? open.map(i => issueHtml(i, false)).join("") : `<p class="hint">No open problems reported.</p>`}
      <p class="hint">Found a broken line or one that needs work? Tap the line on the map, then <b>Report a problem</b>. Jamie gets a message right away.</p>
      <p class="sm-issue-msg" role="status"></p>`;
  }

  // ----- warning signs on the map -----
  function drawMarks() {
    if (st.marks) st.marks.remove();
    st.marks = L.layerGroup(st.list.filter(i => i.x != null && i.y != null).map(i => {
      const s = STATUS[i.status] || STATUS.maintenance;
      const icon = L.divIcon({ className: "sm-issue-mark", iconSize: [26, 26], iconAnchor: [13, 24],
        html: `<svg viewBox="0 0 26 26" width="26" height="26" aria-hidden="true"><path d="M13 2 L25 23 H1 Z" fill="${s.color}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><text x="13" y="20" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">!</text></svg>` });
      const m = L.marker(S.ll(i.x, i.y), { icon, title: s.label, zIndexOffset: 900 });
      m.on("click", ev => { L.DomEvent.stopPropagation(ev); const box = document.createElement("div"); box.innerHTML = issueHtml(i, true); L.popup({ maxWidth: 300 }).setLatLng(m.getLatLng()).setContent(box).openOn(S.map); });
      return m;
    })).addTo(S.map);
  }

  async function load() {
    const { data, error } = await C.client.from("site_map_issues").select("id, run, line_name, x, y, status, note, reporter_name, created_at")
      .eq("site_id", site).is("resolved_at", null).order("created_at", { ascending: false });
    if (error) { st.list = []; st.err = /site_map_issues/.test(error.message || "") ? (admin() ? "Run the latest supabase/schema.sql in Supabase to turn on line problem reports." : null) : C.explain(error); }
    else { st.list = data; st.err = null; }
    drawPanel(); drawMarks();
  }

  // ----- reporting, from a line's popup -----
  function formHtml() {
    return `<form class="sm-issue-form"><b>Report a problem on this line</b>
      ${Object.entries(STATUS).map(([k, s], n) => `<label class="sm-issue-opt"><input type="radio" name="sm-issue-status" value="${k}"${n === 0 ? " checked" : ""}>
        <span><span class="sm-issue-dot" style="background:${s.color}"></span>${esc(s.label)}<br><small>${esc(s.hint)}</small></span></label>`).join("")}
      <textarea maxlength="1000" rows="3" placeholder="What did you see? Where along the line? (optional)" aria-label="Note"></textarea>
      <div class="sm-issue-acts"><button type="submit" class="btn primary small">Send report</button><button type="button" class="btn small" data-is="cancel">Cancel</button></div>
      <p class="sm-issue-msg" role="status"></p></form>`;
  }
  S.popupHooks.push((f, el, pop) => {
    if (!f || !f.run || f.kind === "landmark") return;
    const open = st.list.filter(i => i.run === f.run);
    const slot = document.createElement("div"); slot.className = "sm-issue-slot"; el.appendChild(slot);
    const idle = () => {
      slot.innerHTML = `${open.length ? `<div class="sm-issue-here">${open.map(i => issueHtml(i, true)).join("")}</div>` : ""}
        <button type="button" class="btn small sm-issue-btn" data-is="report">⚠ Report a problem</button>`;
      pop.update();
    };
    idle();
    slot.addEventListener("click", async e => {
      const b = e.target.closest("[data-is=report], [data-is=cancel]"); if (!b) return;
      // The button is replaced below; stop here so Leaflet doesn't take a click on a removed element as a map click.
      e.stopPropagation();
      if (b.dataset.is === "report") { slot.innerHTML = formHtml(); pop.update(); slot.querySelector("textarea").focus(); }
      if (b.dataset.is === "cancel") idle();
    });
    slot.addEventListener("submit", async e => {
      e.preventDefault();
      const form = e.target, msg = form.querySelector(".sm-issue-msg"), btn = form.querySelector("[type=submit]");
      const status = (form.querySelector("input[name=sm-issue-status]:checked") || {}).value || "broken";
      const at = pop.getLatLng(), xy = S.toXY(at.lat, at.lng);
      btn.disabled = true; msg.textContent = "Sending…";
      const id = crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
      const { error } = await C.client.from("site_map_issues").insert({ id, site_id: site, run: f.run, line_name: S.runName(f.run) || f.run,
        x: xy[0], y: xy[1], status, note: form.querySelector("textarea").value.trim(), reporter: C.user.id });
      if (error) { btn.disabled = false; msg.textContent = /site_map_issues/.test(error.message || "") ? "Reports aren't turned on yet. Please tell Jamie." : C.explain(error); return; }
      if (C.client.functions) Promise.resolve(C.client.functions.invoke("notify-signup", { body: { mapIssue: id } })).catch(() => {});
      slot.innerHTML = `<p class="se-msg ok">Thanks! Jamie has been told${status === "broken" ? ". Please take care on this line" : ""}.</p>`;
      pop.update();
      load();
    });
  });

  // ----- marking fixed (Admins and Dive site admins) -----
  async function markFixed(id, where) {
    const { error } = await C.client.from("site_map_issues").update({ resolved_at: new Date().toISOString(), resolved_by: C.user.id }).eq("id", id);
    const msg = where.querySelector(".sm-issue-msg") || panel.querySelector(".sm-issue-msg");
    if (error) { if (msg) msg.textContent = C.explain(error); return; }
    S.map.closePopup();
    await load();
    const m2 = panel.querySelector(".sm-issue-msg"); if (m2) m2.textContent = "Marked fixed.";
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-is=fixed], [data-is=show]"); if (!b) return;
    const i = st.list.find(x => x.id === b.dataset.id); if (!i) return;
    if (b.dataset.is === "fixed") { if (admin()) markFixed(i.id, b.closest(".sm-issue-slot, .leaflet-popup-content, section") || panel); return; }
    S.map.getContainer().scrollIntoView({ behavior: "smooth", block: "center" });
    S.map.setView(S.ll(i.x, i.y), Math.max(S.map.getZoom(), S.geoRef() ? 19 : 1));
  });

  S.onPublished(drawMarks);
  load();
});
