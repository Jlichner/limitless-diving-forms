/* Limitless Diving — Student accounts, in the instructor app (index.html, the "Student account" tab).
   Students sign up on account.html. Here the instructor signs in, sees every account, links each one to a
   student in the Students tab (copying their details in), and shares course progress so students can follow it.
   Supabase row-level security (supabase/schema.sql) only lets instructors do this. Load after app.js and cloud.js. */
(function () {
  "use strict";

  const L = () => window.LD;
  const C = () => window.LDCloud || { configured: false };
  const v = { accounts: null, loading: false, error: "", busy: false, note: "", noteKind: "" };

  function accountPageUrl() { return new URL("account.html", location.href).href; }
  function people() { return L().state.students; }
  function linkedPerson(acc) { return people().find(p => p.accountId === acc.id) || null; }
  function certText(c) { return [c.agency, c.level].filter(Boolean).join(" ") + (c.number ? " #" + c.number : "") + (c.date ? " (" + L().fmtDate(c.date) + ")" : ""); }
  function certsOf(acc) { return (Array.isArray(acc.certifications) ? acc.certifications : []).filter(c => c && (c.agency || c.level)); }
  function latestCert(acc) { return certsOf(acc).slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0] || null; }
  // Course records whose student is linked to an account: these are what "Share progress" sends.
  function sharedEnrollments() {
    const ids = new Set(people().filter(p => p.accountId).map(p => p.id));
    return L().state.enrollments.filter(e => ids.has(e.studentId) && L().COURSES[e.course]);
  }
  function note() { return v.note ? `<p class="acct-note ${v.noteKind}" role="${v.noteKind === "bad" ? "alert" : "status"}">${L().esc(v.note)}</p>` : ""; }
  function setNote(t, k) { v.note = t || ""; v.noteKind = k || ""; }

  // ---------- copying an account into the Students tab ----------
  // overwrite=false fills only empty fields (used when linking); true replaces with the account's non-empty values.
  function applyAccount(p, acc, overwrite) {
    const map = { name: acc.full_name, email: acc.email, phone: acc.phone, address: acc.address,
      emergencyName: acc.emergency_name, emergencyRel: acc.emergency_relationship, emergencyPhone: acc.emergency_phone };
    const c = latestCert(acc);
    if (c) Object.assign(map, { certAgency: c.agency, certLevel: c.level, certNumber: c.number });
    Object.keys(map).forEach(k => { const val = String(map[k] || "").trim(); if (val && (overwrite || !String(p[k] || "").trim())) p[k] = val; });
    const all = certsOf(acc);
    if (all.length > 1) {
      const line = "Certifications (from student account): " + all.map(certText).join("; ");
      const notes = String(p.notes || "").split("\n").filter(x => !x.startsWith("Certifications (from student account):"));
      notes.push(line); p.notes = notes.filter(Boolean).join("\n");
    }
    p.accountId = acc.id;
  }

  // ---------- progress summaries the student sees on account.html ----------
  function summary(e) {
    const c = L().COURSES[e.course], pr = L().progress(e), pg = L().program(e.course);
    const k = e.classId ? (L().state.classes || []).find(x => x.id === e.classId) : null;
    const schedule = c.schedule.map((label, i) => ({ label, date: (e.dates && e.dates["d" + (i + 1)]) || "" }));
    const dates = k && (k.dates || []).filter(Boolean).length ? k.dates.filter(Boolean) : schedule.map(d => d.date).filter(Boolean);
    const name = c.fullName || c.name;
    return {
      courseName: (pg && pg.program) || name, agency: /NAUI/i.test(((pg && pg.program) || "") + " " + name) ? "NAUI" : "",
      classId: k ? k.id : "", classTitle: k ? (k.title || "") : "", dates: dates.slice().sort(),
      time: (k && k.time) || "", location: (k && k.location) || e.location || "",
      schedule, pct: pr.pct,
      skills: { done: pr.m, total: pr.nS }, final: { done: pr.f, total: pr.nF }, finalTitle: c.finalTitle || "Final evaluation",
      prereqs: { done: pr.q, total: pr.nQ },
      dives: { logged: (e.dives || []).filter(d => d && d.date).length, total: c.dives || (e.dives || []).length },
      balanceDue: Math.round(L().owed(e).due * 100) / 100,
      skillList: c.skills.map((s, i) => ({ name: s[1], done: !!(e.skills[i] && e.skills[i].m) }))
        .concat(c.final.map((s, i) => ({ name: (c.finalTitle || "Final") + ": " + s[1], done: !!(e.final[i] && e.final[i].m) })))
    };
  }
  async function shareProgress() {
    const sb = C().client;
    const byPerson = {}; people().forEach(p => { byPerson[p.id] = p; });
    const known = new Set((v.accounts || []).map(a => a.id));
    const rows = sharedEnrollments().filter(e => known.has(byPerson[e.studentId].accountId))
      .map(e => ({ id: e.id, student_id: byPerson[e.studentId].accountId, course: e.course, summary: summary(e) }));
    const existing = await sb.from("student_progress").select("id");
    if (existing.error) throw existing.error;
    const keep = new Set(rows.map(r => r.id));
    const stale = (existing.data || []).map(r => r.id).filter(id => !keep.has(id));
    if (rows.length) { const up = await sb.from("student_progress").upsert(rows); if (up.error) throw up.error; }
    if (stale.length) { const del = await sb.from("student_progress").delete().in("id", stale); if (del.error) throw del.error; }
    L().state.progressSharedAt = new Date().toISOString(); L().save();
    return rows.length;
  }

  async function loadAccounts() {
    if (!C().instructor) return;
    v.loading = true; v.error = ""; rerender();
    const { data, error } = await C().client.rpc("student_accounts");
    v.loading = false;
    if (error) v.error = "Couldn't load the accounts: " + C().explain(error);
    else v.accounts = data || [];
    rerender();
  }

  // ---------- render ----------
  function studentBox() {
    const url = accountPageUrl(), { esc } = L();
    return `<h2 class="sec">For students</h2>
      <p class="hint">Students create their own account and keep their details current: name, address, phone, emergency contact and certifications. Share this link with them.</p>
      <div class="sa-copy"><code>${esc(url)}</code><a class="btn primary" href="account.html" target="_blank" rel="noopener">Student sign in / create account</a><button class="btn" data-sa="copy">Copy link</button></div>`;
  }
  function setupBox() {
    return `<h2 class="sec">Turn on student accounts</h2>
      <p class="hint">Student accounts need a free Supabase project (an online database with sign-in). It takes about 15 minutes, once:</p>
      <ol class="cal-steps">
        <li>Create a project at <a href="https://supabase.com/dashboard" target="_blank" rel="noopener">supabase.com</a>.</li>
        <li>In its <b>SQL Editor</b>, run the file <code>supabase/schema.sql</code> from this repository.</li>
        <li>Paste the project URL and publishable key into <code>supabase-config.js</code> and commit it.</li>
        <li>Sign up on the student page with your own email, then make yourself the instructor (one line of SQL).</li>
      </ol>
      <p class="hint">The README has every step, with screenshots of where to click.</p>`;
  }
  function signInBox() {
    return `<h2 class="sec">Instructor sign in</h2>
      <p class="hint">Sign in with your instructor account to see student accounts, link them to your Students list and share progress.</p>
      ${note()}
      <form class="sa-auth" id="sa-signin" novalidate>
        <div class="field"><label for="sa-email">Email</label><input id="sa-email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="sa-pass">Password</label><input id="sa-pass" type="password" autocomplete="current-password" required></div>
        <div class="row-actions"><button class="btn primary" type="submit"${v.busy ? " disabled" : ""}>${v.busy ? "Signing in…" : "Sign in"}</button></div>
        <p class="hint">No instructor account yet? Create one on the <a href="account.html" target="_blank" rel="noopener">student page</a> with your own email, then follow "Make yourself the instructor" in the README.</p>
      </form>`;
  }
  function notInstructorBox() {
    const { esc } = L(), email = C().user.email || "";
    return `<h2 class="sec">Almost there</h2>
      <p class="hint">You're signed in as <b>${esc(email)}</b>, but this account isn't an instructor yet. In Supabase, open <b>SQL Editor</b>, paste this, and click <b>Run</b>:</p>
      <pre class="sa-sql"><code>insert into public.instructors (user_id)
select id from auth.users where email = '${esc(email.replace(/'/g, "''"))}';</code></pre>
      <div class="row-actions"><button class="btn primary" data-sa="recheck">I've done it, check again</button><button class="btn" data-sa="signout">Sign out</button></div>`;
  }
  function accountRow(acc) {
    const { esc, fmtDate } = L(), p = linkedPerson(acc), certs = certsOf(acc);
    const free = people().filter(x => !x.accountId).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const em = String(acc.email || "").toLowerCase(), nm = String(acc.full_name || "").trim().toLowerCase();
    const guess = free.find(x => em && String(x.email || "").trim().toLowerCase() === em) || free.find(x => nm && String(x.name || "").trim().toLowerCase() === nm);
    const dd = (label, val) => val ? `<dt>${label}</dt><dd>${esc(val)}</dd>` : "";
    const emergency = [acc.emergency_name, acc.emergency_relationship ? "(" + acc.emergency_relationship + ")" : "", acc.emergency_phone].filter(Boolean).join(" ");
    return `<article class="sa-row${p ? " linked" : ""}">
      <div><h3>${esc(acc.full_name || "No name yet")}</h3>
        <span class="meta">${esc(acc.email)} ${acc.email_confirmed ? "" : `<span class="sa-badge wait">Email not confirmed</span>`}</span>
        <dl>${dd("Phone", acc.phone)}${dd("Address", acc.address)}${dd("Emergency", emergency)}${dd("Certs", certs.map(certText).join("\n"))}
          ${dd("Updated", acc.updated_at ? fmtDate(String(acc.updated_at).slice(0, 10)) : "")}</dl></div>
      <div class="sa-link">${p
        ? `<span><span class="sa-badge">Linked</span> to <b>${esc(p.name || "Unnamed student")}</b> in Students</span>
           <div class="row-actions"><button class="btn small" data-sa="open" data-id="${esc(p.id)}">Open student</button>
             <button class="btn small" data-sa="pull" data-acc="${esc(acc.id)}">Copy their latest details in</button>
             <button class="btn small danger" data-sa="unlink" data-id="${esc(p.id)}">Unlink</button></div>`
        : `<label class="lbl" for="sa-pick-${esc(acc.id)}">Link to a student in your list</label>
           <select id="sa-pick-${esc(acc.id)}"><option value="">Choose a student</option>${free.map(x => `<option value="${esc(x.id)}"${guess && guess.id === x.id ? " selected" : ""}>${esc(x.name || "Unnamed student")}${x.email ? " · " + esc(x.email) : ""}</option>`).join("")}</select>
           <div class="row-actions"><button class="btn small primary" data-sa="link" data-acc="${esc(acc.id)}">Link</button>
             <button class="btn small" data-sa="add" data-acc="${esc(acc.id)}">Add as a new student</button></div>
           ${guess ? `<span class="hint">Suggested by matching ${String(guess.email || "").trim().toLowerCase() === em ? "email" : "name"}.</span>` : ""}`}
      </div></article>`;
  }
  function instructorBox() {
    const { esc } = L(), list = v.accounts || [], n = sharedEnrollments().length;
    const at = L().state.progressSharedAt ? new Date(L().state.progressSharedAt) : null;
    const unlinked = list.filter(a => !linkedPerson(a)).length;
    return `<div class="sa-status"><span class="hint">Signed in as <b>${esc(C().user.email || "")}</b> (instructor)</span>
        <button class="btn small" data-sa="refresh">Refresh</button><button class="btn small" data-sa="signout">Sign out</button></div>
      ${note()}
      <h2 class="sec">Share progress with students</h2>
      <p class="hint">Sends each linked student their course schedule, skills mastered, dives logged and balance due, so they see it on their account page. Medical notes, instructor notes and other students are never sent. Share again after you update their records.</p>
      <div class="row-actions"><button class="btn primary" data-sa="share"${v.busy || !n ? " disabled" : ""}>${v.busy ? "Sharing…" : `Share progress (${n} course record${n === 1 ? "" : "s"})`}</button>
        <span class="hint" style="align-self:center;margin:0">${at && !isNaN(at) ? "Last shared " + esc(at.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })) : "Not shared yet"}${n ? "" : ". Link an account to a student first."}</span></div>
      <h2 class="sec">Accounts${list.length ? ` <span class="hint">(${list.length}${unlinked ? ", " + unlinked + " not linked yet" : ""})</span>` : ""}</h2>
      ${v.error ? `<p class="acct-note bad" role="alert">${esc(v.error)}</p>` : ""}
      ${v.loading && !v.accounts ? `<p class="hint">Loading accounts…</p>`
        : list.length ? `<div class="sa-list">${list.map(accountRow).join("")}</div>`
        : `<p class="hint">No students have created an account yet. Send them the link above.</p>`}`;
  }
  function render() {
    const c = C();
    let body;
    if (!c.configured) body = setupBox();
    else if (!c.available) body = `<p class="acct-note bad">The sign-in service couldn't be loaded. Check your connection and reload the page.</p>`;
    else if (!c.user) body = signInBox();
    else if (!c.instructor) body = notInstructorBox();
    else body = instructorBox();
    return `<section class="panel" id="sa-panel"><div class="rec-head"><div class="who"><span class="eyebrow">Student accounts</span><h1>Student account</h1></div></div>
      ${studentBox()}${body}</section>`;
  }
  function rerender() { if (L().state && document.getElementById("sa-panel")) L().render(); }

  // A line on each student's page in the Students tab.
  function personNote(p) {
    const { esc } = L();
    if (!C().configured) return "";
    if (!p.accountId) return `<p class="hint">No student account linked. Link one under <button class="linkbtn" data-mode="account">Student account</button>.</p>`;
    const acc = (v.accounts || []).find(a => a.id === p.accountId);
    return `<p class="hint"><span class="sa-badge">Account linked</span> ${acc ? esc(acc.email) : ""} · <button class="linkbtn" data-mode="account">Manage</button></p>`;
  }

  // ---------- events ----------
  document.addEventListener("submit", async (e) => {
    if (e.target.id !== "sa-signin") return;
    e.preventDefault();
    const email = document.getElementById("sa-email").value.trim(), password = document.getElementById("sa-pass").value;
    if (!email || !password) { setNote("Enter your email and password.", "bad"); rerender(); return; }
    v.busy = true; setNote(""); rerender();
    const { error } = await C().client.auth.signInWithPassword({ email, password });
    v.busy = false;
    if (error) { setNote(C().explain(error), "bad"); rerender(); }
  });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-sa]"); if (!b) return;
    const acc = (v.accounts || []).find(a => a.id === b.dataset.acc);
    switch (b.dataset.sa) {
      case "copy":
        try { await navigator.clipboard.writeText(accountPageUrl()); L().toast("Link copied"); } catch (err) { L().toast("Couldn't copy. Select the link and copy it."); }
        break;
      case "signout": await C().signOut(); v.accounts = null; setNote(""); rerender(); break;
      case "recheck": await C().refreshRole(); if (C().instructor) loadAccounts(); else { setNote(""); rerender(); L().toast("Not an instructor yet. Run the SQL above, then try again."); } break;
      case "refresh": setNote(""); loadAccounts(); break;
      case "link": {
        const sel = document.getElementById("sa-pick-" + acc.id), p = sel && L().personById(sel.value);
        if (!p) { L().toast("Choose a student to link to"); break; }
        applyAccount(p, acc, false); L().save(); setNote(""); rerender(); L().toast("Linked. Empty fields were filled in from the account.");
        break;
      }
      case "add": {
        const p = L().addStudent(); applyAccount(p, acc, true); L().save(); setNote(""); rerender(); L().toast((p.name || "Student") + " added to Students");
        break;
      }
      case "pull": { const p = linkedPerson(acc); if (p) { applyAccount(p, acc, true); L().save(); rerender(); L().toast("Copied " + (p.name || "their") + " details from the account"); } break; }
      case "unlink": { const p = L().personById(b.dataset.id); if (p) { p.accountId = ""; L().save(); rerender(); L().toast("Unlinked. Share progress again to remove it from their account."); } break; }
      case "open": L().go("students", { psel: b.dataset.id }); break;
      case "share": {
        v.busy = true; setNote(""); rerender();
        try { const n = await shareProgress(); setNote("Shared " + n + " course record" + (n === 1 ? "" : "s") + ". Students see it on their account page now.", "ok"); }
        catch (err) { setNote("Not shared: " + C().explain(err), "bad"); }
        v.busy = false; rerender();
        break;
      }
    }
  });

  if (window.LDCloud && window.LDCloud.available) {
    window.LDCloud.onChange((event) => {
      if (!C().user) v.accounts = null;
      if (C().instructor && !v.accounts && !v.loading) loadAccounts();
      // Redraw for sign-in changes (not hourly token refreshes, which would interrupt typing).
      if (/^(INITIAL_SESSION|SIGNED_IN|SIGNED_OUT|USER_UPDATED)$/.test(event)) L().render();
    });
  }

  window.LDAccount = { render, personNote, summary };
  L().render();
})();
