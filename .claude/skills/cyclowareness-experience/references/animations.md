# Animations and motion

Everything that moves in the original cylosof.com admin panel, learner app, lesson player and landing,
and how the Cyclowareness portal (`portal/`) implements each of it. Paths below are relative to
`portal/` unless they start with `docs/`. "(verify)" marks a claim the spec or code does not settle.

## Contents

1. [Original animation catalogue](#1-original-animation-catalogue)
2. [Motion token system in the portal](#2-motion-token-system-in-the-portal)
3. [Motion preference and reduced motion](#3-motion-preference-and-reduced-motion)
4. [Implementation map](#4-implementation-map)
5. [Conventions and gotchas](#5-conventions-and-gotchas)
6. [Recipes](#6-recipes)
7. [Gaps vs the original](#7-gaps-vs-the-original)

Stack facts first, because they shape everything else:

- **No JS animation library.** `package.json` has no framer-motion / motion; the only animation
  dependency is `@rive-app/react-canvas` for the mascot. All other motion is CSS (Tailwind v4
  utilities, `@keyframes` in `src/app/globals.css`, a few inline `style` transforms) plus small
  `requestAnimationFrame` / `setTimeout` helpers. `docs/audit/README.md` (table "Animasiya") says the
  original used Rive + CSS keyframes + Motion (Framer) for page and element transitions; the portal
  deliberately does the same with CSS only.
- The spec's motion section is `docs/audit/01-design-tokens.md` → "Hərəkət (motion)". It is copied
  1:1 into `globals.css` (ADR-010 in `docs/build/DECISIONS.md`); there is no ADR about motion itself.

## 1. Original animation catalogue

Source column: `01` = `docs/audit/01-design-tokens.md`, `02` = `02-learner-app.md`, `03` = `03-admin-panel.md`,
`04` = `04-training-catalog.md`, `05` = `05-landing.md`, `06` = `06-lesson-engine.md`; screenshots are in
`docs/audit/screens/`. Where the spec gives no duration, the column says "not stated".

### Admin shell

| # | Where | What moves | Timing (spec) | Source |
|---|---|---|---|---|
| A1 | Sidebar nav item | Active item is a brand-50 pill with brand text/icon (as the learner rail, 02 §1); hover state not stated | not stated | 03 "Admin qabığı", 02 §1, `admin-overview-01.jpg` |
| A2 | Mobile "Open menu" drawer | Drawer opens over the page (side not stated) | not stated | 03 |
| A3 | Account menu (⌃⌄ on user card) | Menu on the user card at the sidebar foot; open direction not stated (verify) | not stated | 03 |
| A4 | Page load | Skeleton blocks: `sunken` colour, `radius-xl`, shimmer sweep | `--animate-shimmer: shimmer 1.6s var(--ease-in-out-smooth) infinite` | 01, 02 §1, `admin-skeleton-loading.jpg` |
| A5 | Any page content | Blur-to-clear reveal on open (stated for learner `(learner)/template`, and for catalog load) | `--duration-reveal: .72s`, `--ease-out-expo` | 02 §1, 04 line "Yükləmədə bulanıqdan aydına" |

### Overview (`/admin`)

| # | Where | What moves | Timing (spec) | Source |
|---|---|---|---|---|
| O1 | KPI tiles (Average risk, Completion, Learners, Active in 7 days, Report rate) | "Rəqəmlər 0-dan sayma animasiyası ilə qalxır" — numbers count up from 0 | not stated | 03 §1, `admin-overview-02-kpis.jpg` |
| O2 | Area/line charts (risk, completion, report rate) | Brand-coloured area, value label on the last point, hidden `Date | Value` table; the spec does not say the line draws in (verify) | — | 03 §1, `admin-overview-03-charts.jpg` |
| O3 | Setup guide ring `5/7` | Circular progress | not stated | 03 §1 |
| O4 | League / People by risk / Departments / Modules | Progress bars and mini bars; stacked risk bar | not stated | 03 §1, `admin-overview-04-risk-departments.jpg`, `admin-overview-05-people-modules.jpg` |
| O5 | Person detail | Sparkline, XP bar chart, activity heatmap | not stated | 03 §2 |

### Lists, tables, status

| # | Where | What moves | Timing (spec) | Source |
|---|---|---|---|---|
| L1 | Tables in cards | Sort-icon headers, horizontal scroll; row hover (verify, not stated) | — | 03 "Admin qabığı" |
| L2 | Status pills | `Active` green, `Invited` violet, `3 waiting` orange; static | — | 03 §2 |
| L3 | Campaign status filters, Problem report status cards | Problem-report status cards: the active card is brand-framed (§6); campaign status filter pills: active styling not stated (§4) | not stated | 03 §4, §6 |
| L4 | League TV page (`/admin/league`) | `● Updated 17:16` live dot, full-screen mode | not stated | 03 §8, `admin-league.jpg` |

### Forms, wizard, dialogs, toasts

| # | Where | What moves | Timing (spec) | Source |
|---|---|---|---|---|
| F1 | New campaign wizard "Step N of 5" | Chips of chosen steps appear at the top; steps replace each other client-side; card selection styling not stated | not stated | 03 §4 |
| F2 | Settings tab strip | Horizontal pill tabs with icons, horizontal scroll; content swaps per `?tab=` | not stated | 03 §11, `admin-settings-*.jpg` |
| F3 | Branding "Learner view" preview | "Updates as you edit" live preview | — | 03 §11 |
| F4 | Dialogs (Add person, Assign module, Import CSV, Lesson options) | Modal card `radius-2xl`, overlay blurs the background | not stated | 03 §2–3, 02 §4, `lesson-options-dialog.jpg` |
| F5 | Toast / overlay layer | `z-80` `pointer-events-none fixed inset-0` layer "(toast/konfetti qatı ola bilər)" — a toast or confetti layer (verify) | — | 01 "Xüsusi davranışlar" |
| F6 | Content shield | `[data-content-shield]` full-screen `bg-canvas/80 backdrop-blur-2xl` with the mascot logo when the window loses focus | — | 01, 02 §1, `content-shield.jpg` |

### Learner home and shell

| # | Where | What moves | Timing (spec) | Source |
|---|---|---|---|---|
| H1 | Rive mascot on Home | Floats; reacts when clicked ("maskot reaksiya verir"), opens the voice tutor | `--animate-float: float 5s …` (translateY −4%), `--animate-blink: blink 4.8s linear` | 01, 02 §2 |
| H2 | Streak / XP pills in the top bar | Static pills (🔥 0, ⚡ 175) | — | 02 §1 |
| H3 | Daily goal ring, Level ring | Circular progress (daily goal in the reward colour; level ring on the brand card, colour not stated) | not stated | 02 §2, §6 |
| H4 | "Continue" hero card | White progress bar + percent | not stated | 02 §2 |
| H5 | "Your path" timeline | Current module: orange node + orange-framed card; `Show all (51)` expands | not stated | 02 §2, `learner-home-03-path.jpg` |
| H6 | Page transitions | `(learner)/template` re-mounts every page with the blur-to-clear reveal | `.72s`, `--ease-out-expo` | 02 §1 |
| H7 | Tour ("Show the tour again" in Profile) | Guided walkthrough of the app (details not captured) (verify) | — | 02 §7 |

### Lesson player

| # | Where | What moves | Timing (spec) | Source |
|---|---|---|---|---|
| P1 | Intro screen | Large Rive mascot floating with a shadow ellipse | `float` | 02 §4, `lesson-intro.jpg` |
| P2 | Top progress bar | Brand fill in a `sunken` track | not stated | 02 §4 |
| P3 | Narration (tutor beats) | Karaoke: current word brand-100 background, read words `ink`, unread `ink-subtle`; illustration part highlighted in sync; auto-advance when narration ends; step dots (active dot is a long pill) | per-word timestamps | 02 §4, 06 §4, `lesson-01-intro-narration.jpg`, `lesson-05-highlight-narration.jpg` |
| P4 | Multiple choice | Pills; `Check` disabled until a pick; some questions timed | — | 02 §4, `lesson-03-quiz.jpg` |
| P5 | Feedback sheet | Rises from the bottom; safe-50 (or red) background, mascot, ✓, "Well done", explanation, `Continue` with an auto-advance progress line on its bottom edge; chosen option green with ✓, others fade | not stated | 02 §4, 06 §4 (wrong answer: red), `lesson-04-quiz-feedback-correct.jpg` |
| P6 | Mailbox simulation | Lens tool: magnifier "animasiya ilə şübhəli detala gedir" (travels to the detail) with a dark tooltip; decision modal `Good move`; "Simulyasiya çərçivəsi safe rəngində parlayır" (frame glows) | not stated | 02 §4, `lesson-09-mailbox-sim-lens.jpg`, `lesson-10-mailbox-sim-feedback.jpg` |
| P7 | Swipe cards | Drag card right/left: "Safe or a trap?" | — | 06 §2 |
| P8 | Hotspot / match / order | Tap suspicious spots; match pairs; order steps (UI shuffles) | — | 06 §2 |
| P9 | Question timer | `time_limits` countdown; `Standard / More time / Off` | — | 02 §4, 06 §4 |
| P10 | Recap / celebrate | `recap` scene with `mood: celebrate`; mascot `mood_celebrate`, gesture `cheer` | — | 06 §2, §3 |
| P11 | Mascot moods and gestures | Rive `Main` state machine: `mood`, `talking`, `gesture`+`gesture-play`, `idleAct`, `poke`, `lookX/Y`, `aim*`, guide inputs; `talkbody_0..3` follow audio amplitude | Rive | 06 §3 |
| P12 | Motion segment `Full | Calm | Still` | In the ⋯ options dialog and Profile; "animasiya intensivliyi" | — | 02 §4, §7 |

### Landing

| # | Where | What moves | Timing (spec) | Source |
|---|---|---|---|---|
| S1 | Attract mode | Idle mascot moves + lines: `look`, `knock`, `whisper`, `hop`, `lean-in`, `ponder`, `wave`; nudge after 20 s (the spec states no nap on the landing) | `attractFirstSeconds 2`, gap 6–10 s, `attractMaxLines 6`, `nudgeSeconds 20` | 05 §2 |
| S2 | Tour control bar | 7-segment progress line, chapter name `1/7`, caption bubble with word highlighting | word timestamps | 05 §2, §4 |
| S3 | Chapters | Scroll from `inbox` → `phone` → `tutor` → `languages` → `admin` → `deploy` → `demo`; guide walks between chapters (`guide_travel_l/r`, `depart`, `arrive`) | — | 05 §2, 06 §3 |
| S4 | "Stage" keyframes (`stage.module.css`) | `ring`, `glint`, `print`, `still`, `light`, `lightStill`, `label`, `labelOut`, `sheen` — scaling hit rings and glints (`--hit` opacity), fades, labels sliding in/out (`--x`/`--y`), a `sheen` sweep (`translateX(60%)`); which elements use them is not stated | see `01` for the keyframe bodies | 01 |
| S5 | Phone chapter | Incoming-call screen, answer/decline | — | 05 §3.2 |
| S6 | Admin chapter | "animasiyalı bar və ya nöqtələr" — animated bars in the Clicked/Reported/Learned table | — | 05 §3.5 |
| S7 | Game cards | `[[…]]` marks the highlighted part, `{{…}}` the suspicious domain part (markup convention; when they show is not stated) | — | 05 §3.1 |

## 2. Motion token system in the portal

Everything lives in `src/app/globals.css` (the only stylesheet). Two places matter:

**Durations are plain custom properties on `:root`** (lines 14–18), not `@theme` tokens, because
Tailwind v4 has no `--duration-*` theme namespace and because the `calm` preference overrides them:

```css
:root {
  --duration-instant: 90ms;
  --duration-fast: 0.16s;
  --duration-base: 0.24s;
  --duration-slow: 0.42s;
  --duration-reveal: 0.72s;
}
```

Use them with the arbitrary-variable syntax: `duration-(--duration-fast)`, as every component does.

**Easings, animations and keyframes are `@theme` tokens** (lines 122–158):

```css
@theme {
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-in-out-smooth: cubic-bezier(0.65, 0, 0.35, 1);

  --animate-shimmer: shimmer 1.6s var(--ease-in-out-smooth) infinite;
  --animate-float: float 5s var(--ease-in-out-smooth) infinite;
  --animate-blink: blink 4.8s linear infinite;
  --animate-reveal: reveal var(--duration-reveal) var(--ease-out-expo) both;
  --animate-rise: rise var(--duration-slow) var(--ease-out-expo) both;

  @keyframes shimmer { 0% { transform: translate(-100%); } 100% { transform: translate(100%); } }
  @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4%); } }
  @keyframes blink { 0%, 92%, 100% { opacity: 1; } 95% { opacity: 0.15; } }
  @keyframes reveal { 0% { opacity: 0; filter: blur(10px); transform: translateY(6px); } 100% { opacity: 1; filter: blur(0); transform: none; } }
  @keyframes rise { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: none; } }
}
```

How Tailwind v4 exposes them:

| Token | Utility class | Notes |
|---|---|---|
| `--animate-shimmer` | `animate-shimmer` | Spec token; used only by `Skeleton` (`before:animate-shimmer`) |
| `--animate-float` | `animate-float` | Spec token; mascot, illustrations, content shield |
| `--animate-blink` | `animate-blink` | Spec token; **no usages** (the Rive file has its own `Blink` layer) |
| `--animate-reveal` | `animate-reveal` | Portal addition: the blur-to-clear page/scene reveal the spec describes |
| `--animate-rise` | `animate-rise` | Portal addition: popovers, sheets, toasts, list items (`0.42s`) |
| `--ease-out-expo` etc. | `ease-(--ease-out-expo)` | Tailwind would also generate `ease-out-expo`; the codebase uses the `(--var)` form everywhere, keep to it |
| Tailwind built-ins | `animate-spin`, `animate-pulse`, `animate-bounce`, `animate-ping` | Spinners, live dots, match-wrong flash, landing ring/bounce |

Keyframes declared inside `@theme` are emitted only when their `animate-*` utility is used, so an
unused keyframe costs nothing. The spec's landing "stage" keyframes (`ring`, `glint`, `print`, `still`,
`light`, `lightStill`, `label`, `labelOut`, `sheen`) are **not** in `globals.css` (see §7).

Transition conventions seen across `src/components/ui/*`:

- Buttons (`ui/button.tsx` `base`): `transition-[background-color,color,box-shadow,transform] duration-(--duration-fast) ease-(--ease-out-quart) active:scale-[.98]`.
- Inputs (`ui/field.tsx` `control`): `transition-[border-color,box-shadow] duration-(--duration-fast)` with `focus:ring-4 focus:ring-brand-100`.
- `Switch`: track `transition-colors duration-(--duration-base)`, thumb `transition-transform duration-(--duration-base) ease-(--ease-out-expo) peer-checked:translate-x-5`.
- `Segmented` (the Full/Calm/Still control): `transition-all duration-(--duration-fast)`, checked segment `bg-surface shadow-xs`.
- `ProgressBar`: fill `transition-[width] duration-(--duration-slow) ease-(--ease-out-expo)`; `Ring`: `transition-[stroke-dashoffset] duration-(--duration-reveal) ease-(--ease-out-expo)` (both in `ui/progress.tsx`).
- Nav pills (`shell/admin-nav.tsx`, `shell/learner-nav.tsx`): `transition-colors`, active = `bg-brand-50 text-brand-700`. `TabsNav` (`ui/layout.tsx`) also uses `transition-colors`, but its active pill is `bg-ink text-white` (or `bg-surface text-ink shadow-xs` when `segmented`).

## 3. Motion preference and reduced motion

**Storage.** `users.motion` is a text enum `full | calm | still`, default `full`
(`src/server/db/schema.ts`, line 182). It is part of the viewer (`src/server/auth/viewer.ts`:
`motion: "full" | "calm" | "still"`) and written by `setPreferencesAction` in
`src/server/actions/preferences.ts` (zod `z.enum(["full","calm","still"])`; a motion change calls
`refresh()` so server components re-render with the new attribute).

**DOM.** The root layout puts it on `<html>`:

```tsx
// src/app/layout.tsx
<html lang={locale} className={`${geologica.variable} ${georgian.variable}`}
      data-motion={viewer?.user.motion ?? "full"} style={style}>
```

Both places that change it also set the attribute immediately, so the page reacts before the
server round-trip: Profile → Motion (`src/app/(learner)/profile/profile-client.tsx`, `Preferences`,
which uses `setM` and a `save()` wrapper that also toasts) and the player's ⋯ options dialog
(`src/components/player/player.tsx`, the `onChange` passed to `OptionsMotion`, shown here):

```tsx
onChange={(m) => {
  setMotion(m);
  document.documentElement.dataset.motion = m;
  void setPreferencesAction({ motion: m });
}}
```

**CSS** (`globals.css`, the `html[data-motion]` rules after the `@layer base` block) is the main enforcement:

```css
html[data-motion="still"] *, html[data-motion="still"] *::before, html[data-motion="still"] *::after {
  animation-duration: 1ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 1ms !important;
}
html[data-motion="calm"] { --duration-reveal: 0.36s; --duration-slow: 0.3s; }
html[data-motion="calm"] .animate-float, html[data-motion="calm"] .animate-blink { animation: none; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
}
```

So: `still` and the OS setting collapse every CSS animation and transition to one frame (the
`both` fill mode of `reveal`/`rise` lands them on their end state; shimmer runs once and stops);
`calm` shortens the two long durations (reveal .72 s → .36 s, slow .42 s → .3 s) and switches off the perpetual float/blink loops, and nothing else.

**JS readers.** CSS cannot stop timers, Rive or `requestAnimationFrame`, so these read the attribute
or the media query themselves; all of them treat `still` and `prefers-reduced-motion` identically and
ignore `calm`:

| Component | How it reads | What it changes |
|---|---|---|
| `CountUp` (`src/components/admin/overview-client.tsx`) | `document.documentElement.dataset.motion === "still" \|\| matchMedia(...)` inside the effect | `p = still ? 1 : …` → a single frame at the final number |
| `Mascot` (`src/components/mascot/mascot.tsx`) | `useSyncExternalStore(subscribeMotion, readStill, () => false)` (media-query `change` events) plus the explicit `still` prop | `still` → `rive.pause()`; `calm` (the store) → no idle acts, no travel walk, no one-shot `fire` triggers |
| `LessonPlayer` (`player.tsx`) | `motion` prop from the server → `SceneEnv.still` | passes `still` to every `Mascot` in scenes; nothing else in the player reads it |
| `HomeMascot` (`src/components/learner/home-mascot.tsx`) | `still` prop | skips the apple (45 s) and nap (180 s) idle timers |
| `Tour` (`src/components/learner/tour.tsx`) | `still` prop, plus `matchMedia` for scrolling | `scrollIntoView({ behavior: reduced ? "auto" : "smooth" })`; no gestures when `still` |
| `LandingTour` (`src/components/site/landing-tour.tsx`) | `matchMedia` only (public page, no viewer) | scroll behavior `auto` under reduced motion |
| `motion-safe:` / `motion-reduce:` Tailwind variants (`site/scenes.tsx` 324, 340; `admin/ops/page.tsx` 42) | the OS media query only | **do not** react to `data-motion` |

The server render always carries the stored value, so there is no flash of motion on hydration; the
Rive store's server snapshot is `false` (full motion) and corrects itself on the client.

## 4. Implementation map

"CSS" = Tailwind utilities / `globals.css`; "JS" = timers, rAF or Rive inputs. Line numbers are
approximate (they drift); search the symbol.

| Cat. | Implemented by | Mechanism |
|---|---|---|
| A1 | `src/components/shell/admin-nav.tsx` `AdminNav` (`aria-current`, `bg-brand-50 text-brand-700`, `transition-colors`); `PendingMark` shows a `Loader2 animate-spin` via `useLinkStatus()` while the next admin page renders | CSS |
| A2 | `AdminMobileMenu` in the same file: native `<dialog>` drawer, `open:animate-rise`, `backdrop:bg-ink/30 backdrop:backdrop-blur-sm`; no exit animation | CSS |
| A3 | `src/components/admin/account-menu.tsx`: `animate-rise` popover `bottom-full`; outside-click and Escape close it | CSS |
| A4 | `src/components/ui/skeleton.tsx` (`bg-sunken rounded-xl` + `before:animate-shimmer before:bg-gradient-to-r … via-white/70`). Route skeletons: `src/app/(admin)/admin/users/[id]/loading.tsx`, `src/app/(learner)/learn/(catalog)/loading.tsx`, `src/app/(learner)/learn/[slug]/loading.tsx` (each wraps in `role="status" aria-busy="true"` with an sr-only `common.loading`). **No admin-wide `loading.tsx`**: the comment in `admin-nav.tsx` explains a Suspense boundary there would stream HTTP 200 before `notFound()` runs | CSS |
| A5 | Learner: `src/app/(learner)/template.tsx` (`<div className="animate-reveal">`, re-mounts per navigation). Admin: `animate-reveal` on `<main>` in `src/app/(admin)/admin/layout.tsx` — plays once per layout mount, **not** per navigation. Auth: `src/app/(auth)/layout.tsx` card. Player phases and scenes: `player.tsx` (`key={scene.id} … animate-reveal`) | CSS |
| O1 | `CountUp` in `overview-client.tsx`: rAF loop, 900 ms, cubic ease-out `1 - (1-p)^3`, `Math.round`, printed with `useClientFormat().number` (grouped in the UI language); used by the five tiles in `src/app/(admin)/admin/(overview)/page.tsx` (`text-numeral tabular-nums`) | JS |
| O2 | `src/components/ui/charts.tsx` `AreaChart` (server-rendered SVG, gradient area, last-value pill, sr-only `HiddenTable`, optional `riskStrip` and `guides={[34,66]}`). **No draw-in animation.** Also `BarChart`, `Sparkline`, `Heatmap`, `StackBar`, `Funnel` — all static | none |
| O3 | `Ring` (`ui/progress.tsx`) in `SetupGuide`; stroke-dashoffset transition fires only when `value` changes, so no fill-on-load | CSS (change only) |
| O4 | `ProgressBar` / `StackBar` / `Funnel` with inline `width:%`; `ProgressBar` has the width transition, the others none | CSS (change only) |
| O5 | `Sparkline`, `BarChart`, `Heatmap` in `src/app/(admin)/admin/users/[id]/page.tsx` | none |
| L1 | `ui/scroll-region.tsx` for horizontal scroll; tables have no row-hover transition (rows use plain `hover:bg-sunken/60` or `/40` where present) | CSS |
| L2 | `ui/pill.tsx` `Pill` / `Dot`: static | none |
| L3 | Filter pills via `TabsNav` (`ui/layout.tsx`): `transition-colors`; wizard cards `transition-colors` | CSS |
| L4 | `src/app/(admin)/admin/league/page.tsx`: `size-2 animate-pulse rounded-full bg-safe-500` next to "Updated"; `FullscreenButton` (`admin/fullscreen-button.tsx`). `src/app/(admin)/admin/ops/page.tsx`: live-incident dot `animate-ping … motion-reduce:hidden` | CSS |
| F1 | `src/app/(admin)/admin/campaigns/new/wizard.tsx`: `useState(step)`, each step is a conditional `<section>` (no enter/exit transition); chips rebuild from state; `card()` helper `border-2 … transition-colors`, active `border-brand-600 bg-brand-50/60`; `Pill tone="brand"` shows `tw("step", { current })` | CSS |
| F2 | `src/app/(admin)/admin/settings/page.tsx`: `TabsNav` pills (`scrollbar-none overflow-x-auto`), body swapped with `<div key={tab}>` so client state resets; tab components in `src/components/admin/settings-tabs.tsx`. No transition between tabs | CSS |
| F3 | `BrandingTab` in `settings-tabs.tsx` renders the preview from local state (static) | none |
| F4 | `src/components/ui/dialog.tsx`: native `<dialog>` + `showModal()`, `open:animate-rise`, `backdrop:bg-ink/40 backdrop:backdrop-blur-sm`, `shadow-overlay`, `rounded-2xl`. Lesson options use it (`player.tsx`, `size="sm"`) | CSS |
| F5 | `src/components/ui/toast.tsx`: module store + `useSyncExternalStore`, `animate-rise`, auto-dismiss after 4200 ms, max 4, `z-80`, bottom offset above the tab bar. No exit animation, no confetti | CSS/JS |
| F6 | `src/components/shell/protection.tsx` `Protection`: `data-content-shield fixed inset-0 z-90 … bg-canvas/80 backdrop-blur-2xl`, logo `size-20 animate-float`; shown on `blur`/`visibilitychange` | CSS |
| H1 | `src/components/learner/home-mascot.tsx`: `<Mascot className="size-full animate-float" …>` inside a button; tap cycles `REACTIONS` (happy/wave, excited/hop, proud/shield-up, laughing/cheer, curious/ponder) via `gestureKey`; idle `act` apple at 45 s, nap at 180 s, `wake` on hover/click; opens `TutorPanel` | CSS + Rive |
| H2 | `src/app/(learner)/layout.tsx` streak/XP pills: `hover:bg-sunken` only; flame gets `fill-reward-400` when streak > 0 | none |
| H3 | `Ring` in `src/app/(learner)/app/page.tsx` (Home, route `/app`; daily goal, `size=112`) and `progress/page.tsx` (level, `tone="white"`) | CSS (change only) |
| H4 | `ProgressBar tone="white"` on the Continue card (`(learner)/app/page.tsx`) | CSS (change only) |
| H5 | `src/components/learner/path-timeline.tsx`: current card `ring-2 ring-reward-200 transition-shadow hover:shadow-raised`; "Show all" chevron `transition-transform` + `rotate-180` | CSS |
| H6 | `src/app/(learner)/template.tsx` | CSS |
| H7 | `src/components/learner/tour.tsx`: spotlight div with `shadow-[0_0_0_200vmax_rgba(22,18,58,0.55)]` and `transition-[top,left,width,height,opacity] duration-(--duration-base) ease-(--ease-out-expo)`; bubble `transition-[top,left]`; `START_DELAY = 700` ms so the page reveal finishes first; anchors by `data-tour="…"`; mascot mood/gesture per step | CSS + Rive |
| P1 | `player.tsx` intro: wrapper `animate-reveal`, `<Mascot mood="happy" gesture="wave" className="… animate-float" still={motion === "still"}>`; `Mascot` draws the shadow ellipse itself (`bg-ink/10 blur-[2px]`) | CSS + Rive |
| P2 | `player.tsx` header `role="progressbar"`: fill `transition-[width] duration-(--duration-slow) ease-(--ease-out-expo)`, min 2 % | CSS |
| P3 | `TutorScene` + `Karaoke` in `src/components/player/scenes.tsx`: per-word `<span>` with `transition-colors duration-(--duration-fast)`; current word `bg-brand-100 text-ink rounded-[0.35rem]`, read `text-ink`, unread `text-ink-subtle`; words come from `useNarrator` (`narrator.ts`, Web Speech `onboundary`, estimated timing fallback at 165 wpm × rate). Visual `key={`${i}-visual`} animate-reveal`, text/question `animate-rise`, beat dots `h-2 transition-all duration-(--duration-base)` with the active one `w-7 bg-brand-600`. Auto-advance `setTimeout(…, 700)` after `onEnd`. Artifact highlight: `rich.tsx` span `transition-colors duration-(--duration-base)` → `bg-risk-100 text-risk-700 ring-2`. Mascot `aim` computed with rAF (`aimTowards`) so it points at the highlighted spot | CSS + JS + Rive |
| P4 | `ChoiceOptions` (`scenes.tsx`): `rounded-pill border-2 transition-all`, states `idle/picked/correct/missed/wrong/dim` (`dim` = `opacity-55`); `vibrate()` on a wrong check | CSS + haptics |
| P5 | `FeedbackSheet` → `FeedbackCard` (`scenes.tsx`): `fixed inset-x-0 bottom-0 z-50 animate-rise`, tone backgrounds `bg-safe-50 / bg-warn-50 / bg-risk-50`, `role="alertdialog"`, mascot `happy+cheer` or `alert` + `huff` trigger, explanation read with `Karaoke variant="body"`, auto-continue 700 ms after the narration (sound on only), progress line under Continue: `h-0.5 bg-brand-600 transition-[width] duration-(--duration-base)` whose width follows the spoken-word fraction | CSS + JS |
| P6 | `SimulationScene` (`scenes.tsx`): inbox frame `transition-shadow duration-(--duration-base)` + `TONE_RING` (`ring-2 ring-safe-500/50` etc.) on a result; decision modal and intro card `animate-rise`. Lens: `rich.tsx` renders the magnifier ring and tooltip with `animate-rise` at the current spot (`lensHere`), plus a peering `Mascot guide={{ peer: true }} … animate-reveal`. The magnifier **jumps** between details, it does not travel | CSS + Rive |
| P7 | `SwipeScene` (`scenes.tsx`): pointer capture, inline `transform: translateX(drag) rotate(drag/30deg)`, snap-back `transition: transform .25s var(--ease-out-expo)` once released, decide at ±90 px, THREAT/SAFE badge while dragging, next card peeks behind (`-bottom-3 bg-surface/70`), card enters with `animate-rise` | JS + CSS |
| P8 | Hotspot: found spot card `animate-rise`, progress dots; tappable spans `hover:bg-warn-50`. Match: wrong pair `animate-pulse border-risk-500` for 600 ms + `vibrate()`. Order: wrong item `border-warn-500 bg-warn-50` (`transition-colors`). Scenario: chat bubbles `animate-rise`, speaker avatar `ring-4 ring-safe-500/60 transition-shadow` while narrated. Call artifact (`artifacts.tsx`): `SpeakingBars` (`animate-pulse`, inline `animationDelay k*120ms`, `animationDuration 0.9s`, height `transition-[height]`), answer button `animate-pulse` | CSS + haptics |
| P9 | `useCountdown` (`scenes.tsx`): `setInterval` 1 s, `TimerPill` turns `bg-risk-50 text-risk-700` at ≤ 5 s; no bar or ring animation | JS |
| P10 | `RecapScene`: `<Mascot mood="celebrate" gesture="cheer" fire={{ name: "bounce", key: 0 }}>`, points `animate-rise` with inline `animationDelay: k*90ms` stagger. `DoneScreen` (`player.tsx`): `animate-reveal`, mascot `celebrate`/`cheer`, XP pill; no confetti | CSS + Rive |
| P11 | `src/components/mascot/mascot.tsx` + `mapping.ts` (`MOOD_INDEX`, `GESTURE_INDEX`, `ACT_INDEX`, `TOPIC_INDEX`, …): `useRive` with artboard `Mascot`, state machine `Main`, wasm from `/rive/rive.wasm` (`public/rive/`), pointer move → `lookX/lookY`, pointer down → `poke` with `pokeZone` | Rive |
| P12 | `OptionsMotion` (`player.tsx`) and `Preferences` (`profile-client.tsx`) both use `Segmented`; see §3 | — |
| S1 | `src/components/site/landing-tour.tsx` + `guide.tsx` (`GuideProvider`): attract queue (`attractFirstSeconds`, random gap between `attractMinGapSeconds`/`attractMaxGapSeconds`, `attractMaxLines`), nudge after `nudgeSeconds`, `NAP_MS = 120_000` on the hero (portal addition); moves map to Rive (`MOVE_GESTURE` for lean-in/ponder/wave gestures, the nudge is said with `{ move: "tap" }`, `guide.move("touch")` on hover/tap, `fire`) | JS + Rive |
| S2 | `landing-tour.tsx`: 7 segments `h-1.5 transition-colors` (`bg-brand-600` current, `bg-brand-200` seen), caption words `transition-colors` driven by `guide.caption.word` (Web Speech boundaries, reading-time fallback `max(1600, chars*55)` ms in quiet mode) | CSS + JS |
| S3 | `landing-tour.tsx`: `scrollIntoView({ behavior: "smooth" })`, `IntersectionObserver` picks the current chapter, `g.setTravel(dir)` for `TRAVEL_MS = 700` → Rive `travel/travelDir` + `depart`/`arrive` | JS + Rive |
| S4 | **Not implemented** (no `ring`/`glint`/`sheen` keyframes anywhere) | — |
| S5 | `site/scenes.tsx` phone chapter: avatar `motion-safe:animate-pulse` while ringing, answer button `motion-safe:animate-bounce`; `Marked` highlights | CSS |
| S6 | `site/scenes.tsx` `AdminDemo`: bar `transition-[width] duration-(--duration-slow)` with inline width; rows render at their final width, so it animates only when the values change — which happens for the "you" row: `landing-tour.tsx` sets it (`setYou`) from the inbox game's `onDone`, the department rows are static `SAMPLE` values | CSS |
| S7 | `src/components/site/marked.tsx`: `<mark>` `transition-colors duration-(--duration-base)`, `reveal` adds `bg-reward-200/70 font-semibold`; `{{…}}` span adds `text-risk-600 underline decoration-wavy`. Tested in `tests/rendering.test.ts` | CSS |

Haptics (not in the spec's motion section but part of the feedback loop): `src/lib/haptics.ts`
`vibrate(40)` on wrong answers and risky simulation steps; per-device switch in localStorage
`cy-haptics`; `VibrationSwitch` in `profile-client.tsx`.

## 5. Conventions and gotchas

- **Server-first.** Pages are RSC; animations are classes on server-rendered markup, so the first
  paint already animates without JS. Only things that need timers or Rive are client components
  (`player.tsx`, `scenes.tsx`, `mascot.tsx`, `home-mascot.tsx`, `tour.tsx`, `overview-client.tsx`,
  `guide.tsx`, `landing-tour.tsx`, `toast.tsx`, `dialog.tsx`, the navs).
- **Hydration safety.** Never branch markup on `window`, `matchMedia` or `Date.now()` during render.
  Read motion with `useSyncExternalStore` (server snapshot = "full", see `mascot.tsx`) or inside an
  effect (`CountUp`). The player reads `sessionStorage`/`localStorage` through `useSyncExternalStore`
  with server fallbacks for the same reason.
- **Re-mount to replay.** `animate-reveal`/`animate-rise` run on mount. To replay on a change, put a
  `key` on the element (`key={scene.id}`, `key={`${i}-visual`}`, `<div key={tab}>`). The admin
  `<main>` reveal does not replay on navigation because the layout persists; the learner group uses
  `template.tsx` for that.
- **No layout shift.** `reveal` and `rise` animate `opacity`, `filter` and `transform` only (plus the
  `both` fill). Count-ups sit in `tabular-nums` so widths do not jitter. Skeletons match the final
  block sizes (`h-32`, `h-72`, `h-[30rem]` …) so content does not jump when it streams in. Keep new
  animations to `transform`/`opacity`; the codebase sets no `will-change` anywhere.
- **Still/reduced is global CSS.** Any CSS animation you add is covered automatically. Anything in
  JS (timers, rAF, Rive, `scrollIntoView`) must check `document.documentElement.dataset.motion ===
  "still" || matchMedia("(prefers-reduced-motion: reduce)").matches` itself. `calm` only exists in CSS
  today; JS code treats it as `full`.
- **`motion-safe:` / `motion-reduce:` variants** listen to the OS only, not to `data-motion`. Prefer
  a plain class (the global `still` rule catches it) or an explicit `html[data-motion="still"] …`
  override in `globals.css`.
- **Inline styles vs `still`.** `animation-duration`/`transition-duration` are overridden with
  `!important`, so inline `transition: transform .25s …` (swipe) collapses correctly; inline
  `animationDelay` (recap stagger, speaking bars) is not, which is harmless because the duration is 1 ms.
- **Native `<dialog>`** gives focus trap, Escape and inert background; the `open:animate-rise` enter
  has no matching exit. Content is only rendered while `open`, so inner state resets on close.
- **Rive.** Only inputs the file has are set (`inputs.current.get(name)`); unknown names are ignored.
  `still` pauses the runtime (`rive.pause()`), so a paused mascot keeps its last frame rather than
  disappearing. `Rive.suppressDeprecationWarnings` is set for classic state-machine inputs; keep it.
- **Narration timing is the animation clock** for karaoke, auto-advance and the feedback progress
  line. With sound off `speak()` calls `onWord(words.length)` immediately (everything reads as
  "read") and never calls `onEnd`, so the learner continues by hand; do not add motion that waits
  on `onEnd` without that fallback.
- **Testing.** `vitest.config.ts` runs `tests/**/*.test.ts` in the `node` environment — no DOM, no
  CSS. Motion is tested as class presence through `renderToStaticMarkup` (see the `Marked` tests in
  `tests/rendering.test.ts`); `tests/player-resume.test.ts` covers the player's resume logic. Visual
  checks happen on the dev server (`preview_start "portal"`, port 3000, never restart it) with
  Profile → Motion switched and DevTools "Emulate CSS prefers-reduced-motion".
- **Dates and numbers inside animated UI** (toasts, notification popover, tour captions, count-ups):
  Chromium has no `az` date data or number symbols, so use `useClientFormat()` / `<RelativeTime>`
  (ADR-017; its `number` for digits, as `CountUp` does), never `Intl` or `toLocaleString` in client
  code. The notifications popover already does this.
- **i18n.** Motion labels live in `messages/{az,en,ru}/learner.json` (`profile.motion`,
  `motionBody`, `motionFull`, `motionCalm`, `motionStill`) and `messages/*/player.json` (`motion`);
  loading text in `common.json` (`loading`), the shield label in `common.json` (`shield`). Edit these
  JSON files with the Edit tool only; `tests/i18n.test.ts` checks key parity across the three locales.

## 6. Recipes

### 6.1 Add an animation that honours the motion preference

1. Prefer CSS. Add the class to the element: `animate-rise` (enter), `animate-reveal` (page/scene),
   or a transition with the tokens, e.g. `transition-transform duration-(--duration-base) ease-(--ease-out-expo)`.
   `still` and the OS setting are handled by `globals.css`; nothing else to do.
2. New keyframe: add `--animate-<name>: <name> <duration> <easing> …;` and the `@keyframes <name>`
   inside the `@theme` block of `src/app/globals.css`; use `animate-<name>`. Animate only
   `transform`, `opacity` or `filter`.
3. Loop animations (like `float`): also add them to the `html[data-motion="calm"] …` rule so `calm`
   switches them off.
4. JS-driven motion: read `const still = document.documentElement.dataset.motion === "still" ||
   window.matchMedia("(prefers-reduced-motion: reduce)").matches;` inside the effect (pattern:
   `CountUp`) or through `useSyncExternalStore` when it must update live (pattern: `mascot.tsx`
   `subscribeMotion`/`readStill`). Skip or shorten the work when `still`.
5. Verify: `npm run typecheck`, `npx eslint src tests --max-warnings=0`, `npx vitest run`; then the
   dev server with Motion = Full / Calm / Still.

### 6.2 Add a skeleton for a new page

1. Create `loading.tsx` next to the page (server component). Shape it like
   `src/app/(learner)/learn/[slug]/loading.tsx`: `role="status" aria-busy="true"`, an sr-only
   `common.loading`, then `Skeleton` blocks (`src/components/ui/skeleton.tsx`) sized like the real
   layout (`h-16`, `h-72`, `rounded-pill` for pills, `rounded-md` for text lines).
2. Do not add a `loading.tsx` above a segment that can `notFound()` (admin pages, `/learn/[slug]`):
   the boundary would stream a 200 first. Use a route group like `(catalog)` to scope it, or wrap the
   slow section of the page in `<Suspense fallback={<Skeleton …/>}>` instead. Admin navigation already
   shows the `PendingMark` spinner in the sidebar.
3. Test: load the page with the dev server throttled; check nothing jumps when data arrives.

### 6.3 Animate a new chart or KPI

- KPI number: wrap the value in `<CountUp value={n} suffix="%" />` (`src/components/admin/overview-client.tsx`)
  inside a `tabular-nums` element. It is a client component; the page can stay a server component.
- Bars/rings: `ProgressBar` and `Ring` (`ui/progress.tsx`) already transition on value changes. For
  a fill-on-load, render the component with `value={0}` on the server and set the real value in an
  effect inside a small client wrapper (one frame when `still`), or add a keyframe that scales from
  `scaleX(0)` with `transform-origin: left` and respect `still` via CSS.
- Area/line draw-in: `AreaChart` is an SVG `path`; add a client wrapper that sets
  `stroke-dasharray`/`stroke-dashoffset` from `getTotalLength()` in an effect and a transition using
  `--duration-reveal`; keep the server render at the final state and skip the effect when `still`.
  Keep the `HiddenTable`.
- Test with `renderToStaticMarkup` for class presence; `tests/rendering.test.ts` shows the style.

### 6.4 Add a page or scene transition

- Learner route group: nothing to do, `src/app/(learner)/template.tsx` reveals every page.
- Admin: per-navigation reveal needs `src/app/(admin)/admin/template.tsx` with the same one-liner
  (and the `animate-reveal` removed from `<main>` in `admin/layout.tsx` to avoid a double run).
  Check the `(admin)/admin/users/[id]/layout.tsx` nesting first.
- Player: a new scene type gets its own branch in `LessonPlayer` (`player.tsx`); the `key={scene.id}`
  wrapper already reveals it. Inside the scene, give sub-steps `key` + `animate-rise`/`animate-reveal`
  (pattern: `TutorScene`'s `${i}-visual` / `${i}-text`).
- Exit animations are not in the system; if required, use a closing state class and `onAnimationEnd`
  before unmounting, and make the close instant when `still`.

### 6.5 Add a micro-interaction

- Buttons already have hover/active (`active:scale-[.98]`); don't add more motion to them.
- Hover lift on a card: `transition-shadow hover:shadow-raised` (catalog cards, path timeline).
- Toggle chevrons: `transition-transform` + conditional `rotate-180` (`path-timeline.tsx`).
- Wrong-answer flash: temporary `animate-pulse border-risk-500` with a 600 ms `setTimeout` reset and
  `vibrate()` (`MatchScene`). Clear the timeout on unmount.
- Drag: pointer capture + inline transform while dragging, `transition: transform .25s var(--ease-out-expo)`
  once released (`SwipeScene`); keep `touch-pan-y select-none` on the element.
- Any new mascot reaction goes through `Mascot` props (`gesture` + `gestureKey`, `fire={{ name, key }}`),
  never by reaching into Rive directly.

### 6.6 Make an existing animation calm/still-aware

1. CSS loop (`animate-*` infinite): add its class to `html[data-motion="calm"] .animate-float, …` in
   `globals.css`. `still` is already covered.
2. JS timer or rAF: add the `still` check (6.1 step 4) and, if `calm` should matter, read
   `dataset.motion === "calm"` and shorten the duration (e.g. CountUp 900 → 400 ms). Today nothing in
   JS reads `calm`; if you add it, note it in `docs/build/DECISIONS.md`.
3. Rive: pass `still={…}` (pauses the runtime) and let the store-driven `calm` flag disable idle acts
   and one-shot triggers. For a stronger `calm`, set `mood` only and drop `gesture` (as `Tour` does when `still`).
4. `motion-safe:`/`motion-reduce:` usages: replace with plain classes so `data-motion="still"` applies.

## 7. Gaps vs the original

| Gap | Original | Portal today | Suggested approach |
|---|---|---|---|
| Landing "stage" keyframes (S4) | `ring`, `glint`, `print`, `still`, `light`, `lightStill`, `label`, `labelOut`, `sheen` for hit rings, glints, labels and a sheen sweep (`01`; the elements they decorate are not stated) | Absent; phone chapter uses `animate-pulse`/`animate-bounce` | Add the nine keyframes from `01-design-tokens.md` to `@theme` as `--animate-stage-*` and use them in `site/scenes.tsx` (`--hit`, `--x`, `--y` custom properties per element); honour `still` via the global rule |
| Lens travel (P6) | Magnifier "goes to" the suspicious detail with an animation | Ring and tooltip pop in at the spot (`animate-rise`); no movement between details | Keep one `position: fixed` magnifier element, move it with `transition: transform var(--duration-slow) var(--ease-out-expo)` to the next spot's `getBoundingClientRect()`; instant under `still` |
| Simulation frame glow (P6) | Frame "glows" safe-coloured after a correct decision | Static `TONE_RING` ring + `transition-shadow` | Add a one-shot keyframe on `box-shadow` (or a `ring` opacity pulse) in `@theme`; attach with `key` on the result |
| Admin page transitions (A5) | Blur-to-clear reveal is spec'd for learner pages; admin not stated | One reveal per layout mount; navigations swap content instantly | Optional `src/app/(admin)/admin/template.tsx` (recipe 6.4) |
| Chart draw-in (O2) | Not stated by the spec (verify against `admin-overview-03-charts.jpg`) | Static SVG | Recipe 6.3 if wanted |
| Fill-on-load for bars/rings (O3, O4, H3, H4) | Not stated | Transition only on value change | Recipe 6.3 (server renders final state; client wrapper animates from 0 once) |
| Confetti / celebrate layer (F5, P10) | `z-80` overlay "could be a toast/confetti layer" (verify); `recap` has `mood: celebrate` | Mascot celebrate + bounce, no particles | If confirmed, a CSS-only particle burst (a fixed `z-80` layer, ~20 spans with `transform` keyframes) rendered once on `DoneScreen`; skip entirely under `still` and `calm` |
| `calm` in JS | "Animation intensity" segment | `calm` shortens two CSS durations and stops float/blink; JS timers, CountUp, tour scrolling and Rive ignore it | Recipe 6.6 step 2; decide and record in an ADR |
| `motion-safe:` variants vs preference | Full/Calm/Still is per user | Three usages respond to the OS only | Replace with plain classes or a `@custom-variant` keyed on `html:not([data-motion="still"])` |
| Dialog/sheet/toast exit | Not stated | Enter only (`animate-rise`), close is instant | Leave as is unless the user asks; recipe 6.4 last bullet |
| Skeleton coverage (A4) | Shown on admin person page | Three routes only; admin list pages rely on `PendingMark` | Add `<Suspense>` sections inside heavy admin pages (overview charts, reports) rather than route-level `loading.tsx` |
| Hotspot pulse | Not in the spec | Spots have hover colour only | Only if the user asks: `animate-pulse` on undiscovered spots after a hint, off under `still` |
| `blink` token | Mascot blinks (`blink 4.8s`) | Token defined, class unused — Rive's `Blink` layer blinks instead | Nothing to do; remove the token only if a cleanup task asks |
| Timer visual (P9) | Not stated beyond the countdown | Text pill turns red at ≤ 5 s | Optional `Ring` around the pill driven by `left/total` |
