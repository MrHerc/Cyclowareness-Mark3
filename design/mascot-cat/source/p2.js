<script>
(() => {
'use strict';
/* ============================ math helpers ============================ */
const TAU = Math.PI * 2, PI = Math.PI, D2R = PI / 180;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (t) => ((t = clamp(t)), t * t * (3 - 2 * t));
const eIO = (t) => ((t = clamp(t)), t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eOut = (t) => ((t = clamp(t)), 1 - Math.pow(1 - t, 3));
const eIn = (t) => ((t = clamp(t)), t * t * t);
const seg = (u, a, b) => clamp((u - a) / (b - a));
const hump = (u, a, b) => Math.sin(PI * seg(u, a, b));
const env = (u, a, b, c, d) => Math.min(sstep(seg(u, a, b)), 1 - sstep(seg(u, c, d)));
const fract = (x) => x - Math.floor(x);
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = (x) => { const i = Math.floor(x), f = x - i, w = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), w) * 2 - 1; };
const rot2 = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
const mid = (a, b, t = 0.5) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const gs = (s, m, w) => Math.exp(-((s - m) / w) * ((s - m) / w));
const nrm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

/* ============================ palette (the owner's cat) ============================ */
const C = {
  fur: '#8f98aa', furLt: '#b7bdca', furDk: '#5b6376', furSh: '#757e92', blot: '#525a6f',
  far: '#737c90', farDk: '#4b5265', wh: '#fcfbf7', whSh: '#e6e4ec', farWh: '#c9c9d4',
  out: '#454a5e', nose: '#f49cab', noseDk: '#d5788a', earIn: '#f6b0bd', earIn2: '#fbd3da',
  mouth: '#6a2535', tongue: '#f68ba0', tongueDk: '#d8667e',
  irisA: '#f2d470', irisM: '#d6cb60', irisB: '#a5c05c', irisC: '#5e8b47', pupil: '#1b1c26', rim: '#2c2b39',
  collar: '#4f46e5', collarLt: '#8f89f7', collarDk: '#3730a3',
  tagA: '#fdfdff', tagB: '#b5bdd2', tagEdge: '#6c7593',
  blush: '#ff8ea4', bean: '#eba1b0', beanGr: '#9d8f9d', accent: '#ff7a1a'
};

/* ============================ path helpers ============================ */
function area(pts) { let a = 0; for (let i = 0, n = pts.length; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
function polyTo(path, pts) {
  if (area(pts) < 0) pts = pts.slice().reverse();
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
  path.closePath();
}
function smoothPoly(path, pts) { // closed curve through mid-points, vertices as controls
  if (area(pts) < 0) pts = pts.slice().reverse();
  const n = pts.length, m0 = mid(pts[n - 1], pts[0]);
  path.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], q = mid(p, pts[(i + 1) % n]); path.quadraticCurveTo(p[0], p[1], q[0], q[1]); }
  path.closePath();
}
function circ(path, x, y, r) { path.moveTo(x + r, y); path.arc(x, y, r, 0, TAU); path.closePath(); }
function ell(path, x, y, rx, ry, rot = 0) { path.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx); path.ellipse(x, y, rx, ry, rot, 0, TAU); path.closePath(); }
function caps(path, a, ra, b, rb) {
  circ(path, a[0], a[1], ra); circ(path, b[0], b[1], rb);
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
  if (d < 1e-3) return;
  const nx = -dy / d, ny = dx / d;
  polyTo(path, [[a[0] + nx * ra, a[1] + ny * ra], [b[0] + nx * rb, b[1] + ny * rb], [b[0] - nx * rb, b[1] - ny * rb], [a[0] - nx * ra, a[1] - ny * ra]]);
}
// tapered organic band through centre-line points (the tabby "marbling brush"); w(f) = half width at f in [0,1]
function band(path, pts, w) {
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d, hw = w(i / (n - 1)), q = pts[i];
    L.push([q[0] + nx * hw, q[1] + ny * hw]); R.push([q[0] - nx * hw, q[1] - ny * hw]);
  }
  smoothPoly(path, L.concat(R.reverse()));
}
const taperW = (w0, w1, a = 0.18, b = 0.2) => (f) => lerp(w0, w1, f) * Math.min(1, 0.25 + (0.75 * f) / a, 0.15 + (0.85 * (1 - f)) / b);
// outline via "stroke the union, then fill the union": inner seams are covered by the fill
function ink(g, path, fill, ow, col) {
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.lineWidth = ow * 2; g.strokeStyle = col || C.out; g.stroke(path);
  g.fillStyle = fill; g.fill(path);
}
function strokePts(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) { const q = mid(pts[i], pts[i + 1]); g.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); } const l = pts[pts.length - 1]; g.lineTo(l[0], l[1]); g.stroke(); }
// soft fur edge: a same-colour shadow blur (device pixels, so it is scaled by st.px)
function soft(g, st, col, k = 1) { if (st.lod) return; g.shadowColor = col; g.shadowBlur = 1.3 * k * st.px; }
function hard(g) { g.shadowBlur = 0; g.shadowColor = 'transparent'; }

/* ============================ pose model ============================ */
const BASE = {
  x: 0, gy: 0, lift: 0, theta: 0,
  hipY: 39, shY: 41, bodyL: 50, shift: 0, arch: 2.5, sag: 2, bodyR: 1, curl: 0,
  neckA: 50, neckL: 15, faceCam: 0.55, lookTurn: 0, headRoll: 0, headPitch: 0, headDX: 0, headDY: 0, squish: 0, headScale: 1,
  earRot: 0.25, earL: 0, earR: 0,
  lid: 0, lidLow: 0, pupil: 0.45, eyeOpen: 1, lookX: 0, lookY: 0, happyEyes: 0, squeeze: 0,
  mouth: 0, jawTall: 0, tongue: 0, smile: 0.35, fang: 0, brow: 0, browUp: 0, whisk: 0, whiskT: 0, blush: 0.55, tear: 0,
  nfx: 23, nfy: 0, nfa: 0, ffx: 25, ffy: 0, ffa: 0, nhx: -23, nhy: 0, nha: 0.25, fhx: -21, fhy: 0, fha: 0.25,
  legZ: 4.5, armZ: 0, elbow: 0, nfE: 0, ffE: 0, splay: 0, beans: 0, beansH: 0, sole: 0, pawFront: 0, pawFar: 0, paw2: 0,
  tailA: 72, tailCurl: -5, tailTip: -22, tailWave: 5, tailSpd: 1.4, tailQuiver: 0, tailFront: 0, tailPuff: 1, tailLen: 1, tailDX: 0, tailDY: 0,
  purr: 0, blade: 0, hipBump: 0, zzz: 0, colPush: 0, glint: 0
};
const P = (o) => Object.assign({}, BASE, o);
function mix(a, b, w) { if (w <= 0) return Object.assign({}, a); if (w >= 1) return Object.assign({}, b); const o = {}; for (const k in a) o[k] = a[k] + (b[k] - a[k]) * w; return o; }
const LEGS = ['nf', 'ff', 'nh', 'fh'];

