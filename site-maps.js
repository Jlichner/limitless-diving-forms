/* Limitless Diving — Site maps (site-maps.html): a card for every dive site survey map.
   Each site's data file (e.g. bonnie-castle-data.js) adds itself to window.SITE_MAPS; its map page is
   <id>-map.html. To add a site: make its data file and map page, and load the data file here too.
   A site with no survey yet (lake-hydra-data.js) names its starting point as origin; divers add lines in the editor. */
(function () {
  "use strict";

  const main = document.getElementById("sitemaps"), G = window.SurveyGeometry;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  let sites = Object.values(window.SITE_MAPS || {});

  // A small north-up drawing of the site's lines for its card.
  function thumbnail(geo) {
    const [[x0, y0], [x1, y1]] = geo.bounds, pad = 20, w = x1 - x0 + 2 * pad, h = y1 - y0 + 2 * pad;
    const lines = geo.segments.filter(s => s.kind !== "removed")
      .map(s => `M${(s.x0 - x0 + pad).toFixed(1)} ${(y1 - s.y0 + pad).toFixed(1)}L${(s.x1 - x0 + pad).toFixed(1)} ${(y1 - s.y1 + pad).toFixed(1)}`).join("");
    return `<svg class="sm-thumb" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path d="${lines}" fill="none" stroke="currentColor" stroke-width="${(w / 260).toFixed(2)}" stroke-linecap="round"/></svg>`;
  }

  function card(d) {
    const geo = G.compute(d);
    const ft = geo.segments.filter(s => s.kind === "surveyed" || s.kind === "marina")
      .reduce((t, s) => { const e = d.runs[s.run][s.index]; return t + (Number(e.length_ft) || 0) + (Number(e.length_in) || 0) / 12; }, 0);
    const named = geo.landmarks.filter(l => l.icon && !/mooringblock/.test(l.icon)).length;
    if (!geo.segments.length) return `<a class="sm-card" href="${esc(d.id)}-map.html"><span class="sm-thumb sm-thumb-empty" aria-hidden="true">Survey coming soon</span>
      <span class="sm-card-body"><b>${esc(d.title)}</b><span>${esc(d.place || "")}</span>
      <em>Not surveyed yet. Help us map it: log in, open the map and add the lines you survey.</em></span></a>`;
    return `<a class="sm-card" href="${esc(d.id)}-map.html">${thumbnail(geo)}
      <span class="sm-card-body"><b>${esc(d.title)}</b><span>${esc(d.place || "")}</span>
      <em>${Math.round(ft).toLocaleString()} ft of line surveyed · ${named} landmarks · ${geo.stakes.length} stakes</em>
      <span class="sm-card-by">${esc(d.credit)}</span></span></a>`;
  }

  function render() {
  main.innerHTML = `<section class="pub-hero dm-hero"><span class="eyebrow">Under the water</span><h1>Site maps</h1>
      <p>Maps of the dive sites we dive, made from our divers' surveys: every line, stake and tie-off measured with a compass and a tape.
      Open a map to zoom in and see the landmarks and depths.</p></section>
    ${sites.length ? `<div class="sm-cards">${sites.map(card).join("")}</div>` : `<div class="msg">No site maps yet.</div>`}`;
  }
  render();

  // Maps an Admin has published from the editor (site_maps) replace their data file's version.
  (async () => {
    const C = window.LDCloud;
    if (!C || !C.available) return;
    const { data, error } = await C.client.from("site_maps").select("id, data");
    if (error || !data || !data.length) return;
    const pub = Object.fromEntries(data.map(r => [r.id, r.data]));
    sites = sites.map(d => pub[d.id] ? Object.assign({}, pub[d.id], { id: d.id }) : d);
    render();
  })().catch(e => console.warn("Published maps not loaded:", e));
})();
