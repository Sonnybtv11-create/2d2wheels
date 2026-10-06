(function () {
  'use strict';

  const Sim = window.WheelieSim;
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
    { id: 'windy', label: 'Windy' },
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
  let condTime = store.get('time', 'sunset');
  let condWeather = store.get('weather', 'random');
  if (!TIMES.some((t) => t.id === condTime)) condTime = 'sunset';
  if (!WEATHERS.some((w) => w.id === condWeather)) condWeather = 'random';
  function pickWeather() {
    const r = Math.random();
    return r < 0.3 ? 'clear' : r < 0.55 ? 'windy' : r < 0.8 ? 'rain' : 'storm';
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
  const keys = { throttle: false, brake: false, leanBack: false, leanFwd: false };

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
    const c = chip.querySelector('canvas').getContext('2d');
    const s = 240 / 2.15;
    c.save();
    c.translate(120 - (b.look.wheelbase / 2) * s, 112);
    c.scale(s, -s);
    Art.drawBike(c, b.id, { rider: false, spin: 0.4 });
    c.restore();
  });

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
  buildSeg($('seg-weather'), WEATHERS, () => condWeather, (id) => { condWeather = id; store.set('weather', id); });
  buildSeg($('seg-wanted'), [1, 2, 3, 4, 5].map((n) => ({ id: n, label: '★'.repeat(n) })), () => condWanted, (id) => {
    condWanted = id; store.set('wanted', id); $('wanted-desc').textContent = WANTED_INFO[id];
  });
  $('wanted-desc').textContent = WANTED_INFO[condWanted];

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
    $('specs').innerHTML =
      specRow('Peak power', `${b.peakPowerKw} kW`, Math.log(b.peakPowerKw * 1.33) / SPEC_MAX.power) +
      specRow('Weight', `${b.weightKg} kg`, b.weightKg / SPEC_MAX.weight) +
      specRow('Top speed', `${b.topSpeedKmh} km/h`, b.topSpeedKmh / SPEC_MAX.speed) +
      `<div class="spec-extra">${b.extra}</div>`;
    const bsc = bestScore(b.id);
    $('bike-best').textContent = bsc > 0 ? `${fmt(bsc)} pts · ${fmt(bestDist(b.id))} m` : 'No run yet';
    $('bike-sources').innerHTML = 'Specs: ' + b.sources.map((u) => `<a href="${u}" target="_blank" rel="noopener">${new URL(u).hostname.replace(/^www\./, '')}</a>`).join(' · ');
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
    Art.drawBike(sctx, b.id, { lean: lift * 0.8 - dip * 0.6, spin: reduce ? 0 : stageT * 3, pitch: p, frontOff: front, rearOff: reduce ? 0 : lift * 0.03 });
    sctx.restore();
  }

  /* ---------- runs ---------- */
  function newRun(play) {
    bike = BIKES[bikeIndex];
    handling = Sim.deriveHandling(bike);
    const seed = (Math.random() * 1e9) | 0;
    terrain = Sim.createTerrain(seed);
    weatherKind = condWeather === 'random' ? pickWeather() : condWeather;
    terrain.env = Sim.createWeather(seed, weatherKind);
    timeOf = TIMES.find((t) => t.id === condTime);
    fx = Atmo.createFx(seed);
    sim = Sim.createState({ police: !!play, wanted: condWanted, seed });
    wantedMult = play ? Sim.WANTED[condWanted].mult : 1;
    heli = play && Sim.WANTED[condWanted].heli ? { x: -30, y: 12, vx: 0, on: false } : null;
    rider = null;
    crashPose = null;
    particles = [];
    debris = [];
    gone = new Set();
    stats = { topSpeed: 0, clears: 0, closeCalls: 0, endT: 0 };
    run = { score: 0, mult: 1, lastX: 0, sweet: false, popups: [], milestone: 0, passedBest: false, danger: false, tips: new Set() };
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
    $('hud-best').textContent = `Best ${fmt(bestScore(bike.id))}`;
    hint(isTouch ? 'Hold Gas, tap ◀ Lean to pop the front' : 'Hold ↑, tap ← to pop the front', 2.8);
    for (const k in keys) keys[k] = false;
    audio.unlock();
  }

  function finishRun() {
    mode = 'results';
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
    $('res-dist-m').textContent = `${fmt(sim.distance)} m · ${stats.endT.toFixed(0)} s`;
    $('res-wheelie').textContent = `${fmt(sim.wheelieTotal)} m · longest ${fmt(sim.longest)} m`;
    $('res-clears').textContent = String(stats.clears) + (stats.closeCalls ? ` · ${stats.closeCalls} close call${stats.closeCalls > 1 ? 's' : ''}` : '');
    $('res-speed').textContent = `${Math.round(stats.topSpeed * 3.6)} km/h`;
    $('res-bank').textContent = `${fmt(bank)} (+${fmt(run.score)})`;
    const rb = $('res-best');
    rb.textContent = isBest ? (prev > 0 ? `New best, up from ${fmt(prev)}` : 'New best') : `Best ${fmt(prev)}`;
    rb.className = 'res-best' + (isBest ? ' new' : '');
    show('results', true); show('touch', false);
    $('btn-retry').focus({ preventScroll: true });
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
  };

  window.addEventListener('keydown', (e) => {
    audio.unlock();
    if (e.code === 'KeyM') { audio.toggle(); return; }
    if (mode === 'menu') {
      if (e.target && e.target.closest && e.target.closest('.seg')) return; // let the pickers have their keys
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
    const k = KEYMAP[e.code];
    if (k) { keys[k] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k) keys[k] = false;
  });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  document.querySelectorAll('.touch-btn').forEach((btn) => {
    const k = btn.dataset.key;
    const on = (e) => { e.preventDefault(); btn.setPointerCapture(e.pointerId); keys[k] = true; btn.classList.add('active'); audio.unlock(); };
    const off = () => { keys[k] = false; btn.classList.remove('active'); };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('lostpointercapture', off);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  $('btn-start').addEventListener('click', startRun);
  $('btn-retry').addEventListener('click', startRun);
  $('btn-change').addEventListener('click', openMenu);
  $('btn-menu').addEventListener('click', openMenu);
  $('btn-sound').addEventListener('click', () => audio.toggle());
  $('prev').addEventListener('click', () => selectBike(bikeIndex - 1));
  $('next').addEventListener('click', () => selectBike(bikeIndex + 1));

  /* ---------- audio: all synthesized ---------- */
  const audio = (() => {
    let ac = null, out, osc, osc2, gain, filter, roarGain, noiseBuf;
    let rainGain, windGain, windFilter, sirenOsc, sirenGain, rotorGain;
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
        // wind: low, resonant, swelling with the gusts
        const wind = noise();
        windFilter = ac.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 300; windFilter.Q.value = 1.6;
        windGain = ac.createGain(); windGain.gain.value = 0;
        wind.connect(windFilter); windFilter.connect(windGain); windGain.connect(out);
        // siren
        sirenOsc = ac.createOscillator(); sirenOsc.type = 'square';
        const sf = ac.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 1600;
        sirenGain = ac.createGain(); sirenGain.gain.value = 0;
        sirenOsc.connect(sf); sf.connect(sirenGain); sirenGain.connect(out);
        osc.start(); osc2.start(); roar.start(); rain.start(); wind.start(); sirenOsc.start();
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
        const gust = Math.abs(a.wind) + (riding ? s.v * 0.15 : 0);
        windGain.gain.setTargetAtTime(amb * clamp((gust - 2) / 14, 0, 1) * 0.09, t, 0.2);
        windFilter.frequency.setTargetAtTime(180 + gust * 22, t, 0.2);
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
  const CLEAR_POINTS = { log: 40, rock: 30, tyres: 100, stinger: 120 };

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
    run.score += Math.max(0, sim.x - run.lastX) * run.mult * wantedMult;
    run.lastX = sim.x;

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
          const pts = (CLEAR_POINTS[o.type] || 20) * (sim.inWheelie ? 1 : 0.5) * wantedMult;
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
          vx: -(1 + Math.random() * 2.5) * (0.4 + slip) - atmo.wind * 0.3,
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
      p.vx += (-atmo.wind * 0.35 - p.vx) * (p.spark ? 0 : 1.5 * dt);
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
    rider = forward
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
    const ahead = terrain.obstaclesNear(s.x + h.wheelbase + 1, s.x + h.wheelbase + 1 + Math.max(4, s.v * 0.5)).some((o) => !o.soft);
    if (s.frontDown || s.theta < 4 * DEG) {
      const want = (demo.up || ahead) && s.v > 6;
      demo.pulse = ((demo.pulse || 0) + dt) % 0.7;
      return { throttle: true, lean: want ? (demo.pulse < 0.25 ? 1 : -0.5) : 0 };
    }
    const bal = Sim.balanceAngle(s, h);
    const target = demo.up || ahead ? bal - 12 * DEG : 0;
    const err = target - s.theta - 0.3 * s.omega;
    return { throttle: err > 0, brake: err < -6 * DEG, lean: 1 };
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
      input = { throttle: keys.throttle, brake: keys.brake, lean: (keys.leanBack ? 1 : 0) - (keys.leanFwd ? 1 : 0) };
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
    if (atmo.headlights && !hlOn) { hlOn = true; hlT = 0; if (mode === 'play' && sim.time > 0.5) audio.click(); }
    if (!atmo.headlights && atmo.light > 0.7) hlOn = false;
    hlT += dt;
    if (hlOn) hl = hlT < 0.4 ? (Math.sin(hlT * 70) > 0.2 ? 1 : 0.15) : 1;
    else hl = Math.max(0, hl - dt * 3);

    audio.update(sim, handling, atmo, clock);
    shake = Math.max(0, shake - dt);
    if (hintTimer > 0) hintTimer -= dt;
    if (mode === 'play') tips();

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
    if (sim.inWheelie && sim.theta > bal + 2 * DEG) hint('Past the balance point · brake', 0.3, true);
    else if (p && p.active && p.gap < 12) hint('They\'re on you · wheelie!', 0.3, true);
    else if (next && next.tall && sim.frontDown && runsThisSession <= 3) once('tyres' + next.x, 'Tyre stack · pop the front over it', 1.2, true);
    else if (next && sim.frontDown && runsThisSession <= 1) once('obstacle', 'Snap ← on the gas to pop over it', 1.6);
    else if (p && p.active && sim.time < 7) once('police', 'Police! Wheelie to outrun them', 2, true);
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
    const w = { clear: 'Clear', windy: 'Windy', rain: 'Rain', storm: 'Storm' }[weatherKind];
    return `${timeOf.label} · ${w}`;
  }

  function draw(dt) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // pull the camera back as speed builds so the hills ahead stay in view
    // ... and further when the police close in, so you can see them coming
    const p = sim.police;
    const chase = p && p.active && sim.status !== 'crashed' ? clamp((28 - p.gap) / 22, 0, 1) : 0;
    zoom += ((1 - 0.24 * Math.min(1, sim.v / 28)) * (1 - 0.25 * chase) - zoom) * 0.03;
    const scale = Math.min(H / 6.2, W / 5.4) * zoom;
    // slide the bike forward on screen when the police are close, so the car shows
    const leadWant = (W < 600 ? 0.2 : 0.32) + 0.28 * chase;
    camLead += (leadWant - camLead) * Math.min(1, dt * 2);
    if (rider) camFocus += ((sim.x + rider.x) / 2 + 1 - camFocus) * 0.08;
    else camFocus = sim.x;
    const sx = shake > 0 ? (Math.random() - 0.5) * shake * 14 : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * shake * 10 : 0;
    const camX = camFocus - (W * camLead) / scale;
    camY += (terrain.base(camFocus) - camY) * 0.12;
    const groundLine = H * 0.7;
    const toScreenY = (y) => groundLine - (y - camY) * scale + sy;
    const view = { w: W, h: H, scale, camX: camX - sx / scale, toScreenY };
    const toScreen = (x, y) => [(x - view.camX) * scale, toScreenY(y)];
    const a = atmo;
    const horizon = groundLine - scale * 0.4;

    R.drawSky(ctx, W, H, camX, horizon, a, clock);
    // the cruisers that laid the stingers, parked beyond the tape
    for (const st of sim.stingers) R.drawPolice(ctx, view, terrain, { x: st.x + 2.5, active: true }, clock + st.x, { parked: { s: 0.62, lift: 0.75, alpha: 0.9 } });
    R.drawTrackside(ctx, view, terrain, a.wind, clock);
    R.drawGround(ctx, view, terrain, a, a.wind, clock);
    R.drawFeatures(ctx, view, terrain, a, clock);
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
      lean: sim.lean, spin: sim.x / bike.look.wheelRadius, blur: Math.min(1, sim.v / 14),
      rider: !rider, pitch: pose.ang, frontOff: pose.frontOff, rearOff: pose.rearOff,
    });
    ctx.restore();

    if (rider) {
      ctx.save();
      ctx.translate((rider.x - view.camX) * scale, toScreenY(rider.y));
      ctx.scale(scale, -scale);
      ctx.rotate(rider.rot);
      Art.drawLooseRider(ctx, bike.id);
      ctx.restore();
    }
    drawDebrisPieces(view);
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
      lights.push({ kind: 'cone', x: hx, y: hy, angle: -pose.ang + 0.1, spread: 0.3, len: 11 * scale, power: 0.95 * hl });
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
    Atmo.drawDebris(ctx, fx, a);
    Atmo.drawLightning(ctx, fx, W, H);

    // police lights washing in from off screen
    if (polOff && near > 0 && sim.status === 'riding') {
      const g = ctx.createLinearGradient(0, 0, W * 0.18, 0);
      g.addColorStop(0, red ? `rgba(255,40,40,${(0.4 * near).toFixed(3)})` : `rgba(50,110,255,${(0.45 * near).toFixed(3)})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W * 0.18, H);
    }
    R.drawVignette(ctx, W, H);
    if (mode === 'play' && sim.status === 'riding') drawIncoming(view);

    if (mode === 'play' || mode === 'results') drawHud(view);
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

  // A marker at the right edge for the next obstacle that's coming but not
  // yet on screen, about two seconds out.
  function drawIncoming(view) {
    const { scale, camX, toScreenY } = view;
    const edge = camX + W / scale;
    const reach = edge + Math.max(8, sim.v * 2.2);
    const ob = terrain.obstaclesNear(edge - 0.3, reach).find((q) => !q.soft && !gone.has(q));
    const sg = sim.stingers.find((q) => !q.hit && q.x > edge - 0.3 && q.x < reach);
    const o = sg && (!ob || sg.x < ob.x) ? { type: 'stinger', x: sg.x, tall: true } : ob;
    if (o) {
      const d = o.x - (sim.x + handling.wheelbase);
      const k = clamp((reach - o.x) / (reach - edge), 0, 1);
      const y = clamp(toScreenY(terrain.surface(o.x)) - 34, 60, H - 60);
      const x = W - 30;
      const pulse = o.tall ? 0.75 + 0.25 * Math.sin(clock * 14) : 1;
      ctx.save();
      ctx.globalAlpha = (0.35 + 0.65 * k) * pulse;
      ctx.translate(x, y);
      ctx.fillStyle = o.tall ? '#ff4d4d' : 'rgba(246,239,229,0.92)';
      ctx.beginPath();
      ctx.moveTo(20, 0); ctx.lineTo(6, -15); ctx.lineTo(-18, -15); ctx.lineTo(-18, 15); ctx.lineTo(6, 15); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = o.tall ? '#fff' : '#1a1418';
      ctx.font = `800 13px ${R.FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(o.type === 'stinger' ? 'SPIKE' : o.tall ? '!' : o.type === 'log' ? 'LOG' : 'ROCK', -4, 1);
      ctx.fillStyle = o.tall ? '#ff8a8a' : 'rgba(246,239,229,0.9)';
      ctx.font = `700 12px ${R.FONT}`;
      ctx.fillText(`${Math.round(d)} m`, -2, 27);
      ctx.restore();
    }
    ctx.textBaseline = 'alphabetic';
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
      if (o.tall) {
        ctx.fillStyle = `rgba(255,77,77,${fade})`;
        ctx.fillRect(X - 2, y - 8, 4, 16);
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
    drawRadar();
    $('hud-dist').textContent = fmt(sim.distance);
    $('hud-wheelie').textContent = fmt(sim.wheelieTotal);
    $('hud-score').textContent = fmt(run.score);
    const mb = $('hud-mult');
    mb.textContent = run.mult > 1 ? `×${run.mult}` : '';
    mb.classList.toggle('hot', run.mult >= 4);
    $('hud-speed').textContent = String(Math.round(sim.v * 3.6));
    $('hud-mph').textContent = `${Math.round(sim.v * 2.23694)} mph`;
    const wv = atmo.wind;
    const kmh = Math.round(Math.abs(wv) * 3.6);
    $('wind-arrow').style.transform = wv > 0 ? 'scaleX(-1)' : 'none';
    $('wind-text').textContent = kmh < 4 ? 'calm' : `${kmh} km/h ${wv > 0 ? 'headwind' : 'tailwind'}`;
    $('hud-wind').classList.toggle('strong', kmh >= 30);
    const hh = Math.floor(atmo.tod), mm = Math.floor((atmo.tod - hh) * 60);
    $('hud-cond').textContent = `${weatherLabel()} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
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
      dist: sim.wheelieDist, time: sim.time, inWheelie: sim.inWheelie, frontDown: sim.frontDown, airborne: sim.airborne,
      cr: sim.cr, cf: sim.cf, popT: sim.popT, x: sim.x, distance: sim.distance, inPuddle: sim.inPuddle, inMud: sim.inMud,
      score: run ? run.score : 0, clears: stats ? stats.clears : 0,
      police: sim.police && { gap: sim.police.gap, active: sim.police.active, v: sim.police.v, level: sim.police.level },
      stingers: sim.stingers.filter((q) => !q.hit).map((q) => q.x),
      ahead: terrain.obstaclesNear(sim.x + handling.wheelbase, sim.x + handling.wheelbase + 30).filter((o) => !gone.has(o)).map((o) => ({ type: o.type, x: o.x, h: o.h, tall: o.tall })),
      frontX: sim.x + handling.wheelbase * Math.cos(sim.theta),
      weather: weatherKind, tod: atmo && atmo.tod, light: atmo && atmo.light, headlight: hl,
      leanAngle: handling.leanAngle, wheelbase: handling.wheelbase,
      balance: Sim.balanceAngle(sim, handling), vmax: handling.vmax,
    },
  });

  resize();
  openMenu();
  atmo = Atmo.compute(timeOf.start, terrain.env, 0);
  requestAnimationFrame(frame);
  // Webfonts change the menu's text metrics; size the stage again once they land.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeStage);
})();
