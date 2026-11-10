import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });
const tenantRef = () =>
  uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" });

/* ───────────────────────── Tenancy & identity ───────────────────────── */

export const ROLES = [
  "learner",
  "department_head",
  "executive",
  "analyst",
  "campaign_manager",
  "content_creator",
  "tenant_admin",
  "super_admin",
] as const;
export type Role = (typeof ROLES)[number];

export const PLANS = ["essentials", "professional", "enterprise_hrm"] as const;
export type Plan = (typeof PLANS)[number];

export type TenantBranding = {
  primary: string;
  accent: string;
  logoUrl?: string | null;
  senderName?: string;
  senderDomain?: string;
};

export const TEMPLATE_KINDS = ["assignment", "reminder", "overdue", "manager", "welcome"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export type TenantSettings = {
  defaultLocale: string;
  locales: string[];
  /** IANA time zone of the organisation's days, due dates, reports and displayed times (lib/day.ts DEFAULT_TIME_ZONE when never chosen). */
  timeZone: string;
  protection: { contentProtection: boolean; watermark: boolean; androidScreenBlock?: boolean };
  learning: { timeLimits: boolean; refresher: boolean; riskThreshold: number; dailyGoalXp: number };
  /** Months the daily clean-up keeps audit entries, and answers and closed risks; 0 keeps them forever. */
  retention: { auditMonths: number; learningMonths: number };
  attestationText: Record<string, string>;
  /** `title` and `text`: the organisation's own wording per language ({ az, en, ru }); a language without one gets the default. */
  certificate: { title?: Record<string, string>; text?: Record<string, string>; signerName?: string; signerTitle?: string; publicLink: boolean };
  notifications: {
    firstReminderDays: number;
    urgentReminderHours: number;
    overdueNotice: boolean;
    managerAlerts: boolean;
    failedSimulations: number;
    overdueDays: number;
    templates?: Partial<Record<TemplateKind, Record<string, { subject: string; body: string }>>>;
  };
  identity: {
    requireAdmin2fa: boolean;
    maxDevices: number | null;
    ssoEnabled: boolean;
    sso?: { protocol: "oidc" | "saml"; issuer?: string; clientId?: string; clientSecretEnc?: string; emailClaim?: string; autoCreate: boolean; samlEntryPoint?: string; samlCertificate?: string };
    ldap?: {
      url?: string;
      bindDn?: string;
      passwordEnc?: string;
      caCertificate?: string;
      certificatePin?: string;
      searchBase?: string;
      filter?: string;
      departmentSource: "attribute" | "ou" | "groups";
      departmentAttribute?: string;
      syncManagers: boolean;
      syncLanguage: boolean;
      schedule: "off" | "nightly" | "6h" | "12h" | "24h";
      passwordSignIn: boolean;
      matchByEmail: boolean;
    };
    /** Last daily re-check of the proven domain (ISO). */
    domainCheckedAt?: string;
    /** First day the proof record was missing (ISO); the proof ends after 7 days. */
    domainCheckFailingSince?: string;
    /** The platform operator recorded the proof without the DNS record; the daily re-check leaves it alone. */
    domainProofForced?: boolean;
  };
  email: {
    enabled: boolean;
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    passwordEnc?: string;
    fromName?: string;
    fromAddress?: string;
    replyTo?: string;
    helpdesk?: string;
    testedAt?: string;
    /** From address of phishing simulations only (a look-alike address); saved only on `simulationDomain`. */
    simulationFromAddress?: string;
    /** Look-alike domain on which the organisation's TXT proof record was found (verifySimulationDomainAction). */
    simulationDomain?: string;
  };
  integrations: {
    webhookUrl?: string;
    webhookEnabled: boolean;
    webhookEvents: string[];
    webhookSecretEnc?: string;
    syslogHost?: string;
    syslogPort?: number;
    syslogTransport?: "tls" | "tcp" | "udp";
    syslogFormat?: "cef" | "json";
    syslogEnabled: boolean;
  };
  security: {
    /** Until when (ISO) the platform operator may issue a sign-in link for an administrator; null or past: refused. */
    supportAccessUntil: string | null;
  };
  setupHidden?: boolean;
  setupSkipped?: string[];
};

export const tenants = pgTable("tenants", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  plan: text("plan", { enum: PLANS }).notNull().default("enterprise_hrm"),
  branding: jsonb("branding").$type<TenantBranding>().notNull(),
  settings: jsonb("settings").$type<TenantSettings>().notNull(),
  /** Per-tenant overrides on top of the plan's feature set. */
  features: jsonb("features").$type<Record<string, boolean>>().notNull().default({}),
  domain: text("domain"),
  domainVerifiedAt: ts("domain_verified_at"),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("tenants_domain_verified_idx").on(t.domain).where(sql`domain_verified_at is not null`)]);

