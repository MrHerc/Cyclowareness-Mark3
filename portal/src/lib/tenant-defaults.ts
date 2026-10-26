import type { TemplateKind, TenantBranding, TenantSettings } from "../server/db/schema";

export const DEFAULT_BRANDING: TenantBranding = { primary: "#4f46e5", accent: "#ff7a1a" };

export const BRAND_PALETTE = ["#4F46E5", "#0F6FBF", "#0F766E", "#1E7B3C", "#B42346", "#6D28D9", "#E2B007", "#FF7A1A", "#F5A524", "#E5484D", "#12A594", "#3E63DD", "#D6409F"];

export const DEFAULT_ATTESTATION: Record<string, string> = {
  az: "Bu modulu özüm keçdim, qaydaları başa düşdüm və onlara əməl edəcəyəm.",
  en: "I went through this module myself, I understand the rules and I will follow them.",
  ru: "Я прошёл(а) этот модуль самостоятельно, понимаю правила и буду их соблюдать.",
};

export const DEFAULT_CERTIFICATE_TEXT: Record<string, string> = {
  az: "{date} tarixində {name} «{module}» modulunu uğurla tamamladı və kibergigiyena qaydalarına əməl edəcəyini təsdiqlədi.",
  en: "On {date}, {name} successfully completed the module “{module}” and confirmed that they will follow the rules of cyber hygiene.",
  ru: "{date} {name} успешно завершил(а) модуль «{module}» и подтвердил(а), что будет соблюдать правила кибергигиены.",
};

export const DEFAULT_TEMPLATES: Record<TemplateKind, Record<string, { subject: string; body: string }>> = {
  assignment: {
    az: { subject: "Yeni təlim: {{module}}", body: "Salam, {{name}}!\n\nSizə «{{module}}» təlimi təyin edilib. Son tarix: {{dueDate}}.\n\n{{link}}" },
    en: { subject: "New training: {{module}}", body: "Hello {{name}},\n\nYou have been assigned “{{module}}”. Due date: {{dueDate}}.\n\n{{link}}" },
    ru: { subject: "Новое обучение: {{module}}", body: "Здравствуйте, {{name}}!\n\nВам назначено обучение «{{module}}». Срок выполнения: {{dueDate}}.\n\n{{link}}" },
  },
  reminder: {
    az: { subject: "Xatırlatma: {{module}}", body: "Salam, {{name}}!\n\n«{{module}}» təlimini {{dueDate}} tarixinədək tamamlamağı unutmayın. Bir neçə dəqiqə kifayətdir.\n\n{{link}}" },
    en: { subject: "Reminder: {{module}}", body: "Hello {{name}},\n\nPlease finish “{{module}}” by {{dueDate}}. It only takes a few minutes.\n\n{{link}}" },
    ru: { subject: "Напоминание: {{module}}", body: "Здравствуйте, {{name}}!\n\nПожалуйста, завершите «{{module}}» до {{dueDate}}. Это займёт несколько минут.\n\n{{link}}" },
  },
  overdue: {
    az: { subject: "Son tarix keçib: {{module}}", body: "Salam, {{name}}!\n\n«{{module}}» təliminin son tarixi ({{dueDate}}) keçib. Zəhmət olmasa bu gün tamamlayın.\n\n{{link}}" },
    en: { subject: "Overdue: {{module}}", body: "Hello {{name}},\n\nThe due date for “{{module}}” ({{dueDate}}) has passed. Please complete it today.\n\n{{link}}" },
    ru: { subject: "Срок истёк: {{module}}", body: "Здравствуйте, {{name}}!\n\nСрок обучения «{{module}}» ({{dueDate}}) истёк. Пожалуйста, завершите его сегодня.\n\n{{link}}" },
  },
  manager: {
    az: { subject: "Komandanızda diqqət tələb edən hal", body: "Salam, {{name}}!\n\nKomandanızdakı {{person}} ilə bağlı diqqət tələb edən hal var: {{reason}}.\n\n{{link}}" },
    en: { subject: "Someone in your team needs attention", body: "Hello {{name}},\n\n{{person}} in your team needs attention: {{reason}}.\n\n{{link}}" },
    ru: { subject: "Сотрудник вашей команды требует внимания", body: "Здравствуйте, {{name}}!\n\nСотрудник вашей команды {{person}} требует внимания: {{reason}}.\n\n{{link}}" },
  },
  welcome: {
    az: { subject: "{{organisation}}: kibergigiyena təliminə xoş gəlmisiniz", body: "Salam, {{name}}!\n\n{{organisation}} sizi qısa kibergigiyena dərslərinə dəvət edir. Hesabınızı aktivləşdirmək üçün linkə keçin. Link 14 gün etibarlıdır.\n\n{{link}}" },
    en: { subject: "Welcome to {{organisation}}'s security awareness training", body: "Hello {{name}},\n\n{{organisation}} invites you to short cyber hygiene lessons. Use the link to set up your account. The link is valid for 14 days.\n\n{{link}}" },
    ru: { subject: "{{organisation}}: добро пожаловать на обучение кибергигиене", body: "Здравствуйте, {{name}}!\n\n{{organisation}} приглашает вас на короткие уроки по кибергигиене. Перейдите по ссылке, чтобы активировать учётную запись. Ссылка действует 14 дней.\n\n{{link}}" },
  },
};

