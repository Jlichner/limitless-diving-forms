/* Limitless Diving — invoices, built from the J Lichner Dive Invoice template.
   Invoices live in the same browser storage as the student records (state.invoices),
   so Export backup / Import carry them too. app.js exposes window.LD for shared helpers. */
(function () {
  "use strict";

  const DEFAULT_SETTINGS = {
    business: "J Lichner",
    subtitle: "Dive Training & Certification",
    prefix: "INV-",
    next: 1,
    terms: "Payment due upon receipt unless otherwise noted. Please make checks payable to J Lichner or contact for electronic payment options.",
    thanks: "Thank you for diving with J Lichner!",
    catalog: [
      { desc: "Intro to Tech Class Fees", amt: 400 },
      { desc: "TDI Elearning", amt: 65 },
      { desc: "TDI Certification Processing/Shipping", amt: 35 },
      { desc: "NAUI Certification Processing/Shipping", amt: 30 }
    ]
  };

  const v = { sel: null, settings: false, q: "" };
  const L = () => window.LD;
  const $ = (s, r) => (r || document).querySelector(s);

  // ---------- data ----------
  function data() {
    const st = L().state;
    if (!Array.isArray(st.invoices)) st.invoices = [];
    st.invoiceSettings = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), st.invoiceSettings || {});
    if (!Array.isArray(st.invoiceSettings.catalog)) st.invoiceSettings.catalog = [];
    return st;
  }
  const S = () => data().invoiceSettings;
  function cur() { return data().invoices.find(x => x.id === v.sel) || null; }
  function today() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function num(n) { const x = Number(n); return isFinite(x) ? x : 0; }
  function sum(rows) { return (rows || []).reduce((a, r) => a + num(r.amt), 0); }
  function totals(inv) { const sub = sum(inv.items), paid = sum(inv.payments); return { sub, paid, due: sub - paid }; }

  function nextNumber() {
    const s = S(), used = new Set(data().invoices.map(x => x.number));
    let n = Math.max(1, Math.floor(num(s.next)) || 1), out;
    do { out = (s.prefix || "") + String(n).padStart(4, "0"); n++; } while (used.has(out));
    s.next = n;
    return out;
  }
  function blank() {
    return {
      id: "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      number: nextNumber(), date: today(), due: "", paid: false, studentId: "",
      billName: "", billAddr: "", billContact: "",
      items: [{ desc: "", amt: "" }], payments: [], note: ""
    };
  }
  function fillFromStudent(inv, s) {
    inv.studentId = s.id;
    inv.billName = s.name || "";
    inv.billContact = [s.email, s.phone].filter(Boolean).join(" / ");
    const b = L().billing(s);
    inv.items = b.items.length ? b.items : [{ desc: "", amt: "" }];
    inv.payments = b.payments;
  }

  // ---------- render ----------
  function render() {
    const st = data();
    if (v.sel && !cur()) v.sel = null;
    if (!v.sel && !v.settings && st.invoices.length) v.sel = sortedList()[0].id;
    return `<aside class="roster no-print">${renderList()}</aside>
      <section class="panel" id="inv-panel">${v.settings ? renderSettings() : renderEditor()}</section>`;
  }
  function sortedList() {
    return data().invoices.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.number || "").localeCompare(a.number || ""));
  }
  function renderList() {
    const { esc, money, fmtDate } = L(), q = v.q.trim().toLowerCase();
    const students = L().state.students.filter(s => s.name).slice().sort((a, b) => a.name.localeCompare(b.name));
    const list = sortedList().filter(x => !q || (x.billName || "").toLowerCase().includes(q) || (x.number || "").toLowerCase().includes(q));
    return `<button class="btn primary" data-iact="new">+ New invoice</button>
      ${students.length ? `<select id="inv-new-for" aria-label="New invoice for a student"><option value="">+ New invoice for a student…</option>${students.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>` : ""}
      <input type="search" id="inv-q" placeholder="Search invoices" value="${esc(v.q)}" aria-label="Search invoices">
      <ul>${list.map(x => {
        const t = totals(x);
        return `<li><button data-iact="pick" data-id="${x.id}" class="${x.id === v.sel && !v.settings ? "sel" : ""}">
          <span class="nm">${esc(x.billName || "No client yet")}</span>
          <span class="meta">${esc(x.number)} · ${esc(fmtDate(x.date))} · ${money(t.due)}</span>
          <span class="inv-status ${x.paid ? "paid" : ""}">${x.paid ? "Paid" : "Unpaid"}</span></button></li>`;
      }).join("") || `<li class="meta" style="padding:8px 10px">${data().invoices.length ? "No matches." : "No invoices yet."}</li>`}</ul>
      <button class="btn ${v.settings ? "active" : ""}" data-iact="settings">Invoice settings</button>`;
  }

  function f(path, label, type, cls) {
    const inv = cur(), val = path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), inv);
    const id = "inv-f-" + path.replace(/\./g, "-");
    if (type === "area") return `<div class="field ${cls || ""}"><label for="${id}">${L().esc(label)}</label><textarea id="${id}" data-iv="${path}" rows="2">${L().esc(val)}</textarea></div>`;
    return `<div class="field ${cls || ""}"><label for="${id}">${L().esc(label)}</label><input id="${id}" type="${type || "text"}" data-iv="${path}" value="${L().esc(val)}"></div>`;
  }
  function rowCell(path, type, ph, cls) {
    const inv = cur(), val = path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), inv);
    return `<td class="${cls || ""}"><input id="inv-c-${path.replace(/\./g, "-")}" type="${type}" ${type === "number" ? 'step="0.01" inputmode="decimal"' : ""} data-iv="${path}" value="${L().esc(val)}" placeholder="${ph}" aria-label="${ph}"></td>`;
  }

  function renderEditor() {
    const inv = cur(), { esc, money } = L();
    if (!inv) {
      return `<div class="empty"><h2>Make an invoice</h2>
        <p>Start a blank invoice, or pick a student to fill in their name, contact, course fee, extra charges and payments from their record.
        Every field stays editable, and you can print it or save it as a PDF.</p>
        <button class="btn primary" data-iact="new">+ New invoice</button></div>`;
    }
    const t = totals(inv), cat = S().catalog.filter(c => c.desc);
    const students = L().state.students.filter(s => s.name).slice().sort((a, b) => a.name.localeCompare(b.name));
    return `<div class="no-print">
      <div class="rec-head"><h1 id="inv-title">Invoice ${esc(inv.number)}</h1>
        <div class="stats"><div class="stat"><b class="money" id="inv-st-due">${money(t.due)}</b><span>Total due</span></div></div></div>
      <div class="doc-actions"><button class="btn primary" data-iact="print">Print / save as PDF</button>
        <button class="btn" data-iact="dup">Duplicate</button>
        <button class="btn danger" data-iact="del">Delete…</button><span id="inv-del-confirm"></span></div>

      <h2 class="sec">Invoice</h2><div class="grid">
        ${f("number", "Invoice #")}${f("date", "Date", "date")}${f("due", "Due date (blank = upon receipt)", "date")}
        <div class="field"><span class="lbl">Status</span><label class="chk"><input type="checkbox" data-iv="paid"${inv.paid ? " checked" : ""}> Paid in full</label></div></div>

      <h2 class="sec">Bill to</h2>
      ${students.length ? `<div class="inv-fill"><label for="inv-student">Fill from student</label>
        <select id="inv-student"><option value="">Choose a student…</option>${students.map(s => `<option value="${s.id}"${s.id === inv.studentId ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
        <span class="hint" style="margin:0">Replaces the client, line items and payments with what's on their record.</span></div>` : ""}
      <div class="grid">${f("billName", "Client name")}${f("billContact", "Client email / phone")}${f("billAddr", "Client address", "area", "wide")}</div>

      <h2 class="sec">Line items</h2>
      <div class="tablewrap"><table class="m"><thead><tr><th>Description</th><th>Amount ($)</th><th></th></tr></thead><tbody>
        ${inv.items.map((_, i) => `<tr>${rowCell("items." + i + ".desc", "text", "Description")}${rowCell("items." + i + ".amt", "number", "0.00", "amt")}
          <td class="x"><button class="btn small danger" data-iact="rm-item" data-i="${i}">Remove</button></td></tr>`).join("")}
      </tbody></table></div>
      <div class="row-actions"><button class="btn" data-iact="add-item">+ Add line</button>
        ${cat.length ? `<select id="inv-cat" aria-label="Add a saved item"><option value="">+ Add a saved item…</option>${cat.map((c, i) => `<option value="${i}">${esc(c.desc)} — ${money(c.amt)}</option>`).join("")}</select>` : ""}</div>

      <h2 class="sec">Payments received</h2>
      <p class="hint">Shown on the invoice under the subtotal. Leave empty to show only the total due, like the original template.</p>
      ${inv.payments.length ? `<div class="tablewrap"><table class="m"><thead><tr><th>Description</th><th>Amount ($)</th><th></th></tr></thead><tbody>
        ${inv.payments.map((_, i) => `<tr>${rowCell("payments." + i + ".desc", "text", "e.g. Deposit received")}${rowCell("payments." + i + ".amt", "number", "0.00", "amt")}
          <td class="x"><button class="btn small danger" data-iact="rm-pay" data-i="${i}">Remove</button></td></tr>`).join("")}
      </tbody></table></div>` : ""}
      <div class="row-actions"><button class="btn" data-iact="add-pay">+ Add payment</button></div>

      <h2 class="sec">Note</h2><div class="grid">${f("note", "Note on this invoice (optional)", "area", "wide")}</div>
      <h2 class="sec">Preview</h2></div>
      <div id="inv-doc">${docHtml(inv)}</div>`;
  }

  function docHtml(inv) {
    const { esc, money, fmtDate } = L(), s = S(), t = totals(inv);
    const items = inv.items.filter(r => r.desc || r.amt !== "");
    const pays = inv.payments.filter(r => r.desc || r.amt !== "");
    const ph = (val, label) => val ? esc(val) : `<span class="ph">[${label}]</span>`;
    return `<article class="invdoc">
      <header class="ih"><div><div class="ib">${esc(s.business)}</div><div class="isub">${esc(s.subtitle)}</div></div><div class="it">INVOICE</div></header>
      <div class="imeta">
        <div><div class="ilbl">Bill to</div>
          <div class="iname">${ph(inv.billName, "Client Name")}</div>
          <div class="iaddr">${ph(inv.billAddr, "Client Address")}</div>
          <div class="iaddr">${ph(inv.billContact, "Client Email / Phone")}</div></div>
        <div class="ir"><div><b>Invoice #:</b> ${ph(inv.number, "INV-0001")}</div>
          <div><b>Date:</b> ${ph(inv.date ? fmtLong(inv.date) : "", "Date")}</div>
          <div><b>Due Date:</b> ${inv.due ? esc(fmtLong(inv.due)) : "Upon receipt"}</div></div>
      </div>
      <table class="itab"><thead><tr><th>Description</th><th class="r">Amount</th></tr></thead><tbody>
        ${items.map(r => `<tr><td>${esc(r.desc)}</td><td class="r">${money(r.amt)}</td></tr>`).join("") || `<tr><td>&nbsp;</td><td></td></tr>`}
        ${pays.length ? `<tr class="sub"><td class="r">Subtotal</td><td class="r">${money(t.sub)}</td></tr>
          ${pays.map(r => `<tr class="pay"><td class="r">${esc(r.desc || "Payment received")}</td><td class="r">−${money(r.amt)}</td></tr>`).join("")}` : ""}
        <tr class="tot"><td class="r">TOTAL DUE</td><td class="r">${money(t.due)}</td></tr>
      </tbody></table>
      ${inv.paid ? `<div class="istamp">Paid in full — thank you</div>` : ""}
      ${inv.note ? `<p class="inote">${esc(inv.note)}</p>` : ""}
      <div class="iterms"><div class="ilbl2">Payment Terms</div><p>${esc(s.terms)}</p></div>
      <p class="ithanks">${esc(s.thanks)}</p>
    </article>`;
  }
  function fmtLong(d) {
    const t = new Date(d + "T12:00:00"); if (isNaN(t)) return d;
    return t.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  function renderSettings() {
    const s = S(), { esc } = L();
    const sf = (k, label, type, cls) => type === "area"
      ? `<div class="field wide"><label for="inv-s-${k}">${label}</label><textarea id="inv-s-${k}" data-isv="${k}">${esc(s[k])}</textarea></div>`
      : `<div class="field ${cls || ""}"><label for="inv-s-${k}">${label}</label><input id="inv-s-${k}" type="${type || "text"}" data-isv="${k}" value="${esc(s[k])}"></div>`;
    return `<div class="rec-head"><h1>Invoice settings</h1></div>
      <p class="hint">These appear on every invoice.</p>
      <h2 class="sec">Header</h2><div class="grid">${sf("business", "Business name")}${sf("subtitle", "Subtitle")}</div>
      <h2 class="sec">Numbering</h2><div class="grid">${sf("prefix", "Prefix")}${sf("next", "Next number", "number")}</div>
      <h2 class="sec">Footer</h2><div class="grid">${sf("terms", "Payment terms", "area")}${sf("thanks", "Thank-you line", "text", "wide")}</div>
      <h2 class="sec">Saved items</h2>
      <p class="hint">Charges you bill often. Add them to any invoice from the "Add a saved item" menu.</p>
      <div class="tablewrap"><table class="m"><thead><tr><th>Description</th><th>Amount ($)</th><th></th></tr></thead><tbody>
        ${s.catalog.map((c, i) => `<tr><td><input id="inv-cat-${i}-desc" data-isv="catalog.${i}.desc" value="${esc(c.desc)}" aria-label="Description"></td>
          <td class="amt"><input id="inv-cat-${i}-amt" type="number" step="0.01" data-isv="catalog.${i}.amt" value="${esc(c.amt)}" aria-label="Amount"></td>
          <td class="x"><button class="btn small danger" data-iact="rm-cat" data-i="${i}">Remove</button></td></tr>`).join("")}
      </tbody></table></div>
      <div class="row-actions"><button class="btn" data-iact="add-cat">+ Add saved item</button></div>`;
  }

  // ---------- updates ----------
  function rerender() { L().render(); }
  function refresh() {
    const inv = cur(); if (!inv) return;
    const d = $("#inv-doc"); if (d) d.innerHTML = docHtml(inv);
    const t = $("#inv-st-due"); if (t) t.textContent = L().money(totals(inv).due);
    const h = $("#inv-title"); if (h) h.textContent = "Invoice " + inv.number;
    refreshList();
  }
  function refreshList() {
    const r = $(".roster"); if (!r) return;
    const q = $("#inv-q"), had = document.activeElement === q;
    r.innerHTML = renderList();
    if (had) { const nq = $("#inv-q"); nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); }
  }
  function setPath(obj, path, val) {
    const ks = path.split("."); let o = obj;
    for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
    o[ks[ks.length - 1]] = val;
  }

  document.addEventListener("input", (e) => {
    const el = e.target;
    if (el.id === "inv-q") { v.q = el.value; refreshList(); return; }
    if (!el.dataset) return;
    const path = el.dataset.iv || el.dataset.isv; if (!path) return;
    let val = el.type === "checkbox" ? el.checked : el.value;
    if (el.type === "number") val = el.value === "" ? "" : Number(el.value);
    if (el.dataset.iv) { const inv = cur(); if (!inv) return; setPath(inv, path, val); refresh(); }
    else setPath(S(), path, val);
    L().save();
  });

  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.id === "inv-new-for" && el.value) {
      const s = L().state.students.find(x => x.id === el.value); if (!s) return;
      const inv = blank(); fillFromStudent(inv, s);
      data().invoices.push(inv); v.sel = inv.id; v.settings = false; L().save(); rerender();
      L().toast("Invoice filled in from " + (s.name || "student"));
    } else if (el.id === "inv-student" && el.value) {
      const inv = cur(), s = L().state.students.find(x => x.id === el.value); if (!inv || !s) return;
      fillFromStudent(inv, s); L().save(); rerender();
      L().toast("Filled in from " + (s.name || "student"));
    } else if (el.id === "inv-cat" && el.value !== "") {
      const inv = cur(), c = S().catalog.filter(x => x.desc)[Number(el.value)]; if (!inv || !c) return;
      const empty = inv.items.findIndex(r => !r.desc && (r.amt === "" || r.amt == null));
      const row = { desc: c.desc, amt: num(c.amt) };
      if (empty >= 0) inv.items[empty] = row; else inv.items.push(row);
      L().save(); rerender();
    }
  });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-iact]"); if (!b) return;
    const inv = cur(), i = Number(b.dataset.i);
    switch (b.dataset.iact) {
      case "new": { const n = blank(); data().invoices.push(n); v.sel = n.id; v.settings = false; L().save(); rerender(); const x = $("#inv-f-billName"); if (x) x.focus(); break; }
      case "pick": v.sel = b.dataset.id; v.settings = false; rerender(); break;
      case "settings": v.settings = !v.settings; rerender(); break;
      case "print": window.print(); break;
      case "dup": { const n = JSON.parse(JSON.stringify(inv)); const fresh = blank(); n.id = fresh.id; n.number = fresh.number; n.date = today(); n.due = ""; n.paid = false; data().invoices.push(n); v.sel = n.id; L().save(); rerender(); L().toast("Copied to " + n.number); break; }
      case "del": $("#inv-del-confirm").innerHTML = `Delete invoice ${L().esc(inv.number)} for good? <button class="btn small danger" data-iact="del-yes">Delete</button> <button class="btn small" data-iact="pick" data-id="${inv.id}">Keep</button>`; break;
      case "del-yes": data().invoices = data().invoices.filter(x => x.id !== inv.id); v.sel = null; L().save(); rerender(); L().toast("Invoice deleted"); break;
      case "add-item": inv.items.push({ desc: "", amt: "" }); L().save(); rerender(); break;
      case "rm-item": inv.items.splice(i, 1); L().save(); rerender(); break;
      case "add-pay": inv.payments.push({ desc: "", amt: "" }); L().save(); rerender(); break;
      case "rm-pay": inv.payments.splice(i, 1); L().save(); rerender(); break;
      case "add-cat": S().catalog.push({ desc: "", amt: "" }); L().save(); rerender(); break;
      case "rm-cat": S().catalog.splice(i, 1); L().save(); rerender(); break;
    }
  });

  window.LDInvoices = { render };
})();
