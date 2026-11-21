/* Limitless Diving — the home (landing) page: who we are and what we do.
   Drawn into index.html by app.js when the mode is "home" (the default).
   window.LDHome = { render }

   EDIT THE WORDING in the TEXT block below. Keep it consistent with core-values.html.
   Photos come from photos/ (file name without .webp). */
(function () {
  "use strict";

  // ============================================================
  // TEXT. Change any wording here.
  // ============================================================
  const TEXT = {
    eyebrow: "Limitless Diving & Technical Training",
    title: "Dive training for divers who want to excel.",
    motto: "Submersio · per artem et disciplinam",
    mottoNote: "Into the water, through skill and discipline.",
    lead: "Every class is taught to the highest standards, with your progression in mind. From your first breath underwater to your first exploration dive, we train you for where you're headed, not just for the next card.",

    whoTitle: "Who we are",
    who: [
      ["Explorers with a thirst for adventure", "We dive because there is always something new beyond the next bend, the next wreck or the next drop-off. That curiosity is what we want to share with every student."],
      ["Highly trained to exacting standards", "Our instructors and divemasters keep training, keep diving and hold themselves to the same exacting standards they teach. Every Limitless divemaster is DPV certified."]
    ],

    beliefsTitle: "What we believe",
    beliefsLead: "These beliefs shape every class we teach, from the pool to the deepest dive.",
    beliefs: [
      ["compass", "Train from the start with the end goal in mind", "Good habits learned on day one are the ones that carry you into advanced and technical diving. We teach every skill the way you'll use it later, so nothing has to be unlearned."],
      ["level", "Buoyancy, trim and effective propulsion", "These are the foundation of all diving progression. Hover still, stay level and move with purpose, and everything else gets easier, safer and more fun."],
      ["shield", "Safety first", "Never cut corners at the expense of safety. Sound training, good judgment, experience and a strong team keep every dive within your ability."],
      ["leaf", "Protect our aquatic resources", "We advocate for the preservation of our precious aquatic resources. It's skill, not equipment, that protects fragile places: a diver in control does the least possible harm."]
    ],

    pathTitle: "Training with progression in mind",
    pathLead: "Each step builds on the one before it, so you're always ready for the next.",
    path: [
      ["Foundations", "Buoyancy, trim and propulsion from your very first class."],
      ["Certification", "Open Water and beyond, taught to the highest standards."],
      ["Experience", "Specialties, coaching sessions and dives that build real skill."],
      ["Leadership & technical", "Rescue, divemaster and technical training for divers ready to go further."]
    ],

    doTitle: "What we do",
    do: [
      ["available-classes.html", "Classes", "NAUI and TDI training, from Open Water through technical diving.", "See available classes"],
      ["classes.html", "Class calendar", "Upcoming classes, events, explorations and tours.", "Open the calendar"],
      ["offering.html?id=coaching", "Coaching sessions", "One on one or small group time with an instructor to hone buoyancy, trim and propulsion, or any skill you choose.", "Schedule a session"],
      ["offering.html?id=hydra", "Lake Hydra tours", "Day-long tours of Lake Hydra with a divemaster. Bring your scooter and make it a high-speed adventure.", "Plan a tour"]
    ],

    ctaTitle: "Ready to go further?",
    cta: "Tell us where you want your diving to take you, and we'll build the training to get you there."
  };
  // ===================== END OF EDITABLE TEXT =====================

  const PHOTOS = {
    hero: ["wreck-plane", "Divers exploring a sunken airplane in blue water", "50% 45%"],
    who: [["dpv-wreck", "Diver on a scooter lighting up an underwater structure"], ["trim-deck", "Diver with doubles in flat trim over a sunken wooden deck"]],
    strip: [["bubble-ring", "Bubble ring rising past a diver"], ["lift-bags", "Diver sending up two lift bags"], ["wreck-truck", "Diver beside a sunken truck"], ["scooters-dock", "Three DPV scooters lined up on a dock by the lake"]]
  };

  const ICONS = {
    compass: `<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>`,
    level: `<path d="M3 12h18"/><path d="M6 8c2-2 4-2 6 0s4 2 6 0"/><path d="M6 16c2 2 4 2 6 0s4-2 6 0"/>`,
    shield: `<path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/>`,
    leaf: `<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19 13 11"/>`
  };
  const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[k] || ""}</svg>`;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
  const img = (p, cls, lazy) => `<img${cls ? ` class="${cls}"` : ""} src="photos/${p[0]}.webp" alt="${esc(p[1])}"${lazy ? ' loading="lazy"' : ""}${p[2] ? ` style="object-position:${p[2]}"` : ""}>`;

  // A few bubbles rising in the hero (CSS animates them; still when the visitor prefers less motion).
  const BUBBLES = [[8, 10, 0], [14, 6, 3], [22, 14, 1.5], [71, 8, 2.2], [78, 12, 0.6], [86, 7, 4], [92, 10, 2.8]]
    .map(([x, s, d]) => `<i style="left:${x}%;width:${s}px;height:${s}px;animation-delay:${d}s"></i>`).join("");

  function render() {
    const T = TEXT;
    return `<div class="home">
      <section class="home-hero" aria-labelledby="home-title">
        ${img(PHOTOS.hero, "home-hero-img")}
        <div class="home-bubbles" aria-hidden="true">${BUBBLES}</div>
        <div class="home-hero-text">
          <span class="home-eyebrow">${esc(T.eyebrow)}</span>
          <h1 id="home-title">${esc(T.title)}</h1>
          <p class="home-motto"><span lang="la">${esc(T.motto)}</span><small>${esc(T.mottoNote)}</small></p>
          <p class="home-lead">${esc(T.lead)}</p>
          <div class="home-actions"><a class="btn primary" href="available-classes.html">See available classes</a><a class="btn ghost" href="request.html">Request a class</a></div>
        </div>
      </section>

      <section class="home-who" aria-labelledby="home-who-title">
        <h2 id="home-who-title" class="home-h2">${esc(T.whoTitle)}</h2>
        <div class="home-who-grid">${T.who.map((w, i) => `<article class="home-who-card">
          ${img(PHOTOS.who[i] || PHOTOS.who[0], "", true)}
          <div><h3>${esc(w[0])}</h3><p>${esc(w[1])}</p></div></article>`).join("")}</div>
      </section>

      <section class="home-beliefs" aria-labelledby="home-beliefs-title">
        <h2 id="home-beliefs-title" class="home-h2">${esc(T.beliefsTitle)}</h2>
        <p class="home-sub">${esc(T.beliefsLead)}</p>
        <div class="home-belief-grid">${T.beliefs.map(b => `<article class="home-belief">
          <span class="home-icon">${icon(b[0])}</span><h3>${esc(b[1])}</h3><p>${esc(b[2])}</p></article>`).join("")}</div>
        <p class="home-more">How we dive, teach and treat each other: <a href="core-values.html">read our core values ›</a></p>
      </section>

      <section class="home-path" aria-labelledby="home-path-title">
        <h2 id="home-path-title" class="home-h2">${esc(T.pathTitle)}</h2>
        <p class="home-sub">${esc(T.pathLead)}</p>
        <ol class="home-steps">${T.path.map(p => `<li><b>${esc(p[0])}</b><span>${esc(p[1])}</span></li>`).join("")}</ol>
      </section>

      <section class="home-do" aria-labelledby="home-do-title">
        <h2 id="home-do-title" class="home-h2">${esc(T.doTitle)}</h2>
        <div class="home-do-grid">${T.do.map(d => `<a class="home-do-card" href="${esc(d[0])}">
          <h3>${esc(d[1])}</h3><p>${esc(d[2])}</p><span class="go">${esc(d[3])} ›</span></a>`).join("")}</div>
      </section>

      <div class="photo-strip home-strip">${PHOTOS.strip.map(p => img(p, "", true)).join("")}</div>

      <section class="home-cta" aria-labelledby="home-cta-title">
        <h2 id="home-cta-title">${esc(T.ctaTitle)}</h2>
        <p>${esc(T.cta)}</p>
        <div class="home-actions"><a class="btn primary" href="request.html">Request a class</a><a class="btn ghost" href="account.html">Student portal</a></div>
        <p class="home-motto small" lang="la">${esc(T.motto)}</p>
      </section>
    </div>`;
  }

  window.LDHome = { render, TEXT };
})();