/* ============================ rig solver ============================ */
function ik(A, T, l1, l2, bend) {
  const dx = T[0] - A[0], dy = T[1] - A[1], d = Math.hypot(dx, dy) || 1e-3;
  const ux = dx / d, uy = dy / d;
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.05);
  const a = Math.atan2(uy, ux), ca = clamp((l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd), -1, 1);
  const ang = a + bend * Math.acos(ca);
  return { j: [A[0] + Math.cos(ang) * l1, A[1] + Math.sin(ang) * l1], e: [A[0] + ux * dd, A[1] + uy * dd] };
}
// Returns everything in "cat units", screen-oriented (y down), relative to the root on the floor.
function solve(p, T) {
  const c = Math.cos(p.theta), sn = Math.sin(p.theta), up = p.gy + p.lift;
  const pr = (x, y, z = 0) => [x * c - z * sn, -(y + up)];
  const dep = (x, z) => x * sn + z * c;
  const dy = p.shY - p.hipY, L = p.bodyL, dx = Math.sqrt(Math.max(L * L - dy * dy, 16));
  const H = [p.shift - dx / 2, p.hipY], S = [p.shift + dx / 2, p.shY];
  const len = Math.hypot(S[0] - H[0], S[1] - H[1]);
  const u = [(S[0] - H[0]) / len, (S[1] - H[1]) / len], n = [-u[1], u[0]];
  const Cc = [(H[0] + S[0]) / 2 + n[0] * p.arch, (H[1] + S[1]) / 2 + n[1] * p.arch];
  // spine: the quadratic arch degree-elevated to a cubic; `curl` pushes both control points up and outward
  // so the ends roll under (a sleeping cat's C-curl) — continuous from 0 to 1, no cross-fade between drawings
  const cu = p.curl, k1 = cu * 17, k2 = cu * 9;
  const C1 = [H[0] + ((Cc[0] - H[0]) * 2) / 3 - u[0] * k1 + n[0] * k2, H[1] + ((Cc[1] - H[1]) * 2) / 3 - u[1] * k1 + n[1] * k2];
  const C2 = [S[0] + ((Cc[0] - S[0]) * 2) / 3 + u[0] * k1 + n[0] * k2, S[1] + ((Cc[1] - S[1]) * 2) / 3 + u[1] * k1 + n[1] * k2];
  const bz = (s) => { const r = 1 - s, a = r * r * r, b = 3 * r * r * s, e = 3 * r * s * s, d = s * s * s; return [a * H[0] + b * C1[0] + e * C2[0] + d * S[0], a * H[1] + b * C1[1] + e * C2[1] + d * S[1]]; };
  const bzt = (s) => { const r = 1 - s; return [3 * r * r * (C1[0] - H[0]) + 6 * r * s * (C2[0] - C1[0]) + 3 * s * s * (S[0] - C2[0]), 3 * r * r * (C1[1] - H[1]) + 6 * r * s * (C2[1] - C1[1]) + 3 * s * s * (S[1] - C2[1])]; };
  const bzn = (s) => { const t = nrm(bzt(s)); return [-t[1], t[0]]; };
  const tS = nrm(bzt(1)), tH = nrm(bzt(0));
  const uS = nrm([lerp(u[0], tS[0], cu), lerp(u[1], tS[1], cu)]), nS = [-uS[1], uS[0]];
  const uH = nrm([lerp(u[0], tH[0], cu), lerp(u[1], tH[1], cu)]), nH = [-uH[1], uH[0]];
  // mass: haunch and chest fuller than the waist
  const rad = (s) => (lerp(13.6, 15.0, s) + 1.1 * gs(s, 0.08, 0.14) - 0.8 * gs(s, 0.52, 0.16) + 0.6 * gs(s, 0.9, 0.1)) * p.bodyR * (1 + 0.1 * sn);
  const torso = [];
  const NT = 24;
  for (let i = 0; i <= NT; i++) {
    const s = i / NT, b = bz(s), nn = bzn(s), sg = p.sag * 0.55 * gs(s, 0.42, 0.26); // belly pouch sags behind the ribs
    const q = pr(b[0] - nn[0] * sg, b[1] - nn[1] * sg); torso.push([q[0], q[1], rad(s) + sg]);
  }
  { const q = pr(S[0] + uS[0] * 4 - nS[0] * 5, S[1] + uS[1] * 4 - nS[1] * 5); torso.push([q[0], q[1], 12.6 * p.bodyR]); }
  { const r = 15 * p.bodyR - 4.6 + p.blade; const q = pr(S[0] + nS[0] * r - uS[0] * 3, S[1] + nS[1] * r - uS[1] * 3); torso.push([q[0], q[1], 4.8]); }
  { const r = rad(0) - 4.9 + p.hipBump; const q = pr(H[0] + nH[0] * r + uH[0] * 2.5, H[1] + nH[1] * r + uH[1] * 2.5); torso.push([q[0], q[1], 5.2]); }
  const Hb = [S[0] + Math.cos(p.neckA * D2R) * p.neckL + p.headDX, S[1] + Math.sin(p.neckA * D2R) * p.neckL + p.headDY];
  const N0 = [S[0] + uS[0] + nS[0] * 3, S[1] + uS[1] + nS[1] * 3];
  const neck = [];
  for (let i = 0; i <= 6; i++) { const s = (i / 6) * 0.8; const q = pr(lerp(N0[0], Hb[0], s), lerp(N0[1], Hb[1], s)); neck.push([q[0], q[1], lerp(10.8, 9.4, s)]); }
  const head = pr(Hb[0], Hb[1]);
  const psi = lerp(p.theta, PI / 2, p.faceCam) + p.lookTurn;
  const o = clamp(Math.cos(psi), -0.8, 0.8);
  // legs
  const legs = [];
  for (const k of LEGS) {
    const front = k[1] === 'f', near = k[0] === 'n';
    const z = (near ? 1 : -1) * (p.legZ * (front ? 1 : 1.15) + (front ? p.armZ : 0));
    const fx = p[k + 'x'], fy = p[k + 'y'], fa = p[k + 'a'];
    if (front) {
      const J = [S[0] - nS[0] * 4.5, S[1] - nS[1] * 4.5];
      const r = ik(J, [fx - 1.5, fy + 6.2], 16, 16, -1 + 2 * clamp(p.elbow + p[k + 'E'])); // elbow: 0 bends back (standing), 1 bends down/out (lying, paws up)
      if (r.j[1] < 2.5) r.j[1] = 2.5; if (r.e[1] < 1.5) r.e[1] = 1.5;
      const off = rot2([1.5, -2.8], fa), Pc = [r.e[0] + off[0], r.e[1] + off[1]], td = rot2([1, 0], fa);
      legs.push({ k, front, near, depth: dep(J[0], z), J: pr(J[0], J[1], z), E: pr(r.j[0], r.j[1], z), W: pr(r.e[0], r.e[1], z), P: pr(Pc[0], Pc[1], z), td: [td[0] * c, -td[1]], lift: Pc[1] - 3.4 });
    } else {
      const J = [H[0] - nH[0] * 3 + uH[0], H[1] - nH[1] * 3 + uH[1]];
      const Pc = [fx, fy + 3.4], heel = [Pc[0] - 2.6, Pc[1] + 0.9];
      const Hk = [heel[0] - Math.sin(fa) * 12, heel[1] + Math.cos(fa) * 12];
      const r = ik(J, Hk, 14.5, 14.5, 1);
      const heel2 = [r.e[0] + Math.sin(fa) * 12, r.e[1] - Math.cos(fa) * 12], Pc2 = [heel2[0] + 2.6, heel2[1] - 0.9];
      legs.push({ k, front, near, depth: dep(J[0], z), J: pr(J[0], J[1], z), K: pr(r.j[0], r.j[1], z), Hk: pr(r.e[0], r.e[1], z), Hl: pr(heel2[0], heel2[1], z), P: pr(Pc2[0], Pc2[1], z), td: [c, 0], lift: Pc2[1] - 3.4 });
    }
  }
  // tail: lagged chain with ground contact
  const tail = [];
  {
    const T0 = [H[0] - uH[0] * 11 + nH[0] * 3.5 + p.tailDX, H[1] - uH[1] * 11 + nH[1] * 3.5 + p.tailDY];
    const NS = 12, SL = 4.7 * p.tailLen, tw = T * p.tailSpd * PI;
    let a = PI - p.tailA * D2R, x = T0[0], y = T0[1];
    const w0 = 5.5 * p.tailPuff;
    tail.push([...pr(x, y), w0]);
    for (let i = 1; i <= NS; i++) {
      const f = i / NS;
      let inc = p.tailCurl * D2R + (i >= 8 ? (p.tailTip * D2R) / 5 : 0);
      inc += p.tailWave * D2R * 0.36 * Math.sin(tw - i * 0.55);
      if (i < 5) inc += p.tailQuiver * D2R * 1.6 * Math.sin(T * 41 + i * 1.3);
      a += inc;
      x += Math.cos(a) * SL; y += Math.sin(a) * SL;
      const w = lerp(5.5, 4.1, f) * p.tailPuff;
      if (y < w * 0.92 - p.lift) y = w * 0.92 - p.lift;
      tail.push([...pr(x, y), w]);
    }
  }
  return { pr, c, sn, H, S, u, n, uS, nS, uH, nH, bz, bzn, rad, torso, neck, head, Hb, o, legs, tail };
}

