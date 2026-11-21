/* Class paperwork: the forms a student must fill in for a class, chosen by the class's agency.
   Used by the instructor app (summaries sent to the Student portal, the Classes page) and by account.html.

   To add a form: put the PDF in forms/<agency>/ and add it to FORMS below.
   To give an agency's students a form: add its id to that agency's list in SETS.
   "Both" (a NAUI + TDI class) gets every form from both lists, once each.
   Set minor: true on a form only students under 18 need (their parent or guardian fills it in).
   Optional courses: [...] limits a form to those catalog course ids (e.g. a course-specific release). */
(function () {
  "use strict";
  const FORMS = {
    "tdi-release": {
      title: "TDI General Liability Release and Express Assumption of Risk",
      file: "forms/tdi/tdi-general-liability-release.pdf",
      how: "Read it at home before class. You'll go through it together at the first session, initial each paragraph and sign it in front of a witness, so bring it with you, unsigned if you like.",
      std: "TDI Part 2, 2.1 (p. 6); TDI Part 1, 6.4.5 (p. 16)"
    },
    "medical": {
      title: "Diver Medical Participant Questionnaire",
      file: "forms/medical/diver-medical-participant-questionnaire-2026.pdf",
      how: "Fill in and sign page 1 before your first class (lectures included). If you answer YES where it says to, take all three pages to your doctor and bring the signed physician's evaluation. A physician's sign-off is good for 12 months.",
      std: "TDI Part 2, 2.1 (p. 6); TDI Part 1, 6.4.4 (p. 15); NAUI 2026 manual, Forms, Records and Reports (p. 56)"
    },
    "tdi-minor": {
      title: "TDI Notice to the Minor Child's Natural Guardian",
      file: "forms/tdi/tdi-notice-to-minor-childs-natural-guardian.pdf",
      how: "For students under 18. A parent or legal guardian reads and signs it, together with the liability release and the medical form, before class starts.",
      std: "TDI Part 1, 6.4.5 (p. 16)",
      minor: true
    },
    "naui-release": {
      title: "NAUI Release of Liability, Waiver of Claims and Express Assumption of Risk Agreement",
      file: "forms/naui/naui-liability-release-2023.pdf",
      how: "Read it before class and bring it with you. It's signed in front of a witness before any in-water training. If you're under 18, a parent or legal guardian signs it too.",
      std: "2026 NAUI Standards and Policies Manual, Forms, Records and Reports (p. 56)"
    },
    "naui-tech-release": {
      title: "NAUI Technical Release of Liability, Waiver of Claims and Express Assumption of Risk Agreement",
      file: "forms/naui/naui-technical-liability-release-2023.pdf",
      how: "Read it before class and bring it with you. It's signed in front of a witness before any in-water training. If you're under 18, a parent or legal guardian signs it too.",
      std: "2026 NAUI Standards and Policies Manual, Forms, Records and Reports (p. 56)"
    }
  };
  // Which forms each kind of class gets. "NAUI" is NAUI recreational courses; "NAUI Tech" is courses the
  // catalog lists under NAUI Technical.
  const SETS = {
    TDI: ["tdi-release", "medical", "tdi-minor"],
    NAUI: ["naui-release", "medical"],
    "NAUI Tech": ["naui-tech-release", "medical"]
  };

  function agencyOfCourse(course) {
    const c = window.LDCatalog && course ? window.LDCatalog.find(course) : null;
    return c ? (/^TDI/.test(c.agency) ? "TDI" : "NAUI") : "";
  }
  // The SETS keys for a class: the Agency (NAUI / TDI / Both), with NAUI split by the course's catalog agency.
  function setKeys(agency, course) {
    const c = window.LDCatalog && course ? window.LDCatalog.find(course) : null;
    const naui = c && /NAUI Tech/i.test(c.agency) ? "NAUI Tech" : "NAUI";
    return agency === "Both" ? [naui, "TDI"] : agency === "NAUI" ? [naui] : agency === "TDI" ? ["TDI"] : [];
  }
  // The forms for a class. agency: "NAUI", "TDI" or "Both". minor: true (under 18), false, or null (unknown,
  // so under-18 forms are listed as "only if you're under 18").
  function forClass(agency, course, minor) {
    const seen = new Set(), out = [];
    setKeys(agency, course).forEach(key => (SETS[key] || []).forEach(id => {
      const f = FORMS[id];
      if (!f || seen.has(id)) return; seen.add(id);
      if (f.courses && course && !f.courses.includes(course)) return;
      if (f.minor && minor === false) return;
      out.push(Object.assign({ id, ifMinor: !!f.minor && minor !== true }, f));
    }));
    return out;
  }
  // The set names for a class that have no forms yet (to flag on the Classes page).
  function missing(agency, course) { return setKeys(agency, course).filter(k => !(SETS[k] || []).length); }
  // True if the student is under 18 on the date given (YYYY-MM-DD), false if 18 or over, null if no birth date.
  function isMinor(dob, on) {
    if (!dob || !/^\d{4}-\d{2}-\d{2}/.test(dob)) return null;
    const b = new Date(dob.slice(0, 10) + "T12:00:00"), d = new Date((on || new Date().toISOString().slice(0, 10)) + "T12:00:00");
    if (isNaN(b) || isNaN(d)) return null;
    let age = d.getFullYear() - b.getFullYear();
    if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) age--;
    return age < 18;
  }
  window.LDPaperwork = { FORMS, SETS, forClass, isMinor, agencyOfCourse, missing };
})();
