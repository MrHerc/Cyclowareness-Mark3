import { Mail, MessageSquare, Paperclip, Phone, QrCode, Usb } from "lucide-react";
import { templateText, type CampaignTemplate } from "@/lib/campaigns/templates";
import { cn } from "@/lib/cn";

/** Quotation marks per language; «…» for the rest (az, ru, uk, ar). */
const QUOTES: Record<string, [string, string]> = { en: ["“", "”"], tr: ["“", "”"], ro: ["„", "”"], ka: ["„", "“"], de: ["„", "“"], fr: ["« ", " »"] };

/** Realistic preview of a simulation as the recipient would see it. */
export function TemplatePreview({ tpl, locale, compact = false }: { tpl: CampaignTemplate; locale: string; compact?: boolean }) {
  const body = templateText(tpl.body, locale);
  if (tpl.channel === "sms") {
    return (
      <div className="rounded-xl bg-sunken p-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-tab font-semibold text-ink-muted">
          <MessageSquare className="size-3.5" />
          {templateText(tpl.sender.name, locale)}
        </p>
        <p className={cn("rounded-2xl rounded-es-sm bg-surface px-3 py-2 text-caption shadow-xs", compact && "line-clamp-3")}>
          {body} <span className="text-brand-600 underline">sk-kargo.info/a7K</span>
        </p>
      </div>
    );
  }
  if (tpl.channel === "voice" || tpl.channel === "usb") {
    const Icon = tpl.channel === "voice" ? Phone : Usb;
    const [open, close] = QUOTES[locale] ?? ["«", "»"];
    return (
      <div className="rounded-xl bg-ink p-3 text-white">
        <p className="flex items-center gap-1.5 text-tab font-semibold opacity-80">
          <Icon className="size-3.5" />
          {templateText(tpl.sender.name, locale)} · {tpl.sender.address}
        </p>
        <p className={cn("mt-1.5 text-caption italic", compact && "line-clamp-3")}>{open + body + close}</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <p className="flex items-center gap-1.5 text-tab text-ink-muted">
        <Mail className="size-3.5 shrink-0" />
        <b className="text-ink">{templateText(tpl.sender.name, locale)}</b>
        <span className="truncate">&lt;{tpl.sender.address}&gt;</span>
      </p>
      <p className="mt-1.5 text-caption font-bold">{templateText(tpl.subject, locale)}</p>
      <p className={cn("mt-1 text-tab whitespace-pre-line text-ink-muted", compact && "line-clamp-3")}>{body}</p>
      {tpl.attachment ? (
        <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-sunken px-2 py-1 text-tab">
          <Paperclip className="size-3" />
          {templateText(tpl.attachment.name, locale)} · {templateText(tpl.attachment.size, locale)}
        </p>
      ) : null}
      {tpl.qr ? <QrCode className="mt-2 size-14 text-ink" strokeWidth={1.2} /> : null}
      {tpl.cta && !compact ? <span className="mt-2 inline-block rounded-md bg-[#1f6feb] px-3 py-1.5 text-tab font-semibold text-white">{templateText(tpl.cta, locale)}</span> : null}
    </div>
  );
}
