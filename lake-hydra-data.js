/* Limitless Diving — Lake Hydra survey data, for the Site maps pages.
   Not surveyed yet: the map starts with just its starting point (origin, drawn at 0, 0). Divers add the
   lines they survey from the map's editor, and an Admin publishes them; the published map in the database
   (site_maps, id "lake-hydra") is then drawn instead of this file. Same format as bonnie-castle-data.js. */
(function (root) {
  const data = {
    id: "lake-hydra",
    title: "Lake Hydra",
    place: "",
    subtitle: "A Limitless Diving survey, just getting started",
    credit: "© 2026 Limitless Diving",
    version: "",
    surveyors: [],
    origin: "ENTRY",
    originPoint: {},
    landmarks: { ENTRY: "Entry point" },
    aliases: {},
    runNames: {},
    plan: [],
    runs: {},
    unusedRuns: [],
  };
  root.SITE_MAPS = root.SITE_MAPS || {};
  root.SITE_MAPS["lake-hydra"] = data;
  if (typeof module === "object" && module.exports) module.exports = data;
})(typeof window !== "undefined" ? window : globalThis);
