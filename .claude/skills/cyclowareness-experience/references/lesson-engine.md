# Lesson engine: content format, player, narration, AI Sel, attestation

Reference for everything a learner meets between `Start` and `I confirm` in
`/learn/[slug]/[lessonId]`. Spec of the original: `docs/audit/06-lesson-engine.md` (data format,
scene types, beats, artifacts, brands, mascot), `docs/audit/02-learner-app.md` sections 4 and 9
(player UI, gamification), `docs/audit/00-overview.md` (TTS, flags). Code: `portal/src/components/player/`,
`portal/src/lib/content/`, `portal/src/app/(focus)/learn/[slug]/[lessonId]/page.tsx`,
`portal/src/app/api/tutor/route.ts`, `portal/src/server/tutor.ts`, `portal/src/server/services/progress.ts`.
All paths below are relative to the repo root unless they start with `src/`, `content/`, `tests/`,
`messages/` or `scripts/`, which are under `portal/`.

## Table of contents

1. [What the original did](#1-what-the-original-did)
   - 1.1 [Lesson page props](#11-lesson-page-props)
   - 1.2 [The 11 scene types](#12-the-11-scene-types)
   - 1.3 [Beats: mood, gesture, visual, highlight, checkpoint, stage](#13-beats)
   - 1.4 [Rich text spans and spots](#14-rich-text-spans-and-spots)
   - 1.5 [Artifacts and simulation environments](#15-artifacts-and-simulation-environments)
   - 1.6 [Narration manifest, karaoke, speed, sound](#16-narration-manifest-karaoke-speed-sound)
   - 1.7 [Player chrome: top bar, options dialog, intro, feedback, recap](#17-player-chrome)
   - 1.8 [Tutor "Ask", timers, attestation, gamification](#18-tutor-ask-timers-attestation-gamification)
2. [Current content format](#2-current-content-format)
   - 2.1 [TypeScript types](#21-typescript-types)
   - 2.2 [Files, naming, locales](#22-files-naming-locales)
   - 2.3 [Validation](#23-validation)
   - 2.4 [Illustrations and brands](#24-illustrations-and-brands)
   - 2.5 [What differs from the original and why](#25-what-differs-from-the-original-and-why)
3. [Player architecture](#3-player-architecture)
   - 3.1 [Component tree and props assembly](#31-component-tree-and-props-assembly)
   - 3.2 [State: phase, scene index, answers, resume](#32-state-phase-scene-index-answers-resume)
   - 3.3 [Scene renderers (one per type)](#33-scene-renderers)
   - 3.4 [Narration hook API and karaoke](#34-narration-hook-api-and-karaoke)
   - 3.5 [Speed, sound, motion, haptics](#35-speed-sound-motion-haptics)
   - 3.6 [Timers](#36-timers)
   - 3.7 [Keyboard and touch accessibility](#37-keyboard-and-touch-accessibility)
   - 3.8 [i18n key groups](#38-i18n-key-groups)
   - 3.9 [Completion, XP, streak, risk, attestation, certificate](#39-completion-xp-streak-risk-attestation-certificate)
   - 3.10 [Teachable moment](#310-teachable-moment)
4. [AI Sel tutor](#4-ai-sel-tutor)
5. [Conventions and gotchas](#5-conventions-and-gotchas)
6. [Recipes](#6-recipes)
   - 6.1 [Add a new lesson](#61-add-a-new-lesson)
   - 6.2 [Add a new scene type](#62-add-a-new-scene-type)
   - 6.3 [Translate a lesson to az/ru](#63-translate-a-lesson-to-azru)
   - 6.4 [Add an illustration](#64-add-an-illustration)
   - 6.5 [Add a brand or an artifact kind](#65-add-a-brand-or-an-artifact-kind)
   - 6.6 [Switch narration to pre-generated TTS](#66-switch-narration-to-pre-generated-tts)
   - 6.7 [Tune timers](#67-tune-timers)
   - 6.8 [Add a tutor capability](#68-add-a-tutor-capability)
7. [Gaps vs the original](#7-gaps-vs-the-original)

---

## 1. What the original did

Source: `docs/audit/06-lesson-engine.md` (Azerbaijani). The data below was captured from the live
cylosof.com lesson page props on 2026-10-15; the 106 EN lesson files sit in
`docs/audit/content/lessons/{module}/{lessonId}.en.json`, the human-readable script book in
`docs/audit/content/lessons/SCRIPTS.en.md`, the lesson index (scene list, clip count, seconds of audio
per lesson) in `_index.json`, the 169-brand registry in `_brands.json`, and one full narration manifest
in `_narration-sample.json`.

### 1.1 Lesson page props

From `06-lesson-engine.md` section 1 (verified against `phishing-email/spot-the-phish.en.json`, whose
top-level keys are `module, lesson, nextLesson, isLastLesson, locale, userId, timeLimitsEnabled,
difficulty, timerPreference, contentRevision, appBuild, narrationClipCount, narrationTotalMs`):

```ts
type LessonPageProps = {
  module: { slug: string; title: string; category: Category };   // email | identity | social | devices | data | physical | incident | ai-threats | work
  lesson: { id: string; title: string; minutes: number; scenes: Scene[] };
  nextLesson: { id: string; title: string } | null;
  isLastLesson: boolean;          // true: attestation ("Confirm the module") follows
  locale: 'az' | 'en' | 'ru' | ...;
  narration: Record<string /* the `say` text */, { url: string; durationMs: number; words: { w: string; startMs: number; endMs: number }[] }>;
  userId: string;
  timeLimitsEnabled: boolean;     // tenant: Settings → Learning
  difficulty: 1 | 2 | 3;          // Easy | Medium | Hard
  timerPreference: 'standard' | 'more' | 'off';   // learner: Profile → Question timer
  contentRevision?: string;
  appBuild: string;               // git sha
};
// Separately, at layout level: brands: Record<string, Brand>
```

### 1.2 The 11 scene types

Counts across the 106 lessons (spec table, re-counted identically in `content/library/lessons`):

| type | count | fields | UI |
|---|---|---|---|
| `tutor` | 106 | `beats[]` | Explanation: mascot talks, karaoke text, visual on the left |
| `intro` | 1 | `title, body, mood, visual` | Scenario intro ("Your turn") |
| `simulation` | 97 | `environment, title, intro, steps[]` | Interactive environment (inbox / phone / browser / desktop / call) |
| `choice` | 94 | `question{prompt, options[{id,label,correct,feedback}]}, explain` | Multiple choice + feedback sheet |
| `hotspot` | 59 | `prompt, artifact, spots[{id,label,explain}], minToFind` | Tap the suspicious parts of an artifact |
| `swipe` | 55 | `prompt, cards[{id, artifact, verdict: threat/safe, explain}]` | Swipe a card left/right: "Safe or a trap?" |
| `match` | 44 | `prompt, pairs[{id,left,right}], explain` | Match the pairs |
| `scenario` | 41 | `title, start, nodes[{id,text,speaker,voice,channel,character,spoken,choices[{label,next|outcome,feedback}]}]` | Branching dialogue (call, message, in person, video) |
| `order` | 35 | `prompt, items[{id,label}], explain` | Put steps in order (items are stored in the right order; the UI shuffles) |
| `password` | 4 | `prompt, targetScore (0–4), tips[]` | Password-strength exercise (zxcvbn-style score) |
| `recap` | 106 | `points[], mood: celebrate` | Lesson summary |

Typical sequence: `tutor` → `simulation` → `hotspot`/`swipe`/`match`/`order` → `choice` → `recap`.

### 1.3 Beats

Inside `tutor`: `{ id, say, mood, gesture?, visual, highlight?, checkpoint?, stage? }`.

- `mood`: `talk | think | alert | happy | celebrate` (library usage: talk 129, think 100, alert 115, happy 85; `celebrate` only on recap).
- `gesture`: `wave, point-left, point-right, point-down, recite, lean-in, shield-up, shake, shrug, nod` (39 beats have none).
- `visual.kind`: `illustration` (by id) | `artifact` (section 1.5) | `stat` (`value` + `label`, e.g. `"3-2-1"`, `"15+ characters"`; 9 in the library).
- `highlight`: a `spot` id in the beat's artifact; that part lights up while the beat is spoken (screenshot `lesson-05-highlight-narration.jpg`: the urgency sentence on a red background while the mascot says "A deadline and a threat").
- `checkpoint`: `{ prompt, options[{id,label,correct,feedback}] }`, a question asked right after the beat (11 beats in the library, e.g. `spot-the-phish#meet-the-phish/sender`).
- `stage`: one beat in the library (`passwords-mfa/passphrases`, beat `phrase`, value `"back"`). Meaning not documented in the spec.
- Illustration ids (29): `shield, eye, lock, alarm, phone-lock, handshake, browser, badge-id, key, mfa-phone, inbox, folder, social, mask, download, deepfake, hook, cloud, usb, desk, update, wifi, ceo, ransomware, travel, certificate, vpn, flag, qr`. The spec says they were two-tone (brand + accent) SVG scenes on a circular background and "must be redrawn".

### 1.4 Rich text spans and spots

Text fields can be `Span[]` (one line) or `Span[][]` (paragraphs):
`{ text: string; spot?: string; link?: { label, href }; reveal?: string }`.

- `spot`: a hotspot and highlight zone (192 distinct ids in the original: `domain, link, urgency, deadline, fee, new-iban, twin, ext, zip, sender-domain, greeting ...`).
- `reveal`: what the Lens tool shows as the truth ("Actually …", e.g. `After "agent" comes a capital Latin "I", not a lowercase "l"`).
- `link.href`: the real target, visible on hover or through the Lens.

### 1.5 Artifacts and simulation environments

Eleven artifact kinds in the spec, all with `brandRef`: `email` (161) · `chat` (151) · `dialog` (135) ·
`call` (90) · `url` (74) · `notification` (70) · `sms` (60) · `file` (40) · `login` (39) ·
`permission` (31) · `qr` (13). A twelfth, `wifi`, appears in 4 original lesson files
(`events-delegations/event-wifi-charging` among them) although the spec table does not list it.

- `email`: `from{name,address}`, `to`, `subject`, `time`, `body`, `attachments[{name,size}]`
- `chat`: `app` (whatsapp / telegram / generic / brand app), `contact`, `messages[{from: them|me, body, voice?, spoken?}]` (a message can be a voice message)
- `sms`: `sender`, `time`, `messages` · `dialog`: `tone` (app / system / warning), `title`, `body`, `buttons[]`
- `login`: `brand`, `url`, `fields[]`, `button` · `url`: `url` spans with `reveal`
- `notification`: `app`, `title`, `body`, `time` · `permission`: `app`, `permissions[{label, needed}]`
- `call`: caller, number (and `voice` for the caller's TTS voice) · `file`: name, extension, size (hidden `.exe` / `.html` / `.zip` traps) · `qr`: the code and its destination

Simulation: `environment` is `phone` (26), `browser` (23), `desktop` (19), `call` (15), `inbox` (14).
`steps[]`: `{ id, label?, say?, spoken?, artifact, actions[] }`, one artifact and action buttons per step.
`actions[]`: `{ id, label, kind, outcome: 'safe' | 'risky' | 'compromised', feedback, next? }`, 30 kinds
(`report, reply, cancel, share, verify, click-link, ignore, delete, open, enter-credentials, hang-up,
keep-private, allow, call-back, later, deny, block, install, open-attachment, mark-safe, answer, decline,
forward, update, disconnect, connect, eject, plug-in, enable-content, scan`). `next` branches to another
step; otherwise the next step follows. Outcomes in the original data (simulation actions and scenario
choices together): 626 safe, 318 risky, 250 compromised (simulation actions alone: 579 / 241 / 202);
they feed the risk score, admin reports and the webhooks `simulation.risky` / `simulation.reported`.

Scenario (branching dialogue): `channel` is `phone, in-person, message, video`; `voice` (11):
`man, man-2, man-3, woman, woman-2, young-woman, young-man, young-man-2, older-man, older-woman, child`;
`character` (13): `leyla, kamran, guest, tural, minister, assistant, narmin, aysel, gunay, rashad, citizen,
guard, nigar`. A choice either goes to `next` or ends with `outcome`. `spoken` carries TTS stage tags
(`<breath>`, `<short pause>`; the data also has `<cough>`, `<sigh>`, `<throat-clearing>`) and filler words
such as `uh`. 22 of the 106 scenario nodes also carry a `visual` (not in the spec): 11 illustrations and 11
artifacts (six `call` screens, plus `sms`, `dialog`, `email`, `chat`, `qr`); only
`deepfake-scams/voice-clones#boss-call/call` marks the caller's number as a `spot`.

Brand registry (`_brands.json`, 169 entries): `{ id, name, kind, color, glyph (lucide icon name),
monogram?, fake?, imitates? }`. Kinds: app 55, gov 21, employer 17, generic 13, cloud 10, shop 10, media 10,
courier 7, utility 7, payment 5, bank 4, social 4, telecom 3, messenger 2, hotel 1. A fake brand
(`fake: true, imitates: "<real-id>"`) has the same name and a slightly different colour. All brands are
fictional (Xidmət Agentliyi, DocuSfera, NovaBank, SuretKargo...).

### 1.6 Narration manifest, karaoke, speed, sound

`00-overview.md`: pre-generated TTS, one file per sentence at `/generated/tts/{locale}/{hash}.m4a`;
the text is highlighted word by word in sync ("karaoke"). `06-lesson-engine.md` section 1: clips are
keyed by the text itself (`narration["Hello! I am…"]`), so a changed sentence regenerates its clip;
an average lesson has 35–40 clips and ~3.5 minutes of audio (`spot-the-phish`: 39 clips, 220 879 ms).
Manifest entry (from `_narration-sample.json`):

```json
"Hello! I am your security helper. Today you will learn to spot a fake email in seconds.": {
  "url": "/generated/tts/en/40e203f9f88ea294b728.m4a",
  "durationMs": 7100,
  "words": [ { "w": "Hello!", "startMs": 0, "endMs": 444 }, { "w": "I", "startMs": 976, "endMs": 1065 }, ... ]
}
```

Player behaviour (section 4 of the spec): every `say` is spoken; words light up from the timings and the
`highlight` spot lights up in the artifact; when the clip ends the tutor beat advances by itself. The
current word has a brand-100 background, read words are `ink`, unread words `ink-subtle`
(`02-learner-app.md` section 4, step type 1). The landing page used a near-identical clip format
(`docs/audit/content/landing/audio-manifest.sample.json`: clip id → `{url, durationMs, words[{word,startMs,endMs}]}`,
`word` instead of `w`).

### 1.7 Player chrome

`02-learner-app.md` section 4 and screenshots `docs/audit/screens/lesson-01..10*.jpg`,
`lesson-intro.jpg`, `lesson-options-dialog.jpg`, `lesson-step-narration.jpg`, `lesson-step-quiz-email.jpg`:

- Full screen, rail hidden, `canvas` background. Top bar: `✕` (Leave lesson) · progress bar (brand fill on a
  `sunken` track) · `🎤 Ask` (Ask the tutor a question, voice) · `1×` (Change narration speed, cycles) ·
  `🔊` (Turn sound off) · `⋯` (More options).
- More options dialog: `Lesson options`, `Motion` segment `Full | Calm | Still` (also in Profile),
  `⚠ Report a problem`; blurred overlay, `radius-2xl` card.
- Intro screen: large floating Rive mascot with shadow ellipse, lesson title (display), module name, pills
  (`⏱ 3 min`, green `✓ Completed`), primary `Start` / `↻ Review again`, below it
  `🎧 Turn the sound on to hear the tutor`.
- Narration step: illustration or email card on the left; small mascot + step dots on the right (active dot
  is a long pill); big bold text with karaoke. Bottom: `‹` Previous part, `↻` Replay, `⏸`/`▶`, primary
  `Next` (or `Answer the question` before a checkpoint).
- Question step: title prompt, numbered white pills in a `radiogroup`, `Check` disabled until a pick.
- Feedback sheet rising from the bottom: safe-50 background, mascot, `✓`, `Well done` (safe-600), the
  explanation (spoken), `Continue` with an auto-advance progress line at its bottom edge; the chosen
  option gets a green frame and `✓`, the rest fade. Simulation decisions show `Good move` in a modal.
- Mailbox simulation "Morning inbox" (`lesson-06..10`): header with envelope icon, dot progress and
  `0 of 5 emails handled`; intro card with `Mailbox` label and `Start`; a full mail client (`Mail` logo,
  `Search mail`, avatar `Y`, folders `Inbox 5 / Sent / Drafts / Spam / Archive / Trash`, list rows with
  unread dot, avatar, sender, time, subject, preview, `☆`; empty reading pane `Select an email`). Opening
  a mail shows a spoken tutor tip (`Read the sender address letter by letter.`) and an action bar
  `⚑ Report phishing | 🗑 Delete`. The `🔍 Lens` button animates a magnifier to the next suspicious detail
  with a dark tooltip `Actually / After "agent" comes a capital Latin "I" …` and the real link target
  (`lesson-09-mailbox-sim-lens.jpg`); `Move the lens to the next detail` steps on.
- Recap, then (after the module's last lesson) attestation `Confirm the module` with the tenant text from
  `/api/attestations.text` and `I confirm`, then the certificate at `/c/{token}`.

### 1.8 Tutor "Ask", timers, attestation, gamification

- Tutor: microphone question inside the lesson (`microphone=(self)` permissions policy); answers in the
  lesson's context (lesson and current scene). Feature flags `ai_tutor`, `tutor_voice`.
- Timers: when `timeLimitsEnabled && difficulty >= 2` some questions are timed; `timerPreference`
  `more` / `off` extends or disables the timer (Profile → Question timer: Standard / More time / Off).
- Attestation: after the last lesson; text per tenant (`custom_attestation_text` flag); certificate issued
  when module + attestation are complete; certificate text has `{name}`, `{module}`, `{date}` placeholders.
- Gamification (`02-learner-app.md` section 9): module XP is split across its lessons; daily goal 50 XP;
  175 XP shows level 2 at 50 %; streak with `streakFreezes`; `riskScore` 0–100 (lower is better; admin
  bands 0–33 Low, 34–66 Medium, 67–100 High; refresher threshold 67); department league monthly, score =
  60 % completion + 40 % phishing reporting; every report +5 XP (`report_bonus`).
- Feature flags seen in the original `/api/me.features` that touch the player: `ai_tutor, tutor_voice,
  time_limits, teachable_moment, certificates, qr_trap, custom_attestation_text, custom_certificate`.

---

## 2. Current content format

### 2.1 TypeScript types

`src/lib/content/types.ts` mirrors the original shape. The key parts:

```ts
export type Span = { text: string; spot?: string; reveal?: string; link?: { label: string; href: string } };
export type Rich = string | Span[] | Span[][];
export type Mood = "talk" | "think" | "alert" | "happy" | "celebrate";
export type Gesture = "wave" | "point-left" | "point-right" | "point-down" | "recite" | "lean-in" | "shield-up" | "shake" | "shrug" | "nod";

export type ArtifactBase = { kind: string; brandRef?: string; [key: string]: unknown };
export type Artifact = EmailArtifact | ChatArtifact | SmsArtifact | DialogArtifact | LoginArtifact | UrlArtifact
  | NotificationArtifact | PermissionArtifact | CallArtifact | FileArtifact | QrArtifact | WifiArtifact;
export type WifiArtifact = ArtifactBase & { kind: "wifi"; networks: { ssid: Rich; secured: boolean; signal: number }[] };

export type Visual =
  | { kind: "illustration"; id: string }
  | { kind: "artifact"; artifact: Artifact }
  | { kind: "stat"; value: string; label: string };

export type Beat = { id: string; say: string; mood: Mood; gesture?: Gesture; visual?: Visual; highlight?: string; checkpoint?: unknown; stage?: unknown };
export type Outcome = "safe" | "risky" | "compromised";
export type SimAction = { id: string; label: string; kind: string; outcome: Outcome; feedback: string; next?: string };
export type SimStep = { id: string; label?: string; say?: string; spoken?: string; artifact: Artifact; actions: SimAction[] };
export type ScenarioChoice = { label: string; next?: string; outcome?: Outcome; feedback: string };
export type ScenarioNode = { id: string; text: string; speaker?: string; voice?: string; channel?: string; character?: string; spoken?: string; choices?: ScenarioChoice[]; outcome?: Outcome };
```

The scene union (same file):

```ts
export type Scene =
  | { type: "tutor"; id: string; beats: Beat[] }
  | { type: "intro"; id: string; title: string; body: string; mood?: Mood; visual?: Visual }
  | { type: "simulation"; id: string; environment: "inbox" | "phone" | "browser" | "desktop" | "call"; title: string; intro: string; steps: SimStep[] }
  | { type: "choice"; id: string; question: { prompt: string; options: { id: string; label: string; correct: boolean; feedback: string }[] }; explain?: string;
      /** Several options are right (also implied by more than one `correct` option). */ multi?: boolean;
      /** Illustration or artifact shown beside the question. */ visual?: Visual }
  | { type: "hotspot"; id: string; prompt: string; artifact: Artifact; spots: { id: string; label: string; explain: string }[]; minToFind: number }
  | { type: "swipe"; id: string; prompt: string; cards: { id: string; artifact: Artifact; verdict: "threat" | "safe"; explain: string }[] }
  | { type: "match"; id: string; prompt: string; pairs: { id: string; left: string; right: string }[]; explain?: string }
  | { type: "order"; id: string; prompt: string; items: { id: string; label: string }[]; explain?: string }
  | { type: "scenario"; id: string; title: string; start: string; nodes: ScenarioNode[] }
  | { type: "password"; id: string; prompt: string; targetScore: number; tips: string[] }
  | { type: "recap"; id: string; points: string[]; mood?: Mood };
export type SceneType = Scene["type"];
export type LessonFile = { id: string; title: string; minutes: number; scenes: Scene[] };
export type Brand = { id: string; name: string; kind: string; color: string; glyph: string; monogram?: string; fake?: boolean; imitates?: string };
export type ModuleFile = { slug: string; category: string; audience: string[]; title: string; subtitle: string; minutes: number; lessonCount: number; xp: number; difficulty: "Easy" | "Medium" | "Hard"; lessons: { id: string; title: string; minutes: number }[] };
```

Helpers in the same file: `plain(rich)` flattens rich text to a string (paragraphs joined by `\n`);
`paragraphs(rich)` normalises to `Span[][]`. Note `Beat.checkpoint` and `Beat.stage` are typed `unknown`;
`TutorScene` casts `checkpoint` to `{ prompt, options[] }`. `ScenarioNode` has no `visual` field in the
type although 22 library nodes carry one (passes through validation, ignored by the renderer).

### 2.2 Files, naming, locales

`content/library/` (ADR-015: content lives in files and is synced into the database):

| File | Content |
|---|---|
| `modules.json` | 53 modules, array of `ModuleFile` (category labels `Email, Accounts, Social engineering, Devices, AI threats, Physical security, Data, Workplace, Incidents`; difficulty Easy 21 / Medium 29 / Hard 3) |
| `lessons/{module-slug}/{lesson-id}.{locale}.json` | one `LessonFile` per lesson; **106 files, all `.en.json`, no `.az.json` or `.ru.json` exist** |
| `i18n.az.json`, `i18n.ru.json` | `{ modules: { slug: [title, subtitle] }, lessons: { "slug/lesson-id": title } }`: 53 + 106 translated titles only |
| `brands.json` | the 169-brand registry keyed by id (56 fake, 51 with monogram, 48 distinct Lucide glyphs) |
| `paths.json` | learning paths (az/en/ru titles, standards, module slugs); covered by the training-pipeline reference |

The lesson file is the original's `lesson` object only (`id, title, minutes, scenes`); the page props
wrapper (`module, nextLesson, locale, userId, narration, timeLimitsEnabled, ...`) is assembled at
request time (section 3.1). All 106 files equal (deep comparison of `id/title/minutes/scenes`) the
`lesson` object of their `docs/audit/content/lessons/**` counterpart, whose files are the full page props
(checked 2026-10-20).

How content reaches the database (summary; the training-pipeline reference has the detail):
`src/server/services/library.ts` `syncLibrary(db)` reads `modules.json`, `i18n.az.json`, `i18n.ru.json`,
then for every lesson reads **only** `lessons/{slug}/{id}.en.json`, validates it, upserts `modules`
(by `slug`, global rows with `tenant_id` null), `lessons` (by `module_id + key`, titles
`{en, az, ru}` from the i18n files) and `lesson_contents` (primary key `lesson_id + locale`, `scenes` jsonb,
written with `locale: "en"`). It runs from `npm run content:sync` (`scripts/sync-content.ts`, under a
Postgres advisory lock), from `scripts/seed.ts` and on every server start (`src/server/bootstrap.ts`).
Studio-authored lessons exist only in the database.

### 2.3 Validation

`src/lib/content/validate.ts`: a zod `lessonFileSchema` (`id`, `title`, `minutes` positive int,
`scenes` min 1) with a `discriminatedUnion("type", ...)` per scene, and `lessonIntegrityErrors(lesson)`
for cross references. Rules the schema enforces:

- artifact `kind` ∈ `email, chat, sms, dialog, login, url, notification, permission, call, file, qr, wifi` (passthrough for the rest of the object);
- `visual` ∈ illustration `{id}` | artifact | stat `{value,label}`;
- `tutor.beats` min 1, each with `say` non-empty, `mood` string, optional `gesture`, `visual`, `highlight` (passthrough keeps `checkpoint`/`stage`);
- `simulation.environment` enum, `steps` min 1, each `actions` min 1 with `outcome` enum;
- `choice.question.options` min 2; `hotspot.spots` min 1 and `minToFind` int ≥ 1; `swipe.cards` min 1; `match.pairs` min 2; `order.items` min 2; `scenario.nodes` min 1; `password.targetScore` 0..4; `recap.points` min 1.

Integrity checks: scenario `start` must exist and every `choices[].next` must name a node; every
simulation `actions[].next` must name a step; a `choice` needs at least one `correct` option; `hotspot`
`minToFind` ≤ `spots.length`. The same two functions run in `syncLibrary` (an invalid file aborts the
import with `"{slug}/{id}: ..."`) and in `tests/content.test.ts`.

### 2.4 Illustrations and brands

- A beat/intro/choice `visual: { kind: "illustration", id }` resolves in
  `src/components/player/illustrations.tsx`: `ILLUSTRATIONS` maps the 29 ids to a Lucide `main` icon and an
  optional `badge` icon (e.g. `"mfa-phone": { main: Smartphone, badge: ShieldCheck }`), drawn by
  `<Illustration id>` on concentric brand-50/brand-100/surface circles with three reward/brand dots and a
  floating main icon; an unknown id falls back to `shield`. `<Stat value label>` renders the `stat` visual.
- A `brandRef` on any artifact resolves through `BrandsProvider` (`src/components/player/artifacts.tsx`),
  fed by the page with only the brands the lesson references (`brandsFor(scenes)` walks the scene tree for
  `brandRef` strings). `src/components/player/brand-avatar.tsx` `<BrandAvatar brand name size>` draws a
  coloured circle with the `monogram`, else the Lucide `glyph` from its `GLYPHS` map (all 48 glyphs used
  by `brands.json` are present), else the first letter; without a brand it shows initials on safe-100.

### 2.5 What differs from the original and why

| Topic | Original | Portal | Why / where decided |
|---|---|---|---|
| Narration | pre-generated clips, word timings in props | browser Web Speech API, timings from `onboundary` or estimated | ADR-007 (`docs/build/DECISIONS.md`): works without a key; a provider can replace `speak()` later |
| Lesson file | full page props with `narration` | `LessonFile` only; props assembled per request | ADR-015: content in files, DB sync |
| Locales | lesson text served in the profile language | EN scenes only; az/ru titles in `i18n.*.json`; page falls back to EN | AZ/RU texts were never extracted (OPEN-QUESTIONS #6) |
| `choice.multi`, `choice.visual` | not in the spec | optional extensions in the type and schema (0 library uses of either; 14 scenes have >1 correct option) | Studio and multi-answer support |
| `wifi` artifact | absent from the spec table, present in 4 lessons | 12th kind in the type, schema and renderer | data needed it |
| Illustrations | two-tone SVG scenes | Lucide compositions | spec: "must be redrawn"; placeholder |
| Difficulty | `1 \| 2 \| 3` | `"Easy" \| "Medium" \| "Hard"` on the module | module file format |

---

## 3. Player architecture

### 3.1 Component tree and props assembly

```
(focus)/learn/[slug]/[lessonId]/page.tsx   server: viewer, catalog, lesson_contents, settings
└─ <LessonPlayer>                           src/components/player/player.tsx  ("use client")
   ├─ <BrandsProvider brands>               artifacts.tsx context
   ├─ header: Leave (X) · progressbar · Ask · speed · sound · more
   ├─ phase "intro"   : <Mascot> + title + pills + Start/Continue/Start over/Review again + sound hint
   ├─ phase "playing" : one of TutorScene | IntroScene | SimulationScene | ChoiceScene | HotspotScene |
   │                    SwipeScene | MatchScene | OrderScene | ScenarioScene | PasswordScene | RecapScene   (scenes.tsx)
   │                    each gets { scene, env: SceneEnv } and uses <ArtifactView> (artifacts.tsx),
   │                    <RichText>/<ArtifactModeProvider> (rich.tsx), <Illustration>/<Stat>, <BrandAvatar>, <Mascot>
   ├─ phase "done"    : <DoneScreen> (XP pill, attestation card, certificate link, next lesson, back, home)
   ├─ <Dialog "Lesson options"> : <OptionsMotion> (Segmented full/calm/still) + <ProblemForm>
   └─ <TutorPanel>              : tutor-panel.tsx (section 4)
```

`page.tsx` builds `PlayerProps`:

```ts
const contents = await db().select({ scenes: t.lessonContents.scenes, locale: t.lessonContents.locale })
  .from(t.lessonContents).where(eq(t.lessonContents.lessonId, lesson.id));
// The viewer's language, then English, then whatever the lesson was written in (own studio lessons).
const fallback = contents.find((c) => c.locale === locale) ?? contents.find((c) => c.locale === "en") ?? contents[0];
const timed = settings.learning.timeLimits && m.difficulty !== "Easy" && v.user.timerPref !== "off";
const timeLimitSeconds = timed ? (v.user.timerPref === "more" ? 60 : 30) : null;
<LessonPlayer viewerId slug moduleTitle topic={CATEGORY_TOPIC[m.category]} lesson={{ key, title, minutes, scenes }}
  contentLocale={fallback.locale} completedBefore next brands={brandsFor(scenes)} timeLimitSeconds
  soundOn={v.user.soundOn} motion={v.user.motion} tutorEnabled={v.tenant.features.has("ai_tutor")}
  tutorVoice={v.tenant.features.has("tutor_voice")} attestationText={settings.attestationText[locale] ?? pick(DEFAULT_ATTESTATION, locale)} />
```

`PlayerProps` (player.tsx): `viewerId, slug, moduleTitle, topic, lesson{key,title,minutes,scenes},
contentLocale, completedBefore, next{key,title}|null, brands, timeLimitSeconds, soundOn,
motion: "full"|"calm"|"still", tutorEnabled, tutorVoice?, attestationText`. `topic` is the mascot's Rive
`topic` input, from `CATEGORY_TOPIC` in `src/lib/domain/catalog.ts` (`email, identity, social, devices,
ai-threats, physical, data, work, incident`).

### 3.2 State: phase, scene index, answers, resume

In `LessonPlayer`: `phase: "intro" | "playing" | "done"`, `index` (scene), `inner` (0–1 progress inside
the scene, reported by `TutorScene`), `resumeInner`, `soundOn`, `speed` (external store), `motion`,
`optionsOpen`, `tutorOpen`, `saving`, `result: LessonResult | null`, refs `answers: PlayerAnswer[]` and
`started` (timestamp). Progress bar value: `(index + min(inner, 0.95)) / scenes.length`.

`SceneEnv` handed to every scene (scenes.tsx):

```ts
export type PlayerAnswer = { sceneId: string; itemId?: string; correct: boolean; firstTry: boolean; outcome?: Outcome };
export type SceneEnv = {
  narrator: Narrator; soundOn: boolean; still: boolean; topic?: string;
  /** Seconds for timed questions, or null. */ timer: number | null;
  onAnswer: (a: PlayerAnswer) => void; onDone: () => void;
  /** Lets the tutor scene drive the shared progress bar (0–1 inside the scene). */ onProgress?: (fraction: number) => void;
  /** When a saved lesson is resumed: the progress last reported inside this scene. */ resumeProgress?: number;
};
```

`onAnswer` de-duplicates on `(sceneId, itemId)` so replaying a scene after `Previous` records nothing twice.
`onDone` = `nextScene()` (stops narration, resets `inner`, advances, saves position).

Resume (`src/components/player/resume.ts`): the position and the final result are kept in the tab's
`sessionStorage` under `lessonStateKey(userId, slug, lessonKey)` = `cy:lesson:v1:{userId}:{slug}:{lessonKey}`.

```ts
export type SavedLesson =
  | { kind: "playing"; index: number; inner: number; answers: PlayerAnswer[]; elapsedMs: number }
  | { kind: "done"; result: LessonResult; token: string | null };
export function serializeLesson(state: SavedLesson, sceneIds: string[]): string  // adds { v: 1, scenes: sceneIds }
export function parseLesson(raw: string | null, sceneIds: string[], answerIds: ReadonlySet<string>): SavedLesson | null
export function answerIdsOf(scenes: Scene[]): Set<string>      // scene ids + "tutorSceneId:beatId" for every tutor beat
export function tutorAnswerId(sceneId: string, beatId: string): string  // `${sceneId}:${beatId}`
```

`parseLesson` rejects another version, a different scene list, out-of-range `index`, `inner` outside
`[0,1)` and an unknown `moduleStatus`; it drops (without rejecting the state) malformed answers, answers
with an unknown `outcome` and answers whose id is not in `answerIds`; it caps answers at 400 and elapsed
time at 4 h.
The player reads it through `useSyncExternalStore` with a `null` server snapshot so SSR and hydration agree
on a fresh intro; the intro then offers `Continue` (`player.continue`, with `Part {current} of {total}`)
and `Start over`. A finished lesson sets `?done=1` with `history.replaceState` and saves
`{ kind: "done", result, token }`, so reloading that history entry shows the result (XP, attestation card,
certificate link) again, while opening the lesson afresh shows the intro.

### 3.3 Scene renderers

All in `src/components/player/scenes.tsx`. Shared pieces: `Karaoke` (word-by-word
highlight, `variant="title" | "body"`), `VisualView` (illustration / stat / artifact with `highlight`),
`FeedbackCard` and `FeedbackSheet` (role `alertdialog`, tone `safe | warn | risk`, mascot, spoken
explanation as body karaoke, `Continue` with an auto-advance line that fills with the spoken words and
fires 700 ms after the explanation ends when sound is on), `useCountdown` + `TimerPill`, `ChoiceOptions`
(numbered pills, radio or checkbox group), `LensButton`, `SpeakerCard`, `shuffle(arr, seed)`
(deterministic, seeded by the scene id so SSR and client agree).

**`TutorScene`** (`tutor`): state `i` (beat; starts from `round(resumeProgress * beats.length)` on resume),
`word`, `ended`, `asking`, `picked`, `checked`. Each beat is narrated on entry
(`env.narrator.speak(beat.say, { onWord, onEnd })`) and `env.onProgress(i / beats.length)` is reported.
Layout: visual (left, `VisualView` with `beat.highlight`), mascot (`mood` from `MOODS[beat.mood]` while
speaking, `idle` otherwise; `gesture` from the beat; `aim` angle computed with `aimTowards()` to the DOM
element carrying `data-spot={highlight}`, so the mascot points at the highlighted span), step dots,
karaoke title text. Controls: `‹` (previous beat, or `onBack` to the previous tutor scene when `i === 0`),
`↻` replay, `⏸/▶` (sound on only), `Next` or `Answer the question` when the beat has a `checkpoint`. With
sound on and `ended`, the beat advances by itself after 700 ms (to its question when it has one, else the
next beat, else `onDone`). Checkpoint flow: `asking` shows the prompt (spoken) and `ChoiceOptions`; `Check`
records `{ sceneId: tutorAnswerId(scene.id, beat.id), correct, firstTry: true }` and opens a
`FeedbackSheet` (`wellDone` / `notQuite`, the option's feedback); `Continue` advances.

**`IntroScene`** (`intro`): speaks `"{title}. {body}"`, shows `VisualView(scene.visual)`, headline, lead and
`Start`. `scene.mood` is not used.

**`SimulationScene`** (`simulation`): `started`, `stepId` (`null` for the inbox list; first step otherwise),
`done: Set<stepId>`, `result {outcome, feedback, next}`, `lensIdx`. The intro card speaks `scene.intro`
with karaoke; `Start` (`simulation.begin`) starts. On each step the tip line (`step.spoken ?? step.say`) is narrated: in the
`call` environment with the artifact's `voice` (default `man`) when `spoken` exists, otherwise the tutor
voice with karaoke into the tip card; afterwards every `chat` message with `voice` is spoken in its own
voice (`m.spoken ?? plain(m.body)`). Environments: `inbox` renders a full mail client (`Mail` header,
`Search mail`, avatar `Y`, folders from `player.simulation.*`, `EmailListItem` rows, reading pane with
`Select an email`, action bar below the mail); `browser`/`desktop` render the artifact inside a tab-titled
window (desktop on a brand gradient); `phone`/`call` stack the label and artifact. An action whose
`kind` is `click-link` (when the artifact has a link) or `open-attachment` (email with attachments) is
removed from the buttons and wired to the link / attachment chip through `ArtifactModeProvider`
`onLink` / `onAttachment`. `choose(action)` records
`{ sceneId, itemId: step.id, correct: outcome === "safe", firstTry: true, outcome }`, vibrates when not safe,
and shows feedback (`goodMove` / `risky` / `compromised`; a modal card inside the mail client, a
`FeedbackSheet` elsewhere; the mail client's frame gets a tone ring). `proceed()` follows `result.next`,
else the following step unless it is already handled (non-inbox) or back to the list (inbox, until every
`email` step is handled), then `onDone`. The Lens: `lensTargets(step.artifact)` collects spans with `reveal` or `link.href`;
`LensButton` steps through them (`lens`, `lensNext`, `lensClose` labels) while `SpanView` draws the
magnifier and the `Actually` tooltip and the mascot peers through its glass (`guide={{ peer: true }}`).
Action icons: `report → Flag, delete → Trash2, reply/forward → Send, hang-up → Phone, click-link → Globe,
archive → Archive`; `report` uses the `danger-soft` button variant.

**`ChoiceScene`** (`choice`): `multi = scene.multi || correct options > 1`; the prompt is spoken (with
`multiHint` appended for multi). Optional `scene.visual` on the left. `Check` (disabled until a pick)
records `{ sceneId, correct, firstTry: true }`; correct for multi means the picked set equals the correct
set. Feedback sheet: `wellDone` / `notQuite` / `timeUp`; spoken text = feedback of the picked options when
right, of the missed and extra ones when wrong (plus `scene.explain`); `correctAnswer`, `multiMissed`,
`multiExtra` lines. This is the only scene that uses `env.timer` (section 3.6).

**`HotspotScene`** (`hotspot`): the artifact is rendered in hotspot mode
(`ArtifactModeProvider { hotspot: { found, onSpot, validSpots } }`): every span with a `spot` becomes a
button; a valid new spot is added to `found`, its `explain` shown in a risk card and spoken (except for the
final find, whose feedback sheet speaks instead); any other click on the artifact counts a `miss`. When `found.size >= min(minToFind, spots.length)` the answer
`{ correct: miss === 0 }` is recorded and a `FeedbackSheet` (`hotspot.done`, no auto-advance) lists every
spot with its explanation. Progress dots show `hotspot.found` ("{found} of {need}").

**`SwipeScene`** (`swipe`): one card at a time; pointer drag (`setPointerCapture`) translates and rotates
the card, a badge shows `swipe.threat` / `swipe.safe`; release beyond ±90 px decides (left = threat,
right = safe); two buttons do the same. Records `{ itemId: card.id, correct: v === card.verdict }`;
feedback text `"{itsThreat|itsSafe}. {card.explain}"`; `swipe.left` shows cards remaining.

**`MatchScene`** (`match`): left column in file order, right column shuffled by `shuffle(pairs, scene.id)`;
pick a left, then a right; a wrong right pulses risk for 600 ms and counts a mistake. Complete records
`{ correct: mistakes === 0 }`; sheet tone `safe` or `warn`, text `scene.explain`.

**`OrderScene`** (`order`): items shuffled (and rotated once if the shuffle happened to be the right order);
`ArrowUp`/`ArrowDown` buttons swap neighbours; `Check` compares with `scene.items`; only the first check
records the answer; wrong rows turn warn and `order.wrong` shows; the sheet tone is `safe` on the first
attempt, `warn` later.

**`ScenarioScene`** (`scenario`): `history` of visited nodes with the chosen label; the current node is
spoken with `current.spoken ?? current.text` in `current.voice` (default `man`). Stage by `channel`:
`phone` → `CallView` with `status = scenario.onLine` and speaking bars; `message` → a `chat` artifact built
from the history; `in-person` / `video` → `SpeakerCard` (avatar ring + `SpeakingBars`); no channel → no
stage. The name is `speaker` or the capitalised `character`. A choice records
`{ itemId: current.id, correct: outcome === "safe", outcome }`, shows a `FeedbackSheet`
(`goodMove` / `risky` / `compromised`), then `proceed()` follows `next` or ends with `scenario.ended` +
`Continue`. Node `visual` is not rendered.

**`PasswordScene`** (`password`): a plain-text input (`autoComplete="off"`, `password.notStored` hint),
`checkPassword(value).score` (zxcvbn 0–4 from `src/lib/password-strength.ts`), a five-segment meter with
`password.levels` labels, the `tips` list; reaching `targetScore` the first time records
`{ correct: true }` and opens a `safe` sheet (`password.reached`).

**`RecapScene`** (`recap`): speaks `points.join(". ")`, celebrating mascot (`fire: bounce`), the points as
check rows with staggered `animate-rise`, and `Finish` (`recap.finish` / `recap.saving`) which calls the
player's `finish()`. `scene.mood` is not read.

### 3.4 Narration hook API and karaoke

`src/components/player/narrator.ts` (ADR-007). The hook and its `speak()` contract, which a pre-generated
TTS provider must honour:

```ts
export type Voice = "tutor" | "man" | "man-2" | "man-3" | "woman" | "woman-2" | "young-woman" | "young-man" | "young-man-2" | "older-man" | "older-woman" | "child";
export function speechText(text: string): string   // strips <breath>, <short pause> ... tags
export function wordsOf(text: string): string[]     // the karaoke word list (split on whitespace)

export function useNarrator({ enabled, rate, lang = "en" }: { enabled: boolean; rate: number; lang?: string }) {
  /** Speaks text. onWord(i) fires as each word starts; onEnd when finished.
   *  With sound off nothing is spoken and onEnd is not called (the learner continues manually). */
  const speak = (text: string, opts: { voice?: Voice; lang?: string; onWord?: (i: number) => void; onEnd?: () => void; onError?: (error: string) => void } = {}) => { ... };
  return { speak, stop, pause, resume, speaking, paused, supported };
}
```

Behaviour: `speak` first calls `stop()` (bumps a token so stale callbacks are ignored, clears timers,
resumes a paused engine before `cancel()`), computes the character offset of every word, picks a
`SpeechSynthesisVoice` for `opts.lang ?? lang` and the requested `Voice` (`pickVoice`: voices of that
language if any are installed, else all; ranks names matching natural/neural/online/premium/enhanced and
non-local voices first, then gender regexes `FEMALE`/`MALE`; `tutor` is female with
pitch 1.05; `child` 1.45, `young-*` 1.12, `older-*` 0.82 and rate × 0.92), sets `u.lang` from the voice
or `LANG_TAG` (`az-AZ`, `en-US`, `ru-RU`), `u.rate = clamp(rate × rateMul, 0.5, 2)`. `onboundary`
(word events) maps `charIndex` to the word index and calls `onWord(i)`; if no boundary arrives within
600 ms of `onstart`, timers estimate one word every `60_000 / (165 × u.rate)` ms. `onend` → `onWord(words.length)`
then `onEnd`; an engine error (not `interrupted`/`canceled`) shows the whole text and calls `onError` but
not `onEnd`. When `enabled` is false or the API is missing, `onWord(words.length)` fires at once and
`onEnd` never does, so every scene keeps its manual `Next`.

Karaoke (`Karaoke` in scenes.tsx): title variant marks `i < word` as `text-ink`, `i === word` as
`bg-brand-100 text-ink`, later words `text-ink-subtle` (the original's colours); body variant bolds read
words. Artifact highlight: `ArtifactModeProvider { highlight: beat.highlight }` makes `SpanView` (rich.tsx)
add `bg-risk-100 text-risk-700 ring-2` to the span whose `spot` matches. The player creates one narrator:
`useNarrator({ enabled: soundOn, rate: speed, lang: p.contentLocale })`; the tutor panel speaks answers
with `{ lang: locale }` (the UI language).

### 3.5 Speed, sound, motion, haptics

- Speed: `SPEEDS = [1, 1.25, 1.5, 0.75]`, cycled by the `{speed}×` button, stored in `localStorage`
  `cy:speed` and read through `useSyncExternalStore` with a server snapshot of `1`.
- Sound: `soundOn` state seeded from `v.user.soundOn`; toggling stops narration and persists with
  `setPreferencesAction({ soundOn })` (`src/server/actions/preferences.ts`). The intro shows
  `player.soundHint` ("Turn the sound on to hear AI Sel") as a button when sound is off.
- Motion: the options dialog's `Segmented` (`learner.profile.motionFull/Calm/Still`) sets state,
  `document.documentElement.dataset.motion = m` and `setPreferencesAction({ motion })`; scenes receive
  `env.still` and pass it to every `<Mascot still>`.
- Haptics: `vibrate()` from `src/lib/haptics.ts` on wrong answers and non-safe outcomes; per-device
  preference in `localStorage` `cy-haptics`.
- Report a problem: `ProblemForm` posts `reportProblemAction` with `context = lesson:{slug}/{key}#{sceneId}`
  (rate limit `problem:{userId}` 10/h; row in `problem_reports`; event `issue.reported`).

### 3.6 Timers

Decided server-side in `page.tsx`: `timed = settings.learning.timeLimits && m.difficulty !== "Easy" &&
v.user.timerPref !== "off"`; `timeLimitSeconds = timerPref === "more" ? 60 : 30`, else `null`. The tenant
default is `learning: { timeLimits: true, ... }` (`defaultSettings()` in `src/lib/tenant-defaults.ts`);
the learner's `timerPref` is `standard | more | off` (Profile copy: 30 s / 60 s / none). In the player only
`ChoiceScene` consumes `env.timer`: `useCountdown(seconds, active = !checked, onExpire)` ticks every
second; `TimerPill` turns risk-coloured at ≤ 5 s; expiry calls `check(true)` which records a wrong
answer and shows `timeUp`. Tutor checkpoints, hotspot, swipe, match, order, scenario and password scenes
are untimed. There is no `time_limits` feature flag in `PLAN_FEATURES`; the switch is the tenant setting.

### 3.7 Keyboard and touch accessibility

- `ChoiceOptions`: `role="radiogroup"` (or `group` with `role="checkbox"` buttons for multi),
  `aria-checked`, roving `tabIndex`, arrow keys move focus (and pick, single answer) wrapping at both ends.
- Feedback: `role="alertdialog"` with `aria-labelledby`, focus moved to `Continue` on mount.
- Progress bar: `role="progressbar"` with `aria-valuenow`; step dots `aria-label="Part i of n"`;
  simulation step label announced through an `sr-only` `aria-live="polite"` node; karaoke paragraphs are
  `aria-live="polite"`; scenario speaking state through `role="status"`.
- Every icon button has an `aria-label` from `player.*` (`leave, askLabel, speed, soundOff/soundOn, more,
  previous, replay, pause, play, lens*`, `order.up/down`).
- Swipe cards use pointer events with `touch-pan-y` and `setPointerCapture`; the two buttons are the
  keyboard path. Bottom action rows are `sticky bottom-0` with `--safe-bottom` padding.

### 3.8 i18n key groups

`messages/{az,en,ru}/player.json` (125 leaf keys each, arrays counted once; parity enforced by `tests/i18n.test.ts`). Top-level
keys: `leave, ask, askLabel, speed, soundOff, soundOn, more, options, motion, reportProblem, start,
review, startOver, completed, soundHint, previous, replay, pause, play, next, answer, check, continue,
skip, progress, step, wellDone, goodMove, notQuite, risky, compromised, correctAnswer, multiHint,
multiMissed, multiExtra, timeLeft, timeUp, lens, lensNext, lensActually, lensClose`. Groups:
`hotspot {found, tap, missed, done}`, `swipe {threat, safe, left, question, itsThreat, itsSafe}`,
`match {pick, matched}`, `order {hint, up, down, wrong}`, `password {label, placeholder, strength,
levels[], reached, notStored}`, `scenario {you, onLine, speaking, inPerson, videoCall, ended}`,
`simulation {handled, handledEmails, begin, mailbox, inbox, sent, drafts, spam, archive, trash,
searchMail, selectEmail, to, toMe, attachments, incoming, mobile, outcomes}`, `recap {title, finish,
saving}`, `done {title, xp, noXp, nextLesson, backToModule, confirm, certificate, home}`, `tutor {title,
placeholder, send, listen, listening, thinking, suggestions[], privacy, offline, error}`, `artifact {from,
subject, open, signIn, allow, deny, decline, accept, networks, secured, open_network, scanToOpen,
permissionsTitle, voiceMessage, fileFrom}`. The player also reads `common.units.min`,
`learner.profile.motion*`, `learner.attest.{title, checkbox, submit, done, error}` and
`learner.problem.{title, description, message, submit, sent}`. The tutor's name "AI Sel" lives in these
strings (`askLabel`, `soundHint`).

### 3.9 Completion, XP, streak, risk, attestation, certificate

Server actions in `src/server/actions/learning.ts`, services in `src/server/services/progress.ts`:

- `startLessonAction(slug, lessonKey)` on `Start`/`Continue` → `touchModule()` upserts `module_progress`
  (`status: "in_progress"`, `lastLessonKey`) so Home's "Continue" card knows the lesson.
- `completeLessonAction({ slug, lessonKey, seconds ≤ 4 h, answers ≤ 400 })` on `Finish`: inserts every
  `PlayerAnswer` into `answers` (`scene_id, item_id, correct, first_try, outcome, category`), emits
  `simulation.risky` when any answer has a non-safe `outcome`, calls `completeLesson()`, then
  `recomputeRisk()` and returns `LessonResult = { ok, xp, moduleStatus?: "in_progress" |
  "awaiting_attestation" | "completed", nextKey? }`.
- `completeLesson()` upserts `lesson_progress` (`completed_at` kept from the first time,
  `last_completed_at` latest, `attempts + 1`, `seconds_spent`), awards XP only on the first completion:
  `lessonXp(module.xp, lessonCount, position)` from `src/lib/domain/gamification.ts` (module XP split
  evenly, remainder to the last lesson; e.g. 300 XP / 3 lessons = 100 each). `awardXp()` writes
  `xp_events` (`reason: "lesson"`) and updates `users.xp` plus the streak through `nextStreak()` (one missed
  day survives while a freeze is in hand; every 7 consecutive days earn a freeze, at most 2). Module
  status becomes `awaiting_attestation` at 100 % unless already `completed`; a replayed completed module
  closes open `behavior_risks` rows that predate the replay.
- `recomputeRisk()` (`src/server/services/risk.ts`) counts risky/compromised answers of the last 90 days
  and the first-try rate of the last 180 days among its evidence and stores `users.riskScore`.
- Attestation: `DoneScreen` shows the card when `result.moduleStatus === "awaiting_attestation"`:
  `p.attestationText`, a checkbox labelled `I confirm` (`learner.attest.checkbox`) and the `Confirm and finish`
  button (`learner.attest.submit`) → `attestModuleAction(slug)`
  → `attestModule()` (only from `awaiting_attestation`): inserts `attestations` (text and locale stored
  verbatim), sets `module_progress` to `completed`, issues a module certificate (`issueCertificate()`,
  serial `SLUG-2026-000042`, `publicToken`), closes the module's open risks; the action also emits
  `attestation.completed`, issues path certificates when every module of a path is done, recomputes risk and
  returns `{ ok, token }`. The done screen then links `/c/{token}` (`src/app/(public)/c/[token]`) and saves
  the token in the resume state. Default text: `DEFAULT_ATTESTATION` (az/en/ru) in
  `src/lib/tenant-defaults.ts`, overridable per tenant in `settings.attestationText[locale]`.
- Done screen (`player.done.*`): mascot `celebrate`, `+{xp} XP` or `noXp` (a replay), the attestation card,
  `Certificate`, `Next lesson: {title}` (hidden while attestation is pending), `Back to module`, `Home`.
  The report bonus (`REPORT_BONUS_XP = 5`, daily cap 5) is awarded elsewhere (threat intake), not here.

### 3.10 Teachable moment

Not part of the lesson player. `src/components/site/teachable.tsx` `<TeachableMoment>` is the page a
learner lands on after clicking a simulated phishing link (`src/app/(public)/t/[token]`) or scanning a QR
trap (`src/app/(public)/q/[token]`); campaign templates carry the module slug the learner is sent to
afterwards (`moduleSlug` in `src/lib/campaigns/templates.ts`). `qr_trap` is listed in `PLAN_FEATURES`
(professional plan) but no code path checks it, and there is no `teachable_moment` entry at all even though
the original listed both as flags.

---

## 4. AI Sel tutor

Text and voice paths share one panel and one route.

- **UI**: `src/components/player/tutor-panel.tsx` `<TutorPanel open onClose slug lessonKey sceneId speak voice>`,
  opened by the header `Ask` button (shown only when `tutorEnabled` and `phase === "playing"`; mic icon
  when `tutorVoice !== false`, otherwise a question icon). Mascot `curious` → `think` (talking) → `happy`;
  suggestion chips from `player.tutor.suggestions` (array, read with `t.raw`); an input (max 500 chars);
  a mic button when `voice` and `SpeechRecognition`/`webkitSpeechRecognition` exist (sets
  `r.lang = LANG_TAG[locale]`, `interimResults = false`, the transcript becomes the question and is sent);
  a privacy line (`player.tutor.privacy`). The answer streams into the bubble (`fetch` + `ReadableStream`
  reader) and, when `voice`, is read aloud through `speak(full)` = `narrator.speak(text, { lang: locale })`.
  Opening the panel stops lesson narration. `x-tutor-mode: offline` shows `player.tutor.offline`.
- **Route**: `POST /api/tutor` (`src/app/api/tutor/route.ts`), body
  `{ slug, lessonKey, sceneId?, question, locale }` validated by `tutorRequestSchema`
  (`src/server/tutor.ts`: `slug`/`lessonKey` kebab-case ≤ 100, `sceneId` ≤ 100 without control characters
  (nullable), `question` trimmed 2–500 chars without control characters, `locale` ∈ az/en/ru), body capped at `TUTOR_BODY_LIMIT = 8 KiB` (`readBodyCapped`, 413 beyond).
  Checks: same-origin `Origin` vs `Host` (403), signed-in viewer (401), tenant feature `ai_tutor` (404),
  `rateLimit("tutor:{userId}", 20, 10 min)` (429). The module is the tenant's copy or the global one;
  drafts only for `studio.write`. Lesson scenes come from `lesson_contents` preferring `en`.
- **Cache**: `tutor_cache` row id = `sha256Hex("{locale}|{lessonId}|{sceneId}|{normalised question}")`
  (lower-cased, whitespace collapsed, trailing `?!.` removed); a hit returns the stored answer with
  `x-tutor-mode: cache`. Answers are stored after streaming (`onConflictDoNothing`), with `model`. An
  audit event name `tutor.cache_removed` is declared in `src/server/services/audit.ts`, but no code path
  emits it yet (verify before documenting a cache-clearing UI).
- **Model**: `@anthropic-ai/sdk` `client.messages.stream({ model: env.ANTHROPIC_MODEL, max_tokens: 2000,
  system: tutorSystemPrompt(locale), messages: [{ role: "user", content: "Lesson context:\n{context}\n\nThe learner asks: {question}" }] })`,
  streamed as `text/plain` with `x-tutor-mode: ai`. Env (`src/server/env.ts`): `ANTHROPIC_API_KEY`
  (optional) and `ANTHROPIC_MODEL` (default `claude-opus-5-5`; OPEN-QUESTIONS #1 suggests
  `claude-haiku-5-5` for cost). No TTS variables exist; `VOICE_PROVIDER` is for voice-call campaigns, not
  narration. ADR-008: only lesson context and the question go to the model, never learner data.
- **Context** `lessonContext(moduleTitle, lessonTitle, scenes, sceneId)`: the current scene first, then the
  rest; beats as `- say`, questions with `[correct]/[wrong]` options and feedback, hotspot spots, swipe
  verdicts, simulation actions `label → outcome: feedback`, scenario choices, match pairs, the correct
  order, recap points, intro; capped at 9 000 characters. `tutorSystemPrompt(locale)`: friendly security
  tutor, answer in `TUTOR_LANGUAGE[locale]` (Azerbaijani/English/Russian) in at most four plain sentences,
  grounded in the context, never ask for passwords/codes/personal data, off-topic questions are declined,
  no markdown.
- **Offline fallback** `offlineAnswer(scenes, sceneId, question)`: without `ANTHROPIC_API_KEY` (or when the
  stream fails before any text) the route answers from the lesson itself: a pool of explanations
  (choice `explain` and correct feedback, hotspot `label: explain`, safe simulation feedback, recap points,
  beat text), scored by overlapping words of 4+ letters (Unicode-aware for az/ru), the two best
  explanations sentence by sentence without repeating a sentence. The header is `x-tutor-mode: offline`
  only in the no-key case; when the stream fails mid-way the response already carries `ai`.
- **Tests** `tests/tutor.test.ts`: `tutorRequestSchema` accepts library and studio ids and multi-line
  questions, rejects NUL/control characters and non-kebab ids; `readBodyCapped` respects the limit for
  multi-byte chunks, over-sized `Content-Length` and chunked bodies; `offlineAnswer` never repeats a
  sentence, ranks the relevant explanation first for az/ru questions, and answers every scene of every
  library lesson without repetition.

---

## 5. Conventions and gotchas

- **Never edit `docs/audit/`** (ADR-016): it is the record of the original. Content fixes go to
  `content/library/`; the 106 files there are currently identical (in `id/title/minutes/scenes`) to the
  `lesson` object of the audit copies.
- **Hydration safety**: `LessonPlayer`, scenes, mascot and tutor panel render on the server first. Browser
  state (speed, saved position) is read through `useSyncExternalStore` with server snapshots (`1`, `null`);
  shuffles are seeded by the scene id; no `Date.now()`/`Math.random()` in render paths (`started` is a ref
  set in `begin()`); nothing is rendered from the narrator's `supported` or the panel's `canListen` on the
  server path except the mic button, which only appears inside the opened dialog.
- **Azerbaijani formatting** (ADR-017): Chromium has no `az` ICU data. Client code never calls
  `Intl.DateTimeFormat("az")`, `useFormatter` or `toLocale*`; use `useClientFormat()` from
  `src/lib/client-format.ts` (backed by `src/lib/az-format.ts`, checked against Node ICU in
  `tests/az-format.test.ts`) and `<RelativeTime>`. The player currently formats no dates; keep it that way
  or go through these helpers (the certificate and progress pages do).
- **Messages JSON**: edit `messages/{az,en,ru}/*.json` with the Edit tool (shell heredocs corrupt Unicode
  and backslashes); keys contain no dots; ICU braces are escaped with quotes; every key exists in all three
  locales with the same placeholders (`tests/i18n.test.ts`). `player.tutor.suggestions` and
  `player.password.levels` are arrays read with `t.raw()`.
- **Content tests after any content change**: `npx vitest run tests/content.test.ts` (53 modules, 106
  files, every lesson passes `lessonFileSchema` + `lessonIntegrityErrors`, exactly 14 multi-answer choice
  scenes including `app-consent-phishing/consent-screen#ac1-choice`, az/ru titles for every module and
  lesson). Changing the number of modules, lessons or multi-answer scenes means updating these assertions.
- **`syncLibrary` reads only `.en.json`** and writes `lesson_contents.locale = "en"`. A file with another
  suffix is ignored until `library.ts` is extended (recipe 6.3).
- **Narration is keyed by the text**: `Karaoke` splits `wordsOf(text)` and the narrator maps word
  boundaries by character offsets; TTS tags like `<breath>` are stripped by `speechText()`/`cleanSpeech()`.
  Keep `say` plain prose; put stage tags only in `spoken`.
- **Answers are recorded once** per `(sceneId, itemId)`; tutor checkpoints use `tutorAnswerId()`
  (`scene:beat`). `firstTry` is always `true` in the current scenes; the server's first-try rate relies on it.
- **Feature flags** actually consulted by the learner side: `ai_tutor`, `tutor_voice` (player), plus
  `league`, `lab`, `paths`, `sandbox`, `live_sessions` elsewhere. `time_limits` and `teachable_moment` from
  the original are not flags here; timers are `settings.learning.timeLimits` (section 3.6).
- **Brands**: only referenced brands reach the browser (`brandsFor`). A new `brandRef` must exist in
  `content/library/brands.json` or the avatar falls back to initials; a new `glyph` must be added to
  `GLYPHS` in `brand-avatar.tsx` or the first letter shows.
- **`Previous` is limited**: `onBack` to the previous scene is offered only from a tutor scene whose
  predecessor is also a tutor scene; other scenes have no back button (answers would otherwise repeat).

---

## 6. Recipes

### 6.1 Add a new lesson

1. Write `content/library/lessons/{module-slug}/{lesson-id}.en.json` as a `LessonFile`
   (`{ id, title, minutes, scenes[] }`, `id` = file name, kebab-case). Follow the typical sequence
   `tutor → simulation → hotspot|swipe|match|order → choice → recap`; every `tutor` beat needs
   `id, say, mood` and usually `visual` + `gesture`; reference `brandRef` ids from `brands.json`; use
   `spot` ids consistently between `highlight`, hotspot `spots[].id` and spans; put `reveal`/`link.href`
   on the details the Lens should expose. Copy structure from `phishing-email/spot-the-phish.en.json`.
2. Add the lesson to the module's `lessons[]` in `content/library/modules.json` (`{ id, title, minutes }`),
   and bump `lessonCount` and `minutes` of the module (a new module also needs `slug, category` (one of
   the labels in `CATEGORY_FROM_LABEL`), `audience`, `title`, `subtitle`, `xp`, `difficulty`).
3. Add az and ru titles: `i18n.az.json` / `i18n.ru.json` → `lessons["{module-slug}/{lesson-id}"]` (and
   `modules[slug] = [title, subtitle]` for a new module). The content test fails without them.
4. Validate: `npx vitest run tests/content.test.ts`; update the `toHaveLength(106)` / `53` / `14`
   assertions as needed. The file is also validated at sync time.
5. Sync: `npm run content:sync` (stop `next dev` first on PGlite; it upserts by slug/key and keeps
   progress). The seed and server start-up run the same import. Do not run it while the shared dev
   servers are up in this session; tell the user it is needed.
6. Check in the browser at `/learn/{module-slug}/{lesson-id}` with sound on and off; compare against the
   screenshots in `docs/audit/screens/` when the lesson copies an original pattern. New screenshots of
   the lesson belong next to the task's own notes, never in `docs/audit`.
7. If the tutor should answer about it offline, nothing else is needed (`offlineAnswer` reads the scenes);
   `tests/tutor.test.ts` iterates every library lesson, so run it too.

### 6.2 Add a new scene type

1. `src/lib/content/types.ts`: add the variant to the `Scene` union (and any new artifact/visual types).
2. `src/lib/content/validate.ts`: add a `z.object({ type: z.literal("…"), id, … })` to the
   `discriminatedUnion`, and cross-reference checks to `lessonIntegrityErrors()`.
3. `src/components/player/scenes.tsx`: export `XxxScene({ scene, env })` following the pattern: narrate the
   prompt in a mount effect, call `env.onAnswer({ sceneId, itemId?, correct, firstTry: true, outcome? })`
   once per item, show a `FeedbackSheet` and call `env.narrator.stop(); env.onDone()` on `Continue`;
   respect `env.still` on mascots and `env.soundOn` on karaoke.
4. `src/components/player/player.tsx`: add the `{scene.type === "…" ? <XxxScene … /> : null}` line.
5. `src/server/tutor.ts`: add a `case` in `lessonContext()` (and in `offlineAnswer()` if the scene holds
   explanations) so AI Sel can see it.
6. `src/components/player/resume.ts`: extend `answerIdsOf()` only if the scene records answers under ids
   other than its own `sceneId`.
7. i18n: new strings in `messages/{az,en,ru}/player.json` under a new group.
8. Tests: a fixture lesson in `tests/content.test.ts` or a dedicated test with `lessonFileSchema`;
   `tests/player-resume.test.ts` if ids changed; run `tests/i18n.test.ts`.
9. Studio (if authors should create it) is covered by the training-pipeline reference.

### 6.3 Translate a lesson to az/ru

The texts do not exist yet (OPEN-QUESTIONS #6: extracting them from the live tenant needs the owner's
permission; otherwise translate from the EN files).

1. Create `content/library/lessons/{module}/{lesson}.az.json` (and `.ru.json`) with the **same** `id`,
   scene `id`s, beat `id`s, `spot` ids, option/step/node ids and structure; translate only `say`, `spoken`,
   `text`, labels, prompts, feedback, titles. Keep `brandRef`s and `href`s.
2. Extend `syncLibrary()` in `src/server/services/library.ts`: for each lesson, for each locale in
   `["en", "az", "ru"]`, read the file when it exists, validate it, and upsert `lesson_contents` with that
   `locale` (the table's primary key is already `lesson_id + locale`). `page.tsx` already picks the
   viewer's locale first, then `en`; the narrator receives `contentLocale` so the voice follows the file.
3. Add a test in `tests/content.test.ts` that every `.az.json`/`.ru.json` validates and has the same scene
   ids as its `.en.json` (resume state and answer ids depend on identical ids).
4. The tutor route reads `en` scenes for context on purpose (`rows.find((r) => r.locale === "en")`);
   leave it, or switch to the request locale if the model should quote the translated text.
5. Voices: `pickVoice()` filters installed voices by `lang.startsWith("az")`; Chromium ships no
   Azerbaijani voice on most systems, so expect the best-ranked installed voice of any language, with
   `u.lang` set to that voice's own tag (`LANG_TAG["az"]` = `az-AZ` is used only when no voice is loaded at
   all), until a TTS provider exists (6.6).

### 6.4 Add an illustration

1. Pick a new id (kebab-case) and add it to `ILLUSTRATIONS` in `src/components/player/illustrations.tsx`
   as `{ main: LucideIcon, badge?: LucideIcon }` (import the icons from `lucide-react`); or, to replace
   the placeholder style with real two-tone SVG scenes as the spec asks, change `<Illustration>` to render an
   inline SVG per id while keeping the `aria-hidden` wrapper and `animate-float`.
2. Reference it from content as `"visual": { "kind": "illustration", "id": "…" }`. The schema accepts
   any string id; an unknown id silently renders `shield`, so grep the library for typos.
3. Illustrations must respect `still`/reduced motion through the `animate-float` token (the animations
   reference covers the motion tokens).

### 6.5 Add a brand or an artifact kind

Brand: add `{ id, name, kind, color, glyph, monogram?, fake?, imitates? }` to `content/library/brands.json`
(fictional names only, as in the original; a fake twin keeps the name and shifts the colour); if `glyph` is a
Lucide icon not yet in `GLYPHS` (`brand-avatar.tsx`), import and add it. No sync is needed; the page reads
the file at request time (cached in `brandCache` for the process).

Artifact kind: add the type to `Artifact` in `types.ts`, the literal to the `artifact` enum in `validate.ts`,
a `XxxView` plus a `case` in `ArtifactView` in `artifacts.tsx` (use `RichText` for text so `spot`,
`highlight`, hotspot and Lens modes work; `useBrand(a.brandRef)` + `BrandAvatar` for the brand), labels
in `player.artifact.*` (three locales), and, if the simulation should open something inside it, honour
`onLink`/`onAttachment` from `useArtifactMode()`.

### 6.6 Switch narration to pre-generated TTS

ADR-007 planned this; OPEN-QUESTIONS #2 asks which provider (ElevenLabs or Azure Speech) and which
Azerbaijani voice. Everything in the UI goes through `useNarrator().speak()`, so:

1. Build step: a script (e.g. `scripts/generate-tts.ts`) that walks every lesson file (all locales), collects
   every `say`, `spoken`, `intro`, prompt, feedback, explain, recap point and chat/scenario line the scenes
   speak (mirror the `speak()` call sites in scenes.tsx and the feedback texts composed there), hashes the
   cleaned text + locale + voice, calls the provider with word timestamps, writes
   `public/generated/tts/{locale}/{hash}.m4a` and a manifest in the original format:
   `Record<text, { url, durationMs, words: { w, startMs, endMs }[] }>` (section 1.6). Store the manifest
   per lesson (e.g. next to the scenes in `lesson_contents` or as `content/library/narration/{locale}/{lesson}.json`)
   and expose `narrationClipCount`/`narrationTotalMs` like the original props.
2. Serve it: `page.tsx` loads the lesson's manifest and passes `narration` to `LessonPlayer`.
3. Provider: in `narrator.ts` keep the same return shape `{ speak, stop, pause, resume, speaking, paused,
   supported }` and the same `speak(text, { voice, lang, onWord, onEnd, onError })` semantics. When
   `narration[speechText(text)]` exists, play the clip with an `HTMLAudioElement` at `playbackRate = rate`,
   drive `onWord(i)` from `words[i].startMs / rate` with `timeupdate` or timers, call `onEnd` on `ended`,
   fall back to Web Speech otherwise. `pause`/`resume` map to the audio element; `stop()` must still bump
   the token so stale callbacks are ignored.
4. Keep the sound-off contract (`onWord(words.length)` immediately, no `onEnd`), the 700 ms auto-advance in
   `TutorScene` and `FeedbackCard`, and the `Voice` names (map them to provider voice ids per locale).
5. Tests: a unit test for the word-index mapping from timings, and a content test that every spoken text
   of every lesson has a manifest entry (missing clips are the regression the original avoided by keying on
   the text). Keep `tests/content.test.ts` and `tests/tutor.test.ts` green (both iterate every library
   lesson) and `tests/player-resume.test.ts` if the saved state gains a field.

### 6.7 Tune timers

- Seconds: `page.tsx` (`60` for `more`, `30` otherwise) and the Profile copy
  `learner.profile.timerStandardBody` / `timerMoreBody` in three locales.
- Which modules: the `m.difficulty !== "Easy"` test in `page.tsx`; the tenant switch is
  `settings.learning.timeLimits` (admin Settings → Learning); the learner switch is `users.timer_pref`.
- Which scenes: only `ChoiceScene` calls `useCountdown(env.timer, …)`. To time tutor checkpoints, swipe or
  hotspot, add the same hook and `TimerPill` and decide what expiry records (`correct: false`).
- Per-question limits are not in the content format; adding `timeLimit?: number` to the `choice` scene
  would need `types.ts`, `validate.ts` and a `scene.timeLimit ?? env.timer` in `ChoiceScene`.

### 6.8 Add a tutor capability

- New context (e.g. the learner's wrong answers of this lesson): extend the request schema in
  `src/server/tutor.ts`, pass the data from `TutorPanel` (`tutor-panel.tsx` builds the body), fold it into
  `lessonContext()` without PII (ADR-008), and include it in the cache id only if it changes the answer.
- New behaviour (e.g. a "Why is it fake?" quick action): add the string to `player.tutor.suggestions`
  in three locales; the chips call `ask(s)` directly.
- Tool use or longer answers: change `max_tokens`/`system` in the route; keep the plain-text streaming
  contract and `x-tutor-mode` header the panel relies on, or update the panel's reader.
- Voice output quality: `TutorPanel` speaks through the same narrator (`{ lang: locale }`), so the TTS
  provider from 6.6 applies automatically once `speak()` handles texts without a manifest entry (the
  tutor's answers are dynamic, so they stay on the fallback path unless the provider is called live).
- Rate limit and cache knobs: `rateLimit("tutor:{userId}", 20, 10 * 60_000)` in the route; cache rows in
  `tutor_cache` (a cache-clearing admin action would emit the declared `tutor.cache_removed` audit event).

---

## 7. Gaps vs the original

1. **Pre-generated TTS**: no `/generated/tts/**` clips, no manifest, no `narrationClipCount`/
   `narrationTotalMs`; narration is the browser's speech engine, so voice quality and Azerbaijani support
   depend on the device, and karaoke timing is estimated when the engine sends no word boundaries
   (ADR-007, OPEN-QUESTIONS #2). Recipe 6.6.
2. **AZ/RU lesson text**: only `.en.json` files; az/ru learners get English scenes narrated by an English
   voice (`contentLocale` is `"en"`, and the narrator's `lang` follows it); only the tutor panel's answers are
   spoken with the UI locale. Titles are translated.
   `syncLibrary` cannot import other locales yet (OPEN-QUESTIONS #6, recipe 6.3).
3. **Illustrations**: the 29 ids render as Lucide icon compositions, not the original two-tone scenes
   the spec says must be redrawn.
4. **Scenario staging**: node `visual` (22 nodes: 11 illustrations and 11 artifacts, six of them call
   screens) is ignored; the stage is derived from `channel` only; `character` only supplies a display name. The spec's
   13 characters have no avatars or voices of their own beyond the `voice` id mapping.
5. **Beat extras**: `stage` (one beat, value `"back"`) is ignored; `intro.mood` and `recap.mood` are not
   read; `gesture` values map onto the Rive gestures but `point-right`-style aiming is driven by the
   highlight angle instead.
6. **Timers**: the original timed "some questions" when `timeLimitsEnabled && difficulty >= 2`; the
   portal times every `choice` scene in Medium/Hard modules and nothing else; no `time_limits` flag.
7. **Simulation details**: the mailbox is close to the screenshots (folders, search, avatar `Y`, Lens,
   `Report phishing | Delete`), but the browser/desktop/phone/call environments are stylised frames
   rather than the original's full mock apps (verify against `lesson-06..10` and the SCRIPTS book when
   polishing). `order` uses up/down buttons; whether the original dragged is not recorded (verify).
8. **Hotspot scoring**: `correct` is "no wrong tap"; the original's rule for misses is not documented.
9. **Feature flags**: `time_limits`, `teachable_moment`, `custom_attestation_text`, `custom_certificate`
   from the original `/api/me.features` do not exist as flags; attestation text is a plain tenant setting.
10. **Report bonus and league** are outside the player (training-pipeline reference); the `Ask` voice
    path depends on the browser exposing `SpeechRecognition`/`webkitSpeechRecognition` (`canListen` in
    `tutor-panel.tsx`); without it the mic button is hidden and typing is the only path.
11. **Present and matching**: options dialog (`Motion` + `Report a problem`), `Review again`, `Completed`
    pill, sound hint, speed cycle, `Leave lesson`, checkpoint beats, `stat` visuals, Lens, swipe, match,
    order, password, recap, attestation, certificate link and resume after reload. The `wifi` artifact and
    `choice.multi`/`choice.visual` are extensions beyond the spec.
