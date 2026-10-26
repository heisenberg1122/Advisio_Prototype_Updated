# Notification email templates

Advisio uses a shared, table-based HTML layout with the official logo, navy headings,
blue action buttons, a 600px maximum content width, left-aligned body text, and a
plain-text alternative. The logo is served at `/advisio-email-logo.png` by the web
app. Emails are sent individually from the configured system mailbox.

## Configure delivery

Follow [Gmail sender setup](gmail-setup.md) for `advisio.main@gmail.com`.
After authorizing the mailbox and applying database migrations, set these API-host
variables and restart the API:

```dotenv
EMAIL_PROVIDER="gmail"
GMAIL_SENDER_EMAIL="advisio.main@gmail.com"
NOTIFICATION_EMAILS_ENABLED="true"
WEB_URL="https://advisio-prototype-updated.vercel.app"
```

The Gmail client ID, secret, and refresh token are also required. They stay on
the API host. `EMAIL_LOGO_URL` can override the default public logo URL.
`MAIL_EMAIL_NOTIFICATIONS` separately controls the older generic internal-mail
alerts; it does not enable these fourteen event templates.

Run `npm --workspace=@research-management/database exec -- prisma migrate deploy`
from the repository root to apply migrations to the configured database. Confirm
the intended environment first. The new migration is
`20261026110000_notification_email_queue`; it adds delivery metadata to in-app
notifications and workflow/department audience fields to announcements. Existing
notifications have no email template and are not backfilled into the queue.

## Event catalog

| Key | Trigger and recipients |
| --- | --- |
| `account_approved` | A Google account changes from a non-active status to ACTIVE after administrative verification; the account holder |
| `workflow_invitation` | A professor creates an addressed workflow invitation; the invited researcher |
| `announcement` | Published system notices, Dean college/department notices, or an owned published workflow notice; its authorized active recipients |
| `submission_approved` | A task is approved, a milestone completes, or mandatory manuscript reviewers approve the exact version; affected active research team members |
| `submission_rejected` | A task submission is rejected; affected research team members |
| `submission_revision` | A task or manuscript version needs revision; affected research team members |
| `requirement_created` | A requirement is added to a published workflow, or a workflow is published with a milestone summary; enrolled participants and project members |
| `requirement_due` | An automatic three-day or one-day reminder, or an authorized professor's manual reminder; affected researchers |
| `team_invitation` | An active leader invites an approved registered researcher in the same academic program; the invited researcher |
| `team_joined` | A researcher joins a workspace/project, or a leader accepts their join request; inviter and current team leaders, deduplicated |
| `defense_eligible` | A defense eligibility gate is explicitly approved; active research team members |
| `workflow_completed` | The workflow advances through its last satisfied milestone; active research team members |
| `title_defended` | A TITLE_DEFENSE result is officially released as APPROVED; active research team members |
| `thesis_defended` | A FINAL_DEFENSE or FINAL_ORAL_DEFENSE result is officially released as APPROVED; active research team members |

Defense success follows the same strict pass rule as defense badges. Minor/major
revision decisions do not generate a congratulations email. A completed meeting
alone does not trigger success. Defense eligibility does not imply scheduling.

Team leaders can use **My Group → Invite a researcher**. Invitations use the
registered email address and the existing invitation-code acceptance flow. The
same person cannot receive repeated addressed invitations for the same code more
than once per UTC day. Accepting a code requiring leader approval sends the joined
email only after approval. An invitation never grants membership automatically.

Professors select a published workflow when posting announcements. Deans can
publish to their assigned program, a valid department inside their college, or
their college if they have no program assignment. System-wide publishing retains
its System Administrator permission. The announcement feed also enforces these
audiences; changing the email template cannot expand the recipient list.

## Edit wording without changing application code

Copy `docs/notification-template-overrides.example.json` to a server-local JSON
file and set `EMAIL_TEMPLATE_OVERRIDES_PATH` to its absolute path. The worker reloads
it before every delivery batch, so edits apply to queued, unsent emails without a
restart. On a container host, mount the file or include it in the deployment;
editing an ephemeral filesystem is not a durable production configuration.

