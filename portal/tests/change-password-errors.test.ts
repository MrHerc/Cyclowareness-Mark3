import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/actions/profile", () => ({}));
vi.mock("@/server/actions/preferences", () => ({}));
vi.mock("@/components/learner/problem-form", () => ({ ProblemForm: () => null }));
const { passwordErrorField } = await import("../src/app/(learner)/profile/profile-client");

// Profile → Security → Change password: each refusal of changePasswordAction is shown on (and tied with
// aria-describedby to) the field it is about.
describe("change-password refusals", () => {
  it("belong to the field they are about", () => {
    expect(passwordErrorField("wrongPassword")).toBe("pw-current");
    expect(passwordErrorField("mismatch")).toBe("pw-confirm");
    for (const rule of ["required", "tooShort", "tooLong", "sameAsEmail", "weak"]) expect(passwordErrorField(rule)).toBe("pw-next");
    expect(passwordErrorField("generic")).toBeNull();
  });
});
