/* Limitless Diving — Rescue Diver and Divemaster courses, registered with LD.registerCourse (see README "Adding a course").
   Each course has its own skill matrix, schedule labels, prerequisites and default proposal text.
   Program text here is only the starting point: everything in `defaults` can be edited in Program settings. */
(function () {
  "use strict";

  const SHARED = {
    business: "Limitless Diving & Technical Training",
    instructor: "Jamie M. Lichner",
    phone: "484-221-0825",
    email: "jlichner.scuba@gmail.com",
    depositPct: 50,
    expectationsCallout: "Attendance does NOT guarantee certification. All required knowledge, skills, judgment, and performance must be demonstrated to the required standard."
  };

  // ---------------- Rescue Diver ----------------
  const RESCUE = {
    id: "rescue",
    name: "Rescue Diver",
    fullName: "NAUI Rescue Scuba Diver",
    cols: "two", // Confined status, then M checkbox for open water
    colLabels: ["Confined water", "Open water (M)"],
    key: "IP = Introduced/Practiced · PR = Proficient · M = Mastered/Pass · R = Remediation Required",
    skillHint: "Applicable rescue skills are introduced and practiced in confined or shallow water, then performed in open water. Tick M when the skill is mastered in open water.",
    unit: "Day",
    structCols: ["Day", "Focus", "Primary objectives"],
    schedule: ["Day 1 — Academics + confined / shore", "Day 2 — Open water rescue dives"],
    siteLabel: "Location",
    dives: 2,
    diveTab: "Dive log",
    diveTitle: "Open Water Rescue Dive Record",
    alwaysRecords: false,
    prereqs: [
      { k: "cert", label: "NAUI Open Water Scuba Diver or equivalent", detail: "Agency / certification #" },
      { k: "age", label: "Age 15+ by the water phase (junior 10–14)", detail: "Date of birth", type: "date" },
      { k: "cpr", label: "Current CPR, First Aid & EO2 (needed before the card is issued)", detail: "Card expiry", type: "date" },
      { k: "gear", label: "Own dive equipment checked before open water", detail: "Notes" }
    ],
    skills: [
      ["Watermanship", "Swim 200 m (219 yd.) nonstop, any stroke."],
      ["Watermanship", "Survival swim — 10 minutes."],
      ["Recovery", "Recover 4.5 kg (10 lb.) from a depth of approximately 3 m (10 ft.)."],
      ["Skin Diving", "Swim 400 m (438 yd.) nonstop, breathing from a snorkel."],
      ["Rescue", "Bring another diver simulating unconsciousness to the surface from a depth of approximately 3 m (10 ft.), minimally equipped with mask, fins, and snorkel."],
      ["Buoyancy", "If ballast is worn, demonstrate the ability to ditch weights to establish positive buoyancy."],
      ["Equipment", "Assemble equipment, make adjustments, don equipment, and perform pre-dive equipment inspections."],
      ["Surface Skills", "In succession at the surface, remove and replace mask, snorkel, fins, weight system, and scuba unit."],
      ["Underwater Skills", "In succession underwater, remove, replace, and clear the mask and regulator."],
      ["Breathing", "Comfortably breathe from a regulator without a mask for two minutes."],
      ["Air Sharing", "Share air using an alternate air source."],
      ["Buoyancy", "Demonstrate surface use of the BC and the ability to hover underwater."],
      ["Assists", "From a stable platform (shore, boat, or dock), perform a non-swimming assist (throw bag, life ring, etc.)."],
      ["Assists", "Muscle cramp removal for self and another diver."],
      ["Buoyancy", "Establish buoyancy at the surface for self and another diver, including power and oral BCD inflation and ditching the ballast system for both divers."],
      ["Assists", "Assist a diver exhibiting breathing difficulty (suit restriction, cold water, etc.)."],
      ["Assists", "Assist an exhausted diver."],
      ["Towing", "Demonstrate diver tow using two different techniques."],
      ["Panic Management", "Assist a diver exhibiting panic at the surface and underwater."],
      ["Air Sharing", "Share air as both donor and receiver from an octopus or alternate breathing source (not buddy breathing) during ascents."],
      ["Rescue", "Bring a diver simulating unconsciousness to the surface from approximately 3 m (10 ft.); remove the victim's weight system and, if appropriate, mask and snorkel; administer blow/tap/talk if trained; evacuate to the nearest area for first aid."],
      ["Search Pattern", "Demonstrate a lost-diver search using a search pattern appropriate to the underwater environment and conditions."],
      ["Extrication", "With the aid of one assistant, remove a diver simulating a non-breathing, unconscious victim from the water after reaching shore, boat, or platform."],
      ["Rescue", "In scuba gear, make an entry and swim a minimum of 20 m (21 yd.) to the simulated victim; retrieve the victim from 6–9 m (20–30 ft.) using a controlled ascent, establish buoyancy, signal for help, and transport the victim to an exit."],
      ["Situational Awareness", "Demonstrate the judgment to determine whether rescue breathing is beneficial in a given situation."],
      ["Final Evaluation", "Apply Scuba Diver Rescue skills in a real-time rescue scenario."],
      ["Final Evaluation", "Demonstrate use of an Accident Management Plan."],
      ["Final Evaluation", "Administer emergency oxygen."]
    ],
    final: [],
    defaults: Object.assign({}, SHARED, {
      docTitle: "Rescue Diver Course Proposal",
      tagline: "Learning to manage risk, recognize problems early, and respond with control — for yourself and for others.",
      program: "NAUI Rescue Scuba Diver",
      format: "2 Days — Academics, Confined Skills & Open Water Rescue Training",
      price: 500,
      feeLabel: "Rescue Scuba Diver Program",
      schedule: "September 12–13, 2026",
      hours: "8:00 AM – 4:00 PM",
      location: "Lake Hydra",
      payment: "Venmo: @Jamie-Lichner",
      paymentUrl: "https://venmo.com/u/Jamie-Lichner",
      depositPurpose: "training dates",
      balanceDue: "due before open water",
      philosophy: "Rescue Diver is where a diver's focus shifts from managing their own dive to managing risk more broadly — recognizing developing problems in a buddy or another diver before they escalate, and responding with the right skill, calmly and correctly.\n\nThis program is performance-based, just like our Open Water course. Assists, self-rescue, tows, air-sharing rescues, and the real-time rescue scenario are treated as core competencies to be demonstrated under realistic conditions, not simply reviewed on paper.",
      standards: "This program is conducted in accordance with the current NAUI Standards and Policies Manual, Rescue Scuba Diver course. NAUI standards establish certification requirements; this program may add instructor-selected emphasis, repetition, and coaching.",
      logisticsTitle: "Location & Logistics",
      logistics: "Training takes place at Lake Hydra on September 12–13, 2026, from 8:00 AM to 4:00 PM each day.",
      logisticsCallout: "Lake entry tickets are purchased directly through Lake Hydra and are not included in the course fee. Use instructor code Lichner2026 when purchasing your ticket.",
      logisticsLink: "https://www.lakehydra.com/",
      days: [
        { day: "1", focus: "Academics + Confined / Shore Skills", obj: "Rescue theory, accident management, and stress/panic recognition; introduce and practice assists, self-rescue, tows, buoyancy establishment, and air-sharing rescues in confined or shallow conditions.", date: "2026-09-12" },
        { day: "2", focus: "Open Water Rescue Dives", obj: "Complete required open-water rescue dives; conduct lost-diver search, unconscious-diver recovery, extrication, and a real-time rescue scenario applying the Accident Management Plan and emergency oxygen administration.", date: "2026-09-13" }
      ],
      included: [
        { item: "NAUI Rescue Scuba Diver", detail: "Certification processing included upon successful completion of all requirements" },
        { item: "eLearning", detail: "Rescue Diver eLearning materials" },
        { item: "Instruction", detail: "Academic, confined/shore, and open-water instruction, briefings and debriefings" },
        { item: "Lake Entry", detail: "Not included — see Location & Logistics for ticket purchase details" }
      ],
      prereqs: [
        { item: "Certification", detail: "NAUI Open Water Scuba Diver or equivalent" },
        { item: "Age", detail: "Minimum 15 by the water phase of the course (junior certification allowed for ages 10–14)" },
        { item: "CPR / First Aid / EO2", detail: "Not required to attend class. A current CPR, First Aid, and Emergency Oxygen (EO2) certification is required before the Rescue Diver certification card can be issued." },
        { item: "Equipment", detail: "Students furnish and are responsible for their own dive equipment; gear will be checked before open-water training" }
      ],
      topics: "Causes, prevention, and treatment of diving accidents; theory of recompression therapy\nRecognizing stress, panic, distress, and overexertion in yourself and others\nThermal-related problems, barotrauma, and decompression illness\nSurface drowning syndrome: drowning and near-drowning\nDiving rescue: self-rescue, diver assists, surface and underwater rescues, diver transport, gear removal, and extrication\nGeneral accident management: site safety, victim care, emergency transport, information reporting, and liability considerations",
      expectations: "Skills may be introduced, practiced, repeated, and reevaluated. Needing additional practice is not a failure of the training process; an incomplete skill simply remains incomplete until proficiency is demonstrated.",
      commitment: "If a required skill is not mastered during scheduled training, I will work with the student to identify the specific performance issue and establish a clear plan for remediation, additional practice, and reevaluation.\n\nMy commitment is to provide coaching, explanation, repetition, and structured practice that gives the student a reasonable opportunity to achieve proficiency. Certification remains performance-based and will only be awarded when the required standard has been demonstrated.",
      matrixTitle: "Rescue Diver Certification — Required Skill Matrix",
      matrixIntro: "This matrix is the student's performance checklist. Applicable rescue skills are introduced and practiced in confined or shallow-water settings and performed in open water. Maximum depth for open-water rescue training is 18 m (60 ft.); no dives require staged decompression.",
      proficiency: "",
      costRows: [
        { item: "Rescue Diver eLearning Materials", cost: "Included" },
        { item: "Instruction / Confined-Water / Open Water Training", cost: "Included" },
        { item: "Certification Processing", cost: "Included" },
        { item: "Lake Hydra Entry Ticket", cost: "Not included — purchased separately" }
      ],
      paymentNotes: "The remaining balance is due prior to the open-water training portion.\n\nLake Hydra entry tickets are purchased separately by the student directly through lakehydra.com using instructor code Lichner2026, and are not part of the $500 course fee.\n\nAdditional training required to achieve skill proficiency is not included in the $500 course fee and may be billed separately. Any additional training requirement will be discussed with the student before additional charges are incurred.",
      acknowledgment: "I understand that this is a performance-based certification program. I understand that attendance, participation, or completion of scheduled class dates does not guarantee certification. I understand that all required knowledge and skills must be demonstrated to the required level of proficiency.\n\nI understand that a current CPR, First Aid, and Emergency Oxygen (EO2) certification is required before my Rescue Diver certification card can be issued, even though it is not required to attend class.\n\nI understand that if I do not initially master a required skill, my instructor will work with me to establish a reasonable plan for additional practice and evaluation. I understand that certification will not be issued until the required standard has been met."
    })
  };

  // ---------------- Divemaster ----------------
  const DM = {
    id: "divemaster",
    name: "Divemaster",
    fullName: "NAUI Divemaster (Dive Leader)",
    cols: "two",
    colLabels: ["Practiced", "Evaluated for record (M)"],
    key: "IP = Introduced/Practiced · PR = Proficient · M = Mastered/Pass (Evaluated for Record) · R = Remediation Required",
    skillHint: "Practice each skill or leadership activity (IP / PR), then tick M when it has been evaluated for the record. The Leadership swim, skin and scuba rows are NAUI's Policies Applying to All Leadership Courses; introduce them in confined water if the candidate is not familiar with them.",
    unit: "Phase",
    structCols: ["Phase", "Focus", "What's involved"],
    schedule: ["Phase 1 — Academics complete", "Phase 2 — Skills & evaluation dives complete", "Phase 3 — Leadership dives complete", "Phase 4 — Assisting & teaching complete", "Phase 5 — Final evaluation / submitted to NAUI"],
    siteLabel: "Location",
    dives: 10,
    midDepth: "60 ft", maxDepth: "130 ft",
    diveTab: "Activity log",
    diveTitle: "Divemaster Activity Log",
    alwaysRecords: false,
    prereqs: [
      { k: "age", label: "18 or older before enrollment", detail: "Date of birth", type: "date" },
      { k: "dives", label: "60+ logged open water dives, 30+ hours bottom time", detail: "Dives / hours logged" },
      { k: "cert", label: "OW, Advanced, Rescue, Nitrox, Master Scuba Diver & DFA (or equivalents)", detail: "Certifications held" },
      { k: "cpr", label: "CPR incl. two-person CPR & barrier devices (pocket mask / face shield)", detail: "Card expiry", type: "date" },
      { k: "medical", label: "Unconditional physician approval within the last 12 months", detail: "Date of approval", type: "date" },
      { k: "gear", label: "Own dive equipment checked before open water", detail: "Notes" }
    ],
    skills: [
      ["Leadership Swim", "Swim underwater 23 m (25 yd.) on one breath; no dive or push-off. No equipment."],
      ["Leadership Swim", "Swim 412 m (450 yd.) nonstop at an intermediate level, using at least two different strokes. No equipment."],
      ["Leadership Swim", "Survival swim for 20 minutes. No equipment."],
      ["Leadership Skin", "Kick 823 m (900 yd.) nonstop with effective technique, in thermal protection, weights, mask, fins, and snorkel."],
      ["Leadership Skin", "Skin diving ditch and recovery."],
      ["Leadership Scuba (CW)", "Scuba diver assist."],
      ["Leadership Scuba (CW)", "Buddy breathe while swimming horizontally underwater for four minutes."],
      ["Leadership Scuba (CW)", "Alternate shared-air horizontal underwater swim for four minutes."],
      ["Leadership Scuba (CW)", "Scuba ditch and recovery."],
      ["Leadership Scuba (CW)", "Scuba bailout."],
      ["Leadership Scuba (OW)", "Remove and replace the weight system at the surface."],
      ["Leadership Scuba (OW)", "Remove and replace the scuba unit at the surface."],
      ["Leadership Scuba (OW)", "Remove and replace the weight system on the bottom."],
      ["Leadership Scuba (OW)", "Remove and replace the scuba unit on the bottom."],
      ["Leadership Scuba (OW)", "Buddy breathe while stationary on the bottom."],
      ["Leadership Scuba (OW)", "Alternate shared-air ascent from a minimum of 4.6 m (15 ft.)."],
      ["Leadership Scuba (OW)", "Emergency swimming ascent from a minimum of 4.6 m (15 ft.)."],
      ["Leadership Scuba (OW)", "Scuba diver rescue."],
      ["Leadership Scuba (OW)", "Recover a weight of at least 4.5 kg (10 lb.) from at least 6 m (20 ft.) and bring it to the surface."],
      ["Distance Swim", "805 m (880 yd.) total distance swim during a dive."],
      ["Equipment", "Pre-dive gear check for self and buddy."],
      ["Dive Conduct", "Entry, buoyancy check, swim to and from the dive area, and exit."],
      ["Dive Conduct", "Descents, underwater swimming, and ascents."],
      ["Decompression Awareness", "Make a simulated decompression stop at 4.6 m (15 ft.) for five minutes."],
      ["Mask", "Mask clearing, including removal and replacement."],
      ["Regulator", "Remove, replace, and clear a regulator."],
      ["Regulator", "Regain primary regulator from behind the shoulder; replace and clear."],
      ["Buoyancy", "Maintain proper buoyancy using weights, breathing, and BC."],
      ["Night Diving", "Complete a night dive as a diver, in an area previously dived by the class during daylight."],
      ["Rescue Management", "Performing as a Divemaster with safety divers and assistants, control a satisfactory rescue of a diver simulating an underwater accident, including organizing a search, transporting the victim, victim care, and accessing emergency systems."],
      ["Briefings", "Prepare and present at least one pre-dive briefing for practice and one for evaluation."],
      ["Assisting Instruction", "Assisting an active-status NAUI Instructor, organize and assist during an early open-water experience for a class of student divers."],
      ["Beach Dive", "Performing as a Divemaster, organize and conduct a beach dive for certified divers, evaluated for the record."],
      ["Boat Dive", "Performing as a Divemaster, organize and conduct a boat dive for certified divers, evaluated for the record (or an alternate beach dive in a significantly different setting if a boat dive is not possible)."],
      ["Night / Ltd. Visibility Dive", "Organize and conduct a night or limited-visibility dive for certified divers, evaluated for the record (simulation permitted if not possible)."],
      ["Leading Programs", "Perform as a Divemaster conducting a NAUI Introduction to Scuba, NAUI Refresher, and NAUI Skin Diver course."],
      ["Teaching Presentations", "Present at least four assigned teaching presentations selected from the ten core diving knowledge topics; at least one passing presentation is required."],
      ["Logging", "Log all Divemaster diving activities. Up to three scuba dives and one skin dive may be run in a single day, using the greatest possible variety of diving situations."]
    ],
    final: [],
    defaults: Object.assign({}, SHARED, {
      docTitle: "Divemaster Course Proposal",
      tagline: "From capable diver to dive leader — developing the judgment, skill, and presence to safely guide others underwater.",
      program: "NAUI Divemaster (Dive Leader, ISO 24801-3)",
      format: "Self-Paced — eLearning, Mentored Skills Practice & Open Water Leadership Activities",
      price: 1400,
      feeLabel: "NAUI Divemaster Program",
      schedule: "[Dates TBD — arranged individually around academics, practice, and evaluation dives]",
      hours: "",
      location: "[Location TBD]",
      payment: "", paymentUrl: "",
      depositPurpose: "enrollment",
      balanceDue: "due before the first evaluated leadership dive",
      philosophy: "Divemaster is the highest NAUI leadership rating below Instructor, and it asks something different of a diver than any certification before it: the ability to plan, organize, and take responsibility for the safety and experience of other divers.\n\nThis program is mentorship-based and performance-based. You will practice and be evaluated on real dive-management activities — briefings, rescues, night dives, boat dives — not just review them in a classroom. The goal is a Divemaster who leads with sound judgment and genuine command of the fundamentals, not just a certification card.",
      standards: "This program is conducted in accordance with the current NAUI Standards and Policies Manual, Divemaster (Dive Leader, ISO 24801-3) course. NAUI standards establish certification requirements; this program may add instructor-selected emphasis, repetition, and coaching.",
      logisticsTitle: "Course Format & Scheduling",
      logistics: "This Divemaster course is self-paced. Academic work, in-water skills practice, and evaluated open-water leadership dives are scheduled individually around your availability and diving experience, rather than on a fixed weekend or weekly calendar.\n\nLocation: [Location TBD]. Dates and dive-day scheduling: [Dates TBD — to be arranged once enrollment is confirmed].",
      logisticsCallout: "", logisticsLink: "",
      days: [
        { day: "1", focus: "Academics & Knowledge Development", obj: "Complete eLearning, self-study, and/or direct instruction (20 estimated hours total; at least 15 hours instructor-supervised). Covers equipment, diving safety, diving environment, NAUI orientation, and the business of diving instruction.", date: "" },
        { day: "2", focus: "Skills Practice & Evaluation Dives", obj: "Minimum 20 practical hours across a minimum of 10 open water dives (20 total Divemaster activities). Practice and evaluate in-water skills, buoyancy, and dive-management fundamentals. Maximum training depth 40 m (130 ft.); no required staged decompression.", date: "" },
        { day: "3", focus: "Leadership Dives (Evaluated for Record)", obj: "Organize and conduct a beach dive, a boat dive (or alternate beach dive), and a night/limited-visibility dive for certified divers, each evaluated for the record. Includes a controlled rescue scenario and required pre-dive briefings.", date: "" },
        { day: "4", focus: "Assisting & Teaching Practice", obj: "Assist an active NAUI Instructor during an early open-water class experience; perform as Divemaster conducting Introduction to Scuba, Refresher, and Skin Diver activities. Present at least four assigned teaching presentations (one passing presentation required).", date: "" },
        { day: "5", focus: "Final Evaluation & Certification Processing", obj: "Complete required exams and evaluations. Upon successful completion, submit the NAUI membership application for processing as a certified Divemaster.", date: "" }
      ],
      included: [
        { item: "NAUI Divemaster (Dive Leader)", detail: "Certification processing and NAUI membership application, included upon successful completion of all requirements" },
        { item: "eLearning", detail: "Divemaster eLearning materials" },
        { item: "Instruction & Mentoring", detail: "Academic supervision, in-water skills coaching, and mentored leadership dives, briefings and debriefings" },
        { item: "Evaluation Dives", detail: "Instructor supervision and evaluation for all dives conducted for the record" }
      ],
      prereqs: [
        { item: "Age", detail: "Minimum 18 years old prior to enrollment and the start of training" },
        { item: "Experience", detail: "Minimum 60 logged open water scuba dives with at least 30 hours of bottom time, varied in environment, depth, and activity" },
        { item: "Certification", detail: "NAUI Open Water, Advanced Open Water, Rescue, Nitrox, and Master Scuba Diver (or equivalents), plus Diving First Aid for Divers (DFA) or equivalent, per NAUI's Policies Applying to All Leadership Courses" },
        { item: "CPR", detail: "Current CPR training that includes two-person CPR and the use of rescue breathing barrier devices (pocket mask, face shield), as required for NAUI leadership certification" },
        { item: "Medical Approval", detail: "Written, unconditional approval for diving from a licensed physician, dated within the preceding 12 months. The physician may not be the student." },
        { item: "Equipment", detail: "Students furnish and are responsible for their own dive equipment; gear will be checked before open-water training" }
      ],
      topics: "Diving equipment: common problems, recognizing unsafe or improperly assembled gear, variations in equipment, and pre-dive equipment checks\nDiving safety: emergency response, underwater communications, diver recall methods, search techniques, assists and rescues, victim care, and accident reporting\nDiving environment: local ecology and conservation, water movement, tides, currents, waves, and surface hazards\nNAUI orientation and the business of diving instruction: liability concepts, waivers, and the role of Continuing Education\nMethods of instruction: teaching theory, oral communication, and classroom presentation skills\nDivemaster duties: planning, organizing, and controlling group dives; briefings, debriefings, checklists, logs, and dive flag use\nShore diving, boat diving, night & limited-visibility diving, and deep/simulated decompression diving considerations",
      expectations: "Skills may be introduced, practiced, repeated, and reevaluated. Needing additional practice is not a failure of the training process; an incomplete skill or activity simply remains incomplete until proficiency is demonstrated.",
      commitment: "If a required skill or leadership activity is not mastered, I will work with the candidate to identify the specific performance issue and establish a clear plan for remediation, additional practice, and reevaluation.\n\nMy commitment is to provide coaching, mentoring, and structured practice that gives the candidate a reasonable opportunity to achieve proficiency. Certification remains performance-based and will only be awarded when the required standard has been demonstrated.",
      matrixTitle: "Divemaster Certification — Required Skill Matrix",
      matrixIntro: "This matrix is the candidate's performance checklist, covering the required Divemaster skills and evaluated open-water leadership activities. Maximum depth for training dives is 40 m (130 ft.); no dives require actual staged decompression.",
      proficiency: "",
      costRows: [
        { item: "Divemaster eLearning Materials", cost: "Included" },
        { item: "Instruction / Mentoring / Evaluation Dives", cost: "Included" },
        { item: "Certification Processing & NAUI Membership Application", cost: "Included" }
      ],
      paymentNotes: "The remaining balance is due before the first evaluated open-water leadership dive.\n\nAdditional training required to achieve skill proficiency is not included in the $1,400 course fee and may be billed separately. Any additional training requirement will be discussed with the candidate before additional charges are incurred.",
      acknowledgment: "I understand that this is a performance-based certification program. I understand that enrollment, participation, or completion of scheduled activities does not guarantee certification. I understand that all required knowledge and skills must be demonstrated to the required level of proficiency.\n\nI understand that a written, unconditional medical approval for diving from a licensed physician, dated within the preceding 12 months, is required, and that I am responsible for providing my own dive equipment.\n\nI understand that if I do not initially master a required skill or activity, my instructor will work with me to establish a reasonable plan for additional practice and evaluation. I understand that certification will not be issued until the required standard has been met."
    })
  };

  if (!window.LD || !window.LD.registerCourse) { console.error("courses.js must load after app.js"); return; }
  window.LD.registerCourse(RESCUE);
  window.LD.registerCourse(DM);
})();
