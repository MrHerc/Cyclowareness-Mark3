# Admin konsolu (canlı portaldan, 2026-10-15)

Şəkillər: [screens/](screens/) (`admin-*`). UI mətnləri EN locale-dan götürülüb, sözbəsöz verilib. Demo tenant: "Rəqəmsal İnkişaf Agentliyi" (slug `rida`), 34–35 nəfər, 5 şöbə.

## Route indeksi
| Route | Səhifə |
|---|---|
| `/admin` | Overview |
| `/admin/users` | People |
| `/admin/users/[id]` | Şəxs profili |
| `/admin/users?risk=high` | People, yüksək risk filtri ilə |
| `/admin/assignments` | Assignments |
| `/admin/campaigns` | Campaigns |
| `/admin/campaigns/new` | New campaign (5 addımlı sehrbaz) |
| `/admin/campaigns/[id]` | Kampaniya nəticələri |
| `/admin/policies` | Policies |
| `/admin/policies/[id]` | Siyasət (versiyalar, imzalar) |
| `/admin/problems` | Problem reports |
| `/admin/reports` | Reports |
| `/admin/league` | Department league (TV / full screen rejimi) |
| `/admin/audit` | Audit log |
| `/admin/departments` | Departments |
| `/admin/settings?tab=` | Settings: `branding`, `languages`, `identity`, `email`, `notifications`, `attestation`, `certificate`, `learning`, `protection`, `integrations` |

Admin API-ləri (audit log-da görünən): `GET /api/admin/overview`, `/api/admin/onboarding`, `/api/admin/league`, `/api/admin/departments`, `/api/admin/audit`, `/api/admin/settings/{branding|integrations|protection|learning|certificate|...}`. SSO: `/api/sso/callback/{tenantSlug}`, `/api/sso/start?tenant={slug}`.

## Admin qabığı
- **Sol sidebar** (desktop). Mobildə `Open menu` drawer.
  - Üstdə tenant loqosu, adı və `Admin console`.
  - Qrup **Workspace**: Overview, People, Assignments, Campaigns, Policies, Problem reports.
  - Qrup **Insights**: Reports, League, Audit log.
  - (Scroll ilə) **Departments**, **Settings**.
  - Aşağıda `Learner view` linki (`/`), istifadəçi kartı (`RH`, `Rəşad Hüseynov`, `Administrator`, ⌃⌄ hesab menyusu), `Terms of Use` · `Privacy Policy`.
- Səhifə başlığı: böyük H1 (headline), altında kontekst (`Whole organisation`, `35 people`...). Sağda əsas CTA (brand pill düymə, `+` ikonlu).
- Kartlar: ağ `surface`, `radius-xl`, yumşaq kölgə. Cədvəllər kart içindədir, sort ikonlu başlıqlar və üfüqi scroll var.

## Rollar
`Learner`, `Department head`, `Analyst`, `Campaign manager`, `Content creator`, `Administrator` (API: `tenant_admin`). Bundan başqa platforma səviyyəsində **super admin / platform operator** var: audit log-da "Super admin access: GET /api/admin/…" kimi qeydlər, `Platform operator access`, `Organisation created`, `Package or features changed`, `Admin access link issued`.

---

## 1. Overview (`/admin`)
- Sağ üstdə `Show data for` select: `All departments` + şöbələr.
- **Set up your organisation** (dairəvi progress `5/7`, `5 of 7 done`, `Hide`). Addımlar (Done / To do / Optional; bəziləri `Not needed` ilə bağlanır):
  1. `Create departments`: "Group people the way your organisation works." → `/admin/users`
  2. `Add people`: "Import a CSV file or add the first person." → `/admin/users`
  3. `Set up email`: "Connect your own mail server and send a test." → `/admin/settings?tab=email`
  4. `Add your logo`: "People see it in the app and in emails." → `?tab=branding`
  5. `Assign a module`: "Choose what people learn first." → `/admin/assignments`
  6. `Publish a policy`: "Share your acceptable use policy for sign-off." → `/admin/policies`
  7. `Require two-step sign-in`: "Protect admin accounts with a second step." → `?tab=identity` (`Mark as not needed`)
  8. `Connect your directory` (Optional): "Sync people from Active Directory." → `?tab=identity` (`Mark as not needed`)
