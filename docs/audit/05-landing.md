# İctimai sayt: landing, sign-in, hüquqi səhifələr (canlı portaldan, 2026-10-15)

Məzmun faylları:
- [content/landing/{az,en,ru,tr,ro,ka,uk,de,fr,it}.json](content/landing/): 10 dildə landing-in bütün mətnləri, maskot replikaları, tur ssenarisi, FAQ. Bu fayllar landing CMS-in `copy` obyektidir. Əlavə olaraq `guide` (vaxtlar) və `mascot` konfiqurasiyası da var.
- [content/landing/audio-manifest.sample.json](content/landing/audio-manifest.sample.json): səs kliplərinin formatı (88 klip, söz-söz zaman damğaları ilə).
- [content/sign-in.az.md](content/sign-in.az.md), [content/legal-privacy.az.md](content/legal-privacy.az.md) (Məxfilik Siyasəti, versiya 2, 08.10.2026), [content/legal-terms.az.md](content/legal-terms.az.md) (İstifadə Şərtləri, 20 bölmə).
- Şəkil: [screens/landing-hero-mobile.jpg](screens/landing-hero-mobile.jpg).

## 1. URL-lər, SEO, PWA
- Locale prefiksli səhifələr: `/az`, `/en`, `/ru`, `/tr`, `/ro`, `/ka`, `/uk`, `/de`, `/fr`, `/it`. `/` isə cookie (`locale`), `Accept-Language` və `CF-IPCountry` əsasında dil seçir. Daxil olmuş istifadəçi `/` ünvanında learner Home-u görür.
- `/legal/privacy`, `/legal/terms` (AZ / EN / RU dil seçimi ilə, mündəricatlı).
- `robots.txt`: Allow `/`, `/legal/`, 10 locale, `/api/landing/media/`, `/og/`. Disallow: `/admin`, **`/super`** (platforma operatoru konsolu), `/learn`, `/api/`, **`/t/`** (simulyasiya izləmə linkləri), **`/q/`** (QR tələləri), **`/c/`** (sertifikat yoxlama səhifəsi), `/account/`, `/dev/`. `sitemap.xml` 13 URL.
- Landing media API: `/api/landing/media/…` (CMS şəkilləri), `/api/landing/audio/{sha256}` (səs klipləri), `/og/…` (OpenGraph şəkilləri).
- SEO (AZ): title `Kibergigiyena təlimi və fişinq simulyasiyası | Cylosof`; description `Əməkdaşlar üçün 5 dəqiqəlik interaktiv kibergigiyena dərsləri, səsli AI müəllim, fişinq simulyasiyası və auditor hesabatları. Bulud və ya öz serveriniz.`; OG title `Bunu açardınız?`; OG description `30 saniyəlik sınaq: fişinqi tanıyın. Sonra komandanız üçün demo istəyin.`
- **PWA manifest**: `name/short_name: Cylosof`, `start_url: /start`, `display: standalone` (override: standalone, minimal-ui), `background_color/theme_color: #f7f6fb`, `lang: az`, kateqoriyalar education/productivity, ikonlar `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png`, `/icons/icon.svg`. Təsvir: "Kiber təhlükələri tanımağı qısa, interaktiv dərslərlə öyrənin."
- Android tətbiqi də var (Settings → Protection: "Needs app version 1.1.3 or later").

## 2. Landing-in konsepsiyası
Landing klassik marketinq səhifəsi deyil. Bu, **maskotun səsli apardığı interaktiv turdur**: ziyarətçi "əməkdaş rolunda" fişinqi özü tanımağa çalışır. Bütün replikaların `emotion` teqi var (warm, curious, whisper, excited, playful, cheerful, serious, proud, concerned). İki səs var: `guide` (maskot) və `caller` (saxta bank zəngi). `spoken` sahəsində TTS üçün ifadəli teqlər işlənir: `<breath>`, `<short pause>`, `<chuckle>`, `<cough>`, `<throat-clearing>`, "ee..." tərəddüdləri.

