import { redirect } from "next/navigation";
import { allowed, requireViewer } from "@/server/auth/viewer";

/**
 * Sends a role without the overview to its own start page above loading.tsx, so the answer is a real
 * HTTP redirect rather than a skeleton followed by a client-side one.
 */
export default async function OverviewLayout({ children }: LayoutProps<"/admin">) {
  const v = await requireViewer();
  if (!allowed(v, "overview.read")) redirect(allowed(v, "leadership.read") ? "/admin/leadership" : "/admin/reports");
  return children;
}
