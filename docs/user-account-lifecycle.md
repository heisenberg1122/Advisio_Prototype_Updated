# User account details, recovery, suspension, and archiving

System Administration → User Management provides **Suspend** for accounts that
are not already suspended. A 10–2000 character reason is required and audited.
Suspension preserves academic records, blocks authenticated requests, and changes
the session version. Restoring an account through **Verify & restore** requires
identity verification and a verification note. Old tokens remain invalid after
restoration. Administrators cannot suspend themselves or the last active system
administrator.

**Archive** replaces Delete in User Management. It sets the existing `INACTIVE`
status and requires a 10-2000 character reason. Archiving is limited to System
Administrators with user and role management permissions. The account is removed
from **Current users** and shown in **Archived users**; existing inactive accounts
also appear there. Search and role filters work in both views.

Archived accounts cannot sign in or make authenticated requests. Changing status
increments the session version. **Verify & restore** requires identity verification
and a verification note before returning the account to `ACTIVE`; previous tokens
remain invalid. Self-archiving and archiving the last active System Administrator
are blocked. Archived accounts must be restored before another status can be set.

Archiving updates only account status/session version and writes an audit entry
with the administrator, timestamp, reason, and `ARCHIVE` action metadata. Restoration
is also audited with `RESTORE` metadata. All profiles, roles, memberships, research
projects, shared workspaces, submissions, reviews, messages, academic history, and
stored files remain intact. Archiving does not create file-cleanup jobs.

`POST /api/users/:id/archive` accepts `{ reason }`. The old
`DELETE /api/users/:id` returns HTTP 410 without deleting or queuing any data,
including when called by an outdated client. Internal permanent-deletion services
and the existing cleanup queue remain for separately governed maintenance; User
Management can no longer invoke permanent deletion. Previously queued cleanup jobs
are not cancelled by archiving.

## Deployment

Deploy the API and web app together. Apply the checked-in migrations with
`prisma migrate deploy --schema=packages/database/prisma/schema.prisma` and regenerate
the Prisma client during the build. The API start script already applies migrations.
The file-cleanup worker starts with the API server.

## Validation

The isolated PostgreSQL integration suite covers API permissions, suspension,
session invalidation, verified restoration, deletion previews, stale confirmation,
archive preservation/restoration, blocked legacy deletion, full transactional rollback, restrictive archive records, legacy identifiers,
shared-work preservation, and storage cleanup retries. File-worker tests cover
Google Drive, local, and Supabase dispatch and multi-instance job leasing.
