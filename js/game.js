(function () {
  'use strict';

  const Sim = window.WheelieSim;
  const Parts = window.Parts;
  const R = window.Render;
  const Art = window.BikeArt;
  const Atmo = window.Atmo;
  const BIKES = window.BIKES;
  const DEG = Sim.DEG;
  const clamp = Atmo.clamp;

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');

  /* ---------- persistence (best-effort; the game works without it) ---------- */
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('2d2wheels.' + key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('2d2wheels.' + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
  };

  /* ---------- conditions ---------- */
  // Time of day: where the clock starts (hours) and how fast it runs (hours
  // per second of riding). Sunset runs into the night over about a minute.
  const TIMES = [
    { id: 'dawn', label: 'Dawn', start: 5.55, rate: 1 / 50 },
    { id: 'day', label: 'Day', start: 12.5, rate: 1 / 120 },
    { id: 'sunset', label: 'Sunset', start: 17.4, rate: 1 / 50 },
    { id: 'night', label: 'Night', start: 22.5, rate: 1 / 120 },
  ];
  const WEATHERS = [
    { id: 'random', label: 'Random' },
    { id: 'clear', label: 'Clear' },
    { id: 'rain', label: 'Rain' },
    { id: 'storm', label: 'Storm' },
  ];
  const WANTED_INFO = [
    null,
    'Slow cruiser that sets off late · ×1 points',
    'The standard chase · ×1.5 points',
    'Faster, and they lay stingers: wheelie over them · ×2 points',
    'Helicopter overhead, so they never fall far behind · ×3 points',
    'Interceptor, the lot · ×4 points',
  ];
  let condWanted = clamp(store.get('wanted', 2) | 0, 1, 5);
  // Where to ride: the desert track, or the airfield (flat, endless, no
  // obstacles, no police; practice, so it pays no points).
  const LOCATIONS = [
    { id: 'track', label: 'Desert track' },
    { id: 'airfield', label: 'Airfield' },
  ];
  let condLocation = store.get('location', 'track') === 'airfield' ? 'airfield' : 'track';
  const onAirfield = () => condLocation === 'airfield';
  let condTime = store.get('time', 'sunset');
  let condWeather = store.get('weather', 'random');
  if (!TIMES.some((t) => t.id === condTime)) condTime = 'sunset';
  if (!WEATHERS.some((w) => w.id === condWeather)) condWeather = 'random';
  function pickWeather() {
    const r = Math.random();
    return r < 0.45 ? 'clear' : r < 0.78 ? 'rain' : 'storm';
  }

  /* ---------- state ---------- */
  let bikeIndex = Math.max(0, BIKES.findIndex((b) => b.id === store.get('bike', BIKES[0].id)));
  let mode = 'menu'; // menu | play | results
  let sim, handling, terrain, bike, fx, timeOf, weatherKind, atmo;
  let camY = 0, camFocus = 0, camLead = 0.32;
  let rider = null;     // crash tumble
  let crashPose = null; // where the bike pivots as it goes over
  let particles = [];
  let debris = [];      // cones and tyres knocked flying
  let gone = new Set(); // obstacles no longer on the track
  let stats = null;
  let zoom = 1;
  let run = null;       // score for the current ride
  let hintTimer = 0;
  let shake = 0;
  let clock = 0;
  let hl = 0, hlOn = false, hlT = 0; // headlight
  let runsThisSession = 0;
  let heli = null;      // the four- and five-star helicopter
  let wantedMult = 1;
  const demo = { up: true, t: 0 };
  const keys = { throttle: false, brake: false, leanBack: false, leanFwd: false, clutch: false };
  // Tricks: one key each, held. The last one pressed wins.
  const TRICKS = {
    swing: { label: 'Arm swing', mult: 1.5 },
    drag: { label: 'Hand drag', mult: 3 },
    surf: { label: 'Seat surf', mult: 2 },
  };
  const trickHeld = [];
  let build = null;     // the fitted parts for this run (Parts.apply)
  let modeIdx = 0;      // ride mode
  let assistOff = false; // anti-loop switched off
  let hudModeHtml = '';

  const bestScore = (id) => store.get('hi.' + id, 0);
  const bestDist = (id) => store.get('far.' + id, 0);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  /* ---------- canvas sizing ---------- */
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    sizeStage();
  }
  window.addEventListener('resize', resize);

  /* ---------- garage (bike select) ---------- */
  const stage = $('stage');
  const sctx = stage.getContext('2d');
  function sizeStage() {
    const r = stage.getBoundingClientRect();
    if (!r.width) return;
    stage.width = Math.round(r.width * DPR);
    stage.height = Math.round(r.height * DPR);
  }

  const list = $('bike-list');
  BIKES.forEach((b, i) => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.type = 'button';
    chip.setAttribute('aria-label', b.name);
    chip.innerHTML = `<canvas width="240" height="120" aria-hidden="true"></canvas><span class="chip-name">${b.name}</span>`;
    chip.addEventListener('click', () => selectBike(i));
    chip.addEventListener('dblclick', () => { selectBike(i); startRun(); });
    list.appendChild(chip);
  });
  // The bike chips, drawn with each bike's current build.
  function drawChips() {
    BIKES.forEach((b, i) => {
      const c = list.children[i].querySelector('canvas').getContext('2d');
      const s = 240 / 2.6;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, 240, 120);
      c.save();
      c.translate(120 - (b.look.wheelbase / 2) * s, 112);
      c.scale(s, -s);
      Art.drawBike(c, b.id, { rider: false, spin: 0.4, style: Parts.apply(b, buildOf(b.id)).style });
      c.restore();
    });
  }

  // Conditions pickers: two rows of segmented buttons.
  function buildSeg(el, options, get, set) {
    for (const o of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.textContent = o.label;
      btn.setAttribute('aria-label', typeof o.id === 'number' ? `${o.id} star${o.id > 1 ? 's' : ''}` : o.label);
      btn.addEventListener('click', () => { set(o.id); refreshSeg(); newRun(false); });
      btn.dataset.id = o.id;
      el.appendChild(btn);
    }
    const refreshSeg = () => [...el.children].forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === String(get()))));
    refreshSeg();
  }
  buildSeg($('seg-time'), TIMES, () => condTime, (id) => { condTime = id; store.set('time', id); });
  buildSeg($('seg-location'), LOCATIONS, () => condLocation, (id) => { condLocation = id; store.set('location', id); refreshLocation(); });
  function refreshLocation() {
    $('cond-wanted').hidden = onAirfield();
    $('wanted-desc').textContent = onAirfield() ? 'Practice on an endless runway: no obstacles, no police, no points.' : WANTED_INFO[condWanted];
  }
  buildSeg($('seg-weather'), WEATHERS, () => condWeather, (id) => { condWeather = id; store.set('weather', id); });
  buildSeg($('seg-wanted'), [1, 2, 3, 4, 5].map((n) => ({ id: n, label: '★'.repeat(n) })), () => condWanted, (id) => {
    condWanted = id; store.set('wanted', id); $('wanted-desc').textContent = WANTED_INFO[id];
  });
  refreshLocation();

  const SPEC_MAX = { power: Math.log(80), weight: 130, speed: 150 };
  function specRow(label, value, frac) {
    return `<div class="spec"><span class="spec-label">${label}</span><span class="spec-bar"><i style="width:${Math.round(frac * 100)}%"></i></span><span class="spec-val">${value}</span></div>`;
  }

  function refreshMenu() {
    const b = BIKES[bikeIndex];
    [...list.children].forEach((chip, i) => chip.setAttribute('aria-pressed', String(i === bikeIndex)));
    const num = $('bike-num');
    num.textContent = String(bikeIndex + 1);
    num.style.background = b.look.plate;
    num.style.color = b.look.plateInk;
    const diff = $('bike-diff');
    diff.textContent = b.difficulty;
    diff.className = `diff diff-${b.difficulty.toLowerCase()}`;
    $('bike-maker').textContent = b.maker;
    $('bike-name').textContent = b.name;
    $('bike-blurb').textContent = b.blurb;
    const sp = Parts.apply(b, buildOf(b.id)).spec;
    const built = sp.peakPowerKw !== b.peakPowerKw || sp.topSpeedKmh !== b.topSpeedKmh || sp.weightKg !== b.weightKg;
    $('specs').innerHTML =
      specRow('Peak power', `${sp.peakPowerKw} kW`, Math.min(1, Math.log(sp.peakPowerKw * 1.33) / SPEC_MAX.power)) +
      specRow('Weight', `${+sp.weightKg.toFixed(1)} kg`, sp.weightKg / SPEC_MAX.weight) +
      specRow('Top speed', `${sp.topSpeedKmh} km/h`, Math.min(1, sp.topSpeedKmh / SPEC_MAX.speed)) +
      `<div class="spec-extra">${b.extra}${built ? ' · <b>with your parts</b>' : ''}</div>`;
    $('bank').textContent = fmt(store.get('bank', 0));
    if (tab === 'shop') renderShop();
    const bsc = bestScore(b.id);
    $('bike-best').textContent = bsc > 0 ? `${fmt(bsc)} pts · ${fmt(bestDist(b.id))} m` : 'No run yet';
    $('bike-sources').innerHTML = 'Specs: ' + b.sources.map((u) => `<a href="${u}" target="_blank" rel="noopener">${new URL(u).hostname.replace(/^www\./, '')}</a>`).join(' · ');
  }

  /* ---------- workshop ---------- */
  // Builds, owned parts and the points bank live in localStorage:
  //   build.<bike>  { slot: itemId, 'slot:v': variant }
  //   owned         { 'bike/slot/item': true }
  //   bank          points to spend
  const buildOf = (id) => store.get('build.' + id, {});
  const ownedMap = () => store.get('owned', {});
  let shopSlot = null;  // the expanded slot
  let preview = null;   // { slot, item, v } under the pointer
  let tab = store.get('tab', 'ride') === 'shop' ? 'shop' : 'ride';

  function appliedFor(b, override) {
    const build = Object.assign({}, buildOf(b.id));
    if (override) { build[override.slot] = override.item; build[override.slot + ':v'] = override.v | 0; }
    return Parts.apply(b, build);
  }

  function setTab(t) {
    tab = t;
    store.set('tab', t);
    $('tab-ride').setAttribute('aria-selected', String(t === 'ride'));
    $('tab-shop').setAttribute('aria-selected', String(t === 'shop'));
    show('pane-ride', t === 'ride');
    show('pane-shop', t === 'shop');
    if (t === 'shop') renderShop();
  }
  $('tab-ride').addEventListener('click', () => setTab('ride'));
  $('tab-shop').addEventListener('click', () => setTab('shop'));

  const pct = (x) => `${x > 0 ? '+' : ''}${Math.round(x * 100)}%`;
  // What swapping to `b` (a build) changes from `a`, in a few short lines.
  function effects(a, b) {
    const out = [];
    const num = (label, x, y, unit, better, dp = 0) => {
      if (Math.abs(x - y) < (dp ? 0.05 : 0.5)) return;
      out.push({ t: `${label} ${x.toFixed(dp)} → ${y.toFixed(dp)} ${unit}`, up: better(y, x) });
    };
    const rel = (label, x, y, better = 1) => { if (Math.abs(y / x - 1) >= 0.01) out.push({ t: `${label} ${pct(y / x - 1)}`, up: (y > x) === (better > 0) }); };
    num('Power', a.spec.peakPowerKw, b.spec.peakPowerKw, 'kW', (p, q) => p > q, 1);
    num('Top speed', a.spec.topSpeedKmh, b.spec.topSpeedKmh, 'km/h', (p, q) => p > q);
    num('Weight', a.spec.weightKg, b.spec.weightKg, 'kg', (p, q) => p < q, 1);
    rel('Pull', a.mods.torque, b.mods.torque);
    for (const [k, l] of [['dry', 'Grip'], ['wet', 'Wet grip'], ['mud', 'Mud']]) rel(l, a.mods.grip[k], b.mods.grip[k]);
    rel('Brakes', a.mods.brake, b.mods.brake);
    rel('Pop', a.mods.pop, b.mods.pop);
    const damp = (m) => ((m.susp.forkC || 1) + (m.susp.rearC || 1)) / 2;
    rel('Damping', damp(a.mods), damp(b.mods));
    if (Math.abs(a.mods.absorb - b.mods.absorb) > 0.005) out.push({ t: `Soaks up hits ${pct(b.mods.absorb - a.mods.absorb)}`, up: b.mods.absorb > a.mods.absorb });
    const len = (L) => (L ? L.len : 0);
    if (len(a.light) !== len(b.light)) out.push({ t: b.light ? `Beam ${len(a.light)} → ${len(b.light)} m` : 'No lights', up: len(b.light) > len(a.light) });
    for (const p of b.perks) if (!a.perks.has(p)) out.push({ t: `+ ${Parts.PERKS[p].label}`, up: true });
    for (const p of a.perks) if (!b.perks.has(p)) out.push({ t: `− ${Parts.PERKS[p].label}`, up: false });
    return out;
  }

  // Why a part can't deliver its full power: the weakest of controller,
  // motor and battery.
  function powerNote(b, cand, it) {
    if (!it.kw || cand.spec.peakPowerKw >= it.kw) return '';
    for (const sid of ['controller', 'motor', 'battery']) {
      const f = cand.fitted[sid];
      if (f && f.kw === cand.spec.peakPowerKw) return `Held to ${cand.spec.peakPowerKw} kW by the ${f.name}.`;
    }
    return '';
  }

  function renderShop() {
    const b = BIKES[bikeIndex];
    const build = buildOf(b.id);
    const cur = Parts.apply(b, build);
    const stock = Parts.apply(b, {});
    const own = ownedMap();
    const bank = store.get('bank', 0);
    $('bank').textContent = fmt(bank);
    const stat = (label, v, unit, s0) => `<div class="stat"><span>${label}</span><b>${v}</b><small>${unit}${s0 !== v ? ` · stock ${s0}` : ''}</small></div>`;
    $('build-sum').innerHTML =
      stat('Power', cur.spec.peakPowerKw, 'kW', stock.spec.peakPowerKw) +
      stat('Top speed', cur.spec.topSpeedKmh, 'km/h', stock.spec.topSpeedKmh) +
      stat('Weight', +cur.spec.weightKg.toFixed(1), 'kg', stock.spec.weightKg) +
      `<div class="perkline">${[...cur.perks].map((p) => `<span class="perk" title="${Parts.PERKS[p].text}">${Parts.PERKS[p].label}${Parts.PERKS[p].key ? ` · ${Parts.PERKS[p].key}` : ''}</span>`).join('')}</div>`;
    const box = $('slots');
    box.innerHTML = '';
    for (const slot of Parts.slotsFor(b.id)) {
      const fit = cur.fitted[slot.id];
      const vi = build[slot.id + ':v'] | 0;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'slot-row' + (fit.id !== 'stock' ? ' upgraded' : '');
      row.setAttribute('aria-expanded', String(shopSlot === slot.id));
      row.innerHTML = `<span class="slot-label">${slot.label}</span><span class="slot-fit">${fit.name}${fit.variants ? ` · ${fit.variants[vi].label}` : ''}</span><span class="chev" aria-hidden="true">›</span>`;
      row.addEventListener('click', () => { shopSlot = shopSlot === slot.id ? null : slot.id; renderShop(); });
      box.appendChild(row);
      if (shopSlot !== slot.id) continue;
      const listEl = document.createElement('div');
      listEl.className = 'part-list';
      listEl.addEventListener('pointerleave', () => { preview = null; });
      for (const it of slot.items) {
        const isFit = fit.id === it.id;
        const has = Parts.owned(own, b.id, slot.id, it.id);
        const cand = Parts.apply(b, Object.assign({}, build, { [slot.id]: it.id }));
        const fx = isFit ? [] : effects(cur, cand);
        const card = document.createElement('div');
        card.className = 'part' + (isFit ? ' fitted' : '');
        const price = isFit ? '<span class="price owned">Fitted</span>' : has ? '<span class="price owned">Owned</span>' : `<span class="price">${fmt(it.price)} pts</span>`;
        const perks = (it.perks || []).filter((p) => p !== 'modes' || !stock.perks.has('modes')).map((p) => `<span class="perk" title="${Parts.PERKS[p].text}">${Parts.PERKS[p].label}</span>`).join('');
        const pn = powerNote(b, cand, it);
        card.innerHTML =
          `<div class="part-head"><b>${it.name}</b><span class="maker">${it.maker}${it.usd ? ` · about $${fmt(it.usd)}` : ''}</span>${price}</div>` +
          `<div class="part-specs">${it.specs || ''}</div>` +
          (it.text ? `<div class="part-text">${it.text}</div>` : '') +
          (perks ? `<div class="part-fx">${perks}</div>` : '') +
          (fx.length ? `<div class="part-fx">${fx.map((f) => `<span class="${f.up ? 'up' : 'down'}">${f.t}</span>`).join('')}</div>` : (!isFit && !perks ? '<div class="part-fx"><span>Looks only</span></div>' : '')) +
          (pn ? `<div class="note">${pn}</div>` : '') +
          (it.note ? `<div class="note">${it.note}</div>` : '') +
          `<div class="part-foot"></div>`;
        const foot = card.querySelector('.part-foot');
        const act = document.createElement('button');
        act.type = 'button';
        act.className = 'part-act';
        if (isFit) { act.textContent = 'Fitted'; act.disabled = true; }
        else if (has) { act.textContent = 'Fit'; act.addEventListener('click', () => fitPart(b, slot.id, it.id, 0)); }
        else if (bank >= it.price) { act.textContent = 'Buy & fit'; act.classList.add('buy'); act.addEventListener('click', () => buyPart(b, slot, it)); }
        else { act.textContent = `Need ${fmt(it.price - bank)} more`; act.disabled = true; }
        foot.appendChild(act);
        if (it.variants) {
          const sw = document.createElement('div');
          sw.className = 'swatches';
          it.variants.forEach((v, k) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'swatch';
            btn.title = v.label;
            btn.setAttribute('aria-label', `${it.name}: ${v.label}`);
            btn.setAttribute('aria-pressed', String(isFit && vi === k));
            btn.style.background = swatchColour(v.style);
            btn.addEventListener('pointerenter', () => { preview = { slot: slot.id, item: it.id, v: k }; });
            btn.addEventListener('click', () => { if (has) fitPart(b, slot.id, it.id, k); else preview = { slot: slot.id, item: it.id, v: k }; });
            sw.appendChild(btn);
          });
          foot.appendChild(sw);
        }
        if (it.src && it.src.length) {
          const a = document.createElement('a');
          a.href = it.src[0]; a.target = '_blank'; a.rel = 'noopener';
          a.textContent = new URL(it.src[0]).hostname.replace(/^www\./, '');
          foot.appendChild(a);
        }
        card.addEventListener('pointerenter', () => { preview = { slot: slot.id, item: it.id, v: isFit ? vi : 0 }; });
        card.addEventListener('focusin', () => { preview = { slot: slot.id, item: it.id, v: isFit ? vi : 0 }; });
        listEl.appendChild(card);
      }
      box.appendChild(listEl);
    }
  }

  // The colour a variant shows off, for its swatch.
  function swatchColour(st) {
    for (const k of ['rim', 'paint', 'controller', 'fork', 'light', 'shock']) {
      const v = st[k];
      if (!v) continue;
      if (typeof v === 'string') return v;
      return v.c || v.upper || v.back || v.spring || (v.ramp && v.ramp[1]) || '#888';
    }
    return '#888';
  }

  function fitPart(b, slotId, itemId, v) {
    const build = buildOf(b.id);
    build[slotId] = itemId;
    build[slotId + ':v'] = v | 0;
    store.set('build.' + b.id, build);
    preview = null;
    afterBuildChange();
  }

  function buyPart(b, slot, it) {
    const bank = store.get('bank', 0);
    if (bank < it.price) return;
    store.set('bank', bank - it.price);
    const own = ownedMap();
    own[`${b.id}/${slot.id}/${it.id}`] = true;
    store.set('owned', own);
    audio.unlock();
    audio.chime(true);
    fitPart(b, slot.id, it.id, 0);
  }

  function afterBuildChange() {
    drawChips();
    refreshMenu();
    if (mode === 'menu') newRun(false);
  }

  function selectBike(i) {
    bikeIndex = (i + BIKES.length) % BIKES.length;
    store.set('bike', BIKES[bikeIndex].id);
    stageT = 0;
    refreshMenu();
    if (mode === 'menu') newRun(false);
  }

  function show(id, on) { $(id).hidden = !on; }

  function openMenu() {
    mode = 'menu';
    show('menu', true); show('results', false); show('hud', false); show('touch', false);
    refreshMenu();
    sizeStage();
    newRun(false); // the demo rider behind the menu
    $('btn-start').focus({ preventScroll: true });
  }

  // The stage: the selected bike on a dirt mound, popping a slow wheelie.
  let stageT = 0;
  function drawStage(dt) {
    if (mode !== 'menu' || !stage.width) return;
    stageT += dt;
    const w = stage.width, h = stage.height;
    const b = BIKES[bikeIndex];
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    const bg = sctx.createRadialGradient(w * 0.5, h * 0.75, h * 0.1, w * 0.5, h * 0.6, w * 0.7);
    bg.addColorStop(0, '#4a2f2c');
    bg.addColorStop(1, '#170f13');
    sctx.fillStyle = bg;
    sctx.fillRect(0, 0, w, h);
    // spotlight cone
    const cone = sctx.createLinearGradient(0, 0, 0, h);
    cone.addColorStop(0, 'rgba(255,214,150,0.18)');
    cone.addColorStop(1, 'rgba(255,214,150,0)');
    sctx.fillStyle = cone;
    sctx.beginPath();
    sctx.moveTo(w * 0.42, 0); sctx.lineTo(w * 0.58, 0); sctx.lineTo(w * 0.88, h); sctx.lineTo(w * 0.12, h);
    sctx.fill();
    // mound
    const groundY = h * 0.84;
    sctx.fillStyle = '#7a4b2e';
    sctx.beginPath();
    sctx.ellipse(w * 0.5, groundY + h * 0.2, w * 0.46, h * 0.22, 0, Math.PI, 0);
    sctx.fill();
    sctx.fillStyle = '#9a6238';
    sctx.beginPath();
    sctx.ellipse(w * 0.5, groundY + h * 0.2, w * 0.46, h * 0.2, 0, Math.PI * 1.05, Math.PI * 1.95);
    sctx.lineTo(w * 0.5, groundY);
    sctx.fill();

    // fits the tallest bike and rider (about 2.1 m) above the mound
    const scale = Math.min((groundY - h * 0.04) / 2.1, w / 2.6);
    const wb = b.look.wheelbase, wr = b.look.wheelRadius;
    // a gentle wheelie every few seconds: the fork dips, then the nose comes up
    const cyc = (stageT % 5) / 5;
    const lift = cyc < 0.15 ? 0 : cyc < 0.55 ? Math.sin(((cyc - 0.15) / 0.4) * Math.PI / 2) : cyc < 0.8 ? 1 : 1 - (cyc - 0.8) / 0.2;
    const dip = cyc > 0.08 && cyc < 0.16 ? Math.sin(((cyc - 0.08) / 0.08) * Math.PI) : 0;
    const land = cyc > 0.95 ? Math.sin(((cyc - 0.95) / 0.05) * Math.PI) : 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const p = reduce ? 0 : lift * 22 * DEG;
    // shadow
    const sg = sctx.createRadialGradient(w * 0.5, groundY, 0, w * 0.5, groundY, wb * scale * 0.7);
    sg.addColorStop(0, 'rgba(20,8,6,0.55)');
    sg.addColorStop(1, 'rgba(20,8,6,0)');
    sctx.save();
    sctx.translate(0, groundY); sctx.scale(1, 0.14); sctx.translate(0, -groundY);
    sctx.fillStyle = sg;
    sctx.beginPath(); sctx.arc(w * 0.5, groundY, wb * scale * 0.7, 0, Math.PI * 2); sctx.fill();
    sctx.restore();
    sctx.save();
    sctx.translate(w * 0.5 - (wb / 2) * scale, groundY - wr * scale);
    sctx.scale(scale, -scale);
    sctx.rotate(p);
    sctx.translate(0, -wr);
    const front = reduce ? 0 : (dip + land) * 0.07 - (lift > 0.3 ? 0.04 : 0);
    const look = appliedFor(b, preview).style;
    Art.drawBike(sctx, b.id, { lean: lift * 0.8 - dip * 0.6, spin: reduce ? 0 : stageT * 3, pitch: p, frontOff: front, rearOff: reduce ? 0 : lift * 0.03, style: look, lit: true });
    sctx.restore();
  }

  /* ---------- runs ---------- */
  function newRun(play) {
    bike = BIKES[bikeIndex];
    build = Parts.apply(bike, buildOf(bike.id));
    handling = Sim.deriveHandling(build.spec, Object.assign({}, build.mods, { perks: build.perks, modes: build.modes }));
    handling.dragHip = Art.info(bike.id).dragHip;
    modeIdx = 0;
    assistOff = false;
    const seed = (Math.random() * 1e9) | 0;
    terrain = Sim.createTerrain(seed, { airfield: onAirfield() });
    weatherKind = condWeather === 'random' ? pickWeather() : condWeather;
    terrain.env = Sim.createWeather(seed, weatherKind);
    timeOf = TIMES.find((t) => t.id === condTime);
    fx = Atmo.createFx(seed);
    const chase = play && !onAirfield();
    sim = Sim.createState({ police: chase, wanted: condWanted, seed });
    wantedMult = chase ? Sim.WANTED[condWanted].mult : 1;
    heli = chase && Sim.WANTED[condWanted].heli ? { x: -30, y: 12, vx: 0, on: false } : null;
    rider = null;
    crashPose = null;
    particles = [];
    debris = [];
    gone = new Set();
    stats = { topSpeed: 0, clears: 0, closeCalls: 0, endT: 0, tricks: { swing: 0, drag: 0, surf: 0 } };
    trickHeld.length = 0;
    run = { score: 0, mult: 1, lastX: 0, sweet: false, popups: [], milestone: 0, passedBest: false, danger: false, tips: new Set(), warned: new Set() };
    hl = 0; hlOn = false;
    demo.up = true; demo.t = 0;
    camY = terrain.base(0);
    camFocus = 0;
    camLead = 0.32;
  }

  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  function startRun() {
    mode = 'play';
    newRun(true);
    runsThisSession++;
    show('menu', false); show('results', false); show('hud', true); show('touch', isTouch);
    $('hud-bike').textContent = bike.name;
    $('hud-best').textContent = onAirfield() ? `Practice · best wheelie ${fmt(store.get('air.wheelie.' + bike.id, 0))} m` : `Best ${fmt(bestScore(bike.id))}`;
    hint(isTouch ? 'Hold Gas, tap ◀ Lean to pop the front' : 'Hold ↑, tap ← to pop the front', 2.8);
    if (build.perks.has('launch')) setTimeout(() => { if (mode === 'play' && sim.time < 3) hint(isTouch ? 'Launch control: hold Gas and Brake, let go of Brake' : 'Launch control: hold ↑ and ↓, let go of ↓', 2.6); }, 2900);
    $('touch-clutch').hidden = !build.perks.has('clutch');
    $('touch-mode').hidden = build.modes.length < 2;
    $('touch-assist').hidden = !build.perks.has('antiLoop');
    for (const k in keys) keys[k] = false;
    audio.unlock();
  }

  function finishRun() {
    mode = 'results';
    if (onAirfield()) { finishPractice(); return; }
    $('res-bank').parentElement.hidden = false;
    $('res-clears').parentElement.hidden = false;
    const prev = bestScore(bike.id);
    const isBest = run.score > prev;
    if (isBest) store.set('hi.' + bike.id, Math.round(run.score));
    if (sim.distance > bestDist(bike.id)) store.set('far.' + bike.id, Math.round(sim.distance));
    const bank = store.get('bank', 0) + Math.round(run.score);
    store.set('bank', bank);
    $('res-title').textContent = sim.cause || 'Crashed';
    $('res-title').className = 'crash';
    $('res-bike').textContent = `${bike.name} · ${weatherLabel()} · ${'★'.repeat(condWanted)}`;
    $('res-dist').textContent = fmt(run.score);
    $('res-dist').nextElementSibling.textContent = 'pts';
    $('res-dist-m').textContent = `${fmt(sim.distance)} m · ${stats.endT.toFixed(0)} s`;
    $('res-wheelie').textContent = `${fmt(sim.wheelieTotal)} m · longest ${fmt(sim.longest)} m`;
    $('res-clears').textContent = String(stats.clears) + (stats.closeCalls ? ` · ${stats.closeCalls} close call${stats.closeCalls > 1 ? 's' : ''}` : '');
    $('res-speed').textContent = `${Math.round(stats.topSpeed * 3.6)} km/h`;
    $('res-tricks').textContent = trickSummary();
    $('res-bank').textContent = `${fmt(bank)} (+${fmt(run.score)})`;
    // the next thing the bank can buy for this bike, or the cheapest one to aim for
    const own = ownedMap(), parts = [];
    for (const slot of Parts.slotsFor(bike.id)) for (const it of slot.items) if (!Parts.owned(own, bike.id, slot.id, it.id)) parts.push(it);
    parts.sort((x, y) => y.price - x.price);
    const can = parts.find((it) => it.price <= bank);
    const next = parts[parts.length - 1];
    $('res-shop').innerHTML = can ? `You can buy the <b>${can.name}</b> in the workshop.` : next ? `<b>${fmt(next.price - bank)}</b> more points for the ${next.name}.` : 'You own every part for this bike.';
    const rb = $('res-best');
    rb.textContent = isBest ? (prev > 0 ? `New best, up from ${fmt(prev)}` : 'New best') : `Best ${fmt(prev)}`;
    rb.className = 'res-best' + (isBest ? ' new' : '');
    show('results', true); show('touch', false);
    $('btn-retry').focus({ preventScroll: true });
  }

  // The airfield's results: no points, just your longest wheelie and top
  // speed there, against your bests on this bike.
  function finishPractice() {
    const kw = 'air.wheelie.' + bike.id, ks = 'air.speed.' + bike.id;
    const prevW = store.get(kw, 0), prevS = store.get(ks, 0);
    const top = Math.round(stats.topSpeed * 3.6);
    const newW = sim.longest > prevW, newS = top > prevS;
    if (newW) store.set(kw, Math.round(sim.longest));
    if (newS) store.set(ks, top);
    $('res-title').textContent = sim.cause || 'Crashed';
    $('res-title').className = 'crash';
    $('res-bike').textContent = `${bike.name} · ${weatherLabel()}`;
    $('res-dist').textContent = fmt(sim.longest);
    $('res-dist').nextElementSibling.textContent = 'm';
    $('res-dist-m').textContent = `${fmt(sim.distance)} m · ${stats.endT.toFixed(0)} s`;
    $('res-wheelie').textContent = `${fmt(sim.wheelieTotal)} m in all`;
    $('res-clears').parentElement.hidden = true;
    $('res-tricks').textContent = trickSummary();
    $('res-speed').textContent = `${top} km/h${newS && prevS ? ' · new best' : ''}`;
    $('res-bank').parentElement.hidden = true;
    $('res-shop').textContent = 'Practice: points only count on the desert track.';
    const rb = $('res-best');
    rb.textContent = newW ? (prevW ? `Longest wheelie, up from ${fmt(prevW)} m` : 'Longest wheelie') : `Best wheelie here ${fmt(prevW)} m`;
    rb.className = 'res-best' + (newW ? ' new' : '');
    show('results', true); show('touch', false);
    $('btn-retry').focus({ preventScroll: true });
  }

  function trickSummary() {
    const parts = Object.keys(TRICKS).filter((k) => stats.tricks[k] >= 1).map((k) => `${TRICKS[k].label.toLowerCase()} ${Math.round(stats.tricks[k])} m`);
    return parts.length ? parts.join(' · ') : 'none';
  }

  function toast(text, big) {
    const el = $('hud-toast');
    el.textContent = text;
    el.classList.toggle('big', !!big);
    el.classList.remove('show');
    void el.offsetWidth; // restart the animation
    el.classList.add('show');
  }

  function hint(text, seconds, warn) {
    const el = $('hud-hint');
    el.textContent = text;
    el.style.opacity = 1;
    el.classList.toggle('warn', !!warn);
    hintTimer = seconds;
  }

  /* ---------- input ---------- */
  const KEYMAP = {
    ArrowUp: 'throttle', KeyW: 'throttle', Space: 'throttle',
    ArrowDown: 'brake', KeyS: 'brake',
    ArrowLeft: 'leanBack', KeyA: 'leanBack',
    ArrowRight: 'leanFwd', KeyD: 'leanFwd',
    ShiftLeft: 'clutch', ShiftRight: 'clutch',
    // tricks: left hand for arrow riders, right hand for WASD riders
    KeyZ: 'swing', KeyJ: 'swing', KeyX: 'drag', KeyK: 'drag', KeyC: 'surf', KeyL: 'surf',
  };

  function toggleAssist() {
    if (mode !== 'play' || !build || !build.perks.has('antiLoop')) return;
    assistOff = !assistOff;
    toast(assistOff ? 'Anti-loop off' : 'Anti-loop on');
    audio.click();
  }

  function nextMode() {
    if (mode !== 'play' || !build || build.modes.length < 2) return;
    modeIdx = (modeIdx + 1) % build.modes.length;
    toast(build.modes[modeIdx].name);
    audio.click();
  }

  window.addEventListener('keydown', (e) => {
    audio.unlock();
    if (e.code === 'KeyM') { audio.toggle(); return; }
    if (mode === 'menu') {
      if (e.target && e.target.closest && e.target.closest('.seg, .pane, .tabs')) return; // let the pickers and the workshop have their keys
      if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') { selectBike(bikeIndex - 1); e.preventDefault(); }
      else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') { selectBike(bikeIndex + 1); e.preventDefault(); }
      else if (e.code === 'Enter') { startRun(); e.preventDefault(); }
      return;
    }
    if (e.code === 'Escape') { openMenu(); return; }
    if (mode === 'results') {
      if (e.code === 'KeyR' || e.code === 'Enter' || e.code === 'Space') { startRun(); e.preventDefault(); }
      return;
    }
    if (e.code === 'KeyR') { startRun(); return; }
    if (e.code === 'KeyQ') { if (!e.repeat) nextMode(); return; }
    if (e.code === 'KeyE') { if (!e.repeat) toggleAssist(); return; }
    const k = KEYMAP[e.code];
    if (k && TRICKS[k]) { if (!trickHeld.includes(k)) trickHeld.push(k); e.preventDefault(); return; }
    if (k) { keys[k] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k && TRICKS[k]) { const i = trickHeld.indexOf(k); if (i >= 0) trickHeld.splice(i, 1); return; }
    if (k) keys[k] = false;
  });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; trickHeld.length = 0; });

  $('touch-mode').addEventListener('pointerdown', (e) => { e.preventDefault(); nextMode(); });
  $('touch-assist').addEventListener('pointerdown', (e) => { e.preventDefault(); toggleAssist(); });
  document.querySelectorAll('.touch-btn[data-key]').forEach((btn) => {
    const k = btn.dataset.key;
    const on = (e) => {
      e.preventDefault(); btn.setPointerCapture(e.pointerId); btn.classList.add('active'); audio.unlock();
      if (TRICKS[k]) { if (!trickHeld.includes(k)) trickHeld.push(k); } else keys[k] = true;
    };
    const off = () => {
      btn.classList.remove('active');
      if (TRICKS[k]) { const i = trickHeld.indexOf(k); if (i >= 0) trickHeld.splice(i, 1); } else keys[k] = false;
    };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('lostpointercapture', off);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  $('btn-start').addEventListener('click', startRun);
  $('btn-retry').addEventListener('click', startRun);
  $('btn-change').addEventListener('click', openMenu);
  $('btn-shop').addEventListener('click', () => { openMenu(); setTab('shop'); });
  $('btn-menu').addEventListener('click', openMenu);
  $('btn-sound').addEventListener('click', () => audio.toggle());
  $('prev').addEventListener('click', () => selectBike(bikeIndex - 1));
  $('next').addEventListener('click', () => selectBike(bikeIndex + 1));

  /* ---------- audio: all synthesized ---------- */
  const audio = (() => {
    let ac = null, out, osc, osc2, gain, filter, roarGain, noiseBuf;
    let rainGain, rushGain, rushFilter, sirenOsc, sirenGain, rotorGain, scrapeGain;
    let muted = store.get('muted', false);
    const label = () => { $('snd-on').style.display = muted ? 'none' : ''; $('snd-off').style.display = muted ? '' : 'none'; };
    label();
    const noise = () => { const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true; return n; };
    // A filtered noise hit with an exponential tail.
    function hit(type, freq, vol, dur, q, delay) {
      if (!ac || muted) return;
      const t = ac.currentTime + (delay || 0);
      const n = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
      f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(f); f.connect(g); g.connect(out);
      n.start(t, Math.random() * 1.5); n.stop(t + dur + 0.05);
    }
    // A pitched blip that slides from f0 to f1.
    function tone(wave, f0, f1, vol, dur, delay) {
      if (!ac || muted) return;
      const t = ac.currentTime + (delay || 0);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = wave;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + dur + 0.05);
    }
    return {
      unlock() {
        if (ac || muted) { if (ac && ac.state === 'suspended') ac.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC();
        out = ac.createGain(); out.gain.value = 1; out.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        // motor whine
        gain = ac.createGain(); gain.gain.value = 0;
        filter = ac.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1800;
        osc = ac.createOscillator(); osc.type = 'sawtooth';
        osc2 = ac.createOscillator(); osc2.type = 'sine';
        const g2 = ac.createGain(); g2.gain.value = 0.6;
        osc.connect(filter); osc2.connect(g2); g2.connect(filter);
        filter.connect(gain); gain.connect(out);
        // tyre roar
        const roar = noise(), rf = ac.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 500;
        roarGain = ac.createGain(); roarGain.gain.value = 0;
        roar.connect(rf); rf.connect(roarGain); roarGain.connect(out);
        // rain hiss
        const rain = noise(), hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2200;
        rainGain = ac.createGain(); rainGain.gain.value = 0;
        rain.connect(hp); hp.connect(rainGain); rainGain.connect(out);
        // air rushing past the helmet, rising with speed
        const rush = noise();
        rushFilter = ac.createBiquadFilter(); rushFilter.type = 'bandpass'; rushFilter.frequency.value = 300; rushFilter.Q.value = 1.2;
        rushGain = ac.createGain(); rushGain.gain.value = 0;
        rush.connect(rushFilter); rushFilter.connect(rushGain); rushGain.connect(out);
        // siren
        sirenOsc = ac.createOscillator(); sirenOsc.type = 'square';
        const sf = ac.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 1600;
        sirenGain = ac.createGain(); sirenGain.gain.value = 0;
        sirenOsc.connect(sf); sf.connect(sirenGain); sirenGain.connect(out);
        osc.start(); osc2.start(); roar.start(); rain.start(); rush.start(); sirenOsc.start();
        const scrape = noise(), sf2 = ac.createBiquadFilter(); sf2.type = 'bandpass'; sf2.frequency.value = 2600; sf2.Q.value = 1.4;
        scrapeGain = ac.createGain(); scrapeGain.gain.value = 0;
        scrape.connect(sf2); sf2.connect(scrapeGain); scrapeGain.connect(out);
        scrape.start();
        const rotor = noise(), rf2 = ac.createBiquadFilter(); rf2.type = 'lowpass'; rf2.frequency.value = 160;
        const chop = ac.createGain(); chop.gain.value = 0.5;
        const lfo = ac.createOscillator(); lfo.frequency.value = 11; lfo.type = 'square';
        const depth = ac.createGain(); depth.gain.value = 0.5;
        lfo.connect(depth); depth.connect(chop.gain);
        rotorGain = ac.createGain(); rotorGain.gain.value = 0;
        rotor.connect(rf2); rf2.connect(chop); chop.connect(rotorGain); rotorGain.connect(out);
        rotor.start(); lfo.start();
      },
      update(s, h, a, now) {
        if (!ac) return;
        const t = ac.currentTime;
        const riding = mode === 'play' && !muted;
        const amb = muted ? 0 : mode === 'menu' ? 0.35 : 1;
        const vr = s.v / h.vmax;
        osc.frequency.setTargetAtTime(90 + vr * 700, t, 0.05);
        osc2.frequency.setTargetAtTime(180 + vr * 1400, t, 0.05);
        gain.gain.setTargetAtTime(riding ? 0.015 + 0.05 * s.throttle : 0, t, 0.05);
        roarGain.gain.setTargetAtTime(riding && !s.airborne ? Math.min(0.06, vr * 0.08) * (s.inPuddle ? 2 : 1) : 0, t, 0.1);
        rainGain.gain.setTargetAtTime(amb * a.rain * 0.05, t, 0.3);
        const air = riding ? clamp((s.v - 6) / 30, 0, 1) : 0;
        rushGain.gain.setTargetAtTime(air * air * 0.11, t, 0.15);
        rushFilter.frequency.setTargetAtTime(250 + air * 900, t, 0.15);
        // the glove scraping the ground in a hand drag
        scrapeGain.gain.setTargetAtTime(riding && s.handDown ? 0.05 + Math.min(0.06, s.v * 0.003) : 0, t, 0.04);
        // siren: a slow wail far off, a fast yelp up close
        const p = s.police;
        let sv = 0;
        if (p && p.active && !muted && mode !== 'menu') {
          const near = clamp(1 - p.gap / 110, 0, 1);
          sv = 0.006 + 0.04 * near * near;
          const yelp = p.gap < 20 || s.status === 'busted';
          const ph = yelp ? Math.abs(((now * 3.2) % 2) - 1) : 0.5 + 0.5 * Math.sin(now * 2 * Math.PI / 2.4);
          sirenOsc.frequency.setTargetAtTime(700 + 520 * ph, t, 0.02);
          if (mode === 'results') sv *= 0.5;
        }
        sirenGain.gain.setTargetAtTime(sv, t, 0.15);
        // helicopter rotor: low noise chopped at the blade rate
        const hv = heli && heli.on && !muted && mode !== 'menu' ? 0.09 : 0;
        rotorGain.gain.setTargetAtTime(hv, t, 0.4);
      },
      thud(k) { hit('lowpass', 220, clamp(0.12 + k * 0.06, 0, 0.4), 0.22); tone('sine', 120, 45, clamp(0.1 + k * 0.05, 0, 0.3), 0.2); },
      clunk(k) { tone('square', 70, 40, clamp(0.04 + k * 0.02, 0, 0.1), 0.09); hit('bandpass', 900, 0.05, 0.06, 2); },
      knock() { tone('triangle', 520, 300, 0.07, 0.12); hit('bandpass', 1600, 0.05, 0.05, 3); },
      tyre() { tone('sine', 160, 70, 0.14, 0.25); hit('lowpass', 400, 0.12, 0.2); },
      pop(k) { hit('bandpass', 300 + 200 * k, 0.05 + 0.04 * k, 0.12, 1.5); },
      click() { hit('highpass', 3500, 0.06, 0.025); hit('highpass', 3000, 0.04, 0.02, 0.7, 0.06); },
      splash() { hit('bandpass', 1200, 0.08, 0.25, 0.8); },
      clear(big) { tone('triangle', big ? 880 : 660, big ? 1320 : 990, 0.06, 0.18); },
      thunder(k) {
        hit('lowpass', 140, 0.35 * k, 2.8, 0.9);
        hit('lowpass', 90, 0.3 * k, 3.4, 0.9, 0.25);
        hit('bandpass', 400, 0.08 * k, 0.6, 0.6);
      },
      // the E-Clutch biting: a thunk and a rising whine
      clutch(k) { hit('lowpass', 180, 0.12 * k + 0.04, 0.18); tone('sawtooth', 300, 900, 0.03 * k + 0.01, 0.35); },
      // hazard warnings: rising two-tone to pop, falling to tuck
      warn(act) {
        const [a1, a2] = act === 'up' ? [700, 1050] : [1050, 640];
        tone('triangle', a1, a1, 0.06, 0.1); tone('triangle', a2, a2, 0.06, 0.14, 0.11);
      },
      // the stinger warning: a two-tone radio chirp
      alert() { tone('square', 1400, 1400, 0.035, 0.09); tone('square', 1000, 1000, 0.035, 0.09, 0.11); },
      busted() { tone('square', 600, 1300, 0.05, 0.35); tone('square', 1300, 600, 0.05, 0.35, 0.36); },
      // short two-note chime for milestones
      chime(high) {
        if (!ac || muted) return;
        const t = ac.currentTime;
        [high ? 988 : 784, high ? 1319 : 1047].forEach((f, i) => {
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = 'triangle'; o.frequency.value = f;
          g.gain.setValueAtTime(0, t + i * 0.09);
          g.gain.linearRampToValueAtTime(0.07, t + i * 0.09 + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.35);
          o.connect(g); g.connect(out);
          o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.4);
        });
      },
      toggle() {
        muted = !muted;
        store.set('muted', muted);
        label();
        if (!muted) this.unlock();
        if (ac) out.gain.setTargetAtTime(muted ? 0 : 1, ac.currentTime, 0.05);
      },
    };
  })();

  /* ---------- scoring ---------- */
  // A point per metre on two wheels, two on the back wheel, four in the sweet
  // spot just under the balance point. Clearing obstacles with the front up
  // scores a bonus, and so does shaking off the police from close range.
  const CLEAR_POINTS = { log: 40, rock: 30, tyres: 100, stinger: 120, pipe: 70, gate: 70 };

  function popup(text, x, y, color, big) {
    run.popups.push({ text, x, y, color, big, age: 0, life: 1.1 });
  }

  function updateScore(dt) {
    for (const p of run.popups) p.age += dt;
    run.popups = run.popups.filter((p) => p.age < p.life);
    if (sim.status !== 'riding') { run.sweet = false; run.mult = 1; return; }
    const bal = Sim.balanceAngle(sim, handling);
    run.sweet = sim.inWheelie && sim.theta > bal - 7 * DEG && sim.theta < bal + 2 * DEG;
    run.mult = sim.inWheelie ? (run.sweet ? 4 : 2) : 1;
    // a trick in full flow multiplies on top (the hand drag only with the hand down)
    const tr = sim.trick;
    const trickOn = tr && (tr === 'drag' ? sim.handDown : sim.trickK > 0.85);
    if (trickOn) run.mult *= TRICKS[tr].mult;
    const dx = Math.max(0, sim.x - run.lastX);
    run.score += dx * run.mult * wantedMult;
    run.lastX = sim.x;
    // trick lengths, with a popup when one ends
    if (trickOn) { stats.tricks[tr] += dx; run.trickRun = (run.trickRun && run.trickRun.t === tr ? run.trickRun : { t: tr, d: 0 }); run.trickRun.d += dx; }
    else if (run.trickRun) {
      if (run.trickRun.d > 3) popup(`${TRICKS[run.trickRun.t].label} ${Math.round(run.trickRun.d)} m`, sim.x + 0.3, terrain.base(sim.x) + 2.2, 'rgba(127,240,255,A)', true);
      run.trickRun = null;
    }

    // close calls: let the police get right on your tail, then pull away
    const p = sim.police;
    if (p && p.active) {
      if (p.gap < 5) run.danger = true;
      else if (run.danger && p.gap > 22) {
        run.danger = false;
        run.score += 150 * wantedMult;
        stats.closeCalls++;
        popup(`Close call +${Math.round(150 * wantedMult)}`, sim.x + 0.4, terrain.base(sim.x) + 2.4, 'rgba(255,197,49,A)', true);
        audio.clear(true);
      }
    }
  }

  /* ---------- events from the simulation ---------- */
  function drainEvents() {
    for (const e of sim.events) {
      if (e.type === 'pop') {
        audio.pop(e.preload);
        for (let i = 0; i < 6; i++) dustAt(sim.x - 0.05, 0.6);
      } else if (e.type === 'clutch') {
        audio.clutch(e.rev);
        for (let i = 0; i < 14; i++) dustAt(sim.x - 0.05, 1.4);
        shake = Math.max(shake, 0.15 * e.rev);
      } else if (e.type === 'launch') {
        audio.clutch(0.6);
      } else if (e.type === 'bottom') {
        audio.clunk(e.strength);
        if (e.end === 'rear') for (let i = 0; i < 6; i++) dustAt(sim.x, 1);
      } else if (e.type === 'impact') {
        const o = e.obstacle;
        if (o.type === 'stinger') {
          shake = 0.6;
          audio.thud(2);
          sparks(o.x, terrain.surface(o.x) + 0.1, 10);
        } else if (sim.status === 'crashed' && o.tall) {
          shake = 0.7;
          scatter(o, e.v || sim.v);
          audio.tyre();
        } else {
          shake = Math.max(shake, Math.min(0.45, e.strength * 0.12));
          audio.thud(e.strength);
          if (o.type === 'rock') sparks(o.x - o.w * 0.3, terrain.surface(o.x) + o.h * 0.6, 6);
        }
        for (let i = 0; i < 8; i++) dustAt(o.x - o.w / 2, 1.2);
      } else if (e.type === 'cone') {
        knockCone(e.obstacle, e.v);
        if (mode === 'play') {
          run.score += 10 * wantedMult;
          popup(`+${Math.round(10 * wantedMult)}`, e.obstacle.x, terrain.surface(e.obstacle.x) + 0.7, 'rgba(255,150,90,A)');
        }
      } else if (e.type === 'clear') {
        const o = e.obstacle;
        if (mode === 'play') {
          const pts = (CLEAR_POINTS[o.type] || 20) * (sim.inWheelie || o.overhead ? 1 : 0.5) * wantedMult;
          run.score += pts;
          stats.clears++;
          popup(`+${Math.round(pts)}`, o.x, terrain.surface(o.x) + o.h + 0.6, o.tall ? 'rgba(255,197,49,A)' : 'rgba(240,235,225,A)', o.tall);
          audio.clear(o.tall);
        }
      } else if (e.type === 'stinger') {
        if (mode === 'play') { hint('Stinger ahead · front wheel up!', 1.6, true); audio.alert(); }
      } else if (e.type === 'touchdown') {
        const fx0 = sim.x + handling.wheelbase;
        for (let i = 0; i < 10; i++) dustAt(fx0, 1.2);
        if (mode === 'play' && e.dist > 15) popup(`${Math.round(e.dist)} m wheelie`, fx0, terrain.base(fx0) + 1.6, 'rgba(240,235,225,A)');
      }
    }
    sim.events.length = 0;
  }

  // The police car shunts cones and tyre stacks out of its way.
  function policeShunt() {
    const p = sim.police;
    if (!p || !p.active) return;
    const nose = p.x + Sim.COP.length;
    for (const o of terrain.obstaclesNear(nose - 0.6, nose + 0.3)) {
      if (gone.has(o) || (o.type !== 'cones' && o.type !== 'tyres')) continue;
      if (o.type === 'cones') knockCone(o, p.v);
      else { scatter(o, p.v); audio.tyre(); }
    }
  }

  function knockCone(o, v) {
    if (gone.has(o)) return;
    gone.add(o);
    debris.push({ kind: 'cone', h: o.h, x: o.x, y: terrain.surface(o.x), vx: v * 0.75 + 1, vy: 2 + v * 0.12 + Math.random() * 1.5, rot: 0, vrot: -(4 + Math.random() * 8), age: 0 });
    audio.knock();
  }

  function scatter(o, v) {
    if (gone.has(o)) return;
    gone.add(o);
    const y0 = terrain.surface(o.x);
    for (let k = 0; k < 3; k++) {
      debris.push({ kind: 'tyre', x: o.x + (Math.random() - 0.5) * 0.2, y: y0 + o.h * (k + 0.5) / 3, vx: v * (0.35 + 0.15 * k) + Math.random(), vy: 1.5 + k * 1.2 + Math.random() * 1.5, rot: Math.random(), vrot: -(3 + Math.random() * 6), age: 0, r: o.w / 2 * 0.9 });
    }
  }

  function updateDebris(dt) {
    for (const d of debris) {
      d.age += dt;
      d.vy -= 9.81 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += d.vrot * dt;
      const floor = terrain.surface(d.x) + (d.kind === 'tyre' ? d.r : 0.05);
      if (d.y < floor) {
        d.y = floor;
        if (d.vy < -1.5) d.vy = -d.vy * 0.35; else d.vy = 0;
        d.vx *= 0.75;
        d.vrot *= 0.7;
      }
    }
    debris = debris.filter((d) => d.age < 8);
  }

  /* ---------- dust, spray and sparks ---------- */
  function dustAt(x, k) {
    particles.push({
      x: x + (Math.random() - 0.5) * 0.3, y: terrain.height(x) + 0.05,
      vx: (Math.random() - 0.6) * 2.5 * k, vy: 0.4 + Math.random() * 1.6 * k,
      r: 0.05 + Math.random() * 0.08, age: 0, life: 0.6 + Math.random() * 0.7, a: 0.5 * (1 - atmo.wet * 0.7), c: '186,140,96',
    });
  }

  function sparks(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI, sp = 1.5 + Math.random() * 3;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 0.015 + Math.random() * 0.015, age: 0, life: 0.25 + Math.random() * 0.2, a: 1, c: '255,214,140', spark: true });
    }
  }

  function emitDust(dt) {
    if (sim.status === 'busted') return;
    const groundY = terrain.height(sim.x);
    const onGround = !sim.airborne && sim.status === 'riding';
    // water: rooster tail through puddles, spray off a wet track
    if (sim.v > 3 && onGround && (sim.inPuddle || atmo.wet > 0.3)) {
      const n = sim.inPuddle ? 5 : Math.random() < atmo.wet * 0.6 ? 1 : 0;
      for (let i = 0; i < n; i++) particles.push({
        x: sim.x - 0.15, y: groundY + 0.06, vx: -(0.5 + Math.random() * 2.5) + sim.v * 0.1, vy: 1 + Math.random() * (sim.inPuddle ? 3.5 : 1.5),
        r: 0.015 + Math.random() * 0.025, age: 0, life: 0.5, a: 0.8, c: atmo.light > 0.5 ? '200,215,230' : '120,135,150', spark: true,
      });
      if (sim.inPuddle && Math.random() < 0.05) audio.splash();
    }
    if (sim.inMud && sim.v > 2 && onGround) {
      for (let i = 0; i < 2; i++) particles.push({
        x: sim.x - 0.05, y: groundY + 0.05, vx: -(1 + Math.random() * 2), vy: 1 + Math.random() * 2.2,
        r: 0.03 + Math.random() * 0.04, age: 0, life: 0.6, a: 0.85, c: '74,46,28', spark: true,
      });
    }
    const dry = 1 - atmo.wet * 0.85;
    const slip = sim.status === 'crashed' ? 1 : Math.max(sim.spin, sim.throttle * Math.max(0, 1 - sim.v / handling.vmax));
    const rate = ((onGround && sim.v > 0.5 ? 25 : 0) * slip + (sim.status === 'crashed' && sim.v > 1 ? 40 : 0) + (sim.braking && sim.v > 2 && onGround ? 30 : 0)) * dry;
    let n = rate * dt;
    while (n > 0) {
      if (Math.random() < n) {
        particles.push({
          x: sim.x - 0.1 + Math.random() * 0.1,
          y: groundY + 0.04,
          vx: -(1 + Math.random() * 2.5) * (0.4 + slip),
          vy: 0.5 + Math.random() * 1.6,
          r: 0.05 + Math.random() * 0.07,
          age: 0, life: 0.7 + Math.random() * 0.9,
          a: 0.55, c: Math.random() < 0.5 ? '196,150,105' : '170,120,80',
        });
      }
      n -= 1;
    }
  }

  function burst(x, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 0.8, y: terrain.height(x) + 0.1,
        vx: (Math.random() - 0.3) * 4, vy: 0.6 + Math.random() * 2.4,
        r: 0.07 + Math.random() * 0.12, age: 0, life: 1 + Math.random(), a: 0.6 * (1 - atmo.wet * 0.6), c: '186,140,96',
      });
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.age += dt;
      p.vy -= (p.spark ? 9 : 1.2) * dt;
      p.vx -= p.vx * (p.spark ? 0 : 1.5 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    particles = particles.filter((p) => p.age < p.life);
    if (particles.length > 500) particles.splice(0, particles.length - 500);
  }

  /* ---------- the bike's pose in the world ---------- */
  // The bike pitches about its rear axle; it goes over the bars about the
  // front one. Returns the pivot in the bike's own frame (metres from the
  // rear contact patch) and in the world, plus the frame's angle.
  function bikePose() {
    const Rw = handling.wheelRadius;
    const slope = Math.atan(terrain.slope(sim.x));
    if (sim.status === 'crashed' && crashPose) {
      const k = Math.min(1, sim.crashT * 1.6);
      const end = Math.PI - 0.15;
      const ang = crashPose.ang + k * ((crashPose.forward ? -end : end) - crashPose.ang);
      const dx = sim.x - crashPose.x;
      const p = { ang, pivot: crashPose.pivot, wx: crashPose.wx + dx, wy: terrain.base(crashPose.wx + dx) + crashPose.h, frontOff: 0, rearOff: 0 };
      // keep the tumbling bike on top of the dirt: lift it by however far
      // its lowest point (tyres, tail, seat, bars) has sunk in
      const WB = handling.wheelbase;
      let sink = 0;
      for (const [lx, ly, r] of [[0, Rw, Rw], [WB, Rw, Rw], [-0.35, 0.85, 0], [0.4, 0.95, 0], [WB - 0.25, 1.05, 0]]) {
        const [wx, wy] = poseToWorld(p, lx, ly);
        sink = Math.max(sink, terrain.base(wx) - (wy - r));
      }
      p.wy += sink;
      return p;
    }
    const off = Sim.wheelOffsets(sim, handling);
    const ang = slope + sim.theta;
    return { ang, pivot: [0, Rw], wx: sim.x, wy: Sim.chassisY(sim, terrain) + Rw, frontOff: off.front, rearOff: off.rear };
  }

  function poseToWorld(p, lx, ly) {
    const dx = lx - p.pivot[0], dy = ly - p.pivot[1];
    const c = Math.cos(p.ang), s = Math.sin(p.ang);
    return [p.wx + dx * c - dy * s, p.wy + dx * s + dy * c];
  }

  /* ---------- crash tumble ---------- */
  function onCrash(vBefore) {
    const before = bikePose();
    const forward = sim.cause !== 'Looped out';
    const WB = handling.wheelbase, Rw = handling.wheelRadius;
    const pivot = forward ? [WB, Rw] : [0, Rw];
    const pw = poseToWorld(before, pivot[0], pivot[1]);
    crashPose = { forward, ang: before.ang, pivot, wx: pw[0], x: sim.x, h: pw[1] - terrain.base(pw[0]) };
    const hip = Art.info(bike.id).hip;
    const hw = poseToWorld(before, hip[0], hip[1]);
    const v = vBefore;
    const overhead = sim.cause === 'Hit the pipe' || sim.cause === 'Hit the barrier' || sim.cause === 'Fell off the seat';
    rider = sim.cause === 'Arm buckled'
      // the arm folds and the rider goes down on their back behind the bike
      ? { x: hw[0], y: hw[1], vx: v * 0.4, vy: 0.5, rot: before.ang, vrot: 2.5 }
      : overhead
      // swept off backwards by the bar, while the bike runs on and goes down
      ? { x: hw[0], y: hw[1] + 0.2, vx: v * 0.15, vy: 1.5, rot: before.ang, vrot: 5 + v * 0.1 }
      : forward
        ? { x: hw[0], y: hw[1], vx: v * 0.75 + 1, vy: 2.5 + v * 0.08, rot: before.ang, vrot: -(4 + v * 0.15) }
        : { x: hw[0], y: hw[1], vx: v * 0.5, vy: 2.5, rot: before.ang, vrot: 3 + v * 0.1 };
    burst(sim.x, 30);
    shake = Math.max(shake, 0.5);
  }

  function updateRider(dt) {
    if (!rider) return;
    rider.vy -= 9.81 * dt;
    rider.x += rider.vx * dt;
    rider.y += rider.vy * dt;
    rider.rot += rider.vrot * dt;
    const gy = terrain.height(rider.x) + 0.25;
    if (rider.y < gy) {
      if (rider.vy < -2) burst(rider.x, 8);
      rider.y = gy;
      rider.vy = Math.abs(rider.vy) * 0.35;
      rider.vx *= 0.7;
      rider.vrot *= 0.6;
    }
  }

  /* ---------- the menu's demo rider ---------- */
  // Cruises, pops wheelies (and pops over anything in the way), sets the
  // front down now and then.
  function demoInput(dt) {
    const s = sim, h = handling;
    demo.t -= dt;
    if (demo.t <= 0) { demo.up = !demo.up; demo.t = demo.up ? 7 + Math.random() * 6 : 1.5 + Math.random(); }
    const near = terrain.obstaclesNear(s.x - 1, s.x + h.wheelbase + 1 + Math.max(6, s.v * 1.4));
    // a pipe or gate coming: front down and tuck under it
    if (near.some((o) => o.overhead)) return { throttle: s.theta < 6 * DEG, brake: s.theta > 10 * DEG, lean: -1 };
    const ahead = terrain.obstaclesNear(s.x + h.wheelbase + 1, s.x + h.wheelbase + 1 + Math.max(4, s.v * 0.5)).some((o) => !o.soft && !o.overhead);
    if (s.frontDown || s.theta < 4 * DEG) {
      const want = (demo.up || ahead) && s.v > 6;
      demo.pulse = ((demo.pulse || 0) + dt) % 0.7;
      return { throttle: true, lean: want ? (demo.pulse < 0.25 ? 1 : -0.5) : 0 };
    }
    const bal = Sim.balanceAngle(s, h);
    const target = demo.up || ahead ? bal - 12 * DEG : 0;
    const err = target - s.theta - 0.3 * s.omega;
    // show off an arm swing in a settled wheelie
    const swing = demo.up && s.wheelieTime > 2 && (s.wheelieTime % 7) < 3.5;
    return { throttle: err > 0, brake: err < -6 * DEG, lean: 1, trick: swing ? 'swing' : null };
  }

  /* ---------- main loop ---------- */
  let last = performance.now();
  let resultsDelay = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;

    let input;
    if (mode === 'play') {
      input = { throttle: keys.throttle, brake: keys.brake, lean: (keys.leanBack ? 1 : 0) - (keys.leanFwd ? 1 : 0), mode: modeIdx, clutch: keys.clutch, assistOff, trick: trickHeld[trickHeld.length - 1] || null };
    } else if (mode === 'menu') {
      if (sim.status !== 'riding' && sim.crashT > 1.5) newRun(false);
      input = demoInput(dt);
    } else {
      input = {};
    }

    const was = sim.status;
    const vBefore = sim.v;
    Sim.step(sim, input, handling, terrain, dt);
    const tod = (timeOf.start + timeOf.rate * sim.time) % 24;
    atmo = Atmo.compute(tod, terrain.env, sim.time);
    drainEvents();
    policeShunt();
    if (sim.status === 'riding') stats.topSpeed = Math.max(stats.topSpeed, sim.v);
    if (was === 'riding' && sim.status !== 'riding') {
      stats.endT = sim.time;
      if (sim.status === 'crashed') onCrash(vBefore);
      if (sim.status === 'busted') { audio.busted(); shake = 0.3; }
      if (mode === 'play') resultsDelay = sim.status === 'busted' ? 1.8 : 1.6;
    }
    if (mode === 'play' && sim.status !== 'riding') {
      resultsDelay -= dt;
      if (resultsDelay <= 0) finishRun();
    }
    if (mode === 'play') updateScore(dt);
    emitDust(dt);
    updateParticles(dt);
    updateDebris(dt);
    updateRider(dt);

    // headlight: clicks on (with a flicker) as the light fades
    if (atmo.headlights && !hlOn && build.light) { hlOn = true; hlT = 0; if (mode === 'play' && sim.time > 0.5) audio.click(); }
    if (atmo.headlights && !build.light && mode === 'play' && !run.tips.has('nolight') && atmo.light < 0.45) { run.tips.add('nolight'); hint('No lights on this bike · fit some in the workshop', 2.2); }
    if (!atmo.headlights && atmo.light > 0.7) hlOn = false;
    hlT += dt;
    if (hlOn) hl = hlT < 0.4 ? (Math.sin(hlT * 70) > 0.2 ? 1 : 0.15) : 1;
    else hl = Math.max(0, hl - dt * 3);

    audio.update(sim, handling, atmo, clock);
    shake = Math.max(0, shake - dt);
    if (hintTimer > 0) hintTimer -= dt;
    if (mode === 'play') tips();
    if (mode === 'play' && sim.status === 'riding') warnBeeps();

    draw(dt);
    drawStage(dt);
    requestAnimationFrame(frame);
  }

  function tips() {
    if (sim.status !== 'riding') return;
    const once = (id, text, sec, warn) => {
      if (run.tips.has(id)) return;
      run.tips.add(id);
      hint(text, sec, warn);
    };
    const bal = Sim.balanceAngle(sim, handling);
    const p = sim.police;
    const nose = sim.x + handling.wheelbase;
    const next = terrain.obstaclesNear(nose + 3, nose + 3 + Math.max(10, sim.v * 1.2)).find((o) => !o.soft && !gone.has(o));
    if (sim.handDown && sim.handLoad > Sim.TUNE.dragLoad * 0.75) hint('Easy on the gas · your arm is buckling', 0.3, true);
    else if (sim.inWheelie && sim.theta > bal + 2 * DEG && sim.trick !== 'drag') hint(sim.trick === 'swing' ? 'Past the balance point · no brake while you swing' : 'Past the balance point · brake', 0.3, true);
    else if (sim.trick === 'drag' && sim.trickK > 0.9 && !sim.handSkim && sim.theta < bal - 8 * DEG) once('dragup', 'Hand drag: get the bike up near vertical on the gas', 2);
    else if (p && p.active && p.gap < 12) hint('They\'re on you · hold → to tuck and pull away', 0.3, true);
    else if (next && next.overhead && runsThisSession <= 3) once('low' + next.x, `${next.type === 'gate' ? 'Barrier' : 'Low pipe'} · front down and hold → to tuck under it`, 1.6, true);
    else if (next && next.tall && sim.frontDown && runsThisSession <= 3) once('tyres' + next.x, 'Tyre stack · pop the front over it', 1.2, true);
    else if (next && sim.frontDown && runsThisSession <= 1) once('obstacle', 'Snap ← on the gas to pop over it', 1.6);
    else if (p && p.active && sim.time < 7) once('police', 'Police! Tuck (hold →) on two wheels to outrun them', 2.2, true);
    else if (sim.inWheelie && sim.wheelieDist > 20 && runsThisSession <= 2) once('sweet', 'Sit just under the balance point for ×4', 1.8);

    // milestones and the best score
    const m = Math.floor(sim.distance / 250);
    const bsc = bestScore(bike.id);
    if (!run.passedBest && bsc > 50 && run.score > bsc) {
      run.passedBest = true;
      toast('New best', true);
      audio.chime(true);
    } else if (m > run.milestone) {
      run.milestone = m;
      toast(`${m * 250} m`);
      audio.chime(false);
    }
  }

  function weatherLabel() {
    const w = { clear: 'Clear', rain: 'Rain', storm: 'Storm' }[weatherKind];
    return `${onAirfield() ? 'Airfield · ' : ''}${timeOf.label} · ${w}`;
  }

  function draw(dt) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // pull the camera back as speed builds so the hills ahead stay in view
    // ... and further when the police close in, so you can see them coming
    const p = sim.police;
    const chase = p && p.active && sim.status !== 'crashed' ? clamp((28 - p.gap) / 22, 0, 1) : 0;
    // Speed: only a slight pull-back (zooming out makes speed read slower),
    // and the bike drifts back on screen so more of the track ahead shows.
    const fast = sim.status === 'riding' ? clamp((sim.v - 8) / 24, 0, 1) : 0;
    zoom += ((1 - 0.1 * fast) * (1 - 0.25 * chase) - zoom) * 0.03;
    const scale = Math.min(H / 6.2, W / 5.4) * zoom;
    // slide the bike forward on screen when the police are close, so the car shows
    const leadWant = (W < 600 ? 0.2 : 0.32) - 0.07 * fast * (1 - chase) + 0.28 * chase;
    camLead += (leadWant - camLead) * Math.min(1, dt * 2);
    if (rider) camFocus += ((sim.x + rider.x) / 2 + 1 - camFocus) * 0.08;
    else camFocus = sim.x;
    // impacts shake the camera; at speed the ground buzzes through it
    const buzz = fast * fast * (sim.airborne ? 0.3 : 1);
    const sx = (shake > 0 ? (Math.random() - 0.5) * shake * 14 : 0) + (Math.random() - 0.5) * buzz * 1.6;
    const sy = (shake > 0 ? (Math.random() - 0.5) * shake * 10 : 0) + (Math.random() - 0.5) * buzz * 2.4;
    const camX = camFocus - (W * camLead) / scale;
    camY += (terrain.base(camFocus) - camY) * 0.12;
    const groundLine = H * 0.7;
    const toScreenY = (y) => groundLine - (y - camY) * scale + sy;
    const view = { w: W, h: H, scale, camX: camX - sx / scale, toScreenY, speed: sim.v };
    const toScreen = (x, y) => [(x - view.camX) * scale, toScreenY(y)];
    const a = atmo;
    const horizon = groundLine - scale * 0.4;

    R.drawSky(ctx, W, H, camX, horizon, a, clock, terrain.theme);
    // the cruisers that laid the stingers, parked beyond the tape
    for (const st of sim.stingers) R.drawPolice(ctx, view, terrain, { x: st.x + 2.5, active: true }, clock + st.x, { parked: { s: 0.62, lift: 0.75, alpha: 0.9 } });
    R.drawSupports(ctx, view, terrain, gone);
    R.drawTrackside(ctx, view, terrain);
    R.drawGround(ctx, view, terrain, a);
    R.drawFeatures(ctx, view, terrain, a, clock);
    if (mode === 'play') R.drawWarnings(ctx, view, terrain, gone, sim.stingers, sim.v);
    R.drawObstacles(ctx, view, terrain, gone, a);
    for (const st of sim.stingers) R.drawStinger(ctx, view, terrain, st, sim.time);

    if (mode !== 'menu') {
      const bd = bestDist(bike.id);
      if (bd > 20) R.drawFlag(ctx, view, terrain, bd, `Best ${fmt(bd)} m`, '#ffc531');
    }

    // the police car
    let pol = null;
    if (p) pol = R.drawPolice(ctx, view, terrain, p, clock, { interceptor: p.cfg.interceptor });

    // bike
    const pose = bikePose();
    if (sim.status !== 'crashed') R.drawShadow(ctx, view, terrain, sim.x, bike.look.wheelbase, sim.theta);
    R.drawParticles(ctx, view, particles.filter((q) => q.r >= 0.05 && !q.spark && q.y < terrain.height(q.x) + 0.6));
    const [px, py] = toScreen(pose.wx, pose.wy);
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(scale, -scale);
    ctx.rotate(pose.ang);
    ctx.translate(-pose.pivot[0], -pose.pivot[1]);
    Art.drawBike(ctx, bike.id, {
      style: build.style, lit: hl > 0.5, tuck: sim.tuck,
      trick: sim.trick && sim.status === 'riding' ? { type: sim.trick, k: sim.trickK, phase: sim.trickPhase, handDown: sim.handDown, lean: sim.lean } : null,
      groundAt: (lx, ly) => { const w = poseToWorld(pose, lx, ly); return w[1] - terrain.surface(w[0]); },
      lean: sim.lean, spin: sim.x / bike.look.wheelRadius, blur: Math.min(1, sim.v / 14),
      rider: !rider, pitch: pose.ang, frontOff: pose.frontOff, rearOff: pose.rearOff,
    });
    ctx.restore();

    // the dragging glove: sparks off its slider puck, and dust
    if (sim.handDown && sim.status === 'riding') {
      const hnd = Art.info(bike.id).hand;
      if (hnd) {
        const [wx] = poseToWorld(pose, hnd[0], hnd[1]);
        const gy = terrain.surface(wx);
        if (Math.random() < 0.8) sparks(wx, gy + 0.03, 2);
        if (Math.random() < 0.4) dustAt(wx, 0.6);
      }
    }
    if (rider) {
      ctx.save();
      ctx.translate((rider.x - view.camX) * scale, toScreenY(rider.y));
      ctx.scale(scale, -scale);
      ctx.rotate(rider.rot);
      Art.drawLooseRider(ctx, bike.id);
      ctx.restore();
    }
    drawDebrisPieces(view);
    R.drawOverhead(ctx, view, terrain, gone, clock);
    R.drawParticles(ctx, view, particles.filter((q) => !(q.r >= 0.05 && !q.spark && q.y < terrain.height(q.x) + 0.6)));
    if (run && mode !== 'menu') R.drawPopups(ctx, view, run.popups);

    // the helicopter: arrives with the chase and hangs just ahead of you
    let heliLamp = null;
    if (heli) {
      if (p && p.active) heli.on = true;
      const tx = sim.x + 3 + 2.5 * Math.sin(clock * 0.23), ty = terrain.base(tx) + 3.9 + 0.3 * Math.sin(clock * 0.7);
      if (!heli.on) { heli.x = sim.x - 45; heli.y = ty + 3; }
      const chaseV = (sim.status === 'riding' ? sim.v : 0) + clamp((tx - heli.x) * 0.9, -12, 25);
      heli.vx += (chaseV - heli.vx) * Math.min(1, dt * 1.5);
      heli.x += heli.vx * dt;
      heli.y += (ty - heli.y) * Math.min(1, dt * 0.8);
      const tilt = clamp((heli.vx - sim.v) * 0.02, -0.15, 0.28);
      heliLamp = R.drawHeli(ctx, view, heli.x, heli.y, tilt, clock);
      // downwash kicks up dust under it
      if (heli.on && Math.random() < dt * 20) dustAt(heli.x + (Math.random() - 0.5) * 4, 1.4);
    }

    // lighting: darkness with the lamps cut out of it
    const lights = [];
    if (heliLamp) {
      const [bx, by] = toScreen(pose.wx, pose.wy + 0.6);
      const dist = Math.hypot(bx - heliLamp[0], by - heliLamp[1]);
      lights.push({ kind: 'cone', x: heliLamp[0], y: heliLamp[1], angle: Math.atan2(by - heliLamp[1], bx - heliLamp[0]), spread: 0.12, len: dist * 1.3, power: 0.9, color: '225,235,255' });
    }
    if (hl > 0.01) {
      const L = Art.info(bike.id).light;
      const [lx, ly] = poseToWorld(pose, L[0], L[1]);
      const [hx, hy] = toScreen(lx, ly);
      const B = build.light;
      lights.push({ kind: 'cone', x: hx, y: hy, angle: -pose.ang + 0.1, spread: B.spread, len: B.len * scale, power: B.power * hl });
      // a flood beam spills low enough to light the ground with the front up
      if (B.ground) lights.push({ kind: 'cone', x: hx, y: hy, angle: Math.max(-pose.ang + 0.45, 0.25), spread: 0.4, len: B.len * 0.55 * scale, power: 0.7 * hl });
    }
    const polOff = p && p.active && (p.x + Sim.COP.length - view.camX) * scale < 0;
    const near = p ? clamp(1 - p.gap / 70, 0, 1) : 0;
    const red = Math.floor(clock * 8) % 4 < 2;
    if (polOff && near > 0) {
      // the light bar, just off screen, washing in from the left
      lights.push({ kind: 'point', x: -20, y: groundLine - scale * 1.3, r: 5 * scale * near, power: near, color: red ? '255,40,40' : '50,110,255', glow: 0.5 });
    }
    if (pol) {
      lights.push({ kind: 'cone', x: pol.head[0], y: pol.head[1], angle: pol.angle + 0.08, spread: 0.28, len: 10 * scale, power: 0.85 });
      lights.push({ kind: 'point', x: pol.bar[0], y: pol.bar[1], r: 3.2 * scale, power: p.active ? 0.95 : 0, color: pol.red ? '255,40,40' : '50,110,255', glow: 0.55 });
    }
    Atmo.drawLighting(ctx, a, lights, W, H, DPR, horizon, fx.flash);
    R.drawReflectors(ctx, view, terrain, gone, sim.stingers, a, clock);
    R.drawRunwayLights(ctx, view, terrain, a);
    if (heliLamp && a.light > 0.5) {
      // by day the searchlight is just a faint shaft
      const L = lights[0];
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,255,240,0.06)';
      ctx.beginPath();
      ctx.moveTo(L.x, L.y);
      ctx.arc(L.x, L.y, L.len, L.angle - L.spread * 0.7, L.angle + L.spread * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // weather in front of everything
    const groundAt = (xs) => toScreenY(terrain.surface(view.camX + xs / scale));
    Atmo.updateFx(fx, a, dt, W, H, scale, sim.v, weatherKind, groundAt);
    for (let i = fx.thunder.length - 1; i >= 0; i--) {
      if (fx.thunder[i] <= 0) {
        fx.thunder.splice(i, 1);
        audio.thunder(0.7 + Math.random() * 0.3);
        shake = Math.max(shake, 0.12);
      }
    }
    Atmo.drawRain(ctx, fx, a, W, H, scale, sim.v);
    Atmo.drawLightning(ctx, fx, W, H);

    // police lights washing in from off screen
    if (polOff && near > 0 && sim.status === 'riding') {
      const g = ctx.createLinearGradient(0, 0, W * 0.18, 0);
      g.addColorStop(0, red ? `rgba(255,40,40,${(0.4 * near).toFixed(3)})` : `rgba(50,110,255,${(0.45 * near).toFixed(3)})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W * 0.18, H);
    }
    drawForeground(view, groundLine, fast);
    drawSpeedLines(dt, fast);
    R.drawVignette(ctx, W, H, fast);
    if (mode === 'play' && sim.status === 'riding') { drawIncoming(view); drawPrompt(); }

    if (mode === 'play' || mode === 'results') drawHud(view);
  }

  // Near-camera tufts and stones along the bottom of the screen, moving
  // faster than the track (they're closer) and smeared at speed.
  function drawForeground(view, groundLine, fast) {
    const { scale, camX } = view;
    const k = 1.7; // parallax: nearer than the track
    const u0 = camX * k, unit = 1.4;
    const smear = Math.min(scale * 1.6, view.speed * scale * 0.035);
    const baseY = H - Math.max(8, (H - groundLine) * 0.08);
    ctx.save();
    for (let i = Math.floor(u0 / unit) - 2; i * unit < u0 + W / scale + unit * 2; i++) {
      const r = fgHash(i);
      if (r > 0.5) continue;
      const sx = (i * unit + fgHash(i + 0.31) * unit - u0) * scale;
      if (sx < -smear - 80 || sx > W + 80) continue;
      const hgt = scale * (0.3 + fgHash(i + 0.7) * 0.6);
      ctx.fillStyle = `rgba(28,16,12,${0.55 + 0.25 * fgHash(i + 0.9)})`;
      if (r < 0.14) {
        // a stone
        ctx.beginPath();
        ctx.ellipse(sx, baseY, hgt * 0.7 + smear * 0.5, hgt * 0.45, 0, Math.PI, 0);
        ctx.fill();
      } else {
        // a grass tuft, its blades raked back by the speed
        ctx.beginPath();
        for (let j = -3; j <= 3; j++) {
          const bx = sx + j * hgt * 0.12;
          ctx.moveTo(bx - hgt * 0.04, baseY);
          ctx.lineTo(bx + j * hgt * 0.08 + smear * 0.6, baseY - hgt * (0.7 + fgHash(i + j) * 0.5));
          ctx.lineTo(bx + hgt * 0.04, baseY);
        }
        ctx.fill();
      }
      if (smear > 4) {
        ctx.fillStyle = `rgba(28,16,12,${0.25 * fast})`;
        ctx.fillRect(sx - hgt * 0.5, baseY - hgt * 0.35, smear * 1.4, hgt * 0.3);
      }
    }
    ctx.fillStyle = 'rgba(28,16,12,0.55)';
    ctx.fillRect(0, baseY, W, H - baseY);
    ctx.restore();
  }
  function fgHash(n) {
    const x = Math.sin(n * 91.345 + 7.13) * 47453.5453;
    return x - Math.floor(x);
  }

  // Speed lines streaking past once you're really moving.
  const speedLines = [];
  function drawSpeedLines(dt, fast) {
    const want = Math.round(fast * fast * 26);
    while (speedLines.length < want) speedLines.push({ x: W + Math.random() * W * 0.5, y: Math.random(), len: 0.5 + Math.random(), v: 0.8 + Math.random() * 0.6 });
    if (speedLines.length > want) speedLines.length = want;
    if (!want) return;
    const pxs = sim.v * Math.min(H / 6.2, W / 5.4) * 1.8;
    ctx.save();
    ctx.lineCap = 'round';
    for (const l of speedLines) {
      l.x -= pxs * l.v * dt;
      // keep them out of the middle band, where the bike is
      const y = l.y < 0.5 ? H * (0.06 + l.y * 0.5) : H * (0.78 + (l.y - 0.5) * 0.4);
      const len = l.len * (60 + 160 * fast);
      if (l.x + len < 0) { l.x = W + Math.random() * W * 0.3; l.y = Math.random(); }
      const g = ctx.createLinearGradient(l.x, 0, l.x + len, 0);
      g.addColorStop(0, `rgba(255,248,235,${(0.28 * fast).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,248,235,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(l.x, y); ctx.lineTo(l.x + len, y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawDebrisPieces(view) {
    const { scale, camX, toScreenY } = view;
    for (const d of debris) {
      const sx = (d.x - camX) * scale, sy = toScreenY(d.y);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-d.rot);
      if (d.kind === 'cone') R.drawCone(ctx, scale, d.h);
      else {
        const r = d.r * scale;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = '#1d1e21'; ctx.fill();
        ctx.lineWidth = Math.max(1, r * 0.18); ctx.strokeStyle = '#34363b'; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = '#0c0d0f'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
        for (let k = 0; k < 8; k++) { const t = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(t) * r * 0.6, Math.sin(t) * r * 0.6); ctx.lineTo(Math.cos(t) * r * 0.95, Math.sin(t) * r * 0.95); ctx.stroke(); }
      }
      ctx.restore();
    }
  }

  // Hazards ahead of the front wheel (or still overhead), nearest first.
  function hazardsAhead(range) {
    const nose = sim.x + handling.wheelbase;
    const out = [];
    for (const o of terrain.obstaclesNear(sim.x - 1, nose + range)) {
      if (o.soft || gone.has(o) || sim.hit.has(o) || !R.HAZARD[o.type]) continue;
      if (!o.overhead && o.x < nose - 0.3) continue;
      out.push({ type: o.type, x: o.x, act: R.HAZARD[o.type].act, o });
    }
    for (const st of sim.stingers) if (!st.hit && st.x > nose - 0.3 && st.x < nose + range) out.push({ type: 'stinger', x: st.x, act: 'up', o: st });
    return out.sort((p, q) => p.x - q.x);
  }

  // Markers at the right edge for the next two hazards not yet on screen,
  // about three seconds out, saying what to do.
  function drawIncoming(view) {
    const { scale, camX, toScreenY } = view;
    const edge = camX + W / scale;
    const reach = Math.max(25, sim.v * 3.2);
    const list = hazardsAhead(edge - sim.x + reach).filter((z) => z.x > edge - 0.5).slice(0, 2);
    const narrow = W < 720;
    let y = clamp(toScreenY(terrain.surface(edge)) - 150, narrow ? 250 : 90, H - 200);
    list.forEach((z, i) => {
      const d = z.x - (sim.x + handling.wheelbase);
      const k = clamp((edge + reach - z.x) / reach, 0, 1);
      const col = R.ACT_COLOR[z.act];
      const urgent = z.act !== 'ride';
      const pulse = urgent ? 0.8 + 0.2 * Math.sin(clock * 12) : 1;
      const w = i ? 104 : 124, h = i ? 46 : 56;
      const x = W - w - 10;
      ctx.save();
      ctx.globalAlpha = (0.5 + 0.5 * k) * (i ? 0.75 : 1) * pulse;
      ctx.fillStyle = 'rgba(16,10,14,0.82)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, w, h, 9) : ctx.rect(x, y, w, h);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = col;
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.fillRect(x, y + 8, 4, h - 16);
      // pointer towards the track ahead
      ctx.beginPath(); ctx.moveTo(x + w, y + h / 2 - 8); ctx.lineTo(x + w + 9, y + h / 2); ctx.lineTo(x + w, y + h / 2 + 8); ctx.fill();
      R.drawHazardIcon(ctx, z.type, x + 26, y + h / 2, h * 0.5);
      ctx.textAlign = 'left';
      ctx.font = `800 ${i ? 15 : 18}px ${R.FONT}`;
      ctx.fillText(z.act === 'up' ? 'POP ▲' : z.act === 'down' ? 'TUCK ▼' : R.HAZARD[z.type].name.toUpperCase(), x + 48, y + h / 2 - 2);
      ctx.font = `700 ${i ? 12 : 13}px ${R.FONT}`;
      ctx.fillStyle = 'rgba(246,239,229,0.85)';
      ctx.fillText(`${Math.round(d)} m`, x + 48, y + h / 2 + 15);
      ctx.restore();
      y += h + 8;
    });
  }

  // The countdown prompt for the next hazard that needs an action: what to
  // do, how long you have, and whether you're set up for it.
  function drawPrompt() {
    const nose = sim.x + handling.wheelbase;
    const z = hazardsAhead(Math.max(12, sim.v * 2.2)).find((q) => q.act !== 'ride');
    if (!z) return;
    const tLeft = Math.max(0, (z.x - nose) / Math.max(sim.v, 1));
    const up = z.act === 'up';
    const ready = up ? !sim.frontDown && sim.theta > 9 * DEG : sim.tuck > 0.6 && sim.theta < 8 * DEG;
    const late = !ready && tLeft < 0.8;
    const col = ready ? '#6fd38a' : late ? (Math.floor(clock * 10) % 2 ? '#ff4d4d' : '#ffffff') : R.ACT_COLOR[z.act];
    const w = 230, h = 62;
    const x = (W - w) / 2, y = W < 720 ? H * 0.58 : H * 0.79;
    ctx.save();
    ctx.fillStyle = 'rgba(16,10,14,0.78)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, 12) : ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = col;
    ctx.stroke();
    R.drawHazardIcon(ctx, z.type, x + 32, y + 28, 32);
    ctx.fillStyle = col;
    ctx.textAlign = 'left';
    ctx.font = `italic 800 26px ${R.FONT}`;
    const label = ready ? (up ? '▲ FRONT UP ✓' : '▼ TUCKED ✓') : up ? (late ? 'POP NOW!' : '▲ POP') : late ? 'TUCK NOW!' : '▼ TUCK';
    ctx.fillText(label, x + 62, y + 34);
    ctx.font = `600 12px ${R.FONT}`;
    ctx.fillStyle = 'rgba(246,239,229,0.8)';
    ctx.fillText(up ? `${R.HAZARD[z.type].name}: get the front over it` : `${R.HAZARD[z.type].name}: front down, hold → under it`, x + 62, y + 51);
    // the time left, as a bar that runs out
    const frac = clamp(tLeft / 2.2, 0, 1);
    ctx.fillStyle = col;
    ctx.fillRect(x + 8, y + h - 5, (w - 16) * frac, 3);
    ctx.restore();
  }

  // A beep when a hazard that needs an action comes within three seconds:
  // rising for pop, falling for tuck.
  function warnBeeps() {
    for (const z of hazardsAhead(Math.max(20, sim.v * 3))) {
      if (z.act === 'ride' || run.warned.has(z.o)) continue;
      run.warned.add(z.o);
      audio.warn(z.act);
    }
  }

  /* ---------- HUD ---------- */
  // A strip across the top: the police behind, you, and what's coming.
  const RADAR_BACK = 90, RADAR_AHEAD = 60;
  function drawRadar() {
    const narrow = W < 720;
    const w = narrow ? W - 32 : Math.min(480, W - 470);
    const x0 = narrow ? 16 : (W - w) / 2;
    const y = narrow ? 204 : 30;
    const toX = (d) => x0 + ((d + RADAR_BACK) / (RADAR_BACK + RADAR_AHEAD)) * w;
    ctx.save();
    ctx.fillStyle = 'rgba(18,12,16,0.55)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x0 - 6, y - 11, w + 12, 22, 11) : ctx.rect(x0 - 6, y - 11, w + 12, 22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(246,239,229,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke();
    const nose = sim.x + handling.wheelbase;
    // track features ahead
    for (const f of terrain.features) {
      if (f.x1 < sim.x - RADAR_BACK || f.x0 > sim.x + RADAR_AHEAD) continue;
      if (f.type === 'puddle' && !atmo.wet) continue;
      const a = toX(Math.max(-RADAR_BACK, f.x0 - sim.x)), b = toX(Math.min(RADAR_AHEAD, f.x1 - sim.x));
      ctx.fillStyle = f.type === 'mud' ? 'rgba(120,72,40,0.9)' : f.type === 'puddle' ? 'rgba(110,160,220,0.8)' : 'rgba(255,197,49,0.45)';
      ctx.fillRect(a, y - 2, b - a, 4);
    }
    // obstacles
    for (const o of terrain.obstaclesNear(sim.x - RADAR_BACK, sim.x + RADAR_AHEAD)) {
      if (gone.has(o)) continue;
      const d = o.x - nose;
      const X = toX(o.x - sim.x);
      const fade = d < 0 ? 0.35 : 1;
      if (o.overhead) {
        // hangs from the top of the strip: tuck under
        ctx.fillStyle = `rgba(79,210,255,${fade})`;
        ctx.fillRect(X - 3, y - 11, 6, 9);
        ctx.beginPath(); ctx.moveTo(X - 4, y - 1); ctx.lineTo(X + 4, y - 1); ctx.lineTo(X, y + 4); ctx.fill();
      } else if (o.tall) {
        ctx.fillStyle = `rgba(255,77,77,${fade})`;
        ctx.fillRect(X - 3, y - 4, 6, 15);
        ctx.beginPath(); ctx.moveTo(X - 4, y - 4); ctx.lineTo(X + 4, y - 4); ctx.lineTo(X, y - 10); ctx.fill();
      } else if (o.soft) {
        ctx.fillStyle = `rgba(255,130,40,${fade})`;
        ctx.fillRect(X - 1, y - 3, 2, 6);
      } else {
        ctx.fillStyle = `rgba(246,239,229,${0.85 * fade})`;
        ctx.fillRect(X - 1.5, y - 5, 3, 10);
      }
    }
    for (const st of sim.stingers) {
      if (st.x < sim.x - RADAR_BACK || st.x > sim.x + RADAR_AHEAD) continue;
      const X = toX(st.x - sim.x);
      ctx.strokeStyle = st.hit ? 'rgba(255,150,40,0.35)' : '#ff9a2a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) ctx.lineTo(X - 6 + i * 3, y + (i % 2 ? -5 : 3));
      ctx.stroke();
    }
    // you
    const bx = toX(0);
    ctx.fillStyle = '#ffc531';
    ctx.beginPath(); ctx.moveTo(bx + 7, y); ctx.lineTo(bx - 5, y - 6); ctx.lineTo(bx - 5, y + 6); ctx.closePath(); ctx.fill();
    // the police
    const p = sim.police;
    if (p) {
      const gap = Math.max(0, p.gap);
      const X = toX(-Math.min(RADAR_BACK, gap + 1));
      const red = Math.floor(clock * 8) % 4 < 2;
      ctx.fillStyle = !p.active ? 'rgba(200,200,210,0.7)' : red ? '#ff3b3b' : '#3b7bff';
      ctx.beginPath(); ctx.arc(X, y, 6, 0, Math.PI * 2); ctx.fill();
      if (p.active) {
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(X, y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.font = `700 12px ${R.FONT}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = gap < 15 && p.active ? '#ff6a6a' : 'rgba(246,239,229,0.85)';
      const label = p.active ? `POLICE ${Math.round(gap)} m` : 'POLICE';
      ctx.fillText(label, Math.min(Math.max(x0, X - 20), x0 + w - 90), y + 25);
      // wanted level
      ctx.textAlign = 'right';
      ctx.font = `700 13px ${R.FONT}`;
      const lit = '★'.repeat(p.level), dim = '★'.repeat(5 - p.level);
      ctx.fillStyle = 'rgba(246,239,229,0.25)';
      ctx.fillText(dim, x0 + w + 4, y + 26);
      ctx.fillStyle = '#ffc531';
      ctx.fillText(lit, x0 + w + 4 - ctx.measureText(dim).width, y + 26);
    }
    ctx.restore();
  }

  function drawHud(view) {
    void view;
    const r = Math.max(50, Math.min(70, W * 0.09));
    R.drawGauge(ctx, 16 + r * 1.3, H - (isTouch ? 132 : 16) - r * 0.18, r, clamp(sim.theta, 0, Math.PI / 2), Sim.balanceAngle(sim, handling), Sim.CRASH_ANGLE, run && run.sweet);
    if (!onAirfield()) drawRadar();
    $('hud-dist').textContent = fmt(sim.distance);
    $('hud-wheelie').textContent = fmt(sim.wheelieTotal);
    // on the airfield there are no points: show the wheelie you're on
    $('hud-score-label').textContent = onAirfield() ? 'Wheelie m' : 'Score';
    $('hud-score').textContent = onAirfield() ? fmt(sim.wheelieDist) : fmt(run.score);
    const mb = $('hud-mult');
    mb.textContent = run.mult > 1 && !onAirfield() ? `×${run.mult}` : '';
    mb.classList.toggle('hot', run.mult >= 4);
    $('hud-speed').textContent = String(Math.round(sim.v * 3.6));
    $('hud-mph').textContent = `${Math.round(sim.v * 2.23694)} mph`;
    const hh = Math.floor(atmo.tod), mm = Math.floor((atmo.tod - hh) * 60);
    $('hud-cond').textContent = `${weatherLabel()} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    // ride mode and the electronics at work
    const P = build.perks, chips = [];
    if (sim.tuck > 0.6) chips.push('<span class="on">Tuck</span>');
    if (sim.trick) {
      const on = sim.trick === 'drag' ? sim.handDown : sim.trickK > 0.85;
      chips.push(`<span class="${on ? 'hot' : ''}">${TRICKS[sim.trick].label}${on ? ` ×${TRICKS[sim.trick].mult}` : ''}</span>`);
      // how close the arm is to buckling under the gas
      if (sim.handDown) {
        const strain = Math.min(1, sim.handLoad / Sim.TUNE.dragLoad);
        chips.push(`<span class="${strain > 0.75 ? 'hot' : 'on'}">Arm ${Math.round(strain * 100)}%</span>`);
      }
    }
    if (build.modes.length > 1) chips.push(`<span>${build.modes[modeIdx].name}</span>`);
    if (P.has('traction')) chips.push(`<span class="${sim.spin > 0.2 || (sim.throttle > 0.9 && sim.v < 8) ? 'on' : ''}">TC</span>`);
    if (P.has('antiLoop')) chips.push(`<span class="${assistOff ? 'off' : sim.assist > 0 ? 'hot' : ''}">Anti-loop${assistOff ? ' off' : ''}</span>`);
    if (P.has('launch') && (sim.launchArmed || sim.launchT > 0)) chips.push(`<span class="on">${sim.launchArmed ? 'Launch armed' : 'Launch'}</span>`);
    if (P.has('clutch')) chips.push(`<span class="${sim.clutchHeld ? 'on' : ''}">Clutch${sim.clutchHeld ? ` ${Math.round(sim.rev * 100)}%` : ''}</span>`);
    if (P.has('regen')) chips.push(`<span class="${sim.throttle < 0.15 && sim.v > 2 && sim.status === 'riding' ? 'on' : ''}">Regen</span>`);
    const html = chips.join('');
    if (html !== hudModeHtml) { $('hud-mode').innerHTML = html; hudModeHtml = html; }
    const bsc = bestScore(bike.id);
    const fill = $('hud-bestfill');
    fill.style.width = bsc > 0 ? `${Math.min(100, (run.score / bsc) * 100)}%` : '0%';
    fill.classList.toggle('beat', bsc > 0 && run.score > bsc);
    if (hintTimer <= 0) $('hud-hint').style.opacity = 0;
  }

  // Read-only view of the ride, used by automated playtests.
  Object.defineProperty(window, 'wheelieState', {
    get: () => sim && {
      mode, status: sim.status, cause: sim.cause, theta: sim.theta, omega: sim.omega, v: sim.v, lean: sim.lean,
      dist: sim.wheelieDist, time: sim.time, trick: sim.trick, trickK: sim.trickK, handDown: sim.handDown, handSkim: sim.handSkim, handLoad: sim.handLoad, inWheelie: sim.inWheelie, frontDown: sim.frontDown, airborne: sim.airborne,
      cr: sim.cr, cf: sim.cf, popT: sim.popT, tuck: sim.tuck, throttle: sim.throttle, x: sim.x, distance: sim.distance, inPuddle: sim.inPuddle, inMud: sim.inMud,
      score: run ? run.score : 0, clears: stats ? stats.clears : 0,
      police: sim.police && { gap: sim.police.gap, active: sim.police.active, v: sim.police.v, level: sim.police.level },
      stingers: sim.stingers.filter((q) => !q.hit).map((q) => q.x),
      ahead: terrain.obstaclesNear(sim.x - 1, sim.x + handling.wheelbase + 30).filter((o) => !gone.has(o)).map((o) => ({ type: o.type, x: o.x, h: o.h, tall: o.tall })),
      frontX: sim.x + handling.wheelbase * Math.cos(sim.theta),
      weather: weatherKind, tod: atmo && atmo.tod, light: atmo && atmo.light, headlight: hl,
      leanAngle: handling.leanAngle, wheelbase: handling.wheelbase,
      balance: Sim.balanceAngle(sim, handling), vmax: handling.vmax,
    },
  });

  resize();
  drawChips();
  setTab(tab);
  openMenu();
  atmo = Atmo.compute(timeOf.start, terrain.env, 0);
  requestAnimationFrame(frame);
  // Webfonts change the menu's text metrics; size the stage again once they land.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeStage);
})();
