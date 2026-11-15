/* Limitless Diving — Elements of tech diving (tech-diving.html).
   A members-only section an Instructor or Admin switches on per student in Records → Students
   (student_profiles.tech_access, supabase/schema.sql). Instructors and Admins always have access.
   Tabs across the top; Tanks and Gear have sub menus. Each page has its own address: tech-diving.html#dir.
   The words live in tech-diving-content.js. Load after cloud.js and tech-diving-content.js. */
(function () {
  "use strict";

  const C = window.LDCloud, main = document.getElementById("tech");
  const PAGES = (window.LDTechContent && window.LDTechContent.PAGES) || [];
  if (!main) return;
  const byId = {}; PAGES.forEach(p => { byId[p.id] = p; });
  const kids = (id) => PAGES.filter(p => p.parent === id);
  const top = PAGES.filter(p => !p.parent);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let open = "";  // which sub menu is open (tanks or gear)

  function current() {
    const id = decodeURIComponent(location.hash.replace(/^#/, "")).toLowerCase();
    return byId[id] ? id : "home";
  }

  // ---------- who may see it ----------
  function access() {
    if (!C || !C.configured) return "open";       // online logins not set up: page stays open, like the other tools
    if (!C.available) return "offline";
    if (!C.loaded) return "loading";
    if (!C.user) return "signin";
    return C.techAccess ? "open" : "locked";
  }
  function gate(state) {
    const hdr = `<span class="eyebrow">Elements of tech diving</span><h1>Members only</h1>`;
    const msg = {
      offline: `<p>The log in service couldn't be loaded. Check your connection and refresh the page.</p>`,
      loading: `<p class="hint">Checking your log in…</p>`,
      signin: `<p>This section opens for students once their instructor switches it on. Log in to see it.</p>
        <div class="row-actions"><a class="btn primary" href="account.html#then=tech-diving">Log in</a></div>`,
      locked: `<p>Your instructor hasn't opened Elements of tech diving for your account yet. When you're ready for technical training, ask us and we'll switch it on.</p>
        <div class="row-actions"><a class="btn primary" href="account.html">Student portal</a><a class="btn" href="available-classes.html">See technical courses</a></div>`
    }[state];
    return `<section class="panel gate-card">${state === "loading" ? msg : hdr + msg}</section>`;
  }

  // ---------- tabs ----------
  function tabs(cur) {
    const curPage = byId[cur], group = curPage.parent || (kids(cur).length ? cur : "");
    const item = (p) => {
      const sub = kids(p.id), on = p.id === cur || p.id === curPage.parent;
      const link = `<a class="td-tab${on ? " on" : ""}" href="#${p.id}"${p.id === cur ? ' aria-current="page"' : ""}>${esc(p.label)}</a>`;
      if (!sub.length) return `<li>${link}</li>`;
      const isOpen = open === p.id;
      return `<li class="has-sub${isOpen ? " open" : ""}">${link}<button class="td-caret${on ? " on" : ""}" type="button" data-sub="${p.id}" aria-expanded="${isOpen}" aria-controls="td-sub-${p.id}" aria-label="${esc(p.label)} menu">▾</button>
        <ul class="td-menu" id="td-sub-${p.id}">${[p].concat(sub).map(s => `<li><a href="#${s.id}"${s.id === cur ? ' aria-current="page"' : ""}>${s.id === p.id ? esc(p.label) + " overview" : esc(s.label)}</a></li>`).join("")}</ul></li>`;
    };
    const row2 = group ? `<nav class="td-subtabs" aria-label="${esc(byId[group].label)}"><a href="#${group}" class="${cur === group ? "on" : ""}"${cur === group ? ' aria-current="page"' : ""}>Overview</a>${kids(group).map(s => `<a href="#${s.id}" class="${s.id === cur ? "on" : ""}"${s.id === cur ? ' aria-current="page"' : ""}>${esc(s.label)}</a>`).join("")}</nav>` : "";
    return `<nav class="td-tabs" aria-label="Elements of tech diving"><ul>${top.map(item).join("")}</ul></nav>${row2}`;
  }

  // ---------- pages ----------
  const ROSE = `<svg class="td-rose" aria-hidden="true" viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="100" cy="100" r="76" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 8"/>
    ${[0, 90, 180, 270].map(a => `<polygon points="100,8 90,100 110,100" fill="currentColor" transform="rotate(${a} 100 100)"/>`).join("")}
    ${[45, 135, 225, 315].map(a => `<polygon points="100,40 95,100 105,100" fill="currentColor" opacity=".6" transform="rotate(${a} 100 100)"/>`).join("")}<circle cx="100" cy="100" r="8" fill="none" stroke="currentColor" stroke-width="3"/></svg>`;

  // Where everything goes on a tech rig, seen from the front (so the diver's left is on the viewer's right; x is mirrored below): numbered points on the diver and a list beside it.
  function rigDiagram() {
    const L = [  // [x, y on the diver, what goes there]
      [320, 128, "Necklace backup regulator, under the chin"],
      [270, 152, "Left chest D-ring: backup light, wing inflator held below it"],
      [370, 152, "Right chest D-ring: backup light, long hose clip when stowed"],
      [172, 238, "Left wrist: compass"],
      [468, 238, "Right wrist: computer or bottom timer"],
      [262, 292, "Left hip D-ring: SPG"],
      [380, 292, "Right hip: light canister, knife on the left of the waistband"],
      [320, 336, "Crotch strap: reel on the rear D-ring"],
      [282, 372, "Left pocket: safety spool, backup mask"],
      [358, 372, "Right pocket: small SMB and spool, wet notes"]
    ];
    return `<figure class="td-figure"><svg viewBox="140 30 360 390" role="img" aria-labelledby="td-rig-t">
      <title id="td-rig-t">Front view of a diver's harness with numbered places where each piece of gear is carried</title>
      <g class="td-body">
        <circle cx="320" cy="78" r="30"/>
        <path d="M262 118 Q320 104 378 118 L392 300 Q320 318 248 300 Z"/>
        <path d="M262 124 L180 228 L162 246 L178 256 L200 236 L272 160 Z"/>
        <path d="M378 124 L460 228 L478 246 L462 256 L440 236 L368 160 Z"/>
        <path d="M252 300 L268 404 L304 404 L314 318 Z"/><path d="M388 300 L372 404 L336 404 L326 318 Z"/>
      </g>
      <g class="td-harness"><path d="M290 112 L276 300 M350 112 L364 300 M248 296 Q320 312 392 296 M320 304 L320 336"/></g>
      <path class="td-hose" d="M248 312 C220 250 230 196 340 166 C390 152 340 112 306 116"/>
      ${L.map(([x0, y], i) => { const x = 640 - x0; return `<g class="td-num"><circle cx="${x}" cy="${y}" r="12"/><text x="${x}" y="${y + 5}" text-anchor="middle">${i + 1}</text></g>`; }).join("")}
    </svg>
    <figcaption><ol class="td-legend">${L.map(l => `<li>${esc(l[2])}</li>`).join("")}</ol>
      <span>Seen from the front, so the diver's left side is on your right. The long hose (dashed gold) runs from the right post, under the canister, across the chest and behind the neck.</span></figcaption></figure>`;
  }

  function home() {
    const cards = top.filter(p => p.id !== "home").map(p => `<a class="td-card" href="#${p.id}"><b>${esc(p.label)}</b><span>${esc(p.lead || "")}</span>
      ${kids(p.id).length ? `<em>${kids(p.id).map(k => esc(k.label)).join(" · ")}</em>` : ""}</a>`).join("");
    return `<section class="td-hero">
        <svg class="td-topo" aria-hidden="true" viewBox="0 0 600 260" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="currentColor" stroke-width="1">
          ${[1, .82, .64, .47, .3, .15].map(k => `<ellipse cx="470" cy="150" rx="${220 * k}" ry="${130 * k}" transform="rotate(-14 470 150)"/>`).join("")}
          ${[1, .7, .42].map(k => `<ellipse cx="90" cy="40" rx="${160 * k}" ry="${70 * k}" transform="rotate(12 90 40)"/>`).join("")}</g></svg>
        ${ROSE}
        <div class="td-hero-text"><span class="td-eyebrow">Limitless Diving &amp; Technical Training · Dive Team 6</span>
          <h1>Elements of tech diving</h1>
          <p class="td-motto"><i lang="la">Submersio · per artem et disciplinam</i><span>Diving, through skill and discipline</span></p>
          <p class="td-lead">Technical diving starts long before you get wet. It starts with a rig where every piece has a reason to be there, in the same place on every diver on the team. Work through these pages from the skin out, the way you'd get dressed for a dive.</p>
          <div class="row-actions"><a class="btn primary" href="#dir">Start with DIR</a><a class="btn" href="#gear">Where the gear goes</a></div></div>
      </section>
      <section class="td-cards" aria-label="Sections">${cards}</section>
      <section class="panel"><h2 class="sec">Where everything goes</h2>
        <p class="hint">The same layout on every diver means anyone on the team can find your gas, lights and tools by feel, in the dark.</p>${rigDiagram()}</section>
      <section class="panel td-source"><h2 class="sec">How to use these pages</h2>
        <p>Read a page before the class session that covers it, and try the quick check at the end. Bring your gear to class and we'll fit it together. If anything here doesn't match how your team dives, ask. Understanding <i>why</i> matters more than memorizing <i>what</i>.</p>
        <p class="hint">Adapted for our students from <i>The Essentials of Diving: Dress for Success</i> by Dan MacKay (InDepth Training, 2004), with notes where gear has changed since.</p></section>`;
  }

  function page(p) {
    const ph = p.photo ? `<img class="photo-hero td-photo" src="photos/${esc(p.photo[0])}.webp" alt="${esc(p.photo[1])}" style="object-position:${esc(p.photo[2] || "50% 50%")}">` : "";
    const i = PAGES.indexOf(p), prev = PAGES[i - 1], next = PAGES[i + 1];
    return `${ph}<section class="pub-hero td-head"><span class="eyebrow">${p.parent ? esc(byId[p.parent].label) + " · " : ""}Elements of tech diving</span>
        <h1>${esc(p.title || p.label)}</h1><p>${esc(p.lead || "")}</p></section>
      <article class="panel td-article">${ROSE.replace('class="td-rose"', 'class="td-rose watermark"')}
        ${(p.sections || []).map(([h, html]) => `<section class="td-sec">${h ? `<h2 class="sec">${esc(h)}</h2>` : ""}${html}</section>`).join("")}
        ${p.id === "gear" ? rigDiagram() : ""}
        ${p.check ? `<details class="td-check"><summary><b>Quick check:</b> ${esc(p.check[0])}</summary><p>${esc(p.check[1])}</p></details>` : ""}
      </article>
      <nav class="td-pager" aria-label="Next and previous">${prev ? `<a class="btn" href="#${prev.id}">‹ ${esc(prev.label)}</a>` : "<span></span>"}${next ? `<a class="btn primary" href="#${next.id}">${esc(next.label)} ›</a>` : `<a class="btn" href="#home">Back to the start</a>`}</nav>`;
  }

  function render() {
    const state = access();
    if (state !== "open") { main.innerHTML = gate(state); document.title = "Elements of tech diving · Limitless Diving"; return; }
    const cur = current(), p = byId[cur];
    document.title = (cur === "home" ? "Elements of tech diving" : (p.title || p.label) + " · Elements of tech diving") + " · Limitless Diving";
    main.innerHTML = tabs(cur) + (cur === "home" ? home() : page(p));
  }

  window.addEventListener("hashchange", () => { open = ""; render(); window.scrollTo({ top: Math.max(0, main.offsetTop - 8), behavior: "smooth" }); });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sub]");
    if (b) { open = open === b.dataset.sub ? "" : b.dataset.sub; render(); const n = main.querySelector(`[data-sub="${b.dataset.sub}"]`); if (n) n.focus(); return; }
    if (open && !e.target.closest(".td-menu")) { open = ""; render(); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) { const id = open; open = ""; render(); const n = main.querySelector(`[data-sub="${id}"]`); if (n) n.focus(); } });

  render();
  if (C && C.ready) { C.ready.then(render); C.onChange(render); }
})();
