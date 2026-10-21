import { requireFeature } from "@/server/auth/viewer";

/** Runs the sandbox feature check above loading.tsx, so a tenant without it still answers HTTP 404 before anything streams. */
export default async function LearnerSandboxLayout({ children }: LayoutProps<"/security/sandbox">) {
  await requireFeature("sandbox");
  return children;
}
