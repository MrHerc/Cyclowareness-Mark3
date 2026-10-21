
/* ============================ poses (data) ============================ */
const STAND = P({ sag: 5, arch: 3.5 });
const SIT = P({ hipY: 12, shY: 41, bodyL: 40, shift: -2, arch: 5, sag: 0.5, neckA: 78, neckL: 16, faceCam: 0.72,
  nfx: 14, ffx: 16.5, nhx: -2, nha: 1.45, fhx: 0.5, fha: 1.45,
  tailA: -70, tailCurl: 9, tailTip: 40, tailWave: 3, tailSpd: 0.9, tailFront: 1, earRot: 0.3, smile: 0.4 });
const PRESENT = Object.assign({}, SIT, { theta: 0.8, faceCam: 0.85, legZ: 6.5, nfx: 14, ffx: 14, nhx: -2, fhx: -2, smile: 0.45 });
const LOAF = P({ hipY: 12, shY: 14, bodyL: 44, arch: 7, sag: 0, neckA: 50, neckL: 13, faceCam: 0.7, lid: 0.6,
  nfx: 22, nfy: 0, nfa: -0.2, ffx: 24, ffy: 0.5, nhx: -6, nha: 1.5, fhx: -4, fhy: 0.5, fha: 1.5,
  tailA: -172, tailCurl: 1.6, tailTip: 42, tailWave: 1.5, tailSpd: 0.6, tailFront: 1, earRot: -0.1 });
// the owner's photo: lying on the side in a C, back and bull's-eye on top, white belly and hind legs
// toward the viewer with the toe beans showing, front paws reaching to them, head tucked, tail round the front
const CURL = P({ hipY: 12, shY: 14, bodyL: 40, shift: -4, arch: 9, sag: 0, curl: 1, bodyR: 1.02, neckA: -10, neckL: 17, faceCam: 0.82,
  headRoll: -14, headPitch: 0.85, headScale: 0.86, headDY: 2, lid: 1, earRot: -0.3, smile: 0.35, blush: 0.8,
  elbow: 1, nfx: 13, nfy: 1, nfa: 3.14, ffx: 16, ffy: 1, ffa: 3.0, nhx: -6, nhy: 15, nha: 2.6, fhx: 1, fhy: 15, fha: 2.4, legZ: 7,
  sole: 1, beansH: 1, splay: 0.4,
  tailA: -178, tailCurl: 1.2, tailTip: 60, tailWave: 1.2, tailSpd: 0.5, tailFront: 0.5, tailLen: 0.9, tailDX: 5, tailDY: 2 });
const CROUCH = P({ hipY: 24, shY: 19, bodyL: 48, shift: -2, arch: 1, sag: -1, neckA: 18, neckL: 14, faceCam: 0.2, headPitch: -0.1,
  earRot: 1, pupil: 1, eyeOpen: 1.1, whisk: 1, smile: 0,
  nfx: 24, ffx: 26, nhx: -17, nha: 0.9, fhx: -15, fha: 0.9, tailA: -8, tailCurl: 1.5, tailTip: 18, tailWave: 3, tailSpd: 3.2 });
const POUNCE = P({ hipY: 30, shY: 34, bodyL: 54, arch: -3, neckA: 30, neckL: 15, faceCam: 0.18, earRot: 0.9, pupil: 1, eyeOpen: 1.15, mouth: 0.18,
  nfx: 60, nfy: 17, nfa: -0.3, ffx: 55, ffy: 14, ffa: -0.3, pawFront: 1, nhx: -42, nhy: 6, nha: 1.3, fhx: -38, fhy: 4, fha: 1.2,
  tailA: 20, tailCurl: -1, tailTip: -10, splay: 1, smile: 0 });
const LAND = P({ hipY: 31, shY: 23, bodyL: 50, shift: 2, arch: 2, neckA: 22, neckL: 14, faceCam: 0.22, headPitch: 0.35, earRot: 0.8, pupil: 0.9,
  nfx: 30, ffx: 32, nhx: -20, nha: 0.6, fhx: -18, fha: 0.6, tailA: 30, tailCurl: -2, tailTip: 10, tailWave: 6, tailSpd: 3, smile: 0.2 });
// play-bow stretch: forearms flat on the floor, chest low, rump and tail high, eyes shut
const BOW = P({ shY: 13, hipY: 40, bodyL: 51, shift: -3, arch: -5, sag: -1, neckA: 70, neckL: 12, headPitch: -0.3, faceCam: 0.55, lid: 1, mouth: 0.1, earRot: -0.35,
  nfx: 44, nfy: -2.5, nfa: 0.05, ffx: 47, ffy: -2.5, ffa: 0.05, nhx: -22, nha: 0.15, fhx: -20, fha: 0.15,
  tailA: 78, tailCurl: -7, tailTip: -24, tailWave: 2.5, tailSpd: 0.6, splay: 1 });
// back-leg stretch: body length kept near the stand, the near hind leg reaching back, tail in a low curve
const BACK = P({ shY: 37, hipY: 32, bodyL: 50, shift: 3, arch: -1, neckA: 46, neckL: 15, headPitch: -0.3, faceCam: 0.5, lid: 0.7,
  nfx: 30, ffx: 32, nhx: -38, nhy: 7, nha: 1.2, fhx: -21, fha: 0.3,
  tailA: 34, tailCurl: -5.5, tailTip: -14, tailWave: 3, tailSpd: 0.55, splay: 0.6 });
const RUB = P({ hipY: 38, shY: 39, arch: 6, neckA: 36, neckL: 15, faceCam: 0.3, headRoll: -8, lid: 0.5, lidLow: 0.35, earRot: -0.05, smile: 0.7, blush: 0.95,
  tailA: 92, tailCurl: -1.5, tailTip: -34, tailQuiver: 1, tailWave: 1.5, tailSpd: 1, purr: 0.5 });
const KNEADST = P({ hipY: 36, shY: 33, arch: 2, neckA: 40, faceCam: 0.6, lid: 0.62, lidLow: 0.4, smile: 0.7, purr: 0.8, tailA: 80, tailCurl: -4, tailTip: -25 });

