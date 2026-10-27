import { notFound } from "next/navigation";
import { hasFeature, requirePermission } from "@/server/auth/viewer";

/** Runs the section's permission and plan-feature checks above loading.tsx, so a role or plan without them still answers HTTP 404 before anything streams. */
export default async function ReportsLayout({ children }: LayoutProps<"/admin/reports">) {
  const v = await requirePermission("reports.read");
  if (!hasFeature(v, "reports")) notFound();
  return children;
}
