import { notFound } from "next/navigation";
import { hasFeature, requirePermission } from "@/server/auth/viewer";

/** Runs the section's permission and plan-feature checks above loading.tsx, so a role or plan without them still answers HTTP 404 before anything streams. */
export default async function SessionsLayout({ children }: LayoutProps<"/admin/sessions">) {
  const v = await requirePermission("sessions.write");
  if (!hasFeature(v, "live_sessions")) notFound();
  return children;
}
