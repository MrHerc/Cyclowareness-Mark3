# Learner tətbiqi və dərs mühərriki (canlı portaldan, 2026-10-15)

Şəkillər: [screens/](screens/) (`learner-*`, `lesson-*`). UI mətnləri EN locale-dan götürülüb, sözbəsöz verilib.

## 1. Qabıq (shell)

### Desktop (≥ lg)
- **Sol rail** (`--rail-width: 17rem`, ağ fon, sağda `line` sərhədi):
  - Yuxarıda maskot loqosu + `Cylosof` yazısı (link `/`).
  - Naviqasiya: `Home` (`/`), `Learn` (`/learn`), `League` (`/league`), `Progress` (`/progress`), `Profile` (`/profile`). Aktiv element: brand-50 fonlu pill, brand mətn və ikon. İkonlar xətti (lucide üslubunda).
  - Aşağıda: `Admin` linki (yalnız admin rolu üçün, 4 kvadrat ikonu) və istifadəçi kartı: inisial avatar (`RH`, safe-50 fonda yaşıl), ad, təşkilat adı (ellipsis ilə kəsilir).
- **Top bar** (`--topbar-height: 4rem`): solda tenant loqosu və adı (`Rəqəmsal İnkişaf Agentliyi`), sağda iki pill: streak (🔥 `0`, link `/progress`, aria `0 day streak`) və XP (⚡ `175`, link `/progress`, aria `175 XP earned`).
- `Skip to content` linki (`#main`).

### Mobil
- Alt tab bar (`--tabbar-height: 4.5rem`, `--shadow-bar`), eyni 5 element. Safe-area padding-ləri.

### Qlobal davranışlar
- **Content shield**: pəncərə fokusunu itirəndə ekrandakı hər şey `backdrop-blur-2xl` + `bg-canvas/80` ilə örtülür, ortada maskot loqosu görünür (`content-shield.jpg`). Admin Settings → Protection: "Copying, printing and screen blur". Mətn seçilmir, kopyalanmır, çap boş səhifə verir.
- **Leak check (görünməz su nişanı)**: hər ekranda insanın görmədiyi kod gizlənir. Admin şəkli yükləyir, kodu tapır və "Whose screen is it?" sualına cavab alır (Settings → Protection).
- **Səhifə keçidləri**: `(learner)/template` var. Məzmun bulanıqdan aydına keçən reveal animasiyası ilə açılır (`--duration-reveal: .72s`, `--ease-out-expo`).
- Skeleton yükləyicilər: `sunken` rəngli, `radius-xl` yuvarlaqlı bloklar (`admin-skeleton-loading.jpg`).

## 2. Home (`/`)
Sıra ilə (`learner-home-*.jpg`):
1. **Salamlama**: `Hello, Rəşad` (headline) + `Take one step today.`. Sağda Rive maskotu (düymə, aria `Talk to the tutor`, kliklədikdə maskot reaksiya verir və səsli tutor açılır).
2. **Siyasətlər bloku** (imzalanmamış siyasət olduqda): brand-50 fonlu kart, ikon, `2 policies to sign`, `Read them and sign with your password.`. Hər sətir: sənəd ikonu, ad, `Version 1`, sağda `Sign ›`. Link `/policies/{id}?from=%2F`.
3. **"Continue" hero kartı** (brand fon, `radius-2xl`, böyük): `▶ Continue` pill-i, modul adı display ölçüdə (`Phishing emails`), alt başlıq, meta (⏱ `9 min`, 📚 `3 lessons`, ⚡ `300 XP`), ağ progress bar + `66%`, narıncı `Continue ›` düyməsi (accent fon, ink mətn). Sağda modul illüstrasiyası (qarmaq + zərf, dairəvi fonda).
4. **Liqa sətri**: narıncı dairədə yer nömrəsi (`4`), `Place 4 of 5`, şöbə adı, narıncı mətnlə `6 points to the next place`, trend `–`, `›`.
5. **Sağ sütun stat kartları**:
   - `Daily goal`: dairəvi progress halqası (reward rəngi), mərkəzdə `0`, `0 / 50 XP`.
   - `Streak`: alov ikonu, `0`.
   - Cüt kart: ⚡ `175` `Total XP` + `Level 2` pill; qalxan ikonu `18` `Risk score`.
6. **`Your path`**: `0 of 51 done`, şaquli timeline. Hər modul dairəvi ikon node-u ilə; cari modul narıncı doldurulmuş node və narıncı çərçivəli kart. Kart: başlıq, alt başlıq, pill (`66% complete` narıncı / `For you` boz), meta. Sonda `⌄ Show all (51)`.

## 3. Learn (`/learn`) və modul səhifəsi
Ətraflı: [04-training-catalog.md](04-training-catalog.md).

## 4. Dərs pleyeri (`/learn/[slug]/[lessonId]`)
Tam ekran rejim. Rail gizlənir, fon `canvas` olur.