- **KPI sırası** (5 xana): `Average risk` (`31`, pill `Low risk`, `Down 9 in 30 days` yaşıl), `Completion` (`52%`, `Up from 14% in 30 days`), `Learners` (`34`), `Active in 7 days` (`5`, `15% of learners`), `Phishing report rate` (`66%`, `Down from 71% in 30 days` qırmızı). Rəqəmlər 0-dan sayma animasiyası ilə qalxır.
- **Qrafiklər** (area/line, brand rəng, son nöqtədə dəyər etiketi, gizli `Date | Value` cədvəli ilə əlçatan):
  - `Average risk, last 30 days`: "0 to 100, lower is better". Y oxunda 34/66 xətləri, solda yaşıl-narıncı-qırmızı şaquli risk zolağı.
  - `Completion, last 30 days`: "of assigned lessons".
  - `Report rate, last 30 days`: "Share of simulations reported".
- **League this month**: `16 days left`, `Show on screen` → `/admin/league`. 5 sətir: yer dairəsi (1-ci narıncı), şöbə, progress bar, xal, trend.
- **People by risk level**: yaşıl/narıncı/qırmızı üfüqi bar. `Low 19 56%`, `Medium 15 44%`, `High 0 0%`.
- **Highest risk people**: `All people →` (`/admin/users?risk=high`). Sətir: avatar, ad, `şöbə, Never active / Active 1 week ago`, narıncı nöqtə və risk balı.
- **Departments** cədvəli: `Name`, `Learners`, `Completion` (mini bar + %), `Reporting`, `Risk` (sort).
- **Modules** cədvəli: `Module` (ikon), `Completed` (`18 of 34` mini bar), `Awaiting confirmation` (`3 people`, narıncı, 🔔 `Remind everyone waiting to confirm …`), `Rating`, `Average score`. Sağ üstdə `Assign a module →`.

## 2. People (`/admin/users`)
- Başlıq `People`, `35 people`.
- Düymələr: `Export`, `Download invite links (CSV)`, `Import CSV`, `+ Add person` (brand).
- Filtrlər: axtarış `Name or email…`, `Department` (All departments…), `Role` (Any role / Learner / Department head / Analyst / Campaign manager / Content creator / Administrator), `Status` (Any status / Active / Invited / Suspended / Deleted), `Risk` (Any risk / Low risk / Medium risk / High risk).
- Bulk zolağı: "Select people to remind them or change them together." + `🔔 Remind everyone waiting`.
- Cədvəl: ☐, `Person` (avatar + ad + email, sort), `Department`, `Role`, `Status` (pill: `Active` yaşıl, `Invited` bənövşəyi), `Confirmation` (`3 waiting` narıncı pill), `Risk`, `XP`, `Last active`, `Actions` (`Invite link: X` / `Password reset link: X`).
- **Add person** dialoqu: "They get the assignments of their department right away and a welcome email once sending is on." Sahələr: `Full name` (ph `Aysel Məmmədova`), `Work email` (ph `name@organisation.az`), `Role` (6 rol), `Department` (`No department` + şöbələr), `Job title` (Optional), `Interface language` (10 dil). Düymələr `Cancel`, `Add person`.
- **Import CSV** dialoqu: "Import people. Upload a CSV file. We check it first and show every problem before anything is saved." Addımlar `1 Upload` → `2 Review` → `3 Done`. Sütunlar: `name, email, department, job_title, role, manager_email`. Düymə `Check file`.

