# TISSENSE — Vercel edition

A public IV-monitoring prototype with a Next.js frontend, server API routes and Neon PostgreSQL persistence. Fictional sample patients only. Real-device ingestion is disabled on this public edition. The previously published Sites application is separate; these source changes do not redeploy it.

## Public visitor experience

Visitors open the app without a hosting account. The server issues a random, HttpOnly, SameSite session cookie and stores only its hash. Each visitor receives an isolated database workspace containing 12 fictional patients. Actions, alerts, preferences, assignments and handovers persist across reloads in the same browser for 30 days. Browser cookie deletion, session expiry or ending the session requires a new workspace. There is no cross-device staff account login in this public sample edition.

The dashboard, patient pages, animated IV equipment, monitoring gauges, care recommendations, scenarios, alert history, notes and handovers remain available. Recommendations are predefined rules, not an external AI model or autonomous treatment.

Acknowledgement records receipt. A documentation-only action leaves an out-of-range condition under monitoring. Explicit sample recovery changes the affected fictional sensor readings and closes only the matching and related alert episodes. Resolved alerts remain in history. Reloading never reopens a recovered condition without a new abnormal reading.

## Local development

Requires Node.js 22.13 or newer.

```powershell
npm ci
$env:TISSENSE_LOCAL_DB='1'
npm run dev
```

Open http://localhost:3000. Local testing uses PGlite (PostgreSQL), stored in ignored `.test-runtime/local-postgres`. It initializes the same SQL schema automatically and is explicitly disabled in production. To use Neon locally instead, set a server-only `DATABASE_URL` in `.env.local`, disable `TISSENSE_LOCAL_DB`, run `npm run db:migrate`, then start the app.

## Vercel deployment

1. Connect the intended Vercel account and a Neon database. Create the TISSENSE project from this checkout using the Vercel CLI or a Git repository.
2. Add the Neon connection string as `DATABASE_URL` in Vercel's server environment for Production (and a separate test database for Preview if previews are enabled). Never use a NEXT_PUBLIC prefix for database secrets.
3. Deploy to Production. `vercel.json` selects Next.js and runs the idempotent PostgreSQL migration before the production build. A missing database connection fails deployment instead of publishing an app with broken storage.
4. Set the production deployment's access to public, without Vercel Authentication or a password gate. Verify the assigned production URL from an unauthenticated browser.
5. In the app, Settings → Connected application must report backend and database connected. Apply a sample recovery and reload; confirm the episode remains resolved. Open another browser session and confirm records are isolated.

Vercel and Neon account access is required to perform these steps. Preparing this branch or running a local build does not create a public deployment URL.

## Backend and database

- `POST /api/session`: creates/reuses a visitor session; new sessions are limited to 100 per network address per hour.
- `DELETE /api/session`: revokes the current session and removes its cookie.
- `GET /api/monitoring`: reads the visitor's sample workspace and advances active simulation.
- `POST /api/monitoring`: validates and saves allowed actions, deriving identity and timestamps on the server.
- `GET /api/health`: checks the connected backend/database for the current session.
- Live source access, device-key creation and telemetry ingestion return 403 on this public edition.

Schema: `db/migrations/001_postgres.sql`. Database driver: `db/postgres.ts`. Monitoring persistence: `lib/tissense/repository.ts`. Legacy Cloudflare/Drizzle files remain for reference and are not used in the Vercel build or migrations.

Optimistic versions and atomic PostgreSQL transactions prevent concurrent actions from overwriting each other. A stale action returns HTTP 409 and refreshes the displayed readings for review. No client action is reported as saved before server confirmation. Database errors are visible; there is no browser-only storage fallback.

Trend samples persist once per minute while monitoring runs. Charts load the last 12 hours. Views load every active episode, the latest 2,000 resolved episodes and 3,000 activity/notification records; older records remain in the database. Session expiry prevents access but is not a deletion policy. Establish storage retention and scheduled cleanup for a long-running deployment.

Simulation/reminders run while the app polls; there is no unattended background alert dispatcher. Sound and vibration depend on browser support. This prototype is not a clinically validated medical device and must not receive real patient information.

## Checks

```sh
node --experimental-strip-types --test tests/engine.test.ts
npm run test:workflow
npm run test:backend # local dev server must be running
npx tsc --noEmit
npm run build
```

Backend checks cover public sessions, origin protection, validation, recovery persistence, conflicting updates, stale writes, visitor isolation, handovers, live-data restrictions, header-spoof rejection and logout.
