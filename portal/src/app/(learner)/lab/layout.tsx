import { requireFeature } from "@/server/auth/viewer";

/**
 * Runs the lab feature check above every loading.tsx under /lab, so a tenant without the feature still answers
 * HTTP 404 before a skeleton streams. The index skeleton lives in the (index) group: here it would also wrap
 * /lab/[game] and stream before that page's notFound().
 */
export default async function LabLayout({ children }: LayoutProps<"/lab">) {
  await requireFeature("lab");
  return children;
}
