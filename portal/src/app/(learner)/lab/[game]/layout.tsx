import { notFound } from "next/navigation";
import { isGame } from "@/server/lab/games";

/** Runs the game page's 404 check above loading.tsx, so an unknown game answers HTTP 404 before anything streams. */
export default async function GameLayout({ children, params }: LayoutProps<"/lab/[game]">) {
  if (!isGame((await params).game)) notFound();
  return children;
}
