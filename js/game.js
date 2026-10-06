(function () {
  'use strict';

  const Sim = window.WheelieSim;
  const R = window.Render;
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
  let rider = null; // crash ragdoll
  let hintTimer = 0;
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
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------- menu ---------- */
  const list = $('bike-list');
  BIKES.forEach((b, i) => {
    const card = document.createElement('button');
    card.className = 'bike-card';
    card.type = 'button';
    card.innerHTML = `
      <canvas width="340" height="144" aria-hidden="true"></canvas>
      <div class="bike-diff diff-${b.difficulty.toLowerCase()}">${b.difficulty}</div>
      <div class="bike-name">${b.name}</div>
      <div class="bike-specs">
        <span>Peak power</span><b>${b.peakPowerKw} kW</b>
        <span>Weight</span><b>${b.weightKg} kg</b>
        <span>Top speed</span><b>${b.topSpeedKmh} km/h</b>
      </div>
      <div class="bike-best"></div>`;
    card.addEventListener('click', () => { selectBike(i); });
    card.addEventListener('dblclick', () => { selectBike(i); startRun(); });
    list.appendChild(card);
    drawPreview(card.querySelector('canvas'), b);
  });

  function drawPreview(cv, b) {
    const c = cv.getContext('2d');
    const s = 78;
    c.save();
    c.translate(cv.width / 2 - (b.look.wheelbase / 2) * s, cv.height - 10);
    c.scale(s, -s);
    R.drawBike(c, b.look, { lean: 0, rider: false });
    c.restore();
  }

  function refreshMenu() {
    [...list.children].forEach((card, i) => {
      card.setAttribute('aria-pressed', String(i === bikeIndex));
      const bst = best(BIKES[i].id);
      card.querySelector('.bike-best').textContent = bst > 0 ? `Best ${bst.toFixed(1)} m` : 'No wheelie yet';
    });
    const b = BIKES[bikeIndex];
    const links = b.sources.map((u, i) => `<a href="${u}" target="_blank" rel="noopener">source ${i + 1}</a>`).join(' · ');
    $('bike-detail').innerHTML = `<b>${b.name}</b>: ${b.blurb} <span>${b.extra}.</span> ${links}`;
  }

  function selectBike(i) {
    bikeIndex = (i + BIKES.length) % BIKES.length;
    store.set('bike', BIKES[bikeIndex].id);
    refreshMenu();
    if (mode === 'menu') newRun();
  }

  function show(id, on) { $(id).hidden = !on; }

  function openMenu() {
    mode = 'menu';
    show('menu', true); show('results', false); show('hud', false); show('touch', false);
    refreshMenu();
    newRun(); // the demo rider behind the menu
    $('btn-start').focus({ preventScroll: true });
  }

  /* ---------- runs ---------- */
  function newRun() {
    bike = BIKES[bikeIndex];
    handling = Sim.deriveHandling(bike);
    terrain = Sim.createTerrain((Math.random() * 1e9) | 0);
    sim = Sim.createState();
    rider = null;
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
    hint(isTouch ? 'Hold GAS + ◀ LEAN to pop it up' : 'Hold ↑ and ← to pop a wheelie', 2.5);
    for (const k in keys) keys[k] = false;
    audio.unlock();
  }

  function finishRun() {
    mode = 'results';
    const crashed = sim.status === 'crashed';
    const prev = best(bike.id);
    const isBest = sim.score > prev;
    if (isBest) store.set('best.' + bike.id, sim.score);
    $('res-title').textContent = crashed ? 'Looped out!' : 'Front wheel down';
    $('res-title').className = crashed ? 'crash' : '';
    $('res-dist').textContent = `${sim.score.toFixed(1)} m`;
    $('res-detail').textContent = `${bike.name} · ${sim.wheelieTime.toFixed(1)} s on the back wheel`;
    $('res-best').textContent = isBest ? (prev > 0 ? `New best! (was ${prev.toFixed(1)} m)` : 'New best!') : `Best ${prev.toFixed(1)} m`;
    show('results', true); show('touch', false);
    $('btn-retry').focus({ preventScroll: true });
  }

  function hint(text, seconds) {
    $('hud-hint').textContent = text;
    $('hud-hint').style.opacity = 1;
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

  /* ---------- audio: synthesized electric motor whine ---------- */
  const audio = (() => {
    let ac = null, osc, osc2, gain, filter, noiseGain;
    let muted = store.get('muted', false);
    const btn = $('btn-sound');
    const label = () => { btn.textContent = muted ? '🔇' : '🔊'; };
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
        // tyre / wind noise
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

  /* ---------- crash ragdoll ---------- */
  function spawnRider() {
    // Launch the rider from where the bike was when it looped.
    const look = bike.look;
    const g = R.geometry(look);
    const ang = Math.atan(terrain.slope(sim.x)) + sim.theta;
    const hip = R.riderPose(g, sim.lean).hip;
    const c = Math.cos(ang), s = Math.sin(ang);
    rider = {
      x: sim.x + hip[0] * c - hip[1] * s,
      y: terrain.height(sim.x) + hip[0] * s + hip[1] * c,
      vx: sim.v * 0.5, vy: 2.5,
      rot: ang, vrot: 3 + sim.v * 0.1,
      pose: R.riderPose(g, 1),
    };
  }

  function updateRider(dt) {
    if (!rider) return;
    rider.vy -= 9.81 * dt;
    rider.x += rider.vx * dt;
    rider.y += rider.vy * dt;
    rider.rot += rider.vrot * dt;
    const gy = terrain.height(rider.x) + 0.25;
    if (rider.y < gy) {
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

    if (sim) {
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
      if (was === 'riding' && sim.status === 'crashed' && mode !== 'menu') spawnRider();
      if (was === 'riding' && sim.status !== 'riding' && mode === 'play') resultsDelay = sim.status === 'crashed' ? 1.4 : 0.9;
      if (mode === 'play' && sim.status !== 'riding') {
        resultsDelay -= dt;
        if (resultsDelay <= 0) finishRun();
      }
      updateRider(dt);
      audio.update(sim, handling);
    }

    if (hintTimer > 0) {
      hintTimer -= dt;
      if (hintTimer <= 0) $('hud-hint').style.opacity = 0;
    }
    if (mode === 'play' && sim.status === 'riding') {
      const bal = Sim.balanceAngle(sim, handling);
      if (sim.inWheelie && sim.theta > bal + 2 * DEG) hint('Past balance point. Brake!', 0.3);
      else if (sim.inWheelie && hintTimer <= 0 && sim.wheelieDist > 10 && sim.wheelieDist < 14) hint('Nice! Feather the gas', 1.2);
    }

    draw();
    requestAnimationFrame(frame);
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const scale = Math.min(H / 6.5, W / 7.5);
    // After a crash, frame both the bike and the rider who came off it.
    if (rider) camFocus += ((sim.x + rider.x) / 2 + 1 - camFocus) * 0.08;
    else camFocus = sim.x;
    const camX = camFocus - (W * 0.32) / scale;
    camY += (terrain.height(camFocus) - camY) * 0.12;
    const groundLine = H * 0.7;
    const toScreenY = (y) => groundLine - (y - camY) * scale;
    const view = { w: W, h: H, scale, camX, toScreenY };

    R.drawSky(ctx, W, H, camX);
    R.drawGround(ctx, view, terrain);

    if (mode !== 'menu') {
      const bst = best(bike.id);
      if (sim.inWheelie && bst > 0) R.drawFlag(ctx, view, terrain, sim.wheelieStartX + bst, `Best ${bst.toFixed(0)} m`, '#3ddc84');
      if (sim.inWheelie || sim.status !== 'riding') {
        if (sim.wheelieStartX > 0 && sim.wheelieDist > 0) R.drawFlag(ctx, view, terrain, sim.wheelieStartX, 'Start', '#ffc93d');
      }
    }

    // bike
    const slope = Math.atan(terrain.slope(sim.x));
    let pitch = sim.theta;
    if (sim.status === 'crashed') pitch = Sim.CRASH_ANGLE + Math.min(1, sim.crashT * 1.6) * (Math.PI - 0.15 - Sim.CRASH_ANGLE);
    // While flipping over, raise the pivot so the upside-down bike rests on its seat and bars.
    const flipLift = sim.status === 'crashed' ? Math.max(0, -Math.cos(pitch)) * (bike.look.wheelRadius + 0.98) : 0;
    ctx.save();
    ctx.translate((sim.x - camX) * scale, toScreenY(terrain.height(sim.x) + flipLift));
    ctx.scale(scale, -scale);
    ctx.rotate(slope + pitch);
    R.drawBike(ctx, bike.look, { lean: sim.lean, wheelSpin: sim.x / bike.look.wheelRadius, rider: !rider });
    ctx.restore();

    if (rider) {
      ctx.save();
      ctx.translate((rider.x - camX) * scale, toScreenY(rider.y));
      ctx.scale(scale, -scale);
      ctx.rotate(rider.rot);
      const p = rider.pose, o = p.hip;
      ctx.translate(-o[0], -o[1]);
      R.drawRiderPose(ctx, bike.look, p);
      ctx.restore();
    }

    if (mode === 'play' || mode === 'results') {
      const r = Math.max(46, Math.min(70, W * 0.09));
      R.drawGauge(ctx, 16 + r * 1.15, H - (isTouch ? 130 : 24) - 6, r, Math.min(sim.theta, Math.PI / 2), Sim.balanceAngle(sim, handling), Sim.CRASH_ANGLE);
      $('hud-dist').textContent = `${sim.wheelieDist.toFixed(1)} m`;
      $('hud-speed').textContent = `${Math.round(sim.v * 3.6)} km/h`;
      $('hud-mph').textContent = `${Math.round(sim.v * 2.23694)} mph`;
    }
  }

  openMenu();
  requestAnimationFrame(frame);
})();
