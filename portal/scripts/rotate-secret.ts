/**
 * Step 3 of "Rotating APP_SECRET" (docs/OPERATIONS.md): with the new APP_SECRET and the old one in
 * APP_SECRET_PREVIOUS, re-encrypts every stored secret with the new key. Safe to run again; prints counts only.
 * Local: embedded PGlite in .data/pg (stop `next dev` first). Production: DATABASE_URL.
 *   npx tsx scripts/rotate-secret.ts
 */
import { createDb } from "../src/server/db/client";
import { rotateStoredSecrets } from "../src/server/services/secret-rotation";

async function main() {
  const secret = process.env.APP_SECRET ?? "";
  if (process.env.NODE_ENV === "production" && secret.length < 32) throw new Error("APP_SECRET (32+ characters) must be set: a rotation cannot seal production secrets with the development key.");
  const handle = createDb();
  try {
    const counts = await rotateStoredSecrets(handle.db);
    console.log(`Re-encrypted the secrets of ${counts.tenants} organisation(s) and ${counts.users} authenticator key(s)${counts.unreadable ? `; ${counts.unreadable} value(s) open with neither key and were left as they are` : ""}.`);
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
