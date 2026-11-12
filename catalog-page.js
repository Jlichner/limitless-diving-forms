/* Limitless Diving — registers every course in catalog.js with the app and draws the "All courses" page.
   Courses that already have a full skill matrix (Open Water, Rescue Diver, Divemaster) keep it. Every other
   catalog course becomes a lighter course: enrollment, prerequisite checklist, dive log, payments, sign-off and a
   proposal, with no skill matrix until one is added. Load after app.js, courses.js and catalog.js. */
(function () {
  "use strict";

  const L = () => window.LD;
  const CAT = window.LDCatalog;
  if (!window.LD || !CAT) { console.error("catalog-page.js must load after app.js and catalog.js"); return; }

  // The standards fields kept with each course's settings (editable in Settings → Course standards).
  function divesText(std) {
    if (!std) return "";
    const n = std.dives ? std.dives + " open water dive" + (std.dives === 1 ? "" : "s") : "";
    return [n, std.divesNote].filter(Boolean).join(". ");
  }
  function standardsFields(c) {
    const std = c.std;
    return {
      minAge: std ? std.age : "", minDives: divesText(std), maxDepth: std ? std.depth : "",
      standardsRef: std && std.page ? "2026 NAUI Standards and Policies Manual, p. " + std.page : ""
    };
  }
  function agencyStandards(c) {
    return c.agency === "TDI"
      ? "This course is conducted in accordance with the current TDI Standards and Procedures. TDI standards establish certification requirements; this program may add instructor-selected emphasis, repetition, and coaching."
      : "This course is conducted in accordance with the current NAUI Standards and Policies Manual. NAUI standards establish certification requirements; this program may add instructor-selected emphasis, repetition, and coaching.";
  }

  // A catalog course with no full course yet: what LD.registerCourse needs.
  function lightCourse(c) {
    const std = c.std;
    const checks = std
      ? [{ k: "age", label: "Minimum age: " + std.age, detail: "Date of birth", type: "date" }]
        .concat(std.prereqs.filter(x => !/^No certification required/.test(x)).map((x, i) => ({ k: "p" + i, label: x, detail: "Notes / card #" })))
      : [{ k: "std", label: "Meets the " + c.agency + " course prerequisites", detail: "Notes" }];
    const defaults = Object.assign(L().defaultProgram(), {
      docTitle: c.name + " Course Proposal", program: c.fullName, format: "", tagline: "", price: "",
      feeLabel: c.fullName + " course", schedule: "", hours: "", location: "",
      days: [{ day: "1", focus: "", obj: "", date: "" }],
      included: [{ item: c.agency + " " + c.cert, detail: "Certification on successful completion of all requirements" }],
      prereqs: std ? [{ item: "Minimum age", detail: std.age }].concat(std.prereqs.map(x => ({ item: "Requirement", detail: x }))) : [],
      standards: agencyStandards(c), topics: "", matrixTitle: "", matrixIntro: "",
      costRows: [{ item: "Instruction", cost: "Included" }, { item: "Certification Processing", cost: "Included" }]
    }, standardsFields(c));
    return {
      id: c.id, basic: true, agency: c.agency,
      name: c.agency === "NAUI" ? c.name : c.fullName, fullName: c.fullName,
      skills: [], final: [], schedule: ["Start date"], dives: std && std.dives ? std.dives : 0,
      siteLabel: "Location", alwaysRecords: false, prereqs: checks,
      diveTab: "Dive log", diveTitle: "Open Water Dive Record",
      maxDepth: std && /\d+ ft/.test(std.depth) ? std.depth.match(/\d+ ft/)[0] : "—", midDepth: "",
      defaults
    };
  }

  // Full courses (Open Water, Rescue, Divemaster): add the standards fields if their settings don't have them yet.
  CAT.COURSES.forEach(c => {
    const def = L().COURSES[c.app]; if (!def) return;
    const f = standardsFields(c);
    if (def.defaults) Object.keys(f).forEach(k => { if (def.defaults[k] == null) def.defaults[k] = f[k]; });
    const pr = L().program(c.app);
    Object.keys(f).forEach(k => { if (pr[k] == null) pr[k] = f[k]; });
  });
  L().registerCourses(CAT.COURSES.filter(c => !L().COURSES[c.app]).map(lightCourse));

  // ---------- the All courses page ----------
  function render() {
    const { esc, COURSES } = L();
    const count = (id) => L().state.enrollments.filter(e => e.course === id).length;
    const classes = (id) => (L().state.classes || []).filter(k => k.course === id).length;
    const prereqText = (c, pr) => {
      const list = (pr.prereqs || []).filter(x => x && !/^minimum age$/i.test(String(x.item || "").trim())).map(x => x.detail || x.item).filter(Boolean);
      // Own-equipment lines are in every proposal; they'd only crowd this table.
      return (list.length ? list : (c.std ? c.std.prereqs : [])).filter(x => !/^Students furnish/.test(x));
    };
    const row = (c) => {
      const def = COURSES[c.app]; if (!def) return "";
      const pr = L().program(c.app), n = count(c.app), k = classes(c.app), pq = prereqText(c, pr);
      const missing = !pr.minAge && !pr.minDives && !pr.maxDepth && !pq.length;
      return `<tr>
        <td><b>${esc(c.name)}</b>${def.basic ? "" : ` <span class="cat-full">Skill matrix</span>`}
          ${pr.standardsRef ? `<br><small class="meta">${esc(pr.standardsRef)}</small>` : ""}</td>
        ${missing ? `<td colspan="4"><span class="cat-missing">Standards not entered yet.</span> <button class="linkbtn" data-catact="std" data-id="${c.app}">Add them in Settings</button></td>` : `
        <td>${esc(pr.minAge || "")}</td>
        <td>${pq.length ? `<ul class="cat-pre">${pq.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</td>
        <td>${esc(pr.minDives || "")}</td><td>${esc(pr.maxDepth || "")}</td>`}
        <td class="cat-n">${n}${k ? `<br><small class="meta">${k} class${k === 1 ? "" : "es"}</small>` : ""}</td>
        <td class="cat-acts"><button class="btn small" data-catact="open" data-id="${c.app}">Students</button>
          <button class="btn small" data-catact="std" data-id="${c.app}">Settings</button></td></tr>`;
    };
    return `<div class="rec-head"><div class="who"><span class="eyebrow">Course catalog</span><h1>All courses</h1></div></div>
      <p class="hint">Every NAUI, NAUI Technical and TDI course you can enroll students in. Pick any of them when you add a class to the calendar or enroll a student.
        NAUI standards are from the 2026 NAUI Standards and Policies Manual; TDI standards are yours to fill in. Edit any course's standards, price and proposal text under <b>Settings</b>.
        Courses marked <span class="cat-full">Skill matrix</span> have a full skill matrix; others can get one later, one course at a time.</p>
      ${CAT.byAgency().map(g => `<h2 class="sec">${esc(g.agency)} <small class="meta">${g.courses.length} course${g.courses.length === 1 ? "" : "s"}</small></h2>
        <div class="tablewrap"><table class="m cat-table"><thead><tr><th>Course</th><th>Minimum age</th><th>Prerequisites</th><th>Open water dives</th><th>Maximum depth</th><th>Students</th><th></th></tr></thead>
        <tbody>${g.courses.map(row).join("")}</tbody></table></div>`).join("")}`;
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-catact]"); if (!b) return;
    if (b.dataset.catact === "open") L().go(b.dataset.id);
    if (b.dataset.catact === "std") { L().go("program", { settingsCourse: b.dataset.id }); window.scrollTo(0, 0); }
  });

  window.LDCatalogPage = { render };
  L().render();
})();
