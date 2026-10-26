import { getTranslations } from "next-intl/server";
import { BookOpen, Fish, Languages } from "lucide-react";
import { BrandMark, VENDOR } from "@/components/brand";
import { Mascot } from "@/components/mascot/mascot";
import { readLibrary } from "@/server/services/library";

const DOTS = {
  backgroundImage: "radial-gradient(rgb(255 255 255 / 0.16) 1px, transparent 1.5px)",
  backgroundSize: "22px 22px",
  maskImage: "radial-gradient(120% 90% at 30% 0%, black, transparent 75%)",
} as const;

// The library's module count, read once per server process (content/library ships with the server).
let modules: number | undefined;
function moduleCount(): number {
  modules ??= readLibrary().modules.length;
  return modules;
}

/**
 * The brand side of the sign-in pages: an indigo panel with AI Sel waving hello, the value line, three
 * facts about the product and the vendor's wordmark. From lg it is a full-height column beside the form;
 * on phones it shrinks to a band above the form with the cat and the value line.
 */
export async function BrandPanel() {
  const t = await getTranslations("auth.panel");
  const facts = [
    { Icon: BookOpen, text: t("modules", { count: moduleCount() }) },
    { Icon: Languages, text: t("languages") },
    { Icon: Fish, text: t("phishing") },
  ];
  return (
    <aside className="relative isolate overflow-clip bg-linear-160 from-brand-500 via-brand-600 to-brand-700 text-white">
      {/* Backdrop: a dot grid that fades out, two soft glows and the rings the cat sits in. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0" style={DOTS} />
        <div className="absolute -top-24 -left-24 size-96 rounded-full bg-white/14 blur-3xl" />
        <div className="absolute -right-32 -bottom-40 size-[28rem] rounded-full bg-brand-900/35 blur-3xl" />
      </div>

      {/* The panel grows with a tall form; its content stays in view while the page scrolls (overflow-clip keeps sticky working). */}
      <div className="flex flex-col px-5 pt-[calc(var(--safe-top)+1.25rem)] pb-16 sm:px-8 lg:sticky lg:top-0 lg:h-dvh lg:px-12 lg:pt-10 lg:pb-10 xl:px-16">
        <BrandMark className="h-8 min-w-0 flex-wrap self-start overflow-hidden text-white" />

        <div className="mt-4 flex items-center gap-4 lg:mt-0 lg:flex-1 lg:flex-col lg:justify-center lg:gap-0 lg:text-center">
          <div className="relative shrink-0 lg:mb-6">
            <span aria-hidden className="absolute inset-[6%] rounded-full border border-white/15 bg-white/8 max-lg:hidden" />
            <span aria-hidden className="absolute -inset-[10%] rounded-full border border-white/10 max-lg:hidden" />
            <span aria-hidden className="absolute inset-x-[22%] bottom-[5%] h-[7%] rounded-[50%] bg-brand-900/45 blur-md" />
            <Mascot mood="happy" gesture="wave" gestureKey="hello" label={t("mascot")} className="size-24 sm:size-28 lg:size-60 xl:size-68" />
          </div>
          <p className="max-w-[26rem] font-display text-title-sm font-bold tracking-tight text-balance lg:text-[2.25rem] lg:leading-[1.1] xl:text-[2.5rem]">{t("tagline")}</p>
          <ul className="mt-8 hidden w-fit gap-3 text-left lg:grid">
            {facts.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-body-sm font-medium text-white/90">
                <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-white/12 ring-1 ring-white/20 ring-inset">
                  <Icon aria-hidden className="size-4.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden lg:block">
          <p className="text-tab-sm font-semibold tracking-wide text-white/65">{t("vendor")}</p>
          {/* White on the indigo panel; the original colours return under the form on phones. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/safarov-industries-wordmark-sm.png" alt={VENDOR} width={480} height={50} className="mt-2 h-4 w-auto brightness-0 invert" />
        </div>
      </div>
    </aside>
  );
}
