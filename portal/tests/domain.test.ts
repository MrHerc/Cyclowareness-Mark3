import { describe, expect, it } from "vitest";
import { riskBand, riskScore, type RiskBand, type RiskInputs } from "@/lib/domain/risk";
import {
  BADGES,
  FREEZE_EVERY_DAYS,
  LAB_XP,
  LEVEL_THRESHOLDS,
  MAX_STREAK_FREEZES,
  REPORT_BONUS_DAILY_CAP,
  REPORT_BONUS_XP,
  dayKey,
  earnedBadges,
  lessonXp,
  levelFor,
  liveStreak,
  nextStreak,
  type Badge,
  type BadgeFacts,
} from "@/lib/domain/gamification";
import { daysLeftInMonth, leagueScore, leagueTrend, rankLeague, withTrend, type DepartmentStats } from "@/lib/domain/league";
import { AUDIENCES, CATEGORIES, CATEGORY_FROM_LABEL, CATEGORY_TOPIC, isCategory } from "@/lib/domain/catalog";

/** A learner with nothing to hold against them: every part of the score is 0. */
const clean: RiskInputs = {
  assignedCompletion: 1,
  overdueAssignments: 0,
  simClicks: 0,
  simSubmits: 0,
  simReports: 0,
  lessonRiskyChoices: 0,
  openRisks: [],
  firstTryRate: 1,
};

function risk(overrides: Partial<RiskInputs> = {}) {
  return riskScore({ ...clean, ...overrides });
}

