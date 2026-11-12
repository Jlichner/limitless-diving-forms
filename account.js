/* Limitless Diving — the student account page (account.html).
   Students create an account, sign in, and keep their own details up to date: name, address, phone,
   emergency contact and current certifications. They also see the training progress the instructor
   shares with them and the upcoming classes. Supabase row-level security (supabase/schema.sql) makes
   sure each student can only read and change their own record. */
(function () {
  "use strict";

  const G = window.LDCalGrid, esc = G.esc;
  const main = document.getElementById("acct");
  // Agencies and certification suggestions come from the course catalog (catalog.js), which lists every NAUI, NAUI Technical and TDI course.
  const CAT = window.LDCatalog;
  const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","PR","VI","GU"];
  const AGENCIES = CAT ? CAT.CERT_AGENCIES : ["NAUI", "NAUI Technical", "TDI", "PADI", "SSI", "SDI", "RAID", "GUE", "NASE", "BSAC", "CMAS", "IANTD", "Other"];
  const listId = (a) => "cert-levels-" + (AGENCIES.indexOf(a) < 0 ? "any" : AGENCIES.indexOf(a));
  function certLists() {
    const names = (a) => CAT ? CAT.certNames(a) : ["Scuba Diver", "Open Water Scuba Diver", "Advanced Open Water Scuba Diver", "Nitrox Diver", "Rescue Scuba Diver", "Master Scuba Diver", "Divemaster", "Assistant Instructor", "Instructor", "First Aid / CPR", "Emergency Oxygen Provider (EO2)"];
    const dl = (id, list) => `<datalist id="${id}">${list.map(x => `<option value="${esc(x)}">`).join("")}</datalist>`;
    return AGENCIES.map(a => dl(listId(a), names(a))).join("") + dl("cert-levels-any", names(""));
  }
  const ROSE = `<svg class="acct-rose" aria-hidden="true" viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" fill="none" stroke-width="3"></circle>${[0, 90, 180, 270].map(a => `<polygon points="100,6 90,100 110,100" stroke="none" transform="rotate(${a} 100 100)"></polygon>`).join("")}${[45, 135, 225, 315].map(a => `<polygon points="100,38 94,100 106,100" stroke="none" transform="rotate(${a} 100 100)"></polygon>`).join("")}</svg>`;

  // view.auth: "signin" | "signup" | "forgot" | "recover" (set a new password after the email link)
  const view = { auth: "signin", note: "", noteKind: "", busy: false, vals: {} };  // vals: what was typed in the sign-in form (not passwords)
  let profile = null, progress = [], classes = [], loadError = "", lastUser = null;

  let toastTimer;
  function toast(msg) { const t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600); }
  function money(n) { return "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pageUrl() { return location.origin + location.pathname; }
  function note() { return view.note ? `<p class="acct-note ${view.noteKind}" role="${view.noteKind === "bad" ? "alert" : "status"}">${esc(view.note)}</p>` : ""; }
  function setNote(text, kind) { view.note = text || ""; view.noteKind = kind || ""; }

  // ---------- signed out ----------
  function field(id, label, type, attrs) {
    const val = type === "password" ? "" : ` value="${esc(view.vals[id] || "")}"`;
    return `<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${id}" type="${type || "text"}"${val} ${attrs || ""}></div>`;
  }
  function renderAuth() {
    const a = view.auth;
    const title = { signin: "Student log in", signup: "Create your student account", forgot: "Reset your password", recover: "Choose a new password" }[a];
    const intro = {
      signin: "Log in to update your contact details, emergency contact and certifications, and to follow your training.",
      signup: "Create an account so your instructor has your up-to-date details, and so you can follow your training progress.",
      forgot: "Enter the email you signed up with and we'll send you a link to choose a new password.",
      recover: "Enter a new password for your account."
    }[a];
    let form = "";
    if (a === "signin") form = field("a-email", "Email", "email", 'autocomplete="email" required') + field("a-pass", "Password", "password", 'autocomplete="current-password" required');
    if (a === "signup") form = field("a-name", "Full name", "text", 'autocomplete="name" required maxlength="200"') + field("a-email", "Email", "email", 'autocomplete="email" required')
      + field("a-pass", "Password (at least 8 characters)", "password", 'autocomplete="new-password" minlength="8" required');
    if (a === "forgot") form = field("a-email", "Email", "email", 'autocomplete="email" required');
    if (a === "recover") form = field("a-pass", "New password (at least 8 characters)", "password", 'autocomplete="new-password" minlength="8" required');
    const button = { signin: "Log in", signup: "Create account", forgot: "Send reset link", recover: "Save new password" }[a];
    const links = {
      signin: `<button type="button" class="linkbtn" data-auth="signup">New student? Create an account</button><button type="button" class="linkbtn" data-auth="forgot">Forgot your password?</button>`,
      signup: `<button type="button" class="linkbtn" data-auth="signin">Already have an account? Log in</button>`,
      forgot: `<button type="button" class="linkbtn" data-auth="signin">Back to log in</button>`,
      recover: ""
    }[a];
    return `<section class="acct-auth">
      <div class="acct-auth-art"><img class="acct-logo" src="logo-badge.webp" width="480" height="480" alt="Limitless Diving &amp; Technical Training logo"><small>Training · Safety · Adventure</small></div>
      <form class="acct-card" id="auth-form" novalidate>
        <span class="eyebrow">Limitless Diving students</span>
        <h1>${title}</h1>
        <p class="hint">${intro}</p>
        ${note()}
        <div class="acct-fields">${form}</div>
        <button class="btn primary wide" type="submit"${view.busy ? " disabled" : ""}>${view.busy ? "Please wait…" : button}</button>
        <div class="acct-links">${links}</div>
      </form></section>`;
  }

  // ---------- signed in ----------
  function input(k, label, type, extra, attrs) {
    return `<div class="field${extra ? " " + extra : ""}"><label for="p-${k}">${label}</label><input id="p-${k}" data-p="${k}" type="${type || "text"}" value="${esc(profile[k])}" ${attrs || ""}></div>`;
  }
  function certRow(c, i) {
    const known = AGENCIES.includes(c.agency);
    return `<div class="cert-row" data-i="${i}">
      <div class="field"><label for="c-${i}-agency">Agency</label><select id="c-${i}-agency" data-c="agency">
        <option value="">Choose</option>${AGENCIES.map(x => `<option${x === c.agency ? " selected" : ""}>${esc(x)}</option>`).join("")}
        ${c.agency && !known ? `<option selected>${esc(c.agency)}</option>` : ""}</select></div>
      <div class="field"><label for="c-${i}-level">Certification</label><input id="c-${i}-level" data-c="level" list="${listId(c.agency)}" value="${esc(c.level)}" placeholder="Pick from the list or type your own" maxlength="120"></div>
      <div class="field"><label for="c-${i}-number">Cert number</label><input id="c-${i}-number" data-c="number" value="${esc(c.number)}" maxlength="60"></div>
      <div class="field"><label for="c-${i}-date">Date certified</label><input id="c-${i}-date" data-c="date" type="date" value="${esc(c.date)}"></div>
      <button type="button" class="btn small danger" data-act="rm-cert" data-i="${i}" aria-label="Remove this certification">Remove</button>
    </div>`;
  }
  function gauge(pct) {
    const r = 34, len = Math.PI * r, f = Math.max(0, Math.min(100, Number(pct) || 0));
    return `<svg class="acct-gauge" viewBox="0 0 84 50" role="img" aria-label="${f}% complete">
      <path class="track" d="M8 44 A34 34 0 0 1 76 44" fill="none" stroke-width="8" stroke-linecap="round"></path>
      <path class="fill" d="M8 44 A34 34 0 0 1 76 44" fill="none" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(len * f / 100).toFixed(1)} ${len.toFixed(1)}"></path>
      <text x="42" y="44" text-anchor="middle">${f}%</text></svg>`;
  }
  function stat(label, done, total) { return total ? `<div class="stat"><b>${done}/${total}</b><span>${esc(label)}</span></div>` : ""; }
  function progressCard(row) {
    const s = row.summary || {};
    const sched = (s.schedule || []).filter(d => d.label);
    const skills = Array.isArray(s.skillList) ? s.skillList : [];
    const left = skills.filter(x => !x.done);
    const updated = row.updated_at ? new Date(row.updated_at) : null;
    return `<article class="acct-course">
      <div class="acct-course-head">${gauge(s.pct)}<div><span class="eyebrow">${esc(s.agency || "Course")}</span><h3>${esc(s.courseName || row.course)}</h3>
        <span class="when">${esc(G.range(s.dates || []) || "Dates to be set")}${s.location ? " · " + esc(s.location) : ""}</span></div></div>
      <div class="stats">${stat("Skills mastered", s.skills && s.skills.done, s.skills && s.skills.total)}${stat(s.finalTitle || "Final evaluation", s.final && s.final.done, s.final && s.final.total)}
        ${stat("Prerequisites", s.prereqs && s.prereqs.done, s.prereqs && s.prereqs.total)}${stat("Dives logged", s.dives && s.dives.logged, s.dives && s.dives.total)}
        ${s.balanceDue != null ? `<div class="stat"><b class="money">${money(s.balanceDue)}</b><span>Balance due</span></div>` : ""}</div>
      ${sched.length ? `<h4>Schedule</h4><ul class="acct-sched">${sched.map(d => `<li><b>${esc(d.date ? G.fmt(d.date, { weekday: "short" }) : "Date TBD")}</b> ${esc(d.label)}</li>`).join("")}</ul>` : ""}
      ${s.time ? `<p class="hint">Time: ${esc(s.time)}</p>` : ""}
      ${skills.length ? `<details><summary>${left.length ? `${left.length} skill${left.length === 1 ? "" : "s"} still to master` : "Every required skill is mastered"}</summary>
        <ul class="acct-skills">${skills.map(x => `<li class="${x.done ? "done" : ""}"><span aria-hidden="true">${x.done ? "✓" : "○"}</span> ${esc(x.name)}${x.done ? `<span class="sr-only"> (mastered)</span>` : ""}</li>`).join("")}</ul></details>` : ""}
      ${updated && !isNaN(updated) ? `<p class="acct-updated">Updated ${esc(updated.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }))}</p>` : ""}
    </article>`;
  }
  function classCard(k, mine) {
    return `<li class="acct-class${mine ? " mine" : ""}"><i class="cal-dot ${/^k[0-5]$/.test(k.color || "") ? k.color : "k0"}" aria-hidden="true"></i>
      <div><b>${esc(k.title || k.course_name)}</b>${mine ? ` <span class="seats">You're enrolled</span>` : ""}
      <span>${esc(G.range(k.dates) || "Dates to be announced")}${k.location ? " · " + esc(k.location) : ""}</span></div></li>`;
  }
  function renderAccount() {
    const C = window.LDCloud, email = C.user.email || "";
    const certs = profile.certifications;
    const mineIds = new Set(progress.map(r => r.summary && r.summary.classId).filter(Boolean));
    const t = G.today();
    const upcoming = classes.filter(k => !k.dates.length || G.lastDate(k.dates) >= t);
    return `<section class="acct-hero">${avatar("photo-sm")}<div class="acct-hero-text"><span class="eyebrow">Signed in as ${esc(email)}</span>
        <h1>${esc(profile.full_name ? "Welcome, " + profile.full_name.split(/\s+/)[0] : "Welcome")}</h1>
        <p class="hint">Keep these details current. Your instructor uses them for your course paperwork and in an emergency.</p></div>
        <button class="btn" data-act="signout">Sign out</button></section>
      ${C.can("divemaster") ? `<p class="acct-note">You're signed in as ${C.role === "admin" || C.role === "instructor" ? "an" : "a"} ${esc(C.ROLE_NAMES[C.role])}. See every student's account under <a href="index.html#staff">Admin Log in</a>.</p>` : ""}
      ${loadError ? `<p class="acct-note bad" role="alert">${esc(loadError)}</p>` : ""}
      <div class="acct-cols">
      <form class="panel acct-profile" id="profile-form" novalidate>${ROSE.replace("acct-rose", "watermark")}
        <h2 class="sec">Your details</h2>
        <div class="photo-row">${avatar("photo-lg")}
          <div><b>Profile photo</b><p class="hint">A clear, recent photo of your face helps your instructor and dive team know you on the boat or at the shore.</p>
          <div class="row-actions"><label class="btn${view.photoBusy ? " is-busy" : ""}" for="photo-file">${view.photoBusy ? "Uploading…" : profile.photo_path ? "Change photo" : "Upload photo"}</label>
            <input type="file" id="photo-file" accept="image/jpeg,image/png,image/webp,image/heic,image/*" class="sr-only"${view.photoBusy ? " disabled" : ""}>
            ${profile.photo_path ? `<button type="button" class="btn danger" data-act="rm-photo">Remove</button>` : ""}</div></div></div>
        <div class="grid">${input("full_name", "Full name", "text", "wide", 'autocomplete="name" maxlength="200" required')}
          ${input("phone", "Phone number", "tel", "", 'autocomplete="tel" maxlength="50"')}</div>
        <h2 class="sec">Mailing address</h2>
        <div class="grid addr">${input("street", "Street", "text", "wide", 'autocomplete="street-address" maxlength="200" placeholder="e.g. 12 Reef Rd, Apt 3"')}
          ${input("city", "City", "text", "", 'autocomplete="address-level2" maxlength="100"')}
          ${input("state", "State", "text", "", 'autocomplete="address-level1" maxlength="40" list="us-states"')}
          ${input("zip", "Zip code", "text", "", 'autocomplete="postal-code" inputmode="numeric" maxlength="20" pattern="[0-9]{5}(-[0-9]{4})?"')}</div>
        <datalist id="us-states">${STATES.map(x => `<option value="${x}">`).join("")}</datalist>
        <h2 class="sec">Emergency contact</h2>
        <div class="grid">${input("emergency_name", "Name", "text", "", 'maxlength="200"')}${input("emergency_relationship", "Relationship", "text", "", 'maxlength="100" placeholder="e.g. Spouse, parent"')}
          ${input("emergency_phone", "Phone number", "tel", "", 'maxlength="50"')}</div>
        <h2 class="sec">Current certifications</h2>
        <p class="hint">Add every scuba or first aid certification you hold: choose the agency, then pick the certification from the list or type your own. Bring your cards to class.</p>
        <div class="certs">${certs.length ? certs.map(certRow).join("") : `<p class="hint"><b>None added yet.</b> New to diving? Leave this empty.</p>`}</div>
        ${certLists()}
        <div class="row-actions"><button type="button" class="btn" data-act="add-cert">+ Add a certification</button></div>
        <div class="acct-save"><button class="btn primary" type="submit"${view.busy ? " disabled" : ""}>${view.busy ? "Saving…" : "Save my details"}</button><span id="save-state" class="hint" role="status"></span></div>
      </form>
      <div class="acct-side">
        <section class="panel"><h2 class="sec">My training</h2>
          ${progress.length ? progress.map(progressCard).join("") : `<p class="hint">Once you're enrolled, your instructor shares your course schedule, skills and progress here.</p>`}</section>
        <section class="panel"><h2 class="sec">Upcoming classes</h2>
          ${upcoming.length ? `<ul class="acct-classes">${upcoming.slice(0, 6).map(k => classCard(k, mineIds.has(k.id))).join("")}</ul>` : `<p class="hint">No classes are scheduled right now.</p>`}
          <p class="hint"><a href="classes.html">See the full class calendar</a></p></section>
      </div></div>`;
  }

  function render() {
    const C = window.LDCloud;
    if (!C || !C.configured) {
      main.innerHTML = `<div class="msg"><h1>Student accounts are coming soon</h1><p>Your instructor hasn't turned on student accounts yet. In the meantime, see the <a href="classes.html">class calendar</a>.</p></div>`;
      return;
    }
    if (!C.available) { main.innerHTML = `<div class="msg">The sign-in service couldn't be loaded. Check your connection and refresh the page.</div>`; return; }
    if (!C.user || view.auth === "recover") { main.innerHTML = renderAuth(); return; }
    if (!profile) { main.innerHTML = `<div class="msg">Loading your account…</div>`; return; }
    main.innerHTML = renderAccount();
  }

  // ---------- profile photo ----------
  // The photo is in a private bucket, so it's shown through a short-lived signed link.
  let photoUrl = "";
  function initials() { return String(profile.full_name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase() || "?"; }
  function avatar(cls) {
    return photoUrl ? `<img class="avatar ${cls}" src="${esc(photoUrl)}" alt="${esc(profile.full_name || "Your")} profile photo">`
      : `<span class="avatar ${cls}" aria-hidden="true">${esc(initials())}</span>`;
  }
  async function loadPhoto() {
    photoUrl = "";
    if (!profile || !profile.photo_path) return;
    const { data } = await window.LDCloud.client.storage.from("avatars").createSignedUrl(profile.photo_path, 3600);
    photoUrl = (data && data.signedUrl) || "";
  }
  // Square-crop the picture to its center and shrink it to 512px, so uploads are small and quick.
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(img.naturalWidth, img.naturalHeight), out = Math.min(512, s), cv = document.createElement("canvas");
        cv.width = cv.height = out;
        cv.getContext("2d").drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, out, out);
        URL.revokeObjectURL(url);
        cv.toBlob(b => b ? resolve(b) : reject(new Error("That picture couldn't be read.")), "image/jpeg", 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't a picture this browser can open. Try a JPG or PNG.")); };
      img.src = url;
    });
  }
  async function uploadPhoto(file) {
    const C = window.LDCloud, sb = C.client, path = C.user.id + "/photo.jpg";
    view.photoBusy = true; render();
    try {
      const blob = await shrink(file);
      const up = await sb.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "60" });
      if (up.error) throw up.error;
      const r = await sb.from("student_profiles").update({ photo_path: path }).eq("id", C.user.id);
      if (r.error) throw r.error;
      profile.photo_path = path; await loadPhoto();
      if (photoUrl) photoUrl += (photoUrl.includes("?") ? "&" : "?") + "v=" + Date.now();
      toast("Photo saved");
    } catch (err) { toast("Photo not saved: " + C.explain(err)); }
    view.photoBusy = false; render();
  }
  async function removePhoto() {
    const C = window.LDCloud, sb = C.client;
    view.photoBusy = true; render();
    try {
      const rm = await sb.storage.from("avatars").remove([profile.photo_path]);
      if (rm.error) throw rm.error;
      const r = await sb.from("student_profiles").update({ photo_path: "" }).eq("id", C.user.id);
      if (r.error) throw r.error;
      profile.photo_path = ""; photoUrl = ""; toast("Photo removed");
    } catch (err) { toast("Photo not removed: " + C.explain(err)); }
    view.photoBusy = false; render();
  }

  // ---------- data ----------
  function blankProfile(id) {
    return { id, full_name: "", photo_path: "", address: "", street: "", city: "", state: "", zip: "", phone: "", emergency_name: "", emergency_relationship: "", emergency_phone: "", certifications: [] };
  }
  async function loadAll() {
    const C = window.LDCloud, sb = C.client, uid = C.user.id;
    loadError = "";
    const [p, pr, cl] = await Promise.all([
      sb.from("student_profiles").select("*").eq("id", uid).maybeSingle(),
      sb.from("student_progress").select("*").eq("student_id", uid).order("updated_at", { ascending: false }),
      sb.from("classes").select("*")
    ]);
    if (p.error) loadError = "Your details couldn't be loaded: " + C.explain(p.error);
    profile = Object.assign(blankProfile(uid), p.data || {});
    if (!Array.isArray(profile.certifications)) profile.certifications = [];
    // Saved before the address was split into parts: start Street with the old one-line address.
    if (profile.address && !profile.street && !profile.city && !profile.state && !profile.zip) profile.street = profile.address.replace(/\s*\n\s*/g, ", ");
    // A brand-new account whose profile wasn't made at sign-up: start it with the name they gave.
    if (!p.data && !p.error) {
      profile.full_name = (C.user.user_metadata && C.user.user_metadata.full_name) || "";
      await sb.from("student_profiles").upsert(profileRow());
    }
    try { await loadPhoto(); } catch (err) { photoUrl = ""; }
    progress = pr.error ? [] : pr.data || [];
    classes = cl.error ? [] : (cl.data || []).map(k => Object.assign({}, k, { dates: (Array.isArray(k.dates) ? k.dates : []).filter(x => G.parse(x)).sort() }))
      .sort((a, b) => (G.firstDate(a.dates) || "9999").localeCompare(G.firstDate(b.dates) || "9999"));
    render();
  }
  function profileRow() {
    const clean = (s, n) => String(s || "").trim().slice(0, n);
    return {
      id: profile.id, full_name: clean(profile.full_name, 200), phone: clean(profile.phone, 50),
      street: clean(profile.street, 200), city: clean(profile.city, 100), state: clean(profile.state, 40), zip: clean(profile.zip, 20),
      // The one-line address the instructor's Students list and invoices use: "12 Reef Rd, Lakeside, PA 19000".
      address: [clean(profile.street, 200), [clean(profile.city, 100), [clean(profile.state, 40), clean(profile.zip, 20)].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(", ").slice(0, 500),
      emergency_name: clean(profile.emergency_name, 200), emergency_relationship: clean(profile.emergency_relationship, 100), emergency_phone: clean(profile.emergency_phone, 50),
      certifications: profile.certifications
        .map(c => ({ agency: clean(c.agency, 60), level: clean(c.level, 120), number: clean(c.number, 60), date: G.parse(c.date) ? c.date : "" }))
        .filter(c => c.agency || c.level || c.number || c.date)
    };
  }

  // ---------- events ----------
  main.addEventListener("click", async (e) => {
    const sw = e.target.closest("[data-auth]");
    if (sw) { view.auth = sw.dataset.auth; setNote(""); render(); const f = main.querySelector("input"); if (f) f.focus(); return; }
    const b = e.target.closest("[data-act]"); if (!b) return;
    switch (b.dataset.act) {
      case "signout": await window.LDCloud.signOut(); break;
      case "add-cert": {
        profile.certifications.push({ agency: "", level: "", number: "", date: "" }); render();
        const f = document.getElementById("c-" + (profile.certifications.length - 1) + "-agency"); if (f) f.focus();
        dirty(); break;
      }
      case "rm-photo": removePhoto(); break;
      case "rm-cert": profile.certifications.splice(Number(b.dataset.i), 1); render(); dirty(); break;
    }
  });
  function dirty() { const s = document.getElementById("save-state"); if (s) s.textContent = "You have unsaved changes."; }
  main.addEventListener("input", (e) => {
    const el = e.target;
    if (el.closest("#auth-form")) { if (el.type !== "password") view.vals[el.id] = el.value; return; }
    if (!profile) return;
    if (el.dataset.p) { profile[el.dataset.p] = el.value; dirty(); }
    if (el.dataset.c) {
      const row = el.closest(".cert-row"); profile.certifications[Number(row.dataset.i)][el.dataset.c] = el.value; dirty();
      // A new agency: suggest that agency's certifications.
      if (el.dataset.c === "agency") { const lvl = row.querySelector('[data-c="level"]'); if (lvl) lvl.setAttribute("list", listId(el.value)); }
    }
  });

  main.addEventListener("change", (e) => {
    if (e.target.id !== "photo-file" || !e.target.files || !e.target.files[0]) return;
    const f = e.target.files[0];
    if (f.size > 25 * 1024 * 1024) { toast("That picture is too large. Please choose one under 25 MB."); return; }
    uploadPhoto(f);
  });

  main.addEventListener("submit", async (e) => {
    e.preventDefault();
    const C = window.LDCloud, sb = C.client;
    if (e.target.id === "profile-form") {
      if (!String(profile.full_name || "").trim()) { toast("Please enter your full name."); document.getElementById("p-full_name").focus(); return; }
      view.busy = true; render();
      const { error } = await sb.from("student_profiles").upsert(profileRow());
      view.busy = false;
      if (error) { render(); toast("Not saved: " + C.explain(error)); return; }
      profile = Object.assign(profile, profileRow());
      render();
      const s = document.getElementById("save-state"); if (s) s.textContent = "Saved.";
      toast("Your details are saved");
      return;
    }
    if (e.target.id !== "auth-form") return;
    const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
    const email = val("a-email"), pass = (document.getElementById("a-pass") || {}).value || "", name = val("a-name");
    const a = view.auth;
    if (a !== "recover" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setNote("Please enter a valid email address.", "bad"); render(); return; }
    if ((a === "signup" || a === "recover") && pass.length < 8) { setNote("Please choose a password with at least 8 characters.", "bad"); render(); return; }
    if (a === "signin" && !pass) { setNote("Please enter your password.", "bad"); render(); return; }
    if (a === "signup" && !name) { setNote("Please enter your full name.", "bad"); render(); return; }
    view.busy = true; setNote(""); render();
    let res;
    try {
      if (a === "signin") res = await sb.auth.signInWithPassword({ email, password: pass });
      if (a === "signup") res = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: name.slice(0, 200) }, emailRedirectTo: pageUrl() } });
      if (a === "forgot") res = await sb.auth.resetPasswordForEmail(email, { redirectTo: pageUrl() });
      if (a === "recover") res = await sb.auth.updateUser({ password: pass });
    } catch (err) { res = { error: err }; }
    view.busy = false;
    if (res.error) { setNote(C.explain(res.error), "bad"); render(); return; }
    // Came here from another page to log in (e.g. Request a class): go back there.
    if (a === "signin" && /^#then=request$/.test(location.hash)) { location.href = "request.html"; return; }
    if (a === "signup" && !(res.data && res.data.session)) {
      view.auth = "signin"; setNote("Almost done: we sent a confirmation link to " + email + ". Open it to finish creating your account, then log in here.", "ok");
    } else if (a === "forgot") {
      view.auth = "signin"; setNote("If there's an account for " + email + ", a reset link is on its way. Check your inbox.", "ok");
    } else if (a === "recover") {
      view.auth = "signin"; setNote(""); toast("Your new password is saved");
    }
    render();
  });

  // ---------- start ----------
  const C = window.LDCloud;
  if (!C || !C.available) { render(); return; }
  C.onChange(async (event) => {
    if (event === "PASSWORD_RECOVERY") { view.auth = "recover"; setNote(""); render(); return; }
    const uid = C.user && C.user.id;
    if (uid !== lastUser) {
      lastUser = uid; profile = null; progress = []; classes = [];
      render();
      if (uid) { setNote(""); try { await loadAll(); } catch (err) { loadError = C.explain(err); profile = profile || blankProfile(uid); render(); } }
    }
  });
  C.ready.then(() => { if (!C.user) render(); });
})();
