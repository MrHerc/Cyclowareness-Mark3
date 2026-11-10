import { IntlScope } from "@/components/intl-scope";

/** The console's (admin, SecOps, operator) share of the message catalogue for its client components. */
export default function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  return <IntlScope surface="admin">{children}</IntlScope>;
}
