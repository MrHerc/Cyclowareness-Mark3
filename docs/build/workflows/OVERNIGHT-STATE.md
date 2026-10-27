# Overnight 2026-10-27: 10 languages + experience overhaul (state for resuming)

User request (az, 2026-10-27 ~00:15): whole portal in 10 languages (az en ru tr ro ka uk de fr ar; ar Saudi, RTL, replaces Italian "it" since there is no Spanish), verified non-literal translations incl. all 106 lessons, natural TTS per language, lesson page structure + collapsible syllabus, volume, subtitles in other languages (AI for unshipped ones), mascot with many acts and cozy storybook look, paths: lessons first then labs, portal-wide light/animations. Use Ponytail, Graphify, Agent Skills, Claudex Loop (Codex), ECC. Decision is mine. Commit only if asked.

Backups: scratchpad/backup-before-ten-locales.tgz (tree at 00:57), drizzle-before-b/ (migration before lab_ids/ai_cache).
Done in main tree: security fixes integrated (1152 tests, build ok); schema lab_ids + ai_cache + regenerated drizzle; checker locale-generic; glossaries scratchpad/glossaries/*.md; i18n.<lang>.json titles; codemod (logical CSS) done.

Workflows (resume with Workflow({scriptPath, resumeFromRunId})):
- Phase A main tree: scratchpad/phase-a-ten-locales.js wf_a8dae3e9-329 (args {scratchpad})
- Localize per language: scratchpad/localize-language.js: tr wf_3a07fbd7-453, de wf_1bde0a71-fa5, fr wf_a783af65-3e3, uk wf_edb26592-7a5, ro wf_75b21604-d0d, ka wf_b1c11145-0d6, ar wf_9f8275a7-ddd (args lang/langName/market/plurals as first launch)
- Workspaces (merge back with 3-way merge, base = scratchpad/featws-base):
  - scratchpad/featws: features-early.js wf_87e377dc-ef5 (paths+labs, module page, TTS pipeline, subtitles API) -> writes features-early/changed-files.txt
  - scratchpad/lightws: light-polish.js wf_466adfa7-ee3 -> light-polish/changed-files.txt
  - scratchpad/mascot-ws (base = backup-before-ten-locales.tgz; mascot files unchanged in main): mascot-engine.js wf_d9da1220-bc3 -> copy back src/components/mascot/** (not mascot.tsx), tests/mascot-cat.test.ts, design/mascot-cat/**
Then: player UI (syllabus, volume, speed, subtitles UI, transcript, keys, clips wiring) after merges; mascot page integration (home toys/laser/run, setAuto on decorative); i18n gap fill for new keys in 7 langs; reseed (stop :3000) + content:sync; build; e2e in 10 langs; Codex/ECC reviews; docs ADRs; servers 3000 + 3200 link; 3100 demo was not running (do not rebuild).

## Second usage limit (resets 10:10 Asia/Baku)
All workflows above stopped again; resume each with the same scriptPath + resumeFromRunId (finished agents replay from cache).
featws: paths/labs/admin/catalog done (not checked, message keys missing); module page rework, messages, tests, TTS, subtitles API still to do. Some agents reported declined tool calls (permission), retry on resume.
Next scripts ready: scratchpad/player-and-mascot.js (after Phase A + merges), scratchpad/merge-ws.py <ws> <base>.

## 10:40 resilience
- User (10:35): keep working through limits; after a reset continue without asking. Scripts now wrap every agent in retrying() (10-minute waits, up to 40 tries). Watchdog cron 213d97df (7,27,47 * * * *) resumes stopped workflows; delete it when everything is done.
- Running now (Task IDs): phase A wpdyp1zss; features-early ww3zoijmv (continuation prompts for paths-module and tts); tr wxsqoh0q6; de wyf7wfi2g, fr wtk1mmwzl, uk wfgfbluao, ro w9q5jwmpd, ka wxgciif50, ar wifp5w2zw (these six are the 05:15 runs, still alive); mascot wpn2h6vrp; light wuhuh94t7. The live runs use the older scripts (no retrying); on failure resume them with the updated scripts.
- Weekly usage was 71% at 10:35 (resets Sun 22:00): prefer sonnet for reviewers/editors, avoid extra rounds.
- Cloud credits: the repo has no git remote, so cloud sessions cannot see this work without pushing (not authorised); not used.
- 10:55 user: finish everything, then commit AND push (full). No git remote exists: check gh, decide remote at the end.
- 11:05 remote origin = https://github.com/MrHerc/Cyclowareness-Mark3.git (access ok via credential manager). origin/main has its own initial commit; at the end push our branches (do not force main), see what main holds first.
- 12:45 ka: all 106 lessons pass, UI + lesson consistency done; resumed (task wmf6bsfsx) to run the 15 editors that hit the 07:00 limit.
- de done (106 pass, consistency edited 49 lessons); resumed for 10 failed lesson editors (task w79a00hnm).
- fr done (106 pass, consistency unified 46 files); resumed for 17 failed editors (task wza2kmsxn).
- uk done (106 pass, ~190 consistency edits) resumed for 11 editors (wnd7lud72); ro done (954/954 coverage incl. all langs, 72 files unified) resumed for 10 editors (wed531mg5). Note: Phase A removed settings.languages.lessonsInterface/siteOnly from en; new-language settings.json may still carry them -> gap-fill/sync must remove extras.
- tr COMPLETE (38/38 agents, all editors + both consistency passes, 106/106 pass).

## PAUSE PLAN (user, Tue 16:40: weekly 92%, resets Sun 2026-11-01 22:00 Baku)
- At weekly >= 95%: TaskStop every workflow not in its final stage; keep the finishers: Phase A (integrate→review→fix, run wf_a8dae3e9-329, task wpdyp1zss), features-early fix (wf_87e377dc-ef5, task ww3zoijmv), mascot refine-1 (wf_d9da1220-bc3, task wpn2h6vrp), ar lesson consistency (wf_9f8275a7-ddd, task wifp5w2zw, old script).
- Pause candidates (verification editors, safe to stop; finished agents stay cached): ka wmf6bsfsx (wf_b1c11145-0d6), de w79a00hnm (wf_1bde0a71-fa5), fr wza2kmsxn (wf_a783af65-3e3), uk wnd7lud72 (wf_edb26592-7a5), ro wed531mg5 (wf_75b21604-d0d), light wuhuh94t7 (wf_466adfa7-ee3).
- Do NOT launch player-and-mascot.js or anything new before the reset.
- After the finishers end: merge workspaces (featws, mascot-ws [copy mascot files], lightws if its agents produced work), typecheck/lint/tests, local WIP commit (no push), docs/build/RESUME.md, dev server :3000, report.
- Crons: watchdog v2 47dc61dc (every 10 min), Sunday resume one-shot 9710f7a8 (Nov 1 22:17).
- Sunday: resume paused workflows with the same scriptPath + resumeFromRunId + args (same session only; in a new session re-run the scripts: translators keep existing files, editors re-verify), then player-and-mascot.js, gap fill (new keys in 7 langs, remove settings.languages.lessonsInterface/siteOnly extras), reseed, build, reviews, docs, commit, push origin (https://github.com/MrHerc/Cyclowareness-Mark3, merge origin/main README commit, no force).
- 17:00 weekly 94%. User: "mascotu bitir" (finish the mascot). STOPPED (resume Sunday with same run IDs): fr wf_a783af65-3e3, uk wf_edb26592-7a5, ro wf_75b21604-d0d, ka wf_b1c11145-0d6, de wf_1bde0a71-fa5, light wf_466adfa7-ee3. features-early wf_87e377dc-ef5 COMPLETE (7/7).
- Still running: mascot refine-1 (wpn2h6vrp), Phase A integrate (wpdyp1zss), ar consistency (wifp5w2zw).
- Mascot finish plan (user priority, allowed past 95%): when mascot engine workflow ends -> copy mascot-ws files (src/components/mascot/** except mascot.tsx, tests/mascot-cat.test.ts, design/mascot-cat/**) into main -> run scratchpad/mascot-pages.js (page integration only) -> tests -> commit.
- 18:00 mascot engine COMPLETE (art+acts+critique 7/10+refine all musts/shoulds) and MERGED into main (35 mascot tests pass). Launched mascot-pages.js (wf_abeae341-4ad, task w5w9gftjg) for the page integration (user: finish the mascot). featws merge still pending (do it after Phase A ends).
- 18:20 ar run ended: 106/106 lessons pass, lesson consistency done (UI pass too); 14 editors (landing, ui-learner, lessons 2-13) left for Sunday: resume wf_9f8275a7-ddd then (updated script).
- 18:50 Phase A COMPLETE (8/8; typecheck 0, build ok; Codex CLI 0.164 crashes 0xC0000005 so only ECC reviewed; 14 findings fixed). featws MERGED into main (38 taken, 10 merged, 5 conflicts resolved by hand). Gap fixes done by me: 7 language names in ro/ka/uk/de/ar (common, player, secops), fr auth smsText nbsp, ar landing 'it' sample + FAQ. Waiting for mascot-pages (w5w9gftjg); its in-progress home-mascot keys cause 7 transient tsc errors.
- 19:45 gap fill done (31 keys x 7 langs); full suite 76 files / 2583 tests pass; typecheck 0, eslint 0; db reset+seed with 10x106 lessons; dev server :3000 up; ar RTL home/module/path screenshots OK. Local commit next (no push).
