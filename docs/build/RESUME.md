# ⏸ DAVAM ETMƏK ÜÇÜN: 10 dil və təcrübə işi (2026-10-27-də həftəlik limitə görə dayandırılıb)

Həftəlik limit bazar günü, 2026-11-01-də saat 22:00-da (Bakı vaxtı) yenilənir. Bundan sonra soruşmadan qaldığın yerdən davam et. Bitəndə commit et və `origin`-ə push et: https://github.com/MrHerc/Cyclowareness-Mark3. `origin/main`-də yalnız README commit-i var; onu birləşdir, heç vaxt force push etmə.

**Hazırdır (bu commit-də):**
- 10 interfeys dili: az, en, ru, tr, ro, ka, uk, de, fr, ar. Ərəb dili Səudiyyə üçündür, sağdan sola yazılır və italyan dilinin yerinə gəlib.
- `dirOf`/`langAttrs`, məntiqi CSS və `tests/rtl-logical.test.ts`.
- Koddakı mətnlər 10 dildədir: kampaniya şablonları, oyunlar, sertifikat, AI Sel dil üslubu.
- 7 yeni dildə hər birində 106 dərs var və hamısı yoxlayıcıdan keçir. İnterfeys, hüquqi mətnlər və siyasətlər hazırdır. Ərəbcə landing hazırdır.
- Lüğətlər: `.claude/skills/cyclowareness-experience/references/glossaries/`.
- Təlim yolları: dərslərdən sonra laboratoriyalar gəlir. Bura `learning_paths.lab_ids` sütunu və `src/lib/domain/labs.ts` aiddir.
- Yenilənmiş təlim (modul) səhifəsi.
- TTS boru xətti. Hər cümlə üçün ElevenLabs `with-timestamps` klipi `scripts/generate-narration.ts` ilə yaradılır. Açar `ELEVENLABS_API_KEY`-dir, açar olmayanda Web Speech işləyir.
- Süni intellekt subtitrləri: `POST /api/subtitles` və `ai_cache` cədvəli.
- Yeni pişik: hərəkətlər, ana səhifədəki "Sel ilə oyna" kartı (siçan, yumaq, lazer) və qaçış.

**Qalan işlər (sıra ilə):**
1. Dayandırılmış workflow-ları eyni `scriptPath`, `resumeFromRunId` və `args` ilə davam etdir. Bu, yalnız həmin Claude sessiyasında işləyir.
   - Skriptlər sessiyanın scratchpad qovluğundadır: `%TEMP%\claude\C--Users-Safar-Desktop-Cyclowareness--Vol2\66e61158-c161-4119-a251-69c6013bc3e9\scratchpad`.
   - Vəziyyət `OVERNIGHT-STATE.md` faylındadır.
   - Davam etdiriləcək dillər (`localize-language.js`): fr `wf_a783af65-3e3`, uk `wf_edb26592-7a5`, ro `wf_75b21604-d0d`, ka `wf_b1c11145-0d6`, de `wf_1bde0a71-fa5`, ar `wf_9f8275a7-ddd`. Bunlarda yalnız yoxlayıcı redaktorlar qalıb.
   - İşıq effektləri (`light-polish.js`, `wf_466adfa7-ee3`, iş sahəsi `lightws`) hələ bitməyib.
   - Yeni sessiyada skriptləri yenidən işə sal: tərcüməçilər mövcud faylları saxlayır, redaktorlar yenidən yoxlayır.
2. Pleyer: yığılan sillabus, səs səviyyəsi, sürət, subtitr seçimi (10 dil və süni intellekt), transkript, qısayollar, TTS kliplərinin qoşulması. Bu, `player-and-mascot.js`-dəki pleyer agentinin işidir.
3. Yeni açarları 7 dilə tərcümə et (`tests/i18n.test.ts`), sonra `npm run db:reset`, typecheck, lint, vitest və build.
4. Codex/Claudex Loop baxışı (Codex CLI 0.164 bu kompüterdə 0xC0000005 ilə çökür: yenilə və ya ECC ilə əvəz et), ECC təhlükəsizlik baxışı, ADR-lər (10 dil, RTL, TTS, labs, maskot), PROGRESS, OPEN-QUESTIONS (ElevenLabs açarı və səs seçimi, hüquqi mətnlərdə Vertex AI adı).
5. Commit, sonra push.

