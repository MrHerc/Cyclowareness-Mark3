import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, count, eq, inArray, isNotNull } from "drizzle-orm";
import { BookOpenCheck } from "lucide-react";
import { db, t } from "@/server/db";
import { allowed, requireViewer, type Viewer } from "@/server/auth/viewer";
import { isPrivileged } from "@/server/auth/permissions";
import type { Permission } from "@/server/auth/permissions";
import type { Feature } from "@/lib/tenant-defaults";
import { AdminMobileMenu, AdminNav, type AdminNavGroup } from "@/components/shell/admin-nav";
import { NotificationsButton } from "@/components/shell/notifications";
import { AccountMenu } from "@/components/admin/account-menu";
import { TenantMark } from "@/components/brand";
import { Avatar } from "@/components/ui/avatar";
import { desc } from "drizzle-orm";

type ItemDef = { key: string; href: string; perm: Permission; feature?: Feature };

const GROUPS: { key: string; heading?: boolean; items: ItemDef[] }[] = [
  {
    key: "workspace",
    items: [
      { key: "overview", href: "/admin", perm: "overview.read" },
      { key: "people", href: "/admin/users", perm: "people.read" },
      { key: "assignments", href: "/admin/assignments", perm: "assignments.read" },
      { key: "campaigns", href: "/admin/campaigns", perm: "campaigns.read" },
      { key: "policies", href: "/admin/policies", perm: "policies.read" },
      { key: "problems", href: "/admin/problems", perm: "problems.manage" },
    ],
  },
  {
    key: "secops",
    items: [
      { key: "ops", href: "/admin/ops", perm: "secops.read", feature: "ops_center" },
      { key: "loops", href: "/admin/loops", perm: "secops.read", feature: "closed_loops" },
      { key: "threats", href: "/admin/threats", perm: "secops.read", feature: "threat_intake" },
      { key: "approvals", href: "/admin/approvals", perm: "approvals.decide", feature: "approvals" },
      { key: "incidents", href: "/admin/incidents", perm: "secops.read", feature: "incidents" },
      { key: "sandbox", href: "/admin/sandbox", perm: "secops.read", feature: "sandbox" },
      { key: "risk", href: "/admin/risk", perm: "people.read", feature: "risk_profiles" },
    ],
  },
  {
    key: "intel",
    items: [
      { key: "threatIntel", href: "/admin/intel?kind=threat", perm: "intel.read", feature: "threat_intel" },
      { key: "policyIntel", href: "/admin/intel?kind=policy", perm: "intel.read", feature: "policy_intel" },
    ],
  },
  {
    key: "content",
    items: [
      { key: "studio", href: "/admin/studio", perm: "studio.write", feature: "studio" },
      { key: "paths", href: "/admin/paths", perm: "paths.write", feature: "paths" },
      { key: "sessions", href: "/admin/sessions", perm: "sessions.write", feature: "live_sessions" },
    ],
  },
  {
    key: "insights",
    items: [
      { key: "reports", href: "/admin/reports", perm: "reports.read", feature: "reports" },
      { key: "leadership", href: "/admin/leadership", perm: "leadership.read", feature: "leadership" },
      { key: "league", href: "/admin/league", perm: "league.read", feature: "league" },
      { key: "audit", href: "/admin/audit", perm: "audit.read" },
    ],
  },
  {
    key: "organisation",
    heading: false,
    items: [
      { key: "departments", href: "/admin/departments", perm: "departments.write" },
      { key: "settings", href: "/admin/settings", perm: "settings.write" },
    ],
  },
  {
    key: "service",
    items: [
      { key: "support", href: "/admin/support", perm: "support.manage", feature: "support" },
      { key: "feedback", href: "/admin/feedback", perm: "feedback.read", feature: "feedback" },
    ],
  },
  { key: "platform", items: [{ key: "tenants", href: "/super", perm: "platform.manage" }] },
];

