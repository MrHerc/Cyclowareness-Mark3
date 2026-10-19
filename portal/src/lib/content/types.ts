/**
 * Lesson content DSL (see docs/audit/06-lesson-engine.md).
 * Mirrors the shape served by the original Cyclowareness lesson player.
 */

export type Span = { text: string; spot?: string; reveal?: string; link?: { label: string; href: string } };
export type Rich = string | Span[] | Span[][];

export type Mood = "talk" | "think" | "alert" | "happy" | "celebrate";
export type Gesture =
  | "wave"
  | "point-left"
  | "point-right"
  | "point-down"
  | "recite"
  | "lean-in"
  | "shield-up"
  | "shake"
  | "shrug"
  | "nod";

export type ArtifactBase = { kind: string; brandRef?: string; [key: string]: unknown };

export type EmailArtifact = ArtifactBase & {
  kind: "email";
  from?: { name?: Rich; address?: Rich };
  to?: string;
  subject?: Rich;
  time?: string;
  body?: Rich;
  attachments?: { name: Rich; size?: string }[];
};
export type ChatArtifact = ArtifactBase & {
  kind: "chat";
  app?: string;
  contact?: Rich;
  messages?: { from: "them" | "me"; body: Rich; time?: string; voice?: string; spoken?: string }[];
};
export type SmsArtifact = ArtifactBase & { kind: "sms"; sender?: Rich; time?: string; messages?: Rich[] };
export type DialogArtifact = ArtifactBase & {
  kind: "dialog";
  tone?: "app" | "system" | "warning";
  title?: Rich;
  body?: Rich;
  buttons?: string[];
};
export type LoginArtifact = ArtifactBase & { kind: "login"; brand?: string; url?: Rich; fields?: string[]; button?: string };
export type UrlArtifact = ArtifactBase & { kind: "url"; url: Rich };
export type NotificationArtifact = ArtifactBase & { kind: "notification"; app?: string; title?: Rich; body?: Rich; time?: string };
export type PermissionArtifact = ArtifactBase & {
  kind: "permission";
  app?: string;
  permissions?: { label: Rich; needed: boolean }[];
};
export type CallArtifact = ArtifactBase & { kind: "call"; caller?: Rich; number?: Rich; label?: string; voice?: string };
export type FileArtifact = ArtifactBase & { kind: "file"; name?: Rich; size?: string; type?: string; source?: Rich };
export type QrArtifact = ArtifactBase & { kind: "qr"; destination?: Rich; caption?: Rich };
export type WifiArtifact = ArtifactBase & { kind: "wifi"; networks: { ssid: Rich; secured: boolean; signal: number }[] };

export type Artifact =
  | EmailArtifact
  | ChatArtifact
  | SmsArtifact
  | DialogArtifact
  | LoginArtifact
  | UrlArtifact
  | NotificationArtifact
  | PermissionArtifact
  | CallArtifact
  | FileArtifact
  | QrArtifact
  | WifiArtifact;

export type Visual =
  | { kind: "illustration"; id: string }
  | { kind: "artifact"; artifact: Artifact }
  | { kind: "stat"; value: string; label: string };

export type Beat = {
  id: string;
  say: string;
  mood: Mood;
  gesture?: Gesture;
  visual?: Visual;
  highlight?: string;
  checkpoint?: unknown;
  stage?: unknown;
};

export type Outcome = "safe" | "risky" | "compromised";

export type SimAction = { id: string; label: string; kind: string; outcome: Outcome; feedback: string; next?: string };
export type SimStep = { id: string; label?: string; say?: string; spoken?: string; artifact: Artifact; actions: SimAction[] };

export type ScenarioChoice = { label: string; next?: string; outcome?: Outcome; feedback: string };
export type ScenarioNode = {
  id: string;
  text: string;
  speaker?: string;
  voice?: string;
  channel?: string;
  character?: string;
  spoken?: string;
  choices?: ScenarioChoice[];
  outcome?: Outcome;
};

export type Scene =
  | { type: "tutor"; id: string; beats: Beat[] }
  | { type: "intro"; id: string; title: string; body: string; mood?: Mood; visual?: Visual }
  | { type: "simulation"; id: string; environment: "inbox" | "phone" | "browser" | "desktop" | "call"; title: string; intro: string; steps: SimStep[] }
  | {
      type: "choice";
      id: string;
      question: { prompt: string; options: { id: string; label: string; correct: boolean; feedback: string }[] };
      explain?: string;
      /** Several options are right (also implied by more than one `correct` option): the learner picks all of them. */
      multi?: boolean;
      /** Illustration or artifact shown beside the question, as on the original question step. */
      visual?: Visual;
    }
  | { type: "hotspot"; id: string; prompt: string; artifact: Artifact; spots: { id: string; label: string; explain: string }[]; minToFind: number }
  | { type: "swipe"; id: string; prompt: string; cards: { id: string; artifact: Artifact; verdict: "threat" | "safe"; explain: string }[] }
  | { type: "match"; id: string; prompt: string; pairs: { id: string; left: string; right: string }[]; explain?: string }
  | { type: "order"; id: string; prompt: string; items: { id: string; label: string }[]; explain?: string }
  | { type: "scenario"; id: string; title: string; start: string; nodes: ScenarioNode[] }
  | { type: "password"; id: string; prompt: string; targetScore: number; tips: string[] }
  | { type: "recap"; id: string; points: string[]; mood?: Mood };

export type SceneType = Scene["type"];

export type LessonFile = { id: string; title: string; minutes: number; scenes: Scene[] };

export type Brand = {
  id: string;
  name: string;
  kind: string;
  color: string;
  glyph: string;
  monogram?: string;
  fake?: boolean;
  imitates?: string;
};

export type ModuleFile = {
  slug: string;
  category: string;
  audience: string[];
  title: string;
  subtitle: string;
  minutes: number;
  lessonCount: number;
  xp: number;
  difficulty: "Easy" | "Medium" | "Hard";
  lessons: { id: string; title: string; minutes: number }[];
};

/** Flattens rich text to a plain string. */
export function plain(r: Rich | undefined | null): string {
  if (!r) return "";
  if (typeof r === "string") return r;
  if (r.length === 0) return "";
  if (Array.isArray(r[0])) return (r as Span[][]).map((p) => p.map((s) => s.text).join("")).join("\n");
  return (r as Span[]).map((s) => s.text).join("");
}

/** Normalises rich text to paragraphs of spans. */
export function paragraphs(r: Rich | undefined | null): Span[][] {
  if (!r) return [];
  if (typeof r === "string") return [[{ text: r }]];
  if (r.length === 0) return [];
  if (Array.isArray(r[0])) return r as Span[][];
  return [r as Span[]];
}
