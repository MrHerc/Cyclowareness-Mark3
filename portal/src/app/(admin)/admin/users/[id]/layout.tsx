import { personForPage } from "./person";

/** Runs the profile's 404 checks above loading.tsx, so they decide the HTTP status before anything streams. */
export default async function PersonLayout({ children, params }: LayoutProps<"/admin/users/[id]">) {
  await personForPage((await params).id);
  return children;
}
