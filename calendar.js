/* Limitless Diving — class calendar, the app's landing page.
   Classes live in the same browser storage as everything else (state.classes, state.calendarSettings),
   so Export backup / Import carry them. "Publish" writes classes.json: the published classes only, with no
   student names, which classes.html shows to the public. Load after app.js, courses.js and calendar-grid.js. */
(function () {
  "use strict";

  const L = () => window.LD;
  const G = () => window.LDCalGrid;
  const v = { ym: null, sel: null, past: false, publish: false, reqs: null, reqsBusy: false, reqsErr: "", pub: null, pubBusy: false };
  const UPLOAD_URL = "https://github.com/jlichner/limitless-diving-forms/upload/main";
  const PUBLIC_URL = "https://limitless-diving.com/classes.html";

  // ---------- data ----------
  function data() {
    const st = L().state;
    if (!Array.isArray(st.classes)) st.classes = [];
    if (!st.calendarSettings || typeof st.calendarSettings !== "object") {
      const ow = L().program("open-water");
      st.calendarSettings = {
        heading: "Upcoming training classes",
        intro: "Scuba training with Limitless Diving & Technical Training. Ask about any class to save your spot.",
        instructor: ow.instructor || "", phone: ow.phone || "", email: ow.email || ""
      };
    }
    return st;
  }
  const S = () => data().calendarSettings;

  // ---------- calendar entry types (Settings → Calendar event types) ----------
  // Each entry on the calendar has a type. A type marked "course" (Class) links the entry to a course, so
  // students can be enrolled; other types (Event, Exploration, Tour…) have just a title. Staff edit the list.
  const DEFAULT_TYPES = [
    { id: "class", name: "Class", about: "Training course. Students enroll and get the dates on their course record.", course: true, color: "" },
    { id: "event", name: "Event", about: "Club events, talks, socials and other get-togethers.", course: false, color: "k6" },
    { id: "exploration", name: "Exploration", about: "Team diving.", course: false, color: "k7" },
    { id: "tour", name: "Tour", about: "Dive Master led.", course: false, color: "k8" }
  ];
  const TYPE_COLORS = [["k6", "Blue"], ["k7", "Amber"], ["k8", "Olive"], ["k9", "Crimson"], ["k0", "Reef teal"], ["k1", "Rust"], ["k2", "Violet"], ["k3", "Green"], ["k4", "Magenta"], ["k5", "Slate"]];
  function types() {
    const s = S();
    if (!Array.isArray(s.eventTypes) || !s.eventTypes.length) s.eventTypes = JSON.parse(JSON.stringify(DEFAULT_TYPES));
    return s.eventTypes;
  }
  function typeOf(k) {
    // Entries from the published calendar carry their own type name (this browser may not have that type).
    if (k.pub) return { id: k.type, name: k.typeName || "Class", course: !k.type || k.type === "class" || !!k.course, color: k.color };
    const t = types(); return t.find(x => x.id === (k.type || "class")) || t.find(x => x.course) || t[0];
  }
  function isCourseType(k) { return !!typeOf(k).course; }

  function cur() { return data().classes.find(k => k.id === v.sel) || null; }
  function course(k) { return isCourseType(k) ? L().COURSES[k.course] || null : null; }
  function courseName(k) { if (!isCourseType(k)) return ""; const c = course(k); return c ? (c.fullName || c.name) : k.course; }
  function titleOf(k) { return k.title || (isCourseType(k) ? courseName(k) : "Untitled " + typeOf(k).name.toLowerCase()); }
  function colorOf(k) {
    if (k.pub && /^k\d$/.test(k.color || "")) return k.color;
    if (k.type && !isCourseType(k)) return /^k\d$/.test(typeOf(k).color || "") ? typeOf(k).color : "k5";
    const i = L().COURSE_ORDER.indexOf(k.course); return "k" + ((i < 0 ? 5 : i) % 6);
  }
  // Minimum certification to join (Events, Explorations, Tours…: a Class uses its course's own prerequisites).
  function minCertOf(k) { if (isCourseType(k)) return ""; return k.pub ? (k.minCertName || "") : (window.LDCatalog && window.LDCatalog.minCertName(k.minCert)) || ""; }
  function minCertSelect(k) {
    const { esc } = L(), CAT = window.LDCatalog; if (!CAT) return "";
    const opt = (c) => `<option value="${esc(c.id)}"${k.minCert === c.id ? " selected" : ""}>${esc(c.cert + (c.agency && c.agency !== "NAUI" ? " (" + c.agency + ")" : ""))}</option>`;
    return `<div class="field"><label for="cal-mincert">Minimum certification to join</label><select id="cal-mincert">
        <option value=""${k.minCert ? "" : " selected"}>None required</option>
        ${CAT.minCertGroups().map(g => `<optgroup label="${esc(g.label)}">${g.courses.map(opt).join("")}</optgroup>`).join("")}</select>
        <span class="hint" style="margin:0">Shown on the public calendar. Logged-in students see whether their account lists it (or an equivalent).</span></div>`;
  }
  function roster(k) { return L().state.enrollments.filter(e => e.classId === k.id); }
  function seatsLeft(k) { if (k.pub) return k.seatsLeft == null ? null : Number(k.seatsLeft); const n = Number(k.seats); return n > 0 ? Math.max(0, n - roster(k).length) : null; }
  function isPast(k) { const last = G().lastDate(k.dates); return !!last && last < G().today(); }
  function sorted(list) { return list.slice().sort((a, b) => (G().firstDate(a.dates) || "9999").localeCompare(G().firstDate(b.dates) || "9999")); }

  function blank(courseId, date) {
    const c = L().COURSES[courseId] || L().COURSES[L().COURSE_ORDER[0]], pr = L().program(c.id);
    // One date per scheduled day (Divemaster's self-paced phases start with just a start date).
    const n = c.unit === "Day" ? Math.max(1, c.schedule.length) : 1;
    const dates = Array.from({ length: n }, (_, i) => {
      const d = G().parse(date); if (!d) return "";
      d.setDate(d.getDate() + i); return G().ymd(d);
    });
    return {
      id: "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: "class", course: c.id, title: "", dates, time: pr.hours || "", location: pr.location || "",
      price: pr.price === "" || pr.price == null ? "" : Number(pr.price), seats: 6, notes: "", published: false,
      created: new Date().toISOString()
    };
  }

  // What classes.json holds: published classes that haven't ended, with public details only.
  function publicData() {
    const s = S(), t = G().today();
    const classes = sorted(data().classes.filter(k => k.published && (G().lastDate(k.dates) || t) >= t)).map(k => ({
      id: k.id, type: typeOf(k).id, typeName: typeOf(k).name, course: isCourseType(k) ? k.course : "", courseName: courseName(k), title: titleOf(k), color: colorOf(k),
      dates: (k.dates || []).filter(Boolean).sort(), time: k.time || "", location: k.location || "",
      price: k.price === "" || k.price == null ? null : Number(k.price),
      seats: Number(k.seats) > 0 ? Number(k.seats) : null, seatsLeft: seatsLeft(k), notes: k.notes || "",
      minCert: isCourseType(k) ? "" : k.minCert || "", minCertName: minCertOf(k)
    }));
    return {
      updated: new Date().toISOString(),
      heading: s.heading || "", intro: s.intro || "",
      contact: { instructor: s.instructor || "", phone: s.phone || "", email: s.email || "" },
      classes
    };
  }

  // ---------- who can add and change classes ----------
  // Only Instructors and Admins add, edit, enroll and publish. Everyone else (signed out, students,
  // Dive Masters) sees a read-only month with published classes only. When online logins aren't set up
  // (no supabase-config.js values) the calendar stays open, as before. The database has the same rule.
  function canEdit() { const C = window.LDCloud; return !C || !C.configured || C.can("instructor"); }
  // Visitors (and students and Dive Masters) see what was last published, read from the online calendar
  // (or classes.json), not this browser's own copy: on their phone or computer that copy is empty.
  function shown() {
    if (canEdit()) return data().classes;
    if (v.pub === null) { setTimeout(loadPublished, 0); return []; }
    return v.pub;
  }
  // Classes are kept in the browser they were made in. When an Instructor opens the calendar in another
  // browser (Brave, a phone, a new computer), published entries that aren't in this browser are listed here
  // so they can be copied in, and so publishing from here doesn't take them off the public calendar.
  function missingHere() {
    if (!canEdit()) return [];
    if (v.pub === null) { setTimeout(loadPublished, 0); return []; }
    const have = new Set(data().classes.map(k => k.id));
    return v.pub.filter(p => !have.has(p.id));
  }
  function copyPublishedHere() {
    const list = missingHere(), t = types();
    list.forEach(p => {
      const type = p.type || "class";
      if (!t.some(x => x.id === type)) t.push({ id: type, name: p.typeName || "Event", about: "", course: false, color: /^k\d$/.test(p.color || "") ? p.color : "" });
      data().classes.push({
        id: p.id, type, course: p.course || "", title: p.title || "", dates: p.dates.slice(), time: p.time || "", location: p.location || "",
        price: p.price == null || p.price === "" ? "" : Number(p.price), seats: Number(p.seats) > 0 ? Number(p.seats) : "", notes: p.notes || "", minCert: p.minCert || "",
        published: true, created: new Date().toISOString()
      });
    });
    L().save(); rerender();
    L().toast(list.length + " published entr" + (list.length === 1 ? "y" : "ies") + " copied into this browser.");
  }
  function missingNote() {
    const m = missingHere(); if (!m.length) return "";
    return `<p class="acct-note" style="margin:0 0 12px"><b>${m.length} published entr${m.length === 1 ? "y is" : "ies are"} not saved in this browser</b>
      (${L().esc(m.slice(0, 3).map(titleOf).join(", ") + (m.length > 3 ? "…" : ""))}). Your calendar is kept in the browser you made it in, so another browser
      or device starts without it. Publishing from here would take ${m.length === 1 ? "it" : "them"} off the public calendar.
      <button class="btn small" data-cact="copy-pub">Copy into this browser</button></p>`;
  }
  async function loadPublished() {
    if (v.pubBusy) return;
    v.pubBusy = true;
    let rows = null;
    const C = window.LDCloud;
    try {
      if (C && C.configured) {
        // Plain reads with the public key: anyone may read the published calendar (supabase/schema.sql).
        const get = (path) => fetch(C.url + "/rest/v1/" + path, { headers: { apikey: C.key }, cache: "no-store" })
          .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
        const [set, list] = await Promise.all([get("calendar_settings?id=eq.1&select=id"), get("classes?select=*")]);
        // Never published online yet: fall back to classes.json.
        if (Array.isArray(set) && set.length) rows = (list || []).map(k => ({
          id: k.id, type: k.event_type || "class", typeName: k.event_type_name || "Class", course: k.course, title: k.title,
          color: k.color, dates: k.dates, time: k.time, location: k.location, seatsLeft: k.seats_left,
          price: k.price, seats: k.seats, notes: k.notes, minCert: k.min_cert || "", minCertName: k.min_cert_name || ""
        }));
      }
    } catch (e) { console.warn("Online calendar not available:", e); }
    if (!rows) {
      try {
        const r = await fetch("classes.json", { cache: "no-store" });
        const d = r.ok ? await r.json() : {};
        rows = Array.isArray(d.classes) ? d.classes : [];
      } catch (e) { rows = []; }
    }
    v.pub = rows.map(k => Object.assign({}, k, { pub: true, published: true, type: k.type || "class",
      dates: (Array.isArray(k.dates) ? k.dates : []).filter(x => G().parse(x)).sort() }));
    v.pubBusy = false;
    if (L().view().mode === "calendar" && !v.sel) rerender();
  }

  // ---------- render ----------
  function render() {
    data();
    if (!v.ym) v.ym = G().ym(G().today());
    if (!canEdit()) { v.sel = null; v.publish = false; }
    // One wide panel: the month with upcoming classes below it, or a class, or the publish page.
    const back = `<div class="row-actions" style="margin:0 0 10px"><button class="btn small" data-cact="back">‹ Calendar</button></div>`;
    const body = v.publish ? back + renderPublish() : cur() ? renderClass(cur()) : renderMonth();
    return `<section class="panel" id="cal-panel">${body}</section>`;
  }

  function renderList() {
    const { esc } = L();
    const all = sorted(shown()), up = all.filter(k => !isPast(k)), past = all.filter(isPast).reverse();
    const edit = canEdit();
    const item = (k) => {
      const left = seatsLeft(k), n = roster(k).length;
      if (!edit) return `<li><div class="cal-ro"><span class="nm"><i class="cal-dot ${colorOf(k)}" aria-hidden="true"></i>${esc(titleOf(k))}</span>
        <span class="meta">${isCourseType(k) ? "" : esc(typeOf(k).name) + " · "}${esc(G().range(k.dates) || "No dates yet")}</span>
        <span class="meta">${left === null ? "" : left ? left + " open seat" + (left === 1 ? "" : "s") : "Full"}</span>
        ${minCertOf(k) ? `<span class="meta">Min Cert: ${esc(minCertOf(k))}</span>` : ""}</div></li>`;
      return `<li><button data-cact="pick" data-id="${k.id}" class="${k.id === v.sel && !v.publish ? "sel" : ""}">
        <span class="nm"><i class="cal-dot ${colorOf(k)}" aria-hidden="true"></i>${esc(titleOf(k))}</span>
        <span class="meta">${isCourseType(k) ? "" : esc(typeOf(k).name) + " · "}${esc(G().range(k.dates) || "No dates yet")}</span>
        ${minCertOf(k) ? `<span class="meta">Min Cert: ${esc(minCertOf(k))}</span>` : ""}
        <span class="meta">${esc([isCourseType(k) ? n + " enrolled" : "", left === null ? "" : left ? left + " open" : "full"].filter(Boolean).join(" · "))}
          <span class="cal-status${k.published ? " on" : ""}">${k.published ? "Published" : "Draft"}</span></span></button></li>`;
    };
    return `<h2 class="sec">Coming up</h2>
      <ul>${up.map(item).join("") || `<li class="meta" style="padding:8px 10px">Nothing on the calendar yet.</li>`}</ul>
      ${past.length ? `<button class="btn small" data-cact="past" aria-expanded="${v.past}">${v.past ? "Hide" : "Show"} past classes (${past.length})</button>
        ${v.past ? `<ul>${past.map(item).join("")}</ul>` : ""}` : ""}`;
  }

  function renderMonth() {
    const { esc } = L(), edit = canEdit(), C = window.LDCloud;
    const events = [];
    shown().forEach(k => {
      const ds = (k.dates || []).filter(Boolean).sort();
      ds.forEach((d, i) => events.push({
        date: d,
        html: !edit ? `<span class="cal-ev ${colorOf(k)}" title="${esc(titleOf(k))}">${esc(titleOf(k))}${ds.length > 1 ? ` <small>${i + 1}/${ds.length}</small>` : ""}</span>` : `<button class="cal-ev ${colorOf(k)}${k.published ? "" : " draft"}" data-cact="pick" data-id="${k.id}" title="${esc(titleOf(k) + (k.published ? "" : " (draft)"))}">
          ${esc(titleOf(k))}${ds.length > 1 ? ` <small>${i + 1}/${ds.length}</small>` : ""}</button>`
      }));
    });
    (v.reqs || []).forEach(r => r.dates.forEach(d => events.push({
      date: d, html: `<button class="req-tag request" data-cact="req-show" title="${esc("Requested: " + (r.course_name || r.course) + " by " + (r.student_name || r.student_email))}">Request: ${esc(r.student_name || r.student_email)}</button>`
    })));
    const used = L().COURSE_ORDER.filter(id => shown().some(k => isCourseType(k) && k.course === id));
    const usedTypes = edit ? types().filter(t => !t.course && shown().some(k => typeOf(k) === t))
      : shown().filter(k => !isCourseType(k)).map(typeOf).filter((t, i, a) => a.findIndex(x => x.name === t.name) === i);
    const signedIn = C && C.user;
    const lockNote = `<p class="acct-note" style="margin-top:12px">Only Instructors and Admins can add or change classes.${signedIn ? ` You're logged in as ${esc(C.ROLE_NAMES[C.role] || "Student")}.` : ""}
        ${signedIn ? "" : `<button class="btn small" data-mode="staff">Admin Log in</button>`} Want a class on a certain day? <a href="request.html">Request a class</a>.</p>`;
    return `<div class="rec-head"><div class="who"><span class="eyebrow">Class calendar</span><h1>${esc(G().monthName(v.ym))}</h1></div>
        ${edit ? `<div class="cal-tools no-print"><button class="btn primary" data-cact="new">+ Add to calendar</button>
        <button class="btn" data-cact="publish">Publish calendar…</button></div>` : ""}
        <div class="cal-nav"><button class="btn" data-cact="month" data-n="-1" aria-label="Previous month">‹</button>
        <button class="btn" data-cact="month" data-n="0">Today</button>
        <button class="btn" data-cact="month" data-n="1" aria-label="Next month">›</button></div></div>
      ${edit ? missingNote() : ""}
      ${requestsBox()}
      ${G().month(v.ym, events, edit ? { dayAct: (d) => `data-cact="new-on" data-date="${d}" title="Add a class on this day"` } : {})}
      <div class="cal-legend">${used.map(id => `<span><i class="cal-dot ${colorOf({ course: id })}" aria-hidden="true"></i>${esc(L().COURSES[id].name)}</span>`).join("")}
        ${usedTypes.map(t => `<span><i class="cal-dot ${t.color && /^k\d$/.test(t.color) && !edit ? t.color : colorOf({ type: t.id })}" aria-hidden="true"></i>${esc(t.name)}</span>`).join("")}
        ${shown().some(k => !k.published) ? `<span><i class="cal-dot draft" aria-hidden="true"></i>Draft (not published)</span>` : ""}</div>
      ${edit ? `<p class="hint" style="margin-top:12px">Click a day to add a class, event, exploration or tour on it, or click an entry to edit it. Published entries appear on the public calendar after you publish.</p>` : lockNote}
      <div class="roster cal-upcoming" id="cal-list">${renderList()}</div>`;
  }

  // ---------- class requests from students (request.html), when student accounts are set up ----------
  const canSeeReqs = () => !!(window.LDCloud && window.LDCloud.can("divemaster"));
  async function loadRequests() {
    if (v.reqsBusy || !canSeeReqs()) return;
    v.reqsBusy = true;
    const { data: rows, error } = await window.LDCloud.client.from("class_requests").select("*").eq("status", "pending").order("created_at");
    v.reqsBusy = false;
    v.reqsErr = error ? window.LDCloud.explain(error) : "";
    v.reqs = (rows || []).map(r => Object.assign({}, r, { dates: (Array.isArray(r.dates) ? r.dates : []).slice().sort() }));
    if (L().view().mode === "calendar" && !v.sel && !v.publish) rerender();
  }
  function requestsBox() {
    if (!canSeeReqs()) return "";
    if (v.reqs === null) { setTimeout(loadRequests, 0); return ""; }
    const { esc } = L(), boss = window.LDCloud.can("instructor");
    if (v.reqsErr) return `<p class="acct-note bad" role="alert">Class requests couldn't be loaded: ${esc(v.reqsErr)}</p>`;
    if (!v.reqs.length) return "";
    const need = (r) => { const c = window.LDCatalog && window.LDCatalog.find(r.course); return c ? window.LDCatalog.minDays(c) : 1; };
    return `<section class="cal-reqs" id="cal-reqs" aria-label="Class requests"><h2 class="sec">Class requests <span class="req-status wait">${v.reqs.length} waiting</span></h2>
      <ul class="req-list">${v.reqs.map(r => `<li><div><b>${esc(r.course_name || r.course)}</b>
          <span>${esc(r.student_name || "Student")}${r.student_email ? ` · <a href="mailto:${esc(r.student_email)}" data-email-to="${esc(r.student_email)}" data-email-name="${esc(r.student_name || "")}">${esc(r.student_email)}</a>` : ""}</span>
          <span class="when">${esc(r.dates.map(d => G().fmt(d, { weekday: "short", year: undefined })).join(" · "))} (${r.dates.length} day${r.dates.length === 1 ? "" : "s"}, needs ${need(r)})</span>
          ${r.notes ? `<span class="hint">“${esc(r.notes)}”</span>` : ""}
          <span class="hint">Asked ${esc(new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }))}</span></div>
        ${boss ? `<div class="req-acts"><input id="req-note-${esc(r.id)}" maxlength="1000" placeholder="Note to the student (optional)" aria-label="Note to ${esc(r.student_name || "the student")}">
          <button class="btn small primary" data-cact="req-schedule" data-id="${esc(r.id)}">Schedule as a class</button>
          <button class="btn small" data-cact="req-decline" data-id="${esc(r.id)}">Decline</button></div>` : ""}</li>`).join("")}</ul>
      ${boss ? `<p class="hint">Schedule makes a draft class on those days so you can enroll the student and publish it. The student sees your answer and note on their Request a class page.</p>` : ""}</section>`;
  }
  async function answerRequest(id, status) {
    const r = (v.reqs || []).find(x => x.id === id); if (!r) return;
    const noteEl = document.getElementById("req-note-" + id), note = noteEl ? noteEl.value.trim().slice(0, 1000) : "";
    let k = null;
    if (status === "scheduled") {
      const courseId = L().COURSES[r.course] ? r.course : L().COURSE_ORDER[0];
      k = blank(courseId, r.dates[0]);
      k.dates = r.dates.slice();
      if (/^offer-/.test(r.course)) {
        // A coaching or tours listing: schedule it as that listing's calendar type (Tour, Event…), with its name as the title.
        const o = await (window.LDOfferings ? window.LDOfferings.load() : Promise.resolve([])).then(list => list.find(x => "offer-" + x.id === r.course)).catch(() => null);
        const nonCourse = types().filter(t => !t.course);
        const t = nonCourse.find(x => x.id === (o && o.calType)) || nonCourse[0];
        if (t) Object.assign(k, { type: t.id, course: "", title: r.course_name || (o && o.name) || "", time: "", location: "", price: "" });
      }
      k.notes = r.notes ? "Requested by " + (r.student_name || r.student_email) + ": " + r.notes : "";
    }
    const { error } = await window.LDCloud.client.from("class_requests")
      .update({ status, staff_note: note, class_id: k ? k.id : null, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { L().toast("Not saved: " + window.LDCloud.explain(error)); return; }
    v.reqs = v.reqs.filter(x => x.id !== id);
    if (k) { data().classes.push(k); open(k.id); L().save(); L().go("calendar"); L().toast("Draft class made from the request. Enroll the student, then publish."); }
    else { rerender(); L().toast("Request declined"); }
  }
  if (window.LDCloud) window.LDCloud.onChange(() => { v.reqs = null; v.reqsErr = ""; v.pub = null; });

  function f(path, label, type, extra) {
    const k = cur(), val = path.split(".").reduce((o, x) => (o == null ? undefined : o[x]), k), id = "cal-f-" + path.replace(/\./g, "-");
    const t = type || "text";
    const ctl = t === "area"
      ? `<textarea id="${id}" data-ck="${path}">${L().esc(val)}</textarea>`
      : `<input id="${id}" type="${t}" data-ck="${path}" value="${L().esc(val)}"${t === "number" ? ' min="0" step="1" inputmode="decimal"' : ""}>`;
    return `<div class="field${extra ? " " + extra : ""}"><label for="${id}">${label}</label>${ctl}</div>`;
  }

  // embedded: the same form inside another page (Business → Scheduling), without the Calendar's own
  // back button, student list, duplicate and delete.
  function renderClass(k, embedded) {
    const { esc, money } = L(), c = course(k), ros = roster(k), left = seatsLeft(k);
    const unit = c ? c.unit : "Day";
    const enrolledIds = new Set(ros.map(e => e.studentId));
    const avail = L().state.students.filter(p => !enrolledIds.has(p.id)).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const ty = typeOf(k), isClass = !!ty.course;
    const dateLabel = (i) => !isClass ? (k.dates.length > 1 ? "Day " + (i + 1) : "Date") : c && c.unit === "Day" && c.schedule[i] ? c.schedule[i] : (i === 0 ? "Start date" : unit + " " + (i + 1));
    const typeSel = `<div class="field"><label for="cal-type">Type</label><select id="cal-type"${ros.length ? " disabled" : ""}>
        ${types().map(t => `<option value="${esc(t.id)}"${t === ty ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select>
        ${ros.length ? `<span class="hint" style="margin:0">Remove the students to change the type.</span>` : `<span class="hint" style="margin:0">${esc(ty.about || "")}</span>`}</div>`;
    return `${embedded ? "" : `<div class="row-actions" style="margin:0 0 10px"><button class="btn small" data-cact="back">‹ Calendar</button></div>`}
      <div class="rec-head"><div class="who"><span class="eyebrow"><i class="cal-dot ${colorOf(k)}" aria-hidden="true"></i> ${esc(isClass ? courseName(k) : ty.name)}</span>
        <h1 id="cal-title">${esc(titleOf(k))}</h1><span class="sub" id="cal-range">${esc(G().range(k.dates) || "No dates yet")}</span></div>
        <div class="stats">${isClass ? `<div class="stat"><b>${ros.length}</b><span>Enrolled</span></div>` : ""}
          <div class="stat"><b id="cal-left">${left === null ? "—" : left}</b><span>Seats open</span></div></div></div>

      <div class="cal-pub${k.published ? " on" : ""}"><label class="chk"><input type="checkbox" data-ck="published"${k.published ? " checked" : ""}> Show on the public calendar</label>
        <span class="hint" style="margin:0">${k.published ? "Published entries go out the next time you use Publish calendar." : "Drafts stay private to this app."}</span></div>

      <h2 class="sec">${esc(ty.name)}</h2><div class="grid">
        ${typeSel}
        ${isClass ? `<div class="field"><label for="cal-course">Course</label><select id="cal-course"${ros.length ? " disabled" : ""}>
          ${L().courseOptions(k.course)}</select>
          ${ros.length ? `<span class="hint" style="margin:0">Remove the students to change the course.</span>` : ""}</div>` : ""}
        ${isClass ? "" : minCertSelect(k)}
        ${f("title", isClass ? "Title (blank = course name)" : "Title")}${f("time", "Time")}${f("location", "Location")}
        ${f("price", "Price ($)", "number")}${f("seats", "Seats (blank = no limit)", "number")}
        ${f("notes", "Description for the public calendar", "area", "wide")}</div>

      <h2 class="sec">Dates</h2>
      <p class="hint">${isClass ? (c && c.unit === "Day" ? "One date per class day. " : "") + "Students enrolled from here get these dates and the location on their course record." : "Add a date for each day."}</p>
      <div class="grid">${(k.dates.length ? k.dates : [""]).map((d, i) => `<div class="field"><label for="cal-f-dates-${i}">${esc(dateLabel(i))}</label>
        <span class="cal-date"><input id="cal-f-dates-${i}" type="date" data-ck="dates.${i}" value="${esc(d)}">
        ${k.dates.length > 1 ? `<button class="btn small" data-cact="rm-date" data-i="${i}" aria-label="Remove this date">✕</button>` : ""}</span></div>`).join("")}</div>
      <div class="row-actions"><button class="btn" data-cact="add-date">+ Add a date</button></div>

      ${isClass && !embedded ? `<h2 class="sec">Students</h2>
      ${ros.length ? `<div class="tablewrap"><table class="m"><thead><tr><th>Student</th><th>Contact</th><th>Progress</th><th>Balance due</th><th></th></tr></thead><tbody>
        ${ros.map(e => { const p = L().personById(e.studentId) || {}; return `<tr>
          <td><button class="linkbtn" data-act="open-person" data-id="${esc(p.id || "")}">${esc(p.name || "Unnamed student")}</button></td>
          <td>${esc([p.phone, p.email].filter(Boolean).join(" · "))}</td><td>${L().progress(e).pct}%</td><td class="money">${money(L().owed(e).due)}</td>
          <td class="cal-acts"><button class="btn small" data-act="open-enr" data-id="${e.id}">Open record</button>
            <button class="btn small danger" data-cact="unenroll" data-id="${e.id}">Remove</button></td></tr>`; }).join("")}
      </tbody></table></div>` : `<p class="hint">No one is enrolled yet.</p>`}
      ${left === 0 ? `<p class="hint">This class is full. You can still enroll more students.</p>` : ""}
      <div class="row-actions">${avail.length ? `<select id="cal-enroll" aria-label="Student to enroll"><option value="">Choose a student…</option>${avail.map(p => `<option value="${p.id}">${esc(p.name || "Unnamed student")}</option>`).join("")}</select>
        <button class="btn primary" data-cact="enroll">Enroll</button>` : ""}
        <button class="btn" data-cact="enroll-new">+ New student</button>
        ${ros.some(e => (L().personById(e.studentId) || {}).email) ? `<button class="btn" data-cact="email-class">✉ Email this class</button>` : ""}</div>` : ""}

      ${embedded ? "" : `<div class="row-actions" style="margin-top:28px"><button class="btn" data-cact="dup">Duplicate</button>
        <button class="btn danger" data-cact="del">Delete…</button><span id="cal-del-confirm"></span></div>`}`;
  }
  // For Business → Scheduling: make a new calendar entry and edit it with this same form.
  function newEntry(typeId, date) {
    const n = blank(L().COURSE_ORDER[0], date || "");
    const t = types().find(x => x.id === typeId);
    if (t && !t.course) { n.type = t.id; n.dates = [G().firstDate(n.dates) || ""]; n.price = ""; n.time = ""; }
    data().classes.push(n); L().save();
    return n;
  }
  function renderForm(id) { open(id); const k = cur(); return k ? renderClass(k, true) : ""; }
  function closeForm() { v.sel = null; }
  function removeEntry(id) { L().state.enrollments.forEach(e => { if (e.classId === id) e.classId = ""; }); data().classes = data().classes.filter(x => x.id !== id); if (v.sel === id) v.sel = null; L().save(); }

  function renderPublish() {
    const { esc, money } = L(), d = publicData(), s = S();
    const sf = (k, label, type, extra) => `<div class="field${extra ? " " + extra : ""}"><label for="cal-s-${k}">${label}</label>${type === "area"
      ? `<textarea id="cal-s-${k}" data-cs="${k}">${esc(s[k])}</textarea>` : `<input id="cal-s-${k}" type="${type || "text"}" data-cs="${k}" value="${esc(s[k])}">`}</div>`;
    return `<div class="rec-head"><div class="who"><span class="eyebrow">Public calendar</span><h1>Publish your classes</h1></div></div>
      <p class="hint">The public calendar page shows the classes you mark <b>Show on the public calendar</b> that haven't ended yet: the course, dates, time, location, price, open seats, minimum certification and description. Student names and records are never included.</p>
      ${missingNote()}
      <h2 class="sec">1. Check what goes out</h2>
      ${d.classes.length ? `<div class="tablewrap"><table class="m"><thead><tr><th>Class</th><th>Dates</th><th>Price</th><th>Seats open</th></tr></thead><tbody>
        ${d.classes.map(k => `<tr><td><i class="cal-dot ${k.color}" aria-hidden="true"></i> ${esc(k.title)}${k.minCertName ? `<br><span class="hint" style="margin:0">Min Cert: ${esc(k.minCertName)}</span>` : ""}</td><td>${esc(G().range(k.dates) || "TBD")}</td>
          <td class="money">${k.price == null ? "" : money(k.price)}</td><td>${k.seatsLeft == null ? "Open" : k.seatsLeft || "Full"}</td></tr>`).join("")}</tbody></table></div>`
        : `<p class="hint"><b>No classes are marked to show yet.</b> Publishing now empties the public calendar.</p>`}
      <h2 class="sec">Page heading and contact</h2>
      <p class="hint">Shown on the public page. People use the email and phone to ask about a class.</p>
      <div class="grid">${sf("heading", "Heading", "text", "wide")}${sf("intro", "Introduction", "area", "wide")}
        ${sf("instructor", "Instructor")}${sf("email", "Email", "email")}${sf("phone", "Phone", "tel")}</div>
      ${onlineBox()}
      <h2 class="sec">${online() ? "Or, without an online account: download the file" : "2. Download the calendar file"}</h2>
      <div class="row-actions"><button class="btn primary" data-cact="download">Download classes.json</button></div>
      <h2 class="sec">3. Upload it to the website</h2>
      <ol class="cal-steps">
        <li>Open <a href="${UPLOAD_URL}" target="_blank" rel="noopener">Upload files on GitHub</a>.</li>
        <li>Drag in the <b>classes.json</b> you just downloaded (it replaces the old one), then click <b>Commit changes</b>.</li>
        <li>In about a minute it's live at <a href="${PUBLIC_URL}" target="_blank" rel="noopener">${esc(PUBLIC_URL.replace("https://", ""))}</a>. Share that link with students.</li>
      </ol>
      <p class="hint">The site needs GitHub Pages turned on once (see the README). Republish whenever you add a class, change one, or enroll students, so the open seats stay current.</p>`;
  }

  // ---------- publishing online (Supabase), when student accounts are set up ----------
  const online = () => !!(window.LDCloud && window.LDCloud.instructor);
  function onlineBox() {
    const C = window.LDCloud, { esc } = L();
    if (online()) {
      return `<h2 class="sec">2. Publish online</h2>
        <p class="hint">Updates the public calendar right away. No file to upload.${S().publishedOnline ? " Last published " + esc(new Date(S().publishedOnline).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })) + "." : ""}</p>
        <div class="row-actions"><button class="btn primary" data-cact="publish-online"${v.publishing ? " disabled" : ""}>${v.publishing ? "Publishing…" : "Publish online now"}</button></div>`;
    }
    if (C && C.configured) return `<p class="hint">Tip: sign in on the <button class="linkbtn" data-mode="account">Student account</button> page as the instructor to publish with one click instead.</p>`;
    return "";
  }
  async function publishOnline() {
    const sb = window.LDCloud.client, d = publicData();
    const rows = d.classes.map(k => ({
      id: k.id, course: k.course, course_name: k.courseName, title: k.title, color: k.color, dates: k.dates,
      time: k.time, location: k.location, price: k.price, seats: k.seats, seats_left: k.seatsLeft, notes: k.notes,
      event_type: k.type, event_type_name: k.typeName, min_cert: k.minCert, min_cert_name: k.minCertName, updated_at: d.updated
    }));
    const set = await sb.from("calendar_settings").upsert({ id: 1, heading: d.heading, intro: d.intro,
      instructor: d.contact.instructor, phone: d.contact.phone, email: d.contact.email, updated_at: d.updated });
    if (set.error) throw set.error;
    const old = await sb.from("classes").select("id");
    if (old.error) throw old.error;
    const keep = new Set(rows.map(r => r.id)), stale = (old.data || []).map(r => r.id).filter(id => !keep.has(id));
    if (rows.length) {
      let up = await sb.from("classes").upsert(rows);
      // Database not updated yet (supabase/schema.sql): publish without the newer columns.
      if (up.error && /min_cert|PGRST204|schema cache/i.test(up.error.message || "")) {
        up = await sb.from("classes").upsert(rows.map(r => { const x = Object.assign({}, r); delete x.min_cert; delete x.min_cert_name; return x; }));
        if (!up.error) setTimeout(() => L().toast("Published. Run the latest supabase/schema.sql so the public calendar shows minimum certifications."), 2500);
      }
      if (up.error && /event_type|PGRST204|schema cache/i.test(up.error.message || "")) {
        up = await sb.from("classes").upsert(rows.map(r => { const x = Object.assign({}, r); delete x.event_type; delete x.event_type_name; delete x.min_cert; delete x.min_cert_name; return x; }));
        if (!up.error) setTimeout(() => L().toast("Published. Run the latest supabase/schema.sql so the public calendar shows event types and minimum certifications."), 2500);
      }
      if (up.error) throw up.error;
    }
    if (stale.length) { const del = await sb.from("classes").delete().in("id", stale); if (del.error) throw del.error; }
    S().publishedOnline = d.updated; v.pub = null; L().save();
    return rows.length;
  }

  // ---------- Settings: the list of calendar entry types ----------
  function redrawTypes() { const box = document.getElementById("cal-types"); if (box) box.outerHTML = renderTypes(); }
  function renderTypes() {
    const { esc } = L(), list = types();
    const used = (t) => data().classes.filter(k => typeOf(k) === t).length;
    const rows = list.map((t, i) => {
      const n = used(t);
      return `<tr>
        <td><input aria-label="Type name" data-ct="name" data-i="${i}" value="${esc(t.name)}"></td>
        <td><input aria-label="Description" data-ct="about" data-i="${i}" value="${esc(t.about || "")}"></td>
        <td>${t.course ? `<span class="meta">Course colors</span>` : `<span class="cal-type-color"><i class="cal-dot ${esc(t.color || "k5")}" aria-hidden="true"></i><select aria-label="Color" data-ct="color" data-i="${i}">${TYPE_COLORS.map(([c, l]) => `<option value="${c}"${t.color === c ? " selected" : ""}>${l}</option>`).join("")}</select></span>`}</td>
        <td><label class="chk"><input type="checkbox" data-ct="course" data-i="${i}"${t.course ? " checked" : ""}${n ? " disabled" : ""}> Links to a course</label></td>
        <td class="meta">${n} on calendar</td>
        <td class="cal-acts"><button class="btn small" data-cact="type-up" data-i="${i}" aria-label="Move ${esc(t.name)} up"${i ? "" : " disabled"}>↑</button>
          <button class="btn small danger" data-cact="type-rm" data-i="${i}"${n || list.length < 2 ? ` disabled title="${n ? "Move or delete its calendar entries first" : "Keep at least one type"}"` : ""}>Remove</button></td></tr>`;
    }).join("");
    return `<section class="cal-types" id="cal-types"><h2 class="sec">Calendar event types</h2>
      <p class="hint">The kinds of things you can put on the calendar. A type that <b>links to a course</b> (like Class) lets you pick the course and enroll students. Other types just have a title. Renaming a type renames it everywhere. Republish the calendar to update the public page.</p>
      <div class="tablewrap"><table class="m"><thead><tr><th>Name</th><th>Description</th><th>Color</th><th>Kind</th><th>Used</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="row-actions"><button class="btn" data-cact="type-add">+ Add a type</button></div></section>`;
  }
  function typeInput(el) {
    const t = types()[Number(el.dataset.i)]; if (!t) return;
    const f = el.dataset.ct;
    if (f === "course") t.course = el.checked; else t[f] = el.value;
    if (f === "course" && !t.course && !t.color) t.color = "k6";
    L().save();
    if (f === "course" || f === "color") redrawTypes();
  }

  // ---------- updates without a full redraw (keeps focus while typing) ----------
  function refresh() {
    const k = cur(), list = document.getElementById("cal-list");
    if (list) list.innerHTML = renderList();
    if (!k) return;
    const t = document.getElementById("cal-title"); if (t) t.textContent = titleOf(k);
    const r = document.getElementById("cal-range"); if (r) r.textContent = G().range(k.dates) || "No dates yet";
    const l = document.getElementById("cal-left"); if (l) { const x = seatsLeft(k); l.textContent = x === null ? "—" : x; }
  }
  function rerender() { L().render(); }
  function open(id) { v.sel = id; v.publish = false; const k = cur(); if (k && G().firstDate(k.dates)) v.ym = G().ym(G().firstDate(k.dates)); }

  function download() {
    const blob = new Blob([JSON.stringify(publicData(), null, 2) + "\n"], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "classes.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    L().toast("classes.json downloaded. Upload it to GitHub to publish.");
  }

  // ---------- events ----------
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.cs) { S()[el.dataset.cs] = el.value; L().save(); return; }
    if (el.id === "cal-type") {
      const k = cur(); if (!k || roster(k).length) return;
      const wasClass = isCourseType(k);
      k.type = el.value;
      if (isCourseType(k) && !L().COURSES[k.course]) k.course = L().COURSE_ORDER[0];
      // A class filled in the course's days and price; an event starts as one day with no price.
      if (wasClass && !isCourseType(k)) { k.dates = [G().firstDate(k.dates) || ""]; k.price = ""; k.time = ""; }
      if (!wasClass && isCourseType(k)) { const fresh = blank(k.course, G().firstDate(k.dates)); k.dates = fresh.dates; k.price = fresh.price; if (!k.time) k.time = fresh.time; }
      L().save(); rerender(); const x = document.getElementById(isCourseType(k) ? "cal-type" : "cal-f-title"); if (x) x.focus(); return;
    }
    if (el.id === "cal-mincert") { const k = cur(); if (k) { k.minCert = el.value; L().save(); refresh(); } return; }
    if (el.dataset && el.dataset.ct) { typeInput(el); return; }
    if (el.id === "cal-course") {
      const k = cur(); if (!k) return;
      const fresh = blank(el.value, G().firstDate(k.dates));
      k.course = el.value; if (!k.time) k.time = fresh.time; if (!k.location) k.location = fresh.location;
      k.price = fresh.price; k.dates = fresh.dates;
      L().save(); rerender(); return;
    }
    if (!el.dataset || !el.dataset.ck) return;
    const k = cur(); if (!k) return;
    const path = el.dataset.ck;
    let val = el.type === "checkbox" ? el.checked : el.value;
    if (el.type === "number") val = el.value === "" ? "" : Number(el.value);
    if (path.startsWith("dates.")) k.dates[Number(path.split(".")[1])] = val;
    else k[path] = val;
    L().save();
    if (path === "published") { rerender(); return; }
    refresh();
  });

  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-cact]"); if (!b) return;
    const k = cur(), i = Number(b.dataset.i);
    // Looking around is open to all; anything that adds or changes a class is for Instructors and Admins.
    if (!canEdit() && !["month", "past", "back", "req-show"].includes(b.dataset.cact)) { L().toast("Only Instructors and Admins can add or change classes."); return; }
    switch (b.dataset.cact) {
      case "new": case "new-on": {
        const n = blank(L().COURSE_ORDER[0], b.dataset.date || "");
        data().classes.push(n); open(n.id); L().save(); L().go("calendar");
        const x = document.getElementById("cal-course"); if (x) x.focus();
        break;
      }
      case "pick": open(b.dataset.id); L().go("calendar"); break;
      case "type-add": {
        const list = types(), taken = new Set(list.map(t => t.color));
        list.push({ id: "t" + Date.now().toString(36), name: "New type", about: "", course: false, color: (TYPE_COLORS.find(([c]) => !taken.has(c)) || TYPE_COLORS[0])[0] });
        L().save(); redrawTypes();
        const inputs = document.querySelectorAll('#cal-types [data-ct="name"]'), last = inputs[inputs.length - 1]; if (last) { last.focus(); last.select(); }
        break;
      }
      case "type-up": case "type-rm": {
        const list = types(), n = Number(b.dataset.i);
        if (b.dataset.cact === "type-up" && n > 0) list.splice(n - 1, 0, list.splice(n, 1)[0]);
        if (b.dataset.cact === "type-rm" && list.length > 1 && !data().classes.some(k => typeOf(k) === list[n])) list.splice(n, 1);
        L().save(); redrawTypes();
        break;
      }
      case "back": v.sel = null; v.publish = false; rerender(); break;
      case "publish": v.publish = !v.publish; if (v.publish) v.sel = null; rerender(); break;
      case "past": v.past = !v.past; refresh(); break;
      case "month": v.ym = Number(b.dataset.n) ? G().addMonths(v.ym, Number(b.dataset.n)) : G().ym(G().today()); rerender(); break;
      case "add-date": {
        const last = G().parse(k.dates[k.dates.length - 1]);
        if (last) last.setDate(last.getDate() + 1);
        k.dates.push(last ? G().ymd(last) : ""); L().save(); rerender(); break;
      }
      case "rm-date": k.dates.splice(i, 1); L().save(); rerender(); break;
      case "enroll": {
        const sel = document.getElementById("cal-enroll");
        if (!sel || !sel.value) { L().toast("Choose a student first"); break; }
        const p = L().personById(sel.value);
        L().enrollInClass(sel.value, k); rerender(); L().toast((p && p.name || "Student") + " enrolled"); break;
      }
      case "enroll-new": {
        const p = L().addStudent(); L().enrollInClass(p.id, k);
        L().go("students", { psel: p.id, focus: "f-d-name" });
        L().toast("New student enrolled in " + titleOf(k) + ". Fill in their info here.");
        break;
      }
      case "email-class": {
        const to = roster(k).map(e => L().personById(e.studentId) || {}).filter(p => p.email).map(p => ({ name: p.name || "", email: p.email }));
        if (window.LDEmail) window.LDEmail.open({ to, about: "the " + titleOf(k) + " class", subject: titleOf(k) });
        break;
      }
      case "unenroll": {
        const en = L().state.enrollments.find(x => x.id === b.dataset.id); if (en) en.classId = "";
        L().save(); rerender(); L().toast("Removed from the class. Their course record stays in " + courseName(k) + ".");
        break;
      }
      case "dup": {
        const n = Object.assign(JSON.parse(JSON.stringify(k)), { id: blank(k.course).id, published: false, created: new Date().toISOString() });
        data().classes.push(n); open(n.id); L().save(); rerender(); L().toast("Copied as a draft. Set the new dates.");
        break;
      }
      case "del": {
        const n = roster(k).length;
        document.getElementById("cal-del-confirm").innerHTML = `Delete this ${L().esc(typeOf(k).name.toLowerCase())} for good?${n ? " The " + n + " enrolled student" + (n > 1 ? "s keep their course records." : " keeps their course record.") : ""} <button class="btn small danger" data-cact="del-yes">Delete</button>`;
        break;
      }
      case "del-yes": {
        roster(k).forEach(en => { en.classId = ""; });
        data().classes = data().classes.filter(x => x.id !== k.id); v.sel = null; L().save(); rerender(); L().toast("Class deleted");
        break;
      }
      case "download": download(); break;
      case "copy-pub": copyPublishedHere(); break;
      case "req-show": { const x = document.getElementById("cal-reqs"); if (x) x.scrollIntoView({ behavior: "smooth", block: "start" }); break; }
      case "req-schedule": b.disabled = true; await answerRequest(b.dataset.id, "scheduled"); break;
      case "req-decline": b.disabled = true; await answerRequest(b.dataset.id, "declined"); break;
      case "publish-online": {
        v.publishing = true; rerender();
        try { const n = await publishOnline(); L().toast("Published " + n + " class" + (n === 1 ? "" : "es") + ". The public calendar is up to date."); }
        catch (err) { L().toast("Not published: " + window.LDCloud.explain(err)); }
        v.publishing = false; rerender();
        break;
      }
    }
  });

  window.LDCalendar = { render, renderTypes, types, canEdit, newEntry, renderForm, closeForm, removeEntry };
  L().render();
})();
