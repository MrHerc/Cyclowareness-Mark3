/**
 * Ports an administrator may configure for each kind of outbound destination (enforced by
 * src/server/net-guard.ts, shown as hints in Settings). Shared by server and client.
 */
export const DESTINATION_PORTS = { smtp: [25, 465, 587, 2525], webhook: [443, 8443], syslog: [514, 601, 6514], https: [443, 8443] } as const satisfies Record<string, readonly number[]>;

/** Port the syslog form picks for each transport: 6514 for TLS (RFC 5425), 514 for plain TCP and UDP. */
export const SYSLOG_DEFAULT_PORT = { tls: 6514, tcp: 514, udp: 514 } as const;
