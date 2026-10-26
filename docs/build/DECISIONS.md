# Arxitektura qərarları (ADR)

Hər qərar qısa: kontekst → qərar → nəticə. Dəyişdirmək lazım olsa, yeni ADR yazın və köhnəsinə istinad edin.

## ADR-001 · Next.js 16 App Router, RSC və Server Actions
**Kontekst.** Orijinal Cylosof Next.js üzərindədir; iki rol (əməkdaş / admin) üçün eyni tətbiq, SSR və server tərəfdə icazə yoxlaması lazımdır.
**Qərar.** Next.js 16.4 (App Router, React 19.3), bütün məlumat oxunuşu server komponentlərində, bütün yazılar `"use server"` aksiyonlarında. Hər aksiyon `actionViewer(permission)` ilə başlayır; `"use server"` fayllarından aksiyon olmayan heç nə export edilmir (hamısı açıq endpoint olur).
**Nəticə.** Brauzerə yalnız lazım olan məlumat gedir; icazə məntiqi bir yerdədir (`src/server/auth/permissions.ts`).

## ADR-002 · `cacheComponents` söndürülüb
**Kontekst.** Səhifələrin hamısı şəxsi məlumat göstərir, dil kuki ilə seçilir, tenant brendi hər sorğuda dəyişə bilər.
**Qərar.** `cacheComponents: false`; dəyişikliklərdən sonra `refresh()` (next/cache). Statik yalnız ictimai sayt (`/[lang]`, `/legal/*`) və metadata marşrutlarıdır.
**Nəticə.** Sadə və proqnozlaşdırılan davranış; keş səhvləri yoxdur. Yük artdıqda hesabat sorğularına hədəfli keş əlavə etmək olar.

## ADR-003 · Webpack, Turbopack deyil
**Kontekst.** Bu maşında `next dev --turbopack` native segfault ilə çökür (çıxış kodu 3221225477).
**Qərar.** `dev`/`build` skriptləri `--webpack` ilə işləyir; Tailwind `@tailwindcss/postcss` ilə qoşulub.
**Nəticə.** Dev start bir qədər yavaşdır, amma sabitdir. Turbopack düzələndə yalnız skriptləri və PostCSS konfiqini dəyişmək kifayətdir.

## ADR-004 · PostgreSQL + Drizzle; lokalda PGlite, prod-da node-postgres
**Kontekst.** Tərtibatçı maşınında Docker tələb etmədən real Postgres sxemi lazımdır; prod-da adi Postgres.
**Qərar.** Bir sxem (`src/server/db/schema.ts`), bir miqrasiya qovluğu (`drizzle/`), iki drayver (`DATABASE_URL` varsa `pg`, yoxsa `.data/pg`-də PGlite).
**Nəticə.** PGlite tək prosesdir: `db:reset`/`db:seed` zamanı dev server dayandırılmalıdır. Prod-da miqrasiya konteyner başlayanda `scripts/migrate.mjs` ilə tətbiq olunur.

## ADR-005 · Öz autentifikasiya qatı
**Kontekst.** Lucia dəstəklənmir; NextAuth e-poçt-əvvəl axını, telefon OTP, cihaz limiti və admin-lər üçün məcburi 2FA kimi tələbləri çətin örtür.
**Qərar.** E-poçt-əvvəl giriş, Argon2id (`@node-rs/argon2`), DB sessiyaları (`sha256(token)` id kimi, sürüşən müddət), TOTP (`@oslojs/otp`) + ehtiyat kodlar, telefon OTP, `login_attempts` ilə kilid, sessiya başına su nişanı kodu.
**Nəticə.** Tam nəzarət və audit; SSO/LDAP üçün konnektor interfeysi hazırdır, lakin OIDC/SAML mübadiləsi hələ yazılmayıb ([OPEN-QUESTIONS](OPEN-QUESTIONS.md)).

## ADR-006 · PDF brauzerin çapı ilə, server Chromium olmadan
**Kontekst.** Uyğunluq paketi və rəhbərlik paneli PDF kimi lazımdır; server tərəfdə Chromium konteyner ölçüsünü və hücum səthini böyüdür.
**Qərar.** `/print/report/[kind]` və `/print/compliance` çap-hazır səhifələrdir; brauzer «PDF kimi saxla» edir. CSV/XLSX server tərəfdə, asılılıqsız yazıcı ilə.
**Nəticə.** Planlaşdırılmış hesabat məktubları faylı əlavə etmir, konsola link verir. Avtomatik PDF lazım olsa, Playwright ilə ayrıca xidmət əlavə edilir.

