"""Run the original the_survey.py and record what it draws, for comparing with the web version.

Usage (from a copy of the repo): python3 python_reference.py out.json
Records every line segment and marker passed to plt.plot, plus every saved landmark position.
"""
import json
import runpy
import os
import sys

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

segments, markers = [], []
_plot = plt.plot


def recording_plot(x, y, *args, **kwargs):
    if isinstance(x, (list, tuple)) and len(x) == 2:
        segments.append({'x': [float(v) for v in x], 'y': [float(v) for v in y],
                         'color': kwargs.get('color'), 'linestyle': kwargs.get('linestyle')})
    else:
        markers.append({'x': float(x), 'y': float(y), 'color': kwargs.get('color'),
                        'marker': str(kwargs.get('marker'))})
    return _plot(x, y, *args, **kwargs)


plt.plot = recording_plot
sys.path.insert(0, os.getcwd())
runpy.run_path('the_survey.py', run_name='__main__')

base = sys.modules["base"]
landmarks = {lm.name: [float(v) for v in xy] for lm, xy in base.get_landmark_coordinates().items()}
json.dump({'segments': segments, 'markers': markers, 'landmarks': landmarks,
           'total_surveyed': float(base.total_surveyed())}, open(sys.argv[1], 'w'))
print(f'{len(segments)} segments, {len(markers)} markers, {len(landmarks)} landmarks')