describe("riskScore", () => {
  it("is 0 with every part at 0 for a clean learner", () => {
    expect(risk()).toEqual({ score: 0, parts: { training: 0, overdue: 0, simulations: 0, openRisks: 0, knowledge: 0 } });
  });

  it("charges full training and knowledge weight for literal zero rates", () => {
    const r = risk({ assignedCompletion: 0, firstTryRate: 0 });
    expect(r.parts).toEqual({ training: 30, overdue: 0, simulations: 0, openRisks: 0, knowledge: 16 });
    expect(r.score).toBe(46);
  });

  it("defaults null assignedCompletion to 8 training points", () => {
    expect(risk({ assignedCompletion: null }).parts.training).toBe(8);
  });

  it("defaults null firstTryRate to 8 knowledge points", () => {
    expect(risk({ firstTryRate: null }).parts.knowledge).toBe(8);
  });

  it("scores 16 when both rates are unknown and nothing else counts", () => {
    expect(risk({ assignedCompletion: null, firstTryRate: null }).score).toBe(16);
  });

  it("scales training with the share of assigned lessons left, capped at 30", () => {
    expect(risk({ assignedCompletion: 0.9 }).parts.training).toBe(3);
    expect(risk({ assignedCompletion: 0.5 }).parts.training).toBe(15);
    expect(risk({ assignedCompletion: 0 }).parts.training).toBe(30);
  });

  it("charges 5 per overdue assignment, capped at 10", () => {
    expect(risk({ overdueAssignments: 1 }).parts.overdue).toBe(5);
    expect(risk({ overdueAssignments: 2 }).parts.overdue).toBe(10);
    expect(risk({ overdueAssignments: 7 }).parts.overdue).toBe(10);
  });

  it("weights simulation events 12 per click, 18 per submit, 2 per risky lesson choice", () => {
    expect(risk({ simClicks: 1 }).parts.simulations).toBe(12);
    expect(risk({ simSubmits: 1 }).parts.simulations).toBe(18);
    expect(risk({ lessonRiskyChoices: 3 }).parts.simulations).toBe(6);
    expect(risk({ simClicks: 1, simSubmits: 1, lessonRiskyChoices: 2 }).parts.simulations).toBe(34);
  });

  it("caps simulations at 35", () => {
    expect(risk({ simClicks: 3 }).parts.simulations).toBe(35);
    expect(risk({ simSubmits: 2 }).parts.simulations).toBe(35);
    expect(risk({ simClicks: 10, simSubmits: 10, lessonRiskyChoices: 10 }).parts.simulations).toBe(35);
  });

  it("lets each report take 6 off the simulation part", () => {
    expect(risk({ simClicks: 1, simReports: 1 }).parts.simulations).toBe(6);
    expect(risk({ simSubmits: 1, simReports: 2 }).parts.simulations).toBe(6);
  });

  it("never lets reports push simulations below 0", () => {
    expect(risk({ simClicks: 1, simReports: 2 }).parts.simulations).toBe(0);
    const r = risk({ simReports: 1000 });
    expect(r.parts.simulations).toBe(0);
    expect(r.score).toBe(0);
  });

  it("does not let reports offset the other parts", () => {
    const r = risk({ simReports: 10, overdueAssignments: 1 });
    expect(r.parts).toMatchObject({ simulations: 0, overdue: 5 });
    expect(r.score).toBe(5);
  });

  it("weights open risks by severity: low 4, medium 8, high 14, critical 20", () => {
    expect(risk({ openRisks: ["low"] }).parts.openRisks).toBe(4);
    expect(risk({ openRisks: ["medium"] }).parts.openRisks).toBe(8);
    expect(risk({ openRisks: ["high"] }).parts.openRisks).toBe(14);
    expect(risk({ openRisks: ["critical"] }).parts.openRisks).toBe(20);
    expect(risk({ openRisks: ["low", "high"] }).parts.openRisks).toBe(18);
  });

  it("caps open risks at 30", () => {
    expect(risk({ openRisks: ["critical", "critical"] }).parts.openRisks).toBe(30);
    expect(risk({ openRisks: ["low", "medium", "high", "critical"] }).parts.openRisks).toBe(30);
    expect(risk({ openRisks: Array.from({ length: 50 }, () => "critical" as const) }).parts.openRisks).toBe(30);
  });

  it("scales knowledge with the first-try miss rate, capped at 16", () => {
    expect(risk({ firstTryRate: 0.75 }).parts.knowledge).toBe(4);
    expect(risk({ firstTryRate: 0.5 }).parts.knowledge).toBe(8);
    expect(risk({ firstTryRate: 0 }).parts.knowledge).toBe(16);
  });

  it("sums the parts into the score while under 100", () => {
    const r = risk({ assignedCompletion: 0.5, overdueAssignments: 1, simClicks: 1, openRisks: ["high"], firstTryRate: 0.5 });
    expect(r.parts).toEqual({ training: 15, overdue: 5, simulations: 12, openRisks: 14, knowledge: 8 });
    const { training, overdue, simulations, openRisks, knowledge } = r.parts;
    expect(r.score).toBe(54);
    expect(r.score).toBe(training + overdue + simulations + openRisks + knowledge);
  });

  it("clamps the total to 100 while keeping the parts explainable", () => {
    const r = risk({ assignedCompletion: 0, overdueAssignments: 5, simClicks: 5, openRisks: ["critical", "critical"], firstTryRate: 0 });
    expect(r.parts).toEqual({ training: 30, overdue: 10, simulations: 35, openRisks: 30, knowledge: 16 });
    expect(r.score).toBe(100);
  });
});

describe("riskBand", () => {
  const cases: [number, RiskBand][] = [
    [0, "low"],
    [33, "low"],
    [34, "medium"],
    [66, "medium"],
    [67, "high"],
    [100, "high"],
  ];

  it.each(cases)("bands %i as %s", (score, band) => {
    expect(riskBand(score)).toBe(band);
  });
});