export const departments = pgTable(
  "departments",
  {
    id: id(),
    tenantId: tenantRef(),
    name: text("name").notNull(),
    /** departmentKey(name) (lib/departments.ts), written with every new name: two departments of one organisation never share it. */
    nameKey: text("name_key").notNull(),
    parentId: uuid("parent_id"),
    headUserId: uuid("head_user_id"),
    createdAt: createdAt(),
  },
  // Leads with tenant_id, so it also serves the per-organisation lookups.
  (t) => [uniqueIndex("departments_tenant_name_key_idx").on(t.tenantId, t.nameKey)],
);

export const USER_STATUS = ["active", "invited", "suspended", "deleted"] as const;

export const users = pgTable(
  "users",
  {
    id: id(),
    tenantId: tenantRef(),
    email: text("email").notNull(),
    phone: text("phone"),
    name: text("name").notNull(),
    jobTitle: text("job_title"),
    role: text("role", { enum: ROLES }).notNull().default("learner"),
    status: text("status", { enum: USER_STATUS }).notNull().default("active"),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    managerId: uuid("manager_id"),
    locale: text("locale").notNull().default("az"),
    passwordHash: text("password_hash"),
    /** "<issuer> <sub>" of the identity provider's account, bound at the first SSO sign-in; null until then or once an administrator unlinks it. */
    ssoSubject: text("sso_subject"),
    totpSecret: text("totp_secret"),
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    /** The last TOTP time step accepted, so a code seen once is not taken again. */
    totpLastStep: integer("totp_last_step"),
    /** sha256 hashes of unused backup codes. */
    totpRecovery: jsonb("totp_recovery").$type<string[]>(),
    avatarUrl: text("avatar_url"),
    xp: integer("xp").notNull().default(0),
    streakCurrent: integer("streak_current").notNull().default(0),
    streakLongest: integer("streak_longest").notNull().default(0),
    streakLastDay: date("streak_last_day"),
    /** Unused streak freezes (max 2): one covers a single missed day. */
    streakFreezes: integer("streak_freezes").notNull().default(0),
    riskScore: integer("risk_score").notNull().default(50),
    soundOn: boolean("sound_on").notNull().default(true),
    motion: text("motion", { enum: ["full", "calm", "still"] }).notNull().default("full"),
    timerPref: text("timer_pref", { enum: ["standard", "more", "off"] }).notNull().default("standard"),
    tourDone: boolean("tour_done").notNull().default(false),
    deletionRequestedAt: ts("deletion_requested_at"),
    lastActiveAt: ts("last_active_at"),
    /** When department_id last changed (null: never since the account was created). Reminders for department assignments count from it. */
    departmentChangedAt: ts("department_changed_at"),
    /** When an invited account became active (invite accepted, first SSO sign-in). Null for accounts created active. */
    activatedAt: ts("activated_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    index("users_tenant_idx").on(t.tenantId),
    index("users_department_idx").on(t.departmentId),
    // Phone sign-in must resolve to exactly one person; deleted (anonymised) accounts keep no number.
    uniqueIndex("users_phone_active_idx").on(t.phone).where(sql`phone is not null and status <> 'deleted'`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256(token), hex
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: tenantRef(),
    expiresAt: ts("expires_at").notNull(),
    twoFactorVerified: boolean("two_factor_verified").notNull().default(false),
    ip: text("ip"),
    userAgent: text("user_agent"),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

/** What a reporting-API token may read (docs/API.md "Reporting API"); never a write. */
export const API_TOKEN_PERMISSIONS = ["reports.read", "people.read", "audit.read"] as const;
export type ApiTokenPermission = (typeof API_TOKEN_PERMISSIONS)[number];
/** Active tokens an organisation may hold at once. */
export const MAX_API_TOKENS = 20;

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: text("id").primaryKey(), // sha256(token), hex
    tenantId: tenantRef(),
    name: text("name").notNull(),
    permissions: jsonb("permissions").$type<ApiTokenPermission[]>().notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    lastUsedAt: ts("last_used_at"),
    revokedAt: ts("revoked_at"),
  },
  (t) => [index("api_tokens_tenant_idx").on(t.tenantId)],
);

export const AUTH_TOKEN_KINDS = ["invite", "reset", "phone_otp"] as const;

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: text("id").primaryKey(), // sha256(token)
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: AUTH_TOKEN_KINDS }).notNull(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("auth_tokens_user_idx").on(t.userId)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: id(),
    key: text("key").notNull(),
    success: boolean("success").notNull(),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("login_attempts_key_idx").on(t.key, t.at)],
);

