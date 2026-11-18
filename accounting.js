/* Limitless Diving — Business → Accounting: a yearly record of money in and out, to speed up taxes.
   Income comes in two ways: invoices (read from state.invoices, never copied) and income entered here
   (cash, tours, gear sales, anything not invoiced). Expenses use the IRS Schedule C lines, and a mileage log
   turns business miles into a deduction at that year's standard rate.
   Everything lives in state.accounting, in the same browser storage as invoices, so Export backup carries it. */
(function () {
  "use strict";

  // Schedule C (Form 1040) lines. "pct" is the share that counts (business meals are 50%).
  const EXPENSE_CATS = [
    { id: "advertising", label: "Advertising and marketing", line: "8" },
    { id: "car", label: "Car and truck (actual costs, not mileage)", line: "9" },
    { id: "fees", label: "Commissions and fees (card/PayPal fees)", line: "10" },
    { id: "contract", label: "Contract labor (assistants, Dive Masters)", line: "11" },
    { id: "equipment", label: "Gear and equipment bought (depreciation / Sec. 179)", line: "13" },
    { id: "insurance", label: "Insurance (liability, not health)", line: "15" },
    { id: "legal", label: "Legal and professional (tax prep)", line: "17" },
    { id: "office", label: "Office expense", line: "18" },
    { id: "rent", label: "Rent: pool, boat, site or equipment", line: "20b" },
    { id: "repairs", label: "Repairs and gear servicing", line: "21" },
    { id: "supplies", label: "Supplies and training materials", line: "22" },
    { id: "taxes", label: "Taxes and licenses", line: "23" },
    { id: "travel", label: "Travel (lodging, airfare)", line: "24a" },
    { id: "meals", label: "Business meals (50% counts)", line: "24b", pct: 0.5 },
    { id: "utilities", label: "Phone and internet (business share)", line: "25" },
    { id: "agency", label: "Agency fees: certifications, eLearning", line: "27a" },
    { id: "dues", label: "Agency dues and memberships (NAUI, TDI)", line: "27a" },
    { id: "gas", label: "Air, nitrox and helium fills", line: "27a" },
    { id: "software", label: "Website, email and software", line: "27a" },
    { id: "education", label: "Your own training and education", line: "27a" },
    { id: "other", label: "Other expenses", line: "27a" }
  ];
  const INCOME_CATS = [
    { id: "class", label: "Class fees" },
    { id: "agency", label: "Agency fees collected (eLearning, cert processing)" },
    { id: "coaching", label: "Coaching sessions" },
    { id: "tours", label: "Tours and guided dives" },
    { id: "sales", label: "Gear and merchandise sales" },
    { id: "other", label: "Other income" }
  ];
  const METHODS = ["", "Cash", "Check", "Card", "Venmo", "PayPal", "Zelle", "Bank transfer", "Other"];
  // The IRS business standard mileage rate per mile. Check irs.gov each January and set it on the Mileage tab.
  const RATES = { 2024: 0.67, 2025: 0.70 };
  const DEFAULT_RATE = 0.70;

  const v = { year: new Date().getFullYear(), tab: "summary" };
  const L = () => window.LD;
  const $ = (s, r) => (r || document).querySelector(s);

  // ---------- data ----------
  function data() {
    const st = L().state;
    const a = st.accounting = st.accounting || {};
    ["income", "expenses", "miles"].forEach(k => { if (!Array.isArray(a[k])) a[k] = []; });
    if (!a.rates || typeof a.rates !== "object") a.rates = {};
    return a;
  }
  // A loss shows as −$28.80 rather than $-28.80.
  function signed(n) { return n < 0 ? "−" + L().money(-n) : L().money(n); }
  function num(n) { const x = Number(n); return isFinite(x) ? x : 0; }
  function today() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function newId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  const inYear = (d) => String(d || "").slice(0, 4) === String(v.year);
  const byDate = (a, b) => (a.date || "").localeCompare(b.date || "");
  function rate(y) {
    const r = data().rates[y];
    return r !== undefined && r !== "" ? num(r) : (RATES[y] !== undefined ? RATES[y] : DEFAULT_RATE);
  }
  function expCat(id) { return EXPENSE_CATS.find(c => c.id === id) || EXPENSE_CATS[EXPENSE_CATS.length - 1]; }
  function incCat(id) { return INCOME_CATS.find(c => c.id === id) || INCOME_CATS[INCOME_CATS.length - 1]; }

  // Money received on an invoice: the whole subtotal once it's marked paid, otherwise the payments listed on it.
  // It's counted in the year of the invoice date.
  function invoiceIncome() {
    return (L().state.invoices || []).filter(x => inYear(x.date)).map(x => {
      const sub = (x.items || []).reduce((a, r) => a + num(r.amt), 0);
      const paid = (x.payments || []).reduce((a, r) => a + num(r.amt), 0);
      return { id: x.id, date: x.date, number: x.number, who: x.billName || "", received: x.paid ? sub : Math.min(paid, sub || paid), billed: sub, paid: !!x.paid };
    }).sort(byDate);
  }

  function yearTotals() {
    const a = data(), inv = invoiceIncome();
    const income = a.income.filter(r => inYear(r.date)), exp = a.expenses.filter(r => inYear(r.date)), miles = a.miles.filter(r => inYear(r.date));
    const invTotal = inv.reduce((s, r) => s + r.received, 0);
    const incByCat = {}; income.forEach(r => { const c = incCat(r.category).id; incByCat[c] = (incByCat[c] || 0) + num(r.amount); });
    const otherIncome = income.reduce((s, r) => s + num(r.amount), 0);
    const expByCat = {}; exp.forEach(r => { const c = expCat(r.category).id; expByCat[c] = (expByCat[c] || 0) + num(r.amount); });
    const expPaid = exp.reduce((s, r) => s + num(r.amount), 0);
    const expDeductible = EXPENSE_CATS.reduce((s, c) => s + (expByCat[c.id] || 0) * (c.pct || 1), 0);
    const mi = miles.reduce((s, r) => s + num(r.miles), 0), mileage = Math.round(mi * rate(v.year) * 100) / 100;
    const gross = invTotal + otherIncome;
    return { inv, income, exp, miles, invTotal, otherIncome, incByCat, expByCat, expPaid, expDeductible, mi, mileage, gross,
      unpaid: inv.filter(r => !r.paid).reduce((s, r) => s + Math.max(0, r.billed - r.received), 0),
      net: gross - expDeductible - mileage };
  }

  // ---------- render ----------
  function years() {
    const a = data(), ys = new Set([new Date().getFullYear(), v.year]);
    [a.income, a.expenses, a.miles, L().state.invoices || []].forEach(list => list.forEach(r => { const y = parseInt(String(r.date || "").slice(0, 4), 10); if (y > 1990 && y < 2200) ys.add(y); }));
    return [...ys].sort((x, y) => y - x);
  }
  function render() {
    const { money } = L(), t = yearTotals();
    const tabs = [["summary", "Year summary"], ["income", "Income"], ["expenses", "Expenses"], ["miles", "Mileage"]];
    return `<section class="panel" id="acct-panel">
      <div class="no-print">
        <div class="rec-head"><div class="who"><h1>Accounting</h1>
          <span class="sub">Money in and out for the year, ready for tax time.</span></div>
          <div class="field acct-year"><label for="acct-year">Tax year</label>
            <select id="acct-year">${years().map(y => `<option value="${y}"${y === v.year ? " selected" : ""}>${y}</option>`).join("")}</select></div>
          <div class="stats">
            <div class="stat"><b class="money" id="acct-st-gross">${money(t.gross)}</b><span>Income</span></div>
            <div class="stat"><b class="money" id="acct-st-exp">${money(t.expDeductible + t.mileage)}</b><span>Expenses</span></div>
            <div class="stat"><b class="money" id="acct-st-net">${signed(t.net)}</b><span>Net profit</span></div></div></div>
        <nav class="tabs" aria-label="Accounting sections">${tabs.map(([k, l]) => `<button data-aact="tab" data-tab="${k}" class="${v.tab === k ? "on" : ""}"${v.tab === k ? ' aria-current="page"' : ""}>${l}</button>`).join("")}</nav>
      </div>
      <div id="acct-body">${v.tab === "income" ? renderIncome(t) : v.tab === "expenses" ? renderExpenses(t) : v.tab === "miles" ? renderMiles(t) : renderSummary(t)}</div>
    </section>`;
  }

  function cell(list, r, key, type, ph, cls) {
    const { esc } = L(), val = r[key] == null ? "" : r[key];
    const extra = type === "number" ? ' step="0.01" inputmode="decimal"' : "";
    return `<td class="${cls || ""}" data-label="${LABELS[key] || ph}"><input id="acct-${list}-${r.id}-${key}" type="${type}"${extra} data-al="${list}" data-aid="${r.id}" data-ak="${key}" value="${esc(val)}" placeholder="${ph}" aria-label="${ph}"></td>`;
  }
  function sel(list, r, key, opts, label) {
    const { esc } = L();
    return `<td data-label="${label}"><select id="acct-${list}-${r.id}-${key}" data-al="${list}" data-aid="${r.id}" data-ak="${key}" aria-label="${label}">${opts.map(([val, l]) => `<option value="${esc(val)}"${(r[key] || "") === val ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></td>`;
  }
  const LABELS = { date: "Date", source: "From / what for", vendor: "Paid to / what for", purpose: "Where / why", amount: "Amount ($)", miles: "Miles", note: "Note", receipt: "Receipt" };
  const rm = (list, r) => `<td class="x"><button class="btn small danger" data-aact="rm" data-list="${list}" data-id="${r.id}" aria-label="Remove">Remove</button></td>`;

  function renderIncome(t) {
    const { esc, money, fmtDate } = L();
    const rows = t.income.slice().sort(byDate);
    return `<h2 class="sec">From invoices</h2>
      <p class="hint">Every invoice dated in ${v.year}. An invoice marked "Paid in full" counts its whole amount; otherwise only the payments listed on it count. Change these on the <button class="linkbtn" data-mode="invoices">Invoices</button> page.</p>
      ${t.inv.length ? `<div class="tablewrap"><table class="m acct-tab"><thead><tr><th>Date</th><th>Invoice</th><th>Client</th><th class="r">Billed</th><th class="r">Received</th><th></th></tr></thead><tbody>
        ${t.inv.map(r => `<tr><td class="mono">${esc(fmtDate(r.date))}</td><td class="mono">${esc(r.number)}</td><td>${esc(r.who || "—")}${r.paid ? "" : ` <span class="acct-tag">Unpaid</span>`}</td>
          <td class="r mono">${money(r.billed)}</td><td class="r mono">${money(r.received)}</td>
          <td class="x"><button class="btn small" data-aact="open-inv" data-id="${r.id}">Open</button></td></tr>`).join("")}
        <tr class="acct-total"><td colspan="4">Total from invoices</td><td class="r mono">${money(t.invTotal)}</td><td></td></tr></tbody></table></div>`
        : `<p class="hint"><i>No invoices dated in ${v.year}.</i></p>`}
      ${t.unpaid > 0 ? `<p class="hint">Still owed on unpaid ${v.year} invoices: <b>${money(t.unpaid)}</b>. It isn't counted as income until it's received.</p>` : ""}

      <h2 class="sec">Other income</h2>
      <p class="hint">Money that didn't go through an invoice: cash for a tour, a coaching session, gear you sold, a referral payment.</p>
      ${rows.length ? `<div class="tablewrap"><table class="m acct-tab acct-edit"><thead><tr><th>Date</th><th>From / what for</th><th>Category</th><th>Paid by</th><th>Amount ($)</th><th>Note</th><th></th></tr></thead><tbody>
        ${rows.map(r => `<tr>${cell("income", r, "date", "date", "Date", "dt")}${cell("income", r, "source", "text", "Who / what for")}
          ${sel("income", r, "category", INCOME_CATS.map(c => [c.id, c.label]), "Category")}${sel("income", r, "method", METHODS.map(m => [m, m || "—"]), "Paid by")}
          ${cell("income", r, "amount", "number", "0.00", "amt")}${cell("income", r, "note", "text", "Note")}${rm("income", r)}</tr>`).join("")}
        <tr class="acct-total"><td colspan="4">Total other income</td><td class="r mono" id="acct-tot-income">${money(t.otherIncome)}</td><td colspan="2"></td></tr></tbody></table></div>` : ""}
      <div class="row-actions"><button class="btn" data-aact="add" data-list="income">+ Add income</button></div>`;
  }

  function renderExpenses(t) {
    const { money } = L();
    const rows = t.exp.slice().sort(byDate);
    return `<p class="hint">Business costs paid in ${v.year}. The categories follow the lines on IRS Schedule C, so the year summary lines up with the tax form.
      Keep the receipts; the Receipt column is for where you filed each one.</p>
      ${rows.length ? `<div class="tablewrap"><table class="m acct-tab acct-edit"><thead><tr><th>Date</th><th>Paid to / what for</th><th>Category</th><th>Paid by</th><th>Amount ($)</th><th>Receipt</th><th></th></tr></thead><tbody>
        ${rows.map(r => `<tr>${cell("expenses", r, "date", "date", "Date", "dt")}${cell("expenses", r, "vendor", "text", "Paid to / what for")}
          ${sel("expenses", r, "category", EXPENSE_CATS.map(c => [c.id, c.label]), "Category")}${sel("expenses", r, "method", METHODS.map(m => [m, m || "—"]), "Paid by")}
          ${cell("expenses", r, "amount", "number", "0.00", "amt")}${cell("expenses", r, "receipt", "text", "e.g. Email, folder")}${rm("expenses", r)}</tr>`).join("")}
        <tr class="acct-total"><td colspan="4">Total paid</td><td class="r mono" id="acct-tot-exp">${money(t.expPaid)}</td><td colspan="2"></td></tr></tbody></table></div>` : `<p class="hint"><i>No expenses entered for ${v.year} yet.</i></p>`}
      <div class="row-actions"><button class="btn" data-aact="add" data-list="expenses">+ Add expense</button></div>
      <details class="acct-help"><summary>Which category?</summary>
        <ul><li><b>Pool, boat or dive site fees</b>: Rent.</li>
        <li><b>TDI eLearning codes and certification processing you pay the agency</b>: Agency fees. The money the student paid you for them is income, so both sides show.</li>
        <li><b>Regulators, tanks, BCDs and other gear for teaching</b>: Gear and equipment. Your tax preparer decides whether to deduct it all this year (Sec. 179) or spread it out.</li>
        <li><b>Driving to the pool, lake or quarry</b>: use the Mileage tab instead of Car and truck. You normally use one or the other for a vehicle, not both.</li></ul></details>`;
  }

  function renderMiles(t) {
    const { esc, money } = L(), rows = t.miles.slice().sort(byDate), r = data().rates[v.year];
    return `<p class="hint">Business driving in ${v.year}: to the pool, lake, quarry, dive shop or a student's checkout dive. Not your daily commute to a regular workplace.</p>
      <div class="grid acct-rate"><div class="field"><label for="acct-rate">IRS standard rate for ${v.year} ($ per mile)</label>
        <input id="acct-rate" type="number" step="0.005" inputmode="decimal" value="${esc(r === undefined ? rate(v.year) : r)}"></div>
        <p class="hint" style="align-self:end">Check the rate on irs.gov ("standard mileage rates") each January and change it here if it's different.</p></div>
      ${rows.length ? `<div class="tablewrap"><table class="m acct-tab acct-edit"><thead><tr><th>Date</th><th>Where / why</th><th>Miles</th><th></th></tr></thead><tbody>
        ${rows.map(x => `<tr>${cell("miles", x, "date", "date", "Date", "dt")}${cell("miles", x, "purpose", "text", "e.g. Pool session, Open Water class")}
          ${cell("miles", x, "miles", "number", "0", "amt")}${rm("miles", x)}</tr>`).join("")}
        <tr class="acct-total"><td colspan="2">Total miles</td><td class="r mono" id="acct-tot-mi">${t.mi.toLocaleString("en-US", { maximumFractionDigits: 1 })}</td><td></td></tr></tbody></table></div>` : `<p class="hint"><i>No trips logged for ${v.year} yet.</i></p>`}
      <div class="row-actions"><button class="btn" data-aact="add" data-list="miles">+ Add trip</button></div>
      <p class="hint">Mileage deduction: <b id="acct-mi-ded">${money(t.mileage)}</b></p>`;
  }

  function renderSummary(t) {
    return `<div class="doc-actions no-print"><button class="btn primary" data-aact="print">Print / save as PDF</button>
        <button class="btn" data-aact="csv">Download spreadsheet (CSV)</button></div>
      <p class="hint no-print">Hand this to your tax preparer or use it to fill in Schedule C. The spreadsheet has every entry for ${v.year}, one per row.</p>
      ${t.unpaid > 0 ? `<p class="hint no-print">Not counted yet: <b>${L().money(t.unpaid)}</b> still owed on unpaid ${v.year} invoices.</p>` : ""}
      ${summaryDoc(t)}`;
  }
  function summaryDoc(t) {
    const { esc, money } = L(), s = (L().state.invoiceSettings || {});
    const incRows = [["Invoices (" + t.inv.length + ")", t.invTotal]].concat(INCOME_CATS.filter(c => t.incByCat[c.id]).map(c => [c.label, t.incByCat[c.id]]));
    const expRows = EXPENSE_CATS.filter(c => t.expByCat[c.id]).map(c => {
      const paid = t.expByCat[c.id], ded = paid * (c.pct || 1);
      return `<tr><td class="ln">${c.line}</td><td>${esc(c.label)}${c.pct ? ` <span class="acct-note">(${money(paid)} paid × ${c.pct * 100}%)</span>` : ""}</td><td class="r">${money(ded)}</td></tr>`;
    });
    if (t.mileage) expRows.splice(0, 0, `<tr><td class="ln">9</td><td>Car and truck: ${t.mi.toLocaleString("en-US", { maximumFractionDigits: 1 })} business miles × $${rate(v.year)}</td><td class="r">${money(t.mileage)}</td></tr>`);
    return `<article class="acct-doc">
      <header><div><div class="ab">${esc(s.business || "J Lichner")}</div><div class="asub">${esc(s.subtitle || "Dive Training & Certification")}</div></div>
        <div class="at">${v.year} income and expenses</div></header>
      <h3>Income</h3>
      <table><tbody>${incRows.map(([l, a]) => `<tr><td></td><td>${esc(l)}</td><td class="r">${money(a)}</td></tr>`).join("")}
        <tr class="tot"><td class="ln">1</td><td>Gross receipts</td><td class="r">${money(t.gross)}</td></tr></tbody></table>
      <h3>Expenses <span class="acct-note">(Schedule C line)</span></h3>
      <table><tbody>${expRows.join("") || `<tr><td></td><td><i>None entered</i></td><td class="r">${money(0)}</td></tr>`}
        <tr class="tot"><td class="ln">28</td><td>Total expenses</td><td class="r">${money(t.expDeductible + t.mileage)}</td></tr></tbody></table>
      <table class="net"><tbody><tr><td class="ln">31</td><td>Net profit${t.net < 0 ? " (loss)" : ""}</td><td class="r">${signed(t.net)}</td></tr></tbody></table>
      <p class="acct-note">Cash basis: income counts when it's received, expenses when they're paid. Prepared from Limitless Diving records on ${esc(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}. This is a worksheet, not tax advice.</p>
    </article>`;
  }

  // ---------- spreadsheet ----------
  function csv() {
    const t = yearTotals(), q = (x) => { const s = String(x == null ? "" : x); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [["Type", "Date", "Who / what", "Category", "Schedule C line", "Paid by", "Amount", "Deductible", "Note"]];
    t.inv.forEach(r => rows.push(["Income", r.date, "Invoice " + r.number + (r.who ? " - " + r.who : ""), "Invoices", "1", "", r.received.toFixed(2), "", r.paid ? "Paid in full" : "Part paid; billed " + r.billed.toFixed(2)]));
    t.income.slice().sort(byDate).forEach(r => rows.push(["Income", r.date, r.source, incCat(r.category).label, "1", r.method, num(r.amount).toFixed(2), "", r.note]));
    t.exp.slice().sort(byDate).forEach(r => { const c = expCat(r.category); rows.push(["Expense", r.date, r.vendor, c.label, c.line, r.method, num(r.amount).toFixed(2), (num(r.amount) * (c.pct || 1)).toFixed(2), r.receipt]); });
    t.miles.slice().sort(byDate).forEach(r => rows.push(["Mileage", r.date, r.purpose, num(r.miles) + " miles", "9", "", "", (num(r.miles) * rate(v.year)).toFixed(2), "$" + rate(v.year) + " per mile"]));
    rows.push([]);
    rows.push(["Totals", "", "Gross receipts", "", "1", "", t.gross.toFixed(2)]);
    rows.push(["Totals", "", "Total expenses incl. mileage", "", "28", "", "", (t.expDeductible + t.mileage).toFixed(2)]);
    rows.push(["Totals", "", "Net profit", "", "31", "", t.net.toFixed(2)]);
    const blob = new Blob(["﻿" + rows.map(r => r.map(q).join(",")).join("\r\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "limitless-diving-accounting-" + v.year + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- updates ----------
  function rerender() { L().render(); }
  // While typing, refresh only the numbers so the cursor stays put; the table re-sorts on the next full draw.
  function refreshTotals() {
    const t = yearTotals(), { money } = L(), set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set("acct-st-gross", money(t.gross)); set("acct-st-exp", money(t.expDeductible + t.mileage)); set("acct-st-net", signed(t.net));
    set("acct-tot-income", money(t.otherIncome)); set("acct-tot-exp", money(t.expPaid));
    set("acct-tot-mi", t.mi.toLocaleString("en-US", { maximumFractionDigits: 1 })); set("acct-mi-ded", money(t.mileage));
  }
  function onPage() { return !!document.getElementById("acct-panel"); }

  document.addEventListener("input", (e) => {
    if (!onPage()) return;
    const el = e.target;
    if (el.id === "acct-rate") { data().rates[v.year] = el.value === "" ? "" : Number(el.value); L().save(); refreshTotals(); return; }
    if (!el.dataset || !el.dataset.al || el.tagName === "SELECT") return;
    const r = data()[el.dataset.al].find(x => x.id === el.dataset.aid); if (!r) return;
    r[el.dataset.ak] = el.type === "number" ? (el.value === "" ? "" : Number(el.value)) : el.value;
    L().save(); refreshTotals();
  });
  document.addEventListener("change", (e) => {
    if (!onPage()) return;
    const el = e.target;
    if (el.id === "acct-year") { v.year = Number(el.value); rerender(); return; }
    if (!el.dataset || !el.dataset.al) return;
    const r = data()[el.dataset.al].find(x => x.id === el.dataset.aid); if (!r) return;
    if (el.tagName === "SELECT") { r[el.dataset.ak] = el.value; L().save(); refreshTotals(); }
    // A date moved to another year leaves this year's list.
    if (el.dataset.ak === "date") rerender();
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-aact]"); if (!b) return;
    switch (b.dataset.aact) {
      case "tab": v.tab = b.dataset.tab; rerender(); break;
      case "add": {
        const list = b.dataset.list, date = String(v.year) === today().slice(0, 4) ? today() : v.year + "-12-31";
        const row = list === "income" ? { id: newId("ai"), date, source: "", category: "class", method: "", amount: "", note: "" }
          : list === "expenses" ? { id: newId("ae"), date, vendor: "", category: "supplies", method: "", amount: "", receipt: "" }
          : { id: newId("am"), date, purpose: "", miles: "" };
        data()[list].push(row); L().save(); rerender();
        const f = document.getElementById("acct-" + list + "-" + row.id + "-" + (list === "income" ? "source" : list === "expenses" ? "vendor" : "purpose"));
        if (f) f.focus();
        break;
      }
      case "rm": { const a = data(); a[b.dataset.list] = a[b.dataset.list].filter(x => x.id !== b.dataset.id); L().save(); rerender(); L().toast("Removed"); break; }
      case "open-inv": if (window.LDInvoices) window.LDInvoices.open(b.dataset.id); break;
      case "print": window.print(); break;
      case "csv": csv(); break;
    }
  });

  window.LDAccounting = { render, totals: () => yearTotals() };
})();
