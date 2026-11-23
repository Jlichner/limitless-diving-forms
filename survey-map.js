/* Limitless Diving — a dive site survey map in Site maps (e.g. bonnie-castle-map.html).
   The page's <main id="surveymap" data-site="..."> names the site. Its data file (e.g. bonnie-castle-data.js)
   has the title and credits in window.SITE_MAPS; the survey itself is in the database (site_maps).
   Site maps are only for logged-in members with a Site maps access level (site_map_members, set in Records →
   Student accounts); the page shows a log in or "no access yet" card to everyone else, and the database
   enforces it. Each level sees its own rated lines and every level below (S.LEVELS). survey-geometry.js does the math and survey-icons.js
   has the landmark icons. The map is in feet, magnetic north up, on a plain Leaflet map (no world tiles), until an
   Admin places it on the earth (data.georef, see SurveyGeometry.georef): then it's drawn on real coordinates,
   turned to true north, over satellite pictures. Layers (survey-layers.js) add more survey lines and pictures
   on top, each in its own Leaflet pane so it can be faded with a slider.

   window.SurveyMap is what the editor (survey-editor.js) uses:
     S.data, S.version     the published survey and its version (0 = not yet published, from the data file)
     S.show(data, opts)    draw other data, e.g. a preview: opts.base marks what's new (orange) and gone (red)
     S.reset()             draw the published survey again
     S.focusChanges()      zoom to what the last preview changed
     S.setPicker(fn)       while set, tapping a stake, tie-off, landmark or line calls fn(feature)
     S.select(feature)     ring the selected feature
     S.onPublished(fn)     called when the published survey changes
     S.setLayers(list)     extra layers: { id, name, kind: "survey" | "image", survey, imageUrl, bounds, ... }
     S.setLayerView(id, { visible, opacity })   show, hide or fade a layer ("survey" = the main lines, "satellite")
     S.popupHooks          functions (feature, element) called when a landmark's popup opens (photos)
     S.ready               a promise that resolves once the member's access is checked and the map is drawn
     S.level, S.rank       the member's Site maps access ("green" … "site-admin", "admin") and its rank (1-6)
     S.canEdit()           survey team and up: may suggest changes;  S.isSiteAdmin(): Admins and Dive site admins */
