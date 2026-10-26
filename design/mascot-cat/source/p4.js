
/* ============================ runtime ============================ */
const INST = [];
let rafId = 0, lastNow = 0, wakeTimer = 0;
const RM = matchMedia('(prefers-reduced-motion: reduce)');
let THEME = { shadowA: (a) => `rgba(110,62,30,${0.3 * a})`, ink: '#16123a' };
function readTheme() {
  const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
  const sh = v('--shadow') || 'rgba(110,62,30,.3)', m = sh.match(/rgba?\(([^)]+)\)/);
  const parts = m ? m[1].split(',').map((s) => parseFloat(s)) : [110, 62, 30, 0.3];
  const al = parts.length > 3 ? parts[3] : 1;
  THEME = { ink: v('--ink') || '#16123a', cushion: v('--cushion'), cushion2: v('--cushion-2'), cushionTop: v('--cushion-top'), cushionRim: v('--cushion-rim'),
    shadowA: (a) => `rgba(${parts[0]},${parts[1]},${parts[2]},${(al * a).toFixed(3)})` };
  for (const c of INST) c.renderNow();
}
// One shared loop. Still / frozen instances are skipped (they redraw only when something changes, plus a
// blink scheduled with a timeout), small mascots run at 30 fps, and nothing runs while the tab is hidden.
function loop(now) {
  rafId = 0;
  const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 1 / 60;
  lastNow = now;
  let active = false, wakeAt = Infinity;
  for (const c of INST) {
    if (!c.visible) continue;
    const r = c.tick(dt, now);
    if (r === true) active = true; else if (r) wakeAt = Math.min(wakeAt, r);
  }
  if (document.hidden) { lastNow = 0; return; }
  if (active) rafId = requestAnimationFrame(loop);
  else { lastNow = 0; if (wakeAt < Infinity) { clearTimeout(wakeTimer); wakeTimer = setTimeout(kick, Math.max(16, wakeAt - performance.now())); } }
}
function kick() { if (!rafId && !document.hidden && INST.some((c) => c.visible)) { clearTimeout(wakeTimer); lastNow = 0; rafId = requestAnimationFrame(loop); } }
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (rafId) cancelAnimationFrame(rafId); rafId = 0; lastNow = 0; clearTimeout(wakeTimer); } else kick(); });

const AUTO_W = {
  sit: (e) => ({ groom: 2, walk: 3.2, rub: 2, look: 1.5, flick: 1.2, stretch: 0.8, yawn: 0.7 + (1 - e) * 1.5, sleep: (1 - e) * 3.2, knead: 0.5 }),
  walk: () => ({ sit: 3, look: 1, rub: 1.5, groom: 1, stretch: 0.5, flick: 0.5 }),
  trot: () => ({ sit: 2, look: 1 }),
  rub: () => ({ sit: 3, groom: 1.5, walk: 1 }),
  groom: () => ({ sit: 2, walk: 1.5, yawn: 0.6, flick: 0.6 }),
  look: () => ({ sit: 1.5, walk: 2, groom: 0.8, flick: 0.6 }),
  flick: () => ({ sit: 2, walk: 1.5, groom: 0.8, look: 0.6 }),
  stretch: () => ({ walk: 2, sit: 1.5, yawn: 1 }),
  yawn: (e) => ({ sit: 1.5, sleep: (1 - e) * 2.5, groom: 1, walk: 0.8 }),
  sleep: () => ({ wake: 1 }),
  wake: () => ({ yawn: 4, groom: 1, sit: 1 }),
  knead: () => ({ sleep: 1.5, sit: 1 }),
  chase: () => ({ groom: 4, sit: 1.5, walk: 0.6 }), // displacement grooming after the hunt
  pet: () => ({ sit: 2, knead: 0.8, groom: 0.6 }),
  turn: () => ({ sit: 1 }), present: () => ({ sit: 1, walk: 1 })
};
// seconds each tail shape value takes to follow the pose (base first, then curl, then the tip)
const TAIL_LAG = { tailA: 0.12, tailRoot: 0.12, tailDX: 0.1, tailDY: 0.1, tailLen: 0.15, tailPuff: 0.15, tailCurl: 0.2, tailTip: 0.26, tailWave: 0.4, tailSpd: 0.4 };
const MASCOT_AUTO = { present: 6, groom: 1, yawn: 0.6, look: 1.2, knead: 0.5, flick: 1 };

