import { incidentForPage } from "./incident";

/** Runs the incident's 404 checks above loading.tsx, so they decide the HTTP status before anything streams. */
export default async function IncidentLayout({ children, params }: LayoutProps<"/admin/incidents/[id]">) {
  await incidentForPage((await params).id);
  return children;
}
