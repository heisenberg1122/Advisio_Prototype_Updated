# Audit fixes: project requests, office roles, notification inboxes

The implementation addresses the three source findings reviewed on October 26,
2026. These changes have not been applied to a live database or deployed.

## Resulting behavior

- Adviser request lists and pending-state checks are scoped to the selected
  project. A different project's pending request cannot block the request UI.
- `DEAN` replaces institutional role `RPO`. Dean access remains college scoped.
  VPAA and REB are removed from institutional role definitions, assignment
  validation, dashboard eligibility, route guards, permission matrices, and seeds.
  Historical review/certificate type identifiers remain readable; they do not
  grant a retired institutional role.
- Notification reads, unread counts, individual mutations and bulk reading
  require an explicit authorized inbox. They also enforce recipient ownership.
  A role being removed immediately makes its inbox unavailable on subsequent API
  requests because authentication reloads current database assignments.
- Dashboard deliveries, shared Account notices and Earlier notifications have
  separate inboxes. The bell shows dashboard updates and shared Account notices;
  its bulk action only reads dashboard updates. The full page provides all three
  sections. Counts come from the server independently of the 50-row preview.
- Queries are keyed by account, inbox and role assignments, and fetches consume an
  abort signal. Dashboard switching cannot reuse another account/inbox's feed.
- Every new notification requires an explicit stored audience. Generic project
  notifications resolve audiences from actual project membership and workflow
  ownership; review invitations use their exact reviewer assignment. Separate
  responsibilities receive separate deduplication keys and read states.
- Historical rows are classified only when a stored destination or exact adviser
  or reviewer assignment establishes their audience. Unresolved rows remain in
  Earlier notifications with their original read/archive state.

## Producer inventory

| Producer | Audience |
| --- | --- |
| Adviser requests and cancellations | Adviser |
| Adviser decisions delivered to groups | Researcher |
| Adviser capacity updates | Adviser |
| Adviser role/access changes | Account |
| Dean signature requests | Dean |
| Dean signature responses to requesting professors | Coordinator |
| Personal mail and thread notifications | Account |
| Defense invitations/reschedules | Panelist or Adviser according to invitation role; observers receive Account notices |
| Defense results and schedules delivered to groups | Researcher |
| Defense participant responses | Owning Coordinator or scheduling Dean; removed responsibilities fall back to Account |
| Project joins/title changes | Researcher |
| Adviser withdrawal | Actual group responsibility and college coordinator inboxes |
| Workflow resources/deadlines | Researcher |
| Workflow access revocation | Account |
| Workflow invitations/access requests | Researcher or Coordinator according to the action's destination |
| Reviewer assignments | Exact reviewer assignment responsibility |
| Generic manuscript/task/milestone updates | Actual project membership and owning coordinator |
| Official copy availability/signature/revocation | Researcher |
| Institutional and college announcements | Account |
| System administrator-created notifications | Explicit audience, checked against the recipient's current assignments |

## Database rollout

Apply the two new Prisma migrations before starting the updated application.
Coordinate backend and frontend deployment because the new API requires an inbox
and the new Prisma client expects `DEAN` and notification audience metadata.
Do not apply this enum change while old application instances are serving requests.

The role migration renames RPO in place, preserving role IDs, existing Dean
assignments, workflow references and permission grants. It records removed
VPAA/REB assignments and office configuration in `audit_logs` before removing
their role rows. Accounts and academic documents are retained. Accounts with
only retired roles will need an explicit supported role assignment to use a
dashboard; they are not automatically promoted to another role.

Before rollout, run this read-only preflight against the intended database:

```sql
SELECT s.id, s.name, w.name AS workflow, r.name AS responsible_role
FROM workflow_stages s
JOIN workflows w ON w.id = s.workflow_id
JOIN roles r ON r.id = s.responsible_role_id
WHERE r.name::text IN ('REB', 'VPAA');
```

If it returns rows, have the workflow owner explicitly reassign those stages to
the appropriate supported role using the current application before migrating.
The migration deliberately aborts without changing anything when these references
exist. It does not remove approval requirements or automatically transfer ethics
or institutional approval authority. Historical REB review types are retained.

Also inspect active reviewer assignments held through the retired offices:

```sql
SELECT a.id, a.review_type, a.reviewer_id, r.name AS reviewer_role
FROM reviewer_assignments a
JOIN user_roles u ON u.user_id = a.reviewer_id
JOIN roles r ON r.id = u.role_id
WHERE a.status::text = 'ACTIVE' AND r.name::text IN ('REB', 'VPAA');
```

The migration stops if an active review would lose its required institutional
responsibility. Resolve those assignments through an explicit academic decision
before rollout; completing, reassigning or revoking a review must follow the
institution's normal process. The migration never waives a required review.

The notification migration preserves notification IDs and read/archive timestamps.
After backfilling reliable audiences it drops the temporary audience default,
requiring new deliveries to choose an inbox explicitly.

Database-backed migration/integration validation requires an isolated PostgreSQL
database. Never use a production database for those tests.

## Local verification

- Source Vitest suites: 472 passed, 0 failed, 31 database integration tests skipped.
  The HTTP smoke tests passed with access to their temporary localhost servers.
- Auth package build, API/web type checks, database TypeScript check, web ESLint,
  API build and web production build passed. Vite reported a bundle-size warning.
- Prisma schema validation and generation passed.
- The standalone Node document-integrity test passed.
- `git diff --check` passed.

Docker's local engine was not running, so the migrations and database integration
tests were not executed against an isolated PostgreSQL instance. Authenticated
browser workflows were not exercised. No migrations were applied to a live
database, and no commit was pushed or deployed.
