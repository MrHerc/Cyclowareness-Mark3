import fs from "node:fs";
import path from "node:path";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import admin from "../messages/en/admin.json";
import common from "../messages/en/common.json";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const toast = vi.fn();
vi.mock("@/components/ui/toast", () => ({ toast: (...args: unknown[]) => toast(...args) }));
vi.mock("@/server/actions/people", () => ({}));
const { ConfirmPasswordField, useLinkRefused } = await import("@/components/admin/person-actions");

const render = (node: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(NextIntlClientProvider, { locale: "en", timeZone: "Asia/Baku", messages: { admin, common } } as ComponentProps<typeof NextIntlClientProvider>, node));

describe("the person dialogs", () => {
  // The edit dialog mounts the field on the keystroke that changes the number: focus must stay on the phone field.
  it("let the password field leave the focus where it is", () => {
    const field = (props: { autoFocus?: boolean }) => render(createElement(ConfirmPasswordField, { id: "pw", value: "", onChange: () => {}, error: null, ...props }));
    expect(field({})).toContain("autofocus");
    expect(field({ autoFocus: false })).not.toContain("autofocus");
    const src = fs.readFileSync(path.join(__dirname, "..", "src", "components", "admin", "person-actions.tsx"), "utf8");
    expect(src).toContain('<ConfirmPasswordField id="edit-pw" autoFocus={false}');
  });

  it("report a refused link that is not about the password, instead of doing nothing", () => {
    const setPwError = vi.fn();
    const close = vi.fn();
    function Probe({ error }: { error?: string }) {
      useLinkRefused(setPwError, close)(error);
      return null;
    }
    render(createElement(Probe, { error: "wrongPassword" }));
    expect(setPwError).toHaveBeenCalledWith(admin.person.wrongPassword);
    expect(close).not.toHaveBeenCalled();
    // The person was activated or removed meanwhile: the dialog closes, the administrator is told, the view refreshes.
    render(createElement(Probe, {}));
    expect(close).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith(common.errors.generic, "error");
    expect(refresh).toHaveBeenCalledOnce();
    expect(setPwError).toHaveBeenCalledOnce();
  });
});
