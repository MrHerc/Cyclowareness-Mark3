# Təlim kataloqu (canlı portaldan, 2026-10-15)

Cəmi **53 modul**, **106 dərs**, **319 dəqiqə**, **11630 XP**. Maşın oxunan versiya: [data/modules.json](data/modules.json).

Mətnlər EN locale-dan götürülüb (admin profili `en`). Tenant-də aktiv dillər: Azərbaycanca (default), English, Русский; platforma 10 dili dəstəkləyir.

## /learn səhifəsi

- Başlıq: `Learn` + `51 modules` (seçilmiş auditoriyaya görə sayılır).
- Axtarış: `Search a topic...` (aria: `Search modules`).
- Görünüş seçimi (radio seqment): `My path` | `Catalog`.
- Auditoriya (radio seqment): `Everyone` | `Leaders` | `IT`.
- Kateqoriya çipləri: `All` (aktiv olanda ✓ ikonlu tünd pill), `Email`, `Accounts`, `Social engineering`, `Devices`, `AI threats`, `Physical security`, `Data`, `Workplace`, `Incidents`.
- Kart: sol tərəfdə ikon kvadratı (brand-50 fon), başlıq, alt başlıq, status pill (`For you` / `66% complete` / `0% complete`), meta: ⏱ `9 min`, 📚 `3 lessons`, ⚡ `300 XP` (narıncı). Sağda `›`.
- `My path` sırası: əvvəl "For you" tövsiyələri (istifadəçinin şöbəsinə görə), sonra davam edənlər, sonra qalanlar. `Catalog` sırası aşağıdakı cədvəl sırasıdır.

## Taksonomiya

| Kateqoriya | Modul sayı |
|---|---|
| Social engineering | 10 |
| Devices | 10 |
| Accounts | 8 |
| Workplace | 7 |
| Email | 5 |
| Data | 5 |
| AI threats | 3 |
| Physical security | 3 |
| Incidents | 2 |

Çətinlik: Medium — 29, Easy — 21, Hard — 3.

Auditoriya:
- **Everyone**: 51 modul (rola xas iki modul xaric hamısı).
- **Leaders** (8): `app-consent-phishing`, `deepfake-scams`, `executive-threats`, `insider-threat`, `meeting-security`, `official-information`, `travel-security`, `vendor-email-compromise`. `executive-threats` yalnız rəhbərlər üçündür.
- **IT** (4): `ai-tools-safety`, `dangerous-attachments`, `infostealers`, `it-admin-risks`. `it-admin-risks` yalnız IT üçündür.

## Modul səhifəsi (`/learn/[slug]`)

- `‹ Catalog` geri linki, kateqoriya pill-i, H1 başlıq, alt başlıq.
- Sol: `Lessons` siyahısı. Hər sətir nömrə dairəsi (tamamlananda yaşıl ✓, cari dərs narıncı dairə və narıncı çərçivə), dərs adı, ⏱ `3 min`, status `Completed`.
- Sağ yapışqan kart: modul illüstrasiyası, 4 stat plitəsi (`Minutes`, `Lessons`, `XP`, `Difficulty`), narıncı progress bar + faiz, əsas düymə `▶ Continue` / `Start`, ikinci link `↻ Start module over`, `Certificate` bloku: "Finish the module to earn your certificate."
- Yükləmədə bulanıqdan aydına keçən reveal animasiyası (blur → sharp).

## Bütün modullar

