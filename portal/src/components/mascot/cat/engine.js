/* =====================================================================================
   AI SEL, the Cyclowareness cat mascot: Canvas 2D rig engine (vendored).

   ORIGIN: design/mascot-cat/source/p2.js + p3.js + p4.js (the approved design, final.html), ported
   as an ES module without the demo page wiring (stage, buttons, window.cat). The drawing, poses,
   behaviours, moods and gestures are the design's, unchanged. Integration changes only:
     - no side effects at module load: matchMedia, the theme reader and the visibilitychange listener
       start lazily with the first instance (the module may be evaluated during SSR);
     - the theme reader falls back to the portal's tokens (--color-ink) and the design's light shadow,
       and the effect text uses the page's own font;
     - the canvas is styled inline (the design page's .cat-canvas CSS is not loaded here);
     - opts.aria === false leaves role / aria-label to the host (the React wrapper owns them);
     - the box is measured by its layout size, so a transform on an ancestor (float, scale-in) does
       not shrink the backing store;
     - the full-body mascot framing includes the sitting haunch, which the design's framing cut flat at
       the bottom of the box, and the thought dots above the head (the cat is about 8% smaller in its box);
     - hold(gesture) keeps a gesture's pose up until hold(null) (pointing at an element, peering),
       lookToward(x, y) keeps a look direction, setTalking(on, level) takes a mouth level (whisper);
     - MOOD_NAMES / GESTURE_NAMES / BEHAVIOUR_NAMES are exported for the prop mapping and its tests;
     - pointing (2026-10-21): a held point takes over a one-shot point at once and a played point never
       aims away from a held one; the pointer does not pull the eyes off a held point; still / reduced
       motion shows a held gesture and a kept look as one static pose; no slow blink while pointing,
       peering or talking; a new gesture cross-fades from the one it replaces;
     - mascot framing: the purr hearts and the "mrr…" bubble stay inside the canvas (no bubble below
       130 px); small mascots (below 130 px) sleep between frames and idle at 20 fps.
   Design changes made in design/mascot-cat/source at the same time (re-ported here): the cross-body
   point (point-left on a right-facing cat) reaches outside the body, points follow the screen side on a
   mirrored (facing: 'left') mascot, and the thought dots have a light halo.
   2026-10-21, round 7 (made in the design source too): the tail was rewritten (solve: a slow sway phase
   travelling base to tip as a per-segment offset, a still base for sitting poses via tailRoot, segments
   on the floor do not sway, a soft floor contact, tailFlick; the continuous tip waggle in idleDetails
   is gone; Cat.tailLive: an accumulated sway phase, since T * tailSpd thrashed whenever a pose blend
   changed tailSpd, a short low-pass of the tail shape and an occasional tip flick); the catching poses
   (catchZone, reachTarget, huntPose, swatPose) and BEH.jump. Port-only: the shared pointer listener
   (PTR, ptrMove), onPointer / huntLogic / startSwat / catchPose, still-mode eye tracking of a pointer
   near by, jump() with its callbacks, and the catchZone / reachTarget / SWAT_PHASES exports.
   2026-10-27: this file is the single source of the cat (design/mascot-cat/source is history). The art
   pass (palette, line, light, fur, three-bone foreleg, two-segment spine, bodyRoll, jaw, ears) and the
   acts pass: doze, blink, tilt, a mascot stretch, roll, chase-tail, pounce, the toys (mouse, yarn), the
   laser dot (laser()), the gallop (run()), each framed in its box by Cat.fitAct; the mascot auto
   scheduler (mascotAutoWeights), motion gating of the lively acts (actAllowed) and the slow-stroke purr.
   Refine round 1 (same day): the sprung leap (leapPose) for the pounce, the toys and the laser; tail play sitting
   (chase-tail); kneading on a blanket; the mouse carried home as a gift, the yarn hooked, flipped and dribbled; a
   rocking gallop; a 3/4 head in profile (prof); wrists, toe lobes, far legs in the same fur; the loaf's tail; deeper
   tabby marks; moons for sleep; a dark-surface line and floor (surfaceDark); the head crop's vignette; denser framing.
   The public API is typed in engine.d.ts; this file is excluded from ESLint (eslint.config.mjs).
   ===================================================================================== */
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
// The warm grey-and-cream tabby of design/mascot-cat/reference.jpg: grey with a brown undertone, cream white,
// pink nose and beans. The line is a darker fur tone (out; outWh round white fur), rimL the warm back light.
// The far legs are the same fur and socks about 12% darker (in the shade of the body), not another colour.
// outD: the line on a dark surface (lighter, so the silhouette holds against a near-black page).
const C = {
  fur: '#a1998f', furLt: '#cfc6ba', furDk: '#4b4541', furSh: '#7e7771', blot: '#3d3835',
  far: '#8e877e', farDk: '#36322f', wh: '#fffbf3', whSh: '#eadfcf', farWh: '#e0dcd5', farCs: '#c9c3c9',
  out: '#463c38', outD: '#6e625c', outWh: '#9d8b7c', rimL: '#d9cfc2', furCs: '#817d89', whCs: '#e3dee8',
  nose: '#ee9ca3', noseDk: '#cd7883', earIn: '#f0b0b3', earIn2: '#f8d6d1',
  mouth: '#6a2b33', tongue: '#f08c9b', tongueDk: '#d16679',
  irisA: '#f2d470', irisM: '#d6cb60', irisB: '#a5c05c', irisC: '#5e8b47', pupil: '#1b1c26', rim: '#2e292b',
  collar: '#4f46e5', collarLt: '#8f89f7', collarDk: '#2f2a8f',
  tagA: '#fdfdff', tagB: '#b5bdd2', tagEdge: '#6c7593',
  blush: '#ff8e9e', bean: '#e99fa6', beanGr: '#9b8a8b', claw: '#f7f1e7', accent: '#ff7a1a'
};
// the head is drawn at this scale (a slightly more realistic head-to-body ratio than the design's chibi head)
const HS = 0.9;

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
// A fur tuft: a round lobe drawn out to a soft, rounded point `e` beyond it in direction a. The point is a
// quadratic between the tangent points with its control on the tip, so it joins the lobe without a corner
// (same winding as circ, so tufts union with the other parts).
function tuft(path, x, y, r, a, e) {
  const q = r + e, d = q + Math.sqrt(q * q - r * r), b = Math.acos(r / d);
  path.moveTo(x + Math.cos(a + b) * r, y + Math.sin(a + b) * r); path.arc(x, y, r, a + b, a - b + TAU);
  path.quadraticCurveTo(x + Math.cos(a) * d, y + Math.sin(a) * d, x + Math.cos(a + b) * r, y + Math.sin(a + b) * r); path.closePath();
}
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
// The outline: "stroke the union, then fill the union" (the fill covers the inner seams), in a coloured,
// variable-width line: a thin centred stroke plus a heavier one nudged away from the key light (top left), so
// the line is fine on the lit side and full on the shadow side. fill null leaves the filling to the caller.
// LINE is the centred stroke's width in ow, set per frame: fuller on small cats, so the silhouette stays crisp.
// DARK (set per frame): the cat is on a dark surface; the body line is lighter and gets a faint light rim on the lit
// (top left) side, drawn first so only its outer half shows.
let LINE = 1.45, DARK = false;
function ink(g, path, fill, ow, col) {
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (DARK && !col) { g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = ow * 1.1; g.translate(-ow * 0.6, -ow * 0.6); g.stroke(path); g.translate(ow * 0.6, ow * 0.6); }
  g.strokeStyle = col || (DARK ? C.outD : C.out);
  g.lineWidth = ow * LINE; g.stroke(path);
  g.translate(ow * 0.4, ow * 0.62); g.lineWidth = ow * 1.7; g.stroke(path); g.translate(-ow * 0.4, -ow * 0.62);
  if (fill) { g.fillStyle = fill; g.fill(path); }
}
// Base fill with an edge (call inside clip(path)): the shape in the edge colour, then the base fill nudged toward
// the key light, which leaves a crescent of it along the edges facing away from the light. Union-safe (it follows
// the silhouette, no stroke seams): rim light on the body and head, the form shadow on the limbs and tail.
function edgeFill(g, path, base, edge, d) {
  g.fillStyle = edge; g.fill(path);
  g.translate(-d, -d * 0.55); g.fillStyle = base; g.fill(path); g.translate(d, d * 0.55);
}
function strokePts(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) { const q = mid(pts[i], pts[i + 1]); g.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); } const l = pts[pts.length - 1]; g.lineTo(l[0], l[1]); g.stroke(); }
// soft fur edge: a same-colour shadow blur (device pixels, so it is scaled by st.px)
function soft(g, st, col, k = 1) { if (st.lod) return; g.shadowColor = col; g.shadowBlur = 1.3 * k * st.px; }
function hard(g) { g.shadowBlur = 0; g.shadowColor = 'transparent'; }

/* ============================ paint kit: built once per canvas, never per frame ============================ */
let FUR = null;
// A tileable fur texture (short light and dark hairs flowing back and down), baked once on first use.
function furTile() {
  if (FUR) return FUR;
  const n = 96, cv = document.createElement('canvas'); cv.width = cv.height = n;
  const g = cv.getContext('2d'); g.lineCap = 'round';
  let sd = 9; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 300; i++) {
    const x = rnd() * n, y = rnd() * n, a = 2.05 + (rnd() - 0.5) * 0.7, l = 2 + rnd() * 3.5, dx = Math.cos(a) * l, dy = Math.sin(a) * l;
    g.strokeStyle = i % 2 ? 'rgba(255,247,232,.45)' : 'rgba(52,38,32,.3)'; g.lineWidth = 0.6 + rnd() * 0.5;
    g.beginPath();
    for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { g.moveTo(x + ox, y + oy); g.lineTo(x + ox + dx, y + oy + dy); }
    g.stroke();
  }
  return (FUR = cv);
}
// Unit gradients (radius 1 at the origin) placed with glow(); the floor ones follow the theme's shadow, and on a dark
// surface (where no shadow can be darker than the page) they are a faint light violet, so the cat still stands on it.
const DARK_FLOOR = (a) => `rgba(150,134,226,${(0.3 * a).toFixed(3)})`;
function makeKit(g, dark) {
  const rg = (...stops) => { const r = g.createRadialGradient(0, 0, 0, 0, 0, 1); for (const [o, c] of stops) r.addColorStop(o, c); return r; };
  const sh = dark ? DARK_FLOOR : THEME.shadowA;
  return {
    fur: g.createPattern(furTile(), 'repeat'),
    ao: rg([0, 'rgba(60,38,34,.5)'], [0.5, 'rgba(60,38,34,.22)'], [1, 'rgba(60,38,34,0)']),
    key: rg([0, 'rgba(255,248,232,.6)'], [1, 'rgba(255,248,232,0)']),
    shade: rg([0.4, 'rgba(196,186,204,0)'], [1, 'rgba(196,186,204,1)']),
    floor: rg([0, sh(1)], [0.55, sh(0.45)], [1, sh(0)]),
    contact: rg([0, sh(2.2)], [1, sh(0)])
  };
}
// Whether the surface behind the cat is dark: the first ancestor with an opaque background colour, else the theme's
// ink (a light ink means a dark theme). Read on resize and theme changes only.
function surfaceDark(el) {
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    const m = getComputedStyle(e).backgroundColor.match(/[\d.]+/g);
    if (m && m.length >= 3 && (m.length < 4 || +m[3] > 0.5)) return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255 < 0.4;
  }
  const k = String(THEME.ink).match(/^#([\da-f]{6})$/i);
  return !!k && parseInt(k[1].slice(2, 4), 16) > 150;
}
// paints a kit gradient as an ellipse at (x, y); ext > 1 also covers the gradient's outer colour around it
function glow(g, paint, x, y, rx, ry, a = 1, op = null, ext = 1) {
  g.save(); g.translate(x, y); g.scale(rx, ry); g.globalAlpha = a; if (op) g.globalCompositeOperation = op;
  g.fillStyle = paint; g.fillRect(-ext, -ext, 2 * ext, 2 * ext); g.restore();
}
// soft volume over a box: a multiplied form shadow toward the bottom right and a warm key highlight top left
function shadeBox(g, st, x0, y0, x1, y1, sa = 1, ka = 1) {
  const w = x1 - x0, h = y1 - y0, k = st.kit;
  glow(g, k.shade, x0 + 0.38 * w, y0 + 0.32 * h, 0.8 * w, 0.84 * h, 0.75 * sa, 'multiply', 3);
  if (ka > 0) glow(g, k.key, x0 + 0.3 * w, y0 + 0.22 * h, 0.42 * w, 0.32 * h, ka);
}
// the baked fur texture, anchored at (x, y) so it moves with the part
function furTex(g, st, x, y, a) {
  if (!st.tex) return;
  g.save(); g.translate(x, y); g.scale(0.34, 0.34); g.globalAlpha = a; g.fillStyle = st.kit.fur; g.fillRect(-330, -330, 660, 660); g.restore();
}
/* ============================ pose model ============================ */
// the tail's sway phase advances at tailSpd * PI * TAIL_RATE rad/s (a sitting cat: one slow sweep in ~4 s)
const TAIL_RATE = 0.55;
// Rig parameters added in the 2026-10-27 art pass: chestBend / pelvisBend (degrees) bend the two spine segments
// about the waist (both positive: a sway back, both negative: a hunch); bodyRoll rolls the body about the spine
// (0 upright, 0.5 belly to the viewer, 1 on its back) and rollTwist keeps the pelvis that much behind the chest;
// claws unsheathes the claws of a raised front paw, nfC / ffC those of one front paw wherever it is (kneading);
// tailPhX is added to the tail's sway phase (a gait locks the tail's wave to its stride). mx and zoom (mascot mode
// only) frame an act in the box: mx shifts the cat sideways (screen cat units) and zoom scales it about the floor
// point (Cat.fitAct).
const BASE = {
  x: 0, gy: 0, lift: 0, theta: 0, mx: 0, zoom: 1,
  hipY: 39, shY: 41, bodyL: 50, shift: 0, arch: 2.5, sag: 2, bodyR: 1, curl: 0, chestBend: 0, pelvisBend: 0, bodyRoll: 0, rollTwist: 0,
  neckA: 50, neckL: 15, faceCam: 0.55, lookTurn: 0, headRoll: 0, headPitch: 0, headDX: 0, headDY: 0, squish: 0, headScale: 1,
  earRot: 0.25, earL: 0, earR: 0,
  lid: 0, lidLow: 0, pupil: 0.45, eyeOpen: 1, lookX: 0, lookY: 0, happyEyes: 0, squeeze: 0,
  mouth: 0, jawTall: 0, tongue: 0, smile: 0.35, fang: 0, brow: 0, browUp: 0, whisk: 0, whiskT: 0, blush: 0.55, tear: 0,
  nfx: 23, nfy: 0, nfa: 0, ffx: 25, ffy: 0, ffa: 0, nhx: -23, nhy: 0, nha: 0.25, fhx: -21, fhy: 0, fha: 0.25,
  legZ: 4.5, armZ: 0, elbow: 0, nfE: 0, ffE: 0, splay: 0, beans: 0, beansH: 0, sole: 0, pawFront: 0, pawFar: 0, paw2: 0, claws: 0, nfC: 0, ffC: 0,
  tailA: 72, tailCurl: -5, tailTip: -22, tailWave: 5, tailSpd: 1.4, tailQuiver: 0, tailFront: 0, tailPuff: 1, tailLen: 1, tailDX: 0, tailDY: 0, tailRoot: 0.45, tailFlick: 0, tailPhX: 0,
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
const MC = 6; // front metacarpus (wrist to paw centre), cat units
// the haunch of a hind leg: a big round at the hip end and a smaller one toward the knee (screen coords)
function thighOf(J, K) { const a = mid(J, K, 0.32), b = mid(J, K, 0.68); return [[a[0], a[1], 11], [b[0], b[1], 8.4]]; }
// Returns everything in "cat units", screen-oriented (y down), relative to the root on the floor.
function solve(p, T) {
  const c = Math.cos(p.theta), sn = Math.sin(p.theta), up = p.gy + p.lift;
  const pr = (x, y, z = 0) => [x * c - z * sn, -(y + up)];
  const dep = (x, z) => x * sn + z * c;
  const dy = p.shY - p.hipY, L = p.bodyL, dx = Math.sqrt(Math.max(L * L - dy * dy, 16));
  let H = [p.shift - dx / 2, p.hipY], S = [p.shift + dx / 2, p.shY];
  const len = Math.hypot(S[0] - H[0], S[1] - H[1]);
  const u = [(S[0] - H[0]) / len, (S[1] - H[1]) / len], n = [-u[1], u[0]];
  const Cc = [(H[0] + S[0]) / 2 + n[0] * p.arch, (H[1] + S[1]) / 2 + n[1] * p.arch];
  // spine: the quadratic arch degree-elevated to a cubic; `curl` pushes both control points up and outward
  // so the ends roll under (a sleeping cat's C-curl) — continuous from 0 to 1, no cross-fade between drawings
  const cu = p.curl, k1 = cu * 17, k2 = cu * 9;
  const C1 = [H[0] + ((Cc[0] - H[0]) * 2) / 3 - u[0] * k1 + n[0] * k2, H[1] + ((Cc[1] - H[1]) * 2) / 3 - u[1] * k1 + n[1] * k2];
  const C2 = [S[0] + ((Cc[0] - S[0]) * 2) / 3 + u[0] * k1 + n[0] * k2, S[1] + ((Cc[1] - S[1]) * 2) / 3 + u[1] * k1 + n[1] * k2];
  // Two segments, pelvis (s 0..0.5) and chest (0.5..1): the cubic split at the waist (de Casteljau: the same
  // curve at rest); chestBend / pelvisBend turn each segment about the waist, its waist handle by half, so the
  // spine stays smooth through the waist.
  const a01 = mid(H, C1), a12 = mid(C1, C2), a23 = mid(C2, S), q0 = mid(a01, a12), q1 = mid(a12, a23), Wm = mid(q0, q1);
  const ac = p.chestBend * D2R, ap = -p.pelvisBend * D2R, ah = (ac + ap) / 2;
  const about = (Q, a) => { if (!a) return Q; const v = rot2([Q[0] - Wm[0], Q[1] - Wm[1]], a); return [Wm[0] + v[0], Wm[1] + v[1]]; };
  const SA = [about(H, ap), about(a01, ap), about(q0, ah), Wm], SB = [Wm, about(q1, ah), about(a23, ac), about(S, ac)];
  H = SA[0]; S = SB[3];
  const cub = (Q, t) => { const r = 1 - t, a = r * r * r, b = 3 * r * r * t, e = 3 * r * t * t, d = t * t * t; return [a * Q[0][0] + b * Q[1][0] + e * Q[2][0] + d * Q[3][0], a * Q[0][1] + b * Q[1][1] + e * Q[2][1] + d * Q[3][1]]; };
  const cubt = (Q, t) => { const r = 1 - t; return [3 * r * r * (Q[1][0] - Q[0][0]) + 6 * r * t * (Q[2][0] - Q[1][0]) + 3 * t * t * (Q[3][0] - Q[2][0]), 3 * r * r * (Q[1][1] - Q[0][1]) + 6 * r * t * (Q[2][1] - Q[1][1]) + 3 * t * t * (Q[3][1] - Q[2][1])]; };
  const bz = (s) => (s < 0.5 ? cub(SA, s * 2) : cub(SB, s * 2 - 1));
  const bzt = (s) => (s < 0.5 ? cubt(SA, s * 2) : cubt(SB, s * 2 - 1));
  const bzn = (s) => { const t = nrm(bzt(s)); return [-t[1], t[0]]; };
  const tS = nrm(bzt(1)), tH = nrm(bzt(0)), uc = ac ? rot2(u, ac) : u, upv = ap ? rot2(u, ap) : u;
  const uS = nrm([lerp(uc[0], tS[0], cu), lerp(uc[1], tS[1], cu)]), nS = [-uS[1], uS[0]];
  const uH = nrm([lerp(upv[0], tH[0], cu), lerp(upv[1], tH[1], cu)]), nH = [-uH[1], uH[0]];
  // rolled onto the back the legs leave from the other side of the body (chest and pelvis roll separately)
  const rcS = Math.cos(PI * clamp(p.bodyRoll)), rcH = Math.cos(PI * clamp(p.bodyRoll - p.rollTwist));
  // mass: haunch and chest fuller than the waist
  const rad = (s) => (lerp(13.6, 15.0, s) + 1.1 * gs(s, 0.08, 0.14) - 0.8 * gs(s, 0.52, 0.16) + 0.6 * gs(s, 0.9, 0.1)) * p.bodyR * (1 + 0.1 * sn);
  const torso = [];
  const NT = 24;
  for (let i = 0; i <= NT; i++) {
    const s = i / NT, b = bz(s), nn = bzn(s), sg = p.sag * 0.55 * gs(s, 0.42, 0.26); // belly pouch sags behind the ribs
    const q = pr(b[0] - nn[0] * sg, b[1] - nn[1] * sg); torso.push([q[0], q[1], rad(s) + sg]);
  }
  { const q = pr(S[0] + uS[0] * 4 - nS[0] * 5, S[1] + uS[1] * 4 - nS[1] * 5); torso.push([q[0], q[1], 12.6 * p.bodyR]); }
  { const r = rad(0) - 4.9 + p.hipBump; const q = pr(H[0] + nH[0] * r + uH[0] * 2.5, H[1] + nH[1] * r + uH[1] * 2.5); torso.push([q[0], q[1], 5.2]); }
  const Hb = [S[0] + Math.cos(p.neckA * D2R) * p.neckL + p.headDX, S[1] + Math.sin(p.neckA * D2R) * p.neckL + p.headDY];
  const N0 = [S[0] + uS[0] + nS[0] * 3, S[1] + uS[1] + nS[1] * 3];
  const neck = [];
  for (let i = 0; i <= 6; i++) { const s = (i / 6) * 0.8; const q = pr(lerp(N0[0], Hb[0], s), lerp(N0[1], Hb[1], s)); neck.push([q[0], q[1], lerp(10.8, 9.4, s)]); }
  const head = pr(Hb[0], Hb[1]);
  const psi = lerp(p.theta, PI / 2, p.faceCam) + p.lookTurn;
  const o = clamp(Math.cos(psi), -0.92, 0.92); // beyond about 0.5 the head draws as a 3/4 head (drawHead: pf)
  // legs
  const legs = [];
  for (const k of LEGS) {
    const front = k[1] === 'f', near = k[0] === 'n';
    const z = (near ? 1 : -1) * (p.legZ * (front ? 1 : 1.15) + (front ? p.armZ : 0));
    const fx = p[k + 'x'], fy = p[k + 'y'], fa = p[k + 'a'];
    if (front) {
      // three bones: humerus J→E, radius E→W (wrist), metacarpus W→paw. The poses give the paw (fx, fy, fa: the
      // design's wrist target plus its paw offset); the metacarpus stands up from a paw on the floor and lines
      // up with the toes when the paw is raised; the paw stays on the wrist the IK reaches.
      const J = [S[0] - nS[0] * 4.5 * rcS, S[1] - nS[1] * 4.5 * rcS];
      const o0 = rot2([1.5, -2.8], fa), P0 = [fx + o0[0] - 1.5, fy + 6.2 + o0[1]];
      const mb = lerp(1.9, 2.75, sstep((P0[1] - 3.4) / 6)), mc = rot2([Math.cos(mb) * MC, Math.sin(mb) * MC], fa);
      const r = ik(J, [P0[0] + mc[0], P0[1] + mc[1]], 15.5, 15, -1 + 2 * clamp(p.elbow + p[k + 'E'])); // elbow: 0 bends back (standing), 1 bends down/out (lying, paws up)
      if (r.j[1] < 2.5) r.j[1] = 2.5; if (r.e[1] < 1.5) r.e[1] = 1.5;
      const Pc = [r.e[0] - mc[0], r.e[1] - mc[1]], td = rot2([1, 0], fa);
      legs.push({ k, front, near, depth: dep(J[0], z), J: pr(J[0], J[1], z), E: pr(r.j[0], r.j[1], z), W: pr(r.e[0], r.e[1], z), P: pr(Pc[0], Pc[1], z), td: [td[0] * c, -td[1]], lift: Pc[1] - 3.4, hx: r.j[0] - J[0], hy: r.j[1] - J[1] });
    } else {
      const J = [H[0] - nH[0] * 3 * rcH + uH[0], H[1] - nH[1] * 3 * rcH + uH[1]];
      const Pc = [fx, fy + 3.4], heel = [Pc[0] - 2.6, Pc[1] + 0.9];
      const Hk = [heel[0] - Math.sin(fa) * 12, heel[1] + Math.cos(fa) * 12];
      const r = ik(J, Hk, 14.5, 14.5, 1);
      const heel2 = [r.e[0] + Math.sin(fa) * 12, r.e[1] - Math.cos(fa) * 12], Pc2 = [heel2[0] + 2.6, heel2[1] - 0.9];
      const Jp = pr(J[0], J[1], z), Kp = pr(r.j[0], r.j[1], z);
      legs.push({ k, front, near, depth: dep(J[0], z), J: Jp, K: Kp, Hk: pr(r.e[0], r.e[1], z), Hl: pr(heel2[0], heel2[1], z), P: pr(Pc2[0], Pc2[1], z), td: [c, 0], lift: Pc2[1] - 3.4, th: thighOf(Jp, Kp) });
    }
  }
  // the shoulder blade rides on the near front leg: it rises as the leg swings back and pushes, and sinks back
  // along the spine as the leg reaches forward or up (p.blade adds the gait's roll)
  {
    const fl = legs[0].depth >= legs[1].depth ? legs[0] : legs[1], a = Math.atan2(fl.hx, -fl.hy); // 0 straight down, + forward
    const r = 15 * p.bodyR - 4.6 + p.blade + 0.6 + 1.6 * clamp(-a - 0.15, 0, 1), al = 3 + 2.2 * clamp(a, -1, 1.5);
    const q = pr(S[0] + nS[0] * r * rcS - uS[0] * al, S[1] + nS[1] * r * rcS - uS[1] * al); torso.push([q[0], q[1], 4.8]);
  }
  // tail: a 12-segment chain from under the hip. Rest shape: base angle tailA, an even curl per segment
  // (tailCurl) and the tip curled by tailTip over the last five. Motion: one slow sway phase travels from
  // the base to the tip with ~1.7 rad of lag (follow-through, so the tail swings in an S-curve), as an
  // offset of each segment's direction from its rest direction, so the swing never accumulates into a
  // wriggle. tailRoot is how much the base swings (a sitting cat keeps it still); segments lying on the
  // floor in the rest shape do not sway (the wrapped part of a sitting tail stays put, the tip lifts);
  // tailFlick curls the tip further (an occasional relaxed flick). The phase is p.tailPh, a continuous
  // accumulator kept by the live cat (pose blends change tailSpd, and T * tailSpd jumped); frozen frames
  // use T. The floor is a soft contact, so there is no kink where the tail meets it.
  const tail = [];
  {
    const T0 = [H[0] - uH[0] * 11 + nH[0] * 3.5 + p.tailDX, H[1] - uH[1] * 11 + nH[1] * 3.5 + p.tailDY];
    const NS = 12, SL = 4.7 * p.tailLen, ph = (p.tailPh != null ? p.tailPh : T * p.tailSpd * PI * TAIL_RATE) + p.tailPhX;
    const amp = p.tailWave * 2.2 * D2R, root = clamp(p.tailRoot), fl = p.tailFlick || 0, fs = p.tailTip < 0 ? -1 : 1;
    const floorAt = (f) => lerp(5.5, 4.1, f) * p.tailPuff * 0.92 - p.lift;
    const ground = (y, f) => { const d = y - floorAt(f); return d > 6 ? y : floorAt(f) + Math.log(1 + Math.exp(d)); };
    // rest directions and, from the rest chain, how far each joint is off the floor
    const ra = [], air = [];
    let a = PI - p.tailA * D2R, x = T0[0], y = T0[1];
    for (let i = 1; i <= NS; i++) {
      a += p.tailCurl * D2R + (i >= 8 ? (p.tailTip * D2R) / 5 : 0);
      ra.push(a); x += Math.cos(a) * SL; y = ground(y + Math.sin(a) * SL, i / NS);
      air.push(sstep((y - floorAt(i / NS)) / 5));
    }
    x = T0[0]; y = T0[1];
    tail.push([...pr(x, y), 5.5 * p.tailPuff]);
    for (let i = 1; i <= NS; i++) {
      const f = i / NS, wv = lerp(root, 1, f) * air[i - 1];
      let ai = ra[i - 1] + amp * wv * Math.sin(ph - 1.7 * f);
      if (i >= 8) ai += fs * fl * 32 * D2R * sstep((i - 7) / 5);
      if (i < 5) ai += p.tailQuiver * D2R * 1.2 * Math.sin(T * 41 + i * 1.3);
      x += Math.cos(ai) * SL; y = ground(y + Math.sin(ai) * SL, f);
      tail.push([...pr(x, y), lerp(5.5, 4.1, f) * p.tailPuff]);
    }
  }
  return { pr, c, sn, H, S, u, n, uS, nS, uH, nH, bz, bzn, rad, torso, neck, head, Hb, o, legs, tail };
}
// A body latitude v (fraction of the radius toward the back, + , or the belly, −; beyond ±1 = past the edge)
// as seen when the body is rolled by r radians (belly toward the viewer). far: the same marking on the far flank
// (mirrored), which comes into view as the cat turns onto its back. Hidden points are pushed past the edge
// they left through, so a marking slides over the silhouette instead of folding back.
function rollLat(v, r, far) {
  const a0 = Math.abs(v) <= 1 ? Math.asin(v) : Math.sign(v) * (PI / 2 + Math.abs(v) - 1);
  if (!far) { const a = a0 + r; return a > PI / 2 ? 1 + a - PI / 2 : a < -PI / 2 ? -1 + a + PI / 2 : Math.sin(a); }
  const a = a0 - r;
  return a > -PI / 2 ? -1 - a - PI / 2 : a < -1.5 * PI ? 1 - a - 1.5 * PI : Math.sin(a);
}

/* ============================ drawing ============================ */
function drawShadow(g, R, p, st) {
  const gy = -p.gy, k = clamp(1 - p.lift / 32, 0.3, 1), kit = st.kit; // smaller and fainter the higher it leaps
  let minx = 1e9, maxx = -1e9, c0 = 1e9, c1 = -1e9;
  const touch = (t) => { if (t[1] + t[2] > gy - 1.5) { c0 = Math.min(c0, t[0] - t[2] * 0.75); c1 = Math.max(c1, t[0] + t[2] * 0.75); } };
  for (const t of R.torso) { minx = Math.min(minx, t[0] - t[2]); maxx = Math.max(maxx, t[0] + t[2]); touch(t); }
  for (const L of R.legs) if (!L.front) for (const t of L.th) touch(t);
  const rx = ((maxx - minx) / 2 + 10) * k;
  glow(g, kit.floor, (minx + maxx) / 2, gy + 0.6, rx, Math.min(rx * 0.15, 4.2), 0.9 * k * k);
  // contact shadows: tight and dark where the body and the paws meet the floor
  if (c1 > c0 && p.lift < 3) glow(g, kit.contact, (c0 + c1) / 2, gy + 0.2, (c1 - c0) / 2 + 3, 2.2, 0.6 * (1 - p.lift / 3));
  for (const L of R.legs) {
    const h = L.lift + p.lift; if (h > 5) continue;
    glow(g, kit.contact, L.P[0] + 0.6, gy + 0.25, 6.4, 1.8, 0.75 * (1 - h / 5));
  }
}

function drawTorso(g, R, p, st) {
  const ow = st.ow, path = new Path2D(), kit = st.kit;
  for (const t of R.torso) circ(path, t[0], t[1], t[2]);
  for (const t of R.neck) circ(path, t[0], t[1], t[2]);
  // the chest ruff: fur tufts round the front of the chest, hanging a little, so its edge is fluffy instead of a smooth bean
  {
    const S = R.S, uS = R.uS, nS = R.nS, rr = 12.6 * p.bodyR - 1.3, cx = S[0] + uS[0] * 4 - nS[0] * 5, cy = S[1] + uS[1] * 4 - nS[1] * 5;
    for (let i = 0; i < 6; i++) {
      const f = lerp(-1.2, 0.9, i / 5), dx = -nS[0] * Math.cos(f) + uS[0] * Math.sin(f), dy = -nS[1] * Math.cos(f) + uS[1] * Math.sin(f);
      const q = R.pr(cx + dx * rr, cy + dy * rr), r = 2.3 + 0.5 * (i % 2);
      if (q[1] + r > -p.gy - 2) continue; // a chest pressed to the floor (bow, crouch, loaf) shows no ruff below the chin
      tuft(path, q[0], q[1], r, Math.atan2(-dy + 0.6, dx * R.c), 1.0);
    }
  }
  // seen from the side, the nape: a few tufts along the top of the neck, so the head grows out of a furry neck
  if (Math.abs(R.c) > 0.45) {
    const nk = R.neck, a0 = nk[0], a1 = nk[nk.length - 1], d = nrm([a1[0] - a0[0], a1[1] - a0[1]]), up = d[0] >= 0 ? [d[1], -d[0]] : [-d[1], d[0]];
    const k = clamp((Math.abs(R.c) - 0.45) / 0.3);
    for (let i = 1; i <= 4; i++) { const q = nk[i], r = q[2] - 1.4; tuft(path, q[0] + up[0] * r, q[1] + up[1] * r, 2.3, Math.atan2(up[1] - 0.6 * d[1], up[0] - 0.6 * d[0]), 1.1 * k); }
  }
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const t of R.torso) { x0 = Math.min(x0, t[0] - t[2]); x1 = Math.max(x1, t[0] + t[2]); y0 = Math.min(y0, t[1] - t[2]); y1 = Math.max(y1, t[1] + t[2]); }
  ink(g, path, null, ow);
  g.save(); g.clip(path);
  edgeFill(g, path, C.fur, C.rimL, st.rimD);
  const vis = Math.abs(R.c), ro = p.bodyRoll, tw = p.rollTwist;
  // the near flank, and when the body rolls, the far flank's markings coming into view (rollLat)
  for (let far = 0; far < (ro > 0.01 || Math.abs(tw) > 0.01 ? 2 : 1); far++) {
    // a point on the body: spine param s, v = fraction of the local radius toward the back (+) or belly (−), da along the spine
    const B = (s, v, da = 0) => {
      s = clamp(s, 0, 1); const r = clamp(ro - tw * (1 - s)) * PI;
      if (r || far) v = rollLat(v, r, far);
      const b = R.bz(s), nn = R.bzn(s), off = v * R.rad(s); return R.pr(b[0] + nn[0] * off + nn[1] * da, b[1] + nn[1] * off - nn[0] * da);
    };
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
      if (!st.lod) { g.strokeStyle = 'rgba(196,158,118,.32)'; g.lineWidth = 2.4; g.lineJoin = 'round'; g.stroke(wp); } // warm tufts where the grey meets the white
      soft(g, st, 'rgba(253,248,239,.9)', 1.4); g.fillStyle = C.wh; g.fill(wp); hard(g);
      if (!far && ro < 0.3) {
        const bib = R.pr(R.S[0] + R.uS[0] * 4 - R.nS[0] * 4.2, R.S[1] + R.uS[1] * 4 - R.nS[1] * 4.2);
        g.fillStyle = C.wh; g.beginPath(); g.ellipse(bib[0], bib[1], 8 + 6 * R.sn, 12 + 3.5 * R.sn, 0, 0, TAU); g.fill();
      }
    }
    // tabby marbling like the photo: solid, darker warm grey, soft-edged and following the body
    if (vis > 0.05 && !st.lod) {
      g.globalAlpha = Math.min(1, 1.25 * vis);
      soft(g, st, 'rgba(58,53,50,.75)');
      g.fillStyle = C.blot;
      const mp = new Path2D();
      // dorsal saddle with a wavy lower edge
      { const upE = [], dnE = []; for (let i = 0; i <= 20; i++) { const s = lerp(0.0, 0.97, i / 20); upE.push(B(s, 1.25)); dnE.push(B(s, 0.8 + 0.08 * p.curl - 0.07 * Math.sin(s * 19 + 1) - 0.08 * gs(s, 0.62, 0.05) - 0.08 * gs(s, 0.78, 0.05))); } smoothPoly(mp, upE.concat(dnE.reverse())); }
      // the bull's-eye blotch on the flank: a solid dark oyster inside an open outer ring
      const sc = 0.3, vc = 0.08, Lp = (rx, ry, a) => B(sc + (rx * Math.cos(a)) / 52, vc + (ry * Math.sin(a)) / 14.5);
      { const pts = []; for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU, wob = 1 + 0.09 * Math.sin(a * 3 + 0.6); pts.push(Lp(8.2 * wob, 6.8 * wob, a)); } smoothPoly(mp, pts); }
      { const pts = []; for (let i = 0; i <= 16; i++) pts.push(Lp(13.8, 11.2, lerp(-0.95, 3.75, i / 16))); band(mp, pts, taperW(3.8, 2.8, 0.16, 0.22)); }
      // curved, tapered rib bands on the front half, sweeping back as they descend
      for (const [s0, len, w, sw] of [[0.5, 0.95, 2.5, 0.07], [0.61, 1.05, 2.7, 0.08], [0.72, 0.9, 2.4, 0.07], [0.83, 0.82, 2.3, 0.06]]) {
        const pts = []; for (let j = 0; j <= 7; j++) { const f = j / 7; pts.push(B(s0 - sw * Math.pow(f, 1.4) + 0.012 * Math.sin(f * 6 + s0 * 9), 0.8 - len * f)); }
        band(mp, pts, taperW(w, 0.5, 0.12, 0.3));
      }
      // a short branch from the ring toward the haunch
      { const pts = []; for (let j = 0; j <= 5; j++) { const f = j / 5; pts.push(B(0.12 - 0.05 * f, 0.72 - 0.95 * f)); } band(mp, pts, taperW(2.4, 0.6)); }
      g.fill(mp); hard(g);
      g.globalAlpha = 1;
    }
  }
  furTex(g, st, R.torso[12][0], R.torso[12][1], 0.17);
  shadeBox(g, st, x0, y0, x1, y1, 1 - 0.55 * st.small);
  // ambient occlusion: the head's shadow on the chest, the near legs where they meet the body, the tail root
  const hk = HS * p.headScale;
  glow(g, kit.ao, R.head[0] + R.o * 2 * hk, R.head[1] + 18 * hk, 14 * hk, 7.5 * hk, 0.85);
  for (const L of R.legs) {
    if (L.depth < 0) continue;
    if (L.front) glow(g, kit.ao, L.J[0] - 1.5, L.J[1] + 3, 7.5, 9, 0.75);
    else glow(g, kit.ao, L.th[0][0] + 1.5, L.th[0][1] + 1.5, 15, 13, 0.55);
  }
  glow(g, kit.ao, R.tail[0][0], R.tail[0][1], 8, 8, 0.6);
  g.restore();
}

