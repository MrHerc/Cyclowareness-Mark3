/**
 * Human risk score, 0 to 100 (lower is better). Every component is explainable so the
 * person page and the leadership panel can say *why* a score is what it is.
 */

export type Severity = "low" | "medium" | "high" | "critical";

export type RiskInputs = {
  /** Assigned lessons completed / assigned lessons. null when nothing is assigned. */
  assignedCompletion: number | null;
  overdueAssignments: number;
  /** Simulation events in the last 90 days. */
  simClicks: number;
  simSubmits: number;
  simReports: number;
  /** Risky or compromised choices inside lesson simulations, last 90 days. */
  lessonRiskyChoices: number;
  openRisks: Severity[];
  /** First-try correct answers / answers. null below 5 answers. */
  firstTryRate: number | null;
};

export type RiskBreakdown = {
  score: number;
  parts: { training: number; overdue: number; simulations: number; openRisks: number; knowledge: number };
};

const SEVERITY_WEIGHT: Record<Severity, number> = { low: 4, medium: 8, high: 14, critical: 20 };

export function riskScore(i: RiskInputs): RiskBreakdown {
  const training = i.assignedCompletion === null ? 8 : Math.round((1 - i.assignedCompletion) * 30);
  const overdue = Math.min(i.overdueAssignments * 5, 10);
  const simulationsRaw = i.simClicks * 12 + i.simSubmits * 18 + i.lessonRiskyChoices * 2 - i.simReports * 6;
  const simulations = Math.max(0, Math.min(35, simulationsRaw));
  const openRisks = Math.min(30, i.openRisks.reduce((sum, s) => sum + SEVERITY_WEIGHT[s], 0));
  const knowledge = i.firstTryRate === null ? 8 : Math.round((1 - i.firstTryRate) * 16);
  const score = Math.max(0, Math.min(100, training + overdue + simulations + openRisks + knowledge));
  return { score, parts: { training, overdue, simulations, openRisks, knowledge } };
}

export type RiskBand = "low" | "medium" | "high";

/** Bands used everywhere (admin thresholds 0–33, 34–66, 67–100). */
export function riskBand(score: number): RiskBand {
  if (score <= 33) return "low";
  if (score <= 66) return "medium";
  return "high";
}
