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
**Qərar.** `@anthropic-ai/sdk`. Studiya qaralaması üçün model `ANTHROPIC_MODEL` (default `claude-opus-5-5`), müəllim üçün ayrıca `ANTHROPIC_TUTOR_MODEL` (default `claude-haiku-5-5`, düşünmə söndürülüb, `max_tokens` 1024, sistem promptu və dərs konteksti prompt keşindədir). Müəllimə yalnız dərs konteksti gedir, cavablar keşlənir (yalnız model cavabı normal bitirəndə, `end_turn`), açar yoxdursa dərs mətnindən cavab. Studiya qaralaması `tool_use` ilə strukturlu gəlir, zod ilə yoxlanır və həmişə qaralama kimi saxlanır; Sİ materialı təsdiq mərhələsindən keçmədən əməkdaşa çatmır.
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

## ADR-025 · Portal 10 dildə, ərəb dili sağdan sola
**Kontekst.** Portal Səudiyyə Ərəbistanında da satılacaq, tətbiq isə yalnız AZ/EN/RU dillərində idi (OPEN-QUESTIONS 7). Öyrənən və ya admin istənilən dili seçəndə hər şey ona uyğunlaşmalıdır: istiqamət, şrift, rəqəm, tarix, e-poçt, sertifikat, Sİ müəllimi və səsləndirmə.
**Qərar.**
1. `LOCALES` = az en ru tr ro ka uk de fr ar (`src/i18n/config.ts`), `SITE_LOCALES` eyni siyahıdır. İtalyan dili (`it`) hər yerdən, ictimai saytdan da çıxarılıb. `tr` və `uk` artıq öz dilləridir, `be/kk/ky/uz` ru dilinə keçir (ADR-024 bənd 1-i əvəz edir). Yeni təşkilatlarda və demo seed-də 10 dil açıqdır.
2. Formatlama `ar` kodu ilədir: Qərb rəqəmləri 0-9 və Qriqorian təqvimi. `ar-SA` yalnız nitq teqidir (səsləndirmə və nitq tanıma).
3. İstiqamət: `dirOf` yalnız `ar` üçün `rtl` qaytarır. Məzmun dili səhifənin dilindən fərqli ola bilən elementlər `langAttrs` (`lang` və `dir`) alır. Tailwind sinifləri məntiqidir (`ms/pe/start/end/text-start`), fiziki sinifləri `tests/rtl-logical.test.ts` tutur.
4. Qrafiklər (AreaChart, Sparkline) RTL-də güzgü kimi çevrilir, trend oxları da onlarla birgə.
5. Laboratoriyanın VM masaüstü soldan sağa işləyən simulyasiya ƏS-i kimi qalır (`dir="ltr"`). Poçtun və veb səhifəsinin mətni öz dilinin istiqamətini alır. Kod, terminal, URL, e-poçt ünvanı, telefon, IBAN, hash, IP və OTP həmişə soldan sağadır (`dir="ltr"` və ya `<bdi>`).
6. Maskotun daxili hissələri fizikidir və CSS ilə güzgülənmir. RTL-də yalnız baxış istiqaməti və `point-left/right` jestləri dəyişir (`cat-mascot.tsx`, `mirrorForRtl`).
7. Gürcü və ərəb şriftləri (Noto Sans) əvvəlcədən yüklənmir. Ərəb mətnində ərəb şrifti birinci gəlir. `/og/ar` ingiliscə kartı göstərir, çünki Satori ərəb hərflərini birləşdirmir.
8. E-poçtlar ərəb dilində `dir="rtl"` ilə və sağa düzlənmiş mətnlə gedir. Sİ müəllimi və studiya hər dilin öz üslub qaydası ilə yazır (`src/server/tutor.ts`).
**Nəticə.** Heç nə yerləşdirilmədiyi üçün mövcud təşkilatlara miqrasiya yoxdur, lokal baza yenidən seed olunacaq. Yeni UI açarı 10 dilin hamısına əlavə olunmalıdır.

