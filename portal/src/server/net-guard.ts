import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { DESTINATION_PORTS } from "../lib/destination-ports";

/**
 * Outbound destinations that tenant administrators configure (SMTP server, webhook, syslog)
 * must be public hosts on the expected ports: in a multi-tenant deployment a customer must not
 * be able to turn the platform into a scanner of its own network. The check runs when the
 * setting is saved and again right before each connection (names can be re-pointed later).
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

/** Unspecified, loopback, unique-local, link-local, multicast, and IPv4-mapped/translated addresses that embed a private IPv4. */
export function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v) ?? /^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  if (mapped) return isPrivateIPv4(mapped[1]);
  const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v);
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16);
    const lo = parseInt(hexMapped[2], 16);
    return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  if (v === "::" || v === "::1") return true;
  const first = parseInt(v.split(":")[0] || "0", 16);
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00;
}

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  return kind === 4 ? isPrivateIPv4(ip) : kind === 6 ? isPrivateIPv6(ip) : true;
}

/** Why `host:port` must not be used as a `kind` destination, or null when it is acceptable. */
export async function destinationProblem(host: string, port: number, kind: DestinationKind): Promise<DestinationProblem | null> {
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  if (!h || h.length > 253 || /[^a-z0-9.:[\]-]/.test(h)) return "invalid_host";
  if (!PORTS[kind].includes(port)) return "port_not_allowed";
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return "private_address";
  if (isIP(h.replace(/^\[|\]$/g, ""))) return isPrivateAddress(h.replace(/^\[|\]$/g, "")) ? "private_address" : null;
  let addresses: { address: string }[];
  try {
    addresses = await lookup(h, { all: true });
  } catch {
    return "unresolvable";
  }
  if (!addresses.length) return "unresolvable";
  // Every answer must be public: a name that also resolves to a private address is a rebinding trick.
  return addresses.some((a) => isPrivateAddress(a.address)) ? "private_address" : null;
}
