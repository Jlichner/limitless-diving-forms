/* Limitless Diving — the Dive map (dive-map.html): "Where we've dived". A world map with a pin for every place
   a Limitless Diving member has dived. Members add places in the Student portal (dive-sites.js); this page reads
   the public dive_map() function (supabase/schema.sql), which gives places and counts only, never names. */
(function () {
  "use strict";

  const main = document.getElementById("divemap"), M = window.LDMap, esc = M.esc;
  let pins = [], members = 0, map = null, markers = [];

  function country(place) { const p = String(place || "").split(",").map(t => t.trim()).filter(Boolean); return p.length ? p[p.length - 1] : ""; }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many || one + "s"); }

  function render(state) {
    const countries = new Set(pins.map(p => country(p.place)).filter(Boolean)).size;
    const stats = pins.length ? `<div class="dm-stats">
        <div><b>${pins.length}</b><span>${pins.length === 1 ? "dive site" : "dive sites"}</span></div>
        ${countries ? `<div><b>${countries}</b><span>${countries === 1 ? "country" : "countries"}</span></div>` : ""}
        ${members ? `<div><b>${members}</b><span>${members === 1 ? "member" : "members"}</span></div>` : ""}</div>` : "";
    const sorted = pins.slice().sort((a, b) => b.divers - a.divers || b.entries - a.entries || a.name.localeCompare(b.name));
    main.innerHTML = `<section class="pub-hero dm-hero"><span class="eyebrow">Limitless Diving members</span><h1>Where We've Dived</h1>
        <p>Every flag is a place one of our divers has explored. Been somewhere new? Add it in your <a href="account.html">Student portal</a> under Places I've dived.</p></section>
      ${stats}
      <div class="panel dm-panel"><div class="dm-map" id="dm-map" aria-label="World map of places our members have dived"></div>
        ${M.ok() ? "" : `<p class="acct-note bad">The map couldn't be loaded. Check your connection and refresh the page. The list of places is below.</p>`}
        ${state ? `<p class="hint dm-state" role="status">${esc(state)}</p>` : ""}</div>
      ${sorted.length ? `<section class="panel dm-list-panel" aria-labelledby="dm-list-h"><h2 id="dm-list-h" class="sec">All dive sites</h2>
        <ul class="dm-list">${sorted.map((p, i) => `<li><button type="button" data-pin="${pins.indexOf(p)}"><b>${esc(p.name)}</b>
          <span>${esc(p.place)}</span><em>${esc(plural(p.divers, "diver"))}</em></button></li>`).join("")}</ul></section>` : ""}
      <p class="nx-note">Pins show the area of a dive site, rounded to about a kilometre. Names of members are never shown.</p>`;
    drawMap();
  }

  function drawMap() {
    if (!M.ok()) return;
    map = M.map(document.getElementById("dm-map"));
    markers = pins.map(p => window.L.marker([p.lat, p.lng], { icon: M.flag(p.divers), title: p.name, alt: p.name })
      .bindPopup(`<b>${esc(p.name)}</b>${p.place ? "<br>" + esc(p.place) : ""}<br><span class="dm-pop">${esc(plural(p.divers, "member"))} dived here</span>`)
      .addTo(map));
    if (pins.length > 1) map.fitBounds(window.L.latLngBounds(pins.map(p => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 6 });
    else if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], 5);
  }

  main.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pin]"); if (!b || !map) return;
    const i = Number(b.dataset.pin), p = pins[i]; if (!p) return;
    map.setView([p.lat, p.lng], Math.max(map.getZoom(), 8));
    markers[i].openPopup();
    document.getElementById("dm-map").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  async function load() {
    const cfg = window.LD_SUPABASE || {}, key = String(cfg.key || "").trim();
    let url = ""; try { const x = new URL(String(cfg.url || "").trim()); if (x.protocol === "https:") url = x.origin; } catch (e) { /* none */ }
    if (!url || key.length < 20) return render("The dive map is coming soon.");
    const rpc = (name) => fetch(url + "/rest/v1/rpc/" + name, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: "{}", cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
    try {
      const [rows, n] = await Promise.all([rpc("dive_map"), rpc("dive_map_members").catch(() => 0)]);
      pins = (Array.isArray(rows) ? rows : []).map(r => ({ lat: Number(r.lat), lng: Number(r.lng), name: String(r.name || "Dive site"), place: String(r.place || ""),
        divers: Number(r.divers) || 1, entries: Number(r.entries) || 1 })).filter(p => isFinite(p.lat) && isFinite(p.lng));
      members = Number(n) || 0;
      render(pins.length ? "" : "No pins yet. Be the first: add a place you've dived in your Student portal.");
    } catch (err) {
      render("The dive map couldn't load the pins right now. Please try again later.");
    }
  }

  main.innerHTML = `<div class="msg">Loading the dive map…</div>`;
  load();
})();
