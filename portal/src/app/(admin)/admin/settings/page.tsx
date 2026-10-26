import { count, desc, eq, sql } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { Award, Bell, Fingerprint, GraduationCap, Languages, Mail, Palette, PenLine, ShieldCheck, Webhook, type LucideIcon } from "lucide-react";
import { requirePermission } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { appUrl, env } from "@/server/env";
import { DOMAIN_PROOF_GRACE_DAYS } from "@/server/auth/domain-proof";
import { CAMPAIGN_CANCELLED_ERROR, resendableMail } from "@/server/mail";
import type { TenantSettings } from "@/server/db/schema";
import { requestNow } from "@/lib/time";
import { PageHeader, TabsNav } from "@/components/ui/layout";
import {
  AttestationTab,
  BrandingTab,
  CertificateTab,
  EmailTab,
  IdentityTab,
  IntegrationsTab,
  LanguagesTab,
  type EmailView,
  type IdentityView,
  type IntegrationsView,
  LearningTab,
  NotificationsTab,
  ProtectionTab,
} from "@/components/admin/settings-tabs";

const TABS = ["branding", "languages", "identity", "email", "notifications", "attestation", "certificate", "learning", "protection", "integrations"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS: Record<Tab, LucideIcon> = {
  branding: Palette,
  languages: Languages,
  identity: Fingerprint,
  email: Mail,
  notifications: Bell,
  attestation: PenLine,
  certificate: Award,
  learning: GraduationCap,
  protection: ShieldCheck,
  integrations: Webhook,
};

/* Stored secrets are encrypted, but they still must not reach the browser: the tabs get "is set" flags. */
function identityView({ sso, ldap, ...rest }: TenantSettings["identity"]): IdentityView {
  return {
    ...rest,
    sso: sso ? (({ clientSecretEnc, ...s }) => ({ ...s, hasClientSecret: !!clientSecretEnc }))(sso) : undefined,
    ldap: ldap ? (({ passwordEnc, ...l }) => ({ ...l, hasPassword: !!passwordEnc }))(ldap) : undefined,
  };
}
function emailView({ passwordEnc, ...rest }: TenantSettings["email"]): EmailView {
  return { ...rest, hasPassword: !!passwordEnc };
}
function integrationsView({ webhookSecretEnc, ...rest }: TenantSettings["integrations"]): IntegrationsView {
  return { ...rest, hasWebhookSecret: !!webhookSecretEnc };
}

export async function generateMetadata() {
  const tr = await getTranslations("settings");
  return { title: tr("title") };
}

export default async function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  const v = await requirePermission("settings.write");
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "branding";
  const tr = await getTranslations("settings");
  const s = v.tenant.settings;
  const base = appUrl();

  let body: React.ReactNode;
  switch (tab) {
    case "branding": {
      const [row] = await db().select({ domain: t.tenants.domain, verifiedAt: t.tenants.domainVerifiedAt }).from(t.tenants).where(eq(t.tenants.id, v.tenant.id));
      // Dates are formatted on the server: some browsers ship without every locale's date data.
      const format = await getFormatter();
      // The daily re-check stopped finding the record: the proof ends after the grace period.
      const failingSince = row?.verifiedAt && !s.identity.domainProofForced && s.identity.domainCheckFailingSince ? new Date(s.identity.domainCheckFailingSince) : null;
      const lapsing =
        failingSince && !Number.isNaN(failingSince.getTime())
          ? { since: format.dateTime(failingSince, { dateStyle: "medium" }), endsOn: format.dateTime(new Date(failingSince.getTime() + DOMAIN_PROOF_GRACE_DAYS * 86_400_000), { dateStyle: "medium" }) }
          : null;
      body = (
        <BrandingTab
          name={v.tenant.name}
          branding={v.tenant.branding}
          domain={row?.domain ?? null}
          verifiedOn={row?.verifiedAt ? format.dateTime(row.verifiedAt, { dateStyle: "medium" }) : null}
          lapsing={lapsing}
        />
      );
      break;
    }
    case "languages":
      body = <LanguagesTab defaultLocale={s.defaultLocale} locales={s.locales} />;
      break;
    case "identity":
      body = (
        <IdentityTab
          identity={identityView(s.identity)}
          redirectUri={`${base}/api/sso/callback/${v.tenant.slug}`}
          signInLink={`${base}/api/sso/start?tenant=${v.tenant.slug}`}
          testResult={sp.ssoTest === "ok" || sp.ssoTest === "failed" ? sp.ssoTest : null}
        />
      );
      break;
    case "email": {
      const rows = await db()
        .select({ id: t.outbox.id, to: t.outbox.to, subject: t.outbox.subject, status: t.outbox.status, createdAt: t.outbox.createdAt, error: t.outbox.error, resendable: sql<boolean>`(${resendableMail(v.tenant.id, requestNow())})` })
        .from(t.outbox)
        .where(eq(t.outbox.tenantId, v.tenant.id))
        .orderBy(desc(t.outbox.createdAt))
        .limit(20);
      const [failed] = await db()
        .select({ n: count() })
        .from(t.outbox)
        .where(resendableMail(v.tenant.id, requestNow()));
      body = <EmailTab email={emailView(s.email)} viewerEmail={v.user.email} outbox={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), resendable: !!r.resendable, cancelled: r.error === CAMPAIGN_CANCELLED_ERROR }))} failedCount={Number(failed?.n ?? 0)} />;
      break;
    }
    case "notifications":
      body = <NotificationsTab notifications={s.notifications} locales={s.locales} emailReady={s.email.enabled} orgName={v.tenant.name} />;
      break;
    case "attestation":
      body = <AttestationTab texts={s.attestationText} locales={s.locales} />;
      break;
    case "certificate":
      body = <CertificateTab cert={s.certificate} orgName={v.tenant.name} logoUrl={v.tenant.branding.logoUrl} locale={v.user.locale} locales={s.locales} verifyHost={new URL(env.APP_URL).host} />;
      break;
    case "learning":
      body = <LearningTab learning={s.learning} />;
      break;
    case "protection":
      body = <ProtectionTab protection={s.protection} />;
      break;
    case "integrations": {
      const rows = await db()
        .select({ id: t.webhookDeliveries.id, event: t.webhookDeliveries.event, target: t.webhookDeliveries.target, status: t.webhookDeliveries.status, responseCode: t.webhookDeliveries.responseCode, createdAt: t.webhookDeliveries.createdAt })
        .from(t.webhookDeliveries)
        .where(eq(t.webhookDeliveries.tenantId, v.tenant.id))
        .orderBy(desc(t.webhookDeliveries.createdAt))
        .limit(20);
      body = <IntegrationsTab integrations={integrationsView(s.integrations)} deliveries={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))} />;
      break;
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader title={tr("title")} subtitle={v.tenant.name} />
      <TabsNav
        variant="segmented"
        label={tr("title")}
        items={TABS.map((k) => {
          const Icon = TAB_ICONS[k];
          return { href: `?tab=${k}`, label: tr(`tabs.${k}`), active: tab === k, icon: <Icon /> };
        })}
      />
      {/* key resets client state when switching tabs */}
      <div key={tab}>{body}</div>
    </div>
  );
}