/* ============================ gaits: distance-driven footfalls ============================ */
// lateral-sequence walk (near hind → near fore → far hind → far fore), trot pairs the diagonals
const GAITS = {
  walk: { duty: 0.62, S: 26, T: 1.05, lf: 6.5, lh: 5.5, off: { nh: 0, nf: 0.75, fh: 0.5, ff: 0.25 } },
  trot: { duty: 0.42, S: 30, T: 0.5, lf: 8, lh: 7, off: { nh: 0, ff: 0.02, fh: 0.5, nf: 0.52 } }
};
// Plan one leg's footholds for a walk of Phi gait cycles. Stance paws are locked to the floor, the first step
// leaves from the standing pose and the last lands back on it, so a walk never slides its feet.
function planLeg(off, G, Phi) {
  const cyc = G.S / G.duty, sw = 1 - G.duty, D = Phi * cyc, swings = [];
  let x = 0, n = Math.ceil(off + 0.14);
  for (let guard = 0; guard < 500; guard++) {
    const td = n - off, reach = (x + G.S * 0.75) / cyc; // phase at which this planted paw is too far behind
    const lift = Math.max(swings.length ? -1e9 : 0, Math.min(td - sw, reach));
    if (td <= Phi) { const xb = td * cyc + G.S / 2; swings.push({ a: lift, b: td, xa: x, xb }); x = xb; n++; }
    else { if (lift < Phi - 0.12) { swings.push({ a: lift, b: Phi, xa: x, xb: D }); x = D; } break; }
  }
  return { swings, end: x - D };
}
function legAt(plan, ph, cyc, S) {
  let x = 0;
  for (const s of plan.swings) {
    if (ph < s.a) break;
    if (ph <= s.b) { const f = (ph - s.a) / Math.max(1e-4, s.b - s.a); return { dx: lerp(s.xa, s.xb, eIO(f)) - ph * cyc, h: Math.sin(PI * f) * clamp((s.xb - s.xa) / S + 0.25, 0.3, 1) }; }
    x = s.xb;
  }
  return { dx: x - ph * cyc, h: 0 };
}
function gaitPose(base, ph, amp, G, plans, sgn = 1) { // sgn −1: stepping backwards
  const p = Object.assign({}, base), cyc = G.S / G.duty;
  for (const k of LEGS) {
    const r = legAt(plans[k], ph, cyc, G.S);
    p[k + 'x'] += sgn * r.dx; p[k + 'y'] += r.h * (k[1] === 'f' ? G.lf : G.lh);
    if (k[1] === 'f') p[k + 'a'] -= r.h * 1.15; else p[k + 'a'] += r.h * 0.55;
  }
  const b = Math.cos(ph * TAU * 2), b2 = Math.cos(ph * TAU * 2 + 1.3);
  p.hipY -= 0.8 * amp * b; p.shY -= 0.6 * amp * b2; p.headDY += 0.6 * amp * b2;
  // shoulder blades and hips rise in turn with the stride
  p.blade = 1.8 * amp * Math.max(0, Math.sin(TAU * (ph + 0.05)));
  p.hipBump = 1.5 * amp * Math.max(0, Math.sin(TAU * (ph + 0.55)));
  p.tailWave = lerp(base.tailWave, base.tailWave * 0.6 + 2, amp);
  p.faceCam = lerp(base.faceCam, 0.16, Math.min(1, amp * 1.4)); // the head points where the cat is going
  return p;
}
function plansFor(G, Phi) { const o = {}; for (const k of LEGS) o[k] = planLeg(G.off[k], G, Phi); return o; }
// staged settle: the paws that ended away from the standing pose step back one by one
function settleSeg(base, x, th, plans, d = 0.72, sgn = 1) {
  const order = ['fh', 'nf', 'nh', 'ff'];
  return { d, b: 0.05, f: (u, tl) => {
    const p = at(base, x, th);
    order.forEach((k, i) => {
      const rel = plans[k].end, a = clamp((tl - i * 0.13) / 0.27), e = eIO(a);
      p[k + 'x'] += sgn * rel * (1 - e);
      if (Math.abs(rel) > 2.5) { const h = Math.sin(PI * a); p[k + 'y'] += h * 3.6; p[k + 'a'] += (k[1] === 'f' ? -0.7 : 0.35) * h; }
    });
    p.faceCam = lerp(0.16, base.faceCam, sstep(u * 1.4)); // and a glance back at the viewer
    return p;
  } };
}
function trapez(tau, r) { r = Math.min(r, 0.5); if (r <= 1e-4) return tau; let v; if (tau < r) v = (tau * tau) / (2 * r); else if (tau <= 1 - r) v = r / 2 + (tau - r); else v = 1 - r - ((1 - tau) * (1 - tau)) / (2 * r) + r / 2 - r / 2; return clamp(v / (1 - r)); }
function ampAt(tau, r) { r = Math.min(r, 0.5); return clamp(Math.min(1, tau / r, (1 - tau) / r)); }
const dirTh = (d) => (d >= 0 ? 0 : PI);
const faceDir = (th) => (Math.cos(th) >= 0 ? 1 : -1);
const at = (base, x, th, extra) => { const p = Object.assign({}, base, extra || {}); p.x = x; p.theta = th; return p; };
const holdSeg = (base, x, th, d, b) => ({ d, b: b == null ? 0.3 : b, f: () => at(base, x, th) });
function turnSeg(x, th0, th1, base, dur = 0.8) {
  return { d: dur, b: 0.25, f: (u) => {
    const p = at(base, x, lerp(th0, th1, sstep(u)));
    p.faceCam = lerp(base.faceCam, 1.0, hump(u, 0, 0.85));
    const ord = { nf: 0, fh: 0.22, ff: 0.45, nh: 0.66 };
    for (const k of LEGS) { const h = hump(u, ord[k] * 0.75, ord[k] * 0.75 + 0.36); p[k + 'y'] += h * 4.2; p[k + 'a'] += (k[1] === 'f' ? -0.9 : 0.4) * h; }
    p.hipY -= hump(u, 0, 1) * 2; p.shY -= hump(u, 0, 1) * 1.5; p.tailWave = base.tailWave + 6 * hump(u, 0, 1);
    return p;
  } };
}
function walkSegs(x0, th0, x1, opts = {}) {
  const segs = [], D = Math.abs(x1 - x0), dir = x1 >= x0 ? 1 : -1;
  const base = opts.base || STAND, G = GAITS[opts.gait || 'walk'], spd = opts.speed || 1;
  if (D < 3) return { segs, x: x0, th: th0 };
  let th = th0;
  const back = !!opts.back, sgn = back ? -1 : 1, thE = back ? th0 : dirTh(dir); // back: a few steps backwards, still facing th0
  if (!back && faceDir(th0) !== dir) { segs.push(turnSeg(x0, th0, dirTh(dir), base, opts.gait === 'trot' ? 0.6 : 0.8)); th = dirTh(dir); }
  const cyc = G.S / G.duty, v = (cyc / G.T) * spd, rp = 0.45 / spd, dur = D / v + rp, r = rp / dur, thS = th;
  const plans = plansFor(G, D / cyc);
  segs.push({ d: dur, b: 0.3, f: (u, tl) => {
    const dd = D * trapez(u, r);
    const p = gaitPose(base, dd / cyc, ampAt(u, r), G, plans, sgn);
    p.x = x0 + dir * dd; p.theta = lerp(thS, thE, sstep(tl / 0.4));
    if (!back) p.lookX += dir * 0.6 * ampAt(u, r);
    if (opts.gait === 'trot') { p.earRot = 0.9; p.pupil = 0.85; p.neckA -= 8; }
    if (opts.mod) opts.mod(p, u, tl);
    return p;
  } });
  if (!opts.noSettle) segs.push(settleSeg(base, x1, thE, plans, 0.72, sgn));
  return { segs, x: x1, th: thE, plans };
}
function sampleSegs(B, tb, T) {
  let acc = 0;
  for (let i = 0; i < B.segs.length; i++) {
    const s = B.segs[i];
    if (tb < acc + s.d || i === B.segs.length - 1) {
      const tl = clamp(tb - acc, 0, s.d), u = s.d > 0 ? tl / s.d : 1;
      let p = s.f(u, tl, T);
      const bl = s.b == null ? 0.3 : s.b;
      if (i > 0 && tl < bl) { const pv = B.segs[i - 1]; p = mix(pv.f(1, pv.d, T - tl), p, sstep(tl / bl)); }
      return p;
    }
    acc += s.d;
  }
  return at(STAND, 0, 0);
}
function kf(u, keys) { // smooth key-frame interpolation [[u, v], ...]
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (u <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; return lerp(a[1], b[1], sstep((u - a[0]) / (b[0] - a[0]))); }
  return keys[keys.length - 1][1];
}
function setWrist(p, k, wx, wy, a) { p[k + 'x'] = wx + 1.5; p[k + 'y'] = wy - 6.2; p[k + 'a'] = a; }
function idleDetails(p, u, T) {
  const e1 = env(u, 0.22, 0.26, 0.33, 0.38); p.earR -= 0.6 * e1; p.earL += 0.15 * e1;              // ear swivel
  const sb = env(u, 0.54, 0.6, 0.66, 0.75); p.lid = Math.max(p.lid, 0.86 * sb); p.smile += 0.3 * sb; // slow "cat kiss" blink
  p.whiskT += Math.sin(T * 23) * env(u, 0.4, 0.42, 0.45, 0.47);                                       // whisker twitch
  const ht = env(u, 0.78, 0.83, 0.93, 0.99); p.headRoll += 9 * ht; p.lookY -= 0.55 * ht; p.lookX += 0.3 * ht; p.earL -= 0.2 * ht;
  p.tailTip += 11 * Math.sin(T * 2.2);
  return p;
}