## ADR-026 · Yeni yeddi dilin tərcümə prosesi; hekayələr Azərbaycan şirkətində qalır
**Kontekst.** ADR-025 interfeysi 10 dilə açdı. tr, ro, ka, uk, de, fr və ar üçün hər şey lazım idi: interfeys mesajları, koddakı mətnlər, hüquqi mətnlər, siyasətlər, ərəbcə landing və 106 dərsin hər biri (7 × 106 = 742 fayl). Hərfi tərcümə və eyni anlayış üçün fərqli terminlər qəbuledilməz idi.
**Qərar.**
1. Əvvəl lüğət. Hər dil üçün terminoloq glossary yazır: terminlər, müraciət forması, dırnaq, rəqəm və tarix qaydaları, personaj adlarının yazılışı. Müstəqil doğma rəyçi onu yoxlayıb düzəldir. Glossary-lər `.claude/skills/cyclowareness-experience/references/glossaries/<dil>.md`-dədir, sonundakı «Reviewer notes» edilən və açıq qalan seçimləri yazır.
2. Hər iş vahidi (interfeys namespace-i, hüquqi mətn, siyasət, 13 dərs qrupunun hər biri) üçün tərcüməçi və ondan asılı olmayan redaktor işləyir. Redaktor mətni ingiliscə ilə yan-yana oxuyur. Sonra iki vahidləşdirmə keçidi gəlir: dərslərin terminologiyası və interfeysin terminologiyası. Ən sonda yekun keçid edilir. Skriptlər `docs/build/workflows/`-dadır: `localize-language.js`, qalan redaktorlar üçün `finish-editors.js`.
3. Maşın yoxlaması: `scripts/check-lesson-locales.ts --coverage` (sxem, bütövlük, paritet, ünvanlar; 954/954 = 106 × 9), `check-messages.mjs` (açarlar, ICU, placeholder-lər), `tests/i18n.test.ts`, `tests/in-code-locales.test.ts` (koddakı mətnlər 10 dildə), `tests/legal-content.test.ts`. Yoxlayıcı üslubu qiymətləndirə bilmir, ona görə redaktor mərhələsi buraxılmır.
4. Hekayələr bütün dillərdə Azərbaycan şirkət dünyasında qalır: Safarov Industries, manat/AZN, +994 nömrələri, Azərbaycan qurumları. Uydurma brendlər (NeyroSöhbət, SahilBank) dəyişmir. Personaj adları hər dilin öz yazılışı ilə verilir: tr «Leyla Memmedova», ro ASCII ingilis forması «Leyla Mammadova», uk «Лейла Мамедова». E-poçt ünvanlarında və identifikatorlarda adlar dəyişmir. Səbəb: məhsul və demo tenant Azərbaycan şirkətidir, tələ əlamətləri (domen, IBAN, təcililik, göndərən) dildən asılı deyil. Hər bazar üçün ayrıca hekayə isə yeddi qat iş və ayrıca yoxlama deməkdir.
**Nəticə.** 7 dilin hamısında tərcüməçi, redaktor və vahidləşdirmə keçidləri 2026-11-04-də bitdi. Bunu Sİ agentləri edib: doğma dildə danışan insanın son baxışı və hüquqi mətnlər üçün hüquqşünas hələ lazımdır (OPEN-QUESTIONS 7, 8). Bir bazar öz yerli hekayələrini istəsə, bu ayrıca qərar və yeni dərs faylları deməkdir. Yeni dil əlavə etmək resepti: `lesson-engine.md`, resept 6.3.

