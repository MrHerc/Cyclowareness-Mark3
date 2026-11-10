import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import common from "../messages/en/common.json";
import learner from "../messages/en/learner.json";

const toast = vi.fn();
vi.mock("@/components/ui/toast", () => ({ toast: (...args: unknown[]) => toast(...args) }));

const { settle } = await import("@/components/ui/use-action");

const tc = (key: string) => `tc:${key}`;
const retry = vi.fn();

describe("settle (useAction's core)", () => {
  beforeEach(() => {
    toast.mockClear();
    retry.mockClear();
  });

  it("toasts the success message and passes the result on", async () => {
    const onSuccess = vi.fn();
    await settle(async () => ({ ok: true as const, id: "x" }), { successToast: "Saved", onSuccess }, tc, retry);
    expect(toast).toHaveBeenCalledExactlyOnceWith("Saved");
    expect(onSuccess).toHaveBeenCalledWith({ ok: true, id: "x" });
  });

  it("treats plain data and an empty answer as success", async () => {
    await settle(async () => ({ count: 3 }), { successToast: (res) => `Reminded ${res.count}` }, tc, retry);
    const onSuccess = vi.fn();
    await settle(async () => undefined, { onSuccess }, tc, retry);
    expect(toast).toHaveBeenCalledExactlyOnceWith("Reminded 3");
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("shows the caller's message for a mapped refusal, without a retry", async () => {
    const onSuccess = vi.fn();
    await settle(async () => ({ ok: false, error: "in_use" }), { onSuccess, errorMap: { in_use: "Still in use" } }, tc, retry);
    await settle(async () => ({ ok: false, reason: "empty" }), { errorMap: (res) => `Blocked: ${res.reason}` }, tc, retry);
    expect(toast.mock.calls).toEqual([
      ["Still in use", "error"],
      ["Blocked: empty", "error"],
    ]);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("uses common.errors for invalid input, a rate limit and a missing permission, without a retry", async () => {
    for (const error of ["invalid", "rateLimited", "forbidden"]) await settle(async () => ({ ok: false, error }), {}, tc, retry);
    // A form state answers with an error key and no `ok`.
    await settle(async () => ({ error: "rateLimited" }), {}, tc, retry);
    expect(toast.mock.calls).toEqual([
      ["tc:errors.invalid", "error"],
      ["tc:errors.rateLimited", "error"],
      ["tc:errors.forbidden", "error"],
      ["tc:errors.rateLimited", "error"],
    ]);
  });

  it("falls back to the generic message with a retry for an unmapped refusal", async () => {
    await settle(async () => ({ ok: false, error: "failed" }), { errorMap: { in_use: "Still in use" } }, tc, retry);
    await settle(async () => ({ ok: false }), {}, tc, retry);
    expect(toast).toHaveBeenCalledTimes(2);
    for (const [message, tone, , action] of toast.mock.calls) {
      expect([message, tone, action.label]).toEqual(["tc:errors.generic", "error", "tc:retry"]);
    }
    toast.mock.calls[0][3].onClick();
    expect(retry).toHaveBeenCalledOnce();
  });

  it("turns a rejected call into the generic message with a retry", async () => {
    const onSuccess = vi.fn();
    await settle(() => Promise.reject(new Error("offline")), { onSuccess, successToast: "Saved" }, tc, retry);
    expect(toast).toHaveBeenCalledExactlyOnceWith("tc:errors.generic", "error", undefined, { label: "tc:retry", onClick: retry });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("lets a redirect from the action through", async () => {
    await expect(settle(async () => redirect("/sign-in"), {}, tc, retry)).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;/) });
    expect(toast).not.toHaveBeenCalled();
  });

  it("hands every failure to onError instead of toasting", async () => {
    const onError = vi.fn();
    await settle(async () => ({ ok: false, error: "wrongPassword" }), { onError, errorMap: { wrongPassword: "unused" } }, tc, retry);
    await settle(async () => ({ ok: false }), { onError }, tc, retry);
    await settle(() => Promise.reject(new Error("offline")), { onError }, tc, retry);
    expect(onError.mock.calls).toEqual([["wrongPassword"], ["generic"], ["generic"]]);
    expect(toast).not.toHaveBeenCalled();
  });
});

describe("a migrated dialog form shows the error useAction hands it", () => {
  // The server renderer cannot submit, so the mocked hook reports the failure while the form renders (a render-phase
  // update React replays), and the markup is the form's error state.
  let failure: string | null = null;
  vi.doMock("@/components/ui/use-action", () => ({
    useAction: (_: unknown, options: { onError?: (error: string) => void }) => {
      if (failure) {
        options.onError?.(failure);
        failure = null;
      }
      return { run: () => {}, pending: false };
    },
  }));
  vi.doMock("@/server/actions/learning", () => ({ reportProblemAction: vi.fn() }));

  const render = async (error: string) => {
    const { ProblemForm } = await import("@/components/learner/problem-form");
    failure = error;
    return renderToStaticMarkup(
      createElement(NextIntlClientProvider, { locale: "en", messages: { common, learner } } as ComponentProps<typeof NextIntlClientProvider>, createElement(ProblemForm, { context: "page:/profile", onSent: () => {} })),
    );
  };

  it("marks the message field for a refused message", async () => {
    const html = await render("message");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain(`<p id="problem-message-error" role="alert"`);
    expect(html).toContain(learner.problem.messageError);
  });

  it("shows a rate limit or a failed call above the form", async () => {
    expect(await render("rateLimited")).toContain(`<span role="alert">${common.errors.rateLimited}</span>`);
    expect(await render("generic")).toContain(`<span role="alert">${common.errors.generic}</span>`);
  });
});

describe("Settings calls that cannot reach the error boundary", () => {
  // The server renderer cannot click, so this reads the source: a direct `await action()` inside a transition
  // sends a failed call (server unreachable) to the error boundary, and the tab's unsaved edits are lost.
  const source = readFileSync(path.join(__dirname, "..", "src", "components", "admin", "settings-tabs.tsx"), "utf8");

  it("runs every call outside a Save through useAction", () => {
    for (const action of ["createApiTokenAction", "revokeApiTokenAction", "grantSupportAccessAction", "revokeSupportAccessAction", "rotateWebhookSecretAction", "rotateInboundSecretAction", "sendTestEventAction", "verifyDomainAction", "verifySimulationDomainAction", "resendFailedMailAction", "testEmailAction", "lookupWatermarkAction"]) {
      expect(source, action).toContain(`useAction(${action}`);
      expect(source, action).not.toMatch(new RegExp(`await ${action}\\(`));
    }
    // The only transition left is useSave's own, which settles its calls (below).
    expect(source.match(/useTransition\(\)/g)).toHaveLength(1);
  });

  it("settles every Save through settle()", () => {
    const useSave = source.slice(source.indexOf("function useSave()"), source.indexOf("function SaveBar("));
    expect(useSave).toContain("settle(");
    expect(useSave).not.toContain("await fn()");
  });
});
