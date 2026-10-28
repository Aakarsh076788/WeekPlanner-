# Weekcraft

A private, account-scoped BTech routine tracker with three focused views:

- **Today:** live IST clock, current/upcoming/anytime work, visible problem checkboxes and clickable titles, plus a pending queue for unfinished sessions and problems. Older pending work appears here once, with Tomorrow, Day after, custom time, and Undo. Recent pending work appears first; longer queues expand on demand.
- **Weekly plan:** dated sessions, weekly focus, exact study topics/problems, notes, checkboxes and copying an empty week with fresh progress. No metric blocks repeat here.
- **Metrics:** weekly completion, planned versus completed work, coding progress, category breakdown, study/actual time, sleep logs and full-day streaks.

## In-site planning

The planner previews a change, then applies it within the website. It supports additions, rescheduling, deleting sessions and replacing a day. The previous bulk change can be undone; undo refuses to overwrite newer changes in affected weeks. Writes use compare-and-swap and idempotent request IDs. Previewing is read-only, and applying a stale preview is rejected. Existing completion/actual time is preserved for session edits.

Without an OpenAI runtime connection, the UI explicitly says **Quick planner**. It supports common commands such as:

- `Clear today and add Linked List from 7–8 PM`
- `Tomorrow, Java arrays 6–7 PM with LC 724 and LC 121`
- `Add Java arrays day after tomorrow 7–8 PM with LC 724`
- `Add gym 5–7 AM every weekday this week`
- `Move gym to tomorrow 6–7 AM`
- `Clear 2026-10-28`

The single Add session control offers Today / Tomorrow / Day after tomorrow shortcuts. The editor accepts any date; moving a session across weeks removes its original occurrence atomically and retains the same ID. Rescheduling checks overlaps and preserves solved problems and logged time.

Use one session per line for multi-session plans. Dates, weekdays, ranges up to 31 days, repeat expansion, AM/PM and overnight times are handled. Ambiguous/missing times ask for detail. Quick planning is deterministic and is not presented as GPT.

For full GPT conversation in the same UI, configure `OPENAI_API_KEY` through Sites runtime secrets using the OpenAI Developers key workflow. `OPENAI_MODEL` optionally overrides the default `gpt-4.1-mini`. The server uses the Responses API with strict structured output, no stored response and a 45-second timeout. Model output is validated by the same date, task, link, ownership and overlap checks. This GPT branch is inactive and not live-tested until a model credential is provided. No API keys belong in browser code, source, logs or manifests.

## Data, privacy and ChatGPT connection

ChatGPT sign-in and the Site access policy restrict access. D1 records are keyed by the authenticated Site user ID; endpoints reject anonymous requests. Browser focus/visibility refresh picks up other-device changes. Session and problem checkboxes are independent controls. Completion metrics and streaks require both the session and all its problems checked; unchecked problems stay actionable even if the session checkbox is checked. Completed study estimates use logged minutes when available, otherwise checked sessions’ planned duration. Sleep belongs to bedtime date and supports overnight duration. Full-day streaks require every dated session and problem complete; empty days break the streak.

The `/mcp` endpoint retains read, preview and save tools and adds `change_weekcraft_plan` and `undo_weekcraft_change`. ChatGPT can clear/replace sessions directly without opening the website. Read and preview first; only remove explicitly requested session IDs.

## Validation

Run `npm test` for 24 shared-model regression checks covering the live clock, overnight boundaries, unfinished problem handling, cross-week moves, preserved links/progress, retry protection, overlap detection, Undo, arbitrary manual date edits, and day-after-tomorrow commands. This update also passed 11 local API persistence/isolation checks and desktop/375px phone interaction checks. The clock refreshes every 30 seconds while open and on focus; no background notification service is implied.


18 model checks cover the exact Linked List request, dates/ranges/repeats, AM/PM clarification, multi-session requests, clear scope, moves, undo and retry protection. 17 local API checks cover persistence, atomic replacement, stale preview rejection, preserved work, account isolation, anonymous rejection, and connector clear/undo. Desktop and 390px phone checks cover direct planning, apply/undo, daily completion, navigation and separate Metrics. Type-check and production build pass. Temporary QA pages are excluded from deployment.

Use Sites project helpers for dependencies, preview and publication. Schema changes use `npm run db:generate` and local D1 migrations. Type-check with `node node_modules/typescript/bin/tsc --noEmit`.


## Run this repository locally

Requires Node.js **22.13 or newer** and pnpm **11.25.0** (the version in `package.json`). A clean clone automatically uses the portable development profile.

```bash
git clone https://github.com/Aakarsh076788/WeekPlanner-.git
cd WeekPlanner-
pnpm install --frozen-lockfile
pnpm build
```

Apply the schema to the local development database once after the first build:

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_medical_captain_america.sql
```

Then start development:

```bash
pnpm dev
```

Open the localhost URL printed by the server (normally `http://localhost:5173`). The clean-clone portable profile provides a local-only development sign-in; choose **Sign in** in the preview. Hosted authentication remains controlled by Sites.

### Optional local GPT configuration

Copy `.env.example` to `.dev.vars` and configure your own `OPENAI_API_KEY` to enable the website's full GPT planner locally. Without it, the deterministic Quick planner works. Both `.dev.vars` and real `.env` files are ignored by Git. Never commit keys.

### Useful commands

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm db:generate
```

Local and hosted databases are separate. The repository contains source code and schema migrations; it does not contain saved routine records, credentials, installed dependencies, or generated builds. The existing private deployment remains at https://aakarsh-weekcraft.artful-hero-1094.chatgpt.site .
