# User account details, recovery, suspension, and permanent deletion

System Administration → User Management → **View details** shows account identity,
college/program assignments, roles, sign-in methods, and account activity. The
**Registration details** tab includes all saved researcher and faculty profile
fields, including Google onboarding details. Both detail retrieval and admin
password recovery require an authenticated System Administrator. Credential hashes,
Google subject identifiers, and reset tokens are never returned to the browser.

For active accounts with a local password, **Reset password** requires the
administrator to confirm before sending an email to the account's saved address.
The email explains the administrator request and provides a single-use link that
expires in 30 minutes. The current password remains valid until the user saves a
new one; completing the reset invalidates existing sessions. Google-only accounts
manage their passwords through Google. A linked Google account with a local
password can still reset its local password.

Admin requests are audited without storing reset links or passwords in audit data.
Requests are rate limited and limited to one email per minute per account. Delivery
failures are reported to the administrator and clear the reserved token. Recovery
requires a configured Gmail or Resend provider and a valid `WEB_URL`; production
links require HTTPS. This feature reuses the existing reset-password page and
database fields and requires no new migration.

System Administration → User Management provides **Suspend** for accounts that
are not already suspended. A 10–2000 character reason is required and audited.
Suspension preserves academic records, blocks authenticated requests, and changes
the session version. Restoring an account through **Verify & restore** requires
identity verification and a verification note. Old tokens remain invalid after
restoration. Administrators cannot suspend themselves or the last active system
administrator.

**Delete** loads an impact preview before enabling permanent deletion. The
administrator must acknowledge that impact and type the exact confirmation phrase.
Only system administrators with user and role management permissions can delete.
Self-deletion and deletion of the last active system administrator are blocked.

Deletion removes the account, its profiles, memberships, authored/uploaded records,
legacy chat records, and dependent records. Projects and workspaces created by the
user are included; dependent shared work may therefore be removed. Other user
accounts and unrelated projects remain. Stored file bytes still referenced by a
surviving record are preserved. The dialog lists counts and the number of other
users involved in affected memberships. One administrator deletion audit entry is
retained without copying the deleted person's name or email.

The preview fingerprint must still match at deletion time. Database deletion and
file-cleanup jobs commit together in a serializable transaction. Errors roll the
transaction back; no foreign-key constraints are disabled or changed. Surviving
documents are repointed to their newest remaining version. Empty documents are
included in the deletion plan.

Managed Google Drive, local, and Supabase files are removed by a durable cleanup
queue. The API reports how many files were queued rather than claiming that
external storage cleanup has completed. Failed jobs retry automatically while the
API is running, including after restart. External source documents and arbitrary
URLs are not followed or deleted. Operators can inspect `file_deletion_jobs` for
pending attempts and the last storage error.

## Deployment

Deploy the API and web app together. Apply the checked-in migrations with
`prisma migrate deploy --schema=packages/database/prisma/schema.prisma` and regenerate
the Prisma client during the build. The API start script already applies migrations.
The file-cleanup worker starts with the API server.

## Validation

The isolated PostgreSQL integration suite covers API permissions, suspension,
session invalidation, verified restoration, deletion previews, stale confirmation,
full transactional rollback, restrictive archive records, legacy identifiers,
shared-work preservation, and storage cleanup retries. File-worker tests cover
Google Drive, local, and Supabase dispatch and multi-instance job leasing.
