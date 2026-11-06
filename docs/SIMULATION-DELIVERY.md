# Delivering phishing simulations

How a simulation email reaches the inbox unchanged, how clicks are counted so that mail security scanners never create a "you clicked" risk against an innocent employee, and what to allow-list in Microsoft 365 and Google Workspace. For the organisation's mail administrator and the Cyclowareness operator; the code is in `portal/src/server/mail.ts`, `portal/src/server/tracking.ts` and `portal/src/server/actions/campaigns.ts`.

## 1. What goes out

- A simulation is sent through the organisation's own mail server (Settings → Email), by the job runner, as one message per recipient.
- **Display name:** the template's sender ("Accounting", "IT Support", a parcel service…) in the recipient's language.
- **From address:** the **simulation sender address** from Settings → Email when one is saved (for example `accounts@ofis-techizat-az.com`); otherwise the organisation's ordinary sender address, or `no-reply@<proven domain>`. Every other message (invitations, reminders, reports) always uses the ordinary sender.
- **Links** point at the portal: `https://<APP_URL>/t/<token>` (the lure link; the token is 10–40 characters of lower-case base32), `https://<APP_URL>/q/<token>` (the target of a QR code) and `https://<APP_URL>/api/t/<token>/open` (the one-pixel open tracker).

## 2. The look-alike sending domain (the owner's choice)

Which look-alike domain(s) to register (for example `ofistechizat-az.com` for the "office supplies" template) is a decision for the owner and the customer, not something the software picks (open question 18 in `build/OPEN-QUESTIONS.md`). Rules of thumb: never a domain that belongs to a real company or bank, never a trademark; a plausible but fictitious supplier, parcel or payroll name; one domain per customer is enough.

Once the domain exists:

1. **Prove it.** Settings → Email → Simulation sender: enter the address, publish the TXT record shown there (the same `cyclowareness-verify=…` value as in Branding → Domain proof) on the domain itself or on `_cyclowareness.<domain>`, select Check DNS, then Save. An address on an unproven domain is refused; the proof is checked once, when the button is pressed. A different domain proven later replaces the earlier proof and drops an address that was on the old domain.
2. **Authorise the mail server for it.** The organisation's SMTP server (or the provider behind it) sends with this domain in the `From` header, so the domain needs:
   - **SPF:** a TXT record on the look-alike domain that includes the sending server, for example `v=spf1 include:spf.protection.outlook.com -all` (Exchange Online), `v=spf1 include:_spf.google.com ~all` (Google Workspace) or the provider's own include. Without it the simulation is rejected or quarantined as a forgery.
   - **DKIM:** add the domain to the sending provider (Exchange Online: Defender portal → Email authentication settings → DKIM; a third-party relay: its "sending domains" page), publish the selector records it gives you, and switch signing on. Exchange Online and Google Workspace sign only domains that are added to the tenant as accepted (or alias) domains, so the look-alike domain must be added there too.
   - **DMARC:** at least `v=DMARC1; p=none; rua=mailto:…` on the look-alike domain, so failures are reported instead of silently dropped; move to `p=quarantine` once SPF and DKIM pass.
3. **Test** with Settings → Email → Send test email before the first campaign: the test goes out from the ordinary sender, so send one real small campaign to the administrators as well and check the headers (`Authentication-Results: spf=pass … dkim=pass …`).

A simulation that the provider refuses stays in the Delivery log as failed (resend from there once the records are fixed); a mistyped address fails the whole campaign silently in that log, so check it after every launch.

## 3. Microsoft 365: Defender advanced delivery

Defender for Office 365 treats allow-listed simulations as "third-party phishing simulations": Safe Links, Safe Attachments, spam and phishing verdicts and zero-hour auto purge (ZAP) are skipped for them, and the messages are still visible to the security team in Threat Explorer with the "Phish simulation" override reason. This is the supported way; mail flow (transport) rules that set the spam confidence level are not, and they do not stop Safe Links from rewriting the lure link.

1. Open the Microsoft Defender portal (`security.microsoft.com`) → **Email & collaboration → Policies & rules → Threat policies → Advanced delivery**.
2. On the **Phishing simulation** tab select **Edit** (or **Add**).
3. **Domain:** the look-alike sending domain(s) and, when simulations go out from the organisation's own address, that domain too. These are matched against the `5321.MailFrom` (envelope) and `5322.From` (header) addresses; the envelope sender is the one your SMTP server uses, so list both domains when they differ.
4. **Sending IP:** the public IPv4 addresses or CIDR ranges that the simulations arrive from, that is the outbound addresses of the organisation's SMTP server or relay provider (ask the provider; when the organisation sends through Exchange Online itself, Microsoft's own ranges). **A message is recognised only when both a domain and a sending IP match**, so at least one of each is required.
5. **Simulation URLs to allow:** the portal links, so that Safe Links neither rewrites nor detonates them: in the Tenant Allow/Block List URL syntax, without the scheme: `<portal host>/t/*`, `<portal host>/q/*` and `<portal host>/api/t/*`. This also keeps the tracked link readable in the message, which is part of the lesson.
6. Save. The policy can take up to 30 minutes to apply.