/* ============================ drawing ============================ */
function drawShadow(g, R, p, st) {
  const gy = -p.gy;
  let minx = 1e9, maxx = -1e9;
  for (const t of R.torso) { minx = Math.min(minx, t[0] - t[2]); maxx = Math.max(maxx, t[0] + t[2]); }
  const cx = (minx + maxx) / 2, rx = (maxx - minx) / 2 + 10, k = clamp(1 - p.lift / 45, 0.4, 1);
  g.save(); g.translate(cx, gy + 0.6); g.scale(1, 0.15);
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, rx * k);
  grd.addColorStop(0, st.shadowA(0.9 * k)); grd.addColorStop(0.6, st.shadowA(0.45 * k)); grd.addColorStop(1, st.shadowA(0));
  g.fillStyle = grd; g.beginPath(); g.arc(0, 0, rx * k, 0, TAU); g.fill(); g.restore();
  for (const L of R.legs) {
    const h = L.lift + p.lift; if (h > 5) continue;
    g.fillStyle = st.shadowA(0.5 * (1 - h / 5)); g.beginPath(); g.ellipse(L.P[0], gy + 0.4, 6.2, 1.5, 0, 0, TAU); g.fill();
  }
}

function drawTorso(g, R, p, st) {
  const ow = st.ow, path = new Path2D();
  for (const t of R.torso) circ(path, t[0], t[1], t[2]);
  for (const t of R.neck) circ(path, t[0], t[1], t[2]);
  let top = 1e9, bot = -1e9;
  for (const t of R.torso) { top = Math.min(top, t[1] - t[2]); bot = Math.max(bot, t[1] + t[2]); }
  const grd = g.createLinearGradient(0, top, 0, bot);
  grd.addColorStop(0, C.furLt); grd.addColorStop(0.42, C.fur); grd.addColorStop(1, C.furSh);
  ink(g, path, grd, ow);
  g.save(); g.clip(path);
  const vis = Math.abs(R.c);
  // a point on the body: spine param s, v = fraction of the local radius toward the back (+) or belly (−), da along the spine
  const B = (s, v, da = 0) => { s = clamp(s, 0, 1); const b = R.bz(s), nn = R.bzn(s), off = v * R.rad(s); return R.pr(b[0] + nn[0] * off + nn[1] * da, b[1] + nn[1] * off - nn[0] * da); };
  // white belly: a soft, tufted edge that rises into the chest bib (no ruler-straight line)
  {
    const topE = [], N = 26;
    for (let i = 0; i <= N; i++) {
      const s = lerp(0.16, 1.0, i / N);
      let v = -0.66 + 0.22 * sstep((s - 0.3) / 0.45) + 0.62 * sstep((s - 0.74) / 0.26) + 0.035 * Math.sin(s * 37);
      if (i > 0 && i < N) v += i % 2 ? 0.09 : -0.02; // fur tufts
      topE.push(B(s, v));
    }
    const botE = []; for (let i = N; i >= 0; i -= 2) botE.push(B(lerp(0.16, 1.0, i / N), -1.7));
    const wp = new Path2D(); smoothPoly(wp, [B(0.1, -0.95)].concat(topE, [B(1, 0.3, 4)], botE));
    soft(g, st, 'rgba(252,251,247,.9)', 1.4); g.fillStyle = C.wh; g.fill(wp); hard(g);
    const bib = R.pr(R.S[0] + R.uS[0] * 4 - R.nS[0] * 4.2, R.S[1] + R.uS[1] * 4 - R.nS[1] * 4.2);
    g.fillStyle = C.wh; g.beginPath(); g.ellipse(bib[0], bib[1], 8 + 6 * R.sn, 12 + 3.5 * R.sn, 0, 0, TAU); g.fill();
  }
  // tabby marbling like the photo: solid, darker blue-grey, soft-edged and following the body
  if (vis > 0.05 && !st.lod) {
    g.globalAlpha = Math.min(1, 1.25 * vis);
    soft(g, st, 'rgba(77,84,104,.75)');
    g.fillStyle = C.blot;
    const mp = new Path2D();
    // dorsal saddle with a wavy lower edge
    { const upE = [], dnE = []; for (let i = 0; i <= 20; i++) { const s = lerp(0.0, 0.97, i / 20); upE.push(B(s, 1.25)); dnE.push(B(s, 0.86 + 0.08 * p.curl - 0.07 * Math.sin(s * 19 + 1) - 0.08 * gs(s, 0.62, 0.05) - 0.08 * gs(s, 0.78, 0.05))); } smoothPoly(mp, upE.concat(dnE.reverse())); }
    // the bull's-eye blotch on the flank: a solid dark oyster inside an open outer ring
    const sc = 0.3, vc = 0.08, Lp = (rx, ry, a) => B(sc + (rx * Math.cos(a)) / 52, vc + (ry * Math.sin(a)) / 14.5);
    { const pts = []; for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU, wob = 1 + 0.09 * Math.sin(a * 3 + 0.6); pts.push(Lp(6.4 * wob, 5.4 * wob, a)); } smoothPoly(mp, pts); }
    { const pts = []; for (let i = 0; i <= 16; i++) pts.push(Lp(11.6, 9.4, lerp(-0.95, 3.75, i / 16))); band(mp, pts, taperW(2.9, 2.2, 0.16, 0.22)); }
    // curved, tapered rib bands on the front half, sweeping back as they descend
    for (const [s0, len, w, sw] of [[0.5, 0.95, 2.5, 0.07], [0.61, 1.05, 2.7, 0.08], [0.72, 0.9, 2.4, 0.07], [0.83, 0.82, 2.3, 0.06]]) {
      const pts = []; for (let j = 0; j <= 7; j++) { const f = j / 7; pts.push(B(s0 - sw * Math.pow(f, 1.4) + 0.012 * Math.sin(f * 6 + s0 * 9), 0.8 - len * f)); }
      band(mp, pts, taperW(w, 0.5, 0.12, 0.3));
    }
    // a short branch from the ring toward the haunch
    { const pts = []; for (let j = 0; j <= 5; j++) { const f = j / 5; pts.push(B(0.12 - 0.05 * f, 0.72 - 0.95 * f)); } band(mp, pts, taperW(2.4, 0.6)); }
    g.fill(mp); hard(g);
    // light hand-drawn fur strokes
    g.globalAlpha = 0.5 * vis; g.strokeStyle = C.furLt; g.lineWidth = 0.9;
    for (let s = 0.08; s < 0.9; s += 0.085) { const a = B(s, -0.15), b = B(s - 0.03, -0.32); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    g.globalAlpha = 1;
  }
  g.restore();
}