### Üst panel
`✕` (`Leave lesson`) · progress bar (brand rəngli dolma, `sunken` trek) · `🎤 Ask` (`Ask the tutor a question`, səsli sual) · `1×` (`Change narration speed (now 1×)`, sürətlər arasında dövr edir) · `🔊` (`Turn sound off`) · `⋯` (`More options`).

### More options dialoqu (`lesson-options-dialog.jpg`)
`Lesson options` başlığı, `Motion` seqmenti: `Full` | `Calm` | `Still` (animasiya intensivliyi; Profile-də də var), `⚠ Report a problem` düyməsi. Overlay arxa fonu bulanıqlaşdırır, kart `radius-2xl`.

### Giriş ekranı (`lesson-intro.jpg`)
Mərkəzdə böyük Rive maskotu (üzən `float` animasiyası, kölgə ellipsi), dərs adı (display), modul adı, pill-lər (⏱ `3 min`, ✓ `Completed` yaşıl), əsas düymə (`Start` / `↻ Review again`), altında 🎧 `Turn the sound on to hear the tutor`.

### Addım tipləri (müşahidə edilən)
1. **Narration (izah)** (`lesson-01`, `lesson-05`): solda illüstrasiya (SVG ikon səhnəsi və ya email kartı), sağda kiçik maskot + addım nöqtələri (aktiv nöqtə uzun pill), böyük mətn (`title` ölçüsündə, bold). **Karaoke vurğulama**: hazırkı söz brand-100 fonla işıqlanır, oxunmuş sözlər `ink`, oxunmamışlar `ink-subtle`. Səs `/generated/tts/{locale}/{hash}.m4a` faylından gəlir (hər cümlə ayrıca). İllüstrasiyada uyğun hissə sinxron vurğulanır (məs. email mətnindəki təhdid cümləsi qırmızı fonla). Narration bitəndə növbəti addıma avtomatik keçir. Alt panel: `‹` (`Previous part`), `↻` (`Replay`), `⏸`/`▶` (`Pause`/`Play`), əsas düymə `Next` (və ya sualdan əvvəl `Answer the question`).
2. **Email illüstrasiyası**: `‹ Inbox` başlıqlı kart, mövzu, avatar (`XA` yaşıl dairə), göndərən adı, ünvan (şübhəli domen hissəsi risk-100 fonda), vaxt, `To ...`, mətn, link (`View payslip`), imza.
3. **Çoxseçimli sual** (`lesson-03`): sual başlığı (title), nömrəli variantlar (`radiogroup`, hər biri ağ pill, solda nömrə dairəsi), `Check` düyməsi (seçim edilməyənə qədər disabled). Bəzi orta və çətin modullarda sual vaxtla məhdudlaşır (`time_limits`; Profile → Question timer: `Standard` / `More time` / `Off`).
4. **Geri bildiriş (feedback) paneli** (`lesson-04`): aşağıdan qalxan sheet. Düzgün cavabda safe-50 fon, maskot, ✓ ikonu, `Well done` (safe-600), izah (`Right. The address often gives a fake away fastest.`), `Continue` düyməsi (alt kənarında auto-advance progress xətti). Seçilmiş variant yaşıl çərçivə və ✓ alır, digərləri solğunlaşır.
5. **Mailbox simulyasiyası "Morning inbox"** (`lesson-06..10`):
   - Başlıq: zərf ikonu + `Morning inbox`, sağda nöqtə progress və `0 of 5 emails handled`.
   - Giriş kartı: `Mailbox` etiketi, `Morning inbox`, `It is nine in the morning and five new emails are waiting. Open each one and choose the right step.`, `Start`.
   - Tam poçt müştərisi maketi: `Mail` loqosu, `Search mail`, avatar `Y`. Qovluqlar: `Inbox 5`, `Sent`, `Drafts`, `Spam`, `Archive`, `Trash`. Siyahı: oxunmamış nöqtəsi, avatar, göndərən, vaxt, mövzu, önizləmə, ☆. Oxuma paneli boş halda `Select an email`.
   - Nümunə məktublar: Accounting (`September payslip`, saxta domen `xidmetagentIiyi.az`), Elvin Mammadov (`Final version of the report`, legit), DocuSfera (`A document is waiting for your signature`, `Muqavile_2025.pdf`), IT Support (`Planned maintenance`, legit), HR Department (`Holiday bonus list`, şübhəli əlavə).
   - Məktub açılanda: tutor ipucu balonu (🔊 + `Read the sender address letter by letter.`, səsli), alt hərəkət paneli: `⚑ Report phishing` | `🗑 Delete` (legit məktublarda başqa hərəkətlər ola bilər).
   - **Lens aləti** (`🔍 Lens` düyməsi): böyüdücü şüşə animasiya ilə şübhəli detala gedir və tünd tooltip göstərir: `Actually` / `After "agent" comes a capital Latin "I", not a lowercase "l"`. Linkin əsl ünvanı da göstərilir (`View payslip: actually https://maas-portal.info/giris`). `Move the lens to the next detail` ilə növbəti detala keçir.
   - Qərardan sonra modal: `Good move` (yaşıl ✓) + izah, `Continue`. Simulyasiya çərçivəsi safe rəngində parlayır.
