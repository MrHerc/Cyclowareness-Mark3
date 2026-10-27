import { createServer, connect, type AddressInfo, type Server } from "node:net";
import { createSocket } from "node:dgram";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { destinationProblem, isPrivateIPv6, pinnedLookup, vetDestination } from "../src/server/net-guard";
import { sendSyslog } from "../src/server/jobs";

/** Spellings of internal addresses that a string match on the canonical form let through. */
const PRIVATE_SPELLINGS = [
  "0:0:0:0:0:0:0:1",
  "0::1",
  "::0:1",
  "0:0:0:0:0:0:0:0",
  "0:0:0:0:0:ffff:7f00:1",
  "0:0:0:0:0:ffff:a00:5",
  "0::ffff:a9fe:a9fe",
  "::0:ffff:10.0.0.5",
  "0:0:0:0:0:ffff:10.0.0.5",
  "0::ffff:127.0.0.1",
  "::FFFF:7F00:1",
  "::ffff:0:a00:5",
  "::127.0.0.1",
  "::8.8.8.8",
  "64:ff9b::a00:5",
  "64:ff9b:0:0:0:0:a00:5",
  "64:ff9b:1::a00:5",
  "FE80::1",
  "febf:ffff::1",
  "fe80:0:0:0:0:0:0:1%eth0",
  "fec0::1",
  "fc00::",
  "FD00:0:0:0:0:0:0:1",
  "ff02:0::1",
];

describe("IPv6 in any spelling", () => {
  it("flags every spelling of loopback, unspecified, mapped, translated, NAT64, link-local, ULA and multicast", () => {
    for (const ip of PRIVATE_SPELLINGS) expect(isPrivateIPv6(ip), ip).toBe(true);
  });

  it("keeps public addresses, also when an IPv4 one is mapped or translated", () => {
    for (const ip of ["2001:4860:4860::8888", "2001:4860:4860:0:0:0:0:8888", "::ffff:8.8.8.8", "0:0:0:0:0:ffff:808:808", "64:ff9b::808:808", "2606:4700::1111"]) {
      expect(isPrivateIPv6(ip), ip).toBe(false);
    }
  });

  it("fails closed on anything that is not an IPv6 address", () => {
    for (const ip of ["", "zz::1", "1:2:3:4:5:6:7:8:9", "::1]@evil.example/", "8.8.8.8"]) expect(isPrivateIPv6(ip), ip).toBe(true);
  });

  it("refuses those spellings as syslog and SMTP destinations", async () => {
    for (const ip of PRIVATE_SPELLINGS.filter((s) => !s.includes("%"))) {
      expect(await destinationProblem(ip, 514, "syslog"), ip).toBe("private_address");
      expect(await destinationProblem(`[${ip}]`, 587, "smtp"), ip).toBe("private_address");
    }
  });
});

describe("connections go to the approved address", () => {
  let server: Server;
  let port = 0;
  const received: string[] = [];

  beforeAll(async () => {
    // A client that hangs up resets the connection (on Windows): not a failure here.
    server = createServer((socket) => socket.on("data", (d) => received.push(d.toString())).on("error", () => undefined));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("returns the literal itself as the address to use", async () => {
    expect(await vetDestination("[2001:4860:4860::8888]", 6514, "syslog")).toEqual({ problem: null, addresses: [{ address: "2001:4860:4860::8888", family: 6 }] });
    expect(await vetDestination("8.8.8.8", 587, "smtp")).toEqual({ problem: null, addresses: [{ address: "8.8.8.8", family: 4 }] });
  });

  it("never resolves the name again: a pinned socket reaches the pinned address under a name that does not exist", async () => {
    const socket = connect({ host: "rebind.invalid", port, lookup: pinnedLookup([{ address: "127.0.0.1", family: 4 }]) });
    await new Promise<void>((resolve, reject) => socket.once("connect", resolve).once("error", reject));
    expect(socket.remoteAddress).toBe("127.0.0.1");
    socket.destroy();
  });

  it("sends syslog over TCP to the approved address, not to a fresh lookup of the name", async () => {
    await sendSyslog("rebind.invalid", [{ address: "127.0.0.1", family: 4 }], port, "tcp", "<134>1 test");
    await expect.poll(() => received.join("")).toBe("11 <134>1 test");
  });

  it("sends syslog over UDP to the approved address", async () => {
    const udp = createSocket("udp4");
    const got = new Promise<string>((resolve) => udp.once("message", (m) => resolve(m.toString())));
    await new Promise<void>((resolve) => udp.bind(0, "127.0.0.1", resolve));
    await sendSyslog("rebind.invalid", [{ address: "127.0.0.1", family: 4 }], udp.address().port, "udp", "<134>1 udp");
    expect(await got).toBe("<134>1 udp");
    udp.close();
  });
});
