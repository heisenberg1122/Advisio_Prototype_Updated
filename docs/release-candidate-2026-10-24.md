# Advisio release candidate readiness — 2026-10-24

This document is the approval gate for synchronizing `main` to GitHub and preparing the staging deployment. It records local evidence only. It does not authorize a commit, push, database migration, Render deployment, Vercel deployment, or Google integration change.

## Release scope

Advisio supports eight institutional roles through four role portal families:

| Institutional role | Portal | Verified responsibility |
| --- | --- | --- |
| Researcher | `/student/*` | Registration and onboarding, group and adviser requests, tasks, milestones, documents, consultations, defense status, Inbox, and Messages |
| Adviser | `/adviser/*` | My Advisees, adviser requests, manuscript review and endorsement, consultations, milestones, official copies, Inbox, and Messages |
| Research Coordinator | `/professor/*` | Workflow authoring, participant and project monitoring, submissions, review packets, defense scheduling, panel assignments, and result release |
| Panelist | `/panelist/*` | Published manuscript review, private annotations, PDF or rubric evaluation, defense participation, recommendations, and results |
| Dean / RPO | `/admin/*` | College-scoped oversight, adviser capacity, student status, academic review, signatures, official copies, and defense approvals |
| REB | `/admin/*` | Ethics manuscript review, review calendar, institutional correspondence, and notifications without Dean-management controls |
| VPAA | `/admin/*` | Institution-wide research oversight, academic approvals, official copies, and reporting without college-management controls in the dashboard |
| System Administrator | `/system-admin/*` | Accounts, colleges, programs, permissions, configuration, integrations, audit logs, backups, and institution-wide administration |

The verified lifecycle includes:

1. Registration, verification, pending-account rejection, first-login setup, and researcher onboarding.
2. Research group creation, membership, adviser discovery, requests, assignment, capacity, and Adviser **My Advisees**.
3. Project workspaces, tasks, relative milestones, submission requirements, consultations, calendars, and group files.
4. Versioned documents, immutable signed versions, manuscript review, revision requests, approval, and audit history.
5. Gmail-inspired Inbox folders, drafts, threaded replies, attachments, separate project Messages, and role-scoped notifications.
6. Adviser, coordinator, Dean/RPO, REB, and VPAA review or approval boundaries.
7. Online, on-site, and hybrid defense scheduling with invitations, availability checks, review packets, and live sessions.
8. Panelist manuscript annotations, private notes, rubric or PDF evaluation, recommendation preview, signature, and final locking.
9. Official result release, role-scoped Official Copies, immutable feedback publications, and document archiving.
10. College/program scope, institutional scope, role permissions, account status enforcement, local storage isolation, responsive layouts, and light/dark themes.

## Phase 4 evidence carried into this candidate

- Branch baseline: `main` at `f3f2ed82beb27ab0c77932f2f8b6583833175d65`.
- TypeScript: 9 of 9 tasks passed.
- Lint: passed.
- General automated tests: 344 passed. The 21 database-gated cases skipped by the general command were run separately.
- Guarded PostgreSQL integration: 21 of 21 passed; fixture teardown was verified clean.
- Production build: 6 of 6 tasks passed.
- Browser audit: 89 public/authenticated route and viewport checks across all eight roles, with zero fatal failures, client errors, console warnings, stuck loading states, or horizontal-overflow failures.
- Demo preservation: 33 accounts, 3 projects, 3 documents, 4 versions, and 3 defenses remained intact.

The browser report and screenshots are deliberately ignored under `.demo-local/phase4-browser/` and must not be committed.

## Repository and secrets audit

- The checked-out branch is `main`.
- Local `HEAD`, the local `origin/main` reference, and GitHub's read-only `refs/heads/main` response all resolve to `f3f2ed82beb27ab0c77932f2f8b6583833175d65` as of this audit.
- There are no staged files. The only untracked path intended for release is this release-candidate document.
- Runtime `.env`, `.env.demo.local`, `packages/database/.env`, `.demo-local/`, `.panel-demo/`, upload bytes, generated PDFs, logs, PostgreSQL dumps, and `backup_*.sql` are ignored.
- Only environment templates are tracked. Their database URLs are placeholders or local/test examples; Compose uses environment interpolation rather than committed production values.
- A tracked-file scan found no private-key markers or common AWS, Google, GitHub, Slack, or JWT token formats. Dedicated `gitleaks`/`trufflehog` binaries are not installed, so GitHub secret scanning should remain enabled as defense in depth.
- `npm audit --omit=dev --audit-level=high` reported zero production dependency vulnerabilities on 2026-10-24.
- CI contains explicit test-only PostgreSQL and JWT values for an ephemeral GitHub Actions service. They are not staging or production credentials.

