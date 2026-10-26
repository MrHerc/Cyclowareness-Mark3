"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Archive, ArchiveRestore, Bell, Plus, Send } from "lucide-react";
import { archivePolicyAction, createPolicyAction, publishVersionAction, remindPolicyAction } from "@/server/actions/workspace";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import type { Locale } from "@/i18n/config";

export function NewPolicy() {
  const t = useTranslations("admin.policies");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <Button icon={<Plus />} onClick={() => setOpen(true)}>
        {t("new")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("newTitle")} description={t("newBody")} size="sm">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await createPolicyAction(name);
              if (res.ok && res.id) router.push(`/admin/policies/${res.id}`);
              else toast(tc("errors.invalid"), "error");
            });
          }}
        >
          <Field label={t("name")} htmlFor="pol-name">
            <Input id="pol-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoFocus />
          </Field>
          <Button type="submit" disabled={pending || name.trim().length < 2}>
            {t("create")}
          </Button>
        </form>
      </Dialog>
    </>
  );
}

type PolicyDraft = { title: string; summary: string; bodyMd: string };

/**
 * A new version: the base text in the organisation's default language (`base`) and, folded away, one
 * translation per other enabled language. A language left empty shows its readers the base text.
 */
export function VersionEditor({ policyId, nextVersion, base, initial }: { policyId: string; nextVersion: number; base: Locale; initial: PolicyDraft & { translations: Partial<Record<Locale, PolicyDraft>> } }) {
  const t = useTranslations("admin.policies");
  const tc = useTranslations("common");
  // Language names as the reader's notice uses them ("in Azerbaijani", «на русском»).
  const tp = useTranslations("player.policy");
  const router = useRouter();
  const [v, setV] = useState(initial);
  const languages = Object.keys(initial.translations) as Locale[];
  // A translation is either left empty or a real text (the same 20-character minimum as the base text).
  const tooShort = languages.some((l) => {
    const n = v.translations[l]?.bodyMd.trim().length ?? 0;
    return n > 0 && n < 20;
  });
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-4">
      <p className="text-caption text-ink-muted">{t("newVersionHint")}</p>
      <Field label={t("editorTitle")} htmlFor="v-title">
        <Input id="v-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={200} />
      </Field>
      <Field label={t("editorSummary")} htmlFor="v-summary" optional={tc("optional")}>
        <Input id="v-summary" value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} maxLength={600} />
      </Field>
      <Field label={t("editorBody")} htmlFor="v-body">
        <Textarea id="v-body" value={v.bodyMd} onChange={(e) => setV({ ...v, bodyMd: e.target.value })} className="min-h-80 font-mono text-caption" />
      </Field>
      <p className="text-caption text-ink-muted">{t("baseLanguage", { language: tp(`language.${base}`) })}</p>
      {languages.length ? (
        <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-caption font-semibold">{t("translation")}</summary>
          <p className="mt-2 text-caption text-ink-muted">{t("translationHint")}</p>
          {languages.map((l) => {
            const x = v.translations[l] ?? { title: "", summary: "", bodyMd: "" };
            const set = (patch: Partial<PolicyDraft>) => setV({ ...v, translations: { ...v.translations, [l]: { ...x, ...patch } } });
            const language = tc(`languages.${l}`);
            return (
              <fieldset key={l} className="mt-3 grid gap-3 border-t border-line pt-3">
                <legend className="text-caption font-semibold">{language}</legend>
                <Input lang={l} value={x.title} onChange={(e) => set({ title: e.target.value })} maxLength={200} placeholder={t("editorTitle")} aria-label={t("translationTitle", { language })} />
                <Input lang={l} value={x.summary} onChange={(e) => set({ summary: e.target.value })} maxLength={600} placeholder={t("editorSummary")} aria-label={t("translationSummary", { language })} />
                <Textarea lang={l} value={x.bodyMd} onChange={(e) => set({ bodyMd: e.target.value })} className="min-h-48 font-mono text-caption" aria-label={t("translationText", { language })} />
              </fieldset>
            );
          })}
        </details>
      ) : null}
      <div className="flex justify-end">
        <Button icon={<Send />} disabled={v.title.trim().length < 2 || v.bodyMd.trim().length < 20 || tooShort} onClick={() => setConfirm(true)}>
          {t("publish")}
        </Button>
      </div>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("publishTitle", { version: nextVersion })}
        size="sm"
        footer={
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await publishVersionAction({ policyId, ...v });
                if (res.ok) {
                  toast(t("publishedToast"));
                  setConfirm(false);
                  router.refresh();
                } else toast(tc("errors.invalid"), "error");
              })
            }
          >
            {t("publish")}
          </Button>
        }
      >
        <p className="text-body-sm text-ink-muted">{t("publishBody")}</p>
      </Dialog>
    </div>
  );
}

export function PolicyHeaderActions({ policyId, archived, versionId }: { policyId: string; archived: boolean; versionId: string | null }) {
  const t = useTranslations("admin.policies");
  const [pending, start] = useTransition();
  // Long labels ("Remind people who haven't signed") wrap inside the button on narrow phones instead of widening the page.
  const fit = "h-auto min-h-11 max-w-full whitespace-normal py-2.5 text-start";
  return (
    <div className="flex max-w-full flex-wrap gap-2">
      {versionId ? (
        <Button variant="secondary" className={fit} icon={<Bell />} disabled={pending} onClick={() => start(async () => toast(t("reminded", { count: (await remindPolicyAction(versionId)).count })))}>
          {t("remind")}
        </Button>
      ) : null}
      <Button variant="secondary" className={fit} icon={archived ? <ArchiveRestore /> : <Archive />} disabled={pending} onClick={() => start(async () => void (await archivePolicyAction(policyId, !archived)))}>
        {archived ? t("restore") : t("archive")}
      </Button>
    </div>
  );
}
