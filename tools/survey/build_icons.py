"""Build survey-icons.js: the map's landmark icons as data the page can draw directly.
Hand-made icons from the project's icons/ folder become PNG data URIs. Glyphicons Pro icons (paid, can't
be published) are swapped for free Tabler icons (MIT licence), kept as inline SVG.
Usage: python3 build_icons.py <repo icons dir> <tabler outline dir> out.js
"""
import base64, json, os, re, sys

icons_dir, tabler_dir, out = sys.argv[1:]
GLYPH_TO_TABLER = {
    'glyphicons-basic-6-car': 'car', 'glyphicons-basic-14-beach-umbrella': 'beach', 'glyphicons-basic-258-anchor': 'anchor',
    'glyphicons-basic-384-basketball': 'ball-basketball', 'glyphicons-basic-273-coffee-mug': 'coffee',
    'glyphicons-basic-70-gift': 'gift', 'glyphicons-basic-233-lasso': 'lasso',
    'glyphicons-basic-256-oxygen-bottles': 'scuba-diving-tank', 'glyphicons-basic-408-sailboat': 'sailboat',
    'glyphicons-basic-677-car-wheel': 'steering-wheel', 'glyphicons-basic-137-cogwheel': 'wheel',
    'glyphicons-basic-154-square-empty': 'square', 'glyphicons-basic-500-skull': 'skull',
}
# Extra symbols (Jamie 2026-11-26: plane, van, car, helicopter), saved as icons/<name>.svg. Tabler has no van, so
# van.svg is drawn in the same style and kept next to this script.
EXTRA_SVG = {'plane': 'plane', 'van': os.path.join(os.path.dirname(os.path.abspath(__file__)), 'van.svg'),
             'car': 'car', 'helicopter': 'helicopter'}
icons = {}
for f in sorted(os.listdir(icons_dir)):
    if f.endswith('.png') and f != 'north.png':
        icons['icons/' + f] = {'png': 'data:image/png;base64,' + base64.b64encode(open(os.path.join(icons_dir, f), 'rb').read()).decode()}
for glyph, name in GLYPH_TO_TABLER.items():
    svg = open(os.path.join(tabler_dir, name + '.svg')).read()
    svg = re.sub(r'<!--.*?-->', '', svg, flags=re.S).strip()
    svg = re.sub(r'\s*class="[^"]*"', '', svg).replace('\n', '').replace('  ', ' ')
    svg = svg.replace('<svg ', '<svg aria-hidden="true" ', 1)
    for suffix in ('@2x', '@3x'):
        icons[f'glyphicons-pro/glyphicons-basic-2-3/png/{glyph}{suffix}.png'] = {'svg': svg}
for key, src in EXTRA_SVG.items():
    svg = open(src if src.endswith('.svg') else os.path.join(tabler_dir, src + '.svg')).read()
    svg = re.sub(r'<!--.*?-->', '', svg, flags=re.S).strip()
    svg = re.sub(r'\s*class="[^"]*"', '', svg).replace('\n', '').replace('  ', ' ')
    icons['icons/' + key + '.svg'] = {'svg': svg.replace('<svg ', '<svg aria-hidden="true" ', 1)}
with open(out, 'w') as fh:
    fh.write('/* Limitless Diving — landmark icons for survey-map.html, keyed by the icon_path used in the survey data.\n'
             '   PNGs are the hand-made icons from the underwatersurvey project; SVGs are Tabler icons (MIT licence,\n'
             '   tabler.io/icons) standing in for the original Glyphicons Pro icons. Built by tools/survey/build_icons.py. */\n')
    fh.write('(typeof window !== "undefined" ? window : globalThis).SURVEY_ICONS = ' + json.dumps(icons, indent=0) + ';\n')
print(len(icons), 'icons,', os.path.getsize(out), 'bytes')