## ADR-027 · Təlim yollarında laboratoriyalar dərslərdən sonra gəlir
**Kontekst.** Laboratoriyalar (`/lab`: dörd oyun və üç virtual maşın) yollardan ayrı idi. Yolda praktika görünmürdü, öyrənən onu nəzəriyyədən əvvəl edə bilirdi.
**Qərar.**
1. `learning_paths.lab_ids` (jsonb, default `[]`), `paths.json`-da hər yolun `labs` siyahısı. `syncPaths` naməlum lab id-sini rədd edir. Admin yol redaktoru (`PathEditor`) modullardan sonra lab seçimini göstərir (`lab` funksiyası olan tenantlarda), `savePathAction` yalnız `LAB_IDS`-i qəbul edir.
2. Qayda `src/lib/domain/labs.ts`-dədir (saf kod, test olunur). `LAB_MODULES` hər labın məşq etdiyi modulları verir. Lab yolda öz modullarının dərsləri bitəndə açılır: yolda olan öz modulları, heç biri yoxdursa yolun bütün modulları (`awaiting_attestation` və ya `completed`). Ən yaxşı cəhd maksimumun 70%-nə çatanda lab keçilmiş sayılır (`LAB_PASS`). Dərslərdən əvvəl keçilmiş lab kilidli göstərilmir.
3. Bu, yalnız göstərmə qaydasıdır: `/lab` sərbəst məşq yeri kimi açıq qalır, server heç bir labı bloklamır.
4. Laboratoriyalar sertifikata və yolun `done` sayına daxil deyil. Yol sertifikatı əvvəlki kimi yalnız modullarla verilir.
5. Modul səhifəsi (`/learn/[slug]`) yenidən quruldu: «Nə öyrənəcəksiniz» (dərslərin recap bəndləri, öyrənənin dilində), dərslər, «Təcrübədə sınayın» (bu modulu məşq etdirən lablar, dərslər bitənə qədər kilidli), «Təlim yollarında» (modulun daxil olduğu yollar) və yol konteksti (`?from=/paths/<key>` ilə gələndə yola qayıdış və növbəti modul).
**Nəticə.** Lab nəticəsi uyğunluq sübutu deyil. «Yol lab keçilmədən bitmir» kimi tələb gəlsə, sertifikat qaydası yeni ADR ilə dəyişməlidir. `lab` funksiyası olmayan tenantda yollarda lab görünmür.

## ADR-028 · Təbii səsləndirmə: ElevenLabs klipləri, ehtiyat kimi Web Speech (ADR-007-nin davamı)
**Kontekst.** Web Speech-in keyfiyyəti cihazdan asılıdır: Windows-da Chrome-un Azərbaycan səsi yoxdur və az dərsləri susurdu. Orijinalda hər cümlə söz zamanları olan klip idi. İndi 10 dil var.
**Qərar.**
1. `scripts/generate-narration.ts` hər dərsin oxunan hər mətnini dil başına bir klip kimi yaradır. Mətnlərin siyahısı `src/lib/tts/spoken.ts`-dəki `spokenTexts`-dir, `scenes.tsx`-dəki `speak()` çağırışlarının güzgüsüdür. Provayder ElevenLabs `text-to-speech/{voice}/with-timestamps`, model `eleven_v3` (10 dilin hamısını, az və ka da daxil, oxuyan model). Simvol zamanlarından söz zamanlarını `wordTimings` çıxarır, karaoke indeksləri `wordsOf` ilə eynidir (kiril, gürcü, ərəb hərfləri də).
2. Klip `public/generated/tts/<dil>/<sha256>.mp3`-dir. Adı dil, model, səs, mətn və `TTS_REVISION`-dan hesablanır, ona görə fayl `immutable` keşlənir. Dəyişən mətn yeni fayl olur, təkrar işə salmada yalnız yeni mətnlər pul tələb edir. Manifestlər `content/narration/<dil>/<modul>__<dərs>.json`-dadır və ictimai fayl deyil, çünki dərs mətnini daşıyır. `src/server/narration.ts` onları oxuyur, dərs səhifəsi pleyerə yalnız həmin dərsin kliplərini verir. Studiya dərslərinin klipi yoxdur.
3. `useNarrator` klipi olan mətni klipdən oxuyur (sürət və səs səviyyəsi dərhal tətbiq olunur), qalanını Web Speech ilə. Klip açılmasa, Web Speech-ə keçir. Dil qaydası (ADR-023) qalır.
4. Açar (`ELEVENLABS_API_KEY`) və səslər (`ELEVENLABS_VOICE_ID`, `ELEVENLABS_VOICE_<DİL>`) yalnız skript üçündür, server onları görmür. ElevenLabs default səsləri 2026-12-31-də çıxarır, ona görə kodda səs yoxdur. Hər dilin səsini həmin dilin doğma danışanı Voice Library-dən seçir və əvvəlcə bir nümunə dərsə (`--only`) qulaq asır.
5. Xərc: `--dry-run` dəqiq hesablayır. 2026-11-04-də 10 dil üçün 37 724 klip, 4,01 mln simvol çıxdı: 1000 simvol üçün ~0,08 USD ilə ~321 USD (dil başına 26–38 USD). Real qiyməti ElevenLabs planı müəyyən edir.
**Nəticə.** Kliplər hələ yaradılmayıb (açar və səs seçimi yoxdur, OPEN-QUESTIONS 2), indi hər yerdə Web Speech oxuyur. Səs dəyişsə, həmin dilin bütün klipləri yenidən yaradılır. Skript image qurulmadan əvvəl işə salınmalıdır ki, hər iki qovluq image-ə düşsün. Resept: `lesson-engine.md` 6.6.

