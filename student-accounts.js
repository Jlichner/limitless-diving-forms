/* Limitless Diving — staff sign-in and student account management (index.html, opened with the
   "Admin Log in" button in the header; mode "staff").
   Students sign up on account.html. Staff sign in here, and what they see depends on their level:
     Dive Master  every student account (contact, emergency contact, certifications), read only
     Instructor   also links accounts to the Students tab, shares course progress and publishes the calendar
     Admin        also gives and removes staff roles, and deactivates, reactivates or deletes accounts
   Supabase row-level security (supabase/schema.sql) enforces the same levels. Load after app.js and cloud.js. */
(function () {
  "use strict";

  const L = () => window.LD;
  const C = () => window.LDCloud || { configured: false };
  const v = { accounts: null, staff: null, loading: false, error: "", busy: false, note: "", noteKind: "", dsel: null, dq: "", dlevel: "", members: null, membersOld: false };
  const roleName = (r) => (window.LDCloud && window.LDCloud.ROLE_NAMES[r]) || "Student";

  function accountPageUrl() { return new URL("account.html", location.href).href; }
  function people() { return L().state.students; }
  function linkedPerson(acc) { return people().find(p => p.accountId === acc.id) || null; }
  function certText(c) { return [c.agency, c.level].filter(Boolean).join(" ") + (c.number ? " #" + c.number : "") + (c.date ? " (" + L().fmtDate(c.date) + ")" : ""); }
  function certsOf(acc) { return (Array.isArray(acc.certifications) ? acc.certifications : []).filter(c => c && (c.agency || c.level)); }
  // Course records whose student is linked to an account: these are what "Share progress" sends.
  function sharedEnrollments() {
    const ids = new Set(people().filter(p => p.accountId).map(p => p.id));
    // Not ones taken off their class on the Calendar (Remove), until they're enrolled in a class again.
    return L().state.enrollments.filter(e => ids.has(e.studentId) && L().COURSES[e.course] && !e.portalHidden);
  }
  function note() { return v.note ? `<p class="acct-note ${v.noteKind}" role="${v.noteKind === "bad" ? "alert" : "status"}">${L().esc(v.note)}</p>` : ""; }
  function setNote(t, k) { v.note = t || ""; v.noteKind = k || ""; }

  // ---------- copying an account into the Students tab ----------
  // overwrite=false fills only empty fields (used when linking); true replaces with the account's non-empty values.
  function applyAccount(p, acc, overwrite) {
    const map = { name: acc.full_name, email: acc.email, phone: acc.phone, address: acc.address,
      emergencyName: acc.emergency_name, emergencyRel: acc.emergency_relationship, emergencyPhone: acc.emergency_phone };
    Object.keys(map).forEach(k => { const val = String(map[k] || "").trim(); if (val && (overwrite || !String(p[k] || "").trim())) p[k] = val; });
    // Certifications: add each one from the account that the student's list doesn't have yet (same agency and name).
    // With overwrite, a matching certification also takes the account's number and date.
    if (!Array.isArray(p.certs)) p.certs = [];
    const key = (c) => (String(c.agency || "") + "|" + String(c.level || "")).trim().toLowerCase();
    certsOf(acc).forEach(c => {
      const mine = p.certs.find(x => key(x) === key(c));
      const val = { agency: c.agency || "", level: c.level || "", number: c.number || "", date: c.date || "" };
      if (!mine) p.certs.push(val);
      else ["number", "date"].forEach(k => { if (val[k] && (overwrite || !mine[k])) mine[k] = val[k]; });
    });
    p.accountId = acc.id;
  }

  // ---------- progress summaries the student sees on account.html ----------
  function summary(e) {
    const c = L().COURSES[e.course], pr = L().progress(e), pg = L().program(e.course);
    const k = e.classId ? (L().state.classes || []).find(x => x.id === e.classId) : null;
    const schedule = c.schedule.map((label, i) => ({ label, date: (e.dates && e.dates["d" + (i + 1)]) || "" }));
    const dates = k && (k.dates || []).filter(Boolean).length ? k.dates.filter(Boolean) : schedule.map(d => d.date).filter(Boolean);
    const name = c.fullName || c.name;
    // Paperwork: the class setup's Agency (NAUI / TDI / Both), else the course's agency. The portal picks the
    // forms from paperwork.js, so forms added there later show up without sharing again.
    const PW = window.LDPaperwork, su = k && k.setupId ? (L().state.classSetups || []).find(x => x.id === k.setupId) : null;
    const paperworkAgency = (su && su.agency) || (PW && PW.agencyOfCourse(e.course)) || "";
    const person = L().personById(e.studentId), firstDay = dates.slice().sort()[0];
    return {
      courseName: (pg && pg.program) || name,
      agency: paperworkAgency === "Both" ? "NAUI + TDI" : paperworkAgency || (/NAUI/i.test(((pg && pg.program) || "") + " " + name) ? "NAUI" : ""),
      paperworkAgency, minor: PW ? PW.isMinor(person && person.dob, firstDay) : null,
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
    // Every account, students and staff alike: a Dive Master taking a class needs their training shown too.
    const known = new Set((v.accounts || []).concat(v.members || []).map(a => a.id));
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

  // ---------- keeping students' "My training" up to date automatically ----------
  // Whenever this browser saves (enrolling a student in a class, ticking off a skill, logging a dive…) and an
  // Instructor or Admin is signed in, the course records of students linked to an account are copied to their
  // portal a few seconds later. Unlike "Share progress", this never removes records it didn't send itself, so a
  // second device with older or no data can't wipe what students see.
  const auto = { timer: null, busy: false, again: false, last: {}, ids: null, validIds: null, list: null };
  function canAutoShare() { const c = C(); return !!(c.available && c.client && c.user && c.can && c.can("instructor")); }
  async function validAccountIds() {
    // Every account, students and staff alike (member_directory). student_accounts leaves staff out, so a
    // Dive Master or Instructor taking a course would never see it; use it only if member_directory is missing.
    if (v.members && !v.membersOld) { auto.list = v.members; return new Set(v.members.map(a => a.id)); }
    if (!auto.validIds) {
      let r = await C().client.rpc("member_directory");
      if (r.error) r = await C().client.rpc("student_accounts");
      if (r.error) throw r.error;
      auto.list = r.data || [];
      auto.validIds = new Set(auto.list.map(a => a.id));
    }
    return auto.validIds;
  }
  // A student enrolled in a course but not linked to a portal account can't see anything. Link them when their
  // email matches an account, or, failing that, when exactly one account has exactly their full name.
  function autoLink() {
    const norm = (x) => String(x || "").trim().toLowerCase().replace(/\s+/g, " ");
    const accounts = auto.list || [], taken = new Set(people().map(p => p.accountId).filter(Boolean)), linked = [];
    const enrolled = new Set(L().state.enrollments.filter(e => L().COURSES[e.course]).map(e => e.studentId));
    people().filter(p => !p.accountId && enrolled.has(p.id) && (p.name || p.email)).forEach(p => {
      const free = accounts.filter(a => !taken.has(a.id));
      let acc = p.email ? free.find(a => norm(a.email) === norm(p.email)) : null;
      if (!acc && p.name) { const same = accounts.filter(a => norm(a.full_name) === norm(p.name)); if (same.length === 1 && !taken.has(same[0].id)) acc = same[0]; }
      if (!acc) return;
      p.accountId = acc.id; if (!p.email && acc.email) p.email = acc.email;
      taken.add(acc.id); linked.push(p.name || acc.email);
    });
    if (linked.length) { L().save(); L().toast("Linked " + linked.join(", ") + " to their Student portal account"); }
    return linked.length;
  }
  async function autoShare() {
    if (!canAutoShare()) return;
    if (auto.busy) { auto.again = true; return; }
    auto.busy = true;
    try {
      const byPerson = {}; people().forEach(p => { byPerson[p.id] = p; });
      let valid = await validAccountIds();
      autoLink();
      // A student linked a moment ago may not be in the list we have yet: refresh it once.
      if (sharedEnrollments().some(e => !valid.has(byPerson[e.studentId].accountId))) { auto.validIds = null; if (!v.members || v.membersOld) valid = await validAccountIds(); }
      const rows = sharedEnrollments().filter(e => valid.has(byPerson[e.studentId].accountId))
        .map(e => ({ id: e.id, student_id: byPerson[e.studentId].accountId, course: e.course, summary: summary(e) }));
      const changed = rows.filter(r => auto.last[r.id] !== JSON.stringify(r));
      if (changed.length) {
        const stamp = (r) => Object.assign({ updated_at: new Date().toISOString() }, r);
        const up = await C().client.from("student_progress").upsert(changed.map(stamp));
        if (!up.error) changed.forEach(r => { auto.last[r.id] = JSON.stringify(r); });
        else {
          // One bad row (say, an account with no profile yet) shouldn't stop everyone else's: send them one by one.
          console.warn("Sending course records together failed, trying one at a time:", up.error);
          for (const r of changed) {
            const one = await C().client.from("student_progress").upsert(stamp(r));
            if (one.error) console.warn("Couldn't send course record " + r.id + ":", one.error); else auto.last[r.id] = JSON.stringify(r);
          }
        }
      }
      // Records this browser sent earlier that are gone now (taken off the class, student unlinked or deleted).
      const now = new Set(rows.map(r => r.id));
      if (auto.ids) {
        const gone = [...auto.ids].filter(id => !now.has(id));
        if (gone.length) { const del = await C().client.from("student_progress").delete().in("id", gone); if (!del.error) gone.forEach(id => { delete auto.last[id]; }); }
      }
      auto.ids = now;
    } catch (err) {
      console.warn("Couldn't update students' portals automatically:", err);
    } finally {
      auto.busy = false;
      if (auto.again) { auto.again = false; scheduleAutoShare(); }
    }
  }
  function scheduleAutoShare() { clearTimeout(auto.timer); auto.timer = setTimeout(autoShare, 2500); }
  document.addEventListener("ld:saved", () => { if (canAutoShare()) scheduleAutoShare(); });
  // Removed from a class on the Calendar: take that course record out of their portal right away.
  document.addEventListener("ld:unshare", (ev) => {
    const id = ev.detail && ev.detail.id; if (!id || !canAutoShare()) return;
    C().client.from("student_progress").delete().eq("id", id).then(r => {
      if (r.error) console.warn("Couldn't remove course record " + id + " from the portal:", r.error);
      else { delete auto.last[id]; if (auto.ids) auto.ids.delete(id); }
    });
  });
  // Catch up once after signing in, for anything changed while signed out.
  if (window.LDCloud && window.LDCloud.onChange) window.LDCloud.onChange(() => { auto.validIds = null; if (canAutoShare()) scheduleAutoShare(); });

  async function loadAccounts() {
    if (!C().can("divemaster")) return;
    v.loading = true; v.error = ""; rerender();
    const [a, st, m] = await Promise.all([
      C().client.rpc("student_accounts"),
      C().can("admin") ? C().client.rpc("staff_members") : Promise.resolve({ data: null }),
      C().client.rpc("member_directory")
    ]);
    v.loading = false;
    if (a.error) v.error = "Couldn't load the accounts: " + C().explain(a.error);
    else v.accounts = a.data || [];
    // Everyone of every level for Records → Students. Until schema.sql is re-run, fall back to students only.
    v.membersOld = !!m.error;
    v.members = m.error ? (v.accounts || []).map(x => Object.assign({ role: "student" }, x)) : (m.data || []);
    // Profile photos are private: get a short-lived link for each one.
    v.photos = {};
    const paths = [...new Set((v.accounts || []).concat(v.members || []).map(x => x.photo_path).filter(Boolean))];
    if (paths.length) {
      v.photos = await C().signedUrls("avatars", paths);
    }
    v.staff = st.error ? [] : st.data;
    rerender();
  }

  // ---------- render ----------
  function studentBox() {
    const url = accountPageUrl(), { esc } = L();
    return `<h2 class="sec">For students</h2>
      <p class="hint">Students create their own account and keep their details current: name, address, phone, emergency contact and certifications. Share this link with them.</p>
      <div class="sa-copy"><code>${esc(url)}</code><a class="btn primary" href="account.html" target="_blank" rel="noopener">Student portal</a><button class="btn" data-sa="copy">Copy link</button></div>`;
  }
  function setupBox() {
    return `<h2 class="sec">Turn on logins</h2>
      <p class="hint">Student accounts need a free Supabase project (an online database with sign-in). It takes about 15 minutes, once:</p>
      <ol class="cal-steps">
        <li>Create a project at <a href="https://supabase.com/dashboard" target="_blank" rel="noopener">supabase.com</a>.</li>
        <li>In its <b>SQL Editor</b>, run the file <code>supabase/schema.sql</code> from this repository.</li>
        <li>Paste the project URL and publishable key into <code>supabase-config.js</code> and commit it.</li>
        <li>Sign up on the Student portal page with your own email, then make yourself the Admin (one line of SQL).</li>
      </ol>
      <p class="hint">The README has every step and where to click.</p>`;
  }
  function signInBox() {
    return `<h2 class="sec">Staff log in</h2>
      <p class="hint">For Dive Masters, Instructors and Admins. Students log in on the <a href="account.html">Student portal</a> page.</p>
      ${note()}
      <form class="sa-auth" id="sa-signin" novalidate>
        <div class="field"><label for="sa-email">Email</label><input id="sa-email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="sa-pass">Password</label><input id="sa-pass" type="password" autocomplete="current-password" required></div>
        <div class="row-actions"><button class="btn primary" type="submit"${v.busy ? " disabled" : ""}>${v.busy ? "Signing in…" : "Sign in"}</button></div>
        <p class="hint">Staff use the same kind of account as students. Create one on the <a href="account.html">Student portal</a> page, then an Admin gives it a staff role.</p>
      </form>`;
  }
  function notStaffBox() {
    const { esc } = L(), email = C().user.email || "";
    return `<h2 class="sec">This is a student account</h2>
      <p class="hint">You're signed in as <b>${esc(email)}</b>, which doesn't have a staff role. An Admin can give it one under <b>Staff and roles</b>. Students manage their details on the <a href="account.html">Student portal</a> page.</p>
      <details><summary>Setting up the very first Admin?</summary>
      <p class="hint">In Supabase, open <b>SQL Editor</b>, paste this, and click <b>Run</b>:</p>
      <pre class="sa-sql"><code>insert into public.staff_roles (user_id, role)
select id, 'admin' from auth.users where email = '${esc(email.replace(/'/g, "''"))}'
on conflict (user_id) do update set role = 'admin';</code></pre></details>
      <div class="row-actions"><button class="btn primary" data-sa="recheck">Check again</button><button class="btn" data-sa="signout">Sign out</button></div>`;
  }
  function staffBox() {
    const { esc } = L(), list = v.staff || [], me = C().user.id;
    const opts = (cur) => ["divemaster", "instructor", "admin", "student"].map(r => `<option value="${r}"${r === cur ? " selected" : ""}>${r === "student" ? "Remove staff role" : roleName(r)}</option>`).join("");
    return `<h2 class="sec">Staff and roles</h2>
      <p class="hint"><b>Dive Master:</b> sees every student's contact, emergency contact, certifications and progress. <b>Instructor:</b> also links accounts, shares progress and publishes the calendar. <b>Admin:</b> also gives and removes roles. Everyone else is a Student.</p>
      ${list.length ? `<div class="tablewrap"><table class="m"><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>
        ${list.map(m => `<tr><td>${esc(m.full_name || "No name yet")}</td><td>${esc(m.email)}</td><td>${m.id === me ? `${esc(roleName(m.role))} <span class="hint">(you)</span>`
          : `<label class="sr-only" for="sa-role-${esc(m.id)}">Role for ${esc(m.email)}</label><select id="sa-role-${esc(m.id)}" data-sa-role="${esc(m.email)}">${opts(m.role)}</select>`}</td></tr>`).join("")}</tbody></table></div>` : ""}
      <form class="sa-addrole" id="sa-addrole" novalidate>
        <div class="field"><label for="sa-new-email">Add staff by email</label><input id="sa-new-email" type="email" placeholder="They sign up as a student first" autocomplete="off"></div>
        <div class="field"><label for="sa-new-role">Role</label><select id="sa-new-role">${opts("divemaster").replace(/<option value="student">.*?<\/option>/, "")}</select></div>
        <button class="btn primary" type="submit">Give role</button>
      </form>`;
  }
  function linkBlock(acc) {
    const { esc } = L(), p = linkedPerson(acc), edit = C().can("instructor");
    const free = people().filter(x => !x.accountId).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const em = String(acc.email || "").toLowerCase(), nm = String(acc.full_name || "").trim().toLowerCase();
    const guess = free.find(x => em && String(x.email || "").trim().toLowerCase() === em) || free.find(x => nm && String(x.name || "").trim().toLowerCase() === nm);
    return `<div class="sa-link">${!edit ? "" : p
        ? `<span><span class="sa-badge">Linked</span> to <b>${esc(p.name || "Unnamed student")}</b> in Students</span>
           <div class="row-actions"><button class="btn small" data-sa="open" data-id="${esc(p.id)}">Open student</button>
             <button class="btn small" data-sa="pull" data-acc="${esc(acc.id)}">Copy their latest details in</button>
             <button class="btn small danger" data-sa="unlink" data-id="${esc(p.id)}">Unlink</button></div>`
        : `<label class="lbl" for="sa-pick-${esc(acc.id)}">Link to a student in your list</label>
           <select id="sa-pick-${esc(acc.id)}"><option value="">Choose a student</option>${free.map(x => `<option value="${esc(x.id)}"${guess && guess.id === x.id ? " selected" : ""}>${esc(x.name || "Unnamed student")}${x.email ? " · " + esc(x.email) : ""}</option>`).join("")}</select>
           <div class="row-actions"><button class="btn small primary" data-sa="link" data-acc="${esc(acc.id)}">Link</button>
             <button class="btn small" data-sa="add" data-acc="${esc(acc.id)}">Add as a new student</button></div>
           ${guess ? `<span class="hint">Suggested by matching ${String(guess.email || "").trim().toLowerCase() === em ? "email" : "name"}.</span>` : ""}`}
      </div>`;
  }
  function initials(acc) { return String(acc.full_name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase() || "?"; }
  function avatar(acc, cls) {
    const { esc } = L(), photo = acc.photo_path && v.photos && v.photos[acc.photo_path];
    return photo ? `<img class="avatar ${cls}" src="${esc(photo)}" alt="${esc(acc.full_name || "Student")} profile photo">` : `<span class="avatar ${cls}" aria-hidden="true">${esc(initials(acc))}</span>`;
  }
  function accountRow(acc) {
    const { esc, fmtDate } = L(), p = linkedPerson(acc), certs = certsOf(acc);
    const dd = (label, val) => val ? `<dt>${label}</dt><dd>${esc(val)}</dd>` : "";
    const emergency = [acc.emergency_name, acc.emergency_relationship ? "(" + acc.emergency_relationship + ")" : "", acc.emergency_phone].filter(Boolean).join(" ");
    return `<article class="sa-row${p ? " linked" : ""}">
      <div><div class="sa-who">${avatar(acc, "photo-sm")}
        <h3>${esc(acc.full_name || "No name yet")}</h3></div>
        <span class="meta">${esc(acc.email)} ${acc.email_confirmed ? "" : `<span class="sa-badge wait">Email not confirmed</span>`}</span>
        <dl>${dd("Phone", acc.phone)}${dd("Address", acc.address)}${dd("Emergency", emergency)}${dd("Certs", certs.map(certText).join("\n"))}
          ${dd("Updated", acc.updated_at ? fmtDate(String(acc.updated_at).slice(0, 10)) : "")}</dl></div>
      ${linkBlock(acc)}</article>`;
  }
  function signedInBox() {
    const { esc } = L(), list = v.accounts || [], n = sharedEnrollments().length, edit = C().can("instructor");
    const at = L().state.progressSharedAt ? new Date(L().state.progressSharedAt) : null;
    const unlinked = list.filter(a => !linkedPerson(a)).length;
    return `<div class="sa-status"><span class="hint">Signed in as <b>${esc(C().user.email || "")}</b> · <span class="sa-badge">${esc(roleName(C().role))}</span></span>
        <button class="btn small" data-sa="refresh">Refresh</button><button class="btn small" data-sa="signout">Sign out</button></div>
      ${note()}
      ${C().can("admin") ? staffBox() : ""}
      ${!edit ? `<p class="hint">As a Dive Master you can see every student's details below. Instructors make changes.</p>` : `<h2 class="sec">Share progress with students</h2>
      <p class="hint">Sends each linked student their course schedule, skills mastered, dives logged and balance due, so they see it on their account page. Medical notes, instructor notes and other students are never sent. This now happens on its own a few seconds after you enroll a student or update their record (while you're signed in here). Use the button to resend everything and clear out records for students you've removed.</p>
      <div class="row-actions"><button class="btn primary" data-sa="share"${v.busy || !n ? " disabled" : ""}>${v.busy ? "Sharing…" : `Share progress (${n} course record${n === 1 ? "" : "s"})`}</button>
        <span class="hint" style="align-self:center;margin:0">${at && !isNaN(at) ? "Last shared " + esc(at.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })) : "Not shared yet"}${n ? "" : ". Link an account to a student first."}</span></div>`}
      <h2 class="sec">Accounts${list.length ? ` <span class="hint">(${list.length}${unlinked ? ", " + unlinked + " not linked yet" : ""})</span>` : ""}</h2>
      ${v.error ? `<p class="acct-note bad" role="alert">${esc(v.error)}</p>` : ""}
      ${v.loading && !v.accounts ? `<p class="hint">Loading accounts…</p>`
        : list.length ? `<div class="sa-list">${list.map(accountRow).join("")}</div>`
        : `<p class="hint">No students have created an account yet. Send them the link above.</p>`}`;
  }
  // ---------- Records → Students: searchable list of registered students ----------
  // Shown to Dive Masters and up when online logins are set up. Search by name, email, phone, address or cert.
  function directoryOn() { return !!(C().configured && C().available); }
  function hay(acc) {
    return [acc.full_name, acc.email, acc.phone, String(acc.phone || "").replace(/\D/g, ""), acc.address, acc.emergency_name,
      certsOf(acc).map(certText).join(" "), (linkedPerson(acc) || {}).name, roleName(acc.role)].join(" ").toLowerCase();
  }
  function dirMatches() {
    const words = v.dq.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (v.members || []).filter(a => (!v.dlevel || (a.role || "student") === v.dlevel) && words.every(w => hay(a).includes(w)))
      .sort((a, b) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || ""));
  }
  function dirList() {
    const { esc } = L(), list = dirMatches();
    if (v.loading && !v.members) return `<li class="meta" style="padding:8px 10px">Loading…</li>`;
    if (!list.length) return `<li class="meta" style="padding:8px 10px">${(v.members || []).length ? "No matches." : "No one has registered yet."}</li>`;
    return list.map(a => `<li><button data-sa="dpick" data-acc="${esc(a.id)}" class="dir-item${a.id === v.dsel ? " sel" : ""}"${a.id === v.dsel ? ' aria-current="true"' : ""}>
        ${avatar(a, "photo-xs")}<span class="dir-txt"><span class="nm">${esc(a.full_name || "No name yet")}</span>
        <span class="meta">${esc(a.phone || a.email || "")}</span></span>${a.deactivated ? `<span class="sa-badge wait">Deactivated</span>` : ""}${(a.role || "student") !== "student" ? `<span class="sa-badge lvl">${esc(roleName(a.role))}</span>` : ""}</button></li>`).join("");
  }
  function countText() { return dirMatches().length + " of " + (v.members || []).length + " registered"; }
  function telLink(n) { const d = String(n || "").replace(/[^\d+]/g, ""); return d.length >= 7 ? `<a href="tel:${L().esc(d)}">${L().esc(n)}</a>` : L().esc(n || ""); }
  function dirDetail(acc) {
    const { esc, fmtDate } = L(), p = linkedPerson(acc), certs = certsOf(acc);
    const row = (label, html) => html ? `<dt>${label}</dt><dd>${html}</dd>` : "";
    const map = acc.address ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(acc.address)}" target="_blank" rel="noopener">${esc(acc.address)}</a>` : "";
    const enrolled = p ? L().state.enrollments.filter(e => e.studentId === p.id && L().COURSES[e.course]) : [];
    return `<div class="rec-head"><div class="who dir-head">${avatar(acc, "photo-md")}<div><span class="eyebrow">${(acc.role || "student") === "student" ? "Registered student" : esc(roleName(acc.role))}</span>
        <h1>${esc(acc.full_name || "No name yet")}</h1>
        <span class="sub">${acc.deactivated ? `<span class="sa-badge wait">Deactivated</span> ` : ""}${acc.email_confirmed ? "" : `<span class="sa-badge wait">Email not confirmed</span> `}${acc.updated_at ? "Updated " + esc(fmtDate(String(acc.updated_at).slice(0, 10))) : ""}</span></div></div></div>
      <div class="dir-actions">${acc.phone ? `<a class="btn primary" href="tel:${esc(String(acc.phone).replace(/[^\d+]/g, ""))}">Call</a><a class="btn" href="sms:${esc(String(acc.phone).replace(/[^\d+]/g, ""))}">Text</a>` : ""}
        ${acc.email ? `<a class="btn" href="mailto:${esc(acc.email)}" data-email-to="${esc(acc.email)}" data-email-name="${esc(acc.full_name || "")}">Email</a>` : ""}
        <button class="btn" data-sa="dcopy" data-acc="${esc(acc.id)}">Copy contact</button></div>
      <h2 class="sec">Contact</h2>
      <dl class="dir-dl">${row("Phone", telLink(acc.phone))}${row("Email", acc.email ? `<a href="mailto:${esc(acc.email)}">${esc(acc.email)}</a>` : "")}${row("Address", map)}</dl>
      <h2 class="sec">Emergency contact</h2>
      ${acc.emergency_name || acc.emergency_phone ? `<dl class="dir-dl">${row("Name", esc([acc.emergency_name, acc.emergency_relationship ? "(" + acc.emergency_relationship + ")" : ""].filter(Boolean).join(" ")))}${row("Phone", telLink(acc.emergency_phone))}</dl>` : `<p class="hint">None given yet.</p>`}
      <h2 class="sec">Certifications</h2>
      ${certs.length ? `<ul class="dir-certs">${certs.map(c => `<li>${esc(certText(c))}</li>`).join("")}</ul>` : `<p class="hint">None listed yet.</p>`}
      ${techBlock(acc)}
      ${toolsBlock(acc)}
      ${logbookBlock(acc)}
      ${siteAdminBlock(acc)}
      <h2 class="sec">Course records</h2>
      ${p ? `<p class="hint">${enrolled.length ? enrolled.map(e => esc(L().COURSES[e.course].name)).join(", ") : "No courses yet"} · <button class="linkbtn" data-sa="open" data-id="${esc(p.id)}">Open ${esc(p.name || "their")} record</button></p>`
        : `<p class="hint">Not linked to a course record in this browser yet.${C().can("instructor") ? "" : " An Instructor can link it."}</p>`}
      ${C().can("instructor") && !p ? linkBlock(acc) : ""}
      ${accountBlock(acc)}`;
  }
  // Deactivate, reactivate or delete the account (Admins only, never their own), through the
  // manage-account Edge Function (supabase/functions/manage-account), which holds the service role key.
  function accountBlock(acc) {
    const { esc } = L(), c = C();
    if (!c.can("admin")) return "";
    const h = `<h2 class="sec">Account</h2>`, name = esc(acc.full_name || acc.email || "this member");
    if (c.user && acc.id === c.user.id) return `${h}<p class="hint">This is your own account. Another Admin can deactivate or delete it.</p>`;
    const busy = v.acctBusy === acc.id ? " disabled" : "";
    if (v.delAsk === acc.id) return `${h}<div class="acct-note bad" role="alert"><p style="margin:0 0 6px"><b>Delete ${name}'s account for good?</b></p>
        <p style="margin:0 0 6px">This can't be undone. It removes their login, profile and photo, course progress, learning agreements (signed ones too),
        sign-ups, class requests, dive log, dive sites and site map photos. Print anything you need to keep first.
        To stop them signing in but keep everything, choose Deactivate instead.</p>
        <div class="row-actions"><button class="btn danger" data-sa="acctdel" data-acc="${esc(acc.id)}"${busy}>${v.acctBusy === acc.id ? "Deleting…" : "Yes, delete for good"}</button>
        <button class="btn" data-sa="acctdelno"${busy}>Cancel</button></div></div>`;
    const off = acc.deactivated === true;
    return `${h}<p class="hint tech-state"><span class="sa-badge${off ? " wait" : ""}">${off ? "Deactivated" : "Active"}</span>
        ${off ? "They can't sign in. Everything on their account is kept until you reactivate or delete it." : "They can sign in and use the site."}</p>
      <div class="row-actions">${off
        ? `<button class="btn primary" data-sa="acctset" data-do="reactivate" data-acc="${esc(acc.id)}"${busy}>Reactivate account</button>`
        : `<button class="btn" data-sa="acctset" data-do="deactivate" data-acc="${esc(acc.id)}"${busy}>Deactivate account</button>`}
        <button class="btn danger" data-sa="acctdelask" data-acc="${esc(acc.id)}"${busy}>Delete account…</button></div>
      ${off ? "" : `<p class="hint">Deactivating signs them out within the hour and stops them signing in again until you reactivate it.</p>`}
      ${typeof acc.deactivated !== "boolean" ? `<p class="hint">Run the latest <code>supabase/schema.sql</code> so this list shows who is deactivated.</p>` : ""}`;
  }
  async function manageAccount(acc, action) {
    v.acctBusy = acc.id; rerender();
    let res, err;
    try { res = await C().client.functions.invoke("manage-account", { body: { action, member: acc.id } }); err = res.error; }
    catch (x) { err = x; }
    v.acctBusy = null;
    if (!err && !(res && res.data && res.data.done === action)) err = { message: "The manage-account function in Supabase isn't the Limitless Diving code. Paste it again from supabase/functions/manage-account/index.ts and deploy." };
    if (err) {
      let j = null;
      try { if (err.context && typeof err.context.json === "function") j = await err.context.json(); } catch (x) { /* not JSON */ }
      const why = j && j.error ? j.error
        : /FetchError/.test(String(err.name || "")) ? "The site couldn't reach the manage-account function in Supabase. Check it's deployed with that exact name and Verify JWT is off."
        : C().explain(err);
      rerender(); L().toast("Not done. " + why); return false;
    }
    return true;
  }
  // Elements of tech diving (tech-diving.html): Instructors and Admins switch it on per person.
  function techBlock(acc) {
    const { esc } = L();
    const staffSees = ["instructor", "admin"].includes(acc.role || "student");
    let body;
    if (typeof acc.tech_access !== "boolean") body = `<p class="hint">Run the latest <code>supabase/schema.sql</code> to switch this on for students.</p>`;
    else if (staffSees) body = `<p class="hint">${esc(roleName(acc.role))}s always have access.</p>`;
    else {
      const on = acc.tech_access;
      body = `<p class="hint tech-state"><span class="sa-badge${on ? "" : " wait"}">${on ? "On" : "Off"}</span> ${on ? "They see Elements of tech diving in their menu and Student portal." : "Hidden from them. Switch it on when they're ready."}</p>
        ${C().can("instructor") ? `<div class="row-actions"><button class="btn${on ? "" : " primary"}" data-sa="tech" data-acc="${esc(acc.id)}" data-on="${on ? "0" : "1"}" aria-pressed="${on}"${v.busy ? " disabled" : ""}>${on ? "Turn off access" : "Turn on access"}</button></div>` : ""}`;
    }
    return `<h2 class="sec">Elements of tech diving</h2>${body}`;
  }
  // Tools (nitrox.html, diving-physics.html): on for every account unless an Instructor or Admin switches one off.
  const TOOLS = [["nitrox", "Nitrox calculator"], ["physics", "Diving physics"]];
  function toolsBlock(acc) {
    const { esc } = L();
    const staff = ["divemaster", "instructor", "admin"].includes(acc.role || "student");
    let body;
    if (typeof acc.nitrox_access !== "boolean") body = `<p class="hint">Run the latest <code>supabase/schema.sql</code> to switch these on or off for students.</p>`;
    else if (staff) body = `<p class="hint">${esc(roleName(acc.role))}s always have the Nitrox calculator and Diving physics.</p>`;
    else body = TOOLS.map(([t, name]) => {
      const on = acc[t + "_access"];
      return `<div class="tool-switch"><p class="hint tech-state"><span class="sa-badge${on ? "" : " wait"}">${on ? "On" : "Off"}</span> <b>${esc(name)}</b>: ${on ? "they can open it." : "hidden from them."}</p>
        ${C().can("instructor") ? `<div class="row-actions"><button class="btn small${on ? "" : " primary"}" data-sa="tool" data-tool="${t}" data-acc="${esc(acc.id)}" data-on="${on ? "0" : "1"}" aria-pressed="${on}" aria-label="${on ? "Turn off" : "Turn on"} ${esc(name)}"${v.busy ? " disabled" : ""}>${on ? "Turn off" : "Turn on"}</button></div>` : ""}</div>`;
    }).join("");
    return `<h2 class="sec">Tools</h2>${body}`;
  }
  // Dive log book (logbook.html): on automatically for anyone registered for a class and for staff.
  // Instructors and Admins can also switch it on by hand for one person.
  // Site maps access (site_map_members): which lines of the site maps they see, or whether they help survey or run
  // the maps. Same levels as SurveyMap.LEVELS in survey-map.js. Admins only.
  const SITE_LEVELS = [
    ["none", "No access", "They can't open the site maps."],
    ["green", "Green circle: open water divers", "They see the green circle lines."],
    ["blue", "Blue square: advanced divers", "They see the green circle and blue square lines."],
    ["black", "Black diamond: tech divers", "They see the green circle, blue square and black diamond lines."],
    ["double-black", "Double black diamond: tech on scooters", "They see every rated line."],
    ["survey", "Survey team", "They see every line and can suggest changes to the maps. An admin approves each change before it goes on."],
    ["site-admin", "Dive site admin", "They run the site maps: publish changes, rate lines, place maps, add layers, approve photos and set other members' access below Dive site admin. None of the website's other Admin powers."],
  ];
  // Loads everyone's level once (site_map_members); returns null while loading, or { error }.
  function siteLevels() {
    if (!v.siteLevels && !v.siteLevelsLoading) {
      v.siteLevelsLoading = true;
      C().client.from("site_map_members").select("user_id, level").then(({ data, error }) => {
        v.siteLevelsLoading = false;
        v.siteLevels = error ? { error: /site_map_members|does not exist|schema cache/i.test(error.message || "") ? "setup" : C().explain(error) } : new Map(data.map(r => [r.user_id, r.level]));
        rerender();
      });
    }
    return v.siteLevels || null;
  }
  function siteLevelSelect(acc, label) {
    const { esc } = L(), cur = v.siteLevels.get(acc.id) || "none";
    return `<select data-sa-sitelevel="${esc(acc.id)}" aria-label="${esc(label)}"${v.siteBusy === acc.id ? " disabled" : ""}>
        ${SITE_LEVELS.map(l => `<option value="${l[0]}"${l[0] === cur ? " selected" : ""}>${esc(l[1])}</option>`).join("")}</select>`;
  }
  function siteLevelsError() {
    return v.siteLevels.error === "setup" ? "Run the latest <code>supabase/schema.sql</code> to use this." : L().esc(v.siteLevels.error);
  }
  function siteAdminBlock(acc) {
    const { esc } = L();
    if (!C().can("admin")) return "";
    const h = `<h2 class="sec">Site maps access</h2>`;
    if (acc.role === "admin") return `${h}<p class="hint">Admins always see and run all the site maps.</p>`;
    if (!siteLevels()) return `${h}<p class="hint">Loading…</p>`;
    if (v.siteLevels.error) return `${h}<p class="hint">${siteLevelsError()}</p>`;
    const cur = v.siteLevels.get(acc.id) || "none", info = SITE_LEVELS.find(l => l[0] === cur) || SITE_LEVELS[0];
    return `${h}<div class="row-actions"><label>Level ${siteLevelSelect(acc, "Site maps access for " + (acc.full_name || "this member"))}</label>
        <button class="btn small" data-sa="sitemaps">Everyone's site maps access</button></div>
      <p class="hint">${esc(info[2])} Each level also sees everything below it. Changes save as soon as you pick.</p>`;
  }
  // Everyone in the list (as searched and filtered) with their site maps access, to set in one place.
  function siteAccessPanel() {
    const { esc } = L(), h = `<div class="rec-head"><div class="who"><div><span class="eyebrow">Registered students and staff</span><h1>Site maps access</h1></div></div></div>`;
    if (!siteLevels()) return `${h}<p class="hint">Loading…</p>`;
    if (v.siteLevels.error) return `${h}<p class="hint">${siteLevelsError()}</p>`;
    const list = dirMatches();
    return `${h}<p class="hint">Members see the lines for their level and every level below it: green circles for open water divers, blue squares for advanced,
        black diamonds for tech, and double black diamonds for tech on scooters. The survey team sees everything and can suggest changes, which an admin approves.
        Members with no access can't open the site maps. Changes save as soon as you pick. The search and level filter on the left narrow this list.</p>
      ${list.length ? `<ul class="sa-sitelist">${list.map(a => `<li><button class="linkbtn" data-sa="dpick" data-acc="${esc(a.id)}">${esc(a.full_name || a.email || "No name yet")}</button>
        ${(a.role || "student") === "admin" ? `<span class="hint">Admin: always sees and runs everything</span>` : siteLevelSelect(a, "Site maps access for " + (a.full_name || "this member"))}</li>`).join("")}</ul>`
        : `<p class="hint">No one matches the search.</p>`}`;
  }
  function logbookBlock(acc) {
    const { esc } = L();
    const staff = ["divemaster", "instructor", "admin"].includes(acc.role || "student");
    let body;
    if (typeof acc.logbook_access !== "boolean") body = `<p class="hint">Run the latest <code>supabase/schema.sql</code> to switch this on for students.</p>`;
    else if (staff) body = `<p class="hint">${esc(roleName(acc.role))}s always have a log book.</p>`;
    else {
      const on = acc.logbook_access, auto = acc.logbook_auto === true;
      const state = on || auto;
      const why = auto && !on ? "On automatically: they're registered for a class."
        : auto && on ? "On. They're registered for a class, and you've switched it on too."
        : on ? "On. You switched it on for them." : "Off until they're registered for a class. Switch it on to open it now.";
      body = `<p class="hint tech-state"><span class="sa-badge${state ? "" : " wait"}">${state ? "On" : "Off"}</span> ${esc(why)}</p>
        ${C().can("instructor") && !(auto && !on) ? `<div class="row-actions"><button class="btn${on ? "" : " primary"}" data-sa="logbook" data-acc="${esc(acc.id)}" data-on="${on ? "0" : "1"}" aria-pressed="${on}"${v.busy ? " disabled" : ""}>${on ? "Turn off log book" : "Turn on log book"}</button>
          ${on ? `<a class="btn" style="text-decoration:none" href="logbook.html#member=${esc(acc.id)}" target="_blank" rel="noopener">Open their log book</a>` : ""}</div>`
          : state ? `<div class="row-actions"><a class="btn" style="text-decoration:none" href="logbook.html#member=${esc(acc.id)}" target="_blank" rel="noopener">Open their log book</a></div>` : ""}`;
    }
    return `<h2 class="sec">Dive log book</h2>${body}`;
  }
  function renderDirectory(switchHtml) {
    const { esc } = L();
    if (!v.members && !v.loading && !v.error) setTimeout(loadAccounts, 0);
    const list = v.members || [];
    const lv = (r, l) => `<option value="${r}"${v.dlevel === r ? " selected" : ""}>${l}</option>`;
    if (!list.some(a => a.id === v.dsel)) v.dsel = (dirMatches()[0] || {}).id || null;
    const acc = list.find(a => a.id === v.dsel);
    return `<aside class="roster no-print" id="dir-panel">${switchHtml || ""}
        <input type="search" id="dir-q" placeholder="Search name, phone, email, city, cert" value="${esc(v.dq)}" aria-label="Search registered students" autocomplete="off">
        <select id="dir-level" aria-label="Show level">${lv("", "All levels")}${lv("student", "Students")}${lv("divemaster", "Dive Masters")}${lv("instructor", "Instructors")}${lv("admin", "Admins")}</select>
        <span class="meta dir-count" id="dir-count">${list.length ? countText() : ""}</span>
        ${v.membersOld ? `<p class="hint" style="margin:0">Showing students only. Run the latest <code>supabase/schema.sql</code> to include staff.</p>` : ""}
        <ul id="dir-list">${dirList()}</ul>
        <span class="row-actions" style="margin:0"><button class="btn small" data-sa="refresh">Refresh list</button>
        ${C().can("instructor") && list.length ? `<button class="btn small" data-sa="demail" title="Email everyone in the list as it's filtered now">✉ Email this list</button>` : ""}
        ${C().can("admin") && list.length ? `<button class="btn small${v.dview === "sitemaps" ? " primary" : ""}" data-sa="sitemaps" aria-pressed="${v.dview === "sitemaps"}">Site maps access</button>` : ""}</span></aside>
      <section class="panel" id="record">${v.error ? `<p class="acct-note bad" role="alert">${esc(v.error)}</p>` : ""}
        ${v.dview === "sitemaps" && C().can("admin") ? siteAccessPanel() : acc ? dirDetail(acc) : `<div class="empty"><h2>${v.loading ? "Loading students…" : "No registered students yet"}</h2>
          <p>Students show up here once they create an account on the <a href="account.html">Student portal</a> page.</p></div>`}</section>`;
  }

  function render() {
    const c = C();
    let body;
    if (!c.configured) body = setupBox();
    else if (!c.available) body = `<p class="acct-note bad">The sign-in service couldn't be loaded. Check your connection and reload the page.</p>`;
    else if (!c.user) body = signInBox();
    else if (!c.can("divemaster")) body = notStaffBox();
    else body = signedInBox();
    const title = c.user && c.can("divemaster") ? "Student accounts" : "Admin log in";
    return `<section class="panel" id="sa-panel"><div class="rec-head"><div class="who"><span class="eyebrow">Staff</span><h1>${title}</h1></div></div>
      ${body}${studentBox()}</section>`;
  }
  function rerender() { if (L().state && (document.getElementById("sa-panel") || document.getElementById("dir-panel"))) L().render(); }

  // A line on each student's page in the Students tab.
  function personNote(p) {
    const { esc } = L();
    if (!C().configured) return "";
    if (!p.accountId) return `<p class="hint">No student account linked. Link one under <button class="linkbtn" data-mode="staff">Admin Log in</button>.</p>`;
    const acc = (v.accounts || []).find(a => a.id === p.accountId);
    return `<p class="hint"><span class="sa-badge">Account linked</span> ${acc ? esc(acc.email) : ""} · <button class="linkbtn" data-mode="staff">Manage</button></p>`;
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
  async function setRole(email, role) {
    const { error } = await C().client.rpc("set_staff_role", { member_email: email, new_role: role });
    if (error) { setNote(C().explain(error), "bad"); rerender(); return false; }
    setNote(role === "student" ? email + " is a Student again." : email + " is now " + (role === "admin" ? "an " : "a ") + roleName(role) + ".", "ok");
    await loadAccounts();
    return true;
  }
  document.addEventListener("change", (e) => {
    const el = e.target; if (!el.dataset) return;
    if (el.dataset.saSitelevel) { setSiteLevel(el.dataset.saSitelevel, el.value); return; }
    if (!el.dataset.saRole) return;
    setRole(el.dataset.saRole, el.value);
  });
  async function setSiteLevel(id, level) {
    const acc = (v.members || []).concat(v.accounts || []).find(a => a.id === id) || {};
    v.siteBusy = id; rerender();
    const { error } = await C().client.rpc("set_site_map_level", { member: id, new_level: level });
    v.siteBusy = null;
    if (error) { rerender(); L().toast("Not changed: " + C().explain(error)); return; }
    if (v.siteLevels && !v.siteLevels.error) { if (level === "none") v.siteLevels.delete(id); else v.siteLevels.set(id, level); }
    rerender();
    L().toast("Site maps access for " + (acc.full_name || "them") + ": " + SITE_LEVELS.find(l => l[0] === level)[1]);
  }
  document.addEventListener("submit", async (e) => {
    if (e.target.id !== "sa-addrole") return;
    e.preventDefault();
    const email = document.getElementById("sa-new-email").value.trim(), role = document.getElementById("sa-new-role").value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setNote("Enter the email they signed up with.", "bad"); rerender(); return; }
    await setRole(email, role);
  });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-sa]"); if (!b) return;
    const acc = (v.accounts || []).find(a => a.id === b.dataset.acc) || (v.members || []).find(a => a.id === b.dataset.acc);
    switch (b.dataset.sa) {
      case "copy":
        try { await navigator.clipboard.writeText(accountPageUrl()); L().toast("Link copied"); } catch (err) { L().toast("Couldn't copy. Select the link and copy it."); }
        break;
      case "signout": await C().signOut(); v.accounts = null; v.staff = null; v.members = null; setNote(""); rerender(); break;
      case "recheck": await C().refreshRole(); headerButton(); if (C().can("divemaster")) loadAccounts(); else { setNote(""); rerender(); L().toast("Still a student account. Ask an Admin for a staff role."); } break;
      case "refresh": setNote(""); loadAccounts(); break;
      case "sitemaps": v.dview = v.dview === "sitemaps" && !b.closest("#record") ? null : "sitemaps"; rerender(); break;
      case "dpick": v.dsel = b.dataset.acc; v.dview = null; v.delAsk = null; rerender(); { const r = document.getElementById("record"); if (r && window.innerWidth < 820) r.scrollIntoView({ behavior: "smooth", block: "start" }); } break;
      case "demail": {
        const to = dirMatches().filter(a => a.email).map(a => ({ name: a.full_name || "", email: a.email }));
        const lvl = { student: "Students", divemaster: "Dive Masters", instructor: "Instructors", admin: "Admins" }[v.dlevel];
        if (!to.length) { L().toast("No one in the list has an email address"); break; }
        const about = lvl ? "all " + lvl.toLowerCase() : v.dq.trim() ? "the people found" : "everyone registered";
        // A whole list goes through Email groups, which leaves out anyone who opted out and adds unsubscribe links.
        if (window.LDEmailGroups) window.LDEmailGroups.preset(dirMatches().map(a => a.id), about);
        else if (window.LDEmail) window.LDEmail.open({ to, about });
        break;
      }
      case "dcopy": {
        const t = [acc.full_name, acc.phone, acc.email, acc.address].filter(Boolean).join("\n");
        try { await navigator.clipboard.writeText(t); L().toast("Contact copied"); } catch (err) { L().toast("Couldn't copy. Select the details and copy them."); }
        break;
      }
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
      case "tech": {
        if (!acc) break;
        const allow = b.dataset.on === "1";
        v.busy = true; rerender();
        const { error } = await C().client.rpc("set_tech_access", { member: acc.id, allow });
        v.busy = false;
        if (error) { rerender(); L().toast("Not changed: " + C().explain(error)); break; }
        acc.tech_access = allow;
        (v.members || []).concat(v.accounts || []).forEach(a => { if (a.id === acc.id) a.tech_access = allow; });
        setNote(""); rerender();
        L().toast(allow ? "Elements of tech diving is on for " + (acc.full_name || "them") : "Elements of tech diving is off for " + (acc.full_name || "them"));
        break;
      }
      case "tool": {
        if (!acc) break;
        const tool = b.dataset.tool, allow = b.dataset.on === "1", name = (TOOLS.find(x => x[0] === tool) || [, "Tool"])[1];
        v.busy = true; rerender();
        const { error } = await C().client.rpc("set_tool_access", { member: acc.id, tool, allow });
        v.busy = false;
        if (error) { rerender(); L().toast("Not changed: " + C().explain(error)); break; }
        (v.members || []).concat(v.accounts || [], [acc]).forEach(a => { if (a.id === acc.id) a[tool + "_access"] = allow; });
        setNote(""); rerender();
        L().toast(name + (allow ? " is on for " : " is off for ") + (acc.full_name || "them"));
        break;
      }
      case "logbook": {
        if (!acc) break;
        const allow = b.dataset.on === "1";
        v.busy = true; rerender();
        const { error } = await C().client.rpc("set_logbook_access", { member: acc.id, allow });
        v.busy = false;
        if (error) { rerender(); L().toast("Not changed: " + C().explain(error)); break; }
        (v.members || []).concat(v.accounts || [], [acc]).forEach(a => { if (a.id === acc.id) a.logbook_access = allow; });
        setNote(""); rerender();
        L().toast(allow ? "Dive log book is on for " + (acc.full_name || "them") : "Dive log book switched off for " + (acc.full_name || "them") + (acc.logbook_auto ? " (still on: registered for a class)" : ""));
        break;
      }
      case "acctset": {
        if (!acc) break;
        const action = b.dataset.do;
        if (!(await manageAccount(acc, action))) break;
        (v.members || []).concat(v.accounts || [], [acc]).forEach(a => { if (a.id === acc.id) a.deactivated = action === "deactivate"; });
        rerender();
        L().toast((acc.full_name || acc.email || "The account") + (action === "deactivate" ? " is deactivated. They can't sign in until you reactivate it." : " is active again. They can sign in as before."));
        break;
      }
      case "acctdelask": if (acc) { v.delAsk = acc.id; rerender(); } break;
      case "acctdelno": v.delAsk = null; rerender(); break;
      case "acctdel": {
        if (!acc || v.delAsk !== acc.id) break;
        if (!(await manageAccount(acc, "delete"))) break;
        v.delAsk = null;
        // Keep the course record in this browser, just no longer linked to an account.
        people().filter(p => p.accountId === acc.id).forEach(p => { p.accountId = ""; });
        L().save();
        v.members = (v.members || []).filter(a => a.id !== acc.id);
        v.accounts = (v.accounts || []).filter(a => a.id !== acc.id);
        if (v.dsel === acc.id) v.dsel = null;
        rerender();
        L().toast((acc.full_name || acc.email || "The account") + " was deleted.");
        break;
      }
      case "share": {
        v.busy = true; setNote(""); rerender();
        try { const n = await shareProgress(); setNote("Shared " + n + " course record" + (n === 1 ? "" : "s") + ". Students see it on their account page now.", "ok"); }
        catch (err) { setNote("Not shared: " + C().explain(err), "bad"); }
        v.busy = false; rerender();
        break;
      }
    }
  });

  // The "Admin Log in" button in the header shows who is signed in once staff log in.
  function headerButton() {
    const b = document.getElementById("admin-login"); if (!b) return;
    const staff = C().user && C().can("divemaster");
    b.textContent = staff ? "✓ " + roleName(C().role) : "Admin Log in";
    b.title = staff ? "Signed in as " + (C().user.email || "") + ". Open staff tools." : "Log in as staff";
    b.classList.toggle("on", !!staff);
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("#admin-login"); if (!b || !L()) return;
    e.preventDefault(); L().go("staff");
  });
  if (location.hash === "#staff") L().go("staff");

  if (window.LDCloud && window.LDCloud.available) {
    window.LDCloud.onChange((event) => {
      if (!C().user) { v.accounts = null; v.staff = null; v.members = null; }
      headerButton();
      if (C().can("divemaster") && !v.accounts && !v.loading) loadAccounts();
      // Redraw for sign-in changes (not hourly token refreshes, which would interrupt typing).
      if (/^(INITIAL_SESSION|SIGNED_IN|SIGNED_OUT|USER_UPDATED)$/.test(event)) L().render();
    });
  }

  // Live search: redraw only the list so typing isn't interrupted.
  document.addEventListener("input", (e) => {
    if (e.target.id !== "dir-q" && e.target.id !== "dir-level") return;
    if (e.target.id === "dir-q") v.dq = e.target.value; else v.dlevel = e.target.value;
    const ul = document.getElementById("dir-list"); if (ul) ul.innerHTML = dirList();
    const n = document.getElementById("dir-count"); if (n && v.members) n.textContent = countText();
  });

  window.LDAccount = { render, personNote, summary, directoryOn, renderDirectory, applyAccount };
  L().render();
})();
