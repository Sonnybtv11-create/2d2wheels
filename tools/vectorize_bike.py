# Vectorise a side-on bike photo into the colour layers used by js/traced/*.js.
#
# Needs: pip install opencv-python-headless numpy
# Usage: python3 tools/vectorize_bike.py photo.png js/traced/surron-lbx.js
#
# The photo isn't included in the repo. The Sur-Ron layers came from the
# radmotousa.com product image "surron-light-bee-x-2026-green-hd.jpg" at
# 1600x1600, mirrored to face right. REAR/FRONT/TYRE below are measured on that
# image, and the chain and swingarm zones are specific to it; adjust them
# for another photo.
#
# How it works: the photo is smoothed with an edge-preserving filter, split by
# hue into frame green, decal yellow, fork gold, red and neutrals, and each
# class is cut into shade bands using a blurred brightness so the bands follow
# the real lighting. Wheels, the lower fork legs and the chain are removed
# because the game draws those itself (they spin and move). Each band's mask is
# cleaned up, traced with OpenCV contours and simplified into polygons.
import sys, json
import cv2, numpy as np

src, out = sys.argv[1], sys.argv[2]
REAR, FRONT, TYRE = (284, 870), (1334, 868), 259
raw = cv2.imread(src)
# smooth flat areas but keep edges, so the posterised regions come out clean
im = cv2.bilateralFilter(raw, 9, 30, 7)
im = cv2.bilateralFilter(im, 9, 30, 7)
H, W = im.shape[:2]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV).astype(np.int32)
h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]

bg = (v > 226) & (s < 32)
yy, xx = np.mgrid[0:H, 0:W]
bg |= (yy > 1095) | (xx > 1588) | (xx < 4)   # ground shadow, image border
fg = ~bg

def disc(c, r):
    return (xx - c[0]) ** 2 + (yy - c[1]) ** 2 < r * r

yellow = fg & (h >= 20) & (h <= 34) & (s > 140) & (v > 150)
green = fg & ~yellow & (h >= 22) & (h <= 48) & (s > 55) & (v > 45)
gold = fg & ~yellow & ~green & (h >= 4) & (h <= 21) & (s > 80) & (v > 55)
red = fg & ((h < 4) | (h > 168)) & (s > 110) & (v > 70)
neutral = fg & ~yellow & ~green & ~gold & ~red

labels = {}
# Shade bands follow a blurred brightness so they track the real light
# falloff instead of surface noise. Blur within each class only.
def smooth_v(mask, sigma):
    m = mask.astype(np.float32)
    num = cv2.GaussianBlur(v.astype(np.float32) * m, (0, 0), sigma)
    den = cv2.GaussianBlur(m, (0, 0), sigma) + 1e-6
    return num / den
def bands(prefix, mask, cuts, sigma=4):
    vs = smooth_v(mask, sigma)
    lo = -1
    for i, hi in enumerate(cuts + [999]):
        labels[f'{prefix}{i}'] = mask & (vs > lo) & (vs <= hi)
        lo = hi
bands('k', neutral, [30, 50, 75, 105, 140, 180], 3)
bands('g', green, [95, 125, 155, 185], 6)
labels['y'] = yellow
bands('o', gold, [85, 125, 165], 3)
labels['r'] = red

# Wheels, discs, the front fork's lower legs and the chain are drawn by code.
front = disc(FRONT, TYRE + 4)
rear = disc(REAR, TYRE + 2)
chain_zone = (yy > 770) & (xx > 300) & (xx < 760)
for k in labels:
    labels[k] &= ~front
    if not k.startswith('g'):
        labels[k] &= ~rear
    if k.startswith('o'):
        labels[k] &= ~chain_zone

def clean(mask, close=3, open_=2):
    m = mask.astype(np.uint8) * 255
    if close: m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((close, close), np.uint8))
    if open_: m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((open_, open_), np.uint8))
    m = cv2.medianBlur(m, 7)
    return m

def rings(m, min_area=60, eps=1.3):
    cs, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    res = []
    for c in cs:
        if abs(cv2.contourArea(c)) < min_area: continue
        a = cv2.approxPolyDP(c, eps, True).reshape(-1, 2)
        if len(a) < 3: continue
        res.append(a.flatten().tolist())
    return res

def bridge(mask, region, k):
    m = mask.astype(np.uint8)
    closed = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((k, k), np.uint8)) > 0
    return np.where(region, closed, mask)

swing = disc(REAR, TYRE + 40) & (xx > 200) & (yy > 640)
for k in ['g0', 'g1', 'g2']:
    labels[k] = bridge(labels[k], swing, 11)
# spokes over the swingarm show up as neutral slivers; drop them there
for k in ['k1', 'k2', 'k3', 'k4', 'k0']:
    labels[k] &= ~swing | ~disc(REAR, TYRE + 2)

layers = []
union = np.zeros((H, W), bool)
for k in labels: union |= labels[k]
base = clean(union, close=5, open_=3)
layers.append({'id': 'base', 'c': '#1a1b1e', 'rings': rings(base, 120, 1.2)})
order = [k for k in labels if k != 'k0'] + ['k0']
for k in order:
    m = clean(labels[k])
    sel = m > 0
    if sel.sum() == 0: continue
    px = im[sel & labels[k]] if (sel & labels[k]).sum() else im[sel]
    col = np.percentile(raw[sel & labels[k]] if (sel & labels[k]).sum() else raw[sel], 85 if k == 'y' else 50, axis=0)
    hexc = '#%02x%02x%02x' % (int(col[2]), int(col[1]), int(col[0]))
    rs = rings(m)
    if rs: layers.append({'id': k, 'c': hexc, 'rings': rs})

pts = sum(len(r) // 2 for L in layers for r in L['rings'])
print('layers', [(L['id'], L['c'], len(L['rings'])) for L in layers], 'points', pts)
data = {'rear': REAR, 'front': FRONT, 'tyre': TYRE, 'layers': layers}
if out.endswith('.js'):
    with open(out, 'w') as f:
        f.write('/*\n * Sur-Ron Light Bee X, vectorised from a side-on product photo (radmotousa.com,\n'
                ' * green 2026 model, mirrored to face right) by posterising it into colour layers\n'
                ' * and tracing each layer. Coordinates are photo pixels; bikeart.js calibrates\n'
                ' * them with `rear`, `front` (axle centres) and `tyre` (tyre radius).\n */\n')
        f.write("(function (root) {\n  'use strict';\n  const T = ")
        f.write(json.dumps(data, separators=(',', ':')))
        f.write(";\n  if (typeof module !== 'undefined' && module.exports) module.exports = T;\n")
        f.write("  else (root.TRACED = root.TRACED || {})['surron-lbx'] = T;\n})(typeof self !== 'undefined' ? self : this);\n")
else:
    json.dump(data, open(out, 'w'))
