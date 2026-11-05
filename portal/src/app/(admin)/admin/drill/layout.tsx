import { notFound } from "next/navigation";
import { hasFeature, requirePermission } from "@/server/auth/viewer";

/** Runs the section's permission and feature checks above any loading state, so they decide the HTTP status. */
export default async function DrillLayout({ children }: LayoutProps<"/admin/drill">) {
  const v = await requirePermission("campaigns.write");
  if (!hasFeature(v, "live_drill")) notFound();
  return children;
}
