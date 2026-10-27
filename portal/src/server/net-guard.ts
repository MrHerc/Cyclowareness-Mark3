import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { DESTINATION_PORTS } from "../lib/destination-ports";

/**
 * Outbound destinations that tenant administrators configure (SMTP server, webhook, syslog)
 * must be public hosts on the expected ports: in a multi-tenant deployment a customer must not
 * be able to turn the platform into a scanner of its own network. The check runs when the
 * setting is saved and again right before each connection (names can be re-pointed later),
 * and the connection then goes to the addresses the check approved (pinnedLookup).
 */

export type DestinationKind = "smtp" | "webhook" | "syslog" | "https";
export type DestinationProblem = "invalid_host" | "unresolvable" | "private_address" | "port_not_allowed";

const PORTS: Record<DestinationKind, readonly number[]> = DESTINATION_PORTS;

/** Loopback, private, link-local, carrier-grade NAT, documentation, multicast and reserved IPv4 ranges. */
export function isPrivateIPv4(ip: string): boolean {
  const o = ip.split(".").map(Number);
  if (o.length !== 4 || o.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = o;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && o[2] === 0) ||
    (a === 192 && b === 0 && o[2] === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && o[2] === 100) ||
    (a === 203 && b === 0 && o[2] === 113) ||
    a >= 224
  );
}

/**
 * Unspecified, loopback, unique-local, link-local, site-local, multicast, and IPv4-mapped/translated addresses that embed
 * a private IPv4, in any spelling (0:0:0:0:0:ffff:7f00:1 is ::ffff:127.0.0.1). Anything that is not an IPv6 address counts as private.
 */
export function isPrivateIPv6(ip: string): boolean {
  const v = ip.replace(/^\[|\]$/g, "").split("%")[0];
  // The URL parser writes the canonical form (lowercase, longest zero run as "::", no dotted quad); expand it to eight groups.
  const host = isIP(v) === 6 ? URL.parse(`http://[${v}]`)?.hostname.slice(1, -1) : undefined;
  if (!host) return true;
  const [head, tail] = host.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const g = [...left, ...Array<string>(8 - left.length - right.length).fill("0"), ...right].map((x) => parseInt(x, 16));
  const zero = (from: number, to: number) => g.slice(from, to).every((x) => x === 0);
  // ::/96 holds ::, ::1 and the deprecated IPv4-compatible form: never a destination.
  if (zero(0, 6)) return true;
  // IPv4-mapped ::ffff:a.b.c.d, IPv4-translated ::ffff:0:a.b.c.d and NAT64 64:ff9b::a.b.c.d reach an IPv4 address.
  if ((zero(0, 5) && g[5] === 0xffff) || (zero(0, 4) && g[4] === 0xffff && g[5] === 0) || (g[0] === 0x64 && g[1] === 0xff9b && zero(2, 6))) {
    return isPrivateIPv4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  }
  // The local-use NAT64 prefix 64:ff9b:1::/48 (RFC 8215) translates into whatever the operator's network holds.
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 1) return true;
  return (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xffc0) === 0xfec0 || (g[0] & 0xff00) === 0xff00;
}

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  return kind === 4 ? isPrivateIPv4(ip) : kind === 6 ? isPrivateIPv6(ip) : true;
}

/** The outcome of the check: a problem, or the public addresses the destination may be reached at. */
export type VettedDestination = { problem: DestinationProblem } | { problem: null; addresses: LookupAddress[] };

/** Why `host:port` must not be used as a `kind` destination, or the addresses to connect to (see pinnedLookup). */
export async function vetDestination(host: string, port: number, kind: DestinationKind): Promise<VettedDestination> {
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  if (!h || h.length > 253 || /[^a-z0-9.:[\]-]/.test(h)) return { problem: "invalid_host" };
  if (!PORTS[kind].includes(port)) return { problem: "port_not_allowed" };
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return { problem: "private_address" };
  const literal = h.replace(/^\[|\]$/g, "");
  const family = isIP(literal);
  if (family) return isPrivateAddress(literal) ? { problem: "private_address" } : { problem: null, addresses: [{ address: literal, family }] };
  let addresses: LookupAddress[];
  try {
    addresses = await lookup(h, { all: true });
  } catch {
    return { problem: "unresolvable" };
  }
  if (!addresses.length) return { problem: "unresolvable" };
  // Every answer must be public: a name that also resolves to a private address is a rebinding trick.
  return addresses.some((a) => isPrivateAddress(a.address)) ? { problem: "private_address" } : { problem: null, addresses };
}

/** Why `host:port` must not be used as a `kind` destination, or null when it is acceptable. */
export async function destinationProblem(host: string, port: number, kind: DestinationKind): Promise<DestinationProblem | null> {
  return (await vetDestination(host, port, kind)).problem;
}

/**
 * A `lookup` for net, tls and http connections that answers with the addresses vetDestination approved, so the
 * connection does not resolve the name a second time, to another (private) address: DNS rebinding.
 */
export function pinnedLookup(addresses: LookupAddress[]): LookupFunction {
  return (_hostname, options, callback) => setImmediate(() => (options.all ? callback(null, addresses) : callback(null, addresses[0].address, addresses[0].family)));
}

export type GuardedResponse = { status: number; headers: IncomingHttpHeaders; body: Buffer };

/**
 * An HTTPS request to a server a tenant configured. The destination is vetted and the connection pinned to the vetted
 * addresses; redirects are not followed; the body is never decompressed (no zlib on bytes the tenant's server chose)
 * and a body over `maxBytes` fails the request (0: the body is not read). `vet: false` skips the check and allows plain
 * http (identity providers on localhost during development).
 */
export async function guardedRequest(
  url: string,
  o: { kind: DestinationKind; maxBytes: number; vet?: boolean; method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number },
): Promise<GuardedResponse> {
  const u = new URL(url);
  let lookup: LookupFunction | undefined;
  if (o.vet !== false) {
    if (u.protocol !== "https:") throw new Error("insecure_endpoint");
    const v = await vetDestination(u.hostname, Number(u.port || 443), o.kind);
    if (v.problem !== null) throw new Error(v.problem);
    lookup = pinnedLookup(v.addresses);
  }
  const headers = o.body === undefined ? o.headers : { ...o.headers, "content-length": String(Buffer.byteLength(o.body)) };
  const send = u.protocol === "http:" ? httpRequest : httpsRequest;
  return new Promise((resolve, reject) => {
    // Like fetch's "fetch failed": one message for every connection, TLS and timeout failure, the details in `cause`.
    const fail = (e: Error) => reject(e.message === "response_too_large" ? e : new Error("request_failed", { cause: e }));
    // agent: false, so no pooled socket (connected after another check) is reused.
    const req = send(u, { method: o.method ?? "GET", headers, lookup, agent: false, signal: AbortSignal.timeout(o.timeoutMs ?? 10_000) }, (res) => {
      const done = (body: Buffer) => resolve({ status: res.statusCode ?? 0, headers: res.headers, body });
      res.on("error", fail);
      if (o.maxBytes === 0) {
        res.destroy();
        return done(Buffer.alloc(0));
      }
      if (Number(res.headers["content-length"]) > o.maxBytes) return void res.destroy(new Error("response_too_large"));
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > o.maxBytes) res.destroy(new Error("response_too_large"));
        else chunks.push(chunk);
      });
      res.on("end", () => done(Buffer.concat(chunks)));
    });
    req.on("error", fail);
    req.end(o.body);
  });
}
