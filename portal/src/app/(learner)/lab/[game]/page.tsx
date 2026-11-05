import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireFeature } from "@/server/auth/viewer";
import { isGame, publicItems } from "@/server/lab/games";
import { isVmLab } from "@/components/lab/model/labs";
import { VmLab } from "@/components/lab/vm-lab";
import { PageHeader } from "@/components/ui/layout";
import { dayKey } from "@/lib/domain/gamification";
import { GameClient } from "./game-client";

export async function generateMetadata({ params }: PageProps<"/lab/[game]">) {
  const { game } = await params;
  const tr = await getTranslations("learner.lab");
  return { title: isGame(game) || isVmLab(game) ? tr(`games.${game}.title`) : tr("title") };
}

/** Today in the organisation's time zone, for the dates inside a lab machine (certificate validity, whois records, mail headers). */
function orgToday(timeZone: string) {
  return dayKey(new Date(), timeZone);
}

export default async function GamePage({ params }: PageProps<"/lab/[game]">) {
  const { game } = await params;
  const v = await requireFeature("lab");
  if (isVmLab(game)) {
    const tr = await getTranslations("learner.lab");
    return (
      <div className="grid gap-2">
        <PageHeader title={tr(`games.${game}.title`)} subtitle={tr(`games.${game}.body`)} back={{ href: "/lab", label: tr("back") }} className="sm:mb-6" />
        <VmLab lab={game} today={orgToday(v.tenant.settings.timeZone)} />
      </div>
    );
  }
  if (!isGame(game)) notFound();
  const [tr, locale] = await Promise.all([getTranslations("learner.lab"), getLocale()]);
  return (
    <div className="grid gap-6">
      <PageHeader title={tr(`games.${game}.title`)} subtitle={tr(`games.${game}.body`)} back={{ href: "/lab", label: tr("back") }} />
      <GameClient game={game} items={publicItems(game, locale)} forge={{ orgName: v.tenant.name, orgSlug: v.tenant.slug, userName: v.user.name, email: v.user.email }} />
    </div>
  );
}
