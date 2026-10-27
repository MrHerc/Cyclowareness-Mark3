import { notFound } from "next/navigation";
import { hasFeature, requirePermission } from "@/server/auth/viewer";

/** Runs the section's permission and plan-feature checks above loading.tsx, so a role or plan without them still answers HTTP 404 before anything streams. */
export default async function LeagueLayout({ children }: LayoutProps<"/admin/league">) {
  const v = await requirePermission("league.read");
  if (!hasFeature(v, "league")) notFound();
  return children;
}