async function badges(v: Viewer): Promise<Record<string, number>> {
  const tid = v.tenant.id;
  const [[threats], [approvals], [tickets], [feedback], [problems]] = await Promise.all([
    db().select({ n: count() }).from(t.threatReports).where(and(eq(t.threatReports.tenantId, tid), eq(t.threatReports.status, "new"))),
    db().select({ n: count() }).from(t.materials).where(and(eq(t.materials.tenantId, tid), inArray(t.materials.status, ["pending", "second_approval"]))),
    db().select({ n: count() }).from(t.supportTickets).where(and(eq(t.supportTickets.tenantId, tid), inArray(t.supportTickets.status, ["open"]))),
    db().select({ n: count() }).from(t.feedback).where(and(eq(t.feedback.tenantId, tid), eq(t.feedback.status, "new"), isNotNull(t.feedback.comment))),
    db().select({ n: count() }).from(t.problemReports).where(and(eq(t.problemReports.tenantId, tid), eq(t.problemReports.status, "new"))),
  ]);
  return { threats: Number(threats.n), approvals: Number(approvals.n), support: Number(tickets.n), feedback: Number(feedback.n), problems: Number(problems.n) };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const v = await requireViewer();
  if (!allowed(v, "admin.access")) notFound();
  if (v.tenant.settings.identity.requireAdmin2fa && isPrivileged(v.user.role) && !v.user.totpEnabled) redirect("/profile?required=1");
  const [tr, tc, counts, notes] = await Promise.all([
    getTranslations("admin"),
    getTranslations("common"),
    badges(v),
    db().select().from(t.notifications).where(eq(t.notifications.userId, v.user.id)).orderBy(desc(t.notifications.createdAt)).limit(8),
  ]);
  const groups: AdminNavGroup[] = GROUPS.map((g) => ({
    key: g.key,
    heading: g.heading,
    items: g.items.filter((i) => allowed(v, i.perm) && (!i.feature || v.tenant.features.has(i.feature))).map((i) => ({ key: i.key, href: i.href, badge: counts[i.key] })),
  })).filter((g) => g.items.length);

  const footer = (
    <div className="mt-6 grid gap-3 border-t border-line pt-4">
      <Link href="/" className="flex h-10 items-center gap-3 rounded-pill px-3 text-body-sm font-semibold text-ink-muted hover:bg-sunken hover:text-ink">
        <BookOpenCheck className="size-[1.15rem] text-ink-subtle" />
        {tr("nav.learnerView")}
      </Link>
      <div className="flex items-center gap-3 rounded-lg border border-line p-3">
        <Avatar name={v.user.name} src={v.user.avatarUrl} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-caption font-semibold">{v.user.name}</span>
          <span className="block truncate text-tab text-ink-subtle">{tc(`roles.${v.user.role}`)}</span>
        </span>
        <AccountMenu />
      </div>
      <p className="flex gap-2 px-1 text-tab text-ink-subtle">
        <Link href="/legal/terms" className="hover:text-ink">
          {tc("footer.terms")}
        </Link>
        ·
        <Link href="/legal/privacy" className="hover:text-ink">
          {tc("footer.privacy")}
        </Link>
      </p>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas lg:pl-68">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-68 flex-col overflow-y-auto border-r border-line bg-surface px-3 pt-5 pb-4 lg:flex">
        <div className="mb-6 px-2">
          <TenantMark name={v.tenant.name} logoUrl={v.tenant.branding.logoUrl} />
          <p className="mt-1 pl-10.5 text-tab text-ink-subtle">{tr("console")}</p>
        </div>
        <Suspense>
          <AdminNav groups={groups} />
        </Suspense>
        {footer}
      </aside>
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line/70 bg-canvas/85 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
        <Suspense>
          <AdminMobileMenu groups={groups}>{footer}</AdminMobileMenu>
        </Suspense>
        <span className="min-w-0 flex-1 truncate text-body-sm font-semibold text-ink-muted lg:hidden">{v.tenant.name}</span>
        <span className="hidden flex-1 lg:block" />
        <NotificationsButton items={notes.map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, createdAt: n.createdAt.toISOString(), read: !!n.readAt }))} />
      </header>
      <main id="main" className="mx-auto max-w-(--container-content) animate-reveal px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  );
}
