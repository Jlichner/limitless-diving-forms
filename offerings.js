/* Limitless Diving — coaching and tours listings (the cards at the top of Available classes).
   They live in the Supabase table "offerings" (supabase/schema.sql). Anyone can read them; Instructors and
   Admins edit them in the staff app under Settings → Coaching and tours listings (renderAdmin below).
   Students ask for one on Request a class, where each listing acts like a course with id "offer-<id>".
   Until the table exists (schema.sql not re-run yet) the pages fall back to DEFAULTS.
   window.LDOfferings = { DEFAULTS, load, asCourse, isOffer, renderAdmin } */
(function () {
  "use strict";

  const DEFAULTS = [
    { id: "coaching", name: "Coaching sessions", tag: "With an instructor", price: "", calType: "event", active: true,
      about: "Buoyancy, trim and propulsion are the foundations of all diving. In these sessions you work one on one or in a small group with an instructor to hone those skills, or any other skill you choose." },
    { id: "hydra", name: "Lake Hydra tours", tag: "Led by a divemaster", price: "", calType: "tour", active: true,
      about: "Day-long tours of Lake Hydra with a divemaster. The adventure is yours: dive as little or as much as you like for the day. Got a scooter? Bring it along! Every Limitless divemaster is DPV certified, so we can zip around the lake right beside you and turn your day into a high-speed adventure. (Bring your own DPV; we don't provide them.)" }
  ];
  const PREFIX = "offer-";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
  // Descriptions saved online before a starter description changed: show the new starter wording instead.
  const OLD_ABOUT = { coaching: "Work one on one or in a small group with an instructor to hone the skill of your choice.",
    hydra: "Day-long tours of Lake Hydra with a divemaster. The adventure is yours: dive as little or as much as you like for the day." };
  function about(r) {
    const d = DEFAULTS.find(x => x.id === r.id);
    return d && OLD_ABOUT[r.id] && String(r.about || "").trim() === OLD_ABOUT[r.id] ? d.about : r.about || "";
  }
  function fromRow(r) {
    return { id: r.id, name: r.name || "", tag: r.tag || "", about: about(r), price: r.price || "",
      calType: r.cal_type || "event", active: r.active !== false, sort: Number(r.sort) || 0 };
  }
  function copy(list) { return JSON.parse(JSON.stringify(list)); }

  // All listings, in order. Public pages pass activeOnly. Falls back to DEFAULTS when the table isn't there.
  let cache = null;
  function load(activeOnly) {
    if (!cache) {
      const cfg = window.LD_SUPABASE || {}, key = String(cfg.key || "").trim();
      let url = ""; try { const x = new URL(String(cfg.url || "").trim()); if (x.protocol === "https:") url = x.origin; } catch (e) { /* none */ }
      cache = (!url || key.length < 20 ? Promise.reject(new Error("not set up"))
        : fetch(url + "/rest/v1/offerings?select=*&order=sort.asc,name.asc", { headers: { apikey: key }, cache: "no-store" })
          .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }))
        .then(rows => Array.isArray(rows) ? rows.map(fromRow) : copy(DEFAULTS))
        .catch(() => copy(DEFAULTS));
    }
    return cache.then(list => activeOnly ? list.filter(o => o.active) : list);
  }

  // A listing shaped like a catalog course, for the Request a class page.
  function asCourse(o) {
    return { id: PREFIX + o.id, app: PREFIX + o.id, name: o.name, fullName: o.name, about: o.about, price: o.price,
      agency: "Coaching and tours", std: null, offer: o };
  }
  function isOffer(id) { return String(id || "").indexOf(PREFIX) === 0; }

  /* ---------- staff editor (Settings) ---------- */

  const ed = { list: null, err: "", note: "", noteKind: "", busy: false, fresh: false, removed: [] };
  const C = () => window.LDCloud;
  function canEdit() { return !!(C() && C().user && C().can && C().can("instructor")); }
  function calTypes() {
    const t = window.LDCalendar && window.LDCalendar.types ? window.LDCalendar.types().filter(x => !x.course) : [];
    return t.length ? t : [{ id: "event", name: "Event" }, { id: "tour", name: "Tour" }];
  }

  async function edLoad() {
    ed.err = ""; ed.removed = [];
    if (!C() || !C().available || !C().client) { ed.err = "Online logins aren't set up, so listings can't be saved yet."; ed.list = copy(DEFAULTS); redraw(); return; }
    const { data, error } = await C().client.from("offerings").select("*").order("sort").order("name");
    if (error) {
      ed.list = copy(DEFAULTS);
      ed.err = /offerings|PGRST205|schema cache|does not exist/i.test(error.message || "")
        ? "The listings table isn't in your database yet. Run the updated supabase/schema.sql in the Supabase SQL editor, then reload this page."
        : C().explain(error);
    } else {
      ed.fresh = !data.length;
      ed.list = data.length ? data.map(fromRow) : [];
    }
    redraw();
  }

  function card(o, i, n, types) {
    const typeOpts = types.map(t => `<option value="${esc(t.id)}"${t.id === o.calType ? " selected" : ""}>${esc(t.name)}</option>`).join("")
      + (types.some(t => t.id === o.calType) ? "" : `<option value="${esc(o.calType)}" selected>${esc(o.calType)}</option>`);
    const f = (k, label, extra) => `<div class="field${extra || ""}"><label for="of-${k}-${i}">${label}</label>`;
    return `<div class="of-card${o.active ? "" : " off"}">
      <div class="grid">
        ${f("name", "Name")}<input id="of-name-${i}" data-of="name" data-i="${i}" maxlength="120" value="${esc(o.name)}"></div>
        ${f("tag", "Small label above the name")}<input id="of-tag-${i}" data-of="tag" data-i="${i}" maxlength="80" value="${esc(o.tag)}" placeholder="e.g. With an instructor"></div>
        ${f("about", "Description", " wide")}<textarea id="of-about-${i}" data-of="about" data-i="${i}" maxlength="1000">${esc(o.about)}</textarea></div>
        ${f("price", "Price (optional)")}<input id="of-price-${i}" data-of="price" data-i="${i}" maxlength="80" value="${esc(o.price)}" placeholder="e.g. $150 per session"></div>
        ${f("cal", "When scheduled, goes on the calendar as")}<select id="of-cal-${i}" data-of="calType" data-i="${i}">${typeOpts}</select></div>
      </div>
      <div class="row-actions"><label class="chk"><input type="checkbox" data-of="active" data-i="${i}"${o.active ? " checked" : ""}> Show on Available classes</label>
        <button class="btn small" data-ofact="up" data-i="${i}" aria-label="Move ${esc(o.name)} up"${i ? "" : " disabled"}>↑</button>
        <button class="btn small" data-ofact="down" data-i="${i}" aria-label="Move ${esc(o.name)} down"${i < n - 1 ? "" : " disabled"}>↓</button>
        <button class="btn small danger" data-ofact="rm" data-i="${i}">Remove</button></div>
    </div>`;
  }

  function renderAdmin() {
    if (ed.list === null && !ed.busy) { ed.busy = true; edLoad().finally(() => { ed.busy = false; }); }
    const list = ed.list, edit = canEdit(), types = calTypes();
    const body = list === null ? `<p class="hint">Loading listings…</p>`
      : `${ed.err ? `<p class="acct-note bad" role="alert">${esc(ed.err)}</p>` : ""}
        ${ed.fresh && !ed.err ? `<p class="acct-note">No listings saved yet. Add some, or <button class="btn small" data-ofact="defaults">start with Coaching sessions and Lake Hydra tours</button>.</p>` : ""}
        <div class="of-list">${list.map((o, i) => card(o, i, list.length, types)).join("")}</div>
        ${edit ? `<div class="row-actions"><button class="btn" data-ofact="add">+ Add a listing</button>
          <button class="btn primary" data-ofact="save"${C() && C().client ? "" : " disabled"}>Save listings</button></div>`
          : `<p class="hint">Log in as an Instructor or Admin to change these.</p>`}
        ${ed.note ? `<p class="acct-note ${ed.noteKind}" role="status">${esc(ed.note)}</p>` : ""}`;
    return `<section class="of-admin" id="of-admin"><h2 class="sec">Coaching and tours listings</h2>
      <p class="hint">The cards at the top of Available classes. Students ask for one with its <b>Request</b> button, on the Request a class page, and you answer it like a class request. Saving updates the public page straight away.</p>
      ${body}</section>`;
  }
  function redraw() { const box = document.getElementById("of-admin"); if (box) box.outerHTML = renderAdmin(); }

  function slug(name, taken) {
    let base = String(name || "listing").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "listing", id = base, n = 2;
    while (taken.includes(id)) id = base + "-" + n++;
    return id;
  }

  async function save() {
    const list = ed.list || [];
    const bad = list.findIndex(o => !o.name.trim());
    if (bad >= 0) { ed.note = "Every listing needs a name."; ed.noteKind = "bad"; redraw(); return; }
    ed.note = "Saving…"; ed.noteKind = ""; redraw();
    const now = new Date().toISOString();
    const rows = list.map((o, i) => ({ id: o.id, name: o.name.trim().slice(0, 120), tag: o.tag.trim().slice(0, 80), about: o.about.trim().slice(0, 1000),
      price: o.price.trim().slice(0, 80), cal_type: o.calType || "event", active: !!o.active, sort: i, updated_at: now }));
    const sb = C().client;
    if (ed.removed.length) {
      const del = await sb.from("offerings").delete().in("id", ed.removed);
      if (del.error) { ed.note = "Not saved: " + C().explain(del.error); ed.noteKind = "bad"; redraw(); return; }
    }
    if (rows.length) {
      const up = await sb.from("offerings").upsert(rows);
      if (up.error) { ed.note = "Not saved: " + C().explain(up.error); ed.noteKind = "bad"; redraw(); return; }
    }
    ed.removed = []; ed.fresh = false; cache = null;
    ed.note = "Saved. Available classes and Request a class now show these listings."; ed.noteKind = "ok"; redraw();
  }

  document.addEventListener("input", (e) => {
    const el = e.target; if (!el.dataset || !el.dataset.of || !ed.list) return;
    const o = ed.list[Number(el.dataset.i)]; if (!o) return;
    if (el.dataset.of === "active") { o.active = el.checked; el.closest(".of-card").classList.toggle("off", !o.active); }
    else o[el.dataset.of] = el.value;
    ed.note = "";
  });
  document.addEventListener("change", (e) => {
    const el = e.target; if (el.dataset && el.dataset.of === "calType" && ed.list) { const o = ed.list[Number(el.dataset.i)]; if (o) o.calType = el.value; }
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ofact]"); if (!b || !ed.list) return;
    const i = Number(b.dataset.i), L = ed.list, act = b.dataset.ofact;
    if (act === "save") { save(); return; }
    if (act === "add") L.push({ id: slug("new listing", L.map(o => o.id).concat(ed.removed)), name: "", tag: "", about: "", price: "", calType: "event", active: true });
    else if (act === "defaults") { copy(DEFAULTS).forEach(d => { if (!L.some(o => o.id === d.id)) L.push(d); }); ed.fresh = false; }
    else if (act === "up" && i > 0) L.splice(i - 1, 0, L.splice(i, 1)[0]);
    else if (act === "down" && i < L.length - 1) L.splice(i + 1, 0, L.splice(i, 1)[0]);
    else if (act === "rm") {
      const o = L[i]; if (!o) return;
      if (!window.confirm(`Remove "${o.name || "this listing"}"? It disappears from Available classes when you save. To hide it for a while instead, untick Show on Available classes.`)) return;
      L.splice(i, 1); ed.removed.push(o.id);
    } else return;
    ed.note = act === "add" || act === "defaults" ? "" : "Not saved yet. Press Save listings."; ed.noteKind = "";
    redraw();
    if (act === "add") { const el = document.getElementById("of-name-" + (L.length - 1)); if (el) el.focus(); }
  });
  if (window.LDCloud && window.LDCloud.onChange) window.LDCloud.onChange(() => { ed.list = null; ed.note = ""; redraw(); });

  window.LDOfferings = { DEFAULTS, load, asCourse, isOffer, renderAdmin };
})();