| # | slug | Kateqoriya | Auditoriya | Başlıq | Alt başlıq | dəq | dərs | XP | Çətinlik |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `phishing-email` | Email | everyone | Phishing emails | Spot a fake email at first glance | 9 | 3 | 300 | Easy |
| 2 | `passwords-mfa` | Accounts | everyone | Passwords and sign-in safety | Protect your accounts from takeover | 9 | 3 | 300 | Easy |
| 3 | `social-engineering` | Social engineering | everyone | Social engineering | Spot tricks in calls, texts and visits | 9 | 3 | 350 | Medium |
| 4 | `mobile-wifi` | Devices | everyone | Mobile and Wi-Fi | Keep your phone and connection safe | 9 | 3 | 300 | Easy |
| 5 | `quishing` | Email | everyone | QR code phishing | Check the address before you open | 3 | 1 | 150 | Medium |
| 6 | `deepfake-scams` | AI threats | everyone, leaders | Deepfake scams | A familiar voice is not proof | 9 | 3 | 300 | Medium |
| 7 | `malware-ransomware` | Devices | everyone | Malware and ransomware | Suspect it? Disconnect and report | 9 | 3 | 300 | Medium |
| 8 | `safe-browsing` | Devices | everyone | Safe browsing | The padlock is not a safety promise | 3 | 1 | 120 | Easy |
| 9 | `usb-media` | Physical security | everyone | USB drives and chargers | A found flash drive is no gift | 2 | 1 | 120 | Easy |
| 10 | `personal-data` | Data | everyone | Personal data | Other people's data is in your care | 3 | 1 | 150 | Medium |
| 11 | `data-sharing` | Data | everyone | Sharing data safely | Before sending: what, to whom, how | 9 | 3 | 300 | Medium |
| 12 | `physical-security` | Physical security | everyone | Physical security | Sometimes an attack walks in the door | 9 | 3 | 300 | Easy |
| 13 | `remote-work` | Workplace | everyone | Remote work | Your office needs protection at home too | 3 | 1 | 150 | Medium |
| 14 | `social-media` | Social engineering | everyone | Social Media | Think for a moment before you post | 3 | 1 | 120 | Easy |
| 15 | `secure-messaging` | Workplace | everyone | Secure Messaging | Work data belongs in approved channels | 3 | 1 | 150 | Medium |
| 16 | `software-updates` | Devices | everyone | Software Updates | Updates close the door on attackers | 3 | 1 | 120 | Easy |
| 17 | `incident-reporting` | Incidents | everyone | Report Incidents | Fast reporting limits the damage | 9 | 3 | 300 | Easy |
| 18 | `travel-security` | Workplace | everyone, leaders | Travel Security | Protect your devices on every trip | 3 | 1 | 150 | Medium |
| 19 | `cloud-accounts` | Data | everyone | Cloud Accounts | Know who can open your links | 3 | 1 | 150 | Medium |
| 20 | `executive-threats` | AI threats | leaders | Threats to Leaders | High office, high-value target | 10 | 3 | 350 | Hard |
| 21 | `it-admin-risks` | Accounts | it | Admin Risks | More privilege, more responsibility | 4 | 1 | 200 | Hard |
| 22 | `official-information` | Data | everyone, leaders | Official information | Keep and share classified documents correctly | 9 | 3 | 350 | Medium |
| 23 | `authority-scams` | Social engineering | everyone | Fake authorities | Fake prosecutor, court and tax traps | 6 | 2 | 250 | Medium |
| 24 | `e-signature-misuse` | Accounts | everyone | E-signature | Your PIN and your signature are yours alone | 6 | 2 | 250 | Medium |
| 25 | `ai-tools-safety` | AI threats | everyone, it | AI tools safety | Use chatbots without leaking information | 6 | 2 | 250 | Medium |
| 26 | `vendor-email-compromise` | Email | everyone, leaders | Vendor email fraud | New bank details? Call first | 6 | 2 | 300 | Hard |
| 27 | `dangerous-attachments` | Email | everyone, it | Dangerous attachments | Names can lie, check the file type | 6 | 2 | 250 | Medium |
| 28 | `insider-threat` | Workplace | everyone, leaders | Insider threat | Mistake or intent: use the right channel | 6 | 2 | 250 | Medium |
| 29 | `meeting-security` | Workplace | everyone, leaders | Meeting security | Who is listening, what is on screen? | 6 | 2 | 250 | Medium |
| 30 | `work-phone-mdm` | Devices | everyone | Work phone | Keep your work phone managed and safe | 6 | 2 | 200 | Easy |
| 31 | `documents-printing` | Physical security | everyone | Documents and printing | Protect papers from printer to shredder | 6 | 2 | 200 | Easy |
| 32 | `events-delegations` | Workplace | everyone | Events and delegations | Protect information at conferences and official visits | 6 | 2 | 200 | Medium |
| 33 | `fake-official-accounts` | Social engineering | everyone | Fake official accounts | Check the source before you trust or share | 6 | 2 | 200 | Easy |
| 34 | `password-managers-work` | Accounts | everyone | Password managers at work | One strong password, the manager remembers the rest | 6 | 2 | 200 | Easy |
| 35 | `clicked-now-what` | Incidents | everyone | Clicked: now what? | Stop the damage in the first 15 minutes | 6 | 2 | 200 | Easy |
| 36 | `tech-support-scams` | Social engineering | everyone | Fake Tech Support | A scary screen, a helpful call: both are fake | 6 | 2 | 200 | Medium |
| 37 | `fake-captcha-commands` | Devices | everyone | Fake CAPTCHA | No real check asks you to type commands | 6 | 2 | 200 | Medium |
| 38 | `messenger-hijack` | Accounts | everyone | Messenger Account Hijack | The six-digit code is your account key | 6 | 2 | 200 | Medium |
| 39 | `sim-swap-otp` | Accounts | everyone | SIM swap and OTP | Lose your number, lose your accounts | 6 | 2 | 200 | Medium |
| 40 | `infostealers` | Devices | everyone, it | Infostealers | No password needed: a stolen session is enough | 6 | 2 | 200 | Medium |
| 41 | `app-consent-phishing` | Accounts | everyone, leaders | The "Allow" trap | It wants no password, only permission | 6 | 2 | 200 | Medium |
| 42 | `fake-login-windows` | Accounts | everyone | Fake login windows | Looks real, but trapped inside the page | 6 | 2 | 200 | Medium |
| 43 | `browser-extensions` | Devices | everyone | Risky browser extensions | A useful extension can turn into a spy | 6 | 2 | 200 | Medium |
| 44 | `search-ads-lookalikes` | Devices | everyone | Fake sites in search | The first result is not always right | 6 | 2 | 200 | Medium |
| 45 | `fake-payment-links` | Social engineering | everyone | Fake payment links | Fine, parcel, benefit: link by text? Stop. | 6 | 2 | 200 | Easy |
| 46 | `task-job-scams` | Social engineering | everyone | Fake job offers | A real job never asks you to pay | 6 | 2 | 200 | Easy |
| 47 | `investment-scams` | Social engineering | everyone | Investment and crypto traps | Never trust platforms that guarantee returns | 6 | 2 | 200 | Medium |
| 48 | `online-shopping-scams` | Social engineering | everyone | Online shopping scams | Low price, prepayment, then silence | 6 | 2 | 200 | Easy |
| 49 | `romance-scams` | Social engineering | everyone | Romance scams | Never pay someone you have not met | 6 | 2 | 200 | Easy |
| 50 | `extortion-emails` | Email | everyone | Extortion emails | "I hacked your camera" emails are a bluff | 6 | 2 | 200 | Easy |
| 51 | `payroll-diversion` | Workplace | everyone | Payroll diversion | Bank details never change by email | 6 | 2 | 200 | Medium |
| 52 | `smart-cameras-iot` | Devices | everyone | Smart devices and cameras | Who is your camera filming for? | 6 | 2 | 200 | Easy |
| 53 | `backups-recovery` | Data | everyone | Backup and recovery | Always keep one copy off the network | 6 | 2 | 200 | Easy |

