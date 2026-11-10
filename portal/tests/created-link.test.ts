import fs from "node:fs";
import path from "node:path";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreatedLinkDialog, writeClipboard } from "@/components/admin/created-link";
import admin from "../messages/en/admin.json";
import common from "../messages/en/common.json";

// An invite or reset link the clipboard refuses (embedded and sandboxed browsers) must stay on screen:
// window.prompt throws there too, and a new link needs the administrator's password again.
describe("created invite or reset link", () => {
  afterEach(() => void vi.unstubAllGlobals());
  const url = "https://acme.example/set-password?token=abc123";

  it("reports a refused clipboard write instead of throwing", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: () => Promise.reject(new DOMException("denied", "NotAllowedError")) } });
    expect(await writeClipboard(url)).toBe(false);
    vi.stubGlobal("navigator", {});
    expect(await writeClipboard(url)).toBe(false);
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await writeClipboard(url)).toBe(true);
    expect(writeText).toHaveBeenCalledWith(url);
  });

  it("shows the link in a read-only field with a copy button and a status line", () => {
    const html = renderToStaticMarkup(
      createElement(NextIntlClientProvider, { locale: "en", messages: { admin, common } } as ComponentProps<typeof NextIntlClientProvider>, createElement(CreatedLinkDialog, { url, onClose: () => undefined })),
    );
    expect(html).toMatch(new RegExp(`<input[^>]*readOnly=""[^>]*value="${url.replace(/[?.]/g, "\\$&")}"`));
    expect(html).toContain('aria-describedby="created-link-status"');
    expect(html).toContain(`aria-label="${common.copy}"`);
    expect(html).toMatch(/<p id="created-link-status" role="status"[^>]*>This browser did not allow copying/);
  });

  it("is closed without a link", () => {
    const html = renderToStaticMarkup(
      createElement(NextIntlClientProvider, { locale: "en", messages: { admin, common } } as ComponentProps<typeof NextIntlClientProvider>, createElement(CreatedLinkDialog, { url: null, onClose: () => undefined })),
    );
    expect(html).not.toContain("<input");
  });

  it("is what the people list and the person page fall back to, never window.prompt", () => {
    const dir = path.join(__dirname, "..", "src", "components", "admin");
    for (const file of fs.readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts")))
      expect(fs.readFileSync(path.join(dir, file), "utf8"), file).not.toMatch(/\bprompt\(/);
    for (const file of ["people-client.tsx", "person-actions.tsx"]) expect(fs.readFileSync(path.join(dir, file), "utf8")).toContain("<CreatedLinkDialog url={createdLink}");
  });
});