function pawEllipse(path, L, rxMax, ry, sole) {
  const f = Math.hypot(L.td[0], L.td[1]), ang = Math.atan2(L.td[1], L.td[0]);
  ell(path, L.P[0], L.P[1], lerp(lerp(ry + 0.2, rxMax, clamp(f)), 5.6, sole), lerp(ry, 5.4, sole), ang);
  return ang;
}
function drawLeg(g, L, p, st, far) {
  const ow = st.ow, fur = far ? C.far : C.fur, wh = far ? C.farWh : C.wh, dk = far ? C.farDk : C.blot;
  const sole = L.front ? 0 : p.sole;
  const path = new Path2D();
  if (L.front) { caps(path, L.J, 7.5, L.E, 5.6); caps(path, L.E, 5.5, L.W, 4.5); }
  else {
    const hc = mid(L.J, L.K, 0.42), ha = Math.atan2(L.K[1] - L.J[1], L.K[0] - L.J[0]);
    ell(path, hc[0], hc[1], 13.2, 10.8, ha);
    caps(path, L.K, 6.0, L.Hk, 4.4); caps(path, L.Hk, 4.3, L.Hl, 3.9);
  }
  const pang = pawEllipse(path, L, L.front ? 5.9 : 6.2, 4.0, sole);
  ink(g, path, fur, ow);
  g.save(); g.clip(path);
  if (!st.lod) {
    g.fillStyle = dk; g.globalAlpha = far ? 0.8 : 0.95; soft(g, st, far ? 'rgba(75,82,101,.6)' : 'rgba(77,84,104,.7)', 0.8);
    const mp = new Path2D();
    const across = (A, B2, t, w, th) => { const q = mid(A, B2, t), dx = B2[0] - A[0], dy = B2[1] - A[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, ux = dx / d, uy = dy / d; const pts = []; for (let j = 0; j <= 5; j++) { const f = (j / 5) * 2 - 1; pts.push([q[0] + nx * w * f + ux * 1.6 * (1 - f * f), q[1] + ny * w * f + uy * 1.6 * (1 - f * f)]); } band(mp, pts, taperW(th, th * 0.7, 0.25, 0.25)); };
    if (L.front) { across(L.J, L.E, 0.4, 8, 1.6); across(L.J, L.E, 0.76, 7, 1.4); across(L.E, L.W, 0.2, 6, 1.25); }
    else {
      // haunch swirl: a solid oyster spot inside a crescent, like the thigh in the photo
      const hc = mid(L.J, L.K, 0.42), ha = Math.atan2(L.K[1] - L.J[1], L.K[0] - L.J[0]);
      const lp = (x, y) => { const v = rot2([x, y], ha); return [hc[0] + v[0], hc[1] + v[1]]; }; // thigh frame: x hip → knee
      { const pts = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; pts.push(lp(-3 + 5.6 * (1 + 0.12 * Math.sin(3 * a + 1)) * Math.cos(a), -1.5 + 4.4 * (1 + 0.1 * Math.cos(2 * a)) * Math.sin(a))); } smoothPoly(mp, pts); }
      for (const [x0, w] of [[5.5, 1.7], [10, 1.4]]) { const pts = []; for (let i = 0; i <= 6; i++) { const f = i / 6; pts.push(lp(x0 - 2.5 * Math.sin(PI * f), lerp(-11, 11, f))); } band(mp, pts, taperW(w, w * 0.6, 0.3, 0.3)); }
      across(L.K, L.Hk, 0.3, 6.5, 1.3); across(L.K, L.Hk, 0.62, 6, 1.1);
    }
    g.fill(mp); hard(g); g.globalAlpha = 1;
  }
  // white socks (smaller on the far side, so those legs read as behind the body)
  const sp = new Path2D();
  if (L.front) { if (far) caps(sp, mid(L.E, L.W, 0.85), 5, L.P, 7); else caps(sp, mid(L.E, L.W, 0.55), 6.5, L.P, 7.5); }
  else if (far) caps(sp, mid(L.Hk, L.Hl, 0.5), 5.5, L.P, 7.5);
  else { caps(sp, mid(L.K, L.Hk, 0.6), 7.5, L.Hl, 8); caps(sp, L.Hl, 8, L.P, 8); }
  soft(g, st, far ? 'rgba(201,201,212,.8)' : 'rgba(252,251,247,.85)', 0.9); g.fillStyle = wh; g.fill(sp); hard(g);
  // toes
  const ca = Math.cos(pang), sa = Math.sin(pang), rx = L.front ? 5.9 : 6.2;
  if (sole < 0.5) {
    g.strokeStyle = far ? '#a9a9b8' : '#cfcdd9'; g.lineWidth = 0.75;
    const spread = 1.25 + p.splay * 0.9;
    for (const s of [-1, 1]) { const tx = L.P[0] + ca * rx * 0.98 - sa * s * spread, ty = L.P[1] + sa * rx * 0.98 + ca * s * spread; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx - ca * 2.6, ty - sa * 2.6); g.stroke(); }
  }
  g.restore();
  // toe beans when a front paw is shown (pink and grey like the photo)
  const showK = p.pawFar > 0.5 ? 'ff' : 'nf';
  if (p.beans > 0.3 && L.front && (L.k === showK || p.paw2 > 0.5)) {
    g.save(); g.translate(L.P[0], L.P[1]); g.rotate(pang); g.globalAlpha = clamp(p.beans);
    g.fillStyle = C.bean; g.beginPath(); g.ellipse(-0.6, 0.9, 2.3, 1.6, 0, 0, TAU); g.fill();
    const tb = [[2.6, -1.6, C.bean], [3.4, 0.6, C.beanGr], [2.6, 2.7, C.bean]];
    for (const b of tb) { g.fillStyle = b[2]; g.beginPath(); g.ellipse(b[0], b[1], 1.1, 0.95, 0, 0, TAU); g.fill(); }
    g.restore();
  }
  // hind-paw soles facing the viewer (the sleep curl): main pad + four toe beans
  if (sole > 0.3 && p.beansH > 0.3) {
    g.save(); g.translate(L.P[0], L.P[1]); g.rotate(pang); g.globalAlpha = clamp(p.beansH) * (far ? 0.75 : 1);
    g.fillStyle = C.bean; g.beginPath(); g.ellipse(-1.0, 0.2, 2.4, 2.1, 0, 0, TAU); g.fill();
    const tb = [[1.9, -3.0, C.bean], [3.4, -1.05, C.beanGr], [3.4, 1.2, C.bean], [1.9, 3.15, C.beanGr]];
    for (const b of tb) { g.fillStyle = b[2]; g.beginPath(); g.ellipse(b[0], b[1], 1.05, 0.9, 0, 0, TAU); g.fill(); }
    g.restore();
  }
}

function drawTail(g, R, p, st) {
  const ow = st.ow, pts = R.tail, n = pts.length, left = [], right = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, w = pts[i][2];
    left.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); right.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  const path = new Path2D();
  smoothPoly(path, left.concat(right.reverse()));
  circ(path, pts[n - 1][0], pts[n - 1][1], pts[n - 1][2]); circ(path, pts[0][0], pts[0][1], pts[0][2]);
  ink(g, path, C.fur, ow);
  g.save(); g.clip(path);
  g.fillStyle = C.blot; soft(g, st, 'rgba(77,84,104,.6)', 0.7);
  const rp = new Path2D();
  for (const [i, th] of [[2, 1.3], [4, 1.45], [6, 1.5], [8, 1.6], [10, 1.6]]) {
    const a = pts[i - 1], b = pts[i + 1], q = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, w = q[2] + 1.5;
    const ring = []; for (let j = 0; j <= 4; j++) { const f = (j / 4) * 2 - 1; ring.push([q[0] + nx * w * f - (dx / d) * 1.3 * (1 - f * f), q[1] + ny * w * f - (dy / d) * 1.3 * (1 - f * f)]); }
    band(rp, ring, () => th);
  }
  g.fill(rp); hard(g);
  g.fillStyle = C.blot;
  const t1 = pts[n - 1], t0 = pts[n - 2];
  g.beginPath(); g.arc(t1[0], t1[1], t1[2] + 1, 0, TAU); g.fill();
  g.beginPath(); g.arc(lerp(t0[0], t1[0], 0.5), lerp(t0[1], t1[1], 0.5), t1[2] + 0.6, 0, TAU); g.fill();
  if (!st.lod) {
    g.globalAlpha = 0.5; g.strokeStyle = C.furLt; g.lineWidth = 0.9;
    for (let i = 1; i < n - 2; i += 2) { const q = pts[i]; g.beginPath(); g.moveTo(q[0] - 1.5, q[1] - q[2] * 0.4); g.lineTo(q[0] + 0.8, q[1] - q[2] * 0.75); g.stroke(); }
  }
  g.restore();
}

