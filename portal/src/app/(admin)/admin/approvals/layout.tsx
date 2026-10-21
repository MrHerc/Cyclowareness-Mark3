import { notFound } from "next/navigation";
import { hasFeature, requirePermission } from "@/server/auth/viewer";

/** Runs the section's permission and plan-feature checks above loading.tsx, so a role or plan without them still answers HTTP 404 before anything streams. */
export default async function ApprovalsLayout({ children }: LayoutProps<"/admin/approvals">) {
  const v = await requirePermission("approvals.decide");
  if (!hasFeature(v, "approvals")) notFound();
  return children;
}