### Qabıq
- Header: maskot loqosu + `Cylosof` (`Cylosof ana səhifə`), sağda dil seçici (🌐 `AZ`, aria `Dil`) və `Daxil olun` (`/sign-in`).
- Aşağıda üzən **tur idarəetmə paneli** (ağ pill, kölgəli): 7 seqmentli progress xətti, cari fəsil adı və nömrəsi (`Məktub 1/7`), səs düyməsi (`Səssiz rejim` / `Danışsın`), `Növbəti` (↓), `Keçin` (⏭). Altyazı balonu: `Bələdçi deyir`.
- Fəsillər (`tour.chapters`): `Məktub` (hero) → `Zəng` (phone) → `AI müəllim` (tutor) → `Dillər` → `Hesabat` (admin) → `Quraşdırma` (deploy) → `Demo`. Hər fəsil üçün `bridge` → `intro` → `prompt` → `lesson` replikaları var.
- Footer: `Cylosof. Hər əməkdaş üçün kibergigiyena.`, `Əlaqə`, `Sosial şəbəkələr`, `VÖEN`, `Bizimlə işləyən təşkilatlar` (partnyor loqoları), `Müştərilərimizin sözləri` (rəylər; CMS-dən gəlir), `Seçimlərimi unut` → "Hazırdır. Bu brauzer artıq ziyarətlərinizi, nəticənizi və ayarlarınızı xatırlamır." (localStorage təmizlənir; `memoryDays: 90`).

### Maskot davranışı ("attract" rejimi)
`guide` konfiqurasiyası: `attractFirstSeconds: 2`, `attractMinGapSeconds: 6`, `attractMaxGapSeconds: 10`, `attractMaxLines: 6`, `nudgeSeconds: 20`, `fastSeconds: 25`, `memoryDays: 90`. `mascot: { enabled: true, voice: true }`.
- Boş dayananda maskot hərəkət + replika edir. Hərəkətlər: `look` ("Salam. Bura baxın."), `knock` ("Sizə məktub gəlib."), `whisper` ("Sirr deyim? Ünvan çox şey deyir."), `hop` ("Otuz saniyəlik oyun. Hazırsınız?"), `lean-in` ("Toxunun, səsimlə danışım."), `ponder` ("Siz olsaydınız, açardınız?"), `wave` ("Mən bələdçinizəm. Gəlin."). `tapPrompt`: "Toxunun, danışım".
- Günün vaxtına görə salamlama: morning / day / evening / night ("Gecə də işləyirsiniz? …").
- 20 saniyə hərəkətsizlikdən sonra `nudge`: "Növbə sizdədir. Bir toxunuş bəs edir."
- **Rapport (yaddaş)**: geri qayıdan ziyarətçini əvvəlki nəticəsinə görə salamlayır (none / low / mid / high). Nəticəyə görə şərh (score low / mid / high), 25 saniyədən tez bitirənə "Həm də çox cəld. Əla!". Seçilmiş rola görə növbəti fəslə keçid replikası: security → on-prem, people → telefon, leader → hesabat, employee → zəng.
- Səssiz rejimdə: "Səssizəm. Yalnız yazı ilə göstərəcəyəm."

## 3. Fəsillər (səhnələr)

### 3.1 Məktub (`inbox`)
- Telefon maketi (`radius-2xl`, tünd indigo ekran, nöqtəli matris saat `09:41`, siqnal və batareya ikonları), başlıq `Bunu açardınız?`, bildiriş kartı (`Yeni məktub`, göndərən, mövzu, `Açın` düyməsi), arxasında solğun köhnə bildirişlər. Maskot telefonun kənarından baxır. Arxa fonda perspektivli grid, künclərdə "kəsmə" işarələri.
- Altında: `Hər əməkdaş üçün qısa, canlı kibergigiyena dərsləri.` + `Demo istəyin` (brand pill).
- **30 saniyəlik oyun**: 3 kart (`Mesaj {n}, cəmi {total}`), hər birinə `Fişinq` / `Təhlükəsiz` cavabı verilir (`Cavabınız`), sonra `Düzdür` / `Düz deyil` və `Bu, fişinqdir` / `Bu, təhlükəsizdir`, ipucu, izah. Sonda `{total} mesajdan {score} düz cavab`, `Yenidən`, `Kim üçün baxırsınız?` (`İT təhlükəsizlik`, `HR və təlim`, `Rəhbərlik`, `Özüm üçün`).
  1. Email (`Gələnlər`): `myGov Xidmətləri`, `noreply@mygov-az.info`, "Şəxsiyyət vəsiqənizin müddəti bitir", "Xidmətlərə girişi saxlamaq üçün məlumatlarınızı 24 saat ərzində təsdiq edin.", `Təsdiq edin`. **Fişinqdir.** Düzgün cavabda izah: "Ünvan mygov-az.info-dur, my.gov.az deyil."
  2. SMS (`Mesajlar`): `NovaBank`, "Kartınızdan 24,90 AZN ödəniş edildi. Siz deyilsinizsə, kartın arxasındakı nömrəyə zəng edin." **Təhlükəsizdir.**
  3. QR (`Kamera`): `Qonaq Wi-Fi`, "Kodu skan edin və iş hesabınızla daxil olun.", `Kod açır` `wifi-guest-login.net`. **Fişinqdir.**
  - Mətnlərdə `[[…]]` vurğulanan hissəni, `{{…}}` isə domenin şübhəli hissəsini işarələyir (markup konvensiyası).
