/* Limitless Diving — Request a class (request.html). A signed-in student picks a course and the days they'd
   like to train. Days that already have a class, or that someone else has asked for, can't be picked
   (taken_dates() in supabase/schema.sql), and a course needs at least one day for every 2 open water dives
   in its standards (LDCatalog.minDays). The instructor sees the request on the Calendar and schedules or
   declines it; the student sees the answer here. */
(function () {
  "use strict";

  const G = window.LDCalGrid, esc = G.esc, CAT = window.LDCatalog, C = window.LDCloud;
  const main = document.getElementById("req");
  const v = { course: "", picked: [], notes: "", ym: "", busy: false, note: "", noteKind: "", loaded: false };
  let taken = new Set(), mine = [], profile = null, lastUser;

  const STATUS = {
    pending: ["Waiting for an answer", "wait"],
    scheduled: ["Scheduled", "ok"],
    declined: ["Not scheduled", "no"]
  };

  function tomorrow() { const d = G.parse(G.today()); d.setDate(d.getDate() + 1); return G.ymd(d); }
  function course() { return v.course ? CAT.find(v.course) : null; }
  function setNote(text, kind) { v.note = text || ""; v.noteKind = kind || ""; }
  function noteHtml() { return v.note ? `<p class="acct-note ${v.noteKind}" role="${v.noteKind === "bad" ? "alert" : "status"}">${esc(v.note)}</p>` : ""; }

  function courseSelect() {
    return `<select id="r-course"><option value="">Choose a course…</option>
      ${CAT.byAgency().map(g => `<optgroup label="${esc(g.agency)}">${g.courses.map(c => `<option value="${esc(c.id)}"${c.id === v.course ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</optgroup>`).join("")}
    </select>`;
  }

  function courseInfo(c) {
    if (!c) return "";
    const s = c.std, need = CAT.minDays(c);
    const dives = s && Number(s.dives) > 0
      ? `${s.dives} open water dive${s.dives === 1 ? "" : "s"}, and we do no more than ${CAT.DIVES_PER_DAY} training dives a day, so pick <b>at least ${need} day${need === 1 ? "" : "s"}</b>.`
      : `Pick <b>at least 1 day</b>. We'll confirm how many days the course needs.`;
    return `<div class="req-info"><p>${c.about ? esc(c.about) + " " : ""}<a href="available-classes.html#course=${esc(c.id)}">Course details</a></p>
      <p class="req-need">This course has ${dives}</p>
      ${s && s.prereqs && s.prereqs.length ? `<details><summary>What you need to start</summary><ul>${s.prereqs.map(p => `<li>${esc(p)}</li>`).join("")}</ul></details>` : ""}</div>`;
  }

  function calendar() {
    const t = tomorrow(), events = [];
    v.picked.forEach(d => events.push({ date: d, html: `<span class="req-tag pick">Picked</span>` }));
    taken.forEach(d => { if (!v.picked.includes(d)) events.push({ date: d, html: `<span class="req-tag taken">Taken</span>` }); });
    const grid = G.month(v.ym, events, {
      dayAct: (d) => d < t || taken.has(d) ? 'aria-disabled="true"'
        : `data-day="${d}" role="button" tabindex="0" aria-pressed="${v.picked.includes(d)}" title="${v.picked.includes(d) ? "Remove this day" : "Pick this day"}"`
    });
    return `<div class="pub-month"><h3>${esc(G.monthName(v.ym))}</h3>
        <div class="cal-nav"><button type="button" class="btn" data-m="-1" aria-label="Previous month"${v.ym <= G.ym(t) ? " disabled" : ""}>‹</button>
        <button type="button" class="btn" data-m="1" aria-label="Next month">›</button></div></div>
      <div class="req-cal">${grid}</div>`;
  }

  function form() {
    const c = course(), need = c ? CAT.minDays(c) : 1, n = v.picked.length;
    const count = !c ? "" : n >= need
      ? `<span class="ok">${n} day${n === 1 ? "" : "s"} picked: ${esc(v.picked.map(d => G.fmt(d, { weekday: "short", year: undefined })).join(", "))}</span>`
      : `<span>${n} of at least ${need} day${need === 1 ? "" : "s"} picked</span>`;
    return `<form class="panel req-form" id="req-form" novalidate>
      <h2 class="sec">1. Choose a course</h2>
      <div class="field wide"><label for="r-course">Course</label>${courseSelect()}</div>
      ${courseInfo(c)}
      <h2 class="sec">2. Pick your days</h2>
      <p class="hint">Tap the days you'd like to train. Days marked <b>Taken</b> already have a class or a request. You can pick extra days to give us options.</p>
      ${calendar()}
      <p class="req-count" role="status">${count}</p>
      <h2 class="sec">3. Anything we should know?</h2>
      <div class="field wide"><label for="r-notes">Notes (optional)</label><textarea id="r-notes" maxlength="2000" placeholder="e.g. Morning starts work best, or I'd like to bring a friend">${esc(v.notes)}</textarea></div>
      ${noteHtml()}
      <div class="acct-save"><button class="btn primary" type="submit"${v.busy ? " disabled" : ""}>${v.busy ? "Sending…" : "Send my request"}</button></div>
    </form>`;
  }

  function myRequests() {
    if (!mine.length) return "";
    return `<section class="panel"><h2 class="sec">My requests</h2><ul class="req-list">
      ${mine.map(r => { const st = STATUS[r.status] || STATUS.pending; return `<li>
        <div><b>${esc(r.course_name || r.course)}</b> <span class="req-status ${st[1]}">${esc(st[0])}</span>
        <span class="when">${esc(G.range(r.dates))}</span>
        ${r.staff_note ? `<span class="hint">From your instructor: ${esc(r.staff_note)}</span>` : ""}
        ${r.status === "scheduled" ? `<span class="hint">See it on the <a href="classes.html">class calendar</a>.</span>` : ""}</div>
        ${r.status === "pending" ? `<button type="button" class="btn small" data-withdraw="${esc(r.id)}">Withdraw</button>` : ""}</li>`; }).join("")}
    </ul></section>`;
  }

  function render() {
    if (!C || !C.configured) {
      main.innerHTML = `<div class="msg"><h1>Class requests are coming soon</h1><p>In the meantime, see the <a href="available-classes.html">available classes</a> and get in touch.</p></div>`;
      return;
    }
    if (!C.available) { main.innerHTML = `<div class="msg">The sign-in service couldn't be loaded. Check your connection and refresh the page.</div>`; return; }
    if (!C.loaded) { main.innerHTML = `<div class="msg">Loading…</div>`; return; }
    if (!C.user) {
      main.innerHTML = `<section class="pub-hero"><h1>Request a class</h1><p>Pick a course and the days that work for you, and we'll set it up.</p></section>
        <div class="msg"><p>Please log in to your student account first, so we know who's asking and how to reach you.</p>
        <p><a class="btn primary" href="account.html#then=request">Student log in</a></p><p class="hint">New here? You can create an account on the same page.</p></div>`;
      return;
    }
    if (!v.loaded) { main.innerHTML = `<div class="msg">Loading open dates…</div>`; return; }
    main.innerHTML = `<section class="pub-hero"><h1>Request a class</h1>
        <p>Pick a course and the days that work for you. We'll confirm by email, and you'll see the answer here.</p></section>
      ${myRequests()}${form()}`;
  }

  async function load() {
    const sb = C.client, uid = C.user.id;
    const [t, r, p] = await Promise.all([
      sb.rpc("taken_dates"),
      sb.from("class_requests").select("*").eq("student_id", uid).order("created_at", { ascending: false }),
      sb.from("student_profiles").select("full_name").eq("id", uid).maybeSingle()
    ]);
    if (t.error || r.error) setNote(C.explain(t.error || r.error), "bad");
    taken = new Set((t.data || []).map(x => typeof x === "string" ? x : x.taken_dates).filter(Boolean));
    mine = (r.data || []).map(x => Object.assign({}, x, { dates: (Array.isArray(x.dates) ? x.dates : []).slice().sort() }));
    profile = p.data || null;
    v.picked = v.picked.filter(d => !taken.has(d));
    v.loaded = true;
    render();
  }

  // ---------- events ----------
  function toggle(d) {
    const i = v.picked.indexOf(d);
    if (i >= 0) v.picked.splice(i, 1); else v.picked.push(d);
    v.picked.sort(); setNote(""); render();
    const cell = main.querySelector(`[data-day="${d}"]`); if (cell) cell.focus();
  }
  main.addEventListener("click", async (e) => {
    const day = e.target.closest("[data-day]");
    if (day) { toggle(day.dataset.day); return; }
    const m = e.target.closest("[data-m]");
    if (m && !m.disabled) { v.ym = G.addMonths(v.ym, Number(m.dataset.m)); render(); return; }
    const w = e.target.closest("[data-withdraw]");
    if (w) {
      w.disabled = true;
      const { error } = await C.client.from("class_requests").delete().eq("id", w.dataset.withdraw);
      setNote(error ? C.explain(error) : "Request withdrawn.", error ? "bad" : "ok");
      await load();
    }
  });
  main.addEventListener("keydown", (e) => {
    const day = e.target.closest("[data-day]");
    if (day && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(day.dataset.day); }
  });
  main.addEventListener("input", (e) => {
    if (e.target.id === "r-notes") v.notes = e.target.value;
  });
  main.addEventListener("change", (e) => {
    if (e.target.id === "r-course") { v.course = e.target.value; setNote(""); render(); }
  });
  main.addEventListener("submit", async (e) => {
    e.preventDefault();
    const c = course();
    if (!c) { setNote("Please choose a course.", "bad"); render(); return; }
    const need = CAT.minDays(c);
    if (v.picked.length < need) {
      setNote(`${c.name} needs at least ${need} day${need === 1 ? "" : "s"} (no more than ${CAT.DIVES_PER_DAY} training dives a day). Please pick ${need - v.picked.length} more.`, "bad");
      render(); return;
    }
    v.busy = true; setNote(""); render();
    const { error } = await C.client.from("class_requests").insert({
      course: c.app, course_name: c.fullName, dates: v.picked, notes: v.notes.trim().slice(0, 2000),
      student_name: String((profile && profile.full_name) || (C.user.user_metadata && C.user.user_metadata.full_name) || "").slice(0, 200),
      student_email: String(C.user.email || "").slice(0, 320)
    });
    v.busy = false;
    if (error) { setNote(C.explain(error), "bad"); await load(); return; }
    setNote("Request sent. We'll be in touch to confirm.", "ok");
    v.course = ""; v.picked = []; v.notes = "";
    await load();
    window.scrollTo(0, 0);
  });

  // ---------- start ----------
  const q = new URLSearchParams(location.search).get("course");
  if (q && CAT.find(q)) v.course = CAT.find(q).id;
  v.ym = G.ym(tomorrow());
  render();
  if (!C || !C.available) return;
  C.onChange(async () => {
    const uid = C.user && C.user.id;
    if (uid === lastUser) return;
    lastUser = uid; v.loaded = false; render();
    if (uid) { try { await load(); } catch (err) { setNote(C.explain(err), "bad"); v.loaded = true; render(); } }
  });
  C.ready.then(() => { if (!C.user) render(); });
})();