describe("levelFor", () => {
  it("has 16 strictly ascending thresholds starting at 0", () => {
    expect(LEVEL_THRESHOLDS).toHaveLength(16);
    expect(LEVEL_THRESHOLDS[0]).toBe(0);
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) expect(LEVEL_THRESHOLDS[i]).toBeGreaterThan(LEVEL_THRESHOLDS[i - 1]);
  });

  it("starts at level 1 with 0 XP", () => {
    expect(levelFor(0)).toEqual({ level: 1, progress: 0, current: 0, next: 100 });
  });

  it.each([
    [99, 1],
    [100, 2],
    [249, 2],
    [250, 3],
    [449, 3],
    [450, 4],
    [699, 4],
    [700, 5],
  ])("puts %i XP at level %i", (xp, level) => {
    expect(levelFor(xp).level).toBe(level);
  });

  it("reaches every level exactly at its threshold and not one XP before", () => {
    LEVEL_THRESHOLDS.forEach((threshold, i) => {
      expect(levelFor(threshold).level, `at ${threshold}`).toBe(i + 1);
      if (i > 0) expect(levelFor(threshold - 1).level, `before ${threshold}`).toBe(i);
    });
  });

  it("reports progress inside the level: 175 XP is level 2 at 50 %", () => {
    expect(levelFor(175)).toEqual({ level: 2, progress: 0.5, current: 100, next: 250 });
  });

  it("reports progress 0 on a threshold and just under 1 before the next", () => {
    expect(levelFor(450).progress).toBe(0);
    expect(levelFor(699).progress).toBeCloseTo(249 / 250);
  });

  it("caps at level 16 with no next threshold and full progress", () => {
    expect(levelFor(11000)).toEqual({ level: 16, progress: 1, current: 11000, next: null });
    expect(levelFor(99999)).toEqual({ level: 16, progress: 1, current: 11000, next: null });
  });

  it("clamps negative XP to level 1 with 0 progress", () => {
    expect(levelFor(-50)).toEqual({ level: 1, progress: 0, current: 0, next: 100 });
  });
});

describe("lessonXp", () => {
  it("splits module XP evenly when it divides", () => {
    expect(lessonXp(100, 2, 0)).toBe(50);
    expect(lessonXp(100, 2, 1)).toBe(50);
  });

  it("gives the remainder to the last lesson", () => {
    expect(lessonXp(100, 3, 0)).toBe(33);
    expect(lessonXp(100, 3, 1)).toBe(33);
    expect(lessonXp(100, 3, 2)).toBe(34);
  });

  it("gives a single lesson the whole module", () => {
    expect(lessonXp(75, 1, 0)).toBe(75);
  });

  it("always sums back to the module XP", () => {
    const cases: [number, number][] = [
      [100, 3],
      [50, 4],
      [90, 7],
      [10, 3],
    ];
    for (const [moduleXp, count] of cases) {
      const total = Array.from({ length: count }, (_, p) => lessonXp(moduleXp, count, p)).reduce((a, b) => a + b, 0);
      expect(total, `${moduleXp} over ${count}`).toBe(moduleXp);
    }
  });
});

describe("XP constants", () => {
  it("pays 5 XP per report, capped at 5 reports a day", () => {
    expect(REPORT_BONUS_XP).toBe(5);
    expect(REPORT_BONUS_DAILY_CAP).toBe(5);
  });

  it("prices the four lab games and the three virtual-machine labs", () => {
    expect(LAB_XP).toEqual({ "inbox-triage": 20, "link-detective": 15, "password-forge": 15, "mfa-fatigue": 15, "phishing-anatomy": 30, "process-hunt": 30, "fake-signin": 25 });
  });
});

describe("dayKey", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(dayKey(new Date("2026-03-10T08:00:00Z"))).toBe("2026-03-10");
  });

  it("is already the next day in Asia/Baku (UTC+4) while UTC is still on the previous one", () => {
    const late = new Date("2026-03-10T21:00:00Z");
    expect(dayKey(late)).toBe("2026-03-11");
    expect(dayKey(late, "UTC")).toBe("2026-03-10");
  });

  it("switches exactly at 20:00 UTC", () => {
    expect(dayKey(new Date("2026-03-10T19:59:59Z"))).toBe("2026-03-10");
    expect(dayKey(new Date("2026-03-10T20:00:00Z"))).toBe("2026-03-11");
  });

  it("crosses month and year boundaries", () => {
    expect(dayKey(new Date("2025-12-31T20:30:00Z"))).toBe("2026-01-01");
  });

  it("honours an explicit time zone", () => {
    const t = new Date("2026-03-10T23:30:00Z");
    expect(dayKey(t, "America/New_York")).toBe("2026-03-10");
    expect(dayKey(t, "Asia/Tokyo")).toBe("2026-03-11");
  });
});

