/* Limitless Diving — a dive site survey map in Site maps (e.g. bonnie-castle-map.html).
   The page's <main id="surveymap" data-site="..."> names the site. Its data file (e.g. bonnie-castle-data.js)
   puts the survey in window.SITE_MAPS; once an Admin has published the map from the editor, the published
   version in the database (site_maps) is drawn instead. survey-geometry.js does the math and survey-icons.js
   has the landmark icons. The map is in feet, north up, on a plain Leaflet map (no world tiles).

   window.SurveyMap is what the editor (survey-editor.js) uses:
     S.data, S.version     the published survey and its version (0 = not yet published, from the data file)
     S.show(data, opts)    draw other data, e.g. a preview: opts.base marks what's new (orange) and gone (red)
     S.reset()             draw the published survey again
     S.focusChanges()      zoom to what the last preview changed
     S.setPicker(fn)       while set, tapping a stake, tie-off, landmark or line calls fn(feature)
     S.select(feature)     ring the selected feature
     S.onPublished(fn)     called when the published survey changes */
(function () {
  "use strict";

  const main = document.getElementById("surveymap");
  const site = main.dataset.site, G = window.SurveyGeometry, ICONS = window.SURVEY_ICONS || {}, L = window.L;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ll = (x, y) => [y, x];
  const KIND = {
    surveyed: { label: "Surveyed line", color: "#1c2b33", weight: 1.6 },
    unsurveyed: { label: "Unsurveyed line", color: "#1c2b33", weight: 1.4, dashArray: "5 5" },
    removed: { label: "Removed line", color: "#b4bcc0", weight: 1.6 },
    marina: { label: "Caution: boat traffic overhead", color: "#d7263d", weight: 2.4 },
  };
  const NEW = "#e8590c", GONE = "#d7263d";
  const MOORING = "icons/mooringblock.png";
  const LEGEND_NAMES = { "icons/shipwreck.png": "Shipwreck" }; // icons used by more than one landmark

  const S = window.SurveyMap = {
    site, data: (window.SITE_MAPS || {})[site], version: 0, updatedAt: null, map: null, esc,
    show, reset, setPicker, select, focusChanges, onPublished: fn => published.push(fn), setPublished,
    name: lm => (S.shown && S.shown.landmarks && S.shown.landmarks[lm]) || (S.data.landmarks && S.data.landmarks[lm]) || lm,
    runName: r => (S.shown && S.shown.runNames && S.shown.runNames[r]) || (S.data.runNames && S.data.runNames[r]) || r,
  };
  if (!S.data) { main.innerHTML = `<div class="msg">This site map couldn't be loaded. Refresh the page to try again.</div>`; return; }
  const published = [];
  let picker = null, layers = {}, markerFor = {}, ring = null, firstDraw = true;

  const lineFeet = e => (Number(e.length_ft) || 0) + (Number(e.length_in) || 0) / 12;
  function ftIn(e) {
    const ft = Number(e.length_ft) || 0, inch = Number(e.length_in) || 0;
    return inch ? `${ft} ft ${inch} in` : `${ft} ft`;
  }
  function iconHtml(path) {
    const ic = ICONS[path];
    if (!ic) return "";
    return ic.svg ? ic.svg : `<img src="${ic.png}" alt="">`;
  }

  function page() {
    main.innerHTML = `<a class="back" href="site-maps.html">← All site maps</a>
      <section class="pub-hero dm-hero"><span class="eyebrow">Site map · ${esc(S.data.place || "")}</span>
        <h1>${esc(S.data.title)}</h1><p>${esc(S.data.subtitle)}.</p></section>
      <p class="sm-test" role="note" id="sm-note"></p>
      <div class="dm-stats" id="sm-stats"></div>
      <div class="panel dm-panel">
        <div class="sm-tools" role="group" aria-label="Show on the map">
          <label><input type="checkbox" data-layer="depths" checked> Depths</label>
          <label><input type="checkbox" data-layer="points" checked> Stakes, tie-offs and arrows</label>
          <label><input type="checkbox" data-layer="icons" checked> Landmark icons</label>
          <label><input type="checkbox" data-layer="moorings"> Mooring blocks</label>
          <span class="sm-tools-end"><button type="button" class="btn" id="sm-fit">Show the whole site</button>
          <button type="button" class="btn primary" id="sm-edit-btn" hidden>Edit map</button></span></div>
        <div class="sm-work" id="sm-work">
          <div class="dm-map sm-map" id="sm-map" aria-label="Survey map of ${esc(S.data.title)}"></div>
          <aside class="sm-edit" id="sm-edit" hidden aria-label="Map editor"></aside></div>
        ${L ? "" : `<p class="acct-note bad">The map couldn't be loaded. Check your connection and refresh the page.</p>`}
        <p class="hint dm-state" role="status" id="sm-warn" hidden></p></div>
      <section class="panel" aria-labelledby="sm-key-h"><h2 id="sm-key-h" class="sec">Map key</h2><ul class="sm-key" id="sm-key"></ul></section>
      <section class="panel dm-list-panel" aria-labelledby="sm-list-h"><h2 id="sm-list-h" class="sec">Landmarks</h2><ul class="dm-list" id="sm-list"></ul></section>
      <p class="nx-note" id="sm-credit"></p>`;
    main.querySelectorAll("[data-layer]").forEach(cb => cb.addEventListener("change", () => toggle(cb.dataset.layer, cb.checked)));
    main.querySelector("#sm-fit").addEventListener("click", fit);
    main.querySelector("#sm-list").addEventListener("click", e => { const b = e.target.closest("[data-lm]"); if (b) goTo(b.dataset.lm); });
  }

  // The parts of the page that follow the data: note, stats, key, landmark list, credit.
  function details(d, geo) {
    const when = S.updatedAt ? new Date(S.updatedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : null;
    main.querySelector("#sm-note").innerHTML = S.version
      ? `<b>Updated ${esc(when)}</b> (version ${S.version}). Zoom in, and tap a line or landmark to see what was measured.`
      : `<b>New:</b> the ${esc(String(d.version || "").replace(/^v[\d.]+ /, ""))} survey map, now drawn live from the survey data. Zoom in, and tap a line or landmark to see what was measured.`;
    let ft = 0;
    for (const s of geo.segments) if (s.kind === "surveyed" || s.kind === "marina") ft += lineFeet(d.runs[s.run][s.index]);
    const named = geo.landmarks.filter(l => l.icon && l.icon !== MOORING).length;
    main.querySelector("#sm-stats").innerHTML = `
      <div><b>${Math.round(ft).toLocaleString()}</b><span>feet of line surveyed (${(ft * 0.3048 / 1000).toFixed(1)} km)</span></div>
      <div><b>${named}</b><span>landmarks</span></div><div><b>${geo.stakes.filter(s => s.kind === "stake").length}</b><span>stakes</span></div>
      <div><b>${geo.tieoffs.length}</b><span>tie-offs</span></div>`;
    const legendIcons = [], seen = new Set();
    for (const l of geo.landmarks) {
      if (!l.icon || l.icon === MOORING || !ICONS[l.icon]) continue;
      const label = LEGEND_NAMES[l.icon] || S.name(l.landmark);
      if (!seen.has(label)) { seen.add(label); legendIcons.push({ label, icon: l.icon, bg: !l.transparent }); }
    }
    legendIcons.sort((a, b) => a.label.localeCompare(b.label));
    main.querySelector("#sm-key").innerHTML = `
      ${Object.values(KIND).map(k => `<li><span class="sm-sw" aria-hidden="true"><svg viewBox="0 0 36 10"><line x1="3" y1="5" x2="33" y2="5" stroke="${k.color}" stroke-width="2.4" ${k.dashArray ? 'stroke-dasharray="5 4"' : ""}/></svg></span>${esc(k.label)}</li>`).join("")}
      <li><span class="sm-sw" aria-hidden="true"><span class="sm-stake"></span></span>Stake</li>
      <li><span class="sm-sw" aria-hidden="true"><span class="sm-tie"></span></span>Tie-off</li>
      <li><span class="sm-sw" aria-hidden="true"><span class="sm-arrow"><svg viewBox="0 0 12 12"><polygon points="6,1 11,11 1,11"/></svg></span></span>Line arrow</li>
      <li><span class="sm-sw" aria-hidden="true"><span class="sm-plat"></span></span>Platform</li>
      <li><span class="sm-sw" aria-hidden="true"><span class="sm-num">66'</span></span>Depth in feet</li>
      ${legendIcons.map(i => `<li><span class="sm-sw" aria-hidden="true"><span class="sm-lm${i.bg ? " bg" : ""}">${iconHtml(i.icon)}</span></span>${esc(i.label)}</li>`).join("")}`;
    const places = geo.landmarks.filter(l => (l.icon && l.icon !== MOORING) || l.depth != null)
      .filter((l, i, a) => a.findIndex(o => o.landmark === l.landmark) === i)
      .sort((a, b) => S.name(a.landmark).localeCompare(S.name(b.landmark)));
    main.querySelector("#sm-list").innerHTML = places.map(l => `<li><button type="button" data-lm="${esc(l.landmark)}"><b>${esc(S.name(l.landmark))}</b>
      <span>${l.depth != null ? esc(l.depth + " ft deep") : "Depth not recorded"}</span></button></li>`).join("");
    main.querySelector("#sm-credit").textContent = `Surveyed by ${(d.surveyors || []).join(", ")}. Map program by Stephanie Yang. ${d.credit}, ${d.version}.
      Lengths and headings are as the divers measured them. Where two routes meet again, both are stretched and turned a little so they join up.`;
  }

  function toggle(layer, on) {
    if (!S.map || !layers[layer]) return;
    if (on) layers[layer].addTo(S.map); else layers[layer].remove();
  }
  function fit() {
    if (!S.map || !S.geo) return;
    const [[x0, y0], [x1, y1]] = S.geo.bounds;
    S.map.fitBounds([ll(x0, y0), ll(x1, y1)], { padding: [24, 24] });
  }
  function goTo(lm) {
    const m = markerFor[lm];
    if (!m || !S.map) return;
    S.map.getContainer().scrollIntoView({ behavior: "smooth", block: "center" });
    S.map.setView(m.getLatLng(), Math.max(S.map.getZoom(), 1));
    m.fire("click");
  }

  function landmarkPopup(f) {
    const d = S.shown, from = d.plan.filter(s => s.start === f.landmark).map(s => s.run2 ? `${S.runName(s.run)} and ${S.runName(s.run2)}` : S.runName(s.run));
    return `<b>${esc(S.name(f.landmark))}</b>${f.depth != null ? `<br>${esc(f.depth)} ft deep` : ""}
      <br><span class="dm-pop">On ${esc(S.runName(f.run))}</span>
      ${from.length ? `<br><span class="dm-pop">Lines from here: ${from.map(esc).join("; ")}</span>` : ""}`;
  }
  function segmentPopup(s) {
    const d = S.shown, e = d.runs[s.run][s.index], k = KIND[s.kind];
    const n = d.runs[s.run].slice(0, s.index + 1).filter(x => /Line$/.test(x.type)).length;
    const measured = lineFeet(e), stretch = Math.abs(s.lengthFt / measured - 1);
    return `<b>${esc(S.runName(s.run))}</b><br>${esc(k.label)} ${n}: ${esc(ftIn(e))} at ${esc(e.angle)}°
      ${e.note ? `<br><span class="dm-pop">Note: ${esc(e.note)}</span>` : ""}
      ${stretch > 0.005 ? `<br><span class="dm-pop">Drawn ${Math.round(stretch * 100)}% ${s.lengthFt > measured ? "longer" : "shorter"} so the route joins up</span>` : ""}`;
  }
  function pointPopup(f) {
    const e = S.shown.runs[f.run][f.index] || {};
    return `<b>${f.kind === "stake" ? "Stake" : "Tie-off"}</b><br><span class="dm-pop">On ${esc(S.runName(f.run))}</span>${e.note ? `<br><span class="dm-pop">Note: ${esc(e.note)}</span>` : ""}`;
  }

  // Tapping a feature: in the editor it's picked; otherwise its popup opens.
  function clickable(layer, feature, popup) {
    layer.on("click", ev => {
      if (ev.originalEvent) L.DomEvent.stopPropagation(ev);
      if (picker) { picker(feature); return; }
      L.popup().setLatLng(layer.getLatLng ? layer.getLatLng() : ev.latlng).setContent(popup()).openOn(S.map);
    });
    return layer;
  }

  function drawMap() {
    S.map = L.map(document.getElementById("sm-map"), { crs: L.CRS.Simple, minZoom: -3, maxZoom: 4, zoomSnap: 0.25, zoomDelta: 0.5, attributionControl: false, scrollWheelZoom: false });
    S.map.once("focus", () => S.map.scrollWheelZoom.enable());
    S.map.on("click", () => S.map.scrollWheelZoom.enable());
    S.canvas = L.canvas({ padding: 0.5, tolerance: 7 });
    north().addTo(S.map);
    scale().addTo(S.map);
  }

  // Draw data. With opts.base, entries not in base are drawn as new, and base lines not in data as gone.
  function show(d, opts) {
    opts = opts || {};
    const geo = G.compute(d), shapes = G.extras(geo.at), canvas = S.canvas;
    S.shown = d; S.geo = geo;
    const baseEntries = opts.base ? new Set(Object.values(opts.base.runs).flat()) : null;
    const shownEntries = opts.base ? new Set(Object.values(d.runs).flat()) : null;
    const isNew = f => baseEntries && !baseEntries.has(d.runs[f.run][f.index]);
    const visible = {};
    Object.keys(layers).forEach(k => { visible[k] = S.map.hasLayer(layers[k]); layers[k].remove(); });
    layers = {}; markerFor = {};

    layers.shapes = L.layerGroup(shapes.map(s => L.polygon(s.points.map(p => ll(p[0], p[1])),
      s.kind === "ramp" ? { renderer: canvas, stroke: false, fillColor: "#d9d6cf", fillOpacity: 1, interactive: false }
        : { renderer: canvas, color: "#1c2b33", weight: 1, fillColor: "#1c2b33", fillOpacity: 1 }).bindTooltip(esc(s.label))));

    const changed = [];
    const lines = geo.segments.map(s => {
      const k = KIND[s.kind], fresh = isNew(s);
      if (fresh) changed.push(ll(s.x0, s.y0), ll(s.x1, s.y1));
      const pl = L.polyline([ll(s.x0, s.y0), ll(s.x1, s.y1)], { renderer: canvas, color: fresh ? NEW : k.color, weight: fresh ? 3 : k.weight, dashArray: k.dashArray || null, lineCap: "butt" });
      return clickable(pl, Object.assign({}, s, { kind: "segment", lineKind: s.kind }), () => segmentPopup(s));
    });
    if (opts.base) {
      const gone = G.compute(opts.base).segments.filter(s => !shownEntries.has(opts.base.runs[s.run][s.index]) && opts.base.runs[s.run][s.index].type !== "RemovedLine");
      gone.forEach(s => changed.push(ll(s.x0, s.y0), ll(s.x1, s.y1)));
      gone.forEach(s => lines.unshift(L.polyline([ll(s.x0, s.y0), ll(s.x1, s.y1)], { renderer: canvas, color: GONE, weight: 3, dashArray: "6 5", interactive: false })));
    }
    layers.lines = L.layerGroup(lines);

    const stakeIcon = fresh => L.divIcon({ className: "sm-stake" + (fresh ? " new" : ""), iconSize: [7, 7] });
    const arrowIcon = h => L.divIcon({ className: "sm-arrow", iconSize: [10, 10], html: `<svg viewBox="0 0 12 12" style="transform:rotate(${h}deg)"><polygon points="6,1 11,11 1,11"/></svg>` });
    layers.points = L.layerGroup([
      ...geo.tieoffs.map(p => clickable(L.circleMarker(ll(p.x, p.y), { renderer: canvas, radius: 3, stroke: false, fillColor: isNew(p) ? NEW : "#1d4ed8", fillOpacity: 1 }),
        Object.assign({ kind: "tieoff" }, p), () => pointPopup(Object.assign({ kind: "tieoff" }, p)))),
      ...geo.stakes.filter(p => p.kind === "stake").map(p => clickable(L.marker(ll(p.x, p.y), { icon: stakeIcon(isNew(p)), keyboard: false }),
        Object.assign({ kind: "stake" }, p), () => pointPopup(Object.assign({ kind: "stake" }, p)))),
      ...geo.stakes.filter(p => p.kind !== "stake").map(p => L.marker(ll(p.x, p.y), { icon: L.divIcon({ className: "sm-stake removed", iconSize: [6, 6] }), interactive: false, keyboard: false })),
      ...geo.arrows.map(p => L.marker(ll(p.x, p.y), { icon: arrowIcon(p.heading), keyboard: false, interactive: false })),
    ]);

    layers.icons = L.layerGroup(); layers.moorings = L.layerGroup(); layers.depths = L.layerGroup();
    for (const l of geo.landmarks) {
      const f = Object.assign({ kind: "landmark" }, l), fresh = isNew(l);
      let m;
      if (l.icon === MOORING) {
        m = L.marker(ll(l.x, l.y), { icon: L.divIcon({ className: "sm-mooring", iconSize: [8, 8] }), title: S.name(l.landmark), alt: S.name(l.landmark) });
        layers.moorings.addLayer(clickable(m, f, () => landmarkPopup(f)));
      } else if (l.icon && ICONS[l.icon]) {
        m = L.marker(ll(l.x, l.y), { title: S.name(l.landmark), alt: S.name(l.landmark), riseOnHover: true,
          icon: L.divIcon({ className: "sm-lm" + (l.transparent ? "" : " bg") + (fresh ? " new" : ""), iconSize: [24, 24], html: iconHtml(l.icon) }) });
        layers.icons.addLayer(clickable(m, f, () => landmarkPopup(f)));
      } else {
        m = L.circleMarker(ll(l.x, l.y), { renderer: canvas, radius: 4.5, color: fresh ? NEW : "#0f7c8c", weight: 2, fillColor: "#ffffff", fillOpacity: 1 });
        layers.icons.addLayer(clickable(m.bindTooltip(esc(S.name(l.landmark))), f, () => landmarkPopup(f)));
      }
      markerFor[l.landmark] = m;
    }
    for (const dp of geo.depths) {
      const a = G.radians(dp.angle), r = 22 * dp.zoom, dx = r * Math.cos(a), dy = r * Math.sin(a);
      layers.depths.addLayer(L.marker(ll(dp.x, dp.y), { interactive: false, keyboard: false,
        icon: L.divIcon({ className: "sm-num", iconSize: [34, 16], iconAnchor: [17 - dx, 8 + dy], html: esc(dp.depth) + "'" }) }));
    }
    const defaults = { shapes: true, lines: true, points: true, icons: true, depths: true, moorings: false };
    for (const k of Object.keys(layers)) {
      const cb = main.querySelector(`[data-layer="${k}"]`);
      if (cb ? cb.checked : (k in visible ? visible[k] : defaults[k])) layers[k].addTo(S.map);
    }
    S.changed = changed;
    details(d, geo);
    const warn = main.querySelector("#sm-warn");
    warn.hidden = !geo.warnings.length; warn.innerHTML = geo.warnings.map(esc).join("<br>");
    if (firstDraw) { firstDraw = false; fit(); }
    if (ring) ring.bringToFront && ring.bringToFront();
    return geo;
  }

  function focusChanges() {
    if (S.changed && S.changed.length) S.map.fitBounds(L.latLngBounds(S.changed), { padding: [60, 60], maxZoom: 1.5 });
  }
  function reset() { select(null); return show(S.data); }
  function setPicker(fn) { picker = fn || null; S.map.closePopup(); main.querySelector("#sm-map").classList.toggle("picking", !!picker); }
  function select(f) {
    if (ring) { ring.remove(); ring = null; }
    if (!f) return;
    const x = f.kind === "segment" ? f.x1 : f.x, y = f.kind === "segment" ? f.y1 : f.y;
    ring = L.layerGroup([
      f.kind === "segment" ? L.polyline([ll(f.x0, f.y0), ll(f.x1, f.y1)], { color: NEW, weight: 6, opacity: .45, interactive: false }) : null,
      L.circleMarker(ll(x, y), { radius: 10, color: NEW, weight: 3, fill: false, interactive: false }),
    ].filter(Boolean)).addTo(S.map);
  }
  function setPublished(d, version, updatedAt) {
    S.data = d; S.version = version || 0; S.updatedAt = updatedAt || null;
    published.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
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

  // The published version from the database, if an Admin has published one; otherwise the data file stays.
  async function loadPublished() {
    const C = window.LDCloud;
    if (!C || !C.available) return;
    const { data, error } = await C.client.from("site_maps").select("data, version, updated_at").eq("id", site).maybeSingle();
    if (error || !data) return;
    setPublished(data.data, data.version, data.updated_at);
    if (!S.editing) show(S.data);
  }

  page();
  if (L) { drawMap(); show(S.data); loadPublished().catch(e => console.warn("Published map not loaded:", e)); }
})();