- Fəslin sonu: "Hücumçuya bir səhv klik bəs edir."

### 3.2 Zəng (`phone`)
`Bankdan zəng edirlər.` / `Səs də aldada bilər.` Gələn zəng ekranı: avatar `N`, `Gələn zəng`, `NovaBank Təhlükəsizlik`, `012 000 00 00`, `Rədd edin` (qırmızı) / `Cavab verin` (yaşıl). Cavab verildikdə zəng edən (`caller` səsi, öskürək və tərəddüdlərlə) 3 cümlə deyir və kodu istəyir. Seçimlər: `Zəngi bitirin` / `Kodu deyin`. Nəticə replikaları: declined, hungUp ("Bank kodu heç vaxt telefonda soruşmur."), gaveCode ("Eyvah…"). `Yenidən dinləyin`.

### 3.3 AI müəllim (`tutor`)
`Soruşun, göstərib izah edir.` / `Səsli AI müəllim hər dərsin içindədir.` Nümunə mesaj: "Hesabınız bloklanıb. **Dərhal bu linkə daxil olun**, yoxsa pulunuz itəcək." Sual çipləri: `Niyə saxtadır?` → "Sizi tələsdirir…", `Nə etməliyəm?` → "Linkə basmayın…". Müəllim cavab verərkən ekranda müvafiq hissəni göstərir.

### 3.4 Dillər (`languages`)
`On dildə danışır.` / `Hər əməkdaş öz dilində öyrənir.` Dil siyahısı (Azərbaycanca, English, Русский, Türkçe, Română, ქართული, Українська, Deutsch, Français, Italiano). Seçilən dildə maskot salam deyir (məs. "Salam! Gəlin, birlikdə öyrənək.").

### 3.5 Hesabat (`admin`)
`Riski şöbə-şöbə görün.` / `Kim kliklədi, kim xəbər verdi, kim öyrəndi.` Cədvəl: sətirlər `Maliyyə`, `Kadrlar`, `İT`, `Hüquq`, `Siz` (ziyarətçinin öz nəticəsi). Sütunlar `Kliklədi`, `Xəbər verdi`, `Öyrəndi` (animasiyalı bar və ya nöqtələr). `Hesabat (PDF)` düyməsi. Replika: "Bu sətir sizsiniz. Rəhbər hər şöbəni belə görür."

### 3.6 Quraşdırma (`deploy`)
`Bulud, ya da öz serveriniz.` / `Bir platforma, iki yol.` Seqment: `Bulud` ("Bu gün başlayın, heç nə quraşdırmırsınız.") | `Öz serveriniz` ("Məlumat şəbəkənizdən çıxmır.").

### 3.7 Demo (`demo`)
`Komandanızla sınayın.` / `Sizə uyğun vaxtda 20 dəqiqəlik demo. Bir iş günü ərzində cavab veririk.`
- Forma: `Ad və soyad`, `İş e-poçtu`, `Təşkilat`, `Ölkə` (`Ölkəni seçin`; əvvəlcə prioritet ölkələr: Azərbaycan, Türkiyə, Gürcüstan, Qazaxıstan, Özbəkistan, Ukrayna, Rumıniya, Moldova, Almaniya, Birləşmiş Krallıq; sonra `──────` ayırıcı və bütün ölkələr əlifba sırası ilə), `Əməkdaşların sayı` (`100-dən az` / `100-500` / `500-2.000` / `2.000-dən çox`), `Mesaj (istəyə görə)`, gizli honeypot sahəsi `Website`, razılıq checkbox-u ("Razıyam ki, Cylosof bu məlumatlardan sorğuma cavab vermək üçün istifadə etsin. Məxfilik siyasəti", `consentVersion: 2026-10-08`), `Demo istəyin` / `Göndərilir`.
- Xəta mətnləri: required, email, rateLimited ("Çox cəhd oldu. Bir saatdan sonra yenidən yoxlayın."), failed.
- Sorğular operator konsolunda "Demo requests" kimi idarə olunur (status, silmə, export).

