/* Limitless Diving — Site maps (site-maps.html): a card for every dive site survey map.
   Each site's data file (e.g. bonnie-castle-data.js) adds itself to window.SITE_MAPS; its map page is
   <id>-map.html. To add a site: make its data file and map page, and load the data file here too. */
(function () {
  "use strict";

  const main = document.getElementById("sitemaps"), G = window.SurveyGeometry;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const sites = Object.values(window.SITE_MAPS || {});

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
    return `<a class="sm-card" href="${esc(d.id)}-map.html">${thumbnail(geo)}
      <span class="sm-card-body"><b>${esc(d.title)}</b><span>${esc(d.place || "")}</span>
      <em>${Math.round(ft).toLocaleString()} ft of line surveyed · ${named} landmarks · ${geo.stakes.length} stakes</em>
      <span class="sm-card-by">${esc(d.credit)}</span></span></a>`;
  }

  main.innerHTML = `<section class="pub-hero dm-hero"><span class="eyebrow">Under the water</span><h1>Site maps</h1>
      <p>Maps of the dive sites we dive, made from our divers' surveys: every line, stake and tie-off measured with a compass and a tape.
      Open a map to zoom in and see the landmarks and depths.</p></section>
    ${sites.length ? `<div class="sm-cards">${sites.map(card).join("")}</div>` : `<div class="msg">No site maps yet.</div>`}`;
})();