## Dərslər (modul üzrə)

### Phishing emails (`phishing-email`)
1. Spot the phish, `spot-the-phish`, 3 dəq
2. Links and attachments, `links-attachments`, 3 dəq
3. The fake director, `ceo-fraud`, 3 dəq

### Passwords and sign-in safety (`passwords-mfa`)
1. Passphrases, `passphrases`, 3 dəq
2. Password manager, `password-manager`, 3 dəq
3. Two-step verification, `mfa`, 3 dəq

### Social engineering (`social-engineering`)
1. Phone call tricks, `phone-call-tricks`, 3 dəq
2. Text and chat scams, `sms-messenger-scams`, 3 dəq
3. In person tricks, `in-person-pretexting`, 3 dəq

### Mobile and Wi-Fi (`mobile-wifi`)
1. App permissions, `app-permissions`, 3 dəq
2. Public Wi-Fi, `public-wifi`, 3 dəq
3. Lost phone, `lost-phone`, 3 dəq

### QR code phishing (`quishing`)
1. QR traps, `qr-traps`, 3 dəq

### Deepfake scams (`deepfake-scams`)
1. Cloned voices, `voice-clones`, 3 dəq
2. Fake video call, `fake-video-call`, 3 dəq
3. AI images and news, `ai-fakes`, 3 dəq

