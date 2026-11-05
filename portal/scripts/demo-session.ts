/**
 * Used by scripts/demo.mjs only: a 20-minute session of the demo organisation's administrator, so the
 * script can request the walkthrough's pages once before the presenter does (in development each page
 * compiles on its first request). Prints the token on stdout and nothing else. Refuses anything but the
 * local embedded database of the seeded demo organisation.
 */
import { and, eq } from "drizzle-orm";
import { createDb } from "../src/server/db/client";
import * as t from "../src/server/db/schema";
import { sha256Hex } from "../src/server/crypto";
import { randomToken } from "../src/server/services/progress";
import { DEMO_DOMAIN } from "./seed-data";

async function main() {
  if (process.env.DATABASE_URL) throw new Error("demo-session only works on the local embedded database.");
  const { db, close } = createDb();
  try {
    const [admin] = await db
      .select({ id: t.users.id, tenantId: t.users.tenantId })
      .from(t.users)
      .where(and(eq(t.users.email, `admin@${DEMO_DOMAIN}`), eq(t.users.status, "active")));
    if (!admin) throw new Error("The demo organisation is not seeded.");
    const token = randomToken(24);
    await db.insert(t.sessions).values({ id: sha256Hex(token), userId: admin.id, tenantId: admin.tenantId, expiresAt: new Date(Date.now() + 20 * 60_000), twoFactorVerified: true, userAgent: "demo warm-up" });
    process.stdout.write(token);
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