---

# ✅ TAMAMLANDI (2026-10-26): aşağıdakı hissə artıq tarixçədir

Bütün addımlar bitib, bərpa addımlarını yenidən icra etməyin. Hazırki vəziyyət belədir:
- 212 tərcümənin hamısı var və hamısı yoxlamadan keçir.
- Terminologiya vahidləşdirilib.
- İnterfeys lokallaşdırılıb.
- Rusca siyasətlər hazırdır.
- Baza seed olunub: en 106, az 106, ru 106.
- 3200 surəti yenilənib.

Qərarlar: DECISIONS ADR-023, ADR-024. Gediş: PROGRESS dövrə 9.

---

# Davam etmək üçün: dil işi (2026-10-21 axşam dayandırıldı)

İstifadəçi limit səbəbindən işi dayandırdı və növbəti həftə **qaldığımız yerdən** davam etmək istəyir. Bu fayl bərpa planıdır. Əvvəlcə bu faylı oxu, sonra addımları ardıcıl icra et, istifadəçidən təsdiq istəmə. Hazır olanda lokal serveri qaldır və linki ver.

## Vəziyyət (dayandırılanda)

- **İnfrastruktur hazırdır və yoxlanılıb** (tsc 0, eslint 0, 1002 test). `syncLibrary` en/az/ru dərslərini oxuyur, `pickLessonContent` işçinin dilini seçir, AI Sel həmin dilin mətnindən istifadə edir, cihazda dilin səsi yoxdursa yanlış səslə oxumur (Edge tövsiyəsi göstərilir). Yoxlayıcı: `npx tsx scripts/check-lesson-locales.ts [--coverage]`.
- **Tərcümələr:** 212 faylın 210-u var və hamısı yoxlayıcıdan keçir. Çatışmayan: `backups-recovery/phone-backup.az.json`, `backups-recovery/which-copy-survived.az.json`.
- **Redaktə (ikinci göz):**
  - az: redaktə olunub 2, 4, 6 qrupları; qalıb 1, 3, 5, 7, 8, 9, 10, 11, 12, 13 və sonda terminologiya vəhdəti.
  - ru: redaktə olunub 1–6; qalıb 7–13 və sonda terminologiya vəhdəti.
  - Qruplar: `C:\Users\Safar\AppData\Local\Temp\claude\C--Users-Safar-Desktop-Cyclowareness--Vol2\66e61158-c161-4119-a251-69c6013bc3e9\scratchpad\lesson-batches.json` (13 qrup, sıra ilə).
- **İnterfeys agenti yarıda dayandırıldı.** Hardcoded mətnlərin tapılması və son əlavə olunan az/ru açarlarının redaktəsi başlanmışdı (son etdiyi: rus dilində «служба безопасности» termininin vahidləşdirilməsi). Ağac sağlamdır: tsc 0, i18n və content-locales testləri keçir.
- Heç nə commit olunmayıb (son commit `final-pass-2026-10-21` budağında 851d4fa).

## Bərpa addımları

1. **Tərcümə workflow-ları.** Eyni sessiyadırsa, hər ikisini cache ilə davam etdir (bitmiş agentlər təkrar işləmir):
   - az: `Workflow({ scriptPath: "<scratchpad>\\translate-lessons.js", resumeFromRunId: "wf_0670ffae-827", args: <eyni args> })`
   - ru: `Workflow({ scriptPath: "<scratchpad>\\translate-lessons.js", resumeFromRunId: "wf_fa5ac818-e96", args: <eyni args> })`
   - args (lang, langName, glossary, batches) bu söhbətdə ilk işə salınma çağırışındadır; glossary-lər aşağıda da var.
   - **Yeni sessiyadırsa** (resume işləmir): `translate-lessons.js`-i yalnız qalan qruplarla yenidən işə sal (`batches` = yuxarıdakı «qalıb» siyahısı). Tərcüməçi artıq olan faylı yenidən yazmır, tamamlayır və yoxlayır; redaktor ikinci göz kimi keçir. Sonda consistency agenti işləyir.