Also worth knowing:

- Exchange Online Protection still stamps the message as external, and Outlook's "first contact safety tip" shows for a sender nobody has written to before; both are realistic and should stay.
- The advanced delivery policy does not bypass **Exchange transport rules** or the **Tenant Allow/Block List** blocks; check both when a simulation still lands in quarantine.
- Microsoft's own Attack simulation training is a different product and needs no entry here.

## 4. Google Workspace

Gmail has no "phishing simulation" switch. Two settings together let a simulation through: an IP allow-list for the sending server and a spam bypass for the sender domain. Both are in the Admin console (`admin.google.com`) → **Apps → Google Workspace → Gmail → Spam, phishing and malware**, for the top-level organisational unit (or only the units that take part).

1. **Email allowlist:** add the public IP addresses or ranges of the organisation's SMTP server or relay provider. Mail from these addresses is not marked as spam by the IP reputation checks.
2. **Spam → Bypass spam filters for messages received from addresses or domains within these approved senders lists:** create an address list (for example "Phishing simulations") containing the look-alike domain(s) and the organisation's sending domain, and tick the bypass. Leave **"Do not bypass spam filters for messages that fail authentication"** unticked only while SPF and DKIM are not yet in place, and tick it again afterwards.
3. **Inbound gateway** (same page) is for organisations whose mail already passes through a gateway such as a Proofpoint or Mimecast relay: list the gateway's IP ranges there so that Gmail trusts the gateway's verdict instead of its own; do not switch it on for a plain SMTP sender.
4. If the organisation uses **Enhanced pre-delivery message scanning** or the **Safety → Links and external images** warnings, they stay on: Gmail shows its own warning banner on a brand-new domain and may delay delivery by a few minutes. There is no per-sender exception for these; the simulation still arrives, and the warning banner is a real red flag that employees should learn to read.
5. A **Content compliance** or **Routing** rule that quarantines mail by keyword applies to simulations as well; check the Quarantine (Admin console → Security → Quarantine) after the first campaign.

Save; Gmail settings can take up to 24 hours to apply.

## 5. Other gateways in front of the mailbox

Proofpoint, Mimecast, Barracuda, Fortinet, Sophos, Trend Micro, Symantec and Zscaler all offer a sender/IP allow-list and most have a "phishing simulation partner" or "URL rewriting bypass" list. Add the same three things everywhere: the sending domain(s), the sending IP addresses and the portal URL patterns above. Without the URL bypass the gateway rewrites the lure link to its own domain; the click still reaches the portal (the gateway redirects there), but the message loses the "look at the link" red flag.

## 6. How clicks are counted, and what the scanner detection does not catch

- **Rendering the landing page never counts.** `/t/<token>` and `/q/<token>` only look the token up and show the teachable moment. The click is recorded by a small JavaScript request (a beacon) that the page sends once it runs in a browser, before the fake sign-in form appears. A gateway that fetches the page to inspect it, a link preview in a chat app or a mail client's prefetch records nothing, whatever user agent it uses.
- **Known scanners are refused even when they run JavaScript.** The beacon is ignored for requests whose user agent names a bot, crawler, link checker or security product (Safe Links, Proofpoint, Mimecast, Barracuda, Fortinet, Symantec, Trend Micro, Sophos, Zscaler, headless browsers, curl and the like), and for browser prefetches (`Purpose: prefetch`).
- **What still gets through:** a sandbox that detonates the link in a real, scriptable browser with an ordinary user agent runs the beacon and counts as a click. Microsoft Safe Links detonation and some Proofpoint, Mimecast and Zscaler sandboxes do exactly this, which is why the allow-listing above (the URL bypass in particular) is still required; the beacon only removes the plain-fetch class of false positives. The same applies to a person who forwards the message to the security team, whose analysts then open the link: they count, unless they use an allow-listed sandbox or report instead.
- **Opens are informational.** The pixel counts any fetch of the image: image proxies (Gmail, Apple Mail Privacy Protection) and scanners open everything. Opens are shown in the campaign funnel but carry no risk score; clicks and submitted fake sign-ins do.
- **One click per person.** A second visit, a reload or a double tap changes nothing; the fake sign-in counts once too.
- **Cancelled campaigns** record nothing more, and a queued simulation of a cancelled campaign is never sent.

## 7. Checklist before the first campaign

1. Look-alike domain registered (owner's decision), proven in Settings → Email, with SPF, DKIM and DMARC published.
2. Mail server test passed; one small campaign to the administrators showed `spf=pass` and `dkim=pass`.
3. Microsoft 365: advanced delivery entry with domain, sending IP and the three URL patterns. Google Workspace: IP allow-list and approved-senders bypass. Any other gateway: sender, IP and URL bypass.
4. The security team knows the campaign dates, so reports are handled as training and analysts do not open the links from an unlisted browser.
5. After launch: Delivery log clean (no failed messages), the first opens and clicks appear in the campaign funnel.
