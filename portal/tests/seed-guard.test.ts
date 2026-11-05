import { describe, expect, it } from "vitest";
import { foreignTenants, seedRefusal } from "../scripts/seed-data";

describe("seedRefusal", () => {
  it("lets the local embedded database seed with no password set (a random one is printed) or its own", () => {
    expect(seedRefusal({})).toBeNull();
    expect(seedRefusal({ SEED_PASSWORD: "" })).toBeNull();
    expect(seedRefusal({ NODE_ENV: "development", SEED_PASSWORD: "a-private-demo-pass" })).toBeNull();
  });

  it("never runs in production, whatever else is set", () => {
    expect(seedRefusal({ NODE_ENV: "production" })).toMatch(/production/);
    expect(seedRefusal({ NODE_ENV: "production", ALLOW_SEED: "1", SEED_PASSWORD: "a-private-demo-pass" })).toMatch(/production/);
  });

  it("needs ALLOW_SEED=1 for a DATABASE_URL", () => {
    expect(seedRefusal({ DATABASE_URL: "postgres://u:p@db:5432/portal" })).toMatch(/ALLOW_SEED/);
    expect(seedRefusal({ DATABASE_URL: "postgres://u:p@db:5432/portal", ALLOW_SEED: "1" })).toBeNull();
  });

  it("asks for at least 12 characters when a password is set", () => {
    expect(seedRefusal({ SEED_PASSWORD: "short-pass1" })).toMatch(/12/);
    expect(seedRefusal({ DATABASE_URL: "postgres://db/portal", ALLOW_SEED: "1", SEED_PASSWORD: "short-pass1" })).toMatch(/12/);
  });
});

describe("foreignTenants", () => {
  it("names the organisations that are not the seed's own", () => {
    expect(foreignTenants([])).toEqual([]);
    expect(foreignTenants(["platform", "safarov"])).toEqual([]);
    expect(foreignTenants(["platform", "safarov", "acme-bank"])).toEqual(["acme-bank"]);
  });
});
