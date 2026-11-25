/* Limitless Diving — layers, landmark photos and map setup for a site map (e.g. bonnie-castle-map.html).
   - Layers panel: turn each layer on or off and fade it with a slider: the satellite pictures (once the map is
     placed on the earth), picture layers such as a topographic map, the main survey lines, and the rated layers.
     A member only gets the rated layers their Site maps access level allows (the database enforces it).
   - Landmark photos (members see approved ones and add their own; Admins approve).
   - Map setup (Admins and Dive site admins): place the map on the earth, add and line up picture layers,
     rate lines ski-style (green circle on the main survey; blue square, black diamond and double black diamond
     each in a layer of their own), and approve photos. Members' Site maps access is set in Records → Student accounts.
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
  const VIEW = "ld-sitemap-view2-" + site;
  const cloud = () => !!(C && C.available);
  const isAdmin = () => S.isSiteAdmin();   // Admins and Dive site admins
  const RANK = { green: 0, blue: 1, black: 2, "double-black": 3 };
  const rating = id => S.RATINGS.find(r => r.id === id);
  const EMPTY = () => ({ runs: {}, plan: [], landmarks: {}, runNames: {} });
  const st = { layers: [], loadErr: null, photos: [], urls: {}, setupOpen: false, msg: null, busy: false,
    people: null, access: {}, align: null, rate: null, open: {} };

  // ----- loading -----
  S.reloadLayers = () => loadLayers();
  async function loadLayers() {
    if (!cloud()) return;
    const { data, error } = await C.client.from("site_map_layers").select("*").eq("site_id", site).order("sort").order("created_at");
    if (error) { st.loadErr = /site_map_layers|does not exist|schema cache/i.test(error.message || "") ? "setup" : C.explain(error); st.layers = []; }
    else {
      st.loadErr = null;
      const paths = data.filter(l => l.kind === "image" && l.image_path).map(l => l.image_path);
      const urls = await signed("site-map-layers", paths);
      st.layers = data.map(l => Object.assign({}, l, { imageUrl: urls[l.image_path] || null }));
      if (isAdmin()) await pictureSizes();
    }
    pushLayers();
  }
  // Admins see how big each stored picture is (big pictures use up the Supabase bandwidth allowance fast).
  async function pictureSizes() {
    for (const l of st.layers) {
      if (l.kind !== "image" || !l.image_path) continue;
      const i = l.image_path.lastIndexOf("/");
      try {
        const { data } = await C.client.storage.from("site-map-layers").list(l.image_path.slice(0, i), { search: l.image_path.slice(i + 1) });
        const f = (data || []).find(x => x.name === l.image_path.slice(i + 1));
        if (f && f.metadata && f.metadata.size) l.bytes = f.metadata.size;
      } catch (e) { /* size is only a hint */ }
    }
  }
  const mb = n => (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + " MB";
  const BIG = 3 * 1048576, MAX_PX = 5000;
  // Picture layers: at most 5000 px on the long side (enough for a 200 dpi Tabloid print), as a JPEG (or WebP for
  // PNG/WebP pictures, which may have see-through parts). Returns the original file if that is already smaller.
  function shrinkPicture(file) {
    return new Promise(resolve => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const k = Math.min(1, MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
        if (k === 1 && file.size <= BIG) return resolve(file);
        const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const alpha = /png|webp/i.test(file.type);
        c.toBlob(b => resolve(b && b.size < file.size && (!alpha || /webp/.test(b.type)) ? b : file), alpha ? "image/webp" : "image/jpeg", 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  async function signed(bucket, paths) {
    if (!paths.length) return {};
    if (C.signedUrls) return C.signedUrls(bucket, paths);
    const { data, error } = await C.client.storage.from(bucket).createSignedUrls(paths, 6 * 3600);
    if (error || !data) return {};
    const out = {};
    data.forEach(r => { if (r.signedUrl) out[r.path] = r.signedUrl; });
    return out;
  }
  function pushLayers() {
    for (const l of st.layers) if (l.kind === "image" && !startedOff.has(l.id)) {
      startedOff.add(l.id); S.view[l.id] = Object.assign({ opacity: l.opacity == null ? 1 : Number(l.opacity) }, S.view[l.id], { visible: false });
    }
    const al = st.align;
    S.setLayers(st.layers.map(l => Object.assign({}, l, al && al.id === l.id
      ? { bounds: al.bounds, onImage: img => { al.overlay = img; } } : {})));
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
  // Every visit starts with the satellite and picture layers switched off (Jamie 2026-11-25); how see-through
  // they were set is remembered, and the survey line layers keep their saved on/off.
  const savedView = loadView();
  Object.assign(S.view, savedView);
  S.setLayerView("satellite", { visible: false, opacity: (savedView.satellite && savedView.satellite.opacity) || 1 });
  const startedOff = new Set();

  function rows() {
    const out = [];
    if (S.geoRef()) out.push({ id: "satellite", name: "Satellite pictures", hint: "Esri World Imagery" });
    for (const l of st.layers.filter(l => l.kind === "image")) out.push({ id: l.id, name: l.name, restricted: l.restricted, note: l.note,
      hint: !l.imageUrl ? "Picture not added yet" : !l.bounds ? "Not lined up yet" : l.bounds.north != null && !S.geoRef() ? "Shows once the map is placed on the earth" : "" });
    out.push({ id: "survey", name: "Open water", rating: "green", hint: "The main survey: green circle lines, for every member with site maps access" });
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
    const up = await C.client.storage.from("site-map-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: C.CACHE_SECONDS || "3600" });
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
  // ----- drag and turn the whole survey into place over the satellite -----
  // One landmark (e.g. the Bike Rack) is pinned at a spot on the earth and the survey is turned around it.
  function moveBox() {
    const m = st.move;
    if (!m) return `<div class="sm-move"><p class="hint">Or move it by hand: drag a landmark to where it really is on the satellite, and turn the whole survey around it.</p>
      <button type="button" class="btn" data-su="move"${st.busy ? " disabled" : ""}>Drag and turn it into place</button></div>`;
    const t = n => `<button type="button" class="btn" data-su="turn" data-d="${n}">${n > 0 ? "⟳" : "⟲"} ${Math.abs(n)}°</button>`;
    return `<div class="sm-move on"><p><b>Drag the orange pin</b> to where <b>${esc(S.name(m.landmark))}</b> really is on the satellite. The whole survey moves with it.</p>
      <label>Pin on <select data-mv="landmark">${landmarkOptions(m.landmark)}</select></label>
      <p>Turn the survey around the pin:</p>
      <div class="sm-align-row">${t(-5)}${t(-1)}${t(-0.2)}<b>${m.declination.toFixed(1)}°</b>${t(0.2)}${t(1)}${t(5)}</div>
      ${m.twoPoint ? `<p class="hint">Saving this uses one pin, so the second landmark's position is dropped and lengths are drawn as measured.</p>` : ""}
      <div class="se-acts"><button type="button" class="btn primary" data-su="move-save"${st.busy ? " disabled" : ""}>Save and publish</button>
        <button type="button" class="btn" data-su="move-cancel">Cancel</button></div></div>`;
  }
  function moveGr() { const m = st.move; return { landmark: m.landmark, lat: m.lat, lon: m.lon, declination: Math.round(m.declination * 100) / 100 }; }
  function movePin() {
    const m = st.move; if (!m) return;
    if (m.pin) m.pin.remove();
    m.pin = L.marker([m.lat, m.lon], { draggable: true, zIndexOffset: 2000, title: S.name(m.landmark), icon: L.divIcon({ className: "sm-move-pin", iconSize: [22, 22] }) }).addTo(S.map);
    m.pin.on("dragend", () => { const p = m.pin.getLatLng(); m.lat = +p.lat.toFixed(7); m.lon = +p.lng.toFixed(7); movePreview(); });
  }
  function movePreview() { S.previewPlace(moveGr()); movePin(); }
  // Where a landmark is on the earth right now (with the trial placement, while moving).
  function landmarkLatLng(code) {
    const g = S.geoRef(), at = G.compute(S.combine(S.data).data).at[code];
    return g && at ? g.toLatLng(at[0], at[1]) : null;
  }
  function startMove() {
    const g = S.geoRef(), gr = S.data.georef || {};
    const code = gr.landmark || S.data.origin || "BAR", ll = landmarkLatLng(code);
    if (!g || !ll) { say("Place the map on the earth first.", "bad"); return; }
    st.move = { landmark: code, lat: +ll[0].toFixed(7), lon: +ll[1].toFixed(7), declination: g.turn, twoPoint: !!gr.landmark2 };
    S.setLayerView("satellite", { visible: true }); render();
    movePreview();
  }
  function stopMove(keep) {
    const m = st.move; if (!m) return;
    if (m.pin) m.pin.remove();
    st.move = null;
    if (!keep) S.previewPlace(null);
  }

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

      ${versionCard()}
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
          ${S.data.georef ? `<button type="button" class="btn" data-su="unplace"${st.busy ? " disabled" : ""}>Take it off the earth</button>` : ""}</div>
        ${g ? moveBox() : ""}</details>

      <details class="sm-su"${st.open.layers ? " open" : ""} data-sec="layers"><summary>Layers (${st.layers.length})</summary>
        ${st.layers.length ? `<ul class="sm-su-list">${st.layers.map((l, i) => layerRow(l, i)).join("")}</ul>` : `<p class="hint">No layers yet.</p>`}
        <h3>Add a picture layer</h3>
        <p class="hint">For example a topographic map. JPEG, PNG or WebP up to 25 MB. After it's added, line it up on the map.</p>
        <div class="sm-form"><label>Name <input id="su-img-name" maxlength="120" placeholder="Topographic map"></label>
          <label>Picture <input id="su-img-file" type="file" accept="image/jpeg,image/png,image/webp">${st.imgFile ? `<span>Chosen: ${esc(st.imgFile.name)}</span>` : ""}</label>
          <label class="sm-check"><input id="su-img-restricted" type="checkbox"> Restricted</label></div>
        <button type="button" class="btn primary" data-su="add-image"${st.busy ? " disabled" : ""}>Add picture layer</button>
</details>

      <details class="sm-su"${st.open.rate ? " open" : ""} data-sec="rate"><summary>Rate lines and points (green circle to double black diamond)</summary>${rateCard()}</details>

      <p class="hint">Who sees which lines: each member's <b>Site maps access</b> is set in Records → Student accounts${C.can("admin") ? ` (<a href="index.html">open it</a>, then <b>Site maps access</b> under the list of registered students)` : ", by an Admin"}.</p>

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
      <span class="hint">${l.kind === "image" ? "Picture" + (l.bytes ? ` · ${mb(l.bytes)}` : "") : `Survey lines: ${Object.keys((l.survey && l.survey.runs) || {}).length} runs`}${l.kind === "image" && !l.bounds ? " · not lined up yet" : ""}${l.bytes > BIG ? " · big: every member who turns it on downloads it, so make it smaller" : ""}</span>
      <div class="se-acts"><button type="button" class="btn" data-su="ly-save" data-id="${esc(l.id)}">Save</button>
        ${i > 0 ? `<button type="button" class="btn" data-su="ly-up" data-id="${esc(l.id)}" aria-label="Move ${esc(l.name)} up">↑</button>` : ""}
        ${l.kind === "image" && l.imageUrl ? `<button type="button" class="btn" data-su="align" data-id="${esc(l.id)}">${al ? "Stop lining up" : "Line it up"}</button>` : ""}
        ${l.kind === "image" && l.imageUrl && l.bytes > BIG ? `<button type="button" class="btn" data-su="ly-shrink" data-id="${esc(l.id)}">Make it smaller</button>` : ""}
        <button type="button" class="btn danger" data-su="ly-del" data-id="${esc(l.id)}">Delete</button></div>
      ${al ? alignCard(l) : ""}</li>`;
  }

  // Version names: every publish adds one to the last number (2.0.1, 2.0.2…); this starts the next minor version.
  function versionCard() {
    if (!S.version) return "";
    const m = /^(\d+)\.(\d+)\.\d+$/.exec(S.label || ""), next = m ? `${m[1]}.${+m[2] + 1}.0` : null;
    return `<div class="se-card sm-version"><p><b>Version ${esc(S.versionName())}</b> is on the map now. Each publish adds one to the last number.</p>
      ${next ? `<button type="button" class="btn" data-su="minor"${st.busy ? " disabled" : ""}>Start version ${next}</button>
        <span class="hint">Publishes the map as it is now as ${next}; the next changes are ${m[1]}.${+m[2] + 1}.1 and so on.</span>`
        : `<p class="hint">Run the latest <code>supabase/schema.sql</code> in Supabase to start the version names at 2.0.1.</p>`}</div>`;
  }

  // ----- lining up a picture -----
  // The picture is shown see-through over the satellite pictures (or the survey lines, before the map is placed on
  // the earth) with three handles: drag the middle to move it, the round handle at its top to turn it, and the
  // corner to make it bigger or smaller. The math is in Leaflet's projected plane (true to shape on the satellite).
  const Z = 18;
  function alignCard(l) {
    const a = st.align, g = S.geoRef(), deg = Math.round(a.ang * 1800 / Math.PI) / 10, pct = Math.round((S.view[l.id] || {}).opacity * 100 || 60);
    const nudge = (k, d, label) => `<button type="button" class="btn small" data-su="al-${k}" data-d="${d}">${label}</button>`;
    return `<div class="se-card sm-align"><span class="eyebrow">Line up ${esc(l.name)}</span>
      <p>${g ? "Line the picture up with the satellite pictures under it" : "Line the picture up with the survey lines under it (place the map on the earth first to line it up with the satellite instead)"}:
        drag the <b>✥</b> in the middle to move it, the round <b>⟳</b> handle at its top to turn it, and the <b>⤡</b> corner to make it bigger or smaller.
        Zoom in to fine-tune, or use the buttons.</p>
      <div class="sm-align-row"><span>Turn <output>${deg > 0 ? "+" : ""}${deg}°</output></span>
        ${nudge("turn", -5, "↺ 5°")}${nudge("turn", -1, "↺ 1°")}${nudge("turn", -0.2, "↺ 0.2°")}${nudge("turn", 0.2, "↻ 0.2°")}${nudge("turn", 1, "↻ 1°")}${nudge("turn", 5, "↻ 5°")}</div>
      <div class="sm-align-row"><span>Size</span>${nudge("size", 0.9, "Smaller")}${nudge("size", 0.99, "A little smaller")}${nudge("size", 1.01, "A little bigger")}${nudge("size", 1.1, "Bigger")}</div>
      <div class="sm-align-row"><span>Move</span>${nudge("move", "0,-1", "↑")}${nudge("move", "0,1", "↓")}${nudge("move", "-1,0", "←")}${nudge("move", "1,0", "→")}</div>
      <label class="sm-slider sm-align-row"><span>See-through</span><input type="range" min="10" max="100" step="5" value="${pct}" data-lo="${esc(l.id)}"><output>${pct}%</output></label>
      ${pointsCard(a, g)}
      <div class="se-acts"><button type="button" class="btn primary" data-su="al-save">Save where it sits</button>
        <button type="button" class="btn" data-su="al-reset">Start again in the middle of the view</button></div></div>`;
  }
  // Match points: tap a spot on the satellite, then the same spot on the picture, two or more times; the picture is
  // moved, turned and sized to fit them best (least squares), and each pair shows how far off it still is.
  function pointsCard(a, g) {
    const pts = a.pts || [], n = pts.length;
    const unit = g ? "ft" : "ft on the survey";
    return `<div class="sm-align-pts"><b>Match points</b>
      <p class="hint">Pick a spot you can see on both, like a dock corner or a point of land. Tap it on the ${g ? "satellite" : "survey lines"} first, then on your picture.
        After two pairs the picture lines itself up; four or more spread far apart is best.</p>
      ${a.pick ? `<p class="se-pick">Point ${n + 1}: tap the spot on the ${a.pick === "sat" ? (g ? "satellite (the picture is faded)" : "survey lines") : "picture"}.</p>
          <button type="button" class="btn small" data-su="al-pt-cancel">Cancel this point</button>`
        : `<button type="button" class="btn small" data-su="al-pt-add">${n ? "Add another point" : "Match a point"}</button>`}
      ${n ? `<ol class="sm-pts">${pts.map((q, i) => `<li>${q.off == null ? "" : `${q.off < 10 ? q.off.toFixed(1) : Math.round(q.off)} ${unit} off`}${q.off != null && n > 2 && q.off === Math.max(...pts.map(x => x.off || 0)) && q.off > 2 * (pts.reduce((t, x) => t + (x.off || 0), 0) / n) ? " <b>(check this one)</b>" : ""}
          <button type="button" class="btn small" data-su="al-pt-del" data-i="${i}">Remove</button></li>`).join("")}</ol>` : ""}</div>`;
  }
  // Where a spot on the picture (pixels from its middle) sits on the map now, in projected points.
  function picToMap(a, q) {
    const k = 2 * a.hw / a.W, c = Math.cos(a.ang), s = Math.sin(a.ang);
    return L.point(a.P.x + k * (q[0] * c - q[1] * s), a.P.y + k * (q[0] * s + q[1] * c));
  }
  function mapToPic(a, p) {
    const k = a.W / (2 * a.hw), c = Math.cos(a.ang), s = Math.sin(a.ang), dx = p.x - a.P.x, dy = p.y - a.P.y;
    return [k * (dx * c + dy * s), k * (-dx * s + dy * c)];
  }
  // Best fit of move + turn + size (complex least squares: z = A·w + B).
  function fitPoints(a) {
    const pts = a.pts; if (pts.length < 2) return;
    const n = pts.length, wx = pts.reduce((t, q) => t + q.pic[0], 0) / n, wy = pts.reduce((t, q) => t + q.pic[1], 0) / n;
    const zx = pts.reduce((t, q) => t + q.sat.x, 0) / n, zy = pts.reduce((t, q) => t + q.sat.y, 0) / n;
    let nr = 0, ni = 0, d = 0;
    for (const q of pts) {
      const ux = q.pic[0] - wx, uy = q.pic[1] - wy, vx = q.sat.x - zx, vy = q.sat.y - zy;
      nr += vx * ux + vy * uy; ni += vy * ux - vx * uy; d += ux * ux + uy * uy;
    }
    if (d < 1e-9) return;
    const ar = nr / d, ai = ni / d;
    a.ang = Math.atan2(ai, ar); a.hw = Math.hypot(ar, ai) * a.W / 2;
    a.P = L.point(zx - (ar * wx - ai * wy), zy - (ar * wy + ai * wx));
  }
  function pointOffsets(a) {
    const ft = (p1, p2) => S.map.distance(U(p1), U(p2)) * (S.geoRef() ? 3.28084 : 1);
    (a.pts || []).forEach(q => { q.off = a.pts.length >= 2 ? ft(q.sat, picToMap(a, q.pic)) : null; });
  }
  function drawPoints(a) {
    (a.ptMarks || []).forEach(m => m.remove()); a.ptMarks = [];
    const mark = (p, color, i) => L.circleMarker(U(p), { pane: "sm-align-pane", radius: 7, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1, interactive: false })
      .bindTooltip(String(i + 1), { permanent: true, direction: "right", className: "sm-pt-tip" }).addTo(S.map);
    (a.pts || []).forEach((q, i) => { a.ptMarks.push(mark(q.sat, "#1c7ed6", i), mark(picToMap(a, q.pic), "#e8590c", i)); });
    if (a.pend) a.ptMarks.push(mark(a.pend, "#1c7ed6", (a.pts || []).length));
  }
  function setPointPick(a, pick) {
    a.pick = pick;
    S.map.getContainer().classList.toggle("sm-pt-picking", !!pick);
    if (pick === "sat") { a.keepOpacity = (S.view[a.id] || {}).opacity; S.setLayerView(a.id, { opacity: 0.2 }); }
    if (pick === "pic") S.setLayerView(a.id, { opacity: 0.9 });
    if (!pick && a.keepOpacity != null) { S.setLayerView(a.id, { opacity: a.keepOpacity }); a.keepOpacity = null; }
  }
  function onPointTap(e) {
    const a = st.align; if (!a || !a.pick) return;
    const p = P(e.latlng);
    if (a.pick === "sat") { a.pend = p; setPointPick(a, "pic"); }
    else {
      (a.pts = a.pts || []).push({ sat: a.pend, pic: mapToPic(a, p) }); a.pend = null; setPointPick(a, null);
      fitPoints(a); placeAlign();
    }
    drawPoints(a); renderSetup();
  }
  const P = ll => S.map.project(ll, Z), U = p => S.map.unproject(p, Z);
  function alignCorners(a) {
    const hh = a.hw * a.H / a.W, c = Math.cos(a.ang), s = Math.sin(a.ang);
    const at = (dx, dy) => U(L.point(a.P.x + dx * c - dy * s, a.P.y + dx * s + dy * c));
    return { tl: at(-a.hw, -hh), tr: at(a.hw, -hh), bl: at(-a.hw, hh), br: at(a.hw, hh), top: at(0, -hh), mid: U(a.P) };
  }
  function alignSaved(a) {
    const k = alignCorners(a);
    a.bounds = { corners: [k.tl, k.tr, k.bl].map(x => [x.lat, x.lng]), geo: !!S.geoRef() };
    return k;
  }
  function alignFromView(a) {
    const vb = S.map.getBounds(), w = P(vb.getNorthEast()).x - P(vb.getSouthWest()).x;
    a.P = P(S.map.getCenter()); a.hw = Math.max(w * 0.33, 1); a.ang = 0;
  }
  function placeAlign() {
    const a = st.align; if (!a) return;
    const k = alignSaved(a);
    if (a.overlay) a.overlay.setCorners([k.tl, k.tr, k.bl]);
    const m = a.handles;
    if (m) { if (a.dragging !== "move") m.move.setLatLng(k.mid); if (a.dragging !== "turn") m.turn.setLatLng(k.top); if (a.dragging !== "size") m.size.setLatLng(k.br); m.frame.setLatLngs([k.tl, k.tr, k.br, k.bl]); }
    if (a.pts && a.pts.length) { pointOffsets(a); if (a.ptMarks) a.ptMarks.forEach((m, i) => { if (i % 2 === 1 && a.pts[(i - 1) / 2]) m.setLatLng(U(picToMap(a, a.pts[(i - 1) / 2].pic))); }); }
    const out = setupBox.querySelector(".sm-align output");
    if (out) { const d = Math.round(a.ang * 1800 / Math.PI) / 10; out.textContent = (d > 0 ? "+" : "") + d + "°"; }
  }
  function handle(kind, html) {
    const mk = L.marker([0, 0], { draggable: true, pane: "sm-align-pane", keyboard: true, title: { move: "Drag to move the picture", turn: "Drag to turn the picture", size: "Drag to make the picture bigger or smaller" }[kind],
      icon: L.divIcon({ className: "sm-al-h sm-al-" + kind, iconSize: [30, 30], html }) });
    mk.on("dragstart", () => { st.align.dragging = kind; });
    mk.on("drag", e => {
      const a = st.align, p = P(e.target.getLatLng());
      if (kind === "move") a.P = p;
      if (kind === "turn") a.ang = Math.atan2(p.y - a.P.y, p.x - a.P.x) + Math.PI / 2;
      if (kind === "size") a.hw = Math.max(1, Math.hypot(p.x - a.P.x, p.y - a.P.y) / Math.hypot(1, a.H / a.W));
      placeAlign();
    });
    mk.on("dragend", () => { st.align.dragging = null; placeAlign(); });
    return mk;
  }
  async function startAlign(l) {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.onerror = r; img.src = l.imageUrl; });
    const a = { id: l.id, W: img.naturalWidth || 1000, H: img.naturalHeight || 1000, bounds: l.bounds };
    const cs = S.imageCorners(l.bounds);
    if (cs) {
      const [tl, tr, bl] = cs.map(P);
      a.P = L.point((tr.x + bl.x) / 2, (tr.y + bl.y) / 2); a.hw = Math.hypot(tr.x - tl.x, tr.y - tl.y) / 2; a.ang = Math.atan2(tr.y - tl.y, tr.x - tl.x);
    } else alignFromView(a);
    st.align = a;
    if (!S.map.getPane("sm-align-pane")) S.map.createPane("sm-align-pane").style.zIndex = 650;
    a.handles = { frame: L.polygon([[0, 0], [0, 0], [0, 0]], { pane: "sm-align-pane", color: "#e8590c", weight: 2, dashArray: "6 4", fill: false, interactive: false }),
      move: handle("move", "✥"), turn: handle("turn", "⟳"), size: handle("size", "⤡") };
    Object.values(a.handles).forEach(h => h.addTo(S.map));
    a.pts = []; a.map = S.map; S.map.on("click", onPointTap);
    S.setLayerView(l.id, { visible: true, opacity: Math.min((S.view[l.id] || {}).opacity || 0.6, 0.6) });
    if (S.geoRef()) S.setLayerView("satellite", { visible: true });
    alignSaved(a);
    pushLayers();
    placeAlign();
  }
  function stopAlign() {
    if (!st.align) return;
    Object.values(st.align.handles || {}).forEach(h => h.remove());
    (st.align.ptMarks || []).forEach(m => m.remove());
    if (st.align.pick) setPointPick(st.align, null);
    if (st.align.map) st.align.map.off("click", onPointTap);
    st.align = null;
    pushLayers();
  }

  // ----- rating lines -----
  // Admins tap lines on the map; each pick is the whole run or the run from that line on. Applying a rating
  // moves the lines (and any run that starts from them and is rated lower) into that rating's layer, or back
  // onto the main survey for green.
  function rateCard() {
    const r = st.rate;
    if (!r) return `<p class="hint">Every line on the main survey is a green circle and every diver sees it. Rate a line blue, black or double black
        and it moves into that rating's layer, which only divers you've given that rating (or higher) can see.</p>
      <button type="button" class="btn primary" data-su="rate-start">Pick lines or points on the map</button>`;
    const label = sel => { const d = S.shown, e = d.runs[sel.run] || [], n = e.slice(0, sel.index + 1).filter(x => E.LINE.test(x.type)).length;
      if (sel.point) return `The point ${S.name(sel.point)}`;
      return `${S.runName(sel.run)}: ${sel.whole ? "the whole run" : `from line ${n} to the end`}`; };
    return `<p class="se-pick">Tap the lines (or points you added on the map) to rate. ${r.sel.length ? "" : "Nothing picked yet."}</p>
      ${r.sel.length ? `<ul class="sm-su-list">${r.sel.map((x, i) => {
        const cur = S.ratingOf(x.run), cr = cur && rating(cur);
        return `<li>${cr ? S.ratingSvg(cur, 12) : ""} ${esc(label(x))}
          <span class="se-acts">${x.point ? "" : `<label class="sm-check"><input type="checkbox" data-rt-whole="${i}"${x.whole ? " checked" : ""}> Whole run</label>`}
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
    const pts = S.geo.landmarks.filter(l => st.rate.sel.some(x => x.point && x.point === l.landmark));
    rateHi = L.layerGroup(segs.map(s => L.polyline([S.ll(s.x0, s.y0), S.ll(s.x1, s.y1)], { color: "#e8590c", weight: 7, opacity: 0.5, interactive: false }))
      .concat(pts.map(p => L.circleMarker(S.ll(p.x, p.y), { radius: 14, color: "#e8590c", weight: 4, opacity: 0.6, fill: false, interactive: false })))).addTo(S.map);
  }
  function startRate() {
    stopAlign();
    st.rate = { sel: [], rating: "blue" };
    S.setPicker(f => {
      // A point placed on its own (Edit map → Add a point on the map) is rated like a run: the whole of it.
      const pointRun = f.kind === "landmark" && f.run && isPointRun(f.run);
      if (f.kind !== "segment" && !pointRun) { say(f.kind === "landmark" && f.run ? "That point is on a line: tap the line to rate it, and the point goes with it." : "Tap a line, or a point you added on the map.", "bad"); return renderSetup(); }
      const lay = f.layer && st.layers.find(l => l.id === f.layer);
      if (lay && !lay.rating) { say("That line is in another layer and can't be rated.", "bad"); return renderSetup(); }
      const have = st.rate.sel.findIndex(x => x.run === f.run);
      if (have >= 0) st.rate.sel.splice(have, 1);
      st.rate.sel.push(pointRun ? { run: f.run, index: 0, whole: true, point: f.landmark } : { run: f.run, index: f.index, whole: false });
      say(null); renderSetup(); highlight();
    });
  }
  // A run with no drawn lines (a hidden jump to a point): rating it rates the point.
  function isPointRun(run) { const e = (S.shown && S.shown.runs[run]) || []; return e.length > 0 && !e.some(x => E.LINE.test(x.type)) && e.some(x => x.type === "SaveLandmark"); }
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
        G.stampGeoref(src.green, R.merge(order.map(id => src[id]).concat(others)));
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
  // Adds a layer row. The id is made here and the row read back separately, rather than asking the insert to
  // return it: a returning insert also has to pass the read rules for a row that's still being added, which
  // older versions of schema.sql refused ("new row violates row-level security policy").
  async function addLayerRow(row) {
    const id = (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
    const ins = await C.client.from("site_map_layers").insert(Object.assign({ id }, row));
    if (ins.error) return ins;
    const got = await C.client.from("site_map_layers").select("*").eq("id", id).maybeSingle();
    return got.error ? got : { data: got.data || Object.assign({ id }, row), error: null };
  }
  async function ensureRatingLayer(id) {
    const have = st.layers.find(l => l.rating === id);
    if (have) return have;
    const r = rating(id);
    const ins = await addLayerRow({ site_id: site, name: `${r.name} · ${r.level}`, kind: "survey", rating: id, restricted: true,
      note: `${r.divers} and up`, sort: 100 + RANK[id], survey: EMPTY() });
    if (ins.error) throw ins.error;
    st.layers.push(ins.data);
    return ins.data;
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
  });
  setupBox.addEventListener("input", e => {
    const el = e.target;
    if (el.dataset.lo) {   // the see-through slider while lining up a picture
      S.setLayerView(el.dataset.lo, { opacity: Number(el.value) / 100 });
      const out = el.parentElement.querySelector("output"); if (out) out.textContent = el.value + "%";
      saveView();
    }
  });
  // A latitude and longitude pasted together into one box (e.g. from Google Maps) are split into both boxes.
  setupBox.addEventListener("change", e => {
    const el = e.target, g = el.dataset && el.dataset.g;
    if (g !== "lat" && g !== "lat2") return;
    const pair = G.parseLatLon(el.value);
    const lon = setupBox.querySelector(`[data-g="${g === "lat" ? "lon" : "lon2"}"]`);
    if (pair && lon) { el.value = pair[0]; lon.value = pair[1]; }
  });
  async function publishPlace(gr) {
    const data = Object.assign({}, S.data);
    if (gr) { data.georef = gr; G.stampGeoref(data, Object.assign({}, S.combine(S.data).data, { georef: gr })); } else delete data.georef;
    const { data: ver, error } = await C.client.rpc("publish_site_map", { site, new_data: data, expected_version: S.version,
      summary: gr ? `Placed the map on the earth at ${S.name(gr.landmark)} (${gr.lat}, ${gr.lon}), declination ${gr.declination}°` : "Took the map off the earth", edit_id: null });
    if (error) throw error;
    S.setPublished(data, ver, new Date().toISOString());
    st.clearForms = true;
    pushLayers();
    say(`Published as version ${S.versionName()}.`, "ok");
  }
  setupBox.addEventListener("change", e => {
    const el = e.target;
    if (el.dataset.mv !== "landmark" || !st.move) return;
    const ll = landmarkLatLng(el.value); if (!ll) return;
    Object.assign(st.move, { landmark: el.value, lat: +ll[0].toFixed(7), lon: +ll[1].toFixed(7) });
    movePreview(); renderSetup();
  });
  setupBox.addEventListener("click", async e => {
    const b = e.target.closest("[data-su]");
    if (!b) return;
    const act = b.dataset.su, id = b.dataset.id, layer = id && st.layers.find(l => l.id === id);
    const run = async fn => { st.busy = true; renderSetup(); try { await fn(); } catch (err) { say(C.explain ? C.explain(err) : err.message, "bad"); } st.busy = false; renderSetup(); };
    if (act === "open") { st.setupOpen = true; say(null); renderSetup(); await loadAccess(); renderSetup(); return; }
    if (act === "close") { stopAlign(); stopRate(); stopMove(); st.setupOpen = false; return renderSetup(); }
    if (act === "move") { say(null); startMove(); return renderSetup(); }
    if (act === "move-cancel") { stopMove(); say(null); return renderSetup(); }
    if (act === "turn" && st.move) { st.move.declination = ((st.move.declination + Number(b.dataset.d) + 540) % 360) - 180; movePreview(); return renderSetup(); }
    if (act === "minor") return run(async () => {
      const { data: nl, error } = await C.client.rpc("site_map_next_minor", { site, expected_version: S.version });
      if (error) throw error;
      S.setPublished(S.data, S.version + 1, new Date().toISOString(), nl);
      say(`Started version ${nl}.`, "ok");
    });
    if (act === "move-save" && st.move) return run(async () => { await publishPlace(moveGr()); stopMove(true); });
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
      await publishPlace(gr);
    });
    if (act === "add-image") return run(async () => {
      const name = setupBox.querySelector("#su-img-name").value.trim(), file = setupBox.querySelector("#su-img-file").files[0] || st.imgFile;
      if (!name || !file) { say("Give the layer a name and choose the picture.", "bad"); return; }
      if (file.size > 25 * 1048576) { say("That picture is over 25 MB. Save it smaller and try again.", "bad"); return; }
      const ins = await addLayerRow({ site_id: site, name, kind: "image", restricted: setupBox.querySelector("#su-img-restricted").checked,
        sort: st.layers.length, opacity: 0.7 });
      if (ins.error) throw ins.error;
      say("Making the picture smaller for the web…"); renderSetup();
      const pic = await shrinkPicture(file);
      const ext = pic === file ? (file.name.match(/\.(jpe?g|png|webp)$/i) || [".jpg"])[0].toLowerCase() : /webp/.test(pic.type) ? ".webp" : ".jpg";
      const path = `${site}/${ins.data.id}/picture${ext}`;
      const up = await C.client.storage.from("site-map-layers").upload(path, pic, { contentType: pic.type || "image/jpeg", upsert: true, cacheControl: C.CACHE_SECONDS || "3600" });
      if (up.error) { await C.client.from("site_map_layers").delete().eq("id", ins.data.id); throw up.error; }
      const u = await C.client.from("site_map_layers").update({ image_path: path }).eq("id", ins.data.id);
      if (u.error) throw u.error;
      st.open.layers = true; st.clearForms = true; st.imgFile = null;
      await loadLayers();
      const l = st.layers.find(x => x.id === ins.data.id);
      if (l && l.imageUrl) await startAlign(l);
      say("Added. Now line it up: drag the handles on the map, then save.", "ok");
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
    if (act === "ly-shrink" && layer) return run(async () => {
      say("Making the picture smaller…"); renderSetup();
      const res = await fetch(layer.imageUrl, { mode: "cors", cache: "no-store" });
      if (!res.ok) throw new Error("The picture couldn't be loaded.");
      const file = await res.blob(), pic = await shrinkPicture(file);
      if (pic === file) { say("That picture can't be made any smaller here.", "bad"); return; }
      // Same file name, so the layer keeps its place on the map; the old big copy is replaced.
      const up = await C.client.storage.from("site-map-layers").upload(layer.image_path, pic, { contentType: pic.type || "image/jpeg", upsert: true, cacheControl: C.CACHE_SECONDS || "3600" });
      if (up.error) throw up.error;
      if (C.forgetSignedUrls) C.forgetSignedUrls("site-map-layers", [layer.image_path]);
      await loadLayers();
      say(`Done: ${mb(file.size)} → ${mb(pic.size)}. It stays lined up where it was.`, "ok");
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
    if (act === "al-turn" && st.align) { st.align.ang += Number(b.dataset.d) * Math.PI / 180; return placeAlign(); }
    if (act === "al-size" && st.align) { st.align.hw *= Number(b.dataset.d); return placeAlign(); }
    if (act === "al-move" && st.align) {
      // A nudge of a few screen pixels, whatever the zoom.
      const [dx, dy] = b.dataset.d.split(",").map(Number), f = Math.pow(2, Z - S.map.getZoom()) * 4;
      st.align.P = st.align.P.add(L.point(dx * f, dy * f)); return placeAlign();
    }
    if (act === "al-pt-add" && st.align) { setPointPick(st.align, "sat"); return renderSetup(); }
    if (act === "al-pt-cancel" && st.align) { st.align.pend = null; setPointPick(st.align, null); drawPoints(st.align); return renderSetup(); }
    if (act === "al-pt-del" && st.align) { st.align.pts.splice(Number(b.dataset.i), 1); fitPoints(st.align); placeAlign(); drawPoints(st.align); return renderSetup(); }
    if (act === "al-reset" && st.align) { alignFromView(st.align); return placeAlign(); }
    if (act === "al-save") return run(async () => {
      const { error } = await C.client.from("site_map_layers").update({ bounds: st.align.bounds }).eq("id", st.align.id);
      if (error) throw error;
      stopAlign(); await loadLayers(); say("Saved where the picture sits. Fade it with its slider under Layers.", "ok");
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
  S.reloadLayers = loadLayers;
  S.adminListeners.push(() => { if (!isAdmin()) { st.setupOpen = false; stopRate(); stopAlign(); } render(); });
  S.onShown = () => { if (st.rate) highlight(); };
});