/**
 * The default assignment and reminder text when there is no due date (an assignment without one, or a reminder
 * sent by hand for a module that has none): the dated wording would otherwise read "by —".
 */
export const DEFAULT_TEMPLATES_NO_DUE: Record<"assignment" | "reminder", Record<string, { subject: string; body: string }>> = {
  assignment: {
    az: { subject: DEFAULT_TEMPLATES.assignment.az.subject, body: "Salam, {{name}}!\n\nSizə «{{module}}» təlimi təyin edilib.\n\n{{link}}" },
    en: { subject: DEFAULT_TEMPLATES.assignment.en.subject, body: "Hello {{name}},\n\nYou have been assigned “{{module}}”.\n\n{{link}}" },
    ru: { subject: DEFAULT_TEMPLATES.assignment.ru.subject, body: "Здравствуйте, {{name}}!\n\nВам назначено обучение «{{module}}».\n\n{{link}}" },
  },
  reminder: {
    az: { subject: DEFAULT_TEMPLATES.reminder.az.subject, body: "Salam, {{name}}!\n\n«{{module}}» təlimini tamamlamağı unutmayın. Bir neçə dəqiqə kifayətdir.\n\n{{link}}" },
    en: { subject: DEFAULT_TEMPLATES.reminder.en.subject, body: "Hello {{name}},\n\nPlease finish “{{module}}”. It only takes a few minutes.\n\n{{link}}" },
    ru: { subject: DEFAULT_TEMPLATES.reminder.ru.subject, body: "Здравствуйте, {{name}}!\n\nПожалуйста, завершите обучение «{{module}}». Это займёт несколько минут.\n\n{{link}}" },
  },
};

/** Messages with no editable template: a policy signature request and a nudge to confirm a finished module. */
export const FIXED_MESSAGES: Record<"policy_reminder" | "confirmation_reminder", Record<string, { subject: string; body: string }>> = {
  policy_reminder: {
    az: { subject: "İmza gözlənilir: {{module}}", body: "Salam, {{name}}!\n\nZəhmət olmasa «{{module}}» siyasətini oxuyub imzalayın. Bir neçə dəqiqə kifayətdir.\n\n{{link}}" },
    en: { subject: "Signature needed: {{module}}", body: "Hello {{name}},\n\nPlease read and sign “{{module}}”. It only takes a few minutes.\n\n{{link}}" },
    ru: { subject: "Нужна подпись: {{module}}", body: "Здравствуйте, {{name}}!\n\nПожалуйста, прочитайте и подпишите «{{module}}». Это займёт несколько минут.\n\n{{link}}" },
  },
  confirmation_reminder: {
    az: { subject: "Təsdiq gözlənilir: {{module}}", body: "Salam, {{name}}!\n\n«{{module}}» təlimini bitirmisiniz, yalnız təsdiqləmək qalıb. Zəhmət olmasa təsdiqləyin: bir dəqiqə çəkir.\n\n{{link}}" },
    en: { subject: "Confirmation needed: {{module}}", body: "Hello {{name}},\n\nYou finished “{{module}}” but have not confirmed it yet. Please confirm — it takes a minute.\n\n{{link}}" },
    ru: { subject: "Нужно подтверждение: {{module}}", body: "Здравствуйте, {{name}}!\n\nВы завершили «{{module}}», осталось подтвердить. Пожалуйста, подтвердите — это займёт минуту.\n\n{{link}}" },
  },
};

/** Label of the button that a link on its own line becomes in an email without a label of its own. */
export const EMAIL_BUTTON_LABEL: Record<string, string> = { az: "Açın", en: "Open", ru: "Открыть" };

/** The button of each notification email, saying what the link does. */
const EMAIL_BUTTON_BY_KIND: Record<string, Record<string, string>> = {
  assignment: { az: "Təlimə başlayın", en: "Start the training", ru: "Начать обучение" },
  reminder: { az: "Təlimi davam etdirin", en: "Continue the training", ru: "Продолжить обучение" },
  overdue: { az: "Təlimi davam etdirin", en: "Continue the training", ru: "Продолжить обучение" },
  welcome: { az: "Hesabı aktivləşdirin", en: "Set up your account", ru: "Активировать учётную запись" },
  policy_reminder: { az: "Siyasəti oxuyun", en: "Read the policy", ru: "Открыть политику" },
  confirmation_reminder: { az: "Təsdiqləyin", en: "Confirm now", ru: "Подтвердить" },
  manager: { az: "Əməkdaşın səhifəsini açın", en: "Open their profile", ru: "Открыть профиль сотрудника" },
};

export function emailButtonLabel(kind: string, lang: string): string {
  const labels = EMAIL_BUTTON_BY_KIND[kind] ?? EMAIL_BUTTON_LABEL;
  return labels[lang] ?? labels.en ?? EMAIL_BUTTON_LABEL.en;
}

