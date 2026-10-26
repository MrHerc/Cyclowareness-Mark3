# Sizin qərarınızı gözləyən məsələlər

Qalan hər şey hazırdır və lokalda işləyir. Aşağıdakılar ya xarici hesab/açar, ya da biznes qərarı tələb edir.

## Açarlar və provayderlər
1. **Anthropic API açarı və model.** `ANTHROPIC_API_KEY` olmadan Sİ müəllim dərs mətnindən cavab verir, studiya qaralaması isə «Sİ qoşulmayıb» deyir. Default model `claude-opus-5-5`; xərc üçün `ANTHROPIC_MODEL=claude-haiku-5-5` də işləyir. Hansı?
2. **Səs (TTS).** Hazırda brauzerin nitq sintezi. Orijinal kimi əvvəlcədən yazılmış kliplər üçün provayder lazımdır (ElevenLabs və ya Azure Speech) və AZ səsinin seçimi.
3. **SMTP.** Dəvətlər, xatırlatmalar və hesabat məktubları SMTP olmadan «qeydə alındı» statusu ilə qalır (Tənzimləmələr → Poçt → Jurnal). Hansı server?
4. **SMS/səs provayderi.** `SMS_PROVIDER=webhook` interfeysi var; real provayder (məs. Twilio, yerli operator şlüzü) və göndərən adı.
5. **Demo sorğuları üçün e-poçt.** `SALES_EMAIL` — sorğular həmişə operator konsolunda saxlanır, istəsəniz məktubla da gəlsin.

## Məzmun və dillər
6. **AZ/RU dərs məzmunu.** ✅ Həll olundu (2026-10-26). 106 dərsin az və ru versiyası peşəkar tərcümə və doğma redaktə ilə hazırlandı (ADR-023), canlı tenantdan çıxarış lazım olmadı. Qalan iki məsələ: Azərbaycan səsinin keyfiyyəti cihazdan asılıdır (sual 2), buraxılışdan əvvəl doğma dildə danışan mütəxəssisin son baxışı tövsiyə olunur.
7. **7 əlavə interfeys dili.** İctimai sayt 10 dildədir; tətbiqin özü AZ/EN/RU. TR/RO/KA/UK/DE/FR/IT lazımdırmı?
8. **Hüquqi mətnlər.** Məxfilik Siyasəti və İstifadə Şərtləri AZ-dadır (Təminatçı rekvizitləri «sonradan göstəriləcək»). Şirkət adı, VÖEN, ünvan və EN/RU tərcümələri.
9. **Məqbul istifadə siyasəti (AZ, RU).** Tərcümələr hazırdır (`content/policies/acceptable-use.az.md`, `acceptable-use.ru.md`, `passwords.ru.md`), hüquqi baxış tövsiyə olunur.

## Məhsul və hüquq
10. **Ad və domen.** Məhsulun adı Cyclowareness kimi təsdiqləndi (2026-10-19); kodda nümunə domen `cyclowareness.com`-dur. Real domen və e-poçt göndərən domeni hansıdır?
11. **Moodle/LMS inteqrasiyası.** SCORM/xAPI ixracı lazımdırmı? (Hazırda yoxdur.)
12. **Hostinq.** Bulud (UpCloud London, orijinal kimi) və ya müştəri serveri (docker-compose hazırdır). Region tələbi?
13. **Planlar və qiymət.** Üç plan (`essentials`, `professional`, `enterprise_hrm`) funksiya dəstləri ilə kodda; qiymət siyahısı `docs/business`-də. Təsdiqləyirsiniz?

## Texniki, sonrakı mərhələ
14. **SSO (OIDC/SAML) və LDAP konnektoru.** Tənzimləmələr saxlanılır (sirlər şifrələnmiş), lakin giriş mübadiləsi və kataloq sinxronizasiyası prosesi yazılmayıb. Hansı IdP ilə test edək (Entra ID / Keycloak)?
15. **Server tərəfdə PDF.** Hazırda brauzerin çapı ilə. Avtomatik PDF (planlaşdırılmış hesabat əlavəsi) lazımdırsa, Playwright xidməti.
16. ~~**Safarov Industries loqosu.**~~ Həll olundu (2026-10-20): göndərdiyiniz orijinal wordmark şəffaf fonlu PNG-yə çevrilib `public/brand/safarov-industries-wordmark.png` kimi qoyuldu; seed onu demo təşkilatın loqosu edir. Yuxarı paneldə loqo tək göstərilir, sidebar-da isə «Cyclowareness by Safarov Industries» brendi var.
17. **Android tətbiqi.** Orijinalda var; PWA hazırdır, native tətbiq ayrıca layihədir.
18. **Simulyasiya məktubları üçün ayrıca göndərən domeni.** Fişinq simulyasiyası şablonun göndərən adı ilə (məs. «Mühasibatlıq») gedir, lakin ünvan həmişə təşkilatın öz təsdiqlənmiş ünvanıdır — ünvan səviyyəsində inandırıcılıq üçün (məs. `ofistechizat-az.com`) ayrıca simulyasiya göndərən domeni və onun SPF/DKIM qurğusu lazımdır. Hansı domen(lər)?
19. **İctimai sayt üçün CMS (operator konsolu).** Orijinalda landing mətnləri/şəkilləri/səs klipləri operator konsolundan redaktə olunurdu (dərc et / ləğv et / sıfırla). Hazırda məzmun `content/landing/*.json` fayllarındadır; operator UI sonrakı mərhələdə əlavə oluna bilər. Lazımdırmı?
20. **Hüquqi mətnlərdə Sİ provayderi (hüquqi baxış lazımdır).** Məxfilik Siyasəti (5.1, 6, 7.2) və İstifadə Şərtləri (10.1) AI Sel-in cavabları üçün Google Cloud Vertex AI-ı göstərir — bu, orijinal Cylosof mətnindən qalıb. Bu portalda AI Sel Anthropic Claude API ilə işləyir (ADR-008), səsli suallar isə brauzerin nitq tanıması ilə (Chrome-da Google xidməti) mətnə çevrilir. Hüquqşünasla mətn real provayderlərə (Anthropic, transsərhəd ötürmə, saxlama müddəti) uyğunlaşdırılmalıdır; mətni sizin təsdiqiniz olmadan dəyişmirik.
21. **Yeni maskot: ördək və ya pişik.** İki dizayn hazırlanıb: ağ ördək (`design/mascot-duck/`, interaktiv səhifə) və sizin pişiyinizə bənzəyən ağ-boz pişik (`design/mascot-cat/`). Hər ikisi portalın maskot API-sinə (əhval, jest, danışma, baxış, toxunma, hərəkətsiz rejim) uyğun qurulub. Seçdiyiniz maskot portala Rive faylının yerinə komponent kimi qoşulacaq; AI Sel adı dəyişmir. Hansı? **2026-10-21:** baxmağınız üçün pişik bütün yerlərə qoşuldu (ADR-022); saxlanmasa, Rive robotu bir sətirlə qayıdır.
