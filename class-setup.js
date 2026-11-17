/* Limitless Diving — Business → Classes: set up a class once, then pick it on a calendar entry when it's time.
   A class setup holds the course, the fee lines (class fee, eLearning, processing…), the deposit (a share of
   the class fee, half unless changed), what's included or not and which learning agreement to use. Time,
   location, seats and dates are set on each calendar entry. Calendar entries made from it keep its id
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
    return { id: newId(), name: "", equipment: [], equipSeeded: true, type: "class", course: "", fees: [{ desc: "Class fee", amt: "", deposit: true }],
      depositPct: DEFAULT_DEPOSIT, included: [], days: "", time: "", location: "", seats: 6, notes: "", template: "", minCert: "",
      created: new Date().toISOString() };
  }

  // ---------- data ----------
  function data() {
    const st = L().state;
    if (!Array.isArray(st.classSetups)) st.classSetups = [];
    if (!st.classSetupsSeeded) seed(st);
    const ct = typeOf().id;
    st.classSetups.forEach(x => {
      if (x.type !== ct) x.type = ct;
      // Setups made before Required equipment start with the list from the standards.
      if (!x.equipSeeded) { x.equipSeeded = true; if (!Array.isArray(x.equipment)) x.equipment = []; if (!x.equipment.length && x.course) fillEquipment(x); }
    });
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
    st.classSetups.forEach(x => { if (x.course && !x.equipment.length) fillEquipment(x); });
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
  // This page is only for classes: every setup uses the calendar's Class type (the one linked to a course).
  function typeOf() { const t = types(); return t.find(x => x.course) || t[0]; }
  // Agency: NAUI (with NAUI Technical), TDI, or Both. It narrows the Course list and fills {{agency}}.
  const AGENCIES = [["NAUI", "NAUI"], ["TDI", "TDI"], ["Both", "Both (NAUI and TDI)"]];
  function agencyOfCourse(id) { const c = window.LDCatalog && window.LDCatalog.find(id); return c ? (/^TDI/.test(c.agency) ? "TDI" : "NAUI") : ""; }
  function agencyOf(su) { return su.agency || agencyOfCourse(su.course) || ""; }
  function coursesFor(ag) { return L().COURSE_ORDER.filter(id => !ag || ag === "Both" || agencyOfCourse(id) === ag || !agencyOfCourse(id)); }
  // ---------- required equipment from the standards ----------
  // NAUI: "Policies Applying to All Courses: Scuba Equipment" (2026 manual p. 57), plus course additions.
  // TDI: section x.9 "Required Equipment" of each course in Part 2: Diver Standards (version 0126).
  const NAUI_MIN = ["Mask", "Fins", "Scuba cylinder", "Regulator with submersible pressure gauge",
    "Additional regulator second stage (octopus) or other demand-type alternate air source", "Buoyancy control device with low-pressure inflator"];
  const EQUIP = {
    "tdi-intro-tech": { src: "TDI Part 2: Diver Standards, 3.9 Required Equipment (p. 12–13)", items: [
      "Primary cylinder(s), volume appropriate for the diving conditions and the diver's gas consumption",
      "Primary regulators: primary and alternate second stage on all primary cylinder(s)",
      "Submersible pressure gauge on all primary cylinder(s)", "Depth gauge and automatic bottom timer and/or dive computer",
      "Buoyancy compensator appropriate for the equipment configuration",
      "Ascent reel with lift bag or surface marker buoy, appropriate for the maximum planned depth and with adequate lift and size for the dive environment",
      "Exposure protection appropriate for local diving conditions", "Slates / wet notes"] },
    "tdi-dpv": { src: "TDI Part 2: Diver Standards, 4.9 Required Equipment (p. 18)", items: [
      "Cylinder(s), volume appropriate for the planned dive and the student's gas consumption",
      "First and second stage regulator(s) with alternate air source", "Submersible pressure gauge", "Buoyancy compensator (BCD) with power inflator",
      "Exposure suit adequate for the diving environment", "Mask and fins", "Cutting device", "Computer, watch or bottom timer, and depth gauge",
      "Slate or wet notes with a pencil", "Whistle or other signaling device", "DPV adequately configured for the environment",
      "Reel with at least 7.5 m / 25 ft of line", "Lift bag or surface marker buoy with adequate lift and size for the dive environment", "Compass"] },
    "naui-night": { add: ["At least two lights (night and limited visibility dives)"] }
  };
  function equipFor(id) {
    const e = EQUIP[id], cat = window.LDCatalog && window.LDCatalog.find(id);
    if (e && e.items) return { src: e.src, items: e.items.slice() };
    if (cat && /^TDI/.test(cat.agency)) return { src: "", items: [] };
    return { src: "2026 NAUI Standards and Policies Manual, Policies Applying to All Courses: Scuba Equipment (p. 57)", items: NAUI_MIN.concat((e && e.add) || []) };
  }
  function fillEquipment(su) {
    const f = equipFor(su.course), have = new Set((su.equipment || []).map(x => (x.item || "").trim().toLowerCase()));
    su.equipment = su.equipment || [];
    let n = 0;
    f.items.forEach(x => { if (!have.has(x.toLowerCase())) { su.equipment.push({ item: x, note: "" }); n++; } });
    return n;
  }
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
          <span class="meta">${esc([agencyOf(x) === "Both" ? "NAUI + TDI" : agencyOf(x), typeOf(x).course ? courseName(x.course) : typeOf(x).name, L().feeLines(x).length ? money(total(x)) : "No fees yet"].filter(Boolean).join(" · "))}</span>
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
    const tplList = templates(), items = savedItems();
    const other = total(su) - classFee(su);
    return `<div class="rec-head"><div class="who"><span class="eyebrow">${esc(isClass ? courseName(su.course) || "Pick a course" : ty.name)}</span>
        <h1 id="cs-title">${esc(su.name || "Untitled class")}</h1></div>
        <div class="stats"><div class="stat"><b class="money" id="cs-total">${money(total(su))}</b><span>Total</span></div>
          <div class="stat"><b class="money" id="cs-dep">${money(dep(su))}</b><span>Deposit</span></div></div></div>

      <h2 class="sec">Class</h2><div class="grid">
        ${fld("name", "Class name (shown on the calendar)", "text", "wide")}
        <div class="field"><label for="cs-agency">Agency</label><select id="cs-agency"><option value=""${agencyOf(su) ? "" : " selected"}>Choose…</option>
          ${AGENCIES.map(([k, l]) => `<option value="${k}"${agencyOf(su) === k ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
        ${isClass ? `<div class="field"><label for="cs-course">Course</label><select id="cs-course"><option value=""${c ? "" : " selected"}>Choose a course…</option>${L().courseOptions(su.course, coursesFor(agencyOf(su)).concat(su.course && !coursesFor(agencyOf(su)).includes(su.course) ? [su.course] : []))}</select></div>` : ""}</div>

      ${typeOf(su).course ? renderStandards(su) : ""}

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

      <h2 class="sec">Required equipment</h2>
      ${(() => { const f = su.course ? equipFor(su.course) : null; return `<p class="hint">What each student must have for this class. It goes into the learning agreement as <code>{{equipment}}</code>.${f && f.src ? " Standards: " + esc(f.src) + "." : su.course ? " This course's required equipment isn't in the app yet; check the agency standards." : ""}</p>`; })()}
      <div class="tablewrap"><table class="m cs-eq"><thead><tr><th>Item</th><th>Notes (e.g. provided, rental available)</th><th></th></tr></thead><tbody>
        ${(su.equipment || []).map((x, i) => `<tr><td><textarea id="cs-eq-${i}-item" data-csl="equipment.${i}.item" rows="${Math.max(1, Math.ceil(String(x.item || "").length / 42))}" aria-label="Item">${esc(x.item)}</textarea></td>
          <td><input id="cs-eq-${i}-note" data-csl="equipment.${i}.note" value="${esc(x.note)}" aria-label="Notes"></td>
          <td class="x"><button class="btn small danger" data-csact="rm-eq" data-i="${i}">Remove</button></td></tr>`).join("")}
      </tbody></table></div>
      <div class="row-actions"><button class="btn" data-csact="add-eq">+ Add equipment</button>
        ${su.course && equipFor(su.course).items.length ? `<button class="btn" data-csact="fill-eq">Add what the standards require</button>` : ""}</div>

      <h2 class="sec">Learning agreement</h2>
      <div class="grid"><div class="field wide"><label for="cs-tpl">Template</label><select id="cs-tpl">
        <option value=""${su.template ? "" : " selected"}>Automatic (the best match for the course and type)</option>
        ${tplList.map(t => `<option value="${esc(t.id)}"${t.id === su.template ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select>
        <span class="hint" style="margin:0">Use <code>{{fees}}</code> and <code>{{deposit}}</code> in a template to show these fees. Edit templates under Business → Scheduling.</span></div></div>

      <div class="row-actions" style="margin-top:28px"><button class="btn" data-csact="dup">Duplicate</button>
        <button class="btn danger" data-csact="del">Delete…</button><span id="cs-del-confirm"></span></div>`;
  }
  // ---------- course standards checklist ----------
  // What the agency standards require for the course (catalog.js std, with any changes made under Settings →
  // Course standards), as a list Jamie ticks off while setting the class up. Ticks are kept on the setup.
  function stdItems(su) {
    const CAT = window.LDCatalog, cat = CAT && su.course ? CAT.find(su.course) : null;
    if (!su.course || !L().COURSES[su.course]) return null;
    const std = (cat && cat.std) || {}, pr = L().program(su.course) || {}, out = [];
    const age = pr.minAge || std.age; if (age) out.push(["age", "Minimum age", age]);
    const pre = (std.prereqs && std.prereqs.length ? std.prereqs : (pr.prereqs || []).map(x => (x.item || x.label || "") + (x.detail ? " (" + x.detail + ")" : ""))).filter(Boolean);
    pre.forEach((x, i) => out.push(["pre" + i, "Prerequisite", x]));
    const dives = pr.minDives || (std.dives != null && std.dives !== "" ? std.dives + " open water dive" + (Number(std.dives) === 1 ? "" : "s") + (std.divesNote ? ". " + std.divesNote : "") : "");
    if (dives) out.push(["dives", "Open water dives", dives]);
    if (std.dives > 0 && CAT && CAT.minDays) out.push(["days", "Training days", "At least " + CAT.minDays(cat) + " (no more than " + CAT.DIVES_PER_DAY + " training dives a day)"]);
    const depth = pr.maxDepth || std.depth; if (depth) out.push(["depth", "Maximum training depth", depth]);
    out.push(["ratio", "Ratios and supervision", "Check the instructor-to-student ratios and any assistant needed for the planned group size"]);
    out.push(["materials", "Materials and certification", "Student materials and certification processing are covered (a fee line or listed as included)"]);
    const src = pr.standardsRef || (CAT && CAT.source && CAT.source(cat)) || (std.page ? (cat && /^TDI/.test(cat.agency) ? "TDI Standards and Procedures, Part 2" : "2026 NAUI Standards and Policies Manual") + ", p. " + std.page : "");
    return { items: out, src, missing: !cat || !cat.std };
  }
  function renderStandards(su) {
    const { esc } = L(), s = stdItems(su);
    if (!s) return `<h2 class="sec">Standards checklist</h2><p class="hint">Pick a course to see what its standards require.</p>`;
    const done = su.stdChecked || {}, n = s.items.filter(([k]) => done[k]).length;
    return `<h2 class="sec">Standards checklist <span class="cs-std-count" id="cs-std-count">${n} of ${s.items.length}</span></h2>
      <p class="hint">${s.missing ? "This course's standards aren't entered yet. Add them under Settings → Course standards, or check the agency manual directly." : "From " + esc(s.src || "the agency standards") + ". Tick each one once the class covers it."}</p>
      <ul class="cs-std">${s.items.map(([k, label, text]) => `<li><label class="chk"><input type="checkbox" data-csstd="${esc(k)}"${done[k] ? " checked" : ""}>
        <span><b>${esc(label)}:</b> ${esc(text)}</span></label></li>`).join("")}</ul>`;
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
    if (el.id === "cs-agency") { su.agency = el.value; L().save(); rerender(); return; }
    if (el.id === "cs-course") {
      const old = courseName(su.course); su.course = el.value;
      // A new setup is named after its course until it gets a name of its own.
      if (!su.name || su.name === old) su.name = courseName(el.value);
      const pr = L().program(el.value) || {};
      if (!su.time) su.time = pr.hours || ""; if (!su.location) su.location = pr.location || "";
      if (!(su.equipment || []).some(x => x.item)) { su.equipment = []; fillEquipment(su); }
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
    const t = e.target;
    if (t.dataset && t.dataset.csstd) {
      const su = cur(); if (!su) return;
      su.stdChecked = su.stdChecked || {}; su.stdChecked[t.dataset.csstd] = t.checked; L().save();
      const s = stdItems(su), c = document.getElementById("cs-std-count");
      if (s && c) c.textContent = s.items.filter(([k]) => su.stdChecked[k]).length + " of " + s.items.length;
      return;
    }
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
      case "add-eq": (su.equipment = su.equipment || []).push({ item: "", note: "" }); L().save(); rerender(); break;
      case "rm-eq": su.equipment.splice(i, 1); L().save(); rerender(); break;
      case "fill-eq": { const n = fillEquipment(su); L().save(); rerender(); L().toast(n ? n + " item" + (n === 1 ? "" : "s") + " added from the standards" : "Everything the standards list is already here"); break; }
      case "add-inc": (su.included = su.included || []).push({ item: "", cost: "" }); L().save(); rerender(); break;
      case "rm-inc": su.included.splice(i, 1); L().save(); rerender(); break;
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
  window.LDClassSetup = { render, open, list, equipFor };
  // Setups are made (from the current course prices) the first time Classes is opened, not on page load,
  // so visitors' browsers never get any.
  L().render();
})();
