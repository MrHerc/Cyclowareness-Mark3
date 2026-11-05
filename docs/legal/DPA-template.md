# Data Processing Agreement (template)

> **Template for counsel. Not legal advice, not reviewed, not for signature as is.** It is a standard controller–processor skeleton prepared from what the Service actually does (see `SUBPROCESSORS.md` and `portal/content/legal/privacy.en.md`). Text in `[square brackets]` is to be completed or decided by counsel and the parties. The Azerbaijani version is `DPA-template.az.md`; the parties choose which language prevails.

**Between**

- `[Organisation name]`, `[registration number]`, `[address]` (the "Controller"; under the Law of the Republic of Azerbaijan "On Personal Data", the owner of the personal data), and
- `[to be provided]`, registration number `[to be provided]`, address `[to be provided]`, offering the Cyclowareness service under the Safarov Industries name (the "Processor"; under that Law, the operator).

This Agreement forms part of the Customer Agreement dated `[date]` (the "Customer Agreement") and the Terms of Use. If they conflict on personal data, this Agreement prevails.

## 1. Definitions

Terms such as personal data, processing, controller, processor, data subject and personal data breach have the meaning given in the Law of the Republic of Azerbaijan "On Personal Data" and, where it applies, Regulation (EU) 2016/679 (GDPR), the UK GDPR or Law No. 6698 of Türkiye (KVKK). "Service" means Cyclowareness in the Cloud Version operated by the Processor. "Sub-processor" means a third party the Processor engages to process personal data for the Controller.

## 2. Subject matter, duration, nature and purpose

2.1. The Processor processes personal data only to provide the Service described in the Customer Agreement: security-awareness lessons, the AI Sel assistant, simulations, policies and attestations, certificates, reports and integrations. Details are in Annex I.
2.2. This Agreement applies for as long as the Processor processes personal data for the Controller and ends with the return or deletion under clause 11.

## 3. Instructions

3.1. The Processor processes personal data only on the Controller's documented instructions. The Customer Agreement, this Agreement and the Controller's settings in the Service (for example, enabling AI Sel, spoken questions, SMS, integrations) are those instructions.
3.2. The Processor informs the Controller without delay if it considers an instruction to infringe applicable law, unless the law forbids it.
3.3. If the law requires other processing, the Processor informs the Controller before processing, unless the law forbids it.

## 4. Controller obligations

The Controller has a legal basis for the processing and informs data subjects (Terms of Use §8), registers only persons it is entitled to register, keeps its settings and integrations secure and decides data-subject requests made in the Service without undue delay.

## 5. Confidentiality

Persons authorised by the Processor to process personal data are bound by confidentiality, including after their engagement ends (Article 5.5 of the Law "On Personal Data").

## 6. Security

The Processor implements the technical and organisational measures in Annex II and keeps them appropriate to the risk (Article 32 GDPR; Articles 5.8 and 9.12 of the Law "On Personal Data"). The Processor may update them if the level of protection does not decrease.

## 7. Sub-processors

7.1. The Controller gives general authorisation for the sub-processors listed in Annex III.
7.2. The Processor informs the Controller of an intended addition or replacement at least `[30]` days in advance. The Controller may object on reasonable data-protection grounds within `[15]` days; the parties then seek a solution in good faith, and failing one the Controller may terminate the affected part of the Service `[without penalty]`.
7.3. The Processor imposes on each sub-processor data-protection obligations no less protective than this Agreement and remains liable for it.

## 8. International transfers

8.1. Personal data is stored in `[the hosting region in Annex III]`. Transfers to sub-processors outside the Republic of Azerbaijan, the EEA or the United Kingdom take place only with appropriate safeguards: an adequacy decision, the European Commission's standard contractual clauses (`[module 3, processor to processor]`) or another mechanism allowed by the applicable law, and in line with Article 14 of the Law "On Personal Data".
8.2. `[Counsel: state whether the Azerbaijani cross-border rules require the Controller's separate consent or a notification for transfers to the United States (Anthropic).]`

## 9. Assistance

