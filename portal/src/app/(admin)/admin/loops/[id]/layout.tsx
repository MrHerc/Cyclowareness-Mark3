import { loopForPage } from "./loop";

/** Runs the loop's 404 checks above loading.tsx, so they decide the HTTP status before anything streams. */
export default async function LoopLayout({ children, params }: LayoutProps<"/admin/loops/[id]">) {
  await loopForPage((await params).id);
  return children;
}