describe("nextStreak", () => {
  const today = "2026-03-11";

  it("starts a streak of 1 on the first active day", () => {
    expect(nextStreak({ current: 0, longest: 0, lastDay: null }, today)).toEqual({ current: 1, longest: 1, lastDay: today });
  });

  it("does not change on a second activity the same day", () => {
    expect(nextStreak({ current: 3, longest: 5, lastDay: today }, today)).toEqual({ current: 3, longest: 5, lastDay: today });
  });

  it("extends the streak when yesterday was active", () => {
    expect(nextStreak({ current: 3, longest: 3, lastDay: "2026-03-10" }, today)).toEqual({ current: 4, longest: 4, lastDay: today });
  });

  it("keeps the longest when the current streak is shorter", () => {
    expect(nextStreak({ current: 2, longest: 9, lastDay: "2026-03-10" }, today)).toEqual({ current: 3, longest: 9, lastDay: today });
  });

  it("resets to 1 after a missed day but keeps the longest", () => {
    expect(nextStreak({ current: 6, longest: 6, lastDay: "2026-03-09" }, today)).toEqual({ current: 1, longest: 6, lastDay: today });
  });

  it("treats the previous day across month and year boundaries as consecutive", () => {
    expect(nextStreak({ current: 1, longest: 1, lastDay: "2026-02-28" }, "2026-03-01").current).toBe(2);
    expect(nextStreak({ current: 1, longest: 1, lastDay: "2025-12-31" }, "2026-01-01").current).toBe(2);
    expect(nextStreak({ current: 1, longest: 1, lastDay: "2024-02-29" }, "2024-03-01").current).toBe(2);
  });

  it("knows 28 February is not the day before 1 March in a leap year", () => {
    expect(nextStreak({ current: 4, longest: 4, lastDay: "2024-02-28" }, "2024-03-01").current).toBe(1);
  });
});

describe("nextStreak with freezes", () => {
  const today = "2026-03-11";

  it("holds at most 2 freezes, one earned every 7 days", () => {
    expect(MAX_STREAK_FREEZES).toBe(2);
    expect(FREEZE_EVERY_DAYS).toBe(7);
  });

  it("reports the freezes back unchanged on an ordinary day", () => {
    expect(nextStreak({ current: 3, longest: 5, lastDay: "2026-03-10" }, today, 1)).toEqual({ current: 4, longest: 5, lastDay: today, freezes: 1 });
    expect(nextStreak({ current: 0, longest: 0, lastDay: null }, today, 0)).toEqual({ current: 1, longest: 1, lastDay: today, freezes: 0 });
  });

  it("does not touch the freezes on a second activity the same day", () => {
    expect(nextStreak({ current: 3, longest: 5, lastDay: today }, today, 2)).toEqual({ current: 3, longest: 5, lastDay: today, freezes: 2 });
  });

  it("spends one freeze on a single missed day and keeps the streak going", () => {
    expect(nextStreak({ current: 4, longest: 4, lastDay: "2026-03-09" }, today, 1)).toEqual({ current: 5, longest: 5, lastDay: today, freezes: 0 });
    expect(nextStreak({ current: 4, longest: 4, lastDay: "2026-03-09" }, today, 2)).toEqual({ current: 5, longest: 5, lastDay: today, freezes: 1 });
  });

  it("breaks the streak after a missed day without a freeze", () => {
    expect(nextStreak({ current: 4, longest: 4, lastDay: "2026-03-09" }, today, 0)).toEqual({ current: 1, longest: 4, lastDay: today, freezes: 0 });
  });

  it("does not spend a freeze on two or more missed days: the streak breaks and the freeze stays", () => {
    expect(nextStreak({ current: 4, longest: 4, lastDay: "2026-03-08" }, today, 1)).toEqual({ current: 1, longest: 4, lastDay: today, freezes: 1 });
  });

  it("earns a freeze on the 7th consecutive day, and again on the 14th", () => {
    expect(nextStreak({ current: 6, longest: 6, lastDay: "2026-03-10" }, today, 0).freezes).toBe(1);
    expect(nextStreak({ current: 13, longest: 13, lastDay: "2026-03-10" }, today, 1).freezes).toBe(2);
    expect(nextStreak({ current: 5, longest: 6, lastDay: "2026-03-10" }, today, 0).freezes).toBe(0);
  });

  it("never holds more than 2 freezes", () => {
    expect(nextStreak({ current: 20, longest: 20, lastDay: "2026-03-10" }, today, 2).freezes).toBe(2);
  });

  it("can spend a freeze and earn one back on the same day", () => {
    expect(nextStreak({ current: 6, longest: 6, lastDay: "2026-03-09" }, today, 1)).toEqual({ current: 7, longest: 7, lastDay: today, freezes: 1 });
  });

  it("leaves the freezes out of the result when none were given", () => {
    expect(nextStreak({ current: 1, longest: 1, lastDay: "2026-03-10" }, today)).not.toHaveProperty("freezes");
  });
});

