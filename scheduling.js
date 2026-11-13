/* Limitless Diving — Scheduling (Business → Scheduling), for Instructors and Admins.
   Put a student on a class, event, tour or coaching session, and make a learning agreement for that student
   and that event from the same screen.

   Where the data lives: like invoices, in this browser's storage (state.assignments, state.agreementTemplates),
   so Settings → Download backup carries it. No database change is needed.
   - What you can schedule: every entry on the Calendar (Class, Event, Exploration, Tour and any type added in
     Settings → Calendar event types) and the Coaching and tours listings (offerings.js), which have no calendar
     entry of their own, so you give them a date here.
   - Scheduling a student on a Class also enrolls them, exactly like Enroll on the Calendar (their course record
     gets the class dates and location).
   - Learning agreements are made from templates. Each template is for one kind of event (a calendar type, one of
     the Coaching and tours listings, or anything) and optionally one course. The most specific template is picked
     for you. Template text uses {{placeholders}} (PLACEHOLDERS below) filled from the student, the event and the
     course standards. Lines starting "## " are headings and lines starting "- " are bullet points.
   - Sending for signature: "Send to <student> to sign" copies the agreement to the Supabase agreements table
     (supabase/schema.sql), where the student reads, signs and prints it in the Student portal (account.js), and
     opens an email to them (email.js) with a link straight to it. The student needs a portal account linked to
     their Students record. Once signed, the signed wording is locked and shown here with their signature.
   window.LDScheduling = { render } */
