/*
 * Bike and rider art. Each bike was traced from a side-on product photo:
 * points are in that photo's pixel coordinates and get converted once, at
 * load, into metres in the bike's local frame (y up, origin at the rear
 * tyre's contact patch, rear axle at (0, R)). `ref` holds the calibration:
 * the pixel centres of both axles, the real wheelbase and the tyre radius.
 *
 * Reference photos:
 *   Stark Varg MX     - elmox.de product image (red), facing right
 *   Segway X260       - segway.la product image (silver), facing right
 *   Sur-Ron LBX       - radmotousa.com product image (green), mirrored and
 *                       vectorised into colour layers (js/traced/surron-lbx.js)
 *   Talaria MX4       - talariacanada.com product image (blue), facing right
 *   E Ride Pro-SS     - chargedcycleworks.com product image (black), near side-on
 */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const FORK_RAKE = 25 * Math.PI / 180;

  /* ------------------------------------------------------------------ */
  /* Traced art                                                          */
  /* ------------------------------------------------------------------ */

  const ART = {
    'stark-varg-mx': {
      ref: { rear: [140, 447], front: [556, 445], wheelbase: 1.48, tyre: 98 },
      pal: {
        body: '#d4111c', body2: '#8f0a12', seat: '#26272b', frame: '#1c1d20', metal: '#c9ccd1',
        dark: '#202125', battery: '#2b2d31', rim: '#1d1e21', spoke: '#c4c7cc', accent: '#ffffff',
        forkUp: '#b8935a', forkLow: '#18191b', spring: '#e8e9eb', shockBody: '#2a2b2f', chain: '#8c8f94', sprocket: '#3a3c40',
      },
      sprocket: 34, drive: [287, 404], driveR: 9,
      parts: [
        { k: 'line', p: [[240, 362], [236, 418]], w: 9, c: 'frame' },
        { k: 'chain' },
        { k: 'poly', c: 'metal', p: [[128, 436], [268, 386], [292, 398], [292, 420], [140, 464], [124, 454]], gloss: 1 },
        { k: 'line', p: [[150, 446], [270, 404]], w: 3, c: '#9da1a7' },
        { k: 'circle', at: [287, 404], r: 11, c: 'dark' },
        { k: 'shock', a: [272, 402], b: [258, 340], w: 13 },
        { k: 'poly', c: 'battery', p: [[296, 305], [416, 318], [420, 345], [412, 420], [393, 441], [300, 442], [286, 424], [289, 330]] },
        { k: 'fins', clip: [[332, 312], [414, 322], [412, 418], [370, 432], [340, 432]], c: '#1a1b1e', dir: 'h', gap: 7 },
        { k: 'poly', c: 'dark', p: [[288, 424], [400, 424], [408, 438], [392, 448], [300, 448]] },
        { k: 'poly', c: 'metal', p: [[298, 352], [340, 342], [362, 360], [366, 412], [346, 430], [306, 430], [294, 408]], smooth: 1, gloss: 1 },
        { k: 'ring', at: [330, 387], r: 22, w: 3, c: '#9aa0a6' },
        { k: 'circle', at: [330, 387], r: 7, c: '#7d8187' },
        { k: 'poly', c: 'frame', p: [[398, 236], [420, 214], [446, 210], [462, 248], [452, 300], [430, 300], [420, 260]] },
        { k: 'poly', c: 'body', p: [[52, 250], [110, 254], [160, 262], [205, 274], [245, 286], [278, 298], [276, 330], [264, 362], [248, 372], [232, 354], [212, 330], [188, 304], [160, 283], [120, 267], [80, 257]], smooth: 1, gloss: 1 },
        { k: 'poly', c: 'body', p: [[272, 270], [330, 252], [395, 233], [440, 226], [459, 250], [453, 282], [441, 312], [428, 343], [416, 328], [406, 306], [380, 302], [330, 302], [284, 302]], smooth: 1, gloss: 1 },
        { k: 'poly', c: 'body2', p: [[300, 300], [404, 302], [416, 326], [428, 343], [418, 344], [404, 318], [300, 310]] },
        { k: 'poly', c: 'seat', p: [[134, 255], [200, 260], [262, 262], [304, 256], [350, 243], [398, 226], [408, 231], [398, 242], [352, 258], [302, 270], [240, 274], [188, 270], [150, 264]], smooth: 1, gloss: 0.5 },
        { k: 'line', p: [[150, 262], [300, 262]], w: 1.5, c: '#3a3b40' },
        { k: 'fender', p: [[470, 258], [520, 260], [566, 268], [612, 286], [602, 290], [560, 283], [515, 280], [470, 279]], c: 'body' },
        { k: 'fork', top: [450, 196], axle: [556, 445], split: 0.52, wUp: 19, wLow: 16 },
        { k: 'poly', c: 'frame', p: [[436, 196], [470, 190], [474, 206], [440, 212]] },
        { k: 'poly', c: 'frame', p: [[446, 246], [486, 240], [488, 256], [450, 262]] },
        { k: 'poly', c: '#f2f3f5', p: [[440, 212], [460, 202], [484, 246], [478, 262], [458, 262]], gloss: 0.6, alpha: 0.9 },
        { k: 'bars', clamp: [452, 194], grip: [410, 186], c: 'frame' },
      ],
      rider: { hip: [290, 246], peg: [284, 426], grip: [410, 186] },
      light: [470, 228], // the MX bike has no lamp; a bar-mounted light for night runs
      kit: { jersey: '#d4111c', jersey2: '#ffffff', pants: '#1f2024', pants2: '#d4111c', helmet: '#f4f4f4', helmet2: '#d4111c', visor: '#1b1c20', lens: '#ff8a3d', boots: '#f2f2f2', gloves: '#1f2024' },
    },

    'segway-x260': {
      ref: { rear: [122, 424], front: [565, 424], wheelbase: 1.27, tyre: 105 },
      pal: {
        body: '#d5d8dc', body2: '#9ea3aa', seat: '#1e1f22', frame: '#d5d8dc', metal: '#b9bdc3',
        dark: '#1b1c1f', battery: '#2a2c30', rim: '#1d1e21', spoke: '#c4c7cc', accent: '#e1251b',
        forkUp: '#1d1e21', forkLow: '#26272b', spring: '#e1251b', shockBody: '#2a2b2f', chain: '#7d8086', sprocket: '#3a3c40',
      },
      sprocket: 30, drive: [330, 410], driveR: 11,
      parts: [
        { k: 'chain' },
        { k: 'poly', c: 'dark', p: [[108, 376], [238, 364], [300, 350], [346, 372], [332, 396], [272, 406], [142, 436], [110, 426]], gloss: 0.4 },
        { k: 'line', p: [[150, 392], [290, 372]], w: 3, c: 'accent' },
        { k: 'poly', c: 'dark', p: [[178, 298], [196, 312], [216, 336], [230, 362], [219, 364], [202, 338], [182, 314]], smooth: 1 },
        { k: 'shock', a: [292, 352], b: [342, 292], w: 13 },
        { k: 'poly', c: 'dark', p: [[200, 250], [262, 262], [332, 256], [348, 276], [332, 302], [300, 302], [258, 282]] },
        { k: 'rect', at: [242, 262], w: 7, h: 13, c: 'accent' },
        { k: 'poly', c: 'frame', p: [[454, 196], [472, 212], [456, 246], [432, 302], [416, 384], [396, 406], [340, 412], [298, 400], [296, 366], [316, 300], [330, 260], [400, 226]], gloss: 1 },
        { k: 'poly', c: 'battery', p: [[350, 284], [444, 244], [424, 300], [406, 380], [342, 382], [336, 330]] },
        { k: 'grid', clip: [[354, 290], [436, 254], [418, 302], [402, 374], [348, 376], [342, 332]], c: '#1c1d20', gap: 6 },
        { k: 'poly', c: 'accent', p: [[408, 300], [418, 296], [404, 372], [394, 374]] },
        { k: 'circle', at: [330, 410], r: 32, c: 'dark' },
        { k: 'ring', at: [330, 410], r: 22, w: 3, c: '#5a5d63' },
        { k: 'circle', at: [330, 410], r: 8, c: '#8b8f95' },
        { k: 'poly', c: 'seat', p: [[130, 218], [175, 224], [230, 232], [290, 236], [328, 238], [333, 249], [300, 256], [250, 258], [200, 248], [150, 226]], smooth: 1, gloss: 0.5 },
        { k: 'poly', c: 'dark', p: [[332, 240], [372, 232], [406, 228], [410, 244], [370, 250], [334, 252]] },
        { k: 'rect', at: [384, 236], w: 10, h: 6, c: 'accent' },
        { k: 'fender', p: [[456, 226], [492, 220], [540, 220], [592, 232], [600, 236], [560, 237], [500, 234], [470, 241]], c: 'dark' },
        { k: 'fork', top: [456, 182], axle: [565, 424], split: 0.55, wUp: 18, wLow: 16 },
        { k: 'poly', c: 'dark', p: [[440, 250], [462, 244], [456, 280], [436, 320], [428, 316]] },
        { k: 'poly', c: 'dark', p: [[444, 178], [476, 172], [482, 196], [450, 200]] },
        { k: 'circle', at: [470, 182], r: 10, c: '#e9eef5' },
        { k: 'bars', clamp: [452, 172], grip: [416, 160], c: 'dark' },
      ],
      rider: { hip: [256, 232], peg: [295, 404], grip: [416, 160] },
      light: [478, 182],
      kit: { jersey: '#dfe2e6', jersey2: '#e1251b', pants: '#2d3036', pants2: '#e1251b', helmet: '#c9ccd1', helmet2: '#2d3036', visor: '#1e2024', lens: '#7fd3ff', boots: '#dfe2e6', gloves: '#2d3036' },
    },

    'surron-lbx': {
      // Body and frame come from the vectorised photo in js/traced/surron-lbx.js;
      // these parts fill in what the wheels hide (swingarm end, fork legs, chain).
      ref: { rear: [284, 870], front: [1334, 868], wheelbase: 1.26, tyre: 259 },
      traced: 'surron-lbx',
      pal: {
        rim: '#1a1b1e', spoke: '#c4c7cc', chain: '#b08d52', sprocket: '#c2a46a',
        forkUp: '#c69f6c', forkLow: '#1c1d20', spring: '#c69f6c', shockBody: '#2a2b2f',
        dark: '#1b1c1f', metal: '#b9bdc3', body: '#7a8032', accent: '#e5db48',
      },
      sprocket: 92, drive: [766, 810], driveR: 22,
      parts: [
        { k: 'chain' },
        { k: 'poly', c: '#6c7230', p: [[250, 860], [300, 838], [420, 778], [540, 712], [600, 690], [660, 700], [690, 760], [660, 800], [560, 830], [420, 862], [300, 900], [258, 898]], smooth: 0.5 },
        { k: 'line', p: [[1192, 612], [1334, 868]], w: 42, c: 'forkLow', end: 'front' },
        { k: 'line', p: [[1180, 622], [1316, 862]], w: 6, c: 'rgba(255,255,255,0.16)', move: 'front' },
        { k: 'line', p: [[1286, 772], [1304, 806]], w: 16, c: 'accent', move: 'front' },
        { k: 'circle', at: [1334, 868], r: 24, c: 'forkLow', move: 'front' },
        { k: 'traced' },
      ],
      rider: { hip: [590, 392], peg: [655, 855], grip: [1000, 228] },
      light: [1100, 272],
      kit: { jersey: '#f2f2ee', jersey2: '#8a9a2e', pants: '#4a4f57', pants2: '#c9d36a', helmet: '#f2f2ee', helmet2: '#8a9a2e', visor: '#1d1e21', lens: '#ffd34d', boots: '#f2f2ee', gloves: '#1d1e21' },
    },

    'talaria-mx4': {
      ref: { rear: [100, 385], front: [490, 385], wheelbase: 1.29, tyre: 94 },
      pal: {
        body: '#1f62e0', body2: '#123c8f', seat: '#1b1c1f', frame: '#1d1e22', metal: '#b9bdc3',
        dark: '#1b1c1f', battery: '#202125', rim: '#1a1b1e', spoke: '#c4c7cc', accent: '#ffffff',
        forkUp: '#1b1c1f', forkLow: '#232428', spring: '#1f62e0', shockBody: '#2a2b2f', chain: '#a88a4a', sprocket: '#3a3c40',
      },
      sprocket: 30, drive: [290, 355], driveR: 10,
      parts: [
        { k: 'chain' },
        { k: 'poly', c: 'dark', p: [[92, 375], [150, 356], [250, 330], [264, 346], [240, 366], [110, 396]], gloss: 0.4 },
        { k: 'line', p: [[120, 372], [240, 344]], w: 5, c: 'body' },
        { k: 'poly', c: 'dark', p: [[143, 288], [160, 298], [178, 315], [188, 333], [180, 335], [165, 318], [150, 302]], smooth: 1 },
        { k: 'shock', a: [272, 322], b: [262, 256], w: 13 },
        { k: 'poly', c: 'dark', p: [[210, 236], [285, 236], [275, 262], [255, 272], [235, 256]] },
        { k: 'poly', c: 'frame', p: [[388, 168], [408, 172], [404, 240], [384, 300], [360, 330], [340, 330]] },
        { k: 'poly', c: 'battery', p: [[254, 318], [350, 320], [356, 345], [342, 386], [262, 389], [250, 360]] },
        { k: 'circle', at: [290, 355], r: 28, c: '#2c2e33' },
        { k: 'ring', at: [290, 355], r: 19, w: 3, c: 'body' },
        { k: 'circle', at: [290, 355], r: 7, c: '#8b8f95' },
        { k: 'poly', c: 'body', p: [[280, 218], [330, 206], [372, 195], [388, 200], [392, 235], [378, 260], [362, 290], [348, 322], [290, 326], [256, 322], [250, 290], [262, 262]], smooth: 0.6, gloss: 1 },
        { k: 'stripes', clip: [[284, 222], [372, 200], [386, 234], [362, 288], [346, 318], [292, 320], [258, 318], [254, 290], [266, 262]], c: 'dark', angle: -70, gap: 30, w: 9 },
        { k: 'poly', c: 'accent', p: [[300, 286], [352, 282], [348, 294], [296, 298]], alpha: 0.85 },
        { k: 'poly', c: 'seat', p: [[98, 200], [160, 207], [220, 214], [262, 218], [292, 214], [300, 222], [285, 236], [235, 242], [180, 230], [130, 212]], smooth: 1, gloss: 0.5 },
        { k: 'fender', p: [[404, 242], [450, 232], [482, 236], [532, 266], [520, 267], [472, 250], [420, 254]], c: 'dark', edge: 'body' },
        { k: 'fork', top: [394, 156], axle: [490, 385], split: 0.6, wUp: 17, wLow: 15 },
        { k: 'line', p: [[452, 330], [470, 358]], w: 3, c: 'accent' },
        { k: 'poly', c: 'dark', p: [[392, 250], [404, 256], [390, 320], [380, 322]] },
        { k: 'poly', c: 'dark', p: [[380, 152], [410, 148], [414, 164], [384, 168]] },
        { k: 'poly', c: 'dark', p: [[404, 160], [426, 158], [428, 180], [406, 182]] },
        { k: 'rect', at: [424, 164], w: 4, h: 12, c: '#eaf2ff' },
        { k: 'bars', clamp: [396, 144], grip: [376, 140], c: 'dark' },
      ],
      rider: { hip: [226, 211], peg: [264, 374], grip: [376, 140] },
      light: [428, 170],
      kit: { jersey: '#1f62e0', jersey2: '#ffffff', pants: '#1b1c1f', pants2: '#1f62e0', helmet: '#ffffff', helmet2: '#1f62e0', visor: '#1b1c1f', lens: '#9fd0ff', boots: '#1b1c1f', gloves: '#1f62e0' },
    },

    'eride-pro-ss': {
      // The source photo is shot slightly from the front, so the front axle sits
      // higher than the rear; `ref` shears that back out.
      ref: { rear: [148, 325], front: [568, 300], wheelbase: 1.32, tyre: 105 },
      pal: {
        body: '#2b2d32', body2: '#1a1b1e', seat: '#3a3c42', frame: '#18191c', metal: '#9ea2a8',
        dark: '#16171a', battery: '#232529', rim: '#141517', spoke: '#b9bcc1', accent: '#e0262d',
        forkUp: '#141517', forkLow: '#1f2023', spring: '#18191c', shockBody: '#2a2b2f', chain: '#c9a34a', sprocket: '#c9ccd1',
      },
      sprocket: 44, drive: [375, 290], driveR: 11,
      parts: [
        { k: 'chain' },
        { k: 'poly', c: 'dark', p: [[140, 305], [280, 272], [340, 258], [352, 286], [300, 306], [160, 346]], gloss: 0.4 },
        { k: 'poly', c: 'dark', p: [[232, 212], [250, 222], [268, 240], [275, 262], [265, 262], [250, 240], [235, 225]], smooth: 1 },
        { k: 'shock', a: [286, 252], b: [346, 204], w: 15 },
        { k: 'poly', c: 'frame', p: [[270, 148], [345, 140], [356, 176], [336, 202], [310, 186]] },
        { k: 'rect', at: [262, 150], w: 14, h: 8, c: 'accent' },
        { k: 'poly', c: 'body', p: [[344, 128], [400, 110], [446, 104], [458, 112], [460, 142], [452, 258], [440, 290], [420, 312], [360, 316], [340, 300], [334, 250], [340, 190]], gloss: 0.7 },
        { k: 'poly', c: '#3b3e45', p: [[352, 138], [440, 122], [446, 168], [360, 190]], gloss: 0.5 },
        { k: 'fins', clip: [[422, 168], [452, 160], [450, 256], [424, 262]], c: '#121315', dir: 'v', gap: 5 },
        { k: 'line', p: [[356, 196], [446, 172]], w: 2, c: 'accent' },
        { k: 'circle', at: [375, 290], r: 31, c: '#1f2023' },
        { k: 'ring', at: [375, 290], r: 22, w: 3, c: '#4a4d53' },
        { k: 'circle', at: [375, 290], r: 8, c: '#8b8f95' },
        { k: 'poly', c: 'seat', p: [[135, 99], [200, 107], [260, 118], [320, 126], [362, 124], [364, 140], [320, 150], [280, 152], [240, 142], [190, 122], [150, 104]], smooth: 1, gloss: 0.6 },
        { k: 'fender', p: [[496, 140], [530, 132], [570, 130], [602, 137], [590, 142], [550, 143], [506, 150]], c: 'dark' },
        { k: 'fork', top: [478, 72], axle: [568, 300], split: 0.56, wUp: 21, wLow: 17 },
        { k: 'line', p: [[524, 206], [530, 214]], w: 4, c: 'accent' },
        { k: 'poly', c: 'dark', p: [[462, 62], [492, 58], [500, 114], [478, 122]] },
        { k: 'rect', at: [470, 64], w: 22, h: 7, c: '#eaf4ff' },
        { k: 'poly', c: 'dark', p: [[452, 222], [468, 220], [462, 262], [450, 266]] },
        { k: 'bars', clamp: [474, 64], grip: [392, 58], c: 'dark' },
      ],
      rider: { hip: [282, 122], peg: [300, 302], grip: [392, 58] },
      light: [494, 68],
      kit: { jersey: '#16171a', jersey2: '#e0262d', pants: '#16171a', pants2: '#5a5d63', helmet: '#16171a', helmet2: '#e0262d', visor: '#16171a', lens: '#ff5a3d', boots: '#e9e9ea', gloves: '#16171a' },
    },
  };

  /* ------------------------------------------------------------------ */
  /* Calibration: photo pixels -> local metres                          */
  /* ------------------------------------------------------------------ */

  function compile(art) {
    const { rear, front, wheelbase, tyre } = art.ref;
    const ppm = (front[0] - rear[0]) / wheelbase;
    const shear = (rear[1] - front[1]) / (front[0] - rear[0]);
    const R = tyre / ppm;
    const M = (pt) => [(pt[0] - rear[0]) / ppm, (rear[1] - (pt[1] + (pt[0] - rear[0]) * shear)) / ppm + R];
    const L = (px) => px / ppm;
    const out = { R, WB: wheelbase, pal: art.pal, kit: art.kit, parts: [] };
    out.sprocketR = L(art.sprocket || 30);
    out.drive = M(art.drive);
    out.driveR = L(art.driveR || 10);
    for (const part of art.parts) {
      const q = Object.assign({}, part);
      if (q.p) q.p = q.p.map(M);
      if (q.clip) q.clip = q.clip.map(M);
      for (const key of ['at', 'a', 'b', 'top', 'axle', 'clamp', 'grip']) if (q[key]) q[key] = M(q[key]);
      if (q.k === 'fork') q.axle = [wheelbase, R];
      for (const key of ['r', 'w', 'h', 'wUp', 'wLow', 'gap']) if (typeof q[key] === 'number') q[key] = L(q[key]);
      out.parts.push(q);
    }
    out.rider = { hip: M(art.rider.hip), peg: M(art.rider.peg), grip: M(art.rider.grip) };
    out.light = M(art.light || art.rider.grip);
    if (art.traced) {
      const T = tracedData(art.traced);
      out.layers = T.layers.map((L) => {
        const rings = L.rings.map((r) => {
          const pts = [];
          for (let i = 0; i < r.length; i += 2) pts.push(M([r[i], r[i + 1]]));
          return pts;
        });
        let path = null;
        if (typeof Path2D !== 'undefined') {
          path = new Path2D();
          for (const ring of rings) {
            path.moveTo(ring[0][0], ring[0][1]);
            for (let i = 1; i < ring.length; i++) path.lineTo(ring[i][0], ring[i][1]);
            path.closePath();
          }
        }
        return { c: L.c, rings, path };
      });
    }
    return out;
  }

  function tracedData(id) {
    if (root.TRACED && root.TRACED[id]) return root.TRACED[id];
    if (typeof require === 'function') return require(`./traced/${id}.js`);
    throw new Error(`missing traced art for ${id}`);
  }

  const COMPILED = {};
  for (const id in ART) COMPILED[id] = compile(ART[id]);

  /* ------------------------------------------------------------------ */
  /* Drawing helpers (all in metres, y up)                               */
  /* ------------------------------------------------------------------ */

  function col(pal, c) { return pal[c] || c; }

  function shade(hex, amt) {
    // amt > 0 lightens towards white, < 0 darkens towards black
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return `rgb(${r},${g},${b})`;
  }

  function tracePath(ctx, pts, smooth) {
    ctx.beginPath();
    if (!smooth) {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      return;
    }
    // Rounded corners: run quadratic curves through edge midpoints, blended
    // with the raw polygon by `smooth`.
    const n = pts.length;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const k = Math.min(1, smooth);
    let start = mid(pts[n - 1], pts[0]);
    ctx.moveTo(start[0], start[1]);
    for (let i = 0; i < n; i++) {
      const p = pts[i], next = pts[(i + 1) % n], prev = pts[(i - 1 + n) % n];
      const a = lerp(p, mid(prev, p), k), b = lerp(p, mid(p, next), k);
      ctx.lineTo(a[0], a[1]);
      ctx.quadraticCurveTo(p[0], p[1], b[0], b[1]);
    }
    ctx.closePath();
  }

  function bbox(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    return { x0, y0, x1, y1 };
  }

  function fillShape(ctx, pts, color, opts = {}) {
    tracePath(ctx, pts, opts.smooth);
    ctx.save();
    if (opts.alpha) ctx.globalAlpha = opts.alpha;
    ctx.fillStyle = color;
    ctx.fill();
    if (opts.gloss) {
      // Light from above: a soft top highlight and a darker underside.
      const b = bbox(pts);
      const g = ctx.createLinearGradient(0, b.y1, 0, b.y0);
      g.addColorStop(0, `rgba(255,255,255,${0.32 * opts.gloss})`);
      g.addColorStop(0.35, 'rgba(255,255,255,0)');
      g.addColorStop(0.7, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${0.28 * opts.gloss})`);
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.lineWidth = 0.006;
    ctx.strokeStyle = 'rgba(8,9,11,0.55)';
    ctx.stroke();
    ctx.restore();
  }

  function stroke(ctx, pts, w, color, cap = 'round') {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineWidth = w;
    ctx.lineCap = cap;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  function circle(ctx, c, r, color) {
    ctx.beginPath();
    ctx.arc(c[0], c[1], r, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
  }

  /* ------------------------------------------------------------------ */
  /* Wheels                                                              */
  /* ------------------------------------------------------------------ */

  function drawWheel(ctx, c, R, pal, spin, blur, disc, sprocketR) {
    const [cx, cy] = c;
    const rimR = R * 0.76;
    // tyre carcass: a ring, so the wheel stays see-through between the spokes
    ctx.beginPath();
    ctx.arc(cx, cy, R - 0.02, 0, TAU);
    ctx.arc(cx, cy, rimR + 0.008, 0, TAU, true);
    ctx.fillStyle = '#151618';
    ctx.fill();
    // tread: big staggered knobs on the crown, smaller shoulder knobs between
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    const knobs = 50;
    for (let i = 0; i < knobs; i++) {
      // slightly irregular blocks, like a worn knobby
      const j = Math.sin(i * 12.9898) * 43758.5453, n = j - Math.floor(j);
      const w = 0.02 + n * 0.01, h = 0.017 + (1 - n) * 0.008;
      ctx.save();
      ctx.rotate((i * TAU) / knobs);
      ctx.beginPath();
      ctx.moveTo(R - h, -w / 2); ctx.lineTo(R, -w * 0.38); ctx.lineTo(R, w * 0.38); ctx.lineTo(R - h, w / 2);
      ctx.closePath();
      ctx.fillStyle = n > 0.5 ? '#232428' : '#1f2023';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.fillRect(R - 0.004, -w * 0.38, 0.004, w * 0.76);
      ctx.rotate(TAU / knobs / 2);
      ctx.fillStyle = '#1c1d20';
      ctx.fillRect(R - 0.032, -0.008, 0.014, 0.016);
      ctx.restore();
    }
    ctx.restore();
    // sidewall with a soft sheen on the upper half
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.85, 0, TAU);
    ctx.lineWidth = R * 0.15;
    ctx.strokeStyle = '#1f2023';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.87, Math.PI * 0.2, Math.PI * 0.8);
    ctx.lineWidth = R * 0.05;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.stroke();
    // rim
    ctx.beginPath();
    ctx.arc(cx, cy, rimR, 0, TAU);
    ctx.lineWidth = 0.022;
    ctx.strokeStyle = pal.rim;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, rimR - 0.006, Math.PI * 0.15, Math.PI * 0.85);
    ctx.lineWidth = 0.004;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.stroke();
    // spokes (motion-blurred into a disc at speed)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    ctx.globalAlpha = 1 - 0.75 * blur;
    ctx.strokeStyle = pal.spoke;
    ctx.lineWidth = 0.0032;
    ctx.beginPath();
    const spokes = 36;
    for (let i = 0; i < spokes; i++) {
      const a = (i * TAU) / spokes;
      const off = (i % 2 ? 1 : -1) * 0.5;
      ctx.moveTo(Math.cos(a) * 0.045, Math.sin(a) * 0.045);
      ctx.lineTo(Math.cos(a + off) * (rimR - 0.01), Math.sin(a + off) * (rimR - 0.01));
    }
    ctx.stroke();
    ctx.restore();
    if (blur > 0.05) {
      ctx.beginPath();
      ctx.arc(cx, cy, rimR - 0.012, 0, TAU);
      ctx.fillStyle = `rgba(190,194,200,${0.16 * blur})`;
      ctx.fill();
    }
    // sprocket sits behind the brake disc
    if (sprocketR) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(spin);
      ctx.beginPath();
      const teeth = 44;
      for (let i = 0; i <= teeth * 2; i++) {
        const a = (i * TAU) / (teeth * 2);
        const r = i % 2 ? sprocketR : sprocketR - 0.007;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.moveTo(sprocketR * 0.55, 0);
      ctx.arc(0, 0, sprocketR * 0.55, 0, TAU, true);
      ctx.fillStyle = pal.sprocket;
      ctx.fill();
      ctx.restore();
    }
    // wave brake disc with drilled holes
    if (disc) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(spin);
      ctx.beginPath();
      const waves = 12;
      for (let i = 0; i <= waves * 4; i++) {
        const a = (i * TAU) / (waves * 4);
        const r = disc * (i % 4 === 0 ? 0.94 : 1);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.moveTo(disc * 0.7, 0);
      ctx.arc(0, 0, disc * 0.7, 0, TAU, true);
      ctx.fillStyle = '#b9bdc3';
      ctx.fill();
      ctx.fillStyle = '#5f6369';
      for (let i = 0; i < 18; i++) {
        const a = (i * TAU) / 18;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * disc * 0.84, Math.sin(a) * disc * 0.84, 0.0045, 0, TAU);
        ctx.fill();
      }
      // carrier spokes to the hub
      ctx.strokeStyle = '#8d9197';
      ctx.lineWidth = 0.01;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * TAU) / 5;
        ctx.moveTo(Math.cos(a) * 0.04, Math.sin(a) * 0.04);
        ctx.lineTo(Math.cos(a + 0.3) * disc * 0.72, Math.sin(a + 0.3) * disc * 0.72);
      }
      ctx.stroke();
      ctx.restore();
    }
    // hub
    circle(ctx, c, 0.045, '#9ca0a6');
    circle(ctx, c, 0.02, '#5d6167');
  }

  /* ------------------------------------------------------------------ */
  /* Components                                                          */
  /* ------------------------------------------------------------------ */

  function drawFork(ctx, q, pal, axle) {
    const { top, split, wUp, wLow } = q;
    const mid = [top[0] + (axle[0] - top[0]) * split, top[1] + (axle[1] - top[1]) * split];
    // outer (upper) tubes, lower legs, and a short polished stanchion between them
    stroke(ctx, [top, mid], wUp, pal.forkUp, 'butt');
    const dx = axle[0] - top[0], dy = axle[1] - top[1], len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const stan = [mid[0] + ux * 0.05, mid[1] + uy * 0.05];
    stroke(ctx, [mid, stan], wLow * 0.8, '#d7dade', 'butt');
    stroke(ctx, [stan, axle], wLow, pal.forkLow, 'round');
    // highlight down the tubes
    stroke(ctx, [[top[0] - uy * wUp * 0.25, top[1] + ux * wUp * 0.25], [mid[0] - uy * wUp * 0.25, mid[1] + ux * wUp * 0.25]], wUp * 0.18, 'rgba(255,255,255,0.28)', 'butt');
    // axle lug and caliper
    circle(ctx, axle, 0.03, pal.forkLow);
    ctx.save();
    ctx.translate(axle[0], axle[1]);
    ctx.rotate(Math.atan2(uy, ux) + Math.PI / 2);
    ctx.fillStyle = '#2b2d31';
    ctx.fillRect(-0.075, -0.03, 0.05, 0.07);
    ctx.restore();
    // triple clamps
    const tc = (t) => [top[0] + dx * t, top[1] + dy * t];
    stroke(ctx, [tc(0.02), [tc(0.02)[0] - 0.05, tc(0.02)[1] - 0.005]], 0.035, '#2a2b2f', 'round');
    stroke(ctx, [tc(0.17), [tc(0.17)[0] - 0.06, tc(0.17)[1] + 0.005]], 0.035, '#2a2b2f', 'round');
  }

  function drawShock(ctx, q, pal) {
    const { a, b, w } = q;
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    ctx.save();
    ctx.translate(a[0], a[1]);
    ctx.rotate(Math.atan2(dy, dx));
    // damper body
    ctx.fillStyle = pal.shockBody;
    ctx.fillRect(0, -w * 0.28, len, w * 0.56);
    ctx.fillStyle = '#c9ccd1';
    ctx.fillRect(len * 0.05, -w * 0.12, len * 0.3, w * 0.24);
    // coil
    ctx.strokeStyle = pal.spring;
    ctx.lineWidth = w * 0.22;
    ctx.lineCap = 'round';
    const coils = 7, s0 = len * 0.22, s1 = len * 0.88;
    ctx.beginPath();
    for (let i = 0; i <= coils; i++) {
      const x = s0 + ((s1 - s0) * i) / coils;
      ctx.moveTo(x - w * 0.12, -w * 0.5);
      ctx.lineTo(x + w * 0.12, w * 0.5);
    }
    ctx.stroke();
    // mounts
    ctx.fillStyle = '#3b3d42';
    ctx.beginPath(); ctx.arc(0, 0, w * 0.45, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(len, 0, w * 0.45, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawChain(ctx, art, spin) {
    // Belt of links between the drive sprocket and the rear sprocket.
    const rear = art._dyn.rear, d = art.drive;
    const r1 = art.sprocketR, r2 = art.driveR;
    const ang = Math.atan2(d[1] - rear[1], d[0] - rear[0]);
    const n = [-Math.sin(ang), Math.cos(ang)];
    const top = [[rear[0] + n[0] * r1, rear[1] + n[1] * r1], [d[0] + n[0] * r2, d[1] + n[1] * r2]];
    const bot = [[rear[0] - n[0] * r1, rear[1] - n[1] * r1], [d[0] - n[0] * r2, d[1] - n[1] * r2]];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]); ctx.lineTo(top[1][0], top[1][1]);
    ctx.moveTo(bot[0][0], bot[0][1]); ctx.lineTo(bot[1][0], bot[1][1]);
    ctx.lineWidth = 0.014;
    ctx.strokeStyle = '#2a2b2e';
    ctx.stroke();
    ctx.lineWidth = 0.008;
    ctx.strokeStyle = art.pal.chain;
    ctx.setLineDash([0.008, 0.005]);
    ctx.lineDashOffset = -spin * art.R;
    ctx.stroke();
    ctx.restore();
    circle(ctx, d, r2, art.pal.sprocket);
  }

  function drawPattern(ctx, q, pal) {
    tracePath(ctx, q.clip, false);
    ctx.save();
    ctx.clip();
    const b = bbox(q.clip);
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const size = Math.max(b.x1 - b.x0, b.y1 - b.y0);
    ctx.strokeStyle = col(pal, q.c);
    if (q.k === 'stripes') {
      ctx.translate(cx, cy);
      ctx.rotate((q.angle * Math.PI) / 180);
      ctx.lineWidth = q.w;
      ctx.beginPath();
      for (let x = -size; x <= size; x += q.gap) { ctx.moveTo(x, -size); ctx.lineTo(x, size); }
      ctx.stroke();
    } else if (q.k === 'fins') {
      ctx.lineWidth = q.gap * 0.45;
      ctx.beginPath();
      if (q.dir === 'v') for (let x = b.x0; x <= b.x1; x += q.gap) { ctx.moveTo(x, b.y0); ctx.lineTo(x, b.y1); }
      else for (let y = b.y0; y <= b.y1; y += q.gap) { ctx.moveTo(b.x0, y); ctx.lineTo(b.x1, y); }
      ctx.stroke();
    } else if (q.k === 'blocks') {
      ctx.translate(cx, cy);
      ctx.rotate((q.angle * Math.PI) / 180);
      ctx.fillStyle = col(pal, q.c);
      const g = q.gap;
      for (let i = -8; i <= 8; i++) {
        for (let j = -8; j <= 8; j++) {
          if ((i * 7 + j * 3 + (i * j) % 5 + 40) % 4 === 0) continue; // irregular gaps, like the decal
          if ((i + j) % 2 === 0) ctx.fillRect(i * g, j * g, g * 0.92, g * 0.92);
        }
      }
    } else if (q.k === 'grid') {
      ctx.lineWidth = q.gap * 0.25;
      ctx.beginPath();
      for (let x = b.x0; x <= b.x1; x += q.gap) { ctx.moveTo(x, b.y0); ctx.lineTo(x + size * 0.3, b.y1); }
      for (let x = b.x0 - size * 0.3; x <= b.x1; x += q.gap) { ctx.moveTo(x, b.y1); ctx.lineTo(x + size * 0.3, b.y0); }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPart(ctx, q, art, spin) {
    const pal = art.pal;
    switch (q.k) {
      case 'poly': fillShape(ctx, q.p, col(pal, q.c), { smooth: q.smooth, gloss: q.gloss, alpha: q.alpha }); break;
      case 'fender':
        fillShape(ctx, q.p, col(pal, q.c), { smooth: 1, gloss: 0.8 });
        if (q.edge) stroke(ctx, q.p.slice(0, 4), 0.008, col(pal, q.edge));
        break;
      case 'line': {
        let pts = q.p;
        if (q.end === 'front') pts = [...pts.slice(0, -1), art._dyn.front];
        else if (q.move === 'front') pts = pts.map(([x, y]) => [x + art._dyn.shift[0], y + art._dyn.shift[1]]);
        stroke(ctx, pts, q.w, col(pal, q.c));
        break;
      }
      case 'circle': {
        const at = q.move === 'front' ? [q.at[0] + art._dyn.shift[0], q.at[1] + art._dyn.shift[1]] : q.at;
        circle(ctx, at, q.r, col(pal, q.c));
        break;
      }
      case 'ring':
        ctx.beginPath(); ctx.arc(q.at[0], q.at[1], q.r, 0, TAU);
        ctx.lineWidth = q.w; ctx.strokeStyle = col(pal, q.c); ctx.stroke();
        break;
      case 'rect':
        ctx.fillStyle = col(pal, q.c);
        ctx.fillRect(q.at[0], q.at[1] - q.h, q.w, q.h);
        break;
      case 'shock': drawShock(ctx, q, pal); break;
      case 'chain': drawChain(ctx, art, spin); break;
      case 'fork': drawFork(ctx, q, pal, art._dyn.front); break;
      case 'stripes': case 'fins': case 'grid': case 'blocks': drawPattern(ctx, q, pal); break;
      case 'traced':
        for (const L of art.layers) {
          ctx.fillStyle = L.c;
          if (L.path) ctx.fill(L.path, 'evenodd');
        }
        break;
      case 'bars':
        stroke(ctx, [q.clamp, [q.clamp[0] - 0.02, q.clamp[1] + 0.03], q.grip], 0.024, col(pal, q.c));
        stroke(ctx, [[q.grip[0] + 0.035, q.grip[1] + 0.008], [q.grip[0] - 0.03, q.grip[1] - 0.006]], 0.034, '#101113');
        stroke(ctx, [[q.grip[0] + 0.03, q.grip[1] + 0.02], [q.grip[0] + 0.07, q.grip[1] + 0.005]], 0.008, '#2a2b2f');
        break;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Rider                                                               */
  /* ------------------------------------------------------------------ */

  const BODY = { thigh: 0.45, shin: 0.46, upper: 0.3, fore: 0.3, torso: 0.5 };

  function ik(a, b, l1, l2, sign) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 1e-4);
    const base = Math.atan2(dy, dx);
    const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
    return [a[0] + Math.cos(base + sign * ang) * l1, a[1] + Math.sin(base + sign * ang) * l1];
  }

  function pose(art, lean) {
    const r = art.rider;
    // Leaning back slides the hips back on the seat and straightens the torso.
    const hip = [r.hip[0] - 0.1 * lean, r.hip[1] + 0.05 + 0.05 * Math.max(0, -lean)];
    const torsoAng = ((14 - 18 * lean) * Math.PI) / 180; // forward tilt from vertical
    const tdir = [Math.sin(torsoAng), Math.cos(torsoAng)];
    const fwd = [Math.cos(torsoAng), -Math.sin(torsoAng)];
    const shoulder = [hip[0] + tdir[0] * BODY.torso, hip[1] + tdir[1] * BODY.torso];
    const foot = [r.peg[0] + 0.02, r.peg[1] + 0.035];
    const knee = ik(hip, foot, BODY.thigh, BODY.shin, 1);
    const hand = r.grip;
    // Elbows up: the elbow sits out in front of the shoulder, as MX riders hold it.
    const elbow = ik(shoulder, hand, BODY.upper, BODY.fore, 1);
    const head = [shoulder[0] + tdir[0] * 0.25 + fwd[0] * 0.04, shoulder[1] + tdir[1] * 0.25 + fwd[1] * 0.04];
    return { hip, shoulder, head, foot, knee, hand, elbow, tdir, fwd, torsoAng };
  }

  const EDGE = 'rgba(10,11,13,0.45)';

  function limb(ctx, a, b, w0, w1, color, edge = true) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const an = Math.atan2(ny, nx);
    ctx.beginPath();
    ctx.moveTo(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2);
    ctx.lineTo(b[0] + nx * w1 / 2, b[1] + ny * w1 / 2);
    ctx.arc(b[0], b[1], w1 / 2, an, an - Math.PI, true);
    ctx.lineTo(a[0] - nx * w0 / 2, a[1] - ny * w0 / 2);
    ctx.arc(a[0], a[1], w0 / 2, an + Math.PI, an, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (edge) { ctx.lineWidth = 0.007; ctx.strokeStyle = EDGE; ctx.stroke(); }
  }

  const at = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  function drawLeg(ctx, p, kit, dim) {
    const k = (c) => (dim ? shade(c, -0.4) : c);
    // thigh, with the coloured side panel of the pants
    limb(ctx, p.hip, p.knee, 0.17, 0.125, k(kit.pants));
    if (!dim) limb(ctx, at(p.hip, p.knee, 0.15), at(p.hip, p.knee, 0.85), 0.05, 0.035, kit.pants2, false);
    limb(ctx, p.knee, p.foot, 0.115, 0.095, k(kit.pants));
    // knee brace
    ctx.beginPath();
    ctx.ellipse(p.knee[0], p.knee[1], 0.062, 0.054, 0, 0, TAU);
    ctx.fillStyle = dim ? '#1d1e21' : '#2f3136';
    ctx.fill();
    // MX boot: tall shaft, flat sole along the peg
    const top = at(p.knee, p.foot, 0.4);
    limb(ctx, top, p.foot, 0.125, 0.11, k(kit.boots));
    ctx.beginPath();
    ctx.moveTo(p.foot[0] - 0.08, p.foot[1] + 0.035);
    ctx.lineTo(p.foot[0] + 0.1, p.foot[1] + 0.02);
    ctx.quadraticCurveTo(p.foot[0] + 0.17, p.foot[1] - 0.005, p.foot[0] + 0.15, p.foot[1] - 0.05);
    ctx.lineTo(p.foot[0] - 0.09, p.foot[1] - 0.05);
    ctx.closePath();
    ctx.fillStyle = k(kit.boots);
    ctx.fill();
    ctx.lineWidth = 0.007; ctx.strokeStyle = EDGE; ctx.stroke();
    stroke(ctx, [[p.foot[0] - 0.09, p.foot[1] - 0.05], [p.foot[0] + 0.15, p.foot[1] - 0.05]], 0.024, '#111214', 'butt');
    if (!dim) {
      for (let i = 0; i < 3; i++) {
        const c = at(top, p.foot, 0.2 + i * 0.27);
        const d = [p.foot[0] - top[0], p.foot[1] - top[1]], L = Math.hypot(d[0], d[1]);
        const n = [-d[1] / L, d[0] / L];
        stroke(ctx, [[c[0] + n[0] * 0.06, c[1] + n[1] * 0.06], [c[0] - n[0] * 0.06, c[1] - n[1] * 0.06]], 0.016, 'rgba(0,0,0,0.4)', 'butt');
      }
    }
  }

  function drawArm(ctx, p, kit, dim) {
    const k = (c) => (dim ? shade(c, -0.4) : c);
    limb(ctx, p.shoulder, p.elbow, 0.12, 0.095, k(kit.jersey));
    limb(ctx, p.elbow, p.hand, 0.095, 0.075, k(kit.jersey));
    if (!dim) limb(ctx, at(p.shoulder, p.elbow, 0.15), at(p.shoulder, p.elbow, 0.85), 0.035, 0.03, kit.jersey2, false);
    // glove
    ctx.beginPath();
    ctx.ellipse(p.hand[0] + 0.01, p.hand[1] + 0.005, 0.055, 0.045, 0, 0, TAU);
    ctx.fillStyle = k(kit.gloves);
    ctx.fill();
    ctx.lineWidth = 0.007; ctx.strokeStyle = EDGE; ctx.stroke();
  }

  function drawTorso(ctx, p, kit) {
    const T = (u, v) => [p.hip[0] + p.tdir[0] * u + p.fwd[0] * v, p.hip[1] + p.tdir[1] * u + p.fwd[1] * v];
    // seat of the pants
    ctx.beginPath();
    ctx.ellipse(p.hip[0] - 0.02, p.hip[1] - 0.01, 0.15, 0.1, 0, 0, TAU);
    ctx.fillStyle = kit.pants;
    ctx.fill();
    ctx.lineWidth = 0.007; ctx.strokeStyle = EDGE; ctx.stroke();
    // jersey over a chest protector: broad back, bulked chest
    const body = [T(-0.02, -0.15), T(0.22, -0.16), T(0.46, -0.13), T(0.56, -0.03), T(0.54, 0.09), T(0.42, 0.15), T(0.22, 0.14), T(0.04, 0.12)];
    fillShape(ctx, body, kit.jersey, { smooth: 0.9, gloss: 0.6 });
    // side panel and number board on the back
    fillShape(ctx, [T(0.1, -0.03), T(0.44, -0.05), T(0.46, -0.01), T(0.12, 0.01)], kit.jersey2, { smooth: 0.6 });
    fillShape(ctx, [T(0.38, 0.1), T(0.5, 0.06), T(0.54, 0.09), T(0.42, 0.15)], kit.jersey2, { smooth: 0.4 });
    // kidney belt
    limb(ctx, T(0.06, -0.15), T(0.06, 0.12), 0.06, 0.06, kit.pants, true);
    // neck brace bridging the shoulders and helmet
    limb(ctx, T(0.5, -0.02), T(0.62, 0.02), 0.15, 0.12, '#1f2024');
  }

  function drawHelmet(ctx, p, kit, pitch) {
    ctx.save();
    ctx.translate(p.head[0], p.head[1]);
    // keep the head roughly level as the bike pitches up
    ctx.rotate(-pitch * 0.55 - 0.12);
    ctx.lineWidth = 0.007;
    ctx.strokeStyle = EDGE;
    // shell
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.155, 0.145, 0, 0, TAU);
    ctx.fillStyle = kit.helmet;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = kit.helmet2;
    ctx.beginPath();
    ctx.moveTo(-0.22, 0.0); ctx.lineTo(0.02, 0.17); ctx.lineTo(0.11, 0.17); ctx.lineTo(-0.16, -0.05); ctx.closePath();
    ctx.fill();
    const g = ctx.createLinearGradient(0, 0.15, 0, -0.15);
    g.addColorStop(0, 'rgba(255,255,255,0.4)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = g;
    ctx.fillRect(-0.2, -0.2, 0.4, 0.4);
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.155, 0.145, 0, 0, TAU);
    ctx.stroke();
    // chin bar, jutting forward
    ctx.beginPath();
    ctx.moveTo(0.04, -0.05); ctx.lineTo(0.2, -0.04); ctx.quadraticCurveTo(0.235, -0.12, 0.14, -0.16); ctx.lineTo(0.0, -0.14); ctx.closePath();
    ctx.fillStyle = kit.helmet2;
    ctx.fill(); ctx.stroke();
    // mouthpiece vent
    stroke(ctx, [[0.17, -0.07], [0.2, -0.09]], 0.012, 'rgba(0,0,0,0.45)');
    // peak
    ctx.beginPath();
    ctx.moveTo(0.0, 0.11); ctx.lineTo(0.27, 0.09); ctx.lineTo(0.26, 0.055); ctx.lineTo(0.05, 0.055); ctx.closePath();
    ctx.fillStyle = kit.helmet;
    ctx.fill(); ctx.stroke();
    // goggles: strap, frame, tinted lens
    stroke(ctx, [[-0.15, 0.03], [0.08, 0.02]], 0.04, kit.visor, 'butt');
    ctx.beginPath();
    ctx.moveTo(0.07, 0.05); ctx.lineTo(0.18, 0.045); ctx.lineTo(0.18, -0.03); ctx.lineTo(0.07, -0.025); ctx.closePath();
    ctx.fillStyle = kit.visor;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.095, 0.036); ctx.lineTo(0.172, 0.033); ctx.lineTo(0.172, -0.018); ctx.lineTo(0.095, -0.014); ctx.closePath();
    const lg = ctx.createLinearGradient(0.095, 0.036, 0.172, -0.018);
    lg.addColorStop(0, kit.lens); lg.addColorStop(1, shade(kit.lens, -0.5));
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */

  // opts: { lean, spin, blur, rider (bool), pitch }
  function drawBike(ctx, id, opts = {}) {
    const art = COMPILED[id];
    const spin = -(opts.spin || 0);
    const blur = opts.blur || 0;
    const lean = opts.lean || 0;
    const rider = opts.rider !== false;
    const p = rider ? pose(art, lean) : null;
    ctx.lineJoin = 'round';

    if (rider) {
      // far-side leg and arm, shaded, behind the bike
      const far = Object.assign({}, p, {
        knee: [p.knee[0] - 0.04, p.knee[1] + 0.02], foot: [p.foot[0] - 0.04, p.foot[1]],
        elbow: [p.elbow[0] - 0.05, p.elbow[1] + 0.03], hand: [p.hand[0] - 0.03, p.hand[1] + 0.015],
      });
      drawLeg(ctx, far, art.kit, true);
      drawArm(ctx, far, art.kit, true);
    }

    // Suspension: the rear wheel moves up and down against the chassis, the
    // front wheel slides along the fork. Offsets are from static sag,
    // positive towards the chassis.
    const fo = opts.frontOff || 0, ro = opts.rearOff || 0;
    const fu = [-Math.sin(FORK_RAKE), Math.cos(FORK_RAKE)];
    art._dyn = { front: [art.WB + fo * fu[0], art.R + fo * fu[1]], rear: [0, art.R + ro], shift: [fo * fu[0], fo * fu[1]] };
    drawWheel(ctx, art._dyn.rear, art.R, art.pal, spin, blur, art.R * 0.32, art.sprocketR);
    drawWheel(ctx, art._dyn.front, art.R, art.pal, opts.frontSpin !== undefined ? -opts.frontSpin : spin, blur, art.R * 0.38, 0);
    for (const q of art.parts) drawPart(ctx, q, art, spin);

    if (rider) {
      drawTorso(ctx, p, art.kit);
      drawLeg(ctx, p, art.kit, false);
      drawArm(ctx, p, art.kit, false);
      drawHelmet(ctx, p, art.kit, opts.pitch || 0);
    }
  }

  // A rider on their own, for the crash tumble. Drawn around the hip.
  function drawLooseRider(ctx, id) {
    const art = COMPILED[id];
    const p = pose(art, 0.6);
    ctx.translate(-p.hip[0], -p.hip[1]);
    drawLeg(ctx, Object.assign({}, p, { knee: [p.knee[0] - 0.05, p.knee[1]] }), art.kit, true);
    drawTorso(ctx, p, art.kit);
    drawLeg(ctx, p, art.kit, false);
    drawArm(ctx, p, art.kit, false);
    drawHelmet(ctx, p, art.kit, 0);
  }

  function info(id) {
    const art = COMPILED[id];
    const p = pose(art, 0);
    return { R: art.R, WB: art.WB, hip: p.hip, light: art.light };
  }

  const api = { drawBike, drawLooseRider, info, ART, COMPILED };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BikeArt = api;
})(typeof self !== 'undefined' ? self : this);