## ADR-029 · Kitabxanada olmayan dillər üçün Sİ altyazıları
**Kontekst.** Öyrənən dərsi bir dildə dinləyib altyazını başqa dildə oxumaq istəyə bilər. 10 dildən kənar dillər (ispan, italyan, hind və s.) üçün dərs faylı yoxdur.
**Qərar.**
1. Altyazı dili 10 dildən biridirsə, mətn saxlanmış tərcümədən gəlir (`loadCaptionsAction`, `captionMap`), model çağırılmır.
2. Digər dillər üçün `POST /api/subtitles` (`src/server/subtitles.ts`). `SUBTITLE_LANGUAGES` 65 ISO 639-1 kodudur və yalnız bunlar qəbul olunur, çünki kod prompta düşür. Modelə yalnız pleyerin həmin öyrənən üçün oxuduğu dərs mətninin sətirləri gedir, şəxsi məlumat getmir. Bir çağırışda `save_subtitles` aləti hər mənbə sətrinə bir tərcümə qaytarır, say və uzunluq yoxlanır (`validTranslation`). Model `ANTHROPIC_TUTOR_MODEL`-dir.
3. Nəticə `ai_cache` cədvəlində saxlanır (`kind: "subtitles"`). Sətrin id-si dərsdən, mənbə və hədəf dilindən və mənbə sətirlərinin hash-indən hesablanır: mətn dəyişəndə yeni sətir yaranır, bir tərcümə isə bütün öyrənənlərə xidmət edir. Eyni prosesdə eyni id üçün ikinci sorğu birincini gözləyir (`translateOnce`).
4. Limitlər: sorğu öyrənən başına 60/10 dəq. Model çağırışı öyrənən başına 6/10 dəq və 30/gün, təşkilat başına 300/gün. 30 000 simvoldan uzun mətn rədd olunur. `ai_tutor` funksiyası olmayan tenantda bu dillər təklif olunmur, açar olmayanda cavab `ai_unavailable` (503) olur.
5. `RTL_LOCALES` fa, he, ps və ur altyazıları üçün də `rtl` verir (ADR-025 bənd 3-ün genişlənməsi): altyazı və transkript `langAttrs` alır.
**Nəticə.** Sİ altyazılarını insan yoxlamır, pleyer bunu bildirir (`player.captionAiNote`). `ANTHROPIC_API_KEY` olmadan canlı sınanmayıb (OPEN-QUESTIONS 1). Bir neçə replikada eyni tərcümə iki dəfə edilə bilər, gündəlik limitlər bunu məhdudlaşdırır (kodda `shortcut` qeydi var).

