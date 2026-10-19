# Dərs mühərriki: məzmun sxemi və maskot (canlı portaldan, 2026-10-15)

Bu sənəd dərs məzmununun **məlumat formatını** təsvir edir. Məlumat canlı portalda dərs səhifəsinin serverdən gələn props-larından götürülüb. Məzmun dərs pleyerinə bu formada çatır və yeni portalda eyni formatı (və ya onun genişləndirilmiş versiyasını) saxlamaq tövsiyə olunur.

Fayllar:
- [content/lessons/{module}/{lessonId}.en.json](content/lessons/): **106 dərsin hamısı** (EN). Hər fayl dərs səhifəsinin props-larıdır, `narration` çıxarılıb.
- [content/lessons/SCRIPTS.en.md](content/lessons/SCRIPTS.en.md): bütün ssenarilərin oxunaqlı kitabı (beat-lər, suallar, düzgün cavablar, simulyasiya nəticələri).
- [content/lessons/_index.json](content/lessons/_index.json): dərs → səhnələr siyahısı, səs klipi sayı və müddəti.
- [content/lessons/_brands.json](content/lessons/_brands.json): 169 brend reyestri (real və saxta).
- [content/lessons/_narration-sample.json](content/lessons/_narration-sample.json): bir dərsin tam səs manifesti (39 klip, söz-söz vaxtlama).
- [assets/mascot.riv](assets/mascot.riv): maskotun Rive faylı. [assets/](assets/) qovluğunda tenant loqosu, PWA ikonları və favicon da var.

## 1. Dərs səhifəsinin props-ları
```ts
type LessonPageProps = {
  module: { slug: string; title: string; category: Category };   // category: email | identity | social | devices | data | physical | incident | ai-threats | work
  lesson: { id: string; title: string; minutes: number; scenes: Scene[] };
  nextLesson: { id: string; title: string } | null;
  isLastLesson: boolean;          // true olduqda sonda attestasiya (Confirm the module) gəlir
  locale: 'az' | 'en' | 'ru' | ...;
  narration: Record<string /* say mətni */, { url: string; durationMs: number; words: { w: string; startMs: number; endMs: number }[] }>;
  userId: string;
  timeLimitsEnabled: boolean;     // tenant: Settings → Learning
  difficulty: 1 | 2 | 3;          // Easy | Medium | Hard
  timerPreference: 'standard' | 'more' | 'off';   // learner: Profile → Question timer
  contentRevision?: string;
  appBuild: string;               // git sha
};
// Ayrıca: brands: Record<string, Brand> (layout səviyyəsində ötürülür)
```
Səs klipləri **mətnin özü ilə** açarlanır (`narration["Hello! I am…"]`). Mətn dəyişəndə klip avtomatik yenidən yaradılır. Fayllar `/generated/tts/{locale}/{hash}.m4a` ünvanındadır. Orta dərs ~35–40 klip, ~3.5 dəqiqə səs.

## 2. Səhnə tipləri (106 dərs üzrə say)
| type | say | sahələr | UI |
|---|---|---|---|
| `tutor` | 106 | `beats[]` | İzah: maskot danışır, sinxron karaoke mətn, solda vizual |
| `intro` | 1 | `title, body, mood, visual` | Ssenari girişi ("Your turn") |
| `simulation` | 97 | `environment, title, intro, steps[]` | İnteraktiv mühit (inbox / phone / browser / desktop / call) |
| `choice` | 94 | `question{prompt, options[{id,label,correct,feedback}]}, explain` | Çoxseçimli sual + feedback sheet |
| `hotspot` | 59 | `prompt, artifact, spots[{id,label,explain}], minToFind` | Artefaktda şübhəli yerləri tapmaq (toxunma) |
| `swipe` | 55 | `prompt, cards[{id, artifact, verdict: threat/safe, explain}]` | Kartı sağa/sola sürüşdürmək: "Safe or a trap?" |
| `match` | 44 | `prompt, pairs[{id,left,right}], explain` | Cütləri uyğunlaşdırmaq |
| `scenario` | 41 | `title, start, nodes[{id,text,speaker,voice,channel,character,spoken,choices[{label,next|outcome,feedback}]}]` | Budaqlanan dialoq (zəng, mesaj, üzbəüz, video) |
| `order` | 35 | `prompt, items[{id,label}], explain` | Addımları düzgün sıraya düzmək (items düzgün sıradadır, UI qarışdırır) |
| `password` | 4 | `prompt, targetScore (0–4), tips[]` | Parol gücü ölçən tapşırıq (zxcvbn tipli skor) |
| `recap` | 106 | `points[], mood: celebrate` | Dərsin yekunu |
Tipik ardıcıllıq: `tutor` → `simulation` → `hotspot`/`swipe`/`match`/`order` → `choice` → `recap`.

