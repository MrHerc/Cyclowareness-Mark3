import type { DB } from "../db/client";
import * as t from "../db/schema";

/**
 * Audit actions (docs/audit/03-admin-panel.md §9). The UI shows a human sentence per action,
 * the "Change" column shows the code itself.
 */
export const AUDIT_ACTIONS = [
  "auth.sign_in",
  "auth.sign_in_refused",
  "auth.sign_out",
  "auth.device_limit",
  "auth.password_reset_requested",
  "auth.password_set",
  "auth.2fa_on",
  "auth.2fa_off",
  "auth.2fa_reset",
  "auth.backup_codes",
  "auth.other_devices_signed_out",
  "sso.tested",
  "sso.sign_in_refused",
  "sso.person_created",
  "sso.unlinked",
  "person.added",
  "person.changed",
  "person.role_changed",
  "person.moved",
  "person.suspended",
  "person.reactivated",
  "person.deleted",
  "people.imported",
  "people.exported",
  "people.invites_emailed",
  "person.invite_link",
  "person.invite_links_bulk",
  "person.reset_link",
  "person.data_downloaded",
  "person.deletion_requested",
  "person.deletion_approved",
  "person.deletion_declined",
  "department.created",
  "department.renamed",
  "department.moved",
  "department.deleted",
  "department.merged",
  "assignment.created",
  "assignment.due_changed",
  "assignment.removed",
  "attestation.reminder",
  "learning.completion_refused",
  "campaign.created",
  "campaign.changed",
  "campaign.launched",
  "campaign.cancelled",
  "campaign.launch_blocked",
  "drill.started",
  "drill.finished",
  "report.downloaded",
  "report.compliance_pack",
  "report.schedule_created",
  "report.schedule_removed",
  "certificate.downloaded",
  "policy.created",
  "policy.version_published",
  "policy.archived",
  "policy.restored",
  "policy.signed",
  "policy.reminder",
  "policy.signoffs_downloaded",
  "settings.branding",
  "branding.logo",
  "domain.verified",
  "domain.rechecked",
  "domain.at_risk",
  "domain.removed",
  "settings.languages",
  "settings.timezone",
  "settings.identity",
  "settings.email",
  "settings.email_tested",
  "settings.notifications",
  "settings.attestation",
  "settings.certificate",
  "settings.learning",
  "settings.protection",
  "settings.retention",
  "settings.integrations",
  "settings.webhook_secret",
  "settings.integration_test",
  "settings.setup_guide",
  "watermark.lookup",
  "problem.status",
  "tutor.cache_removed",
  "threat.reported",
  "threat.triaged",
  "sandbox.analyzed",
  "sandbox.escalated",
  "incident.created",
  "incident.changed",
  "incident.auto_training",
  "loop.advanced",
  "loop.closed",
  "material.created",
  "material.approved",
  "material.rejected",
  "material.edited",
  "intel.reviewed",
  "intel.converted",
  "intel.dismissed",
  "module.created",
  "module.published",
  "module.deleted",
  "path.created",
  "path.changed",
  "session.created",
  "session.changed",
  "session.deleted",
  "session.attendance",
  "ticket.created",
  "ticket.replied",
  "ticket.status",
  "feedback.reviewed",
  "tenant.created",
  "tenant.changed",
  "platform.admin_link",
  "demo.status",
  "demo.deleted",
  "demo.exported",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * PostgreSQL cannot store U+0000 in text or jsonb, and audit entries carry caller-supplied strings
 * (filters, names, user agents). It is removed everywhere, keys included, so no entry can fail to be
 * written because of it. Only plain objects and arrays are walked; other values keep their JSON form.
 */
export function withoutNul<T>(value: T): T {
  if (typeof value === "string") return value.replaceAll("\u0000", "") as T;
  if (Array.isArray(value)) return value.map(withoutNul) as T;
  if (value !== null && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k.replaceAll("\u0000", ""), withoutNul(v)])) as T;
  }
  return value;
}

export async function audit(
  db: DB,
  entry: {
    tenantId: string;
    actorId: string | null;
    action: AuditAction;
    targetType?: string;
    targetId?: string;
    meta?: Record<string, unknown>;
    ip?: string | null;
    at?: Date;
  },
): Promise<void> {
  await db.insert(t.auditLog).values({
    tenantId: entry.tenantId,
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType === undefined ? null : withoutNul(entry.targetType),
    targetId: entry.targetId === undefined ? null : withoutNul(entry.targetId),
    meta: entry.meta === undefined ? null : withoutNul(entry.meta),
    ip: entry.ip == null ? null : withoutNul(entry.ip),
    ...(entry.at ? { at: entry.at } : {}),
  });
}