// The paw: a pad and four toe lobes, which spread in a row when the paw is seen from the front (yaw), stack
// along its front edge from the side, and fan round the sole when the sole faces the viewer. TOE keeps the
// toes' centres and radius (screen, cat units) for the creases, beans and claws drawn after it.
const TOE = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
function pawPath(path, L, sn, sole, front) {
  const f = clamp(Math.hypot(L.td[0], L.td[1])), ang = Math.atan2(L.td[1], L.td[0]), ca = Math.cos(ang), sa = Math.sin(ang);
  const rx = lerp(lerp(3.9, front ? 5.2 : 5.3, f), 4.9, sole), ry = lerp(3.6, 4.6, sole);
  ell(path, L.P[0], L.P[1], rx, ry, ang);
  const ys = Math.abs(sn) * (1 - sole), wA = (1 - Math.abs(sn)) * (1 - sole), tr = lerp(front ? 2.3 : 2.25, 2.05, sole);
  for (let i = 0; i < 4; i++) {
    const t = i - 1.5, phi = lerp(0.5, -1.15, i / 3), psi = lerp(-1.0, 1.0, i / 3);
    // paw frame: u along the toes, v across (down positive)
    // the toes sit on the rim, so they bulge the outline into four lobes (no drawn ticks)
    const u = wA * Math.cos(phi) * rx * 0.9 + ys * (rx * 0.8 - 0.24 * t * t) + sole * Math.cos(psi) * 3.6;
    const v = wA * Math.sin(phi) * ry * 1.02 - ys * ry * 0.1 + sole * Math.sin(psi) * 3.6;
    const T = TOE[i];
    T[0] = L.P[0] + ca * u - sa * v - sn * t * 1.6 * ys; T[1] = L.P[1] + sa * u + ca * v; T[2] = tr;
    circ(path, T[0], T[1], tr);
  }
  return ang;
}
// how a joint at B (between A and C) points out: zero when the limb is straight
function bendOut(A, B, Cj) { const a = nrm([B[0] - A[0], B[1] - A[1]]), b = nrm([B[0] - Cj[0], B[1] - Cj[1]]); return [a[0] + b[0], a[1] + b[1]]; }
function drawLeg(g, L, p, st, far, R) {
  const ow = st.ow, fur = far ? C.far : C.fur, wh = far ? C.farWh : C.wh, dk = far ? C.farDk : C.blot;
  const sole = L.front ? 0 : p.sole;
  const path = new Path2D();
  let bo = null;
  if (L.front) {
    caps(path, L.J, lerp(7.4, 5.9, clamp((L.lift - 10) / 16)), L.E, 5.3);                   // upper arm (slimmer at the shoulder when raised in front of the chest)
    bo = bendOut(L.J, L.E, L.W); circ(path, L.E[0] + bo[0] * 1.6, L.E[1] + bo[1] * 1.6, 3.7); // the point of the elbow
    const fm = mid(L.E, L.W, 0.3); circ(path, fm[0], fm[1], 4.9);                           // forearm muscles under the elbow
    caps(path, L.E, 4.9, L.W, 3.25);                                                        // forearm, tapering to a slim wrist
    // the carpal pad: a small bump at the back of the wrist, where the pastern slopes forward to the paw
    { let wb = bendOut(L.E, L.W, L.P), wn = Math.hypot(wb[0], wb[1]); if (wn < 0.15) { wb = [-L.td[0], -L.td[1] + 0.2]; wn = Math.hypot(wb[0], wb[1]) || 1; }
      circ(path, L.W[0] + (wb[0] / wn) * 1.9, L.W[1] + (wb[1] / wn) * 1.9, 1.85); }
    caps(path, L.W, 3.3, L.P, 4.1);                                                         // the metacarpus (pastern)
  } else {
    for (const t of L.th) circ(path, t[0], t[1], t[2]);                                     // the haunch
    // britches: fluffy fur at the back of the thigh
    { const kb = bendOut(L.J, L.K, L.Hk), kn = Math.hypot(kb[0], kb[1]) || 1, t = L.th[0];
      for (const a of [-0.45, 0.25]) { const v = rot2([-kb[0] / kn, -kb[1] / kn], a); circ(path, t[0] + v[0] * 10, t[1] + v[1] * 10, 2.6); } }
    bo = bendOut(L.K, L.Hk, L.Hl);
    caps(path, L.K, 5.6, L.Hk, 3.3);                                                        // shank
    const cm = mid(L.K, L.Hk, 0.35); circ(path, cm[0] + bo[0] * 1.6, cm[1] + bo[1] * 1.6, 4.1); // calf
    circ(path, L.Hk[0] + bo[0] * 1.15, L.Hk[1] + bo[1] * 1.15, 2.6);                       // the point of the hock
    caps(path, L.Hk, 3.2, L.Hl, 3.15);                                                      // metatarsus
  }
  const pang = pawPath(path, L, R.sn, sole, L.front);
  ink(g, path, null, ow);
  g.save(); g.clip(path);
  const cs = far ? 0.8 : 1.15; // the form shadow's width
  edgeFill(g, path, fur, C.furCs, cs);
  if (!st.lod) {
    g.fillStyle = dk; g.globalAlpha = far ? 0.8 : 0.95; if (!far) soft(g, st, 'rgba(58,53,50,.7)', 0.8);
    const mp = new Path2D();
    const across = (A, B2, t, w, th) => { const q = mid(A, B2, t), dx = B2[0] - A[0], dy = B2[1] - A[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, ux = dx / d, uy = dy / d; const pts = []; for (let j = 0; j <= 5; j++) { const f = (j / 5) * 2 - 1; pts.push([q[0] + nx * w * f + ux * 1.6 * (1 - f * f), q[1] + ny * w * f + uy * 1.6 * (1 - f * f)]); } band(mp, pts, taperW(th, th * 0.7, 0.25, 0.25)); };
    if (L.front) { across(L.J, L.E, 0.4, 8, 1.6); across(L.J, L.E, 0.76, 7, 1.4); across(L.E, L.W, 0.25, 6, 1.25); }
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
  // white socks, the same on the far legs (only their shade says they are behind the body)
  const sp = new Path2D();
  if (L.front) caps(sp, mid(L.E, L.W, 0.55), 6.5, L.P, 7.6);
  else { caps(sp, mid(L.K, L.Hk, 0.6), 7.5, L.Hl, 8); caps(sp, L.Hl, 8, L.P, 8); }
  if (!far) soft(g, st, 'rgba(253,248,239,.85)', 0.9);
  // the white in shade on the crescent, lit inside the nudged leg (a second clip intersects the first)
  g.fillStyle = far ? C.farCs : C.whCs; g.fill(sp); g.save(); g.translate(-cs, -cs * 0.55); g.clip(path); g.translate(cs, cs * 0.55);
  g.fillStyle = wh; g.fill(sp); g.restore(); hard(g);
  // volume: dark where the leg goes into the body, a shaded side away from the light, a fine highlight
  if (L.lift < 4) glow(g, st.kit.ao, L.J[0], L.J[1], 6.5, 6.5, (far ? 0.6 : 1) * (L.front ? 0.6 : 0.4)); // not on a raised paw's arm, which is in front of the chest
  // the toes are lobes of the outline; between them only a soft shadow (no drawn ticks)
  if (sole < 0.5 && !st.lod) for (let i = 0; i < 3; i++) { const a = TOE[i], b = TOE[i + 1]; glow(g, st.kit.ao, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 1.3, 1.6, 0.45); }
  g.restore();
  // claws: out on a raised front paw while it strikes (claws), or on one paw wherever it is (nfC / ffC: kneading)
  const cl = L.front ? Math.max(L.lift > 2 ? p.claws : 0, p[L.k + 'C']) : 0;
  if (cl > 0.05 && !st.lod) {
    g.lineCap = 'round'; g.globalAlpha = clamp(cl * 1.5);
    const dn = [-Math.sin(pang), Math.cos(pang)];
    for (let i = 0; i < 4; i++) {
      const T = TOE[i], d = nrm([T[0] - L.P[0], T[1] - L.P[1]]), b = [T[0] + d[0] * T[2] * 0.55, T[1] + d[1] * T[2] * 0.55], e = [b[0] + d[0] * 2 * cl + dn[0] * 0.9, b[1] + d[1] * 2 * cl + dn[1] * 0.9];
      const cpx = b[0] + d[0] * 1.6, cpy = b[1] + d[1] * 1.6;
      g.strokeStyle = C.out; g.lineWidth = 1.35; g.beginPath(); g.moveTo(b[0], b[1]); g.quadraticCurveTo(cpx, cpy, e[0], e[1]); g.stroke();
      g.strokeStyle = C.claw; g.lineWidth = 0.75; g.beginPath(); g.moveTo(b[0], b[1]); g.quadraticCurveTo(cpx, cpy, e[0], e[1]); g.stroke();
    }
    g.globalAlpha = 1;
  }
  // toe beans when a front paw is shown (pink and grey like the photo)
  const showK = p.pawFar > 0.5 ? 'ff' : 'nf';
  if (p.beans > 0.3 && L.front && (L.k === showK || p.paw2 > 0.5)) {
    g.globalAlpha = clamp(p.beans);
    g.fillStyle = C.bean; g.beginPath(); g.ellipse(L.P[0] - Math.cos(pang) * 1.1, L.P[1] - Math.sin(pang) * 1.1, 2.3, 1.7, pang + PI / 2, 0, TAU); g.fill();
    for (let i = 0; i < 4; i++) { const T = TOE[i]; g.fillStyle = i === 1 ? C.beanGr : C.bean; g.beginPath(); g.ellipse(lerp(L.P[0], T[0], 0.86), lerp(L.P[1], T[1], 0.86), 1.05, 0.9, 0, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
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
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
    const w = pts[i][2] * (i > 1 && i < n - 1 ? (i % 2 ? 1.07 : 0.97) : 1); // fur lobes along the edges
    left.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); right.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  // a soft pointed tuft at the tip
  const t0 = pts[n - 2], t1 = pts[n - 1], td = nrm([t1[0] - t0[0], t1[1] - t0[1]]), tip = [t1[0] + td[0] * (t1[2] + 2.8), t1[1] + td[1] * (t1[2] + 2.8)];
  const path = new Path2D();
  smoothPoly(path, left.concat([tip], right.reverse()));
  circ(path, pts[0][0], pts[0][1], pts[0][2]);
  ink(g, path, null, ow);
  g.save(); g.clip(path);
  edgeFill(g, path, C.fur, C.furCs, 1.3);
  g.fillStyle = C.blot; soft(g, st, 'rgba(58,53,50,.6)', 0.7);
  const rp = new Path2D();
  for (const [i, th] of [[2, 1.9], [5, 2.3], [8, 2.5]]) { // few, bold rings like the photo
    const a = pts[i - 1], b = pts[i + 1], q = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, w = q[2] + 1.5;
    const ring = []; for (let j = 0; j <= 4; j++) { const f = (j / 4) * 2 - 1; ring.push([q[0] + nx * w * f - (dx / d) * 1.3 * (1 - f * f), q[1] + ny * w * f - (dy / d) * 1.3 * (1 - f * f)]); }
    band(rp, ring, () => th);
  }
  // the dark tip and tuft
  circ(rp, t1[0], t1[1], t1[2] + 1); circ(rp, lerp(t0[0], t1[0], 0.5), lerp(t0[1], t1[1], 0.5), t1[2] + 0.6); circ(rp, tip[0] - td[0] * 2, tip[1] - td[1] * 2, 3);
  g.fill(rp); hard(g);
  glow(g, st.kit.ao, pts[0][0], pts[0][1], 7, 7, 0.55);
  g.restore();
}

/* ---------- head ---------- */
function drawCollar(g, o, ow) {
  const cx = o * 3.2, cy = 13.9, rx = 13.4, ry = 6.5;
  g.save(); g.lineCap = 'round';
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0.1 * PI, 0.9 * PI);
  g.strokeStyle = C.collarDk; g.lineWidth = 4.8 + ow * 1.6; g.stroke();
  g.strokeStyle = C.collar; g.lineWidth = 4.8; g.stroke();
  g.beginPath(); g.ellipse(cx, cy - 1.2, rx - 0.6, ry - 0.6, 0, 0.16 * PI, 0.84 * PI);
  g.strokeStyle = C.collarLt; g.globalAlpha = 0.8; g.lineWidth = 1.1; g.stroke(); g.globalAlpha = 1;
  g.restore();
}
// the neck ruff: cream fur lobes under the chin and round the collar (no outline, a few fur tips), so the head
// sits in its fur instead of on a stack of circles; it shrinks into the curl while sleeping, and it fades out
// when the head is low over the floor (bow, crouch, loaf), where it would hang below the chin like a beard.
// room: the head centre's height above the floor in head units.
function drawRuff(g, p, o, st, ow, room) {
  const v = clamp((room - 24) / 10);
  if (v < 0.05) return;
  const k = (1 - 0.45 * p.curl) * lerp(0.75, 1, v), cx = o * 2.4;
  g.globalAlpha = v; g.fillStyle = C.wh; g.beginPath();
  for (let i = 0; i < 5; i++) { const a = lerp(0.75, PI - 0.75, i / 4), x = cx + Math.cos(a) * 13 * k, y = 16 + Math.sin(a) * 9.5 * k, r = 4.2 - 0.8 * Math.abs(Math.cos(a)); tuft(g, x, y, r, a, 1.1 * k); }
  g.fill();
  g.strokeStyle = C.outWh; g.lineWidth = ow * 0.75; g.lineCap = 'round'; g.globalAlpha = 0.5 * v;
  for (const a of [1.15, 1.57, 1.99]) { const x = cx + Math.cos(a) * 13 * k, y = 16 + Math.sin(a) * 9.5 * k + 1.6; g.beginPath(); g.arc(x, y, 2.4, 0.5, PI - 0.5); g.stroke(); }
  g.globalAlpha = 1;
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
// Ears. A flattened ear or a twitch swivels the opening out and back (sw): the pink narrows toward the outer
// edge and the furred back of the ear shows, with the crease of its rim; a flattened ear also folds its tip.
// A head turned past about half profile (|o| > 0.45) draws as a 3/4 head (pf 0..1): the muzzle juts out of the
// silhouette toward where it looks, the cranium and cheeks fall back, the near eye moves forward, the far eye
// narrows behind the bridge of the nose, the far ear drops behind the head and the far cheek ruff is hidden.
const prof = (o) => sstep((Math.abs(o) - 0.45) / 0.42);
// an eye's centre across the head (head units) for the turn o; k -1 / 1 the left / right eye
function eyeX(o, k) { const far = Math.max(0, k * o), sg = o < 0 ? -1 : 1; return o * 8.5 + k * 10.2 * (1 - 0.3 * far) + (k === sg ? -1.5 : 2.5) * sg * prof(o); }
function drawEar(g, p, o, k, fy, st, ow) {
  const far = Math.max(0, k * o), flat = Math.max(0, -p.earRot), perk = Math.max(0, p.earRot), pf = prof(o), sg = o < 0 ? -1 : 1, fe = k === sg ? pf : 0;
  const sw = clamp(Math.max(0, -(k < 0 ? p.earL : p.earR)) * 1.2 + flat * 0.7), fold = clamp((flat - 0.4) / 0.45);
  const w = 15.6 * (1 - 0.42 * far) * (1 - 0.25 * sw) * (1 - 0.18 * fe), h = 17.6 * (1 - 0.1 * far) * (1 - 0.16 * flat) + perk * 1.2 - fold * 1.6;
  const bx = k * (11.8 - far * 2) + o * 6.2 + sg * pf * (k === sg ? -3 : 2), by = -12.3 + fy * 0.35 + flat * 1.6 + 2 * fe;
  const rot = k * (0.3 + 0.62 * flat - 0.14 * perk) + (k < 0 ? p.earL : p.earR) * k;
  g.save(); g.translate(bx, by); g.rotate(rot);
  const tx = k * (1.2 + fold * 2.6), ep = new Path2D();
  ep.moveTo(-w / 2, 3); ep.quadraticCurveTo(-w * 0.4, -h * 0.55, tx - 1.7, -h + 1.6); ep.quadraticCurveTo(tx, -h - 0.9, tx + 1.7, -h + 1.6); ep.quadraticCurveTo(w * 0.4, -h * 0.55, w / 2, 3); ep.closePath();
  const eg = g.createLinearGradient(0, -h, 0, 3); eg.addColorStop(0, C.furDk); eg.addColorStop(0.45, C.fur); eg.addColorStop(1, C.furLt);
  ink(g, ep, eg, ow);
  g.save(); g.clip(ep);
  const iw = w * 0.56 * (1 - far * 0.55) * (1 - 0.7 * sw), ih = h * 0.72, ix = -k * w * 0.07 * (1 - far) + k * w * 0.2 * sw;
  const ip = new Path2D();
  ip.moveTo(ix - iw / 2, 2); ip.quadraticCurveTo(ix - iw * 0.36, -ih * 0.55, ix + tx * 0.6, -ih); ip.quadraticCurveTo(ix + iw * 0.36, -ih * 0.55, ix + iw / 2, 2); ip.closePath();
  const ig = g.createLinearGradient(0, -ih, 0, 2); ig.addColorStop(0, C.earIn); ig.addColorStop(1, C.earIn2);
  g.fillStyle = ig; g.fill(ip);
  if (sw > 0.05 && !st.lod) { // the rim of the turned pinna, between its pink inside and its furred back
    g.globalAlpha = clamp(sw * 1.4); g.strokeStyle = C.furDk; g.lineWidth = 1; g.lineCap = 'round';
    g.beginPath(); g.moveTo(ix - k * iw * 0.5, 2.5); g.quadraticCurveTo(ix - k * iw * 0.45, -ih * 0.55, ix + tx * 0.6, -ih); g.stroke(); g.globalAlpha = 1;
  }
  if (!st.lod) {
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 0.7; g.lineCap = 'round';
    for (const s of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(ix + s * iw * 0.5, 2); g.quadraticCurveTo(ix + s * iw * 0.9, -ih * 0.25, ix + s * iw * 0.3 - k * 0.8, -ih * 0.48); g.stroke(); }
  }
  if (fold > 0.05 && !st.lod) { // the crease where the tip folds out
    g.globalAlpha = 0.7 * fold; g.strokeStyle = C.furDk; g.lineWidth = 1; g.beginPath(); g.moveTo(tx - 3, -h + 5); g.quadraticCurveTo(tx, -h + 3.6, tx + 3, -h + 4.6); g.stroke(); g.globalAlpha = 1;
  }
  g.restore();
  g.restore();
}
// only: draw just that eye (-1 / 1), skip: leave that one out (a 3/4 head draws its far eye under the muzzle)
function drawEyes(g, p, o, fy, st, only, skip) {
  const m = o * 8.5, es = st.eyeS;
  for (const k of [-1, 1]) {
    if ((only && k !== only) || k === skip) continue;
    const far = Math.max(0, k * o), fw = (1 - 0.42 * far) * (1 - 0.4 * (k * o > 0 ? prof(o) : 0));
    const ex = eyeX(o, k), ey = -0.6 + fy;
    const rx = 6.3 * fw * es, ry = 7.0 * p.eyeOpen * es * (k * o > 0 ? 1 - 0.25 * prof(o) : 1);
    g.save(); g.translate(ex, ey); g.rotate(k * 0.1);
    if (p.lid < 0.82) {
      // the pale socket halo fades as the lids close, and the lids are clipped to it, so a half-closed
      // eye never shows a grey disc inside a light ring ("goggles")
      const shut = Math.max(p.lid, p.lidLow * 0.85), halo = 1 - sstep((shut - 0.12) / 0.45);
      if (halo > 0.02) { g.fillStyle = `rgba(242,236,226,${(0.5 * halo).toFixed(3)})`; g.beginPath(); g.ellipse(0, 0.4, rx + 2.1, ry + 1.9, 0, 0, TAU); g.fill(); }
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
function mouthGeo(p, o, fy) { const pf = prof(o), nx = o * lerp(10.9, 9.5, pf) + (o < 0 ? -6 : 6) * pf * pf, ny = 4.6 + fy * 0.8 + 1.5 * pf; return { nx, ny, my: ny + 1.9 }; }
// the jaw hinge: as the mouth opens past a talking level the lower jaw drops (chin and white muzzle follow)
function jawDrop(p) { return p.mouth > 0.04 ? Math.max(0, 0.94 * (1.0 + 8.6 * p.mouth) * (1 + 0.45 * p.jawTall) - 4.2) * 0.8 : 0; }
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
    g.strokeStyle = '#4b2530'; g.lineWidth = 0.8; g.stroke(mp);
  }
  g.strokeStyle = '#4e3a3a'; g.lineWidth = 1.15; g.lineCap = 'round'; g.beginPath();
  g.moveTo(nx, my); g.lineTo(nx, my + 1.6);
  g.moveTo(nx, my + 1.6); g.quadraticCurveTo(nx - 1.7 * kL, my + 3.4, nx - 3.7 * kL, my + 2.4 - p.smile * 1.4);
  g.moveTo(nx, my + 1.6); g.quadraticCurveTo(nx + 1.7 * kR, my + 3.4, nx + 3.7 * kR, my + 2.4 - p.smile * 1.4);
  if (p.smile < -0.2) { g.moveTo(nx - 3.7 * kL, my + 2.4 - p.smile * 1.4); g.lineTo(nx - 4.4 * kL, my + 3.6 - p.smile * 1.4); g.moveTo(nx + 3.7 * kR, my + 2.4 - p.smile * 1.4); g.lineTo(nx + 4.4 * kR, my + 3.6 - p.smile * 1.4); }
  g.stroke();
  drawTongue(g, p, o, fy);
  const nw = 5.8 * (1 - 0.22 * ao) * (1 - 0.2 * prof(o)), nh = 3.8;
  const np = new Path2D();
  np.moveTo(nx - nw / 2, ny - nh / 2); np.quadraticCurveTo(nx, ny - nh / 2 - 0.9, nx + nw / 2, ny - nh / 2);
  np.quadraticCurveTo(nx + nw * 0.24, ny + nh * 0.32, nx, ny + nh / 2); np.quadraticCurveTo(nx - nw * 0.24, ny + nh * 0.32, nx - nw / 2, ny - nh / 2); np.closePath();
  const ng = g.createLinearGradient(0, ny - nh / 2, 0, ny + nh / 2); ng.addColorStop(0, C.nose); ng.addColorStop(1, C.noseDk);
  g.fillStyle = ng; g.fill(np); g.strokeStyle = '#b25e6c'; g.lineWidth = 0.6; g.stroke(np);
  g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(nx - nw * 0.18, ny - nh * 0.2, 0.9, 0.55, -0.3, 0, TAU); g.fill();
}
function drawWhiskers(g, p, o, fy) {
  const pf = prof(o), m = o * 8.5 + (o < 0 ? -6 : 6) * pf;
  g.lineCap = 'round';
  for (const k of [-1, 1]) {
    const far = Math.max(0, k * o), fl = (1 - 0.45 * far) * (1 - 0.5 * (k * o > 0 ? pf : 0));
    const bx = m + k * 5.2 * (1 - 0.25 * far), by = 9 + fy * 0.6;
    for (let j = 0; j < 3; j++) {
      const a0 = [-0.2, 0.04, 0.27][j] - p.whisk * 0.22 + p.whiskT * (j === 1 ? 0.2 : 0.12);
      const len = (17 - j * 1.2) * fl, dxx = k * Math.cos(a0), dyy = Math.sin(a0);
      const sx = bx + dxx * 3, sy = by + dyy * 3 + j * 0.9, ex = bx + dxx * len, ey = by + dyy * len + 1.4 + j * 0.9;
      const cx = bx + dxx * len * 0.55, cy = by + dyy * len * 0.55 - 1.3 + j * 0.9;
      g.strokeStyle = 'rgba(70,56,52,.3)'; g.lineWidth = 1.05; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 0.55; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
    }
  }
}
function headXf(g, R, p) { g.translate(R.head[0], R.head[1]); g.rotate(p.headRoll * D2R); const hs = p.headScale * HS; g.scale(hs * (1 + p.squish * 0.06), hs * (1 - p.squish * 0.05)); }
function drawHead(g, R, p, st) {
  const o = R.o, ao = Math.abs(o), ow = st.ow / HS, fy = p.headPitch * 3.2, m = o * 8.5, jd = jawDrop(p), kit = st.kit, pf = prof(o), sg = o < 0 ? -1 : 1, mz = m + sg * 5 * pf;
  g.save(); headXf(g, R, p);
  if (!st.lod) drawRuff(g, p, o, st, ow, (-p.gy - R.head[1]) / (HS * p.headScale));
  drawCollar(g, o, ow);
  for (const k of [-1, 1]) drawEar(g, p, o, k, fy, st, ow);
  const hp = new Path2D();
  ell(hp, -o * 2.2 - sg * 3 * pf, -1.5 + fy * 0.2, 19.7 - 1.2 * pf, 16.4);
  ell(hp, o * 1.0 - sg * 2 * pf, 5.8 + fy * 0.3 + jd * 0.25, 21.4 - 2.5 * pf, 12.6 + jd * 0.2);
  ell(hp, m * 1.25 + sg * 5.5 * pf, 8.6 + fy * 0.6 + jd, 9.5 - 0.5 * pf, 7.8 - 0.6 * pf + jd * 0.15);
  // cheek ruffs: fur tufts at the sides of the face, swept out and down
  for (const k of [-1, 1]) {
    const far = Math.max(0, k * o), ex = k * (20.4 - far * 1.8) + o * 1.0 - sg * 2 * pf, sc = (1 - 0.35 * far) * (k === sg ? 1 - pf : 1), A = (a) => (k > 0 ? a : PI - a);
    if (sc < 0.05) continue;
    tuft(hp, ex - k * 0.9 * sc, 3.5, 2.6 * sc, A(0.1), 1.1 * sc); tuft(hp, ex + k * 0.5 * sc, 7.4, 3.0 * sc, A(0.45), 1.6 * sc);
    tuft(hp, ex - k * 0.7 * sc, 11.2, 3.0 * sc, A(0.85), 1.5 * sc); tuft(hp, ex - k * 3.6 * sc, 14.1, 2.5 * sc, A(1.2), 1.0 * sc);
  }
  ink(g, hp, null, ow);
  g.save(); g.clip(hp);
  edgeFill(g, hp, C.fur, C.rimL, st.rimD / HS);
  // a 3/4 head: the far eye goes under the muzzle and inside the outline (the bridge of the nose hides its inner corner)
  const tuck = pf > 0.05 ? sg : 0;
  if (tuck) drawEyes(g, p, o, fy, st, tuck);
  // white lower face (muzzle, chin, lower cheeks), from the photo; the chin drops with the jaw
  g.fillStyle = C.wh;
  g.beginPath(); g.ellipse(m * 1.1 + sg * 4 * pf, 12.4 + fy * 0.6 + jd * 0.75, 15 - ao * 2.2 - 3 * pf, 8.2 + jd * 0.3, 0, 0, TAU); g.fill();
  for (const k of [-1, 1]) { const far = Math.max(0, k * o); g.beginPath(); g.ellipse(mz + k * 4.8 * (1 - 0.25 * far), 8.7 + fy * 0.6, 6.6 * (1 - 0.3 * far), 5.4, 0, 0, TAU); g.fill(); }
  g.beginPath(); g.moveTo(mz - 2.2, 7 + fy * 0.6); g.quadraticCurveTo(mz + o * 2, -1 + fy * 0.5, mz + 2.2, 7 + fy * 0.6); g.fill();
  // tabby "M", crown and cheek bars
  g.strokeStyle = C.furDk; g.lineCap = 'round'; g.globalAlpha = 0.85;
  g.lineWidth = st.lod ? 2.4 : 1.9 + 0.4 * st.small;
  const M = [[m - 7.5, -15.5, m - 5.6, -11, m - 3.6, -7.6], [m - 2.2, -17, m - 0.6, -12.5, m - 0.2, -8.6], [m + 2.4, -17, m + 1.4, -12.5, m + 0.9, -8.6], [m + 7.5, -15.5, m + 5.4, -11, m + 3.8, -7.6]];
  for (const s of M) { g.beginPath(); g.moveTo(s[0], s[1]); g.quadraticCurveTo(s[2], s[3], s[4], s[5]); g.stroke(); }
  g.lineWidth = 2.6; for (const x of [-9, -2.5, 4]) { g.beginPath(); g.moveTo(x - o * 3, -20); g.quadraticCurveTo(x - o * 4, -17, x - o * 6 - 1, -15.8); g.stroke(); }
  if (!st.lod) {
    g.lineWidth = 1.7;
    for (const k of [-1, 1]) {
      const far = Math.max(0, k * o), ex = eyeX(o, k);
      if (k === sg && pf > 0.6) continue; // the far cheek bars are round the side
      g.beginPath(); g.moveTo(ex + k * 6.5 * (1 - far * 0.5), 1.8 + fy); g.quadraticCurveTo(ex + k * 10, 0.6 + fy, k * 21, -0.8); g.stroke();
      g.beginPath(); g.moveTo(ex + k * 5.6 * (1 - far * 0.5), 4.6 + fy); g.quadraticCurveTo(ex + k * 9.5, 4.4 + fy, k * 21, 4.4); g.stroke();
    }
  }
  g.globalAlpha = 1;
  // rosy cheeks
  for (const k of [-1, 1]) {
    const far = Math.max(0, k * o), ex = eyeX(o, k);
    g.fillStyle = C.blush; g.globalAlpha = 0.3 * p.blush * (1 - far * 0.5);
    g.beginPath(); g.ellipse(ex + k * 1.8, 7.6 + fy * 0.8, 3.8 * (1 - far * 0.4), 2.2, 0, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
  furTex(g, st, o * 4, -4, 0.18);
  // volume: the lower right of the head in a soft shade (the muzzle stays bright), a warm key on the brow
  if (!st.lod) { glow(g, kit.shade, -4 + o * 3, -4, 34, 34, 0.5 * (1 - 0.55 * st.small), 'multiply', 3); glow(g, kit.key, -8 + o * 3, -10, 13, 10, 0.85 * (1 - 0.5 * st.small)); }
  g.restore();
  drawEyes(g, p, o, fy, st, 0, tuck);
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

/* ---------- effects (hearts, purr note, zzz, confetti, rub wisps …): shapes only, no text on the canvas ---------- */
function heart(g, x, y, s) { g.beginPath(); g.moveTo(x, y + s * 0.9); g.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.8, y - s * 1.3, x, y - s * 0.45); g.bezierCurveTo(x + s * 0.8, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9); g.fill(); }
// a musical note (the purr), drawn as a shape
function note(g, x, y, s) {
  g.beginPath(); g.ellipse(x, y, 1.45 * s, 1.05 * s, -0.4, 0, TAU); g.fill();
  g.lineWidth = 0.5 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + 1.25 * s, y - 0.3 * s); g.lineTo(x + 1.25 * s, y - 4.8 * s); g.quadraticCurveTo(x + 1.9 * s, y - 3.3 * s, x + 3.3 * s, y - 3.1 * s); g.stroke();
}
// sleep: a little crescent moon (no letter: the UI is in 10 languages), radius s, its opening turned by a
const MOON = (() => { const d = 0.5, r2 = 0.82, x = (d * d + 1 - r2 * r2) / (2 * d), t1 = Math.atan2(Math.sqrt(1 - x * x), x), t2 = Math.atan2(Math.sqrt(1 - x * x), x - d); return { d, r2, t1, t2 }; })();
function moon(g, x, y, s, a) {
  const M = MOON;
  g.beginPath(); g.arc(x, y, s, a + M.t1, a + TAU - M.t1);
  g.arc(x + Math.cos(a) * M.d * s, y + Math.sin(a) * M.d * s, M.r2 * s, a + TAU - M.t2, a + M.t2, true); g.closePath(); g.fill();
}
function drawFx(g, R, p, st) {
  const [hx, hy] = R.head, T = st.T, h = HS;
  if (p.purr > 0.35) {
    const a = clamp((p.purr - 0.35) / 0.4);
    // st.top: the canvas top in cat units (mascot mode); the hearts rise only that far
    const rise = Math.max(8, Math.min(26, hy - 28 * h - st.top));
    for (let i = 0; i < 3; i++) {
      const ph = fract(T * 0.42 + i / 3), x = hx + (14 + i * 7) * h - ph * 4 + Math.sin(ph * 6 + i) * 2, y = hy - 22 * h - ph * rise;
      g.globalAlpha = a * Math.sin(PI * ph) * 0.9; g.fillStyle = i === 1 ? '#ff9db5' : '#ff7f9f'; heart(g, x, y, 2.6 + i * 0.4);
    }
    g.globalAlpha = a;
    if (!st.cap) { // below 130 px the bubble would be a few pixels high: hearts only
      const bx = hx - 30 * h, by = Math.max(hy - 40 * h, st.top + 1), bw = 14, bh = 11;
      g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(79,70,229,.35)'; g.lineWidth = 0.8;
      g.beginPath(); if (g.roundRect) g.roundRect(bx, by, bw, bh, 5.5); else g.rect(bx, by, bw, bh); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(bx + bw - 5, by + bh - 0.4); g.lineTo(bx + bw - 0.5, by + bh + 4); g.lineTo(bx + bw - 9, by + bh - 0.4); g.closePath(); g.fill();
      g.fillStyle = C.collar; g.strokeStyle = C.collar; note(g, bx + bw / 2 - 1.2, by + bh / 2 + 2 + Math.sin(T * 9) * 0.5, 0.95);
    }
    g.globalAlpha = 1;
  }
  if (p.zzz > 0.3) { // little moons drifting up and growing (soft indigo: it reads on light and dark surfaces)
    g.fillStyle = C.collarLt;
    for (let i = 0; i < 3; i++) {
      const ph = fract(T * 0.22 + i / 3), s = 1.3 + ph * 1.6, x = hx + 9 * h + ph * 9 + Math.sin(ph * 5 + i) * 1.6, y = hy - 18 * h - ph * Math.max(8, Math.min(28, hy - 18 * h - st.top - 4));
      g.globalAlpha = clamp(p.zzz) * Math.sin(PI * ph) * 0.8; moon(g, x, y, s, 2.4 + 0.5 * Math.sin(ph * 4 + i));
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
    // a light halo, so the dots also read over a dark surface (the landing phone's screen)
    g.fillStyle = st.ink; g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) { const a = clamp(Math.sin(T * 3 - i * 0.7) * 0.5 + 0.6); g.globalAlpha = st.think * a * 0.55; g.beginPath(); g.arc(hx - (18 + i * 5.5) * h, hy - (26 + i * 4) * h, 1.4 + i * 0.6, 0, TAU); g.stroke(); g.fill(); }
    g.globalAlpha = 1;
  }
  if (st.surprise > 0.3) {
    g.strokeStyle = C.accent; g.lineWidth = 1.5; g.lineCap = 'round'; g.globalAlpha = st.surprise;
    for (const a of [-2.3, -1.6, -0.9]) { const x = hx + Math.cos(a) * 30 * h, y = hy - 4 + Math.sin(a) * 30 * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); g.stroke(); }
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
  if (st.under) st.under(); // a toy on the floor under the paws that pin it
  const legs = R.legs.slice().sort((a, b) => a.depth - b.depth);
  // tail layer: behind all, after the torso, in front of the near hind leg, or (tailFront 1.5) in front of the front legs too
  const tl = p.tailFront < 0.33 ? 0 : p.tailFront < 0.67 ? 1 : p.tailFront < 1.33 ? 2 : 3;
  const pawK = p.pawFront > 0.5 ? (p.pawFar > 0.5 ? 'ff' : 'nf') : '';
  const pawK2 = p.paw2 > 0.5 ? (pawK === 'ff' ? 'nf' : 'ff') : ''; // second paw over the face (celebrate, cheer)
  if (tl === 0) drawTail(g, R, p, st);
  for (const L of legs) if (L.depth < 0 && L.k !== pawK && L.k !== pawK2) drawLeg(g, L, p, st, true, R);
  drawTorso(g, R, p, st);
  if (tl === 1) drawTail(g, R, p, st);
  for (const L of legs) if (L.depth >= 0 && !L.front) drawLeg(g, L, p, st, false, R);
  if (tl === 2) drawTail(g, R, p, st);
  if (st.mid) st.mid(); // a toy on the floor in front of the chest: in front of the far legs, behind the near ones and the head
  for (const L of legs) if (L.depth >= 0 && L.front && L.k !== pawK && L.k !== pawK2) drawLeg(g, L, p, st, false, R);
  if (tl === 3) drawTail(g, R, p, st);
  drawHead(g, R, p, st);
  for (const k of [pawK2, pawK]) {
    if (!k) continue;
    const L = R.legs.find((l) => l.k === k);
    drawLeg(g, L, p, st, false, R);
  }
  if (pawK && p.tongue > 0.05) { g.save(); headXf(g, R, p); drawTongue(g, p, R.o, p.headPitch * 3.2); g.restore(); }
  if (st.toyOver) st.toyOver(); // a toy in front of the cat
  drawFx(g, R, p, st);
  if (st.over) st.over(); // the laser dot
}

/* ---------- toys (mascot acts): a grey toy mouse, a red yarn ball, the laser dot; in act units, origin on the floor ---------- */
// t: { x, y (up from the floor), a (alpha), rot, sc (scale), dir (where it faces: ±1), tw (tail wiggle phase), v }
function drawMouseToy(g, t, st) {
  const sc = t.sc || 1, sw = Math.sin(t.tw || 0) * 2.4 * clamp(Math.abs(t.v || 0) / 30 + (t.carry ? 0.6 : 0)); // the string tail wiggles while it moves
  g.globalAlpha = t.a;
  if (!t.carry) glow(g, st.kit.contact, t.x, 0.3, 8 * sc, 1.7 * sc, 0.7 * t.a * clamp(1 - t.y / 10));
  g.save(); g.translate(t.x, -t.y - 3.9 * sc); g.rotate(t.rot); g.scale(sc * (t.dir < 0 ? -1 : 1), sc);
  g.strokeStyle = '#c4707f'; g.lineWidth = 1.1; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-6.6, 1.3); g.bezierCurveTo(-9.5, 1.6 + sw, -11.5, -1.6 - sw, -14.5, 0.6 + sw * 0.6); g.stroke();
  const bp = new Path2D();
  bp.moveTo(7.6, 1.2); bp.bezierCurveTo(5.4, -4.9, -4.6, -5.3, -7.1, -0.6); bp.bezierCurveTo(-8.1, 2.9, -3.8, 4.1, 0, 4); bp.bezierCurveTo(4, 3.9, 6.7, 2.9, 7.6, 1.2); bp.closePath();
  ink(g, bp, '#a8a2a9', 0.85, '#4f4851');
  g.save(); g.clip(bp); glow(g, st.kit.shade, 0, 1, 9, 6, 0.9 * t.a, 'multiply', 3); glow(g, st.kit.key, -1.5, -2.6, 5, 2.4, 0.9 * t.a); g.restore();
  g.fillStyle = '#a8a2a9'; g.strokeStyle = '#4f4851'; g.lineWidth = 0.85; g.beginPath(); g.arc(2.2, -3.4, 2.4, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = C.earIn; g.beginPath(); g.arc(2.3, -3.3, 1.35, 0, TAU); g.fill();
  g.fillStyle = C.pupil; g.beginPath(); g.arc(4.9, -0.7, 0.75, 0, TAU); g.fill();
  g.fillStyle = C.nose; g.beginPath(); g.arc(7.6, 1.1, 0.95, 0, TAU); g.fill();
  g.restore(); g.globalAlpha = 1;
}
const YARN_R = 5.4;
// the yarn ball: bold wraps that turn as it rolls, and its thread, always attached, trailing behind it on the floor
// (hanging from it while it is in the air) and whipping when it is knocked
function drawYarn(g, t, st) {
  const sc = t.sc || 1, r = YARN_R * sc, cx = t.x, cy = -r - t.y, dir = t.dir < 0 ? -1 : 1, whip = clamp(Math.abs(t.v || 0) / 90);
  g.globalAlpha = t.a; g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#b8352e'; g.lineWidth = 0.95; g.beginPath();
  const n = 14, Lt = t.len || 22 * sc;
  for (let i = 0; i <= n; i++) {
    const f = i / n, x = cx - dir * (r * 0.3 + f * Lt), y0 = lerp(t.y + 0.4, 0.5, sstep(f * 2.5));
    const y = -y0 - (0.8 + 2.6 * whip) * Math.sin(f * 9 + (t.ph || 0)) * Math.sin(PI * f) * (1 - 0.4 * f);
    if (i) g.lineTo(x, y); else g.moveTo(cx - dir * r * 0.2, cy + r * 0.95);
  }
  g.stroke();
  glow(g, st.kit.contact, cx, 0.3, r * 1.3, 1.6, 0.75 * t.a * clamp(1 - t.y / 10));
  const bp = new Path2D(); circ(bp, cx, cy, r);
  ink(g, bp, '#d4473d', 0.85, '#7a2620');
  g.save(); g.clip(bp); g.translate(cx, cy); g.rotate(t.rot);
  // wound strands: two bold wraps and a light one, at different angles, turning as the ball rolls
  for (const [ang, col, w] of [[0.4, 'rgba(120,24,22,.7)', 1.5], [1.9, 'rgba(120,24,22,.6)', 1.3], [-0.9, 'rgba(255,198,182,.75)', 1.1]]) {
    g.save(); g.rotate(ang); g.strokeStyle = col; g.lineWidth = w;
    for (const k of [-0.45, 0.1, 0.62]) { g.beginPath(); g.ellipse(0, k * r, r * 1.05, r * 0.42, 0, PI * 0.05, PI * 0.95); g.stroke(); }
    g.restore();
  }
  g.restore();
  g.save(); g.clip(bp); glow(g, st.kit.shade, cx, cy, r * 1.1, r * 1.1, 0.8 * t.a, 'multiply', 3); glow(g, st.kit.key, cx - r * 0.35, cy - r * 0.4, r * 0.6, r * 0.45, 0.9 * t.a); g.restore();
  g.globalAlpha = 1;
}
// the little knitted blanket the cat kneads (t.x its middle, t.r half its width; t.pn / t.pf: how hard the near / far
// paw presses there, at t.xn / t.xf): a soft lavender throw flat on the floor, its front edge rumpled, a dent under a
// pressing paw
function drawBlanket(g, t, st) {
  const w = t.r, x0 = t.x - w, x1 = t.x + w, back = -6.5, front = 4;
  g.globalAlpha = t.a;
  const bp = new Path2D();
  bp.moveTo(x0 + 4, back); bp.quadraticCurveTo(t.x, back - 1.2, x1 - 4, back); bp.quadraticCurveTo(x1 + 1, back, x1 + 0.5, back + 4);
  bp.quadraticCurveTo(x1 + 1.5, front, x1 - 4, front);
  for (let i = 1; i <= 4; i++) { const xa = lerp(x1 - 4, x0 + 4, i / 4), xm = lerp(x1 - 4, x0 + 4, (i - 0.5) / 4); bp.quadraticCurveTo(xm, front + (i % 2 ? 2.2 : 0.6), xa, front); }
  bp.quadraticCurveTo(x0 - 1.5, front, x0 - 0.5, back + 4); bp.quadraticCurveTo(x0 - 1, back, x0 + 4, back); bp.closePath();
  ink(g, bp, '#d8d0f3', 0.75, '#8f84c9');
  g.save(); g.clip(bp);
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.1;
  for (const f of [-0.6, -0.2, 0.2, 0.6]) { g.beginPath(); g.moveTo(t.x + f * w - 1.5, back); g.quadraticCurveTo(t.x + f * w * 1.05, -1.2, t.x + f * w + 1.5, front + 2); g.stroke(); }
  g.strokeStyle = 'rgba(143,132,201,.45)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x0, -1.6); g.quadraticCurveTo(t.x, -0.6, x1, -1.6); g.stroke();
  glow(g, st.kit.shade, t.x, front, w * 1.1, 6, 0.5, 'multiply', 3);
  for (const [x, pr] of [[t.xn, t.pn], [t.xf, t.pf]]) if (pr > 0.02) glow(g, st.kit.ao, x, -0.6, 6.5, 2.6, 0.9 * pr);
  g.restore(); g.globalAlpha = 1;
}
const TOY_DRAW = { mouse: drawMouseToy, yarn: drawYarn, blanket: drawBlanket };
// the laser dot: steady (never blinking), a red core in a soft glow
function drawLaserDot(g, x, y, a, k) {
  g.globalAlpha = a; g.fillStyle = 'rgba(255,60,60,.28)'; g.beginPath(); g.arc(x, y, 4.2 * k, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,40,40,.5)'; g.beginPath(); g.arc(x, y, 2.4 * k, 0, TAU); g.fill();
  g.fillStyle = '#ff4a3d'; g.beginPath(); g.arc(x, y, 1.45 * k, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,236,226,.95)'; g.beginPath(); g.arc(x - 0.3 * k, y - 0.3 * k, 0.6 * k, 0, TAU); g.fill();
  g.globalAlpha = 1;
}


/* ============================ poses (data) ============================ */
const STAND = P({ sag: 5, arch: 3.5 });
const SIT = P({ hipY: 12, shY: 41, bodyL: 40, shift: -2, arch: 5, sag: 0.5, neckA: 78, neckL: 16, faceCam: 0.72,
  nfx: 14, ffx: 16.5, nhx: -2, nha: 1.45, fhx: 0.5, fha: 1.45,
  tailA: -70, tailCurl: 9, tailTip: 40, tailWave: 3, tailSpd: 0.9, tailFront: 1, tailRoot: 0.08, earRot: 0.3, smile: 0.4 });
const PRESENT = Object.assign({}, SIT, { theta: 0.8, faceCam: 0.85, legZ: 6.5, nfx: 14, ffx: 14, nhx: -2, fhx: -2, smile: 0.45 });
// the tail leaves from under the near haunch (drawn over its root) and wraps along the floor to the front paws
const LOAF = P({ hipY: 12, shY: 14, bodyL: 44, arch: 7, sag: 0, neckA: 50, neckL: 13, faceCam: 0.7, lid: 0.6,
  nfx: 22, nfy: 0, nfa: -0.2, ffx: 24, ffy: 0.5, nhx: -6, nha: 1.5, fhx: -4, fhy: 0.5, fha: 1.5,
  tailA: -150, tailCurl: 0.6, tailTip: 38, tailWave: 1.5, tailSpd: 0.6, tailFront: 0.5, tailRoot: 0.05, tailDX: 7, tailDY: -3, tailPuff: 0.84, earRot: -0.1 });
// the owner's photo: lying on the side in a C, back and bull's-eye on top, white belly and hind legs
// toward the viewer with the toe beans showing, front paws reaching to them, head tucked, tail round the front
const CURL = P({ hipY: 12, shY: 14, bodyL: 40, shift: -4, arch: 9, sag: 0, curl: 1, bodyR: 1.02, neckA: -10, neckL: 17, faceCam: 0.82,
  headRoll: -14, headPitch: 0.85, headScale: 0.86, headDY: 2, lid: 1, earRot: -0.3, smile: 0.35, blush: 0.8,
  elbow: 1, nfx: 13, nfy: 1, nfa: 3.14, ffx: 16, ffy: 1, ffa: 3.0, nhx: -6, nhy: 15, nha: 2.6, fhx: 1, fhy: 15, fha: 2.4, legZ: 7,
  sole: 1, beansH: 1, splay: 0.4,
  tailA: -178, tailCurl: 1.2, tailTip: 60, tailWave: 1.2, tailSpd: 0.5, tailFront: 0.5, tailLen: 0.9, tailDX: 5, tailDY: 2, tailRoot: 0.05 });
const CROUCH = P({ hipY: 24, shY: 19, bodyL: 48, shift: -2, arch: 1, sag: -1, neckA: 18, neckL: 14, faceCam: 0.2, headPitch: -0.1,
  earRot: 1, pupil: 1, eyeOpen: 1.1, whisk: 1, smile: 0,
  nfx: 24, ffx: 26, nhx: -17, nha: 0.9, fhx: -15, fha: 0.9, tailA: -8, tailCurl: 1.5, tailTip: 18, tailWave: 3, tailSpd: 3.2, tailRoot: 0.7 });
const POUNCE = P({ hipY: 30, shY: 34, bodyL: 54, arch: -3, neckA: 30, neckL: 15, faceCam: 0.18, earRot: 0.9, pupil: 1, eyeOpen: 1.15, mouth: 0.18,
  nfx: 60, nfy: 17, nfa: -0.3, ffx: 55, ffy: 14, ffa: -0.3, pawFront: 1, nhx: -42, nhy: 6, nha: 1.3, fhx: -38, fhy: 4, fha: 1.2,
  tailA: 20, tailCurl: -1, tailTip: -10, splay: 1, smile: 0 });
const LAND = P({ hipY: 31, shY: 23, bodyL: 50, shift: 2, arch: 2, neckA: 22, neckL: 14, faceCam: 0.22, headPitch: 0.35, earRot: 0.8, pupil: 0.9,
  nfx: 30, ffx: 32, nhx: -20, nha: 0.6, fhx: -18, fha: 0.6, tailA: 30, tailCurl: -2, tailTip: 10, tailWave: 6, tailSpd: 3, smile: 0.2 });
// play-bow stretch: forearms flat on the floor, chest low, rump and tail high, eyes shut
const BOW = P({ shY: 13, hipY: 40, bodyL: 51, shift: -3, arch: -5, sag: -1, neckA: 70, neckL: 12, headPitch: -0.3, faceCam: 0.35, lid: 1, mouth: 0.1, earRot: -0.35,
  nfx: 44, nfy: -2.5, nfa: 0.05, ffx: 47, ffy: -2.5, ffa: 0.05, nhx: -22, nha: 0.15, fhx: -20, fha: 0.15,
  tailA: 78, tailCurl: -7, tailTip: -24, tailWave: 2.5, tailSpd: 0.6, splay: 1 });
// back-leg stretch: body length kept near the stand, the near hind leg reaching back, tail in a low curve
const BACK = P({ shY: 37, hipY: 32, bodyL: 50, shift: 3, arch: -1, neckA: 46, neckL: 15, headPitch: -0.3, faceCam: 0.3, lid: 0.7,
  nfx: 30, ffx: 32, nhx: -38, nhy: 7, nha: 1.2, fhx: -21, fha: 0.3,
  tailA: 34, tailCurl: -5.5, tailTip: -14, tailWave: 3, tailSpd: 0.55, splay: 0.6 });
const RUB = P({ hipY: 38, shY: 39, arch: 6, neckA: 36, neckL: 15, faceCam: 0.3, headRoll: -8, lid: 0.5, lidLow: 0.35, earRot: -0.05, smile: 0.7, blush: 0.95,
  tailA: 92, tailCurl: -1.5, tailTip: -34, tailQuiver: 1, tailWave: 1.5, tailSpd: 1, purr: 0.5 });
const KNEADST = P({ hipY: 36, shY: 33, arch: 2, neckA: 40, faceCam: 0.6, lid: 0.62, lidLow: 0.4, smile: 0.7, purr: 0.8, tailA: 80, tailCurl: -4, tailTip: -25 });
// the leap (leapPose): the load (hips down, hind paws gathered under, shoulders back, the tail low and still), the tuck
// at the top of the arc (paws drawn up, back rounded) and the reach for the floor (front paws out and down, hind legs
// trailing); POUNCE is the stretched-out launch between the load and the tuck, LAND the landing
const LOADP = P({ hipY: 19, shY: 16, bodyL: 46, shift: -4, arch: 3, sag: -1, neckA: 14, neckL: 13, faceCam: 0.2, headPitch: -0.05, earRot: 1, pupil: 1, eyeOpen: 1.12, whisk: 1, smile: 0,
  nfx: 22, ffx: 24, nhx: -11, nha: 0.7, fhx: -9, fha: 0.7, tailA: -12, tailCurl: 0.8, tailTip: 8, tailWave: 0.6, tailSpd: 0.6, tailRoot: 0.3 });
const TUCKP = P({ hipY: 31, shY: 36, bodyL: 46, arch: 7, neckA: 34, neckL: 15, faceCam: 0.2, earRot: 0.9, pupil: 1, eyeOpen: 1.15, mouth: 0.12, smile: 0,
  nfx: 33, nfy: 17, nfa: 0.9, ffx: 30, ffy: 15, ffa: 0.9, nhx: -15, nhy: 12, nha: 1.7, fhx: -12, fhy: 11, fha: 1.7, tailA: 24, tailCurl: 1.5, tailTip: 14, tailWave: 1 });
const REACHP = P({ hipY: 37, shY: 30, bodyL: 52, arch: 0, neckA: 24, neckL: 15, faceCam: 0.2, headPitch: 0.3, earRot: 0.9, pupil: 1, eyeOpen: 1.12, mouth: 0.08, smile: 0, splay: 1,
  nfx: 44, nfy: 0, nfa: -0.4, ffx: 40, ffy: 2, ffa: -0.4, nhx: -30, nhy: 14, nha: 1.4, fhx: -27, fhy: 12, fha: 1.4, tailA: 44, tailCurl: -1, tailTip: -6, tailWave: 1 });
// kneading in the mascot box: sitting, leant forward over a little blanket, the paws out front taking turns to press
const KNEADM = Object.assign({}, PRESENT, { hipY: 13, shY: 34, bodyL: 39, shift: 1, arch: 6, neckA: 64, neckL: 14, headPitch: 0.18, nfx: 20, ffx: 20,
  lid: 0.62, lidLow: 0.4, smile: 0.8, purr: 0.85, earRot: 0.05, blush: 0.9 });

/* ============================ gaits: distance-driven footfalls ============================ */
// lateral-sequence walk (near hind → near fore → far hind → far fore), trot pairs the diagonals
const GAITS = {
  walk: { duty: 0.62, S: 26, T: 1.05, lf: 6.5, lh: 5.5, off: { nh: 0, nf: 0.75, fh: 0.5, ff: 0.25 } },
  trot: { duty: 0.42, S: 30, T: 0.5, lf: 8, lh: 7, off: { nh: 0, ff: 0.02, fh: 0.5, nf: 0.52 } },
  // rotary gallop: the fore pair lands (stance ~0.41-0.8 of the stride), then the hind pair (~0.91-1.3); the spine
  // extends while the fore paws reach out and gathers while all four are under the body (flex, degrees on each
  // spine segment, peak at flexPh + 0.25), and the body leaves the floor in the two gaps between the pairs (air)
  gallop: { duty: 0.3, S: 34, T: 0.4, lf: 11, lh: 8, off: { nh: 0, fh: 0.09, ff: 0.5, nf: 0.59 }, flex: 17, flexPh: 0.1, air: 7 }
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
  if (G.flex) {
    const f = Math.sin(TAU * (ph - G.flexPh)) * amp;
    p.chestBend += G.flex * f; p.pelvisBend += G.flex * f; p.bodyL += 4 * f;
    p.lift += G.air * amp * (hump(fract(ph), 0.8, 0.96) + 0.6 * hump(fract(ph), 0.3, 0.44));
    // a rocking horse: the chest rises as the hind paws push, the hips as the fore paws take the weight; the head bobs
    // a little behind the chest, and the tail waves with the stride (its own sway nearly stopped: RUNB.tailSpd)
    p.shY += 2.5 * amp * Math.sin(TAU * (ph - 0.15)); p.hipY += 2.5 * amp * Math.sin(TAU * (ph + 0.35));
    p.headDY += 1.5 * amp * Math.sin(TAU * (ph - 0.3)); p.tailPhX += TAU * ph;
  }
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
  // opts.th: keep that heading (a mascot act seen 3/4): D is then along the body, the root moving its projection
  const segs = [], dir = x1 >= x0 ? 1 : -1, D = Math.abs(x1 - x0) / (opts.th != null ? Math.abs(Math.cos(opts.th)) : 1);
  const base = opts.base || STAND, G = GAITS[opts.gait || 'walk'], spd = opts.speed || 1;
  if (D < 3) return { segs, x: x0, th: th0 };
  let th = th0;
  const back = !!opts.back, sgn = back ? -1 : 1, thE = back ? th0 : opts.th != null ? opts.th : dirTh(dir); // back: a few steps backwards, still facing th0
  if (!back && faceDir(th0) !== dir) { segs.push(turnSeg(x0, th0, dirTh(dir), base, opts.gait === 'trot' ? 0.6 : 0.8)); th = dirTh(dir); }
  const cyc = G.S / G.duty, v = (cyc / G.T) * spd, rp = 0.45 / spd, dur = D / v + rp, r = rp / dur, thS = th, ck = opts.th != null ? Math.abs(Math.cos(opts.th)) : 1;
  const plans = plansFor(G, D / cyc);
  segs.push({ d: dur, b: 0.3, f: (u, tl) => {
    const dd = D * trapez(u, r);
    const p = gaitPose(base, dd / cyc, ampAt(u, r), G, plans, sgn);
    p.x = x0 + dir * dd * ck; p.theta = lerp(thS, thE, sstep(tl / 0.4));
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
function idleDetails(p, u, T, cat) {
  const e1 = env(u, 0.22, 0.26, 0.33, 0.38); p.earR -= 0.6 * e1; p.earL += 0.15 * e1;              // ear swivel
  // slow "cat kiss" blink; not while holding a gesture (pointing, peering), talking or watching the pointer, where it reads as dozing off
  const sb = cat && (cat.holdName || cat.talking || (cat.hunt && cat.hunt.I > 0.2)) ? 0 : env(u, 0.54, 0.6, 0.66, 0.75); p.lid = Math.max(p.lid, 0.86 * sb); p.smile += 0.3 * sb;
  p.whiskT += Math.sin(T * 23) * env(u, 0.4, 0.42, 0.45, 0.47);                                       // whisker twitch
  const ht = env(u, 0.78, 0.83, 0.93, 0.99); p.headRoll += 9 * ht; p.lookY -= 0.55 * ht; p.lookX += 0.3 * ht; p.earL -= 0.2 * ht;
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
  return { look: true, sitting: true, loopFrom: 0, segs: [{ d, b: 0.4, f: (u, tl, T) => idleDetails(at(base, x, th), u, T, cat) }] };
};
BEH.present = (cat, o, demo) => {
  const x = demo ? cat.Wu * 0.7 : cat.x, th = cat.mode === 'mascot' ? 0.8 : faceDir(demo ? 0 : cat.th) > 0 ? 0.8 : PI - 0.8;
  return { look: true, sitting: true, loopFrom: 0, segs: [{ d: demo ? 6.5 : 7, b: 0.4, f: (u, tl, T) => idleDetails(at(PRESENT, x, th), fract(u + 0.1), T, cat) }] };
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
  if (cat.mode === 'mascot') { // framed like the roomy acts (staged): the curl is wider and lower than the sitting pose
    const g = { gy: 5 };
    segs.push({ d: 1.2, b: 0.5, f: (u) => mix(SIT0(), at(LOAF, 0, 0.5, g), eIO(u)) });
    segs.push({ d: 1.4, b: 0.2, f: (u) => mix(at(LOAF, 0, 0.5, g), at(CURL, 0, 0.2, g), eIO(u)) });
    segs.push(sleepSeg(0, 0.2, 5, demo ? 8 : o.dur || 20));
    return staged(cat, { busy: true, loopFrom: 2, segs });
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
    const x = 0, g = { gy: 5 };
    return staged(cat, { busy: true, then: o.then, thenOpts: o.thenOpts, segs: [
      { d: 1.3, b: 0.4, f: (u) => { const p = mix(at(CURL, x, 0.2, g), at(LOAF, x, 0.5, g), eIO(u)); p.lid = lerp(1, 0.55, seg(u, 0.5, 1)); return p; } },
      { d: 1.2, b: 0.2, f: (u, tl) => { const p = mix(at(LOAF, x, 0.5, g), at(PRESENT, 0, 0.8), eIO(u)); p.mouth = 0.7 * hump(u, 0.35, 0.8); p.squeeze = u > 0.45 && u < 0.75 ? 1 : 0; p.lid = u > 0.45 && u < 0.75 ? 1 : lerp(0.55, 0, seg(u, 0.75, 1)); p.fang = p.mouth; return p; } }
    ] });
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
  if (cat.mode === 'mascot') { // up onto four paws, the stretch (stretchSegs, below), and home again
    if (cat.bust) return BEH.yawn(cat, o, demo);
    const th = actTh(cat);
    const up = at(STAND, 0, th, { faceCam: cat.stage ? 0.3 : STAND.faceCam }); // side-on, a 3/4 head looking where it goes
    return staged(cat, { busy: true, segs: [{ d: 0.7, b: 0.45, f: (u) => rise(up, u) }, ...stretchSegs(0, th), ...homeSegs(10 * Math.cos(th), th)] });
  }
  const xb = demo ? cat.Wu * 0.6 : cat.x, dir = demo ? 1 : faceDir(cat.th);
  return { segs: stretchSegs(xb, dirTh(dir)) };
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
  if (cat.mode === 'mascot' && !cat.bust) return kneadAct(cat);
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
    p[k + 'y'] += 13 * sw; p[k + 'x'] += 4 * sw; p[k + 'a'] -= 1.3 * sw; p.splay = 1; p.claws = sw; p.shY += 2 * sw; p.mouth = 0.12 * sw;
    p.pawFront = sw > 0.15 ? 1 : 0; p.pawFar = k === 'ff' ? 1 : 0; aim(p, ctx.lx); p.lookY = 0.6;
    return p;
  } });
  segs.push({ d: 0.22, b: 0.15, f: () => { const p = at(LAND, ctx.lx, D); aim(p, ctx.lx); p.lookY = 0.6; return p; } });
  return { segs, chase: true, ctx };
};

/* ============================ acts in the mascot box (2026-10-27) ============================ */
// Acts that need more room than the sitting pose (stretch, roll, pounce, tail chase, the toys, the laser, the run,
// the loaf doze) are framed per act by Cat.fitAct (staged): one zoom (≤ 1, about the floor point) and one sideways
// shift for the whole act, from its own frames, so it stays inside the box. In them p.x is the act's own sideways
// offset (screen cat units, 0 where the cat sat), which the frame turns into p.mx. A box wider than tall (cat.stage)
// gets the side-on version with room to move, a square box the compact 3/4 version.
const actTh = (cat) => (cat.stage ? 0.3 : 0.95);
function staged(cat, B, fit) {
  if (fit) B.fit = fit; else B.fitMe = true;
  for (const s of B.segs) { const f = (s.f0 = s.f); s.f = (u, tl, T) => { const p = f(u, tl, T), F = B.fit; p.mx = F.mx + F.z * (p.x || 0); p.zoom = F.z; return p; }; }
  if (!fit) cat.fitAct(B);
  return B;
}
// where the head is (act units: across from where the cat sat, and up from the floor), without solving the rig
function headU(p) {
  const dy = p.shY - p.hipY, dx = Math.sqrt(Math.max(p.bodyL * p.bodyL - dy * dy, 16));
  const hx = p.shift + dx / 2 + Math.cos(p.neckA * D2R) * p.neckL + p.headDX, hy = p.shY + Math.sin(p.neckA * D2R) * p.neckL + p.headDY;
  return [(p.x || 0) + hx * Math.cos(p.theta), hy + p.gy + p.lift];
}
// head, eyes and ears on a point (act units)
function aimAt(p, tx, ty) {
  const [hx, hy] = headU(p), dx = tx - hx, dy = ty - hy;
  p.lookX = clamp(dx / 30, -1, 1); p.lookY = clamp(-dy / 26, -1, 1) * 0.8;
  p.headPitch += clamp(-dy / 50, -0.45, 0.5); p.lookTurn -= 0.15 * clamp(dx / 40, -1, 1);
  return p;
}
const SIT0 = () => at(PRESENT, 0, 0.8);
// up from sitting onto four paws (the hind paws step back under the body), and back down
function rise(to, u) { const p = mix(SIT0(), to, eIO(u)), h = hump(u, 0.2, 0.85); p.nhy += 3 * h; p.fhy += 2.5 * h; p.nha += 0.3 * h; return p; }
function sitDown(from, u) { const p = mix(from, SIT0(), eIO(u)), h = hump(u, 0.15, 0.8); p.nhy += 3 * h; p.fhy += 2.5 * h; return p; }
// back to where it sat: a few steps backwards when close, else a turn and a walk; then it sits facing the viewer
function homeSegs(x0, th0, gait = 'trot') {
  const segs = [];
  let th = th0;
  if (Math.abs(x0) > 3) {
    const dir = x0 > 0 ? -1 : 1, back = Math.abs(x0) < 30 && faceDir(th0) !== dir;
    const w = walkSegs(x0, th0, 0, back ? { back, speed: 0.8 } : { gait });
    segs.push(...w.segs); th = w.th;
  }
  const from = at(STAND, 0, th);
  segs.push({ d: 0.75, b: 0.25, f: (u) => sitDown(from, u) });
  return segs;
}
BEH._home = (cat, o) => staged(cat, { busy: true, segs: homeSegs(o.x0 || 0, o.th != null ? o.th : 0.8) }, o.fit || { z: 1, mx: 0, lo: 0, hi: 0 });
// a raised front paw: cocked up and back, then struck forward and down through the toy at u = hit, claws out
function batPaw(p, k, u, hit) {
  const up = u < hit ? sstep(u / hit) : 1 - sstep(((u - hit) / (1 - hit)) * 1.5), fw = u < hit ? -2.5 * sstep(u / hit) : lerp(6, 1.5, sstep((u - hit) / (1 - hit)));
  p[k + 'y'] += 5.5 * up; p[k + 'x'] += fw * 1.4; p[k + 'a'] -= 0.7 * up; p.claws = Math.max(p.claws, hump(u, hit - 0.3, hit + 0.25)); p.splay = 1;
  p.shift += 1.5 * hump(u, hit - 0.1, hit + 0.3);
  return p;
}
// a butt wiggle before a pounce (w 0..1)
function wiggle(p, T, w) {
  if (w <= 0) return p;
  const wg = Math.sin(T * 22) * w;
  p.hipY += 1.4 * wg + 1.5 * w; p.shift -= 0.7 * wg; p.nhy += Math.max(0, wg) * 1.3; p.fhy += Math.max(0, -wg) * 1.3; p.tailTip += 22 * Math.sin(T * 9) * w;
  return p;
}
// how far ahead of the root the landed front paws are (act units) for a heading th
const landReach = (th) => (LAND.nfx + 1.5) * Math.cos(th) - LAND.legZ * Math.sin(th);
const HUNTM = Object.assign({}, CROUCH, { faceCam: 0.2, tailSpd: 2.2 });
// on the side, and belly up with the paws curled in the air (the rig's bodyRoll)
const LIE = P({ hipY: 13, shY: 14, bodyL: 46, arch: 3, sag: 0, neckA: 4, neckL: 15, faceCam: 0.75, headRoll: -10, elbow: 1, legZ: 6, smile: 0.5,
  nfx: 16, nfy: 14, nfa: 1.7, ffx: 21, ffy: 16, ffa: 1.5, nhx: -17, nhy: 12, nha: 2.7, fhx: -12, fhy: 14, fha: 2.5,
  tailA: -175, tailCurl: 1, tailTip: 30, tailWave: 2, tailSpd: 1, tailRoot: 0.1 });
const BELLY = Object.assign({}, LIE, { bodyRoll: 1, arch: 4, neckA: 14, neckL: 14, faceCam: 0.85, headRoll: 38, headPitch: -0.15, smile: 0.85, blush: 1, pupil: 0.8, eyeOpen: 1.05, earRot: 0.2,
  nfx: 12, nfy: 31, nfa: 2.5, ffx: 18, ffy: 33, ffa: 2.3, nhx: -15, nhy: 29, nha: 2.9, fhx: -9, fhy: 31, fha: 3.0, tailWave: 5, tailSpd: 2 });

/* ---------- small sitting acts (calm too: blink) ---------- */
// a slow "cat kiss": two slow blinks with a soft smile
BEH.blink = (cat, o, demo) => {
  const x = demo ? cat.Wu * 0.7 : cat.x, th = sitTheta(cat, demo ? 0 : cat.th), base = sitBase(cat);
  return { look: true, sitting: true, segs: [{ d: 3.2, b: 0.4, f: (u) => {
    const p = at(base, x, th), b = Math.max(env(u, 0.1, 0.3, 0.42, 0.55), env(u, 0.6, 0.78, 0.86, 0.98));
    p.lid = Math.max(p.lid, 0.97 * b); p.lidLow = Math.max(p.lidLow, 0.3 * b); p.smile += 0.35 * env(u, 0.05, 0.25, 0.85, 1);
    p.headPitch += 0.12 * b; p.headDY -= 0.6 * b; p.earRot -= 0.15 * b;
    return p;
  } }] };
};
// a curious head tilt: ears forward, the head tips over, a little further, then back
BEH.tilt = (cat, o, demo) => {
  const x = demo ? cat.Wu * 0.7 : cat.x, th = sitTheta(cat, demo ? 0 : cat.th), base = sitBase(cat);
  return { look: true, sitting: true, segs: [{ d: 2.6, b: 0.4, f: (u) => {
    const p = at(base, x, th), e = env(u, 0, 0.15, 0.8, 1), e2 = env(u, 0.42, 0.52, 0.66, 0.76);
    p.headRoll += 16 * e + 8 * e2; p.earRot = lerp(p.earRot, 0.95, e); p.earL -= 0.3 * e2; p.pupil = lerp(p.pupil, 0.78, e); p.eyeOpen = lerp(p.eyeOpen, 1.08, e);
    p.lookY -= 0.3 * e; p.browUp += 0.5 * e; p.mouth = Math.max(p.mouth, 0.05 * e); p.whiskT += 0.5 * e2;
    return p;
  } }] };
};
// the loaf doze: a sphinx loaf, eyes shut, the chin sinking for a few seconds and starting back up, z glyphs
function dozeP(tl, th) {
  const p = at(LOAF, 0, th), m = tl % 8, nod = sstep(seg(m, 0.3, 5)) * (1 - sstep(seg(m, 5.2, 5.7)));
  p.lid = 1; p.headPitch += 0.12 + 0.32 * nod; p.headDY -= 2.4 * nod; p.neckA -= 8 * nod; p.headRoll -= 5 * nod; p.smile = 0.3; p.zzz = clamp(tl / 1.5);
  p.earRot = -0.25 + 0.35 * env(m, 5.2, 5.35, 5.6, 6.2); p.earR -= 0.6 * env(m, 2.6, 2.68, 2.8, 2.92); p.whiskT += Math.sin(tl * 21) * env(m, 6.8, 6.85, 7, 7.1);
  return p;
}
BEH.doze = (cat, o, demo) => {
  if (cat.mode !== 'mascot' || cat.bust) return BEH.sleep(cat, o, demo); // the crop dozes sitting up anyway
  const th = 0.5;
  return staged(cat, { busy: true, doze: true, loopFrom: 1, segs: [
    { d: 1.4, b: 0.5, f: (u) => { const p = mix(SIT0(), at(LOAF, 0, th), eIO(u)); p.lid = Math.max(p.lid, eIO(seg(u, 0.3, 1))); return p; } },
    { d: demo ? 8 : o.dur || 24, b: 0.3, f: (u, tl) => dozeP(tl, th) }
  ] });
};

/* ---------- body acts ---------- */
// stretch: the front stretch (play-bow, rear up, a yawn), then the back stretch (a hind leg reaching back)
function stretchSegs(xb, th) {
  const xf = xb + 10 * Math.cos(th);
  return [
    { d: 0.9, b: 0.45, f: (u) => { // walk the front paws forward one after the other, chest down
      const p = mix(at(STAND, xb, th), at(BOW, xb, th), eIO(u));
      const a1 = eIO(seg(u, 0, 0.5)), a2 = eIO(seg(u, 0.3, 0.85));
      p.nfx = lerp(STAND.nfx, BOW.nfx, a1); p.ffx = lerp(STAND.ffx, BOW.ffx, a2);
      p.nfy += hump(u, 0, 0.5) * 4; p.ffy += hump(u, 0.3, 0.85) * 4; return p;
    } },
    { d: 1.8, b: 0.1, f: (u, tl) => { // hold the bow, toes spread, a little tremble and a yawn
      const p = at(BOW, xb, th), q = Math.sin(tl * 31) * 0.25 * env(u, 0, 0.2, 0.8, 1), y = env(u, 0.25, 0.42, 0.62, 0.78);
      p.hipY += q + 1.2 * hump(u, 0.2, 0.8); p.shY += q * 0.5 - 1 * hump(u, 0.2, 0.8);
      p.mouth = 0.1 + 0.6 * y; p.jawTall = y; p.fang = y; p.tongue = 0.5 * y; p.squeeze = y > 0.3 ? 1 : 0; p.earRot -= 0.4 * y;
      p.tailQuiver = 0.5; p.splay = 1; return p;
    } },
    { d: 0.8, b: 0.1, f: (u) => { const e = eIO(u), p = mix(at(BOW, xb, th), at(BACK, xf, th), e); p.x = lerp(xb, xf, e); p.lid = lerp(1, 0.7, e); return p; } },
    { d: 1.4, b: 0.1, f: (u, tl) => { // back-leg stretch
      const p = at(BACK, xf, th), q = Math.sin(tl * 29) * 0.3 * env(u, 0, 0.2, 0.8, 1); p.nhy += q; p.nhx -= q; p.splay = 1;
      p.tailCurl += 1.5 * Math.sin(tl * 1.6); return p;
    } },
    { d: 0.75, b: 0.1, f: (u) => { const p = mix(at(BACK, xf, th), at(STAND, xf, th), eIO(u)); p.nhy += hump(u, 0, 0.7) * 4; return p; } }
  ];
}
// roll on the back: down on the side, over onto the back with the paws curled in the air, a wriggle with bats at the
// air, back onto the side and up to sitting
BEH.roll = (cat, o, demo) => {
  if (cat.mode !== 'mascot') return BEH.sit(cat, o, demo);
  if (cat.bust) return BEH.pet(cat, o, demo);
  const th = cat.stage ? 0.22 : 0.6, Lp = at(LIE, 0, th), Bp = at(BELLY, 0, th);
  return staged(cat, { busy: true, segs: [
    { d: 1.0, b: 0.45, f: (u) => mix(SIT0(), Lp, eIO(u)) },
    { d: 0.8, b: 0.15, f: (u) => { const p = mix(Lp, Bp, eIO(u)); p.lid = 0.6 * hump(u, 0.2, 0.8); return p; } },
    { d: 2.8, b: 0.15, f: (u, tl, T) => {
      const p = at(BELLY, 0, th), e = env(u, 0, 0.12, 0.88, 1), w = Math.sin(tl * 3.4), b = Math.sin(tl * 8);
      p.bodyRoll = 1 - 0.1 * (1 - w) * e; p.rollTwist = 0.14 * w * e; p.headRoll += 7 * w * e;
      p.nfy += 4 * Math.max(0, b) * e; p.nfa -= 0.5 * Math.max(0, b) * e; p.ffy += 4 * Math.max(0, -b) * e; p.ffa -= 0.5 * Math.max(0, -b) * e; // bats at the air
      p.nhx += 2.5 * Math.sin(tl * 5) * e; p.fhx -= 2.5 * Math.sin(tl * 5) * e; p.lookX = 0.3 * w;
      p.happyEyes = env(u, 0.55, 0.6, 0.75, 0.8) > 0.5 ? 1 : 0; p.lid = Math.max(p.lid, p.happyEyes); p.mouth = 0.12 * env(u, 0.2, 0.3, 0.45, 0.55);
      return p;
    } },
    { d: 0.8, b: 0.15, f: (u) => mix(Bp, Lp, eIO(u)) },
    { d: 1.0, b: 0.2, f: (u) => mix(Lp, SIT0(), eIO(u)) }
  ] });
};
/* ---------- the leap (pounce, the toys, the laser) ---------- */
// One spring from the crouch, tl seconds from its start: the load (LOADP) and the push into the stretched-out launch
// (POUNCE, eased out: fast), then the flight on a skewed arc (fast up, the top at 0.4 of it) through the tuck (TUCKP) to
// the front paws reaching for the floor (REACHP), and the landing (LAND), squashed for a moment with the tail
// overshooting. The root travels from xa to xb (act units) while airborne; H is the height of the arc; from is the pose
// it springs from (the crouch).
const LEAP = { load: 0.16, off: 0.24, land: 0.72, end: 0.94 };
const LEAPK = [[LEAP.load, LOADP], [0.3, POUNCE], [0.45, TUCKP], [0.62, REACHP], [LEAP.land, LAND]];
// how far along xa → xb the root is (0..1) tl seconds into the leap
function leapProg(tl) { const f = clamp((tl - 0.2) / (LEAP.land - 0.2)); return 0.75 * f + 0.25 * sstep(f); }
// the height of the arc (top H) tl seconds into the leap: off the floor from LEAP.off to LEAP.land, the top at 0.4 of it
function leapLift(tl, H) { const f = (tl - LEAP.off) / (LEAP.land - LEAP.off); return f > 0 && f < 1 ? H * Math.sin(PI * (f < 0.4 ? (0.5 * f) / 0.4 : 0.5 + (0.5 * (f - 0.4)) / 0.6)) : 0; }
function leapPose(tl, th, xa, xb, H, from) {
  let p;
  if (tl < LEAP.land) {
    let i = 0;
    while (i < LEAPK.length - 1 && tl > LEAPK[i][0]) i++;
    const t0 = i ? LEAPK[i - 1][0] : 0, A = i ? at(LEAPK[i - 1][1], 0, th) : from;
    p = mix(A, at(LEAPK[i][1], 0, th), (i === 1 ? eOut : eIO)((tl - t0) / (LEAPK[i][0] - t0)));
    p.nfC = p.ffC = 0.8 * hump(tl, 0.5, 0.8); // claws out for the landing
  } else {
    const z = tl - LEAP.land, sq = env(z, 0, 0.03, 0.1, 0.2);
    p = at(LAND, 0, th);
    p.shY -= 4 * sq; p.hipY -= 2.5 * sq; p.headDY -= 1.8 * sq; p.squish = Math.max(p.squish, 0.5 * sq); p.splay = 1;
    p.tailTip += 34 * Math.sin(z * 16) * Math.exp(-z * 7); p.tailCurl += 2 * sq; p.nfC = p.ffC = 0.6 * (1 - sstep(z / 0.3));
  }
  p.x = lerp(xa, xb, leapProg(tl)); p.theta = th; p.lift = leapLift(tl, H);
  return p;
}
// a quick lick of a front paw while sitting (base: a sitting pose at its x and heading), as after a miss: the paw up to
// the mouth, n licks, back down
function lickSegs(base, n) {
  const k = nearFront(base.theta), far = k === 'ff' ? 1 : 0, S = solve(base, 0).S;
  const lick = (u, m) => {
    const p = Object.assign({}, base), lk = hump(fract(u * m), 0.1, 0.75);
    setWrist(p, k, S[0] + 7.7, S[1] + 0.5, 1.3); p.pawFront = 1; p.pawFar = far; p.beans = 1;
    p.headPitch = 0.45 + 0.25 * lk; p.headDY = -3 - 2.2 * lk; p.headDX = 1.2 * lk; p.neckA = base.neckA - 6;
    p.tongue = 0.25 + 0.75 * lk; p.mouth = 0; p.lid = 0.96; p.faceCam = base.faceCam - 0.12; p.earRot = 0.1; p.smile = 0.2;
    return p;
  };
  const ends = (u, up) => { const q = lick(up ? 0 : 1, 1); q.tongue = 0; const p = up ? mix(base, q, eIO(u)) : mix(q, base, eIO(u)); p.pawFront = (up ? u > 0.3 : u < 0.7) ? 1 : 0; p.pawFar = far; return p; };
  return [{ d: 0.45, b: 0.3, f: (u) => ends(u, true) }, { d: 0.5 * n, b: 0.1, f: (u) => lick(u, n) }, { d: 0.45, b: 0.1, f: (u) => ends(u, false) }];
}
// Tail play (the rig draws no back of the head, so the cat does not spin): sitting side-on with its tail wrapped round
// in front of its paws, it spots the tip twitching there, stares, bats it (the tip whips away and lashes), rears up
// a little and pins it to the floor with both front paws, holds it while it quivers, lets go (the tip slips out with
// a flick), and looks away as if nothing happened.
const TAILP = { tailA: -90, tailCurl: 9, tailTip: 20, tailLen: 1.25, tailWave: 1, tailRoot: 0.05, tailSpd: 0.6, tailFront: 1.5 };
const TAILPIN = { tailA: -105, tailCurl: 8, tailTip: -25, tailLen: 1.3, tailFront: 1 };
BEH['chase-tail'] = (cat, o, demo) => {
  if (cat.mode !== 'mascot') return BEH.sit(cat, o, demo);
  if (cat.bust) return BEH.look(cat, o, demo);
  const th = cat.stage ? 0.35 : 0.7, k = nearFront(th), kf = k === 'nf' ? 'ff' : 'nf', sn = Math.sin(th), c = Math.cos(th);
  const SITS = Object.assign({}, SIT, { legZ: 5, faceCam: cat.stage ? 0.4 : 0.6 });
  const base = at(Object.assign({}, SITS, TAILP, { earRot: 0.9, pupil: 0.92, eyeOpen: 1.1, smile: 0.1 }), 0, th);
  const tipOf = (q) => { const t = solve(q, 0).tail[12]; return [(q.x || 0) + t[0], -t[1]]; };
  // a front paw's x (body frame) over a point on the floor (act units)
  const pawX = (p, kk, ax) => (ax + (kk === 'nf' ? 1 : -1) * p.legZ * sn) / c;
  const tip0 = tipOf(base), twitch = (p, T, a) => { p.tailTip += 16 * a * Math.sin(T * 8.5); p.tailCurl += 1.2 * a * Math.sin(T * 8.5 + 1.2); return p; };
  // pinned: leant forward over it, both paws on the tip (now flat on the floor ahead), head down to it
  const pin = Object.assign({}, base, TAILPIN, { shY: 33, shift: 0, arch: 3, neckA: 46, headPitch: 0.4, earRot: 0.7, splay: 1 });
  const tipP = tipOf(pin);
  pin[k + 'x'] = pawX(pin, k, tipP[0] - 1); pin[kf + 'x'] = pawX(pin, kf, tipP[0] - 6); pin[k + 'y'] = pin[kf + 'y'] = 0;
  const reared = Object.assign({}, pin, { shY: 39, shift: 0, nfy: 9, ffy: 8, nfa: -0.8, ffa: -0.8, splay: 0.4, tailFront: 1.5, tailTip: base.tailTip, tailA: base.tailA, tailCurl: base.tailCurl, tailLen: base.tailLen });
  const tb0 = pawX(base, k, tip0[0]);
  const segs = [
    { d: 0.7, b: 0.45, f: (u, tl, T) => twitch(aimAt(mix(SIT0(), base, eIO(u)), tip0[0], tip0[1]), T, u) },
    { d: 1.1, b: 0.1, f: (u, tl, T) => { // a stare, the shoulders lowering, a little shuffle of the hind feet
      const p = twitch(at(base, 0, th), T, 1), e = sstep(u * 2);
      p.shY -= 3 * e; p.neckA -= 8 * e; p.pupil = 1; p.shift -= 0.6 * Math.sin(T * 17) * env(u, 0.4, 0.6, 0.9, 1); p.earL -= 0.3 * env(u, 0.3, 0.35, 0.42, 0.5);
      return aimAt(p, tip0[0], tip0[1] + 1.5 * Math.sin(T * 8.5));
    } },
    { d: 0.6, b: 0.1, f: (u) => { // the bat: the near paw cocks up and strikes at the tip, which whips away
      const p = at(base, 0, th), cock = sstep(u / 0.4) * (1 - sstep((u - 0.4) / 0.12)), hit = sstep((u - 0.4) / 0.12) * (1 - sstep((u - 0.75) / 0.25));
      p.shY -= 3; p.neckA -= 8; p.pupil = 1;
      p[k + 'y'] += 9 * cock + 4 * hit; p[k + 'a'] -= 0.9 * cock; p[k + 'x'] = lerp(p[k + 'x'], tb0, Math.max(hit, 0.5 * cock)); p[k + 'C'] = hit; p.splay = hit; p.shift += 1.5 * hit;
      p.tailTip -= 46 * hump(u, 0.45, 1); p.tailCurl -= 2 * hump(u, 0.45, 1);
      return aimAt(p, tip0[0], tip0[1]);
    } },
    { d: 0.5, b: 0.1, f: (u, tl) => { // the tip lashes; the head goes after it
      const p = at(base, 0, th), e = 1 - sstep(u); p.shY -= 3; p.neckA -= 8; p.tailTip += -30 * e + 14 * Math.sin(tl * 14) * e; p.tailFlick = e;
      return aimAt(p, tip0[0] - 8 * e, tip0[1] + 10 * e);
    } },
    { d: 0.35, b: 0.12, f: (u) => aimAt(mix(at(base, 0, th), reared, eIO(u)), tipP[0], tipP[1]) }, // rears up a little, paws cocked
    { d: 0.25, b: 0.05, f: (u) => { const p = mix(reared, pin, eIn(u)); p.tailFront = u < 0.5 ? 1.5 : 1; return aimAt(p, tipP[0], tipP[1]); } }, // and down on it
    { d: 1.1, b: 0.05, f: (u, tl) => { // got it: holding it down while it quivers, eyes on it
      const p = aimAt(Object.assign({}, pin), tipP[0], tipP[1]), sq = env(u, 0, 0.06, 0.12, 0.25);
      p.shY -= 2 * sq; p.squish = 0.3 * sq; p[k + 'C'] = p[kf + 'C'] = 0.8; p.tailQuiver = 1; p.tailTip += 6 * Math.sin(tl * 21);
      p.earL -= 0.3 * env(u, 0.5, 0.55, 0.62, 0.7); p.mouth = 0.08 * env(u, 0.3, 0.4, 0.7, 0.8); return p;
    } },
    { d: 0.55, b: 0.1, f: (u) => { const p = mix(pin, at(base, 0, th), eIO(u)); p.tailFront = 1; p.tailFlick = hump(u, 0.2, 1); return p; } }, // lets go: the tip slips out with a flick
    { d: 1.5, b: 0.2, f: (u) => { // as if nothing happened: a look away, a slow blink, an ear flick
      const p = at(SITS, 0, th), e = env(u, 0, 0.2, 0.85, 1);
      p.lookX -= 0.8 * e; p.lookTurn -= 0.35 * e; p.headPitch -= 0.12 * e; p.lid = Math.max(p.lid, 0.9 * env(u, 0.35, 0.45, 0.55, 0.68)); p.smile = 0.5;
      p.earR -= 0.7 * env(u, 0.75, 0.79, 0.85, 0.9);
      return p;
    } },
    { d: 0.7, b: 0.25, f: (u) => mix(at(SITS, 0, th), SIT0(), eIO(u)) }
  ];
  return staged(cat, { busy: true, segs });
};
// pounce: down into the crouch, a stalk with a butt wiggle that stills, the leap (leapPose), the pin, a peek under the
// paw (nothing there), a shake of the head, back home and a quick lick of a paw (it meant to miss)
BEH.pounce = (cat, o, demo) => {
  if (cat.mode !== 'mascot') return BEH.chase(cat, o, demo);
  if (cat.bust) return BEH.look(cat, o, demo);
  const th = actTh(cat), d = cat.stage ? 38 : 14, H = cat.stage ? 16 : 10, tx = d + landReach(th), HU = at(HUNTM, 0, th), k = nearFront(th);
  return staged(cat, { busy: true, segs: [
    { d: 0.6, b: 0.45, f: (u) => aimAt(rise(HU, u), tx, 0) },
    { d: 1.5, b: 0.1, f: (u, tl, T) => { const p = aimAt(wiggle(at(HUNTM, 0, th), T, env(u, 0.3, 0.5, 0.8, 0.95)), tx, 0); p.tailQuiver = 0.6 * env(u, 0.05, 0.2, 0.9, 1); return p; } },
    { d: LEAP.end, b: 0.06, f: (u, tl) => aimAt(leapPose(tl, th, 0, d, H, HU), tx, 0) },
    { d: 0.45, b: 0.1, f: (u) => { const p = aimAt(at(LAND, d, th), tx, 0); p.splay = 1; p.nfC = p.ffC = 0.5 * (1 - u); p.tailTip += 16 * Math.sin(u * 9); return p; } },
    { d: 0.8, b: 0.15, f: (u) => { // a peek under the paw: nothing there
      const p = aimAt(at(LAND, d, th), tx, 0), e = env(u, 0, 0.25, 0.7, 1); p[k + 'y'] += 5 * e; p[k + 'a'] -= 0.7 * e; p.pawFront = e > 0.2 ? 1 : 0; p.pawFar = k === 'ff' ? 1 : 0; p.beans = e;
      p.headPitch += 0.2 * e; p.earL -= 0.35 * env(u, 0.6, 0.7, 0.85, 1); p.browUp += 0.6 * e; p.tailWave = 2; return p;
    } },
    { d: 0.45, b: 0.1, f: (u, tl) => { const p = at(LAND, d, th), e = hump(u, 0, 1), s = Math.sin(tl * 30) * e; p.headRoll += 14 * s; p.earL += 0.4 * s; p.earR -= 0.4 * s; p.lid = 0.5 * e; return p; } }, // a shake
    ...homeSegs(d, th),
    ...lickSegs(SIT0(), 2)
  ] });
};

/* ---------- toys: a toy mouse and a yarn ball (play('mouse'), play('yarn')) ---------- */
// A toy on the floor (act units): moved only by kicks [t, v] (a skitter, a bat) and slowed by linear drag k (1/s), so
// its position is closed form, x(t) = x0 + Σ v/k (1 − e^(−k(t − t_i))) over the kicks already given, and any frame
// can be sampled (renderAt).
function toyX(x0, kicks, k, t) { let x = x0; for (const [ti, v] of kicks) if (t > ti) x += (v / k) * (1 - Math.exp(-k * (t - ti))); return x; }
function toyV(kicks, k, t) { let v = 0; for (const [ti, vi] of kicks) if (t > ti) v += vi * Math.exp(-k * (t - ti)); return v; }
const TOY_K = 3.2;
// toys are drawn at 1.5x the cat's scale, and bigger in a small box (about 14 px at least)
const toyScale = (cat) => clamp(15 / (11 * cat.s * (cat.stage ? 1 : 0.75)), 1.5, 2.6);
// the mouth of a pose (act units: across, up), for a toy carried in it
function mouthU(p) {
  const R = solve(p, 0), o = R.o, fy = p.headPitch * 3.2, r = p.headRoll * D2R, hs = HS * p.headScale;
  const mg = mouthGeo(p, o, fy), lx = mg.nx, ly = mg.my + 2 + jawDrop(p) * 0.6;
  return [(p.x || 0) + R.head[0] + (lx * Math.cos(r) - ly * Math.sin(r)) * hs, -(R.head[1] + (lx * Math.sin(r) + ly * Math.cos(r)) * hs)];
}
// segments laid end to end: add(...segs) appends them and returns the first one's start time (t: the end so far)
function clock() { const C = { segs: [], t: 0, add(...ss) { const t0 = C.t; for (const s of ss) { C.segs.push(s); C.t += s.d; } return t0; } }; return C; }
// a hop of height h, d seconds long from ti (0 outside it)
const hopY = (tb, ti, d, h) => { const f = (tb - ti) / d; return f > 0 && f < 1 ? 4 * h * f * (1 - f) : 0; };
// The toy mouse: the cat spots it skittering about, creeps up low, wiggles and springs onto it, bats it away (it hops
// and flips over), springs after it, picks it up in its mouth, trots home with it held high and sets it down at its
// paws, a gift, then a last pat sends it sliding off out of the box.
function mousePlay(cat) {
  const k = cat.stage ? 1 : 0.7, th = actTh(cat), reach = landReach(th), K = nearFront(th), sc = toyScale(cat), hl = 7.5 * sc, H = cat.stage ? 14 : 9;
  const X0 = 50 * k + hl, kicks = [[0.25, 34 * k], [1.0, -14 * k]], tx = (t) => toyX(X0, kicks, TOY_K, t), ty = 3 * sc;
  const C = clock(), HU = (x) => at(HUNTM, x, th), aim = (p, t) => aimAt(p, tx(t), ty);
  C.add({ d: 0.6, b: 0.45, f: (u, tl) => aim(rise(HU(0), u), tl) });
  const tc = C.t, xc = Math.max(0, tx(2.4) - reach - hl - 22 * k); // creeps up low to striking distance
  C.add(...walkSegs(0, th, xc, { base: HUNTM, speed: 0.42, noSettle: true, th, mod: (p, u, tl) => aim(p, tc + tl) }).segs);
  const tW = C.add({ d: 0.9, b: 0.25, f: (u, tl, T) => { const p = aim(wiggle(HU(xc), T, env(u, 0.1, 0.3, 0.75, 0.92)), tW + tl); p.tailQuiver = 0.5; return p; } });
  const tL = C.t, x1 = tx(tL + LEAP.land) - reach - hl * 0.4;
  C.add({ d: LEAP.end, b: 0.06, f: (u, tl) => aim(leapPose(tl, th, xc, x1, H, HU(xc)), tL + tl) });
  C.add({ d: 0.45, b: 0.1, f: (u, tl) => { const p = aim(at(LAND, x1, th), tL + LEAP.end + tl); p.nfC = p.ffC = 0.5 * (1 - u); p.tailTip += 22 * Math.sin(u * 10); return p; } });
  const tB = C.add({ d: 0.5, b: 0.1, f: (u, tl) => aim(batPaw(mix(at(LAND, x1, th), HU(x1), 0.4), K, u, 0.5), tB + tl) });
  kicks.push([tB + 0.25, 75 * k]);
  const tG = C.add({ d: 0.3, b: 0.1, f: (u, tl) => aim(HU(x1), tG + tl) });
  const tL2 = C.t, x2 = tx(tL2 + LEAP.land) - reach - hl * 0.4;
  C.add({ d: LEAP.end, b: 0.06, f: (u, tl) => aim(leapPose(tl, th, x1, x2, H * 0.6, HU(x1)), tL2 + tl) });
  // picks it up
  const tP = C.add({ d: 0.7, b: 0.1, f: (u) => {
    const p = at(LAND, x2, th), e = env(u, 0, 0.35, 0.6, 1); p.neckA -= 26 * e; p.headPitch += 0.55 * e; p.headDY -= 3 * e;
    p.mouth = 0.35 * env(u, 0.1, 0.25, 0.45, 0.55) + 0.12 * seg(u, 0.5, 0.7); p.lid = 0.3 * e; return p;
  } });
  const tCarry = tP + 0.5;
  // home with it held high, proud
  const home = homeSegs(x2, th);
  for (const s of home) { const f = s.f; s.f = (u, tl, T) => { const p = f(u, tl, T); p.headPitch -= 0.18; p.mouth = Math.max(p.mouth, 0.12); p.smile = 0.7; p.lidLow = Math.max(p.lidLow, 0.35); p.tailA = lerp(p.tailA, 85, 0.5); p.tailTip -= 20; return p; }; }
  C.add(...home);
  // sets it down at its paws, a gift, and sits up proud
  const tD = C.add({ d: 1.4, b: 0.2, f: (u) => {
    const p = SIT0(), dn = hump(u, 0, 0.4), pr = sstep(seg(u, 0.4, 0.7)); p.neckA -= 12 * dn; p.headPitch += 0.45 * dn - 0.25 * pr; p.mouth = u < 0.18 ? 0.12 : 0;
    p.lid = Math.max(p.lid, 0.42 * pr); p.smile = lerp(0.5, 1, pr); p.blush = 1; p.earRot = 0.6; p.lookY = 0.5 * dn; return p;
  } });
  const tDrop = tD + 0.2;
  // a last pat sends it off
  const tF = C.add({ d: 0.8, b: 0.15, f: (u) => { const p = batPaw(SIT0(), nearFront(0.8), u, 0.45); p.lookX = 0.6 * sstep(seg(u, 0.4, 0.8)); p.lookY = 0.4 * (1 - u); return p; } });
  const kick2 = [[tF + 0.36, 800 * k]];
  let drop = null;
  const B = { busy: true, segs: C.segs };
  B.toy = (tb) => {
    let x, y, v = 0, rot = 0, carry = false, dir = 1;
    if (tb < tCarry) {
      const hp = (tb - tB - 0.25) / 0.42;
      x = tx(tb); v = toyV(kicks, TOY_K, tb); y = hopY(tb, tB + 0.25, 0.42, 5 * sc); rot = (hp > 0 && hp < 1 ? -TAU * sstep(hp) : 0) - v * 0.004; dir = v < -2 ? -1 : 1;
    } else if (tb < tDrop || !drop) {
      const p = sampleSegs(B, Math.min(tb, tDrop), Math.min(tb, tDrop)), m = mouthU(p), fd = Math.cos(p.theta) >= 0 ? 1 : -1;
      x = m[0] + 1.5 * fd; y = m[1] - 6.4 * sc; carry = true; rot = 0.35 * fd; dir = fd;
      if (tb >= tDrop) drop = [x, y];
    }
    if (tb >= tDrop && drop) { const f = clamp((tb - tDrop) / 0.18); x = drop[0] + toyX(0, kick2, TOY_K, tb); v = toyV(kick2, TOY_K, tb); y = Math.max(0, drop[1]) * (1 - f * f); carry = false; }
    const under = (tb > tL + LEAP.land - 0.1 && tb < tB + 0.3) || (tb > tL2 + LEAP.land - 0.1 && tb < tP + 0.3);
    return { kind: 'mouse', x, y, v, a: clamp(tb / 0.3), rot, sc, dir, tw: tb * 28, carry, under, r: hl, h: 8 * sc, fit: tb < tF + 0.4 };
  };
  return staged(cat, B);
}
// The yarn ball: the cat spots it, creeps up, hooks it toward itself with a paw and flips it into the air, springs on it
// as it rolls away, dribbles it with both paws, gives it a last bat that sends it rolling off out of the box (its
// thread trailing after it), then sits down where it is, licks a paw, flicks its tail and strolls home.
function yarnPlay(cat) {
  const k = cat.stage ? 1 : 0.7, th = actTh(cat), reach = landReach(th), K = nearFront(th), sc = toyScale(cat), r = YARN_R * sc, H = cat.stage ? 12 : 8;
  const X0 = 72 * k + r, kicks = [], tx = (t) => toyX(X0, kicks, TOY_K, t), ty = r;
  const C = clock(), HU = (x) => at(HUNTM, x, th), aim = (p, t) => aimAt(p, tx(t), ty);
  C.add({ d: 0.6, b: 0.45, f: (u, tl) => aim(rise(HU(0), u), tl) });
  const tc = C.t, xc = Math.max(0, X0 - reach - r - 12 * k); // it keeps the ball in front of its paws (and of its head)
  C.add(...walkSegs(0, th, xc, { base: HUNTM, speed: 0.42, noSettle: true, th, mod: (p, u, tl) => aim(p, tc + tl) }).segs);
  // the hook: the near paw reaches over the ball and pulls it back toward the cat
  const tH = C.add({ d: 0.7, b: 0.2, f: (u, tl) => {
    const p = HU(xc), e = env(u, 0, 0.35, 0.6, 0.95), over = hump(u, 0, 0.45);
    p[K + 'x'] += 13 * e - 6 * sstep(seg(u, 0.4, 0.6)); p[K + 'y'] += 7 * over + 1.5 * e; p[K + 'a'] -= 0.6 * over; p[K + 'C'] = e; p.shift += 2 * e; return aim(p, tH + tl);
  } });
  kicks.push([tH + 0.42, -12 * k]);
  // the flip: the paw scoops under it and tosses it up and away
  const tF = C.add({ d: 0.55, b: 0.1, f: (u, tl) => aim(batPaw(HU(xc), K, u, 0.45), tF + tl) });
  kicks.push([tF + 0.25, 66 * k]);
  const tG = C.add({ d: 0.25, b: 0.1, f: (u, tl, T) => aim(wiggle(HU(xc), T, 0.6 * hump(u, 0, 1)), tG + tl) });
  const tL = C.t, x1 = tx(tL + LEAP.land) - reach - r - 8 * k; // lands just short of it, the ball still in view
  C.add({ d: LEAP.end, b: 0.06, f: (u, tl) => aim(leapPose(tl, th, xc, x1, H, HU(xc)), tL + tl) });
  // a dribble: the paws pat it in turn
  const tD = C.add({ d: 0.9, b: 0.1, f: (u, tl) => {
    const p = mix(at(LAND, x1, th), HU(x1), 0.5), kk = fract(u * 3) < 0.5 ? 'nf' : 'ff', h = hump(fract(u * 6), 0, 1);
    p[kk + 'y'] += 5 * h; p[kk + 'x'] += 9 * h; p.neckA += 12; p.headPitch += 0.2; return aim(p, tD + tl);
  } });
  kicks.push([tD + 0.15, 10 * k], [tD + 0.45, -12 * k], [tD + 0.75, 8 * k]);
  // a last bat sends it rolling off
  const tB = C.add({ d: 0.55, b: 0.1, f: (u, tl) => aim(batPaw(mix(at(LAND, x1, th), HU(x1), 0.4), K, u, 0.45), tB + tl) });
  kicks.push([tB + 0.25, 900 * k]);
  // sits where it is, watching it go, licks a paw, flicks its tail, and strolls home
  const sitP = at(Object.assign({}, SIT, { legZ: 5.5, faceCam: 0.55 }), x1, 0.45);
  C.add({ d: 0.8, b: 0.2, f: (u) => { const p = mix(at(LAND, x1, th), sitP, eIO(u)); p.lookX = 0.8 * (1 - u); return p; } });
  C.add(...lickSegs(sitP, 3));
  C.add({ d: 1.1, b: 0.2, f: (u) => {
    const p = Object.assign({}, sitP), f1 = env(u, 0.1, 0.18, 0.3, 0.45); p.tailTip += 50 * f1; p.tailCurl += 3 * f1; p.tailFlick = env(u, 0.45, 0.52, 0.6, 0.8);
    p.earR -= 0.6 * env(u, 0.5, 0.55, 0.62, 0.7); p.lid = Math.max(p.lid, 0.85 * env(u, 0.7, 0.78, 0.84, 0.95)); p.smile = 0.6; return p;
  } });
  C.add({ d: 0.6, b: 0.2, f: (u) => mix(sitP, at(STAND, x1, th), eIO(u)) });
  C.add(...homeSegs(x1, th, 'walk'));
  const toy = (tb) => {
    const x = tx(tb), v = toyV(kicks, TOY_K, tb), y = hopY(tb, tF + 0.25, 0.5, 8 * sc);
    return { kind: 'yarn', x, y, v, a: clamp(tb / 0.3), rot: (x - X0) / r + 4 * sstep(clamp((tb - tF - 0.25) / 0.5)), sc, dir: v < -1 ? -1 : 1, ph: x * 0.3, r, h: 2 * r, len: 22 * sc, fit: tb < tB + 0.3 };
  };
  return staged(cat, { busy: true, toy, segs: C.segs });
}
BEH.mouse = (cat, o, demo) => (cat.mode !== 'mascot' ? BEH.chase(cat, o, demo) : cat.bust ? BEH.look(cat, o, demo) : mousePlay(cat));
BEH.yarn = (cat, o, demo) => (cat.mode !== 'mascot' ? BEH.chase(cat, o, demo) : cat.bust ? BEH.look(cat, o, demo) : yarnPlay(cat));

/* ---------- kneading in the mascot box ---------- */
// Leant forward over a little blanket (it fades in as the cat settles onto it), the front paws take turns to lift and
// press, toes spread and claws out at each press, the shoulder dipping with it; eyes half shut, purring.
function kneadAct(cat) {
  const th = 0.8, Kp = at(KNEADM, 0, th), R = solve(Kp, 0), PER = 0.45, n = 10, D = PER * n;
  const xn = R.legs.find((L) => L.k === 'nf').P[0], xf = R.legs.find((L) => L.k === 'ff').P[0];
  const pump = (tl) => { const c = tl / PER, i = Math.floor(c), f = c - i, e = env(tl, 0, 0.2, D - 0.2, D); return { kk: i % 2 ? 'nf' : 'ff', h: hump(f, 0, 0.55) * e, pr: env(f, 0.45, 0.6, 0.85, 1) * e, c }; };
  const pose = (tl) => {
    const p = Object.assign({}, Kp), { kk, h, pr, c } = pump(tl), sd = kk === 'nf' ? 1 : -1;
    p[kk + 'y'] += 8.5 * h; p[kk + 'a'] -= 0.6 * h; p[kk + 'x'] += 1.5 * h; p[kk + 'C'] = pr; p.splay = pr;
    p.shY -= 1.4 * pr; p.shift += 0.6 * sd * pr; p.headDY += 0.5 * Math.sin(c * PI); p.headRoll += 2.5 * sd * pr;
    return p;
  };
  const segs = [{ d: 0.7, b: 0.45, f: (u) => mix(SIT0(), Kp, eIO(u)) }, { d: D, b: 0.1, f: (u, tl) => pose(tl) }, { d: 0.7, b: 0.15, f: (u) => mix(Kp, SIT0(), eIO(u)) }];
  const toy = (tb) => {
    const q = tb > 0.7 && tb < 0.7 + D ? pump(tb - 0.7) : null;
    return { kind: 'blanket', x: (xn + xf) / 2 - 2, y: 0, h: 9, dn: 6.5, a: sstep(tb / 0.5) * (1 - sstep((tb - D - 0.9) / 0.5)), xn, xf, pn: q && q.kk === 'nf' ? q.pr : 0, pf: q && q.kk === 'ff' ? q.pr : 0, under: true, r: 19 };
  };
  return staged(cat, { busy: true, toy, segs });
}

/* ---------- run across: a gallop in place while the host moves the box (Cat.run) ---------- */
const RUNB = P({ sag: 3, arch: 2, neckA: 32, neckL: 16, headPitch: 0.1, faceCam: 0.3, earRot: 0.35, pupil: 0.8, eyeOpen: 1.05, smile: 0.5,
  tailA: 20, tailCurl: 2.5, tailTip: 18, tailWave: 5.5, tailSpd: 0.15, tailRoot: 0.8 });
// how far the host has moved the box (0..1) t seconds after run() (at: B.runAt): the gallop's own speed ramp
function runProgress(t, at) { return t <= at.start ? 0 : t >= at.stop ? 1 : trapez((t - at.start) / (at.stop - at.start), at.r); }
BEH.run = (cat, o, demo) => {
  if (cat.mode !== 'mascot') return BEH.trot(cat, o, demo);
  const sd = o.dir === 'left' || o.dir < 0 ? -1 : 1, cd = sd * (cat.facing === 'left' ? -1 : 1), G = GAITS.gallop, cyc = G.S / G.duty, v = cyc / G.T;
  const px = Math.max(0, +o.distancePx || 0);
  if (cat.bust) { // the head crop bobs along (its legs are out of the frame)
    const dur = px > 0 ? Math.max(0.6, px / (v * cat.s)) : 1.6;
    return { busy: true, runAt: { start: 0.25, stop: 0.25 + dur, end: 0.75 + dur, r: Math.min(0.5, 0.35 / dur) }, segs: [{ d: 0.75 + dur, b: 0.3, f: (u, tl) => {
      const p = at(PRESENT, 0, 0.8), e = env(tl, 0, 0.25, 0.25 + dur, 0.75 + dur); p.headDY += 1.6 * Math.abs(Math.sin(tl * 9)) * e; p.lookX = cd * 0.8 * e; p.earRot = lerp(p.earRot, 0.1, e); p.lookTurn -= 0.25 * cd * e; return p;
    } }] };
  }
  const th = cd > 0 ? 0.12 : PI - 0.12, R0 = at(RUNB, 0, th);
  const build = (D) => {
    const rp = 0.35, dur = D / v + rp, r = rp / dur, plans = plansFor(G, D / cyc);
    const segs = [
      { d: 0.4, b: 0.35, f: (u) => rise(R0, u) },
      { d: dur, b: 0.1, f: (u) => { const p = gaitPose(RUNB, (D * trapez(u, r)) / cyc, ampAt(u, r), G, plans); p.x = 0; p.theta = th; return p; } },
      settleSeg(RUNB, 0, th, plans, 0.6),
      { d: 0.7, b: 0.2, f: (u) => sitDown(R0, u) }
    ];
    return { busy: true, segs, runAt: { start: 0.4, stop: 0.4 + dur, end: segs.reduce((a, s) => a + s.d, 0), r } };
  };
  const probe = staged(cat, build(cyc * 2)); // the gait's frame is the same at any length
  return staged(cat, build(px > 0 ? px / (cat.s * probe.fit.z) : cyc * 4), probe.fit);
};

/* ---------- the laser dot (Cat.laser) ---------- */
// Live play with a target the page feeds, in act units (x across the box from where the cat sat, y up from the
// floor). Sitting, the cat follows the dot with head and eyes; a dot on the floor near by makes it crouch and turn to
// it; a dot that rests there gets a butt wiggle and a pounce (never under calm); a lost dot, a puzzled look round,
// then back to sitting (L.done). laserStep is the logic (pure, tests), laserPose the drawing pose.
const LAS = { pounce: LEAP.land, pin: 0.45, rest: 0.9, cool: 1.2, puzzled: 2.8, low: 22, near: 130 };
// thC: the crouch's heading toward +x; both: it also turns to crouch toward -x (a stage box); sit: it only watches (the head crop)
const laserState = (thC = 0.35, both = true, sit = false) => ({ x: 0, th: 0.8, thC, both, sit, cr: 0, tgt: null, still: 0, lost: 0, pounce: null, cool: 0, t: 0, done: false });
// room: where the root may land a pounce, { r: [lo, hi], l: [lo, hi] } facing +x / -x (act units); none: anywhere
function laserStep(L, dt, tgt, calm, room) {
  L.t += dt;
  if (tgt) {
    const pv = L.lost < 0 ? L.tgt : null, sp = pv ? Math.hypot(tgt.x - pv.x, tgt.y - pv.y) / Math.max(dt, 1e-3) : 1e9;
    L.still = sp < 8 ? L.still + dt : 0; L.tgt = { x: tgt.x, y: tgt.y }; L.lost = -1;
  } else L.lost = L.lost < 0 ? 0 : L.lost + dt;
  const tg = L.lost < 0 ? L.tgt : null, rel = tg ? tg.x - L.x : 0, side = rel >= 0 ? 1 : -1;
  const low = !!tg && !L.sit && tg.y < LAS.low && Math.abs(rel) < LAS.near && (L.both || side > 0);
  L.cr = clamp(L.cr + (low || L.pounce ? 1 : -1) * dt * 2.5);
  const thT = L.cr > 0.4 && tg ? (side > 0 ? L.thC : PI - L.thC) : L.th > PI / 2 ? PI - 0.8 : 0.8;
  L.th += clamp(thT - L.th, -dt * 4, dt * 4);
  // creeps back into the room of the side it faces (while it turns round, the room both ways: the tail swings across)
  if (room && L.cr > 0.3 && !L.pounce) { const rg = Math.abs(thT - L.th) > 0.2 ? [Math.max(room.r[0], room.l[0]), Math.min(room.r[1], room.l[1])] : L.th > PI / 2 ? room.l : room.r; L.x += clamp(clamp(L.x, rg[0], rg[1]) - L.x, -dt * 45, dt * 45); }
  if (L.pounce) {
    const P = L.pounce; P.t += dt;
    L.x = lerp(P.x0, P.x1, leapProg(P.t));
    if (P.t >= LAS.pounce + LAS.pin) { L.pounce = null; L.cool = L.t + LAS.cool; L.still = 0; }
  } else if (!calm && low && L.cr > 0.9 && L.still > LAS.rest && L.t >= L.cool && Math.abs(L.th - thT) < 0.15) {
    const r = landReach(L.thC), rg = room ? (side > 0 ? room.r : room.l) : [-1e9, 1e9], x1 = clamp(tg.x - side * r, rg[0], rg[1]);
    if (Math.abs(x1 + side * r - tg.x) < 16) L.pounce = { t: 0, x0: L.x, x1 }; // only when the landing covers the dot
  }
  L.done = L.lost > LAS.puzzled;
  return L;
}
function laserPose(L, T, calm) {
  const tg = L.lost < 0 ? L.tgt : null;
  let p = mix(at(PRESENT, L.x, L.th), at(HUNTM, L.x, L.th), sstep(L.cr));
  if (L.pounce) {
    const P = L.pounce, q = leapPose(Math.min(P.t, LEAP.end), L.th, P.x0, P.x1, 12, at(HUNTM, P.x0, L.th));
    q.x = L.x; if (P.t > LEAP.land) q.headPitch += 0.25 * sstep((P.t - LEAP.land) / 0.2);
    p = mix(p, q, Math.min(sstep(P.t / 0.08), 1 - sstep((P.t - LAS.pounce - LAS.pin + 0.2) / 0.2)));
  } else if (!calm) wiggle(p, T, L.cr * clamp((L.still - 0.35) * 2));
  if (tg) return aimAt(p, tg.x, tg.y);
  const z = L.lost, e = env(z, 0, 0.25, LAS.puzzled - 0.5, LAS.puzzled), s = Math.sin(z * 2.6); // looking round for it
  p.lookX = 0.9 * s * e; p.lookTurn -= 0.35 * s * e; p.headRoll += 13 * env(z, 0.7, 1.0, 1.7, 2.0); p.earL -= 0.4 * Math.max(0, s) * e; p.earR -= 0.4 * Math.max(0, -s) * e;
  p.browUp += 0.6 * e; p.mouth = Math.max(p.mouth, 0.06 * e);
  return p;
}
// renderAt('laser'): a scripted dot (act units; k scales it to the box): it wanders on the floor, rests (a pounce),
// darts to the other side, climbs the wall, and is gone (a puzzled look round)
function laserDemo(t, k) {
  if (t < 1.4) return { x: (58 + 12 * Math.sin(t * 3.2)) * k, y: 0 };
  if (t < 3.1) return { x: 58 * k, y: 0 };
  if (t < 4.6) return { x: lerp(58, -70, sstep((t - 3.1) / 0.5)) * k, y: 0 };
  if (t < 5.8) return { x: -84 * k, y: lerp(0, 70, sstep((t - 4.6) / 1)) };
  return null;
}
BEH.laser = (cat, o, demo) => {
  if (cat.mode !== 'mascot') return BEH.chase(cat, o, demo);
  const th = actTh(cat), both = cat.stage, L = laserState(th, both, cat.bust), B = { busy: true, laser: true, L, loopFrom: 0, segs: [{ d: demo ? 9 : 1e5, b: 0.4, f: (u, tl, T) => laserPose(L, T, B.calm) }] };
  // framed for sitting, the crouch and every stage of the leap (on either side in a stage box)
  const leap = (t) => [at(PRESENT, 0, t > PI / 2 ? PI - 0.8 : 0.8), at(HUNTM, 0, t), at(LOADP, 0, t), at(POUNCE, 0, t, { lift: 6 }), at(TUCKP, 0, t, { lift: 12 }), at(REACHP, 0, t, { lift: 7 }), at(LAND, 0, t)];
  B.probe = [SIT0()].concat(leap(th), both ? leap(PI - th) : []);
  if (demo) {
    const k = cat.stage ? 1 : 0.5;
    B.sim = (tb) => { // replays the logic at 60 Hz up to tb, so every frame is deterministic
      Object.assign(L, laserState(th, both, cat.bust));
      for (let t = 0; t < tb; t += 1 / 60) laserStep(L, 1 / 60, laserDemo(t, k), false, B.room);
    };
  }
  staged(cat, B);
  // the room to pounce in, facing either way: the crouch and the landing kept inside the box at the act's zoom
  B.reroom = () => {
    const F = B.fit, side = (th1) => { const G = cat.fitAct({ segs: [], probe: leap(th1).concat(at(HUNTM, 0, PI / 2)) }, F.z); return [(G.lo - F.mx) / F.z + 6, (G.hi - F.mx) / F.z - 6]; };
    B.room = cat.mode === 'mascot' && !cat.bust ? { r: side(th), l: both ? side(PI - th) : [0, 0] } : { r: [0, 0], l: [0, 0] };
  };
  B.reroom();
  return B;
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
  // left and right on screen: c.mir is -1 when the drawing is mirrored (a mascot facing left)
  'point-left'(p, u, tl, c) { GEST._point(p, u, -c.mir, c); },
  'point-right'(p, u, tl, c) { GEST._point(p, u, c.mir, c); },
  // pointing behind itself, the near paw reaches across the chest and out past the body, not onto the chest
  _point(p, u, want, c) { const e = env(u, 0, 0.18, 0.8, 1), S = c.S, fwd = want === c.facing, K = fwd ? c.kF : c.k;
    if (fwd) paw(p, K, S[0] + 30, S[1] - 9, -0.15, e, K === 'ff' ? 1 : 0); else paw(p, K, S[0] - 38, S[1] - 6, PI - 0.1, e, K === 'ff' ? 1 : 0);
    p.beans = 0; p.lookX += want * 0.9 * e; p.lookTurn += want * 0.25 * e * c.facing; p.headRoll += want * c.facing * 4 * e;
    p.earRot = lerp(p.earRot, 0.8, e); p.browUp = lerp(p.browUp, 0.5, e); p.smile = lerp(p.smile, 0.7, e); },
  'point-down'(p, u, tl, c) { const e = env(u, 0, 0.18, 0.8, 1), S = c.S; paw(p, c.kF, S[0] + 26, 9, -0.6, e, c.kF === 'ff' ? 1 : 0); p.headPitch += 0.45 * e; p.lookY += 1 * e; p.earRot = lerp(p.earRot, 0.8, e); },
  shrug(p, u) { const e = env(u, 0, 0.15, 0.8, 1); p.earRot = lerp(p.earRot, -0.5, e); p.headRoll += 9 * Math.sin(u * PI * 2) * e; p.nfy += 3 * e; p.ffy += 3 * e; p.nfa += 0.5 * e; p.ffa += 0.5 * e; p.browUp = lerp(p.browUp, 1, e); p.smile = lerp(p.smile, -0.2, e); p.lid = Math.max(p.lid, 0.22 * e); p.shY += 1.5 * e; },
  'lean-in'(p, u) { const e = env(u, 0, 0.2, 0.75, 1); p.shift += 3 * e; p.shY -= 1.5 * e; p.neckA -= 10 * e; p.headDX += 4 * e; p.headScale = 1 + 0.08 * e; p.eyeOpen = lerp(p.eyeOpen, 1.08, e); p.pupil = lerp(p.pupil, 0.85, e); p.browUp = lerp(p.browUp, 0.5, e); p.earRot = lerp(p.earRot, 0.9, e); },
  'shield-up'(p, u, tl, c) { const e = env(u, 0, 0.18, 0.82, 1), Hb = c.Hb; paw(p, c.k, Hb[0] - 0.5, Hb[1] - 21, 1.5, e, c.far); p.glint = Math.max(p.glint, seg(u, 0.3, 0.62)); p.smile = lerp(p.smile, 0.85, e); p.headPitch -= 0.15 * e; p.earRot = lerp(p.earRot, 0.75, e); p.lidLow = Math.max(p.lidLow, 0.35 * e); p.browUp = lerp(p.browUp, 0.4, e); },
  bow(p, u) { const e = env(u, 0, 0.25, 0.7, 1); p.shY -= 9 * e; p.hipY -= e; p.neckA -= 35 * e; p.headPitch += 0.5 * e; if (e > 0.5) { p.lid = 1; p.happyEyes = 1; } p.earRot = lerp(p.earRot, 0.4, e); p.smile = lerp(p.smile, 0.8, e); }
};

/* ============================ catching the pointer (mascot mode) ============================ */
// Where a pointer at (x, y) is for a mascot cat in a W x H box (local px, origin top-left). near is 0 at the
// box centre and 1 on the edge of the box grown to 1.5x around it; interest ramps from 0 at near 1.25 to 1
// at near 0.85; reach ({ x, y, r } in local px) is the circle the paws can strike; side is the screen side
// of the pointer (-1 left, 1 right) from the reach centre (or the box centre).
function catchZone(x, y, W, H, reach) {
  const near = Math.max(Math.abs(x - W / 2) / (W * 0.75), Math.abs(y - H / 2) / (H * 0.75));
  const inReach = !!reach && Math.hypot(x - reach.x, y - reach.y) <= reach.r;
  return { zone: inReach ? 'reach' : near <= 1 ? 'near' : 'far', near, interest: clamp((1.25 - near) / 0.4), side: x < (reach ? reach.x : W / 2) ? -1 : 1 };
}
// A paw (wrist) target in the body frame (cat units, y up) kept within the shoulder S's reach: out front for
// the forward paw, across the chest and behind for the near paw; never above the cheek, never into the floor.
function reachTarget(bx, by, S, fwd) {
  let dx = fwd ? clamp(bx - S[0], 8, 34) : clamp(bx - S[0], -36, -12), dy = clamp(by, 6.2, S[1] + 8) - S[1];
  const d = Math.hypot(dx, dy), m = 38;
  if (d > m) { dx *= m / d; dy *= m / d; }
  return [S[0] + dx, Math.max(6.2, S[1] + dy)];
}
// Watching a pointer near by (I 0..1): crouched a little, ears forward, pupils wide, the tail tip twitching;
// staring at a still pointer in reach (st 0..1) adds a lower crouch, a butt wiggle and a faster twitch.
function huntPose(p, I, st, T, seed) {
  if (I < 0.005) return p;
  st *= I;
  p.shY -= (1.4 + 2.2 * st) * I; p.neckA -= 8 * I; p.headDY -= 0.6 * I; p.headPitch += 0.08 * I;
  p.earRot = lerp(p.earRot, 1, I); p.pupil = lerp(p.pupil, 0.88 + 0.12 * st, I); p.eyeOpen = lerp(p.eyeOpen, 1.1, I);
  p.whisk = lerp(p.whisk, 0.9, I); p.smile = lerp(p.smile, 0.1, I);
  p.tailTip += I * 14 * noise(T * 2.4 + seed) + 10 * st * Math.sin(T * 10);
  if (st > 0.02) { const wg = Math.sin(T * 18) * st; p.hipY += 0.8 * wg; p.shift -= 0.5 * wg; }
  return p;
}
// One strike of a paw (sw.K) at sw.tgt (body frame), u seconds after it started. Phases [anticipation,
// strike, hold, return] in seconds: a bat cocks the paw beside the chest and strikes; a swipe sweeps through
// the target along sw.dir with almost no wind-up; a pounce raises the paw high, slams it down and pins.
const SWAT = { bat: [0.16, 0.1, 0.08, 0.3], swipe: [0.05, 0.09, 0.03, 0.26], pounce: [0.3, 0.1, 0.45, 0.36] };
const swatDur = (k) => SWAT[k].reduce((a, b) => a + b, 0);
function swatPose(p, sw, u) {
  const [a, s, h, r] = SWAT[sw.kind], t = sw.tgt, S = sw.S, fw = sw.fwd ? 1 : -1;
  let C = [S[0] + fw * 14, S[1] - (sw.fwd ? 4 : 9)], E = t, a0 = 1.5, a1 = -0.35; // cocked beside the chest, below the chin
  if (sw.kind === 'swipe') { C = [t[0] - sw.dir * 14, t[1] + 3]; E = [t[0] + sw.dir * 10, Math.max(6.2, t[1] - 1)]; a0 = 0.6; a1 = -0.1; }
  else if (sw.kind === 'pounce') { C = [lerp(S[0], t[0], 0.5), Math.max(t[1], S[1] - 6) + 13]; a0 = 1.3; a1 = 0.05; }
  let w = C, ang = a0, e = 1, k = 0, cock = 0;
  if (u < a) { e = sstep(u / a); cock = e; }
  else if (u < a + s) { const f = (u - a) / s; k = sw.kind === 'pounce' ? eIn(f) : eOut(f); w = mid(C, E, k); ang = lerp(a0, a1, k); cock = 1 - k; }
  else if (u < a + s + h) { k = 1; w = E; ang = a1; }
  else { k = 1; w = E; ang = a1; e = 1 - sstep((u - a - s - h) / r); }
  e *= sw.fade == null ? 1 : sw.fade;
  paw(p, sw.K, w[0], w[1], ang, e, sw.far);
  p.beans = Math.max(p.beans, cock * e * 0.9); p.splay = Math.max(p.splay, k * e); p.claws = Math.max(p.claws, k * e);
  // the body goes with the paw: weight back while cocking, a lean into the strike, a press while pinning
  p.shift += fw * (2.4 * k - 1.4 * cock) * e;
  p.shY += (sw.kind === 'pounce' ? 2.4 * cock - 2.2 * k : 0.6 * cock - 1.2 * k) * e;
  p.headDY -= 0.8 * k * e; p.earRot = lerp(p.earRot, 1, e); p.pupil = lerp(p.pupil, 1, e); p.mouth = Math.max(p.mouth, 0.14 * k * e);
  return p;
}

/* ============================ jump (for a host that carries the cat along an arc) ============================ */
// Crouch → takeoff stretch → airborne tuck (paws reaching for the landing: down or up) → landing squash →
// settle back to sitting. The cat stays in place (a little lift only): the host moves the box between
// takeoff and landing, which B.jumpAt gives in seconds from the start.
const J_CROUCH = { hipY: 10, shY: 31, bodyL: 42, arch: 6, neckA: 58, neckL: 14, headPitch: 0.15, earRot: 0.9, pupil: 0.85, eyeOpen: 1.08, nfx: 17, ffx: 17.5, tailA: -30, tailCurl: 4, tailTip: 20, tailRoot: 0.3, smile: 0.2 };
const J_PUSH = { hipY: 24, shY: 44, bodyL: 54, arch: -2, neckA: 66, neckL: 16, headPitch: -0.15, nfx: 26, nfy: 10, nfa: -0.5, ffx: 28, ffy: 8, ffa: -0.5, nhx: -14, nhy: 0, nha: 0.1, fhx: -12, fhy: 0, fha: 0.1, tailA: 20, tailCurl: -2, tailTip: -6, tailRoot: 0.8, earRot: 0.6, eyeOpen: 1.15, pupil: 0.9, mouth: 0.1 };
const J_TUCK = { hipY: 26, shY: 32, bodyL: 44, arch: 7, neckA: 55, neckL: 14, headPitch: 0.1, nfx: 20, nfy: 12, nfa: 1.0, ffx: 22, ffy: 11, ffa: 1.0, nhx: -10, nhy: 10, nha: 1.5, fhx: -8, fhy: 9, fha: 1.5, tailA: 32, tailCurl: -4, tailTip: -12, tailRoot: 0.8, earRot: 0.4, eyeOpen: 1.12, pupil: 0.95, smile: 0.3 };
const J_REACH = {
  down: { hipY: 31, shY: 28, bodyL: 48, arch: 4, neckA: 40, headPitch: 0.3, lookY: 0.6, nfx: 28, nfy: 1, nfa: -0.4, ffx: 30, ffy: 1, ffa: -0.4, nhx: -12, nhy: 8, nha: 1.4, fhx: -10, fhy: 7, fha: 1.4, tailA: 38, tailCurl: -5, tailTip: -16, earRot: 0.7, splay: 1 },
  up: { hipY: 22, shY: 38, bodyL: 50, arch: 1, neckA: 62, headPitch: -0.2, lookY: -0.5, nfx: 26, nfy: 15, nfa: -0.6, ffx: 28, ffy: 14, ffa: -0.6, nhx: -12, nhy: 6, nha: 1.2, fhx: -10, fhy: 5, fha: 1.2, tailA: 30, tailCurl: -3, tailTip: -10, earRot: 0.8, splay: 1 }
};
const J_LAND = { hipY: 26, shY: 22, bodyL: 46, arch: 3, neckA: 40, neckL: 14, headPitch: 0.25, squish: 0.5, nfx: 24, nfy: 0, nfa: 0, ffx: 26, ffy: 0, ffa: 0, nhx: -16, nhy: 0, nha: 0.6, fhx: -14, fhy: 0, fha: 0.6, tailA: 18, tailCurl: -3, tailTip: -10, earRot: 0.7, pupil: 0.8, splay: 1 };
BEH.jump = (cat, o, demo) => {
  const x = demo ? cat.Wu * 0.7 : cat.x, th = sitTheta(cat, demo ? 0 : cat.th), base = sitBase(cat);
  const dir = o.dir === 'up' ? 'up' : 'down', hang = clamp(o.hang != null ? +o.hang / 1000 : 0.45, 0.15, 2);
  const L = cat.mode === 'mascot' ? 0.6 : 3; // lift scale: the host carries a mascot; a roaming cat hops for real
  // a mascot keeps its tail up and its head low enough to stay in its box (the host carries it along the arc)
  const JM = cat.mode === 'mascot' ? { tailA: 10, tailCurl: 16, tailTip: 60, tailLen: 0.65, tailRoot: 0.6 } : null;
  // between the raised tail and the sitting wrap the tail coils up on the way, instead of sweeping out behind
  const coil = (p, u) => { if (JM) { const h = hump(u, 0, 1); p.tailCurl += 8 * h; p.tailTip += 30 * h; p.tailLen *= 1 - 0.3 * h; } return p; };
  const pose = (q) => at(Object.assign({}, base, q, JM, JM ? { shY: Math.min(q.shY || base.shY, 41), neckA: Math.min(q.neckA || base.neckA, 60) } : null), x, th);
  const CR = pose(J_CROUCH), PU = pose(J_PUSH), TU = pose(J_TUCK), RE = pose(Object.assign({}, J_TUCK, J_REACH[dir])), LA = pose(J_LAND), SI = at(base, x, th);
  const segs = [
    { d: 0.28, b: 0.25, f: (u) => coil(mix(SI, CR, eIO(u)), u) },
    { d: 0.12, b: 0.06, f: (u) => { const p = mix(CR, PU, eOut(u)); p.lift = 6 * L * eOut(u); return p; } },
    { d: hang, b: 0.08, f: (u) => { const p = u < 0.45 ? mix(PU, TU, eIO(u / 0.45)) : mix(TU, RE, eIO((u - 0.45) / 0.55)); p.lift = L * (6 + 3 * Math.sin(PI * u) - 4 * sstep(seg(u, 0.5, 1))); return p; } },
    { d: 0.16, b: 0.05, f: (u) => { const p = mix(RE, LA, eOut(u)); p.lift = 2 * L * (1 - eOut(u)); return p; } },
    { d: 0.6, b: 0.1, f: (u) => { const p = coil(mix(LA, SI, eIO(seg(u, 0.1, 1))), seg(u, 0.1, 1)); p.shY -= 1.6 * hump(u, 0.25, 0.7); p.headDY += 0.8 * hump(u, 0.3, 0.75); p.earL -= 0.4 * hump(u, 0.55, 0.75); p.earR -= 0.4 * hump(u, 0.6, 0.8); return p; } }
  ];
  return { busy: true, sitting: false, jump: true, jumpAt: { takeoff: 0.4, land: 0.4 + hang, end: 0.4 + hang + 0.76 }, segs };
};

/* ============================ runtime ============================ */
const INST = [];

// One pointer listener for every cat (window, passive), bound with the first instance. It keeps the last
// position and a smoothed velocity; mascots measure themselves against it only when it moves, and a still
// pointer costs nothing.
const PTR = { x: 0, y: 0, t: 0, vx: 0, vy: 0, speed: 0, type: 'mouse', on: false };
function ptrMove(e) {
  const now = performance.now(), dt = now - PTR.t;
  if (PTR.on && e.type === 'pointermove' && dt > 0 && dt < 150) {
    const k = Math.min(1, dt / 40);
    PTR.vx = lerp(PTR.vx, ((e.clientX - PTR.x) / dt) * 1000, k); PTR.vy = lerp(PTR.vy, ((e.clientY - PTR.y) / dt) * 1000, k);
  } else { PTR.vx = 0; PTR.vy = 0; }
  PTR.speed = Math.hypot(PTR.vx, PTR.vy); PTR.x = e.clientX; PTR.y = e.clientY; PTR.t = now; PTR.on = true; PTR.type = e.pointerType || 'mouse';
  for (const c of INST) if (c.mode === 'mascot' && c.visible && !c.frozen) c.onPointer(e.type === 'pointerdown');
}
function ptrGone(e) {
  if (e.type === 'pointerout' ? e.relatedTarget : e.pointerType === 'mouse') return; // still on the page / a mouse button released
  PTR.on = false;
  for (const c of INST) if (c.ptr) c.ptrLost();
}
// the pointer's current speed (px/s): its last velocity while it keeps moving, nothing once it rests
const ptrSpeed = () => (PTR.on && performance.now() - PTR.t < 90 ? PTR.speed : 0);
let rafId = 0, lastNow = 0, wakeTimer = 0;
// Browser globals (media queries, the theme reader, the visibility listener) start with the first instance,
// never at module load: the module may be evaluated on the server.
let RM = null, booted = false;
const reducedMotion = () => !!RM && RM.matches;
// Until the theme is read: the design page's light-theme shadow and ink.
let THEME = { shadowA: (a) => `rgba(64,48,110,${(0.28 * a).toFixed(3)})`, ink: '#16123a' };
function readTheme() {
  const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
  // The portal has no --shadow token: fall back to the design page's light value.
  const sh = v('--shadow') || 'rgba(64,48,110,.28)', m = sh.match(/rgba?\(([^)]+)\)/);
  const parts = m ? m[1].split(',').map((s) => parseFloat(s)) : [64, 48, 110, 0.28];
  const al = parts.length > 3 ? parts[3] : 1;
  THEME = { ink: v('--ink') || v('--color-ink') || '#16123a', cushion: v('--cushion'), cushion2: v('--cushion-2'), cushionTop: v('--cushion-top'), cushionRim: v('--cushion-rim'),
    shadowA: (a) => `rgba(${parts[0]},${parts[1]},${parts[2]},${(al * a).toFixed(3)})` };
  for (const c of INST) { c.dark = surfaceDark(c.el); c.kit = makeKit(c.g, c.dark); c.renderNow(); }
}
// One shared loop. Still / frozen instances are skipped (they redraw only when something changes, plus a
// blink scheduled with a timeout), small mascots run at 30 fps (20 while only idling) and sleep between
// their frames, and nothing runs while the tab is hidden.
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
function boot() {
  if (booted) return;
  booted = true;
  RM = matchMedia('(prefers-reduced-motion: reduce)');
  readTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);
  new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  addEventListener('pointermove', ptrMove, { passive: true });
  addEventListener('pointerdown', ptrMove, { passive: true });
  for (const t of ['pointerup', 'pointercancel']) addEventListener(t, ptrGone, { passive: true });
  document.addEventListener('pointerout', ptrGone, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (rafId) cancelAnimationFrame(rafId); rafId = 0; lastNow = 0; clearTimeout(wakeTimer); } else kick(); });
}

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
// The mascot's own idle acts (setAuto(true): decorative placements only; narration placements never call it). After
// every act the cat sits in its present loop for a while, then picks the next one by these weights: calm keeps to
// sitting, a slow blink, grooming, kneading and, after a long idle, sleep; a head-only crop (bust) has no body acts;
// the toys need a box wider than tall (stage). idle: seconds since anyone was near (pointer, press, prop change).
const SLEEP_IDLE = 90;
function mascotAutoWeights({ calm = false, stage = false, bust = false, idle = 0 } = {}) {
  const tired = idle > SLEEP_IDLE;
  if (calm) return Object.assign({ present: 4, blink: 1.2, groom: 1, knead: 0.6 }, tired ? { sleep: 2.5, doze: 1 } : {});
  const w = { present: 3, blink: 1, look: 1.2, flick: 1, tilt: 0.8, groom: 1, yawn: 0.7, knead: 0.5 };
  if (!bust) Object.assign(w, { stretch: 0.6, pounce: 0.3, 'chase-tail': 0.2, roll: 0.3 });
  if (stage) Object.assign(w, { mouse: 0.35, yarn: 0.35 });
  if (tired) Object.assign(w, { sleep: 3, doze: 1.2 });
  return w;
}
// The new lively acts: none while still (the still prop, data-motion=still, reduced motion); under calm only the
// laser, which then watches and crouches but never wiggles or pounces.
const LIVELY = new Set(['stretch', 'run', 'mouse', 'yarn', 'laser', 'chase-tail', 'roll', 'pounce']);
function actAllowed(name, motion) { return !LIVELY.has(name) || (motion !== 'still' && (motion !== 'calm' || name === 'laser')); }
const calmMotion = () => document.documentElement.dataset.motion === 'calm';
// sitting acts a slow stroke over the body may turn into a pet (purr)
const STROKE_PET = new Set(['present', 'sit', 'flick', 'look', 'blink', 'tilt']);
// seconds each tail shape value takes to follow the pose (base first, then curl, then the tip)
const TAIL_LAG = { tailA: 0.12, tailRoot: 0.12, tailDX: 0.1, tailDY: 0.1, tailLen: 0.15, tailPuff: 0.15, tailCurl: 0.2, tailTip: 0.26, tailWave: 0.4, tailSpd: 0.4 };
const isPoint = (n) => !!n && n.startsWith('point-');
// moods with fast live motion (head bob, confetti) keep a small mascot at 30 fps
const BUSY_MOODS = new Set(['laughing', 'excited', 'celebrate']);

class Cat {
  constructor(el, opts = {}) {
    boot();
    this.el = el; el.catInstance = this; this.mode = opts.mode === 'mascot' ? 'mascot' : 'roam';
    this.behaviours = BEHAVIOUR_NAMES.slice();
    this.moods = Object.keys(MOODS); this.gestures = Object.keys(GDUR);
    this.facing = opts.facing === 'left' ? 'left' : 'right';
    this.cv = document.createElement('canvas'); this.cv.className = 'cat-canvas'; this.cv.setAttribute('aria-hidden', 'true');
    // the design page's .cat-canvas rule, inline (the host must be positioned)
    Object.assign(this.cv.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', pointerEvents: 'none' });
    el.appendChild(this.cv); this.g = this.cv.getContext('2d'); this.dark = surfaceDark(el); this.kit = makeKit(this.g, this.dark);
    if (this.mode === 'mascot') {
      if (opts.size) { el.style.width = opts.size + 'px'; el.style.height = opts.size + 'px'; }
      if (opts.aria !== false) {
        if (!el.hasAttribute('role')) el.setAttribute('role', 'img');
        if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', opts.label || 'AI Sel');
      }
    }
    this.clock = 0; this.timeT = 0; this.auto = this.mode === 'roam'; this.still = false; this.frozen = null;
    this.mood = 'idle'; this.moodFrom = 'idle'; this.moodT = -10; this.talking = false; this.talkLevel = 1; this.gest = null; this.holdName = null;
    this.x = 0; this.th = this.mode === 'mascot' ? 0.8 : PI - 0.38; this.energy = 1; this.hist = [];
    this.lk = { x: 0, y: 0, turn: 0, pitch: 0 }; this.look = null; this.lookDir = null;
    this.tagA = 0; this.tagW = 0; this.tagP = null; this.tagV = 0; this.glint = 0; this.spark = 0;
    this.nextBlink = 1.2; this.blinkAt = -10; this.nextTwitch = 3; this.twitchAt = -10; this.twitchK = 1;
    this.blinkWall = performance.now() + 1500; this.blinkStart = -1e9; this.wasBlink = false; this.stillLid = 0; this.lastDraw = 0; this.gFade = null;
    this.pointer = null; this.pointerIn = false; this.speed = 0; this.fastT = 0; this.chaseN = 0; this.chaseCool = 0; this.lastMove = -10; this.demo = null; this.sleepPet = -10;
    this.visible = true; this.userSize = 0; this.dirty = true; this.onState = null; this._ls = [];
    this.tailS = null; this.tailPh = Math.random() * TAU; this.seed = Math.random() * 100; this.flickAt = -10; this.nextFlick = 2.5 + Math.random() * 4;
    this.ptr = null; this.ptrNear = false; this.hunt = { I: 0, st: 0, still: 0, next: 0, cool: 0, tap: false }; this.swat = null; this.mom = null; this.reach = null;
    this.lastInteract = 0; this.laserPt = null; this.actT = 0; this.stroke = null; this.stage = false;
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
    // the layout size, not the transformed rect: a float or a scale-in on an ancestor must not shrink the canvas
    const el = this.el, r = el.offsetWidth ? null : el.getBoundingClientRect();
    const W = Math.max(1, r ? r.width : el.offsetWidth), H = Math.max(1, r ? r.height : el.offsetHeight);
    this.W = W; this.H = H; this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(W * this.dpr); this.cv.height = Math.round(H * this.dpr);
    this.lod = false; this.cap = false;
    const dk = surfaceDark(el); if (dk !== this.dark) { this.dark = dk; this.kit = makeKit(this.g, dk); } // the surface may have changed with the layout
    if (this.mode === 'roam') {
      this.narrow = W < 560;
      // phones: a closer camera so the cat stays big (the stage is taller there and shows two pillars)
      this.s = this.userSize ? this.userSize / 105 : this.narrow ? Math.min((H / 560) * 2.75, W / 255) : (W / 1000) * 2.9;
      this.floor = H * 0.866; this.Wu = W / this.s;
    } else {
      const sz = Math.min(W, H); this.bust = sz < 80; this.lod = sz < 72; this.cap = sz < 130;
      const R = solve(at(PRESENT, 0, 0.8), 0);
      // the head crop ends in a soft oval vignette (unit gradient, placed in draw) instead of hard cuts across the body
      if (this.bust && !this.fade) { const fg = (this.fade = this.g.createRadialGradient(0, 0, 0, 0, 0, 1)); fg.addColorStop(0.7, 'rgba(0,0,0,1)'); fg.addColorStop(1, 'rgba(0,0,0,0)'); }
      if (this.bust) { this.s = sz / (74 * HS); this.ox = W / 2 - R.head[0] * this.s; this.oy = H / 2 - (R.head[1] + 5 * HS) * this.s; } // head + collar + shield
      else {
        let x0 = 1e9, x1 = -1e9, y1 = 1; const y0 = R.head[1] - 35 * HS; // the design's - 33 cut the top thought dot (think)
        for (const t of R.torso.concat(R.tail)) { x0 = Math.min(x0, t[0] - t[2]); x1 = Math.max(x1, t[0] + t[2]); }
        // the sitting haunch (the thigh rounds, L.th) and the belly reach below the floor: frame them too, with the
        // outline, or the bottom of the body is cut flat at the box edge (visible on dark surfaces)
        for (const t of R.torso) y1 = Math.max(y1, t[1] + t[2] + 1);
        for (const L of R.legs) if (!L.front) for (const t of L.th) y1 = Math.max(y1, t[1] + t[2] + 1);
        x0 = Math.min(x0, R.head[0] - 24 * HS); x1 = Math.max(x1, R.head[0] + 24 * HS);
        this.s = Math.min(W / (x1 - x0 + 10), H / (y1 - y0 + 8));
        this.ox = W / 2 - ((x0 + x1) / 2) * this.s; this.oy = H / 2 - ((y0 + y1) / 2) * this.s;
        // the paws' strike circle (local px): centred a little above the front paws, about one foreleg long
        const fp = R.legs.filter((L) => L.front), pu = (fp[0].P[0] + fp[1].P[0]) / 2 + 6, pv = (fp[0].P[1] + fp[1].P[1]) / 2 - 10;
        this.reach = { x: this.facing === 'left' ? W - this.ox - pu * this.s : this.ox + pu * this.s, y: this.oy + pv * this.s, r: 46 * this.s };
      }
      // a box wider than tall is a stage: the roomy acts play side-on and move about in it
      this.stage = !this.bust && W >= H * 1.3;
      if (this.cur && this.cur.fitMe) { this.fitAct(this.cur); if (this.cur.reroom) this.cur.reroom(); }
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
    this.blendT0 = this.clock; this.blendDur = name === 'chase' ? 0.22 : this.cur && this.cur.doze ? 1.0 : 0.45; // slowly out of a doze
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
      if (n !== 'present' || this.holdName || this.talking || this.gest) return this.start('present');
      const W = mascotAutoWeights({ calm: calmMotion(), stage: this.stage, bust: this.bust, idle: this.clock - this.lastInteract });
      for (const h of this.hist) if (h !== 'present' && W[h] != null) W[h] *= 0.15; // no repeats
      let tot = 0; for (const k in W) tot += W[k];
      let r = Math.random() * tot;
      for (const k in W) { r -= W[k]; if (r <= 0) return this.start(k, k === 'sleep' || k === 'doze' ? { dur: 30 + Math.random() * 40 } : {}); }
      return this.start('present');
    }
    this.start(this.choose(n));
  }
  /* ---------- per frame ---------- */
  tick(dt, now) {
    if (this.frozen) { if (this.dirty) this.renderFrozen(); return false; }
    if (this.still) return this.stillTick(now);
    if (this.cap) { // small: 30 fps, 20 while only idling; between frames the loop gets a wake-up time instead
      const gap = this.idling() ? 50 : 1000 / 30, due = this.lastDraw + gap;
      if (this.lastDraw && now < due - 9) return due - 8;
      dt = this.lastDraw ? Math.min(0.05, (now - this.lastDraw) / 1000) : dt;
      this.lastDraw = now;
      this.frame(dt);
      return now + gap - 8;
    }
    this.frame(dt);
    return true;
  }
  // sitting in the present loop with nothing else going on (no gesture, voice, pointer look or mood change)
  idling() {
    return this.cur.name === 'present' && !this.gest && !this.holdName && !this.talking && !this.gFade && !BUSY_MOODS.has(this.mood) && !this.swat && this.hunt.I < 0.01 &&
      this.clock - this.moodT > 0.4 && !(this.look && this.clock < this.look.until);
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
      if (this.cur.laser) this.laserTick(dt); // may hand over to the walk home
      let tb = T - this.cur.t0;
      if (this.mom) this.momTick(tb);
      if (tb >= this.cur.total) { this.next(); tb = T - this.cur.t0; }
      this.actT = tb;
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
    if (this.mode !== 'roam') { this.huntLogic(dt); return; }
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
  /* ---------- catching the pointer (mascot mode) ---------- */
  // Called by the shared listener on every move or press: where the pointer is, in this box's px.
  onPointer(down) {
    const r = this.el.getBoundingClientRect(), kx = r.width ? this.W / r.width : 1, ky = r.height ? this.H / r.height : 1;
    const x = (PTR.x - r.left) * kx, y = (PTR.y - r.top) * ky, z = catchZone(x, y, this.W, this.H, this.bust ? null : this.reach);
    this.ptr = { x, y, z, at: this.clock };
    this.look = { x, y, until: this.clock + 2.5 };
    if (z.zone !== 'far') this.lastInteract = this.clock;
    if (!down) this.strokeLogic(x, y);
    // a tap beside the cat (a finger has no hover) is batted at once; a tap on the cat pets it
    if (down && PTR.type !== 'mouse' && z.zone === 'reach' && !this.hitTest(x, y)) this.hunt.tap = true;
    if (this.still) { const near = z.zone !== 'far'; if (!near && !this.ptrNear) return; this.ptrNear = near; this.dirty = true; }
    kick();
  }
  // A slow stroke over the cat (a mouse or pen moving across its body, no press) purrs like a pet: a sitting cat tilts
  // its head into it, a sleeping or dozing one purrs where it lies. Not while still.
  strokeLogic(x, y) {
    const now = performance.now(), k = this.stroke || (this.stroke = { d: 0, x, y, t: now });
    const over = !this.still && !reducedMotion() && PTR.type !== 'touch' && this.hit && this.hitTest(x, y);
    if (!over || ptrSpeed() > 900 || now - k.t > 400) k.d = 0; else k.d += Math.hypot(x - k.x, y - k.y);
    k.x = x; k.y = y; k.t = now;
    if (k.d < Math.max(36, 0.5 * (this.hit.x1 - this.hit.x0))) return;
    k.d = 0;
    const B = this.cur, T = this.clock;
    if (B.doze || (B.name === 'sleep' && this.curled())) { if (T - this.sleepPet > 2.6) this.sleepPet = T; }
    else if (STROKE_PET.has(B.name)) { this.hunt.cool = T + 2.2; this.start('pet'); }
    kick();
  }
  ptrLost() { this.ptr.gone = true; if (this.still && this.ptrNear) { this.ptrNear = false; this.dirty = true; kick(); } }
  // body-frame paw target (cat units) for a local px point, for the paw K of the current pose
  bodyTarget(x, y, base, K, S, fwd) {
    const mir = this.facing === 'left' ? -1 : 1, ux = (x - (mir < 0 ? this.W - this.ox : this.ox)) / (mir * this.s), uy = (y - this.oy) / this.s;
    const c = Math.cos(base.theta) || 1e-3, z = (K[0] === 'n' ? 1 : -1) * base.legZ;
    return reachTarget((ux + z * Math.sin(base.theta)) / c, -uy - (base.gy + base.lift), S, fwd);
  }
  // Watching (interest), staring at a still pointer, and the strikes: a bat while it moves in reach, a quick
  // swipe when it flies past, a pounce after a stare at a still one. Only while sitting in the present loop
  // with nothing else on (no held or played gesture, no talking); calm motion bats but never swipes or pounces.
  huntLogic(dt) {
    const T = this.clock, h = this.hunt, q = this.ptr;
    const can = this.cur.name === 'present' && !this.holdName && !this.gest && !this.talking && !reducedMotion();
    const z = q && (!q.gone || h.tap) && T - q.at < 2.5 ? q.z : null; // seen in the last 2.5 s (a lifted finger: its tap only)
    h.I = lerp(h.I, can && z ? z.interest : 0, 1 - Math.exp(-dt * (can && z && z.interest > h.I ? 6 : 2.5)));
    const sw = this.swat;
    if (sw) {
      if (!can && sw.fadeAt == null) sw.fadeAt = T;
      sw.fade = sw.fadeAt == null ? 1 : 1 - sstep((T - sw.fadeAt) / 0.2);
      if (T - sw.t0 >= swatDur(sw.kind) || sw.fade <= 0) { this.swat = null; h.next = T + 0.35 + Math.random() * 0.45; }
      if (!sw.locked && T - sw.t0 >= SWAT[sw.kind][0] * 0.8 && q && can) { sw.tgt = this.bodyTarget(q.x, q.y, this.lastBase, sw.K, sw.S, sw.fwd); sw.locked = true; }
      return;
    }
    const tap = h.tap; h.tap = false;
    if (!can || !z || this.bust || T < h.cool || z.zone !== 'reach' || (!tap && this.hitTest(q.x, q.y))) { h.still = 0; h.st = lerp(h.st, 0, 1 - Math.exp(-dt * 6)); return; }
    const calm = calmMotion(), sp = ptrSpeed();
    if (sp > Math.max(600, 4 * Math.min(this.W, this.H)) && !calm && T >= h.next - 0.25) return this.startSwat('swipe', q); // crossing the box in a quarter second
    if (sp > 40 || tap) { h.still = 0; h.st = lerp(h.st, 0, 1 - Math.exp(-dt * 6)); if (T >= h.next || tap) this.startSwat('bat', q); return; }
    h.still += dt;
    h.st = calm ? 0 : clamp((h.still - 0.15) / 0.5);
    if (!calm && h.still > 1.1 && T >= h.next) { this.startSwat('pounce', q); h.still = -1.5; }
  }
  startSwat(kind, q) {
    const base = this.lastBase, c = this.gctx(base), mir = this.facing === 'left' ? -1 : 1;
    const fwd = (q.x < this.reach.x ? -1 : 1) * mir === c.facing, K = fwd ? c.kF : c.k;
    const dir = (PTR.vx >= 0 ? 1 : -1) * mir * c.facing;
    this.swat = { kind, K, far: K === 'ff' ? 1 : 0, fwd, S: c.S, dir, t0: this.clock, tgt: this.bodyTarget(q.x, q.y, base, K, c.S, fwd), locked: kind === 'swipe' };
    this.hunt.st = 0; kick();
  }
  catchPose(p, T) {
    huntPose(p, this.hunt.I, this.hunt.st, T, this.seed);
    if (this.swat) swatPose(p, this.swat, T - this.swat.t0);
    return p;
  }
  /* ---------- jump and run: moments a host moves the box by ---------- */
  // Callbacks at named moments of the current behaviour (jump: takeoff, land, end; run: start, stop, end), fired in
  // order from the frame that reaches each one, backed by timers when no frame runs (an offscreen or hidden cat), so
  // a host waiting for the end is never left hanging. A new jump or run ends the one before (its end fires).
  moments(names, cbs) {
    if (this.mom) this.mom.fire('end');
    let res;
    const M = { names, at: null, fired: {}, timers: [], B: null, done: new Promise((r) => { res = r; }) };
    M.fire = (k) => {
      for (const kk of names) {
        if (M.fired[kk]) { if (kk === k) break; continue; }
        M.fired[kk] = true;
        try { if (cbs[kk]) cbs[kk](); } catch (err) { setTimeout(() => { throw err; }); }
        if (kk === 'end') { M.timers.forEach(clearTimeout); if (this.mom === M) this.mom = null; res(); }
        if (kk === k) break;
      }
    };
    this.mom = M;
    return M;
  }
  arm(M, at) {
    M.B = this.cur; M.at = at;
    for (const k of M.names) M.timers.push(setTimeout(() => M.fire(k), at[k] * 1000 + 120));
    kick();
  }
  momTick(tb) { const M = this.mom; if (!M || M.B !== this.cur) return; for (const k of M.names) if (!M.fired[k] && tb >= M.at[k]) M.fire(k); }
  jump(o = {}) {
    if (this.frozen) this.resume();
    const M = this.moments(['takeoff', 'land', 'end'], { takeoff: o.onTakeoff, land: o.onLand, end: o.onDone });
    const none = () => { M.fire('end'); return { takeoff: 0, land: 0, end: 0, done: M.done }; };
    if (this.still || reducedMotion()) return none(); // no motion: the host jump-cuts, and every moment is now
    this.start('jump', { dir: o.dir, hang: o.hang });
    if (!this.cur.jumpAt) return none(); // asleep: it wakes first, no jump
    const at = this.cur.jumpAt;
    this.arm(M, at);
    return { takeoff: Math.round(at.takeoff * 1000), land: Math.round(at.land * 1000), end: Math.round(at.end * 1000), done: M.done };
  }
  // Gallops across the page: the cat runs in place in its box while the host moves the box by offset(ms) (px from
  // where it started, signed). Still, reduced motion, calm, asleep or no distance: no gallop, every moment is now
  // and offset is the whole distance (the host moves the box without the run).
  run(o = {}) {
    if (this.frozen) this.resume();
    const sd = o.dir === 'left' || o.dir < 0 ? -1 : 1, dist = Math.max(0, +o.distancePx || 0);
    const M = this.moments(['start', 'stop', 'end'], { start: o.onStart, stop: o.onStop, end: o.onDone });
    const none = () => { M.fire('end'); return { start: 0, stop: 0, end: 0, done: M.done, offset: () => sd * dist }; };
    this.lastInteract = this.clock;
    if (this.still || reducedMotion() || calmMotion() || dist < 1) return none();
    this.start('run', { dir: sd, distancePx: dist });
    const at = this.cur.runAt;
    if (!at) return none();
    this.arm(M, at);
    const ms = (v) => Math.round(v * 1000);
    return { start: ms(at.start), stop: ms(at.stop), end: ms(at.end), done: M.done, offset: (t) => sd * dist * runProgress((+t || 0) / 1000, at) };
  }
  /* ---------- the laser dot ---------- */
  // pt: a point in the cat's box (px from its top left; outside the box too), null when the dot is gone
  laser(pt) {
    if (this.frozen) this.resume();
    this.laserPt = pt ? { x: +pt.x || 0, y: +pt.y || 0 } : null;
    this.lastInteract = this.clock; this.dirty = true;
    if (pt && !this.still && !reducedMotion() && !(this.cur && this.cur.laser)) this.start('laser'); // still: the eyes only (overlay)
    kick();
  }
  // feeds the live target to the laser logic in act units; when it is over, back home (or straight to sitting)
  laserTick(dt) {
    const B = this.cur, F = B.fit, L = B.L, pt = this.laserPt, k = this.s * F.z;
    B.calm = calmMotion();
    const tg = pt ? { x: ((this.facing === 'left' ? this.W - pt.x : pt.x) - this.ox - this.s * F.mx) / k, y: (this.oy - pt.y) / k } : null;
    laserStep(L, dt, tg, B.calm, B.room);
    if (L.done) { if (Math.abs(L.x) < 3 && L.cr < 0.2) this.start('present'); else this.start('_home', { x0: L.x, th: L.th, fit: F }); }
  }
  // Frames an act (staged) in the mascot box: one zoom (≤ 1, about the floor point) and one sideways shift for the
  // whole act from 25 of its frames (or its probe poses) and its toy, so it stays inside; lo..hi is the shift range
  // that keeps that frame inside (the laser's room to move).
  fitAct(B, zFix) {
    const F = B.fit || (B.fit = { z: 1, mx: 0, lo: 0, hi: 0 });
    if (this.mode !== 'mascot' || this.bust) return F;
    const segs = B.segs.map((sg) => ({ d: sg.d, b: sg.b, f: sg.f0 || sg.f })), tot = segs.reduce((a, sg) => a + sg.d, 0), Bq = { segs }, pr = B.probe;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const add = (x, y, r) => { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); };
    // a frame every 0.12 s (the quick turns of the tail between poses too); the tail gets room for its sway and its
    // flicks, which the live cat adds on top (its phase is its own), growing toward the tip
    const N = pr ? pr.length : Math.max(25, Math.ceil(tot / 0.12));
    for (let i = 0; i < N; i++) {
      const tb = pr ? 0 : (i / (N - 1)) * tot * 0.9999, q = pr ? pr[i] : sampleSegs(Bq, tb, tb), R = solve(q, tb), qx = q.x || 0, hs = HS * q.headScale;
      for (const t of R.torso) add(qx + t[0], t[1], t[2] + 1);
      R.tail.forEach((t, j) => add(qx + t[0], t[1], t[2] + (j / 12) * (1.6 * q.tailWave + 4)));
      // paws, elbows and wrists, haunches, knees and hocks (with the outline)
      for (const L of R.legs) { add(qx + L.P[0], L.P[1], 5.5); if (L.front) { add(qx + L.E[0], L.E[1], 6.5); add(qx + L.W[0], L.W[1], 5); } else { for (const t of L.th) add(qx + t[0], t[1], t[2] + 1.5); add(qx + L.K[0], L.K[1], 7); add(qx + L.Hk[0], L.Hk[1], 5); } }
      add(qx + R.head[0], R.head[1], (26 + 6 * Math.abs(R.o) + 8 * clamp(Math.abs(q.headRoll) / 40)) * hs); y0 = Math.min(y0, R.head[1] - 33 * hs); // whiskers (further on a 3/4 head); a tilted head's ears reach out sideways
      // a toy: r across, h tall, standing on the floor (not below it); one on its way out of the box (fit false) is let go
      if (B.toy) { const t = B.toy(tb); if (t.a > 0.05 && t.fit !== false) { const tl = t.len ? t.x - (t.dir < 0 ? -1 : 1) * (t.len + t.r) : t.x; x0 = Math.min(x0, t.x - t.r - 2, tl); x1 = Math.max(x1, t.x + t.r + 2, tl); y0 = Math.min(y0, -t.y - t.h - 2); y1 = Math.max(y1, (t.dn || 1.5) - t.y); } }
    }
    const m = 3, s = this.s, W = this.W;
    const z = zFix || Math.min(1, (W - 2 * m) / (s * (x1 - x0)), y0 < 0 ? (this.oy - m) / (s * -y0) : 1, y1 > 0 ? (this.H - this.oy - m) / (s * y1) : 1);
    const lo = (m - this.ox) / s - z * x0, hi = (W - m - this.ox) / s - z * x1;
    F.z = z; F.lo = lo; F.hi = hi; F.mx = lo > hi ? (lo + hi) / 2 : clamp(0, lo, hi);
    return F;
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
      // a held gesture (hold) stays at its peak (u = 0.5) and comes back after a one-shot gesture ends
      if (this.gest && !this.gest.hold && T - this.gest.t0 >= this.gest.dur) this.gest = null;
      if (!this.gest && this.holdName) this.gest = this.newGest(this.holdName, true);
      // a replaced gesture fades out over 0.3 s instead of the paw jumping to the new one
      const fd = this.gFade ? (T - this.gFade.t0) / 0.3 : 1;
      let pf = null;
      if (fd < 1) { const f = this.gFade; pf = Object.assign({}, p); GEST[f.name](pf, f.u, f.tl, f.ctx); } else this.gFade = null;
      if (this.gest) { const gs = this.gest, u = (T - gs.t0) / gs.dur; GEST[gs.name](p, gs.hold ? Math.min(u, 0.5) : u, T - gs.t0, gs.ctx); }
      if (pf) p = mix(pf, p, sstep(fd));
      if (this.talking || mwt('talk') > 0.5) { p.mouth = Math.max(p.mouth, talkOpen(T) * this.talkLevel); p.headPitch += 0.05 * Math.sin(T * 4.7); p.earRot += 0.1; }
      if (this.mode === 'mascot') this.catchPose(p, T);
      // look-at: the pointer (or lookAt) for a few seconds, else a kept direction (lookToward); while pointing
      // at something (a held point with a kept direction) the eyes stay on the target, not on the pointer
      const aiming = isPoint(this.holdName) && this.lookDir;
      const pointed = !aiming && this.cur.look && this.look && T < this.look.until && this.hit;
      const [tx, ty, tt, tp] = pointed ? this.lookTarget(this.look.x - this.hit.hx, this.look.y - this.hit.hy, lerp(Math.max(120, this.hit.hr * 6), Math.max(40, this.hit.hr * 2.2), this.hunt.I)) : this.cur.look && this.lookDir ? this.lookTarget(this.lookDir[0], this.lookDir[1], 1) : [0, 0, 0, 0];
      const k = 1 - Math.exp(-dt * 5);
      this.lk.x = lerp(this.lk.x, tx, k); this.lk.y = lerp(this.lk.y, ty, k); this.lk.turn = lerp(this.lk.turn, tt, k); this.lk.pitch = lerp(this.lk.pitch, tp, k);
      p.lookX += this.lk.x * 0.9; p.lookY += this.lk.y * 0.8; p.lookTurn += this.lk.turn; p.headPitch += this.lk.pitch;
      // a click while asleep: purr and flick an ear in place, no getting up
      const sp = (T - this.sleepPet) / 2.6;
      if (sp >= 0 && sp < 1) { const e = env(sp, 0, 0.08, 0.75, 1); p.purr = Math.max(p.purr, e); p.smile = lerp(p.smile, 0.85, e); p.blush = lerp(p.blush, 1, e); p.earR -= 0.6 * env(sp, 0.05, 0.1, 0.16, 0.22); p.tailTip += 14 * e * Math.sin(T * 3); p.nfa += 0.2 * e; }
      // breathing + purr
      const sl = p.zzz > 0.5;
      p.bodyR *= 1 + (sl ? 0.045 : 0.015) * Math.sin((TAU * T) / (sl ? 4.2 : 3.1)); // asleep: slow and visible
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
    } else if (this.still) {
      // still / reduced motion: a held gesture (pointing at an element, peering) and a kept look direction stay
      // as one static pose, so the "look here" cue survives; nothing moves
      if (this.holdName) { const n = this.holdName, d = GDUR[n] || 1.6; GEST[n](p, 0.5, d * 0.5, this.gctx(this.lastBase || p)); }
      if (this.cur && this.cur.look && this.lookDir) {
        const [tx, ty, tt, tp] = this.lookTarget(this.lookDir[0], this.lookDir[1], 1);
        this.lk = { x: tx, y: ty, turn: tt, pitch: tp };
        p.lookX += tx * 0.9; p.lookY += ty * 0.8; p.lookTurn += tt; p.headPitch += tp;
      } else if (this.laserPt && this.hit && this.mode === 'mascot') { // still: only the eyes follow the laser dot
        const [tx, ty] = this.lookTarget(this.laserPt.x - this.hit.hx, this.laserPt.y - this.hit.hy, Math.max(40, this.hit.hr * 2.2));
        p.lookX += tx * 0.9; p.lookY += ty * 0.8;
      } else if (this.ptrNear && this.ptr && !this.ptr.gone && this.hit && this.mode === 'mascot') {
        // still: only the eyes follow a pointer near by (no head turn, nothing else moves)
        const [tx, ty] = this.lookTarget(this.ptr.x - this.hit.hx, this.ptr.y - this.hit.hy, Math.max(40, this.hit.hr * 2.2));
        p.lookX += tx * 0.9; p.lookY += ty * 0.8;
      }
      p.lid = Math.max(p.lid, this.stillLid);
    }
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
  // eye and head targets for a screen offset (dx, dy) over a range r: [lookX, lookY, lookTurn, headPitch]
  lookTarget(dx, dy, r) {
    let tx = clamp(dx / r, -1, 1);
    const ty = clamp(dy / r, -1, 1), tt = -tx * 0.42 * (this.facing === 'left' ? -1 : 1), tp = ty * 0.3;
    if (this.facing === 'left') tx = -tx;
    return [tx, ty, tt, tp];
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
    const [ax0, ay0] = tagAnchor(R.o), rr = p.headRoll * D2R, hs = p.headScale * HS;
    const ax = R.head[0] + (ax0 * Math.cos(rr) - ay0 * Math.sin(rr)) * hs, ay = R.head[1] + (ax0 * Math.sin(rr) + ay0 * Math.cos(rr)) * hs;
    const m = this.facing === 'left' ? -1 : 1;
    return { wx: (this.mode === 'roam' ? p.x : (p.mx || 0) * m) + ax * m, hang: -rr, room: -p.gy - ay };
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
    // mascot: an act's frame (p.mx, p.zoom; Cat.fitAct) shifts and scales the cat in its box
    const g = this.g, d = this.dpr, mascot = this.mode === 'mascot', mir = this.facing === 'left' && mascot, s0 = this.s, s = mascot ? s0 * (p.zoom || 1) : s0;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.cv.width, this.cv.height);
    if (this.mode === 'roam') this.drawScene(g);
    const R = solve(p, this.timeT), mxo = mascot ? this.ox + (p.mx || 0) * s0 : 0;
    const ox = mascot ? (mir ? this.W - mxo : mxo) : p.x * s, oy = this.mode === 'roam' ? this.floor : this.oy;
    const tg = this.tagGeo(p, R);
    if (live && !this.still && this.dt) this.tagStep(tg, this.dt);
    else if (live) { this.tagA = tg.hang; this.tagW = 0; this.tagP = null; }
    const tagS = this.lod ? 1.55 : 1, tagLen = 13 * tagS * p.headScale * HS;
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
    const st = { ow: Math.max(0.85, 0.62 / s) * (this.lod ? 1.3 : 1), px: s * d, lod: this.lod, eyeS: this.lod ? 1.2 : 1 + 0.1 * clamp((1.6 - s) / 0.7), tagS, tagSq, mirror: mir,
      kit: this.kit, tex: !this.lod && s * d >= 1.4, rimD: 1, small: clamp((1.6 - s) / 0.7),
      top: this.mode === 'mascot' ? -oy / s : -Infinity, cap: this.cap,
      T: this.timeT, tagA, glint: this.glint, spark: this.spark, shadowA: THEME.shadowA, ink: THEME.ink, contact,
      confetti: this.fx ? this.fx.confetti : 0, think: this.fx ? this.fx.think : 0, surprise: this.fx ? this.fx.surprise : 0 };
    // the act's toy on the floor and the laser dot, in act units (the act's own frame, not the cat's moving root)
    const F = B && B.fit;
    if (mascot && F && (B.toy || B.L)) {
      const ts = s0 * F.z, xo = this.ox + F.mx * s0, a = mir ? -d * ts : d * ts, e = d * (mir ? this.W - xo : xo), f = d * oy;
      const toy = B.toy ? B.toy(this.actT) : null, L = B.L;
      if (toy && toy.a > 0.01) st[toy.under ? 'under' : toy.carry ? 'toyOver' : 'mid'] = () => { g.save(); g.setTransform(a, 0, 0, d * ts, e, f); TOY_DRAW[toy.kind](g, toy, st); g.restore(); };
      if (L && L.tgt && L.lost < 0.2) st.over = () => { g.save(); g.setTransform(a, 0, 0, d * ts, e, f); drawLaserDot(g, L.tgt.x, -L.tgt.y, L.lost < 0 ? 1 : 1 - L.lost / 0.2, Math.max(1, 2.2 / ts)); g.restore(); };
    }
    LINE = lerp(1.8, 1.45, clamp((s - 0.9) / 0.7)); DARK = this.dark;
    drawCat(g, R, p, st);
    if (this.bust && this.fade) { g.setTransform(d * this.W * 0.6, 0, 0, d * this.H * 0.66, d * this.W / 2, d * this.H * 0.4); g.globalCompositeOperation = 'destination-in'; g.fillStyle = this.fade; g.fillRect(-2, -2, 4, 4); g.globalCompositeOperation = 'source-over'; }
    // hit box (stage px): torso and head for pokes, the full extent for framing
    const sx = mir ? -s : s, X = (u) => ox + u * sx;
    let tx0 = 1e9, tx1 = -1e9, bx0 = 1e9, bx1 = -1e9, by0 = R.head[1] - 34 * HS, by1 = -p.gy + 2;
    for (const t of R.torso) { tx0 = Math.min(tx0, t[0] - t[2]); tx1 = Math.max(tx1, t[0] + t[2]); }
    bx0 = Math.min(tx0, R.head[0] - 26 * HS); bx1 = Math.max(tx1, R.head[0] + 26 * HS);
    for (const t of R.tail) { bx0 = Math.min(bx0, t[0] - t[2]); bx1 = Math.max(bx1, t[0] + t[2]); by0 = Math.min(by0, t[1] - t[2]); }
    for (const L of R.legs) { bx0 = Math.min(bx0, L.P[0] - 7); bx1 = Math.max(bx1, L.P[0] + 7); by0 = Math.min(by0, L.P[1] - 7); }
    const hx = X(R.head[0]);
    this.hit = { hx, hy: oy + R.head[1] * s, hr: 24 * HS * s, x0: Math.min(X(tx0), X(tx1)), x1: Math.max(X(tx0), X(tx1)), y0: oy + (R.head[1] - 30 * HS) * s, y1: oy + by1 * s,
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
  bindMascot() { // the pointer itself comes from the shared listener (onPointer)
    this.on(this.el, 'pointerdown', () => this.poke());
  }
  /* ---------- public API ---------- */
  do(name, o = {}) {
    if (!BEH[name]) return false;
    this.lastInteract = this.clock;
    if (name === 'jump') { this.jump(o); return true; } // jump() keeps a still cat still
    if (name === 'run' && o.distancePx) { this.run(o); return true; } // without a distance: a gallop on the spot
    if (!actAllowed(name, this.still || reducedMotion() ? 'still' : calmMotion() ? 'calm' : 'full')) return false;
    if (this.frozen) this.resume();
    if (this.still && !reducedMotion()) this.setStill(false);
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
  // level scales the mouth (1 = full voice, lower for a whisper)
  setTalking(b, level = 1) { if (b) this.lastInteract = this.clock; this.talking = !!b; this.talkLevel = clamp(+level || 0, 0, 1); this.dirty = true; kick(); }
  newGest(n, hold) { return { name: n, t0: this.clock, dur: GDUR[n] || 1.6, ctx: this.gctx(this.lastBase || sitBase(this)), hold }; }
  // keeps the pose of the gesture being replaced for a short cross-fade
  fadeFrom() {
    const g = this.gest; if (!g) return;
    const u = (this.clock - g.t0) / g.dur;
    if (!g.hold && u >= 1) return;
    this.gFade = { name: g.name, u: g.hold ? Math.min(u, 0.5) : u, tl: this.clock - g.t0, ctx: g.ctx, t0: this.clock };
  }
  play(gname) {
    if (gname === 'mouse' || gname === 'yarn') return this.do(gname); // a toy to play with
    const n = GALIAS[gname] || gname; if (!GEST[n] || n[0] === '_') return false;
    this.lastInteract = this.clock;
    if (this.frozen) this.resume();
    if (this.still) return false;
    if (isPoint(n) && isPoint(this.holdName)) return false; // a held point keeps its target: no pointing elsewhere
    this.fadeFrom();
    this.gest = this.newGest(n, false);
    kick();
    return true;
  }
  // Keeps a gesture at its peak (pointing at an element, peering) until hold(null) lowers it; a one-shot
  // play() can interrupt it, and the held pose comes back when that gesture ends. A point replaces a
  // running point at once (cross-faded, already at its peak): the held aim is the real target, so a
  // beat's own point gesture, whose aim arrives a frame later, never points the other way first.
  hold(gname) {
    const n = gname ? GALIAS[gname] || gname : null;
    if (n && (!GEST[n] || n[0] === '_')) return false;
    if (n === this.holdName) return true;
    const g = this.gest;
    if (g && isPoint(n) && isPoint(g.name)) { this.fadeFrom(); this.gest = this.newGest(n, true); this.gest.t0 -= this.gest.dur * 0.5; }
    else if (g && g.hold) { g.hold = false; if (this.clock - g.t0 > g.dur * 0.5) g.t0 = this.clock - g.dur * 0.5; }
    this.holdName = n; this.dirty = true;
    kick();
    return true;
  }
  lookAt(x, y) { const r = this.el.getBoundingClientRect(); this.look = { x: x - r.left, y: y - r.top, until: this.clock + 3 }; kick(); }
  // Keeps looking in a screen direction (x, y in -1..1, y down) whenever no pointer look is on; null looks ahead.
  lookToward(x, y) { this.lookDir = x == null ? null : [+x || 0, +y || 0]; this.dirty = true; kick(); }
  poke() {
    if (this.frozen) this.resume();
    if (this.still) return;
    this.hunt.cool = this.clock + 2.2; // petting wins over batting at the hand that pets
    this.lastInteract = this.clock;
    if (this.cur && (this.cur.doze || (this.cur.name === 'sleep' && this.curled()))) { this.sleepPet = this.clock; kick(); return; }
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
    if (fz.B.sim) fz.B.sim(tb);
    this.actT = tb;
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
    if (this.mom) this.mom.fire('end');
    for (const [t, ty, fn, o] of this._ls) t.removeEventListener(ty, fn, o);
    const i = INST.indexOf(this); if (i >= 0) INST.splice(i, 1);
    this.cv.remove(); delete this.el.catInstance;
  }
}

/* ============================ exports ============================ */
// The names the public API accepts (the React wrapper maps its props onto these; tests check the mapping).
export const MOOD_NAMES = Object.keys(MOODS);
export const GESTURE_NAMES = Object.keys(GEST).filter((n) => n[0] !== '_');
export const BEHAVIOUR_NAMES = ['sit', 'walk', 'turn', 'trot', 'rub', 'groom', 'sleep', 'wake', 'stretch', 'yawn', 'chase', 'pet', 'knead', 'look', 'flick', 'present', 'jump',
  'doze', 'blink', 'tilt', 'run', 'mouse', 'yarn', 'laser', 'chase-tail', 'roll', 'pounce'];
// Pure maths for tests/mascot-cat.test.ts: the pointer catching, the auto scheduler and motion gating, the toys, the
// laser logic, the run's box offset, the gait planner and the leap's timing and arc.
export { catchZone, reachTarget, SWAT as SWAT_PHASES, mascotAutoWeights, actAllowed, toyX, laserState, laserStep, runProgress, planLeg, GAITS, LEAP, leapProg, leapLift };

export function createCat(el, opts) { return new Cat(el, opts || {}); }
