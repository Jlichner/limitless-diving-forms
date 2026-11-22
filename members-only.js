/* Limitless Diving — members-only pages (the Tools: Nitrox calculator, Diving Physics).
   Hides the page's <main> until the visitor is logged in with any account (student or staff), and shows a
   log in / create account panel instead. Load after supabase-config.js and cloud.js, before the page's own script.
   Set the page name to come back to after logging in with <body data-then="nitrox">. When online logins
   aren't set up (no supabase-config.js values) the page stays open, as before.
   An Instructor or Admin can also switch a tool off for one person (Records → Student accounts): they then see
   a "not open for you" panel instead (LDCloud.toolAccess, my_tool_access() in supabase/schema.sql). */
(function () {
  "use strict";

  const C = window.LDCloud, main = document.querySelector("main");
  if (!main || !C || !C.configured) return;
  const then = (document.body.dataset.then || "").replace(/[^\w-]/g, "");
  const tool = { nitrox: "nitrox", "diving-physics": "physics" }[then] || "";
  const gate = document.createElement("section");
  gate.className = "pub members-gate";
  main.hidden = true;
  main.insertAdjacentElement("beforebegin", gate);

  function show() {
    main.hidden = true; gate.hidden = false;
    const title = document.title.replace(/[<>&"]/g, "");
    if (C.user && tool && C.toolAccess && C.toolAccess[tool] === false) {
      gate.innerHTML = `<div class="panel gate-card">
          <span class="eyebrow">Not open for you yet</span>
          <h1>${title}</h1>
          <p>Your instructor hasn't opened this tool on your account. Ask them to switch it on, and it will be here the next time you open the page.</p>
          <div class="row-actions"><a class="btn primary" href="account.html">Student portal</a></div>
        </div>`;
      return;
    }
    if (C.user) { gate.hidden = true; main.hidden = false; return; }
    if (!C.available) {
      gate.innerHTML = `<div class="panel gate-card"><h1>Members only</h1><p>The log in service couldn't be loaded. Check your connection and refresh the page.</p></div>`;
      return;
    }
    if (!C.loaded) { gate.innerHTML = `<div class="panel gate-card"><p class="hint">Checking your log in…</p></div>`; return; }
    gate.innerHTML = `<div class="panel gate-card">
        <span class="eyebrow">Members only</span>
        <h1>${title}</h1>
        <p>Our dive tools are free for registered Limitless Diving students and staff. Log in, or create a free account in a minute.</p>
        <div class="row-actions"><a class="btn primary" href="account.html${then ? "#then=" + then : ""}">Log in</a>
          <a class="btn" href="account.html${then ? "#then=" + then : ""}">Create a free account</a></div>
      </div>`;
  }
  show();
  C.ready.then(show);
  C.onChange(show);
})();
