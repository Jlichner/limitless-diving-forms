/* Limitless Diving — Open Water student records and proposal builder.
   All data is stored in this browser (localStorage). Use Export to back up or move it. */
(function () {
  "use strict";

  const STORE_KEY = "limitless-ow-v1";

  const SKILLS = [
    ["Watermanship", "Novice-level swim stroke proficiency; minimum 15 continuous stroke cycles."],
    ["Watermanship", "Survival swim — 10 minutes."],
    ["Watermanship", "Underwater swim — 15 m / 50 ft. on one breath; no push-off or dive."],
    ["Equipment", "Assemble, don, and adjust scuba gear."],
    ["Equipment", "Pre-dive buddy check."],
    ["Communication", "Appropriate underwater communication and hand signals."],
    ["Buoyancy", "Weighting check / appropriate weighting."],
    ["Equalization", "Equalize diver air spaces appropriately during descent."],
    ["Breathing", "Comfortably breathe from scuba underwater."],
    ["Surface Skills", "Regulator / snorkel exchange while swimming at the surface."],
    ["Regulator", "Remove, replace, clear, and recover regulator."],
    ["Mask", "Clear a flooded mask."],
    ["Mask", "Remove and replace mask."],
    ["Mask", "Breathe from scuba without a mask."],
    ["Instruments", "Monitor depth, pressure, and timing instruments; communicate information."],
    ["Buoyancy", "Environmentally appropriate buoyancy control."],
    ["Propulsion", "Environmentally appropriate propulsion / finning."],
    ["Ballast", "Remove and replace ballast / weight system as appropriate."],
    ["Problem Solving", "Demonstrate underwater problem-solving."],
    ["Surface Buoyancy", "Establish surface buoyancy using power and oral inflation."],
    ["Emergency", "Controlled emergency swimming ascent from minimum 4.6 m / 15 ft. in open water."],
    ["Emergency", "Controlled shared-air ascent from minimum 4.6 m / 15 ft.; donor and receiver."],
    ["Rescue", "Bring simulated unconscious diver to surface from approx. 3 m / 10 ft.; manage equipment and evacuation."],
    ["Buddy / Gas", "Maintain buddy awareness; monitor, communicate, and manage planned minimum gas."],
    ["Navigation", "Use environmental aids and compass to travel to a designated direction/location."],
    ["Navigation", "Set a bearing, follow it, and return on a reciprocal course to approximate starting location."],
    ["Planning", "Plan a no-required-stop dive including gas, ascent, precautionary stop, and safety margin."],
    ["Planning", "Plan a repetitive no-required-stop dive using tables or an appropriate computer."],
    ["Environment", "Minimize environmental impact and promote conservation."],
    ["Environment", "Recognize and identify representative local plant and animal life."]
  ];

  const FINAL = [
    ["Emergency / Gas", "Simulate interruption of air supply and perform a controlled emergency ascent using a redundant compressed-air supply, where applicable."],
    ["Emergency", "Perform a relaxed, controlled emergency swimming ascent from the required minimum open-water depth."],
    ["Air Sharing", "Share air from octopus / alternate breathing source as donor and receiver during ascent."],
    ["Rescue", "Bring simulated unconscious diver to surface from approx. 3 m / 10 ft.; establish buoyancy and manage equipment."],
    ["Rescue / Transport", "Transport buddy simulating exhaustion for approximately 46 m / 50 yd. while maintaining appropriate contact."],
    ["Dive Conduct", "Appropriate entry and exit; maintain control from entry through exit."],
    ["Dive Conduct", "Weighting / buoyancy check on entry and appropriate buoyancy throughout the dive."],
    ["Dive Conduct", "Buddy, instrument, gas, and environmental awareness throughout the dive."],
    ["Final Evaluation", "Complete a supervised open-water dive while applying required skills safely and efficiently."]
  ];

  const DEFAULT_PROGRAM = {
    business: "Limitless Diving & Technical Training",
    docTitle: "Open Water Diver Course Proposal",
    tagline: "A performance-based pathway to becoming a capable, controlled, and confident recreational diver.",
    program: "NAUI Open Water Scuba Diver + Nitrox",
    format: "1 Day Academics & Confined Water + 2 Days Open Water",
    price: 950,
    depositPct: 50,
    instructor: "Jamie M. Lichner",
    phone: "484-221-0825",
    email: "jlichner.scuba@gmail.com",
    philosophy: "At Limitless Diving & Technical Training, we do not teach students to simply complete a course — we train divers to be capable, controlled, and confident in the water.\n\nThis program is performance-based. Skill execution, buoyancy, awareness, decision-making, and problem management are treated as core diving abilities rather than boxes to check.\n\nThe objective is to develop a diver who understands what they are doing, can recognize developing problems, and can respond appropriately while maintaining control.",
    standards: "This program is conducted in accordance with the current NAUI Standards and Policies Manual. The NAUI Open Water Scuba Diver course is an ISO Level 2 autonomous-diver certification. NAUI standards establish certification requirements; this program may add instructor-selected emphasis, repetition, and coaching.",
    days: [
      { day: "1", focus: "Academics + Confined Water", obj: "Open Water and Nitrox academics; equipment orientation; introduce and develop required scuba skills; evaluate watermanship and in-water comfort." },
      { day: "2", focus: "Open Water — Dives 1 & 2", obj: "Apply foundational skills; establish buoyancy and control; practice communication, air management, and problem solving." },
      { day: "3", focus: "Open Water — Dives 3 & 4", obj: "Reinforce skills; increase independence and situational awareness; complete final performance evaluations." }
    ],
    included: [
      { item: "NAUI Open Water Scuba Diver", detail: "Autonomous Diver certification — ISO 24801-2" },
      { item: "NAUI Enriched Air Nitrox", detail: "EANx / Nitrox certification, integrated with the Open Water program" },
      { item: "eLearning", detail: "Open Water eLearning + Nitrox eLearning materials" },
      { item: "Instruction", detail: "Academic, confined-water, and open-water instruction, briefings and debriefings" },
      { item: "Certification Processing", detail: "Included upon successful completion of all requirements" }
    ],
    expectationsCallout: "Attendance does NOT guarantee certification. All required knowledge, skills, judgment, and performance must be demonstrated to the required standard.",
    expectations: "Skills may be introduced, practiced, repeated, and reevaluated. Needing additional practice is not a failure of the training process; an incomplete skill simply remains incomplete until proficiency is demonstrated.",
    commitment: "If a required skill is not mastered during scheduled training, I will work with the student to identify the specific performance issue and establish a clear plan for remediation, additional practice, and reevaluation.\n\nMy commitment is to provide coaching, explanation, repetition, and structured practice that gives the student a reasonable opportunity to achieve proficiency. Certification remains performance-based and will only be awarded when the required standard has been demonstrated.",
    proficiency: "Certification readiness means required knowledge and skills are demonstrated safely, correctly, and with sufficient control to show repeatable performance. The instructor may require additional practice or evaluation whenever performance does not meet the required standard.",
    paymentNotes: "The remaining balance is due prior to the open-water training portion.\n\nAdditional training required to achieve skill proficiency is not included in the course fee and may be billed separately. Any additional training requirement will be discussed with the student before additional charges are incurred.",
    acknowledgment: "I understand that this is a performance-based certification program. I understand that attendance, participation, or completion of scheduled class dates does not guarantee certification. I understand that all required knowledge and skills must be demonstrated to the required level of proficiency.\n\nI understand that if I do not initially master a required skill, my instructor will work with me to establish a reasonable plan for additional practice and evaluation. I understand that certification will not be issued until the required standard has been met."
  };

  // ---------- state ----------
  let state = load();
  let view = { mode: "students", sel: state.students[0] ? state.students[0].id : null, tab: "details", q: "" };

  function blankStudent() {
    return {
      id: "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      created: new Date().toISOString(),
      name: "", email: "", phone: "", emergency: "", location: "", notes: "",
      dates: { d1: "", d2: "", d3: "" },
      skills: {}, final: {},
      dives: [1, 2, 3, 4].map(() => ({ date: "", loc: "", depth: "", dur: "", gas: "", notes: "", ini: "" })),
      remed: [],
      pay: { depPaid: false, depDate: "", depMethod: "", balPaid: false, balDate: "", balMethod: "", extras: [] },
      ack: { agreed: false, studentName: "", studentDate: "", instructorDate: "" }
    };
  }

  function load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { data = null; }
    if (!data || typeof data !== "object") data = { program: {}, students: [] };
    data.program = Object.assign(clone(DEFAULT_PROGRAM), data.program || {});
    data.students = Array.isArray(data.students) ? data.students.map(s => mergeDeep(blankStudent(), s)) : [];
    return data;
  }
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
      catch (e) { toast("Couldn't save in this browser. Use Export to keep a copy."); }
    }, 300);
  }
  function flush() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} } }
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function mergeDeep(base, extra) {
    if (!extra || typeof extra !== "object") return base;
    for (const k of Object.keys(extra)) {
      const v = extra[k];
      if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) base[k] = mergeDeep(base[k], v);
      else base[k] = v;
    }
    return base;
  }

  // ---------- helpers ----------
  const $ = (s, r) => (r || document).querySelector(s);
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function money(n) { const x = Number(n) || 0; return "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function cur() { return state.students.find(s => s.id === view.sel) || null; }
  function getPath(obj, path) { return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function setPath(obj, path, val) {
    const ks = path.split("."); let o = obj;
    for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = val;
  }
  function fmtDate(d) {
    if (!d) return "";
    const t = new Date(d + "T12:00:00"); if (isNaN(t)) return d;
    return t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function deposit() { return Math.round((Number(state.program.price) || 0) * (Number(state.program.depositPct) || 0)) / 100; }
  function progress(s) {
    const m = SKILLS.filter((_, i) => s.skills[i] && s.skills[i].m).length;
    const f = FINAL.filter((_, i) => s.final[i] && s.final[i].m).length;
    const r = SKILLS.filter((_, i) => s.skills[i] && (s.skills[i].cw === "R" || s.skills[i].ow === "R")).length
            + FINAL.filter((_, i) => s.final[i] && (s.final[i].cw === "R" || s.final[i].ow === "R")).length;
    return { m, f, r, pct: Math.round(((m + f) / (SKILLS.length + FINAL.length)) * 100) };
  }
  function owed(s) {
    const extras = (s.pay.extras || []).reduce((a, x) => a + (Number(x.amt) || 0), 0);
    const total = (Number(state.program.price) || 0) + extras;
    let paid = 0;
    if (s.pay.depPaid) paid += deposit();
    if (s.pay.balPaid) paid += (Number(state.program.price) || 0) - deposit();
    return { extras, total, paid, due: total - paid };
  }
  // What a student's invoice starts with: their fees as line items, and payments already received.
  function billing(s) {
    const pr = Number(state.program.price) || 0;
    const items = [{ desc: state.program.program + " — course fee", amt: pr }]
      .concat((s.pay.extras || []).filter(x => x.desc || x.amt).map(x => ({ desc: "Additional training: " + (x.desc || ""), amt: Number(x.amt) || 0 })));
    const payments = [];
    const on = (d) => d ? " (" + fmtDate(d) + ")" : "";
    if (s.pay.depPaid) payments.push({ desc: "Deposit received" + on(s.pay.depDate), amt: deposit() });
    if (s.pay.balPaid) payments.push({ desc: "Balance received" + on(s.pay.balDate), amt: pr - deposit() });
    return { items, payments };
  }
  let toastTimer;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2200); }

  // field builders: data-s = scope (s = student, p = program), data-b = path
  function inp(scope, path, label, type, extra) {
    const src = scope === "p" ? state.program : cur();
    const v = getPath(src, path);
    const id = "f-" + scope + "-" + path.replace(/\./g, "-");
    return `<div class="field ${extra || ""}"><label for="${id}">${esc(label)}</label><input id="${id}" type="${type || "text"}" data-s="${scope}" data-b="${path}" value="${esc(v)}"></div>`;
  }
  function area(scope, path, label, extra) {
    const src = scope === "p" ? state.program : cur();
    const id = "f-" + scope + "-" + path.replace(/\./g, "-");
    return `<div class="field wide ${extra || ""}"><label for="${id}">${esc(label)}</label><textarea id="${id}" data-s="${scope}" data-b="${path}">${esc(getPath(src, path))}</textarea></div>`;
  }
  function cell(path, type, cls, ph) {
    const v = getPath(cur(), path);
    return `<td class="${cls || ""}"><input id="c-${path.replace(/\./g, "-")}" type="${type || "text"}" data-s="s" data-b="${path}" value="${esc(v)}" placeholder="${esc(ph || "")}" aria-label="${esc(ph || path)}"></td>`;
  }
  function statusSel(path, opts, label) {
    const v = getPath(cur(), path) || "";
    return `<select class="st" id="c-${path.replace(/\./g, "-")}" data-s="s" data-b="${path}" data-v="${v}" aria-label="${esc(label)}">` +
      `<option value=""${v ? "" : " selected"}>—</option>` +
      opts.map(o => `<option value="${o}"${v === o ? " selected" : ""}>${o}</option>`).join("") + `</select>`;
  }
  function check(path, label) {
    const v = !!getPath(cur(), path);
    return `<label class="chk"><input type="checkbox" id="c-${path.replace(/\./g, "-")}" data-s="s" data-b="${path}"${v ? " checked" : ""}> ${esc(label)}</label>`;
  }

  // ---------- render ----------
  function render() {
    document.querySelectorAll(".nav .btn[data-mode]").forEach(b => b.classList.toggle("active", b.dataset.mode === view.mode));
    const main = $("#main");
    if (view.mode === "invoices" && window.LDInvoices) {
      main.className = "shell";
      main.innerHTML = window.LDInvoices.render();
      return;
    }
    if (view.mode === "program") {
      main.className = "shell full";
      main.innerHTML = `<section class="panel">${renderProgram()}</section>`;
      return;
    }
    main.className = "shell";
    main.innerHTML = `<aside class="roster no-print">${renderRoster()}</aside><section class="panel" id="record">${renderRecord()}</section>`;
  }

  function renderRoster() {
    const q = view.q.trim().toLowerCase();
    const list = state.students
      .filter(s => !q || (s.name || "").toLowerCase().includes(q))
      .sort((a, b) => (b.dates.d1 || b.created).localeCompare(a.dates.d1 || a.created));
    return `<button class="btn primary" data-act="add">+ New student</button>
      <input type="search" id="roster-q" placeholder="Search students" value="${esc(view.q)}" aria-label="Search students">
      <ul>${list.map(s => {
        const p = progress(s);
        return `<li><button data-act="pick" data-id="${s.id}" class="${s.id === view.sel ? "sel" : ""}">
          <span class="nm">${esc(s.name || "Unnamed student")}</span>
          <span class="meta">${s.dates.d1 ? esc(fmtDate(s.dates.d1)) : "No date set"} · ${p.pct}%${p.r ? " · " + p.r + " R" : ""}</span>
          <span class="bar"><i style="width:${p.pct}%"></i></span></button></li>`;
      }).join("") || `<li class="meta" style="padding:8px 10px">${state.students.length ? "No matches." : "No students yet."}</li>`}</ul>`;
  }

  const TABS = [["details", "Details"], ["skills", "Skill matrix"], ["final", "Final evaluation"], ["dives", "Dive log"], ["remed", "Remediation"], ["pay", "Payment"], ["ack", "Sign-off"], ["proposal", "Proposal"]];

  function renderRecord() {
    const s = cur();
    if (!s) {
      return `<div class="empty"><h2>Start a student record</h2>
        <p>Each record holds the student's details, the required skill matrix, final evaluation, dive log, remediation plan, payments and sign-off.
        It also builds a proposal with the student's name and dates that you can print or save as PDF.</p>
        <button class="btn primary" data-act="add">+ New student</button></div>`;
    }
    const p = progress(s), o = owed(s);
    const body = {
      details: renderDetails, skills: renderSkills, final: renderFinal, dives: renderDives,
      remed: renderRemed, pay: renderPay, ack: renderAck, proposal: () => renderProposalTab(s)
    }[view.tab]();
    return `<div class="rec-head"><h1 id="rec-name">${esc(s.name || "Unnamed student")}</h1>
      <div class="stats">
        <div class="stat"><b id="st-m">${p.m}/${SKILLS.length}</b><span>Skills passed</span></div>
        <div class="stat"><b id="st-f">${p.f}/${FINAL.length}</b><span>Final eval</span></div>
        <div class="stat"><b id="st-r">${p.r}</b><span>Remediation</span></div>
        <div class="stat"><b class="money" id="st-due">${money(o.due)}</b><span>Balance due</span></div>
      </div></div>
      <nav class="tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-act="tab" data-tab="${k}" class="${view.tab === k ? "on" : ""}" aria-selected="${view.tab === k}">${l}</button>`).join("")}</nav>
      <div id="tabbody">${body}</div>`;
  }

  function renderDetails() {
    return `<h2 class="sec">Student</h2><div class="grid">
      ${inp("s", "name", "Full name")}${inp("s", "email", "Email", "email")}${inp("s", "phone", "Phone", "tel")}
      ${inp("s", "emergency", "Emergency contact")}</div>
      <h2 class="sec">Schedule</h2><div class="grid">
      ${inp("s", "dates.d1", "Day 1 — Academics + confined", "date")}${inp("s", "dates.d2", "Day 2 — Open water dives 1 & 2", "date")}
      ${inp("s", "dates.d3", "Day 3 — Open water dives 3 & 4", "date")}${inp("s", "location", "Open water site")}</div>
      <h2 class="sec">Notes</h2><div class="grid">${area("s", "notes", "Instructor notes")}</div>
      <div class="row-actions"><button class="btn danger" data-act="del">Delete this student…</button><span id="del-confirm"></span></div>`;
  }

  function renderSkills() {
    const s = cur();
    return `<p class="hint">NAUI specifies that applicable scuba skills are introduced in confined water and performed in open water. Tick Pass when the skill is mastered.</p>
      <div class="key"><span class="pill IP">IP</span> Introduced / practiced <span class="pill PR">PR</span> Proficient <span class="pill M">M</span> Mastered / pass <span class="pill R">R</span> Remediation required</div>
      <div class="tablewrap"><table class="m"><thead><tr><th>Domain</th><th>Required performance objective</th><th>Confined</th><th>Open water</th><th>Pass</th><th>Initials</th></tr></thead><tbody>
      ${SKILLS.map(([d, t], i) => {
        const r = s.skills[i] || {};
        return `<tr class="${r.m ? "done" : ""}" data-row="${i}"><td class="dom">${esc(d)}</td><td class="obj">${esc(t)}</td>
          <td class="c">${statusSel("skills." + i + ".cw", ["IP", "PR", "R"], "Confined water, " + t)}</td>
          <td class="c">${statusSel("skills." + i + ".ow", ["IP", "PR", "R"], "Open water, " + t)}</td>
          <td class="c">${check("skills." + i + ".m", "M")}</td>${cell("skills." + i + ".ini", "text", "ini", "Init.")}</tr>`;
      }).join("")}</tbody></table></div>`;
  }

  function renderFinal() {
    const s = cur();
    return `<p class="hint">Emergency and final performance skills. Tick Pass when the skill is mastered.</p>
      <div class="key"><span class="pill IP">IP</span> Introduced / practiced <span class="pill PR">PR</span> Proficient <span class="pill M">M</span> Mastered / pass <span class="pill R">R</span> Remediation required</div>
      <div class="tablewrap"><table class="m"><thead><tr><th>Domain</th><th>Required performance objective</th><th>Confined</th><th>Open water</th><th>Pass</th><th>Initials</th></tr></thead><tbody>
      ${FINAL.map(([d, t], i) => {
        const r = s.final[i] || {};
        return `<tr class="${r.m ? "done" : ""}"><td class="dom">${esc(d)}</td><td class="obj">${esc(t)}</td>
          <td class="c">${statusSel("final." + i + ".cw", ["IP", "PR", "R"], "Confined water, " + t)}</td>
          <td class="c">${statusSel("final." + i + ".ow", ["IP", "PR", "R"], "Open water, " + t)}</td>
          <td class="c">${check("final." + i + ".m", "M")}</td>${cell("final." + i + ".ini", "text", "ini", "Init.")}</tr>`;
      }).join("")}</tbody></table></div>`;
  }

  function renderDives() {
    return `<div class="tablewrap"><table class="m"><thead><tr><th>Dive</th><th>Date</th><th>Location</th><th>Max depth</th><th>Duration</th><th>Gas / mix</th><th>Skills / notes</th><th>Initials</th></tr></thead><tbody>
      ${[0, 1, 2, 3].map(i => `<tr><td class="dom">${i + 1}</td>${cell("dives." + i + ".date", "date", "", "Date")}${cell("dives." + i + ".loc", "text", "", "Site")}
        ${cell("dives." + i + ".depth", "text", "", "ft")}${cell("dives." + i + ".dur", "text", "", "min")}${cell("dives." + i + ".gas", "text", "", "Air / EAN32")}
        ${cell("dives." + i + ".notes", "text", "", "Skills, notes")}${cell("dives." + i + ".ini", "text", "ini", "Init.")}</tr>`).join("")}
      </tbody></table></div>`;
  }

  function renderRemed() {
    const s = cur();
    return `<p class="hint">If a required skill is not mastered, document the issue and set a clear corrective plan.</p>
      ${s.remed.length ? `<div class="tablewrap"><table class="m"><thead><tr><th>Skill / issue</th><th>Contributing factor</th><th>Training / corrective action</th><th>Re-evaluation</th><th>Initials</th><th></th></tr></thead><tbody>
      ${s.remed.map((_, i) => `<tr>${cell("remed." + i + ".skill", "text", "", "Skill")}${cell("remed." + i + ".factor", "text", "", "Factor")}${cell("remed." + i + ".action", "text", "", "Plan")}
        ${cell("remed." + i + ".reeval", "date", "", "Re-eval date")}${cell("remed." + i + ".ini", "text", "ini", "Init.")}
        <td><button class="btn small danger" data-act="rm-remed" data-i="${i}" aria-label="Remove row">Remove</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="meta">No remediation items. Nice.</p>`}
      <div class="row-actions"><button class="btn" data-act="add-remed">+ Add remediation item</button></div>`;
  }

  function renderPay() {
    const s = cur(), o = owed(s), pr = Number(state.program.price) || 0;
    return `<h2 class="sec">Deposit — ${money(deposit())} (${esc(state.program.depositPct)}%, non-refundable)</h2>
      <div class="grid">${check("pay.depPaid", "Deposit received")}${inp("s", "pay.depDate", "Date received", "date")}${inp("s", "pay.depMethod", "Method")}</div>
      <h2 class="sec">Balance — ${money(pr - deposit())} (due before open water)</h2>
      <div class="grid">${check("pay.balPaid", "Balance received")}${inp("s", "pay.balDate", "Date received", "date")}${inp("s", "pay.balMethod", "Method")}</div>
      <h2 class="sec">Additional training charges</h2>
      <p class="hint">Not included in the course fee. Discuss with the student before adding a charge.</p>
      ${s.pay.extras.length ? `<div class="tablewrap"><table class="m"><thead><tr><th>Description</th><th>Amount ($)</th><th></th></tr></thead><tbody>
      ${s.pay.extras.map((_, i) => `<tr>${cell("pay.extras." + i + ".desc", "text", "", "Description")}${cell("pay.extras." + i + ".amt", "number", "", "0.00")}
        <td><button class="btn small danger" data-act="rm-extra" data-i="${i}">Remove</button></td></tr>`).join("")}</tbody></table></div>` : ""}
      <div class="row-actions"><button class="btn" data-act="add-extra">+ Add charge</button></div>
      <div class="totals" id="totals">${totalsHtml(o)}</div>`;
  }
  function totalsHtml(o) {
    return `<span>Course fee</span><span class="money">${money(state.program.price)}</span>
      <span>Additional training</span><span class="money">${money(o.extras)}</span>
      <span>Paid</span><span class="money">−${money(o.paid)}</span>
      <span class="grand">Balance due</span><span class="money grand">${money(o.due)}</span>`;
  }

  function renderAck() {
    return `<p class="hint" style="white-space:pre-line">${esc(state.program.acknowledgment)}</p>
      <div class="grid">${check("ack.agreed", "Student has read and agrees")}</div>
      <div class="grid" style="margin-top:14px">${inp("s", "ack.studentName", "Student name (as signed)")}${inp("s", "ack.studentDate", "Student signature date", "date")}
      ${inp("s", "ack.instructorDate", "Instructor signature date", "date")}</div>
      <p class="hint" style="margin-top:14px">Print the proposal from the Proposal tab for wet signatures.</p>`;
  }

  // ---------- program settings ----------
  function renderProgram() {
    const P = state.program;
    return `<div class="rec-head"><h1>Program settings</h1></div>
      <p class="hint">These fields fill every student's proposal. Changes apply to all students.</p>
      <h2 class="sec">Cover</h2><div class="grid">
        ${inp("p", "business", "Business name", "text", "wide")}${inp("p", "docTitle", "Document title")}${inp("p", "program", "Program")}
        ${inp("p", "format", "Format", "text", "wide")}${inp("p", "tagline", "Tagline", "text", "wide")}</div>
      <h2 class="sec">Pricing</h2><div class="grid">${inp("p", "price", "Course fee ($)", "number")}${inp("p", "depositPct", "Deposit (%)", "number")}
        <div class="field"><span class="lbl">Deposit amount</span><b class="money" id="dep-amt">${money(deposit())}</b></div></div>
      <h2 class="sec">Contact</h2><div class="grid">${inp("p", "instructor", "Instructor")}${inp("p", "phone", "Phone", "tel")}${inp("p", "email", "Email", "email")}</div>
      <h2 class="sec">Program structure</h2>
      <div class="tablewrap"><table class="m"><thead><tr><th>Day</th><th>Focus</th><th>Primary objectives</th><th></th></tr></thead><tbody>
        ${P.days.map((_, i) => `<tr>${pcell("days." + i + ".day", "ini")}${pcell("days." + i + ".focus")}${pcell("days." + i + ".obj")}<td><button class="btn small danger" data-act="rm-day" data-i="${i}">Remove</button></td></tr>`).join("")}
      </tbody></table></div><div class="row-actions"><button class="btn" data-act="add-day">+ Add day</button></div>
      <h2 class="sec">Included certifications & materials</h2>
      <div class="tablewrap"><table class="m"><thead><tr><th>Included</th><th>Details</th><th></th></tr></thead><tbody>
        ${P.included.map((_, i) => `<tr>${pcell("included." + i + ".item")}${pcell("included." + i + ".detail")}<td><button class="btn small danger" data-act="rm-inc" data-i="${i}">Remove</button></td></tr>`).join("")}
      </tbody></table></div><div class="row-actions"><button class="btn" data-act="add-inc">+ Add item</button></div>
      <h2 class="sec">Proposal text</h2><div class="grid">
        ${area("p", "philosophy", "Our training philosophy")}${area("p", "standards", "Governing standards")}
        ${area("p", "expectationsCallout", "Performance expectations — highlighted statement")}${area("p", "expectations", "Performance expectations")}
        ${area("p", "commitment", "Instructor commitment")}${area("p", "proficiency", "Proficiency standard")}
        ${area("p", "paymentNotes", "Payment policy (after the deposit sentence)")}${area("p", "acknowledgment", "Student acknowledgment")}</div>
      <div class="row-actions"><button class="btn" data-act="reset-program">Restore original proposal text…</button><span id="reset-confirm"></span></div>`;
  }
  function pcell(path, cls) {
    return `<td class="${cls || ""}"><input id="p-${path.replace(/\./g, "-")}" data-s="p" data-b="${path}" value="${esc(getPath(state.program, path))}" aria-label="${esc(path)}"></td>`;
  }

  // ---------- proposal document ----------
  function renderProposalTab(s) {
    return `<div class="doc-actions"><button class="btn primary" data-act="print">Print / save as PDF</button>
      <span class="hint" style="margin:0">Uses your browser's print dialog. Choose "Save as PDF" to make a file.</span></div>
      ${proposalHtml(s)}`;
  }
  function mark(v) { return v ? esc(v) : "☐"; }
  function proposalHtml(s) {
    const P = state.program;
    const contact = `${esc(P.instructor)} | ${esc(P.phone)} | ${esc(P.email)}`;
    const head = (t) => `<div class="runhead"><span>${esc(P.business)}</span><span>${esc(t)}</span></div>`;
    const dates = [s.dates.d1, s.dates.d2, s.dates.d3].filter(Boolean).map(fmtDate).join(" · ");
    const key = `<p class="key">Evaluation key: IP = Introduced/Practiced · PR = Proficient · M = Mastered/Pass · R = Remediation Required</p>`;
    const o = owed(s);
    return `<article class="doc">
      ${head(P.docTitle)}
      <div class="cover"><h1>${esc(P.business)}</h1><div class="sub">${esc(P.docTitle)}</div><p class="tag">${esc(P.tagline)}</p></div>
      <dl class="facts">
        ${s.name ? `<dt>Prepared for</dt><dd>${esc(s.name)}</dd>` : ""}
        <dt>Program</dt><dd>${esc(P.program)}</dd>
        <dt>Format</dt><dd>${esc(P.format)}</dd>
        ${dates ? `<dt>Training dates</dt><dd>${esc(dates)}</dd>` : ""}
        ${s.location ? `<dt>Open water site</dt><dd>${esc(s.location)}</dd>` : ""}
        <dt>Investment</dt><dd>${money(P.price)}</dd>
        <dt>Contact</dt><dd>${contact}</dd>
      </dl>
      <h2>Our Training Philosophy</h2><p>${esc(P.philosophy)}</p>
      <h2>Governing Standards</h2><p>${esc(P.standards)}</p>
      <h2>Program Structure</h2>
      <div class="tablewrap"><table><thead><tr><th>Day</th><th>Focus</th><th>Primary objectives</th></tr></thead><tbody>
        ${P.days.map((d, i) => { const dt = [s.dates.d1, s.dates.d2, s.dates.d3][i]; return `<tr><td>${esc(d.day)}${dt ? "<br><small>" + esc(fmtDate(dt)) + "</small>" : ""}</td><td>${esc(d.focus)}</td><td>${esc(d.obj)}</td></tr>`; }).join("")}
      </tbody></table></div>
      <h2>Included Certifications &amp; Materials</h2>
      <div class="tablewrap"><table><thead><tr><th>Included</th><th>Details</th></tr></thead><tbody>
        ${P.included.map(x => `<tr><td>${esc(x.item)}</td><td>${esc(x.detail)}</td></tr>`).join("")}</tbody></table></div>
      <h2>Performance Expectations</h2><p class="callout">${esc(P.expectationsCallout)}</p><p>${esc(P.expectations)}</p>
      <h2>Instructor Commitment</h2><p>${esc(P.commitment)}</p>

      <div class="pb"></div>${head("Required Skill Matrix")}
      <h2>Open Water Certification — Required Skill Matrix</h2>
      <p>This matrix is the student's performance checklist. NAUI specifies that applicable scuba skills are introduced in confined water and performed in open water.</p>${key}
      <div class="tablewrap"><table><thead><tr><th>Domain</th><th>Required performance objective</th><th>Confined</th><th>Open water</th><th>Pass</th><th>Initials</th></tr></thead><tbody>
        ${SKILLS.map(([d, t], i) => { const r = s.skills[i] || {}; return `<tr><td>${esc(d)}</td><td>${esc(t)}</td><td class="mk">${mark(r.cw)}</td><td class="mk">${mark(r.ow)}</td><td class="mk">${r.m ? "M ☑" : "☐"}</td><td class="mk">${esc(r.ini || "")}</td></tr>`; }).join("")}
      </tbody></table></div>

      <div class="pb"></div>${head("Emergency & Final Performance")}
      <h2>Emergency &amp; Final Performance Matrix</h2>${key}
      <div class="tablewrap"><table><thead><tr><th>Domain</th><th>Required performance objective</th><th>Confined</th><th>Open water</th><th>Pass</th><th>Initials</th></tr></thead><tbody>
        ${FINAL.map(([d, t], i) => { const r = s.final[i] || {}; return `<tr><td>${esc(d)}</td><td>${esc(t)}</td><td class="mk">${mark(r.cw)}</td><td class="mk">${mark(r.ow)}</td><td class="mk">${r.m ? "M ☑" : "☐"}</td><td class="mk">${esc(r.ini || "")}</td></tr>`; }).join("")}
      </tbody></table></div>
      <h2>Dive-by-Dive Record</h2>
      <div class="tablewrap"><table><thead><tr><th>Dive</th><th>Date</th><th>Location</th><th>Max depth</th><th>Duration</th><th>Gas / mix</th><th>Skills / notes</th><th>Initials</th></tr></thead><tbody>
        ${s.dives.map((d, i) => `<tr><td>${i + 1}</td><td>${esc(fmtDate(d.date))}</td><td>${esc(d.loc)}</td><td>${esc(d.depth)}</td><td>${esc(d.dur)}</td><td>${esc(d.gas)}</td><td>${esc(d.notes)}</td><td class="mk">${esc(d.ini)}</td></tr>`).join("")}
      </tbody></table></div>
      <h2>Proficiency Standard</h2><p>${esc(P.proficiency)}</p>
      <h2>Remediation / Additional Training Plan</h2>
      <p>If a required skill is not mastered, document the issue and establish a clear corrective plan below.</p>
      <div class="tablewrap"><table><thead><tr><th>Skill / issue</th><th>Contributing factor</th><th>Training / corrective action</th><th>Re-evaluation</th><th>Initials</th></tr></thead><tbody>
        ${(s.remed.length ? s.remed : [{}, {}, {}]).map(r => `<tr><td>${esc(r.skill || "")}&nbsp;</td><td>${esc(r.factor || "")}</td><td>${esc(r.action || "")}</td><td>${esc(fmtDate(r.reeval || ""))}</td><td class="mk">${esc(r.ini || "")}</td></tr>`).join("")}
      </tbody></table></div>

      <div class="pb"></div>${head("Course Investment")}
      <h2>Course Investment</h2>
      <div class="tablewrap"><table><thead><tr><th>Description</th><th>Cost</th></tr></thead><tbody>
        <tr><td>${esc(P.program.replace(/^NAUI\s+/, ""))} Program</td><td class="money">${money(P.price)}</td></tr>
        ${P.included.slice(2).map(x => `<tr><td>${esc(x.item)}</td><td>Included</td></tr>`).join("")}
        ${s.pay.extras.filter(x => x.desc || x.amt).map(x => `<tr><td>Additional training: ${esc(x.desc)}</td><td class="money">${money(x.amt)}</td></tr>`).join("")}
        <tr><td><b>TOTAL COURSE FEE</b></td><td class="money"><b>${money(o.total)}</b></td></tr>
      </tbody></table></div>
      <h2>Payment Policy</h2>
      <p>A ${esc(P.depositPct)}% non-refundable deposit of ${money(deposit())} is required to secure training dates. ${esc(P.paymentNotes)}</p>
      <h2>Student Acknowledgment</h2><p>${esc(P.acknowledgment)}</p>
      <div class="sig"><div><b>${esc(s.ack.studentName || s.name)}&nbsp;</b>Student name</div><div><b>&nbsp;</b>Student signature</div><div><b>${esc(fmtDate(s.ack.studentDate))}&nbsp;</b>Date</div></div>
      <div class="sig"><div><b>${esc(P.instructor)}</b>Instructor name</div><div><b>&nbsp;</b>Instructor signature</div><div><b>${esc(fmtDate(s.ack.instructorDate))}&nbsp;</b>Date</div></div>
      <div class="foot">${contact}</div>
    </article>`;
  }

  // ---------- live updates without full re-render ----------
  function refreshSummary() {
    const s = cur(); if (!s || view.mode !== "students") return;
    const p = progress(s), o = owed(s);
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set("rec-name", s.name || "Unnamed student");
    set("st-m", p.m + "/" + SKILLS.length); set("st-f", p.f + "/" + FINAL.length); set("st-r", p.r); set("st-due", money(o.due));
    const t = document.getElementById("totals"); if (t) t.innerHTML = totalsHtml(o);
    const r = document.querySelector(".roster"); if (r) {
      const q = document.getElementById("roster-q"), had = document.activeElement === q;
      r.innerHTML = renderRoster(); if (had) { const nq = document.getElementById("roster-q"); nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); }
    }
  }

  // ---------- events ----------
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (el.id === "roster-q") { view.q = el.value; refreshSummary(); return; }
    if (!el.dataset || !el.dataset.b) return;
    const src = el.dataset.s === "p" ? state.program : cur(); if (!src) return;
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (el.type === "number") v = el.value === "" ? "" : Number(el.value);
    setPath(src, el.dataset.b, v);
    if (el.classList.contains("st")) el.dataset.v = v;
    const tr = el.closest("tr");
    if (tr && /^(skills|final)\.\d+\.m$/.test(el.dataset.b)) tr.classList.toggle("done", !!v);
    if (el.dataset.s === "p") { const d = document.getElementById("dep-amt"); if (d) d.textContent = money(deposit()); }
    save(); refreshSummary();
  });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act],[data-mode]"); if (!b) return;
    if (b.dataset.mode) { view.mode = b.dataset.mode; render(); return; }
    const s = cur(), P = state.program, i = Number(b.dataset.i);
    switch (b.dataset.act) {
      case "add": { const n = blankStudent(); state.students.push(n); view.sel = n.id; view.tab = "details"; view.mode = "students"; save(); render(); const f = document.getElementById("f-s-name"); if (f) f.focus(); break; }
      case "pick": view.sel = b.dataset.id; render(); break;
      case "tab": view.tab = b.dataset.tab; render(); break;
      case "del": $("#del-confirm").innerHTML = `Delete ${esc(s.name || "this student")} for good? <button class="btn small danger" data-act="del-yes">Delete</button> <button class="btn small" data-act="tab" data-tab="details">Keep</button>`; break;
      case "del-yes": state.students = state.students.filter(x => x.id !== s.id); view.sel = state.students[0] ? state.students[0].id : null; save(); render(); toast("Student deleted"); break;
      case "add-remed": s.remed.push({ skill: "", factor: "", action: "", reeval: "", ini: "" }); save(); render(); break;
      case "rm-remed": s.remed.splice(i, 1); save(); render(); break;
      case "add-extra": s.pay.extras.push({ desc: "", amt: "" }); save(); render(); break;
      case "rm-extra": s.pay.extras.splice(i, 1); save(); render(); break;
      case "add-day": P.days.push({ day: String(P.days.length + 1), focus: "", obj: "" }); save(); render(); break;
      case "rm-day": P.days.splice(i, 1); save(); render(); break;
      case "add-inc": P.included.push({ item: "", detail: "" }); save(); render(); break;
      case "rm-inc": P.included.splice(i, 1); save(); render(); break;
      case "reset-program": $("#reset-confirm").innerHTML = `Replace all program settings with the original proposal? <button class="btn small danger" data-act="reset-yes">Restore</button>`; break;
      case "reset-yes": state.program = clone(DEFAULT_PROGRAM); save(); render(); toast("Original proposal text restored"); break;
      case "print": window.print(); break;
      case "export": doExport(); break;
      case "import": $("#import-file").click(); break;
    }
  });

  function doExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "limitless-students-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Backup exported");
  }
  document.addEventListener("change", (e) => {
    if (e.target.id !== "import-file" || !e.target.files[0]) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || !Array.isArray(d.students)) throw new Error("bad");
        localStorage.setItem(STORE_KEY, JSON.stringify(d));
        state = load(); view.sel = state.students[0] ? state.students[0].id : null; view.mode = "students"; render();
        toast("Imported " + state.students.length + " students");
      } catch (err) { toast("That file isn't a backup from this app."); }
      e.target.value = "";
    };
    r.readAsText(e.target.files[0]);
  });

  // Shared helpers for invoice.js
  window.LD = { get state() { return state; }, save, render, toast, esc, money, fmtDate, billing };

  render();
})();