class Cat {
  constructor(el, opts = {}) {
    this.el = el; el.catInstance = this; this.mode = opts.mode === 'mascot' ? 'mascot' : 'roam';
    this.behaviours = ['sit', 'walk', 'turn', 'trot', 'rub', 'groom', 'sleep', 'wake', 'stretch', 'yawn', 'chase', 'pet', 'knead', 'look', 'flick', 'present', 'jump'];
    this.moods = Object.keys(MOODS); this.gestures = Object.keys(GDUR);
    this.facing = opts.facing === 'left' ? 'left' : 'right';
    this.cv = document.createElement('canvas'); this.cv.className = 'cat-canvas'; this.cv.setAttribute('aria-hidden', 'true');
    el.appendChild(this.cv); this.g = this.cv.getContext('2d');
    if (this.mode === 'mascot') {
      if (opts.size) { el.style.width = opts.size + 'px'; el.style.height = opts.size + 'px'; }
      if (!el.hasAttribute('role')) el.setAttribute('role', 'img');
      if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', opts.label || 'AI Sel — boz-ağ təhlükəsizlik pişiyi');
    }
    this.clock = 0; this.timeT = 0; this.auto = this.mode === 'roam'; this.still = false; this.frozen = null;
    this.mood = 'idle'; this.moodFrom = 'idle'; this.moodT = -10; this.talking = false; this.gest = null;
    this.x = 0; this.th = this.mode === 'mascot' ? 0.8 : PI - 0.38; this.energy = 1; this.hist = [];
    this.lk = { x: 0, y: 0, turn: 0, pitch: 0 }; this.look = null;
    this.tagA = 0; this.tagW = 0; this.tagP = null; this.tagV = 0; this.glint = 0; this.spark = 0;
    this.nextBlink = 1.2; this.blinkAt = -10; this.nextTwitch = 3; this.twitchAt = -10; this.twitchK = 1;
    this.blinkWall = performance.now() + 1500; this.blinkStart = -1e9; this.wasBlink = false; this.stillLid = 0; this.acc = 0;
    this.pointer = null; this.pointerIn = false; this.speed = 0; this.fastT = 0; this.chaseN = 0; this.chaseCool = 0; this.lastMove = -10; this.demo = null; this.sleepPet = -10;
    this.visible = true; this.userSize = 0; this.dirty = true; this.onState = null; this._ls = [];
    this.tailS = null; this.tailPh = Math.random() * TAU; this.seed = Math.random() * 100; this.flickAt = -10; this.nextFlick = 2.5 + Math.random() * 4;
    this.resize();
    this.ro = new ResizeObserver(() => { this.resize(); this.renderNow(); });
    this.ro.observe(el);
    this.io = new IntersectionObserver((es) => { for (const e of es) this.visible = e.isIntersecting; if (this.visible) this.renderNow(); kick(); }, { rootMargin: '80px' });
    this.io.observe(el);
    if (this.mode === 'roam') { this.x = this.Wu * 0.7; this.bindRoam(); } else this.bindMascot();
    this.lastBase = null;
    this.start(this.mode === 'mascot' ? 'present' : 'sit');
    this.lastBase = sampleSegs(this.cur, 0, 0);
    INST.push(this);
    this.frame(0);
    kick();
  }
  on(target, type, fn, o) { target.addEventListener(type, fn, o); this._ls.push([target, type, fn, o]); }
  /* ---------- geometry ---------- */
  resize() {
    const r = this.el.getBoundingClientRect(), W = Math.max(1, r.width), H = Math.max(1, r.height);
    this.W = W; this.H = H; this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(W * this.dpr); this.cv.height = Math.round(H * this.dpr);
    this.lod = false; this.cap = false;
    if (this.mode === 'roam') {
      this.narrow = W < 560;
      // phones: a closer camera so the cat stays big (the stage is taller there and shows two pillars)
      this.s = this.userSize ? this.userSize / 105 : this.narrow ? Math.min((H / 560) * 2.75, W / 255) : (W / 1000) * 2.9;
      this.floor = H * 0.866; this.Wu = W / this.s;
    } else {
      const sz = Math.min(W, H); this.bust = sz < 80; this.lod = sz < 72; this.cap = sz < 130;
      const R = solve(at(PRESENT, 0, 0.8), 0);
      if (this.bust) { this.s = sz / 74; this.ox = W / 2 - R.head[0] * this.s; this.oy = H / 2 - (R.head[1] + 5) * this.s; } // head + collar + shield
      else {
        let x0 = 1e9, x1 = -1e9; const y0 = R.head[1] - 33, y1 = 1;
        for (const t of R.torso.concat(R.tail)) { x0 = Math.min(x0, t[0] - t[2]); x1 = Math.max(x1, t[0] + t[2]); }
        x0 = Math.min(x0, R.head[0] - 24); x1 = Math.max(x1, R.head[0] + 24);
        this.s = Math.min(W / (x1 - x0 + 10), H / (y1 - y0 + 8));
        this.ox = W / 2 - ((x0 + x1) / 2) * this.s; this.oy = H / 2 - ((y0 + y1) / 2) * this.s; this.cx = (x0 + x1) / 2;
      }
    }
    this.dirty = true;
  }
  clampX(x) { return clamp(x, 58, this.Wu - 58); }
  randX(x0) { for (let i = 0; i < 8; i++) { const x = lerp(62, this.Wu - 62, Math.random()); if (Math.abs(x - x0) > 90) return x; } return x0 > this.Wu / 2 ? this.Wu * 0.25 : this.Wu * 0.75; }
  colsU() {
    const sr = this.el.getBoundingClientRect();
    return [...this.el.querySelectorAll('.pillar')].map((el) => { const r = el.getBoundingClientRect(); return { el, w: r.width, x0: (r.left - sr.left) / this.s, x1: (r.right - sr.left) / this.s }; }).filter((c) => c.w > 0);
  }
  cushionU() { return { x: this.Wu * (this.narrow ? 0.5 : 0.285), h: 9 }; }
  curled() { const b = this.lastBase; return !!b && (b.curl > 0.25 || b.gy > 2); }
  /* ---------- behaviour control ---------- */
  start(name, o = {}) {
    if (!BEH[name]) name = 'sit';
    // anything but sleep from a curled / cushion pose first wakes: uncurl, stand, stretch, hop down
    if (name !== 'sleep' && name !== 'wake' && this.curled()) { o = { then: name, thenOpts: o }; name = 'wake'; }
    const f = BEH[name];
    if (this.lastBase) { this.x = this.lastBase.x; this.th = this.lastBase.theta; this.from = Object.assign({}, this.lastBase); }
    else this.from = null;
    this.blendT0 = this.clock; this.blendDur = name === 'chase' ? 0.22 : 0.45;
    const B = f(this, o, false);
    B.name = name; B.total = B.segs.reduce((a, s) => a + s.d, 0); B.t0 = this.clock;
    if (B.loopFrom != null) B.loopStart = B.segs.slice(0, B.loopFrom).reduce((a, s) => a + s.d, 0);
    this.cur = B;
    this.hist.unshift(name); this.hist.length = Math.min(this.hist.length, 2);
    if (this.onState) this.onState(B.name);
  }
  choose(n) {
    const W = (AUTO_W[n] || AUTO_W.sit)(this.energy); let tot = 0;
    for (const h of this.hist) if (W[h] != null) W[h] *= 0.15; // history damping: no ping-pong between two behaviours
    for (const k in W) tot += Math.max(0, W[k]);
    let r = Math.random() * tot;
    for (const k in W) { r -= Math.max(0, W[k]); if (r <= 0) return k; }
    return 'sit';
  }
  next() {
    const B = this.cur, n = B.name;
    if (B.chase && this.pointerIn && this.clock - this.lastMove < 0.6 && this.chaseN < 4 && this.clock > this.chaseCool && this.pointer) {
      this.chaseN++; return this.start('chase', { x: this.pointer.x, y: this.pointer.y });
    }
    if (n === 'sleep') this.energy = 1;
    if (B.then) {
      const o = Object.assign({}, B.thenOpts || {});
      if (B.then === 'chase') { if (!this.pointer || this.clock - this.lastMove > 1.5) return this.start('sit'); o.x = this.pointer.x; o.y = this.pointer.y; }
      return this.start(B.then, o);
    }
    if (!this.auto) {
      if (B.loopFrom != null) { this.cur.t0 += this.cur.total - this.cur.loopStart; return; }
      return this.start(this.mode === 'mascot' ? 'present' : 'sit');
    }
    if (this.mode === 'mascot') {
      if (n !== 'present') return this.start('present');
      let tot = 0; for (const k in MASCOT_AUTO) tot += MASCOT_AUTO[k];
      let r = Math.random() * tot; for (const k in MASCOT_AUTO) { r -= MASCOT_AUTO[k]; if (r <= 0) return this.start(k); }
      return this.start('present');
    }
    this.start(this.choose(n));
  }
  /* ---------- per frame ---------- */
  tick(dt, now) {
    if (this.frozen) { if (this.dirty) this.renderFrozen(); return false; }
    if (this.still) return this.stillTick(now);
    if (this.cap) { this.acc += dt; if (this.acc < 1 / 30 - 0.002) return true; dt = Math.min(0.05, this.acc); this.acc = 0; }
    this.frame(dt);
    return true;
  }
  stillTick(now) { // still / reduced motion: only blinks, drawn on demand
    if (now >= this.blinkWall) { this.blinkStart = now; this.blinkWall = now + 2600 + Math.random() * 4200; }
    const bt = (now - this.blinkStart) / 180, blinking = bt >= 0 && bt < 1;
    if (blinking || this.dirty || this.wasBlink) { this.stillLid = blinking ? Math.sin(PI * bt) : 0; this.frame(0); this.wasBlink = blinking; }
    return blinking ? true : this.blinkWall;
  }
  renderNow() { if (this.destroyed) return; if (this.frozen) this.renderFrozen(); else this.frame(0); }
  frame(dt) {
    if (this.frozen) { this.renderFrozen(); return; }
    this.clock += dt; const T = this.clock; this.timeT = T; this.dt = dt;
    let base;
    if (this.still) base = this.stillBase || this.lastBase;
    else {
      this.pointerLogic(dt);
      if (this.mode === 'roam' && this.cur.name !== 'sleep') this.energy = Math.max(0, this.energy - dt / 160);
      let tb = T - this.cur.t0;
      if (tb >= this.cur.total) { this.next(); tb = T - this.cur.t0; }
      base = sampleSegs(this.cur, tb, T);
      const bw = (T - this.blendT0) / this.blendDur;
      if (this.from && bw < 1) base = mix(this.from, base, sstep(bw));
    }
    this.lastBase = base;
    const p = this.overlay(Object.assign({}, base), T, dt, !this.still);
    this.draw(p, true);
    this.dirty = false;
  }
  pointerLogic(dt) {
    if (this.mode !== 'roam') return;
    if (this.demo) {
      const tau = this.clock - this.demo.t0;
      if (tau > this.demo.dur) { this.demo = null; this.pointerIn = false; this.el.classList.remove('toy'); }
      else if (tau >= 0) {
        const x = this.W * (0.5 + 0.36 * Math.sin(tau * 1.25 + this.demo.ph)), y = this.H * (0.64 + 0.1 * Math.sin(tau * 2.3));
        this.feed(x, y, performance.now() / 1000);
      }
    }
    this.speed *= Math.exp(-dt * 3);
    if (this.clock - this.lastMove > 4) this.chaseN = 0;
    const fast = this.pointerIn && this.speed > 650 && !!this.pointer;
    this.fastT = fast ? this.fastT + dt : Math.max(0, this.fastT - dt * 2);
    if (!fast || this.clock <= this.chaseCool || this.cur.chase || this.cur.name === 'wake') return;
    if (this.cur.name === 'sleep' && this.curled()) {
      // a sleeping cat only gets up for sustained play, and never in its first seconds of sleep
      const asleepFor = this.clock - this.cur.t0 - (this.cur.loopStart || 0);
      if (!(this.demo || (this.fastT > 1 && asleepFor > 6))) { if (this.clock - this.twitchAt > 1.2) { this.twitchAt = this.clock; this.twitchK = this.pointer.x < this.hit.hx ? -1 : 1; } return; }
    }
    this.chaseN++;
    if (this.chaseN > 4) { this.chaseN = 0; this.chaseCool = this.clock + 9; this.start('groom'); }
    else this.start('chase', { x: this.pointer.x, y: this.pointer.y });
  }
  gctx(base) { const R0 = solve(base, 0), k = nearFront(base.theta); return { S: R0.S, Hb: R0.Hb, k, kF: k === 'nf' ? 'ff' : 'nf', far: k === 'ff' ? 1 : 0, facing: faceDir(base.theta), mir: this.facing === 'left' && this.mode === 'mascot' ? -1 : 1 }; }
  moodPaws(p, B, name, w, T, live) { if (w > 0.02 && B && B.sitting && MOOD_PAWS[name]) MOOD_PAWS[name](p, w, this.gctx(p), T, live); }
  overlay(p, T, dt, live) {
    const mw = this.still ? 1 : sstep((T - this.moodT) / 0.35), busy = this.cur && this.cur.busy ? 0.35 : 1;
    if (this.moodFrom !== this.mood && mw < 1) p = mix(applyMood(Object.assign({}, p), this.moodFrom, busy, T, live), applyMood(Object.assign({}, p), this.mood, busy, T, live), mw);
    else p = applyMood(p, this.mood, busy, T, live);
    const mwt = (n) => (this.mood === n ? mw : 0) + (this.moodFrom === n && mw < 1 ? 1 - mw : 0);
    if (busy === 1) { this.moodPaws(p, this.cur, this.mood, mw, T, live); if (mw < 1) this.moodPaws(p, this.cur, this.moodFrom, 1 - mw, T, live); }
    this.fx = { confetti: mwt('celebrate'), think: mwt('think'), surprise: mwt('surprised') };
    if (live) {
      if (this.gest) { const u = (T - this.gest.t0) / this.gest.dur; if (u >= 1) this.gest = null; else GEST[this.gest.name](p, u, T - this.gest.t0, this.gest.ctx); }
      if (this.talking || mwt('talk') > 0.5) { p.mouth = Math.max(p.mouth, talkOpen(T)); p.headPitch += 0.05 * Math.sin(T * 4.7); p.earRot += 0.1; }
      // look-at
      let tx = 0, ty = 0, tt = 0, tp = 0;
      if (this.cur.look && this.look && T < this.look.until && this.hit) {
        const dx = this.look.x - this.hit.hx, dy = this.look.y - this.hit.hy, R = Math.max(120, this.hit.hr * 6);
        tx = clamp(dx / R, -1, 1); ty = clamp(dy / R, -1, 1); tt = -tx * 0.42 * (this.facing === 'left' ? -1 : 1); tp = ty * 0.3;
        if (this.facing === 'left') tx = -tx;
      }
      const k = 1 - Math.exp(-dt * 5);
      this.lk.x = lerp(this.lk.x, tx, k); this.lk.y = lerp(this.lk.y, ty, k); this.lk.turn = lerp(this.lk.turn, tt, k); this.lk.pitch = lerp(this.lk.pitch, tp, k);
      p.lookX += this.lk.x * 0.9; p.lookY += this.lk.y * 0.8; p.lookTurn += this.lk.turn; p.headPitch += this.lk.pitch;
      // a click while asleep: purr and flick an ear in place, no getting up
      const sp = (T - this.sleepPet) / 2.6;
      if (sp >= 0 && sp < 1) { const e = env(sp, 0, 0.08, 0.75, 1); p.purr = Math.max(p.purr, e); p.smile = lerp(p.smile, 0.85, e); p.blush = lerp(p.blush, 1, e); p.earR -= 0.6 * env(sp, 0.05, 0.1, 0.16, 0.22); p.tailTip += 14 * e * Math.sin(T * 3); p.nfa += 0.2 * e; }
      // breathing + purr
      const sl = p.zzz > 0.5;
      p.bodyR *= 1 + (sl ? 0.03 : 0.015) * Math.sin((TAU * T) / (sl ? 4.2 : 3.1));
      if (p.purr > 0.05) { p.headDY += Math.sin(T * 88) * 0.14 * p.purr; p.bodyR *= 1 + 0.004 * Math.sin(T * 93) * p.purr; }
      // ear twitch
      if (T > this.nextTwitch) { this.twitchAt = T; this.twitchK = Math.random() < 0.5 ? -1 : 1; this.nextTwitch = T + 3 + Math.random() * 6; }
      const tw = (T - this.twitchAt) / 0.24;
      if (tw >= 0 && tw < 1) { const v = Math.sin(PI * tw) * 0.55; if (this.twitchK < 0) p.earL -= v; else p.earR -= v; p.whiskT += 0.4 * Math.sin(PI * tw * 2); }
      this.glint = Math.max(p.glint, seg(fract(T / 5.5), 0, 0.22) * (fract(T / 5.5) < 0.22 ? 1 : 0));
      this.spark = Math.max(hump(fract(T / 5.5), 0.06, 0.2) * 0.9, p.glint > 0.05 ? hump(p.glint, 0.2, 1) : 0);
      // blinks
      if (T > this.nextBlink) { this.blinkAt = T; this.nextBlink = T + 2.2 + Math.random() * 4.2; }
      const bt = (T - this.blinkAt) / 0.18;
      if (bt >= 0 && bt < 1) p.lid = Math.max(p.lid, Math.sin(PI * bt));
    } else if (this.still) p.lid = Math.max(p.lid, this.stillLid);
    return this.tailLive(p, T, dt, live);
  }
  // The tail's secondary motion. Its shape follows the pose through a short low-pass, the base faster than
  // the tip, so a mood, gesture or behaviour change swings it with follow-through instead of jumping; the
  // sway phase is accumulated, so it stays continuous whatever pose blends do to tailSpd; and a relaxed
  // tip flick (a quick curl, a slow release) comes every few seconds. Still: the pose's shape, no motion.
  tailLive(p, T, dt, live) {
    if (!this.tailS || !live) {
      if (!this.tailS) this.tailS = {};
      for (const k in TAIL_LAG) this.tailS[k] = p[k];
      p.tailPh = this.tailPh;
      return p;
    }
    const s = this.tailS;
    for (const k in TAIL_LAG) { s[k] = lerp(s[k], p[k], 1 - Math.exp(-dt / TAIL_LAG[k])); p[k] = s[k]; }
    this.tailPh += dt * PI * TAIL_RATE * p.tailSpd * (1 + 0.3 * noise(T * 0.23 + this.seed));
    p.tailPh = this.tailPh;
    if (T > this.nextFlick) { this.flickAt = T; this.nextFlick = T + 4.5 + Math.random() * 6; }
    const ft = T - this.flickAt;
    if (ft >= 0 && ft < 1) p.tailFlick = Math.max(p.tailFlick, (p.zzz > 0.5 ? 0.45 : 1) * (ft < 0.22 ? sstep(ft / 0.22) : 1 - sstep((ft - 0.22) / 0.78)));
    return p;
  }
  overlayFrozen(p, T, o) {
    const m = o.mood || this.mood, B = this.frozen.B, busy = B.busy ? 0.35 : 1;
    p = applyMood(p, m, busy, T, false);
    if (busy === 1) this.moodPaws(p, B, m, 1, T, false);
    this.fx = { confetti: m === 'celebrate' ? 1 : 0, think: m === 'think' ? 1 : 0, surprise: m === 'surprised' ? 1 : 0 };
    if (o.gesture) { const n = GALIAS[o.gesture] || o.gesture; if (GEST[n] && n[0] !== '_') { const u = clamp(o.gt == null ? 0.5 : +o.gt, 0, 0.999); GEST[n](p, u, u * (GDUR[n] || 1.6), this.gctx(p)); } }
    if (o.talking || m === 'talk') { let t = T, v = talkOpen(t); for (let i = 0; i < 200 && v < 0.42; i++) { t += 0.013; v = talkOpen(t); } p.mouth = Math.max(p.mouth, v); }
    this.glint = Math.max(0.62, p.glint); this.spark = 0.7;
    return p;
  }
  /* ---------- the collar tag: damped pendulum, clamped so the check always reads ---------- */
  tagGeo(p, R) {
    const [ax0, ay0] = tagAnchor(R.o), rr = p.headRoll * D2R, hs = p.headScale;
    const ax = R.head[0] + (ax0 * Math.cos(rr) - ay0 * Math.sin(rr)) * hs, ay = R.head[1] + (ax0 * Math.sin(rr) + ay0 * Math.cos(rr)) * hs;
    return { wx: (this.mode === 'roam' ? p.x : 0) + ax * (this.facing === 'left' ? -1 : 1), hang: -rr, room: -p.gy - ay };
  }
  tagStep(tg, dt) {
    if (this.tagP != null && dt > 0) {
      const v = (tg.wx - this.tagP) / dt, acc = clamp((v - this.tagV) / dt, -4000, 4000);
      this.tagV = v;
      this.tagW += (-150 * Math.sin(this.tagA - tg.hang) + acc * 0.012 * (this.facing === 'left' ? -1 : 1) - 5.5 * this.tagW) * dt;
      this.tagA += this.tagW * dt;
      if (Math.abs(this.tagA - tg.hang) > 0.5) { this.tagA = tg.hang + Math.sign(this.tagA - tg.hang) * 0.5; this.tagW *= -0.3; }
    } else { this.tagA = tg.hang; this.tagW = 0; this.tagV = 0; }
    this.tagP = tg.wx;
  }
  /* ---------- drawing ---------- */
  draw(p, live) {
    const g = this.g, s = this.s, d = this.dpr, mir = this.facing === 'left' && this.mode === 'mascot';
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.cv.width, this.cv.height);
    if (this.mode === 'roam') this.drawScene(g);
    const R = solve(p, this.timeT);
    const ox = this.mode === 'roam' ? p.x * s : mir ? this.W - this.ox : this.ox, oy = this.mode === 'roam' ? this.floor : this.oy;
    const tg = this.tagGeo(p, R);
    if (live && !this.still && this.dt) this.tagStep(tg, this.dt);
    else if (live) { this.tagA = tg.hang; this.tagW = 0; this.tagP = null; }
    const tagS = this.lod ? 1.55 : 1, tagLen = 13 * tagS * p.headScale;
    let tagA = clamp(this.tagA, tg.hang - 0.5, tg.hang + 0.5), tagSq = 1;
    if (tg.room < tagLen) { tagSq = clamp(tg.room / tagLen, 0.5, 1); tagA = lerp(tg.hang, tagA, tagSq * tagSq); } // chin on the floor: tuck it face-on
    g.setTransform(mir ? -d * s : d * s, 0, 0, d * s, d * ox, d * oy);
    const fz = this.frozen, B = fz ? fz.B : this.cur;
    let contact = null;
    if (this.mode === 'roam' && B && B.edge != null && p.colPush > 0.05) {
      const ex = B.edge - p.x, dir = ex >= 0 ? 1 : -1;
      let cy = R.head[1];
      if (Math.abs(R.head[0] - ex) > 30) { let best = 1e9; for (const t of R.torso) { const dd = Math.abs(t[0] - ex); if (dd < best) { best = dd; cy = t[1]; } } }
      contact = { x: ex, y: cy, a: clamp((p.colPush - 0.1) / 0.6), dir };
    }
    const st = { ow: Math.max(0.85, 0.62 / s) * (this.lod ? 1.3 : 1), px: s * d, lod: this.lod, eyeS: this.lod ? 1.2 : 1, tagS, tagSq, mirror: mir,
      T: this.timeT, tagA, glint: this.glint, spark: this.spark, shadowA: THEME.shadowA, ink: THEME.ink, contact,
      confetti: this.fx ? this.fx.confetti : 0, think: this.fx ? this.fx.think : 0, surprise: this.fx ? this.fx.surprise : 0 };
    drawCat(g, R, p, st);
    // hit box (stage px): torso and head for pokes, the full extent for framing
    const sx = mir ? -s : s, X = (u) => ox + u * sx;
    let tx0 = 1e9, tx1 = -1e9, bx0 = 1e9, bx1 = -1e9, by0 = R.head[1] - 34, by1 = -p.gy + 2;
    for (const t of R.torso) { tx0 = Math.min(tx0, t[0] - t[2]); tx1 = Math.max(tx1, t[0] + t[2]); }
    bx0 = Math.min(tx0, R.head[0] - 26); bx1 = Math.max(tx1, R.head[0] + 26);
    for (const t of R.tail) { bx0 = Math.min(bx0, t[0] - t[2]); bx1 = Math.max(bx1, t[0] + t[2]); by0 = Math.min(by0, t[1] - t[2]); }
    for (const L of R.legs) { bx0 = Math.min(bx0, L.P[0] - 7); bx1 = Math.max(bx1, L.P[0] + 7); by0 = Math.min(by0, L.P[1] - 7); }
    const hx = X(R.head[0]);
    this.hit = { hx, hy: oy + R.head[1] * s, hr: 24 * s, x0: Math.min(X(tx0), X(tx1)), x1: Math.max(X(tx0), X(tx1)), y0: oy + (R.head[1] - 30) * s, y1: oy + by1 * s,
      bx0: Math.min(X(bx0), X(bx1)), bx1: Math.max(X(bx0), X(bx1)), by0: oy + by0 * s, by1: oy + by1 * s };
    if (this.mode === 'roam') {
      if (fz && fz.B.chase) this.drawToy(g, fz.B.ctx.tx * s, this.floor - fz.B.ctx.ty * s);
      else if (!fz && this.pointerIn && this.pointer && !this.still) this.drawToy(g, this.pointer.x, this.pointer.y);
      this.applyColumn(p, B);
    }
  }
  drawScene(g) {
    const d = this.dpr, s = this.s, cu = this.cushionU(), t = THEME;
    g.setTransform(d * s, 0, 0, d * s, d * cu.x * s, d * this.floor);
    const rx = CUSH_RX, h = cu.h;
    g.save(); g.scale(1, 0.16);
    const sg = g.createRadialGradient(0, 0, 0, 0, 0, rx + 10); sg.addColorStop(0, t.shadowA(0.9)); sg.addColorStop(1, t.shadowA(0));
    g.fillStyle = sg; g.beginPath(); g.arc(0, 4, rx + 10, 0, TAU); g.fill(); g.restore();
    const body = new Path2D();
    body.moveTo(-rx, -h); body.bezierCurveTo(-rx - 3, -h * 0.4, -rx + 4, 1, -rx * 0.6, 1.2); body.lineTo(rx * 0.6, 1.2); body.bezierCurveTo(rx - 4, 1, rx + 3, -h * 0.4, rx, -h); body.closePath();
    const bg = g.createLinearGradient(0, -h, 0, 2); bg.addColorStop(0, t.cushion || '#8d85ec'); bg.addColorStop(1, t.cushion2 || '#6c63d9');
    g.fillStyle = bg; g.fill(body);
    g.fillStyle = t.cushionTop || '#aba5f5'; g.beginPath(); g.ellipse(0, -h, rx, 8, 0, 0, TAU); g.fill();
    g.strokeStyle = t.cushionRim || '#c9c5fa'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(0, -h, rx - 0.7, 7.3, 0, 0, TAU); g.stroke();
    g.setLineDash([2.2, 2.4]); g.lineWidth = 0.8; g.beginPath(); g.ellipse(0, -h, rx * 0.78, 5.2, 0, 0, TAU); g.stroke(); g.setLineDash([]);
  }
  drawToy(g, x, y) {
    const d = this.dpr, k = Math.max(0.55, this.s / 2.5), T = this.timeT;
    g.setTransform(d * k, 0, 0, d * k, d * x, d * y);
    g.strokeStyle = 'rgba(120,96,86,.55)'; g.lineWidth = 1.3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, -2); g.quadraticCurveTo(10, -46, 30, -96); g.stroke();
    g.rotate(Math.sin(T * 3.1) * 0.3);
    g.fillStyle = '#4f46e5'; g.beginPath(); g.arc(0, -2, 2.4, 0, TAU); g.fill();
    const fe = (rot, len, col) => { g.save(); g.rotate(rot); g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.42, len * 0.3, len * 0.12, len); g.quadraticCurveTo(-len * 0.2, len * 0.45, 0, 0); g.fill(); g.strokeStyle = 'rgba(120,50,10,.45)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.1, len * 0.5, len * 0.1, len * 0.95); g.stroke(); g.restore(); };
    fe(-0.35, 24, '#ff7a1a'); fe(0.25, 20, '#ffb37a'); fe(0.05, 15, '#ff9a4d');
  }
  // the touched pillar reacts: it leans and slides a little away from the cat (onRub hook for host pages)
  applyColumn(p, B) {
    if (this.mode !== 'roam') return;
    const els = this.el.querySelectorAll('.pillar');
    els.forEach((el) => {
      const on = B && B.colEl === el ? p.colPush : 0, dir = B && B.edge != null ? (B.edge >= p.x ? 1 : -1) : 1;
      el.style.setProperty('--wob', (on * 3.2 * dir).toFixed(3));
      el.style.setProperty('--push', (on * 4 * dir).toFixed(2));
      el.style.setProperty('--press', on.toFixed(3));
      if (this.onRub && on > 0.01) this.onRub(el, on);
    });
  }
  /* ---------- input ---------- */
  feed(x, y, now) {
    if (this.pointer) { const dt = Math.max(0.008, now - this.pointer.t); const v = Math.hypot(x - this.pointer.x, y - this.pointer.y) / dt; this.speed = lerp(this.speed, Math.min(v, 5000), 0.4); }
    this.pointer = { x, y, t: now }; this.pointerIn = true; this.lastMove = this.clock;
    if (!this.still) this.el.classList.add('toy');
    this.look = { x, y, until: this.clock + 2.5 };
    const c = this.cur && this.cur.chase ? this.cur.ctx : null;
    if (c && !c.locked) { c.tx = this.clampX(x / this.s); c.ty = (this.floor - y) / this.s; }
    kick();
  }
  hitTest(x, y) { const h = this.hit; if (!h) return false; return Math.hypot(x - h.hx, y - h.hy) < h.hr * 1.3 || (x > h.x0 && x < h.x1 && y > h.y0 && y < h.y1); }
  bindRoam() {
    const el = this.el;
    const loc = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    this.on(el, 'pointermove', (e) => { const [x, y] = loc(e); this.feed(x, y, performance.now() / 1000); });
    this.on(el, 'pointerdown', (e) => { const [x, y] = loc(e); this.feed(x, y, performance.now() / 1000); this.speed = 0; if (this.hitTest(x, y)) this.poke(); });
    this.on(el, 'pointerleave', () => { this.pointerIn = false; el.classList.remove('toy'); });
    this.on(el, 'keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.poke(); } });
  }
  bindMascot() {
    this.on(window, 'pointermove', (e) => { const r = this.el.getBoundingClientRect(); this.look = { x: e.clientX - r.left, y: e.clientY - r.top, until: this.clock + 2.5 }; }, { passive: true });
    this.on(this.el, 'pointerdown', () => this.poke());
  }
  /* ---------- public API ---------- */
  do(name, o = {}) {
    if (!BEH[name]) return false;
    if (this.frozen) this.resume();
    if (this.still && !RM.matches) this.setStill(false);
    if (name === 'pet') { this.poke(); return true; }
    if (name === 'chase' && this.mode === 'roam' && o.x == null) {
      const wait = this.curled() ? (this.start('wake'), this.cur.total) : 0;
      this.demo = { t0: this.clock + wait, dur: 5.5, ph: this.x / this.Wu > 0.5 ? PI : 0 }; this.chaseN = 0; this.chaseCool = 0; kick(); return true;
    }
    this.start(name, Object.assign({}, o));
    kick();
    return true;
  }
  setAuto(b) { this.auto = !!b; if (this.onState) this.onState(this.cur.name); }
  getAuto() { return this.auto; }
  setMood(m) { if (!MOODS[m] || m === this.mood) return; this.moodFrom = this.mood; this.mood = m; this.moodT = this.clock; this.dirty = true; this.renderNow(); kick(); }
  getMood() { return this.mood; }
  setTalking(b) { this.talking = !!b; this.dirty = true; kick(); }
  play(gname) {
    const n = GALIAS[gname] || gname; if (!GEST[n] || n[0] === '_') return false;
    if (this.frozen) this.resume();
    if (this.still) return false;
    this.gest = { name: n, t0: this.clock, dur: GDUR[n] || 1.6, ctx: this.gctx(this.lastBase || sitBase(this)) };
    kick();
    return true;
  }
  lookAt(x, y) { const r = this.el.getBoundingClientRect(); this.look = { x: x - r.left, y: y - r.top, until: this.clock + 3 }; kick(); }
  poke() {
    if (this.frozen) this.resume();
    if (this.still) return;
    if (this.cur && this.cur.name === 'sleep' && this.curled()) { this.sleepPet = this.clock; kick(); return; }
    this.start('pet'); kick();
  }
  setStill(b) {
    b = !!b; if (b === this.still) return;
    this.still = b;
    if (b) { this.stillBase = Object.assign({}, this.lastBase || sampleSegs(this.cur, 0, 0)); this.el.classList.remove('toy'); this.moodFrom = this.mood; }
    else { this.stillBase = null; this.start(this.curled() ? 'sleep' : this.mode === 'mascot' ? 'present' : 'sit'); }
    this.dirty = true; this.renderNow(); kick();
  }
  isStill() { return this.still; }
  get state() { return { behaviour: this.cur ? this.cur.name : null, mood: this.mood, auto: this.auto, still: this.still, talking: this.talking }; }
  setSize(px) {
    px = +px || 0;
    if (this.mode === 'mascot') { if (px > 0) { this.el.style.width = px + 'px'; this.el.style.height = px + 'px'; this.el.style.setProperty('--sz', px); } }
    else this.userSize = px;
    this.resize(); this.renderNow();
  }
  renderAt(name, t, o = {}) {
    const f = BEH[name]; if (!f) throw new Error('unknown behaviour: ' + name);
    const sx = this.x, sth = this.th, sctx = this.chaseCtx;
    const B = f(this, o, true); B.name = name; B.total = B.segs.reduce((a, s) => a + s.d, 0);
    this.x = sx; this.th = sth; if (!B.chase) this.chaseCtx = sctx;
    this.frozen = { name, t: clamp(+t || 0), o, B };
    this.renderFrozen();
  }
  renderFrozen() {
    const fz = this.frozen; if (!fz) return;
    const tb = fz.t * fz.B.total * 0.9999, T = 3 + tb;
    // deterministic tag: replay the pendulum at a fixed 60 Hz over the last 2.5 s of the behaviour
    this.tagP = null; this.tagA = 0; this.tagW = 0;
    for (let t = Math.max(0, tb - 2.5); t < tb; t += 1 / 60) { const q = sampleSegs(fz.B, t, 3 + t); this.tagStep(this.tagGeo(q, solve(q, 3 + t)), 1 / 60); }
    this.timeT = T;
    const p = this.overlayFrozen(sampleSegs(fz.B, tb, T), T, fz.o);
    fz.p = p;
    this.draw(p, false);
    this.dirty = false;
  }
  resume() {
    const fz = this.frozen; if (!fz) return;
    this.frozen = null;
    if (fz.p) { this.lastBase = Object.assign({}, fz.p); }
    this.applyColumn(at(STAND, 0, 0), null);
    this.start(this.curled() ? 'sleep' : this.mode === 'mascot' ? 'present' : 'sit');
    kick();
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true; this.ro.disconnect(); this.io.disconnect();
    for (const [t, ty, fn, o] of this._ls) t.removeEventListener(ty, fn, o);
    const i = INST.indexOf(this); if (i >= 0) INST.splice(i, 1);
    this.cv.remove(); delete this.el.catInstance;
  }
}

