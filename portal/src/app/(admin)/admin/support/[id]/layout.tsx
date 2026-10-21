import { ticketForPage } from "./ticket";

/** Runs the ticket's 404 checks above loading.tsx, so they decide the HTTP status before anything streams. */
export default async function TicketLayout({ children, params }: LayoutProps<"/admin/support/[id]">) {
  await ticketForPage((await params).id);
  return children;
}
