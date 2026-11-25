"""Export the survey runs in data.py to JSON for the web map.

Reads data.py as text (it is never imported), so landmark names stay exactly as
written, and keeps each entry's end-of-line comment as a "note".

Usage: python3 export_data.py path/to/data.py out.json
"""
import ast
import io
import json
import sys
import tokenize

ENTRY_TYPES = {
    'SurveyedLine', 'UnsurveyedLine', 'RemovedLine', 'MarinaLine', 'PlatformLine', 'Jump',
    'SaveLandmark', 'Stake', 'SavedStake', 'RemovedStake', 'TieOff', 'Arrow',
}
# Field order for SaveLandmark when given positionally, e.g. SaveLandmark(Landmark.X, ...)
POSITIONAL = {'SaveLandmark': ['landmark', 'icon_path'], 'SavedStake': ['color', 'marker']}


def value(node):
    if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name) and node.value.id == 'Landmark':
        return node.attr
    return ast.literal_eval(node)


def main(src_path, out_path):
    src = open(src_path).read()
    tree = ast.parse(src)

    comments = {}
    for tok in tokenize.generate_tokens(io.StringIO(src).readline):
        if tok.type == tokenize.COMMENT:
            comments[tok.start[0]] = tok.string.lstrip('#').strip()

    landmark_ids, runs, order = {}, {}, []
    for node in tree.body:
        if isinstance(node, ast.ClassDef) and node.name == 'Landmark':
            for stmt in node.body:
                if isinstance(stmt, ast.Assign):
                    landmark_ids[stmt.targets[0].id] = ast.literal_eval(stmt.value)
        if not (isinstance(node, ast.Assign) and isinstance(node.value, ast.Tuple)):
            continue
        name = node.targets[0].id
        entries = []
        for el in node.value.elts:
            if not (isinstance(el, ast.Call) and isinstance(el.func, ast.Name) and el.func.id in ENTRY_TYPES):
                raise SystemExit(f'{name}: unexpected entry on line {el.lineno}')
            entry = {'type': el.func.id}
            for i, arg in enumerate(el.args):
                entry[POSITIONAL[el.func.id][i]] = value(arg)
            for kw in el.keywords:
                entry[kw.arg] = value(kw.value)
            note = comments.get(el.end_lineno) or comments.get(el.lineno)
            if note:
                entry['note'] = note
            entries.append(entry)
        runs[name] = entries
        order.append(name)

    # Landmarks that share an id in data.py are the same landmark to the old program.
    by_id = {}
    for lm, i in landmark_ids.items():
        by_id.setdefault(i, []).append(lm)
    aliases = {lm: names[0] for names in by_id.values() for lm in names[1:]}

    json.dump({'landmarks': list(landmark_ids), 'aliases': aliases, 'runs': runs},
              open(out_path, 'w'), indent=1)
    print(f'{len(runs)} runs, {sum(len(r) for r in runs.values())} entries, '
          f'{len(landmark_ids)} landmarks, aliases: {aliases}')


if __name__ == '__main__':
    main(*sys.argv[1:])
