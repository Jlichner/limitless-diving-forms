/* Limitless Diving — Bonnie Castle Scuba Park, for the Site maps pages: the title and credits only.
   The survey itself (every line, stake and landmark) is in the database (site_maps, id "bonnie-castle"), where only
   logged-in members with a Site maps access level can read it. It is loaded once from the private seed file
   (site-maps-seed-bonnie-castle.sql in the project files), not kept in the website. tools/survey/build_data.py
   makes the full data file from the underwatersurvey project, into tools/survey/local/ (not in the repository). */
(function (root) {
  const data = {
    "id": "bonnie-castle",
    "privateSurvey": true,
    "title": "Bonnie Castle Scuba Park",
    "place": "Alexandria Bay, New York (St. Lawrence River)",
    "subtitle": "A project of Bonnie Castle Resort, All About Scuba, Blue Foot Diving, and Northeast Underwater Explorers",
    "credit": "©2026 Jamie M Lichner",
    "creditText": "Surveyed by Ben Rother, Brian Chu, Christian Lundkvist, Doug Dwyer, Jamie Lichner, JP Vanier, Lisa Goodlin, Mike Burr, Scott Fuller, Stephanie Yang, Michael Hunt, Bob Sherwood, Lauren Palmateer. Map web program by Jamie Lichner with inspiration from Stephanie Yang and Michael Hunt.\n©2026 Jamie M Lichner.",
    "version": "v1.1 September 2021",
    "surveyors": [
      "Ben Rother",
      "Brian Chu",
      "Christian Lundkvist",
      "Doug Dwyer",
      "Jamie Lichner",
      "JP Vanier",
      "Lisa Goodlin",
      "Mike Burr",
      "Scott Fuller",
      "Stephanie Yang"
    ],
    "origin": "BAR",
    "originPoint": {},
    "landmarks": {
      "BAR": "Bar"
    },
    "aliases": {},
    "runNames": {},
    "plan": [],
    "runs": {},
    "unusedRuns": []
  };
  root.SITE_MAPS = root.SITE_MAPS || {};
  root.SITE_MAPS["bonnie-castle"] = data;
  if (typeof module === "object" && module.exports) module.exports = data;
})(typeof window !== "undefined" ? window : globalThis);
