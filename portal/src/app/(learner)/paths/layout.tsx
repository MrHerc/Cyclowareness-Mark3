import { requireFeature } from "@/server/auth/viewer";

/**
 * Runs the paths feature check above every loading.tsx under /paths, so a tenant without the feature still
 * answers HTTP 404 before a skeleton streams. The index skeleton lives in the (index) group: here it would
 * also wrap /paths/[key] and stream before that page's notFound().
 */
export default async function PathsLayout({ children }: LayoutProps<"/paths">) {
  await requireFeature("paths");
  return children;
}
