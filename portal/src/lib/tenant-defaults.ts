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
  en: 'On {date}, {name} successfully completed the module "{module}" and confirmed that they will follow the rules of cyber hygiene.',
  ru: "{date} {name} успешно завершил(а) модуль «{module}» и подтвердил(а), что будет соблюдать правила кибергигиены.",
};

export const DEFAULT_TEMPLATES: Record<TemplateKind, Record<string, { subject: string; body: string }>> = {
  assignment: {
    az: { subject: "Yeni təlim: {{module}}", body: "Salam, {{name}}!\n\nSizə «{{module}}» təlimi təyin edilib. Son tarix: {{dueDate}}.\n\n{{link}}" },
    en: { subject: "New training: {{module}}", body: "Hello {{name}},\n\nYou have been assigned “{{module}}”. Due date: {{dueDate}}.\n\n{{link}}" },
    ru: { subject: "Новое обучение: {{module}}", body: "Здравствуйте, {{name}}!\n\nВам назначено обучение «{{module}}». Срок: {{dueDate}}.\n\n{{link}}" },
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
    az: { subject: "Komandanızda diqqət tələb edən hal", body: "Salam, {{name}}!\n\nKomandanızdan {{person}} üçün diqqət tələb olunur: {{reason}}.\n\n{{link}}" },
    en: { subject: "Someone in your team needs attention", body: "Hello {{name}},\n\n{{person}} in your team needs attention: {{reason}}.\n\n{{link}}" },
    ru: { subject: "Сотруднику вашей команды нужно внимание", body: "Здравствуйте, {{name}}!\n\nСотруднику {{person}} нужно внимание: {{reason}}.\n\n{{link}}" },
  },
  welcome: {
    az: { subject: "Xoş gəlmisiniz", body: "Salam, {{name}}!\n\n{{organisation}} sizi qısa kibergigiyena dərslərinə dəvət edir. Hesabınızı aktivləşdirmək üçün linkə keçin.\n\n{{link}}" },
    en: { subject: "Welcome aboard", body: "Hello {{name}},\n\n{{organisation}} invites you to short cyber hygiene lessons. Use the link to set up your account.\n\n{{link}}" },
    ru: { subject: "Добро пожаловать", body: "Здравствуйте, {{name}}!\n\n{{organisation}} приглашает вас на короткие уроки по кибергигиене. Перейдите по ссылке, чтобы активировать учётную запись.\n\n{{link}}" },
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
    az: { subject: "Təsdiq gözlənilir: {{module}}", body: "Salam, {{name}}!\n\n«{{module}}» təlimini bitirmisiniz, təsdiq qalıb. Zəhmət olmasa təsdiqləyin — bir dəqiqə çəkir.\n\n{{link}}" },
    en: { subject: "Confirmation needed: {{module}}", body: "Hello {{name}},\n\nYou finished “{{module}}” but have not confirmed it yet. Please confirm — it takes a minute.\n\n{{link}}" },
    ru: { subject: "Нужно подтверждение: {{module}}", body: "Здравствуйте, {{name}}!\n\nВы завершили «{{module}}», осталось подтвердить. Пожалуйста, подтвердите — это займёт минуту.\n\n{{link}}" },
  },
};

/** Label of the button that a link on its own line becomes in notification emails. */
export const EMAIL_BUTTON_LABEL: Record<string, string> = { az: "Aç", en: "Open", ru: "Открыть" };

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
