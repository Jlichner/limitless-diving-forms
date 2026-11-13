/* Limitless Diving — write and send an email to students from the site (Instructors and Admins).
   LDEmail.open({ to: [{ name, email }], subject, about }) shows the compose box. Sending goes through the
   Supabase Edge Function "send-email" (supabase/functions/send-email), which checks the sender's level and
   sends each person their own copy through Resend, so nobody sees the other addresses. Replies go to
   jamie@limitless-diving.com. Load after cloud.js. */
(function () {
  "use strict";

  const MAX = 50;   // the function accepts up to 50 people per send
  const C = () => window.LDCloud || {};
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;
  const st = { to: [], about: "", busy: false, note: "", kind: "" };

  function canSend() { return !!(C().available && C().user && C().can && C().can("instructor")); }

  function dlg() {
    let d = document.getElementById("ld-email");
    if (!d) {
      d = document.createElement("dialog");
      d.id = "ld-email"; d.className = "ld-email"; d.setAttribute("aria-labelledby", "ld-email-title");
      document.body.appendChild(d);
      d.addEventListener("click", onClick);
      d.addEventListener("submit", onSubmit);
      d.addEventListener("cancel", (e) => { if (st.busy) e.preventDefault(); });
    }
    return d;
  }

  function chips() {
    return st.to.map((r, i) => `<li class="ld-chip"><span>${esc(r.name ? r.name + " · " + r.email : r.email)}</span>
      <button type="button" class="ld-chip-x" data-em="rm" data-i="${i}" aria-label="Remove ${esc(r.name || r.email)}">✕</button></li>`).join("");
  }
  function mailtoHref() {
    const s = (document.getElementById("ld-em-subject") || {}).value || "", m = (document.getElementById("ld-em-msg") || {}).value || "";
    return "mailto:?bcc=" + encodeURIComponent(st.to.map(r => r.email).join(",")) + "&subject=" + encodeURIComponent(s) + "&body=" + encodeURIComponent(m);
  }
  function drawChips() {
    const ul = document.getElementById("ld-em-to"); if (ul) ul.innerHTML = chips();
    const n = document.getElementById("ld-em-count"); if (n) n.textContent = countText();
  }
  function countText() {
    const n = st.to.length;
    return n > MAX ? `${n} people: that's over the ${MAX} limit for one send. Remove some, or send in two goes.`
      : n ? `${n} ${n === 1 ? "person" : "people"}. Each gets their own copy, so nobody sees the other addresses.` : "No one yet. Add an email address below.";
  }
  function setNote(t, k) {
    st.note = t || ""; st.kind = k || "";
    const el = document.getElementById("ld-em-note");
    if (el) { el.className = "acct-note " + st.kind; el.textContent = st.note; el.hidden = !st.note; }
  }

  function open(opts) {
    opts = opts || {};
    const seen = new Set();
    st.to = (opts.to || []).filter(r => r && EMAIL_RE.test(String(r.email || "").trim()))
      .map(r => ({ name: String(r.name || "").trim(), email: String(r.email).trim() }))
      .filter(r => !seen.has(r.email.toLowerCase()) && seen.add(r.email.toLowerCase()));
    st.about = opts.about || ""; st.busy = false;
    const d = dlg();
    const me = (C().user && C().user.email) || "";
    if (!canSend()) {
      d.innerHTML = `<form method="dialog" class="ld-email-in"><h2 id="ld-email-title">Email</h2>
        <p class="hint">Sending from the site is for Instructors and Admins. Sign in with <b>Admin Log in</b> first, or use your own email app.</p>
        <div class="row-actions"><a class="btn" href="mailto:${esc(st.to.map(r => r.email).join(","))}">Open my email app</a><button class="btn primary">Close</button></div></form>`;
      d.showModal(); return;
    }
    d.innerHTML = `<form class="ld-email-in" id="ld-em-form" novalidate>
      <div class="ld-email-head"><h2 id="ld-email-title">Email ${st.about ? esc(st.about) : st.to.length === 1 ? esc(st.to[0].name || st.to[0].email) : "students"}</h2>
        <button type="button" class="btn small" data-em="close" aria-label="Close">✕</button></div>
      <p class="hint ld-from">From <b>Jamie at Limitless Diving</b> &lt;jamie@limitless-diving.com&gt;. Replies go to jamie@limitless-diving.com.</p>
      <div class="field"><span class="lbl">To</span><ul class="ld-chips" id="ld-em-to">${chips()}</ul>
        <span class="hint" id="ld-em-count" style="margin:0">${countText()}</span>
        <span class="ld-add"><label class="sr-only" for="ld-em-add">Add an email address</label><input id="ld-em-add" type="email" placeholder="Add an email address" autocomplete="off">
          <button type="button" class="btn small" data-em="add">Add</button></span></div>
      <div class="field"><label for="ld-em-subject">Subject</label><input id="ld-em-subject" maxlength="200" value="${esc(opts.subject || "")}" required></div>
      <div class="field"><label for="ld-em-msg">Message</label><textarea id="ld-em-msg" rows="10" maxlength="20000" required>${esc(opts.message || "")}</textarea></div>
      ${me ? `<label class="chk"><input type="checkbox" id="ld-em-copy" checked> Send me a copy (${esc(me)})</label>` : ""}
      <p id="ld-em-note" class="acct-note" role="status" hidden></p>
      <div class="row-actions"><button class="btn primary" id="ld-em-send" type="submit">Send</button>
        <button type="button" class="btn" data-em="close">Cancel</button>
        <a class="ld-alt" href="#" data-em="mailto">Use my email app instead</a></div></form>`;
    d.showModal();
    const first = document.getElementById(st.to.length ? "ld-em-subject" : "ld-em-add");
    if (first) first.focus();
  }

  function close() { const d = document.getElementById("ld-email"); if (d && d.open && !st.busy) d.close(); }

  function addTyped() {
    const inp = document.getElementById("ld-em-add"); if (!inp) return;
    const parts = inp.value.split(/[\s,;]+/).filter(Boolean);
    const bad = parts.filter(p => !EMAIL_RE.test(p));
    parts.filter(p => EMAIL_RE.test(p)).forEach(p => { if (!st.to.some(r => r.email.toLowerCase() === p.toLowerCase())) st.to.push({ name: "", email: p }); });
    inp.value = bad.join(", ");
    drawChips();
    setNote(bad.length ? "That doesn't look like an email address: " + bad.join(", ") : "", bad.length ? "bad" : "");
  }

  function onClick(e) {
    const b = e.target.closest("[data-em]"); if (!b) return;
    switch (b.dataset.em) {
      case "close": e.preventDefault(); close(); break;
      case "rm": st.to.splice(+b.dataset.i, 1); drawChips(); break;
      case "add": addTyped(); break;
      case "mailto": e.preventDefault(); location.href = mailtoHref(); break;
    }
  }

  async function onSubmit(e) {
    if (e.target.id !== "ld-em-form") return;
    e.preventDefault();
    if (st.busy) return;
    if ((document.getElementById("ld-em-add") || {}).value) addTyped();
    const subject = document.getElementById("ld-em-subject").value.trim(), message = document.getElementById("ld-em-msg").value.trim();
    const copy = document.getElementById("ld-em-copy");
    if (!st.to.length) { setNote("Add at least one email address.", "bad"); return; }
    if (st.to.length > MAX) { setNote(countText(), "bad"); return; }
    if (!subject) { setNote("Add a subject.", "bad"); document.getElementById("ld-em-subject").focus(); return; }
    if (!message) { setNote("Write a message.", "bad"); document.getElementById("ld-em-msg").focus(); return; }
    const btn = document.getElementById("ld-em-send");
    st.busy = true; btn.disabled = true; btn.textContent = "Sending…"; setNote("");
    let res, err;
    try {
      res = await C().client.functions.invoke("send-email", { body: { to: st.to.map(r => r.email), subject, message, copyMe: !!(copy && copy.checked) } });
      err = res.error;
    } catch (x) { err = x; }
    st.busy = false; btn.disabled = false; btn.textContent = "Send";
    if (err) { setNote(await explain(err), "bad"); return; }
    // Only our send-email code answers with { sent: <number> }. Anything else (Supabase's sample code,
    // for example) means nothing was sent, so don't say it was.
    const data = res && res.data;
    if (!data || typeof data !== "object" || typeof data.sent !== "number") {
      setNote("Not sent. Something answered at send-email, but it isn't the Limitless Diving code. In Supabase, open Edge Functions → send-email → Code, replace everything with the code from the README link, and deploy.", "bad");
      return;
    }
    const n = data.sent;
    close();
    const msg = `Sent to ${n} ${n === 1 ? "person" : "people"}. Replies go to jamie@limitless-diving.com.`;
    if (window.LD && window.LD.toast) window.LD.toast(msg); else alert(msg);
  }

  // A plain-language reason the email didn't go. supabase-js gives three kinds of error:
  //   FunctionsFetchError  the browser couldn't reach the function at all (wrong name, not deployed,
  //                        "Verify JWT" still on, or no internet). The browser hides which one.
  //   FunctionsRelayError  Supabase reached the function but it didn't start (a problem in the pasted code).
  //   FunctionsHttpError   the function answered with an error; ours always says why in { error }.
  async function explain(err) {
    const name = String((err && err.name) || ""), m = String((err && err.message) || err || "");
    let status = 0, j = null;
    try { if (err && err.context) { status = err.context.status || 0; if (typeof err.context.json === "function") j = await err.context.json(); } } catch (x) { /* not JSON */ }
    if (j && j.error) return "Not sent. " + j.error;
    if (/FetchError/.test(name) || /failed to send a request/i.test(m))
      return "Not sent. The site couldn't reach the send-email function in Supabase. Check that it's named exactly send-email, that it's deployed, and that Verify JWT is switched off for it. (Or check your internet connection.)";
    if (/RelayError/.test(name) || /relay/i.test(m))
      return "Not sent. Supabase found the send-email function but it didn't start. Open it in Supabase, paste the code again from the README link, and deploy.";
    if (status === 404 || (j && /not.?found/i.test(String(j.code || j.message || ""))))
      return "Not sent. Supabase has no function called send-email. Check the function's name in Supabase → Edge Functions.";
    if (status === 401 && j && j.message) return "Not sent. Supabase said: " + j.message + ". Switch off Verify JWT for send-email.";
    if (status) return "Not sent. The send-email function answered with error " + status + (j && (j.message || j.msg) ? ": " + (j.message || j.msg) : "") + ".";
    return "Not sent. " + (C().explain ? C().explain(err) : m);
  }

  // Any button with data-email-to="a@b.com" (and optional data-email-name) opens the compose box.
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-email-to]"); if (!b) return;
    e.preventDefault();
    open({ to: [{ email: b.dataset.emailTo, name: b.dataset.emailName || "" }] });
  });

  window.LDEmail = { open, canSend };
})();