## ADR-007 · Səs: Web Speech API, sonra TTS provayderi
**Kontekst.** Orijinalda hər replika əvvəlcədən hazırlanmış klipdir (söz-söz zaman damğası ilə).
**Qərar.** İlk versiyada brauzerin nitq sintezi (`useNarrator`), söz sərhədləri ilə karaoke; sərhəd gəlməyəndə tempdən hesablama. `speak()` interfeysi provayder (ElevenLabs/Azure) ilə əvəzlənə bilər.
**Nəticə.** Açar olmadan işləyir; səs keyfiyyəti cihazdan asılıdır.

## ADR-008 · Sİ: Claude API, PII göndərilmir, insan təsdiqi
**Kontekst.** Dərs içində müəllim və studiyada dərs qaralaması lazımdır; şəxsi məlumat modelə getməməlidir.
**Qərar.** `@anthropic-ai/sdk`, model `ANTHROPIC_MODEL` (default `claude-opus-5-5`). Müəllimə yalnız dərs konteksti gedir, cavablar keşlənir, açar yoxdursa dərs mətnindən cavab. Studiya qaralaması `tool_use` ilə strukturlu gəlir, zod ilə yoxlanır və həmişə qaralama kimi saxlanır; Sİ materialı təsdiq mərhələsindən keçmədən əməkdaşa çatmır.
**Nəticə.** Açar yoxdursa hər şey işləyir; model dəyişmək bir env dəyişənidir.

## ADR-009 · Sandbox statik analizdir
**Kontekst.** Fayl və linklərin «partladılması» (detonasiya) ayrıca infrastruktur tələb edir.
**Qərar.** Statik yoxlamalar: URL heuristikaları, fayl növü/imza, ZIP/OOXML içi, makro, IOC çıxarışı, MITRE uyğunluğu, STIX 2.1 ixracı. Baytlar yaddaşda analiz olunur, saxlanmır (yalnız heş).
**Nəticə.** Sürətli və təhlükəsiz; real detonasiya lazım olsa, nəticəni eyni `Analysis` formatında qaytaran xarici xidmət qoşulur.

## ADR-010 · Tailwind v4 və audit tokenləri
**Qərar.** Rənglər, radiuslar, kölgələr, tip şkalası `docs/audit/01-design-tokens.md`-dən `globals.css` `@theme`-ə köçürülüb; brend rəngləri CSS dəyişənləri ilə tenant başına verilir (`brandStyle`). `tailwind-merge` xüsusi şkalalarla konfiqurasiya olunub.

## ADR-011 · next-intl, kuki əsaslı, namespace-lər
**Qərar.** İnterfeys AZ (default)/EN/RU, `messages/{locale}/{namespace}.json`, tipli açarlar. İctimai sayt 10 dildə `content/landing/*.json`-dan. Açarlarda nöqtə yoxdur; ICU mötərizələri dırnaqla qaçırılır; test paritet və placeholder bərabərliyini yoxlayır.

## ADR-012 · İşlər prosesin içində, növbə yoxdur
**Qərar.** `src/instrumentation.ts` hər dəqiqə `runJobs()` çağırır; Postgres-də `pg_try_advisory_xact_lock` ilə yalnız bir replika işləyir; `JOBS_ENABLED=0` ilə söndürülür. Hər addım idempotentdir.
**Nəticə.** Redis/BullMQ olmadan kampaniya başlatma, məktub təkrarı, vebhuk/syslog çatdırılması, xatırlatmalar, rəhbər siqnalları, gündəlik risk snapshot-u, təkrar dərslər və planlaşdırılmış hesabatlar işləyir.

## ADR-013 · Vebhuk imzası və syslog formatı
**Qərar.** `X-Cylosof-Signature: sha256=HMAC(body)` və `X-Cylosof-Signature-Timestamped: sha256=HMAC(ts.body)`, `X-Cylosof-Delivery` dublikat üçün; sirr AES-256-GCM ilə saxlanır və yalnız yaradılanda göstərilir. Syslog RFC 5424 + CEF və ya JSON, TLS/TCP/UDP.

## ADR-014 · Service worker yalnız oflayn ehtiyat
**Qərar.** Səhifələr və API keşlənmir (şəxsi məlumat); statik build faylları keşlənir; əlaqə yoxdursa `/offline`.

