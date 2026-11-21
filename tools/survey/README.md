# Survey map tools

Scripts that bring a survey from the underwatersurvey project (Python + matplotlib) to the Site maps pages.

| Script | What it does |
|---|---|
| `export_data.py data.py raw.json` | Reads `data.py` as text (never runs it) and writes every run of line as JSON, keeping each entry's end-of-line comment as a note. |
| `build_data.py raw.json bonnie-castle-data.js` | Adds the draw order from `the_survey.py` (`PLAN`), readable names for runs and landmarks, and the credits, and writes the site's data file. |
| `build_icons.py <icons dir> <tabler outline dir> survey-icons.js` | Puts the project's hand-made icons in as PNG data, and swaps the paid Glyphicons Pro icons for free Tabler icons (`npm i @tabler/icons`). |
| `python_reference.py out.json` | Run inside the underwatersurvey folder: runs `the_survey.py` and records every line, marker and landmark it draws. |
| `compare.js bonnie-castle-data.js survey-geometry.js out.json` | Checks the web map's geometry against that recording. |

When this was set up (November 2026) the web map matched the original program exactly: 298 lines, 225 stakes, tie-offs and arrows, and 47 landmark positions.

## Adding a site that hasn't been surveyed yet

Copy `lake-hydra-data.js` and `lake-hydra-map.html`, change the id, title and data file, and load the new data file in `site-maps.html`. The data's `origin` names the starting point every line is measured from (drawn at 0, 0); divers then add lines from it in the map's editor, and an Admin publishes them.

## Layers, ratings, photos and GPS (survey-layers.js, survey-ratings.js)

- `test-ratings.js`: tests for rating lines (green circle stays on the main survey; blue, black and double black each move to a restricted layer). Run `node tools/survey/test-ratings.js`.
- A map is placed on the earth by `data.georef` (see `SurveyGeometry.georef`): one landmark's latitude/longitude plus the magnetic declination, or two landmarks. It is published like any other change, so it's in the map's history.
- Restricted lines live only in `site_map_layers` (readable by granted members). They must also be taken out of the site's public data file (e.g. `bonnie-castle-data.js`), which anyone can read.
