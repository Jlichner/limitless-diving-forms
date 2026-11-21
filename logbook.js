/* Limitless Diving — the digital dive log book (logbook.html).
   Members registered for at least one class (and all staff) log their dives here. Every dive's site is one of their
   "Places I've dived" (table dive_sites), so it shows as a pin on their map and on the public Dive map. Dives are
   rows in the Supabase table dive_logs (supabase/schema.sql), which only the diver can change.
   Training dives can be signed off by an Instructor or Admin. A signed dive is locked for the diver.
   Dive Masters and up can open any member's log book (read only); Instructors and Admins also see the training
   dives waiting for their sign-off. */
(function () {
  "use strict";

  const root = document.getElementById("logbook"), C = window.LDCloud, M = window.LDMap, CAT = window.LDCatalog;
  if (!root) return;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const mapOk = () => !!(M && M.ok());

  const TAGS = [["training", "Training"], ["night", "Night"], ["deep", "Deep"], ["deco", "Decompression"], ["wreck", "Wreck"],
    ["cave", "Cave / cavern"], ["overhead", "Overhead"], ["drift", "Drift"], ["sidemount", "Sidemount"], ["dpv", "DPV"],
    ["drysuit", "Drysuit"], ["ice", "Ice"]];
  const TAG_NAME = Object.fromEntries(TAGS);
  const GAS = { air: "Air", nitrox: "Nitrox", trimix: "Trimix", oxygen: "Oxygen", other: "Other" };
  const U = {
    imperial: { depth: "ft", press: "psi", temp: "°F", vis: "ft", wt: "lb" },
    metric: { depth: "m", press: "bar", temp: "°C", vis: "m", wt: "kg" }
  };

  const v = {
    uid: null, access: null, accessErr: "", loaded: false, err: "",
    dives: [], sites: [], courses: [], open: new Set(),
    form: null,            // the dive being logged or edited: {} for a new one
    newSite: null,         // { lat, lng } of the pin for a new place
    results: [],
    viewing: null,         // staff: the member whose log book is open (null = your own)
    viewingName: "", members: null, toSign: null, signErr: "", note: "", noteKind: ""
  };
  let pageMap = null, pageLayer = null, formMap = null, formPin = null;

  // ---------- helpers ----------
  function today() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function fmtDate(d, long) {
    if (!d) return "";
    const x = new Date(String(d).slice(0, 10) + "T12:00:00");
    return isNaN(x) ? d : x.toLocaleDateString("en-US", long ? { weekday: "short", month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
  }
  function fmtTime(t) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    return ((h % 12) || 12) + ":" + String(m).padStart(2, "0") + (h < 12 ? " am" : " pm");
  }
  function hm(min) { min = Math.round(min || 0); const h = Math.floor(min / 60), m = min % 60; return h ? h + " h " + (m ? m + " min" : "") : m + " min"; }
  function num(x) { return x == null || x === "" ? null : Number(x); }
  function nice(x) { return x == null ? "" : String(Math.round(Number(x) * 10) / 10); }
  function toPref(d, field, pref) {
    // A dive's depth/temperature in the units the stats use.
    const x = num(d[field]); if (x == null) return null;
    if (d.units === pref) return x;
    if (field === "water_temp" || field === "air_temp") return pref === "metric" ? (x - 32) * 5 / 9 : x * 9 / 5 + 32;
    return pref === "metric" ? x / 3.28084 : x * 3.28084;
  }
  function prefUnits() { return (v.dives[0] && v.dives[0].units) || "imperial"; }
  function gasText(d) {
    if (d.gas === "nitrox") return d.o2_pct ? "EANx " + nice(d.o2_pct) : "Nitrox";
    if (d.gas === "trimix") return "Trimix " + (d.o2_pct ? nice(d.o2_pct) : "?") + "/" + (d.he_pct ? nice(d.he_pct) : "?");
    return GAS[d.gas] || "Air";
  }
  function mine() { return !v.viewing || v.viewing === v.uid; }
  function canSign() { return C.can("instructor"); }
  function toast(t) { const el = document.getElementById("toast"); if (!el) return; el.textContent = t; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2600); }
  function nextNo() { return v.dives.reduce((m, d) => Math.max(m, d.dive_no || 0), 0) + 1; }
  function courseOptions() {
    const seen = new Set(), out = [];
    v.courses.forEach(n => { if (n && !seen.has(n)) { seen.add(n); out.push(n); } });
    (CAT ? CAT.COURSES : []).forEach(c => { const n = c.agency + " " + c.name; if (!seen.has(n)) { seen.add(n); out.push(n); } });
    return out;
  }

  // ---------- data ----------
  async function loadAccess() {
    const r = await C.client.rpc("my_logbook_access");
    if (r.error) {
      v.access = false;
      v.accessErr = /my_logbook_access|PGRST202|schema cache|does not exist|could not find/i.test(r.error.message || "")
        ? "The dive log book isn't switched on yet. Your instructor needs to update the database first."
        : "Your log book couldn't be opened: " + C.explain(r.error);
    } else { v.access = r.data === true; v.accessErr = ""; }
  }
  async function loadDives() {
    v.loaded = false; v.err = ""; draw();
    const who = v.viewing || v.uid;
    const queries = [
      C.client.from("dive_logs").select("*").eq("user_id", who).order("dive_no", { ascending: false }).order("dived_on", { ascending: false }),
      C.client.from("dive_sites").select("*").eq("user_id", who).order("name", { ascending: true })
    ];
    queries.push(C.client.from("student_profiles").select("full_name,certifications").eq("id", who).maybeSingle());
    if (mine()) queries.push(C.client.from("student_progress").select("course,summary").eq("student_id", v.uid));
    const [d, s, pr, p] = await Promise.all(queries);
    v.profile = pr && !pr.error && pr.data ? pr.data : null;
    v.loaded = true;
    if (d.error) {
      v.err = /dive_logs|PGRST205|schema cache|does not exist/i.test(d.error.message || "")
        ? "The dive log book isn't switched on yet. Your instructor needs to update the database first."
        : "The log book couldn't be loaded: " + C.explain(d.error);
    }
    v.dives = d.error ? [] : d.data || [];
    v.sites = s.error ? [] : s.data || [];
    if (p) v.courses = p.error ? [] : (p.data || []).map(r => (r.summary && r.summary.courseName) || (CAT && CAT.find(r.course) ? CAT.find(r.course).agency + " " + CAT.find(r.course).name : r.course));
    draw();
  }
  async function loadToSign() {
    if (!canSign()) { v.toSign = null; return; }
    const r = await C.client.rpc("dives_to_sign");
    v.toSign = r.error ? [] : r.data || []; v.signErr = r.error ? C.explain(r.error) : "";
  }
  async function loadMembers() {
    if (!C.can("divemaster") || v.members) return;
    const r = await C.client.rpc("member_directory");
    v.members = r.error ? [] : (r.data || []).map(m => ({ id: m.id, name: m.full_name || m.email, role: m.role }));
  }

  // ---------- drawing ----------
  function stats() {
    const ds = v.dives, pref = prefUnits(), u = U[pref];
    const total = ds.reduce((t, d) => t + (d.bottom_time || 0), 0);
    let deep = null; ds.forEach(d => { const x = toPref(d, "max_depth", pref); if (x != null && (!deep || x > deep.x)) deep = { x, d }; });
    let long = null; ds.forEach(d => { if (d.bottom_time && (!long || d.bottom_time > long.bottom_time)) long = d; });
    const tag = (t) => ds.filter(d => (d.tags || []).includes(t)).length;
    const nitrox = ds.filter(d => d.gas === "nitrox" || d.gas === "trimix" || d.gas === "oxygen").length;
    const places = new Set(ds.map(d => (d.site_name || "").toLowerCase().trim() + "|" + (d.place || "").toLowerCase().trim())).size;
    const signed = ds.filter(d => d.signed_at).length;
    const tiles = [
      ["Dives logged", ds.length, ds.length ? "Last: " + fmtDate(ds.map(d => d.dived_on).sort().pop()) : "Log your first dive"],
      ["Bottom time", total ? hm(total) : "0 min", long ? "Longest " + long.bottom_time + " min" : ""],
      ["Deepest", deep ? nice(deep.x) + " " + u.depth : "–", deep ? deep.d.site_name : ""],
      ["Dive sites", places, v.sites.length ? v.sites.length + " on the map" : ""],
      ["Nitrox dives", nitrox, "EANx, trimix or O2"],
      ["Signed off", signed, tag("training") ? tag("training") + " training dive" + (tag("training") === 1 ? "" : "s") : ""]
    ];
    const extra = ["night", "deep", "deco", "wreck", "cave", "overhead", "drift", "sidemount"].map(t => [t, tag(t)]).filter(x => x[1]);
    return `<div class="lb-stats">${tiles.map(t => `<div class="lb-stat"><span>${esc(t[0])}</span><b>${esc(t[1])}</b>${t[2] ? `<small>${esc(t[2])}</small>` : ""}</div>`).join("")}</div>
      ${extra.length ? `<p class="lb-tagcount">${extra.map(x => `<span class="lb-tag">${esc(TAG_NAME[x[0]])} <b>${x[1]}</b></span>`).join("")}</p>` : ""}
      <p class="hint lb-prereq">Course prerequisites count logged dives (for example 25 logged dives, or 20 on nitrox). These totals are what you'd show your instructor.</p>`;
  }

  function signBlock(d) {
    if (d.signed_at) return `<p class="lb-signed"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5 8 14.5 16 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Signed off by <b>${esc(d.signed_name || "an instructor")}</b>${d.signed_role ? ", " + esc(C.ROLE_NAMES[d.signed_role] || d.signed_role) : ""} on ${esc(fmtDate(d.signed_at))}</span>${d.sign_comment ? `<span class="lb-comment">“${esc(d.sign_comment)}”</span>` : ""}</p>`;
    if ((d.tags || []).includes("training")) return `<p class="lb-pending">Training dive, waiting for an instructor's sign-off</p>`;
    return "";
  }

  function detailRows(d) {
    const u = U[d.units] || U.imperial, rows = [];
    const add = (k, val) => { if (val !== "" && val != null) rows.push([k, val]); };
    add("Time in", fmtTime(d.time_in));
    add("Max depth", d.max_depth != null ? nice(d.max_depth) + " " + u.depth : "");
    add("Average depth", d.avg_depth != null ? nice(d.avg_depth) + " " + u.depth : "");
    add("Bottom time", d.bottom_time ? d.bottom_time + " min" : "");
    add("Surface interval", d.surface_interval != null ? hm(d.surface_interval) : "");
    add("Gas", gasText(d));
    add("Tank", d.tank);
    add("Pressure", d.start_pressure != null || d.end_pressure != null ? (d.start_pressure != null ? d.start_pressure : "?") + " → " + (d.end_pressure != null ? d.end_pressure : "?") + " " + u.press
      + (d.start_pressure != null && d.end_pressure != null ? " (used " + (d.start_pressure - d.end_pressure) + ")" : "") : "");
    add("Exposure suit", d.suit);
    add("Weight", d.weight != null ? nice(d.weight) + " " + u.wt : "");
    add("Water", [d.water === "salt" ? "Salt" : d.water === "fresh" ? "Fresh" : "", d.water_temp != null ? nice(d.water_temp) + " " + u.temp : ""].filter(Boolean).join(", "));
    add("Air temperature", d.air_temp != null ? nice(d.air_temp) + " " + u.temp : "");
    add("Visibility", d.visibility != null ? nice(d.visibility) + " " + u.vis : "");
    add("Entry", d.entry ? d.entry[0].toUpperCase() + d.entry.slice(1) : "");
    add("Current", d.current ? d.current[0].toUpperCase() + d.current.slice(1) : "");
    add("Conditions", d.conditions);
    add("Buddy", d.buddy);
    add("Course", d.course);
    add("Instructor", d.instructor);
    return rows;
  }

  function diveCard(d) {
    const u = U[d.units] || U.imperial, open = v.open.has(d.id), tags = d.tags || [];
    const chips = [d.max_depth != null ? nice(d.max_depth) + " " + u.depth : "", d.bottom_time ? d.bottom_time + " min" : "", gasText(d)].filter(Boolean);
    const rows = open ? detailRows(d) : [];
    const ownEdit = mine() && !d.signed_at;
    return `<li class="lb-dive${d.signed_at ? " signed" : ""}${open ? " open" : ""}" id="dive-${esc(d.id)}">
      <button type="button" class="lb-dive-head" data-lb="toggle" data-id="${esc(d.id)}" aria-expanded="${open}">
        <span class="lb-no" aria-label="Dive number ${esc(d.dive_no)}"><small>Dive</small>${esc(d.dive_no)}</span>
        <span class="lb-main"><b>${esc(d.site_name)}</b><span>${esc([d.place, fmtDate(d.dived_on, true)].filter(Boolean).join(" · "))}</span>
          <span class="lb-chips">${chips.map(c => `<i>${esc(c)}</i>`).join("")}${tags.map(t => `<i class="t">${esc(TAG_NAME[t] || t)}</i>`).join("")}
          ${d.signed_at ? `<i class="ok">✓ Signed</i>` : tags.includes("training") ? `<i class="wait">Needs sign-off</i>` : ""}</span></span>
        <span class="lb-caret" aria-hidden="true"></span>
      </button>
      ${open ? `<div class="lb-body">
        ${rows.length ? `<dl class="lb-dl">${rows.map(r => `<div><dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd></div>`).join("")}</dl>` : ""}
        ${d.notes ? `<p class="lb-notes">${esc(d.notes)}</p>` : ""}
        ${signBlock(d)}
        <div class="row-actions">
          ${ownEdit ? `<button type="button" class="btn" data-lb="edit" data-id="${esc(d.id)}">Edit</button>
            <button type="button" class="btn danger" data-lb="del" data-id="${esc(d.id)}">Delete</button>` : ""}
          ${mine() && d.signed_at ? `<span class="hint">Signed dives are locked. Ask your instructor if something needs fixing.</span>` : ""}
          ${!mine() && canSign() && !d.signed_at ? `<button type="button" class="btn primary" data-lb="sign" data-id="${esc(d.id)}">Sign off this dive</button>` : ""}
          ${!mine() && canSign() && d.signed_at ? `<button type="button" class="btn small" data-lb="unsign" data-id="${esc(d.id)}">Take back sign-off</button>` : ""}
          ${d.lat != null ? `<button type="button" class="btn small" data-lb="go" data-id="${esc(d.id)}">Show on map</button>` : ""}
        </div></div>` : ""}
    </li>`;
  }

  function toSignPanel() {
    if (!canSign() || !v.toSign) return "";
    const list = v.toSign;
    return `<section class="panel lb-tosign" aria-labelledby="lb-tosign-h">
      <h2 class="sec" id="lb-tosign-h">Training dives to sign off ${list.length ? `<span class="lb-count">${list.length}</span>` : ""}</h2>
      ${v.signErr ? `<p class="acct-note bad">${esc(v.signErr)}</p>`
        : !list.length ? `<p class="hint">Nothing waiting. When a student logs a training dive it shows up here for you to sign.</p>`
        : `<ul class="lb-signlist">${list.map(d => `<li><div><b>${esc(d.diver)}</b> · Dive ${esc(d.dive_no)} · ${esc(fmtDate(d.dived_on))}
            <span>${esc([d.site_name, d.place].filter(Boolean).join(", "))}${d.course ? " · " + esc(d.course) : ""}${d.max_depth != null ? " · " + esc(nice(d.max_depth)) + " " + (U[d.units] || U.imperial).depth : ""}${d.bottom_time ? " · " + esc(d.bottom_time) + " min" : ""}</span></div>
            <div class="row-actions"><button type="button" class="btn small" data-lb="view" data-uid="${esc(d.user_id)}" data-id="${esc(d.id)}">Open</button>
            <button type="button" class="btn small primary" data-lb="sign" data-id="${esc(d.id)}">Sign off</button></div></li>`).join("")}</ul>`}
    </section>`;
  }

  function staffPicker() {
    if (!C.can("divemaster")) return "";
    const ms = v.members || [];
    return `<div class="field lb-pick"><label for="lb-member">Open a member's log book</label>
      <select id="lb-member" data-lb-change="member"><option value="">My own log book</option>
      ${ms.filter(m => m.id !== v.uid).map(m => `<option value="${esc(m.id)}"${v.viewing === m.id ? " selected" : ""}>${esc(m.name)}${m.role !== "student" ? " (" + esc(C.ROLE_NAMES[m.role] || m.role) + ")" : ""}</option>`).join("")}
      </select></div>`;
  }

  // Which site the form starts on: one of the member's places, "new" for a new place, or "" (choose).
  function siteChoice(f) {
    if (f._newPlace || !v.sites.length) return "new";
    if (f.site_id && v.sites.some(s => s.id === f.site_id)) return f.site_id;
    return f.id ? "new" : "";
  }
  function siteSelect(f) {
    const cur = siteChoice(f);
    return `<select id="lb-site" required>
      ${v.sites.length ? `<option value="" ${cur === "" ? "selected" : ""} disabled>Choose one of your places…</option>` : ""}
      ${v.sites.map(s => `<option value="${esc(s.id)}"${cur === s.id ? " selected" : ""}>${esc(s.name)}${s.place ? " · " + esc(s.place) : ""}</option>`).join("")}
      <option value="new"${cur === "new" ? " selected" : ""}>A new place…</option></select>`;
  }

  function formPanel() {
    const f = v.form; if (!f) return "";
    if (!f.units) f.units = prefUnits();
    const u = U[f.units] || U.imperial, isNew = !f.id, tags = new Set(f.tags || []);
    const val = (k) => f[k] == null ? "" : esc(f[k]);
    const opt = (k, list) => list.map(([x, n]) => `<option value="${x}"${(f[k] || "") === x ? " selected" : ""}>${n}</option>`).join("");
    const newPlace = siteChoice(f) === "new";
    return `<section class="panel lb-form-panel" aria-labelledby="lb-form-h">
      <h2 class="sec" id="lb-form-h">${isNew ? "Log a dive" : "Edit dive " + esc(f.dive_no)}</h2>
      <form id="lb-form" class="lb-form" novalidate>
        <fieldset><legend>The dive</legend>
          <div class="lb-grid">
            <div class="field"><label for="lb-no">Dive number</label><input id="lb-no" type="number" min="1" max="100000" step="1" inputmode="numeric" value="${val("dive_no")}" required></div>
            <div class="field"><label for="lb-date">Date</label><input id="lb-date" type="date" max="${today()}" value="${val("dived_on")}" required></div>
            <div class="field"><label for="lb-time">Time in</label><input id="lb-time" type="time" value="${val("time_in")}"></div>
            <div class="field"><label for="lb-units">Units</label><select id="lb-units">${opt("units", [["imperial", "Feet, psi, °F"], ["metric", "Meters, bar, °C"]])}</select></div>
          </div>
          <div class="field"><label for="lb-site">Dive site</label>${siteSelect(f)}
            <p class="hint">Your places come from <a href="account.html#my-sites">Places I've dived</a>. A new place is added there and to the Dive map.</p></div>
          <div class="lb-newplace" id="lb-newplace"${newPlace ? "" : " hidden"}>
            <div class="lb-np-cols">
              <div class="lb-np-fields">
                <div class="field"><label for="lb-q">Find the place</label><div class="ms-search"><input id="lb-q" type="search" maxlength="200" placeholder="e.g. Cozumel, Lake Hydra" autocomplete="off"><button type="button" class="btn" data-lb="find">Find</button></div></div>
                <div id="lb-results" class="ms-results" aria-live="polite"></div>
                <div class="field"><label for="lb-sname">Site name</label><input id="lb-sname" maxlength="120" placeholder="e.g. Palancar Reef" value="${newPlace ? val("site_name") : ""}"></div>
                <div class="field"><label for="lb-splace">Where</label><input id="lb-splace" maxlength="200" placeholder="e.g. Cozumel, Mexico" value="${newPlace ? val("place") : ""}"></div>
                <p class="hint" id="lb-pin-hint">${v.newSite ? "Pin placed. Drag it to fine-tune." : mapOk() ? "Search, or tap the map to drop a pin. Without a pin the dive is logged but the place isn't added to the map." : "Search for the place to put it on the map."}</p>
              </div>
              ${mapOk() ? `<div class="lb-np-map" id="lb-form-map" role="application" aria-label="Map. Tap to drop a pin where you dived."></div>` : ""}
            </div>
          </div>
          <div class="lb-grid">
            <div class="field"><label for="lb-max">Max depth (${u.depth})</label><input id="lb-max" type="number" min="0" step="0.1" inputmode="decimal" value="${val("max_depth")}"></div>
            <div class="field"><label for="lb-avg">Average depth (${u.depth})</label><input id="lb-avg" type="number" min="0" step="0.1" inputmode="decimal" value="${val("avg_depth")}"></div>
            <div class="field"><label for="lb-bt">Bottom time (min)</label><input id="lb-bt" type="number" min="1" max="1440" step="1" inputmode="numeric" value="${val("bottom_time")}"></div>
            <div class="field"><label for="lb-si">Surface interval (min)</label><input id="lb-si" type="number" min="0" step="1" inputmode="numeric" value="${val("surface_interval")}" placeholder="First dive: leave blank"></div>
          </div>
        </fieldset>
        <fieldset><legend>Gas and gear</legend>
          <div class="lb-grid">
            <div class="field"><label for="lb-gas">Gas</label><select id="lb-gas">${opt("gas", Object.entries(GAS))}</select></div>
            <div class="field lb-o2"${["nitrox", "trimix"].includes(f.gas) ? "" : " hidden"}><label for="lb-o2">Oxygen %</label><input id="lb-o2" type="number" min="5" max="100" step="0.1" inputmode="decimal" value="${val("o2_pct")}" placeholder="e.g. 32"></div>
            <div class="field lb-he"${f.gas === "trimix" ? "" : " hidden"}><label for="lb-he">Helium %</label><input id="lb-he" type="number" min="0" max="95" step="0.1" inputmode="decimal" value="${val("he_pct")}"></div>
            <div class="field"><label for="lb-tank">Tank</label><input id="lb-tank" maxlength="60" placeholder="e.g. AL80, HP100, twin 12s" value="${val("tank")}"></div>
            <div class="field"><label for="lb-sp">Start pressure (${u.press})</label><input id="lb-sp" type="number" min="0" max="6000" step="1" inputmode="numeric" value="${val("start_pressure")}"></div>
            <div class="field"><label for="lb-ep">End pressure (${u.press})</label><input id="lb-ep" type="number" min="0" max="6000" step="1" inputmode="numeric" value="${val("end_pressure")}"></div>
            <div class="field"><label for="lb-suit">Exposure suit</label><input id="lb-suit" maxlength="80" placeholder="e.g. 7 mm wetsuit, drysuit" value="${val("suit")}"></div>
            <div class="field"><label for="lb-wt">Weight (${u.wt})</label><input id="lb-wt" type="number" min="0" max="200" step="0.5" inputmode="decimal" value="${val("weight")}"></div>
          </div>
        </fieldset>
        <fieldset><legend>Conditions</legend>
          <div class="lb-grid">
            <div class="field"><label for="lb-water">Water</label><select id="lb-water">${opt("water", [["", "–"], ["fresh", "Fresh"], ["salt", "Salt"]])}</select></div>
            <div class="field"><label for="lb-entry">Entry</label><select id="lb-entry">${opt("entry", [["", "–"], ["shore", "Shore"], ["boat", "Boat"], ["other", "Other"]])}</select></div>
            <div class="field"><label for="lb-cur">Current</label><select id="lb-cur">${opt("current", [["", "–"], ["none", "None"], ["light", "Light"], ["moderate", "Moderate"], ["strong", "Strong"]])}</select></div>
            <div class="field"><label for="lb-wtemp">Water temp (${u.temp})</label><input id="lb-wtemp" type="number" step="1" inputmode="decimal" value="${val("water_temp")}"></div>
            <div class="field"><label for="lb-atemp">Air temp (${u.temp})</label><input id="lb-atemp" type="number" step="1" inputmode="decimal" value="${val("air_temp")}"></div>
            <div class="field"><label for="lb-vis">Visibility (${u.vis})</label><input id="lb-vis" type="number" min="0" step="1" inputmode="decimal" value="${val("visibility")}"></div>
          </div>
          <div class="field"><label for="lb-cond">Other conditions</label><input id="lb-cond" maxlength="300" placeholder="e.g. Thermocline at 30 ft, light surge" value="${val("conditions")}"></div>
        </fieldset>
        <fieldset><legend>Type of dive</legend>
          <div class="lb-tags">${TAGS.map(([t, n]) => `<label class="lb-check"><input type="checkbox" name="lb-tag" value="${t}"${tags.has(t) ? " checked" : ""}> ${esc(n)}</label>`).join("")}</div>
          <div class="lb-grid lb-training"${tags.has("training") ? "" : " hidden"}>
            <div class="field"><label for="lb-course">Course</label><input id="lb-course" maxlength="200" list="lb-courses" placeholder="e.g. NAUI Scuba Diver" value="${val("course")}">
              <datalist id="lb-courses">${courseOptions().map(n => `<option value="${esc(n)}">`).join("")}</datalist></div>
            <div class="field"><label for="lb-inst">Instructor</label><input id="lb-inst" maxlength="200" placeholder="Who taught the dive" value="${val("instructor")}"></div>
          </div>
          <p class="hint lb-training"${tags.has("training") ? "" : " hidden"}>Training dives go to your instructor to sign off. Once signed, the dive is locked.</p>
        </fieldset>
        <fieldset><legend>Buddy and notes</legend>
          <div class="field"><label for="lb-buddy">Buddy</label><input id="lb-buddy" maxlength="200" value="${val("buddy")}"></div>
          <div class="field"><label for="lb-notes">Notes</label><textarea id="lb-notes" maxlength="4000" placeholder="What you saw, skills you practised, what to work on next time…">${val("notes")}</textarea></div>
        </fieldset>
        <div class="row-actions lb-save"><button class="btn primary" type="submit" id="lb-save">${isNew ? "Save to my log book" : "Save changes"}</button>
          <button class="btn" type="button" data-lb="cancel">Cancel</button>
          <p id="lb-note" class="ms-note${v.noteKind ? " " + v.noteKind : ""}" role="status">${esc(v.note)}</p></div>
      </form></section>`;
  }

  function gate(html) { teardownMaps(); root.innerHTML = html; }
  function teardownMaps() {
    if (pageMap) { pageMap.remove(); pageMap = null; pageLayer = null; }
    if (formMap) { formMap.remove(); formMap = null; formPin = null; }
  }

  function draw() {
    if (!C || !C.available) return gate(`<div class="msg"><h1>Dive log book</h1><p>The log in service couldn't be loaded. Check your connection and refresh the page.</p></div>`);
    if (!C.loaded) return gate(`<div class="msg">Checking your log in…</div>`);
    if (!C.user) return gate(`<div class="panel gate-card lb-gate"><span class="eyebrow">Student portal</span><h1>Your dive log book</h1>
      <p>Log every dive online: site, depth, time, gas, conditions and buddy, with your instructor's sign-off on training dives. Your dive sites go on the Dive map.</p>
      <div class="row-actions"><a class="btn primary" href="account.html#then=logbook">Log in</a><a class="btn" href="account.html#then=logbook">Create a free account</a></div></div>`);
    if (v.access == null) return gate(`<div class="msg">Opening your log book…</div>`);
    if (!v.access) return gate(`<div class="panel gate-card lb-gate"><span class="eyebrow">Dive log book</span><h1>Your log book opens with your first class</h1>
      ${v.accessErr ? `<p class="acct-note bad">${esc(v.accessErr)}</p>` : `<p>The digital dive log book is for Limitless Diving students. As soon as you're registered for a class, it switches on here and in your Student portal.</p>`}
      <div class="row-actions"><a class="btn primary" href="available-classes.html">See available classes</a><a class="btn" href="account.html">Back to my portal</a></div></div>`);

    const editingOpen = !!v.form, keepForm = editingOpen && document.getElementById("lb-form");
    if (keepForm) { drawOutsideForm(); return; }
    teardownMaps();
    const other = !mine();
    root.innerHTML = `
      <div class="lb-hero">
        <div><span class="eyebrow">${other ? "Viewing a member" : "Student portal"}</span>
          <h1>${other ? esc(v.viewingName) + "'s dive log book" : "My dive log book"}</h1>
          <p class="hint">${other ? (canSign() ? "Read only. You can sign off their training dives." : "Read only.") : "Every dive you log is tied to a place on your map. Training dives go to your instructor to sign off."}</p></div>
        <div class="lb-hero-act">${staffPicker()}
          <div class="row-actions">${mine() ? `<button type="button" class="btn primary" data-lb="new"${editingOpen ? " disabled" : ""}>+ Log a dive</button>` : ""}
          <button type="button" class="btn" data-lb="pdf"${v.dives.length ? "" : " disabled"}>Download PDF</button>
          <button type="button" class="btn" data-lb="print"${v.dives.length ? "" : " disabled"}>Print</button>${mine() ? `<a class="btn" href="account.html">My portal</a>` : ""}</div></div>
      </div>
      <div id="lb-stats-box">${v.loaded && !v.err ? stats() : ""}</div>
      ${mine() ? toSignPanel() : ""}
      <div id="lb-form-box">${formPanel()}</div>
      <div class="lb-cols">
        <section class="panel lb-list-panel" aria-labelledby="lb-list-h"><h2 class="sec" id="lb-list-h">Dives <span class="hint" id="lb-n">${v.dives.length ? "(" + v.dives.length + ")" : ""}</span></h2>
          <div id="lb-list">${listHtml()}</div></section>
        <section class="panel lb-map-panel" aria-labelledby="lb-map-h"><h2 class="sec" id="lb-map-h">Where ${other ? "they've" : "I've"} logged dives</h2>
          ${mapOk() ? `<div class="lb-map" id="lb-map" role="application" aria-label="Map of logged dives"></div>` : `<p class="acct-note bad">The map couldn't be loaded.</p>`}
          <p class="hint">Pins come from the dives' places. The public <a href="dive-map.html">Dive map</a> shows places, never names.</p></section>
      </div>
`;
    setupPageMap();
    if (v.form) setupFormMap();
  }
  // Redraw everything except the open form, so typing isn't lost.
  function drawOutsideForm() {
    const s = document.getElementById("lb-stats-box"); if (s) s.innerHTML = v.loaded && !v.err ? stats() : "";
    const l = document.getElementById("lb-list"); if (l) l.innerHTML = listHtml();
    const n = document.getElementById("lb-n"); if (n) n.textContent = v.dives.length ? "(" + v.dives.length + ")" : "";
    drawPins();
  }
  function listHtml() {
    if (!v.loaded) return `<p class="hint">Loading dives…</p>`;
    if (v.err) return `<p class="acct-note bad" role="alert">${esc(v.err)}</p>`;
    if (!v.dives.length) return mine() ? `<div class="lb-empty"><p><b>No dives logged yet.</b></p><p class="hint">Start with your most recent dive, or go back to your very first. Dive numbers count up from 1.</p>
      <button type="button" class="btn primary" data-lb="new">+ Log your first dive</button></div>` : `<p class="hint">No dives logged yet.</p>`;
    return `<ol class="lb-dives">${v.dives.map(diveCard).join("")}</ol>`;
  }

  function setupPageMap() {
    const el = document.getElementById("lb-map"); if (!el || !mapOk()) return;
    pageMap = M.map(el); pageLayer = window.L.layerGroup().addTo(pageMap);
    drawPins();
  }
  function drawPins() {
    if (!pageLayer) return;
    pageLayer.clearLayers();
    const groups = new Map();
    v.dives.filter(d => d.lat != null && d.lng != null).forEach(d => {
      const k = d.lat.toFixed(3) + "," + d.lng.toFixed(3);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(d);
    });
    const pts = [];
    groups.forEach(list => {
      const d = list[0]; pts.push([d.lat, d.lng]);
      window.L.marker([d.lat, d.lng], { icon: M.flag(list.length), keyboard: false })
        .bindPopup(`<b>${esc(d.site_name)}</b>${d.place ? "<br>" + esc(d.place) : ""}<br>${list.length} dive${list.length === 1 ? "" : "s"}: ${list.slice(0, 6).map(x => "#" + esc(x.dive_no)).join(", ")}${list.length > 6 ? "…" : ""}`)
        .addTo(pageLayer);
    });
    if (pts.length === 1) pageMap.setView(pts[0], 7);
    else if (pts.length > 1) pageMap.fitBounds(window.L.latLngBounds(pts), { padding: [30, 30], maxZoom: 8 });
    setTimeout(() => pageMap && pageMap.invalidateSize(), 0);
  }
  function setupFormMap() {
    const el = document.getElementById("lb-form-map"), box = document.getElementById("lb-newplace");
    if (!el || !mapOk() || !box || box.hidden || formMap) return;
    formMap = M.map(el);
    formMap.on("click", (e) => placePin(e.latlng.lat, e.latlng.lng, true));
    if (v.newSite) placePin(v.newSite.lat, v.newSite.lng, false);
    setTimeout(() => formMap && formMap.invalidateSize(), 0);
  }
  function round5(x) { return Math.round(x * 1e5) / 1e5; }
  function placePin(lat, lng, fromTap) {
    v.newSite = { lat: round5(lat), lng: round5((lng + 540) % 360 - 180) };
    if (formMap) {
      if (formPin) formPin.setLatLng([lat, lng]);
      else formPin = window.L.marker([lat, lng], { icon: M.flag(1, "new"), draggable: true, keyboard: false })
        .on("dragend", (e) => { const p = e.target.getLatLng(); v.newSite = { lat: round5(p.lat), lng: round5((p.lng + 540) % 360 - 180) }; })
        .addTo(formMap);
      if (!fromTap) formMap.setView([lat, lng], Math.max(formMap.getZoom(), 9));
    }
    const h = document.getElementById("lb-pin-hint"); if (h) h.textContent = fromTap ? "Pin dropped. Drag it to fine-tune, then name the site." : "Pin placed. Drag it to fine-tune if you need to.";
  }

  // ---------- the form ----------
  function openForm(d) {
    v.note = ""; v.noteKind = ""; v.newSite = null; v.results = [];
    if (d) v.form = Object.assign({}, d, { tags: (d.tags || []).slice() });
    else {
      const last = v.dives[0];
      v.form = { dive_no: nextNo(), dived_on: today(), units: prefUnits(), gas: "air", tags: [],
        site_id: last && last.site_id && v.sites.some(s => s.id === last.site_id) ? last.site_id : "",
        tank: last ? last.tank : "", suit: last ? last.suit : "", weight: last ? last.weight : null, buddy: "" };
      if (!v.sites.length) v.form._newPlace = true;
    }
    if (v.form.id && v.form.lat != null && !v.sites.some(s => s.id === v.form.site_id)) v.newSite = { lat: v.form.lat, lng: v.form.lng };
    const box = document.getElementById("lb-form-box");
    if (box) { box.innerHTML = formPanel(); setupFormMap(); }
    root.querySelectorAll('[data-lb="new"]').forEach(b => { b.disabled = true; });
    const p = document.querySelector(".lb-form-panel");
    if (p) { p.scrollIntoView({ behavior: "smooth", block: "start" }); setTimeout(() => { const f = document.getElementById(v.form.id ? "lb-max" : "lb-date"); if (f) f.focus({ preventScroll: true }); }, 350); }
  }
  function closeForm() {
    v.form = null; v.newSite = null;
    if (formMap) { formMap.remove(); formMap = null; formPin = null; }
    const box = document.getElementById("lb-form-box"); if (box) box.innerHTML = "";
    root.querySelectorAll('[data-lb="new"]').forEach(b => { b.disabled = false; });
  }
  function setNote(t, kind) { v.note = t || ""; v.noteKind = kind || ""; const n = document.getElementById("lb-note"); if (n) { n.textContent = v.note; n.className = "ms-note" + (kind ? " " + kind : ""); } }
  function g(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function n(id) { const x = g(id); return x === "" ? null : Number(x); }
  function int(id) { const x = n(id); return x == null ? null : Math.round(x); }

  async function save() {
    const f = v.form; if (!f) return;
    const siteSel = g("lb-site"), newPlace = siteSel === "new" || !document.getElementById("lb-site");
    const row = {
      dive_no: int("lb-no"), dived_on: g("lb-date"), time_in: g("lb-time"), units: g("lb-units") || "imperial",
      max_depth: n("lb-max"), avg_depth: n("lb-avg"), bottom_time: int("lb-bt"), surface_interval: int("lb-si"),
      gas: g("lb-gas") || "air", o2_pct: null, he_pct: null, tank: g("lb-tank"), start_pressure: int("lb-sp"), end_pressure: int("lb-ep"),
      suit: g("lb-suit"), weight: n("lb-wt"), water: g("lb-water"), entry: g("lb-entry"), current: g("lb-cur"),
      water_temp: n("lb-wtemp"), air_temp: n("lb-atemp"), visibility: n("lb-vis"), conditions: g("lb-cond"),
      tags: Array.from(root.querySelectorAll('input[name="lb-tag"]:checked')).map(x => x.value),
      buddy: g("lb-buddy"), notes: g("lb-notes"), course: "", instructor: ""
    };
    if (row.gas === "nitrox" || row.gas === "trimix") row.o2_pct = n("lb-o2");
    if (row.gas === "trimix") row.he_pct = n("lb-he");
    if (row.tags.includes("training")) { row.course = g("lb-course"); row.instructor = g("lb-inst"); }
    const bad = (msg, id) => { setNote(msg, "bad"); const el = id && document.getElementById(id); if (el) el.focus(); return false; };
    if (!row.dive_no || row.dive_no < 1) return bad("Give the dive a number (1 for your first dive).", "lb-no");
    if (!row.dived_on) return bad("Add the date of the dive.", "lb-date");
    if (row.dived_on > today()) return bad("The date can't be in the future.", "lb-date");
    if (row.max_depth != null && row.avg_depth != null && row.avg_depth > row.max_depth) return bad("Average depth can't be deeper than max depth.", "lb-avg");
    if (row.start_pressure != null && row.end_pressure != null && row.end_pressure > row.start_pressure) return bad("End pressure is higher than start pressure. Check the numbers.", "lb-ep");
    if (row.o2_pct != null && (row.o2_pct < 5 || row.o2_pct > 100)) return bad("Oxygen should be between 5 and 100 percent.", "lb-o2");
    if (v.dives.some(d => d.dive_no === row.dive_no && d.id !== f.id) && !window.confirm(`You already have a dive number ${row.dive_no}. Save this one with the same number anyway?`)) return false;

    let site = null;
    if (!newPlace) {
      site = v.sites.find(s => s.id === siteSel);
      if (!site) return bad("Pick the dive site, or choose “A new place…”.", "lb-site");
    } else if (!g("lb-sname")) return bad("Give the dive site a name.", "lb-sname");

    const btn = document.getElementById("lb-save"); if (btn) btn.disabled = true;
    setNote("Saving…");
    try {
      if (newPlace) {
        const name = g("lb-sname").slice(0, 120), place = g("lb-splace").slice(0, 200);
        if (v.newSite) {
          const r = await C.client.from("dive_sites").insert({ name, place, lat: v.newSite.lat, lng: v.newSite.lng, dived_on: row.dived_on, notes: "" }).select().single();
          if (r.error) throw r.error;
          v.sites.push(r.data); v.sites.sort((a, b) => a.name.localeCompare(b.name));
          site = r.data;
        } else site = { id: null, name, place, lat: null, lng: null };
      }
      Object.assign(row, { site_id: site.id, site_name: site.name, place: site.place || "", lat: site.lat, lng: site.lng });
      const r = f.id
        ? await C.client.from("dive_logs").update(row).eq("id", f.id).select().single()
        : await C.client.from("dive_logs").insert(row).select().single();
      if (r.error) throw r.error;
      v.dives = v.dives.filter(d => d.id !== r.data.id).concat(r.data)
        .sort((a, b) => b.dive_no - a.dive_no || String(b.dived_on).localeCompare(String(a.dived_on)));
      v.open.add(r.data.id);
      closeForm(); drawOutsideForm();
      toast(f.id ? "Dive saved." : "Dive " + r.data.dive_no + " is in your log book.");
      const card = document.getElementById("dive-" + r.data.id); if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      if (btn) btn.disabled = false;
      setNote("Not saved: " + C.explain(err), "bad");
    }
  }

  async function find() {
    const q = g("lb-q"), r = document.getElementById("lb-results");
    if (q.length < 2) { r.innerHTML = `<p class="hint">Type a place to search for.</p>`; return; }
    r.innerHTML = `<p class="hint">Searching…</p>`;
    try { v.results = await M.search(q); } catch (err) { v.results = []; r.innerHTML = `<p class="acct-note bad">${esc(err.message || "Search failed.")}</p>`; return; }
    r.innerHTML = v.results.length ? `<p class="hint">Pick the right one:</p>` + v.results.map((x, i) => `<button type="button" class="ms-hit" data-lb="pick" data-i="${i}"><b>${esc(x.name)}</b><span>${esc(x.full)}</span></button>`).join("")
      : `<p class="hint">Nothing found for "${esc(q)}". Try a nearby town${mapOk() ? ", or tap the map" : ""}.</p>`;
  }

  // ---------- actions ----------
  async function sign(id) {
    const d = v.dives.find(x => x.id === id) || (v.toSign || []).find(x => x.id === id);
    const label = d ? `dive ${d.dive_no} at ${d.site_name}${d.diver ? " for " + d.diver : ""}` : "this dive";
    const comment = window.prompt(`Sign off ${label}?\n\nAdd a comment for the student if you like (optional):`, "");
    if (comment === null) return;
    const r = await C.client.rpc("sign_dive", { dive_id: id, comment });
    if (r.error) { toast("Not signed: " + C.explain(r.error)); return; }
    const row = Array.isArray(r.data) ? r.data[0] : r.data;
    if (row) v.dives = v.dives.map(x => x.id === row.id ? row : x);
    if (v.toSign) v.toSign = v.toSign.filter(x => x.id !== id);
    toast("Signed off.");
    if (mine()) { const p = document.querySelector(".lb-tosign"); if (p) p.outerHTML = toSignPanel(); }
    else drawOutsideForm();
  }
  async function unsign(id) {
    if (!window.confirm("Take back the sign-off on this dive? The student can then edit it again.")) return;
    const r = await C.client.rpc("unsign_dive", { dive_id: id });
    if (r.error) { toast("Not changed: " + C.explain(r.error)); return; }
    const row = Array.isArray(r.data) ? r.data[0] : r.data;
    if (row) v.dives = v.dives.map(x => x.id === row.id ? row : x);
    drawOutsideForm(); toast("Sign-off taken back.");
  }
  async function view(uid, focusId) {
    v.viewing = uid && uid !== v.uid ? uid : null;
    const m = (v.members || []).find(x => x.id === uid);
    v.viewingName = m ? m.name : (v.toSign || []).find(x => x.user_id === uid) ? v.toSign.find(x => x.user_id === uid).diver : "Member";
    v.form = null; v.open = new Set(focusId ? [focusId] : []);
    history.replaceState(null, "", v.viewing ? "#member=" + v.viewing : location.pathname + location.search);
    await loadDives();
    if (focusId) { const c = document.getElementById("dive-" + focusId); if (c) c.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }

  root.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-lb]"); if (!b) return;
    const act = b.dataset.lb, id = b.dataset.id;
    if (act === "toggle") {
      if (v.open.has(id)) v.open.delete(id); else v.open.add(id);
      const d = v.dives.find(x => x.id === id), li = document.getElementById("dive-" + id);
      if (d && li) li.outerHTML = diveCard(d);
    } else if (act === "new") openForm(null);
    else if (act === "edit") { const d = v.dives.find(x => x.id === id); if (d) openForm(d); }
    else if (act === "cancel") closeForm();
    else if (act === "find") find();
    else if (act === "pick") {
      const x = v.results[Number(b.dataset.i)]; if (!x) return;
      placePin(x.lat, x.lng, false);
      document.getElementById("lb-sname").value = x.name; document.getElementById("lb-splace").value = x.place;
      document.getElementById("lb-results").innerHTML = `<p class="hint">Picked <b>${esc(x.name)}</b>. Change the name to the dive site if you like.</p>`;
    } else if (act === "del") {
      const d = v.dives.find(x => x.id === id); if (!d) return;
      if (!window.confirm(`Delete dive ${d.dive_no} at ${d.site_name}? This can't be undone. The place stays on your map.`)) return;
      b.disabled = true;
      const r = await C.client.from("dive_logs").delete().eq("id", id);
      if (r.error) { b.disabled = false; toast("Not deleted: " + C.explain(r.error)); return; }
      v.dives = v.dives.filter(x => x.id !== id); v.open.delete(id); drawOutsideForm(); toast("Dive deleted.");
    } else if (act === "go") {
      const d = v.dives.find(x => x.id === id);
      if (d && pageMap) { pageMap.setView([d.lat, d.lng], Math.max(pageMap.getZoom(), 9)); document.getElementById("lb-map").scrollIntoView({ behavior: "smooth", block: "center" }); }
    } else if (act === "print" || act === "pdf") {
      if (!window.LDLogPDF || !v.dives.length) return;
      const info = { name: (v.profile && v.profile.full_name) || (mine() ? "" : v.viewingName) || (mine() && C.user.email) || "",
        email: mine() ? C.user.email : "", certifications: (v.profile && v.profile.certifications) || [] };
      if (act === "print") { window.LDLogPDF.print(v.dives, info); return; }
      const label = b.textContent; b.disabled = true;
      try {
        await window.LDLogPDF.download(v.dives, info, (i, n) => { b.textContent = `Making page ${i} of ${n}…`; });
        toast("PDF downloaded.");
      } catch (err) {
        console.error(err);
        toast("The PDF maker couldn't load. Opening print instead: choose “Save as PDF”.");
        window.LDLogPDF.print(v.dives, info);
      } finally { b.textContent = label; b.disabled = false; }
    } else if (act === "sign") sign(id);
    else if (act === "unsign") unsign(id);
    else if (act === "view") view(b.dataset.uid, id);
  });
  root.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.lbChange === "member") { view(t.value || null); return; }
    if (t.id === "lb-site") {
      const box = document.getElementById("lb-newplace"); if (!box) return;
      box.hidden = t.value !== "new";
      if (!box.hidden) { setupFormMap(); setTimeout(() => { const q = document.getElementById("lb-q"); if (q) q.focus(); }, 0); }
    } else if (t.id === "lb-gas") {
      root.querySelector(".lb-o2").hidden = !["nitrox", "trimix"].includes(t.value);
      root.querySelector(".lb-he").hidden = t.value !== "trimix";
      if (t.value === "nitrox" && !g("lb-o2")) document.getElementById("lb-o2").value = "32";
    } else if (t.name === "lb-tag" && t.value === "training") {
      root.querySelectorAll(".lb-training").forEach(x => { x.hidden = !t.checked; });
    } else if (t.id === "lb-units") {
      const u = U[t.value] || U.imperial, set = (id, txt) => { const l = root.querySelector(`label[for="${id}"]`); if (l) l.textContent = txt; };
      set("lb-max", `Max depth (${u.depth})`); set("lb-avg", `Average depth (${u.depth})`); set("lb-sp", `Start pressure (${u.press})`);
      set("lb-ep", `End pressure (${u.press})`); set("lb-wt", `Weight (${u.wt})`); set("lb-wtemp", `Water temp (${u.temp})`);
      set("lb-atemp", `Air temp (${u.temp})`); set("lb-vis", `Visibility (${u.vis})`);
    }
  });
  root.addEventListener("keydown", (e) => { if (e.target.id === "lb-q" && e.key === "Enter") { e.preventDefault(); find(); } });
  root.addEventListener("submit", (e) => { e.preventDefault(); save(); });

  // ---------- start ----------
  async function sync() {
    const uid = C && C.user && C.user.id;
    if (!uid) { v.uid = null; v.access = null; v.dives = []; v.form = null; v.viewing = null; v.members = null; draw(); return; }
    if (uid === v.uid) return;
    v.uid = uid; v.access = null; v.form = null; v.viewing = null; v.members = null; draw();
    await loadAccess();
    if (!v.access) { draw(); return; }
    await Promise.all([loadToSign(), loadMembers()]);
    const m = /^#member=([0-9a-f-]{36})$/.exec(location.hash);
    if (m && C.can("divemaster")) { await view(m[1]); return; }
    await loadDives();
    if (/^#new$/.test(location.hash)) { history.replaceState(null, "", location.pathname + location.search); openForm(null); }
  }
  if (!C || !C.available) { draw(); return; }
  draw();
  C.onChange(() => sync().catch(err => { v.loaded = true; v.err = C.explain(err); draw(); }));
  C.ready.then(() => sync().catch(err => { v.loaded = true; v.err = C.explain(err); draw(); }));
})();
