/** Demo organisation (Safarov Industries) for local development and sales demos. All people are fictional. */

export const DEMO_DOMAIN = "safarovindustries.com";

export type DeptKey = "exec" | "it" | "sec" | "fin" | "hr" | "legal" | "ops";

export const DEPARTMENTS: { key: DeptKey; name: string; parent?: DeptKey }[] = [
  { key: "exec", name: "Rəhbərlik" },
  { key: "it", name: "İT" },
  { key: "sec", name: "Kibertəhlükəsizlik", parent: "it" },
  { key: "fin", name: "Maliyyə" },
  { key: "hr", name: "İnsan resursları" },
  { key: "legal", name: "Hüquq" },
  { key: "ops", name: "İstehsalat" },
];

export type SeedPerson = {
  name: string;
  email?: string;
  role: "learner" | "department_head" | "executive" | "analyst" | "campaign_manager" | "content_creator" | "tenant_admin";
  dept: DeptKey;
  title: string;
  /** 0–1: how much they learn. */
  activity: number;
  /** 0–1: how often they answer correctly / spot fakes. */
  skill: number;
  status?: "active" | "invited" | "suspended";
  head?: boolean;
  phone?: string;
  joinedDaysAgo?: number;
  locale?: "az" | "en" | "ru";
};

/** Accounts with a role-named email are the ones to sign in with (see README). */
export const PEOPLE: SeedPerson[] = [
  { name: "Rəşad Hüseynov", email: "admin", role: "tenant_admin", dept: "exec", title: "Rəqəmsal transformasiya direktoru", activity: 0.55, skill: 0.85 },
  { name: "Kamran Babayev", email: "leader", role: "executive", dept: "exec", title: "Baş direktor", activity: 0.35, skill: 0.7, head: true },
  { name: "Rauf Həsənov", role: "learner", dept: "exec", title: "Baş direktorun müavini", activity: 0.25, skill: 0.6 },
  { name: "Elnarə Həsənova", role: "learner", dept: "exec", title: "Baş direktorun köməkçisi", activity: 0.6, skill: 0.65 },

  { name: "Tural Həsənli", email: "head", role: "department_head", dept: "it", title: "İT şöbəsinin rəhbəri", activity: 0.7, skill: 0.85, head: true },
  { name: "Orxan Quliyev", role: "learner", dept: "it", title: "Sistem inzibatçısı", activity: 0.85, skill: 0.9 },
  { name: "Fərid Əliyev", role: "learner", dept: "it", title: "Şəbəkə mühəndisi", activity: 0.6, skill: 0.8 },
  { name: "Lalə Rzayeva", role: "learner", dept: "it", title: "Proqram təminatı mühəndisi", activity: 0.75, skill: 0.85, locale: "en" },
  { name: "Murad Səfərov", role: "learner", dept: "it", title: "Texniki dəstək mütəxəssisi", activity: 0.45, skill: 0.6 },

  { name: "Səbinə Əliyeva", email: "analyst", role: "analyst", dept: "sec", title: "Təhlükəsizlik analitiki", activity: 0.9, skill: 0.95, head: true },
  { name: "Nigar Quliyeva", email: "campaigns", role: "campaign_manager", dept: "sec", title: "Məlumatlandırma proqramı meneceri", activity: 0.8, skill: 0.9 },
  { name: "Elvin Məmmədov", role: "analyst", dept: "sec", title: "SOC mütəxəssisi", activity: 0.7, skill: 0.9 },

  { name: "Aynur Kərimova", role: "department_head", dept: "fin", title: "Maliyyə şöbəsinin rəhbəri", activity: 0.5, skill: 0.7, head: true },
  { name: "Günel Hüseynova", email: "learner", role: "learner", dept: "fin", title: "Baş mühasib", activity: 0.55, skill: 0.55, phone: "+994500000101" },
  { name: "Samir Abbasov", role: "learner", dept: "fin", title: "Mühasib", activity: 0.35, skill: 0.45 },
  { name: "Leyla İsmayılova", role: "learner", dept: "fin", title: "Xəzinədar", activity: 0.65, skill: 0.6, locale: "ru" },
  { name: "Ramil Nəsirov", role: "learner", dept: "fin", title: "Maliyyə analitiki", activity: 0.2, skill: 0.4 },
  { name: "Könül Bağırova", role: "learner", dept: "fin", title: "Ödənişlər üzrə mütəxəssis", activity: 0.4, skill: 0.5, joinedDaysAgo: 12 },

  { name: "Aysel Məmmədova", email: "content", role: "content_creator", dept: "hr", title: "Təlim və inkişaf meneceri", activity: 0.85, skill: 0.85 },
  { name: "Nərmin Cəfərova", role: "department_head", dept: "hr", title: "Kadrlar şöbəsinin rəhbəri", activity: 0.6, skill: 0.75, head: true },
  { name: "Səidə Vəliyeva", role: "learner", dept: "hr", title: "Kadr mütəxəssisi", activity: 0.7, skill: 0.7 },
  { name: "Emil Hacıyev", role: "learner", dept: "hr", title: "İşə qəbul mütəxəssisi", activity: 0.5, skill: 0.55 },
  { name: "Gülnar Əhmədova", role: "learner", dept: "hr", title: "Əmək haqqı mütəxəssisi", activity: 0.3, skill: 0.45 },

  { name: "Zaur Məlikov", role: "department_head", dept: "legal", title: "Hüquq şöbəsinin rəhbəri", activity: 0.45, skill: 0.8, head: true },
  { name: "Fidan Novruzova", role: "learner", dept: "legal", title: "Hüquqşünas", activity: 0.6, skill: 0.75 },
  { name: "Kənan Şükürov", role: "learner", dept: "legal", title: "Uyğunluq mütəxəssisi", activity: 0.8, skill: 0.85 },
  { name: "Arzu Zeynalova", role: "learner", dept: "legal", title: "Fərdi məlumatlar üzrə mütəxəssis", activity: 0.7, skill: 0.8 },

  { name: "Vüsal Kazımov", role: "department_head", dept: "ops", title: "İstehsalat rəhbəri", activity: 0.4, skill: 0.6, head: true },
  { name: "Nurlan Əsgərov", role: "learner", dept: "ops", title: "Dəzgah operatoru", activity: 0.3, skill: 0.4 },
  { name: "Sevinc Hüseynli", role: "learner", dept: "ops", title: "Anbar operatoru", activity: 0.55, skill: 0.5 },
  { name: "Pərvin Allahverdiyeva", role: "learner", dept: "ops", title: "Növbə ustası", activity: 0.5, skill: 0.6 },
  { name: "Toğrul Əzizov", role: "learner", dept: "ops", title: "Dəzgah operatoru", activity: 0.15, skill: 0.35 },
  { name: "Xəyalə Mirzəyeva", role: "learner", dept: "ops", title: "Keyfiyyətə nəzarət mütəxəssisi", activity: 0.45, skill: 0.55, joinedDaysAgo: 8 },
  { name: "Cavid Rüstəmov", role: "learner", dept: "ops", title: "Dəzgah operatoru", activity: 0, skill: 0.5, status: "invited", joinedDaysAgo: 3 },
  { name: "Ülviyyə Qasımova", role: "learner", dept: "ops", title: "Operator", activity: 0.1, skill: 0.4, status: "suspended" },
];

const TRANSLIT: Record<string, string> = { ə: "e", ı: "i", ö: "o", ü: "u", ş: "s", ç: "c", ğ: "g", İ: "i", Ə: "e", Ö: "o", Ü: "u", Ş: "s", Ç: "c", Ğ: "g" };

export function emailFor(p: SeedPerson): string {
  if (p.email) return `${p.email}@${DEMO_DOMAIN}`;
  const local = p.name
    .split("")
    .map((c) => TRANSLIT[c] ?? c)
    .join("")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim()
    .replace(/\s+/g, ".");
  return `${local}@${DEMO_DOMAIN}`;
}

/** Deterministic PRNG so every seed produces the same organisation. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
