/* Limitless Diving — shared map helpers for the Dive map (dive-map.html) and Places I've dived (account.html).
   Maps use Leaflet (loaded from cdnjs in the page) with OpenStreetMap tiles. Pins are little diver-down flags.
   Place search uses OpenStreetMap's Nominatim, one search per button press, as its usage policy asks.
   window.LDMap = { ok, map, flag, search, esc } */
(function () {
  "use strict";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
  const ok = () => !!window.L;

  // A world map in el. Wraps sideways like a globe, but never zooms out past the whole world.
  function map(el, opts) {
    const m = window.L.map(el, Object.assign({ worldCopyJump: true, minZoom: 1, zoomSnap: 0.5, scrollWheelZoom: false }, opts || {}))
      .setView([20, 0], 1.5);
    window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(m);
    // Wheel zoom only after the map is clicked, so scrolling the page doesn't get stuck on it.
    m.once("focus", () => m.scrollWheelZoom.enable());
    m.on("click", () => m.scrollWheelZoom.enable());
    return m;
  }

  // A diver-down flag pin. count > 1 adds a small badge; kind "new" is the not-yet-saved pin.
  function flag(count, kind) {
    const badge = count > 1 ? `<b class="pin-n">${count > 99 ? "99+" : count}</b>` : "";
    return window.L.divIcon({
      className: "dive-pin" + (kind ? " " + kind : ""), iconSize: [26, 30], iconAnchor: [3, 29], popupAnchor: [10, -26],
      html: `<svg viewBox="0 0 26 30" aria-hidden="true"><rect x="2" y="2" width="2.4" height="27" rx="1" fill="#33424a"/>
        <rect x="4" y="2" width="20" height="14" fill="${kind === "new" ? "#f2b233" : "#d7263d"}" stroke="#ffffff" stroke-width="1.2"/>
        <polygon points="4,2 8,2 24,13 24,16 20,16 4,5" fill="#ffffff"/></svg>${badge}`
    });
  }

  // Up to 5 places for a search, as { name, place, lat, lng }.
  async function search(q) {
    const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=en&q=" + encodeURIComponent(q);
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("Place search isn't answering right now (" + r.status + "). You can still tap the map to drop your pin.");
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map(x => {
      const parts = String(x.display_name || "").split(",").map(t => t.trim()).filter(Boolean);
      const name = x.name || parts[0] || q;
      // "Cozumel, Quintana Roo, Mexico" style: the next part after the name, plus the country.
      const rest = parts.filter(p => p !== name), place = rest.length > 1 ? rest[0] + ", " + rest[rest.length - 1] : rest[0] || "";
      return { name: name.slice(0, 120), place: place.slice(0, 200), full: x.display_name || name, lat: Number(x.lat), lng: Number(x.lon) };
    }).filter(x => isFinite(x.lat) && isFinite(x.lng));
  }

  window.LDMap = { ok, map, flag, search, esc };
})();