## ADR-015 · Məzmun faylda, DB-yə sinxronlaşdırılır
**Qərar.** 53 modul / 106 dərs `content/library`-də JSON, zod ilə yoxlanır, `content:sync` ilə DB-yə köçür (slug/key ilə yenilənir, irəliləyiş qorunur). Təşkilatın öz dərsləri (studiya) yalnız DB-dədir.

## ADR-016 · Məhsulun adı Cyclowareness, demo təşkilat Safarov Industries
**Kontekst.** Portal itirilmiş cylosof.com-un yenidən qurulması kimi başladı; sahibi məhsulu öz brendi altında çıxarır.
**Qərar.** İstifadəçiyə görünən bütün mətnlərdə, metadata-da, e-poçtlarda, vebhuk başlıqlarında (`X-Cyclowareness-*`), DNS TXT nişanında (`cyclowareness-verify=`), CEF/STIX adlarında «Cyclowareness». Daxili identifikatorlar (kuki `cy_session`, localStorage `cy-*`, maskot faylları) dəyişmir. Demo tenant «Safarov Industries» (`safarov`, `safarovindustries.com`), öz SVG loqosu ilə; əvvəlki agentliyin loqosu portaldan çıxarılıb.
**Nəticə.** `docs/audit` orijinal saytın sənədi kimi dəyişməz qalır.

## ADR-017 · Brauzerdə Azərbaycan dili üçün tarix formatı özümüzdədir
**Kontekst.** Chromium (Chrome, Edge, Playwright, tətbiqin daxili brauzeri) ICU məlumatında `az` lokalını daşımır: `Intl.DateTimeFormat("az")` «2026 M10 14», `Intl.RelativeTimeFormat("az")` «-6 h» qaytarır. Server (Node, tam ICU) isə «14 okt 2026» / «6 saat öncə» verir — nəticədə həm səhv mətn, həm də hidrasiya uyğunsuzluğu yaranırdı.
**Qərar.** Server komponentləri `getFormatter` ilə qalır. Müştəri komponentləri `useClientFormat()` (`src/lib/client-format.ts`) istifadə edir: `az` üçün `src/lib/az-format.ts` ICU-nun `az` şablonlarını (short/medium/long/full, saat, «dünən», «keçən həftə» və s.) tətbiqin saat qurşağında özü qurur, digər dillər next-intl-ə ötürülür. `tests/az-format.test.ts` nəticələri Node ICU ilə müqayisə edir. Nisbi vaxtlar `<RelativeTime>` ilə yalnız hidrasiyadan sonra göstərilir.
**Nəticə.** Müştəri tərəfində `Intl`/`useFormatter`/`toLocale*` birbaşa işlədilmir (fixer qaydası); yeni tarix formaları `az-format.ts`-ə əlavə olunur və testlə Node ICU-ya bərabərliyi yoxlanılır.

## ADR-018 · Xarici ünvanlar yalnız açıq internetdə, xətalar ümumi kateqoriyada
**Kontekst.** Tenant adminləri SMTP serveri, vebhuk ünvanı və syslog serveri verir. Çox-tenantlı mühitdə müştəri platforma serverindən öz daxili şəbəkəsini (loopback, RFC1918, metadata ünvanları) yoxlaya və xam xəta mətnindən port vəziyyətini öyrənə bilərdi.
**Qərar.** `src/server/net-guard.ts`: ünvan saxlananda və hər qoşulmadan əvvəl (poçt, iş növbəsi) DNS həll edilir, loopback/özəl/link-local/CGNAT/multicast və `.local`/`.internal` adları rədd edilir, portlar məhduddur (SMTP 25/465/587/2525, vebhuk 443/8443, syslog 514/601/6514). SMTP test xətaları `connection_failed`/`auth_failed`/`tls_error`/`send_failed` kateqoriyalarına çevrilir. Eyni dövrədə: «adminlər 2FA işlətməlidir» qaydası səhifə ilə yanaşı bütün server aksiyonlarında (`actionViewer(permission)`) və API marşrutlarında (`apiViewer`) tətbiq olunur; marşrut parametrlərində ID-lər `isUuid` ilə ciddi yoxlanılır.
**Nəticə.** Lokal SMTP ilə sınaq (`localhost:1025` kimi) mümkün deyil — tərtibatda poçt jurnala yazılır; real test üçün açıq serverdir.

