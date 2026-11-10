/**
 * Step 3 of "Rotating APP_SECRET" (docs/OPERATIONS.md): with the new APP_SECRET and the old one in
 * APP_SECRET_PREVIOUS, re-encrypts every stored secret with the new key. Safe to run again; prints counts only.
 * Local: embedded PGlite in .data/pg (stop `next dev` first). Production: DATABASE_URL.
 *   npm run secret:rotate
 */
import { createDb } from "../src/server/db/client";
import { countVerifiedDomains, rotateStoredSecrets, rotationRefusal } from "../src/server/services/secret-rotation";

async function main() {
  const refusal = rotationRefusal(process.env);
  if (refusal) throw new Error(`Refusing to rotate: ${refusal}`);
  const handle = createDb();
  try {
    const proofRefusal = rotationRefusal(process.env, await countVerifiedDomains(handle.db));
    if (proofRefusal) throw new Error(`Refusing to rotate: ${proofRefusal}`);
    const counts = await rotateStoredSecrets(handle.db);
    console.log(`Re-encrypted the secrets of ${counts.tenants} organisation(s) and ${counts.users} authenticator key(s)${counts.unreadable ? `; ${counts.unreadable} value(s) open with neither key and were left as they are` : ""}.`);
    if (counts.skipped.length) console.log(`Skipped ${counts.skipped.length} organisation(s) deleted while the script ran: ${counts.skipped.join(", ")}.`);
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
