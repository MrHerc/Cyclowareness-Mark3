# Lesson engine: content format, player, narration, AI Sel, attestation

Reference for everything a learner meets between `Start` and `I confirm` in
`/learn/[slug]/[lessonId]`. Spec of the original: `docs/audit/06-lesson-engine.md` (data format,
scene types, beats, artifacts, brands, mascot), `docs/audit/02-learner-app.md` sections 4 and 9
(player UI, gamification), `docs/audit/00-overview.md` (TTS, flags). Code: `portal/src/components/player/`,
`portal/src/lib/content/`, `portal/src/app/(focus)/learn/[slug]/[lessonId]/page.tsx`,
`portal/src/app/api/tutor/route.ts`, `portal/src/server/tutor.ts`, `portal/src/server/services/progress.ts`;
narration and subtitles (since 2026-10-27): `portal/src/lib/tts/`, `portal/scripts/generate-narration.ts`,
`portal/src/server/narration.ts`, `portal/src/server/subtitles.ts`, `portal/src/app/api/subtitles/route.ts`.
Decisions: ADR-023 (lesson files per language), ADR-025/026 (ten languages, translation process),
ADR-028 (ElevenLabs clips), ADR-029 (AI subtitles), ADR-030 (player structure) in `docs/build/DECISIONS.md`.
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
   - 3.11 [Captions, AI subtitles and transcript](#311-captions-ai-subtitles-and-transcript)
4. [AI Sel tutor](#4-ai-sel-tutor)
5. [Conventions and gotchas](#5-conventions-and-gotchas)
6. [Recipes](#6-recipes)
   - 6.1 [Add a new lesson](#61-add-a-new-lesson)
   - 6.2 [Add a new scene type](#62-add-a-new-scene-type)
   - 6.3 [Translate a lesson, or add a lesson language](#63-translate-a-lesson-or-add-a-lesson-language)
   - 6.4 [Add an illustration](#64-add-an-illustration)
   - 6.5 [Add a brand or an artifact kind](#65-add-a-brand-or-an-artifact-kind)
   - 6.6 [Generate the natural narration (pre-generated TTS)](#66-generate-the-natural-narration-pre-generated-tts)
   - 6.7 [Tune timers](#67-tune-timers)
   - 6.8 [Add a tutor capability](#68-add-a-tutor-capability)
   - 6.9 [Triage: the tutor answers or reads in the wrong language](#69-triage-the-tutor-answers-or-reads-in-the-wrong-language)
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
| `lessons/{module-slug}/{lesson-id}.en.json` | the original: one `LessonFile` per lesson, 106 files |
| `lessons/{module-slug}/{lesson-id}.{locale}.json`, locale ∈ `az ru tr ro ka uk de fr ar` | translations of the English file next to them, 106 of each language (az/ru since 2026-10-26, the seven others since 2026-11-04; all 954 pass `--coverage`) |
| `i18n.{locale}.json` (the same nine) | `{ modules: { slug: [title, subtitle] }, lessons: { "slug/lesson-id": title } }`: the 53 + 106 translated titles the catalog shows |
| `brands.json` | the 169-brand registry keyed by id (56 fake, 51 with monogram, 48 distinct Lucide glyphs) |
| `paths.json` | learning paths (titles in the ten languages, standards, module slugs, `labs`); covered by the training-pipeline reference |

Outside `content/library/`: `content/narration/{locale}/{module}__{lesson}.json` holds the narration
manifests and `public/generated/tts/{locale}/{sha256}.mp3` the clips (recipe 6.6; none generated yet).

The lesson file is the original's `lesson` object only (`id, title, minutes, scenes`); the page props
wrapper (`module, nextLesson, locale, userId, narration, timeLimitsEnabled, ...`) is assembled at
request time (section 3.1). All 106 `.en.json` files equal (deep comparison of `id/title/minutes/scenes`)
the `lesson` object of their `docs/audit/content/lessons/**` counterpart, whose files are the full page
props (checked 2026-10-20; the English files have not changed since).

A translation is the English file with only the learner-facing text changed: the same keys, ids,
`spot`s, `brandRef`s, links, answers, branches and array lengths (rules in section 5, code in
`src/lib/content/locale-parity.ts`, checker `scripts/check-lesson-locales.ts`). Scene, beat, item and
spot ids are therefore the same in every language, so recorded answers (`answers.scene_id/item_id`),
the saved position (`resume.ts` compares scene id lists) and highlights do not depend on the language:
a learner who switches language mid-lesson keeps the position. The translation's `title` equals the
lesson's entry in `i18n.{locale}.json` (true for the 212 az/ru files; not checked by a test for the
others), but only `scenes` is stored; the catalog and player show the title from the i18n file.

How content reaches the database (summary; the training-pipeline reference has the detail):
`src/server/services/library.ts` `syncLibrary(db)` reads `modules.json` and `i18n.{locale}.json` for every
locale of `LESSON_TRANSLATIONS` (= `LOCALES` without `en`, so a new UI language is picked up here by
itself) (`readLibrary()`), then calls `readLibraryLesson(slug, id)` for every lesson: it reads `{id}.en.json`
(required) and each `{id}.{locale}.json` of `LESSON_TRANSLATIONS` that exists, and passes
each through `checkedLesson()` (`lessonFileSchema`, `lessonIntegrityErrors` and, for a translation,
`localeParityErrors(english, raw)`). A failing file aborts the import with `"{slug}/{id}: …"` (English)
or `"{slug}/{id}.{locale}: …"` (a translation; the first 10 parity errors). It upserts `modules` (by
`slug`, global rows with `tenant_id` null), `lessons` (by `module_id + key`, titles in all ten languages
from the i18n files, English where one is missing) and one `lesson_contents` row per language present
(primary key `lesson_id + locale`, columns `scenes` jsonb and `updated_at`); the row of a translation
whose file was removed is deleted (the files are the source). It returns `{ modules, lessons, locales }`
with a count per language, logged as `texts: az 106, en 106, ru 106, …, ar 106`. It runs from `npm run content:sync` (`scripts/sync-content.ts`, under a
Postgres advisory lock; stop `next dev` first on PGlite), from `scripts/seed.ts` and on every production
server start (`src/instrumentation.ts` → `bootstrap()` in `src/server/bootstrap.ts`); `next dev` does not
import. Studio-authored lessons exist only in the database, with one row in the language the author chose.

Which row a reader gets: `pickLessonContent(contents, locale)` (`src/lib/content/lesson-locale.ts`)
returns the row in `locale`, else `en`, else the first row (a studio or AI-trainer lesson written in one
language).
The lesson page passes `getLocale()` (`src/i18n/request.ts`: for a signed-in learner the profile
language, else the `locale` cookie, each only when the tenant has that language switched on, else the
tenant's default) and hands
the row's language to the player as `contentLocale`; the tutor route passes the request `locale`
(section 4). The AI trainer's library path (`libraryTrainingAction` in `src/server/actions/ai-training.ts`)
copies library lessons into one draft with `sharedContentLocale(localesPerLesson, wanted)`: the chosen
language when every picked lesson has it, otherwise `en`, never a mix; the draft is saved with that
`contentLocale` and the trainer says so (`secops.aiTrainer.contentLanguage`). Lesson and module titles
and the subtitle are taken from, and stored in, the same language (so English scenes never sit under
az/ru titles); only the source label (`source.title`) uses the chosen language. The AI path writes the
draft in the requested language. `saveTrainingDraftAction` stores one `lesson_contents` row per lesson
in `contentLocale` (training-pipeline.md §3.3). `scripts/seed.ts` reads
the `en` rows only (the ids it needs are the same in every language).

When the row's language is not the UI language (the English fallback, or a studio lesson), the player
marks the lesson text with it: `contentLang = p.contentLocale !== locale ? p.contentLocale : undefined`
goes into `ContentLangProvider` (`src/components/player/rich.tsx`), and `useContentLang()` puts
`lang={contentLang}` on karaoke lines, headings, options, stats and artifacts in `scenes.tsx` and
`artifacts.tsx`, so screen readers pronounce it in its own language; the interface strings around it
keep the page's `lang`.

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
import with `"{slug}/{id}: ..."`, a translation with `"{slug}/{id}.{locale}: ..."`), in
`tests/content.test.ts` (English files) and, together with `localeParityErrors`, in
`tests/content-locales.test.ts` and `scripts/check-lesson-locales.ts` (translations; section 5).

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
| Narration | pre-generated clips, word timings in props | the same idea: ElevenLabs clips per spoken text with word timings (`scripts/generate-narration.ts`, manifests read by the server, handed to the player as `clips`); every text without a clip is read by the browser's Web Speech API (timings from `onboundary` or estimated). No clip is generated yet (no key or voices) | ADR-007, ADR-028 (`docs/build/DECISIONS.md`); recipe 6.6 |
| Lesson file | full page props with `narration` | `LessonFile` only; props assembled per request | ADR-015: content in files, DB sync |
| Locales | lesson text served in the profile language (`locale` prop) | `.en.json` plus one file per other UI language (az ru tr ro ka uk de fr ar), one `lesson_contents` row each; `pickLessonContent` serves the viewer's language, then EN | the audit holds only the EN files and the original's own AZ/RU texts were never extracted, so every translation was made from EN in this rebuild and its wording is not the original's; ADR-023, ADR-026 (OPEN-QUESTIONS #6 and #7) |
| Voice language | one clip set per locale (`/generated/tts/{locale}/…`) | the lesson's clip in its language when one exists, else a browser voice of the text's language, else silence with `<VoiceNotice>` (section 3.4) | Web Speech has no Azerbaijani voice in Chrome on most systems, and `narrator.ts` never reads a text with a voice of another language; ADR-023, ADR-028 |
| Subtitles, transcript, syllabus | not recorded in the audit | captions in the narration's language, in another stored language or AI-translated (65 more languages), a transcript drawer, a syllabus aside/drawer, shortcuts (section 3.11) | owner request 2026-10-27; ADR-029, ADR-030 |
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
   ├─ <BrandsProvider brands> + <CaptionsProvider>   artifacts.tsx, captions.tsx contexts
   ├─ header: Leave (X) · syllabus (below lg) · progressbar · Ask · narration group
   │          [play/pause · sound (volume slider from xl) · SpeedSelect (md+) · captions · transcript (sm+) · fullscreen (lg+)] · more
   ├─ <SyllabusAside>  (lg+, open or a rail; syllabus.tsx)   the module's lessons + the current lesson's parts
   ├─ phase "intro"   : <Mascot> + title + pills + Start/Continue/Start over/Review again + sound hint
   ├─ phase "playing" : one of TutorScene | IntroScene | SimulationScene | ChoiceScene | HotspotScene |
   │                    SwipeScene | MatchScene | OrderScene | ScenarioScene | PasswordScene | RecapScene   (scenes.tsx)
   │                    each gets { scene, env: SceneEnv } and uses <ArtifactView> (artifacts.tsx),
   │                    <RichText>/<ArtifactModeProvider> (rich.tsx), <Illustration>/<Stat>, <BrandAvatar>, <Mascot>
   │                    + <CaptionBar> (scene slot or the page's sticky bar, section 3.11)
   ├─ phase "done"    : <DoneScreen> (XP pill with <Burst> and a fly-up chip in Full motion, attestation card, certificate link, next lesson, back, home)
   ├─ <Dialog "Lesson options"> : volume, speed, captions switch + <SubtitleSelect>, transcript and shortcuts buttons,
   │                              letter-shortcuts switch, <OptionsMotion> (Segmented full/calm/still), <ProblemSection>
   ├─ <Drawer start> syllabus (below lg) · <Drawer end> <Transcript> · <Dialog> <ShortcutList>   (drawer.tsx, media-controls.tsx)
   └─ <TutorPanel>              : tutor-panel.tsx (section 4)
```

`page.tsx` builds `PlayerProps`:

```ts
const contents = await db().select({ scenes: t.lessonContents.scenes, locale: t.lessonContents.locale })
  .from(t.lessonContents).where(eq(t.lessonContents.lessonId, lesson.id));
// The viewer's language, then English, then whatever the lesson was written in (own studio lessons).
const fallback = pickLessonContent(contents, locale);   // src/lib/content/lesson-locale.ts; notFound() when none
const timed = settings.learning.timeLimits && m.difficulty !== "Easy" && v.user.timerPref !== "off";
const timeLimitSeconds = timed ? (v.user.timerPref === "more" ? 60 : 30) : null;
// Studio modules have no generated clips, even one that reuses a library slug.
const clips = m.origin === "library" ? loadNarrationClips(`${m.slug}/${lesson.key}`, fallback.locale) : null;  // src/server/narration.ts
<LessonPlayer viewerId slug moduleTitle topic={CATEGORY_TOPIC[m.category]} lesson={{ id, key, title, minutes, scenes }}
  syllabus={m.lessons.map((l) => ({ key, title, minutes, completed }))} contentLocale={fallback.locale}
  captionLocales={LOCALES.filter((l) => l !== fallback.locale && contents.some((c) => c.locale === l))}
  moreLanguages={v.tenant.features.has("ai_tutor") ? subtitleLanguageOptions(locale) : []}   // named on the server
  loadCaptions={loadCaptionsAction} clips={clips}
  completedBefore next brands={brandsFor(scenes)} timeLimitSeconds
  soundOn={v.user.soundOn} motion={v.user.motion} tutorEnabled={v.tenant.features.has("ai_tutor")}
  tutorVoice={v.tenant.features.has("tutor_voice")} attestationText={settings.attestationText[locale] ?? pick(DEFAULT_ATTESTATION, locale)} />
```

`PlayerProps` (player.tsx): `viewerId, slug, moduleTitle, topic, lesson{id,key,title,minutes,scenes},
syllabus: SyllabusLesson[], contentLocale, captionLocales, moreLanguages: SubtitleLanguageOption[],
loadCaptions, clips?: NarrationClips | null, completedBefore, next{key,title}|null, brands,
timeLimitSeconds, soundOn, motion: "full"|"calm"|"still", tutorEnabled, tutorVoice?, attestationText`.
`loadCaptionsAction` lives next to the page (`[lessonId]/actions.ts`, with `caption-map.ts`). `topic` is the mascot's Rive
`topic` input, from `CATEGORY_TOPIC` in `src/lib/domain/catalog.ts` (`email, identity, social, devices,
ai-threats, physical, data, work, incident`).

### 3.2 State: phase, scene index, answers, resume

In `LessonPlayer`: `phase: "intro" | "playing" | "done"`, `index` (scene), `maxIndex` (the furthest scene
reached: the syllabus reopens any part up to it and the "next" shortcut steps forward only up to it,
never past it), `inner` (0–1 progress
inside the scene, reported by `TutorScene`), `resumeInner`, `soundOn`, `motion`, `optionsOpen`,
`tutorOpen`, `syllabusDrawer`, `transcriptOpen`, `shortcutsOpen`, `saving`, `result: LessonResult | null`,
the per-browser prefs `speed`, `volume`, `captionsOn`, caption language, `syllabusOpen` and
`letterShortcuts` (external stores in `controls.ts`, section 3.5), refs `answers: PlayerAnswer[]` and
`started` (timestamp). Progress bar value: `(index + min(inner, 0.95)) / scenes.length`.
`maxIndex` is client state only: `completeLessonAction` does not check on the server which scenes were
seen (ADR-030, OPEN-QUESTIONS 25).

`SceneEnv` handed to every scene (scenes.tsx):

```ts
export type PlayerAnswer = { sceneId: string; itemId?: string; correct: boolean; firstTry: boolean; outcome?: Outcome };
export type SceneEnv = {
  narrator: Narrator;
  /** The interface language: interface strings that are read aloud use its voice, not the lesson's. */ uiLocale: string;
  soundOn: boolean; still: boolean; topic?: string;
  /** Seconds for timed questions, or null. */ timer: number | null;
  onAnswer: (a: PlayerAnswer) => void; onDone: () => void;
  /** Lets the tutor scene drive the shared progress bar (0–1 inside the scene). */ onProgress?: (fraction: number) => void;
  /** When a saved lesson is resumed: the progress last reported inside this scene. */ resumeProgress?: number;
};
```

`onAnswer` de-duplicates on `(sceneId, itemId)` so replaying a scene after `Previous` records nothing twice.
`env.soundOn` is the player's `soundOn && !voiceMissing` and `env.uiLocale` its `useLocale()` (section 3.4).
`onDone` = `nextScene()` (stops narration, resets `inner`, advances, saves position).

Resume (`src/components/player/resume.ts`): the position and the final result are kept in the tab's
`sessionStorage` under `lessonStateKey(userId, slug, lessonKey)` = `cy:lesson:v1:{userId}:{slug}:{lessonKey}`.

```ts
export type SavedLesson =
  | { kind: "playing"; index: number; maxIndex: number; inner: number; answers: PlayerAnswer[]; elapsedMs: number }
  | { kind: "done"; result: LessonResult; token: string | null };
export function serializeLesson(state: SavedLesson, sceneIds: string[]): string  // adds { v: 1, scenes: sceneIds }
export function parseLesson(raw: string | null, sceneIds: string[], answerIds: ReadonlySet<string>): SavedLesson | null
export function answerIdsOf(scenes: Scene[]): Set<string>      // scene ids + "tutorSceneId:beatId" for every tutor beat
export function tutorAnswerId(sceneId: string, beatId: string): string  // `${sceneId}:${beatId}`
```

`parseLesson` reads a state saved before `maxIndex` existed with `maxIndex = index`, and rejects a
`maxIndex` below `index` or out of range. It also rejects another version, a different scene list, out-of-range `index`, `inner` outside
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
Layout: visual (left, `VisualView` with `beat.highlight`), mascot (`mood` is
`MOODS[beat.mood] ?? "talk"` while speaking, otherwise `idle`, except that a `celebrate` beat stays
`celebrate`, also through silent beats with sound off or no voice; `gesture` from the beat; `aim` angle
computed with `aimTowards()` to the DOM element carrying `data-spot={highlight}`, so the mascot points
at the highlighted span), step dots, karaoke title text. Controls: `‹` (previous beat, or `onBack` to the previous tutor scene when `i === 0`),
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
`multiHint` after it for multi, in the UI language's voice; section 3.4). Optional `scene.visual` on the left. `Check` (disabled until a pick)
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
the sheet speaks `card.explain` and shows `swipe.itsThreat` / `itsSafe` as an unspoken line under it
(no interface text inside a lesson sentence); `swipe.left` shows cards remaining.

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
stage. The name is `speaker`, else `player.scenario.unknownSpeaker` (interface language); `character` is
an English id and is never shown. `SpeakerCard` gets the lesson's `lang` (`nameLang`) only when the name
comes from `speaker`; the same `name` is the chat `contact` and the call `caller`. A choice records
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

`src/components/player/narrator.ts` (ADR-007, ADR-028). The hook and its `speak()` contract:

```ts
export type Voice = "tutor" | "man" | "man-2" | "man-3" | "woman" | "woman-2" | "young-woman" | "young-man" | "young-man-2" | "older-man" | "older-woman" | "child";
// Re-exported from src/lib/tts/text.ts, shared with the clip generator and the manifests:
export function speechText(text: string): string   // strips <breath>, <short pause> ... tags, collapses spaces
export function wordsOf(text: string): string[]     // the karaoke word list (split on whitespace, every script)

export type VoiceAvailability = "unknown" | "available" | "missing";
export function voiceAvailability(voices: readonly { lang: string }[], lang: string): VoiceAvailability
export function useVoiceAvailability(lang: string): VoiceAvailability   // useSyncExternalStore on "voiceschanged"; server snapshot "unknown"

export function useNarrator({ enabled, rate, lang = "en", clips, volume = 1 }:
  { enabled: boolean; rate: number; lang?: string; clips?: NarrationClips | null; volume?: number }) {
  /** Speaks text. onWord(i) fires as each word starts; onEnd when finished.
   *  With sound off nothing is spoken and onEnd is not called (the learner continues manually).
   *  Without a voice for the language nothing is spoken either: the whole text shows, onEnd is not
   *  called and onError("language-unavailable") is, as after an engine failure.
   *  A text with a clip plays it (in the clip's voice, whatever `voice` asks); a clip that cannot be
   *  loaded falls back to the engine, and a browser that refuses to play gives onError("not-allowed"). */
  const speak = (text: string, opts: { voice?: Voice; lang?: string; onWord?: (i: number) => void; onEnd?: () => void; onError?: (error: string) => void } = {}) => { ... };
  /** voice: "available" when the lesson has clips, else useVoiceAvailability(lang) for the hook's own language. */
  return { speak, stop, pause, resume, speaking, paused, supported, voice };
}
```

Clips (when `clips` has `speechText(text)` and the text is in the hook's language): one shared
`HTMLAudioElement` plays `clip.url` at `playbackRate = rate` and `volume`, a speed or volume change
applies to the playing clip at once (an utterance keeps the values it started with), and `onWord(i)`
follows the playback position frame by frame (`wordAt(clip.words, currentTime)`); `ended` gives
`onWord(words.length)` then `onEnd`; `pause`/`resume` map to the element; `stop()` detaches the clip.
Everything below is the Web Speech path that every text without a clip takes.

Behaviour: `speak` first calls `stop()` (bumps a token so stale callbacks are ignored, clears timers and
a pending voice wait, resumes a paused engine before `cancel()`) and computes the character offset of
every word. When the engine has listed no voices yet (Chrome fills the list shortly after the first
request) it waits for `voiceschanged`, at most `VOICE_WAIT_MS = 1500`. Then, for `opts.lang ?? lang`:
if `voiceAvailability(voices, lang)` is `"missing"` it calls `onWord(words.length)` and
`onError("language-unavailable")` and speaks nothing; otherwise it picks a `SpeechSynthesisVoice` for
the requested `Voice` (`pickVoice`: **only voices of that language**, compared by base tag with
`sameLanguage()` so `az`, `az-AZ` and Android's `az_AZ` match; ranks names matching
natural/neural/online/premium/enhanced and non-local voices first, then gender regexes `FEMALE`/`MALE`;
`tutor` is female with pitch 1.05; `child` 1.45, `young-*` 1.12, `older-*` 0.82 and rate × 0.92), sets
`u.lang` from the voice, or from `LANG_TAG` (`az-AZ`, `en-US`, `ru-RU`, `tr-TR`, `ro-RO`, `ka-GE`,
`uk-UA`, `de-DE`, `fr-FR`, `ar-SA`) when the list stayed empty and
the engine chooses, `u.rate = clamp(rate × rateMul, 0.5, 2)`. `onboundary`
(word events) maps `charIndex` to the word index and calls `onWord(i)`; if no boundary arrives within
600 ms of `onstart`, timers estimate one word every `60_000 / (165 × u.rate)` ms. `onend` → `onWord(words.length)`
then `onEnd`; an engine error (not `interrupted`/`canceled`) shows the whole text and calls `onError` but
not `onEnd`. When `enabled` is false or the API is missing, `onWord(words.length)` fires at once and
`onEnd` never does, so every scene keeps its manual `Next`.

**Voice language rule.** A text is read only by a voice of its own language; there is no fallback to
another language's voice. `voiceAvailability` is `"unknown"` while the list is empty (and on the server),
`"missing"` when no installed voice has the language (Azerbaijani in Chrome on Windows, for example),
`"available"` otherwise; `tests/narrator-voice.test.ts` pins it with Chrome-on-Windows, Edge and
Android voice lists. Where it applies:

- Player: `voiceMissing = soundOn && narrator.voice === "missing"` for `p.contentLocale`, and scenes get
  `env.soundOn = soundOn && !voiceMissing`, so a lesson without a voice behaves as with sound off for
  lesson text (every word in ink, manual `Next`, no pause button, no auto-advance). The narrator itself
  is created with the raw `enabled: soundOn`, so an interface string that a scene speaks with its own
  `lang` (`FeedbackCard uiText`: the hotspot sheet's `hotspot.done`) is still read, and the sheet's
  mascot talks, when the UI language has a voice, while its karaoke shows every word in ink. The
  `multiHint` follow-up is not read, because it waits for the prompt's `onEnd`, which never fires.
  Candidate fix: `useNarrator({ enabled: soundOn && !voiceMissing, … })`, or skip `uiText` speech when
  `!env.soundOn`. `<VoiceNotice lang={p.contentLocale}>` replaces the intro's `soundHint` line and sits
  above the scene while playing.
- Interface strings read aloud inside a lesson use the UI language's voice (`env.uiLocale`), lesson text
  the narrator's default (`p.contentLocale`). `ChoiceScene` reads `player.multiHint` in one utterance
  with the prompt when the two languages match, otherwise as a second utterance with
  `{ lang: env.uiLocale }` after the prompt's `onEnd`. `FeedbackCard`/`FeedbackSheet` take `uiText` for a
  `text` from the messages (the hotspot sheet's `hotspot.done`): spoken with `lang: env.uiLocale`,
  karaoke without the lesson's `lang`. `voiceMissing` is checked for the lesson's language only; a UI
  string without a voice simply gets `onError` (whole text, no auto-advance).
- `VoiceNotice` (`src/components/player/voice-notice.tsx`): one `role="status"` line with an `Info` icon,
  `player.voiceMissing` ("This browser has no {language} voice, so the text is not read aloud. Microsoft
  Edge has natural {language} voices.") with `{language}` = `player.voiceLanguage.{locale}` (ten entries;
  a language outside `LOCALES` falls back to the `en` entry). A lesson with clips never shows it.
- Tutor panel: an AI answer (`x-tutor-mode` `ai` or `cache`) is in the UI language, an offline answer
  quotes the lesson and is in its language (the `contentLocale` prop, default the UI language). The
  panel keeps that as `answerLang`, calls `speak(full, answerLang)`, marks the answer `lang={answerLang}`
  when it differs from the UI, checks `useVoiceAvailability(answerLang)` itself and shows
  `<VoiceNotice lang={answerLang}>` under a finished answer (`voice && soundOn && voiceMissing && answer
  && state === "idle"`). The home mascot (`src/components/learner/home-mascot.tsx`) owns
  `useNarrator({ lang: locale })` and lends it like the player,
  `speak={(text, lang) => narrator.speak(text, { lang })}`, with `contentLocale={tutor.contentLocale}`:
  Home (`src/app/(learner)/app/page.tsx`) reads the next lesson's `lesson_contents` locales and passes
  `pickLessonContent(rows, locale)?.locale`, the row the tutor route will pick. So on Home too an
  offline answer from a single-language studio or AI-trainer lesson is read by a voice of its own
  language, marked with its `lang`, and `VoiceNotice` checks that language (recipe 6.9).
- Landing guide (`src/components/site/guide.tsx`): passes `onError` and moves on after the reading time,
  so captions continue without a voice for the visitor's language.

Karaoke (`Karaoke` in scenes.tsx): title variant marks `i < word` as `text-ink`, `i === word` as
`bg-brand-100 text-ink`, later words `text-ink-subtle` (the original's colours); body variant bolds read
words. Artifact highlight: `ArtifactModeProvider { highlight: beat.highlight }` makes `SpanView` (rich.tsx)
add `bg-risk-100 text-risk-700 ring-2` to the span whose `spot` matches. The player creates one narrator,
`useNarrator({ enabled: soundOn, rate: speed, lang: p.contentLocale, clips: p.clips, volume })`, and lends
it to the tutor panel as `speak={(text, lang) => narrator.speak(text, { lang })}`. Every line a scene
reads also goes to the captions' line store (section 3.11), so captions and the transcript follow it.

### 3.5 Speed, sound, motion, haptics

- Per-browser preferences (`src/components/player/controls.ts`, `localPref` + `usePref`: `localStorage`
  read through `useSyncExternalStore` with the default as the server snapshot, an in-memory value when
  storage is blocked; `tests/player-controls.test.ts`): `speedPref` `cy:speed` (`SPEEDS = [0.75, 1, 1.25,
  1.5, 1.75, 2]`, the `SpeedSelect` in the header from md and in the options dialog), `volumePref`
  `cy:volume` (0–1, `VolumeControl`: a slider in the header from xl and in the dialog), `captionsPref`
  `cy:captions`, `captionLangPref` `cy:caption-lang` (`""` = the narration's own language),
  `syllabusPref` `cy:syllabus` (aside open or a rail), `letterShortcutsPref` `cy:shortcuts`.
- Sound: `soundOn` state seeded from `v.user.soundOn` (a server preference, unlike volume); toggling stops
  narration and persists with `setPreferencesAction({ soundOn })` (`src/server/actions/preferences.ts`).
  The intro shows `player.soundHint` ("Turn the sound on to hear AI Sel") as a button when sound is off.
- Fullscreen: `FullscreenToggle` (header, lg+), `player.fullscreen` / `exitFullscreen`.
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
- Page shortcuts (`shortcutOf`, `leavesKeyAlone`, `isCharacterKey` in `controls.ts`; one `keydown`
  listener in `player.tsx`): Space play/pause, the arrows previous/next in the reading direction (in a
  right-to-left page the left arrow goes forward; "next" only up to `maxIndex`), `M` sound, `C` captions,
  `T` transcript, `S` syllabus, `?` the shortcut list (`ShortcutList`, labels `player.keys.*`). A letter
  is the one on the key cap, or the key's QWERTY position on a non-Latin layout (Cyrillic, Arabic,
  Georgian). Keys typed into fields, sliders, menus, radio groups, tab lists and dialogs (the tutor, the
  drawers) stay theirs, and Space never takes over a focused button. The letter shortcuts can be turned
  off in the options dialog (`player.letterShortcuts`, WCAG 2.1.4 for speech-input users); Space and the
  arrows stay.
- Drawers (`drawer.tsx`) are native modal `<dialog>`s: focus trap, Escape, inert page and focus return come
  with the platform; they slide in from their side in the reading direction, instantly under Still.

### 3.8 i18n key groups

`messages/{locale}/player.json` for the ten UI languages (204 leaf keys each on 2026-11-04, arrays counted
once; parity enforced by `tests/i18n.test.ts`). Top-level keys: `leave, ask, askLabel, speed, soundOff, soundOn, more, options,
motion, reportProblem, start, review, startOver, completed, soundHint, voiceMissing, previous, replay,
pause, play, next, answer, check, continue, skip, progress, step, narration, volume, speedLabel, captions,
captionLanguage, captionSame, captionStored, captionMore, captionLoading, captionLimited,
captionUnavailable, captionError, captionRetry, captionAiNote, transcript, transcriptEmpty, fullscreen,
exitFullscreen, shortcuts, letterShortcuts, letterShortcutsHint, keySpace, wellDone, doneAfterTries, goodMove,
notQuite, risky, compromised, correctAnswer, multiHint, multiMissed, multiExtra, quote, timeLeft, timeUp,
lens, lensNext, lensActually, lensClose`. Groups:
`voiceLanguage {az, en, ru, tr, ro, ka, uk, de, fr, ar}` (the language name in the grammatical form `voiceMissing` needs: az
"Azərbaycan dilində", ru "азербайджанском" for "на {language} языке"; a new language needs an entry in
every UI language), `keys {toggle, previous, next, mute, captions, transcript, syllabus, help}`,
`syllabus {title, open, collapse, expand, lessonsDone, parts, locked}`, `sceneType {…the 11 types}`,
`hotspot {found, tap, missed, done}`, `swipe {threat, safe, left, question, itsThreat, itsSafe}`,
`match {pick, matched}`, `order {hint, up, down, wrong}`, `password {label, placeholder, strength,
levels[], reached, notStored}`, `scenario {you, onLine, speaking, inPerson, videoCall, ended, unknownSpeaker}`,
`simulation {handled, handledEmails, begin, mailApp, mailbox, inbox, sent, drafts, spam, archive, trash,
searchMail, selectEmail, to, toMe, attachments, incoming, mobile, outcomes {safe, risky, compromised}}`,
`recap {title, finish, saving, saveError}`, `done {title, xp, noXp, nextLessonTitle, backToModule, confirm,
certificate, home}`, `tutor {title, placeholder, empty, send, listen, listening, thinking, suggestions[],
privacy, offline, error}`, `artifact {from, subject, open, signIn, emailField, passwordField, allow, deny,
decline, accept, networks, secured, open_network, scanToOpen, permissionsTitle, voiceMessage, fileSource}`,
and `policy {otherLanguage, language {ten entries}, signed}`, which the policy reader
(`src/app/(focus)/policies/[id]/page.tsx`) reads, not the player. The player also reads `common.units.min`,
`learner.profile.motion*`, `learner.attest.{checkbox, submit, done, error}` (the card heading is
`player.done.confirm`), `learner.problem.{title, description, message, messageError, submit, sent}` and,
through `ProblemForm`, `common.errors.{rateLimited, generic}`. The tutor's name "AI Sel" lives in
`askLabel`, `soundHint`, `tutor.title`, `tutor.offline` and `tutor.error`.

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
  the token in the resume state. Default text: `DEFAULT_ATTESTATION` (all ten languages) in
  `src/lib/tenant-defaults.ts`, overridable per tenant in `settings.attestationText[locale]`.
- Done screen (`player.done.*`): mascot `celebrate`, `+{xp} XP` or `noXp` (a replay), the attestation card,
  `Certificate`, `Next lesson: {title}` (hidden while attestation is pending), `Back to module`, `Home`.
  The report bonus (`REPORT_BONUS_XP = 5`, daily cap 5) is awarded elsewhere (threat intake), not here.

### 3.10 Teachable moment

Not part of the lesson player. `src/components/site/teachable.tsx` `<TeachableMoment>` is the page a
learner lands on after clicking a simulated phishing link (`src/app/(public)/t/[token]`) or scanning a QR
trap (`src/app/(public)/q/[token]`); campaign templates carry the module slug the learner is sent to
afterwards (`moduleSlug` in `src/lib/campaigns/templates.ts`). `qr_trap` (professional plan) gates QR
templates in the campaign wizard, on save and at every launch (since the 2026-10-27 hardening, ADR-033);
there is no `teachable_moment` entry at all even though the original listed it as a flag.

### 3.11 Captions, AI subtitles and transcript

ADR-029, ADR-030. Files: `src/components/player/captions.tsx`, `media-controls.tsx` (`SubtitleSelect`,
`Transcript`), `controls.ts` (`transcriptOf`), `src/app/(focus)/learn/[slug]/[lessonId]/actions.ts` +
`caption-map.ts`, `src/app/api/subtitles/route.ts`, `src/server/subtitles.ts`,
`src/lib/content/subtitle-languages.ts`.

- **The line.** Every text the player passes to `speak()` is also written to a tiny external store
  (`createLineStore`: text, language, word reached, word count), so a word change re-renders only the
  caption bar and the transcript. `<CaptionBar>` shows the current line above the scene's bottom row
  (`slot`), otherwise as a sticky bar at the bottom of the page.
- **Which language.** `captionLangPref` `""` means the narration's own language: the line itself, filled
  word by word, shown only while a voice reads (silent, the scene already shows that text). A stored
  language (`captionLocales`: the lesson's other `lesson_contents` rows) comes from
  `loadCaptionsAction(lessonId, locale)`: `captionMap(narrated, other)` pairs the two rows' `spokenTexts`
  in order (translations keep every id and array length; an entry whose shape differs is left out) and
  maps each string exactly as spoken to its translation; rate limit `captions:{userId}` 60 / 10 min. Any
  other language goes to `POST /api/subtitles` (body `{ lessonId, target }`, `target` ∈ the 65
  `SUBTITLE_LANGUAGES`; the ten shipped languages are never sent to the model). A translation has no word
  timings, so it fills by the share of words read. `SubtitleSelect` groups the stored languages and
  `player.captionMore` ("More languages (translated by AI)", only with the `ai_tutor` feature;
  `moreLanguages` is named on the server because Chromium lacks some display names).
- **The AI route.** Same origin, signed in, `ai_tutor` feature, the lesson reachable for the viewer, the
  text this viewer hears (`pickLessonContent` for the interface language). `subtitleSourceLines` = the
  distinct audible parts; the cache id = sha256 of lesson, source locale, target and a hash of the lines,
  so a changed text is a new `ai_cache` row and one translation serves every learner. Cached or already
  running (`translateOnce`, per process) costs nothing; otherwise, with `ANTHROPIC_API_KEY`, one streamed
  call to `ANTHROPIC_TUTOR_MODEL` with the `save_subtitles` tool, checked by `validTranslation` (one line
  per source line, none empty or far longer). Limits: requests 60 / 10 min per person; model calls 6 /
  10 min and 30 / day per person, 300 / day per organisation; over 30,000 source characters `too_long`.
  Errors: 429 → `captionLimited`, 503 (no key) or 404 → `captionUnavailable`, else `captionError` with
  retry. The client caches every map per `lessonId:contentLocale:lang` and waits 600 ms before a request
  (`CAPTION_SETTLE_MS`), so scrolling the picker does not fire one per language.
- **Direction.** Captions and transcript lines take `langAttrs(lang)`; `RTL_LOCALES` also covers the AI
  languages fa, he, ps and ur.
- **Transcript.** `transcriptOf(scenes)`: what every scene reads on its own (no answer feedback), each line
  exactly as passed to `speak()`; the drawer lists the lines reached so far (all once the lesson is done),
  marks the current one, shows the chosen caption language under each and replays a line when a voice is
  available.
- **Keep in step.** Three lists mirror the `speak()` call sites in `scenes.tsx`: `spokenTexts` in
  `src/lib/tts/spoken.ts` (clips; includes the UI strings `multiHint`/`hotspot.done`), `spokenTexts` in
  `src/server/subtitles.ts` (captions; lesson text only, with each composed string's parts) and
  `transcriptOf` in `controls.ts`. A new spoken text in a scene needs all three, and
  `tests/tts.test.ts`, `tests/subtitles.test.ts` and `tests/player-controls.test.ts` show the shapes.

---

## 4. AI Sel tutor

Text and voice paths share one panel and one route. One language end to end: the panel sends the UI
language (`useLocale()`), the route grounds the answer in the lesson text of that language when the lesson
has it, the model answers in it, and the answer is read aloud only by a voice of it. The offline answer
quotes the lesson, so it is in the language of the lesson row the route picked and is read by that
language's voice (section 3.4).

- **UI**: `src/components/player/tutor-panel.tsx` `<TutorPanel open onClose slug lessonKey sceneId speak contentLocale? speaking? voice? soundOn?>`
  (`speak: (text, lang) => void`; `contentLocale` = the language of the lesson text; defaults:
  `contentLocale` the UI language, `speaking` false, `voice` true, `soundOn` true),
  opened by the header `Ask` button (shown only when `tutorEnabled` and `phase === "playing"`; mic icon
  when `tutorVoice !== false`, otherwise a question icon) and by the Home mascot (`sceneId: null`,
  `contentLocale` from Home's row lookup, section 3.4).
  Mascot `curious` → `think` → `happy`, talking while `speaking`;
  suggestion chips from `player.tutor.suggestions` (array, read with `t.raw`); an input (max 500 chars);
  a mic button when `voice` and `SpeechRecognition`/`webkitSpeechRecognition` exist (sets
  `r.lang = LANG_TAG[locale]`, `interimResults = false`, the transcript becomes the question and is sent);
  a privacy line (`player.tutor.privacy`). Before the first question the bubble shows `player.tutor.empty`.
  The answer streams into the bubble (`fetch` + `ReadableStream` reader) and, when `voice`, is read aloud
  through `speak(full, answerMode === "offline" ? lessonLocale : locale)` (`lessonLocale = contentLocale ?? locale`): in the player
  and on Home `narrator.speak(text, { lang })`.
  Without a voice for that language the answer stays text only and `VoiceNotice` appears under it
  (section 3.4). Opening the panel stops lesson narration. In the player, closing it does not stop an
  answer being read (`onClose={() => setTutorOpen(false)}` in player.tsx), whereas Home's `onClose` calls
  `narrator.stop()`; candidate fix: stop the narrator in the player's `onClose` too.
  `x-tutor-mode: offline` shows `player.tutor.offline`; a 429 shows `common.errors.rateLimited`
  (state `limited`).
- **Route**: `POST /api/tutor` (`src/app/api/tutor/route.ts`), body
  `{ slug, lessonKey, sceneId?, question, locale }` validated by `tutorRequestSchema`
  (`src/server/tutor.ts`: `slug`/`lessonKey` kebab-case ≤ 100, `sceneId` ≤ 100 without control characters
  (nullable), `question` trimmed 2–500 chars without control characters, `locale` ∈ `LOCALES`, the ten UI languages), body capped at `TUTOR_BODY_LIMIT = 8 KiB` (`readBodyCapped`, 413 beyond).
  Checks: same-origin `Origin` vs `Host` (403), signed-in viewer (401), tenant feature `ai_tutor` (404),
  `rateLimit("tutor:{userId}", 20, 10 min)` (429). The module is the tenant's copy or the global one;
  drafts only for `studio.write`. Lesson scenes: `pickLessonContent(rows, locale)` over the lesson's
  `lesson_contents` rows, so the text in the request `locale`, else `en`, else the only row (a studio
  lesson); the context and the offline answer then quote what the learner is reading.
- **Cache**: `tutor_cache` row id = `sha256Hex("{locale}|{lessonId}|{sceneId}|{normalised question}")`,
  plus `"|{row.locale}"` when the scenes used are not the English ones (normalised = lower-cased,
  whitespace collapsed, trailing `?!.` removed). Answers grounded in a translation are cached apart from
  answers grounded in the English text, whose ids stayed as they were before translations existed. A hit
  returns the stored answer with `x-tutor-mode: cache`. Answers are stored after streaming
  (`onConflictDoNothing`), with `model` = `ANTHROPIC_TUTOR_MODEL`, and only when the stream's
  `message_delta` stop_reason is `end_turn` (a refused or cut-off answer is shown to that learner but
  never stored, since cache ids do not include the tenant); nothing hashes the lesson text, so after a lesson is re-translated
  the old answers stay until their rows are deleted. To clear them: rows exist only when
  `ANTHROPIC_API_KEY` is set (offline answers, and the fallback after a failed stream, are never
  cached); `tutor_cache` (`src/server/db/schema.ts`) has `tenant_id` and `lesson_id` (= `lessons.id`), so
  `DELETE FROM tutor_cache WHERE lesson_id = '<lessons.id>'` clears every language and tenant of that
  lesson. There is no db shell script: write a small tsx script in the scratchpad that calls `createDb()`
  from `src/server/db/client.ts` and runs the delete, run it from `portal/` (PGlite opens `./.data/pg`
  relative to the working directory) with `next dev` stopped, and ask the user first on any shared or
  live database. An audit event name `tutor.cache_removed` is declared
  in `src/server/services/audit.ts`, but no code path emits it yet (verify before documenting a
  cache-clearing UI).
- **Model**: `@anthropic-ai/sdk` `client.messages.stream(tutorRequest(env.ANTHROPIC_TUTOR_MODEL, locale,
  context, scene, question))`. `tutorRequest()` (`src/server/tutor.ts`) builds `max_tokens: 1024`,
  `thinking: { type: "disabled" }`, `output_config: { effort: "medium" }`, `system: tutorSystemPrompt(locale)`
  and one user message of two text blocks: `"Lesson context:\n{context}"` with
  `cache_control: { type: "ephemeral" }` (this one breakpoint caches system + lesson context), then the
  current scene's lines and `"The learner asks: {question}"` after it. No temperature/top_p/top_k, prefill
  or fallbacks (Haiku 5.5 rejects them). Streamed as `text/plain` with `x-tutor-mode: ai` once the first
  text has arrived (Offline fallback below). Env (`src/server/env.ts`): `ANTHROPIC_API_KEY` (optional) and
  `ANTHROPIC_TUTOR_MODEL` (default `claude-haiku-5-5`; tutor only). `ANTHROPIC_MODEL` (default
  `claude-opus-5-5`) is the Studio drafting model in `src/server/ai.ts`; it rejects disabled thinking, so
  pointing the tutor at it makes every answer fall back to the lesson text. No TTS variables exist;
  `VOICE_PROVIDER` is for voice-call campaigns, not narration. ADR-008: only lesson context and the
  question go to the model, never learner data.
- **Context** `lessonContext(moduleTitle, lessonTitle, scenes)`, called with the module and
  lesson titles in the scenes' language (`pick(mod.title, row.locale)`, `pick(row.title, row.locale)`):
  the whole lesson in order, byte-identical for every scene and question on it so the cached prefix is
  reused (the current scene goes after the breakpoint instead); beats as `- say`, questions with `[correct]/[wrong]` options
  and feedback, hotspot spots, swipe verdicts, simulation actions `label → outcome: feedback`, scenario choices, match pairs, the correct
  order, recap points, intro; capped at 9 000 characters. `tutorSystemPrompt(locale)`: friendly security
  tutor, answer in `TUTOR_LANGUAGE[locale]` (Azerbaijani/English/Russian) in at most four plain sentences,
  grounded in the context, never ask for passwords/codes/personal data, off-topic questions are declined,
  no markdown. It also appends `languageStyle(locale)` (`LANGUAGE_STYLE` in `src/server/tutor.ts`, added
  to every model prompt in `src/server/ai.ts` too; an unknown language gets the English entry): az
  literary Azerbaijani without Turkish words, «siz», AI written «Sİ» while the name AI Sel stays, «…»
  quotes and the portal's terms; ru lowercase «вы», «…», ё and the portal's terms; en plain British
  English.
- **Offline fallback** `offlineAnswer(scenes, sceneId, question)`: without `ANTHROPIC_API_KEY` (or when the
  stream fails before any text) the route answers from the lesson itself: a pool of explanations
  (choice `explain` and correct feedback, hotspot `label: explain`, safe simulation feedback, recap points,
  beat text), scored by overlapping words of 4+ letters (split on `[^\p{L}\p{N}]+`, so az/ru words stay
  whole), the two best explanations sentence by sentence without repeating a sentence. Question and
  text are both compared through `fold()`: lower case, then the combining dot that `"İ".toLowerCase()`
  leaves (U+0307, which would also split the word) is dropped, Azerbaijani `ı` compares as `i` and
  Russian `ё` as `е`, so "ikiaddımlı" finds "İkiaddımlı" and "идет" finds "Идёт". The route waits for
  the model's first text before it returns the `Response`, so a stream that fails before any text is
  answered with `x-tutor-mode: offline` as well, and the panel reads it with the lesson's voice; a
  stream that fails after its first text keeps the partial `ai` answer, which is not cached.
- **Tests** `tests/tutor.test.ts`: `tutorRequestSchema` accepts library and studio ids and multi-line
  questions, rejects NUL/control characters and non-kebab ids; `readBodyCapped` respects the limit for
  multi-byte chunks, over-sized `Content-Length` and chunked bodies; `offlineAnswer` never repeats a
  sentence, ranks the relevant explanation first for az/ru questions, matches İ/ı/ё whatever the learner
  types, and answers every scene of every library lesson without repetition (that sweep reads the
  `.en.json` files only).

---

## 5. Conventions and gotchas

- **Never edit `docs/audit/`** (ADR-016): it is the record of the original. Content fixes go to
  `content/library/`; the 106 `.en.json` files there are currently identical (in `id/title/minutes/scenes`)
  to the `lesson` object of the audit copies.
- **Hydration safety**: `LessonPlayer`, scenes, mascot and tutor panel render on the server first. Browser
  state (speed, saved position) is read through `useSyncExternalStore` with server snapshots (`1`, `null`);
  shuffles are seeded by the scene id; no `Date.now()`/`Math.random()` in render paths (`started` is a ref
  set in `begin()`); nothing is rendered from the narrator's `supported` or the panel's `canListen` on the
  server path except the mic button, which only appears inside the opened dialog.
- **Azerbaijani formatting** (ADR-017, ADR-024): Chromium has no `az` date data and no az number
  symbols. Client code never calls `Intl` formatters, `useFormatter` or `toLocale*`; use
  `useClientFormat()` from `src/lib/client-format.ts` (`dateTime`, `relativeTime`, `number`; backed by
  `src/lib/az-format.ts`, checked against Node ICU in `tests/az-format.test.ts`) and `<RelativeTime>`.
  Numbers inside ICU messages (`{n, number}`, a plural's `#`) are covered by `<AzNumbersGate>` and its
  lazy polyfill (SKILL.md ground rules). The player currently formats no dates; keep it that way, go
  through these helpers, or format on the server as the certificate (`src/app/(public)/c/[token]/page.tsx`)
  and progress pages do with `getFormatter()` (`getAppFormatter()` for a relative time).
- **Messages JSON**: edit `messages/{locale}/*.json` (ten languages) with the Edit tool (shell heredocs corrupt Unicode
  and backslashes); keys contain no dots; ICU braces are escaped with quotes; every key exists in all three
  locales with the same placeholders (`tests/i18n.test.ts`). `player.tutor.suggestions` and
  `player.password.levels` are arrays read with `t.raw()`.
- **Content tests after any content change**: `npx vitest run tests/content.test.ts tests/content-locales.test.ts`.
  `tests/content.test.ts` counts and validates the **English files only** (53 modules, 106 `.en.json`
  files, every lesson passes `lessonFileSchema` + `lessonIntegrityErrors`, exactly 14 multi-answer choice
  scenes including `app-consent-phishing/consent-screen#ac1-choice`, az/ru titles for every module and
  lesson). Changing the number of modules, lessons or multi-answer scenes means updating these assertions.
  `tests/content-locales.test.ts` checks every `.az.json`/`.ru.json` that exists (schema, integrity,
  parity), fails on any file in a lesson folder not named `{lesson}.{en|az|ru}.json` after a lesson of
  `modules.json`, and checks that `readLibraryLesson` reads exactly the translations present; it does not
  require a translation (the checker's `--coverage` does). It also covers `pickLessonContent` and
  `sharedContentLocale`.
- **A translation keeps the English structure** (`localeParityErrors(en, other)`,
  `src/lib/content/locale-parity.ts`): the same keys in every object, the same length for every array, and
  every string, number and boolean identical, except string values under a key in `TRANSLATABLE`:
  `say, spoken, title, text, label, prompt, feedback, explain, intro, points, tips, buttons, button,
  fields, left, right, speaker, reveal, size, value, body, subject, name, app, to, brand`. The rule is by
  key name anywhere in the tree; an array of strings (`points`, `tips`, `buttons`, `fields`) takes its
  parent's key, and a rich field written as spans takes its spans' `text` key. In the library every
  `from.name`, attachment `name`, `contact`, `sender`, `caller`, `address`, `url`, `number`, `ssid`,
  `source`, `destination` and `caption` is such a span array, so all of them are translatable through
  `text`: the address rules below still hold the addresses in `address`/`url`, but nothing holds a phone
  `number` or an `ssid`. `app` is the label on a notification, permission or chat ("Settings", "IT Security"), except
  the `APP_IDENTIFIERS` `whatsapp`, `telegram`, `generic` and `chat`, which must stay byte-identical:
  `ChatView` in `artifacts.tsx` compares the first two for its header and wallpaper, `generic` is the
  library's value for any other messenger and `chat` the one the AI lesson format asks for
  (`src/server/ai.ts`). `to` is the e-mail's To line ("you", "Anar Hasanov"); `brand` is a login page's
  display name ("Office portal", "Family support"), while the `brandRef` next to it stays.
  Under a translatable key a value with letters may not become blank (a value without letters, such as
  the spacing or punctuation between spans, may), and addresses never change, by two rules:
  - A whole value that looks like an address stays the same (compared after trimming): one that starts
    with `http(s)://` or `www.`, an e-mail address, or a bare dotted name made only of ASCII letters
    (either case), digits and hyphens, which also catches whole-value file names such as
    `Rekvizitler.pdf`, `Sened.pdf.exe` or `KorpeQoruyucu.apk` and decimals such as `12.5`.
  - In every translatable value, each token `addressTokens(english)` finds must appear unchanged in the
    translation: URLs, e-mail addresses (also either half of one split across spans, `r.mammadli@` /
    `@idare.example`), and domain-like names with an optional path (`ispoct-mail.example.net/kvota`), so
    the addresses in a `"Name <address>"` or comma-separated To line stay while the names change. A
    dotted name whose last label is a known file extension (`FILE_EXTENSIONS`: `pdf`, `docx`, `xlsx`,
    `zip`, `exe`, `apk`, …) is a file name, not a domain, so `Budget draft 2027, final.xlsx` may be
    localised; a dotted name with any other ending of two or more letters inside a longer value counts
    as a domain and stays.
  - Neither rule catches a whole-value file name with an underscore, a space or a letter such as ə/ş,
    nor a known-extension file name inside a longer value (both translations localised
    `Scan_passports_0410.pdf` and `Print: Salary_table_October.xlsx` in
    `documents-printing/print-scan`), nor phone numbers, IBANs, card numbers, codes and network names;
    keep them by hand. The cases are pinned in
    `tests/content-locales.test.ts` (`describe("localeParityErrors")`).
- **Never translate** ids of any kind, `spot`, `highlight`, `brandRef`, `href`, `kind`, `type`,
  `outcome`, `verdict`, `correct`, `next`, `start`, `mood`, `gesture`, `stage`, `voice`, `channel`,
  `character`, `manner`, `environment`, `tone`, `from` (`them`/`me`), `time`, the `app` identifiers
  `whatsapp`/`telegram`/`generic`/`chat`, any address or domain, or any number. The checker reports
  each violation with its JSON path. Fictional brand and product names (`ParolSeyf`, `MöhürID`,
  `Kontakto`, `Torch Pro`) stay as they are, in text and under `app`/`brand` alike. Under `app`/`brand`
  the 2026-10 translations changed only labels ("Settings", "IT Support", "Print service", "Office
  portal", "Family support"), descriptive names or parts of names (`Torch` → «Fənər» / «Фонарик»,
  `Maps` → «Xəritə» / «Карты», `AlSat Payment` → «AlSat Ödəniş» / «AlSat Оплата», az `Photo Editor
  Plus` → «Foto Redaktor Plus») and Latin transliterations of Azerbaijani names: az `IshPocht` →
  «İşPoçt», `IshBazar` → «İşBazar», `Vatandash Portal` → «Vətəndaş Portalı» (ru keeps `IshPocht`,
  `IshBazar` and `Photo Editor Plus` in Latin but writes «Портал Ватандаш»). The checker cannot tell a
  name from a label, so keep one form per lesson, key and text alike, by hand (two lessons do not yet,
  section 7 gap 2).
- **The checker**: `npx tsx scripts/check-lesson-locales.ts` (from `portal/`, no npm script) checks every
  `.az.json`/`.ru.json`, or only the files named as arguments; `--coverage` also lists every English
  lesson missing a translation. Each file must pass the schema, the integrity rules and the parity rules;
  it prints `ok`/`FAIL` per file (at most 40 errors each) and exits 1 on a failure or, with
  `--coverage`, on a missing file. `syncLibrary` applies the same checks and stops at the first bad file
  (on PostgreSQL the import's transaction rolls back; on PGlite `content:sync` runs without one, so the
  rows written before it stay).
- **Change the English, change all three** (the heading predates the seven new languages: now all ten
  files): parity catches a structural change (a new beat, option or span) in the English file until all
  nine translations follow, but not a reworded sentence; reword each translation by hand in the same
  change. Nothing records which English version a translation follows: list the reworded strings with
  `git diff -- content/library/lessons/<module>/<lesson>.en.json` (from `portal/`) and update the same
  JSON paths in every `.{locale}.json`. A reworded spoken text also needs its clip regenerated (recipe 6.6).
- **A new text key needs `TRANSLATABLE`**: a scene or artifact field that learners read must be added to
  the set, otherwise every translation is forced to keep the English value; adding a key makes it
  translatable everywhere in the tree, so do not add one that also names an identifier.
- **Loading text into the database**: `npm run content:sync` with the dev server stopped (PGlite is
  single-process); `next dev` does not import on start, so edited lesson files are not served until the
  sync. The sync prints the row count per language (`texts: en …, az …, ru …`). It writes only the
  database of the copy it runs in: the 3100 `demo` and 3200 `final` presentation copies have their own
  `content/` and database and are refreshed only with the user's go-ahead (SKILL.md ground rules).
- **Never read text with a voice of another language**: keep `pickVoice` filtered to the text's
  language and the `"missing"` branch in `speak()`; a caller that must move on by itself handles
  `onError("language-unavailable")`, since `onEnd` never fires (section 3.4).
- **Two languages in one lesson**: a lesson can be in a language other than the interface's: English
  inside an az/ru interface (a missing translation, or an English studio lesson), or an az/ru studio or
  AI-trainer lesson inside any other interface language (`pickLessonContent` falls back to the only
  row). Lesson text is spoken with the narrator's default language and marked with `useContentLang()`.
  A new interface string that a scene reads aloud may join the lesson sentence in one utterance only
  when the two share a language (`!useContentLang()`); otherwise it is a separate utterance with
  `{ lang: env.uiLocale }`, started from the lesson text's `onEnd`, or goes through `FeedbackCard uiText`
  (section 3.4, the `multiHint` pattern).
- **Names in az/ru text**: Azerbaijani text writes AI as «Sİ»; the tutor persona stays "AI Sel" in every
  language. Lesson JSON is written with the Write or Edit tool, never through a shell heredoc. The 212
  translations are UTF-8 with a two-space indent, LF and a final newline; the 106 English files keep
  the format they were captured in (one-space indent, CRLF, no final newline), so edit them in place
  with the Edit tool and do not reformat them.
- **Where the decisions are recorded**: OPEN-QUESTIONS #6 (`docs/build/OPEN-QUESTIONS.md`) was closed
  on 2026-10-26: the az/ru lessons were translated instead of extracted from the live tenant, so the
  original's own az/ru text was never captured; it leaves two points open, the device-dependent
  Azerbaijani voice (#2) and a native speaker's final read before release. The decision is ADR-023 in
  `docs/build/DECISIONS.md` (separate files, the parity checker with `app`/`to`/`brand` and
  `addressTokens`, the voice-language rule, the translator and editor passes); ADR-024 records the
  interface localisation decisions (az numbers polyfill, «… əvvəl» / «… sonra», policy translations,
  «maddə» / «ст.» in standards). `docs/build/RESUME.md` opens with «✅ TAMAMLANDI (2026-10-26)» and is
  history (recipe 6.3).
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
4. Translate it: `{lesson-id}.az.json` and `{lesson-id}.ru.json` next to the English file (recipe 6.3).
   Without them az/ru learners get the English text and `check-lesson-locales.ts --coverage` fails.
5. Validate: `npx vitest run tests/content.test.ts tests/content-locales.test.ts` and
   `npx tsx scripts/check-lesson-locales.ts --coverage`; update the `toHaveLength(106)` / `53` / `14`
   assertions as needed (they count English files). The files are also validated at sync time.
6. Sync: stop the :3000 dev server (`preview_stop` on `portal`), run `npm run content:sync` (PGlite is
   single-process; it upserts by slug/key and keeps progress), start the server again. When another
   session or workflow owns that server, do not stop it; tell the user a sync is needed. The seed and
   the production server start-up run the same import. The sync reaches only the :3000 database: never
   stop or sync the 3100 `demo` or 3200 `final` copies unless the user asks; tell them those need their
   own refresh.
7. Check in the browser at `/learn/{module-slug}/{lesson-id}` with sound on and off, in az, en and ru;
   compare against the screenshots in `docs/audit/screens/` when the lesson copies an original pattern.
   New screenshots of the lesson belong next to the task's own notes, never in `docs/audit`.
8. If the tutor should answer about it offline, nothing else is needed (`offlineAnswer` reads the scenes);
   `tests/tutor.test.ts` iterates every English library lesson, so run it too.

### 6.2 Add a new scene type

1. `src/lib/content/types.ts`: add the variant to the `Scene` union (and any new artifact/visual types).
2. `src/lib/content/validate.ts`: add a `z.object({ type: z.literal("…"), id, … })` to the
   `discriminatedUnion`, and cross-reference checks to `lessonIntegrityErrors()`. Learner-facing text
   under a key not yet in `TRANSLATABLE` (`src/lib/content/locale-parity.ts`) cannot be translated until
   the key is added there (section 5); a library lesson that uses the scene needs it in its
   `.az.json`/`.ru.json` too.
3. `src/components/player/scenes.tsx`: export `XxxScene({ scene, env })` following the pattern: narrate the
   prompt in a mount effect, call `env.onAnswer({ sceneId, itemId?, correct, firstTry: true, outcome? })`
   once per item, show a `FeedbackSheet` and call `env.narrator.stop(); env.onDone()` on `Continue`;
   respect `env.still` on mascots and `env.soundOn` on karaoke.
4. `src/components/player/player.tsx`: add the `{scene.type === "…" ? <XxxScene … /> : null}` line.
5. `src/server/tutor.ts`: add a `case` in `lessonContext()` (and in `offlineAnswer()` if the scene holds
   explanations) so AI Sel can see it.
6. `src/components/player/resume.ts`: extend `answerIdsOf()` only if the scene records answers under ids
   other than its own `sceneId`.
7. i18n: new strings in `messages/{locale}/player.json` (all ten) under a new group.
8. Tests: a fixture lesson in `tests/content.test.ts` or a dedicated test with `lessonFileSchema`;
   `tests/player-resume.test.ts` if ids changed; run `tests/i18n.test.ts`.
9. Studio (if authors should create it) is covered by the training-pipeline reference.

### 6.3 Translate a lesson, or add a lesson language

Every library lesson exists in all ten UI languages: `{lesson}.en.json` (the original) and one file each
for az, ru, tr, ro, ka, uk, de, fr and ar (954 translations, all passing `--coverage` on 2026-11-04; az/ru
since 2026-10-26, ADR-023; the seven others since 2026-11-04, ADR-026). They were translated from the EN
files in this rebuild by agents (translator, independent native editor, consistency passes): the
original's own az/ru lesson text was never captured (the audit has only `.en.json`), and no human native
speaker has read the seven new languages yet (OPEN-QUESTIONS #6, #7). A task here is usually a
re-translation after an English change, a wording fix, or a new language.

**Glossaries.** One file per language in
`.claude/skills/cyclowareness-experience/references/glossaries/{tr,ro,ka,uk,de,fr,ar}.md`, written by a
terminologist and checked by an independent native reviewer: the terms (one concept, one term), the
style rules (form of address, quotes, numbers and dates, typography, letters, plurals), the character-name
table, and the reviewers' notes (what they changed, kept and left open; OPEN-QUESTIONS #22 lists the open
tr/ro/uk choices). The az and ru glossaries are in step 3 below. Read the language's glossary before you
touch any of its text, and record a term there when you settle one.

**One lesson, any language**

1. Read the English file end to end and the terms the portal already uses: the glossary,
   `messages/{locale}/player.json`, `learner.json` and `content/library/i18n.{locale}.json`. The
   translation's `title` is exactly `i18n.{locale}.json` → `lessons["{module}/{lesson}"]`; modules are
   named as in that file. For a re-translation after an English edit, start from the `git diff` of the
   `.en.json` and make the same change in all nine translations (section 5, "Change the English, change
   all three", now applies to all ten files).
2. Write `content/library/lessons/{module}/{lesson}.{locale}.json` with the Write tool as a copy of the
   English JSON (UTF-8, two-space indent, final newline), or Edit an existing one in place. Change only the
   translatable strings (section 5). The rules the translators and editors worked to:
   - `say` is read aloud and highlighted word by word: natural spoken sentences that sound good aloud.
     `spoken` keeps its delivery tags (`<breath>`, `<short pause>`, `<sigh>` …) at natural places, with
     hesitation fillers of the target language. `spoken` is also where a phonetic spelling goes when a
     voice mispronounces a name (ro voices read «Elchin» as «Elkin»); never change the visible text for it.
   - Rich text keeps the same number of spans with the same `spot`/`link`/`reveal`; distribute the
     sentence so every span with a `spot` still holds exactly the phrase the spot is about (the urgency
     phrase, the deadline, the fee, the new IBAN); a plain span may shrink to punctuation when the word
     order needs it; never move a spot to another element.
   - Emails, SMS, chats, calls and screens read like a realistic attack on an employee in Azerbaijan in
     that language and keep every red flag the lesson teaches: the stories stay in the Azerbaijani company
     world in every language (Safarov Industries, manat/AZN, +994 numbers, Azerbaijani institutions;
     ADR-026).
   - Translated like any label (section 5): `app` on a notification, permission or chat ("Settings" →
     «Ayarlar», «Настройки»), except the identifiers `whatsapp`, `telegram`, `generic` and `chat`; the
     e-mail's To line `to` ("you", a person's name), keeping every address in it; a login page's `brand`
     display name ("Office portal" → «Ofis portalı»), keeping its `brandRef`.
   - Unchanged: addresses, domains and URLs, also inside a sentence or a `"Name <address>"` To line (the
     checker compares each one), phone numbers, IBANs, card numbers, codes, times, fictional brand and
     product names (section 5, "Never translate", lists the few kinds the translations changed), the
     name AI Sel. A file name may be localised only when the checker allows it: a whole value made only
     of ASCII letters, digits, hyphens and dots (`Rekvizitler.pdf`, `Sened.pdf.exe`) must stay; a name
     with `_`, a space or ə/ş, or one with a known extension inside a longer value (`Budget draft 2027,
     final.xlsx`), may change (section 5). When you localise one, the checker protects neither its extension nor a trick such as
     `.pdf.exe` and does not check that every occurrence uses the same new name, so check both by hand.
   - A correct option's feedback still praises the right reasoning; nothing may hint at another answer.
   - az: «siz» form, «…» quotes, decimal comma, manat / AZN, the letters ə ğ ı İ ö ü ç ş, no Turkish
     words or spellings, AI written «Sİ», people's names in Azerbaijani spelling in the text (`Anar
     Hasanov` → «Anar Həsənov», `Aliyev` → «Əliyev») but unchanged in addresses and identifiers. ru:
     «вы» in lower case, «…» quotes, decimal
     comma, ё where standard, no Latin letters inside Russian words, people's names in Cyrillic in the
     text (Лейла, Тураль, Камран) but unchanged in addresses and identifiers. A bare decimal value such as
     `12.5` must stay as it is (section 5).
   - The other seven: the glossary's style rules and names table. Examples: tr writes Azerbaijani names
     the way Turkish media do («Reşad Memmedov») and uses «parola», never «şifre», in teaching text; ro
     writes ș ț with the comma below (never the cedilla, which is also the code point of Azerbaijani ş)
     and names in their ASCII English form («Rashad Mammadov»); uk uses «ви» in lower case and no
     ы/э/ъ/ё; ar uses Western digits 0-9 only, Modern Standard Arabic as Saudi services write it, and
     gender-neutral constructions.
3. Glossary for az and ru (given to every translator and editor of the 212 az/ru files):
   - az: fişinq; fişinq məktubu; SMS fişinqi; telefon fişinqi; QR fişinqi; parol; parol ifadəsi; parol
     meneceri; iki addımlı doğrulama; çoxfaktorlu autentifikasiya (MFA); birdəfəlik kod; autentifikator
     tətbiqi; e-poçt / məktub; gələnlər qutusu; göndərən; qoşma; link; bildirmək; təhlükəsizlik komandası;
     İT dəstəyi; zərərli proqram; fidyə proqramı; məlumat oğurlayan proqram (infostealer); deepfake;
     klonlanmış səs; brauzer; genişlənmə; yeniləmə; ehtiyat nüsxə; fleş kart; QR kod; sosial mühəndislik;
     fırıldaq / fırıldaqçı; məlumat sızması; şəxsi məlumatlar; hesab; daxil olmaq; giriş səhifəsi; tətbiq;
     klikləmək; cihaz.
   - ru: фишинг; фишинговое письмо; SMS-фишинг; телефонный фишинг (вишинг); QR-фишинг; пароль; парольная
     фраза; менеджер паролей; двухэтапная проверка; многофакторная аутентификация (MFA); одноразовый код;
     приложение-аутентификатор; электронная почта / письмо; входящие; отправитель; вложение; ссылка;
     сообщить (в службу безопасности); служба безопасности; ИТ-поддержка; вредоносная программа;
     программа-вымогатель; программа-похититель данных (инфостилер); дипфейк; клонированный голос;
     браузер; расширение; обновление; резервная копия; флешка; QR-код; социальная инженерия;
     мошенничество / мошенник; утечка данных; персональные данные; учётная запись; войти; страница входа;
     приложение; устройство.
   - Decisions applied across all 212 az/ru files: az «İT dəstəyi», «bildirmək», «fleş kart», «qoşma»,
     «genişlənmə», and «İki addımlı doğrulama» as the `passwords-mfa/mfa` title; ru
     «служба безопасности», «ИТ-поддержка», «ПИН-код», and «учётная запись» except for a messenger
     or social-network account, which is «аккаунт».
4. Check: `npx tsx scripts/check-lesson-locales.ts content/library/lessons/{module}/{lesson}.{locale}.json …`
   (one or more files) until each prints `ok`, then `npx vitest run tests/content-locales.test.ts`. The
   checker cannot judge wording: read the result side by side with the English, or give it to a second,
   native editor.
5. Load and look: stop the :3000 dev server, `npm run content:sync`, start it again (recipe 6.1 step 6;
   never the 3100/3200 copies without the user's go-ahead); open the lesson with the profile language set
   to that language, sound on, and in ar check the right-to-left layout. In a browser without a voice for
   the language (Azerbaijani in Chrome on Windows) the lesson shows `VoiceNotice` and stays silent unless
   it has clips. Ask AI Sel something in that language (the offline answer quotes the translation).
   Answers cached for the old text stay in `tutor_cache` (section 4, Cache, says how to clear them). A
   changed text has no clip until `scripts/generate-narration.ts --only {module}/{lesson} --locales {locale}`
   runs again (recipe 6.6); AI subtitles of the old text are not reused (their cache id hashes the text).

A few lessons after an English change are quicker by hand with the steps above; the workflows below are
for a whole language or a large batch.

**Many lessons (how the 954 files were made).** Workflow scripts; copies are in `docs/build/workflows/`.
- az and ru (2026-10-21 → 26): `translate-lessons.js` (not copied to the repo; it stayed in the scratchpad
  of the session that ran it). Per batch of 7–9 lessons a translator and an independent native editor,
  then one consistency editor per language. `docs/build/RESUME.md` keeps that run's resume plan as
  history; do not run its steps.
- tr, ro, ka, uk, de, fr, ar (2026-10-27 → 11-04): `localize-language.js`, one run per language, args
  `{ lang, langName, market, plurals }` (`plurals` = the CLDR categories the language needs). Items: the
  UI namespaces in chunks, the legal texts, the policies, the landing (ar only), and the 106 lessons in 13
  batches (9, 7, 9, 7, 9, 9, then seven groups of 8). Per item a translator, then an independent editor
  who reads the English side by side; then two consistency passes (lesson terminology, UI terminology).
  `finish-editors.js` reruns only the editor passes a usage limit cut off (args `{ lang, langName,
  plurals, items }`) plus a final consistency sweep. Every agent is wrapped in `retrying()` (a usage
  limit ends an agent without a result: wait 10 minutes, up to 40 tries), may not touch `.en.json` or
  code, and runs the checker on its files.
- Before reusing them: replace the placeholders `<repo>` (the portal path) and `<scratchpad>` (`SP`, the
  running session's scratchpad) in both scripts; they read the glossary from `${SP}/glossaries/{lang}.md`: point that at the skill's `glossaries/` folder
  (same files). Write the new language's glossary first (a terminologist, then an independent native
  reviewer), and make sure `messages/{lang}/` and `content/library/i18n.{lang}.json` exist (steps 1 and 3
  below), because the agents read them. The shared prompt frames every artefact as an attack on an
  employee in Azerbaijan (ADR-026); decide with the user whether that fits the new market.

**A new UI and lesson language.** Lesson text is served only in a UI language, so the interface comes
first. Ask the user before adding one (ADR-025 replaced Italian with Arabic on request).

1. UI: `LOCALES` in `src/i18n/config.ts` (the app resolves only these; `SITE_LOCALES` is the same list,
   so the language also needs `content/landing/{xx}.json`, `tests/landing.test.ts`), `LOCALE_NAMES`,
   every namespace in `messages/{xx}/` (`tests/i18n.test.ts` iterates `LOCALES`; the release used
   `node <scratchpad>/check-messages.mjs {xx}` (copy in `docs/build/workflows/`) for keys, ICU and
   placeholders), and an `{xx}` entry in every per-language name map of every UI language:
   `common.languages`, `player.voiceLanguage` (in the form `voiceMissing` needs there),
   `player.policy.language`, `secops.aiTrainer.contentLanguageName`. `UI_ALIAS` in the same file sends
   browser languages without an interface to one (`be`, `kk`, `ky`, `uz` → ru): remove the new language
   from it if it is there. A right-to-left language also goes into `RTL_LOCALES` (step 7).
2. Code-side per-language maps: `pick()` (`src/i18n/config.ts`) silently falls back to `en`, but
   `tests/in-code-locales.test.ts` now fails on a missing entry for every map it imports
   (`DEFAULT_ATTESTATION`, `DEFAULT_CERTIFICATE_TEXT`, `DEFAULT_PATH_CERTIFICATE_TEXT`,
   `DEFAULT_TEMPLATES`, `DEFAULT_TEMPLATES_NO_DUE`, `EMAIL_BUTTON_LABEL`, `EMAIL_BUTTON_BY_KIND`,
   `FIXED_MESSAGES` in `src/lib/tenant-defaults.ts`; the campaign `TEMPLATES` and click risk titles in
   `src/lib/campaigns/templates.ts`; `riskTitles` in `src/lib/risk-title.ts`; `localizeStandard` in
   `src/lib/standards.ts`; the lab games `INBOX`, `LINKS`, `MFA` in `src/server/lab/games.ts`;
   `TUTOR_LANGUAGE`, `LANGUAGE_STYLE` and `tutorRequestSchema` in `src/server/tutor.ts`). Still grep
   `grep -rnE "[{ ]az: " src` for maps outside the test (`REFRESHER_TITLE` in `src/server/jobs.ts`,
   `BLOCKED_TITLE` and `BLOCKED_REASON` in `src/server/services/campaigns.ts`, `ROLE_NAMES` in
   `src/server/actions/people.ts`, `TEMPLATE_SAMPLE` in `src/app/api/admin/people/[kind]/route.ts`,
   `PREVIEW_VARS` in `src/components/admin/settings-tabs.tsx`, `TEXT` in `src/app/global-error.tsx`;
   the ones typed by `Locale` make `npm run typecheck` fail),
   the titles in `content/library/paths.json`, and add `locale-data/{xx}.js` to
   `src/i18n/az-numbers-polyfill.ts` (it replaces `Intl.NumberFormat` for every language).
   `defaultSettings().locales` is `[...LOCALES]`, so new tenants get it; existing tenants enable it in
   Settings → Languages.
3. Library: `LESSON_TRANSLATIONS`, the checker, `tests/content-locales.test.ts` and the title test in
   `tests/content.test.ts` all follow `LOCALES`, so the code needs no change; the content does:
   `content/library/i18n.{xx}.json` (every module and lesson title) and the 106 `{lesson}.{xx}.json`
   files, plus `content/legal/{privacy,terms}.{xx}.md` and `content/policies/*.{xx}.md`.
4. Tutor and AI: `TUTOR_LANGUAGE` and `LANGUAGE_STYLE` (the language's terms, form of address and quotes)
   in `src/server/tutor.ts`; whether `fold()` needs the language's case quirks (Turkish `İ`/`ı` is
   already folded); `TRAINING_LOCALES` in `src/server/ai-verify.ts` is `LOCALES`. These also set the
   language of Studio drafts, AI-trainer generation and the AI reviewer's messages in `src/server/ai.ts`.
5. Voice: `LANG_TAG` in `narrator.ts` and in `tutor-panel.tsx` (speech recognition); check which
   browsers list a voice for the language and whether `player.voiceMissing` gives the right advice. For
   clips: check that `eleven_v3` reads the language, have a native speaker pick a voice
   (`ELEVENLABS_VOICE_{XX}`), then recipe 6.6 (the generator iterates `LOCALES`).
6. Translate everything with the workflow above and a glossary for the language, then `--coverage`
   (106 more files), `npm run typecheck`, the lint and `npx vitest run`.
7. Right-to-left (Arabic is the one so far; ADR-025): `dirOf` / `langAttrs` read `RTL_LOCALES`, `<html dir>`
   follows the page language, components use logical classes only (`ms-`, `pe-`, `start-`, `text-start`,
   `border-s`; `tests/rtl-logical.test.ts` fails on a physical one outside its allow-list), charts and
   their trend arrows mirror, the mascot keeps its drawing and mirrors only its facing and points
   (`mirrorForRtl`), the keyboard arrows and the swipe sign follow the reading direction, and code, URLs, addresses, phone
   numbers, IBANs and OTPs stay left to right (`dir="ltr"` or `<bdi>`). A new script also needs its font
   (`next/font/google` in `src/app/layout.tsx`, not preloaded, like Noto Sans Georgian and Arabic) and a
   look at `/og/{xx}` (Satori does not shape Arabic, so `/og/ar` shows the English card).

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
in `player.artifact.*` (all ten locales), and, if the simulation should open something inside it, honour
`onLink`/`onAttachment` from `useArtifactMode()`.

### 6.6 Generate the natural narration (pre-generated TTS)

Built on 2026-10-27 (ADR-028); no clip has been generated yet, because the ElevenLabs key and the voice of
each language are still open (OPEN-QUESTIONS #2). Until then every text is read by Web Speech.

The pieces:
- `src/lib/tts/text.ts`: `speechText`, `wordsOf`, `wordOffsets`, shared by the player, the generator and
  the manifests (a manifest is keyed by `speechText`).
- `src/lib/tts/spoken.ts`: `spokenTexts(scenes, ui)`, every string the player passes to `speak()` when the
  lesson is read in the interface's own language, in lesson order, without repeats: the intro's
  `{title}. {body}`, the recap points joined with `". "`, every pick a choose-all question can be checked
  with (its explained feedback then `explain`; single picks only above 8 options), the multi-answer prompt
  with `player.multiHint` in one utterance, the hotspot's `player.hotspot.done`, simulation `say` as well
  as `spoken` (the tip's replay reads `say`). It mirrors `scenes.tsx`: a new `speak()` call there needs a
  line here (and in the subtitles' and transcript's lists, section 3.11).
- `src/lib/tts/key.ts`: `TTS_MODEL = "eleven_v3"` (the model that reads all ten languages, az and ka
  included), `TTS_REVISION`, `clipKey(locale, model, voice, text, revision)` = sha256.
- `src/lib/tts/clips.ts`: `clipUrl` (`/generated/tts/{locale}/{key}.mp3`), `isClipUrl`, `manifestName`
  (`module/lesson` → `module__lesson.json`), `wordTimings(text, alignment)` (per-character timings to one
  entry per `wordsOf` word, tolerant of a dropped or added character, times only forward), `wordAt`.
- `scripts/generate-narration.ts`: walks `content/library/lessons`, calls
  `POST https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps` (`mp3_44100_128`,
  `language_code`, a seed from the key), retries 429/5xx and timeouts with backoff, stops the run on
  401/403, writes each clip through a `.part` file and each lesson's manifest after the lesson.
- `src/server/narration.ts`: `loadNarrationClips("{module}/{lesson}", locale)` reads and validates a
  manifest (zod, `isClipUrl`), keeps only clips whose file exists; production reads each manifest once,
  development rereads it. Only library lesson keys and UI languages reach the file system; studio
  lessons never have clips. The lesson page passes the result to the player as `clips`.
- `next.config.ts`: `/generated/tts/*` is served `Cache-Control: public, max-age=31536000, immutable`.
- Tests: `tests/tts.test.ts` (keys, timings, spoken texts), `tests/narration.test.ts` (manifest reading),
  `tests/narrator-voice.test.ts`.

Steps:

1. Put `ELEVENLABS_API_KEY` and the voices in `portal/.env.local` only (never the compose `.env`, whose
   `env_file` would hand the key to the container): `ELEVENLABS_VOICE_ID` for every language and
   `ELEVENLABS_VOICE_{XX}` per language (`AZ`, `KA`, `AR`…). A voice id is letters and digits only. No
   voice is built in: ElevenLabs retires its default voices on 2026-12-31, and a native speaker of each
   language should choose from the Voice Library.
2. Estimate: `npx tsx --env-file=.env.local scripts/generate-narration.ts --dry-run` (no key needed). On
   2026-11-04: 37,724 clips and 4.01 million characters for the ten languages, about 321 USD at
   0.08 USD per 1,000 characters (26 to 38 USD per language; de and fr are the longest, ar the shortest).
3. Sample: `--locales az --only phishing-email/spot-the-phish`, then open that lesson with sound on and
   listen with the native speaker (pronunciation of names, pace, the karaoke timing). A name read wrongly
   is fixed in the lesson's `spoken` text, not in the visible text.
4. Generate: `--locales az,ru,… --concurrency 4` (1 to 16). Clips already on disk are reused, so a rerun
   pays only for new or changed text; failed clips are listed and retried on the next run.
5. To remake a clip whose text did not change (a bad take), raise `TTS_REVISION` and rerun: every clip then
   gets a new name and seed, so this costs a full run of the languages generated. A new voice for a
   language regenerates that language's clips.
6. Ship: `public/generated/tts/` and `content/narration/` must be in the image, so run the generator
   before `docker build`. In development new manifests are picked up without a restart.
7. Check in the player: a lesson with clips reads in the clip's voice whatever the browser has (no
   `VoiceNotice`), speed and volume change the playing clip at once, and texts without a clip (a changed
   sentence, an interface hint in another language) still go to Web Speech.

### 6.7 Tune timers

- Seconds: `page.tsx` (`60` for `more`, `30` otherwise) and the Profile copy
  `learner.profile.timerStandardBody` / `timerMoreBody` in all ten locales.
- Which modules: the `m.difficulty !== "Easy"` test in `page.tsx`; the tenant switch is
  `settings.learning.timeLimits` (admin Settings → Learning); the learner switch is `users.timer_pref`.
- Which scenes: only `ChoiceScene` calls `useCountdown(env.timer, …)`. To time tutor checkpoints, swipe or
  hotspot, add the same hook and `TimerPill` and decide what expiry records (`correct: false`).
- Per-question limits are not in the content format; adding `timeLimit?: number` to the `choice` scene
  would need `types.ts`, `validate.ts` and a `scene.timeLimit ?? env.timer` in `ChoiceScene`.

### 6.8 Add a tutor capability

- New context (e.g. the learner's wrong answers of this lesson): extend the request schema in
  `src/server/tutor.ts`, pass the data from `TutorPanel` (`tutor-panel.tsx` builds the body), add it to
  the second text block of `tutorRequest()` without PII (ADR-008; `lessonContext()` is the cached prefix
  and must stay the same for every question on a lesson), and include it in the cache id only if it
  changes the answer.
- New behaviour (e.g. a "Why is it fake?" quick action): add the string to `player.tutor.suggestions`
  in all ten locales; the chips call `ask(s)` directly.
- Tool use or longer answers: change `max_tokens`/`system` in `tutorRequest()` (`src/server/tutor.ts`); keep the plain-text streaming
  contract and `x-tutor-mode` header the panel relies on, or update the panel's reader.
- Voice output quality: `TutorPanel` speaks through the same narrator (`speak(text, answerLang)`), but the
  tutor's answers are dynamic, so they never match a clip and always use Web Speech; a live provider call
  for answers would be a new decision (cost per answer, key on the server).
- Rate limit and cache knobs: `rateLimit("tutor:{userId}", 20, 10 * 60_000)` in the route; cache rows in
  `tutor_cache` (a cache-clearing admin action would emit the declared `tutor.cache_removed` audit event).

### 6.9 Triage: the tutor answers or reads in the wrong language

Walk the chain from the request to the voice (detail in sections 3.4 and 4):

1. Request language: the panel sends `useLocale()` (`tutor-panel.tsx`), which `src/i18n/request.ts`
   resolves for a signed-in learner from the profile language, else the `locale` cookie, each only when
   the tenant has that language switched on (`settings.locales`), else the tenant's `defaultLocale`.
   Check the profile
   language and the tenant's languages first.
2. Model language: `tutorSystemPrompt(locale)` asks for `TUTOR_LANGUAGE[locale]` with
   `languageStyle(locale)` (`src/server/tutor.ts`). An AI answer in another language, or with other
   terms, under the right request locale is a prompt or model problem.
3. Grounding row: `pickLessonContent(rows, locale)` in `src/app/api/tutor/route.ts`. An English offline
   answer inside an az/ru interface means the lesson has no row in that language: check the
   `.az.json`/`.ru.json` file, the lesson's `lesson_contents` rows and whether `content:sync` ran.
4. Cache: `x-tutor-mode: cache` returns a stored answer; its id includes the request locale (and the
   row's locale when not `en`), so a wrong answer stays until its `tutor_cache` row is deleted (section 4,
   Cache).
5. Failed stream: the route waits for the model's first text, so a stream that fails before it is
   answered with `offlineAnswer` under `x-tutor-mode: offline` and read with the lesson row's voice. Only
   a stream that fails after its first text stays `ai`, with the partial answer in the UI language.
6. Home: `home-mascot.tsx` lends `speak={(text, lang) => narrator.speak(text, { lang })}` and passes
   `tutor.contentLocale`, which `src/app/(learner)/app/page.tsx` sets to
   `pickLessonContent(rows, locale)?.locale` over the next lesson's `lesson_contents` rows. An offline
   answer on Home read or marked in the wrong language means that value differs from the row the route
   picked (step 3): both use the same rows and the request locale. Library lessons have a row in every
   UI language, so only studio and AI-trainer lessons can differ from the UI language here.
7. Silent answer with a notice: `useVoiceAvailability(answerLang)` is `"missing"`, the device has no
   voice for that language and `VoiceNotice` shows under the answer; nothing to fix in code.
8. Microphone: speech recognition uses `LANG_TAG[locale]` in `tutor-panel.tsx` (`az-AZ`, `en-US`,
   `ru-RU`); a transcript in the wrong language comes from there or from the browser.
9. Tests: `tests/tutor.test.ts` covers the request schema, the body cap and `offlineAnswer` (İ/ı/ё
   folding). No test covers `answerLang`, `VoiceNotice`, `uiLocale` or `ContentLangProvider`, so verify
   in a browser: the player and Home in az and ru, in Chrome on Windows (no Azerbaijani voice) and in
   Edge (has one).

---

## 7. Gaps vs the original

1. **Pre-generated TTS**: the pipeline exists (recipe 6.6, ADR-028) but no clip has been generated (no
   ElevenLabs key or voices, OPEN-QUESTIONS #2), and there are no `narrationClipCount`/`narrationTotalMs`
   props. Until then narration is the browser's speech engine, so voice quality per language depends on
   the device, and karaoke timing is estimated when the engine sends no word boundaries. Where the device
   has no voice for the lesson's language (Azerbaijani in Chrome on Windows) the lesson is silent with
   `VoiceNotice`, so az learners on such devices get no narration and no auto-advance at all. Tutor
   answers will stay on Web Speech even with clips (recipe 6.8).
2. **Lesson languages**: lesson text exists in all ten UI languages for all 106 lessons and is served in
   the learner's language (section 2.2, ADR-023, ADR-026), so it is no longer a gap as such; but it was
   translated from EN in this rebuild by agents (translator, independent editor, consistency passes), so
   its wording is not the original's (never captured) and no human linguist has reviewed it yet:
   OPEN-QUESTIONS #6 and #7 recommend a native speaker's final read before release (#22 lists the open
   tr/ro/uk term choices). Still open:
   - Voice per device: the az text is read only where the browser lists an Azerbaijani voice (Microsoft
     Edge, which `player.voiceMissing` recommends); Chrome on Windows stays silent with `VoiceNotice`
     (gap 1). Which other browsers and phones have one is not recorded.
   - Fictional names under `app` / `brand`: these keys are translatable (section 5), so the checker
     does not notice a changed product name, and nothing checks that a name keeps one form across a
     lesson. On 2026-10-26 two lessons mix forms: `fake-login-windows/drag-test.az.json` writes
     «İşPoçt» in its text but kept `brand: "IshPocht"` on the `own-tab` login screen, and
     `search-ads-lookalikes/lookalike-domains.ru.json` writes «Портал Ватандаш» under `brand`/`app`
     (steps `fake-login`, `new-login`, `real-login`) but keeps `Vatandash Portal` in the `search-ad`
     and `new-login` labels. A check would compare each translated `app`/`brand` value with the
     lesson's other text.
   - Studio and AI-trainer lessons are single-language (one `lesson_contents` row); learners in another
     language get that row as it is, marked with its `lang`, and its interface hints are read in the UI
     language (section 3.4). The tutor's offline answers from such a lesson use that row's language and
     voice, in the player and on Home.
   - Nothing ties a tutor cache row to the lesson text: after a re-translation old `tutor_cache`
     answers stay until their rows are deleted (section 4).
   - The `app`/`brand` name check above was written for the az/ru files; the seven new languages were
     unified by their consistency passes, but no check enforces it there either.
   - A new UI language touches the files listed in recipe 6.3; right-to-left works for Arabic (ADR-025),
     another RTL language needs its font and a look at its layout.
   - AI subtitles (section 3.11) are unchecked machine translations, flagged as such in the picker; they
     have not run against the live model yet (no `ANTHROPIC_API_KEY`).
   - `tests/tutor.test.ts` sweeps only the English lessons; `offlineAnswer` over the translated files is
     covered by small fixtures only.
3. **Illustrations**: the 29 ids render as Lucide icon compositions, not the original two-tone scenes
   the spec says must be redrawn.
4. **Scenario staging**: node `visual` (22 nodes: 11 illustrations and 11 artifacts, six of them call
   screens) is ignored; the stage is derived from `channel` only; `character` is not read at all (the
   display name is `speaker`, or `scenario.unknownSpeaker` when a node has none; all 32 library nodes
   with a `character` have a `speaker`). The spec's
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
    pill, sound hint, speed (now a select), `Leave lesson`, checkpoint beats, `stat` visuals, Lens, swipe, match,
    order, password, recap, attestation, certificate link, resume after reload, and lesson text in the
    learner's language (all ten). The `wifi` artifact, `choice.multi`/`choice.visual`, and the syllabus,
    volume, captions/AI subtitles, transcript and keyboard shortcuts (section 3.11, ADR-030) are
    extensions beyond the spec.