Each entry can override `subject`, `heading`, `paragraphs`, and `button`. Partial
overrides inherit defaults. Text is plain text with `{variableName}` substitutions;
all inserted values are escaped in HTML. Missing variables fail delivery rather
than showing unresolved placeholders. Invalid JSON pauses queue processing until
fixed. Custom overrides do not edit emails already sent.

Common variables are `firstName`, `title`, and `message`. Event-specific variables:

| Events | Additional variables |
| --- | --- |
| Workflow invitation | `actorName`, `workflowName` |
| Announcement | `actorName`, `scope` |
| Requirement created | `workflowName`, `dueDate` |
| Due reminder | `dueDate` |
| Team invitation / joined | `actorName`, `teamName` |
| Workflow completion | `workflowName` |
| Defense pass | `researchTitle`, `result` |

For permanent source changes, edit `packages/email/src/templates/notifications.ts`.
That file holds all fourteen definitions and the single shared layout.

## Add another event

1. Add a complete definition under a new key in the catalog or override JSON.
2. In the event's existing transaction, add
   `...emailNotification("your_new_key", { yourVariable: "value" })` to its in-app
   notification data. Set `actionUrl` to an application-relative destination.
3. Use a stable event-specific `deduplicationKey` and `skipDuplicates: true` when
   the event can be replayed. Select recipients using the event's existing access
   checks, not a client-provided list of email addresses.
4. Supply every variable referenced by your definition, rebuild, and preview.

Adding a definition alone does not create a new event trigger or a recipient list.

## Delivery behavior and operations

The email metadata commits in the same transaction as its notification. The worker
polls every 30 seconds, takes a database lease, sends one recipient per email, and
records provider acceptance in `emailSentAt`. Gmail acceptance is not proof of inbox
placement. A failure retries with backoff up to five attempts; inspect
`emailAttempts`, `emailLastError`, and `emailNextAttemptAt` on the notification.
After fixing a failed job, an administrator can explicitly requeue it by resetting
its attempts and setting its next attempt time through a controlled database
operation. No public requeue or arbitrary-send endpoint is exposed.

The lease prevents competing API instances from normally sending the same job.
As with other external mail systems, a crash after provider acceptance but before
the database acknowledgement can produce a duplicate. Delivery is not exactly-once.
Inactive recipients are suppressed. There is no automatic resend of historical
notifications. Do not enable email in development against real user data unless
you intend to deliver its queued events.

Automatic reminder scans run hourly and only use the current available milestone.
Relative dates use actual activation times; fixed dates end at 11:59:59 PM in
Asia/Manila. Reminders stop for submitted, under-review, and approved requirements.
Automatic queued reminders are checked again before sending. A changed deadline
gets a new reminder identity; an expired reminder is suppressed.

## Preview and validate

For a deployed Docker API, run this in Render Shell from `/app` to inspect
configuration without printing credentials or sending mail:

```bash
node apps/api/scripts/check-gmail.mjs
```

To explicitly send one connection-test email to an address you control:

```bash
node apps/api/scripts/check-gmail.mjs --to YOUR_TEST_EMAIL
```

The worker logs safe error codes and persists them in `emailLastError`:
`GMAIL_INVALID_CLIENT` means the OAuth client credentials were rejected;
`GMAIL_INVALID_GRANT` means the refresh token was rejected;
`GMAIL_SCOPE_INSUFFICIENT` means the send permission is missing. Provider bodies,
credentials, and email content are excluded from these diagnostics. Fix the
configuration first; jobs that already reached five attempts need an explicit
requeue, or use the separate connection-test command to validate the fix.

Run `npm run email:preview` to generate all fourteen examples plus a desktop/mobile
gallery at `.local/email-previews/index.html`. Open that file locally. This sends
no messages. The examples use sample names and links based on
`EMAIL_PREVIEW_WEB_URL` (falling back to `WEB_URL`) from the root `.env`.
Set `EMAIL_PREVIEW_WEB_URL=https://advisio-prototype-updated.vercel.app` to preview
live application links while keeping local development on localhost. Real delivery
uses the API host's `WEB_URL` and the event's destination; set that production
variable to `https://advisio-prototype-updated.vercel.app` before enabling email.

The isolated database suite includes transaction rollback, deduplication, competing
lease claims, and provider retry tests. The provider is mocked; integration tests
do not send real Gmail messages.
