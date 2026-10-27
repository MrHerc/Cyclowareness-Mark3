/**
 * Practice labs as learning-path steps. Pure code shared by the sync, the learner pages, the admin editor and tests.
 * A path lists its labs after its modules (lessons first, then practice); a lab opens once the lessons it practises
 * are done. That is a display rule only: /lab stays a free practice area.
 */

/** Every lab id, in the /lab order (the four games, then the three virtual-machine labs); the keys of LAB_XP. */
export const LAB_IDS = ["inbox-triage", "link-detective", "password-forge", "mfa-fatigue", "phishing-anatomy", "process-hunt", "fake-signin"] as const;
export type LabId = (typeof LAB_IDS)[number];

export function isLabId(v: string): v is LabId {
  return (LAB_IDS as readonly string[]).includes(v);
}

/** The modules each lab practises. */
export const LAB_MODULES: Record<LabId, readonly string[]> = {
  "inbox-triage": ["phishing-email"],
  "phishing-anatomy": ["phishing-email", "dangerous-attachments"],
  "link-detective": ["safe-browsing", "search-ads-lookalikes"],
  "fake-signin": ["fake-login-windows", "passwords-mfa", "safe-browsing"],
  "password-forge": ["passwords-mfa", "password-managers-work"],
  "mfa-fatigue": ["passwords-mfa", "sim-swap-otp"],
  "process-hunt": ["malware-ransomware", "infostealers"],
};

/**
 * A lab counts as passed from this share of its maximum, taken from the best attempt. A share, not a score:
 * games, machine labs and seeded rows store different maxima.
 */
export const LAB_PASS = 0.7;

export function labPassed(best: number | null): boolean {
  return best !== null && best >= LAB_PASS;
}

/** A module's lessons are all done once it awaits its confirmation or is completed. */
export function lessonsDone(status: string | undefined): boolean {
  return status === "awaiting_attestation" || status === "completed";
}

/** The labs that practise a module. */
export function labsForModule(slug: string): LabId[] {
  return LAB_IDS.filter((id) => LAB_MODULES[id].includes(slug));
}

/**
 * The path modules a lab still waits for: those of its own modules that are in the path, or every module of the
 * path when the lab practises none of them; minus the ones whose lessons are done.
 */
export function labWaitsFor(labId: LabId, pathSlugs: readonly string[], statusBySlug: ReadonlyMap<string, string>): string[] {
  const related = pathSlugs.filter((s) => LAB_MODULES[labId].includes(s));
  return (related.length ? related : pathSlugs).filter((s) => !lessonsDone(statusBySlug.get(s)));
}

export function labUnlocked(labId: LabId, pathSlugs: readonly string[], statusBySlug: ReadonlyMap<string, string>): boolean {
  return labWaitsFor(labId, pathSlugs, statusBySlug).length === 0;
}
