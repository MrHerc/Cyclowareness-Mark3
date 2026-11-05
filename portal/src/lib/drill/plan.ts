/**
 * Live drill planner (pure, no I/O). Given the audience of a phishing simulation, it plans what each
 * person does in the first hours after delivery (open, click, enter a password, report, finish the
 * training the click assigned) and when, then maps that simulated timeline onto a short real-time
 * playback. The server applies the events through the real services (src/server/services/drill.ts);
 * this file only decides them, deterministically from a seed, so a drill can be replayed and tested.
 *
 * Calibration (documented in docs/DEMO.md):
 * - Untrained baseline click rate: 33.2 % (KnowBe4, Phishing by Industry Benchmarking Report 2026).
 *   People with a lower risk score click less, so a trained organisation lands below it.
 * - Speed: the median person clicks 21 s after opening and enters data 28 s later (Verizon DBIR 2024).
 */

export const DRILL_SIM_MINUTES = 240;

/** Real playback lengths a presenter can pick. */
export const DRILL_SPEEDS = { quick: 90_000, standard: 180_000 } as const;
export type DrillSpeed = keyof typeof DRILL_SPEEDS;

/** Untrained baseline click rate in percent, shown next to the drill's own (see the header). */
export const INDUSTRY_BASELINE_CLICK = 33;

/** Real milliseconds before the first and after the last simulated minute (sending, then the wrap-up). */
export const DRILL_LEAD_MS = 1_500;
export const DRILL_TAIL_MS = 2_500;

export const DRILL_KINDS = ["deliver", "open", "click", "submit", "report", "train"] as const;
export type DrillKind = (typeof DRILL_KINDS)[number];

export type DrillEvent = {
  /** Milliseconds after the start, in real time. */
  at: number;
  /** Simulated minutes after delivery. */
  sim: number;
  kind: DrillKind;
  recipientId: string;
  userId: string;
};

export type DrillPerson = { userId: string; recipientId: string; risk: number };
export type DrillTemplateTraits = { channel: "email" | "sms" | "voice" | "usb"; difficulty: "Easy" | "Medium" | "Hard"; harvest: boolean };

/** Chance that an average person (risk 50) clicks once they opened it, by how hard the lure is to spot. */
const BASE_CLICK: Record<DrillTemplateTraits["difficulty"], number> = { Easy: 0.22, Medium: 0.32, Hard: 0.44 };

