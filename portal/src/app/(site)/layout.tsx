import { IntlScope } from "@/components/intl-scope";

/** The public site's share of the message catalogue for its client components. */
export default function SiteGroupLayout({ children }: { children: React.ReactNode }) {
  return <IntlScope surface="site">{children}</IntlScope>;
}