### Şəxs profili (`/admin/users/[id]`)
- `← People`. Header kartı: böyük avatar, ad (display), vəzifə (`Baş mütəxəssis`), pill-lər (`Learner`, `Active`), email, şöbə, `Joined Oct 7, 2026`. Hərəkətlər: `✎ Edit`, `🔑 Password reset link`, `Change role`, `Move department`, `Suspend` (qırmızı). Aşağıda `Delete person`.
- Stat sırası: `Risk score` (`50`, `Medium risk` pill, sparkline `Risk, last 30 days`), `XP`, `Level`, `Day streak` (`Longest 0`), `Badges`, `Certificates`.
- `Learning`: `Completed` / `In progress` / `Awaiting confirmation` (rəngli rəqəmlər), `Lessons completed`, `Time spent`, `First active`, `Last active`, `Active days, last 30`.
- `Answers`: "Correct on the first try". `Simulations`: "No simulation steps yet."
- `XP, last 30 days` (bar chart), `Activity, last 30 days` (heatmap: `Active 0 of 30 days`).
- `Weak areas`: "Topics with the lowest first-try correct rate" ("each topic needs at least 3 answers").
- `QR scans`: "No training QR code scanned with a phone."
- `Module progress` (53 modul statusu), `Confirmations`, `Learning path`, `Badges`, `Recent activity`.

## 3. Assignments (`/admin/assignments`)
- `4 assignments`, `+ Assign module`.
- Sətir kartı: modul ikonu, ad, `🌐 Everyone`, `📅 No due date`, `9 of 34 completed` + progress + `26%`, `✎ Edit due date`, `🗑 Remove` (qırmızı).
- **Assign a module** dialoqu: "People in the chosen scope see it at the top of their path." `Module` (axtarış + 53 modulun radio siyahısı, dəqiqə ilə), `Who`: `Everyone` | `Department` | `Person`, `Due date` (Optional): `Fixed date` | `After joining`. Düymələr `Cancel`, `Assign`.

## 4. Campaigns (`/admin/campaigns`) — phishing simulyasiyaları
- `5 campaigns`, `+ New campaign`.
- Xülasə kartı: `Report rate 20%`, "28 of 137 recipients reported the simulation", "Across 3 campaigns with results". Huni: `Sent 137` → `Opened 101 74%` → `Clicked the link 39 28%` (qırmızı) → `Reported 28 20%` (yaşıl fonla vurğulanır).
- Status filtrləri (pill + say): `All` `Draft` `Scheduled` `Running` `Completed` `Cancelled`.
- Kampaniya kartı: kanal ikonu, ad, status pill (`Draft` boz ✎, `Completed` yaşıl ✓), auditoriya (`Whole organisation` / şöbə), `Planned for Sep 24, 13:00` / `Sent Sep 9, 2026`. Sağda draft üçün `64 people` + şablon adı, tamamlanmış üçün mini metriklər (`Sent / Opened / Clicked / Reported`).
- Demo kampaniyalar: "Kuryer bağlaması və USB testi" (Draft, USB), "Rəhbərlər üçün konfrans dəvəti" (Draft, IT, executives), "Sentyabr maaş vərəqəsi simulyasiyası" (Completed, 64/44/17/14), "Maliyyə şöbəsi: bank rekvizitləri dəyişikliyi" (Completed, 12/10/2/6), "Yay kargo SMS kampaniyası" (Completed, SMS, 61/47/20/8).

### Kampaniya detalı (`/admin/campaigns/[id]`)
`← All campaigns`, ad, `Completed` + `Email` pill-ləri. `Results` ("Shares of the messages sent"): report rate və huni. `Audience and timing`: `Audience`, `People in the audience`, `Send time`, `Channel`. `Template`: ad, `Difficulty: Easy` və email önizləməsi.

