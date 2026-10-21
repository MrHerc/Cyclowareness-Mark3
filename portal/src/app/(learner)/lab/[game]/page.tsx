import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireFeature } from "@/server/auth/viewer";
import { isGame, publicItems } from "@/server/lab/games";
import { PageHeader } from "@/components/ui/layout";
import { GameClient } from "./game-client";

export async function generateMetadata({ params }: PageProps<"/lab/[game]">) {
  const { game } = await params;
  const tr = await getTranslations("learner.lab");
  return { title: isGame(game) ? tr(`games.${game}.title`) : tr("title") };
}

export default async function GamePage({ params }: PageProps<"/lab/[game]">) {
  const { game } = await params;
  const v = await requireFeature("lab");
  if (!isGame(game)) notFound();
  const [tr, locale] = await Promise.all([getTranslations("learner.lab"), getLocale()]);
  return (
    <div className="grid gap-6">
      <PageHeader title={tr(`games.${game}.title`)} subtitle={tr(`games.${game}.body`)} back={{ href: "/lab", label: tr("back") }} />
      <GameClient game={game} items={publicItems(game, locale)} forge={{ orgName: v.tenant.name, orgSlug: v.tenant.slug, userName: v.user.name, email: v.user.email }} />
    </div>
  );
}
