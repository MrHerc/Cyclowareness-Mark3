# The mascot: "AI Sel" (Rive)

The shield-shaped robot that greets learners on Home, narrates tutor beats in the lesson player, reacts in feedback sheets and the tutor panel, walks the learner through the onboarding tour, and leads the public landing tour. One Rive file, one React wrapper, five call sites. All paths are repo-relative; `portal/` is the app.

> **Since 2026-10-21 the live mascot is the cat** (a Canvas 2D rig, same props): see [section 6](#6-cat-implementation-2026-10-21). Since 2026-10-27 it has storybook art, many more acts, the decorative `auto` mode and the Home "Play with Sel" card: [section 6.6](#66-storybook-cat-acts-auto-and-the-home-play-card-2026-10-27) (ADR-031). Sections 1–5 describe the Rive robot, which is kept; switching back is one line plus the two cat-only props (§6.3).

## Table of contents

1. [What the original Cylosof did](#1-what-the-original-cylosof-did)
2. [Current implementation](#2-current-implementation)
   - 2.1 [File map](#21-file-map)
   - 2.2 [The Mascot component API](#22-the-mascot-component-api)
   - 2.3 [State-machine inputs and the mapping tables](#23-state-machine-inputs-and-the-mapping-tables)
   - 2.4 [How lesson beats drive it](#24-how-lesson-beats-drive-it)
   - 2.5 [Narration and karaoke sync](#25-narration-and-karaoke-sync)
   - 2.6 [Home mascot](#26-home-mascot)
   - 2.7 [Tutor panel](#27-tutor-panel)
   - 2.8 [Onboarding tour (learner)](#28-onboarding-tour-learner)
   - 2.9 [Landing tour and guide](#29-landing-tour-and-guide)
   - 2.10 [Other call sites](#210-other-call-sites)
   - 2.11 [Motion preference and reduced motion](#211-motion-preference-and-reduced-motion)
   - 2.12 [SSR, hydration, wasm, CSP, caching](#212-ssr-hydration-wasm-csp-caching)
   - 2.13 [Accessibility and i18n keys](#213-accessibility-and-i18n-keys)
   - 2.14 [Tests](#214-tests)
3. [Conventions and gotchas](#3-conventions-and-gotchas)
4. [Recipes](#4-recipes)
5. [Gaps vs the original](#5-gaps-vs-the-original)
6. [Cat implementation (2026-10-21)](#6-cat-implementation-2026-10-21)
   - 6.6 [Storybook cat, acts, `auto` and the Home play card (2026-10-27)](#66-storybook-cat-acts-auto-and-the-home-play-card-2026-10-27)

---

## 1. What the original Cylosof did

Sources: `docs/audit/00-overview.md`, `docs/audit/02-learner-app.md`, `docs/audit/06-lesson-engine.md` §3 (the Rive map), `docs/audit/01-design-tokens.md` ("Hərəkət (motion)"), `docs/audit/05-landing.md`. The spec is Azerbaijani; quotes below are translated.

**Technology.** Rive animation served from the site's own origin: `/rive/rive.wasm` + `/rive/mascot.riv`, runtime `@rive-app/react-canvas` (00-overview "Texnologiya işarələri"; 06 §3). The file is preserved at `docs/audit/assets/mascot.riv` (250 KB) and is byte-identical (md5 `448e463b…`) to `portal/public/rive/mascot.riv`.

**Where it appeared.**
- Learner Home: next to "Hello, Rəşad / Take one step today." a Rive mascot rendered as a button, aria `Talk to the tutor`; clicking made it react and opened the voice tutor (02 §2, `screens/learner-home-01.jpg`, `learner-home-desktop.jpg`).
- Rail logo and the content shield: a static mascot logo (02 §1, `screens/content-shield.jpg`).
- Lesson intro: a large floating mascot with a shadow ellipse above the lesson title, module name, pills, `Start` / `Review again`, and "Turn the sound on to hear the tutor" (02 §4, `screens/lesson-intro.jpg`).
- Narration steps: illustration on the left, a small mascot plus step dots on the right, big text with word-by-word karaoke (`screens/lesson-01-intro-narration.jpg`, `lesson-step-narration.jpg`, `lesson-05-highlight-narration.jpg`). The mascot "points with its arm at an element on screen (e.g. the email address)" (06 §3, look/aim).
- Feedback sheet after a question: mascot, check icon, `Well done` (`screens/lesson-04-quiz-feedback-correct.jpg`).
- Mailbox simulation: a spoken tutor hint bubble and the Lens tool (`screens/lesson-06..10-mailbox-sim-*.jpg`, `lesson-09-mailbox-sim-lens.jpg`).
- "Ask" in the player top bar: a microphone button that put a voice question to the AI tutor with lesson context (02 §4 "Tutor (Ask)"; flags `ai_tutor`, `tutor_voice`).
- Landing: "not a classic marketing page but an interactive tour led by the mascot's voice" (05 §2). The mascot peeks from the hero phone's edge, idles with attract moves, nudges after 20 s, greets by time of day, remembers returning visitors, greets in the chosen language in the Languages chapter (05 §2 "Maskot davranışı", §3.1, §3.4; `screens/landing-hero-mobile.jpg`).

**CSS animations** (01 "Hərəkət"): `--animate-float: float 5s var(--ease-in-out-smooth) infinite` ("maskot üzür" / the mascot floats) and `--animate-blink: blink 4.8s linear infinite` ("maskot göz qırpır" / the mascot blinks), with keyframes `float` (translateY 0 → -4%) and `blink` (opacity dip to .15 at 95%).

**Motion options.** The player's "More options" dialog had a `Motion: Full | Calm | Still` segmented control, also under Profile → Motion (02 §4, §7, `screens/lesson-options-dialog.jpg`, `learner-profile-01.jpg`). The audit README notes `Full / Calm / Still` plus `prefers-reduced-motion` as "how the original did it".

**Beats, moods, gestures** (06 §2 "Beat"): `{ id, say, mood, gesture?, visual, highlight?, checkpoint?, stage? }`, `mood: talk | think | alert | happy | celebrate`, gesture one of `wave, point-left, point-right, point-down, recite, lean-in, shield-up, shake, shrug, nod`. `intro` scenes carry a `mood`; `recap` is `mood: celebrate`. Counts across the 106 lessons in `portal/content/library/lessons` (every `mood` field, scene-level and beat-level together; beats alone give think 100 and no celebrate): talk 129, alert 115, celebrate 106, think 101, happy 85; wave 86, point-left 83, recite 66, lean-in 55, shield-up 41, shake 30, shrug 11, nod 10, point-down 7, point-right 1.

**The Rive file itself** (06 §3): artboard **`Mascot`**, state machine **`Main`**, layers Breath, Blink, Life, Mood, Talk, Gesture, Topic, Act, Poke, LookX, LookY, Aim, Touch, React, Glass. Inputs listed by the audit: `mood, talking, bounce, gesture, gesture-play, idleAct, idle-play, wake, lookX, lookY, poke, pokeZone, topic, aimAngle, aimOn, aimHand, touch, travel, travelDir, depart, arrive, wait, listen, perch, whisper, knock, react, reactGo, peer, tap, trace`. Animations: 14 `mood_*`, 28 gestures (`gesture_rest` … `present`, with `recite_read`/`recite_close`), `talk_on/off` and `talkbody_0..3` (mouth and body by voice amplitude), idle acts `act_nap_in/loop/wake`, `act_apple`, `act_read`, `poke_head/face/body/antenna`, topic props `topic_*` (one per catalog category), `look_x_0..2`, `look_y_0..2`, `aim_R0…R330`, `aim_L90…L270`, guide poses `guide_rest/wait/listen/whisper/perch/travel_l/travel_r/depart/arrive`, `knock_R/L`, `tap_R/L`, `trace_R/L`, `touch_*`, `wipe_R/L`, `glass_rest/peer`, and particle effects Burst / AhaSpark / PokeSpark.

**Narration.** Pre-generated TTS clips keyed by the sentence text, with per-word timing (`/generated/tts/{locale}/{hash}.m4a`, 06 §1); the beat auto-advanced when the clip ended.

---

## 2. Current implementation

### 2.1 File map

| Path | Role |
|---|---|
| `portal/src/components/mascot/mascot.tsx` | The Rive wrapper: `Mascot` component, `angleBetween()`, `MascotAim`, `MascotGuide`, `MascotFire`, `MascotTrigger` types; reduced-motion store; pointer look/poke |
| `portal/src/components/mascot/mapping.ts` | Index tables for every numeric input: `MOOD_INDEX`, `GESTURE_INDEX`, `TOPIC_INDEX`, `ACT_INDEX`, `POKE_ZONE_INDEX`, `TRAVEL_DIR`, `AIM_HAND` and their types |
| `portal/public/rive/mascot.riv`, `rive.wasm`, `rive_fallback.wasm` | The asset and the runtime, served same-origin |
| `portal/src/components/player/scenes.tsx` | Beats → mascot (`TutorScene`, `ChoiceScene`, `FeedbackCard`, `SimulationScene` lens, `RecapScene`) |
| `portal/src/components/player/player.tsx` | Intro screen and done screen mascots, the Motion option dialog, `TutorPanel` mount |
| `portal/src/components/player/narrator.ts` | `useNarrator` (Web Speech), `wordsOf`, `speechText`: the `speaking` flag that drives `talking` |
| `portal/src/components/player/tutor-panel.tsx` | "Ask AI Sel" dialog with a thinking/listening mascot |
| `portal/src/components/learner/home-mascot.tsx` | Home greeting mascot: reactions, idle acts, opens the tutor |
| `portal/src/components/learner/tour.tsx` | Onboarding coach marks with a mascot per stop |
| `portal/src/components/site/guide.tsx` | `GuideProvider` / `useGuide`: the landing voice, captions, mood/gesture/pose/aim/fire/act state |
| `portal/src/components/site/landing-tour.tsx` | Hero mascot button, attract moves, nap, travel between chapters, `GuideDock` |
| `portal/src/components/site/scenes.tsx` | Landing chapters calling `guide.say(line, { gesture })` |
| `portal/src/components/site/teachable.tsx` | Teachable moment after a simulated phishing click (`alert` + `shield-up`) |
| `portal/src/app/(learner)/app/page.tsx` | Home (route `/app`): mounts `HomeMascot` with the viewer's motion/sound/feature flags |
| `portal/src/app/(learner)/layout.tsx` | Mounts `Tour` while `users.tourDone` is false |
| `portal/src/app/(focus)/learn/[slug]/[lessonId]/page.tsx` | Passes `topic={CATEGORY_TOPIC[m.category]}` and `motion={v.user.motion}` to the player |
| `portal/src/app/(public)/t/[token]/page.tsx`, `q/[token]/page.tsx` | Teachable-moment pages |
| `portal/src/app/layout.tsx` | `<html data-motion={viewer?.user.motion ?? "full"}>` |
| `portal/src/app/globals.css` | `--animate-float`, `--animate-blink`, `html[data-motion=…]` rules, `prefers-reduced-motion` |
| `portal/src/server/db/schema.ts` (line ~182) | `users.motion: "full" \| "calm" \| "still"` default `full` |
| `portal/src/server/actions/preferences.ts` | `setPreferencesAction({ motion })` (calls `refresh()` when motion changes) |
| `portal/src/server/auth/viewer.ts` | Exposes `user.motion`, `user.soundOn` to pages |
| `portal/src/app/(learner)/profile/profile-client.tsx` | Profile → Motion segmented control |
| `portal/src/lib/content/types.ts`, `validate.ts` | Content `Mood`/`Gesture` unions; beat schema (`gesture: z.string().optional()`) |
| `portal/src/lib/domain/catalog.ts` | `CATEGORY_TOPIC`: catalog category → Rive `topic` name |
| `portal/src/lib/landing.ts` | `Line` type (`emotion`, `voice`, `spoken`), `GuideTiming` |
| `portal/content/landing/{az,en,…}.json` | Landing copy under the top-level `copy` object: `copy.ui.captionLabel`, `copy.attract.idle[].move`, `copy.attract.tapPrompt`, `copy.attract.greetings`, `copy.rapport`; beside it `guide` (timings, e.g. `nudgeSeconds: 20`) and `mascot: { enabled, voice }` |
| `portal/src/proxy.ts`, `portal/next.config.ts`, `portal/public/sw.js` | CSP (`'wasm-unsafe-eval'`), `/rive/` passthrough and caching |
| `portal/messages/{locale}/player.json`, `learner.json` | UI strings naming AI Sel, the tour, the motion labels |
| `docs/build/PROGRESS.md` (line ~33), `docs/build/DECISIONS.md` ADR-007, ADR-008 | Input verification note; Web Speech now / TTS later; Claude tutor |

### 2.2 The Mascot component API

`portal/src/components/mascot/mascot.tsx` is a `"use client"` component built on `useRive` from `@rive-app/react-canvas` (package `^4.36.0`, installed 4.36.0 over `@rive-app/canvas` 2.44.0). Constants: `src: "/rive/mascot.riv"`, `artboard: "Mascot"`, `stateMachine: "Main"` (`const SM = "Main"`), `autoplay: true`, `Layout({ fit: Fit.Contain, alignment: Alignment.Center })`.

```ts
export function Mascot({
  mood = "idle", talking = false, gesture, gestureKey, topic, className, label,
  onPoke, still = false, aimAt, aim, act, guide, fire,
}: {
  mood?: MascotMood;                 // -> "mood" number input
  talking?: boolean;                 // -> "talking" bool
  gesture?: MascotGesture;           // -> "gesture" number + "gesture-play" trigger
  gestureKey?: string | number;      // change it to replay the same gesture
  topic?: MascotTopic;               // -> "topic" number (only set when given)
  className?: string; label?: string; onPoke?: () => void;
  still?: boolean;                   // true -> rive.pause(); false -> rive.play()
  aimAt?: { x: number; y: number } | null;  // -> lookX/lookY (1 + clamp(-1..1))
  aim?: MascotAim;                   // { angle, hand? } -> aimOn/aimAngle/aimHand; null lowers the hand
  act?: MascotAct;                   // "rest" | "nap" | "apple" | "read" -> idleAct + idle-play / wake
  guide?: MascotGuide;               // { wait, listen, perch, whisper, peer, trace, travel }
  fire?: MascotFire;                 // { name: MascotTrigger; key: number; zone?: MascotPokeZone }
})
```

Supporting exports from the same file:

```ts
export type MascotAim = { angle: number; hand?: MascotAimHand } | null;   // 0 = right, 90 = up
export type MascotGuide = { wait?; listen?; perch?; whisper?; peer?; trace?; travel?: MascotTravelDir | null };
export type MascotTrigger = "bounce" | "knock" | "touch" | "wipe" | "huff" | "tap" | "poke";
export type MascotFire = { name: MascotTrigger; key: number; zone?: MascotPokeZone };
export function angleBetween(from: Element, to: Element): number;       // centre-to-centre, anticlockwise degrees
```

Behaviour inside the wrapper:
- On load it reads `rive.stateMachineInputs("Main")` into a `Map<name, StateMachineInput>`; `set(name, value)` and `trigger(name)` look the input up by name and **silently do nothing when the file has no such input**.
- `aimHand` defaults to `"left"` when `90 < angle < 270`, else `"right"` ("the right hand covers R270..R90 through 0, the left hand L90..L270").
- `act`: writes `idleAct`, fires `idle-play` for anything but `rest`, and fires `wake` when leaving `nap`.
- `guide.travel`: sets `travelDir` + `travel=true` and fires `depart` when it starts; `travel=false` + `arrive` when it ends.
- `fire`: fires the named trigger on every change of `key` (and once on load if present); for `poke` it first writes `pokeZone` from `zone ?? "body"`.
- Pointer: `onPointerMove` on the canvas writes `lookX`/`lookY` (0..2) from the cursor position; `onPointerDown` picks a zone from the vertical fraction (antenna < 0.2, head < 0.45, face < 0.7, else body), fires `poke`, then calls `onPoke`.
- Renders `<div role="img" aria-label={label}>` when `label` is given, otherwise `aria-hidden` ("next to visible text it is decorative"), with a blurred shadow ellipse under the canvas.

### 2.3 State-machine inputs and the mapping tables

`portal/src/components/mascot/mapping.ts`. The header says the order was "verified against mascot.riv's animation list in the browser on 2026-10-19 (moods, topics and gestures; point-down precedes point-up)"; `docs/build/PROGRESS.md` line 33 records the same. The act / pokeZone / travelDir / aimHand tables are marked **inferred** from the animation order and not browser-verified.

| Input (type) | Values | Table |
|---|---|---|
| `mood` (number) | idle 0, talk 1, happy 2, think 3, alert 4, sad 5, celebrate 6, surprised 7, proud 8, curious 9, worried 10, excited 11, sleepy 12, laughing 13 | `MOOD_INDEX` |
| `gesture` (number) + `gesture-play` (trigger) | rest 0, point-left 1, point-right 2, point-down 3, point-up 4, wave 5, nod 6, shake 7, cheer 8, shrug 9, lean-in 10, shield-up 11, inspect 12, lecture 13, eureka 14, reassure 15, toss 16, bow 17, attention 18, recite 19, hop 20, facepalm 21, count 22, explain 23, tap-left 24, tap-right 25, ponder 26, present 27 | `GESTURE_INDEX` |
| `topic` (number) | none 0, email 1, identity 2, social 3, devices 4, data 5, physical 6, incident 7, ai-threats 8, work 9 | `TOPIC_INDEX` |
| `idleAct` (number) + `idle-play`, `wake` (triggers) | rest 0, nap 1, apple 2, read 3 (inferred) | `ACT_INDEX` |
| `pokeZone` (number) + `poke` (trigger) | rest 0, head 1, face 2, body 3, antenna 4 (inferred) | `POKE_ZONE_INDEX` |
| `travelDir` (number) + `travel` (bool), `depart`, `arrive` (triggers) | left 0, right 1 (inferred) | `TRAVEL_DIR` |
| `aimOn` (bool), `aimAngle` (number, degrees), `aimHand` (number) | right 0, left 1 (inferred) | `AIM_HAND` |
| `talking` (bool) | from `narrator.speaking` | — |
| `lookX`, `lookY` (number 0..2, 1 = straight) | `aimAt` prop or the pointer | — |
| `wait`, `listen`, `perch`, `whisper`, `peer`, `trace` (bool) | `guide` prop | — |
| one-shot triggers | `bounce`, `knock`, `touch`, `wipe`, `huff`, `tap`, `poke` | `MascotTrigger` |

Catalog category → topic (`portal/src/lib/domain/catalog.ts`, tested in `tests/domain.test.ts`): `accounts → identity`, `ai → ai-threats`, every other category keeps its own name.

### 2.4 How lesson beats drive it

`TutorScene` in `portal/src/components/player/scenes.tsx`:

```ts
const MOODS: Record<string, MascotMood> = { talk: "talk", think: "think", alert: "alert", happy: "happy", celebrate: "celebrate" };
// …
const mood: MascotMood = env.narrator.speaking ? MOODS[beat.mood] ?? "talk" : beat.mood === "celebrate" ? "celebrate" : "idle";
<Mascot mood={mood} talking={env.narrator.speaking} gesture={beat.gesture as MascotGesture | undefined}
        gestureKey={i} topic={env.topic as never} className="size-full" still={env.still}
        aim={aim?.beat === i ? { angle: aim.angle } : null} />
```

- The content mood is shown **only while the narrator speaks**; between beats the mascot drops to `idle` (except `celebrate`, which stays).
- `gestureKey={i}` (beat index) replays the gesture on every beat; the content `Gesture` union (10 names, `src/lib/content/types.ts`) is a subset of `MascotGesture` (28).
- `beat.highlight` (a `spot` id) makes the mascot **point at it**: `aimTowards()` finds `[data-spot="…"]` inside the scene host, computes `angleBetween(mascotBox, target)` in a `requestAnimationFrame`, and keeps the angle with its beat index so a new beat (or a vanished spot) lowers the hand.
- The mascot is hidden (`checked ? null : …`) while a checkpoint's feedback is open.
- `env.topic` comes from the lesson page: `topic={CATEGORY_TOPIC[m.category]}`; `env.still` is `motion === "still"`.

Other scenes: `ChoiceScene` shows `mood={speaking ? "talk" : "idle"}` with the topic prop; `FeedbackCard` shows `happy` + `cheer` for a safe answer, `alert` + `fire={{ name: "huff", key: 0 }}` otherwise, `talking={env.narrator.speaking}` (the simulation modal passes `mascot={false}`); `SimulationScene` renders a `curious` mascot with `guide={{ peer: true }}` next to the Lens button while the lens is out; `RecapScene` renders `celebrate` + `cheer` + `fire={{ name: "bounce", key: 0 }}`; the player intro is `happy` + `wave` (`gestureKey="intro"`, class `animate-float`, `size-52 sm:size-64`), the done screen `celebrate` + `cheer` (`gestureKey="done"`). `IntroScene` (scene type `intro`) renders **no** mascot.

### 2.5 Narration and karaoke sync

`useNarrator` (`portal/src/components/player/narrator.ts`) wraps the Web Speech API (ADR-007: "browser speech synthesis first, a TTS provider later; `speak()` can be replaced without UI changes"). `speak(text, { voice, lang, onWord, onEnd, onError })` fires `onWord(i)` from `onboundary` events, or from a 165-wpm estimate when the engine sends none; `speaking` is a React state flag. The `Karaoke` component in `scenes.tsx` paints words by `onWord`; the mascot only receives `talking={narrator.speaking}` (a boolean), so the `talkbody_0..3` amplitude animations in the .riv are never selected by code. With sound off `speak` returns at once, `onEnd` is not called and the learner continues by hand, so the mascot stays `idle` through silent beats (a `celebrate` beat stays `celebrate`). The same happens when the browser has no voice for the text's language (Azerbaijani in Chrome on Windows): a text is never read by another language's voice, `speak` calls `onError("language-unavailable")` instead, and the player treats the lesson as sound off with a `<VoiceNotice>` (lesson-engine.md §3.4).

### 2.6 Home mascot

`portal/src/components/learner/home-mascot.tsx`, mounted by `portal/src/app/(learner)/app/page.tsx` (Home, route `/app`):

```tsx
const tutorLesson = v.tenant.features.has("ai_tutor") && current ? nextLesson(current) : null;
const tutorRows = tutorLesson ? await db().select({ locale: schema.lessonContents.locale }).from(schema.lessonContents).where(eq(schema.lessonContents.lessonId, tutorLesson.id)) : [];
const tutor = current && tutorLesson ? { slug: current.slug, lessonKey: tutorLesson.key, contentLocale: pickLessonContent(tutorRows, locale)?.locale } : undefined;
// …
<HomeMascot label={tutor ? t("talk") : t("mascot")} still={v.user.motion === "still"} soundOn={v.user.soundOn}
  tutor={tutor} tutorVoice={v.tenant.features.has("tutor_voice")} />
```

> Since 2026-10-27 the page passes `motion={v.user.motion}` instead of `still`, and the mascot sits on a "Play with Sel" card; the cat's behaviour there is in §6.6. The tutor part below is unchanged.

- A `<button aria-label={label} aria-haspopup={tutor ? "dialog" : undefined}>` wraps the mascot (a `h-32 w-48 sm:h-36 sm:w-54` box on the card's track, so the engine has a stage wider than tall). `label` is `learner.home.talk` ("Talk to AI Sel") when the tutor is on, otherwise `learner.home.mascot` ("AI Sel, the Cyclowareness cat").
- `REACTIONS` cycle on each click: `happy/wave`, `excited/hop`, `proud/shield-up`, `laughing/cheer`, `curious/ponder`; the first (wave) plays 600 ms after mount (`tick`), so the server and first client render agree on `idle`.
- Idle life comes from the engine (`auto`, §6.6); the old `APPLE_MS`/`NAP_MS` timers are gone. With a tutor, a click plays the reaction and opens the dialog 600 ms later (`OPEN_DELAY_MS`; at once under Still); while the dialog is open the cat is still.
- A click also opens `TutorPanel` (when `tutor` is set) with `sceneId: null` and `contentLocale={tutor.contentLocale}`, the language of the lesson row the tutor route will pick (`pickLessonContent` over the next lesson's `lesson_contents` rows, computed by the page above). Answers are spoken through its own `useNarrator({ enabled: soundOn ?? true, rate: 1, lang: locale })` (only when `tutorVoice`, see 2.7), lent as `speak={(text, lang) => narrator.speak(text, { lang })}` like in the player: an AI answer is read with the UI language's voice, an offline one with the lesson row's (lesson-engine.md §3.4, recipe 6.9). Closing the panel calls `narrator.stop()`.

### 2.7 Tutor panel

`portal/src/components/player/tutor-panel.tsx` (`Dialog` titled `player.tutor.title` = "Ask AI Sel"): `<Mascot mood={state === "thinking" ? "think" : answer ? "happy" : "curious"} talking={speaking && state !== "thinking"} guide={{ listen: listening }} className="size-20 shrink-0" />` (`speaking` is the lending narrator's flag). `listening` is the Web Speech *recognition* state (mic button shown only when `voice` and the browser has `SpeechRecognition`). The answer streams from `POST /api/tutor` (ADR-008, Claude; `x-tutor-mode: offline` without a key or when the model fails before its first text) and is spoken via the `speak(text, lang)` prop when `voice` is on; in the player and on Home (2.6) that is the answer's language (UI language for AI answers, the lesson's for offline ones); without a voice for it the mascot does not talk and a `<VoiceNotice>` appears (lesson-engine.md §3.4, §4). No `still` prop is passed here.

### 2.8 Onboarding tour (learner)

`portal/src/components/learner/tour.tsx`, mounted by `(learner)/layout.tsx` while `!v.user.tourDone`, with `still={v.user.motion === "still"}`. Each stop carries a mood and gesture:

```ts
{ key: "welcome", anchor: null, mood: "happy", gesture: "wave" },
{ key: "home", anchor: "nav-home", mood: "talk", gesture: "point-left" },
{ key: "learn", anchor: "nav-learn", mood: "curious", gesture: "lecture" },
{ key: "league", anchor: "nav-league", mood: "excited", gesture: "cheer" },
{ key: "progress", anchor: "nav-progress", mood: "proud", gesture: "present" },
{ key: "profile", anchor: "nav-profile", mood: "talk", gesture: "explain" },
{ key: "streak", anchor: "streak", mood: "excited", gesture: "hop" },
{ key: "xp", anchor: "xp", mood: "happy", gesture: "count" },
{ key: "continue", anchor: "continue", scroll: "center", mood: "talk", gesture: "point-down" },
{ key: "path", anchor: "path", scroll: "start", mood: "proud", gesture: "reassure" },
```

The bubble renders `<Mascot mood={step.mood} gesture={still ? undefined : step.gesture} gestureKey={index} still={still} className="size-16" />` (decorative, no label; the text beside it is `aria-live="polite"`). Anchors are `data-tour="…"` attributes in the shell; stops whose anchor is off-screen are skipped. Scrolling uses `behavior: "auto"` when `still` or `prefers-reduced-motion`. Finishing calls `markTourDoneAction()`.

### 2.9 Landing tour and guide

`GuideProvider` (`portal/src/components/site/guide.tsx`) owns one narrator and one caption for the whole landing and exposes `useGuide()`:

```ts
type GuideApi = {
  say: (line: Line | Line[], opts?: { lang?; gesture?: MascotGesture; then?; whisper?; aim?; move?: GuideMove }) => void;
  stop; busy; quiet; setQuiet; caption; mood: MascotMood; talking: boolean;
  gesture: { name: MascotGesture; key: number } | null;
  pose: MascotGuide;      // wait = quiet, listen = caller line playing, whisper = whispered line, travel
  aim: MascotAim; fire: MascotFire | null; act: "rest" | "nap";
  move: (name: "bounce" | "knock" | "touch" | "tap") => void; setTravel; setAct; activated; memory; remember; forget;
};
const EMOTION_MOOD = { warm: "happy", curious: "curious", whisper: "think", excited: "excited", playful: "happy",
                       cheerful: "happy", serious: "alert", proud: "proud", concerned: "worried" };
```

`mood` is `EMOTION_MOOD[caption.line.emotion] ?? "talk"` while a caption is up, else `idle`; `say()` wakes a napping mascot. `landing-tour.tsx`:
- Hero: `<button ref={heroMascot} aria-label={copy.attract.tapPrompt}>` positioned against the phone, `<Mascot mood={guide.mood} talking gesture gestureKey guide={guide.pose} aim={guide.aim} fire act label={copy.ui.captionLabel} />` (`captionLabel` = "AI Sel says"). Hovering fires `move("touch")`; clicking repeats the caption or the greeting with `wave`.
- Attract moves from `attract.idle[].move` (`sayMove`): `look` → `aim` at `[data-spot="hero-phone"]` via `angleBetween`; `knock` → `knock` trigger; `whisper` → whisper pose; `hop` → `bounce`; `lean-in`, `ponder`, `wave` → gestures (`MOVE_GESTURE`). The nudge uses `move: "tap"`.
- Chapter entry says bridge/intro(/entry line: `phone.ring`, `demo.invite`)/prompt with `gesture: "present"`; chapter changes set `travel` right/left for `TRAVEL_MS = 700`; `NAP_MS = 120_000` of inactivity on the hero → `setAct("nap")`. The role pick (`onRole`) says `rapport.role[role]` with `point-down`, also here in `landing-tour.tsx`.
- `GuideDock` (bottom, off-hero) renders a second mascot (`size-20 sm:size-24`) beside the karaoke caption; the quiet toggle says `rapport.quietOn` with `reassure`.
- Chapter components in `site/scenes.tsx` pass gestures: `point-left` (first card hint), `cheer`/`shake` (right/wrong), `inspect` (next hints), `cheer`/`nod` (final score), `facepalm`/`cheer` (gave the code / not), `explain`, `wave` with `lang` (Languages), `present` (report), `point-up`/`shield-up` (cloud/on-prem), `bow` (demo sent).
No `still` prop reaches the landing mascots: there is no signed-in viewer, so only `prefers-reduced-motion` (and `data-motion` on `<html>`, which defaults to `full`) applies.

### 2.10 Other call sites

- `portal/src/components/site/teachable.tsx` (`(public)/t/[token]`, `q/[token]`): `<Mascot mood="alert" gesture="shield-up" gestureKey="teach" className="size-28" />`.
- The product mark (`portal/src/components/brand.tsx`) and the content shield (`portal/src/components/shell/protection.tsx`) use the static `/icons/icon.svg` "mascot shield", not Rive; the shield icon floats with `animate-float`.

### 2.11 Motion preference and reduced motion

- Stored per learner: `users.motion` enum `full | calm | still` (default `full`), exposed as `v.user.motion`, written by `setPreferencesAction({ motion })` from Profile (`profile-client.tsx`) and the player's "Lesson options" dialog (`OptionsMotion` in `player.tsx`). Both also set `document.documentElement.dataset.motion` immediately; the action calls `refresh()` so server pages re-render with the new value.
- `portal/src/app/layout.tsx` renders `<html data-motion={viewer?.user.motion ?? "full"}>`.
- `globals.css`: `html[data-motion="still"] *` forces 1 ms animations/transitions; `html[data-motion="calm"]` shortens `--duration-reveal`/`--duration-slow` and removes `.animate-float` / `.animate-blink`; `@media (prefers-reduced-motion: reduce)` mirrors "still".
- In the Rive wrapper, `const calm = useSyncExternalStore(subscribeMotion, readStill, () => false)` is **true when `data-motion === "still"` or the OS asks for reduced motion** (the variable is named `calm`, but it does not read the "calm" value). When true: `idleAct` is forced to `rest`, `travel` to `null`, and `fire` triggers are skipped. Breathing, blinking, moods, gestures and talking still play.
- The `still` prop (passed from `v.user.motion === "still"` on learner pages) pauses the whole Rive instance (`rive.pause()`), which freezes the frame; `tour.tsx` additionally drops the gesture when `still`.
- The "calm" preference therefore affects only CSS (no float/blink, shorter reveals), not the Rive inputs.

### 2.12 SSR, hydration, wasm, CSP, caching

- `Mascot` is a client component imported directly (no `dynamic(…, { ssr: false })` anywhere in `src`); `useRive` renders its canvas during SSR and loads the file after mount, inputs are written in effects once `rive` exists. Hydration-safe patterns used by callers: `HomeMascot` delays its first reaction by 600 ms; `useSyncExternalStore` server snapshots return `false`; the narration-speed store starts at 1×.
- Runtime: `RuntimeLoader.setWasmUrl("/rive/rive.wasm")` at module load; `Rive.suppressDeprecationWarnings = [DeprecationKeys.stateMachineInputs]` because the file uses classic inputs, not data-binding view models (PROGRESS.md: "Rive deprecation warnings" fixed 2026-10-19).
- CSP (`portal/src/proxy.ts` `csp()`): `script-src 'self' 'nonce-…' 'strict-dynamic' 'wasm-unsafe-eval'` ("lets the Rive runtime compile its WebAssembly"), `worker-src 'self' blob:`, `connect-src 'self'`. `/rive/` is in `PASSTHROUGH` (no CSP header, session or cookies, only HSTS). `next.config.ts` sets `Cache-Control: public, max-age=86400` for `/rive/:file*`; `public/sw.js` serves `/rive/` cache-first.
- `rive_fallback.wasm`: the runtime's default `RuntimeLoader.wasmFallbackURL` is the jsdelivr CDN copy, which the CSP blocks, so `mascot.tsx` calls `RuntimeLoader.setWasmFallbackUrl("/rive/rive_fallback.wasm")` right after `setWasmUrl` (added 2026-10-20). The fallback build is for browsers without wasm SIMD; it is not exercised by the dev browser, so a regression there is only visible in old browsers.
- No script copies the wasm from `node_modules/@rive-app/canvas/` into `public/rive/`; the two must be kept in step by hand after a package upgrade. On 2026-10-20 both `public/rive/rive.wasm` and `rive_fallback.wasm` were byte-identical (md5) to the files in `@rive-app/canvas` 2.44.0. After upgrading the package, copy both files again and compare checksums.
- Performance: every `<Mascot>` is its own canvas and Rive instance (home: one; player: one per scene plus one in an open `FeedbackCard`, remounted per scene because the scene wrapper is keyed by `scene.id`; landing: hero + dock; tour: one). There is no offscreen pausing (no IntersectionObserver in the wrapper); only `still` pauses.

### 2.13 Accessibility and i18n keys

- Standalone mascots carry `role="img"` + `aria-label` (`label` prop); mascots beside text are `aria-hidden`. Clickable mascots are wrapped in a `<button>` with its own `aria-label`.
- `messages/{locale}/learner.json`: `home.greeting` ("Hello, {name}"), `home.talk` ("Talk to AI Sel"), `home.mascot` ("AI Sel, the Cyclowareness cat", the label without a tutor), `profile.soundBody` ("AI Sel reads lessons aloud."), `profile.motion`, `profile.motionBody`, `profile.motionFull`, `profile.motionCalm`, `profile.motionStill`, `profile.tour`, `profile.tourReset`, `tour.label` ("Quick tour"), `tour.stepOf`, `tour.next`, `tour.back`, `tour.done`, `tour.skip`, `tour.steps.{welcome,home,learn,league,progress,profile,streak,xp,continue,path}.{title,body}`.
- `messages/{locale}/player.json`: `askLabel` ("Ask AI Sel a question"), `ask`, `soundHint` ("Turn the sound on to hear AI Sel"), `motion`, `options`, `tutor.{title,placeholder,empty,send,listen,listening,thinking,suggestions[],privacy,offline,error}`.
- Landing copy (`portal/content/landing/*.json`, 10 languages plus `site.json`, parity checked by `tests/landing.test.ts`), all under the top-level `copy` object: `ui.captionLabel`, `attract.tapPrompt`, `attract.greeting`, `attract.greetings.{morning,day,evening,night}`, `attract.idle[].{move,line}`, `attract.nudge`, `rapport.{returning,score,fast,role,quietOn}`, `tour.beats.{hero,phone,tutor,languages,admin,deploy,demo}`.

### 2.14 Tests

- `portal/tests/domain.test.ts`: `CATEGORY_TOPIC` covers every category and "renames accounts and ai for the mascot".
- `portal/tests/content.test.ts`: `lessonFileSchema` / `lessonIntegrityErrors` over the lesson library (beat `mood` and `gesture` are plain strings there).
- `portal/tests/landing.test.ts`: key parity of the landing copy across languages (`emotion`, `voice`, `spoken` optional).
- Nothing imports `mapping.ts` or renders `Mascot` in vitest; the index tables are only checked by eye in the browser.

---

## 3. Conventions and gotchas

- **Unknown inputs are silent no-ops.** `set()`/`trigger()` look names up in the map read from the file; a typo or an input the .riv lacks does nothing and logs nothing. `huff` and `wipe` are in `MascotTrigger` but missing from the audit's input list (06 §3); a scan of the binary on 2026-10-20 found the names `huff`, `wipe`, `wipeEnd`, `wipe_L`, `wipe_R` inside `mascot.riv`, together with every input name the code uses, so `FeedbackCard`'s `huff` on wrong answers is valid (whether `wipeEnd` is an input or an animation was not checked). `react` / `reactGo` exist in the file but have no code path.
- **Index order = animation order in the .riv.** Moods, topics and gestures were browser-verified on 2026-10-19 (`point-down` 3 before `point-up` 4); acts, poke zones, travel direction and aim hand are inferred. Re-verify after any .riv change (recipe 5).
- **Content gestures are not validated against `GESTURE_INDEX`.** `validate.ts` accepts any string; an unknown gesture becomes `GESTURE_INDEX[x] ?? 0` (rest) with a `gesture-play` trigger, and an unknown mood becomes `idle` between beats and `talk` while speaking. Keep `Gesture`/`Mood` in `src/lib/content/types.ts` and the `MOODS` map in `scenes.tsx` in step with `mapping.ts`.
- **`topic={… as never}` casts** in `player.tsx` and `scenes.tsx` bypass the `MascotTopic` type; the value is a `CATEGORY_TOPIC` string. A wrong string maps to `none`.
- **Replays need a changing key.** The same `gesture` or `fire.name` plays again only when `gestureKey` / `fire.key` changes; a constant `key: 0` fires once on mount (used deliberately in `FeedbackCard` and `RecapScene`).
- **`still` ≠ reduced-motion `calm`.** `still` (prop) pauses the canvas; the internal `calm` flag (still-or-OS) only suppresses acts, travel and triggers. Pass `still={v.user.motion === "still"}` from any signed-in page; public pages have no viewer.
- **"Calm" never reaches Rive.** Only CSS changes under `html[data-motion="calm"]`. If a task says "calm should slow the mascot", that is new behaviour (recipe 7).
- **Hydration.** Do not derive the first mood from `Date.now()`, `Math.random()` or storage during render; copy `HomeMascot`'s delayed `tick` or a `useSyncExternalStore` with a server snapshot. The landing's time-of-day greeting runs inside an effect for this reason.
- **Pointer handlers live on the canvas.** Hover already moves the eyes and a press fires `poke`; wrapping the mascot in a `<button>` adds the click, the `aria-label` and focus ring (`home-mascot.tsx`, `landing-tour.tsx`).
- **Same-origin only.** CSP forbids CDN scripts and wasm; keep `RuntimeLoader.setWasmUrl("/rive/rive.wasm")` and copy new runtime files into `public/rive/` by hand. `/rive/` is passthrough in `proxy.ts` and cached for a day; bump nothing, the service worker caches it cache-first (`public/sw.js`), so a changed `.riv` with the same name may need a hard reload during development.
- **Ten UI languages via the Edit tool** (`messages/{locale}`, ten languages); the tutor is **AI Sel** everywhere; landing copy lives in `portal/content/landing/*.json` for ten languages and `tests/landing.test.ts` fails on a missing key.
- **`docs/audit/` is read-only**; `docs/audit/assets/mascot.riv` is the reference copy of the asset.
- `--animate-blink` is defined in `globals.css` and cleared under "calm", but no component applies `.animate-blink`: blinking comes from the .riv's Blink layer. `.animate-float` is applied to the home and intro mascots, the content-shield icon and the main glyph of lesson illustrations (`player/illustrations.tsx`).
- Azerbaijani dates and numbers: never format with `Intl` on the client, use `useClientFormat()` (ADR-017, ADR-024; SKILL.md ground rules); not a mascot concern unless a caption shows a date or a number.

---

## 4. Recipes

### 4.1 Add a new mood or gesture

1. Confirm the .riv has the animation and the `Main` state machine routes the new index to it (ask the designer for the new animation list, or read it with recipe 5). Code cannot add animations.
2. `portal/src/components/mascot/mapping.ts`: extend `MascotMood`/`MascotGesture` and insert the name into `MOOD_INDEX`/`GESTURE_INDEX` **at its position in the animation list** (numbers must stay contiguous; a new animation appended at the end gets the next number).
3. If lesson content may use it: extend `Mood`/`Gesture` in `portal/src/lib/content/types.ts`; for a mood also add it to `MOODS` in `portal/src/components/player/scenes.tsx` (and `EMOTION_MOOD` in `site/guide.tsx` if a landing emotion should map to it).
4. Use it in lesson JSON under `portal/content/library/lessons/` (`beats[].mood`, `beats[].gesture`) or in a call site.
5. Run `npx vitest run tests/content.test.ts tests/domain.test.ts` from `portal/`, then open a lesson that uses it on the dev server (port 3000) and watch the Rive canvas; also check `still` and OS reduced motion.

### 4.2 Make the mascot react to a new event (quiz result, streak, level-up)

1. Pick the call site: home (`home-mascot.tsx`), player scene (`scenes.tsx`), done screen (`player.tsx` `DoneScreen`), tour (`tour.tsx`) or landing (`site/scenes.tsx` via `guide.say`).
2. For a one-shot move use `fire={{ name, key }}` with a counter in state (copy `move()` in `guide.tsx`: `setFire(f => ({ name, key: (f?.key ?? 0) + 1 }))`); for a pose use `mood` + `gesture` + a changing `gestureKey`. Only names from `MascotTrigger` / `mapping.ts`.
3. Server data (streak, XP) reaches the mascot as props from the server page, e.g. extend `HomeMascot`'s props in `portal/src/app/(learner)/app/page.tsx` (`liveStreak`, `levelFor` are already computed there) and add a `REACTIONS` entry or a dedicated effect.
4. Respect `still` (acts/triggers already stop under reduced motion; pause-level stillness needs the prop) and `soundOn` for any spoken line (recipe 6).
5. Strings go into `messages/{locale}/*.json`; verify in az, en, ru and ar (right to left) at 375 px.

### 4.3 Place the mascot on a new page

1. In a `"use client"` component: `import { Mascot } from "@/components/mascot/mascot"`; set the size with `className="size-24"` (the canvas fills its box; add `animate-float` for a hero pose).
2. From the server page pass `still={v.user.motion === "still"}` (learner/admin pages have `requireViewer()`); public pages cannot, so keep the placement decorative there.
3. Give `label` (and `role="img"`) only when the mascot stands alone; beside text leave it unlabelled. Wrap in `<button aria-label>` if it should open something.
4. Pass `topic` when the page is about one catalog category (`CATEGORY_TOPIC[category]`).
5. No CSP or header changes are needed. Check SSR output has no hydration warning, then the page in az, en, ru and ar.

### 4.4 Change idle behaviour

- Home (cat): the engine's `auto` scheduler (`mascotAutoWeights` in `cat/engine.js`) and the dash across the card, `FIRST_RUN_MS` (60 s + up to 30 s) then `RUN_GAP_MS` (180 s + up to 120 s) in `home-mascot.tsx` (§6.6). The Rive-era `APPLE_MS`/`NAP_MS` timers are gone.
- Landing nap: `NAP_MS` (120 s) in `landing-tour.tsx` (hero only); any activity sets `act` back to `rest`; `say()` also wakes it.
- Available acts: `rest | nap | apple | read` for Rive (`ACT_INDEX`); the cat also takes `sleep, stretch, groom, knead, play-mouse, play-yarn, laser, chase-tail, roll, run` (`ACT_TO_CAT`, §6.6). Leaving `nap` fires `wake` automatically.
- The walk between landing chapters: `TRAVEL_MS` (700 ms) and `setTravel("left" | "right")`.
- Reduced motion forces `rest`; keep it that way.

### 4.5 Swap the .riv file and re-discover inputs

1. Put the new file at `portal/public/rive/mascot.riv` (keep the name, or change `src` in `mascot.tsx`). Keep the artboard `Mascot` and state machine `Main`, or update the `artboard` option and `SM`.
2. Read the file's structure in the browser (this is how the 2026-10-19 verification was done): on any page with a mascot, temporarily add to the `useEffect([rive])` in `mascot.tsx`
   ```ts
   console.table(rive.stateMachineInputs("Main")?.map((i) => ({ name: i.name, type: i.type })));
   console.log(rive.stateMachineNames, rive.animationNames);
   ```
   `animationNames` gives the ordered list that the number inputs index into; `stateMachineInputs` gives names and types (number/bool/trigger). Remove the logging afterwards.
   Without a browser you can at least list the names present in the file (inputs, animations, artboards, effects, unordered): scan the binary for ASCII identifiers, e.g. `python -X utf8 -I -c "import re,sys;print(sorted(set(m.decode() for m in re.findall(rb'[A-Za-z][A-Za-z0-9_\-]{2,24}', open(sys.argv[1],'rb').read()))))" public/rive/mascot.riv`. That confirms whether a name exists; only the browser gives order and type.
3. Rewrite the tables in `mapping.ts` to the new order and update its header comment (date, what was verified vs inferred); extend `MascotTrigger`, `MascotGuide` and the effects in `mascot.tsx` for new inputs.
4. Hard-reload (the service worker and the 1-day cache keep the old file), check the home mascot, a tutor beat with a `highlight`, the recap, the tour and the landing hero.
5. Do not copy the new file into `docs/audit/assets/`; note the change in `docs/build/PROGRESS.md`.

### 4.6 Give the mascot a voice line

- In the learner app: get `const narrator = useNarrator({ enabled: soundOn, rate: 1, lang: locale })` (or reuse `env.narrator` inside a scene), call `narrator.speak(text, { onWord, onEnd })` from an effect or handler, and pass `talking={narrator.speaking}` to the mascot. The text comes from `messages/{locale}` (UI) or from lesson JSON (`say`); `soundOn` is `v.user.soundOn`. Pick `mood` to match (e.g. `talk`). Speak a text in its own language: UI strings with the UI locale (`{ lang: env.uiLocale }` inside a scene), lesson text with the lesson's (`p.contentLocale`, the player narrator's default). Without a voice for that language nothing is spoken and `onEnd` never fires, so do not wait on it; show `<VoiceNotice lang>` (`src/components/player/voice-notice.tsx`) where silence would puzzle the learner (lesson-engine.md §3.4).
- On the landing: add a `Line` (`{ id, text, emotion?, voice?, spoken? }`) to every `portal/content/landing/*.json` and call `guide.say(line, { gesture, move, whisper, aim, lang })`; `emotion` drives the mood through `EMOTION_MOOD`, `voice: "caller"` makes the mascot `listen`.
- Tutor answers are spoken by the `speak` prop of `TutorPanel` only when `tutorVoice` (`tutor_voice` feature) is on.
- Test: `npx vitest run tests/landing.test.ts` for landing copy; manual listening for the rest (Web Speech output cannot be unit-tested).

### 4.7 Tune motion for calm / still

- CSS: `html[data-motion="calm"]` and `html[data-motion="still"]` blocks in `portal/src/app/globals.css`.
- Rive under "still": `still` prop → `rive.pause()`; under still-or-OS reduced motion: `readStill()` in `mascot.tsx` disables acts, travel and triggers. To make "calm" also soften Rive (e.g. no acts), extend `readStill()` to read `dataset.motion === "calm"` for a separate flag, or add a `calm` prop; today nothing reads "calm" in the wrapper.
- Keep `document.documentElement.dataset.motion = m` in both pickers (`profile-client.tsx`, `player.tsx`) so the change is instant before `refresh()`.
- Test by setting `data-motion` on `<html>` in devtools and by toggling the OS reduced-motion setting; there is no automated test.

---

## 5. Gaps vs the original

- **Voice.** The original played pre-generated TTS clips with per-word timing (06 §1); the portal now has the same pipeline (ElevenLabs clips, ADR-028, lesson-engine.md recipe 6.6) but no clip is generated yet, so the browser's Web Speech API reads everything, with estimated timing when no boundaries arrive (ADR-007). Consequences: voice quality and `az` support depend on the visitor's OS voices (without an Azerbaijani voice the az lessons and answers stay silent and the mascot does not talk, since no text is read by another language's voice); the `talkbody_0..3` amplitude animations are never driven (only the `talking` bool).
- **Intro scenes.** The spec's `intro` scene has a `mood`; `IntroScene` renders no mascot, so that mood is ignored.
- **Pointing.** The original mascot pointed at on-screen elements during narration; the portal does this only in `TutorScene` for `beat.highlight` spots. Choice, hotspot and simulation scenes do not aim.
- **Unused inputs.** `react`/`reactGo`, `perch`, `trace`, `wipe`, the `read` act, `tap-left`/`tap-right`/`toss`/`eureka`/`attention` gestures and the `sad`/`surprised`/`sleepy` moods have no code path. The particle effects (Burst / AhaSpark / PokeSpark) are whatever the state machine does on its own; nothing triggers them explicitly (verify).
- **Inferred tables.** Acts, poke zones, travel direction and aim hand indices are inferred, not browser-verified.
- **"Calm" and the mascot.** The original offered Full/Calm/Still; what "calm" did to the mascot is not recorded in the audit, and here it changes only CSS.
- **Public pages.** Landing and teachable-moment mascots cannot honour a learner's `still` preference (no viewer); only OS reduced motion applies.
- **Fallback runtime.** Closed on 2026-10-20: `mascot.tsx` now calls `RuntimeLoader.setWasmFallbackUrl("/rive/rive_fallback.wasm")` next to `setWasmUrl`, so browsers without wasm SIMD load the local fallback instead of the CSP-blocked CDN copy. Keep both files in step with the package (section 2.12).
- **Tests.** No vitest covers `mapping.ts` or the wrapper; the original's behaviour was observed, not tested, so this is parity, but a table-shape test (contiguous indices, names ⊂ a recorded animation list) would catch the next `.riv` swap.
- **Performance.** No offscreen pausing; the player remounts a canvas per scene.
- **Rail logo / shield.** The original used the mascot logo in the rail and the content shield; the portal uses the static shield SVG (`/icons/icon.svg`), which matches the spec's "mascot logo" but is not the Rive character.
- **Home "Talk to the tutor".** The original opened a voice tutor directly; the portal opens the text-plus-mic `TutorPanel` (voice only with `tutor_voice`), scoped to the current module's next lesson.

---

## 6. Cat implementation (2026-10-21)

Since 2026-10-21 AI Sel is drawn as the owner's grey tabby-and-white cat on every placement (the owner asked to see the cat everywhere before deciding; OPEN-QUESTIONS 21, ADR-022). Sections 1–5 describe the Rive robot, which is kept and comes back with a one-line change. The `Mascot` props, the call sites and the persona name ("AI Sel") are the same; the cat adds one optional prop, `facing`.

### 6.1 File map

| Path | Role |
|---|---|
| `portal/src/components/mascot/mascot.tsx` | The switch: one line, `export { Mascot, angleBetween, type MascotAim, … } from "./cat-mascot"` |
| `portal/src/components/mascot/cat-mascot.tsx` | The cat wrapper: same props as Rive plus `facing`; creates the engine on its inner host div after mount (static import), maps props in effects, destroys it on unmount |
| `portal/src/components/mascot/cat/engine.js` | The Canvas 2D rig, vendored from `design/mascot-cat/source/p2.js + p3.js + p4.js` without the demo page wiring; its header lists every integration change. Excluded from ESLint (`portal/eslint.config.mjs`) |
| `portal/src/components/mascot/cat/engine.d.ts` | Hand-written types of the public API (`createCat`, `CatInstance`, mood / gesture / behaviour names) |
| `portal/src/components/mascot/cat/props.ts` | Pure tables and functions from the Rive props to the engine (`MOOD_TO_CAT`, `GESTURE_TO_CAT`, `ACT_TO_CAT`, `FIRE_TO_CAT`, `aimGesture`, `heldGesture`, `lookDirection`, `fireDue`, `HOPS`, keyframes) |
| `portal/src/components/mascot/rive-mascot.tsx` | The Rive wrapper as it was (it also accepts `facing` and ignores it, so both share one API) |
| `portal/src/components/mascot/mapping.ts` | Unchanged: the prop unions both wrappers use |
| `portal/tests/mascot-cat.test.ts` | The mapping, `fireDue`, the hop keyframes, and that the engine imports without a DOM |
| `portal/src/components/learner/home-mascot.tsx`, `home-play.ts` | The Home "Play with Sel" card (§6.6); `runPlan`/`runKeyframes` (the dash) are pure and tested in `portal/tests/home-play.test.ts` |
| `design/mascot-cat/source/` → `sh source/build.sh` → `final.html` | The design source of truth (README there lists the API) |

### 6.2 Prop → engine

| Prop | Engine call |
|---|---|
| `mood` | `setMood(same name)`; the 14 names are identical. `guide.listen` shows `curious` |
| `talking`, `guide.whisper` | `setTalking(on, whisper ? 0.45 : 1)` (mouth level) |
| `gesture` + `gestureKey` | `play(GESTURE_TO_CAT[g])` on mount and on every key change. 28 names on 12 gestures: lecture/explain/present/tap-right → point-right, tap-left → point-left, point-up/wave → wave, hop/eureka/cheer → cheer, inspect → lean-in, ponder → think, recite/count/attention/reassure/nod → nod, facepalm → shake, toss → shrug, rest → nothing. `hop` also jumps the whole cat (host `animate()`, 560 ms) |
| `aim` `{ angle }` | `hold(point-down \| point-left \| point-right)` (225° < a < 315° down, 90° < a ≤ 225° left, else right; no upward point) and `lookToward(cos a, −sin a)`; `null` lowers the paw |
| `guide.peer`, `guide.listen` | `hold("lean-in")` |
| `guide.travel` | a sideways hop of the host (520 ms) and a look to that side (no walk) |
| `act` | `do()` through `ACT_TO_CAT`: rest → present, nap → sleep, apple → groom, read → look, and the cat's own acts by name (play-mouse → mouse, play-yarn → yarn, stretch, groom, knead, laser, chase-tail, roll, run, sleep); none while motion is off, under Calm only the quiet ones (`actAllowed`) |
| `auto` (cat only) | `setAuto(on)`: the engine's own idle scheduler for decorative placements (§6.6); turning it off sends a cat busy with an auto act back to `present` |
| `onCat` (cat only) | receives the `CatInstance` once it runs (null when destroyed), for hosts that call `jump()`, `run()`, `play(toy)` or `laser()` directly |
| `fire` `{ name, key }` | bounce → host hop, huff → shake, poke / touch → `poke()` (head tilt, purr, hearts), knock / tap → point-down, wipe → groom. Fires on every key change; on first sight only `key: 0` fires (`fireDue`), so a remounted mascot does not replay an old move |
| `aimAt` | `lookToward(x, y)` |
| `still`, `html[data-motion=still]`, OS reduced motion | `setStill(true)`: a still frame with blinks; the mood, a held gesture (the point) and the look direction are kept as one static pose |
| `facing` | `createCat({ facing })`: "left" mirrors the drawing; points still follow the screen side. Fixed per instance (a change re-creates the cat). Used by the landing hero (faces the phone) |
| `label`, `onPoke`, `className` | on the wrapper div (`role="img"` + `aria-label` only with a label); a press on the box also pets the cat (the engine listens on its host div) |
| `topic`, `aim.hand`, `fire.zone`, `guide.wait` / `perch` / `trace` | accepted, ignored (the cat has no topic props or poke zones) |

Engine rules worth knowing (all in `engine.js`): a held point replaces a running point at once (cross-faded over 0.3 s, already at its peak), and `play()` of a point while a point is held returns false, so a beat's own `point-*` gesture never points away from its `highlight`; any other one-shot gesture interrupts a held pose, which comes back when it ends; while a point is held with a look direction, the pointer does not pull the eyes away; no slow "cat kiss" blink while a gesture is held or the cat talks; every new gesture cross-fades from the one it replaces. Framing: below 80 px the cat is a head-and-collar crop (`bust`), below 72 px a simplified drawing (`lod`), below 130 px it draws at 30 fps (20 fps while only idling), sleeps between frames and drops the "mrr…" text bubble (hearts only). One shared `requestAnimationFrame` loop; an IntersectionObserver pauses offscreen cats; still cats redraw only on change.

### 6.3 Switching back to Rive

1. `portal/src/components/mascot/mascot.tsx`: change `"./cat-mascot"` to `"./rive-mascot"` (and the comment). Nothing imports `cat-mascot.tsx` or the engine otherwise, so the cat leaves the bundle.
2. `npx tsc --noEmit` then fails on the two cat-only props: `auto` (brand panel, security overview, Home card, landing scroll cat) and `onCat` (Home card, scroll cat). Add them to `rive-mascot.tsx` as accepted and ignored props (as `facing` already is), or drop them at those call sites; the Home card's toys, laser and dash need the cat and should be hidden for Rive. `/rive/` assets, the wasm CSP and the cache rules were never removed.
3. Call-site changes made for the cat that are harmless with Rive but can be reverted: the rounded tiles around the FeedbackCard and Lens mascots (`scenes.tsx`), the 80 px tour mascot with `aim` (`tour.tsx`), the hero's `facing="left"`, `pointer-events-none` button and body hit area (`landing-tour.tsx`), the tutor panel's `speaking` prop, the delayed tutor dialog and `still={still || open}` on Home (`home-mascot.tsx`). Keep `tests/mascot-cat.test.ts` or delete it with `cat/`.

### 6.4 Gotchas

- **The engine is a hand port.** Change drawing, poses or gestures in `design/mascot-cat/source`, rebuild `final.html` (`sh source/build.sh`), then make the same edit in `cat/engine.js` (2026-10-21: the cross-body point reaching out past the body, mirror-aware points, the thought-dot halo were changed in both). Integration-only changes (`hold`, `lookToward`, still pose, frame scheduling, fx clamping) exist only in the port; its header lists them.
- **No side effects at module load.** The engine is imported statically and evaluated during SSR; browser globals start with the first `createCat`. `tests/mascot-cat.test.ts` imports it in Node and fails if that breaks.
- **Small boxes.** Below 80 px only the head and collar show, cut flat at the box edges; give such a mascot the design's tile (`overflow-hidden rounded-md bg-surface ring-1 ring-line`, as FeedbackCard and the Lens do) or make it at least `size-20` (the tour). Arm gestures are invisible in the crop.
- **Pointing has three directions.** Left, right, down; a target above is pointed at sideways. On a right-facing cat, point-left is the near paw reaching across the chest; for a placement that always points one way, `facing` can turn the cat toward it.
- **Content gesture first, then the aim.** A tutor beat's own gesture plays on mount and its `aim` arrives a frame later: a point gives way at once; other gestures (wave 1.9 s, cheer 1.8 s) finish first.
- **Motion off is a still frame**, unlike Rive (which only stopped acts, travel and triggers): no gestures, talking or acts, but the mood, the held point and the look stay visible.
- **One canvas per `Mascot`.** The Home cat goes still while its tutor dialog is open; a hidden (`display: none`) or offscreen cat costs nothing.
- **Fire keys.** Use `key: 0` for a move that should play on mount; counters that start at 1 only fire on later changes.
- **Hit areas.** The landing hero button is `pointer-events-none` with a span over the cat's body (`inset-x-[22%] inset-y-[6%]`), so the box's transparent strip does not cover the phone's "open" button; hover and tap on the span still reach the button.
- **Close-up checks.** Engine poses can be checked without the app: serve `cat/engine.js` to a blank page (e.g. Playwright `page.route`), `createCat(div, { mode: "mascot" })`, then `hold()`, `setMood()`, `setStill()` and screenshot. In the app, `canvas.parentElement.catInstance` exposes the instance (`cur.name`, `mood`, `gest`, `holdName`, `lookDir`, `still`, `bust`, `cap`).

### 6.5 Additions after the first port (2026-10-21, later)

- **Pointer catching (mascot mode).** One shared `pointermove`/`pointerdown` listener drives every cat. A pointer inside about 1.5x the box makes the cat watch it (head, pupils, ears forward). Within paw reach it bats with the near paw, a fast pass triggers a quick swipe, and a resting pointer gets a stare and then a pounce. A click or tap still pets it. Catching is suppressed while a narration gesture is held or the cat talks; under still or reduced motion only the eyes follow. Details in `design/mascot-cat/README.md`.
- **Jump.** `cat.jump({ dir, hang, onTakeoff, onLand, onDone })` (also `cat.do('jump', ...)`): crouch, takeoff, airborne tuck for `hang` ms, landing squash, settle. The container moves the cat along its arc between `onTakeoff` and `onLand`. `renderAt('jump', t, { dir })` gives deterministic frames.
- **Landing scroll cat.** `src/components/site/scroll-cat.tsx` with perch maths in `src/components/site/perch.ts`: one fixed-position cat sits on perches (headings, cards, the phone mockup, marked with data attributes on the landing page) and jumps from perch to perch as the visitor scrolls, back up when scrolling up; where no perch fits without covering text it rides off screen and drops back in. Reduced motion fades instead of jumping. It replaces the separate dock cat; the narration caption dock stays.
- **Tail.** The sitting tail now sways as one smooth S-curve with follow-through; to make the whole tail sweep more, raise `tailRoot` and `tailWave` in the SIT pose.
- **Static brand mark.** `public/icons/icon.svg` is now a cat head (old robot kept as `icon-robot.svg`); favicon, PWA and Apple icons were regenerated from it.

### 6.6 Storybook cat, acts, `auto` and the Home play card (2026-10-27)

ADR-031. The owner asked for a warmer, storybook look, many more acts and a cat to play with on Home.

- **Art.** `cat/engine.js` (and `design/mascot-cat/source`) got the storybook redraw and better joints;
  the API stayed the same. Same rule as before: change the design source first, then the port (§6.4).
- **New behaviours** (`CatBehaviour` in `cat/engine.d.ts`, started with `do()`): `doze` (a loaf doze),
  `blink` (a slow "cat kiss"), `tilt` (a curious head tilt), `stretch` (front stretch with a yawn, then
  the back), `roll` (on its back, paws up), `chase-tail`, `pounce` (stalk, leap, peek under the paw, lick),
  `knead` (treads a little blanket in a box of 80 px or more), the toys `mouse` and `yarn` (also
  `play("mouse" | "yarn")`), `laser` (see `laser(target)`) and `run` (see `run({ dir, distancePx })`).
  Roomy acts are framed to their box: side-on with room to move in a box wider than tall, a compact
  3/4 version in a square box; a bust (below 80 px) gets no body acts.
- **Motion.** `actAllowed(name, motion)`: under Still (the prop, `data-motion=still` or OS reduced
  motion) the lively acts (`stretch, run, mouse, yarn, laser, chase-tail, roll, pounce`) do not start
  (`do()` returns false); under Calm only the laser, which then watches and crouches but never wiggles or
  pounces. A still cat's `laser()` moves only the eyes; `run()` and `jump()` return zero times and the host
  moves the box without an arc.
- **`auto` (decorative placements only).** `<Mascot auto>` calls `setAuto(true)`: the engine picks idle
  acts itself with `mascotAutoWeights({ calm, stage, bust, idle })`. Full: present, blink, look, flick,
  tilt, groom, yawn, knead, plus stretch, pounce, chase-tail, roll when not a bust, plus the toys on a
  stage box, plus sleep and doze after 90 s with nobody near. Calm: present, blink, groom, knead (sleep
  and doze when tired). Talking stops an auto act (`AUTO_ACTS` in `cat-mascot.tsx`); turning `auto` off
  brings the cat back to `present`. Placements with `auto`: the sign-in brand panel, the security
  overview, the Home card, and the landing scroll cat while the guide is idle and not talking or
  aiming. Never on narration placements (player, tours, tutor panel): their acts come from the content.
- **Home "Play with Sel" card** (`src/components/learner/home-mascot.tsx`, keys `learner.home.play`,
  `playMouse`, `playYarn`, `playLaser`, `laserHint`): three toy buttons over the card, shown and working
  under Full motion only. Mouse and yarn call `play(toy)`. The laser is a toggle (`aria-pressed`, hint by
  `aria-describedby`) for this visit only: pointer moves over the card, or a tap, feed
  `laser({ x, y })` in the cat's box coordinates and draw a red dot (placed with `inset-inline-start`, so it
  works right to left); a mouse leaving the card hides the dot (`laser(null)`), a finger's dot stays where
  it tapped; Escape turns the laser off. Now and then (first after 60–90 s, then every 3–5 min; card on screen, tab visible, cat
  sitting in `present`, no laser, no dialog) the cat dashes to the card's other side: `runPlan` (side and
  distance from the track and box rects) → `cat.run(plan)` → the box is moved with
  `animate(runKeyframes(run))`, then the box's side flips. A click plays the next reaction and opens the
  tutor (if any); the cat is still while the dialog is open.
- **API additions.** `auto` and `onCat` on `Mascot` (cat wrapper only, see §6.3), `ACT_TO_CAT` entries
  for the new acts (`MascotAct` in `mapping.ts` lists them, so `ACT_INDEX` maps them for Rive too),
  `CatInstance.play(toy)`, `laser()`, `run()`, `setAuto()`, `getAuto()`, and the pure helpers
  `mascotAutoWeights`, `actAllowed`, `laserState`/`laserStep`, `runProgress`, `toyX`, `GAITS`, `LEAP`,
  `leapProg`, `leapLift`, `planLeg` (tested in `tests/mascot-cat.test.ts`).
- **Rule of thumb.** A new decorative placement passes `auto` and the viewer's motion (`still` prop or
  `useMotion()`); a placement that narrates leaves `auto` off and drives `mood`, `gesture`, `talking`
  and `aim` itself.
