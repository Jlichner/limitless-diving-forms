/* Limitless Diving — Business → Email groups: email members, or groups of members, about an exploration trip,
   a new class or news (Instructors and Admins).
   Groups: everyone, a level (Student, Dive Master…), a calendar entry they signed up for, a course record,
   a certification they hold, or a site maps level. Tick groups, then tick or untick single people.
   Anyone who opted out in their Student portal (or with the unsubscribe link) is left out, and so is anyone who
   hasn't confirmed their email. Sending goes through the send-email Edge Function in "promo" mode, 50 people
   per call; each email ends with that person's own unsubscribe link. Resend's free plan allows 100 emails a day:
   when it runs out part way, the rest is kept in this browser to send later ("Send the rest").
   Data: the email_audience() and promo_recipients() functions in supabase/schema.sql.
   window.LDEmailGroups = { render, preset(ids, label) }. Load after app.js and cloud.js. */
(function () {
  "use strict";

  const CHUNK = 50;          // the function takes up to 50 people per call
  const PENDING_KEY = "ld-email-groups-pending";
  const L = () => window.LD, C = () => window.LDCloud || {};
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ROLE_GROUPS = [["student", "Students"], ["divemaster", "Dive Masters"], ["instructor", "Instructors"], ["admin", "Admins"]];
  const SITE_GROUPS = [["green", "Green: open water"], ["blue", "Blue: advanced"], ["black", "Black: tech"],
    ["double-black", "Double black: tech on scooters"], ["survey", "Survey team"], ["site-admin", "Dive site admin"]];

  const v = {
    people: null, loading: false, error: "",
    groups: new Set(),      // ticked group keys, like "role:student", "event:<id>", "cert:naui|advanced"
    added: new Set(), removed: new Set(),   // single people ticked or unticked by hand
    q: "", subject: "", message: "", copy: true,
    busy: false, progress: "", note: "", noteKind: "", presetLabel: ""
  };

  // ---------- data ----------
  async function load() {
    if (v.loading) return;
    v.loading = true; v.error = "";
    try {
      const { data, error } = await C().client.rpc("email_audience");
      if (error) throw error;
      v.people = (data || []).map(p => Object.assign(p, {
        certifications: Array.isArray(p.certifications) ? p.certifications : [],
        events: Array.isArray(p.events) ? p.events : [], courses: Array.isArray(p.courses) ? p.courses : []
      }));
    } catch (err) {
      const m = C().explain ? C().explain(err) : String(err && err.message || err);
      v.error = /email_audience|function|schema cache/i.test(m)
        ? "The email groups aren't set up in Supabase yet. Run the latest schema.sql in the Supabase SQL Editor, then refresh this page."
        : "The list of members couldn't be loaded: " + m;
      v.people = null;
    }
    v.loading = false; rerender();
  }

  const certKey = (c) => (String(c.agency || "").trim() + "|" + String(c.level || "").trim()).toLowerCase();
  const certLabel = (c) => [String(c.agency || "").trim(), String(c.level || "").trim()].filter(Boolean).join(" · ");
  const courseName = (id) => { const c = L() && L().COURSES && L().COURSES[id]; return (c && c.name) || id; };
  const firstDate = (ds) => (Array.isArray(ds) ? ds.filter(Boolean).sort()[0] : "") || "";

  // Every group that has someone in it, built from the people list.
  function groupList() {
    const P = v.people || [], out = [];
    const count = (fn) => P.filter(fn).length;
    out.push({ sec: "Everyone", items: [{ key: "all", label: "Everyone with an account", n: P.length }] });
    out.push({ sec: "Level", items: ROLE_GROUPS.map(([r, l]) => ({ key: "role:" + r, label: l, n: count(p => p.role === r) })).filter(g => g.n) });
    const ev = new Map();
    P.forEach(p => p.events.forEach(e => { if (!ev.has(e.id)) ev.set(e.id, { key: "event:" + e.id, label: e.title, date: firstDate(e.dates), n: 0 }); ev.get(e.id).n++; }));
    out.push({ sec: "Signed up for", hint: "Joined, enrolled or asked to sign up", items: [...ev.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .map(g => Object.assign(g, { label: g.label + (g.date && L().fmtDate ? " · " + L().fmtDate(g.date) : "") })) });
    const co = new Map();
    P.forEach(p => p.courses.forEach(id => { if (!co.has(id)) co.set(id, { key: "course:" + id, label: courseName(id), n: 0 }); co.get(id).n++; }));
    out.push({ sec: "Course records", hint: "Students you've enrolled in a course", items: [...co.values()].sort((a, b) => a.label.localeCompare(b.label)) });
    const ce = new Map();
    P.forEach(p => { const mine = new Set(); p.certifications.forEach(c => { const k = certKey(c); if (k === "|" || mine.has(k)) return; mine.add(k);
      if (!ce.has(k)) ce.set(k, { key: "cert:" + k, label: certLabel(c), n: 0 }); ce.get(k).n++; }); });
    out.push({ sec: "Certification held", hint: "From their Student portal", items: [...ce.values()].sort((a, b) => a.label.localeCompare(b.label)) });
    out.push({ sec: "Site maps level", items: SITE_GROUPS.map(([s, l]) => ({ key: "site:" + s, label: l, n: count(p => p.site_level === s) })).filter(g => g.n) });
    return out.filter(s => s.items.length);
  }
  function inGroup(p, key) {
    if (key === "all") return true;
    const i = key.indexOf(":"), kind = key.slice(0, i), val = key.slice(i + 1);
    if (kind === "role") return p.role === val;
    if (kind === "event") return p.events.some(e => e.id === val);
    if (kind === "course") return p.courses.includes(val);
    if (kind === "cert") return p.certifications.some(c => certKey(c) === val);
    if (kind === "site") return p.site_level === val;
    return false;
  }
  const reachable = (p) => !p.opted_out && p.email_confirmed;
  function picked(p) {
    if (v.removed.has(p.id)) return false;
    if (v.added.has(p.id)) return true;
    for (const g of v.groups) if (inGroup(p, g)) return true;
    return false;
  }
  const chosen = () => (v.people || []).filter(p => picked(p));
  const sendable = () => chosen().filter(reachable);

  // ---------- saved "send the rest" ----------
  function pending() { try { const x = JSON.parse(localStorage.getItem(PENDING_KEY) || "null"); return x && Array.isArray(x.ids) && x.ids.length ? x : null; } catch (e) { return null; } }
  function savePending(x) { try { if (x) localStorage.setItem(PENDING_KEY, JSON.stringify(x)); else localStorage.removeItem(PENDING_KEY); } catch (e) { /* private window */ } }

  // ---------- drawing ----------
  function render() {
    const c = C();
    if (!c.available) return `<section class="panel"><div class="empty"><h2>Email groups</h2><p>Online accounts aren't set up, so there's no one to email yet.</p></div></section>`;
    if (!c.can || !c.can("instructor")) return `<section class="panel"><div class="empty"><h2>Staff only</h2><p>Emailing groups is for Instructors and Admins.</p></div></section>`;
    if (!v.people && !v.error) { load(); return `<section class="panel"><div class="empty"><h2>Loading members…</h2></div></section>`; }
    if (v.error) return `<section class="panel"><div class="empty"><h2>Email groups</h2><p class="acct-note bad" role="alert">${esc(v.error)}</p>
      <div class="row-actions" style="justify-content:center"><button class="btn" data-eg="reload">Try again</button></div></div></section>`;
    const P = v.people, ch = chosen(), ok = ch.filter(reachable), left = ch.length - ok.length, pend = pending();
    const words = v.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const shown = P.filter(p => {
      if (!words.length) return picked(p);
      const hay = [p.full_name, p.email, p.role, ...p.certifications.map(certLabel), ...p.events.map(e => e.title)].join(" ").toLowerCase();
      return words.every(w => hay.includes(w));
    });
    return `<section class="panel eg">
      <div class="eg-head"><div><span class="eyebrow">Business</span><h2>Email groups</h2>
        <p class="hint">Promote an exploration trip, a new class or news. Pick groups, then add or take off single people. Each person gets their own copy with an unsubscribe link at the bottom. Anyone who opted out in their Student portal is left out automatically.</p></div>
        <button class="btn small" data-eg="reload" title="Load the member list again">↻ Refresh</button></div>
      ${pend ? `<div class="acct-note eg-pending" role="status"><b>${pend.ids.length} ${pend.ids.length === 1 ? "person" : "people"} still to get “${esc(pend.subject)}”.</b>
        ${pend.resetAt ? `The daily limit of 100 emails ran out. You can send more after ${esc(new Date(pend.resetAt).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }))}.` : "They haven't been sent yet."}
        <span class="row-actions"><button class="btn small primary" data-eg="rest"${v.busy ? " disabled" : ""}>Send the rest</button><button class="btn small" data-eg="drop-rest"${v.busy ? " disabled" : ""}>Forget them</button></span></div>` : ""}
      <div class="eg-cols">
        <div class="eg-who">
          <h3 class="sec">Who gets it</h3>
          ${v.presetLabel ? `<p class="hint">Started from Student accounts: ${esc(v.presetLabel)}.</p>` : ""}
          ${groupList().map(s => `<fieldset class="eg-sec"><legend>${esc(s.sec)}</legend>${s.hint ? `<span class="hint">${esc(s.hint)}</span>` : ""}
            ${s.items.map(g => `<label class="chk eg-g"><input type="checkbox" data-eg-group="${esc(g.key)}"${v.groups.has(g.key) ? " checked" : ""}> <span>${esc(g.label)}</span> <span class="eg-n">${g.n}</span></label>`).join("")}</fieldset>`).join("")}
          <h3 class="sec">People <span class="eg-n">${ok.length} will get it</span></h3>
          <input type="search" id="eg-q" class="eg-q" placeholder="Search everyone to add someone" value="${esc(v.q)}" aria-label="Search members" autocomplete="off">
          <p class="hint">${words.length ? "Tick anyone to add them." : ch.length ? "Everyone in the ticked groups. Untick anyone to leave them out." : "Tick a group above, or search to add people one at a time."}</p>
          <ul class="eg-people">${shown.slice(0, 300).map(p => {
            const why = p.opted_out ? "Opted out" : !p.email_confirmed ? "Email not confirmed" : "";
            return `<li><label class="chk${why ? " eg-off" : ""}"><input type="checkbox" data-eg-person="${esc(p.id)}"${picked(p) && !why ? " checked" : ""}${why ? " disabled" : ""}>
              <span><b>${esc(p.full_name || p.email)}</b> <span class="meta">${esc(p.full_name ? p.email : "")}</span></span>
              ${p.role !== "student" ? `<span class="sa-badge lvl">${esc((C().ROLE_NAMES || {})[p.role] || p.role)}</span>` : ""}${why ? `<span class="sa-badge wait">${why}</span>` : ""}</label></li>`;
          }).join("") || `<li class="hint">${words.length ? "No one matches." : "No one picked yet."}</li>`}</ul>
          ${left ? `<p class="hint">${left} picked ${left === 1 ? "person is" : "people are"} left out: opted out of email, or hasn't confirmed their email address yet.</p>` : ""}
        </div>
        <form class="eg-write" id="eg-form" novalidate>
          <h3 class="sec">Message</h3>
          <p class="hint ld-from">From <b>Jamie at Limitless Diving</b> &lt;jamie@limitless-diving.com&gt;. Replies go to jamie@limitless-diving.com.</p>
          <div class="field"><label for="eg-subject">Subject</label><input id="eg-subject" maxlength="200" value="${esc(v.subject)}" placeholder="e.g. Exploration trip: Lake Hydra, June 14" required></div>
          <div class="field"><label for="eg-msg">Message</label><textarea id="eg-msg" rows="12" maxlength="20000" required placeholder="Hi {name},&#10;&#10;…">${esc(v.message)}</textarea></div>
          <p class="hint">Type <code>{name}</code> where you want each person's first name. Links like https://limitless-diving.com/classes.html become clickable.</p>
          <label class="chk"><input type="checkbox" id="eg-copy"${v.copy ? " checked" : ""}> Send me a copy (${esc((C().user && C().user.email) || "")})</label>
          <div class="eg-foot" aria-label="Added to the end of each email"><span class="lbl">Added at the bottom of each email</span>
            <p>You're getting this because you have a Limitless Diving account. Don't want emails about trips, new classes and news? <u>Unsubscribe</u>. You'll still get emails about your own classes and agreements.</p></div>
          ${v.progress ? `<p class="hint" role="status">${esc(v.progress)}</p>` : ""}
          ${v.note ? `<p class="acct-note ${v.noteKind}" role="${v.noteKind === "bad" ? "alert" : "status"}">${esc(v.note)}</p>` : ""}
          <div class="row-actions"><button class="btn primary" type="submit"${v.busy || !ok.length ? " disabled" : ""}>${v.busy ? "Sending…" : `Send to ${ok.length} ${ok.length === 1 ? "person" : "people"}`}</button></div>
          <p class="hint">Up to 100 emails a day (the email service's free plan). Bigger lists go out 50 at a time; if the day's limit runs out, the rest wait here for you to send later.</p>
        </form>
      </div></section>`;
  }
  function rerender() {
    if (!L() || !L().view || L().view().mode !== "emailgroups") return;
    const a = document.activeElement, id = a && a.id, pos = a && typeof a.selectionStart === "number" ? a.selectionStart : null;
    L().render();
    if (id) { const el = document.getElementById(id); if (el) { el.focus(); if (pos != null && el.setSelectionRange) try { el.setSelectionRange(pos, pos); } catch (e) { /* not a text box */ } } }
  }
  function setNote(t, k) { v.note = t || ""; v.noteKind = k || ""; }

  // ---------- sending ----------
  async function explain(err) {
    let j = null;
    try { if (err && err.context && typeof err.context.json === "function") j = await err.context.json(); } catch (x) { /* not JSON */ }
    if (j && j.error) return j.error;
    const name = String((err && err.name) || "");
    if (/FetchError/.test(name)) return "The site couldn't reach the send-email function in Supabase. Check it's deployed with the latest code and Verify JWT is off.";
    return C().explain ? C().explain(err) : String((err && err.message) || err);
  }
  async function send(ids, subject, message, copy, isRest) {
    v.busy = true; setNote(""); rerender();
    let sent = 0, skipped = 0, notSent = [], resetAt = "", fail = "";
    for (let i = 0; i < ids.length; i += CHUNK) {
      const part = ids.slice(i, i + CHUNK);
      v.progress = ids.length > CHUNK ? `Sending ${Math.min(i + CHUNK, ids.length)} of ${ids.length}…` : ""; rerender();
      let res, err;
      try { res = await C().client.functions.invoke("send-email", { body: { promo: true, ids: part, subject, message, copyMe: copy && i === 0 } }); err = res.error; }
      catch (x) { err = x; }
      if (err) { fail = await explain(err); notSent = notSent.concat(ids.slice(i)); break; }
      const d = res && res.data;
      if (!d || typeof d.sent !== "number" || !Array.isArray(d.notSent)) {
        fail = "The send-email function in Supabase is an older version that can't do group emails. Paste in the new code and deploy it (see the steps).";
        notSent = notSent.concat(ids.slice(i)); break;
      }
      sent += d.sent; skipped += d.skipped || 0;
      if (d.limit) { notSent = notSent.concat(d.notSent, ids.slice(i + CHUNK)); resetAt = d.resetAt || ""; break; }
    }
    v.busy = false; v.progress = "";
    // Keep who's still to go, unless nothing went at all because of an error (then the form still holds it).
    if (notSent.length && (sent > 0 || !fail || isRest)) savePending({ ids: notSent, subject, message, resetAt, savedAt: new Date().toISOString() });
    else if (!notSent.length && isRest) savePending(null);
    const bits = [];
    if (sent) bits.push(`Sent to ${sent} ${sent === 1 ? "person" : "people"}.`);
    if (skipped) bits.push(`${skipped} left out because they opted out or haven't confirmed their email.`);
    if (notSent.length && !fail) bits.push(`The daily limit ran out: ${notSent.length} still to go. Use “Send the rest” tomorrow.`);
    if (fail) bits.push((sent ? "Then it stopped: " : "Not sent. ") + fail + (sent && notSent.length ? ` ${notSent.length} still to go are saved here.` : ""));
    setNote(bits.join(" "), fail ? "bad" : notSent.length ? "" : "ok");
    if (sent && !notSent.length && !fail && !isRest) { v.subject = ""; v.message = ""; v.groups.clear(); v.added.clear(); v.removed.clear(); v.presetLabel = ""; }
    rerender();
    if (sent && L().toast) L().toast(`Sent to ${sent} ${sent === 1 ? "person" : "people"}`);
  }

  // ---------- events ----------
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.egGroup) { if (el.checked) v.groups.add(el.dataset.egGroup); else v.groups.delete(el.dataset.egGroup); v.removed.clear(); rerender(); return; }
    if (el.dataset.egPerson) {
      const p = (v.people || []).find(x => x.id === el.dataset.egPerson); if (!p) return;
      v.added.delete(p.id); v.removed.delete(p.id);
      const inGroups = [...v.groups].some(g => inGroup(p, g));
      if (el.checked && !inGroups) v.added.add(p.id);
      if (!el.checked && inGroups) v.removed.add(p.id);
      rerender(); return;
    }
    if (el.id === "eg-copy") v.copy = el.checked;
  });
  document.addEventListener("input", (e) => {
    const id = e.target.id;
    if (id === "eg-q") { v.q = e.target.value; rerender(); }
    else if (id === "eg-subject") v.subject = e.target.value;
    else if (id === "eg-msg") v.message = e.target.value;
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-eg]"); if (!b) return;
    e.preventDefault();
    switch (b.dataset.eg) {
      case "reload": v.people = null; v.error = ""; setNote(""); rerender(); break;
      case "rest": { const p = pending(); if (p && !v.busy) send(p.ids, p.subject, p.message, false, true); break; }
      case "drop-rest": savePending(null); setNote(""); rerender(); break;
    }
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id !== "eg-form") return;
    e.preventDefault();
    if (v.busy) return;
    const subject = v.subject.trim(), message = v.message.trim(), ids = sendable().map(p => p.id);
    if (!ids.length) { setNote("Pick at least one person who can get email.", "bad"); rerender(); return; }
    if (!subject) { setNote("Add a subject.", "bad"); rerender(); document.getElementById("eg-subject").focus(); return; }
    if (!message) { setNote("Write a message.", "bad"); rerender(); document.getElementById("eg-msg").focus(); return; }
    send(ids, subject, message, v.copy, false);
  });
  if (window.LDCloud && window.LDCloud.onChange) window.LDCloud.onChange(() => { v.people = null; v.error = ""; });

  // Records → Student accounts "Email this list": open here with those people picked.
  function preset(ids, label) {
    v.groups.clear(); v.removed.clear(); v.added = new Set(ids || []); v.presetLabel = label || ""; setNote("");
    if (L() && L().go) L().go("emailgroups");
  }

  window.LDEmailGroups = { render, preset };
})();