### New campaign sehrbazı (`/admin/campaigns/new`), "Step N of 5"
Yuxarıda seçilmiş addımların "chip"ləri görünür (`Channel Email`, `Template …`, `Audience …`, `Schedule …`).
1. **How should the simulation reach people?** Kanal kartları: `Email` ("A phishing email in the work inbox", 6 templates), `SMS` ("A text message to the work phone", 3), `Voice call` ("A call from a pretend caller", 2), `USB drop` ("A USB stick left for someone to find", 1).
2. **Choose what they receive.** Şablon kartları real önizləmə ilə və `Difficulty` ilə:
   - Email: `September payslip` (Easy; muhasibat@xidmetagentIiyi.az), `Unpaid fine: final notice` (Easy; E-Xidmet Portal, bildiris@e-xidmet-portal.info, 40 AZN cərimə), `Overdue invoice` (Medium; OfisTəchizat MMC, `Faktura_0925.pdf.zip` ZIP 312 KB, makros), `Two-step verification renewal (QR)` (Medium; it-destek@rxagentlik-support.info, QR), `Changed bank details` (Hard; OfisTəchizat LLC, yeni IBAN), `Keynote invitation (executives)` (Hard; International Cooperation Fund, `Dear Mr Hasanov`).
   - SMS: `Parcel delivery SMS` (Easy; SuretKargo, 1.20 AZN), `Prize winner SMS` (Medium; 4.99 AZN), `Bank alert SMS` (Medium; UlduzBank kart bloku).
   - Voice: `Technical support call` (Medium; +994 12 000 33 44), `Call in the boss's voice (deepfake)` (Hard; Kamran Babayev).
   - USB: `Courier parcel and unknown USB` (Medium; "director's new assistant" SMS-i ilə).
3. **Who receives it?** `Whole organisation` ("Every active person in the organisation") | `One department` ("A department and its sub-departments").
4. **When should it go out?** `Not yet` ("Save the draft and launch it when you are ready") | `On a set date` ("Plan the date and time now", `Date` + `Time`).
5. **Check and save.** `Campaign name` ("Only admins see this name."), hər seçim üçün `Change` linki, qeyd "The campaign is saved as a draft. Nothing is sent until someone launches it.", düymələr `Back`, `Save as draft`.
Bütün sehrbaz client tərəfdə işləyir. Server-ə yalnız sonda yazır.

## 5. Policies (`/admin/policies`)
- `2 policies`, `+ New policy`. Tablar: `Active` | `Archived` | `All`.
- Sətir: ad, `Version 1` pill, `Published Oct 3, 2026`, `1 of 34 signed` + progress + `3%`.
- **New policy** dialoqu: "Give it a name people will recognise. You add the text next." `Name`, `Cancel` / `Create`.
- **Siyasət səhifəsi**: `All policies`, ad, `Created …`, `Archive`. Tablar `Versions` | `Sign-offs`. "A new version asks everyone to sign again." + `Version 2` (yeni versiya yaratmaq). `Published versions`: `Version 1 Current`, `Text`, tarix, xülasə, `0 of 34 signed 0%`, `View`, `Sign-offs`.
- Siyasət mətni: [content/policy-acceptable-use.en.md](content/policy-acceptable-use.en.md) (AZ adı: "İnformasiya resurslarından məqbul istifadə siyasəti").

## 6. Problem reports (`/admin/problems`)
"What learners reported from inside the app." Status kartları (filter kimi işləyir, aktiv olan brand çərçivəli): `New`, `In progress`, `Resolved`, `Not a problem`. Boş halda inbox ikonu, `No new reports`, "When a learner reports a problem, it appears here."

## 7. Reports (`/admin/reports`)
"Download for audits and leadership. Files use your interface language."
- Filtr: `From`, `To` (date), `Department`.
- Hesabat kartları, hər birində `CSV` · `Excel` · `PDF`:
  - `Completion`: "Who finished which assigned modules, and who is overdue."
  - `Risk`: "Risk score per person and department, with the 30 day change."
  - `People`: "Everyone with role, department, status and last activity."
  - `Modules`: "Assigned, completed and average score for each module."
  - `Module feedback`: "Anonymous ratings, reasons and comments for each module."
  - `Confirmations`: "Who confirmed each module, when, in which language and with which text, and who is still waiting."
  - `Compliance pack` (yalnız PDF, öz From/To ilə): "One PDF for auditors: training, confirmations, simulations, risk, security settings and a cross-check of who confirmed what."
- `Module feedback` bölməsi: "Anonymous ratings learners give after finishing a module. Lowest first."
- `Scheduled reports`: "Sent by email on the chosen day at 08:00, Baku time." Email qurulmayıbsa xəbərdarlıq + `Open email settings`. Boş halda "Get a report by email every week or every month."

