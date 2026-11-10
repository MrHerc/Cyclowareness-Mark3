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
type Namespace = (typeof NAMESPACES)[number];

/**
 * The namespaces the client components of each surface read: the root layout's provider ("root": toasts and
 * the error page, under every page) and the provider each route group's layout puts under it (IntlScope).
 * A nested provider replaces its parent's messages, so a group lists everything its client components use.
 * tests/client-messages.test.ts walks the imports and keeps these lists exact.
 */
export const CLIENT_NAMESPACES = {
  root: ["common"],
  admin: ["admin", "auth", "common", "learner", "player", "secops", "security", "settings"],
  auth: ["auth"],
  focus: ["common", "learner", "player"],
  learner: ["auth", "common", "learner", "player", "secops", "security"],
  public: ["site"],
  site: ["auth", "common"],
} as const satisfies Record<string, readonly Namespace[]>;
export type Surface = keyof typeof CLIENT_NAMESPACES;

export function pickMessages(messages: Messages, namespaces: readonly Namespace[]): Partial<Messages> {
  return Object.fromEntries(namespaces.map((ns) => [ns, messages[ns]]));
}

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
