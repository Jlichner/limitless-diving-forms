/* Limitless Diving — a page for one Coaching and tours listing (offering.html?id=coaching, ?id=hydra…).
   The left menu's Coaching sessions and Lake Hydra tours, and each card on Available classes, open it.
   It shows the listing (offerings.js: name, label, description, price, edited in staff Settings →
   Coaching and tours listings) and a Request button for days that suit you (request.html). Upcoming
   calendar dates can be shown too (SHOW_DATES), each linking to its event page (event.html). */
(function () {
  "use strict";

  const G = window.LDCalGrid, esc = G.esc, O = window.LDOfferings;
  const main = document.getElementById("off");
  const id = new URLSearchParams(location.search).get("id") || "";
  let offer = null, entries = null, contact = {};

  function safeEmail(e) { return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(e || "") ? e : ""; }
  function color(k) { return /^k\d$/.test(k.color || "") ? k.color : "k0"; }
  // Calendar entries for this listing: those whose title names it ("Lake Hydra tour – Dec 5" matches
  // "Lake Hydra tours"), which includes everything scheduled from a request for it.
  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); }
  function matches(k) {
    const t = norm(k.title), n = norm(offer.name), stem = n.replace(/s$/, "");
    return !!t && !!stem && (t.includes(stem) || n.includes(t));
  }

  // Coaching is private, one on one or a small group, so its page has no public dates: just "Schedule your session".
  // Jamie asked (2026-11-14) for no public dates on these pages: each is scheduled on request. Set true to bring
  // back the "Upcoming dates" list of matching calendar entries.
  const SHOW_DATES = false;
  // Photos for each listing (photos/ folder): a banner at the top and a strip under the request box.
  const PHOTOS = {
    coaching: { hero: ["david-trim", "Diver holding perfect trim in open water", "50% 42%"],
      strip: [["trim-wetsuit", "Diver gliding in trim over a lake bottom"], ["bubble-ring", "Bubble ring rising past a diver"],
        ["trim-deck", "Diver with doubles in flat trim over a sunken wooden deck"]] },
    hydra: { hero: ["dpv-wreck", "Diver on a scooter lighting up an underwater structure", "50% 45%"],
      strip: [["scooters-dock", "Three DPV scooters lined up on a dock by the lake"], ["dpv-line", "Diver on a scooter following a line over the lake bottom"],
        ["dpv-square", "Diver on a scooter heading toward the camera"]] }
  };
  function photoHero(ph) {
    return ph && ph.hero ? `<img class="photo-hero" src="photos/${ph.hero[0]}.webp" alt="${esc(ph.hero[1])}" style="object-position:${ph.hero[2] || "50% 50%"}">` : "";
  }
  function photoStrip(ph) {
    return ph && ph.strip ? `<div class="photo-strip">${ph.strip.map(x => `<img src="photos/${x[0]}.webp" alt="${esc(x[1])}" loading="lazy">`).join("")}</div>` : "";
  }
  function isPrivate() { return /coach/i.test(offer.id + " " + offer.name); }

  function render() {
    if (!offer) {
      main.innerHTML = `<div class="msg"><h1>This listing isn't available</h1><p>See everything we offer on <a href="available-classes.html">Available classes</a>.</p></div>`;
      return;
    }
    document.title = offer.name + " · Limitless Diving";
    const email = safeEmail(contact.email);
    const ask = email ? `mailto:${email}?subject=${encodeURIComponent(offer.name)}` : "";
    const list = entries == null ? `<p class="hint">Loading dates…</p>`
      : entries.length ? `<ul class="off-dates">${entries.map(k => `<li><a class="off-date ${color(k)}" href="event.html?id=${encodeURIComponent(k.id)}">
          <i class="cal-dot ${color(k)}" aria-hidden="true"></i><span><b>${esc(k.title)}</b>
          <span class="when">${esc(G.range(k.dates) || "Dates to be announced")}${k.location ? " · " + esc(k.location) : ""}</span></span>
          <span class="more">${k.seatsLeft === 0 ? "Full" : "Details and join ›"}</span></a></li>`).join("")}</ul>`
      : `<p>Nothing is on the calendar right now. Ask for a day that works for you and we'll set it up.</p>`;
    const ph = PHOTOS[offer.id];
    main.innerHTML = `<p><a class="back" href="available-classes.html">‹ Available classes</a></p>
      ${photoHero(ph)}<section class="pub-hero off-hero">${offer.tag ? `<span class="eyebrow">${esc(offer.tag)}</span>` : ""}<h1>${esc(offer.name)}</h1>
        ${offer.about ? `<p>${esc(offer.about)}</p>` : ""}${offer.price ? `<p class="off-price">${esc(offer.price)}</p>` : ""}</section>
      ${SHOW_DATES ? `<section class="panel evt-act"><h2 class="sec">Upcoming dates</h2>${list}</section>` : ""}
      <section class="panel evt-act"><h2 class="sec">${isPrivate() ? "Schedule your session" : "Schedule your adventure"}</h2>
        <p>${isPrivate() ? "Pick the days that suit you and tell us what you'd like to work on. We'll confirm the details with you." : "Pick the days that suit you and we'll confirm the details with you."}</p>
        <div class="row-actions"><a class="btn primary" href="request.html?course=offer-${encodeURIComponent(offer.id)}">${isPrivate() ? "Request a session" : "Request a day"}</a>
          ${ask ? `<a class="btn" href="${esc(ask)}">Ask a question</a>` : ""}</div></section>
      ${photoStrip(ph)}`;
  }

  async function loadCalendar() {
    const C = window.LDCloud;
    let rows = null;
    try {
      if (C && C.configured) {
        const get = (path) => fetch(C.url + "/rest/v1/" + path, { headers: { apikey: C.key }, cache: "no-store" }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
        const [s, list] = await Promise.all([get("calendar_settings?id=eq.1&select=*"), get("classes?select=*")]);
        if (s && s[0]) {
          contact = { email: s[0].email, phone: s[0].phone };
          rows = (list || []).map(k => ({ id: k.id, title: k.title || k.course_name, color: k.color, dates: k.dates, location: k.location, seatsLeft: k.seats_left, course: k.course }));
        }
      }
    } catch (e) { console.warn("Online calendar not available:", e); }
    if (!rows) {
      try { const r = await fetch("classes.json", { cache: "no-store" }); const d = r.ok ? await r.json() : {}; contact = d.contact || {}; rows = Array.isArray(d.classes) ? d.classes : []; }
      catch (e) { rows = []; }
    }
    const t = G.today();
    entries = rows.map(k => Object.assign({}, k, { dates: (Array.isArray(k.dates) ? k.dates : []).filter(x => G.parse(x)).sort() }))
      .filter(k => !k.course && (!k.dates.length || G.lastDate(k.dates) >= t) && matches(k))
      .sort((a, b) => (G.firstDate(a.dates) || "9999").localeCompare(G.firstDate(b.dates) || "9999"));
    render();
  }

  const nav = document.getElementById("pubnav");
  if (nav && window.LDCloud && window.LDCloud.configured) nav.hidden = false;
  if (!O) { render(); return; }
  O.load(true).then(list => {
    offer = list.find(o => o.id === id) || null;
    render();
    if (offer) loadCalendar();  // also brings the contact email for Ask a question
  });
})();