function createCat(el, opts) { return new Cat(el, opts || {}); }

/* ============================ page wiring ============================ */
readTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);
new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
window.createCat = createCat;
const stage = document.getElementById('stage');
const cat = stage ? createCat(stage, { mode: 'roam' }) : null;
window.cat = cat;
const mascots = [...document.querySelectorAll('.mbox')].map((el) => createCat(el, { mode: 'mascot', size: +el.dataset.size }));
window.catMascots = mascots;
const all = () => [cat, ...mascots].filter(Boolean);
const MOOD_AZ = { idle: 'Sakit', talk: 'Danışan', happy: 'Şad', think: 'Düşünür', alert: 'Ayıq', sad: 'Kədərli', celebrate: 'Bayram', surprised: 'Təəccüb', proud: 'Qürurlu', curious: 'Maraqlı', worried: 'Narahat', excited: 'Həyəcanlı', sleepy: 'Yuxulu', laughing: 'Gülür' };
const GEST_AZ = { wave: 'Salam', nod: 'Hə', shake: 'Yox', cheer: 'Alqış', 'point-left': 'Sola', 'point-right': 'Sağa', 'point-down': 'Aşağı', shrug: 'Çiyin çək', 'lean-in': 'Yaxınlaş', 'shield-up': 'Qalxan', bow: 'Təzim', think: 'Fikirləş' };
const rowMood = document.getElementById('rowMood'), rowGest = document.getElementById('rowGest');
if (rowMood) for (const m of Object.keys(MOODS)) {
  const b = document.createElement('button'); b.className = 'btn chip'; b.textContent = MOOD_AZ[m] || m; b.dataset.mood = m; b.setAttribute('aria-pressed', m === 'idle' ? 'true' : 'false');
  b.addEventListener('click', () => { all().forEach((c) => c.setMood(m)); rowMood.querySelectorAll('[data-mood]').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); });
  rowMood.appendChild(b);
}
if (rowGest) for (const gname of Object.keys(GDUR)) {
  const b = document.createElement('button'); b.className = 'btn chip'; b.textContent = GEST_AZ[gname] || gname;
  b.addEventListener('click', () => all().forEach((c) => c.play(gname)));
  rowGest.appendChild(b);
}
document.querySelectorAll('[data-do]').forEach((b) => b.addEventListener('click', () => { if (cat) cat.do(b.dataset.do); }));
const bAuto = document.getElementById('bAuto'), bTalk = document.getElementById('bTalk'), bStill = document.getElementById('bStill');
if (bAuto) bAuto.addEventListener('click', () => { if (!cat) return; cat.setAuto(!cat.auto); bAuto.setAttribute('aria-pressed', String(cat.auto)); });
if (bTalk) bTalk.addEventListener('click', () => { const on = bTalk.getAttribute('aria-pressed') !== 'true'; all().forEach((c) => c.setTalking(on)); bTalk.setAttribute('aria-pressed', String(on)); });
let prevAuto = true;
if (bStill) bStill.addEventListener('click', () => { const on = !cat.isStill(); all().forEach((c) => c.setStill(on)); if (on) { prevAuto = cat.auto; cat.setAuto(false); } else if (!RM.matches) cat.setAuto(prevAuto); bStill.setAttribute('aria-pressed', String(on)); if (bAuto) bAuto.setAttribute('aria-pressed', String(cat.auto)); });
if (cat) cat.onState = (n) => { document.querySelectorAll('[data-do]').forEach((b) => b.classList.toggle('now', b.dataset.do === n)); if (bStill) bStill.setAttribute('aria-pressed', String(cat.still)); };
// theme: auto / light / dark (sets data-theme on the root element)
document.querySelectorAll('[data-theme-set]').forEach((b) => b.addEventListener('click', () => {
  const v = b.dataset.themeSet;
  if (v === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v);
  document.querySelectorAll('[data-theme-set]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
}));
function applyRM() {
  if (RM.matches) { all().forEach((c) => c.setStill(true)); if (cat) cat.setAuto(false); }
  if (bStill && cat) bStill.setAttribute('aria-pressed', String(cat.isStill()));
  if (bAuto && cat) bAuto.setAttribute('aria-pressed', String(cat.auto));
}
applyRM();
RM.addEventListener('change', applyRM);
})();
</script>
