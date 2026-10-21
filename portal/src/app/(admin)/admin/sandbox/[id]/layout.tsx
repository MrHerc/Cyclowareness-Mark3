import { analysisForPage } from "./analysis";

/** Runs the analysis's 404 checks above loading.tsx, so they decide the HTTP status before anything streams. */
export default async function AnalysisLayout({ children, params }: LayoutProps<"/admin/sandbox/[id]">) {
  await analysisForPage((await params).id);
  return children;
}
