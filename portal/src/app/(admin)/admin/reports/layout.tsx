import { requirePermission } from "@/server/auth/viewer";

/** Runs the section's permission check above loading.tsx, so a role without it still answers HTTP 404 before anything streams. */
export default async function ReportsLayout({ children }: LayoutProps<"/admin/reports">) {
  await requirePermission("reports.read");
  return children;
}