## ADR-030 · Dərs pleyerinin quruluşu
**Kontekst.** Pleyer tək sütun idi: sürət, səs və ⋯ düymələri. Modulun dərsləri və dərsin hissələri, səs səviyyəsi, sürət seçimi, altyazılar, transkript və klaviatura idarəsi lazım idi.
**Qərar.**
1. Sillabus («Mündəricat», `syllabus.tsx`): modulun dərsləri və cari dərsin hissələri (səhnələr). lg və daha geniş ekranda yan paneldir (açıq və ya relsə yığılmış, `cy:syllabus`), kiçik ekranda başlıqdakı düymə ilə açılan çəkmə paneldir (`drawer.tsx`, native `<dialog>`). Sillabusda yalnız çatılmış hissələr açılır, hələ çatılmamış hissəyə keçmək olmaz.
2. Başlıqda: oynat/dayandır, səs (xl-də səs səviyyəsi sürgüsü), sürət (0,75–2×), altyazılar, transkript, tam ekran. ⋯ dialoqunda eyni idarəetmələr, altyazı dili, qısayollar, hərəkət seçimi və problem bildirişi var. Brauzer seçimləri `localStorage`-dədir (`cy:speed`, `cy:volume`, `cy:captions`, `cy:caption-lang`, `cy:shortcuts`) və `useSyncExternalStore` ilə hidrasiya-təhlükəsiz oxunur. Səsin açıq və ya bağlı olması əvvəlki kimi server seçimidir.
3. Altyazılar oxunan sətri göstərir (`captions.tsx`). Sətir ayrıca store-dadır, söz dəyişəndə yalnız altyazı və transkript yenilənir. Öz dilində altyazı söz-söz dolur, tərcümə isə oxunan sözlərin payı ilə. Transkript («Dərsin mətni») çatılmış sətirləri göstərir və onları yenidən oxuda bilir.
4. Qısayollar (`controls.ts`, test olunur): Space oynat/dayandır, oxlar oxu istiqamətində (RTL-də sol ox irəli), M səs, C altyazılar, T transkript, S sillabus, ? kömək. Hərf qısayolu klaviş qapağındakı hərfdir, qeyri-latın düzülüşdə isə QWERTY yeri. Nitqlə idarə edənlər üçün hərf qısayolları söndürülə bilər (WCAG 2.1.4). Mətn sahələrinə, sürgülərə, menyulara və dialoqlara gedən düymələrə toxunulmur.
5. `maxIndex` (ən uzaq çatılan səhnə) yalnız müştəridədir: `sessionStorage`-dəki vəziyyətdə saxlanır (`resume.ts`) və naviqasiyanı məhdudlaşdırır. Server `completeLessonAction`-da hansı səhnələrin keçildiyini yoxlamır.
**Nəticə.** Brauzer alətlərini bilən öyrənən dərsi səhnələrə baxmadan bitmiş kimi göndərə bilər. Bu, əvvəldən belə idi və sertifikat sübutu üçün zəif yerdir (OPEN-QUESTIONS 25). Pleyerin yeni mətnləri 10 dildə `player.json`-dadır.

## ADR-031 · Nağıl üslubunda pişik və dekorativ yerlərdə öz-özünə hərəkətlər (ADR-022-nin davamı)
**Kontekst.** Sahib pişiyin daha isti, nağıl kitabı görünüşündə olmasını, çoxlu hərəkət etməsini və ev səhifəsində onunla oynamağı istədi.
**Qərar.**
1. Mühərrik (`cat/engine.js`, mənbə `design/mascot-cat/source`) yeni rəsm və oynaqlar aldı. Yeni davranışlar: doze, blink, tilt, stretch, roll, chase-tail, pounce, knead, oyuncaq siçan və yumaq (`play("mouse" | "yarn")`), lazer nöqtəsi (`laser()`), qaçış (`run()`). `act` propu yeniləri `ACT_TO_CAT` ilə ötürür.
2. `auto` propu yalnız dekorativ yerlər üçündür: ev kartı, landing-də boş dayanan scroll pişiyi, giriş paneli, təhlükəsizlik icmalı. Orada pişik öz-özünə yaşayır (`setAuto`, çəkilər `mascotAutoWeights`). Danışan yerlərdə (pleyer, turlar, tutor) `auto` yoxdur. Danışma öz-özünə hərəkəti dayandırır, `auto` sönəndə pişik oturmağa qayıdır.
3. Hərəkət seçimi: Still və OS reduced motion pişiyi dondurur, canlı hərəkətlər başlamır (`do()` false qaytarır). Calm yalnız sakit hərəkətləri saxlayır: oturmaq, göz qırpmaq, yalanmaq, knead, uzun boşluqdan sonra yuxu; lazerə yalnız baxır və çömbəlir. Qayda `actAllowed`-dadır.
4. Ev səhifəsində «Sel ilə oyna» kartı (`home-mascot.tsx`): siçan, yumaq və lazer düymələri, yalnız Full-da. Lazer bu ziyarət üçün açılır, Escape onu bağlayır. Pişik arabir kartın o biri tərəfinə qaçır. Kart tutor dialoqunu da açır, dialoq açıq olanda pişik dayanır.
5. `Mascot`-a iki prop əlavə olundu: `auto` və `onCat` (mühərrik instansiyası, `jump()`/`run()` üçün). İkisi də yalnız pişik sarğısındadır: Rive-a qayıtmaq üçün `rive-mascot.tsx` onları qəbul etməli və ya çağırış yerlərindən çıxarılmalıdır, yoxsa `tsc` səhv verir.
**Nəticə.** Maskotun qəti seçimi hələ sahibindədir (OPEN-QUESTIONS 21). Ətraflı: `mascot.md` §6.6.

