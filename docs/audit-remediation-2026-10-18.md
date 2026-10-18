# Advisio audit remediation — October 18, 2026

The implementation addresses the 22 findings from the October 18 audit. Changes remain in the working tree for review; nothing was committed, published, or deployed to a remote service.

## Changes by finding

| Audit # | Result |
|---|---|
| 1 | Public registrations always remain pending. Only the explicitly selected eligible public role is assigned, atomically with account creation. Email substrings never grant privileges. |
| 2 | Faculty assignment validates caller authority, college/program, active target roles, conflicts with researcher membership, and adviser capacity. Researchers use invitations and leadership transfer. Eligible reassignment restores active membership and is audited. |
| 3 | Certificate issuance checks the certificate-specific issuer role, project scope, conflicts of interest, and completion, ethics approval, or released-defense prerequisites. Issuance is audited and verification identifiers use cryptographic randomness. |
| 4 | Project detail responses serialize nested document file sizes safely, including values beyond JavaScript's safe integer range. |
| 5 | Researcher registration resolves an active joined workflow within the assigned program. Ambiguous enrollment requires selection. The UI provides a selector, and project creation validates the workspace leader again inside its transaction. |
| 6 | The professor permission matrix grants scoped workflow creation without granting account administration. |
| 7 | Account activation requires explicit identity verification. Status, role, and deletion paths share an administrator-set transaction lock; the last active administrator is protected. Activation/status transitions are audited. |
| 8 | Production rejects missing, short, or example JWT secrets. Unconfigured development uses an unpredictable ephemeral key. Synthetic demo identity bypasses were removed from authentication. Recovery invalidates old sessions, and OAuth-purpose tokens cannot be used as sessions. |
| 9 | Google Calendar failures and pending conference creation never generate simulated meeting codes or event IDs. Consultations can remain saved without a meeting URL and expose a warning. |
| 10 | Grades load released, completed-session evaluations for active project researchers. Unreleased scores remain private. The screen labels its normalized result as a released panel average; it does not invent an institutional GPA conversion. |
| 11 | Password recovery has real request/reset endpoints, hashed expiring single-use tokens, email-provider delivery, bounded attempts, a reset screen, and session invalidation. Unconfigured delivery reports unavailable instead of claiming an email was sent. |
| 12 | The consultations page maps actual API statuses and fields, shows completed history, selects the nearest eligible future meeting, and scopes its query to the selected project. Errors are visible. |
| 13 | The booking button opens the existing project-scoped composer. Time entry uses a time input and explicit Manila timezone parsing; failed requests preserve the form values. |
| 14 | Active project membership is the authority for project access. Leaving/removal revokes project membership and retires unused workspace membership. Leadership transfer supports repeated transfers and synchronizes workspace leadership. Workspace-only invitations cannot bypass an existing project's invitation rules; workspace joins and project creation share a transaction lock. |
| 15 | Document version preview/download uses an authenticated provider-neutral endpoint. Signing and archive reads support private Supabase objects. New Supabase uploads require a private bucket and do not expose public URLs. Official artifacts use the selected provider and compensate failed storage transactions. |
| 16 | Revision allocation is serialized per document, checks the current version, and cleans up an uncommitted object on failure. Two simultaneous successful uploads receive distinct version numbers and leave only one active version. |
| 17 | Async mail handlers forward rejected promises to centralized Express error handling. Storage/validation errors receive bounded responses, and internal server errors are not disclosed through that handler. |
| 18 | Consultation date and time use Asia/Manila consistently; the frontend also formats raw timestamps in that timezone. |
| 19 | Temporary profile/API failures preserve the session token and expose a retry screen. Definitive authentication failures clear it. Profile hydration guards against stale responses. |
| 20 | CORS accepts exact configured origins. Implicit loopback allowances apply only to development without an explicit allowlist. Excluded origins receive a rejection. |
| 21 | Personal calendar entries require ownership/direct audience membership even for institution-wide administrators. Scope visibility no longer exposes personal entries, and administrative edit authority cannot override another person's personal entry. |
| 22 | Administrative metrics require user-management permission before institutional counts are queried. |

## Database and deployment

- Migration: `20261018010000_account_recovery_security`. Adds session version and password-reset hash/expiry fields. It does not alter existing roles, passwords, approvals, or membership records.
- The migration was validated against the dedicated `advisio_test` database, then applied only to the verified local `advisio_local` database on port 5433 after a complete local backup.
- Record counts before and after local application matched: 31 users, 4 research projects, and 26 document versions.
- The backup is retained in this chat's local artifact directory. It contains private database contents and is not part of the repository.
- Historical account/role changes and bulk data reconciliation were not performed. Existing privileged accounts should be reviewed separately if this prototype was previously accessible to untrusted users.
- Docker uses Node 22 for the frontend and builds the email package for the API. Email package imports work under plain Node ESM.
- `.dockerignore` excludes environment files, uploads, dependency directories, and generated artifacts from build context.
- Production Compose requires an explicit JWT secret, forwards provider configuration, disables local storage fallback, and respects configured PostgreSQL healthcheck credentials.

## Configuration still required

At verification time, recovery email and Google Calendar credentials were not configured in the local environment. The code handles this explicitly; no real email or external calendar event was sent during verification.

- Recovery email needs `RESEND_API_KEY`, a suitable `EMAIL_FROM`, and `WEB_URL`. Production recovery requires HTTPS. The provider must accept the sending domain.
- Google Meet creation needs working Calendar OAuth or appropriate Workspace credentials. A configured Drive connection does not by itself configure Calendar.
- Supabase use needs backend storage credentials and a private bucket. Existing bucket policies were not changed automatically.
- Production needs a unique JWT secret of at least 32 characters. Preserve an appropriate independent integration encryption key when rotating authentication secrets to avoid losing access to previously encrypted provider tokens.

## Verification

Regression checks cover privilege registration, scoped roster changes, certificate rejection, administrator protection, JSON serialization, workflow selection, released-grade privacy, token replay/session invalidation, calendar privacy, storage-provider behavior, and consultation contracts.

The guarded database runner verifies database identity, applies migrations only to the isolated target, runs sequentially, and verifies fixture teardown. New database checks exercise concurrent revisions, repeated leadership transfer, membership revocation, private calendar reads, and recovery replay against PostgreSQL.

Final verification results:

- Complete source suite: **268 passed**. The 15 database-dependent tests are intentionally skipped in that command and run separately.
- Dedicated PostgreSQL integration suites: **15 passed**, with verified fixture teardown.
- Type checking: passed for all configured workspaces.
- Configured lint checks: passed (web workspace).
- Fresh production build: passed, six tasks with no cache hits.
- API and frontend Docker images: built successfully. Network-isolated production API startup and Nginx configuration checks passed; no environment file was embedded in the API image.
- Browser smoke checks: researcher, adviser, professor, panelist, dean, and system-administrator login/dashboard rendering passed using six disposable accounts in the isolated database. Those accounts and their academic fixture were removed afterward.
- Recovery browser checks: missing-token handling and unavailable email delivery displayed correctly.
- Built API health check: HTTP 200 with a connected database.
- Diff whitespace validation: passed.

Temporary browser-test servers and the audit-started test container were stopped. Local Docker images and the test database volume remain available for reuse.

Live provider operations, complete academic workflows through every portal, production secret rotation, historical data repairs, and backup restoration were not exercised. Existing process-local conferencing presence remains transient; scaling that service is a separate architectural change.
