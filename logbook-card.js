/* Limitless Diving — the "My dive log book" card in the Student portal (account.html).
   Members registered for at least one class (and all staff) see their log book totals and links to logbook.html.
   Everyone else is told it opens with their first class. Lives in its own <section id="my-logbook"> beside the
   account page's <main>, so the account page's redraws never touch it. */
(function () {
  "use strict";

  const box = document.getElementById("my-logbook"), C = window.LDCloud;
  if (!box || !C || !C.available) return;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  let uid = null;

  const ICON = `<svg class="lbc-icon" viewBox="0 0 48 48" aria-hidden="true"><rect x="9" y="5" width="30" height="38" rx="3" fill="none" stroke="currentColor" stroke-width="2.5"/>
    <path d="M15 5v38" stroke="currentColor" stroke-width="2.5"/><path d="M20 15h13M20 21h13M20 27h9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M22 35c2-2 4-2 6 0s4 2 6 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

  function fmtDate(d) { const x = new Date(String(d).slice(0, 10) + "T12:00:00"); return isNaN(x) ? d : x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

  function card(inner) { box.innerHTML = `<div class="panel lbc">${ICON}<div class="lbc-text">${inner}</div></div>`; }

  async function load() {
    card(`<h2 class="sec">My dive log book</h2><p class="hint">Checking…</p>`);
    const a = await C.client.rpc("my_logbook_access");
    if (a.error) {
      // Before schema.sql is re-run there's no log book yet: say nothing to students.
      if (C.can("instructor")) card(`<h2 class="sec">My dive log book</h2><p class="hint">The dive log book needs the latest supabase/schema.sql run in Supabase before it can open.</p>`);
      else box.hidden = true;
      return;
    }
    if (a.data !== true) {
      card(`<h2 class="sec">My dive log book</h2>
        <p class="hint">Your online dive log book opens as soon as you're registered for a class. Log every dive, tie it to your map, and get training dives signed off by your instructor.</p>
        <div class="row-actions"><a class="btn" href="available-classes.html">See available classes</a></div>`);
      return;
    }
    const r = await C.client.from("dive_logs").select("dive_no,dived_on,bottom_time,signed_at,tags").eq("user_id", C.user.id);
    const ds = r.error ? [] : r.data || [];
    const total = ds.reduce((t, d) => t + (d.bottom_time || 0), 0), last = ds.map(d => d.dived_on).sort().pop();
    const waiting = ds.filter(d => !d.signed_at && (d.tags || []).includes("training")).length;
    const line = ds.length
      ? `${ds.length} dive${ds.length === 1 ? "" : "s"} logged · ${Math.floor(total / 60)} h ${total % 60} min underwater · last dive ${esc(fmtDate(last))}${waiting ? ` · ${waiting} waiting for sign-off` : ""}`
      : "No dives logged yet. Start with your most recent dive.";
    card(`<h2 class="sec">My dive log book</h2><p class="lbc-line">${line}</p>
      <div class="row-actions"><a class="btn primary" href="logbook.html#new">+ Log a dive</a><a class="btn" href="logbook.html">Open my log book</a></div>`);
  }

  function sync() {
    const id = C.user && C.user.id;
    if (!id || /type=recovery/.test(location.hash)) { box.hidden = true; uid = null; return; }
    if (id === uid) return;
    uid = id; box.hidden = false;
    load().catch(() => { box.hidden = true; });
  }
  C.onChange(sync); C.ready.then(sync);
})();