## ADR-032 · İşıq və hərəkət təməli
**Kontekst.** Sahib portalın hər yerində işıq və canlı animasiya istədi. Full/Calm/Still seçimi və OS reduced motion pozulmamalı idi, `calm` isə əvvəl JS-də heç yerdə oxunmurdu.
**Qərar.**
1. Tokenlər `globals.css` `@theme`-dədir: `animate-sweep` (bir dəfə keçən işıq zolağı), `animate-sheen` (dövri), `animate-glow`, `animate-breathe`, `animate-aurora`, `animate-burst`, `animate-fly-up`. Hər keyframe-in 100% kadrı sükunət vəziyyətidir, çünki Still hər animasiyanı bir dəfəlik 1 ms-ə endirir.
2. Dekorativ qatlar boş `aria-hidden` elementdir, qutuda `isolate` lazımdır: `.aurora`, `.light-sweep` (`.after-count` sayğac bitənə qədər gözləyir, `CountUp` plitəni `data-counted` ilə işarələyir), `.spotlight`, `.glow-ring`, `.burst`. Rəng `--light` və `--light-2`-dəndir (default brend və aksent). `.light-on-brand` brend fonda oxunaqlı rəngin zəif yuyulmasıdır, kontrast 4.5:1 qalır. İstiqamət `--sweep` ilə verilir: RTL-də işıq sağdan sola keçir. Çapda hamısı gizlidir.
3. Variantlar: `motion-ok:` (Still və OS reduced motion xaricində) və `motion-full:` (yalnız Full). Tailwind-in `motion-safe:`-indən fərqli olaraq `<html data-motion>`-a da baxırlar.
4. JS: `src/lib/motion.ts` (`motionLevel`, `readMotion`, `useMotion`; server snapshot Full-dur, OS reduced motion Still sayılır). `src/components/ui/light.tsx`: `Burst` (12 hissəcik, yalnız Full), `Spotlight` (göstəricini izləyən disk, yalnız siçan və qələm), `flyToXp` (XP nişanını başlıqdakı XP-yə uçurur, yalnız Full; hələ çağıran yoxdur). `CountUp` `src/components/ui/count-up.tsx`-ə köçdü.
5. Still: hər CSS animasiya və keçid bir kadrdır, `.spotlight` gizlidir, JS effektləri işləmir. Calm: sheen, breathe, aurora, float və blink dövrləri dayanır, `.burst` və `animate-fly-up` gizlənir, uzun müddətlər qısalır; birdəfəlik sweep və glow qalır. Semantik parıltılar öz rəngini saxlayır (düzgün cavab yaşıl, liqa kuboku qızılı), brend rənginə keçmir.
**Nəticə.** `tests/motion.test.ts`, `tests/learner-light.test.ts` və `tests/admin-light.test.ts` qaydaları yoxlayır. Yeni animasiya bu tokenlərdən və variantlardan istifadə etməlidir (`animations.md` §8).