(function () {
  "use strict";

  const main = document.getElementById("surveymap");
  const site = main.dataset.site, G = window.SurveyGeometry, ICONS = window.SURVEY_ICONS || {}, L = window.L;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  let GEO = null;   // set when the map is placed on the earth
  const ll = (x, y) => GEO ? GEO.toLatLng(x, y) : [y, x];
  const KIND = {
    surveyed: { label: "Surveyed line", color: "#1c2b33", weight: 1.6 },
    unsurveyed: { label: "Unsurveyed line", color: "#1c2b33", weight: 1.4, dashArray: "5 5" },
    removed: { label: "Removed line", color: "#b4bcc0", weight: 1.6 },
    marina: { label: "Caution: boat traffic overhead", color: "#d7263d", weight: 2.4 },
  };
  const NEW = "#e8590c", GONE = "#d7263d";
  // Ski-style difficulty. Green lines are on the main survey; the others are in a layer of their own (survey-layers.js).
  const RATINGS = [
    { id: "green", name: "Green circle", level: "Novice", divers: "Open water divers", color: "#2b8a3e", line: null },
    { id: "blue", name: "Blue square", level: "Intermediate", divers: "Advanced divers", color: "#1c7ed6", line: "#1c7ed6" },
    { id: "black", name: "Black diamond", level: "Advanced", divers: "Tech divers", color: "#111111", line: "#111111" },
    { id: "double-black", name: "Double black diamond", level: "Expert", divers: "Tech divers on scooters", color: "#111111", line: "#111111" },
  ];
  // Site maps access levels (site_map_members in supabase/schema.sql), lowest first. Same list in student-accounts.js.
  const LEVELS = [
    { id: "none", label: "No access" },
    { id: "green", label: "Green circle: open water divers" },
    { id: "blue", label: "Blue square: advanced divers" },
    { id: "black", label: "Black diamond: tech divers" },
    { id: "double-black", label: "Double black diamond: tech on scooters" },
    { id: "survey", label: "Survey team: sees everything, suggests changes" },
    { id: "site-admin", label: "Dive site admin: runs the site maps" },
  ];
  function ratingSvg(id, size) {
    const z = size || 14;
    if (id === "green") return `<svg viewBox="0 0 16 16" width="${z}" height="${z}" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="#2b8a3e" stroke="#fff" stroke-width="1.5"/></svg>`;
    if (id === "blue") return `<svg viewBox="0 0 16 16" width="${z}" height="${z}" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" fill="#1c7ed6" stroke="#fff" stroke-width="1.5"/></svg>`;
    const d = x => `<path d="M${x} 1 L${x + 7} 8 L${x} 15 L${x - 7} 8 Z" fill="#111" stroke="#fff" stroke-width="1.5"/>`;
    if (id === "black") return `<svg viewBox="0 0 16 16" width="${z}" height="${z}" aria-hidden="true">${d(8)}</svg>`;
    return `<svg viewBox="0 0 30 16" width="${Math.round(z * 30 / 16)}" height="${z}" aria-hidden="true">${d(8)}${d(22)}</svg>`;
  }
  const MOORING = "icons/mooringblock.png";
  const LEGEND_NAMES = { "icons/shipwreck.png": "Shipwreck" }; // icons used by more than one landmark

  const S = window.SurveyMap = {
    site, data: (window.SITE_MAPS || {})[site], version: 0, updatedAt: null, map: null, esc,
    show, reset, setPicker, select, focusChanges, onPublished: fn => published.push(fn), setPublished,
    layers: [], view: {}, setLayers, setLayerView, popupHooks: [], ll, geoRef: () => GEO, toXY: (lat, lng) => GEO ? GEO.toXY(lat, lng) : [lng, lat],
    runLayer: {}, RATINGS, ratingSvg, LEVELS, adminListeners: [], level: null, rank: 0,
    levelName: id => id === "admin" ? "Admin (everything)" : (LEVELS.find(l => l.id === id) || LEVELS[0]).label,
    isSiteAdmin: () => S.rank >= 6, canEdit: () => S.rank >= 5,
    ratingOf: run => { const id = S.runLayer[run], l = id && S.layers.find(x => x.id === id); return (l && l.rating) || (id ? null : "green"); },
    name: lm => (S.shown && S.shown.landmarks && S.shown.landmarks[lm]) || (S.data.landmarks && S.data.landmarks[lm]) || lm,
    runName: r => (S.shown && S.shown.runNames && S.shown.runNames[r]) || (S.data.runNames && S.data.runNames[r]) || r,
  };
  let started;
  S.ready = new Promise(res => { started = res; });
  if (!S.data) { main.innerHTML = `<div class="msg">This site map couldn't be loaded. Refresh the page to try again.</div>`; return; }
  const published = [];
  let picker = null, layers = {}, markerFor = {}, ring = null, firstDraw = true, canvases = {}, images = {}, sat = null, geoKey = "";
  const SAT_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

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
      <section class="pub-hero dm-hero"><span class="eyebrow">Site map${S.data.place ? " · " + esc(S.data.place) : ""}</span>
        <h1>${esc(S.data.title)}</h1><p>${esc(S.data.subtitle)}.</p></section>
      <p class="sm-test" role="note" id="sm-note"></p>
      <div class="dm-stats" id="sm-stats"></div>
      <div class="panel dm-panel">
        <div class="sm-tools" role="group" aria-label="Show on the map">
          <label><input type="checkbox" data-layer="depths" checked> Depths</label>
          <label><input type="checkbox" data-layer="points" checked> Stakes, tie-offs and arrows</label>
          <label><input type="checkbox" data-layer="icons" checked> Landmark icons</label>
          <label><input type="checkbox" data-layer="moorings"> Mooring blocks</label>
          <label><input type="checkbox" data-layer="ratings" checked> Difficulty symbols</label>
          <span class="sm-tools-end"><button type="button" class="btn" id="sm-kml" hidden>Google Earth file</button>
          <button type="button" class="btn" id="sm-fit">Show the whole site</button>
          <button type="button" class="btn primary" id="sm-edit-btn" hidden>Edit map</button></span></div>
        <div class="sm-work" id="sm-work">
          <div class="dm-map sm-map" id="sm-map" aria-label="Survey map of ${esc(S.data.title)}"></div>
          <aside class="sm-edit" id="sm-edit" hidden aria-label="Map editor"></aside></div>
        ${L ? "" : `<p class="acct-note bad">The map couldn't be loaded. Check your connection and refresh the page.</p>`}
        <p class="hint dm-state" role="status" id="sm-warn" hidden></p></div>
      <section class="panel" aria-labelledby="sm-layers-h" id="sm-layers-panel"><h2 id="sm-layers-h" class="sec">Layers</h2><div id="sm-layers"></div></section>
      <div id="sm-setup"></div>
      <section class="panel" aria-labelledby="sm-key-h"><h2 id="sm-key-h" class="sec">Map key</h2><ul class="sm-key" id="sm-key"></ul></section>
      <section class="panel dm-list-panel" aria-labelledby="sm-list-h"><h2 id="sm-list-h" class="sec">Landmarks</h2><ul class="dm-list" id="sm-list"></ul></section>
      <p class="nx-note" id="sm-credit"></p>`;
    main.querySelectorAll("[data-layer]").forEach(cb => cb.addEventListener("change", () => toggle(cb.dataset.layer, cb.checked)));
    main.querySelector("#sm-fit").addEventListener("click", fit);
    main.querySelector("#sm-kml").addEventListener("click", downloadKml);
    main.querySelector("#sm-list").addEventListener("click", e => { const b = e.target.closest("[data-lm]"); if (b) goTo(b.dataset.lm); });
  }

  // The parts of the page that follow the data: note, stats, key, landmark list, credit.
  function details(d, geo) {
    const when = S.updatedAt ? new Date(S.updatedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : null;
    const started = geo.segments.length > 0;
    main.querySelector("#sm-note").innerHTML = !started
      ? `<b>Help us map this site.</b> No lines have been surveyed here yet. Every line is measured from the ${esc(S.name(d.origin || "BAR"))}.
         ${S.canEdit() ? `Tap <b>Edit map</b> to add the first line you surveyed: its length, compass heading, and what's at its end.` : "Our survey team adds the lines as they map it."}`
      : S.version
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
      ${RATINGS.map(r => `<li><span class="sm-sw" aria-hidden="true">${ratingSvg(r.id)}</span>${esc(r.name)}: ${esc(r.level.toLowerCase())}</li>`).join("")}
      ${legendIcons.map(i => `<li><span class="sm-sw" aria-hidden="true"><span class="sm-lm${i.bg ? " bg" : ""}">${iconHtml(i.icon)}</span></span>${esc(i.label)}</li>`).join("")}`;
    const places = geo.landmarks.filter(l => (l.icon && l.icon !== MOORING) || l.depth != null || l.origin)
      .filter((l, i, a) => a.findIndex(o => o.landmark === l.landmark) === i)
      .sort((a, b) => S.name(a.landmark).localeCompare(S.name(b.landmark)));
    main.querySelector("#sm-list").innerHTML = places.map(l => `<li><button type="button" data-lm="${esc(l.landmark)}"><b>${esc(S.name(l.landmark))}</b>
      <span>${l.depth != null ? esc(l.depth + " ft deep") : "Depth not recorded"}</span></button></li>`).join("");
    // The site's data file can give the whole credit line (creditText); it wins over the survey's own credits.
    const meta = (window.SITE_MAPS || {})[site] || {};
    const by = (d.surveyors || []).length ? `Surveyed by ${d.surveyors.join(", ")}. ` : "";
    main.querySelector("#sm-credit").textContent = meta.creditText || `${by}${[d.credit, d.version].filter(Boolean).join(", ")}.
      Lengths and headings are as the divers measured them. Where two routes meet again, both are stretched and turned a little so they join up.`;
  }

  function toggle(layer, on) {
    if (!S.map || !layers[layer]) return;
    if (on) layers[layer].addTo(S.map); else layers[layer].remove();
  }
  function fit() {
    if (!S.map || !S.geo) return;
    let [[x0, y0], [x1, y1]] = S.geo.bounds;
    const grow = (lo, hi) => { const m = Math.max(0, (150 - (hi - lo)) / 2); return [lo - m, hi + m]; }; // at least 150 ft across
    [x0, x1] = grow(x0, x1); [y0, y1] = grow(y0, y1);
    S.map.fitBounds(L.latLngBounds([ll(x0, y0), ll(x1, y1), ll(x0, y1), ll(x1, y0)]), { padding: [24, 24] });
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
    const lay = f.run && S.runLayer[f.run] && S.layers.find(l => l.id === S.runLayer[f.run]);
    return `<b>${esc(S.name(f.landmark))}</b>${f.depth != null ? `<br>${esc(f.depth)} ft deep` : ""}
      ${lay ? `<br><span class="dm-pop">Layer: ${esc(lay.name)}</span>` : ""}
      ${f.run ? `<br><span class="dm-pop">On ${esc(S.runName(f.run))}</span>` : f.origin ? `<br><span class="dm-pop">The starting point: every line is measured from here</span>` : ""}
      ${from.length ? `<br><span class="dm-pop">Lines from here: ${from.map(esc).join("; ")}</span>` : ""}
      <div class="sm-photos" data-photos="${esc(f.landmark)}"></div>`;
  }
  function segmentPopup(s) {
    const d = S.shown, e = d.runs[s.run][s.index], k = KIND[s.kind];
    const n = d.runs[s.run].slice(0, s.index + 1).filter(x => /Line$/.test(x.type)).length;
    const measured = lineFeet(e), stretch = Math.abs(s.lengthFt / measured - 1);
    const lay = S.runLayer[s.run] && S.layers.find(l => l.id === S.runLayer[s.run]);
    const rid = S.ratingOf(s.run), r = rid && RATINGS.find(x => x.id === rid);
    return `<b>${esc(S.runName(s.run))}</b>${lay && !lay.rating ? ` <span class="dm-pop">(${esc(lay.name)})</span>` : ""}
      ${r ? `<br><span class="sm-pop-rating">${ratingSvg(rid, 12)} ${esc(r.name)} · ${esc(r.level)}</span>` : ""}<br>${esc(k.label)} ${n}: ${esc(ftIn(e))} at ${esc(e.angle)}°
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
      // The content is a node, not a string, so a hook can fill it in (photos) and pop.update() keeps that.
      const box = document.createElement("div");
      box.innerHTML = popup();
      const pop = L.popup({ maxWidth: 320 }).setLatLng(layer.getLatLng ? layer.getLatLng() : ev.latlng).setContent(box).openOn(S.map);
      if (feature.kind === "landmark") S.popupHooks.forEach(fn => { try { fn(feature, box, pop); } catch (e) { console.error(e); } });
    });
    return layer;
  }

  function drawMap() {
    const el = document.getElementById("sm-map");
    S.map = GEO
      ? L.map(el, { minZoom: 12, maxZoom: 23, zoomSnap: 0.25, zoomDelta: 0.5, scrollWheelZoom: false })
      : L.map(el, { crs: L.CRS.Simple, minZoom: -3, maxZoom: 4, zoomSnap: 0.25, zoomDelta: 0.5, attributionControl: false, scrollWheelZoom: false });
    S.map.once("focus", () => S.map.scrollWheelZoom.enable());
    S.map.on("click", () => S.map.scrollWheelZoom.enable());
    canvases = {}; images = {}; layers = {}; markerFor = {}; ring = null;
    S.map.createPane("sm-p-base").style.zIndex = 410;
    sat = null;
    if (GEO) {
      sat = L.tileLayer(SAT_URL, { maxNativeZoom: 19, maxZoom: 23, attribution: "Satellite: Esri, Maxar, Earthstar Geographics" }).addTo(S.map);
      L.control.scale({ position: "bottomleft", maxWidth: 130 }).addTo(S.map);
    } else {
      scale().addTo(S.map);
    }
    S.canvas = canvasFor("sm-p-base");
    north().addTo(S.map);
    main.querySelector("#sm-kml").hidden = !GEO;
    applyViews();
  }
  // Each layer's lines are drawn on their own canvas, stacked by pane. A canvas covers the whole map, so the top one
  // gets every tap: when nothing of its own is under the finger it hands the tap (and the hover) to the next visible
  // canvas below, so lines and stakes on lower layers can still be picked.
  const hitAt = (r, e) => {
    const p = r._map.mouseEventToLayerPoint(e);
    for (let o = r._drawFirst; o; o = o.next) if (o.layer.options.interactive && o.layer._containsPoint(p)) return true;
    return false;
  };
  const LayeredCanvas = L.Canvas.extend({
    _below() {
      const z = el => Number(el && el.style.zIndex) || 0, mine = z(S.map && S.map.getPane(this.options.pane));
      let best = null, bz = -Infinity;
      for (const [name, r] of Object.entries(canvases)) {
        if (r === this || !r._map || !r._container) continue;
        const el = S.map.getPane(name), zz = z(el);
        if (!el || el.style.display === "none" || zz >= mine || zz <= bz) continue;
        best = r; bz = zz;
      }
      return best;
    },
    _onClick(e) {
      const below = !hitAt(this, e) && this._below();
      return below ? below._onClick(e) : L.Canvas.prototype._onClick.call(this, e);
    },
    _onMouseMove(e) {
      L.Canvas.prototype._onMouseMove.call(this, e);
      if (!this._map || this._hoveredLayer) return;
      const below = this._below();
      if (!below) return;
      below._onMouseMove(e);
      this._container.classList.toggle("leaflet-interactive", below._container.classList.contains("leaflet-interactive"));
    },
  });
  function canvasFor(pane) {
    if (!canvases[pane]) canvases[pane] = new LayeredCanvas({ pane, padding: 0.5, tolerance: 7 });
    return canvases[pane];
  }
  function paneFor(layerId) {
    if (!layerId) return "sm-p-base";
    const name = "sm-p-" + layerId;
    if (!S.map.getPane(name)) {
      const i = S.layers.findIndex(l => l.id === layerId);
      S.map.createPane(name).style.zIndex = 420 + Math.max(0, i);
    }
    return name;
  }

  // Place the map on the earth, or take it off, when the published georef changes.
  function placeOnEarth(d) {
    const gr = d && d.georef, key = JSON.stringify(gr || null);
    if (key === geoKey && S.map) return false;
    geoKey = key;
    const g = gr ? G.georef(gr, G.compute(d).at) : null;
    const changed = !!g !== !!GEO || !!g;
    GEO = g;
    if (S.map && changed) { S.map.remove(); S.map = null; }
    if (!S.map) { drawMap(); firstDraw = true; }
    return true;
  }

  // ----- layers -----
  function setLayers(list) {
    S.layers = (list || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
    for (const l of S.layers) if (!S.view[l.id]) S.view[l.id] = { visible: l.kind !== "image" && !l.hiddenAtStart, opacity: l.opacity == null ? 1 : Number(l.opacity) };
    show(S.shown && S.editing ? S.shown : S.data, S.lastOpts || {});
    drawImages();
  }
  function setLayerView(id, v) {
    S.view[id] = Object.assign({ visible: true, opacity: 1 }, S.view[id], v);
    applyViews();
  }
  function applyViews() {
    if (!S.map) return;
    const v = id => S.view[id] || { visible: true, opacity: 1 };
    const base = S.map.getPane("sm-p-base");
    if (base) { base.style.opacity = v("survey").opacity; base.style.display = v("survey").visible ? "" : "none"; }
    if (sat) { sat.setOpacity(v("satellite").visible ? v("satellite").opacity : 0); }
    for (const l of S.layers) {
      const pane = S.map.getPane("sm-p-" + l.id);
      if (pane) { pane.style.opacity = v(l.id).opacity; pane.style.display = v(l.id).visible ? "" : "none"; }
      if (images[l.id]) images[l.id].setOpacity(v(l.id).visible ? v(l.id).opacity : 0);
    }
  }
  // Picture layers. bounds is { corners: [top-left, top-right, bottom-left] as [lat, lng], geo } (the picture can be
  // turned; geo says whether the corners are real degrees, i.e. the map was placed on the earth, or feet on the plain
  // survey map), or from the first version, north-up: { north, south, east, west } or { x0, y0, x1, y1 } in feet.
  function imageCorners(b) {
    if (!b) return null;
    if (Array.isArray(b.corners) && b.corners.length === 3) return !!b.geo === !!GEO ? b.corners.map(c => L.latLng(c[0], c[1])) : null;
    if (b.north != null) return GEO ? [L.latLng(b.north, b.west), L.latLng(b.north, b.east), L.latLng(b.south, b.west)] : null;
    if (b.x0 != null) return [ll(b.x0, b.y1), ll(b.x1, b.y1), ll(b.x0, b.y0)].map(c => L.latLng(c[0], c[1]));
    return null;
  }
  // An image drawn between three corners, so it can be turned and stretched (Leaflet's own overlay stays north-up).
  const TurnedImage = L ? L.Layer.extend({
    initialize(url, corners, opts) { this._url = url; this._corners = corners; L.setOptions(this, opts); },
    onAdd(map) {
      const img = this._img = L.DomUtil.create("img", "leaflet-image-layer leaflet-zoom-hide sm-turned-img");
      img.alt = ""; img.style.transformOrigin = "0 0"; img.style.left = "0"; img.style.top = "0";
      if (!this.options.interactive) img.style.pointerEvents = "none"; else L.DomUtil.addClass(img, "leaflet-interactive");
      img.onload = () => this._reset();
      img.src = this._url;
      this.getPane().appendChild(img);
      map.on("zoomend viewreset", this._reset, this);
      this._reset();
    },
    onRemove(map) { L.DomUtil.remove(this._img); this._img = null; map.off("zoomend viewreset", this._reset, this); },
    setCorners(c) { this._corners = c; this._reset(); return this; },
    getCorners() { return this._corners; },
    getBounds() { return L.latLngBounds(this._corners.concat([L.latLng(this._corners[1].lat + this._corners[2].lat - this._corners[0].lat, this._corners[1].lng + this._corners[2].lng - this._corners[0].lng)])); },
    setOpacity(o) { this.options.opacity = o; if (this._img) this._img.style.opacity = o; return this; },
    naturalSize() { return this._img && this._img.naturalWidth ? [this._img.naturalWidth, this._img.naturalHeight] : null; },
    _reset() {
      const img = this._img, m = this._map;
      if (!img || !m || !img.naturalWidth) return;
      const [a, b, c] = this._corners.map(p => m.latLngToLayerPoint(p)), w = img.naturalWidth, h = img.naturalHeight;
      img.style.width = w + "px"; img.style.height = h + "px";
      img.style.transform = `matrix(${(b.x - a.x) / w},${(b.y - a.y) / w},${(c.x - a.x) / h},${(c.y - a.y) / h},${a.x},${a.y})`;
      img.style.opacity = this.options.opacity == null ? 1 : this.options.opacity;
    },
  }) : null;
  function drawImages() {
    if (!S.map) return;
    Object.values(images).forEach(o => o.remove()); images = {};
    for (const l of S.layers) {
      if (l.kind !== "image" || !l.imageUrl) continue;
      const cs = imageCorners(l.bounds);
      if (!cs) continue;
      const pane = "sm-i-" + l.id;
      if (!S.map.getPane(pane)) S.map.createPane(pane).style.zIndex = 300 + S.layers.indexOf(l);
      images[l.id] = new TurnedImage(l.imageUrl, cs, { pane, interactive: !!l.interactive }).addTo(S.map);
      if (l.onImage) l.onImage(images[l.id]);
    }
    applyViews();
  }
  S.imageCorners = imageCorners;
  S.imageOverlay = id => images[id];
  S.redrawImages = drawImages;

  // The published survey with every survey layer this person may see added on.
  function combine(d) {
    const extra = S.layers.filter(l => l.kind === "survey" && l.survey && l.survey.runs);
    const runLayer = {};
    if (!extra.length) return { data: d, runLayer };
    const out = Object.assign({}, d, { runs: Object.assign({}, d.runs), plan: d.plan.slice(), landmarks: Object.assign({}, d.landmarks), runNames: Object.assign({}, d.runNames) });
    for (const l of extra) {
      for (const [k, v] of Object.entries(l.survey.runs)) { if (out.runs[k]) continue; out.runs[k] = v; runLayer[k] = l.id; }
      Object.assign(out.landmarks, l.survey.landmarks || {}); Object.assign(out.runNames, l.survey.runNames || {});
      for (const st of l.survey.plan || []) if (runLayer[st.run] === l.id) out.plan.push(st);
    }
    return { data: out, runLayer };
  }

  // ----- Google Earth -----
  function downloadKml() {
    if (!GEO || !S.geo) return;
    const d = S.shown, geo = S.geo, x = s => esc(s);
    const pt = (px, py) => { const [la, lo] = ll(px, py); return `${lo.toFixed(7)},${la.toFixed(7)},0`; };
    const byRun = {};
    for (const s of geo.segments) {
      if (s.kind === "removed") continue;
      const k = s.run + "|" + s.kind;
      (byRun[k] = byRun[k] || []).push(s);
    }
    const lines = Object.entries(byRun).map(([k, segs]) => {
      const [run, kind] = k.split("|"), parts = [];
      let cur = null;
      for (const s of segs) {
        if (!cur || Math.abs(cur.x - s.x0) > 1e-6 || Math.abs(cur.y - s.y0) > 1e-6) { parts.push([pt(s.x0, s.y0)]); }
        parts[parts.length - 1].push(pt(s.x1, s.y1)); cur = { x: s.x1, y: s.y1 };
      }
      const lay = S.runLayer[run] && S.layers.find(l => l.id === S.runLayer[run]);
      return `<Placemark><name>${x(S.runName(run))}${lay ? " (" + x(lay.name) + ")" : ""}</name><styleUrl>#${kind === "unsurveyed" ? "unsurveyed" : kind === "marina" ? "marina" : "line"}</styleUrl>
<MultiGeometry>${parts.map(p => `<LineString><tessellate>1</tessellate><coordinates>${p.join(" ")}</coordinates></LineString>`).join("")}</MultiGeometry></Placemark>`;
    }).join("\n");
    const seen = new Set();
    const marks = geo.landmarks.filter(l => !seen.has(l.landmark) && seen.add(l.landmark)).map(l =>
      `<Placemark><name>${x(S.name(l.landmark))}</name>${l.depth != null ? `<description>${x(l.depth)} ft deep</description>` : ""}<styleUrl>#landmark</styleUrl><Point><coordinates>${pt(l.x, l.y)}</coordinates></Point></Placemark>`).join("\n");
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${x(d.title)} survey</name>
<description>${x(((window.SITE_MAPS || {})[site] || {}).credit || d.credit || "")}. Lengths and headings as the divers measured them; placed from ${x(S.name(d.georef.landmark))}.</description>
<Style id="line"><LineStyle><color>ff33ffff</color><width>2</width></LineStyle></Style>
<Style id="unsurveyed"><LineStyle><color>ff33ffff</color><width>1</width></LineStyle></Style>
<Style id="marina"><LineStyle><color>ff3d26d7</color><width>3</width></LineStyle></Style>
<Style id="landmark"><IconStyle><scale>0.8</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle></Style>
<Folder><name>Lines</name>
${lines}
</Folder><Folder><name>Landmarks</name>
${marks}
</Folder></Document></kml>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([kml], { type: "application/vnd.google-earth.kml+xml" }));
    a.download = `${site}-survey.kml`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // Draw data. With opts.base, entries not in base are drawn as new, and base lines not in data as gone.
  function show(d0, opts) {
    opts = opts || {};
    S.lastOpts = opts;
    const { data: d, runLayer } = combine(d0);
    const geo = G.compute(d), shapes = G.extras(geo.at), canvas = S.canvas;
    S.shown = d; S.geo = geo; S.runLayer = runLayer;
    const paneOf = f => paneFor(f.run && runLayer[f.run]);
    const cv = f => canvasFor(paneOf(f));
    const baseEntries = opts.base ? new Set(Object.values(opts.base.runs).flat()) : null;
    const shownEntries = opts.base ? new Set(Object.values(d0.runs).flat()) : null;
    const isNew = f => baseEntries && f.run && !runLayer[f.run] && !baseEntries.has(d.runs[f.run][f.index]);
    const visible = {};
    Object.keys(layers).forEach(k => { visible[k] = S.map.hasLayer(layers[k]); layers[k].remove(); });
    layers = {}; markerFor = {};

    layers.shapes = L.layerGroup(shapes.map(s => L.polygon(s.points.map(p => ll(p[0], p[1])),
      s.kind === "ramp" ? { renderer: canvas, pane: "sm-p-base", stroke: false, fillColor: "#d9d6cf", fillOpacity: 1, interactive: false }
        : { renderer: canvas, pane: "sm-p-base", color: "#1c2b33", weight: 1, fillColor: "#1c2b33", fillOpacity: 1 }).bindTooltip(esc(s.label))));

    const changed = [];
    const lines = geo.segments.map(s => {
      const k = KIND[s.kind], fresh = isNew(s), rl = runLayer[s.run] && S.layers.find(x => x.id === runLayer[s.run]);
      const rc = rl && rl.rating && s.kind !== "removed" ? RATINGS.find(r => r.id === rl.rating).line : null;
      if (fresh) changed.push(ll(s.x0, s.y0), ll(s.x1, s.y1));
      const pl = L.polyline([ll(s.x0, s.y0), ll(s.x1, s.y1)], { renderer: cv(s), pane: paneOf(s), color: fresh ? NEW : rc || (GEO && (s.kind === "surveyed" || s.kind === "unsurveyed") ? "#ffe066" : k.color), weight: fresh ? 3 : k.weight + (GEO || rc ? 0.6 : 0), dashArray: k.dashArray || null, lineCap: "butt" });
      return clickable(pl, Object.assign({}, s, { kind: "segment", lineKind: s.kind, layer: runLayer[s.run] || null }), () => segmentPopup(s));
    });
    if (opts.base) {
      const gone = G.compute(opts.base).segments.filter(s => !shownEntries.has(opts.base.runs[s.run][s.index]) && opts.base.runs[s.run][s.index].type !== "RemovedLine");
      gone.forEach(s => changed.push(ll(s.x0, s.y0), ll(s.x1, s.y1)));
      gone.forEach(s => lines.unshift(L.polyline([ll(s.x0, s.y0), ll(s.x1, s.y1)], { renderer: canvas, pane: "sm-p-base", color: GONE, weight: 3, dashArray: "6 5", interactive: false })));
    }
    layers.lines = L.layerGroup(lines);

    const stakeIcon = fresh => L.divIcon({ className: "sm-stake" + (fresh ? " new" : ""), iconSize: [7, 7] });
    const arrowIcon = h => L.divIcon({ className: "sm-arrow", iconSize: [10, 10], html: `<svg viewBox="0 0 12 12" style="transform:rotate(${h}deg)"><polygon points="6,1 11,11 1,11"/></svg>` });
    layers.points = L.layerGroup([
      ...geo.tieoffs.map(p => clickable(L.circleMarker(ll(p.x, p.y), { renderer: cv(p), pane: paneOf(p), radius: 3, stroke: false, fillColor: isNew(p) ? NEW : "#e64980", fillOpacity: 1 }),
        Object.assign({ kind: "tieoff", layer: runLayer[p.run] || null }, p), () => pointPopup(Object.assign({ kind: "tieoff" }, p)))),
      ...geo.stakes.filter(p => p.kind === "stake").map(p => clickable(L.marker(ll(p.x, p.y), { pane: paneOf(p), icon: stakeIcon(isNew(p)), keyboard: false }),
        Object.assign({ kind: "stake", layer: runLayer[p.run] || null }, p), () => pointPopup(Object.assign({ kind: "stake" }, p)))),
      ...geo.stakes.filter(p => p.kind !== "stake").map(p => L.marker(ll(p.x, p.y), { pane: paneOf(p), icon: L.divIcon({ className: "sm-stake removed", iconSize: [6, 6] }), interactive: false, keyboard: false })),
      ...geo.arrows.map(p => L.marker(ll(p.x, p.y), { pane: paneOf(p), icon: arrowIcon(p.heading + (GEO ? GEO.turn : 0)), keyboard: false, interactive: false })),
    ]);

    layers.icons = L.layerGroup(); layers.moorings = L.layerGroup(); layers.depths = L.layerGroup();
    for (const l of geo.landmarks) {
      const f = Object.assign({ kind: "landmark", layer: (l.run && runLayer[l.run]) || null }, l), fresh = isNew(l), pane = paneOf(l);
      let m;
      if (l.icon === MOORING) {
        m = L.marker(ll(l.x, l.y), { pane, icon: L.divIcon({ className: "sm-mooring", iconSize: [8, 8] }), title: S.name(l.landmark), alt: S.name(l.landmark) });
        layers.moorings.addLayer(clickable(m, f, () => landmarkPopup(f)));
      } else if (l.icon && ICONS[l.icon]) {
        m = L.marker(ll(l.x, l.y), { pane, title: S.name(l.landmark), alt: S.name(l.landmark), riseOnHover: true,
          icon: L.divIcon({ className: "sm-lm" + (l.transparent ? "" : " bg") + (fresh ? " new" : ""), iconSize: [24, 24], html: iconHtml(l.icon) }) });
        layers.icons.addLayer(clickable(m, f, () => landmarkPopup(f)));
      } else {
        m = L.circleMarker(ll(l.x, l.y), { renderer: cv(l), pane, radius: 4.5, color: fresh ? NEW : "#0f7c8c", weight: 2, fillColor: "#ffffff", fillOpacity: 1 });
        layers.icons.addLayer(clickable(m.bindTooltip(esc(S.name(l.landmark)), l.origin && !geo.segments.length ? { permanent: true, direction: "right", offset: [8, 0] } : {}), f, () => landmarkPopup(f)));
      }
      markerFor[l.landmark] = m;
    }
    for (const dp of geo.depths) {
      const a = G.radians(dp.angle), r = 22 * dp.zoom, dx = r * Math.cos(a), dy = r * Math.sin(a);
      layers.depths.addLayer(L.marker(ll(dp.x, dp.y), { pane: paneOf(dp), interactive: false, keyboard: false,
        icon: L.divIcon({ className: "sm-num", iconSize: [34, 16], iconAnchor: [17 - dx, 8 + dy], html: esc(dp.depth) + "'" }) }));
    }
    // A difficulty symbol halfway along the first line of each run.
    layers.ratings = L.layerGroup();
    const firstSeg = {};
    for (const s of geo.segments) if (s.kind !== "removed" && !firstSeg[s.run]) firstSeg[s.run] = s;
    for (const [run, s] of Object.entries(firstSeg)) {
      const rid = runLayer[run] ? (S.layers.find(x => x.id === runLayer[run]) || {}).rating : "green";
      if (!rid) continue;
      const r = RATINGS.find(x => x.id === rid);
      layers.ratings.addLayer(L.marker(ll((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2), { pane: paneOf(s), keyboard: false, interactive: false,
        icon: L.divIcon({ className: "sm-rating", iconSize: rid === "double-black" ? [26, 14] : [14, 14], html: ratingSvg(rid) }) }));
    }
    const defaults = { shapes: true, lines: true, points: true, icons: true, depths: true, moorings: false, ratings: true };
    for (const k of Object.keys(layers)) {
      const cb = main.querySelector(`[data-layer="${k}"]`);
      if (cb ? cb.checked : (k in visible ? visible[k] : defaults[k])) layers[k].addTo(S.map);
    }
    S.changed = changed;
    details(d, geo);
    applyViews();
    if (S.onShown) S.onShown();
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
    if (placeOnEarth(d) && !S.editing) { show(S.data); drawImages(); }
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

  // ----- who may see the map -----
  function gate(html) { main.innerHTML = `<section class="pub members-gate"><div class="panel gate-card">${html}</div></section>`; }
  const RANKS = { green: 1, blue: 2, black: 3, "double-black": 4, survey: 5, "site-admin": 6, admin: 6 };
  async function myLevel(C) {
    const r = await C.client.rpc("my_site_map_level");
    if (r.error) return { error: /my_site_map_level|does not exist|schema cache|404/i.test((r.error.message || "") + (r.error.code || "")) ? "setup" : C.explain(r.error) };
    return { level: r.data || "none" };
  }
  async function boot() {
    const C = window.LDCloud, then = `account.html#then=map-${esc(site)}`;
    const title = `<span class="eyebrow">Site map${S.data.place ? " · " + esc(S.data.place) : ""}</span><h1>${esc(S.data.title)}</h1>`;
    if (!C || !C.configured || !C.available) return gate(`${title}<p>Site maps are for registered members, and the log in service couldn't be loaded. Check your connection and refresh the page.</p>`);
    gate(`<p class="hint">Checking your log in…</p>`);
    await (C.ready || Promise.resolve());
    if (!C.user) return gate(`<span class="eyebrow">Members only</span><h1>${esc(S.data.title)}</h1>
      <p>Our site maps are for registered Limitless Diving divers. Log in, or create a free account in a minute.
      Once you're registered, an instructor gives you access to the lines you're trained for.</p>
      <div class="row-actions"><a class="btn primary" href="${then}">Log in</a><a class="btn" href="${then}">Create a free account</a></div>`);
    const me = await myLevel(C);
    if (me.error) return gate(`${title}<p>${me.error === "setup" ? "Site maps access isn't switched on yet. An Admin needs to run the latest <code>supabase/schema.sql</code> in Supabase." : esc(me.error)}</p>`);
    if (!RANKS[me.level]) return gate(`${title}<p><b>Your account doesn't have site maps access yet.</b> An instructor sets it to match your training:
      open water divers see the green circle lines, advanced divers the blue squares, tech divers the black diamonds, and so on.</p>
      <p>Ask Jamie at <a href="mailto:jamie@limitless-diving.com">jamie@limitless-diving.com</a>, then refresh this page.</p>
      <p><a href="site-maps.html">← All site maps</a></p>`);
    S.level = me.level; S.rank = RANKS[me.level];
    const { data, error } = await C.client.from("site_maps").select("data, version, updated_at").eq("id", site).maybeSingle();
    if (error) return gate(`${title}<p>This site map couldn't be loaded: ${esc(C.explain(error))}. Refresh the page to try again.</p>`);
    if (data) { S.data = data.data; S.version = data.version; S.updatedAt = data.updated_at; }
    else if (S.data.privateSurvey) return gate(`${title}<p>This map's survey hasn't been loaded into the website yet.${S.isSiteAdmin()
      ? ` Run its seed file (<code>site-maps-seed-${esc(site)}.sql</code>, in the project files) in the Supabase SQL editor, after <code>supabase/schema.sql</code>.` : " Check back soon."}</p>
      <p><a href="site-maps.html">← All site maps</a></p>`);
    page();
    if (L) { placeOnEarth(S.data); show(S.data); }
    // Logging out, or another member logging in, changes what this page may show: start again.
    C.onChange(async () => {
      const now = C.user ? await myLevel(C) : { level: "none" };
      if (!now.error && now.level !== S.level) location.reload();
    });
    started();
  }
  boot().catch(e => { console.error(e); gate(`<p>This site map couldn't be loaded. Refresh the page to try again.</p>`); });
})();