(function () {
  "use strict";

  const L = () => window.LD;
  const G = () => window.LDCalGrid;
  const C = () => window.LDCloud;
  const $ = (s, r) => (r || document).querySelector(s);
  const v = { sel: null, tpl: false, tplSel: null, q: "", accounts: null, accBusy: false, offers: null, offBusy: false,
    signs: null, signsAt: 0, signBusy: false, signErr: "", sending: false };
  const PORTAL_URL = "https://limitless-diving.com/account.html";

  // ---------- starter templates (used until Jamie's own templates are dropped in) ----------
  const STUDENT_DUTIES = `- Complete the Medical History Form and the Waiver and Release Agreement before any in-water training. If the medical form shows a condition that could affect diving, I will get a physician's approval before training continues. If I am under 18, my parent or legal guardian signs these forms and this agreement.
- Finish the assigned academics or eLearning before the session where it is needed.
- Arrive on time, rested and fit to dive, with the equipment on the gear list, and let the instructor check it before open water.
- Tell my instructor right away about any change in my health, medications, or any problem with my equipment.
- Follow my instructor's directions and briefings, stay with my buddy, and stop and signal if I am uncomfortable at any point.`;

  const DEFAULT_TEMPLATES = [
    {
      // Jamie's Open Water proposal / learning agreement, section by section. The course's own wording comes
      // from its settings (Settings → that course), so the same template works for Open Water, Rescue, Divemaster
      // and every catalog course.
      id: "t-class", name: "Course learning agreement (from the Open Water proposal)", for: "class", course: "",
      body: `{{tagline}}

## Program
- Program: {{program}}
- Format: {{format}}
- Dates: {{dates}}
- Time: {{time}}
- Location: {{location}}
- Investment: {{price}}
- Student: {{student_name}}
- Contact: {{instructor}} | {{instructor_phone}} | {{instructor_email}}

## Our Training Philosophy
{{philosophy}}

## Governing Standards
{{governing_standards}}
- Minimum age: {{min_age}}
- Prerequisites: {{prerequisites}}
- Open water dives: {{dives}}
- Maximum depth: {{max_depth}}

## Program Structure
{{program_structure}}

## Included Certifications & Materials
{{included}}

## Performance Expectations
{{expectations_callout}}
{{expectations}}

## Instructor Commitment
{{commitment}}

## Proficiency Standard
{{proficiency}}

## Student Responsibilities
${STUDENT_DUTIES}

## Payment Policy
{{payment_policy}}

## Student Acknowledgment
{{acknowledgment}}`
    },
    {
      id: "t-coaching", name: "Coaching session agreement", for: "offer:coaching", course: "",
      body: `This learning agreement is between {{student_name}} (the student) and {{instructor}} of {{business}} for {{event_title}}.

## Session
- Session: {{event_title}}
- Dates: {{dates}}
- Time: {{time}}
- Location: {{location}}
- Fee: {{price}}
- Focus of the coaching: {{notes}}

## What coaching is
Coaching is practice and feedback with an instructor on the skills the student chooses. It is not a certification course and no certification is issued for it. The student dives within the limits of the certification they already hold: {{student_certs}}.

## What the student agrees to
${STUDENT_DUTIES}

## The instructor's commitment
The instructor will plan the session around the student's goals, brief and debrief each dive, and tell the student honestly what is going well and what to work on next.`
    },
    {
      id: "t-tour", name: "Tour participation agreement", for: "tour", course: "",
      body: `This agreement is between {{student_name}} (the diver) and {{business}} for {{event_title}}.

## Tour
- Tour: {{event_title}}
- Dates: {{dates}}
- Time: {{time}}
- Location: {{location}}
- Fee: {{price}}

## Who can join
Tours are led by a Dive Master for certified divers. The diver dives within the limits of the certification they hold ({{student_certs}}) and their own experience. A tour is not training and no certification is issued for it.

## What the diver agrees to
- Bring proof of certification, a completed Medical History Form and a signed Waiver and Release Agreement.
- Bring working, serviced equipment and do a full buddy check before every dive.
- Attend the dive briefing, follow the dive plan and the Dive Master's directions, and stay with an assigned buddy.
- Tell the Dive Master about any health change or equipment problem, and end a dive whenever they don't feel right.`
    },
    {
      id: "t-any", name: "General participation agreement", for: "any", course: "",
      body: `This agreement is between {{student_name}} and {{business}} for {{event_title}} ({{event_type}}).

## Details
- Dates: {{dates}}
- Time: {{time}}
- Location: {{location}}
- Fee: {{price}}

## What the participant agrees to
${STUDENT_DUTIES}`
    }
  ];

  // Every {{placeholder}} a template can use, with what it becomes.
  const PLACEHOLDERS = [
    ["student_name", "Student's name"], ["student_dob", "Date of birth"], ["student_address", "Mailing address"],
    ["student_phone", "Phone"], ["student_email", "Email"], ["emergency_contact", "Emergency contact and phone"],
    ["student_certs", "Certifications the student holds"],
    ["event_title", "Class, event, tour or session name"], ["event_type", "Class, Event, Tour, Coaching…"],
    ["dates", "Dates"], ["time", "Time"], ["location", "Location"], ["price", "Fee"], ["notes", "Notes on this schedule"],
    ["course_name", "Course name (classes)"], ["min_age", "Minimum age"], ["prerequisites", "Prerequisites"],
    ["dives", "Required open water dives"], ["max_depth", "Maximum depth"], ["standards_source", "Where the standards come from"],
    ["payment_notes", "Payment notes from the course settings"],
    ["program", "Program (course settings)"], ["tagline", "Tagline"], ["format", "Format"], ["philosophy", "Training philosophy"],
    ["governing_standards", "Governing standards paragraph"], ["program_structure", "Day-by-day structure (bullets)"],
    ["included", "Included certifications and materials (bullets)"], ["expectations_callout", "Performance expectations callout"],
    ["expectations", "Performance expectations"], ["commitment", "Instructor commitment"], ["proficiency", "Proficiency standard"],
    ["payment_policy", "Deposit and payment policy"], ["acknowledgment", "Student acknowledgment"],
    ["business", "Business name"], ["instructor", "Instructor"], ["instructor_phone", "Instructor phone"],
    ["instructor_email", "Instructor email"], ["today", "Today's date"]
  ];

  // ---------- data ----------
  function newId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function data() {
    const st = L().state;
    if (!Array.isArray(st.assignments)) st.assignments = [];
    if (!Array.isArray(st.agreementTemplates) || !st.agreementTemplates.length) st.agreementTemplates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
    return st;
  }
  const templates = () => data().agreementTemplates;
  function cur() { return data().assignments.find(a => a.id === v.sel) || null; }
  function curTpl() { return templates().find(t => t.id === v.tplSel) || null; }
  function person(a) { return a && a.studentId ? L().personById(a.studentId) : null; }
  function blank() {
    return { id: newId("a"), created: new Date().toISOString(), studentId: "", target: "", dates: [""], time: "", location: "", price: "", notes: "",
      agreement: null };   // agreement: { templateId, name, text, made }
  }

  // ---------- what can be scheduled ----------
  function calTypes() { return window.LDCalendar && window.LDCalendar.types ? window.LDCalendar.types() : [{ id: "class", name: "Class", course: true }]; }
  function typeById(id) { const t = calTypes(); return t.find(x => x.id === (id || "class")) || t.find(x => x.course) || t[0]; }
  function entry(id) { return (L().state.classes || []).find(k => k.id === id) || null; }
  function offer(id) { return (v.offers || []).find(o => o.id === id) || null; }
  function loadOffers() {
    if (v.offers || v.offBusy || !window.LDOfferings) return;
    v.offBusy = true;
    window.LDOfferings.load(false).then(list => { v.offers = list; v.offBusy = false; rerender(); });
  }
  // target is "k:<calendar entry id>" or "o:<listing id>". Everything the agreement needs about it:
  function eventOf(a) {
    const t = String(a.target || ""), id = t.slice(2);
    if (t.startsWith("k:")) {
      const k = entry(id); if (!k) return null;
      const ty = typeById(k.type), isClass = !!ty.course, c = isClass ? L().COURSES[k.course] : null;
      const courseName = c ? (c.fullName || c.name) : "";
      return { kind: "calendar", entry: k, type: ty, isClass, course: isClass ? k.course : "", courseName,
        title: k.title || courseName || ("Untitled " + ty.name.toLowerCase()), typeName: ty.name,
        dates: (k.dates || []).filter(Boolean).sort(), time: k.time || "", location: k.location || "",
        price: k.price === "" || k.price == null ? "" : Number(k.price), keys: [ty.id] };
    }
    if (t.startsWith("o:")) {
      const o = offer(id) || (a.offerName ? { id, name: a.offerName, calType: a.offerType || "event" } : null); if (!o) return null;
      const isCoach = /coach/i.test(o.id + " " + o.name);
      return { kind: "offer", offer: o, isClass: false, course: "", courseName: "", title: o.name,
        typeName: isCoach ? "Coaching" : (typeById(o.calType).name || "Event"),
        dates: (a.dates || []).filter(Boolean).sort(), time: a.time || "", location: a.location || "",
        price: a.price === "" || a.price == null ? "" : a.price, keys: ["offer:" + o.id, o.calType || "event"] };
    }
    return null;
  }
  function isUpcoming(k) { const last = G().lastDate(k.dates); return !last || last >= G().today(); }

  // ---------- students (this browser's Students list, plus registered accounts not added yet) ----------
  function people() { return L().state.students.filter(p => p.name).slice().sort((a, b) => a.name.localeCompare(b.name)); }
  function online() { return !!(C() && C().configured && C().available && C().client && C().can && C().can("divemaster")); }
  function loadAccounts() {
    if (v.accounts || v.accBusy || !online()) return;
    v.accBusy = true;
    C().client.rpc("member_directory").then(r => r.error ? C().client.rpc("student_accounts") : r)
      .then(r => { v.accounts = (r && !r.error && r.data) || []; v.accBusy = false; rerender(); }, () => { v.accounts = []; v.accBusy = false; });
  }
  function unlinkedAccounts() {
    const linked = new Set(L().state.students.map(p => p.accountId).filter(Boolean));
    return (v.accounts || []).filter(acc => !linked.has(acc.id) && (acc.full_name || acc.email))
      .sort((a, b) => String(a.full_name || a.email).localeCompare(String(b.full_name || b.email)));
  }
  function addFromAccount(accId) {
    const acc = (v.accounts || []).find(x => x.id === accId); if (!acc) return null;
    const p = L().addStudent();
    if (window.LDAccount && window.LDAccount.applyAccount) window.LDAccount.applyAccount(p, acc, true);
    else { p.name = acc.full_name || acc.email || ""; p.email = acc.email || ""; p.phone = acc.phone || ""; p.accountId = acc.id; }
    L().save();
    return p;
  }

  // ---------- course standards for the agreement ----------
  function standards(courseId) {
    const out = { min_age: "", prerequisites: "", dives: "", max_depth: "", standards_source: "", payment_notes: "" };
    if (!courseId) return out;
    const cat = window.LDCatalog && window.LDCatalog.find(courseId), std = cat && cat.std;
    const pr = L().program(courseId) || {};
    out.min_age = pr.minAge || (std && std.age) || "";
    const pre = (std && std.prereqs) || (pr.prereqs || []).map(x => x.label + (x.detail ? " (" + x.detail + ")" : ""));
    out.prerequisites = (pre || []).filter(Boolean).join("; ");
    out.dives = pr.minDives || (std ? (std.dives ? std.dives + " open water dive" + (std.dives === 1 ? "" : "s") : "") + (std.divesNote ? ". " + std.divesNote : "") : "");
    out.max_depth = pr.maxDepth || (std && std.depth) || "";
    out.standards_source = pr.standardsRef || (std && std.page ? "2026 NAUI Standards and Policies Manual, p. " + std.page
      : cat && /NAUI/.test(cat.agency || "") || !cat ? "2026 NAUI Standards and Policies Manual" : (cat.agency + " standards"));
    out.payment_notes = pr.paymentNotes || "";
    return out;
  }

  // ---------- templates ----------
  function forLabel(key) {
    if (key === "any") return "Anything";
    if (String(key).startsWith("offer:")) { const o = offer(key.slice(6)); return (o ? o.name : key.slice(6)) + " (listing)"; }
    const t = calTypes().find(x => x.id === key); return t ? t.name : key;
  }
  function forOptions() {
    const opts = calTypes().map(t => [t.id, t.name + (t.course ? " (courses)" : "")]);
    (v.offers || []).forEach(o => opts.push(["offer:" + o.id, o.name + " (Coaching and tours listing)"]));
    opts.push(["any", "Anything (fallback)"]);
    return opts;
  }
  // Most specific first: same course, then the event's own kind, then "any".
  function bestTemplate(ev) {
    if (!ev) return null;
    const list = templates(), score = (t) => {
      const kindHit = ev.keys.indexOf(t.for), anyHit = t.for === "any";
      if (kindHit < 0 && !anyHit) return -1;
      if (t.course && t.course !== ev.course) return -1;
      return (t.course ? 100 : 0) + (kindHit >= 0 ? 10 - kindHit : 0);
    };
    return list.map(t => [t, score(t)]).filter(x => x[1] >= 0).sort((a, b) => b[1] - a[1]).map(x => x[0])[0] || null;
  }
  function values(a) {
    const p = person(a) || {}, ev = eventOf(a) || { dates: [] }, { fmtDate, money } = L();
    const ow = L().program("open-water") || {}, prog = ev.course ? L().program(ev.course) || {} : {};
    const certs = (p.certs || []).filter(c => c && (c.agency || c.level)).map(c => [c.agency, c.level].filter(Boolean).join(" ")).join(", ");
    const progPrice = ev.course && Number(prog.price) ? money(prog.price) : "";
    const priceTxt = ev.price === "" || ev.price == null ? progPrice : (isFinite(Number(ev.price)) && String(ev.price).trim() !== "" ? money(ev.price) : String(ev.price));
    return Object.assign({
      student_name: p.name || "", student_dob: p.dob ? fmtDate(p.dob) : "", student_address: p.address || "",
      student_phone: p.phone || "", student_email: p.email || "",
      emergency_contact: [p.emergencyName, p.emergencyRel ? "(" + p.emergencyRel + ")" : "", p.emergencyPhone].filter(Boolean).join(" "),
      student_certs: certs || "none on file",
      event_title: ev.title || "", event_type: ev.typeName || "", dates: (ev.dates || []).map(fmtDate).join(", "),
      time: ev.time || "", location: ev.location || "", price: priceTxt, notes: a.notes || "",
      course_name: ev.courseName || "",
      business: prog.business || ow.business || "Limitless Diving & Technical Training",
      instructor: prog.instructor || ow.instructor || "", instructor_phone: prog.phone || ow.phone || "",
      instructor_email: prog.email || ow.email || "",
      today: fmtDate(G().today())
    }, standards(ev.course), proposal(ev, prog, priceTxt));
  }
  // The course's proposal wording (Settings → that course), for the learning agreement.
  function proposal(ev, pr, priceTxt) {
    const out = { program: "", tagline: "", format: "", philosophy: "", governing_standards: "", program_structure: "", included: "",
      expectations_callout: "", expectations: "", commitment: "", proficiency: "", payment_policy: "", acknowledgment: "" };
    if (!ev || !ev.course) return out;
    const c = L().COURSES[ev.course] || {}, { money } = L();
    out.program = pr.program || ev.courseName || ""; out.tagline = pr.tagline || ""; out.format = pr.format || "";
    out.philosophy = pr.philosophy || ""; out.governing_standards = pr.standards || "";
    out.program_structure = (pr.days || []).filter(d => d && (d.focus || d.obj))
      .map(d => "- " + (c.unit || "Day") + " " + (d.day || "") + ": " + [d.focus, d.obj].filter(Boolean).join(". ")).join("\n");
    out.included = (pr.included || []).filter(x => x && x.item).map(x => "- " + x.item + (x.detail ? ": " + x.detail : "")).join("\n");
    out.expectations_callout = pr.expectationsCallout || ""; out.expectations = pr.expectations || "";
    out.commitment = pr.commitment || ""; out.proficiency = pr.proficiency || ""; out.acknowledgment = pr.acknowledgment || "";
    const price = ev.price !== "" && isFinite(Number(ev.price)) ? Number(ev.price) : Number(pr.price) || 0, pct = Number(pr.depositPct) || 0;
    const dep = price && pct ? "A " + pct + "% non-refundable deposit of " + money(Math.round(price * pct) / 100) + " is required to secure " + (pr.depositPurpose || "training dates") + "." : "";
    out.payment_policy = [dep, pr.paymentNotes || ""].filter(Boolean).join(" ");
    return out;
  }
  function fill(body, vals) {
    return String(body || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k) => k in vals ? (vals[k] === "" ? "[" + k.replace(/_/g, " ") + "]" : String(vals[k])) : m);
  }
  function make(a, tpl) {
    a.agreement = { templateId: tpl.id, name: tpl.name, text: fill(tpl.body, values(a)), made: new Date().toISOString() };
  }
  function minorOn(a) {
    const p = person(a), ev = eventOf(a); if (!p || !p.dob) return null;
    const on = (ev && ev.dates[0]) || G().today(), b = new Date(p.dob + "T12:00:00"), d = new Date(on + "T12:00:00");
    if (isNaN(b) || isNaN(d)) return null;
    let age = d.getFullYear() - b.getFullYear();
    if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) age--;
    return age < 18;
  }
  // What goes at the top of the agreement (here and in the Student portal).
  function metaOf(a) {
    const vals = values(a);
    return { business: vals.business, contact: [vals.instructor, vals.instructor_phone, vals.instructor_email].filter(Boolean).join("  ·  "),
      instructor: vals.instructor, student_name: vals.student_name, student_dob: vals.student_dob,
      event_type: vals.event_type, event_title: vals.event_title, dates: vals.dates, minor: minorOn(a) };
  }
  // The printed agreement (agreement-doc.js). Once the student has signed, it's the wording they signed, with their signature.
  function docHtml(a) {
    const row = cloudOf(a), signed = row && row.signed_at;
    return window.LDAgreementDoc.html(metaOf(a), signed ? row.signed_body : (a.agreement ? a.agreement.text : ""),
      signed ? { name: row.signed_name, guardian: row.guardian_name, at: row.signed_at } : null);
  }

  // ---------- sending it to the student to sign (Student portal) ----------
  function canSendOnline() { return !!(C() && C().available && C().client && C().can && C().can("instructor")); }
  function loadSigns(force) {
    if (v.signBusy || !canSendOnline()) return;
    if (!force && v.signs && Date.now() - v.signsAt < 60000) return;
    v.signBusy = true;
    C().client.from("agreements").select("id,student_id,sent_at,signed_at,signed_name,guardian_name,signed_body,body").then(r => {
      v.signBusy = false; v.signsAt = Date.now();
      if (r.error) { v.signs = v.signs || {}; v.signErr = C().explain(r.error); }
      else { v.signs = {}; (r.data || []).forEach(x => { v.signs[x.id] = x; }); v.signErr = ""; }
      rerender();
    }, (err) => { v.signBusy = false; v.signsAt = Date.now(); v.signs = v.signs || {}; v.signErr = C().explain(err); rerender(); });
  }
  function cloudOf(a) { return (a && v.signs && v.signs[a.id]) || null; }
  function signState(a) {
    const row = cloudOf(a);
    return !a.agreement ? "none" : row && row.signed_at ? "signed" : row ? "sent" : "made";
  }
  function accountEmail(p) {
    const acc = p && p.accountId && (v.accounts || []).find(x => x.id === p.accountId);
    return (acc && acc.email) || (p && p.email) || "";
  }
  function firstName(p) { return String((p && p.name) || "").trim().split(/\s+/)[0] || "there"; }
  function emailText(a, p, ev) {
    const vals = values(a), link = PORTAL_URL + "#agreement=" + encodeURIComponent(a.id);
    const when = ev.dates.length ? " (" + vals.dates + ")" : "";
    const by = ev.dates[0] && ev.dates[0] > G().today() ? " before " + L().fmtDate(ev.dates[0]) : "";
    return {
      subject: "Please sign your learning agreement: " + ev.title,
      message: `Hi ${firstName(p)},

Your learning agreement for ${ev.title}${when} is ready in your Limitless Diving Student portal.

Please log in, read it over, and sign it${by}:
${link}

Once it's signed you can print it or save it as a PDF from the same page.

If you have any questions, just reply to this email.

${vals.instructor || "Jamie"}
${vals.business}`
    };
  }
  function portalBlock(a, p, ev) {
    const { esc, fmtDate } = L(), row = cloudOf(a), first = esc(firstName(p));
    const on = (iso) => esc(fmtDate(String(iso || "").slice(0, 10)));
    if (!canSendOnline()) return `<p class="hint">To send this to the student to sign online, sign in with <b>Admin Log in</b> as an Instructor or Admin. You can still print it for them to sign on paper.</p>`;
    if (!v.signs && !v.signErr) return `<p class="hint">Checking the Student portal…</p>`;
    if (v.signErr) return `<p class="acct-note bad" role="alert">Couldn't check the Student portal: ${esc(v.signErr)}</p>`;
    if (row && row.signed_at) {
      return `<p class="acct-note ok">Signed by <b>${esc(row.signed_name)}</b>${row.guardian_name ? " and parent or guardian <b>" + esc(row.guardian_name) + "</b>" : ""} on ${on(row.signed_at)} in the Student portal.
        The preview and the printout show the wording they signed, with their signature.</p>`;
    }
    if (!p) return "";
    if (!p.accountId) {
      return `<p class="hint">${esc(p.name || "This student")} doesn't have a Student portal account linked, so they can't sign online yet. Ask them to sign up at
        <a href="${PORTAL_URL}" target="_blank" rel="noopener">limitless-diving.com/account.html</a>, then link their account under <b>Admin Log in → Student accounts</b>. You can still print it for them to sign on paper.</p>`;
    }
    const busy = v.sending ? " disabled" : "";
    if (!row) {
      return `<div class="sch-sign"><button class="btn primary" data-sact="send-sign"${busy}>${v.sending ? "Sending…" : "Send to " + first + " to sign"}</button>
        <p class="hint">Puts the agreement in ${first}'s Student portal and opens an email asking them to log in, sign it and print a copy.</p></div>`;
    }
    const changed = row.body !== a.agreement.text || row.student_id !== p.accountId;
    return `<div class="sch-sign"><p class="acct-note">Sent ${on(row.sent_at)}${a.agreement.emailed ? "" : " (no email confirmed yet)"}. Waiting for ${first} to sign.${changed ? " <b>You've changed it since then.</b>" : ""}</p>
      <div class="row-actions"><button class="btn${changed ? " primary" : ""}" data-sact="send-sign"${busy}>${v.sending ? "Sending…" : changed ? "Send the updated agreement" : "Email " + first + " again"}</button>
        <button class="btn danger" data-sact="unsend">Take it back…</button><span id="sch-unsend-confirm"></span></div></div>`;
  }
  async function sendForSigning(a) {
    const p = person(a), ev = eventOf(a);
    if (!a || !a.agreement || !p || !p.accountId || !ev || v.sending || !canSendOnline()) return;
    const prev = cloudOf(a);
    if (prev && prev.signed_at) return;
    v.sending = true; rerender();
    const row = { id: a.id, student_id: p.accountId, title: String(ev.title || "").slice(0, 300), body: a.agreement.text,
      meta: metaOf(a), sent_at: new Date().toISOString() };
    let r;
    try { r = await C().client.from("agreements").upsert(row).select("id,student_id,sent_at,signed_at,signed_name,guardian_name,signed_body,body").single(); }
    catch (err) { r = { error: err }; }
    v.sending = false;
    if (r.error) { rerender(); L().toast("Not sent: " + C().explain(r.error)); return; }
    v.signs = v.signs || {}; v.signs[a.id] = r.data; rerender();
    const email = accountEmail(p);
    if (!window.LDEmail || !email) { L().toast("It's in " + firstName(p) + "'s Student portal. Add their email address to send them a note."); return; }
    const m = emailText(a, p, ev);
    window.LDEmail.open({ to: [{ name: p.name, email }], about: (p.name || "student") + ": learning agreement", subject: m.subject, message: m.message,
      onSent: () => { a.agreement.emailed = new Date().toISOString(); L().save(); rerender(); } });
  }
  async function unsend(a) {
    let r;
    try { r = await C().client.from("agreements").delete().eq("id", a.id); } catch (err) { r = { error: err }; }
    if (r.error) { L().toast("Couldn't take it back: " + C().explain(r.error)); return; }
    if (v.signs) delete v.signs[a.id];
    if (a.agreement) a.agreement.emailed = "";
    L().save(); rerender(); L().toast("Taken back. It's no longer in their Student portal.");
  }

  // ---------- render ----------
  function render() {
    data(); loadOffers(); loadAccounts(); loadSigns();
    if (v.sel && !cur()) v.sel = null;
    if (!v.sel && !v.tpl && data().assignments.length) v.sel = sortedList()[0].id;
    return `<aside class="roster no-print">${renderList()}</aside>
      <section class="panel" id="sch-panel">${v.tpl ? renderTemplates() : renderEditor()}</section>`;
  }
  function firstOf(a) { const ev = eventOf(a); return (ev && ev.dates[0]) || ""; }
  function sortedList() {
    return data().assignments.slice().sort((a, b) => (firstOf(b) || "9999").localeCompare(firstOf(a) || "9999") || (b.created || "").localeCompare(a.created || ""));
  }
  function renderList() {
    const { esc, fmtDate } = L(), q = v.q.trim().toLowerCase();
    const rows = sortedList().map(a => ({ a, p: person(a), ev: eventOf(a) }))
      .filter(x => !q || ((x.p && x.p.name || "") + " " + (x.ev && x.ev.title || "")).toLowerCase().includes(q));
    return `<button class="btn primary" data-sact="new">+ Schedule a student</button>
      <input type="search" id="sch-q" placeholder="Search by student or event" value="${esc(v.q)}" aria-label="Search scheduled students">
      <ul>${rows.map(({ a, p, ev }) => `<li><button data-sact="pick" data-id="${a.id}" class="${a.id === v.sel && !v.tpl ? "sel" : ""}">
          <span class="nm">${esc((p && p.name) || "No student yet")}</span>
          <span class="meta">${esc(ev ? ev.title : "Nothing picked yet")}${ev && ev.dates[0] ? " · " + esc(fmtDate(ev.dates[0])) : ""}</span>
          ${statusPill(a)}</button></li>`).join("")
        || `<li class="meta" style="padding:8px 10px">${data().assignments.length ? "No matches." : "No one scheduled yet."}</li>`}</ul>
      <button class="btn ${v.tpl ? "active" : ""}" data-sact="templates">Agreement templates</button>`;
  }

  function statusPill(a) {
    const st = signState(a), txt = { none: "No agreement yet", made: "Agreement made", sent: "Waiting for signature", signed: "Signed" }[st];
    return `<span class="la-status ${st === "signed" ? "done" : st === "sent" ? "wait" : st === "made" ? "made" : ""}">${txt}</span>`;
  }
  function targetSelect(a) {
    const { esc, fmtDate } = L(), ev = eventOf(a);
    const entries = (L().state.classes || []).filter(k => isUpcoming(k) || "k:" + k.id === a.target)
      .sort((x, y) => (G().firstDate(x.dates) || "9999").localeCompare(G().firstDate(y.dates) || "9999"));
    const groups = calTypes().map(t => {
      const ks = entries.filter(k => typeById(k.type).id === t.id); if (!ks.length) return "";
      return `<optgroup label="${esc(t.name)} (calendar)">${ks.map(k => {
        const c = typeById(k.type).course ? L().COURSES[k.course] : null, nm = k.title || (c ? c.fullName || c.name : "Untitled");
        const d = G().firstDate(k.dates);
        return `<option value="k:${esc(k.id)}"${a.target === "k:" + k.id ? " selected" : ""}>${esc(nm)}${d ? " — " + esc(fmtDate(d)) : ""}</option>`;
      }).join("")}</optgroup>`;
    }).join("");
    const offs = (v.offers || []).filter(o => o.active || a.target === "o:" + o.id);
    const offGroup = offs.length ? `<optgroup label="Coaching and tours (pick a date below)">${offs.map(o => `<option value="o:${esc(o.id)}"${a.target === "o:" + o.id ? " selected" : ""}>${esc(o.name)}</option>`).join("")}</optgroup>` : "";
    const lost = a.target && !ev ? `<option value="${esc(a.target)}" selected>(no longer on the calendar)</option>` : "";
    return `<select id="sch-target"><option value="">Choose a class, event, tour or coaching session…</option>${lost}${groups}${offGroup}</select>`;
  }
  function studentSelect(a) {
    const { esc } = L(), acc = unlinkedAccounts();
    return `<select id="sch-student"><option value="">Choose a student…</option>
      <optgroup label="Students">${people().map(p => `<option value="${p.id}"${p.id === a.studentId ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</optgroup>
      ${acc.length ? `<optgroup label="Student portal accounts (adds them to Students)">${acc.map(x => `<option value="acc:${esc(x.id)}">${esc(x.full_name || x.email)}${x.full_name && x.email ? " — " + esc(x.email) : ""}</option>`).join("")}</optgroup>` : ""}
      <option value="new">+ New student…</option></select>`;
  }
  function field(id, label, val, type, cls) {
    const esc = L().esc;
    if (type === "area") return `<div class="field ${cls || ""}"><label for="${id}">${esc(label)}</label><textarea id="${id}" rows="2">${esc(val)}</textarea></div>`;
    return `<div class="field ${cls || ""}"><label for="${id}">${esc(label)}</label><input id="${id}" type="${type || "text"}" value="${esc(val)}"></div>`;
  }

  function renderEditor() {
    const a = cur(), { esc, fmtDate, money } = L();
    if (!a) {
      return `<div class="empty"><h2>Scheduling</h2>
        <p>Put a student on a class, event, tour or coaching session, then make their learning agreement for it right here.
        Students scheduled on a class are enrolled in it, just like Enroll on the Calendar.</p>
        <button class="btn primary" data-sact="new">+ Schedule a student</button></div>`;
    }
    const p = person(a), ev = eventOf(a), tplList = templates(), best = bestTemplate(ev), signed = signState(a) === "signed";
    const pickT = (a.agreement && tplList.find(t => t.id === a.agreement.templateId)) || best;
    const enrolled = ev && ev.isClass && p && L().state.enrollments.some(e => e.studentId === p.id && e.classId === ev.entry.id);
    let details = "";
    const CAL = window.LDCalendar, canBuild = !!(CAL && CAL.newEntry);
    const building = a.building && ev && ev.kind === "calendar" && ev.entry.id === a.building;
    if (a.building && !building) a.building = "";
    if (building) {
      // The Calendar's own class form, right here (calendar.js renderClass, embedded).
      const who = p ? esc(p.name) : "the student";
      details = `<div class="sch-build" id="sch-build">${CAL.renderForm(a.building)}
        <div class="row-actions sch-build-acts"><button class="btn primary" data-sact="build-done">${a.buildNew ? "Save and schedule " + who : "Done"}</button>
          ${a.buildNew ? `<button class="btn danger" data-sact="build-cancel">Cancel and delete this ${esc(ev.typeName.toLowerCase())}</button>` : ""}</div>
        <p class="hint">It's saved on the Calendar as a draft${ev.entry.published ? "" : " (tick “Show on the public calendar” to publish it)"}.${ev.isClass ? " " + who + " is enrolled when you press " + (a.buildNew ? "Save" : "Done") + ", with these dates and location." : ""}</p></div>`;
    } else if (ev && ev.kind === "calendar") {
      const k = ev.entry;
      details = `<dl class="sch-facts"><div><dt>Type</dt><dd>${esc(ev.typeName)}${ev.courseName ? " · " + esc(ev.courseName) : ""}</dd></div>
        <div><dt>Dates</dt><dd>${esc(ev.dates.map(fmtDate).join(", ") || "Not set")}</dd></div>
        <div><dt>Time</dt><dd>${esc(ev.time || "Not set")}</dd></div><div><dt>Location</dt><dd>${esc(ev.location || "Not set")}</dd></div>
        <div><dt>Price</dt><dd>${ev.price === "" ? "Not set" : money(ev.price)}</dd></div>
        ${Number(k.seats) > 0 ? `<div><dt>Seats</dt><dd>${esc(k.seats)}</dd></div>` : ""}</dl>
        <p class="hint">${canBuild ? `<button class="btn small" data-sact="build-edit">Edit this ${esc(ev.typeName.toLowerCase())}</button> ` : ""}These come from the Calendar.${ev.isClass ? (enrolled ? " " + esc(p.name) + " is enrolled in this class." : p ? "" : " Pick a student to enroll them.") : ""}</p>`;
    } else if (ev && ev.kind === "offer") {
      details = `<div class="grid">${(a.dates.length ? a.dates : [""]).map((d, i) => `<div class="field"><label for="sch-d-${i}">Date ${a.dates.length > 1 ? i + 1 : ""}</label>
          <div class="sch-date"><input id="sch-d-${i}" type="date" data-sdate="${i}" value="${esc(d)}">${a.dates.length > 1 ? `<button class="btn small danger" data-sact="rm-date" data-i="${i}" aria-label="Remove date ${i + 1}">×</button>` : ""}</div></div>`).join("")}
        ${field("sch-time", "Time", a.time)}${field("sch-location", "Location", a.location)}${field("sch-price", "Fee", a.price)}
        ${field("sch-notes", /coach/i.test(ev.typeName) ? "What we'll work on" : "Notes", a.notes, "area", "wide")}</div>
        <div class="row-actions"><button class="btn small" data-sact="add-date">+ Add a day</button></div>`;
    }
    return `<div class="no-print">
      <div class="rec-head"><h1>${esc(p ? p.name : "Schedule a student")}</h1>
        <div class="stats"><div class="stat"><b>${esc(ev ? ev.typeName : "—")}</b><span>${esc(ev && ev.dates[0] ? fmtDate(ev.dates[0]) : "No date")}</span></div></div></div>
      <div class="doc-actions"><button class="btn danger" data-sact="del">Remove from schedule…</button><span id="sch-del-confirm"></span></div>

      <h2 class="sec">1 · Student</h2>
      <div class="sch-pick">${studentSelect(a)}${p ? `<button class="btn small" data-sact="open-student">Open their record</button>` : ""}</div>
      ${v.accBusy ? `<p class="hint">Loading student portal accounts…</p>` : ""}
      ${p ? `<p class="hint">${esc([p.phone, p.email, p.dob ? "DOB " + fmtDate(p.dob) : ""].filter(Boolean).join(" · ") || "No contact details on file yet.")}</p>` : ""}
      ${p && !p.accountId && online() ? `<p class="hint"><b>${esc(p.name || "This student")} isn't linked to a Student portal account</b>, so this won't show under “My training” when they log in. Pick their account under “Student portal accounts” above, or link it under <b>Admin Log in → Student accounts</b>.</p>` : ""}

      <h2 class="sec">2 · Class, event, tour or coaching</h2>
      ${building ? "" : `<div class="sch-pick">${targetSelect(a)}${canBuild ? `<span class="sch-or">or</span>
        <select id="sch-build-type" aria-label="Create a new calendar entry"><option value="">+ Create a new…</option>${calTypes().map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("")}</select>` : ""}</div>
      ${(L().state.classes || []).length ? "" : `<p class="hint">Nothing is on the Calendar yet. Create a class or event here, or pick a coaching or tour listing.</p>`}`}
      ${details}

      <h2 class="sec">3 · Learning agreement</h2>
      ${building ? `<p class="hint">Save the ${esc(ev.typeName.toLowerCase())} above first, then make the agreement.</p>` : !ev ? `<p class="hint">Pick what the student is scheduled for, then make the agreement.</p>` : `
        ${signed ? "" : `<div class="sch-pick"><label for="sch-tpl">Template</label>
          <select id="sch-tpl">${tplList.map(t => `<option value="${t.id}"${pickT && t.id === pickT.id ? " selected" : ""}>${esc(t.name)} — ${esc(forLabel(t.for))}${t.course ? " · " + esc((L().COURSES[t.course] || {}).name || t.course) : ""}</option>`).join("")}</select>
          <button class="btn primary" data-sact="make">${a.agreement ? "Make it again" : "Make agreement"}</button></div>`}
        ${signed ? "" : `<p class="hint">${best ? `Suggested for this ${esc(ev.typeName.toLowerCase())}: <b>${esc(best.name)}</b>. ` : ""}It's filled in from the student's details, the event and the course standards. ${a.agreement ? "Making it again replaces your edits below." : ""}</p>`}
        ${a.agreement ? `${signed ? "" : `<div class="grid"><div class="field wide"><label for="sch-text">Agreement text (edit freely, only for this student)</label>
          <textarea id="sch-text" rows="14">${esc(a.agreement.text)}</textarea></div></div>`}
          <h2 class="sec">4 · Student signs it</h2>
          <div id="sch-portal">${portalBlock(a, p, ev)}</div>
          <div class="doc-actions"><button class="btn primary" data-sact="print">Print / save as PDF</button>
          ${enrolled ? `<button class="btn" data-sact="proposal">Full proposal with skill matrix</button>` : ""}
          <span class="hint" style="margin:0">Made ${esc(fmtDate(a.agreement.made.slice(0, 10)))} from “${esc(a.agreement.name)}”.</span></div>` : ""}`}
      ${a.agreement ? `<h2 class="sec">Preview</h2>` : ""}</div>
      ${a.agreement ? `<div id="sch-doc">${docHtml(a)}</div>` : ""}`;
  }

  function renderTemplates() {
    const { esc } = L(), list = templates();
    if (v.tplSel && !curTpl()) v.tplSel = null;
    const t = curTpl() || list[0]; if (t) v.tplSel = t.id;
    const courses = L().COURSE_ORDER.map(id => [id, L().COURSES[id].fullName || L().COURSES[id].name]);
    return `<div class="rec-head"><h1>Learning agreement templates</h1></div>
      <p class="hint">Scheduling picks the most specific template for each event: one for that course first, then one for that kind of event, then “Anything”.
        To use your own learning agreements, paste their wording into a template (or add a new one) and swap in the {{placeholders}} below where the student's or the event's details go.</p>
      <div class="sch-pick"><select id="sch-tpl-pick" aria-label="Template to edit">${list.map(x => `<option value="${x.id}"${t && x.id === t.id ? " selected" : ""}>${esc(x.name)} — ${esc(forLabel(x.for))}</option>`).join("")}</select>
        <button class="btn" data-sact="tpl-new">+ New template</button>${t ? `<button class="btn" data-sact="tpl-dup">Duplicate</button>` : ""}
        <button class="btn" data-sact="tpl-file">Load text from a file…</button></div>
      ${t ? `<div class="grid">
        <div class="field"><label for="sch-t-name">Template name</label><input id="sch-t-name" data-stv="name" value="${esc(t.name)}"></div>
        <div class="field"><label for="sch-t-for">Use for</label><select id="sch-t-for" data-stv="for">${forOptions().map(([k, n]) => `<option value="${esc(k)}"${k === t.for ? " selected" : ""}>${esc(n)}</option>`).join("")}
          ${forOptions().some(([k]) => k === t.for) ? "" : `<option value="${esc(t.for)}" selected>${esc(forLabel(t.for))}</option>`}</select></div>
        <div class="field"><label for="sch-t-course">Only for this course (optional)</label><select id="sch-t-course" data-stv="course"><option value="">Any course</option>${courses.map(([id, n]) => `<option value="${esc(id)}"${id === t.course ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></div>
        <div class="field wide"><label for="sch-t-body">Agreement wording</label><textarea id="sch-t-body" data-stv="body" rows="18">${esc(t.body)}</textarea></div></div>
        <p class="hint">Start a line with “## ” for a heading or “- ” for a bullet point. Leave a blank line between paragraphs. The signature lines (student, parent or guardian for under-18s, instructor) are added for you.</p>
        <div class="doc-actions"><button class="btn danger" data-sact="tpl-del">Delete template…</button><span id="sch-tdel-confirm"></span>
          <button class="btn" data-sact="tpl-reset">Restore the starter templates…</button><span id="sch-treset-confirm"></span></div>` : ""}
      <h2 class="sec">Placeholders</h2>
      <div class="tablewrap"><table class="m sch-ph"><tbody>${PLACEHOLDERS.map(([k, d]) => `<tr><td><code>{{${k}}}</code></td><td>${esc(d)}</td></tr>`).join("")}</tbody></table></div>
      <input type="file" id="sch-tpl-file" accept=".txt,.md,text/plain" hidden>`;
  }

  // ---------- updates ----------
  function rerender() { if (document.getElementById("sch-panel")) L().render(); }
  function refreshDoc() {
    const a = cur(), d = $("#sch-doc"); if (a && d && a.agreement) d.innerHTML = docHtml(a);
    const pb = $("#sch-portal"); if (a && pb && a.agreement && cloudOf(a)) pb.innerHTML = portalBlock(a, person(a), eventOf(a));
  }
  function refreshList() {
    const r = $(".roster"); if (!r || !$("#sch-panel")) return;
    const q = $("#sch-q"), had = document.activeElement === q;
    r.innerHTML = renderList();
    if (had) { const nq = $("#sch-q"); nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); }
  }
  // Scheduling a student on a Class enrolls them in it (once).
  function enrollIfClass(a) {
    const ev = eventOf(a), p = person(a);
    if (!ev || !ev.isClass || !p || a.building === ev.entry.id) return false;
    if (L().state.enrollments.some(e => e.studentId === p.id && e.classId === ev.entry.id)) return false;
    L().enrollInClass(p.id, ev.entry);
    return true;
  }

  document.addEventListener("input", (e) => {
    const el = e.target; if (!$("#sch-panel") && el.id !== "sch-q") return;
    if (el.id === "sch-q") { v.q = el.value; refreshList(); return; }
    const a = cur();
    if (el.dataset && el.dataset.stv) { const t = curTpl(); if (!t) return; t[el.dataset.stv] = el.value; L().save(); return; }
    if (!a) return;
    const map = { "sch-time": "time", "sch-location": "location", "sch-price": "price", "sch-notes": "notes" };
    if (map[el.id]) { a[map[el.id]] = el.value; L().save(); refreshDoc(); return; }
    if (el.dataset && el.dataset.sdate != null) { a.dates[Number(el.dataset.sdate)] = el.value; L().save(); refreshDoc(); return; }
    if (el.id === "sch-text" && a.agreement) { a.agreement.text = el.value; L().save(); refreshDoc(); }
  });

  document.addEventListener("change", (e) => {
    const el = e.target; if (!$("#sch-panel")) return;
    const a = cur();
    if (el.id === "sch-student" && a) {
      let id = el.value;
      if (id === "new") {
        const p = L().addStudent(); a.studentId = p.id; const en = enrollIfClass(a); L().save();
        L().toast("New student added" + (en ? " and enrolled" : "") + ". Fill in their details on the Students page.");
        L().go("students", { psel: p.id, focus: "f-d-name" }); return;
      }
      if (id.startsWith("acc:")) { const p = addFromAccount(id.slice(4)); if (!p) return; id = p.id; L().toast((p.name || "Student") + " added to Students from their account"); }
      a.studentId = id; const en = enrollIfClass(a); L().save(); rerender();
      if (en) L().toast("Enrolled in " + eventOf(a).title);
    } else if (el.id === "sch-target" && a) {
      a.target = el.value;
      if (a.target.startsWith("o:")) { const o = offer(a.target.slice(2)); if (o) { a.offerName = o.name; a.offerType = o.calType; if (a.price === "" && o.price) a.price = o.price; } }
      const en = enrollIfClass(a); L().save(); rerender();
      if (en) L().toast((person(a).name || "Student") + " enrolled in " + eventOf(a).title);
    } else if (el.id === "sch-build-type" && a && el.value) {
      // A new class, event or tour made right here, with the Calendar's form, then this student is put on it.
      const k = window.LDCalendar.newEntry(el.value);
      a.target = "k:" + k.id; a.building = k.id; a.buildNew = true; L().save(); rerender();
      const x = document.getElementById(typeById(k.type).course ? "cal-course" : "cal-f-title"); if (x) x.focus();
    } else if (el.id === "sch-tpl-pick") { v.tplSel = el.value; rerender(); }
    else if (el.dataset && el.dataset.stv && el.tagName === "SELECT") { const t = curTpl(); if (t) { t[el.dataset.stv] = el.value; L().save(); rerender(); } }
    else if (el.id === "sch-tpl-file" && el.files && el.files[0]) {
      const r = new FileReader(), name = el.files[0].name.replace(/\.[^.]+$/, "");
      r.onload = () => {
        const t = { id: newId("t"), name: name || "My learning agreement", for: "any", course: "", body: String(r.result || "") };
        templates().push(t); v.tplSel = t.id; L().save(); rerender(); L().toast("Template added from " + name + ". Set what it's for.");
      };
      r.readAsText(el.files[0]);
    }
  });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sact]"); if (!b) return;
    const a = cur(), i = Number(b.dataset.i);
    switch (b.dataset.sact) {
      case "new": { const n = blank(); data().assignments.push(n); v.sel = n.id; v.tpl = false; L().save(); rerender(); const s = $("#sch-student"); if (s) s.focus(); break; }
      case "pick": v.sel = b.dataset.id; v.tpl = false; rerender(); break;
      case "templates": v.tpl = !v.tpl; rerender(); break;
      case "open-student": if (a && a.studentId) L().go("students", { psel: a.studentId }); break;
      case "add-date": if (a) { a.dates.push(""); L().save(); rerender(); } break;
      case "rm-date": if (a) { a.dates.splice(i, 1); if (!a.dates.length) a.dates = [""]; L().save(); rerender(); } break;
      case "make": {
        if (!a) break;
        const sel = $("#sch-tpl"), t = templates().find(x => x.id === (sel && sel.value)) || bestTemplate(eventOf(a));
        if (!t) { L().toast("Add a template first (Agreement templates)."); break; }
        if (signState(a) === "signed") break;
        make(a, t); L().save(); rerender();
        { const p = person(a); L().toast("Learning agreement made from “" + t.name + "”." + (p && p.accountId && canSendOnline() ? " Check it over, then send it to " + firstName(p) + " to sign." : "")); }
        const d = $("#sch-doc"); if (d && d.scrollIntoView) d.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      }
      case "build-edit": { const ev = a && eventOf(a); if (!ev || ev.kind !== "calendar") break; a.building = ev.entry.id; a.buildNew = false; L().save(); rerender(); break; }
      case "build-done": {
        if (!a) break;
        const ev = eventOf(a), wasNew = a.buildNew;
        a.building = ""; a.buildNew = false; window.LDCalendar.closeForm();
        const en = enrollIfClass(a); L().save(); rerender();
        L().toast(ev ? (wasNew ? ev.typeName + " saved to the Calendar" : "Saved") + (en ? " and " + (person(a).name || "the student") + " enrolled" : "") : "Saved");
        break;
      }
      case "build-cancel": {
        if (!a || !a.building) break;
        window.LDCalendar.removeEntry(a.building); a.building = ""; a.buildNew = false; a.target = ""; L().save(); rerender();
        L().toast("New entry deleted");
        break;
      }
      case "print": window.print(); break;
      case "send-sign": if (a) sendForSigning(a); break;
      case "unsend": $("#sch-unsend-confirm").innerHTML = ` Take it out of their Student portal? <button class="btn small danger" data-sact="unsend-yes">Take it back</button>`; break;
      case "unsend-yes": if (a) unsend(a); break;
      case "proposal": {
        // The student's course record, on its Proposal tab (skill matrix, dive log, remediation and sign-off).
        const ev = a && eventOf(a), en = ev && ev.isClass && L().state.enrollments.find(x => x.studentId === a.studentId && x.classId === ev.entry.id);
        if (!en) break;
        L().go(en.course, { sel: en.id }); L().view().tab = "proposal"; L().render(); window.scrollTo(0, 0);
        break;
      }
      case "del": {
        const ev = a && eventOf(a);
        $("#sch-del-confirm").innerHTML = `Remove this from the schedule?${ev && ev.isClass ? " Their course record stays; take them off the class on the Calendar if needed." : ""} <button class="btn small danger" data-sact="del-yes">Remove</button>`;
        break;
      }
      case "del-yes": {
        // An agreement waiting in their portal goes too; a signed one stays there as their record.
        const row = cloudOf(a);
        if (row && !row.signed_at && canSendOnline()) C().client.from("agreements").delete().eq("id", a.id).then(() => { if (v.signs) delete v.signs[a.id]; });
        data().assignments = data().assignments.filter(x => x.id !== a.id); v.sel = null; L().save(); rerender(); L().toast("Removed from the schedule"); break;
      }
      case "tpl-new": { const t = { id: newId("t"), name: "New learning agreement", for: "any", course: "", body: "This learning agreement is between {{student_name}} and {{business}} for {{event_title}} on {{dates}}.\n\n## Terms\n- " }; templates().push(t); v.tplSel = t.id; L().save(); rerender(); break; }
      case "tpl-dup": { const t = curTpl(); if (!t) break; const n = Object.assign({}, t, { id: newId("t"), name: t.name + " (copy)" }); templates().push(n); v.tplSel = n.id; L().save(); rerender(); break; }
      case "tpl-file": { const f = $("#sch-tpl-file"); if (f) f.click(); break; }
      case "tpl-del": $("#sch-tdel-confirm").innerHTML = `Delete this template? Agreements already made keep their text. <button class="btn small danger" data-sact="tpl-del-yes">Delete</button>`; break;
      case "tpl-del-yes": data().agreementTemplates = templates().filter(x => x.id !== v.tplSel); v.tplSel = null; L().save(); rerender(); break;
      case "tpl-reset": $("#sch-treset-confirm").innerHTML = `Put the starter templates back? Your own templates are kept. <button class="btn small danger" data-sact="tpl-reset-yes">Restore</button>`; break;
      case "tpl-reset-yes": {
        const st = data(), mine = st.agreementTemplates.filter(x => !DEFAULT_TEMPLATES.some(d => d.id === x.id));
        st.agreementTemplates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)).concat(mine); v.tplSel = null; L().save(); rerender(); L().toast("Starter templates restored");
        break;
      }
    }
  });

  window.LDScheduling = { render, DEFAULT_TEMPLATES, PLACEHOLDERS, fill, bestTemplate };
})();