## 8. Department league (`/admin/league`)
`October 2026`, `16 days left` pill, `● Updated 17:16`, `← Back to overview`, `⛶ Full screen` (TV/ofis ekranı üçün). Böyük sətirlər: nəhəng yer rəqəmi (1-ci narıncı dairə və narıncı çərçivə), şöbə adı (display), `6 learners`, progress bar, nəhəng xal, trend.

## 9. Audit log (`/admin/audit`)
"Every change made in the admin console, with who did it and from where."
- Filtrlər: `Action` (select), `From`, `To`. Səhifələmə `Previous page` / `Next page`.
- Cədvəl: `Time`, `Who` (avatar + ad), `Action` (insan dilində), `Change` (texniki kod, məs. `auth.sign_in`), `IP address`.
- **Hərəkətlərin tam siyahısı** (məhsulun funksiya xəritəsi kimi oxunur):
  Signed in · Sign-in refused · Device signed out by the limit · Person added · Person changed · People imported · Profile photo changed / removed · Invite link created · Invite links created in bulk · Bulk invite emails started / finished · Password reset link created · Password reset requested · Password set · Password setup refused · Two-step sign-in turned on / off · New backup codes created · Two-step sign-in reset · Other devices signed out · Person deleted · People changed in bulk · People list exported · Own data downloaded · Account deletion requested / approved / declined · Department created / renamed / moved / deleted · Departments merged · Notification queued · Setup guide changed · Module assigned · Assignment due date changed · Assignment removed · Attestation reminder sent · Campaign created / changed / cancelled · Campaign launch blocked · Report downloaded · Compliance pack generated · Report schedule created / changed / removed · Certificate downloaded · Policy created · Policy version published · Policy archived · Policy restored from the archive · Policy signed · Policy sign-off list downloaded · Policy sign-off reminder sent · Directory connection tested · Directory sync previewed / queued / confirmed / finished · Person linked to a directory account · Person deactivated / reactivated by directory sync · Directory sign-in turned on / off · Single sign-on turned on / off · Single sign-on connection tested · Single sign-on sign-in refused · Person created by single sign-on · Settings changed · Branding changed · Logo changed · Certificate design changed · Attestation text changed · Learning settings changed · Screen protection settings changed · Notification settings changed · Email settings changed / tested · Email domain verified · Email domain DNS record checked again · Email domain DNS record missing, verification at risk · Email domain verification removed · Sign-in and directory settings changed · Integration settings changed · Webhook secret rotated · Integration test sent · Platform set up · Organisation created / changed · Package or features changed · Admin access link issued · Email domain verified by the platform operator · Watermark code looked up · Problem report status changed · AI tutor answer removed from the cache · Platform operator access · Landing page settings saved as draft · Landing page text saved as draft · Landing page published · Landing page draft discarded · Landing page reset to the default · Landing page image uploaded / deleted · Landing page voice clips retried · Demo request status changed · Demo request deleted · Demo requests exported
- Nəticə: platformada tenant konsolundan başqa **operator konsolu** da var (landing CMS, demo sorğuları, tenant/paket idarəsi, domen təsdiqi). Bu konsola demo hesabla daxil olmaq mümkün olmadı.

## 10. Departments (`/admin/departments`)
`5 departments`, `+ Add department`, axtarış `Department or head…`. Ağac siyahısı (alt şöbə girintili, məs. Kibertəhlükəsizlik İT-nin altındadır). Sətir: ad, `6 people`, `1 sub-department`, `Head: …`. Hərəkətlər (ikon düymələr): `Add sub-department`, `Rename`, `Move`, `Delete`. Audit-də `Departments merged` da var.

## 11. Settings (`/admin/settings?tab=…`)
Başlıq `Settings` + tenant adı. Üfüqi tab zolağı (ikonlu pill-lər, üfüqi scroll ilə).

