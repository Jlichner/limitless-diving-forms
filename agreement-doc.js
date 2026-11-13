/* Limitless Diving — the learning agreement as a printable document. Used by Business → Scheduling
   (scheduling.js) and the Student portal (account.js), so both show exactly the same agreement.
   LDAgreementDoc.html(meta, text, signed)
     meta:   { business, contact, student_name, student_dob, event_type, event_title, dates, minor (true/false/null) }
     text:   the agreement wording. Lines starting "## " are headings, "- " bullet points, blank line = new paragraph.
     signed: optional { name, guardian, at } once the student has signed in the portal. */
(function () {
  "use strict";

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function textHtml(text) {
    const out = []; let list = null;
    const close = () => { if (list) { out.push("<ul>" + list.join("") + "</ul>"); list = null; } };
    const inline = (s) => esc(s).replace(/\[([a-z ]+)\]/g, '<span class="ph">[$1]</span>');
    String(text || "").split(/\r?\n/).forEach(line => {
      const t = line.trim();
      if (!t) { close(); return; }
      if (t.startsWith("## ")) { close(); out.push("<h3>" + inline(t.slice(3)) + "</h3>"); return; }
      if (/^[-•]\s+/.test(t)) { (list = list || []).push("<li>" + inline(t.replace(/^[-•]\s+/, "")) + "</li>"); return; }
      close(); out.push("<p>" + inline(t) + "</p>");
    });
    close();
    return out.join("");
  }

  function when(iso) {
    const d = new Date(iso); if (isNaN(d)) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function html(meta, text, signed) {
    const m = meta || {}, s = signed && signed.at ? signed : null;
    const sig = (who, name) => name
      ? `<div class="la-sig"><div class="la-line signed">${esc(name)}</div><div class="la-sl"><span>${esc(who)}</span><span>${esc(when(s.at))}</span></div>
          <div class="la-esig">Signed electronically in the Limitless Diving Student portal</div></div>`
      : `<div class="la-sig"><div class="la-line"></div><div class="la-sl"><span>${esc(who)}</span><span>Date</span></div></div>`;
    const showGuardian = m.minor !== false || (s && s.guardian);
    return `<article class="ladoc">
      <header class="la-h"><div><div class="la-b">${esc(m.business)}</div><div class="la-sub">${esc(m.contact)}</div></div>
        <div class="la-t">Learning Agreement</div></header>
      <div class="la-meta"><div><b>Student:</b> ${esc(m.student_name) || '<span class="ph">[student name]</span>'}${m.student_dob ? " · DOB " + esc(m.student_dob) : ""}</div>
        <div><b>${esc(m.event_type || "Event")}:</b> ${esc(m.event_title) || '<span class="ph">[event]</span>'}${m.dates ? " · " + esc(m.dates) : ""}</div></div>
      <div class="la-body">${textHtml(text)}</div>
      <h3>Signatures</h3>
      <p class="la-ack">By signing, I confirm that I have read this agreement, had my questions answered, and agree to its terms.</p>
      <div class="la-sigs">${sig("Student: " + (m.student_name || ""), s && s.name)}
        ${showGuardian ? sig("Parent or legal guardian" + (m.minor ? " (student is under 18)" : " (if the student is under 18)"), s && s.guardian) : ""}
        ${sig("Instructor: " + (m.instructor || ""), "")}</div>
    </article>`;
  }

  window.LDAgreementDoc = { html, textHtml, esc };
})();
