# Cyclowareness sub-processors

Status: working list for counsel and customers, 2026-11-05. Not reviewed by a lawyer. The Provider's identity is `[to be provided]`, as in the Privacy Policy. This list is Annex III of `DPA-template.md` and must match §6.3 and §7 of `portal/content/legal/privacy.<lang>.md`.

Applies to the Cloud Version, which the Provider operates. In the Local Version the Organisation runs the Service itself and decides which of these services it connects (none is required: without the keys the Service answers offline, keeps the browser's voice and logs mail and SMS instead of sending them).

## Sub-processors

| Sub-processor | Purpose | Personal data it receives | Region | Transfer basis | Where in the code |
|---|---|---|---|---|---|
| Hosting provider: `[to be provided]` (the Privacy Policy §6.3 and §7.1 name UpCloud Ltd, data centre in London, United Kingdom; the owner must confirm) | servers, database, file storage, backups | all data of the Service | United Kingdom (to be confirmed) | UK adequacy decision (to be confirmed with the hosting contract) | not in code: deployment choice (`portal/docker-compose.yml`, `portal/README.md` "Production with Docker") |
| Anthropic PBC, United States | AI Sel answers; AI subtitles in languages the library does not ship; lesson and training drafts in the training studio | the learner's question as typed or as converted to text by the browser, unfiltered (may contain whatever the learner writes); no name, email, job title or organisation name. Subtitles and drafts: lesson text and the author's topic, no learner data | United States | Anthropic commercial terms and Data Processing Addendum with the EU standard contractual clauses (the owner must confirm the signed terms, retention and any zero-retention option) | `portal/src/app/api/tutor/route.ts:76-78` (request), `portal/src/server/tutor.ts:207-229` (what is sent), `portal/src/server/subtitles.ts:169-181`, `portal/src/server/ai.ts:72-83` and `:153-245` (studio), `portal/src/server/env.ts:25-29` |
| ElevenLabs, United States (legal entity to be confirmed from the contract) | narration clips produced in advance from lesson text | none: only lesson text, sent by an operator script, never during learning | United States | not needed for personal data; the owner should still keep the contract terms on file | `portal/scripts/generate-narration.ts:1-12`, `:25` (API), `portal/src/lib/tts/key.ts:3-7` |
| Platform mail server: `[to be provided]` | the Provider's own mail with no organisation, today only the demo-request notice to the sales mailbox | demo request: name, work email, organisation, country, employee range, message | `[to be provided]` | `[to be provided]` | `portal/src/server/env.ts:40-49` (`SALES_EMAIL`, `PLATFORM_SMTP_*`), `portal/src/server/mail.ts:86-98`, `portal/src/server/actions/site.ts:109-120` |
| Text-message operator: `[to be provided]` | one-time sign-in codes by phone; SMS simulations where the Organisation enables them | phone number and message text (the code, or the simulated message with its tracking link) | `[to be provided]` | `[to be provided]` | `portal/src/server/sms.ts:19-42` (webhook `{to, text}`), `portal/src/server/actions/auth.ts:364-375`, `portal/src/server/services/campaigns.ts:280` |

The Provider controls the demo-request data for its own purposes (Privacy Policy §3.3), so the platform mail server acts for the Provider as controller there, not for an Organisation.

## Not sub-processors (listed so the question does not come back)

- **The learner's browser speech services.** A spoken question is converted to text by the browser's own speech recognition (`portal/src/components/player/tutor-panel.tsx:113-131`, `SpeechRecognition` / `webkitSpeechRecognition`); answers and lessons without a clip are read by the browser's own voice (`portal/src/components/player/narrator.ts:48`, `speechSynthesis`). The browser maker chooses the engine and some send audio or text to their own servers under their own terms; the Service never receives the recording, only the text (`/api/tutor` body, `portal/src/server/tutor.ts:14-29`). The Privacy Policy §5.3 and §5.4 say so.
- **The Organisation's own systems.** Its mail server, identity provider or directory, SIEM and ITSM (Privacy Policy §6.2) are chosen and contracted by the Organisation.
- **Server monitoring.** Notifications carry no personal data (Privacy Policy §6.6).

## Changing this list

A new sub-processor is announced to Organisations in advance (Privacy Policy §6.7, DPA template clause 7). When this list changes, update §6.3 and §7.2 in all twenty legal files (`portal/content/legal/`), raise their version header and the demo form's `consentVersion` (`portal/content/landing/<lang>.json`).
