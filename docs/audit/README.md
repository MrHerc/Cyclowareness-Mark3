# Cylosof: portal auditi və yenidən qurma bazası

Bu qovluqda canlı **cylosof.com** portalından (demo tenant "Rəqəmsal İnkişaf Agentliyi", 2026-10-15) götürülən hər şey var. Məqsəd portalı sıfırdan, eyni struktur və dizaynla, daha da yaxşı şəkildə yenidən qurmaqdır. Hər şey brauzerdə görünən UI-dan, səhifələrin göndərdiyi məlumatdan və tətbiqin öz API cavablarından toplanıb. Heç bir məlumat dəyişdirilməyib: forma göndərilməyib, saxlanılmayıb, kampaniya yaradılmayıb.

## Fayllar
| Fayl | Nə var |
|---|---|
| [00-overview.md](00-overview.md) | Texnologiya steki, route-lar, API-lər, feature flag-lar, dərs pleyerinin əsasları |
| [01-design-tokens.md](01-design-tokens.md) | Rəng, font, tipoqrafiya, radius, kölgə, motion, keyframe-lər. Canlı CSS-dən götürülüb |
| [02-learner-app.md](02-learner-app.md) | Learner qabığı, Home, Learn, **dərs mühərriki** (addım tipləri, mailbox simulyasiyası, Lens), League, Progress, Profile, siyasət oxuyucu, oyunlaşdırma qaydaları |
| [03-admin-panel.md](03-admin-panel.md) | Admin konsolunun hər səhifəsi, cədvəl sütunları, filtrlər, dialoqlar, 5 addımlı kampaniya sehrbazı və bütün şablonlar, Settings-in 10 tabı sahə-sahə, audit hərəkətlərinin tam siyahısı |
| [04-training-catalog.md](04-training-catalog.md) + [data/modules.json](data/modules.json) | **53 modul, 106 dərs**: kateqoriya, auditoriya, dəqiqə, XP, çətinlik, dərs id-ləri |
| [05-landing.md](05-landing.md) | İctimai sayt: maskotun apardığı interaktiv tur, 7 fəsil, demo forması, FAQ, SEO, PWA, robots, sign-in, hüquqi səhifələr |
| [06-lesson-engine.md](06-lesson-engine.md) | **Dərs məzmununun sxemi** (11 səhnə tipi, 11 artefakt növü, simulyasiya hərəkətləri, budaqlanan ssenarilər, brend reyestri, səs manifesti) və **maskotun Rive xəritəsi** (state machine, input-lar, əhval və jest animasiyaları) |
| [content/lessons/](content/lessons/) | **106 dərsin hamısı** JSON kimi (EN), oxunaqlı ssenari kitabı [SCRIPTS.en.md](content/lessons/SCRIPTS.en.md), 169 brend, səs manifesti nümunəsi |
| [assets/](assets/) | `mascot.riv` (Rive maskot), tenant loqosu (1080×1080), PWA ikonları (192, 512, maskable, svg), favicon |
| [content/landing/*.json](content/landing/) | Landing-in bütün mətnləri **10 dildə**, maskot replikaları, səs manifestinin formatı |
| [content/policy-acceptable-use.en.md](content/policy-acceptable-use.en.md) | "Acceptable Use" siyasətinin tam mətni (18 bölmə) |
| [content/legal-privacy.az.md](content/legal-privacy.az.md), [content/legal-terms.az.md](content/legal-terms.az.md), [content/sign-in.az.md](content/sign-in.az.md) | Məxfilik Siyasəti, İstifadə Şərtləri, giriş səhifəsinin mətni |
| [screens/](screens/) | 57 ekran şəkli (`learner-*`, `lesson-*`, `admin-*`, `landing-*`) |

## Platformanın qısa xəritəsi
1. **İctimai sayt**: maskotun səsli apardığı interaktiv demo turu, 10 dil, demo sorğusu, hüquqi səhifələr.
2. **Learner tətbiqi** (PWA + Android): Home, Learn (53 modul), dərs pleyeri (səsli narration, karaoke mətn, suallar, simulyasiyalar, Lens, AI tutor), League, Progress, Profile, siyasət imzalama, sertifikatlar.
3. **Admin konsolu** (`/admin`): Overview, People, Assignments, Campaigns (Email / SMS / Voice / USB phishing simulyasiyası), Policies, Problem reports, Reports (CSV / Excel / PDF, Compliance pack, cədvəlli göndəriş), League (TV rejimi), Audit log, Departments, Settings (Branding, Languages, SSO / LDAP, SMTP, Notifications, Attestation, Certificate, Learning, Protection, Integrations).
4. **Operator konsolu** (`/super`): tenant və paketlər, landing CMS (mətn, şəkil, səs klipləri), demo sorğuları, domen təsdiqi, admin giriş linkləri. Demo hesabla buraya giriş yoxdur. Mövcudluğu audit log və `robots.txt`-dən məlumdur.
5. **Xidmət route-ları**: `/t/` (simulyasiya klik izləmə), `/q/` (QR tələləri), `/c/` (sertifikatın açıq yoxlaması), `/start` (PWA start), `/account/`.

## Yenidən qurma: tövsiyə olunan arxitektura
Canlı sayt Next.js App Router, Tailwind v4 və Cloudflare üzərində işləyir. Eyni steki saxlamaq dizaynı 1:1 bərpa etməyi asanlaşdırır.

| Qat | Seçim | Səbəb |
|---|---|---|
| Frontend | Next.js 15 (App Router, RSC), TypeScript, Tailwind v4 (`@theme` tokenləri [01-design-tokens.md](01-design-tokens.md)-dən), `next/font` (Geologica, Noto Sans Georgian) | Orijinalla eyni |
| i18n | `next-intl`, locale-prefiksli ictimai route-lar, istifadəçi locale-i profildə | 10 interfeys dili, 3 dərs dili |
| Animasiya | Rive (`@rive-app/react-canvas`) maskot üçün, CSS keyframe-lər, Motion (Framer) səhifə və element keçidləri üçün; `Full / Calm / Still` motion rejimi + `prefers-reduced-motion` | Orijinalda belədir |
| DB | PostgreSQL + Drizzle (və ya Prisma), hər cədvəldə `tenant_id`, Row-Level Security | Multi-tenant SaaS və on-prem eyni kod |
| Auth | Email-first giriş, Argon2 parol, TOTP 2FA + backup kodları, cihaz limiti, OIDC və SAML SSO, LDAP sync (worker) | Settings → Sign-in ilə eyni |
| İş növbələri | BullMQ / pg-boss: email göndərişi, xatırlatmalar, LDAP sync, hesabat generasiyası, webhook / syslog çatdırılması | Audit log-dakı async hərəkətlər |
| Səs | TTS + söz-söz zaman damğaları (məs. ElevenLabs "with timestamps" və ya Azure Speech word boundary), build zamanı əvvəlcədən generasiya edilib `m4a` kimi keşlənir | `words[{word,startMs,endMs}]` formatı |
| AI tutor | Claude API, dərs konteksti + anonim id (PII göndərilmir), cavab keşi ("AI tutor answer removed from the cache") | FAQ və audit-ə uyğundur |
| Hesabatlar | CSV, XLSX (exceljs), PDF (Playwright / React-PDF) | Reports səhifəsi |
| Mobil | PWA (manifest artıq var) + Android üçün TWA və ya Capacitor (`FLAG_SECURE` ilə ekran şəkli bloku) | Settings → Protection |

## Əsas məlumat modeli (eskiz)
`tenants` (slug, ad, branding, protection, features, default_locale, enabled_locales) · `departments` (ağac: parent_id, head_user_id) · `users` (rol, status, locale, job_title, manager_id, risk_score, xp, level, streak) · `assignments` (module_slug, scope: everyone/department/person, due: fixed/after_joining) · `module_progress` / `lesson_progress` / `answers` (first_try_correct, time) · `attestations` (module, text_snapshot, locale, signed_at) · `certificates` (serial, public_token) · `policies` / `policy_versions` / `policy_signoffs` · `campaigns` (channel, template, audience, schedule, status) / `campaign_recipients` / `sim_events` (sent, opened, clicked, reported) · `league_snapshots` (aylıq) · `problem_reports` (status: new/in_progress/resolved/not_a_problem) · `notification_templates` (tip × dil) · `report_schedules` · `audit_log` (action, change_code, actor, ip) · `webhooks` / `syslog_targets` / `deliveries` · `watermark_codes` · `landing_content` (draft/published, locale) · `demo_requests`.

Dərs məzmunu kod və ya JSON kimi saxlanılmalıdır (`content/modules/{slug}/{lessonId}.{locale}.json`). Addım tipləri: `narration`, `mcq`, `feedback`, `mailbox_sim`, `call_sim`, `sms_sim`, `qr_sim` və digər simulyasiyalar. Hər addımda `id`, mətn, səs klipi və illüstrasiya istinadı olur.

## "Daha yaxşısı" üçün təkliflər
- **Dizayn sistemi**: tokenlər artıq yaxşıdır. Üstünə dark mode (`canvas` / `surface` / `ink` üçün ikinci set), komponent kitabxanası (Storybook) və vizual regressiya testləri əlavə etmək olar.
- **Dərs redaktoru**: indi dərslər yalnız platforma tərəfindən yazılır (audit-də "Content creator" rolu var, amma redaktor görünmür). Admin üçün vizual dərs və şablon redaktoru əlavə etmək olar, səs avtomatik generasiya olunar.
- **Spaced review və nudges**: feature flag-lar var (`spaced_review`, `nudges`, `coop_quests`, `town_hall`, `family_mode`, `vishing_trainer`, `outlook_addin`, `leak_monitoring`), amma UI-da görünmürlər. Bunları tam funksiya kimi qurmaq olar.
- **Outlook / Gmail "Report phishing" əlavəsi**: `outlook_addin` flag-ı var. Reporting liqa xalının 40%-ni təşkil etdiyi üçün bu əlavə çox dəyərlidir.
- **Admin Overview**: şöbə müqayisəsi üçün heatmap, kampaniya huni qrafiki və "nə etməli" tövsiyə kartları.
- **Əlçatanlıq**: əsas hissə yaxşıdır (aria-label-lar, gizli data cədvəlləri, `Skip to content`). Tam WCAG 2.2 AA auditi əlavə etmək olar.
- **Performans**: admin səhifələri streaming Suspense ilə gec yüklənir. Kritik datanı server tərəfdə əvvəlcədən yükləmək olar.

## Hələ çatışmayanlar (növbəti addımlar)
1. ~~106 dərsin ssenarisi~~: **hazırdır (EN)**, [content/lessons/](content/lessons/). Dərs səhifəsinin serverdən gələn məlumatından götürülüb, demo hesabın XP-si dəyişməyib. **AZ və RU versiyaları** hələ yoxdur: məzmun profil dilinə görə gəlir, ona görə demo admin profilinin dilini müvəqqəti dəyişmək lazımdır.
2. ~~Media~~: `mascot.riv`, loqo və PWA ikonları **yüklənib** ([assets/](assets/)). Qalanlar: 29 dərs illüstrasiyası, modul ikonları (inline SVG, yenidən çəkilməli), TTS səsləri (yeni pipeline ilə yenidən yaradılacaq; format [06-lesson-engine.md](06-lesson-engine.md)-də).
3. **Operator konsolu (`/super`)** və landing CMS: giriş yoxdur. Funksiyaları audit hərəkətlərindən bərpa olunub ([03-admin-panel.md](03-admin-panel.md), bölmə 9).
4. Bəzi dialoqlar yalnız adla qeyd olunub, açılmayıb: Edit person, Change role, Move department, Rename / Move department, Edit due date, policy versiya redaktoru, report schedule.
5. Learner tərəfində görülməyənlər: attestasiya ekranı, sertifikat səhifəsi (`/c/…`), onboarding turu ("Show the tour again"), refresher dərs, badge-lər, mobil alt tab bar.