2. **İnterfeys təmizliyi:** eyni promptla yeni agent başlat (bu söhbətdə «Portal UI language sweep» agentinin promptu). Yarımçıq dəyişikliklər ağacdadır, agent onların üstündən davam edir.
3. **Yoxlama:** `npx tsx scripts/check-lesson-locales.ts --coverage` (212/212), `npx tsc --noEmit`, `npx eslint src tests scripts --max-warnings=0`, `npx vitest run`.
4. **Bazaya yükləmə:** dev serveri dayandır (`preview_stop portal`), `npm run content:sync`, serveri yenidən başlat. 3200 üçün: təmiz surəti yenilə (`.env.local` və `.data` saxlanılır), `npm run content:sync` orada da, `npm run build`, `preview_start final`.
5. **Brauzerdə yoxla:** bir dərsi az, en və ru dillərində aç (işçinin profil dili), AI Sel cavabı, telefon eni 375 px.
6. **Sənədlər:** `.claude/skills/cyclowareness-experience/references/lesson-engine.md` (§2.2, §2.5, §3.4, §4, §5, resept 6.3) yeni vəziyyətə uyğunlaşdırılsın; DECISIONS-a ADR (çoxdilli dərslər, səs qaydası), PROGRESS-ə sətir.
7. İstifadəçiyə linki ver (http://localhost:3200), commit təklif et (`.gitignore`-dakı `build/` qaydası `docs/build`-i gizlədir, düzəltməyi təklif et).

## Glossary-lər (tərcüməçilər üçün)

- **az:** fişinq; fişinq məktubu; SMS fişinqi; telefon fişinqi; QR fişinqi; parol; parol ifadəsi; parol meneceri; iki addımlı doğrulama; çoxfaktorlu autentifikasiya (MFA); birdəfəlik kod; autentifikator tətbiqi; e-poçt / məktub; gələnlər qutusu; göndərən; qoşma; link; bildirmək; təhlükəsizlik komandası; İT dəstəyi; zərərli proqram; fidyə proqramı; məlumat oğurlayan proqram (infostealer); deepfake; klonlanmış səs; brauzer; genişlənmə; yeniləmə; ehtiyat nüsxə; fleş kart; QR kod; sosial mühəndislik; fırıldaq / fırıldaqçı; məlumat sızması; şəxsi məlumatlar; hesab; daxil olmaq; giriş səhifəsi; tətbiq; klikləmək; cihaz. «siz» forması, «…» dırnaqları, onluq vergül, manat / AZN, türk sözləri yox, adlar dəyişmir.
- **ru:** фишинг; фишинговое письмо; SMS-фишинг; телефонный фишинг (вишинг); QR-фишинг; пароль; парольная фраза; менеджер паролей; двухэтапная проверка; многофакторная аутентификация (MFA); одноразовый код; приложение-аутентификатор; электронная почта / письмо; входящие; отправитель; вложение; ссылка; сообщить (в службу безопасности); служба безопасности; ИТ-поддержка; вредоносная программа; программа-вымогатель; программа-похититель данных (инфостилер); дипфейк; клонированный голос; браузер; расширение; обновление; резервная копия; флешка; QR-код; социальная инженерия; мошенничество / мошенник; утечка данных; персональные данные; учётная запись; войти; страница входа; приложение; устройство. «вы» с маленькой, «…», десятичная запятая, манат / AZN, ё. Имена кириллицей в тексте (Лейла, Тураль, Камран…), без изменений в адресах и идентификаторах; вымышленные бренды без изменений.