## Intended source and documentation changes

The Phase 4 implementation consists of exactly these four source files:

- `apps/api/src/routes/dean.routes.ts`
- `apps/web/src/app/admin/dashboard/page.tsx`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/student/defense/page.tsx`

Those changes provide institution-wide VPAA dashboard reads, a dedicated REB workspace/navigation model, role-appropriate admin navigation and management controls, and suppression of unpublished defense-packet requests from the researcher UI.

This Phase 5 documentation pass intentionally adds or updates:

- `README.md`
- `apps/web/README.md`
- `LOCAL_DEMO.md`
- `DEPLOYMENT.md`
- `PDF_EVALUATIONS.md`
- `MANUSCRIPT_ANNOTATIONS.md`
- `docs/release-candidate-2026-10-24.md`

Before staging any commit, compare `git status --short --untracked-files=all` with this list. Stop if any other path appears.

## Institutional data and theme reconciliation

The database correctly contains nine active college/school records: COA, CEA, CHTM, CNP, SAS, SBPA, SOE, SHS, and CIT. Eight of those units currently map to verified higher-education theme groups: COA, CEA, CHTM, CNP, SAS, SBPA, SOE, and CIT. SHS is retained as an institutional reference record but has no verified degree-program theme mapping, so it falls back to the default Advisio theme. This is why the database count is nine while the verified institutional theme-group count is eight. Program-level theme resolution covers the 20 verified degree offerings.

## Migration readiness

Migration order is fixed by the directory timestamps:

1. `20261022010000_mail_workspace_state`
2. `20261023010000_pdf_evaluation_workspace`
3. `20261023020000_packet_manuscript_annotations`

The two PDF migrations are additive:

- `pdf_evaluation_workspace` adds two defaulted columns to `defense_packets`, a new `pdf_evaluations` table, indexes, foreign keys, validation constraints, and an update guard for locked evaluations.
- `packet_manuscript_annotations` adds private review and immutable publication tables, indexes, foreign keys, and an update guard for published feedback.

They depend on existing `defense_packets`, `defense_sessions`, `users`, `document_versions`, and `EvaluationStatus` objects. The annotation migration does not directly reference the PDF-evaluation table, but the committed order must still be preserved and the release code expects both schemas.

Application compatibility:

- Existing rows are not deleted or rewritten.
- Existing manuscript and evaluation records are not converted.
- Old application code can continue operating after the additive migrations.
- New application code must not start before all pending migrations finish.
- The `defense_packets` alteration requires a PostgreSQL table lock. PostgreSQL 16 normally handles constant defaults without a full table rewrite, but staging should still measure lock duration and run during a controlled window.
- New PDF bytes are stored in PostgreSQL and can increase database size; confirm storage headroom before staging UAT.

Observed local status on 2026-10-24:

| Database | Status |
| --- | --- |
| `advisio_demo_local` | Inbox state and both PDF migrations applied; recorded checksums match the repository |
| `advisio_test` | Inbox state and both PDF migrations applied; recorded checksums match the repository |
| `advisio_local` | Latest applied migration is `20261018010000_account_recovery_security`; Inbox state and both PDF migrations are pending |
| Staging | Unknown; must be checked read-only before deployment |
| Production | Unknown; must be checked read-only before deployment |

Do not use `prisma db push`, `prisma migrate reset`, manual `DROP`, or a seed that creates demo records. For staging, use the direct database URL and run:

```bash
npx prisma migrate status --schema=packages/database/prisma/schema.prisma
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
npx prisma migrate status --schema=packages/database/prisma/schema.prisma
```

Run `migrate deploy` only after a verified staging snapshot/backup, on the exact reviewed commit, with the API deployment held. Confirm all three migrations when the target is behind at the same point as `advisio_local`.

Rollback should be application-first. Because the migrations are additive, redeploy the previous API/frontend while leaving the new schema in place. Do not manually drop the new columns, tables, triggers, or functions after they contain data. If an irreversible schema/data problem requires restoration, stop writes, preserve any legitimate post-snapshot records, and use the provider's verified pre-migration snapshot under an approved recovery procedure.

## Environment preflight

Verify names and scope without printing values.

Render/API staging requires:

- `NODE_ENV=production`
- `DATABASE_URL` for runtime access and `DIRECT_URL` for migrations
- independent staging `JWT_SECRET`, `AUTH_SECRET`, and `INTEGRATION_ENCRYPTION_KEY`
- `WEB_URL` and exact `CORS_ORIGIN` for the staging Vercel origin
- `STORAGE_PROVIDER`, with `ALLOW_LOCAL_STORAGE_FALLBACK=false`
- dedicated staging Google OAuth/Drive/Calendar values when those integrations are enabled
- `RESEND_API_KEY` and `EMAIL_FROM`, or the approved SMTP variables
- all demo, theme-demo, and self-signup flags set to `false`

Vercel staging requires only public browser configuration:

- `VITE_API_URL` pointing to the staging Render API origin without `/api`
- `VITE_GOOGLE_SIGN_IN_CLIENT_ID`
- `VITE_GOOGLE_SIGN_IN_ALLOW_SELF_SIGNUP=false`
- `VITE_ENABLE_DEMO_ACCOUNTS=false`

Never place database URLs, private Google credentials, email keys, JWT secrets, or integration encryption keys in `VITE_*` variables.

## Safe GitHub synchronization

Before pushing `main`, confirm that Git-connected Render/Vercel services will not automatically deploy the push to production. Pause automatic production deployment or require an environment approval if necessary.

After explicit approval:

```powershell
git fetch origin
git status --short --branch --untracked-files=all
git rev-list --left-right --count HEAD...origin/main
git diff --check
git add -- apps/api/src/routes/dean.routes.ts apps/web/src/app/admin/dashboard/page.tsx apps/web/src/app/admin/layout.tsx apps/web/src/app/student/defense/page.tsx README.md apps/web/README.md LOCAL_DEMO.md DEPLOYMENT.md PDF_EVALUATIONS.md MANUSCRIPT_ANNOTATIONS.md docs/release-candidate-2026-10-24.md
git diff --cached --check
git diff --cached --name-status
git commit -m "fix: prepare cross-role integration for staging"
git push origin main
```

If `origin/main` advances, stop before staging or committing. Review the incoming commits and preserve the local patch; do not use force-push, hard reset, or an unreviewed pull.

## Controlled staging deployment sequence

1. Record the approved commit SHA and confirm GitHub CI passes for that exact commit.
2. Verify Render and Vercel targets, automatic-deploy behavior, owners, project names, domains, and environment scopes.
3. Create and verify a staging PostgreSQL snapshot or provider backup; record its identifier and restoration steps.
4. Hold the staging API deployment, run read-only `prisma migrate status`, then apply committed migrations with `migrate deploy` through `DIRECT_URL`.
5. Re-run migration status and inspect application/database logs before allowing the new API image to start.
6. Deploy the Render staging API from the approved SHA and verify `/api/health`, database connectivity, CORS rejection, and authenticated role boundaries.
7. Build and deploy the Vercel staging frontend from the same SHA. Verify `VITE_API_URL` and OAuth client scope before testing.
8. Smoke-test email delivery, Google Sign-In, Drive upload/download in the dedicated staging folder, and Calendar creation/callbacks. Do not use production folders or recipients.
9. Run cross-role UAT for all eight roles, including onboarding, My Advisees, workflows, documents, Inbox/Messages, all defense modes, panel evaluation, result release, Official Copies, responsive layouts, and light/dark themes.
10. Review Render/Vercel/database logs for errors or sensitive output, record approval, and keep production promotion as a separate decision.

## Release blockers and approval gate

The code passes the local release checks. These external facts remain blockers to an actual staging deployment:

- Staging migration status and backup restorability have not been verified.
- Current Render/Vercel auto-deploy settings and exact staging targets have not been verified locally.
- Staging environment-variable presence and scope have not been verified.
- Email, Google Calendar, Google Drive, and cross-browser staging smoke tests remain pending.

Stop here until the repository owner approves the explicit file list and authorizes the commit and push. Deployment requires a separate approval after GitHub CI and staging preflight succeed.