## ADR-019 · Sürət limitləri bazada, təkrar təlim sübutu və şəxsin real başlanğıcı
**Kontekst.** Sürət limitləri prosesin yaddaşında idi — iki instansiya ilə (və ya restart-dan sonra) limit faktiki işləmirdi. Fişinq klikindən sonra açılan risk «son dərs keçildi» kimi bağlanırdı, yəni təlimin yenidən keçilməsi sübut olunmurdu. Xatırlatma və «qoşulduqdan sonra N gün» son tarixi hesabın yaradılma anından sayılırdı — dəvəti gec qəbul edən və ya şöbəyə sonradan köçürülən şəxs ilk gündən gecikmiş görünürdü.
**Qərar.** (1) `rate_limit_buckets (key, window_start, count)` cədvəli: hər çağırış bir atomik `INSERT … ON CONFLICT DO UPDATE … RETURNING count`, pəncərələr `windowMs`-ə hizalanır, 1 saatdan uzun pəncərə qadağandır, gündəlik iş köhnə pəncərələri silir; `rateLimit` asinxrondur, yaddaşdaxili variant yalnız vitest-də. (2) `lesson_progress.last_completed_at`: təkrar keçmə XP vermir, yalnız bu sütunu irəli çəkir; modulun açıq riski yalnız **bütün** dərslərin `last_completed_at`-ı riskin yaranmasından sonra olanda bağlanır. (3) `users.activated_at` (dəvət qəbulu, SSO ilk girişi, admin aktivasiyası) və `users.department_changed_at` (yalnız şəxsi yeni şöbə tapşırığının əhatəsinə salan dəyişikliklərdə): xatırlatma saatı və «qoşulduqdan sonra» son tarixi `max(created_at, activated_at)`-dan, şöbə tapşırıqları üçün isə şöbə dəyişikliyindən sayılır. Sertifikat seriyasının ili Bakı gününə görədir.
**Nəticə.** `drizzle/0000_init.sql` ilk istehsal yerləşdirməsinə qədər sıfırdan yenidən yaradılır (`rm -rf drizzle && npx drizzle-kit generate --name init`), sonra `db:generate` ilə əlavə miqrasiyalar; lokal baza yenidən yaradılanda `db:reset` lazımdır (`db:migrate` köhnə bazada işləmir). Bir şəxs üçün bir `department_changed_at` olduğundan, əhatəni artıran köçürmə əvvəlki şöbə tapşırıqlarının saatını da yenidən başladır (bir əlavə xatırlatma) — qəbul edilib.

## ADR-020 · Maskot, hərəkət və təlim sistemi üçün canlı istinad skill-i repoda
**Kontekst.** Orijinal portalın mənbə kodu yoxdur; «orijinaldakı kimi» tapşırıqlar hər dəfə üç mənbənin (spesifikasiya `docs/audit`, mövcud kod, istək) yenidən öyrənilməsini tələb edirdi. Bu sahədə çox sayda tapşırıq gözlənilir.
**Qərar.** `.claude/skills/cyclowareness-experience/` layihə skill-i: `SKILL.md` (ümumi qaydalar, iş üsulu, lüğət, açıq boşluqlar) və dörd istinad sənədi — `mascot.md`, `animations.md`, `lesson-engine.md`, `training-pipeline.md`; hər biri «orijinal nə edirdi / indi necədir / tələlər / reseptlər / boşluqlar» quruluşundadır. Sənədlər dörd tədqiqat agenti tərəfindən yazılıb, dörd rəqib yoxlayıcı hər yolu və iddianı koda qarşı yoxlayıb düzəldib; sınaq planlarında skill-lə 95%, skill-siz 90% dəqiqlik və tapşırıq başına ~2,4 dəqiqə qənaət ölçülüb.
**Nəticə.** Bu sahələrdə dəyişiklik edən hər tapşırıq əvvəl uyğun istinadı oxuyur və sonda onu yeniləyir (fayl xəritəsi sürüşə bilər); `docs/audit` yenə də toxunulmazdır, skill onun şərhidir, əvəzi deyil.

