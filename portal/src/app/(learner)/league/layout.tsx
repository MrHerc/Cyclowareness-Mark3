import { requireFeature } from "@/server/auth/viewer";

/** Runs the league's feature check above loading.tsx, so a tenant without it still answers HTTP 404 before anything streams. */
export default async function LeagueLayout({ children }: LayoutProps<"/league">) {
  await requireFeature("league");
  return children;
}
