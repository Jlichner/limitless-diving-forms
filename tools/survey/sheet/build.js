// Builds LimitlessDiving.gs, the one file to paste into the sheet's Extensions → Apps Script:
// survey-geometry.js and survey-sheet.js (the same code the website uses) followed by menu.gs. Run: node tools/survey/sheet/build.js
const fs = require("fs"), path = require("path");
const here = __dirname, root = path.join(here, "../../..");
const out = "// Limitless Diving: built by tools/survey/sheet/build.js from survey-sheet.js and menu.gs. Paste all of it into\n" +
  "// Extensions → Apps Script (replacing what's there), save, and reload the sheet.\n\n" +
  fs.readFileSync(path.join(root, "survey-geometry.js"), "utf8") + "\n" + fs.readFileSync(path.join(root, "survey-sheet.js"), "utf8") + "\n" + fs.readFileSync(path.join(here, "menu.gs"), "utf8");
if (process.argv[2] === "--check") {
  const cur = fs.existsSync(path.join(here, "LimitlessDiving.gs")) ? fs.readFileSync(path.join(here, "LimitlessDiving.gs"), "utf8") : "";
  if (cur !== out) { console.log("LimitlessDiving.gs is out of date: run node tools/survey/sheet/build.js"); process.exit(1); }
  console.log("LimitlessDiving.gs is up to date");
} else { fs.writeFileSync(path.join(here, "LimitlessDiving.gs"), out); console.log("wrote LimitlessDiving.gs"); }
