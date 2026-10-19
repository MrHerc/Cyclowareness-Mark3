/**
 * Shape of the public landing copy (content/landing/{locale}.json, one file per language).
 * Lines carry an id (audio clip id), the text, an emotion tag and the voice (guide or caller).
 */
export type Line = { id: string; text: string; emotion?: string; voice?: "guide" | "caller"; spoken?: string };

export type InboxCard = {
  id: string;
  channel: "email" | "sms" | "qr";
  sender: string;
  address?: string;
  subject?: string;
  body: string;
  action?: string;
  opens?: string;
  isPhish: boolean;
  hint: Line;
  right: Line;
  wrong: Line;
};

export type LandingCopy = {
  seo: { title: string; description: string; ogTitle: string; ogDescription: string };
  ui: Record<
    | "home"
    | "signIn"
    | "language"
    | "screenLabel"
    | "quiet"
    | "quietOff"
    | "next"
    | "skip"
    | "replay"
    | "captionLabel"
    | "fallbackNote"
    | "footer"
    | "forget"
    | "forgotten"
    | "contactLabel"
    | "socialLabel"
    | "regNoLabel"
    | "partnersLabel"
    | "testimonialsLabel",
    string
  >;
  hero: { question: string; sub: string; start: string; demo: string };
  attract: {
    idle: { move: string; line: Line }[];
    tapPrompt: string;
    greeting: Line;
    greetings: Record<"morning" | "day" | "evening" | "night", Line>;
    nudge: Line;
  };
  rapport: {
    returning: Record<"none" | "low" | "mid" | "high", Line>;
    score: Record<"low" | "mid" | "high", Line>;
    fast: Line;
    role: Record<"security" | "people" | "leader" | "employee", Line>;
    quietOn: string;
  };
  tour: {
    frame: Line[];
    railLabel: string;
    doneLabel: string;
    chapters: Record<Chapter, string>;
    beats: Record<Chapter, Partial<Record<"bridge" | "intro" | "prompt" | "lesson", Line>>>;
  };
  scenes: [InboxScene, PhoneScene, TutorScene, LanguagesScene, AdminScene, DeployScene, DemoScene];
  faq: { title: string; items: { id: string; question: string; answer: string }[] };
};

export const CHAPTERS = ["hero", "phone", "tutor", "languages", "admin", "deploy", "demo"] as const;
export type Chapter = (typeof CHAPTERS)[number];

export type InboxScene = {
  kind: "inbox";
  clock: string;
  newMessage: string;
  open: string;
  apps: Record<"email" | "sms" | "qr", string>;
  opensLabel: string;
  phish: string;
  safe: string;
  answerGroup: string;
  next: string;
  rightLabel: string;
  wrongLabel: string;
  truthPhish: string;
  truthSafe: string;
  again: string;
  progress: string;
  scoreLabel: string;
  rolePrompt: string;
  roles: { id: "security" | "people" | "leader" | "employee"; label: string }[];
  arrived: Line;
  done: Line;
  cards: InboxCard[];
};
export type PhoneScene = {
  kind: "phone";
  headline: string;
  line: string;
  callerName: string;
  callerNumber: string;
  ringing: string;
  answer: string;
  decline: string;
  callerLabel: string;
  hangUp: string;
  giveCode: string;
  again: string;
  ring: Line;
  script: Line[];
  declined: Line;
  hungUp: Line;
  gaveCode: Line;
};
export type TutorScene = { kind: "tutor"; headline: string; line: string; sample: string; chips: { id: string; question: string; answer: Line }[] };
export type LanguagesScene = { kind: "languages"; headline: string; line: string; samples: { locale: string; line: Line }[] };
export type AdminScene = {
  kind: "admin";
  headline: string;
  line: string;
  departments: { id: string; name: string }[];
  you: string;
  columns: Record<"clicked" | "reported" | "learned", string>;
  export: string;
  explain: Line;
};
export type DeployScene = { kind: "deploy"; headline: string; line: string; cloud: { title: string; line: string; said: Line }; onPrem: { title: string; line: string; said: Line } };
export type DemoScene = {
  kind: "demo";
  headline: string;
  line: string;
  fullName: string;
  workEmail: string;
  organisation: string;
  employees: string;
  employeeRanges: Record<"lt100" | "100to500" | "500to2000" | "gt2000", string>;
  country: string;
  countryPrompt: string;
  message: string;
  optional: string;
  consent: string;
  consentVersion: string;
  submit: string;
  sending: string;
  errors: Record<"required" | "email" | "rateLimited" | "failed", string>;
  invite: Line;
  success: Line;
};

export type GuideTiming = { attractFirstSeconds: number; attractMinGapSeconds: number; attractMaxGapSeconds: number; attractMaxLines: number; nudgeSeconds: number; fastSeconds: number; memoryDays: number };

/**
 * Footer and social-proof data of the public site (content/landing/site.json, the same for every
 * language). Empty values hide their part of the page.
 */
export type SiteData = {
  contact: { email: string; phone: string };
  social: { name: string; url: string }[];
  regNo: string;
  partners: { name: string; logo: string }[];
  testimonials: { quote: string; author: string; org: string }[];
};

export const EMPLOYEE_RANGES = ["lt100", "100to500", "500to2000", "gt2000"] as const;

/** Priority countries first in the demo form (as on the original site). */
export const PRIORITY_COUNTRIES = ["AZ", "TR", "GE", "KZ", "UZ", "UA", "RO", "MD", "DE", "GB"] as const;

/** ISO 3166-1 alpha-2 codes of countries and territories offered in the demo form. */
export const COUNTRY_CODES =
  "AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW".split(
    " ",
  );
