/** What a reporting-API token may read (docs/API.md "Reporting API"); never a write. */
export const API_TOKEN_PERMISSIONS = ["reports.read", "people.read", "audit.read"] as const;
export type ApiTokenPermission = (typeof API_TOKEN_PERMISSIONS)[number];
/** Active tokens an organisation may hold at once. */
export const MAX_API_TOKENS = 20;
