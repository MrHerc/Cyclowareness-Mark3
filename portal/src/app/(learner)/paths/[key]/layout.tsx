import { pathForPage } from "./path";

/** Runs the path page's 404 check above loading.tsx, so it decides the HTTP status before anything streams. */
export default async function PathLayout({ children, params }: LayoutProps<"/paths/[key]">) {
  await pathForPage((await params).key);
  return children;
}
