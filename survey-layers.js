/* Limitless Diving — layers, landmark photos and map setup for a site map (e.g. bonnie-castle-map.html).
   - Layers panel: turn each layer on or off and fade it with a slider: the satellite pictures (once the map is
     placed on the earth), picture layers such as a topographic map, the main survey lines, and the rated layers.
     A member only gets the rated layers their Site maps access level allows (the database enforces it).
   - Landmark photos (members see approved ones and add their own; Admins approve).
   - Map setup (Admins and Dive site admins): place the map on the earth, add and line up picture layers,
     rate lines ski-style (green circle on the main survey; blue square, black diamond and double black diamond
     each in a layer of their own), set members' Site maps access levels, and approve photos.
   Uses SurveyMap (survey-map.js), SurveyEdits (survey-edits.js), SurveyGeometry and LDCloud (cloud.js).
   Database: site_map_members (levels), site_map_layers, site_map_layer_access (restricted pictures), site_map_photos and the Storage buckets
   'site-map-layers' and 'site-map-photos' (supabase/schema.sql). */
// Starts once survey-map.js has checked the member's access and drawn the map (SurveyMap.ready).
(window.SurveyMap ? window.SurveyMap.ready : Promise.resolve()).then(function () {
  "use strict";

  const S = window.SurveyMap, E = window.SurveyEdits, G = window.SurveyGeometry, R = window.SurveyRatings, C = window.LDCloud, L = window.L;
  if (!S || !S.map || !L) return;
  const esc = S.esc, site = S.site;
  const box = document.getElementById("sm-layers"), setupBox = document.getElementById("sm-setup");
  const VIEW = "ld-sitemap-view-" + site;
  const cloud = () => !!(C && C.available);
  const isAdmin = () => S.isSiteAdmin();   // Admins and Dive site admins
  const RANK = { green: 0, blue: 1, black: 2, "double-black": 3 };
  const rating = id => S.RATINGS.find(r => r.id === id);
  const EMPTY = () => ({ runs: {}, plan: [], landmarks: {}, runNames: {} });
  const st = { layers: [], loadErr: null, photos: [], urls: {}, setupOpen: false, msg: null, busy: false,
    people: null, access: {}, align: null, rate: null, open: {} };

  // ----- loading -----
  async function loadLayers() {
    if (!cloud()) return;
    const { data, error } = await C.client.from("site_map_layers").select("*").eq("site_id", site).order("sort").order("created_at");
    if (error) { st.loadErr = /site_map_layers|does not exist|schema cache/i.test(error.message || "") ? "setup" : C.explain(error); st.layers = []; }
    else {
      st.loadErr = null;
      const paths = data.filter(l => l.kind === "image" && l.image_path).map(l => l.image_path);
      const urls = await signed("site-map-layers", paths);
      st.layers = data.map(l => Object.assign({}, l, { imageUrl: urls[l.image_path] || null }));
    }
    pushLayers();
  }
  async function signed(bucket, paths) {
    if (!paths.length) return {};
    const { data, error } = await C.client.storage.from(bucket).createSignedUrls(paths, 6 * 3600);
    if (error || !data) return {};
    const out = {};
    data.forEach(r => { if (r.signedUrl) out[r.path] = r.signedUrl; });
    return out;
  }
  function pushLayers() {
    const al = st.align;
    S.setLayers(st.layers.map(l => Object.assign({}, l, al && al.id === l.id
      ? { bounds: al.bounds, interactive: true, onImage: img => { al.overlay = img; } } : {})));
    render();
  }
  async function loadPhotos() {
    if (!cloud()) return;
    const { data, error } = await C.client.from("site_map_photos").select("id, landmark, path, caption, author, author_name, approved, created_at")
      .eq("site_id", site).order("created_at");
    st.photos = error ? [] : data;
    Object.assign(st.urls, await signed("site-map-photos", st.photos.map(p => p.path).filter(p => !st.urls[p])));
  }

  // ----- the layers panel -----
  function loadView() { try { return JSON.parse(localStorage.getItem(VIEW) || "{}") || {}; } catch (e) { return {}; } }
  function saveView() { try { localStorage.setItem(VIEW, JSON.stringify(S.view)); } catch (e) { /* private mode */ } }
  Object.assign(S.view, loadView());

  function rows() {
    const out = [];
    if (S.geoRef()) out.push({ id: "satellite", name: "Satellite pictures", hint: "Esri World Imagery" });
    for (const l of st.layers.filter(l => l.kind === "image")) out.push({ id: l.id, name: l.name, restricted: l.restricted, note: l.note,
      hint: !l.imageUrl ? "Picture not added yet" : !l.bounds ? "Not lined up yet" : l.bounds.north != null && !S.geoRef() ? "Shows once the map is placed on the earth" : "" });
    out.push({ id: "survey", name: "Survey lines", rating: "green", hint: "The main survey: green circle lines, for every member with site maps access" });
    for (const l of st.layers.filter(l => l.kind === "survey")) out.push({ id: l.id, name: l.name, restricted: l.restricted, note: l.note, rating: l.rating,
      hint: l.survey && Object.keys(l.survey.runs || {}).length ? `${Object.keys(l.survey.runs).length} runs of line` : "No lines yet" });
    return out;
  }
  function render() {
    const v = id => S.view[id] || { visible: true, opacity: 1 };
    box.innerHTML = `<ul class="sm-layer-list">${rows().map(r => {
      const vv = v(r.id), pct = Math.round(vv.opacity * 100);
      return `<li><label class="sm-layer-on"><input type="checkbox" data-lv="${esc(r.id)}"${vv.visible ? " checked" : ""}>
          ${r.rating ? S.ratingSvg(r.rating) : ""}<b>${esc(r.name)}</b>${r.rating && r.rating !== "green" ? ` <span class="sm-lock" title="Only divers whose Site maps access is ${esc(rating(r.rating).name.toLowerCase())} or higher see it">${esc(rating(r.rating).divers)} and up</span>` : r.restricted ? ` <span class="sm-lock" title="Only divers who've been granted this layer can see it">Restricted</span>` : ""}</label>
        <span class="sm-layer-hint">${esc([r.note, r.hint].filter(Boolean).join(" · "))}</span>
        <label class="sm-slider"><span class="sr-only">How see-through: ${esc(r.name)}</span>
          <input type="range" min="0" max="100" step="5" value="${pct}" data-lo="${esc(r.id)}" aria-valuetext="${pct}% visible"><output>${pct}%</output></label></li>`;
    }).join("")}</ul>
      ${st.loadErr === "setup" ? `<p class="hint">Extra layers need the latest <code>supabase/schema.sql</code> run in Supabase.</p>` : st.loadErr ? `<p class="hint">${esc(st.loadErr)}</p>` : ""}
      ${S.level && S.rank < 4 ? `<p class="hint">You see the lines for your Site maps access: ${esc(S.levelName(S.level))}. Ask an instructor about the training for more.</p>` : ""}`;
    renderSetup();
  }
  box.addEventListener("input", e => {
    const el = e.target;
    if (el.dataset.lo) {
      const o = Number(el.value) / 100;
      S.setLayerView(el.dataset.lo, { opacity: o });
      const out = el.parentElement.querySelector("output"); if (out) out.textContent = el.value + "%";
      el.setAttribute("aria-valuetext", el.value + "% visible");
      saveView();
    }
  });
  box.addEventListener("change", e => {
    const el = e.target;
    if (el.dataset.lv) { S.setLayerView(el.dataset.lv, { visible: el.checked }); saveView(); }
  });

  // ----- landmark photos -----
  function photoHtml(lm) {
    const mine = C && C.user ? C.user.id : null;
    const list = st.photos.filter(p => p.landmark === lm && (p.approved || p.author === mine || isAdmin()));
    return `${list.length ? `<div class="sm-ph-row">${list.map(p => `<figure class="sm-ph">
        ${st.urls[p.path] ? `<a href="${esc(st.urls[p.path])}" target="_blank" rel="noopener"><img src="${esc(st.urls[p.path])}" alt="${esc(p.caption || "Photo of " + S.name(lm))}" loading="lazy"></a>` : ""}
        <figcaption>${esc(p.caption)}${p.author_name ? ` <span>· ${esc(p.author_name)}</span>` : ""}${!p.approved ? ` <i>Waiting for approval</i>` : ""}
          ${p.author === mine || isAdmin() ? ` <button type="button" class="sm-ph-del" data-ph-del="${esc(p.id)}">Remove</button>` : ""}</figcaption></figure>`).join("")}</div>` : ""}
      ${C && C.user ? `<input class="sm-ph-cap" maxlength="300" placeholder="Caption for a new photo (optional)" aria-label="Caption for a new photo"><label class="sm-ph-add">+ Add a photo<input type="file" accept="image/jpeg,image/png,image/webp" data-ph-add="${esc(lm)}" hidden></label>`
        : cloud() ? `<a class="sm-ph-add" href="account.html#then=map-${esc(site)}">Log in to add a photo</a>` : ""}
      <p class="sm-ph-msg" role="status"></p>`;
  }
  S.popupHooks.push((f, el, pop) => {
    const slot = el && el.querySelector(`[data-photos="${CSS.escape(f.landmark)}"]`);
    if (!slot) return;
    const fill = () => { slot.innerHTML = photoHtml(f.landmark); pop.update(); };
    fill();
    slot.addEventListener("change", async e => {
      const input = e.target.closest("[data-ph-add]");
      if (!input || !input.files[0]) return;
      const msg = slot.querySelector(".sm-ph-msg");
      const caption = ((slot.querySelector(".sm-ph-cap") || {}).value || "").trim();
      msg.textContent = "Uploading…";
      try { await addPhoto(f.landmark, input.files[0], caption); fill(); slot.querySelector(".sm-ph-msg").textContent = isAdmin() ? "Added." : "Thanks! It shows for everyone once an Admin approves it."; }
      catch (err) { msg.textContent = (C.explain ? C.explain(err) : err.message) || "That didn't upload."; }
      pop.update();
    });
    slot.addEventListener("click", async e => {
      const b = e.target.closest("[data-ph-del]");
      if (!b) return;
      if (!confirm("Remove this photo?")) return;
      await removePhoto(b.dataset.phDel); fill();
    });
  });

  // Shrink a photo to at most 1600 px on its long side, as a JPEG.
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? resolve(b) : reject(new Error("That picture couldn't be read.")), "image/jpeg", 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That picture couldn't be read.")); };
      img.src = url;
    });
  }
  async function addPhoto(lm, file, caption) {
    const blob = await shrink(file);
    const path = `${site}/${C.user.id}/${lm.toLowerCase()}-${Date.now().toString(36)}.jpg`;
    const up = await C.client.storage.from("site-map-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (up.error) throw up.error;
    const { error } = await C.client.from("site_map_photos").insert({ site_id: site, landmark: lm, path, caption: (caption || "").slice(0, 300), approved: isAdmin() });
    if (error) { await C.client.storage.from("site-map-photos").remove([path]); throw error; }
    await loadPhotos();
    render();
  }
  async function removePhoto(id) {
    const p = st.photos.find(x => x.id === id);
    if (!p) return;
    const { error } = await C.client.from("site_map_photos").delete().eq("id", id);
    if (error) { say(C.explain(error), "bad"); return; }
    await C.client.storage.from("site-map-photos").remove([p.path]);
    await loadPhotos(); render();
  }

  // ----- map setup (Admins) -----
  function say(text, kind) { st.msg = text ? { text, kind: kind || "" } : null; }
  const landmarkOptions = (sel, allowNone) => {
    const geo = G.compute(S.data), seen = new Set();
    const origin = S.data.origin || "BAR";
    const list = [{ landmark: origin }].concat(geo.landmarks).filter(l => !seen.has(l.landmark) && seen.add(l.landmark))
      .map(l => l.landmark).sort((a, b) => S.name(a).localeCompare(S.name(b)));
    return (allowNone ? `<option value="">None</option>` : "") + list.map(k => `<option value="${esc(k)}"${k === sel ? " selected" : ""}>${esc(S.name(k))}</option>`).join("");
  };

  // Redrawing the setup panel keeps whatever was being typed or chosen in it (except picked files).
  const FIELDS = "input[id]:not([type=file]), select[id], [data-g], [data-al], [data-ly]";
  const fieldKey = el => el.id || ["g", "al", "ly", "k"].map(k => el.dataset[k] || "").join("|");
  function renderSetup() {
    const kept = {};
    if (!st.clearForms) setupBox.querySelectorAll(FIELDS).forEach(el => { kept[fieldKey(el)] = el.type === "checkbox" ? el.checked : el.value; });
    st.clearForms = false;
    drawSetup();
    setupBox.querySelectorAll(FIELDS).forEach(el => {
      const k = fieldKey(el);
      if (!(k in kept)) return;
      if (el.type === "checkbox") el.checked = kept[k];
      else if (el.tagName !== "SELECT" || [...el.options].some(o => o.value === kept[k])) el.value = kept[k];
    });
  }
  function drawSetup() {
    if (!isAdmin()) { setupBox.innerHTML = ""; return; }
    const gr = S.data.georef || {}, g = S.geoRef();
    const pending = st.photos.filter(p => !p.approved);
    if (!st.setupOpen) {
      setupBox.innerHTML = `<section class="panel sm-setup"><div class="se-head"><h2 class="sec">Map setup</h2>
        <button type="button" class="btn" data-su="open">Open map setup</button></div>
        <p class="hint">Admins and Dive site admins: place the map on the earth, add picture layers, rate lines, choose which divers see which ratings${pending.length ? `, and approve <b>${pending.length} new photo${pending.length === 1 ? "" : "s"}</b>` : ""}.</p></section>`;
      return;
    }
    setupBox.innerHTML = `<section class="panel sm-setup"><div class="se-head"><h2 class="sec">Map setup</h2><button type="button" class="btn" data-su="close">Close</button></div>
      ${st.msg ? `<p class="se-msg ${st.msg.kind}" role="status">${esc(st.msg.text)}</p>` : ""}
      ${st.loadErr === "setup" ? `<p class="se-err">Run the latest <code>supabase/schema.sql</code> in Supabase first: layers, access and photos need its new tables.</p>` : ""}

      <details class="sm-su"${st.open.place ? " open" : ""} data-sec="place"><summary>Place the map on the earth${g ? " ✓" : ""}</summary>
        <p class="hint">Stand on (or float over) a landmark with a GPS, or find it on a satellite map, and enter its coordinates.
          The survey's headings are from a compass, so also enter the magnetic declination for the site
          (<a href="https://www.ngdc.noaa.gov/geomag/calculators/magcalc.shtml" target="_blank" rel="noopener">NOAA calculator</a>; west is negative, e.g. −12.8).
          With a second known point, the turn and scale are worked out from the two points instead.</p>
        <div class="sm-form">
          <label>Landmark <select data-g="landmark">${landmarkOptions(gr.landmark || S.data.origin || "BAR")}</select></label>
          <label>Latitude <input data-g="lat" autocomplete="off" value="${esc(gr.lat ?? "")}" placeholder="44.3421"></label>
          <label>Longitude <input data-g="lon" autocomplete="off" value="${esc(gr.lon ?? "")}" placeholder="-75.9165"></label>
          <label>Declination ° <input data-g="declination" inputmode="decimal" value="${esc(gr.declination ?? "")}" placeholder="-12.8"></label>
          <label>Second landmark (optional) <select data-g="landmark2">${landmarkOptions(gr.landmark2 || "", true)}</select></label>
          <label>Its latitude <input data-g="lat2" autocomplete="off" value="${esc(gr.lat2 ?? "")}"></label>
          <label>Its longitude <input data-g="lon2" autocomplete="off" value="${esc(gr.lon2 ?? "")}"></label></div>
        <p class="hint">Tip: you can paste "44.3421, -75.9165" into the latitude box.</p>
        ${g ? `<p class="hint">Now placed: turned ${g.turn.toFixed(1)}° from the compass${g.twoPoint ? `, drawn at ${(g.scale * 100).toFixed(1)}% of the measured lengths to fit both points` : ""}.</p>` : ""}
        <div class="se-acts"><button type="button" class="btn primary" data-su="place"${st.busy ? " disabled" : ""}>Save and publish</button>
          ${S.data.georef ? `<button type="button" class="btn" data-su="unplace"${st.busy ? " disabled" : ""}>Take it off the earth</button>` : ""}</div></details>

      <details class="sm-su"${st.open.layers ? " open" : ""} data-sec="layers"><summary>Layers (${st.layers.length})</summary>
        ${st.layers.length ? `<ul class="sm-su-list">${st.layers.map((l, i) => layerRow(l, i)).join("")}</ul>` : `<p class="hint">No layers yet.</p>`}
        <h3>Add a picture layer</h3>
        <p class="hint">For example a topographic map. JPEG, PNG or WebP up to 25 MB. After it's added, line it up on the map.</p>
        <div class="sm-form"><label>Name <input id="su-img-name" maxlength="120" placeholder="Topographic map"></label>
          <label>Picture <input id="su-img-file" type="file" accept="image/jpeg,image/png,image/webp">${st.imgFile ? `<span>Chosen: ${esc(st.imgFile.name)}</span>` : ""}</label>
          <label class="sm-check"><input id="su-img-restricted" type="checkbox"> Restricted</label></div>
        <button type="button" class="btn primary" data-su="add-image"${st.busy ? " disabled" : ""}>Add picture layer</button>
</details>

      <details class="sm-su"${st.open.rate ? " open" : ""} data-sec="rate"><summary>Rate lines (green circle to double black diamond)</summary>${rateCard()}</details>

      <details class="sm-su"${st.open.levels ? " open" : ""} data-sec="levels"><summary>Site maps access for members</summary>${levelsCard()}</details>

      ${st.layers.some(l => l.restricted && !l.rating) ? `<details class="sm-su"${st.open.access ? " open" : ""} data-sec="access"><summary>Who can see restricted picture layers</summary>${accessCard()}</details>` : ""}

      <details class="sm-su"${st.open.photos || pending.length ? " open" : ""} data-sec="photos"><summary>Photos to approve (${pending.length})</summary>
        ${pending.length ? `<ul class="sm-su-list">${pending.map(p => `<li class="sm-su-photo">${st.urls[p.path] ? `<img src="${esc(st.urls[p.path])}" alt="">` : ""}
          <span><b>${esc(S.name(p.landmark))}</b><br>${esc(p.author_name || "A member")}${p.caption ? " · " + esc(p.caption) : ""}</span>
          <span class="se-acts"><button type="button" class="btn primary" data-su="ph-ok" data-id="${esc(p.id)}">Approve</button>
          <button type="button" class="btn" data-su="ph-del" data-id="${esc(p.id)}">Remove</button></span></li>`).join("")}</ul>`
          : `<p class="hint">None waiting. Members add photos from a landmark's popup on the map.</p>`}</details>
    </section>`;
  }

  function layerRow(l, i) {
    const al = st.align && st.align.id === l.id;
    if (l.rating) return `<li class="sm-su-layer"><b>${S.ratingSvg(l.rating)} ${esc(l.name)}</b>
      <span class="hint">${Object.keys((l.survey && l.survey.runs) || {}).length} runs · only divers you give this rating or higher can see it. Change its lines under "Rate lines".</span></li>`;
    return `<li class="sm-su-layer"><div class="sm-form">
        <label>Name <input data-ly="${esc(l.id)}" data-k="name" value="${esc(l.name)}" maxlength="120"></label>
        <label>Note <input data-ly="${esc(l.id)}" data-k="note" value="${esc(l.note)}" maxlength="500"></label>
        <label class="sm-check"><input type="checkbox" data-ly="${esc(l.id)}" data-k="restricted"${l.restricted ? " checked" : ""}> Restricted</label></div>
      <span class="hint">${l.kind === "image" ? "Picture" : `Survey lines: ${Object.keys((l.survey && l.survey.runs) || {}).length} runs`}${l.kind === "image" && !l.bounds ? " · not lined up yet" : ""}</span>
      <div class="se-acts"><button type="button" class="btn" data-su="ly-save" data-id="${esc(l.id)}">Save</button>
        ${i > 0 ? `<button type="button" class="btn" data-su="ly-up" data-id="${esc(l.id)}" aria-label="Move ${esc(l.name)} up">↑</button>` : ""}
        ${l.kind === "image" && l.imageUrl ? `<button type="button" class="btn" data-su="align" data-id="${esc(l.id)}">${al ? "Stop lining up" : "Line it up"}</button>` : ""}
        <button type="button" class="btn danger" data-su="ly-del" data-id="${esc(l.id)}">Delete</button></div>
      ${al ? alignCard(l) : ""}</li>`;
  }

  // ----- lining up a picture -----
  function alignCard(l) {
    const a = st.align, g = S.geoRef(), b = a.bounds || {};
    const step = a.step;
    return `<div class="se-card"><span class="eyebrow">Line up ${esc(l.name)}</span>
      <p>Tap a spot on the picture you can also find on the survey (a landmark, a corner of a dock), then tap that same spot on the survey. Do it for two spots far apart.
        The picture keeps its shape and stays north-up.</p>
      <ol class="se-list"><li${step === 0 ? ' class="on"' : ""}>${a.pts[0] && a.pts[0].img ? "✓" : ""} Tap spot 1 on the picture</li>
        <li${step === 1 ? ' class="on"' : ""}>${a.pts[0] && a.pts[0].map ? "✓" : ""} Tap spot 1 on the survey</li>
        <li${step === 2 ? ' class="on"' : ""}>${a.pts[1] && a.pts[1].img ? "✓" : ""} Tap spot 2 on the picture</li>
        <li${step === 3 ? ' class="on"' : ""}>${a.pts[1] && a.pts[1].map ? "✓" : ""} Tap spot 2 on the survey</li></ol>
      <div class="se-acts"><button type="button" class="btn" data-su="al-restart">Start the spots again</button></div>
      ${g ? `<p class="hint">Or, if the picture has coordinates printed at its edges, enter them:</p>
        <div class="sm-form"><label>North edge <input data-al="north" inputmode="decimal" value="${esc(b.north ?? "")}"></label>
          <label>South edge <input data-al="south" inputmode="decimal" value="${esc(b.south ?? "")}"></label>
          <label>West edge <input data-al="west" inputmode="decimal" value="${esc(b.west ?? "")}"></label>
          <label>East edge <input data-al="east" inputmode="decimal" value="${esc(b.east ?? "")}"></label></div>
        <button type="button" class="btn" data-su="al-edges">Use these edges</button>` : ""}
      <div class="se-acts"><button type="button" class="btn primary" data-su="al-save"${a.bounds ? "" : " disabled"}>Save where it sits</button></div></div>`;
  }
  // Plane coordinates for the math: feet (plain map) or east-stretched degrees (placed map), north up.
  function planeOf(latlng) { const g = S.geoRef(); return g ? [latlng.lng * Math.cos(st.align.lat0 * Math.PI / 180), latlng.lat] : [latlng.lng, latlng.lat]; }
  function boundsFrom(tl, s, W, H) {
    const g = S.geoRef();
    if (g) { const c = Math.cos(st.align.lat0 * Math.PI / 180); return { north: tl[1], south: tl[1] - s * H, west: tl[0] / c, east: (tl[0] + s * W) / c }; }
    return { x0: tl[0], y0: tl[1] - s * H, x1: tl[0] + s * W, y1: tl[1] };
  }
  async function startAlign(l) {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.onerror = r; img.src = l.imageUrl; });
    const W = img.naturalWidth || 1000, H = img.naturalHeight || 1000;
    const c = S.map.getCenter();
    st.align = { id: l.id, W, H, step: 0, pts: [{}, {}], bounds: l.bounds, lat0: c.lat };
    if (!st.align.bounds) {
      // Start it over the middle of the view, about two-thirds of the view wide.
      const vb = S.map.getBounds(), sw = planeOf(vb.getSouthWest()), ne = planeOf(vb.getNorthEast());
      const w = (ne[0] - sw[0]) * 0.66, s = w / W, mid = planeOf(c);
      st.align.bounds = boundsFrom([mid[0] - w / 2, mid[1] + s * H / 2], s, W, H);
    }
    S.setLayerView(l.id, { visible: true, opacity: 0.6 });
    S.map.on("click", alignClick);
    S.setPicker(f => alignClick({ latlng: L.latLng(S.ll(f.kind === "segment" ? f.x1 : f.x, f.kind === "segment" ? f.y1 : f.y)), feature: true }));
    pushLayers();
  }
  function stopAlign() {
    if (!st.align) return;
    S.map.off("click", alignClick);
    S.setPicker(null);
    st.align = null;
    pushLayers();
  }
  function alignClick(ev) {
    const a = st.align;
    if (!a) return;
    const onImage = a.step === 0 || a.step === 2, k = a.step < 2 ? 0 : 1;
    if (onImage) {
      const ov = a.overlay; if (!ov) return;
      const bb = ov.getBounds(), sw = planeOf(bb.getSouthWest()), ne = planeOf(bb.getNorthEast()), p = planeOf(ev.latlng);
      const u = (p[0] - sw[0]) / (ne[0] - sw[0]), v = (ne[1] - p[1]) / (ne[1] - sw[1]);
      if (u < 0 || u > 1 || v < 0 || v > 1) { say("Tap on the picture itself.", "bad"); return renderSetup(); }
      a.pts[k].img = [u * a.W, v * a.H];
    } else {
      a.pts[k].map = planeOf(ev.latlng);
    }
    a.step++;
    if (a.step === 4) {
      const [p1, p2] = a.pts, da = Math.hypot(p2.img[0] - p1.img[0], p2.img[1] - p1.img[1]), dm = Math.hypot(p2.map[0] - p1.map[0], p2.map[1] - p1.map[1]);
      if (da < 5) { say("The two spots on the picture are too close together. Start again with spots far apart.", "bad"); a.step = 0; a.pts = [{}, {}]; return renderSetup(); }
      const s = dm / da, tl = [p1.map[0] - s * p1.img[0], p1.map[1] + s * p1.img[1]];
      a.bounds = boundsFrom(tl, s, a.W, a.H);
      a.step = 0; a.pts = [{}, {}];
      say("Lined up. Check it with the slider, then save, or tap new spots to try again.", "ok");
      pushLayers();
      return;
    }
    say(null); renderSetup();
  }

  // ----- rating lines -----
  // Admins tap lines on the map; each pick is the whole run or the run from that line on. Applying a rating
  // moves the lines (and any run that starts from them and is rated lower) into that rating's layer, or back
  // onto the main survey for green.
  function rateCard() {
    const r = st.rate;
    if (!r) return `<p class="hint">Every line on the main survey is a green circle and every diver sees it. Rate a line blue, black or double black
        and it moves into that rating's layer, which only divers you've given that rating (or higher) can see.</p>
      <button type="button" class="btn primary" data-su="rate-start">Pick lines on the map</button>`;
    const label = sel => { const d = S.shown, e = d.runs[sel.run] || [], n = e.slice(0, sel.index + 1).filter(x => E.LINE.test(x.type)).length;
      return `${S.runName(sel.run)}: ${sel.whole ? "the whole run" : `from line ${n} to the end`}`; };
    return `<p class="se-pick">Tap the lines to rate on the map. ${r.sel.length ? "" : "Nothing picked yet."}</p>
      ${r.sel.length ? `<ul class="sm-su-list">${r.sel.map((x, i) => {
        const cur = S.ratingOf(x.run), cr = cur && rating(cur);
        return `<li>${cr ? S.ratingSvg(cur, 12) : ""} ${esc(label(x))}
          <span class="se-acts"><label class="sm-check"><input type="checkbox" data-rt-whole="${i}"${x.whole ? " checked" : ""}> Whole run</label>
          <button type="button" class="btn" data-su="rate-del" data-i="${i}" aria-label="Take it off the list">✕</button></span></li>`; }).join("")}</ul>` : ""}
      <fieldset class="sm-ratings"><legend>Rating</legend>${S.RATINGS.map(x => `<label class="sm-check"><input type="radio" name="sm-rating" value="${x.id}"${r.rating === x.id ? " checked" : ""}>
        ${S.ratingSvg(x.id)} ${esc(x.name)} <span class="hint">${esc(x.level)}</span></label>`).join("")}</fieldset>
      <div class="se-acts"><button type="button" class="btn primary" data-su="rate-go"${r.sel.length && !st.busy ? "" : " disabled"}>Apply the rating</button>
        <button type="button" class="btn" data-su="rate-stop">Cancel</button></div>
      <p class="hint">Runs that start from these lines move with them when they're rated lower. Removing a rating: rate it green.
        Each member sees the ratings their Site maps access allows.</p>`;
  }
  let rateHi = null;
  function highlight() {
    if (rateHi) { rateHi.remove(); rateHi = null; }
    if (!st.rate || !st.rate.sel.length || !S.geo) return;
    const segs = S.geo.segments.filter(s => st.rate.sel.some(x => x.run === s.run && (x.whole || s.index >= x.index)));
    rateHi = L.layerGroup(segs.map(s => L.polyline([S.ll(s.x0, s.y0), S.ll(s.x1, s.y1)], { color: "#e8590c", weight: 7, opacity: 0.5, interactive: false }))).addTo(S.map);
  }
  function startRate() {
    stopAlign();
    st.rate = { sel: [], rating: "blue" };
    S.setPicker(f => {
      if (f.kind !== "segment") { say("Tap a line, not a point.", "bad"); return renderSetup(); }
      const lay = f.layer && st.layers.find(l => l.id === f.layer);
      if (lay && !lay.rating) { say("That line is in another layer and can't be rated.", "bad"); return renderSetup(); }
      const have = st.rate.sel.findIndex(x => x.run === f.run);
      if (have >= 0) st.rate.sel.splice(have, 1);
      st.rate.sel.push({ run: f.run, index: f.index, whole: false });
      say(null); renderSetup(); highlight();
    });
  }
  function stopRate() { if (!st.rate) return; st.rate = null; S.setPicker(null); highlight(); }

  async function applyRating() {
    const target = st.rate.rating, byRating = {};
    st.layers.filter(l => l.rating).forEach(l => { byRating[l.rating] = l; });
    const order = R.ORDER;
    const src = { green: E.copy(S.data) };
    for (const id of order.slice(1)) src[id] = E.copy(Object.assign(EMPTY(), (byRating[id] && byRating[id].survey) || {}));
    const before = JSON.stringify(src);
    const others = st.layers.filter(l => l.kind === "survey" && !l.rating && l.survey).map(l => l.survey);
    const { moving } = R.rate(src, st.rate.sel, target, { runName: S.runName, origin: S.data.origin || "BAR", others });
    if (JSON.stringify(src) === before) { say("Those lines already have that rating.", ""); return; }
    // Save the rated layers first, so lines are never lost, then publish the main survey.
    const saved = [];
    try {
      for (const id of order.slice(1)) {
        const was = JSON.stringify(Object.assign(EMPTY(), (byRating[id] && byRating[id].survey) || {}));
        if (JSON.stringify(src[id]) === was && byRating[id]) continue;
        if (!byRating[id] && !Object.keys(src[id].runs).length) continue;
        const l = await ensureRatingLayer(id);
        const u = await C.client.from("site_map_layers").update({ survey: src[id] }).eq("id", l.id);
        if (u.error) throw u.error;
        saved.push({ id: l.id, survey: l.survey || EMPTY() });
      }
      const mainChanged = JSON.stringify(src.green.runs) !== JSON.stringify(S.data.runs) || JSON.stringify(src.green.plan) !== JSON.stringify(S.data.plan);
      if (mainChanged) {
        const names = [...moving].map(r => S.runName(r) || src[target].runNames[r] || r);
        const { data: v, error } = await C.client.rpc("publish_site_map", { site, new_data: src.green, expected_version: S.version,
          summary: `Rated ${names.length} run${names.length === 1 ? "" : "s"} ${rating(target).name.toLowerCase()}: ${names.join(", ")}`.slice(0, 2000), edit_id: null });
        if (error) throw error;
        S.setPublished(src.green, v, new Date().toISOString());
      }
    } catch (err) {
      for (const s0 of saved) await C.client.from("site_map_layers").update({ survey: s0.survey }).eq("id", s0.id);
      throw err;
    }
    say(`Rated ${moving.size} run${moving.size === 1 ? "" : "s"} ${rating(target).name.toLowerCase()}.`, "ok");
    stopRate();
    await loadLayers();
  }
  async function ensureRatingLayer(id) {
    const have = st.layers.find(l => l.rating === id);
    if (have) return have;
    const r = rating(id);
    const ins = await C.client.from("site_map_layers").insert({ site_id: site, name: `${r.name} · ${r.level}`, kind: "survey", rating: id, restricted: true,
      note: `${r.divers} and up`, sort: 100 + RANK[id], survey: EMPTY() }).select().single();
    if (ins.error) throw ins.error;
    st.layers.push(ins.data);
    return ins.data;
  }

  // ----- members' Site maps access levels (site_map_members; also in Records → Student accounts) -----
  function levelsCard() {
    if (!st.people) return `<p class="hint">Loading members…</p>`;
    if (!st.people.length) return `<p class="hint">No members found.</p>`;
    const admin = C.can("admin");
    const opts = cur => S.LEVELS.filter(l => admin || l.id !== "site-admin" || cur === "site-admin")
      .map(l => `<option value="${l.id}"${l.id === cur ? " selected" : ""}>${esc(l.label)}</option>`).join("");
    return `<p class="hint">Members see the lines for their level and every level below it. The survey team can also suggest changes, which an admin approves.
        Members with no access can't open the site maps.${admin ? "" : " Only Admins can make someone a Dive site admin."}</p>
      <ul class="sm-su-list">${st.people.map(p => `<li><b>${esc(p.full_name || "(no name)")}</b>
        <label><span class="sr-only">Site maps access for ${esc(p.full_name || "this member")}</span><select data-lvl="${esc(p.id)}"${p.level === "site-admin" && !admin ? " disabled" : ""}>${opts(p.level)}</select></label></li>`).join("")}</ul>`;
  }
  async function setLevel(uid, level) {
    const { error } = await C.client.rpc("set_site_map_level", { member: uid, new_level: level });
    if (error) throw error;
    await loadAccess();
  }

  // ----- who can see restricted layers -----
  function accessCard() {
    if (!st.people) return `<p class="hint">Loading members…</p>`;
    return st.layers.filter(l => l.restricted && !l.rating).map(l => {
      const ids = st.access[l.id] || [];
      const name = id => (st.people.find(p => p.id === id) || {}).full_name || "A member";
      return `<div class="sm-access"><h3>${esc(l.name)}</h3>${l.note ? `<p class="hint">${esc(l.note)}</p>` : ""}
        ${ids.length ? `<ul class="sm-su-list">${ids.map(id => `<li>${esc(name(id))} <button type="button" class="btn" data-su="ac-del" data-layer="${esc(l.id)}" data-user="${esc(id)}">Take away</button></li>`).join("")}</ul>`
          : `<p class="hint">Only Admins can see it so far.</p>`}
        <label>Give access to <select data-ac="${esc(l.id)}"><option value="">Choose a member…</option>${st.people.filter(p => !ids.includes(p.id))
          .map(p => `<option value="${esc(p.id)}">${esc(p.full_name || "(no name)")}</option>`).join("")}</select></label>
        <button type="button" class="btn primary" data-su="ac-add" data-layer="${esc(l.id)}">Give access</button></div>`;
    }).join("");
  }
  async function loadAccess() {
    const pics = st.layers.filter(l => l.restricted && !l.rating).map(l => l.id);
    const [p, a] = await Promise.all([
      C.client.rpc("site_map_people"),
      pics.length ? C.client.from("site_map_layer_access").select("layer_id, user_id").in("layer_id", pics) : Promise.resolve({ data: [] }),
    ]);
    st.people = p.error ? [] : p.data;
    st.access = {};
    if (!a.error) a.data.forEach(r => (st.access[r.layer_id] = st.access[r.layer_id] || []).push(r.user_id));
  }

  // ----- setup events -----
  setupBox.addEventListener("toggle", e => { const d = e.target.closest && e.target.closest("details[data-sec]"); if (d && d.isConnected) st.open[d.dataset.sec] = d.open; }, true);
  setupBox.addEventListener("change", e => {
    const el = e.target;
    if (el.id === "su-img-file") { st.imgFile = el.files[0] || null; return; }
    if (el.dataset.rtWhole) { st.rate.sel[Number(el.dataset.rtWhole)].whole = el.checked; renderSetup(); return highlight(); }
    if (el.name === "sm-rating") { st.rate.rating = el.value; return; }
    if (el.dataset.lvl) { el.disabled = true; setLevel(el.dataset.lvl, el.value).then(() => say("Saved.", "ok"), err => say(C.explain(err), "bad")).then(renderSetup); }
  });
  setupBox.addEventListener("input", e => {
    const el = e.target;
  });
  // A latitude and longitude pasted together into one box (e.g. from Google Maps) are split into both boxes.
  setupBox.addEventListener("change", e => {
    const el = e.target, g = el.dataset && el.dataset.g;
    if (g !== "lat" && g !== "lat2") return;
    const pair = G.parseLatLon(el.value);
    const lon = setupBox.querySelector(`[data-g="${g === "lat" ? "lon" : "lon2"}"]`);
    if (pair && lon) { el.value = pair[0]; lon.value = pair[1]; }
  });
  setupBox.addEventListener("click", async e => {
    const b = e.target.closest("[data-su]");
    if (!b) return;
    const act = b.dataset.su, id = b.dataset.id, layer = id && st.layers.find(l => l.id === id);
    const run = async fn => { st.busy = true; renderSetup(); try { await fn(); } catch (err) { say(C.explain ? C.explain(err) : err.message, "bad"); } st.busy = false; renderSetup(); };
    if (act === "open") { st.setupOpen = true; say(null); renderSetup(); await loadAccess(); renderSetup(); return; }
    if (act === "close") { stopAlign(); stopRate(); st.setupOpen = false; return renderSetup(); }
    if (act === "rate-start") { st.open.rate = true; startRate(); say(null); return renderSetup(); }
    if (act === "rate-stop") { stopRate(); say(null); return renderSetup(); }
    if (act === "rate-del") { st.rate.sel.splice(Number(b.dataset.i), 1); renderSetup(); return highlight(); }
    if (act === "rate-go") return run(applyRating);
    if (act === "place" || act === "unplace") return run(async () => {
      let gr = null;
      if (act === "place") {
        const v = k => (setupBox.querySelector(`[data-g="${k}"]`) || {}).value || "";
        const num = k => v(k).trim() === "" ? "" : Number(v(k).replace("−", "-"));
        // Latitude and longitude in any common format; both pasted into the latitude box works too.
        const point = (la, lo) => {
          const pair = !v(lo).trim() ? G.parseLatLon(v(la)) : null;
          return pair || [G.parseCoord(v(la), "lat"), G.parseCoord(v(lo), "lon")];
        };
        const FORMATS = "Any of these work: 44.3421 and -75.9165, 44.3421 N and 75.9165 W, 44° 20.526' N and 75° 54.990' W, or 44°20'31.6\"N 75°54'59.4\"W pasted from Google Maps.";
        const bad = (pt, which) => isNaN(pt[0]) ? `The ${which}latitude "${v(which ? "lat2" : "lat")}" couldn't be read.` : isNaN(pt[1]) ? `The ${which}longitude "${v(which ? "lon2" : "lon")}" couldn't be read.` : "";
        const p1 = point("lat", "lon");
        if (!v("lat").trim()) { say("Enter the landmark's latitude and longitude. " + FORMATS, "bad"); return; }
        if (bad(p1, "")) { say(bad(p1, "") + " " + FORMATS + " West longitudes are negative, or end in W.", "bad"); return; }
        if (p1[1] > 0 && !/[EW]/i.test(v("lat") + v("lon"))) { say(`Longitude ${p1[1]} is east of Greenwich. Sites in North America are west of it: make it negative (e.g. -75.9165) or end it in W.`, "bad"); return; }
        gr = { landmark: v("landmark"), lat: p1[0], lon: p1[1], declination: num("declination") || 0 };
        if (!(Math.abs(gr.declination) <= 40)) { say("The declination should be between -40 and 40 degrees (west is negative: about -12.8 at Alexandria Bay).", "bad"); return; }
        if (v("landmark2")) {
          const p2 = point("lat2", "lon2");
          if (!v("lat2").trim() || gr.landmark === v("landmark2")) { say("For a second point, pick a different landmark and enter its latitude and longitude, or set it to None.", "bad"); return; }
          if (bad(p2, "second point's ")) { say(bad(p2, "second point's ") + " " + FORMATS, "bad"); return; }
          Object.assign(gr, { landmark2: v("landmark2"), lat2: p2[0], lon2: p2[1] });
        }
      }
      const data = Object.assign({}, S.data);
      if (gr) data.georef = gr; else delete data.georef;
      const { data: ver, error } = await C.client.rpc("publish_site_map", { site, new_data: data, expected_version: S.version,
        summary: gr ? `Placed the map on the earth at ${S.name(gr.landmark)} (${gr.lat}, ${gr.lon}), declination ${gr.declination}°` : "Took the map off the earth", edit_id: null });
      if (error) throw error;
      S.setPublished(data, ver, new Date().toISOString());
      st.clearForms = true;
      pushLayers();
      say(`Published as version ${ver}.`, "ok");
    });
    if (act === "add-image") return run(async () => {
      const name = setupBox.querySelector("#su-img-name").value.trim(), file = setupBox.querySelector("#su-img-file").files[0] || st.imgFile;
      if (!name || !file) { say("Give the layer a name and choose the picture.", "bad"); return; }
      if (file.size > 25 * 1048576) { say("That picture is over 25 MB. Save it smaller and try again.", "bad"); return; }
      const ins = await C.client.from("site_map_layers").insert({ site_id: site, name, kind: "image", restricted: setupBox.querySelector("#su-img-restricted").checked,
        sort: st.layers.length, opacity: 0.7 }).select().single();
      if (ins.error) throw ins.error;
      const ext = (file.name.match(/\.(jpe?g|png|webp)$/i) || [".jpg"])[0].toLowerCase();
      const path = `${site}/${ins.data.id}/picture${ext}`;
      const up = await C.client.storage.from("site-map-layers").upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
      if (up.error) { await C.client.from("site_map_layers").delete().eq("id", ins.data.id); throw up.error; }
      const u = await C.client.from("site_map_layers").update({ image_path: path }).eq("id", ins.data.id);
      if (u.error) throw u.error;
      st.open.layers = true; st.clearForms = true; st.imgFile = null;
      await loadLayers();
      const l = st.layers.find(x => x.id === ins.data.id);
      if (l && l.imageUrl) await startAlign(l);
      say("Added. Now line it up: follow the steps under the layer.", "ok");
    });
    if (act === "ly-save" && layer) return run(async () => {
      const val = k => setupBox.querySelector(`[data-ly="${CSS.escape(id)}"][data-k="${k}"]`);
      const upd = { name: val("name").value.trim() || layer.name, note: val("note").value.trim(), restricted: val("restricted").checked };
      const { error } = await C.client.from("site_map_layers").update(upd).eq("id", id);
      if (error) throw error;
      await loadLayers(); if (upd.restricted) await loadAccess();
      say("Saved.", "ok");
    });
    if (act === "ly-up" && layer) return run(async () => {
      const i = st.layers.indexOf(layer), other = st.layers[i - 1];
      await C.client.from("site_map_layers").update({ sort: i - 1 }).eq("id", layer.id);
      await C.client.from("site_map_layers").update({ sort: i }).eq("id", other.id);
      await loadLayers();
    });
    if (act === "ly-del" && layer) {
      if (layer.kind === "survey" && layer.survey && Object.keys(layer.survey.runs || {}).length) { say("Move its lines back to the main survey first, so they aren't lost.", "bad"); return renderSetup(); }
      if (!confirm(`Delete the layer "${layer.name}"?`)) return;
      return run(async () => {
        const { error } = await C.client.from("site_map_layers").delete().eq("id", id);
        if (error) throw error;
        if (layer.image_path) await C.client.storage.from("site-map-layers").remove([layer.image_path]);
        if (st.align && st.align.id === id) stopAlign();
        await loadLayers(); say("Deleted.", "ok");
      });
    }
    if (act === "align" && layer) { stopRate(); if (st.align && st.align.id === id) stopAlign(); else { stopAlign(); await startAlign(layer); } say(null); return renderSetup(); }
    if (act === "al-restart") { st.align.step = 0; st.align.pts = [{}, {}]; say(null); return renderSetup(); }
    if (act === "al-edges") {
      const v = k => Number(((setupBox.querySelector(`[data-al="${k}"]`) || {}).value || "").replace("−", "-"));
      const bb = { north: v("north"), south: v("south"), west: v("west"), east: v("east") };
      if (!(bb.north > bb.south && bb.east > bb.west && Math.abs(bb.north) <= 90 && Math.abs(bb.west) <= 180)) { say("Enter all four edges in decimal degrees: north above south, east of west.", "bad"); return renderSetup(); }
      st.align.bounds = bb; say("Placed by its edges. Check it, then save.", "ok"); return pushLayers();
    }
    if (act === "al-save") return run(async () => {
      const { error } = await C.client.from("site_map_layers").update({ bounds: st.align.bounds }).eq("id", st.align.id);
      if (error) throw error;
      stopAlign(); await loadLayers(); say("Saved where the picture sits.", "ok");
    });
    if (act === "ac-add") return run(async () => {
      const sel = setupBox.querySelector(`[data-ac="${CSS.escape(b.dataset.layer)}"]`);
      if (!sel || !sel.value) { say("Choose a member first.", "bad"); return; }
      const { error } = await C.client.from("site_map_layer_access").insert({ layer_id: b.dataset.layer, user_id: sel.value });
      if (error) throw error;
      await loadAccess(); st.clearForms = true; say("Access given.", "ok");
    });
    if (act === "ac-del") return run(async () => {
      const { error } = await C.client.from("site_map_layer_access").delete().eq("layer_id", b.dataset.layer).eq("user_id", b.dataset.user);
      if (error) throw error;
      await loadAccess(); say("Access taken away.", "ok");
    });
    if (act === "ph-ok") return run(async () => {
      const { error } = await C.client.from("site_map_photos").update({ approved: true }).eq("id", id);
      if (error) throw error;
      await loadPhotos(); say("Approved: it now shows for everyone.", "ok");
    });
    if (act === "ph-del") { if (!confirm("Remove this photo?")) return; return run(() => removePhoto(id)); }
  });

  // ----- start -----
  render();
  if (cloud()) {
    const refresh = () => Promise.all([loadLayers(), loadPhotos()]).then(render).catch(e => console.warn("Layers not loaded:", e));
    (C.ready || Promise.resolve()).then(refresh);
    C.onChange(() => { if (!isAdmin()) st.setupOpen = false; refresh(); });
  }
  S.onPublished(() => render());
  S.adminListeners.push(() => { if (!isAdmin()) { st.setupOpen = false; stopRate(); stopAlign(); } render(); });
  S.onShown = () => { if (st.rate) highlight(); };
});
