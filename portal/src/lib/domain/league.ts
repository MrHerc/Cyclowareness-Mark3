/** Department league: score = 60 % assigned completion + 40 % simulation reporting. */

import { todayInBaku } from "@/lib/time";

export type DepartmentStats = {
  id: string;
  name: string;
  learners: number;
  completion: number; // 0–100
  reportRate: number; // 0–100
};

export type LeagueRow = DepartmentStats & { place: number; points: number; toNext: number | null };

export function leagueScore(completion: number, reportRate: number): number {
  return Math.round(completion * 0.6 + reportRate * 0.4);
}

/** `locale`: the collation of the name tie-break (the organisation's language), so Ə, Ç, Ş sort where its readers expect them. */
export function rankLeague(rows: DepartmentStats[], locale?: string): LeagueRow[] {
  const scored = rows
    .filter((r) => r.learners > 0)
    .map((r) => ({ ...r, points: leagueScore(r.completion, r.reportRate) }))
    .sort((a, b) => b.points - a.points || b.completion - a.completion || a.name.localeCompare(b.name, locale));
  return scored.map((r, i) => ({
    ...r,
    place: i + 1,
    toNext: i === 0 ? null : Math.max(1, scored[i - 1].points - r.points),
  }));
}

/**
 * Days left in the month, counting today. The month and today are Baku's (like every day in the UI),
 * not the server's local ones, so from 00:00 to 04:00 Baku on the 1st it already counts the new month.
 */
export function daysLeftInMonth(now: Date): number {
  const [year, month, day] = todayInBaku(now).split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return lastDay - day + 1;
}

export type LeagueTrend = "up" | "down" | "same";

export type LeagueRowWithTrend = LeagueRow & { trend: LeagueTrend };

/** Movement since an earlier ranking: a smaller place number is "up". A department without an earlier place is "same". */
export function leagueTrend(place: number, previousPlace: number | null | undefined): LeagueTrend {
  if (previousPlace == null || previousPlace === place) return "same";
  return place < previousPlace ? "up" : "down";
}

/** Adds the trend of every row against the places in `previous` (same ids). */
export function withTrend(rows: LeagueRow[], previous: LeagueRow[]): LeagueRowWithTrend[] {
  const before = new Map(previous.map((r) => [r.id, r.place]));
  return rows.map((r) => ({ ...r, trend: leagueTrend(r.place, before.get(r.id)) }));
}
