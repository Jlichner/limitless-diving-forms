/* Limitless Diving — a dive site survey map in Site maps (e.g. bonnie-castle-map.html).
   The page's <main id="surveymap" data-site="..."> names the site; its data file (e.g. bonnie-castle-data.js)
   puts the survey in window.SITE_MAPS. survey-geometry.js does the math and survey-icons.js has the landmark
   icons. The map is in feet, north up, on a plain Leaflet map (no world tiles), so it can be zoomed, panned
   and tapped. */
(function () {
  "use strict";

  const main = document.getElementById("surveymap");
  const D = (window.SITE_MAPS || {})[main.dataset.site], G = window.SurveyGeometry, ICONS = window.SURVEY_ICONS || {}, L = window.L;
  if (!D) { main.innerHTML = `<div class="msg">This site map couldn't be loaded. Refresh the page to try again.</div>`; return; }
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ll = (x, y) => [y, x];
  const KIND = {
    surveyed: { label: "Surveyed line", color: "#1c2b33", weight: 1.6 },
    unsurveyed: { label: "Unsurveyed line", color: "#1c2b33", weight: 1.4, dashArray: "5 5" },
    removed: { label: "Removed line", color: "#b4bcc0", weight: 1.6 },
    marina: { label: "Caution: boat traffic overhead", color: "#d7263d", weight: 2.4 },
  };
  const MOORING = "icons/mooringblock.png";
  const LEGEND_NAMES = { "icons/shipwreck.png": "Shipwreck" }; // icons used by more than one landmark

  const geo = G.compute(D), shapes = G.extras(geo.at);
  const name = lm => (D.landmarks && D.landmarks[lm]) || lm;
  const runName = r => (D.runNames && D.runNames[r]) || r;
  const entry = (run, i) => (D.runs[run] || [])[i] || {};
  let map, layers = {}, markerFor = {};

  function ftIn(e) {
    const ft = Number(e.length_ft) || 0, inch = Number(e.length_in) || 0;
    return inch ? `${ft} ft ${inch} in` : `${ft} ft`;
  }
  function iconHtml(path) {
    const ic = ICONS[path];
    if (!ic) return "";
    return ic.svg ? ic.svg : `<img src="${ic.png}" alt="">`;
  }

  // Line surveyed = surveyed and boat-traffic line, at the lengths the divers measured.
  function totals() {
    let ft = 0;
    for (const s of geo.segments) if (s.kind === "surveyed" || s.kind === "marina") ft += (Number(entry(s.run, s.index).length_ft) || 0) + (Number(entry(s.run, s.index).length_in) || 0) / 12;
    const named = geo.landmarks.filter(l => l.icon && l.icon !== MOORING).length;
    return { ft, named, stakes: geo.stakes.length, tieoffs: geo.tieoffs.length };
  }

  function render() {
    const t = totals();
    const legendIcons = [], seen = new Set();
    for (const l of geo.landmarks) {
      if (!l.icon || l.icon === MOORING || !ICONS[l.icon]) continue;
      const label = LEGEND_NAMES[l.icon] || name(l.landmark);
      if (seen.has(label)) continue;
      seen.add(label); legendIcons.push({ label, icon: l.icon, bg: !l.transparent });
    }
    legendIcons.sort((a, b) => a.label.localeCompare(b.label));
    const places = geo.landmarks.filter(l => (l.icon && l.icon !== MOORING) || l.depth != null)
      .filter((l, i, a) => a.findIndex(o => o.landmark === l.landmark) === i)
      .sort((a, b) => name(a.landmark).localeCompare(name(b.landmark)));

    main.innerHTML = `<a class="back" href="site-maps.html">← All site maps</a>
      <section class="pub-hero dm-hero"><span class="eyebrow">Site map · ${esc(D.place || "")}</span>
        <h1>${esc(D.title)}</h1><p>${esc(D.subtitle)}.</p></section>
      <p class="sm-test" role="note"><b>New:</b> the ${esc(D.version.replace(/^v[\d.]+ /, ""))} survey map, now drawn live from the survey data. Zoom in, and tap a line or landmark to see what was measured. An editor for the survey crew is on the way.</p>
      <div class="dm-stats">
        <div><b>${Math.round(t.ft).toLocaleString()}</b><span>feet of line surveyed (${(t.ft * 0.3048 / 1000).toFixed(1)} km)</span></div>
        <div><b>${t.named}</b><span>landmarks</span></div>
        <div><b>${t.stakes}</b><span>stakes</span></div>
        <div><b>${t.tieoffs}</b><span>tie-offs</span></div></div>
      <div class="panel dm-panel">
        <div class="sm-tools" role="group" aria-label="Show on the map">
          <label><input type="checkbox" data-layer="depths" checked> Depths</label>
          <label><input type="checkbox" data-layer="points" checked> Stakes, tie-offs and arrows</label>
          <label><input type="checkbox" data-layer="icons" checked> Landmark icons</label>
          <label><input type="checkbox" data-layer="moorings"> Mooring blocks</label>
          <button type="button" class="btn" id="sm-fit">Show the whole park</button></div>
        <div class="dm-map sm-map" id="sm-map" aria-label="Survey map of the Bonnie Castle Scuba Park"></div>
        ${L ? "" : `<p class="acct-note bad">The map couldn't be loaded. Check your connection and refresh the page.</p>`}
        ${geo.warnings.length ? `<p class="hint dm-state" role="status">${geo.warnings.map(esc).join("<br>")}</p>` : ""}</div>
      <section class="panel" aria-labelledby="sm-key-h"><h2 id="sm-key-h" class="sec">Map key</h2>
        <ul class="sm-key">
          ${Object.values(KIND).map(k => `<li><span class="sm-sw" aria-hidden="true"><svg viewBox="0 0 36 10"><line x1="3" y1="5" x2="33" y2="5" stroke="${k.color}" stroke-width="2.4" ${k.dashArray ? 'stroke-dasharray="5 4"' : ""}/></svg></span>${esc(k.label)}</li>`).join("")}
          <li><span class="sm-sw" aria-hidden="true"><span class="sm-stake"></span></span>Stake</li>
          <li><span class="sm-sw" aria-hidden="true"><span class="sm-tie"></span></span>Tie-off</li>
          <li><span class="sm-sw" aria-hidden="true"><span class="sm-arrow"><svg viewBox="0 0 12 12"><polygon points="6,1 11,11 1,11"/></svg></span></span>Line arrow</li>
          <li><span class="sm-sw" aria-hidden="true"><span class="sm-plat"></span></span>Platform</li>
          <li><span class="sm-sw" aria-hidden="true"><span class="sm-num">66'</span></span>Depth in feet</li>
          ${legendIcons.map(i => `<li><span class="sm-sw" aria-hidden="true"><span class="sm-lm${i.bg ? " bg" : ""}">${iconHtml(i.icon)}</span></span>${esc(i.label)}</li>`).join("")}
        </ul></section>
      <section class="panel dm-list-panel" aria-labelledby="sm-list-h"><h2 id="sm-list-h" class="sec">Landmarks</h2>
        <ul class="dm-list">${places.map(l => `<li><button type="button" data-lm="${esc(l.landmark)}"><b>${esc(name(l.landmark))}</b>
          <span>${l.depth != null ? esc(l.depth + " ft deep") : "Depth not recorded"}</span></button></li>`).join("")}</ul></section>
      <p class="nx-note">Surveyed by ${esc(D.surveyors.join(", "))}. Map program by Stephanie Yang. ${esc(D.credit)}, ${esc(D.version)}.
        Lengths and headings are as the divers measured them. Where two routes meet again, both are stretched and turned a little so they join up.</p>`;

    main.querySelectorAll("[data-layer]").forEach(cb => cb.addEventListener("change", () => toggle(cb.dataset.layer, cb.checked)));
    main.querySelector("#sm-fit").addEventListener("click", fit);
    main.querySelectorAll("[data-lm]").forEach(b => b.addEventListener("click", () => goTo(b.dataset.lm)));
    if (L) drawMap();
  }

  function toggle(layer, on) {
    if (!map || !layers[layer]) return;
    if (on) layers[layer].addTo(map); else layers[layer].remove();
  }
  function fit() {
    if (!map) return;
    const [[x0, y0], [x1, y1]] = geo.bounds;
    map.fitBounds([ll(x0, y0), ll(x1, y1)], { padding: [24, 24] });
  }
  function goTo(lm) {
    const m = markerFor[lm];
    if (!m || !map) return;
    map.getContainer().scrollIntoView({ behavior: "smooth", block: "center" });
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 1));
    m.openPopup();
  }

  function landmarkPopup(l) {
    const from = D.plan.filter(s => s.start === l.landmark).map(s => s.run2 ? `${runName(s.run)} and ${runName(s.run2)}` : runName(s.run));
    return `<b>${esc(name(l.landmark))}</b>${l.depth != null ? `<br>${esc(l.depth)} ft deep` : ""}
      <br><span class="dm-pop">On ${esc(runName(l.run))}</span>
      ${from.length ? `<br><span class="dm-pop">Lines from here: ${from.map(esc).join("; ")}</span>` : ""}`;
  }
  function segmentPopup(s) {
    const e = entry(s.run, s.index), k = KIND[s.kind];
    const n = (D.runs[s.run] || []).slice(0, s.index + 1).filter(x => /Line$/.test(x.type)).length;
    const measured = (Number(e.length_ft) || 0) + (Number(e.length_in) || 0) / 12, stretch = Math.abs(s.lengthFt / measured - 1);
    return `<b>${esc(runName(s.run))}</b><br>${esc(k.label)} ${n}: ${esc(ftIn(e))} at ${esc(e.angle)}°
      ${e.note ? `<br><span class="dm-pop">Note: ${esc(e.note)}</span>` : ""}
      ${stretch > 0.005 ? `<br><span class="dm-pop">Drawn ${Math.round(stretch * 100)}% ${s.lengthFt > measured ? "longer" : "shorter"} so the route joins up</span>` : ""}`;
  }

  function drawMap() {
    const el = document.getElementById("sm-map");
    map = L.map(el, { crs: L.CRS.Simple, minZoom: -3, maxZoom: 4, zoomSnap: 0.25, zoomDelta: 0.5, attributionControl: false, scrollWheelZoom: false });
    map.once("focus", () => map.scrollWheelZoom.enable());
    map.on("click", () => map.scrollWheelZoom.enable());
    const canvas = L.canvas({ padding: 0.5, tolerance: 6 });

    layers.shapes = L.layerGroup(shapes.map(s => L.polygon(s.points.map(p => ll(p[0], p[1])),
      s.kind === "ramp" ? { renderer: canvas, stroke: false, fillColor: "#d9d6cf", fillOpacity: 1, interactive: false }
        : { renderer: canvas, color: "#1c2b33", weight: 1, fillColor: "#1c2b33", fillOpacity: 1 }).bindTooltip(esc(s.label)))).addTo(map);

    layers.lines = L.layerGroup(geo.segments.map(s => {
      const k = KIND[s.kind];
      return L.polyline([ll(s.x0, s.y0), ll(s.x1, s.y1)], { renderer: canvas, color: k.color, weight: k.weight, dashArray: k.dashArray || null, lineCap: "butt" })
        .bindPopup(() => segmentPopup(s));
    })).addTo(map);

    const stakeIcon = L.divIcon({ className: "sm-stake", iconSize: [6, 6] });
    const arrowIcon = h => L.divIcon({ className: "sm-arrow", iconSize: [10, 10], html: `<svg viewBox="0 0 12 12" style="transform:rotate(${h}deg)"><polygon points="6,1 11,11 1,11"/></svg>` });
    layers.points = L.layerGroup([
      ...geo.tieoffs.map(p => L.circleMarker(ll(p.x, p.y), { renderer: canvas, radius: 2.6, stroke: false, fillColor: "#1d4ed8", fillOpacity: 1 })
        .bindTooltip(`Tie-off on ${esc(runName(p.run))}${entry(p.run, p.index).note ? ": " + esc(entry(p.run, p.index).note) : ""}`)),
      ...geo.stakes.map(p => L.marker(ll(p.x, p.y), { icon: stakeIcon, keyboard: false })
        .bindTooltip(`Stake on ${esc(runName(p.run))}${entry(p.run, p.index).note ? ": " + esc(entry(p.run, p.index).note) : ""}`)),
      ...geo.arrows.map(p => L.marker(ll(p.x, p.y), { icon: arrowIcon(p.heading), keyboard: false, interactive: false })),
    ]).addTo(map);

    layers.icons = L.layerGroup(), layers.moorings = L.layerGroup(), layers.depths = L.layerGroup();
    for (const l of geo.landmarks) {
      let m;
      if (l.icon === MOORING) {
        m = L.marker(ll(l.x, l.y), { icon: L.divIcon({ className: "sm-mooring", iconSize: [8, 8] }), title: name(l.landmark), alt: name(l.landmark) });
        layers.moorings.addLayer(m.bindPopup(landmarkPopup(l)));
      } else if (l.icon && ICONS[l.icon]) {
        m = L.marker(ll(l.x, l.y), { title: name(l.landmark), alt: name(l.landmark), riseOnHover: true,
          icon: L.divIcon({ className: "sm-lm" + (l.transparent ? "" : " bg"), iconSize: [24, 24], html: iconHtml(l.icon) }) });
        layers.icons.addLayer(m.bindPopup(landmarkPopup(l)));
      } else {
        m = L.circleMarker(ll(l.x, l.y), { renderer: canvas, radius: 4, color: "#0f7c8c", weight: 1.5, fillColor: "#ffffff", fillOpacity: 1 });
        layers.icons.addLayer(m.bindTooltip(esc(name(l.landmark))).bindPopup(landmarkPopup(l)));
      }
      markerFor[l.landmark] = m;
    }
    // Depths sit beside their landmark, in the direction the survey data gives, a fixed distance on screen.
    for (const d of geo.depths) {
      const a = G.radians(d.angle), r = 22 * d.zoom, dx = r * Math.cos(a), dy = r * Math.sin(a);
      layers.depths.addLayer(L.marker(ll(d.x, d.y), { interactive: false, keyboard: false,
        icon: L.divIcon({ className: "sm-num", iconSize: [34, 16], iconAnchor: [17 - dx, 8 + dy], html: esc(d.depth) + "'" }) }));
    }
    layers.icons.addTo(map); layers.depths.addTo(map);

    north().addTo(map);
    scale().addTo(map);
    fit();
  }

  function north() {
    const c = L.control({ position: "topright" });
    c.onAdd = () => { const d = L.DomUtil.create("div", "sm-north"); d.setAttribute("aria-label", "North is up");
      d.innerHTML = `<svg viewBox="0 0 24 34" aria-hidden="true"><text x="12" y="10" text-anchor="middle">N</text><polygon points="12,13 19,32 12,27 5,32"/></svg>`; return d; };
    return c;
  }

  // Scale bar in feet and metres. On this map 1 foot is 2^zoom pixels.
  function scale() {
    const c = L.control({ position: "bottomleft" });
    c.onAdd = m => {
      const d = L.DomUtil.create("div", "sm-scale");
      const pick = (perUnit, steps) => steps.filter(v => v * perUnit <= 130).pop() || steps[0];
      const update = () => {
        const pxFt = Math.pow(2, m.getZoom()), ft = pick(pxFt, [5, 10, 25, 50, 100, 250, 500, 1000]);
        const pxM = pxFt / 0.3048, mt = pick(pxM, [2, 5, 10, 25, 50, 100, 200, 300]);
        d.innerHTML = `<div style="width:${Math.round(ft * pxFt)}px">${ft} ft</div><div style="width:${Math.round(mt * pxM)}px">${mt} m</div>`;
      };
      m.on("zoomend", update); update();
      return d;
    };
    return c;
  }

  render();
})();