### Malware and ransomware (`malware-ransomware`)
1. Stop the spread, `stop-the-spread`, 3 dəq
2. The invoice trap, `invoice-trap`, 3 dəq
3. Fake updates, `fake-updates`, 3 dəq

### Safe browsing (`safe-browsing`)
1. Web traps, `web-traps`, 3 dəq

### USB drives and chargers (`usb-media`)
1. Unknown flash drive, `unknown-usb`, 2 dəq

### Personal data (`personal-data`)
1. Data in your care, `data-in-care`, 3 dəq

### Sharing data safely (`data-sharing`)
1. Classify and share, `classify-and-share`, 3 dəq
2. Links and cloud folders, `links-cloud`, 3 dəq
3. Wrong recipient, `wrong-recipient`, 3 dəq

### Physical security (`physical-security`)
1. Guarding the office, `office-guard`, 3 dəq
2. Your access badge, `badge-sense`, 3 dəq
3. Left and found, `left-and-found`, 3 dəq

### Remote work (`remote-work`)
1. Wherever you work, `work-anywhere`, 3 dəq

### Social Media (`social-media`)
1. Share Smart, `share-smart`, 3 dəq

### Secure Messaging (`secure-messaging`)
1. Chat Safely, `chat-safely`, 3 dəq

### Software Updates (`software-updates`)
1. Update Safely, `update-safely`, 3 dəq

### Report Incidents (`incident-reporting`)
1. Fast and Calm, `report-fast`, 3 dəq
2. The first minutes, `first-minutes`, 3 dəq
3. After a mistake, `after-mistake`, 3 dəq

### Travel Security (`travel-security`)
1. Safe Trip, `safe-trip`, 3 dəq

### Cloud Accounts (`cloud-accounts`)
1. Share With Care, `share-with-care`, 3 dəq

### Threats to Leaders (`executive-threats`)
1. Leading Securely, `lead-securely`, 4 dəq
2. Whaling, `whaling-board`, 3 dəq
3. A leader's fake voice, `deepfake-voice`, 3 dəq

### Admin Risks (`it-admin-risks`)
1. Admin Hygiene, `admin-hygiene`, 4 dəq

### Official information (`official-information`)
1. Classification labels, `classification-labels`, 3 dəq
2. Sharing documents, `sharing-official-documents`, 3 dəq
3. Outside requests, `outsider-requests`, 3 dəq

### Fake authorities (`authority-scams`)
1. Fake notices, `fake-legal-notices`, 3 dəq
2. Fake prosecutor call, `fake-prosecutor-call`, 3 dəq

### E-signature (`e-signature-misuse`)
1. PINs and codes, `pin-and-codes`, 3 dəq
2. Unexpected signing, `unexpected-signing`, 3 dəq

### AI tools safety (`ai-tools-safety`)
1. Never paste this, `what-not-to-paste`, 3 dəq
2. AI-made traps, `ai-lures-fake-apps`, 3 dəq

### Vendor email fraud (`vendor-email-compromise`)
1. New bank details, `vendor-bank-change`, 3 dəq
2. Hijacked thread, `hijacked-thread`, 3 dəq

### Dangerous attachments (`dangerous-attachments`)
1. Disguised files, `disguised-files`, 3 dəq
2. Editing and macro traps, `enable-content-traps`, 3 dəq

### Insider threat (`insider-threat`)
1. Careless mistakes, `accidental-insider`, 3 dəq
2. Warning signs, `insider-warning-signs`, 3 dəq

### Meeting security (`meeting-security`)
1. Safe video calls, `safe-video-calls`, 3 dəq
2. Fake participant, `deepfake-meeting`, 3 dəq

