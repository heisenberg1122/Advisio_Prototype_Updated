# Advisio production deployment

The supported production topology is:

- Web SPA: Vercel, rooted at `apps/web`
- API: the existing Render Docker web service, using `apps/api/Dockerfile` from the repository root
- Database: managed PostgreSQL
- Documents: Google Drive OAuth, in a dedicated production folder named `ADVISIO_RESEARCH_DOCUMENTS`

Do not reuse local database URLs, local OAuth redirect URLs, `.env` files, demo users, or the local Google Drive folder in production. Never run `prisma migrate reset`, `prisma db push`, or the development demo seed against staging or production.

## 1. Pre-deployment checks

Use Node 22 and npm 10.8.3, then run from the repository root:

```bash
npm ci
npm run lint
npm run type-check
npm test
npx prisma validate --schema=packages/database/prisma/schema.prisma
npm run build
npm audit --omit=dev
docker build -f apps/api/Dockerfile -t advisio-api:release .
```

Database integration tests require the isolated `postgres-test` container and must never target a shared database:

```bash
docker compose up -d postgres-test
npm run test:integration
docker compose stop postgres-test
```

## 2. Managed PostgreSQL

1. Take and verify a provider snapshot before every production migration.
2. Set `DATABASE_URL` to the pooled/runtime URL and `DIRECT_URL` to the direct migration URL when the provider offers both.
3. Review the SQL under `packages/database/prisma/migrations` before applying it.
4. Apply committed migrations only:

```bash
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
```

5. Run the safe idempotent reference seed. It creates or updates roles, permissions, institutional units, and verified programs only; it does not create users, projects, workflows, submissions, documents, or demo records:

```bash
npm run db:seed
```

6. If the first system administrator does not exist, temporarily set the five `BOOTSTRAP_ADMIN_*` variables from `.env.production.example`, run the following once, and immediately remove the password variable from the service configuration:

```bash
npm run db:bootstrap-admin
```

The bootstrap refuses weak passwords, refuses to modify a non-admin account, and is a no-op when the matching system administrator already exists.

## 3. Render API service

Reuse the existing Render service. Configure it as a Docker web service with repository root `.` and Dockerfile path `apps/api/Dockerfile`. The API listens on Render's `PORT`; do not hard-code a public port.

Copy only the Render/server variables from `.env.production.example` into Render. Use the Vercel production origin for both `WEB_URL` and `CORS_ORIGIN`. Keep all demo and self-signup flags `false`.

Set the health check path to:

```text
/api/health
```

Deploy the exact reviewed commit, apply migrations, run the safe reference seed, and verify:

```bash
curl -fsS https://YOUR_RENDER_DOMAIN/api/health
```

Expected result: HTTP 200 with `status: healthy` and `database: connected`.

The realtime event bus is process-local. Keep the API at one instance until realtime delivery is backed by a shared broker such as Redis; otherwise connected users on different instances may miss events.

## 4. Google OAuth and Drive

Create a separate production Drive folder named `ADVISIO_RESEARCH_DOCUMENTS` and place its ID in Render as `GOOGLE_DRIVE_FOLDER_ID`. Do not change the local folder ID in `.env`.

In Google Cloud Console, add the exact production callback:

```text
https://YOUR_RENDER_DOMAIN/api/integrations/google-drive/callback
```

Add the exact Vercel production origin to the OAuth client's authorized JavaScript origins. Store the client secret and integration encryption key only in Render. After deployment, connect Drive through an authorized admin account and perform an upload/download smoke test in the production folder.

## 5. Vercel web app

Reuse the existing Vercel project and set its root directory to `apps/web`. The committed `vercel.json` installs from the monorepo root, builds validations and the SPA, applies SPA rewrites, and adds baseline security headers.

Configure these build-time variables in Vercel:

```text
VITE_API_URL=https://YOUR_RENDER_DOMAIN
VITE_GOOGLE_SIGN_IN_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID
VITE_GOOGLE_SIGN_IN_ALLOW_SELF_SIGNUP=false
VITE_ENABLE_DEMO_ACCOUNTS=false
```

`VITE_API_URL` is the API origin without a trailing `/api`. Never place database credentials, Google client secrets, JWT secrets, or integration keys in `VITE_*` variables because they are embedded in the public browser bundle.

Deploy a Vercel preview first. Promote to production only after the staging checks below pass and the owner explicitly approves public launch.

## 6. Staging acceptance checklist

- Health endpoint returns healthy/database connected.
- Login succeeds for an explicitly created staging account; unknown accounts receive a generic error and are not created.
- Role dashboards and responsive light/dark themes render correctly.
- Google Sign-In uses the intended OAuth client and approved origins.
- Google Drive connects to the dedicated production/staging folder; upload and download succeed.
- Calendar OAuth flow succeeds when enabled.
- Email sends from the verified production sender.
- A complete workflow can be created, submitted, reviewed, evaluated, and archived.
- SSE reconnects after a brief network interruption.
- CORS rejects an unapproved origin.
- No demo controls or passwords appear in the production bundle.
- Logs contain no tokens, passwords, OAuth codes, database URLs, or document contents.

## 7. Rollback

If application checks fail, roll Render and Vercel back to the previous known-good commit. Do not reverse a database migration blindly. Restore the pre-deployment snapshot only after confirming the failed release wrote incompatible data and after preserving any newer legitimate production records.

Public launch remains a separate, explicit approval step.