## ADR-033 · 2026-10-27 təhlükəsizlik sərtləşdirməsi
**Kontekst.** Məhsul banklara və dövlət qurumlarına satılır, ona görə özü təhlükəsiz olmalıdır. 2026-10-26-da altı sahə üzrə (autentifikasiya, icazələr və tenant izolyasiyası, inyeksiya, xarici sorğular, platforma, sui-istifadə) yalnız oxuyan auditorlar və bir asılılıq tədqiqatçısı işlədi. Hər tapıntını müstəqil yoxlayıcı təkzib etməyə çalışdı. Nəticə 38 tapıntı oldu: 36 təsdiqlənmiş, 2 qeyri-müəyyən, onlardan 5-i yüksək.
**Qərar.** 2026-10-27-də düzəldilənlər:
1. Autentifikasiya. 2FA və telefon kodu cəhdləri atomik sayılır, paralel sorğular 5 cəhddən çox vermir. Ehtiyat kod bir şərtli update ilə xərclənir və `APP_SECRET`-dən törənən açarla HMAC kimi saxlanır. Kilid hesab və müştəri ünvanı cütünə bağlıdır, başqası sahibini kilidləyə bilmir. Telefonla giriş, SSO domeni və parol bərpası qeydiyyatlı və qeydiyyatsız ünvana eyni cür və eyni sürətlə cavab verir. Parol bərpasına ünvan, ümumi və tenant limitləri qoyuldu. SSO istifadəçiləri parol və telefonla daxil ola bilmir, `email_verified` ciddi `true` olmalıdır. super_admin üçün 2FA həmişə məcburidir, yeni tenantlarda «adminlər 2FA işlətməlidir» default açıqdır, konsol rolları SMS ilə daxil ola bilmir. 2FA qoşulanda digər sessiyalar bağlanır, sessiyanın mütləq ömrü var. Bootstrap operator linkini bir dəfə çap edir.
2. İcazələr. Tenant admini (platforma təşkilatında da) super_admin-ə toxuna bilmir. Plan funksiyaları hesabatların, liqanın, təlim yollarının, QR tələsinin və insidentlərin server marşrutlarında da yoxlanır.
3. Xidmətdən imtina. Sandbox analizatorunda, Sİ təlim yoxlamasında, siyasət Markdown-unda və SVG loqo yoxlamasında kvadratik regex-lər xətti oldu (`tests/regex-dos.test.ts`). XLSX ixracı XML-də icazəsiz simvolları atır. Öyrənən aksiyonlarına limitlər qoyuldu.
4. Xarici sorğular. IPv6 ünvanı istənilən yazılışda (IPv4-mapped, NAT64) yoxlanır. Syslog və vebhuk qoşulmaları yoxlanmış ünvana bağlanır (DNS rebinding). OIDC cavablarının ölçüsü məhduddur, `/api/sso/start` limitlidir.
5. Platforma və məlumat. Hesab linkləri göndərildikdən sonra outbox-da `redacted` olur. Silinən şəxsin poçtu outbox-dan da silinir. «Məlumatlarımı yüklə» simulyasiya nəticələrini və sərbəst mətnləri də verir. Docker `node:24-trixie-slim`-dir (`--pull` ilə qurulur), worker və seed `node` istifadəçisi ilə işləyir, `POSTGRES_PASSWORD` məcburidir. README-dəki image nümunəsi `127.0.0.1` və `sslmode` ilədir.
**Açıq qalanlar.** Server aksiyonlarının 11 MB gövdə limiti ümumidir (sandbox yükləməsi üçün) və açıq ictimai aksiyonlara da aiddir. SSO hesabı yalnız e-poçtla tapılır, `sub` bağlaması yoxdur. Hüquqi mətnlər Sİ provayderi kimi Google Vertex AI-ı göstərir (OPEN-QUESTIONS 20). Bu maşında Node 24.18.0-dır, Brotli CVE-si üçün 24.22.1 və ya daha yenisi lazımdır (image `--pull` ilə yeni Node alır; OPEN-QUESTIONS 23). Dərsin bitməsi serverdə səhnələrlə yoxlanmır (ADR-030). Codex CLI bu maşında çökdüyü üçün kod baxışlarını ECC və agent-skills rəyçiləri etdi (OPEN-QUESTIONS 24).
**Nəticə.** Düzəlişlər testlərlə gəldi (`auth-security`, `feature-gates`, `outbound-guard`, `oidc-fetch`, `regex-dos`, `outbox-redact`, `me-export`, `people-operator` və s.), həmin an 1152 test keçirdi.