/* ============================ behaviours ============================ */
const sitBase = (cat) => (cat.mode === 'mascot' ? PRESENT : SIT);
const sitTheta = (cat, th) => (cat.mode === 'mascot' ? 0.8 : faceDir(th) > 0 ? 0.38 : PI - 0.38);
const nearFront = (th) => (Math.cos(th) >= 0 ? 'nf' : 'ff');
const BEH = {};
BEH.sit = (cat, o, demo) => {
  const x = demo ? cat.Wu * 0.7 : cat.x, th = sitTheta(cat, demo ? 0 : cat.th), base = sitBase(cat);
  const d = demo ? 6.5 : o.dur || 4.5 + Math.random() * 4.5;
  return { look: true, sitting: true, loopFrom: 0, segs: [{ d, b: 0.4, f: (u, tl, T) => idleDetails(at(base, x, th), u, T) }] };
};
BEH.present = (cat, o, demo) => {
  const x = demo ? cat.Wu * 0.7 : cat.x, th = cat.mode === 'mascot' ? 0.8 : faceDir(demo ? 0 : cat.th) > 0 ? 0.8 : PI - 0.8;
  return { look: true, sitting: true, loopFrom: 0, segs: [{ d: demo ? 6.5 : 7, b: 0.4, f: (u, tl, T) => idleDetails(at(PRESENT, x, th), fract(u + 0.1), T) }] };
};
BEH.flick = (cat, o, demo) => { // idle ear and tail flicks while sitting
  const x = demo ? cat.Wu * 0.7 : cat.x, th = sitTheta(cat, demo ? 0 : cat.th), base = sitBase(cat);
  return { look: true, sitting: true, segs: [{ d: 2.6, b: 0.4, f: (u, tl, T) => {
    const p = at(base, x, th);
    const f1 = env(u, 0.1, 0.14, 0.2, 0.28), f2 = env(u, 0.46, 0.5, 0.56, 0.64), e1 = env(u, 0.32, 0.35, 0.4, 0.46), e2 = env(u, 0.7, 0.73, 0.78, 0.84);
    p.tailTip += 48 * f1 - 40 * f2; p.tailCurl += 3 * (f1 + f2); p.tailWave = 1;
    p.earR -= 0.75 * e1; p.earL -= 0.7 * e2; p.whiskT += Math.sin(T * 25) * (e1 + e2) * 0.6;
    p.lookX += 0.6 * env(u, 0.3, 0.36, 0.6, 0.66) * faceDir(th); p.lookTurn -= 0.2 * env(u, 0.3, 0.36, 0.6, 0.66) * faceDir(th);
    return p;
  } }] };
};
BEH.walk = (cat, o, demo) => {
  if (cat.mode === 'mascot') return BEH.present(cat, o, demo);
  let x0 = cat.x, th0 = cat.th, x1;
  if (demo) { x0 = cat.Wu * 0.2; th0 = 0; x1 = x0 + 190; }
  else x1 = o.x != null ? o.x / cat.s : cat.randX(x0);
  x1 = cat.clampX(x1);
  const w = walkSegs(x0, th0, x1, {});
  w.segs.push(holdSeg(STAND, w.x, w.th, 0.3, 0.1));
  return { segs: w.segs };
};
BEH.trot = (cat, o, demo) => {
  if (cat.mode === 'mascot') return BEH.present(cat, o, demo);
  let x0 = cat.x, th0 = cat.th, x1;
  if (demo) { x0 = cat.Wu * 0.16; th0 = 0; x1 = cat.Wu * 0.84; }
  else x1 = o.x != null ? o.x / cat.s : cat.randX(x0);
  const w = walkSegs(x0, th0, cat.clampX(x1), { gait: 'trot' });
  w.segs.push(holdSeg(STAND, w.x, w.th, 0.3, 0.1));
  return { segs: w.segs };
};
BEH.turn = (cat, o, demo) => {
  const x = demo ? cat.Wu * 0.68 : cat.x, th0 = demo ? 0 : cat.th, th1 = faceDir(th0) > 0 ? PI : 0;
  if (cat.mode === 'mascot') return BEH.present(cat, o, demo);
  return { segs: [holdSeg(STAND, x, th0, 0.12), turnSeg(x, th0, th1, STAND, 1.0), holdSeg(STAND, x, th1, 0.15, 0.2)] };
};
// Rub: cheek bunts pressed onto the pillar edge, then a slow arched-back flank pass along it (cheek → neck →
// flank → tail wrap as each part crosses the edge), a turn and a second pass. The pillar wobbles (onRub hook).
function buntSeg(x, th, d) {
  return { d, b: 0.35, f: (u, tl) => {
    const p = at(RUB, x, th), r = Math.sin(u * TAU * 2 - PI / 2) * 0.5 + 0.5, e = env(u, 0, 0.12, 0.88, 1);
    p.headDX += 3.6 * e * (0.5 + 0.5 * r); p.headRoll += (-18 * r - 6) * e; p.squish = e * (0.7 + 0.5 * r);
    p.lid = Math.max(p.lid, 0.95 * e); p.happyEyes = 1; p.faceCam = lerp(RUB.faceCam, 0.12, e);
    p.earR -= 0.5 * e * r; p.earL -= 0.3 * e * r; p.purr = 0.95 * e; p.colPush = e * (0.4 + 0.6 * r); p.shY += 1.5 * r * e; p.arch += 2 * e;
    return p;
  } };
}
function rubWalkSeg(xa, xb, dir, edge) {
  const G = GAITS.walk, cyc = G.S / G.duty, D = Math.abs(xb - xa), v = (cyc / G.T) * 0.42, dur = D / v + 0.6, plans = plansFor(G, D / cyc);
  return { d: dur, b: 0.35, plans, f: (u, tl) => {
    const dd = D * trapez(u, 0.22), p = gaitPose(RUB, dd / cyc, ampAt(u, 0.22) * 0.8, G, plans);
    p.x = xa + dir * dd; p.theta = dirTh(dir); p.faceCam = 0.22;
    // which part is at the pillar edge: + = ahead of the hips toward the head
    const rel = (edge - p.x) * dir, rb = env(u, 0, 0.12, 0.88, 1);
    const cheek = gs(rel, 40, 9), neck = gs(rel, 26, 8), flank = gs(rel, 4, 16), tail = gs(rel, -30, 9);
    const c = clamp(cheek + neck * 0.8 + flank * 0.9 + tail * 0.7);
    p.colPush = rb * (0.25 + 0.7 * c); p.headRoll -= (8 + 10 * cheek) * rb; p.squish = Math.max(p.squish, 0.8 * cheek);
    p.lid = Math.max(p.lid, (0.7 + 0.3 * cheek) * rb); p.happyEyes = cheek > 0.4 ? 1 : 0;
    p.arch += (2.5 + 4 * flank) * rb; p.purr = 0.85 * rb;
    p.tailCurl -= 4 * tail; p.tailTip -= 30 * tail; p.tailQuiver = 1 + tail;
    return p;
  } };
}
BEH.rub = (cat, o, demo) => {
  if (cat.mode === 'mascot') return BEH.pet(cat, o, demo);
  const cols = cat.colsU();
  let ci = typeof o.target === 'number' ? o.target : o.target && o.target.nodeType ? cols.findIndex((c) => c.el === o.target) : -1;
  if (demo) ci = cols.length > 2 ? 1 : 0;
  if (ci < 0 || !cols[ci]) { let best = 1e9; cols.forEach((c, i) => { const d = Math.abs((c.x0 + c.x1) / 2 - cat.x); if (d < best) { best = d; ci = i; } }); }
  const col = cols[ci];
  if (!col) return BEH.sit(cat, o, demo);
  const x0 = demo ? col.x0 - 70 : cat.x, th0 = demo ? 0 : cat.th;
  let side = x0 < (col.x0 + col.x1) / 2 ? 1 : -1;
  const GAP = 57; // root to edge, so the cheek meets the edge
  let start = (side > 0 ? col.x0 : col.x1) - side * GAP;
  if (cat.clampX(start) !== start) { side = -side; start = (side > 0 ? col.x0 : col.x1) - side * GAP; }
  const edge = side > 0 ? col.x0 : col.x1;
  const near = Math.abs(cat.clampX(start) - x0) < 34 && faceDir(th0) === side; // already facing it, just too close: back up a step
  const segs = [], w = walkSegs(x0, th0, cat.clampX(start), near ? { back: true, speed: 0.6 } : {});
  segs.push(...w.segs);
  let x = w.x;
  if (faceDir(w.th) !== side) segs.push(turnSeg(x, w.th, dirTh(side), RUB, 0.8));
  segs.push(buntSeg(x, dirTh(side), 1.8));
  const x2 = cat.clampX(x + side * 72);
  const r1 = rubWalkSeg(x, x2, side, edge);
  segs.push(r1, settleSeg(RUB, x2, dirTh(side), r1.plans, 0.6));
  const tseg = turnSeg(x2, dirTh(side), dirTh(-side), RUB, 0.9), tf = tseg.f;
  tseg.f = (u, tl, T) => { const p = tf(u, tl, T); p.colPush = 0.2 * (1 - u); p.purr = 0.8; p.lid = 0.7; return p; };
  segs.push(tseg);
  const x3 = cat.clampX(x2 - side * 74);
  const r2 = rubWalkSeg(x2, x3, -side, edge);
  segs.push(r2, settleSeg(RUB, x3, dirTh(-side), r2.plans, 0.6));
  segs.push(holdSeg(STAND, x3, dirTh(-side), 0.5));
  return { segs, colIdx: ci, colEl: col.el, edge };
};
BEH.groom = (cat, o, demo) => {
  const x = demo ? cat.Wu * 0.7 : cat.x, th = sitTheta(cat, demo ? 0 : cat.th), base = sitBase(cat);
  const k = nearFront(th), far = k === 'ff' ? 1 : 0, R0 = solve(base, 0), S = R0.S;
  const sitP = () => at(base, x, th);
  const lickP = (u, n) => {
    const p = sitP(); setWrist(p, k, S[0] + 7.7, S[1] + 0.5, 1.3); p.pawFront = 1; p.pawFar = far; p.beans = 1;
    const c = fract(u * n), lk = hump(c, 0.1, 0.75);
    p.headPitch = 0.45 + 0.25 * lk; p.headDY = -3 - 2.2 * lk; p.headDX = 1.2 * lk; p.neckA = base.neckA - 6;
    p.tongue = 0.25 + 0.75 * lk; p.mouth = 0; p.lid = 0.96; p.faceCam = base.faceCam - 0.12; p.earRot = 0.1; p.smile = 0.2;
    return p;
  };
  const wipeP = (u) => {
    const p = sitP(), c = fract(u * 2), q = c < 0.6 ? eIO(c / 0.6) : 1 - eIO((c - 0.6) / 0.4);
    const A = [S[0] + 7.7, S[1] + 0.5], Bp = [S[0] + 4, S[1] + 10], Cp = [S[0] - 1, S[1] + 16.5];
    const w = q < 0.5 ? mid(A, Bp, q * 2) : mid(Bp, Cp, (q - 0.5) * 2);
    setWrist(p, k, w[0], w[1], lerp(1.3, 2.0, q)); p.pawFront = 1; p.pawFar = far; p.beans = 0.6;
    p.headRoll = 6 + 14 * q; p.headPitch = 0.3 + 0.25 * q; p.headDY = -2 - 1.5 * q; p.lid = 1; p.earRot = -0.2 - 0.55 * q; p.earL -= 0.3 * q;
    p.faceCam = base.faceCam - 0.2 * q; p.squish = 0.5 * q; p.smile = 0.3;
    return p;
  };
  return { busy: true, sitting: true, segs: [
    { d: 0.5, b: 0.4, f: () => sitP() },
    { d: 0.55, b: 0.05, f: (u) => { const pl = lickP(0, 1); pl.tongue = 0; const p = mix(sitP(), pl, eIO(u)); p.pawFront = u > 0.3 ? 1 : 0; p.pawFar = far; p.lid = lerp(0, 0.96, eIO(u)); return p; } },
    { d: 2.0, b: 0.1, f: (u) => lickP(u, 3) },
    { d: 2.3, b: 0.3, f: (u) => wipeP(u) },
    { d: 1.1, b: 0.3, f: (u) => lickP(u, 2) },
    { d: 0.6, b: 0.1, f: (u) => { const pl = lickP(1, 1); pl.tongue = 0; const p = mix(pl, sitP(), eIO(u)); p.pawFront = u < 0.7 ? 1 : 0; p.pawFar = far; return p; } },
    { d: 0.5, b: 0.15, f: (u, tl) => { const p = sitP(); const e = hump(u, 0, 1); p.headRoll += 12 * Math.sin(tl * 30) * e; p.earL += 0.4 * Math.sin(tl * 30) * e; p.earR -= 0.4 * Math.sin(tl * 30) * e; p.lid = 0.5 * e; return p; } }
  ] };
};
const CUSH_RX = 58;
BEH.sleep = (cat, o, demo) => {
  const segs = [];
  if (cat.mode === 'mascot' && cat.bust) { // a head-and-collar crop cannot show a curl: doze sitting up, chin dropping
    return { busy: true, doze: true, loopFrom: 1, segs: [
      { d: 1.2, b: 0.5, f: (u) => { const p = at(PRESENT, 0, 0.8); p.lid = eIO(u); p.headPitch += 0.35 * eIO(u); p.earRot = lerp(p.earRot, -0.3, u); return p; } },
      { d: demo ? 8 : 20, b: 0.3, f: (u, tl) => { const p = at(PRESENT, 0, 0.8), nod = 0.5 + 0.5 * Math.sin(tl * 0.9); p.lid = 1; p.headPitch += 0.35 + 0.2 * nod; p.headDY -= 1.5 * nod; p.headRoll -= 5 * nod; p.earRot = -0.3; p.smile = 0.3; p.zzz = clamp(tl / 1.2); p.earR -= 0.6 * env(tl % 7, 3, 3.08, 3.2, 3.3); return p; } }
    ] };
  }
  if (cat.mode === 'mascot') {
    const x = (cat.cx || 0) - 8, g = { gy: 5 }; // the curl is wider and lower than the sitting pose: keep it inside the box
    segs.push({ d: 1.2, b: 0.5, f: (u) => mix(at(PRESENT, 0, 0.8), at(LOAF, x, 0.5, g), eIO(u)) });
    segs.push({ d: 1.4, b: 0.2, f: (u) => mix(at(LOAF, x, 0.5, g), at(CURL, x, 0.2, g), eIO(u)) });
    segs.push(sleepSeg(x, 0.2, 5, demo ? 8 : 20));
    return { busy: true, loopFrom: 2, segs };
  }
  const cu = cat.cushionU();
  let x0 = demo ? cu.x - 44 : cat.x, th0 = demo ? 0 : cat.th;
  const dir = demo ? 1 : x0 <= cu.x ? 1 : -1;
  const xa = cu.x - dir * 44;
  if (!demo) { const w = walkSegs(x0, th0, xa, {}); segs.push(...w.segs); th0 = w.th; if (faceDir(th0) !== dir) segs.push(turnSeg(xa, th0, dirTh(dir), STAND, 0.8)); }
  const h = cu.h, D = dirTh(dir), on = Object.assign({}, STAND, { gy: h });
  segs.push({ d: 0.65, b: 0.3, f: (u) => { // hop up
    const p = at(STAND, xa, D), cr = env(u, 0, 0.25, 0.3, 0.45), j = seg(u, 0.3, 0.78), sj = Math.sin(PI * j);
    p.hipY -= 6 * cr; p.shY -= 6 * cr;
    p.x = xa + dir * 44 * sstep(j); p.gy = h * sstep(j); p.lift = sj * 10;
    p.nfy += 4 * sj; p.nfa -= 0.8 * sj; p.ffy += 4 * sj; p.ffa -= 0.8 * sj; p.nhy += 2 * sj; p.nha += 0.6 * sj; p.fhy += 2 * sj;
    const land = env(u, 0.76, 0.84, 0.9, 1); p.hipY -= 3 * land; p.shY -= 4 * land; p.tailA = 70 + 15 * sj;
    return p;
  } });
  segs.push({ d: 2.4, b: 0.3, f: (u, tl) => { // knead the cushion
    const p = at(KNEADST, cu.x, D, { gy: h }), c = fract(tl / 0.62), k = Math.floor(tl / 0.62) % 2 ? 'nf' : 'ff', hh = hump(c, 0, 0.55);
    p[k + 'y'] += 3.8 * hh; p[k + 'a'] -= 0.55 * hh; p[k + 'x'] += 1.2 * hh; p.splay = 1 - hh;
    p.shift += Math.sin((tl / 0.62) * PI) * 0.8; p.happyEyes = 0; return p;
  } });
  segs.push(turnSeg(cu.x, D, dirTh(-dir), on, 0.9)); // circle twice
  segs.push(turnSeg(cu.x, dirTh(-dir), D, on, 0.9));
  const cth = dir > 0 ? 0.16 : PI - 0.16, cx = cu.x - dir * 4;
  segs.push({ d: 1.0, b: 0.25, f: (u) => { const p = mix(at(on, cu.x, D), at(LOAF, cu.x, D, { gy: h }), eIO(u)); p.gy = h; return p; } });
  segs.push({ d: 1.5, b: 0.15, f: (u) => { // roll onto the side and curl up
    const p = mix(at(LOAF, cu.x, D, { gy: h }), at(CURL, cx, cth, { gy: h }), eIO(u));
    p.theta = lerp(D, cth, eIO(u)); p.gy = h; p.lid = Math.max(p.lid, lerp(0.6, 1, seg(u, 0.4, 0.9))); return p;
  } });
  segs.push(sleepSeg(cx, cth, h, demo ? 8.2 : 16 + Math.random() * 14));
  return { busy: true, curl: true, loopFrom: segs.length - 1, segs };
};
function sleepSeg(x, th, h, d) {
  return { d, b: 0.4, f: (u, tl, T) => {
    const p = at(CURL, x, th, { gy: h }), m = tl % 9;
    p.zzz = clamp(tl / 1.2);
    p.earR -= 0.65 * env(m, 2.0, 2.08, 2.2, 2.32); p.earL -= 0.5 * env(m, 6.0, 6.08, 6.18, 6.3);
    const dp = env(m, 4.0, 4.1, 4.6, 4.8); p.nfa += 0.35 * Math.sin(tl * 38) * dp; p.nfy += 1.0 * dp; p.nhx += 1.2 * Math.sin(tl * 31) * dp; // dreaming paws
    p.whiskT += Math.sin(tl * 21) * env(m, 7.2, 7.25, 7.4, 7.5);
    p.tailTip += 8 * Math.sin(T * 0.7);
    return p;
  } };
}
// Wake: uncurl → loaf with a slow blink → stand on the cushion → play-bow stretch → hop down → (then …)
BEH.wake = (cat, o, demo) => {
  const lb = demo ? null : cat.lastBase;
  if (cat.mode === 'mascot' && cat.bust) { const B = BEH.yawn(cat, o, demo); B.then = o.then; B.thenOpts = o.thenOpts; return B; }
  if (cat.mode === 'mascot') {
    const x = (cat.cx || 0) - 8, g = { gy: 5 };
    return { busy: true, then: o.then, thenOpts: o.thenOpts, segs: [
      { d: 1.3, b: 0.4, f: (u) => { const p = mix(at(CURL, x, 0.2, g), at(LOAF, x, 0.5, g), eIO(u)); p.lid = lerp(1, 0.55, seg(u, 0.5, 1)); return p; } },
      { d: 1.2, b: 0.2, f: (u, tl) => { const p = mix(at(LOAF, x, 0.5, g), at(PRESENT, 0, 0.8), eIO(u)); p.mouth = 0.7 * hump(u, 0.35, 0.8); p.squeeze = u > 0.45 && u < 0.75 ? 1 : 0; p.lid = u > 0.45 && u < 0.75 ? 1 : lerp(0.55, 0, seg(u, 0.75, 1)); p.fang = p.mouth; return p; } }
    ] };
  }
  const cu = cat.cushionU(), h = cu.h;
  const curled = demo || !lb || lb.curl > 0.25;
  const onCush = demo || (lb && lb.gy > 2);
  const xs = demo ? cu.x - 4 : lb ? lb.x : cat.x, ths = demo ? 0.16 : lb ? lb.theta : cat.th;
  let dir = o.dir || (o.then === 'chase' && o.thenOpts && o.thenOpts.x != null ? (o.thenOpts.x / cat.s >= cu.x ? 1 : -1) : faceDir(ths));
  if (cat.clampX(cu.x + dir * 54) !== cu.x + dir * 54) dir = -dir;
  const D = dirTh(dir), segs = [];
  if (curled) {
    segs.push({ d: 1.3, b: 0.3, f: (u) => { const p = mix(at(CURL, xs, ths, { gy: h }), at(LOAF, cu.x, ths, { gy: h }), eIO(u)); p.gy = h; p.lid = lerp(1, 0.55, seg(u, 0.55, 1)); p.earRot = lerp(-0.3, 0.2, seg(u, 0.5, 1)); return p; } });
    segs.push({ d: 0.85, b: 0.1, f: (u) => { const p = at(LOAF, cu.x, ths, { gy: h }); p.lid = Math.max(0.3, hump(u, 0.2, 0.8)); p.theta = lerp(ths, D, sstep(u)); return p; } });
    segs.push({ d: 0.7, b: 0.1, f: (u) => { const p = mix(at(LOAF, cu.x, D, { gy: h }), at(STAND, cu.x, D, { gy: h }), eIO(u)); p.gy = h; return p; } });
    segs.push({ d: 1.7, b: 0.15, f: (u, tl) => { // a quick play-bow on the cushion
      const a = eIO(seg(u, 0, 0.3)) * (1 - eIO(seg(u, 0.72, 1)));
      const p = mix(at(STAND, cu.x, D, { gy: h }), at(BOW, cu.x, D, { gy: h }), a); p.gy = h;
      p.mouth = 0.55 * hump(u, 0.3, 0.7); p.jawTall = p.mouth; p.fang = p.mouth; p.squeeze = u > 0.35 && u < 0.65 ? 1 : 0; p.lid = Math.max(p.lid, p.squeeze);
      p.tailQuiver = 0.4 * a; return p;
    } });
  }
  if (onCush || curled) {
    const x0 = curled ? cu.x : xs, th0 = curled ? D : ths;
    if (!curled && faceDir(th0) !== dir) segs.push(turnSeg(x0, th0, D, Object.assign({}, STAND, { gy: h }), 0.8));
    const x1 = cat.clampX(cu.x + dir * 54);
    segs.push({ d: 0.62, b: 0.2, f: (u) => { // hop down
      const p = at(STAND, x0, D), cr = env(u, 0, 0.2, 0.25, 0.4), j = seg(u, 0.25, 0.8), sj = Math.sin(PI * j);
      p.hipY -= 5 * cr; p.shY -= 4 * cr; p.x = lerp(x0, x1, sstep(j)); p.gy = h * (1 - sstep(j)); p.lift = sj * 8;
      p.nfy += 4 * sj; p.nfa -= 0.7 * sj; p.ffy += 4 * sj; p.nhy += 2 * sj; p.fhy += 2 * sj;
      const land = env(u, 0.78, 0.86, 0.9, 1); p.shY -= 4 * land; p.hipY -= 2 * land; return p;
    } });
    segs.push(holdSeg(STAND, x1, D, 0.35, 0.2));
  }
  if (!segs.length) segs.push(holdSeg(STAND, xs, ths, 0.2));
  return { busy: true, then: o.then, thenOpts: o.thenOpts, segs };
};
BEH.stretch = (cat, o, demo) => {
  if (cat.mode === 'mascot') return BEH.yawn(cat, o, demo);
  const xb = demo ? cat.Wu * 0.6 : cat.x, dir = demo ? 1 : faceDir(cat.th), th = dirTh(dir), xf = xb + dir * 10;
  return { segs: [
    { d: 0.9, b: 0.45, f: (u) => { // walk the front paws forward one after the other, chest down
      const p = mix(at(STAND, xb, th), at(BOW, xb, th), eIO(u));
      const a1 = eIO(seg(u, 0, 0.5)), a2 = eIO(seg(u, 0.3, 0.85));
      p.nfx = lerp(STAND.nfx, BOW.nfx, a1); p.ffx = lerp(STAND.ffx, BOW.ffx, a2);
      p.nfy += hump(u, 0, 0.5) * 4; p.ffy += hump(u, 0.3, 0.85) * 4; return p;
    } },
    { d: 1.6, b: 0.1, f: (u, tl) => { // hold the bow, toes spread, a little tremble
      const p = at(BOW, xb, th), q = Math.sin(tl * 31) * 0.25 * env(u, 0, 0.2, 0.8, 1);
      p.hipY += q + 1.2 * hump(u, 0.2, 0.8); p.shY += q * 0.5 - 1 * hump(u, 0.2, 0.8);
      p.mouth = 0.1 + 0.25 * hump(u, 0.3, 0.8); p.tailQuiver = 0.5; p.splay = 1; return p;
    } },
    { d: 0.8, b: 0.1, f: (u) => { const e = eIO(u), p = mix(at(BOW, xb, th), at(BACK, xf, th), e); p.x = lerp(xb, xf, e); p.lid = lerp(1, 0.7, e); return p; } },
    { d: 1.4, b: 0.1, f: (u, tl) => { // back-leg stretch
      const p = at(BACK, xf, th), q = Math.sin(tl * 29) * 0.3 * env(u, 0, 0.2, 0.8, 1); p.nhy += q; p.nhx -= q; p.splay = 1;
      p.tailCurl += 1.5 * Math.sin(tl * 1.6); return p;
    } },
    { d: 0.75, b: 0.1, f: (u) => { const p = mix(at(BACK, xf, th), at(STAND, xf, th), eIO(u)); p.nhy += hump(u, 0, 0.7) * 4; return p; } }
  ] };
};
BEH.yawn = (cat, o, demo) => {
  const x = demo ? cat.Wu * 0.7 : cat.x, th = sitTheta(cat, demo ? 0 : cat.th), base = sitBase(cat);
  return { busy: true, sitting: true, segs: [{ d: 3.0, b: 0.45, f: (u, tl) => {
    const p = at(base, x, th), ant = env(u, 0, 0.06, 0.1, 0.16), op = env(u, 0.12, 0.34, 0.6, 0.7), sh = env(u, 0.72, 0.76, 0.88, 0.95);
    p.headPitch += 0.25 * ant - 0.85 * op; p.neckA += 6 * op; p.headDY += 1.5 * op;
    p.mouth = Math.max(0, op * 1.0 + 0.2 * hump(u, 0.7, 0.76)); p.tongue = 0.7 * op; p.fang = op; p.jawTall = op; p.neckA += 6 * op; p.headRoll -= 9 * op * faceDir(th);
    p.lid = Math.max(p.lid, op > 0.25 ? 1 : 0.4 * ant); p.squeeze = op > 0.25 ? 1 : 0;
    p.earRot = lerp(p.earRot, -0.85, op); p.whisk = -0.7 * op; p.brow = -0.3 * op;
    p.headRoll += 4 * Math.sin(tl * 9) * env(u, 0.4, 0.45, 0.58, 0.62) + 13 * Math.sin(tl * 30) * sh;
    p.earL += 0.45 * Math.sin(tl * 30) * sh; p.earR -= 0.45 * Math.sin(tl * 30) * sh;
    p.lid = Math.max(p.lid, 0.6 * sh);
    return p;
  } }] };
};
BEH.look = (cat, o, demo) => {
  const x = demo ? cat.Wu * 0.7 : cat.x, th = sitTheta(cat, demo ? 0 : cat.th), base = sitBase(cat);
  const fc = base.faceCam;
  return { sitting: true, segs: [{ d: 4.4, b: 0.45, f: (u, tl, T) => {
    const p = at(base, x, th);
    p.faceCam = kf(u, [[0, fc], [0.14, 0.22], [0.34, 0.22], [0.5, 1.0], [0.62, 1.68], [0.84, 1.68], [1, fc]]);
    const turnV = p.faceCam - fc;
    p.lookX = clamp(-turnV * 1.1, -1, 1) * faceDir(th); p.earL += -0.25 * turnV; p.earR += 0.25 * turnV;
    p.lid = Math.max(p.lid, 0.9 * (env(u, 0.16, 0.18, 0.2, 0.22) + env(u, 0.68, 0.7, 0.72, 0.74)));
    p.headRoll += 6 * env(u, 0.66, 0.7, 0.8, 0.84); p.earRot += 0.4 * env(u, 0.2, 0.25, 0.3, 0.35);
    return p;
  } }] };
};
BEH.pet = (cat, o, demo) => {
  const x = demo ? cat.Wu * 0.7 : cat.x, th = sitTheta(cat, demo ? 0 : cat.th), base = sitBase(cat);
  return { busy: true, sitting: true, segs: [{ d: 3.0, b: 0.45, f: (u, tl) => {
    const p = at(base, x, th), e = env(u, 0, 0.12, 0.85, 1);
    p.headRoll += 15 * e + 3 * Math.sin(tl * 3) * e; p.headDY += 1.5 * e; p.neckA += 4 * e;
    p.lid = Math.max(p.lid, e > 0.5 ? 1 : 1.8 * e * 0.5); p.happyEyes = 1; p.smile = lerp(p.smile, 1, e);
    p.earRot = lerp(p.earRot, -0.35, e); p.purr = e; p.blush = lerp(p.blush, 1, e); p.tailTip += 20 * Math.sin(tl * 2.5) * e; p.whisk = 0.3 * e; p.shift += e;
    return p;
  } }] };
};
BEH.knead = (cat, o, demo) => {
  const x = demo ? cat.Wu * 0.7 : cat.x, th = sitTheta(cat, demo ? 0 : cat.th), base = sitBase(cat);
  return { busy: true, sitting: true, segs: [{ d: 3.6, b: 0.45, f: (u, tl) => {
    const p = at(base, x, th), e = env(u, 0, 0.1, 0.9, 1), c = fract(tl / 0.6), k = Math.floor(tl / 0.6) % 2 ? 'nf' : 'ff', h = hump(c, 0, 0.6) * e;
    p.shY -= 3 * e; p[k + 'y'] += 4.5 * h; p[k + 'a'] -= 0.6 * h; p[k + 'x'] += 1.5 * h; p.splay = 1 - h;
    p.lid = Math.max(p.lid, 0.62 * e); p.lidLow = Math.max(p.lidLow, 0.4 * e); p.purr = 0.85 * e; p.smile = lerp(p.smile, 0.85, e); p.headDY += Math.sin((tl / 0.6) * PI) * 0.6 * e;
    return p;
  } }] };
};
BEH.chase = (cat, o, demo) => {
  if (cat.mode === 'mascot') { cat.play('lean-in'); return BEH.present(cat, o, demo); }
  const ctx = { tx: 0, ty: 14, locked: false, lx: 0 };
  cat.chaseCtx = ctx;
  const x0 = demo ? cat.Wu * 0.42 : cat.x, th0 = demo ? 0 : cat.th;
  if (demo) { ctx.tx = x0 + 104; ctx.ty = 16; }
  else { ctx.tx = cat.clampX(o.x != null ? o.x / cat.s : x0 + faceDir(th0) * 110); ctx.ty = o.y != null ? (cat.floor - o.y) / cat.s : 14; }
  const segs = [], dir = ctx.tx >= x0 ? 1 : -1;
  let x = x0, th = th0;
  if (!demo && Math.abs(ctx.tx - x0) > 125) { const w = walkSegs(x0, th0, cat.clampX(ctx.tx - dir * 78), { gait: 'trot', noSettle: true }); segs.push(...w.segs); x = w.x; th = w.th; }
  if (faceDir(th) !== dir) { segs.push(turnSeg(x, th, dirTh(dir), CROUCH, 0.55)); th = dirTh(dir); }
  const xs = x, D = dirTh(dir), k = nearFront(D);
  const landX = () => cat.clampX(xs + dir * clamp((ctx.tx - dir * 30 - xs) * dir, 10, 68));
  if (demo) { ctx.locked = true; ctx.lx = landX(); }
  // head and pupils lock on to the lure (screen-space look: + is to the right)
  const aim = (p, px) => {
    const dx = ctx.tx - (px + dir * 40), dyl = ctx.ty - 30;
    p.lookX = clamp(dx / 30, -1, 1); p.lookY = clamp(-dyl / 26, -1, 1) * 0.8;
    p.headPitch += clamp(-dyl / 50, -0.45, 0.5); p.lookTurn += -0.12 * clamp(dx / 40, -1, 1) * dir; p.faceCam = Math.min(p.faceCam, 0.2);
  };
  segs.push({ d: 0.35, b: 0.25, f: (u) => { const p = mix(at(STAND, xs, D), at(CROUCH, xs, D), 0.6 * eIO(u)); p.earRot = 1; p.pupil = lerp(0.5, 1, u); p.eyeOpen = 1.1; p.whisk = 1; aim(p, xs); return p; } });
  segs.push({ d: 1.05, b: 0.2, f: (u, tl) => { // stalk: low, butt wiggle, tail tip twitching
    const p = at(CROUCH, xs, D), wg = Math.sin(tl * 22) * env(u, 0, 0.2, 0.85, 1);
    p.hipY += 1.4 * wg + 3 * seg(u, 0.75, 1); p.shift -= 0.7 * wg; p.nhy += Math.max(0, wg) * 1.3; p.fhy += Math.max(0, -wg) * 1.3;
    p.tailTip += 25 * Math.sin(tl * 9); aim(p, xs); return p;
  } });
  segs.push({ d: 0.5, b: 0.08, f: (u) => { // pounce
    if (!ctx.locked) { ctx.locked = true; ctx.lx = landX(); }
    const p = mix(at(POUNCE, 0, D), at(LAND, 0, D), sstep(seg(u, 0.55, 1)));
    p.x = lerp(xs, ctx.lx, eIO(u)); p.theta = D; p.lift = Math.sin(PI * u) * 22 * clamp(Math.abs(ctx.lx - xs) / 50 + 0.4, 0.4, 1);
    if (k === 'ff') { for (const c of ['x', 'y', 'a']) { const v = p['nf' + c]; p['nf' + c] = p['ff' + c]; p['ff' + c] = v; } p.pawFar = 1; }
    aim(p, p.x); p.lookY += 0.3; return p;
  } });
  segs.push({ d: 0.56, b: 0.1, f: (u) => { // swat and pin
    const p = at(LAND, ctx.lx, D), sw = hump(fract(u * 2), 0, 0.7);
    p[k + 'y'] += 13 * sw; p[k + 'x'] += 4 * sw; p[k + 'a'] -= 1.3 * sw; p.splay = 1; p.shY += 2 * sw; p.mouth = 0.12 * sw;
    p.pawFront = sw > 0.15 ? 1 : 0; p.pawFar = k === 'ff' ? 1 : 0; aim(p, ctx.lx); p.lookY = 0.6;
    return p;
  } });
  segs.push({ d: 0.22, b: 0.15, f: () => { const p = at(LAND, ctx.lx, D); aim(p, ctx.lx); p.lookY = 0.6; return p; } });
  return { segs, chase: true, ctx };
};

