/* Limitless Diving — public "Available classes" page. Lists every course in the catalog (catalog.js) with a
   short description, and opens a detail view for each one (#course=<id>) with the standards from the NAUI
   manual, the next scheduled dates from the class calendar, and a link to the agency's own site. */
(function () {
  "use strict";

  const G = window.LDCalGrid, esc = G.esc, CAT = window.LDCatalog;
  const main = document.getElementById("pub");
  let data = { classes: [], contact: {} };

  // Groups on the list, in order. A course goes in the first group whose test it passes.
  const START = ["naui-intro", "naui-tandem", "naui-sas", "naui-skin", "naui-scuba-diver", "naui-hookah", "naui-adaptive",
    "open-water", "naui-experienced", "naui-refresher"];
  const CORE = ["naui-aow", "rescue", "naui-master", "naui-nitrox"];
  const GROUPS = [
    { title: "Start diving", about: "No certification needed for most of these.", test: c => START.includes(c.id) },
    { title: "Keep going", about: "The core path after Open Water.", test: c => CORE.includes(c.id) },
    { title: "Specialties", about: "Focus on one kind of diving.", test: c => c.agency === "NAUI" && !c.leadership },
    { title: "Technical diving", about: "Beyond recreational limits, with NAUI Technical and TDI.", test: c => c.agency !== "NAUI" },
    { title: "Leadership", about: "Become a dive professional.", test: c => c.leadership }
  ];

  function safeEmail(e) { return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(e || "") ? e : ""; }
  function telHref(p) { const d = String(p || "").replace(/[^\d+]/g, ""); return d.length >= 7 ? "tel:" + d : ""; }
  function upcoming(c) { return data.classes.filter(k => k.course === c.app || k.course === c.id); }
  function askHref(c) {
    const ct = data.contact || {}, email = safeEmail(ct.email);
    return email ? `mailto:${email}?subject=${encodeURIComponent("Course: " + c.fullName)}` : telHref(ct.phone);
  }
  function dives(s) {
    if (s.dives == null) return s.divesNote || "";
    return s.dives + " open water dive" + (s.dives === 1 ? "" : "s") + (s.divesNote ? ". " + s.divesNote : "");
  }

  function ageChip(s) {
    const a = s && String(s.age || ""), n = a && /^(\d+)/.exec(a);
    return n ? `<span>Age ${n[1]}+</span>` : /no minimum/i.test(a || "") ? "<span>Any age</span>" : "";
  }
  function card(c) {
    const s = c.std, next = upcoming(c)[0];
    return `<a class="pub-card course-card" href="#course=${esc(c.id)}">
      <span class="eyebrow">${esc(c.agency)}</span>
      <h3>${esc(c.name)}</h3>
      ${c.about ? `<p>${esc(c.about)}</p>` : ""}
      <span class="facts">${ageChip(s)}${next ? `<span class="soon">Next: ${esc(G.range(next.dates) || "dates soon")}</span>` : ""}</span>
      <span class="more">Course details ›</span>
    </a>`;
  }

  function list() {
    const left = CAT.COURSES.slice(), sections = [];
    GROUPS.forEach(g => {
      const order = (c) => { const i = START.concat(CORE).indexOf(c.id); return i < 0 ? 999 : i; };
      const mine = left.filter(g.test).sort((a, b) => order(a) - order(b));  // stable: catalog order otherwise
      mine.forEach(c => left.splice(left.indexOf(c), 1));
      if (mine.length) sections.push(`<section aria-labelledby="g-${sections.length}"><div class="course-group"><h2 id="g-${sections.length}">${esc(g.title)}</h2><p>${esc(g.about)}</p></div>
        <div class="pub-list">${mine.map(card).join("")}</div></section>`);
    });
    main.innerHTML = `<section class="pub-hero"><h1>Available classes</h1>
        <p>Every course Limitless Diving teaches. Open one to see what it covers, what you need to start, and when it runs next.</p></section>
      ${specials()}${sections.join("")}${foot()}`;
  }

  // Coaching and tours, shown at the top of the list. They aren't certification courses, so they have no
  // detail page: each card links to ask about it, and tours to the class calendar for scheduled dates.
  const SPECIALS = [
    { id: "coaching", icon: "◎", name: "Coaching sessions", fullName: "Coaching session", ask: "Ask about coaching", tag: "With an instructor",
      about: "Work one on one or in a small group with an instructor to hone the skill of your choice." },
    { id: "hydra", icon: "≈", name: "Lake Hydra tours", fullName: "Lake Hydra tour", ask: "Ask about a tour", tag: "Led by a divemaster",
      about: "Day-long tours of Lake Hydra with a divemaster. The adventure is yours: dive as little or as much as you like for the day.",
      cal: true }
  ];
  function specials() {
    return `<section aria-labelledby="g-specials"><div class="course-group"><h2 id="g-specials">Coaching and tours</h2>
        <p>Not a certification course? Sharpen a skill with an instructor, or spend a day exploring with a divemaster.</p></div>
      <div class="pub-list special-list">${SPECIALS.map(c => { const ask = askHref(c); return `<div class="pub-card course-card special-card" id="special-${c.id}">
        <span class="eyebrow">${esc(c.tag)}</span><h3><span class="special-icon" aria-hidden="true">${c.icon}</span>${esc(c.name)}</h3><p>${esc(c.about)}</p>
        <div class="course-actions">${ask ? `<a class="btn primary" href="${esc(ask)}">${esc(c.ask)}</a>` : ""}${c.cal ? `<a class="btn" href="classes.html">Tour dates</a>` : ""}</div>
      </div>`; }).join("")}</div></section>`;
  }

  function detail(c) {
    const s = c.std, ask = askHref(c), site = CAT.AGENCY_SITES[c.agency], dates = upcoming(c);
    const facts = s ? `<dl class="course-facts">
        ${s.age ? `<dt>Minimum age</dt><dd>${esc(s.age)}</dd>` : ""}
        ${s.prereqs && s.prereqs.length ? `<dt>To start</dt><dd><ul>${s.prereqs.map(p => `<li>${esc(p)}</li>`).join("")}</ul></dd>` : ""}
        ${dives(s) ? `<dt>Dives</dt><dd>${esc(dives(s))}</dd>` : ""}
        ${s.depth ? `<dt>Max depth</dt><dd>${esc(s.depth)}</dd>` : ""}
      </dl>${s.page ? `<p class="src">From the 2026 NAUI Standards and Policies Manual, page ${esc(String(s.page))}.</p>` : ""}`
      : `<p>Ask us about prerequisites, dives and depth limits for this course.</p>`;
    main.innerHTML = `<p><a class="back" href="#">‹ All available classes</a></p>
      <section class="pub-hero"><span class="eyebrow">${esc(c.agency)}${c.leadership ? " · Leadership" : ""}</span><h1>${esc(c.name)}</h1>
        ${c.about ? `<p>${esc(c.about)}</p>` : ""}${c.cert !== c.name ? `<p>Certification: ${esc(c.cert)}</p>` : ""}</section>
      <section class="panel course-detail" aria-label="Course standards"><h2>What you need</h2>${facts}</section>
      <section class="panel course-detail" aria-label="Scheduled classes"><h2>Scheduled classes</h2>
        ${dates.length ? `<ul class="course-dates">${dates.map(k => `<li><a href="classes.html#class-${esc(k.id)}">${esc(k.title || c.name)}</a> <span>${esc(G.range(k.dates) || "Dates to be announced")}</span>${k.seatsLeft === 0 ? " <em>(full, waitlist)</em>" : ""}</li>`).join("")}</ul>`
          : `<p>No dates are set yet. Get in touch and we'll plan it with you.</p>`}
        <div class="course-actions"><a class="btn primary" href="request.html?course=${encodeURIComponent(c.id)}">Request this course</a>
          ${ask ? `<a class="btn" href="${esc(ask)}">Ask a question</a>` : ""}
          ${site ? `<a class="btn" href="${esc(site)}" target="_blank" rel="noopener">More from ${esc(c.agency.split(" ")[0])} ↗</a>` : ""}</div></section>
      ${foot()}`;
    window.scrollTo(0, 0);
  }

  function foot() {
    const ct = data.contact || {}, email = safeEmail(ct.email), tel = telHref(ct.phone);
    const contact = [ct.instructor ? esc(ct.instructor) : "", email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : "", tel ? `<a href="${esc(tel)}">${esc(ct.phone)}</a>` : ""].filter(Boolean).join(" · ");
    return contact ? `<footer class="pub-foot">Questions? ${contact}.</footer>` : "";
  }

  function route() {
    const m = /^#course=([\w-]+)$/.exec(location.hash), c = m && CAT.find(m[1]);
    if (c) { document.title = c.name + " · Limitless Diving"; detail(c); }
    else { document.title = "Limitless Diving Available Classes"; list(); }
  }
  window.addEventListener("hashchange", route);

  // Upcoming classes and contact details: the online calendar if it's set up, otherwise classes.json.
  async function fromSupabase() {
    const cfg = window.LD_SUPABASE || {}, url = (function (u) { try { const x = new URL(String(u || "").trim()); return x.protocol === "https:" ? x.origin : ""; } catch (e) { return ""; } })(cfg.url), key = String(cfg.key || "").trim();
    if (!url || key.length < 20) return null;
    const get = (path) => fetch(url + "/rest/v1/" + path, { headers: { apikey: key }, cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
    const [settings, rows] = await Promise.all([get("calendar_settings?id=eq.1&select=*"), get("classes?select=*")]);
    const s = settings && settings[0];
    if (!s) return null;
    return { contact: { instructor: s.instructor, phone: s.phone, email: s.email },
      classes: (rows || []).map(k => ({ id: k.id, course: k.course, title: k.title, dates: k.dates, seatsLeft: k.seats_left })) };
  }
  function fromFile() { return fetch("classes.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null); }

  route();  // show the courses right away; dates and contact fill in when they load
  fromSupabase().catch(() => null).then(d => d || fromFile()).catch(() => null).then(d => {
    if (!d || typeof d !== "object") return;
    const t = G.today();
    data.contact = d.contact || {};
    data.classes = (Array.isArray(d.classes) ? d.classes : [])
      .map(k => Object.assign({}, k, { dates: (Array.isArray(k.dates) ? k.dates : []).filter(x => G.parse(x)).sort() }))
      .filter(k => k.dates.length && G.lastDate(k.dates) >= t)
      .sort((a, b) => G.firstDate(a.dates).localeCompare(G.firstDate(b.dates)));
    route();
  });
})();
