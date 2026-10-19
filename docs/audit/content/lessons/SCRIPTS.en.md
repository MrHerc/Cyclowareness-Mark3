# Dərs ssenariləri (EN, canlı portaldan, 2026-10-15)

Mənbə: `content/lessons/{module}/{lesson}.en.json`. İşarələr: ✅ düzgün/təhlükəsiz, ❌ səhv, ⚠️ riskli, 💀 kompromis, **mətn**⟨spot⟩ hotspot zonası, 🔊 səs tipi.


## Phishing emails (`phishing-email`) · Email · Easy · 300 XP

### Spot the phish (`spot-the-phish`, 3 dəq)

#### tutor · `meet-the-phish`
- 🗣 "Hello! I am your security helper. Today you will learn to spot a fake email in seconds." — _talk/wave, visual: hook_
- 🗣 "First, check the sender address. One letter is swapped here, and it is hard to spot." — _think/point-left, visual: artifact_, highlight `sender-domain`
  - 🗂 **email** (brand `xidmet-agentliyi-fake`)
    - from: Accounting <muhasibat@**xidmetagentIiyi.az**⟨sender-domain⟩>
    - to: e.mammadov@xidmetagentliyi.az
    - subject: September payslip
    - time: 09:12
    - body: **Dear user,**⟨greeting⟩ / Your September payslip is ready. **If you do not confirm within 24 hours, your payment will be stopped.**⟨urgency⟩ / **View payslip**⟨link⟩ → `https://xidmetagentliyi-az.maas-portal.info/giris` / Accounting department
- 🗣 "A deadline and a threat. When an email rushes you, that is your signal to stop." — _alert/point-down, visual: artifact_, highlight `urgency`
  - 🗂 **email** (brand `xidmet-agentliyi-fake`)
    - from: Accounting <muhasibat@**xidmetagentIiyi.az**⟨sender-domain⟩>
    - to: e.mammadov@xidmetagentliyi.az
    - subject: September payslip
    - time: 09:12
    - body: **Dear user,**⟨greeting⟩ / Your September payslip is ready. **If you do not confirm within 24 hours, your payment will be stopped.**⟨urgency⟩ / **View payslip**⟨link⟩ → `https://xidmetagentliyi-az.maas-portal.info/giris` / Accounting department
- 🗣 "Do not tap. On a computer, hover to read the address; on a phone, open the site yourself." — _talk/point-left, visual: artifact_, highlight `link`
  - 🗂 **email** (brand `xidmet-agentliyi-fake`)
    - from: Accounting <muhasibat@**xidmetagentIiyi.az**⟨sender-domain⟩>
    - to: e.mammadov@xidmetagentliyi.az
    - subject: September payslip
    - time: 09:12
    - body: **Dear user,**⟨greeting⟩ / Your September payslip is ready. **If you do not confirm within 24 hours, your payment will be stopped.**⟨urgency⟩ / **View payslip**⟨link⟩ → `https://xidmetagentliyi-az.maas-portal.info/giris` / Accounting department

#### simulation · `morning-inbox` · Morning inbox
- 🖥 mühit: `inbox` — It is nine in the morning and five new emails are waiting. Open each one and choose the right step.
  - **step `payslip`** — 🗣 "Read the sender address letter by letter."
    - 🗂 **email** (brand `xidmet-agentliyi-fake`)
      - from: Accounting <muhasibat@xidmetagentIiyi.az (əslində: `After "agent" comes a capital Latin "I", not a lowercase "l"`)>
      - subject: September payslip
      - time: 09:02
      - body: Dear user, / Your payslip is ready. If you do not confirm within 24 hours, the payment will be stopped. / View payslip → `https://maas-portal.info/giris`
    - ✅ [report] Report phishing — Right. The address has a capital I instead of a small l: a look-alike domain.
    - 💀 [click-link] Open the link — The link leads to maas-portal.info, not to the agency. A password typed there goes to the scammer.
    - ⚠️ [delete] Delete — You are safe, but colleagues got it too. Report it so the team can remove it for everyone.
  - **step `report-draft`**
    - 🗂 **email** (brand `xidmet-agentliyi`)
      - from: Elvin Mammadov <e.mammadov@xidmetagentliyi.az>
      - subject: Final version of the report
      - time: 08:47
      - body: Hello Aynur, / I have uploaded the final version of the report we discussed to the internal portal. Let me know once you have looked.
    - ✅ [reply] Reply — Right. A known colleague, the agency's domain, no link and no rush.
    - ⚠️ [report] Report phishing — This email is genuine: the right domain and no request at all.
  - **step `sign-request`**
    - 🗂 **email** (brand `docusfera-fake`)
      - from: DocuSfera <noreply@docusfera-imza.test>
      - subject: A document is waiting for your signature
      - time: 08:31
      - body: Management has sent you «Muqavile_2025.pdf» to sign. / Sign in with your work email to view it. / View document → `https://docusfera-imza.test/doc`
    - 💀 [click-link] Open the link — The domain was docusfera-imza.test, not the service itself. The page that opens is built to steal your work password.
    - ✅ [report] Report phishing — Right: an unexpected signing request from a strange domain. If unsure, call the sender on a known number.
  - **step `maintenance`**
    - 🗂 **email** (brand `it-destek`)
      - from: IT Support <it@xidmetagentliyi.az>
      - subject: Planned maintenance
      - time: 08:15
      - body: Email will be unavailable on Saturday from 20:00 to 22:00. No action is needed from you.
    - ✅ [mark-safe] Mark as safe — Right. An official address, no link, and nothing is asked of you.
    - ⚠️ [report] Report phishing — This email is genuine: it informs and asks for nothing.
  - **step `bonus-list`**
    - 🗂 **email** (brand `xidmet-agentliyi-fake`)
      - from: HR Department <kadrlar@xidmetagentliyi-az.com>
      - subject: Holiday bonus list
      - time: 07:58
      - body: Dear employee, / The list of bonus recipients is attached. Check your name today.
      - attachments: {"name": [{"text": "Mukafat_siyahisi.html"}], "size": "12 KB"}
    - 💀 [open-attachment] Open attachment — The list is an .html file that shows a fake sign-in page. The domain also ended in -az.com.
    - ✅ [report] Report phishing — Right: a strange domain, a tempting topic and an .html attachment. Ask HR about bonuses yourself.

#### hotspot · `find-the-signs`
- 🔍 Tap the signs of a fake. (ən azı 3)
  - 🗂 **email** (brand `e-xidmet-fake`)
    - from: E-Xidmet Portal (əslində: `bildiris@e-xidmet-portal.info`) <bildiris@**e-xidmet-portal.info**⟨sender-domain⟩>
    - subject: Unpaid fine: final notice
    - time: 11:47
    - body: **Dear citizen,**⟨greeting⟩ / A 40 AZN traffic fine has been issued in your name. / **If it is not paid within 48 hours, the amount will double and the case will go to court.**⟨threat⟩ / **Pay the fine**⟨link⟩ → `https://e-xidmet-portal.info/cerime?id=58213`
  - ⟨sender-domain⟩ **Unknown domain**: An official service does not write from an address like this. The name is made up to look official.
  - ⟨greeting⟩ **Generic greeting**: A real notice usually shows your name and a case number.
  - ⟨threat⟩ **Threat and deadline**: Fear and a short deadline push you to pay without checking.
  - ⟨link⟩ **Fake link**: The link collects your card details. Check fines by opening the official portal yourself.

#### choice · `first-move`
- ❓ What do you do with a suspicious email?
  - ✅ I press the Report phishing button — Right. No such button? Forward the email to your IT security contact. The team can then block it for everyone.
  - ❌ I open the link to check — One click can open a harmful page. Check the address instead.
  - ❌ I reply and ask the sender — Your reply goes straight to the scammer. Of course they will say it is fine.
  - ❌ I forward it to colleagues to look at — That spreads the danger. Report it and the team will look.
- 💡 Reporting protects you and your colleagues. If your mail has no Report phishing button, forward the email to IT security.

#### swipe · `safe-or-phish`
- 👉 Safe or threat?
  - 🛑 threat `card-blocked`: The sender name can be faked, and the link is not the bank's site. If in doubt, call the number on the back of your card.
    - 🗂 **sms** (brand `ulduzbank-fake`)
      - sender: UlduzBank
      - time: 08:03
      - 💬 UlduzBank: Your card has been blocked. To unblock it, sign in: https://ulduzbank-az.info/kart
  - ✅ safe `meeting`: A known colleague, the right address, no link and no request. A normal work email.
    - 🗂 **email** (brand `xidmet-agentliyi`)
      - from: Elvin Mammadov <e.mammadov@xidmetagentliyi.az>
      - subject: Tomorrow's meeting
      - time: 10:21
      - body: Hello Aynur, / See you tomorrow at 10:00 in room 3. The agenda is in yesterday's email.
  - 🛑 threat `courier`: The tiny amount lowers your guard. The real goal is to steal your card details.
    - 🗂 **sms** (brand `cevikkargo-fake`)
      - sender: +994 70 000 88 31
      - time: 13:40
      - 💬 ÇevikKargo: Your parcel is held at the warehouse. Pay a 1.20 AZN fee: https://cevik-kargo.info/odenis
  - ✅ safe `holidays`: A general greeting is not always a threat. The address is right, with no link and no rush.
    - 🗂 **email** (brand `xidmet-agentliyi`)
      - from: HR department <kadrlar@xidmetagentliyi.az>
      - subject: Public holidays
      - time: 16:05
      - body: Dear colleagues, / The work schedule for the November holidays is on the internal portal.
  - 🛑 threat `mailbox-full`: The address ends in an extra -az.com, which is not the agency's domain. Logins are not confirmed through a link.
    - 🗂 **email** (brand `it-destek-fake`)
      - from: IT support <it-destek@xidmetagentliyi-az.com>
      - subject: Your mailbox is full
      - time: 07:58
      - body: Your mailbox is 98% full. Confirm your login today so you do not lose emails. / Confirm login → `https://xidmetagentliyi-az.com/poct`
  - ✅ safe `card-payment`: There is no link, and it points you to a number you already have. A normal notice.
    - 🗂 **sms** (brand `ulduzbank`)
      - sender: UlduzBank
      - time: 19:12
      - 💬 UlduzBank: A payment of 23.40 AZN was made with your card. If it was not you, call the number on the back of your card.

#### recap · `recap`
- ✔ Check the address: even one different letter means a fake.
- ✔ Rush and threats are your signal to stop.
- ✔ Check links before you tap, and report when in doubt.

### Links and attachments (`links-attachments`, 3 dəq)

#### tutor · `read-the-link`
- 🗣 "A link's text says one thing, its address another. Let us learn to read the address." — _talk/wave, visual: browser_
- 🗣 "The padlock only means the connection is encrypted. Fake sites have padlocks too." — _think/lean-in, visual: lock_
- 🗣 "The site name ends at the first single slash. The last part, with its ending, is the owner." — _think/point-left, visual: artifact_, highlight `real-domain`
  - 🗂 **url** (brand `xidmet-agentliyi-fake`)
    - url: https://**xidmetagentliyi.az.**⟨decoy⟩**hesab-yoxla.info**⟨real-domain⟩/giris
- 🗣 "The familiar name in front is just decoration. Anyone can put it in front of their own site." — _alert/point-down, visual: artifact_, highlight `decoy`
  - 🗂 **url** (brand `xidmet-agentliyi-fake`)
    - url: https://**xidmetagentliyi.az.**⟨decoy⟩**hesab-yoxla.info**⟨real-domain⟩/giris

#### choice · `whose-link`
- ❓ Who really owns this link?
  - ❌ UlduzBank — The bank name is in front, but the owner is the name at the end.
  - ✅ az-giris.info — Right. The end of the site name shows the real owner.
  - ❌ kart — That is not the site name, it is the page path after the slash.
- 💡 Here ulduzbank.az is just decoration. The site belongs to az-giris.info.

#### simulation · `link-to-login` · After the click
- 🖥 mühit: `browser` — You opened a link from an email. Read the address in the browser and decide what to do.
  - **step `fake-login`** — 🗣 "Look at the end of the address: who is the real owner?"
    - 🗂 **login** (brand `xidmet-agentliyi-fake`)
      - brand: Xidmət Agentliyi
      - url: https://xidmetagentliyi.az. (əslində: `hesab-yoxla.info`)**hesab-yoxla.info**⟨real-domain⟩/giris
      - fields: Email, Password
      - button: Sign in
    - 💀 [enter-credentials] Sign in — The page belongs to hesab-yoxla.info, not the agency. Change your password now and report it.
    - ✅ [cancel] Close tab — Right. The familiar name in front is decoration; the real domain was hesab-yoxla.info.
    - ✅ [report] Report site — Great. Reporting helps get the fake site blocked for everyone else too.
  - **step `download`** · Invoice downloading — 🗣 "The browser downloaded a file. Check how its name ends."
    - 🗂 **file** (brand `ofistechizat-fake`)
      - name: Faktura_0925.pdf.exe
      - type: exe
      - size: 2,1 MB
      - source: ofis-techizat.com
    - 💀 [open-attachment] Open — The real file type is .exe, a program. An invoice is never a program.
    - ✅ [delete] Delete — Right. Delete a program posing as a document and report the email.
    - ✅ [scan] Scan with antivirus — Good habit. But a file named .pdf.exe can be deleted without scanning.
  - **step `real-portal`** · You opened the portal from your bookmark — 🗣 "This time you opened the address yourself. What now?"
    - 🗂 **login** (brand `xidmet-agentliyi`)
      - brand: Xidmət Agentliyi
      - url: https://portal.xidmetagentliyi.az/giris (əslində: `xidmetagentliyi.az`)
      - fields: Email, Password
      - button: Sign in
    - ✅ [enter-credentials] Sign in — Right. This is the agency's official domain, and you opened the page yourself.
    - ⚠️ [report] Report site — This is the agency's official portal. A site you open yourself from a bookmark can be trusted.

#### hotspot · `invoice-trap`
- 🔍 Find the danger signs in this email. (ən azı 3)
  - 🗂 **email** (brand `ofistechizat-fake`)
    - from: OfisTəchizat MMC (əslində: `hesab@ofis-techizat.com`) <hesab@**ofis-techizat.com**⟨sender-domain⟩>
    - to: s.huseynova@xidmetagentliyi.az
    - subject: Invoice No. 0925: payment overdue
    - time: 14:32
    - body: Hello, / The overdue invoice is attached. **Open it and enable macros, or the text will not show.**⟨enable-content⟩ / If the file does not open, download it here: **https://qisa.example/f8Rt**⟨short-link⟩
    - attachments: {"name": [{"text": "Faktura_0925.pdf.zip", "spot": "double-ext", "reveal": "File type: ZIP archive (.zip)"}], "size": "312 KB"}
  - ⟨sender-domain⟩ **Look-alike domain**: It resembles a known supplier, but the domain is different. Check the real address in your own records.
  - ⟨enable-content⟩ **Enable macros**: Macros can run hidden commands. Office blocks them in files from the internet, and a real invoice never asks you to get around that.
  - ⟨short-link⟩ **Short link**: You cannot see where it goes. Pushing you to download through a link is a classic trick.
  - ⟨double-ext⟩ **Double extension**: The name starts like a PDF, but it is really a zip archive. A program can hide inside.

#### swipe · `link-check`
- 👉 Is this link safe or a threat?
  - ✅ safe `home`: The site name is exactly the agency's address.
    - 🗂 **url** (brand `xidmet-agentliyi`)
      - url: https://xidmetagentliyi.az/elanlar
  - ✅ safe `portal`: The portal part in front is the agency's own section. The end is still xidmetagentliyi.az.
    - 🗂 **url** (brand `xidmet-agentliyi`)
      - url: https://portal.xidmetagentliyi.az/mezuniyyet
  - 🛑 threat `decoy`: It ends in az-portal.info. The agency's name is just written in front.
    - 🗂 **url** (brand `xidmet-agentliyi-fake`)
      - url: https://xidmetagentliyi.az-portal.info/giris
  - 🛑 threat `swap`: A q replaces the g. It is a completely different site.
    - 🗂 **url** (brand `xidmet-agentliyi-fake`)
      - url: https://xidmetaqentliyi.az/maas
  - 🛑 threat `short`: A shortened link hides where it leads. If it came unexpectedly, do not open it.
    - 🗂 **url**
      - url: https://qisa.example/a8Zq
  - ✅ safe `bank`: This is the bank's own address, ending in ulduzbank.az. Typing the bank's address yourself is still best.
    - 🗂 **url** (brand `ulduzbank`)
      - url: https://ulduzbank.az/kartlar

#### recap · `recap`
- ✔ A site's real owner is at the end of its name.
- ✔ Check short links and unexpected files first.
- ✔ If a file asks you to enable macros, close it and report.

### The fake director (`ceo-fraud`, 3 dəq)

#### tutor · `money-trap`
- 🗣 "Sometimes the trap has no link and no file. Just an urgent money request in your manager's name." — _talk/shrug, visual: ceo_
- 🗣 "The name is familiar, but the address is not the agency's. Anyone can type any sender name." — _think/point-left, visual: artifact_, highlight `free-mail`
  - 🗂 **email** (brand `poctam`)
    - from: Rauf Karimov <rauf.kerimov.ofis@**poctam.az**⟨free-mail⟩>
    - to: s.huseynova@xidmetagentliyi.az
    - subject: Urgent and confidential
    - time: 15:05
    - body: Hello Sabina, / **We need to transfer 18,400 AZN to a partner today before 16:00.**⟨urgency⟩ / **Do not tell anyone yet, the talks are confidential.**⟨secrecy⟩ / **I am in a meeting, do not call, just write.**⟨no-call⟩ / The bank details are attached.
    - attachments: {"name": [{"text": "Rekvizitler.pdf"}], "size": "64 KB"}
- 🗣 "The demand for secrecy and the ban on calls are there to stop you from checking." — _alert/point-down, visual: artifact_, highlight `secrecy`
  - 🗂 **email** (brand `poctam`)
    - from: Rauf Karimov <rauf.kerimov.ofis@**poctam.az**⟨free-mail⟩>
    - to: s.huseynova@xidmetagentliyi.az
    - subject: Urgent and confidential
    - time: 15:05
    - body: Hello Sabina, / **We need to transfer 18,400 AZN to a partner today before 16:00.**⟨urgency⟩ / **Do not tell anyone yet, the talks are confidential.**⟨secrecy⟩ / **I am in a meeting, do not call, just write.**⟨no-call⟩ / The bank details are attached.
    - attachments: {"name": [{"text": "Rekvizitler.pdf"}], "size": "64 KB"}
- 🗣 "Always check money or bank detail requests another way. Call a number you already know yourself." — _talk/recite, visual: handshake_

#### hotspot · `new-bank-details`
- 🔍 Find the signs: the real supplier writes from ofistechizat.az. (ən azı 3)
  - 🗂 **email** (brand `ofistechizat-fake`)
    - from: Gunel Aliyeva, OfisTəchizat LLC (əslində: `kamran@ofis-techizat.az`) <kamran@**ofis-techizat.az**⟨look-alike⟩>
    - to: muhasibat@xidmetagentliyi.az
    - subject: Our bank details have changed
    - time: 11:18
    - body: Dear colleagues, / Because we have changed banks, **please send payments to the new account from this month.**⟨new-account⟩ / IBAN: AZ21ULDZ00000000137010001944 / **Do not pay the old account, the money will bounce.**⟨old-account⟩ / **Pay the September invoice this week to avoid a penalty.**⟨pressure⟩
  - ⟨look-alike⟩ **Look-alike address**: The real address is ofistechizat.az. A hyphen has been added here.
  - ⟨new-account⟩ **New account**: Changed bank details are the classic form of this fraud. Always check on the number in the contract.
  - ⟨old-account⟩ **Old account ban**: Banning the old account pushes you to the new one without checking.
  - ⟨pressure⟩ **Penalty pressure**: Fear of a penalty makes you rush. Pressure is exactly the reason to check.

#### intro · `your-turn` · Your turn
- Friday, 15:05. You are alone in accounting, and payments must go out by 16:00.

#### simulation · `vendor-callback` · A supplier calls
- 🖥 mühit: `call` — Right after the bank details email, your phone rings. Listen to the caller and decide.
  - **step `ring`**
    - 🗂 **call** (brand `ofistechizat-fake`)
      - caller: OfisTəchizat MMC
      - number: +994 50 000 61 27
      - label: Mobile
      - voice: woman
    - ✅ [answer] Answer — Answering is not dangerous. What matters is what you agree to.
    - ✅ [decline] Decline — That works too. Before paying, call the supplier yourself on the number in the contract. → `after`
  - **step `pitch`** — 🗣 "Hello, Gunel Aliyeva from OfisTəchizat. Did you get our email? Please pay the September invoice to the new account today."
    - 🗂 **call** (brand `ofistechizat-fake`)
      - caller: OfisTəchizat MMC
      - number: +994 50 000 61 27
      - label: Mobile
      - voice: woman
    - ⚠️ [share] Fine, I will pay today — The call repeats the email's story; it proves nothing. Confirm bank changes on the contract number.
    - ✅ [verify] I will check on the contract number — Right: the email and the call can come from the same scammer. Check through another channel.
  - **step `pressure`** — 🗣 "There is no time, our director is upset. If you want to check, just call me back on this number."
    - 🗂 **call** (brand `ofistechizat-fake`)
      - caller: OfisTəchizat MMC
      - number: +994 50 000 61 27
      - label: Mobile
      - voice: woman
    - ✅ [hang-up] Hang up — Right. When the pressure grows, end the call politely and check for yourself.
    - ⚠️ [reply] I will call this number to confirm — A number the caller gives you is her own phone. Trust only the number in the contract.
  - **step `after`** · The call has ended. What do you do now?
    - 🗂 **call** (brand `ofistechizat-fake`)
      - caller: OfisTəchizat MMC
      - number: +994 50 000 61 27
      - label: Mobile
      - voice: woman
    - ✅ [call-back] Call the number in the contract — Right. Dial the official number yourself, ideally from another phone.
    - ⚠️ [ignore] Do nothing, just do not pay — The money is safe, but the supplier and colleagues stay unaware. The scammer will try someone else.
  - **step `real-supplier`** · Calling the contract number — 🗣 "OfisTəchizat, Gunel Aliyeva speaking. No, we have not changed our bank details or called you."
    - 🗂 **call** (brand `ofistechizat`)
      - caller: OfisTəchizat MMC
      - number: +994 12 000 31 00
      - label: Number from the contract
      - voice: woman-2
    - ✅ [report] Tell accounting and security — Great. Report the email without deleting it: the team blocks the fake domain and warns colleagues.
    - ⚠️ [ignore] I did not pay, that is enough — The money is safe, but the same email may reach colleagues. Reporting protects them.

#### swipe · `money-requests`
- 👉 Is this request safe or a threat?
  - 🛑 threat `gift-cards`: A new number plus gift cards is a classic scam. Call your manager's old number to check.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Rauf Karimov (new number)
      - 💬 them: Hi, this is my new number.
      - 💬 them: Urgently buy five 200 manat gift cards and send me the codes. I will pay you back.
  - ✅ safe `report-request`: The right address and a normal work request. No money and no secrecy.
    - 🗂 **email** (brand `xidmet-agentliyi`)
      - from: Rauf Karimov <r.kerimov@xidmetagentliyi.az>
      - subject: Tomorrow's meeting
      - time: 09:40
      - body: Sabina, please bring the quarterly report to tomorrow's meeting. Thanks.
  - 🛑 threat `broken-phone`: An unknown number, a broken phone excuse and urgent money. Call the director's number that you know.
    - 🗂 **sms**
      - sender: +994 55 000 71 48
      - time: 14:15
      - 💬 Hi, it is Rauf Karimov, my phone is broken. Urgently transfer 3,000 AZN to a partner, I emailed the details.
  - ✅ safe `usual-invoice`: A known address, an expected invoice and no change of bank details. A normal email.
    - 🗂 **email** (brand `ofistechizat`)
      - from: OfisTəchizat MMC <muhasibat@ofistechizat.az>
      - subject: September invoice
      - time: 10:30
      - body: Hello. The September invoice is attached. Payment goes to the account in the contract, as usual.
      - attachments: {"name": [{"text": "Faktura_sentyabr.pdf"}], "size": "120 KB"}
  - 🛑 threat `hacked-mailbox`: The address is real, but the mailbox may be hacked. Urgent money plus a ban on calls is reason enough to check.
    - 🗂 **email** (brand `xidmet-agentliyi`)
      - from: Rauf Karimov <r.kerimov@xidmetagentliyi.az>
      - subject: Urgent payment
      - time: 16:48
      - body: Transfer 9,750 AZN to a new partner today, details below. / Do not call, I am in a meeting.
  - ✅ safe `approval-flow`: A normal process: payments are approved in the official system by the rules. Nothing is rushed.
    - 🗂 **chat**
      - app: telegram
      - contact: Elvin Mammadov
      - 💬 them: Sabina, I sent tomorrow's payment documents for approval in the system. Have a look when you can.

#### order · `money-steps`
- 🔢 Put the steps for a suspicious money request in order.
  1. Do not pay, pause
  2. Check on a number you know
  3. If it is fake, press Report phishing
- 💡 Pause, check, then report. No Report phishing button? Forward it to IT security. If you already paid, call your bank and IT security at once.

#### recap · `recap`
- ✔ Check money and bank detail requests another way.
- ✔ Urgency plus secrecy is the signature of fraud.
- ✔ Do not delete, press Report phishing.


## Passwords and sign-in safety (`passwords-mfa`) · Accounts · Easy · 300 XP

### Passphrases (`passphrases`, 3 dəq)

#### tutor · `long-beats-complex`
- 🗣 "This looks complex, but a name, a year and an exclamation mark are the first pattern attackers try." — _think/shrug, visual: stat Aynur1985! (Looks complex, easy to crack)_
- 🗣 "Better: a passphrase of four or more random words. Long, easy to remember and very hard to guess." — _happy/nod, visual: stat violet brick ocean clock (Just an example, make your own)_
- 🗣 "Length beats complexity. Aim for at least fifteen characters; spaces or hyphens between words are fine." — _talk/recite, visual: stat 15+ (characters, recommended minimum)_
- 🗣 "When one site leaks, attackers try that password on other sites. So every account needs its own." — _alert/lean-in, visual: alarm_

#### password · `make-passphrase`
- 🔑 Create a passphrase of your own. (hədəf güc: 4/4)
  - Do not type your real password here, this is practice.
  - Pick four or more random words.
  - Avoid song lyrics, poems and proverbs.
  - Leave out names, dates and your workplace.

#### hotspot · `leak-alert`
- 🔍 Find the signs of a fake in this leak alert. (ən azı 3)
  - 🗂 **email** (brand `xidmet-agentliyi-fake`)
    - from: Security Center (əslində: `security@xidmetagentliyi-az.com`) <security@**xidmetagentliyi-az.com**⟨sender-domain⟩>
    - to: a.hasanova@xidmetagentliyi.az
    - subject: Your password was found in a leak
    - time: 08:47
    - body: **Dear user,**⟨greeting⟩ / Your password was found in a leaked database online. / To protect your account, **enter your old and new password in this form.**⟨old-password⟩ / **Open the form**⟨link⟩ → `https://parol-yenile.info/forma` / **If you do not act within one hour, the account will be deleted.**⟨urgency⟩
  - ⟨sender-domain⟩ **Fake domain**: The agency's domain is xidmetagentliyi.az, with no -az.com at the end.
  - ⟨greeting⟩ **Generic greeting**: Your own security team would write to you by name.
  - ⟨old-password⟩ **Asks for old password**: A real service does not ask you to type your old password into a form from an email. Change it yourself on the site you know.
  - ⟨link⟩ **Foreign link**: The link goes to another domain, not the agency's site.
  - ⟨urgency⟩ **One-hour threat**: A short deadline and a threat push you to act without thinking.

#### simulation · `reset-page` · Reset your password
- 🖥 mühit: `browser` — After a leak warning, a password reset page opens in the browser. Read the address and decide.
  - **step `leak-page`** · Your password was found in a leak — 🗣 "The page scares you and rushes you. Whose address is it?"
    - 🗂 **url** (brand `xidmet-agentliyi-fake`)
      - url: https:// (əslində: `hesab-yoxla.info`)**hesab-yoxla.info**⟨real-domain⟩/sizma
    - ⚠️ [click-link] Reset password here — After a leak warning, do not follow the link. Change the password on a site you open yourself.
    - ✅ [cancel] Close tab, I will open the portal myself — Right: hesab-yoxla.info is not the agency's site. Open the portal yourself from a bookmark. → `real-reset`
  - **step `fake-reset`** — 🗣 "The form wants your old password too. Check the address."
    - 🗂 **login** (brand `xidmet-agentliyi-fake`)
      - brand: Xidmət Agentliyi
      - url: https:// (əslində: `parol-yenile.info`)**parol-yenile.info**⟨real-domain⟩/agentlik
      - fields: Email, Old password, New password
      - button: Reset password
    - 💀 [enter-credentials] Reset password — A fake form that asks for the old password steals it. Change it on the official portal now and report it.
    - ✅ [cancel] Close tab — Right. parol-yenile.info is not the agency's domain, so type nothing here.
    - ✅ [report] Report site — Great. Reporting the fake site helps get it blocked for others too.
  - **step `real-reset`** · You opened the portal yourself — 🗣 "This is the agency's own portal. What do you do now?"
    - 🗂 **login** (brand `xidmet-agentliyi`)
      - brand: Xidmət Agentliyi
      - url: https://portal.xidmetagentliyi.az/profil/parol (əslində: `xidmetagentliyi.az`)
      - fields: Old password, New passphrase
      - button: Change
    - ✅ [enter-credentials] Change password — Right, you changed it on the official portal. Make the new one a long phrase used nowhere else.
    - ⚠️ [later] I will change it later — If the password leaked, someone may already be trying it. Change it on the official portal now.

#### choice · `true-rules`
- ❓ Which rules are true?
  - ✅ Length matters more than complexity — Right. A long password is far harder to crack.
  - ✅ A separate password for every account — Right. Then one leak puts only one account at risk.
  - ❌ Change your password every month — Changing without a reason often leads to weak, similar passwords. Change it at once if you suspect a leak.
  - ❌ A birth year helps you remember — A birth year is easy to find, and attackers try it first.
- 💡 Current advice: long, unique passwords, changed at once after a leak. If your organisation's rules differ, follow them.

#### recap · `recap`
- ✔ A long passphrase beats a short complex password.
- ✔ A separate password for every account.
- ✔ After a leak, change the password at once.

### Password manager (`password-manager`, 3 dəq)

#### tutor · `one-vault`
- 🗣 "Every account needs its own long password. Nobody can remember them all, which is why password managers exist." — _talk/wave, visual: lock_
- 🗣 "The manager creates and stores long random passwords for you. You only need to know one main passphrase." — _happy/nod, visual: key_
- 🗣 "Make the main passphrase long, and turn on two-step verification for the manager itself." — _talk/recite, visual: mfa-phone_
- 🗣 "Never tell anyone your password. Real IT support never asks for it." — _alert/point-left, visual: artifact_, highlight `ask-password`
  - 🗂 **chat** (brand `it-destek-fake`)
    - app: telegram
    - contact: IT Support
    - 💬 them: **Hi! Please type your password so we can check.**⟨ask-password⟩

#### choice · `main-password`
- ❓ What is the best main password?
  - ✅ A long word phrase used nowhere else — Right. It is the key to the whole vault, so it must be unique.
  - ❌ My work email password, so I remember it — If that one leaks, everything opens at once.
  - ❌ One written on a note stuck to the monitor — Anyone walking past can read it.
- 💡 The main password is the only one you remember. Make it long and unique.

#### simulation · `helpdesk-call` · A call from support
- 🖥 mühit: `call` — In the middle of the workday, someone calls as IT support. Listen and choose your answer.
  - **step `ring`**
    - 🗂 **call** (brand `it-destek-fake`)
      - caller: IT Support
      - number: +994 12 000 47 10
      - label: Work
      - voice: man-3
    - ✅ [answer] Answer — Answering is fine. What matters is what you say.
    - ✅ [decline] Decline — That works too. If unsure, call IT support yourself on the official number. → `after`
  - **step `password`** — 🗣 "Hi, this is Orkhan from IT support. We are moving your account to a new server. Please tell me your password."
    - 🗂 **call** (brand `it-destek-fake`)
      - caller: IT Support
      - number: +994 12 000 47 10
      - label: Work
      - voice: man-3
    - 💀 [share] I tell the password — Real IT support never asks for your password. Change it now and report the call.
    - ✅ [keep-private] I never tell my password — Right. Your password is yours alone, not even for IT support.
  - **step `code`** — 🗣 "Fine, no password then. Just read me the six-digit code that just came to your phone, quickly."
    - 🗂 **call** (brand `it-destek-fake`)
      - caller: IT Support
      - number: +994 12 000 47 10
      - label: Work
      - voice: man-3
    - 💀 [share] I read out the code — The code is the second sign-in step. Reading it out lets the caller into your account.
    - ✅ [hang-up] Hang up — Right. A call that asks for the code is a scam, however convincing it sounds.
  - **step `after`** · The call has ended. What do you do now?
    - 🗂 **call** (brand `it-destek-fake`)
      - caller: IT Support
      - number: +994 12 000 47 10
      - label: Work
      - voice: man-3
    - ✅ [call-back] Call the official support number — Right. Dial the number from the internal directory yourself and report the call.
    - ⚠️ [ignore] Tell no one — The caller will try another colleague. Reporting lets the team warn everyone.
  - **step `real-it`** · Calling the official number — 🗣 "IT support, how can I help? We did not call you, and we never ask for passwords or codes."
    - 🗂 **call** (brand `it-destek`)
      - caller: IT Support
      - number: +994 12 000 10 10
      - label: Official number
      - voice: older-man
    - ✅ [report] Report the call to security — Great. The number and time help the team trace the attack.
    - ⚠️ [ignore] I do nothing more — If you do not report the call, the team cannot warn other colleagues.

#### hotspot · `fake-support-chat`
- 🔍 Find the signs of a scam in this chat. (ən azı 3)
  - 🗂 **chat** (brand `it-destek-fake`)
    - app: telegram
    - contact: **IT Support Agency**⟨fake-contact⟩ (əslində: `Username: @itdestek_xidmet, not in your contacts`)
    - 💬 them: Hello, we are updating the system and moving your account to a new server.
    - 💬 them: **Please type your password here.**⟨ask-password⟩
    - 💬 them: **Then send the code that arrives on your phone.**⟨ask-code⟩
    - 💬 them: **If you do not answer in 10 minutes, the account will be closed.**⟨urgency⟩
  - ⟨fake-contact⟩ **Unknown account**: Anyone can use this name. You already know the official IT contacts, so use only those.
  - ⟨ask-password⟩ **Password request**: Real IT support never asks for your password. They do not need it.
  - ⟨ask-code⟩ **Code request**: The code is your second layer of protection. Giving it away opens the door completely.
  - ⟨urgency⟩ **Time pressure**: A ten minute threat pushes you to act without thinking.

#### order · `setup-manager`
- 🔢 Put the steps to set up a password manager in order.
  1. Install the manager your organisation approved
  2. Create a long main passphrase
  3. Turn on two-step verification for the manager
  4. Replace reused old passwords one by one
- 💡 First a trusted vault, then a strong key and protection, then the old passwords.

#### recap · `recap`
- ✔ A password manager makes a strong, separate password for each account.
- ✔ Keep the main passphrase long and two-step verification on.
- ✔ Never tell anyone your password, not even IT support.

### Two-step verification (`mfa`, 3 dəq)

#### tutor · `second-step`
- 🗣 "Even if your password is stolen, a second step can protect the account. This is called two-step verification." — _talk/wave, visual: mfa-phone_
- 🗣 "The strongest are passkeys and security keys. They do not work on fake sites." — _happy/shield-up, visual: key_
- 🗣 "The code is only for you. Anyone asking for it, even as your bank, is a scammer." — _alert/point-left, visual: artifact_, highlight `code-warning`
  - 🗂 **sms** (brand `ulduzbank`)
    - sender: UlduzBank
    - time: 14:02
    - 💬 Login code: 482 913. **Do not share this code with anyone, not even bank staff.**⟨code-warning⟩
- 🗣 "If approval requests you did not expect keep coming, someone is trying to sign in with your password." — _alert/lean-in, visual: alarm_

#### simulation · `night-push` · Night requests
- 🖥 mühit: `phone` — It is two at night and you are asleep. Your phone keeps asking you to approve a sign-in.
  - **step `push-1`** — 🗣 "You are not signing in anywhere."
    - 🗂 **notification** (brand `tesdiqleyici`)
      - app: Təsdiqləyici
      - title: Approve sign-in?
      - body: Xidmət Agentliyi portal. Windows computer.
      - time: 02:14
    - 💀 [allow] Approve — You are not signing in, so this is someone else. Approving lets the person with your password in.
    - ✅ [deny] Deny — Right. Always deny a request you did not expect.
  - **step `push-5`** — 🗣 "The requests keep coming."
    - 🗂 **notification** (brand `tesdiqleyici`)
      - app: Təsdiqləyici
      - title: Approve sign-in?
      - body: Fifth request. Windows computer.
      - time: 02:16
    - 💀 [allow] Approve so it stops — Push bombing counts on exactly this: that you get tired and approve. Approving opens the account.
    - ✅ [deny] Deny — Right. Repeated requests mean someone knows your password.
    - ✅ [report] This is not me, report — Great. Reporting shows the attack to the security team at once.
  - **step `fake-it-chat`**
    - 🗂 **chat** (brand `it-destek-fake`)
      - app: whatsapp
      - contact: IT Support
      - 💬 them: Hi, a night check is running. Approve the last request so your account is not blocked.
    - 💀 [reply] OK, I will approve — IT support never asks you to approve a request. This is the second half of the attack.
    - ✅ [block] Block and report — Right. An unknown number writing at night is not support, it is the attacker.
  - **step `change-now`** · You opened the portal yourself — 🗣 "Your password is stolen. What now?"
    - 🗂 **login** (brand `xidmet-agentliyi`)
      - brand: Xidmət Agentliyi
      - url: https://portal.xidmetagentliyi.az/profil/parol
      - fields: Old password, New passphrase
      - button: Change
    - ✅ [enter-credentials] Change password now — Right. Then tell the security team so they sign out all open sessions.
    - ⚠️ [later] I will look in the morning — The attacker knows your password and will try again. Change it now.

#### choice · `strongest-factor`
- ❓ Which second step resists phishing best?
  - ❌ SMS code — A fake site can ask for the code, and your SIM can be moved to someone else.
  - ❌ Authenticator app — Better than SMS, but you can still type the code into a fake site.
  - ✅ Passkey or security key — Right. A key only works with the genuine site.
  - ❌ Code sent by email — If your email is taken over, so is the code.
- 💡 Any second step is better than a password alone. Choose a key when you can.

#### hotspot · `code-request`
- 🔍 Find the danger in these messages. (ən azı 3)
  - 🗂 **chat**
    - app: whatsapp
    - contact: **+994 50 000 26 43**⟨unknown-number⟩ (əslində: `Not in your contacts`)
    - 💬 them: Hi Aynur! It is Nigar, this is my new number.
    - 💬 them: **I sent a code to your number by mistake.**⟨mistake⟩
    - 💬 them: **Please send me the six-digit code you just got.**⟨ask-code⟩
    - 💬 them: **Hurry, it expires in two minutes.**⟨urgency⟩
  - ⟨unknown-number⟩ **Unknown number**: A familiar name, but a new number. Call your friend's old number to check.
  - ⟨mistake⟩ **"Sent by mistake"**: A code does not reach your number by mistake. Someone is trying to get into your account.
  - ⟨ask-code⟩ **Code request**: If you give this code, the scammer takes over your account and writes to your friends as you.
  - ⟨urgency⟩ **Rush**: Little time leaves no room to think. Never send a code to anyone.

#### order · `setup-authenticator`
- 🔢 Put the steps to set up an authenticator app in order.
  1. Turn on two-step verification in your account settings
  2. Scan the QR code on screen with the app
  3. Enter the code the app shows
  4. Keep the backup codes somewhere safe
- 💡 Backup codes help you get back in if you lose your phone.

#### recap · `recap`
- ✔ When you can, choose a passkey or an authenticator app.
- ✔ Never tell or send a code to anyone.
- ✔ Deny unexpected requests, change your password, report.


## Social engineering (`social-engineering`) · Social engineering · Medium · 350 XP

### Phone call tricks (`phone-call-tricks`, 3 dəq)

#### tutor · `l1-tutor`
- 🗣 "Hello! I am your security helper. Today you will learn to spot scams that come by phone." — _talk/wave, visual: mask_
- 🗣 "The screen shows the bank's name, but a caller's name and number are easy to fake." — _think/point-left, visual: artifact_, highlight `caller-name`
  - 🗂 **call** (brand `sahilbank`)
    - caller: **SahilBank**⟨caller-name⟩
    - number: **+994 12 000 00 00**⟨caller-number⟩
    - label: Incoming call
- 🗣 "Scammers rush you: your card is blocked, money is leaving. Fear and haste are their main weapons." — _alert/lean-in, visual: alarm_
- 🗣 "Golden rule: hang up and call the official number yourself, from your card or the official website." — _happy/shield-up, visual: phone-lock_

#### simulation · `bank-vishing` · A call from the bank
- 🖥 mühit: `call` — The screen shows your bank's name. Listen to the caller and choose your answer at each step.
  - **step `ring`**
    - 🗂 **call** (brand `sahilbank`)
      - caller: SahilBank
      - number: +994 12 000 00 00
      - label: Bank
      - voice: man
    - ✅ [answer] Answer — Answering is not dangerous. What matters is what you say.
    - ✅ [decline] Decline — That works too. If worried, call the number on the back of your card yourself. → `after`
  - **step `alarm`** — 🗣 "Hello, this is Fuad Mammadov from SahilBank security. Someone is trying to take 1,200 manat from your card right now."
    - 🗂 **call** (brand `sahilbank`)
      - caller: SahilBank
      - number: +994 12 000 00 00
      - label: Bank
      - voice: man
    - ⚠️ [share] I give the last card digits — Your bank already knows you and does not need this. Every detail makes the scammer more convincing.
    - ✅ [keep-private] I share no card details by phone — Right. Never give card details on an incoming call; the name and number can be faked.
  - **step `code`** — 🗣 "You have five minutes to stop it. Read me the code that just came to your phone, and tell no one."
    - 🗂 **call** (brand `sahilbank`)
      - caller: SahilBank
      - number: +994 12 000 00 00
      - label: Bank
      - voice: man
    - 💀 [share] I read out the code — The SMS code approves a payment. Reading it out means you send the money yourself.
    - ✅ [hang-up] Hang up — Right. No bank asks for an SMS code by phone. → `after`
  - **step `safe-account`** — 🗣 "Then move your money to a safe account to protect it. I am sending the details by SMS now."
    - 🗂 **call** (brand `sahilbank`)
      - caller: SahilBank
      - number: +994 12 000 00 00
      - label: Bank
      - voice: man
    - 💀 [share] I move the money to the safe account — There is no safe account: it belongs to the scammer. A bank never asks you to move money.
    - ✅ [hang-up] Hang up — Great decision. Asking you to move money is the scam's final step.
  - **step `after`** · The call has ended. What do you do now?
    - 🗂 **call** (brand `sahilbank`)
      - caller: SahilBank
      - number: +994 12 000 00 00
      - label: Bank
      - voice: man
    - ✅ [call-back] Call the number on the card — Right. Dial the official number yourself, ideally from another phone, so the line cannot stay open.
    - ⚠️ [call-back] Call back the incoming number — The number can be faked. Take the number from your card or the bank's official website.

#### choice · `l1-choice-spoof`
- ❓ The screen shows the bank's official number. Is the call real?
  - ❌ Yes, if the number is right, the call is real — A number can be faked. The number on the screen is not proof.
  - ✅ I cannot tell, so I call back myself — Correct. Dial the official number yourself, ideally from another phone, so the scammer cannot keep the line open.
  - ❌ I ask for their name, that is enough — A scammer can give any name. A name is not a check.
- 💡 A caller's name and number can be fake. The safest way is to hang up and call the official number yourself.

#### swipe · `l1-swipe`
- 👉 Safe or scam?
  - 🛑 threat `police-safe-account`: The police never ask you to move money to a safe account. This is a well known scam.
    - 🗂 **chat**
      - app: generic
      - contact: Call: +994 12 000 11 22
      - 💬 them: This is the police. A loan was opened in your name. Move your money to a safe account now.
  - ✅ safe `bank-call-back`: It asks for nothing and sends you to the official number. Call the number on your card to check.
    - 🗂 **chat** (brand `sahilbank`)
      - app: generic
      - contact: Call: SahilBank
      - 💬 them: We saw a suspicious payment on your card. Do not tell us anything, call the number on the back of your card.
  - 🛑 threat `support-password`: Technical support does not need your password. Never tell it to anyone.
    - 🗂 **chat** (brand `it-destek-fake`)
      - app: generic
      - contact: Call: Technical support
      - 💬 them: Your mailbox has a virus. Tell me your password and I will clean it remotely.
  - ✅ safe `support-planned`: You opened the request yourself and nothing is asked of you. This is a normal work call.
    - 🗂 **chat** (brand `it-destek`)
      - app: generic
      - contact: Call: Technical support
      - 💬 them: I am calling about the request you opened yesterday. We will update your computer tomorrow, you do not need to do anything.
  - 🛑 threat `remote-app`: A remote control app hands them your whole phone. A bank never asks for this.
    - 🗂 **chat** (brand `sahilbank`)
      - app: generic
      - contact: Call: SahilBank
      - 💬 them: To protect your account, install this app so I can see your screen.

#### scenario · `l1-scenario` · A support call
- 🎭 start: `n1`
  - **[n1]** Caller (phone, 🔊man-3): "Hello, this is Elvin from technical support. Your account is being blocked, we need to confirm your password now."
    - I tell my password ⇒ **compromised** — Someone else now has your password. Change it at once and report it to support on the official number.
    - I ask who they are → `n2` — A good start, but do not fully trust the answer.
    - I hang up and call support myself ⇒ **safe** — Excellent. Real technical support never asks for your password.
  - **[n2]** Caller (phone, 🔊man-3): "I am Elvin Hasanov, third floor. Hurry, the account will be deleted in five minutes. At least install this program."
    - I install the program → `n3` — With a remote control program, he can see and control your computer.
    - I say I will call back myself ⇒ **safe** — The right call. Rushing is a warning sign, and calling back is the best check.
  - **[n3]**  (, 🔊-): "An unknown program opens and the cursor moves on its own."
    - I disconnect and call support ⇒ **risky** — The right reaction. Reporting fast limits the damage.
    - I feel embarrassed and tell no one ⇒ **compromised** — Silence gives the attacker time. Reporting is nothing to be ashamed of, it protects everyone.

#### recap · `l1-recap`
- ✔ A caller's name and number can be fake
- ✔ Never tell anyone a code, PIN or password
- ✔ Hang up and call the official number yourself

### Text and chat scams (`sms-messenger-scams`, 3 dəq)

#### tutor · `l2-tutor`
- 🗣 "Now messages: SMS, WhatsApp and Telegram. Scammers pose as a courier, a prize or someone close." — _talk/wave, visual: social_
- 🗣 "Courier texts with a tiny fee are common. The link opens a fake page that steals card details." — _think/point-left, visual: artifact_, highlight `fake-link`
  - 🗂 **sms** (brand `suretkargo-fake`)
    - sender: SuretKargo
    - time: 09:14
    - 💬 Your parcel is held at the depot, the address is incomplete. **Pay 1.20 AZN within 24 hours: **⟨small-fee⟩**suretkargo-pay.test/odenis**⟨fake-link⟩
- 🗣 "The most dangerous is a code request. With it, they move your account to their phone." — _alert/point-down, visual: artifact_, highlight `code-ask`
  - 🗂 **chat**
    - app: whatsapp
    - contact: Leyla (work)
    - 💬 them: **Hi, I typed your number by mistake. You will get a 6 digit code, can you send it to me?**⟨code-ask⟩
- 🗣 "Protection is simple: never send the code, and turn on two step verification in your messenger." — _happy/shield-up, visual: mfa-phone_

#### simulation · `new-number` · New number
- 🖥 mühit: `phone` — In the evening, a WhatsApp message arrives from an unknown number. The sender says she is your daughter.
  - **step `hello`** — 🗣 "The number is new, the name is familiar."
    - 🗂 **chat**
      - app: whatsapp
      - contact: +44 7700 900456
      - 💬 them: Hi Mum! It's me, Aysel. My phone broke, this is my new number.
    - ⚠️ [reply] Hi, sweetheart! What happened? — Nothing is lost yet, but this is exactly how the scam starts. Check the old number first.
    - ✅ [verify] Call Aysel's old number — Great check. Always confirm a new number using a familiar name through another channel. → `real-aysel`
  - **step `money`**
    - 🗂 **chat**
      - app: whatsapp
      - contact: +44 7700 900456
      - 💬 them: I urgently need 300 manat, send it to this card. I will pay you back tomorrow.
      - 💬 them: I can't call, the microphone is broken.
    - 💀 [share] I send the money — The money went to the scammer's card. The 'cannot call' excuse is there to stop you checking.
    - ✅ [reply] I ask something only she would know — A good check. But the surest way is to call the old number yourself.
    - ✅ [verify] I call her old number — Right. Check a new number asking for money through the old, familiar one. → `real-aysel`
  - **step `code`**
    - 🗂 **chat**
      - app: whatsapp
      - contact: +44 7700 900456
      - 💬 them: Also, a six-digit code is coming to you, send it to me. I am moving WhatsApp to my new phone.
    - 💀 [share] I send the code — This code opens your own account. Whoever gets it takes over your WhatsApp and writes as you.
    - ✅ [keep-private] I give the code to no one — Right. Never give a verification code to anyone, not even family.
    - ✅ [block] Block and report — Great. Block a new number that asks for a code, then call the old number.
  - **step `real-aysel`** — 🗣 "This is Aysel's old, familiar number."
    - 🗂 **chat**
      - app: whatsapp
      - contact: Aysel
      - 💬 them: Mum, my phone is fine, I have not written to anyone! It is a scam.
    - ✅ [share] Warn everyone in the family group — Right. The scammer will send the same story to your relatives.
    - ⚠️ [ignore] Do nothing — The fake number is still active. Block it and warn your family.

#### hotspot · `l2-hotspot-prize`
- 🔍 Find the traps in this message. (ən azı 3)
  - 🗂 **sms**
    - sender: **+994 51 000 77 88**⟨unknown-number⟩ (əslində: `Not in your contacts`)
    - time: 10:42
    - 💬 Congratulations! You have **won a new smartphone**⟨prize⟩. To get your prize, **by 18:00 today**⟨deadline⟩ **pay a 4.99 AZN delivery fee: **⟨fee⟩**bonus-hediyye.test/al**⟨link⟩
  - ⟨unknown-number⟩ **A number you do not know**: Prize draws are not announced from a private number. But even a familiar name can be faked.
  - ⟨prize⟩ **A prize in a draw you never entered**: You cannot win a contest you never entered.
  - ⟨deadline⟩ **Time pressure**: A short deadline is there to make you act without thinking.
  - ⟨fee⟩ **A fee for a prize**: The small fee is an excuse to get your card details.
  - ⟨link⟩ **Unknown link**: This address belongs to no known organisation. Do not tap links like this.

#### swipe · `l2-swipe`
- 👉 Safe or scam?
  - 🛑 threat `courier-link`: The link does not lead to the courier's own site. Check the tracking number on the official site yourself.
    - 🗂 **sms** (brand `suretkargo-fake`)
      - sender: SuretKargo
      - time: 08:03
      - 💬 We could not deliver your parcel. Update your address: suretkargo.delivery-az.test
  - ✅ safe `bank-otp`: A normal code text that arrives when you pay online yourself. No link, and it reminds you not to share.
    - 🗂 **sms** (brand `sahilbank`)
      - sender: SahilBank
      - time: 12:20
      - 💬 Code: 551920. It confirms your online payment. Do not share this code with anyone.
  - 🛑 threat `friend-code`: This is an account takeover. The code would move your account to their phone.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Kanan
      - 💬 them: Hi! A code went to your number by mistake, please send it to me.
  - ✅ safe `meeting-moved`: No link, no code, no request for money. A normal work message.
    - 🗂 **chat**
      - app: telegram
      - contact: Nigar (Finance)
      - 💬 them: Tomorrow's meeting moved to 11, same room.
  - 🛑 threat `child-new-number`: A new number and an urgent request for money. Call your relative on their old number to check.
    - 🗂 **chat**
      - app: whatsapp
      - contact: +44 7700 900789
      - 💬 them: Hi, it is me, my phone broke and this is my new number. Send 250 manat to my card, it is urgent.
  - ✅ safe `egov-status`: It asks for no link click or payment. You open the portal yourself from the address you know.
    - 🗂 **sms** (brand `e-xidmet`)
      - sender: e-Xidmet
      - time: 15:37
      - 💬 Your application has been received. You can see the result in your personal account on the official portal.

#### choice · `l2-choice-code`
- ❓ A friend on WhatsApp asks for the code you received. What do you do?
  - ❌ I send it, they are my friend — Your friend's account may already be stolen. The code would hand them your account too.
  - ✅ I do not send it and call my friend to warn them — Correct. Often the friend's account has been taken over and the scammer writes in their name.
  - ❌ I ignore it and forget about it — Good that you kept the code. But warn your friend, their account may be stolen.
- 💡 This is how takeovers spread: a stolen account asks friends for codes. A code is never sent to anyone.

#### recap · `l2-recap`
- ✔ Do not tap courier or prize links
- ✔ Check a new number asking for money by calling the old one
- ✔ Never send a code, turn on two step verification

### In person tricks (`in-person-pretexting`, 3 dəq)

#### tutor · `l3-tutor`
- 🗣 "A scammer is not always on a screen. Sometimes they stand at the door, holding a box." — _talk/shrug, visual: badge-id_
- 🗣 "Do not hold the door for someone without a pass. Politely send them to reception." — _think/shake, visual: handshake_
- 🗣 "A so-called technician may wear a uniform and rush you. Check the visit with IT support yourself." — _think/lean-in, visual: desk_
- 🗣 "One habit for every case: stop, check, report. Verify the official way and tell security your doubts." — _happy/recite, visual: flag_

#### simulation · `visitor-at-door` · Technician at the door
- 🖥 mühit: `phone` — You are at work in the morning. Messages arrive about a visitor who wants to get into the building.
  - **step `no-badge`** — 🗣 "An unknown technician, and no pass."
    - 🗂 **chat** (brand `it-destek-fake`)
      - app: telegram
      - contact: IT Support (new)
      - 💬 them: Hi, I have come to fix your printer and I am at the entrance. I left my pass at home, can you come down and open the door?
    - ⚠️ [reply] Coming, I will open it — Letting someone in without a pass opens the door to anyone. Send them to reception.
    - ✅ [verify] I call the official IT support number — Right. Check an unexpected technician's visit yourself through the official channel.
  - **step `reception`**
    - 🗂 **chat** (brand `idare`)
      - app: generic
      - contact: Reception
      - 💬 them: A technician called Orkhan is at reception and gives your name. No visit is booked. Shall we let him in?
    - 💀 [reply] Let him in, I called him — You did not call him. Now a stranger walks freely in the building under your name.
    - ✅ [reply] He waits at reception until I check — Right. A visitor registers at reception and is not left alone until checked.
  - **step `boss-pressure`**
    - 🗂 **chat**
      - app: whatsapp
      - contact: Kamran Aliyev (new number)
      - 💬 them: I called the technician. Take him to the server room yourself. I am in a meeting, do not call.
    - 💀 [reply] OK, I will take him — The boss's name and the 'do not call' rule are there to stop you checking. Strangers never enter the server room.
    - ✅ [verify] I call my boss on the known number — Great. Always check a boss writing from a new number on the old, known one.
    - ✅ [block] Block and report — Right. Then tell your boss and the security team.
  - **step `real-it`**
    - 🗂 **chat** (brand `it-destek`)
      - app: generic
      - contact: IT Support
      - 💬 them: We have not sent any technician to you today. Good thing you wrote; security is on its way to reception.
    - ✅ [reply] Thanks, I will tell reception too — Right. You stopped, checked and reported: all three steps.
    - ⚠️ [reply] I will go down and talk to him myself — Do not confront a suspicious person alone. The security team will handle it.

#### hotspot · `l3-hotspot-email`
- 🔍 Find the suspicious parts of this email. (ən azı 3)
  - 🗂 **email** (brand `idare-fake`)
    - from: Facilities team (əslində: `texnik@servis-idare.test`) <**texnik@servis-idare.test**⟨outside-address⟩>
    - subject: **URGENT: **⟨urgent-subject⟩repair in the server room
    - time: 08:47
    - body: Hello, / Today at 15:00 technician Orkhan will check the air conditioning in the server room. / We are running late, so **let him in unescorted**⟨unescorted⟩. / Please **do not forward this email**⟨no-forward⟩.
  - ⟨outside-address⟩ **Outside address**: An internal team writes from the organisation's own mail. This address is from another domain.
  - ⟨urgent-subject⟩ **Urgency**: Urgency in capital letters pushes you to act without checking.
  - ⟨unescorted⟩ **Entry without escort**: A visitor is always escorted, especially in the server room.
  - ⟨no-forward⟩ **Request to keep it hidden**: Asking you to tell no one is meant to stop anyone from checking.

#### choice · `l3-choice-tailgate`
- ❓ A man with his hands full of boxes wants to follow you in without a pass.
  - ❌ I hold the door, his hands are full — Being polite is good, but a stranger gets in without any check.
  - ✅ I politely send him to reception — Correct. Reception will check him and take him to the right person.
  - ❌ I ask who he is and let him in — You cannot check his answer. Let reception or security decide.
- 💡 Following someone in is the simplest physical attack. Everyone uses their own pass, guests go through reception.

#### swipe · `l3-swipe`
- 👉 Safe or trap?
  - 🛑 threat `no-badge-door`: You should not let in someone without a pass. Send them to reception.
    - 🗂 **chat** (brand `it-destek-fake`)
      - app: telegram
      - contact: Technical support (new)
      - 💬 them: Hi, I came to look at your printer. I left my pass at home, can you come down and open the door?
  - ✅ safe `planned-maintenance`: It asks for no link, password or access. It is just a notice.
    - 🗂 **email** (brand `it-destek`)
      - from: Technical support <support@idare.example>
      - subject: Planned work on Saturday
      - time: 11:05
      - body: Mail will be unavailable on Saturday from 10:00 to 12:00. No action is needed from you.
  - 🛑 threat `found-usb`: A found flash drive can carry malware. Do not open it, hand it to your security team.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Samir (colleague)
      - 💬 them: I found a flash drive labelled Salaries 2026 in the hallway. Shall we open it on your computer?
  - ✅ safe `guest-at-reception`: The guest is signed in and waiting. Meet them yourself and escort them.
    - 🗂 **chat** (brand `idare`)
      - app: generic
      - contact: Reception
      - 💬 them: Your guest Mr Tural has signed in at reception and has a visitor pass. He is waiting for you.
  - 🛑 threat `menu-qr`: You do not need a work password to see a menu. A QR code like this is there to steal it.
    - 🗂 **qr** (brand `idare-fake`)
      - caption: Canteen menu: scan and sign in with your work password
      - destination: menyu-idare.test/login

#### recap · `l3-recap`
- ✔ Send anyone without a pass to reception
- ✔ Never plug a found flash drive into a computer
- ✔ Always: stop, check, report


## Mobile and Wi-Fi (`mobile-wifi`) · Devices · Easy · 300 XP

### App permissions (`app-permissions`, 3 dəq)

#### tutor · `a-tutor`
- 🗣 "Your phone holds work mail, messages and banking. When installing an app, check what you allow." — _talk/wave, visual: phone-lock_
- 🗣 "Why would a torch app read your messages? With this permission, it can see your bank codes too." — _alert/point-left, visual: artifact_, highlight `sms`
  - 🗂 **permission** (brand `fener-pro`)
    - app: Torch Pro
    - permissions: Flashlight, **Contacts**⟨contacts⟩ ✗lazımsız, **Text messages**⟨sms⟩ ✗lazımsız, **Precise location**⟨location⟩ ✗lazımsız
- 🗣 "Accessibility is the strongest permission: it reads your screen and taps for you. Trust few apps with it." — _alert/lean-in, visual: eye_
- 🗣 "Simple rule: a permission must fit the app's job. Maps need location, calculators do not." — _happy/recite, visual: shield_

#### simulation · `app-install` · A free editor
- 🖥 mühit: `phone` — You want a photo editor. See what your phone shows you and decide at every step.
  - **step `offer`** — 🗣 "Someone shared a free app file in a group."
    - 🗂 **chat**
      - app: telegram
      - contact: Deals group
      - 💬 them: FotoRedaktor Plus Pro costs money in the store, get it free here: fotoredaktor-pro.test/app.apk → `https://fotoredaktor-pro.test/app.apk`
    - ⚠️ [click-link] Download the file — A paid app offered for free is a familiar bait. Such files often hide malware.
    - ✅ [block] Block and report — Right. Install apps only from your phone's official store. → `store-app`
  - **step `unknown-source`**
    - 🗂 **dialog**
      - tone: system
      - title: Unknown source
      - body: For your security, your phone does not allow installing unknown apps from this source.
      - buttons: Settings, Cancel
    - ⚠️ [allow] Allow in Settings — This protection exists for files like this. Turning it off opens the phone to malicious apps.
    - ✅ [cancel] Cancel — Right. Installing from unknown sources should stay switched off.
  - **step `fake-apk`** — 🗣 "The icon looks familiar. Read the name closely."
    - 🗂 **file** (brand `fotoredaktor-plus-fake`)
      - name: FotoRedaktor_Plus_Pro.apk
      - type: apk
      - size: 18 MB
      - source: Telegram: Deals group
    - 💀 [install] Install — This is a clone of the store app: the name differs by one space. It can read your SMS codes.
    - ✅ [cancel] Cancel — Right. Do not install an .apk from a message; find the app in the official store.
  - **step `store-app`** · Installed from the official store — 🗣 "Even the store app asks for too much."
    - 🗂 **permission** (brand `fotoredaktor-plus`)
      - app: Foto Redaktor Plus
      - permissions: Photos and videos, Contacts ✗lazımsız, SMS messages ✗lazımsız
    - ⚠️ [allow] Allow — A photo editor needs no contacts or SMS. SMS access lets an app read bank codes.
    - ✅ [deny] Don't allow — Right. Give only what the feature needs: here, just photos.
  - **step `fake-antivirus`** — 🗣 "An antivirus wants to control your screen."
    - 🗂 **permission** (brand `qoruyucu-fake`)
      - app: Qoruyucu Antivirus
      - permissions: Accessibility: control the screen ✗lazımsız
    - 💀 [allow] Allow — With this, an app reads the screen and taps for you. Banking trojans ask for exactly this.
    - ✅ [deny] Don't allow — Right. Delete and report an app that wants screen control in the name of antivirus.

#### hotspot · `a-hotspot`
- 🔍 Find the permissions this app does not need. (ən azı 3)
  - 🗂 **permission** (brand `fotoredaktor-plus`)
    - app: Photo Editor Plus
    - permissions: Photos and videos (əslində: `Reads the photos and videos stored on this phone`), Camera (əslində: `Takes photos and records video`), **Contacts**⟨contacts⟩ (əslində: `Reads your contact list: names, numbers, e-mail addresses`) ✗lazımsız, **Send and read text messages**⟨sms⟩ (əslində: `Reads every text message on the phone and sends new ones`) ✗lazımsız, **Accessibility: control the screen**⟨accessibility⟩ (əslində: `Sees everything on the screen and taps for you in other apps`) ✗lazımsız, **Call history**⟨call-log⟩ (əslində: `Reads the list of your calls: who, when and for how long`) ✗lazımsız
  - ⟨contacts⟩ **Contacts**: Editing photos does not need your contacts.
  - ⟨sms⟩ **Text message access**: With text access an app can read your bank and login codes.
  - ⟨accessibility⟩ **Screen control**: This lets an app read the screen and tap for you. It is exactly what harmful apps ask for.
  - ⟨call-log⟩ **Call history**: A photo editor has no need to know who you call.

#### swipe · `a-swipe`
- 👉 Safe or threat?
  - 🛑 threat `bank-apk`: A bank app is in the official store. An install file sent by link may be harmful.
    - 🗂 **sms** (brand `sahilbank-fake`)
      - sender: +994 55 000 11 22
      - time: 13:02
      - 💬 SahilBank has a new app. Download it here: sahilbank-app.test/SahilBank.apk
  - ✅ safe `map-location`: A map needs your location to guide you. Allowing it only while in use is a smart choice.
    - 🗂 **permission** (brand `xerite-app`)
      - app: Maps
      - permissions: Location (only while using the app)
  - 🛑 threat `torch-mic`: A flashlight needs neither contacts nor a microphone.
    - 🗂 **permission** (brand `fener-pro`)
      - app: Torch
      - permissions: Contacts ✗lazımsız, Microphone ✗lazımsız
  - ✅ safe `video-call`: A video call really does need the camera and microphone.
    - 🗂 **permission** (brand `videozeng-app`)
      - app: Video call
      - permissions: Camera, Microphone
  - 🛑 threat `discount-apk`: Allowing unknown sources weakens your phone's protection. Do not trust a message that asks for it.
    - 🗂 **chat**
      - app: telegram
      - contact: Discount channel
      - 💬 them: Install the discount app from this file. Allow unknown sources in settings.

#### choice · `a-choice-store`
- ❓ Where is it safe to install apps from?
  - ✅ Your phone's official app store — Correct. The official store checks apps and greatly lowers the risk.
  - ❌ From a link in a message — A link in a message can lead to a fake app.
  - ❌ A free cracked version from a forum — Cracked versions often carry malware.
  - ✅ Your organisation's approved app catalogue — Correct. A catalogue managed by your organisation is also an official source.
- 💡 An official store is no full guarantee, but it cuts the risk a lot. Also look at the reviews and permissions.

#### recap · `a-recap`
- ✔ Install apps only from the official store
- ✔ A permission must fit the app's job
- ✔ Be extra careful with text and accessibility access

### Public Wi-Fi (`public-wifi`, 3 dəq)

#### tutor · `b-tutor`
- 🗣 "Free Wi-Fi in cafes, airports and hotels is handy, but who set it up?" — _talk/wave, visual: wifi_
- 🗣 "An attacker can copy the cafe's network name exactly or closely. This is called an evil twin." — _alert/point-left, visual: artifact_, highlight `twin`
  - 🗂 **wifi**
    - networks: 
- 🗣 "A fake network may open a login page asking for your work password. Never type it for Wi-Fi." — _alert/point-down, visual: artifact_, highlight `portal-url`
  - 🗂 **login**
    - brand: Free Wi-Fi
    - url: **wifi-giris.test**⟨portal-url⟩
    - fields: Work email, Email password
    - button: Connect

#### simulation · `cafe-twin` · Cafe Wi-Fi
- 🖥 mühit: `phone` — You need to send a work email from a cafe. Which network do you join?
  - **step `networks`** — 🗣 "Two similar names. One is open with a strong signal."
    - 🗂 **wifi**
      - networks: 
    - ⚠️ [connect] Join Kafe_Nargiz_Free — An open, strong network with a similar name can be an evil twin. Ask staff for the exact name first. → `portal`
    - ✅ [verify] Ask staff for the exact name — Right. The cafe staff know the exact network name and password.
    - ✅ [disconnect] Use mobile data instead — Great choice. For important work, mobile data is safer than public Wi-Fi. → `vpn`
  - **step `staff-said`** · Staff: the network is Kafe_Nargiz, password at the till
    - 🗂 **wifi**
      - networks: 
    - ✅ [connect] Join Kafe_Nargiz — Right. But even a name can be copied, so connect the VPN for work. → `vpn`
    - ⚠️ [connect] Join Kafe_Nargiz_Free — Staff did not name this one. A strong signal is a typical evil twin trick.
  - **step `portal`** · A sign-in page opened — 🗣 "The Wi-Fi page wants your work password."
    - 🗂 **login** (brand `kafe-nargiz-fake`)
      - brand: Kafe Nargiz Wi-Fi
      - url: http://**kafe-nargiz-wifi.test**⟨portal⟩/giris
      - fields: Work email, Password
      - button: Get online
    - 💀 [enter-credentials] Get online — Wi-Fi never needs your work password. Change it now from another device and report it.
    - ✅ [disconnect] Close and leave the network — Right: a Wi-Fi page asking for your work password is fake. Forget the network.
  - **step `vpn`**
    - 🗂 **dialog** (brand `agentlik-vpn`)
      - tone: app
      - title: VPN not connected
      - body: Your organisation requires the VPN to open work email.
      - buttons: Connect VPN, Continue without VPN
    - ✅ [connect] Connect VPN — Right. The VPN sends data through an encrypted tunnel, even on a fake network.
    - ⚠️ [ignore] Continue without VPN — Even a quick task is risky. If your organisation requires a VPN, always connect it first.

#### hotspot · `b-hotspot`
- 🔍 You are at the airport. Find the suspicious networks. (ən azı 2)
  - 🗂 **wifi**
    - networks: 
  - ⟨lookalike⟩ **Almost the official name**: A one character difference is a sign of an evil twin. A fake can even copy the exact name, so use a VPN for important work.
  - ⟨bait-name⟩ **Tempting name**: A very tempting name is bait. No one knows who set this network up.
  - ⟨vip⟩ **Made up VIP network**: An extra network that is not on the official sign may be fake.

#### swipe · `b-swipe`
- 👉 Fine to connect, or a risk?
  - 🛑 threat `open-unknown`: An open network set up by who knows whom. Use mobile data for important tasks.
    - 🗂 **wifi**
      - networks: 
  - ✅ safe `own-hotspot`: Your own phone's password protected hotspot. It is safer than a public network.
    - 🗂 **wifi**
      - networks: 
  - 🛑 threat `portal-password`: Wi-Fi never needs your work password. This is a fake page that steals it.
    - 🗂 **login**
      - brand: Free Wi-Fi
      - url: free-wifi-giris.test
      - fields: Work email, Password
      - button: Connect
  - ✅ safe `hotel-room`: Many hotels ask only for a room number and surname, and the address carries the hotel's name. No password or card is asked. Confirm the network with reception and use the VPN for work.
    - 🗂 **login** (brand `qala-otel`)
      - brand: Qala Hotel guest Wi-Fi
      - url: wifi.otel-qala.test
      - fields: Room number, Surname
      - button: Connect
  - 🛑 threat `wifi-card`: Free internet does not need your card details. This is an attempt to steal them.
    - 🗂 **sms**
      - sender: WiFi-Xidmet
      - time: 17:40
      - 💬 Your free internet package is ending. Enter your card details to extend: wifi-paket.test

#### choice · `b-choice-vpn`
- ❓ You need your work email in a cafe, and your organisation requires a VPN.
  - ✅ I switch on the VPN first, then open email — Correct. The VPN carries your work data through an encrypted channel.
  - ❌ It is quick, I go without the VPN — The rule applies to quick tasks too. A fake network waits for exactly these moments.
  - ❌ I forward the files to my personal email — Sending work data to personal email can break the rules and leave the data unprotected.
- 💡 The VPN rule is there for a reason. It protects your work data even on an open network.

#### recap · `b-recap`
- ✔ Get the exact network name from staff
- ✔ Never type your work password for Wi-Fi
- ✔ Mobile data or a VPN for important work

### Lost phone (`lost-phone`, 3 dəq)

#### tutor · `c-tutor`
- 🗣 "A phone can be lost or stolen. Let us protect it in advance and learn what to do." — _talk/wave, visual: phone-lock_
- 🗣 "First: a screen lock. A six-digit or longer PIN, plus fingerprint or face recognition." — _think/shield-up, visual: lock_
- 🗣 "Second: backups. If photos and contacts are in the cloud, losing the phone means losing only the device." — _talk/nod, visual: cloud_
- 🗣 "Phone lost? Act fast: lock it remotely, tell your organisation at once, wipe it if needed." — _alert/lean-in, visual: alarm_

#### simulation · `lost-phone-flow` · Phone lost
- 🖥 mühit: `phone` — In the evening you left your work phone in a taxi. Act step by step from a colleague's phone.
  - **step `locate`** — 🗣 "The find service shows the phone on the map."
    - 🗂 **dialog** (brand `cihaz-tapici`)
      - tone: app
      - title: Work phone
      - body: Last seen: Narimanov district, 5 minutes ago. / The phone is moving.
      - buttons: Lock, Erase data, Wait
    - ✅ [block] Lock and show a message — Right. Locking takes a minute and keeps strangers out of the phone.
    - ⚠️ [delete] Erase now — Erasing is the last step: afterwards the phone cannot be found on the map. Lock it first.
    - ⚠️ [later] Wait until morning — Every hour gives a thief more time. Lock the phone now.
  - **step `tell-it`**
    - 🗂 **chat** (brand `it-destek`)
      - app: generic
      - contact: IT Support
      - 💬 them: Hello! IT support, how can we help?
    - ✅ [reply] My work phone is lost, lock my account — Right. Once support locks your work account, no one can open the mail on the phone.
    - ⚠️ [reply] I will tell them tomorrow at work — Work mail is open on that phone. Telling your organisation at once stops most of the harm.
  - **step `sim-block`** — 🗣 "Now you are in your operator's app."
    - 🗂 **dialog** (brand `kehkesan-mobil`)
      - tone: app
      - title: Block SIM card
      - body: +994 55 000 18 40 / A blocked number receives no SMS codes.
      - buttons: Block, Cancel
    - ✅ [block] Block — Right. With the SIM blocked, a thief cannot get SMS codes to recover your accounts.
    - ⚠️ [cancel] Cancel — If the SIM stays active, SMS codes keep arriving on the stolen phone.
  - **step `found-sms`** — 🗣 "Half an hour later, this text arrives."
    - 🗂 **sms** (brand `cihaz-tapici-fake`)
      - sender: +994 70 000 45 67
      - time: 21:30
      - 💬 Your lost phone has been found. Sign in to see where it is: cihaz-tapildi.test → `https://cihaz-tapildi.test/giris`
    - 💀 [click-link] Open the link — After a theft, texts like this aim to steal the account password, which can unlock the phone.
    - ✅ [block] Block and report — Right. Check the phone's location only in the find service yourself.

#### order · `c-order`
- 🔢 Your phone is gone. Put the steps in order.
  1. Lock the phone with the find my phone service
  2. Tell your organisation's technical support at once
  3. Call your mobile operator to block the SIM card
  4. Change important passwords from another device
  5. If it will not be found, erase it remotely
- 💡 Lock and report first, then protect the SIM and passwords. Erase last, as an erased phone is harder to find. If your organisation's procedure sets another order, follow it.

#### swipe · `c-swipe`
- 👉 Safe or trap?
  - ✅ safe `support-locked`: No link or code is asked, you are invited to the office in person. This is the right procedure.
    - 🗂 **chat** (brand `it-destek`)
      - app: generic
      - contact: Technical support
      - 💬 them: We have logged your lost phone and paused your work account. Come to the office for a new password.
  - 🛑 threat `finder-passcode`: Returning a phone does not need the lock code. Do not give it, arrange the handover through the police.
    - 🗂 **chat**
      - app: whatsapp
      - contact: +44 7700 900654
      - 💬 them: I found your phone. Write me the screen lock code so I can check you are the owner.
  - ✅ safe `update-reminder`: There is no link, it sends you to your phone's own Settings. That is exactly where updates are installed.
    - 🗂 **chat** (brand `it-destek`)
      - app: generic
      - contact: Technical support
      - 💬 them: Reminder: a new system update for phones is out. Install it from Settings.
  - 🛑 threat `cloud-full`: A real warning shows up inside the app itself. Do not pay through a link, open the app yourself.
    - 🗂 **sms** (brand `buludxidmet-fake`)
      - sender: BuludXidmet
      - time: 19:12
      - 💬 Your cloud storage is full and your photos will be deleted today. Pay here: bulud-yaddas.test

#### choice · `c-choice-lock`
- ❓ Which screen locks are strong?
  - ❌ No lock — Anyone who finds an unlocked phone sees everything.
  - ❌ Your birth year — A birth year is easy to find, often it is on social media.
  - ✅ A random PIN of at least six digits — Correct. A long random PIN is hard to guess.
  - ✅ Fingerprint or face, plus a strong PIN — Correct. It is convenient and the backup PIN is strong too.
- 💡 A lock is the first protection when a phone is lost. A fingerprint is handy, but the main PIN must still be strong.

#### recap · `c-recap`
- ✔ A strong screen lock and automatic updates
- ✔ Turn on backup and find my phone in advance
- ✔ Phone gone: lock, report, erase if needed


## QR code phishing (`quishing`) · Email · Medium · 150 XP

### QR traps (`qr-traps`, 3 dəq)

#### tutor · `intro`
- 🗣 "Hi! A QR code is just a hidden link. You cannot tell where it leads by looking at it." — _talk/-, visual: qr_
- 🗣 "Scammers put their own QR stickers on parking meters, menus and posters." — _think/-, visual: artifact_
  - 🗂 **qr**
    - caption: ShaharPark. Scan to pay
    - destination: https://**seherpark-odenis.info**⟨domain⟩/pay
- 🗣 "When your phone reads the code, it shows the address. Before opening, check the domain: does it really belong to that organisation?" — _talk/-, visual: artifact_, highlight `domain`
  - 🗂 **qr**
    - caption: ShaharPark. Scan to pay
    - destination: https://**seherpark-odenis.info**⟨domain⟩/pay
- 🗣 "A QR code in an email can be a trap too. If the page asks for your password or card, stop." — _alert/recite, visual: hook_

#### swipe · `scan-or-not`
- 👉 Which QR codes are safe to open?
  - 🛑 threat `parking-fine`: Fines are not collected through stickers. Check fines only on the official portal or app.
    - 🗂 **qr**
      - caption: Parking meter. You have a fine, scan and pay
      - destination: https://seherpark-cerime.info/pay
  - ✅ safe `cafe-menu`: The domain matches the cafe's name and the page only shows a menu. Nothing is requested.
    - 🗂 **qr**
      - caption: Chinar Tea House. Menu
      - destination: https://cinar-cayxana.az/menyu
  - 🛑 threat `mfa-email`: An email with a QR code to verify your account is a classic trap. Open the portal yourself from a bookmark.
    - 🗂 **qr**
      - caption: Your account verification expires. Scan to renew
      - destination: https://rxagentlik-login.info/verify
  - ✅ safe `certificate-check`: The code leads to the issuing portal's own address and asks for no data.
    - 🗂 **qr**
      - caption: DovletPortal certificate. Check it is genuine
      - destination: https://dovletportal.az/yoxla/7F3K2
  - 🛑 threat `free-wifi`: Free internet never needs your card. An unknown domain plus a card request is a trap.
    - 🗂 **qr**
      - caption: Free Wi-Fi. Scan to connect
      - destination: https://free-wifi-baku.top/login?card=1
  - 🛑 threat `donation`: A shortened link hides the real address. Donate only on the charity's official website.
    - 🗂 **qr**
      - caption: Help children. Scan to donate
      - destination: https://qisalt.info/x7Qa

#### hotspot · `email-qr`
- 🔍 Find the suspicious parts of this email. (ən azı 3)
  - 🗂 **email**
    - from: IT Support <**it-destek@rxagentlik-support.info**⟨sender⟩>
    - to: aynur.mammadova@rxagentlik.az
    - subject: **URGENT: **⟨urgent⟩renew your two-step verification
    - time: 09:12
    - body: Dear colleague, / Our security system is being updated. **If you do not confirm within 24 hours, your account will be blocked.**⟨threat⟩ / **Scan the QR code below with your phone.**⟨qr⟩ / Regards, IT Support
  - ⟨sender⟩ **Foreign domain**: The sender's domain is not ours: it is not rxagentlik.az.
  - ⟨urgent⟩ **Urgency**: The word urgent pushes you to act without thinking.
  - ⟨threat⟩ **Threat**: The blocking threat is there to pressure you. Real support rarely writes like this.
  - ⟨qr⟩ **QR code**: The QR code hides the link from the mail filter and moves you to a less protected phone.

#### choice · `fine-notice`
- ❓ There is a fine notice with a QR code on your windscreen. What do you do?
  - ❌ Scan it and pay right away — A fake page can steal your card details.
  - ✅ Check the fine myself on the official portal — Correct. If the fine is real, it will be there.
  - ❌ Call the number on the notice — The number may belong to the scammers too.
- 💡 Do not trust any contact on the notice. Open the official channel yourself.

#### scenario · `payment-sticker` · Payment sticker
- 🎭 start: `counter`
  - **[counter]**  (, 🔊-): "At the cafe counter there is a QR sticker for quick payment. It is stuck on slightly crooked."
    - Scan it and check the address first → `address` — Good start. Checking the address matters.
    - Scan it and pay right away ⇒ **compromised** — The address was fake. Your card details went to scammers.
    - Ask the cashier if the sticker is theirs → `cashier` — Great idea. Asking is the simplest check.
  - **[address]**  (, 🔊-): "Your phone shows the address: sahilpay-odenis.top. The cafe's name is nowhere."
    - Pay anyway, I am in a hurry ⇒ **compromised** — The rushed payment went to a scammer. The odd address was warning enough.
    - Do not open it and tell the cashier → `cashier` — The right call.
  - **[cashier]** Cashier (in-person, 🔊young-woman): "That is not our sticker! Please pay by card at the terminal."
    - Pay at the terminal ⇒ **safe** — Well done. You protected yourself and the next customers.

#### recap · `recap`
- ✔ A QR code is a hidden link: check the address before opening.
- ✔ Pay fines and bills only through official channels.
- ✔ Never enter a password or card on a page opened by a QR code.


## Deepfake scams (`deepfake-scams`) · AI threats · Medium · 300 XP

### Cloned voices (`voice-clones`, 3 dəq)

#### tutor · `intro`
- 🗣 "Artificial intelligence can copy a person's voice from a short recording, sometimes only a few seconds long." — _talk/wave, visual: deepfake_
- 🗣 "A scammer calls in the voice of your boss or a relative and urgently asks for money, a code or a document." — _think/lean-in, visual: artifact_
  - 🗂 **call**
    - caller: Kamran Babayev
    - number: **+994 70 000 18 42**⟨number⟩
    - label: Mobile
- 🗣 "The number can be faked too. The name and number on your screen are not proof." — _alert/point-left, visual: artifact_, highlight `number`
  - 🗂 **call**
    - caller: Kamran Babayev
    - number: **+994 70 000 18 42**⟨number⟩
    - label: Mobile
- 🗣 "Agree on a secret check word with your family and your team. A fake voice will not know it." — _happy/shield-up, visual: key_

#### scenario · `boss-call` · Call from the boss
- 🎭 start: `call`
  - **[call]** Kamran Babayev's voice (phone, 🔊older-man): "Hi, I am in a meeting and cannot talk long. We must urgently transfer 18,000 manat to a contractor. Tell no one, I will explain later."
    - Do it right away ⇒ **compromised** — The money went to a scammer. Urgency plus secrecy is the strongest warning sign.
    - Ask for the check word → `pressure` — Good idea. Let us see how he answers.
    - Say I will call him back myself → `callback` — Right. Call a number you already know.
  - **[pressure]** Kamran Babayev's voice (phone, 🔊older-man): "What word? I have no time! Don't you recognise me?"
    - Apologise and transfer ⇒ **compromised** — Pressure is the scammer's main tool. A real boss understands a check.
    - Hang up and call back myself → `callback` — Right. No word, no deal.
  - **[callback]** Kamran Babayev (number from your contacts) (phone, 🔊older-man): "No, I never called you."
    - Report it to the security team ⇒ **safe** — Well done. They will warn your colleagues too.
    - Tell no one, no money was lost ⇒ **risky** — The scammer will try someone else. Reporting protects everyone.

#### hotspot · `voice-message`
- 🔍 Find the warning signs in this chat. (ən azı 3)
  - 🗂 **chat**
    - app: whatsapp
    - contact: +994 55 000 40 17
    - 💬 them: Hi, it's me, Elvin. **My phone broke, this is my new number.**⟨new-number⟩
    - 💬 them: **It's me, Elvin. Can you hear me? I am in trouble, I urgently need your help.**⟨voice⟩ 🔊(young-man)
    - 💬 them: **I urgently need 600 manat, today.**⟨urgent⟩ **Please don't tell anyone at home.**⟨secret⟩
    - 💬 them: **Send it to this card, it's my friend's.**⟨card⟩
  - ⟨new-number⟩ **New number**: The new number story stops you from calling the old number to check.
  - ⟨voice⟩ **Voice message**: The voice may sound familiar and still be fake. A short recording is enough to copy it.
  - ⟨urgent⟩ **Urgent money**: An urgent request for money is the core sign of a scam.
  - ⟨secret⟩ **Secrecy**: Asking you to tell no one is meant to stop you checking.
  - ⟨card⟩ **Someone else's card**: The money goes to someone else's card. That hides the trail.

#### simulation · `relative-call` · An evening call
- 🖥 mühit: `call` — An unknown number calls in the evening. The voice sounds very familiar. What do you do?
  - **step `ring`**
    - 🗂 **call**
      - caller: Unknown number
      - number: +994 50 000 73 26
      - label: Mobile
      - voice: child
    - ✅ [answer] Answer — Answering is not dangerous. What matters is what you do next.
    - ✅ [decline] Decline — That is fine too. If you are worried, call your relative yourself on the number you know. → `after`
  - **step `plea`** — 🗣 "Hello, it's me, Narmin! There was an accident and the police are holding me. I need 900 manat now, don't tell the family!"
    - 🗂 **call**
      - caller: Unknown number
      - number: +994 50 000 73 26
      - label: Mobile
      - voice: child
    - ⚠️ [share] Where do I send it? — Agreeing at once is exactly what the scammer needs. Check first.
    - ✅ [verify] What is our code word? — Right. A cloned voice will not know the word you agreed on.
    - ✅ [hang-up] Hang up and call back myself — Correct. Call Narmin on the old number you know. → `after`
  - **step `pressure`** — 🗣 "What word? I'm crying and you ask about a word! The police are waiting, hurry!"
    - 🗂 **call**
      - caller: Unknown number
      - number: +994 50 000 73 26
      - label: Mobile
      - voice: child
    - 💀 [share] Fine, I am sending the money — The money went to a scammer. Tears and rush are there to make you skip the check.
    - ✅ [hang-up] Hang up — Right. No code word, no conversation.
  - **step `after`** · The call has ended. What now?
    - 🗂 **call**
      - caller: Unknown number
      - number: +994 50 000 73 26
      - label: Mobile
      - voice: child
    - ✅ [call-back] Call Narmin's old number — Right: Narmin is at home and nothing happened. Warn the family too.
    - ⚠️ [ignore] Do nothing — The scammer may call again or try another relative. Tell the family.

#### order · `verify-steps`
- 🔢 Put the steps after a suspicious call in order.
  1. Hang up without promising anything
  2. Call the number in your contacts yourself
  3. Ask whether the request is real
  4. Report it to the security team
- 💡 The proof is not on the screen. It is in the second call that you start yourself.

#### match · `tricks`
- 🔗 Match each trick with the right response.
  - Urgent transfer in the boss's voice ⇄ Call back on a known number
  - A relative's new number ⇄ Call the old number to check
  - A familiar face on a video call ⇄ Ask for the check word
  - A request to keep it secret ⇄ Always tell a second person
- 💡 Every trick has a simple check. Make it a habit.

#### choice · `exec-video`
- ❓ On a video call, the director asks you to send a confidential report to a personal email. What do you do?
  - ❌ Send it, I can see him on screen — The image can be fake. A face is not proof.
  - ✅ Get separate confirmation through an official channel — Correct. Confidential files go only through official channels, after confirmation.
  - ❌ Ask him to wave his hand in front of the camera — It may trip up some fakes, but it is not a reliable check.
- 💡 However real it looks, check an unusual request through another channel.

#### recap · `recap`
- ✔ A familiar voice, face or number is not proof.
- ✔ Hang up and call back on a number you know.
- ✔ Agree on a check word with family and team.

### Fake video call (`fake-video-call`, 3 dəq)

#### tutor · `intro`
- 🗣 "A fake face can now appear live in a video call. It talks, smiles and looks real." — _talk/wave, visual: deepfake_
- 🗣 "Blurry edges and lips out of sync sometimes show, but a good fake hides these traces." — _think/shrug, visual: mask_
- 🗣 "Trust the rule, not your eyes: if asked for money, a code or a document, check another way." — _alert/recite, visual: eye_
- 🗣 "End the call and call that person yourself on the number you know." — _happy/shield-up, visual: handshake_

#### simulation · `colleague-video` · Video call from a colleague
- 🖥 mühit: `phone` — Your colleague messages you, then starts a video call. Decide at every step.
  - **step `new-account`**
    - 🗂 **chat**
      - app: generic
      - contact: Aynur Guliyeva (new account)
      - 💬 them: **Hi! My old account was closed, this is my new one.**⟨new⟩
      - 💬 them: **I am video calling you now, I urgently need a document.**⟨urgent⟩
    - ⚠️ [reply] OK, I am waiting — A new account is itself a warning sign. Checking on the old number first is better.
    - ✅ [verify] I will call your old number first — Right. The new account story is meant to stop you from checking. → `real-aynur`
  - **step `video-ring`** — 🗣 "Aynur's face appears on the screen."
    - 🗂 **call**
      - caller: Aynur Guliyeva (new account)
      - number: +994 55 000 62 19
      - label: Video call
      - voice: young-woman
    - ✅ [answer] Answer — Answering does no harm yet. What matters is what she asks for.
    - ✅ [decline] Decline — That works too. Call Aynur yourself on the number you know. → `real-aynur`
  - **step `the-ask`** — 🗣 "After the call, the request arrives."
    - 🗂 **chat**
      - app: generic
      - contact: Aynur Guliyeva (new account)
      - 💬 them: You saw me, it's really me. Send the list of citizen requests here, the boss is waiting.
    - 💀 [share] Send the file — The video was fake and the list went to a scammer. A face is not proof; check another way.
    - ✅ [verify] I will call your usual number first — Right. A real colleague will understand the check.
    - ✅ [report] Report — Good move. Report the account and tell the security team too.
  - **step `real-aynur`**
    - 🗂 **chat**
      - app: generic
      - contact: Aynur Quliyeva
      - 💬 me: Aynur, did you just video call me?
      - 💬 them: No! I am in a meeting. Is someone writing in my name?
    - ✅ [report] Tell the security team — Great. They will warn the other colleagues too.
    - ⚠️ [delete] Delete the chat and forget it — The scammer will try another colleague. Reporting protects everyone.

#### choice · `reliable-checks`
- ❓ Which checks reliably confirm who is on a video call?
  - ✅ Calling the number you know yourself — You start this call, so the scammer does not control it.
  - ✅ The code word you agreed on — A fake picture does not know this word.
  - ❌ The face and voice look familiar — Faces and voices can be faked.
  - ❌ The picture is sharp — A sharp picture proves nothing. Fakes can be sharp too.
  - ❌ The call comes from an account with a familiar name — Accounts can be hijacked or created fake.
- 💡 Reliable proof is not in the picture but in the second contact you start yourself.

#### swipe · `follow-or-check`
- 👉 Is this request normal or dangerous?
  - 🛑 threat `card-code`: Nobody, not even a relative, should ask for your card code. Video is not proof.
    - 🗂 **chat**
      - app: generic
      - contact: Tural (relative)
      - 💬 them: You saw me on video, it's me. Tell me the code your card just got, it's for a ticket.
  - ✅ safe `meeting`: A normal meeting invite: the agency's domain and nothing is asked.
    - 🗂 **email** (brand `idare`)
      - from: Səbinə Əliyeva <s.aliyeva@idare.example>
      - subject: Team meeting tomorrow at 10:00
      - time: 11:05
      - body: The meeting link is in the internal calendar. No agenda attached, just note the time.
  - 🛑 threat `hr-video`: No department asks you to show your card on camera. The domain is not the agency's either.
    - 🗂 **email** (brand `idare-fake`)
      - from: Human resources <hr@idare-hr.example.net>
      - subject: Salary card renewal
      - time: 09:30
      - body: Join a 15 minute video meeting and show your card to the camera.
  - ✅ safe `operator`: No link or code is asked for. A normal operator notice.
    - 🗂 **sms** (brand `kehkesan-mobil`)
      - sender: Kehkesan
      - time: 13:10
      - 💬 Your balance is below 5 manat. Use the mobile app to top up.

#### scenario · `abroad-relative` · Video call from abroad
- 🎭 start: `call`
  - **[call]** Tural on video (video, 🔊man-3): "Hi! Customs stopped me and took my phone. I am calling from a friend's account. Send 1200 manat, I will pay you back."
    - I send the money right away ⇒ **compromised** — The money went to a scammer. Someone else's account plus urgent money is a warning.
    - I ask for our code word → `dodge` — Good move. Let us see what he says.
    - I say I will check with the family first → `check` — Correct. Check through numbers you know.
  - **[dodge]** Tural on video (the picture freezes) (video, 🔊man-3): "The line is bad, I can't hear you... No time, send it fast!"
    - OK, I am sending it ⇒ **compromised** — The bad line excuse dodges your question. No code word, no money.
    - I end the call and phone the family → `check` — The right decision.
  - **[check]**  (, 🔊-): "Tural's wife says he is at work today and has his phone with him."
    - I report it to the police and warn the family ⇒ **safe** — Great. The scammer may try other family members too.
    - I do nothing, no money was lost ⇒ **risky** — The scammer will try again. Warning the family protects everyone.

#### recap · `recap`
- ✔ A face and voice on video are not proof.
- ✔ Asked for money, a code or a document? Call back yourself.
- ✔ Report the fake call to security or the police.

### AI images and news (`ai-fakes`, 3 dəq)

#### tutor · `intro`
- 🗣 "AI can create real-looking pictures, videos and news in seconds." — _talk/wave, visual: social_
- 🗣 "Investment ads with a fake video of a famous person are a very common scam." — _alert/point-left, visual: artifact_, highlight `promise`
  - 🗂 **email** (brand `db-bulvar-xeber-fake`)
    - from: BulvarXəbər <xeber@**bulvar-xeber.example.net**⟨domain⟩>
    - subject: **Sensation: famous presenter reveals the secret on air**⟨sensation⟩
    - time: 08:05
    - body: **The presenter put 250 manat into a new platform and now earns 3000 a month.**⟨promise⟩ / **The banks are hiding this from you!**⟨secret⟩ / **Places are limited, sign up today only: **⟨rush⟩neftinvest.example.net → `https://neftinvest.example.net/qeydiyyat`
- 🗣 "Fingers, lettering and light are sometimes wrong, but you cannot always spot it." — _think/shrug, visual: eye_
- 🗣 "Check the news on the official site, and never trust a promise of big profits." — _happy/recite, visual: browser_

#### hotspot · `fake-ad`
- 🔍 Find the warning signs in this email. (ən azı 3)
  - 🗂 **email** (brand `db-bulvar-xeber-fake`)
    - from: BulvarXəbər <xeber@**bulvar-xeber.example.net**⟨domain⟩>
    - subject: **Sensation: famous presenter reveals the secret on air**⟨sensation⟩
    - time: 08:05
    - body: **The presenter put 250 manat into a new platform and now earns 3000 a month.**⟨promise⟩ / **The banks are hiding this from you!**⟨secret⟩ / **Places are limited, sign up today only: **⟨rush⟩neftinvest.example.net → `https://neftinvest.example.net/qeydiyyat`
  - ⟨domain⟩ **Fake domain**: The news site's real address is different. Read the address to the end.
  - ⟨sensation⟩ **Sensational headline**: Sensation is there to make you click on emotion.
  - ⟨promise⟩ **Promise of big profit**: No legitimate investment promises guaranteed big returns.
  - ⟨secret⟩ **Hidden secret**: The hidden secret story pulls you away from official sources.
  - ⟨rush⟩ **Today only**: Rush leaves no time to think and check.

#### simulation · `invest-browser` · Behind the ad
- 🖥 mühit: `browser` — Say you opened the link in the ad. Make the right call at every step on the site.
  - **step `fake-article`** · Presenter reveals the secret on air: 3000 a month — 🗣 "The video talks just like the presenter."
    - 🗂 **url** (brand `db-bulvar-xeber-fake`)
      - url: https:// (əslində: `bulvar-xeber.example.net`)**bulvar-xeber.example.net**⟨domain⟩/neftinvest
    - ⚠️ [click-link] Watch the video and sign up — The video was made with AI; the presenter never said this. The page leads to a scam platform.
    - ✅ [cancel] Close the tab — Right. A big profit promise and a fake domain are enough. → `real-news`
  - **step `invest-form`**
    - 🗂 **login** (brand `db-neftinvest`)
      - brand: NeftInvest Pro
      - url: https://neftinvest.example.net/qeydiyyat (əslində: `neftinvest.example.net`)
      - fields: Full name, Phone, Card number, CVV
      - button: Invest 250 manat
    - 💀 [enter-credentials] Invest 250 manat — Your card details went to scammers and the money will not return. Call your bank now and block the card.
    - ✅ [cancel] Close the tab — Right. Card details never go to a platform you do not know.
  - **step `real-news`** · Presenter: the ad using my name is fake — 🗣 "This is the news site's real address."
    - 🗂 **url** (brand `db-bulvar-xeber`)
      - url: https://bulvar-xeber.example/xeberler/saxta-reklam (əslində: `bulvar-xeber.example`)
    - ✅ [open] Read the article — Right. Checking a doubtful story on the official source is the most reliable way.
    - ✅ [share] Share with family — Good idea. Sharing the official denial protects others too.

#### swipe · `believe-or-check`
- 👉 Can you trust this, or is it dangerous?
  - ✅ safe `weather`: An ordinary story that asks for nothing.
    - 🗂 **notification** (brand `db-bulvar-xeber`)
      - app: BulvarXəbər
      - title: Rain expected in Baku tomorrow
      - body: Temperatures of 14 to 18 degrees.
      - time: 07:30
  - 🛑 threat `aid-link`: State aid goes through the official portal, not a link in a group chat.
    - 🗂 **chat**
      - app: generic
      - contact: Neighbourhood group
      - 💬 them: Every family gets 500 manat of aid, sign up here: yardim-az.example.net → `https://yardim-az.example.net`
  - 🛑 threat `crypto-star`: Free money in a celebrity's name is a classic scam. The picture and video may be AI-made.
    - 🗂 **notification** (brand `kontakto`)
      - app: Kontakto
      - title: Sponsored
      - body: Famous footballer is giving money away: enter your card details to get the gift.
      - time: 21:00
  - ✅ safe `portal`: No link or payment is asked; it points you to the official portal.
    - 🗂 **notification** (brand `e-xidmet`)
      - app: e-Xidmət
      - title: Your application status changed
      - body: Details are in your personal account on the portal.
      - time: 10:45

#### order · `check-news`
- 🔢 You see shocking news. Put the checks in order.
  1. Pause, do not share right away
  2. Look at the source and the site address
  3. Look for the story on the official site or a trusted source
  4. Share only if confirmed, report it if fake
- 💡 First hold the emotion, then check. Sharing comes last.

#### recap · `recap`
- ✔ Real-looking pictures and videos can be AI-made.
- ✔ Promises of big profit or free money are scams.
- ✔ Check news on an official source before sharing.


## Malware and ransomware (`malware-ransomware`) · Devices · Medium · 300 XP

### Stop the spread (`stop-the-spread`, 3 dəq)

#### tutor · `intro`
- 🗣 "Malware is software that runs on your computer without you knowing. It can steal data, spy on you or damage files." — _talk/wave, visual: shield_
- 🗣 "Ransomware encrypts files and demands money to unlock them. It often spreads across the whole network." — _alert/lean-in, visual: ransomware_
- 🗣 "It usually arrives in an email attachment, a fake update or a found flash drive. Look at this attachment." — _think/point-down, visual: artifact_
  - 🗂 **email** (brand `db-sahil-logistika-fake`)
    - from: Accounts <muhasibat@sahil-logistika.info>
    - subject: September invoice
    - time: 14:05
    - body: Hello, the invoice is attached. Please review it today.
    - attachments: {"name": [{"text": "Qaime_sentyabr"}, {"text": ".pdf.exe", "spot": "ext"}], "size": "412 KB"}
- 🗣 "Its name looks like a document, but it is really a program. It runs the moment you open it." — _alert/point-left, visual: artifact_, highlight `ext`
  - 🗂 **email** (brand `db-sahil-logistika-fake`)
    - from: Accounts <muhasibat@sahil-logistika.info>
    - subject: September invoice
    - time: 14:05
    - body: Hello, the invoice is attached. Please review it today.
    - attachments: {"name": [{"text": "Qaime_sentyabr"}, {"text": ".pdf.exe", "spot": "ext"}], "size": "412 KB"}

#### match · `what-it-does`
- 🔗 Match each type with what it does.
  - Ransomware ⇄ Locks files and demands money
  - Spyware ⇄ Secretly collects your passwords and typing
  - Trojan ⇄ Gets in disguised as a useful program
  - Fake antivirus ⇄ Shows fake threats and asks for money
- 💡 The names differ, but most of them wait for one click from you to get in.

#### swipe · `open-or-not`
- 👉 Which emails are safe to open?
  - 🛑 threat `parcel`: An unexpected parcel plus an archive file is a classic infection route.
    - 🗂 **email** (brand `suretkargo-fake`)
      - from: SürətKargo <info@suretkargo-track.top>
      - subject: Your parcel is on hold
      - time: 10:20
      - body: Open the delivery document and confirm your address.
      - attachments: {"name": [{"text": "Baglama_sened.zip"}]}
  - ✅ safe `minutes`: A known colleague, an expected document, an ordinary file. If in doubt, still ask.
    - 🗂 **email** (brand `rxagentlik`)
      - from: Leyla Həsənova <leyla.hasanova@rxagentlik.az>
      - subject: Minutes from yesterday's meeting
      - time: 10:20
      - body: Hi, here are the minutes we discussed yesterday.
      - attachments: {"name": [{"text": "Iclas_protokolu.pdf"}]}
  - 🛑 threat `macro`: The domain is fake and the file asks for macros. Office blocks macros in files from the internet for a reason: a macro can run a program.
    - 🗂 **email** (brand `db-rxagentlik-fake`)
      - from: HR department <hr@rxagentlik-az.com>
      - subject: New salary table
      - time: 10:20
      - body: To see the table, open the file and allow macros.
      - attachments: {"name": [{"text": "Maas_2026.xlsm"}]}
  - ✅ safe `planned-update`: The domain is correct and nothing needs downloading or opening. This notice is normal.
    - 🗂 **email** (brand `it-destek`)
      - from: IT Support <it@rxagentlik.az>
      - subject: Planned update tonight
      - time: 10:20
      - body: Computers will update automatically. You do not need to do anything.
  - 🛑 threat `hijacked`: The account is familiar, but the attachment is a program and the tone is odd. Call your colleague another way to ask.
    - 🗂 **email** (brand `rxagentlik`)
      - from: Leyla Həsənova <leyla.hasanova@rxagentlik.az>
      - subject: Look now
      - time: 10:20
      - body: Check this file, we'll talk later.
      - attachments: {"name": [{"text": "Sened.pdf.exe"}]}

#### simulation · `locked-files` · Files will not open
- 🖥 mühit: `desktop` — You start your computer in the morning and the files look strange. Decide step by step.
  - **step `strange-file`** · Documents folder — 🗣 "Look at the end of the file name."
    - 🗂 **file**
      - name: Hesabat_sentyabr.docx**.locked**⟨locked⟩
      - type: doc
      - size: 248 KB
      - source: Documents
    - ⚠️ [open] Try to open it again — It will not open because it is encrypted. Meanwhile more files can be locked.
    - ✅ [disconnect] Disconnect from the network — Right. Pulling the cable and turning off Wi-Fi stops the spread.
    - ⚠️ [ignore] Ignore it and keep working — The ransomware keeps running. Shared folders on the network can be locked too.
  - **step `ransom-note`** — 🗣 "Now a ransom message appears on the screen."
    - 🗂 **dialog**
      - tone: warning
      - title: Your files are encrypted
      - body: **All your documents are locked. Pay within 72 hours to get the key.**⟨deadline⟩ / **If you tell the police or technical support, the files will be deleted.**⟨threat⟩
      - buttons: Pay now, Close
    - 💀 [click-link] Pay now — Paying does not guarantee the files come back. The organisation decides about any ransom.
    - ✅ [report] Call the security team — Right. Report at once despite the threat: a fast report limits the damage.
    - ⚠️ [cancel] Close the window — The program keeps running behind the window. Photograph the screen and report it.
  - **step `wait-for-help`**
    - 🗂 **notification** (brand `it-tehlukesizlik`)
      - app: IT Security
      - title: A specialist is on the way
      - body: Do not turn the computer off or delete anything. We will be there in 10 minutes.
      - time: 09:12
    - ✅ [verify] I follow the instructions — Right. If the computer stays on, specialists can examine the traces in memory.
    - ⚠️ [delete] I delete the locked files — Locked files are evidence and are sometimes needed for recovery. Delete nothing.
    - ⚠️ [cancel] I turn the computer off — Turning it off can erase traces in memory. Leave it on unless your procedure says otherwise.

#### order · `first-minutes`
- 🔢 A ransom message appears. Put the steps in order.
  1. Unplug the cable and turn off Wi-Fi, but leave the computer on
  2. Take a photo of the screen with your phone
  3. Call tech support or the security team right away
  4. Wait for instructions: delete nothing, pay nothing
- 💡 First stop the spread, then report fast. Do not switch off unless your organisation's procedure says so: memory can hold evidence.

#### choice · `pay-or-not`
- ❓ The message says: pay within 24 hours and your files will be unlocked. What is the best step?
  - ❌ Pay, the files matter — Paying does not guarantee your files come back and it rewards criminals.
  - ❌ Try to clean it myself without telling anyone — Hiding it makes the damage worse. You are not to blame, just report it.
  - ✅ Do not pay and report it at once — Correct. The organisation decides the rest together with specialists.
- 💡 Decisions about a ransom belong to the organisation, not to you. Your job is to report fast.

#### recap · `recap`
- ✔ Do not open unexpected attachments or enable macros.
- ✔ If in doubt, disconnect from the network but leave it on.
- ✔ Do not pay, do not hide it, report at once.

### The invoice trap (`invoice-trap`, 3 dəq)

#### tutor · `intro`
- 🗣 "Malware most often arrives as a work email: an invoice, a contract or a delivery note." — _talk/wave, visual: inbox_
- 🗣 "The archive is locked and the password sits in the email. That helps the file slip past checks." — _alert/point-left, visual: artifact_, highlight `password`
  - 🗂 **email** (brand `db-sahil-logistika-fake`)
    - from: Sahil Logistika <muhasibat@**sahil-logistika.info**⟨domain⟩>
    - subject: Unpaid invoice 4471
    - time: 09:41
    - body: **Hello, the unpaid invoice is attached. If it is not paid today, a penalty applies.**⟨urgent⟩ / **Archive password: 4471**⟨password⟩
    - attachments: {"name": [{"text": "Qaime_4471.zip"}], "size": "186 KB"}
- 🗣 "If the file then asks you to allow macros, stop. A normal invoice needs no macros." — _think/lean-in, visual: folder_
- 🗣 "Do not open files you did not expect. Check the sender by a known number and report it." — _happy/recite, visual: shield_

#### simulation · `invoice-inbox` · Accounts inbox
- 🖥 mühit: `inbox` — There are four emails in your inbox. Open each one and decide what to do with the files.
  - **step `zip-invoice`** — 🗣 "Why is the password inside the email?"
    - 🗂 **email** (brand `db-sahil-logistika-fake`)
      - from: Sahil Logistika <muhasibat@**sahil-logistika.info**⟨domain⟩>
      - subject: Unpaid invoice 4471
      - time: 09:41
      - body: **Hello, the unpaid invoice is attached. If it is not paid today, a penalty applies.**⟨urgent⟩ / **Archive password: 4471**⟨password⟩
      - attachments: {"name": [{"text": "Qaime_4471.zip"}], "size": "186 KB"}
    - ✅ [report] Report as phishing — Right. The locked archive hides from scanning and the domain is not the partner's.
    - 💀 [open-attachment] Open the archive — The file inside is a program that runs as soon as it opens. Do not open unexpected archives.
    - ⚠️ [reply] Reply: we will pay tomorrow — Your reply goes to the attacker and encourages them. Report the email instead.
  - **step `macro-contract`**
    - 🗂 **email** (brand `db-rxagentlik-fake`)
      - from: Legal department <huquq@**rxagentlik-az.com**⟨domain⟩>
      - subject: Final version of the contract
      - time: 10:15
      - body: The contract has changed. Open the file and allow macros to see the text.
      - attachments: {"name": [{"text": "Muqavile_son.docm"}], "size": "74 KB"}
    - ✅ [report] Report as phishing — Right. The domain is not the agency's and the file asks for macros.
    - ⚠️ [open-attachment] Open the file — The file has not done harm yet, but it will ask for macros next. Do not open unexpected files.
    - 💀 [enable-content] Allow macros — A macro can start a program on your computer. Office blocks macros in internet files for a reason.
  - **step `real-invoice`**
    - 🗂 **email** (brand `db-sahil-logistika`)
      - from: Sahil Logistika <muhasibat@sahil-logistika.example>
      - subject: September invoice is ready
      - time: 11:02
      - body: The September invoice is in the electronic document system. Sign in as usual, there is no file in this email.
    - ✅ [mark-safe] Mark as safe — Right. Known domain, no file or link, and it sends you to the usual system.
    - ⚠️ [report] Report as phishing — Caution is good, but this email is genuine. The domain is the partner's and nothing needs opening.
  - **step `shared-html`**
    - 🗂 **email** (brand `rxagentlik-disk-fake`)
      - from: RXAgentlik Disk <noreply@**rxagentlik-disk.example.net**⟨domain⟩>
      - subject: A file was shared with you
      - time: 12:30
      - body: Aynur Guliyeva shared a reconciliation statement with you. Open the attachment.
      - attachments: {"name": [{"text": "Akt_uzlasma.html"}], "size": "12 KB"}
    - ✅ [report] Report as phishing — Right. Shared documents do not arrive as HTML attachments; such a file opens a fake sign-in page.
    - 💀 [open-attachment] Open the attachment — The HTML file opened a fake sign-in page. Open shared files only inside the system itself.
    - ⚠️ [forward] Forward to a colleague — Forwarding passes the danger to someone else. Report it as phishing.

#### hotspot · `fake-doc`
- 🔍 Find the warning signs in the opened document. (ən azı 2)
  - 🗂 **dialog**
    - tone: app
    - title: Muqavile_son.docm
    - body: **Security risk: macros in this file have been blocked.**⟨red-bar⟩ / **This document was created in an older version. **⟨old-version⟩**Click “Enable Content” to see the text.**⟨lure⟩
    - buttons: Close
  - ⟨red-bar⟩ **Blocked macros**: The program saw the file came from the internet and blocked the macros. Trust this warning.
  - ⟨old-version⟩ **Old version excuse**: This excuse is there to talk you into enabling the macro.
  - ⟨lure⟩ **Button request**: A real document does not ask you to click a button to show its text.

#### choice · `why-password`
- ❓ Why is the archive password written in the email itself?
  - ❌ The sender wants to protect the data — Then the password would come another way. A password in the same email is a trick.
  - ✅ Mail scanning often cannot see inside a locked file — Right. The locked archive slips past the scan and does harm once opened.
  - ❌ It is a normal accounting practice — Partners usually send invoices through the document system. An unexpected locked archive is suspicious.
- 💡 If a locked archive and its password come in one email, do not open it and report it.

#### match · `file-types`
- 🔗 Match each file with its risk.
  - Locked .zip archive ⇄ A file hidden from scanning
  - .docm document ⇄ May contain a macro, which is a program
  - .pdf.exe file ⇄ A program dressed as a document
  - .html attachment ⇄ Can open a fake sign-in page
- 💡 The end of the file name shows its real type. Do not open types you do not know.

#### choice · `already-opened`
- ❓ You allowed macros by mistake. What now?
  - ❌ I close the file and tell no one — Malware can keep running in the background. Hiding it makes the damage worse.
  - ✅ I disconnect and call technical support at once — Right. A fast report stops the spread, and you are not to blame.
  - ❌ I run antivirus myself and keep working — A scan may not find everything. Specialists need to know what happened.
- 💡 Anyone can make a mistake. What matters is reporting it right away.

#### recap · `recap`
- ✔ Do not open archives and attachments you did not expect.
- ✔ Do not allow macros, trust the warning.
- ✔ Opened it by mistake? Disconnect and report at once.

### Fake updates (`fake-updates`, 3 dəq)

#### tutor · `intro`
- 🗣 "Fake updates and free cracked software are favourite routes for malware." — _talk/wave, visual: update_
- 🗣 "The site says your browser is out of date. But a website cannot update your browser." — _alert/point-left, visual: artifact_, highlight `urgent`
  - 🗂 **dialog** (brand `db-xezri-brauzer-fake`)
    - tone: warning
    - title: Your browser is out of date
    - body: **An urgent update is needed to show this page.**⟨urgent⟩ / Download the update file: **Xezri_Update.zip**⟨zip⟩
    - buttons: Update, Close
- 🗣 "Cracked programs and key generators often carry hidden malware inside." — _think/shake, visual: download_
- 🗣 "Get updates from the system itself and programs from your organisation's software centre." — _happy/shield-up, visual: shield_

#### simulation · `update-browser` · Traps in the browser
- 🖥 mühit: `browser` — You are browsing during work. Choose the right step in each window.
  - **step `site-popup`** — 🗣 "This window sits inside the website."
    - 🗂 **dialog** (brand `db-xezri-brauzer-fake`)
      - tone: warning
      - title: Your browser is out of date
      - body: **An urgent update is needed to show this page.**⟨urgent⟩ / Download the update file: **Xezri_Update.zip**⟨zip⟩
      - buttons: Update, Close
    - 💀 [install] Update — A site cannot update your browser; this file is malware. The browser updates itself from its own menu.
    - ✅ [cancel] Close — Right. Close the fake update window and download nothing.
    - ✅ [report] Report the site — Great. Technical support can block this site for everyone.
  - **step `real-update`** — 🗣 "This time the notice comes from the browser itself."
    - 🗂 **dialog** (brand `db-xezri-brauzer`)
      - tone: system
      - title: Xəzri is ready to update
      - body: Restart the browser to finish the update.
      - buttons: Restart, Later
    - ✅ [update] Restart — Right. This is the browser's own update and it closes known holes.
    - ⚠️ [later] Later — A postponed update leaves the hole open. Save your work and update.
  - **step `crack-site`** · SenedPro 2026 full version, free
    - 🗂 **url**
      - url: https://**pulsuz-proqram.example.net**⟨domain⟩/senedpro-crack
    - 💀 [install] Free download — Cracked software often hides malware. Request the program from the software centre.
    - ✅ [cancel] Close the tab — Right. Unlicensed software is both a risk and a breach of the rules. → `software-centre`
  - **step `keygen-file`** — 🗣 "The file is already downloaded. What now?"
    - 🗂 **file**
      - name: SenedPro_keygen.exe
      - type: exe
      - size: 3,4 MB
      - source: Downloads
    - 💀 [open] Open — A key generator is a program that settles in with your permission. Do not open such files.
    - ✅ [delete] Delete — Right. Delete the file and tell technical support you downloaded it.
    - ✅ [report] Tell technical support — Great. They will check that the computer is clean.
  - **step `software-centre`** · Software centre: SenedPro
    - 🗂 **url** (brand `db-proqram-merkezi`)
      - url: https://proqram.rxagentlik.az/senedpro
    - ✅ [install] Send an install request — Right. The software centre gives checked, licensed programs.
    - ⚠️ [click-link] Search another site — Other sites are full of fake versions. The software centre is the safest route.

#### swipe · `safe-source`
- 👉 Is this source safe or dangerous?
  - ✅ safe `system-update`: This is the system's own update notice and asks you to download nothing.
    - 🗂 **notification** (brand `sistem-yenileme`)
      - app: System Update
      - title: Updates installed
      - body: Restart the computer to finish.
      - time: 18:02
  - 🛑 threat `mail-patch`: Updates never arrive as email attachments. This is malware posing as a patch.
    - 🗂 **email** (brand `it-destek-fake`)
      - from: Technical support <destek@idare-support.example.net>
      - subject: Urgent security update
      - time: 14:20
      - body: Install the attached update today.
      - attachments: {"name": [{"text": "Update_patch.exe"}], "size": "2,1 MB"}
  - ✅ safe `centre`: Your organisation's own software centre. Get programs here.
    - 🗂 **url** (brand `db-proqram-merkezi`)
      - url: https://proqram.rxagentlik.az
  - 🛑 threat `usb-crack`: Cracked software on someone else's flash drive. Both are malware risks.
    - 🗂 **file**
      - name: FotoPro_full_crack.exe
      - type: exe
      - size: 48 MB
      - source: USB: a colleague's flash drive
  - 🛑 threat `scare-ad`: A website cannot scan your computer. This is a fake antivirus ad.
    - 🗂 **dialog** (brand `qoruyucu-fake`)
      - tone: warning
      - title: 5 viruses found on your computer
      - body: Download Qoruyucu Pro to clean it now.
      - buttons: Clean now

#### scenario · `colleague-crack` · A colleague's offer
- 🎭 start: `offer`
  - **[offer]** Rashad (your colleague) (in-person, 🔊man-3): "The licence for this program is expensive. I have a cracked copy on a flash drive, it installs in five minutes."
    - Fine, give it to me ⇒ **compromised** — Cracked software can bring malware and put the whole network at risk.
    - No, I will send a request to the software centre → `deadline` — The right way. Let us see what happens.
  - **[deadline]** Rashad (in-person, 🔊man-3): "The request will take a week and the report is due tomorrow. Nobody will know."
    - Then I install it, there is no time ⇒ **compromised** — Hurry does not shrink the risk. Tell your manager the work is waiting on the program.
    - I ask my manager to make the request urgent → `support` — Right. Urgent needs can be met the safe way too.
  - **[support]** Technical support (phone, 🔊woman-2): "We got your request and will install it today. Shall we check Rashad's computer too?"
    - Yes, and I tell him to have it checked ⇒ **safe** — Great. The cracked software may already be on his computer.
    - No, I do not want to get him in trouble ⇒ **risky** — This is protection, not punishment. An infected computer puts everyone at risk.

#### match · `lure-check`
- 🔗 Match each lure with the right step.
  - Site: your browser is out of date ⇄ Check in the browser's own menu
  - Free full version ⇄ Request it from the software centre
  - Ad: virus found ⇄ Close the tab, download nothing
  - Update file in an email ⇄ Do not open it, report it
- 💡 The safe route for updates and programs is always the same: the official source.

#### recap · `recap`
- ✔ A website cannot update your browser.
- ✔ Use the software centre, never cracked software.
- ✔ Downloaded something by mistake? Do not open it, report it.


## Safe browsing (`safe-browsing`) · Devices · Easy · 120 XP

### Web traps (`web-traps`, 3 dəq)

#### tutor · `intro`
- 🗣 "The padlock in the address bar says one thing: the connection is encrypted. It does not say who runs the site." — _talk/-, visual: lock_
- 🗣 "Most scam sites have a padlock too. So read the domain itself." — _think/-, visual: artifact_, highlight `domain`
  - 🗂 **url**
    - url: https://**sahilbank-giris.info**⟨domain⟩/login
- 🗣 "The top search result can be an ad. Scammers buy ads using the names of well known sites." — _talk/-, visual: browser_
- 🗣 "If a website says your browser is outdated and offers an update download, it is a trap. Browsers update themselves." — _alert/-, visual: update_
- 🗣 "If your browser shows a red warning, go back. It stops you to protect you." — _happy/recite, visual: shield_

#### hotspot · `fake-portal`
- 🔍 Find the suspicious parts of this login page. (ən azı 2)
  - 🗂 **login**
    - brand: DövlətPortal
    - url: **https://**⟨padlock⟩**dovletportal-az**⟨lookalike⟩**.online**⟨tld⟩/giris
    - fields: Personal ID code, Password
    - button: Sign in
  - ⟨padlock⟩ **Padlock**: There is a padlock, but that only means encryption. It does not prove the site is real.
  - ⟨lookalike⟩ **Look-alike name**: A dash and az were added to the official name. It is a look-alike fake domain.
  - ⟨tld⟩ **Wrong ending**: The domain ends in .online. The official portal is at dovletportal.az.

#### swipe · `click-or-not`
- 👉 Which links are safe to open?
  - 🛑 threat `free-download`: A program file from a free download site is often malicious. Get software through tech support.
    - 🗂 **url**
      - url: https://free-download-pdf.top/Sened_pulsuz.exe
  - ✅ safe `official`: The domain is the official portal itself: dovletportal.az. No extra words or dashes.
    - 🗂 **url**
      - url: https://dovletportal.az/xidmetler/arayis
  - 🛑 threat `subdomain-trick`: The real domain is the last part: hesab-yoxla.info. The sahilbank.az in front is just bait.
    - 🗂 **url**
      - url: https://sahilbank.az.hesab-yoxla.info/login
  - 🛑 threat `update-exe`: Browser updates are not downloaded from websites. The browser updates itself.
    - 🗂 **url**
      - url: https://brauzer-yenile.top/update.exe
  - ✅ safe `bank-path`: The domain is sahilbank.az. The rest is just the page path.
    - 🗂 **url**
      - url: https://www.sahilbank.az/az/kartlar

#### choice · `padlock-meaning`
- ❓ There is a padlock in the address bar. What does it mean?
  - ❌ The site is checked and safe — No. Fake sites get a padlock easily too.
  - ✅ The connection between you and the site is encrypted — Correct. But the site can still be fake.
  - ❌ The site is approved by the state — The padlock is not any kind of state approval.
- 💡 The padlock is needed but not enough. Always read the domain itself.

#### scenario · `sudden-popup` · Sudden pop-up
- 🎭 start: `popup`
  - **[popup]**  (, 🔊-): "You are reading a news site. Suddenly a red window fills the screen: your computer is infected, call +994 12 000 04 19. An alarm sounds."
    - Call the number → `operator` — This is a fake tech support scam. Let us see what happens.
    - Click the Clean button ⇒ **compromised** — The button downloaded malware. Do not click anything in such a window.
    - Close the tab, or the whole browser if needed → `restore` — Right. That window is just a web page, your computer is not infected.
  - **[operator]** Operator (phone, 🔊man): "We need to connect to your computer remotely. Install this program and read me the code on screen."
    - Install the program ⇒ **compromised** — The scammer now has full access to your computer. Disconnect it and report at once.
    - Hang up and tell tech support ⇒ **risky** — You stopped in time. But never call a number from a window like that.
  - **[restore]**  (, 🔊-): "You reopen the browser. It offers to restore your previous tabs."
    - Do not restore, and send tech support a short note ⇒ **safe** — Well done. The window installed nothing and tech support knows.
    - Restore the tabs ⇒ **risky** — The same fake window may open again. Skip the restore.

#### recap · `recap`
- ✔ The padlock only means encryption: read the domain.
- ✔ Trust bookmarks or addresses you type, not ads.
- ✔ Pop-ups saying update now or you are infected are traps.


## USB drives and chargers (`usb-media`) · Physical security · Easy · 120 XP

### Unknown flash drive (`unknown-usb`, 2 dəq)

#### tutor · `intro`
- 🗣 "A found flash drive makes people curious. That is exactly what attackers count on." — _talk/-, visual: usb_
- 🗣 "Plugging it in can be enough. Some devices pretend to be a keyboard and type commands by themselves." — _alert/-, visual: alarm_
- 🗣 "So never plug in a found drive. Hand it over to the security team." — _happy/-, visual: shield_
- 🗣 "At work, use only drives issued or approved by your tech support team." — _talk/-, visual: lock_
- 🗣 "In public places, charge with your own adapter from a wall socket. If your phone asks to trust a device, decline." — _think/recite, visual: phone-lock_

#### hotspot · `courier-sms`
- 🔍 Find the warning signs in this message. (ən azı 3)
  - 🗂 **sms**
    - sender: **+994 51 000 77 63**⟨number⟩
    - time: 09:48
    - 💬 Hello, I'm Nigar, the director's new assistant.
    - 💬 We left a flash drive on your desk, **it's the director's presentation.**⟨authority⟩
    - 💬 **Please plug it in and open the file now, **⟨action⟩**the meeting starts in 10 minutes.**⟨urgent⟩
    - 💬 **Don't tell anyone, it's a surprise.**⟨secret⟩
  - ⟨number⟩ **Unknown number**: A work task arrives from a personal number you do not know.
  - ⟨authority⟩ **The director's name**: The director is mentioned so you rush and skip checks.
  - ⟨action⟩ **Plug in and open**: Being asked to plug in an unknown drive is the main danger.
  - ⟨urgent⟩ **Time pressure**: Ten minutes leaves you no time to think.
  - ⟨secret⟩ **Secrecy**: Asking for secrecy stops you from checking.

#### scenario · `car-park-drive` · Drive in the car park
- 🎭 start: `found`
  - **[found]**  (, 🔊-): "In the morning you find a flash drive in the car park labelled Salaries 2026, confidential."
    - Plug it into my work computer to see what it is ⇒ **compromised** — The drive launched malware. The confidential label was there to tempt you.
    - Check it on my home computer ⇒ **risky** — Your home device can be infected too, and it may hold your work accounts.
    - Take it to the security team → `colleague` — The right choice.
  - **[colleague]** Tural, a colleague (in-person, 🔊man-2): "Give it to me, I'll look. I have antivirus on my computer."
    - Hand it over, the antivirus will protect him ⇒ **risky** — Antivirus does not catch every attack, especially devices acting as a keyboard.
    - Politely refuse and hand it in → `security` — Well done. The rule is the same for everyone.
  - **[security]** Security team (phone, 🔊woman): "Thank you. We check devices like this separately, on a computer isolated from the network."
    - Tell them where and when I found it ⇒ **safe** — Great. That helps them look for more drives.

#### choice · `airport-charging`
- ❓ Your phone is dying at the airport. Which options are safe?
  - ✅ Plug my own adapter into a wall socket — The simplest and safest way.
  - ✅ Charge from my own power bank — Great, no unknown device involved.
  - ❌ Use a cable a stranger lends me — A stranger's cable can hide a device inside.
  - ❌ Tap Yes when asked to trust the device — That gives the device access to your data. Charging does not need trust.
- 💡 Attacks through public USB ports are rare, but protection is easy: your own adapter and no trust.

#### match · `media-rules`
- 🔗 Match each situation with the right step.
  - A free drive from a conference ⇄ Have tech support check it first
  - You need to take work files home ⇄ Use approved media or the approved cloud
  - A courier brings a drive for the director ⇄ Hand it to the security team
  - You lost your work flash drive ⇄ Report it at once
- 💡 Unknown media never gets plugged in, and work data travels only by approved means.

#### recap · `recap`
- ✔ Never plug in a found or unknown drive, hand it in.
- ✔ Use only approved media at work.
- ✔ Charge with your own adapter and never trust unknown devices.


## Personal data (`personal-data`) · Data · Medium · 150 XP

### Data in your care (`data-in-care`, 3 dəq)

#### tutor · `intro`
- 🗣 "Names, ID documents, addresses and phone numbers of citizens and colleagues are personal data, trusted to you for work." — _talk/-, visual: badge-id_
- 🗣 "In Azerbaijan, personal data is protected by law. Use it only for a lawful purpose and only as much as needed." — _think/-, visual: lock_
- 🗣 "The rule is simple: if your work does not need it, do not look, ask or share." — _talk/-, visual: eye_
- 🗣 "Do not send photos of ID cards through messaging apps. Such photos stay on phones for years and leak." — _alert/recite, visual: phone-lock_

#### swipe · `request-check`
- 👉 Which requests are fine?
  - 🛑 threat `fake-police`: Authorities request data through official channels, not by message from a personal number.
    - 🗂 **chat**
      - app: whatsapp
      - contact: +994 50 000 22 90
      - 💬 them: Hello, I'm from the police. Send me Rashad Aliyev's registered address and phone, it's urgent.
  - ✅ safe `hr-system`: The domain is correct, it points to the internal system and asks for no extra data.
    - 🗂 **email**
      - from: HR department <kadrlar@rxagentlik.az>
      - subject: Leave request
      - time: 11:02
      - body: Please sign your request in the internal document system. No extra documents needed.
  - 🛑 threat `curious-colleague`: Curiosity is not a work need. If the job does not require it, the file is not shared.
    - 🗂 **chat**
      - app: telegram
      - contact: Elvin, colleague
      - 💬 them: My neighbour applied to us. What's in his file? Send me a photo, I'm curious.
  - 🛑 threat `personal-email`: Even for a known colleague, personal data must not go to a personal mailbox. It stays in work systems.
    - 🗂 **email**
      - from: Leyla Həsənova <leyla.hasanova@rxagentlik.az>
      - subject: The list
      - time: 11:02
      - body: Send all the department's ID codes and phones to my personal email, I'll work from home: leyla.h.1990@mail.example
  - ✅ safe `portal-sms`: There is no link and nothing is requested. It only informs you.
    - 🗂 **sms**
      - sender: DovletPortal
      - time: 15:30
      - 💬 Your application has been received. You can see the result in your account on the portal.

#### hotspot · `id-photo-chat`
- 🔍 Find the risks in this chat. (ən azı 3)
  - 🗂 **chat**
    - app: whatsapp
    - contact: Sabina, HR **+994 77 000 19 55**⟨number⟩
    - 💬 them: Hi! Your records are being updated. **Send photos of both sides of your ID here.**⟨id-photo⟩
    - 💬 them: **By 5 pm, or your salary will be delayed.**⟨threat⟩
    - 💬 me: Why is HR writing on WhatsApp?
    - 💬 them: **The system is down, this is faster.**⟨excuse⟩
  - ⟨number⟩ **Personal number**: Someone writes as HR from an unknown personal number.
  - ⟨id-photo⟩ **ID photo**: With an ID photo, a scammer can open loans or accounts in your name.
  - ⟨threat⟩ **Salary threat**: Threatening your salary is meant to rush you past checks.
  - ⟨excuse⟩ **Excuse**: The system is down is an excuse to skip the official route. Call HR yourself.

#### scenario · `citizen-call` · A citizen calls
- 🎭 start: `call`
  - **[call]** Caller (phone, 🔊older-woman): "Hello, my brother's application is with you. He is ill, please give me his phone and address so I can help him."
    - I feel sorry for him and give the details ⇒ **compromised** — You do not know who is calling. The data is now in a stranger's hands.
    - Ask for the brother's ID code to verify the caller ⇒ **risky** — An ID code is not a secret. Knowing it proves nothing.
    - Explain that I cannot share it by phone → `pressure` — Right. Be polite but firm.
  - **[pressure]** Caller (phone, 🔊older-woman): "What kind of person are you? He is ill!"
    - Make an exception under pressure ⇒ **compromised** — Emotional pressure is the most common trick.
    - Explain the official route: the brother himself or a representative with power of attorney can apply → `after` — Great. You showed the way and protected the data.
  - **[after]**  (, 🔊-): "The call is over. What now?"
    - Report the call to my manager and the security team ⇒ **safe** — Well done. The same person may call your colleagues.
    - Nothing, I gave nothing away ⇒ **risky** — You held firm, but reporting helps your colleagues be ready.

#### match · `principles`
- 🔗 Match each principle with its meaning.
  - Purpose ⇄ Use only for a clear, lawful task
  - Minimum ⇄ Collect no more than needed
  - Need to know ⇄ Only people whose work requires it may look
  - Confidentiality ⇄ Never give it to third parties without a legal basis
- 💡 These principles help protect citizens' data in everyday work.

#### choice · `send-way`
- ❓ How may you send a citizen's document to a colleague?
  - ❌ Photograph it and send by personal WhatsApp — The photo stays on phones and out of control.
  - ✅ Through the internal document system, only to the person who needs it — Correct. Access is limited and controlled.
  - ❌ Via personal email, to be quick — Personal email is outside the organisation's protection.
- 💡 Personal data should never leave the organisation's approved systems.

#### recap · `recap`
- ✔ Use personal data only when work requires it, and only as much as needed.
- ✔ Never send ID photos or lists through messengers.
- ✔ Point phone callers to the official request route.


## Sharing data safely (`data-sharing`) · Data · Medium · 300 XP

### Classify and share (`classify-and-share`, 3 dəq)

#### tutor · `intro`
- 🗣 "Every document has a level: public, internal or confidential. The level tells you who may see it." — _talk/wave, visual: folder_
- 🗣 "Public means anyone, like a notice on the website. Internal means staff only." — _talk/nod, visual: eye_
- 🗣 "Confidential is for named people only. If it leaks, people and the organisation are seriously harmed." — _think/lean-in, visual: lock_
- 🗣 "A link open to anyone exposes the file to the whole internet. Share with named people and set an end date." — _alert/point-left, visual: artifact_, highlight `public`
  - 🗂 **url** (brand `rxagentlik-disk`)
    - url: https://disk.rxagentlik.az/s/8Kq2Lm?access=**anyone**⟨public⟩

#### simulation · `share-requests` · Sharing requests
- 🖥 mühit: `phone` — Three requests reached your phone. Decide by the document's level: do you share or not?
  - **step `phone-book`**
    - 🗂 **chat**
      - app: whatsapp
      - contact: Nigar (former colleague)
      - 💬 them: Hi! I need it at my new job: could you send me the internal phone book?
    - ✅ [keep-private] It is internal, I cannot send it — Correct. Internal documents are for staff only, and a former colleague is now an outsider.
    - ⚠️ [share] I send the file — The phone book is internal. Outside, it is a ready list of phishing targets.
  - **step `job-ad`**
    - 🗂 **email** (brand `merkez-konsalting`)
      - from: Elçin Rzayev <e.rzayev@merkez-konsalting.example>
      - subject: Job advert
      - time: 11:02
      - body: Hello, could you send the job advert from your website? We would like to share it with our students.
    - ✅ [share] I send the advert — Correct. A job advert is public and already on the website.
    - ✅ [keep-private] I send nothing — Safe, but a public document needs no hiding. Sending the website link is enough.
  - **step `applications`**
    - 🗂 **sms**
      - sender: +994 55 000 63 21
      - time: 12:30
      - 💬 Hello, I am a journalist. If you send the list of citizen applications, we will never mention your name.
    - ✅ [keep-private] I refuse and refer them to the press office — Correct. Applications are confidential and only the press office talks to the media.
    - 💀 [share] I send the list — A confidential list has left the organisation. This is a leak of citizens' personal data.
    - ✅ [report] Report — Good. Report a request like this to the security team and your manager too.

#### match · `classify`
- 🔗 Match each document with its level.
  - A job ad published on the website ⇄ Public
  - The internal phone directory ⇄ Internal
  - The list of citizen applications ⇄ Confidential
- 💡 When in doubt, pick the higher level and ask the document's owner.

#### hotspot · `misdelivered`
- 🔍 This email reached you by mistake. Find the sharing errors. (ən azı 3)
  - 🗂 **email** (brand `rxagentlik`)
    - from: Rəşad Əliyev <reshad.aliyev@rxagentlik.az>
    - to: aynur.mammadova@rxagentlik.az
    - subject: Applications list
    - time: 11:40
    - body: **Hello Leyla,**⟨greeting⟩ / Attached is the **full list of citizen applications with ID codes**⟨full-list⟩. / I also uploaded it to the cloud, **anyone with the link can open it.**⟨anyone⟩ / **Archive password: Muraciet2026**⟨password⟩
    - attachments: {"name": [{"text": "Muracietler_tam.zip"}], "size": "2.4 MB"}
  - ⟨greeting⟩ **Wrong recipient**: The email is written to Leyla but reached you. That is an autocomplete mistake.
  - ⟨full-list⟩ **Too much data**: The task did not need the full list with ID codes. Send only what is needed.
  - ⟨anyone⟩ **Open link**: A confidential file must never have an open link. Anyone who gets the link can open it.
  - ⟨password⟩ **Password in the same email**: A password in the same email as the file protects nothing. Send it by another channel.

#### order · `sent-wrong`
- 🔢 You sent a confidential file to the wrong person. Put the steps in order.
  1. Close the sharing link at once
  2. Tell your manager and the security team
  3. As they advise, ask the recipient to delete the file
  4. Write down what went to whom and when
- 💡 Anyone can make this mistake. Reporting fast reduces the harm, hiding it makes it worse.

#### choice · `link-setting`
- ❓ You are sending a project file to an external partner. Which setting is right?
  - ❌ Anyone with the link, no expiry — The link can be forwarded and anyone could open the file.
  - ✅ Only the named person, for 7 days — Correct. Access is narrow and time limited.
  - ❌ Upload to my personal cloud and send a link — A personal account is outside the organisation's control.
- 💡 Keep sharing as narrow as possible: who, for how long and with what rights.

#### recap · `recap`
- ✔ Before sending, check the document's level and the recipient.
- ✔ Limit links by name and time, send passwords separately.
- ✔ If you sent it wrong, do not hide it, report at once.

### Links and cloud folders (`links-cloud`, 3 dəq)

#### tutor · `intro`
- 🗣 "Cloud folders are handy, but one wrong setting can open a file to the whole internet." — _talk/wave, visual: cloud_
- 🗣 "With anyone with the link, if the link is passed on, strangers can open the file too." — _alert/point-left, visual: artifact_, highlight `public`
  - 🗂 **url** (brand `rxagentlik-disk`)
    - url: https://disk.rxagentlik.az/qovluq/budce-2027?paylasim=**hamiya-acik**⟨public⟩
- 🗣 "The right way: named people only, view-only access and an end date." — _talk/shield-up, visual: lock_
- 🗣 "Do not upload work files to a personal cloud account. There the organisation cannot protect or recover them." — _think/recite, visual: folder_

#### simulation · `share-folder` · Share the file
- 🖥 mühit: `browser` — You need to send the draft budget to an outside partner. Set up the sharing yourself on the cloud drive.
  - **step `file-page`** · Draft budget 2027.xlsx — 🗣 "How do you share the file?"
    - 🗂 **url** (brand `rxagentlik-disk`)
      - url: https://disk.rxagentlik.az/fayllar/Budce_layihesi_2027.xlsx (əslində: `rxagentlik.az`)
    - ✅ [share] Share — Good, the file stays on the work drive. Now look at the sharing settings.
    - ⚠️ [open] Move to my personal cloud — A personal account is outside the organisation's control. Work files stay on the work drive.
  - **step `who-can-open`**
    - 🗂 **dialog** (brand `rxagentlik-disk`)
      - tone: app
      - title: Share: Draft budget 2027.xlsx
      - body: Who can open it?
      - buttons: Anyone with the link, Named people only
    - ✅ [keep-private] Named people only — Correct. The file opens only for the people you choose.
    - ⚠️ [share] Anyone with the link — The link can be forwarded or end up in the wrong place. Then anyone can open the file.
  - **step `rights`**
    - 🗂 **dialog** (brand `rxagentlik-disk`)
      - tone: app
      - title: To whom and how?
      - body: Recipient: e.rzayev@merkez-konsalting.example / Access: view or edit / Expires: in 7 days or never
      - buttons: Edit, no end date, View, 7 days
    - ✅ [keep-private] View, 7 days — Excellent. The partner can see the file, not change it, and access ends in a week.
    - ⚠️ [share] Edit, no end date — The partner does not need to edit, and open-ended access stays open for years.
  - **step `fake-share`** — 🗣 "An hour later a shared file page opens. Check the address."
    - 🗂 **login** (brand `rxagentlik-disk-fake`)
      - brand: RXAgentlik Disk
      - url: https://rxagentlik-disk.example.net/giris (əslində: `rxagentlik-disk.example.net`)
      - fields: Email, Password
      - button: Sign in
    - 💀 [enter-credentials] Sign in — The domain is not your work drive. A shared file is the excuse to steal the password.
    - ✅ [cancel] Close the tab — Correct. Open shared files only at disk.rxagentlik.az.
    - ✅ [report] Report the site — Excellent. Reporting the fake page protects colleagues too.
  - **step `old-links`** · My shares: 4 files are open to anyone
    - 🗂 **url** (brand `rxagentlik-disk`)
      - url: https://disk.rxagentlik.az/paylasimlar (əslində: `rxagentlik.az`)
    - ✅ [keep-private] Close the open links — Correct. Closing shares you no longer need is the simplest protection.
    - ⚠️ [later] Later — Every link left open is a new risk every day.

#### swipe · `link-settings`
- 👉 Is this sharing setting safe?
  - 🛑 threat `anyone-forever`: A confidential file open to anyone with no end date. Once the link spreads, there is no undo.
    - 🗂 **dialog** (brand `rxagentlik-disk`)
      - tone: app
      - title: Sharing setting
      - body: Salary table: anyone with the link, edit, no end date
      - buttons: Done
  - ✅ safe `named-week`: Narrow access, view only and an end date. The right setting.
    - 🗂 **dialog** (brand `rxagentlik-disk`)
      - tone: app
      - title: Sharing setting
      - body: Project report: 2 people, view, 7 days
      - buttons: Done
  - 🛑 threat `whole-org`: A confidential document is not for the whole organisation, only for named people.
    - 🗂 **dialog** (brand `rxagentlik-disk`)
      - tone: app
      - title: Sharing setting
      - body: HR list: everyone in the organisation
      - buttons: Done
  - ✅ safe `public-ad`: It is public and already on the website. An open link is fine here.
    - 🗂 **dialog** (brand `rxagentlik-disk`)
      - tone: app
      - title: Sharing setting
      - body: Job advert: anyone with the link
      - buttons: Done

#### match · `who-needs-what`
- 🔗 Find the right setting for each need.
  - A partner needs to read a document ⇄ View, by name, 7 days
  - A colleague co-writes the document ⇄ Edit, only that person
  - A notice published on the website ⇄ Open link for anyone
- 💡 Keep sharing as narrow as possible: who, with what rights, for how long.

#### choice · `personal-cloud`
- ❓ Can you upload a confidential file to your personal cloud to work from home?
  - ❌ Yes, my password is strong — A strong password does not put the file back under the organisation's control.
  - ✅ No, I use the work drive or a way the organisation allows — Correct. On the work drive the file is protected and can be recovered.
  - ❌ Yes, I will delete it later — A deleted file often stays in the bin and on other devices.
- 💡 Work files stay in work systems. If unsure, ask technical support.

#### recap · `recap`
- ✔ Never use anyone with the link for confidential files.
- ✔ Share by name, view only and with an end date.
- ✔ Close old shares regularly.

### Wrong recipient (`wrong-recipient`, 3 dəq)

#### tutor · `intro`
- 🗣 "Email sent to the wrong person is one of the most common leaks. Haste and autocomplete are the usual cause." — _talk/nod, visual: inbox_
- 🗣 "The same name appears twice: one is the work address, the other a personal or outside one. Check the domain." — _alert/point-left, visual: artifact_, highlight `external`
  - 🗂 **dialog** (brand `ispoct`)
    - tone: app
    - title: To: Leyla
    - body: Leyla Həsənova, leyla.hasanova@rxagentlik.az / Leyla Həsənova, **leyla.hasanova85@poct.example**⟨external⟩
    - buttons: Select
- 🗣 "Do not rely on recall after sending: it usually fails for outside addresses." — _think/shake, visual: lock_
- 🗣 "Before sending, check three things: the recipient, the attachment and the names in copy." — _happy/recite, visual: folder_

#### simulation · `before-send` · Before you send
- 🖥 mühit: `inbox` — Three drafts are waiting to be sent, and one reply came from outside. Check each one.
  - **step `autocomplete`** · Draft — 🗣 "Read the recipient's domain to the end."
    - 🗂 **email** (brand `rxagentlik`)
      - from: You <aynur.mammadova@rxagentlik.az>
      - to: Leyla Həsənova <leyla.hasanova85@poct.example>
      - subject: List of applications
      - time: 11:38
      - body: Leyla, the list you asked for is attached.
      - attachments: {"name": [{"text": "Muracietler_2026.xlsx"}], "size": "310 KB"}
    - ✅ [verify] Check and fix the recipient — Correct, the name matched but the domain did not. The work address ends in rxagentlik.az.
    - 💀 [share] Send — The recipient was a personal mailbox. A confidential list left the organisation.
  - **step `reply-all`** · Draft
    - 🗂 **email** (brand `rxagentlik`)
      - from: You <aynur.mammadova@rxagentlik.az>
      - to: layihe-qrupu@rxagentlik.az, e.rzayev@merkez-konsalting.example
      - subject: Re: The partner's price offer
      - time: 12:05
      - body: Colleagues, Merkez Konsalting's offer looks expensive, let us talk to another company too.
    - ✅ [verify] Remove the outside address — Correct. Reply all keeps every earlier recipient, outsiders included.
    - ⚠️ [share] Send — The partner is on the list. The internal discussion would have reached them too.
  - **step `correct-draft`** · Draft
    - 🗂 **email** (brand `rxagentlik`)
      - from: You <aynur.mammadova@rxagentlik.az>
      - to: kadrlar@rxagentlik.az
      - subject: Leave application
      - time: 12:20
      - body: Hello, my leave application is attached.
      - attachments: {"name": [{"text": "Erize.pdf"}], "size": "52 KB"}
    - ✅ [share] Send — All in order: an internal address, the right file, no extra recipients.
    - ✅ [verify] Check again — Checking never hurts. This email was right and can go.
  - **step `partner-notice`**
    - 🗂 **email** (brand `merkez-konsalting`)
      - from: Elçin Rzayev <e.rzayev@merkez-konsalting.example>
      - subject: Did this reach me by mistake?
      - time: 13:10
      - body: Hello, yesterday your department sent me the staff salary table. Probably a mistake. What should I do?
    - ✅ [forward] Forward to the security team — Correct. A misdirected email is an incident, the specialist will tell you what to do.
    - ⚠️ [reply] Reply: please delete it — Asking for deletion is right, but tell the security team first.
    - ⚠️ [delete] Delete — The leak does not go away. Report it so specialists can follow up.

#### choice · `recall`
- ❓ An email went to the wrong address and you recalled it. Is that enough?
  - ❌ Yes, the email will be removed — Recall usually fails for outside addresses and the email may already be read.
  - ✅ No, I still report to the security team at once — Correct. Recall may fail, reporting is a must.
  - ❌ I wait, maybe they will not open it — Waiting does not reduce the harm. Reporting fast gives more options.
- 💡 If you sent it wrong, do not hide it: tell your manager and the security team at once.

#### swipe · `recipient-check`
- 👉 Is this recipient list right?
  - ✅ safe `hr`: An internal address, the right department, no extra recipients.
    - 🗂 **email** (brand `rxagentlik`)
      - from: You <aynur.mammadova@rxagentlik.az>
      - to: kadrlar@rxagentlik.az
      - subject: Request for a certificate
      - time: 14:00
      - body: Hello, I need an employment certificate.
  - 🛑 threat `lookalike`: rxagentlik-az.com is not your domain. Autocomplete offered an old or fake address.
    - 🗂 **email** (brand `rxagentlik`)
      - from: You <aynur.mammadova@rxagentlik.az>
      - to: Rəşad Əliyev <reshad.aliyev@rxagentlik-az.com>
      - subject: Budget table
      - time: 14:12
      - body: Rashad, the table is attached.
      - attachments: {"name": [{"text": "Budce_2027.xlsx"}], "size": "180 KB"}
  - 🛑 threat `all-staff`: A personal document must not go to all staff. Send it only to the person who needs it.
    - 🗂 **email** (brand `rxagentlik`)
      - from: You <aynur.mammadova@rxagentlik.az>
      - to: butun-emekdaslar@rxagentlik.az
      - subject: A colleague's medical note
      - time: 14:30
      - body: The note is attached.
      - attachments: {"name": [{"text": "Arayis.pdf"}], "size": "96 KB"}
  - 🛑 threat `no-bcc`: In a mass email, put addresses in Bcc so recipients do not see each other.
    - 🗂 **email** (brand `rxagentlik`)
      - from: You <aynur.mammadova@rxagentlik.az>
      - to: 40 partners, all in the To field
      - subject: Holiday greetings
      - time: 15:00
      - body: Dear partners, happy holidays!

#### match · `address-fields`
- 🔗 Put each recipient in the right field.
  - Main recipient, a reply is expected ⇄ To
  - A colleague kept informed ⇄ Cc
  - Many recipients who do not know each other ⇄ Bcc
- 💡 The right field keeps outsiders from seeing addresses they do not need.

#### recap · `recap`
- ✔ Before sending, read the recipient's domain to the end.
- ✔ Check reply all and any outside addresses in copy.
- ✔ If it went wrong, do not rely on recall, report at once.


## Physical security (`physical-security`) · Physical security · Easy · 300 XP

### Guarding the office (`office-guard`, 3 dəq)

#### tutor · `intro`
- 🗣 "An attacker does not always need a computer. A document left on a desk or an unlocked screen is enough." — _talk/wave, visual: desk_
- 🗣 "Lock your screen whenever you stand up. On a Windows computer, press the Windows key and the letter L together." — _talk/recite, visual: lock_
- 🗣 "If a stranger tries to follow you through a secured door, politely ask them to use their own badge." — _think/lean-in, visual: badge-id_
- 🗣 "Visitors sign in, wear a visitor badge and are always escorted in the building." — _happy/nod, visual: handshake_

#### scenario · `tailgate` · Someone behind you
- 🎭 start: `door`
  - **[door]** Unknown man (in-person, 🔊young-man-2): "Could you hold the door, please? My hands are full. My badge is in my bag, I'm here to fix the printer."
    - Hold the door, his hands are full ⇒ **compromised** — An unverified person got in. Attackers count on exactly this politeness.
    - Offer to hold the boxes so he can find his badge → `no-badge` — Polite and correct.
    - Let the door close and walk away silently ⇒ **risky** — He did not get in, but someone else may open the door. Telling security is better.
  - **[no-badge]** Unknown man (in-person, 🔊young-man-2): "Looks like, I left it at home. I'm in a hurry, your boss is waiting for me."
    - Fine, go ahead ⇒ **compromised** — Naming the boss and rushing you is the oldest trick. No badge, no entry.
    - Walk him to the security desk → `guard` — Right. They can issue a visitor badge or turn him away.
  - **[guard]** Security guard (in-person, 🔊older-man): "No printer repair is booked for today. Good thing you brought him here."
    - Also send a short note to the security team ⇒ **safe** — Well done. They will review cameras and check other entrances.

#### simulation · `reception-call` · Call from reception
- 🖥 mühit: `call` — The reception desk is calling you. Decide what to do about a visitor you did not expect.
  - **step `ring`**
    - 🗂 **call**
      - caller: Reception desk
      - number: Extension 115
      - label: Work phone
      - voice: woman-2
    - ✅ [answer] Answer — Answer it. You decide about the visitor.
    - ⚠️ [decline] Decline — The desk gets no answer and may let the visitor through unchecked. Take such calls. → `after`
  - **step `visitor`** — 🗣 "Hello, there is an air conditioning technician here. He says you, excuse me, called him. Shall I send him up?"
    - 🗂 **call**
      - caller: Reception desk
      - number: Extension 115
      - label: Work phone
      - voice: woman-2
    - ⚠️ [reply] Yes, send him up — An unchecked person will walk the building alone. Check the job order first.
    - ✅ [verify] I did not call anyone, keep him at the desk — Right. An unexpected visitor does not get in without a check.
    - ✅ [reply] I will come down and see — Good. Meet the visitor at the desk and do not leave him alone.
  - **step `name-drop`** — 🗣 "He says Mr Kamran approved it. He only needs five minutes in the server room."
    - 🗂 **call**
      - caller: Reception desk
      - number: Extension 115
      - label: Work phone
      - voice: woman-2
    - 💀 [reply] Then let him in — Unchecked access to the server room is a serious threat. A manager's name is not permission.
    - ✅ [verify] I check the order with facilities — Right. Check the order through official channels, not the visitor's word.
    - ✅ [hang-up] I will call Mr Kamran myself — Good. Call your manager on the number you know and ask. → `after`
  - **step `after`** · The call has ended. Facilities say no technician was booked today.
    - 🗂 **call**
      - caller: Reception desk
      - number: Extension 115
      - label: Work phone
      - voice: woman-2
    - ✅ [report] Tell the guards and the security team — Great. The guards will hold the person and the cameras will be checked.
    - ⚠️ [ignore] Do nothing — The fake technician may try another entrance. Reporting protects the building.

#### choice · `clean-desk`
- ❓ You are going to lunch. What must not stay on your desk?
  - ✅ A sticky note with a password — A password should never sit on paper in plain sight.
  - ✅ A folder with a citizen's application — Put confidential files in a locked cabinet.
  - ✅ An unlocked work phone — An unlocked phone opens the door to your accounts.
  - ❌ An empty coffee cup — That is not a risk. Just tidy it up.
- 💡 Clean desk rule: when you leave, papers, media and devices are locked away.

#### match · `situations`
- 🔗 Match each situation with the right reaction.
  - A stranger without a badge in the corridor ⇄ Politely ask and guide them to security
  - Someone else's confidential printout ⇄ Return it to the owner without reading
  - You lost your access badge ⇄ Report it at once so it gets blocked
  - A colleague left their screen unlocked ⇄ Lock it and remind them
- 💡 Physical security is everyone's job. A small step prevents a big leak.

#### order · `visitor-flow`
- 🔢 Put a visitor's arrival in order.
  1. The visitor signs in at reception
  2. Gets a visitor badge and wears it visibly
  3. The host meets and escorts them
  4. The badge is returned on the way out
- 💡 A visitor is never left alone in the building and hands the badge back on leaving.

#### recap · `recap`
- ✔ Lock your screen when you stand up and keep papers locked away.
- ✔ Do not let strangers follow you in, send them to security.
- ✔ Collect prints at once and destroy confidential paper properly.

### Your access badge (`badge-sense`, 3 dəq)

#### tutor · `intro`
- 🗣 "Your badge is a key to the building. Never lend it, not even to a colleague." — _talk/wave, visual: badge-id_
- 🗣 "Do not post photos showing your badge. A photo makes it easier to fake one." — _alert/shake, visual: social_
- 🗣 "An attacker can arrive dressed as a technician, courier or inspector. A uniform is not ID." — _think/lean-in, visual: mask_
- 🗣 "Lost your badge? Report it at once so it gets blocked. Hide it when you leave the building." — _happy/recite, visual: lock_

#### simulation · `badge-phone` · Badge messages
- 🖥 mühit: `phone` — During the day, messages about your badge reach your phone. Answer each one the right way.
  - **step `borrow`**
    - 🗂 **chat**
      - app: whatsapp
      - contact: Elnur Hüseynov
      - 💬 them: Hi, I left my badge at home. Leave yours at the guard post, I will return it tonight.
    - ⚠️ [share] OK, I will leave it — Every entry made with your badge is logged in your name. Never lend it.
    - ✅ [keep-private] No, get a temporary badge at the post — Right. The guard post checks ID and issues a temporary badge.
  - **step `tagged`** — 🗣 "Your badge is clearly visible in the photo."
    - 🗂 **notification** (brand `kontakto`)
      - app: Kontakto
      - title: Gulnar tagged you in a photo
      - body: “First day with the team!” 24 likes
      - time: 13:15
    - ✅ [reply] Ask Gulnar to change the photo — Right. A photo of the badge can help someone fake it or get into the building.
    - ⚠️ [ignore] Like it and move on — The photo is public and shows the badge design and your name. Do not share badge photos.
  - **step `recon-sms`**
    - 🗂 **sms** (brand `db-alov-servis-fake`)
      - sender: AlovServis
      - time: 15:30
      - 💬 We are coming tomorrow to check the fire extinguishers. Which floor is the server room on and when do the guards change?
    - 💀 [share] Reply: 3rd floor, 20:00 — This is reconnaissance for an attack. Do not give out details about the building.
    - ✅ [report] Report to the security team — Right. A real contractor does not ask you this by text message.
    - ⚠️ [delete] Delete — You gave nothing away, which is good. But reporting it protects your colleagues too.
  - **step `badge-phish`**
    - 🗂 **sms** (brand `idare-fake`)
      - sender: Idare
      - time: 17:05
      - 💬 Your access badge is expiring. Update your details so it is not blocked: kart-yenile.example.net → `https://kart-yenile.example.net`
    - 💀 [click-link] Open the link — The link leads to a fake page that wants your work password. Only the guard post renews badges.
    - ✅ [report] Report as phishing — Right. Sort out badge matters in person at the guard post.
    - ✅ [block] Block — Good. Even better, tell the security team as well.

#### scenario · `uniform` · The visitor in uniform
- 🎭 start: `door`
  - **[door]** Man in uniform (in-person, 🔊man): "Hello, we are from Alov Servis, checking the fire extinguishers. Open the server room, there is one in there too."
    - I open the server room ⇒ **compromised** — A uniform and a toolbox are not ID. Nobody enters the server room unchecked.
    - I ask for the visitor badge and the job order → `paper` — Good. Let us see what he shows.
    - I call the guards → `guard` — Correct. Let the guards decide.
  - **[paper]** Man in uniform (in-person, 🔊man): "The papers are in the van. We come every month, don't you recognise me?"
    - Oh yes, go ahead ⇒ **compromised** — Feeling familiar is part of the trick. No visitor badge, no entry.
    - I call the guards → `guard` — Correct. Let the guards decide.
  - **[guard]** Guard (in-person, 🔊older-man): "No check with Alov Servis is planned this month. The man has walked towards the exit."
    - I write to the security team with a description ⇒ **safe** — Great. They will check the cameras and warn the other entrances.
    - He left, so there is no problem ⇒ **risky** — He can come back another day or through another door. Reporting matters.

#### match · `badge-rules`
- 🔗 Match each situation with the right step.
  - A colleague asks for your badge ⇄ Send them to the guard post
  - A team photo is being taken ⇄ Hide the badge first
  - You go shopping after work ⇄ Put the badge in your bag
  - A uniformed technician has no visitor badge ⇄ Call the guards
- 💡 Your badge is your identity. Use it only in the building and only yourself.

#### choice · `why-hide`
- ❓ Why hide your badge outside the building?
  - ❌ So it does not get dirty — The reason is security, not tidiness.
  - ✅ It shows your name and workplace, and it can be stolen — Right: a visible badge tells an attacker whom to approach. Some badges can even be copied up close.
  - ❌ It is just the rule — There is a reason: the badge protects you and the building.
- 💡 Wear the badge visibly inside and hide it when you leave.

#### recap · `recap`
- ✔ Never lend your badge or post photos of it.
- ✔ A uniform is not ID: no visitor badge, no entry.
- ✔ Lost your badge? Report it at once.

### Left and found (`left-and-found`, 3 dəq)

#### tutor · `intro`
- 🗣 "A flash drive found in a corridor is no gift. Never plug it in, hand it to security." — _talk/wave, visual: usb_
- 🗣 "Someone may be watching your screen and keyboard from behind. Look around when you type a password." — _think/lean-in, visual: eye_
- 🗣 "Never leave a laptop alone in a car or cafe. It is a thief's easiest prize." — _alert/shake, visual: travel_
- 🗣 "Check your desk before you leave: papers locked away, devices locked, prints collected." — _happy/recite, visual: folder_

#### simulation · `desk-pc` · At your desk
- 🖥 mühit: `desktop` — You are at your desk. Decide about a found flash drive, a print job and leaving your seat.
  - **step `usb-found`** · Found by the lift
    - 🗂 **file**
      - name: Ixtisar_siyahisi_2026.xlsx
      - type: lnk
      - size: 3 KB
      - source: USB: ARXIV (F:)
    - ⚠️ [plug-in] Plug it in and look — The file name is bait for your curiosity. Do not plug in a found flash drive.
    - ✅ [report] Hand it to security — Right. Never plug in a found device, give it to the specialists. → `print-done`
  - **step `usb-file`** — 🗣 "Look at the file's real type."
    - 🗂 **file**
      - name: Ixtisar_siyahisi_2026.xlsx
      - type: lnk
      - size: 3 KB
      - source: USB: ARXIV (F:)
    - 💀 [open] Open — This is not a spreadsheet but a shortcut. Opening it runs a hidden command.
    - ✅ [eject] Eject the device — The right call. Eject it without opening anything and hand it to security.
  - **step `print-done`**
    - 🗂 **notification** (brand `db-cap-xidmeti`)
      - app: Print service
      - title: Your document has printed
      - body: Vetendas_muracietleri.pdf, shared printer, 3rd floor
      - time: 11:20
    - ✅ [open] I go and collect it now — Right. Anyone passing a shared printer can read what is left there.
    - ⚠️ [later] I will collect it this evening — Citizens' data will sit on the printer for hours. Collect prints at once.
  - **step `leave-desk`** — 🗣 "You get up to go to the printer."
    - 🗂 **dialog**
      - tone: system
      - title: Citizens' data is open on screen
      - body: The computer will lock itself in 15 minutes.
      - buttons: Lock the screen, Leave it
    - ✅ [keep-private] Lock the screen — Right. The Windows key plus L locks the screen in a second.
    - ⚠️ [ignore] Leave it, I will be back in two minutes — Two minutes is enough for someone to read or send the data.

#### scenario · `cafe-laptop` · Laptop in a cafe
- 🎭 start: `cafe`
  - **[cafe]**  (, 🔊-): "You are working on your work laptop in a cafe. You need to go to the counter for your order."
    - I leave it open, it is only a minute ⇒ **compromised** — A minute is enough to steal it, and an open screen exposes the data.
    - I ask the person at the next table to watch it ⇒ **risky** — A stranger is not your device's guard. Take the laptop with you.
    - I close the laptop and take it with me → `neighbour` — Correct. The device should always stay with you.
  - **[neighbour]** Man at the next table (in-person, 🔊man-2): "Excuse me, I saw on your screen that you work at the agency. What is your manager's name? I have business there."
    - I give my manager's name and extension ⇒ **risky** — Do not give internal details to a stranger. They become bait for a later call or email.
    - I point him to the reception number on the official site ⇒ **safe** — Polite and with no internal details, well done. Also keep your screen away from others.

#### order · `found-usb`
- 🔢 You found a flash drive in the corridor. Put the steps in order.
  1. Do not plug it into any computer
  2. Note where and when you found it
  3. Hand it to the security team
  4. Tell colleagues not to plug in similar drives
- 💡 A found device is evidence: hand it in as it is, unopened.

#### match · `left-behind`
- 🔗 Match each situation with the right step.
  - The laptop is on the car seat ⇄ Take it with you
  - A confidential draft page ⇄ Destroy it in the shredder
  - Someone is looking at your screen ⇄ Turn the screen away or lock it
  - Your badge is lying on the desk ⇄ Keep it on you at all times
- 💡 Anything left unattended is an opportunity for an attacker.

#### recap · `recap`
- ✔ Never plug in a found flash drive, hand it to security.
- ✔ Lock the screen when you get up, collect prints at once.
- ✔ Never leave laptops or papers unattended.


## Remote work (`remote-work`) · Workplace · Medium · 150 XP

### Wherever you work (`work-anywhere`, 3 dəq)

#### tutor · `intro`
- 🗣 "When you work from home or a cafe, the office's protection does not come with you. You have to build it yourself." — _talk/-, visual: shield_
- 🗣 "Connect to work systems only through your organisation's VPN. Free VPN apps can pass your data to others." — _talk/-, visual: vpn_
- 🗣 "Anyone can fake the name of an open cafe network. If you can, use your phone's hotspot instead." — _think/-, visual: wifi_
- 🗣 "People behind you can see your screen and typed password. Sit with your back to a wall and use a privacy filter." — _alert/-, visual: eye_
- 🗣 "The work laptop is not for the family. A game someone at home downloads can bring malware with it." — _talk/recite, visual: download_

#### hotspot · `cafe-networks`
- 🔍 Which networks in this cafe are suspicious? (ən azı 2)
  - 🗂 **wifi**
    - networks: 
  - ⟨twin⟩ **Look-alike name**: An open network that mimics the cafe's name. It has no password and may be fake. Ask staff for the real one.
  - ⟨free⟩ **Unknown owner**: An open network with no known owner can send you to a fake login page.
  - ⟨staff⟩ **Your organisation's name**: Your organisation's network cannot be in a cafe. This one was set up to fool you.

#### swipe · `home-setup`
- 👉 Which of these is safe for working from home?
  - 🛑 threat `default-router`: Factory passwords are public knowledge. Change the router password now.
    - 🗂 **login**
      - brand: HomeRouter
      - url: http://192.168.1.1
      - fields: Username: admin, Password: admin
      - button: Sign in
  - 🛑 threat `share-password`: A password is never shared, not even with a colleague. Suggest he contacts tech support.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Tural, colleague
      - 💬 them: I can't get into the system from home. Tell me your password, just for a minute.
  - ✅ safe `vpn-update`: The domain is correct and you are not asked to download anything.
    - 🗂 **email**
      - from: IT Support <it@rxagentlik.az>
      - subject: New VPN app version
      - time: 08:30
      - body: The update will install on your work computer automatically. Do not download anything.
  - 🛑 threat `free-vpn`: An unknown free VPN can read your traffic. Use only the organisation's VPN for work.
    - 🗂 **url**
      - url: https://super-free-vpn.top/download
  - ✅ safe `home-wifi`: A password protected home network. If the router password was changed too, it is a good start.
    - 🗂 **wifi**
      - networks: 

#### scenario · `home-and-cafe` · At home and in a cafe
- 🎭 start: `evening`
  - **[evening]** Family member (in-person, 🔊young-man): "Can I install a game on your work laptop? Mine is too slow."
    - Fine, just for an hour ⇒ **compromised** — Malware came with the game and your work accounts are now at risk.
    - No, the work laptop is for work only → `cafe` — Right. Calmly explain why.
  - **[cafe]**  (, 🔊-): "Next day you are working in a cafe. You need to go to the counter to order, and your laptop is open."
    - Leave it open, it's only two minutes ⇒ **risky** — Two minutes is enough to look, plug in a drive or take the laptop.
    - Lock the screen and take the laptop with me → `call` — Great habit.
  - **[call]**  (, 🔊-): "Back at your table, your manager calls and asks for figures from a confidential project. People are sitting nearby."
    - Say the figures out loud ⇒ **risky** — People nearby can hear. Confidential talk does not happen in public.
    - Say I will call back from a quiet place ⇒ **safe** — Well done. Have confidential calls only where no one can overhear.

#### choice · `home-router`
- ❓ Which steps matter for your home router?
  - ✅ Change the factory admin password — Anyone can look up a factory password.
  - ✅ Update the router's firmware — Updates close known holes.
  - ✅ Choose WPA3 or WPA2 encryption — It protects your network from eavesdropping.
  - ❌ Leave Wi-Fi without a password for speed — Anyone could join, and it does not make it faster.
- 💡 The router is your home's door to the internet. A factory password and old firmware leave it open.

#### recap · `recap`
- ✔ Connect to work systems only through the organisation's VPN.
- ✔ Use your phone's hotspot instead of open Wi-Fi.
- ✔ Do not share the work laptop with family, and lock the screen.


## Social Media (`social-media`) · Social engineering · Easy · 120 XP

### Share Smart (`share-smart`, 3 dəq)

#### tutor · `intro`
- 🗣 "Hi! Every photo and every sentence you post on social media is information for someone. Let us look at it together." — _talk/-, visual: social_
- 🗣 "An office photo can show your badge, an open screen or whiteboard notes. That is ready material for an attack." — _alert/-, visual: badge-id_
- 🗣 "Do not announce trips in advance: it tells everyone your home is empty and you are hard to reach. Post photos afterwards." — _think/recite, visual: travel_
- 🗣 "Fake profiles exist too. A recruiter with a dream job may be gathering facts about your organisation. Check the profile's age." — _alert/-, visual: artifact_, highlight `profile`
  - 🗂 **chat**
    - app: generic
    - contact: Rashad Mammadli** · NovaHire Group, 3 connections**⟨profile⟩
    - 💬 them: Hello! I saw your profile. A high-paying job abroad would suit you perfectly.

#### choice · `safe-post`
- ❓ Which post is the safest?
  - ❌ A selfie at the office with my new badge — The badge design, your name and your role are visible. That is a ready template for a fake badge.
  - ❌ Off on a week of holiday from tomorrow — It tells people when your home is empty and when you cannot be reached.
  - ✅ A nature photo after I got back — Correct. The place and time are in the past, and nothing about work is visible.
  - ❌ My desk, with the monitor open behind — A document, email or system name on the screen can be read by zooming in.
- 💡 Before you post, check the background: badge, screen, whiteboard, papers.

#### hotspot · `fake-recruiter`
- 🔍 Find the signs of a fake recruiter. (ən azı 3)
  - 🗂 **chat**
    - app: generic
    - contact: Rashad Mammadli** · NovaHire Group, 3 connections**⟨profile⟩
    - 💬 them: Hello! I saw your profile. **A job abroad paying 6000 dollars a month is waiting for you.**⟨too-good⟩
    - 💬 them: One quick question before the interview: **which email system and which software does your organisation use?**⟨internal-info⟩
    - 💬 them: Fill in the form with your work email: **novahire-careers.example.net/apply**⟨link⟩** Places are limited, it closes today.**⟨urgency⟩
  - ⟨profile⟩ **New profile, few connections**: Real recruiters usually have a long history and mutual contacts. A profile with three connections was just created.
  - ⟨too-good⟩ **Too good to be true**: A big salary before any interview is bait. Excitement lowers your guard.
  - ⟨internal-info⟩ **Questions about your organisation**: A recruiter does not need your organisation's systems. This is reconnaissance for an attack.
  - ⟨link⟩ **Outside link asking for work email**: Entering your work email on an outside form puts it on a phishing list. The form may also ask for a password.
  - ⟨urgency⟩ **Pressure to hurry**: Closes today is there so you do not stop to think.

#### swipe · `messages`
- 👉 Is this message safe or a threat?
  - 🛑 threat `vote-code`: That code is the key to your account. Never share it, even if the message comes from a friend's account.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Gunel Rzayeva
      - 💬 them: Hi! My daughter is in a contest, please vote for her. You will get a code by SMS, send it to me.
  - ✅ safe `login-alert`: No link and no code request, it sends you to the app itself. Do the check inside the app.
    - 🗂 **sms**
      - sender: Kontakto
      - time: 08:30
      - 💬 New sign-in to your account: Baku, phone. If this was not you, open Security in the app.
  - 🛑 threat `boss-number`: A stranger is looking for a way to reach your manager. Give contact details only through official channels.
    - 🗂 **chat**
      - app: telegram
      - contact: Kamran Aliyev · no mutual contacts
      - 💬 them: Hi, we work in the same field. Could you send me your head of department's mobile number?
  - ✅ safe `meeting-moved`: A known colleague, no request, nothing sensitive. This message is safe.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Aysel Guliyeva (colleague)
      - 💬 them: Tomorrow's meeting moved to 11, same room.
  - 🛑 threat `press-office`: Official bodies do not ask for this on social media. Do not reply, and report the profile.
    - 🗂 **chat**
      - app: telegram
      - contact: Official Press Office
      - 💬 them: To verify your account, send your job title, work email and date of birth.

#### match · `privacy`
- 🔗 Match each setting to what it gives you.
  - Profile visible to friends only ⇄ Strangers cannot see your photos
  - Location turned off ⇄ No one sees where you are
  - Review tags first ⇄ No one can tag you without approval
  - Two-step sign-in ⇄ The account stays safe even if the password leaks
- 💡 Check these settings from time to time. New app features can change them.

#### recap · `recap`
- ✔ Check the background: badge, screen, papers.
- ✔ Post trip photos after you return.
- ✔ Never give work details or codes to strangers.


## Secure Messaging (`secure-messaging`) · Workplace · Medium · 150 XP

### Chat Safely (`chat-safely`, 3 dəq)

#### tutor · `intro`
- 🗣 "Messengers are handy. But a work file sent to a personal account leaves your organisation's control, sometimes for years." — _talk/-, visual: phone-lock_
- 🗣 "A familiar name on a new number may really be a scammer. Check by calling the old number you already know." — _alert/-, visual: artifact_, highlight `new-number`
  - 🗂 **chat**
    - app: whatsapp
    - contact: **+994 50 000 47 09**⟨unknown-number⟩
    - 💬 them: Hello, Narmina. It is Elchin Gasimov. **This is my new number, I lost the old one.**⟨new-number⟩
    - 💬 them: The director urgently needs a report. **Send the finance spreadsheet right here.**⟨work-file⟩
    - 💬 them: **I am in a meeting, I cannot talk, just text.**⟨no-call⟩
- 🗣 "Disappearing messages help, but the other person can still take a screenshot. Keep sensitive information out of messengers altogether." — _think/-, visual: eye_
- 🗣 "For work, use the tool your organisation approved. Not sure which one? Ask your technical support team." — _happy/recite, visual: lock_

#### hotspot · `new-number-chat`
- 🔍 What is suspicious in this chat? (ən azı 3)
  - 🗂 **chat**
    - app: whatsapp
    - contact: **+994 50 000 47 09**⟨unknown-number⟩
    - 💬 them: Hello, Narmina. It is Elchin Gasimov. **This is my new number, I lost the old one.**⟨new-number⟩
    - 💬 them: The director urgently needs a report. **Send the finance spreadsheet right here.**⟨work-file⟩
    - 💬 them: **I am in a meeting, I cannot talk, just text.**⟨no-call⟩
  - ⟨unknown-number⟩ **Unsaved number**: No name, only a number. The only proof of who it is comes from the sender.
  - ⟨new-number⟩ **The new number story**: This is the most common opener. Call the old number to check.
  - ⟨work-file⟩ **Work file into a messenger**: Finance documents go only through an approved work channel.
  - ⟨no-call⟩ **Avoids a call**: A scammer does not want you to hear the voice. Be wary of any request that refuses a call.

#### choice · `verify`
- ❓ How do you check it is really Elchin?
  - ❌ I call the new number — That number belongs to the scammer. They can answer themselves or with a faked voice.
  - ✅ I call his old number or office line — Correct. A channel you already know is the most reliable check.
  - ❌ I look at the profile photo — Copying a photo from the internet takes a minute.
  - ❌ I ask him for the office address — That is public information. Anyone can answer it.
- 💡 Always verify through a channel you already know: the old number, the office line, or in person.

#### swipe · `what-goes-where`
- 👉 Is this message safe or risky?
  - 🛑 threat `family-group`: A work file landed in the family group. Mistakes like this happen most when we rush.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Family group · 38 members
      - 💬 me: Budget draft 2027, final.xlsx
  - 🛑 threat `vpn-password`: A shared password posted in a large group. Lose one phone and access opens for everyone.
    - 🗂 **chat**
      - app: telegram
      - contact: Department chat · 214 members
      - 💬 them: Remote access password: Baki2026! Everyone use it.
  - ✅ safe `internal-link`: The file itself is not sent, it stays in the internal system. That is the right way.
    - 🗂 **chat**
      - app: generic
      - contact: Samir Babayev · internal work chat
      - 💬 them: I uploaded the final report to the internal system, please look there.
  - ✅ safe `meeting-time`: Nothing sensitive, just a reminder. Keep documents and figures in the approved channel.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Meeting group
      - 💬 them: Tomorrow's meeting moved to 10.
  - 🛑 threat `id-photo`: The accounts office already has your details. An ID photo is used to open fake accounts.
    - 🗂 **chat**
      - app: telegram
      - contact: Accounts Office
      - 💬 them: To check your salary, send photos of both sides of your ID card.

#### scenario · `wrong-group` · Wrong Group
- 🎭 start: `sent`
  - **[sent]**  (, 🔊-): "You accidentally sent the staff phone list to a neighbourhood group of 300 people. Two minutes have passed."
    - I delete it for everyone and tell my manager now → `manager` — A good start. Deleting slows the spread, reporting limits the damage.
    - I quietly delete it, surely no one saw ⇒ **risky** — Someone may already have downloaded it. If you stay silent, no one can act in time.
    - I do nothing, it is too late anyway ⇒ **compromised** — The file stays in the group and spreads. It is not too late, act now.
  - **[manager]** Manager (phone, 🔊older-man): "What exactly was in the file?"
    - I say exactly: names and mobile numbers of 120 staff → `reply` — An honest, precise answer speeds up the response.
    - I play it down: just an unimportant table ⇒ **risky** — A team that does not know what leaked cannot decide well. Your colleagues will not be ready for scam calls.
  - **[reply]**  (, 🔊-): "Someone in the group writes: I opened the file, interesting. What do you do?"
    - I politely ask him to delete it and tell my manager ⇒ **safe** — Well done. You tried to stop the spread and reported everything openly.
    - I argue with him and make threats ⇒ **risky** — Threats raise tension and make the file more interesting. Ask politely and let the organisation handle the rest.

#### recap · `recap`
- ✔ Send work files only through the approved tool.
- ✔ Check a new number through a channel you already know.
- ✔ If you send to the wrong place, delete and report at once.


## Software Updates (`software-updates`) · Devices · Easy · 120 XP

### Update Safely (`update-safely`, 3 dəq)

#### tutor · `intro`
- 🗣 "Updates are not just new buttons. Most of them close security holes that attackers already know about." — _talk/-, visual: update_
- 🗣 "As soon as a hole is announced, attackers start hunting for devices that are not updated. Every day of delay adds risk." — _alert/-, visual: ransomware_
- 🗣 "A pop-up saying your browser is outdated, download now, is a trap. Browsers update from their own settings." — _think/-, visual: artifact_, highlight `fake-domain`
  - 🗂 **url**
    - url: https://**brauzer-yenilenme-tecili.example.net**⟨fake-domain⟩/update.exe
- 🗣 "Real updates come from the device settings or the official app store. When in doubt, go there yourself and check." — _happy/-, visual: phone-lock_
- 🗣 "Do not put off the restart after an update. Often the protection only takes effect once the device restarts." — _talk/recite, visual: shield_

#### swipe · `real-or-fake`
- 👉 Real update or a trap?
  - 🛑 threat `sms-virus`: Your phone does not send updates by SMS. This link installs a malicious app.
    - 🗂 **sms**
      - sender: Service
      - time: 07:55
      - 💬 Virus detected on your phone! Download the security update: fix-phone.example.info/app.apk
  - ✅ safe `planned-update`: No link, no file, nothing to download. It only informs you.
    - 🗂 **email**
      - from: Technical support <it-support@idare.example>
      - subject: Planned update tonight
      - time: 14:10
      - body: After 19:00 today, work computers will update automatically. / Leave your computer on and just save your work. You do not need to download anything.
  - 🛑 threat `player-update`: A site that says update your player to watch a video is a classic trap. Browsers play video on their own.
    - 🗂 **url**
      - url: https://video-pleyer-yenile.example.net/pleyer_setup.exe
  - 🛑 threat `zip-update`: Updates do not arrive as email attachments. The archive may hide malware.
    - 🗂 **email**
      - from: System Center <noreply@system-update-center.example.info>
      - subject: Your licence is expiring! Update required
      - time: 09:03
      - body: Install the attached update today.
      - attachments: {"name": [{"text": "Update_KB5039.zip"}], "size": "1.8 MB"}
  - 🛑 threat `remote-helper`: A remote-control program gives the attacker full access to your computer. Call support yourself on a number you know.
    - 🗂 **chat**
      - app: telegram
      - contact: Tech support (official)
      - 💬 them: To update your computer remotely, install this program and send me the code on your screen.

#### hotspot · `fake-update-email`
- 🔍 Find the signs of a fake update email. (ən azı 3)
  - 🗂 **email**
    - from: Office Update Service <security-update@**idare-example.info**⟨domain⟩>
    - to: you
    - subject: **URGENT: **⟨urgency⟩Your computer will be blocked within 24 hours
    - time: 08:47
    - body: Dear colleague, / A critical update is missing on your computer. Open and install the attached file. / **Turn off your antivirus while installing.**⟨disable-av⟩
    - attachments: {"name": [{"text": "Yenilenme_Tecili.exe", "spot": "exe"}], "size": "2.1 MB"}
  - ⟨domain⟩ **Wrong domain**: Your organisation uses idare.example. This is a different domain written with a hyphen.
  - ⟨urgency⟩ **Urgency and threats**: The threat of blocking is meant to make you act without thinking.
  - ⟨disable-av⟩ **Turn off antivirus**: No real update asks you to switch off protection. This clears the way for malware.
  - ⟨exe⟩ **Executable file**: An .exe file runs a program the moment you open it. Updates do not arrive this way.

#### order · `update-steps`
- 🔢 Put the update steps in the right order.
  1. Save your work
  2. Start the update from Settings
  3. Restart the device
  4. Check that everything works
- 💡 Saving protects your work, and the restart completes the update.

#### choice · `old-device`
- ❓ Your old phone no longer gets updates. What now?
  - ❌ Install antivirus and keep using it — Antivirus does not fix holes in the system itself.
  - ✅ Remove work accounts and move to a supported device — Correct. A device out of support will not get fixes for new holes.
  - ❌ Nothing, it still works fine — Working well does not mean safe. New holes will stay open.
- 💡 Keep no work accounts or data on a device out of support. Fully reset it before you sell it.

#### recap · `recap`
- ✔ Install updates without delay, then restart.
- ✔ Update only from Settings or the official store.
- ✔ Keep no work data on unsupported devices.


## Report Incidents (`incident-reporting`) · Incidents · Easy · 300 XP

### Fast and Calm (`report-fast`, 3 dəq)

#### tutor · `intro`
- 🗣 "An incident is not only a big attack. A tapped suspicious link, a lost phone or a misdirected email count too." — _talk/wave, visual: alarm_
- 🗣 "Everyone makes mistakes. Reporting quickly stops a problem from growing. The sooner you speak up, the smaller the damage." — _happy/nod, visual: handshake_
- 🗣 "Do not investigate on your own and delete nothing. The suspicious email, message or file is evidence for the specialist." — _alert/shake, visual: eye_
- 🗣 "When you report, keep it short: what happened, when, on which device, and what you have already done." — _talk/recite, visual: inbox_

#### simulation · `report-button` · The Report button
- 🖥 mühit: `inbox` — Two suspicious emails are in your inbox. Open each one and pick the right step.
  - **step `quota`** — 🗣 "Look at the sender's address."
    - 🗂 **email** (brand `ispoct-fake`)
      - from: IshPocht Administrator <admin@ispoct-mail.example.net>
      - subject: Your mailbox is 98% full
      - time: 08:47
      - body: If you do not add space, new emails will be deleted in 24 hours. / To add space: ispoct-mail.example.net/kvota → `https://ispoct-mail.example.net/kvota`
    - ✅ [report] Report as phishing — Correct. Your report lets specialists remove the same email from everyone else's inbox.
    - 💀 [click-link] Open the link — The address was not your organisation's domain. Mailbox space is never added through a link.
    - ⚠️ [delete] Delete — You are safe, but colleagues are still targets and the evidence is gone. Report instead of deleting.
    - ⚠️ [forward] Forward to colleagues — Forwarding spreads the threat. If there is no Report button, forward it only to the security team.
  - **step `password-reply`**
    - 🗂 **email** (brand `it-destek-fake`)
      - from: Technical support <support@idare-helpdesk.example.net>
      - subject: Account check
      - time: 09:15
      - body: The system is being updated. To keep your account open, reply to this email with your username and password.
    - ✅ [report] Report as phishing — Correct, real technical support never asks for your password. Reporting warns colleagues too.
    - 💀 [reply] Reply with password — Your password went to the attacker. If this happens, change it at once and report it.
    - ⚠️ [delete] Delete — You did not give your password, but someone else might. If you report it, specialists protect everyone.

#### swipe · `is-it-incident`
- 👉 Should this be reported? Threat or normal?
  - 🛑 threat `wrong-recipient`: The list went to a personal address outside the organisation. That is a data leak, report it now.
    - 🗂 **email** (brand `idare`)
      - from: You <l.aliyeva@idare.example>
      - to: kamran.aliyev.1990@mail.example
      - subject: Staff list
      - time: 10:02
      - body: The list you asked for is attached.
      - attachments: {"name": [{"text": "isciler_siyahisi.xlsx"}], "size": "240 KB"}
  - 🛑 threat `unasked-code`: A code you did not ask for means someone knows your password. Change it and report.
    - 🗂 **sms** (brand `ispoct`)
      - sender: IshPocht
      - time: 03:17
      - 💬 Your sign-in code: 482913. Do not share it with anyone.
  - ✅ safe `training-mail`: Correct address, no link, no request. This is a normal notice.
    - 🗂 **email** (brand `it-destek`)
      - from: Technical support <it-support@idare.example>
      - subject: Security training on Friday
      - time: 12:30
      - body: A short training takes place on Friday at 11:00 in the main hall. No registration needed.
  - 🛑 threat `clicked-link`: Opening the link alone can tell the attacker things or start a download. Let a specialist decide, it must be reported.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Tural (colleague)
      - 💬 them: Yesterday I opened the link in that email, but I did not type anything. It is probably fine, right?
  - 🛑 threat `lost-phone`: A lost work phone is an urgent incident. Support can lock or wipe it remotely.
    - 🗂 **chat**
      - app: generic
      - contact: Leyla (team)
      - 💬 them: I left my work phone in a taxi. I will look for it tomorrow, it is not urgent.

#### choice · `first-step`
- ❓ You typed your password on a fake page. First step?
  - ✅ Report it at once and change the password — Correct. Every minute counts. These two steps shut the attacker out.
  - ❌ I tell no one because I feel embarrassed — Silence gives the attacker time. Reporting protects you and the organisation.
  - ❌ I delete the email so no trace is left — The email is evidence. Delete it and specialists cannot see who else was targeted.
  - ❌ I open the link again to check — Opening it again adds risk. Leave the investigation to specialists.
- 💡 Report fast, keep the evidence, leave the investigation to specialists.

#### order · `strange-program`
- 🔢 A strange program is running on your computer. Order the steps.
  1. Stop what you are doing
  2. Disconnect from the network, do not switch off
  3. Call technical support by phone
  4. Write down briefly what you saw
- 💡 Disconnecting stops the spread, while switching off can wipe traces in memory. If your organisation's procedure says otherwise, follow it. Report by phone.

#### match · `good-report`
- 🔗 Match each question to its answer in the report.
  - What happened? ⇄ I typed my password on a fake page
  - When? ⇄ Today at 09:40
  - On which device? ⇄ Work computer, in the mail app
  - What did you do? ⇄ Changed the password, kept the email
- 💡 A short, precise report saves the specialist time.

#### recap · `recap`
- ✔ If in doubt, report at once. Mistakes are not shameful.
- ✔ Do not investigate yourself and delete nothing.
- ✔ Keep it short: what, when, where, what you did.

### The first minutes (`first-minutes`, 3 dəq)

#### tutor · `intro`
- 🗣 "The first minutes matter most. The attacker is in a hurry, so you need to be faster." — _talk/wave, visual: alarm_
- 🗣 "Stop when something looks wrong: a sign-in you do not know, a window that opens itself, missing files." — _alert/point-left, visual: artifact_, highlight `place`
  - 🗂 **notification** (brand `ispoct`)
    - app: İşPoçt
    - title: Sign-in from a new device
    - body: Someone signed in to your account from **Ganja on an unknown device**⟨place⟩ at 03:12.
    - time: 08:31
- 🗣 "In an emergency, call technical support or the security team. The email can wait until later." — _talk/shield-up, visual: shield_
- 🗣 "If you suspect the computer, do not report from it. The attacker may read the mail, so phone instead." — _think/recite, visual: eye_

#### simulation · `strange-morning` · A strange morning
- 🖥 mühit: `desktop` — You start your computer in the morning and notice a few strange things. How do you react to each?
  - **step `new-login`** — 🗣 "If this sign-in was not you, what do you do?"
    - 🗂 **notification** (brand `ispoct`)
      - app: İşPoçt
      - title: Sign-in from a new device
      - body: Someone signed in to your account from Ganja on an unknown device at 03:12.
      - time: 08:31
    - ✅ [report] It was not me: report — Correct, an unknown sign-in means someone has your password. Reporting fast saves the account.
    - ⚠️ [ignore] Dismiss — The attacker is still in your account and gaining time. Report a notice like this at once.
  - **step `remote-request`**
    - 🗂 **dialog** (brand `texkomek-24`)
      - tone: app
      - title: TexKomek 24 wants to connect
      - body: An operator wants to see your screen and control your computer.
      - buttons: Decline, Allow
    - ✅ [deny] Decline — Correct, you did not ask for support. Report an unexpected request like this too.
    - 💀 [allow] Allow — The remote person now controls your computer. Never allow support you did not call yourself.
    - ✅ [report] Decline and report — Excellent. An unexpected remote access request must be reported at once.
  - **step `encrypted`** — 🗣 "A ransom demand is on screen. Your first step?"
    - 🗂 **dialog**
      - tone: warning
      - title: Your files are encrypted
      - body: Pay within 72 hours to get your files back. If you switch off the computer, the files will be deleted.
      - buttons: Payment page
    - ✅ [disconnect] Unplug the cable, turn off Wi-Fi — Correct, going offline stops the spread. Leave the computer on and call at once.
    - ⚠️ [cancel] Switch off the computer — Switching off can erase traces in memory. Unless your procedure says otherwise, go offline and leave it on.
    - 💀 [click-link] Open the payment page — Paying does not guarantee your files back. Never pay, leave the decision to specialists.
  - **step `call-line`**
    - 🗂 **dialog** (brand `it-tehlukesizlik`)
      - tone: system
      - title: Security line
      - body: Urgent incident: +994 12 000 15 15 / Not urgent: the Report button or security@idare.example
      - buttons: Later, Call
    - ✅ [call-back] Call now — Correct. Report an urgent incident by phone: the specialist tells you what to do right away.
    - ⚠️ [later] Email tomorrow — Encryption spreads and every minute counts. This mailbox may not be safe any more either.

#### choice · `who-to-tell`
- ❓ A stranger signed in to your account. Who do you tell?
  - ✅ Technical support or the security team — Correct. Only they can lock and check the account.
  - ✅ My manager as well — Correct. Your manager helps organise the work but does not replace the specialist.
  - ❌ Only colleagues in my department — Colleagues cannot lock the account, so time is lost.
  - ❌ I post it on social media so everyone knows — Posting about an incident helps the attacker and other scammers.
- 💡 The specialist fixes it, your manager is informed, nobody else is needed.

#### match · `how-to-report`
- 🔗 Pick the way to report each situation.
  - A suspicious email arrived ⇄ Send it with the Report button
  - A ransom demand is on screen ⇄ Go offline and phone
  - The work phone is lost ⇄ Call at once so they can lock it remotely
  - A file went to the wrong person ⇄ Tell your manager and the security team
- 💡 For urgent or spreading cases, phone. Report the rest with the Report button or by email.

#### scenario · `colleague-says-wait` · Should we wait?
- 🎭 start: `window`
  - **[window]** Tural (colleague), looking at the strange window (in-person, 🔊man-2): "Do not worry, it is probably an update. Do not make a fuss."
    - I still call technical support → `specialist` — Correct. A false alarm is no problem, a late report is.
    - I wait, maybe it goes away ⇒ **risky** — Waiting gives the attacker time. If in doubt, call.
  - **[specialist]** Technical support (phone, 🔊woman-2): "What did you see and what did you do?"
    - I keep it short: what, when, which computer, what I did ⇒ **safe** — Excellent. With exact details the specialist can start right away.
    - I closed the window, I do not remember ⇒ **risky** — Every detail helps. Next time take a photo of the screen with your phone.

#### recap · `recap`
- ✔ When something looks wrong, stop and report at once.
- ✔ In an emergency, phone. Do not report from a suspect computer.
- ✔ A false alarm is fine, a delay is dangerous.

### After a mistake (`after-mistake`, 3 dəq)

#### tutor · `intro`
- 🗣 "Everyone slips: taps a link, reads out a code. What matters is the next five minutes." — _talk/nod, visual: handshake_
- 🗣 "Do not hide it and do not try to fix it alone. A silent mistake gives the attacker time." — _alert/shake, visual: mask_
- 🗣 "Be honest: what you tapped, what you typed, what you said. The specialist needs to know." — _think/lean-in, visual: eye_
- 🗣 "Then specialists lock the account and check the device. The aim is to stop the harm, not to find someone to blame." — _happy/shield-up, visual: shield_

#### scenario · `gave-code` · You read out the code
- 🎭 start: `call-ended`
  - **[call-ended]**  (, 🔊-): "The caller said he was technical support and you read out the code sent to your phone. After the call you had doubts."
    - I call the support number I know at once → `honest` — Correct. Every minute counts, the attacker may already be signing in.
    - I am embarrassed and tell nobody ⇒ **compromised** — The attacker is now in your account and nobody knows. Silence makes it worse.
    - I change the password myself, that is enough ⇒ **risky** — A good step, but not enough. The attacker may stay in an open session that a specialist must end.
  - **[honest]** Security team (phone, 🔊woman): "When did you give the code and what else did the caller want?"
    - I tell everything as it was, including the code → `manager` — Correct. With honest details the specialist knows exactly what to lock.
    - I say there was just a call, I gave no code ⇒ **risky** — With half the story the specialist does not know the account was taken. Honesty saves time.
  - **[manager]**  (, 🔊-): "The specialist ended all sessions and asked you to set a new password. Your manager asks: what happened?"
    - I explain openly so the team is warned too ⇒ **safe** — Excellent. Your story protects colleagues from the same call.
    - I say nothing happened ⇒ **risky** — The same call may reach your colleagues. Speaking up protects them.

#### simulation · `next-day-inbox` · The next day
- 🖥 mühit: `inbox` — Yesterday you opened a fake link and reported it. Today three emails are waiting in your inbox.
  - **step `ticket`**
    - 🗂 **email** (brand `it-tehlukesizlik`)
      - from: IT Security <security@idare.example>
      - subject: Your report: INC-2026-0412
      - time: 08:20
      - body: Thank you for reporting. All open sessions on your account have been ended. / Today, change your password on the organisation's portal. We send no link: open the portal yourself.
    - ✅ [mark-safe] Mark as safe — Correct. The address is your organisation's, there is no link and nothing is asked.
    - ✅ [report] Report as phishing — Caution is good, but this one is genuine: your organisation's address and no link.
  - **step `second-trap`** — 🗣 "Attackers sometimes write a second time."
    - 🗂 **email** (brand `it-tehlukesizlik-fake`)
      - from: IT Security <security@idare-secure.example.net>
      - subject: Urgent: your account was hacked
      - time: 09:02
      - body: After yesterday's incident, confirm your account again within one hour. / Confirm: idare-secure.example.net/yoxla → `https://idare-secure.example.net/yoxla`
    - ✅ [report] Report as phishing — Correct, the address is not your organisation's domain. Attackers often come back to the same person.
    - 💀 [click-link] Open the link — That was a second trap. The real team asked you to change the password on the portal yourself.
    - ⚠️ [delete] Delete — You are safe, but this email shows the attack is still going on. Report it.
  - **step `colleague`**
    - 🗂 **email** (brand `idare`)
      - from: Nigar Quliyeva <n.quliyeva@idare.example>
      - subject: A strange email came from you
      - time: 09:40
      - body: Hello, last night an email called "Invoice" came from your address with a link in it. Did you send it?
    - ✅ [forward] Forward to the security team — Correct. If the attacker wrote to others from your account, specialists must know.
    - ✅ [reply] Reply: not me, do not open it — Good, you warned your colleague. Forward it to the security team as well.
    - ⚠️ [delete] Delete — Your colleague may open the link and the specialist will not know the attack spread.

#### order · `what-happens-next`
- 🔢 What usually happens after you report? Put it in order.
  1. You report it
  2. The specialist locks the account and ends sessions
  3. The computer and mailbox are checked
  4. You set a new password and get back to work
- 💡 This is the normal routine. The sooner you report, the shorter it is.

#### choice · `fear-of-blame`
- ❓ A colleague says: "If I report it, I will be told off." What do you answer?
  - ✅ Reporting fast limits the harm, hiding it makes it bigger — Correct. Fast, honest information is the most valuable help for specialists.
  - ❌ You are right, let nobody know — A hidden mistake grows and can harm the whole organisation.
  - ❌ Try to fix it yourself first — Fixing it alone can destroy traces and lose time.
- 💡 Silence, not the mistake, makes the danger grow.

#### recap · `recap`
- ✔ If you slipped, report it at once and honestly.
- ✔ Watch the next emails: the attacker may write again.
- ✔ The aim is to stop the harm, not to find someone to blame.


## Travel Security (`travel-security`) · Workplace · Medium · 150 XP

### Safe Trip (`safe-trip`, 3 dəq)

#### tutor · `intro`
- 🗣 "On a trip your devices face more risk than at home: unknown networks, unknown hands and moments of rush." — _talk/-, visual: travel_
- 🗣 "Before you leave, remove work data you will not need. If possible, use a separate travel device from your organisation." — _think/-, visual: phone-lock_
- 🗣 "Hotel and conference network names are easy to fake. For work, always switch on your organisation's secure connection, the VPN." — _alert/-, visual: artifact_, highlight `twin`
  - 🗂 **wifi**
    - networks: 
- 🗣 "Avoid public USB charging ports at the airport. Use your own adapter in a wall socket, or your own power bank." — _alert/recite, visual: usb_
- 🗣 "When you are back, have support check the device, and change the passwords of accounts you used on the trip." — _happy/-, visual: shield_

#### choice · `border`
- ❓ At the border your laptop was taken away for a while. What now?
  - ❌ Nothing, they gave it back — If the device was out of your sight, you cannot know what was done to it.
  - ✅ I stay out of work accounts and tell the security team — Correct. Do not use it for work until a specialist has checked it.
  - ❌ I reset the device myself — A reset wipes the evidence. Let a specialist decide.
- 💡 A device that left your sight can no longer be trusted. That is why you travel with as little data as possible.

#### hotspot · `hotel-wifi`
- 🔍 Find the risky networks. (ən azı 2)
  - 🗂 **wifi**
    - networks: 
  - ⟨twin⟩ **Evil twin**: It copies the real hotel network name but has no password. Attackers set up twins like this.
  - ⟨open-lookalike⟩ **Free lobby network**: Having the hotel name in it proves nothing. Ask at reception for the exact name.
  - ⟨conf-open⟩ **Open conference network**: Traffic on an open network is not encrypted. If you must connect, share your phone's mobile data instead.

#### swipe · `on-the-road`
- 👉 On the road: safe or a trap?
  - 🛑 threat `conf-qr`: An .apk file installs an app on your phone. You do not need an app for slides, check the official site.
    - 🗂 **qr**
      - caption: Scan to download the forum materials
      - destination: forum2026-materials.example.net/app.apk
  - ✅ safe `booking-ok`: The hotel's own domain, no link, no payment request. A normal confirmation.
    - 🗂 **email**
      - from: Lumera Hotel <reservations@lumera-hotel.example>
      - subject: Your booking is confirmed
      - time: 18:22
      - body: Check-in is after 14:00. Payment is made at reception.
  - 🛑 threat `booking-scam`: A different domain and an urgent payment demand. Call the hotel yourself to check the booking.
    - 🗂 **email**
      - from: Lumera Hotel <billing@lumera-hotels-pay.example.info>
      - subject: Your booking will be cancelled
      - time: 23:51
      - body: Confirm your card details within 2 hours: / lumera-hotels-pay.example.info/card
  - ✅ safe `room-info`: No link and no request, just information.
    - 🗂 **sms**
      - sender: Lumera Hotel
      - time: 15:03
      - 💬 Welcome! Breakfast is 07:00 to 10:30 on the ground floor.
  - 🛑 threat `passport-chat`: Passports are collected on the official registration page, not in an anonymous chat. A room number reveals where you are.
    - 🗂 **chat**
      - app: telegram
      - contact: Forum Organising Committee
      - 💬 them: Dear delegate, to finish registration, send a photo of your passport and your room number here.

#### scenario · `conference` · At the Conference
- 🎭 start: `coffee`
  - **[coffee]** Attendee (coffee break) (in-person, 🔊young-man): "Your talk was great! Could you copy the slides to this flash drive?"
    - I politely decline and offer to send them officially → `lobby` — Good choice. The stranger's drive never touches your laptop.
    - I plug the drive into my laptop ⇒ **compromised** — A stranger's drive can carry malware. Your laptop and work data are now at risk.
  - **[lobby]**  (, 🔊-): "That evening he approaches you again in the hotel lobby and asks about your organisation's plans for next year."
    - I talk only about what is already public → `room` — Correct. A pleasant chat can also be a way to collect information.
    - I share details, it is not that secret ⇒ **risky** — Small details add up to a big picture. Keep non-public matters to yourself.
  - **[room]**  (, 🔊-): "You are going out to dinner. Where does the laptop stay?"
    - I take it with me, or switch it off and lock it in the safe ⇒ **safe** — Well done. A device that is off, encrypted and in your control is best protected.
    - On the desk, the screen is locked ⇒ **risky** — A screen lock helps, but anyone entering the room can tamper with the device.

#### recap · `recap`
- ✔ Travel with minimum data, get the device checked on return.
- ✔ VPN on unknown networks, your own charger in public.
- ✔ Never leave devices unattended or plug in strangers' drives.


## Cloud Accounts (`cloud-accounts`) · Data · Medium · 150 XP

### Share With Care (`share-with-care`, 3 dəq)

#### tutor · `intro`
- 🗣 "The cloud is handy: files open from anywhere. But a link shared the wrong way also opens from anywhere." — _talk/-, visual: cloud_
- 🗣 "When you create a link, check three things: who can open it, whether they can edit, and until when it stays open." — _think/-, visual: folder_
- 🗣 "Sometimes there is no password at all, just allow the app. One tap can hand the attacker a key to your account." — _alert/-, visual: artifact_, highlight `grant`
  - 🗂 **email**
    - from: DocuSfera <no-reply@docusfera-share.example.net>
    - subject: Leyla Guliyeva shared a document with you
    - time: 10:41
    - body: Document: Quarterly budget, final / **To open it, allow the DocuSfera Viewer app to access your account.**⟨grant⟩
- 🗣 "If you allowed it, changing your password may not be enough. Ask technical support to revoke the app at once." — _alert/recite, visual: key_

#### hotspot · `consent-prompt`
- 🔍 Find what this app asks for beyond its job. (ən azı 3)
  - 🗂 **permission**
    - app: PDF Merger Pro
    - permissions: See your name and email address, **Read, send and delete your emails**⟨mail⟩ ✗lazımsız, **Full access to all your files**⟨files⟩ ✗lazımsız, **Manage your contacts**⟨contacts⟩ ✗lazımsız, **Keep access even when you are not using it**⟨offline⟩ ✗lazımsız
  - ⟨mail⟩ **Full mailbox access**: Merging PDFs does not need your mail. With this, someone can send emails in your name.
  - ⟨files⟩ **All files**: The app needs only the file you pick, not your whole cloud.
  - ⟨contacts⟩ **Contacts**: Your contact list becomes the target list for the next phishing wave.
  - ⟨offline⟩ **Standing access**: The app can keep getting in after you leave. Changing your password does not always cut this off.

#### choice · `link-settings`
- ❓ You send a report to two colleagues to read. Which link?
  - ❌ Anyone with the link, can edit — If the link leaks, anyone can open and change the file.
  - ✅ Only the two colleagues, view only, with an expiry date — Correct. Minimum access, minimum risk.
  - ❌ Everyone in the organisation, can edit — Hundreds of people who do not need it could open and change it.
- 💡 Give the least access: named people, only the rights they need, and an end date.

#### swipe · `cloud-cards`
- 👉 Is this share safe or risky?
  - ✅ safe `expected-share`: A known colleague, an expected file, the service's own domain. Still check the address bar when it opens.
    - 🗂 **email**
      - from: DocuSfera <no-reply@docusfera.example>
      - subject: Samir Babayev shared the file Quarterly report with you
      - time: 09:15
      - body: Samir: here is the report we discussed yesterday.
  - 🛑 threat `salary-files`: Wrong domain, a tempting topic, time pressure and a password request. A classic trap.
    - 🗂 **email**
      - from: DocuSfera <share@docusfera-files.example.info>
      - subject: 3 files sent to you: Salary increase 2027.pdf
      - time: 16:58
      - body: Files will be deleted in 24 hours. Confirm your email password to view them.
  - 🛑 threat `open-link`: This link lets anyone edit. Change the access level before you send it.
    - 🗂 **url**
      - url: https://docusfera.example/s/Hx82kQ?access=anyone&role=editor
  - 🛑 threat `personal-cloud`: A personal cloud is outside your organisation's control. Keep work files only in the approved service.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Gunay (team)
      - 💬 them: I uploaded the documents to my personal cloud so I can work from home.
  - ✅ safe `cleanup-notice`: Correct address, no link, no request. This is a useful clean-up.
    - 🗂 **email**
      - from: Technical support <it-support@idare.example>
      - subject: Old open links will be closed
      - time: 11:00
      - body: On Friday, open links older than 90 days will close automatically. No action is needed from you.

#### match · `access-levels`
- 🔗 Match each access level to what it means.
  - Viewer ⇄ Can only read
  - Commenter ⇄ Reads and leaves notes
  - Editor ⇄ Can change the file
  - Anyone with the link ⇄ Outsiders can open it too
- 💡 Edit rights nobody needs raise the risk of mistakes or harmful changes.

#### recap · `recap`
- ✔ Share links with named people and only the rights needed.
- ✔ Never let an unknown app into your account.
- ✔ Keep work files out of personal clouds.


## Threats to Leaders (`executive-threats`) · AI threats · Hard · 350 XP

### Leading Securely (`lead-securely`, 4 dəq)

#### tutor · `intro`
- 🗣 "Attackers pick leaders on purpose. One signature or one call from you can move large sums and big decisions." — _think/wave, visual: ceo_
- 🗣 "This is called whaling. The email is tailored to your role and speeches, so it looks very convincing." — _alert/point-left, visual: artifact_, highlight `public-info`
  - 🗂 **email**
    - from: International Cooperation Fund <director@**intl-cooperation-fund.example.net**⟨domain⟩>
    - to: Anar Hasanov
    - subject: For you personally: keynote invitation
    - time: 08:05
    - body: Dear Mr Hasanov, / **We watched your TV interview last week and would like you as our keynote speaker.**⟨public-info⟩ / To see the programme, sign in with your work account: **forum-portal.example.net/login**⟨login-link⟩ / **The invitation is confidential, please do not share it with your assistant.**⟨bypass⟩
- 🗣 "Artificial intelligence can copy your voice from a short recording. A call from you to your deputy may be fake." — _alert/lean-in, visual: deepfake_
- 🗣 "Your assistant is a target too. Agree that money or data requests are checked on a second channel, even from you." — _talk/shield-up, visual: handshake_

#### hotspot · `whaling-email`
- 🔍 Find the signs of a whaling email. (ən azı 3)
  - 🗂 **email**
    - from: International Cooperation Fund <director@**intl-cooperation-fund.example.net**⟨domain⟩>
    - to: Anar Hasanov
    - subject: For you personally: keynote invitation
    - time: 08:05
    - body: Dear Mr Hasanov, / **We watched your TV interview last week and would like you as our keynote speaker.**⟨public-info⟩ / To see the programme, sign in with your work account: **forum-portal.example.net/login**⟨login-link⟩ / **The invitation is confidential, please do not share it with your assistant.**⟨bypass⟩
  - ⟨domain⟩ **Unknown domain**: Anyone can register an official-sounding name. Look the organisation up yourself and check.
  - ⟨public-info⟩ **Trust built on public info**: Your interview is public. Mentioning it does not prove they know you.
  - ⟨login-link⟩ **Work account sign-in**: You do not need a work password to read an invitation. This is meant to steal a leader's account.
  - ⟨bypass⟩ **Cut out the assistant**: Your assistant is your line of checks. Be wary of any email that wants them left out.

#### scenario · `voice-call` · A Familiar Voice
- 🎭 start: `call`
  - **[call]** The minister's voice (20:00) (phone, 🔊older-man): "Approve the payment to our partner tonight, I will send the papers later."
    - I hang up and call the minister's known number myself → `check` — Right. A voice can be faked, a known number is a reliable check.
    - The voice is familiar, I approve the payment ⇒ **compromised** — A familiar voice is no longer proof. The money went to a fraudster's account.
  - **[check]** The minister's assistant (phone, 🔊man-3): "The minister is on a plane and has called no one."
    - I report it to security at once and warn finance → `morning` — Correct. The attacker may now try another colleague.
    - Nothing, I did not pay anyway ⇒ **risky** — You were safe, but your deputy may be next. Reporting protects everyone.
  - **[morning]**  (, 🔊-): "In the morning your team asks: how do we talk about this?"
    - I speak openly and confirm the check rule for everyone ⇒ **safe** — Excellent. When the leader talks openly, the team takes the rule seriously.
    - We keep it quiet, it hurts our reputation ⇒ **risky** — Silence leaves others unprotected. Openness builds trust.

#### swipe · `assistant-requests`
- 👉 Is this request to your assistant safe?
  - 🛑 threat `gift-cards`: Gift card codes are like cash and cannot be recovered. Avoiding a call is another sign.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Anar Hasanov (director)
      - 💬 them: I am in a meeting, cannot call. Buy 10 gift cards today and send photos of the codes here.
  - ✅ safe `agenda`: Correct domain, expected topic, no request for money or data.
    - 🗂 **email** (brand `idare`)
      - from: Anar Hasanov <a.hasanov@idare.example>
      - subject: Agenda for tomorrow's meeting
      - time: 17:30
      - body: The agenda is attached. The meeting is on the third floor.
      - attachments: {"name": [{"text": "Gundelik.pdf"}], "size": "96 KB"}
  - 🛑 threat `calendar`: A leader's calendar reveals where they will be. Check a new number through a known channel.
    - 🗂 **sms**
      - sender: +994 55 000 19 04
      - time: 21:48
      - 💬 It is your director, new number. Send me my calendar and where tomorrow's meetings are.
  - ✅ safe `second-signature`: The request runs through the official system and needs a second signature. That is the right process.
    - 🗂 **chat** (brand `idare-maliyye`)
      - app: generic
      - contact: Finance · internal system
      - 💬 them: The payment request was created in the internal system and awaits a second signature, as the rules require.

#### simulation · `evening-payment` · An evening payment
- 🖥 mühit: `desktop` — It is 19:52. An urgent payment is waiting for your approval in the finance system.
  - **step `approve`** — 🗣 "Look at the payee and the note."
    - 🗂 **dialog** (brand `idare-maliyye`)
      - tone: app
      - title: Payment approval: 48,000 AZN
      - body: Payee: Qafqaz Terefdash LLC, new bank account / Note: the minister asked by phone, pay tonight, documents later.
      - buttons: Hold, Approve
    - ✅ [verify] Hold and verify — Correct. An urgent payment to a new account is always checked on a channel you know.
    - 💀 [allow] Approve — A new account, urgency and documents later are signs of fraud. The money went to a fake account.
  - **step `which-number`**
    - 🗂 **dialog** (brand `idare-maliyye`)
      - tone: app
      - title: How do you verify the instruction?
      - body: The note gives a contact number: +994 50 000 71 30
      - buttons: Number in note, Number I know
    - ✅ [call-back] Call the minister's assistant on the number I know — Correct. A number you already know exposes a fake instruction at once.
    - 💀 [call-back] Call the number in the note — The number in the note belongs to the attacker, who will "confirm" the order.
  - **step `confirmed-fake`**
    - 🗂 **dialog** (brand `it-tehlukesizlik`)
      - tone: system
      - title: The instruction was fake
      - body: The assistant says the minister gave no such order.
      - buttons: Cancel, Report
    - ✅ [report] Report to the security team — Excellent. The attacker will try another signatory next, your report warns everyone.
    - ⚠️ [cancel] Cancel the payment and move on — Stopping it is good, but the attacker will try someone else. Report it.

#### choice · `first-hour`
- ❓ What should a leader do in the first hour of an incident?
  - ✅ Bring in the security team at once — Correct. The sooner specialists start, the less damage.
  - ✅ Pick a way to talk outside work email — Correct. The attacker may be reading email, so use phones or a separate channel.
  - ✅ Approve isolating systems as soon as specialists advise it — Correct. A fast decision from the top stops the spread.
  - ❌ Hide the incident to protect reputation — Hiding it causes bigger harm later and can break reporting obligations.
  - ❌ Answer the ransom demand quickly — Any contact with attackers is decided together with specialists and lawyers.
- 💡 In the first hour a leader speeds up decisions and backs the team.

#### order · `payment-check`
- 🔢 Check an urgent payment request in the right order.
  1. Pause the request
  2. Call back on a number you know
  3. Get a second person's approval
  4. Only then carry it out
- 💡 Urgency is the attacker's main weapon. A few minutes of checking prevent a big loss.

#### recap · `recap`
- ✔ However senior the request, check it on a second channel.
- ✔ Agree the check rule with your assistant in advance.
- ✔ In an incident, decide calmly, openly and fast.

### Whaling (`whaling-board`, 3 dəq)

#### tutor · `intro`
- 🗣 "A fake leader email often comes in the name of a deputy minister or the board secretariat." — _talk/wave, visual: ceo_
- 🗣 "The name is familiar, but check the address: the domain is not yours, a word or letter differs." — _alert/point-left, visual: artifact_, highlight `domain`
  - 🗂 **email** (brand `idare-fake`)
    - from: Saadat Mammadli <r.mammadli@**idare-gov.example.net**⟨domain⟩>
    - subject: Confidential: must be done today
    - time: 09:12
    - body: Hello. **I am in a meeting and cannot call.**⟨no-call⟩ / An advance payment to a partner must go out today, the details are attached. / **This is confidential, do not discuss it with anyone.**⟨secret⟩ / Saadat Mammadli, Deputy Minister
    - attachments: {"name": [{"text": "Rekvizitler.pdf"}], "size": "88 KB"}
- 🗣 "Urgency, secrecy and "I cannot call" are there to keep you from checking." — _think/lean-in, visual: artifact_, highlight `no-call`
  - 🗂 **email** (brand `idare-fake`)
    - from: Saadat Mammadli <r.mammadli@**idare-gov.example.net**⟨domain⟩>
    - subject: Confidential: must be done today
    - time: 09:12
    - body: Hello. **I am in a meeting and cannot call.**⟨no-call⟩ / An advance payment to a partner must go out today, the details are attached. / **This is confidential, do not discuss it with anyone.**⟨secret⟩ / Saadat Mammadli, Deputy Minister
    - attachments: {"name": [{"text": "Rekvizitler.pdf"}], "size": "88 KB"}
- 🗣 "The rule is simple: check a senior request on a number you know or in person, never by reply." — _happy/shield-up, visual: handshake_

#### simulation · `board-inbox` · Leadership mail
- 🖥 mühit: `inbox` — Four emails from leadership are in your inbox. Open each: which are real and which are fake?
  - **step `fake-deputy`** — 🗣 "Read the domain to the end."
    - 🗂 **email** (brand `idare-fake`)
      - from: Saadat Mammadli <r.mammadli@**idare-gov.example.net**⟨domain⟩>
      - subject: Confidential: must be done today
      - time: 09:12
      - body: Hello. **I am in a meeting and cannot call.**⟨no-call⟩ / An advance payment to a partner must go out today, the details are attached. / **This is confidential, do not discuss it with anyone.**⟨secret⟩ / Saadat Mammadli, Deputy Minister
      - attachments: {"name": [{"text": "Rekvizitler.pdf"}], "size": "88 KB"}
    - ✅ [report] Report as phishing — Correct. The domain is not yours, plus urgency, secrecy and avoiding a call.
    - 💀 [reply] Reply: on it — Your reply goes straight to the attacker. Always check a money request on a number you know.
    - ⚠️ [open-attachment] Open the attachment — The attachment may hold malware or fake bank details. Check the sender first.
  - **step `real-deputy`**
    - 🗂 **email** (brand `idare`)
      - from: Saadat Mammadli <r.mammadli@idare.example>
      - subject: Friday's board meeting
      - time: 10:05
      - body: Dear colleagues, the board meeting is on Friday at 11:00. / The agenda is in the internal document system. Send your slides by Thursday.
    - ✅ [mark-safe] Mark as safe — Correct: your domain, an expected topic, no money or password request.
    - ✅ [reply] Reply — It is an ordinary work email, replying is safe.
    - ⚠️ [report] Report as phishing — Caution is good, but this one is real: your domain and nothing is asked.
  - **step `fake-board`**
    - 🗂 **email** (brand `idare-fake`)
      - from: Board secretariat <katiblik@board-idare.example.net>
      - subject: Vote by 18:00 today
      - time: 11:30
      - body: Dear board member, please vote on an urgent draft decision. / Sign in with your work account: board-idare.example.net/sesverme → `https://board-idare.example.net/sesverme`
    - ✅ [report] Report as phishing — Correct. The domain is not yours and an outside site wants your work password.
    - 💀 [click-link] Open the link — This is a fake portal that steals work passwords. Real votes happen in the internal system.
    - ⚠️ [forward] Forward to my assistant — Forwarding passes the danger to your assistant. Report it as phishing.
  - **step `assistant-schedule`**
    - 🗂 **email** (brand `idare`)
      - from: Səbinə Əliyeva <s.aliyeva@idare.example>
      - subject: Tomorrow's schedule
      - time: 12:10
      - body: Tomorrow's schedule is attached. The 15:00 meeting moved to the second floor.
      - attachments: {"name": [{"text": "Cedvel.pdf"}], "size": "64 KB"}
    - ✅ [open-attachment] Open the attachment — Correct. An expected sender, your domain and an ordinary PDF.
    - ⚠️ [report] Report as phishing — This is your assistant's routine email. Doubting everything slows work down.

#### choice · `verify-right-way`
- ❓ A money request came from the deputy. How do you check it?
  - ❌ I call the number in the email — That number is the attacker's, and he will say "yes".
  - ❌ I reply to the email and ask — The reply goes to the attacker, who will confirm the request.
  - ✅ I call the number in the phone book or ask the assistant — Correct. A channel you know is not under the attacker's control.
- 💡 Always check outside the email, on a channel you know.

#### match · `red-flags`
- 🔗 Match each sign with what it means.
  - An outside domain ⇄ The email is not from your organisation
  - "Tell nobody" ⇄ Cuts you off from checking
  - "I cannot call" ⇄ Avoids a voice check
  - "By 18:00 today" ⇄ Leaves no time to think
- 💡 One sign is enough to stop and check.

#### swipe · `board-swipe`
- 👉 Real or fake request?
  - 🛑 threat `new-number`: A new number and a demand for secrecy. Call the old number to check.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Saadat Mammadli (new number)
      - 💬 them: This is my new number. I am in a meeting, do not tell my assistant, I have a task for you.
  - ✅ safe `doc-system`: No link, it sends you to the official portal. An expected workflow.
    - 🗂 **email** (brand `idare`)
      - from: Internal document system <edoc@idare.example>
      - subject: A protocol awaits your signature
      - time: 15:20
      - body: The board protocol awaits your signature. Sign in through the organisation's portal.
  - 🛑 threat `fake-protocol`: The domain is not yours and there is an urgent link. Report it as phishing.
    - 🗂 **email** (brand `idare-fake`)
      - from: Board secretariat <kollegiya@idare-gov.example.net>
      - subject: Sign the protocol urgently
      - time: 16:45
      - body: Sign the protocol today: idare-gov.example.net/imza → `https://idare-gov.example.net/imza`

#### recap · `recap`
- ✔ A leader's name is no proof, check the domain and the request.
- ✔ Confirm money and password requests on a channel you know.
- ✔ Do not reply to a fake email, report it.

### A leader's fake voice (`deepfake-voice`, 3 dəq)

#### tutor · `intro`
- 🗣 "Artificial intelligence can copy a leader's voice from a short recording. Speeches and interviews are enough." — _alert/lean-in, visual: deepfake_
- 🗣 "The name and number on screen can be faked too. A familiar-looking call is not proof." — _think/point-left, visual: artifact_, highlight `number`
  - 🗂 **call**
    - caller: Saadat Mammadli
    - number: **+994 50 000 47 12**⟨number⟩
    - label: Mobile
- 🗣 "Agree a check phrase in advance. If the caller does not know it, end the call." — _talk/shield-up, visual: handshake_
- 🗣 "The safest way: hang up and call the person yourself on the number you know." — _happy/recite, visual: mfa-phone_

#### simulation · `cloned-call` · The deputy's voice
- 🖥 mühit: `call` — It is eight in the evening. Your phone rings and the deputy's name is on the screen.
  - **step `ring`**
    - 🗂 **call**
      - caller: Saadat Mammadli
      - number: +994 50 000 47 12
      - label: Mobile
      - voice: older-woman
    - ✅ [answer] Answer — Answering is not dangerous. What matters is what you do next.
    - ✅ [decline] Decline — That works too. If you are worried, call the deputy yourself on the number you know. → `after`
  - **step `request`** — 🗣 "Hi, it is me, Saadat. I am ill and hoarse. Transfer seventy-five thousand manat to a partner tonight, urgently."
    - 🗂 **call**
      - caller: Saadat Mammadli
      - number: +994 50 000 47 12
      - label: Mobile
      - voice: older-woman
    - ✅ [verify] Please say our check phrase — Correct. A phrase you agreed on is a stronger check than a voice.
    - 💀 [allow] All right, I will transfer now — A familiar voice is no longer proof. This one was made by artificial intelligence and the money is gone.
    - ✅ [hang-up] Hang up, I will call back myself — Good call. Now ring the deputy on the number you know. → `after`
  - **step `pressure`** — 🗣 "What phrase? I have no time, the minister is waiting! I will send the papers tomorrow, transfer it now."
    - 🗂 **call**
      - caller: Saadat Mammadli
      - number: +994 50 000 47 12
      - label: Mobile
      - voice: older-woman
    - ✅ [hang-up] Hang up — Correct. A caller who does not know the phrase and pushes you is fake.
    - 💀 [allow] All right, I will transfer — Pressure is a sign of dodging the check. The money may never come back.
    - ⚠️ [reply] Send me the account number — Keeping the talk going gives the attacker more chances. Hang up.
  - **step `after`** · The call has ended. What now?
    - 🗂 **call**
      - caller: Saadat Mammadli
      - number: +994 50 000 47 12
      - label: Mobile
      - voice: older-woman
    - ✅ [call-back] Call the deputy's number from the phone book — Correct. A number you dial yourself exposes the fake call at once.
    - ✅ [report] Report to the security team — Excellent. Your report warns finance and colleagues about the same call.
    - ⚠️ [ignore] Do nothing — The attacker may now call another colleague. Check and report.

#### choice · `check-phrase`
- ❓ Which makes a good check phrase?
  - ✅ A word written nowhere that only we two know — Correct. A word that is not online cannot be copied.
  - ❌ The deputy's date of birth — A date of birth can be found online.
  - ❌ The organisation's name and room number — Many people know this, so it is no check.
- 💡 Agree the phrase in person and never send it by email or message.

#### match · `voice-signs`
- 🔗 Match each fact with what it means.
  - The voice is familiar ⇄ No proof, it can be copied
  - A familiar name on screen ⇄ The number can be faked too
  - Urgent and secret ⇄ An attempt to skip the check
  - The check phrase is right ⇄ The most reliable voice check
- 💡 Trust the agreed rule, not the voice or the name on screen.

#### scenario · `video-call` · A video call
- 🎭 start: `screen`
  - **[screen]** The minister (video call, the sound breaks up) (video, 🔊older-man): "Send the partner the advance tonight."
    - I end the call and ring the assistant on the number I know → `assistant` — Correct. Video can be faked too, a second channel is still the rule.
    - I can see his face, so it is real ⇒ **compromised** — Artificial intelligence can fake video as well. A picture alone is no proof.
  - **[assistant]** The minister's assistant (phone, 🔊man-3): "The minister is travelling and called nobody."
    - I report to the security team and note the time and account name ⇒ **safe** — Excellent. These notes help specialists trace the attack.
    - No money left, so I tell nobody ⇒ **risky** — The next target may be the deputy or finance. Reporting protects everyone.

#### recap · `recap`
- ✔ A familiar voice, face or name is no proof.
- ✔ Ask for the check phrase, hang up and call back yourself.
- ✔ Report a fake call to the security team at once.


## Admin Risks (`it-admin-risks`) · Accounts · Hard · 200 XP

### Admin Hygiene (`admin-hygiene`, 4 dəq)

#### tutor · `intro`
- 🗣 "An admin account is the key attackers want most. With a single admin account they can reach the whole network." — _think/-, visual: key_
- 🗣 "Use a normal account for daily work and a separate one for administration. Never read email or browse as admin." — _talk/recite, visual: badge-id_
- 🗣 "Keep passwords and keys out of code, chats and tickets. They linger there for years. Use a secrets vault instead." — _alert/-, visual: artifact_, highlight `secret`
  - 🗂 **chat**
    - app: telegram
    - contact: Infrastructure team · 46 members
    - 💬 them: Connect to the database like this for testing: **DB_PASSWORD=Pr0d!Baza2026**⟨secret⟩
- 🗣 "Fake support callers often ask you to install a remote-control tool. Then they open the system with your hands." — _alert/-, visual: artifact_
  - 🗂 **call**
    - caller: Vendor support
    - number: +994 12 000 01 23
    - label: Unknown
- 🗣 "For admin panels, remote access and cloud consoles, turn on phishing-resistant multi-factor sign-in, such as a physical security key." — _happy/-, visual: mfa-phone_

#### hotspot · `admin-phish`
- 🔍 Find the signs of phishing aimed at admins. (ən azı 3)
  - 🗂 **email**
    - from: Cloud Console Notice <alerts@**cloudconsole-admin.example.info**⟨domain⟩>
    - to: admin@idare.example
    - subject: **Critical: your admin account will be suspended in 2 hours**⟨urgency⟩
    - time: 06:12
    - body: Dear administrator, / Re-register multi-factor sign-in for your tenant. / Sign in to the console: **console-login.example.info/admin**⟨link⟩ / **Then read the confirmation code to the support agent who calls you.**⟨code-share⟩
  - ⟨domain⟩ **Wrong domain**: Provider notices come from the provider's own domain. Always open the console from your own bookmark.
  - ⟨urgency⟩ **Suspension threat**: A two-hour deadline is there to leave no time to check.
  - ⟨link⟩ **Fake sign-in page**: This page can relay your password and code in real time. Ordinary codes do not stop that.
  - ⟨code-share⟩ **Reading a code to someone**: Real support never asks for your confirmation code. Saying it hands over the account.

#### choice · `remote-support`
- ❓ Vendor support calls and wants remote access to a server. What do you do?
  - ✅ I hang up and call the number in the contract — Correct. Verify through a channel you know, then grant access only through the approved tool.
  - ❌ I install the tool they name and read out the code — That gives the caller full access to the system. Remote-control tools are abused in attacks exactly this way.
  - ❌ I allow it but watch the screen — Watching is not enough. A backdoor takes seconds to plant.
- 💡 An unexpected remote access request is always verified on a known channel and granted only through the approved tool.

#### swipe · `secrets`
- 👉 Is this a safe practice?
  - 🛑 threat `ticket-password`: Many people see tickets and they stay in the archive. Rotate the password and move it to the vault.
    - 🗂 **chat**
      - app: generic
      - contact: Ticket 4821
      - 💬 them: I put the server password in the comments so the next shift can see it.
  - ✅ safe `vault-share`: The key itself is not in the chat, only access in the vault. That is the right way.
    - 🗂 **chat**
      - app: telegram
      - contact: DevOps group
      - 💬 me: I added the key to the secrets vault and gave you read access.
  - 🛑 threat `env-in-repo`: The .env file was committed to the repository. Keys stay in history, so deleting the file is not enough. Rotate them now.
    - 🗂 **url**
      - url: https://git.idare.example/infra/deploy/-/blob/main/.env
  - ✅ safe `keys-issued`: No link, nothing to download or type, the key is handed over in person. This change makes you safer.
    - 🗂 **email**
      - from: Security team <security@idare.example>
      - subject: Security keys for admin accounts
      - time: 15:00
      - body: From Monday, admin panel sign-in requires a physical key. Collect yours in person from room 305.
  - 🛑 threat `shared-admin`: With a shared admin account no one can tell who did what. The stand-in should get temporary rights on their own account.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Kamran (network)
      - 💬 them: I am off on holiday, here is my admin password, use it if needed.

#### match · `right-account`
- 🔗 Match each task to the right account.
  - Reading email ⇄ Normal daily account
  - Server configuration ⇄ Separate admin account
  - Automated script ⇄ Least-privilege service account
  - Emergency access ⇄ Vaulted, monitored account
- 💡 Give each task only the rights it needs. The less an admin account is used, the smaller the target.

#### scenario · `night-prompt` · Night Prompt
- 🎭 start: `prompt`
  - **[prompt]**  (, 🔊-): "It is 02:00. Your phone shows a sign-in approval request for your admin account, and you were asleep."
    - I deny it and alert the security team → `reuse` — Right. An unexpected prompt means someone knows your password.
    - I approve it so the prompts stop ⇒ **compromised** — The attacker is in the admin panel. This is called a push bombing attack.
  - **[reuse]** Security team (phone, 🔊man-3): "Have you used this password anywhere else?"
    - Yes, on a personal account too. I will change both → `harden` — An honest answer. Passwords leaked from other sites are often tried exactly like this.
    - I am embarrassed and say nothing ⇒ **risky** — The team cannot find the source of the leak. Honesty speeds up the investigation.
  - **[harden]**  (, 🔊-): "The password is changed. What is next?"
    - I end active sessions and move the account to a physical key ⇒ **safe** — Excellent. Ending sessions cuts any open access, and a physical key resists phishing.
    - All good, I get back to work ⇒ **risky** — Open sessions and tokens may still be alive. Close them too.

#### recap · `recap`
- ✔ Admin work on an admin account, daily work on a normal one.
- ✔ Keep secrets out of code and chats, rotate any leak at once.
- ✔ Verify unexpected remote access requests on a known channel.


## Official information (`official-information`) · Data · Medium · 350 XP

### Classification labels (`classification-labels`, 3 dəq)

#### tutor · `l1-tutor`
- 🗣 "The label on an official document says who may see it. Let us learn to read these marks." — _talk/wave, visual: folder_
- 🗣 "The label sits in the subject, at the top or in the file name. Pause before you share." — _think/point-left, visual: artifact_, highlight `label`
  - 🗂 **email** (brand `idare`)
    - from: Finance Department <maliyye@idare.example>
    - subject: **FOR OFFICIAL USE ONLY**⟨label⟩: 2027 draft budget
    - time: 09:20
    - body: This draft is for heads of department only. Do not send it to anyone else.
    - attachments: {"name": [{"text": "Budce_layihesi_2027.xlsx"}], "size": "84 KB"}
- 🗣 "The core rule is need to know: only people who truly need the document for their work see it." — _alert/lean-in, visual: eye_
- 🗣 "Rank, friendship or curiosity is not a reason. Even without a label, citizens' data stays protected." — _talk/shake, visual: lock_

#### match · `l1-match`
- 🔗 Match each label with its meaning.
  - Public ⇄ Anyone may see it, for example a notice published on the website
  - For official use only ⇄ Inside the institution, only those who need it for work
  - Confidential ⇄ Only authorised people, under special rules
  - No label, but personal data ⇄ Still protected: citizens' data is not public
- 💡 Label names and rules can differ between institutions. Always follow your own institution's instructions.

#### swipe · `l1-swipe`
- 👉 Can you fulfil this request or not?
  - 🛑 threat `curious-colleague`: Curiosity is not a need. If HR does not work with this document, do not send it.
    - 🗂 **chat** (brand `sohbet`)
      - app: generic
      - contact: Tural (HR)
      - 💬 them: Hi! Send me the draft budget too, just curious whose salary goes up.
  - ✅ safe `manager-report`: Your manager works with this document and asks for the official system. This is normal work.
    - 🗂 **email** (brand `idare`)
      - from: Nərmin Hüseynova <n.huseynova@idare.example>
      - subject: Quarterly report
      - time: 10:05
      - body: Please send me the team's report through SənədAxını, we present it to the ministry tomorrow.
  - 🛑 threat `friend-order`: An unpublished order does not leave the institution. Friendship is not a need to know.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Samir (friend)
      - 💬 them: I hear you are drafting a new order. Snap a photo of the draft, nobody will know.
  - ✅ safe `press-public`: The notice is already public. Public information can be shared.
    - 🗂 **email** (brand `idare`)
      - from: Press office <press@idare.example>
      - subject: Notice text
      - time: 11:30
      - body: Could you send us the text of the notice published on the website yesterday?
  - 🛑 threat `new-employee`: A new employee gets such a list through their manager. Send nothing to an unknown number.
    - 🗂 **chat**
      - app: telegram
      - contact: +994 50 000 41 27
      - 💬 them: Hi, I am new here. Please send me the list of everyone in the department with their phone numbers.

#### simulation · `l1-sim` · Morning requests
- 🖥 mühit: `inbox` — You have four emails. In each one, look at who wants what, then decide.
  - **step `m1`** — 🗣 "Does Tural work with this document?"
    - 🗂 **email** (brand `idare`)
      - from: Tural Qasımov <t.qasimov@idare.example>
      - subject: Draft budget
      - time: 09:05
      - body: Hi! Could you forward me the draft budget from Finance? I just want to have a look.
    - ⚠️ [forward] Forward — Tural does not work with this document. A labelled document goes only to those who need it.
    - ✅ [reply] Reply: manager approval needed — Right. If there is a real need, a manager approves it the official way.
  - **step `m2`**
    - 🗂 **email** (brand `senedaxini`)
      - from: SənədAxını <bildiris@senedaxini.idare.example>
      - subject: New task: Quarterly report
      - time: 09:12
      - body: Nərmin Hüseynova sent you a task. Open SənədAxını to see it.
    - ✅ [mark-safe] Mark as safe — Right. An expected task from the internal system, with no link to click.
    - ⚠️ [report] Report phishing — Not every email is a threat. Sender, address and content are what you expect.
  - **step `m3`**
    - 🗂 **email** (brand `regional-nazirlik-fake`)
      - from: Ministry of Regional Relations <rel.nazirlik@poct-mail.example>
      - subject: Urgent: staff list
      - time: 09:40
      - body: For a joint project, send the names, positions and mobile numbers of your department's staff to this address today.
    - ✅ [report] Report phishing — Right. A ministry does not write from a free mail service, official requests come as letters.
    - 💀 [reply] Send the list — Your colleagues' data went to a scammer. Now each of them can get a targeted email.
  - **step `m4`**
    - 🗂 **email** (brand `idare`)
      - from: Kamran Əliyev <k.aliyev@idare.example>
      - subject: CONFIDENTIAL: Inspection results
      - time: 10:02
      - body: Rəşad, the results are attached.
      - attachments: {"name": [{"text": "Yoxlama_neticeleri.pdf"}], "size": "1.1 MB"}
    - ⚠️ [open-attachment] Open attachment — This email was not meant for you. Opening it out of curiosity is also a leak.
    - ⚠️ [forward] Forward to Rəşad — Kind intent, but you spread the mistake further. The sender should fix it.
    - ✅ [reply] Tell the sender it reached the wrong person — Right. Tell the sender, do not open the attachment, and delete the email as your institution requires.

#### choice · `l1-choice`
- ❓ A friend at another ministry asks for a report labelled "For official use only".
  - ❌ I send it, they are a civil servant too — Being a civil servant is not a need to know. Another institution's request comes as an official letter.
  - ✅ I ask for an official request and tell my manager — Right. Management assesses the official request and the institution answers it.
  - ❌ I do not send it, but I tell them the key figures — The figures are part of the document. Telling them is sharing too.
- 💡 Need to know and permission decide, not the channel. Management decides the official way.

#### recap · `l1-recap`
- ✔ The label says who may see a document: check it before sharing.
- ✔ Show it only to those who need it for work, not out of curiosity or friendship.
- ✔ Do not open a document sent to you by mistake, tell the sender.

### Sharing documents (`sharing-official-documents`, 3 dəq)

#### tutor · `l2-tutor`
- 🗣 "Official documents travel only through official channels: work email or the document management system." — _talk/wave, visual: inbox_
- 🗣 "Personal messengers and personal email are outside the institution's control. A document there can get lost or leak." — _alert/point-left, visual: artifact_, highlight `doc`
  - 🗂 **chat**
    - app: whatsapp
    - contact: Nərmin Hüseynova (personal)
    - 💬 me: **Emr_layihesi_2027.pdf**⟨doc⟩
- 🗣 "Read the recipient before you send. Autocomplete can pick a similar name that belongs to someone else." — _think/point-down, visual: artifact_, highlight `recipient`
  - 🗂 **dialog** (brand `ispoct`)
    - tone: app
    - title: Send now?
    - body: To: **aysel.mamedova@poct-mail.example**⟨recipient⟩ / Attachment: Kadr_siyahisi.xlsx
    - buttons: Cancel, Send
- 🗣 "When in doubt, do not send, ask. If a document went to the wrong place, report it at once." — _happy/recite, visual: shield_

#### hotspot · `l2-hotspot`
- 🔍 Find the mistakes in this email before it is sent. (ən azı 3)
  - 🗂 **dialog** (brand `ispoct`)
    - tone: app
    - title: Ready to send
    - body: To: **rauf.huseynov@poct-mail.example**⟨personal-address⟩ / Cc: **All staff (212 people)**⟨too-many⟩ / Attachment: **Vetendas_muracietleri_FIN.xlsx**⟨personal-data⟩ / Text: If the file does not open, **password: Baki2026**⟨password⟩
    - buttons: Edit, Send
  - ⟨personal-address⟩ **Personal email address**: Official documents go to a work address or the document system. Personal email is outside the institution's control.
  - ⟨too-many⟩ **Copy to everyone**: Not all 212 people need this file. Choose only those who do.
  - ⟨personal-data⟩ **Citizens' ID numbers**: A file with personal data goes only to whoever works with it, ideally staying in the system.
  - ⟨password⟩ **Password in the same email**: Sending the password with the file cancels the protection. Give the password through another channel.

#### simulation · `l2-sim` · Out of the office
- 🖥 mühit: `phone` — You are out of the office and work messages arrive. Choose the right step for each.
  - **step `manager-whatsapp`**
    - 🗂 **chat**
      - app: whatsapp
      - contact: Nərmin Hüseynova
      - 💬 them: Hi, I am out of the office. Send the draft order to my WhatsApp, I will look at it here.
    - ⚠️ [share] Send the file on WhatsApp — In a personal messenger the document leaves the institution's control. Managers have an official channel too.
    - ✅ [reply] I will send it in SənədAxını — Right. The document stays in the official system and your manager can open it there.
  - **step `old-colleague`**
    - 🗂 **chat**
      - app: telegram
      - contact: Nazim (former colleague)
      - 💬 them: Is your new order out? Send me a photo, I will not tell anyone.
    - ✅ [keep-private] You will see it on the website once published — Right. An unpublished document does not leave the institution.
    - 💀 [share] Take a photo and send it — The photo is no longer under your control. It can be spread anywhere.
  - **step `wrong-recipient`** · You meant to write to your colleague Aysel Məmmədova — 🗣 "Look carefully at the recipient's address."
    - 🗂 **notification** (brand `ispoct`)
      - app: İşPoçt
      - title: Email sent
      - body: To: aysel.mamedova@poct-mail.example. Attachment: Kadr_siyahisi.xlsx
      - time: 18:40
    - ✅ [report] Tell your manager and the security team — Right. Reporting fast buys time to limit the damage.
    - ⚠️ [ignore] Nobody will notice, forget it — The file is at an outside address. Hiding it makes the damage worse, reporting protects.

#### choice · `l2-choice`
- ❓ How can you take an official document home to work on it?
  - ❌ I email it to my personal address — Personal email is outside the institution's control. The document stays there and can leak.
  - ❌ I copy it to my own USB stick — USB sticks are easily lost. Do not carry official documents without your institution's permission.
  - ✅ The way the institution allows: work laptop or VPN — Right. The approved route protects the document and keeps it under control.
- 💡 Working from home follows the institution's rules. If there is no approved route, the document stays in the office.

#### scenario · `l2-scenario` · Shared printer
- 🎭 start: `p1`
  - **[p1]**  (, 🔊-): "You sent a confidential report to the shared printer in the corridor. Right then your phone rings."
    - I take the call and go to the printer later → `p2` — The paper sits in the printer and anyone passing by can see it.
    - I collect the paper first → `p2` — Right. If the printer offers PIN release printing, use it.
  - **[p2]**  (, 🔊-): "Someone else's labelled document is also left in the printer."
    - I read it to find out whose it is ⇒ **risky** — There is no need to read it. Hand it to the security team or the head of department.
    - I throw it in the bin ⇒ **risky** — Paper is easy to take from an ordinary bin. Labelled paper is destroyed in a shredder.
    - I hand it, unread, to the security team ⇒ **safe** — Right. The document returns to its owner and nobody reads it.

#### recap · `l2-recap`
- ✔ Official documents go through official channels, not personal messengers or email.
- ✔ Check the recipient and attachment before sending, report mistakes at once.
- ✔ Do not leave labelled paper in the printer or throw it in an ordinary bin.

### Outside requests (`outsider-requests`, 3 dəq)

#### tutor · `l3-tutor`
- 🗣 "Journalists, auditors, other ministries: all may ask for information. Scammers also write in their name." — _talk/wave, visual: handshake_
- 🗣 "In an email from an auditor, check the address. Management announces a real audit in advance." — _think/point-left, visual: artifact_, highlight `domain`
  - 🗂 **email** (brand `etalon-audit-fake`)
    - from: Etalon Audit <yoxlama@**etalon-audit-az.test**⟨domain⟩>
    - subject: Planned audit: documents
    - time: 11:40
    - body: Agreed with your management. Send the HR and finance documents today.
- 🗣 "Urgency, a personal mailbox and the words "do not tell your manager" are serious warning signs." — _alert/lean-in, visual: mask_
- 🗣 "Check the request using a number you already know. Management or the press office gives the answer." — _happy/recite, visual: badge-id_

#### simulation · `l3-sim` · A ministry calls
- 🖥 mühit: `call` — Someone calls claiming to work at another ministry. Read what they say and choose your answer.
  - **step `ring`**
    - 🗂 **call** (brand `regional-nazirlik-fake`)
      - caller: Ministry of Regional Relations
      - number: +994 12 000 36 18
      - label: Ministry
      - voice: man-2
    - ✅ [answer] Answer — Answering is not dangerous. What matters is what you give away.
    - ✅ [decline] Decline — That works too. If needed, call the ministry's official number yourself. → `after`
  - **step `ask`** — 🗣 "Hello, this is Samir Quliyev from the Ministry of Regional Relations. For a joint project we need your department's staff list with mobile numbers."
    - 🗂 **call** (brand `regional-nazirlik-fake`)
      - caller: Ministry of Regional Relations
      - number: +994 12 000 36 18
      - label: Ministry
      - voice: man-2
    - ⚠️ [share] I will send the list — Staff data is not given to someone whose identity you have not checked.
    - ✅ [verify] Please send an official letter — Right. Requests between institutions come as official letters and management answers.
    - ✅ [hang-up] Hang up — Good decision. Now check the request through an official channel. → `after`
  - **step `push`** — 🗣 "There is no time for a letter, the deputy minister wants it today. Send it to my personal email, I will give you the address."
    - 🗂 **call** (brand `regional-nazirlik-fake`)
      - caller: Ministry of Regional Relations
      - number: +994 12 000 36 18
      - label: Ministry
      - voice: man-2
    - 💀 [share] Fine, sending it now — The list went to an unknown address. With it, every colleague can get targeted phishing.
    - ✅ [keep-private] I share nothing without my manager's approval — Right. Pressure and a personal mailbox are the main signs of a scam.
    - ✅ [hang-up] Hang up — Right. When pressure grows, hanging up is the simplest protection. → `after`
  - **step `after`** · The call has ended. What now?
    - 🗂 **call** (brand `regional-nazirlik-fake`)
      - caller: Ministry of Regional Relations
      - number: +994 12 000 36 18
      - label: Ministry
      - voice: man-2
    - ✅ [call-back] Call the number on the ministry's official website — Right. When you find the number yourself, a fake call is exposed at once.
    - ✅ [report] Tell your manager and the security team — Well done. Such calls usually reach several colleagues, a report protects all of them.
    - ⚠️ [ignore] Do nothing — The caller will try another colleague. Reporting protects them too.

#### hotspot · `l3-hotspot`
- 🔍 Find the warning signs in this fake auditor email. (ən azı 3)
  - 🗂 **email** (brand `etalon-audit-fake`)
    - from: Etalon Audit <audit.etalon@**poct-mail.example**⟨free-mail⟩>
    - subject: Planned inspection: **reply today by 17:00**⟨deadline⟩
    - time: 10:12
    - body: Dear colleague, on behalf of the ministry we are auditing your institution. / To review the system remotely, write **your username and password**⟨credentials⟩ in your reply. / **The audit is confidential, do not inform your manager.**⟨secrecy⟩
  - ⟨free-mail⟩ **Free mail address**: An audit firm writes from its own domain. Official inspections do not come from a personal mailbox.
  - ⟨deadline⟩ **Hard deadline**: Urgency is there to make you answer without checking.
  - ⟨credentials⟩ **Password request**: No auditor asks for your password. If access is needed, technical support grants it the official way.
  - ⟨secrecy⟩ **Hiding it from your manager**: A real audit is agreed with management. A demand for secrecy is a sign of fraud.

#### swipe · `l3-swipe`
- 👉 Is this request safe or dangerous?
  - 🛑 threat `journalist-docs`: The press office speaks to journalists for the institution. Do not hand out internal documents yourself.
    - 🗂 **email** (brand `paytaxt-xeber`)
      - from: Leyla Abbasova, Paytaxt Xəbər <l.abbasova@paytaxtxeber.example>
      - subject: Anonymous comment
      - time: 12:15
      - body: We will not print your name. Could you send me a copy of the inspection report?
  - ✅ safe `press-stats`: Your own press office asks for public information. This is a normal workflow.
    - 🗂 **email** (brand `idare`)
      - from: Press office <press@idare.example>
      - subject: Annual statistics
      - time: 12:40
      - body: Please send the latest version of the annual statistics published on the website, we are answering a journalist.
  - ✅ safe `registered-letter`: The request was officially registered and arrived through the internal system. The answer goes the same way.
    - 🗂 **email** (brand `senedaxini`)
      - from: SənədAxını <bildiris@senedaxini.idare.example>
      - subject: Incoming letter No. 1847
      - time: 13:05
      - body: An official request from the Ministry of Regional Relations was registered by the registry office and assigned to you.
  - 🛑 threat `telegram-ministry`: Official documents are not requested by messenger. "The letter will follow" is a pressure trick.
    - 🗂 **chat**
      - app: telegram
      - contact: Kamran | Ministry
      - 💬 them: Hi, drop the draft decision here today, the official letter will follow tomorrow.
  - 🛑 threat `auditor-sms`: No auditor asks for a password. Report such a message to the security team.
    - 🗂 **sms** (brand `etalon-audit-fake`)
      - sender: EtalonAudit
      - time: 14:20
      - 💬 The audit needs system access. Reply to this SMS with your password.

#### choice · `l3-choice`
- ❓ A journalist calls and asks you to comment on an inspection at your institution.
  - ❌ I tell what I know if they leave my name out — An anonymous comment is still the institution's information. Only an authorised person speaks for it.
  - ✅ I politely refer them to the press office — Right. The press office records the request and gives an official answer.
  - ❌ I hang up without a word — Nothing leaks, but the journalist gets no answer. Giving the press office contact is better.
- 💡 The institution answers outside requests, not you personally. First check identity through an official channel.

#### recap · `l3-recap`
- ✔ Check outside requests using an official number you find yourself.
- ✔ Urgency, a personal mailbox and "do not tell your manager" are signs of fraud.
- ✔ Management or the press office answers for the institution.


## Fake authorities (`authority-scams`) · Social engineering · Medium · 250 XP

### Fake notices (`fake-legal-notices`, 3 dəq)

#### tutor · `l1-tutor`
- 🗣 "Criminal case, court summons, tax debt. Words like these frighten people, and scammers count on that." — _talk/wave, visual: alarm_
- 🗣 "Such emails also reach state institution addresses. The attachment often hides malware." — _alert/point-left, visual: artifact_, highlight `archive`
  - 🗂 **email** (brand `istintaq-buro-fake`)
    - from: Central Investigation Bureau <bildiris@istintaq-buro-gov.test>
    - subject: Notice of a criminal case
    - time: 08:47
    - body: Your name appears in a criminal case. The materials are attached.
    - attachments: {"name": [{"text": "Is_materiallari.zip", "spot": "archive"}], "size": "312 KB"}
- 🗣 "Others demand an immediate payment for a debt or fine, through a link." — _think/point-right, visual: artifact_, highlight `pay-link`
  - 🗂 **sms** (brand `vergi-nezaret-fake`)
    - sender: VergiNezaret
    - time: 09:15
    - 💬 Your tax debt is 186.40 AZN. Pay today: **vergi-borc-odenis.test**⟨pay-link⟩
- 🗣 "Check the notice yourself, using the number on the agency's official website or its official portal." — _happy/recite, visual: shield_

#### hotspot · `l1-hotspot`
- 🔍 Find the signs of fraud in this notice. (ən azı 3)
  - 🗂 **email** (brand `istintaq-buro-fake`)
    - from: Central Investigation Bureau <bildiris@**istintaq-buro-gov.test**⟨domain⟩>
    - subject: Notice of criminal case No. 2026/4471
    - time: 08:47
    - body: **Dear citizen,**⟨generic⟩ / you are named as a suspect in a criminal case. **If you do not reply within 24 hours, an arrest order will be issued.**⟨threat⟩ / Open the attachment to read the case materials. / **Do not tell anyone about this email.**⟨secrecy⟩
    - attachments: {"name": [{"text": "Is_materiallari.zip", "spot": "archive"}], "size": "312 KB"}
  - ⟨domain⟩ **Fake domain**: The domain looks official but is not. Open the agency's website yourself and compare.
  - ⟨generic⟩ **Generic greeting**: A real notice addressed to you carries your name, not "dear citizen".
  - ⟨threat⟩ **Arrest threat and 24 hours**: Fear and a short deadline push you to act without thinking.
  - ⟨secrecy⟩ **Do not tell anyone**: They want to cut you off from help. Instead, tell the security team at once.
  - ⟨archive⟩ **Archive file**: An archive can carry malware. Do not open an archive you did not expect.

#### simulation · `l1-sim` · Frightening mail
- 🖥 mühit: `inbox` — Your mailbox has four emails in the name of official bodies. Check each one and decide.
  - **step `m1`** — 🗣 "Look at the sender's domain."
    - 🗂 **email** (brand `istintaq-buro-fake`)
      - from: Central Investigation Bureau <bildiris@istintaq-buro-gov.test>
      - subject: Notice of a criminal case
      - time: 08:47
      - body: Your name appears in a criminal case. Read the attached materials within 24 hours.
      - attachments: {"name": [{"text": "Is_materiallari.zip"}], "size": "312 KB"}
    - ✅ [report] Report phishing — Right. Fake domain, threat and archive: reporting protects your colleagues too.
    - 💀 [open-attachment] Open attachment — The file in the archive launched malware. Disconnect the computer from the network and report it at once.
    - ⚠️ [reply] Reply — A reply tells the scammer your address is live. More threats will follow.
  - **step `m2`**
    - 🗂 **email** (brand `adalet-mehkemesi-fake`)
      - from: Capital Justice Court <cagiris@mehkeme-cagiris.test>
      - subject: Court summons
      - time: 09:30
      - body: You must appear in court tomorrow at 10:00. Download the summons here → `https://mehkeme-cagiris.test/vereqe`.
    - 💀 [click-link] Download summons — The link downloaded a malicious file. The summons should have been checked using the court's official number.
    - ✅ [report] Report phishing — Right. Report a summons from a foreign domain and call the court yourself if needed.
    - ✅ [delete] Delete — Safe. But if you report it, your colleagues are protected too.
  - **step `m3`**
    - 🗂 **email** (brand `vergi-nezaret-fake`)
      - from: Tax Control Centre <info@vergi-borc-odenis.test>
      - subject: Final warning: tax debt 186.40 AZN
      - time: 10:05
      - body: If you do not pay today, your bank accounts will be frozen. Pay online → `https://vergi-borc-odenis.test/pay`
    - 💀 [click-link] Pay online — The fake payment page took your card details. Call your bank now and block the card.
    - ✅ [report] Report phishing — Right. Check any debt only by signing in to the official portal yourself.
  - **step `m4`**
    - 🗂 **email** (brand `idare`)
      - from: Legal Department <huquq@idare.example>
      - subject: Warning: fake court notices
      - time: 10:40
      - body: This week staff are receiving fake "criminal case" emails. Do not open attachments, report such emails as phishing.
    - ✅ [mark-safe] Mark as safe — Right. A warning from your own legal department, with no link or attachment.
    - ⚠️ [report] Report phishing — Not every email is a threat. This is a useful warning from your own institution.

#### choice · `l1-choice`
- ❓ The email says the case will be closed if you pay half the fine today.
  - ❌ I pay so it does not get worse — Official bodies do not "close" cases for a payment by link. The money goes straight to the scammer.
  - ❌ I call the number in the email to ask — That number belongs to the scammer. They will only frighten you more.
  - ✅ I find the agency's number on its official website and call — Right. When you find the contact yourself, a fake notice is exposed at once.
- 💡 Threats, urgency and a payment demand together mean fraud. Report the email to the security team as well.

#### match · `l1-match`
- 🔗 Match each trick with its purpose.
  - Threat of arrest or a criminal case ⇄ Use fear to leave no time to think
  - "Do not tell anyone" ⇄ Keep you from asking for advice
  - "Pay today to close the case" ⇄ Take your money directly
  - An archive or link attached ⇄ Install malware on your computer
- 💡 However serious the threat sounds, the steps are the same: stop, check through an official channel, report.

#### recap · `l1-recap`
- ✔ Threats, urgency and payment demands are signs of a fake notice.
- ✔ Do not open unexpected attachments or links, report the email as phishing.
- ✔ Check a notice yourself using the number on the agency's official website.

### Fake prosecutor call (`fake-prosecutor-call`, 3 dəq)

#### tutor · `l2-tutor`
- 🗣 "A fake email is often followed by a call. The caller claims to be an investigator or a prosecutor." — _talk/wave, visual: mask_
- 🗣 "Even an official looking number on the screen can be fake. Callers can change the number shown." — _think/point-left, visual: artifact_, highlight `number`
  - 🗂 **call** (brand `istintaq-buro-fake`)
    - caller: Central Investigation Bureau
    - number: **+994 12 000 10 02**⟨number⟩
    - label: Work
- 🗣 "Real law enforcement never asks for money, card details or an SMS code by phone." — _alert/shake, visual: lock_
- 🗣 "Hang up, find the agency's official number yourself and tell your security team." — _happy/recite, visual: shield_

#### simulation · `l2-sim` · An investigator calls
- 🖥 mühit: `call` — A fake notice arrived this morning, now someone calls. Read what they say and choose your answer.
  - **step `ring`**
    - 🗂 **call** (brand `istintaq-buro-fake`)
      - caller: Central Investigation Bureau
      - number: +994 12 000 10 02
      - label: Work
      - voice: man
    - ✅ [answer] Answer — Answering is not dangerous. What matters is what you do next.
    - ✅ [decline] Decline — That works too. If you are worried, call the agency's official number yourself. → `after`
  - **step `accuse`** — 🗣 "This is investigator Elçin Həsənov, Central Investigation Bureau. You ignored this morning's notice, and your name appears in a criminal case."
    - 🗂 **call** (brand `istintaq-buro-fake`)
      - caller: Central Investigation Bureau
      - number: +994 12 000 10 02
      - label: Work
      - voice: man
    - ⚠️ [reply] What should I do? Tell me — Going along with fear hands control to the caller. Check who they are first.
    - ✅ [verify] I will call the bureau's official number myself — Right. A real investigator will not object to you checking. → `after`
    - ✅ [hang-up] Hang up — Good decision. You do not have to respond to a threat by phone. → `after`
  - **step `prosecutor`** — 🗣 "I am putting you through to the prosecutor. This is prosecutor Tofiq Abbasov. To protect your savings, move them to a safe account during the check."
    - 🗂 **call** (brand `istintaq-buro-fake`)
      - caller: Central Investigation Bureau
      - number: +994 12 000 10 02
      - label: Work
      - voice: older-man
    - 💀 [share] Give me the account, I will transfer — The "safe account" belongs to the scammer. If you transferred money, call your bank now.
    - ✅ [keep-private] I do not move money over the phone — Right. No prosecutor asks you to move money to another account by phone.
    - ✅ [hang-up] Hang up — Right. Passing you to a "senior official" is meant to raise the pressure. → `after`
  - **step `secrecy`** — 🗣 "This is a secret investigation. If you tell your manager or family, you will be held responsible."
    - 🗂 **call** (brand `istintaq-buro-fake`)
      - caller: Central Investigation Bureau
      - number: +994 12 000 10 02
      - label: Work
      - voice: older-man
    - ⚠️ [reply] All right, I will tell no one — A demand for secrecy cuts you off from help. Speak up at once instead.
    - ✅ [hang-up] Hang up — Right. "Do not tell anyone" is the clearest sign of fraud. → `after`
  - **step `code`** — 🗣 "One last step. Tell me the code that just arrived on your phone so we can register you in the system."
    - 🗂 **call** (brand `istintaq-buro-fake`)
      - caller: Central Investigation Bureau
      - number: +994 12 000 10 02
      - label: Work
      - voice: older-man
    - 💀 [share] I read out the code — The code is a key to your account or a payment. Once you say it, you lose control.
    - ✅ [hang-up] Hang up — Right. No agency asks for an SMS code by phone.
  - **step `after`** · The call has ended. What now?
    - 🗂 **call** (brand `istintaq-buro-fake`)
      - caller: Central Investigation Bureau
      - number: +994 12 000 10 02
      - label: Work
      - voice: older-man
    - ✅ [call-back] Call the number on the bureau's official website — Right. If you can, use another phone so the line cannot be kept open.
    - ✅ [report] Tell your manager and the security team — Well done. A report protects your colleagues from the same call.
    - ⚠️ [ignore] Do nothing — The scammer will call again. Reporting protects you and your colleagues.

#### swipe · `l2-swipe`
- 👉 Is this message safe or a scam?
  - 🛑 threat `fine-card`: Law enforcement does not collect fines to a personal card. Report this message.
    - 🗂 **sms** (brand `istintaq-buro-fake`)
      - sender: +994 70 000 52 19
      - time: 11:02
      - 💬 Central Investigation Bureau: transfer your fine to this card within 2 hours: 4169 **** 7731
  - ✅ safe `legal-dept`: The letter came through the institution's own channel and asks for no money or link.
    - 🗂 **email** (brand `idare`)
      - from: Legal Department <huquq@idare.example>
      - subject: Official letter for you
      - time: 11:20
      - body: An official letter from the court has arrived in your name. You can collect it from the registry office against signature.
  - 🛑 threat `video-id`: An image of your ID can be used to open fake accounts in your name. Such checks are not done by messenger.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Prosecutor T. Abbasov
      - 💬 them: Switch to a video call and show your ID card to the camera, we are running a check.
  - 🛑 threat `safe-account`: There is no "safe account". It belongs to the scammer.
    - 🗂 **call** (brand `istintaq-buro-fake`)
      - caller: Central Investigation Bureau
      - number: +994 12 000 10 02
      - label: Demands you move money to a "safe account"
  - ✅ safe `portal`: No payment and no link. You open the portal yourself to read it.
    - 🗂 **notification** (brand `dovletportal`)
      - app: DövlətPortal
      - title: New notice
      - body: There is a new letter in your personal account.
      - time: 12:10

#### order · `l2-order`
- 🔢 Put the steps after a fake "prosecutor" call in order.
  1. Hang up
  2. Write down the number, the time and what was said
  3. Find the agency's official number yourself and check
  4. Tell your manager and the security team
- 💡 If you transferred money, call your bank first. Your notes help the security team trace the attack.

#### choice · `l2-choice`
- ❓ The caller says: "This is a secret investigation, tell no one." What does it mean?
  - ❌ It is serious, I must keep quiet — Silence is what the scammer wants. If you speak up, the trick is exposed quickly.
  - ✅ They want to keep me from getting help — Right. That is exactly why you tell your manager and the security team at once.
  - ❌ I will tell only my family — Telling family is good, but the security team should also know about a work related call.
- 💡 Secrecy, threats and a money demand together are a known fraud pattern.

#### recap · `l2-recap`
- ✔ An official number on screen can be fake: hang up and check yourself.
- ✔ Law enforcement never asks for money, card details or codes by phone.
- ✔ If told "tell no one", tell the security team at once.


## E-signature (`e-signature-misuse`) · Accounts · Medium · 250 XP

### PINs and codes (`pin-and-codes`, 3 dəq)

#### tutor · `l1-tutor`
- 🗣 "Mobile ID and e-signature are your digital signature. A document signed with your PIN counts as signed by you." — _talk/wave, visual: key_
- 🗣 "Scammers call saying "your certificate is expiring" and ask for your PIN or SMS code." — _alert/point-left, visual: artifact_, highlight `caller-name`
  - 🗂 **call** (brand `mohurid-fake`)
    - caller: **MöhürID Support**⟨caller-name⟩
    - number: +994 12 000 77 40
    - label: Support
- 🗣 "Your PIN and SMS codes are never told to anyone: not support, not colleagues, not your manager." — _think/shake, visual: lock_
- 🗣 "If your certificate needs renewing, you do it yourself on the official website or at a service centre." — _happy/recite, visual: certificate_

#### simulation · `l1-sim` · Certificate call
- 🖥 mühit: `call` — Someone calls claiming to be signature service support. Read what they say and choose your answer.
  - **step `ring`**
    - 🗂 **call** (brand `mohurid-fake`)
      - caller: MöhürID Support
      - number: +994 12 000 77 40
      - label: Support
      - voice: young-man
    - ✅ [answer] Answer — Answering is not dangerous. What matters is what you say.
    - ✅ [decline] Decline — That works too. If you are worried, call the service's official number yourself. → `after`
  - **step `expire`** — 🗣 "Hello, this is MöhürID support. Your mobile signature certificate, excuse me, expires today and will be blocked unless you renew it."
    - 🗂 **call** (brand `mohurid-fake`)
      - caller: MöhürID Support
      - number: +994 12 000 77 40
      - label: Support
      - voice: young-man
    - ⚠️ [reply] How do I renew it? — The caller starts steering the process. Check the certificate date yourself on the official website.
    - ✅ [verify] I will call the official number myself — Right. Find the service's number on its official website yourself. → `after`
    - ✅ [hang-up] Hang up — Good decision. You can end a call that rushes you. → `after`
  - **step `sms-code`** — 🗣 "You will get an SMS for the renewal. Read me the code and I will enter it in the system for you."
    - 🗂 **call** (brand `mohurid-fake`)
      - caller: MöhürID Support
      - number: +994 12 000 77 40
      - label: Support
      - voice: young-man
    - 💀 [share] I read out the code — With this code they sign in as you. A code is for your screen only.
    - ✅ [keep-private] I do not share codes with anyone — Right. Real support never asks for a code.
    - ✅ [hang-up] Hang up — Right. Hang up as soon as a code is requested. → `after`
  - **step `pin-sign`** — 🗣 "The code did not work. A request will now appear on your phone, enter your PIN and confirm it."
    - 🗂 **call** (brand `mohurid-fake`)
      - caller: MöhürID Support
      - number: +994 12 000 77 40
      - label: Support
      - voice: young-man
    - 💀 [share] I enter my PIN and confirm — That was not a renewal, you signed a document they prepared. Call the signature service's official number at once.
    - ✅ [deny] I reject the request — Right. Never confirm a request you did not start yourself.
    - ✅ [hang-up] Hang up — Right. Hang up and reject the request.
  - **step `after`** · The call has ended. What now?
    - 🗂 **call** (brand `mohurid-fake`)
      - caller: MöhürID Support
      - number: +994 12 000 77 40
      - label: Support
      - voice: young-man
    - ✅ [call-back] Call the service's official number — Right. Official support can tell you the real state of your certificate.
    - ✅ [report] Tell the security team — Well done. Such calls usually reach several colleagues.
    - ⚠️ [ignore] Do nothing — The caller will try again. Reporting protects your colleagues.

#### hotspot · `l1-hotspot`
- 🔍 Find the traps in this message. (ən azı 3)
  - 🗂 **sms** (brand `mohurid-fake`)
    - sender: MohurID
    - time: 08:55
    - 💬 Your mobile signature certificate **expires today at 18:00**⟨deadline⟩. To renew, **enter your PIN**⟨pin⟩ at **mohurid-yenile.test**⟨link⟩. **Otherwise your signature will be revoked.**⟨threat⟩
  - ⟨deadline⟩ **Expires today**: Urgency leaves no time to check. You can see the certificate date yourself on the official website.
  - ⟨link⟩ **Unknown address**: This is not the service's official website. Type the official address yourself.
  - ⟨pin⟩ **PIN request**: A PIN is never typed into a website to "renew". It only confirms a sign-in or signature you started.
  - ⟨threat⟩ **Revocation threat**: Scare tactics are a common scam method. If worried, call the official number.

#### swipe · `l1-swipe`
- 👉 Is this message safe or dangerous?
  - ✅ safe `own-code`: A normal message when you sign in yourself. No link, and it reminds you to keep the code secret.
    - 🗂 **sms** (brand `mohurid`)
      - sender: MohurID
      - time: 09:10
      - 💬 Confirmation code: 482913. Do not share this code. If you did not send this request, reject it.
  - 🛑 threat `renew-link`: The link does not go to the service's official website. Open the official site yourself to check.
    - 🗂 **sms** (brand `mohurid-fake`)
      - sender: MohurID
      - time: 09:42
      - 💬 Your certificate is blocked. Restore it here: mohurid-yenile.test
  - 🛑 threat `colleague-pin`: Signing with someone else's PIN means signing in their name. Authority is delegated the official way.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Elvin (Finance)
      - 💬 them: I am on leave. My PIN is 4471, sign these documents for me.
  - ✅ safe `hr-reminder`: No link, PIN or code is requested. You renew yourself through the official route.
    - 🗂 **email** (brand `idare`)
      - from: HR Department <kadr@idare.example>
      - subject: Your certificate expires in 30 days
      - time: 10:15
      - body: To renew, sign in to the signature service's official website yourself or visit a service centre.
  - 🛑 threat `unexpected-request`: You did not start this request. Reject it and tell the security team.
    - 🗂 **notification** (brand `mohurid`)
      - app: MöhürID
      - title: Signature request
      - body: Etibarname_tam_selahiyyet.pdf is waiting for your signature
      - time: 10:31

#### choice · `l1-choice`
- ❓ A colleague off sick asks you to sign an urgent document with their PIN.
  - ❌ I sign it, they gave permission — An e-signature is for its owner alone. Signing with their PIN breaks the rules.
  - ✅ I refuse and ask my manager to delegate authority officially — Right. The institution delegates authority to a stand-in the official way.
  - ❌ I write the PIN down in case I need it — Keeping someone else's PIN is risky too. A PIN stays with its owner.
- 💡 The PIN is the signature itself. You never give it away and never take someone else's.

#### recap · `l1-recap`
- ✔ Never tell anyone your PIN or SMS code, support included.
- ✔ Renew your certificate only on the official website or at a service centre.
- ✔ Reject and report any signature request you did not start.

### Unexpected signing (`unexpected-signing`, 3 dəq)

#### tutor · `l2-tutor`
- 🗣 "When a signature request arrives, first ask yourself: did I start this request?" — _talk/wave, visual: certificate_
- 🗣 "The request shows the document name and the service asking. Reject a request you did not expect." — _think/point-left, visual: artifact_, highlight `doc`
  - 🗂 **notification** (brand `mohurid`)
    - app: MöhürID
    - title: Signature request
    - body: Document: **Etibarname_tam_selahiyyet.pdf**⟨doc⟩. Service: imza-xidmet.test
    - time: 07:58
- 🗣 "Do not sign without reading. The name, amount and recipient must match what you expect." — _alert/recite, visual: eye_
- 🗣 "When in doubt, do not sign, and tell the security team. A signature is hard to take back." — _happy/shield-up, visual: shield_

#### simulation · `l2-sim` · Signature requests
- 🖥 mühit: `phone` — During the day, signature requests arrive on your phone. Check each one and decide.
  - **step `unexpected`** · You were not about to sign anything
    - 🗂 **notification** (brand `mohurid`)
      - app: MöhürID
      - title: Signature request
      - body: Document: Etibarname_avtomobil.pdf. Service: Bulud Notariat
      - time: 07:58
    - 💀 [open] Open and sign — You signed a power of attorney someone else prepared. Call the signature service and the security team at once.
    - ✅ [deny] Reject — Right. A request you did not start means someone is trying to use your name.
    - ✅ [report] Tell the security team — Well done. Rejecting and reporting stops the attack in time.
  - **step `rush-colleague`**
    - 🗂 **chat**
      - app: telegram
      - contact: Elvin (Procurement)
      - 💬 them: I sent you a contract in SənədAxını. No time to read it, just sign quickly, the boss is waiting.
    - ✅ [verify] I read the document first — Right. Being rushed is no reason to skip reading, the signature is your responsibility.
    - ⚠️ [reply] Fine, I sign without reading — An unread document may have a changed amount or recipient.
  - **step `fake-portal-mail`**
    - 🗂 **email** (brand `senedaxini-fake`)
      - from: SənədAxını <noreply@senedaxini-imza.test>
      - subject: Your signature is pending: Qebul_akti.pdf
      - time: 12:05
      - body: To sign the document, sign in → `https://senedaxini-imza.test/login`.
    - 💀 [click-link] Sign in — A fake sign-in page took your password. Change it now and tell the security team.
    - ✅ [report] Report phishing — Right. The domain is not SənədAxını's, open the system yourself.
    - ✅ [delete] Delete — Safe. But if you report it, others are protected too.
  - **step `own-request`** · You just started signing your leave request on the portal
    - 🗂 **notification** (brand `mohurid`)
      - app: MöhürID
      - title: Signature request
      - body: Document: Mezuniyyet_erizesi.pdf. Service: SənədAxını
      - time: 14:30
    - ✅ [open] Open and sign — Right. You started this request and the document and service are what you expect.
    - ⚠️ [deny] Reject — Not needed: the request was yours and everything matches. Checking does not mean rejecting everything.
  - **step `mismatch`** · You ordered an employment certificate on the portal — 🗣 "Compare the document name with what you expect."
    - 🗂 **notification** (brand `mohurid`)
      - app: MöhürID
      - title: Signature request
      - body: Document: Etibarname_bank_hesabi.pdf. Service: imza-xidmet.test
      - time: 16:12
    - 💀 [open] Open and sign — This was a bank power of attorney, not your certificate. If the name does not match, do not sign.
    - ✅ [deny] Reject — Right. Neither the document nor the service is what you expect, so reject and report it.

#### hotspot · `l2-hotspot`
- 🔍 Before signing, find what is wrong with this request. (ən azı 3)
  - 🗂 **dialog** (brand `mohurid`)
    - tone: app
    - title: Confirm signing
    - body: Document: **Power of attorney: full authority over all bank accounts**⟨doc⟩ / In favour of: **Hüseyn Məmmədli**⟨person⟩ / Term: **3 years**⟨term⟩ / Requested by: **imza-xidmet.test**⟨source⟩
    - buttons: Reject, Enter PIN
  - ⟨doc⟩ **Full authority**: This document gives someone wide rights over your accounts. Such a document should never arrive unexpectedly.
  - ⟨person⟩ **Someone you do not know**: If you do not know who receives the authority, do not sign.
  - ⟨term⟩ **Long term**: A three year power of attorney lets the damage go on for a long time.
  - ⟨source⟩ **Unknown service**: The request comes from an unknown website, not an official system you know.

#### order · `l2-order`
- 🔢 Put the steps before signing in order.
  1. Check that you started the request
  2. Open and read the document
  3. Check the name, amount and recipient
  4. Only then enter your PIN
- 💡 If any step does not match, stop and reject. Report a suspicious request to the security team.

#### choice · `l2-choice`
- ❓ You signed a suspicious document by mistake. What is the first step?
  - ❌ I tell no one, maybe nothing happens — The signature is valid and can be used. Hiding it makes the damage worse.
  - ✅ I call the signature service and the security team at once — Right. The service can suspend the certificate, and the security team looks into the consequences.
  - ❌ I only change my PIN — Useful, but the signed document is still valid. Report it first.
- 💡 With a wrong signature, time matters. Reporting fast gives a chance to stop the document being used.

#### recap · `l2-recap`
- ✔ Confirm a signature request only if you started it yourself.
- ✔ Read the document: name, amount and recipient must match what you expect.
- ✔ If you signed by mistake, tell the signature service and the security team at once.


## AI tools safety (`ai-tools-safety`) · AI threats · Medium · 250 XP

### Never paste this (`what-not-to-paste`, 3 dəq)

#### tutor · `l1-tutor`
- 🗣 "AI chatbots speed up work. But whatever you type into a public chatbot leaves the institution." — _talk/wave, visual: cloud_
- 🗣 "Citizens' names, ID numbers, phone numbers and official documents are never pasted into a public chatbot." — _alert/point-left, visual: artifact_, highlight `citizen-data`
  - 🗂 **chat** (brand `neyrosohbet`)
    - app: generic
    - contact: NeyroSöhbət
    - 💬 me: Put these complaints in a table: **Əliyev Samir, ID 5XK2P7L, +994 55 000 18 42**⟨citizen-data⟩
- 🗣 "The service may store what you type, its staff may read it, or it may train its model on it." — _think/shrug, visual: eye_
- 🗣 "If your institution has an approved tool, use it. Even there, type only what is needed." — _happy/recite, visual: shield_

#### swipe · `l1-swipe`
- 👉 Can you type this into a chatbot or not?
  - ✅ safe `polite-letter`: Nothing secret or personal. A chatbot is useful for ordinary text like this.
    - 🗂 **chat** (brand `neyrosohbet`)
      - app: generic
      - contact: NeyroSöhbət
      - 💬 me: Make this sentence more polite: "Dear colleagues, the meeting moves to tomorrow."
  - 🛑 threat `citizen-list`: Citizens' personal data must not leave the institution. Such work belongs only in an approved tool.
    - 🗂 **chat** (brand `neyrosohbet`)
      - app: generic
      - contact: NeyroSöhbət
      - 💬 me: Put these 40 citizen complaints in a table: Məmmədova Günel, ID 7ML3Q2T, Nərimanov district...
  - 🛑 threat `draft-order`: A labelled document is not uploaded to a public service. The label means it stays inside the institution.
    - 🗂 **chat** (brand `neyrosohbet`)
      - app: generic
      - contact: NeyroSöhbət
      - 💬 me: Edit this draft order labelled "For official use only": ...
  - ✅ safe `formula`: A general technical question leaks no information.
    - 🗂 **chat** (brand `neyrosohbet`)
      - app: generic
      - contact: NeyroSöhbət
      - 💬 me: Write an Excel formula that joins two columns.
  - 🛑 threat `password-script`: A password and an internal address are a ready key for an attacker. Remove such lines before pasting.
    - 🗂 **chat** (brand `neyrosohbet`)
      - app: generic
      - contact: NeyroSöhbət
      - 💬 me: My script fails, fix it: server=10.20.4.15, password=Baki2026!
  - ✅ safe `approved-summary`: This is the institution's approved tool. Internal documents can be handled there.
    - 🗂 **chat** (brand `idare-komekci`)
      - app: generic
      - contact: İdarə Köməkçisi
      - 💬 me: Write a short summary of the internal leave policy.

#### simulation · `l1-sim` · Report with a chatbot
- 🖥 mühit: `browser` — You want a chatbot to help with a report. Make the right choice at every step.
  - **step `public-upload`** · Upload your file and we will summarise it — 🗣 "Whose data is in this file?"
    - 🗂 **url** (brand `neyrosohbet`)
      - url: https://neyrosohbet.example/yeni
    - 💀 [share] Upload Vetendas_muracietleri.xlsx — Data on 1,240 citizens went to an outside service. Tell the security team about it at once.
    - ✅ [cancel] Do not upload the file — Right. A file with personal data is never uploaded to a public chatbot.
  - **step `history`**
    - 🗂 **dialog** (brand `neyrosohbet`)
      - tone: system
      - title: Use your chats to train the model?
      - body: Your chat history will be stored on the service's servers.
      - buttons: Decline, Allow
    - ⚠️ [allow] Allow — What you type stays with the service and may be used to train the model.
    - ✅ [deny] Decline — Right. Turning training off helps, but still do not paste official information.
  - **step `approved-tool`** · İdarə Köməkçisi: the institution's approved tool
    - 🗂 **url** (brand `idare-komekci`)
      - url: https://komekci.idare.example
    - ✅ [open] Work on the report here — Right. The approved tool keeps data inside the institution, still upload only what is needed.
    - ⚠️ [click-link] Go back to the public chatbot — The institution has its own tool. Do not handle official information in a public service.
  - **step `answer-check`**
    - 🗂 **dialog** (brand `idare-komekci`)
      - tone: app
      - title: Your answer is ready
      - body: Under Article 14 of the Law, a citizen's request must be answered within 5 days.
      - buttons: Check the source, Copy into reply
    - ✅ [verify] Check the source — Right. A chatbot can be confidently wrong, so check the article and deadline in an official source.
    - ⚠️ [share] Copy it into the reply as is — This article and deadline may be made up. An official reply must not contain unchecked facts.

#### hotspot · `l1-hotspot`
- 🔍 What must be removed from this prompt before sending? (ən azı 3)
  - 🗂 **chat** (brand `neyrosohbet`)
    - app: generic
    - contact: NeyroSöhbət
    - 💬 me: Write a reply to this request. **Citizen: Quliyev Rauf, ID 6TR9K1M**⟨citizen⟩, **tel. +994 50 000 63 27**⟨phone⟩. Basis: **"FOR OFFICIAL USE ONLY: inspection report"**⟨label⟩. My system login: **r.aliyev / Yay2026!**⟨password⟩
  - ⟨citizen⟩ **Name and ID number**: A citizen's identity must not go to a public service. If needed, replace the name with "Citizen A".
  - ⟨phone⟩ **Phone number**: A phone number is personal data too. You do not need it to write a reply.
  - ⟨label⟩ **Labelled text**: Labelled documents are handled only in a system the institution has approved.
  - ⟨password⟩ **Username and password**: A password is never typed into any chatbot. If you did, change it at once.

#### choice · `l1-choice`
- ❓ You want to polish an official letter with a chatbot. What is the best way?
  - ❌ I paste the whole letter into a public chatbot — The names and details in the letter go to an outside service.
  - ✅ I use the approved tool and remove personal data — Right. An approved tool plus minimal data keeps the risk lowest.
  - ❌ I do it after work in a chatbot on my own phone — A different device still sends the data to an outside service.
- 💡 A simple rule: type into a public chatbot only text you could publish openly.

#### recap · `l1-recap`
- ✔ Never type citizens' data, labelled documents or passwords into a public chatbot.
- ✔ Use the institution's approved tool, and type only the minimum there too.
- ✔ Check a chatbot's answer in an official source, do not copy it as is.

### AI-made traps (`ai-lures-fake-apps`, 3 dəq)

#### tutor · `l2-tutor`
- 🗣 "AI helps scammers too: flawless emails, convincing voices, fake apps." — _talk/wave, visual: deepfake_
- 🗣 "A phishing email may no longer have any language mistakes. Check the sender and the request, not the grammar." — _think/point-left, visual: artifact_, highlight `domain`
  - 🗂 **email** (brand `idare-fake`)
    - from: Nərmin Hüseynova <n.huseynova@**idare-mail.test**⟨domain⟩>
    - subject: Data for the report
    - time: 09:10
    - body: Dear colleague, I would like to ask you for a small favour for the report we are submitting to the ministry.
- 🗣 "Free "Pro" chatbot apps and browser extensions can steal your data." — _alert/lean-in, visual: download_
- 🗣 "Install apps and extensions only from a source your institution has approved." — _happy/recite, visual: shield_

#### simulation · `l2-sim` · Free Pro version
- 🖥 mühit: `browser` — An ad offered a free "Pro" chatbot. Check the pages and decide at every step.
  - **step `pro-page`** · NeyroSöhbət Pro: every feature free — 🗣 "Look at the address bar."
    - 🗂 **url** (brand `neyrosohbet-fake`)
      - url: https://neyrosohbet-pro.test (əslində: `neyrosohbet-pro.test`)
    - ⚠️ [install] Install the extension — Installing an extension from an unofficial site is risky. Take extensions only from a source your institution allows.
    - ✅ [cancel] Close the tab — Right. A service's "free Pro" version is not handed out on a foreign site. → `fake-login`
  - **step `extension`**
    - 🗂 **dialog** (brand `neyrosohbet-fake`)
      - tone: system
      - title: Add "NeyroSöhbət Pro"?
      - body: This extension can read and change all your data on every website you visit.
      - buttons: Cancel, Add extension
    - 💀 [install] Add extension — The extension now sees your work email and every page you open. Remove it and tell the security team.
    - ✅ [cancel] Cancel — Right. A chatbot extension does not need to read every website.
  - **step `fake-login`**
    - 🗂 **login** (brand `neyrosohbet-fake`)
      - brand: NeyroSöhbət
      - url: https://neyrosohbet.login-pro.test (əslində: `login-pro.test`)
      - fields: Work email, Password
      - button: Sign in
    - 💀 [enter-credentials] Sign in — Your work password went to a scammer. Change it now and report it.
    - ✅ [cancel] Close the tab — Right. The address is not the service's own domain.
    - ✅ [report] Report the site — Well done. Reporting a fake site protects others too.
  - **step `setup-file`**
    - 🗂 **file** (brand `zeka-foto`)
      - name: ZekaFoto_AI_Setup.exe
      - type: exe
      - size: 48 MB
      - source: zeka-foto-free.test
    - 💀 [open-attachment] Open — The program is not from an official source and may be malicious. Technical support installs programs on work computers.
    - ✅ [delete] Delete — Right. Free "AI" programs are a very common disguise for malware.

#### hotspot · `l2-hotspot`
- 🔍 Find the traps in this email with flawless language. (ən azı 3)
  - 🗂 **email** (brand `idare-fake`)
    - from: Nərmin Hüseynova <n.huseynova@**idare-mail.test**⟨domain⟩>
    - subject: Urgent: **today by 15:00**⟨deadline⟩
    - time: 09:10
    - body: Dear colleague, we are preparing a report for the ministry. / **Upload the ID numbers and phone numbers of everyone in the department**⟨request⟩ **to this form**⟨link⟩ → `https://forma-yukle.test/idare`. / **Do not call, I am in a meeting.**⟨no-call⟩
  - ⟨domain⟩ **Foreign domain**: The manager's name is familiar, but the domain is not the institution's. Perfect language does not hide that.
  - ⟨deadline⟩ **Hard deadline**: Urgency leaves no time to check.
  - ⟨request⟩ **Request for personal data**: Colleagues' ID and phone numbers are not uploaded to an outside form.
  - ⟨link⟩ **Outside form**: The form is not in the institution's system. Nobody knows whose hands the data ends up in.
  - ⟨no-call⟩ **Do not call**: This is meant to stop you checking. Call the number you know, exactly for that reason.

#### swipe · `l2-swipe`
- 👉 Safe or a trap?
  - 🛑 threat `voice-note`: A voice can be imitated with AI. Call your manager's known number yourself.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Manager
      - 💬 them: Hi, it's me. Send the confirmation code to this number right away, I will explain later. 🔊(man-2)
  - 🛑 threat `photo-perms`: A photo editor does not need contacts or SMS. Do not install an app that asks for extra permissions.
    - 🗂 **permission** (brand `zeka-foto`)
      - app: Zəka Foto
      - permissions: Camera, Photo gallery, Contacts ✗lazımsız, Read SMS ✗lazımsız
  - ✅ safe `komekci-notif`: The institution's approved tool sends an expected notice and asks for no link or code.
    - 🗂 **notification** (brand `idare-komekci`)
      - app: İdarə Köməkçisi
      - title: Your summary is ready
      - body: You can open it on the internal portal.
      - time: 11:05
  - 🛑 threat `pro-sms`: A free Pro offer can be a trap. Check your subscription only in the service's official app.
    - 🗂 **sms** (brand `neyrosohbet-fake`)
      - sender: NeyroPro
      - time: 12:30
      - 💬 NeyroSöhbət Pro free for 1 year! Activate here: neyrosohbet-pro.test
  - ✅ safe `approved-list`: It comes from an internal address with no link or file. This is useful information.
    - 🗂 **email** (brand `it-destek`)
      - from: Technical support <destek@idare.example>
      - subject: Approved AI tools
      - time: 14:00
      - body: The list is on the internal portal. If you need a new tool, send us a request.

#### choice · `l2-choice`
- ❓ A browser extension asks to "read all your data on every website". What does it mean?
  - ❌ Every extension asks for this, it is normal — This is the widest permission there is. The extension can see your email and the pages where you type passwords.
  - ✅ It can see every page I open, including work email — Right. Install such an extension only if your institution has checked and approved it.
  - ❌ It will only see the chatbot page — No. "Every website" really means every website.
- 💡 However useful an extension looks, its permissions show what it can do.

#### recap · `l2-recap`
- ✔ Flawless language does not make an email genuine: check the sender and the request.
- ✔ Take "Pro" apps and extensions only from an approved source.
- ✔ If a familiar voice asks for money or a code, call the number you know yourself.


## Vendor email fraud (`vendor-email-compromise`) · Email · Hard · 300 XP

### New bank details (`vendor-bank-change`, 3 dəq)

#### tutor · `vb-tutor`
- 🗣 "Hello! Today we learn to spot fake payment requests sent in a known supplier's name." — _talk/wave, visual: handshake_
- 🗣 "This is the most dangerous sentence: our bank details changed, pay the next invoice to the new account." — _alert/point-left, visual: artifact_, highlight `new-iban`
  - 🗂 **email** (brand `ofistechizat-fake`)
    - from: OfisTechizat LLC Accounts <muhasibat@ofistechizat-az.example.net>
    - subject: Our bank details have changed
    - time: 10:42
    - body: Dear partner, / Due to an audit we have moved our account to UlduzBank. / **Please pay the September invoice (14,860 manat) to the new account: **⟨new-iban⟩**AZ00ULDZ00000000400520007731**⟨new-iban⟩
- 🗣 "Such an email can even come from the supplier's real address, because their mailbox can be hijacked." — _think/lean-in, visual: hook_
- 🗣 "The rule is simple: call a number you already know, never the one in the email." — _happy/shield-up, visual: shield_

#### hotspot · `vb-hotspot`
- 🔍 Find the warning signs in this email. (ən azı 3)
  - 🗂 **email** (brand `ofistechizat-fake`)
    - from: OfisTechizat LLC Accounts <**muhasibat@ofistechizat-az.example.net**⟨domain⟩>
    - subject: Our bank details have changed
    - time: 10:42
    - body: Dear partner, / Due to an audit we have moved our account to UlduzBank. / **Please pay the September invoice (14,860 manat) to the new account: **⟨new-iban⟩**AZ00ULDZ00000000400520007731**⟨new-iban⟩ / **Payment is due today by 16:00, the old account is being closed.**⟨urgency⟩ / **For questions call only this number: +994 50 000 72 19**⟨phone⟩
  - ⟨domain⟩ **Different domain**: The supplier's address was ofistechizat.example. The extra "-az" and other ending make it a look-alike.
  - ⟨new-iban⟩ **New account number**: Changed bank details are the whole goal of this scam. Money sent there is hard to get back.
  - ⟨urgency⟩ **Time pressure**: A deadline pushes you to pay without checking. A real partner gives you time to verify.
  - ⟨phone⟩ **Number in the email**: If you call this number, the scammer answers. Take the number from the contract instead.

#### simulation · `vb-sim-inbox` · Accounts mailbox
- 🖥 mühit: `inbox` — You handle payments. Open four emails and choose the right step for each.
  - **step `invoice-normal`**
    - 🗂 **email** (brand `ofistechizat`)
      - from: OfisTechizat LLC <satis@ofistechizat.example>
      - subject: September invoice
      - time: 09:15
      - body: Hello, the September invoice is attached. / Payment as usual to the account in our contract. Regards, Sabina Karimova
      - attachments: {"name": [{"text": "Invoice_2026_09.pdf"}], "size": "180 KB"}
    - ✅ [open-attachment] Open attachment — Known address, an expected PDF invoice and the account does not change. This is normal mail.
    - ✅ [mark-safe] Mark as safe — Right. There is no new account and no time pressure here.
    - ⚠️ [report] Report phishing — Caution is good, but there are no signs here. You can pay an expected invoice to the contract account.
  - **step `bank-change-fake`** — 🗣 "Look at the sender's domain."
    - 🗂 **email** (brand `ofistechizat-fake`)
      - from: OfisTechizat LLC Accounts <muhasibat@ofistechizat-az.example.net>
      - subject: Our bank details have changed
      - time: 10:42
      - body: Dear partner, / Due to an audit we have moved our account to UlduzBank. / **Please pay the September invoice (14,860 manat) to the new account: **⟨new-iban⟩**AZ00ULDZ00000000400520007731**⟨new-iban⟩ / **Payment is due today by 16:00, the old account is being closed.**⟨urgency⟩ / **For questions call only this number: +994 50 000 72 19**⟨phone⟩
    - ✅ [report] Report phishing — Right: look-alike domain, new account and a deadline. No button? Forward it to IT security.
    - 💀 [reply] Reply: we accept the new account — The payment would go to the scammer. Never accept new bank details by email alone.
    - ⚠️ [reply] Reply: is this true? — The scammer will reply and say yes. Only a number you already know can verify it.
  - **step `bank-change-real-box`** — 🗣 "The address is real. Still be careful."
    - 🗂 **email** (brand `ofistechizat`)
      - from: Sabina Karimova <satis@ofistechizat.example>
      - subject: RE: September invoice
      - time: 11:20
      - body: Sorry, we forgot to mention it. / Please pay this invoice to our new account: AZ00ULDZ00000000400520007731 / To confirm, call me on this number: +994 55 000 31 84
    - ✅ [verify] Call the number in the contract — Right. A mailbox can be hijacked, but the number in your contract reaches the real supplier.
    - ⚠️ [call-back] Call the number in the email — That number belongs to the scammer, who will confirm everything. Use your own records.
    - 💀 [mark-safe] Mark as safe — The address is real, but the mailbox was hijacked. Always check new bank details separately.
    - ✅ [report] Report phishing — Good step. Security can also warn the supplier.
  - **step `boss-urgent`**
    - 🗂 **email**
      - from: Anar Huseynov <anar.huseynov@idare-mail.example.net>
      - subject: Urgent: Kur Tikinti advance
      - time: 12:05
      - body: Pay Kur Tikinti's advance today to their new account, they send the details tomorrow. / I am in a meeting, do not call. Anar
    - ✅ [report] Report phishing — Right. The name is the boss's, but the domain is not idare.example, and "do not call" is a warning sign.
    - ✅ [verify] Call the boss on a known number — Great. Even if the boss is in a meeting, a one minute check prevents a big loss.
    - 💀 [reply] Reply: we pay today — The money would go to the scammer. Pressure and secrecy are reasons to stop the payment.

#### simulation · `vb-sim-call` · Call from the supplier
- 🖥 mühit: `call` — Soon a call comes in the supplier's name. Read what the caller says and choose your answer.
  - **step `ring`**
    - 🗂 **call** (brand `ofistechizat-fake`)
      - caller: OfisTəchizat MMC
      - number: +994 55 000 31 84
      - label: Mobile
      - voice: man-2
    - ✅ [answer] Answer — Answering is not dangerous. What you say next matters.
    - ✅ [decline] Decline — That is fine too. Later call the supplier yourself on the contract number. → `after`
  - **step `pitch`** — 🗣 "Hello, Zaur Guliyev from OfisTechizat. Did you get our new details? If you do not pay today, your order stops."
    - 🗂 **call** (brand `ofistechizat-fake`)
      - caller: OfisTəchizat MMC
      - number: +994 55 000 31 84
      - label: Mobile
      - voice: man-2
    - 💀 [share] Fine, we pay the new account today — The call is part of the trap, built to back up the email. The caller's number proves nothing.
    - ✅ [keep-private] We will check the change our own way — Right. A real supplier understands a verification check.
    - ✅ [hang-up] Hang up — Good choice. Now call the contract number yourself. → `after`
  - **step `pressure`** — 🗣 "Your manager agreed, I spoke to him. Send me a photo of the payment order so I can check it."
    - 🗂 **call** (brand `ofistechizat-fake`)
      - caller: OfisTəchizat MMC
      - number: +994 55 000 31 84
      - label: Mobile
      - voice: man-2
    - 💀 [share] I send the photo — A payment order holds account and signature details. Scammers use them to forge new documents.
    - ✅ [verify] I will call my manager myself — Great. Only the manager can confirm "the manager agreed".
    - ✅ [hang-up] Hang up — Right. When pressure grows, ending the call is the best answer.
  - **step `after`** · The call ended. What now?
    - 🗂 **call** (brand `ofistechizat-fake`)
      - caller: OfisTəchizat MMC
      - number: +994 55 000 31 84
      - label: Mobile
      - voice: man-2
    - ✅ [call-back] Call the number in the contract — Right. The real supplier will say nothing changed, and you report the scam.
    - ⚠️ [call-back] Call back the number that called — That number goes to the scammer. Verify only with a number from your own records.
    - ⚠️ [ignore] Do nothing — The scammer will try another colleague. Tell security.

#### order · `vb-order`
- 🔢 Put the steps in order when new bank details arrive.
  1. Hold the payment
  2. Take the number from the contract or past records
  3. Call and ask about the change
  4. Have a second colleague approve it
  5. Only then update the details
- 💡 Bank details change only after a check on a known number and approval by a second colleague.

#### choice · `vb-choice`
- ❓ You already sent the money to the new account. What comes first?
  - ✅ Call my bank at once to stop the transfer, and tell security — Right. The sooner the bank knows, the better the chance to stop the money.
  - ❌ Wait for the supplier to answer — Every hour moves the money further away. Waiting loses time.
  - ❌ Email the same address and ask for it back — The scammer reads that mailbox. Only the bank can stop the money.
- 💡 With a wrong transfer, time decides: first the bank, then security. Keep the emails as evidence.

#### recap · `vb-recap`
- ✔ When bank details change, hold the payment
- ✔ Call a number you know, not the one in the email
- ✔ Already paid? Call the bank and security at once

### Hijacked thread (`hijacked-thread`, 3 dəq)

#### tutor · `ht-tutor`
- 🗣 "When a scammer gets into a partner's mailbox, they reply in your old thread. Subject and signature look familiar." — _talk/wave, visual: inbox_
- 🗣 "A password protected archive is a warning sign. The password hides the file from antivirus checks." — _alert/point-left, visual: artifact_, highlight `zip-pass`
  - 🗂 **email** (brand `kur-tikinti`)
    - from: Elchin Babayev <layihe@kur-tikinti.example>
    - subject: RE: Contract 47/2026
    - time: 14:10
    - body: Dear partner, / the final contract is in the archive. **Archive password: 4417**⟨zip-pass⟩ / If you do not sign today, the price changes.
    - attachments: {"name": [{"text": "Contract_final.zip"}], "size": "1,2 MB"}
- 🗣 "Even in a familiar thread, do not rush to open an unexpected attachment or urgent request." — _think/shake, visual: hook_
- 🗣 "If in doubt, call the partner on a number you know and ask if they sent the file." — _happy/recite, visual: handshake_

#### hotspot · `ht-hotspot`
- 🔍 Find what changed in this reply. (ən azı 3)
  - 🗂 **email** (brand `kur-tikinti`)
    - from: Elchin Babayev <layihe@kur-tikinti.example>
    - subject: RE: RE: Contract 47/2026
    - time: 15:02
    - body: **Dear partner,**⟨greeting⟩ / the final contract and payment schedule are attached. **Sign in with your work email to open it.**⟨login⟩ / **Sign it today by 15:00.**⟨urgency⟩ / > Hi. I will send the revised draft on Monday, no rush. Elchin
    - attachments: {"name": [{"text": "Contract_47_sign.html", "spot": "html"}], "size": "12 KB"}
  - ⟨greeting⟩ **Changed tone**: He used to write "Hi", now "Dear partner". A sudden change of tone suggests someone else is writing.
  - ⟨html⟩ **HTML attachment**: Contracts come as PDF or Word. An HTML attachment usually opens a fake sign-in page.
  - ⟨login⟩ **Sign-in request**: Opening an attachment never needs your password. A file that asks for it wants to steal it.
  - ⟨urgency⟩ **Sudden rush**: The earlier mail said "no rush". A sudden deadline is a scammer's tool.

#### simulation · `ht-sim-inbox` · Project thread
- 🖥 mühit: `inbox` — You have a long thread with Kur Tikinti. Check the new replies: which are real and which come from a hijacked mailbox?
  - **step `thread-genuine`**
    - 🗂 **email** (brand `kur-tikinti`)
      - from: Elchin Babayev <layihe@kur-tikinti.example>
      - subject: RE: Contract 47/2026
      - time: 10:05
      - body: Hi. We took your comments into account, the revised draft is attached. / Call me if you have questions. Elchin
      - attachments: {"name": [{"text": "Contract_47_revised.pdf"}], "size": "340 KB"}
    - ✅ [open-attachment] Open attachment — An expected PDF, the usual tone, no pressure. This is normal work mail.
    - ⚠️ [report] Report phishing — There is no warning sign here. The file is expected and fits the thread.
  - **step `thread-zip`** — 🗣 "Look at the archive and the password."
    - 🗂 **email** (brand `kur-tikinti`)
      - from: Elchin Babayev <layihe@kur-tikinti.example>
      - subject: RE: Contract 47/2026: urgent
      - time: 14:10
      - body: Dear partner, / the final contract is in the archive. **Archive password: 4417**⟨zip-pass⟩ / If you do not sign today, the price changes.
      - attachments: {"name": [{"text": "Contract_final.zip"}], "size": "1,2 MB"}
    - 💀 [open-attachment] Open attachment — Malware can hide in a password protected archive, because antivirus cannot look inside.
    - ✅ [verify] Call Elchin on a known number — Great. If Elchin did not send it, his mailbox is hijacked and he needs to know.
    - ✅ [report] Report phishing — Right: sudden rush, protected archive and a new tone. Reporting protects the team too.
    - ⚠️ [reply] Reply: is this you? — The reply goes to the hijacked mailbox and the scammer says yes. Call instead.
  - **step `thread-html`**
    - 🗂 **email** (brand `kur-tikinti`)
      - from: Elchin Babayev <layihe@kur-tikinti.example>
      - subject: RE: Payment schedule
      - time: 14:35
      - body: The schedule is in a protected file. Open it and sign in with your work email.
      - attachments: {"name": [{"text": "Payment_schedule.html"}], "size": "9 KB"}
    - ⚠️ [open-attachment] Open attachment — The HTML file opens a fake sign-in page in the browser. You typed nothing yet, close it.
    - 💀 [enter-credentials] Sign in — The scammer now has your password. Change it now and tell security.
    - ✅ [report] Report phishing — Right. A payment schedule needs no password, and an HTML attachment is a typical trap.
  - **step `thread-account`**
    - 🗂 **email** (brand `kur-tikinti`)
      - from: Elchin Babayev <layihe@kur-tikinti.example>
      - subject: RE: Advance payment
      - time: 15:20
      - body: This time pay the advance to our partner company's account, details attached.
      - attachments: {"name": [{"text": "Bank_details.pdf"}], "size": "64 KB"}
    - ✅ [verify] Call a known number to check — Right. A request to pay another company is confirmed only by phone.
    - 💀 [reply] Reply: we accept the details — The advance would go to the scammer. A familiar thread does not prove a new account.
    - ✅ [report] Report phishing — Good step. Two suspicious mails in one thread is a serious signal.
  - **step `legal-genuine`**
    - 🗂 **email** (brand `idare`)
      - from: Legal department <huquq@idare.example>
      - subject: Our notes on contract 47
      - time: 16:00
      - body: Hi, we suggest a change to clause 5. Let us discuss it at tomorrow's meeting.
    - ✅ [reply] Reply — An internal address, no attachment or link, nothing asked. This is normal mail.
    - ⚠️ [report] Report phishing — This mail shows no signs. Save reports for suspicious mail.

#### swipe · `ht-swipe`
- 👉 Safe or threat?
  - ✅ safe `pdf-expected`: An expected document, a normal format and a known sender. Fine to open.
    - 🗂 **file** (brand `kur-tikinti`)
      - name: Contract_47_revised.pdf
      - type: pdf
      - size: 340 KB
      - source: Elchin Babayev, expected reply
  - 🛑 threat `zip-pass`: A password protected archive hides from antivirus. Call the sender and ask.
    - 🗂 **file** (brand `kur-tikinti`)
      - name: Payment_order.zip
      - type: zip
      - size: 1,1 MB
      - source: layihe@kur-tikinti.example, password: 4417
  - 🛑 threat `html-sign`: A contract is never an HTML file. Such a file opens a fake sign-in page.
    - 🗂 **file** (brand `kur-tikinti`)
      - name: Contract_sign.html
      - type: html
      - size: 11 KB
      - source: RE: Contract 47/2026
  - ✅ safe `act-internal`: From an internal department, agreed in advance. No warning sign.
    - 🗂 **file** (brand `idare`)
      - name: Handover_September.pdf
      - type: pdf
      - size: 210 KB
      - source: huquq@idare.example, agreed yesterday
  - 🛑 threat `double-ext`: The real type is .exe, a program. An invoice is never a program.
    - 🗂 **file** (brand `kur-tikinti`)
      - name: Invoice_47.pdf.exe
      - type: exe
      - size: 2,3 MB
      - source: RE: Contract 47/2026

#### scenario · `ht-scenario` · You opened the archive
- 🎭 start: `n1`
  - **[n1]**  (, 🔊-): "You opened the protected archive. There was no contract inside, just a strange file, and the screen went dark for a moment."
    - Disconnect from the network and call security → `n2` — Right. Disconnecting stops the spread, and the call brings in the team.
    - Shut the computer down at once → `n2` — Shutting down can erase evidence in memory. Unless your procedure says otherwise, leave it on and disconnect it.
    - Tell no one, probably nothing happened ⇒ **compromised** — Malware works quietly and can spread across the network. Reporting a mistake fast is not shameful, it saves the day.
  - **[n2]** Security team (phone, 🔊woman-2): "Thank you. Is the email still in your mailbox? And did you tell Kur Tikinti?"
    - I kept the email, and I call Elchin on a known number ⇒ **safe** — Great. The email is evidence, and the partner must learn their mailbox was hijacked.
    - I deleted the email to leave no trace ⇒ **risky** — The email is needed for the investigation. Next time keep it and follow security's instructions.
    - I reply to Elchin in the same thread ⇒ **risky** — The scammer reads that mailbox. Tell the partner by phone.

#### recap · `ht-recap`
- ✔ A familiar thread can be hijacked too
- ✔ Before opening a protected archive or HTML file, call and check
- ✔ If you opened it, disconnect and report at once


## Dangerous attachments (`dangerous-attachments`) · Email · Medium · 250 XP

### Disguised files (`disguised-files`, 3 dəq)

#### tutor · `df-tutor`
- 🗣 "Hello! A file name can lie. Today we learn to see what an attachment really is." — _talk/wave, visual: folder_
- 🗣 "This file looks like a PDF. But the very end of the name says exe, so it is a program." — _alert/point-left, visual: artifact_, highlight `ext`
  - 🗂 **file**
    - name: Qerar_2026.pdf**.exe**⟨ext⟩
    - type: exe
    - size: 1,8 MB
    - source: Email attachment
- 🗣 "Archives, disk images and shortcut files can also hide a program inside." — _think/lean-in, visual: download_
- 🗣 "The rule is simple: check the type before opening an unexpected file, and report if in doubt." — _happy/shield-up, visual: shield_

#### simulation · `df-sim-files` · Downloads folder
- 🖥 mühit: `desktop` — Look at the files you downloaded from email. Show extensions and choose what to do with each.
  - **step `decree-exe`** — 🗣 "Show extensions. What does the end of the name say?"
    - 🗂 **file**
      - name: Qerar_2026.pdf.exe
      - type: exe
      - size: 1,8 MB
      - source: Downloads: qerar@nazirlik-sened.example.net
    - 💀 [open] Open — This is not a document, it is a program. It can install malware the moment it opens.
    - ✅ [delete] Delete — Right. A real decree is never a program.
    - ✅ [report] Report to IT security — Great. Security can remove the same email from everyone else's mailbox too.
  - **step `report-iso`**
    - 🗂 **file**
      - name: Hesabat_sentyabr.iso
      - type: iso
      - size: 4,2 MB
      - source: Downloads: hesabat@audit-xidmet.example.net
    - ⚠️ [open] Open — An ISO file opens like a disc and can hold a program. Reports are not sent as disk images.
    - ✅ [delete] Delete — Right. Do not open a disk image you did not expect.
    - ✅ [report] Report to IT security — Great. An ISO posing as a report is a typical attack.
  - **step `photos-lnk`**
    - 🗂 **file**
      - name: Tedbir_fotolari
      - type: lnk
      - size: 3 KB
      - source: Downloads: extracted from an archive
    - 💀 [open] Open — It was a shortcut and it ran a hidden command. Photos are never 3 KB.
    - ✅ [delete] Delete — Right. A shortcut (.lnk) posing as photos is a trap.
    - ✅ [report] Report to IT security — Great. Reporting without opening is the safest way.
  - **step `leave-pdf`**
    - 🗂 **file** (brand `idare`)
      - name: Mezuniyyet_qrafiki.pdf
      - type: pdf
      - size: 220 KB
      - source: Downloads: kadrlar@idare.example
    - ✅ [open] Open — Right. An expected PDF from an internal address is fine to open.
    - ⚠️ [delete] Delete — This file is safe: a real PDF from a known sender. Not every file needs deleting.

#### hotspot · `df-hotspot`
- 🔍 Find the warning signs in this email. (ən azı 3)
  - 🗂 **email** (brand `e-xidmet-fake`)
    - from: e-Xidmət Portal <**bildiris@e-xidmet-gov.example.net**⟨domain⟩>
    - subject: Fine notice
    - time: 09:31
    - body: An administrative fine has been issued in your name. Details are attached. / **Archive password: 2026**⟨zip⟩ / **If not paid within 3 days, the amount doubles.**⟨urgency⟩
    - attachments: {"name": [{"text": "Cerime_bildirisi.zip", "spot": "zip"}], "size": "860 KB"}, {"name": [{"text": "Odenis_qebzi.html", "spot": "html"}], "size": "14 KB"}
  - ⟨domain⟩ **Fake domain**: The address adds "-gov" and a different ending. Check the official portal domain yourself.
  - ⟨zip⟩ **Password protected archive**: The password stops antivirus from looking inside. Official notices are not sent like this.
  - ⟨html⟩ **HTML attachment**: An HTML attachment opens a fake payment or sign-in page in the browser.
  - ⟨urgency⟩ **Threat and rush**: Fear is meant to make you open it without checking. Check fines only on the official portal.

#### swipe · `df-swipe`
- 👉 Safe or threat?
  - ✅ safe `manual-pdf`: Internal address, expected document, ordinary PDF. Fine to open.
    - 🗂 **file** (brand `idare`)
      - name: Telimat_2026.pdf
      - type: pdf
      - size: 310 KB
      - source: it@idare.example, expected guide
  - 🛑 threat `salary-lnk`: A shortcut wearing a spreadsheet name. Opening it can run a hidden command.
    - 🗂 **file**
      - name: Maas_cedveli.xlsx.lnk
      - type: lnk
      - size: 2 KB
      - source: Unknown sender
  - 🛑 threat `order-img`: IMG is a disk image. Order details are never sent this way.
    - 🗂 **file** (brand `cevikkargo-fake`)
      - name: Sifaris_1873.img
      - type: img
      - size: 3,6 MB
      - source: sifaris@cevik-kargo.example.net
  - ✅ safe `slides-ppt`: An agreed presentation in a normal format. No warning signs.
    - 🗂 **file** (brand `ofistechizat`)
      - name: Teqdimat_oktyabr.pptx
      - type: ppt
      - size: 2,1 MB
      - source: Səbinə Kərimova, agreed for the meeting
  - 🛑 threat `invoice-html`: Invoices are not HTML files. This one from a look-alike domain opens a sign-in page.
    - 🗂 **file** (brand `ofistechizat-fake`)
      - name: Faktura_oktyabr.html
      - type: html
      - size: 9 KB
      - source: faktura@ofistechizat-az.example.net

#### match · `df-match`
- 🔗 Match each file type to its risk.
  - .exe ⇄ A program that runs when opened
  - .lnk ⇄ A shortcut that can run a hidden command
  - .iso ⇄ A disk image that can hide a program
  - .html ⇄ Can open a fake sign-in page in the browser
  - .zip (with password) ⇄ Antivirus cannot look inside
- 💡 These types are rare in work email. If you did not expect one, do not open it and report it.

#### choice · `df-choice`
- ❓ A colleague says: "I opened the file and nothing happened." What do you advise?
  - ✅ Disconnect from the network and call IT security right away — Right. Malware often runs silently, and reporting fast limits the damage.
  - ❌ Wait and report if something happens — "Nothing happened" is often a false impression. Waiting gives the attacker time.
  - ❌ Shut the computer down right away — Shutting down can erase evidence in memory. Unless your procedure says otherwise, leave it on, disconnect and report.
- 💡 An opened suspicious file is an incident: disconnect, keep the computer on, report at once.

#### recap · `df-recap`
- ✔ Look at the very end of the name: the real type
- ✔ Do not open unexpected archives, ISO, shortcuts or HTML
- ✔ Opened it? Disconnect and report at once

### Editing and macro traps (`enable-content-traps`, 3 dəq)

#### tutor · `ec-tutor`
- 🗣 "A document from the internet first opens in Protected View, read only. That is your shield." — _talk/wave, visual: lock_
- 🗣 "If a blank page shows text like this, stop. A real document does not ask you to press buttons." — _alert/point-left, visual: artifact_, highlight `lure`
  - 🗂 **dialog** (brand `senedyaz`)
    - tone: app
    - title: Protected View: this file came from the internet
    - body: The document is blank, only a picture shows: / **"To see the text, click Enable Editing, then Enable Content."**⟨lure⟩
    - buttons: Enable Editing, Close
- 🗣 "A macro is a hidden command inside a document. It can install malware on the computer." — _think/lean-in, visual: alarm_
- 🗣 "Also never accept an offer to download a special viewer from a website to open a document." — _alert/shake, visual: download_

#### simulation · `ec-sim-doc` · Opening a document
- 🖥 mühit: `desktop` — You opened an attachment called tender terms. Read each window and decide at every step.
  - **step `protected-view`** — 🗣 "The document is blank and wants a click."
    - 🗂 **dialog** (brand `senedyaz`)
      - tone: app
      - title: Protected View: this file came from the internet
      - body: The document is blank, only a picture shows: / **"To see the text, click Enable Editing, then Enable Content."**⟨lure⟩
      - buttons: Enable Editing, Close
    - ⚠️ [enable-content] Enable Editing — You left Protected View. That mode exists to guard against files like this.
    - ✅ [cancel] Close the document — Right. A blank page asking for a click is a trap. → `it-alert`
    - ✅ [report] Report to IT security — Great. You reported it without enabling editing. → `it-alert`
  - **step `macro-blocked`** — 🗣 "The app blocked the macros. The document asks you to unblock them."
    - 🗂 **dialog** (brand `senedyaz`)
      - tone: warning
      - title: Security risk: macros blocked
      - body: Macros in this document are blocked because the file came from the internet. / **The document says: "Unblock the file in its properties and allow macros."**⟨unblock⟩
      - buttons: Learn more, Close
    - 💀 [enable-content] Unblock and allow macros — The hidden macro ran and installed malware. Disconnect and call IT security now.
    - ✅ [cancel] Close the document — You stopped in time. The app protected you and you did not bypass it.
  - **step `it-alert`**
    - 🗂 **notification** (brand `it-destek`)
      - app: IT Support
      - title: Alert: fake tender documents
      - body: Malicious "tender terms" documents are spreading. If you got one, report it.
      - time: 11:02
    - ✅ [report] Report the email — Right. Your report helps IT remove the email from every mailbox.
    - ⚠️ [ignore] Ignore — You closed the file, but the email is still there. Report it so colleagues do not open it.

#### simulation · `ec-sim-viewer` · Fake PDF viewer
- 🖥 mühit: `browser` — A link in an email offers a program to open the document. What do you do?
  - **step `viewer-page`** · Update Sənəd Oxu to view this document — 🗣 "Look at the address bar."
    - 🗂 **url** (brand `senedoxu-fake`)
      - url: https://senedoxu-yenile.example.net/bax
    - 💀 [install] Download and install — The fake viewer is malware. Your browser can open PDF files by itself.
    - ✅ [cancel] Close tab — Right. Programs are installed only by IT or your organisation's software centre.
    - ✅ [report] Report site — Great. Reporting the site protects your colleagues too.
  - **step `viewer-download`** — 🗣 "A download started by itself. Check the file type."
    - 🗂 **file** (brand `senedoxu-fake`)
      - name: SenedOxu_Yenileme.exe
      - type: exe
      - size: 5,7 MB
      - source: senedoxu-yenile.example.net
    - 💀 [open-attachment] Open — This is a program from a fake site. Opening it infects the computer.
    - ✅ [delete] Delete — Right. Delete a download you did not ask for without opening it.
    - ✅ [report] Report to IT — Great. IT can block this site for everyone.
  - **step `portal-pdf`** · Telimat_2026.pdf
    - 🗂 **url** (brand `idare`)
      - url: https://portal.idare.example/senedler/telimat-2026.pdf
    - ✅ [open] Open document — Right. Internal portal, the file opens in the browser, nothing to install.
    - ⚠️ [report] Report site — This is your organisation's own portal and it asks for no install. Save reports for suspicious cases.

#### hotspot · `ec-hotspot`
- 🔍 Find the signs of a trap in this email. (ən azı 3)
  - 🗂 **email** (brand `docusfera-fake`)
    - from: DocuSfera <**imza@docusfera-sened.example.net**⟨domain⟩>
    - subject: Contract awaiting signature
    - time: 15:47
    - body: The document was made in an older format. / **To view it, enable editing first, then enable content.**⟨enable⟩ / **If it does not open, update your viewer here: **⟨viewer⟩**Get Sənəd Oxu**⟨viewer⟩ → `https://senedoxu-yenile.example.net/yukle`
    - attachments: {"name": [{"text": "Muqavile_imza.xlsm", "spot": "macro"}], "size": "210 KB"}
  - ⟨domain⟩ **Different domain**: It uses the signing service name, but the domain is different. Report it.
  - ⟨enable⟩ **Request to enable**: A real document can be read without enabling editing or macros.
  - ⟨macro⟩ **Macro file**: An Office file ending in "m" (xlsm, docm) can carry macros.
  - ⟨viewer⟩ **Program download link**: Needing a special program for a document is a sign of a fake viewer.

#### order · `ec-order`
- 🔢 A document asks for macros. Put the steps in order.
  1. Do not press any button
  2. Close the document
  3. Report the email to IT security
  4. If expected, ask the sender on a number you know
- 💡 First stop and close, then report. Check with the sender only on a number you already know.

#### recap · `ec-recap`
- ✔ A blank document asking for a click is a trap
- ✔ Do not enable editing or macros: close and report
- ✔ Never download a program from a site to open a document


## Insider threat (`insider-threat`) · Workplace · Medium · 250 XP

### Careless mistakes (`accidental-insider`, 3 dəq)

#### tutor · `ai-tutor`
- 🗣 "Hello! Many data leaks start not with bad intent but with an ordinary mistake." — _talk/wave, visual: desk_
- 🗣 "Autocomplete can pick the wrong address. Look at the recipient once more before sending." — _alert/point-left, visual: artifact_, highlight `wrong`
  - 🗂 **dialog** (brand `ispoct`)
    - tone: system
    - title: External recipient
    - body: This email is going outside the organisation: **rauf.aliyev@kur-tikinti.example**⟨wrong⟩ / Attachment: Maas_cedveli_2026.xlsx
    - buttons: Send anyway, Cancel
- 🗣 "Do not upload work files to a personal cloud or to apps your organisation has not approved." — _think/shake, visual: cloud_
- 🗣 "If you made a mistake, do not hide it. Reporting fast limits the harm, hiding makes it worse." — _happy/recite, visual: shield_

#### simulation · `ai-sim` · An ordinary workday
- 🖥 mühit: `desktop` — Several requests came in today. For each one, choose how to keep the data safe.
  - **step `personal-mail`**
    - 🗂 **email** (brand `idare`)
      - from: Nigar Əliyeva <nigar.aliyeva@idare.example>
      - subject: List for the report
      - time: 09:20
      - body: Hi, I will work from home tonight. / Please send the staff list (ID numbers, phones) to my personal mail: nigar.84@poctam.example
    - ⚠️ [forward] Send the list to her personal mail — Personal data left your organisation's control. A personal mailbox is not protected and can leak.
    - ✅ [reply] Reply: I cannot send it to personal mail — Right. Working from home goes through approved tools, such as work mail over the VPN.
  - **step `shadow-it`** — 🗣 "The file was too big for email, so you found a free site."
    - 🗂 **dialog** (brand `fayldasi`)
      - tone: app
      - title: FaylDaşı: free file transfer
      - body: Layihe_smeta.xlsx (2.4 GB) uploaded. / **Anyone with the link can download the file.**⟨public⟩
      - buttons: Copy link, Cancel
    - ⚠️ [share] Copy the link and send it to the partner — Whoever gets the link can open the file. Your organisation has no control over this service.
    - ✅ [cancel] Cancel and ask IT for the approved way — Right. IT support will show you the approved way to send a large file safely.
  - **step `wrong-recipient`** — 🗣 "You are sending the salary table to Rauf. Check the address."
    - 🗂 **dialog** (brand `ispoct`)
      - tone: system
      - title: External recipient
      - body: This email is going outside the organisation: **rauf.aliyev@kur-tikinti.example**⟨wrong⟩ / Attachment: Maas_cedveli_2026.xlsx
      - buttons: Send anyway, Cancel
    - 💀 [share] Send anyway — The salary table went to an outside company. That is a personal data leak.
    - ✅ [cancel] Cancel and check the recipient — Right. Your colleague is Rauf Əlizadə, but autocomplete picked Rauf Əliyev at a partner company.
  - **step `sent-wrong`** — 🗣 "Another email has already gone to the wrong address."
    - 🗂 **notification** (brand `ispoct`)
      - app: IshPocht
      - title: Email sent
      - body: Quarterly report: aysel.quliyeva@poctam.example (personal address)
      - time: 16:41
    - ✅ [report] Tell the security team now — Right. The sooner you report, the better the chance to recall it and limit the harm.
    - ⚠️ [reply] Write to the recipient: please delete it — Asking is good but not enough. Tell security first, they will say what to do next.
    - ⚠️ [ignore] Tell no one — A hidden mistake grows. Reporting is the professional thing to do.

#### swipe · `ai-swipe`
- 👉 Safe or risk?
  - 🛑 threat `badge-photo`: A badge and a work screen give attackers what they need to fake a card and pick targets.
    - 🗂 **notification** (brand `kontakto`)
      - app: Kontakto
      - title: Your post is live
      - body: "My first day!" The photo shows your badge and an internal system on screen.
      - time: 12:10
  - ✅ safe `portal-share`: An approved internal place and limited access. This is the right way to share.
    - 🗂 **email** (brand `idare`)
      - from: Leyla Rzayeva <leyla.rzayeva@idare.example>
      - subject: Estimate shared
      - time: 10:05
      - body: I shared the file on the internal portal with our department only.
  - 🛑 threat `group-password`: In a group a password reaches many people, sometimes outsiders. Passwords are never shared.
    - 🗂 **chat** (brand `sohbet`)
      - app: generic
      - contact: Office group (34 people)
      - 💬 me: The shared system password: Arxiv#2026
  - 🛑 threat `personal-cloud`: In a personal cloud a work file leaves your organisation's control, and an open link lets anyone in.
    - 🗂 **file** (brand `buludxidmet`)
      - name: Layihe_budce_2027.xlsx
      - type: xls
      - size: 1,4 MB
      - source: Personal cloud folder: anyone with the link can view
  - ✅ safe `locked-screen`: Right. A locked screen stops anyone acting in your name.
    - 🗂 **notification** (brand `idare`)
      - app: İdarə
      - title: Screen locked
      - body: You locked the screen when you left your desk.
      - time: 13:00

#### match · `ai-match`
- 🔗 Match each risk with the right habit.
  - Autocomplete ⇄ Check the recipient before sending
  - Personal cloud and free sites ⇄ Only approved sharing tools
  - Posting photos from the office ⇄ No screens, badges or papers in the frame
  - An email sent to the wrong person ⇄ Tell the security team at once
- 💡 These habits prevent most careless leaks.

#### choice · `ai-choice`
- ❓ A colleague says: "This free app speeds up work, install it, do not tell IT." What do you do?
  - ✅ I ask IT about this or an approved alternative — Right. IT can check whether it is safe or give you an approved alternative.
  - ❌ I install it, everyone uses it — An unchecked app can send work data outside. "Everyone uses it" does not mean safe.
  - ❌ I copy the files to my personal laptop and work there — This is shadow IT too: the data moves to an unprotected device.
- 💡 Apps and devices your organisation has not approved are called shadow IT. If you need something, ask IT for an approved way.

#### recap · `ai-recap`
- ✔ Check the recipient before you send
- ✔ Keep work files only in approved systems
- ✔ Made a mistake? Report it at once

### Warning signs (`insider-warning-signs`, 3 dəq)

#### tutor · `iw-tutor`
- 🗣 "Sometimes someone inside wants to take data on purpose. Knowing the signs matters." — _talk/wave, visual: eye_
- 🗣 "Asking for someone else's password and interest in files outside one's job are serious warning signs." — _alert/point-left, visual: artifact_, highlight `ask-pass`
  - 🗂 **chat** (brand `sohbet`)
    - app: generic
    - contact: Tural Həsənov
    - 💬 them: They closed my access. **Give me your password, I will grab a few folders from the archive.**⟨ask-pass⟩
- 🗣 "But do not investigate yourself, accuse or spread rumours. One sign is not proof of guilt." — _think/shake, visual: mask_
- 🗣 "Report what you saw to the security team in confidence. Specialists will check the rest." — _happy/recite, visual: badge-id_

#### simulation · `iw-sim` · Messages from colleagues
- 🖥 mühit: `phone` — It is evening and messages from colleagues arrive on your phone. Choose the right reply to each.
  - **step `ask-password`**
    - 🗂 **chat** (brand `sohbet`)
      - app: generic
      - contact: Tural Həsənov
      - 💬 them: Hi, they closed my access by mistake.
      - 💬 them: Give me your password, I will take the project folders from the archive and return it tomorrow.
    - 💀 [share] Send the password — Everything done with your password is logged in your name. Never give it to anyone, colleagues included.
    - ✅ [keep-private] I cannot give my password, contact IT support — Right. If access was closed, only IT and the manager can sort it out.
  - **step `ask-usb`**
    - 🗂 **chat** (brand `sohbet`)
      - app: generic
      - contact: Tural Həsənov
      - 💬 them: Fine. Then copy the folders to a USB stick, I will pick it up tonight.
      - 💬 them: I will need them at my new job.
    - 💀 [share] OK, I will copy them — Your organisation's data does not go to another job. Copying it makes you part of the leak.
    - ✅ [keep-private] No, I cannot do that — Right, a calm short no is enough. Now tell the security team.
  - **step `group-gossip`**
    - 🗂 **chat** (brand `sohbet`)
      - app: generic
      - contact: Department group
      - 💬 them: Leyla: I saw Tural in the archive at night. Let's check his computer and then tell everyone.
    - ⚠️ [share] Agreed, let's check — Checking on your own can spoil evidence and damage an innocent person.
    - ✅ [keep-private] Not in the group. Let's report what we saw to security in confidence — Right. The facts go to the right channel and no rumour starts.
  - **step `security-reply`**
    - 🗂 **email** (brand `idare`)
      - from: Security team <tehlukesizlik@idare.example>
      - subject: Your report is registered
      - time: 19:40
      - body: Thank you. Please do not discuss this with colleagues, we will contact you if needed.
    - ✅ [reply] Reply: understood — Right. Confidentiality protects both the inquiry and your colleague.
    - ⚠️ [forward] Forward to the department group — Spreading the report harms the inquiry and can unfairly hurt your colleague.

#### choice · `iw-signs`
- ❓ Which ones are serious warning signs?
  - ✅ Asking for access to systems outside one's job — Right. Interest in access that is not needed deserves attention.
  - ✅ Asking for someone else's password — Right. Someone with proper access does not need another person's password.
  - ✅ Copying many files to a personal USB stick or mail — Right. Data leaving the organisation is the clearest sign.
  - ❌ Sometimes working late — On its own this is normal: many people work late. One sign is no reason to accuse.
  - ❌ Asking many questions in meetings — That is interest in the work, not a threat.
- 💡 A sign is not an accusation, it is a reason to report. Specialists decide.

#### scenario · `iw-scenario` · What did you see?
- 🎭 start: `n1`
  - **[n1]**  (, 🔊-): "For a week Kamal has copied secret project files to a personal flash drive every evening. Once he said: "Nobody values me here.""
    - I report what I saw to security in confidence → `n2` — Right. You pass on facts, specialists draw conclusions.
    - I ask him directly: why are you taking the files? ⇒ **risky** — An accusation causes conflict and may lead to traces being wiped. Leave it to specialists.
    - I search his desk myself in the evening ⇒ **risky** — Searching on your own can break the rules and spoil evidence.
  - **[n2]** Security team (phone, 🔊woman-2): "Thank you. Please write down what you saw, when and where."
    - I write only what I saw, with dates and times ⇒ **safe** — Great. Precise facts are the basis of a fair check.
    - I also add my opinions about his character ⇒ **risky** — Guesswork can lead to an unfair result. Write only the facts you saw.
    - I tell colleagues to keep away from him ⇒ **risky** — That is a rumour and can unfairly hurt your colleague. Only the security team should know.

#### order · `iw-order`
- 🔢 You notice suspicious behaviour. Put the steps in order.
  1. Stay calm and accuse no one
  2. Note what you saw, with date and time
  3. Report to the security team in confidence
  4. Afterwards, do not discuss it with others
- 💡 You pass on the facts, the inquiry and decision belong to specialists. If your organisation names another channel, use it.

#### recap · `iw-recap`
- ✔ Never hand over your password or work data
- ✔ Do not accuse and do not investigate yourself
- ✔ Report the facts to security in confidence


## Meeting security (`meeting-security`) · Workplace · Medium · 250 XP

### Safe video calls (`safe-video-calls`, 3 dəq)

#### tutor · `vc-tutor`
- 🗣 "Hello! Two questions matter in a video call: who is listening, and what is on your screen?" — _talk/wave, visual: eye_
- 🗣 "If you see a name or number you do not know, ask the host. Confidential talk must wait." — _alert/point-left, visual: artifact_, highlight `unknown`
  - 🗂 **dialog** (brand `gorus`)
    - tone: app
    - title: Participants (6)
    - body: Rəşad Məmmədov (host) / Leyla Rzayeva / Kamal Nəbiyev / **iPhone (guest)**⟨unknown⟩ / **Dialled in: +994 70 000 55 12**⟨dial-in⟩ / **Guest 4821: recording the meeting**⟨recording⟩
    - buttons: Close
- 🗣 "When you share your whole screen, open tabs and incoming notifications are visible to everyone." — _think/lean-in, visual: browser_
- 🗣 "Turn on the waiting room, share only the window you need, and silence notifications." — _happy/recite, visual: lock_

#### simulation · `vc-sim` · The meeting starts
- 🖥 mühit: `desktop` — You are hosting this meeting. Admit the participants and share your presentation.
  - **step `lobby-unknown`** — 🗣 "Someone is in the waiting room."
    - 🗂 **dialog** (brand `gorus`)
      - tone: app
      - title: Waiting room
      - body: Wants to join: iPhone / Not on the invite list
      - buttons: Admit, Deny
    - ⚠️ [allow] Admit — You admitted someone without knowing who. A stranger may hear a confidential talk.
    - ✅ [deny] Deny — Right. That is exactly what the waiting room is for.
    - ✅ [verify] Ask them to give their name — Good move. If they give a name that is on the invite list, admit them.
  - **step `lobby-known`**
    - 🗂 **dialog** (brand `gorus`)
      - tone: app
      - title: Waiting room
      - body: Wants to join: Leyla Rzayeva / On the invite list
      - buttons: Admit, Deny
    - ✅ [allow] Admit — Right. Leyla is invited and her name is on the list.
    - ⚠️ [deny] Deny — Leyla is invited. Needless caution also stops the work.
  - **step `share-pick`** — 🗣 "Choose what to share."
    - 🗂 **dialog** (brand `gorus`)
      - tone: app
      - title: What do you want to share?
      - body: Entire screen / Window: Teqdimat_oktyabr.pptx / **Open browser tab: Salary table 2026**⟨tab⟩
      - buttons: Share
    - ⚠️ [share] Share entire screen — Now everyone sees your open tabs, mail and notifications. The salary table is on screen too.
    - ✅ [share] Share only the presentation window — Right. Participants see only what they need.
  - **step `popup`** — 🗣 "A new email arrived while you were sharing."
    - 🗂 **notification** (brand `ispoct`)
      - app: IshPocht
      - title: HR department
      - body: Staff cuts list (confidential) attached
      - time: 10:14
    - ✅ [keep-private] Pause sharing and silence notifications — Right: with the whole screen shared, everyone sees such a pop-up. Do not disturb mode prevents it.
    - ⚠️ [ignore] Carry on — If the whole screen is shared, everyone sees the confidential subject. Silence notifications before sharing.
  - **step `recording`**
    - 🗂 **dialog** (brand `gorus`)
      - tone: app
      - title: Meeting ended
      - body: The meeting recording is ready. / **Sharing: anyone with the link can view**⟨link⟩
      - buttons: Copy link, Change access
    - ⚠️ [share] Send the link to the general group — The recording holds a confidential discussion. As the link spreads, you lose control.
    - ✅ [keep-private] Limit access to participants — Right. Only those who need the recording should see it.

#### hotspot · `vc-hotspot`
- 🔍 What looks suspicious in the participant list? (ən azı 2)
  - 🗂 **dialog** (brand `gorus`)
    - tone: app
    - title: Participants (6)
    - body: Rəşad Məmmədov (host) / Leyla Rzayeva / Kamal Nəbiyev / **iPhone (guest)**⟨unknown⟩ / **Dialled in: +994 70 000 55 12**⟨dial-in⟩ / **Guest 4821: recording the meeting**⟨recording⟩
    - buttons: Close
  - ⟨unknown⟩ **Unnamed device**: "iPhone" is not a name. If you do not know who it is, ask the host.
  - ⟨dial-in⟩ **Unknown number**: If a dialled in number is not familiar, check who it is.
  - ⟨recording⟩ **Unapproved recording**: A guest is recording. The host should stop it and ask why.

#### order · `vc-order`
- 🔢 Prepare for a confidential meeting. Put the steps in order.
  1. Turn on the waiting room and meeting passcode
  2. Close tabs and files you do not need
  3. Silence notifications
  4. Share only the presentation window
- 💡 First control who can join, then what they can see.

#### choice · `vc-choice`
- ❓ Someone you do not know is in the meeting, and the host does not know them either. What do you do?
  - ✅ Ask the host to remove them, then carry on — Right. Once the outsider is out, the discussion can continue.
  - ❌ I ignore it, someone probably joined by phone — "Probably" is not enough. An outsider may hear a confidential talk.
  - ❌ I quietly leave the meeting — Even if you leave, others stay. Tell the host so everyone is protected.
- 💡 If you do not know who is listening, do not discuss confidential matters.

#### recap · `vc-recap`
- ✔ Admit only participants you know
- ✔ Share a window, not your whole screen
- ✔ Silence notifications before sharing

### Fake participant (`deepfake-meeting`, 3 dəq)

#### tutor · `dm-tutor`
- 🗣 "Today AI can imitate a familiar face and voice in a video call." — _talk/wave, visual: deepfake_
- 🗣 "Urgent money, secrecy and a request outside normal rules: together they are an alarm." — _alert/point-left, visual: artifact_, highlight `urgent`
  - 🗂 **dialog** (brand `gorus`)
    - tone: app
    - title: Rəşad Məmmədov (Director)
    - body: Camera on, the voice lags a little behind the lips. / **"Transfer 46,000 manat to a new account by 15:00 today. This is confidential, tell no one."**⟨urgent⟩
    - buttons: Unmute, Leave
- 🗣 "The picture can look flawless. So judge the request, not the face." — _think/shrug, visual: mask_
- 🗣 "Leave the meeting and call that person yourself on a number you already know." — _happy/recite, visual: mfa-phone_

#### simulation · `dm-sim` · Urgent meeting
- 🖥 mühit: `desktop` — An urgent meeting invite came from the director and you joined. Look at what is asked and decide.
  - **step `the-ask`** — 🗣 "The director is on camera and the voice sounds familiar."
    - 🗂 **dialog** (brand `gorus`)
      - tone: app
      - title: Rəşad Məmmədov (Director)
      - body: Camera on, the voice lags a little behind the lips. / **"Transfer 46,000 manat to a new account by 15:00 today. This is confidential, tell no one."**⟨urgent⟩
      - buttons: Unmute, Leave
    - 💀 [share] OK, I will transfer it now — The video was fake and the money went to a scammer. A familiar face does not confirm a payment request.
    - ✅ [verify] I will confirm by calling you on the number I know — Right. A second channel exposes the fake quickly.
    - ⚠️ [verify] Please wave at the camera — Such tests are no longer reliable, a fake video can wave too. Check on a separate channel.
  - **step `pressure`** — 🗣 "Now another familiar person confirms it too."
    - 🗂 **dialog** (brand `gorus`)
      - tone: app
      - title: Meeting chat
      - body: **Rəşad Məmmədov: Do not call, my phone is not with me.**⟨no-call⟩ / Sevda Kərimli (chief accountant): I am here too, everything is in order.
      - buttons: Send
    - 💀 [share] If everyone agrees, I will transfer — Every participant in the meeting can be fake. In such attacks the whole meeting is sometimes faked.
    - ✅ [hang-up] Leave the meeting and hold the payment — Right. "Do not call" is the best reason to call.
  - **step `new-number`** — 🗣 "After the meeting a message arrives."
    - 🗂 **notification** (brand `sohbet`)
      - app: Söhbət
      - title: +994 50 000 64 27
      - body: Rəşad Məmmədov: This is my new number. Is the transfer done?
      - time: 14:22
    - ✅ [report] Report to the security team — Right, the scammer is pushing on another channel. Keep the message, it is evidence.
    - ⚠️ [reply] Reply: not yet, doing it now — A new number is checked only via the old one you know. This is the scammer's number.

#### scenario · `dm-scenario` · The check call
- 🎭 start: `n1`
  - **[n1]** Assistant Aygün Rəhimova (internal number) (phone, 🔊woman-2): "Mr Rashad is in Ganja today, in sessions all day. He has not set up any meeting."
    - I tell security and finance right away → `n2` — Right. The attacker may target other staff too.
    - He probably forgot, I make the transfer ⇒ **compromised** — The assistant confirmed there was no meeting. The money would have gone to a scammer.
  - **[n2]** Security team (phone, 🔊man-3): "Thank you. Did you keep the invite, the meeting chat and the message?"
    - I kept everything and am sending it to you ⇒ **safe** — Great. This evidence helps the inquiry and warns others.
    - I deleted it all because I felt embarrassed ⇒ **risky** — Without evidence the inquiry is harder. Next time delete nothing, there is no shame in this.

#### choice · `dm-choice`
- ❓ What is the most reliable way to check the "director" from the meeting?
  - ✅ Leave and call the number I already know for him — Right. The scammer does not control that channel.
  - ❌ Ask him a personal question in the meeting — The answer may be on social media, or he may dodge. A separate channel is more reliable.
  - ❌ Look closely at the video quality — Modern fake video is very convincing. Do not rely on the picture.
  - ❌ Reply to the invite email — The reply would go back to the scammer. Choose the channel yourself.
- 💡 A second channel is one you choose and already know: the internal number, the number in your contacts, or in person.

#### order · `dm-order`
- 🔢 Urgent money is requested in a meeting. Put the steps in order.
  1. Do not make the payment
  2. Leave the meeting
  3. Call on a number you know yourself
  4. Report to security and keep the evidence
- 💡 First hold the money, then check and report. Urgency never outranks checking.

#### recap · `dm-recap`
- ✔ A familiar face and voice are not proof
- ✔ Urgent money plus secrecy means stop
- ✔ Call back yourself on a number you know


## Work phone (`work-phone-mdm`) · Devices · Easy · 200 XP

### Work phone rules (`phone-rules`, 3 dəq)

#### tutor · `intro`
- 🗣 "Your work phone is a piece of your organisation in your pocket. It holds work mail, documents and contacts." — _talk/wave, visual: phone-lock_
- 🗣 "The management profile protects the phone. If it is lost, technical support can lock it and erase work data." — _talk/shield-up, visual: artifact_
  - 🗂 **notification** (brand `nc-iscihaz`)
    - app: İşCihaz
    - title: Phone protected
    - body: This device is managed under your organisation's security rules.
    - time: 09:00
- 🗣 "Never install a profile from a message link. A fake profile can hand your phone to an attacker." — _alert/point-left, visual: artifact_, highlight `link`
  - 🗂 **sms** (brand `it-destek-fake`)
    - sender: IT-Support
    - time: 11:42
    - 💬 Your profile is expiring. Install a new one: **iscihaz-profil.example.net**⟨link⟩
- 🗣 "Install apps only from the official store or your organisation's device app, and check every permission." — _happy/recite, visual: shield_

#### simulation · `new-phone` · Your new work phone
- 🖥 mühit: `phone` — You have just been given a new work phone. Look at each notification and make the right call.
  - **step `enroll`** — 🗣 "Technical support installed this app themselves."
    - 🗂 **notification** (brand `nc-iscihaz`)
      - app: İşCihaz
      - title: Finish enrolment
      - body: Technical support has prepared your device. Finish enrolment to get work mail.
      - time: 09:05
    - ✅ [open] Open notification — Correct. Enrolling through your organisation's own app is the safest way.
    - ⚠️ [later] Later — A phone that is not enrolled is not protected. Do it on day one.
  - **step `profile-sms`** — 🗣 "Check the sender and the link address."
    - 🗂 **sms** (brand `it-destek-fake`)
      - sender: IT-Support
      - time: 11:42
      - 💬 Dear colleague, your MDM profile expires today. Install the new profile so your phone is not blocked: iscihaz-profil.example.net/new → `https://iscihaz-profil.example.net/new`
    - 💀 [click-link] Open link — That is not your organisation's domain. Profiles only come from the İşCihaz app or technical support. → `profile-install`
    - ✅ [report] Report — Correct. Your report lets technical support warn everyone else too. → `qr-permission`
    - ✅ [block] Block — Good. Tell technical support as well so your colleagues are warned. → `qr-permission`
  - **step `profile-install`** — 🗣 "The site wants to load a profile onto your phone."
    - 🗂 **dialog** (brand `nc-iscihaz-fake`)
      - tone: system
      - title: Install profile?
      - body: iscihaz-profil.example.net wants to install a configuration profile. / The profile will add a certificate, VPN and mail settings.
      - buttons: Decline, Allow
    - ✅ [deny] Decline — Correct. A profile like this can route all your internet traffic through the attacker's server.
    - 💀 [allow] Allow — A fake profile hands control of the phone to a stranger. Call technical support right away.
  - **step `qr-permission`** — 🗣 "What does a QR reader really need?"
    - 🗂 **permission** (brand `nc-qr-oxuyucu`)
      - app: QR Oxuyucu
      - permissions: Camera, Contacts ✗lazımsız, Precise location ✗lazımsız, Accessibility: control the screen ✗lazımsız
    - ⚠️ [allow] Allow — A QR reader only needs the camera. Accessibility lets an app read the screen and tap for you.
    - ✅ [deny] Don't allow — Correct. Grant only what the feature needs, here just the camera.
  - **step `chat-apk`** — 🗣 "A colleague sent you a file in the messenger."
    - 🗂 **file** (brand `sohbet`)
      - name: Shift_schedule.apk
      - type: apk
      - size: 5.4 MB
      - source: Söhbət: Rashad Mammadov
    - 💀 [install] Install — A shift schedule should never be an install file. An .apk sent in a chat brings malware onto the phone.
    - ✅ [cancel] Cancel — Correct. Your colleague's account may be hijacked, so tell technical support.
  - **step `os-update`**
    - 🗂 **dialog** (brand `sistem-yenileme`)
      - tone: system
      - title: System update
      - body: A security update is ready. The phone will restart for about 10 minutes.
      - buttons: Later, Update now
    - ✅ [update] Update now — Correct. Updates close gaps that attackers already know about.
    - ⚠️ [later] Later — Every day of delay leaves the gap open. Update tonight at the latest.

#### swipe · `app-asks`
- 👉 Is this request safe on a work phone, or a threat?
  - ✅ safe `map-location`: A map needs location, and only while it is open. The permission fits the job.
    - 🗂 **permission** (brand `nc-yolxerite`)
      - app: YolXəritə
      - permissions: Location: only while the app is open
  - 🛑 threat `game-sms`: A game needs neither SMS nor contacts. SMS access lets it read your sign-in codes.
    - 🗂 **permission** (brand `nc-super-oyunlar`)
      - app: Super Oyunlar
      - permissions: Read SMS messages ✗lazımsız, Contacts ✗lazımsız
  - 🛑 threat `battery-access`: Saving battery does not require controlling the screen. These are exactly the permissions banking trojans ask for.
    - 🗂 **permission** (brand `nc-batareya`)
      - app: Batareya Qoruyucu
      - permissions: Accessibility: control the screen ✗lazımsız, Display over other apps ✗lazımsız
  - ✅ safe `lock-notice`: This is your organisation's own app and it sends no link. A strong screen lock is the first defence if the phone is lost.
    - 🗂 **notification** (brand `nc-iscihaz`)
      - app: İşCihaz
      - title: Screen lock required
      - body: Set a PIN of at least 6 digits to use work mail.
      - time: 09:20
  - 🛑 threat `torch-notifications`: A torch does not need to read notifications. With this access it can see incoming codes and messages.
    - 🗂 **permission** (brand `fener-pro`)
      - app: Fənər Pro
      - permissions: Notification access ✗lazımsız

#### match · `permission-power`
- 🔗 Match each permission with what it allows.
  - Read SMS ⇄ See bank and sign-in codes
  - Accessibility ⇄ Read the screen and tap for you
  - Notification access ⇄ Read messenger messages
  - Install unknown apps ⇄ Install software from outside the store
- 💡 These four permissions are the most powerful. Give them only to apps technical support has approved.

#### choice · `slow-phone`
- ❓ A friend says to remove the management profile from your slow work phone. What do you do?
  - ✅ Keep the profile and contact technical support — Correct. The profile is the phone's protection, and support will fix the problem.
  - ❌ Remove the profile to speed the phone up — Without the profile a lost phone cannot be locked remotely. Work mail usually stops too.
  - ❌ Reset the phone to factory settings — This wipes the profile and work data without technical support knowing. Talk to them first.
  - ❌ Give it to a tech-savvy friend to fix — The phone holds work data. Hand it only to technical support.
- 💡 The management profile guards your work phone. Only technical support changes it.

#### recap · `recap`
- ✔ Profiles and work apps come only from the İşCihaz app or technical support.
- ✔ Permissions must fit the app's job. SMS and Accessibility are the most dangerous.
- ✔ Screen lock and updates are your phone's first defence.

### Lost work phone (`lost-phone`, 3 dəq)

#### tutor · `intro`
- 🗣 "Work phone lost or stolen? Do not feel embarrassed and do not wait. Every minute counts." — _talk/wave, visual: phone-lock_
- 🗣 "Call technical support at once from another phone. They can lock it remotely and check where it is." — _alert/recite, visual: alarm_
- 🗣 "A message like this may follow. It is an attempt to steal your password and unlock the phone." — _alert/point-left, visual: artifact_, highlight `link`
  - 🗂 **sms**
    - sender: Device Service
    - time: 20:14
    - 💬 Your phone has been found. Sign in to see where it is: **cihaz-tapildi.example.net**⟨link⟩
- 🗣 "Even if the caller says they are technical support, never tell anyone your PIN or SMS code." — _think/shake, visual: mfa-phone_

#### order · `first-steps`
- 🔢 Your work phone is lost. Put the steps in order.
  1. Call technical support from another phone
  2. Have them lock the phone remotely
  3. Call your operator and block the SIM
  4. Change your work passwords from another device
  5. If it is not found, have it wiped remotely
- 💡 Reporting and locking take minutes and stop most of the harm. Wiping comes last so the phone can still be found. If your organisation's procedure sets another order, follow it.

#### simulation · `fake-support-call` · A call from support
- 🖥 mühit: `call` — Your work phone went missing last night. This morning your personal number gets a call from technical support.
  - **step `ring`**
    - 🗂 **call** (brand `it-destek-fake`)
      - caller: Technical support
      - number: +994 12 000 45 17
      - label: Mobile
      - voice: young-man
    - ✅ [answer] Answer — Answering is not dangerous. What matters is what you say.
    - ✅ [decline] Decline — That works too. Call technical support yourself on the official number. → `after`
  - **step `code`** — 🗣 "Hello, this is technical support. To lock your phone we sent you an SMS code. Please read it out."
    - 🗂 **call** (brand `it-destek-fake`)
      - caller: Technical support
      - number: +994 12 000 45 17
      - label: Mobile
      - voice: young-man
    - 💀 [share] Read out the code — That code is a sign-in to your account. Support does not need your code to lock a phone.
    - ✅ [verify] I will call the official number myself — Excellent. Checking on the official number exposes a fake call at once. → `after`
    - ✅ [hang-up] Hang up — Correct. Real technical support never asks for codes or passwords. → `after`
  - **step `pin`** — 🗣 "All right, then tell me your screen lock PIN. We will unlock the phone remotely and save your data."
    - 🗂 **call** (brand `it-destek-fake`)
      - caller: Technical support
      - number: +994 12 000 45 17
      - label: Mobile
      - voice: young-man
    - 💀 [share] Tell the PIN — Whoever has the phone will open it with this PIN. The management system never needs your PIN to lock it.
    - ✅ [keep-private] I will not tell my PIN — Correct. Your PIN is yours alone and is never shared.
    - ✅ [hang-up] Hang up — Good decision. When the pressure rises, ending the call is the right move. → `after`
  - **step `after`** · The call has ended. What now?
    - 🗂 **call** (brand `it-destek-fake`)
      - caller: Technical support
      - number: +994 12 000 45 17
      - label: Mobile
      - voice: young-man
    - ✅ [call-back] Call technical support's official number — Correct. Report this call, because the attacker knows your name and number.
    - ⚠️ [ignore] Do nothing — The attacker will call another colleague next. If you report it, support can warn everyone.

#### swipe · `after-loss`
- 👉 Messages after the phone was lost. Safe, or a threat?
  - 🛑 threat `found-sms`: A fake found message is after your password. Only technical support checks where the phone is.
    - 🗂 **sms**
      - sender: Device Service
      - time: 20:14
      - 💬 Your phone has been found. Sign in to see it on the map: cihaz-tapildi.example.net/map → `https://cihaz-tapildi.example.net/map`
  - ✅ safe `sim-blocked`: No link, nothing is requested, and it confirms your own request. This is a normal notice.
    - 🗂 **sms** (brand `kehkesan-mobil`)
      - sender: Kehkesan
      - time: 20:31
      - 💬 Your SIM card has been blocked at your request. Bring your ID card to a sales office for a new one.
  - ✅ safe `ticket-mail`: The address is your organisation's, with no link and no password request. This answers your report.
    - 🗂 **email** (brand `it-destek`)
      - from: Technical support <it-support@idare.example>
      - subject: Ticket 4471: phone locked
      - time: 20:40
      - body: Your work phone has been locked remotely. Come to the 2nd floor tomorrow at 10:00 for a new device.
  - 🛑 threat `ransom-chat`: Do not send money and keep the conversation. Show it to technical support and the police.
    - 🗂 **chat**
      - app: whatsapp
      - contact: +994 55 000 63 21
      - 💬 them: I have your phone. Transfer 100 AZN and I will give it back. Tell the police and I will leak what is on it.

#### scenario · `taxi` · Left in a taxi
- 🎭 start: `night`
  - **[night]**  (, 🔊-): "At home in the evening you realise you left your work phone in a taxi. It is 22:00."
    - I call technical support right now → `morning` — Correct. You can report at night too, and the phone is locked at once.
    - I wait until morning, maybe the driver will call ⇒ **risky** — A lot can be done with a phone in one night. Report now, and if the driver calls, even better.
  - **[morning]** Taxi driver (in the morning, at the office) (in-person, 🔊older-man): "Hello, you left your phone in my taxi last night. I brought it in, it was locked, I touched nothing."
    - I hand it to technical support to check ⇒ **safe** — Excellent. A phone that was out of your hands needs checking, and the specialist decides.
    - I unlock it and get straight back to work ⇒ **risky** — The phone spent a night in someone else's hands. Let technical support check it first.

#### choice · `best-lock`
- ❓ What protects your data best when a phone is lost?
  - ✅ A PIN of at least 6 digits plus fingerprint — Correct. A long PIN is hard to guess, and a fingerprint keeps daily use easy.
  - ❌ A 4-digit PIN with your birth year — A birth year is easy to find on social media. Pick at least 6 random digits.
  - ❌ A simple unlock pattern — A simple pattern can be read from smudges on the screen or over your shoulder.
  - ❌ No lock, the phone is always with me — A phone can be lost in a moment. Without a lock, work mail is open to anyone.
- 💡 A strong screen lock is the first barrier protecting data on a lost phone.

#### recap · `recap`
- ✔ If the phone is lost, call technical support at once from another phone.
- ✔ Never tell anyone a code, PIN or password, whoever is calling.
- ✔ Have a returned phone checked by technical support before you use it.


## Documents and printing (`documents-printing`) · Physical security · Easy · 200 XP

### Printers and scanners (`print-scan`, 3 dəq)

#### tutor · `intro`
- 🗣 "A page forgotten in the printer is the simplest leak. Anyone walking down the corridor can take it." — _talk/wave, visual: desk_
- 🗣 "Before you send, check which printer is selected and whether secure print is on." — _think/point-left, visual: artifact_, highlight `secure`
  - 🗂 **dialog** (brand `nc-capmerkezi`)
    - tone: system
    - title: Print
    - body: Printer: **Corridor-2 (shared)**⟨printer⟩ / Secure print: **off**⟨secure⟩
    - buttons: Cancel, Print
- 🗣 "Secure print releases pages only when you tap your card or type a PIN at the printer." — _happy/shield-up, visual: lock_
- 🗣 "Mail from the scanner needs care too. Attackers often send phishing dressed up as a scanned document." — _alert/lean-in, visual: inbox_

#### simulation · `print-day` · Printing day
- 🖥 mühit: `desktop` — Today you are printing several documents. Look at the windows that open and decide.
  - **step `salary-print`** — 🗣 "This document contains staff salaries."
    - 🗂 **dialog** (brand `nc-capmerkezi`)
      - tone: system
      - title: Print: Salary_table_October.xlsx
      - body: Printer: Corridor-2 (shared) / Secure print: off / Copies: 1
      - buttons: Print directly, Send with secure print
    - ✅ [keep-private] Send with secure print — Correct. The document waits in the queue and comes out only when you are at the printer.
    - ⚠️ [open] Print directly — The page will sit in the shared corridor waiting for you. If you are delayed, someone else may see it.
  - **step `paper-out`**
    - 🗂 **notification** (brand `nc-capmerkezi`)
      - app: Çap Mərkəzi
      - title: Corridor-2: out of paper
      - body: Business_trip_list.pdf is queued. It will print as soon as paper is loaded.
      - time: 11:20
    - ✅ [cancel] Cancel print — Correct. Once paper is loaded the page would come out without you, so resend it with secure print.
    - ⚠️ [ignore] Dismiss — Whoever loads the paper will also pick up the list. Cancel the job still in the queue.
  - **step `driver-popup`** — 🗣 "A website offers you printer software."
    - 🗂 **dialog** (brand `nc-drayver`)
      - tone: warning
      - title: Printer driver out of date
      - body: Download Drayver Yeniləyici to keep printing. / printer-drayver.example.info
      - buttons: Close, Download now
    - 💀 [install] Download now — A website cannot check the driver on your computer. Downloads like this are usually malware.
    - ✅ [cancel] Close — Correct. Only technical support installs printer drivers.
    - ✅ [report] Report to technical support — Excellent. Technical support will check where this window came from.
  - **step `scan-folder`** · Shared folder: Scans — 🗣 "The passport copies you scanned landed in a shared folder."
    - 🗂 **file** (brand `nc-capmerkezi`)
      - name: Scan_passports_0410.pdf
      - type: pdf
      - size: 3.2 MB
      - source: Shared folder: Scanner, 3rd floor
    - ✅ [keep-private] Move to my folder — Correct. Move the file to your own folder so it does not stay in the shared one.
    - ⚠️ [ignore] Leave it there — The whole floor can open this folder. Passport copies are personal data.
    - ⚠️ [share] Send the link to the department — Personal data goes only to the person who needs it. Do not send it to the whole department.

#### hotspot · `scan-mail`
- 🔍 Find the suspicious parts of this mail that claims to come from the scanner. (ən azı 3)
  - 🗂 **email** (brand `nc-capmerkezi-fake`)
    - from: Scanner, 3rd floor <**scan@idare-skan.example.net**⟨sender⟩>
    - subject: Scanned document: 4 pages
    - time: 14:03
    - body: Dear user, / A document was scanned for you. **If you do not view it within 24 hours it will be deleted.**⟨urgent⟩ / **View document**⟨link⟩ → `https://idare-skan.example.net/view`
    - attachments: {"name": [{"text": "Scan_0410.pdf"}, {"text": ".html", "spot": "ext"}], "size": "12 KB"}
  - ⟨sender⟩ **Sender domain**: Your scanner sends from idare.example. This domain looks similar but is different.
  - ⟨urgent⟩ **Time pressure**: A scanner does not rush you. Time pressure is a classic phishing sign.
  - ⟨link⟩ **Outside link**: The link leads to a site outside your organisation, where a password will be asked for.
  - ⟨ext⟩ **File extension**: An .html file is a web page, not a document. Opening it can show a fake sign-in form.

#### choice · `found-print`
- ❓ You find someone else's salary table in the printer. What do you do?
  - ✅ Give it, unread, to the owner or a manager — Correct. The document goes back to the right hands, and the owner will be more careful next time.
  - ❌ Leave it, the owner will come — Everyone who comes after you can see it. Do not leave pages in the printer.
  - ❌ Throw it in the nearest bin — A page in an ordinary bin is easy to pick out. Confidential paper goes to the shredder.
  - ❌ Post a photo to the team chat: whose is this? — That spreads salary data to even more people. Quietly hand the page to its owner.
- 💡 A page left in the printer is a leak. Return it to the owner, or to a manager if the owner is unknown.

#### match · `right-move`
- 🔗 Match each situation with the right move.
  - Out of paper, document queued ⇄ Cancel the print job
  - A site offers printer software ⇄ Contact technical support
  - Scan landed in a shared folder ⇄ Move it to your own folder
  - You must print a confidential file ⇄ Use secure print
- 💡 Small habits stop leaks while printing.

#### recap · `recap`
- ✔ Send confidential files with secure print and collect them at once.
- ✔ Only technical support installs printer software.
- ✔ In scanner mail, check the sender and the file extension.

### Disposal and clean desk (`dispose-clean-desk`, 3 dəq)

#### tutor · `intro`
- 🗣 "A page in the bin and a document left on the desk are ready-made information for an attacker." — _talk/wave, visual: desk_
- 🗣 "Tearing a page by hand is not enough. Putting the pieces back together is easy." — _alert/lean-in, visual: eye_
- 🗣 "Confidential paper goes to the shredder, and old flash drives and laptops go to technical support." — _talk/shield-up, visual: lock_
- 🗣 "When you leave your desk, lock the screen and put documents in a locked cabinet." — _happy/recite, visual: folder_

#### simulation · `before-you-leave` · Before you leave your desk
- 🖥 mühit: `desktop` — You leave your desk several times a day. Look at the windows that open and decide.
  - **step `lock-screen`** · You are off to a 15 minute meeting
    - 🗂 **dialog**
      - tone: system
      - title: Screen lock
      - body: Your computer will be unattended for 15 minutes. Lock it now?
      - buttons: Later, Lock
    - ✅ [keep-private] Lock — Correct. On an unlocked screen anyone can write from your mailbox or take files.
    - ⚠️ [later] Later — A few minutes are enough. Lock the screen every time you stand up.
  - **step `old-usb`** · You want to throw away an old flash drive — 🗣 "The drive holds old staff lists."
    - 🗂 **dialog**
      - tone: system
      - title: Format flash drive (E:)?
      - body: Quick format: file space will be marked as free.
      - buttons: Cancel, Format
    - ✅ [eject] Eject and give to technical support — Correct. Technical support wipes the drive fully or destroys it.
    - ⚠️ [delete] Quick format and bin it — A quick format does not erase files, it only hides them. Ordinary software can recover them.
  - **step `laptop-mail`**
    - 🗂 **email** (brand `idare`)
      - from: Sabina Huseynova <s.huseynova@idare.example>
      - subject: Old laptop
      - time: 16:12
      - body: Hi, can I give my old work laptop to a relative? I deleted the files and emptied the recycle bin.
    - ✅ [reply] Reply: No, hand it to technical support — Correct. A work device belongs to the organisation, and technical support cleans the disk.
    - ⚠️ [reply] Reply: Fine, the files are deleted — Emptying the recycle bin does not clean the disk. Deleted files can be recovered with special software.
  - **step `queued-print`**
    - 🗂 **notification** (brand `nc-capmerkezi`)
      - app: Çap Mərkəzi
      - title: Secure print: 3 documents
      - body: 3 documents are queued in your name. If not collected, they will be deleted at 18:00.
      - time: 17:30
    - ✅ [open] Go to the printer and collect — Correct. Collect what you need, and let the queue delete what you do not.
    - ⚠️ [share] Send them all to print directly — Direct printing drops pages in the tray without waiting for you. Secure print exists for exactly this.

#### match · `how-to-dispose`
- 🔗 Match each item with the right way to dispose of it.
  - Copy of an ID card ⇄ Shredder
  - Draft of a confidential project ⇄ Locked confidential waste box
  - Old work laptop ⇄ Hand over to technical support
  - Event advertising leaflet ⇄ Ordinary paper recycling
- 💡 Confidential paper never goes in the ordinary bin. Devices are wiped and destroyed only by technical support.

#### scenario · `clean-desk` · A ten minute break
- 🎭 start: `leave`
  - **[leave]**  (, 🔊-): "You step out for tea. A contract folder is on the desk and a sticky note with a password is on the monitor."
    - I lock the folder in the cabinet and take the note → `visitor` — Correct. Ten minutes is plenty of time to take a photo.
    - I will be quick, leave it ⇒ **risky** — A visitor, courier or repair worker may come in. Put the document away, and never keep a password on a sticky note.
  - **[visitor]** Visitor (at your desk) (in-person, 🔊man-2): "I have a meeting with your manager. May I look at the document in this folder?"
    - I politely refuse and call my manager ⇒ **safe** — Excellent. Only someone authorised sees the document.
    - I show it, he is the manager's guest ⇒ **risky** — His identity and rights have not been checked. Confirm with your manager first.

#### choice · `shredder`
- ❓ Which method destroys confidential paper most reliably?
  - ✅ A shredder that cuts into small particles — Correct. Putting tiny particles back together is practically impossible.
  - ❌ A shredder that cuts long strips — Strips can be lined up to rebuild the page. Choose a shredder that cuts small pieces.
  - ❌ Tearing it into four by hand — Taping four pieces together takes a minute. Confidential paper goes to the shredder.
  - ❌ Into the ordinary bin, face down — Rubbish leaves the building, and out there anyone can open it.
- 💡 For confidential paper, use a shredder that cuts small particles or a confidential waste box.

#### recap · `recap`
- ✔ Confidential paper goes to the shredder, and devices go to technical support.
- ✔ Deleting and quick formatting do not erase data.
- ✔ When you leave your desk, lock the screen and put documents away.


## Events and delegations (`events-delegations`) · Workplace · Medium · 200 XP

### Conferences and delegations (`conferences`, 3 dəq)

#### tutor · `intro`
- 🗣 "Conferences and official meetings are for making contacts. But someone there may also be collecting information." — _talk/wave, visual: handshake_
- 🗣 "A gifted flash drive, power bank or headset must not go into your work computer. It may carry malware." — _alert/lean-in, visual: usb_
- 🗣 "Your badge shows your name, position and a QR code. Keep it out of photos and hide it outside." — _think/point-left, visual: artifact_, highlight `badge`
  - 🗂 **chat** (brand `kontakto`)
    - app: generic
    - contact: Kontakto: new post
    - 💬 me: At the forum! **Photo with my badge**⟨badge⟩
- 🗣 "Show every gifted device to technical support first. They will check it and decide." — _happy/shield-up, visual: badge-id_

#### simulation · `after-forum` · After the forum
- 🖥 mühit: `desktop` — You are back from the forum. There are gifts on your desk and new mail in your inbox.
  - **step `gift-usb`** · A gift from the visiting delegation — 🗣 "The delegation gave you their presentation on a flash drive."
    - 🗂 **file** (brand `nc-nordvale`)
      - name: Cooperation_presentation.pdf
      - type: lnk
      - size: 2 KB
      - source: USB: NORDVALE (E:)
    - ⚠️ [plug-in] Plug into computer — You do not know what is on a gifted device. Technical support must check it first.
    - ✅ [report] Hand to technical support — Correct. Technical support checks the device on a separate computer and passes the file on if needed. → `partner-mail`
  - **step `usb-file`** · There is one file on the drive
    - 🗂 **file** (brand `nc-nordvale`)
      - name: Cooperation_presentation.pdf
      - type: lnk
      - size: 2 KB
      - source: USB: NORDVALE (E:)
    - 💀 [open] Open — This is not a PDF but a shortcut. Opening it can run a hidden command.
    - ✅ [eject] Eject device — Right decision. Eject the device without opening the file and give it to technical support.
  - **step `partner-mail`** — 🗣 "A guest you met at the forum writes to you."
    - 🗂 **email** (brand `nc-nordvale`)
      - from: Stefan Morgan <s.morgan.nordvale@mail.example>
      - subject: Thank you for our meeting
      - time: 10:24
      - body: Dear colleague, I was very glad to meet you at the forum. / To plan our next meeting, could you send me a list of your department's staff with their positions and phone numbers? / Your manager's schedule for next week would also help.
    - 💀 [reply] Send the list and schedule — A staff list and a manager's schedule are a map for the next attack. Such data goes out only through official channels, with approval.
    - ✅ [forward] Forward to manager and security — Correct. The mail came from a personal address, and requests from outside parties go through official channels.
    - ✅ [reply] Reply: Please send an official request — Good. An official request is checked and answered by someone authorised.
  - **step `bt-pair`**
    - 🗂 **dialog**
      - tone: system
      - title: Bluetooth: pairing request
      - body: "Forum Headset" wants to connect to this computer. / Code: 482 913
      - buttons: Decline, Pair
    - ✅ [deny] Decline — Correct. Never accept a pairing request you did not start yourself.
    - ⚠️ [allow] Pair — An unknown device can pose as a keyboard and type commands. Decline requests like this.

#### hotspot · `forum-post`
- 🔍 Find what this post should not reveal. (ən azı 2)
  - 🗂 **chat** (brand `kontakto`)
    - app: generic
    - contact: Kontakto: new post
    - 💬 me: At the RəqəmYol Forum! **Photo with my badge.**⟨badge⟩ Tomorrow at 10:00 **our delegation meets in the ministry's building 3.**⟨schedule⟩ Right now **I am at Lumera Hotel, room 512**⟨room⟩, see you tomorrow!
  - ⟨badge⟩ **Badge**: The badge shows name, position and an entry QR code. It can be used to forge a badge or to target you.
  - ⟨schedule⟩ **Meeting time and place**: A delegation's time and place are security information. Even after the meeting, keep it general.
  - ⟨room⟩ **Hotel room**: A room number shows who is staying where. Never share it anywhere.

#### choice · `gift-tablet`
- ❓ The visiting delegation gives you a tablet as a gift. What do you do?
  - ✅ Tell my manager and give it to technical support to check — Correct. A gifted device is checked under your organisation's rules and joins the work network only with approval.
  - ❌ Set up my work mail on it right away — An unchecked device may carry spyware. Open work accounts only on your organisation's devices.
  - ❌ Take it home for personal use — The device could open a way into your home network and personal accounts too. Have it checked first.
  - ❌ Connect it to the office Wi-Fi to test it — Connecting an unchecked device to the work network opens a path to internal systems.
- 💡 Until it is checked, a gifted device is a stranger's device. Tell your manager and give it to technical support.

#### scenario · `delegation-visit` · Delegation in the office
- 🎭 start: `slides`
  - **[slides]** Guest (at the meeting) (in-person, 🔊man): "My presentation is on a flash drive. Shall we plug it into your computer?"
    - Let us open it on the separate computer technical support prepared → `wifi` — Correct. The guest's files never touch the work computer or network.
    - Go ahead, time is short ⇒ **risky** — An outside flash drive can bring malware onto a work computer. Use a separate computer for guests.
  - **[wifi]** Guest (in-person, 🔊man): "One more thing, what is the office Wi-Fi password? I need to check my mail."
    - I give access to the guest network → `walk` — Correct. The guest network is kept apart from internal systems.
    - I tell the work network password ⇒ **risky** — The work network carries internal systems. Guests get only the guest network.
  - **[walk]** Guest (during the break) (in-person, 🔊man): "Don't worry, I will look around the office myself."
    - I escort the guest ⇒ **safe** — Excellent. Guests always move around the office with an escort.
    - Let them wander, they are our guest ⇒ **risky** — An unescorted guest can see open offices and documents on desks.

#### recap · `recap`
- ✔ Hand gifted devices to technical support without plugging them in.
- ✔ Do not share your badge, room number or schedule.
- ✔ Guests get a separate computer, the guest network and an escort.

### Event Wi-Fi and charging (`event-wifi-charging`, 3 dəq)

#### tutor · `intro`
- 🗣 "At events, hundreds of people join one network. An attacker can set up another with the same name." — _talk/wave, visual: wifi_
- 🗣 "An open, strong network with a similar name may be a trap. Ask registration for the right name." — _alert/point-left, visual: artifact_, highlight `twin`
  - 🗂 **wifi**
    - networks: 
- 🗣 "For work, use mobile data or your organisation's VPN. Never type your work password on a Wi-Fi sign-in page." — _talk/recite, visual: vpn_
- 🗣 "Instead of a public charging station, plug your own adapter into a socket or use your own power bank." — _think/lean-in, visual: usb_

#### simulation · `forum-wifi` · The forum Wi-Fi
- 🖥 mühit: `browser` — At the forum you joined an open network and the browser opened. Choose the right step on each page.
  - **step `portal-login`** · ReqemYol-Forum-FREE — 🗣 "What is this Wi-Fi page asking for?"
    - 🗂 **login** (brand `nc-reqemyol-fake`)
      - brand: RəqəmYol Forum Wi-Fi
      - url: http://wifi-reqemyol-forum.example.net/login
      - fields: Work email, Work email password
      - button: Connect to internet
    - 💀 [enter-credentials] Connect to internet — A Wi-Fi page never needs your work password. Whoever runs this open network now sees it.
    - ✅ [cancel] Close tab — Correct. Leave the network and ask the registration desk for the right name.
    - ✅ [disconnect] Leave network — Excellent. Leaving an unknown open network is the fastest protection.
  - **step `cert-warning`** — 🗣 "You open work mail and the browser shows a warning."
    - 🗂 **dialog**
      - tone: warning
      - title: Your connection is not secure
      - body: The certificate for poct.idare.example is not valid. / Someone may be trying to read your data.
      - buttons: Go back, Continue anyway
    - ✅ [cancel] Go back — Correct. This warning can mean someone is in the middle of your connection, so switch to mobile data.
    - 💀 [open] Continue anyway — Skipping the warning can hand your password to whoever sits in the middle. Go back and change networks.
  - **step `setup-download`** — 🗣 "The page offers software for the Wi-Fi."
    - 🗂 **file** (brand `nc-reqemyol-fake`)
      - name: ReqemYol_WiFi_Setup.exe
      - type: exe
      - size: 4.1 MB
      - source: wifi-reqemyol-forum.example.net
    - 💀 [open] Open file — Joining Wi-Fi needs no software. This file installs malware on the computer.
    - ✅ [delete] Delete — Correct. An event network never requires you to install software.

#### hotspot · `network-list`
- 🔍 Which networks at the event look suspicious? Find them. (ən azı 2)
  - 🗂 **wifi**
    - networks: 
  - ⟨free⟩ **FREE added**: The network is open and FREE was added to the name. The official name is given at the registration desk.
  - ⟨twin⟩ **Look-alike name**: The name is almost the official one, only one character differs. This may be an evil twin.
  - ⟨charge⟩ **Tempting name**: An open network with a free offer is a classic sign of a trap.

#### choice · `charging`
- ❓ Your phone is at 5 percent and the hall has a public USB charging station. What do you do?
  - ✅ Plug my own adapter into a wall socket — Correct. A socket delivers only power, not data.
  - ✅ Charge from my own power bank — Right. Your own power bank stays under your control.
  - ❌ Connect to the station and tap Trust — Trusting gives the device access to your phone's data. Charging does not need it.
  - ❌ Borrow the cable of the guest next to me — An unknown cable can hide a chip inside. Carry your own cable and adapter.
- 💡 Your own adapter in a socket or your own power bank is the safest. If the phone asks, do not trust.

#### swipe · `event-messages`
- 👉 Things that arrive during the event. Safe, or a threat?
  - ✅ safe `badge-sms`: No link, nothing to pay and nothing to type. This is a normal reminder.
    - 🗂 **sms** (brand `nc-reqemyol`)
      - sender: ReqemYol
      - time: 08:30
      - 💬 Your badge is ready. Bring your ID card to the registration desk.
  - 🛑 threat `cert-mail`: The official site is reqemyol-forum.example, and this is a different domain. A certificate never needs your work password.
    - 🗂 **email** (brand `nc-reqemyol-fake`)
      - from: RəqəmYol Forum <sertifikat@reqemyol-forum.example.info>
      - subject: Your attendance certificate
      - time: 17:05
      - body: Sign in with your work email to download the certificate: reqemyol-forum.example.info/certificate → `https://reqemyol-forum.example.info/certificate`
  - 🛑 threat `qr-table`: Anyone can put up a sticker, and the address is not the forum's. Ask the registration desk for the network name.
    - 🗂 **qr**
      - caption: Sticker on the table: scan for free Wi-Fi
      - destination: http://wifi-giris.example.info/connect
  - ✅ safe `session-note`: This comes from the app you installed from the official store. No link and no request.
    - 🗂 **notification** (brand `nc-reqemyol`)
      - app: RəqəmYol Forum
      - title: Session starts in 15 minutes
      - body: Cybersecurity panel, Hall B.
      - time: 13:45
  - 🛑 threat `trust-prompt`: A charging station should not ask for your files. Choose Don't trust and charging carries on.
    - 🗂 **dialog**
      - tone: system
      - title: Trust this device?
      - body: The connected device wants access to your phone's files.
      - buttons: Don't trust, Trust

#### recap · `recap`
- ✔ Ask the registration desk for the network name, and use mobile data or VPN for work.
- ✔ Never type your work password on a Wi-Fi page or skip a certificate warning.
- ✔ Charge with your own adapter in a socket or your own power bank.


## Fake official accounts (`fake-official-accounts`) · Social engineering · Easy · 200 XP

### Spot the impostor (`spot-the-impostor`, 3 dəq)

#### tutor · `intro`
- 🗣 "Scammers open fake pages and channels in the name of ministries and officials." — _talk/wave, visual: social_
- 🗣 "Look at the address, not the name: an extra letter, word or number gives a fake away." — _think/point-left, visual: artifact_, highlight `handle`
  - 🗂 **url** (brand `nd-sxn-fake`)
    - url: https://kontakto.example/**sxn.rasmi.az2**⟨handle⟩
- 🗣 "A fake account rushes you and asks for money, card details or a click." — _alert/lean-in, visual: mask_
- 🗣 "When in doubt, open the organisation's website yourself and check its list of official accounts." — _happy/recite, visual: shield_

#### simulation · `official-messages` · Messages in an official name
- 🖥 mühit: `phone` — Messages arrive on your phone in a ministry's name. Choose the right step for each.
  - **step `aid-channel`** — 🗣 "The channel name looks official. But where does the link go?"
    - 🗂 **chat** (brand `nd-sxn-fake`)
      - app: telegram
      - contact: Ministry of Social Services | Official
      - 💬 them: Dear citizen! Every family is granted a one-off state payment of 300 AZN.
      - 💬 them: To receive it, enter your card details today: sxn-yardim.example.net/qeydiyyat → `https://sxn-yardim.example.net/qeydiyyat`
    - 💀 [click-link] Open link — This page steals card details. A ministry does not ask for your full card details by message to pay aid.
    - ✅ [report] Report channel — Right. The address is not the ministry's site, and a report gets the channel closed faster.
    - ✅ [block] Block — Good, the channel cannot reach you again. Report it too so others are protected.
    - ⚠️ [share] Send to family group — Sharing an unchecked message sends your family into the trap too. Check the official site first.
  - **step `real-sms`** — 🗣 "Last week you sent an application to the ministry."
    - 🗂 **sms** (brand `nd-sxn`)
      - sender: SXN
      - time: 11:30
      - 💬 Your application 2026-118 has been received. You can see its status in your personal account on sxn.example.
    - ✅ [mark-safe] Mark as safe — Right. It matches the application you made, has no link and asks for nothing.
    - ✅ [report] Report — Caution is fine, but this one is genuine: it asks for nothing and lets you open the site yourself.
  - **step `boss-new-number`** — 🗣 "A familiar title, but a number you do not know."
    - 🗂 **chat**
      - app: whatsapp
      - contact: Head of Office (new number)
      - 💬 them: Hello. This is my new number. I'm in a meeting and can't call.
      - 💬 them: Send me a copy of this morning's official letter here, urgently.
    - 💀 [share] Send the letter — An official document went to an unknown number. Scammers often write in a manager's name like this.
    - ✅ [verify] Call the manager's known number — Well done. Always check a new number through a channel you already know.
    - ✅ [report] Report and block — Right. Tell security as well: colleagues may get the same message.
    - ⚠️ [reply] Who is this? — Replying keeps the chat going, and the scammer has a convincing answer ready. Check by phone.
  - **step `giveaway-page`** · Ministry of Social Services: 1000 free laptops! Sign-up fee 5 AZN — 🗣 "A friend shared this page."
    - 🗂 **url** (brand `nd-sxn-fake`)
      - url: https://kontakto.example/sxn.resmi.official
    - 💀 [click-link] Take part — A state body never charges a fee for a prize. This fake page collects card details.
    - ✅ [report] Report page — Right. The extra word in the address gives it away, and a report gets it removed.
    - ✅ [verify] Check on the ministry's site — Great habit. If the site has no such contest, report the page.

#### hotspot · `fake-channel-signs`
- 🔍 Tap the signs of a fake channel. (ən azı 3)
  - 🗂 **chat** (brand `nd-sxn-fake`)
    - app: telegram
    - contact: Ministry of Social Services** @sxn_rasmi**⟨handle⟩
    - 💬 them: **Today is the last day! **⟨urgent⟩For your compensation payment, **pay a 5 AZN registration fee**⟨fee⟩: **sxn-kompensasiya.example.net**⟨link⟩ → `https://sxn-kompensasiya.example.net`
    - 💬 them: **Comments are closed, no questions please.**⟨no-questions⟩
  - ⟨handle⟩ **Handle**: The official handle is @sxn_resmi. One letter has been changed here.
  - ⟨urgent⟩ **Rush**: Scammers rush you so you have no time to think.
  - ⟨fee⟩ **Fee request**: You never have to pay to receive a state payment.
  - ⟨link⟩ **Link**: The domain is not the ministry's sxn.example.
  - ⟨no-questions⟩ **Closed comments**: Closing comments silences people who would warn others.

#### swipe · `real-or-fake`
- 👉 Official or fake?
  - ✅ safe `official-list`: This is the ministry's own site. Take the list of official accounts from a page like this.
    - 🗂 **url** (brand `nd-sxn`)
      - url: https://sxn.example/elaqe/sosial-sebekeler
  - 🛑 threat `extra-word`: The extra word at the end is a typical sign of a fake. The official address is sxn.resmi.
    - 🗂 **url** (brand `nd-sxn-fake`)
      - url: https://kontakto.example/sxn.resmi.official
  - 🛑 threat `job-fee`: A state body does not ask for money by message for an interview or application.
    - 🗂 **chat** (brand `nd-sxn-fake`)
      - app: telegram
      - contact: Ministry of Social Services | HR
      - 💬 them: Booking a job interview costs 20 AZN. Your place is held after payment.
  - ✅ safe `post-to-site`: It asks for nothing and points to the official site. Still confirm details on the site itself.
    - 🗂 **notification** (brand `kontakto`)
      - app: Kontakto
      - title: Ministry of Social Services
      - body: Reception hours have changed. Details on sxn.example.
      - time: 09:10

#### order · `verify-account`
- 🔢 How do you check an account is official? Put the steps in order.
  1. Type the organisation's website into the browser yourself
  2. Find the links to its official accounts on the site
  3. Compare the account address letter by letter
  4. If it does not match, report the account to the platform
- 💡 Always start the check from the organisation's own site, never from a link in the message.

#### choice · `badge`
- ❓ The account has a verification badge next to its name. Does that prove it is official?
  - ❌ Yes, the badge is a guarantee — On some platforms a badge can be bought, and fakes also put a badge symbol inside the name.
  - ❌ Yes, if it has many followers — Followers can be bought, and an old page can simply be renamed.
  - ✅ No, I check it against the link on the organisation's site — Right. The link on the organisation's own site is the most reliable check.
- 💡 Badges, followers and a neat logo can be faked. The organisation's own site cannot.

#### recap · `recap`
- ✔ Check the account address, not the name: one letter can differ.
- ✔ Official bodies do not ask for card details, fees or urgent payments by message.
- ✔ When in doubt, open the site yourself and report the fake account.

### Stop fake news (`stop-fake-news`, 3 dəq)

#### tutor · `intro`
- 🗣 "Fake news often looks like an official decision and spreads fast in group chats." — _think/shrug, visual: social_
- 🗣 "No source, no date, it rushes you and asks you to send it to everyone." — _alert/point-left, visual: artifact_, highlight `fwd`
  - 🗂 **chat**
    - app: whatsapp
    - contact: Department group
    - 💬 them: **Forwarded. **⟨fwd⟩All salary cards change from tomorrow! **Send to everyone!**⟨share-all⟩
- 🗣 "Before sharing, check the news on the organisation's site and in reliable news outlets." — _talk/shield-up, visual: eye_
- 🗣 "If it is fake, report it to the platform and post a short correction in the group." — _happy/recite, visual: flag_

#### simulation · `group-news` · News in your chats
- 🖥 mühit: `phone` — News arrives in your work and family chats. What do you do with each?
  - **step `salary-card`** — 🗣 "A colleague posted it, but no source is given."
    - 🗂 **chat**
      - app: whatsapp
      - contact: Department group
      - 💬 them: Forwarded. Urgent! From tomorrow civil servants' salary cards are being replaced. Update your details so the old card is not blocked: maas-kart-yeni.example.net → `https://maas-kart-yeni.example.net`
    - 💀 [click-link] Open link — This page harvests card details. Accounting announces salary card changes through official channels.
    - ✅ [verify] Ask accounting — Right. Check an internal decision with an internal source, on a number you know.
    - ✅ [reply] Reply: unverified, do not open the link — Good, you protected your colleagues. Show the message to security as well.
    - ⚠️ [share] Send to family group — Spreading unchecked news pulls others into the trap.
  - **step `news-site`** · Official: all utility debts written off, registration ends today — 🗣 "It looks like a familiar news site. Check the address."
    - 🗂 **url** (brand `nd-gundem24-fake`)
      - url: https://gundem24-az.example.net/xeber/borclar-silinir
    - 💀 [click-link] Register — Gündəm24's address is gundem24.example; this is a clone. The form collects personal data.
    - ⚠️ [share] Share — You would be spreading a cloned site. Check the address and source before sharing.
    - ✅ [verify] Check the official site — Right. A decision like this would be on the organisation's own site.
    - ✅ [cancel] Close tab — Good. The address was not Gündəm24's real domain.
  - **step `relatives-ask`** — 🗣 "Your relatives trust you."
    - 🗂 **chat**
      - app: whatsapp
      - contact: Family group
      - 💬 them: Anyone here working in a state office? They say the internet in Baku will be cut for three days from tomorrow. True?
    - ⚠️ [reply] Probably true, get ready — A state employee's word gives news weight. Do not confirm what you do not know.
    - ✅ [reply] I don't know, I'll check an official source and write back — Right. An honest "I don't know" stops a false story.
    - ⚠️ [share] Forward to other groups — You would carry the false story to even more people.
  - **step `fake-office-page`** · Ministry of Social Services: 50 vacancies. Application fee 10 AZN — 🗣 "This page was opened in your own ministry's name."
    - 🗂 **url** (brand `nd-sxn-fake`)
      - url: https://kontakto.example/sxn.nazirlik.vakansiya
    - 💀 [click-link] Apply — The ministry charges no application fee. The fake page collects people's money and data.
    - ✅ [report] Report to platform — Right. Tell the press office too so it can publish an official warning.
    - ✅ [verify] Tell the press office — Great. Report the page to the platform too so it is removed faster.
    - ⚠️ [ignore] Skip it, not my job — The fake page cheats people in your office's name. Reporting takes a minute.

#### match · `check-tools`
- 🔗 Match each doubt with the right check.
  - The story names no source ⇄ Search the organisation's official site
  - The photo looks familiar and old ⇄ Run a reverse image search
  - The site looks like a familiar news site ⇄ Compare the address with the real domain
  - The story scares and rushes you ⇄ Pause and check before sharing
- 💡 A few seconds of checking can stop a false story from reaching thousands.

#### scenario · `shared-by-mistake` · You shared it by mistake
- 🎭 start: `shared`
  - **[shared]**  (, 🔊-): "This morning you posted the "salary cards are changing" story in the family group. At noon you learned it is fake."
    - I delete it and post a correction → `relative` — Right. A correction stops those who already saw it.
    - I delete it quietly ⇒ **risky** — People who saw it may already be passing it on. A short correction breaks the chain.
    - I do nothing, it's too late ⇒ **risky** — It is not too late: a correction still stops the spread.
  - **[relative]** Your relative (phone, 🔊young-man): "I opened that link and typed in my card details. What do I do now?"
    - Call the bank on the number on your card now and block the card ⇒ **safe** — Right. The sooner the card is blocked, the lower the risk of losing money.
    - Don't worry, maybe nothing will happen ⇒ **compromised** — Scammers often use card details right away.
    - Delete what you typed on the site ⇒ **risky** — The details are already with the scammer. Only the bank can block the card.

#### choice · `speak-for-office`
- ❓ A journalist messages you: "Can you comment on your ministry's decision?" What do you do?
  - ✅ I refer them to the press office — Right. Only the press office speaks for the organisation.
  - ❌ I say what I know — A half-informed comment can become new false news, and the "journalist" may be fake too.
  - ❌ I send a photo of the internal document — Internal documents must not be shared, and a photo can spread without context.
- 💡 Official comments come from the press office. That protects you and the organisation.

#### recap · `recap`
- ✔ Check the source on the organisation's own site before sharing.
- ✔ Do not confirm news you are unsure of; the press office speaks for the organisation.
- ✔ Report fake pages and news; if you shared by mistake, post a correction.


## Password managers at work (`password-managers-work`) · Accounts · Easy · 200 XP

### Why a password manager (`why-a-manager`, 3 dəq)

#### tutor · `intro`
- 🗣 "Every account needs its own long password. Nobody can remember them all." — _talk/wave, visual: key_
- 🗣 "Never reuse a password: when one site leaks, attackers try it on all your accounts." — _alert/shake, visual: eye_
- 🗣 "The organisation's password manager creates a strong password per account and stores it in an encrypted vault." — _talk/point-left, visual: artifact_, highlight `gen`
  - 🗂 **dialog** (brand `parolseyf`)
    - tone: app
    - title: Password created
    - body: **28 characters, random**⟨gen⟩
    - buttons: Save
- 🗣 "You remember just one long master password and protect the vault with two-step verification." — _happy/shield-up, visual: mfa-phone_

#### swipe · `where-passwords-live`
- 👉 Is this a safe place for a password?
  - 🛑 threat `excel`: The file is not encrypted: anyone who gets into the computer sees every password at once.
    - 🗂 **file**
      - name: Parollar_hamisi.xlsx
      - type: xls
      - size: 18 KB
      - source: Desktop
  - ✅ safe `vault`: The password sits in the encrypted vault and opens only with your master password.
    - 🗂 **notification** (brand `parolseyf`)
      - app: ParolSeyf
      - title: Login saved to vault
      - body: portal.idare.example
      - time: 09:05
  - 🛑 threat `saved-messages`: A messenger is not a vault. If the phone is lost or the account taken over, the passwords go too.
    - 🗂 **chat**
      - app: telegram
      - contact: Saved messages
      - 💬 me: Mail password: Aysel1990
  - ✅ safe `shared-vault`: The team shares passwords in an encrypted vault, and access can be removed at any time.
    - 🗂 **dialog** (brand `parolseyf`)
      - tone: app
      - title: Shared vault: Press office
      - body: 3 members. Website admin panel, social media account.
      - buttons: Close

#### simulation · `password-requests` · Password requests
- 🖥 mühit: `phone` — Today several people ask you for passwords. Answer each one on your phone.
  - **step `colleague-asks`** — 🗣 "She is your colleague and really needs access."
    - 🗂 **chat**
      - app: whatsapp
      - contact: Səbinə Hüseynova
      - 💬 them: Hi! Could you type the website admin panel password here? I'm posting today's news.
    - ⚠️ [share] Type the password — The password stays in the chat and can leak if a phone is lost. Share it from the vault.
    - ✅ [reply] I'll share it with you in the vault — Right. In the vault the password stays encrypted, and access can be removed when needed.
    - ⚠️ [reply] I'll send it by SMS — SMS is not encrypted either and stays on the phone. Share passwords only through the vault.
  - **step `fake-share-mail`** — 🗣 "You were not expecting a share."
    - 🗂 **email** (brand `parolseyf-fake`)
      - from: ParolSeyf <no-reply@parolseyf-share.example.net>
      - subject: Elnur Kərimov shared a vault with you
      - time: 11:40
      - body: Sign in to view the "Finance" vault: parolseyf-share.example.net/seyf → `https://parolseyf-share.example.net/seyf`
    - 💀 [click-link] Open link — A real share shows up inside the ParolSeyf app itself. This link is hunting for your master password.
    - ✅ [report] Report phishing — Right: the address is not ParolSeyf's. Open the app yourself to check for shares.
    - ⚠️ [delete] Delete — You are safe, but colleagues may get the same mail. Report it.
  - **step `fake-support`**
    - 🗂 **chat** (brand `parolseyf-fake`)
      - app: telegram
      - contact: ParolSeyf Support
      - 💬 them: We found an error in your vault. To restore it, type your master password and the code you receive here.
    - 💀 [share] Type the master password — The master password unlocks every password you have. No support team ever asks for it.
    - ✅ [block] Block — Right. Nobody, not even technical support, asks for your master password or code.
    - ✅ [report] Report — Great. Tell security as well so they can warn colleagues.
  - **step `reused-alert`** — 🗣 "ParolSeyf has checked your passwords."
    - 🗂 **dialog** (brand `parolseyf`)
      - tone: app
      - title: This password is used on 3 accounts
      - body: The same password is saved for İşPoçt, the office portal and the Kontakto page.
      - buttons: Later, Change passwords
    - ✅ [update] Change passwords — Right. The generator makes a separate password for each account, so one leak opens nothing else.
    - ⚠️ [later] Later — A reused password is a weakness attackers love. One leak would open all three accounts.

#### password · `master-password`
- 🔑 Create a master password: a long phrase of at least 15 characters. (hədəf güc: 4/4)
  - Join four or five random words with spaces
  - Use this password nowhere else
  - Avoid names, birthdays and famous quotes

#### match · `manager-terms`
- 🔗 Match each term with its meaning.
  - Vault ⇄ Encrypted store for your passwords
  - Master password ⇄ The one password that opens the vault
  - Generator ⇄ Creates long, random passwords
  - Shared vault ⇄ Lets a team share passwords safely
- 💡 The manager remembers the passwords; you only guard the master password.

#### choice · `shared-account`
- ❓ Three people in your department run the same social media account. How should they share the password?
  - ✅ Separate logins if possible, otherwise a shared vault — Right. When someone leaves the team, their access is removed in one step.
  - ❌ Post the password in the team chat — A password posted in a group chat stays there for years, and new members see it too.
  - ❌ Write it on a sticky note on the monitor — Anyone who walks in can see the password and take a photo.
- 💡 Even for a shared account, the password lives in the vault, not in chats or on paper.

#### recap · `recap`
- ✔ A separate password for every account: the manager creates and remembers it.
- ✔ Share passwords in a shared vault, never in a chat.
- ✔ Never tell anyone your master password, and protect the vault with two-step verification.

### When autofill stays silent (`autofill-right-site`, 3 dəq)

#### tutor · `intro`
- 🗣 "A password manager spots a fake site better than you: it checks the address letter by letter." — _talk/wave, visual: browser_
- 🗣 "If the address differs even slightly, the manager offers no password. That is your warning sign." — _alert/point-left, visual: artifact_, highlight `lookalike`
  - 🗂 **url** (brand `idare-fake`)
    - url: https://portal.**idare-giris.example.net**⟨lookalike⟩/giris
- 🗣 "Do not copy the password from the vault and paste it yourself. Check the address first." — _think/shake, visual: key_
- 🗣 "Reject any approval request you did not expect: it means someone knows your password." — _happy/shield-up, visual: mfa-phone_

#### simulation · `autofill-check` · Test the autofill
- 🖥 mühit: `browser` — ParolSeyf runs in your browser. On every page, watch what it offers and check the address.
  - **step `real-portal`** — 🗣 "ParolSeyf offers your login. Check the address."
    - 🗂 **login** (brand `idare`)
      - brand: Office portal
      - url: https://portal.idare.example/giris (əslində: `idare.example`)
      - fields: Username, Password
      - button: Sign in
    - ✅ [enter-credentials] Fill with ParolSeyf — Right. The address matches the saved login, which is why the manager offered it.
    - ✅ [cancel] Close tab — Caution is fine, but this is the real office portal and the manager recognised it.
  - **step `lookalike`** — 🗣 "A link in an email opened this page. ParolSeyf stays silent."
    - 🗂 **login** (brand `idare-fake`)
      - brand: Office portal
      - url: https://portal.idare-giris.example.net/giris (əslində: `idare-giris.example.net`)
      - fields: Username, Password
      - button: Sign in
    - 💀 [enter-credentials] Type the password by hand — The manager stayed silent because this is a fake site. Change the password on the real portal now and report it. → `fake-vault`
    - ⚠️ [allow] Find it in ParolSeyf and fill — The manager does not recognise this site, and there is a reason. Read the address before going on.
    - ✅ [cancel] Close tab — Right. The domain was idare-giris.example.net, not the office portal. → `fake-vault`
    - ✅ [report] Report site — Great. Your report protects colleagues from the same link. → `fake-vault`
  - **step `mismatch`**
    - 🗂 **dialog** (brand `parolseyf`)
      - tone: system
      - title: ParolSeyf: site does not match
      - body: Saved address: portal.idare.example / This page: portal.idare-giris.example.net
      - buttons: Cancel, Fill anyway
    - ✅ [cancel] Cancel — Right, the manager caught the difference for you. Close the page and report it.
    - 💀 [allow] Fill anyway — Skipping the warning handed your password to a fake site. Change it now and report it.
  - **step `fake-vault`** — 🗣 "A link in an email takes you to a vault sign-in."
    - 🗂 **login** (brand `parolseyf-fake`)
      - brand: ParolSeyf
      - url: https://parolseyf-giris.example.net/seyf (əslində: `parolseyf-giris.example.net`)
      - fields: Email, Master password
      - button: Open vault
    - 💀 [enter-credentials] Open vault — Type the master password only in the ParolSeyf app itself. This site wanted your whole vault.
    - ✅ [cancel] Close tab — Right. Open the vault by starting the app yourself, never through a link.
    - ✅ [report] Report site — Great. This site may have been sent to several people.

#### hotspot · `vault-lure`
- 🔍 Tap the signs that this email is fake. (ən azı 3)
  - 🗂 **email** (brand `parolseyf-fake`)
    - from: ParolSeyf <**security@parolseyf-alert.example.net**⟨sender⟩>
    - subject: **Your vault will be deleted in 24 hours**⟨deadline⟩
    - time: 07:58
    - body: For a security update, **confirm your master password**⟨ask-master⟩. / Confirm: **parolseyf-alert.example.net/tesdiq**⟨link⟩ → `https://parolseyf-alert.example.net/tesdiq`
  - ⟨sender⟩ **Sender**: The address is a look-alike, not ParolSeyf's domain.
  - ⟨deadline⟩ **Deadline**: A 24-hour threat is there to stop you thinking.
  - ⟨ask-master⟩ **Master password request**: No service asks you to confirm your master password by email.
  - ⟨link⟩ **Link**: The link goes to a fake domain. Open the vault from the app yourself.

#### choice · `unexpected-push`
- ❓ At night ParolSeyf asks you to approve a sign-in, but you are not signing in. What do you do?
  - ✅ I deny it and report it to security — Right. Someone knows your master password: change it now and let security check the sessions.
  - ❌ I approve so the requests stop — This is push bombing. One approval lets the attacker into the vault.
  - ❌ I ignore it and look in the morning — The request stays open, and someone already has your master password. Deny and report it now.
- 💡 An unexpected approval request means your password has leaked. Deny, report, change.

#### match · `autofill-rules`
- 🔗 Match each situation with the right step.
  - The manager offers no password ⇄ Check the address, do not copy the password
  - An email link asks you to open the vault ⇄ Open the app yourself
  - You are on someone else's computer ⇄ Do not open your vault there
  - An approval request you did not expect ⇄ Deny it and report it
- 💡 The manager checks the address; you stop the moment it goes quiet.

#### recap · `recap`
- ✔ If the manager offers no password, stop and check the address.
- ✔ Type the master password only in the manager's own app, never via a link.
- ✔ Deny approval requests you did not expect, and report them.


## Clicked: now what? (`clicked-now-what`) · Incidents · Easy · 200 XP

### The first 15 minutes (`first-15-minutes`, 3 dəq)

#### tutor · `intro`
- 🗣 "Clicked a link or typed your password? It can happen to anyone." — _talk/nod, visual: hook_
- 🗣 "The first fifteen minutes matter most: stolen passwords are often used right away." — _alert/lean-in, visual: stat 15 (minutes that matter most)_
- 🗣 "Change the password on the real site, tell security and keep the email." — _talk/recite, visual: lock_
- 🗣 "Do not hide it. Silence gives the attacker time; an honest report protects everyone." — _think/shake, visual: mask_

#### simulation · `after-the-click` · You typed your password
- 🖥 mühit: `desktop` — You typed your mail password on a fake page and have just realised it. The next steps are yours.
  - **step `retry-trap`** — 🗣 "The page shows an error."
    - 🗂 **dialog** (brand `ispoct-fake`)
      - tone: warning
      - title: Sign-in failed
      - body: Wrong password. Try again or use another password.
      - buttons: Close, Try again
    - 💀 [enter-credentials] Try again — Fake sites show an error so you type the password again, sometimes a different one too.
    - ✅ [cancel] Close — Right, type nothing more. Close the page and move to the next step.
  - **step `the-email`** — 🗣 "The email is still in your inbox."
    - 🗂 **email** (brand `ispoct-fake`)
      - from: İşPoçt Admin <admin@ispoct-mail.example.net>
      - subject: Your mailbox is 98% full
      - time: 09:41
      - body: Increase your storage so mail is not deleted: ispoct-mail.example.net/yer → `https://ispoct-mail.example.net/yer`
    - ✅ [report] Report phishing — Right. Your report lets security remove the email from other inboxes too.
    - ✅ [forward] Forward to security — Good. Do this if there is no report button, then call them too.
    - ⚠️ [delete] Delete it so nobody sees — The email is evidence. Deleted, it cannot help security trace the attack.
  - **step `change-password`** — 🗣 "You typed the address yourself. Change the password."
    - 🗂 **login** (brand `ispoct`)
      - brand: İşPoçt
      - url: https://poct.idare.example/parol
      - fields: Current password, New password
      - button: Change password
    - ✅ [enter-credentials] Change password — Right, the site is genuine. The new password must not resemble the old one.
    - ⚠️ [later] I'll change it tomorrow — Stolen passwords are used fast. Waiting gives the attacker time.
  - **step `reused`**
    - 🗂 **dialog** (brand `parolseyf`)
      - tone: app
      - title: This password is used elsewhere
      - body: Your old mail password is also used on the office portal and the Kontakto page.
      - buttons: Later, Change all
    - ✅ [update] Change all — Right. Attackers try a stolen password on other sites too.
    - ⚠️ [later] Later — Every account with the same password is now exposed. Change them all today.

#### match · `mistake-first-step`
- 🔗 Match each mistake with the first step.
  - I clicked, but typed nothing ⇄ Close the page and report the email
  - I typed my password on a fake page ⇄ Change it on the real site and report
  - I gave a caller my verification code ⇄ Call security right away
  - I typed my card details ⇄ Call the bank on the number on your card
- 💡 Report it every time: specialists check for traces you cannot see.

#### choice · `approved-push`
- ❓ A sign-in request came to your phone and you tapped "Approve" by mistake. What now?
  - ✅ I call security right away and change my password — Right. You let the attacker in; security will throw them out by ending the sessions.
  - ❌ Nothing, it was only once — One approval is enough: the attacker is already in your account.
  - ❌ I switch off the phone — Turning off the phone does not remove the attacker. They are already in.
- 💡 A mistaken approval and a code given away need the same urgent step: report at once.

#### password · `new-password`
- 🔑 Create a new password to replace the stolen one: nothing like the old one. (hədəf güc: 4/4)
  - Do not just tweak the old one: Aysel2027 instead of Aysel2026 will not do
  - Join four random words with spaces
  - Save the new password in the password manager

#### recap · `recap`
- ✔ Type nothing more: close the page and keep the email.
- ✔ Change the password on the real site, and wherever else you used it.
- ✔ Gave a code or tapped approve? Call security right away.

### Files and wrong recipients (`opened-file-sent-wrong`, 3 dəq)

#### tutor · `intro`
- 🗣 "Opened a suspicious file or sent data to the wrong person? Stay calm, the steps are short." — _talk/nod, visual: download_
- 🗣 "Opened the file? Turn off Wi-Fi and unplug the cable. Leave the computer on unless your procedure says otherwise." — _alert/shield-up, visual: wifi_
- 🗣 "Do not delete the file or the email: specialists learn from them what the attack did." — _think/point-left, visual: artifact_, highlight `ext`
  - 🗂 **file**
    - name: Akt_imzala**.docm**⟨ext⟩
    - type: doc
    - size: 84 KB
    - source: n.ismayilov@tender-akt.example.net
- 🗣 "Report by phone, not from the infected computer. And never hide data sent to the wrong person." — _talk/recite, visual: phone-lock_

#### simulation · `file-opened` · You opened the file
- 🖥 mühit: `desktop` — You opened the "Akt_imzala" attachment and allowed macros. Now strange things are happening.
  - **step `av-alert`** — 🗣 "Your antivirus raises an alert."
    - 🗂 **dialog** (brand `qoruyucu`)
      - tone: warning
      - title: Threat detected
      - body: A malicious macro was found in Akt_imzala.docm. Cleanup did not finish.
      - buttons: Close, Details
    - ✅ [disconnect] Turn off Wi-Fi, unplug the cable — Right. Off the network, the computer cannot spread the damage or send data out.
    - 💀 [cancel] Close and keep working — The cleanup did not finish, so the program may still run. Every minute helps it spread.
    - ⚠️ [delete] Delete the file — Deleting destroys evidence and does not stop what already ran. Disconnect first.
  - **step `fake-helper`** — 🗣 "A notification offers help."
    - 🗂 **notification** (brand `texkomek-24`)
      - app: TexKömək 24
      - title: Your computer is infected
      - body: Give TexKömək 24 remote access to clean it now.
      - time: 10:07
    - 💀 [allow] Allow remote access — Remote access for an unknown app hands the attacker the whole computer. Help comes only from your own technical support.
    - ✅ [deny] Decline — Right. Do not try to clean it yourself; wait for security.
  - **step `keep-evidence`** — 🗣 "The file is still in Downloads."
    - 🗂 **file**
      - name: Akt_imzala.docm
      - type: doc
      - size: 84 KB
      - source: Downloads
    - 💀 [open] Open again — Every open can run the macro again. Leave the file alone.
    - ⚠️ [delete] Delete — Security needs the file to find out what it did. Do not delete it.
    - ✅ [ignore] Leave it as it is — Right. The file is evidence; security will examine it safely.
  - **step `reconnect`** — 🗣 "You want to check your mail, but there is no network."
    - 🗂 **dialog**
      - tone: system
      - title: No network connection
      - body: Wi-Fi is off. Do you want to reconnect?
      - buttons: Stay offline, Connect
    - ⚠️ [connect] Connect — Stay offline until security says so: the program could encrypt your files or spread.
    - ✅ [disconnect] Stay offline — Right. Now call security from your phone and tell them what you opened.

#### choice · `power-off`
- ❓ The computer is infected and offline. Should you shut it down?
  - ✅ No, I leave it on unless our procedure says otherwise — Right. Traces in memory matter to the specialists.
  - ❌ Yes, I shut it down at once — Shutting down wipes traces in memory. Disconnecting already stops the spread.
  - ❌ No, I keep working on it — Working on an infected computer puts your passwords and files at risk.
- 💡 Disconnect, leave it on, report by phone. If your organisation's procedure differs, follow it.

#### order · `after-file`
- 🔢 You opened a suspicious file. Put the steps in order.
  1. Disconnect the computer from the network
  2. Call security from your phone
  3. Say exactly what you opened and when
  4. Change your passwords from another, clean device
- 💡 Never change passwords on the infected computer: the program could read the new ones too.

#### scenario · `wrong-recipient` · Wrong recipient
- 🎭 start: `sent`
  - **[sent]**  (, 🔊-): "You sent the list to an outside address with the same name instead of your colleague Kamran. It holds citizens' names and phone numbers."
    - I tell my manager and security right away → `advice` — Right. If personal data has leaked, the organisation must know in time.
    - I tell nobody, maybe they won't open it ⇒ **compromised** — If the leak stays hidden, the organisation cannot do anything to protect the citizens.
    - I just ask the recipient to delete it, that's all ⇒ **risky** — Asking helps, but the organisation still needs to know about the leak.
  - **[advice]** Security team (phone, 🔊man-3): "Write politely to the recipient, ask them to delete the file and confirm it."
    - I write and forward the reply to the specialist ⇒ **safe** — Great. The written confirmation records that the leak was contained.
    - I resend the file to Kamran and forget it ⇒ **risky** — Sending it to the right person is good, but the copy at the wrong address remains.
    - I delete my sent email so no trace remains ⇒ **risky** — The sent email shows what went where and when. Keep it.

#### swipe · `colleague-reactions`
- 👉 Did your colleague do the right thing?
  - ✅ safe `farid`: Right: disconnect first, then report by phone.
    - 🗂 **chat**
      - app: generic
      - contact: Fərid
      - 💬 them: I opened a strange file. I turned off Wi-Fi and I'm calling security now.
  - 🛑 threat `leyla`: Deleting destroys the trail, and hiding gives the attack time.
    - 🗂 **chat**
      - app: generic
      - contact: Leyla
      - 💬 them: I opened the file, then deleted it. Nobody will know.
  - 🛑 threat `elvin`: Installing tools yourself can wipe traces and bring in new malware.
    - 🗂 **chat**
      - app: generic
      - contact: Elvin
      - 💬 them: A virus popped up, so I downloaded a free cleaner from the internet.
  - ✅ safe `narmin`: Right. A quick report limits the damage.
    - 🗂 **chat**
      - app: generic
      - contact: Nərmin
      - 💬 them: I sent a document to an outside address by mistake. I told my manager and security right away.

#### recap · `recap`
- ✔ Opened a bad file? Disconnect, leave it on unless your procedure says otherwise, report by phone.
- ✔ Do not delete the file or the email, and do not try to clean up yourself.
- ✔ Sent something to the wrong person? Do not hide it: tell your manager and security at once.


## Fake Tech Support (`tech-support-scams`) · Social engineering · Medium · 200 XP

### Panic on Screen (`popup-panic`, 3 dəq)

#### tutor · `ts1-tutor`
- 🗣 "Hello! Today we will spot the scary warnings that pop up on your screen." — _talk/wave, visual: browser_
- 🗣 "A window like this wants to scare you into calling a number." — _alert/point-left, visual: artifact_, highlight `phone`
  - 🗂 **dialog** (brand `w2a-sistem-muhafize`)
    - tone: warning
    - title: Your computer is blocked
    - body: **The system found four viruses.**⟨virus⟩ / **Support line: +994 12 000 70 05**⟨phone⟩
    - buttons: Call now
- 🗣 "A real warning never gives you a phone number and never rushes you." — _think/shake, visual: shield_
- 🗣 "The rule is simple: do not call, close the window, force quit the browser if needed." — _happy/shield-up, visual: browser_

#### hotspot · `ts1-hotspot`
- 🔍 Find the signs that this window is a trick. (ən azı 2)
  - 🗂 **dialog** (brand `w2a-sistem-muhafize`)
    - tone: warning
    - title: Warning: your computer is blocked
    - body: The system found four viruses and your personal data is at risk. / **Do not close this window or all your files will be deleted.**⟨dont-close⟩ / **Call the support line now: +994 12 000 70 05**⟨phone⟩ / **Time left: 04:58**⟨timer⟩
    - buttons: Call now
  - ⟨dont-close⟩ **No closing allowed**: A real system never forbids you to close a window. This is fear, meant to keep you there.
  - ⟨phone⟩ **Phone number**: An operating system never shows a support number on screen. This number belongs to the scammer.
  - ⟨timer⟩ **Countdown**: The timer is there to rush you. A warning that gives no time to think is fake.

#### simulation · `ts1-sim` · While reading the news
- 🖥 mühit: `browser` — You are reading a news site and windows suddenly pop up. Choose the right step for each one.
  - **step `popup-appears`** — 🗣 "A red warning just opened."
    - 🗂 **dialog** (brand `w2a-sistem-muhafize`)
      - tone: warning
      - title: Threat detected
      - body: There is malware on your computer. Call support now: +994 12 000 70 05
      - buttons: Call now, Scan
    - ✅ [cancel] Close the window — Correct. Simply closing a window like this is the right answer.
    - 💀 [call-back] Call the number shown — The fake agent will scare you even more. Never call this number.
    - ⚠️ [click-link] Press the Scan button — That button opens another fake page. Do not touch anything in the window.
  - **step `fullscreen-lock`** — 🗣 "Now the screen is full and it is making a sound."
    - 🗂 **dialog** (brand `w2a-sistem-muhafize`)
      - tone: warning
      - title: Screen locked
      - body: Do not turn off the computer. If you close this without support, your data will be lost.
      - buttons: Call support
    - ✅ [cancel] Force quit the browser — Correct. When you force the browser to close, this fake screen disappears too.
    - 💀 [call-back] Call support — The sound and full screen are only there to scare you. If you call, they will try to control your device.
  - **step `real-update`** — 🗣 "This is the browser's own quiet notice."
    - 🗂 **dialog**
      - tone: system
      - title: Browser ready to update
      - body: Restart the browser to apply the changes.
      - buttons: Later, Update
    - ✅ [update] Update — Correct. A real update is calm, gives no number and does not rush you.
    - ✅ [later] Later — That is fine too. You can update whenever you like, there is no danger.
    - ⚠️ [call-back] Call support just in case — There is no need. A simple update notice does not require calling anyone.
  - **step `popup-returns`** — 🗣 "You closed it, but the window came back."
    - 🗂 **dialog** (brand `w2a-sistem-muhafize`)
      - tone: warning
      - title: The threat continues
      - body: The problem is not solved. Call now for help.
      - buttons: Call now
    - ✅ [cancel] Close the whole browser — Correct. When you close the browser fully, these pages go away too.
    - ✅ [report] Tell tech support — Good step. You can call your own tech support and ask about it.
    - 💀 [call-back] Call the number — The window coming back is part of the trick. Do not call that number.

#### match · `ts1-match`
- 🔗 Match each sign to the right response.
  - A window filling the whole screen ⇄ Force quit the browser
  - A support number on the screen ⇄ A real warning gives no number
  - A countdown clock ⇄ The rush is a lie
  - An alarm and a beep ⇄ It is there to scare you
- 💡 All of these signs exist to scare you. Stay calm and close the window.

#### choice · `ts1-choice`
- ❓ A window pops up and tells you to call a number. What is the first step?
  - ✅ I close the window and force quit the browser if needed — Correct. A warning like this is harmless and disappears when you close it.
  - ❌ To be safe, I call the number shown — That number belongs to the scammer. If you call, they will try to control your device.
  - ❌ I turn the computer off right away — There is no need. Closing the window or the browser is enough.
- 💡 The scary window wants to pull you into a call. Do not call, just close it.

#### recap · `ts1-recap`
- ✔ Do not trust a scary window that pops up out of nowhere
- ✔ Never call the number it shows
- ✔ Close the window, force quit the browser if needed

### The Support Call (`the-support-call`, 3 dəq)

#### tutor · `ts2-tutor`
- 🗣 "This time the scam comes by phone: a fake bank security team calls you." — _talk/wave, visual: phone-lock_
- 🗣 "They say your card is stolen and you must move money to a safe account." — _alert/lean-in, visual: alarm_
- 🗣 "There is no such safe account, and no bank asks you to install an app." — _think/shake, visual: shield_
- 🗣 "End the call and dial the number on the back of your card yourself." — _happy/shield-up, visual: key_

#### scenario · `ts2-scenario` · A call from the bank
- 🎭 start: `claim`
  - **[claim]** SahilBank security (phone, 🔊man-2): "There is a suspicious payment on your card. We must move the money to a safe account."
    - I end the call and dial the number on the back of my card myself → `verify` — Correct. The only way to check is to find the number yourself and call.
    - I give my card details so they can check ⇒ **compromised** — A real bank does not ask for your card number or code. With this they empty your account.
    - I install the app they ask for ⇒ **compromised** — The app hands them your phone. A bank never asks you to install such an app.
  - **[verify]** Bank operator (number on the back of your card) (phone, 🔊woman): "We did not send any such warning."
    - I report the call and the suspicious number ⇒ **safe** — Great. The bank can now watch your account and warn others too.
    - I do not worry, it was probably a mistake ⇒ **risky** — The scammer may call again. Telling the bank what happened protects you.

#### simulation · `ts2-sim-call` · The fake support call
- 🖥 mühit: `call` — A call comes in from your bank. Read what the caller says and choose your answer each time.
  - **step `ring`**
    - 🗂 **call** (brand `sahilbank-fake`)
      - caller: SahilBank security
      - number: +994 12 000 54 30
      - label: Mobile
      - voice: man-3
    - ✅ [answer] Answer — Answering itself is not dangerous. What matters is that you give nothing away.
    - ✅ [decline] Decline — That works too. Then call the number on the back of your card yourself. → `after`
  - **step `pitch`** — 🗣 "Hello, this is Tural from SahilBank security. Twelve hundred manat, excuse me, was taken from your card."
    - 🗂 **call** (brand `sahilbank-fake`)
      - caller: SahilBank security
      - number: +994 12 000 54 30
      - label: Mobile
      - voice: man-3
    - ✅ [keep-private] I listen but say nothing — Good. You may listen, as long as you give no information.
    - ✅ [hang-up] End the call — Right choice. A bank does not call like this, so ending it is correct. → `after`
  - **step `ask-code`** — 🗣 "A code just arrived on your phone to confirm. Please read that code to me."
    - 🗂 **call** (brand `sahilbank-fake`)
      - caller: SahilBank security
      - number: +994 12 000 54 30
      - label: Mobile
      - voice: man-3
    - ✅ [keep-private] I do not read the code — Correct. The code that arrives is the key to your account, never tell it to anyone.
    - 💀 [share] I read the code — The moment you read it out, they get into your account. A bank never asks for this code. → `after`
  - **step `install`** — 🗣 "So I can help you, please install the UzaqMasa app and let me connect."
    - 🗂 **call** (brand `sahilbank-fake`)
      - caller: SahilBank security
      - number: +994 12 000 54 30
      - label: Mobile
      - voice: man-3
    - ✅ [deny] I do not install the app — Correct. You never install a remote access app because a caller asks you to.
    - 💀 [install] Install the app — Now the caller sees your screen and controls your phone. Never install such an app. → `after`
  - **step `after`** · The call has ended. What do you do now?
    - 🗂 **call** (brand `sahilbank-fake`)
      - caller: SahilBank security
      - number: +994 12 000 54 30
      - label: Mobile
      - voice: man-3
    - ✅ [call-back] Call the number on the back of the card — Correct. The bank will confirm the call was fake and check your account.
    - ⚠️ [call-back] Call back the number that called — That number goes to the scammer again. Only take the number from your card.
    - ⚠️ [ignore] Do nothing — The scammer may try again. To be safe, call the bank yourself.

#### order · `ts2-order`
- 🔢 Put the steps in order when a call like this claims to be the bank.
  1. End the call
  2. Find the number on the back of your card
  3. Call that number yourself
  4. Tell the bank what happened
- 💡 This is the only way to check: end the call and dial the number you found yourself.

#### choice · `ts2-choice`
- ❓ You already installed the help app the caller asked for. What do you do now?
  - ✅ I disconnect, tell tech support and call the bank myself — Correct. Disconnecting stops the connection, then asking for help is the right move.
  - ❌ I keep the app, maybe I will need it — While the app stays, they control your phone. Disconnect and remove it at once.
  - ❌ I wait, since nothing happened — Waiting adds to the harm. The sooner you report it, the more you can save.
- 💡 If the app is already there, disconnect at once, tell tech support and call the bank on the number on your card.

#### recap · `ts2-recap`
- ✔ There is no such thing as a safe account
- ✔ Do not install an app because a caller asks
- ✔ End the call and dial the number on your card yourself


## Fake CAPTCHA (`fake-captcha-commands`) · Devices · Medium · 200 XP

### The Robot Check (`robot-check-trap`, 3 dəq)

#### tutor · `fc1-tutor`
- 🗣 "Hello! Today we will spot fake pages that pretend to be a robot check." — _talk/wave, visual: browser_
- 🗣 "A page like this gives three steps: press keys, paste a text, confirm." — _alert/point-left, visual: artifact_, highlight `paste`
  - 🗂 **dialog** (brand `w2a-xezer-forum-fake`)
    - tone: app
    - title: Confirm you are human
    - body: 1. Press the keys shown together. / **2. Paste the copied text.**⟨paste⟩ / 3. Press Enter.
    - buttons: I am not a robot
- 🗣 "A real check never asks you to type a command on your keyboard." — _think/shake, visual: shield_
- 🗣 "The rule: whatever a site tells you to type, do not, and close the page." — _happy/shield-up, visual: browser_

#### hotspot · `fc1-hotspot`
- 🔍 Find the warning signs on this check page. (ən azı 2)
  - 🗂 **dialog** (brand `w2a-xezer-forum-fake`)
    - tone: app
    - title: Confirm you are human
    - body: To continue, complete the steps below: / **1. Press the keys on your keyboard that open a window.**⟨keys⟩ / **2. Paste the copied text into the box.**⟨paste⟩ / **3. Confirm with the Enter key.**⟨enter⟩ / **This check is needed to detect bots.**⟨excuse⟩
    - buttons: I am not a robot
  - ⟨keys⟩ **Pressing keys**: A real check never asks you to press keyboard keys. This is how a hidden command gets run.
  - ⟨paste⟩ **Pasting**: The text you paste is really a hidden command. Never paste what a site tells you to.
  - ⟨enter⟩ **The confirm key**: When you confirm, the command runs and harmful software is installed. Do not take this step.
  - ⟨excuse⟩ **A fake excuse**: Detecting bots is the excuse. A real check asks you to pick pictures or tick a box.

#### simulation · `fc1-sim` · On the forum site
- 🖥 mühit: `browser` — On a conference site you meet several checks. Choose the right step for each one.
  - **step `clickfix`** — 🗣 "The page tells you to press keys and paste."
    - 🗂 **dialog** (brand `w2a-xezer-forum-fake`)
      - tone: app
      - title: Confirm you are human
      - body: To continue, press the keys shown and paste the text.
      - buttons: Start, Close
    - ✅ [cancel] Close the page — Correct. A check that asks you to type a command is fake, so closing it is the right step.
    - 💀 [install] Follow the steps — The hidden command you pasted installed harmful software. Never follow steps like these.
    - ✅ [report] Report to tech support — Good step. Showing this page to tech support protects your colleagues too.
  - **step `real-captcha`** — 🗣 "This is an ordinary picture check."
    - 🗂 **dialog** (brand `w2a-xezer-forum`)
      - tone: app
      - title: Select the pictures
      - body: To show you are not a robot, select the pictures with traffic lights.
      - buttons: Confirm, Refresh
    - ✅ [verify] Select the pictures and confirm — Correct. This is what a real check looks like: pick pictures or tick a box.
    - ✅ [cancel] Close the page — That is fine too. If you do not want to continue, you can just close it.
    - ⚠️ [report] Report as an attack — This check is safe, so there is no need to report it. Only checks that ask for commands are fake.
  - **step `fix-pdf`** — 🗣 "This page gives you a command to open a document."
    - 🗂 **dialog** (brand `senedoxu-fake`)
      - tone: app
      - title: The document will not open
      - body: The PDF could not be shown. To fix it, copy and run the command below. / [unknown text copied by the site]
      - buttons: Fix, Close
    - ✅ [cancel] Close the page — Correct. A page that says a document will not open is the same trap, so close it.
    - 💀 [install] Run the command — This command installed harmful software on the computer. Do not trust a page that says a document will not open.
    - ✅ [report] Report to tech support — Good choice. Tech support can check the page and warn others.
  - **step `fix-meeting`** — 🗣 "Now it says the meeting app has an error."
    - 🗂 **dialog** (brand `w2a-gorus-fake`)
      - tone: app
      - title: Meeting error
      - body: To join the meeting, run this command, then refresh the page.
      - buttons: Run the command, Close
    - ✅ [cancel] Close the page — Correct. A meeting app never asks you to run a command, so this is a trap too.
    - 💀 [install] Run the command — The command started harmful software. Any command that claims to fix an error is the same trick.
    - ✅ [report] Report to tech support — Great. Reporting fake error pages like this to tech support helps everyone.

#### swipe · `fc1-swipe`
- 👉 Is each check real or a trap?
  - ✅ safe `image-captcha`: This is an ordinary check. Ticking a box or picking pictures is safe.
    - 🗂 **dialog** (brand `w2a-xezer-forum`)
      - tone: app
      - title: Tick the box
      - body: Tick the I am not a robot box and continue.
      - buttons: Continue
  - 🛑 threat `keystroke-captcha`: A check that asks you to type a command is fake. Close the page.
    - 🗂 **dialog** (brand `w2a-xezer-forum-fake`)
      - tone: app
      - title: Complete the check
      - body: Press the keys that open a window and paste the text.
      - buttons: Start
  - ✅ safe `letters-captcha`: This is an ordinary check. Typing the letters from a picture starts nothing on your computer.
    - 🗂 **dialog** (brand `w2a-xezer-forum`)
      - tone: app
      - title: Type the letters
      - body: Type the letters from the picture into the box below.
      - buttons: Confirm
  - 🛑 threat `paste-run`: Never run a text a site tells you to copy. It is a hidden command.
    - 🗂 **dialog** (brand `senedoxu-fake`)
      - tone: app
      - title: To continue
      - body: Copy this text and paste it into the Run box.
      - buttons: Copy

#### choice · `fc1-choice`
- ❓ What can a real robot check ask of you? Select all that apply.
  - ✅ Tick a box — Correct. Ticking a box is an ordinary check and it is safe.
  - ✅ Pick pictures — Correct. Picking pictures is another kind of real check.
  - ✅ Type the letters from a picture — Correct. Typing letters starts nothing on your computer.
  - ❌ Press keys and paste a text — This is the trap. A real check never sends you to your computer's own windows.
- 💡 A real check stays inside the page. A check that sends you to press keys and paste a text is fake.

#### recap · `fc1-recap`
- ✔ A real check never asks you to type a command
- ✔ Never paste a text a site tells you to
- ✔ Close such a page and report it to tech support

### The Copied Command (`the-copied-command`, 3 dəq)

#### tutor · `fc2-tutor`
- 🗣 "This time a fake page tells you to copy a text and paste it into the Run box." — _talk/wave, visual: download_
- 🗣 "That text is really a hidden command, and when it runs it installs harmful software." — _alert/lean-in, visual: ransomware_
- 🗣 "Never paste any text a site tells you to copy into the Run box." — _think/shake, visual: shield_
- 🗣 "If you already did, disconnect and tell tech support right away." — _happy/recite, visual: alarm_

#### simulation · `fc2-sim` · The Run box
- 🖥 mühit: `desktop` — A page said a document will not open and led you here. Choose the right step each time.
  - **step `run-box`** — 🗣 "The Run box is open, and it holds an unknown text the site copied."
    - 🗂 **dialog**
      - tone: system
      - title: Run
      - body: The text the site copied has been pasted into the box: / [unknown text copied by the site]
      - buttons: Cancel, OK
    - ✅ [cancel] Cancel and close — Correct. Cancelling stops the text from running, then tell tech support what happened.
    - 💀 [install] Run it with OK — The command ran and installed harmful software in the background. Never run anything in a box like this.
    - ✅ [report] Report to tech support — Good choice. Tech support can work out what happened.
  - **step `script-window`** — 🗣 "Now an unknown window opens and asks for permission to continue."
    - 🗂 **dialog**
      - tone: warning
      - title: Unknown script
      - body: An unknown script is trying to run. Continue?
      - buttons: Stop, Continue
    - ✅ [cancel] Stop — Correct. Stopping a script you did not expect prevents the harm.
    - 💀 [allow] Continue — The script continued and installed harmful software. Do not allow an unknown script.
  - **step `real-update`** — 🗣 "This is the system's own update window."
    - 🗂 **dialog** (brand `sistem-yenileme`)
      - tone: system
      - title: A system update is ready
      - body: Do you want to apply the update now?
      - buttons: Later, Update
    - ✅ [update] Update — Correct. The system's own update is safe and never asks you for a command.
    - ✅ [later] Later — That is fine too. You can apply the update at a convenient time.
    - ⚠️ [report] Report as suspicious — There is no need. This is the system's ordinary update notice.
  - **step `beacon`** — 🗣 "A notice says the computer is connecting to an unknown address."
    - 🗂 **notification** (brand `it-tehlukesizlik`)
      - app: IT Security
      - title: Unusual network activity
      - body: Your computer is sending data to an unknown server.
      - time: 14:20
    - ✅ [disconnect] Cut the internet — Correct. Cutting the connection stops the data from leaving.
    - ✅ [report] Report to tech support — Great. Now tech support can check and clean the computer.
    - 💀 [ignore] Close it and keep working — The software keeps sending data. Never ignore a notice like this.

#### order · `fc2-order`
- 🔢 You ran the command a site gave you. Put the steps in order.
  1. Unplug the cable or turn off Wi-Fi
  2. Call tech support right away
  3. Say what you pasted and where
  4. Change passwords from another, clean device
- 💡 First cut the connection, then call right away. Unless your procedure says otherwise, do not turn the computer off.

#### choice · `fc2-choice`
- ❓ A site tells you to copy a text and paste it into the Run box. What do you do?
  - ✅ I do not, and I close the page — Correct. No site asks you to run a command, so this is a trap.
  - ❌ I paste it so I can continue — That text is a hidden command and it installs harmful software. Never paste it.
  - ❌ I paste it if the site looks official — An official look is easy to fake. The rule is simple: never run such a text.
- 💡 The text a site tells you to copy is a hidden command. Do not paste it, close the page.

#### match · `fc2-match`
- 🔗 Match each situation to the right response.
  - A check asks you to press keys ⇄ It is fake, close the page
  - A document will not open, run a command ⇄ Same trap, do not do it
  - A real check ⇄ Pick pictures or tick a box
  - You already ran the command ⇄ Disconnect and report
- 💡 Every page that asks for a command is fake. If you already ran it, disconnect and tell tech support.

#### recap · `fc2-recap`
- ✔ Never paste a text from a site into the Run box
- ✔ Every page that asks for a command is fake
- ✔ If you did it, disconnect and tell tech support


## Messenger Account Hijack (`messenger-hijack`) · Accounts · Medium · 200 XP

### A Code by Mistake (`code-by-mistake`, 3 dəq)

#### tutor · `mh1-tutor`
- 🗣 "Hello! Today we will spot people who try to take over your messenger account." — _talk/wave, visual: social_
- 🗣 "All they need is the six-digit code that arrives on your phone." — _alert/point-left, visual: artifact_, highlight `code`
  - 🗂 **sms** (brand `sohbet`)
    - sender: Söhbət
    - time: 10:03
    - 💬 Your Söhbət code: **731 064**⟨code⟩. Do not share this code with anyone.
- 🗣 "Never give this code to anyone: not a friend, not a colleague, not even support." — _think/shake, visual: mfa-phone_
- 🗣 "If someone asks for money in a message, call them on the phone and ask yourself." — _happy/recite, visual: phone-lock_

#### scenario · `mh1-scenario` · A colleague's message
- 🎭 start: `start`
  - **[start]**  (, 🔊-): "A message comes from your colleague Rəna, and a minute later a Söhbət code lands on your phone. What do you do?"
    - I do not send the code, I call Rəna on the phone → `call` — Correct. The code is the key to your own account, and a normal call shows whether Rəna really wrote.
    - I send the code, she is a colleague after all → `taken` — That was the code for your account, not hers. The moment you send it, your account passes to someone else.
    - I do not answer and delete the message ⇒ **risky** — Not giving the code is right. But Rəna's account has been stolen, so call her and let her know.
  - **[call]** Rəna (on the phone) (phone, 🔊young-woman): "I sent nothing! I have not been able to get into my account since last night."
    - I tell her to log in again with her number, and we warn the work group ⇒ **safe** — Great. Logging in again gets the account back, and the group will not trust the fake messages.
    - Nothing happened to me, so I drop it ⇒ **risky** — They will write to others from Rəna's account. Helping her and the group protects everyone.
  - **[taken]**  (, 🔊-): "You sent the code. Soon Söhbət logs you out, and a message asking for money goes to the group in your name."
    - I log in again with my number and turn on two-step verification ⇒ **risky** — That is the right way to recover. Best of all, though, is never giving the code.
    - I wait, maybe it will fix itself ⇒ **compromised** — While you wait, they keep asking your friends for money. Log in again with your number right away.

#### simulation · `mh1-sim` · Morning messages
- 🖥 mühit: `phone` — Several messages have arrived on your phone. Open each one and choose the right step.
  - **step `group-money`** · 09:12 Department group — 🗣 "A message comes to the group from your head of department's account."
    - 🗂 **chat** (brand `sohbet`)
      - app: generic
      - contact: Department group
      - 💬 them: Elnarə Hüseynova: Hello all. I urgently need 300 manat, I will pay it back tonight.
      - 💬 them: Elnarə Hüseynova: I will send the card number privately. Do not call, I am in a meeting.
    - ✅ [verify] Call Elnarə on the phone — Correct. Calling the number you know shows at once who wrote the message.
    - 💀 [reply] I will send it, write the card — The money will go to the thief's card. An urgent money request that says do not call is a classic trick.
    - ✅ [report] Report as a fake message in the group — Good step. Then call Elnarə and help her get her account back.
  - **step `code-sms`** · 09:20 Söhbət — 🗣 "A Söhbət code arrived, though you did not ask for one."
    - 🗂 **sms** (brand `sohbet`)
      - sender: Söhbət
      - time: 09:20
      - 💬 Your Söhbət code: 731 064. Do not share this code with anyone.
    - ✅ [keep-private] I give the code to no one — Correct. If a code you did not ask for arrives, someone is trying to get into your account.
    - ✅ [delete] Delete the SMS — That works too. What matters is that the code goes to no one.
  - **step `friend-asks`** · 09:21 Aysel Məmmədova — 🗣 "A minute later a message comes from your friend Aysel."
    - 🗂 **chat** (brand `sohbet`)
      - app: generic
      - contact: Aysel Məmmədova
      - 💬 them: Hi dear, did you get a code? I sent mine to your number by mistake.
      - 💬 them: Please send it quickly, my phone is getting blocked.
    - 💀 [share] Send her the code — That was the code for your account. Now your account is in the hands of whoever stole Aysel's.
    - ✅ [verify] Call Aysel on the phone — Correct. A code that came to you belongs to your account, and the call warns the real Aysel.
    - ⚠️ [block] Block — Not giving the code is right. But Aysel's account has been stolen, so let her know another way.
  - **step `new-device`** · 09:30 Söhbət — 🗣 "Now Söhbət sent a notice about a new device."
    - 🗂 **notification** (brand `sohbet`)
      - app: Söhbət
      - title: New device linked
      - body: Computer, Ganja. If this was not you, check your linked devices.
      - time: 09:30
    - ✅ [open] Open and remove the device — Correct. Once you remove a device you do not know, it can no longer read your messages.
    - 💀 [ignore] Dismiss the notice — That device sees all your chats. When you see a notice like this, check right away.
  - **step `fake-support`** · 09:41 Söhbət Support — 🗣 "The last message claims to be from Söhbət support."
    - 🗂 **chat** (brand `w2a-sohbet-fake`)
      - app: generic
      - contact: Söhbət Support
      - 💬 them: There is a suspicious login on your account and it will be blocked in one hour.
      - 💬 them: To confirm, write the code you received on your phone here.
    - ✅ [block] Block and report — Correct. Real support never asks for your code.
    - 💀 [share] Write the code — Whoever writes in the name of support is a scammer. The moment you send the code, your account is theirs.

#### hotspot · `mh1-hotspot`
- 🔍 Find the signs of a trick in this message. (ən azı 2)
  - 🗂 **chat** (brand `sohbet`)
    - app: generic
    - contact: Department group
    - 💬 them: Elnarə Hüseynova: **I urgently need 300 manat**⟨urgent⟩, **I will pay it back tonight.**⟨return⟩
    - 💬 them: **I will send the card number privately.**⟨card⟩ **Do not call, I am in a meeting.**⟨no-call⟩
  - ⟨urgent⟩ **Urgent money**: Rushing leaves no time to think. An urgent money request always needs checking.
  - ⟨no-call⟩ **Do not call**: Avoiding a call is the strongest sign. The thief cannot let you hear their voice, so they write.
  - ⟨card⟩ **A private card**: The money goes to a card you do not know. Nothing shows that this card is Elnarə's.
  - ⟨return⟩ **A promise to repay**: The quick repayment promise is there to calm you. Call and check first.

#### choice · `mh1-choice`
- ❓ Your account has already been stolen. What is the first step?
  - ✅ I log in to Söhbət again with my number — Correct. The new code comes only to your phone, and the account returns to you.
  - ❌ I open a new account and forget the old one — The old account stays with the thief. They will keep asking your friends for money.
  - ❌ I write to the thief and ask for the account back — The thief will not give it back and may even ask for money. Log in again with your number.
- 💡 Log in again with your number, turn on two-step verification and warn your friends another way.

#### recap · `mh1-recap`
- ✔ Never give the code to anyone, not even a friend
- ✔ Check a money request with a normal phone call
- ✔ If the account is gone, log in again with your number

### Devices and Votes (`device-and-votes`, 3 dəq)

#### tutor · `mh2-tutor`
- 🗣 "There is also a quiet way to steal an account: a voting link and a hidden linked device." — _talk/wave, visual: social_
- 🗣 "If you see a notice like this, your account is open on another device too." — _alert/point-left, visual: artifact_, highlight `device`
  - 🗂 **notification** (brand `sohbet`)
    - app: Söhbət
    - title: **New device linked**⟨device⟩
    - body: Computer, Ganja. If this was not you, check your linked devices.
    - time: 21:14
- 🗣 "Do not trust a page that wants your messenger login before you can vote." — _think/shake, visual: browser_
- 🗣 "Turn on two-step verification and check your linked devices from time to time." — _happy/recite, visual: lock_

#### swipe · `mh2-swipe`
- 👉 Is each notice safe or a threat?
  - 🛑 threat `unasked-code`: If you did not ask for it, someone is trying to log in with your number. Give the code to no one.
    - 🗂 **sms** (brand `sohbet`)
      - sender: Söhbət
      - time: 23:40
      - 💬 Your Söhbət code: 418 205. Do not share this code with anyone.
  - 🛑 threat `linked`: If you did not link it, someone is reading your chats. Remove it from linked devices right away.
    - 🗂 **notification** (brand `sohbet`)
      - app: Söhbət
      - title: New device linked
      - body: Computer, Ganja, 21:14
      - time: 21:14
  - 🛑 threat `vote-link`: Voting links are a favourite way to steal accounts. Even if someone you know sends one, do not log in on that page.
    - 🗂 **chat** (brand `sohbet`)
      - app: generic
      - contact: Sevinc Əliyeva
      - 💬 them: My daughter is in a drawing contest, please vote: balaca-ressam.example.org/ses → `https://balaca-ressam.example.org/ses`
  - ✅ safe `pin-on`: This confirms a step you took yourself. Two-step verification protects the account from code theft.
    - 🗂 **notification** (brand `sohbet`)
      - app: Söhbət
      - title: Two-step verification turned on
      - body: You set up extra protection for your account.
      - time: 12:30
  - ✅ safe `meeting`: This is an ordinary work message. It asks for no code, no money and no link.
    - 🗂 **chat** (brand `sohbet`)
      - app: generic
      - contact: Department group
      - 💬 them: Kamran Əhmədov: Tomorrow's meeting is at ten, in room two fourteen.

#### simulation · `mh2-sim` · The drawing contest
- 🖥 mühit: `browser` — Someone you know asks for votes in a children's drawing contest. Choose the right step on each page.
  - **step `vote-page`** · Vote for Leyla's drawing — 🗣 "The page looks lovely and has a Vote button."
    - 🗂 **url** (brand `w2a-balaca-ressam`)
      - url: https://balaca-ressam.example.org/ses
    - ⚠️ [click-link] Vote — The vote button takes you to a login page. You have lost nothing yet, but be careful.
    - ✅ [cancel] Close the page — Correct. Closing an unknown page that wants an account for a vote is the safest step. → `devices`
  - **step `login`** — 🗣 "It wants you to log in with Söhbət to vote."
    - 🗂 **login** (brand `w2a-sohbet-fake`)
      - brand: Söhbət
      - url: https://sohbet-giris.example.org
      - fields: Phone number
      - button: Get code
    - ⚠️ [enter-credentials] Enter the number — With your number the thief requests a code in your name. On the next step they will ask for that code.
    - ✅ [cancel] Close the page — Correct. The address is not Söhbət's own, so this is a fake login page. → `devices`
  - **step `code`** — 🗣 "Now it asks you to type the code from your phone on this page."
    - 🗂 **dialog** (brand `w2a-sohbet-fake`)
      - tone: app
      - title: Enter the code
      - body: Type the six-digit Söhbət code sent to your phone.
      - buttons: Confirm, Cancel
    - 💀 [enter-credentials] Type the code — The moment you typed it, your account opened on the thief's phone. A Söhbət code is never typed on a website.
    - ✅ [cancel] Cancel — Correct. The code is only needed inside the Söhbət app itself, never on a page. → `devices`
  - **step `pairing`** — 🗣 "The page asks for something new: linking a device in the app."
    - 🗂 **dialog** (brand `w2a-sohbet-fake`)
      - tone: app
      - title: Confirm your vote
      - body: Open Linked devices in the Söhbət app and enter this code: / [code given by the page]
      - buttons: Done, Cancel
    - 💀 [allow] Link the device — You linked the thief's computer to your account. Now they see all your chats.
    - ✅ [cancel] Cancel — Correct. Voting never requires linking a device.
  - **step `devices`** — 🗣 "Just in case, you check linked devices in Söhbət's own settings."
    - 🗂 **dialog** (brand `sohbet`)
      - tone: app
      - title: Linked devices
      - body: Computer, Ganja. Last active: two minutes ago. / Did you link this device?
      - buttons: Log out, Keep
    - ✅ [disconnect] Log out — Correct. Once you log out a device you do not know, it no longer sees your messages.
    - 💀 [ignore] Keep — You did not link this device. If you keep it, someone will go on reading your chats.

#### choice · `mh2-choice`
- ❓ What protects your Söhbət account best against code theft?
  - ✅ Turning on two-step verification — Correct. Even if the code is stolen, no one gets in without the secret digits you set.
  - ❌ Hiding your profile photo — Photo privacy is good, but it does not protect the account. Two-step verification does.
  - ❌ Deleting chats often — This does not stop a thief from getting in. Turn on two-step verification.
- 💡 Two-step verification puts a second lock on your account. Only you know it.

#### match · `mh2-match`
- 🔗 Match each situation to the right step.
  - A code you did not ask for ⇄ Give it to no one
  - A new device notice ⇄ Remove it from linked devices
  - A login to vote ⇄ Close the page
  - A friend asks for money ⇄ Check with a normal call
- 💡 The code, devices and links are the doors to your account. Control each one yourself and open none to others.

#### recap · `mh2-recap`
- ✔ Do not log in with Söhbət to vote
- ✔ On a new device notice, check linked devices
- ✔ Turn on two-step verification


## SIM swap and OTP (`sim-swap-otp`) · Accounts · Medium · 200 XP

### Number gone dark (`number-goes-dark`, 3 dəq)

#### tutor · `ss1-tutor`
- 🗣 "Hello! Today we talk about criminals taking over your phone number and stealing your SMS codes." — _talk/wave, visual: mfa-phone_
- 🗣 "When a criminal tricks the operator into moving your number to their SIM, your phone suddenly loses signal." — _alert/point-left, visual: artifact_, highlight `no-service`
  - 🗂 **notification** (brand `w2b-sahiltel`)
    - app: SahilTel
    - title: **No service**⟨no-service⟩
    - body: Emergency calls only. SIM card not recognised.
    - time: 00:14
- 🗣 "Every year millions of manat are stolen from cards, mostly through shared codes and details." — _think/lean-in, visual: stat Millions of manat (stolen from cards every year)_
- 🗣 "If your number dies at night, do not wait for morning. Call your operator from another phone." — _happy/recite, visual: shield_

#### simulation · `ss1-sim` · One in the morning
- 🖥 mühit: `phone` — It is night and your phone is next to you. Look at each notification and choose the right step.
  - **step `no-service`** · 00:14 No service
    - 🗂 **notification** (brand `w2b-sahiltel`)
      - app: SahilTel
      - title: No service
      - body: Emergency calls only. SIM card not recognised.
      - time: 00:14
    - ✅ [verify] Call the operator from another phone — Correct. If your number moved to another card, the operator can block it and give it back to you.
    - ⚠️ [later] Turn the phone off and sleep — That is exactly what the criminal hopes for. All night your SMS codes will go to them.
  - **step `bank-login`** · 00:27 UlduzBank Mobil — 🗣 "The SIM is dead, but the bank app still reaches you over home internet."
    - 🗂 **notification** (brand `ulduzbank-app`)
      - app: UlduzBank Mobil
      - title: Sign-in from a new device
      - body: Android, Ganja, 00:27. If this was not you, freeze your card.
      - time: 00:27
    - ✅ [open] Open the app and freeze the card — Correct. No money leaves a frozen card, and you can unfreeze it later with the bank.
    - ✅ [call-back] Call the number on the back of the card from another phone — Right. The number on the card is the real bank, ask them to block the card.
    - 💀 [ignore] Dismiss — The criminal already receives your SMS codes. They can move money out of the account within minutes.
  - **step `push-request`** · 00:33 Təsdiqləyici
    - 🗂 **notification** (brand `tesdiqleyici`)
      - app: Təsdiqləyici
      - title: Sign-in request: İşPoçt
      - body: Ganja, 00:33. Is this you signing in?
      - time: 00:33
    - ✅ [deny] Deny — Well done. The criminal has your number, but this approval exists only on your phone.
    - 💀 [allow] Approve — You opened the door yourself. Never approve a request you did not expect, least of all at night.
  - **step `messenger-moved`** · 00:41 Söhbət — 🗣 "Your messaging account is tied to your number too."
    - 🗂 **notification** (brand `sohbet`)
      - app: Söhbət
      - title: Your account was opened on another phone
      - body: This number was registered on a new device.
      - time: 00:41
    - ✅ [verify] Warn family and friends another way — Correct. The criminal may ask your family for money in your name, so warn them first.
    - ⚠️ [ignore] Ignore it — Tonight your friends may get an urgent money request from you. Warn them now.
  - **step `recovery-sms`** · 08:05 UlduzBank — 🗣 "In the morning your number is back. Look at this message."
    - 🗂 **sms** (brand `ulduzbank-fake`)
      - sender: UlduzBank
      - time: 08:05
      - 💬 Your card was blocked after suspicious activity. To restore it, enter your card details: ulduzbank-berpa.example → `https://ulduzbank-berpa.example/kart`
    - ✅ [report] Report as spam — Correct. Criminals use a real incident to strike a second time.
    - ✅ [delete] Delete — Right. Sort out card matters only in the bank app or through the number on the card.
    - 💀 [click-link] Open the link — This is not the bank's site. If you enter your card details, you lose money a second time.

#### order · `ss1-order`
- 🔢 Your number suddenly went dead. Put the steps in order.
  1. Call the operator from another phone and get your number back
  2. Call the bank on the number on your card and freeze the card
  3. Change passwords on key accounts and switch from SMS to an authenticator app
  4. Tell technical support about your work accounts
  5. If money is gone, report it to the police on 102
- 💡 First get the number back so new codes stop going to the criminal. Right after that, have the bank freeze your card.

#### swipe · `ss1-swipe`
- 👉 Which message is normal and which is a threat? Swipe.
  - ✅ safe `own-code`: If you asked for this code yourself, it is a normal message. Type the code in yourself and nowhere else.
    - 🗂 **sms** (brand `ulduzbank`)
      - sender: UlduzBank
      - time: 14:02
      - 💬 Your sign-in code: 482193. Do not tell this code to anyone.
  - 🛑 threat `sim-changed`: If you did not ask for a new SIM, this is the first sign of an attack. Call your operator at once.
    - 🗂 **sms** (brand `w2b-sahiltel`)
      - sender: SahilTel
      - time: 23:52
      - 💬 A request to replace the SIM card for your number has been received.
  - 🛑 threat `tell-code`: A bank never asks you to tell a code to its staff. This message is there to steal the code.
    - 🗂 **sms** (brand `ulduzbank-fake`)
      - sender: UlduzBank
      - time: 10:18
      - 💬 Your card is blocked. To unblock it, tell the code you receive to our staff member who calls you.
  - 🛑 threat `night-login`: Someone signed in from another device while you slept. Freeze the card and call the bank.
    - 🗂 **notification** (brand `ulduzbank-app`)
      - app: UlduzBank Mobil
      - title: Sign-in from a new device
      - body: Android, Ganja, 02:14
      - time: 02:14
  - ✅ safe `own-push`: If you are signing in right now, the request is normal. Deny any request you did not expect.
    - 🗂 **notification** (brand `tesdiqleyici`)
      - app: Təsdiqləyici
      - title: Sign-in request: İşPoçt
      - body: Baku, 09:01. Is this you signing in?
      - time: 09:01

#### choice · `ss1-choice`
- ❓ Which protection still works if your number moves to someone else?
  - ❌ A code sent by SMS — When the number moves to a criminal, the SMS codes go with it. For key accounts this is weak protection.
  - ✅ An authenticator app or a passkey — Correct. They are tied to your device, not to your SIM card.
  - ❌ A longer password — A long password is good, but if it can be reset with an SMS code, the criminal still gets in.
- 💡 On key accounts like bank, mail and government services, choose an authenticator app or a passkey instead of SMS where you can.

#### recap · `ss1-recap`
- ✔ If your number suddenly dies, call the operator from another phone at once
- ✔ Then call the bank and freeze your card
- ✔ On key accounts use an authenticator app or a passkey instead of SMS

### SIM renewal call (`sim-renewal-call`, 3 dəq)

#### tutor · `ss2-tutor`
- 🗣 "Hello! Now let us look at a call in the operator's name: an offer to renew your SIM for free." — _talk/wave, visual: phone-lock_
- 🗣 "The screen can show the operator's name and a familiar number. Both can be faked." — _think/point-left, visual: artifact_, highlight `number`
  - 🗂 **call** (brand `w2b-sahiltel-fake`)
    - caller: SahilTel Customer Service
    - number: **+994 12 000 44 10**⟨number⟩
    - label: Baku
- 🗣 "Never tell a code you receive to a caller, even one who says they are the operator, bank or police." — _alert/shake, visual: mfa-phone_
- 🗣 "If your operator offers an account PIN, set one. It makes a SIM swap harder." — _happy/recite, visual: lock_

#### choice · `ss2-choice`
- ❓ A caller from the operator says: we are renewing your SIM, read me the code. What do you do?
  - ✅ I hang up and call the operator's official number myself — Correct. When you call the official number yourself, you know who you are talking to.
  - ❌ The number is the operator's, so I read the code — The number on the screen can be faked. This code moves your number onto someone else's card.
  - ❌ I ask for the caller's name and staff number — A criminal can make up a name and a number. The only real check is a call you make yourself.
- 💡 A call that asks for a code is the most dangerous call. Hang up and call the operator yourself.

#### simulation · `ss2-sim` · Call from SahilTel
- 🖥 mühit: `call` — Your phone is ringing. Read what the caller says and choose your answer.
  - **step `ring`**
    - 🗂 **call** (brand `w2b-sahiltel-fake`)
      - caller: SahilTel Customer Service
      - number: +994 12 000 44 10
      - label: Baku
      - voice: young-woman
    - ✅ [answer] Answer — Answering is not dangerous. What matters is that you give no code.
    - ✅ [decline] Decline — That works too. If you are worried, call the operator yourself. → `after`
  - **step `offer`** — 🗣 "Hello, this is Gunel from SahilTel. Old SIM cards, excuse me, are being switched off this month, so we are renewing yours for free."
    - 🗂 **call** (brand `w2b-sahiltel-fake`)
      - caller: SahilTel Customer Service
      - number: +994 12 000 44 10
      - label: Baku
      - voice: young-woman
    - ⚠️ [reply] All right, what should I do? — You have lost nothing yet, but the talk is heading for a code. Be careful.
    - ✅ [verify] I will call the operator's official number myself — Correct. If a renewal is real, the official line will confirm it. → `after`
    - ✅ [hang-up] End call — Good decision. Check any offer you did not expect on the official line. → `after`
  - **step `code`** — 🗣 "You just got a six digit code on your phone. Read it to me so the new card can be activated."
    - 🗂 **call** (brand `w2b-sahiltel-fake`)
      - caller: SahilTel Customer Service
      - number: +994 12 000 44 10
      - label: Baku
      - voice: young-woman
    - 💀 [share] I read the code — With this code your number moves to the criminal's card. From now on bank codes go to them.
    - ✅ [keep-private] I do not tell the code to anyone — Correct. The code is for you alone, whoever asks for it.
    - ✅ [hang-up] End call — Well done. Ending a call that asks for a code is the best answer. → `after`
  - **step `pressure`** — 🗣 "If you do not tell me the code, your number will be switched off tonight. This is the standard procedure, we are short on time."
    - 🗂 **call** (brand `w2b-sahiltel-fake`)
      - caller: SahilTel Customer Service
      - number: +994 12 000 44 10
      - label: Baku
      - voice: young-woman
    - 💀 [share] Fine, I will tell you the code — The threat is there to rush you. If you give the code, your number goes to the criminal tonight.
    - ✅ [keep-private] If needed, I will come to your office myself — Good answer. If a new SIM is ever needed, you can change it yourself at the operator's office.
    - ✅ [hang-up] End call — Right. When the pressure grows, end the conversation.
  - **step `after`** · The call has ended. What do you do now?
    - 🗂 **call** (brand `w2b-sahiltel-fake`)
      - caller: SahilTel Customer Service
      - number: +994 12 000 44 10
      - label: Baku
      - voice: young-woman
    - ✅ [call-back] Call the operator's official number — Correct. Report the call and ask whether you can set an account PIN.
    - ⚠️ [call-back] Call back the number that called — That number may lead to the criminal. Take the number from the operator's official website.
    - ⚠️ [ignore] Do nothing — The criminal will try again another way. Telling the operator protects your number.

#### match · `ss2-match`
- 🔗 Match each situation with the right step.
  - A caller asks for a code ⇄ Do not say it, end the call
  - Your phone suddenly shows No service ⇄ Call the operator from another phone
  - Your operator offers an account PIN ⇄ Set it and tell no one
  - A key account is protected only by SMS codes ⇄ Switch to an authenticator app or a passkey
- 💡 Never tell a code to anyone, act fast when your number dies, and do not let key accounts depend on SMS alone.

#### choice · `ss2-choice-code`
- ❓ When is it fine to tell someone a code sent to your phone?
  - ✅ Never: I only type it into a site or app I opened myself — Correct. A code is like your signature and must stay in your hands only.
  - ❌ If the caller knows my name and personal ID number — Those details may have leaked. Anyone who knows you and still asks for the code is a fraudster.
  - ❌ If a relative asks for it in a message — Your relative's account may be taken over too. Call them yourself with a normal phone call.
- 💡 Banks and government bodies do not ask for SMS codes. Whoever asks for the code, end the conversation.

#### recap · `ss2-recap`
- ✔ Never tell anyone a code you receive, whoever is calling
- ✔ End a suspicious call and call the operator's official number yourself
- ✔ If your operator offers an account PIN, set one


## Infostealers (`infostealers`) · Devices · Medium · 200 XP

### Free software (`free-installer`, 3 dəq)

#### tutor · `is1-tutor`
- 🗣 "Hello! Today we learn to spot infostealers, programs that hide inside free software." — _talk/wave, visual: download_
- 🗣 "In just two months, three hundred ninety four thousand computers infected with one such program were found." — _alert/lean-in, visual: stat 394,000 (infected computers found in two months)_
- 🗣 "It arrives as free software, a game mod or an activator, and takes passwords, cards and sessions." — _think/point-left, visual: artifact_, highlight `activator`
  - 🗂 **file**
    - name: **SenedYaz_Pro_Activator.zip**⟨activator⟩
    - type: zip
    - size: 38 MB
    - source: Downloads
- 🗣 "The rule is simple: install software only from the official source or through technical support." — _happy/shield-up, visual: shield_

#### hotspot · `is1-hotspot`
- 🔍 Find the warning signs in this post. (ən azı 3)
  - 🗂 **chat** (brand `w2b-pulsuz-proqramlar`)
    - app: generic
    - contact: Pulsuz Proqramlar | channel
    - 💬 them: **SenedYaz Pro 2026, full version, with activator, FREE**⟨cracked⟩
    - 💬 them: Download: **pulsuz-proqram-yukle.example/senedyaz**⟨link⟩ → `https://pulsuz-proqram-yukle.example/senedyaz`
    - 💬 them: **Archive password: 2026**⟨zip-password⟩
    - 💬 them: **Turn off your antivirus before installing, or it will show a false warning.**⟨av-off⟩
    - 💬 them: **12,400 people downloaded it, everyone is happy!**⟨proof⟩
  - ⟨cracked⟩ **Paid software for free**: A free full version of paid software is the most common bait. The activator itself is often the malware.
  - ⟨link⟩ **Not the official site**: This is not the software's official site. Nobody knows who put the file there.
  - ⟨zip-password⟩ **Password-protected archive**: Antivirus cannot look inside a password-protected archive. That is exactly why criminals add a password.
  - ⟨av-off⟩ **Turn off antivirus**: A program that wants protection turned off is afraid of it. This is the clearest signal.
  - ⟨proof⟩ **Made-up numbers**: Anyone can write any number in a channel. A download count is no proof of safety.

#### simulation · `is1-sim` · The home computer
- 🖥 mühit: `desktop` — Your family uses this computer, and you use it for work mail. Decide at every step.
  - **step `activator-zip`** — 🗣 "The archive from the channel is already downloaded."
    - 🗂 **file** (brand `w2b-pulsuz-proqramlar`)
      - name: SenedYaz_Pro_Activator.zip
      - type: zip
      - size: 38 MB
      - source: Downloads
    - ✅ [delete] Delete — Correct. Deleting a file like this is the safest step, get the software the official way.
    - 💀 [open-attachment] Open and run — As soon as the activator runs, it sends passwords and sessions out within seconds. Antivirus may notice too late.
    - ⚠️ [scan] Scan with antivirus — Antivirus cannot see inside a password-protected archive. Even if the scan says clean, do not trust this file.
  - **step `game-mod`** — 🗣 "Your daughter has downloaded a mod for a game."
    - 🗂 **file**
      - name: BlokDunyasi_Mod_Pulsuz.exe
      - type: exe
      - size: 2.1 MB
      - source: Downloads
    - 💀 [open] Open — This file goes for the browser, not the game. It takes saved passwords and your work mail session.
    - ✅ [delete] Delete — Right. Get game add-ons only from the game's official store.
    - ✅ [verify] Check the official store with your daughter — Well done. Explaining the reason to a child protects the next time too.
  - **step `codec-warning`** — 🗣 "A film site asked you to install a codec to watch the video."
    - 🗂 **dialog** (brand `qoruyucu`)
      - tone: warning
      - title: Your computer was protected
      - body: A program from an unknown publisher was not started. / File: Video_Kodek_Setup.exe / Publisher: Unknown
      - buttons: Don't run, Run anyway
    - ✅ [cancel] Don't run — Correct. A site that needs a program to play a video is a trap, watch it somewhere else. → `save-password`
    - 💀 [install] Run anyway — The system warned you, but you made the call. Now the installer will try to switch off your protection.
  - **step `av-disable`** — 🗣 "The installer asks for a new permission."
    - 🗂 **dialog** (brand `qoruyucu`)
      - tone: system
      - title: Qoruyucu Antivirus
      - body: Video_Kodek_Setup.exe wants to turn off real-time protection.
      - buttons: Turn off, Keep protection on
    - 💀 [allow] Turn off — Protection is off and the stealer runs freely. Disconnect the computer and tell technical support.
    - ✅ [deny] Keep protection on — Good call, but the program has already run. Tell technical support and change your work passwords from another device.
  - **step `save-password`** — 🗣 "Now you sign in to work mail on this computer."
    - 🗂 **dialog** (brand `db-xezri-brauzer`)
      - tone: app
      - title: Save password?
      - body: poct.idare.example / User: n.quliyeva@idare.example
      - buttons: Save, Never
    - ✅ [deny] Never — Correct. A work password saved on a family computer is a stealer's first target.
    - ⚠️ [allow] Save — Children install programs on this computer too. A stealer would take the work password saved here first.

#### choice · `is1-choice`
- ❓ You need paid software for work. What is the safest way?
  - ✅ I ask technical support or the office software centre — Correct. Licensed software is safe and it gets updates.
  - ❌ I download the version with an activator from a forum — Activators are the most common way to get infected. Your passwords pay for the free software.
  - ❌ I download a portable version from a file sharing site — You do not know who uploaded the file. A portable version carries the same danger.
- 💡 Software comes only from the official source. On a work computer, technical support does the installing.

#### scenario · `is1-scenario` · The game mod
- 🎭 start: `ask`
  - **[ask]** Aysel (your daughter) (in-person, 🔊young-woman): "Can I download this mod? It is free, I just need to switch off the antivirus for a minute."
    - No. A program that wants protection off is dangerous, let us look in the official store → `store` — Correct. Explaining the reason works better than a ban.
    - All right, but be quick → `black-window` — A minute is enough. A stealer does its work in seconds.
  - **[store]** Aysel (your daughter) (in-person, 🔊young-woman): "The store does not have that mod! All my friends download it from a forum."
    - My work mail is on this computer too. Let us make you your own account, and only use the official store ⇒ **safe** — Well done. A separate account and the official store protect both your family and your work.
    - Then just this once ⇒ **compromised** — Once is enough. A stealer takes passwords and sessions in seconds.
  - **[black-window]**  (, 🔊-): "The mod did not work. A black window flashed on the screen and closed."
    - I cut the internet, tell technical support and change my work passwords from another device ⇒ **safe** — Correct. If you act fast, the stolen sessions become useless.
    - Nothing happened, I will delete the mod ⇒ **risky** — Deleting is not enough, the data is already gone. Change passwords from a clean device and tell technical support.

#### recap · `is1-recap`
- ✔ Activators, free full versions and game cheats are the most common bait
- ✔ Never install a program that asks you to turn off protection
- ✔ Do not save work passwords on a family computer

### Stolen session (`stolen-session`, 3 dəq)

#### tutor · `is2-tutor`
- 🗣 "Hello! In the morning you see that your work mail sent forty emails abroad during the night." — _alert/wave, visual: inbox_
- 🗣 "Nobody had your password. A program stole your sign-in session, the cookie, from the browser." — _think/point-left, visual: artifact_, highlight `location`
  - 🗂 **notification** (brand `ispoct`)
    - app: İşPoçt
    - title: New sign-in
    - body: **Amsterdam, 03:05, unknown browser**⟨location⟩
    - time: 03:05
- 🗣 "The cookie tells the site you are already signed in, so it asks for no password and no code." — _talk/lean-in, visual: key_
- 🗣 "Three things help: a clean device, signing out of all sessions, and technical support." — _happy/shield-up, visual: shield_

#### match · `is2-match`
- 🔗 What does each stolen item let a criminal do? Match them.
  - Browser sign-in session ⇄ Get into the account without password or code
  - Passwords saved in the browser ⇄ Get into your accounts on other sites
  - Autofill card details ⇄ Pay online in your name
  - Messaging app session ⇄ Read your chats and write as you
- 💡 A stealer takes all of these at once. So change every password, not just one, and close the sessions.

#### simulation · `is2-sim` · On a clean work computer
- 🖥 mühit: `browser` — You are on your work computer, and it is clean. Open your mail and choose the right step on each screen.
  - **step `sent-folder`** · Sent: tonight at 03:12, 40 emails to unknown addresses
    - 🗂 **url** (brand `ispoct`)
      - url: https://poct.idare.example/gonderilenler
    - ✅ [verify] Call technical support — Correct. A specialist can protect the account right away and see what was sent.
    - ⚠️ [delete] Delete the emails — Deleting does not bring back sent emails, but it destroys evidence. Tell technical support first.
    - 💀 [ignore] Close it, look later — The attacker is still in the account and keeps writing. Every minute counts.
  - **step `new-login`**
    - 🗂 **dialog** (brand `ispoct`)
      - tone: warning
      - title: Sign-in from a new device
      - body: Windows, unknown browser / Amsterdam, today 03:05 / Was this you?
      - buttons: This was not me, This was me
    - ✅ [report] This was not me — Correct. The system marks the sign-in as suspicious, and technical support will see it.
    - 💀 [mark-safe] This was me — You just confirmed the attacker's sign-in. Now the system treats them as you.
  - **step `change-password`** — 🗣 "The address is real and the computer is clean."
    - 🗂 **login** (brand `ispoct`)
      - brand: İşPoçt
      - url: https://hesab.idare.example/parol
      - fields: Current password, New password, Repeat new password
      - button: Change password
    - ✅ [enter-credentials] Change password — Correct. Type a new password only on a clean device, or the program takes that one too.
    - ⚠️ [cancel] Later — The old password may be stolen. Change it now, from this clean computer.
  - **step `sessions`** · Active sessions: 3 devices. Sign out of all of them?
    - 🗂 **url** (brand `ispoct`)
      - url: https://hesab.idare.example/sessiyalar
    - ✅ [click-link] Sign out of all devices — Well done. The stolen cookie no longer works, and the attacker would have to sign in again.
    - ⚠️ [later] Later — Changing the password does not always close an open session. The attacker may still be inside.
  - **step `forward-rule`** · New rule, 03:07: forward all mail to arxiv@poct-yedek.example
    - 🗂 **url** (brand `ispoct`)
      - url: https://poct.idare.example/qaydalar
    - ✅ [report] Show the rule to technical support — Correct. Even after the attacker left, this rule kept sending your mail to them.
    - 💀 [ignore] Leave it — This is a hidden forward. Every new email you get will go to the attacker.

#### choice · `is2-choice`
- ❓ How did the attacker get into the mail without your password or code?
  - ✅ With a session stolen from the browser — Correct. The session shows the sign-in is already done, so no code is asked.
  - ❌ By guessing the password — Then the system would have asked for a code. Here neither a password nor a code was needed.
  - ❌ The mail server was hacked — The server is fine. What was stolen was the session in your browser.
- 💡 When a cookie is stolen, two-step verification does not help either. So do not let a stealer onto your computer.

#### order · `is2-order`
- 🔢 If a computer is infected, put the steps in order.
  1. Disconnect the infected computer from the network
  2. Tell technical support at once
  3. Change passwords from a clean device
  4. Sign out of all sessions
  5. Let technical support rebuild the computer
- 💡 If you change a password on the infected computer, the program takes the new one too. The computer counts as clean only after a rebuild.

#### recap · `is2-recap`
- ✔ A stolen session gives access without password or code
- ✔ Change passwords from a clean device, then sign out of all sessions
- ✔ Let technical support rebuild the infected computer


## The "Allow" trap (`app-consent-phishing`) · Accounts · Medium · 200 XP

### Permission screen (`consent-screen`, 3 dəq)

#### tutor · `ac1-tutor`
- 🗣 "Hello! Today we learn a trap that asks for permission instead of a password." — _talk/wave, visual: key_
- 🗣 "The app says: to view the document, allow me to read your mail and send mail as you." — _alert/point-left, visual: artifact_, highlight `mail`
  - 🗂 **permission** (brand `w2b-dokubaxis`)
    - app: DokuBaxış Viewer
    - permissions: See your profile, **Read your mail and send mail as you**⟨mail⟩ ✗lazımsız, Keep access when you are not there ✗lazımsız
- 🗣 "One click, and the app is in your mailbox. Even if you change your password, the permission stays." — _think/lean-in, visual: inbox_
- 🗣 "The rule: read the app name and the permissions, and never allow an app you do not know." — _happy/shield-up, visual: shield_

#### hotspot · `ac1-hotspot`
- 🔍 Find the requests this app does not need. (ən azı 3)
  - 🗂 **permission** (brand `w2b-dokubaxis`)
    - app: DokuBaxış Viewer
    - permissions: See your profile, **Read your mail and send mail as you**⟨mail⟩ ✗lazımsız, **Read and change all your files**⟨files⟩ ✗lazımsız, **See your contacts**⟨contacts⟩ ✗lazımsız, **Keep access when you are not there**⟨offline⟩ ✗lazımsız
  - ⟨mail⟩ **Mail and sending**: Viewing a document needs no mail access. With this permission the app can send phishing in your name.
  - ⟨files⟩ **All files**: An app that shows one document does not need all your files. This is for stealing data.
  - ⟨contacts⟩ **Contacts**: Your contact list is the target list for the next attack. A document does not need it.
  - ⟨offline⟩ **Lasting access**: This means the app stays in your account after you sign out and even after a password change.

#### swipe · `ac1-swipe`
- 👉 Which permission request is normal and which is a trap? Swipe.
  - ✅ safe `meeting-app`: Görüş is the office's known app, and it asks only for what its job needs.
    - 🗂 **permission** (brand `gorus`)
      - app: Görüş
      - permissions: See your calendar, See your profile
  - 🛑 threat `greeting-card`: A greeting card needs neither your contacts nor the right to send mail. This is for spreading phishing in your name.
    - 🗂 **permission** (brand `w2b-bayram-tebriki`)
      - app: Bayram Təbriki
      - permissions: See your contacts ✗lazımsız, Send mail as you ✗lazımsız
  - 🛑 threat `salary-calc`: A calculator does not need your mail. Lasting access keeps the app inside your account.
    - 🗂 **permission** (brand `w2b-maas-kalkulyatoru`)
      - app: Maaş Kalkulyatoru
      - permissions: Read your mail ✗lazımsız, Keep access when you are not there ✗lazımsız
  - ✅ safe `editor`: The known editor asks only for the file you choose. That permission fits its job.
    - 🗂 **permission** (brand `senedyaz`)
      - app: SənədYaz
      - permissions: Open and save the file you choose
  - 🛑 threat `pdf-tool`: Merging files needs neither mail nor all your files. Do not allow an app like this.
    - 🗂 **permission** (brand `pdf-birlesdirici`)
      - app: PDF Birləşdirici Pro
      - permissions: Read and change all your files ✗lazımsız, Read and send your mail ✗lazımsız

#### simulation · `ac1-sim` · Shared budget document
- 🖥 mühit: `browser` — A budget document was shared with you in your colleague Nigar's name. You opened the link, now decide on each screen.
  - **step `real-login`** — 🗣 "Look at the address: this is the office's real sign-in page."
    - 🗂 **login** (brand `ispoct`)
      - brand: İşPoçt
      - url: https://giris.idare.example/icaze
      - fields: Email, Password
      - button: Sign in
    - ✅ [enter-credentials] Sign in — The address is real, so the password does not go to a criminal. The trap is in the next window.
    - ✅ [cancel] Close the tab — That is safe too. But suppose you signed in: let us look at the next window.
  - **step `consent`** — 🗣 "Before the document opened, this window appeared."
    - 🗂 **permission** (brand `w2b-dokubaxis`)
      - app: DokuBaxış Viewer
      - permissions: See your profile, Read your mail and send mail as you ✗lazımsız, Read and change all your files ✗lazımsız, Keep access when you are not there ✗lazımsız
    - ✅ [deny] Deny — Correct. Viewing a document needs no mail, no access to all files and no lasting access. → `known-app`
    - 💀 [allow] Allow — The app now reads your mail and writes as you. Changing your password does not stop it.
  - **step `connected-apps`** · Connected apps: DokuBaxış Viewer, lasting access to mail and files — 🗣 "The next day you look at your account."
    - 🗂 **url** (brand `ispoct`)
      - url: https://hesab.idare.example/tetbiqler
    - ✅ [report] Report to technical support so they revoke it — Correct. Only revoking the permission removes the app, and a specialist will check for traces too.
    - ⚠️ [update] Only change the password — The password changes, but the app keeps its permission. Technical support has to revoke it.
    - 💀 [ignore] Leave it — The app will keep reading your mail every day. Report it today.
  - **step `known-app`** — 🗣 "Now the office's own assistant app asks for permission."
    - 🗂 **permission** (brand `idare-komekci`)
      - app: İdarə Köməkçisi
      - permissions: See your profile, See your calendar
    - ✅ [allow] Allow — Right. A known work app asks only for what its job needs.
    - ⚠️ [deny] Deny — Caution is understandable, but this app is known and asks for little. When in doubt, ask technical support.

#### choice · `ac1-choice`
- ❓ Which permissions are the most dangerous? Choose all that apply.
  - ✅ Send mail as you — Correct. With this permission the app sends phishing to your colleagues in your name.
  - ✅ Keep access when you are not there — Correct. It means the app stays in your account after you sign out.
  - ❌ See your name and profile photo — This is a small permission that a normal sign-in needs.
- 💡 Mail, files and lasting access are the biggest permissions. Never give them to an app you do not know.

#### recap · `ac1-recap`
- ✔ On a permission screen, read the app name and the permissions
- ✔ Do not give an unknown app access to mail, files or lasting access
- ✔ If you allowed it by mistake, have technical support revoke it

### Meeting code (`meeting-code`, 3 dəq)

#### tutor · `ac2-tutor`
- 🗣 "Hello! Now let us look at an invitation from an international forum and a meeting code." — _talk/wave, visual: handshake_
- 🗣 "The fraudster sends you a code and your office's real sign-in page." — _alert/point-left, visual: artifact_, highlight `code`
  - 🗂 **chat** (brand `w2b-nordvale-fake`)
    - app: generic
    - contact: Leyla K. | Nordvale Council
    - 💬 them: To join the meeting, enter this code: **QK7-MN4P**⟨code⟩
- 🗣 "If you enter the code, her device gets into your account as you, with no need for your password." — _think/lean-in, visual: mfa-phone_
- 🗣 "The rule: if you did not start the sign-in yourself, never enter a code anywhere." — _happy/shield-up, visual: shield_

#### scenario · `ac2-scenario` · Forum invitation
- 🎭 start: `invite`
  - **[invite]** Leyla, Nordvale Council (new message) (message, 🔊young-woman): "Hello! We would like you to speak at our forum in Vienna in November. Are you interested?"
    - Thank you. Please send the official invitation to my work mail so I can clear it with management → `code` — Correct. An official invitation comes through an official channel, and you can check it.
    - Very interesting! What should I do? → `code` — Interest is natural. But it is better to move a talk with a stranger to an official channel.
  - **[code]** Leyla, Nordvale Council (message, 🔊young-woman): "Great! Let us have a short online meeting tomorrow. To join, enter this code on your office's sign-in page: QK7-MN4P."
    - I did not start this sign-in, so I am not entering the code anywhere → `pressure` — Correct. If a code reaches you in a message, the sign-in belongs to someone else.
    - The page is my office's, so it is safe. I enter it ⇒ **compromised** — The page was real, but the fraudster started the sign-in. Now her device is in your mailbox.
  - **[pressure]** Leyla, Nordvale Council (message, 🔊young-woman): "We are short on time, and your ministry has agreed. Just enter the code, it takes two minutes."
    - I will find the number on the forum's official site and call myself, and I will tell technical support ⇒ **safe** — Well done. A real organiser welcomes the check, and a fraudster disappears.
    - All right, I will enter it ⇒ **compromised** — Pressure is part of the trap. As soon as you enter the code, your account opens to the fraudster's device.

#### simulation · `ac2-sim` · Invitation on your phone
- 🖥 mühit: `phone` — Messages in the forum's name arrive on your phone. Open each one and choose the right step.
  - **step `code-chat`**
    - 🗂 **chat** (brand `w2b-nordvale-fake`)
      - app: generic
      - contact: Leyla K. | Nordvale Council
      - 💬 them: Hello! Your panel at the Vienna forum is confirmed.
      - 💬 them: Code to join the meeting: QK7-MN4P
      - 💬 them: Enter the code on this page: giris.idare.example/cihaz → `https://giris.idare.example/cihaz`
    - ✅ [report] Report — Correct. If you did not start the sign-in, a code sent in a message is a trap. → `slides`
    - ✅ [reply] Please send the official invitation to my work mail — Good answer. A real organiser can do that, a fraudster will dodge it. → `slides`
    - ⚠️ [click-link] Open the page — The page is real, but someone else started this sign-in. Watch the next screen closely.
  - **step `device-confirm`** — 🗣 "The page opened. As soon as you enter the code, this question appears."
    - 🗂 **dialog** (brand `ispoct`)
      - tone: app
      - title: Are you signing in on another device?
      - body: Code: QK7-MN4P / If you did not start this sign-in yourself, do not continue.
      - buttons: Continue, Cancel
    - 💀 [allow] Continue — The fraudster's device is now in your account. Call technical support at once.
    - ✅ [deny] Cancel — Correct. The page itself warned you: you did not start this sign-in.
  - **step `slides`** — 🗣 "Now the organiser sent a link to the slides. It asks for permission too."
    - 🗂 **permission** (brand `w2b-nordvale-slides`)
      - app: Nordvale Slides
      - permissions: See your profile, Read and send your mail ✗lazımsız, Keep access when you are not there ✗lazımsız
    - ✅ [deny] Deny — Correct. Viewing slides does not need your mail.
    - 💀 [allow] Allow — This app now reads your mail. Ask technical support to revoke the permission.
  - **step `tell-support`**
    - 🗂 **chat** (brand `it-destek`)
      - app: generic
      - contact: Technical support
      - 💬 me: I got a code and a permission request in a forum's name.
      - 💬 them: Thank you! Did you enter the code or allow anything?
    - ✅ [reply] Yes, I entered it by mistake — Telling them right away is the right thing. A specialist will close the sign-in and the permission.
    - ✅ [reply] No, I entered nothing — Well done. A specialist will warn your other colleagues too.
    - ⚠️ [ignore] Do not answer — Anyone can make a mistake, but hiding it makes the damage worse. An honest answer saves time.

#### match · `ac2-match`
- 🔗 Match each situation with the right step.
  - Someone sent you a code in a message ⇄ Enter it nowhere and report it
  - You started the sign-in on a TV yourself ⇄ You can enter the code from the screen
  - An unknown app asks for lasting access ⇄ Deny it
  - You entered a code or allowed an app by mistake ⇄ Call technical support at once
- 💡 A code is safe only when it comes from a device where you started the sign-in yourself. In every other case, stop and report.

#### choice · `ac2-choice`
- ❓ The organiser says: "The page belongs to your own office, do not worry." Is that a reason to enter the code?
  - ✅ No. The page is real, but someone else started the sign-in — Correct. In this trap the page and the code are real, only the person who started the sign-in is fake.
  - ❌ Yes, if the address is real there is no danger — Checking the address protects a password, not a code. The code goes to the device of whoever started the sign-in.
  - ❌ Yes, if the organiser is from a well known forum — Anyone can type a well known name. Check the forum on its official site.
- 💡 A code hands a key to the device that started the sign-in. If you did not start it, do not enter the code.

#### recap · `ac2-recap`
- ✔ Never enter a code you got in a message on any sign-in page
- ✔ Even on a real page, check who started the sign-in
- ✔ If you made a mistake, tell technical support at once


## Fake login windows (`fake-login-windows`) · Accounts · Medium · 200 XP

### Drag the window (`drag-test`, 3 dəq)

#### tutor · `dt-tutor`
- 🗣 "Hi! Some sites open a small window to sign you in. Today you will learn to spot a fake one." — _talk/wave, visual: browser_
- 🗣 "A scammer draws that window inside the page, like a picture. Even its address bar looks right." — _alert/point-left, visual: artifact_, highlight `fake-bar`
  - 🗂 **dialog** (brand `ispoct-fake`)
    - tone: app
    - title: IshPocht: sign in
    - body: **https://poct.idare.example/giris**⟨fake-bar⟩ / Sign in with your work email to view the document.
    - buttons: Sign in, Cancel
- 🗣 "The test is simple: grab the window and drag it outside the browser. A fake one cannot leave the page." — _think/lean-in, visual: eye_
- 🗣 "If your password manager does not fill in the password, stop. Type the address in a new tab yourself." — _happy/recite, visual: key_

#### swipe · `dt-swipe`
- 👉 Which sign-in window can you trust?
  - 🛑 threat `edge-cut`: A real window leaves the browser and goes anywhere on the screen. If it gets cut off, it is a picture drawn inside the page.
    - 🗂 **dialog** (brand `ispoct-fake`)
      - tone: app
      - title: IshPocht: sign in
      - body: You dragged the window aside. / It reached the edge of the page and was cut off.
      - buttons: Sign in
  - ✅ safe `moves-out`: The window moves apart from the browser, and the password manager recognises the site. These are signs of a real window.
    - 🗂 **dialog** (brand `ispoct`)
      - tone: app
      - title: IshPocht: sign in
      - body: You dragged the window aside: it left the browser and moved onto the desktop. / ParolSeyf offered the password by itself.
      - buttons: Sign in
  - 🛑 threat `no-fill`: A password manager checks the real address of the site, not the text in the window. If it finds no password, the site is a different one.
    - 🗂 **dialog** (brand `parolseyf`)
      - tone: system
      - title: ParolSeyf
      - body: No saved password found for this site. / Address written in the window: poct.idare.example
      - buttons: Close
  - 🛑 threat `moves-along`: A real window stays where it is. If it moves together with the browser, it is part of the page.
    - 🗂 **dialog** (brand `ispoct-fake`)
      - tone: app
      - title: IshPocht: sign in
      - body: You dragged the browser itself aside. / The sign-in window moved along with it.
      - buttons: Sign in
  - ✅ safe `own-tab`: When you type the address yourself, a fake window has no way in. This is the most reliable way.
    - 🗂 **dialog** (brand `ispoct`)
      - tone: app
      - title: New tab: poct.idare.example
      - body: You typed the address yourself. / The password manager filled in the password.
      - buttons: Sign in

#### simulation · `dt-sim` · Tender document
- 🖥 mühit: `browser` — A supplier sent a link to a tender document. The site wants you to sign in to show it. Go carefully.
  - **step `doc-page`** · Tender document: office furniture purchase — 🗣 "The document is locked. The site offers sign-in with your work account."
    - 🗂 **url** (brand `w2c-tender-baza`)
      - url: https://tender-baza.example.net/sened/4471
    - ✅ [click-link] Sign in with IshPocht — Pressing the button is not dangerous yet. The real test is the window that opens now.
    - ✅ [verify] Check the address — This is the tender site, not your work mail. Watch the sign-in window that opens next very closely.
    - ✅ [cancel] Close the tab — A careful choice. Open your mail yourself, and ask the supplier for the document another way. → `own-tab`
  - **step `popup`** — 🗣 "The window shows the right address. But that proves nothing yet."
    - 🗂 **dialog** (brand `ispoct-fake`)
      - tone: app
      - title: IshPocht: sign in
      - body: https://poct.idare.example/giris / Sign in with your work email to view the document. / Email: aysel.quliyeva@idare.example
      - buttons: Sign in, Cancel
    - ✅ [verify] Drag the window outside the browser — The right test. Let us see whether the window can leave the browser.
    - ✅ [verify] Fill with ParolSeyf — Good idea. The password manager checks the real address of the site. → `pm-check`
    - 💀 [enter-credentials] Type the password and sign in — The address bar in the window was only a picture. Your password went to the owner of the tender site. → `leaked`
    - ✅ [cancel] Cancel — Good. Never type a password into a window you are not sure about. → `own-tab`
  - **step `drag-result`** — 🗣 "The window was cut off at the page edge. A real window never does that."
    - 🗂 **dialog** (brand `ispoct-fake`)
      - tone: app
      - title: IshPocht: sign in
      - body: The window reached the edge of the page and was cut off. / It did not leave the browser.
      - buttons: Sign in, Cancel
    - ✅ [cancel] Close the window and the tab — Right. A window that cannot leave the page is fake, so type nothing into it. → `own-tab`
    - 💀 [enter-credentials] Sign in anyway — You had already seen that the window was fake. Your password went to the scammer. → `leaked`
    - ✅ [report] Report the site to technical support — Excellent. Technical support can block the site and protect your colleagues too. → `own-tab`
  - **step `pm-check`** — 🗣 "The password manager found no password for this site."
    - 🗂 **dialog** (brand `parolseyf`)
      - tone: system
      - title: ParolSeyf
      - body: No saved password for tender-baza.example.net.
      - buttons: Type manually, Close
    - 💀 [enter-credentials] Type the password manually — The password manager was right: this site is not your mail. The password you typed went to the scammer. → `leaked`
    - ✅ [cancel] Stop and close the window — Right. When the password manager does not fill in, stopping is the best move.
  - **step `own-tab`** — 🗣 "You typed the address in a new tab. The password manager filled in the password."
    - 🗂 **login** (brand `ispoct`)
      - brand: IshPocht
      - url: https://poct.idare.example/giris
      - fields: Work email, Password
      - button: Sign in
    - ✅ [enter-credentials] Sign in — Right. When you type the address yourself, a fake window has no way in. → `doc-page`
    - ✅ [verify] Check the address — This is your real work mail, and the password manager recognised it. Signing in is safe. → `doc-page`
  - **step `leaked`** · Document not found — 🗣 "The password is gone and the document never opened. Act fast now."
    - 🗂 **url** (brand `w2c-tender-baza`)
      - url: https://tender-baza.example.net/sened/4471
    - ✅ [verify] Change the password and call technical support — Right. Change the password in a new tab, and let technical support close all open sessions.
    - 💀 [click-link] Sign in again — The site collects your password a second time. It is a trap for passwords, not a document.
    - ⚠️ [ignore] Do nothing — The scammer can already open your mail with that password. Change it and report it right away.

#### order · `dt-order`
- 🔢 Put the steps in order when a sign-in window looks suspicious.
  1. Drag the window outside the browser
  2. If it cannot leave, close the window and the tab
  3. Type the address in a new tab and sign in there
  4. Report the site to technical support
- 💡 First test, then close, then type the address yourself. Report the site so your colleagues are protected too.

#### recap · `dt-recap`
- ✔ Drag a sign-in window outside the browser: a fake one cannot leave
- ✔ If the password manager does not fill in, stop
- ✔ When in doubt, type the address in a new tab yourself

### A shared document (`shared-doc-login`, 3 dəq)

#### tutor · `sd-tutor`
- 🗣 "A fake sign-in window often starts with an email: a document was shared with you, sign in to view it." — _talk/wave, visual: inbox_
- 🗣 "The button offers sign-in with a familiar account. The window that opens is drawn inside the site." — _alert/point-left, visual: artifact_, highlight `signin-btn`
  - 🗂 **email** (brand `buludxidmet-fake`)
    - from: BuludXidmet <paylasim@buludxidmet-share.example.net>
    - subject: Kamran Aliyev shared a document with you
    - time: 09:47
    - body: Kamran Aliyev shared "Tender_teklifi_2026.pdf" with you. / To view it: **Sign in with IshPocht**⟨signin-btn⟩ → `https://buludxidmet-share.example.net/view?id=88213`
- 🗣 "An email threatening to shut down your office's social media page is the same trap." — _think/lean-in, visual: social_
- 🗣 "The rule: do not sign in through the button in the email. Open the site yourself." — _happy/recite, visual: shield_

#### choice · `sd-choice`
- ❓ You got this email. What do you do?
  - ❌ I press the button and sign in with my IshPocht account — The button takes you to a site you do not know. The sign-in window there may be fake.
  - ✅ I call Kamran on the number I know and ask — Right. If the document is real, Kamran will share it again in your office's own system.
  - ❌ I forward it to colleagues so they can look too — Then the trap reaches others as well. Send a suspicious email only to technical support.
- 💡 If the document is real, you will see it when you open the site yourself. You never need the sign-in button in the email.

#### simulation · `sd-sim` · Your work mail
- 🖥 mühit: `inbox` — Four emails are waiting in your morning mail. Open each one and pick the right action.
  - **step `real-share`**
    - 🗂 **email** (brand `buludxidmet`)
      - from: BuludXidmet <bildiris@buludxidmet.example>
      - subject: Narmin Hasanova shared a file with you
      - time: 08:55
      - body: Narmin Hasanova shared "Budce_2027.xlsx" with you. / Note: the budget table we discussed this morning. / Open file → `https://buludxidmet.example/idare/budce-2027`
    - ✅ [click-link] Open file — You expected this file, and the link goes to the service's own address. It is fine to open.
    - ✅ [mark-safe] Mark as safe — Right. A known colleague, an expected file and the service's own address.
    - ⚠️ [report] Report phishing — Caution is good, but there are no warning signs here. Narmin told you about this file this morning.
  - **step `fake-share`**
    - 🗂 **email** (brand `buludxidmet-fake`)
      - from: BuludXidmet <paylasim@buludxidmet-share.example.net>
      - subject: Kamran Aliyev shared a document with you
      - time: 09:47
      - body: Kamran Aliyev shared "Tender_teklifi_2026.pdf" with you. / To view it: Sign in with IshPocht → `https://buludxidmet-share.example.net/view?id=88213` / The link is valid for 24 hours.
    - ✅ [report] Report phishing — Right. A different domain and a sign-in button that led to a fake window.
    - 💀 [click-link] Sign in with IshPocht — The page would have drawn an IshPocht window and asked for your password. Do not touch buttons like this.
    - ✅ [delete] Delete — Deleting works too. If you report it, technical support can warn your colleagues.
  - **step `copyright`**
    - 🗂 **email** (brand `w2c-kontakto-fake`)
      - from: Kontakto Legal Centre <huquq@kontakto-support.example.info>
      - subject: Your page will be removed within 24 hours
      - time: 10:12
      - body: A copyright violation was found on your office's official page. / To appeal, sign in as the page administrator: Appeal → `https://kontakto-support.example.info/etiraz` / Without a reply, the page will be closed for good.
    - ✅ [report] Report phishing — Right. A real warning would also appear inside the social network's own app.
    - 💀 [click-link] Appeal — The appeal page drew a Kontakto window and collected the password and the code. Your office's page would go to the scammer.
    - ⚠️ [reply] Reply: this is a mistake — The scammer reads the reply and sends a new link. Report the email instead.
  - **step `it-notice`**
    - 🗂 **email** (brand `it-destek`)
      - from: IT Support <destek@idare.example>
      - subject: Mail server update tonight
      - time: 11:30
      - body: Today between 19:00 and 20:00, work mail may be unavailable for a few minutes. / No action is needed from you.
    - ✅ [mark-safe] Mark as safe — Right. It comes from an internal address, with no link and no request for a password.
    - ⚠️ [report] Report phishing — This email has no link and asks for nothing. Notices like this are normal work.
    - ✅ [delete] Delete — That is fine, the email only informs you. There is no danger.

#### hotspot · `sd-hotspot`
- 🔍 Find the signs that this sign-in window is fake. (ən azı 3)
  - 🗂 **dialog** (brand `w2c-kontakto-fake`)
    - tone: app
    - title: Kontakto: sign in
    - body: Browser address bar: **kontakto-support.example.info/etiraz**⟨real-address⟩ / Address in the window: **https://kontakto.example/login**⟨painted-bar⟩ / Phone or email, password / **Also enter the code you got by SMS**⟨code⟩ / **The window does not move past the edge of the page**⟨no-drag⟩ / **2 hours 59 minutes left to appeal**⟨timer⟩
    - buttons: Sign in
  - ⟨real-address⟩ **Real address**: The browser's own address bar shows a different site. Look at that, not at the text inside the window.
  - ⟨painted-bar⟩ **Painted address**: This address bar is part of the window's picture. The scammer can write anything there.
  - ⟨code⟩ **Verification code**: They want the code to get past two-step verification. Never type a code into a window like this.
  - ⟨no-drag⟩ **Window stuck**: A real window can be dragged outside the browser. This one stays stuck inside the page.
  - ⟨timer⟩ **Pressure**: The countdown is there to make you sign in without checking.

#### recap · `sd-recap`
- ✔ Find a shared document by opening the site yourself
- ✔ An email threatening to close your page is a trap
- ✔ If you typed your password, change it now and tell technical support


## Risky browser extensions (`browser-extensions`) · Devices · Medium · 200 XP

### Picking in the store (`store-picks`, 3 dəq)

#### tutor · `sp-tutor`
- 🗣 "Hi! A browser extension is a small program. It can see and change the pages you open." — _talk/wave, visual: browser_
- 🗣 "The widest permission is this one: read and change all your data on all websites." — _alert/point-left, visual: artifact_, highlight `all-sites`
  - 🗂 **permission** (brand `w2c-pulsuz-vpn`)
    - app: Pulsuz VPN Sürət
    - permissions: **Read and change all your data on all websites**⟨all-sites⟩ ✗lazımsız, Manage your proxy settings
- 🗣 "An extension can be honest today and turn into a spy tomorrow with one update." — _think/lean-in, visual: update_
- 🗣 "Install only what you need, only from the official store. On a work computer, only what technical support approves." — _happy/recite, visual: shield_

#### swipe · `sp-swipe`
- 👉 Would you install this extension or decline it?
  - 🛑 threat `free-vpn`: A free VPN extension sees all your traffic and often earns its money from your data. For work, use only the VPN your office provides.
    - 🗂 **permission** (brand `w2c-pulsuz-vpn`)
      - app: Pulsuz VPN Sürət
      - permissions: Read and change all your data on all websites ✗lazımsız, Read your browsing history ✗lazımsız, Manage your proxy settings
  - 🛑 threat `weather`: A weather forecast does not need your pages or what you copy. If the permission is bigger than the job, decline.
    - 🗂 **permission** (brand `w2c-hava`)
      - app: Hava Bu Gün
      - permissions: Show the weather forecast for Baku, Read and change all your data on all websites ✗lazımsız, Read data you copy and paste ✗lazımsız
  - ✅ safe `screenshot`: The permissions fit the job and only work when you press the button. An extension like this adds no real risk.
    - 🗂 **permission** (brand `w2c-ekran-sekli`)
      - app: Ekran Şəkli
      - permissions: See only the open page when you press the button, Save images to the Downloads folder
  - 🛑 threat `outside-store`: An extension from outside the store has passed no checks at all. Install extensions only from the browser's official store.
    - 🗂 **url**
      - url: https://pulsuz-elaveler.example.info/pdf-ustasi-pro.zip
  - ✅ safe `notes`: The extension does not touch your sites and keeps notes only in the browser's own storage. The risk is low.
    - 🗂 **permission** (brand `w2c-qisa-qeyd`)
      - app: Qısa Qeyd
      - permissions: Store your notes in this browser

#### choice · `sp-choice`
- ❓ An extension you needed only once is still in your browser. What do you do?
  - ✅ I remove it and reinstall it if I ever need it — Right. An extension you do not use gives you nothing, but its risk stays.
  - ❌ I just turn it off — Turning it off helps, but a forgotten extension comes back with one click. If you do not need it, remove it.
  - ❌ I keep it, maybe I will need it some day — The extension can change owners, and an update can turn it into a spy. Do not keep what you do not need.
- 💡 Every extension is a door into your pages. Fewer extensions means less risk.

#### simulation · `sp-sim` · Extension store
- 🖥 mühit: `browser` — You want an extension that shows exchange rates quickly. Pick what to do at each step.
  - **step `copy-store`** · Mezenne Pro: free download — 🗣 "The first page in the search looks like the store."
    - 🗂 **url** (brand `db-xezri-brauzer-fake`)
      - url: https://xezri-elaveler.example.info/mezenne-pro (əslində: `xezri-elaveler.example.info`)
    - 💀 [install] Download the extension — This is not the official store but a copy of it. Anything from here has passed no checks.
    - ✅ [verify] Check the address — This domain is not the store's own address. Open the store from the browser menu.
    - ✅ [cancel] Close the tab — Right. Install extensions only from the browser's own store.
  - **step `store-page`** · Mezenne Pro: 4.1 stars, 80 thousand users — 🗣 "Now you are in the official store. Before installing, the browser will show the permissions."
    - 🗂 **url** (brand `db-xezri-brauzer`)
      - url: https://magaza.xezri.example/elave/mezenne-pro (əslində: `xezri.example`)
    - ✅ [install] Add to browser — The official store is a good start. Now read the permissions carefully.
    - ✅ [cancel] Not needed — That is a good choice too. You can see the rates on your bank's site. → `installed`
  - **step `perms`** — 🗣 "Does showing exchange rates need these permissions?"
    - 🗂 **permission** (brand `w2c-mezenne-pro`)
      - app: Məzənnə Pro
      - permissions: Show currency exchange rates, Read and change all your data on all websites ✗lazımsız, See your tabs and browsing history ✗lazımsız
    - ⚠️ [allow] Add extension — Exchange rates need neither all websites nor your history. A permission this wide opens the way to spying.
    - ✅ [deny] Decline — Right. If the permission does not fit the job, do not install it.
  - **step `installed`** · Installed extensions: 7, unused in the last six months: 4 — 🗣 "Your browser also has old extensions. What do you do with them?"
    - 🗂 **url** (brand `db-xezri-brauzer`)
      - url: https://magaza.xezri.example/elavelerim (əslində: `xezri.example`)
    - ✅ [delete] Remove the four unused extensions — Excellent. Each removed extension closes one door into your pages.
    - ⚠️ [ignore] Keep them all — Unused extensions still update and can still see your pages. Remove what you do not need.
  - **step `malware-flag`** — 🗣 "The browser turned one of the extensions off by itself."
    - 🗂 **dialog** (brand `db-xezri-brauzer`)
      - tone: warning
      - title: Hava Bu Gün was turned off
      - body: Malware was found in this extension. / It has also been removed from the store.
      - buttons: Turn back on, Remove
    - ✅ [report] Remove it and tell technical support — Right. Technical support will check what the extension collected and help you change passwords.
    - 💀 [allow] Turn back on — The browser did not turn it off for nothing. Turned back on, the extension keeps collecting data.

#### recap · `sp-recap`
- ✔ Install an extension only when you need it, and only from the official store
- ✔ Be careful with any extension that wants data on all websites
- ✔ Remove the extensions you do not use

### The extension that changed (`update-turns`, 3 dəq)

#### tutor · `ut-tutor`
- 🗣 "An extension can work honestly for years. Then its owner changes, and one update turns it into a spy." — _talk/wave, visual: update_
- 🗣 "Updates like this reached millions of browsers automatically. Users noticed nothing." — _alert/lean-in, visual: stat 4.3 million (devices where long-trusted extensions turned into spyware in 2025)_
- 🗣 "Watch out if an extension suddenly wants new permissions, your search engine changed, or ads multiplied." — _think/point-left, visual: artifact_, highlight `new-perm`
  - 🗂 **dialog** (brand `w2c-pdf-ustasi`)
    - tone: app
    - title: PDF Ustası was turned off
    - body: The new version asks for more permissions: / **Read and change all your data on all websites**⟨new-perm⟩
    - buttons: Accept permissions, Remove extension
- 🗣 "When that happens, remove the extension, tell technical support, and change the passwords they name." — _happy/shield-up, visual: shield_

#### scenario · `ut-scenario` · PDF Ustası changed
- 🎭 start: `n1`
  - **[n1]**  (, 🔊-): "You open the browser in the morning. A note in the corner says: PDF Ustası was turned off because it wants new permissions."
    - I accept the permissions, I have used it for a year → `n2-bad` — Old trust does not make a new permission safe. This update may have turned the extension into a spy.
    - First I look at which permissions it wants → `n2` — Right. New permissions show what the extension now wants to do.
  - **[n2]**  (, 🔊-): "New permissions: read and change data on all websites, read what you copy. Opening a PDF needs none of this."
    - I remove the extension and write to technical support → `n3` — Right. Technical support will check for this extension on other computers too.
    - I leave it turned off and look later → `n3` — A turned-off extension is still in the browser and comes back with one click. Removing it is safer.
  - **[n2-bad]**  (, 🔊-): "A week later your search engine has changed by itself, and unknown ads appear on websites."
    - I remove the extension and call technical support → `n3` — Late, but the right move. Technical support will check what leaked.
    - I get used to the ads ⇒ **compromised** — The extension still sees every page you open. The ads are a sign that it is working.
  - **[n3]** Ayten, technical support (phone, 🔊woman-2): "Thank you. This extension collected data on all websites. Change your work mail and portal passwords, and we will close the open sessions."
    - I change the passwords now ⇒ **safe** — Excellent. Whatever the extension collected is now out of date.
    - I removed the extension, that is enough ⇒ **risky** — The extension is gone, but the data it collected is with the scammer. The passwords must be changed.

#### simulation · `ut-sim` · Work computer
- 🖥 mühit: `desktop` — Strange things are happening on your work computer. Answer each warning the right way.
  - **step `ad-tab`** · Congratulations! You won a phone — 🗣 "The browser opened a new tab by itself."
    - 🗂 **url**
      - url: https://endirim-kupon.example.info/hediyye (əslində: `endirim-kupon.example.info`)
    - 💀 [click-link] Claim the prize — A tab that opens by itself with a prize is a trap. The page would have asked for your card details.
    - ✅ [cancel] Close the tab — Right. Tabs that open by themselves are often the work of a harmful extension, so let us find the cause.
  - **step `search-changed`** — 🗣 "The browser says your search setting was changed."
    - 🗂 **dialog** (brand `db-xezri-brauzer`)
      - tone: app
      - title: Your search engine was changed
      - body: Your searches now go to axtar-tez.example.info. / Changed by: the Kupon Tapan extension
      - buttons: Keep the change, Change it back
    - ⚠️ [mark-safe] Keep the change — Your searches now go to a stranger's site, which sees everything you type. Change it back.
    - ✅ [cancel] Change it back — Right. Now let us look at the extension that did it.
  - **step `ext-list`** · Extensions: Kupon Tapan, Ekran Şəkli, Qısa Qeyd — 🗣 "The list has an extension you never installed."
    - 🗂 **url** (brand `db-xezri-brauzer`)
      - url: https://magaza.xezri.example/elavelerim (əslində: `xezri.example`)
    - ✅ [delete] Remove Kupon Tapan — Right. An extension you do not recognise should not stay in your browser.
    - ⚠️ [ignore] Keep them all — Kupon Tapan changed your search and opens tabs. Keeping it leaves your data open to it.
  - **step `bundle-file`** — 🗣 "Your Downloads folder shows where the extension came from."
    - 🗂 **file** (brand `w2c-kupon-tapan`)
      - name: Pulsuz_PDF_Cevirici_setup.exe
      - type: exe
      - size: 6.2 MB
      - source: pulsuz-pdf-cevir.example.info
    - 💀 [open] Open — This free converter installed the extension in secret. Open it again and the extension comes back.
    - ✅ [delete] Delete — Right. This file came with a free program and installed the extension without asking.
  - **step `av-alert`** — 🗣 "The antivirus found something too."
    - 🗂 **dialog** (brand `qoruyucu`)
      - tone: warning
      - title: Qoruyucu: threat found
      - body: The Kupon Tapan extension was sending browser data to an unknown server. / The extension was removed.
      - buttons: Tell technical support, Close
    - ✅ [report] Tell technical support — Right. Technical support will check what leaked and help you change passwords.
    - ⚠️ [cancel] Close — The extension is gone, but the data it collected has already left. Be sure to report it.

#### match · `ut-match`
- 🔗 Match each permission with what it makes possible.
  - Read and change data on all websites ⇄ Read your mail, change a payment page
  - Read what you copy ⇄ See a password or card number you copied
  - Read browsing history ⇄ Know which sites you visit
  - Manage downloads ⇄ Download files in your name
- 💡 Every permission is a power. Do not give an extension a power its job does not need.

#### recap · `ut-recap`
- ✔ Remove an extension that wants new permissions after an update
- ✔ A search engine that changed by itself, new ads and tabs are warning signs
- ✔ Remove it, tell technical support, change your passwords


## Fake sites in search (`search-ads-lookalikes`) · Devices · Medium · 200 XP

### Search results (`search-results`, 3 dəq)

#### tutor · `sr-tutor`
- 🗣 "Hi! Many people reach official sites by searching, not by typing the address. Scammers know this too." — _talk/wave, visual: browser_
- 🗣 "They buy ads to appear at the very top. Such a result has a small word next to it: Sponsored." — _alert/point-left, visual: artifact_, highlight `ad-label`
  - 🗂 **dialog** (brand `w2c-tapan`)
    - tone: app
    - title: Tapan: citizen portal certificate
    - body: **Sponsored**⟨ad-label⟩  vetendasportal-gov.example / Vatandash Portal: get your certificate in 5 minutes / vetendasportal.gov.az / Vatandash Portal: online certificates
    - buttons: Search
- 🗣 "A fake site looks very much like the real one: one letter different, an extra word, or another ending." — _think/lean-in, visual: eye_
- 🗣 "Check the official address once and bookmark it. Then always open it from there." — _happy/recite, visual: shield_

#### hotspot · `sr-hotspot`
- 🔍 Find the dangerous spots in the search results. (ən azı 3)
  - 🗂 **dialog** (brand `w2c-tapan`)
    - tone: app
    - title: Tapan: citizen portal certificate
    - body: **Sponsored**⟨ad-label⟩  **vetendasportal-gov.example**⟨lookalike⟩ / **Official site. Get your certificate in 5 minutes**⟨fake-official⟩ / Sponsored  **vetendaspotral.example.info**⟨typo⟩ / Vatandash Portal: sign-in and certificates / vetendasportal.gov.az / Vatandash Portal: online certificates
    - buttons: Search
  - ⟨ad-label⟩ **Ad label**: This result was paid to be at the top. Scammers can buy ads too, so never use an ad to sign in.
  - ⟨lookalike⟩ **Extra word**: The word gov was added to the address, but the ending is different. The official portal's address ends in gov.az.
  - ⟨fake-official⟩ **Fake official label**: Anyone can write the words official site. The end of the address shows what is official, not the text.
  - ⟨typo⟩ **Letter swap**: Two letters in the word portal have swapped places. It is hard to notice when you are in a hurry.

#### choice · `sr-choice`
- ❓ You sign in to the citizen portal often. What is the safest way?
  - ✅ I check the official address once and bookmark it — Right. A bookmark opens the same address every time, and ads drop out of the picture.
  - ❌ I search every time and press the first result — The first result may be an ad. Scammers count on exactly this habit.
  - ❌ I use the link that came by SMS — Anyone can send a link by SMS. Open the official site yourself.
- 💡 Bookmark the sites you use often. Then search results and ads cannot fool you.

#### simulation · `sr-sim` · Downloading a program
- 🖥 mühit: `browser` — You have an online meeting tomorrow and need to download the Gorush app. You start with a search.
  - **step `results`** · Download Gorush: search results — 🗣 "At the top is an ad, and below it is the app's own site."
    - 🗂 **url** (brand `w2c-tapan`)
      - url: https://tapan.example/axtar?q=gorus+yukle (əslində: `tapan.example`)
    - ⚠️ [click-link] Sponsored: gorus-app-download.example.net — The ad took you to a different site. It is not too late: look at the address. → `fake-site`
    - ✅ [click-link] gorus.example: official site — Right. You skipped the ad and opened the app's own site. → `real-site`
  - **step `fake-site`** · Gorush: free download — 🗣 "The page looks a lot like the real site. Look at the address."
    - 🗂 **url** (brand `w2c-gorus-fake`)
      - url: https://gorus-app-download.example.net/yukle (əslində: `gorus-app-download.example.net`)
    - 💀 [install] Download — This site does not belong to the app's maker. An installer from here cannot be trusted. → `fake-file`
    - ✅ [cancel] Close the tab — The address was not the app's own site. Go to the official site yourself. → `real-site`
    - ✅ [verify] Check the address — The name looks similar, but the domain is different. Do not trust this site. → `real-site`
  - **step `fake-file`** — 🗣 "The file has downloaded. Will you open it?"
    - 🗂 **file** (brand `w2c-gorus-fake`)
      - name: GorusSetup_2026.exe
      - type: exe
      - size: 84 MB
      - source: gorus-app-download.example.net
    - 💀 [open] Open — Along with the app, this installer sets up a program that steals passwords. Never open a file from a fake site. → `after-bad`
    - ✅ [delete] Delete — Right. Delete the file, tell technical support, and get the app from the official site. → `real-site`
  - **step `after-bad`** — 🗣 "The antivirus found something. Act fast now."
    - 🗂 **dialog** (brand `qoruyucu`)
      - tone: warning
      - title: Qoruyucu: suspicious program
      - body: GorusSetup_2026.exe tried to read the passwords saved in your browser.
      - buttons: Quarantine, Close
    - ✅ [disconnect] Disconnect from the network and call technical support — Right. Unless your procedure says otherwise, disconnect the computer without shutting it down and call at once.
    - 💀 [cancel] Close and keep working — The program keeps running and can send out your passwords. Report it right away.
  - **step `real-site`** · Gorush: download for your computer — 🗣 "This is the app's own site."
    - 🗂 **url** (brand `gorus`)
      - url: https://gorus.example/yukle (əslində: `gorus.example`)
    - ✅ [verify] Ask technical support to install it — That is the best way. On a work computer, technical support installs programs. → `results`
    - ✅ [install] Download — Right, this is the official site. On a work computer, check your technical support rules first. → `results`

#### recap · `sr-recap`
- ✔ To sign in, use a bookmark, not an ad
- ✔ Read the end of the address and compare it with the official one
- ✔ Get programs only from the official site or from technical support

### Look-alike addresses (`lookalike-domains`, 3 dəq)

#### tutor · `ld-tutor`
- 🗣 "On a phone the address bar is short, and most of the address is hidden. Scammers count on that." — _talk/wave, visual: phone-lock_
- 🗣 "Look at this address: the official name comes first, but the real owner of the site is the part at the end." — _alert/point-left, visual: artifact_, highlight `real-owner`
  - 🗂 **url**
    - url: https://vetendasportal.gov.**az-arayis.example**⟨real-owner⟩/giris
- 🗣 "There are other tricks too: letters swap places, a word is added, a similar digit replaces a letter." — _think/lean-in, visual: eye_
- 🗣 "On a suspicious address type nothing, close the page and tell technical support." — _happy/shield-up, visual: shield_

#### match · `ld-match`
- 🔗 Match each fake address with the official one it imitates.
  - vetendasportal.gov.az-arayis.example ⇄ vetendasportal.gov.az
  - sahi1bank.example.info ⇄ sahilbank.az
  - ulduzbnak.example ⇄ ulduzbank.az
  - idare-poct-giris.example.info ⇄ poct.idare.example
- 💡 The difference is small: the official name placed in front, a digit, two swapped letters or an extra word. Always read the address from the end.

#### simulation · `ld-sim` · A certificate on the phone
- 🖥 mühit: `phone` — You want to get a certificate on your phone. At every step, read the address to the very end.
  - **step `search-ad`** · Sponsored: Vatandash Portal, official site — 🗣 "The first search result is an ad."
    - 🗂 **url** (brand `w2c-tapan`)
      - url: https://tapan.example/axtar?q=vetendas+portali+arayis (əslində: `tapan.example`)
    - ⚠️ [click-link] Open the ad — The ad took you to a different site. Now read the address carefully. → `fake-login`
    - ✅ [click-link] Open the vetendasportal.gov.az result — Right. You skipped the ad and chose the result whose address ends in gov.az. → `real-login`
  - **step `fake-login`** — 🗣 "On a phone only the start of the address shows. Read it to the end."
    - 🗂 **login** (brand `w2c-vetendas-portal-fake`)
      - brand: Vatandash Portal
      - url: https://vetendasportal.gov.az-arayis.example/giris (əslində: `az-arayis.example`)
      - fields: FIN code, Password
      - button: Sign in
    - 💀 [enter-credentials] Sign in — The address started with gov.az but did not end with it. Your FIN code and password went to the scammer.
    - ✅ [cancel] Close the page — Right. The real owner of a site is at the end of the address, and this one did not end in gov.az. → `real-login`
  - **step `new-login`** · 10:16 Vatandash Portal — 🗣 "A minute later this notification arrived."
    - 🗂 **notification** (brand `w2c-vetendas-portal`)
      - app: Vatandash Portal
      - title: New sign-in
      - body: Someone signed in to your account from an unknown device.
      - time: 10:16
    - ✅ [open] I open the portal myself and change the password — Right. Open the portal from your bookmark, change the password and sign out of all devices.
    - ⚠️ [later] I will look later — The scammer is already in your account. Every minute counts.
  - **step `real-login`** — 🗣 "This address ends in gov.az."
    - 🗂 **login** (brand `w2c-vetendas-portal`)
      - brand: Vatandash Portal
      - url: https://vetendasportal.gov.az/giris (əslində: `vetendasportal.gov.az`)
      - fields: FIN code, Password
      - button: Sign in
    - ✅ [enter-credentials] Sign in — Right, this is the official portal itself. Now bookmark it.
    - ✅ [verify] Check the address — A great habit. The domain ends in gov.az, with no extra word in front.
  - **step `bank-sms`** — 🗣 "In the evening an SMS arrives in the bank's name."
    - 🗂 **sms** (brand `sahilbank-fake`)
      - sender: SahilBank
      - time: 19:42
      - 💬 Your card is temporarily blocked. To unblock: sahilbank.az-kart.example/ac → `https://sahilbank.az-kart.example/ac`
    - 💀 [click-link] Open the link — The address starts with the bank's name, but the owner is the part at the end. Open the bank's app yourself.
    - ✅ [report] Report as spam — Right. Check your card in the bank's app or on the number on the back of the card.
    - ✅ [delete] Delete — That works. If in doubt, call the bank yourself on the number on the back of your card.

#### order · `ld-order`
- 🔢 Put the steps for checking an address on a phone in order.
  1. Tap the address bar to see the full address
  2. Find the last part of the domain
  3. Compare it letter by letter with the official address
  4. If anything differs, close it without typing
- 💡 On a phone the end of the address is often hidden, so open it fully first. If the official name is not at the end, the site is fake.

#### recap · `ld-recap`
- ✔ On a phone, open the full address and read it from the end
- ✔ Even if the official name comes first, the real owner is the part at the end
- ✔ If you typed a password, change it on the official site and report it


## Fake payment links (`fake-payment-links`) · Social engineering · Easy · 200 XP

### Parcel fee (`parcel-fee`, 3 dəq)

#### tutor · `pf-tutor`
- 🗣 "Hello! Today we will see how a tiny payment link turns into a big loss." — _talk/wave, visual: phone-lock_
- 🗣 "The fee is only one manat twenty. The scammer is after your card details, not the fee." — _alert/point-left, visual: artifact_, highlight `fee`
  - 🗂 **sms** (brand `w2d-tezkuryer-fake`)
    - sender: +994 51 000 83 17
    - time: 10:47
    - 💬 TezKuryer: your parcel is held at customs. **Pay a 1.20 AZN fee: **⟨fee⟩tezkuryer-gomruk.example.net/odenis → `https://tezkuryer-gomruk.example.net/odenis`
- 🗣 "Parcel, fine or benefit: whatever it is, never pay through a link in a text message." — _think/shake, visual: hook_
- 🗣 "Instead, open the official app or portal yourself and check there." — _happy/shield-up, visual: shield_

#### hotspot · `pf-hotspot`
- 🔍 Find the signs of fraud in this text message. (ən azı 3)
  - 🗂 **sms** (brand `w2d-tezkuryer-fake`)
    - sender: **+994 51 000 83 17**⟨sender⟩
    - time: 10:47
    - 💬 TezKuryer: your parcel TZ48120577AZ is held at customs. **A customs fee of 1.20 AZN**⟨small-fee⟩ must be paid.
    - 💬 Pay here: **tezkuryer-gomruk.example.net/odenis**⟨link⟩ → `https://tezkuryer-gomruk.example.net/odenis`
    - 💬 **If not paid within 24 hours, the parcel goes back to the sender.**⟨deadline⟩
  - ⟨sender⟩ **An ordinary mobile number**: Company texts usually arrive under a name. A name can be faked too, so never rely on this sign alone.
  - ⟨small-fee⟩ **A tiny amount**: A tiny amount lowers your guard. The real target is your card number, the code on the back and the SMS code.
  - ⟨link⟩ **Fake address**: This is not the courier's official site, extra words were added to the name. Do not tap it, open the official app yourself.
  - ⟨deadline⟩ **Rushing you**: The deadline is there to stop you thinking. A real courier gives you time to check.

#### simulation · `pf-sim` · Messages through the day
- 🖥 mühit: `phone` — Several messages reach your phone during the day. Choose the right response to each.
  - **step `redeliver-sms`** · 10:47 New text — 🗣 "A familiar courier name and a small amount."
    - 🗂 **sms** (brand `w2d-tezkuryer-fake`)
      - sender: +994 51 000 83 17
      - time: 10:47
      - 💬 TezKuryer: our courier could not find you. Pay 0.90 AZN for a new delivery: tezkuryer-catdirilma.example.net/odenis → `https://tezkuryer-catdirilma.example.net/odenis`
    - ⚠️ [click-link] Open the link — The page looks like the courier's site, but the address is fake. Now see what it asks for. → `bank-code`
    - ✅ [report] Report as spam — Right. Report the text, then check the parcel in the official app. → `real-app`
    - ✅ [delete] Delete — Good. If you expect a parcel, check it in the official app. → `real-app`
  - **step `bank-code`** · The page asked for card details and the SMS code — 🗣 "Your bank sent a code. Look at the amount."
    - 🗂 **sms** (brand `sahilbank`)
      - sender: SahilBank
      - time: 10:49
      - 💬 Code: 518204. Payment 412.00 AZN, TZK GLOBAL PAY. Never share this code.
    - 💀 [reply] Type the code on the site — With this code you approve four hundred twelve manat, not one. Call the bank now on the number on the back of your card.
    - ✅ [call-back] Call the bank on the card's number — Right. The amount next to the code is far higher than the page said, so have the card blocked now.
    - ✅ [ignore] Do not type the code anywhere — Good, the payment did not go through. But your card details are already on that site, so call the bank and block the card.
  - **step `real-app`** · Official TezKuryer app — 🗣 "This notification comes from the official app."
    - 🗂 **notification** (brand `w2d-tezkuryer`)
      - app: TezKuryer
      - title: TZ77015342AZ: on its way
      - body: Delivery on 4 October. No extra payment is needed.
      - time: 11:05
    - ✅ [open] Open in the app — Right. The official app shows no extra fee, so the text was fake.
    - ✅ [ignore] Look later — That is fine. If a fee were due, you would see it in the official app too.
  - **step `fine-sms`** · 13:20 New text — 🗣 "Now a fine. Watch the discount."
    - 🗂 **sms** (brand `w2d-yol-nezaret-fake`)
      - sender: YolNezaret
      - time: 13:20
      - 💬 You were fined 80 AZN for speeding. Pay today for 50% off: yolnezaret-cerime.example.net/endirim → `https://yolnezaret-cerime.example.net/endirim`
    - 💀 [click-link] Pay with the discount — The discount is there to rush you. The page behind the link collects card details.
    - ✅ [verify] I will check fines on the portal myself — Right. If the fine is real, it will be on the official portal.
    - ✅ [report] Report as spam — Good. If you are unsure, call the police on 102 and ask.
  - **step `aunt-chat`** · 16:02 Aunt Sabina — 🗣 "A relative asks for advice."
    - 🗂 **chat**
      - app: whatsapp
      - contact: Aunt Sabina
      - 💬 them: The neighbour sent this link, they are giving family support, today is the last day.
      - 💬 them: ailedestek-qeydiyyat.example.net → `https://ailedestek-qeydiyyat.example.net`
      - 💬 them: Should I enter my card details?
    - ✅ [reply] Don't, let's check the official portal together — Great. State benefits never need registration through a link, and you can check them on the official portal.
    - 💀 [reply] Hurry, it's the last day — The last day trick worked. The page will steal her card details, so she must call her bank now.
    - ⚠️ [click-link] Let me open the link — Opening it to check is risky too. The address is not the official portal anyway.

#### choice · `pf-choice`
- ❓ You already typed your card details on a fake page. What comes first?
  - ✅ Call the bank on the number on the back of the card and block it — Right. The sooner the card is blocked, the less you lose.
  - ❌ Wait to see if money leaves the account — Waiting gives the scammer time. Once the money is gone, it may be too late.
  - ❌ Reply to the text and ask for the money back — The scammer will not return it and will ask for a new code instead. Cut contact.
- 💡 Then report it to the police on 102 and keep the message as evidence.

#### recap · `pf-recap`
- ✔ Parcel, fine or benefit: never pay through a link in a text.
- ✔ Open the official app or portal yourself to check.
- ✔ Typed card details? Call the bank now, then the police on 102.

### Check the page (`check-the-page`, 3 dəq)

#### tutor · `cp-tutor`
- 🗣 "A fake payment page can be an exact copy of the real one." — _talk/wave, visual: browser_
- 🗣 "Logo, colours and buttons are the same. The difference is in the address bar and in what it asks for." — _alert/point-left, visual: artifact_, highlight `domain`
  - 🗂 **login** (brand `e-xidmet-fake`)
    - brand: e-Xidmət Portalı
    - url: https://**e-xidmet-cerime.example.net**⟨domain⟩/odenis
    - fields: Card number, Expiry date, CVV, SMS code
    - button: Pay: 40 AZN
- 🗣 "The padlock proves nothing either: most fake sites have one." — _think/shrug, visual: lock_
- 🗣 "The safest way: open the portal from your bookmark or type the address yourself." — _happy/recite, visual: shield_

#### swipe · `cp-swipe`
- 👉 Is this page genuine or fake?
  - ✅ safe `real-fines`: This is the portal's own domain and you opened it yourself. This is where to check fines.
    - 🗂 **login** (brand `e-xidmet`)
      - brand: e-Xidmət Portalı
      - url: https://e-xidmet.example/cerimeler
      - fields: Personal ID code, Password
      - button: Sign in
  - 🛑 threat `fake-discount`: The domain is different and the page wants everything at once: card, code and SMS code. It is a theft form.
    - 🗂 **login** (brand `e-xidmet-fake`)
      - brand: e-Xidmət Portalı
      - url: https://e-xidmet-endirim.example.net/cerime
      - fields: Card number, Expiry date, CVV, SMS code
      - button: Pay with 50% off
  - ✅ safe `app-notice`: The notice is inside the official app and has no link. Check and pay the fine right there in the app.
    - 🗂 **notification** (brand `e-xidmet`)
      - app: e-Xidmət
      - title: New notice
      - body: 1 fine is registered in your name. Details: Fines section in the app.
      - time: 09:15
  - 🛑 threat `fake-benefit`: Receiving money never needs the code on the back of your card. State benefits do not need registration through a link.
    - 🗂 **login** (brand `e-xidmet-fake`)
      - brand: Family support
      - url: https://ailedestek-qeydiyyat.example.net
      - fields: Full name, Personal ID code, Card number, CVV
      - button: Get the benefit
  - 🛑 threat `fake-gateway`: No payment page ever asks for your card PIN. The PIN is only for cash machines and card terminals.
    - 🗂 **login** (brand `w2d-manatpay-fake`)
      - brand: ManatPay
      - url: https://manatpay-secure.example.net/3ds
      - fields: Card number, CVV, SMS code, Card PIN
      - button: Confirm

#### simulation · `cp-sim` · The fine link
- 🖥 mühit: `browser` — A friend sent you a fine link and you opened it. Make the right call at each step in the browser.
  - **step `fake-fine-page`** · Unpaid fine: 80 AZN. 50% off today — 🗣 "Look at the address bar."
    - 🗂 **url** (brand `e-xidmet-fake`)
      - url: https:// (əslində: `e-xidmet-cerime.example.net`)e-xidmet-cerime.example.net/odenis
    - ⚠️ [click-link] Pay with the discount — The discount is there to rush you. Now see what the page asks for.
    - ✅ [cancel] Close the tab — Right, this is not the portal's own domain. Now open the portal yourself. → `real-portal`
  - **step `card-form`** — 🗣 "The page wants the card and the SMS code together."
    - 🗂 **login** (brand `e-xidmet-fake`)
      - brand: e-Xidmət Portalı
      - url: https://e-xidmet-cerime.example.net (əslində: `e-xidmet-cerime.example.net`)
      - fields: Card number, Expiry date, CVV, SMS code
      - button: Pay: 40 AZN
    - 💀 [enter-credentials] Pay: 40 AZN — Your card details went to scammers. Call the bank now on the number on your card.
    - ✅ [cancel] Close the tab — Good call. You typed nothing, now check the fine on the official portal.
  - **step `real-portal`** · Fines: no active fines — 🗣 "You opened the portal from your bookmark."
    - 🗂 **url** (brand `e-xidmet`)
      - url: https://e-xidmet.example/cerimeler (əslində: `e-xidmet.example`)
    - ✅ [open] View fines — Right. The official portal shows no fine, so the link was fake.
    - ✅ [share] Tell your friend — Great. Tell the friend who sent it not to type anything there.
  - **step `benefit-page`** · Family support: registration ends today — 🗣 "This time a neighbour sent you a benefit link."
    - 🗂 **url** (brand `e-xidmet-fake`)
      - url: https://ailedestek-qeydiyyat.example.net (əslində: `ailedestek-qeydiyyat.example.net`)
    - 💀 [click-link] Register — This form collects card details. State benefits never need registration through a link.
    - ✅ [cancel] Close the tab — Right. Check any benefit only on the official portal.
    - ✅ [report] Report the fake site — Great. Reporting helps get the fake site blocked for others too.

#### match · `cp-match`
- 🔗 Match what the page asks for with what it means.
  - Card PIN ⇄ No payment page ever asks for it
  - SMS code from your bank ⇄ Approves a payment: read the amount first
  - Card back code to receive a benefit ⇄ Not needed to receive money
  - A discount if you pay today ⇄ Rushing you to pay without checking
- 💡 If you are unsure, do not pay. Check the official portal yourself or call the police on 102.

#### recap · `cp-recap`
- ✔ Read the address bar: logo and padlock prove nothing.
- ✔ A page asking for your PIN, or a card code for a benefit, is fake.
- ✔ When unsure: ETX 1654 or police 102.


## Fake job offers (`task-job-scams`) · Social engineering · Easy · 200 XP

### The task trap (`task-trap`, 3 dəq)

#### tutor · `tt-tutor`
- 🗣 "Hello! Today we look at job offers that promise easy money from home." — _talk/wave, visual: social_
- 🗣 "The task is simple: like, review, send a screenshot. And the pay is suspiciously high." — _think/point-left, visual: artifact_, highlight `pay`
  - 🗂 **chat** (brand `w2d-nergiz-market-fake`)
    - app: whatsapp
    - contact: Nargiz Market HR | Aynur
    - 💬 them: Hello! Work from home: like products and write reviews.
    - 💬 them: **Earn 40-120 AZN a day**⟨pay⟩
- 🗣 "They really do pay the first five manat. It is bait for a big payment later." — _alert/lean-in, visual: hook_
- 🗣 "The rule: if you must pay to start or to withdraw earnings, it is a scam." — _happy/shake, visual: shield_

#### simulation · `tt-sim` · Work from home
- 🖥 mühit: `phone` — A job offer arrives from an unknown number. Choose your reply to each message.
  - **step `offer`** · 09:12 New message
    - 🗂 **chat** (brand `w2d-nergiz-market-fake`)
      - app: whatsapp
      - contact: Nargiz Market HR | Aynur
      - 💬 them: Hello! We got your number from your profile on a job site.
      - 💬 them: Work from home: 1-2 hours a day, 40-120 AZN. Interested?
    - ⚠️ [reply] Yes, tell me more — Showing interest is not a loss yet, but this chat leads to a payment. Watch every step.
    - ✅ [block] Block and report — Right. An unexpected offer with sky high pay is warning enough. → `end`
  - **step `first-task`** — 🗣 "Here is the first task."
    - 🗂 **chat** (brand `w2d-nergiz-market-fake`)
      - app: whatsapp
      - contact: Nargiz Market HR | Aynur
      - 💬 them: First task: give these 3 products 5 stars and send a screenshot.
      - 💬 them: 1.70 AZN per task.
    - ⚠️ [reply] Doing it, sending the screenshot — Fake reviews mislead other buyers. It is also the first rung of the scam.
    - ✅ [block] No fake reviews, I block them — Right. Being paid to like and review is a well known sign of this scam. → `end`
  - **step `first-pay`** · 10:03 SahilBank — 🗣 "Money really did arrive on your card."
    - 🗂 **sms** (brand `sahilbank`)
      - sender: SahilBank
      - time: 10:03
      - 💬 Incoming to your card: 5.10 AZN. Balance: 63.40 AZN.
    - ⚠️ [reply] Money came, so the job is real — A small payout is there to win your trust. The scammer takes back many times more later.
    - ✅ [ignore] It is bait. I stop here — Right. The first payout is bait, the next step is asking you for money. → `end`
  - **step `vip-task`** — 🗣 "Now they moved you to a Telegram group."
    - 🗂 **chat** (brand `w2d-nergiz-market-fake`)
      - app: telegram
      - contact: Nargiz Market VIP group
      - 💬 them: Congratulations, you reached VIP level!
      - 💬 them: VIP task: deposit 50 AZN, get 130 AZN back in 30 minutes.
      - 💬 them: Everyone in the group earns, look, 47 people got paid today.
    - 💀 [reply] I deposit 50 AZN — That money will not come back. The winners in the group are the scammers themselves.
    - ✅ [block] Leave and report the group — Right. If you must deposit money to work, it is not a job but a scam. → `end`
  - **step `negative`** — 🗣 "After you paid, the balance suddenly went negative."
    - 🗂 **chat** (brand `w2d-nergiz-market-fake`)
      - app: telegram
      - contact: Nargiz Market VIP group
      - 💬 them: System error: your balance is now -86 AZN.
      - 💬 them: Pay 86 AZN or your 214 AZN earnings will be deleted.
    - 💀 [reply] I pay the 86 AZN too — There will be a new reason after every payment. Stop and report it to your bank and the police on 102.
    - ✅ [block] I do not pay, I block and report — Right, paying to release earnings is the last rung of the scam. Keep the chat as evidence.
  - **step `end`** · IshBazar: new vacancy — 🗣 "And this is a real vacancy."
    - 🗂 **notification** (brand `w2d-isbazar`)
      - app: IshBazar
      - title: Khazar Logistics: operator
      - body: Interview at the office, salary 850 AZN. Apply on the site.
      - time: 12:30
    - ✅ [open] View the vacancy — Right. A real vacancy names the company, has an interview and a real salary, and never asks you to pay.
    - ✅ [ignore] Look later — That is fine. A real job ad does not vanish, you can check it calmly.

#### scenario · `tt-scenario` · Leyla already paid
- 🎭 start: `call`
  - **[call]** Leyla, your relative (on the phone) (phone, 🔊young-woman): "I put 120 manat into the tasks. Now they want a 15 percent tax to withdraw. Should I pay?"
    - Don't pay, it is the same scam going on → `id-photo` — Right. A tax or fee to withdraw earnings is a sign of fraud.
    - Pay, or the 120 manat is lost too ⇒ **compromised** — That only grows the loss. After the tax there will be a new excuse.
  - **[id-photo]** Leyla (phone, 🔊young-woman): "I also sent them a photo of my ID card to register. Is that a problem?"
    - Yes, let's tell the bank and the police about it too → `steps` — Right. An ID photo can be used to open accounts or loans in your name.
    - No, a photo is useless to them → `steps` — On the contrary, an ID photo can be used to open fake accounts in her name. Report that too.
  - **[steps]** Leyla (phone, 🔊young-woman): "So what do I do now?"
    - Call your bank, report to the police on 102, keep the chat ⇒ **safe** — Great. The bank may try to stop the transfer, and the chat is evidence for the police.
    - Delete everything and forget it ⇒ **risky** — Deleting the chat destroys the evidence. There is no shame in it, just report it.
    - Write to the channel that promises to get money back ⇒ **compromised** — Those who promise to recover money are often the same scammers. Do not pay them anything.

#### match · `tt-match`
- 🔗 Match the phrase in the offer with what it really means.
  - 1 hour a day, 120 AZN ⇄ Bait: real work does not pay like this
  - Deposit for a VIP task ⇄ Taking your money directly
  - Tax to withdraw earnings ⇄ The next payment trap
  - Everyone in the group is earning ⇄ Planted members and fake reviews
- 💡 Whatever the payment is called, if you pay to work, it is not a job.

#### recap · `tt-recap`
- ✔ A job paying you to like and review is a scam.
- ✔ The first small payout is bait; deposits and withdrawal taxes are the trap.
- ✔ Already paid? Bank, police 102, keep the chat.

### The recruiter email (`recruiter-mail`, 3 dəq)

#### tutor · `rm-tutor`
- 🗣 "Fake job offers also come by email, and they look very official." — _talk/wave, visual: inbox_
- 🗣 "Everything looks fine, except one line: a registration fee." — _alert/point-left, visual: artifact_, highlight `fee`
  - 🗂 **email** (brand `w2d-karyera-plus`)
    - from: KaryeraPlus | Hiring <hr.karyeraplus@poctam.example>
    - subject: Congratulations! You were selected for a remote job
    - time: 09:31
    - body: Position: online order operator, 1,400 AZN a month. / **Registration fee: 35 AZN.**⟨fee⟩ / **Send photos of both sides of your ID card.**⟨id-scan⟩
- 🗣 "They also want photos of both sides of your ID. That is your identity." — _think/lean-in, visual: artifact_, highlight `id-scan`
  - 🗂 **email** (brand `w2d-karyera-plus`)
    - from: KaryeraPlus | Hiring <hr.karyeraplus@poctam.example>
    - subject: Congratulations! You were selected for a remote job
    - time: 09:31
    - body: Registration fee: 35 AZN. / **Send photos of both sides of your ID card.**⟨id-scan⟩
- 🗣 "A real employer never charges to hire you, and takes documents formally when you are hired." — _happy/recite, visual: badge-id_

#### hotspot · `rm-hotspot`
- 🔍 Find the warning signs in this job offer. (ən azı 3)
  - 🗂 **email** (brand `w2d-karyera-plus`)
    - from: KaryeraPlus | Hiring <**hr.karyeraplus@poctam.example**⟨free-mail⟩>
    - subject: Congratulations! You were selected for a remote job
    - time: 09:31
    - body: Dear candidate, / **Your profile was approved, you are hired without an interview.**⟨no-interview⟩ / Position: online order operator, 1,400 AZN a month, from home. / **Registration fee: 35 AZN. Refunded with your first salary.**⟨fee⟩ / **Reply with photos of both sides of your ID card.**⟨id-scan⟩ / **Places are limited, reply within 24 hours.**⟨rush⟩
  - ⟨free-mail⟩ **Free mailbox**: A company writes from its own domain, not a free mailbox. Anyone can open an address like this.
  - ⟨no-interview⟩ **Hired without an interview**: A real employer does not hire you without talking to you. This line is meant to excite and rush you.
  - ⟨fee⟩ **Registration fee**: If you are asked to pay to be hired, it is a scam. That money will not come back.
  - ⟨id-scan⟩ **ID photo**: With an ID photo they can try to open accounts or loans in your name. Hand over documents only when formally hired.
  - ⟨rush⟩ **Pressure**: The deadline keeps you from checking. A real vacancy does not vanish in a day.

#### simulation · `rm-sim` · Job search mailbox
- 🖥 mühit: `inbox` — You are looking for work and have four emails. Choose the right step for each.
  - **step `real-invite`**
    - 🗂 **email** (brand `w2d-xezer-logistika`)
      - from: Khazar Logistics | HR department <kadr@xezerlogistika.example>
      - subject: Interview invitation: operator vacancy
      - time: 08:40
      - body: Dear candidate, thank you for your application on the IshBazar site. / Interview: 7 October, 11:00, at our office in Narimanov district. / Please bring your ID card. No payment of any kind is required. / Questions: +994 12 000 40 60
    - ✅ [reply] Confirm the interview — Right. You applied yourself, the company writes from its own domain and asks for no money.
    - ✅ [verify] Check on the company's site — Good habit. Finding the number on the company's official site and calling it is the surest check.
    - ⚠️ [report] Report as phishing — This email is genuine: you applied yourself and no money is asked. If in doubt, call the company's official number.
  - **step `fee-offer`**
    - 🗂 **email** (brand `w2d-karyera-plus`)
      - from: KaryeraPlus | Hiring <hr.karyeraplus@poctam.example>
      - subject: Congratulations! You were selected for a remote job
      - time: 09:31
      - body: You are hired without an interview: 1,400 AZN a month, from home. / Pay the registration fee today to keep your place: Pay 35 AZN → `https://karyeraplus-qeydiyyat.example.net/odenis`
    - 💀 [click-link] Pay 35 AZN — The registration fee is the scam itself. If you typed card details, call your bank now.
    - ✅ [report] Report as phishing — Right. An offer that asks you to pay to be hired is a scam.
    - ✅ [delete] Delete — Good. Reporting it would protect other candidates too.
  - **step `abroad-offer`**
    - 🗂 **email** (brand `w2d-avrokadr`)
      - from: AvroKadr | Jobs abroad <info@avrokadr-jobs.example.net>
      - subject: Warehouse job abroad: 2,800 euro a month, visa on us
      - time: 10:15
      - body: Visa and ticket are on us. No language skills needed. / Just pay 180 AZN for document processing: Prepare documents → `https://avrokadr-jobs.example.net/viza`
    - 💀 [click-link] Prepare documents — Once the document fee is paid, the agency will vanish. Check any job abroad only through an officially registered agency.
    - ✅ [report] Report as phishing — Right. High pay with no language needed plus a fee up front is a classic trap.
    - ⚠️ [reply] Ask for details — Replying shows your address is active and brings more pressure. Report and delete it.
  - **step `site-notice`**
    - 🗂 **email** (brand `w2d-isbazar`)
      - from: IshBazar <bildiris@isbazar.example>
      - subject: 3 employers viewed your profile this week
      - time: 11:02
      - body: Update your profile to get better matching vacancies. / Reminder: IshBazar and real employers never ask you for payment or an ID photo.
    - ✅ [mark-safe] Mark as safe — Right. This is a routine notice from a site you signed up to, asking for no money or documents.
    - ⚠️ [report] Report as phishing — This email is safe: it comes from a site you know and asks for nothing. Telling such notices apart matters too.

#### swipe · `rm-swipe`
- 👉 Is this job offer safe or a scam?
  - 🛑 threat `like-videos`: Being promised money for likes is how the task scam begins.
    - 🗂 **chat**
      - app: telegram
      - contact: Remote work | Daily pay
      - 💬 them: Like videos, 2 AZN each. Paid every day.
  - ✅ safe `office-interview`: You applied, the interview is in person and no money is asked. This is a normal hiring step.
    - 🗂 **sms** (brand `w2d-xezer-logistika`)
      - sender: XezerLog
      - time: 15:30
      - 💬 Your interview is on 7 October at 11:00 at our Narimanov office. Bring your ID card.
  - 🛑 threat `pay-to-withdraw`: If you must pay to withdraw earnings, those earnings do not exist. Do not send a single manat.
    - 🗂 **chat** (brand `w2d-nergiz-market-fake`)
      - app: whatsapp
      - contact: Nargiz Market HR | Aynur
      - 💬 them: Your earnings are 340 AZN. Pay 15% tax to withdraw.
  - 🛑 threat `reship`: Such jobs often move goods bought with stolen cards under your name. In the end you are the one held responsible.
    - 🗂 **email** (brand `w2d-qlobal-catdirilma`)
      - from: Global Delivery Service <jobs@qlobal-catdirilma.example.net>
      - subject: Work from home: receive and forward parcels
      - time: 17:40
      - body: Receive parcels at home, put on a new label and send them on. 25 AZN per parcel.
  - ✅ safe `internal-vacancy`: The email comes from your organisation's own domain and points to a portal you know. It asks for no money or documents.
    - 🗂 **email** (brand `idare`)
      - from: Agency | HR department <kadr@idare.example>
      - subject: Internal vacancy: analyst
      - time: 18:05
      - body: Applications for the internal competition are taken on the HR portal. There is no fee.

#### recap · `rm-recap`
- ✔ If you are asked to pay to be hired, it is a scam.
- ✔ Never send a photo of your ID by email or messenger.
- ✔ Check the company on its official site and number.


## Investment and crypto traps (`investment-scams`) · Social engineering · Medium · 200 XP

### The adviser's call (`adviser-call`, 3 dəq)

#### tutor · `ac-tutor`
- 🗣 "Hello! Today we look at the most dangerous moment of an investment scam: the personal adviser's call." — _talk/wave, visual: social_
- 🗣 "It starts with an ad or a messenger group. Notice the words guaranteed returns." — _alert/point-left, visual: artifact_, highlight `guarantee`
  - 🗂 **chat** (brand `w2d-bakutrade`)
    - app: whatsapp
    - contact: BakuTrade Pro | Investors
    - 💬 them: Another +18% today!
    - 💬 them: **Guaranteed returns, no risk.**⟨guarantee⟩
- 🗣 "No legitimate investment promises big guaranteed returns." — _think/shake, visual: alarm_
- 🗣 "Check the licence yourself in the Central Bank's official list. A foreign licence is not enough here." — _happy/recite, visual: certificate_

#### simulation · `ac-sim` · BakuTrade Pro is calling
- 🖥 mühit: `call` — You left your number in a form from an ad. Now an adviser calls. Choose your replies.
  - **step `ring`**
    - 🗂 **call** (brand `w2d-bakutrade`)
      - caller: BakuTrade Pro
      - number: +44 7700 900 418
      - label: United Kingdom
      - voice: young-man-2
    - ✅ [answer] Answer — Answering is not dangerous. What matters is what you agree to.
    - ✅ [decline] Decline — That works too. You do not have to answer an unknown foreign number. → `after`
  - **step `pitch`** — 🗣 "Hello, I am Javid Alizada, your personal adviser at BakuTrade Pro. We guarantee thirty percent a month, with no risk."
    - 🗂 **call** (brand `w2d-bakutrade`)
      - caller: BakuTrade Pro
      - number: +44 7700 900 418
      - label: United Kingdom
      - voice: young-man-2
    - ⚠️ [reply] Sounds good, what do I do? — Guaranteed high returns are the main sign of fraud. If you go on, they will ask for money.
    - ✅ [verify] I will check your licence in the Central Bank's list — Right. Check the licence yourself in the official list, not by their word. → `licence-push`
    - ✅ [hang-up] End the call — Good call. A promise of guaranteed returns is reason enough to hang up. → `after`
  - **step `deposit`** — 🗣 "Great! It takes only 250 manat to start. Tell me your card number and the code on the back, and I will open the account."
    - 🗂 **call** (brand `w2d-bakutrade`)
      - caller: BakuTrade Pro
      - number: +44 7700 900 418
      - label: United Kingdom
      - voice: young-man-2
    - 💀 [share] I read out my card details — Your card details went to the scammer. Right after the call, phone your bank and block the card. → `remote`
    - ✅ [keep-private] I do not give card details by phone — Right. Never tell anyone your card number or the code on the back over the phone. → `licence-push`
    - ✅ [hang-up] End the call — Good call. Hanging up on a call that asks for card details is the right answer. → `after`
  - **step `licence-push`** — 🗣 "We have a European licence, I have just sent you the certificate. No need to check with the Central Bank."
    - 🗂 **call** (brand `w2d-bakutrade`)
      - caller: BakuTrade Pro
      - number: +44 7700 900 418
      - label: United Kingdom
      - voice: young-man-2
    - ⚠️ [reply] If there is a certificate, fine — A certificate image is easy to fake. The Central Bank has warned that a foreign licence gives no right to operate here.
    - ✅ [verify] I will still check the official list — Great. An adviser who tries to stop you checking gives himself away.
    - ✅ [hang-up] End the call — Right. When the pressure grows, ending the call is the best answer. → `after`
  - **step `remote`** — 🗣 "Let me help you trade. Install the EkranPaylash app so I can see your screen."
    - 🗂 **call** (brand `w2d-bakutrade`)
      - caller: BakuTrade Pro
      - number: +44 7700 900 418
      - label: United Kingdom
      - voice: young-man-2
    - 💀 [install] I install the app — With this app he can control your screen and your banking app. Never install one because a caller asks.
    - ✅ [keep-private] I will not install any app — Right. A real adviser never asks to control your screen.
    - ✅ [hang-up] End the call — Good call. End any call that asks for remote access right away.
  - **step `after`** · The call has ended. What now?
    - 🗂 **call** (brand `w2d-bakutrade`)
      - caller: BakuTrade Pro
      - number: +44 7700 900 418
      - label: United Kingdom
      - voice: young-man-2
    - ✅ [verify] Check the Central Bank's list — Right. If the company is not on the list, report it to the police on 102.
    - ⚠️ [call-back] Call the adviser back — Calling back hands the conversation to the scammer again. Check through an official source.
    - ✅ [block] Block the number — Good. If you gave card details, call your bank right away too.

#### choice · `ac-choice`
- ❓ A colleague says: "I made 200 manat in the first month and withdrew it. So the platform is real."
  - ✅ The first withdrawal is bait, they will not return a big sum — Right. Letting you withdraw a little is how they get a much bigger deposit.
  - ❌ So it is real, I will join too — One successful withdrawal does not prove the platform is legal. Check the licence in the official list.
  - ❌ She should invest more to grow the profit — That is exactly what the scammers wait for. After a big deposit, withdrawals suddenly stop working.
- 💡 Trust the Central Bank's licence list, not the platform's word.

#### order · `ac-order`
- 🔢 Put the steps in order after sending money to a scam platform.
  1. Stop paying and cut contact
  2. Call your bank and block the card
  3. Keep the chats, numbers and transfer records
  4. Report it to the police on 102
- 💡 Then services promising to recover your money will appear. That is a second scam, do not pay them.

#### recap · `ac-recap`
- ✔ Guaranteed high returns are a sign of fraud.
- ✔ Check the licence yourself in the Central Bank's official list.
- ✔ Never install an app or give card details for a caller.

### The fake profit dashboard (`fake-dashboard`, 3 dəq)

#### tutor · `fd-tutor`
- 🗣 "After you deposit, the platform shows you a nice chart and a growing balance." — _talk/wave, visual: browser_
- 🗣 "On a fake platform these numbers are just text on a screen, with no money behind them." — _think/point-left, visual: artifact_, highlight `balance`
  - 🗂 **dialog** (brand `w2d-bakutrade`)
    - tone: app
    - title: BakuTrade Pro | **Balance: 12,480 AZN (+312%)**⟨balance⟩
    - body: **To withdraw, first pay 15% income tax: 1,870 AZN**⟨fee⟩
    - buttons: Pay the tax, Close
- 🗣 "When you try to withdraw, they ask for tax, a fee or insurance. That is the final stage of the scam." — _alert/lean-in, visual: artifact_, highlight `fee`
  - 🗂 **dialog** (brand `w2d-bakutrade`)
    - tone: app
    - title: BakuTrade Pro | **Balance: 12,480 AZN (+312%)**⟨balance⟩
    - body: **To withdraw, first pay 15% income tax: 1,870 AZN**⟨fee⟩
    - buttons: Pay the tax, Close
- 🗣 "If a withdrawal needs a payment first, stop and do not send a single manat more." — _happy/recite, visual: shield_

#### hotspot · `fd-hotspot`
- 🔍 Find the signs of fraud on this dashboard. (ən azı 3)
  - 🗂 **dialog** (brand `w2d-bakutrade`)
    - tone: app
    - title: BakuTrade Pro | **Balance: 12,480 AZN (+312%)**⟨balance⟩
    - body: **Guaranteed daily return: 3%**⟨guarantee⟩ / **To withdraw, first pay 15% income tax: 1,870 AZN**⟨fee⟩ / **Licence: International Financial Commission, No 00417**⟨licence⟩ / **Offer ends in 2 hours. Contact your manager in the messenger.**⟨rush⟩
    - buttons: Pay the tax, Close
  - ⟨balance⟩ **Miracle growth**: Quadrupling in a few months almost never happens in a real market. Anyone can type a number on a screen.
  - ⟨guarantee⟩ **Guaranteed returns**: Investment returns cannot be guaranteed. The word itself is a warning.
  - ⟨fee⟩ **Pay to withdraw**: A real platform does not ask you to send new money to release yours. Pay it and another excuse will follow.
  - ⟨licence⟩ **Fake licence**: Such a body may not even exist, and a foreign licence gives no right here anyway. Look at the Central Bank's list.
  - ⟨rush⟩ **Rushing you**: The deadline is there so you have no time to think or ask anyone.

#### simulation · `fd-sim` · Withdrawing the money
- 🖥 mühit: `browser` — Your balance on the platform has grown and you want to withdraw. Decide at each step.
  - **step `dashboard`** · Your balance: 12,480 AZN. Upgrade to VIP — 🗣 "The balance has grown. Now try to withdraw."
    - 🗂 **url** (brand `w2d-bakutrade`)
      - url: https://bakutrade-pro.example.net/panel
    - ✅ [open] Withdraw — Trying to withdraw does no harm. See what they ask for on the next screen.
    - 💀 [click-link] Add 500 AZN, go VIP — The balance on screen is not real, and new money will be lost too. Stop.
  - **step `fee`** — 🗣 "They want a tax before the withdrawal."
    - 🗂 **dialog** (brand `w2d-bakutrade`)
      - tone: warning
      - title: Withdrawal on hold
      - body: A 15% income tax is required to withdraw: 1,870 AZN. / If the tax is not paid, funds will be frozen in 48 hours.
      - buttons: Pay the tax, Cancel
    - 💀 [click-link] Pay the tax — After the tax they will ask for insurance, then a commission. The balance will never come out.
    - ✅ [cancel] Cancel — Right. Being asked to pay to withdraw shows the platform is fake.
  - **step `recovery-page`** · We recover lost investments in 30 days — 🗣 "A few days later this ad appears."
    - 🗂 **url** (brand `w2d-fond-berpa`)
      - url: https://fondberpa-huquq.example.net
    - ⚠️ [click-link] Apply — A promise to recover money can be a second trap. See what they ask for next.
    - ✅ [cancel] Close the tab — Right. A service that promises to get your money back is often a second scam. → `report-site`
  - **step `recovery-form`** — 🗣 "To get money back, they want a payment up front too."
    - 🗂 **login** (brand `w2d-fond-berpa`)
      - brand: FondBərpa
      - url: https://fondberpa-huquq.example.net/muraciet
      - fields: Full name, Phone, Card number, CVV
      - button: Pay 300 AZN and start
    - 💀 [enter-credentials] Pay 300 AZN and start — This is the second scam, sometimes run by the same gang. Block the card and tell the police.
    - ✅ [cancel] Close the tab — Good call. To trace the money, go to your bank and the police, and that costs nothing.
  - **step `report-site`** — 🗣 "The browser offers to report the site."
    - 🗂 **dialog**
      - tone: system
      - title: Report this site
      - body: Report bakutrade-pro.example.net as a fraudulent site?
      - buttons: Report, Later
    - ✅ [report] Report — Great, reporting helps block the site for others. Contact the police on 102 as well.
    - ⚠️ [later] Later — Not reporting lets the scammers find new victims. Take a minute and report it.

#### scenario · `fd-scenario` · The investor group
- 🎭 start: `group`
  - **[group]** Gunay, your colleague (group "Smart Investors") (message, 🔊woman): "Look, I put in 400 manat and today it is 1,200. Join us."
    - Let's check the licence in the Central Bank's list first → `pressure` — Right. Even a friend's tip does not make a platform legal.
    - If Gunay is earning, I am in ⇒ **compromised** — The profit on Gunay's screen may be fake too. Scammers pull people in through people they know.
  - **[pressure]** Group admin (message, 🔊man-2): "Forget the list, we have a foreign licence. Only 3 places left!"
    - A foreign licence gives no right here, I am out → `warn` — Right. The Central Bank has warned that a foreign licence gives no right to operate here.
    - Join fast before the places run out ⇒ **compromised** — Limited places are there to rush you. Pressure like this is itself a sign of fraud.
  - **[warn]** Gunay (message, 🔊woman): "What about my 400 manat? I want to withdraw, and they say I must pay a tax."
    - Pay nothing, call your bank, report it on 102 ⇒ **safe** — Great. Reporting in time stops the loss and protects others.
    - Pay the tax, then the money will come ⇒ **compromised** — After the tax there will be a new excuse. The loss will only grow.
    - Ask in the group, the admins will help ⇒ **risky** — The admins are the scammers themselves. They will only ask for another payment.

#### recap · `fd-recap`
- ✔ Profit on a screen is not money: if withdrawing needs a payment, stop.
- ✔ A service promising to recover your money is a second scam.
- ✔ Check the licence and report fraud to the police on 102.


## Online shopping scams (`online-shopping-scams`) · Social engineering · Easy · 200 XP

### Fake shop (`fake-shops`, 3 dəq)

#### tutor · `fs-tutor`
- 🗣 "Hello! In this lesson you will learn to spot fake shops on social media." — _talk/wave, visual: social_
- 🗣 "Look at this ad: an expensive air conditioner for only 299 manat, today only, paid in advance." — _alert/point-left, visual: artifact_, highlight `prepay`
  - 🗂 **notification** (brand `kontakto`)
    - app: Kontakto
    - title: Sponsored: Serin Klimat Sale
    - body: Air conditioner for just 299 AZN, not 1,199! **Today only, 100% prepayment.**⟨prepay⟩
    - time: 13:05
- 🗣 "The scammer takes the money first, then closes the page and disappears." — _think/lean-in, visual: hook_
- 🗣 "The rule is simple: never prepay an unknown page, and pay on delivery whenever you can." — _happy/shield-up, visual: shield_

#### swipe · `fs-swipe`
- 👉 Which shop offer is safe and which is a threat?
  - 🛑 threat `rush`: Pressure plus card to card prepayment only is the main sign of a fake shop. That money is very hard to get back.
    - 🗂 **chat** (brand `w2e-serin-klimat-fake`)
      - app: generic
      - contact: Serin Klimat Sale
      - 💬 them: The offer ends today, only 3 left. Payment by card to card only, 100% in advance.
  - ✅ safe `official`: A realistic price, a page that is years old and payment on delivery. You see the goods first and pay after.
    - 🗂 **notification** (brand `kontakto`)
      - app: Kontakto
      - title: Serin Klimat, since 2014
      - body: Air conditioner 1,149 AZN. Pay on delivery, cash or card. Shop and service centre in Narimanov.
      - time: 10:20
  - 🛑 threat `lookalike`: This is not the shop's official site. An extra word added to the name and a strange domain mark a fake page.
    - 🗂 **url** (brand `w2e-serin-klimat-fake`)
      - url: https://serin-klimat-endirim.example.net/kampaniya
  - ✅ safe `cod`: Paying on delivery protects you. You never pay before you see the goods.
    - 🗂 **chat**
      - app: generic
      - contact: Laman Handmade
      - 💬 them: Hi! I send orders with CevikKargo, you pay the courier when it arrives.
  - 🛑 threat `new-page`: A new page, closed comments and a deposit request together are a serious warning. Followers can be bought.
    - 🗂 **chat**
      - app: generic
      - contact: Phone Outlet Baku
      - 💬 them: Our page is new but we have 20k followers. We closed comments to stop spam. Send a 50 AZN deposit.

#### simulation · `fs-sim` · Air conditioner offer
- 🖥 mühit: `phone` — You saw a cheap air conditioner ad on Kontakto. Decide step by step on your phone.
  - **step `ad`** — 🗣 "The ad is very tempting. Looking is fine."
    - 🗂 **notification** (brand `kontakto`)
      - app: Kontakto
      - title: Sponsored: Serin Klimat Sale
      - body: Air conditioner for just 299 AZN, not 1,199! Today only, 100% prepayment.
      - time: 13:05
    - ✅ [open] Open the ad — Looking is not dangerous. The real decision comes before you pay.
    - ✅ [ignore] Hide ad — Good choice. A price that is far too low is often bait. → `real-shop`
  - **step `prepay`** — 🗣 "The seller asks for prepayment straight away."
    - 🗂 **chat** (brand `w2e-serin-klimat-fake`)
      - app: generic
      - contact: Serin Klimat Sale
      - 💬 them: Hi! The offer ends today at 18:00.
      - 💬 them: Send your name and address and transfer 299 AZN to this card: **** **** **** 0000. Delivery tomorrow.
    - ✅ [reply] Can I pay on delivery? — Good question. A real shop usually agrees to payment on delivery.
    - 💀 [share] Transfer 299 AZN now — The money went to a stranger's card. A prepayment is very hard to get back. → `gone`
    - ✅ [report] Report page — Well done. The page you reported cannot fool other buyers. → `real-shop`
  - **step `deposit`** — 🗣 "Here comes the excuse: now it wants a deposit."
    - 🗂 **chat** (brand `w2e-serin-klimat-fake`)
      - app: generic
      - contact: Serin Klimat Sale
      - 💬 me: Can I pay on delivery?
      - 💬 them: No payment on delivery at the sale price. Send at least a 50 AZN deposit and pay the rest to the courier.
    - 💀 [share] Send 50 AZN deposit — A deposit is a prepayment too. The fake shop takes it and vanishes.
    - ✅ [verify] Find the shop's official page myself — Right. Checking the official page and buyer reviews takes a few minutes. → `real-shop`
    - ✅ [block] Block — Good. A stranger who will not sell without prepayment is not worth the talk. → `real-shop`
  - **step `gone`** — 🗣 "The next day no air conditioner came, and the page is gone."
    - 🗂 **notification** (brand `kontakto`)
      - app: Kontakto
      - title: Chat unavailable
      - body: Serin Klimat Sale was deleted or has blocked you.
      - time: 09:30
    - ✅ [call-back] Call the bank on the number on the card — Right. If the bank hears quickly, it can try to stop the transfer.
    - ✅ [report] Save screenshots, tell the police — Good step. The chat and the transfer receipt are evidence for the police.
    - ⚠️ [ignore] Wait a few days — Every hour counts. Waiting lowers the chance of getting the money back.
  - **step `real-shop`** — 🗣 "This is the shop's official page."
    - 🗂 **chat** (brand `w2e-serin-klimat`)
      - app: generic
      - contact: Serin Klimat
      - 💬 them: Hello! This is our only official page. Air conditioner 1,149 AZN, pay on delivery in cash or by card.
      - 💬 them: Any page asking for prepayment in our name is not ours.
    - ✅ [reply] Order with payment on delivery — Great choice. You pay after you see and check the goods.
    - ✅ [forward] Show the shop the fake page — Good. The shop can report the fake page and get it taken down.
    - ⚠️ [open] Go back to the cheap page — Going back to the fake page puts your money at risk. Stay with the official shop.

#### match · `fs-match`
- 🔗 Match each sign with what it means.
  - Page opened a week ago ⇄ Fake shops open fast and close fast
  - Comments are turned off ⇄ Unhappy buyers are silenced
  - Card to card prepayment only ⇄ The money is very hard to recover
  - Price is a third of the market ⇄ Bait to make you rush
- 💡 One sign is enough to stop. Check the shop on its official site and in buyer reviews.

#### choice · `fs-choice`
- ❓ You are buying from an online shop you do not know. What is the safest way to pay?
  - ✅ Pay on delivery, when you get the goods — Right. You never pay before you see the goods, so a fake shop gets nothing.
  - ❌ Transfer to the seller's personal card — A transfer to a personal card cannot be reversed. That is exactly what scammers want.
  - ❌ Send half as a deposit — A deposit is a prepayment too. The fake shop takes it and vanishes.
  - ❌ Pay with cryptocurrency — Nobody can reverse a crypto transfer. If a shop asks for it, walk away.
- 💡 If prepayment is required, pay only an official shop you have known for a long time. When in doubt, do not buy.

#### recap · `fs-recap`
- ✔ Never prepay a page you do not know.
- ✔ Pay on delivery when you can: see the goods first, then pay.
- ✔ Check the page's age and reviews, and do not trust a price that is far too low.

### When you sell (`selling-safely`, 3 dəq)

#### tutor · `ss-tutor`
- 🗣 "Now you are the seller. You are selling an old pram on a classifieds site for 260 manat." — _talk/wave, visual: handshake_
- 🗣 "The buyer writes that she has already paid, and asks you to open this link to receive the money." — _alert/point-left, visual: artifact_, highlight `link`
  - 🗂 **chat**
    - app: whatsapp
    - contact: Rena (buyer)
    - 💬 them: Hi, I'll take the pram! I paid through AlSat Safe Deal.
    - 💬 them: To receive the money, confirm your card here: **alsat-odenis.example.net/qebul**⟨link⟩ → `https://alsat-odenis.example.net/qebul`
- 🗣 "Receiving money needs only the card number. The three digits on the back and the text code are never needed." — _think/lean-in, visual: key_
- 🗣 "If such a link arrives, type nothing. Talk to the buyer only in the site's own messages." — _happy/recite, visual: shield_

#### hotspot · `ss-hotspot`
- 🔍 Find the warning signs on this page. (ən azı 3)
  - 🗂 **dialog** (brand `w2e-alsat-fake`)
    - tone: app
    - title: AlSat Safe Deal
    - body: Page: **alsat-odenis.example.net/qebul**⟨domain⟩ / The buyer has paid 260.00 AZN. Confirm your card to receive the money. / **Enter card number, expiry date and CVV**⟨cvv⟩ / **Enter the SMS code from your bank**⟨otp⟩ / **The deal will be cancelled in 15 minutes**⟨timer⟩
    - buttons: Cancel, Receive money
  - ⟨domain⟩ **Strange address**: This is not the classifieds site's own address. A familiar name was added to a different domain.
  - ⟨cvv⟩ **Code on the back of the card**: This code is for taking money out of your card. It is never needed to receive money.
  - ⟨otp⟩ **SMS code**: The text message code confirms a payment. If you type it, money leaves your card.
  - ⟨timer⟩ **Pressure**: The countdown is there to stop you thinking. A real site does not rush the seller.

#### simulation · `ss-sim` · The buyer's link
- 🖥 mühit: `browser` — You opened the link the buyer sent. In the browser, choose the right move at every step.
  - **step `landing`** · Money is waiting for you: 260.00 AZN — 🗣 "Look at the address bar."
    - 🗂 **url** (brand `w2e-alsat-fake`)
      - url: https://alsat-odenis.example.net/qebul (əslində: `alsat-odenis.example.net`)
    - ⚠️ [click-link] Receive money — This button does not pay you, it opens a form that asks for card details. The address is not the classifieds site.
    - ✅ [cancel] Close tab — Right. The address was strange, so type nothing on that page. → `real-site`
    - ✅ [open] Open the site myself — Well done. When you open the site yourself, you do not land on a fake page. → `real-site`
  - **step `card-form`** — 🗣 "The form also wants the code on the back of the card."
    - 🗂 **login** (brand `w2e-alsat-fake`)
      - brand: AlSat Payment
      - url: https://alsat-odenis.example.net/kart (əslində: `alsat-odenis.example.net`)
      - fields: Card number, Expiry date, CVV
      - button: Confirm
    - 💀 [enter-credentials] Confirm — With these details the scammer can pay from your card. This code is not needed to receive money.
    - ✅ [cancel] Cancel — Right. A page that asks for the code on the back of the card does not give money, it takes it. → `real-site`
  - **step `sms-code`** — 🗣 "The bank message says payment, but the page says receipt."
    - 🗂 **dialog** (brand `w2e-alsat-fake`)
      - tone: app
      - title: Enter the SMS code
      - body: Your bank sent a 6 digit code. / Do not worry if the SMS says "payment": this is a receiving transaction.
      - buttons: Cancel, Confirm code
    - 💀 [share] Confirm code — The code approved a payment and money left your card. Call your bank right away.
    - ✅ [cancel] Cancel — Right. The text message code is for payments, so never type it on a page or give it to anyone.
  - **step `real-site`** · AlSat: messages with the buyer — 🗣 "This is the classifieds site itself."
    - 🗂 **url** (brand `w2e-alsat`)
      - url: https://alsat.example/mesajlar (əslində: `alsat.example`)
    - ✅ [report] Report buyer — Well done. The site will close the scam account and protect other sellers.
    - ✅ [reply] Write to buyer: cash when we meet — Good. Meeting and taking cash is the simplest and safest way.
    - 💀 [share] Send a photo of both sides of the card — The photo also shows the code on the back. That means handing your card to the scammer.

#### choice · `ss-choice`
- ❓ The buyer wants to transfer money to your card. What is enough to give?
  - ✅ Only the card number or account number — Right. Nothing else is needed to receive money.
  - ❌ Card number, expiry date and the code on the back — With these details someone can pay from your card. Never give the code on the back.
  - ❌ The SMS code from the bank — The text message code is for taking money out. A buyer who asks for it is a scammer.
  - ❌ A photo of both sides of the card — The photo holds everything, including the code on the back. It is like handing over the card.
- 💡 Receiving money never needs the code on the back of the card or a text message code. Anyone who asks for them is a scammer.

#### scenario · `ss-scenario` · You typed the code
- 🎭 start: `charged`
  - **[charged]**  (, 🔊-): "In a hurry you typed your card details and the SMS code. A minute later the bank texts you: 389 manat has left your card."
    - Call the bank at once on the number on the card and block it → `bank` — Right. Blocking the card quickly stops further payments.
    - Write to the buyer and ask for the money back ⇒ **risky** — The scammer will not pay it back, and time is passing. Call the bank first.
    - I feel ashamed and tell no one ⇒ **compromised** — Silence gives the scammer time. Banks and police deal with cases like this every day.
  - **[bank]** Gulnar (bank operator) (phone, 🔊woman): "Your card is blocked. What else would you like to do?"
    - Save screenshots and report to the police and the classifieds site ⇒ **safe** — Well done. Evidence helps the police, and the site closes the scam account.
    - Delete the chat so I can forget it ⇒ **risky** — The chat is evidence. Do not delete it, show it to the police.

#### recap · `ss-recap`
- ✔ Receiving money never needs the code on the back of the card or an SMS code.
- ✔ Type nothing into a payment link a buyer sends you.
- ✔ If you typed a code, call your bank at once on the number on the card.


## Romance scams (`romance-scams`) · Social engineering · Easy · 200 XP

### Weeks of chat (`weeks-of-chat`, 3 dəq)

#### tutor · `wc-tutor`
- 🗣 "Hello! This lesson is about online dating. The scammer writes patiently for weeks, then asks for money." — _talk/wave, visual: mask_
- 🗣 "It all starts with warm words: a lovely photo, a moving life story and messages every day." — _think/point-left, visual: artifact_, highlight `sweet`
  - 🗂 **chat**
    - app: generic
    - contact: Kamran Aliyev
    - 💬 them: **Good morning! Writing to you is the best moment of my day.**⟨sweet⟩
- 🗣 "Then a problem suddenly appears: customs, a hospital or a great investment. And money is needed." — _alert/lean-in, visual: alarm_
- 🗣 "The rule: never send money or crypto to someone you have not met in person." — _happy/shield-up, visual: shield_

#### simulation · `wc-sim` · A new friend
- 🖥 mühit: `phone` — An engineer called Kamran writes to you on social media. Follow the chat as the weeks pass and decide.
  - **step `first`** — 🗣 "The first message. So far everything looks normal."
    - 🗂 **chat**
      - app: generic
      - contact: Kamran Aliyev
      - 💬 them: Hi! I came across your photos and really liked them. I am an engineer on an offshore oil platform and rarely get to Baku.
    - ✅ [verify] Check his photo with a reverse image search — Smart move. Fake profiles often use someone else's photos.
    - ✅ [reply] Reply: nice to meet you — Chatting is fine, but be careful. You have no friends in common and the profile is new.
    - ⚠️ [share] Send my phone number and workplace — Do not rush to give personal details to a stranger. They can be used to pressure you later.
  - **step `no-video`** — 🗣 "Two weeks have passed. Messages arrive every day."
    - 🗂 **chat**
      - app: generic
      - contact: Kamran Aliyev
      - 💬 them: You are my first thought every morning.
      - 💬 me: Shall we do a video call?
      - 💬 them: I would love to, but the camera does not work on the platform and the internet is weak. I can only write.
    - ✅ [verify] Insist on a video call — Right. Avoiding video calls for weeks is a key sign of a fake profile.
    - ⚠️ [reply] I understand, let's keep writing — If there is always an excuse, the person may not be who they say they are.
  - **step `invest`** — 🗣 "A month has passed. Suddenly the talk turns to money."
    - 🗂 **chat**
      - app: generic
      - contact: Kamran Aliyev
      - 💬 them: Let me tell you a secret: I make 30 percent a month on KriptoNova. Start with 500 AZN, I will open your account: kriptonova.example.net/qeydiyyat → `https://kriptonova.example.net/qeydiyyat`
    - ✅ [reply] No, I do not do money deals — Right. Moving from romance to investment is a classic scam path.
    - ⚠️ [click-link] Open the link, just to look — A fake platform shows profit charts but never lets you withdraw.
    - 💀 [share] Invest 500 AZN — That money went to the scammer. A platform that promises guaranteed returns is fake.
  - **step `crisis`** — 🗣 "Two more weeks have passed. Now there is a crisis."
    - 🗂 **chat**
      - app: generic
      - contact: Kamran Aliyev
      - 💬 them: I need help urgently. Customs is holding my equipment and wants a 1,800 AZN fee. My card is blocked abroad.
      - 💬 them: I will pay you back next week. Please do not tell anyone.
    - 💀 [share] Send 1,800 AZN — The money is gone and will not come back. Never send money to someone you have not met. → `more`
    - ✅ [verify] Talk to my family first — Well done. A request for secrecy is a warning in itself, and your family sees the situation from outside.
    - ✅ [block] Block and report profile — Right. When a crisis and a money request come together, it is a scam. → `first`
  - **step `pressure`** — 🗣 "No money arrives, so the pressure grows."
    - 🗂 **chat**
      - app: generic
      - contact: Kamran Aliyev
      - 💬 them: So you do not trust me? I have no one but you...
    - ✅ [block] Block and report profile — The right decision. Making you feel guilty is the scammer's last tool. → `first`
    - 💀 [share] I feel bad, I'll send the money — The pressure worked and the money is gone. Someone who truly loves you would not blame you over money.
  - **step `more`** — 🗣 "He got the money, and a new demand came at once."
    - 🗂 **chat**
      - app: generic
      - contact: Kamran Aliyev
      - 💬 them: Thank you so much, my dear! Now customs wants insurance too, I need another 900 AZN.
    - ✅ [verify] Stop, go to the bank and the police — Right. A scammer never stops and finds a new reason after every payment.
    - 💀 [share] Send it one more time — Every new payment makes the loss bigger. Stop and talk to your family.

#### hotspot · `wc-hotspot`
- 🔍 Find the warning signs in Kamran's messages. (ən azı 3)
  - 🗂 **chat**
    - app: generic
    - contact: Kamran Aliyev
    - 💬 them: **I work on an offshore oil platform and rarely get to Baku.**⟨abroad⟩
    - 💬 them: **The camera does not work, I can only write.**⟨no-video⟩
    - 💬 them: **I make 30 percent a month on KriptoNova.**⟨invest⟩
    - 💬 them: **Customs wants 1,800 AZN. Do not tell anyone.**⟨secret⟩
  - ⟨abroad⟩ **Working far away**: Being offshore, abroad or on military duty is a ready excuse never to meet.
  - ⟨no-video⟩ **No video calls**: Avoiding video calls for weeks suggests the profile may be fake.
  - ⟨invest⟩ **Guaranteed profit**: Moving from romance to investment is a classic scam path. Guaranteed returns do not exist.
  - ⟨secret⟩ **Secrecy and money**: When a money request comes with secrecy, stop and talk to your family.

#### choice · `wc-choice`
- ❓ How can you check that Kamran is who he says he is?
  - ✅ Reverse image search his photo and ask for a video call — Right. These two checks are the simplest and most reliable.
  - ❌ Ask him for more photos — A scammer has plenty of stolen photos. A new photo proves nothing.
  - ❌ Ask for a photo of his passport — A document photo is easy to fake. It proves nothing.
  - ❌ Trust him, because he writes every day — Writing every day is the scammer's job. Sometimes he writes to several people at once.
- 💡 A video call and a reverse image search are the two simplest checks. If he avoids both, stop.

#### order · `wc-order`
- 🔢 Your online contact asks for money. Put the steps in order.
  1. Do not send money or crypto
  2. Reverse image search the photo
  3. Talk to your family or a friend
  4. Report and block the profile on the platform
- 💡 First stop the money, then check and talk. If money has already gone, contact your bank and the police at once.

#### recap · `wc-recap`
- ✔ Never send money or crypto to someone you have not met in person.
- ✔ Avoiding video calls, investment offers and requests for secrecy are warnings.
- ✔ Reverse image search the photo and talk to your family.

### Call from a hospital (`hospital-call`, 3 dəq)

#### tutor · `hc-tutor`
- 🗣 "This time the scammer calls and claims to be a doctor at a hospital abroad." — _talk/wave, visual: mask_
- 🗣 "She says your online friend has had an accident and urgently needs money for surgery." — _alert/point-left, visual: artifact_, highlight `number`
  - 🗂 **call** (brand `w2e-nordhaven-klinika`)
    - caller: Nordhaven Clinic
    - number: **+44 7700 900 418**⟨number⟩
    - label: International
- 🗣 "Urgency, fear and secrecy: when all three come together, you are facing a scam." — _think/lean-in, visual: alarm_
- 🗣 "End the call, find the number yourself and talk to your family before sending any money." — _happy/shield-up, visual: shield_

#### choice · `hc-choice`
- ❓ The caller says your friend is in hospital and money is needed today. What is your first step?
  - ✅ End the call and find the hospital's number myself — Right. Calling a number you found yourself exposes the fake doctor at once.
  - ❌ Send the money fast and ask later — Money you send does not come back. The urgency is created exactly for this.
  - ❌ Give my card details so they can take it — With your card details they can take as much as they like. Never give card details on the phone.
  - ❌ Promise to tell no one — Secrecy helps the scammer. Your family sees the situation with a cool head.
- 💡 An urgent demand for money on the phone, especially in crypto, is a sign of a scam. End the call and check it yourself.

#### simulation · `hc-sim` · A night call
- 🖥 mühit: `call` — At one in the morning a call comes from abroad. Read what the caller says and choose your answer.
  - **step `ring`**
    - 🗂 **call** (brand `w2e-nordhaven-klinika`)
      - caller: Nordhaven Clinic
      - number: +44 7700 900 418
      - label: International
      - voice: woman
    - ✅ [answer] Answer — Answering is not dangerous. What matters is what you say.
    - ✅ [decline] Decline — That works too. If you are worried, check the number yourself later. → `after`
  - **step `doctor`** — 🗣 "Doctor Helena Mart, Nordhaven Clinic, speaking. Kamran Aliyev had an accident and named you as his next of kin."
    - 🗂 **call** (brand `w2e-nordhaven-klinika`)
      - caller: Nordhaven Clinic
      - number: +44 7700 900 418
      - label: International
      - voice: woman
    - ✅ [verify] I want a video call with Kamran — A good check. A scammer will always find a reason why a video call is impossible.
    - ⚠️ [reply] What do you need? I will help — The shock is understandable, but this question opens the door to a money demand. Check first.
    - ✅ [hang-up] End call — A good decision. You can find the clinic's number yourself and call it. → `after`
  - **step `demand`** — 🗣 "He is unconscious. The surgery needs an advance of four thousand eight hundred manat today, his insurance does not cover it."
    - 🗂 **call** (brand `w2e-nordhaven-klinika`)
      - caller: Nordhaven Clinic
      - number: +44 7700 900 418
      - label: International
      - voice: woman
    - 💀 [share] I will send it, give me the details — The money went to the scammer. Always check an urgent money demand on the phone yourself.
    - 💀 [share] Let me give my card details — With your card details they can take as much as they like. Never say them on the phone.
    - ✅ [verify] I will find the clinic's number and call it — Right. A number you found yourself does not lead back to the scammer.
  - **step `push`** — 🗣 "There is no time! Crypto is fine too, I will text you the address. Do not tell anyone about this."
    - 🗂 **call** (brand `w2e-nordhaven-klinika`)
      - caller: Nordhaven Clinic
      - number: +44 7700 900 418
      - label: International
      - voice: woman
    - 💀 [share] I will pay in crypto — Nobody can reverse a crypto transfer. An urgent crypto demand on the phone is a sign of a scam.
    - ✅ [reply] I need to talk to my sister first — Well done. A scammer fears your family, because they see through the trick.
    - ✅ [hang-up] End call — Right. Crypto, pressure and secrecy together mean a scam.
  - **step `after`**
    - 🗂 **call** (brand `w2e-nordhaven-klinika`)
      - caller: Nordhaven Clinic
      - number: +44 7700 900 418
      - label: International
      - voice: woman
    - ⚠️ [call-back] Call this number back — This number belongs to the scammer, who will tell the same story. Find the number yourself.
    - ✅ [verify] Tell my family — Right. Talking to your family takes the pressure off at once.
    - ✅ [block] Block number — Good. Block the number and report the dating profile on the platform too.

#### swipe · `hc-swipe`
- 👉 Which message is normal and which is a warning?
  - ✅ safe `video-date`: Offering a video call and a meeting in a public place is normal. That is exactly what a scammer avoids.
    - 🗂 **chat**
      - app: generic
      - contact: Elchin
      - 💬 them: Shall we video call tonight at 8? Then we can meet at a cafe on Saturday.
  - 🛑 threat `visa`: Someone you have never met asking for ticket, visa or customs money is a classic scam.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Mark Leon
      - 💬 them: To come and see you I need money for the visa, 600 AZN. I will pay it back as soon as I arrive, I promise.
  - 🛑 threat `withdraw-fee`: A platform that wants a payment before you can withdraw is fake. The profit figure is made up.
    - 🗂 **notification** (brand `w2e-kriptonova`)
      - app: KriptoNova
      - title: Your profit: 2,340 AZN
      - body: Pay 15% tax first to withdraw your money.
      - time: 09:05
  - ✅ safe `report-done`: This is a normal platform notice and asks for nothing. Reporting a fake profile protects others.
    - 🗂 **notification** (brand `w2e-gorusek`)
      - app: Görüşək
      - title: Your report was reviewed
      - body: The profile you reported was fake and has been closed. Thank you.
      - time: 14:30
  - 🛑 threat `secret`: Someone who wants to cut you off from your family is hiding something. A request for secrecy is a warning.
    - 🗂 **chat**
      - app: generic
      - contact: Kamran Aliyev
      - 💬 them: Do not tell your family, they will not understand us. This is just our secret.

#### scenario · `hc-scenario` · Your sister asks
- 🎭 start: `sister`
  - **[sister]** Nigar (your sister) (in-person, 🔊woman-2): "You look worried. What happened, is someone bothering you?"
    - I tell her everything and show her the chat → `search` — Right. Talking about it takes power away from the scammer.
    - Nothing, Kamran asked me not to tell anyone ⇒ **risky** — Secrecy helps the scammer. Talking to someone close is the strongest protection.
  - **[search]** Nigar (your sister) (in-person, 🔊woman-2): "Let's reverse image search Kamran's photo together. Look, the photo turns up under another name, on a foreign model's page!"
    - I report and block the profile and never send money again ⇒ **safe** — Well done. You protected yourself and other people too.
    - Maybe someone stole his photo, I will keep chatting ⇒ **risky** — Fake profiles are built on stolen photos. Trust what the check showed.

#### recap · `hc-recap`
- ✔ If an urgent money demand comes by phone, end the call and find the number yourself.
- ✔ Crypto, pressure and secrecy together mean a scam.
- ✔ Talk to your family before sending money, and report the fake profile.


## Extortion emails (`extortion-emails`) · Email · Easy · 200 XP

### A bluff email (`bluff-letter`, 3 dəq)

#### tutor · `bl-tutor`
- 🗣 "Hello! Sometimes a frightening email arrives: I hacked your camera, pay or I will publish your private videos." — _talk/wave, visual: eye_
- 🗣 "The email even shows an old password of yours. It usually comes from a data leak years ago." — _alert/point-left, visual: artifact_, highlight `password`
  - 🗂 **email**
    - from: Anonymous <anonim.7781@mail-relay.example.net>
    - to: you@idare.example
    - subject: Your password: **Gunes2019**⟨password⟩. You have 48 hours
    - time: 08:47
    - body: I got into your device and recorded private videos with your camera.
- 🗣 "Emails like this go to thousands of people at once. There is no video from your camera." — _think/shrug, visual: inbox_
- 🗣 "The rule: do not pay or reply, change the password, and report work mail to security." — _happy/shield-up, visual: shield_

#### hotspot · `bl-hotspot`
- 🔍 Find the scammer's tricks in this email. (ən azı 3)
  - 🗂 **email**
    - from: Anonymous <anonim.7781@mail-relay.example.net>
    - to: you@idare.example
    - subject: Your password: **Gunes2019**⟨password⟩. You have 48 hours
    - time: 08:47
    - body: **I got into your device and recorded private videos with your camera.**⟨camera⟩ / As proof I am writing your password. If you do not want the videos published, send bitcoin worth 1,500 AZN to: / **bc1q000000000000000000000000000000demo**⟨btc⟩ / **You have 48 hours to pay. Do not show this email to anyone.**⟨timer⟩
  - ⟨password⟩ **Old password**: This password comes from an old data leak. It does not prove a hack, but change it everywhere you still use it.
  - ⟨camera⟩ **Camera claim**: This is a bluff. The same text goes to thousands of addresses and there is no video.
  - ⟨btc⟩ **Bitcoin address**: A crypto payment cannot be reversed. If you pay, a new demand will follow.
  - ⟨timer⟩ **48 hours**: The deadline is there to scare you and stop you thinking. Do not pay and do not reply.

#### match · `bl-match`
- 🔗 Match each claim in the email with the truth.
  - I hacked your camera ⇄ No proof, the text is sent in bulk
  - Here is your password ⇄ Taken from an old data leak
  - A photo of your house is attached ⇄ Address from a leak, photo from a public map
  - You have 48 hours ⇄ A fake deadline to scare you
- 💡 Everything the scammer knows is public or leaked data. It was put together to frighten you.

#### simulation · `bl-sim` · Your work mail
- 🖥 mühit: `inbox` — You open your work mailbox at the ministry. Choose the right move for each of the four emails.
  - **step `sextortion`**
    - 🗂 **email**
      - from: Anonymous <anonim.7781@mail-relay.example.net>
      - to: you@idare.example
      - subject: Your password: Gunes2019. You have 48 hours
      - time: 08:47
      - body: I got into your device and recorded private videos with your camera. / If you do not want the videos published, send bitcoin worth 1,500 AZN to: bc1q000000000000000000000000000000demo / You have 48 hours to pay.
    - ✅ [report] Report phishing — Right. The security team can remove the same email from other colleagues' mailboxes too.
    - ⚠️ [reply] Reply: show me proof — A reply shows that your address is active and brings more emails. Do not reply.
    - ✅ [delete] Delete — Deleting is fine. In work mail, though, reporting it first is better.
  - **step `house-photo`**
    - 🗂 **email**
      - from: The Watcher <watcher.0042@anon-post.example.net>
      - to: you@idare.example
      - subject: Do you see the photo of your house?
      - time: 09:05
      - body: This is your house. I know your address and your password. / Send 1,500 AZN in bitcoin, or the videos will be published.
      - attachments: {"name": [{"text": "ev_unvan.jpg"}], "size": "212 KB"}
    - ✅ [report] Report phishing — Right. The house photo comes from a public map, so this is a mass bluff too.
    - ⚠️ [open-attachment] Open photo — The photo is meant to scare you more. Do not open a suspicious attachment, report the email.
    - 💀 [reply] Reply: I will pay — Paying or promising to pay brings new demands. Do not pay and do not reply.
  - **step `security-notice`**
    - 🗂 **email** (brand `it-tehlukesizlik`)
      - from: IT Security <security@idare.example>
      - to: you@idare.example
      - subject: Warning: extortion emails
      - time: 09:20
      - body: Today some colleagues received extortion emails showing an old password. / Do not pay and do not reply. Send the email with the Report button. / If you still use that password, change it.
    - ✅ [mark-safe] Mark as safe — Right. This email asks for nothing, it only repeats the right rules.
    - ⚠️ [report] Report phishing — Caution is good, but this email comes from your organisation's own address and asks for nothing.
  - **step `fake-reset`**
    - 🗂 **email** (brand `it-tehlukesizlik-fake`)
      - from: IT Security <security@idare-support.example.net>
      - to: you@idare.example
      - subject: Your account is hacked: change your password now
      - time: 09:34
      - body: Received an extortion email? Your account is in danger. / Change your password here → `https://idare-support.example.net/parol` / If you do not change it within 30 minutes, the account will be locked.
    - ✅ [report] Report phishing — Well done. This is a second trap that feeds on fear, and the domain is not your organisation's.
    - 💀 [click-link] Open link — The fake page would have stolen your password. Change it only in the official system you open yourself.
    - ✅ [delete] Delete — Deleting is fine. If you report it, other colleagues are protected too.

#### choice · `bl-choice`
- ❓ An extortion email shows a map photo of your house and your address. What does it mean?
  - ✅ The address came from a leak, the photo from a public map — Right. Knowing your address does not mean your camera was hacked.
  - ❌ They really are watching, so I have to pay — Paying ends nothing, it brings a new demand. Report the email.
  - ❌ I should reply and ask who they are — A reply shows your address is active. The scammer will send more emails.
- 💡 The scammer combines public and leaked data to create fear. Do not pay or reply, and if you feel in danger, contact the police.

#### recap · `bl-recap`
- ✔ A mass email saying I hacked your camera is a bluff: do not pay, do not reply.
- ✔ If you still use the old password from the email, change it everywhere.
- ✔ In work mail, report such an email to the security team.

### A calm response (`calm-response`, 3 dəq)

#### tutor · `cr-tutor`
- 🗣 "An extortion email has arrived. Now let us practise the right steps in order." — _talk/wave, visual: inbox_
- 🗣 "The first two rules: do not pay and do not reply. A reply makes you a new target." — _alert/shake, visual: alarm_
- 🗣 "If you still use the password from the email, change it and turn on two-step verification." — _think/point-left, visual: artifact_, highlight `new`
  - 🗂 **dialog** (brand `ispoct`)
    - tone: system
    - title: Change password
    - body: Old password / **New password: at least 15 characters**⟨new⟩
    - buttons: Cancel, Change
- 🗣 "If it came to work mail, report it to the security team. You are not to blame." — _happy/recite, visual: shield_

#### order · `cr-order`
- 🔢 You received an extortion email. Put the steps in order.
  1. Do not pay and do not reply
  2. Report the email to the security team
  3. Change the password from the email everywhere
  4. Turn on two-step verification
- 💡 First stop, then report and change the password. Two-step verification protects the account even if an old password leaks.

#### simulation · `cr-sim` · Morning, work computer
- 🖥 mühit: `desktop` — An extortion email notification pops up on your work computer. Choose the right move at every step.
  - **step `toast`**
    - 🗂 **notification** (brand `ispoct`)
      - app: IshPocht
      - title: Your password: Gunes2019. You have 48 hours
      - body: I have videos recorded with your camera. Send bitcoin or everyone will see them.
      - time: 09:12
    - ✅ [report] Report — Right. Reporting without paying or replying is the best first step. → `password`
    - ⚠️ [reply] Reply: show me proof — You replied, and the scammer at once sent a file called proof.
    - 💀 [share] Copy the bitcoin address and pay — The money is gone and will not come back. People who pay usually get a new demand. → `password`
  - **step `proof`** · Downloads — 🗣 "A reply came: supposedly proof."
    - 🗂 **file**
      - name: Subut_video.zip
      - type: zip
      - size: 1.2 MB
      - source: Anonymous: reply email
    - 💀 [open-attachment] Open — This is not proof, it is malware. Never open files from an extortion email.
    - ✅ [delete] Delete — Right. Do not open the file, and report the email to the security team.
    - ✅ [scan] Scan with antivirus — A good habit, but there is no need to keep this file. Delete it and report.
  - **step `password`** — 🗣 "This password is still used on some of your accounts."
    - 🗂 **dialog** (brand `ispoct`)
      - tone: system
      - title: Change password
      - body: The password in the email was found in an old data leak. / New password: at least 15 characters, not used on other sites.
      - buttons: Later, Change password
    - ✅ [update] Change password — Well done. The leaked password no longer opens this account, so change it on your other accounts too.
    - ⚠️ [later] Later — Leaked passwords are tried again and again to open accounts. Do not put the change off.
  - **step `two-step`**
    - 🗂 **dialog** (brand `ispoct`)
      - tone: system
      - title: Two-step verification
      - body: Ask for the approval app on your phone at sign in, as well as the password?
      - buttons: Not now, Turn on
    - ✅ [update] Turn on — Right. Even if the password leaks, the second step protects the account.
    - ⚠️ [later] Not now — Without two-step verification one password opens everything. Turn it on today.
  - **step `second-threat`** — 🗣 "A day later a new threat arrived."
    - 🗂 **notification** (brand `ispoct`)
      - app: IshPocht
      - title: Last 24 hours!
      - body: No payment received. The videos go out tomorrow.
      - time: 08:30
    - ✅ [delete] Delete — Right. A repeated threat is a bluff too, so do not pay and do not reply.
    - ✅ [report] Report — Well done. The security team can block the new emails as well.
    - ⚠️ [reply] Reply: give me some time — Negotiating gives the scammer hope. Do not reply, and report it.

#### scenario · `cr-scenario` · A worried colleague
- 🎭 start: `panic`
  - **[panic]** Narmin (your colleague) shows her phone (in-person, 🔊woman): "Look, an extortion email came to my personal mail, and it shows my old password!"
    - Stay calm, it is a mass bluff. Do not pay and do not reply → `reuse` — Right. Calm, clear advice takes the panic down at once.
    - Maybe pay half so they leave you alone ⇒ **compromised** — People who pay get new demands. Money does not stop the threat.
    - Reply and ask for proof ⇒ **risky** — A reply shows the address is active and brings more emails.
  - **[reuse]** Narmin (your colleague) (in-person, 🔊woman): "I still use that password on several sites, what should I do?"
    - Change it everywhere, use a different password for each site and turn on two-step verification ⇒ **safe** — Well done. Separate passwords stop one leak from spreading to every account.
    - Change only this mailbox password, the rest does not matter ⇒ **risky** — The same password will be tried on other sites too. Change them all.

#### choice · `cr-choice`
- ❓ A teenage relative says someone is threatening to publish private videos of them and wants money. What should be done?
  - ✅ Never pay, go to the police — Right. Never pay, go to the police.
  - ❌ Pay once so it ends — Paying does not stop the threat. Never pay, go to the police.
  - ❌ Keep it secret and tell no one — Secrecy helps the person making threats. Never pay, go to the police.
- 💡 If a child or teenager is being threatened, never pay. Go to the police at once.

#### recap · `cr-recap`
- ✔ Do not pay, do not reply and do not open files from the email.
- ✔ Change the leaked password everywhere and turn on two-step verification.
- ✔ If a child is threatened, never pay and go to the police.


## Payroll diversion (`payroll-diversion`) · Workplace · Medium · 200 XP

### A new card number (`new-card-email`, 3 dəq)

#### tutor · `pd1-tutor`
- 🗣 "Hello! Today you work in human resources, and tomorrow is payday." — _talk/wave, visual: badge-id_
- 🗣 "An email arrives in an employee's name: my card changed, pay my salary into a new account." — _alert/point-left, visual: artifact_, highlight `new-account`
  - 🗂 **email**
    - from: Leyla Mammadova <leyla.mammadova.88@poct-mail.example.net>
    - subject: Urgent: my salary card changed
    - time: 16:40
    - body: Hello, I lost my old card and the bank closed it. / Please pay tomorrow's salary into this account: **AZ00SAHL00000000000000004417**⟨new-account⟩
- 🗣 "The name is familiar, but the address is a personal mailbox. A fraudster wants the salary in their own account." — _think/lean-in, visual: hook_
- 🗣 "The rule is simple: never change bank details because of an email. Call the employee on a number you already know." — _happy/recite, visual: shield_

#### hotspot · `pd1-hotspot`
- 🔍 Find the warning signs in this email. (ən azı 3)
  - 🗂 **email**
    - from: Leyla Mammadova <**leyla.mammadova.88@poct-mail.example.net**⟨personal-address⟩>
    - to: kadr@seherxidmetleri.example
    - subject: Urgent: my salary card changed
    - time: 16:40
    - body: Dear HR team, / I lost my old card and the bank closed it. / **Please pay tomorrow's salary into my new account: **⟨new-account⟩**AZ00SAHL00000000000000004417**⟨new-account⟩ / **I am not at work today and my phone is broken. Only reply here.**⟨no-call⟩ / **Please do it by tomorrow morning, I have to pay my rent.**⟨urgency⟩ / Leyla Mammadova, Utilities Department
  - ⟨personal-address⟩ **Personal email address**: Employees usually write from their work address. Anyone can open a personal mailbox under any name.
  - ⟨new-account⟩ **New account**: This is the real goal of the email. Once the salary lands there, getting it back is hard.
  - ⟨no-call⟩ **No way to call**: This line is there to stop you checking. That is exactly why you call the employee on a number you know.
  - ⟨urgency⟩ **Pressure**: Pressure right before payday is a normal part of this scam. A call takes only a few minutes.

#### simulation · `pd1-sim` · HR mailbox
- 🖥 mühit: `inbox` — It is the day before payday. Open the five emails and choose the right step for each one.
  - **step `fake-colleague`** — 🗣 "Look at the sender's domain."
    - 🗂 **email** (brand `w2f-seher-xidmetleri`)
      - from: Kamran Aliyev <k.aliyev@seherxidmetleri-mail.example.net>
      - to: kadr@seherxidmetleri.example
      - subject: Updating my salary account
      - time: 09:12
      - body: Hello, I have switched banks. / Please pay the September salary into this account: AZ00ULDZ00000000000000007731 / I will bring the form later. Kamran Aliyev, Transport Unit
    - ✅ [report] Report phishing — Correct. The domain is not your office's domain, it has an extra word added.
    - ✅ [verify] Call Kamran on a number I know — Well done. Kamran will say he never wrote it, and you will report the email.
    - 💀 [reply] Reply: account updated — The salary would go to the fraudster. Never accept a bank detail change by email.
  - **step `system-request`**
    - 🗂 **email** (brand `w2f-kadr-kabineti`)
      - from: Kadr Kabineti <noreply@kabinet.seherxidmetleri.example>
      - to: kadr@seherxidmetleri.example
      - subject: New request: bank detail change, Ayten Huseynova
      - time: 10:05
      - body: The employee sent this request in Kadr Kabineti, signed in with two-step verification. / Review the request in the system: View request → `https://kabinet.seherxidmetleri.example/sorgular/2187`
    - ✅ [click-link] View request — Correct. The address is your office's own domain and the request came from inside the system.
    - ✅ [mark-safe] Mark as safe — Right. A request from the official system is the proper channel.
    - ⚠️ [report] Report phishing — Caution is good, but this is your office's own system. Bank detail changes should arrive exactly this way.
  - **step `portal-phish`**
    - 🗂 **email** (brand `w2f-kadr-kabineti-fake`)
      - from: Kadr Kabineti <kabinet@kadr-kabineti.example.net>
      - to: kadr@seherxidmetleri.example
      - subject: Your password expires today
      - time: 11:30
      - body: Your access to the payroll sheet will be closed today. / To keep access: Renew password → `https://kadr-kabineti-giris.example.net/yenile`
    - ✅ [report] Report phishing — The link does not go to your office's domain. If there is no report button, forward the email to the security team.
    - 💀 [click-link] Renew password — This is a fake portal. With an HR account, a fraudster can change everyone's bank details.
    - ✅ [delete] Delete — Not bad. But if you report it, your colleagues are protected too.
  - **step `payroll-sheet`**
    - 🗂 **email** (brand `w2f-seher-xidmetleri`)
      - from: Sabina Gasimova <s.qasimova@seherxidmetleri.example>
      - to: kadr@seherxidmetleri.example
      - subject: September payroll: final check
      - time: 12:15
      - body: Hello, the sheet is attached. Please review it by 15:00. Sabina, Finance
      - attachments: {"name": [{"text": "Maas_cedveli_2026_09.xlsx"}], "size": "96 KB"}
    - ✅ [open-attachment] Open attachment — Correct. A known colleague, your office's domain and an expected sheet.
    - ⚠️ [forward] Send to my personal email — The sheet holds everyone's personal data. Do not send work files to a personal mailbox.
    - ✅ [mark-safe] Mark as safe — Right. There is no new account and no pressure here.
  - **step `real-address-odd`** — 🗣 "The address is real. Stay alert anyway."
    - 🗂 **email** (brand `w2f-seher-xidmetleri`)
      - from: Narmin Safarova <n.seferova@seherxidmetleri.example>
      - to: kadr@seherxidmetleri.example
      - subject: New account
      - time: 14:48
      - body: Pay my salary into this account: AZ00SAHL00000000000000009260 / Do not call, I am in meetings all day.
    - ✅ [verify] Call her internal number — Correct. A mailbox can be taken over, but the real Narmin answers the number you know.
    - ⚠️ [reply] Reply: is this real? — If the mailbox is taken over, the fraudster writes the reply. Only a call is a real check.
    - 💀 [mark-safe] Mark as safe — The address is real, but the account may be taken over. Always confirm bank detail changes by phone.

#### match · `pd1-match`
- 🔗 Match each request with the right way to check it.
  - New bank account in an email ⇄ Call the employee on a number you know
  - Request in Kadr Kabineti ⇄ Review it in the system, call if in doubt
  - Password renewal link ⇄ Type the portal address yourself
  - Employee calls to change the account ⇄ Ask them to send it through Kadr Kabineti
- 💡 Every change is confirmed inside the system or through a channel you choose. A number or link in the email is not a check.

#### scenario · `pd1-scenario` · The salary did not arrive
- 🎭 start: `n1`
  - **[n1]** Leyla Mammadova (phone, 🔊young-woman): "Hello, my salary did not reach my card today. I never asked to change my account!"
    - Accounting calls the bank, and I report it to the security team → `n2` — Correct. The sooner you report it, the better the chance of getting the money back.
    - I quietly switch the account back ⇒ **risky** — The mistake must be fixed, but not hidden. The bank can try to stop the transfer, and the security team traces what happened.
    - I tell her she wrote the email herself ⇒ **risky** — Leyla did not write that email. What matters is stopping the damage, not finding someone to blame.
  - **[n2]** Fidan Rzayeva, security team (phone, 🔊woman): "Do not delete the email, forward it to me. Were there any other bank detail changes this week?"
    - I forward the email and check every change made this week ⇒ **safe** — Well done. Fraudsters usually write in the names of several employees.
    - I already deleted it, it is not needed ⇒ **risky** — The email is evidence. If you deleted it, restore it from deleted items and forward it.

#### recap · `pd1-recap`
- ✔ Bank details never change by email.
- ✔ Call the employee on a number you know.
- ✔ If in doubt, hold the payment and report it.

### Fake salary portal (`fake-salary-portal`, 3 dəq)

#### tutor · `pd2-tutor`
- 🗣 "Now you are a regular employee, and you want to see your payslip." — _talk/wave, visual: browser_
- 🗣 "The top search result is often an ad. Fraudsters place fake portals there as ads." — _alert/point-left, visual: artifact_, highlight `ad-domain`
  - 🗂 **url** (brand `w2f-kadr-kabineti-fake`)
    - url: https://**kadr-kabineti-giris.example.net**⟨ad-domain⟩/giris
- 🗣 "The fake page looks just like the real one. Type your password, and your account and then your salary account can change." — _think/shrug, visual: artifact_
  - 🗂 **login** (brand `w2f-kadr-kabineti-fake`)
    - brand: Kadr Kabineti
    - url: https://kadr-kabineti-giris.example.net/giris
    - fields: Work email, Password
    - button: Sign in
- 🗣 "Type the portal address yourself or open it from a bookmark. And keep two-step verification on." — _happy/recite, visual: mfa-phone_

#### choice · `pd2-choice`
- ❓ You searched for "kadr kabineti". How do you get in?
  - ❌ Ad: Kadr Kabineti, official sign-in (kadr-kabineti-giris.example.net) — Ad space is bought, so a fake site can sit at the very top. This domain is not your office's domain.
  - ❌ kadr-kabineti.example.org: payslip — The name looks similar, but the domain is not your office's. A look-alike name is the most common trick.
  - ✅ I type it myself: kabinet.seherxidmetleri.example — Correct. An address you type or saved as a bookmark does not depend on ads.
- 💡 Fraudsters use search ads to push fake portals to the top. Check the portal address once and save it as a bookmark.

#### simulation · `pd2-sim` · Payslip
- 🖥 mühit: `browser` — You opened the browser to see your payslip. Watch the address bar and make the right call at every step.
  - **step `search`** · Ad: Kadr Kabineti, official payslip sign-in
    - 🗂 **url** (brand `w2f-tapinti`)
      - url: https://axtar.example/?q=kadr+kabineti (əslində: `axtar.example`)
    - ⚠️ [click-link] Open the ad result — This ad leads to a fake portal. Your office's domain is not in the address bar. → `fake-login`
    - ✅ [open] Open Kadr Kabineti from bookmarks — Correct. A bookmark always takes you to the real address. → `real-login`
  - **step `fake-login`** — 🗣 "Look at the address bar."
    - 🗂 **login** (brand `w2f-kadr-kabineti-fake`)
      - brand: Kadr Kabineti
      - url: https://kadr-kabineti-giris.example.net/giris (əslində: `kadr-kabineti-giris.example.net`)
      - fields: Work email, Password
      - button: Sign in
    - 💀 [enter-credentials] Sign in — Your password went to the fraudster. Change it on the real portal right away and call human resources.
    - ✅ [cancel] Close tab — Right, the domain is not your office's. Open the portal from your bookmarks. → `real-login`
  - **step `fake-code`** — 🗣 "Now the site asks for the code sent to your phone."
    - 🗂 **login** (brand `w2f-kadr-kabineti-fake`)
      - brand: Kadr Kabineti
      - url: https://kadr-kabineti-giris.example.net/tesdiq (əslində: `kadr-kabineti-giris.example.net`)
      - fields: SMS code
      - button: Confirm
    - 💀 [enter-credentials] Confirm — With the code, the fraudster gets fully into your account. Only type a code on the real site, when you are the one signing in.
    - ✅ [cancel] Close tab — Good thing you stopped. Now change your password on the real portal and tell human resources.
  - **step `real-login`** — 🗣 "This is your office's own address."
    - 🗂 **login** (brand `w2f-kadr-kabineti`)
      - brand: Kadr Kabineti
      - url: https://kabinet.seherxidmetleri.example/giris (əslində: `seherxidmetleri.example`)
      - fields: Work email, Password
      - button: Sign in
    - ✅ [enter-credentials] Sign in — Correct. The domain belongs to your office and you opened the page yourself.
    - ⚠️ [cancel] Close tab — This is the real portal. Once you have checked the address, signing in is safe.
  - **step `mfa-offer`**
    - 🗂 **dialog** (brand `w2f-kadr-kabineti`)
      - tone: app
      - title: Two-step verification is off
      - body: Turn it on now to protect your account. Your phone will confirm every sign-in.
      - buttons: Turn on, Later
    - ✅ [allow] Turn on — Well done. Even if your password is stolen, the second step blocks a stranger.
    - ⚠️ [later] Later — Without two-step verification, one password opens everything. Turn it on today.
  - **step `bank-details`** · Your bank details: last changed 14.03.2025 by human resources
    - 🗂 **url** (brand `w2f-kadr-kabineti`)
      - url: https://kabinet.seherxidmetleri.example/rekvizitler (əslində: `seherxidmetleri.example`)
    - ✅ [open] Check the account — Good habit. If you see a change you did not make, call human resources right away.
    - ⚠️ [ignore] Leave without looking — If a stranger changed it, you would only find out on payday. A quick look takes seconds.

#### swipe · `pd2-swipe`
- 👉 Safe or scam?
  - 🛑 threat `boss-gift-cards`: A gift card code is like cash and never comes back. Call your manager on a number you know to check.
    - 🗂 **chat**
      - app: telegram
      - contact: Sabina Aliyeva, manager
      - 💬 them: I am in a meeting and cannot call. Quickly buy five 100 manat BonusMarket cards and send me the codes here. I will pay you back.
  - ✅ safe `salary-sms`: There is no link and it asks for nothing. This is a normal information message.
    - 🗂 **sms** (brand `sahilbank`)
      - sender: SahilBank
      - time: 09:00
      - 💬 Salary of 1,240.00 AZN credited to your card. Balance: 1,386.50 AZN.
  - 🛑 threat `fake-hr-sms`: Human resources never restores a salary through a text message link. Open the portal yourself or call the team.
    - 🗂 **sms** (brand `w2f-kadr-kabineti-fake`)
      - sender: KadrKabinet
      - time: 08:41
      - 💬 Your salary is on hold. Update your bank details: kadr-kabinet.example.info/yenile → `https://kadr-kabinet.example.info/yenile`
  - ✅ safe `payslip-ready`: This notification has no link and points you to the portal you know. Open it from your bookmarks.
    - 🗂 **notification** (brand `w2f-kadr-kabineti`)
      - app: Kadr Kabineti
      - title: September payslip is ready
      - body: See the Salary section in the portal.
      - time: 10:15
  - 🛑 threat `colleague-code`: A sign-in code is for you alone. Whoever gets your code gets into your account.
    - 🗂 **chat**
      - app: whatsapp
      - contact: Gunel, accounting
      - 💬 them: You will get a code from Kadr Kabineti, tell it to me so I can fix the payroll sheet.

#### order · `pd2-order`
- 🔢 You typed your password on a fake portal. Put the steps in order.
  1. Change the password on the real portal now
  2. Call human resources and the security team
  3. Check bank details and recent sign-ins together
  4. Turn on two-step verification
- 💡 First change the password, then call so any bank detail change is stopped. If you also typed a code, be sure to say so.

#### recap · `pd2-recap`
- ✔ Open the portal from a bookmark, not from search.
- ✔ Keep two-step verification on.
- ✔ Check gift card and code requests by phone.


## Smart devices and cameras (`smart-cameras-iot`) · Devices · Easy · 200 XP

### The camera panel (`camera-panel`, 3 dəq)

#### tutor · `sc1-tutor`
- 🗣 "Hello! Cameras are handy at home and at work. But if the password was never changed, a stranger can watch too." — _talk/wave, visual: eye_
- 🗣 "Most new cameras ship with a default password. Lists of these passwords are open to anyone online." — _alert/point-left, visual: artifact_, highlight `default-pass`
  - 🗂 **dialog** (brand `w2f-baxiskam`)
    - tone: system
    - title: BaxışKam: first sign-in
    - body: Username: admin / **Password: admin**⟨default-pass⟩
    - buttons: Sign in
- 🗣 "In 2025, unauthorised access to home and office cameras was found in Azerbaijan, with footage uploaded to foreign sites." — _think/lean-in, visual: stat 2025 (Unauthorised access to home and office cameras found)_
- 🗣 "Three steps are enough: change the password, update the firmware, and close open access from the internet." — _happy/shield-up, visual: shield_

#### password · `sc1-password`
- 🔑 Create a new password for the camera panel. (hədəf güc: 4/4)
  - Do not type your real password here, this is practice.
  - Pick a phrase of four random words.
  - Do not reuse your Wi-Fi or email password.
  - Keep the password in a password manager.

#### simulation · `sc1-sim` · Setting up the camera
- 🖥 mühit: `browser` — You are setting up a new camera. Look at every window in the panel and choose the right button.
  - **step `first-login`** — 🗣 "You are signing in to the camera panel for the first time."
    - 🗂 **login** (brand `w2f-baxiskam`)
      - brand: BaxışKam
      - url: http://192.168.1.64/login
      - fields: Username, Password
      - button: Sign in
    - ✅ [enter-credentials] Sign in — Correct, this is the camera's own address on your home network. Change the password right after the first sign-in.
    - ⚠️ [cancel] Close tab — Without signing in, you cannot change the default password. The camera stays open to everyone.
  - **step `change-default`**
    - 🗂 **dialog** (brand `w2f-baxiskam`)
      - tone: app
      - title: Default password in use
      - body: Change the password now for your security.
      - buttons: Change password, Remind me later
    - ✅ [update] Change password — Well done. Changing the default password is the single most important step for a camera.
    - 💀 [later] Remind me later — Getting in with a default password takes no skill at all. Automated tools search for such cameras all the time.
  - **step `firmware`**
    - 🗂 **dialog** (brand `w2f-baxiskam`)
      - tone: app
      - title: New firmware: 5.2.8
      - body: Security holes have been fixed. The update takes about three minutes.
      - buttons: Update, Later
    - ✅ [update] Update — Correct. Attackers know the holes in old firmware very well.
    - ⚠️ [later] Later — Without the update, known holes stay open. Update it today.
  - **step `remote-access`** — 🗣 "Now the camera offers direct access from the internet."
    - 🗂 **dialog** (brand `w2f-baxiskam`)
      - tone: app
      - title: Remote access
      - body: Turn on UPnP and port forwarding to watch the camera directly from the internet?
      - buttons: Keep on, Turn off
    - ⚠️ [allow] Keep on — With an open port, the camera is visible to the whole internet. Attackers find such open devices easily with special search tools.
    - ✅ [deny] Turn off — Right. If you need to watch remotely, use the maker's official app instead of opening a port.
  - **step `public-link`** · Create a public link for the live stream? Anyone with the link will be able to watch.
    - 🗂 **url** (brand `w2f-baxiskam`)
      - url: http://192.168.1.64/paylas
    - 💀 [share] Create link — Once the link spreads, you will never know who is watching. Add family members in the app with their own accounts.
    - ✅ [keep-private] Do not create a public link — Correct. Only people close to you, signed in with their own accounts, should see the picture.

#### hotspot · `sc1-hotspot`
- 🔍 Find the risky settings in the video recorder's status window. (ən azı 3)
  - 🗂 **dialog** (brand `w2f-baxiskam`)
    - tone: system
    - title: District office entrance: video recorder
    - body: Model: BX-DVR 8 / **User: admin, password: default**⟨default⟩ / **Firmware: 2019, no updates**⟨old-firmware⟩ / **Port forwarding: on, 8000**⟨open-port⟩ / **Camera 3: HR room, facing computer screens**⟨screens⟩ / Date and time: correct
    - buttons: Close
  - ⟨default⟩ **Default password**: Attackers take default passwords from ready-made lists. Changing it is the first job.
  - ⟨old-firmware⟩ **Old firmware**: A device left without updates for seven years has known holes. If no updates come out, the device must be replaced.
  - ⟨open-port⟩ **Open port**: An open port shows the recorder to the whole internet. If it is not needed, close it.
  - ⟨screens⟩ **Camera facing screens**: This camera films work screens and documents. If the footage is stolen, confidential data goes with it.

#### choice · `sc1-choice`
- ❓ A colleague brought a Wi-Fi camera from home and wants to connect it at work. What do you say?
  - ✅ Technical support must approve it and connect it — Correct. Only approved devices go on the work network.
  - ❌ Fine, if they change the password — The password matters, but an unchecked device can open a door into the work network. Technical support decides.
  - ❌ Put it on guest Wi-Fi, nobody will know — A device connected without telling anyone is a risk for the office. Every camera goes through technical support.
- 💡 At work, only technical support connects cameras and smart devices. A forgotten device stays without updates for years.

#### recap · `sc1-recap`
- ✔ Change the default password on day one.
- ✔ Update the firmware, close open ports.
- ✔ At work, approved devices only.

### Home network (`home-network`, 3 dəq)

#### tutor · `sc2-tutor`
- 🗣 "At home, the router, the TV and the baby camera share one network. If one is weak, all are at risk." — _talk/wave, visual: wifi_
- 🗣 "If you get a notification like this, someone is watching your camera without your knowledge." — _alert/point-left, visual: artifact_, highlight `unknown-device`
  - 🗂 **notification** (brand `w2f-korpe-gozu`)
    - app: Körpə Gözü
    - title: Live view from a new device
    - body: **Unknown device, from abroad**⟨unknown-device⟩
    - time: 01:07
- 🗣 "A camera in a child's room films the most private moments. Give it the strongest protection." — _think/lean-in, visual: eye_
- 🗣 "Let us look at the settings together: which are safe, and which create a risk?" — _happy/shield-up, visual: lock_

#### swipe · `sc2-swipe`
- 👉 Is this setting safe or a threat?
  - 🛑 threat `upnp-on`: This feature lets devices open doors on their own. If you do not need it, turn it off.
    - 🗂 **dialog** (brand `w2f-evsebeke`)
      - tone: system
      - title: Router: UPnP
      - body: On. Devices can open ports by themselves.
      - buttons: Save
  - ✅ safe `guest-network`: Correct. Even if a weak device is hacked, it cannot reach your phone or computer.
    - 🗂 **dialog** (brand `w2f-evsebeke`)
      - tone: system
      - title: Guest network: Home-Devices
      - body: Camera, TV and robot vacuum are here. Phones and laptops stay on the main network.
      - buttons: Save
  - 🛑 threat `router-default`: The router is the front door of your whole home. Replace the default password with a long passphrase.
    - 🗂 **dialog** (brand `w2f-evsebeke`)
      - tone: system
      - title: Router panel
      - body: User: admin. Password: the default one printed under the box.
      - buttons: Save
  - ✅ safe `auto-update`: Automatic updates close known holes on their own. Keep this setting on.
    - 🗂 **notification** (brand `w2f-baxiskam`)
      - app: BaxışKam
      - title: Firmware updated automatically
      - body: Version 5.2.8 installed.
      - time: 03:00
  - 🛑 threat `port-forward`: This rule opens the camera to the whole internet. Delete it and watch remotely only through the official app.
    - 🗂 **dialog** (brand `w2f-evsebeke`)
      - tone: system
      - title: Port forwarding
      - body: Port 554: camera, open to everyone on the internet
      - buttons: Save
  - ✅ safe `wifi-security`: Modern encryption and a long passphrase keep outsiders off your home network.
    - 🗂 **dialog** (brand `w2f-evsebeke`)
      - tone: system
      - title: Wi-Fi security
      - body: WPA3, long passphrase
      - buttons: Save

#### simulation · `sc2-sim` · A night notification
- 🖥 mühit: `phone` — It is one in the morning. A baby camera notification arrives. Make the right call at every step.
  - **step `night-alert`**
    - 🗂 **notification** (brand `w2f-korpe-gozu`)
      - app: Körpə Gözü
      - title: Live view from a new device
      - body: Unknown device, from abroad, 01:07
      - time: 01:07
    - ✅ [open] Open notification — Correct. First see what is happening in your own app.
    - ⚠️ [ignore] Leave it till morning — Someone is watching the child's room right now. This cannot wait.
  - **step `sessions`** — 🗣 "Two devices are connected to the camera."
    - 🗂 **dialog** (brand `w2f-korpe-gozu`)
      - tone: app
      - title: Active devices: 2
      - body: Your phone, Baku / Unknown device, from abroad, 01:07
      - buttons: Sign out all, Close
    - ✅ [disconnect] Sign out all and change password — Well done. The stranger's device is out, and the new password keeps it out.
    - 💀 [cancel] Close — The stranger's device stays connected and keeps watching. Sign out every device right away.
  - **step `group-tip`** — 🗣 "In the morning, the parents' group shares some advice."
    - 🗂 **chat**
      - app: telegram
      - contact: Parents group
      - 💬 them: Our camera was hacked too. This app protects it, download it: korpe-qoruyucu.example.info/qoru.apk → `https://korpe-qoruyucu.example.info/qoru.apk`
    - ⚠️ [click-link] Open link — An app from an unknown source can take over your phone, not protect your camera. Install apps only from the official store. → `apk`
    - ✅ [ignore] Do not tap the link — Right. A link that looks like help can be a new trap. → `update-offer`
  - **step `apk`**
    - 🗂 **file**
      - name: KorpeQoruyucu.apk
      - type: apk
      - size: 8.4 MB
      - source: korpe-qoruyucu.example.info
    - 💀 [install] Install — This app would ask for wide permissions and could steal your data. Do not install it.
    - ✅ [cancel] Cancel — Good call. A camera is protected by a password, updates and two-step sign-in, not by an extra app.
  - **step `update-offer`**
    - 🗂 **notification** (brand `w2f-korpe-gozu`)
      - app: Körpə Gözü
      - title: Update and two-step sign-in
      - body: Update the camera and turn on two-step sign-in for the account.
      - time: 08:35
    - ✅ [update] Update and turn on — Correct. The update closes the hole, and two-step sign-in makes a stolen password useless.
    - ⚠️ [later] Later — The camera still runs with the old hole. Update it today.

#### scenario · `sc2-scenario` · A voice from the camera
- 🎭 start: `n1`
  - **[n1]**  (, 🔊-): "In the evening, a strange voice comes from the baby camera's speaker. Someone is talking to the child."
    - I unplug the camera → `n2` — Correct. First cut the picture and sound, then lock the access.
    - I answer and ask who it is ⇒ **risky** — Talking only costs time while the camera keeps running. Switch it off first.
    - I must have imagined it ⇒ **compromised** — The stranger can still see and hear. Switch the camera off right away.
  - **[n2]**  (, 🔊-): "The camera is off. What now?"
    - I change the password, update, turn on two-step sign-in and report it to the police ⇒ **safe** — Well done. Access is fully closed, and the police investigate cases like this.
    - I buy a new camera and set the old password ⇒ **risky** — The old password will open the new camera too. Give every device its own strong password.

#### choice · `sc2-choice`
- ❓ You bought a new smart TV. Which steps are needed?
  - ✅ Connect it to the guest network — Correct. Even if the TV is hacked, it cannot reach your phone or computer.
  - ✅ Turn on automatic updates — Correct. Updates close known holes on their own.
  - ❌ Keep the default account password — A default password is known to everyone. Change it right away.
  - ❌ Allow every microphone and contacts request — A permission you do not need is extra risk. Allow only the features you use.
- 💡 A smart device belongs on a separate network, updated and with its own password. Turn off permissions you do not need.

#### recap · `sc2-recap`
- ✔ Put devices on a separate guest network.
- ✔ Turn off UPnP and port forwarding.
- ✔ Strange access? Sign out all devices, change the password.


## Backup and recovery (`backups-recovery`) · Data · Easy · 200 XP

### Which copy survived? (`which-copy-survived`, 3 dəq)

#### tutor · `br1-tutor`
- 🗣 "Hello! The archive department keeps ten years of documents. Today you learn how to keep their copies the right way." — _talk/wave, visual: folder_
- 🗣 "Ransomware encrypts more than the computer. It also locks the flash drive plugged into it and the network folder." — _alert/point-left, visual: artifact_, highlight `connected`
  - 🗂 **dialog**
    - tone: warning
    - title: Your files are encrypted
    - body: The Documents folder is locked. / **Connected drives and the network folder are locked too.**⟨connected⟩
    - buttons: Pay
- 🗣 "The rule: three copies, two kinds of media, one somewhere else. At least one must be fully off the network." — _think/lean-in, visual: stat 3-2-1 (3 copies, 2 kinds of media, 1 copy off-site)_
- 🗣 "And remember: an untested copy can turn out empty when you need it. Test a restore from time to time." — _happy/shield-up, visual: shield_

#### choice · `br1-choice`
- ❓ A ransom note is on the screen. Which copy most likely survived?
  - ❌ The flash drive left plugged into the computer — A connected drive is like part of the computer. Ransomware encrypts it too.
  - ❌ The cloud folder that syncs automatically — Syncing copies the encrypted files to the cloud too. Older versions sometimes remain, but you cannot count on it.
  - ❌ The department's network folder — If the computer can reach the network folder, so can the ransomware.
  - ✅ The disk unplugged on Friday and locked in the safe — Correct. A disk cut off from the computer and the network stays out of reach during an attack.
- 💡 The copy that survives an attack is the one off the network. That is why one copy is always unplugged and kept apart.

#### simulation · `br1-sim` · Archive department
- 🖥 mühit: `desktop` — You work in the archive department. From Friday evening to Monday, make the right call in every window.
  - **step `backup-done`** · Friday, 17:40 — 🗣 "The weekly backup is ready."
    - 🗂 **dialog** (brand `w2f-ehtiyat-komekcisi`)
      - tone: system
      - title: Weekly backup is ready
      - body: ARXIV-DISK: ten years of documents, 212 GB. You can remove the disk now.
      - buttons: Eject disk, Keep connected
    - ✅ [eject] Eject disk — Correct. An ejected disk cannot be encrypted in the next attack.
    - ⚠️ [later] Keep connected — A connected disk can be encrypted along with the computer. Eject it as soon as the backup ends.
  - **step `restore-test`**
    - 🗂 **dialog** (brand `w2f-ehtiyat-komekcisi`)
      - tone: app
      - title: Restore check
      - body: Restore one folder from the latest copy as a test?
      - buttons: Test restore, Skip
    - ✅ [verify] Test restore — Well done. Only a copy that opens is a real copy.
    - ⚠️ [later] Skip — The copy may be broken, and you would find out at the worst moment. Test restores regularly.
  - **step `personal-cloud`**
    - 🗂 **dialog** (brand `buludxidmet`)
      - tone: app
      - title: Upload the folder to your personal account?
      - body: Arxiv_2016_2026: 212 GB. Account: sevda.k@poct-mail.example.net
      - buttons: Upload, Decline
    - ⚠️ [share] Upload — Work documents belong only where your office has approved. A personal cloud does not protect the copy and can leak the data.
    - ✅ [cancel] Decline — Correct. If an extra copy is needed, technical support creates it in an approved place.
  - **step `ransom-monday`** · Monday, 09:05 — 🗣 "On Monday morning, this message is on the screen."
    - 🗂 **dialog**
      - tone: warning
      - title: Your files are encrypted
      - body: The network folder and connected drives are locked. Pay within 72 hours for the key.
      - buttons: Pay, Close
    - ✅ [disconnect] Unplug cable, turn off Wi-Fi — Correct. Cut it off from the network without shutting it down, and call technical support right away.
    - 💀 [click-link] Pay — Paying does not guarantee the files come back. Recovery will come from the copy you kept apart.
  - **step `sync-alert`**
    - 🗂 **notification** (brand `buludxidmet`)
      - app: BuludXidmət
      - title: 1,240 files changed
      - body: The department folder was synced to the cloud.
      - time: 09:07
    - ✅ [report] Tell technical support — Correct, syncing copied the encrypted files too. A specialist will restore the older versions.
    - ⚠️ [open] Restore from the cloud myself — Files restored onto an infected computer can be encrypted again. Specialists restore on a clean computer.
  - **step `offline-disk`**
    - 🗂 **notification** (brand `it-tehlukesizlik`)
      - app: IT Security
      - title: Bring the disk from the safe
      - body: Do not plug ARXIV-DISK in anywhere. We will restore together on a clean computer.
      - time: 10:30
    - ✅ [verify] I hand the disk to the specialist — Well done. The restore will happen on a cleaned computer, under a specialist's control.
    - 💀 [plug-in] I plug the disk into this computer myself — The last copy can get encrypted on an infected computer. Give the disk only to the specialist.

#### match · `br1-match`
- 🔗 Match each part of the rule with its meaning.
  - 3 copies ⇄ The original file and two backups
  - 2 kinds of media ⇄ For example, an external disk and an approved cloud
  - 1 copy off-site ⇄ In another building and off the network
  - Restore test ⇄ Checking regularly that the copy opens
- 💡 With three copies, two media and one copy off-site, if one is lost another remains. A restore test proves the copy works.

#### choice · `br1-work-files`
- ❓ Where do you keep important work documents?
  - ✅ In my office's approved folder — Correct. Technical support makes and checks the copies there.
  - ❌ On the desktop, and I copy them to my own flash drive in the evening — A personal flash drive can get lost or infected. Nobody checks a copy like that.
  - ❌ In my personal cloud account, it is handy — In a personal account, a work document leaves your office's control. That is also a data leak.
- 💡 Technical support protects and restores the copy of a file kept in an approved place. A work file kept elsewhere is neither protected nor restored.

#### recap · `br1-recap`
- ✔ Three copies, two media, one off-site.
- ✔ Keep at least one copy off the network.
- ✔ Test restores regularly.

### Phone backup (`phone-backup`, 3 dəq)

#### tutor · `br2-tutor`
- 🗣 "When a phone is lost, the biggest loss is often family photos. Protecting them takes a few minutes." — _talk/wave, visual: phone-lock_
- 🗣 "If you have seen a notification like this, the photos from recent months have no copy." — _alert/point-left, visual: artifact_, highlight `days`
  - 🗂 **notification** (brand `w2f-telefon-ayarlari`)
    - app: Settings
    - title: Backup is off
    - body: **Last backup: 143 days ago**⟨days⟩
    - time: 21:10
- 🗣 "But careful: a message saying your storage is full and photos will be deleted is a favourite scam." — _think/shake, visual: artifact_
  - 🗂 **sms** (brand `buludxidmet-fake`)
    - sender: BuludXidmet
    - time: 10:02
    - 💬 Your storage is full. Your photos will be deleted in 24 hours.
- 🗣 "Turn on backup in the phone's own settings, then restore one photo to check it works." — _happy/recite, visual: cloud_

#### order · `br2-order`
- 🔢 Set up a backup on your phone. Put the steps in order.
  1. Turn on automatic backup in Settings
  2. Connect to Wi-Fi and a charger, wait for the first backup
  3. Check that the last backup date is today
  4. Open one photo on another device to test the restore
- 💡 A backup only helps when it works, so check the date and restore one photo. Protect the cloud account with two-step verification too.

#### hotspot · `br2-hotspot`
- 🔍 Find the signs of a scam in this message. (ən azı 3)
  - 🗂 **sms** (brand `buludxidmet-fake`)
    - sender: BuludXidmet
    - time: 10:02
    - 💬 **Your storage is 100% full.**⟨full⟩
    - 💬 **All your photos will be deleted within 24 hours.**⟨deadline⟩
    - 💬 **Upgrade your plan for just 1.99 AZN: **⟨small-fee⟩**buludxidmet-plan.example.info**⟨link⟩
  - ⟨full⟩ **Storage full**: When storage is full, new backups stop, but old photos are not deleted at once. Check storage yourself in the phone's settings.
  - ⟨deadline⟩ **Deadline**: Fear and a deadline push you to pay without thinking.
  - ⟨small-fee⟩ **Small amount**: A small amount lowers your guard. The real goal is your card details.
  - ⟨link⟩ **Strange domain**: This is not the cloud service's domain. Change your plan only in the phone's settings.

#### simulation · `br2-sim` · Where are your photos?
- 🖥 mühit: `phone` — There are a few notifications on your phone. For each one, choose the step that protects your photos.
  - **step `backup-off`**
    - 🗂 **notification** (brand `w2f-telefon-ayarlari`)
      - app: Settings
      - title: Backup is off
      - body: Last backup: 143 days ago. Turn it on now?
      - time: 21:10
    - ✅ [open] Turn on backup — Correct. From now on, photos are copied automatically every night.
    - ⚠️ [later] Later — If the phone is lost today, five months of photos go with it. Turn on backup now.
  - **step `storage-sms`** — 🗣 "In the morning, a message like this arrives."
    - 🗂 **sms** (brand `buludxidmet-fake`)
      - sender: BuludXidmet
      - time: 10:02
      - 💬 Your storage is full. Your photos will be deleted in 24 hours. Upgrade your plan: buludxidmet-plan.example.info → `https://buludxidmet-plan.example.info/odenis`
    - ⚠️ [click-link] Open link — The link does not go to the cloud service's site. Check storage only in the phone's settings. → `card-page`
    - ✅ [report] Report as spam — Well done. This is a fake: a real service does not threaten to delete your photos in a day. → `free-app`
    - ✅ [delete] Delete — Correct. Check your storage yourself in the settings. → `free-app`
  - **step `card-page`**
    - 🗂 **login** (brand `buludxidmet-fake`)
      - brand: BuludXidmət
      - url: https://buludxidmet-plan.example.info/odenis
      - fields: Card number, Expiry date, CVV
      - button: Pay 1.99 AZN
    - 💀 [enter-credentials] Pay 1.99 AZN — Your card details went to the fraudster. Call the bank on the number on the back of the card right away and block it.
    - ✅ [cancel] Close page — Good thing you stopped. Check your storage plan only in the phone's settings.
  - **step `free-app`** — 🗣 "You found a free backup app in the store."
    - 🗂 **permission** (brand `w2f-foto-ehtiyat`)
      - app: Foto Ehtiyat Pulsuz
      - permissions: Photos and videos, Contacts ✗lazımsız, SMS messages ✗lazımsız, Call log ✗lazımsız
    - ✅ [deny] Deny — Correct, a photo backup needs no access to texts or contacts. The phone's own backup is enough.
    - 💀 [allow] Allow — With text message access, the app can read your bank codes. Delete an app like this right away.
  - **step `lost-phone`** — 🗣 "A month later, the phone is lost on the metro. You sign in on a new phone."
    - 🗂 **notification** (brand `w2f-telefon-ayarlari`)
      - app: Settings
      - title: Restore from backup?
      - body: Last backup: yesterday 02:10. Photos: 4,812
      - time: 19:45
    - ✅ [open] Restore — Well done. Because backup was on, the family photos are all there.
    - ⚠️ [later] Set up as a new phone — Then the photos will not come to the new phone. Restore from the backup.

#### scenario · `br2-scenario` · The phone is lost
- 🎭 start: `n1`
  - **[n1]**  (, 🔊-): "In the evening you lost your phone on the metro. What do you do first when you get home?"
    - I lock the phone from another device and check where it is → `n2` — Correct. Locking stops the finder from reaching your photos and accounts.
    - I wait till morning, maybe someone will call ⇒ **risky** — On an unlocked phone your accounts are at risk. Lock it right away.
    - I post my number and address on social media ⇒ **risky** — Personal details give fraudsters a new chance. Lock the phone first.
  - **[n2]**  (, 🔊-): "The phone was not found. The next day a text arrives: "Your phone was found, sign in to see it"."
    - I open the link and sign in ⇒ **compromised** — This trap hunts people who lost a phone. Your account password goes straight to the fraudster.
    - I do not open it, I restore the new phone from backup ⇒ **safe** — Well done. The photos are safe in the backup, and a message like this cannot be trusted.

#### recap · `br2-recap`
- ✔ Turn on automatic backup on your phone.
- ✔ Restore one photo to check it.
- ✔ "Storage full"? Check settings, not the link.
