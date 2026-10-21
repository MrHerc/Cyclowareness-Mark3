import { requirePermission } from "@/server/auth/viewer";

/** Runs the section's permission check above loading.tsx, so a role without it still answers HTTP 404 before anything streams. */
export default async function SettingsLayout({ children }: LayoutProps<"/admin/settings">) {
  await requirePermission("settings.write");
  return children;
}