/** Fixed-window request counters shared by every server instance (src/server/rate-limit.ts). */
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    key: text("key").notNull(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), index("rate_limit_buckets_window_idx").on(t.windowStart)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    tenantId: tenantRef(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    ip: text("ip"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("audit_tenant_at_idx").on(t.tenantId, t.at)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    tenantId: tenantRef(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt), index("notifications_tenant_kind_idx").on(t.tenantId, t.kind, t.createdAt)],
);

export const watermarkCodes = pgTable("watermark_codes", {
  code: text("code").primaryKey(),
  tenantId: tenantRef(),
  userId: uuid("user_id").notNull(),
  sessionId: text("session_id"),
  createdAt: createdAt(),
});

/* ───────────────────────── Content library ───────────────────────── */

export const DIFFICULTY = ["Easy", "Medium", "Hard"] as const;

export const modules = pgTable(
  "modules",
  {
    id: id(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }), // null = global library
    slug: text("slug").notNull(),
    category: text("category").notNull(),
    audiences: jsonb("audiences").$type<string[]>().notNull(),
    title: jsonb("title").$type<Record<string, string>>().notNull(),
    subtitle: jsonb("subtitle").$type<Record<string, string>>().notNull(),
    minutes: integer("minutes").notNull(),
    xp: integer("xp").notNull(),
    difficulty: text("difficulty", { enum: DIFFICULTY }).notNull(),
    origin: text("origin", { enum: ["library", "custom", "ai"] }).notNull().default("library"),
    status: text("status", { enum: ["published", "draft"] }).notNull().default("published"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  // NULLS NOT DISTINCT: the global library (tenant_id null) also has one module per slug.
  (t) => [unique("modules_slug_tenant_idx").on(t.slug, t.tenantId).nullsNotDistinct()],
);

export const lessons = pgTable(
  "lessons",
  {
    id: id(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    title: jsonb("title").$type<Record<string, string>>().notNull(),
    minutes: integer("minutes").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [uniqueIndex("lessons_module_key_idx").on(t.moduleId, t.key)],
);

export const lessonContents = pgTable(
  "lesson_contents",
  {
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    scenes: jsonb("scenes").$type<unknown[]>().notNull(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.lessonId, t.locale] })],
);

export const learningPaths = pgTable("learning_paths", {
  id: id(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  title: jsonb("title").$type<Record<string, string>>().notNull(),
  description: jsonb("description").$type<Record<string, string>>().notNull(),
  audience: jsonb("audience").$type<Record<string, string>>().notNull(),
  mandatory: boolean("mandatory").notNull().default(false),
  recurrence: jsonb("recurrence").$type<Record<string, string>>().notNull(),
  standards: jsonb("standards").$type<string[]>().notNull(),
  moduleSlugs: jsonb("module_slugs").$type<string[]>().notNull(),
  // Practice labs, always shown after the modules (lessons first, then labs).
  labIds: jsonb("lab_ids").$type<string[]>().notNull().default([]),
  createdAt: createdAt(),
}, (t) => [unique("learning_paths_key_tenant_idx").on(t.key, t.tenantId).nullsNotDistinct()]);

/* ───────────────────────── Learning ───────────────────────── */

export const ASSIGN_SCOPE = ["everyone", "department", "user"] as const;

export const assignments = pgTable(
  "assignments",
  {
    id: id(),
    tenantId: tenantRef(),
    moduleId: uuid("module_id").references(() => modules.id, { onDelete: "cascade" }),
    pathId: uuid("path_id").references(() => learningPaths.id, { onDelete: "cascade" }),
    scope: text("scope", { enum: ASSIGN_SCOPE }).notNull(),
    departmentId: uuid("department_id"),
    userId: uuid("user_id"),
    dueKind: text("due_kind", { enum: ["none", "fixed", "after_joining"] }).notNull().default("none"),
    dueDate: date("due_date"),
    dueDays: integer("due_days"),
    reason: text("reason"),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("assignments_tenant_idx").on(t.tenantId)],
);

export const moduleProgress = pgTable(
  "module_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["not_started", "in_progress", "awaiting_attestation", "completed"] })
      .notNull()
      .default("not_started"),
    percent: integer("percent").notNull().default(0),
    lastLessonKey: text("last_lesson_key"),
    startedAt: ts("started_at"),
    completedAt: ts("completed_at"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.moduleId] })],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    completedAt: ts("completed_at"),
    /** The latest completion (completed_at keeps the first): a replay after a risk opened is proven by it. */
    lastCompletedAt: ts("last_completed_at"),
    xpAwarded: integer("xp_awarded").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    secondsSpent: integer("seconds_spent").notNull().default(0),
    /** The current attempt, as the server saw it: when it began and the furthest scene reached. Cleared by each completion. */
    startedAt: ts("started_at"),
    reached: integer("reached").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);