## ADR-034 · Canlı məşq: üç dəqiqəlik demo üçün sıxılmış vaxtda fişinq hücumu
**Kontekst.** Məhsulu müştəriyə və ya investora üç dəqiqədə inandırıcı göstərmək lazımdır. Real kampaniyanın nəticəsi iki həftəyə yığılır, ona görə demoda qapalı dövrə (klik → öyrədici izah → təlim → risk) görünmürdü.
**Qərar.**
1. Admin konsolunda «Canlı məşq» (`/admin/drill`): şablon, auditoriya və sürət (90 saniyə və ya 3 dəqiqə) seçilir, çatdırılmadan sonrakı ilk 4 saat canlı göstərilir. Məşqi başladan şəxs auditoriyaya daxil deyil.
2. Davranış əvvəlcədən planlaşdırılır (`src/lib/drill/plan.ts`, toxumla deterministik): kim açır, klikləyir, parol yazır, bildirir və təlimi bitirir, nə vaxt. Ehtimal şəxsin risk balından və şablonun çətinliyindən asılıdır. Kalibrləmə: təlim keçməmiş əməkdaşlarda klik 33,2% (KnowBe4, 2026), açandan klikə median 21 s, parola daha 28 s (Verizon DBIR 2024). Hər məşqdə ən azı bir klik, bir bildiriş və bir bitmiş təlim olur. Saat əyilir (1 − e^(−t/40)): ilk dəqiqələr yavaş, sonrakı saatlar sürətli keçir, ekran boş qalmır.
3. Planın hər addımı real xidmətlərdən keçir: `recordOpen`, `recordClick`, `recordSubmit`, `submitThreatReport`, `completeLesson` + `attestModule`, `recomputeRisk`; sonda təşkilatın gündəlik göstəricisi yenilənir. Heç bir məktub və SMS göndərilmir. Kampaniya, bildirişlər, risklər, sertifikatlar və audit qeydləri (`drill.started`, `drill.finished`) adi kampaniya kimi qalır.
4. Taymer yoxdur: panel saniyədə bir `/api/admin/drill/[id]`-ni soruşur, vaxtı çatmış addımlar o an tətbiq olunur. Bir sorğu `lease_until` ilə məşqi tutur və hər addımdan sonra `applied_until`-i yazır, ona görə iki açıq panel eyni addımı iki dəfə tətbiq etmir. Orta risk hər partiyadan sonra `risk_trail`-ə yazılır: panel əvvəl, zirvə və indiki dəyəri, əyrini göstərir.
5. Yeni cədvəl `drill_runs` əlavə miqrasiyalarla gəlir (`drizzle/0001_live_drill.sql`, risk əyrisi üçün `0002_drill_risk_trail.sql`), `0000_init.sql` yenidən yaradılmadı: mövcud lokal bazalar və təqdimat surətləri `db:migrate` ilə yenilənir. Push edilmiş miqrasiya sonradan dəyişdirilmir, yeni sütun yeni miqrasiyadır.
6. Təhlükəsizlik: məşq heç nə göndərmir (SMS növbəsi məşq kampaniyalarını keçir), kampaniya ləğv olunanda məşq dayanır, hesabat addımı təkrarlananda ikinci bildiriş yaranmır, bildiriş dəqiq izləmə linkinə görə uyğunlaşdırılır. `live_drill` heç bir plana daxil olmayan operator funksiyasıdır (`OPERATOR_FEATURES`), yalnız demo seed onu uydurma təşkilat üçün açır, operator `/super` → Funksiyalar-da başqasına aça bilər. Real əməkdaşlar üçün açılmamalıdır: onların qeydlərində etmədikləri kliklər görünər. `campaigns.write` icazəsi və təşkilat başına saatda 20 məşq limiti.
7. Bir əmrlə işə salma: `npm --prefix portal run demo` (asılılıqlar, `.env.local`, təzə demo təşkilat, server, qısa ömürlü sessiya ilə səhifələrin əvvəlcədən kompilyasiyası; `--prod`, `--port`, `--keep-data`) və Docker üçün `portal/docker-compose.demo.yml`. Danışıq ssenarisi: `docs/DEMO.md`.
**Nəticə.** `tests/drill-plan.test.ts` (saat, determinizm, səbəb ardıcıllığı, kalibrləmə) və `tests/drill-service.test.ts` (yaddaşdakı PGlite-də bütöv məşq, paralel sorğular, başqa təşkilatın id-si) yoxlayır. Mətnlər 10 dildədir, tərcüməçi və müstəqil redaktor prosesi ilə (ADR-026).