## ADR-021 · Planlaşdırılan vaxtlar Bakı vaxtı ilə
**Kontekst.** Kampaniya sehrbazı və canlı sessiya redaktoru tarix/saatı brauzerin saat qurşağında oxuyurdu, siyahılar və göndəriş isə Asia/Baku ilə göstərilirdi. UTC+4-dən kənarda olan admin üçün «10:00» başqa Bakı saatında göndərilirdi. Ay sonu sayğacı da serverin (Docker-də UTC) günü ilə hesablanırdı.
**Qərar.** Bütün planlaşdırma sahələri Bakı vaxtı (+04:00) kimi doldurulur və oxunur (`src/lib/baku-clock.ts`, Intl-siz hesab), sahənin yanında «Bakı vaxtı (UTC+4)» ipucu göstərilir. Gün sərhədi tələb edən hər hesab `todayInBaku()` / `dayKey()` ilə aparılır.
**Nəticə.** Tenant səviyyəsində saat qurşağı seçimi gələcəkdə bu köməkçini tenant zonası ilə parametrləşdirməklə əlavə oluna bilər; indi bütün tenantlar Bakı vaxtındadır.

## ADR-022 · AI Sel pişik kimi (sınaq), Rive geri qaytarıla bilər
**Kontekst.** Sahib öz pişiyinə bənzəyən maskotu təsdiqlədi (`design/mascot-cat/final.html`) və onu bütün yerlərdə görmək istədi; qərar (pişik, ördək və ya Rive) hələ verilməyib (OPEN-QUESTIONS 21). Rive robotu 28 jest, nişan bucağı, mövzu əşyaları ilə işləyir; pişik Canvas 2D skeletidir: 14 əhval, 12 jest, yalnız sola/sağa/aşağı göstərmə, mövzu əşyası yoxdur.
**Qərar.** `Mascot` API-si dəyişmir (yalnız istəyə bağlı `facing` əlavə olunub, Rive onu qəbul edib nəzərə almır); `mascot.tsx` yeganə keçid nöqtəsidir. Mühərrik `portal/src/components/mascot/cat/engine.js` dizayn mənbəyinin əl ilə köçürülmüş nüsxəsidir (ESLint-dən kənar, tipləri `engine.d.ts`-də), propların xəritəsi `cat/props.ts`-də saf funksiyalardır və test olunur. Hərəkətsiz rejim (profil «still» və ya OS reduced motion) pişiyi tam dondurur, amma tutulan göstəriş və baxış statik poza kimi qalır.
**Nəticə.** Geri qayıtmaq üçün `mascot.tsx`-də `"./cat-mascot"` → `"./rive-mascot"`; `/rive/` faylları və CSP toxunulmayıb. Dizayn dəyişikliyi həm `design/mascot-cat/source`-da, həm də `cat/engine.js`-də edilməlidir. Ətraflı: `.claude/skills/cyclowareness-experience/references/mascot.md` §6.

## ADR-023 · Dərslər üç dildə: ayrıca fayllar, paritet yoxlayıcısı və səs qaydası
**Kontekst.** Orijinalda dərslər AZ, EN və RU dillərində idi. Bərpada yalnız `.en.json` faylları var idi, ona görə az və ru öyrənənlər ingiliscə səhnələr görürdü (OPEN-QUESTIONS 6). Canlı tenantdan çıxarmaq əvəzinə dərslər peşəkar tərcümə ilə hazırlandı.
**Qərar.** Hər dərsin yanında `<dərs>.az.json` və `<dərs>.ru.json` faylları var. Yalnız öyrənənin gördüyü və eşitdiyi mətn açarları dəyişə bilər (`src/lib/content/locale-parity.ts`, `TRANSLATABLE`; bura `app`, `to` və `brand` də daxildir). İd-lər, spot-lar, cavablar, keçidlər və rəqəmlər eyni qalır. Ünvan, domen və URL-lər mətnin içində olsa belə dəyişmir (`addressTokens`). Kodda identifikator kimi işlənən `app` dəyərlərinə (`APP_IDENTIFIERS`: whatsapp, telegram, generic, chat) toxunulmur. `scripts/check-lesson-locales.ts --coverage` hər faylı sxem, bütövlük və paritet üzrə yoxlayır. `syncLibrary` üç dili `lesson_contents` cədvəlinə yazır. `pickLessonContent` əvvəl öyrənənin dilini, sonra ingilis dilini, sonra mövcud olan dili seçir. Pleyer, tutor və ev maskotu mətnin dilini bilir. Cihazda həmin dilin səsi yoxdursa, dərs yanlış dilin səsi ilə oxunmur, əvəzində bildiriş göstərilir (Edge tövsiyəsi). Tərcümə prosesi: hər 7–9 dərslik qrup üçün tərcüməçi və müstəqil doğma redaktor işləyir, sonda terminologiya vahidləşdirilir. Glossary-lər `.claude/skills/cyclowareness-experience/references/lesson-engine.md`, resept 6.3-dədir.
**Nəticə.** 106 dərs × az, ru = 212 fayl, hamısı yoxlamadan keçir. Dərsi dəyişən hər kəs üç faylı birlikdə yeniləməli və yoxlayıcını işə salmalıdır. Dəyişiklik bazaya `npm run content:sync` ilə çatır, bunun üçün dev server dayandırılmalıdır. 3100 və 3200 surətləri ayrıca yenilənir. Azərbaycan səsinin keyfiyyəti cihazdan asılıdır (OPEN-QUESTIONS 2).

