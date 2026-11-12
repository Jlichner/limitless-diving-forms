/* Limitless Diving — the full course catalog: every NAUI, NAUI Technical and TDI class students can enroll in.
   Load after app.js and courses.js in index.html (each catalog course is registered as a course there), and on
   account.html before account.js (it only uses the certification lists there).

   NAUI standards (minimum age, prerequisites, required dives, maximum depth) come from the 2026 NAUI Standards
   and Policies Manual; `page` is the manual page. TDI standards are left blank on purpose: fill them in under
   Settings for that course. Every value here is only a starting point and can be edited in Settings.

   To give a course a full skill matrix later, register it in courses.js with the same id (like Rescue Diver),
   and add `app: "<id>"` here if the ids differ. */
(function () {
  "use strict";

  const AGENCIES = ["NAUI", "NAUI Technical", "TDI"];

  const JR = " (junior certification 10–14)";
  const OW = "NAUI Open Water Scuba Diver or equivalent";
  const AOW = "NAUI Advanced Open Water Scuba Diver or equivalent";
  const NO_DECO = "; no dives require staged decompression";
  const GEAR = "Students furnish their own dive equipment, checked by the instructor before open water";

  // id: a short stable key (also the course id in the app). app: the id of an existing full course instead.
  // name: the course name. cert: the certification it issues, if it differs from the name.
  // std: { age, prereqs[], dives, depth, page } from the standards, or null when not entered yet.
  const COURSES = [
    // ---------------- NAUI ----------------
    { agency: "NAUI", id: "naui-adaptive", name: "Adaptive Scuba Diver",
      std: { age: "15" + JR, prereqs: ["No certification required"], dives: 4, depth: "18 m / 60 ft", page: 92 } },
    { agency: "NAUI", id: "naui-aow", name: "Advanced Open Water Scuba Diver",
      std: { age: "15" + JR, prereqs: [OW, GEAR], dives: 6, divesNote: "Navigation, night or limited visibility, and deep (130 ft max), plus 3 electives",
        depth: "40 m / 130 ft" + NO_DECO, page: 116 } },
    { agency: "NAUI", id: "naui-ai", name: "Assistant Instructor", leadership: true,
      std: { age: "18 before training starts", prereqs: [
        "NAUI Open Water, Advanced Open Water, Rescue, Nitrox and Master Scuba Diver (or equivalents)",
        "Diving First Aid for Divers (DFA) or equivalent",
        "50 logged open water dives with at least 25 hours bottom time, varied in environment, depth and activity",
        "Unconditional medical approval for diving from a physician within the last 12 months", GEAR],
        dives: 2, depth: "40 m / 130 ft" + NO_DECO, page: 196 } },
    { agency: "NAUI", id: "naui-deep", name: "Deep Diver",
      std: { age: "15", prereqs: [AOW, GEAR], dives: 2, depth: "40 m / 130 ft" + NO_DECO, page: 159 } },
    { agency: "NAUI", id: "naui-drysuit", name: "Drysuit Diver",
      std: { age: "15" + JR, prereqs: ["Enrolled in a NAUI instructor-led course (e.g. Open Water) or " + OW], dives: 4,
        depth: "40 m / 130 ft" + NO_DECO, page: 129 } },
    { agency: "NAUI", id: "naui-experienced", name: "Experienced Scuba Diver",
      std: { age: "15", prereqs: ["No certification required", "Proof of at least 25 open water scuba dives"], dives: 4,
        divesNote: "The 4 Open Water course dives; or, if time or conditions don't allow, all Open Water skills in confined water plus at least 2 open water dives",
        depth: "18 m / 60 ft", page: 100 } },
    { agency: "NAUI", id: "naui-international", name: "International Diver", cert: "International Diver Recognition",
      std: { age: "10 (junior restrictions apply)", prereqs: ["Enrolled in a NAUI instructor-led course (e.g. Open Water) or " + OW], dives: 2,
        depth: "No maximum set; limited by the diver's capability, experience and certification", page: 401 } },
    { agency: "NAUI", id: "naui-intro", name: "Introduction to Scuba",
      std: { age: "8 for confined water, 10 for open water", prereqs: ["No certification required", "Novice swimming ability"], dives: 1,
        divesNote: "1 confined water dive, plus 1 optional open water dive for ages 10 and up",
        depth: "6 m / 20 ft confined, 12 m / 40 ft open water", page: 64 } },
    { agency: "NAUI", id: "naui-master", name: "Master Scuba Diver",
      std: { age: "15", prereqs: [AOW, "NAUI Rescue Scuba Diver or equivalent", GEAR], dives: 8, depth: "40 m / 130 ft" + NO_DECO, page: 125 } },
    { agency: "NAUI", id: "naui-night", name: "Night & Limited Visibility Diver",
      std: { age: "15" + JR, prereqs: [OW, GEAR], dives: 2, depth: "40 m / 130 ft" + NO_DECO, page: 161 } },
    { agency: "NAUI", id: "naui-nitrox", name: "Nitrox Diver", cert: "Enriched Air Nitrox (EANx) Diver",
      std: { age: "15" + JR, prereqs: ["Enrolled in a NAUI instructor-led open water course or " + OW, GEAR], dives: 0,
        divesNote: "2 open water dives encouraged, not required",
        depth: "40 m / 130 ft or a PO2 of 1.4 (1.6 contingency), whichever is less" + NO_DECO, page: 112 } },
    { agency: "NAUI", id: "open-water", app: "open-water", name: "Open Water Scuba Diver",
      std: { age: "15" + JR, prereqs: ["No certification required"], dives: 4, depth: "18 m / 60 ft", page: 83 } },
    { agency: "NAUI", id: "naui-dpv", name: "Recreational Diver Propulsion Vehicle", cert: "Recreational DPV Diver",
      std: { age: "15", prereqs: [AOW, "25 logged dives", GEAR], dives: 4, depth: "18 m / 60 ft" + NO_DECO, page: 135 } },
    { agency: "NAUI", id: "naui-hookah", name: "Recreational Hookah Diver",
      std: { age: "15" + JR, prereqs: ["No certification required"], dives: 4, depth: "18 m / 60 ft", page: 75 } },
    { agency: "NAUI", id: "naui-refresher", name: "Refresher Scuba",
      std: { age: "15" + JR, prereqs: [OW, "No diving in the last 12 months: water skills evaluation and confined water refresher before open water"],
        dives: null, divesNote: "No minimum set", depth: "No maximum set; limited by the diver's capability, experience and certification", page: 107 } },
    { agency: "NAUI", id: "rescue", app: "rescue", name: "Rescue Scuba Diver",
      std: { age: "15" + JR, prereqs: [OW, "Current CPR / First Aid and Emergency Oxygen (EO2), unless taught in the course", GEAR], dives: 2,
        depth: "18 m / 60 ft for rescue training" + NO_DECO, page: 120 } },
    { agency: "NAUI", id: "naui-scuba-diver", name: "Scuba Diver",
      std: { age: "15" + JR, prereqs: ["Novice swimming ability"], dives: 2, depth: "12 m / 40 ft", page: 68 } },
    { agency: "NAUI", id: "naui-sar", name: "Search & Recovery Diver",
      std: { age: "15" + JR, prereqs: [OW, GEAR], dives: 2, depth: "40 m / 130 ft" + NO_DECO, page: 167 } },
    { agency: "NAUI", id: "naui-skin", name: "Skin Diver",
      std: { age: "12 (junior certification 8–11)", prereqs: ["No certification required"], dives: 2, depth: "10 m / 33 ft", page: 328 } },
    { agency: "NAUI", id: "naui-skin-instructor", name: "Skin Diving Instructor", leadership: true,
      std: { age: "18 before training starts", prereqs: ["NAUI Skin Diver or Open Water Scuba Diver or equivalent",
        "Current Diving First Aid (DFA) or equivalent", "25 logged skin dives, varied in environment, depth and activity",
        "Unconditional medical approval for diving from a physician within the last 12 months", GEAR],
        dives: 1, depth: "", page: 358 } },
    { agency: "NAUI", id: "naui-sas", name: "Supplied Air Snorkeling",
      std: { age: "No minimum", prereqs: ["No certification required"], dives: 1, divesNote: "1 water session", depth: "Not applicable", page: 74 } },
    { agency: "NAUI", id: "naui-tandem", name: "Tandem Scuba Diver",
      std: { age: "10", prereqs: ["No certification required"], dives: 1, depth: "12 m / 40 ft", page: 61 } },
    { agency: "NAUI", id: "naui-archaeology", name: "Underwater Archaeology",
      std: { age: "15" + JR, prereqs: [OW, GEAR], dives: 2, depth: "40 m / 130 ft" + NO_DECO, page: 172 } },
    { agency: "NAUI", id: "naui-imaging", name: "Underwater Digital Imaging Diver",
      std: { age: "15" + JR, prereqs: [OW, GEAR], dives: 2, depth: "40 m / 130 ft" + NO_DECO, page: 174 } },
    { agency: "NAUI", id: "naui-hunter", name: "Underwater Hunting & Collector", cert: "Underwater Hunter and Collector",
      std: { age: "15" + JR, prereqs: [OW, GEAR], dives: 2, depth: "40 m / 130 ft" + NO_DECO, page: 177 } },
    { agency: "NAUI", id: "naui-naturalist", name: "Underwater Naturalist Diver",
      std: { age: "15" + JR, prereqs: [OW, GEAR], dives: 3, depth: "40 m / 130 ft" + NO_DECO, page: 179 } },
    { agency: "NAUI", id: "naui-wreck", name: "Wreck Diver (External Survey)",
      std: { age: "15" + JR, prereqs: [AOW, GEAR], dives: 2, depth: "40 m / 130 ft" + NO_DECO, page: 182 } },
    { agency: "NAUI", id: "naui-ice", name: "Ice Diver", cert: "Recreational Ice Diver",
      std: { age: "18", prereqs: [OW, "50 logged dives in a variety of conditions", GEAR], dives: 3,
        depth: "12 m / 40 ft, and no more than 30 m / 100 ft horizontally from the hole", page: 163 } },
    // Already in the app with a full skill matrix (not on the enroll list Jamie sent, kept so nothing disappears).
    { agency: "NAUI", id: "divemaster", app: "divemaster", name: "Divemaster", leadership: true,
      std: { age: "18 before training starts", prereqs: [
        "NAUI Open Water, Advanced Open Water, Rescue, Nitrox and Master Scuba Diver (or equivalents)",
        "Diving First Aid for Divers (DFA) or equivalent",
        "60 logged open water dives with at least 30 hours bottom time",
        "Unconditional medical approval for diving from a physician within the last 12 months", GEAR],
        dives: 10, divesNote: "20 open water Divemaster activities over at least 10 dives", depth: "40 m / 130 ft" + NO_DECO, page: 200 } },

    // ---------------- NAUI Technical ----------------
    { agency: "NAUI Technical", id: "naui-tech-intro", name: "Intro to Technical Diving", cert: "Introduction to Technical Diving",
      std: { age: "15", prereqs: ["NAUI EANx (Nitrox) Diver or equivalent", AOW, "At least 25 logged dives, 10 of them on EANx"], dives: 4,
        divesNote: "No dives in an overhead environment",
        depth: "18 m / 60 ft until the NAUI Technical Diver Skills Checklist is complete, then 40 m / 130 ft" + NO_DECO, page: 237 } },
    { agency: "NAUI Technical", id: "naui-tech-deco", name: "Technical Decompression Diver",
      std: { age: "18", prereqs: ["NAUI Master Scuba Diver or equivalent", "NAUI Introduction to Technical Diving or equivalent",
        "At least 50 logged dives, 15 of them on EANx"], dives: 6,
        divesNote: "Includes an evaluated simulated-decompression dive (4 stops and a gas switch) before any required-stop dives",
        depth: "18 m / 60 ft until the NAUI Technical Diver Skills Checklist is complete, then 46 m / 150 ft", page: 241 } },

    // ---------------- TDI (standards not entered yet) ----------------
    { agency: "TDI", id: "tdi-intro-tech", name: "Intro to Technical Diving", std: null },
    { agency: "TDI", id: "tdi-dpv", name: "Technical Diver Propulsion Vehicle", std: null }
  ];

  // Short course descriptions for the public "Available classes" page, written for students in our own words
  // from the 2026 NAUI Standards and Policies Manual. Edit freely; a course without one shows only its standards.
  const ABOUT = {
    "naui-intro": "A first try at scuba in a pool, with an instructor right beside you. No certification, just a safe taste of breathing underwater, with an optional open water dive for ages 10 and up.",
    "naui-tandem": "A guided scuba experience for non-divers. Your instructor stays in direct control the whole dive, so you can enjoy the underwater world before committing to a full course.",
    "naui-sas": "Surface snorkeling with a supplied-air system, so you can float and breathe comfortably with your face in the water. A relaxed first step for anyone nervous about the water.",
    "naui-skin": "Learn to dive with mask, fins and snorkel on a breath hold: equipment, breathing, surface dives and water safety. A great start for younger divers and future scuba students.",
    "naui-scuba-diver": "An entry-level scuba certification for diving to 40 feet with a dive professional. A shorter path into the water that can later be upgraded to Open Water Scuba Diver.",
    "naui-hookah": "Learn to dive on a surface-supplied (hookah) air system: how it works, how to dive it safely, and the skills to handle problems, to a maximum of 60 feet.",
    "naui-adaptive": "Scuba training adapted for divers with physical or other challenges. Skills and pacing are adjusted to each student, with a buddy team trained to support them.",
    "open-water": "The full scuba certification. Classroom, pool and four open water dives teach you to plan and make your own dives with a buddy to 60 feet, anywhere in the world.",
    "naui-experienced": "For people who already dive but never earned a recognized certification. We review your skills and knowledge and certify you as an Open Water diver.",
    "naui-refresher": "Been out of the water for a while? Review the key skills and safety knowledge in a pool session before getting back to open water diving.",
    "naui-international": "Prepare to dive abroad: travel planning, local customs and regulations, and diving with operators in other countries.",
    "naui-nitrox": "Learn to plan and dive with enriched air nitrox for longer no-decompression times, including oxygen limits, analyzing your own gas and choosing the right mix.",
    "naui-aow": "The next step after Open Water. Six guided dives build real experience in navigation, night or limited visibility, and deep diving, plus three specialties you choose.",
    "rescue": "Learn to prevent, recognize and handle diving emergencies: self-rescue, helping a tired or panicked diver, and bringing an unresponsive diver to safety. Many divers call it their favorite course.",
    "naui-master": "NAUI's top recreational rating. Advanced theory and eight open water dives covering deep, navigation, night, search and recovery and more, for confident and capable divers.",
    "naui-deep": "Plan and make dives deeper than 60 feet, down to 130 feet, while managing gas, narcosis and no-decompression limits.",
    "naui-drysuit": "Stay warm in cold water. Learn to choose, use and care for a drysuit, control your buoyancy in it, and handle problems like a stuck inflator.",
    "naui-night": "Dive after dark and in low visibility: lights, communication, navigation and staying together with your buddy.",
    "naui-sar": "Find and bring up lost objects using search patterns, lift bags and good planning.",
    "naui-archaeology": "An introduction to underwater archaeology: surveying, mapping and documenting sites, and the laws and ethics that protect them.",
    "naui-imaging": "Take better underwater photos and video: camera handling, lighting, composition and protecting the reef while you shoot.",
    "naui-hunter": "Hunt and collect responsibly: the regulations, safe techniques and conservation practices for game and specimen collecting.",
    "naui-naturalist": "Learn about the plants, animals and ecosystems you see on every dive, and how to observe them without disturbing them.",
    "naui-wreck": "Explore wrecks safely from the outside: research, planning, hazards, and surveying a wreck without entering it.",
    "naui-ice": "Dive under the ice with a tended line, safety team and cold-water equipment. A specialty for experienced divers who want an unforgettable dive.",
    "naui-dpv": "Learn to plan and ride a diver propulsion vehicle (scooter) safely, covering more distance with less effort.",
    "naui-ai": "Your first leadership rating. Learn to assist NAUI Instructors in the classroom, pool and open water, and build the skills to become an instructor.",
    "divemaster": "NAUI's professional dive leader rating. Learn to supervise and lead certified divers, assist with training, and organize dive activities.",
    "naui-skin-instructor": "Become certified to teach skin diving (mask, fins and snorkel) courses on your own.",
    "naui-tech-intro": "Your first step into technical diving: gas planning, equipment configuration and the skills tech divers rely on, within no-decompression limits.",
    "naui-tech-deco": "Plan and make staged decompression dives to 150 feet using nitrox and oxygen-rich gases for decompression.",
    "tdi-intro-tech": "TDI's introduction to technical diving: gas planning, equipment configuration, trim and the core skills behind technical diving.",
    "tdi-dpv": "Use a diver propulsion vehicle on technical dives: rigging, trim, towing and handling problems on a scooter."
  };
  // Where to read the agency's own information about its courses.
  const AGENCY_SITES = { "NAUI": "https://www.naui.org/", "NAUI Technical": "https://www.naui.org/", "TDI": "https://www.tdisdi.com/" };
  COURSES.forEach(c => { c.cert = c.cert || c.name; c.app = c.app || c.id; c.fullName = c.agency + " " + c.name; c.about = c.about || ABOUT[c.id] || ""; });

  // Certifications people commonly hold that aren't on the course list (offered on every agency).
  const OTHER_CERTS = ["Divemaster", "Instructor", "First Aid / CPR", "Diving First Aid (DFA)", "Emergency Oxygen Provider (EO2)"];
  // Agencies a student can pick for a certification they already hold.
  const CERT_AGENCIES = AGENCIES.concat(["PADI", "SSI", "SDI", "RAID", "GUE", "IANTD", "NASE", "BSAC", "CMAS", "Other"]);
  const GENERIC = ["Scuba Diver", "Open Water Diver", "Advanced Open Water Diver", "Enriched Air Nitrox Diver", "Rescue Diver",
    "Master Scuba Diver", "Deep Diver", "Drysuit Diver", "Night Diver", "Wreck Diver", "Divemaster", "Assistant Instructor", "Instructor"];

  function byAgency() { return AGENCIES.map(a => ({ agency: a, courses: COURSES.filter(c => c.agency === a) })); }
  function find(id) { return COURSES.find(c => c.id === id || c.app === id) || null; }
  // Certification names to suggest for an agency (the catalog's courses for NAUI / NAUI Technical / TDI).
  function certNames(agency) {
    const own = COURSES.filter(c => c.agency === agency).map(c => c.cert);
    const base = own.length ? own : GENERIC;
    return base.concat(OTHER_CERTS.filter(x => !base.includes(x)));
  }

  window.LDCatalog = { AGENCIES, AGENCY_SITES, CERT_AGENCIES, COURSES, byAgency, find, certNames };
})();
