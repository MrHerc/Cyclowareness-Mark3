import { describe, expect, it } from "vitest";
import { LOCALES } from "@/i18n/config";
import { TEMPLATES, clickRiskTitle } from "@/lib/campaigns/templates";
import { riskTitles } from "@/lib/risk-title";
import { localizeStandard } from "@/lib/standards";
import {
  DEFAULT_ATTESTATION,
  DEFAULT_CERTIFICATE_TEXT,
  DEFAULT_PATH_CERTIFICATE_TEXT,
  DEFAULT_TEMPLATES,
  DEFAULT_TEMPLATES_NO_DUE,
  EMAIL_BUTTON_BY_KIND,
  EMAIL_BUTTON_LABEL,
  FIXED_MESSAGES,
} from "@/lib/tenant-defaults";
import { INBOX, LINKS, MFA } from "@/server/lab/games";
import { LANGUAGE_STYLE, TUTOR_LANGUAGE, tutorRequestSchema } from "@/server/tutor";

type TextMap = Record<string, string>;

/** {name}, {{module}} and HTML tags, sorted: a translation keeps exactly the placeholders of the English text. */
const placeholders = (s: string) => (s.match(/\{\{?\s*\w+\s*\}?\}|<\/?[a-z][^>]*>/gi) ?? []).sort();
/** Amounts, IBAN groups, invoice numbers, sizes and deadlines: a translation must not change a number. */
const numbers = (s: string) => (s.match(/\d+/g) ?? []).sort();

const mails = (prefix: string, byKind: Record<string, Record<string, { subject: string; body: string }>>): [string, TextMap][] =>
  Object.entries(byKind).flatMap(([kind, byLocale]) => (["subject", "body"] as const).map((f): [string, TextMap] => [`${prefix}.${kind}.${f}`, Object.fromEntries(Object.entries(byLocale).map(([l, m]) => [l, m[f]]))]));

/** Phishing simulation texts and notification defaults: numbers and placeholders must survive translation. */
const exact: [string, TextMap][] = [
  ...TEMPLATES.flatMap((t) => {
    const fields: [string, TextMap | undefined][] = [
      ["name", t.name],
      ["sender", t.sender.name],
      ["subject", t.subject],
      ["body", t.body],
      ["cta", t.cta],
      ["attachment", t.attachment?.name],
      ["size", t.attachment?.size],
      ...t.redFlags.map((f, i): [string, TextMap] => [`redFlags.${i}`, f]),
    ];
    return fields.filter((f): f is [string, TextMap] => !!f[1]).map(([f, m]): [string, TextMap] => [`template ${t.key}.${f}`, m]);
  }),
  ["DEFAULT_ATTESTATION", DEFAULT_ATTESTATION],
  ["DEFAULT_CERTIFICATE_TEXT", DEFAULT_CERTIFICATE_TEXT],
  ["DEFAULT_PATH_CERTIFICATE_TEXT", DEFAULT_PATH_CERTIFICATE_TEXT],
  ["EMAIL_BUTTON_LABEL", EMAIL_BUTTON_LABEL],
  ...Object.entries(EMAIL_BUTTON_BY_KIND).map(([k, m]): [string, TextMap] => [`EMAIL_BUTTON_BY_KIND.${k}`, m]),
  ...mails("DEFAULT_TEMPLATES", DEFAULT_TEMPLATES),
  ...mails("DEFAULT_TEMPLATES_NO_DUE", DEFAULT_TEMPLATES_NO_DUE),
  ...mails("FIXED_MESSAGES", FIXED_MESSAGES),
];

/** Lab items: the English sometimes spells a number out ("Nine prompts"), so only placeholders are compared. */
const lab: [string, TextMap][] = [
  ...INBOX.flatMap((i) => (["sender", "subject", "snippet", "why"] as const).map((f): [string, TextMap] => [`inbox ${i.id}.${f}`, i[f]])),
  ...LINKS.flatMap((i) => (["context", "why"] as const).map((f): [string, TextMap] => [`link ${i.id}.${f}`, i[f]])),
  ...MFA.flatMap((i) => (["situation", "why"] as const).map((f): [string, TextMap] => [`mfa ${i.id}.${f}`, i[f]])),
];

/** Instructions to the model: written in English for every language, so only their completeness is checked. */
const prompts: [string, TextMap][] = [
  ["TUTOR_LANGUAGE", TUTOR_LANGUAGE],
  ["LANGUAGE_STYLE", LANGUAGE_STYLE],
];

/** Scripts that a translated value (one that is not just the English or Azerbaijani brand name) must use. */
const SCRIPT: Record<string, RegExp> = { ru: /\p{Script=Cyrillic}/u, uk: /\p{Script=Cyrillic}/u, ka: /\p{Script=Georgian}/u, ar: /\p{Script=Arabic}/u };

describe("texts kept in code", () => {
  it.each([...exact, ...lab])("%s has every interface language", (_, map) => {
    expect(Object.keys(map).sort()).toEqual([...LOCALES].sort());
    for (const l of LOCALES) {
      expect(map[l]?.trim(), l).toBeTruthy();
      const script = SCRIPT[l];
      if (script && map[l] !== map.en && map[l] !== map.az) expect(map[l], l).toMatch(script);
    }
  });

  it.each(prompts)("%s has every interface language", (_, map) => {
    expect(Object.keys(map).sort()).toEqual([...LOCALES].sort());
    for (const l of LOCALES) expect(map[l]?.trim(), l).toBeTruthy();
  });

  it.each([...exact, ...lab])("%s keeps the placeholders of the English text", (_, map) => {
    for (const l of LOCALES) expect(placeholders(map[l]), l).toEqual(placeholders(map.en));
  });

  it.each(exact)("%s keeps the numbers of the English text", (_, map) => {
    for (const l of LOCALES) expect(numbers(map[l]), l).toEqual(numbers(map.en));
  });

  it("writes a simulation click risk in every language, with the campaign name", () => {
    const titles = riskTitles(clickRiskTitle("Payroll Q4"))!;
    expect(Object.keys(titles).sort()).toEqual([...LOCALES].sort());
    for (const l of LOCALES) expect(titles[l], l).toContain("Payroll Q4");
  });

  it("localises the article word of a standard reference", () => {
    expect(localizeStandard("NIS2 Art. 21(2)(g)", "tr")).toBe("NIS2 md. 21(2)(g)");
    expect(localizeStandard("NIS2 Art. 20", "uk")).toBe("NIS2 ст. 20");
    expect(localizeStandard("NIS2 Art. 20", "ar")).toBe("NIS2 المادة 20");
    expect(localizeStandard("NIS2 Art. 20", "de")).toBe("NIS2 Art. 20");
  });

  it("accepts a tutor question in every interface language", () => {
    const valid = { slug: "phishing-email", lessonKey: "spot-the-signs", sceneId: null, question: "Why is this link unsafe?" };
    for (const locale of LOCALES) expect(tutorRequestSchema.safeParse({ ...valid, locale }).success, locale).toBe(true);
    expect(tutorRequestSchema.safeParse({ ...valid, locale: "it" }).success).toBe(false);
  });
});
