/* Limitless Diving — Business → Classes: set up a class once, then pick it on a calendar entry when it's time.
   A class setup holds the course, the fee lines (class fee, eLearning, processing…), the deposit (a share of
   the class fee, half unless changed), what's included or not, the calendar defaults (days, time, location,
   seats, description) and which learning agreement to use. Calendar entries made from it keep its id
   (setupId), so the learning agreement (scheduling.js, {{fees}} and the deposit sentence) and the invoice
   (app.js billing) use its fee lines. Setups live in this browser with everything else (state.classSetups),
   so Download backup / Restore carry them. Instructors and Admins only (app.js BUSINESS_MODES).
   Load after app.js, catalog-page.js, calendar.js and scheduling.js. */
(function () {
  "use strict";

  const L = () => window.LD;
  const G = () => window.LDCalGrid;
  const $ = (s, r) => (r || document).querySelector(s);
  const v = { sel: null, q: "" };
  const DEFAULT_DEPOSIT = 50;

  function newId() { return "cs" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function blank() {
    return { id: newId(), name: "", type: "class", course: "", fees: [{ desc: "Class fee", amt: "", deposit: true }],
      depositPct: DEFAULT_DEPOSIT, included: [], days: "", time: "", location: "", seats: 6, notes: "", template: "", minCert: "",
      created: new Date().toISOString() };
  }

  // ---------- data ----------
  function data() {
    const st = L().state;
    if (!Array.isArray(st.classSetups)) st.classSetups = [];
    if (!st.classSetupsSeeded) seed(st);
    return st;
  }
  // The first time: one setup for each course that already has a price in Settings, plus Intro to Tech with the
  // fees from the invoice template. Calendar classes of a course with exactly one setup are linked to it
  // (they keep their own price).
  function seed(st) {
    st.classSetupsSeeded = new Date().toISOString();
    const C = L().COURSES;
    L().COURSE_ORDER.forEach(id => {
      const pr = L().program(id) || {}, price = Number(pr.price) || 0; if (!price || !C[id]) return;
      const c = C[id];
      st.classSetups.push(Object.assign(blank(), {
        name: pr.program || c.fullName || c.name, course: id,
        fees: [{ desc: pr.feeLabel || ((c.fullName || c.name) + " course fee"), amt: price, deposit: true }],
        included: (pr.costRows || []).filter(x => x && x.item).map(x => ({ item: x.item, cost: x.cost || "" })),
        time: pr.hours || "", location: pr.location || ""
      }));
    });
    if (C["tdi-intro-tech"] && !st.classSetups.some(x => x.course === "tdi-intro-tech")) {
      st.classSetups.push(Object.assign(blank(), {
        name: "Intro to Tech", course: "tdi-intro-tech",
        fees: [{ desc: "Intro to Tech Class Fees", amt: 400, deposit: true }, { desc: "TDI Elearning", amt: 65, deposit: false },
          { desc: "TDI Certification Processing/Shipping", amt: 35, deposit: false }],
        included: [{ item: "Instruction", cost: "Included" }]
      }));
    }
    (st.classes || []).forEach(k => {
      if (k.setupId || (k.type && k.type !== "class") || !k.course) return;
      const m = st.classSetups.filter(x => x.course === k.course);
      if (m.length === 1) k.setupId = m[0].id;
    });
    L().save();
  }
  function list() { return data().classSetups; }
  function cur() { return list().find(x => x.id === v.sel) || null; }
  function types() { return window.LDCalendar && window.LDCalendar.types ? window.LDCalendar.types() : [{ id: "class", name: "Class", course: true }]; }
  function typeOf(su) { const t = types(); return t.find(x => x.id === (su.type || "class")) || t.find(x => x.course) || t[0]; }
  function courseName(id) { const c = L().COURSES[id]; return c ? (c.fullName || c.name) : ""; }
  function entries(su) { return (L().state.classes || []).filter(k => k.setupId === su.id); }
  function upcoming(su) { const t = G().today(); return entries(su).filter(k => (G().lastDate(k.dates) || t) >= t); }
  function total(su) { return L().setupTotal(su); }
  function classFee(su) { return L().feeLines(su).filter(x => x.deposit).reduce((a, x) => a + x.amt, 0); }
  function pct(su) { return su.depositPct === "" || su.depositPct == null ? DEFAULT_DEPOSIT : Number(su.depositPct) || 0; }
  function dep(su) { return Math.round(classFee(su) * pct(su)) / 100; }
  function templates() { return L().state.agreementTemplates || (window.LDScheduling && window.LDScheduling.DEFAULT_TEMPLATES) || []; }
  function savedItems() { const s = L().state.invoiceSettings; return (s && Array.isArray(s.catalog) ? s.catalog : []).filter(c => c && c.desc); }

  // ---------- render ----------
  function render() {
    if (v.sel && !cur()) v.sel = null;
    if (!v.sel && list().length) v.sel = sorted()[0].id;
    return `<aside class="roster no-print">${renderList()}</aside><section class="panel" id="cs-panel">${renderEditor()}</section>`;
  }
  function sorted() { return list().slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")); }
  function renderList() {
    const { esc, money } = L(), q = v.q.trim().toLowerCase();
    const shown = sorted().filter(x => !q || (x.name || "").toLowerCase().includes(q) || courseName(x.course).toLowerCase().includes(q));
    return `<button class="btn primary" data-csact="new">+ New class</button>
      ${list().length > 6 ? `<input type="search" id="cs-q" placeholder="Search classes" value="${esc(v.q)}" aria-label="Search classes">` : ""}
      <ul>${shown.map(x => {
        const n = upcoming(x).length;
        return `<li><button data-csact="pick" data-id="${x.id}" class="${x.id === v.sel ? "sel" : ""}">
          <span class="nm">${esc(x.name || "Untitled class")}</span>
          <span class="meta">${esc([typeOf(x).course ? courseName(x.course) : typeOf(x).name, L().feeLines(x).length ? money(total(x)) : "No fees yet"].filter(Boolean).join(" · "))}</span>
          ${n ? `<span class="meta">${n} on the calendar</span>` : ""}</button></li>`;
      }).join("") || `<li class="meta" style="padding:8px 10px">${list().length ? "No matches." : "No classes set up yet."}</li>`}</ul>`;
  }

  function fld(key, label, type, cls) {
    const su = cur(), { esc } = L(), id = "cs-f-" + key, val = su[key];
    const ctl = type === "area" ? `<textarea id="${id}" data-csf="${key}">${esc(val)}</textarea>`
      : `<input id="${id}" type="${type || "text"}" data-csf="${key}" value="${esc(val)}"${type === "number" ? ' min="0" step="any" inputmode="decimal"' : ""}>`;
    return `<div class="field ${cls || ""}"><label for="${id}">${label}</label>${ctl}</div>`;
  }

  function renderEditor() {
    const su = cur(), { esc, money, fmtDate } = L();
    if (!su) {
      return `<div class="empty"><h2>Classes</h2>
        <p>Set up each class you teach once: the course, the fees, the deposit and the details. When it's time, pick it under “Class setup” on a Calendar entry.
        Its fees and deposit then fill in the learning agreement and the invoice for every student on it.</p>
        <button class="btn primary" data-csact="new">+ New class</button></div>`;
    }
    const ty = typeOf(su), isClass = !!ty.course, fees = su.fees || [], c = L().COURSES[su.course];
    const unit = c ? c.unit : "Day", defDays = c && c.unit === "Day" ? Math.max(1, c.schedule.length) : 1;
    const tplList = templates(), items = savedItems(), ents = entries(su).slice().sort((a, b) => (G().firstDate(a.dates) || "").localeCompare(G().firstDate(b.dates) || ""));
    const other = total(su) - classFee(su);
    return `<div class="rec-head"><div class="who"><span class="eyebrow">${esc(isClass ? courseName(su.course) || "Pick a course" : ty.name)}</span>
        <h1 id="cs-title">${esc(su.name || "Untitled class")}</h1></div>
        <div class="stats"><div class="stat"><b class="money" id="cs-total">${money(total(su))}</b><span>Total</span></div>
          <div class="stat"><b class="money" id="cs-dep">${money(dep(su))}</b><span>Deposit</span></div></div></div>

      <h2 class="sec">Class</h2><div class="grid">
        ${fld("name", "Class name (shown on the calendar)", "text", "wide")}
        <div class="field"><label for="cs-type">Calendar type</label><select id="cs-type">${types().map(t => `<option value="${esc(t.id)}"${t === ty ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select></div>
        ${isClass ? `<div class="field"><label for="cs-course">Course</label><select id="cs-course"><option value=""${c ? "" : " selected"}>Choose a course…</option>${L().courseOptions(su.course)}</select></div>` : ""}</div>

      <h2 class="sec">Fees</h2>
      <p class="hint">Each line is a line on the invoice and in the learning agreement. The deposit is ${esc(pct(su))}% of the lines marked <b>Class fee</b>; untick it for pass-through costs like eLearning or certification processing.</p>
      <div class="tablewrap"><table class="m cs-fees"><thead><tr><th>Description</th><th>Amount ($)</th><th>Class fee</th><th></th></tr></thead><tbody>
        ${fees.map((x, i) => `<tr><td><input id="cs-fee-${i}-desc" data-csl="fees.${i}.desc" value="${esc(x.desc)}" placeholder="e.g. Class fee" aria-label="Description"></td>
          <td class="amt"><input id="cs-fee-${i}-amt" type="number" step="0.01" min="0" inputmode="decimal" data-csl="fees.${i}.amt" value="${esc(x.amt)}" placeholder="0.00" aria-label="Amount"></td>
          <td class="chkcell"><input type="checkbox" data-csl="fees.${i}.deposit"${x.deposit !== false ? " checked" : ""} aria-label="Counts toward the deposit"></td>
          <td class="x"><button class="btn small danger" data-csact="rm-fee" data-i="${i}">Remove</button></td></tr>`).join("")}
      </tbody></table></div>
      <div class="row-actions"><button class="btn" data-csact="add-fee">+ Add fee line</button>
        ${items.length ? `<select id="cs-saved" aria-label="Add a saved invoice item"><option value="">+ Add a saved invoice item…</option>${items.map((x, i) => `<option value="${i}">${esc(x.desc)} — ${money(x.amt)}</option>`).join("")}</select>` : ""}</div>
      <div class="grid">${fld("depositPct", "Deposit (% of the class fee)", "number")}
        <div class="field"><span class="lbl">Deposit</span><b class="money" id="cs-dep2">${money(dep(su))}</b><span class="hint" style="margin:0" id="cs-dep-note">${esc(depNote(su))}</span></div>
        <div class="field"><span class="lbl">Total</span><b class="money" id="cs-total2">${money(total(su))}</b><span class="hint" style="margin:0" id="cs-other">${other ? money(other) + " of it is outside the class fee" : ""}</span></div></div>

      <h2 class="sec">Included and not included</h2>
      <p class="hint">Listed under the fees in the learning agreement, e.g. “Lake Hydra entry ticket: not included, purchased separately”.</p>
      <div class="tablewrap"><table class="m"><thead><tr><th>Item</th><th>Cost</th><th></th></tr></thead><tbody>
        ${(su.included || []).map((x, i) => `<tr><td><input id="cs-inc-${i}-item" data-csl="included.${i}.item" value="${esc(x.item)}" aria-label="Item"></td>
          <td><input id="cs-inc-${i}-cost" data-csl="included.${i}.cost" value="${esc(x.cost)}" placeholder="Included" aria-label="Cost"></td>
          <td class="x"><button class="btn small danger" data-csact="rm-inc" data-i="${i}">Remove</button></td></tr>`).join("")}
      </tbody></table></div>
      <div class="row-actions"><button class="btn" data-csact="add-inc">+ Add line</button></div>

      <h2 class="sec">Calendar details</h2>
      <p class="hint">Filled in on each calendar entry you add from here. You can still change them on the entry.</p>
      <div class="grid">
        ${fld("days", isClass ? (unit === "Day" ? "Number of days (blank = " + defDays + ")" : "Number of dates (blank = 1)") : "Number of days (blank = 1)", "number")}
        ${fld("time", "Time")}${fld("location", "Location")}${fld("seats", "Seats (blank = no limit)", "number")}
        ${fld("notes", "Description for the public calendar", "area", "wide")}</div>

      <h2 class="sec">Learning agreement</h2>
      <div class="grid"><div class="field wide"><label for="cs-tpl">Template</label><select id="cs-tpl">
        <option value=""${su.template ? "" : " selected"}>Automatic (the best match for the course and type)</option>
        ${tplList.map(t => `<option value="${esc(t.id)}"${t.id === su.template ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select>
        <span class="hint" style="margin:0">Use <code>{{fees}}</code> and <code>{{deposit}}</code> in a template to show these fees. Edit templates under Business → Scheduling.</span></div></div>

      <h2 class="sec">On the calendar</h2>
      ${ents.length ? `<div class="tablewrap"><table class="m"><thead><tr><th>Dates</th><th>Price</th><th>Students</th><th>Status</th><th></th></tr></thead><tbody>
        ${ents.map(k => { const past = window.LDCalendar && window.LDCalendar.isPast(k), n = window.LDCalendar ? window.LDCalendar.roster(k).length : 0; return `<tr>
          <td>${esc(G().range(k.dates) || "No dates yet")}</td><td class="money">${k.price === "" || k.price == null ? "" : money(k.price)}</td><td>${n}</td>
          <td>${past ? "Finished" : k.published ? "Published" : "Draft"}</td>
          <td><button class="btn small" data-csact="open-entry" data-id="${esc(k.id)}">Open</button></td></tr>`; }).join("")}</tbody></table></div>`
        : `<p class="hint">Not on the calendar yet.</p>`}

      <div class="row-actions" style="margin-top:28px"><button class="btn" data-csact="dup">Duplicate</button>
        <button class="btn danger" data-csact="del">Delete…</button><span id="cs-del-confirm"></span></div>`;
  }
  function depNote(su) { const cf = classFee(su); return cf ? pct(su) + "% of " + L().money(cf) : "Mark a line as Class fee"; }

  // ---------- updates ----------
  function rerender() { if (document.getElementById("cs-panel")) L().render(); }
  function refresh() {
    const su = cur(); if (!su) return;
    const { money } = L(), set = (id, t) => { const x = document.getElementById(id); if (x) x.textContent = t; };
    set("cs-title", su.name || "Untitled class"); set("cs-total", money(total(su))); set("cs-total2", money(total(su)));
    set("cs-dep", money(dep(su))); set("cs-dep2", money(dep(su))); set("cs-dep-note", depNote(su));
    const o = total(su) - classFee(su); set("cs-other", o ? money(o) + " of it is outside the class fee" : "");
    const r = $(".roster"); if (r && document.getElementById("cs-panel")) {
      const q = $("#cs-q"), had = q && document.activeElement === q;
      r.innerHTML = renderList();
      if (had) { const nq = $("#cs-q"); nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); }
    }
  }
  function setPath(obj, path, val) { const ks = path.split("."); let o = obj; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = val; }

  document.addEventListener("input", (e) => {
    const el = e.target; if (!document.getElementById("cs-panel")) return;
    if (el.id === "cs-q") { v.q = el.value; refresh(); return; }
    const su = cur(); if (!su) return;
    if (el.id === "cs-type") { su.type = el.value; if (!typeOf(su).course) su.course = ""; L().save(); rerender(); return; }
    if (el.id === "cs-course") {
      const old = courseName(su.course); su.course = el.value;
      // A new setup is named after its course until it gets a name of its own.
      if (!su.name || su.name === old) su.name = courseName(el.value);
      const pr = L().program(el.value) || {};
      if (!su.time) su.time = pr.hours || ""; if (!su.location) su.location = pr.location || "";
      L().save(); rerender(); return;
    }
    if (el.id === "cs-tpl") { su.template = el.value; L().save(); return; }
    if (el.id === "cs-saved" && el.value !== "") {
      const x = savedItems()[Number(el.value)]; if (!x) return;
      const empty = (su.fees || []).findIndex(r => !r.desc && (r.amt === "" || r.amt == null));
      const row = { desc: x.desc, amt: Number(x.amt) || 0, deposit: false };
      if (empty >= 0) su.fees[empty] = Object.assign(row, { deposit: su.fees[empty].deposit !== false }); else su.fees.push(row);
      L().save(); rerender(); return;
    }
    const key = el.dataset && (el.dataset.csf || el.dataset.csl); if (!key) return;
    let val = el.type === "checkbox" ? el.checked : el.value;
    if (el.type === "number") val = el.value === "" ? "" : Number(el.value);
    if (el.dataset.csf) su[key] = val; else setPath(su, key, val);
    L().save(); refresh();
  });
  document.addEventListener("change", (e) => {
    // Checkboxes and selects fire input too in current browsers; this covers older Safari.
    const el = e.target; if (!el.dataset || !el.dataset.csl || el.type !== "checkbox") return;
    const su = cur(); if (!su) return; setPath(su, el.dataset.csl, el.checked); L().save(); refresh();
  });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-csact]"); if (!b) return;
    const su = cur(), i = Number(b.dataset.i);
    switch (b.dataset.csact) {
      case "new": { const n = blank(); list().push(n); v.sel = n.id; L().save(); rerender(); const x = $("#cs-course") || $("#cs-f-name"); if (x) x.focus(); break; }
      case "pick": v.sel = b.dataset.id; rerender(); break;
      case "add-fee": su.fees.push({ desc: "", amt: "", deposit: !su.fees.length }); L().save(); rerender(); break;
      case "rm-fee": su.fees.splice(i, 1); L().save(); rerender(); break;
      case "add-inc": (su.included = su.included || []).push({ item: "", cost: "" }); L().save(); rerender(); break;
      case "rm-inc": su.included.splice(i, 1); L().save(); rerender(); break;
      case "open-entry": if (window.LDCalendar) window.LDCalendar.show(b.dataset.id); break;
      case "dup": { const n = Object.assign(JSON.parse(JSON.stringify(su)), { id: newId(), name: (su.name || "Class") + " (copy)", created: new Date().toISOString() }); list().push(n); v.sel = n.id; L().save(); rerender(); break; }
      case "del": {
        const n = entries(su).length;
        $("#cs-del-confirm").innerHTML = `Delete this class setup?${n ? " The " + n + " calendar entr" + (n === 1 ? "y keeps its" : "ies keep their") + " dates and price, but no longer use these fee lines." : ""} <button class="btn small danger" data-csact="del-yes">Delete</button>`;
        break;
      }
      case "del-yes": {
        entries(su).forEach(k => { delete k.setupId; });
        data().classSetups = list().filter(x => x.id !== su.id); v.sel = null; L().save(); rerender(); L().toast("Class setup deleted");
        break;
      }
    }
  });

  function open(id) { if (id) v.sel = id; L().go("classes"); }
  window.LDClassSetup = { render, open, list };
  // Setups are made (from the current course prices) the first time Classes is opened, not on page load,
  // so visitors' browsers never get any.
  L().render();
})();