## ADR-024 · İnterfeysin lokallaşdırılması üzrə qərarlar
**Kontekst.** İnterfeys yoxlamasında 6 sahə üzrə axtarışçılar, 4 doğma redaktor və brauzerdə 3 dildə yoxlama işlədi. Onlar e-poçtlarda, bildirişlərdə, hesabatlarda, ixracda və dil seçimində ingiliscə qalıqlar və uyğunsuz terminlər tapdı.
**Qərar.**
1. Dil seçimi: daxil olmuş istifadəçidə profil dili, təşkilatın açdığı dillər daxilində. Sonra cookie, sonra brauzer dili gəlir. Dəstəklənməyən brauzer dili Azərbaycandan kənarda ingilis dilinə keçir, `tr` az dilinə, `uk/be/kk/ky/uz` isə ru dilinə (`src/i18n/config.ts`). SSO `ui_locales` göndərir.
2. E-poçt və bildirişlər alıcının öz dilində və `<html lang>` ilə gedir. İş icraçısı üçün köməkçi `src/i18n/translator.ts`-dədir (`messagesFor`).
3. Terminlər:
   - az: sandbox «Yoxlama mühiti», öyrənən səhifəsində «Təhlükəsiz yoxlama mühiti»; webhook «Vebhuk»; «fleş kart».
   - ru: canlı sessiyalar «Встречи», policy intelligence «Нормативный мониторинг».
   - en: hər yerdə «two-step verification».
4. Brauzerdə açılan API linkləri istifadəçini girişə yönləndirir, sonra yükləməyə qaytarır.
5. Siyasət versiyası hər açıq dil üçün tərcümə daşıya bilər. Baza dili `translations` içindəki `base: true` nüsxəsi ilə qeyd olunur (`src/lib/policy-text.ts`), yeni sütun yoxdur. AUP və parol siyasətinin rusca mətni `content/policies/*.ru.md`-dədir.
6. Sertifikatın başlıq və mətni dil üzrə saxlanılır.
7. Azərbaycan dilində nisbi vaxt «… əvvəl» və «… sonra» kimi yazılır: müştəridə `formatAzRelative`, serverdə `getAppFormatter`. CLDR-in «öncə» və «ərzində» formaları işlənmir.
8. Sistemin yazdığı risk başlıqları `behavior_risks.title` sütununda bütün dillərdə JSON kimi saxlanılır (`src/lib/risk-title.ts`). Əl ilə yazılan başlıqlar olduğu kimi qalır.
9. `common.languages` dillərin interfeys dilindəki adlarıdır. Dilin öz dilindəki adı yalnız dil seçicilərində göstərilir.
10. Laboratoriyada ipucu Azərbaycan dilində «Kömək» adlanır.
11. Chromium-da Azərbaycan rəqəmlərinin qruplaşdırması üçün FormatJS polyfill-i (`@formatjs/intl-numberformat`) işlənir (`src/i18n/az-numbers.ts`, `AzNumbersGate`). O, yalnız az səhifəsində və yalnız brauzer az formatını səhv göstərəndə yüklənir. Server və en/ru səhifələri ona toxunmur. Bu qərar ADR-017-nin davamıdır.
12. Standart istinadlarında «Art.» az dilində «maddə», ru dilində «ст.» kimi göstərilir (`src/lib/standards.ts`). Verilənlər bir dəfə saxlanılır.
**Nəticə.** Demo verilənlərində əl ilə yazılmış adlar (insident, şöbə və kampaniya adları) yalnız azərbaycancadır, çünki real təşkilatlar bunları özləri yazır. Hüquqi mətnlər (Şərtlər, Məxfilik) hələ yalnız AZ dilindədir (OPEN-QUESTIONS 8).
