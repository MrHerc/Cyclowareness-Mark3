import { requirePermission } from "@/server/auth/viewer";

/** Runs the section's permission check above loading.tsx, so a role without it still answers HTTP 404 before anything streams. */
export default async function PeopleLayout({ children }: LayoutProps<"/admin/users">) {
  await requirePermission("people.read");
  return children;
}
