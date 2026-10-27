import type { Role } from "../db/schema";
import type { Feature } from "../../lib/tenant-defaults";

/**
 * Role-based access. Cyclowareness's six tenant roles plus the executive view and the
 * platform operator. Data scoping (a department head sees only their departments) is applied
 * separately in the queries.
 */
export const PERMISSIONS = {
  "admin.access": ["department_head", "executive", "analyst", "campaign_manager", "content_creator", "tenant_admin", "super_admin"],
  "overview.read": ["department_head", "analyst", "campaign_manager", "content_creator", "tenant_admin", "super_admin"],
  "people.read": ["department_head", "analyst", "tenant_admin", "super_admin"],
  "people.write": ["tenant_admin", "super_admin"],
  "departments.write": ["tenant_admin", "super_admin"],
  "assignments.read": ["department_head", "content_creator", "tenant_admin", "super_admin"],
  "assignments.write": ["content_creator", "tenant_admin", "super_admin"],
  "campaigns.read": ["campaign_manager", "analyst", "tenant_admin", "super_admin"],
  "campaigns.write": ["campaign_manager", "tenant_admin", "super_admin"],
  "policies.read": ["content_creator", "tenant_admin", "super_admin"],
  "policies.write": ["content_creator", "tenant_admin", "super_admin"],
  "problems.manage": ["content_creator", "tenant_admin", "super_admin"],
  "reports.read": ["department_head", "executive", "analyst", "tenant_admin", "super_admin"],
  "league.read": ["department_head", "executive", "analyst", "campaign_manager", "content_creator", "tenant_admin", "super_admin"],
  "audit.read": ["analyst", "tenant_admin", "super_admin"],
  "settings.write": ["tenant_admin", "super_admin"],
  "secops.read": ["analyst", "tenant_admin", "super_admin"],
  "secops.write": ["analyst", "tenant_admin", "super_admin"],
  "approvals.decide": ["analyst", "tenant_admin", "super_admin"],
  "intel.read": ["analyst", "content_creator", "tenant_admin", "super_admin"],
  "studio.write": ["content_creator", "analyst", "tenant_admin", "super_admin"],
  "paths.write": ["content_creator", "tenant_admin", "super_admin"],
  "sessions.write": ["content_creator", "tenant_admin", "super_admin"],
  "leadership.read": ["executive", "tenant_admin", "super_admin"],
  "support.manage": ["analyst", "tenant_admin", "super_admin"],
  "feedback.read": ["content_creator", "tenant_admin", "super_admin"],
  "platform.manage": ["super_admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Features a permission needs on the tenant's plan (a permission without an entry is always on). */
export const PERMISSION_FEATURE: Partial<Record<Permission, Feature>> = {
  "campaigns.read": "campaigns",
  "campaigns.write": "campaigns",
  "policies.read": "policies",
  "policies.write": "policies",
  "secops.read": "threat_intake",
  "secops.write": "threat_intake",
  "approvals.decide": "approvals",
  "intel.read": "threat_intel",
  "studio.write": "studio",
  "leadership.read": "leadership",
  "sessions.write": "live_sessions",
  "reports.read": "reports",
  "league.read": "league",
  "paths.write": "paths",
  "support.manage": "support",
  "feedback.read": "feedback",
};

/** Roles an administrator may hand out (super admin is platform-only). */
export const ASSIGNABLE_ROLES: Role[] = ["learner", "department_head", "executive", "analyst", "campaign_manager", "content_creator", "tenant_admin"];

/** Roles that always use a password plus two-step sign-in (never SSO or phone codes). */
export const PRIVILEGED_ROLES: Role[] = ["tenant_admin", "super_admin", "analyst", "campaign_manager"];

export function isPrivileged(role: Role): boolean {
  return PRIVILEGED_ROLES.includes(role);
}

/** Roles that open the admin console (every role but learner). They never sign in with a text-message code. */
export function isConsoleRole(role: Role): boolean {
  return can(role, "admin.access");
}

/**
 * Whether two-step verification is mandatory for a role: always for the platform operator, and for every console role when
 * the organisation's "require two-step verification" rule is on (the default for new organisations).
 */
export function twoFactorRequired(role: Role, organisationRequires: boolean): boolean {
  return role === "super_admin" || (organisationRequires && isConsoleRole(role));
}
