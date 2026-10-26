# ✅ TAMAMLANDI (2026-10-26): bu fayl artıq tarixçədir

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
