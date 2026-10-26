# Hibrid portal: qurma planı

Məqsəd: Cylosof interfeysi üzərində Cylosof və Cyclowareness-in bütün funksiyalarını birləşdirən, production-a hazır portal. Mənbə spesifikasiyası: [docs/audit/](../audit/README.md) (Cylosof) və Cyclowareness PDF hesabatı ([müqayisə sənədi](https://claude.ai/code/artifact/8e394644-261b-40b0-b07f-2e18405b571d)).

## Arxitektura qərarları
| Sahə | Qərar | Səbəb |
|---|---|---|
| Tətbiq | Next.js 15 (App Router, RSC, Server Actions), TypeScript strict | Orijinal Cylosof steki; SSR + təhlükəsiz server məntiqi |
| Stil | Tailwind CSS v4, tokenlər `docs/audit/01-design-tokens.md`-dən | Dizayn 1:1 |
| Fontlar | `next/font/google`: Geologica, Noto Sans Georgian | Orijinal |
| DB | PostgreSQL + Drizzle ORM. Lokal: PGlite (fayl qovluğu `.data/pg`), prod: `DATABASE_URL` (node-postgres) | Bir sxem, iki driver; Docker tələb etmir |
| Auth | Öz implementasiya: email-first, Argon2id, DB sessiyaları (HttpOnly, SameSite=Lax), TOTP 2FA, telefon + OTP, cihaz limiti | Lucia artıq dəstəklənmir; tam nəzarət |
| Multi-tenant | Hər cədvəldə `tenant_id`, hər sorğu server tərəfdə tenant + rol ilə süzülür | SaaS və on-prem eyni kod |
| Rollar | learner, department_head, analyst, campaign_manager, content_creator, tenant_admin, super_admin | Cylosof 6 rol + Cyclowareness analitiki + operator |
| i18n | next-intl, cookie/profil əsaslı; AZ (default), EN, RU | Interfeys; dərs məzmunu EN (AZ/RU sonra) |
| Dərs məzmunu | `content/` qovluğunda JSON (106 dərs, 53 modul, 169 brend), zod ilə yoxlanılır | Audit formatı |
| Səs | Brauzer Web Speech API + söz sərhədləri (lokal). Prod: TTS provayder interfeysi (ElevenLabs/Azure), API açarı ilə | Açarsız işləyir |
| AI tutor | Claude API (`@anthropic-ai/sdk`), model env ilə; açar yoxdursa dərs kontekstindən hazır cavablar | PII göndərilmir |
| Maskot | Rive (`@rive-app/react-canvas`), `mascot.riv`, wasm lokal | Orijinal animasiya |
| Testlər | Vitest (unit: risk, sandbox analizatoru, məzmun, auth, icazələr) | Kritik məntiq |
| Prod | Dockerfile + docker-compose (Postgres), təhlükəsizlik başlıqları, CSP | Real deploy |

## Mərhələlər
1. Skelet: Next.js, dizayn tokenləri, fontlar, i18n, qabıqlar (learner rail, admin sidebar), content shield.
2. DB sxemi, miqrasiyalar, seed (demo tenant, şöbələr, istifadəçilər, rollar), məzmun importu.
3. Auth: sign-in, sessiyalar, RBAC, 2FA, şifrə bərpası, dəvət linkləri.
4. Learner: Home, Learn, modul, dərs pleyeri (11 səhnə, 11 artefakt), XP/level/streak, attestasiya, sertifikat, League, Progress, Profile, siyasət imzası.
5. Admin (Cylosof): Overview, People, Departments, Assignments, Policies, Problem reports, Reports (CSV/XLSX/PDF), League, Audit log, Settings.
6. Cyclowareness: Əməliyyat mərkəzi, qapalı dövrə, təhdid qəbulu, təsdiq mərhələsi, insident riskləri, sandbox (statik analiz), laboratoriya (4 oyun), təlim yolları, açıq risklərim, təhdid və siyasət kəşfiyyatı, rəhbərlik paneli, dəstək masası, rəylər, canlı sessiyalar.
7. Kampaniyalar: 5 addımlı sehrbaz, şablonlar, izləmə linkləri `/t/`, QR `/q/`, bildirmə, SMTP.
8. Landing (10 dil), hüquqi səhifələr, PWA, maskot, AI tutor, səsləndirmə.
9. Sərtləşdirmə: CSP, rate limit, audit, testlər, Docker, sənədlər.

İrəliləyiş: [PROGRESS.md](PROGRESS.md). Sizin qərarınızı tələb edən məsələlər: [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md).
