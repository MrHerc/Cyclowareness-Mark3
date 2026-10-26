import { notFound } from "next/navigation";
import { isGame } from "@/server/lab/games";
import { isVmLab } from "@/components/lab/model/labs";

/** Runs the game page's 404 check above loading.tsx, so an unknown game or lab answers HTTP 404 before anything streams. */
export default async function GameLayout({ children, params }: LayoutProps<"/lab/[game]">) {
  const { game } = await params;
  if (!isGame(game) && !isVmLab(game)) notFound();
  return children;
}