### Work phone (`work-phone-mdm`)
1. Work phone rules, `phone-rules`, 3 dəq
2. Lost work phone, `lost-phone`, 3 dəq

### Documents and printing (`documents-printing`)
1. Printers and scanners, `print-scan`, 3 dəq
2. Disposal and clean desk, `dispose-clean-desk`, 3 dəq

### Events and delegations (`events-delegations`)
1. Conferences and delegations, `conferences`, 3 dəq
2. Event Wi-Fi and charging, `event-wifi-charging`, 3 dəq

### Fake official accounts (`fake-official-accounts`)
1. Spot the impostor, `spot-the-impostor`, 3 dəq
2. Stop fake news, `stop-fake-news`, 3 dəq

### Password managers at work (`password-managers-work`)
1. Why a password manager, `why-a-manager`, 3 dəq
2. When autofill stays silent, `autofill-right-site`, 3 dəq

### Clicked: now what? (`clicked-now-what`)
1. The first 15 minutes, `first-15-minutes`, 3 dəq
2. Files and wrong recipients, `opened-file-sent-wrong`, 3 dəq

### Fake Tech Support (`tech-support-scams`)
1. Panic on Screen, `popup-panic`, 3 dəq
2. The Support Call, `the-support-call`, 3 dəq

### Fake CAPTCHA (`fake-captcha-commands`)
1. The Robot Check, `robot-check-trap`, 3 dəq
2. The Copied Command, `the-copied-command`, 3 dəq

### Messenger Account Hijack (`messenger-hijack`)
1. A Code by Mistake, `code-by-mistake`, 3 dəq
2. Devices and Votes, `device-and-votes`, 3 dəq

### SIM swap and OTP (`sim-swap-otp`)
1. Number gone dark, `number-goes-dark`, 3 dəq
2. SIM renewal call, `sim-renewal-call`, 3 dəq

### Infostealers (`infostealers`)
1. Free software, `free-installer`, 3 dəq
2. Stolen session, `stolen-session`, 3 dəq

### The "Allow" trap (`app-consent-phishing`)
1. Permission screen, `consent-screen`, 3 dəq
2. Meeting code, `meeting-code`, 3 dəq

### Fake login windows (`fake-login-windows`)
1. Drag the window, `drag-test`, 3 dəq
2. A shared document, `shared-doc-login`, 3 dəq

### Risky browser extensions (`browser-extensions`)
1. Picking in the store, `store-picks`, 3 dəq
2. The extension that changed, `update-turns`, 3 dəq

### Fake sites in search (`search-ads-lookalikes`)
1. Search results, `search-results`, 3 dəq
2. Look-alike addresses, `lookalike-domains`, 3 dəq

### Fake payment links (`fake-payment-links`)
1. Parcel fee, `parcel-fee`, 3 dəq
2. Check the page, `check-the-page`, 3 dəq

### Fake job offers (`task-job-scams`)
1. The task trap, `task-trap`, 3 dəq
2. The recruiter email, `recruiter-mail`, 3 dəq

### Investment and crypto traps (`investment-scams`)
1. The adviser's call, `adviser-call`, 3 dəq
2. The fake profit dashboard, `fake-dashboard`, 3 dəq

### Online shopping scams (`online-shopping-scams`)
1. Fake shop, `fake-shops`, 3 dəq
2. When you sell, `selling-safely`, 3 dəq

### Romance scams (`romance-scams`)
1. Weeks of chat, `weeks-of-chat`, 3 dəq
2. Call from a hospital, `hospital-call`, 3 dəq

### Extortion emails (`extortion-emails`)
1. A bluff email, `bluff-letter`, 3 dəq
2. A calm response, `calm-response`, 3 dəq

### Payroll diversion (`payroll-diversion`)
1. A new card number, `new-card-email`, 3 dəq
2. Fake salary portal, `fake-salary-portal`, 3 dəq

### Smart devices and cameras (`smart-cameras-iot`)
1. The camera panel, `camera-panel`, 3 dəq
2. Home network, `home-network`, 3 dəq

### Backup and recovery (`backups-recovery`)
1. Which copy survived?, `which-copy-survived`, 3 dəq
2. Phone backup, `phone-backup`, 3 dəq
