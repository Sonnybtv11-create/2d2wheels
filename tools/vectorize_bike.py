# Vectorise a side-on bike photo into the colour layers used by js/traced/*.js.
#
# Needs: pip install opencv-python-headless numpy
# Usage: python3 tools/vectorize_bike.py surron-lbx photo.png js/traced/surron-lbx.js
#        python3 tools/vectorize_bike.py stark-varg-mx photo.png js/traced/stark-varg-mx.js
#
# The photos aren't included in the repo:
#   surron-lbx     radmotousa.com "surron-light-bee-x-2026-green-hd.jpg", 1600x1600,
#                  mirrored to face right
#   stark-varg-mx  elmox.de Stark Varg MX product image (red), 700x700, facing right
# All coordinates in CONFIGS are pixels on those images.
#
# How it works: the photo is (optionally) upscaled, smoothed with an
# edge-preserving filter, split by hue into colour classes (frame green,
# decal yellow, red bodywork, neutrals...), and each class is cut into shade
# bands using a blurred brightness, so the bands follow the real lighting
# rather than surface noise. Anything the game draws itself is cut out first:
# the wheels (they spin), the chain, and every part that can be upgraded in
# the workshop (fork, rear shock, bars and lamp), so their colours can change.
# Each band's mask is cleaned up, traced with OpenCV contours and simplified
# into polygons.
import sys, json
import cv2, numpy as np

CONFIGS = {
    'surron-lbx': {
        'title': 'Sur-Ron Light Bee X, vectorised from a side-on product photo (radmotousa.com,\n'
                 ' * green 2026 model, mirrored to face right)',
        'upscale': 1,
        'rear': (284, 870), 'front': (1334, 868), 'tyre': 259,
        'ground': 1095, 'margin': (4, 1588),
        'classes': [
            # name, hue lo..hi (OpenCV 0..180), sat lo, val lo, extra
            ('y', 20, 30, 165, 170),          # decal yellow
            ('w', 24, 34, 70, 215),           # pale lemon decal
            ('g', 22, 48, 55, 45),            # frame green
            ('o', 4, 21, 80, 55),             # gold / copper
            ('r', -1, -1, 110, 70),           # red (wraps around 0)
        ],
        'bands': {'k': ([30, 50, 75, 105, 140, 180], 3), 'g': ([110, 150], 18)},
        'keep_in_rear': ['g'],                # the swingarm is frame green
        'bridge': (lambda xx, yy, disc, R, T: disc(R, T + 40) & (xx > 200) & (yy > 640), ['g0', 'g1'], 11),
        'cut': [
            ('corridor', (1045, 292), (1334, 868), 27),          # fork, drawn by code
            ('rect', (978, 188), (1186, 318)),                   # bars, clamp, lamp
        ],
        'cut_bright': [('corridor', (714, 530), (646, 694), 27)], # shock spring and reservoir
        'drop_classes': {'o': [('rect', (300, 770), (760, 1100))]},  # chain
    },
    'stark-varg-mx': {
        'title': 'Stark Varg MX, vectorised from a side-on product photo (elmox.de, red)',
        'upscale': 2.5,
        'rear': (140, 447), 'front': (556, 445), 'tyre': 98,
        'ground': 528, 'margin': (2, 698),
        'classes': [
            ('r', -1, -1, 90, 50),
            ('o', 8, 30, 50, 60),             # fork stanchions and the chain
        ],
        'bands': {'k': ([30, 55, 85, 120, 160, 200, 230], 1.5), 'r': ([95, 140, 190], 3)},
        'keep_in_rear': [],
        'keep_rear_poly': [(128, 436), (268, 386), (292, 398), (292, 420), (140, 464), (124, 454)],  # swingarm
        'cut': [
            ('corridor', (432, 196), (556, 445), 15),           # fork
            ('rect', (368, 172), (446, 214)),                   # bars and top clamp
            ('poly', [(440, 203), (462, 200), (494, 244), (472, 252), (452, 242)]),  # number plate
        ],
        'cut_bright': [('corridor', (258, 340), (272, 402), 9)],  # shock
        'drop_classes': {'o': [('rect', (0, 0), (700, 700))]},
    },
}

bike, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
C = CONFIGS[bike]
S = C['upscale']
raw = cv2.imread(src)
if S != 1:
    raw = cv2.resize(raw, None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC)
P = lambda pt: (pt[0] * S, pt[1] * S)
REAR, FRONT, TYRE = P(C['rear']), P(C['front']), C['tyre'] * S

# smooth flat areas but keep edges, so the posterised regions come out clean
im = cv2.bilateralFilter(raw, 9, 30, 7)
im = cv2.bilateralFilter(im, 9, 30, 7)
H, W = im.shape[:2]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV).astype(np.int32)
h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
yy, xx = np.mgrid[0:H, 0:W]

bg = (v > 226) & (s < 32)
bg |= (yy > C['ground'] * S) | (xx > C['margin'][1] * S) | (xx < C['margin'][0] * S)
fg = ~bg

def disc(c, r):
    return (xx - c[0]) ** 2 + (yy - c[1]) ** 2 < r * r

