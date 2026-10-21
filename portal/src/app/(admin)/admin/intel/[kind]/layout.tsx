import { intelForPage } from "./intel";

/** Runs the feed's permission and plan-feature checks above loading.tsx, so they decide the HTTP status before anything streams. */
export default async function IntelLayout({ children, params }: LayoutProps<"/admin/intel/[kind]">) {
  await intelForPage((await params).kind);
  return children;
}
