/* Limitless Diving — Site maps (site-maps.html): a card for every dive site survey map.
   Each site's data file (e.g. bonnie-castle-data.js) adds its title and credits to window.SITE_MAPS; its map
   page is <id>-map.html. To add a site: make its data file and map page, and load the data file here too.
   The surveys are in the database (site_maps), readable only by members with a Site maps access level, so the
   cards show each map's drawing only to them; everyone else sees the titles and a log in link.
   A site with no survey yet (lake-hydra-data.js) names its starting point as origin; divers add lines in the editor. */
(function () {
  "use strict";

  const main = document.getElementById("sitemaps"), G = window.SurveyGeometry;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  let sites = Object.values(window.SITE_MAPS || {}), access = null;

  // A small drawing of the site's lines for its card. On a map placed on the earth, the satellite pictures go
  // underneath for context (Jamie 2026-11-25); the map page itself still starts with them off.
  const SAT_TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const tileLng = (x, z) => x / 2 ** z * 360 - 180;
  const tileLat = (y, z) => { const t = Math.PI * (1 - 2 * y / 2 ** z); return Math.atan(Math.sinh(t)) * 180 / Math.PI; };
  const lngTile = (lng, z) => (lng + 180) / 360 * 2 ** z;
  const latTile = (lat, z) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z; };
  function satTiles(gr, box, X, Y) {
    // The area to cover: the drawing plus a wide margin, as the card is often wider than the drawing.
    const [[x0, y0], [x1, y1]] = box, mx = (x1 - x0) * 0.9 + 200, my = (y1 - y0) * 0.9 + 200;
    const lls = [[x0 - mx, y0 - my], [x1 + mx, y0 - my], [x0 - mx, y1 + my], [x1 + mx, y1 + my]].map(([x, y]) => gr.toLatLng(x, y));
    const lats = lls.map(p => p[0]), lngs = lls.map(p => p[1]);
    let z = 18;
    while (z > 3 && (lngTile(Math.max(...lngs), z) - lngTile(Math.min(...lngs), z)) > 4) z--;
    const tx0 = Math.floor(lngTile(Math.min(...lngs), z)), tx1 = Math.floor(lngTile(Math.max(...lngs), z));
    const ty0 = Math.floor(latTile(Math.max(...lats), z)), ty1 = Math.floor(latTile(Math.min(...lats), z));
    if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 40) return "";
    const out = [], P = (lat, lng) => { const [x, y] = gr.toXY(lat, lng); return [X(x), Y(y)]; };
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const tl = P(tileLat(ty, z), tileLng(tx, z)), tr = P(tileLat(ty, z), tileLng(tx + 1, z)), bl = P(tileLat(ty + 1, z), tileLng(tx, z));
      // A hair bigger than the tile, so no seams show between them.
      const k = 1.004, a = (tr[0] - tl[0]) * k, b = (tr[1] - tl[1]) * k, c = (bl[0] - tl[0]) * k, d = (bl[1] - tl[1]) * k;
      out.push(`<image href="${SAT_TILE.replace("{z}", z).replace("{y}", ty).replace("{x}", tx)}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" transform="matrix(${[a, b, c, d, tl[0], tl[1]].map(v => v.toFixed(3)).join(" ")})"/>`);
    }
    return out.join("");
  }
  function thumbnail(geo, d) {
    const [[x0, y0], [x1, y1]] = geo.bounds, pad = 20, w = x1 - x0 + 2 * pad, h = y1 - y0 + 2 * pad;
    const X = x => x - x0 + pad, Y = y => y1 - y + pad;
    const lines = geo.segments.filter(s => s.kind !== "removed")
      .map(s => `M${X(s.x0).toFixed(1)} ${Y(s.y0).toFixed(1)}L${X(s.x1).toFixed(1)} ${Y(s.y1).toFixed(1)}`).join("");
    let gr = null;
    try { gr = d.georef && G.georef ? G.georef(d.georef, geo.at) : null; } catch (e) { gr = null; }
    const sat = gr ? satTiles(gr, geo.bounds, X, Y) : "";
    return `<svg class="sm-thumb${sat ? " sat" : ""}" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      ${sat ? `<g class="sm-thumb-sat">${sat}</g>` : ""}
      <path d="${lines}" fill="none" stroke="currentColor" stroke-width="${(w / (sat ? 180 : 260)).toFixed(2)}" stroke-linecap="round"/></svg>`;
  }

  function card(d) {
    const geo = G.compute(d);
    const ft = geo.segments.filter(s => s.kind === "surveyed" || s.kind === "marina")
      .reduce((t, s) => { const e = d.runs[s.run][s.index]; return t + (Number(e.length_ft) || 0) + (Number(e.length_in) || 0) / 12; }, 0);
    const named = geo.landmarks.filter(l => l.icon && !/mooringblock/.test(l.icon)).length;
    if (!geo.segments.length && d.privateSurvey) return `<a class="sm-card" href="${esc(d.id)}-map.html"><span class="sm-thumb sm-thumb-empty" aria-hidden="true">Members only</span>
      <span class="sm-card-body"><b>${esc(d.title)}</b><span>${esc(d.place || "")}</span>
      <em>${access === "none" ? "Ask an instructor for site maps access to open this map." : "Log in to open this map."}</em>
      <span class="sm-card-by">${esc(d.credit)}</span></span></a>`;
    if (!geo.segments.length) return `<a class="sm-card" href="${esc(d.id)}-map.html"><span class="sm-thumb sm-thumb-empty" aria-hidden="true">Survey coming soon</span>
      <span class="sm-card-body"><b>${esc(d.title)}</b><span>${esc(d.place || "")}</span>
      <em>Not surveyed yet. Our survey team adds the lines as they map it.</em></span></a>`;
    return `<a class="sm-card" href="${esc(d.id)}-map.html">${thumbnail(geo, d)}
      <span class="sm-card-body"><b>${esc(d.title)}</b><span>${esc(d.place || "")}</span>
      <em>${Math.round(ft).toLocaleString()} ft of line surveyed · ${named} landmarks · ${geo.stakes.length} stakes</em>
      <span class="sm-card-by">${esc(d.credit)}</span></span></a>`;
  }

  function render() {
  main.innerHTML = `<section class="pub-hero dm-hero"><span class="eyebrow">Under the water</span><h1>Site maps</h1>
      <p>Maps of the dive sites we dive, made from our divers' surveys: every line, stake and tie-off measured with a compass and a tape.
      Open a map to zoom in and see the landmarks and depths.</p>
      <p>The maps are for registered members. Each diver sees the lines they're trained for: green circles for open water divers,
      blue squares for advanced, black diamonds for tech, and double black diamonds for tech on scooters.</p></section>
    ${sites.length ? `<div class="sm-cards">${sites.map(card).join("")}</div>` : `<div class="msg">No site maps yet.</div>`}`;
  }
  render();

  // Maps an Admin has published from the editor (site_maps) replace their data file's version.
  (async () => {
    const C = window.LDCloud;
    if (!C || !C.available) return;
    await (C.ready || Promise.resolve());
    if (!C.user) return;
    const lv = await C.client.rpc("my_site_map_level");
    if (!lv.error && lv.data === "none") { access = "none"; render(); return; }
    const { data, error } = await C.client.from("site_maps").select("id, data");
    if (error || !data || !data.length) return;
    const pub = Object.fromEntries(data.map(r => [r.id, r.data]));
    sites = sites.map(d => pub[d.id] ? Object.assign({}, pub[d.id], { id: d.id, credit: d.credit || pub[d.id].credit }) : d);
    render();
  })().catch(e => console.warn("Published maps not loaded:", e));
})();
