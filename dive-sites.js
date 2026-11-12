/* Limitless Diving — "Places I've dived" in the Student portal (account.html).
   A signed-in member searches for a place (or taps the map), names it, and adds it to their dives. Each one is
   a row in the Supabase table dive_sites (supabase/schema.sql), which only its owner can change. The public
   Dive map (dive-map.html) shows every member's places as pins, without names.
   This lives in its own <section id="my-sites"> beside the account page's <main>, so the account page's
   redraws never reset the map. */
(function () {
  "use strict";

  const box = document.getElementById("my-sites"), C = window.LDCloud, M = window.LDMap;
  if (!box || !C || !C.available || !M) return;
  const esc = M.esc;
  const v = { sites: [], loaded: false, err: "", pending: null, results: [], busy: false, uid: null, note: "", noteKind: "" };
  let map = null, layer = null, pendingMarker = null;

  function fmtDate(d) {
    if (!d) return "";
    const x = new Date(d + "T12:00:00");
    return isNaN(x) ? d : x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function today() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  function shell() {
    box.innerHTML = `<div class="panel ms-panel">
      <h2 class="sec">Places I've dived</h2>
      <p class="hint">Add the places you've dived. Each one becomes a pin on our <a href="dive-map.html">Dive map</a>. The map shows the place, never your name.</p>
      <div class="ms-cols">
        <div class="ms-map-wrap"><div class="ms-map" id="ms-map" role="application" aria-label="Map. Tap to drop a pin where you dived."></div>
          ${M.ok() ? "" : `<p class="acct-note bad">The map couldn't be loaded. You can still search for a place and add it.</p>`}</div>
        <form class="ms-form" id="ms-form" novalidate>
          <div class="field"><label for="ms-q">Find a place</label>
            <div class="ms-search"><input id="ms-q" type="search" maxlength="200" placeholder="e.g. Cozumel, Dahab Blue Hole, Lake Hydra" autocomplete="off">
              <button type="button" class="btn" data-ms="find">Find</button></div></div>
          <div id="ms-results" class="ms-results" aria-live="polite"></div>
          <p class="hint" id="ms-pin-hint">Or tap the map to drop your pin.</p>
          <div class="field"><label for="ms-name">Dive site name</label><input id="ms-name" maxlength="120" placeholder="e.g. Palancar Reef"></div>
          <div class="field"><label for="ms-place">Where</label><input id="ms-place" maxlength="200" placeholder="e.g. Cozumel, Mexico"></div>
          <div class="ms-two"><div class="field"><label for="ms-date">Date (optional)</label><input id="ms-date" type="date" max="${today()}"></div></div>
          <div class="field"><label for="ms-notes">Notes (optional, only you see these)</label><textarea id="ms-notes" maxlength="500" placeholder="Visibility, what you saw, who you dived with…"></textarea></div>
          <div class="row-actions"><button class="btn primary" type="submit" id="ms-add">Add to my dives</button></div>
          <p id="ms-note" class="ms-note" role="status"></p>
        </form>
      </div>
      <h3 class="ms-h">My dives <span id="ms-count" class="hint"></span></h3>
      <ul class="ms-list" id="ms-list"></ul></div>`;
    if (M.ok()) {
      map = M.map(document.getElementById("ms-map"));
      layer = window.L.layerGroup().addTo(map);
      map.on("click", (e) => setPending(e.latlng.lat, e.latlng.lng, true));
    }
  }

  function setNote(text, kind) {
    const n = document.getElementById("ms-note"); if (!n) return;
    n.textContent = text || ""; n.className = "ms-note" + (kind ? " " + kind : "");
  }
  function setPending(lat, lng, fromTap) {
    v.pending = { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(((lng + 540) % 360 - 180) * 1e5) / 1e5 };
    if (map) {
      if (pendingMarker) pendingMarker.setLatLng([lat, lng]);
      else pendingMarker = window.L.marker([lat, lng], { icon: M.flag(1, "new"), draggable: true, keyboard: false })
        .on("dragend", (e) => { const p = e.target.getLatLng(); v.pending = { lat: Math.round(p.lat * 1e5) / 1e5, lng: Math.round(((p.lng + 540) % 360 - 180) * 1e5) / 1e5 }; })
        .addTo(map);
      if (!fromTap) map.setView([lat, lng], Math.max(map.getZoom(), 9));
    }
    const h = document.getElementById("ms-pin-hint");
    if (h) h.textContent = fromTap ? "Pin dropped. Drag it to fine-tune, then name the site below." : "Pin placed. Drag it on the map to fine-tune if you need to.";
    if (fromTap) { const n = document.getElementById("ms-name"); if (n && !n.value) n.focus(); }
  }
  function clearPending() {
    v.pending = null; v.results = [];
    if (pendingMarker && map) { map.removeLayer(pendingMarker); pendingMarker = null; }
    ["ms-q", "ms-name", "ms-place", "ms-date", "ms-notes"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    const r = document.getElementById("ms-results"); if (r) r.innerHTML = "";
    const h = document.getElementById("ms-pin-hint"); if (h) h.textContent = "Or tap the map to drop your pin.";
  }

  function drawList() {
    const ul = document.getElementById("ms-list"), count = document.getElementById("ms-count");
    if (!ul) return;
    if (count) count.textContent = v.sites.length ? "(" + v.sites.length + ")" : "";
    ul.innerHTML = !v.loaded ? `<li class="hint">Loading your dives…</li>`
      : v.err ? `<li class="acct-note bad" role="alert">${esc(v.err)}</li>`
      : !v.sites.length ? `<li class="hint">No places yet. Your first one goes on the map for everyone to see.</li>`
      : v.sites.map(s => `<li><button type="button" class="ms-site" data-ms="go" data-id="${esc(s.id)}"><b>${esc(s.name)}</b>
          <span>${esc([s.place, fmtDate(s.dived_on)].filter(Boolean).join(" · "))}</span>${s.notes ? `<span class="ms-notes">${esc(s.notes)}</span>` : ""}</button>
          <button type="button" class="btn small danger" data-ms="rm" data-id="${esc(s.id)}" aria-label="Remove ${esc(s.name)}">Remove</button></li>`).join("");
    if (layer) {
      layer.clearLayers();
      v.sites.forEach(s => window.L.marker([s.lat, s.lng], { icon: M.flag(1), keyboard: false })
        .bindPopup(`<b>${esc(s.name)}</b>${s.place ? "<br>" + esc(s.place) : ""}${s.dived_on ? "<br>" + esc(fmtDate(s.dived_on)) : ""}`).addTo(layer));
    }
  }
  function fit() {
    if (!map || !v.sites.length) return;
    if (v.sites.length === 1) map.setView([v.sites[0].lat, v.sites[0].lng], 6);
    else map.fitBounds(window.L.latLngBounds(v.sites.map(s => [s.lat, s.lng])), { padding: [30, 30], maxZoom: 8 });
  }

  async function load() {
    v.loaded = false; v.err = ""; drawList();
    const { data, error } = await C.client.from("dive_sites").select("*").eq("user_id", C.user.id).order("dived_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
    v.loaded = true;
    if (error) v.err = /dive_sites|PGRST205|schema cache|does not exist/i.test(error.message || "")
      ? "Places I've dived isn't switched on yet. Your instructor needs to update the database first."
      : "Your dives couldn't be loaded: " + C.explain(error);
    v.sites = error ? [] : data || [];
    drawList(); fit();
  }

  async function find() {
    const q = (document.getElementById("ms-q").value || "").trim(), r = document.getElementById("ms-results");
    if (q.length < 2) { r.innerHTML = `<p class="hint">Type a place to search for.</p>`; return; }
    r.innerHTML = `<p class="hint">Searching…</p>`;
    try { v.results = await M.search(q); } catch (err) { v.results = []; r.innerHTML = `<p class="acct-note bad">${esc(err.message || "Search failed. You can tap the map instead.")}</p>`; return; }
    r.innerHTML = v.results.length ? `<p class="hint">Pick the right one:</p>` + v.results.map((x, i) => `<button type="button" class="ms-hit" data-ms="pick" data-i="${i}"><b>${esc(x.name)}</b><span>${esc(x.full)}</span></button>`).join("")
      : `<p class="hint">Nothing found for "${esc(q)}". Try a nearby town, or tap the map to drop your pin.</p>`;
  }

  async function add() {
    const name = document.getElementById("ms-name").value.trim(), place = document.getElementById("ms-place").value.trim();
    const date = document.getElementById("ms-date").value, notes = document.getElementById("ms-notes").value.trim();
    if (!v.pending) { setNote("Find the place or tap the map to put a pin where you dived.", "bad"); return; }
    if (!name) { setNote("Give the dive site a name.", "bad"); document.getElementById("ms-name").focus(); return; }
    if (date && date > today()) { setNote("The date can't be in the future.", "bad"); return; }
    const btn = document.getElementById("ms-add"); btn.disabled = true; setNote("Saving…");
    const { data, error } = await C.client.from("dive_sites")
      .insert({ name: name.slice(0, 120), place: place.slice(0, 200), lat: v.pending.lat, lng: v.pending.lng, dived_on: date || null, notes: notes.slice(0, 500) })
      .select().single();
    btn.disabled = false;
    if (error) { setNote("Not saved: " + C.explain(error), "bad"); return; }
    v.sites.unshift(data); clearPending(); drawList();
    if (map) map.setView([data.lat, data.lng], Math.max(map.getZoom(), 6));
    setNote("Added. It's on the Dive map now.", "ok");
  }

  box.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-ms]"); if (!b) return;
    const act = b.dataset.ms;
    if (act === "find") find();
    else if (act === "pick") {
      const x = v.results[Number(b.dataset.i)]; if (!x) return;
      setPending(x.lat, x.lng, false);
      document.getElementById("ms-name").value = x.name; document.getElementById("ms-place").value = x.place;
      document.getElementById("ms-results").innerHTML = `<p class="hint">Picked <b>${esc(x.name)}</b>. Change the name to the dive site if you like.</p>`;
    } else if (act === "go") {
      const s = v.sites.find(x => x.id === b.dataset.id);
      if (s && map) { map.setView([s.lat, s.lng], Math.max(map.getZoom(), 8)); document.getElementById("ms-map").scrollIntoView({ behavior: "smooth", block: "center" }); }
    } else if (act === "rm") {
      const s = v.sites.find(x => x.id === b.dataset.id); if (!s) return;
      if (!window.confirm(`Remove ${s.name} from your dives? Its pin leaves the Dive map too.`)) return;
      b.disabled = true;
      const { error } = await C.client.from("dive_sites").delete().eq("id", s.id);
      if (error) { b.disabled = false; setNote("Not removed: " + C.explain(error), "bad"); return; }
      v.sites = v.sites.filter(x => x.id !== s.id); drawList(); setNote("Removed.", "ok");
    }
  });
  box.addEventListener("keydown", (e) => { if (e.target.id === "ms-q" && e.key === "Enter") { e.preventDefault(); find(); } });
  box.addEventListener("submit", (e) => { e.preventDefault(); add(); });

  function sync() {
    const uid = C.user && C.user.id;
    if (!uid || /type=recovery/.test(location.hash)) { box.hidden = true; v.uid = null; return; }
    if (uid === v.uid) return;
    v.uid = uid; v.sites = [];
    if (!box.firstChild) shell(); else { clearPending(); setNote(""); }
    box.hidden = false;
    if (map) setTimeout(() => map.invalidateSize(), 0);
    load().catch(err => { v.loaded = true; v.err = C.explain(err); drawList(); });
  }
  C.onChange(sync); C.ready.then(sync);
})();