### Beat (tutor daxilində)
`{ id, say, mood, gesture?, visual, highlight?, checkpoint?, stage? }`
- `mood`: `talk` | `think` | `alert` | `happy` | `celebrate`
- `gesture`: `wave`, `point-left`, `point-right`, `point-down`, `recite`, `lean-in`, `shield-up`, `shake`, `shrug`, `nod`
- `visual.kind`: `illustration` (id ilə) | `artifact` (aşağıda) | `stat` (`value` + `label`, məs. "3-2-1", "15+ characters")
- `highlight`: artefaktdakı `spot` id-si. O beat səslənəndə həmin hissə vurğulanır.
- İllüstrasiya id-ləri (29): shield, eye, lock, alarm, phone-lock, handshake, browser, badge-id, key, mfa-phone, inbox, folder, social, mask, download, deepfake, hook, cloud, usb, desk, update, wifi, ceo, ransomware, travel, certificate, vpn, flag, qr. Bunlar iki rəngli (brand + accent) dairəvi fonlu SVG səhnələrdir. Yenidən çəkilməlidir.

### Zəngin mətn (rich text)
Mətn sahələri `Span[]` (bir sətir) və ya `Span[][]` (paraqraflar) ola bilər:
`{ text: string; spot?: string; link?: { label, href }; reveal?: string }`
- `spot`: hotspot və highlight zonası (192 fərqli id: domain, link, urgency, deadline, fee, new-iban, twin, ext, zip...)
- `reveal`: Lens alətinin göstərdiyi "əslində" mətni (məs. linkin əsl domeni)
- `link.href`: üzərinə gələndə və ya Lens ilə görünən real ünvan

### Artefaktlar (11 növ)
`email` (161) · `chat` (151) · `dialog` (135) · `call` (90) · `url` (74) · `notification` (70) · `sms` (60) · `file` (40) · `login` (39) · `permission` (31) · `qr` (13). Hamısında `brandRef` var.
- `email`: `from{name,address}`, `to`, `subject`, `time`, `body`, `attachments[{name,size}]`
- `chat`: `app` (whatsapp / telegram / generic / brend tətbiqi), `contact`, `messages[{from: them|me, body, voice?, spoken?}]` (səsli mesaj da ola bilər)
- `sms`: `sender`, `time`, `messages`
- `dialog`: `tone` (app / system / warning), `title`, `body`, `buttons[]`
- `login`: `brand`, `url`, `fields[]`, `button` (saxta giriş pəncərəsi)
- `url`: `url` spans (`reveal` ilə)
- `notification`: `app`, `title`, `body`, `time`
- `permission`: `app`, `permissions[{label, needed}]`
- `call`: zəng ekranı (zəng edən, nömrə)
- `file`: fayl adı, uzantı, ölçü (gizli `.exe` / `.html` / `.zip` tələləri)
- `qr`: QR kodu və açacağı ünvan

### Simulyasiya
`environment`: `phone` (26), `browser` (23), `desktop` (19), `call` (15), `inbox` (14).
`steps[]`: `{ id, label?, say?, spoken?, artifact, actions[] }`. Hər addımda bir artefakt və hərəkət düymələri var.
`actions[]`: `{ id, label, kind, outcome: 'safe' | 'risky' | 'compromised', feedback, next? }`
- `kind` (30): report, reply, cancel, share, verify, click-link, ignore, delete, open, enter-credentials, hang-up, keep-private, allow, call-back, later, deny, block, install, open-attachment, mark-safe, answer, decline, forward, update, disconnect, connect, eject, plug-in, enable-content, scan
- `next`: başqa addıma keçid (budaqlanma). Yoxdursa, növbəti addıma keçir.
- Nəticələr: 626 safe, 318 risky, 250 compromised. Risk balı, admin hesabatları və webhook-lar (`simulation.risky`, `simulation.reported`) bu nəticələrdən qidalanır.

### Scenario (budaqlanan dialoq)
`channel`: phone, in-person, message, video. `voice` (11): man, man-2, man-3, woman, woman-2, young-woman, young-man, young-man-2, older-man, older-woman, child. `character` (13): leyla, kamran, guest, tural, minister, assistant, narmin, aysel, gunay, rashad, citizen, guard, nigar. Seçim ya `next` node-a aparır, ya da `outcome` ilə bitir. `spoken` sahəsində TTS teqləri var (`<breath>`, `<short pause>`...).

### Brend reyestri (`_brands.json`)
`{ id, name, kind, color, glyph (lucide ikon adı), monogram?, fake?, imitates? }`. Növlər: app 55, gov 21, employer 17, generic 13, cloud 10, shop 10, media 10, courier 7, utility 7, payment 5, bank 4, social 4, telecom 3, messenger 2, hotel 1. Saxta brend (`fake: true, imitates: "<real-id>"`) eyni ada və bir az fərqli rəngə malikdir. Bütün brendlər uydurmadır (Xidmət Agentliyi, DocuSfera, NovaBank, UlduzBank, SuretKargo, OfisTəchizat...) və real şirkətləri təqlid etmir.

