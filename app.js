/* Limitless Diving — Open Water student records and proposal builder.
   All data is stored in this browser (localStorage). Use Export to back up or move it. */
(function () {
  "use strict";

  const STORE_KEY = "limitless-ow-v1";

  const SKILLS = [
    ["Watermanship", "Novice-level swim stroke proficiency; minimum 15 continuous stroke cycles."],
    ["Watermanship", "Survival swim — 10 minutes."],
    ["Watermanship", "Underwater swim — 15 m / 50 ft. on one breath; no push-off or dive."],
    ["Skin Diving", "Swim 412 m / 450 yd. nonstop breathing from a snorkel (mask, fins, snorkel)."],
    ["Skin Diving", "Entries and exits, surface dives, snorkel clearing, ditching the weight system, and surfacing."],
    ["Equipment", "Assemble, don, and adjust scuba gear."],
    ["Equipment", "Pre-dive buddy check."],
    ["Surface Skills", "Give and recognize surface communications for divers."],
    ["Surface Skills", "Orally inflate and deflate own and buddy's BC."],
    ["Surface Skills", "At the surface, remove and replace (in turn) mask, fins, and scuba unit."],
    ["Surface Skills", "With face submerged, breathe through the snorkel resting and swimming; breathe through water in the snorkel without choking."],
    ["Surface Skills", "Release a simulated muscle cramp from self and buddy."],
    ["Surface Skills", "Deploy and retrieve a surface marker buoy; use a float / diver-down flag where appropriate."],
    ["Communication", "Appropriate underwater communication and hand signals."],
    ["Buoyancy", "Weighting check / appropriate weighting."],
    ["Equalization", "Equalize diver air spaces appropriately during descent."],
    ["Descent / Ascent", "Descend feet first with minimal hand movement, using breath control or BC to control the rate."],
    ["Descent / Ascent", "Ascend at 9 m / 30 ft. per minute or slower and hover at about 4.6 m / 15 ft. for three minutes."],
    ["Breathing", "Comfortably breathe from scuba underwater."],
    ["Surface Skills", "Regulator / snorkel exchange while swimming at the surface."],
    ["Regulator", "Remove, replace, clear, and recover regulator."],
    ["Regulator", "Regain the primary regulator from behind the shoulder, replace, and clear."],
    ["Mask", "Clear a flooded mask."],
    ["Mask", "Remove and replace mask."],
    ["Mask", "Breathe from scuba without a mask."],
    ["Instruments", "Monitor depth, pressure, and timing instruments; communicate information."],
    ["Buoyancy", "Environmentally appropriate buoyancy control."],
    ["Buoyancy", "Hover without support or significant movement."],
    ["Propulsion", "Environmentally appropriate propulsion / finning."],
    ["Ballast", "Remove and replace ballast / weight system as appropriate."],
    ["Equipment", "Remove and replace the scuba unit at the surface and underwater."],
    ["Problem Solving", "Demonstrate underwater problem-solving."],
    ["Surface Buoyancy", "Establish surface buoyancy using power and oral inflation."],
    ["Emergency", "Controlled emergency swimming ascent from minimum 4.6 m / 15 ft. in open water."],
    ["Emergency", "Controlled shared-air ascent from minimum 4.6 m / 15 ft.; donor and receiver."],
    ["Emergency", "In a stationary position, share air in a controlled manner at a minimum of 4.6 m / 15 ft.; donor and receiver."],
    ["Rescue", "Bring simulated unconscious diver to surface from approx. 3 m / 10 ft.; manage equipment and evacuation."],
    ["Buddy / Gas", "Maintain buddy awareness; monitor, communicate, and manage planned minimum gas."],
    ["Navigation", "Use environmental aids and compass to travel to a designated direction/location."],
    ["Navigation", "Set a bearing, follow it, and return on a reciprocal course to approximate starting location."],
    ["Planning", "Measure, record, and calculate individual air consumption (surface air consumption rate)."],
    ["Planning", "Plan and make a no-required-stop dive to 12–18 m / 40–60 ft. including gas, ascent, precautionary stop, and safety margin."],
    ["Planning", "Plan a repetitive no-required-stop dive using tables or an appropriate computer."],
    ["Environment", "Minimize environmental impact and promote conservation."],
    ["Environment", "Recognize and identify representative local plant and animal life."]
  ];

  const FINAL = [
    ["Emergency", "Perform a relaxed, controlled emergency swimming ascent from a minimum of 4.6 m / 15 ft. in open water."],
    ["Air Sharing", "Share air from an octopus / alternate breathing source (not buddy breathing) as donor and receiver during ascent from a minimum of 4.6 m / 15 ft."],
    ["Rescue", "Bring simulated unconscious diver to surface from approx. 3 m / 10 ft.; remove their weight system, remove mask and snorkel if appropriate, blow/tap/talk if trained, and evacuate. No in-water rescue breaths."],
    ["Rescue / Transport", "Transport buddy simulating exhaustion for at least 46 m / 50 yd. while keeping eye-to-eye or voice contact."],
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
    acknowledgment: "I understand that this is a performance-based certification program. I understand that attendance, participation, or completion of scheduled class dates does not guarantee certification. I understand that all required knowledge and skills must be demonstrated to the required level of proficiency.\n\nI understand that if I do not initially master a required skill, my instructor will work with me to establish a reasonable plan for additional practice and evaluation. I understand that certification will not be issued until the required standard has been met.",
    // Optional sections and labels. Every course has these; an empty value leaves that part out of the proposal.
    schedule: "", hours: "", location: "", payment: "", paymentUrl: "",
    feeLabel: "Open Water Scuba Diver + Nitrox Program",
    depositPurpose: "training dates", balanceDue: "due before open water",
    logisticsTitle: "", logistics: "", logisticsCallout: "", logisticsLink: "",
    prereqs: [], topics: "",
    matrixTitle: "Open Water Certification — Required Skill Matrix",
    matrixIntro: "This matrix is the student's performance checklist. NAUI specifies that applicable scuba skills are introduced in confined water and performed in open water.",
    costRows: [{ item: "eLearning", cost: "Included" }, { item: "Instruction", cost: "Included" }, { item: "Certification Processing", cost: "Included" }]
  };

  // ---------- courses ----------
  // Each course is one entry. To add a course, call LD.registerCourse({...}) from a script loaded after app.js,
  // with the same fields as Open Water below. Its settings live in state.programs[id] (Open Water's in state.program).
  const COURSES = {};
  const COURSE_ORDER = [];
  function registerCourse(def) {
    if (!def || !def.id) return;
    if (!COURSES[def.id]) COURSE_ORDER.push(def.id);
    COURSES[def.id] = Object.assign({
      dives: 4, schedule: [], skills: [], final: [], finalTitle: "Final Evaluation", siteLabel: "Open water site",
      // Skill matrix layout. "three": Confined status, Open water status, Pass. "two": first status column, then M (pass).
      cols: "three", colLabels: ["Confined", "Open water"],
      key: "IP = Introduced/Practiced · PR = Proficient · M = Mastered/Pass · R = Remediation Required",
      skillHint: "NAUI specifies that applicable scuba skills are introduced in confined water and performed in open water. Tick Pass when the skill is mastered.",
      unit: "Day", structCols: ["Day", "Focus", "Primary objectives"],
      midDepth: "40 ft", maxDepth: "60 ft", // roster depth scale
      prereqs: [], // per-student prerequisite checklist: { k, label, detail, type }
      diveTab: "Dive log", diveTitle: "Dive-by-Dive Record",
      alwaysRecords: true // false: dive log and remediation appear in the proposal only once filled in
    }, def);
  }
  // A course added after the data loaded: bring its saved records up to its own shape.
  function adoptCourse(id) {
    if (!state) return;
    state.enrollments = state.enrollments.map(e => e.course === id ? mergeDeep(blankEnrollment(e.studentId, id, true), e) : e);
    // Saved settings keep their edits and pick up any setting added since.
    if (COURSES[id].defaults && id !== "open-water") state.programs[id] = Object.assign(clone(COURSES[id].defaults), state.programs[id] || {});
  }
  registerCourse({
    id: "open-water", name: "Open Water", fullName: "Open Water Diver + Nitrox",
    skills: SKILLS, final: FINAL, finalTitle: "Emergency & Final Performance", dives: 4,
    schedule: ["Day 1 — Academics + confined", "Day 2 — Open water dives 1 & 2", "Day 3 — Open water dives 3 & 4"],
    defaults: DEFAULT_PROGRAM, alwaysRecords: true
  });

  // ---------- state ----------
  let state = load();
  let view = { mode: "calendar", sel: firstId(courseList("open-water")), psel: firstId(state.students), tab: "details", q: "", pq: "", enrolling: false };

  function newId(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function firstId(list) { return list[0] ? list[0].id : null; }

  // A person in the shared student directory (used by every course).
  function blankPerson() {
    return {
      id: newId("s"), created: new Date().toISOString(),
      name: "", email: "", phone: "", dob: "", address: "",
      emergencyName: "", emergencyPhone: "", emergencyRel: "",
      medical: "", certAgency: "", certLevel: "", certNumber: "", notes: "",
      accountId: ""   // the student's online account (student-accounts.js), once linked
    };
  }

  // One student's record in one course. course "open-water" is this app's Open Water + Nitrox course.
  function blankEnrollment(studentId, course, noDefaults) {
    const c = COURSES[course || "open-water"] || COURSES["open-water"];
    const days = (!noDefaults && typeof state !== "undefined" && state && P({ course: c.id }).days) || [];
    const dates = {}; c.schedule.forEach((_, i) => { dates["d" + (i + 1)] = (days[i] && days[i].date) || ""; });
    const prereq = {}; c.prereqs.forEach(q => { prereq[q.k] = { ok: false, detail: "" }; });
    return {
      id: newId("e"), studentId: studentId || null, course: c.id, classId: "",
      created: new Date().toISOString(), location: "", notes: "",
      dates, prereq,
      skills: {}, final: {},
      dives: Array.from({ length: c.dives }, () => ({ date: "", loc: "", depth: "", dur: "", gas: "", notes: "", ini: "" })),
      remed: [],
      pay: { depPaid: false, depDate: "", depMethod: "", balPaid: false, balDate: "", balMethod: "", extras: [] },
      ack: { agreed: false, studentName: "", studentDate: "", instructorDate: "" }
    };
  }

  function load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { data = null; }
    if (!data || typeof data !== "object") data = { program: {}, students: [], enrollments: [] };
    data.program = Object.assign(clone(DEFAULT_PROGRAM), data.program || {});
    data.programs = (data.programs && typeof data.programs === "object") ? data.programs : {};
    let students = Array.isArray(data.students) ? data.students : [];
    let enrollments = Array.isArray(data.enrollments) ? data.enrollments : null;
    if (!enrollments) {
      // Migrate the first version, where each student record was also the Open Water course record.
      enrollments = [];
      students = students.map(old => {
        const person = mergeDeep(blankPerson(), { id: old.id, created: old.created, name: old.name, email: old.email, phone: old.phone, emergencyName: old.emergency || "" });
        const e = mergeDeep(blankEnrollment(person.id, "open-water", true), old);
        e.id = newId("e"); e.studentId = person.id; e.course = "open-water";
        ["name", "email", "phone", "emergency"].forEach(k => delete e[k]);
        enrollments.push(e);
        return person;
      });
    }
    data.students = students.map(p => mergeDeep(blankPerson(), p));
    data.enrollments = enrollments.map(e => COURSES[e.course] ? mergeDeep(blankEnrollment(e.studentId, e.course, true), e) : e);
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
  function isCourse(m) { return !!COURSES[m]; }
  function courseList(id) { return state.enrollments.filter(e => e.course === id); }
  function owList() { return courseList(isCourse(view.mode) ? view.mode : "open-water"); }
  function cur() { return state.enrollments.find(e => e.id === view.sel && e.course === view.mode) || null; }
  // C(e): the course definition for an enrollment (or the course on screen). P(e): its program settings.
  function C(e) { return COURSES[(e && e.course) || view.mode] || COURSES["open-water"]; }
  function P_(e) { return P(e); }
  function settingsCourse() { return COURSES[view.settingsCourse] || COURSES["open-water"]; }
  function settingsProgram() { return P({ course: settingsCourse().id }); }
  function settingsDeposit() { return deposit({ course: settingsCourse().id }); }
  function P(e) {
    const id = C(e).id;
    if (id === "open-water") return state.program;
    if (!state.programs[id]) state.programs[id] = clone(C(e).defaults || {});
    return state.programs[id];
  }
  function personById(id) { return state.students.find(p => p.id === id) || null; }
  function curPerson() { return personById(view.psel); }
  function nameOf(e) { const p = e && personById(e.studentId); return (p && p.name) || ""; }
  function srcFor(scope) { return scope === "p" ? settingsProgram() : scope === "d" ? curPerson() : cur(); }
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
  function deposit(e) { const pr = P(e); return Math.round((Number(pr.price) || 0) * (Number(pr.depositPct) || 0)) / 100; }
  function progress(s) {
    const c = C(s), SK = c.skills, FI = c.final;
    const m = SK.filter((_, i) => s.skills[i] && s.skills[i].m).length;
    const f = FI.filter((_, i) => s.final[i] && s.final[i].m).length;
    const r = SK.filter((_, i) => s.skills[i] && (s.skills[i].cw === "R" || s.skills[i].ow === "R")).length
            + FI.filter((_, i) => s.final[i] && (s.final[i].cw === "R" || s.final[i].ow === "R")).length;
    const tot = SK.length + FI.length;
    const q = c.prereqs.filter(x => s.prereq && s.prereq[x.k] && s.prereq[x.k].ok).length;
    return { m, f, r, q, nQ: c.prereqs.length, nS: SK.length, nF: FI.length, pct: tot ? Math.round(((m + f) / tot) * 100) : 0 };
  }
  function owed(s) {
    const extras = (s.pay.extras || []).reduce((a, x) => a + (Number(x.amt) || 0), 0);
    const price = Number(P(s).price) || 0, dep = deposit(s);
    const total = price + extras;
    let paid = 0;
    if (s.pay.depPaid) paid += dep;
    if (s.pay.balPaid) paid += price - dep;
    return { extras, total, paid, due: total - paid };
  }
  // What a student's invoice starts with: their fees as line items, and payments already received.
  // Accepts a course record (enrollment) or a student from the directory; for a student, every course they're in is billed.
  function billing(s) {
    const enrs = s && s.pay ? [s] : state.enrollments.filter(e => s && e.studentId === s.id);
    const items = [], payments = [];
    const on = (d) => d ? " (" + fmtDate(d) + ")" : "";
    enrs.forEach(e => {
      const pr = Number(P(e).price) || 0, dep = deposit(e), label = P(e).program || C(e).fullName || C(e).name;
      items.push({ desc: label + " — course fee", amt: pr });
      (e.pay.extras || []).filter(x => x.desc || x.amt).forEach(x => items.push({ desc: "Additional training: " + (x.desc || ""), amt: Number(x.amt) || 0 }));
      if (e.pay.depPaid) payments.push({ desc: label + " deposit received" + on(e.pay.depDate), amt: dep });
      if (e.pay.balPaid) payments.push({ desc: label + " balance received" + on(e.pay.balDate), amt: pr - dep });
    });
    return { items, payments };
  }
  let toastTimer;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2200); }

  // field builders: data-s = scope (s = student, p = program), data-b = path
  function inp(scope, path, label, type, extra) {
    const v = getPath(srcFor(scope), path);
    const id = "f-" + scope + "-" + path.replace(/\./g, "-");
    return `<div class="field ${extra || ""}"><label for="${id}">${esc(label)}</label><input id="${id}" type="${type || "text"}" data-s="${scope}" data-b="${path}" value="${esc(v)}"></div>`;
  }
  function area(scope, path, label, extra) {
    const id = "f-" + scope + "-" + path.replace(/\./g, "-");
    return `<div class="field wide ${extra || ""}"><label for="${id}">${esc(label)}</label><textarea id="${id}" data-s="${scope}" data-b="${path}">${esc(getPath(srcFor(scope), path))}</textarea></div>`;
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
  function renderNav() {
    const nav = document.getElementById("nav-modes"); if (!nav) return;
    // The left navigation column. Student log in (a link to account.html) sits on top; the rest is grouped.
    // Staff sign in with the Admin Log in button in the header (mode "staff", drawn by student-accounts.js).
    const groups = [
      [null, [["account", "Student log in"]]],
      ["Classes", [["calendar", "Calendar"]]],
      ["Records", [["students", "Students"]].concat(COURSE_ORDER.map(id => [id, COURSES[id].name]))],
      ["Business", [["invoices", "Invoices"], ["program", "Settings"]]]
    ];
    const btn = ([m, l]) => m === "account" ? `<a class="navbtn account" href="account.html">${esc(l)}</a>` : `<button class="navbtn${view.mode === m ? " active" : ""}" data-mode="${m}"${view.mode === m ? ' aria-current="page"' : ""}>${esc(l)}</button>`;
    nav.innerHTML = groups.map(([g, items]) => (g ? `<span class="nav-group">${esc(g)}</span>` : "") + items.map(btn).join("")).join("");
  }
  function render() {
    renderNav();
    const main = $("#main");
    if (view.mode === "calendar") {
      // calendar.js draws the landing page; it loads after this file and calls render() again.
      main.className = "shell single";
      main.innerHTML = window.LDCalendar ? window.LDCalendar.render() : "";
      return;
    }
    if (view.mode === "staff" || view.mode === "account") {
      // Staff sign-in and student account management, drawn by student-accounts.js (window.LDAccount).
      main.className = "shell full";
      main.innerHTML = window.LDAccount ? window.LDAccount.render() : `<section class="panel"><div class="empty"><h2>Student accounts are coming soon</h2>
        <p>Students will be able to create their own account here and keep their name, address, phone, emergency contact and certifications up to date.</p></div></section>`;
      return;
    }
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
    if (view.mode === "students") {
      main.innerHTML = `<aside class="roster no-print">${renderPeopleRoster()}</aside><section class="panel" id="record">${renderPerson()}</section>`;
      return;
    }
    main.innerHTML = `<aside class="roster no-print">${renderRoster()}</aside><section class="panel" id="record">${view.enrolling ? renderEnroll() : renderRecord()}</section>`;
  }

  function renderRoster() {
    const q = view.q.trim().toLowerCase();
    const list = owList()
      .filter(s => !q || nameOf(s).toLowerCase().includes(q))
      .sort((a, b) => (b.dates.d1 || b.created).localeCompare(a.dates.d1 || a.created));
    return `<button class="btn primary" data-act="enroll">+ Enroll a student</button>
      <input type="search" id="roster-q" placeholder="Search ${esc(C().name)} students" value="${esc(view.q)}" aria-label="Search ${esc(C().name)} students">
      <ul>${list.map(s => {
        const p = progress(s);
        return `<li><button data-act="pick" data-id="${s.id}" class="${s.id === view.sel ? "sel" : ""}">
          <span class="nm">${esc(nameOf(s) || "Unnamed student")}</span>
          <span class="meta">${s.dates.d1 ? esc(fmtDate(s.dates.d1)) : "No date set"} · ${p.pct}%${p.r ? " · " + p.r + " R" : ""}</span>
          <span class="bar"><i style="width:${p.pct}%"></i></span></button></li>`;
      }).join("") || `<li class="meta" style="padding:8px 10px">${owList().length ? "No matches." : "No one enrolled yet."}</li>`}</ul>
      <div class="depth" aria-hidden="true"><i></i><div><span>0 ft · surface</span><span>15 ft · safety stop</span><span>${esc(C().midDepth)}</span><span>${esc(C().maxDepth)} · max depth</span></div></div>`;
  }

  function tabsFor(c) {
    return [["details", "Details"], ["skills", "Skill matrix"]]
      .concat(c.final.length ? [["final", "Final evaluation"]] : [])
      .concat([["dives", c.diveTab], ["remed", "Remediation"], ["pay", "Payment"], ["ack", "Sign-off"], ["proposal", "Proposal"]]);
  }

  function renderRecord() {
    const s = cur();
    if (!s) {
      return `<div class="empty"><h2>Enroll a student in ${esc(C().name)}</h2>
        <p>Each ${esc(C().name)} record holds the course schedule, the required skill matrix, ${C().final.length ? "final evaluation, " : ""}${esc(C().diveTab.toLowerCase())}, remediation plan, payments and sign-off.
        It also builds a proposal with the student's name and dates that you can print or save as PDF.</p>
        <button class="btn primary" data-act="enroll">+ Enroll a student</button></div>`;
    }
    const p = progress(s), o = owed(s), TABS = tabsFor(C(s));
    if (!TABS.some(t => t[0] === view.tab)) view.tab = "details";
    const body = {
      details: renderDetails, skills: () => renderMatrix("skills"), final: () => renderMatrix("final"), dives: renderDives,
      remed: renderRemed, pay: renderPay, ack: renderAck, proposal: () => renderProposalTab(s)
    }[view.tab]();
    const dl = C(s).schedule.map((_, i) => s.dates["d" + (i + 1)]).filter(Boolean).map(fmtDate).join(" · ");
    return `${WATERMARK}<div class="rec-head"><div class="who"><span class="eyebrow">${esc(C(s).fullName || C(s).name)}</span>
      <h1 id="rec-name">${esc(nameOf(s) || "Unnamed student")}</h1>
      <span class="sub" id="rec-sub">${esc([dl || "No dates set", s.location].filter(Boolean).join(" · "))}</span></div>
      <div class="stats" id="gauges">${gaugesHtml(p, o)}</div></div>
      <div class="profile" id="profile">${profileHtml(s)}</div>
      <nav class="tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-act="tab" data-tab="${k}" class="${view.tab === k ? "on" : ""}" aria-selected="${view.tab === k}">${esc(l)}</button>`).join("")}</nav>
      <div id="tabbody">${body}</div>`;
  }

  const WATERMARK = `<svg class="watermark" aria-hidden="true" viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" fill="none" stroke-width="3"></circle>${[0, 90, 180, 270].map(a => `<polygon points="100,6 90,100 110,100" stroke="none" transform="rotate(${a} 100 100)"></polygon>`).join("")}${[45, 135, 225, 315].map(a => `<polygon points="100,38 94,100 106,100" stroke="none" transform="rotate(${a} 100 100)"></polygon>`).join("")}</svg>`;
  const ARC = "M 10 50 A 40 40 0 0 1 90 50";
  function gauge(n, of, label, cls) {
    const len = of ? Math.round((n / of) * 126) : 0;
    return `<div class="gauge"><svg role="img" aria-label="${esc(label)} ${n} of ${of}" viewBox="0 0 100 58"><path d="${ARC}" fill="none" class="track" stroke-width="8" stroke-linecap="round"></path>${len ? `<path d="${ARC}" fill="none" class="fill ${cls || ""}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${len} 126"></path>` : ""}<text x="50" y="50" text-anchor="middle">${n}/${of}</text></svg><span>${esc(label)}</span></div>`;
  }
  function gaugesHtml(p, o) {
    return gauge(p.m, p.nS, "Skills passed") + (p.nF ? gauge(p.f, p.nF, "Final eval", "f2") : "") + (p.nQ ? gauge(p.q, p.nQ, "Prerequisites", "f2") : "") +
      `<div class="gauge"><b style="color:${p.r ? "var(--bad)" : "inherit"}">${p.r}</b><span>Remediation</span></div>` +
      `<div class="gauge"><b class="money">${money(o.due)}</b><span>Balance due</span></div>`;
  }
  // Course progress drawn as a dive profile: confined water, then each open water dive.
  function profileHtml(s) {
    const n = s.dives.length, W = 900, step = (W - 60) / (n + 1);
    const confinedDone = Object.values(s.skills || {}).some(r => r && (r.cw === "PR" || r.m));
    const stages = [{ label: "Confined", done: confinedDone, depth: 40 }].concat(
      Array.from({ length: n }, (_, i) => ({ label: "Dive " + (i + 1), done: !!(s.dives[i] && (s.dives[i].date || s.dives[i].ini)), depth: 62 + (i % 2) * 12 })));
    let x = 20, segs = [];
    stages.forEach((st, i) => {
      const x0 = x, x1 = x0 + step * 0.25, x2 = x0 + step * 0.75, x3 = x0 + step;
      segs.push({ d: `M ${x0} 14 L ${x1} ${st.depth} L ${x2} ${st.depth} L ${x3} 14`, done: st.done, cx: (x1 + x2) / 2, depth: st.depth, label: st.label });
      x = x3 + 6;
    });
    const doneCount = stages.filter(st => st.done).length;
    return `<span class="lbl">Course profile · ${doneCount} of ${stages.length} stages</span>
      <svg role="img" aria-label="Course profile: ${doneCount} of ${stages.length} stages done" viewBox="0 0 ${W} 92" preserveAspectRatio="none">
      <line x1="0" y1="14" x2="${W}" y2="14" class="surf" stroke-width="2" stroke-dasharray="4 6"></line>
      ${segs.map(g => `<path d="${g.d}" fill="none" class="${g.done ? "done" : "todo"}" stroke-width="3" stroke-linejoin="round"${g.done ? "" : ' stroke-dasharray="6 6"'}></path>
        <circle cx="${g.cx}" cy="${g.depth}" r="6" class="${g.done ? "dot-done" : "dot-todo"}" stroke-width="2"></circle>
        <text x="${g.cx}" y="${g.depth > 60 ? g.depth - 12 : g.depth + 22}" text-anchor="middle">${esc(g.label)}</text>`).join("")}
      </svg>`;
  }

  function renderDetails() {
    const s = cur(), p = personById(s.studentId);
    const opts = state.students.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      .map(x => `<option value="${x.id}"${x.id === s.studentId ? " selected" : ""}>${esc(x.name || "Unnamed student")}</option>`).join("");
    return `<h2 class="sec">Student</h2><div class="grid">
      <div class="field"><label for="enr-student">Student</label><select id="enr-student" data-act-change="set-student"><option value="">Choose a student</option>${opts}</select></div>
      <div class="field"><span class="lbl">Contact</span><span>${p ? esc([p.phone, p.email].filter(Boolean).join(" · ") || "No contact info yet") : "—"}</span></div>
      </div>
      <div class="row-actions">${p ? `<button class="btn" data-act="open-person" data-id="${p.id}">Edit student info</button>` : ""}</div>
      ${C().prereqs.length ? `<h2 class="sec">Prerequisites</h2><div class="prq">${C().prereqs.map(q =>
        `<div class="prq-row">${check("prereq." + q.k + ".ok", q.label)}${inp("s", "prereq." + q.k + ".detail", q.detail, q.type || "text")}</div>`).join("")}</div>` : ""}
      <h2 class="sec">Schedule</h2>${classLine(s)}<div class="grid">
      ${C().schedule.map((lbl, i) => inp("s", "dates.d" + (i + 1), lbl, "date")).join("")}${inp("s", "location", C().siteLabel + (P().location ? " (if not " + P().location + ")" : ""))}</div>
      <h2 class="sec">Notes</h2><div class="grid">${area("s", "notes", "Instructor notes")}</div>
      <div class="row-actions"><button class="btn danger" data-act="del">Remove from ${esc(C().name)}…</button><span id="del-confirm"></span></div>`;
  }

  // The calendar class this course record belongs to (set when the student is enrolled from the calendar).
  function classLine(s) {
    const k = s.classId && Array.isArray(state.classes) && state.classes.find(x => x.id === s.classId);
    if (!k) return "";
    const ds = (k.dates || []).filter(Boolean);
    return `<p class="hint">Class: <b>${esc(k.title || C().fullName || C().name)}</b>${ds.length ? " · " + esc(fmtDate(ds[0])) + (ds.length > 1 ? " – " + esc(fmtDate(ds[ds.length - 1])) : "") : ""}
      <button class="btn small" data-cact="pick" data-id="${k.id}">Open in calendar</button></p>`;
  }
  // Enroll a student in a calendar class: reuse their record for that course if it has no class yet, otherwise start one.
  // The class's dates and location fill the record's schedule.
  function enrollInClass(studentId, k) {
    const c = COURSES[k.course]; if (!c) return null;
    let e = state.enrollments.find(x => x.studentId === studentId && x.course === k.course && !x.classId);
    if (!e) { e = blankEnrollment(studentId, k.course); state.enrollments.push(e); }
    e.classId = k.id;
    c.schedule.forEach((_, i) => { if (k.dates && k.dates[i]) e.dates["d" + (i + 1)] = k.dates[i]; });
    if (k.location && !e.location) e.location = k.location;
    save();
    return e;
  }
  function addStudent() { const n = blankPerson(); state.students.push(n); save(); return n; }
  function go(mode, opts) {
    view.mode = mode; view.enrolling = false;
    if (opts && opts.psel) view.psel = opts.psel;
    if (opts && opts.sel) { view.sel = opts.sel; view.tab = "details"; }
    if (isCourse(view.mode) && !cur()) view.sel = firstId(courseList(view.mode));
    render();
    if (opts && opts.focus) { const f = document.getElementById(opts.focus); if (f) f.focus(); }
  }

  const KEY_HTML = `<div class="key"><span class="pill IP">IP</span> Introduced / practiced <span class="pill PR">PR</span> Proficient <span class="pill M">M</span> Mastered / pass <span class="pill R">R</span> Remediation required</div>`;
  function matrixHead(c) {
    return `<th>Domain</th><th>Required performance objective</th><th>${esc(c.colLabels[0])}</th><th>${esc(c.colLabels[1])}</th>${c.cols === "three" ? "<th>Pass</th>" : ""}<th>Initials</th>`;
  }
  function renderMatrix(group) {
    const s = cur(), c = C(s), list = c[group];
    const hint = group === "final" ? "Emergency and final performance skills. Tick Pass when the skill is mastered." : c.skillHint;
    return `<p class="hint">${esc(hint)}</p>${KEY_HTML}
      <div class="tablewrap"><table class="m"><thead><tr>${matrixHead(c)}</tr></thead><tbody>
      ${list.map(([d, t], i) => {
        const r = s[group][i] || {}, b = group + "." + i;
        const mid = c.cols === "three"
          ? `<td class="c">${statusSel(b + ".cw", ["IP", "PR", "R"], c.colLabels[0] + ", " + t)}</td>
          <td class="c">${statusSel(b + ".ow", ["IP", "PR", "R"], c.colLabels[1] + ", " + t)}</td>
          <td class="c">${check(b + ".m", "M")}</td>`
          : `<td class="c">${statusSel(b + ".cw", ["IP", "PR", "R"], c.colLabels[0] + ", " + t)}</td>
          <td class="c">${check(b + ".m", "M")}</td>`;
        return `<tr class="${r.m ? "done" : ""}" data-row="${i}"><td class="dom">${esc(d)}</td><td class="obj">${esc(t)}</td>
          ${mid}${cell(b + ".ini", "text", "ini", "Init.")}</tr>`;
      }).join("")}</tbody></table></div>`;
  }

  function renderDives() {
    return `<div class="tablewrap"><table class="m"><thead><tr><th>Dive</th><th>Date</th><th>Location</th><th>Max depth</th><th>Duration</th><th>Gas / mix</th><th>Skills / notes</th><th>Initials</th><th></th></tr></thead><tbody>
      ${cur().dives.map((_, i) => i).map(i => `<tr><td class="dom">${i + 1}</td>${cell("dives." + i + ".date", "date", "", "Date")}${cell("dives." + i + ".loc", "text", "", "Site")}
        ${cell("dives." + i + ".depth", "text", "", "ft")}${cell("dives." + i + ".dur", "text", "", "min")}${cell("dives." + i + ".gas", "text", "", "Air / EAN32")}
        ${cell("dives." + i + ".notes", "text", "", "Skills, notes")}${cell("dives." + i + ".ini", "text", "ini", "Init.")}
        <td>${i >= C().dives && i === cur().dives.length - 1 ? `<button class="btn small danger" data-act="rm-dive" data-i="${i}">Remove</button>` : ""}</td></tr>`).join("")}
      </tbody></table></div>
      <div class="row-actions"><button class="btn" data-act="add-dive">+ Add dive</button></div>`;
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
    const s = cur(), o = owed(s), pr = Number(P().price) || 0;
    return `<h2 class="sec">Deposit — ${money(deposit())} (${esc(P().depositPct)}%, non-refundable)</h2>
      <div class="grid">${check("pay.depPaid", "Deposit received")}${inp("s", "pay.depDate", "Date received", "date")}${inp("s", "pay.depMethod", "Method")}</div>
      <h2 class="sec">Balance — ${money(pr - deposit())} (${esc(P().balanceDue || "due before open water")})</h2>
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
    return `<span>Course fee</span><span class="money">${money(P().price)}</span>
      <span>Additional training</span><span class="money">${money(o.extras)}</span>
      <span>Paid</span><span class="money">−${money(o.paid)}</span>
      <span class="grand">Balance due</span><span class="money grand">${money(o.due)}</span>`;
  }

  function renderAck() {
    return `<p class="hint" style="white-space:pre-line">${esc(P().acknowledgment)}</p>
      <div class="grid">${check("ack.agreed", "Student has read and agrees")}</div>
      <div class="grid" style="margin-top:14px">${inp("s", "ack.studentName", "Student name (as signed)")}${inp("s", "ack.studentDate", "Student signature date", "date")}
      ${inp("s", "ack.instructorDate", "Instructor signature date", "date")}</div>
      <p class="hint" style="margin-top:14px">Print the proposal from the Proposal tab for wet signatures.</p>`;
  }

  // ---------- shared student directory ----------
  function renderPeopleRoster() {
    const q = view.pq.trim().toLowerCase();
    const list = state.students.filter(p => !q || [p.name, p.email, p.phone].join(" ").toLowerCase().includes(q))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return `<button class="btn primary" data-act="add-person">+ New student</button>
      <input type="search" id="people-q" placeholder="Search by name, email or phone" value="${esc(view.pq)}" aria-label="Search students">
      <ul>${list.map(p => {
        const n = state.enrollments.filter(e => e.studentId === p.id).length;
        return `<li><button data-act="pick-person" data-id="${p.id}" class="${p.id === view.psel ? "sel" : ""}">
          <span class="nm">${esc(p.name || "Unnamed student")}</span>
          <span class="meta">${esc(p.phone || p.email || "No contact info")} · ${n} course${n === 1 ? "" : "s"}</span></button></li>`;
      }).join("") || `<li class="meta" style="padding:8px 10px">${state.students.length ? "No matches." : "No students yet."}</li>`}</ul>`;
  }
  function renderPerson() {
    const p = curPerson();
    if (!p) {
      return `<div class="empty"><h2>Add your first student</h2>
        <p>Enter a student's contact, emergency, medical and certification information once. Every course uses it.</p>
        <button class="btn primary" data-act="add-person">+ New student</button></div>`;
    }
    const enr = state.enrollments.filter(e => e.studentId === p.id);
    const notIn = COURSE_ORDER.filter(id => !enr.some(e => e.course === id));
    return `${WATERMARK}<div class="rec-head"><h1 id="person-name">${esc(p.name || "Unnamed student")}</h1></div>
      ${window.LDAccount ? window.LDAccount.personNote(p) : ""}
      <h2 class="sec">Contact</h2><div class="grid">
        ${inp("d", "name", "Full name")}${inp("d", "dob", "Date of birth", "date")}${inp("d", "email", "Email", "email")}${inp("d", "phone", "Phone", "tel")}
        ${inp("d", "address", "Mailing address", "text", "wide")}</div>
      <h2 class="sec">Emergency contact</h2><div class="grid">
        ${inp("d", "emergencyName", "Name")}${inp("d", "emergencyRel", "Relationship")}${inp("d", "emergencyPhone", "Phone", "tel")}</div>
      <h2 class="sec">Medical</h2><div class="grid">${area("d", "medical", "Medical notes (conditions, medications, physician clearance)")}</div>
      <h2 class="sec">Current certification</h2><div class="grid">
        ${inp("d", "certAgency", "Agency")}${inp("d", "certLevel", "Level")}${inp("d", "certNumber", "Cert number")}</div>
      <h2 class="sec">Notes</h2><div class="grid">${area("d", "notes", "Notes")}</div>
      <h2 class="sec">Courses</h2>
      ${enr.length ? `<div class="tablewrap"><table class="m"><thead><tr><th>Course</th><th>Start date</th><th>Progress</th><th>Balance due</th><th></th></tr></thead><tbody>
        ${enr.map(e => {
          const known = !!COURSES[e.course];
          return `<tr><td>${esc(known ? (COURSES[e.course].fullName || COURSES[e.course].name) : e.course)}</td><td>${esc(fmtDate(e.dates && e.dates.d1) || "Not set")}</td>
            <td>${known ? progress(e).pct + "%" : ""}</td><td class="money">${known ? money(owed(e).due) : ""}</td>
            <td>${known ? `<button class="btn small" data-act="open-enr" data-id="${e.id}">Open</button>` : ""}</td></tr>`;
        }).join("")}</tbody></table></div>` : `<p class="hint">Not enrolled in any course yet.</p>`}
      <div class="row-actions">${notIn.map(id => `<button class="btn" data-act="enroll-go" data-id="${p.id}" data-course="${id}">Enroll in ${esc(COURSES[id].name)}</button>`).join("")}</div>
      <div class="row-actions"><button class="btn danger" data-act="del-person">Delete this student…</button><span id="pdel-confirm"></span></div>`;
  }
  function refreshPeople() {
    const p = curPerson();
    const h = document.getElementById("person-name"); if (h && p) h.textContent = p.name || "Unnamed student";
    const r = document.querySelector(".roster"); if (!r) return;
    const q = document.getElementById("people-q"), had = document.activeElement === q;
    r.innerHTML = renderPeopleRoster();
    if (had) { const nq = document.getElementById("people-q"); nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); }
  }
  function renderEnroll() {
    const enrolled = new Set(owList().map(e => e.studentId));
    const avail = state.students.filter(p => !enrolled.has(p.id)).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return `<div class="rec-head"><h1>Enroll in ${esc(C().fullName || C().name)}</h1></div>
      ${avail.length ? `<div class="grid"><div class="field"><label for="enroll-pick">Existing student</label>
        <select id="enroll-pick"><option value="">Choose a student</option>${avail.map(p => `<option value="${p.id}">${esc(p.name || "Unnamed student")}</option>`).join("")}</select></div></div>
        <div class="row-actions"><button class="btn primary" data-act="enroll-go">Enroll</button></div>
        <p class="hint" style="margin-top:18px">Or add someone who isn't in your student list yet:</p>` : `<p class="hint">Everyone in your student list is already enrolled. Add a new student:</p>`}
      <div class="row-actions"><button class="btn" data-act="enroll-new">+ New student and enroll</button><button class="btn" data-act="enroll-cancel">Cancel</button></div>`;
  }

  // ---------- program settings ----------
  function renderProgram() {
    const P = settingsProgram(), sc = settingsCourse();
    const picker = COURSE_ORDER.length > 1 ? `<div class="field" style="max-width:320px"><label for="settings-course">Course</label><select id="settings-course">${COURSE_ORDER.map(id => `<option value="${id}"${id === sc.id ? " selected" : ""}>${esc(COURSES[id].fullName || COURSES[id].name)}</option>`).join("")}</select></div>` : "";
    return `<div class="rec-head"><h1>Settings — ${esc(sc.fullName || sc.name)}</h1></div>${picker}
      <p class="hint">These fields fill every ${esc(sc.name)} student's proposal. Changes apply to all of them.</p>
      <h2 class="sec">Cover</h2><div class="grid">
        ${inp("p", "business", "Business name", "text", "wide")}${inp("p", "docTitle", "Document title")}${inp("p", "program", "Program")}
        ${inp("p", "format", "Format", "text", "wide")}${inp("p", "tagline", "Tagline", "text", "wide")}
        ${inp("p", "schedule", "Schedule (shown when a student has no dates)", "text", "wide")}${inp("p", "hours", "Daily hours")}${inp("p", "location", "Location")}</div>
      <h2 class="sec">Pricing &amp; payment</h2><div class="grid">${inp("p", "price", "Course fee ($)", "number")}${inp("p", "depositPct", "Deposit (%)", "number")}
        <div class="field"><span class="lbl">Deposit amount</span><b class="money" id="dep-amt">${money(settingsDeposit())}</b></div>
        ${inp("p", "feeLabel", "Course fee line in Course Investment", "text", "wide")}
        ${inp("p", "depositPurpose", "Deposit secures…")}${inp("p", "balanceDue", "Balance is…")}
        ${inp("p", "payment", "Payments accepted via")}${inp("p", "paymentUrl", "Payment link", "url")}</div>
      <h2 class="sec">Contact</h2><div class="grid">${inp("p", "instructor", "Instructor")}${inp("p", "phone", "Phone", "tel")}${inp("p", "email", "Email", "email")}</div>
      <h2 class="sec">Program structure</h2>
      <p class="hint">A default date fills that ${esc(sc.unit.toLowerCase())} in for each new enrollment.</p>
      ${rowsTable(P.days, "days", sc.structCols.concat(["Default date"]), ["day", "focus", "obj", "date"], "day", sc.unit.toLowerCase())}
      <h2 class="sec">Included certifications &amp; materials</h2>
      ${rowsTable(P.included, "included", ["Included", "Details"], ["item", "detail"], "inc", "item")}
      <h2 class="sec">Prerequisites</h2>
      ${rowsTable(P.prereqs, "prereqs", ["Requirement", "Detail"], ["item", "detail"], "prq", "prerequisite")}
      <h2 class="sec">Course investment lines</h2>
      ${rowsTable(P.costRows, "costRows", ["Description", "Cost"], ["item", "cost"], "cost", "line")}
      <h2 class="sec">Proposal text</h2>
      <p class="hint">Leave a section empty to leave it out of the proposal.</p><div class="grid">
        ${area("p", "philosophy", "Our training philosophy")}${area("p", "standards", "Governing standards")}
        ${inp("p", "logisticsTitle", "Logistics heading", "text", "wide")}${area("p", "logistics", "Logistics")}
        ${area("p", "logisticsCallout", "Logistics — highlighted statement")}${inp("p", "logisticsLink", "Logistics link (e.g. lake tickets)", "url", "wide")}
        ${area("p", "topics", "What you'll learn — one topic per line")}
        ${area("p", "expectationsCallout", "Performance expectations — highlighted statement")}${area("p", "expectations", "Performance expectations")}
        ${area("p", "commitment", "Instructor commitment")}
        ${inp("p", "matrixTitle", "Skill matrix heading", "text", "wide")}${area("p", "matrixIntro", "Skill matrix introduction")}
        ${area("p", "proficiency", "Proficiency standard")}
        ${area("p", "paymentNotes", "Payment policy (after the deposit sentence)")}${area("p", "acknowledgment", "Student acknowledgment")}</div>
      <div class="row-actions"><button class="btn" data-act="reset-program">Restore original proposal text…</button><span id="reset-confirm"></span></div>`;
  }
  // An editable list in settings (rows of inputs, a Remove button per row, and an Add button).
  function rowsTable(list, base, heads, keys, act, noun) {
    return `<div class="tablewrap"><table class="m"><thead><tr>${heads.map(h => `<th>${esc(h)}</th>`).join("")}<th></th></tr></thead><tbody>
      ${(list || []).map((_, i) => `<tr>${keys.map(k => pcell(base + "." + i + "." + k, k === "day" ? "ini" : "", k === "date" ? "date" : "text")).join("")}<td><button class="btn small danger" data-act="rm-row" data-list="${base}" data-i="${i}">Remove</button></td></tr>`).join("")}
      </tbody></table></div><div class="row-actions"><button class="btn" data-act="add-row" data-list="${base}">+ Add ${esc(noun)}</button></div>`;
  }
  function pcell(path, cls, type) {
    return `<td class="${cls || ""}"><input id="p-${path.replace(/\./g, "-")}" type="${type || "text"}" data-s="p" data-b="${path}" value="${esc(getPath(settingsProgram(), path))}" aria-label="${esc(path)}"></td>`;
  }

  // ---------- proposal document ----------
  function renderProposalTab(s) {
    return `<div class="doc-actions"><button class="btn primary" data-act="print">Print / save as PDF</button>
      <span class="hint" style="margin:0">Uses your browser's print dialog. Choose "Save as PDF" to make a file.</span></div>
      ${proposalHtml(s)}`;
  }
  function mark(v) { return v ? esc(v) : "☐"; }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || "")) ? String(u) : ""; }
  function linkOrText(text, url) { const u = safeUrl(url); return u ? `<a href="${esc(u)}">${esc(text)}</a>` : esc(text); }
  function para(t) { return t ? `<p>${esc(t)}</p>` : ""; }
  function matrixDoc(c, list, rows) {
    return `<div class="tablewrap"><table><thead><tr>${matrixHead(c)}</tr></thead><tbody>
      ${list.map(([d, t], i) => {
        const r = rows[i] || {};
        const mid = c.cols === "three" ? `<td class="mk">${mark(r.cw)}</td><td class="mk">${mark(r.ow)}</td><td class="mk">${r.m ? "M ☑" : "☐"}</td>` : `<td class="mk">${mark(r.cw)}</td><td class="mk">${r.m ? "M ☑" : "☐"}</td>`;
        return `<tr><td>${esc(d)}</td><td>${esc(t)}</td>${mid}<td class="mk">${esc(r.ini || "")}</td></tr>`;
      }).join("")}</tbody></table></div>`;
  }
  function proposalHtml(s) {
    const P = P_(s), c = C(s);
    const contact = `${esc(P.instructor)} | ${esc(P.phone)} | ${esc(P.email)}`;
    const head = (t) => `<div class="runhead"><span>${esc(P.business)}</span><span>${esc(t)}</span></div>`;
    const dlist = c.schedule.map((_, i) => s.dates["d" + (i + 1)]);
    const dates = dlist.filter(Boolean).map(fmtDate).join(" · ");
    const when = dates ? dates + (P.hours ? " | " + P.hours : "") : "";
    const loc = s.location || P.location;
    const key = `<p class="key">Evaluation key: ${esc(c.key)}</p>`;
    const o = owed(s);
    const showDives = c.alwaysRecords || s.dives.some(d => Object.values(d).some(Boolean));
    const showRemed = c.alwaysRecords || s.remed.length;
    const topics = String(P.topics || "").split("\n").map(x => x.trim()).filter(Boolean);
    const prereqs = P.prereqs || [], costRows = P.costRows || [];
    return `<article class="doc">
      ${head(P.docTitle)}
      <div class="cover"><h1>${esc(P.business)}</h1><div class="sub">${esc(P.docTitle)}</div><p class="tag">${esc(P.tagline)}</p></div>
      <dl class="facts">
        ${nameOf(s) ? `<dt>Prepared for</dt><dd>${esc(nameOf(s))}</dd>` : ""}
        <dt>Program</dt><dd>${esc(P.program)}</dd>
        <dt>Format</dt><dd>${esc(P.format)}</dd>
        ${when ? `<dt>${P.hours ? "Dates &amp; times" : "Training dates"}</dt><dd>${esc(when)}</dd>` : (P.schedule ? `<dt>Schedule</dt><dd>${esc(P.schedule)}${P.hours ? " | " + esc(P.hours) : ""}</dd>` : "")}
        ${loc ? `<dt>${esc(c.siteLabel)}</dt><dd>${esc(loc)}</dd>` : ""}
        <dt>Investment</dt><dd>${money(P.price)}</dd>
        ${P.payment ? `<dt>Payment</dt><dd>${linkOrText(P.payment, P.paymentUrl)}</dd>` : ""}
        <dt>Contact</dt><dd>${contact}</dd>
      </dl>
      ${P.philosophy ? `<h2>Our Training Philosophy</h2>${para(P.philosophy)}` : ""}
      ${P.standards ? `<h2>Governing Standards</h2>${para(P.standards)}` : ""}
      ${P.logistics || P.logisticsCallout ? `<h2>${esc(P.logisticsTitle || "Location & Logistics")}</h2>${para(P.logistics)}
        ${safeUrl(P.logisticsLink) ? `<p><b>Tickets / info:</b> ${linkOrText(P.logisticsLink.replace(/^https?:\/\//i, "").replace(/\/$/, ""), P.logisticsLink)}</p>` : ""}
        ${P.logisticsCallout ? `<p class="callout">${esc(P.logisticsCallout)}</p>` : ""}` : ""}
      <h2>Program Structure</h2>
      <div class="tablewrap"><table><thead><tr>${c.structCols.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>
        ${P.days.map((d, i) => { const dt = dlist[i]; return `<tr><td>${esc(d.day)}${dt ? "<br><small>" + esc(fmtDate(dt)) + "</small>" : ""}</td><td>${esc(d.focus)}</td><td>${esc(d.obj)}</td></tr>`; }).join("")}
      </tbody></table></div>
      <h2>Included Certifications &amp; Materials</h2>
      <div class="tablewrap"><table><thead><tr><th>Included</th><th>Details</th></tr></thead><tbody>
        ${P.included.map(x => `<tr><td>${esc(x.item)}</td><td>${esc(x.detail)}</td></tr>`).join("")}</tbody></table></div>
      ${prereqs.length ? `<h2>Prerequisites</h2>
      <div class="tablewrap"><table><thead><tr><th>Requirement</th><th>Detail</th></tr></thead><tbody>
        ${prereqs.map(x => `<tr><td>${esc(x.item)}</td><td>${esc(x.detail)}</td></tr>`).join("")}</tbody></table></div>` : ""}
      ${topics.length ? `<h2>What You'll Learn — Academic Topics</h2><ul>${topics.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      <h2>Performance Expectations</h2>${P.expectationsCallout ? `<p class="callout">${esc(P.expectationsCallout)}</p>` : ""}${para(P.expectations)}
      ${P.commitment ? `<h2>Instructor Commitment</h2>${para(P.commitment)}` : ""}

      <div class="pb"></div>${head("Required Skill Matrix")}
      <h2>${esc(P.matrixTitle || c.name + " — Required Skill Matrix")}</h2>${para(P.matrixIntro)}${key}
      ${matrixDoc(c, c.skills, s.skills)}

      ${c.final.length ? `<div class="pb"></div>${head(c.finalTitle)}
      <h2>${esc(c.finalTitle)} Matrix</h2>${key}${matrixDoc(c, c.final, s.final)}` : ""}
      ${showDives ? `<h2>${esc(c.diveTitle)}</h2>
      <div class="tablewrap"><table><thead><tr><th>Dive</th><th>Date</th><th>Location</th><th>Max depth</th><th>Duration</th><th>Gas / mix</th><th>Skills / notes</th><th>Initials</th></tr></thead><tbody>
        ${s.dives.map((d, i) => `<tr><td>${i + 1}</td><td>${esc(fmtDate(d.date))}</td><td>${esc(d.loc)}</td><td>${esc(d.depth)}</td><td>${esc(d.dur)}</td><td>${esc(d.gas)}</td><td>${esc(d.notes)}</td><td class="mk">${esc(d.ini)}</td></tr>`).join("")}
      </tbody></table></div>` : ""}
      ${P.proficiency ? `<h2>Proficiency Standard</h2>${para(P.proficiency)}` : ""}
      ${showRemed ? `<h2>Remediation / Additional Training Plan</h2>
      <p>If a required skill is not mastered, document the issue and establish a clear corrective plan below.</p>
      <div class="tablewrap"><table><thead><tr><th>Skill / issue</th><th>Contributing factor</th><th>Training / corrective action</th><th>Re-evaluation</th><th>Initials</th></tr></thead><tbody>
        ${(s.remed.length ? s.remed : [{}, {}, {}]).map(r => `<tr><td>${esc(r.skill || "")}&nbsp;</td><td>${esc(r.factor || "")}</td><td>${esc(r.action || "")}</td><td>${esc(fmtDate(r.reeval || ""))}</td><td class="mk">${esc(r.ini || "")}</td></tr>`).join("")}
      </tbody></table></div>` : ""}

      <div class="pb"></div>${head("Course Investment")}
      <h2>Course Investment</h2>
      <div class="tablewrap"><table><thead><tr><th>Description</th><th>Cost</th></tr></thead><tbody>
        <tr><td>${esc(P.feeLabel || P.program)}</td><td class="money">${money(P.price)}</td></tr>
        ${costRows.map(x => `<tr><td>${esc(x.item)}</td><td>${esc(x.cost)}</td></tr>`).join("")}
        ${s.pay.extras.filter(x => x.desc || x.amt).map(x => `<tr><td>Additional training: ${esc(x.desc)}</td><td class="money">${money(x.amt)}</td></tr>`).join("")}
        <tr><td><b>TOTAL COURSE FEE</b></td><td class="money"><b>${money(o.total)}</b></td></tr>
      </tbody></table></div>
      <h2>Payment Policy</h2>
      <p>A ${esc(P.depositPct)}% non-refundable deposit of ${money(deposit(s))} is required to secure ${esc(P.depositPurpose || "training dates")}. ${esc(P.paymentNotes)}</p>
      ${P.payment ? `<p><b>Payments accepted via ${linkOrText(P.payment, P.paymentUrl)}</b></p>` : ""}
      <h2>Student Acknowledgment</h2>${para(P.acknowledgment)}
      <div class="sig"><div><b>${esc(s.ack.studentName || nameOf(s))}&nbsp;</b>Student name</div><div><b>&nbsp;</b>Student signature</div><div><b>${esc(fmtDate(s.ack.studentDate))}&nbsp;</b>Date</div></div>
      <div class="sig"><div><b>${esc(P.instructor)}</b>Instructor name</div><div><b>&nbsp;</b>Instructor signature</div><div><b>${esc(fmtDate(s.ack.instructorDate))}&nbsp;</b>Date</div></div>
      <div class="foot">${contact}</div>
    </article>`;
  }

  // ---------- live updates without full re-render ----------
  function refreshSummary() {
    if (view.mode === "students") { refreshPeople(); return; }
    const s = cur(); if (!s || !isCourse(view.mode)) return;
    const p = progress(s), o = owed(s);
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set("rec-name", nameOf(s) || "Unnamed student");
    const g = document.getElementById("gauges"); if (g) g.innerHTML = gaugesHtml(p, o);
    const pf = document.getElementById("profile"); if (pf) pf.innerHTML = profileHtml(s);
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
    if (el.id === "settings-course") { view.settingsCourse = el.value; render(); return; }
    if (el.id === "people-q") { view.pq = el.value; refreshPeople(); return; }
    if (el.id === "enr-student") {
      const s = cur(); if (s) { s.studentId = el.value || null; save(); render(); }
      return;
    }
    if (!el.dataset || !el.dataset.b) return;
    const src = srcFor(el.dataset.s); if (!src) return;
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (el.type === "number") v = el.value === "" ? "" : Number(el.value);
    setPath(src, el.dataset.b, v);
    if (el.classList.contains("st")) el.dataset.v = v;
    const tr = el.closest("tr");
    if (tr && /^(skills|final)\.\d+\.m$/.test(el.dataset.b)) tr.classList.toggle("done", !!v);
    if (el.dataset.s === "p") { const d = document.getElementById("dep-amt"); if (d) d.textContent = money(settingsDeposit()); }
    save(); refreshSummary();
  });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act],[data-mode]"); if (!b) return;
    if (b.dataset.mode) {
      view.mode = b.dataset.mode; view.enrolling = false;
      if (isCourse(view.mode) && !cur()) view.sel = firstId(courseList(view.mode));
      render(); return;
    }
    const s = cur(), P = settingsProgram(), i = Number(b.dataset.i);
    switch (b.dataset.act) {
      case "add-person": { const n = blankPerson(); state.students.push(n); view.psel = n.id; view.mode = "students"; save(); render(); const f = document.getElementById("f-d-name"); if (f) f.focus(); break; }
      case "pick-person": view.psel = b.dataset.id; render(); break;
      case "open-person": view.psel = b.dataset.id; view.mode = "students"; render(); break;
      case "enroll": view.enrolling = true; render(); break;
      case "enroll-cancel": view.enrolling = false; render(); break;
      case "enroll-go": {
        const sel = document.getElementById("enroll-pick"), id = b.dataset.id || (sel && sel.value);
        if (!id) { toast("Choose a student first"); break; }
        const course = b.dataset.course || (isCourse(view.mode) ? view.mode : "open-water");
        const e = blankEnrollment(id, course); state.enrollments.push(e);
        view.mode = course; view.enrolling = false; view.sel = e.id; view.tab = "details"; save(); render(); toast("Enrolled in " + COURSES[course].name);
        break;
      }
      case "enroll-new": {
        const n = blankPerson(); state.students.push(n);
        const e = blankEnrollment(n.id, isCourse(view.mode) ? view.mode : "open-water"); state.enrollments.push(e);
        view.psel = n.id; view.sel = e.id; view.mode = "students"; view.enrolling = false; save(); render();
        const f = document.getElementById("f-d-name"); if (f) f.focus();
        toast("New student added and enrolled in " + COURSES[e.course].name + ". Fill in their info here.");
        break;
      }
      case "open-enr": { const en = state.enrollments.find(x => x.id === b.dataset.id); if (!en) break; view.mode = en.course; }
        view.sel = b.dataset.id; view.enrolling = false; view.tab = "details"; render(); break;
      case "del-person": {
        const n = state.enrollments.filter(e => e.studentId === view.psel).length;
        $("#pdel-confirm").innerHTML = `Delete ${esc((curPerson() || {}).name || "this student")}${n ? " and their " + n + " course record" + (n > 1 ? "s" : "") : ""} for good? <button class="btn small danger" data-act="del-person-yes">Delete</button>`;
        break;
      }
      case "del-person-yes": {
        const pid = view.psel;
        state.students = state.students.filter(x => x.id !== pid);
        state.enrollments = state.enrollments.filter(e => e.studentId !== pid);
        view.psel = firstId(state.students); if (!cur()) view.sel = firstId(owList());
        save(); render(); toast("Student deleted"); break;
      }
      case "pick": view.sel = b.dataset.id; render(); break;
      case "tab": view.tab = b.dataset.tab; render(); break;
      case "del": $("#del-confirm").innerHTML = `Remove ${esc(nameOf(s) || "this student")} from ${esc(C(s).name)} and delete this course record? Their student info stays. <button class="btn small danger" data-act="del-yes">Delete</button> <button class="btn small" data-act="tab" data-tab="details">Keep</button>`; break;
      case "del-yes": state.enrollments = state.enrollments.filter(x => x.id !== s.id); view.sel = firstId(owList()); save(); render(); toast("Course record deleted"); break;
      case "add-remed": s.remed.push({ skill: "", factor: "", action: "", reeval: "", ini: "" }); save(); render(); break;
      case "rm-remed": s.remed.splice(i, 1); save(); render(); break;
      case "add-extra": s.pay.extras.push({ desc: "", amt: "" }); save(); render(); break;
      case "rm-extra": s.pay.extras.splice(i, 1); save(); render(); break;
      case "add-dive": s.dives.push({ date: "", loc: "", depth: "", dur: "", gas: "", notes: "", ini: "" }); save(); render(); break;
      case "rm-dive": s.dives.splice(i, 1); save(); render(); break;
      case "add-row": {
        const L = b.dataset.list; if (!Array.isArray(P[L])) P[L] = [];
        P[L].push(L === "days" ? { day: String(P.days.length + 1), focus: "", obj: "", date: "" } : L === "costRows" ? { item: "", cost: "Included" } : { item: "", detail: "" });
        save(); render(); break;
      }
      case "rm-row": if (Array.isArray(P[b.dataset.list])) { P[b.dataset.list].splice(i, 1); save(); render(); } break;
      case "reset-program": $("#reset-confirm").innerHTML = `Replace all program settings with the original proposal? <button class="btn small danger" data-act="reset-yes">Restore</button>`; break;
      case "reset-yes": { const c = COURSES[view.settingsCourse] || COURSES["open-water"]; if (c.id === "open-water") state.program = clone(DEFAULT_PROGRAM); else state.programs[c.id] = clone(c.defaults || {}); save(); render(); } toast("Original proposal text restored"); break;
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
        state = load(); view.sel = firstId(owList()); view.psel = firstId(state.students); view.mode = "calendar"; view.enrolling = false; render();
        toast("Imported " + state.students.length + " students");
      } catch (err) { toast("That file isn't a backup from this app."); }
      e.target.value = "";
    };
    r.readAsText(e.target.files[0]);
  });

  // Shared helpers for add-ons loaded after this file (invoice.js, extra courses).
  window.LD = Object.assign(window.LD || {}, {
    COURSES, registerCourse: (def) => { registerCourse(def); adoptCourse(def.id); render(); },
    COURSE_ORDER, program: (id) => P({ course: id }), enrollInClass, addStudent, go,
    get state() { return state; }, save, render, toast, esc, money, fmtDate, billing, progress, owed, nameOf, personById
  });

  render();
})();
