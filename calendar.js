/* Limitless Diving — class calendar, the app's landing page.
   Classes live in the same browser storage as everything else (state.classes, state.calendarSettings),
   so Export backup / Import carry them. "Publish" writes classes.json: the published classes only, with no
   student names, which classes.html shows to the public. Load after app.js, courses.js and calendar-grid.js. */
(function () {
  "use strict";

  const L = () => window.LD;
  const G = () => window.LDCalGrid;
  const v = { ym: null, sel: null, past: false, publish: false };
  const UPLOAD_URL = "https://github.com/jlichner/limitless-diving-forms/upload/main";
  const PUBLIC_URL = "https://jlichner.github.io/limitless-diving-forms/classes.html";

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
  function cur() { return data().classes.find(k => k.id === v.sel) || null; }
  function course(k) { return L().COURSES[k.course] || null; }
  function courseName(k) { const c = course(k); return c ? (c.fullName || c.name) : k.course; }
  function titleOf(k) { return k.title || courseName(k); }
  function colorOf(k) { const i = L().COURSE_ORDER.indexOf(k.course); return "k" + ((i < 0 ? 5 : i) % 6); }
  function roster(k) { return L().state.enrollments.filter(e => e.classId === k.id); }
  function seatsLeft(k) { const n = Number(k.seats); return n > 0 ? Math.max(0, n - roster(k).length) : null; }
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
      course: c.id, title: "", dates, time: pr.hours || "", location: pr.location || "",
      price: pr.price === "" || pr.price == null ? "" : Number(pr.price), seats: 6, notes: "", published: false,
      created: new Date().toISOString()
    };
  }

  // What classes.json holds: published classes that haven't ended, with public details only.
  function publicData() {
    const s = S(), t = G().today();
    const classes = sorted(data().classes.filter(k => k.published && (G().lastDate(k.dates) || t) >= t)).map(k => ({
      id: k.id, course: k.course, courseName: courseName(k), title: titleOf(k), color: colorOf(k),
      dates: (k.dates || []).filter(Boolean).sort(), time: k.time || "", location: k.location || "",
      price: k.price === "" || k.price == null ? null : Number(k.price),
      seats: Number(k.seats) > 0 ? Number(k.seats) : null, seatsLeft: seatsLeft(k), notes: k.notes || ""
    }));
    return {
      updated: new Date().toISOString(),
      heading: s.heading || "", intro: s.intro || "",
      contact: { instructor: s.instructor || "", phone: s.phone || "", email: s.email || "" },
      classes
    };
  }

  // ---------- render ----------
  function render() {
    data();
    if (!v.ym) v.ym = G().ym(G().today());
    // One wide panel: the month with upcoming classes below it, or a class, or the publish page.
    const back = `<div class="row-actions" style="margin:0 0 10px"><button class="btn small" data-cact="back">‹ Calendar</button></div>`;
    const body = v.publish ? back + renderPublish() : cur() ? renderClass(cur()) : renderMonth();
    return `<section class="panel" id="cal-panel">${body}</section>`;
  }

  function renderList() {
    const { esc } = L();
    const all = sorted(data().classes), up = all.filter(k => !isPast(k)), past = all.filter(isPast).reverse();
    const item = (k) => {
      const left = seatsLeft(k), n = roster(k).length;
      return `<li><button data-cact="pick" data-id="${k.id}" class="${k.id === v.sel && !v.publish ? "sel" : ""}">
        <span class="nm"><i class="cal-dot ${colorOf(k)}" aria-hidden="true"></i>${esc(titleOf(k))}</span>
        <span class="meta">${esc(G().range(k.dates) || "No dates yet")}</span>
        <span class="meta">${n} enrolled${left === null ? "" : " · " + (left ? left + " open" : "full")}
          <span class="cal-status${k.published ? " on" : ""}">${k.published ? "Published" : "Draft"}</span></span></button></li>`;
    };
    return `<h2 class="sec">Upcoming classes</h2>
      <ul>${up.map(item).join("") || `<li class="meta" style="padding:8px 10px">No upcoming classes.</li>`}</ul>
      ${past.length ? `<button class="btn small" data-cact="past" aria-expanded="${v.past}">${v.past ? "Hide" : "Show"} past classes (${past.length})</button>
        ${v.past ? `<ul>${past.map(item).join("")}</ul>` : ""}` : ""}`;
  }

  function renderMonth() {
    const { esc } = L();
    const events = [];
    data().classes.forEach(k => {
      const ds = (k.dates || []).filter(Boolean).sort();
      ds.forEach((d, i) => events.push({
        date: d,
        html: `<button class="cal-ev ${colorOf(k)}${k.published ? "" : " draft"}" data-cact="pick" data-id="${k.id}" title="${esc(titleOf(k) + (k.published ? "" : " (draft)"))}">
          ${esc(titleOf(k))}${ds.length > 1 ? ` <small>${i + 1}/${ds.length}</small>` : ""}</button>`
      }));
    });
    const used = L().COURSE_ORDER.filter(id => data().classes.some(k => k.course === id));
    return `<div class="rec-head"><div class="who"><span class="eyebrow">Class calendar</span><h1>${esc(G().monthName(v.ym))}</h1></div>
        <div class="cal-tools no-print"><button class="btn primary" data-cact="new">+ New class</button>
        <button class="btn" data-cact="publish">Publish calendar…</button></div>
        <div class="cal-nav"><button class="btn" data-cact="month" data-n="-1" aria-label="Previous month">‹</button>
        <button class="btn" data-cact="month" data-n="0">Today</button>
        <button class="btn" data-cact="month" data-n="1" aria-label="Next month">›</button></div></div>
      ${G().month(v.ym, events, { dayAct: (d) => `data-cact="new-on" data-date="${d}" title="Add a class on this day"` })}
      <div class="cal-legend">${used.map(id => `<span><i class="cal-dot ${colorOf({ course: id })}" aria-hidden="true"></i>${esc(L().COURSES[id].name)}</span>`).join("")}
        ${data().classes.some(k => !k.published) ? `<span><i class="cal-dot draft" aria-hidden="true"></i>Draft (not published)</span>` : ""}</div>
      <p class="hint" style="margin-top:12px">Click a day to add a class on it, or a class to edit it and enroll students. Published classes appear on the public calendar after you publish.</p>
      <div class="roster cal-upcoming" id="cal-list">${renderList()}</div>`;
  }

  function f(path, label, type, extra) {
    const k = cur(), val = path.split(".").reduce((o, x) => (o == null ? undefined : o[x]), k), id = "cal-f-" + path.replace(/\./g, "-");
    const t = type || "text";
    const ctl = t === "area"
      ? `<textarea id="${id}" data-ck="${path}">${L().esc(val)}</textarea>`
      : `<input id="${id}" type="${t}" data-ck="${path}" value="${L().esc(val)}"${t === "number" ? ' min="0" step="1" inputmode="decimal"' : ""}>`;
    return `<div class="field${extra ? " " + extra : ""}"><label for="${id}">${label}</label>${ctl}</div>`;
  }

  function renderClass(k) {
    const { esc, money } = L(), c = course(k), ros = roster(k), left = seatsLeft(k);
    const unit = c ? c.unit : "Day";
    const enrolledIds = new Set(ros.map(e => e.studentId));
    const avail = L().state.students.filter(p => !enrolledIds.has(p.id)).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const dateLabel = (i) => c && c.unit === "Day" && c.schedule[i] ? c.schedule[i] : (i === 0 ? "Start date" : unit + " " + (i + 1));
    return `<div class="row-actions" style="margin:0 0 10px"><button class="btn small" data-cact="back">‹ Calendar</button></div>
      <div class="rec-head"><div class="who"><span class="eyebrow"><i class="cal-dot ${colorOf(k)}" aria-hidden="true"></i> ${esc(courseName(k))}</span>
        <h1 id="cal-title">${esc(titleOf(k))}</h1><span class="sub" id="cal-range">${esc(G().range(k.dates) || "No dates yet")}</span></div>
        <div class="stats"><div class="stat"><b>${ros.length}</b><span>Enrolled</span></div>
          <div class="stat"><b id="cal-left">${left === null ? "—" : left}</b><span>Seats open</span></div></div></div>

      <div class="cal-pub${k.published ? " on" : ""}"><label class="chk"><input type="checkbox" data-ck="published"${k.published ? " checked" : ""}> Show on the public calendar</label>
        <span class="hint" style="margin:0">${k.published ? "Published classes go out the next time you use Publish calendar." : "Drafts stay private to this app."}</span></div>

      <h2 class="sec">Class</h2><div class="grid">
        <div class="field"><label for="cal-course">Course</label><select id="cal-course"${ros.length ? " disabled" : ""}>
          ${L().COURSE_ORDER.map(id => `<option value="${id}"${id === k.course ? " selected" : ""}>${esc(L().COURSES[id].fullName || L().COURSES[id].name)}</option>`).join("")}</select>
          ${ros.length ? `<span class="hint" style="margin:0">Remove the students to change the course.</span>` : ""}</div>
        ${f("title", "Title (blank = course name)")}${f("time", "Time")}${f("location", "Location")}
        ${f("price", "Price ($)", "number")}${f("seats", "Seats (blank = no limit)", "number")}
        ${f("notes", "Description for the public calendar", "area", "wide")}</div>

      <h2 class="sec">Dates</h2>
      <p class="hint">${c && c.unit === "Day" ? "One date per class day. " : ""}Students enrolled from here get these dates and the location on their course record.</p>
      <div class="grid">${(k.dates.length ? k.dates : [""]).map((d, i) => `<div class="field"><label for="cal-f-dates-${i}">${esc(dateLabel(i))}</label>
        <span class="cal-date"><input id="cal-f-dates-${i}" type="date" data-ck="dates.${i}" value="${esc(d)}">
        ${k.dates.length > 1 ? `<button class="btn small" data-cact="rm-date" data-i="${i}" aria-label="Remove this date">✕</button>` : ""}</span></div>`).join("")}</div>
      <div class="row-actions"><button class="btn" data-cact="add-date">+ Add a date</button></div>

      <h2 class="sec">Students</h2>
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
        <button class="btn" data-cact="enroll-new">+ New student</button></div>

      <div class="row-actions" style="margin-top:28px"><button class="btn" data-cact="dup">Duplicate class</button>
        <button class="btn danger" data-cact="del">Delete class…</button><span id="cal-del-confirm"></span></div>`;
  }

  function renderPublish() {
    const { esc, money } = L(), d = publicData(), s = S();
    const sf = (k, label, type, extra) => `<div class="field${extra ? " " + extra : ""}"><label for="cal-s-${k}">${label}</label>${type === "area"
      ? `<textarea id="cal-s-${k}" data-cs="${k}">${esc(s[k])}</textarea>` : `<input id="cal-s-${k}" type="${type || "text"}" data-cs="${k}" value="${esc(s[k])}">`}</div>`;
    return `<div class="rec-head"><div class="who"><span class="eyebrow">Public calendar</span><h1>Publish your classes</h1></div></div>
      <p class="hint">The public calendar page shows the classes you mark <b>Show on the public calendar</b> that haven't ended yet: the course, dates, time, location, price, open seats and description. Student names and records are never included.</p>
      <h2 class="sec">1. Check what goes out</h2>
      ${d.classes.length ? `<div class="tablewrap"><table class="m"><thead><tr><th>Class</th><th>Dates</th><th>Price</th><th>Seats open</th></tr></thead><tbody>
        ${d.classes.map(k => `<tr><td><i class="cal-dot ${k.color}" aria-hidden="true"></i> ${esc(k.title)}</td><td>${esc(G().range(k.dates) || "TBD")}</td>
          <td class="money">${k.price == null ? "" : money(k.price)}</td><td>${k.seatsLeft == null ? "Open" : k.seatsLeft || "Full"}</td></tr>`).join("")}</tbody></table></div>`
        : `<p class="hint"><b>No classes are marked to show yet.</b> Publishing now empties the public calendar.</p>`}
      <h2 class="sec">Page heading and contact</h2>
      <p class="hint">Shown on the public page. People use the email and phone to ask about a class.</p>
      <div class="grid">${sf("heading", "Heading", "text", "wide")}${sf("intro", "Introduction", "area", "wide")}
        ${sf("instructor", "Instructor")}${sf("email", "Email", "email")}${sf("phone", "Phone", "tel")}</div>
      <h2 class="sec">2. Download the calendar file</h2>
      <div class="row-actions"><button class="btn primary" data-cact="download">Download classes.json</button></div>
      <h2 class="sec">3. Upload it to the website</h2>
      <ol class="cal-steps">
        <li>Open <a href="${UPLOAD_URL}" target="_blank" rel="noopener">Upload files on GitHub</a>.</li>
        <li>Drag in the <b>classes.json</b> you just downloaded (it replaces the old one), then click <b>Commit changes</b>.</li>
        <li>In about a minute it's live at <a href="${PUBLIC_URL}" target="_blank" rel="noopener">${esc(PUBLIC_URL.replace("https://", ""))}</a>. Share that link with students.</li>
      </ol>
      <p class="hint">The site needs GitHub Pages turned on once (see the README). Republish whenever you add a class, change one, or enroll students, so the open seats stay current.</p>`;
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

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cact]"); if (!b) return;
    const k = cur(), i = Number(b.dataset.i);
    switch (b.dataset.cact) {
      case "new": case "new-on": {
        const n = blank(L().COURSE_ORDER[0], b.dataset.date || "");
        data().classes.push(n); open(n.id); L().save(); L().go("calendar");
        const x = document.getElementById("cal-course"); if (x) x.focus();
        break;
      }
      case "pick": open(b.dataset.id); L().go("calendar"); break;
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
        document.getElementById("cal-del-confirm").innerHTML = `Delete this class for good?${n ? " The " + n + " enrolled student" + (n > 1 ? "s keep their course records." : " keeps their course record.") : ""} <button class="btn small danger" data-cact="del-yes">Delete</button>`;
        break;
      }
      case "del-yes": {
        roster(k).forEach(en => { en.classId = ""; });
        data().classes = data().classes.filter(x => x.id !== k.id); v.sel = null; L().save(); rerender(); L().toast("Class deleted");
        break;
      }
      case "download": download(); break;
    }
  });

  window.LDCalendar = { render };
  L().render();
})();
