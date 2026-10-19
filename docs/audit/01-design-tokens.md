# Cylosof — Design tokens (canlı portaldan götürülüb, 2026-10-15)

Stack işarələri: Next.js (App Router, `/_next/`), Tailwind CSS v4 (`@theme` tokenləri), next/font, Cloudflare.

## Fontlar
- `--font-sans` = `--font-display` = `Geologica, Noto Sans Georgian, ui-sans-serif, system-ui, sans-serif`
- Geologica: variable, 100–900 (latin, latin-ext, cyrillic, cyrillic-ext, greek, vietnamese subsets)
- Noto Sans Georgian: variable, 100–900 (gürcü dili üçün)
- Hər ikisi Google Fonts-dadır, `next/font/google` ilə yüklənir.

## Brend (tenant-ə görə dəyişir)
```css
:root {
  --brand: #4f46e5;      /* indigo, hər təşkilat öz rəngini qoya bilir */
  --brand-on: #fff;
  --accent: #ff7a1a;     /* narıncı: XP, mükafat, streak */
  --accent-on: #16123a;
  --reward-ink: #ab4f0d;
  --reward-mark: #d76614;
}
```
Brend və reward şkalaları `color-mix(in oklab, ...)` ilə törədilir:
| token | dəyər |
|---|---|
| brand-50 | color-mix(in oklab, var(--brand) 6%, white) |
| brand-100 | 12% white |
| brand-200 | 24% white |
| brand-300 | 42% white |
| brand-400 | 70% white |
| brand-500 | 88% white |
| brand-600 | var(--brand) |
| brand-700 | color-mix(in oklab, var(--brand) 84%, black) |
| brand-900 | color-mix(in oklab, var(--brand) 46%, #16123a) |
| brand-on | var(--brand-on) |
| reward-100 | color-mix(in oklab, var(--accent) 16%, white) |
| reward-200 | 32% white |
| reward-400 | 78% white |
| reward-500 | var(--accent) |
| reward-600 | color-mix(in oklab, var(--accent) 92%, #7a2e00) |
| reward-700 | color-mix(in oklab, var(--accent) 62%, #5a2200) |

## Neytral və semantik rənglər
| token | hex |
|---|---|
| ink | #16123a |
| ink-muted | #55516f |
| ink-subtle | #6b6788 |
| ink-disabled | #8f8ba6 |
| canvas | #f7f6fb |
| surface | #ffffff |
| sunken | #f1eff8 |
| line | #e7e5f0 |
| line-strong | #d9d6e8 |
| line-control | #8a86a3 |
| risk-50 / 100 / 500 / 600 / 700 | #fdeeee / #fbdcdd / #e5484d / #ce2c31 / #a61e22 |
| safe-50 / 100 / 500 / 600 / 700 | #e8f6ee / #cdebd9 / #22a05c / #1a7f4b / #13613a |
| laurel-500 / 600 | #f6b73c / #e5a027 (maskotun dəfnə tacı, liqa) |

## Tipoqrafiya şkalası
| token | size | line-height | letter-spacing |
|---|---|---|---|
| tab-sm | .75rem | 1.15 | |
| tab | .8125rem | 1.15 | |
| caption | .875rem | 1.35 | |
| body-sm | .9375rem | 1.45 | |
| body | 1.0625rem | 1.5 | |
| lead | 1.25rem | 1.4 | |
| title-sm | 1.25rem | 1.25 | -.01em |
| title | 1.5rem | 1.2 | -.015em |
| headline | clamp(1.875rem, 1.45rem + 1.4vw, 2.625rem) | 1.08 | -.025em |
| display | clamp(2.375rem, 1.6rem + 2.8vw, 4rem) | 1 | -.035em |
| numeral | clamp(1.75rem, 1.4rem + 1.1vw, 2.5rem) | 1 | -.03em |

## Radius
xs .5rem · sm .75rem · md 1rem · lg 1.375rem · xl 1.75rem · 2xl 2.25rem · pill 999px

## Kölgələr
```css
--shadow-xs: 0 1px 2px #16123a0f;
--shadow-raised: 0 2px 4px #16123a0d, 0 18px 40px -18px #16123a3d;
--shadow-overlay: 0 24px 64px -20px #16123a57;
--shadow-bar: 0 -1px 0 #16123a0f, 0 -12px 32px -18px #16123a2e;
```

## Hərəkət (motion)
```css
--ease-out-expo: cubic-bezier(.16,1,.3,1);
--ease-out-quart: cubic-bezier(.25,1,.5,1);
--ease-in-out-smooth: cubic-bezier(.65,0,.35,1);
--duration-instant: 90ms;
--duration-fast: .16s;
--duration-base: .24s;
--duration-slow: .42s;
--duration-reveal: .72s;
--animate-shimmer: shimmer 1.6s var(--ease-in-out-smooth) infinite;
--animate-float: float 5s var(--ease-in-out-smooth) infinite;   /* maskot üzür */
--animate-blink: blink 4.8s linear infinite;                     /* maskot göz qırpır */
```
Keyframes:
```css
@keyframes shimmer { 0% { transform: translate(-100%) } 100% { transform: translate(100%) } }
@keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4%) } }
@keyframes blink { 0%,92%,100% { opacity: 1 } 95% { opacity: .15 } }
```
Landing "stage" animasiyaları (CSS module `stage.module.css`): `ring`, `glint`, `print`, `still`, `light`, `lightStill`, `label`, `labelOut`, `sheen`:
```css
@keyframes ring { 0% { transform: scale(.12); opacity: var(--hit,1) } 100% { transform: scale(1); opacity: 0 } }
@keyframes glint { 0% { transform: scale(.35); opacity: 0 } 22% { opacity: calc(var(--hit,1) * .8) } 100% { transform: scale(1.1); opacity: 0 } }
@keyframes print { 0% { opacity: 0 } 4% { opacity: .95 } 30% { opacity: .7 } 100% { opacity: 0 } }
@keyframes still { 0% { opacity: 0 } 20% { opacity: .85 } 100% { opacity: 0 } }
@keyframes light { 0% { opacity: 0; transform: scale(1.12) } 12% { opacity: 1; transform: scale(1) } 70% { opacity: .9 } 100% { opacity: 0 } }
@keyframes lightStill { 0% { opacity: 0 } 10% { opacity: 1 } 80% { opacity: 1 } 100% { opacity: 0 } }
@keyframes label { 0% { opacity: 0; transform: translate3d(var(--x), calc(var(--y) + 6px), 0) scale(.96) } 100% { opacity: 1; transform: translate3d(var(--x), var(--y), 0) scale(1) } }
@keyframes labelOut { 0% { opacity: 1; transform: translate3d(var(--x), var(--y), 0) } 100% { opacity: 0; transform: translate3d(var(--x), var(--y), 0) } }
@keyframes sheen { 100% { transform: translateX(60%) } }
```

## Layout ölçüləri
```css
--tabbar-height: 4.5rem;   /* mobil alt tab bar */
--topbar-height: 4rem;
--rail-width: 17rem;       /* desktop sol menyu */
--slips-reserve: 2.75rem;
--container-reading: 40rem;
--container-content: 76rem;
--safe-top/bottom/left/right: env(safe-area-inset-*, 0px);
```

## Xüsusi davranışlar
- **Content shield**: `[data-content-shield]` — `fixed inset-0 z-90 grid place-items-center bg-canvas/80 backdrop-blur-2xl`, ortada maskot loqosu (`size-20`). Pəncərə fokusda olmayanda (`document.hasFocus() === false`) görünür və ekran görüntüsünü çətinləşdirir. `print:hidden`.
- `z-80` qatında `pointer-events-none fixed inset-0` overlay (toast/konfetti qatı ola bilər).
