import { requireFeature } from "@/server/auth/viewer";

/** Runs the live-sessions feature check above loading.tsx, so a tenant without it still answers HTTP 404 before anything streams. */
export default async function SessionsLayout({ children }: LayoutProps<"/sessions">) {
  await requireFeature("live_sessions");
  return children;
}