6. **Tamamlama**: modulun son dərsindən sonra **attestasiya** gəlir: `Confirm the module`, mətn (`/api/attestations.text`, tenant-ə görə dəyişə bilər), `I confirm`. Bundan sonra sertifikat verilir.

### Tutor ("Ask")
- Dərs daxilində mikrofonla səsli sual (`microphone=(self)` permissions-policy). Tutor dərsin kontekstində cavab verir. Landing-də vəd olunan suallar: "Niyə saxtadır?", "Nə etməliyəm?".
- Feature flag-lar: `ai_tutor`, `tutor_voice`.

## 5. League (`/league`)
`learner-league.jpg`
- `Department league`, `This month, departments compete on safe habits.`, sağda `16 days left` pill-i.
- **Podium (Top three)**: ortada 1-ci yer (brand fonlu hündür sütun, üstündə 🏆 laurel ikonu, şöbə adı, xal `56`, trend `–`), solda 2-ci, sağda 3-cü (brand-100 fonlu alçaq sütunlar).
- **Other departments**: sətir kartları (yer dairəsi, ad, `Your department` və ya `5 learners`, progress bar, xal). İstifadəçinin şöbəsi narıncı çərçivə, narıncı yer dairəsi və narıncı bar alır.
- **How to climb** kartı: `Finish your modules` (`Your department: 25% completed`), `Report suspicious mail` (`+5 XP for each report`, `Your department: 44% reported`), alt qeyd `Score: 60% completion, 40% reporting`.

## 6. Progress (`/progress`)
`learner-progress.jpg`
- Brand fonlu böyük kart: dairəvi level halqası (`2`), `Level`, `50% to next level`.
- Kartlar: ⚡ `175` `XP`, 🔥 `0` `Streak`, 🛡 `18` `Risk score` + `Low risk. Lower is better.`
- `Modules` + `0 of 53 completed`: başlanmış modulların kartları (ikon, ad, faiz, narıncı progress).

## 7. Profile (`/profile`)
`learner-profile-*.jpg`
- Avatar (inisiallar, safe-50), ad, `Add photo`.
- `My certificates`: boş halda sertifikat illüstrasiyası, `No certificates yet`, `Finish a module and confirm it, and your certificate appears here.`, `Browse modules`.
- `Policies` + `2 to sign` pill: `To sign` siyahısı (`Sign ›`).
- Hesab: e-poçt, `Organization`, `Language` (dil seçimi), `Show the tour again`.
- `Security`: `Two-step sign-in` `Off`, `Protect your account with a code from your phone.`, `Turn on`.
- `Your data`: `Download my data` (`Your profile and learning history in one file.`), `Request account deletion` (qırmızı, `Your administrator reviews the request.`).
- `Sound and vibration`: `Sound`, `Vibration` (`This device cannot vibrate`).
- `Motion`: `Full` / `Calm` / `Still`.
- `Accessibility`: `Question timer` (`For timed questions in lessons.`): `Standard` / `More time` / `Off`.
- `Help`: `Report a problem`, `My reports` (`No reports yet.`).
- `Sign out`, altda `Terms of Use` · `Privacy Policy`.

## 8. Siyasət oxuyucu (`/policies/[id]?from=`)
`learner-policy-reader.jpg`
- Üst bar: `✕` + siyasət adı.
- `Version 1` pill + `Published 03.10.2026`, H1, lead, nömrələnmiş bölmələr (`reading` konteyneri, 40rem).
- Sonda `Your signature` bloku: checkbox `I have read this policy, I understand it and I will follow it.`, hesab parolunun daxil edilməsi, imza düyməsi. Tarix, vaxt və versiya qeyd olunur. Yeni versiya yenidən imza tələb edir.
- Nümunə mətn: [content/policy-acceptable-use.en.md](content/policy-acceptable-use.en.md).

## 9. Oyunlaşdırma qaydaları (müşahidə edilən)
- XP: modul XP-si dərslər arasında bölünür. Gündəlik hədəf 50 XP. Level hər ~? XP-də (`levelProgress` 0.5 → 175 XP-də level 2).
- Streak və `streakFreezes`.
- `riskScore` 0–100 (aşağı daha yaxşıdır). Admin hədləri: 0–33 Low, 34–66 Medium, 67–100 High. `Automatic refresher lesson` threshold default 67.
- Şöbə liqası: aylıq, xal = 60% tamamlanma + 40% phishing reporting. Hər report +5 XP (`report_bonus`).
- Sertifikat: modul + attestasiya tamamlananda verilir. Mətn tenant-ə görə dəyişir, `{name}`, `{module}`, `{date}` placeholder-ləri var.
