import { describe, expect, it } from "vitest";
import { defaultSettings, withDefaults } from "@/lib/tenant-defaults";
import { LOCALES } from "@/i18n/config";

describe("withDefaults", () => {
  it("fills missing groups and keys from the defaults", () => {
    const s = withDefaults({ defaultLocale: "en", locales: ["en"], learning: { refresher: false } });
    expect(s.defaultLocale).toBe("en");
    expect(s.locales).toEqual(["en"]);
    expect(s.learning).toEqual({ ...defaultSettings("en").learning, refresher: false });
    expect(s.integrations.webhookEvents).toEqual([]);
    expect(s.integrations.webhookEvents.includes("phishing.clicked")).toBe(false);
    expect(s.notifications.firstReminderDays).toBe(3);
    expect(s.email.enabled).toBe(false);
    expect(s.identity.ssoEnabled).toBe(false);
  });

  it("keeps stored values, optional groups and notification templates as they are", () => {
    const templates = { reminder: { en: { subject: "Hi", body: "{{link}}" } } };
    const s = withDefaults({
      ...defaultSettings("az"),
      notifications: { ...defaultSettings("az").notifications, firstReminderDays: 9, templates },
      identity: { requireAdmin2fa: true, maxDevices: null, ssoEnabled: true, sso: { protocol: "oidc", issuer: "https://idp", autoCreate: false } },
      integrations: { webhookEnabled: true, webhookEvents: ["qr.scanned"], syslogEnabled: false, webhookSecretEnc: "v1:x" },
      setupHidden: true,
    });
    expect(s.notifications.firstReminderDays).toBe(9);
    expect(s.notifications.templates).toBe(templates);
    expect(s.identity.sso?.issuer).toBe("https://idp");
    expect(s.identity.maxDevices).toBeNull();
    expect(s.integrations.webhookSecretEnc).toBe("v1:x");
    expect(s.integrations.webhookEvents).toEqual(["qr.scanned"]);
    expect(s.setupHidden).toBe(true);
  });

  it("survives garbage", () => {
    for (const raw of [null, undefined, "x", 42, [], { integrations: "nope", locales: "az" }]) {
      const s = withDefaults(raw);
      expect(s.defaultLocale).toBe("az");
      expect(s.locales).toEqual([...LOCALES]);
      expect(Array.isArray(s.integrations.webhookEvents)).toBe(true);
    }
  });
});
