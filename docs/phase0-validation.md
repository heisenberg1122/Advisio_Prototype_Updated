# Phase 0 validation baseline

Validated on 2026-10-27 (Asia/Manila), on
`refactor/cohort-driven-research-flow`, based on commit
`eba09285acd91e7c9385bc0b5f547d98e6b2f9b6`.

This phase changes validation configuration and documentation only. Application
source, database schema, migrations, authorization rules, and test assertions
are unchanged.

## Corrections

- Turbo's strict environment filter now passes through `COMSPEC`, `PATHEXT`,
  and `LOCALAPPDATA`. These Windows process/runtime variables allow nested npm
  scripts to execute normally without switching to loose environment mode.
  The installed [Turbo 2.9.18 built-in allowlist](https://github.com/vercel/turborepo/blob/v2.9.18/crates/turborepo-env/src/lib.rs)
  omits these variables.
- The web test command runs from its workspace root, like the other workspace
  test commands. It runs all 27 tracked web test files and uses the existing
  Vite configuration. It no longer discovers test copies in ignored `.local`
  backup directories. Backup files and existing tests were not deleted.
- `npm run test:integration:local` loads the explicitly selected, ignored
  `.env.integration.local` file and invokes the existing integration runner.
  `.env.integration.example` documents the required test-only settings.
  The original `npm run test:integration` command and all database guards are
  unchanged.

## Local results

| Check | Result |
| --- | --- |
| `npm run type-check` | Passed: 9 Turbo tasks |
| `npm run build` | Passed: 6 Turbo tasks |
| `npm run lint` | Passed: the repository's web ESLint task |
| `npm test` | Passed: 667 tests; the 49 opt-in database tests were skipped here and run separately below |
| `npm run test:integration` with isolated test environment loaded | Passed: all 49 tests in 11 suites |

The workspace unit totals are API 350, web 229, auth 32, email 16, and
validations 40. These are runner-reported test executions; the existing auth
and validations configurations also discover emitted test copies in `dist`.

The build retains its existing warning about a bundle larger than 500 kB.
This warning does not fail the build; no application bundling or warning
thresholds were changed.

The integration run used PostgreSQL 16.15 on `127.0.0.1:5434`, database
`advisio_test`, user `advisio_test`, schema `public`, and application name
`advisio-integration-tests`. All 75 existing migrations applied successfully
to the new isolated database. The runner verified database identity before
migrations and confirmed no known fixture roots remained after teardown.

No development or production database was migrated, reset, or seeded.

## Repeating validation

From the repository root:

```powershell
npm run type-check
npm run build
npm run lint
npm test
```

For database tests, first start the isolated test database. Docker setup is
documented in the README. This workstation also has a separate native test
cluster under `.local/phase0-validation/postgres-data` and PostgreSQL binaries
under `.local/pgsql/bin`. Both directories are ignored local resources, not
dependencies supplied by a Git checkout.

On this workstation, start that test cluster with:

```powershell
& '.\.local\pgsql\bin\pg_ctl.exe' `
  -D '.local/phase0-validation/postgres-data' `
  -l '.local/phase0-validation/postgres.log' `
  -o '-h 127.0.0.1 -p 5434' -w start
```

Its random SCRAM password and test-only JWT secret are stored in the ignored
`.env.integration.local`; do not copy them into the application `.env` or
commit them. A fresh checkout must provision its own isolated database and
copy `.env.integration.example` to `.env.integration.local` with matching
test-only credentials. The local test command does not provision or start
PostgreSQL automatically.

Then run:

```powershell
npm run test:integration:local
```

Stop only this test cluster after validation:

```powershell
& '.\.local\pgsql\bin\pg_ctl.exe' `
  -D '.local/phase0-validation/postgres-data' -w stop
```

The cluster was stopped after Phase 0 verification; its schema and local
configuration are retained for the next validation run.

## Remote status

The results above are local validation, not GitHub Actions or deployment
results. The existing workflow triggers on pushes to `main` or `develop`,
and pull requests targeting either branch. A push to the refactor branch alone
does not trigger that workflow. No CI trigger or deployment behavior was changed.