/** Deterministic PRNG (mulberry32): the same seed always plans the same drill. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A 32-bit seed from a string (FNV-1a), e.g. the drill's id. */
export function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Exponentially distributed delay with the given mean (minutes). */
function expo(rnd: () => number, mean: number): number {
  return -Math.log(1 - Math.min(rnd(), 0.999999)) * mean;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * The playback clock is warped: real time follows 1 − e^(−t/τ) of simulated time t. Clicks and reports
 * cluster in the first minutes after delivery and trainings follow within the hour, so those minutes
 * play in slow motion and the quiet later hours speed up, which keeps the whole playback busy.
 */
export const DRILL_WARP_TAU = 40;

function warp(sim: number, simMinutes: number): number {
  return (1 - Math.exp(-Math.max(0, Math.min(simMinutes, sim)) / DRILL_WARP_TAU)) / (1 - Math.exp(-simMinutes / DRILL_WARP_TAU));
}

/** Real milliseconds after the start for a simulated minute. */
export function simToMs(sim: number, durationMs: number, simMinutes = DRILL_SIM_MINUTES): number {
  const span = Math.max(1, durationMs - DRILL_LEAD_MS - DRILL_TAIL_MS);
  return Math.round(DRILL_LEAD_MS + warp(sim, simMinutes) * span);
}

/** Simulated minute shown at `elapsedMs` real milliseconds after the start (0 during the lead-in, capped at the end). */
export function msToSim(elapsedMs: number, durationMs: number, simMinutes = DRILL_SIM_MINUTES): number {
  const span = Math.max(1, durationMs - DRILL_LEAD_MS - DRILL_TAIL_MS);
  const frac = clamp01((elapsedMs - DRILL_LEAD_MS) / span);
  return Math.min(simMinutes, -DRILL_WARP_TAU * Math.log(1 - frac * (1 - Math.exp(-simMinutes / DRILL_WARP_TAU))));
}

type Plan = { deliver: number; open?: number; click?: number; submit?: number; report?: number; train?: number };

/**
 * Plans the drill. Every person gets the message within the first minutes; the rest depends on their
 * risk score (0 = careful, 100 = risky) and the template. The story always has at least one click,
 * one report and one finished training when the audience allows it, so a demo never stays empty.
 */
export function planDrill(
  people: DrillPerson[],
  template: DrillTemplateTraits,
  opts: { seed: number; durationMs: number; simMinutes?: number },
): DrillEvent[] {
  const simMinutes = opts.simMinutes ?? DRILL_SIM_MINUTES;
  const last = simMinutes - 2;
  const rnd = prng(opts.seed);
  const openChance = template.channel === "sms" ? 0.95 : 0.86;
  const base = BASE_CLICK[template.difficulty];
  const plans = people.map((p): Plan => {
    const f = clamp01(p.risk / 100);
    const plan: Plan = { deliver: rnd() * 3 };
    if (rnd() >= openChance) return plan;
    plan.open = plan.deliver + 0.5 + expo(rnd, 26);
    if (plan.open > last) return { deliver: plan.deliver };
    if (rnd() < Math.min(0.85, base * (0.45 + 1.1 * f))) {
      plan.click = plan.open + 0.15 + expo(rnd, 0.5);
      if (template.harvest && rnd() < 0.45 + 0.3 * f) plan.submit = plan.click + 0.2 + expo(rnd, 0.45);
      // Some people realise what they did and report it anyway: the behaviour a programme wants.
      if (rnd() < 0.3) plan.report = (plan.submit ?? plan.click) + 2 + expo(rnd, 6);
      if (rnd() < 0.55 + 0.35 * (1 - f)) plan.train = plan.click + 12 + expo(rnd, 40);
    } else if (rnd() < 0.18 + 0.5 * (1 - f)) {
      plan.report = plan.open + 1 + expo(rnd, 9);
    }
    return plan;
  });

  // A demo always shows the three moments it is about (when the audience allows it).
  const order = people.map((p, i) => ({ i, risk: p.risk }));
  const openers = order.filter(({ i }) => plans[i].open !== undefined);
  if (openers.length && !plans.some((p) => p.click !== undefined)) {
    const { i } = [...openers].sort((a, b) => b.risk - a.risk)[0];
    plans[i].click = plans[i].open! + 0.4;
    plans[i].report = undefined;
  }
  if (openers.length > 1 && !plans.some((p) => p.report !== undefined)) {
    const careful = [...openers].sort((a, b) => a.risk - b.risk).find(({ i }) => plans[i].click === undefined);
    if (careful) plans[careful.i].report = plans[careful.i].open! + 1.5;
  }
  if (!plans.some((p) => p.train !== undefined && p.train <= last)) {
    const clicker = order.filter(({ i }) => plans[i].click !== undefined).sort((a, b) => plans[a.i].click! - plans[b.i].click!)[0];
    if (clicker) plans[clicker.i].train = Math.min(last, plans[clicker.i].click! + 30);
  }

  const events: DrillEvent[] = [];
  people.forEach((p, i) => {
    const plan = plans[i];
    for (const kind of DRILL_KINDS) {
      const sim = plan[kind];
      // Whatever falls after the simulated window has not happened yet when the drill ends.
      if (sim === undefined || sim > last) continue;
      events.push({ at: simToMs(sim, opts.durationMs, simMinutes), sim: Math.round(sim * 100) / 100, kind, recipientId: p.recipientId, userId: p.userId });
    }
  });
  const rank = (k: DrillKind) => DRILL_KINDS.indexOf(k);
  return events.sort((a, b) => a.at - b.at || a.sim - b.sim || rank(a.kind) - rank(b.kind) || a.recipientId.localeCompare(b.recipientId));
}

/* ───────── progress (what the dashboard shows after N applied events) ───────── */

export type DrillOutcome = "pending" | "delivered" | "opened" | "clicked" | "submitted" | "reported";

export type DrillPersonState = { outcome: DrillOutcome; reported: boolean; trained: boolean };

export type DrillTotals = { audience: number; delivered: number; opened: number; clicked: number; submitted: number; reported: number; trained: number };

export type DrillProgress = {
  people: Map<string, DrillPersonState>;
  totals: DrillTotals;
  /** Simulated minute of the first click and of the first report (null until they happen). */
  firstClick: number | null;
  firstReport: number | null;
};

const OUTCOME_RANK: Record<DrillOutcome, number> = { pending: 0, delivered: 1, opened: 2, reported: 3, clicked: 4, submitted: 5 };

/** The state after the first `applied` events, for an audience of `recipientIds`. */
export function drillProgress(events: DrillEvent[], applied: number, recipientIds: string[]): DrillProgress {
  const people = new Map<string, DrillPersonState>(recipientIds.map((id) => [id, { outcome: "pending", reported: false, trained: false }]));
  const totals: DrillTotals = { audience: recipientIds.length, delivered: 0, opened: 0, clicked: 0, submitted: 0, reported: 0, trained: 0 };
  let firstClick: number | null = null;
  let firstReport: number | null = null;
  for (const e of events.slice(0, Math.max(0, applied))) {
    const s = people.get(e.recipientId);
    if (!s) continue;
    const raise = (o: DrillOutcome) => {
      if (OUTCOME_RANK[o] > OUTCOME_RANK[s.outcome]) s.outcome = o;
    };
    if (e.kind === "deliver") {
      totals.delivered++;
      raise("delivered");
    } else if (e.kind === "open") {
      totals.opened++;
      raise("opened");
    } else if (e.kind === "click") {
      totals.clicked++;
      raise("clicked");
      firstClick ??= e.sim;
    } else if (e.kind === "submit") {
      totals.submitted++;
      raise("submitted");
    } else if (e.kind === "report") {
      totals.reported++;
      s.reported = true;
      raise("reported");
      firstReport ??= e.sim;
    } else if (e.kind === "train") {
      totals.trained++;
      s.trained = true;
    }
  }
  return { people, totals, firstClick, firstReport };
}

/** Percent of `part` in `whole`, rounded; 0 when there is nothing to divide by. */
export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