### Branding (`branding`)
- `Name and logo` ("Shown to learners in the app header and on emails."): `Display name`, `Logo` (drop zone: "PNG, SVG or JPEG, up to 512 KB. A square logo works best.", `Replace`, `Remove logo`).
- `Colours` ("Primary is for actions and structure. Accent marks rewards: XP, streaks, the next step."): `Primary` (rəng seçici + hex + `Default`), `Accent` (eyni). Hazır palitra: `#4F46E5 #0F6FBF #0F766E #1E7B3C #B42346 #6D28D9 #E2B007 #FF7A1A #F5A524 #E5484D #12A594 #3E63DD #D6409F`.
- `Email sender`: `Sender name`, `Sender domain` (ph `agency.gov.az`), "Emails go out as no-reply at this domain once it is verified."
- `Domain proof`: "Only a proven domain lets people with these addresses sign in with single sign-on and join automatically." Status `Proven`: "demo.cylosof.com was proven on 10/14/2026. It is checked every day; if the record is missing for 7 days, the proof ends." (DNS TXT ilə yoxlama.)
- Sağda **Learner view** canlı önizləmə ("Updates as you edit"): mini header, `Continue` hero kartı, `120 XP today`, `Learn`.

### Languages (`languages`)
- `Default language` ("New learners start in this language. Each person can switch later."): 10 dil.
- `Available languages` ("Learners can pick only from these.", `3 of 10 on`): checkbox kartları. Azərbaycanca, English, Русский: "Lessons and interface". Türkçe, Română, ქართული, Українська, Deutsch, Français, Italiano: "Interface, lessons in the default language". Yəni dərs məzmunu 3 dildə, interfeys 10 dildə var.

### Sign-in (`identity`)
- **Single sign-on** ("Staff sign in with their organisation account: Entra ID, ADFS, Keycloak, Okta or Google.", `Off`). Qeyd: "Administrators always sign in with their own password and two-step code, never through single sign-on." 6 addım:
  1. Protokol: `OpenID Connect` | `SAML 2.0`.
  2. Redirect URI: `https://cylosof.com/api/sso/callback/rida` (`Copy`).
  3. `Issuer URL` (ph `https://login.example.az/realms/staff`), `Client ID`, `Client secret` ("Stored encrypted. It is never shown again.").
  4. `Email claim` (ph `email`, "Example for Entra ID: upn"), `Create learners on first sign-in` (switch, "Unassigned" şöbəsinə düşür).
  5. Test: `Check settings`, `Open a test sign-in`.
  6. `Use single sign-on` switch, `Sign-in link for your organisation`: `https://cylosof.com/api/sso/start?tenant=rida`.
- **Directory sync (LDAP / Active Directory)** ("People removed from the directory are suspended, not deleted."):
  1. Connect: `Server address` (ph `ldaps://dc01.example.local:636`; portlar 636, 389, 3269, 3268), `Service account (bind DN)`, `Service account password`, `CA certificate` (`Upload .pem`), `Certificate pin (SHA-256)`, `Test connection`.
  2. Who: `Search base`, `User filter` (ph `(&(objectCategory=person)(objectClass=user)(mail=*))`).
  3. Departments: `Department source` `Attribute` | `OU` | `Groups`, `Attribute name` (ph `department`), `Sync managers`, `Sync language`.
  4. Schedule: `Automatic sync` (Every night / Every 6 / 12 / 24 hours), `Sign in with directory password`, `Match existing people by email`, `Run preview`, `Sync now`.
- Digər: `Require two-step sign-in for admins`, `Maximum devices signed in at once` (No limit / 1 / 2 / 3 / 5).

### Email (`email`)
- `Email delivery` ("Invite and password links go out through your own mail server.", `Not set`), `Send links by email` (switch, "Active only after a successful test email.").
- `Mail server`: `Server` (ph `smtp.example.az`), `Security` `STARTTLS` | `SSL/TLS`, `Port` (587), `User name`.
- `Sender`: `Sender name`, `Sender address` (ph `no-reply@example.az`), `Reply-to address (optional)`.
- `Problem reports by email`: `Helpdesk email (optional)`.
- `Test email` kartı: `Send to`, `Send test email` ("Save the settings first.").

