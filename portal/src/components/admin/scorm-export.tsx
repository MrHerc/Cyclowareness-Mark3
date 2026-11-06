"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PackageOpen } from "lucide-react";
import { LOCALES, LOCALE_NAMES, langAttrs, type Locale } from "@/i18n/config";
import { ButtonAnchor } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";

/** Downloads a module as a SCORM 1.2 package for an LMS (GET /api/admin/modules/{id}/scorm). */
export function ScormExport({ modules, defaultLocale }: { modules: { id: string; title: string }[]; defaultLocale: Locale }) {
  const t = useTranslations("admin.scorm");
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");
  const [locale, setLocale] = useState<Locale>(defaultLocale);
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
        <ButtonAnchor href={`/api/admin/modules/${moduleId}/scorm?locale=${locale}`} download icon={<PackageOpen />}>
          {t("export")}
        </ButtonAnchor>
      </CardBody>
    </Card>
  );
}
