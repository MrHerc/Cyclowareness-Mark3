import "server-only";
import { and, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { db, dbHandle, t, type DB } from "./db";
import { env } from "./env";
import { CONTENT_SYNC_LOCK_KEY, syncLibrary, syncPaths } from "./services/library";
import { createTenantWithAdmin } from "./services/tenants";
import { issueAccountLink } from "./auth/links";
import { audit } from "./services/audit";
import { DEFAULT_LOCALE } from "../i18n/config";

/**
 * Production start-up work, run by src/instrumentation.ts before the server takes requests
 * (after the container entrypoint applied the migrations). Non-destructive and idempotent:
 *
 *  1. The lesson library and learning paths from ./content are imported: modules and lessons are
 *     matched by slug/key and updated in place, progress and assignments are never touched. A new
 *     image therefore brings its content changes with it.
 *  2. With BOOTSTRAP_OPERATOR_EMAIL set and no platform operator yet, the platform organisation and
 *     its operator (status "invited", no password) are created and a one-time invitation link is
 *     printed to the server log, once. Later starts print a new link only when that one has expired
 *     unused, so the log never holds more than one working link.
 *
 * Several replicas starting together take turns on a PostgreSQL advisory lock; the import runs in
 * one transaction, so a failed import changes nothing and stops the start (the container restarts).
 */
const PLATFORM_SLUG = "platform";

/** A display name from an address's local part: "safar.safarli" → "Safar Safarli" (the address itself when that gives too little). */
function operatorName(email: string): string {
  const words = email.split("@")[0].split(/[._-]+/).filter(Boolean);
  const name = words.map((w) => w.charAt(0).toLocaleUpperCase("en") + w.slice(1)).join(" ");
  return (name.length >= 2 ? name : email).slice(0, 120);
}

async function locked<T>(fn: (tx: DB) => Promise<T>): Promise<T> {
  if (dbHandle().driver !== "pg") return fn(db());
  return db().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${CONTENT_SYNC_LOCK_KEY})`);
    // The transaction offers the same query builder; the services are typed against the database.
    return fn(tx as unknown as DB);
  });
}

/** Creates the platform operator when none exists. Returns the id of an operator who still needs the invitation link. */
async function ensureOperator(tx: DB, email: string): Promise<string | null> {
  const [existing] = await tx.select({ id: t.users.id, role: t.users.role, status: t.users.status }).from(t.users).where(eq(t.users.email, email));
  if (existing) {
    if (existing.role !== "super_admin") {
      console.error(`[bootstrap] ${email} is an organisation account, not a platform operator; BOOTSTRAP_OPERATOR_EMAIL is ignored.`);
      return null;
    }
    return existing.status === "invited" ? existing.id : null;
  }
  const [operator] = await tx
    .select({ id: t.users.id })
    .from(t.users)
    .where(and(eq(t.users.role, "super_admin"), ne(t.users.status, "deleted")))
    .limit(1);
  if (operator) {
    console.info("[bootstrap] a platform operator already exists; BOOTSTRAP_OPERATOR_EMAIL is not used.");
    return null;
  }
  // Greeted and audited under a name taken from the address ("safar.safarli@…" is Safar Safarli) until they change it in their profile.
  const name = operatorName(email);
  const [platform] = await tx.select({ id: t.tenants.id }).from(t.tenants).where(eq(t.tenants.slug, PLATFORM_SLUG));
  let tenantId: string;
  let adminId: string;
  if (platform) {
    tenantId = platform.id;
    [{ id: adminId }] = await tx
      .insert(t.users)
      .values({ tenantId, email, name, role: "super_admin", status: "invited", locale: DEFAULT_LOCALE })
      .returning({ id: t.users.id });
  } else {
    ({ tenantId, adminId } = await createTenantWithAdmin(tx, {
      slug: PLATFORM_SLUG,
      name: "Cyclowareness",
      plan: "enterprise_hrm",
      locale: DEFAULT_LOCALE,
      adminName: name,
      adminEmail: email,
      adminRole: "super_admin",
    }));
  }
  await audit(tx, { tenantId, actorId: null, action: "tenant.created", targetType: "tenant", targetId: tenantId, meta: { name: "Cyclowareness", by: "bootstrap", operator: email } });
  console.info(`[bootstrap] platform operator ${email} created.`);
  return adminId;
}

export async function bootstrap(): Promise<void> {
  const email = env.BOOTSTRAP_OPERATOR_EMAIL?.toLowerCase();
  const pending = await locked(async (tx) => {
    const lib = await syncLibrary(tx);
    const paths = await syncPaths(tx);
    console.info(`[bootstrap] library synced: ${lib.modules} modules, ${lib.lessons} lessons (texts: ${Object.entries(lib.locales).map(([l, n]) => `${l} ${n}`).join(", ")}), ${paths} paths.`);
    return email ? ensureOperator(tx, email) : null;
  });
  // After the commit: the link's token row refers to the operator created above.
  if (pending && email) {
    const [live] = await db()
      .select({ expiresAt: t.authTokens.expiresAt })
      .from(t.authTokens)
      .where(and(eq(t.authTokens.userId, pending), eq(t.authTokens.kind, "invite"), isNull(t.authTokens.usedAt), gt(t.authTokens.expiresAt, new Date())))
      .limit(1);
    if (live) {
      console.info(`[bootstrap] ${email}: the operator password is not set yet. Use the one-time link printed when it was issued; it works until ${live.expiresAt.toISOString()}, and a start after that prints a new one.`);
      return;
    }
    const link = await issueAccountLink(pending, "invite");
    console.info(`[bootstrap] ${email}: set the operator password with this one-time link (valid 14 days, printed only this once, keep it private): ${link}`);
  }
}
