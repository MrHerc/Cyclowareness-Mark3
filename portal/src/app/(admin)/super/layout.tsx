import AdminLayout from "../admin/layout";
import { requirePermission } from "@/server/auth/viewer";

/**
 * The operator console uses the same console shell as /admin. The operator permission runs here, above
 * loading.tsx, so anyone else still gets HTTP 404 before the skeleton streams.
 */
export default async function SuperLayout({ children }: LayoutProps<"/super">) {
  await requirePermission("platform.manage");
  return <AdminLayout>{children}</AdminLayout>;
}
