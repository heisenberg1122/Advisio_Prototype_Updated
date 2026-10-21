# Advisio local demo environment

This environment is intentionally isolated from `advisio_local`, integration tests, staging, deployed services, and Google Drive. Every lifecycle command validates both the configured URL and the live PostgreSQL identity before reading or writing fixture data.

## Target

- Docker service: `postgres-demo`
- Container: `advisio-postgres-demo`
- Host: `127.0.0.1`
- Port: `5435`
- Database/user: `advisio_demo_local`
- PostgreSQL application name: `advisio-demo-local`
- Dataset marker: `ADVISIO-DEMO-LOCAL-V1`
- Storage provider: `LOCAL` under `apps/api/uploads/local/`

The demo environment explicitly requires all Google credentials to be blank. It never reads or updates the normal `.env`, Render, Vercel, staging, or the existing Google Drive connection. Its API uses `127.0.0.1:5055`, avoiding the normal local API port.

## First-time setup

From the repository root in PowerShell:

```powershell
Copy-Item .env.demo.example .env.demo.local
docker compose --profile demo up -d postgres-demo
npm run demo:local:init
```

`demo:local:init` generates `.demo-local/credentials.json` once, applies committed Prisma migrations to only the verified demo database, seeds institutional reference data and the exact marked fixture, and verifies the result.

Start Advisio against the demo database:

```powershell
npm run dev:demo
```

Open <http://localhost:3000>. The dedicated demo API runs at <http://127.0.0.1:5055>.
`dev:demo` requires port 3000 instead of silently choosing another port. Stop any normal dev server already using port 3000 before starting it.

## Credentials and role switching

Open the private credential file locally:

```powershell
notepad .demo-local\credentials.json
```

Passwords are unique per account and are never printed, bundled into the browser, or committed. Sign out in Advisio, select another account from the file, and sign in through the normal email/password form. The primary role accounts use these keys:

- `role:student`
- `role:adviser`
- `role:professor`
- `role:panelist`
- `role:dean`
- `role:reb`
- `role:vpaa`
- `role:system-admin`

The file also contains two additional panelists, one active researcher for every verified degree program, and pending onboarding-review accounts for BSIT, BSTM, and BSHM.

## Verification, reset, and cleanup

```powershell
npm run demo:local:verify
npm run demo:local:verify-api # while npm run dev:demo is running
npm run demo:local:reset
npm run demo:local:cleanup
```

- `verify` checks the exact live target, bcrypt passwords, roles, researcher profiles, 20-program coverage, milestones, consultations, local document bytes/checksums, reviews, defense invitations, and evaluation states.
- `verify-api` signs in every active account through the real API, confirms role permissions, rejects the three pending accounts, and checks an administrator-only route without printing passwords.
- `reset` removes only exact marked fixture roots and files, then recreates and verifies them with the same private credentials.
- `cleanup` removes only exact marked fixture roots and files. It preserves migrations, institutional roles, colleges, programs, the academic year, unrelated records, the Docker database, and its volume.

None of these commands uses `prisma migrate reset`, `prisma db push --force-reset`, `DROP DATABASE`, volume deletion, broad user-prefix deletion, or Google Drive cleanup.

To stop the demo database without deleting its volume:

```powershell
docker compose --profile demo stop postgres-demo
```

## Fixture coverage

The seed includes three fictional BSIT, BSTM, and BSHM projects with seven-stage workflows, task submissions, revision attempts, adviser assignments/reviews/comments, completed and scheduled consultations, defense events, panel invitations, manuscript-review states, and draft/submitted/locked evaluations.

Seeded PDFs are ordinary mutable local fixture files. Their `storageProvider` is `LOCAL`, all Google Drive IDs are null, and no document version is marked immutable.

The active program accounts exercise all 20 verified program assignments and their existing themes. System Administrator always uses Default Advisio branding. The three onboarding records include program-relevant stored interests for approval-queue testing, but those records are not evidence that the public onboarding selector is dynamically program-aware.
