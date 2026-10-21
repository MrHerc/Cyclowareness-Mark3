import { notFound } from "next/navigation";
import { hasFeature, requirePermission } from "@/server/auth/viewer";

/** Runs the section's permission and plan-feature checks above loading.tsx, so a role or plan without them still answers HTTP 404 before anything streams. */
export default async function LoopsLayout({ children }: LayoutProps<"/admin/loops">) {
  const v = await requirePermission("secops.read");
  if (!hasFeature(v, "closed_loops")) notFound();
  return children;
}
