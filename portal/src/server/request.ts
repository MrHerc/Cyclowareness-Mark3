import "server-only";
import { headers } from "next/headers";

/** Client IP. Proxy headers are trusted only behind a known reverse proxy (TRUST_PROXY=1). */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  if (process.env.TRUST_PROXY === "1") {
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded.slice(0, 64);
    const real = h.get("x-real-ip");
    if (real) return real.slice(0, 64);
  }
  return null;
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent")?.slice(0, 300) ?? null;
}

/** Path of the current request (set by proxy.ts), for sign-in redirects. */
export async function currentPath(): Promise<string> {
  return (await headers()).get("x-pathname") ?? "/";
}