describe("liveStreak", () => {
  const today = "2026-03-11";

  it("is 0 without any activity", () => {
    expect(liveStreak(5, null, today)).toBe(0);
  });

  it("keeps the streak while today or yesterday was active", () => {
    expect(liveStreak(5, today, today)).toBe(5);
    expect(liveStreak(5, "2026-03-10", today)).toBe(5);
  });

  it("drops to 0 once a day has been missed", () => {
    expect(liveStreak(5, "2026-03-09", today)).toBe(0);
  });

  it("stays alive through one missed day while a freeze is in hand", () => {
    expect(liveStreak(5, "2026-03-09", today, 1)).toBe(5);
    expect(liveStreak(5, "2026-03-09", today, 0)).toBe(0);
  });

  it("does not survive two missed days even with freezes", () => {
    expect(liveStreak(5, "2026-03-08", today, 2)).toBe(0);
  });
});

const noFacts: BadgeFacts = {
  lessonsCompleted: 0,
  modulesCompleted: 0,
  reports: 0,
  longestStreak: 0,
  policiesToSign: 0,
  policiesSigned: 0,
  labGamesPlayed: 0,
  certificates: 0,
  pathsCompleted: 0,
};

describe("earnedBadges", () => {
  it("awards nothing to a new learner", () => {
    expect(earnedBadges(noFacts)).toEqual([]);
  });

  const thresholds: [Badge, Partial<BadgeFacts>, Partial<BadgeFacts>][] = [
    ["first_step", { lessonsCompleted: 1 }, { lessonsCompleted: 0 }],
    ["module_master", { modulesCompleted: 1 }, { modulesCompleted: 0 }],
    ["sharp_eye", { reports: 5 }, { reports: 4 }],
    ["streak_7", { longestStreak: 7 }, { longestStreak: 6 }],
    ["lab_explorer", { labGamesPlayed: 4 }, { labGamesPlayed: 3 }],
    ["certified_5", { certificates: 5 }, { certificates: 4 }],
    ["path_finisher", { pathsCompleted: 1 }, { pathsCompleted: 0 }],
  ];

  it.each(thresholds)("awards %s at its threshold and not below", (badge, earned, notYet) => {
    expect(earnedBadges({ ...noFacts, ...earned })).toEqual([badge]);
    expect(earnedBadges({ ...noFacts, ...notYet })).toEqual([]);
  });

  it("awards policy_keeper only when something was signed and nothing is pending", () => {
    expect(earnedBadges({ ...noFacts, policiesSigned: 2, policiesToSign: 0 })).toEqual(["policy_keeper"]);
    expect(earnedBadges({ ...noFacts, policiesSigned: 2, policiesToSign: 1 })).toEqual([]);
    expect(earnedBadges({ ...noFacts, policiesSigned: 0, policiesToSign: 0 })).toEqual([]);
  });

  it("lists every badge in BADGES order when all are earned", () => {
    const all: BadgeFacts = {
      lessonsCompleted: 10,
      modulesCompleted: 3,
      reports: 5,
      longestStreak: 7,
      policiesToSign: 0,
      policiesSigned: 1,
      labGamesPlayed: 4,
      certificates: 5,
      pathsCompleted: 1,
    };
    expect(BADGES).toHaveLength(8);
    expect(earnedBadges(all)).toEqual([...BADGES]);
  });
});

