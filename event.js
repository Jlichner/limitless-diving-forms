/* Limitless Diving — the information page for one calendar entry (event.html?id=<entry id>).
   Clicking an entry on the class calendar (classes.html, or the Calendar in the app for anyone who isn't an
   Instructor or Admin) opens this page. It explains the entry and lets a logged-in member:
   - join an Event, Exploration or Tour straight away (up to the seats left), or leave it again;
   - start signing up for a Class. That waits for the instructor, who puts them on the class with
     Business → Scheduling (enrolls them and sends the learning agreement to sign in the Student portal).
   Sign-ups live in the Supabase table event_signups (supabase/schema.sql), and each new one alerts the
   instructor through the notify-signup Edge Function. Minimum certifications are checked
   against the member's account and shown as a warning, never a block, as on the class calendar. */
(function () {
  "use strict";

  const G = window.LDCalGrid, esc = G.esc, CAT = window.LDCatalog, C = window.LDCloud;
  const main = document.getElementById("evt");
  const id = new URLSearchParams(location.search).get("id") || "";
  const v = { k: null, contact: {}, online: false, loaded: false, missing: false, mine: null, going: null,
    certs: null, notes: "", busy: false, note: "", noteKind: "", confirmLeave: false };
  let lastUser;

  function money(n) { return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
  function safeEmail(e) { return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(e || "") ? e : ""; }
  function telHref(p) { const d = String(p || "").replace(/[^\d+]/g, ""); return d.length >= 7 ? "tel:" + d : ""; }
  function color(k) { return /^k\d$/.test(k.color || "") ? k.color : "k0"; }
  function isClass(k) { return !k.type || k.type === "class" || !!k.course; }
  function kindWord(k) { return isClass(k) ? "class" : String(k.typeName || "event").toLowerCase(); }
  function setNote(text, kind) { v.note = text || ""; v.noteKind = kind || ""; }
  function noteHtml() { return v.note ? `<p class="acct-note ${v.noteKind}" role="${v.noteKind === "bad" ? "alert" : "status"}">${esc(v.note)}</p>` : ""; }
  function ended(k) { const last = G.lastDate(k.dates); return !!last && last < G.today(); }
  function seatsLeft(k) {
    if (k.seatsLeft == null) return null;
    // Joins made on this page count against the seats left that were published.
    return isClass(k) || v.going == null ? Number(k.seatsLeft) : Math.max(0, Number(k.seatsLeft) - v.going);
  }
  function askHref(k) {
    const c = v.contact || {}, email = safeEmail(c.email);
    const subject = (isClass(k) ? "Class" : k.typeName || "Event") + ": " + k.title + (k.dates.length ? " (" + G.range(k.dates) + ")" : "");
    return email ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : telHref(c.phone);
  }
  function signedIn() { return !!(C && C.available && C.user); }

  // ---------- pieces ----------
  function certBox(k) {
    if (!k.minCertName) return "";
    const ok = v.certs && CAT ? CAT.meetsCert(k.minCert, v.certs) : null;
    const check = ok === true ? `<span class="cert-check ok">✓ The certifications on your account meet this.</span>`
      : ok === false ? `<span class="cert-check no">Your account doesn't list this certification or an equivalent yet. Add it on your <a href="account.html">Student portal</a> page, or ask us before you join.</span>`
      : !signedIn() && v.online ? `<span class="cert-check">Log in to check your certifications.</span>` : "";
    return `<p class="cert-req"><b>Min Cert:</b> ${esc(k.minCertName)}${check ? "<br>" + check : ""}</p>`;
  }

  function courseBox(k) {
    if (!isClass(k)) return "";
    const c = CAT && CAT.find(k.course); if (!c) return "";
    const s = c.std || {};
    const facts = [s.age ? "Minimum age: " + s.age : "", Number(s.dives) > 0 ? s.dives + " open water dive" + (Number(s.dives) === 1 ? "" : "s") : "", s.depth ? "Depth: " + s.depth : ""].filter(Boolean);
    return `<section class="panel evt-course"><h2 class="sec">About the course</h2>
      <p><b>${esc(c.fullName || c.name)}</b>${c.agency ? ` <span class="hint">(${esc(c.agency)})</span>` : ""}</p>
      ${c.about ? `<p>${esc(c.about)}</p>` : ""}
      ${facts.length ? `<ul class="evt-facts">${facts.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${s.prereqs && s.prereqs.length ? `<h3>What you need to start</h3><ul>${s.prereqs.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
      <p><a href="available-classes.html#course=${esc(c.id)}">More about this course</a></p></section>`;
  }

  const STATUS = {
    joined: ["You're going", "ok"],
    pending: ["Sign-up sent", "wait"],
    enrolled: ["You're enrolled", "ok"],
    declined: ["Not confirmed", "no"]
  };

  function actionBox(k) {
    const word = kindWord(k), ask = askHref(k), cls = isClass(k), left = seatsLeft(k);
    const askBtn = ask ? `<a class="btn" href="${esc(ask)}">Ask a question</a>` : "";
    const head = `<h2 class="sec">${cls ? "Sign up for this class" : "Join this " + esc(word)}</h2>`;
    if (ended(k)) return `<section class="panel evt-act">${head}<p>This ${esc(word)} has already happened. See the <a href="classes.html">class calendar</a> for what's coming up.</p></section>`;
    if (!v.online) {
      return `<section class="panel evt-act">${head}<p>Get in touch and we'll save you a spot.</p><div class="row-actions">${ask ? `<a class="btn primary" href="${esc(ask)}">${cls ? "Ask about this class" : "Ask about this " + esc(word)}</a>` : ""}</div></section>`;
    }
    if (!C.loaded || (signedIn() && v.mine === undefined)) return `<section class="panel evt-act">${head}<p class="hint">Loading…</p></section>`;
    if (!signedIn()) {
      return `<section class="panel evt-act">${head}
        <p>${cls ? "Log in to your Student portal account to start signing up. It only takes a minute, and it's where you'll sign your learning agreement and follow your training."
          : "Log in to your Student portal account to join, so we know who's coming and how to reach you."}</p>
        <div class="row-actions"><a class="btn primary" href="account.html#then=event-${esc(k.id)}">Log in to ${cls ? "sign up" : "join"}</a>${askBtn}</div>
        <p class="hint">New here? You can create a free account on the same page.</p></section>`;
    }
    const m = v.mine;
    if (m) {
      const st = STATUS[m.status] || STATUS.pending;
      const what = m.status === "joined" ? `You've joined this ${esc(word)}. We'll be in touch with any details before the day.`
        : m.status === "pending" ? `Thanks! We've got your sign-up. Your instructor will put you on the class and send your learning agreement to sign in your <a href="account.html">Student portal</a>.`
        : m.status === "enrolled" ? `You're on this class. Your course and any learning agreement to sign are in your <a href="account.html">Student portal</a>.`
        : `Your instructor couldn't confirm this one.`;
      const canLeave = m.status !== "enrolled";
      const leave = !canLeave ? "" : v.confirmLeave
        ? `<span>${m.status === "joined" ? "Leave this " + esc(word) + "?" : "Withdraw your sign-up?"} <button class="btn small danger" data-evt="leave-yes"${v.busy ? " disabled" : ""}>Yes</button> <button class="btn small" data-evt="leave-no">No</button></span>`
        : `<button class="btn" data-evt="leave">${m.status === "joined" ? "I can't make it" : m.status === "pending" ? "Withdraw my sign-up" : "Remove"}</button>`;
      return `<section class="panel evt-act">${head}<p><span class="req-status ${st[1]}">${esc(st[0])}</span></p><p>${what}</p>
        ${m.staff_note ? `<p class="hint">From your instructor: ${esc(m.staff_note)}</p>` : ""}
        ${noteHtml()}<div class="row-actions">${leave}${askBtn}</div></section>`;
    }
    const full = !cls && left !== null && left <= 0;
    if (full) return `<section class="panel evt-act">${head}<p>This ${esc(word)} is full. Ask us about the waiting list.</p>${noteHtml()}<div class="row-actions">${ask ? `<a class="btn primary" href="${esc(ask)}">Join the waiting list</a>` : ""}</div></section>`;
    const certNo = k.minCertName && v.certs && CAT && !CAT.meetsCert(k.minCert, v.certs);
    const label = cls ? "Start signing up" : "Join this " + word;
    return `<section class="panel evt-act">${head}
      <p>${cls ? `Send us your sign-up and your instructor will put you on the class, then send your learning agreement to sign in your <a href="account.html">Student portal</a>.${k.seatsLeft === 0 ? " This class is full right now, so you'll go on the waiting list." : ""}`
        : `You'll be on the list straight away. You can take yourself off here if plans change.`}</p>
      ${certNo ? `<p class="acct-note bad">This ${esc(word)} needs ${esc(k.minCertName)} or higher, and your account doesn't list it yet. You can still ${cls ? "sign up" : "join"}; we'll check your card before the day.</p>` : ""}
      <div class="field wide"><label for="evt-notes">Anything we should know? (optional)</label><textarea id="evt-notes" maxlength="1000" placeholder="${cls ? "e.g. I'd like to bring a friend, or I have my own gear" : "e.g. I need to rent a tank"}">${esc(v.notes)}</textarea></div>
      ${noteHtml()}
      <div class="row-actions"><button class="btn primary" data-evt="join"${v.busy ? " disabled" : ""}>${v.busy ? "Sending…" : esc(label)}</button>${askBtn}</div></section>`;
  }

  function render() {
    if (!id) { main.innerHTML = `<div class="msg"><h1>Pick something on the calendar</h1><p>Open the <a href="classes.html">class calendar</a> and click an entry to see its details.</p></div>`; return; }
    if (!v.loaded) { main.innerHTML = `<div class="msg">Loading…</div>`; return; }
    const k = v.k;
    if (!k) { main.innerHTML = `<div class="msg"><h1>This isn't on the calendar anymore</h1><p>It may have finished or been changed. See the <a href="classes.html">class calendar</a> for what's coming up.</p></div>`; return; }
    const cls = isClass(k), left = seatsLeft(k);
    const seats = left === null ? "" : left <= 0 ? `<span class="seats full">${cls ? "Class full · waitlist" : "Full"}</span>`
      : `<span class="seats${left <= 2 ? " low" : ""}">${left} ${cls ? "seat" : "spot"}${left === 1 ? "" : "s"} open</span>`;
    const going = !cls && v.going ? `<span class="hint">${v.going} ${v.going === 1 ? "person has" : "people have"} joined</span>` : "";
    const staff = C && C.can && C.can("instructor") ? `<p class="acct-note">You're signed in as staff. To change this ${esc(kindWord(k))} or see who signed up, open the Calendar with <a href="index.html#staff">Admin Log in</a>.</p>` : "";
    document.title = k.title + " · Limitless Diving";
    main.innerHTML = `<p><a class="back" href="classes.html">‹ Class calendar</a></p>
      <article class="pub-card evt-card ${color(k)}">
        <span class="eyebrow">${esc(cls ? (k.courseName || "Class") : k.typeName || "Event")}</span>
        <h1>${esc(k.title)}</h1>
        <span class="when">${esc(G.range(k.dates) || "Dates to be announced")}</span>
        <div class="evt-badges">${seats}${going}</div>
        <dl>${k.time ? `<dt>Time</dt><dd>${esc(k.time)}</dd>` : ""}${k.location ? `<dt>Where</dt><dd>${esc(k.location)}</dd>` : ""}
          ${k.price != null && k.price !== "" ? `<dt>Price</dt><dd class="money">${money(k.price)}</dd>` : ""}
          ${k.dates.length > 1 ? `<dt>Days</dt><dd>${k.dates.map(d => esc(G.fmt(d, { weekday: "short", year: undefined }))).join(", ")}</dd>` : ""}</dl>
        ${certBox(k)}
        ${k.notes ? `<p>${esc(k.notes)}</p>` : ""}
      </article>
      ${staff}
      ${actionBox(k)}
      ${courseBox(k)}`;
  }

  // ---------- data ----------
  async function fromSupabase() {
    if (!C || !C.configured) return null;
    const get = (path) => fetch(C.url + "/rest/v1/" + path, { headers: { apikey: C.key }, cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
    const [settings, rows] = await Promise.all([get("calendar_settings?id=eq.1&select=*"), get("classes?select=*&id=eq." + encodeURIComponent(id))]);
    const s = settings && settings[0];
    if (!s) return null;  // never published online: use classes.json
    const k = rows && rows[0];
    return {
      online: true, contact: { instructor: s.instructor, phone: s.phone, email: s.email },
      k: k ? { id: k.id, type: k.event_type || "class", typeName: k.event_type_name || "Class", course: k.course, courseName: k.course_name,
        title: k.title, color: k.color, dates: k.dates, time: k.time, location: k.location, price: k.price == null ? null : Number(k.price),
        seats: k.seats, seatsLeft: k.seats_left, notes: k.notes, minCert: k.min_cert || "", minCertName: k.min_cert_name || "" } : null
    };
  }
  async function fromFile() {
    const r = await fetch("classes.json", { cache: "no-store" }); if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    return { online: false, contact: d.contact || {}, k: (Array.isArray(d.classes) ? d.classes : []).find(x => x.id === id) || null };
  }
  async function loadEvent() {
    let d = null;
    try { d = await fromSupabase(); } catch (e) { console.warn("Online calendar not available:", e); }
    if (!d) { try { d = await fromFile(); } catch (e) { d = { online: false, contact: {}, k: null }; } }
    v.online = d.online && !!(C && C.available);
    v.contact = d.contact || {};
    v.k = d.k ? Object.assign({}, d.k, { title: d.k.title || d.k.courseName || "Untitled", dates: (Array.isArray(d.k.dates) ? d.k.dates : []).filter(x => G.parse(x)).sort() }) : null;
    v.loaded = true;
    if (v.k && v.online && !isClass(v.k)) {
      const r = await Promise.resolve(C.client.rpc("event_going", { p_class_id: id })).catch(() => null);
      v.going = r && !r.error && typeof r.data === "number" ? r.data : null;
    }
    render();
  }
  // The member's own sign-up for this entry and their certifications.
  async function loadMine() {
    if (!v.k || !v.online || !C.user) { v.mine = null; v.certs = null; render(); return; }
    v.mine = undefined; render();
    const [m, p] = await Promise.all([
      C.client.from("event_signups").select("*").eq("class_id", id).eq("student_id", C.user.id).maybeSingle(),
      C.client.from("student_profiles").select("certifications").eq("id", C.user.id).maybeSingle()
    ]);
    if (m.error) setNote(C.explain(m.error), "bad");
    v.mine = m.data || null;
    v.certs = p.data && Array.isArray(p.data.certifications) ? p.data.certifications : [];
    render();
  }
  async function refreshGoing() {
    if (!v.k || isClass(v.k) || !v.online) return;
    const r = await Promise.resolve(C.client.rpc("event_going", { p_class_id: id })).catch(() => null);
    if (r && !r.error && typeof r.data === "number") v.going = r.data;
  }

  // ---------- actions ----------
  main.addEventListener("input", (e) => { if (e.target.id === "evt-notes") v.notes = e.target.value; });
  main.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-evt]"); if (!b || !v.k) return;
    const act = b.dataset.evt, k = v.k;
    if (act === "leave") { v.confirmLeave = true; render(); return; }
    if (act === "leave-no") { v.confirmLeave = false; render(); return; }
    if (v.busy) return;
    if (act === "join") {
      v.busy = true; setNote(""); render();
      const name = (C.user.user_metadata && C.user.user_metadata.full_name) || "";
      const { data: row, error } = await C.client.from("event_signups").insert({ class_id: k.id, notes: v.notes.trim().slice(0, 1000), student_name: String(name).slice(0, 200) }).select("id").maybeSingle();
      v.busy = false;
      if (error) setNote(/duplicate|unique/i.test(error.message || "") ? "You've already signed up for this." : C.explain(error), "bad");
      else {
        v.notes = ""; setNote(isClass(k) ? "Sign-up sent. We'll be in touch soon." : "You're in! See you there.", "ok");
        // Let the instructor know (email and/or text, supabase/functions/notify-signup). Best effort: the
        // sign-up is saved either way.
        if (row && row.id && C.client.functions) Promise.resolve(C.client.functions.invoke("notify-signup", { body: { id: row.id } })).catch(() => {});
      }
      await refreshGoing(); await loadMine();
      return;
    }
    if (act === "leave-yes" && v.mine) {
      v.busy = true; render();
      const { error } = await C.client.from("event_signups").delete().eq("id", v.mine.id);
      v.busy = false; v.confirmLeave = false;
      setNote(error ? C.explain(error) : isClass(k) ? "Your sign-up is withdrawn." : "You're off the list for this " + kindWord(k) + ".", error ? "bad" : "ok");
      await refreshGoing(); await loadMine();
    }
  });

  // ---------- start ----------
  const nav = document.getElementById("pubnav");  // shown once student accounts are set up
  if (nav && C && C.configured) nav.hidden = false;
  render();
  if (!id) return;
  loadEvent().then(() => {
    if (!C || !C.available) return;
    C.onChange(() => {
      const uid = C.user && C.user.id;
      if (uid === lastUser) return;
      lastUser = uid; setNote(""); v.confirmLeave = false;
      loadMine().catch(err => { setNote(C.explain(err), "bad"); v.mine = null; render(); });
    });
    C.ready.then(() => { if (lastUser === undefined) { lastUser = C.user && C.user.id; loadMine().catch(() => { v.mine = null; render(); }); } });
  });
})();
