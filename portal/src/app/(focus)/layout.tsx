import { and, eq } from "drizzle-orm";
import { db, t } from "@/server/db";
import { requireViewer } from "@/server/auth/viewer";
import { Protection, Watermark } from "@/components/shell/protection";
import { IntlScope } from "@/components/intl-scope";

/** Full-screen pages (lesson player, policy reader, lab games): no rail, same protection. */
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  const v = await requireViewer();
  const [mark] = v.tenant.settings.protection.watermark
    ? await db()
        .select({ code: t.watermarkCodes.code })
        .from(t.watermarkCodes)
        .where(and(eq(t.watermarkCodes.userId, v.user.id), eq(t.watermarkCodes.sessionId, v.sessionId)))
        .limit(1)
    : [];
  return (
    <IntlScope surface="focus">
      {children}
      <Protection enabled={v.tenant.settings.protection.contentProtection} />
      <Watermark code={mark?.code ?? null} />
    </IntlScope>
  );
}
