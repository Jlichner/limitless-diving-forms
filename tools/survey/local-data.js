// The full survey data for the tests. The website's own data files have only titles (the survey is in the
// database, for members), so the tests read a local copy from tools/survey/local/ (not in the repository).
// Make it with build_data.py, or copy bonnie-castle-data.js from the project files into tools/survey/local/.
const fs = require("fs"), path = require("path");
module.exports = site => {
  const p = path.join(__dirname, "local", site + "-data.js");
  if (!fs.existsSync(p)) { console.error(`Missing ${p}: see tools/survey/README.md (the full survey isn't in the repository).`); process.exit(2); }
  return require(p);
};
