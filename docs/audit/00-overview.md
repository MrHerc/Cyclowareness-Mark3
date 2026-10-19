# Cylosof portal audit (canlı saytdan, 2026-10-15)

Mənbə: https://cylosof.com, demo tenant "Rəqəmsal İnkişaf Agentliyi" (slug `rida`), admin `admin@demo.cylosof.com` (rol `tenant_admin`).

## Texnologiya işarələri (brauzerdən görünən)
- Next.js App Router, Cloudflare arxasında. Sərt CSP (nonce + strict-dynamic), `frame-ancestors 'none'`, HSTS.
- Route qrupları: `app/landing/[locale]` (ictimai sayt), `app/(learner)/...`, `app/(admin)/admin/...`
- Learner route-ları: `/`, `/learn`, `/learn/[slug]`, `/learn/[slug]/[lessonId]`, `/league`, `/progress`, `/profile`, `/policies/[id]?from=`, `/sign-in`
- Tailwind CSS v4 (`@theme` tokenləri), bax [01-design-tokens.md](01-design-tokens.md)
- Maskot: **Rive** animasiyası, `/rive/rive.wasm` + `/rive/mascot.riv`
- Dərs səsləndirməsi: əvvəlcədən yaradılmış TTS, `/generated/tts/{locale}/{hash}.m4a` (hər cümlə ayrı fayl). Mətn səslə sinxron "karaoke" vurğulanır.
- Tenant loqosu: `/api/assets/logo/{tenantId}?v=...`
- Locale cookie: `locale=az` (1 il). `Vary: Accept-Language, CF-IPCountry`.

## Müşahidə olunan API-lər
- `GET /api/me` → `{ user: { id, name, email, locale, role, tenant: { id, slug, name, branding: { logoUrl, primary, accent }, protection: { contentProtection, screenshotBlockAndroid } }, departmentId, avatarUrl, features: {...} }, totals: { xp, level, levelProgress, streak, streakFreezes, riskScore, todayXp, dailyGoalXp } }`
- `GET /api/progress` → `{ modules: [{ slug, status: not_started|in_progress|completed, percent, lastLessonId, completedLessonIds[] }] }`
- `GET /api/attestations` → `{ text: "I went through this module myself, I understand the rules and I will follow them.", pending: [], attested: [] }`
- `POST /api/csp-report`

## Feature flag-lar (tenant səviyyəsində, `/api/me.features`)
ai_tutor, tutor_voice, time_limits, teachable_moment, league, report_bonus, certificates, qr_trap, reports_export, custom_branding, custom_attestation_text, custom_certificate, account_email, campaigns, identity_settings, ldap_sync, sso, scim, siem, itsm, outlook_addin, sms_voice, vishing_trainer, expert_tier, spaced_review, nudges, hub, family_mode, town_hall, coop_quests, compliance_pack, policies, leak_monitoring

## Rollar
`tenant_admin` (görülən). Learner menyusunda "Admin" linki yalnız admin üçün görünür.

## Learner shell
- Desktop: sol rail (17rem): loqo "Cylosof", Home / Learn / League / Progress / Profile, aşağıda "Admin" və istifadəçi kartı (avatar inisialları, ad, təşkilat).
- Yuxarı bar: tenant loqosu + adı, sağda streak (🔥 0) və XP (⚡ 175) pill-ləri.
- Mobil: alt tab bar (4.5rem).
- Content shield: pəncərə fokusu itəndə məzmun bulanır (`tenant.protection.contentProtection`).

## Dərs pleyeri (`/learn/[slug]/[lessonId]`)
- Tam ekran. Yuxarıda: X (Leave lesson), progress bar, "Ask" (mikrofon ikonlu, AI tutora səsli sual), narration sürəti (1×), səs on/off, "More options".
- More options dialoqu: **Motion: Full / Calm / Still** seqment seçimi + "Report a problem".
- Giriş ekranı: maskot, dərs adı, modul adı, müddət pill-i, status (Completed), "Start"/"Review again", "Turn the sound on to hear the tutor".
- Addımlar: solda illüstrasiya, sağda maskot + addım nöqtələri, mətn səslə sinxron söz-söz vurğulanır. Aşağıda: Previous part, Replay, Pause, Next/Check.
- Sual addımı: email kartı (göndərən, ünvan şübhəli hissəsi qırmızı fonla vurğulanıb, vaxt, mətn, link), sual, nömrələnmiş variantlar (radio), "Check" düyməsi.
