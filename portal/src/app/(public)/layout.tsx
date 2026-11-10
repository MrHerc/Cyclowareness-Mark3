import { IntlScope } from "@/components/intl-scope";

/** Teachable moments, QR and certificate links: their share of the message catalogue for client components. */
export default function PublicGroupLayout({ children }: { children: React.ReactNode }) {
  return <IntlScope surface="public">{children}</IntlScope>;
}
