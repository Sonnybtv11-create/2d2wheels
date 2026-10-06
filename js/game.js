(function () {
  'use strict';

  const Sim = window.WheelieSim;
  const R = window.Render;
  const Art = window.BikeArt;
  const BIKES = window.BIKES;
  const DEG = Sim.DEG;

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

  /* ---------- state ---------- */
  let bikeIndex = Math.max(0, BIKES.findIndex((b) => b.id === store.get('bike', BIKES[0].id)));
  let mode = 'menu'; // menu | play | results
  let sim, handling, terrain, bike;
  let camY = 0, camFocus = 0;
  let rider = null; // crash tumble
  let particles = [];
  let stats = { topSpeed: 0, maxPitch: 0 };
  let hintTimer = 0;
  let shake = 0;
  const keys = { throttle: false, brake: false, leanBack: false, leanFwd: false };

  function best(id) { return store.get('best.' + id, 0); }

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
    const bst = best(b.id);
    $('bike-best').textContent = bst > 0 ? `${bst.toFixed(1)} m` : 'No wheelie yet';
    $('bike-sources').innerHTML = 'Specs: ' + b.sources.map((u) => `<a href="${u}" target="_blank" rel="noopener">${new URL(u).hostname.replace(/^www\./, '')}</a>`).join(' · ');
  }

  function selectBike(i) {
    bikeIndex = (i + BIKES.length) % BIKES.length;
    store.set('bike', BIKES[bikeIndex].id);
    stageT = 0;
    refreshMenu();
    if (mode === 'menu') newRun();
  }

  function show(id, on) { $(id).hidden = !on; }

  function openMenu() {
    mode = 'menu';
    show('menu', true); show('results', false); show('hud', false); show('touch', false);
    refreshMenu();
    sizeStage();
    newRun(); // the demo rider behind the menu
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
    const wb = b.look.wheelbase;
    // a gentle wheelie every few seconds
    const cyc = (stageT % 5) / 5;
    const lift = cyc < 0.15 ? 0 : cyc < 0.55 ? Math.sin(((cyc - 0.15) / 0.4) * Math.PI / 2) : cyc < 0.8 ? 1 : 1 - (cyc - 0.8) / 0.2;
    const pitch = lift * 22 * DEG;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const p = reduce ? 0 : pitch;
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
    sctx.translate(w * 0.5 - (wb / 2) * scale, groundY);
    sctx.scale(scale, -scale);
    sctx.rotate(p);
    Art.drawBike(sctx, b.id, { lean: lift * 0.8, spin: reduce ? 0 : stageT * 3, pitch: p });
    sctx.restore();
  }

  /* ---------- runs ---------- */
  function newRun() {
    bike = BIKES[bikeIndex];
    handling = Sim.deriveHandling(bike);
    terrain = Sim.createTerrain((Math.random() * 1e9) | 0);
    sim = Sim.createState();
    rider = null;
    particles = [];
    stats = { topSpeed: 0, maxPitch: 0 };
    camY = terrain.height(0);
    camFocus = 0;
  }

  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  function startRun() {
    newRun();
    mode = 'play';
    show('menu', false); show('results', false); show('hud', true); show('touch', isTouch);
    $('hud-bike').textContent = bike.name;
    $('hud-best').textContent = `Best ${best(bike.id).toFixed(1)} m`;
    hint(isTouch ? 'Hold Gas + ◀ Lean' : 'Hold ↑ and ← to pop it', 2.5);
    for (const k in keys) keys[k] = false;
    audio.unlock();
  }

  function finishRun() {
    mode = 'results';
    const crashed = sim.status === 'crashed';
    const prev = best(bike.id);
    const isBest = sim.score > prev;
    if (isBest) store.set('best.' + bike.id, sim.score);
    $('res-title').textContent = crashed ? 'Looped out' : 'Front wheel down';
    $('res-title').className = crashed ? 'crash' : '';
    $('res-bike').textContent = bike.name;
    $('res-dist').textContent = sim.score.toFixed(1);
    $('res-time').textContent = `${sim.wheelieTime.toFixed(1)} s`;
    $('res-speed').textContent = `${Math.round(stats.topSpeed * 3.6)} km/h`;
    $('res-angle').textContent = `${Math.round(stats.maxPitch / DEG)}°`;
    const rb = $('res-best');
    rb.textContent = isBest ? (prev > 0 ? `New best, up from ${prev.toFixed(1)} m` : 'New best') : `Best ${prev.toFixed(1)} m`;
    rb.className = 'res-best' + (isBest ? ' new' : '');
    show('results', true); show('touch', false);
    $('btn-retry').focus({ preventScroll: true });
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

  /* ---------- audio: synthesized electric motor whine ---------- */
  const audio = (() => {
    let ac = null, osc, osc2, gain, filter, noiseGain;
    let muted = store.get('muted', false);
    const label = () => { $('snd-on').style.display = muted ? 'none' : ''; $('snd-off').style.display = muted ? '' : 'none'; };
    label();
    return {
      unlock() {
        if (ac || muted) { if (ac && ac.state === 'suspended') ac.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC();
        gain = ac.createGain(); gain.gain.value = 0;
        filter = ac.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1800;
        osc = ac.createOscillator(); osc.type = 'sawtooth';
        osc2 = ac.createOscillator(); osc2.type = 'sine';
        const g2 = ac.createGain(); g2.gain.value = 0.6;
        osc.connect(filter); osc2.connect(g2); g2.connect(filter);
        filter.connect(gain); gain.connect(ac.destination);
        const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const noise = ac.createBufferSource(); noise.buffer = buf; noise.loop = true;
        const nf = ac.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 500;
        noiseGain = ac.createGain(); noiseGain.gain.value = 0;
        noise.connect(nf); nf.connect(noiseGain); noiseGain.connect(ac.destination);
        osc.start(); osc2.start(); noise.start();
      },
      update(s, h) {
        if (!ac) return;
        const t = ac.currentTime;
        const active = mode === 'play' && !muted;
        const vr = s.v / h.vmax;
        osc.frequency.setTargetAtTime(90 + vr * 700, t, 0.05);
        osc2.frequency.setTargetAtTime(180 + vr * 1400, t, 0.05);
        gain.gain.setTargetAtTime(active ? 0.015 + 0.05 * s.throttle : 0, t, 0.05);
        noiseGain.gain.setTargetAtTime(active ? Math.min(0.06, vr * 0.08) : 0, t, 0.1);
      },
      toggle() {
        muted = !muted;
        store.set('muted', muted);
        label();
        if (!muted) this.unlock();
      },
    };
  })();

  /* ---------- dust ---------- */
  function emitDust(dt) {
    if (sim.status !== 'riding' && sim.status !== 'crashed') return;
    const slip = sim.status === 'crashed' ? 1 : sim.throttle * Math.max(0, 1 - sim.v / handling.vmax);
    const rate = (sim.v > 0.5 ? 25 : 0) * slip + (sim.status === 'crashed' && sim.v > 1 ? 40 : 0) + (sim.braking && sim.v > 2 ? 30 : 0);
    let n = rate * dt;
    while (n > 0) {
      if (Math.random() < n) {
        particles.push({
          x: sim.x - 0.1 + Math.random() * 0.1,
          y: terrain.height(sim.x) + 0.04,
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
        r: 0.07 + Math.random() * 0.12, age: 0, life: 1 + Math.random(), a: 0.6, c: '186,140,96',
      });
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.age += dt;
      p.vy -= 1.2 * dt;
      p.vx *= 1 - 1.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    particles = particles.filter((p) => p.age < p.life);
    if (particles.length > 400) particles.splice(0, particles.length - 400);
  }

  /* ---------- crash tumble ---------- */
  function spawnRider() {
    const ang = Math.atan(terrain.slope(sim.x)) + sim.theta;
    const hip = Art.info(bike.id).hip;
    const c = Math.cos(ang), s = Math.sin(ang);
    rider = {
      x: sim.x + hip[0] * c - hip[1] * s,
      y: terrain.height(sim.x) + hip[0] * s + hip[1] * c,
      vx: sim.v * 0.5, vy: 2.5,
      rot: ang, vrot: 3 + sim.v * 0.1,
    };
    burst(sim.x, 30);
    shake = 0.5;
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

  /* ---------- main loop ---------- */
  let last = performance.now();
  let resultsDelay = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    let input;
    if (mode === 'play') {
      input = { throttle: keys.throttle, brake: keys.brake, lean: (keys.leanBack ? 1 : 0) - (keys.leanFwd ? 1 : 0) };
    } else if (mode === 'menu') {
      // Demo rider: cruises, pops gentle wheelies and sets the front down.
      const h = handling, s = sim;
      const target = Sim.balanceAngle(s, h) - 20 * DEG;
      const wantUp = Math.sin(s.time * 0.45) > -0.2 && s.v > 6;
      input = { throttle: s.v < 10 || (wantUp && s.theta < target - 0.2 * s.omega), brake: wantUp && s.theta > target + 8 * DEG, lean: wantUp ? 1 : 0 };
      if (s.status !== 'riding') newRun();
    } else {
      input = {};
    }

    const was = sim.status;
    Sim.step(sim, input, handling, terrain, dt);
    if (sim.status === 'riding' && sim.inWheelie) {
      stats.topSpeed = Math.max(stats.topSpeed, sim.v);
      stats.maxPitch = Math.max(stats.maxPitch, sim.theta);
    }
    if (was === 'riding' && sim.status === 'crashed' && mode !== 'menu') spawnRider();
    if (was === 'riding' && sim.status === 'landed') burst(sim.x + handling.wheelbase, 10);
    if (was === 'riding' && sim.status !== 'riding' && mode === 'play') resultsDelay = sim.status === 'crashed' ? 1.4 : 0.9;
    if (mode === 'play' && sim.status !== 'riding') {
      resultsDelay -= dt;
      if (resultsDelay <= 0) finishRun();
    }
    emitDust(dt);
    updateParticles(dt);
    updateRider(dt);
    audio.update(sim, handling);
    shake = Math.max(0, shake - dt);

    if (hintTimer > 0) {
      hintTimer -= dt;
      if (hintTimer <= 0) $('hud-hint').style.opacity = 0;
    }
    if (mode === 'play' && sim.status === 'riding') {
      const bal = Sim.balanceAngle(sim, handling);
      if (sim.inWheelie && sim.theta > bal + 2 * DEG) hint('Past the balance point · brake', 0.3, true);
      else if (sim.inWheelie && hintTimer <= 0 && sim.wheelieDist > 10 && sim.wheelieDist < 14) hint('Feather the gas', 1.2);
    }

    draw();
    drawStage(dt);
    requestAnimationFrame(frame);
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const scale = Math.min(H / 6.2, W / 5.4);
    if (rider) camFocus += ((sim.x + rider.x) / 2 + 1 - camFocus) * 0.08;
    else camFocus = sim.x;
    const sx = shake > 0 ? (Math.random() - 0.5) * shake * 14 : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * shake * 10 : 0;
    const camX = camFocus - (W * 0.32) / scale;
    camY += (terrain.height(camFocus) - camY) * 0.12;
    const groundLine = H * 0.7;
    const toScreenY = (y) => groundLine - (y - camY) * scale + sy;
    const view = { w: W, h: H, scale, camX: camX - sx / scale, toScreenY };

    R.drawSky(ctx, W, H, camX, groundLine - scale * 0.4);
    R.drawTrackside(ctx, view, terrain);
    R.drawGround(ctx, view, terrain);

    if (mode !== 'menu') {
      const bst = best(bike.id);
      if (sim.inWheelie && bst > 0) R.drawFlag(ctx, view, terrain, sim.wheelieStartX + bst, `Best ${bst.toFixed(0)} m`, '#ffc531');
      if ((sim.inWheelie || sim.status !== 'riding') && sim.wheelieDist > 0) R.drawFlag(ctx, view, terrain, sim.wheelieStartX, 'Start', '#f6efe5');
    }

    // bike
    const slope = Math.atan(terrain.slope(sim.x));
    let pitch = sim.theta;
    if (sim.status === 'crashed') pitch = Sim.CRASH_ANGLE + Math.min(1, sim.crashT * 1.6) * (Math.PI - 0.15 - Sim.CRASH_ANGLE);
    if (sim.status !== 'crashed') R.drawShadow(ctx, view, terrain, sim.x, bike.look.wheelbase, pitch);
    R.drawParticles(ctx, view, particles.filter((p) => p.r < 0.1));
    const flipLift = sim.status === 'crashed' ? Math.max(0, -Math.cos(pitch)) * (bike.look.wheelRadius + 0.98) : 0;
    ctx.save();
    ctx.translate((sim.x - view.camX) * scale, toScreenY(terrain.height(sim.x) + flipLift));
    ctx.scale(scale, -scale);
    ctx.rotate(slope + pitch);
    Art.drawBike(ctx, bike.id, {
      lean: sim.lean, spin: sim.x / bike.look.wheelRadius, blur: Math.min(1, sim.v / 14),
      rider: !rider, pitch: slope + pitch,
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
    R.drawParticles(ctx, view, particles.filter((p) => p.r >= 0.1));
    R.drawVignette(ctx, W, H);

    if (mode === 'play' || mode === 'results') {
      const r = Math.max(50, Math.min(70, W * 0.09));
      R.drawGauge(ctx, 16 + r * 1.3, H - (isTouch ? 132 : 16) - r * 0.18, r, Math.min(sim.theta, Math.PI / 2), Sim.balanceAngle(sim, handling), Sim.CRASH_ANGLE);
      $('hud-dist').textContent = sim.wheelieDist.toFixed(1);
      $('hud-speed').textContent = String(Math.round(sim.v * 3.6));
      $('hud-mph').textContent = `${Math.round(sim.v * 2.23694)} mph`;
      const bst = best(bike.id);
      const fill = $('hud-bestfill');
      fill.style.width = bst > 0 ? `${Math.min(100, (sim.wheelieDist / bst) * 100)}%` : '0%';
      fill.classList.toggle('beat', bst > 0 && sim.wheelieDist > bst);
    }
  }

  resize();
  openMenu();
  requestAnimationFrame(frame);
  // Webfonts change the menu's text metrics; size the stage again once they land.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeStage);
})();