def region(spec):
    kind = spec[0]
    if kind == 'rect':
        (x0, y0), (x1, y1) = P(spec[1]), P(spec[2])
        return (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)
    if kind == 'poly':
        m = np.zeros((H, W), np.uint8)
        cv2.fillPoly(m, [np.array([P(p) for p in spec[1]], np.int32)], 1)
        return m > 0
    if kind == 'corridor':
        a, b, hw = np.array(P(spec[1]), float), np.array(P(spec[2]), float), spec[3] * S
        d = b - a
        t = np.clip(((xx - a[0]) * d[0] + (yy - a[1]) * d[1]) / (d @ d), 0, 1)
        return (xx - (a[0] + t * d[0])) ** 2 + (yy - (a[1] + t * d[1])) ** 2 < hw * hw
    raise ValueError(kind)

# colour classes, first match wins; everything left over is neutral
classes = {}
taken = np.zeros((H, W), bool)
for name, hlo, hhi, slo, vlo in C['classes']:
    hue = ((h < 6) | (h > 166)) if hlo < 0 else ((h >= hlo) & (h <= hhi))
    m = fg & ~taken & hue & (s > slo) & (v > vlo)
    classes[name] = m
    taken |= m
classes['k'] = fg & ~taken

for name, specs in C.get('drop_classes', {}).items():
    for spec in specs:
        classes[name] &= ~region(spec)

labels = {}
def smooth_v(mask, sigma):
    m = mask.astype(np.float32)
    num = cv2.GaussianBlur(v.astype(np.float32) * m, (0, 0), sigma)
    den = cv2.GaussianBlur(m, (0, 0), sigma) + 1e-6
    return num / den
for name, mask in classes.items():
    if name in C['bands']:
        cuts, sigma = C['bands'][name]
        vs = smooth_v(mask, sigma * S)
        lo = -1
        for i, hi in enumerate(cuts + [999]):
            labels[f'{name}{i}'] = mask & (vs > lo) & (vs <= hi)
            lo = hi
    else:
        labels[name] = mask

# Parts the game draws: wheels, chain, fork, bars, lamp, shock.
front_w = disc(FRONT, TYRE + 4)
rear_w = disc(REAR, TYRE + 2)
keep_rear = region(('poly', C['keep_rear_poly'])) if C.get('keep_rear_poly') else np.zeros((H, W), bool)
cut = np.zeros((H, W), bool)
for spec in C['cut']: cut |= region(spec)
cut_bright = np.zeros((H, W), bool)
for spec in C.get('cut_bright', []): cut_bright |= region(spec)
for k in labels:
    labels[k] &= ~front_w & ~cut
    if not any(k.startswith(p) for p in C['keep_in_rear']):
        labels[k] &= ~rear_w | keep_rear
    # in the shock window, drop everything but the darkest shades, so the
    # code-drawn shock behind shows through where its spring was
    if not (k.startswith('k') and k[1:].isdigit() and int(k[1:]) <= 2):
        labels[k] &= ~cut_bright

def clean(mask, close=3, open_=2):
    close, open_ = max(1, round(close * S)), max(1, round(open_ * S))
    m = mask.astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((close, close), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((open_, open_), np.uint8))
    m = cv2.medianBlur(m, 7)
    return m

def rings(m, min_area=60, eps=1.3):
    cs, _ = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    res = []
    for c in cs:
        if abs(cv2.contourArea(c)) < min_area * S * S: continue
        a = cv2.approxPolyDP(c, eps * S, True).reshape(-1, 2)
        if len(a) < 3: continue
        res.append([round(float(q) / S, 1) if S != 1 else int(q) for q in a.flatten()])
    return res

if C.get('bridge'):
    fn, keys, k = C['bridge']
    zone = fn(xx, yy, disc, REAR, TYRE)
    for key in keys:
        if key in labels:
            m = labels[key].astype(np.uint8)
            closed = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((k, k), np.uint8)) > 0
            labels[key] = np.where(zone, closed, labels[key])

layers = []
union = np.zeros((H, W), bool)
for k in labels: union |= labels[k]
base = clean(union, close=5, open_=3)
layers.append({'id': 'base', 'c': '#1a1b1e', 'rings': rings(base, 120, 1.2)})
order = [k for k in labels if k != 'k0'] + ['k0']
for k in order:
    m = clean(labels[k])
    sel = (m > 0) & labels[k]
    if sel.sum() == 0: continue
    col = np.percentile(raw[sel], 85 if k == 'y' else 50, axis=0)
    hexc = '#%02x%02x%02x' % (int(col[2]), int(col[1]), int(col[0]))
    rs = rings(m)
    if rs: layers.append({'id': k, 'c': hexc, 'rings': rs})

pts = sum(len(r) // 2 for L in layers for r in L['rings'])
print('layers', [(L['id'], L['c'], len(L['rings'])) for L in layers], 'points', pts)
data = {'rear': C['rear'], 'front': C['front'], 'tyre': C['tyre'], 'layers': layers}
with open(out, 'w') as f:
    f.write('/*\n * ' + C['title'] + ', by posterising it into colour layers\n'
            ' * and tracing each layer (tools/vectorize_bike.py). Coordinates are photo pixels;\n'
            ' * bikeart.js calibrates them with `rear`, `front` (axle centres) and `tyre` (tyre radius).\n */\n')
    f.write("(function (root) {\n  'use strict';\n  const T = ")
    f.write(json.dumps(data, separators=(',', ':')))
    f.write(";\n  if (typeof module !== 'undefined' && module.exports) module.exports = T;\n")
    f.write(f"  else (root.TRACED = root.TRACED || {{}})['{bike}'] = T;\n}})(typeof self !== 'undefined' ? self : this);\n")
