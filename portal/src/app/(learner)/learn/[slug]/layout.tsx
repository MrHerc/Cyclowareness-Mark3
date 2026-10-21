import { moduleForPage } from "./module";

/** Runs the module page's 404 check above loading.tsx, so it decides the HTTP status before anything streams. */
export default async function ModuleLayout({ children, params }: LayoutProps<"/learn/[slug]">) {
  await moduleForPage((await params).slug);
  return children;
}
