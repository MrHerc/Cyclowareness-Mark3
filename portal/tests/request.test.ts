import { describe, expect, it } from "vitest";
import { clientIpFrom, ipRateKey, sameOriginFrom } from "../src/server/request";

const h = (values: Record<string, string>) => new Headers(values);

describe("clientIpFrom", () => {
  it("ignores proxy headers when no proxy is trusted", () => {
    expect(clientIpFrom(h({ "x-forwarded-for": "203.0.113.9" }), 0)).toBeNull();
  });

  it("takes the address the trusted proxy appended, not what the client sent", () => {
    // nginx proxy_add_x_forwarded_for keeps the client's header and appends the real peer.
    expect(clientIpFrom(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }), 1)).toBe("203.0.113.9");
    expect(clientIpFrom(h({ "x-forwarded-for": "203.0.113.9" }), 1)).toBe("203.0.113.9");
  });

  it("counts hops from the right for several proxies", () => {
    // client-forged, real client, CDN edge (appended by the load balancer)
    expect(clientIpFrom(h({ "x-forwarded-for": "6.6.6.6, 198.51.100.7, 203.0.113.50" }), 2)).toBe("198.51.100.7");
    expect(clientIpFrom(h({ "x-forwarded-for": "198.51.100.7" }), 3)).toBe("198.51.100.7");
  });

  it("drops values that are not IP addresses and strips ports", () => {
    expect(clientIpFrom(h({ "x-forwarded-for": "evil, <script>" }), 1)).toBeNull();
    expect(clientIpFrom(h({ "x-forwarded-for": "203.0.113.9:51234" }), 1)).toBe("203.0.113.9");
    expect(clientIpFrom(h({ "x-forwarded-for": "[2001:db8::1]:443" }), 1)).toBe("2001:db8::1");
    expect(clientIpFrom(h({ "x-forwarded-for": "2001:db8::1" }), 1)).toBe("2001:db8::1");
  });

  it("reads X-Real-IP only when configured", () => {
    const both = h({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "203.0.113.9" });
    expect(clientIpFrom(both, 1, "x-real-ip")).toBe("203.0.113.9");
    expect(clientIpFrom(both, 1)).toBe("6.6.6.6");
    expect(clientIpFrom(h({ "x-real-ip": "not-an-ip" }), 1, "x-real-ip")).toBeNull();
  });
});

describe("ipRateKey", () => {
  it("keeps IPv4 addresses and reports IPv4-mapped IPv6 addresses as IPv4", () => {
    expect(ipRateKey("203.0.113.9")).toBe("203.0.113.9");
    expect(ipRateKey("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(ipRateKey("0:0:0:0:0:ffff:cb00:7109")).toBe("203.0.113.9");
  });

  it("groups IPv6 addresses by their /64, whatever the spelling", () => {
    expect(ipRateKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(ipRateKey("2001:DB8:0:0:ffff:1234:5678:9abc")).toBe("2001:db8:0:0::/64");
    expect(ipRateKey("2001:0db8:0001:0002:0003:0004:0005:0006")).toBe("2001:db8:1:2::/64");
    expect(ipRateKey("2001:db8:1:2::")).toBe("2001:db8:1:2::/64");
    expect(ipRateKey("2001:db8:1:3::1")).not.toBe(ipRateKey("2001:db8:1:2::1"));
    expect(ipRateKey("::1")).toBe("0:0:0:0::/64");
  });

  it("keys a NAT64/SIIT translated address by the IPv4 client it carries", () => {
    // Well-known prefix 64:ff9b::/96, dotted and hex spellings.
    expect(ipRateKey("64:ff9b::192.0.2.1")).toBe("192.0.2.1");
    expect(ipRateKey("64:ff9b::c000:201")).toBe("192.0.2.1");
    expect(ipRateKey("0064:FF9B:0000:0000:0000:0000:C000:0201")).toBe("192.0.2.1");
    expect(ipRateKey("64:ff9b::198.51.100.7")).not.toBe(ipRateKey("64:ff9b::192.0.2.1"));
    // Local-use prefix 64:ff9b:1::/48 with the IPv4 client in the last 32 bits.
    expect(ipRateKey("64:ff9b:1::203.0.113.9")).toBe("203.0.113.9");
    expect(ipRateKey("64:ff9b:1::cb00:7109")).toBe("203.0.113.9");
    // Elsewhere in the local-use /48 the IPv4 position depends on the translator, so the address is keyed whole:
    // never one shared /64 bucket for every client behind the translator.
    expect(ipRateKey("64:ff9b:1:abcd::c000:201")).toBe("64:ff9b:1:abcd:0:0:c000:201");
    expect(ipRateKey("64:ff9b:1:abcd::c633:6407")).not.toBe(ipRateKey("64:ff9b:1:abcd::c000:201"));
    // Not a translation prefix: ordinary /64 grouping.
    expect(ipRateKey("64:ff9b:2::c000:201")).toBe("64:ff9b:2:0::/64");
    expect(ipRateKey("64:ff9b:0:1::c000:201")).toBe("64:ff9b:0:1::/64");
  });
});

describe("sameOriginFrom", () => {
  const app = "https://app.example.com";

  it("accepts a request whose Origin matches the Host header", () => {
    expect(sameOriginFrom(h({ origin: "https://app.example.com", host: "app.example.com" }), app, 0)).toBe(true);
    expect(sameOriginFrom(h({ origin: "http://localhost:3000", host: "localhost:3000" }), "http://localhost:3000", 0)).toBe(true);
  });

  it("accepts the public APP_URL when the proxy rewrites Host to the upstream name", () => {
    // nginx default: proxy_set_header Host $proxy_host
    expect(sameOriginFrom(h({ origin: "https://app.example.com", host: "portal:3000" }), app, 0)).toBe(true);
    expect(sameOriginFrom(h({ origin: "https://App.Example.com", host: "portal:3000" }), app, 1)).toBe(true);
  });

  it("trusts X-Forwarded-Host only behind a trusted proxy", () => {
    const headers = h({ origin: "https://other.example.com", host: "portal:3000", "x-forwarded-host": "other.example.com, portal:3000" });
    expect(sameOriginFrom(headers, app, 1)).toBe(true);
    expect(sameOriginFrom(headers, app, 0)).toBe(false);
  });

  it("refuses cross-origin, null and malformed Origins but lets a request without one through", () => {
    expect(sameOriginFrom(h({ origin: "https://evil.example", host: "app.example.com" }), app, 1)).toBe(false);
    expect(sameOriginFrom(h({ origin: "null", host: "app.example.com" }), app, 1)).toBe(false);
    expect(sameOriginFrom(h({ origin: "not a url", host: "app.example.com" }), app, 1)).toBe(false);
    expect(sameOriginFrom(h({ host: "portal:3000" }), app, 0)).toBe(true);
  });
});
