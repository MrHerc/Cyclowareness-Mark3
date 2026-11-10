import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import auth from "../messages/en/auth.json";
import common from "../messages/en/common.json";
import learner from "../messages/en/learner.json";

// The server renderer cannot submit, so the mocked hook reports the refusal while the form renders (a render-phase
// update React replays), and the open dialog's markup is the form's error state.
const state = vi.hoisted(() => ({ failure: null as string | null }));
vi.mock("@/components/ui/use-action", () => ({
  useAction: (_: unknown, options: { onError?: (error: string) => void }) => {
    if (state.failure) {
      options.onError?.(state.failure);
      state.failure = null;
    }
    return { run: () => {}, pending: false };
  },
}));
vi.mock("@/components/ui/dialog", () => ({ Dialog: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/server/actions/profile", () => ({ changePasswordAction: vi.fn() }));
vi.mock("@/server/actions/preferences", () => ({}));
vi.mock("@/components/learner/problem-form", () => ({ ProblemForm: () => null }));
const { ChangePassword, passwordErrorField } = await import("../src/app/(learner)/profile/profile-client");

// Profile → Security → Change password: each refusal of changePasswordAction is shown on (and tied with
// aria-describedby to) the field it is about.
describe("change-password refusals", () => {
  it("belong to the field they are about", () => {
    expect(passwordErrorField("wrongPassword")).toBe("pw-current");
    expect(passwordErrorField("mismatch")).toBe("pw-confirm");
    for (const rule of ["required", "tooShort", "tooLong", "sameAsEmail", "weak"]) expect(passwordErrorField(rule)).toBe("pw-next");
    expect(passwordErrorField("generic")).toBeNull();
  });

  it("keep the refusal's key in the form state, so the field is marked (not the translated text)", () => {
    state.failure = "mismatch";
    const html = renderToStaticMarkup(
      createElement(NextIntlClientProvider, { locale: "en", timeZone: "Asia/Baku", messages: { auth, common, learner } } as ComponentProps<typeof NextIntlClientProvider>, createElement(ChangePassword, { email: "aysel@bank.example", name: "Aysel" })),
    );
    const confirm = html.match(/<input[^>]*id="pw-confirm"[^>]*>/)?.[0];
    expect(confirm).toContain('aria-invalid="true"');
    expect(confirm).toContain('aria-describedby="pw-confirm-error"');
    expect(html).toContain('<p id="pw-confirm-error" role="alert"');
  });
});
