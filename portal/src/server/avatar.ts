import "server-only";
import { sql } from "drizzle-orm";
import { t } from "./db";

/**
 * Select this instead of users.avatarUrl: `/api/avatar/<id>?v=<hash>` for someone with a photo, else null.
 * The photo (a data URL of up to 300 KB, profile.ts) stays in the database and that route serves it, so
 * pages and the session lookup do not carry the base64; the hash changes the address when the photo
 * changes, so the route's hour-long browser cache never shows an old one.
 */
export const avatarSrc = sql<string | null>`case when ${t.users.avatarUrl} is null then null else '/api/avatar/' || ${t.users.id} || '?v=' || left(md5(${t.users.avatarUrl}), 8) end`;