export const WEBHOOK_EVENTS = [
  "qr.scanned",
  "simulation.risky",
  "simulation.reported",
  "attestation.completed",
  "risk.threshold_crossed",
  "phishing.clicked",
  "issue.reported",
  "admin.audit",
  "threat.reported",
  "incident.created",
  "sandbox.malicious",
] as const;

export function defaultSettings(locale = "az"): TenantSettings {
  return {
    defaultLocale: locale,
    locales: ["az", "en", "ru"],
    protection: { contentProtection: true, watermark: true },
    learning: { timeLimits: true, refresher: true, riskThreshold: 67, dailyGoalXp: 50 },
    attestationText: { ...DEFAULT_ATTESTATION },
    certificate: { publicLink: true },
    notifications: { firstReminderDays: 3, urgentReminderHours: 24, overdueNotice: true, managerAlerts: true, failedSimulations: 2, overdueDays: 7 },
    identity: { requireAdmin2fa: false, maxDevices: null, ssoEnabled: false },
    email: { enabled: false },
    integrations: { webhookEnabled: false, webhookEvents: [], syslogEnabled: false },
  };
}

type Group = Record<string, unknown>;
const group = (v: unknown): Group => (v && typeof v === "object" && !Array.isArray(v) ? (v as Group) : {});

/** Texts per language; a single string saved by an older release belongs to the organisation's default language. */
function perLocale(v: unknown, defaultLocale: string): Record<string, string> | undefined {
  if (typeof v === "string") return v.trim() ? { [defaultLocale]: v } : undefined;
  const entries = Object.entries(group(v)).filter((e): e is [string, string] => typeof e[1] === "string" && !!e[1].trim());
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function certificateWithDefaults(d: TenantSettings["certificate"], stored: Group, defaultLocale: string): TenantSettings["certificate"] {
  const out = { ...d, ...stored } as TenantSettings["certificate"];
  const title = perLocale(stored.title, defaultLocale);
  const text = perLocale(stored.text, defaultLocale);
  delete out.title;
  delete out.text;
  return { ...out, ...(title ? { title } : {}), ...(text ? { text } : {}) };
}

/**
 * Stored settings over the current defaults, group by group. A tenant row written by an older
 * release (or with a group missing) then reads like a complete one: a key added later gets its
 * default instead of undefined. Values that are optional by design (identity.sso, identity.ldap,
 * notification templates, the integration targets) are kept exactly as stored.
 */
export function withDefaults(raw: unknown): TenantSettings {
  const r = group(raw) as Partial<TenantSettings> & Group;
  const d = defaultSettings(typeof r.defaultLocale === "string" && r.defaultLocale ? r.defaultLocale : "az");
  const integrations = group(r.integrations);
  return {
    ...r,
    defaultLocale: d.defaultLocale,
    locales: Array.isArray(r.locales) && r.locales.length ? r.locales.filter((l): l is string => typeof l === "string") : d.locales,
    protection: { ...d.protection, ...group(r.protection) },
    learning: { ...d.learning, ...group(r.learning) },
    attestationText: { ...d.attestationText, ...group(r.attestationText) } as Record<string, string>,
    certificate: certificateWithDefaults(d.certificate, group(r.certificate), d.defaultLocale),
    notifications: { ...d.notifications, ...group(r.notifications) },
    identity: { ...d.identity, ...group(r.identity) },
    email: { ...d.email, ...group(r.email) },
    integrations: {
      ...d.integrations,
      ...integrations,
      webhookEvents: Array.isArray(integrations.webhookEvents) ? integrations.webhookEvents.filter((e): e is string => typeof e === "string") : [],
    },
  } as TenantSettings;
}

/** Plans (docs/business pricing): each adds to the one before. */
export const PLAN_FEATURES = {
  essentials: ["learning", "league", "certificates", "policies", "campaigns", "reports", "lab", "paths", "support", "feedback", "live_sessions"],
  professional: ["ai_tutor", "tutor_voice", "sms_voice", "qr_trap", "sandbox", "threat_intake", "incidents", "risk_profiles", "sso", "ldap", "integrations", "compliance_pack", "studio"],
  enterprise_hrm: ["closed_loops", "approvals", "threat_intel", "policy_intel", "leadership", "ops_center"],
} as const;
export type Feature =
  | (typeof PLAN_FEATURES.essentials)[number]
  | (typeof PLAN_FEATURES.professional)[number]
  | (typeof PLAN_FEATURES.enterprise_hrm)[number];

export function featuresFor(plan: "essentials" | "professional" | "enterprise_hrm", overrides: Record<string, boolean> = {}): Set<Feature> {
  const list: Feature[] = [...PLAN_FEATURES.essentials];
  if (plan !== "essentials") list.push(...PLAN_FEATURES.professional);
  if (plan === "enterprise_hrm") list.push(...PLAN_FEATURES.enterprise_hrm);
  const set = new Set<Feature>(list);
  for (const [k, v] of Object.entries(overrides)) {
    if (v) set.add(k as Feature);
    else set.delete(k as Feature);
  }
  return set;
}
