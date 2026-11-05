import { describe, expect, it } from "vitest";
import { PUBLISHED_SEED_PASSWORD, seedPasswordProblem } from "../scripts/seed-data";

describe("seedPasswordProblem", () => {
  it("lets the local embedded database use the published demo password", () => {
    expect(seedPasswordProblem({})).toBeNull();
    expect(seedPasswordProblem({ SEED_PASSWORD: PUBLISHED_SEED_PASSWORD })).toBeNull();
    expect(seedPasswordProblem({ NODE_ENV: "development", SEED_PASSWORD: PUBLISHED_SEED_PASSWORD })).toBeNull();
  });

  it("refuses the published or a missing password for PostgreSQL and production targets", () => {
    for (const target of [{ DATABASE_URL: "postgres://u:p@db:5432/portal" }, { NODE_ENV: "production" }]) {
      expect(seedPasswordProblem(target)).toMatch(/SEED_PASSWORD/);
      expect(seedPasswordProblem({ ...target, SEED_PASSWORD: "" })).toMatch(/SEED_PASSWORD/);
      expect(seedPasswordProblem({ ...target, SEED_PASSWORD: PUBLISHED_SEED_PASSWORD })).toMatch(/published/);
    }
  });

  it("asks for at least 12 characters beyond the local database", () => {
    expect(seedPasswordProblem({ DATABASE_URL: "postgres://db/portal", SEED_PASSWORD: "short-pass1" })).toMatch(/12/);
    expect(seedPasswordProblem({ DATABASE_URL: "postgres://db/portal", SEED_PASSWORD: "a-private-demo-pass" })).toBeNull();
  });
});