/* ---------- head ---------- */
function drawCollar(g, o, ow) {
  const cx = o * 3.2, cy = 13.9, rx = 13.4, ry = 6.5;
  g.save(); g.lineCap = 'round';
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0.1 * PI, 0.9 * PI);
  g.strokeStyle = C.out; g.lineWidth = 4.8 + ow * 2; g.stroke();
  g.strokeStyle = C.collar; g.lineWidth = 4.8; g.stroke();
  g.beginPath(); g.ellipse(cx, cy - 1.2, rx - 0.6, ry - 0.6, 0, 0.16 * PI, 0.84 * PI);
  g.strokeStyle = C.collarLt; g.globalAlpha = 0.8; g.lineWidth = 1.1; g.stroke(); g.globalAlpha = 1;
  g.restore();
}
function tagAnchor(o) { const a = PI / 2 - o * 0.55; return [o * 3.2 + 13.4 * Math.cos(a), 13.9 + 6.5 * Math.sin(a) + 1.3]; }
// Shield tag. It swings (st.tagA is clamped so the check always reads as a check) and, when the chin
// is near the floor, it is tucked face-on and foreshortened (st.tagSq) instead of lying edge-on.
function drawTag(g, o, st, ow) {
  const [ax, ay] = tagAnchor(o);
  g.save(); g.translate(ax, ay); g.rotate(st.tagA); g.scale(st.tagS, st.tagS * st.tagSq);
  g.strokeStyle = '#97a0ba'; g.lineWidth = 1.1; g.beginPath(); g.arc(0, 1.0, 1.45, 0, TAU); g.stroke();
  const w = 8.8, h = 10, y0 = 2.5;
  const sp = new Path2D();
  sp.moveTo(-w / 2, y0 + 1); sp.quadraticCurveTo(-w / 4, y0 + 0.3, 0, y0 - 0.5); sp.quadraticCurveTo(w / 4, y0 + 0.3, w / 2, y0 + 1);
  sp.lineTo(w / 2, y0 + h * 0.46); sp.quadraticCurveTo(w / 2, y0 + h * 0.84, 0, y0 + h); sp.quadraticCurveTo(-w / 2, y0 + h * 0.84, -w / 2, y0 + h * 0.46); sp.closePath();
  const tg = g.createLinearGradient(-w / 2, y0, w / 2, y0 + h); tg.addColorStop(0, C.tagA); tg.addColorStop(0.55, '#dfe3ee'); tg.addColorStop(1, C.tagB);
  ink(g, sp, tg, (ow * 0.8) / st.tagS, C.tagEdge);
  g.save(); g.clip(sp);
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-w / 2 + 1.1, y0 + 1.6); g.lineTo(-w / 2 + 1.1, y0 + h * 0.46); g.stroke();
  const gx = lerp(-12, 12, st.glint);
  g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.moveTo(gx - 1.2, y0 - 2); g.lineTo(gx + 1.4, y0 - 2); g.lineTo(gx - 3.4, y0 + h + 2); g.lineTo(gx - 6, y0 + h + 2); g.closePath(); g.fill();
  g.restore();
  g.strokeStyle = C.collar; g.lineWidth = st.lod ? 2.1 : 1.7; g.lineCap = 'round'; g.lineJoin = 'round';
  if (st.mirror) g.scale(-1, 1); // a mirrored narrator still wears a readable check
  g.beginPath(); g.moveTo(-2.4, y0 + h * 0.5); g.lineTo(-0.5, y0 + h * 0.69); g.lineTo(2.8, y0 + h * 0.31); g.stroke();
  if (st.spark > 0.05) { // a little four-point star catching the light
    g.globalAlpha = st.spark; g.fillStyle = '#fff'; const sx = 3.2, sy = y0 + 1.6, r = 2.6;
    g.beginPath(); g.moveTo(sx, sy - r); g.lineTo(sx + 0.6, sy - 0.6); g.lineTo(sx + r, sy); g.lineTo(sx + 0.6, sy + 0.6); g.lineTo(sx, sy + r); g.lineTo(sx - 0.6, sy + 0.6); g.lineTo(sx - r, sy); g.lineTo(sx - 0.6, sy - 0.6); g.closePath(); g.fill(); g.globalAlpha = 1;
  }
  g.restore();
}
function drawEar(g, p, o, k, fy, st) {
  const ow = st.ow, far = Math.max(0, k * o), flat = Math.max(0, -p.earRot), perk = Math.max(0, p.earRot);
  const w = 15.6 * (1 - 0.42 * far), h = 17.6 * (1 - 0.1 * far) * (1 - 0.16 * flat) + perk * 1.2;
  const bx = k * (11.8 - far * 2) + o * 6.2, by = -12.3 + fy * 0.35 + flat * 1.6;
  const rot = k * (0.3 + 0.62 * flat - 0.14 * perk) + (k < 0 ? p.earL : p.earR) * k;
  g.save(); g.translate(bx, by); g.rotate(rot);
  const tx = k * 1.2, ep = new Path2D();
  ep.moveTo(-w / 2, 3); ep.quadraticCurveTo(-w * 0.4, -h * 0.55, tx - 1.7, -h + 1.6); ep.quadraticCurveTo(tx, -h - 0.9, tx + 1.7, -h + 1.6); ep.quadraticCurveTo(w * 0.4, -h * 0.55, w / 2, 3); ep.closePath();
  const eg = g.createLinearGradient(0, -h, 0, 3); eg.addColorStop(0, C.furDk); eg.addColorStop(0.4, C.fur); eg.addColorStop(1, C.furLt);
  ink(g, ep, eg, ow);
  const iw = w * 0.56 * (1 - far * 0.55), ih = h * 0.72, ix = -k * w * 0.07 * (1 - far);
  const ip = new Path2D();
  ip.moveTo(ix - iw / 2, 2); ip.quadraticCurveTo(ix - iw * 0.36, -ih * 0.55, ix + tx * 0.6, -ih); ip.quadraticCurveTo(ix + iw * 0.36, -ih * 0.55, ix + iw / 2, 2); ip.closePath();
  const ig = g.createLinearGradient(0, -ih, 0, 2); ig.addColorStop(0, C.earIn); ig.addColorStop(1, C.earIn2);
  g.fillStyle = ig; g.fill(ip);
  if (!st.lod) {
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 0.7; g.lineCap = 'round';
    for (const s of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(ix + s * iw * 0.5, 2); g.quadraticCurveTo(ix + s * iw * 0.9, -ih * 0.25, ix + s * iw * 0.3 - k * 0.8, -ih * 0.48); g.stroke(); }
  }
  g.restore();
}
function drawEyes(g, p, o, fy, st) {
  const m = o * 8.5, es = st.eyeS;
  for (const k of [-1, 1]) {
    const far = Math.max(0, k * o), fw = 1 - 0.42 * far;
    const ex = m + k * 10.2 * (1 - 0.3 * far), ey = -0.6 + fy;
    const rx = 6.3 * fw * es, ry = 7.0 * p.eyeOpen * es;
    g.save(); g.translate(ex, ey); g.rotate(k * 0.1);
    if (p.lid < 0.82) {
      // the pale socket halo fades as the lids close, and the lids are clipped to it, so a half-closed
      // eye never shows a grey disc inside a light ring ("goggles")
      const shut = Math.max(p.lid, p.lidLow * 0.85), halo = 1 - sstep((shut - 0.12) / 0.45);
      if (halo > 0.02) { g.fillStyle = `rgba(238,240,246,${(0.5 * halo).toFixed(3)})`; g.beginPath(); g.ellipse(0, 0.4, rx + 2.1, ry + 1.9, 0, 0, TAU); g.fill(); }
      g.fillStyle = C.rim; g.beginPath(); g.ellipse(0, 0, rx + 0.95, ry + 0.95, 0, 0, TAU); g.fill();
      const lx = clamp(p.lookX, -1, 1) * rx * 0.42, ly = clamp(p.lookY, -1, 1) * ry * 0.28;
      const ig = g.createRadialGradient(lx, ly, 0.3, 0, 0, Math.max(rx, ry));
      ig.addColorStop(0, C.irisA); ig.addColorStop(0.4, C.irisM); ig.addColorStop(0.74, C.irisB); ig.addColorStop(1, C.irisC);
      g.fillStyle = ig; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill();
      const prx = lerp(1.15, 4.6, p.pupil) * fw * es, pry = lerp(5.7, 5.3, p.pupil) * p.eyeOpen * es;
      g.fillStyle = C.pupil; g.beginPath(); g.ellipse(lx, ly, prx, pry, 0, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(-rx * 0.3 + lx * 0.25, -ry * 0.37 + ly * 0.2, (2.0 * fw + 0.25) * es, 2.25 * es, -0.3, 0, TAU); g.fill();
      g.globalAlpha = 0.85; g.beginPath(); g.arc(rx * 0.34 + lx * 0.2, ry * 0.34, 0.95 * es, 0, TAU); g.fill(); g.globalAlpha = 1;
      if (p.lid > 0.01 || p.lidLow > 0.01) {
        g.save(); g.beginPath(); g.ellipse(0, 0.2, rx + 2.3, ry + 2.1, 0, 0, TAU); g.clip();
        if (p.lid > 0.01) {
          const yl = -ry - 1.3 + (2 * ry + 2.6) * p.lid;
          g.fillStyle = C.fur; g.beginPath(); g.moveTo(-rx - 3, -ry - 4); g.lineTo(rx + 3, -ry - 4); g.lineTo(rx + 3, yl - 1.5); g.quadraticCurveTo(0, yl + 2.2, -rx - 3, yl - 1.5); g.closePath(); g.fill();
          g.strokeStyle = C.rim; g.lineWidth = 1.35; g.beginPath(); g.moveTo(rx + 0.6, yl - 0.6); g.quadraticCurveTo(0, yl + 2.2, -rx - 0.6, yl - 0.6); g.stroke();
        }
        if (p.lidLow > 0.01) {
          const yb = ry + 1.3 - (2 * ry + 2.6) * p.lidLow * 0.55;
          g.fillStyle = C.fur; g.beginPath(); g.moveTo(-rx - 3, ry + 4); g.lineTo(rx + 3, ry + 4); g.lineTo(rx + 3, yb + 1.6); g.quadraticCurveTo(0, yb - 2.6, -rx - 3, yb + 1.6); g.closePath(); g.fill();
          g.strokeStyle = C.rim; g.lineWidth = 1.1; g.beginPath(); g.moveTo(rx + 0.6, yb + 0.8); g.quadraticCurveTo(0, yb - 2.6, -rx - 0.6, yb + 0.8); g.stroke();
        }
        g.restore();
      }
    } else {
      // closed eyes are a single dark arc, no disc
      g.strokeStyle = C.rim; g.lineWidth = 1.75 * Math.max(1, es * 0.9); g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
      if (p.squeeze > 0.5) { g.moveTo(k * rx * 0.95, -3.1); g.lineTo(-k * rx * 0.55, 0.2); g.lineTo(k * rx * 0.95, 3.3); }
      else if (p.happyEyes > 0.5) { g.moveTo(-rx, 1.9); g.quadraticCurveTo(0, -4.7, rx, 1.9); }
      else { g.moveTo(-rx, 0.4); g.quadraticCurveTo(0, 4.6, rx, 0.4); g.moveTo(k * rx, 0.4); g.lineTo(k * (rx + 1.7), -0.9); }
      g.stroke();
    }
    g.restore();
    // brow tuft
    const wor = Math.max(0, -p.brow), ang = Math.max(0, p.brow), byb = ey - ry - 2.4 - p.browUp * 1.6;
    g.strokeStyle = C.furDk; g.lineWidth = 1.5; g.lineCap = 'round'; g.globalAlpha = 0.85;
    g.beginPath(); g.moveTo(ex - k * 3.2 * fw, byb - wor * 2.3 + ang * 1.5); g.quadraticCurveTo(ex, byb - 1.2, ex + k * 3.6 * fw, byb - 0.6 + wor * 1.3 - ang * 0.7); g.stroke();
    g.globalAlpha = 1;
  }
}
function mouthGeo(p, o, fy) { const nx = o * 8.5 + o * 2.4, ny = 4.6 + fy * 0.8; return { nx, ny, my: ny + 1.9 }; }
function drawTongue(g, p, o, fy) {
  if (p.tongue < 0.05 || p.mouth > 0.4) return;
  const { nx, my } = mouthGeo(p, o, fy), t = p.tongue;
  const cx = nx + o * 1.0, cy = my + 2.7 + 2.2 * t;
  g.fillStyle = C.tongue; g.strokeStyle = C.tongueDk; g.lineWidth = 0.7;
  g.beginPath(); g.ellipse(cx, cy, 2.4, 1.5 + 1.9 * t, 0, 0, TAU); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(cx, cy - 0.8); g.lineTo(cx, cy + 1.2 * t); g.stroke();
}
function drawMouthNose(g, p, o, fy) {
  const ao = Math.abs(o), { nx, ny, my } = mouthGeo(p, o, fy);
  const kL = o > 0 ? 1 : 1 - 0.35 * ao, kR = o < 0 ? 1 : 1 - 0.35 * ao;
  if (p.mouth > 0.04) {
    const mw = (3.0 + 3.3 * p.mouth + 0.6 * Math.max(0, p.smile)) * (1 - 0.18 * ao) * (1 - 0.3 * p.jawTall), mh = (1.0 + 8.6 * p.mouth) * (1 + 0.45 * p.jawTall), top = my + 1.0, cx = nx + o * 0.6;
    const mp = new Path2D();
    mp.moveTo(cx - mw, top - p.smile * 0.6); mp.quadraticCurveTo(cx, top - 1.0, cx + mw, top - p.smile * 0.6);
    mp.bezierCurveTo(cx + mw * 1.05, top + mh * 1.25, cx - mw * 1.05, top + mh * 1.25, cx - mw, top - p.smile * 0.6); mp.closePath();
    g.fillStyle = C.mouth; g.fill(mp);
    g.save(); g.clip(mp);
    g.fillStyle = C.tongue; g.beginPath(); g.ellipse(cx + o * 0.8, top + mh * 0.98, mw * 0.74, mh * 0.42 + 0.9 + p.tongue * 1.2, 0, 0, TAU); g.fill();
    g.strokeStyle = C.tongueDk; g.lineWidth = 0.6; g.beginPath(); g.moveTo(cx + o * 0.8, top + mh * 0.62); g.lineTo(cx + o * 0.8, top + mh); g.stroke();
    if (p.fang > 0.2 || p.mouth > 0.5) { g.fillStyle = '#fff'; for (const s of [-1, 1]) { const fx = cx + s * mw * 0.56; g.beginPath(); g.moveTo(fx - 0.9, top - 0.6); g.lineTo(fx + 0.9, top - 0.6); g.lineTo(fx, top + 1.9); g.closePath(); g.fill(); } }
    g.restore();
    g.strokeStyle = '#4b2533'; g.lineWidth = 0.8; g.stroke(mp);
  }
  g.strokeStyle = '#4a3947'; g.lineWidth = 1.15; g.lineCap = 'round'; g.beginPath();
  g.moveTo(nx, my); g.lineTo(nx, my + 1.6);
  g.moveTo(nx, my + 1.6); g.quadraticCurveTo(nx - 1.7 * kL, my + 3.4, nx - 3.7 * kL, my + 2.4 - p.smile * 1.4);
  g.moveTo(nx, my + 1.6); g.quadraticCurveTo(nx + 1.7 * kR, my + 3.4, nx + 3.7 * kR, my + 2.4 - p.smile * 1.4);
  if (p.smile < -0.2) { g.moveTo(nx - 3.7 * kL, my + 2.4 - p.smile * 1.4); g.lineTo(nx - 4.4 * kL, my + 3.6 - p.smile * 1.4); g.moveTo(nx + 3.7 * kR, my + 2.4 - p.smile * 1.4); g.lineTo(nx + 4.4 * kR, my + 3.6 - p.smile * 1.4); }
  g.stroke();
  drawTongue(g, p, o, fy);
  const nw = 5.8 * (1 - 0.22 * ao), nh = 3.8;
  const np = new Path2D();
  np.moveTo(nx - nw / 2, ny - nh / 2); np.quadraticCurveTo(nx, ny - nh / 2 - 0.9, nx + nw / 2, ny - nh / 2);
  np.quadraticCurveTo(nx + nw * 0.24, ny + nh * 0.32, nx, ny + nh / 2); np.quadraticCurveTo(nx - nw * 0.24, ny + nh * 0.32, nx - nw / 2, ny - nh / 2); np.closePath();
  const ng = g.createLinearGradient(0, ny - nh / 2, 0, ny + nh / 2); ng.addColorStop(0, C.nose); ng.addColorStop(1, C.noseDk);
  g.fillStyle = ng; g.fill(np); g.strokeStyle = '#b65d70'; g.lineWidth = 0.6; g.stroke(np);
  g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(nx - nw * 0.18, ny - nh * 0.2, 0.9, 0.55, -0.3, 0, TAU); g.fill();
}
function drawWhiskers(g, p, o, fy) {
  const m = o * 8.5;
  g.lineCap = 'round';
  for (const k of [-1, 1]) {
    const far = Math.max(0, k * o), fl = 1 - 0.45 * far;
    const bx = m + k * 5.2 * (1 - 0.25 * far), by = 9 + fy * 0.6;
    for (let j = 0; j < 3; j++) {
      const a0 = [-0.2, 0.04, 0.27][j] - p.whisk * 0.22 + p.whiskT * (j === 1 ? 0.2 : 0.12);
      const len = (17 - j * 1.2) * fl, dxx = k * Math.cos(a0), dyy = Math.sin(a0);
      const sx = bx + dxx * 3, sy = by + dyy * 3 + j * 0.9, ex = bx + dxx * len, ey = by + dyy * len + 1.4 + j * 0.9;
      const cx = bx + dxx * len * 0.55, cy = by + dyy * len * 0.55 - 1.3 + j * 0.9;
      g.strokeStyle = 'rgba(55,58,78,.28)'; g.lineWidth = 1.05; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 0.55; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
    }
  }
}
function headXf(g, R, p) { g.translate(R.head[0], R.head[1]); g.rotate(p.headRoll * D2R); const hs = p.headScale; g.scale(hs * (1 + p.squish * 0.06), hs * (1 - p.squish * 0.05)); }
function drawHead(g, R, p, st) {
  const o = R.o, ao = Math.abs(o), ow = st.ow, fy = p.headPitch * 3.2, m = o * 8.5;
  g.save(); headXf(g, R, p);
  drawCollar(g, o, ow);
  for (const k of [-1, 1]) drawEar(g, p, o, k, fy, st);
  const hp = new Path2D();
  ell(hp, -o * 2.2, -1.5 + fy * 0.2, 19.7, 16.4);
  ell(hp, o * 1.0, 5.8 + fy * 0.3, 21.4, 12.6);
  ell(hp, m * 1.25, 8.6 + fy * 0.6, 9.5, 7.8);
  for (const k of [-1, 1]) {
    const far = Math.max(0, k * o), ex = k * (20.6 - far * 1.6) + o * 1.0;
    polyTo(hp, [[ex - k * 2.6, 2.4], [ex + k * 3.5, 7.2], [ex - k * 0.6, 8.7], [ex + k * 2.7, 12.3], [ex - k * 3.8, 13.6]]);
  }
  const hg = g.createRadialGradient(-6 + o * 3, -11, 2, 0, 2, 27);
  hg.addColorStop(0, C.furLt); hg.addColorStop(0.55, C.fur); hg.addColorStop(1, C.furSh);
  ink(g, hp, hg, ow);
  g.save(); g.clip(hp);
  // white lower face (muzzle, chin, lower cheeks), from the photo
  g.fillStyle = C.wh;
  g.beginPath(); g.ellipse(m * 1.1, 12.4 + fy * 0.6, 15 - ao * 2.2, 8.2, 0, 0, TAU); g.fill();
  for (const k of [-1, 1]) { const far = Math.max(0, k * o); g.beginPath(); g.ellipse(m + k * 4.8 * (1 - 0.25 * far), 8.7 + fy * 0.6, 6.6 * (1 - 0.3 * far), 5.4, 0, 0, TAU); g.fill(); }
  g.beginPath(); g.moveTo(m - 2.2, 7 + fy * 0.6); g.quadraticCurveTo(m + o * 2, -1 + fy * 0.5, m + 2.2, 7 + fy * 0.6); g.fill();
  // tabby "M", crown and cheek bars
  g.strokeStyle = C.furDk; g.lineCap = 'round'; g.globalAlpha = 0.85;
  g.lineWidth = st.lod ? 2.4 : 1.9;
  const M = [[m - 7.5, -15.5, m - 5.6, -11, m - 3.6, -7.6], [m - 2.2, -17, m - 0.6, -12.5, m - 0.2, -8.6], [m + 2.4, -17, m + 1.4, -12.5, m + 0.9, -8.6], [m + 7.5, -15.5, m + 5.4, -11, m + 3.8, -7.6]];
  for (const s of M) { g.beginPath(); g.moveTo(s[0], s[1]); g.quadraticCurveTo(s[2], s[3], s[4], s[5]); g.stroke(); }
  g.lineWidth = 2.6; for (const x of [-9, -2.5, 4]) { g.beginPath(); g.moveTo(x - o * 3, -20); g.quadraticCurveTo(x - o * 4, -17, x - o * 6 - 1, -15.8); g.stroke(); }
  if (!st.lod) {
    g.lineWidth = 1.7;
    for (const k of [-1, 1]) {
      const far = Math.max(0, k * o), ex = m + k * 10.2 * (1 - 0.3 * far);
      g.beginPath(); g.moveTo(ex + k * 6.5 * (1 - far * 0.5), 1.8 + fy); g.quadraticCurveTo(ex + k * 10, 0.6 + fy, k * 21, -0.8); g.stroke();
      g.beginPath(); g.moveTo(ex + k * 5.6 * (1 - far * 0.5), 4.6 + fy); g.quadraticCurveTo(ex + k * 9.5, 4.4 + fy, k * 21, 4.4); g.stroke();
    }
  }
  g.globalAlpha = 1;
  // rosy cheeks
  for (const k of [-1, 1]) {
    const far = Math.max(0, k * o), ex = m + k * 10.2 * (1 - 0.3 * far);
    g.fillStyle = C.blush; g.globalAlpha = 0.3 * p.blush * (1 - far * 0.5);
    g.beginPath(); g.ellipse(ex + k * 1.8, 7.6 + fy * 0.8, 3.8 * (1 - far * 0.4), 2.2, 0, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
  g.restore();
  drawEyes(g, p, o, fy, st);
  drawMouthNose(g, p, o, fy);
  if (!st.lod) drawWhiskers(g, p, o, fy);
  if (p.tear > 0.1) { // a small tear under the near eye (sad)
    const k = o > 0 ? -1 : 1, ex = m + k * 10.2 + 1, ey = 7.5 + fy + p.tear * 2;
    g.globalAlpha = clamp(p.tear); g.fillStyle = '#9ed2ff'; g.beginPath(); g.moveTo(ex, ey - 3); g.quadraticCurveTo(ex + 2, ey, ex, ey + 1.6); g.quadraticCurveTo(ex - 2, ey, ex, ey - 3); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ex - 0.5, ey - 0.2, 0.45, 0, TAU); g.fill(); g.globalAlpha = 1;
  }
  drawTag(g, o, st, ow);
  g.restore();
}

/* ---------- effects (hearts, purr bubble, zzz, confetti, rub wisps …) ---------- */
function heart(g, x, y, s) { g.beginPath(); g.moveTo(x, y + s * 0.9); g.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.8, y - s * 1.3, x, y - s * 0.45); g.bezierCurveTo(x + s * 0.8, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9); g.fill(); }
function txt(g, s, x, y, st) { if (st.mirror) { g.save(); g.translate(x, y); g.scale(-1, 1); g.fillText(s, 0, 0); g.restore(); } else g.fillText(s, x, y); }
function drawFx(g, R, p, st) {
  const [hx, hy] = R.head, T = st.T;
  if (p.purr > 0.35) {
    const a = clamp((p.purr - 0.35) / 0.4);
    for (let i = 0; i < 3; i++) {
      const ph = fract(T * 0.42 + i / 3), x = hx + 14 + i * 7 - ph * 4 + Math.sin(ph * 6 + i) * 2, y = hy - 22 - ph * 26;
      g.globalAlpha = a * Math.sin(PI * ph) * 0.9; g.fillStyle = i === 1 ? '#ff9db5' : '#ff7f9f'; heart(g, x, y, 2.6 + i * 0.4);
    }
    g.globalAlpha = a;
    const bx = hx - 34, by = hy - 40, bw = 22, bh = 11;
    g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(79,70,229,.35)'; g.lineWidth = 0.8;
    g.beginPath(); if (g.roundRect) g.roundRect(bx, by, bw, bh, 5.5); else g.rect(bx, by, bw, bh); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(bx + bw - 6, by + bh - 0.4); g.lineTo(bx + bw - 1, by + bh + 4); g.lineTo(bx + bw - 10, by + bh - 0.4); g.closePath(); g.fill();
    g.fillStyle = C.collar; g.font = '600 6.4px Geologica, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    txt(g, 'mrr…', bx + bw / 2 + Math.sin(T * 30) * 0.15, by + bh / 2 + 0.3, st);
    g.globalAlpha = 1;
  }
  if (p.zzz > 0.3) {
    g.fillStyle = st.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) {
      const ph = fract(T * 0.22 + i / 3), x = hx + 10 + ph * 16 + Math.sin(ph * 5 + i) * 2, y = hy - 18 - ph * 30;
      g.globalAlpha = clamp(p.zzz) * Math.sin(PI * ph) * 0.7; g.font = `800 ${5 + ph * 5}px Geologica, system-ui, sans-serif`; txt(g, 'z', x, y, st);
    }
    g.globalAlpha = 1;
  }
  if (st.contact && st.contact.a > 0.05) { // rub contact: a soft press shadow and fur wisps drifting off the pillar edge
    const { x, y, a, dir } = st.contact;
    g.strokeStyle = C.furLt; g.lineCap = 'round'; g.lineWidth = 0.95;
    for (let i = 0; i < 6; i++) {
      const ph = fract(T * 0.55 + hash(i + 3)), wx = x - dir * (2 + ph * 15) + Math.sin(ph * 7 + i) * 2.5, wy = y - 10 + hash(i) * 18 - ph * 16;
      g.globalAlpha = a * Math.sin(PI * ph) * 0.95;
      g.beginPath(); g.moveTo(wx, wy); g.quadraticCurveTo(wx + 1.6, wy - 1.2, wx + 0.6, wy - 3.4); g.stroke();
    }
    g.globalAlpha = 1;
  }
  if (st.confetti > 0.05) {
    const cols = ['#4f46e5', '#ff7a1a', '#ff8ea4', '#34c3a0', '#ffd166'];
    for (let i = 0; i < 16; i++) {
      const ph = fract(T * 0.35 + hash(i)), ang = hash(i + 9) * TAU, r = 18 + ph * 26;
      const x = hx + Math.cos(ang) * r * 1.2, y = hy - 12 + Math.sin(ang) * r * 0.7 + ph * 14;
      g.save(); g.translate(x, y); g.rotate(T * 4 + i); g.globalAlpha = st.confetti * Math.sin(PI * ph);
      g.fillStyle = cols[i % cols.length]; g.fillRect(-1.4, -0.7, 2.8, 1.4); g.restore();
    }
    g.globalAlpha = 1;
  }
  if (st.think > 0.3) {
    g.fillStyle = st.ink; for (let i = 0; i < 3; i++) { const a = clamp(Math.sin(T * 3 - i * 0.7) * 0.5 + 0.6); g.globalAlpha = st.think * a * 0.55; g.beginPath(); g.arc(hx - 18 - i * 5.5, hy - 26 - i * 4, 1.4 + i * 0.6, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
  }
  if (st.surprise > 0.3) {
    g.strokeStyle = C.accent; g.lineWidth = 1.5; g.lineCap = 'round'; g.globalAlpha = st.surprise;
    for (const a of [-2.3, -1.6, -0.9]) { const x = hx + Math.cos(a) * 30, y = hy - 4 + Math.sin(a) * 30; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); g.stroke(); }
    g.globalAlpha = 1;
  }
}

function drawContact(g, st) { // the press shadow on the pillar edge, behind the cat
  const { x, y, a } = st.contact;
  g.save(); g.translate(x, y); g.scale(1, 2.6);
  const sg = g.createRadialGradient(0, 0, 0, 0, 0, 5); sg.addColorStop(0, st.shadowA(0.5 * a)); sg.addColorStop(1, st.shadowA(0));
  g.fillStyle = sg; g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill(); g.restore();
}
function drawCat(g, R, p, st) {
  if (st.contact && st.contact.a > 0.05) drawContact(g, st);
  drawShadow(g, R, p, st);
  const legs = R.legs.slice().sort((a, b) => a.depth - b.depth);
  const tl = p.tailFront < 0.33 ? 0 : p.tailFront < 0.67 ? 1 : 2; // tail layer: behind all, after the torso, or in front of the near hind leg
  const pawK = p.pawFront > 0.5 ? (p.pawFar > 0.5 ? 'ff' : 'nf') : '';
  const pawK2 = p.paw2 > 0.5 ? (pawK === 'ff' ? 'nf' : 'ff') : ''; // second paw over the face (celebrate, cheer)
  if (tl === 0) drawTail(g, R, p, st);
  for (const L of legs) if (L.depth < 0 && L.k !== pawK && L.k !== pawK2) drawLeg(g, L, p, st, true);
  drawTorso(g, R, p, st);
  if (tl === 1) drawTail(g, R, p, st);
  for (const L of legs) if (L.depth >= 0 && !L.front) drawLeg(g, L, p, st, false);
  if (tl === 2) drawTail(g, R, p, st);
  for (const L of legs) if (L.depth >= 0 && L.front && L.k !== pawK && L.k !== pawK2) drawLeg(g, L, p, st, false);
  drawHead(g, R, p, st);
  for (const k of [pawK2, pawK]) {
    if (!k) continue;
    const L = R.legs.find((l) => l.k === k);
    drawLeg(g, L, p, st, false);
  }
  if (pawK && p.tongue > 0.05) { g.save(); headXf(g, R, p); drawTongue(g, p, R.o, p.headPitch * 3.2); g.restore(); }
  drawFx(g, R, p, st);
}
