import { policyForPage } from "./policy";

/** Runs the policy's 404 checks above loading.tsx, so they decide the HTTP status before anything streams. */
export default async function PolicyLayout({ children, params }: LayoutProps<"/admin/policies/[id]">) {
  await policyForPage((await params).id);
  return children;
}