describe("leagueScore", () => {
  it("weights completion 60 % and reporting 40 %", () => {
    expect(leagueScore(100, 0)).toBe(60);
    expect(leagueScore(0, 100)).toBe(40);
    expect(leagueScore(100, 100)).toBe(100);
    expect(leagueScore(0, 0)).toBe(0);
    expect(leagueScore(80, 20)).toBe(56);
  });

  it("rounds to the nearest point", () => {
    expect(leagueScore(51, 0)).toBe(31); // 30.6
    expect(leagueScore(72, 0)).toBe(43); // 43.2
    expect(leagueScore(99, 1)).toBe(60); // 59.8
  });
});

function dept(name: string, learners: number, completion: number, reportRate: number): DepartmentStats {
  return { id: name.toLowerCase(), name, learners, completion, reportRate };
}

describe("rankLeague", () => {
  it("returns no rows for no departments", () => {
    expect(rankLeague([])).toEqual([]);
  });

  it("excludes departments with zero learners and keeps places contiguous", () => {
    const rows = rankLeague([dept("Sales", 4, 50, 50), dept("Ghost", 0, 100, 100), dept("Ops", 2, 10, 10)]);
    expect(rows.map((r) => [r.name, r.place])).toEqual([
      ["Sales", 1],
      ["Ops", 2],
    ]);
  });

  it("orders by points, numbers places from 1 and measures the gap to the row above", () => {
    const rows = rankLeague([
      dept("Finance", 10, 90, 50), // 74
      dept("Support", 3, 20, 20), // 20
      dept("Engineering", 8, 100, 100), // 100
    ]);
    expect(rows.map((r) => [r.name, r.place, r.points, r.toNext])).toEqual([
      ["Engineering", 1, 100, null],
      ["Finance", 2, 74, 26],
      ["Support", 3, 20, 54],
    ]);
  });

  it("breaks point ties by completion, then by name, and reports toNext as 1", () => {
    const rows = rankLeague([
      dept("Marketing", 5, 60, 95), // 74, lower completion
      dept("Legal", 2, 90, 50), // 74, same completion as Finance: name order
      dept("Finance", 10, 90, 50), // 74
    ]);
    expect(rows.map((r) => [r.name, r.place, r.toNext])).toEqual([
      ["Finance", 1, null],
      ["Legal", 2, 1],
      ["Marketing", 3, 1],
    ]);
  });

  it("keeps the department fields on every row", () => {
    const [row] = rankLeague([dept("Sales", 4, 50, 50)]);
    expect(row).toEqual({ id: "sales", name: "Sales", learners: 4, completion: 50, reportRate: 50, place: 1, points: 50, toNext: null });
  });

  it("does not mutate the input", () => {
    const input = [dept("Support", 3, 20, 20), dept("Engineering", 8, 100, 100)];
    const copy = input.map((r) => ({ ...r }));
    rankLeague(input);
    expect(input).toEqual(copy);
  });
});

describe("leagueTrend", () => {
  it("is up when the place number got smaller and down when it grew", () => {
    expect(leagueTrend(1, 3)).toBe("up");
    expect(leagueTrend(3, 1)).toBe("down");
  });

  it("is same for an unchanged place and for a department without an earlier place", () => {
    expect(leagueTrend(2, 2)).toBe("same");
    expect(leagueTrend(2, null)).toBe("same");
    expect(leagueTrend(2, undefined)).toBe("same");
  });
});