## 3. Maskot (Rive)
Fayl: [assets/mascot.riv](assets/mascot.riv) (250 KB). Runtime: `@rive-app/react-canvas` (orijinal `/rive/rive.wasm` istifadə edir).
- Artboard: **`Mascot`**. Personaj: qalxan formalı robot, visor-üz, antena, toga, dəfnə tacı (Laurel), qolları, hammok (nap rejimi), alma (idle act).
- State machine: **`Main`**. Layer-lər: Breath, Blink, Life, Mood, Talk, Gesture, Topic, Act, Poke, LookX, LookY, Aim, Touch, React, Glass.
- **Input-lar**: `mood`, `talking`, `bounce`, `gesture`, `gesture-play`, `idleAct`, `idle-play`, `wake`, `lookX`, `lookY`, `poke`, `pokeZone`, `topic`, `aimAngle`, `aimOn`, `aimHand`, `touch`, `travel`, `travelDir`, `depart`, `arrive`, `wait`, `listen`, `perch`, `whisper`, `knock`, `react`, `reactGo`, `peer`, `tap`, `trace`.
- Mood animasiyaları: `mood_idle`, `mood_talk`, `mood_happy`, `mood_think`, `mood_alert`, `mood_sad`, `mood_celebrate`, `mood_surprised`, `mood_proud`, `mood_curious`, `mood_worried`, `mood_excited`, `mood_sleepy`, `mood_laughing`. Dərslərdəki `mood` dəyərləri bunlara uyğun gəlir, landing-dəki `emotion` teqləri də onlara xəritələnir.
- Jestlər: `gesture_rest`, `point-left/right/up/down`, `wave`, `nod`, `shake`, `cheer`, `shrug`, `lean-in`, `shield-up`, `inspect`, `lecture`, `eureka`, `reassure`, `toss`, `bow`, `attention`, `recite` (+ `recite_read`, `recite_close`, açılan tumar), `hop`, `facepalm`, `count`, `explain`, `tap-left/right`, `ponder`, `present`.
- Danışma: `talk_on` / `talk_off`, `talkbody_0..3` (səsin amplitudasına görə ağız və bədən).
- Idle aktları: `act_nap_in/loop/wake` (hammokda yatır), `act_apple`, `act_read`. Poke: `poke_head/face/body/antenna` (toxunanda reaksiya).
- Mövzu rekvizitləri (`topic_*`): none, email (qarmaq + zərf), identity (açar), social (maska + nitq balonu), devices (telefon), data (qıfıl), physical (bec kartı), incident (zəng), ai-threats (piksel üz), work (portfel). Kataloqun kateqoriyalarına uyğundur.
- Baxış və nişan: `look_x_0..2`, `look_y_0..2`, `aim_*` (R0…R330, L90…L270, listen, whisper). Maskot ekrandakı elementə (məs. email ünvanına) qolu ilə işarə edir.
- Bələdçi (landing turu): `guide_rest/wait/listen/whisper/perch/travel_l/travel_r/depart/arrive`, `knock_R/L`, `tap_R/L`, `trace_R/L`, `touch_*`, `wipe_R/L`, `glass_rest/peer` (böyüdücü şüşə), Burst / AhaSpark / PokeSpark particle effektləri.

## 4. Pleyerin davranışı (UI müşahidəsi + məlumat)
- Hər `say` səsləndirilir. Söz vaxtlamaları ilə mətn vurğulanır və `highlight` artefaktda göstərilir. Səs bitəndə tutor beat-i avtomatik keçir.
- Sual səhnələrində cavabdan sonra feedback sheet açılır (düzgün: yaşıl `Well done` / `Good move`, səhv: qırmızı). İzah səsləndirilir.
- `timeLimitsEnabled && difficulty >= 2` olduqda bəzi suallar taymerlə işləyir. `timerPreference` (`more` / `off`) əlçatanlıq üçün vaxtı artırır və ya taymeri söndürür.
- Lens aləti `reveal` / `link.href` sahələrini göstərir. "Ask" düyməsi AI tutora səsli sual verir (kontekst: dərs və cari səhnə).
- Son dərsdən sonra attestasiya (tenant mətni), sonra sertifikat (`/c/{token}`).

## 5. Rebuild üçün qeydlər
- Məzmunu bu JSON formatında repoda saxlayın (`content/modules/...`). Build zamanı TTS generasiya skripti `say` / `spoken` mətnləri üçün klip və söz vaxtlaması yaradır.
- AZ və RU mətnləri hələ çıxarılmayıb: dərs məzmunu istifadəçinin profil dilinə görə gəlir. Çıxarmaq üçün demo admin profilinin dilini müvəqqəti `az` / `ru` etmək lazımdır.
- İllüstrasiyalar (29), brend loqoları (lucide glyph + rəng ilə generasiya olunur) və artefakt komponentləri (11 növ) yenidən yazılmalıdır. Data hazırdır.