### 3.8 FAQ (`Tez-tez verilən suallar`), cavablarla
1. **Qiymət?** Əməkdaşların sayına və versiyaya görə (bulud / öz server). Demo istəyin, təklif göndərək.
2. **Şəbəkə daxilində?** Bəli. On-prem versiyası sizin serverlərdə işləyir və bulud versiyası ilə eyni koddan qurulub. Yeniləmələri özünüz quraşdırırsınız.
3. **Bulud məlumatları harada?** Londondakı UpCloud data mərkəzində. Ölkədə qalmalıdırsa, on-prem seçin.
4. **AI-ya şəxsi məlumat gedirmi?** Xeyr. Ad, e-poçt və vəzifə getmir. Müəllim yalnız dərs kontekstini və anonim identifikatoru alır.
5. **Dillər?** İnterfeys 10 dildə. Hər əməkdaş öz dilini seçir.
6. **Tətbiq mağazası olmadan telefonda?** Bəli. Brauzerdən veb tətbiq (PWA) kimi quraşdırılır, Android tətbiqi də var. Dərslər əvvəlcə telefon üçün hazırlanır.
7. **İşə salınma müddəti?** Versiyadan və istifadəçilərin necə əlavə olunmasından asılıdır (fayl importu və ya kataloq). Plan demoda razılaşdırılır.
8. **Öz qaydalar və brend?** Bəli: istifadə qaydaları, təsdiq mətni, loqo, rənglər. Fərdi dərslər hər layihə üçün ayrıca razılaşdırılır.
9. **Auditora sübut?** Hər modul təsdiqlənən dəqiq mətni saxlayan təsdiqlə bitir. Hesabatlar CSV / XLSX / PDF formatındadır, sertifikatların açıq yoxlama səhifəsi var.
10. **Arxasında kim?** Azərbaycanda təhlükəsizlik mütəxəssisləri. Hər dərsi red team mütəxəssisi yazır və yoxlayır.

## 4. Səs və sinxronizasiya formatı
Hər replika ayrıca klipdir: `audio[clipId] = { url: "/api/landing/audio/{sha256}", durationMs, words: [{ word, startMs, endMs }] }`. Altyazıda sözlər bu zaman damğalarına görə vurğulanır. Dərs pleyerindəki səslər də eyni prinsiplə işləyir (`/generated/tts/{locale}/{hash}.m4a`). Klip id-ləri `copy`-dəki `id` sahələri ilə eynidir.

## 5. Sign-in (`/sign-in`)
Mərkəzləşdirilmiş kart, yuxarıda loqo və dil seçici (`Azərbaycanca AZ`). `Xoş gəlmisiniz` / `İş e-poçtunuzla daxil olun.` / `E-poçt` / `Davam et`. Altda: "Daxil olmaqla İstifadə şərtlərini qəbul edir və Məxfilik siyasəti ilə tanış olduğunuzu təsdiq edirsiniz." Axın **email-first**dir: domen SSO-ya bağlıdırsa, istifadəçi təşkilatın IdP-sinə yönləndirilir, əks halda parol addımı gəlir, sonra (aktivdirsə) 2FA kodu tələb olunur. Admin-lər həmişə parol və 2FA ilə daxil olur.

## 6. Hüquqi səhifələr
- **Məxfilik Siyasəti** (v2, 08.10.2026), 16 bölmə: Siyasət haqqında, Cavabdeh şəxs, Hansı məlumatlar, Məqsədlər və hüquqi əsaslar, Sİ müəllim, Kim görə bilər, Saxlama yeri və transsərhəd ötürmə, Saxlama müddəti, Qorunma, Hüquqlar, Risk göstəricisi və avtomatlaşdırılmış qərarlar, Kukilər və yerli yaddaş, Mobil tətbiq icazələri, Uşaqlar, Dəyişikliklər, Əlaqə. Təminatçı rekvizitləri hələ "sonradan göstəriləcək" kimi qalıb.
- **İstifadə Şərtləri**, 20 bölmə: Anlayışlar, Xidmət, Hesablar, Hesab təhlükəsizliyi, Məqbul istifadə, Saxta fişinq / QR / təlimlər, Təşkilatın vəzifələri, Əqli mülkiyyət, Sİ müəllim, Təsdiqlər və sertifikatlar, Fərdi məlumatlar, Əlçatanlıq və dəstək, Xitam, Zəmanətlər, Məsuliyyət, Tətbiq olunan hüquq, Dəyişikliklər, Yekun, Əlaqə.