describe("withTrend", () => {
  const today = rankLeague([
    dept("Finance", 10, 90, 50), // 74
    dept("Support", 3, 20, 20), // 20
    dept("Engineering", 8, 100, 100), // 100
    dept("Legal", 2, 10, 0), // 6, new this week
  ]);

  it("compares each department's place with its place in the earlier ranking", () => {
    const lastWeek = rankLeague([
      dept("Finance", 10, 100, 100), // 100, was first
      dept("Support", 3, 20, 20), // 20
      dept("Engineering", 8, 50, 50), // 50, was second
    ]);
    const rows = withTrend(today, lastWeek);
    expect(rows.map((r) => [r.name, r.place, r.trend])).toEqual([
      ["Engineering", 1, "up"],
      ["Finance", 2, "down"],
      ["Support", 3, "same"],
      ["Legal", 4, "same"],
    ]);
  });

  it("marks every row same when there is no earlier ranking", () => {
    expect(withTrend(today, []).every((r) => r.trend === "same")).toBe(true);
  });

  it("keeps the ranked fields and does not mutate the input", () => {
    const copy = today.map((r) => ({ ...r }));
    const [first] = withTrend(today, today);
    expect(first).toEqual({ ...today[0], trend: "same" });
    expect(today).toEqual(copy);
  });
});

describe("daysLeftInMonth", () => {
  it("counts today", () => {
    expect(daysLeftInMonth(new Date("2026-01-01T12:00:00+04:00"))).toBe(31);
    expect(daysLeftInMonth(new Date("2026-01-31T12:00:00+04:00"))).toBe(1);
  });

  it("knows the length of February", () => {
    expect(daysLeftInMonth(new Date("2026-02-15T12:00:00+04:00"))).toBe(14);
    expect(daysLeftInMonth(new Date("2024-02-01T12:00:00+04:00"))).toBe(29);
  });

  it("handles 30-day months", () => {
    expect(daysLeftInMonth(new Date("2026-04-29T12:00:00+04:00"))).toBe(2);
  });

  it("counts the Baku month, not the server's (UTC) one", () => {
    // 21:30 UTC on 31 October is 01:30 on 1 November in Baku: a fresh 30-day month, not "1 day left".
    expect(daysLeftInMonth(new Date("2026-10-31T21:30:00Z"))).toBe(30);
    // 19:30 UTC is still 23:30 on 31 October in Baku.
    expect(daysLeftInMonth(new Date("2026-10-31T19:30:00Z"))).toBe(1);
    // The year rolls over in Baku four hours before UTC.
    expect(daysLeftInMonth(new Date("2026-12-31T20:00:00Z"))).toBe(31);
  });
});

describe("catalog", () => {
  it("lists the nine categories in display order", () => {
    expect(CATEGORIES).toEqual(["email", "accounts", "social", "devices", "ai", "physical", "data", "work", "incident"]);
  });

  it("lists the three audiences", () => {
    expect(AUDIENCES).toEqual(["everyone", "leaders", "it"]);
  });

  it("isCategory accepts every category key and nothing else", () => {
    for (const c of CATEGORIES) expect(isCategory(c), c).toBe(true);
    for (const bad of ["Email", "ai-threats", "identity", "", " email", null, undefined, 0, {}, ["email"]]) {
      expect(isCategory(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("maps every original label to a distinct category", () => {
    const values = Object.values(CATEGORY_FROM_LABEL);
    expect(values.every(isCategory)).toBe(true);
    expect([...values].sort()).toEqual([...CATEGORIES].sort());
    expect(CATEGORY_FROM_LABEL).toMatchObject({ Email: "email", "Social engineering": "social", "AI threats": "ai", Workplace: "work", Incidents: "incident" });
  });

  it("leaves an unknown label undefined", () => {
    expect(CATEGORY_FROM_LABEL.Phishing).toBeUndefined();
  });

  it("gives every category a Rive topic", () => {
    expect(Object.keys(CATEGORY_TOPIC).sort()).toEqual([...CATEGORIES].sort());
    for (const c of CATEGORIES) expect(CATEGORY_TOPIC[c], c).toMatch(/^[a-z-]+$/);
  });

  it("renames accounts and ai for the mascot and keeps the rest as-is", () => {
    expect(CATEGORY_TOPIC.accounts).toBe("identity");
    expect(CATEGORY_TOPIC.ai).toBe("ai-threats");
    for (const c of CATEGORIES.filter((c) => c !== "accounts" && c !== "ai")) expect(CATEGORY_TOPIC[c], c).toBe(c);
  });
});
