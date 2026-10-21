import { describe, expect, it } from "vitest";
import { destinationProblem, isPrivateAddress, isPrivateIPv4, isPrivateIPv6 } from "../src/server/net-guard";
import { DESTINATION_PORTS, SYSLOG_DEFAULT_PORT } from "../src/lib/destination-ports";

describe("private address detection", () => {
  it("flags loopback, private, link-local, CGNAT and reserved IPv4", () => {
    for (const ip of ["127.0.0.1", "127.255.255.254", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "100.127.255.255", "0.0.0.0", "224.0.0.1", "255.255.255.255", "192.0.2.1", "198.18.0.1"]) {
      expect(isPrivateIPv4(ip), ip).toBe(true);
    }
  });
  it("accepts public IPv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "100.128.0.1", "93.184.216.34", "203.0.112.1"]) expect(isPrivateIPv4(ip), ip).toBe(false);
  });
  it("flags IPv6 loopback, ULA, link-local, multicast and mapped private IPv4", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:7f00:1", "64:ff9b::10.0.0.1", "[::1]", "fe80::1%eth0"]) {
      expect(isPrivateIPv6(ip), ip).toBe(true);
    }
  });
  it("accepts public IPv6", () => {
    for (const ip of ["2001:4860:4860::8888", "2606:4700::1111", "::ffff:8.8.8.8"]) expect(isPrivateIPv6(ip), ip).toBe(false);
  });
  it("treats anything that is not an IP as private", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
  });
});

describe("destinationProblem", () => {
  it("rejects loopback, local names and private literals without DNS", async () => {
    expect(await destinationProblem("localhost", 587, "smtp")).toBe("private_address");
    expect(await destinationProblem("mail.corp.local", 587, "smtp")).toBe("private_address");
    expect(await destinationProblem("127.0.0.1", 443, "webhook")).toBe("private_address");
    expect(await destinationProblem("[::1]", 6514, "syslog")).toBe("private_address");
    expect(await destinationProblem("169.254.169.254", 443, "webhook")).toBe("private_address");
  });
  it("rejects unexpected ports before resolving", async () => {
    expect(await destinationProblem("example.com", 6379, "smtp")).toBe("port_not_allowed");
    expect(await destinationProblem("example.com", 80, "webhook")).toBe("port_not_allowed");
    expect(await destinationProblem("example.com", 22, "syslog")).toBe("port_not_allowed");
  });
  it("rejects malformed hosts", async () => {
    expect(await destinationProblem("", 587, "smtp")).toBe("invalid_host");
    expect(await destinationProblem("bad host", 587, "smtp")).toBe("invalid_host");
    expect(await destinationProblem("a".repeat(260), 587, "smtp")).toBe("invalid_host");
  });
  it("accepts public literals", async () => {
    expect(await destinationProblem("8.8.8.8", 587, "smtp")).toBeNull();
    expect(await destinationProblem("2001:4860:4860::8888", 443, "webhook")).toBeNull();
  });
});

describe("syslog transport defaults", () => {
  it("picks a port the destination check accepts for every transport", async () => {
    for (const [transport, port] of Object.entries(SYSLOG_DEFAULT_PORT)) {
      expect(DESTINATION_PORTS.syslog, transport).toContain(port);
      expect(await destinationProblem("8.8.8.8", port, "syslog"), transport).toBeNull();
    }
  });
  it("reports a disallowed port as a port problem, not a host problem", async () => {
    expect(await destinationProblem("8.8.8.8", 5514, "syslog")).toBe("port_not_allowed");
    expect(await destinationProblem("8.8.8.8", 2465, "smtp")).toBe("port_not_allowed");
  });
});
