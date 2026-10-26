/**
 * XP, levels, streaks and badges. Pure functions shared by the app, the seed and tests.
 * Level thresholds reproduce the original: 175 XP is level 2 at 50 %.
 */

export const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000, 5000, 6200, 7600, 9200, 11000];

export function levelFor(xp: number): { level: number; progress: number; current: number; next: number | null } {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  const current = LEVEL_THRESHOLDS[level - 1];
  const next = LEVEL_THRESHOLDS[level] ?? null;
  const progress = next === null ? 1 : (xp - current) / (next - current);
  return { level, progress: Math.max(0, Math.min(1, progress)), current, next };
}

/** XP for one lesson: the module's XP split across its lessons; the remainder goes to the last lesson. */
export function lessonXp(moduleXp: number, lessonCount: number, position: number): number {
  const base = Math.floor(moduleXp / lessonCount);
  return position === lessonCount - 1 ? moduleXp - base * (lessonCount - 1) : base;
}

export const REPORT_BONUS_XP = 5;
export const REPORT_BONUS_DAILY_CAP = 5;
export const LAB_XP: Record<string, number> = { "inbox-triage": 20, "link-detective": 15, "password-forge": 15, "mfa-fatigue": 15, "phishing-anatomy": 30, "process-hunt": 30, "fake-signin": 25 };

/** ISO day (YYYY-MM-DD) in the organisation's time zone. */
export function dayKey(date: Date, timeZone = "Asia/Baku"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function previousDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** A learner holds at most this many unused streak freezes. */
export const MAX_STREAK_FREEZES = 2;
/** Every 7 consecutive days earn one freeze. */
export const FREEZE_EVERY_DAYS = 7;

type StreakState = { current: number; longest: number; lastDay: string | null };

/** The streak survives a single missed day while a freeze is available (it is spent on the next active day). */
function frozen(lastDay: string | null, today: string, freezes: number): boolean {
  return freezes > 0 && lastDay === previousDay(previousDay(today));
}

/**
 * Updates the streak after earning XP today. With `freezes`, a single missed day spends one freeze
 * instead of breaking the streak, and every 7 consecutive days earn one (at most 2 in hand).
 */
export function nextStreak(state: StreakState, today: string): { current: number; longest: number; lastDay: string };
export function nextStreak(state: StreakState, today: string, freezes: number): { current: number; longest: number; lastDay: string; freezes: number };
export function nextStreak(state: StreakState, today: string, freezes?: number): { current: number; longest: number; lastDay: string; freezes?: number } {
  const have = freezes ?? 0;
  if (state.lastDay === today) return { current: state.current, longest: state.longest, lastDay: today, ...(freezes === undefined ? {} : { freezes }) };
  const spend = frozen(state.lastDay, today, have);
  const current = state.lastDay === previousDay(today) || spend ? state.current + 1 : 1;
  const base = { current, longest: Math.max(state.longest, current), lastDay: today };
  if (freezes === undefined) return base;
  let left = spend ? have - 1 : have;
  if (current % FREEZE_EVERY_DAYS === 0) left = Math.min(MAX_STREAK_FREEZES, left + 1);
  return { ...base, freezes: left };
}

/** A streak only counts while it is unbroken: yesterday or today must have activity (or a freeze covers the one missed day). */
export function liveStreak(current: number, lastDay: string | null, today: string, freezes = 0): number {
  if (!lastDay) return 0;
  return lastDay === today || lastDay === previousDay(today) || frozen(lastDay, today, freezes) ? current : 0;
}

export const BADGES = [
  "first_step",
  "module_master",
  "sharp_eye",
  "streak_7",
  "policy_keeper",
  "lab_explorer",
  "certified_5",
  "path_finisher",
] as const;
export type Badge = (typeof BADGES)[number];

export type BadgeFacts = {
  lessonsCompleted: number;
  modulesCompleted: number;
  reports: number;
  longestStreak: number;
  policiesToSign: number;
  policiesSigned: number;
  labGamesPlayed: number;
  certificates: number;
  pathsCompleted: number;
};

export function earnedBadges(f: BadgeFacts): Badge[] {
  const out: Badge[] = [];
  if (f.lessonsCompleted >= 1) out.push("first_step");
  if (f.modulesCompleted >= 1) out.push("module_master");
  if (f.reports >= 5) out.push("sharp_eye");
  if (f.longestStreak >= 7) out.push("streak_7");
  if (f.policiesSigned > 0 && f.policiesToSign === 0) out.push("policy_keeper");
  if (f.labGamesPlayed >= 4) out.push("lab_explorer");
  if (f.certificates >= 5) out.push("certified_5");
  if (f.pathsCompleted >= 1) out.push("path_finisher");
  return out;
}
