import "server-only";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { appUrl, env } from "./env";

/**
 * Client address behind `hops` trusted reverse proxies. Each proxy appends the address it saw,
 * so everything left of the last `hops` entries is whatever the client sent and is ignored.
 * Returns null for anything that is not an IP address.
 */
export function clientIpFrom(h: Pick<Headers, "get">, hops: number, header: "x-forwarded-for" | "x-real-ip" = "x-forwarded-for"): string | null {
  if (hops < 1) return null;
  let candidate: string | undefined;
  if (header === "x-real-ip") {
    candidate = h.get("x-real-ip")?.trim();
  } else {
    const list = (h.get("x-forwarded-for") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    candidate = list.length ? list[Math.max(0, list.length - hops)] : undefined;
  }
  if (!candidate) return null;
  // "[2001:db8::1]:443" or "203.0.113.9:443" from proxies that include the port.
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(candidate);
  const bare = bracketed ? bracketed[1] : /^[\d.]+:\d+$/.test(candidate) ? candidate.slice(0, candidate.lastIndexOf(":")) : candidate;
  return isIP(bare) ? bare : null;
}

/**
 * The rate-limit and lockout key of a client address: an IPv4 address as is and any other IPv6 address as its /64 network,
 * "2001:db8:0:1::/64". A subscriber line or a server is usually handed a whole /64, so keying by the full IPv6 address would
 * let one host rotate through practically unlimited addresses. An IPv6 address that carries an IPv4 client is keyed by that
 * client: an IPv4-mapped address (::ffff:a.b.c.d, as a dual-stack socket reports IPv4 clients) and a NAT64/SIIT translated
 * address (64:ff9b::a.b.c.d, 64:ff9b:1::a.b.c.d), so the IPv4 clients behind one translator do not share one bucket. Elsewhere
 * in the local-use translation prefix 64:ff9b:1::/48 where the IPv4 part sits depends on the translator's prefix length, so
 * those addresses are keyed whole (still one key per IPv4 client). Audit logs keep the full address.
 */
export function ipRateKey(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  // Eight 16-bit groups; an embedded IPv4 tail (::ffff:192.0.2.1, 64:ff9b::192.0.2.1) counts as the last two.
  const s = ip.toLowerCase().replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/, (_, a, b, c, d) => `${((+a << 8) | +b).toString(16)}:${((+c << 8) | +d).toString(16)}`);
  const [head, tail] = s.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = (tail === undefined ? left : [...left, ...Array<string>(8 - left.length - right.length).fill("0"), ...right]).map((g) => parseInt(g, 16));
  const hex = (from: number, to: number) => groups.slice(from, to).map((g) => g.toString(16)).join(":");
  const mapped = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  const nat64 = hex(0, 2) === "64:ff9b" && (groups[2] === 0 || groups[2] === 1);
  if (mapped || (nat64 && groups.slice(3, 6).every((g) => g === 0))) return groups.slice(6).flatMap((g) => [g >> 8, g & 255]).join(".");
  if (nat64 && groups[2] === 1) return hex(0, 8);
  return `${hex(0, 4)}::/64`;
}

/** Client IP. Proxy headers are trusted only behind known reverse proxies (TRUST_PROXY = number of hops). */
export async function clientIp(): Promise<string | null> {
  return clientIpFrom(await headers(), env.TRUST_PROXY, env.CLIENT_IP_HEADER);
}

/**
 * Whether a browser request came from this site. Browsers send Origin on every POST, so a missing
 * header passes (a non-browser client still needs the session cookie) while a malformed or "null"
 * Origin is refused. The Origin host must match the public address (APP_URL), the host a trusted
 * proxy forwarded (X-Forwarded-Host, with TRUST_PROXY > 0) or the Host header itself: a proxy that
 * rewrites Host to the upstream name (nginx's default `proxy_set_header Host $proxy_host`) would
 * otherwise refuse every same-origin request.
 */
export function sameOriginFrom(h: Pick<Headers, "get">, app: string, hops: number): boolean {
  const origin = h.get("origin");
  if (origin === null) return true;
  const host = URL.parse(origin)?.host;
  if (!host) return false;
  // X-Forwarded-Host may list one entry per proxy; the first is the host the client used.
  const forwarded = hops > 0 ? h.get("x-forwarded-host")?.split(",")[0] : undefined;
  return [URL.parse(app)?.host, h.get("host"), forwarded].some((c) => c?.trim().toLowerCase() === host);
}

/** Same-origin check for POST route handlers (CSRF): see sameOriginFrom. */
export function sameOrigin(request: Request): boolean {
  return sameOriginFrom(request.headers, appUrl(), env.TRUST_PROXY);
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent")?.slice(0, 300) ?? null;
}

/** Path of the current request (set by proxy.ts), for sign-in redirects. */
export async function currentPath(): Promise<string> {
  return (await headers()).get("x-pathname") ?? "/";
}