### Notifications (`notifications`)
- Email çatdırılması statusu banneri + `Email settings ↗`.
- `Email templates` ("One template per message and language."): şablon tabları `New assignment`, `Reminder`, `Overdue`, `Manager alert`, `Welcome`; `Language` (aktiv dillər), `Subject` (məs. `Yeni təlim: {{module}}`), `Message` rich-text redaktoru (Bold, Italic, Link, Paragraph) və dəyişən düymələri `Name {{name}}`, `Module {{module}}`, `Due date {{dueDate}}`, `Link`. Default AZ mətni: "Salam, {{name}}! Sizə «{{module}}» təlimi təyin edilib. Son tarix: {{dueDate}}. [Təlimə başla]". Sağda canlı **Preview** (From/To, mövzu, düymə, footer: "You receive this because your organisation assigned you security training.").
- `Reminders`: `First reminder` (3 days after sent), `Urgent reminder` (24 hours before due), `Overdue notice` (switch).
- `Manager alerts`: `Alert managers` (switch), `Failed simulations` (2, in last 30 days), `Overdue for` (7 days).

### Confirmation text (`attestation`)
"Learners confirm this after the last lesson of a module. Only then does the module count as completed." `Default text` pill, `Language`, `Text learners confirm` (textarea, `69 / 600`). Default AZ: "Bu modulu özüm keçdim, qaydaları başa düşdüm və onlara əməl edəcəyəm." Default EN: "I went through this module myself, I understand the rules and I will follow them." Sağda önizləmə kartı: `Confirm the module`, modul adı, mətn, `○ I confirm`.

### Certificate (`certificate`)
- `Certificate text`: `Title` (ph `Certificate`), `Text` (400 simvol; placeholder-lər `{name}`, `{module}`, `{date}`). Default: "On {date}, {name} successfully completed the module "{module}" and confirmed that they will follow the rules of cyber hygiene."
- `Signature`: `Signer name`, `Signer title`.
- `Sharing`: `Public verification link` (switch; "Anyone with the link sees the name, module and date.").
- Önizləmə: solda brand+accent şaquli zolaq, tenant loqosu, sağ üstdə narıncı dişli medal (qalxan ikonu), `Certificate`, nəhəng ad (`Alex Morgan`), narıncı qısa xətt, mətn, modul pill-i, `Date 15.10.2026`, `Serial number DEMO-2026-000123`, `cylosof.com/c/…` (public verify URL).

### Learning (`learning`)
- `Time limits on questions` (switch): "Some questions in medium and hard modules run on a timer. When time is up, the question counts as a wrong answer."
- `Automatic refresher lesson` (switch): "When a learner's risk score reaches the threshold, they get one short refresher lesson. No penalty and no lost XP." `Risk threshold` slider 50–90, default 67.

### Protection (`protection`)
- `Content protection` (`On`): `Copying, printing and screen blur` ("Text cannot be selected or copied, printing gives a blank page and the screen blurs when the window is left."), `Screenshot and screen recording block in the Android app` ("Casting or mirroring to a projector turns black too. Needs app version 1.1.3 or later."). Deməli Android tətbiqi də var.
- `Leak check`: "Every screen carries a code people cannot see. The code tells whose screen a picture came from." Addım 1: şəkli seçmək/yapışdırmaq ("processed in this browser only"). Addım 2: `Code` (format `XXXX-XXXX`), `Check`.

### Integrations (`integrations`)
- **Webhook** ("Sends events as signed JSON to your SIEM or ticket system."): `Send events`, `Address` (https, port 443), `Signing secret` (`Create secret`), `Send test event`.
- **Syslog**: `Server`, `Transport` `TLS` | `TCP` | `UDP`, `Port` (6514 / 514 / 5514), `Format` `CEF` | `JSON (RFC 5424)`.
- Event tipləri (hər ikisi üçün checkbox): `qr.scanned`, `simulation.risky`, `simulation.reported`, `attestation.completed`, `risk.threshold_crossed`, `phishing.clicked`, `issue.reported`, `admin.audit`.
- "For your receiver" bələdçisi: başlıqlar `X-Cylosof-Signature` (`sha256=` + HMAC(body)), `X-Cylosof-Signature-Timestamped` (HMAC(timestamp + "." + body)), `X-Cylosof-Timestamp`, `X-Cylosof-Event`, `X-Cylosof-Delivery` (idempotency). Timestamp ±5 dəqiqə yoxlaması. "ServiceNow and Jira recipe".