/* ============================ moods, talking, gestures ============================ */
const MOODS = {
  idle: {},
  talk: { earRot: 0.5, browUp: 0.4, smile: 0.55, pupil: 0.55 },
  happy: { lidLow: 0.6, smile: 1, earRot: 0.5, blush: 1, pupil: 0.62, browUp: 0.25, tailTip: 22, tailWave: 4 },
  think: { lookX: -0.75, lookY: -0.85, headRoll: -11, earL: -0.3, earR: 0.15, smile: -0.15, brow: -0.25, browUp: 0.5 },
  alert: { earRot: 1, pupil: 0.12, eyeOpen: 1.12, brow: 0.45, whisk: 0.9, tailPuff: 1.22, smile: 0 },
  sad: { earRot: -0.8, lid: 0.34, brow: -1, smile: -1, headPitch: 0.35, pupil: 0.88, whisk: -0.7, tear: 1 },
  celebrate: { lid: 1, happyEyes: 1, mouth: 0.62, smile: 1, earRot: 0.65, blush: 1, tailWave: 7 },
  surprised: { eyeOpen: 1.24, pupil: 1, earRot: 1, mouth: 0.32, smile: 0, browUp: 1.2, tailPuff: 1.6, whisk: 0.9 },
  proud: { lid: 0.42, smile: 0.85, headPitch: -0.38, earRot: 0.55, brow: 0.2, neckA: 4 },
  curious: { headRoll: 17, earRot: 0.95, pupil: 0.82, eyeOpen: 1.1, mouth: 0.07, browUp: 0.5, lookX: 0.3 },
  worried: { brow: -1, earRot: -0.5, pupil: 0.82, smile: -0.6, lidLow: 0.12, browUp: 0.3, lookX: -0.3 },
  excited: { pupil: 0.96, eyeOpen: 1.16, mouth: 0.45, smile: 1, earRot: 0.95, browUp: 0.65, tailWave: 6 },
  sleepy: { lid: 0.66, earRot: -0.28, headPitch: 0.25, smile: 0.1, pupil: 0.6, headRoll: -6 },
  laughing: { lid: 1, happyEyes: 1, mouth: 0.78, smile: 1, tongue: 0.5, earRot: 0.35, blush: 1, headRoll: 6 }
};
const MOOD_ADD = new Set(['headRoll', 'headPitch', 'lookX', 'lookY', 'earL', 'earR', 'tailTip', 'tailWave', 'neckA', 'headDY']);
const MOOD_MAX = new Set(['lid', 'mouth', 'tongue', 'tear', 'happyEyes', 'squeeze']);
// moods that also move the paws (only while sitting): celebrate = both paws up with the beans showing, think = paw to chin
const MOOD_PAWS = {
  celebrate: (p, w, c, T, live) => { GEST._cheer(p, w, c, live ? Math.abs(Math.sin(T * 7)) : 0.5); },
  think: (p, w, c) => { GEST._chin(p, w, c); }
};
function applyMood(p, name, w, T, live) {
  const M = MOODS[name]; if (!M || w <= 0) return p;
  for (const k in M) {
    if (MOOD_ADD.has(k)) p[k] += M[k] * w;
    else if (MOOD_MAX.has(k)) { if (k === 'happyEyes') { if (M[k] * w > 0.5) p[k] = 1; } else p[k] = Math.max(p[k], M[k] * w); }
    else p[k] = lerp(p[k], M[k], w);
  }
  if (live) {
    if (name === 'laughing') { p.headRoll += 3 * Math.sin(T * 14) * w; p.headDY += 0.8 * Math.abs(Math.sin(T * 7)) * w; p.mouth = Math.max(p.mouth, (0.55 + 0.25 * Math.sin(T * 14)) * w); }
    if (name === 'excited' || name === 'celebrate') p.headDY += 0.9 * Math.abs(Math.sin(T * 8)) * w;
    if (name === 'worried') p.lookX += 0.25 * Math.sin(T * 1.7) * w;
    if (name === 'think') p.tailTip += 10 * Math.sin(T * 1.1) * w;
  }
  return p;
}
function talkOpen(T) {
  const a = 0.5 + 0.5 * Math.sin(T * 13.1), b = 0.5 + 0.5 * Math.sin(T * 8.3 + 1.7), n = 0.5 + 0.5 * noise(T * 2.7);
  let v = a * (0.45 + 0.55 * b) * (0.55 + 0.6 * n);
  if (noise(T * 0.8 + 3.1) > 0.45) v *= 0.15;
  return clamp(v * 1.15, 0, 0.72);
}
const GDUR = { wave: 1.9, nod: 1.2, shake: 1.3, cheer: 1.8, 'point-left': 1.7, 'point-right': 1.7, 'point-down': 1.6, shrug: 1.4, 'lean-in': 1.6, 'shield-up': 2.0, bow: 1.7, think: 2.4 };
const GALIAS = { hello: 'wave', hi: 'wave', yes: 'nod', no: 'shake', clap: 'cheer', point: 'point-right', left: 'point-left', right: 'point-right', down: 'point-down', lean: 'lean-in', shield: 'shield-up', badge: 'shield-up', hmm: 'think' };
function paw(p, k, x, y, a, e, far) { p[k + 'x'] = lerp(p[k + 'x'], x + 1.5, e); p[k + 'y'] = lerp(p[k + 'y'], y - 6.2, e); p[k + 'a'] = lerp(p[k + 'a'], a, e); if (e > 0.25) { p.pawFront = 1; p.pawFar = far; } }
// Paw targets are in the body frame around the shoulder S. Every gesture leaves from the near shoulder
// outward and down (or up beside the cheek), never across the muzzle or the eyes.
const GEST = {
  wave(p, u, tl, c) { const e = env(u, 0, 0.15, 0.82, 1), S = c.S; paw(p, c.kF, S[0] + 27 + Math.sin(tl * 10) * 2.5 * e, S[1] + 12, 1.5 + 0.5 * Math.sin(tl * 10), e, c.kF === 'ff' ? 1 : 0); p.beans = e; p.headRoll -= 6 * e; p.smile = lerp(p.smile, 1, e); p.earRot = lerp(p.earRot, 0.7, e); p.lidLow = Math.max(p.lidLow, 0.4 * e); },
  nod(p, u) { const e = env(u, 0, 0.1, 0.85, 1); p.headPitch += 0.45 * Math.sin(u * TAU * 2) * e; p.headDY -= 1.2 * Math.max(0, Math.sin(u * TAU * 2)) * e; p.lid = Math.max(p.lid, 0.25 * e); p.smile = lerp(p.smile, 0.8, e); },
  shake(p, u) { const e = env(u, 0, 0.1, 0.85, 1), s = Math.sin(u * TAU * 3); p.lookTurn += 0.38 * s * e; p.earL += 0.2 * s * e; p.earR -= 0.2 * s * e; p.smile = lerp(p.smile, -0.3, e); p.brow = lerp(p.brow, -0.4, e); },
  _cheer(p, e, c, bob) { const S = c.S; p.shY += 3 * e; p.hipY += e; p.neckA += 2 * e; p.armZ += 10 * e; p[c.k + 'E'] = e;
    paw(p, c.k, S[0] - 19, S[1] + 15 + 2 * bob, 2.5, e, c.k === 'ff' ? 1 : 0); paw(p, c.kF, S[0] + 21, S[1] + 15 + 2 * bob, 1.6, e, c.kF === 'ff' ? 1 : 0);
    p.beans = e; p.paw2 = e > 0.25 ? 1 : 0; p.pawFar = c.kF === 'ff' ? 1 : 0; p.headDY += 1.2 * bob * e; },
  _chin(p, e, c) { const Hb = c.Hb; paw(p, c.kF, Hb[0] + 7, Hb[1] - 20, 2.0, e, c.kF === 'ff' ? 1 : 0); p.beans = 0; p.headRoll -= 4 * e; p.headDY += 1.5 * e; },
  cheer(p, u, tl, c) { const e = env(u, 0, 0.15, 0.82, 1), bob = Math.abs(Math.sin(tl * 7)); GEST._cheer(p, e, c, bob);
    if (e > 0.5) p.lid = 1; p.happyEyes = 1; p.mouth = Math.max(p.mouth, 0.55 * e); p.smile = lerp(p.smile, 1, e); p.earRot = lerp(p.earRot, 0.8, e); },
  think(p, u, tl, c) { const e = env(u, 0, 0.2, 0.8, 1); GEST._chin(p, e, c); p.lookX += -0.7 * e; p.lookY += -0.8 * e; p.brow = lerp(p.brow, -0.25, e); p.browUp = lerp(p.browUp, 0.5, e); p.smile = lerp(p.smile, -0.1, e); p.tailTip += 12 * Math.sin(tl * 2) * e; },
  'point-left'(p, u, tl, c) { GEST._point(p, u, -1, c); },
  'point-right'(p, u, tl, c) { GEST._point(p, u, 1, c); },
  _point(p, u, want, c) { const e = env(u, 0, 0.18, 0.8, 1), S = c.S, fwd = want === c.facing, K = fwd ? c.kF : c.k;
    if (fwd) paw(p, K, S[0] + 30, S[1] - 9, -0.15, e, K === 'ff' ? 1 : 0); else paw(p, K, S[0] - 20, S[1] - 13, PI + 0.25, e, K === 'ff' ? 1 : 0);
    p.beans = 0; p.lookX += want * 0.9 * e; p.lookTurn += want * 0.25 * e * c.facing; p.headRoll += want * c.facing * 4 * e;
    p.earRot = lerp(p.earRot, 0.8, e); p.browUp = lerp(p.browUp, 0.5, e); p.smile = lerp(p.smile, 0.7, e); },
  'point-down'(p, u, tl, c) { const e = env(u, 0, 0.18, 0.8, 1), S = c.S; paw(p, c.kF, S[0] + 26, 9, -0.6, e, c.kF === 'ff' ? 1 : 0); p.headPitch += 0.45 * e; p.lookY += 1 * e; p.earRot = lerp(p.earRot, 0.8, e); },
  shrug(p, u) { const e = env(u, 0, 0.15, 0.8, 1); p.earRot = lerp(p.earRot, -0.5, e); p.headRoll += 9 * Math.sin(u * PI * 2) * e; p.nfy += 3 * e; p.ffy += 3 * e; p.nfa += 0.5 * e; p.ffa += 0.5 * e; p.browUp = lerp(p.browUp, 1, e); p.smile = lerp(p.smile, -0.2, e); p.lid = Math.max(p.lid, 0.22 * e); p.shY += 1.5 * e; },
  'lean-in'(p, u) { const e = env(u, 0, 0.2, 0.75, 1); p.shift += 3 * e; p.shY -= 1.5 * e; p.neckA -= 10 * e; p.headDX += 4 * e; p.headScale = 1 + 0.08 * e; p.eyeOpen = lerp(p.eyeOpen, 1.08, e); p.pupil = lerp(p.pupil, 0.85, e); p.browUp = lerp(p.browUp, 0.5, e); p.earRot = lerp(p.earRot, 0.9, e); },
  'shield-up'(p, u, tl, c) { const e = env(u, 0, 0.18, 0.82, 1), Hb = c.Hb; paw(p, c.k, Hb[0] - 0.5, Hb[1] - 21, 1.5, e, c.far); p.glint = Math.max(p.glint, seg(u, 0.3, 0.62)); p.smile = lerp(p.smile, 0.85, e); p.headPitch -= 0.15 * e; p.earRot = lerp(p.earRot, 0.75, e); p.lidLow = Math.max(p.lidLow, 0.35 * e); p.browUp = lerp(p.browUp, 0.4, e); },
  bow(p, u) { const e = env(u, 0, 0.25, 0.7, 1); p.shY -= 9 * e; p.hipY -= e; p.neckA -= 35 * e; p.headPitch += 0.5 * e; if (e > 0.5) { p.lid = 1; p.happyEyes = 1; } p.earRot = lerp(p.earRot, 0.4, e); p.smile = lerp(p.smile, 0.8, e); }
};
