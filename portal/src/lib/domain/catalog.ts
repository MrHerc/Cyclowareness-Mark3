/** Module categories: stable keys, the original display names and the mascot topic prop. */

export const CATEGORIES = ["email", "accounts", "social", "devices", "ai", "physical", "data", "work", "incident"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_FROM_LABEL: Record<string, Category> = {
  Email: "email",
  Accounts: "accounts",
  "Social engineering": "social",
  Devices: "devices",
  "AI threats": "ai",
  "Physical security": "physical",
  Data: "data",
  Workplace: "work",
  Incidents: "incident",
};

/** Rive `topic` input values (see docs/audit/06-lesson-engine.md). */
export const CATEGORY_TOPIC: Record<Category, string> = {
  email: "email",
  accounts: "identity",
  social: "social",
  devices: "devices",
  ai: "ai-threats",
  physical: "physical",
  data: "data",
  work: "work",
  incident: "incident",
};

export const AUDIENCES = ["everyone", "leaders", "it"] as const;
export type Audience = (typeof AUDIENCES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}