9.1. Taking into account the nature of the processing, the Processor helps the Controller answer data-subject requests (the Service offers data download and erasure requests under Profile, Your data), forwards requests it receives directly and does not answer them itself unless instructed.
9.2. The Processor helps with security, breach notification, data protection impact assessments and prior consultation, as far as the information available to it allows.

## 10. Personal data breach

The Processor notifies the Controller without undue delay and in any case within `[48]` hours of becoming aware of a personal data breach affecting the Controller's data, with the information then available (nature, categories and approximate numbers of data subjects and records, likely consequences, measures taken or proposed, a contact point), and supplements it as it becomes available.

## 11. Return and deletion

At the end of the Customer Agreement the Processor, at the Controller's choice, returns (the exports the Service offers) and deletes the Controller's personal data within `[30]` days, unless the law requires storage. Backups expire on their rolling cycle (currently 14 days) and are not restored meanwhile except for disaster recovery.

## 12. Audits

The Processor makes available the information needed to demonstrate compliance with this Agreement and allows audits by the Controller or an auditor it mandates, bound by confidentiality, on `[30]` days' notice, at most `[once a year]` unless a breach or a supervisory authority requires otherwise, `[at the Controller's cost]`. Current third-party reports or certifications may be supplied instead where they cover the question.

## 13. Liability, law and jurisdiction

Liability follows the Customer Agreement `[counsel: check whether the cap applies to data-protection claims]`. This Agreement is governed by `[the law of the Republic of Azerbaijan]`; disputes go to `[the court named in the Customer Agreement]`. Mandatory rights of data subjects are not affected.

## Signatures

| Controller | Processor |
|---|---|
| Name, title, date, signature | Name, title, date, signature |

---

## Annex I — Description of the processing

| Item | Description |
|---|---|
| Data subjects | the Controller's employees and other persons it authorises to use the Service; its administrators |
| Categories of data | account and work data (name, email, job title, department, manager, role, language, status; phone number where phone sign-in or SMS is used); sign-in data (password hash, two-step settings, sessions); optional profile picture; training data (progress, answers, results, XP, streaks, badges, risk score, time spent); attestations and policy acknowledgements (text, version, time, IP address); certificates; results of training attacks (QR scans with truncated IP, simulated phishing and SMS actions, reports); AI Sel questions as text and answers; security and device data (audit log, IP address, user agent); email and SMS delivery records; records of data-subject requests. Privacy Policy §3 |
| Special categories | none required (Privacy Policy §3.1) |
| Nature of processing | hosting, storage, display, analysis for reports, sending of emails and text messages, sending AI Sel questions and lesson text to the AI provider (Annex III) |
| Purposes | delivering and reporting on the Controller's security-awareness training; account security; support |
| Duration and retention | for the term of the Customer Agreement; retention periods in Privacy Policy §8 `[the parties may set shorter periods here]` |

## Annex II — Technical and organisational measures

From Privacy Policy §9 and the code; counsel and the Processor's security lead to confirm before signature.

- Encryption in transit (HTTPS/TLS); passwords stored only as one-way hashes; integration secrets (mail server passwords, single sign-on and integration keys) encrypted at rest.
- Separation of each Organisation's data by row-level security in the database.
- Two-step sign-in (can be made mandatory for administrators), sign-in attempt limits, device limits, sessions ending after inactivity.
- Role-based access with scopes; an append-only audit log of sign-ins and administrative actions.
- AI Sel: no name, email, job title or organisation name is sent to the AI provider; questions are stored without a link to the account; hourly limits.
- Cloud Version: daily backups on a rolling cycle, hardened servers with key-only administrative access, regular updates `[hosting details to be confirmed]`.
- Confidentiality obligations for staff with access to personal data; breach handling under clause 10.

## Annex III — Sub-processors

The current list, with purpose, data and region for each, is `docs/legal/SUBPROCESSORS.md` (to be attached as of the date of signature): the hosting provider `[to be provided]`, Anthropic PBC (United States), ElevenLabs (United States, lesson text only, no personal data), the platform mail server `[to be provided]` and the text-message operator `[to be provided]`.
