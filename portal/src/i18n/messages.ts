import type common from "../../messages/en/common.json";
import type auth from "../../messages/en/auth.json";
import type learner from "../../messages/en/learner.json";
import type player from "../../messages/en/player.json";
import type security from "../../messages/en/security.json";
import type admin from "../../messages/en/admin.json";
import type secops from "../../messages/en/secops.json";
import type settings from "../../messages/en/settings.json";
import type site from "../../messages/en/site.json";
import type { Locale } from "./config";

export const NAMESPACES = ["common", "auth", "learner", "player", "security", "admin", "secops", "settings", "site"] as const;

export type Messages = {
  common: typeof common;
  auth: typeof auth;
  learner: typeof learner;
  player: typeof player;
  security: typeof security;
  admin: typeof admin;
  secops: typeof secops;
  settings: typeof settings;
  site: typeof site;
};

export async function loadMessages(locale: Locale): Promise<Messages> {
  // The bundler turns this import into a glob of the messages/<locale>/ folders found when it transforms
  // this file; vitest's fsModuleCache keeps that list until the file changes, so a new language's folder
  // needs one `npx vitest run --no-fsModuleCache` ("Unknown variable dynamic import" otherwise).
  const parts = await Promise.all(
    NAMESPACES.map(async (ns) => [ns, (await import(`../../messages/${locale}/${ns}.json`)).default] as const),
  );
  return Object.fromEntries(parts) as Messages;
}
