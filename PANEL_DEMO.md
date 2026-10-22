# Panel demonstration dataset

`db:panel-demo` creates a deliberately narrow staging-only dataset. It never runs with the deployed API's environment and it does not change Google Drive, Vercel, Render settings, reference themes, or the existing bootstrap administrator.

## What it creates

- Seven fictional accounts: one student, adviser, research coordinator, three panelists, and one RPO representative.
- One fictional BSIT capstone project, its own workflow, seven milestones/tasks, project memberships, accepted adviser request, completed consultation/note, and scheduled defense/invitations.
- A submitted student onboarding profile that references the already configured active/current Academic Year.

Every created identity, workflow, research type, and project is marked with `PANEL_DEMO_RUN_ID`; account emails use `@panel-demo.invalid`.

It intentionally does **not** create a system administrator, academic year, Google Drive file, document version, submission, review, evaluation, official copy, or defense decision. That protects the document lifecycle and requires the real staging application to create files and revisions normally.

## Preconditions

Do not run this against production. Before any write, the command requires:

1. A dedicated staging database, not production and not the local development database.
2. An existing bootstrapped system administrator identified by `PANEL_DEMO_ADMIN_EMAIL`.
3. Exactly one active/current Academic Year. The command reports and refuses otherwise.
4. All eight institutional college entries plus CIT compatibility and at least 20 active programs.
5. General demo provisioning to remain disabled.

The one-time process must use `NODE_ENV=staging`; the running Render API remains `NODE_ENV=production` with all demo flags false.

## Reviewed existing staging Students

The tool does not generally permit pre-existing users. The only supported exception is an exact, private allowlist for the two separately reviewed Student records `2023001846` and `2023001847`. It is required whenever those accounts are present.

After a read-only audit has supplied their actual PostgreSQL UUIDs and current email addresses, create this Git-ignored file locally (for example `.panel-demo\advisio-staging-reviewed-users.json`). Do not commit it, do not place a database URL in it, and do not add any other user.

```json
{
  "format": "advisio-panel-demo-existing-users-v1",
  "target": {
    "databaseName": "advisio_staging",
    "host": "<exact-staging-host>",
    "schema": "public"
  },
  "users": [
    {
      "id": "<actual-UUID-for-2023001846>",
      "universityId": "2023001846",
      "email": "<actual-lowercase-email>",
      "status": "PENDING",
      "roles": ["RESEARCHER"]
    },
    {
      "id": "<actual-UUID-for-2023001847>",
      "universityId": "2023001847",
      "email": "<actual-lowercase-email>",
      "status": "PENDING",
      "roles": ["RESEARCHER"]
    }
  ]
}
```

At preflight, every listed field is compared with the live database. A missing file, an extra account, duplicate UUID, different host/database/schema, or any changed UUID, email, status, or role causes a refusal. The script only reads this file; it never changes these Students or the separate bootstrapped system administrator.

## Private credentials

Choose a new marker such as `PANEL-DEMO-2026-11-ABC12345` (the unique portion is limited to 38 characters so generated account IDs remain distinct). Generate credentials locally into a Git-ignored file:

```powershell
$env:PANEL_DEMO_RUN_ID = "PANEL-DEMO-2026-11-ABC12345"
$env:PANEL_DEMO_CREDENTIALS_FILE = ".panel-demo\panel-demo-2026-11.json"
npm run db:panel-demo -- credentials
```

The file is created once with seven unique, random passwords and is not printed, committed, or bundled. Keep it in the presentation team's private password handoff channel. Delete it after the temporary accounts have been removed.

## Approval-gated staging procedure

Run the following only after the staging database target and its Academic Year configuration have been approved. Use the exact same direct staging connection for all three URL variables, with the required application name. Do not put these settings in Render's persistent API environment.

```powershell
$panelDemoUrl = "postgresql://<staging-user>:<staging-password>@<staging-host>:5432/advisio_staging?schema=public&application_name=advisio-panel-demo"
$env:NODE_ENV = "staging"
$env:PANEL_DEMO_EXECUTION = "1"
$env:PANEL_DEMO_RUN_ID = "PANEL-DEMO-2026-11-ABC12345"
$env:PANEL_DEMO_DATABASE_NAME = "advisio_staging"
$env:PANEL_DEMO_DATABASE_HOST = "<staging-host>"
$env:PANEL_DEMO_DATABASE_URL = $panelDemoUrl
$env:DATABASE_URL = $panelDemoUrl
$env:DIRECT_URL = $panelDemoUrl
$env:PANEL_DEMO_ADMIN_EMAIL = "<existing-bootstrap-admin-email>"
$env:ALLOW_DEMO_ACCOUNT_PROVISIONING = "false"
$env:ALLOW_THEME_DEMO_ACCOUNTS = "false"
$env:PANEL_DEMO_EXISTING_USER_ALLOWLIST_FILE = ".panel-demo\advisio-staging-reviewed-users.json"
$env:PANEL_DEMO_CREDENTIALS_FILE = ".panel-demo\panel-demo-2026-11.json"
```

First run a no-write safety report:

```powershell
$env:PANEL_DEMO_DRY_RUN = "1"
npm run db:panel-demo -- preflight
npm run db:panel-demo -- seed
Remove-Item Env:PANEL_DEMO_DRY_RUN
```

Only after reviewing that output and approving the target, run:

```powershell
npm run db:panel-demo -- seed
npm run db:panel-demo -- verify
npm run db:panel-demo -- inspect
```

The guard compares `DATABASE_URL`, `DIRECT_URL`, and `PANEL_DEMO_DATABASE_URL`; validates their host, database, user, public schema, and `application_name`; queries the live PostgreSQL identity; permits only the declared bootstrap admin, the two exact reviewed Students, and the exact marked dataset; and refuses any other user, project, workflow, or research type.

## Academic Year configuration when preflight fails

The current implementation will not invent calendar dates. A staging administrator must first create the institution-approved Academic Year through the existing administrator organization screen/API with:

- Official academic-year label
- Institution-approved start and end dates
- `isActive: true`
- `isCurrent: true`

If another year is currently marked current, the administrator must intentionally designate the approved year as current. Repeating the same administrator submission is idempotent: it updates that named Academic Year in one transaction and leaves it current, rather than creating a duplicate. Then rerun `preflight`; do not bypass student onboarding or insert an arbitrary year through the panel-demo tool.

## Manual document workflow

After the core seed succeeds, use only the staging application and its authorized staging Drive connection:

1. Log in as the fictional student and upload newly authored fictional proposal/manuscript material for the project.
2. Submit it to the first milestone through the normal task-submission flow.
3. Log in as the adviser, review it, request a revision, then use the student account to upload a revised version and resubmit.
4. Continue the normal milestone/defense UI with the three panelists. Create evaluations and any final decision only through the application.

This is required for accessible Drive files, authentic version history, reviews, and immutable snapshots. The demo seed deliberately never fabricates those records or Drive IDs.

## Cleanup

Before cleanup, remove only the fictional files through the authorized staging document workflow. The cleanup command refuses to run if any panel documents or official archive records remain.

```powershell
$env:PANEL_DEMO_CLEANUP_CONFIRMATION = "DELETE:PANEL-DEMO-2026-11-ABC12345"
npm run db:panel-demo -- cleanup
```

Cleanup is bounded to the exact marker and exact seven generated account identities, deletes the project/workflow/users in dependency order, preserves the reviewed Students, administrator, and reference catalog, and verifies no marked accounts remain.