export const answers = pgTable(
  "answers",
  {
    id: id(),
    tenantId: tenantRef(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id").notNull(),
    sceneId: text("scene_id").notNull(),
    itemId: text("item_id"),
    category: text("category"),
    correct: boolean("correct").notNull(),
    firstTry: boolean("first_try").notNull(),
    outcome: text("outcome"), // simulations: safe | risky | compromised
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("answers_user_idx").on(t.userId), index("answers_tenant_at_idx").on(t.tenantId, t.at)],
);

export const xpEvents = pgTable(
  "xp_events",
  {
    id: id(),
    tenantId: tenantRef(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    reason: text("reason").notNull(),
    ref: text("ref"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("xp_user_at_idx").on(t.userId, t.at), index("xp_tenant_at_idx").on(t.tenantId, t.at)],
);

/** How a completion was established: rows from before the server-side check stay self-reported. */
export const EVIDENCE = ["self_reported", "server_verified"] as const;
export type Evidence = (typeof EVIDENCE)[number];

export const attestations = pgTable("attestations", {
  id: id(),
  tenantId: tenantRef(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Compliance evidence: a module with attestations cannot be deleted (NO ACTION, so deleting a tenant still cascades).
  moduleId: uuid("module_id")
    .notNull()
    .references(() => modules.id, { onDelete: "no action" }),
  text: text("text").notNull(),
  locale: text("locale").notNull(),
  evidence: text("evidence", { enum: EVIDENCE }).notNull().default("self_reported"),
  at: ts("at").notNull().defaultNow(),
}, (t) => [index("attestations_user_idx").on(t.userId), uniqueIndex("attestations_user_module_idx").on(t.userId, t.moduleId)]);

export const certificates = pgTable("certificates", {
  id: id(),
  tenantId: tenantRef(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Compliance evidence, as for attestations: issued certificates block deleting their module or path.
  moduleId: uuid("module_id").references(() => modules.id, { onDelete: "no action" }),
  pathId: uuid("path_id").references(() => learningPaths.id, { onDelete: "no action" }),
  serial: text("serial").notNull().unique(),
  publicToken: text("public_token").notNull().unique(),
  evidence: text("evidence", { enum: EVIDENCE }).notNull().default("self_reported"),
  issuedAt: ts("issued_at").notNull().defaultNow(),
}, (t) => [
  index("certificates_user_idx").on(t.userId),
  index("certificates_tenant_idx").on(t.tenantId),
  // One certificate per module or path and person: the database backs the claims in progress.ts and learning.ts.
  uniqueIndex("certificates_user_module_idx").on(t.userId, t.moduleId).where(sql`module_id is not null`),
  uniqueIndex("certificates_user_path_idx").on(t.userId, t.pathId).where(sql`path_id is not null`),
]);

export const policies = pgTable("policies", {
  id: id(),
  tenantId: tenantRef(),
  title: text("title").notNull(),
  archivedAt: ts("archived_at"),
  createdBy: uuid("created_by"),
  createdAt: createdAt(),
});

export const policyVersions = pgTable("policy_versions", {
  id: id(),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => policies.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  bodyMd: text("body_md").notNull(),
  /**
   * Other languages of the same version: { ru: { title, summary, bodyMd } }. A copy of the base text marked
   * `base: true` names the language the title/summary/body columns are written in (lib/policy-text.ts).
   */
  translations: jsonb("translations").$type<Record<string, { title: string; summary?: string; bodyMd: string; base?: boolean }>>(),
  publishedAt: ts("published_at"),
  createdAt: createdAt(),
}, (t) => [index("policy_versions_policy_idx").on(t.policyId)]);

export const policySignoffs = pgTable(
  "policy_signoffs",
  {
    id: id(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => policyVersions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ip: text("ip"),
    signedAt: ts("signed_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("policy_signoff_unique").on(t.versionId, t.userId)],
);

export const liveSessions = pgTable("live_sessions", {
  id: id(),
  tenantId: tenantRef(),
  title: text("title").notNull(),
  description: text("description"),
  startsAt: ts("starts_at").notNull(),
  durationMin: integer("duration_min").notNull(),
  location: text("location").notNull(),
  host: text("host").notNull(),
  capacity: integer("capacity"),
  createdAt: createdAt(),
});

export const sessionRegistrations = pgTable(
  "session_registrations",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => liveSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    attended: boolean("attended").notNull().default(false),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.userId] })],
);

export const labAttempts = pgTable(
  "lab_attempts",
  {
    id: id(),
    tenantId: tenantRef(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exercise: text("exercise").notNull(),
    score: integer("score").notNull(),
    max: integer("max").notNull(),
    xp: integer("xp").notNull(),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("lab_user_idx").on(t.userId)],
);

/* ───────────────────────── Risk & security operations ───────────────────────── */

export const SEVERITY = ["low", "medium", "high", "critical"] as const;

export const behaviorRisks = pgTable(
  "behavior_risks",
  {
    id: id(),
    tenantId: tenantRef(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["phishing_click", "credentials", "breach", "policy", "incident", "path"] }).notNull(),
    severity: text("severity", { enum: SEVERITY }).notNull(),
    title: text("title").notNull(),
    sourceRef: text("source_ref"),
    moduleId: uuid("module_id").references(() => modules.id, { onDelete: "set null" }),
    status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
    dueDate: date("due_date"),
    createdAt: createdAt(),
    closedAt: ts("closed_at"),
  },
  (t) => [index("risks_user_idx").on(t.userId, t.status), index("risks_tenant_idx").on(t.tenantId, t.status)],
);

export const riskSnapshots = pgTable(
  "risk_snapshots",
  {
    id: id(),
    tenantId: tenantRef(),
    day: date("day").notNull(),
    avgRisk: integer("avg_risk").notNull(),
    completion: integer("completion").notNull(),
    reportRate: integer("report_rate").notNull(),
    clickRate: integer("click_rate").notNull(),
  },
  (t) => [uniqueIndex("risk_snap_unique").on(t.tenantId, t.day)],
);

/** One risk score per person and day (the "Risk, last 30 days" sparkline). */
export const userRiskSnapshots = pgTable(
  "user_risk_snapshots",
  {
    id: id(),
    tenantId: tenantRef(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    score: integer("score").notNull(),
  },
  (t) => [uniqueIndex("user_risk_snap_unique").on(t.userId, t.day), index("user_risk_snap_tenant_day_idx").on(t.tenantId, t.day)],
);

export const threatReports = pgTable(
  "threat_reports",
  {
    id: id(),
    tenantId: tenantRef(),
    number: integer("number").notNull(),
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    channel: text("channel", { enum: ["email", "sms", "call", "link", "file", "in_person", "other"] }).notNull(),
    subject: text("subject").notNull(),
    details: text("details"),
    url: text("url"),
    status: text("status", { enum: ["new", "triaged", "converted", "dismissed"] }).notNull().default("new"),
    severity: text("severity", { enum: SEVERITY }),
    campaignRecipientId: uuid("campaign_recipient_id"),
    createdAt: createdAt(),
  },
  (t) => [index("threat_reports_tenant_idx").on(t.tenantId, t.status), uniqueIndex("threat_reports_number_idx").on(t.tenantId, t.number), index("threat_reports_reporter_idx").on(t.reporterId)],
);

export type SandboxFinding = { id: string; severity: "info" | "low" | "medium" | "high"; weight: number; params?: Record<string, string | number> };
export type Ioc = { type: "domain" | "url" | "ip" | "sha256" | "email" | "filename"; value: string };

export const sandboxAnalyses = pgTable(
  "sandbox_analyses",
  {
    id: id(),
    tenantId: tenantRef(),
    number: integer("number").notNull(),
    kind: text("kind", { enum: ["url", "file"] }).notNull(),
    objectName: text("object_name").notNull(),
    sha256: text("sha256"),
    sizeBytes: integer("size_bytes"),
    verdict: text("verdict", { enum: ["clean", "suspicious", "malicious"] }).notNull(),
    score: integer("score").notNull(),
    findings: jsonb("findings").$type<SandboxFinding[]>().notNull(),
    iocs: jsonb("iocs").$type<Ioc[]>().notNull(),
    mitre: jsonb("mitre").$type<string[]>().notNull(),
    submittedBy: uuid("submitted_by"),
    incidentId: uuid("incident_id"),
    createdAt: createdAt(),
  },
  (t) => [index("sandbox_tenant_idx").on(t.tenantId, t.createdAt), uniqueIndex("sandbox_number_idx").on(t.tenantId, t.number)],
);

export const INCIDENT_STATUS = ["open", "investigating", "resolved"] as const;

export const incidents = pgTable(
  "incidents",
  {
    id: id(),
    tenantId: tenantRef(),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    severity: text("severity", { enum: SEVERITY }).notNull(),
    status: text("status", { enum: INCIDENT_STATUS }).notNull().default("open"),
    confidential: boolean("confidential").notNull().default(false),
    live: boolean("live").notNull().default(false),
    source: text("source", { enum: ["analyst", "sandbox", "report", "siem", "intel"] }).notNull(),
    iocs: jsonb("iocs").$type<Ioc[]>().notNull(),
    mitre: jsonb("mitre").$type<string[]>().notNull(),
    sandboxId: uuid("sandbox_id"),
    reportId: uuid("report_id"),
    trainingModuleId: uuid("training_module_id").references(() => modules.id, { onDelete: "set null" }),
    minScore: integer("min_score"),
    dueDate: date("due_date"),
    targetUserIds: jsonb("target_user_ids").$type<string[]>().notNull(),
    autoTrainingAt: ts("auto_training_at"),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
    resolvedAt: ts("resolved_at"),
  },
  (t) => [index("incidents_tenant_idx").on(t.tenantId, t.status), uniqueIndex("incidents_number_idx").on(t.tenantId, t.number)],
);

export const LOOP_STAGES = ["intake", "analysis", "conversion", "approval", "targeting", "training", "feedback"] as const;
export type LoopStage = (typeof LOOP_STAGES)[number];

export const loops = pgTable(
  "loops",
  {
    id: id(),
    tenantId: tenantRef(),
    title: text("title").notNull(),
    stage: text("stage", { enum: LOOP_STAGES }).notNull(),
    verdict: text("verdict", { enum: ["malicious", "suspicious", "pending", "benign"] }).notNull().default("pending"),
    sourceType: text("source_type", { enum: ["report", "sandbox", "incident", "intel", "simulation"] }).notNull(),
    sourceId: text("source_id"),
    incidentId: uuid("incident_id"),
    materialId: uuid("material_id"),
    trainedCount: integer("trained_count").notNull().default(0),
    closedAt: ts("closed_at"),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("loops_tenant_idx").on(t.tenantId, t.stage)],
);

export const loopEvents = pgTable(
  "loop_events",
  {
    id: id(),
    loopId: uuid("loop_id")
      .notNull()
      .references(() => loops.id, { onDelete: "cascade" }),
    stage: text("stage", { enum: LOOP_STAGES }).notNull(),
    note: text("note"),
    actorId: uuid("actor_id"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("loop_events_loop_idx").on(t.loopId)],
);

export const MATERIAL_STATUS = ["pending", "second_approval", "approved", "rejected"] as const;

export const materials = pgTable(
  "materials",
  {
    id: id(),
    tenantId: tenantRef(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    origin: text("origin", { enum: ["ai", "template", "analyst"] }).notNull(),
    status: text("status", { enum: MATERIAL_STATUS }).notNull().default("pending"),
    requiresTwo: boolean("requires_two").notNull().default(false),
    sourceRef: text("source_ref"),
    loopId: uuid("loop_id"),
    moduleId: uuid("module_id").references(() => modules.id, { onDelete: "set null" }),
    targetUserIds: jsonb("target_user_ids").$type<string[]>().notNull(),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("materials_tenant_idx").on(t.tenantId, t.status)],
);

export const materialDecisions = pgTable("material_decisions", {
  id: id(),
  materialId: uuid("material_id")
    .notNull()
    .references(() => materials.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").notNull(),
  decision: text("decision", { enum: ["approve", "reject", "edit"] }).notNull(),
  reason: text("reason"),
  at: ts("at").notNull().defaultNow(),
}, (t) => [index("material_decisions_material_idx").on(t.materialId)]);

export const intelItems = pgTable(
  "intel_items",
  {
    id: id(),
    tenantId: tenantRef(),
    kind: text("kind", { enum: ["threat", "policy"] }).notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url"),
    severity: text("severity", { enum: SEVERITY }).notNull(),
    jurisdiction: text("jurisdiction"),
    effectiveDate: date("effective_date"),
    tags: jsonb("tags").$type<string[]>().notNull(),
    status: text("status", { enum: ["new", "reviewed", "converted", "dismissed"] }).notNull().default("new"),
    loopId: uuid("loop_id"),
    policyId: uuid("policy_id"),
    publishedAt: ts("published_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("intel_tenant_idx").on(t.tenantId, t.kind)],
);

/* ───────────────────────── Phishing simulations ───────────────────────── */

export const CAMPAIGN_STATUS = ["draft", "scheduled", "running", "completed", "cancelled"] as const;

export const campaigns = pgTable(
  "campaigns",
  {
    id: id(),
    tenantId: tenantRef(),
    name: text("name").notNull(),
    channel: text("channel", { enum: ["email", "sms", "voice", "usb", "qr"] }).notNull(),
    templateKey: text("template_key").notNull(),
    audience: text("audience", { enum: ["all", "department"] }).notNull(),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    status: text("status", { enum: CAMPAIGN_STATUS }).notNull().default("draft"),
    scheduledAt: ts("scheduled_at"),
    launchedAt: ts("launched_at"),
    completedAt: ts("completed_at"),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("campaigns_tenant_idx").on(t.tenantId)],
);

export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: id(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    sentAt: ts("sent_at"),
    openedAt: ts("opened_at"),
    clickedAt: ts("clicked_at"),
    submittedAt: ts("submitted_at"),
    reportedAt: ts("reported_at"),
  },
  (t) => [index("recipients_campaign_idx").on(t.campaignId), index("recipients_user_idx").on(t.userId)],
);

/** One planned step of a live drill (src/lib/drill/plan.ts): what one recipient does, and when. */
export type DrillEventRow = {
  /** Milliseconds after the start, in real time. */
  at: number;
  /** Simulated minutes after delivery (what the dashboard's clock shows). */
  sim: number;
  kind: "deliver" | "open" | "click" | "submit" | "report" | "train";
  recipientId: string;
  userId: string;
};

/**
 * Live drill (operator feature `live_drill`, demo organisations only): a phishing campaign whose
 * recipients' behaviour is planned up front and played back in compressed time through the real
 * services (tracking, risk, threat intake, training). The dashboard's polls apply the due events;
 * `appliedUntil` counts the events already applied and `leaseUntil` lets one request at a time apply.
 */
export const drillRuns = pgTable(
  "drill_runs",
  {
    id: id(),
    tenantId: tenantRef(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    templateKey: text("template_key").notNull(),
    /** Real length of the playback in milliseconds. */
    durationMs: integer("duration_ms").notNull(),
    /** Simulated minutes the playback covers. */
    simMinutes: integer("sim_minutes").notNull(),
    events: jsonb("events").$type<DrillEventRow[]>().notNull(),
    appliedUntil: integer("applied_until").notNull().default(0),
    leaseUntil: ts("lease_until"),
    /** Average risk score of the audience, and each person's score, before the drill. */
    baseline: jsonb("baseline").$type<{ avgRisk: number; scores: Record<string, number> }>().notNull(),
    /** The audience's average risk score after each applied batch (simulated minute, score), from the baseline on. */
    riskTrail: jsonb("risk_trail").$type<{ sim: number; risk: number }[]>().notNull().default([]),
    startedAt: ts("started_at").notNull(),
    finishedAt: ts("finished_at"),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("drill_runs_tenant_idx").on(t.tenantId, t.createdAt)],
);

/* ───────────────────────── Support & feedback ───────────────────────── */

export const problemReports = pgTable(
  "problem_reports",
  {
    id: id(),
    tenantId: tenantRef(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    context: text("context"),
    message: text("message").notNull(),
    status: text("status", { enum: ["new", "in_progress", "resolved", "not_a_problem"] }).notNull().default("new"),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("problems_tenant_idx").on(t.tenantId, t.status)],
);

export const TICKET_CATEGORIES = ["training", "technical", "account", "security", "other"] as const;
export const TICKET_PRIORITY = ["low", "medium", "high"] as const;

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: id(),
    tenantId: tenantRef(),
    number: integer("number").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category", { enum: TICKET_CATEGORIES }).notNull(),
    priority: text("priority", { enum: TICKET_PRIORITY }).notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    moduleId: uuid("module_id").references(() => modules.id, { onDelete: "set null" }),
    status: text("status", { enum: ["open", "in_progress", "answered", "closed"] }).notNull().default("open"),
    slaDueAt: ts("sla_due_at").notNull(),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("tickets_tenant_idx").on(t.tenantId, t.status), uniqueIndex("tickets_number_idx").on(t.tenantId, t.number)],
);

export const ticketMessages = pgTable("ticket_messages", {
  id: id(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => supportTickets.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull(),
  body: text("body").notNull(),
  at: ts("at").notNull().defaultNow(),
}, (t) => [index("ticket_messages_ticket_idx").on(t.ticketId)]);

export const feedback = pgTable(
  "feedback",
  {
    id: id(),
    tenantId: tenantRef(),
    userId: uuid("user_id"), // null when anonymous
    moduleId: uuid("module_id").references(() => modules.id, { onDelete: "set null" }),
    rating: integer("rating").notNull(),
    topic: text("topic", { enum: ["module", "platform", "idea"] }).notNull(),
    comment: text("comment"),
    status: text("status", { enum: ["new", "reviewed"] }).notNull().default("new"),
    createdAt: createdAt(),
  },
  (t) => [index("feedback_tenant_idx").on(t.tenantId)],
);

/* ───────────────────────── Platform operator ───────────────────────── */

export const demoRequests = pgTable("demo_requests", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  organisation: text("organisation").notNull(),
  country: text("country").notNull(),
  employees: text("employees").notNull(),
  message: text("message"),
  locale: text("locale").notNull(),
  consentVersion: text("consent_version").notNull(),
  status: text("status", { enum: ["new", "contacted", "won", "lost"] }).notNull().default("new"),
  createdAt: createdAt(),
});

/* ───────────────────────── Delivery & background work ───────────────────────── */

export const outbox = pgTable(
  "outbox",
  {
    id: id(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    text: text("text").notNull(),
    kind: text("kind").notNull(),
    /** logged = no mail server configured; the message is kept for the delivery log only. */
    status: text("status", { enum: ["queued", "sent", "failed", "logged"] }).notNull().default("queued"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: createdAt(),
    sentAt: ts("sent_at"),
  },
  (t) => [index("outbox_status_idx").on(t.status, t.createdAt), index("outbox_tenant_idx").on(t.tenantId, t.createdAt)],
);

export const REPORT_KINDS = ["completion", "risk", "people", "modules", "feedback", "confirmations", "simulations", "secops"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const reportSchedules = pgTable("report_schedules", {
  id: id(),
  tenantId: tenantRef(),
  kind: text("kind", { enum: REPORT_KINDS }).notNull(),
  format: text("format", { enum: ["csv", "xlsx"] }).notNull(),
  frequency: text("frequency", { enum: ["weekly", "monthly"] }).notNull(),
  /** Weekly: 1–7, Monday first. Monthly: day of the month, 1–28. */
  day: integer("day").notNull().default(1),
  recipients: jsonb("recipients").$type<string[]>().notNull(),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  lastSentAt: ts("last_sent_at"),
  createdBy: uuid("created_by"),
  createdAt: createdAt(),
});

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: id(),
    tenantId: tenantRef(),
    event: text("event").notNull(),
    target: text("target", { enum: ["webhook", "syslog"] }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status", { enum: ["queued", "delivered", "failed"] }).notNull().default("queued"),
    responseCode: integer("response_code"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: createdAt(),
    deliveredAt: ts("delivered_at"),
  },
  (t) => [index("deliveries_status_idx").on(t.status, t.createdAt), index("deliveries_tenant_idx").on(t.tenantId, t.createdAt)],
);

/** Heartbeat of the job runner: one row per job ("tick"), upserted at the end of each run; /api/health reports it stale. */
export const jobTicks = pgTable("job_ticks", {
  job: text("job").primaryKey(),
  ranAt: ts("ran_at").notNull(),
  durationMs: integer("duration_ms").notNull(),
});

export const tutorCache = pgTable("tutor_cache", {
  id: text("id").primaryKey(), // sha256 of tenant, locale, lesson, scene, the normalised question and a hash of the lesson text (tutorCacheId)
  tenantId: tenantRef(),
  lessonId: uuid("lesson_id").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  model: text("model").notNull(),
  createdAt: createdAt(),
});

/** AI output that is the same for every learner and costly to make, e.g. a lesson's subtitles in a language the library does not ship. */
export const aiCache = pgTable("ai_cache", {
  id: text("id").primaryKey(), // sha256 of the kind and every input, including a hash of the source text
  kind: text("kind", { enum: ["subtitles"] }).notNull(),
  lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  locale: text("locale").notNull(),
  payload: jsonb("payload").$type<unknown>().notNull(),
  model: text("model").notNull(),
  createdAt: createdAt(),
});

/** Small uploaded files (tenant logos). Stored base64 so the same code runs on PGlite and Postgres. */
export const assets = pgTable("assets", {
  id: id(),
  tenantId: tenantRef(),
  kind: text("kind", { enum: ["logo"] }).notNull(),
  mime: text("mime").notNull(),
  dataBase64: text("data_base64").notNull(),
  sha256: text("sha256").notNull(),
  createdAt: createdAt(),
});
