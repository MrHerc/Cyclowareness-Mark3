"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { PackageOpen } from "lucide-react";
import { LOCALES, LOCALE_NAMES, langAttrs, type Locale } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

/** Downloads a module as a SCORM 1.2 package for an LMS (GET /api/admin/modules/{id}/scorm). */
export function ScormExport({ modules, defaultLocale }: { modules: { id: string; title: string }[]; defaultLocale: Locale }) {
  const t = useTranslations("admin.scorm");
  const tc = useTranslations("common");
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [pending, start] = useTransition();
  // Fetched rather than linked, so a refusal (rate limit, failed build) shows a message instead of saving as the zip.
  const download = () =>
    start(async () => {
      const res = await fetch(`/api/admin/modules/${moduleId}/scorm?locale=${locale}`);
      if (!res.ok) {
        toast(tc(res.status === 429 ? "errors.rateLimited" : "errors.generic"), "error");
        return;
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "scorm12.zip";
      const url = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement("a"), { href: url, download: name }).click();
      URL.revokeObjectURL(url);
    });
  if (!modules.length) return null;
  return (
    <Card>
      <CardHeader title={t("title")} description={t("description")} icon={<PackageOpen />} />
      <CardBody className="grid gap-4 pt-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end sm:pt-4">
        <Field label={t("module")} htmlFor="scorm-module">
          <Select id="scorm-module" value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("language")} htmlFor="scorm-locale">
          <Select id="scorm-locale" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
            {LOCALES.map((l) => (
              <option key={l} value={l} {...langAttrs(l)}>
                {LOCALE_NAMES[l]}
              </option>
            ))}
          </Select>
        </Field>
        <Button icon={<PackageOpen />} disabled={pending} onClick={download}>
          {t("export")}
        </Button>
      </CardBody>
    </Card>
  );
}
