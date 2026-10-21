import { requirePermission } from "@/server/auth/viewer";

/** Runs the section's permission check above loading.tsx, so a role without it still answers HTTP 404 before anything streams. */
export default async function PoliciesLayout({ children }: LayoutProps<"/admin/policies">) {
  await requirePermission("policies.read");
  return children;
}
